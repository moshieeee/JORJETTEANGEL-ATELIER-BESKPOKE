// Builds admin navigation, search, and notifications.

const GLOBAL_SEARCH_STORAGE_KEYS = {
  catalog: "jorjetteangel-admin-catalog",
  customers: "jorjetteangel-client-profiles",
  orders: "jorjetteangel-orders",
};
const ADMIN_AUTH_ENABLED = true;
const ADMIN_SESSION_KEY = "jorjetteangel-admin-session";
const PURCHASE_REQUESTS_STORAGE_KEY = "jg-erp-purchase-restock-requests-v1";
const PURCHASE_ORDERS_STORAGE_KEY = "jg-erp-purchase-orders-v2";
const SUPPLIER_DIRECTORY_STORAGE_KEY = "jg-erp-supplier-directory-v1";
const RAW_MATERIALS_STORAGE_KEY = "jg-erp-fabrics-materials-v1";
const ADMIN_ALERTS_STORAGE_KEY = "jorjetteangel-admin-alerts";
const BOM_OPERATION_EVENTS_STORAGE_KEY = "jg-erp-bom-operation-events-v1";
const PRODUCTION_DAILY_TARGET_KEY = "jg-erp-production-daily-target-v1";
const ADMIN_MODULES = {
  production: {
    title: "Production Management",
    description: "Production planning and workflow tools will be available here.",
  },
  "finished-goods": {
    title: "Finished Goods Inventory",
    description: "Finished goods inventory tools will be available here.",
  },
  "fabrics-bom": {
    title: "Fabrics and BOM Management",
    description: "Fabric and bill of materials tools will be available here.",
  },
  suppliers: {
    title: "Supplier Directory",
    description: "Supplier directory tools will be available here.",
  },
  purchasing: {
    title: "Purchasing and Restocking",
    description: "Review purchase requests and manage material restocking.",
  },
  "delivery-release": {
    title: "Delivery & Order Release",
    description: "Delivery and order release tools will be available here.",
  },
  "sales-payment": {
    title: "Sales & Payment Management",
    description: "Sales and payment tools will be available here.",
  },
  trends: {
    title: "Trends & Analytics",
    description: "Trends and analytics tools will be available here.",
  },
  users: {
    title: "User and Accounts",
    description: "User and account management tools will be available here.",
  },
  settings: {
    title: "Settings",
    description: "System settings will be available here.",
  },
};

const ADMIN_NAVIGATION_GROUPS = [
  {
    label: "Product",
    items: [
      {
        label: "Product management",
        href: "backend-ready-to-wear-admin.html",
        page: "catalog",
      },
      {
        label: "Product category",
        href: "backend-product-categories-admin.html",
        page: "categories",
      },
    ],
  },
  {
    label: "Production",
    items: [
      {
        label: "Production management",
        href: "backend-admin-module.html?module=production",
        module: "production",
      },
    ],
  },
  {
    label: "Sales & finance",
    items: [
      {
        label: "Order management",
        href: "backend-order-management-admin.html",
        page: "orders",
      },
      {
        label: "Sales & payment management",
        href: "backend-admin-module.html?module=sales-payment",
        module: "sales-payment",
      },
    ],
  },
  {
    label: "Supply chain & inventory",
    items: [
      {
        label: "Finished goods inventory",
        href: "backend-admin-module.html?module=finished-goods",
        module: "finished-goods",
      },
      {
        label: "Fabrics and bom management",
        href: "backend-admin-module.html?module=fabrics-bom",
        module: "fabrics-bom",
      },
      {
        label: "Supplier directory",
        href: "backend-admin-module.html?module=suppliers",
        module: "suppliers",
      },
      {
        label: "Purchasing and restocking",
        href: "backend-admin-module.html?module=purchasing",
        module: "purchasing",
      },
      {
        label: "Delivery & order release",
        href: "backend-admin-module.html?module=delivery-release",
        module: "delivery-release",
      },
    ],
  },
  {
    label: "Reports and analytics",
    items: [
      {
        label: "Trends & analytics",
        href: "backend-e-commerce-admin.html?view=trends",
        page: "dashboard",
        dashboardView: "trends",
      },
    ],
  },
  {
    label: "System & security",
    items: [
      {
        label: "Archived",
        href: "backend-e-commerce-admin.html?view=archive",
        page: "dashboard",
        dashboardView: "archive",
      },
      {
        label: "Audit trail",
        href: "backend-e-commerce-admin.html?view=audit-trail",
        page: "dashboard",
        dashboardView: "audit-trail",
      },
      {
        label: "User and accounts",
        href: "backend-admin-module.html?module=users",
        module: "users",
      },
      {
        label: "Settings",
        href: "backend-admin-module.html?module=settings",
        module: "settings",
      },
    ],
  },
];

function readAdminSession() {
  const savedSession = window.backendMemoryStorage.getItem(ADMIN_SESSION_KEY);
  if (!savedSession) return null;
  const session = JSON.parse(savedSession);
  return session && typeof session === "object" ? session : null;
}

let signedInAdminSession = null;

function getAdminRole(session = signedInAdminSession) {
  const role = String(session?.role || "").trim().toLowerCase();
  const employeeId = String(session?.employeeId || "").toLowerCase();
  if (
    /^acc-whs(?:-|$)/.test(role) ||
    /^acc-whs(?:-|$)/.test(employeeId) ||
    role === "warehouse manager" ||
    role === "warehouse"
  ) {
    return "warehouse";
  }
  if (
    /^acc-csh(?:-|$)/.test(role) ||
    /^acc-csh(?:-|$)/.test(employeeId) ||
    role === "cashier"
  ) {
    return "cashier";
  }
  if (
    /^acc-prd(?:-|$)/.test(role) ||
    /^acc-prd(?:-|$)/.test(employeeId) ||
    role === "production" ||
    role === "atelier staff"
  ) {
    return "production";
  }
  return role;
}

function showAccessDeniedToast() {
  if (!new URLSearchParams(window.location.search).has("accessDenied")) return;
  const toast = document.createElement("div");
  toast.className = "admin-access-denied-toast";
  toast.setAttribute("role", "status");
  toast.textContent = "Access Denied: You do not have permission to open that page.";
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 5000);

  const params = new URLSearchParams(window.location.search);
  params.delete("accessDenied");
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}

