const ADMIN_STORAGE_KEY = "jorjetteangel-admin-catalog";
const CLIENT_PROFILE_STORAGE_KEY = "jorjetteangel-client-profiles";
const CUSTOMER_ORDERS_STORAGE_KEY = "jorjetteangel-orders";

const defaultState = {
  catalogVersion: 3,
  categories: [],
  products: [],
  auditTrail: [],
};

let customFieldsDraft = [];
let originalCustomSizingEnabled = false;
let productImagesDraft = [];


// Convert legacy single-image product data into the current images-array shape.
function normalizeProductImages(product) {
  const { image, ...productData } = product;
  return {
    ...productData,
    images: Array.isArray(product.images)
      ? product.images.filter(Boolean)
      : image
        ? [image]
        : [],
  };
}


// Load and validate catalog state, creating an empty versioned state if needed.
function readState() {
  const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (!saved) {
    const initialState = structuredClone(defaultState);
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }
  const savedState = JSON.parse(saved);
  if (savedState.catalogVersion !== defaultState.catalogVersion) {
    const initialState = structuredClone(defaultState);
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }
  const state = savedState;
  if (
    !Array.isArray(state.categories) ||
    !Array.isArray(state.products) ||
    !Array.isArray(state.auditTrail)
  ) {
    throw new Error("Saved catalog collections must be arrays.");
  }
  state.products = state.products.map(normalizeProductImages);
  state.categories = state.categories.map((category) => ({
    ...category,
    status: category.status || "Active",
  }));
  return state;
}


// Normalize and persist catalog changes to shared browser storage.
function saveState(state) {
  state.products = state.products.map(normalizeProductImages);
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
}


