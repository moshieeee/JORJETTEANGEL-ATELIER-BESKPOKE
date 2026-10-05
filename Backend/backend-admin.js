// Manages the admin dashboard and product catalog.

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


function readState() {
  const saved = window.backendMemoryStorage.getItem(ADMIN_STORAGE_KEY);
  if (!saved) {
    const initialState = structuredClone(defaultState);
    window.backendMemoryStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }
  const savedState = JSON.parse(saved);
  if (savedState.catalogVersion !== defaultState.catalogVersion) {
    const initialState = structuredClone(defaultState);
    window.backendMemoryStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(initialState));
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


function saveState(state) {
  state.products = state.products.map(normalizeProductImages);
  window.backendMemoryStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
}


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
      productImagesDraft = window.arrayWithoutRange(productImagesDraft, index);
      renderProductImagePreviews();
    });
    preview.append(image, removeButton);
    previews.append(preview);
  });
}


function addAuditEntry(state, action, entity, details) {
  state.auditTrail = window.arrayWithPrepended(state.auditTrail, {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    entity,
    details,
    timestamp: new Date().toISOString(),
  });
  state.auditTrail = state.auditTrail.slice(0, 100);
}


function nextCategoryId(categories) {
  const categoryIdPattern = /^CAT-LST-(\d{4,})$/;
  let highestSequence = 0;

  categories.forEach((category) => {
    const match = categoryIdPattern.exec(category.id);
    if (!match) return;
    const sequence = Number(match[1]);
    if (Number.isSafeInteger(sequence)) {
      highestSequence = Math.max(highestSequence, sequence);
    }
  });

  return `CAT-LST-${String(highestSequence + 1).padStart(4, "0")}`;
}

function nextProductId(products) {
  const productIdPattern = /^PROD-LST-(\d{4,})$/;
  let highestSequence = 0;

  products.forEach((product) => {
    const match = productIdPattern.exec(product.id);
    if (!match) return;
    const sequence = Number(match[1]);
    if (Number.isSafeInteger(sequence)) {
      highestSequence = Math.max(highestSequence, sequence);
    }
  });

  return `PROD-LST-${String(highestSequence + 1).padStart(4, "0")}`;
}


