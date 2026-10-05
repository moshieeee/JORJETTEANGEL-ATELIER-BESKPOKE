// Manages purchase requests and restocking.

const purchaseOrderStorageKey = "jg-erp-purchase-orders-v2";
const supplierDirectoryStorageKey = "jg-erp-supplier-directory-v1";
const rawMaterialsStorageKey = "jg-erp-fabrics-materials-v1";
const purchaseRequestsStorageKey = "jg-erp-purchase-restock-requests-v1";
const supplierField = {
  id: 0,
  name: 1,
  phone: 2,
  address: 3,
  email: 4,
  materials: 5,
  status: 6,
  contact: 7,
};
const orderField = {
  id: 0,
  supplierId: 1,
  supplierName: 2,
  date: 3,
  total: 4,
  status: 5,
  items: 6,
  deliveryDate: 7,
  requestedBy: 8,
  receiptName: 9,
  discrepancy: 10,
};

const starterSuppliers = [
  [
    "SUP-VND-001",
    "Manila Silk Traders",
    "09175550101",
    "145 Divisoria St, Manila",
    "maria@mst.com",
    "Piña, Jusi",
    "Active",
    "Maria Santos",
  ],
  [
    "SUP-VND-002",
    "Lumban Embroidery",
    "09175550102",
    "Lumban, Laguna",
    "jose@lumban.ph",
    "Jusi, Thread",
    "Active",
    "Jose Dela Cruz",
  ],
  [
    "SUP-VND-003",
    "Prime Hardware Co.",
    "09175550103",
    "Quezon City, Metro Manila",
    "anna@prime.ph",
    "Buttons, Zippers",
    "Inactive",
    "Anna Tan",
  ],
];

const starterMaterials = [
  [
    "SKU-RAW-JUS-02",
    "Jusi (White)",
    "LOT-JUS-2026-02",
    "Fabrics",
    80,
    "Yards",
    170,
    "10/01/2026",
    15,
  ],
  [
    "SKU-RAW-PIN-01",
    "Piña (Nat.)",
    "LOT-PIN-2026-01",
    "Fabrics",
    45.5,
    "Yards",
    800,
    "10/01/2026",
    10,
  ],
  [
    "SKU-ACC-BTN-CL",
    "Clear Button",
    "LOT-BTN-2026-04",
    "Buttons & Zippers",
    150,
    "Pieces",
    5,
    "09/25/2026",
    25,
  ],
];

const starterPurchaseOrders = [
  [
    "PO-REQ-4058",
    "SUP-VND-001",
    "Manila Silk Traders",
    "Oct 01",
    15000,
    "Pending Approval",
    [
      ["SKU-RAW-JUS-02", "Jusi (White)", 30, "Yards", 250, 0],
      ["SKU-RAW-PIN-01", "Piña (Nat.)", 10, "Yards", 750, 0],
    ],
    "2026-10-15",
    "Admin",
    "",
    "",
  ],
  [
    "PO-REQ-4057",
    "SUP-VND-002",
    "Lumban Embroidery",
    "Sep 28",
    8500,
    "Sent",
    [["SKU-RAW-JUS-02", "Jusi (White)", 10, "Yards", 850, 0]],
    "2026-10-10",
    "Admin",
    "",
    "",
  ],
  [
    "PO-REQ-4056",
    "SUP-VND-003",
    "Prime Hardware Co.",
    "Sep 25",
    3200,
    "Received",
    [["SKU-ACC-BTN-CL", "Clear Button", 640, "Pieces", 5, 640]],
    "2026-10-02",
    "Admin",
    "Receipt-4056.pdf",
    "",
  ],
];

let suppliers = [];
let materials = [];
let purchaseOrders = [];
let selectedTab = "active";
let receivingOrderIndex = -1;
let currentReceiptName = "";
let archivingOrderIndex = -1;