// Resize a selected product image and encode it for compact browser storage.
async function importProductImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not an image file.`);
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error(`${file.name} is larger than the 12 MB import limit.`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(
      1,
      1400 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.78);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}


// Display current product images with controls for removing individual images.
function renderProductImagePreviews() {
  const previews = document.getElementById("product-image-previews");
  previews.replaceChildren();
  productImagesDraft.forEach((source, index) => {
    const preview = document.createElement("div");
    preview.className = "product-image-preview";
    const image = document.createElement("img");
    image.src = source;
    image.alt = `Product image ${index + 1}`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.setAttribute(
      "aria-label",
      `Remove product image ${index + 1}`,
    );
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      productImagesDraft.splice(index, 1);
      renderProductImagePreviews();
    });
    preview.append(image, removeButton);
    previews.append(preview);
  });
}


// Record a catalog action in the bounded admin audit history.
function addAuditEntry(state, action, entity, details) {
  state.auditTrail.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    entity,
    details,
    timestamp: new Date().toISOString(),
  });
  state.auditTrail = state.auditTrail.slice(0, 100);
}


// Convert a category name into a URL/storage-friendly identifier.
function makeId(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `item-${Date.now()}`
  );
}


// Format a price in Philippine pesos or indicate consultation pricing.
function formatPrice(price) {
  return price
    ? `PHP ${Number(price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : "By consultation";
}


// Find a category label for a product, with a fallback for missing categories.
function categoryName(state, categoryId) {
  return (
    window.findArrayItem(
      state.categories,
      categoryId,
      (category) => category.id,
    )?.name ||
    "Unassigned"
  );
}


// Format an audit timestamp for display in the admin dashboard.
function formatAuditTime(timestamp) {
  return new Date(timestamp).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}


// Render recent catalog and category actions in the audit list.
function renderAuditTrail(state) {
  const auditList = document.getElementById("audit-list");
  if (!auditList) return;
  const actionLabels = {
    "Added product": "Add catalog",
    "Updated product": "Update catalog",
    "Archived product": "Archive catalog",
    "Restored product": "Restore catalog",
    "Deleted product": "Delete catalog",
    "Added category": "Add category",
    "Updated category": "Update category",
    "Deleted category": "Delete category",
    "Archived category": "Archive category",
    "Restored category": "Restore category",
  };
  auditList.innerHTML = state.auditTrail.length
    ? state.auditTrail
        .map(
          (entry) => `<li class="audit-item">
            <span>Admin | ${actionLabels[entry.action] || entry.action} "${entry.details}" | ${formatAuditTime(entry.timestamp)}</span>
          </li>`,
        )
        .join("")
    : `<li class="status">No admin changes recorded yet.</li>`;
}


// Update dashboard totals and render editable catalog categories.
function renderDashboard(state) {
  document.getElementById("product-count").textContent = state.products.length;
  document.getElementById("category-count").textContent =
    state.categories.length;
  document.getElementById("active-count").textContent = state.products.filter(
    (product) => product.status === "Active",
  ).length;

  const categoryList = document.getElementById("category-list");
  categoryList.innerHTML = state.categories
    .map(
      (category) => `
    <li>
      <span>${category.name}</span>
      <span class="button-row">
        <button class="button button-secondary button-small" data-edit-category="${category.id}" type="button">Edit</button>
        <button class="button button-secondary button-small" data-archive-category="${category.id}" type="button">${category.status === "Archived" ? "Restore" : "Archive"}</button>
      </span>
    </li>
  `,
    )
    .join("");
}


// Render registered customer profiles in the dashboard's read-only table.
function renderCustomerAccounts() {
  const accountsBody = document.getElementById("customer-accounts-body");
  const customerCount = document.getElementById("customer-count");
  if (!accountsBody || !customerCount) return;

  try {
    const savedProfiles = localStorage.getItem(CLIENT_PROFILE_STORAGE_KEY);
    const profiles = savedProfiles ? JSON.parse(savedProfiles) : [];
    if (!Array.isArray(profiles)) {
      throw new Error("Saved client profiles must be an array.");
    }

    customerCount.textContent = profiles.length;
    if (!profiles.length) {
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 4;
      emptyCell.textContent = "No customer accounts have been registered yet.";
      const emptyRow = document.createElement("tr");
      emptyRow.append(emptyCell);
      accountsBody.replaceChildren(emptyRow);
      return;
    }

    const preferenceLabels = {
      rtw: "Ready-to-Wear Items",
      bespoke: "Bespoke Tailoring",
      corporate: "Bulk Order",
    };
    const rows = profiles.map((savedProfile) => {
      const profile =
        savedProfile && typeof savedProfile === "object" ? savedProfile : {};
      const name = [profile.firstName, profile.lastName]
        .filter((part) => typeof part === "string" && part.trim())
        .join(" ");
      const preference =
        typeof profile.preference === "string"
          ? preferenceLabels[profile.preference] || profile.preference
          : "";
      const row = document.createElement("tr");
      [name, profile.email, profile.mobile, preference].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = typeof value === "string" && value.trim() ? value : "—";
        row.append(cell);
      });
      return row;
    });
    accountsBody.replaceChildren(...rows);
  } catch (error) {
    console.error("Could not load registered customer accounts.", error);
    customerCount.textContent = "—";
    const errorCell = document.createElement("td");
    errorCell.colSpan = 4;
    errorCell.textContent = "Unable to load customer accounts.";
    const errorRow = document.createElement("tr");
    errorRow.append(errorCell);
    accountsBody.replaceChildren(errorRow);
  }
}