function formatPrice(price) {
  return price
    ? `PHP ${Number(price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : "By consultation";
}


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


function formatAuditTime(timestamp) {
  return new Date(timestamp).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}


function renderAuditTrail(state) {
  const auditList = document.getElementById("audit-list");
  if (!auditList) return;
  const actionLabels = {
    "Added product": "Add catalog",
    "Updated product": "Update catalog",
    "Archived product": "Archive catalog",
    "Restored product": "Restore catalog",
    "Added category": "Add category",
    "Updated category": "Update category",
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


function renderDashboard(state) {
  const productCount = document.getElementById("product-count");
  const categoryCount = document.getElementById("category-count");
  const activeCount = document.getElementById("active-count");
  if (productCount) productCount.textContent = state.products.length;
  if (categoryCount) categoryCount.textContent = state.categories.length;
  if (activeCount) {
    activeCount.textContent = state.products.filter(
      (product) => product.status === "Active",
    ).length;
  }
}

function renderCategories(state) {
  const categoryList = document.getElementById("category-list");
  if (!categoryList) return;
  categoryList.replaceChildren();
  if (!state.categories.length) {
    const row = document.createElement("tr");
    const empty = document.createElement("td");
    empty.colSpan = 4;
    empty.textContent = "No product categories have been created.";
    row.append(empty);
    categoryList.append(row);
    return;
  }

  state.categories.forEach((category) => {
    const row = document.createElement("tr");
    const id = document.createElement("td");
    id.textContent = category.id;
    const name = document.createElement("td");
    name.textContent = category.name;
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "status";
    status.textContent = category.status;
    statusCell.append(status);
    const actions = document.createElement("td");
    const buttonRow = document.createElement("span");
    buttonRow.className = "button-row";
    const editButton = document.createElement("button");
    editButton.className = "button button-secondary button-small";
    editButton.dataset.editCategory = category.id;
    editButton.type = "button";
    editButton.textContent = "Edit";
    const archiveButton = document.createElement("button");
    archiveButton.className = "button button-secondary button-small";
    archiveButton.dataset.archiveCategory = category.id;
    archiveButton.type = "button";
    archiveButton.textContent =
      category.status === "Archived" ? "Restore" : "Archive";
    buttonRow.append(editButton, archiveButton);
    actions.append(buttonRow);
    row.append(id, name, statusCell, actions);
    categoryList.append(row);
  });
}

function readDashboardArray(key, description) {
  const saved = window.backendMemoryStorage.getItem(key);
  const value = saved ? JSON.parse(saved) : [];
  if (!Array.isArray(value)) {
    throw new Error(`Saved ${description} must be an array.`);
  }
  return value.filter((item) => item && typeof item === "object");
}

function formatDashboardAmount(amount) {
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatReportTimestamp(timestamp) {
  const date = new Date(timestamp || "");
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function appendReportEmpty(container, message) {
  const empty = document.createElement(
    container.tagName === "UL" ? "li" : "p",
  );
  empty.className = "report-empty";
  empty.textContent = message;
  container.replaceChildren(empty);
}

function appendReportSummary(container, rows, emptyMessage) {
  container.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "report-empty";
    empty.textContent = emptyMessage;
    container.append(empty);
    return;
  }

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "report-summary-row";
    const name = document.createElement("span");
    name.textContent = label;
    const count = document.createElement("strong");
    count.textContent = value;
    row.append(name, count);
    container.append(row);
  });
}

function renderReportSalesChart(orders, hasError) {
  const chart = document.getElementById("report-sales-chart");
  if (!chart) return;
  chart.replaceChildren();
  if (hasError) {
    chart.setAttribute("aria-label", "Order totals could not be loaded");
    appendReportEmpty(chart, "Order totals could not be loaded.");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date, key, total: 0 };
  });
  const totalsByDay = new Map(days.map((day) => [day.key, day]));

  orders.forEach((order) => {
    const date = new Date(order.createdAt || "");
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const day = totalsByDay.get(key);
    if (day) {
      const total = Number(order.total);
      if (Number.isFinite(total) && total > 0) day.total += total;
    }
  });

  const maximum = Math.max(...days.map((day) => day.total), 0);
  chart.setAttribute(
    "aria-label",
    days
      .map(
        (day) =>
          `${day.date.toLocaleDateString("en-PH", { weekday: "long" })}: ${formatDashboardAmount(day.total)}`,
      )
      .join("; "),
  );
  days.forEach((day) => {
    const group = document.createElement("div");
    group.className = "report-bar-group";
    const amount = document.createElement("span");
    amount.className = "report-chart-amount";
    amount.textContent = formatDashboardAmount(day.total);
    const meter = document.createElement("div");
    meter.className = "report-bar-track";
    const bar = document.createElement("span");
    bar.className = "report-bar";
    bar.style.height =
      maximum > 0 && day.total > 0
        ? `${Math.max(4, (day.total / maximum) * 100)}%`
        : "0%";
    meter.append(bar);
    const label = document.createElement("span");
    label.className = "report-chart-label";
    label.textContent = day.date.toLocaleDateString("en-PH", {
      weekday: "short",
    });
    group.append(amount, meter, label);
    chart.append(group);
  });
}

function renderReportAlerts(orders, hasError) {
  const list = document.getElementById("report-alert-list");
  if (!list) return;
  let alerts = [];
  try {
    const savedAlerts = window.backendMemoryStorage.getItem("jorjetteangel-admin-alerts");
    alerts = savedAlerts === null ? [] : JSON.parse(savedAlerts);
    if (!Array.isArray(alerts)) {
      throw new Error("Saved dashboard alerts must be an array.");
    }
  } catch (error) {
    console.error("Could not load dashboard alerts.", error);
    appendReportEmpty(list, "Dashboard alerts could not be loaded.");
    return;
  }

  const criticalAlerts = alerts
    .filter(
      (alert) =>
        alert &&
        alert.severity === "CRITICAL" &&
        alert.acknowledged !== true,
    );

  criticalAlerts.forEach((alert) => {
    const item = document.createElement("li");
    item.className = "report-alert-item report-alert-critical";
    const dot = document.createElement("span");
    dot.className = "report-alert-dot report-alert-dot-critical";
    dot.setAttribute("aria-hidden", "true");
    const content = document.createElement("div");
    content.className = "report-alert-copy";
    const title = document.createElement("strong");
    title.textContent = `${alert.title || "Critical inventory alert"} · CRITICAL`;
    const detail = document.createElement("small");
    detail.textContent = String(alert.message || "Review the inventory shortage.");
    const time = document.createElement("time");
    time.textContent = formatReportTimestamp(alert.timestamp);
    content.append(title, detail, time);
    item.append(dot, content);
    list.append(item);
  });

  if (hasError) {
    appendReportEmpty(list, "Order notifications could not be loaded.");
    return;
  }
  const recentOrders = window.manualSortArray(
    [...orders],
    (first, second) =>
      new Date(second.createdAt || 0).getTime() -
      new Date(first.createdAt || 0).getTime(),
  ).slice(0, Math.max(0, 4 - criticalAlerts.length));
  if (!recentOrders.length) {
    if (!criticalAlerts.length) {
      appendReportEmpty(list, "No new order notifications.");
    }
    return;
  }

  const items = recentOrders.map((order) => {
    const item = document.createElement("li");
    item.className = "report-alert-item";
    const dot = document.createElement("span");
    dot.className = "report-alert-dot";
    dot.setAttribute("aria-hidden", "true");
    const content = document.createElement("div");
    content.className = "report-alert-copy";
    const title = document.createElement("strong");
    title.textContent = `Order ${order.reference || "received"}`;
    const status =
      typeof order.status === "string" && order.status.trim()
        ? order.status
        : "Received";
    const customer =
      typeof order.customer?.name === "string" && order.customer.name.trim()
        ? order.customer.name
        : "Customer details unavailable";
    const detail = document.createElement("small");
    detail.textContent = `${customer} · ${status}`;
    const time = document.createElement("time");
    time.textContent = formatReportTimestamp(order.createdAt);
    content.append(title, detail, time);
    item.append(dot, content);
    return item;
  });
  list.replaceChildren(...items);
}

function renderReportOrderStatus(orders, hasError) {
  const list = document.getElementById("report-order-status");
  if (!list) return;
  list.replaceChildren();
  if (hasError) {
    const empty = document.createElement("p");
    empty.className = "report-empty";
    empty.textContent = "Order statuses could not be loaded.";
    list.append(empty);
    return;
  }
  if (!orders.length) {
    const empty = document.createElement("p");
    empty.className = "report-empty";
    empty.textContent = "Order status summaries will appear here.";
    list.append(empty);
    return;
  }

  const statusCounts = new Map();
  orders.forEach((order) => {
    const status =
      typeof order.status === "string" && order.status.trim()
        ? order.status.trim()
        : "Received";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });
  [...statusCounts.entries()].forEach(([status, count]) => {
    const row = document.createElement("div");
    row.className = "report-status-row";
    const info = document.createElement("div");
    info.className = "report-status-info";
    const label = document.createElement("span");
    label.className = "report-status-label";
    label.textContent = status;
    const number = document.createElement("strong");
    number.className = "report-status-count";
    number.textContent = `${count} order${count === 1 ? "" : "s"}`;
    info.append(label, number);
    const meter = document.createElement("div");
    meter.className = "report-meter";
    const fill = document.createElement("span");
    fill.className = "report-meter-fill";
    fill.style.width = `${(count / orders.length) * 100}%`;
    meter.append(fill);
    row.append(info, meter);
    list.append(row);
  });
}

function renderReportActivity(state, orders, hasOrderError) {
  const list = document.getElementById("report-activity-list");
  if (!list) return;
  let entries = state.auditTrail
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.timestamp === "string",
    )
    .map((entry) => ({
      timestamp: entry.timestamp,
      text: `Catalog ${entry.action || "updated"}: ${entry.details || "Details unavailable"}`,
      type: "catalog",
    }));
  if (!hasOrderError) {
    orders.forEach((order) => {
      if (typeof order.createdAt !== "string") return;
      entries = window.arrayWithAppended(entries, {
        timestamp: order.createdAt,
        text: `Order received: ${order.reference || "Reference unavailable"}`,
        type: "order",
      });
    });
  }
  const recentEntries = window.manualSortArray(
    entries,
    (first, second) =>
      new Date(second.timestamp).getTime() -
      new Date(first.timestamp).getTime(),
  ).slice(0, 5);
  if (!recentEntries.length) {
    appendReportEmpty(
      list,
      hasOrderError
        ? "No catalog updates are available."
        : "Recent store activity will appear here.",
    );
    return;
  }

  const items = recentEntries.map((entry) => {
    const item = document.createElement("li");
    item.className = "report-activity-item";
    const time = document.createElement("time");
    time.textContent = formatReportTimestamp(entry.timestamp);
    const text = document.createElement("span");
    text.className = "report-activity-text";
    text.textContent = entry.text;
    const type = document.createElement("span");
    type.className = `report-activity-type ${entry.type}`;
    type.textContent = entry.type;
    item.append(time, text, type);
    return item;
  });
  list.replaceChildren(...items);
}

function renderReportSummaries(state, profiles, hasProfileError, orders, hasOrderError) {
  const catalogRows = [
    [
      "Active listings",
      state.products.filter((product) => product.status === "Active").length,
    ],
    [
      "Archived listings",
      state.products.filter((product) => product.status === "Archived").length,
    ],
    ["Categories", state.categories.length],
  ];
  appendReportSummary(
    document.getElementById("report-catalog-summary"),
    catalogRows,
    "Catalog details are not available.",
  );

  const preferenceLabels = {
    rtw: "Ready-to-Wear Items",
    bespoke: "Bespoke Tailoring",
    corporate: "Bulk Order",
  };
  const preferences = new Map();
  if (!hasProfileError) {
    profiles.forEach((profile) => {
      const preference =
        typeof profile.preference === "string" && profile.preference.trim()
          ? preferenceLabels[profile.preference] || profile.preference
          : "Not specified";
      preferences.set(preference, (preferences.get(preference) || 0) + 1);
    });
  }
  appendReportSummary(
    document.getElementById("report-preference-summary"),
    hasProfileError
      ? []
      : window.manualSortArray(
          [...preferences.entries()],
          (first, second) => second[1] - first[1],
        )
          .slice(0, 4),
    hasProfileError
      ? "Customer preferences could not be loaded."
      : "Customer preference details will appear here.",
  );

  const paymentMethods = new Map();
  if (!hasOrderError) {
    orders.forEach((order) => {
      const method =
        typeof order.paymentMethod === "string" && order.paymentMethod.trim()
          ? order.paymentMethod.trim()
          : "Not specified";
      paymentMethods.set(method, (paymentMethods.get(method) || 0) + 1);
    });
  }
  appendReportSummary(
    document.getElementById("report-payment-summary"),
    hasOrderError
      ? []
      : window.manualSortArray(
          [...paymentMethods.entries()],
          (first, second) => second[1] - first[1],
        )
          .slice(0, 4),
    hasOrderError
      ? "Payment method details could not be loaded."
      : "Payment method details will appear here.",
  );
}

function renderReportDashboard(state) {
  if (!document.getElementById("report-kpi-grid")) return;

  let orders = [];
  let hasOrderError = false;
  try {
    orders = readDashboardArray(CUSTOMER_ORDERS_STORAGE_KEY, "customer orders");
  } catch (error) {
    console.error("Could not load dashboard order reports.", error);
    hasOrderError = true;
  }

  let profiles = [];
  let hasProfileError = false;
  try {
    profiles = readDashboardArray(
      CLIENT_PROFILE_STORAGE_KEY,
      "client profiles",
    );
  } catch (error) {
    console.error("Could not load dashboard customer reports.", error);
    hasProfileError = true;
  }

  const orderValue = orders.reduce((total, order) => {
    const amount = Number(order.total);
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
  const closedStatus = /^(completed|delivered|cancelled|canceled)$/i;
  const openOrders = orders.filter(
    (order) =>
      !closedStatus.test(
        typeof order.status === "string" ? order.status.trim() : "",
      ),
  ).length;
  document.getElementById("report-order-value").textContent = hasOrderError
    ? "Unavailable"
    : formatDashboardAmount(orderValue);
  document.getElementById("report-open-orders").textContent = hasOrderError
    ? "Unavailable"
    : openOrders;
  document.getElementById("report-active-listings").textContent =
    state.products.filter((product) => product.status === "Active").length;
  document.getElementById("report-customer-count").textContent =
    hasProfileError ? "Unavailable" : profiles.length;

  renderReportSalesChart(orders, hasOrderError);
  renderReportAlerts(orders, hasOrderError);
  renderReportOrderStatus(orders, hasOrderError);
  renderReportSummaries(
    state,
    profiles,
    hasProfileError,
    orders,
    hasOrderError,
  );
}


function renderCustomerAccounts() {
  const accountsBody = document.getElementById("customer-accounts-body");
  const customerCount = document.getElementById("customer-count");
  if (!accountsBody) return;

  try {
    const savedProfiles = window.backendMemoryStorage.getItem(CLIENT_PROFILE_STORAGE_KEY);
    const profiles = savedProfiles ? JSON.parse(savedProfiles) : [];
    if (!Array.isArray(profiles)) {
      throw new Error("Saved client profiles must be an array.");
    }

    if (customerCount) customerCount.textContent = profiles.length;
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
    if (customerCount) customerCount.textContent = "—";
    const errorCell = document.createElement("td");
    errorCell.colSpan = 4;
    errorCell.textContent = "Unable to load customer accounts.";
    const errorRow = document.createElement("tr");
    errorRow.append(errorCell);
    accountsBody.replaceChildren(errorRow);
  }
}


let selectedOrderType = "rtw";
let incomingOrderRecords = [];

function getOrderType(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const declaredType = String(
    order.orderType || order.type || order.category || "",
  ).toLowerCase();
  const bulkQuantity = items.reduce(
    (total, item) => total + Math.max(0, Number(item?.quantity) || 0),
    0,
  );
  if (
    String(order.reference || order.orderId || "").startsWith("ORD-BLK-") ||
    declaredType.includes("bulk") ||
    declaredType.includes("corporate") ||
    order.isBulkOrder === true ||
    bulkQuantity > 50 ||
    items.some((item) =>
      String(item?.orderType || item?.type || item?.category || "")
        .toLowerCase()
        .match(/bulk|corporate/),
    )
  ) {
    return "bulk";
  }
  if (declaredType.match(/custom|bespoke/)) return "custom";
  if (
    items.some(
      (item) =>
        String(item?.size || "").toLowerCase() === "custom" ||
        (item?.customMeasurements &&
          typeof item.customMeasurements === "object" &&
          !Array.isArray(item.customMeasurements)),
    )
  ) {
    return "custom";
  }
  return "rtw";
}

function isOpenCustomerOrder(order) {
  return !/^(completed|delivered|cancelled|canceled)$/i.test(
    typeof order.status === "string" ? order.status.trim() : "",
  );
}

function getOrderProductionStatus(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) {
    return typeof order.status === "string" && order.status.trim()
      ? order.status.trim()
      : "Received";
  }

  const statuses = items.map((item) =>
    String(
      item?.productionStatus ||
        item?.productionStage ||
        order.productionStatus ||
        order.status ||
        "Received",
    ).trim(),
  );
  const distinctStatuses = [...new Set(statuses)];
  return distinctStatuses.length > 1
    ? "Mixed production statuses"
    : distinctStatuses[0];
}

function getOrderTransactionId(order) {
  return [
    order.transactionId,
    order.paymentTransactionId,
    order.linkedTransactionId,
    order.txnId,
  ].find((value) => typeof value === "string" && value.trim()) || "";
}

function getOrderAmountPaid(order) {
  return Number(
    order.amountReceived ?? order.amountPaid ?? order.paidAmount ?? 0,
  );
}

function getCustomPaymentLabel(order) {
  const total = Number(order.total) || 0;
  const paid = getOrderAmountPaid(order);
  if (total > 0 && paid >= total) return "FULL PAID";
  if (paid > 0 && total > 0) {
    return `${Math.round((paid / total) * 100)}% DWN`;
  }
  return "PENDING";
}

function renderOrderCounts(orders) {
  const openOrders = orders.filter(isOpenCustomerOrder);
  document.getElementById("pending-rtw-count").textContent = openOrders.filter(
    (order) => getOrderType(order) === "rtw",
  ).length;
  document.getElementById("pending-custom-count").textContent = openOrders.filter(
    (order) => getOrderType(order) === "custom",
  ).length;
  document.getElementById("bulk-order-count").textContent = openOrders.filter(
    (order) => getOrderType(order) === "bulk",
  ).length;
}

function makeOrderCell(text, className) {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.classList.add(className);
  return cell;
}

function renderFilteredIncomingOrders() {
  const ordersBody = document.getElementById("incoming-orders-body");
  const searchInput = document.getElementById("orders-search");
  if (!ordersBody || !searchInput) return;

  const searchTerm = searchInput.value.trim().toLocaleLowerCase();
  const visibleOrders = incomingOrderRecords.filter((order) => {
    if (getOrderType(order) !== selectedOrderType) return false;
    const searchableText = [
      order.reference,
      order.orderId,
      order.customer?.name,
      getOrderTransactionId(order),
      ...(Array.isArray(order.orderIds) ? order.orderIds : []),
      ...(Array.isArray(order.items)
        ? order.items.flatMap((item) => [
            item?.orderId,
            item?.productId,
            item?.sku,
            item?.name,
          ])
        : []),
    ]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLocaleLowerCase();
    return searchableText.includes(searchTerm);
  });

  document.getElementById("orders-items-heading").textContent =
    selectedOrderType === "custom"
      ? "Garment"
      : selectedOrderType === "bulk"
        ? "Bulk items"
        : "Items (SKU)";
  document.getElementById("orders-total-heading").textContent =
    selectedOrderType === "custom" ? "Payment" : "Total";
  document.getElementById("orders-status-heading").textContent =
    selectedOrderType === "custom" ? "Prod." : "Status";

  if (!visibleOrders.length) {
    const emptyCell = makeOrderCell(
      searchTerm
        ? "No orders match your search."
        : `No ${selectedOrderType === "rtw" ? "ready-to-wear" : selectedOrderType} orders yet.`,
    );
    emptyCell.colSpan = 5;
    const emptyRow = document.createElement("tr");
    emptyRow.append(emptyCell);
    emptyRow.classList.add("orders-empty-row");
    ordersBody.replaceChildren(emptyRow);
    return;
  }

  const rows = visibleOrders.map((order) => {
    const row = document.createElement("tr");
    const orderId = order.reference || order.orderId || "Order";
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "order-details-trigger";
    openButton.textContent = orderId;
    openButton.setAttribute("aria-label", `View details for order ${orderId}`);
    openButton.addEventListener("click", () => showOrderDetails(order));
    const orderCell = document.createElement("td");
    orderCell.append(openButton);

    const customerCell = makeOrderCell(
      order.customer?.name || order.customerName || "Customer unavailable",
    );
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsText = items
      .map((item) => {
        const sku = item?.sku || item?.productId || item?.orderId || "";
        const name = item?.name || item?.productName || "Item";
        const quantity = Math.max(1, Number(item?.quantity) || 1);
        return `${sku ? `${sku} · ` : ""}${name} × ${quantity}`;
      })
      .join(", ");
    const itemsCell = makeOrderCell(itemsText || "Items unavailable");
    itemsCell.classList.add("orders-items-cell");
    const isCustomOrder = selectedOrderType === "custom";
    const totalCell = makeOrderCell(
      isCustomOrder ? getCustomPaymentLabel(order) : formatPrice(Number(order.total) || 0),
    );
    totalCell.classList.add("orders-total-cell");
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    const productionStage =
      items[0]?.productionStatus || items[0]?.productionStage || "";
    status.className = `order-status-badge ${
      isCustomOrder
        ? productionStage
          ? "complete"
          : "pending"
        : isOpenCustomerOrder(order)
          ? "pending"
          : "complete"
    }`;
    status.textContent = getOrderProductionStatus(order);
    statusCell.append(status);
    row.append(orderCell, customerCell, itemsCell, totalCell, statusCell);
    row.addEventListener("click", (event) => {
      if (!event.target.closest("button")) showOrderDetails(order);
    });
    row.tabIndex = 0;
    row.addEventListener("keydown", (event) => {
      if (event.target !== row) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showOrderDetails(order);
      }
    });
    return row;
  });
  ordersBody.replaceChildren(...rows);
}

function appendOrderDetailSection(title, lines) {
  const section = document.createElement("section");
  section.className = "order-detail-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading);
  lines.forEach(([label, value]) => {
    if (!value) return;
    const line = document.createElement("p");
    const labelNode = document.createElement("strong");
    labelNode.textContent = `${label}: `;
    line.append(labelNode, document.createTextNode(value));
    section.append(line);
  });
  document.getElementById("order-detail-body").append(section);
}

function showOrderDetails(order) {
  const orderId = order.reference || order.orderId || "Order";
  document.getElementById("order-detail-title").textContent =
    `Order details: ${orderId}`;
  const detailBody = document.getElementById("order-detail-body");
  detailBody.replaceChildren();

  const customer = order.customer && typeof order.customer === "object"
    ? order.customer
    : {};
  const orderDate = new Date(order.createdAt || order.receivedAt || "");
  const dateText = Number.isNaN(orderDate.getTime())
    ? "Date unavailable"
    : orderDate.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  const paymentReceived = getOrderAmountPaid(order);
  const total = Number(order.total) || 0;
  const paymentStatus = getCustomPaymentLabel(order);
  const formattedPaid = `PHP ${paymentReceived.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;
  const formattedBalance = `PHP ${Math.max(0, total - paymentReceived).toLocaleString(
    "en-PH",
    { minimumFractionDigits: 2 },
  )}`;
  const transactionId = getOrderTransactionId(order);
  appendOrderDetailSection("Order", [
    ["Customer", customer.name || order.customerName || "Customer unavailable"],
    ["Order date", dateText],
    [
      "Target delivery",
      order.targetDeliveryDate ||
        order.expectedDeliveryDate ||
        order.deliveryDate ||
        "",
    ],
    ["Payment method", order.paymentMethod || "Cash on delivery"],
  ]);
  appendOrderDetailSection("Financial status", [
    ["Total", formatPrice(total)],
    ["Paid", formattedPaid],
    ["Balance", formattedBalance],
    ["Status", paymentStatus],
    ["Transaction", transactionId || "No linked transaction"],
  ]);

  const items = Array.isArray(order.items) ? order.items : [];
  let measurementLines = [];
  items.forEach((item) => {
    if (
      item?.customMeasurements &&
      typeof item.customMeasurements === "object" &&
      !Array.isArray(item.customMeasurements)
    ) {
      Object.entries(item.customMeasurements).forEach(([name, value]) => {
        measurementLines = window.arrayWithAppended(
          measurementLines,
          `${name}: ${value}`,
        );
      });
    }
  });
  if (measurementLines.length) {
    appendOrderDetailSection("Measurements", [
      [
        "Profile",
        order.measurementProfileId ||
          items[0]?.measurementProfileId ||
          items[0]?.measurementProfile ||
          "",
      ],
      ["Values", measurementLines.join(" · ")],
      ["Customer note", order.customerNote || order.deliveryAddress?.notes || ""],
    ]);
  }

  let productionRegistry = [];
  let productionUnavailable = false;
  try {
    const savedTickets = window.backendMemoryStorage.getItem("jorjetteangel-production-tickets");
    if (savedTickets) {
      productionRegistry = JSON.parse(savedTickets);
      if (!Array.isArray(productionRegistry)) {
        throw new Error("Saved production ticket registry must be an array.");
      }
    }
  } catch (error) {
    console.error("Could not load production tickets for this order.", error);
    productionUnavailable = true;
  }
  const firstItem = items[0];
  const ticket = productionRegistry.find(
    (entry) => entry?.orderKey === `${orderId}::0`,
  );
  const productionSection = document.createElement("section");
  productionSection.className = "order-detail-section";
  const productionHeading = document.createElement("h3");
  productionHeading.textContent = "Production status";
  productionSection.append(productionHeading);
  const ticketLine = document.createElement("p");
  const ticketLabel = document.createElement("strong");
  ticketLabel.textContent = "Linked ticket: ";
  ticketLine.append(
    ticketLabel,
    document.createTextNode(
      productionUnavailable ? "Production ticket data unavailable" : ticket?.ticketId || "Not assigned",
    ),
  );
  const stageLine = document.createElement("p");
  const stageLabel = document.createElement("strong");
  stageLabel.textContent = "Current stage: ";
  stageLine.append(
    stageLabel,
    document.createTextNode(
      firstItem?.productionStatus ||
        firstItem?.productionStage ||
        order.status ||
        "Received",
    ),
  );
  productionSection.append(ticketLine, stageLine);
  if (ticket?.ticketId) {
    const viewTicket = document.createElement("a");
    viewTicket.className = "order-production-link";
    viewTicket.href = "backend-e-commerce-admin.html?module=production";
    viewTicket.textContent = "View production tickets";
    productionSection.append(viewTicket);
  }
  detailBody.append(productionSection);
  document.getElementById("order-detail-overlay").hidden = false;
  document.getElementById("close-order-detail").focus();
}

function renderIncomingOrders() {
  const ordersBody = document.getElementById("incoming-orders-body");
  const ordersCount = document.getElementById("incoming-orders-count");
  if (!ordersBody || !ordersCount) return;

  try {
    const savedOrders = window.backendMemoryStorage.getItem(CUSTOMER_ORDERS_STORAGE_KEY);
    const orders = savedOrders ? JSON.parse(savedOrders) : [];
    if (!Array.isArray(orders)) {
      throw new Error("Saved customer orders must be an array.");
    }

    incomingOrderRecords = window.manualSortArray(
      orders.filter((order) => order && typeof order === "object"),
      (first, second) =>
        new Date(second.createdAt || 0).getTime() -
        new Date(first.createdAt || 0).getTime(),
    );
    ordersCount.textContent = `${incomingOrderRecords.length} order${incomingOrderRecords.length === 1 ? "" : "s"} received`;
    renderOrderCounts(incomingOrderRecords);
    renderFilteredIncomingOrders();
  } catch (error) {
    console.error("Could not load incoming customer orders.", error);
    ordersCount.textContent = "Orders could not be loaded";
    const errorCell = makeOrderCell("Unable to load incoming orders.");
    errorCell.colSpan = 5;
    const errorRow = document.createElement("tr");
    errorRow.append(errorCell);
    ordersBody.replaceChildren(errorRow);
  }
}


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
      <td>${product.id}</td>
      <td><strong>${product.name}</strong></td>
      <td>${product.categoryId || "Unassigned"}</td>
      <td><span class="badge">${categoryName(state, product.categoryId)}</span></td>
      <td>${formatPrice(product.price)}</td>
      <td><span class="status ${product.status === "Archived" ? "status-red" : "status-green"}">${product.status}</span></td>
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
    `<tr><td colspan="7">No products in this category.</td></tr>`;
}


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
        <td><span class="status status-red">${product.status}</span></td>
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
      <td><span class="status ${category.status === "Archived" ? "status-red" : "status-green"}">${category.status}</span></td>
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


