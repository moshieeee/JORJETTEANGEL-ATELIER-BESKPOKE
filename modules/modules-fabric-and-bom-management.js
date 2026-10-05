// Manages fabrics, materials, and BOM recipes.

(() => {
  let fabToastTimeout;
  const fabToast = document.querySelector("#toast");

  function showFabToast(message, type) {
    if (!fabToast) return;
    const colorClass =
      type === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
    fabToast.textContent = message;
    fabToast.className =
      "pointer-events-none fixed right-4 top-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-medium shadow-lg " +
      colorClass;
    window.clearTimeout(fabToastTimeout);
    fabToastTimeout = window.setTimeout(function () {
      fabToast.classList.add("hidden");
    }, 4000);
  }
  function formatQuantity(num) {
    const str = String(Math.floor(Number(num) || 0));
    let result = "";
    let count = 0;
    let k = str.length - 1;
    while (k >= 0) {
      if (count > 0 && count % 3 === 0) {
        result = "," + result;
      }
      result = str.charAt(k) + result;
      count += 1;
      k -= 1;
    }
    return result === "" ? "0" : result;
  }

  function invContainsText(haystack, needle) {
    if (needle === "") return true;
    const h = String(haystack).toLowerCase();
    const n = String(needle).toLowerCase();
    if (n.length > h.length) return false;
    let i = 0;
    while (i <= h.length - n.length) {
      let j = 0;
      while (j < n.length && h.charAt(i + j) === n.charAt(j)) {
        j += 1;
      }
      if (j === n.length) return true;
      i += 1;
    }
    return false;
  }


  const FAB_STORAGE_KEY = "jg-erp-fabrics-materials-v1";
  const FAB_NEXT_ID_KEY = "jg-erp-fabrics-materials-next-id-v1";
  const FAB_CATEGORIES_STORAGE_KEY = "jg-erp-fabrics-material-categories-v1";
  const SUPPLIER_DIRECTORY_KEY = "jg-erp-supplier-directory-v1";
  const PURCHASE_REQUESTS_STORAGE_KEY = "jg-erp-purchase-restock-requests-v1";
  const DEFAULT_FAB_CATEGORIES = [
    "Fabrics",
    "Threads",
    "Buttons & Zippers",
  ];

  const FAB_CODE_INDEX = 0; // Material code
  const FAB_NAME_INDEX = 1; // Material name
  const FAB_LOT_INDEX = 2; // Batch number
  const FAB_CATEGORY_INDEX = 3; // Material category
  const FAB_STOCK_INDEX = 4; // Quantity in stock
  const FAB_UNIT_INDEX = 5; // Unit of measure
  const FAB_COST_INDEX = 6; // Cost per unit
  const FAB_LAST_RESTOCKED_INDEX = 7; // Last restock date
  const FAB_THRESHOLD_INDEX = 8; // Low-stock limit
  const FAB_SUPPLIER_ID_INDEX = 9; // Supplier ID
  const FAB_SUPPLIER_NAME_INDEX = 10; // Supplier name

  const starterFabMaterials = [
    [
      "SKU-RAW-0001",
      "Fabric1",
      "LOT-BLG-2026-01",
      "Fabrics",
      150.0,
      "meters",
      380.0,
      "03/05/2026",
      25.0,
    ],
    [
      "SKU-RAW-0002",
      "Button1",
      "LOT-BTN-2026-08",
      "Buttons & Zippers",
      420.0,
      "pieces",
      15.0,
      "03/05/2026",
      100.0,
    ],
    [
      "SKU-RAW-0003",
      "Zipper1",
      "LOT-YKK-2026-02",
      "Buttons & Zippers",
      75.0,
      "pieces",
      45.0,
      "03/03/2026",
      20.0,
    ],
    [
      "SKU-RAW-0004",
      "Thread1",
      "LOT-GUT-2026-11",
      "Threads",
      65.0,
      "spools",
      85.0,
      "03/05/2026",
      15.0,
    ],
  ];

  const previousStarterFabMaterials = [
    [
      "FAB-LIN-WHT-01",
      "Pure Belgian Linen - Bleached White",
      "LOT-BLG-2026-01",
      "Fabrics & Cloths",
      150.0,
      "meters",
      380.0,
      "03/05/2026",
      25.0,
    ],
    [
      "FAB-SLK-EMR-02",
      "Mulberry Silk Charmeuse - Emerald Green",
      "LOT-SLK-2026-03",
      "Fabrics & Cloths",
      45.5,
      "meters",
      850.0,
      "03/04/2026",
      15.0,
    ],
    [
      "FAB-WOL-CHR-03",
      "Italian Super 120s Suiting Wool - Charcoal",
      "LOT-WOL-2026-02",
      "Fabrics & Cloths",
      8.0,
      "meters",
      1250.0,
      "03/02/2026",
      10.0,
    ],
    [
      "FAB-CTN-BEI-04",
      "Stretch Cotton Chino Twill - Khaki Beige",
      "LOT-CTN-2026-05",
      "Fabrics & Cloths",
      0.0,
      "meters",
      240.0,
      "02/28/2026",
      20.0,
    ],
    [
      "FAB-PNA-ORG-05",
      "Handwoven Piña Organza Heritage Textile",
      "LOT-PNA-2026-01",
      "Fabrics & Cloths",
      28.0,
      "meters",
      1850.0,
      "03/05/2026",
      10.0,
    ],
    [
      "THRD-POLY-BLK-01",
      "Gutermann Mara 120 Spun Polyester - Black (1000m)",
      "LOT-GUT-2026-11",
      "Threads & Yarns",
      65.0,
      "spools",
      85.0,
      "03/05/2026",
      15.0,
    ],
    [
      "THRD-POLY-WHT-02",
      "Gutermann Mara 120 Spun Polyester - White (1000m)",
      "LOT-GUT-2026-12",
      "Threads & Yarns",
      110.0,
      "spools",
      85.0,
      "03/05/2026",
      20.0,
    ],
    [
      "THRD-SLK-GLD-03",
      "Filament Embroidery Silk Floss - Metallic Gold",
      "LOT-FLS-2026-04",
      "Threads & Yarns",
      18.0,
      "spools",
      160.0,
      "03/03/2026",
      10.0,
    ],
    [
      "BTN-SHL-18MM-01",
      "Natural Mother of Pearl Shirt Buttons (18mm / 4-Hole)",
      "LOT-BTN-2026-08",
      "Buttons & Fasteners",
      420.0,
      "pieces",
      15.0,
      "03/05/2026",
      100.0,
    ],
    [
      "BTN-HRN-20MM-02",
      "Genuine Buffalo Horn Blazer Buttons (20mm)",
      "LOT-BTN-2026-09",
      "Buttons & Fasteners",
      180.0,
      "pieces",
      28.0,
      "03/04/2026",
      50.0,
    ],
    [
      "ZIP-INV-YKK-01",
      "YKK Invisible Concealed Dress Zippers (18-inch)",
      "LOT-YKK-2026-02",
      "Zippers & Hardware",
      75.0,
      "pieces",
      45.0,
      "03/03/2026",
      20.0,
    ],
    [
      "LIN-CUP-NAV-01",
      "Bemberg Cupro Breathable Jacquard Lining - Navy",
      "LOT-BMB-2026-01",
      "Linings & Interfacing",
      85.0,
      "meters",
      290.0,
      "03/02/2026",
      20.0,
    ],
  ];

  let fabMaterials = [];
  let fabCurrentPage = 1;
  let fabEntriesPerPage = 10;

  const fabSearchInput = document.querySelector("#fab-search-input");
  const fabCategoryFilter = document.querySelector("#fab-category-filter");
  const fabEntriesSelect = document.querySelector("#fab-entries-select");
  const fabTableBody = document.querySelector("#fab-table-body");
  const emptyFab = document.querySelector("#empty-fab");
  const fabShowingBadge = document.querySelector("#fab-showing-badge");
  const fabPaginationInfo = document.querySelector("#fab-pagination-info");
  const fabPaginationControls = document.querySelector(
    "#fab-pagination-controls",
  );

  const fabKpiStockoutBadge = document.querySelector("#fab-kpi-stockout-badge");
  const fabKpiStockoutCount = document.querySelector("#fab-kpi-stockout-count");
  const fabKpiLowstockBadge = document.querySelector("#fab-kpi-lowstock-badge");
  const fabKpiLowstockCount = document.querySelector("#fab-kpi-lowstock-count");
  const rawMaterialCount = document.querySelector("#raw-material-count");
  const lowStockSummary = document.querySelector("#low-stock-summary");
  const lowStockViewButton = document.querySelector("#fab-view-low-stock");
  const lowStockModal = document.querySelector("#fab-low-stock-modal");
  const lowStockModalClose = document.querySelector("#fab-low-stock-close");
  const lowStockList = document.querySelector("#fab-low-stock-list");
  const lowStockEmpty = document.querySelector("#fab-low-stock-empty");

  const fabBtnAdd = document.querySelector("#fab-btn-add");
  const fabBtnAddCategory = document.querySelector("#fab-btn-add-category");

  const fabModal = document.querySelector("#fab-modal");
  const fabModalTitle = document.querySelector("#fab-modal-title");
  const fabModalClose = document.querySelector("#fab-modal-close");
  const fabBtnCancel = document.querySelector("#fab-btn-cancel");
  const fabMaterialForm = document.querySelector("#fab-material-form");
  const fabEditIndexInput = document.querySelector("#fab-edit-index");
  const fabInputCode = document.querySelector("#fab-input-code");
  const fabInputName = document.querySelector("#fab-input-name");
  const fabInputCategory = document.querySelector("#fab-input-category");
  const fabInputUnit = document.querySelector("#fab-input-unit");
  const fabInputStock = document.querySelector("#fab-input-stock");
  const fabInputCost = document.querySelector("#fab-input-cost");
  const fabInputThreshold = document.querySelector("#fab-input-threshold");
  const fabInputSupplier = document.querySelector("#fab-input-supplier");
  const fabCategoryModal = document.querySelector("#fab-category-modal");
  const fabCategoryForm = document.querySelector("#fab-category-form");
  const fabCategoryName = document.querySelector("#fab-category-name");
  const fabCategoryModalClose = document.querySelector(
    "#fab-category-modal-close",
  );
  const fabCategoryCancel = document.querySelector("#fab-category-cancel");

  function formatFabMaterialId(value) {
    return "SKU-RAW-" + String(value).padStart(4, "0");
  }

  function isPreviousStarterFabMaterials(items) {
    if (!items || items.length !== previousStarterFabMaterials.length)
      return false;

    let rowIndex = 0;
    while (rowIndex < previousStarterFabMaterials.length) {
      const currentRow = items[rowIndex];
      const previousRow = previousStarterFabMaterials[rowIndex];
      if (!currentRow || currentRow.length !== previousRow.length) return false;

      let fieldIndex = 0;
      while (fieldIndex < previousRow.length) {
        const currentValue = currentRow[fieldIndex];
        const previousValue = previousRow[fieldIndex];
        if (fieldIndex === FAB_CODE_INDEX) {
          const convertedId = formatFabMaterialId(rowIndex + 1);
          if (
            currentValue !== previousValue &&
            currentValue !== convertedId
          )
            return false;
        } else if (currentValue !== previousValue) {
          return false;
        }
        fieldIndex += 1;
      }
      rowIndex += 1;
    }
    return true;
  }

  function normalizeFabCategory(category) {
    if (
      category === "Fabrics" ||
      category === "Threads" ||
      category === "Buttons & Zippers"
    )
      return category;
    if (category === "Threads & Yarns") return "Threads";
    if (category === "Buttons & Fasteners" || category === "Zippers & Hardware")
      return "Buttons & Zippers";
    return String(category || "").trim() || "Fabrics";
  }

  function readFabSuppliers() {
    try {
      const stored = JSON.parse(
        window.backendMemoryStorage.getItem(SUPPLIER_DIRECTORY_KEY) || "[]",
      );
      if (!Array.isArray(stored)) {
        throw new Error("Saved supplier directory data must be a list.");
      }
      return stored.filter(
        (supplier) =>
          Array.isArray(supplier) &&
          supplier.length >= 2 &&
          supplier[0] &&
          supplier[1],
      );
    } catch (error) {
      showFabToast(
        error instanceof Error
          ? error.message
          : "Supplier Directory data could not be loaded.",
        "error",
      );
      return [];
    }
  }

  function getFabSupplier(supplierId) {
    if (!supplierId) return null;
    return (
      readFabSuppliers().find(
        (supplier) => String(supplier[0]) === String(supplierId),
      ) || null
    );
  }

  function refreshFabSupplierOptions(selectedSupplierId = "") {
    if (!fabInputSupplier) return;
    const suppliers = readFabSuppliers();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "No supplier selected";
    let options = suppliers
      .filter(
        (supplier) =>
          (supplier[6] || "Active") === "Active" &&
          !window.systemArchive.isArchived("suppliers", supplier[0]),
      )
      .map((supplier) => {
        const option = document.createElement("option");
        option.value = String(supplier[0]);
        option.textContent = String(supplier[1]) + " · " + String(supplier[0]);
        return option;
      });

    const selectedSupplier = suppliers.find(
      (supplier) => String(supplier[0]) === String(selectedSupplierId),
    );
    if (
      selectedSupplier &&
      !options.some((option) => option.value === String(selectedSupplier[0]))
    ) {
      const inactiveOption = document.createElement("option");
      inactiveOption.value = String(selectedSupplier[0]);
      inactiveOption.textContent =
        String(selectedSupplier[1]) + " · inactive or archived";
      options = window.arrayWithAppended(options, inactiveOption);
    }
    fabInputSupplier.replaceChildren(placeholder, ...options);
    fabInputSupplier.value = selectedSupplierId || "";
  }

  function readFabCategories() {
    let storedCategories;
    try {
      storedCategories = JSON.parse(
        window.backendMemoryStorage.getItem(FAB_CATEGORIES_STORAGE_KEY) || "[]",
      );
    } catch {
      throw new Error("Saved material categories are invalid.");
    }

    if (!Array.isArray(storedCategories)) {
      throw new Error("Saved material categories must be a list.");
    }

    let categories = [...DEFAULT_FAB_CATEGORIES];
    const addCategory = (category) => {
      const name = typeof category === "string" ? category.trim() : "";
      if (
        name &&
        !categories.some(
          (existing) => existing.toLowerCase() === name.toLowerCase(),
        )
      ) {
        categories = window.arrayWithAppended(categories, name);
      }
    };

    storedCategories.forEach(addCategory);
    fabMaterials.forEach((item) => addCategory(item[FAB_CATEGORY_INDEX]));
    return categories;
  }

  function refreshFabCategoryOptions(
    selectedInputCategory = fabInputCategory?.value || "",
    selectedFilterCategory = fabCategoryFilter?.value || "all",
  ) {
    let categories;
    try {
      categories = readFabCategories();
    } catch (error) {
      showFabToast(error.message, "error");
      categories = [...DEFAULT_FAB_CATEGORIES];
      fabMaterials.forEach((item) => {
        const category = normalizeFabCategory(item[FAB_CATEGORY_INDEX]);
        if (
          !categories.some(
            (existing) => existing.toLowerCase() === category.toLowerCase(),
          )
        ) {
          categories = window.arrayWithAppended(categories, category);
        }
      });
    }

    if (fabInputCategory) {
      const categoryOptions = categories.map((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        return option;
      });
      fabInputCategory.replaceChildren(...categoryOptions);
      fabInputCategory.value = categories.includes(selectedInputCategory)
        ? selectedInputCategory
        : categories[0];
    }

    if (fabCategoryFilter) {
      const allCategoriesOption = document.createElement("option");
      allCategoriesOption.value = "all";
      allCategoriesOption.textContent = "All Categories";
      const categoryOptions = categories.map((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        return option;
      });
      fabCategoryFilter.replaceChildren(
        allCategoriesOption,
        ...categoryOptions,
      );
      fabCategoryFilter.value =
        selectedFilterCategory === "all" ||
        categories.includes(selectedFilterCategory)
          ? selectedFilterCategory
          : "all";
    }
  }

  function openFabCategoryModal() {
    if (!fabCategoryModal || !fabCategoryName) return;
    fabCategoryForm?.reset();
    fabCategoryModal.classList.remove("hidden");
    fabCategoryModal.classList.add("flex");
    fabCategoryName.focus();
  }

  function closeFabCategoryModal() {
    if (!fabCategoryModal) return;
    fabCategoryModal.classList.add("hidden");
    fabCategoryModal.classList.remove("flex");
  }

  function getNextFabMaterialId() {
    let highestId = 0;
    let i = 0;
    while (i < fabMaterials.length) {
      const currentId = String(fabMaterials[i][FAB_CODE_INDEX] || "");
      const match = /^SKU-RAW-(\d{4,})$/.exec(currentId);
      if (match || /^\d+$/.test(currentId)) {
        const numericId = Number(match ? match[1] : currentId);
        if (numericId > highestId) highestId = numericId;
      }
      i += 1;
    }

    let nextId = highestId + 1;
    try {
      const savedNextId = Number(window.backendMemoryStorage.getItem(FAB_NEXT_ID_KEY));
      if (Number.isInteger(savedNextId) && savedNextId > nextId) {
        nextId = savedNextId;
      }
    } catch (error) {}
    return formatFabMaterialId(nextId);
  }

  function saveFabMaterials() {
    try {
      window.backendMemoryStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(fabMaterials));
      window.backendMemoryStorage.setItem(
        FAB_NEXT_ID_KEY,
        String(Number(getNextFabMaterialId().slice("SKU-RAW-".length))),
      );
      window.dispatchEvent(new Event("fabricMaterialsUpdated"));
      return true;
    } catch (e) {
      showFabToast(
        "Unable to save fabrics & materials data to browser storage.",
        "error",
      );
      return false;
    }
  }

  function loadFabMaterials() {
    let stored;
    try {
      stored = JSON.parse(window.backendMemoryStorage.getItem(FAB_STORAGE_KEY));
    } catch (e) {
      stored = null;
    }

    const replacePreviousStarter = isPreviousStarterFabMaterials(stored);
    if (replacePreviousStarter) stored = null;

    if (stored && typeof stored.length === "number" && stored.length > 0) {
      fabMaterials = [];
      let needsIdMigration = false;
      let needsCategoryMigration = false;
      let needsSupplierMigration = false;

      let idx = 0;
      while (idx < stored.length) {
        const row = stored[idx];
        if (row && typeof row.length === "number") {
          const storedCode = String(row[FAB_CODE_INDEX] || "");
          const validSku = /^SKU-RAW-\d{4,}$/.test(storedCode);
          let migratedCode = storedCode;
          if (!validSku) {
            const legacySequence = /^\d+$/.test(storedCode)
              ? Number(storedCode)
              : fabMaterials.length + 1;
            migratedCode = formatFabMaterialId(
              legacySequence || fabMaterials.length + 1,
            );
            needsIdMigration = true;
          }
          fabMaterials[fabMaterials.length] = [
            migratedCode,
            row[FAB_NAME_INDEX] || "",
            row[FAB_LOT_INDEX] || "",
            normalizeFabCategory(row[FAB_CATEGORY_INDEX]),
            Number(row[FAB_STOCK_INDEX]) || 0,
            row[FAB_UNIT_INDEX] || "meters",
            Number(row[FAB_COST_INDEX]) || 0,
            row[FAB_LAST_RESTOCKED_INDEX] || "03/05/2026",
            Number(row[FAB_THRESHOLD_INDEX]) || 10,
            row[FAB_SUPPLIER_ID_INDEX] || "",
            row[FAB_SUPPLIER_NAME_INDEX] || "",
          ];
          if (row.length <= FAB_SUPPLIER_NAME_INDEX) {
            needsSupplierMigration = true;
          }
        }
        if (
          row &&
          normalizeFabCategory(row[FAB_CATEGORY_INDEX]) !==
            row[FAB_CATEGORY_INDEX]
        ) {
          needsCategoryMigration = true;
        }
        idx += 1;
      }
      if (
        needsIdMigration ||
        needsCategoryMigration ||
        needsSupplierMigration
      ) {
        saveFabMaterials();
      }
    } else {
      fabMaterials = [];
      let sIdx = 0;
      while (sIdx < starterFabMaterials.length) {
        const sRow = starterFabMaterials[sIdx];
        fabMaterials[fabMaterials.length] = [
          sRow[FAB_CODE_INDEX],
          sRow[FAB_NAME_INDEX],
          sRow[FAB_LOT_INDEX],
          sRow[FAB_CATEGORY_INDEX],
          sRow[FAB_STOCK_INDEX],
          sRow[FAB_UNIT_INDEX],
          sRow[FAB_COST_INDEX],
          sRow[FAB_LAST_RESTOCKED_INDEX],
          sRow[FAB_THRESHOLD_INDEX],
          "",
          "",
        ];
        sIdx += 1;
      }
      if (replacePreviousStarter) {
        try {
          window.backendMemoryStorage.removeItem(FAB_NEXT_ID_KEY);
        } catch (error) {}
      }
      saveFabMaterials();
    }
  }

  function updateFabKPIs() {
    let stockouts = 0;
    let lowStock = 0;
    let activeMaterialCount = 0;

    let i = 0;
    while (i < fabMaterials.length) {
      const item = fabMaterials[i];
      if (window.systemArchive.isArchived("materials", item[FAB_CODE_INDEX])) {
        i += 1;
        continue;
      }
      activeMaterialCount += 1;
      const stock = Number(item[FAB_STOCK_INDEX]) || 0;
      const threshold = Number(item[FAB_THRESHOLD_INDEX]) || 10;

      if (stock === 0) {
        stockouts += 1;
      } else if (stock <= threshold) {
        lowStock += 1;
      }
      i += 1;
    }

    if (fabKpiStockoutBadge) {
      fabKpiStockoutBadge.textContent = "Alerts: " + stockouts;
      if (stockouts > 0) {
        fabKpiStockoutBadge.className =
          "inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800";
      } else {
        fabKpiStockoutBadge.className =
          "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700";
      }
    }

    if (fabKpiStockoutCount) {
      fabKpiStockoutCount.textContent =
        stockouts + (stockouts === 1 ? " item" : " items");
    }

    if (fabKpiLowstockBadge) {
      fabKpiLowstockBadge.textContent = "Alerts: " + lowStock;
      if (lowStock > 0) {
        fabKpiLowstockBadge.className =
          "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800";
      } else {
        fabKpiLowstockBadge.className =
          "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700";
      }
    }

    if (fabKpiLowstockCount) {
      fabKpiLowstockCount.textContent =
        lowStock + (lowStock === 1 ? " material" : " materials");
    }
    if (rawMaterialCount)
      rawMaterialCount.textContent = String(activeMaterialCount);
    if (lowStockSummary)
      lowStockSummary.textContent = String(lowStock + stockouts);
  }

  function renderLowStockAlerts() {
    if (!lowStockList) return;
    let purchaseRequests = [];
    try {
      const storedRequests = window.backendMemoryStorage.getItem(
        PURCHASE_REQUESTS_STORAGE_KEY,
      );
      if (storedRequests !== null) {
        purchaseRequests = JSON.parse(storedRequests);
        if (!Array.isArray(purchaseRequests)) {
          throw new Error("Saved purchase requests must be a list.");
        }
      }
    } catch (error) {
      showFabToast(
        error instanceof Error
          ? error.message
          : "Purchase requests could not be loaded.",
        "error",
      );
    }
    const lowStockMaterials = fabMaterials
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          !window.systemArchive.isArchived("materials", item[FAB_CODE_INDEX]) &&
          Number(item[FAB_STOCK_INDEX]) <=
          Number(item[FAB_THRESHOLD_INDEX]),
      );
    lowStockList.replaceChildren();
    lowStockMaterials.forEach(({ item, index }) => {
      const stock = Number(item[FAB_STOCK_INDEX]) || 0;
      const threshold = Number(item[FAB_THRESHOLD_INDEX]) || 10;
      const row = document.createElement("li");
      row.className = "fab-low-stock-item";
      const details = document.createElement("div");
      const name = document.createElement("p");
      name.className = "fab-low-stock-name";
      name.textContent = item[FAB_NAME_INDEX];
      const metadata = document.createElement("p");
      metadata.className = "fab-low-stock-metadata";
      metadata.textContent =
        item[FAB_CODE_INDEX] + " · " + item[FAB_CATEGORY_INDEX];
      details.append(name, metadata);
      const quantity = document.createElement("span");
      quantity.className = "fab-low-stock-quantity";
      const formattedStock =
        stock % 1 === 0 ? formatQuantity(stock) : stock.toFixed(2);
      const formattedThreshold =
        threshold % 1 === 0
          ? formatQuantity(threshold)
          : threshold.toFixed(2);
      quantity.textContent =
        stock === 0
          ? "Out of stock · Alert at " +
            formattedThreshold +
            " " +
            item[FAB_UNIT_INDEX]
          : formattedStock +
            " in stock · Alert at " +
            formattedThreshold +
            " " +
            item[FAB_UNIT_INDEX];
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "row-action";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => {
        closeLowStockModal();
        openEditMaterialModal(index);
      });
      const hasActiveRequest = purchaseRequests.some(
        (request) =>
          request &&
          request.materialSku === item[FAB_CODE_INDEX] &&
          ["Requested", "Waiting for Cashier Approval", "Approved"].includes(
            request.status,
          ),
      );
      const requestButton = document.createElement("button");
      requestButton.type = "button";
      requestButton.className = "row-action";
      requestButton.textContent = hasActiveRequest
        ? "Requested"
        : "Request Purchase";
      requestButton.disabled = hasActiveRequest;
      if (!hasActiveRequest) {
        requestButton.addEventListener("click", () => {
          let requests = [];
          try {
            const storedRequests = window.backendMemoryStorage.getItem(
              PURCHASE_REQUESTS_STORAGE_KEY,
            );
            if (storedRequests !== null) {
              requests = JSON.parse(storedRequests);
              if (!Array.isArray(requests)) {
                throw new Error("Saved purchase requests must be a list.");
              }
            }
            const alreadyRequested = requests.some(
              (request) =>
                request &&
                request.materialSku === item[FAB_CODE_INDEX] &&
                ["Requested", "Waiting for Cashier Approval", "Approved"].includes(
                  request.status,
                ),
            );
            if (!alreadyRequested) {
              let requestedBy = "Inventory staff";
              try {
                const session = JSON.parse(
                  window.backendMemoryStorage.getItem("jorjetteangel-admin-session") || "null",
                );
                if (
                  session &&
                  typeof session.firstName === "string" &&
                  session.firstName.trim()
                ) {
                  requestedBy = session.firstName.trim();
                }
              } catch (error) {
                console.error("Could not read the requester identity.", error);
              }
              requests = window.arrayWithAppended(requests, {
                id:
                  item[FAB_CODE_INDEX] +
                  "-" +
                  String(Date.now()),
                materialSku: item[FAB_CODE_INDEX],
                materialName: item[FAB_NAME_INDEX],
                category: item[FAB_CATEGORY_INDEX],
                quantityOnHand: stock,
                requestedQuantity: Math.max(1, threshold - stock),
                unit: item[FAB_UNIT_INDEX],
                reorderThreshold: threshold,
                requestedBy,
                targetRole: "Cashier",
                status: "Waiting for Cashier Approval",
                requestedAt: new Date().toISOString(),
              });
              window.backendMemoryStorage.setItem(
                PURCHASE_REQUESTS_STORAGE_KEY,
                JSON.stringify(requests),
              );
            }
          } catch (error) {
            showFabToast(
              error instanceof Error
                ? error.message
                : "The purchase request could not be saved.",
              "error",
            );
            return;
          }
          showFabToast(
            "Purchase request sent to the cashier for approval.",
            "success",
          );
          renderLowStockAlerts();
        });
      }
      row.append(details, quantity, requestButton, editButton);
      lowStockList.appendChild(row);
    });
    if (lowStockEmpty) {
      lowStockEmpty.classList.toggle("hidden", lowStockMaterials.length > 0);
      lowStockEmpty.textContent = "There are no low-stock items in inventory.";
    }
  }

  function openLowStockModal() {
    if (!lowStockModal) return;
    renderLowStockAlerts();
    lowStockModal.classList.remove("hidden");
    lowStockModal.classList.add("flex");
  }

  function closeLowStockModal() {
    if (!lowStockModal) return;
    lowStockModal.classList.add("hidden");
    lowStockModal.classList.remove("flex");
  }

  function getFilteredFabMaterials() {
    const query = fabSearchInput
      ? fabSearchInput.value.trim().toLowerCase()
      : "";
    const catFilter = fabCategoryFilter ? fabCategoryFilter.value : "all";
    let filtered = [];

    let i = 0;
    while (i < fabMaterials.length) {
      const item = fabMaterials[i];
      const code = item[FAB_CODE_INDEX];
      const name = item[FAB_NAME_INDEX];
      const lot = item[FAB_LOT_INDEX];
      const cat = item[FAB_CATEGORY_INDEX];
      const unit = item[FAB_UNIT_INDEX];
      if (window.systemArchive.isArchived("materials", code)) {
        i += 1;
        continue;
      }

      let matchesCat = catFilter === "all" || cat === catFilter;
      let matchesSearch = true;

      if (query !== "") {
        matchesSearch =
          invContainsText(code, query) ||
          invContainsText(name, query) ||
          invContainsText(lot, query) ||
          invContainsText(cat, query) ||
          invContainsText(unit, query) ||
          invContainsText(item[FAB_SUPPLIER_NAME_INDEX], query) ||
          invContainsText(item[FAB_SUPPLIER_ID_INDEX], query);
      }

      if (matchesCat && matchesSearch) {
        filtered[filtered.length] = [
          i,
          code,
          name,
          lot,
          cat,
          Number(item[FAB_STOCK_INDEX]) || 0,
          unit,
          Number(item[FAB_COST_INDEX]) || 0,
          item[FAB_LAST_RESTOCKED_INDEX],
          Number(item[FAB_THRESHOLD_INDEX]) || 10,
          item[FAB_SUPPLIER_ID_INDEX] || "",
          item[FAB_SUPPLIER_NAME_INDEX] || "",
        ];
      }
      i += 1;
    }
    return filtered;
  }

  function renderFabMaterials() {
    if (!fabTableBody) return;

    updateFabKPIs();

    const filtered = getFilteredFabMaterials();
    const totalFiltered = filtered.length;

    if (fabShowingBadge) {
      fabShowingBadge.textContent =
        "Showing " +
        totalFiltered +
        (totalFiltered === 1 ? " material" : " materials");
    }

    while (fabTableBody.firstChild) {
      fabTableBody.removeChild(fabTableBody.firstChild);
    }

    if (totalFiltered === 0) {
      if (emptyFab) emptyFab.classList.remove("hidden");
      if (fabPaginationInfo)
        fabPaginationInfo.textContent = "Showing 0 of 0 entries";
      if (fabPaginationControls) {
        while (fabPaginationControls.firstChild) {
          fabPaginationControls.removeChild(fabPaginationControls.firstChild);
        }
      }
      return;
    }

    if (emptyFab) emptyFab.classList.add("hidden");

    let perPage = fabEntriesPerPage;
    if (perPage === "all" || perPage > totalFiltered) {
      perPage = totalFiltered;
    }

    const totalPages =
      perPage >= totalFiltered ? 1 : Math.ceil(totalFiltered / perPage);
    if (fabCurrentPage > totalPages) {
      fabCurrentPage = totalPages;
    }
    if (fabCurrentPage < 1) {
      fabCurrentPage = 1;
    }

    const startIdx = (fabCurrentPage - 1) * perPage;
    let endIdx = startIdx + perPage;
    if (endIdx > totalFiltered) {
      endIdx = totalFiltered;
    }

    let rowIdx = startIdx;
    while (rowIdx < endIdx) {
      const rowData = filtered[rowIdx];
      const origIdx = rowData[0];
      const code = rowData[1];
      const name = rowData[2];
      const cat = rowData[4];
      const stock = Number(rowData[5]) || 0;
      const unit = rowData[6];
      const cost = Number(rowData[7]) || 0;
      const lastRestocked = rowData[8];
      const threshold = Number(rowData[9]) || 10;
      const supplierId = rowData[10];
      const supplierSnapshot = rowData[11];
      const supplier = getFabSupplier(supplierId);
      const supplierName = supplier ? supplier[1] : supplierSnapshot;

      const tr = document.createElement("tr");
      tr.className = "transition-colors hover:bg-blue-50/30";

      const codeTd = document.createElement("td");
      codeTd.className =
        "whitespace-nowrap px-4 py-3.5 font-mono text-xs font-semibold text-blue-700";
      codeTd.textContent = code;
      tr.appendChild(codeTd);

      const nameTd = document.createElement("td");
      nameTd.className = "px-4 py-3.5";
      const nameDiv = document.createElement("div");
      nameDiv.className = "font-medium text-slate-900";
      nameDiv.textContent = name;
      nameTd.appendChild(nameDiv);
      tr.appendChild(nameTd);

      const supplierTd = document.createElement("td");
      supplierTd.className = "px-4 py-3.5 text-slate-600";
      supplierTd.textContent = supplierName
        ? String(supplierName) + (supplierId ? " · " + supplierId : "")
        : supplierId || "—";
      tr.appendChild(supplierTd);

      const stockTd = document.createElement("td");
      stockTd.className =
        "whitespace-nowrap px-4 py-3.5 font-medium text-slate-800";
      const formattedStock =
        stock % 1 === 0 ? formatQuantity(stock) : stock.toFixed(2);
      stockTd.textContent = formattedStock + " " + unit;
      tr.appendChild(stockTd);

      const statusTd = document.createElement("td");
      statusTd.className = "whitespace-nowrap px-4 py-3.5 text-center";
      const badge = document.createElement("span");
      const statusDot = document.createElement("span");
      statusDot.className = "h-1.5 w-1.5 rounded-full";

      if (stock === 0) {
        badge.className =
          "inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 border border-red-200/60";
        statusDot.className += " bg-red-500";
        badge.appendChild(statusDot);
        badge.appendChild(document.createTextNode("Out of Stock"));
      } else if (stock <= threshold) {
        badge.className =
          "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200/60";
        statusDot.className += " bg-amber-500";
        badge.appendChild(statusDot);
        badge.appendChild(document.createTextNode("Low"));
      } else {
        badge.className =
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60";
        statusDot.className += " bg-emerald-500";
        badge.appendChild(statusDot);
        badge.appendChild(document.createTextNode("Good"));
      }
      statusTd.appendChild(badge);
      tr.appendChild(statusTd);

      const costTd = document.createElement("td");
      costTd.className =
        "whitespace-nowrap px-4 py-3.5 text-right font-medium text-slate-800";
      costTd.textContent = "₱" + cost.toFixed(2);
      tr.appendChild(costTd);

      const actTd = document.createElement("td");
      actTd.className = "whitespace-nowrap px-4 py-3.5 text-center";
      const actBox = document.createElement("div");
      actBox.className = "inline-flex items-center justify-center";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.setAttribute("data-fab-action", "edit");
      editBtn.setAttribute("data-fab-idx", String(origIdx));
      editBtn.title = "Edit Material";
      editBtn.className =
        "mr-1 inline-flex h-9 w-9 items-center justify-center rounded text-slate-600 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";
      editBtn.innerHTML =
        '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="m16.5 5.5 2 2M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"/></svg>';

      const archiveBtn = document.createElement("button");
      archiveBtn.type = "button";
      archiveBtn.setAttribute("data-fab-action", "archive");
      archiveBtn.setAttribute("data-fab-idx", String(origIdx));
      archiveBtn.title = "Archive Material";
      archiveBtn.setAttribute("aria-label", "Archive " + name);
      archiveBtn.className =
        "inline-flex h-9 w-9 items-center justify-center rounded text-slate-600 hover:bg-amber-50 hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2";
      archiveBtn.innerHTML =
        '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5h18v12H3v-12Zm-1-4h20v4H2v-4Zm6 8h8"/></svg>';

      actBox.appendChild(editBtn);
      actBox.appendChild(archiveBtn);
      actTd.appendChild(actBox);
      tr.appendChild(actTd);

      fabTableBody.appendChild(tr);
      rowIdx += 1;
    }

    if (fabPaginationInfo) {
      fabPaginationInfo.textContent =
        "Showing " +
        (startIdx + 1) +
        " to " +
        endIdx +
        " of " +
        totalFiltered +
        " entries";
    }

    if (fabPaginationControls) {
      while (fabPaginationControls.firstChild) {
        fabPaginationControls.removeChild(fabPaginationControls.firstChild);
      }

      if (totalPages > 1) {
        const prevBtn = document.createElement("button");
        prevBtn.type = "button";
        prevBtn.textContent = "Previous";
        prevBtn.className =
          "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40";
        prevBtn.disabled = fabCurrentPage <= 1;
        prevBtn.addEventListener("click", function () {
          if (fabCurrentPage > 1) {
            fabCurrentPage -= 1;
            renderFabMaterials();
          }
        });
        fabPaginationControls.appendChild(prevBtn);

        let p = 1;
        while (p <= totalPages) {
          const pageBtn = document.createElement("button");
          pageBtn.type = "button";
          pageBtn.textContent = String(p);
          const isCurrent = p === fabCurrentPage;
          pageBtn.className = isCurrent
            ? "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
            : "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";
          const targetPage = p;
          pageBtn.addEventListener("click", function () {
            fabCurrentPage = targetPage;
            renderFabMaterials();
          });
          fabPaginationControls.appendChild(pageBtn);
          p += 1;
        }

        const nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.textContent = "Next";
        nextBtn.className =
          "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40";
        nextBtn.disabled = fabCurrentPage >= totalPages;
        nextBtn.addEventListener("click", function () {
          if (fabCurrentPage < totalPages) {
            fabCurrentPage += 1;
            renderFabMaterials();
          }
        });
        fabPaginationControls.appendChild(nextBtn);
      }
    }
  }

  function openAddMaterialModal() {
    if (!fabModal) return;
    if (fabEditIndexInput) fabEditIndexInput.value = "-1";
    if (fabModalTitle) fabModalTitle.textContent = "Add Raw Material";
    if (fabMaterialForm) fabMaterialForm.reset();
    refreshFabSupplierOptions();
    if (fabInputCode) fabInputCode.value = getNextFabMaterialId();
    if (fabInputStock) fabInputStock.value = "0";
    if (fabInputCost) fabInputCost.value = "0";
    if (fabInputThreshold) fabInputThreshold.value = "10";
    fabModal.classList.remove("hidden");
    fabModal.classList.add("flex");
    if (fabInputName) fabInputName.focus();
  }

  function openEditMaterialModal(idx) {
    if (!fabModal || idx < 0 || idx >= fabMaterials.length) return;
    const item = fabMaterials[idx];
    if (fabEditIndexInput) fabEditIndexInput.value = String(idx);
    if (fabModalTitle) fabModalTitle.textContent = "Edit Raw Material";
    if (fabInputCode) fabInputCode.value = item[FAB_CODE_INDEX];
    if (fabInputName) fabInputName.value = item[FAB_NAME_INDEX];
    if (fabInputCategory) fabInputCategory.value = item[FAB_CATEGORY_INDEX];
    if (fabInputUnit) fabInputUnit.value = item[FAB_UNIT_INDEX];
    if (fabInputStock) fabInputStock.value = item[FAB_STOCK_INDEX];
    if (fabInputCost) fabInputCost.value = item[FAB_COST_INDEX];
    if (fabInputThreshold) fabInputThreshold.value = item[FAB_THRESHOLD_INDEX];
    refreshFabSupplierOptions(item[FAB_SUPPLIER_ID_INDEX] || "");
    fabModal.classList.remove("hidden");
    fabModal.classList.add("flex");
    if (fabInputName) fabInputName.focus();
  }

  function closeMaterialModal() {
    if (fabModal) {
      fabModal.classList.add("hidden");
      fabModal.classList.remove("flex");
    }
  }

  if (fabSearchInput) {
    fabSearchInput.addEventListener("input", function () {
      fabCurrentPage = 1;
      renderFabMaterials();
    });
  }

  if (fabCategoryFilter) {
    fabCategoryFilter.addEventListener("change", function () {
      fabCurrentPage = 1;
      renderFabMaterials();
    });
  }

  if (fabEntriesSelect) {
    fabEntriesSelect.addEventListener("change", function () {
      const val = fabEntriesSelect.value;
      fabEntriesPerPage = val === "all" ? "all" : Number(val);
      fabCurrentPage = 1;
      renderFabMaterials();
    });
  }

  if (fabBtnAdd) fabBtnAdd.addEventListener("click", openAddMaterialModal);
  if (lowStockViewButton) {
    lowStockViewButton.addEventListener("click", openLowStockModal);
  }
  if (lowStockModalClose) {
    lowStockModalClose.addEventListener("click", closeLowStockModal);
  }
  if (lowStockModal) {
    lowStockModal.addEventListener("click", (event) => {
      if (event.target === lowStockModal) closeLowStockModal();
    });
  }
  if (fabModalClose)
    fabModalClose.addEventListener("click", closeMaterialModal);
  if (fabBtnCancel) fabBtnCancel.addEventListener("click", closeMaterialModal);
  if (fabBtnAddCategory) {
    fabBtnAddCategory.addEventListener("click", openFabCategoryModal);
  }
  if (fabCategoryModalClose) {
    fabCategoryModalClose.addEventListener("click", closeFabCategoryModal);
  }
  if (fabCategoryCancel) {
    fabCategoryCancel.addEventListener("click", closeFabCategoryModal);
  }

  if (fabCategoryForm) {
    fabCategoryForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const categoryName = fabCategoryName.value.trim();
      if (!categoryName) {
        showFabToast("Enter a name for the material category.", "error");
        fabCategoryName.focus();
        return;
      }

      try {
        const categories = readFabCategories();
        const existingCategory = categories.find(
          (category) => category.toLowerCase() === categoryName.toLowerCase(),
        );
        if (existingCategory) {
          showFabToast(
            "The material category '" + existingCategory + "' already exists.",
            "error",
          );
          fabCategoryName.focus();
          return;
        }

        let savedCategories = categories.filter(
          (category) =>
            !DEFAULT_FAB_CATEGORIES.some(
              (builtIn) => builtIn.toLowerCase() === category.toLowerCase(),
            ),
        );
        savedCategories = window.arrayWithAppended(
          savedCategories,
          categoryName,
        );
        window.backendMemoryStorage.setItem(
          FAB_CATEGORIES_STORAGE_KEY,
          JSON.stringify(savedCategories),
        );
        refreshFabCategoryOptions(
          categoryName,
          fabCategoryFilter?.value || "all",
        );
        closeFabCategoryModal();
        showFabToast(
          "Material category '" + categoryName + "' added successfully.",
          "success",
        );
      } catch (error) {
        showFabToast(
          error instanceof Error
            ? error.message
            : "Unable to save the material category.",
          "error",
        );
      }
    });
  }

  if (fabMaterialForm) {
    fabMaterialForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const editIdx = Number(fabEditIndexInput.value);
      const code =
        editIdx >= 0 && editIdx < fabMaterials.length
          ? fabMaterials[editIdx][FAB_CODE_INDEX]
          : getNextFabMaterialId();
      const lot =
        editIdx >= 0 && editIdx < fabMaterials.length
          ? fabMaterials[editIdx][FAB_LOT_INDEX]
          : "";
      const name = fabInputName.value.trim();
      const cat = fabInputCategory.value;
      const unit = fabInputUnit.value;
      const stock = Number(fabInputStock.value) || 0;
      const cost = Number(fabInputCost.value) || 0;
      const threshold = Number(fabInputThreshold.value) || 10;
      const supplierId = fabInputSupplier?.value || "";
      const supplier = supplierId ? getFabSupplier(supplierId) : null;
      if (supplierId && !supplier) {
        showFabToast(
          "Select a supplier that still exists in Supplier Directory.",
          "error",
        );
        return;
      }
      if (
        supplierId &&
        (supplier[6] || "Active") !== "Active" &&
        (fabMaterials[editIdx]?.[FAB_SUPPLIER_ID_INDEX] || "") !== supplierId
      ) {
        showFabToast(
          "Only active suppliers can be assigned to a raw material.",
          "error",
        );
        return;
      }
      if (
        supplierId &&
        window.systemArchive.isArchived("suppliers", supplierId) &&
        (fabMaterials[editIdx]?.[FAB_SUPPLIER_ID_INDEX] || "") !== supplierId
      ) {
        showFabToast(
          "Only active suppliers can be assigned to a raw material.",
          "error",
        );
        return;
      }
      const supplierName = supplier ? String(supplier[1]) : "";
      const todayStr = "03/05/2026";

      let i = 0;
      while (i < fabMaterials.length) {
        if (
          i !== editIdx &&
          fabMaterials[i][FAB_CODE_INDEX].toUpperCase() === code
        ) {
          showFabToast(
            "A material with ID '" + code + "' already exists.",
            "error",
          );
          return;
        }
        i += 1;
      }

      if (editIdx >= 0 && editIdx < fabMaterials.length) {
        fabMaterials[editIdx] = [
          code,
          name,
          lot,
          cat,
          stock,
          unit,
          cost,
          todayStr,
          threshold,
          supplierId,
          supplierName,
        ];
        saveFabMaterials();
        renderFabMaterials();
        closeMaterialModal();
        showFabToast(
          "Material '" + name + "' updated successfully.",
          "success",
        );
      } else {
        fabMaterials[fabMaterials.length] = [
          code,
          name,
          lot,
          cat,
          stock,
          unit,
          cost,
          todayStr,
          threshold,
          supplierId,
          supplierName,
        ];
        saveFabMaterials();
        renderFabMaterials();
        closeMaterialModal();
        showFabToast(
          "Raw material '" + name + "' added successfully.",
          "success",
        );
      }
    });
  }

  if (fabTableBody) {
    fabTableBody.addEventListener("click", function (event) {
      let target = event.target;
      while (
        target &&
        target !== fabTableBody &&
        !target.hasAttribute("data-fab-action")
      ) {
        target = target.parentElement;
      }
      if (!target || target === fabTableBody) return;

      const action = target.getAttribute("data-fab-action");
      const idx = Number(target.getAttribute("data-fab-idx"));
      if (idx < 0 || idx >= fabMaterials.length) return;

      const item = fabMaterials[idx];
      const name = item[FAB_NAME_INDEX];
      const code = item[FAB_CODE_INDEX];

      if (action === "edit") {
        openEditMaterialModal(idx);
        return;
      }

      if (action === "archive") {
        if (
          window.confirm(
            "Archive material '" +
              name +
              "' (" +
              code +
              ")? It will be hidden from active inventory and can be restored from System & Security > Archive.",
          )
        ) {
          window.systemArchive.archive(
            "materials",
            code,
            name,
            code + " · " + item[FAB_CATEGORY_INDEX],
            item,
          );
          renderFabMaterials();
          updateFabKPIs();
          renderLowStockAlerts();
          showFabToast("Material '" + name + "' was archived.", "success");
        }
      }
    });
  }

  window.addEventListener("storage", function (event) {
    if (event.key === FAB_STORAGE_KEY) {
      loadFabMaterials();
      refreshFabCategoryOptions();
      renderFabMaterials();
    } else if (event.key === FAB_CATEGORIES_STORAGE_KEY) {
      refreshFabCategoryOptions();
      renderFabMaterials();
    } else if (event.key === SUPPLIER_DIRECTORY_KEY) {
      refreshFabSupplierOptions(fabInputSupplier?.value || "");
      renderFabMaterials();
    }
  });

  loadFabMaterials();
  refreshFabCategoryOptions();
  refreshFabSupplierOptions();
  renderFabMaterials();
})();