// Render incoming orders in reverse chronological order in the admin table.
function renderIncomingOrders() {
  const ordersBody = document.getElementById("incoming-orders-body");
  const ordersCount = document.getElementById("incoming-orders-count");
  if (!ordersBody || !ordersCount) return;

  try {
    const savedOrders = localStorage.getItem(CUSTOMER_ORDERS_STORAGE_KEY);
    const orders = savedOrders ? JSON.parse(savedOrders) : [];
    if (!Array.isArray(orders)) {
      throw new Error("Saved customer orders must be an array.");
    }

    const sortedOrders = window.bubbleSortArray(
      orders.filter((order) => order && typeof order === "object"),
      (first, second) =>
        new Date(second.createdAt || 0).getTime() -
        new Date(first.createdAt || 0).getTime(),
    );
    ordersCount.textContent = `${sortedOrders.length} order${sortedOrders.length === 1 ? "" : "s"} received`;

    if (!sortedOrders.length) {
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 7;
      emptyCell.textContent = "No incoming orders yet.";
      const emptyRow = document.createElement("tr");
      emptyRow.append(emptyCell);
      ordersBody.replaceChildren(emptyRow);
      return;
    }

    const rows = sortedOrders.map((order) => {
      const row = document.createElement("tr");
      const date = new Date(order.createdAt || "");
      const dateText = Number.isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          });
      const orderCell = document.createElement("td");
      orderCell.textContent = `${order.reference || "Order"} · ${dateText}`;

      const customerCell = document.createElement("td");
      customerCell.textContent = [
        order.customer?.name,
        order.customer?.email,
        order.customer?.mobile,
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .join("\n") || "Customer details unavailable";
      customerCell.classList.add("orders-multiline-cell");

      const itemsCell = document.createElement("td");
      itemsCell.textContent = Array.isArray(order.items)
        ? order.items
            .map((item) => {
              const itemName =
                item && typeof item.name === "string" ? item.name : "Item";
              const size =
                item && typeof item.size === "string" ? ` · ${item.size}` : "";
              const quantity = Math.max(1, Number(item?.quantity) || 1);
              return `${itemName}${size} × ${quantity}`;
            })
            .join("\n")
        : "Order items unavailable";
      itemsCell.classList.add("orders-multiline-cell");

      const address = order.deliveryAddress;
      const addressCell = document.createElement("td");
      addressCell.textContent =
        address && typeof address === "object"
          ? [
              address.street,
              address.city,
              address.province,
              address.postalCode,
              address.notes ? `Notes: ${address.notes}` : "",
            ]
              .filter((value) => typeof value === "string" && value.trim())
              .join(", ") || "Delivery address unavailable"
          : "Delivery address unavailable";

      const paymentCell = document.createElement("td");
      paymentCell.textContent =
        typeof order.paymentMethod === "string"
          ? order.paymentMethod
          : "Not specified";

      const totalCell = document.createElement("td");
      totalCell.textContent = formatPrice(Number(order.total) || 0);

      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      status.className = "badge";
      status.textContent =
        typeof order.status === "string" ? order.status : "Received";
      statusCell.append(status);

      row.append(
        orderCell,
        customerCell,
        itemsCell,
        addressCell,
        paymentCell,
        totalCell,
        statusCell,
      );
      return row;
    });
    ordersBody.replaceChildren(...rows);
  } catch (error) {
    console.error("Could not load incoming customer orders.", error);
    ordersCount.textContent = "Orders could not be loaded";
    const errorCell = document.createElement("td");
    errorCell.colSpan = 7;
    errorCell.textContent = "Unable to load incoming orders.";
    const errorRow = document.createElement("tr");
    errorRow.append(errorCell);
    ordersBody.replaceChildren(errorRow);
  }
}


