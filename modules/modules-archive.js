// Manages archived records and restores.

const ARCHIVE_KEYS = {
  catalog: "jorjetteangel-admin-catalog",
  accounts: "jorjetteangel-client-profiles",
  staffAccounts: "jorjetteangel-staff-accounts",
  adminAccounts: "jorjetteangel-admin-users",
  suppliers: "jg-erp-supplier-directory-v1",
  orders: "jorjetteangel-orders",
};
const AGED_ORDER_DAYS = 365;

const ARCHIVE_COLUMNS = {
  disabled: ["Account ID", "Name & Role", "Date Disabled", "Action"],
  staffAccounts: ["Employee ID", "Staff Name & Role", "Date Archived", "Action"],
  customerAccounts: ["Account ID", "Customer Name", "Date Archived", "Action"],
  products: ["Product ID", "Item Name & Category", "Date Archived", "Action"],
  suppliers: ["Vendor ID", "Company & Contact", "Date Archived", "Action"],
  orders: ["Order ID", "Customer (Type)", "Date Cleared", "Action"],
  system: ["Record ID", "Archived Record", "Date Archived", "Action"],
};
const ARCHIVE_LABELS = {
  disabled: "disabled account",
  staffAccounts: "staff account",
  customerAccounts: "customer account",
  products: "product",
  suppliers: "supplier",
  orders: "aged order",
  system: "other archived record",
};

let selectedArchiveType = "disabled";
let archiveRows = [];
let archivedCategoryRows = [];

function readStoredValue(key, fallback, label) {
  const stored = window.backendMemoryStorage.getItem(key);
  if (stored === null) return fallback;
  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error(`Saved ${label} data must be an array.`);
  }
  return parsed;
}

function readCatalog() {
  const stored = window.backendMemoryStorage.getItem(ARCHIVE_KEYS.catalog);
  if (stored === null) return { catalogVersion: 3, categories: [], products: [], auditTrail: [] };
  const catalog = JSON.parse(stored);
  if (
    !catalog ||
    !Array.isArray(catalog.categories) ||
    !Array.isArray(catalog.products) ||
    !Array.isArray(catalog.auditTrail)
  ) {
    throw new Error("Saved catalog data is invalid.");
  }
  return catalog;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );
}

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
}

function recordDate(record, namedFields, arrayIndex) {
  if (Array.isArray(record)) return record[arrayIndex] || "";
  for (const field of namedFields) {
    if (record?.[field]) return record[field];
  }
  return "";
}

function accountName(account) {
  return (
    [account.firstName, account.lastName].filter(Boolean).join(" ") ||
    account.name ||
    account.email ||
    "Account"
  );
}

function isArchivedAccount(account) {
  const statuses = [account.status, account.accountStatus].map((status) =>
    String(status || "").toLowerCase(),
  );
  return (
    statuses.some((status) =>
      ["inactive", "deactivated", "archived"].includes(status),
    ) ||
    account.isActive === false ||
    account.active === false
  );
}

function isDisabledByAdmin(account) {
  return (
    account.disabledByAdmin === true ||
    account.adminDisabled === true ||
    [account.disabledBy, account.deactivatedBy].some(
      (source) => String(source || "").toLowerCase() === "admin",
    )
  );
}

function accountRow(account, storageKey, accountType) {
  return {
    id:
      account.employeeId ||
      account.accountId ||
      account.id ||
      account.customerId ||
      account.email ||
      "Account",
    title: accountName(account),
    detail:
      account.role ||
      account.accountType ||
      (accountType === "customer" ? "Customer account" : "Staff account"),
    date: recordDate(
      account,
      ["disabledAt", "archivedAt", "dateArchived", "updatedAt"],
      -1,
    ),
    raw: account,
    storageKey,
  };
}

function readAccountCollection(storageKey, accountType) {
  return readStoredValue(storageKey, [], accountType).filter(
    (account) => account && typeof account === "object" && !Array.isArray(account),
  );
}