function renderCustomAttributeRows() {
  const list = document.getElementById("custom-attribute-list");
  list.replaceChildren();
  customFieldsDraft.forEach(addCustomAttributeRow);
}


function openCustomSizingModal() {
  renderCustomAttributeRows();
  document.getElementById("custom-sizing-modal").classList.remove("hidden");
  document.getElementById("add-custom-attribute").focus();
}


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


function refreshProductCategoryOptions(state) {
  document.getElementById("product-category").innerHTML = state.categories
    .map(
      (category) => `<option value="${category.id}">${category.name}</option>`,
    )
    .join("");
}


function handleProductAction(state, event) {
  const editId = event.target.dataset.editProduct;
  const archiveId = event.target.dataset.archiveProduct;
  if (editId) fillProductForm(state, editId);
  if (!archiveId) return;

  Object.assign(state, readState());
  const productToChange = window.findArrayItem(
    state.products,
    archiveId,
    (product) => product.id,
  );
  if (!productToChange) return;
  if (
    productToChange.status !== "Archived" &&
    Array.isArray(productToChange.finishedGoodsStock) &&
    productToChange.finishedGoodsStock.some(
      (stockEntry) => stockEntry && Number(stockEntry[1]) > 0,
    )
  ) {
    alert(
      "This product cannot be archived while stock remains in Finished Goods Inventory.",
    );
    return;
  }

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
  delete category.archivedAt;
  delete category.dateArchived;
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
    renderReportDashboard(state);
  } else if (document.body.dataset.page === "categories") {
    renderCategories(state);
  } else if (document.body.dataset.page === "archived-catalog") {
    renderArchivedCatalog(state);
  } else if (document.body.dataset.page === "catalog") {
    renderCatalog(state);
  }
});