function renderAdminNavigation() {
  const navigation = document.querySelector(".admin-nav");
  if (!navigation) return;

  let adminSession;
  try {
    adminSession = readAdminSession();
  } catch (error) {
    console.error("Could not read the signed-in admin session.", error);
    adminSession = null;
  }
  signedInAdminSession = adminSession;

  if (ADMIN_AUTH_ENABLED && !adminSession) {
    window.location.replace("backend-login.html");
    return;
  }

  const role = getAdminRole(adminSession);
  const isCashier = role === "cashier";
  const isWarehouse = role === "warehouse";
  const isProduction = role === "production";
  const currentPage = document.body.dataset.page;
  const currentParameters = new URLSearchParams(window.location.search);
  const currentModule = currentParameters.get("module");
  const currentView = currentParameters.get("view");
  const cashierHasAccess =
    (currentPage === "dashboard" && !currentView && !currentModule) ||
    (currentPage === "dashboard" &&
      ["sales-payment", "orders", "settings"].includes(currentModule)) ||
    currentPage === "orders" ||
    (currentPage === "module" &&
      ["sales-payment", "settings"].includes(currentModule));
  if (isCashier && !cashierHasAccess) {
    window.location.replace("backend-e-commerce-admin.html?accessDenied=1");
    return;
  }
  const warehouseHasAccess =
    (currentPage === "dashboard" &&
      !currentView &&
      !window.location.hash &&
      (!currentModule ||
        [
          "finished-goods",
          "fabrics-bom",
          "suppliers",
          "purchasing",
          "delivery-release",
          "settings",
        ].includes(currentModule))) ||
    (currentPage === "module" &&
      [
        "finished-goods",
        "fabrics-bom",
        "suppliers",
        "purchasing",
        "delivery-release",
        "settings",
      ].includes(currentModule));
  if (
    isWarehouse &&
    !warehouseHasAccess
  ) {
    window.location.replace("backend-e-commerce-admin.html?accessDenied=1");
    return;
  }
  const productionHasAccess =
    (currentPage === "dashboard" &&
      !currentView &&
      !window.location.hash &&
      (!currentModule || ["production", "settings"].includes(currentModule))) ||
    (currentPage === "module" &&
      ["production", "settings"].includes(currentModule));
  if (isProduction && !productionHasAccess) {
    window.location.replace("backend-e-commerce-admin.html?accessDenied=1");
    return;
  }

  const isActive = (item) =>
    item.module
      ? currentModule === item.module
      : item.page === currentPage &&
        (!item.dashboardView || currentView === item.dashboardView) &&
        (!item.hash || window.location.hash === item.hash);

  const dashboard = document.createElement("a");
  dashboard.href = "backend-e-commerce-admin.html";
  dashboard.textContent = "Dashboard";
  if (
    currentPage === "dashboard" &&
    window.location.hash !== "#audit-trail" &&
    !["trends", "archive", "audit-trail"].includes(currentView)
  ) {
    dashboard.classList.add("active");
  }
  navigation.replaceChildren(dashboard);

  const visibleGroups = isProduction
    ? ADMIN_NAVIGATION_GROUPS.filter(
        (group) => group.label === "Production",
      )
    : isWarehouse
    ? ADMIN_NAVIGATION_GROUPS.filter(
        (group) => group.label === "Supply chain & inventory",
      )
    : isCashier
    ? ADMIN_NAVIGATION_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            (group.label === "Sales & finance" &&
              ["orders", "sales-payment"].some(
                (allowed) => item.page === allowed || item.module === allowed,
              )),
        ),
      })).filter((group) => group.items.length)
    : ADMIN_NAVIGATION_GROUPS;

  visibleGroups.forEach((group) => {
    const details = document.createElement("details");
    details.className = "admin-nav-group";
    const summary = document.createElement("summary");
    summary.textContent = group.label;
    const submenu = document.createElement("div");
    submenu.className = "admin-nav-submenu";
    let hasActiveItem = false;

    group.items.forEach((item) => {
      const link = document.createElement("a");
      link.href = adminShellHref(item);
      link.textContent = item.label;
      if (
        document.body.dataset.page !== "dashboard" &&
        window.parent !== window &&
        window.parent.document.body.dataset.page === "dashboard"
      ) {
        link.addEventListener("click", (event) => {
          const targetUrl = new URL(link.href, window.location.href);
          if (targetUrl.pathname.endsWith("backend-e-commerce-admin.html")) {
            event.preventDefault();
            window.parent.postMessage(
              {
                type: "admin-route",
                module: targetUrl.searchParams.get("module"),
                view: targetUrl.searchParams.get("view"),
              },
              "*",
            );
          }
        });
      }
      if (isActive(item)) {
        link.classList.add("active");
        hasActiveItem = true;
      }
      submenu.append(link);
    });

    details.open = hasActiveItem;
    details.append(summary, submenu);
    navigation.append(details);
  });

  const logout = document.createElement("button");
  logout.className = "admin-nav-logout";
  logout.type = "button";
  logout.textContent = "Log out";
  logout.addEventListener("click", () => {
    window.backendMemoryStorage.removeItem(ADMIN_SESSION_KEY);
    if (window.top !== window) {
      window.top.postMessage({ type: "admin-logout" }, "*");
      return;
    }
    window.location.replace("backend-login.html");
  });
  navigation.append(logout);
}

function adminShellHref(item) {
  if (item.module) {
    return `backend-e-commerce-admin.html?module=${encodeURIComponent(item.module)}`;
  }
  if (item.page === "catalog") {
    return "backend-e-commerce-admin.html?module=catalog";
  }
  if (item.page === "categories") {
    return "backend-e-commerce-admin.html?module=categories";
  }
  if (item.page === "orders") {
    return "backend-e-commerce-admin.html?module=orders";
  }
  if (item.dashboardView) {
    return `backend-e-commerce-admin.html?view=${encodeURIComponent(item.dashboardView)}`;
  }
  return item.href;
}

if (new URLSearchParams(window.location.search).has("embedded")) {
  document.documentElement.classList.add("embedded-module");
}

renderAdminNavigation();

function renderDashboardModule() {
  if (document.body.dataset.page !== "dashboard") return;

  const parameters = new URLSearchParams(window.location.search);
  const moduleKey = parameters.get("module");
  const viewKey = parameters.get("view");
  const moduleFrame = document.getElementById("dashboard-module-frame");
  if (!moduleFrame) return;

  if (!moduleKey && !["trends", "archive", "audit-trail"].includes(viewKey)) {
    moduleFrame.hidden = true;
    document.body.classList.remove("dashboard-module-view");
    document.querySelector(".admin-main").classList.remove(
      "admin-main-production",
    );
    document.querySelectorAll(".admin-main > :not(#dashboard-module-frame)")
      .forEach((element) => {
        element.hidden = false;
      });
    return;
  }

  const modulePaths = {
    production: "../modules/modules-production-management.html?embedded=1",
    "finished-goods":
      "../modules/modules-finished-goods-inventory.html?embedded=1",
    "fabrics-bom":
      "../modules/modules-fabric-and-bom-management.html?embedded=1",
    suppliers: "../modules/modules-supplier-management.html?embedded=1",
    purchasing: "../modules/modules-purchasing-restocking.html?embedded=1",
    "delivery-release":
      "../modules/modules-delivery-order-release.html?embedded=1",
    "sales-payment":
      "../modules/modules-sales-payment-management.html?embedded=1",
    trends: "../modules/modules-trends-and-analytics.html?embedded=1",
    users: "../modules/modules-user-accounts.html?embedded=1",
    settings:
      ["cashier", "warehouse", "production"].includes(getAdminRole())
        ? "../modules/modules-cashier-profile.html?embedded=1"
        : "../modules/modules-system-settings.html?embedded=1",
    catalog: "backend-ready-to-wear-admin.html?embedded=1",
    categories: "backend-product-categories-admin.html?embedded=1",
    orders: "backend-order-management-admin.html?embedded=1",
    archived: "backend-archived-catalog-admin.html?embedded=1",
    "view:archive": "../modules/modules-archive.html?embedded=1",
    "view:audit-trail": "../modules/modules-audit-trail.html?embedded=1",
    "view:trends": "../modules/modules-trends-and-analytics.html?embedded=1",
  };
  const routeKey = moduleKey || `view:${viewKey}`;
  const modulePath = modulePaths[routeKey];
  if (!modulePath) {
    throw new Error(`Unknown admin module: ${routeKey}`);
  }

  document.querySelectorAll(".admin-main > :not(#dashboard-module-frame)")
    .forEach((element) => {
      element.hidden = true;
    });
  document.body.classList.add("dashboard-module-view");
  document.querySelector(".admin-main").classList.add(
    "admin-main-production",
  );
  moduleFrame.title = moduleKey || viewKey;
  moduleFrame.hidden = false;
  if (moduleFrame.getAttribute("src") !== modulePath) {
    moduleFrame.src = modulePath;
  }
}

