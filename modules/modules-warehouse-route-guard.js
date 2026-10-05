// Restricts access to role-approved modules.

(() => {
  let session;
  try {
    session = JSON.parse(
      window.backendMemoryStorage.getItem("jorjetteangel-admin-session") || "null",
    );
  } catch (error) {
    console.error("Could not verify access to this admin module.", error);
    window.location.replace("../Backend/backend-login.html");
    return;
  }

  if (!session) {
    window.location.replace("../Backend/backend-login.html");
    return;
  }

  const role = String(session.role || "").trim().toLowerCase();
  const employeeId = String(session.employeeId || "").toLowerCase();
  const isWarehouse =
    /^acc-whs(?:-|$)/.test(role) ||
    /^acc-whs(?:-|$)/.test(employeeId) ||
    role === "warehouse manager" ||
    role === "warehouse";
  const isProduction =
    /^acc-prd(?:-|$)/.test(role) ||
    /^acc-prd(?:-|$)/.test(employeeId) ||
    role === "production" ||
    role === "atelier staff";
  if (!isWarehouse && !isProduction) return;

  const fileName = decodeURIComponent(
    window.location.pathname.split("/").slice(-1)[0] || "",
  ).toLowerCase();
  const isEmbedded = new URLSearchParams(window.location.search).has(
    "embedded",
  );
  const permittedWarehouseModules = new Set([
    "modules-finished-goods-inventory.html",
    "modules-fabric-and-bom-management.html",
    "modules-supplier-management.html",
    "modules-purchasing-restocking.html",
    "modules-delivery-order-release.html",
    "modules-cashier-profile.html",
  ]);
  const isPersonalProfile = fileName === "modules-cashier-profile.html";
  if (
    !isEmbedded &&
    (isWarehouse || isProduction) &&
    isPersonalProfile
  ) {
    window.parent.postMessage({ type: "admin-route", module: "settings" }, "*");
    return;
  }
  if (
    isEmbedded &&
    ((isWarehouse && permittedWarehouseModules.has(fileName)) ||
      (isProduction &&
        (fileName === "modules-production-management.html" ||
          isPersonalProfile)))
  ) {
    return;
  }

  if (
    !isEmbedded &&
    isProduction &&
    fileName === "modules-production-management.html"
  ) {
    window.parent.postMessage({ type: "admin-route", module: "production" }, "*");
    return;
  }

  const destination =
    "../Backend/backend-e-commerce-admin.html?accessDenied=1";
  try {
    if (window.top && window.top !== window) {
      window.top.location.replace(destination);
    } else {
      window.location.replace(destination);
    }
  } catch (error) {
    console.error("Could not redirect from an unauthorized admin module.", error);
    window.location.replace(destination);
  }
})();