(() => {
  const BOM_RECIPES_KEY = "jg-erp-bom-recipes-v1";
  const PRODUCT_CATALOG_KEY = "jorjetteangel-admin-catalog";
  const CUSTOMER_ORDERS_KEY = "jorjetteangel-orders";
  const BOM_OPERATION_EVENTS_KEY = "jg-erp-bom-operation-events-v1";
  const ADMIN_ALERTS_KEY = "jorjetteangel-admin-alerts";
  const recipeTableBody = document.querySelector("#bom-table-body");
  const customSpecTableBody = document.querySelector("#bom-custom-table-body");
  const customSpecEmpty = document.querySelector("#bom-custom-empty");
  const customSpecShowingInfo = document.querySelector(
    "#bom-custom-showing-info",
  );
  const customSpecModal = document.querySelector("#bom-custom-modal");
  const customSpecForm = document.querySelector("#bom-custom-form");
  const customSpecOrderDetails = document.querySelector(
    "#bom-custom-order-details",
  );
  const customSpecSizeFields = document.querySelector(
    "#bom-custom-size-fields",
  );
  const customSpecSizeEmpty = document.querySelector("#bom-custom-size-empty");
  const customSpecModalClose = document.querySelector(
    "#bom-custom-modal-close",
  );
  const customSpecCancelButton = document.querySelector("#bom-custom-cancel");
  const recipeTodoTableBody = document.querySelector("#bom-todo-table-body");
  const recipeTodoSummaryCount = document.querySelector(
    "#bom-todo-summary-count",
  );
  const recipeTodoEmpty = document.querySelector("#bom-todo-empty");
  const recipeTodoViewButton = document.querySelector("#bom-view-todo");
  const recipeTodoModal = document.querySelector("#bom-todo-modal");
  const recipeTodoCloseButton = document.querySelector("#bom-todo-close");
  const recipeSearchInput = document.querySelector("#bom-search-input");
  const customSpecSearchInput = document.querySelector(
    "#bom-custom-search-input",
  );
  const recipeEmptyState = document.querySelector("#bom-empty-state");
  const recipeShowingInfo = document.querySelector("#bom-showing-info");
  const recipeAddButton = document.querySelector("#bom-btn-add");
  const recipeModal = document.querySelector("#bom-modal");
  const recipeForm = document.querySelector("#bom-form");
  const recipeModalTitle = document.querySelector("#bom-modal-title");
  const recipeEditId = document.querySelector("#bom-edit-id");
  const recipeProduct = document.querySelector("#bom-product");
  const recipeSize = document.querySelector("#bom-size");
  const recipeMaterialRows = document.querySelector("#bom-material-rows");
  const recipeAddMaterialButton = document.querySelector("#bom-add-material");
  const recipeCalculatedCost = document.querySelector("#bom-calculated-cost");
  const recipeModalClose = document.querySelector("#bom-modal-close");
  const recipeCancelButton = document.querySelector("#bom-cancel");
  const toast = document.querySelector("#toast");
  const recipeTabs = document.querySelectorAll("[data-tab-target]");
  const recipePanels = document.querySelectorAll("[data-tab-panel]");
  let recipes = [];
  let activeCustomOrder = null;
  let toastTimeout;
  const STANDARD_BOM_SIZES = ["Small", "Medium", "Large", "XL"];

  function getMaterials() {
    try {
      const stored = JSON.parse(
        window.backendMemoryStorage.getItem("jg-erp-fabrics-materials-v1"),
      );
      if (!Array.isArray(stored)) {
        throw new Error("Raw material data must be a list.");
      }
      return stored.filter(
        (material) =>
          Array.isArray(material) &&
          !window.systemArchive.isArchived("materials", material[0]),
      );
    } catch (error) {
      showRecipeToast(
        error instanceof Error
          ? error.message
          : "Raw materials could not be loaded.",
        true,
      );
      return [];
    }
  }

  function getProductCatalog() {
    const savedCatalog = window.backendMemoryStorage.getItem(PRODUCT_CATALOG_KEY);
    if (!savedCatalog) return [];

    let catalog;
    try {
      catalog = JSON.parse(savedCatalog);
    } catch (error) {
      showRecipeToast("Product Management data is invalid.", true);
      return [];
    }

    if (!catalog || !Array.isArray(catalog.products)) {
      showRecipeToast("Product Management data is unavailable.", true);
      return [];
    }

    return catalog.products.filter(
      (product) =>
        product &&
        typeof product.id === "string" &&
        product.id.trim() &&
        typeof product.name === "string" &&
        product.name.trim() &&
        product.status !== "Archived",
    );
  }

  function populateRecipeProducts(selectedProductId = "") {
    const products = getProductCatalog().filter(productUsesStandardSizing);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = products.length
      ? "Select a product"
      : "No active products in Product Management";

    const productOptions = products.map((product) => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent = product.id + " - " + product.name;
      return option;
    });
    recipeProduct.replaceChildren(placeholder, ...productOptions);
    recipeProduct.value = selectedProductId;
    return products;
  }

  function normalizeRecipeMaterialCode(code) {
    const legacySequence = /^0*(\d+)$/.exec(String(code || ""));
    if (!legacySequence) return code;
    return "SKU-RAW-" + legacySequence[1].padStart(4, "0");
  }

  function normalizeBomSize(size) {
    const normalizedSize = String(size || "").trim().toLowerCase();
    if (normalizedSize === "s" || normalizedSize === "small") return "Small";
    if (normalizedSize === "m" || normalizedSize === "medium") return "Medium";
    if (normalizedSize === "l" || normalizedSize === "large") return "Large";
    if (
      normalizedSize === "xl" ||
      normalizedSize === "x-large" ||
      normalizedSize === "extra large"
    ) {
      return "XL";
    }
    return "";
  }

  function findBomRecipe(productId, size) {
    return recipes.find(
      (recipe) =>
        recipe.productId === productId &&
        normalizeBomSize(recipe.size) === normalizeBomSize(size) &&
        !window.systemArchive.isArchived("bom", recipe.id),
    );
  }

  function writeBomOperationEvent(context) {
    context = context && typeof context === "object" ? context : {};
    const productName = String(
      context.productName || context.productId || "This item",
    );
    const productId = String(context.productId || "");
    const size = String(context.size || "unspecified size");
    const orderReference = String(
      context.orderReference || context.orderId || "unknown-order",
    );
    const lineId = String(
      context.orderItemId ||
        context.itemIndex ||
        productId + "::" + size,
    );
    const eventId = [
      "bom-missing-recipe",
      orderReference,
      lineId,
    ].join("::");
    let events = [];
    try {
      const storedEvents = window.backendMemoryStorage.getItem(BOM_OPERATION_EVENTS_KEY);
      events = storedEvents === null ? [] : JSON.parse(storedEvents);
      if (!Array.isArray(events)) {
        throw new Error("Saved BOM operation events must be a list.");
      }
      const existingEvent = events.find(
        (event) => event && event.id === eventId,
      );
      if (existingEvent) {
        if (context.notifyExisting !== false) {
          showRecipeToast(existingEvent.message, true);
        }
        return existingEvent;
      }

      let alerts = [];
      const storedAlerts = window.backendMemoryStorage.getItem(ADMIN_ALERTS_KEY);
      alerts = storedAlerts === null ? [] : JSON.parse(storedAlerts);
      if (!Array.isArray(alerts)) {
        throw new Error("Saved admin alerts must be a list.");
      }
      const message =
        "Cannot process " +
        productName +
        " (" +
        size +
        "): no BOM recipe is defined. Create the recipe, then retry.";
      const event = {
        id: eventId,
        eventType: "bom.missing_recipe",
        source: "fabrics-bom",
        severity: "CRITICAL",
        title: "BOM recipe required",
        message,
        orderReference,
        orderItemId: lineId,
        productId,
        productName,
        size,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };
      events = window.arrayWithAppended(events, event);
      if (!alerts.some((alert) => alert && alert.id === eventId)) {
        alerts = window.arrayWithAppended(alerts, {
          id: eventId,
          type: event.eventType,
          source: event.source,
          severity: event.severity,
          title: event.title,
          message: event.message,
          timestamp: event.timestamp,
          acknowledged: false,
          orderReference,
          productId,
          size,
        });
      }
      window.backendMemoryStorage.setItem(ADMIN_ALERTS_KEY, JSON.stringify(alerts));
      window.backendMemoryStorage.setItem(BOM_OPERATION_EVENTS_KEY, JSON.stringify(events));
      window.dispatchEvent(
        new CustomEvent("bomOperationEvent", { detail: event }),
      );
      showRecipeToast(event.message, true);
      return event;
    } catch (error) {
      showRecipeToast(
        error instanceof Error
          ? error.message
          : "The missing-BOM notification could not be saved.",
        true,
      );
      return null;
    }
  }

  function inspectProductionBomAttempts(orders = readCustomerOrders()) {
    orders.forEach((order, orderIndex) => {
      if (!Array.isArray(order?.items)) return;
      order.items.forEach((item, itemIndex) => {
        const status = String(item?.productionStatus || "").toLowerCase();
        if (!["cutting", "in production"].includes(status)) return;
        if (
          String(item.size || "").toLowerCase() === "custom" &&
          item.customMeasurements &&
          typeof item.customMeasurements === "object" &&
          !Array.isArray(item.customMeasurements) &&
          Object.keys(item.customMeasurements).length > 0
        ) return;
        if (findBomRecipe(item.productId, item.size)) return;
        const product = getProductCatalog().find(
          (entry) => entry.id === item.productId,
        );
        writeBomOperationEvent({
          orderReference: order.reference || order.orderId,
          orderItemId: item.orderId,
          itemIndex,
          productId: item.productId,
          productName: product?.name || item.name,
          size: item.size,
          notifyExisting: false,
        });
      });
    });
  }

  window.JG_BOM_EVENTS = Object.assign(window.JG_BOM_EVENTS || {}, {
    recordMissingRecipe: writeBomOperationEvent,
  });
  try {
    if (window.top && window.top !== window) {
      window.top.JG_BOM_EVENTS = Object.assign(
        window.top.JG_BOM_EVENTS || {},
        window.JG_BOM_EVENTS,
      );
    }
  } catch (error) {
    console.error("Could not expose BOM notification bridge.", error);
  }

  function productUsesStandardSizing(product) {
    if (typeof product.offerRegularSizing === "boolean") {
      return product.offerRegularSizing;
    }
    return product.sizeMode !== "none";
  }

  function getCustomSizingFields(product) {
    if (!Array.isArray(product?.customFields)) return [];
    return product.customFields
      .map((field) =>
        typeof field === "string"
          ? { name: field.trim(), unit: "in", minimum: "", maximum: "" }
          : {
              name: String(field?.name || "").trim(),
              unit: field?.unit === "cm" ? "cm" : "in",
              minimum: field?.minimum ?? "",
              maximum: field?.maximum ?? "",
            },
      )
      .filter((field) => field.name);
  }

  function readCustomerOrders() {
    try {
      const stored = window.backendMemoryStorage.getItem(CUSTOMER_ORDERS_KEY);
      if (stored === null) return [];
      const orders = JSON.parse(stored);
      if (!Array.isArray(orders)) {
        throw new Error("Saved customer orders must be an array.");
      }
      return orders;
    } catch (error) {
      showRecipeToast(
        error instanceof Error
          ? error.message
          : "Customer orders could not be loaded.",
        true,
      );
      return [];
    }
  }

  function getCustomOrderItems(orders = readCustomerOrders()) {
    let customItems = [];
    orders.forEach((order, orderIndex) => {
      if (!order || typeof order !== "object" || !Array.isArray(order.items)) {
        return;
      }
      order.items.forEach((item, itemIndex) => {
        if (
          !item ||
          typeof item !== "object" ||
          String(item.size || "").toLowerCase() !== "custom" ||
          !item.customMeasurements ||
          typeof item.customMeasurements !== "object" ||
          Array.isArray(item.customMeasurements) ||
          Object.keys(item.customMeasurements).length === 0
        ) {
          return;
        }
        customItems = window.arrayWithAppended(customItems, {
          order,
          orderIndex,
          item,
          itemIndex,
          orderId: item.orderId || order.reference || "Order",
        });
      });
    });
    return customItems;
  }

  function getCustomMeasurementFields(item) {
    const measurements = item.customMeasurements;
    const product = getProductCatalog().find(
      (entry) => entry.id === item.productId,
    );
    const configuredFields = getCustomSizingFields(product);
    let fields = configuredFields
      .filter((field) =>
        Object.prototype.hasOwnProperty.call(measurements, field.name),
      )
      .map((field) => ({ ...field, value: measurements[field.name] }));
    Object.keys(measurements).forEach((name) => {
      if (fields.some((field) => field.name === name)) return;
      fields = window.arrayWithAppended(fields, {
        name,
        unit: "in",
        minimum: "",
        maximum: "",
        value: measurements[name],
      });
    });
    return fields;
  }

  function getPendingBomRecipes() {
    const products = getProductCatalog().filter(productUsesStandardSizing);
    let pending = [];
    products.forEach((product) => {
      STANDARD_BOM_SIZES.forEach((size) => {
        const hasRecipe = recipes.some(
          (recipe) =>
            !window.systemArchive.isArchived("bom", recipe.id) &&
            recipe.productId === product.id &&
            normalizeBomSize(recipe.size) === size,
        );
        if (!hasRecipe) {
          pending = window.arrayWithAppended(pending, { product, size });
        }
      });
    });
    return pending;
  }

  function getMaterial(code) {
    const materials = getMaterials();
    return materials.find((item) => String(item[0]) === String(code));
  }

  function formatBomCost(value) {
    return (
      "₱" +
      (Number(value) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function showRecipeToast(message, isError) {
    if (!toast) return;
    toast.textContent = message;
    toast.className =
      "pointer-events-none fixed right-4 top-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-medium shadow-lg " +
      (isError
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.add("hidden"), 4000);
  }

  function calculateRecipeCost(recipe) {
    let total = 0;
    recipe.materials.forEach((ingredient) => {
      const material = getMaterial(ingredient.code);
      if (material)
        total += Number(ingredient.quantity) * Number(material[6] || 0);
    });
    return total;
  }

  function formatRecipeMaterials(materials) {
    return materials
      .map((ingredient) => {
        const material = getMaterial(ingredient.code);
        if (!material) return ingredient.code + " x " + ingredient.quantity;
        const unit = material[5] === "meters" ? "m" : material[5];
        return ingredient.quantity + " " + unit + " " + material[1];
      })
      .join(", ");
  }

  function renderCustomSpecifications() {
    if (!customSpecTableBody) return;
    const query = customSpecSearchInput.value.trim().toLowerCase();
    const filtered = getCustomOrderItems().filter(({ order, item, orderId }) => {
      const measurements = getCustomMeasurementFields(item)
        .map((field) => field.name + " " + field.value)
        .join(" ");
      const product = getProductCatalog().find(
        (entry) => entry.id === item.productId,
      );
      return [
        orderId,
        order.reference,
        item.productId,
        item.name,
        product?.name,
        order.customer?.name,
        measurements,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    customSpecTableBody.replaceChildren();
    if (customSpecEmpty) {
      customSpecEmpty.classList.toggle("hidden", filtered.length > 0);
    }
    if (customSpecShowingInfo) {
      customSpecShowingInfo.textContent =
        filtered.length + (filtered.length === 1 ? " custom order item" : " custom order items");
    }
    filtered.forEach((customOrder) => {
      const { order, item, orderId } = customOrder;
      const row = document.createElement("tr");
      const orderIdCell = document.createElement("td");
      orderIdCell.className = "font-mono text-xs font-semibold text-slate-700";
      orderIdCell.textContent = orderId;
      const productIdCell = document.createElement("td");
      productIdCell.className =
        "font-mono text-xs font-semibold text-slate-700";
      productIdCell.textContent = item.productId || "—";
      const itemNameCell = document.createElement("td");
      itemNameCell.textContent = item.name || "Unnamed item";
      const sizingCell = document.createElement("td");
      sizingCell.textContent = getCustomMeasurementFields(item)
        .map((measurement) =>
          measurement.name +
          ": " +
          measurement.value +
          " " +
          measurement.unit,
        )
        .join(", ");
      const actionCell = document.createElement("td");
      actionCell.className = "action-cell";
      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "row-action";
      viewButton.textContent = "View";
      viewButton.addEventListener("click", () =>
        openCustomSpecificationModal(customOrder, true),
      );
      const modifyButton = document.createElement("button");
      modifyButton.type = "button";
      modifyButton.className = "row-action";
      modifyButton.textContent = "Modify";
      modifyButton.addEventListener("click", () =>
        openCustomSpecificationModal(customOrder),
      );
      actionCell.append(viewButton, modifyButton);
      row.append(
        orderIdCell,
        productIdCell,
        itemNameCell,
        sizingCell,
        actionCell,
      );
      customSpecTableBody.appendChild(row);
    });
  }

  function renderRecipes() {
    if (!recipeTableBody) return;
    const query = recipeSearchInput.value.trim().toLowerCase();
    const filtered = recipes.filter((recipe) =>
      !window.systemArchive.isArchived("bom", recipe.id) &&
      normalizeBomSize(recipe.size) &&
      (recipe.productId + " " + recipe.productName + " " + recipe.size)
        .toLowerCase()
        .includes(query),
    );

    recipeTableBody.replaceChildren();
    if (recipeEmptyState)
      recipeEmptyState.classList.toggle("hidden", filtered.length > 0);
    if (recipeShowingInfo) {
      recipeShowingInfo.textContent =
        filtered.length + (filtered.length === 1 ? " recipe" : " recipes");
    }

    const allPending = getPendingBomRecipes();
    const pending = allPending.filter(({ product, size }) =>
      (product.id + " " + product.name + " " + size)
        .toLowerCase()
        .includes(query),
    );
    if (recipeTodoTableBody) recipeTodoTableBody.replaceChildren();
    if (recipeTodoSummaryCount) {
      recipeTodoSummaryCount.textContent = String(allPending.length);
    }
    if (recipeTodoEmpty) {
      recipeTodoEmpty.classList.toggle("hidden", pending.length > 0);
      const hasStandardProducts = getProductCatalog().some(
        productUsesStandardSizing,
      );
      recipeTodoEmpty.textContent = query
        ? "No pending BOM recipes match your search."
        : hasStandardProducts
          ? "All standard product sizes have BOM recipes."
          : "No active standard-sized products in Product Management.";
    }
    pending.forEach(({ product, size }) => {
      const row = document.createElement("tr");
      const productIdCell = document.createElement("td");
      productIdCell.className = "font-mono text-xs font-semibold text-slate-700";
      productIdCell.textContent = product.id;
      const productSizeCell = document.createElement("td");
      productSizeCell.textContent = product.name + " (" + size + ")";
      const actionCell = document.createElement("td");
      actionCell.className = "action-cell";
      const createButton = document.createElement("button");
      createButton.type = "button";
      createButton.className = "row-action";
      createButton.textContent = "Create BOM";
      createButton.addEventListener("click", () =>
        openRecipeModal(null, { productId: product.id, size }),
      );
      actionCell.appendChild(createButton);
      row.append(productIdCell, productSizeCell, actionCell);
      if (recipeTodoTableBody) recipeTodoTableBody.appendChild(row);
    });

    filtered.forEach((recipe) => {
      const row = document.createElement("tr");
      const productIdCell = document.createElement("td");
      productIdCell.className =
        "font-mono text-xs font-semibold text-slate-700";
      productIdCell.textContent = recipe.productId;
      const garmentCell = document.createElement("td");
      garmentCell.textContent = recipe.productName + " (" + recipe.size + ")";
      const requirementsCell = document.createElement("td");
      requirementsCell.className = "recipe-requirements";
      requirementsCell.textContent = formatRecipeMaterials(recipe.materials);
      const costCell = document.createElement("td");
      costCell.className = "numeric-cell font-semibold";
      costCell.textContent = formatBomCost(calculateRecipeCost(recipe));
      const actionCell = document.createElement("td");
      actionCell.className = "action-cell";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "row-action";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => openRecipeModal(recipe));
      const archiveButton = document.createElement("button");
      archiveButton.type = "button";
      archiveButton.className = "row-action row-action-archive";
      archiveButton.textContent = "Archive";
      archiveButton.addEventListener("click", () => {
        if (
          !window.confirm(
            "Archive this BOM recipe? It will be hidden from active recipes and can be restored from System & Security > Archive.",
          )
        ) return;
        window.systemArchive.archive(
          "bom",
          recipe.id,
          recipe.productName + " (" + recipe.size + ")",
          recipe.productId,
          recipe,
        );
        renderRecipes();
      });
      actionCell.append(editButton, archiveButton);
      row.append(
        productIdCell,
        garmentCell,
        requirementsCell,
        costCell,
        actionCell,
      );
      recipeTableBody.appendChild(row);
    });
    renderCustomSpecifications();
  }

  function saveRecipes() {
    try {
      window.backendMemoryStorage.setItem(BOM_RECIPES_KEY, JSON.stringify(recipes));
      return true;
    } catch (error) {
      showRecipeToast("BOM recipes could not be saved in this browser.", true);
      return false;
    }
  }

  function loadRecipes() {
    try {
      const stored = JSON.parse(window.backendMemoryStorage.getItem(BOM_RECIPES_KEY));
      recipes = Array.isArray(stored) ? stored : [];
    } catch (error) {
      showRecipeToast("Saved BOM recipes are invalid.", true);
      recipes = [];
    }

    let needsMigration = false;
    recipes = recipes.map((recipe) => {
      const materials = Array.isArray(recipe.materials)
        ? recipe.materials.map((material) => {
            const code = normalizeRecipeMaterialCode(material.code);
            if (code !== material.code) needsMigration = true;
            return { ...material, code };
          })
        : [];
      return { ...recipe, materials };
    });
    if (needsMigration) {
      saveRecipes();
    }
  }

  function getRecipeIngredients(container) {
    return Array.from(
      container.querySelectorAll(".bom-material-row"),
    )
      .map((row) => ({
        code: row.querySelector("[data-bom-material]").value,
        quantity: Number(row.querySelector("[data-bom-quantity]").value) || 0,
      }))
      .filter((item) => item.code && item.quantity > 0);
  }

  function updateRecipeCost() {
    recipeCalculatedCost.textContent = formatBomCost(
      calculateRecipeCost({
        materials: getRecipeIngredients(recipeMaterialRows),
      }),
    );
  }

  function addRecipeMaterialRow(
    code,
    quantity,
    container = recipeMaterialRows,
    updateCost = updateRecipeCost,
  ) {
    const row = document.createElement("div");
    row.className = "bom-material-row";
    const select = document.createElement("select");
    select.className = "field-control material-choice";
    select.setAttribute("data-bom-material", "");
    select.setAttribute("aria-label", "Raw material");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select material";
    select.appendChild(placeholder);
    getMaterials().forEach((material) => {
      const option = document.createElement("option");
      option.value = material[0];
      option.textContent = material[0] + " - " + material[1];
      select.appendChild(option);
    });
    if (code) select.value = code;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0.01";
    input.step = "any";
    input.value = quantity || "1";
    input.className = "field-control quantity-choice";
    input.setAttribute("data-bom-quantity", "");
    input.setAttribute("aria-label", "Required quantity");

    const unit = document.createElement("span");
    unit.className = "ingredient-unit";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-ingredient";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      row.remove();
      updateCost();
    });

    function updateUnit() {
      const material = getMaterial(select.value);
      unit.textContent = material ? material[5] : "Unit";
    }

    select.addEventListener("change", () => {
      updateUnit();
      updateCost();
    });
    input.addEventListener("input", updateCost);
    updateUnit();
    row.append(select, input, unit, remove);
    container.appendChild(row);
    updateCost();
  }

  function closeRecipeModal() {
    recipeModal.classList.add("hidden");
    recipeModal.classList.remove("flex");
  }

  function openRecipeModal(recipe, pendingRecipe) {
    const products = getProductCatalog().filter(productUsesStandardSizing);
    if (
      recipe &&
      !products.some((product) => product.id === recipe.productId)
    ) {
      showRecipeToast(
        "This recipe's product is no longer active in Product Management.",
        true,
      );
      return;
    }
    if (!recipe && products.length === 0) {
      showRecipeToast(
        "Add an active product in Product Management before creating a BOM recipe.",
        true,
      );
    }

    recipeForm.reset();
    populateRecipeProducts(recipe ? recipe.productId : "");
    recipeMaterialRows.replaceChildren();
    recipeEditId.value = recipe ? recipe.id : "";
    recipeModalTitle.textContent = recipe
      ? "Edit BOM Standard Size Specification"
      : "Create BOM Standard Size Specification";
    if (recipe) {
      recipeSize.value = normalizeBomSize(recipe.size);
      recipe.materials.forEach((item) =>
        addRecipeMaterialRow(item.code, item.quantity),
      );
    } else {
      if (pendingRecipe) {
        recipeProduct.value = pendingRecipe.productId;
        recipeSize.value = pendingRecipe.size;
      }
      addRecipeMaterialRow("", "1");
    }
    recipeModal.classList.remove("hidden");
    recipeModal.classList.add("flex");
  }

  function closeCustomSpecificationModal() {
    customSpecModal.classList.add("hidden");
    customSpecModal.classList.remove("flex");
  }

  function openCustomSpecificationModal(customOrder, readOnly = false) {
    const { order, item } = customOrder;
    const measurementFields = getCustomMeasurementFields(item);
    if (!measurementFields.length) {
      showRecipeToast(
        "This order item has no submitted measurements to view or modify.",
        true,
      );
      return;
    }
    customSpecForm.reset();
    activeCustomOrder = readOnly
      ? null
      : {
          orderIndex: customOrder.orderIndex,
          itemIndex: customOrder.itemIndex,
          orderReference: order.reference,
          orderId: item.orderId,
          productId: item.productId,
        };
    document.querySelector("#bom-custom-modal-title").textContent = readOnly
      ? "View Customer Measurements"
      : "Modify Customer Measurements";
    document.querySelector("#bom-custom-modal-title + p").textContent =
      readOnly
        ? "Measurements submitted with this custom order item."
        : "Update the measurements submitted with this custom order item.";
    customSpecForm
      .querySelector('button[type="submit"]')
      .classList.toggle("hidden", readOnly);
    customSpecCancelButton.textContent = readOnly ? "Close" : "Cancel";
    customSpecOrderDetails.textContent =
      (order.reference || "Order") +
      " · " +
      (item.orderId || "Line item") +
      " · " +
      (item.name || item.productId || "Custom item");
    customSpecSizeFields.replaceChildren();
    customSpecSizeEmpty.classList.toggle(
      "hidden",
      measurementFields.length > 0,
    );
    measurementFields.forEach((field) => {
      const label = document.createElement("label");
      label.className = "bom-custom-size-field";
      const caption = document.createElement("span");
      caption.className = "field-label";
      caption.textContent = field.name + " (" + field.unit + ")";
      const input = document.createElement("input");
      input.className = "field-control";
      input.type = "number";
      input.step = "any";
      input.required = !readOnly;
      input.readOnly = readOnly;
      input.dataset.customMeasurement = field.name;
      if (field.minimum !== "") input.min = String(field.minimum);
      if (field.maximum !== "") input.max = String(field.maximum);
      input.value =
        field.value === undefined || field.value === null
          ? ""
          : String(field.value);
      caption.appendChild(input);
      label.appendChild(caption);
      customSpecSizeFields.appendChild(label);
    });
    customSpecModal.classList.remove("hidden");
    customSpecModal.classList.add("flex");
  }

  recipeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab-target");
      recipeTabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      recipePanels.forEach((panel) => {
        panel.classList.toggle(
          "hidden",
          panel.getAttribute("data-tab-panel") !== target,
        );
      });
    });
  });

  if (recipeTodoViewButton) {
    recipeTodoViewButton.addEventListener("click", () => {
      renderRecipes();
      recipeTodoModal?.classList.remove("hidden");
      recipeTodoModal?.classList.add("flex");
    });
  }
  if (recipeTodoCloseButton) {
    recipeTodoCloseButton.addEventListener("click", () => {
      recipeTodoModal?.classList.add("hidden");
      recipeTodoModal?.classList.remove("flex");
    });
  }
  if (recipeTodoModal) {
    recipeTodoModal.addEventListener("click", (event) => {
      if (event.target === recipeTodoModal) {
        recipeTodoModal.classList.add("hidden");
        recipeTodoModal.classList.remove("flex");
      }
    });
  }

  if (recipeSearchInput)
    recipeSearchInput.addEventListener("input", renderRecipes);
  if (customSpecSearchInput) {
    customSpecSearchInput.addEventListener(
      "input",
      renderCustomSpecifications,
    );
  }
  if (recipeAddButton)
    recipeAddButton.addEventListener("click", () => openRecipeModal(null));
  if (customSpecModalClose) {
    customSpecModalClose.addEventListener(
      "click",
      closeCustomSpecificationModal,
    );
  }
  if (customSpecCancelButton) {
    customSpecCancelButton.addEventListener(
      "click",
      closeCustomSpecificationModal,
    );
  }
  if (customSpecModal) {
    customSpecModal.addEventListener("click", (event) => {
      if (event.target === customSpecModal) {
        closeCustomSpecificationModal();
      }
    });
  }
  if (recipeAddMaterialButton) {
    recipeAddMaterialButton.addEventListener("click", () =>
      addRecipeMaterialRow("", "1"),
    );
  }
  if (recipeModalClose)
    recipeModalClose.addEventListener("click", closeRecipeModal);
  if (recipeCancelButton)
    recipeCancelButton.addEventListener("click", closeRecipeModal);
  if (recipeModal) {
    recipeModal.addEventListener("click", (event) => {
      if (event.target === recipeModal) closeRecipeModal();
    });
  }
  if (recipeForm) {
    recipeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const ingredients = Array.from(
        recipeMaterialRows.querySelectorAll(".bom-material-row"),
      )
        .map((row) => ({
          code: row.querySelector("[data-bom-material]").value,
          quantity: Number(row.querySelector("[data-bom-quantity]").value) || 0,
        }))
        .filter((item) => item.code && item.quantity > 0);

      if (ingredients.length === 0) {
        showRecipeToast(
          "Add at least one material with a quantity above zero.",
          true,
        );
        return;
      }

      const product = getProductCatalog().find(
        (item) => item.id === recipeProduct.value,
      );
      if (!product) {
        showRecipeToast(
          "Select an active product from Product Management.",
          true,
        );
        return;
      }
      const recipe = {
        id: recipeEditId.value || "BOM-" + String(Date.now()),
        productId: product.id,
        productName: product.name,
        size: normalizeBomSize(recipeSize.value),
        materials: ingredients,
      };
      const duplicateRecipe = recipes.find(
        (item) =>
          item.id !== recipe.id &&
          item.productId === recipe.productId &&
          normalizeBomSize(item.size) === recipe.size,
      );
      if (duplicateRecipe) {
        showRecipeToast(
          "A BOM recipe already exists for this product and size.",
          true,
        );
        return;
      }
      const existingIndex = recipes.findIndex((item) => item.id === recipe.id);
      if (existingIndex >= 0) recipes[existingIndex] = recipe;
      else recipes = window.arrayWithAppended(recipes, recipe);
      if (saveRecipes()) {
        closeRecipeModal();
        renderRecipes();
        showRecipeToast("BOM recipe saved.", false);
      }
    });
  }

  if (customSpecForm) {
    customSpecForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!activeCustomOrder) {
        showRecipeToast("Select a custom order item to modify.", true);
        return;
      }
      if (!customSpecForm.reportValidity()) return;
      const inputs = Array.from(
        customSpecSizeFields.querySelectorAll("[data-custom-measurement]"),
      );
      if (
        !inputs.length ||
        inputs.some((input) => !Number.isFinite(Number(input.value)))
      ) {
        showRecipeToast("Enter a valid value for every custom measurement.", true);
        return;
      }

      const orders = readCustomerOrders();
      let targetOrderIndex = -1;
      let targetItemIndex = -1;
      if (activeCustomOrder.orderId) {
        orders.some((order, orderIndex) => {
          if (!Array.isArray(order?.items)) return false;
          const itemIndex = order.items.findIndex(
            (item) => item?.orderId === activeCustomOrder.orderId,
          );
          if (itemIndex < 0) return false;
          targetOrderIndex = orderIndex;
          targetItemIndex = itemIndex;
          return true;
        });
      } else {
        targetOrderIndex = orders.findIndex(
          (order, index) =>
            (activeCustomOrder.orderReference
              ? order?.reference === activeCustomOrder.orderReference
              : index === activeCustomOrder.orderIndex) &&
            Array.isArray(order?.items),
        );
        if (targetOrderIndex >= 0) {
          targetItemIndex = activeCustomOrder.itemIndex;
        }
      }

      const targetOrder = orders[targetOrderIndex];
      const targetItem = targetOrder?.items?.[targetItemIndex];
      if (
        !targetItem ||
        targetItem.productId !== activeCustomOrder.productId ||
        String(targetItem.size || "").toLowerCase() !== "custom" ||
        !targetItem.customMeasurements ||
        typeof targetItem.customMeasurements !== "object" ||
        Array.isArray(targetItem.customMeasurements)
      ) {
        showRecipeToast(
          "This custom order item is no longer available. Refresh the list and try again.",
          true,
        );
        return;
      }

      const updatedMeasurements = { ...targetItem.customMeasurements };
      for (const input of inputs) {
        const name = input.dataset.customMeasurement;
        if (!Object.prototype.hasOwnProperty.call(updatedMeasurements, name)) {
          showRecipeToast(
            "The submitted measurements changed while this dialog was open. Refresh the list and try again.",
            true,
          );
          return;
        }
        updatedMeasurements[name] = input.value;
      }
      targetItem.customMeasurements = updatedMeasurements;
      try {
        window.backendMemoryStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify(orders));
      } catch (error) {
        showRecipeToast(
          error instanceof Error
            ? "Updated measurements could not be saved: " + error.message
            : "Updated measurements could not be saved in this browser.",
          true,
        );
        return;
      }
      closeCustomSpecificationModal();
      renderCustomSpecifications();
      showRecipeToast("Customer measurements updated on the order.", false);
    });
  }

  window.addEventListener("fabricMaterialsUpdated", renderRecipes);
  window.addEventListener("systemArchiveChanged", () => {
    renderFabMaterials();
    renderRecipes();
    renderLowStockAlerts();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "jorjetteangel-system-archive") {
      renderFabMaterials();
      renderRecipes();
      renderLowStockAlerts();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === BOM_RECIPES_KEY) {
      loadRecipes();
      renderRecipes();
    }
    if (event.key === "jg-erp-fabrics-materials-v1") renderRecipes();
    if (event.key === PRODUCT_CATALOG_KEY) {
      populateRecipeProducts(recipeProduct.value);
      renderRecipes();
      renderCustomSpecifications();
    }
    if (event.key === CUSTOMER_ORDERS_KEY) {
      renderCustomSpecifications();
      inspectProductionBomAttempts();
    }
  });

  loadRecipes();
  populateRecipeProducts();
  renderRecipes();
  renderCustomSpecifications();
  inspectProductionBomAttempts();
})();