renderDashboardModule();
window.addEventListener("popstate", () => {
  renderAdminNavigation();
  renderDashboardModule();
});
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element
    ? event.target.closest(".admin-nav a")
    : null;
  if (!link || document.body.dataset.page !== "dashboard") return;

  const targetUrl = new URL(link.href, window.location.href);
  if (targetUrl.pathname !== window.location.pathname) return;

  event.preventDefault();
  window.history.pushState(null, "", `${targetUrl.pathname}${targetUrl.search}`);
  renderAdminNavigation();
  renderDashboardModule();
});
window.addEventListener("message", (event) => {
  if (
    event.source !==
      document.getElementById("dashboard-module-frame")?.contentWindow ||
    event.data?.type !== "admin-route" ||
    (typeof event.data.module !== "string" &&
      typeof event.data.view !== "string")
  ) {
    return;
  }
  const targetUrl = new URL(window.location.href);
  targetUrl.search = event.data.module
    ? `?module=${encodeURIComponent(event.data.module)}`
    : `?view=${encodeURIComponent(event.data.view)}`;
  targetUrl.hash = "";
  window.history.pushState(null, "", targetUrl);
  renderAdminNavigation();
  renderDashboardModule();
});

function renderAdminModulePlaceholder() {
  if (document.body.dataset.page !== "module") return;

  const moduleKey = new URLSearchParams(window.location.search).get("module");
  const module = ADMIN_MODULES[moduleKey];
  if (!module) {
    throw new Error(`Unknown admin module: ${moduleKey || "(missing)"}`);
  }

  document.title = `Atelier Admin | ${module.title}`;
  document.getElementById("module-kicker").textContent =
    `Backend / ${module.title}`;
  document.getElementById("module-title").textContent = module.title;
  document.getElementById("module-description").textContent =
    module.description;

  if (
    moduleKey === "production" ||
    moduleKey === "finished-goods" ||
    moduleKey === "fabrics-bom" ||
    moduleKey === "suppliers" ||
    moduleKey === "purchasing" ||
    moduleKey === "delivery-release" ||
    moduleKey === "sales-payment" ||
    moduleKey === "trends" ||
    moduleKey === "users" ||
    moduleKey === "settings"
  ) {
    document.getElementById("module-topbar").hidden = true;
    document.querySelector(".admin-panel").hidden = true;
    const moduleFrame = document.getElementById("admin-module-frame");
    document.querySelector(".admin-main").classList.add(
      "admin-main-production",
    );
    moduleFrame.title = module.title;
    const modulePaths = {
      production: "../modules/modules-production-management.html?embedded=1",
      "finished-goods":
        "../modules/modules-finished-goods-inventory.html?embedded=1",
      "fabrics-bom":
        "../modules/modules-fabric-and-bom-management.html?embedded=1",
      suppliers: "../modules/modules-supplier-management.html?embedded=1",
      purchasing: "../modules/modules-purchasing-restocking.html?embedded=1",
      "delivery-release":
        "../modules/modules-delivery-order-release.html?embedded=1",
      "sales-payment":
        "../modules/modules-sales-payment-management.html?embedded=1",
      trends: "../modules/modules-trends-and-analytics.html?embedded=1",
      users: "../modules/modules-user-accounts.html?embedded=1",
      settings:
        ["cashier", "warehouse", "production"].includes(getAdminRole())
          ? "../modules/modules-cashier-profile.html?embedded=1"
          : "../modules/modules-system-settings.html?embedded=1",
    };
    moduleFrame.src = modulePaths[moduleKey];
    moduleFrame.hidden = false;
  }
}

renderAdminModulePlaceholder();

const globalAdminHeader = document.createElement("header");
globalAdminHeader.className = "global-admin-header";
globalAdminHeader.innerHTML = `
  <div class="global-admin-welcome">Welcome, <strong id="global-admin-identity">Admin</strong></div>
  <div class="global-admin-tools">
    <div class="global-admin-search-wrap">
      <svg class="global-admin-search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="10.8" cy="10.8" r="6.3" />
        <path d="m16 16 4.5 4.5" />
      </svg>
      <label class="sr-only" for="global-admin-search">Search all admin data</label>
      <input
        class="global-admin-search"
        id="global-admin-search"
        type="search"
        placeholder="Search the system"
        autocomplete="off"
        aria-controls="global-admin-search-results"
        aria-expanded="false"
      />
      <div
        class="global-admin-search-results hidden"
        id="global-admin-search-results"
        role="listbox"
        aria-label="System search results"
      ></div>
      <span class="sr-only" id="global-admin-search-status" aria-live="polite"></span>
    </div>
    <div class="global-admin-notifications">
      <button
        class="admin-notification-button"
        id="global-admin-notification-button"
        type="button"
        aria-label="Show notifications"
        aria-expanded="false"
        aria-controls="global-admin-notification-panel"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span class="admin-notification-count hidden" id="global-admin-notification-count" aria-hidden="true"></span>
      </button>
      <section
        class="admin-notification-panel global-admin-notification-panel hidden"
        id="global-admin-notification-panel"
        aria-label="Notifications"
        aria-live="polite"
      >
        <div class="admin-notification-heading"><h2>Notifications</h2></div>
        <p class="admin-notification-summary" id="global-admin-notification-summary"></p>
        <div class="admin-notification-list" id="global-admin-notification-list"></div>
      </section>
    </div>
    ${
      ["cashier", "warehouse", "production"].includes(getAdminRole())
        ? `<details class="global-admin-profile-menu">
            <summary aria-label="Open account settings">Account</summary>
            <div class="global-admin-profile-dropdown">
              <a href="backend-admin-module.html?module=settings">My Profile &amp; Password</a>
            </div>
          </details>`
        : ""
    }
  </div>`;

const adminShell = document.querySelector(".admin-shell");
const adminMain = adminShell?.querySelector(".admin-main");

