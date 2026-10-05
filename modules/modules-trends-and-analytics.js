// Builds sales, inventory, and production reports.

const REPORT_STORAGE_KEYS = {
  orders: "jorjetteangel-orders",
  materials: "jg-erp-fabrics-materials-v1",
  recipes: "jg-erp-bom-recipes-v1",
};
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const selectedRange = document.getElementById("dateRange");
let reportData = { orders: [], materials: [], recipes: [] };

function readArray(key, label) {
  const saved = window.backendMemoryStorage.getItem(key);
  if (saved === null) return [];
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) {
    throw new Error(`Saved ${label} data must be an array.`);
  }
  return parsed;
}

function showDataNotice(messages) {
  const notice = document.getElementById("analytics-data-notice");
  notice.textContent = messages.join(" ");
  notice.hidden = messages.length === 0;
}

function loadReportData() {
  let messages = [];
  try {
    reportData.orders = readArray(REPORT_STORAGE_KEYS.orders, "customer orders")
      .filter((order) => order && typeof order === "object");
  } catch (error) {
    reportData.orders = [];
    messages = window.arrayWithAppended(
      messages,
      error instanceof Error
        ? error.message
        : "Customer orders could not be loaded.",
    );
  }
  try {
    reportData.materials = readArray(
      REPORT_STORAGE_KEYS.materials,
      "raw materials",
    ).filter((material) => Array.isArray(material));
  } catch (error) {
    reportData.materials = [];
    messages = window.arrayWithAppended(
      messages,
      error instanceof Error
        ? error.message
        : "Raw materials could not be loaded.",
    );
  }
  try {
    reportData.recipes = readArray(REPORT_STORAGE_KEYS.recipes, "BOM recipes")
      .filter((recipe) => recipe && typeof recipe === "object");
  } catch (error) {
    reportData.recipes = [];
    messages = window.arrayWithAppended(
      messages,
      error instanceof Error
        ? error.message
        : "BOM recipes could not be loaded.",
    );
  }
  showDataNotice(messages);
  renderReport();
}

function parseOrderDate(order) {
  const value = order.createdAt || order.receivedAt || "";
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCancelled(order) {
  return /^(cancelled|canceled)$/i.test(String(order.status || "").trim());
}

function orderTotal(order) {
  const total = Number(order.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function recordedPayment(order) {
  const amount = Number(
    order.amountReceived ?? order.amountPaid ?? order.paidAmount ?? 0,
  );
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function isCompletedOrder(order) {
  return /^(completed|delivered)$/i.test(String(order.status || "").trim());
}

function isDispatchedOrder(order) {
  return /^(dispatched|delivered|released|shipped|completed)$/i.test(
    String(order.status || "").trim(),
  );
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatQuantity(value, digits = 1) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getPeriodBounds(now = new Date()) {
  if (selectedRange.value === "previous-month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1),
      label: "Last month",
    };
  }
  if (selectedRange.value === "year") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
      label: `Year to date · ${now.getFullYear()}`,
    };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    label: "This month",
  };
}

function isWithinPeriod(date, bounds) {
  return date && date >= bounds.start && date < bounds.end;
}

function renderKpis(bounds) {
  const periodOrders = reportData.orders.filter((order) => {
    return !isCancelled(order) && isWithinPeriod(parseOrderDate(order), bounds);
  });
  const revenue = periodOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const units = periodOrders.reduce((sum, order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    return sum + items.reduce(
      (itemTotal, item) => itemTotal + Math.max(0, Number(item?.quantity) || 0),
      0,
    );
  }, 0);
  document.getElementById("totalRevenue").textContent = formatMoney(revenue);
  document.getElementById("ordersProcessed").textContent =
    formatQuantity(periodOrders.length, 0);
  document.getElementById("unitsSold").textContent = formatQuantity(units, 0);
  document.getElementById("revenue-period-note").textContent = bounds.label;
  document.getElementById("orders-period-note").textContent = bounds.label;
  document.getElementById("sales-total-period").textContent =
    `${formatMoney(revenue)} · ${bounds.label}`;
}

function buildMonthlySales() {
  const now = new Date();
  let monthBuckets = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    monthBuckets = window.arrayWithAppended(monthBuckets, {
      key: getMonthKey(date),
      label: `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${String(date.getFullYear()).slice(-2)}`,
      orders: 0,
      revenue: 0,
    });
  }
  const byMonth = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));
  reportData.orders.forEach((order) => {
    if (isCancelled(order)) return;
    const date = parseOrderDate(order);
    if (!date) return;
    const bucket = byMonth.get(getMonthKey(date));
    if (!bucket) return;
    bucket.orders += 1;
    bucket.revenue += orderTotal(order);
  });
  return monthBuckets;
}