if (document.body.dataset.page === "dashboard") {
  renderDashboard(state);
  renderCustomerAccounts();
  renderAuditTrail(state);
  renderReportDashboard(state);
  const dashboardView = new URLSearchParams(window.location.search).get("view");
  if (
    dashboardView === "trends" ||
    dashboardView === "archive" ||
    dashboardView === "audit-trail"
  ) {
    const dashboardFrame = document.getElementById("dashboard-module-frame");
    const isArchiveView = dashboardView === "archive";
    const isAuditTrailView = dashboardView === "audit-trail";
    document.body.classList.add("dashboard-module-view");
    document.title = isArchiveView
      ? "Atelier Admin | Archive"
      : isAuditTrailView
        ? "Atelier Admin | Audit Trail"
        : "Atelier Admin | Trends & Analytics";
    dashboardFrame.title = isArchiveView
      ? "Archive"
      : isAuditTrailView
        ? "Audit Trail"
        : "Trends and Analytics";
    dashboardFrame.src = isArchiveView
      ? "../modules/modules-archive.html?embedded=1"
      : isAuditTrailView
        ? "../modules/modules-audit-trail.html?embedded=1"
        : "../modules/modules-trends-and-analytics.html?embedded=1";
    dashboardFrame.hidden = false;
  }
  window.addEventListener("storage", (event) => {
    if (event.key === CLIENT_PROFILE_STORAGE_KEY) {
      renderCustomerAccounts();
      renderReportDashboard(state);
    }
    if (event.key === CUSTOMER_ORDERS_STORAGE_KEY) {
      renderReportDashboard(state);
    }
    if (event.key === "jorjetteangel-admin-alerts") {
      renderReportDashboard(state);
    }
  });
}

