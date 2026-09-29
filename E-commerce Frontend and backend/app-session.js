// Initialize empty app data for a new session and clear it after a page reload.
(() => {
  const sessionVersionKey = "jorjetteangel-app-session-version";
  const sessionVersion = "1";
  const catalogKey = "jorjetteangel-admin-catalog";
  const profileKey = "jorjetteangel-client-profiles";
  const ordersKey = "jorjetteangel-orders";
  const cartKey = "jorjetteangel-shopping-bag";
  const catalogVersion = 3;
  const emptyCatalog = {
    catalogVersion,
    categories: [],
    products: [],
    auditTrail: [],
  };


  // Reset catalog, account, order, cart, and remembered-login data to empty state.
  function writeEmptyAppData() {
    localStorage.setItem(catalogKey, JSON.stringify(emptyCatalog));
    localStorage.setItem(profileKey, "[]");
    localStorage.setItem(ordersKey, "[]");
    localStorage.setItem(cartKey, "[]");
    localStorage.removeItem("jorjetteangel-remembered-email");
    sessionStorage.removeItem("jorjetteangel-signed-in-email");
  }


  // Create an empty stored array or replace malformed data for a storage key.
  function ensureArrayStorage(key) {
    const saved = localStorage.getItem(key);
    if (saved === null) {
      localStorage.setItem(key, "[]");
      return;
    }
    try {
      if (!Array.isArray(JSON.parse(saved))) {
        console.warn(`Resetting invalid temporary data stored at "${key}".`);
        localStorage.setItem(key, "[]");
      }
    } catch (error) {
      console.warn(`Resetting malformed temporary data stored at "${key}".`, error);
      localStorage.setItem(key, "[]");
    }
  }

  try {
    let navigationEntry = null;
    for (const entry of performance.getEntriesByType("navigation")) {
      if (entry instanceof PerformanceNavigationTiming) {
        navigationEntry = entry;
        break;
      }
    }
    const isReload = navigationEntry?.type === "reload";
    const isNewDataVersion =
      localStorage.getItem(sessionVersionKey) !== sessionVersion;

    if (isReload || isNewDataVersion) {
      writeEmptyAppData();
      localStorage.setItem(sessionVersionKey, sessionVersion);
      return;
    }

    if (!localStorage.getItem(catalogKey)) {
      localStorage.setItem(catalogKey, JSON.stringify(emptyCatalog));
    }
    for (const key of [profileKey, ordersKey, cartKey]) {
      ensureArrayStorage(key);
    }

    const catalog = JSON.parse(localStorage.getItem(catalogKey));
    if (
      !catalog ||
      catalog.catalogVersion !== catalogVersion ||
      !Array.isArray(catalog.categories) ||
      !Array.isArray(catalog.products) ||
      !Array.isArray(catalog.auditTrail)
    ) {
      console.warn("Resetting invalid temporary catalog data.");
      writeEmptyAppData();
    }
  } catch (error) {
    console.error("Could not initialize temporary storefront data.", error);
    throw error;
  }
})();