function renderSalesChart(months) {
  const chart = document.getElementById("sales-chart");
  const axis = document.getElementById("sales-chart-values");
  const maximum = Math.max(0, ...months.map((month) => month.revenue));
  const scaleMaximum = maximum > 0 ? Math.ceil(maximum / 4 / 1000) * 1000 * 4 : 4;
  axis.replaceChildren();
  for (let level = 4; level >= 0; level -= 1) {
    const label = document.createElement("span");
    label.textContent = formatMoney((scaleMaximum * level) / 4);
    axis.append(label);
  }
  chart.replaceChildren();
  months.forEach((month) => {
    const column = document.createElement("div");
    column.className = "month-column";
    const label = document.createElement("span");
    label.className = "month-value";
    label.textContent = month.revenue ? formatMoney(month.revenue) : "—";
    const track = document.createElement("div");
    track.className = "month-bar-track";
    const bar = document.createElement("span");
    bar.className = "month-bar";
    const height = scaleMaximum > 0 ? (month.revenue / scaleMaximum) * 100 : 0;
    bar.style.height = `${height}%`;
    bar.title = `${month.label}: ${formatMoney(month.revenue)} from ${month.orders} orders`;
    track.append(bar);
    const monthLabel = document.createElement("span");
    monthLabel.className = "month-label";
    monthLabel.textContent = month.label;
    column.append(label, track, monthLabel);
    column.setAttribute(
      "aria-label",
      `${month.label}: ${formatMoney(month.revenue)}, ${month.orders} orders`,
    );
    chart.append(column);
  });
  const peakMonth = months
    .filter((month) => month.revenue > 0)
    .reduce(
      (peak, month) => (!peak || month.revenue > peak.revenue ? month : peak),
      null,
    );
  chart.setAttribute(
    "aria-label",
    peakMonth
      ? `Monthly sales revenue for the last 12 months; peak month ${peakMonth.label}`
      : "Monthly sales revenue for the last 12 months; no sales history",
  );
}

function renderPeakOrderMonths(months) {
  const body = document.getElementById("peak-months-body");
  const monthsWithOrders = window.manualSortArray(
    months.filter((month) => month.orders > 0),
    (first, second) => second.orders - first.orders,
  );
  body.replaceChildren();
  if (!monthsWithOrders.length) {
    appendEmptyRow(body, 4, "No order history for the last 12 months.");
    document.getElementById("peak-order-month").textContent = "—";
    document.getElementById("peak-order-count").textContent = "No order history";
    return;
  }
  const peak = monthsWithOrders[0];
  document.getElementById("peak-order-month").textContent = peak.label;
  document.getElementById("peak-order-count").textContent =
    `${peak.orders} orders received`;
  monthsWithOrders.slice(0, 5).forEach((month, index) => {
    const row = document.createElement("tr");
    appendCell(row, `#${index + 1}`, "rank-cell");
    appendCell(row, month.label);
    appendCell(row, formatQuantity(month.orders, 0), "numeric-cell");
    appendCell(row, formatMoney(month.revenue), "numeric-cell");
    body.append(row);
  });
}

function appendEmptyRow(body, columns, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columns;
  cell.className = "table-empty";
  cell.textContent = message;
  row.append(cell);
  body.replaceChildren(row);
}

function appendCell(row, text, className) {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  row.append(cell);
}

function normalizeSize(size) {
  const value = String(size || "").trim().toLowerCase();
  const aliases = {
    s: "small",
    m: "medium",
    l: "large",
    xl: "xl",
    "x-large": "xl",
  };
  return aliases[value] || value;
}

function isCustomItem(item) {
  return (
    String(item?.size || "").toLowerCase() === "custom" ||
    (item?.customMeasurements &&
      typeof item.customMeasurements === "object" &&
      !Array.isArray(item.customMeasurements))
  );
}