if (document.body.dataset.page === "categories") {
  renderCategories(state);
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
      if (!previousCategory) return;
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
      const category = {
        id: nextCategoryId(state.categories),
        name,
        status: "Active",
      };
      state.categories = window.arrayWithAppended(state.categories, category);
      addAuditEntry(state, "Added category", "Category", name);
    }
    saveState(state);
    categoryForm.reset();
    categoryIdInput.value = "";
    categoryCancel.classList.add("hidden");
    renderCategories(state);
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
        if (archivedCategory.status === "Archived") {
          archivedCategory.archivedAt = new Date().toISOString();
        } else {
          delete archivedCategory.archivedAt;
          delete archivedCategory.dateArchived;
        }
        addAuditEntry(
          state,
          archivedCategory.status === "Archived"
            ? "Archived category"
            : "Restored category",
          "Category",
          archivedCategory.name,
        );
        saveState(state);
        renderCategories(state);
      }
    });
}

if (document.body.dataset.page === "orders") {
  renderIncomingOrders();
  document.querySelector(".order-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-order-type]");
    if (!tab) return;
    selectedOrderType = tab.dataset.orderType;
    document.querySelectorAll(".order-tab").forEach((orderTab) => {
      const isSelected = orderTab === tab;
      orderTab.classList.toggle("active", isSelected);
      orderTab.setAttribute("aria-selected", String(isSelected));
    });
    renderFilteredIncomingOrders();
  });
  document
    .getElementById("orders-search")
    .addEventListener("input", renderFilteredIncomingOrders);
  const orderDetailOverlay = document.getElementById("order-detail-overlay");
  const closeOrderDetails = () => {
    orderDetailOverlay.hidden = true;
  };
  document
    .getElementById("close-order-detail")
    .addEventListener("click", closeOrderDetails);
  orderDetailOverlay.addEventListener("click", (event) => {
    if (event.target === orderDetailOverlay) closeOrderDetails();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !orderDetailOverlay.hidden) {
      closeOrderDetails();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === CUSTOMER_ORDERS_STORAGE_KEY || event.key === null) {
      renderIncomingOrders();
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
    if (offerCustomSizing && !customFieldsDraft.length) {
      openCustomSizingModal();
      return;
    }
    const existingProduct = productId
      ? window.findArrayItem(state.products, productId, (item) => item.id)
      : null;
    const product = {
      ...(existingProduct || {}),
      id:
        productId ||
        nextProductId(state.products),
      name: document.getElementById("product-name").value.trim(),
      categoryId: document.getElementById("product-category").value,
      price: Number(document.getElementById("product-price").value) || 0,
      images: [...productImagesDraft],
      description: document.getElementById("product-description").value.trim(),
      sizeMode:
        offerCustomSizing
          ? "custom"
          : offerRegularSizing
            ? "standard"
            : "none",
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
