// Displays and records system activity.

const AUDIT_CATALOG_KEY = "jorjetteangel-admin-catalog";
const AUDIT_ACTIVITY_KEY = "jorjetteangel-audit-activity";
const AUDIT_SESSION_KEY = "jorjetteangel-admin-session";
const AUDIT_MONITORED_SOURCES = {
  "jorjetteangel-admin-catalog": "Catalog",
  "jorjetteangel-orders": "Orders & Sales",
  "jorjetteangel-delivery-status": "Delivery",
  "jorjetteangel-production-tickets": "Atelier / Production",
  "jg-erp-fabrics-materials-v1": "Inventory",
  "jg-erp-purchase-orders-v2": "Purchasing",
  "jg-erp-purchase-restock-requests-v1": "Purchasing",
  "jg-erp-bom-recipes-v1": "BOM",
  "jg-erp-bom-operation-events-v1": "BOM",
  "jorjetteangel-staff-accounts": "Staff Accounts",
};
const auditTableBody = document.getElementById("audit-table-body");
const auditEmptyState = document.getElementById("noResult");
const auditSearchInput = document.getElementById("searchInput");
const userFilter = document.getElementById("userFilter");
const moduleFilter = document.getElementById("moduleFilter");
const alertsButton = document.getElementById("alertsButton");
const alertCount = document.getElementById("alertCount");
const auditErrorRegion = document.getElementById("audit-error");
let auditEntries = [];
let showAlertsOnly = false;

function readStoredJson(key, fallback) {
  const saved = window.backendMemoryStorage.getItem(key);
  return saved === null ? fallback : JSON.parse(saved);
}

function readAuditEntries() {
  const state = readStoredJson(AUDIT_CATALOG_KEY, { auditTrail: [] });
  const activity = readStoredJson(AUDIT_ACTIVITY_KEY, []);
  if (!state || !Array.isArray(state.auditTrail)) {
    throw new Error("The saved catalog audit history is not available.");
  }
  if (!Array.isArray(activity)) {
    throw new Error("The saved staff activity history is not available.");
  }
  const entriesById = new Map();
  [...state.auditTrail, ...activity].forEach((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.timestamp !== "string") {
      return;
    }
    const key = entry.id || `${entry.timestamp}:${entry.action}:${entry.entity}`;
    entriesById.set(key, entry);
  });
  return [...entriesById.values()];
}