function safeReadStorage(key) {
  try {
    return JSON.parse(window.backendMemoryStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

function loadConnectedData() {
  const storedSuppliers = safeReadStorage(supplierDirectoryStorageKey);
  suppliers =
    Array.isArray(storedSuppliers) && storedSuppliers.length
      ? storedSuppliers.filter(
          (supplier) =>
            Array.isArray(supplier) &&
            String(supplier[supplierField.status] || "Active").toLowerCase() ===
              "active" &&
            !window.systemArchive.isArchived(
              "suppliers",
              supplier[supplierField.id],
            ),
        )
      : starterSuppliers;

  const storedMaterials = safeReadStorage(rawMaterialsStorageKey);
  if (Array.isArray(storedMaterials) && storedMaterials.length) {
    materials = storedMaterials.map((material) => ({
      id: String(material[0] || ""),
      name: String(material[1] || "Unnamed material"),
      unit: String(material[5] || "Units"),
      stock: Number(material[4]) || 0,
      cost: Number(material[6]) || 0,
    }));
  } else {
    materials = starterMaterials.map((material) => ({
      id: material[0],
      name: material[1],
      unit: material[5],
      stock: material[4],
      cost: material[6],
    }));
  }
}

function savePurchaseOrders() {
  try {
    window.backendMemoryStorage.setItem(
      purchaseOrderStorageKey,
      JSON.stringify(purchaseOrders),
    );
    return true;
  } catch (error) {
    setMessage(
      "createPOMessage",
      "Purchase orders could not be saved in this browser.",
      "error",
    );
    return false;
  }
}

function loadPurchaseOrders() {
  const stored = safeReadStorage(purchaseOrderStorageKey);
  purchaseOrders =
    Array.isArray(stored) && stored.length
      ? stored
      : JSON.parse(JSON.stringify(starterPurchaseOrders));
  if (!Array.isArray(stored) || stored.length === 0) savePurchaseOrders();
}

function formatCurrency(amount) {
  return (
    "₱" +
    (Number(amount) || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

function formatShortDate(dateValue) {
  const date = new Date(dateValue + "T00:00:00");
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function generatePurchaseOrderId() {
  const lastNumber = purchaseOrders.reduce((maximum, order) => {
    const match = String(order[orderField.id]).match(/^PO-REQ-(\d{4,})$/);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return "PO-REQ-" + String(lastNumber + 1).padStart(4, "0");
}

function statusClass(status) {
  if (
    status === "Pending Approval" ||
    status === "Waiting for Cashier Approval"
  )
    return "status-pending";
  if (
    status === "Sent" ||
    status === "Waiting for Delivery" ||
    status === "Awaiting Warehouse Acceptance"
  )
    return "status-sent";
  if (status === "Received") return "status-received";
  if (status === "Discrepancy") return "status-discrepancy";
  return "status-cancelled";
}

function updateSummary() {
  let pending = 0;
  let sent = 0;
  let received = 0;
  purchaseOrders.forEach((order) => {
    if (window.systemArchive.isArchived("purchase-orders", order[orderField.id])) {
      return;
    }
    if (
      order[orderField.status] === "Pending Approval" ||
      order[orderField.status] === "Waiting for Cashier Approval"
    )
      pending++;
    if (
      order[orderField.status] === "Sent" ||
      order[orderField.status] === "Waiting for Delivery" ||
      order[orderField.status] === "Awaiting Warehouse Acceptance"
    ) sent++;
    if (
      order[orderField.status] === "Received" ||
      (order[orderField.status] === "Discrepancy" && order[12])
    ) received++;
  });
  document.querySelector("#totalPOs").textContent = String(
    purchaseOrders.filter(
      (order) =>
        !window.systemArchive.isArchived("purchase-orders", order[orderField.id]),
    ).length,
  );
  document.querySelector("#pendingPOs").textContent = String(pending);
  document.querySelector("#sentPOs").textContent = String(sent);
  document.querySelector("#receivedPOs").textContent = String(received);
}

function appendCell(row, text, className) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text || "-";
  row.appendChild(cell);
  return cell;
}

function renderOrderTable() {
  const query = document
    .querySelector("#searchInput")
    .value.trim()
    .toLowerCase();
  const body = document.querySelector(
    selectedTab === "active" ? "#activePOTableBody" : "#historyPOTableBody",
  );
  const empty = document.querySelector(
    selectedTab === "active" ? "#activeEmptyState" : "#historyEmptyState",
  );
  const activeView = selectedTab === "active";
  body.replaceChildren();
  let shown = 0;

  purchaseOrders.forEach((order, index) => {
    if (window.systemArchive.isArchived("purchase-orders", order[orderField.id])) {
      return;
    }
    const status = order[orderField.status];
    const inView = activeView
      ? !["Cancelled", "Rejected", "Received"].includes(status) &&
        !(status === "Discrepancy" && order[12])
      : status === "Received" ||
        status === "Cancelled" ||
        status === "Rejected" ||
        (status === "Discrepancy" && order[12]);
    if (!inView) return;
    const searchable = [
      order[orderField.id],
      order[orderField.supplierId],
      order[orderField.supplierName],
      status,
    ]
      .join(" ")
      .toLowerCase();
    if (query && !searchable.includes(query)) return;

    const row = document.createElement("tr");
    const idCell = appendCell(row, "", "request-id");
    idCell.textContent = "";
    const idButton = document.createElement("button");
    idButton.className = "po-id-link";
    idButton.type = "button";
    idButton.textContent = order[orderField.id];
    idButton.setAttribute("aria-label", "Open " + order[orderField.id]);
    const canReceiveOrder = [
      "Sent",
      "Waiting for Delivery",
      "Awaiting Warehouse Acceptance",
      "Discrepancy",
    ].includes(status) && !order[12];
    idButton.disabled = !canReceiveOrder;
    if (canReceiveOrder) {
      idButton.addEventListener("click", () => openReceiveModal(index));
    }
    idCell.appendChild(idButton);

    const supplierCell = document.createElement("td");
    const supplierName = document.createElement("strong");
    supplierName.textContent = order[orderField.supplierName];
    const supplierId = document.createElement("span");
    supplierId.textContent = "(" + order[orderField.supplierId] + ")";
    supplierCell.className = "po-supplier-cell";
    supplierCell.append(supplierName, supplierId);
    row.appendChild(supplierCell);
    const itemsCell = document.createElement("td");
    itemsCell.className = "po-items-cell";
    const itemDetails = (order[orderField.items] || []).map((item) => {
      const detail = document.createElement("span");
      detail.textContent =
        `${item[1] || item[0]} · ${Number(item[2]) || 0} ${item[3] || ""}`;
      return detail;
    });
    if (itemDetails.length) itemsCell.append(...itemDetails);
    else itemsCell.textContent = "No items";
    row.appendChild(itemsCell);
    appendCell(row, order[orderField.date]);
    appendCell(row, formatCurrency(order[orderField.total]), "amount-cell");

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "status-badge " + statusClass(status);
    badge.textContent = status;
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    actionCell.className = "po-actions-cell";
    if (
      status === "Sent" ||
      status === "Waiting for Delivery" ||
      status === "Awaiting Warehouse Acceptance" ||
      (status === "Discrepancy" && !order[12])
    ) {
      const receiveButton = document.createElement("button");
      receiveButton.type = "button";
      receiveButton.className = "action-button";
      receiveButton.textContent =
        status === "Discrepancy" ? "Resolve" : "Receive";
      receiveButton.addEventListener("click", () => openReceiveModal(index));
      actionCell.appendChild(receiveButton);
    } else if (
      status === "Pending Approval" ||
      status === "Waiting for Cashier Approval"
    ) {
      const pendingText = document.createElement("span");
      pendingText.className = "pending-action-label";
      pendingText.textContent = "Awaiting cashier approval";
      actionCell.appendChild(pendingText);
    } else {
      const receiptText = document.createElement("span");
      receiptText.className = "receipt-name";
      receiptText.textContent = order[orderField.receiptName] || "Received";
      actionCell.appendChild(receiptText);
    }
    row.appendChild(actionCell);
    body.appendChild(row);
    shown++;
  });

  empty.style.display = shown ? "none" : "block";
  const tabVisible =
    selectedTab === "active"
      ? purchaseOrders.filter(
          (order) =>
            !window.systemArchive.isArchived("purchase-orders", order[orderField.id]) &&
            order[orderField.status] !== "Cancelled" &&
            order[orderField.status] !== "Rejected" &&
            order[orderField.status] !== "Received" &&
            !(order[orderField.status] === "Discrepancy" && order[12]),
        ).length
      : purchaseOrders.filter((order) =>
          !window.systemArchive.isArchived("purchase-orders", order[orderField.id]) &&
          ["Received", "Cancelled", "Rejected", "Discrepancy"].includes(
            order[orderField.status],
          ),
        ).length;
  document.querySelector("#poCountLabel").textContent =
    "Showing " + shown + " of " + tabVisible + " purchase orders";
  updateSummary();
}

function openArchiveModal(index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= purchaseOrders.length ||
    !purchaseOrders[index]
  ) {
    setMessage("createPOMessage", "Select an available purchase order to archive.", "error");
    return;
  }
  archivingOrderIndex = index;
  document.querySelector("#archiveModal").classList.add("show");
}

function closeArchiveModal() {
  archivingOrderIndex = -1;
  document.querySelector("#archiveModal").classList.remove("show");
}

function confirmArchivePurchaseOrder() {
  if (
    archivingOrderIndex < 0 ||
    archivingOrderIndex >= purchaseOrders.length ||
    !purchaseOrders[archivingOrderIndex]
  ) {
    closeArchiveModal();
    return;
  }
  const order = purchaseOrders[archivingOrderIndex];
  try {
    window.systemArchive.archive(
      "purchase-orders",
      order[orderField.id],
      order[orderField.supplierName],
      order[orderField.id] + " · " + order[orderField.status],
      order,
    );
    closeArchiveModal();
    renderOrderTable();
    setMessage("createPOMessage", "Purchase order archived. It can be restored from System & Security > Archive.", "success");
  } catch (error) {
    console.error("Could not archive purchase order.", error);
    setMessage(
      "createPOMessage",
      error instanceof Error ? error.message : "The purchase order could not be archived.",
      "error",
    );
  }
}

function setTab(tab) {
  selectedTab = tab;
  const active = tab === "active";
  document.querySelector("#activePOTab").classList.toggle("is-active", active);
  document
    .querySelector("#historyPOTab")
    .classList.toggle("is-active", !active);
  document
    .querySelector("#activePOTab")
    .setAttribute("aria-selected", String(active));
  document
    .querySelector("#historyPOTab")
    .setAttribute("aria-selected", String(!active));
  document.querySelector("#activePOView").hidden = !active;
  document.querySelector("#historyPOView").hidden = active;
  renderOrderTable();
}

function setMessage(id, text, type) {
  const message = document.querySelector("#" + id);
  message.textContent = text;
  message.className = "form-message" + (type ? " " + type : "");
}

function findSupplier(id) {
  return suppliers.find(
    (supplier) => String(supplier[supplierField.id]) === String(id),
  );
}

function renderSupplierOptions() {
  const select = document.querySelector("#poSupplierSelect");
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a supplier";
  select.appendChild(placeholder);
  suppliers
    .filter((supplier) => supplier[supplierField.status] !== "Inactive")
    .forEach((supplier) => {
      const option = document.createElement("option");
      option.value = supplier[supplierField.id];
      option.textContent =
        supplier[supplierField.id] + " - " + supplier[supplierField.name];
      option.dataset.supplierName = supplier[supplierField.name];
      select.appendChild(option);
    });
}

function openCreatePOModal() {
  document.querySelector("#createPOForm").reset();
  document.querySelector("#poItemRows").replaceChildren();
  document.querySelector("#poDeliveryDate").value = new Date(
    Date.now() + 14 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  document.querySelector("#poRequester").value = "Admin";
  setMessage("createPOMessage", "", "");
  renderSupplierOptions();
  addPOItemRow();
  updatePOTotal();
  document.querySelector("#createPOModal").classList.add("show");
}

function addPOItemRow(item) {
  const container = document.querySelector("#poItemRows");
  const row = document.createElement("div");
  row.className = "po-item-row";
  const select = document.createElement("select");
  select.className = "po-material-select";
  select.setAttribute("aria-label", "Material");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select material";
  select.appendChild(placeholder);
  materials.forEach((material) => {
    const option = document.createElement("option");
    option.value = material.id;
    option.textContent = material.id + " - " + material.name;
    select.appendChild(option);
  });
  const quantity = document.createElement("input");
  quantity.type = "number";
  quantity.min = "0.01";
  quantity.step = "any";
  quantity.value = item ? String(item[2]) : "1";
  quantity.className = "po-quantity-input";
  quantity.setAttribute("aria-label", "Quantity");
  const unit = document.createElement("span");
  unit.className = "po-item-unit";
  const estimate = document.createElement("span");
  estimate.className = "po-item-estimate";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "po-remove-item";
  remove.textContent = "Remove";

  function updateLine() {
    const selected = materials.find((material) => material.id === select.value);
    unit.textContent = selected ? selected.unit : "Unit";
    const lineTotal = selected
      ? selected.cost * (Number(quantity.value) || 0)
      : 0;
    estimate.textContent = formatCurrency(lineTotal);
    updatePOTotal();
  }

  select.addEventListener("change", updateLine);
  quantity.addEventListener("input", updateLine);
  remove.addEventListener("click", () => {
    row.remove();
    updatePOTotal();
  });
  if (item) select.value = item[0];
  row.append(select, quantity, unit, estimate, remove);
  container.appendChild(row);
  updateLine();
}

function updatePOTotal() {
  let total = 0;
  document.querySelectorAll(".po-item-row").forEach((row) => {
    const id = row.querySelector(".po-material-select").value;
    const material = materials.find((item) => item.id === id);
    if (material)
      total +=
        material.cost *
        (Number(row.querySelector(".po-quantity-input").value) || 0);
  });
  document.querySelector("#poCalculatedTotal").textContent =
    formatCurrency(total);
}

function collectPOItems() {
  let items = [];
  document.querySelectorAll(".po-item-row").forEach((row) => {
    const id = row.querySelector(".po-material-select").value;
    const material = materials.find((item) => item.id === id);
    const quantity = Number(row.querySelector(".po-quantity-input").value) || 0;
    if (material && quantity > 0)
      items = window.arrayWithAppended(items, [
        material.id,
        material.name,
        quantity,
        material.unit,
        material.cost,
        0,
        false,
      ]);
  });
  return items;
}

function createPO(event) {
  event.preventDefault();
  const supplierId = document.querySelector("#poSupplierSelect").value;
  const supplier = findSupplier(supplierId);
  const items = collectPOItems();
  if (!supplier) {
    setMessage("createPOMessage", "Select an active supplier.", "error");
    return;
  }
  if (!items.length) {
    setMessage(
      "createPOMessage",
      "Add at least one material and a quantity above zero.",
      "error",
    );
    return;
  }
  const total = items.reduce((sum, item) => sum + item[2] * item[4], 0);
  const order = [
    generatePurchaseOrderId(),
    supplier[supplierField.id],
    supplier[supplierField.name],
    formatShortDate(new Date().toISOString().slice(0, 10)),
    total,
    "Waiting for Cashier Approval",
    items,
    document.querySelector("#poDeliveryDate").value,
    document.querySelector("#poRequester").value.trim() || "Admin",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    new Date().toISOString(),
  ];
  purchaseOrders = window.arrayWithPrepended(purchaseOrders, order);
  if (!savePurchaseOrders()) {
    purchaseOrders = window.arrayWithoutFirst(purchaseOrders);
    return;
  }
  renderOrderTable();
  document.querySelector("#createPOModal").classList.remove("show");
  document.querySelector("#activePOTab").click();
}

function openReceiveModal(index) {
  receivingOrderIndex = index;
  const order = purchaseOrders[index];
  if (!order) return;
  if (
    !["Sent", "Waiting for Delivery", "Discrepancy"].includes(
      order[orderField.status],
    ) ||
    order[12]
  ) {
    receivingOrderIndex = -1;
    return;
  }
  currentReceiptName = order[orderField.receiptName] || "";
  document.querySelector("#receivePOId").textContent = order[orderField.id];
  document.querySelector("#receivePOSupplier").textContent =
    "Supplier: " + order[orderField.supplierName];
  document.querySelector("#receiveItemRows").replaceChildren();
  (order[orderField.items] || []).forEach((item, itemIndex) => {
    const row = document.createElement("div");
    row.className = "receive-item-row";
    const received = Number(item[5]);
    const checked = item[6] || order[orderField.status] === "Received";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(checked);
    checkbox.setAttribute("aria-label", "Mark " + item[1] + " received");
    const label = document.createElement("label");
    label.textContent =
      item[0] + " (" + item[1] + ") — Ordered: " + item[2] + " " + item[3];
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "0";
    quantity.step = "any";
    const hasSavedReceipt =
      item[7] !== undefined ||
      [
        "Received",
        "Discrepancy",
        "Awaiting Warehouse Acceptance",
      ].includes(order[orderField.status]);
    quantity.value = String(hasSavedReceipt ? received : item[2]);
    quantity.setAttribute("aria-label", "Received quantity for " + item[1]);
    quantity.dataset.itemIndex = String(itemIndex);
    row.append(checkbox, label, quantity);
    document.querySelector("#receiveItemRows").appendChild(row);
  });
  document.querySelector("#receiptFile").value = "";
  document.querySelector("#receiptFileName").textContent =
    currentReceiptName || "Optional at this stage";
  document.querySelector("#discrepancyFields").classList.add("hidden");
  document.querySelector("#discrepancyNotes").value =
    order[orderField.discrepancy] || "";
  setMessage("receivePOMessage", "", "");
  document.querySelector("#receivePOModal").classList.add("show");
}

function saveReceipt(discrepancy) {
  const order = purchaseOrders[receivingOrderIndex];
  if (!order) return;
  if (
    !["Sent", "Waiting for Delivery", "Discrepancy"].includes(
      order[orderField.status],
    ) ||
    order[12]
  ) {
    setMessage(
      "receivePOMessage",
      "This purchase order is no longer awaiting supplier receipt.",
      "error",
    );
    return;
  }
  let hasDiscrepancy = false;
  const items = (order[orderField.items] || []).map((item) => [...item]);
  const receiptRows = [...document.querySelectorAll(".receive-item-row")];
  for (const row of receiptRows) {
    const quantityInput = row.querySelector("input[type=number]");
    const index = Number(quantityInput.dataset.itemIndex);
    const receivedQty = Number(quantityInput.value);
    const confirmed = row.querySelector("input[type=checkbox]").checked;
    if (
      !Number.isInteger(index) ||
      !items[index] ||
      !Number.isFinite(receivedQty) ||
      receivedQty < 0
    ) {
      setMessage(
        "receivePOMessage",
        "Enter a valid non-negative quantity for each received item.",
        "error",
      );
      return;
    }
    items[index][5] = receivedQty;
    items[index][6] = confirmed;
    if (!confirmed || receivedQty !== Number(items[index][2]))
      hasDiscrepancy = true;
  }
  const notes = document.querySelector("#discrepancyNotes").value.trim();
  if ((discrepancy || hasDiscrepancy) && !notes) {
    document.querySelector("#discrepancyFields").classList.remove("hidden");
    setMessage(
      "receivePOMessage",
      "Add discrepancy details before submitting this receipt.",
      "error",
    );
    return;
  }
  const file = document.querySelector("#receiptFile").files[0];
  if (file) currentReceiptName = file.name;
  const wasReceived = !discrepancy && !hasDiscrepancy;
  const nextOrder = [...order];
  nextOrder[orderField.items] = items;
  nextOrder[orderField.receiptName] = currentReceiptName;
  nextOrder[orderField.discrepancy] = notes;
  const receiptTimestamp = new Date().toISOString();
  nextOrder[orderField.status] = wasReceived ? "Received" : "Discrepancy";
  nextOrder[12] = receiptTimestamp;
  nextOrder[14] = receiptTimestamp;

  let rawMaterials;
  let purchaseRequests;
  try {
    const savedMaterials = window.backendMemoryStorage.getItem(rawMaterialsStorageKey);
    rawMaterials = savedMaterials === null ? [] : JSON.parse(savedMaterials);
    if (!Array.isArray(rawMaterials)) {
      throw new Error("Saved raw-material inventory must be a list.");
    }
    rawMaterials = rawMaterials.map((material) =>
      Array.isArray(material) ? [...material] : material,
    );
    const savedRequests = window.backendMemoryStorage.getItem(purchaseRequestsStorageKey);
    purchaseRequests = savedRequests === null ? [] : JSON.parse(savedRequests);
    if (!Array.isArray(purchaseRequests)) {
      throw new Error("Saved purchase requests must be a list.");
    }

    items.forEach((item) => {
      if (!Array.isArray(item)) {
        throw new Error("The received purchase-order items are invalid.");
      }
      const receivedQuantity = item[6] ? Number(item[5]) : 0;
      if (!Number.isFinite(receivedQuantity) || receivedQuantity < 0) {
        throw new Error("The received material quantity is invalid.");
      }
      const material = rawMaterials.find(
        (entry) => Array.isArray(entry) && String(entry[0]) === String(item[0]),
      );
      if (receivedQuantity === 0) {
        item[7] = 0;
        return;
      }
      if (!material) {
        throw new Error(
          "Material " + item[0] + " is missing from raw-material inventory.",
        );
      }
      const stock = Number(material[4]);
      if (!Number.isFinite(stock)) {
        throw new Error("Inventory quantity for " + item[0] + " is invalid.");
      }
      if (
        String(material[5] || "").trim().toLowerCase() !==
        String(item[3] || "").trim().toLowerCase()
      ) {
        throw new Error(
          "The purchase unit for " + item[0] +
            " does not match its raw-material inventory unit.",
        );
      }
      material[4] = stock + receivedQuantity;
      item[7] = receivedQuantity;
    });

    const linkedRequest = purchaseRequests.find(
      (request) => request && request.id === order[11],
    );
    if (linkedRequest) {
      linkedRequest.status = wasReceived ? "Received" : "Discrepancy";
      linkedRequest.receivedAt = receiptTimestamp;
      linkedRequest.receiptNotes = notes;
    }
  } catch (error) {
    setMessage(
      "receivePOMessage",
      error instanceof Error
        ? error.message
        : "The supplier receipt could not be applied to inventory.",
      "error",
    );
    return;
  }

  const nextPurchaseOrders = purchaseOrders.map((entry, index) =>
    index === receivingOrderIndex ? nextOrder : entry,
  );
  const previousPurchaseOrders = window.backendMemoryStorage.getItem(purchaseOrderStorageKey);
  const previousMaterials = window.backendMemoryStorage.getItem(rawMaterialsStorageKey);
  const previousRequests = window.backendMemoryStorage.getItem(purchaseRequestsStorageKey);
  try {
    window.backendMemoryStorage.setItem(rawMaterialsStorageKey, JSON.stringify(rawMaterials));
    window.backendMemoryStorage.setItem(
      purchaseOrderStorageKey,
      JSON.stringify(nextPurchaseOrders),
    );
    window.backendMemoryStorage.setItem(
      purchaseRequestsStorageKey,
      JSON.stringify(purchaseRequests),
    );
  } catch (error) {
    [
      [rawMaterialsStorageKey, previousMaterials],
      [purchaseOrderStorageKey, previousPurchaseOrders],
      [purchaseRequestsStorageKey, previousRequests],
    ].forEach(([key, previousValue]) => {
      try {
        if (previousValue === null) window.backendMemoryStorage.removeItem(key);
        else window.backendMemoryStorage.setItem(key, previousValue);
      } catch (rollbackError) {
        console.error("Could not roll back " + key + " after receipt failure.", rollbackError);
      }
    });
    setMessage(
      "receivePOMessage",
      "The supplier receipt could not be saved to inventory and purchase history.",
      "error",
    );
    return;
  }

  purchaseOrders = nextPurchaseOrders;
  document.querySelector("#receivePOModal").classList.remove("show");
  receivingOrderIndex = -1;
  setMessage(
    "createPOMessage",
    wasReceived
      ? "Supplier receipt recorded and raw-material inventory updated."
      : "Supplier receipt recorded with a discrepancy; confirmed quantities were added to raw-material inventory.",
    wasReceived ? "success" : "error",
  );
  setTab("active");
}

function closeLegacyModal(id) {
  const modal = document.querySelector("#" + id);
  if (modal) modal.style.display = "none";
}

function viewRequest(index) {
  const order = purchaseOrders[index];
  if (!order) return;
  const fields = [
    "viewRequestID",
    "viewRequestDate",
    "viewRequestedBy",
    "viewMaterialID",
    "viewMaterialName",
    "viewCurrentStock",
    "viewRequiredQuantity",
    "viewShortageQuantity",
    "viewSupplierID",
    "viewSupplierName",
    "viewEstimatedCost",
    "viewReason",
    "viewStatus",
    "viewApprovedBy",
    "viewApprovalDate",
    "viewNotes",
  ];
  const values = [
    order[0],
    order[3],
    order[8],
    (order[6][0] || [])[0],
    (order[6][0] || [])[1],
    "-",
    (order[6] || []).map((item) => item[2] + " " + item[3]).join(", "),
    "-",
    order[1],
    order[2],
    formatCurrency(order[4]),
    order[10],
    order[5],
    "",
    "",
    order[9],
  ];
  fields.forEach((id, index) => {
    const field = document.querySelector("#" + id);
    if (field) field.textContent = values[index] || "-";
  });
  document.querySelector("#viewModal").style.display = "flex";
}

function searchRequests() {
  renderOrderTable();
}

function renderMaterialPurchaseRequests() {
  const body = document.querySelector("#materialRequestsTableBody");
  const empty = document.querySelector("#materialRequestsEmptyState");
  const errorMessage = document.querySelector("#materialRequestsError");
  body.replaceChildren();
  errorMessage.hidden = true;

  try {
    const savedRequests = window.backendMemoryStorage.getItem(purchaseRequestsStorageKey);
    const requests = savedRequests === null ? [] : JSON.parse(savedRequests);
    if (!Array.isArray(requests)) {
      throw new Error("Saved material purchase requests must be a list.");
    }

    const validRequests = requests.filter(
      (request) =>
        request &&
        typeof request === "object" &&
        typeof request.materialSku === "string" &&
        typeof request.materialName === "string",
    );

    validRequests.forEach((request) => {
      const row = document.createElement("tr");
      const requestedAt = document.createElement("td");
      const date = new Date(request.requestedAt || "");
      requestedAt.textContent = Number.isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          });

      const materialCell = document.createElement("td");
      materialCell.className = "po-supplier-cell";
      const materialName = document.createElement("strong");
      materialName.textContent = request.materialName;
      const materialSku = document.createElement("span");
      materialSku.textContent = request.materialSku;
      materialCell.append(materialName, materialSku);

      const category = document.createElement("td");
      category.textContent = request.category || "—";
      const unit = typeof request.unit === "string" ? request.unit : "";
      const onHand = document.createElement("td");
      onHand.textContent = (Number(request.quantityOnHand) || 0) + " " + unit;
      const quantity = document.createElement("td");
      quantity.textContent =
        (Number(request.requestedQuantity) || 0) + " " + unit;
      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      status.className =
        ["Approved", "Received"].includes(request.status)
          ? "status-badge status-received"
          : [
                "Rejected",
                "Discrepancy",
                "Received with Discrepancy",
              ].includes(request.status)
            ? "status-badge status-discrepancy"
            : "status-badge status-pending";
      status.textContent =
        request.status === "Approved" && request.purchaseOrderId
          ? "PO created · " + request.purchaseOrderId
          : typeof request.status === "string"
            ? request.status
            : "Requested";
      statusCell.appendChild(status);

      const supplierCell = document.createElement("td");
      const supplierName = document.createElement("strong");
      supplierName.textContent =
        request.supplierName || request.supplier?.name || "Not selected";
      const supplierId = document.createElement("span");
      supplierId.textContent =
        request.supplierId || request.supplier?.id || "Supplier not assigned";
      supplierCell.className = "po-supplier-cell";
      supplierCell.append(supplierName, supplierId);

      row.append(
        requestedAt,
        materialCell,
        category,
        onHand,
        quantity,
        supplierCell,
        statusCell,
      );
      body.appendChild(row);
    });

    empty.hidden = validRequests.length > 0;
  } catch (error) {
    console.error("Could not load material purchase requests.", error);
    empty.hidden = true;
    errorMessage.hidden = false;
    errorMessage.textContent = "Unable to load material purchase requests.";
  }
}

window.receiveRestockingRequest = function (
  requestID,
  requestDate,
  requestedBy,
  materialID,
  materialName,
  currentStock,
  requiredQuantity,
  shortageQuantity,
  supplierID,
  supplierName,
  estimatedCost,
  reason,
  notes,
) {
  const supplier = findSupplier(supplierID);
  const material = materials.find((item) => item.id === materialID);
  const item = [
    materialID,
    materialName,
    Number(shortageQuantity || requiredQuantity) || 1,
    material ? material.unit : "Units",
    material ? material.cost : Number(estimatedCost) || 0,
    0,
    false,
  ];
  const suppliedRequestId = String(requestID || "").trim();
  const hasValidUniqueRequestId =
    /^PO-REQ-\d{4,}$/.test(suppliedRequestId) &&
    !purchaseOrders.some(
      (order) => order[orderField.id] === suppliedRequestId,
    );
  purchaseOrders = window.arrayWithPrepended(purchaseOrders, [
    hasValidUniqueRequestId ? suppliedRequestId : generatePurchaseOrderId(),
    supplierID || "",
    supplierName ||
      (supplier ? supplier[supplierField.name] : "Unassigned supplier"),
    requestDate || formatShortDate(new Date().toISOString().slice(0, 10)),
    Number(estimatedCost) || item[2] * item[4],
    "Pending Approval",
    [item],
    "",
    requestedBy || "Inventory",
    "",
    notes || reason || "",
  ]);
  savePurchaseOrders();
  renderOrderTable();
};

document
  .querySelector("#activePOTab")
  .addEventListener("click", () => setTab("active"));
document
  .querySelector("#historyPOTab")
  .addEventListener("click", () => setTab("history"));
document
  .querySelector("#searchInput")
  .addEventListener("input", searchRequests);
document
  .querySelector("#refreshMaterialRequests")
  .addEventListener("click", renderMaterialPurchaseRequests);
document
  .querySelector("#createPOButton")
  .addEventListener("click", openCreatePOModal);
document
  .querySelector("#closeCreatePOModal")
  .addEventListener("click", () =>
    document.querySelector("#createPOModal").classList.remove("show"),
  );
document
  .querySelector("#cancelCreatePO")
  .addEventListener("click", () =>
    document.querySelector("#createPOModal").classList.remove("show"),
  );
document
  .querySelector("#addPOItemButton")
  .addEventListener("click", () => addPOItemRow());
document
  .querySelector("#poSupplierSelect")
  .addEventListener("change", function () {
    const supplier = findSupplier(this.value);
    document.querySelector("#poSupplierContact").textContent = supplier
      ? "Contact: " +
        (supplier[supplierField.email] || "No email on file") +
        " (from Supplier Directory)"
      : "Contact email loads from Supplier Directory.";
  });
document.querySelector("#createPOForm").addEventListener("submit", createPO);
document
  .querySelector("#closeReceivePOModal")
  .addEventListener("click", () =>
    document.querySelector("#receivePOModal").classList.remove("show"),
  );
document
  .querySelector("#cancelReceivePO")
  .addEventListener("click", () =>
    document.querySelector("#receivePOModal").classList.remove("show"),
  );
document.querySelector("#reportDiscrepancy").addEventListener("click", () => {
  document.querySelector("#discrepancyFields").classList.remove("hidden");
  setMessage(
    "receivePOMessage",
    "Record the discrepancy, then submit the receipt.",
    "",
  );
});
document
  .querySelector("#confirmReceipt")
  .addEventListener("click", () => saveReceipt(false));
document.querySelector("#receiptFile").addEventListener("change", function () {
  const file = this.files[0];
  document.querySelector("#receiptFileName").textContent = file
    ? file.name
    : "Optional at this stage";
});
document
  .querySelector("#viewModal")
  .addEventListener("click", function (event) {
    if (event.target === this) closeLegacyModal("viewModal");
  });
document
  .querySelector("#cancelArchiveButton")
  .addEventListener("click", closeArchiveModal);
document
  .querySelector("#confirmArchiveButton")
  .addEventListener("click", confirmArchivePurchaseOrder);
document
  .querySelector("#archiveModal")
  .addEventListener("click", function (event) {
    if (event.target === this) closeArchiveModal();
  });
window.addEventListener("systemArchiveChanged", renderOrderTable);
window.addEventListener("storage", (event) => {
  if (
    event.key === "jorjetteangel-system-archive" ||
    event.key === purchaseOrderStorageKey ||
    event.key === supplierDirectoryStorageKey ||
    event.key === rawMaterialsStorageKey ||
    event.key === purchaseRequestsStorageKey
  ) {
    if (
      event.key === supplierDirectoryStorageKey ||
      event.key === rawMaterialsStorageKey
    ) {
      loadConnectedData();
      renderSupplierOptions();
    }
    loadPurchaseOrders();
    renderOrderTable();
    renderMaterialPurchaseRequests();
  }
});

loadConnectedData();
loadPurchaseOrders();
renderSupplierOptions();
renderOrderTable();
renderMaterialPurchaseRequests();