function renderProductSales(bounds) {
  const container = document.getElementById("sales-by-product");
  const productCounts = new Map();
  reportData.orders.forEach((order) => {
    if (isCancelled(order) || !isWithinPeriod(parseOrderDate(order), bounds)) return;
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const name = String(item?.name || item?.productName || "Unspecified item");
      const quantity = Math.max(0, Number(item?.quantity) || 0);
      productCounts.set(name, (productCounts.get(name) || 0) + quantity);
    });
  });
  const products = window.manualSortArray(
    [...productCounts.entries()],
    (first, second) => second[1] - first[1],
  )
    .slice(0, 6);
  container.replaceChildren();
  if (!products.length) {
    container.textContent = "No product sales in the selected period.";
    return;
  }
  const maxQuantity = products[0][1] || 1;
  products.forEach(([name, quantity]) => {
    const row = document.createElement("div");
    row.className = "product-sales-row";
    const meta = document.createElement("div");
    meta.className = "product-sales-meta";
    const productName = document.createElement("span");
    productName.className = "product-sales-name";
    productName.textContent = name;
    const value = document.createElement("strong");
    value.className = "product-sales-value";
    value.textContent = `${formatQuantity(quantity, 0)} units`;
    meta.append(productName, value);
    const track = document.createElement("div");
    track.className = "product-sales-track";
    const fill = document.createElement("span");
    fill.className = "product-sales-fill";
    fill.style.width = `${(quantity / maxQuantity) * 100}%`;
    track.append(fill);
    row.append(meta, track);
    container.append(row);
  });
}

function renderFinancialOverview(bounds) {
  const container = document.getElementById("financial-overview");
  const orders = reportData.orders.filter((order) =>
    !isCancelled(order) && isWithinPeriod(parseOrderDate(order), bounds),
  );
  const grossSales = orders.reduce((total, order) => total + orderTotal(order), 0);
  const completedOrders = orders.filter(isCompletedOrder);
  const recordedCollections = completedOrders.reduce(
    (total, order) => total + recordedPayment(order),
    0,
  );
  const outstandingBalance = orders
    .filter((order) => !isDispatchedOrder(order))
    .reduce((total, order) => total + orderTotal(order), 0);
  const collectionsByMethod = new Map();
  completedOrders.forEach((order) => {
    const method =
      typeof order.paymentMethod === "string" && order.paymentMethod.trim()
        ? order.paymentMethod.trim()
        : "Not specified";
    collectionsByMethod.set(
      method,
      (collectionsByMethod.get(method) || 0) + recordedPayment(order),
    );
  });
  const methodCollection = window.manualSortArray(
    [...collectionsByMethod.entries()],
    (first, second) => second[1] - first[1],
  )
    .map(([method, amount]) => `${method}: ${formatMoney(amount)}`)
    .join(" · ") || "Cash on delivery: No completed collections";
  const rows = [
    ["Gross sales", formatMoney(grossSales)],
    ["Payment recorded (completed orders)", formatMoney(recordedCollections)],
    ["Outstanding balance (undispatched orders)", formatMoney(outstandingBalance)],
    ["Payment method collection", methodCollection],
  ];
  container.replaceChildren();
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "financial-row";
    const name = document.createElement("span");
    name.textContent = label;
    const amount = document.createElement("strong");
    amount.textContent = value;
    row.append(name, amount);
    container.append(row);
  });
}

function getMaterialUsageByCode() {
  const usage = new Map();
  const cutoff = new Date(Date.now() - 90 * DAY_MS);
  reportData.orders.forEach((order) => {
    const orderDate = parseOrderDate(order);
    if (!orderDate || orderDate < cutoff || isCancelled(order)) return;
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const quantity = Math.max(0, Number(item?.quantity) || 0);
      if (!quantity || !item?.productId || isCustomItem(item)) return;
      const recipe = reportData.recipes.find(
        (candidate) =>
          candidate.productId === item.productId &&
          normalizeSize(candidate.size) === normalizeSize(item.size),
      );
      if (!recipe || !Array.isArray(recipe.materials)) return;
      recipe.materials.forEach((ingredient) => {
        const code = String(ingredient?.code || "");
        const used = quantity * Math.max(0, Number(ingredient?.quantity) || 0);
        if (code && used > 0) usage.set(code, (usage.get(code) || 0) + used);
      });
    });
  });
  return usage;
}