function auditEntryModule(entry) {
  return String(entry.module || entry.entity || "System")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleForIdentity(roleValue, employeeIdValue) {
  const role = String(roleValue || "").trim().toLowerCase();
  const employeeId = String(employeeIdValue || "").trim().toUpperCase();
  if (role === "admin" || role === "administrator") return "Admin";
  if (
    role === "cashier" ||
    role.includes("acc-csh") ||
    employeeId.startsWith("ACC-CSH")
  ) {
    return "Cashier";
  }
  if (
    role === "warehouse" ||
    role === "warehouse manager" ||
    role.includes("acc-whs") ||
    employeeId.startsWith("ACC-WHS")
  ) {
    return "Warehouse";
  }
  if (
    ["production", "atelier", "atelier staff", "atelier/production"].includes(role) ||
    role.includes("acc-prd") ||
    employeeId.startsWith("ACC-PRD")
  ) {
    return "Atelier";
  }
  return "Unknown";
}

function auditEntryRole(entry) {
  const actor = entry.actor && typeof entry.actor === "object"
    ? entry.actor
    : entry.user && typeof entry.user === "object"
      ? entry.user
      : {};
  const actorIdentity =
    typeof entry.actor === "string"
      ? entry.actor
      : typeof entry.user === "string"
        ? entry.user
        : "";
  return roleForIdentity(
    entry.role || entry.userRole || actor.role || actorIdentity,
    entry.employeeId || entry.userId || actor.employeeId || actorIdentity,
  );
}

function auditEntryUser(entry) {
  const actor = entry.actor && typeof entry.actor === "object"
    ? entry.actor
    : entry.user && typeof entry.user === "object"
      ? entry.user
      : {};
  const employeeId = String(
    entry.employeeId || entry.userId || actor.employeeId || "",
  ).trim();
  const name =
    entry.actorName ||
    entry.userName ||
    entry.name ||
    actor.name ||
    (typeof entry.actor === "string" ? entry.actor : "") ||
    (typeof entry.user === "string" ? entry.user : "") ||
    [actor.firstName || entry.firstName, actor.lastName || entry.lastName]
      .filter(Boolean)
      .join(" ");
  if (name && employeeId && String(name) !== employeeId) {
    return `${name} · ${employeeId}`;
  }
  return String(name || employeeId || "Not recorded");
}

function auditEntryTarget(entry) {
  return String(
    entry.targetId ||
      entry.recordId ||
      entry.entityId ||
      entry.productId ||
      entry.orderId ||
      entry.orderReference ||
      entry.entity ||
      "Target not recorded",
  );
}

function auditEntrySeverity(entry) {
  const explicit = String(entry.severity || "").toLowerCase();
  if (/critical|crit|high/.test(explicit)) return "critical";
  if (/warning|warn|medium/.test(explicit)) return "warn";
  if (/info|informational|low/.test(explicit)) return "info";

  const actionText = `${entry.action || ""} ${entry.details || ""}`.toLowerCase();
  if (/manual.{0,20}(stock|inventory)|critical|unauthori[sz]ed|security breach/.test(actionText)) {
    return "critical";
  }
  if (/outside.{0,20}shift|failed login|login.{0,20}failed|suspicious|warning/.test(actionText)) {
    return "warn";
  }
  return "info";
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return String(timestamp);
  const parts = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("month")} ${part("day")}, ${part("hour")}:${part("minute")}${part("dayPeriod")[0]}`;
}

function createCell(className, content) {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = content;
  return cell;
}

function populateFilter(select, values, placeholder) {
  const previousValue = select.value;
  select.replaceChildren(new Option(placeholder, ""));
  values.forEach((value) => select.add(new Option(value, value)));
  if (values.includes(previousValue)) select.value = previousValue;
}

function refreshFilters() {
  const modules = window.manualSortArray([
    ...new Set(auditEntries.map(auditEntryModule)),
  ]);
  const users = window.manualSortArray([
    ...new Set(auditEntries.map(auditEntryUser)),
  ]);
  populateFilter(userFilter, users, "Filter by User ▼");
  populateFilter(moduleFilter, modules, "Filter by Module ▼");
}

function renderAuditRows() {
  const query = auditSearchInput.value.trim().toLowerCase();
  const visibleEntries = auditEntries.filter((entry) => {
    const severity = auditEntrySeverity(entry);
    const role = auditEntryRole(entry);
    const module = auditEntryModule(entry);
    const searchable = [
      auditEntryUser(entry),
      role,
      module,
      entry.action,
      entry.details,
      auditEntryTarget(entry),
      severity,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!userFilter.value || auditEntryUser(entry) === userFilter.value) &&
      (!moduleFilter.value || module === moduleFilter.value) &&
      (!showAlertsOnly || severity !== "info") &&
      (!query || searchable.includes(query))
    );
  });

  auditTableBody.replaceChildren();
  visibleEntries.forEach((entry) => {
    const row = document.createElement("tr");
    const severity = auditEntrySeverity(entry);
    const userCell = createCell(
      "user-cell",
      `${auditEntryUser(entry)}\n(${auditEntryRole(entry)})`,
    );
    const actionCell = document.createElement("td");
    actionCell.className = "action-cell";
    actionCell.append(
      document.createTextNode(String(entry.action || "Activity recorded")),
    );
    const targetId = document.createElement("span");
    targetId.className = "target-id";
    targetId.textContent = `[${auditEntryTarget(entry)}]`;
    actionCell.append(targetId);
    const severityCell = document.createElement("td");
    severityCell.className = `severity-cell severity-${severity}`;
    const badge = document.createElement("span");
    badge.className = "severity-badge";
    badge.setAttribute("aria-label", `${severity} severity`);
    badge.textContent = severity.toUpperCase();

    severityCell.append(badge);
    row.append(
      createCell("timestamp-cell", formatTimestamp(entry.timestamp)),
      userCell,
      actionCell,
      severityCell,
    );
    auditTableBody.append(row);
  });

  auditEmptyState.hidden = visibleEntries.length > 0;
  auditEmptyState.textContent = auditEntries.length
    ? "No log entries match these filters."
    : "No security log entries have been recorded yet.";
}

function refreshAuditTrail() {
  try {
    auditEntries = window.manualSortArray(
      readAuditEntries(),
      (first, second) =>
        new Date(second.timestamp).getTime() -
        new Date(first.timestamp).getTime(),
    );
    auditErrorRegion.hidden = true;
    refreshFilters();
    alertCount.textContent = String(
      auditEntries.filter((entry) => auditEntrySeverity(entry) !== "info").length,
    );
  } catch (error) {
    auditEntries = [];
    refreshFilters();
    alertCount.textContent = "0";
    auditErrorRegion.textContent = `Audit Trail could not load: ${error.message}`;
    auditErrorRegion.hidden = false;
  }
  renderAuditRows();
}

function currentActor() {
  try {
    const session = readStoredJson(AUDIT_SESSION_KEY, {});
    if (!session || typeof session !== "object") return {};
    return {
      employeeId: String(session.employeeId || "").trim(),
      actorName: [session.firstName, session.lastName].filter(Boolean).join(" "),
      role: roleForIdentity(session.role, session.employeeId),
    };
  } catch {
    return {};
  }
}

function readJsonValue(value) {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function recordActivity(entry) {
  try {
    let activity = readStoredJson(AUDIT_ACTIVITY_KEY, []);
    if (!Array.isArray(activity)) return;
    activity = window.arrayWithPrepended(activity, entry);
    window.backendMemoryStorage.setItem(AUDIT_ACTIVITY_KEY, JSON.stringify(activity.slice(0, 500)));
  } catch (error) {
    auditErrorRegion.textContent = `Staff activity could not be recorded: ${error.message}`;
    auditErrorRegion.hidden = false;
  }
}

function recordStorageChange(event) {
  if (!event.key || !AUDIT_MONITORED_SOURCES[event.key]) return;
  const actor = currentActor();
  const module = AUDIT_MONITORED_SOURCES[event.key];
  const oldData = readJsonValue(event.oldValue);
  const newData = readJsonValue(event.newValue);
  const now = new Date().toISOString();

  if (event.key === "jg-erp-bom-operation-events-v1") {
    const oldIds = new Set(
      Array.isArray(oldData)
        ? oldData.map((entry) => entry && entry.id).filter(Boolean)
        : [],
    );
    const newEvents = Array.isArray(newData)
      ? newData.filter((entry) => entry && !oldIds.has(entry.id))
      : [];
    if (newEvents.length) {
      newEvents.forEach((entry) => {
        recordActivity({
          id: entry.id || `bom-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          module,
          action: entry.title || entry.eventType || "BOM operation event",
          details: entry.message || "",
          targetId: entry.orderReference || entry.orderItemId || entry.productId,
          severity: entry.severity || "info",
          timestamp: entry.timestamp || now,
          employeeId: entry.employeeId || entry.userId || "",
          actorName: entry.actorName || entry.userName || "",
          role: entry.role || entry.userRole || "",
        });
      });
      return;
    }
  }

  if (event.key === AUDIT_CATALOG_KEY) {
    const oldIds = new Set(
      Array.isArray(oldData?.auditTrail)
        ? oldData.auditTrail.map((entry) => entry && entry.id).filter(Boolean)
        : [],
    );
    const addedEntries = Array.isArray(newData?.auditTrail)
      ? newData.auditTrail.filter((entry) => entry && !oldIds.has(entry.id))
      : [];
    if (addedEntries.length) {
      addedEntries.forEach((entry) => {
        recordActivity({
          ...actor,
          ...entry,
          id: entry.id || `catalog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          employeeId: entry.employeeId || entry.userId || actor.employeeId,
          actorName: entry.actorName || entry.userName || actor.actorName,
          role: entry.role || entry.userRole || actor.role,
          module: entry.module || entry.entity || module,
          targetId: entry.targetId || entry.entityId || entry.entity,
          timestamp: entry.timestamp || now,
        });
      });
      return;
    }
  }
  const action = event.newValue === null
    ? `Removed ${module} data`
    : event.oldValue === null
      ? `Created ${module} data`
      : `Updated ${module} data`;
  const targetId = getChangedRecordId(oldData, newData);
  recordActivity({
    id: `staff-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...actor,
    module,
    action,
    targetId,
    severity: "info",
    timestamp: now,
  });
}

function getChangedRecordId(oldData, newData) {
  const identifiers = [
    "id",
    "employeeId",
    "userId",
    "orderId",
    "productId",
    "ticketId",
    "requestId",
    "reference",
  ];
  const getIdentifier = (value) => {
    if (!value || typeof value !== "object") return "";
    if (Array.isArray(value) && value[0] !== undefined) return String(value[0]);
    for (const key of identifiers) {
      if (value[key] !== undefined && value[key] !== null) return String(value[key]);
    }
    return "";
  };
  const oldItems = Array.isArray(oldData) ? oldData : [oldData];
  const newItems = Array.isArray(newData) ? newData : [newData];
  const oldById = new Map(
    oldItems.map((item) => [getIdentifier(item), JSON.stringify(item)]),
  );
  const changedItem = newItems.find(
    (item) => getIdentifier(item) && oldById.get(getIdentifier(item)) !== JSON.stringify(item),
  );
  const removedItem = oldItems.find(
    (item) =>
      getIdentifier(item) &&
      !newItems.some((candidate) => getIdentifier(candidate) === getIdentifier(item)),
  );
  return getIdentifier(changedItem || removedItem) || "Shared module data";
}

userFilter.addEventListener("change", renderAuditRows);
moduleFilter.addEventListener("change", renderAuditRows);
auditSearchInput.addEventListener("input", renderAuditRows);
alertsButton.addEventListener("click", () => {
  showAlertsOnly = !showAlertsOnly;
  alertsButton.setAttribute("aria-pressed", String(showAlertsOnly));
  document.getElementById("alertsLabel").textContent = showAlertsOnly
    ? "ALERTS ONLY"
    : "ALERTS";
  renderAuditRows();
});

window.addEventListener("storage", (event) => {
  if (event.key === AUDIT_CATALOG_KEY || event.key === AUDIT_ACTIVITY_KEY) {
    refreshAuditTrail();
  } else {
    recordStorageChange(event);
  }
});

refreshAuditTrail();