function loadDisabledAccounts() {
  return [
    ...readAccountCollection(ARCHIVE_KEYS.adminAccounts, "admin account").map(
      (account) => [account, ARCHIVE_KEYS.adminAccounts, "staff"],
    ),
    ...readAccountCollection(ARCHIVE_KEYS.staffAccounts, "staff account").map(
      (account) => [account, ARCHIVE_KEYS.staffAccounts, "staff"],
    ),
    ...readAccountCollection(ARCHIVE_KEYS.accounts, "customer account").map(
      (account) => [account, ARCHIVE_KEYS.accounts, "customer"],
    ),
  ]
    .filter(([account]) => isDisabledByAdmin(account) && isArchivedAccount(account))
    .map(([account, storageKey, accountType]) =>
      accountRow(account, storageKey, accountType),
    );
}

function loadArchivedStaffAccounts() {
  return [
    ...readAccountCollection(ARCHIVE_KEYS.adminAccounts, "admin account").map(
      (account) => [account, ARCHIVE_KEYS.adminAccounts],
    ),
    ...readAccountCollection(ARCHIVE_KEYS.staffAccounts, "staff account").map(
      (account) => [account, ARCHIVE_KEYS.staffAccounts],
    ),
  ]
    .filter(
      ([account]) => isArchivedAccount(account) && !isDisabledByAdmin(account),
    )
    .map(([account, storageKey]) => accountRow(account, storageKey, "staff"));
}

function loadArchivedCustomerAccounts() {
  return readAccountCollection(ARCHIVE_KEYS.accounts, "customer account")
    .filter(
      (account) => isArchivedAccount(account) && !isDisabledByAdmin(account),
    )
    .map((account) =>
      accountRow(account, ARCHIVE_KEYS.accounts, "customer"),
    );
}

function loadProducts(catalog) {
  const categoryNames = new Map(
    catalog.categories.map((category) => [category.id, category.name]),
  );
  return catalog.products
    .filter((product) => product?.status === "Archived")
    .map((product) => ({
      id: product.id || "Product",
      title: product.name || "Unnamed product",
      detail: categoryNames.get(product.categoryId) || "Uncategorized",
      date: recordDate(product, ["archivedAt", "dateArchived", "updatedAt"], 7),
      raw: product,
    }));
}

function loadArchivedCategories(catalog) {
  return catalog.categories
    .filter((category) => category?.status === "Archived")
    .map((category) => ({
      id: category.id || "Category",
      title: category.name || "Unnamed category",
      date: recordDate(category, ["archivedAt", "dateArchived", "updatedAt"]),
      raw: category,
    }));
}

function loadSuppliers() {
  return readStoredValue(ARCHIVE_KEYS.suppliers, [], "supplier")
    .filter((supplier) => {
      const status = Array.isArray(supplier) ? supplier[6] : supplier?.status;
      return String(status || "").toLowerCase() === "inactive" ||
        String(status || "").toLowerCase() === "archived";
    })
    .map((supplier) => {
      const arrayRecord = Array.isArray(supplier);
      return {
        id: arrayRecord ? supplier[0] : supplier.id || supplier.supplierId,
        title: arrayRecord ? supplier[1] : supplier.name || supplier.company,
        detail: arrayRecord
          ? [supplier[7], supplier[4], supplier[2]].filter(Boolean).join(" · ")
          : [supplier.contact, supplier.email, supplier.phone].filter(Boolean).join(" · "),
        date: recordDate(supplier, ["archivedAt", "dateArchived", "updatedAt"], 8),
        raw: supplier,
      };
    });
}

function orderDate(order) {
  return (
    order.clearedAt ||
    order.completedAt ||
    order.deliveredAt ||
    order.updatedAt ||
    order.createdAt ||
    order.receivedAt ||
    ""
  );
}

function getOrderType(order) {
  const reference = String(order.reference || order.orderId || "");
  const items = Array.isArray(order.items) ? order.items : [];
  const quantity = items.reduce(
    (total, item) => total + Math.max(0, Number(item?.quantity) || 0),
    0,
  );
  if (/ORD-BLK|BULK/i.test(reference) || quantity > 50) return "Bulk";
  if (
    items.some(
      (item) =>
        String(item?.size || "").toLowerCase() === "custom" ||
        (item?.customMeasurements && typeof item.customMeasurements === "object"),
    )
  ) {
    return "Custom";
  }
  return "RTW";
}