function renderMaterialConsumption() {
  const body = document.getElementById("material-consumption-body");
  const materials = reportData.materials
    .filter((material) => material[0] && material[1])
    .map((material) => ({
      code: String(material[0]),
      name: String(material[1]),
      category: String(material[3] || "Raw material"),
      stock: Math.max(0, Number(material[4]) || 0),
      unit: String(material[5] || "units"),
      threshold: Math.max(0, Number(material[8]) || 0),
    }));
  const usageByCode = getMaterialUsageByCode();
  materials.forEach((material) => {
    material.used90Days = usageByCode.get(material.code) || 0;
    material.monthlyUse = material.used90Days / 3;
    material.monthsRemaining =
      material.monthlyUse > 0 ? material.stock / material.monthlyUse : Infinity;
    material.recommendation =
      material.monthlyUse > 0
        ? Math.max(0, Math.ceil(material.monthlyUse * 1.2 - material.stock))
        : 0;
  });
  const sortedMaterials = window.manualSortArray(materials, (first, second) => {
    if (first.monthlyUse <= 0) return second.monthlyUse > 0 ? 1 : 0;
    if (second.monthlyUse <= 0) return -1;
    return first.monthsRemaining - second.monthsRemaining;
  });
  body.replaceChildren();
  if (!materials.length) {
    appendEmptyRow(body, 6, "No raw-material inventory records are available.");
  } else {
    sortedMaterials.forEach((material) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const name = document.createElement("strong");
      name.textContent = material.name;
      const code = document.createElement("small");
      code.className = "material-code";
      code.textContent = `${material.code} · ${material.category}`;
      nameCell.append(name, code);
      row.append(nameCell);
      appendCell(
        row,
        material.used90Days > 0
          ? `${formatQuantity(material.used90Days)} ${material.unit}`
          : "No BOM usage",
        "numeric-cell",
      );
      appendCell(
        row,
        material.monthlyUse > 0
          ? `${formatQuantity(material.monthlyUse)} ${material.unit}`
          : "—",
        "numeric-cell",
      );
      appendCell(
        row,
        `${formatQuantity(material.stock)} ${material.unit}`,
        "numeric-cell",
      );
      appendCell(
        row,
        Number.isFinite(material.monthsRemaining)
          ? `${formatQuantity(material.monthsRemaining, 1)} mo.`
          : "—",
        "numeric-cell",
      );
      appendCell(
        row,
        material.monthlyUse > 0
          ? material.recommendation > 0
            ? `Plan to order ${formatQuantity(material.recommendation)} ${material.unit}`
            : "Stock covers next month"
          : "Insufficient usage history",
      );
      body.append(row);
    });
  }
  document.getElementById("material-data-note").textContent =
    reportData.recipes.length
      ? "Consumption is an estimate from standard-size BOM recipes matched to orders dated within the last 90 days. Custom orders without a linked BOM are excluded. The recommendation targets one month of forecast use plus a 20% buffer, less current stock."
      : "No BOM recipes are saved. Add recipes in Fabrics & BOM Management to calculate material consumption and next-month recommendations.";
}