if (adminShell && adminMain) {
  if (
    getAdminRole() === "warehouse" &&
    document.body.dataset.page === "dashboard"
  ) {
    globalAdminHeader.querySelector(".global-admin-search-wrap").hidden = true;
    [...adminMain.children].forEach((child) => {
      if (child.tagName !== "H1") child.hidden = true;
    });
    const warehouseHome = document.createElement("section");
    warehouseHome.className = "warehouse-only-home";
    const description = document.createElement("p");
    description.textContent =
      "Supplier receipts update raw-material inventory when recorded by Purchasing.";
    warehouseHome.append(description);
    adminMain.append(warehouseHome);
  }
  if (
    getAdminRole() === "production" &&
    document.body.dataset.page === "dashboard"
  ) {
    globalAdminHeader.querySelector(".global-admin-search-wrap").hidden = true;
    [...adminMain.children].forEach((child) => {
      if (child.tagName !== "H1") child.hidden = true;
    });
    const productionHome = document.createElement("section");
    productionHome.className = "production-only-dashboard";
    productionHome.setAttribute(
      "aria-labelledby",
      "production-dashboard-heading",
    );
    const heading = document.createElement("h2");
    heading.id = "production-dashboard-heading";
    heading.textContent = "Daily sewing progress";
    const description = document.createElement("p");
    description.className = "production-dashboard-description";
    description.textContent =
      "Track today's sewing target against production tickets marked Ready for Delivery.";
    const targetLabel = document.createElement("label");
    targetLabel.className = "production-dashboard-target";
    targetLabel.htmlFor = "production-daily-target";
    targetLabel.append(document.createTextNode("Today's sewing target"));
    const targetInput = document.createElement("input");
    targetInput.id = "production-daily-target";
    targetInput.type = "number";
    targetInput.min = "1";
    targetInput.step = "1";
    targetInput.inputMode = "numeric";
    targetInput.setAttribute("aria-describedby", "production-target-help");
    targetLabel.append(targetInput);
    const saveTarget = document.createElement("button");
    saveTarget.type = "button";
    saveTarget.className = "production-dashboard-save";
    saveTarget.textContent = "Save target";
    const targetHelp = document.createElement("span");
    targetHelp.id = "production-target-help";
    targetHelp.className = "production-dashboard-help";
    targetHelp.textContent = "Set today's ticket target to track completion.";
    const progress = document.createElement("p");
    progress.className = "production-dashboard-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Today's sewing target progress");
    const cards = document.createElement("div");
    cards.className = "production-dashboard-cards";
    const metricValues = new Map();
    [
      ["completed", "Ready for delivery today"],
      ["in-progress", "In production"],
      ["pending", "Pending tickets"],
    ].forEach(([key, label]) => {
      const card = document.createElement("article");
      card.className = "production-dashboard-card";
      const value = document.createElement("strong");
      value.textContent = "0";
      const caption = document.createElement("span");
      caption.textContent = label;
      card.append(value, caption);
      cards.append(card);
      metricValues.set(key, value);
    });
    productionHome.append(
      heading,
      description,
      targetLabel,
      saveTarget,
      targetHelp,
      progress,
      cards,
    );
    adminMain.append(productionHome);

    const getToday = () => {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    const renderProductionDashboard = () => {
      const today = getToday();
      let target = 0;
      try {
        const savedTarget = window.backendMemoryStorage.getItem(PRODUCTION_DAILY_TARGET_KEY);
        const targetRecord = savedTarget ? JSON.parse(savedTarget) : null;
        if (targetRecord && targetRecord.date === today) {
          target = Number(targetRecord.target) || 0;
        }
      } catch (error) {
        console.error("Could not load today's production target.", error);
      }
      targetInput.value = target > 0 ? String(target) : "";

      let tickets;
      try {
        const savedOrders = window.backendMemoryStorage.getItem(
          GLOBAL_SEARCH_STORAGE_KEYS.orders,
        );
        tickets = savedOrders ? JSON.parse(savedOrders) : [];
        if (
          !Array.isArray(tickets) ||
          tickets.some(
            (order) =>
              !order ||
              typeof order !== "object" ||
              (order.items !== undefined && !Array.isArray(order.items)),
          )
        ) {
          throw new Error("Saved production orders have an invalid format.");
        }
      } catch (error) {
        console.error(
          "Could not load production tickets for the dashboard.",
          error,
        );
        progress.textContent = "Production progress could not be loaded.";
        return;
      }
      let completedToday = 0;
      let inProduction = 0;
      let pending = 0;
      tickets.forEach((order) => {
        if (!Array.isArray(order.items)) return;
        order.items.forEach((ticket) => {
          if (!ticket || typeof ticket !== "object") return;
          const status = String(ticket.productionStatus || "").trim().toLowerCase();
          if (status === "ready for delivery" || status === "completed") {
            const completedDate = new Date(
              ticket.productionCompletionDate || "",
            );
            if (
              !Number.isNaN(completedDate.getTime()) &&
              getLocalDateKey(completedDate) === today
            ) {
              completedToday += 1;
            }
          } else if (status === "in production" || status === "cutting") {
            inProduction += 1;
          } else if (
            ["received", "pending", "pending production"].includes(status) ||
            !status
          ) {
            pending += 1;
          }
        });
      });
      metricValues.get("completed").textContent = String(completedToday);
      metricValues.get("in-progress").textContent = String(inProduction);
      metricValues.get("pending").textContent = String(pending);
      progress.textContent =
        target > 0
          ? `${completedToday} of ${target} sewing tickets completed today`
          : "Set today's target to start tracking sewing progress.";
      progress.setAttribute(
        "aria-valuenow",
        String(target > 0 ? Math.min(completedToday, target) : 0),
      );
      progress.setAttribute("aria-valuemax", String(target || 1));
    };
    const getLocalDateKey = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    saveTarget.addEventListener("click", () => {
      const target = Number(targetInput.value);
      if (!Number.isInteger(target) || target < 1) {
        targetHelp.textContent =
          "Enter a whole-number target greater than zero.";
        targetInput.focus();
        return;
      }
      try {
        window.backendMemoryStorage.setItem(
          PRODUCTION_DAILY_TARGET_KEY,
          JSON.stringify({ date: getToday(), target }),
        );
        targetHelp.textContent = "Today's sewing target is saved.";
        renderProductionDashboard();
      } catch (error) {
        console.error("Could not save today's production target.", error);
        targetHelp.textContent = "Today's target could not be saved.";
      }
    });
    renderProductionDashboard();
    window.addEventListener("storage", (event) => {
      if (
        event.key === GLOBAL_SEARCH_STORAGE_KEYS.orders ||
        event.key === PRODUCTION_DAILY_TARGET_KEY ||
        event.key === null
      ) {
        renderProductionDashboard();
      }
    });
  }
  adminShell.insertBefore(globalAdminHeader, adminMain);
} else {
  document.body.prepend(globalAdminHeader);
}
showAccessDeniedToast();

try {
  const savedSession = window.backendMemoryStorage.getItem(ADMIN_SESSION_KEY);
  if (savedSession) {
    const adminSession = JSON.parse(savedSession);
    const firstName =
      typeof adminSession.firstName === "string"
        ? adminSession.firstName.trim()
        : "";
    const role =
      typeof adminSession.role === "string" ? adminSession.role.trim() : "";
    const normalizedRole = getAdminRole(adminSession);
    const displayRole =
      normalizedRole === "warehouse"
        ? "Warehouse"
        : normalizedRole === "cashier"
          ? "Cashier"
          : normalizedRole === "production"
            ? "Atelier Staff"
          : role
            ? `${role.charAt(0).toUpperCase()}${role.slice(1)}`
            : "";
    const identityElement = document.getElementById("global-admin-identity");
    if (identityElement && (firstName || displayRole)) {
      identityElement.textContent =
        firstName && displayRole
          ? `${firstName} (${displayRole})`
          : firstName || displayRole;
    }
  }
} catch (error) {
  console.error("Could not read the signed-in admin identity.", error);
}

const globalSearchInput = document.getElementById("global-admin-search");
const globalSearchResults = document.getElementById(
  "global-admin-search-results",
);
const globalSearchStatus = document.getElementById("global-admin-search-status");
const globalNotificationButton = document.getElementById(
  "global-admin-notification-button",
);
const globalNotificationCount = document.getElementById(
  "global-admin-notification-count",
);
const globalNotificationPanel = document.getElementById(
  "global-admin-notification-panel",
);
const globalNotificationList = document.getElementById(
  "global-admin-notification-list",
);
const globalNotificationSummary = document.getElementById(
  "global-admin-notification-summary",
);
const globalNotificationWrap = document.querySelector(
  ".global-admin-notifications",
);
let knownCashierRequestIds = new Set();
let knownCashierPurchaseOrderIds = new Set();
let cashierNotificationsInitialized = false;
let knownAdminAlertIds = new Set();
let newOrderExpiryTimeout;

function readStoredValue(key) {
  const saved = window.backendMemoryStorage.getItem(key);
  return saved ? JSON.parse(saved) : [];
}