function loadAgedOrders() {
  const cutoff = Date.now() - AGED_ORDER_DAYS * 24 * 60 * 60 * 1000;
  return readStoredValue(ARCHIVE_KEYS.orders, [], "order")
    .filter((order) => {
      const status = String(order.status || "").toLowerCase();
      const dateValue = orderDate(order);
      const date = dateValue ? new Date(dateValue) : null;
      return (
        /^(completed|delivered|released|shipped)$/.test(status) &&
        date &&
        !Number.isNaN(date.getTime()) &&
        date.getTime() < cutoff
      );
    })
    .map((order) => ({
      id: order.reference || order.orderId || "Order",
      title: order.customer?.name || order.customerName || "Customer unavailable",
      detail: getOrderType(order),
      date: orderDate(order),
      raw: order,
    }));
}

function getArchiveData() {
  if (selectedArchiveType === "disabled") return loadDisabledAccounts();
  if (selectedArchiveType === "staffAccounts") return loadArchivedStaffAccounts();
  if (selectedArchiveType === "customerAccounts") return loadArchivedCustomerAccounts();
  if (selectedArchiveType === "products") return loadProducts(readCatalog());
  if (selectedArchiveType === "suppliers") return loadSuppliers();
  if (selectedArchiveType === "system") {
    return window.systemArchive.getAll().map((entry) => ({
      id: entry.recordId,
      title: entry.label,
      detail: entry.detail,
      date: entry.archivedAt,
      raw: entry,
    }));
  }
  return loadAgedOrders();
}