// Render non-archived catalog items using the selected category filter.
function renderCatalog(state) {
  const categoryFilter = document.getElementById("catalog-category-filter");
  const selectedCategory = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="">All categories</option>${state.categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join("")}`;
  categoryFilter.value = selectedCategory;

  const rows = state.products.filter(
    (product) =>
      product.status !== "Archived" &&
      (!selectedCategory || product.categoryId === selectedCategory),
  );
  document.getElementById("catalog-count").textContent =
    `${rows.length} item${rows.length === 1 ? "" : "s"}`;
  document.getElementById("catalog-body").innerHTML =
    rows
      .map(
        (product) => `
    <tr>
      <td><strong>${product.name}</strong></td>
      <td><span class="badge">${categoryName(state, product.categoryId)}</span></td>
      <td>${formatPrice(product.price)}</td>
      <td><span class="status">${product.status}</span></td>
      <td>
        <span class="button-row">
          <button class="button button-secondary button-small" data-edit-product="${product.id}" type="button">Edit</button>
          <button class="button button-secondary button-small" data-archive-product="${product.id}" type="button">${product.status === "Archived" ? "Restore" : "Archive"}</button>
        </span>
      </td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="5">No products in this category.</td></tr>`;
}


// Render archived products and categories with their restore controls.
function renderArchivedCatalog(state) {
  const categoryFilter = document.getElementById("archived-category-filter");
  const selectedCategory = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="">All categories</option>${state.categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join("")}`;
  categoryFilter.value = selectedCategory;

  const archivedRows = state.products.filter(
    (product) =>
      product.status === "Archived" &&
      (!selectedCategory || product.categoryId === selectedCategory),
  );
  document.getElementById("archived-catalog-count").textContent =
    `${archivedRows.length} item${archivedRows.length === 1 ? "" : "s"}`;
  document.getElementById("archived-catalog-body").innerHTML =
    archivedRows
      .map(
        (product) => `
      <tr>
        <td><strong>${product.name}</strong></td>
        <td><span class="badge">${categoryName(state, product.categoryId)}</span></td>
        <td>${formatPrice(product.price)}</td>
        <td><span class="status">${product.status}</span></td>
        <td>
          <span class="button-row">
            <button class="button button-secondary button-small" data-archive-product="${product.id}" type="button">Restore</button>
          </span>
        </td>
      </tr>
    `,
      )
      .join("") || `<tr><td colspan="5">No archived products.</td></tr>`;

  const archivedCategories = state.categories.filter(
    (category) => category.status === "Archived",
  );
  document.getElementById("archived-category-count").textContent =
    `${archivedCategories.length} item${archivedCategories.length === 1 ? "" : "s"}`;
  document.getElementById("archived-category-body").innerHTML =
    archivedCategories
      .map(
        (category) => `
    <tr>
      <td><strong>${category.name}</strong></td>
      <td><span class="status">${category.status}</span></td>
      <td>
        <span class="button-row">
          <button class="button button-secondary button-small" data-restore-category="${category.id}" type="button">Restore</button>
        </span>
      </td>
    </tr>
  `,
      )
      .join("") || `<tr><td colspan="3">No archived categories.</td></tr>`;
}


// Normalize legacy or current custom-sizing definitions into one field shape.
function normalizeCustomField(field) {
  if (typeof field === "string") {
    return {
      name: field,
      unit: "in",
      minimum: "",
      maximum: "",
    };
  }
  return {
    name: field?.name || "",
    unit: field?.unit === "cm" ? "cm" : "in",
    minimum: field?.minimum ?? "",
    maximum: field?.maximum ?? "",
  };
}


// Add a configurable measurement row to the custom-sizing editor.
function addCustomAttributeRow(field = { name: "", unit: "in" }) {
  const row = document.createElement("div");
  row.className = "custom-attribute-row";

  const nameInput = document.createElement("input");
  nameInput.className = "field";
  nameInput.type = "text";
  nameInput.placeholder = "e.g. Chest";
  nameInput.value = field.name;
  nameInput.setAttribute("aria-label", "Attribute name");

  const unitSelect = document.createElement("select");
  unitSelect.className = "select";
  unitSelect.setAttribute("aria-label", "Attribute unit");
  unitSelect.innerHTML =
    '<option value="in">Inches (in)</option><option value="cm">Centimeters (cm)</option>';
  unitSelect.value = field.unit;

  const limits = document.createElement("div");
  limits.className = "custom-attribute-limits";
  [["minimum", "Minimum"], ["maximum", "Maximum"]].forEach(([key, label]) => {
    const limitLabel = document.createElement("label");
    limitLabel.className = "custom-attribute-limit";
    limitLabel.textContent = label;
    const limitInput = document.createElement("input");
    limitInput.className = "field";
    limitInput.dataset.limit = key;
    limitInput.type = "number";
    limitInput.min = "0";
    limitInput.step = "any";
    limitInput.required = true;
    limitInput.value =
      field[key] !== undefined && field[key] !== "" ? field[key] : "";
    limitInput.setAttribute(
      "aria-label",
      `${label} (${unitSelect.value === "cm" ? "centimeters" : "inches"})`,
    );
    limitLabel.append(limitInput);
    limits.append(limitLabel);
  });
  unitSelect.addEventListener("change", () => {
    limits.querySelectorAll("input").forEach((input, index) => {
      const [key, label] = [["minimum", "Minimum"], ["maximum", "Maximum"]][
        index
      ];
      input.setAttribute(
        "aria-label",
        `${label} (${unitSelect.value === "cm" ? "centimeters" : "inches"})`,
      );
    });
  });

  const removeButton = document.createElement("button");
  removeButton.className = "button button-secondary button-small";
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => row.remove());

  row.append(nameInput, unitSelect, removeButton, limits);
  document.getElementById("custom-attribute-list").append(row);
}