function completionDateFor(item, order) {
  const value =
    item.productionCompletionDate ||
    (["completed", "ready for delivery"].includes(
      String(item.productionStatus || "").toLowerCase(),
    )
      ? item.productionUpdatedAt
      : "") ||
    order.completedAt ||
    order.deliveredAt ||
    "";
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isShippedCustomOrder(order, customItems) {
  const shipped = /^(dispatched|delivered|released|shipped)$/i;
  return (
    shipped.test(String(order.status || "")) ||
    customItems.some((item) => shipped.test(String(item.productionStatus || "")))
  );
}

function renderProductionBottlenecks() {
  const customOrders = reportData.orders
    .map((order) => ({
      order,
      items: (Array.isArray(order.items) ? order.items : []).filter(isCustomItem),
    }))
    .filter((entry) => entry.items.length > 0);
  let completedDays = [];
  const backlogStages = new Map();
  let backlogCount = 0;
  let shippedOrders = 0;
  customOrders.forEach(({ order, items }) => {
    if (isShippedCustomOrder(order, items)) shippedOrders += 1;
    items.forEach((item) => {
      const stage = String(item.productionStatus || order.status || "Received");
      const completion = completionDateFor(item, order);
      const received = parseOrderDate(order);
      if (received && completion && completion >= received) {
        completedDays = window.arrayWithAppended(
          completedDays,
          (completion.getTime() - received.getTime()) / DAY_MS,
        );
      }
      if (
        !/^(completed|ready for delivery|dispatched|delivered|released|shipped|cancelled|canceled)$/i.test(
          stage.trim(),
        ) &&
        !completion
      ) {
        backlogCount += 1;
        backlogStages.set(stage, (backlogStages.get(stage) || 0) + 1);
      }
    });
  });
  const average = completedDays.length
    ? completedDays.reduce((sum, days) => sum + days, 0) / completedDays.length
    : null;
  document.getElementById("average-turnaround").textContent =
    average === null ? "—" : `${formatQuantity(average, 1)} days`;
  document.getElementById("custom-shipment-rate").textContent =
    customOrders.length
      ? `${Math.round((shippedOrders / customOrders.length) * 100)}%`
      : "—";
  document.getElementById("custom-shipment-count").textContent =
    customOrders.length
      ? `${shippedOrders} of ${customOrders.length} custom orders shipped`
      : "No custom-order history";
  document.getElementById("custom-backlog-count").textContent =
    formatQuantity(backlogCount, 0);

  const body = document.getElementById("production-backlog-body");
  body.replaceChildren();
  const sortedStages = window.manualSortArray(
    [...backlogStages.entries()],
    (first, second) => second[1] - first[1],
  );
  if (!sortedStages.length) {
    appendEmptyRow(
      body,
      3,
      customOrders.length
        ? "No open custom-order production backlog."
        : "No custom orders are available for production analysis.",
    );
  } else {
    sortedStages.forEach(([stage, count]) => {
      const row = document.createElement("tr");
      appendCell(row, stage);
      appendCell(row, formatQuantity(count, 0), "numeric-cell");
      appendCell(
        row,
        `${Math.round((count / backlogCount) * 100)}%`,
        "numeric-cell",
      );
      body.append(row);
    });
  }
  document.getElementById("production-data-note").textContent =
    completedDays.length
      ? `Average turnaround is calculated from ${completedDays.length} custom order line${completedDays.length === 1 ? "" : "s"} with valid received and completion dates. Shipment counts use dispatched, delivered, released, or shipped order statuses.`
      : "Turnaround time is unavailable until custom-order production completion dates are recorded. Backlog counts are based on open custom order lines.";
}

function renderReport() {
  const bounds = getPeriodBounds();
  const months = buildMonthlySales();
  renderKpis(bounds);
  renderSalesChart(months);
  renderPeakOrderMonths(months);
  renderProductSales(bounds);
  renderFinancialOverview(bounds);
  renderMaterialConsumption();
  renderProductionBottlenecks();
}

function getFinancialExportRows(bounds, months) {
  const orders = reportData.orders.filter(
    (order) =>
      !isCancelled(order) && isWithinPeriod(parseOrderDate(order), bounds),
  );
  const completedOrders = orders.filter(isCompletedOrder);
  const undispatchedOrders = orders.filter(
    (order) => !isDispatchedOrder(order),
  );
  let rows = [
    ["Summary", "Gross sales", formatMoney(orders.reduce((sum, order) => sum + orderTotal(order), 0)), bounds.label],
    ["Summary", "Payments recorded (completed orders)", formatMoney(completedOrders.reduce((sum, order) => sum + recordedPayment(order), 0)), `${completedOrders.length} completed orders`],
    ["Summary", "Outstanding balance (undispatched orders)", formatMoney(undispatchedOrders.reduce((sum, order) => sum + orderTotal(order), 0)), `${undispatchedOrders.length} undispatched orders`],
  ];
  const collections = new Map();
  completedOrders.forEach((order) => {
    const method =
      typeof order.paymentMethod === "string" && order.paymentMethod.trim()
        ? order.paymentMethod.trim()
        : "Not specified";
    collections.set(
      method,
      (collections.get(method) || 0) + recordedPayment(order),
    );
  });
  if (collections.size) {
    collections.forEach((amount, method) => {
      rows = window.arrayWithAppended(rows, [
        "Payment method collection",
        method,
        formatMoney(amount),
        bounds.label,
      ]);
    });
  } else {
    rows = window.arrayWithAppended(rows, [
      "Payment method collection",
      "Cash on delivery",
      formatMoney(0),
      "No completed collections",
    ]);
  }
  months.forEach((month) => {
    rows = window.arrayWithAppended(rows, [
      "Monthly sales",
      month.label,
      formatMoney(month.revenue),
      `${month.orders} orders`,
    ]);
  });
  return rows;
}

function getMaterialExportRows() {
  const usage = getMaterialUsageByCode();
  return reportData.materials
    .filter((material) => Array.isArray(material) && material[0] && material[1])
    .map((material) => {
      const code = String(material[0]);
      const name = String(material[1]);
      const unit = String(material[5] || "units");
      const used90Days = usage.get(code) || 0;
      const monthlyUse = used90Days / 3;
      const stock = Math.max(0, Number(material[4]) || 0);
      const monthsRemaining = monthlyUse > 0 ? stock / monthlyUse : "";
      const recommendation =
        monthlyUse > 0 ? Math.max(0, Math.ceil(monthlyUse * 1.2 - stock)) : "";
      return [
        "Material",
        `${name} (${code})`,
        used90Days,
        `90-day use in ${unit}; monthly average ${formatQuantity(monthlyUse)}; stock ${formatQuantity(stock)}; months remaining ${monthsRemaining === "" ? "unavailable" : formatQuantity(monthsRemaining, 1)}; next-month order recommendation ${recommendation === "" ? "insufficient history" : `${formatQuantity(recommendation)} ${unit}`}`,
      ];
    });
}

function getAtelierExportRows(bounds) {
  const productCounts = new Map();
  reportData.orders.forEach((order) => {
    if (isCancelled(order) || !isWithinPeriod(parseOrderDate(order), bounds)) return;
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const name = String(item?.name || item?.productName || "Unspecified item");
      const quantity = Math.max(0, Number(item?.quantity) || 0);
      productCounts.set(name, (productCounts.get(name) || 0) + quantity);
    });
  });
  let rows = window.manualSortArray(
    [...productCounts.entries()],
    (first, second) => second[1] - first[1],
  )
    .map(([name, quantity]) => [
      "Product performance",
      name,
      quantity,
      `Units ordered · ${bounds.label}`,
    ]);
  rows = window.arrayWithAppended(
    rows,
    ["Production metrics", "Average custom-order turnaround", document.getElementById("average-turnaround").textContent, "Order received to production completion"],
    ["Production metrics", "Custom orders shipped", document.getElementById("custom-shipment-rate").textContent, document.getElementById("custom-shipment-count").textContent],
    ["Production metrics", "Current custom-order backlog", document.getElementById("custom-backlog-count").textContent, "Open custom order lines"],
  );
  document.querySelectorAll("#production-backlog-body tr").forEach((row) => {
    const cells = [...row.cells].map((cell) => cell.textContent.trim());
    if (cells.length === 3 && !cells[0].startsWith("No ")) {
      rows = window.arrayWithAppended(rows, [
        "Production backlog stage",
        cells[0],
        cells[1],
        `${cells[2]} of current backlog`,
      ]);
    }
  });
  return rows;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );
}