function rowMatchesSearch(row, query) {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    !normalizedQuery ||
    [row.id, row.title, row.detail, row.date]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

function actionForRow() {
  return selectedArchiveType === "orders" ? "View" : "Restore";
}

function renderArchive() {
  const error = document.getElementById("archive-error");
  const head = document.getElementById("archive-table-head");
  const body = document.getElementById("archive-table-body");
  const search = document.getElementById("archive-search-input").value;
  const empty = document.getElementById("archive-empty");
  const count = document.getElementById("archive-count");
  const tabLabel = document.querySelector(
    `[data-archive-type="${selectedArchiveType}"]`,
  ).textContent.trim();
  error.hidden = true;
  const categorySection = document.getElementById("archived-categories-section");
  categorySection.hidden = selectedArchiveType !== "products";

  try {
    archiveRows = getArchiveData();
    const filteredRows = archiveRows.filter((row) =>
      rowMatchesSearch(row, search),
    );
    head.innerHTML = `<tr>${ARCHIVE_COLUMNS[selectedArchiveType]
      .map((column) => `<th scope="col">${escapeHtml(column)}</th>`)
      .join("")}</tr>`;
    body.innerHTML = filteredRows
      .map(
        (row, index) => `
          <tr>
            <td class="archive-id">${escapeHtml(row.id)}</td>
            <td>
              <strong>${escapeHtml(row.title)}</strong>
              <span class="archive-detail">${escapeHtml(row.detail)}</span>
            </td>
            <td>${escapeHtml(displayDate(row.date))}</td>
            <td>
              <button
                class="archive-action"
                type="button"
                data-archive-action="${actionForRow().toLowerCase()}"
                data-row-index="${index}"
                aria-label="${actionForRow()} ${escapeHtml(row.id)}"
              >${actionForRow()}</button>
            </td>
          </tr>`,
      )
      .join("");
    const label = ARCHIVE_LABELS[selectedArchiveType];
    count.textContent = `${filteredRows.length} ${label}${filteredRows.length === 1 ? "" : "s"}`;
    empty.textContent = search
      ? "No archived records match your search."
      : selectedArchiveType === "orders"
        ? "No aged orders found."
        : `No archived ${label} records.`;
    empty.hidden = filteredRows.length > 0;
    if (selectedArchiveType === "products") {
      archivedCategoryRows = loadArchivedCategories(readCatalog());
      const filteredCategories = archivedCategoryRows.filter((row) =>
        rowMatchesSearch(row, search),
      );
      const categoryBody = document.getElementById("archived-categories-body");
      const categoryCount = document.getElementById("archived-categories-count");
      const categoryEmpty = document.getElementById("archived-categories-empty");
      categoryBody.innerHTML = filteredCategories
        .map(
          (row, index) => `
            <tr>
              <td class="archive-id">${escapeHtml(row.id)}</td>
              <td><strong>${escapeHtml(row.title)}</strong></td>
              <td>${escapeHtml(displayDate(row.date))}</td>
              <td>
                <button
                  class="archive-action"
                  type="button"
                  data-restore-category="${index}"
                  aria-label="Restore category ${escapeHtml(row.id)}"
                >Restore</button>
              </td>
            </tr>`,
        )
        .join("");
      categoryCount.textContent = `${filteredCategories.length} archived categor${filteredCategories.length === 1 ? "y" : "ies"}`;
      categoryEmpty.textContent = search
        ? "No archived categories match your search."
        : "No archived product categories.";
      categoryEmpty.hidden = filteredCategories.length > 0;
    } else {
      archivedCategoryRows = [];
      document.getElementById("archived-categories-body").replaceChildren();
    }
  } catch (caughtError) {
    console.error("Could not load archived records.", caughtError);
    body.replaceChildren();
    document.getElementById("archived-categories-body").replaceChildren();
    archivedCategoryRows = [];
    count.textContent = "Archive data unavailable";
    empty.hidden = true;
    error.textContent =
      caughtError instanceof Error
        ? caughtError.message
        : "Archive data could not be loaded.";
    error.hidden = false;
  }
}

function restoreAccount(row) {
  const accounts = readStoredValue(row.storageKey, [], "account");
  const target = accounts.find((account) => {
    const id =
      account.employeeId ||
      account.accountId ||
      account.id ||
      account.customerId ||
      account.email;
    return String(id) === String(row.id);
  });
  if (!target) throw new Error("The archived account is no longer available.");
  if ("status" in target) target.status = "Active";
  if ("accountStatus" in target) target.accountStatus = "Active";
  if ("isActive" in target) target.isActive = true;
  if ("active" in target) target.active = true;
  target.disabledByAdmin = false;
  target.adminDisabled = false;
  target.disabledBy = null;
  target.deactivatedBy = null;
  target.disabledAt = null;
  window.backendMemoryStorage.setItem(row.storageKey, JSON.stringify(accounts));
}

function restoreProduct(row) {
  const catalog = readCatalog();
  const product = catalog.products.find(
    (entry) => String(entry.id) === String(row.id),
  );
  if (!product) throw new Error("The archived product is no longer available.");
  product.status = "Active";
  catalog.auditTrail = window.arrayWithPrepended(catalog.auditTrail, {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: "Restored product",
    entity: "Product",
    details: product.name || row.id,
    timestamp: new Date().toISOString(),
  });
  catalog.auditTrail = catalog.auditTrail.slice(0, 100);
  window.backendMemoryStorage.setItem(ARCHIVE_KEYS.catalog, JSON.stringify(catalog));
}

function restoreCategory(row) {
  const catalog = readCatalog();
  const category = catalog.categories.find(
    (entry) => String(entry.id) === String(row.id),
  );
  if (!category) throw new Error("The archived category is no longer available.");
  category.status = "Active";
  delete category.archivedAt;
  delete category.dateArchived;
  catalog.auditTrail = window.arrayWithPrepended(catalog.auditTrail, {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: "Restored category",
    entity: "Category",
    details: category.name || row.id,
    timestamp: new Date().toISOString(),
  });
  catalog.auditTrail = catalog.auditTrail.slice(0, 100);
  window.backendMemoryStorage.setItem(ARCHIVE_KEYS.catalog, JSON.stringify(catalog));
}

function restoreSupplier(row) {
  const suppliers = readStoredValue(ARCHIVE_KEYS.suppliers, [], "supplier");
  const supplier = suppliers.find((entry) =>
    String(Array.isArray(entry) ? entry[0] : entry.id || entry.supplierId) ===
    String(row.id),
  );
  if (!supplier) throw new Error("The archived supplier is no longer available.");
  if (Array.isArray(supplier)) supplier[6] = "Active";
  else supplier.status = "Active";
  window.backendMemoryStorage.setItem(ARCHIVE_KEYS.suppliers, JSON.stringify(suppliers));
}

function showOrderDetails(row) {
  const order = row.raw;
  const details = document.getElementById("archive-detail-body");
  const items = Array.isArray(order.items) ? order.items : [];
  const detailRows = [
    ["Order ID", row.id],
    ["Customer", row.title],
    ["Order type", row.detail],
    ["Status", order.status || "—"],
    ["Date cleared", displayDate(row.date)],
    ["Total", order.total == null ? "—" : `PHP ${Number(order.total).toLocaleString("en-PH")}`],
  ];
  details.innerHTML = `
    <dl>${detailRows
      .map(
        ([label, value]) =>
          `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
      )
      .join("")}</dl>
    <h3>Items</h3>
    <ul>${items
      .map(
        (item) =>
          `<li>${escapeHtml(item?.name || item?.productName || "Item")} · ${escapeHtml(item?.size || "—")} · Qty ${escapeHtml(item?.quantity ?? 1)}</li>`,
      )
      .join("") || "<li>No item details available.</li>"}</ul>`;
  document.getElementById("archive-detail-dialog").showModal();
}

document.querySelectorAll(".archive-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    selectedArchiveType = tab.dataset.archiveType;
    document.querySelectorAll(".archive-tab").forEach((candidate) => {
      const active = candidate === tab;
      candidate.classList.toggle("active", active);
      candidate.setAttribute("aria-selected", String(active));
    });
    document.getElementById("archive-search-input").value = "";
    renderArchive();
  });
});

document.getElementById("archive-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  renderArchive();
});
document
  .getElementById("archive-search-input")
  .addEventListener("input", renderArchive);
document
  .getElementById("archive-table-body")
  .addEventListener("click", (event) => {
    const button = event.target.closest("[data-archive-action]");
    if (!button) return;
    const row = archiveRows.filter((entry) =>
      rowMatchesSearch(entry, document.getElementById("archive-search-input").value),
    )[Number(button.dataset.rowIndex)];
    if (!row) return;
    if (button.dataset.archiveAction === "view") {
      showOrderDetails(row);
      return;
    }
    try {
      if (
        ["disabled", "staffAccounts", "customerAccounts"].includes(
          selectedArchiveType,
        )
      ) {
        restoreAccount(row);
      }
      if (selectedArchiveType === "products") restoreProduct(row);
      if (selectedArchiveType === "suppliers") restoreSupplier(row);
      if (selectedArchiveType === "system") {
        window.systemArchive.restore(row.raw.id);
      }
      renderArchive();
    } catch (caughtError) {
      console.error("Could not restore archived record.", caughtError);
      const error = document.getElementById("archive-error");
      error.textContent =
        caughtError instanceof Error
          ? caughtError.message
          : "The archived record could not be restored.";
      error.hidden = false;
    }
  });
document
  .getElementById("archived-categories-body")
  .addEventListener("click", (event) => {
    const button = event.target.closest("[data-restore-category]");
    if (!button) return;
    const filteredCategories = archivedCategoryRows.filter((entry) =>
      rowMatchesSearch(entry, document.getElementById("archive-search-input").value),
    );
    const row = filteredCategories[Number(button.dataset.restoreCategory)];
    if (!row) return;
    try {
      restoreCategory(row);
      renderArchive();
    } catch (caughtError) {
      console.error("Could not restore archived category.", caughtError);
      const error = document.getElementById("archive-error");
      error.textContent =
        caughtError instanceof Error
          ? caughtError.message
          : "The archived category could not be restored.";
      error.hidden = false;
    }
  });
document.getElementById("close-archive-detail").addEventListener("click", () => {
  document.getElementById("archive-detail-dialog").close();
});
window.addEventListener("storage", (event) => {
  if (
    event.key === null ||
    Object.values(ARCHIVE_KEYS).includes(event.key) ||
    event.key === "jorjetteangel-system-archive"
  ) {
    renderArchive();
  }
});
window.addEventListener("systemArchiveChanged", renderArchive);

renderArchive();