// Rebuild custom-sizing editor rows from the current draft fields.
function renderCustomAttributeRows() {
  const list = document.getElementById("custom-attribute-list");
  list.replaceChildren();
  customFieldsDraft.forEach(addCustomAttributeRow);
}


// Show the custom-sizing editor and focus its add-attribute control.
function openCustomSizingModal() {
  renderCustomAttributeRows();
  document.getElementById("custom-sizing-modal").classList.remove("hidden");
  document.getElementById("add-custom-attribute").focus();
}


// Close the sizing editor and restore the prior toggle when cancelled.
function closeCustomSizingModal(cancelled = false) {
  document.getElementById("custom-sizing-modal").classList.add("hidden");
  if (cancelled) {
    document.getElementById("offer-custom-sizing").checked =
      originalCustomSizingEnabled;
    document
      .getElementById("configure-custom-attributes")
      .classList.toggle("hidden", !originalCustomSizingEnabled);
  }
}


// Validate measurement names and hard limits before saving the field draft.
function saveCustomSizingAttributes() {
  const rows = Array.from(
    document.querySelectorAll(".custom-attribute-row"),
  );
  const attributes = rows.map((row) => {
    const valueFor = (name) =>
      row.querySelector(`[data-limit="${name}"]`).value;
    let hasAllLimits = true;
    for (const key of ["minimum", "maximum"]) {
      if (!valueFor(key).trim()) {
        hasAllLimits = false;
        break;
      }
    }
    return {
      name: row.querySelector('input[type="text"]').value.trim(),
      unit: row.querySelector("select").value,
      minimum: Number(valueFor("minimum")),
      maximum: Number(valueFor("maximum")),
      hasAllLimits,
    };
  }).filter((field) => field.name);
  if (!attributes.length) {
    alert("Add at least one custom sizing attribute.");
    return;
  }
  let missingLimits = null;
  for (const field of attributes) {
    if (!field.hasAllLimits) {
      missingLimits = field;
      break;
    }
  }
  if (missingLimits) {
    alert(
      `Enter both minimum and maximum limits for ${missingLimits.name}.`,
    );
    return;
  }
  let invalidLimits = null;
  for (const field of attributes) {
    const { minimum, maximum } = field;
    const limitsAreFinite =
      Number.isFinite(minimum) && Number.isFinite(maximum);
    if (
      !limitsAreFinite ||
      minimum < 0 ||
      maximum <= minimum
    ) {
      invalidLimits = field;
      break;
    }
  }
  if (invalidLimits) {
    alert(
      `For ${invalidLimits.name}, maximum must be greater than minimum.`,
    );
    return;
  }
  const names = attributes.map((field) => field.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    alert("Each custom sizing attribute must have a unique name.");
    return;
  }
  customFieldsDraft = attributes.map(({ name, unit, minimum, maximum }) => ({
    name,
    unit,
    minimum,
    maximum,
  }));
  originalCustomSizingEnabled = true;
  document
    .getElementById("configure-custom-attributes")
    .classList.remove("hidden");
  closeCustomSizingModal();
}