function createPdfTable(title, rows, period) {
  const body = rows
    .filter((row) => row[1] !== "")
    .map(
      ([category, metric, value, notes]) => `
        <tr>
          <td>${escapeHtml(metric || category)}</td>
          <td>${escapeHtml(value)}</td>
          <td>${escapeHtml(notes)}</td>
        </tr>`,
    )
    .join("");
  return `
    <section class="report-section">
      <h2>${escapeHtml(title)}</h2>
      <p class="report-period">Reporting period: ${escapeHtml(period)}</p>
      <table>
        <thead><tr><th>Metric</th><th>Value</th><th>Details</th></tr></thead>
        <tbody>${body || '<tr><td colspan="3">No report data available.</td></tr>'}</tbody>
      </table>
    </section>`;
}

function openPdfReport(sections, fileName) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    throw new Error("The report window was blocked. Allow pop-ups and try again.");
  }
  reportWindow.document.title = fileName;
  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(fileName)}</title>
        <style>
          * { box-sizing: border-box; }
          body { color: #211e1a; font: 12px Arial, sans-serif; margin: 32px auto; max-width: 960px; padding: 0 28px; }
          .report-header { border-bottom: 2px solid #51483f; margin-bottom: 26px; padding-bottom: 16px; }
          .brand { font: 700 21px Georgia, serif; letter-spacing: .08em; }
          .report-subtitle { color: #756d65; font-size: 10px; margin-top: 6px; }
          .report-section { margin: 0 0 30px; }
          .report-section + .report-section { border-top: 1px solid #ded9d1; padding-top: 20px; }
          h2 { font: 400 18px Georgia, serif; margin: 0 0 6px; }
          .report-period { color: #756d65; font-size: 10px; margin: 0 0 13px; }
          table { border-collapse: collapse; table-layout: fixed; width: 100%; }
          th, td { border: 1px solid #d9d3cb; padding: 8px 10px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
          th { background: #f2eee8; font-size: 10px; text-transform: uppercase; }
          td { font-size: 10px; line-height: 1.45; }
          th:nth-child(1), td:nth-child(1) { width: 30%; }
          th:nth-child(2), td:nth-child(2) { width: 20%; }
          th:nth-child(3), td:nth-child(3) { width: 50%; }
          .print-actions { margin: 24px 0; }
          .print-actions button { background: #4c463f; border: 0; color: #fff; cursor: pointer; font: 600 12px Arial, sans-serif; padding: 11px 16px; }
          @media print {
            body { margin: 0; max-width: none; padding: 0; }
            .print-actions { display: none; }
            .report-section + .report-section { break-before: page; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <header class="report-header">
          <div class="brand">JORJETTEANGEL</div>
          <div class="report-subtitle">Atelier Admin · Trends &amp; Analytics</div>
        </header>
        <main>${sections.join("")}</main>
        <div class="print-actions">
          <button type="button" onclick="window.print()">Print / Save as PDF</button>
        </div>
      </body>
    </html>`);
  reportWindow.document.close();
  reportWindow.focus();
}

function exportReport() {
  const selectedSections = [
    ...document.querySelectorAll('input[name="export-section"]:checked'),
  ].map((input) => input.value);
  const selectionError = document.getElementById("export-selection-error");
  if (!selectedSections.length) {
    selectionError.hidden = false;
    return;
  }
  selectionError.hidden = true;
  const bounds = getPeriodBounds();
  let pdfSections = [];
  let sectionNames = [];
  const months = buildMonthlySales();
  if (selectedSections.includes("financial")) {
    pdfSections = window.arrayWithAppended(
      pdfSections,
      createPdfTable(
        "Financial & Sales Reports",
        getFinancialExportRows(bounds, months),
        bounds.label,
      ),
    );
    sectionNames = window.arrayWithAppended(sectionNames, "financial-sales");
  }
  if (selectedSections.includes("materials")) {
    pdfSections = window.arrayWithAppended(
      pdfSections,
      createPdfTable(
        "Material Consumption & Inventory Reports",
        getMaterialExportRows(),
        "Last 90 days · Inventory snapshot",
      ),
    );
    sectionNames = window.arrayWithAppended(sectionNames, "material-inventory");
  }
  if (selectedSections.includes("atelier")) {
    pdfSections = window.arrayWithAppended(
      pdfSections,
      createPdfTable(
        "Product Performance & Production Metrics",
        getAtelierExportRows(bounds),
        bounds.label,
      ),
    );
    sectionNames = window.arrayWithAppended(sectionNames, "atelier-performance");
  }
  try {
    openPdfReport(
      pdfSections,
      `JORJETTEANGEL-${sectionNames.join("-")}.pdf`,
    );
    document.getElementById("exportDialog").close();
    const message = document.getElementById("exportMessage");
    message.textContent = `PDF report opened: ${sectionNames.join(", ")}. Use Print / Save as PDF to save it.`;
    message.hidden = false;
  } catch (error) {
    const message = document.getElementById("exportMessage");
    message.textContent =
      error instanceof Error ? error.message : "Could not open the PDF report.";
    message.hidden = false;
  }
}

selectedRange.addEventListener("change", renderReport);
document.getElementById("exportButton").addEventListener("click", () => {
  document.getElementById("export-selection-error").hidden = true;
  document.getElementById("exportDialog").showModal();
});
document.getElementById("cancelExport").addEventListener("click", () => {
  document.getElementById("exportDialog").close();
});
document.getElementById("confirmExport").addEventListener("click", exportReport);
window.addEventListener("storage", (event) => {
  if (
    event.key === null ||
    Object.values(REPORT_STORAGE_KEYS).includes(event.key)
  ) {
    loadReportData();
  }
});
window.addEventListener("fabricMaterialsUpdated", loadReportData);

loadReportData();
