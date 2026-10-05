// Initializes the shared in-memory app data.

(() => {
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

  function writeEmptyAppData() {
    window.backendMemoryStorage.setItem(
      catalogKey,
      JSON.stringify(emptyCatalog),
    );
    window.backendMemoryStorage.setItem(profileKey, "[]");
    window.backendMemoryStorage.setItem(ordersKey, "[]");
    window.backendMemoryStorage.setItem(cartKey, "[]");
  }

  function ensureArrayStorage(key) {
    const saved = window.backendMemoryStorage.getItem(key);
    if (saved === null) {
      window.backendMemoryStorage.setItem(key, "[]");
      return;
    }
    try {
      if (!Array.isArray(JSON.parse(saved))) {
        console.warn(`Resetting invalid temporary data stored at "${key}".`);
        window.backendMemoryStorage.setItem(key, "[]");
      }
    } catch (error) {
      console.warn(
        `Resetting malformed temporary data stored at "${key}".`,
        error,
      );
      window.backendMemoryStorage.setItem(key, "[]");
    }
  }

  try {
    if (!window.backendMemoryStorage.getItem(catalogKey)) {
      window.backendMemoryStorage.setItem(
        catalogKey,
        JSON.stringify(emptyCatalog),
      );
    }
    for (const key of [profileKey, ordersKey, cartKey]) {
      ensureArrayStorage(key);
    }

    const catalog = JSON.parse(window.backendMemoryStorage.getItem(catalogKey));
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