// Populate and open the product editor for an existing catalog item.
function fillProductForm(state, productId) {
  const product = window.findArrayItem(
    state.products,
    productId,
    (item) => item.id,
  );
  if (!product) return;
  document.getElementById("product-modal-title").textContent =
    "Update catalog item";
  document.getElementById("product-id").value = product.id;
  document.getElementById("product-name").value = product.name;
  document.getElementById("product-price").value = product.price || "";
  productImagesDraft = normalizeProductImages(product).images;
  renderProductImagePreviews();
  document.getElementById("product-description").value =
    product.description || "";
  document.getElementById("product-category").value = product.categoryId;
  const offerRegularSizing = product.offerRegularSizing ?? true;
  const offerCustomSizing =
    product.offerCustomSizing ?? product.sizeMode === "custom";
  document.getElementById("offer-regular-sizing").checked = offerRegularSizing;
  document.getElementById("offer-custom-sizing").checked = offerCustomSizing;
  customFieldsDraft = (product.customFields || [])
    .map(normalizeCustomField)
    .filter((field) => field.name);
  originalCustomSizingEnabled = offerCustomSizing;
  document
    .getElementById("configure-custom-attributes")
    .classList.toggle("hidden", !offerCustomSizing);
  document.getElementById("product-modal").classList.remove("hidden");
  if (offerCustomSizing) openCustomSizingModal();
}


// Rebuild the product editor's category selector from current catalog data.
function refreshProductCategoryOptions(state) {
  document.getElementById("product-category").innerHTML = state.categories
    .map(
      (category) => `<option value="${category.id}">${category.name}</option>`,
    )
    .join("");
}


// Edit or toggle the archived status of a product based on the clicked control.
function handleProductAction(state, event) {
  const editId = event.target.dataset.editProduct;
  const archiveId = event.target.dataset.archiveProduct;
  if (editId) fillProductForm(state, editId);
  if (!archiveId) return;

  state.products = state.products.map((product) =>
    product.id === archiveId
      ? {
          ...product,
          status: product.status === "Archived" ? "Active" : "Archived",
        }
      : product,
  );
  const changedProduct = window.findArrayItem(
    state.products,
    archiveId,
    (product) => product.id,
  );
  if (!changedProduct) return;
  addAuditEntry(
    state,
    changedProduct.status === "Archived"
      ? "Archived product"
      : "Restored product",
    "Product",
    changedProduct.name,
  );
  saveState(state);
  if (document.body.dataset.page === "archived-catalog") {
    renderArchivedCatalog(state);
  } else {
    renderCatalog(state);
  }
}


// Restore an archived category and update the audit history.
function handleArchivedCategoryAction(state, event) {
  const categoryId = event.target.dataset.restoreCategory;
  if (!categoryId) return;

  const category = window.findArrayItem(
    state.categories,
    categoryId,
    (item) => item.id,
  );
  if (!category) return;
  category.status = "Active";
  addAuditEntry(state, "Restored category", "Category", category.name);
  saveState(state);
  renderArchivedCatalog(state);
}

const state = readState();

window.addEventListener("storage", (event) => {
  if (event.key !== ADMIN_STORAGE_KEY) return;
  const latestState = readState();
  Object.assign(state, latestState);
  if (document.body.dataset.page === "dashboard") {
    renderDashboard(state);
    renderAuditTrail(state);
  } else if (document.body.dataset.page === "archived-catalog") {
    renderArchivedCatalog(state);
  } else {
    renderCatalog(state);
  }
});