function readStoredArray(key) {
  const value = readStoredValue(key);
  if (!Array.isArray(value)) {
    throw new Error(`Saved data at ${key} must be an array.`);
  }
  return value.filter((item) => item && typeof item === "object");
}

function readCatalog() {
  const catalog = readStoredValue(GLOBAL_SEARCH_STORAGE_KEYS.catalog);
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error("Saved catalog data is invalid.");
  }
  for (const key of ["products", "categories", "auditTrail"]) {
    if (!Array.isArray(catalog[key])) {
      throw new Error(`Saved catalog ${key} must be an array.`);
    }
  }
  return catalog;
}

function createSearchIndex() {
  let results = [];
  const catalog = readCatalog();
  const categoryNames = new Map(
    catalog.categories.map((category) => [category.id, category.name]),
  );

  catalog.products.forEach((product) => {
    const archived = product.status === "Archived";
    results = window.arrayWithAppended(results, {
      type: archived ? "Archived product" : "Product",
      title: product.name || "Unnamed product",
      description: [
        categoryNames.get(product.categoryId),
        product.description,
        product.price === undefined ? "" : `PHP ${product.price}`,
        product.status,
      ]
        .filter(Boolean)
        .join(" · "),
      href: archived
        ? "backend-archived-catalog-admin.html#archived-catalog-body"
        : "backend-ready-to-wear-admin.html#catalog-body",
      searchText: JSON.stringify(product),
    });
  });

  catalog.categories.forEach((category) => {
    const archived = category.status === "Archived";
    results = window.arrayWithAppended(results, {
      type: archived ? "Archived category" : "Category",
      title: category.name || "Unnamed category",
      description: category.status || "Active",
      href: archived
        ? "backend-archived-catalog-admin.html#archived-category-body"
        : "backend-e-commerce-admin.html#category-list",
      searchText: JSON.stringify(category),
    });
  });

  readStoredArray(GLOBAL_SEARCH_STORAGE_KEYS.customers).forEach((customer) => {
    results = window.arrayWithAppended(results, {
      type: "Customer",
      title:
        [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
        customer.email ||
        "Customer",
      description: [customer.email, customer.mobile, customer.preference]
        .filter(Boolean)
        .join(" · "),
      href: "backend-e-commerce-admin.html#customer-accounts",
      searchText: JSON.stringify(customer),
    });
  });

  readStoredArray(GLOBAL_SEARCH_STORAGE_KEYS.orders).forEach((order) => {
    results = window.arrayWithAppended(results, {
      type: "Order",
      title: `Order ${order.reference || ""}`.trim(),
      description: [
        order.customer?.name,
        order.customer?.email,
        order.status,
        order.total === undefined ? "" : `PHP ${order.total}`,
      ]
        .filter(Boolean)
        .join(" · "),
      href: "backend-e-commerce-admin.html#incoming-orders",
      searchText: JSON.stringify(order),
    });
  });

  catalog.auditTrail.forEach((entry) => {
    results = window.arrayWithAppended(results, {
      type: "Audit entry",
      title: entry.action || "Admin activity",
      description: [entry.entity, entry.details, entry.timestamp]
        .filter(Boolean)
        .join(" · "),
      href: "backend-e-commerce-admin.html?view=audit-trail",
      searchText: JSON.stringify(entry),
    });
  });

  return results;
}

function closeGlobalSearch() {
  globalSearchResults.classList.add("hidden");
  globalSearchInput.setAttribute("aria-expanded", "false");
}

function renderGlobalSearch() {
  const query = globalSearchInput.value.trim().toLocaleLowerCase();
  globalSearchResults.replaceChildren();
  if (!query) {
    globalSearchStatus.textContent = "";
    closeGlobalSearch();
    return;
  }

  try {
    const matches = createSearchIndex()
      .filter(
        (record) =>
          String(signedInAdminSession?.role || "").toLowerCase() !==
            "cashier" ||
          record.type === "Order",
      )
      .filter((record) =>
        `${record.type} ${record.title} ${record.description} ${record.searchText}`
          .toLocaleLowerCase()
          .includes(query),
      )
      .slice(0, 40);

    globalSearchStatus.textContent = `${matches.length} system search results`;
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "global-admin-search-empty";
      empty.textContent = "No matching records found.";
      globalSearchResults.append(empty);
    } else {
      matches.forEach((match) => {
        const link = document.createElement("a");
        link.className = "global-admin-search-result";
        link.href = match.href;
        link.setAttribute("role", "option");
        const type = document.createElement("span");
        type.className = "global-admin-search-type";
        type.textContent = match.type;
        const title = document.createElement("strong");
        title.textContent = match.title;
        const description = document.createElement("span");
        description.className = "global-admin-search-description";
        description.textContent = match.description || "No additional details";
        link.append(type, title, description);
        link.addEventListener("click", closeGlobalSearch);
        globalSearchResults.append(link);
      });
      if (matches.length === 40) {
        const limitNote = document.createElement("p");
        limitNote.className = "global-admin-search-empty";
        limitNote.textContent = "Showing the first 40 matches.";
        globalSearchResults.append(limitNote);
      }
    }
    globalSearchResults.classList.remove("hidden");
    globalSearchInput.setAttribute("aria-expanded", "true");
  } catch (error) {
    console.error("Could not search admin system data.", error);
    globalSearchStatus.textContent = "System search is unavailable.";
    const errorState = document.createElement("p");
    errorState.className = "global-admin-search-empty";
    errorState.textContent = "Could not load system search data.";
    globalSearchResults.append(errorState);
    globalSearchResults.classList.remove("hidden");
    globalSearchInput.setAttribute("aria-expanded", "true");
  }
}

function closeGlobalNotifications() {
  globalNotificationPanel.classList.add("hidden");
  globalNotificationButton.setAttribute("aria-expanded", "false");
}

function readCashierPurchaseRequests() {
  const saved = window.backendMemoryStorage.getItem(PURCHASE_REQUESTS_STORAGE_KEY);
  const requests = saved === null ? [] : JSON.parse(saved);
  if (!Array.isArray(requests)) {
    throw new Error("Saved material purchase requests must be a list.");
  }
  return requests.filter(
    (request) =>
      request &&
      typeof request === "object" &&
      typeof request.id === "string" &&
      typeof request.materialSku === "string" &&
      (request.status === "Requested" ||
        request.status === "Waiting for Cashier Approval"),
  );
}

function readCashierPurchaseOrders() {
  return readPurchaseArray(
    PURCHASE_ORDERS_STORAGE_KEY,
    "purchase orders",
  ).filter(
    (order) =>
      Array.isArray(order) &&
      ["Pending Approval", "Waiting for Cashier Approval"].includes(order[5]),
  );
}

function reviewCashierPurchaseOrder(purchaseOrderId, approved) {
  if (getAdminRole() !== "cashier") {
    throw new Error("Only a cashier can review purchase requests.");
  }
  const purchaseOrders = readPurchaseArray(
    PURCHASE_ORDERS_STORAGE_KEY,
    "purchase orders",
  );
  const order = purchaseOrders.find(
    (entry) => Array.isArray(entry) && String(entry[0]) === String(purchaseOrderId),
  );
  if (
    !order ||
    !["Pending Approval", "Waiting for Cashier Approval"].includes(order[5])
  ) {
    throw new Error("This purchase request is no longer awaiting cashier approval.");
  }
  const reviewer =
    [signedInAdminSession?.firstName, signedInAdminSession?.lastName]
      .filter((part) => typeof part === "string" && part.trim())
      .join(" ") || "Cashier";
  order[5] = approved ? "Waiting for Delivery" : "Rejected";
  order[15] = reviewer;
  order[16] = new Date().toISOString();
  window.backendMemoryStorage.setItem(
    PURCHASE_ORDERS_STORAGE_KEY,
    JSON.stringify(purchaseOrders),
  );
}