if (document.body.dataset.page === "dashboard") {
  renderDashboard(state);
  renderCustomerAccounts();
  renderIncomingOrders();
  renderAuditTrail(state);
  window.addEventListener("storage", (event) => {
    if (event.key === CLIENT_PROFILE_STORAGE_KEY) renderCustomerAccounts();
    if (event.key === CUSTOMER_ORDERS_STORAGE_KEY) renderIncomingOrders();
  });
  const categoryForm = document.getElementById("category-form");
  const categoryIdInput = document.getElementById("category-id");
  const categoryNameInput = document.getElementById("category-name");
  const categoryCancel = document.getElementById("category-cancel");

  categoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = categoryNameInput.value.trim();
    if (!name) return;
    const existingId = categoryIdInput.value;
    if (existingId) {
      const previousCategory = window.findArrayItem(
        state.categories,
        existingId,
        (category) => category.id,
      );
      state.categories = state.categories.map((category) =>
        category.id === existingId ? { ...category, name } : category,
      );
      addAuditEntry(
        state,
        "Updated category",
        "Category",
        `${previousCategory.name} -> ${name}`,
      );
    } else {
      const category = { id: makeId(name), name, status: "Active" };
      state.categories.push(category);
      addAuditEntry(state, "Added category", "Category", name);
    }
    saveState(state);
    categoryForm.reset();
    categoryIdInput.value = "";
    categoryCancel.classList.add("hidden");
    renderDashboard(state);
    renderAuditTrail(state);
  });

  categoryCancel.addEventListener("click", () => {
    categoryForm.reset();
    categoryIdInput.value = "";
    categoryCancel.classList.add("hidden");
  });

  document
    .getElementById("category-list")
    .addEventListener("click", (event) => {
      const editId = event.target.dataset.editCategory;
      const archiveId = event.target.dataset.archiveCategory;
      if (editId) {
        const category = window.findArrayItem(
          state.categories,
          editId,
          (item) => item.id,
        );
        if (!category) return;
        categoryIdInput.value = category.id;
        categoryNameInput.value = category.name;
        categoryCancel.classList.remove("hidden");
        categoryNameInput.focus();
      }
      if (archiveId) {
        const archivedCategory = window.findArrayItem(
          state.categories,
          archiveId,
          (category) => category.id,
        );
        if (!archivedCategory) return;
        archivedCategory.status =
          archivedCategory.status === "Archived" ? "Active" : "Archived";
        addAuditEntry(
          state,
          archivedCategory.status === "Archived"
            ? "Archived category"
            : "Restored category",
          "Category",
          archivedCategory.name,
        );
        saveState(state);
        renderDashboard(state);
        renderAuditTrail(state);
      }
    });
}