function readPurchaseArray(storageKey, label) {
  const saved = window.backendMemoryStorage.getItem(storageKey);
  const records = saved === null ? [] : JSON.parse(saved);
  if (!Array.isArray(records)) {
    throw new Error(`Saved ${label} data must be a list.`);
  }
  return records;
}

function acknowledgeAdminAlert(alertId) {
  const alerts = readPurchaseArray(
    ADMIN_ALERTS_STORAGE_KEY,
    "admin alerts",
  );
  const alert = alerts.find((entry) => entry && entry.id === alertId);
  if (!alert) throw new Error("This notification is no longer available.");
  if (alert.acknowledged) return;
  const acknowledgedAt = new Date().toISOString();
  const nextAlerts = alerts.map((entry) =>
    entry && entry.id === alertId
      ? { ...entry, acknowledged: true, acknowledgedAt }
      : entry,
  );

  const previousAlerts = window.backendMemoryStorage.getItem(ADMIN_ALERTS_STORAGE_KEY);
  const previousEvents = window.backendMemoryStorage.getItem(
    BOM_OPERATION_EVENTS_STORAGE_KEY,
  );
  let nextEvents = null;
  if (alert.type === "bom.missing_recipe") {
    nextEvents = readPurchaseArray(
      BOM_OPERATION_EVENTS_STORAGE_KEY,
      "BOM operation events",
    ).map((entry) =>
      entry && entry.id === alertId
        ? { ...entry, acknowledged: true, acknowledgedAt }
        : entry,
    );
  }
  try {
    window.backendMemoryStorage.setItem(ADMIN_ALERTS_STORAGE_KEY, JSON.stringify(nextAlerts));
    if (nextEvents) {
      window.backendMemoryStorage.setItem(
        BOM_OPERATION_EVENTS_STORAGE_KEY,
        JSON.stringify(nextEvents),
      );
    }
  } catch {
    [
      [ADMIN_ALERTS_STORAGE_KEY, previousAlerts],
      [BOM_OPERATION_EVENTS_STORAGE_KEY, previousEvents],
    ].forEach(([key, previousValue]) => {
      try {
        if (previousValue === null) window.backendMemoryStorage.removeItem(key);
        else window.backendMemoryStorage.setItem(key, previousValue);
      } catch (rollbackError) {
        console.error(
          `Could not roll back ${key} after alert acknowledgment failed.`,
          rollbackError,
        );
      }
    });
    throw new Error("The notification could not be acknowledged.");
  }
}

function findMatchingPurchaseSuppliers(request, suppliers) {
  const materialText = `${request.materialName || ""} ${request.materialSku || ""}`
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return suppliers.filter((supplier) => {
    if (
      !Array.isArray(supplier) ||
      !supplier[0] ||
      !supplier[1] ||
      String(supplier[6] || "Active").toLocaleLowerCase() !== "active"
    ) {
      return false;
    }
    const suppliedMaterials = String(supplier[5] || "")
      .split(/[,;/|]+/)
      .map((material) =>
        material.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
      )
      .filter(Boolean);
    return suppliedMaterials.some(
      (material) =>
        materialText.includes(material) || material.includes(materialText),
    );
  });
}

function approveCashierPurchaseRequest(requestId, supplierId) {
  if (getAdminRole() !== "cashier") {
    throw new Error("Only a cashier can approve material purchase requests.");
  }
  const requests = readPurchaseArray(
    PURCHASE_REQUESTS_STORAGE_KEY,
    "material purchase requests",
  );
  const purchaseOrders = readPurchaseArray(
    PURCHASE_ORDERS_STORAGE_KEY,
    "purchase orders",
  );
  const suppliers = readPurchaseArray(
    SUPPLIER_DIRECTORY_STORAGE_KEY,
    "supplier directory",
  );
  const archivedSuppliers = readPurchaseArray(
    "jorjetteangel-system-archive",
    "system archive",
  );
  const materials = readPurchaseArray(
    RAW_MATERIALS_STORAGE_KEY,
    "raw materials",
  );
  const request = requests.find(
    (entry) => entry && entry.id === requestId,
  );
  if (
    !request ||
    !["Requested", "Waiting for Cashier Approval"].includes(request.status)
  ) {
    throw new Error("This request is no longer awaiting cashier approval.");
  }
  if (
    purchaseOrders.some(
      (order) => Array.isArray(order) && order[11] === requestId,
    )
  ) {
    throw new Error("A purchase order has already been created for this request.");
  }
  const supplier = suppliers.find(
    (entry) =>
      Array.isArray(entry) &&
      String(entry[0]) === String(supplierId) &&
      String(entry[6] || "Active").toLocaleLowerCase() === "active" &&
      !archivedSuppliers.some(
        (archived) =>
          archived &&
          archived.type === "suppliers" &&
          String(archived.recordId) === String(entry[0]),
      ),
  );
  if (!supplier) {
    throw new Error("Select an active supplier from the Supplier Directory.");
  }
  const material = materials.find(
    (entry) => Array.isArray(entry) && String(entry[0]) === request.materialSku,
  );
  if (!material) {
    throw new Error(
      "The requested material is no longer in Fabrics & BOM inventory.",
    );
  }
  const quantity = Number(request.requestedQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("The request must have a quantity greater than zero.");
  }
  const lastNumber = purchaseOrders.reduce((maximum, order) => {
    const match = String(Array.isArray(order) ? order[0] : "").match(
      /^PO-REQ-(\d{4,})$/,
    );
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  const purchaseOrderId =
    "PO-REQ-" + String(lastNumber + 1).padStart(4, "0");
  const today = new Date().toISOString().slice(0, 10);
  const cost = Number(material[6]) || 0;
  const purchaseOrder = [
    purchaseOrderId,
    supplier[0],
    supplier[1],
    new Date(today + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    }),
    quantity * cost,
    "Waiting for Delivery",
    [[request.materialSku, request.materialName, quantity, request.unit || material[5] || "Units", cost, 0, false]],
    "",
    request.requestedBy || "Inventory staff",
    "",
    "",
    requestId,
  ];
  const identity =
    [signedInAdminSession.firstName, signedInAdminSession.lastName]
      .filter((part) => typeof part === "string" && part.trim())
      .join(" ") || "Cashier";
  request.status = "Approved";
  request.purchaseOrderId = purchaseOrderId;
  request.supplierId = supplier[0];
  request.supplierName = supplier[1];
  request.reviewedBy = identity;
  request.reviewedAt = new Date().toISOString();

  const previousOrders = window.backendMemoryStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY);
  try {
    window.backendMemoryStorage.setItem(
      PURCHASE_ORDERS_STORAGE_KEY,
      JSON.stringify([purchaseOrder, ...purchaseOrders]),
    );
    window.backendMemoryStorage.setItem(
      PURCHASE_REQUESTS_STORAGE_KEY,
      JSON.stringify(requests),
    );
  } catch (error) {
    try {
      if (previousOrders === null) {
        window.backendMemoryStorage.removeItem(PURCHASE_ORDERS_STORAGE_KEY);
      } else {
        window.backendMemoryStorage.setItem(PURCHASE_ORDERS_STORAGE_KEY, previousOrders);
      }
    } catch (rollbackError) {
      console.error("Could not roll back a failed purchase-order approval.", rollbackError);
    }
    throw new Error("The purchase order approval could not be saved.");
  }
}