if (document.body.dataset.page === "catalog") {
  refreshProductCategoryOptions(state);
  renderCatalog(state);
  const modal = document.getElementById("product-modal");
  const form = document.getElementById("product-form");
  const customSizingCheckbox = document.getElementById("offer-custom-sizing");
  const productImagesInput = document.getElementById("product-images");
  const configureCustomAttributes = document.getElementById(
    "configure-custom-attributes",
  );

  document
    .getElementById("catalog-category-filter")
    .addEventListener("change", () => renderCatalog(state));
  productImagesInput.addEventListener("change", async () => {
    const files = Array.from(productImagesInput.files || []);
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    try {
      for (const file of files) {
        if (productImagesDraft.length >= 6) {
          throw new Error("A product can have up to six images.");
        }
        const importedImage = await importProductImage(file);
        const nextImages = [...productImagesDraft, importedImage];
        const productId = document.getElementById("product-id").value;
        const existingProduct = window.findArrayItem(
          state.products,
          productId,
          (product) => product.id,
        );
        const products = existingProduct
          ? state.products.map((product) =>
              product.id === productId
                ? { ...product, images: nextImages }
                : product,
            )
          : [
              ...state.products,
              { id: "image-import-preview", images: nextImages },
            ];
        if (JSON.stringify({ ...state, products }).length > 2_000_000) {
          throw new Error(
            "These images exceed the catalog's browser storage limit. Import fewer or smaller images.",
          );
        }
        productImagesDraft = nextImages;
        renderProductImagePreviews();
      }
    } catch (error) {
      alert(error.message);
    } finally {
      productImagesInput.value = "";
      saveButton.disabled = false;
    }
  });
  document.getElementById("add-product").addEventListener("click", () => {
    form.reset();
    document.getElementById("product-id").value = "";
    productImagesDraft = [];
    renderProductImagePreviews();
    customFieldsDraft = [];
    originalCustomSizingEnabled = false;
    configureCustomAttributes.classList.add("hidden");
    document.getElementById("product-modal-title").textContent =
      "Add catalog item";
    modal.classList.remove("hidden");
  });
  document
    .getElementById("close-product-modal")
    .addEventListener("click", () => modal.classList.add("hidden"));
  customSizingCheckbox.addEventListener("change", () => {
    if (customSizingCheckbox.checked) {
      configureCustomAttributes.classList.remove("hidden");
      openCustomSizingModal();
    } else {
      originalCustomSizingEnabled = false;
      configureCustomAttributes.classList.add("hidden");
    }
  });
  configureCustomAttributes.addEventListener("click", openCustomSizingModal);
  document
    .getElementById("add-custom-attribute")
    .addEventListener("click", () => addCustomAttributeRow());
  document
    .getElementById("save-custom-sizing")
    .addEventListener("click", saveCustomSizingAttributes);
  document
    .getElementById("close-custom-sizing-modal")
    .addEventListener("click", () => closeCustomSizingModal(true));
  document
    .getElementById("cancel-custom-sizing")
    .addEventListener("click", () => closeCustomSizingModal(true));
  document
    .getElementById("custom-sizing-modal")
    .addEventListener("click", (event) => {
      if (event.target.id === "custom-sizing-modal") {
        closeCustomSizingModal(true);
      }
    });
  window.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !document
        .getElementById("custom-sizing-modal")
        .classList.contains("hidden")
    ) {
      closeCustomSizingModal(true);
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const productId = document.getElementById("product-id").value;
    const offerRegularSizing = document.getElementById(
      "offer-regular-sizing",
    ).checked;
    const offerCustomSizing = document.getElementById(
      "offer-custom-sizing",
    ).checked;
    if (!offerRegularSizing && !offerCustomSizing) {
      const regularSizingInput = document.getElementById(
        "offer-regular-sizing",
      );
      regularSizingInput.focus();
      regularSizingInput.setCustomValidity(
        "Select at least one sizing format.",
      );
      regularSizingInput.reportValidity();
      regularSizingInput.setCustomValidity("");
      return;
    }
    if (offerCustomSizing && !customFieldsDraft.length) {
      openCustomSizingModal();
      return;
    }
    const existingProduct = productId
      ? window.findArrayItem(state.products, productId, (item) => item.id)
      : null;
    const product = {
      id: productId || `product-${Date.now()}`,
      name: document.getElementById("product-name").value.trim(),
      categoryId: document.getElementById("product-category").value,
      price: Number(document.getElementById("product-price").value) || 0,
      images: [...productImagesDraft],
      description: document.getElementById("product-description").value.trim(),
      sizeMode:
        offerCustomSizing && !offerRegularSizing ? "custom" : "standard",
      offerRegularSizing,
      offerCustomSizing,
      customFields: offerCustomSizing
        ? customFieldsDraft
        : existingProduct?.customFields || [],
      status: productId ? existingProduct.status : "Active",
    };
    if (!product.name) return;
    state.products = productId
      ? state.products.map((item) => (item.id === productId ? product : item))
      : [...state.products, product];
    addAuditEntry(
      state,
      productId ? "Updated product" : "Added product",
      "Product",
      `${product.name} (${categoryName(state, product.categoryId)})`,
    );
    saveState(state);
    renderCatalog(state);
    modal.classList.add("hidden");
  });

  document
    .getElementById("catalog-body")
    .addEventListener("click", (event) => handleProductAction(state, event));
}

if (document.body.dataset.page === "archived-catalog") {
  renderArchivedCatalog(state);
  document
    .getElementById("archived-category-filter")
    .addEventListener("change", () => renderArchivedCatalog(state));
  document
    .getElementById("archived-catalog-body")
    .addEventListener("click", (event) => handleProductAction(state, event));
  document
    .getElementById("archived-category-body")
    .addEventListener("click", (event) =>
      handleArchivedCategoryAction(state, event),
    );
}