function renderGlobalNotifications() {
  globalNotificationList.replaceChildren();
  try {
    const isCashier = getAdminRole() === "cashier";
    const isWarehouse = getAdminRole() === "warehouse";
    const now = Date.now();
    const orders = window.manualSortArray(
      (isWarehouse
        ? []
        : readStoredArray(GLOBAL_SEARCH_STORAGE_KEYS.orders)
      ).filter((order) => {
        const createdAt = new Date(order.createdAt || "").getTime();
        return Number.isFinite(createdAt) && now - createdAt < 5000 && now >= createdAt;
      }),
      (first, second) =>
        new Date(second.createdAt || 0).getTime() -
        new Date(first.createdAt || 0).getTime(),
    );
    window.clearTimeout(newOrderExpiryTimeout);
    if (orders.length) {
      const earliestExpiry = Math.min(
        ...orders.map((order) => new Date(order.createdAt).getTime() + 5000),
      );
      newOrderExpiryTimeout = window.setTimeout(
        renderGlobalNotifications,
        Math.max(0, earliestExpiry - now + 20),
      );
    }
    const purchaseRequests = isCashier ? readCashierPurchaseRequests() : [];
    const cashierPurchaseOrders = isCashier
      ? readCashierPurchaseOrders()
      : [];
    const adminAlerts = readPurchaseArray(
      ADMIN_ALERTS_STORAGE_KEY,
      "admin alerts",
    ).filter(
      (alert) =>
        alert &&
        typeof alert === "object" &&
        typeof alert.id === "string" &&
        alert.acknowledged !== true,
    );
    const archivedRecords = isCashier
      ? readPurchaseArray(
          "jorjetteangel-system-archive",
          "system archive",
        )
      : [];
    const archivedSupplierIds = new Set(
      archivedRecords
        .filter((record) => record && record.type === "suppliers")
        .map((record) => String(record.recordId)),
    );
    const activeSuppliers = isCashier
      ? readPurchaseArray(
          SUPPLIER_DIRECTORY_STORAGE_KEY,
          "supplier directory",
        ).filter(
          (supplier) =>
            Array.isArray(supplier) &&
            supplier[0] &&
            supplier[1] &&
            String(supplier[6] || "Active").toLocaleLowerCase() === "active" &&
            !archivedSupplierIds.has(String(supplier[0])),
        )
      : [];
    const pendingRequestIds = new Set(
      purchaseRequests.map((request) => request.id),
    );
    const pendingCashierPurchaseOrderIds = new Set(
      cashierPurchaseOrders.map((order) => String(order[0])),
    );
    const pendingAdminAlertIds = new Set(adminAlerts.map((alert) => alert.id));
    const newCashierRequest = [...pendingRequestIds].some(
      (requestId) => !knownCashierRequestIds.has(requestId),
    );
    const newCashierPurchaseOrder = [
      ...pendingCashierPurchaseOrderIds,
    ].some(
      (purchaseOrderId) =>
        !knownCashierPurchaseOrderIds.has(purchaseOrderId),
    );
    const newAdminAlert = [...pendingAdminAlertIds].some(
      (alertId) => !knownAdminAlertIds.has(alertId),
    );
    const notificationCount =
      orders.length +
      purchaseRequests.length +
      cashierPurchaseOrders.length +
      adminAlerts.length;
    globalNotificationCount.textContent =
      notificationCount > 99 ? "99+" : String(notificationCount);
    globalNotificationCount.classList.toggle(
      "hidden",
      notificationCount === 0,
    );
    globalNotificationButton.setAttribute(
      "aria-label",
      `Show notifications${notificationCount ? `, ${notificationCount} updates` : ""}`,
    );
    globalNotificationSummary.textContent = isWarehouse
      ? `${adminAlerts.length} system alert${adminAlerts.length === 1 ? "" : "s"}`
      : notificationCount
        ? `${orders.length} order${orders.length === 1 ? "" : "s"} · ${purchaseRequests.length + cashierPurchaseOrders.length} cashier approval${purchaseRequests.length + cashierPurchaseOrders.length === 1 ? "" : "s"} · ${adminAlerts.length} alert${adminAlerts.length === 1 ? "" : "s"}`
        : "Recent updates from your store";

    if (!notificationCount) {
      const empty = document.createElement("div");
      empty.className = "admin-notification-empty";
      const icon = document.createElement("span");
      icon.className = "admin-notification-empty-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✓";
      const title = document.createElement("strong");
      title.textContent = "You’re all caught up";
      const description = document.createElement("span");
      description.textContent = isWarehouse
        ? "System alerts will appear here."
        : "New storefront orders will appear here.";
      empty.append(icon, title, description);
      globalNotificationList.append(empty);
      knownCashierRequestIds = pendingRequestIds;
      knownCashierPurchaseOrderIds = pendingCashierPurchaseOrderIds;
      knownAdminAlertIds = pendingAdminAlertIds;
      cashierNotificationsInitialized = true;
      return;
    }

    orders.forEach((order) => {
      const link = document.createElement("a");
      link.className = "admin-notification-item";
      link.href = "backend-e-commerce-admin.html#incoming-orders";
      const title = document.createElement("strong");
      title.textContent = `New order ${order.reference || ""}`.trim();
      const customer = document.createElement("span");
      customer.textContent =
        [order.customer?.name, order.customer?.email]
          .filter((value) => typeof value === "string" && value.trim())
          .join(" · ") || "Customer details unavailable";
      const time = document.createElement("time");
      const date = new Date(order.createdAt || "");
      if (Number.isNaN(date.getTime())) {
        time.textContent = "Date unavailable";
      } else {
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
      link.append(title, customer, time);
      link.addEventListener("click", closeGlobalNotifications);
      globalNotificationList.append(link);
    });

    adminAlerts.forEach((alert) => {
      const item = document.createElement("article");
      item.className = "admin-notification-item admin-system-alert";
      item.dataset.severity = String(alert.severity || "normal").toLowerCase();
      const title = document.createElement("strong");
      title.textContent = alert.title || "System alert";
      const detail = document.createElement("span");
      detail.textContent = alert.message || "An admin alert needs review.";
      const context = document.createElement("span");
      context.textContent = [
        alert.orderReference ? `Order ${alert.orderReference}` : "",
        alert.productId || "",
        alert.size || "",
        alert.severity || "",
      ]
        .filter(Boolean)
        .join(" · ");
      const time = document.createElement("time");
      const date = new Date(alert.timestamp || "");
      if (Number.isNaN(date.getTime())) {
        time.textContent = "Date unavailable";
      } else {
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
      const acknowledge = document.createElement("button");
      acknowledge.type = "button";
      acknowledge.className = "admin-purchase-request-reject";
      acknowledge.textContent = "Acknowledge";
      acknowledge.addEventListener("click", () => {
        try {
          acknowledgeAdminAlert(alert.id);
          renderGlobalNotifications();
        } catch (error) {
          console.error("Could not acknowledge the admin notification.", error);
          detail.textContent =
            error instanceof Error
              ? error.message
              : "The notification could not be acknowledged.";
        }
      });
      item.append(title, detail);
      if (context.textContent) item.append(context);
      item.append(time, acknowledge);
      globalNotificationList.append(item);
    });

    purchaseRequests.forEach((request) => {
      const item = document.createElement("article");
      item.className =
        "admin-notification-item admin-purchase-request-notification";
      const title = document.createElement("strong");
      title.textContent = `Approval needed: ${request.materialName}`;
      const detail = document.createElement("span");
      detail.textContent =
        `${request.materialSku} · On hand ${Number(request.quantityOnHand) || 0} ` +
        `${request.unit || ""} · Request ${Number(request.requestedQuantity) || 0} ` +
        `${request.unit || ""}` +
        (request.orderReference
          ? ` · Production order ${request.orderReference}` +
            (request.productName ? ` · ${request.productName}` : "")
          : "");
      const supplierDetail = document.createElement("span");
        supplierDetail.textContent =
          `Supplier: ${request.supplierName || request.supplier?.name || "Not specified"} · ` +
          `${request.category || "Category unavailable"} · Reorder threshold ${Number(request.reorderThreshold) || 0} ${request.unit || ""}`;
      const requester = document.createElement("span");
      requester.textContent = `Requested by ${request.requestedBy || "Inventory staff"}`;
      const time = document.createElement("time");
      const date = new Date(request.requestedAt || "");
      if (Number.isNaN(date.getTime())) {
        time.textContent = "Date unavailable";
      } else {
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
      const actions = document.createElement("div");
      actions.className = "admin-purchase-request-actions";
      const supplierSelect = document.createElement("select");
      supplierSelect.className = "admin-purchase-request-supplier";
      supplierSelect.setAttribute(
        "aria-label",
        `Supplier for ${request.materialName}`,
      );
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = activeSuppliers.length
        ? "Choose a supplier"
        : "No active suppliers in Supplier Directory";
      supplierSelect.append(placeholder);
      const matchingSuppliers = findMatchingPurchaseSuppliers(
        request,
        activeSuppliers,
      );
      activeSuppliers.forEach((supplier) => {
        const option = document.createElement("option");
        option.value = String(supplier[0]);
        option.textContent = `${supplier[1]} (${supplier[0]}) · ${supplier[5] || "Materials not listed"}`;
        supplierSelect.append(option);
      });
      if (matchingSuppliers.length === 1) {
        supplierSelect.value = String(matchingSuppliers[0][0]);
      }
      if (
        request.supplierId &&
        activeSuppliers.some(
          (supplier) => String(supplier[0]) === String(request.supplierId),
        )
      ) {
        supplierSelect.value = String(request.supplierId);
      }
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "admin-purchase-request-approve";
      approve.textContent = "Approve";
      approve.disabled = activeSuppliers.length === 0;
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "admin-purchase-request-reject";
      reject.textContent = "Reject";
      const decide = (status) => {
        try {
          if (status === "Approved") {
            if (!supplierSelect.value) {
              throw new Error("Choose the supplier for this purchase order.");
            }
            approveCashierPurchaseRequest(request.id, supplierSelect.value);
          } else {
            updateCashierPurchaseRequest(request.id, status);
          }
          renderGlobalNotifications();
        } catch (error) {
          console.error("Could not review the material purchase request.", error);
          detail.textContent =
            error instanceof Error
              ? error.message
              : "The request could not be updated.";
        }
      };
      approve.addEventListener("click", () => decide("Approved"));
      reject.addEventListener("click", () => decide("Rejected"));
      actions.append(supplierSelect, approve, reject);
      item.append(title, detail, supplierDetail, requester, time, actions);
      globalNotificationList.append(item);
    });

    cashierPurchaseOrders.forEach((order) => {
      const item = document.createElement("article");
      item.className =
        "admin-notification-item admin-purchase-request-notification";
      const title = document.createElement("strong");
      title.textContent = `Purchase request approval: ${order[0]}`;
      const supplier = document.createElement("span");
      supplier.textContent = `Supplier: ${order[2] || order[1] || "Supplier unavailable"}`;
      const details = document.createElement("span");
      details.textContent = (Array.isArray(order[6]) ? order[6] : [])
        .map(
          (material) =>
            `${material[1] || material[0]} · ${Number(material[2]) || 0} ${material[3] || ""}`,
        )
        .join(" | ") || "No item details available";
      const total = document.createElement("span");
      total.textContent = `Requested total: PHP ${(Number(order[4]) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      const requester = document.createElement("span");
      requester.textContent = `Requested by ${order[8] || "Inventory staff"}`;
      const time = document.createElement("time");
      const submittedAt = new Date(order[17] || "");
      time.textContent = Number.isNaN(submittedAt.getTime())
        ? "Submission time unavailable"
        : submittedAt.toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          });
      const actions = document.createElement("div");
      actions.className = "admin-purchase-request-actions";
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "admin-purchase-request-approve";
      approve.textContent = "Approve";
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "admin-purchase-request-reject";
      reject.textContent = "Reject";
      const review = (approved) => {
        try {
          reviewCashierPurchaseOrder(order[0], approved);
          renderGlobalNotifications();
        } catch (error) {
          console.error("Could not review the purchase request.", error);
          details.textContent =
            error instanceof Error
              ? error.message
              : "The purchase request could not be updated.";
        }
      };
      approve.addEventListener("click", () => review(true));
      reject.addEventListener("click", () => review(false));
      actions.append(approve, reject);
      item.append(title, supplier, details, total, requester, time, actions);
      globalNotificationList.append(item);
    });

    knownCashierRequestIds = pendingRequestIds;
    knownCashierPurchaseOrderIds = pendingCashierPurchaseOrderIds;
    knownAdminAlertIds = pendingAdminAlertIds;
    if (
      isCashier &&
      (purchaseRequests.length || cashierPurchaseOrders.length) &&
      (!cashierNotificationsInitialized ||
        newCashierRequest ||
        newCashierPurchaseOrder)
    ) {
      globalNotificationPanel.classList.remove("hidden");
      globalNotificationButton.setAttribute("aria-expanded", "true");
    }
    if (adminAlerts.length && newAdminAlert) {
      globalNotificationPanel.classList.remove("hidden");
      globalNotificationButton.setAttribute("aria-expanded", "true");
    }
    cashierNotificationsInitialized = true;
  } catch (error) {
    console.error("Could not load admin order notifications.", error);
    globalNotificationCount.classList.add("hidden");
    const errorState = document.createElement("p");
    errorState.className = "admin-notification-empty";
    errorState.textContent = "Notifications could not be loaded.";
    globalNotificationList.append(errorState);
  }
}

globalSearchInput.addEventListener("input", renderGlobalSearch);
globalSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeGlobalSearch();
});
globalNotificationButton.addEventListener("click", () => {
  const shouldOpen = globalNotificationPanel.classList.contains("hidden");
  globalNotificationPanel.classList.toggle("hidden", !shouldOpen);
  globalNotificationButton.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) renderGlobalNotifications();
});

document.addEventListener("click", (event) => {
  if (!globalAdminHeader.contains(event.target)) {
    closeGlobalSearch();
    closeGlobalNotifications();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeGlobalNotifications();
});
window.addEventListener("storage", (event) => {
  if (
    Object.values(GLOBAL_SEARCH_STORAGE_KEYS).includes(event.key) ||
    event.key === PURCHASE_REQUESTS_STORAGE_KEY ||
    event.key === PURCHASE_ORDERS_STORAGE_KEY ||
    event.key === RAW_MATERIALS_STORAGE_KEY ||
    event.key === ADMIN_ALERTS_STORAGE_KEY ||
    event.key === BOM_OPERATION_EVENTS_STORAGE_KEY ||
    event.key === SUPPLIER_DIRECTORY_STORAGE_KEY ||
    event.key === "jorjetteangel-system-archive" ||
    event.key === null
  ) {
    if (globalSearchInput.value.trim()) renderGlobalSearch();
    renderGlobalNotifications();
  }
});

renderGlobalNotifications();
