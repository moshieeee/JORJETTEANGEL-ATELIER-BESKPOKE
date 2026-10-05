// Manages finished-goods stock.

let inventoryToastTimeout;
const inventoryToast = document.querySelector("#toast");

function showInventoryToast(message, type) {
  if (!inventoryToast) return;
  const colorClass = type === "error"
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
  inventoryToast.textContent = message;
  inventoryToast.className = "pointer-events-none fixed right-4 top-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-medium shadow-lg " + colorClass;
  window.clearTimeout(inventoryToastTimeout);
  inventoryToastTimeout = window.setTimeout(function () {
    inventoryToast.classList.add("hidden");
  }, 4000);
}

const CATALOG_STORAGE_KEY = "jorjetteangel-admin-catalog";
const RTW_SIZE_CODES = ["S", "M", "L", "XL"];

const INV_SKU_INDEX = 0;
const INV_NAME_INDEX = 1;
const INV_BATCH_INDEX = 2;
const INV_CATEGORY_INDEX = 3;
const INV_STOCK_INDEX = 4;
const INV_PRICE_INDEX = 5;
const INV_LAST_STOCKED_INDEX = 6;
const INV_THRESHOLD_INDEX = 7;
const INV_TYPE_INDEX = 8; // Product type
const INV_SIZE_INDEX = 9;
const INV_IMAGE_INDEX = 10;
const INV_PRODUCT_INDEX = 11;
let catalogReadErrorShown = false;

let inventoryItems = [];
let invCurrentTab = "all";
let invCurrentPage = 1;
let invEntriesPerPage = 10;

const invSearchInput = document.querySelector("#inv-search-input");
const invCategoryFilter = document.querySelector("#inv-category-filter");
const invEntriesSelect = document.querySelector("#inv-entries-select");
const invTableBody = document.querySelector("#inventory-table-body");
const emptyInventory = document.querySelector("#empty-inventory");
const invPaginationInfo = document.querySelector("#inv-pagination-info");
const invPaginationControls = document.querySelector("#inv-pagination-controls");

const invKpiTotalVal = document.querySelector("#inv-kpi-total-val");
const invKpiStockoutCount = document.querySelector("#inv-kpi-stockout-count");
const invKpiStockoutView = document.querySelector("#inv-kpi-stockout-view");
const invKpiLowstockView = document.querySelector("#inv-kpi-lowstock-view");
const invKpiLowstockCount = document.querySelector("#inv-kpi-lowstock-count");
const invBtnAdd = document.querySelector("#inv-btn-add");

const invModal = document.querySelector("#inv-modal");
const invModalTitle = document.querySelector("#inv-modal-title");
const invModalClose = document.querySelector("#inv-modal-close");
const invProductForm = document.querySelector("#inv-product-form");
const invInputProduct = document.querySelector("#inv-input-product");
const invInputSize = document.querySelector("#inv-input-size");
const invInputCategory = document.querySelector("#inv-input-category");
const invInputType = document.querySelector("#inv-input-type");
const invInputStock = document.querySelector("#inv-input-stock");
const invInputThreshold = document.querySelector("#inv-input-threshold");
const invSingleSizeField = document.querySelector("#inv-single-size-field");
const invSingleStockField = document.querySelector("#inv-single-stock-field");
const invRtwSizeStock = document.querySelector("#inv-rtw-size-stock");
const invRtwStockInputs = [
  ["S", document.querySelector("#inv-stock-size-s")],
  ["M", document.querySelector("#inv-stock-size-m")],
  ["L", document.querySelector("#inv-stock-size-l")],
  ["XL", document.querySelector("#inv-stock-size-xl")],
];
const invBtnCancel = document.querySelector("#inv-btn-cancel");

const invDetailModal = document.querySelector("#inv-detail-modal");
const invDetailTitle = document.querySelector("#inv-detail-title");
const invDetailClose = document.querySelector("#inv-detail-close");
const invDetailContent = document.querySelector("#inv-detail-content");
const invDetailBtnDone = document.querySelector("#inv-detail-btn-done");

function formatCurrency(val) {
  const num = Number(val) || 0;
  const isNeg = num < 0;
  const absolute = Math.abs(num);
  const fixed = absolute.toFixed(2);
  let dotPos = 0;
  while (dotPos < fixed.length && fixed.charAt(dotPos) !== ".") {
    dotPos += 1;
  }
  const intPart = fixed.substring(0, dotPos);
  const decPart = fixed.substring(dotPos);

  let formattedInt = "";
  let count = 0;
  let k = intPart.length - 1;
  while (k >= 0) {
    if (count > 0 && count % 3 === 0) {
      formattedInt = "," + formattedInt;
    }
    formattedInt = intPart.charAt(k) + formattedInt;
    count += 1;
    k -= 1;
  }
  return (isNeg ? "-₱" : "₱") + (formattedInt === "" ? "0" : formattedInt) + decPart;
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

function readProductCatalog() {
  const saved = window.backendMemoryStorage.getItem(CATALOG_STORAGE_KEY);
  if (!saved) return { categories: [], products: [] };

  let catalog;
  try {
    catalog = JSON.parse(saved);
  } catch {
    if (!catalogReadErrorShown) {
      showInventoryToast("Product catalog data could not be read.", "error");
      catalogReadErrorShown = true;
    }
    return { categories: [], products: [] };
  }
  if (
    !catalog ||
    catalog.catalogVersion !== 3 ||
    !Array.isArray(catalog.categories) ||
    !Array.isArray(catalog.products)
  ) {
    if (!catalogReadErrorShown) {
      showInventoryToast("Saved product catalog data is invalid.", "error");
      catalogReadErrorShown = true;
    }
    return { categories: [], products: [] };
  }
  return catalog;
}

function findCatalogCategory(categoryId) {
  const catalog = readProductCatalog();
  let i = 0;
  while (i < catalog.categories.length) {
    if (catalog.categories[i].id === categoryId) {
      return catalog.categories[i];
    }
    i += 1;
  }
  return null;
}

function findCatalogProduct(productId) {
  const catalog = readProductCatalog();
  let i = 0;
  while (i < catalog.products.length) {
    if (catalog.products[i].id === productId) {
      return catalog.products[i];
    }
    i += 1;
  }
  return null;
}

function categoryLabel(categoryId) {
  const category = findCatalogCategory(categoryId);
  return category ? category.name : categoryId || "Uncategorized";
}

function getInventoryThreshold(item) {
  const threshold = Number(item[INV_THRESHOLD_INDEX]);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : 10;
}

function refreshCatalogSelectors(selectedCategoryId = "", selectedProductId = "") {
  const catalog = readProductCatalog();
  const currentFilter = invCategoryFilter.value;
  const categoryPlaceholder = document.createElement("option");
  categoryPlaceholder.value = "";
  categoryPlaceholder.textContent = "Select a category";
  invInputCategory.replaceChildren(categoryPlaceholder);
  catalog.categories.forEach((category) => {
    if (category.status === "Archived") return;
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    invInputCategory.appendChild(option);
  });
  invInputCategory.value = Array.from(invInputCategory.options).some(
    (option) => option.value === selectedCategoryId,
  )
    ? selectedCategoryId
    : "";

  const matchingProducts = catalog.products.filter(
    (product) =>
      product.status !== "Archived" &&
      product.categoryId === invInputCategory.value &&
      catalog.categories.some(
        (category) =>
          category.id === product.categoryId && category.status !== "Archived",
      ),
  );
  const productPlaceholder = document.createElement("option");
  productPlaceholder.value = "";
  productPlaceholder.textContent = invInputCategory.value
    ? matchingProducts.length
      ? "Select a product"
      : "No products in this category"
    : "Select a category first";
  invInputProduct.replaceChildren(productPlaceholder);
  matchingProducts.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name;
    invInputProduct.appendChild(option);
  });
  invInputProduct.disabled = !invInputCategory.value || !matchingProducts.length;
  invInputProduct.value = matchingProducts.some(
    (product) => product.id === selectedProductId,
  )
    ? selectedProductId
    : "";

  const categoryFilterPlaceholder = document.createElement("option");
  categoryFilterPlaceholder.value = "all";
  categoryFilterPlaceholder.textContent = "All Categories";
  invCategoryFilter.replaceChildren(categoryFilterPlaceholder);
  catalog.categories.forEach((category) => {
    if (category.status === "Archived") return;
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    invCategoryFilter.appendChild(option);
  });
  invCategoryFilter.value = Array.from(invCategoryFilter.options).some(
    (option) => option.value === currentFilter,
  )
    ? currentFilter
    : "all";
}

function updateSelectedProductDetails() {
  const product = findCatalogProduct(invInputProduct.value);
  if (product && product.categoryId !== invInputCategory.value) {
    invInputProduct.value = "";
  }
}

function updateClassificationFields() {
  const isRtwBatchAdd = invInputType.value === "RTW";
  invSingleSizeField.classList.toggle("hidden", isRtwBatchAdd);
  invSingleStockField.classList.toggle("hidden", isRtwBatchAdd);
  invRtwSizeStock.classList.toggle("hidden", !isRtwBatchAdd);
  invInputSize.required = !isRtwBatchAdd;
  invInputStock.required = !isRtwBatchAdd;
  let i = 0;
  while (i < invRtwStockInputs.length) {
    invRtwStockInputs[i][1].required = isRtwBatchAdd;
    i += 1;
  }
}

function getProductSizeStock(product, size) {
  if (!Array.isArray(product.finishedGoodsStock)) return null;
  let i = 0;
  while (i < product.finishedGoodsStock.length) {
    const entry = product.finishedGoodsStock[i];
    if (entry && String(entry[0]).toUpperCase() === size.toUpperCase()) {
      return entry;
    }
    i += 1;
  }
  return null;
}

function updateCatalogStock(productId, stockUpdates, threshold) {
  const catalog = readProductCatalog();
  let productIndex = 0;
  while (productIndex < catalog.products.length) {
    const product = catalog.products[productIndex];
    if (product.id === productId && product.status !== "Archived") break;
    productIndex += 1;
  }
  if (productIndex >= catalog.products.length) {
    showInventoryToast("The selected catalog product is no longer active.", "error");
    return false;
  }

  const product = catalog.products[productIndex];
  if (!Array.isArray(product.finishedGoodsStock)) {
    product.finishedGoodsStock = [];
  }
  let updateIndex = 0;
  while (updateIndex < stockUpdates.length) {
    const size = stockUpdates[updateIndex][0];
    const amount = stockUpdates[updateIndex][1];
    let entry = getProductSizeStock(product, size);
    if (!entry) {
      entry = [size, 0, []];
      product.finishedGoodsStock = window.arrayWithAppended(
        product.finishedGoodsStock,
        entry,
      );
    }
    entry[1] = (Number(entry[1]) || 0) + amount;
    if (!Array.isArray(entry[2])) entry[2] = [];
    updateIndex += 1;
  }
  product.finishedGoodsLowStockAlert = threshold;
  product.finishedGoodsUpdatedAt = new Date().toLocaleDateString("en-PH");

  try {
    window.backendMemoryStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    showInventoryToast("Unable to update stock in the shared product catalog.", "error");
    return false;
  }
  return true;
}

function loadInventory() {
  try {
    window.backendMemoryStorage.removeItem("jg-erp-finished-goods-v1");
  } catch {
    showInventoryToast("Unable to remove the old standalone inventory data.", "error");
  }
  inventoryItems = [];
  const catalog = readProductCatalog();
  let productIndex = 0;
  while (productIndex < catalog.products.length) {
    const product = catalog.products[productIndex];
    const category = findCatalogCategory(product.categoryId);
    if (
      product.status !== "Archived" &&
      category &&
      category.status !== "Archived" &&
      Array.isArray(product.finishedGoodsStock)
    ) {
      let stockIndex = 0;
      while (stockIndex < product.finishedGoodsStock.length) {
        const stockEntry = product.finishedGoodsStock[stockIndex];
        if (stockEntry && stockEntry[0]) {
          const size = String(stockEntry[0]);
          const stock = Math.max(0, Number(stockEntry[1]) || 0);
          inventoryItems = window.arrayWithAppended(inventoryItems, [
            "SKU-RTW-" + category.id + "-" + size.toUpperCase().replace(/[^A-Z0-9]+/g, ""),
            product.name,
            "",
            category.id,
            stock,
            Number(product.price) || 0,
            product.finishedGoodsUpdatedAt || "—",
            Number.isFinite(Number(product.finishedGoodsLowStockAlert)) &&
              Number(product.finishedGoodsLowStockAlert) >= 0
              ? Number(product.finishedGoodsLowStockAlert)
              : 10,
            RTW_SIZE_CODES.indexOf(size.toUpperCase()) >= 0 ? "RTW" : "Custom",
            size,
            (Array.isArray(product.images) && product.images[0]) || product.image || "",
            product.id,
          ]);
        }
        stockIndex += 1;
      }
    }
    productIndex += 1;
  }
}

function updateInventoryKPIs() {
  let totalVal = 0;
  let stockouts = 0;
  let lowStock = 0;

  let i = 0;
  while (i < inventoryItems.length) {
    const item = inventoryItems[i];
    const stock = Number(item[INV_STOCK_INDEX]) || 0;
    const price = Number(item[INV_PRICE_INDEX]) || 0;
    const threshold = getInventoryThreshold(item);

    totalVal += stock * price;
    if (stock === 0) {
      stockouts += 1;
    } else if (stock <= threshold) {
      lowStock += 1;
    }
    i += 1;
  }

  if (invKpiTotalVal) {
    invKpiTotalVal.textContent = formatCurrency(totalVal);
  }

  if (invKpiStockoutCount) {
    invKpiStockoutCount.textContent = stockouts + (stockouts === 1 ? " item" : " items");
  }

  if (invKpiLowstockCount) {
    invKpiLowstockCount.textContent = lowStock + (lowStock === 1 ? " product" : " products");
  }
}

function getFilteredInventory() {
  const query = invSearchInput ? invSearchInput.value.trim().toLowerCase() : "";
  const selectedCategory = invCategoryFilter ? invCategoryFilter.value : "all";
  let filtered = [];

  let i = 0;
  while (i < inventoryItems.length) {
    const item = inventoryItems[i];
    const sku = item[INV_SKU_INDEX];
    const name = item[INV_NAME_INDEX];
    const batch = item[INV_BATCH_INDEX];
    const categoryId = item[INV_CATEGORY_INDEX];
    const cat = categoryLabel(categoryId);
    const size = item[INV_SIZE_INDEX] || "";
    const stock = Number(item[INV_STOCK_INDEX]) || 0;
    const threshold = getInventoryThreshold(item);
    const type = item[INV_TYPE_INDEX];

    let matchesSearch = true;
    if (query !== "") {
      matchesSearch = invContainsText(sku, query) ||
                      invContainsText(name, query) ||
                      invContainsText(batch, query) ||
                      invContainsText(size, query) ||
                      invContainsText(cat, query) ||
                      invContainsText(type, query);
    }

    const matchesCategory =
      selectedCategory === "all" || categoryId === selectedCategory;

    if (matchesSearch && matchesCategory) {
      filtered[filtered.length] = [
        i,
        sku,
        name,
        batch,
        categoryId,
        stock,
        Number(item[INV_PRICE_INDEX]) || 0,
        item[INV_LAST_STOCKED_INDEX],
        threshold,
        type,
        size,
        item[INV_IMAGE_INDEX] || "",
      ];
    }
    i += 1;
  }
  return filtered;
}

function renderInventory() {
  if (!invTableBody) return;

  updateInventoryKPIs();

  const filtered = getFilteredInventory();
  const totalFiltered = filtered.length;

  while (invTableBody.firstChild) {
    invTableBody.removeChild(invTableBody.firstChild);
  }

  if (totalFiltered === 0) {
    if (emptyInventory) emptyInventory.classList.remove("hidden");
    if (invPaginationInfo) invPaginationInfo.textContent = "Showing 0 of 0 entries";
    if (invPaginationControls) {
      while (invPaginationControls.firstChild) {
        invPaginationControls.removeChild(invPaginationControls.firstChild);
      }
    }
    return;
  }

  if (emptyInventory) emptyInventory.classList.add("hidden");

  let perPage = invEntriesPerPage;
  if (perPage === "all" || perPage > totalFiltered) {
    perPage = totalFiltered;
  }

  const totalPages = perPage >= totalFiltered ? 1 : Math.ceil(totalFiltered / perPage);
  if (invCurrentPage > totalPages) {
    invCurrentPage = totalPages;
  }
  if (invCurrentPage < 1) {
    invCurrentPage = 1;
  }

  const startIdx = (invCurrentPage - 1) * perPage;
  let endIdx = startIdx + perPage;
  if (endIdx > totalFiltered) {
    endIdx = totalFiltered;
  }

  let rowIdx = startIdx;
  while (rowIdx < endIdx) {
    const rowData = filtered[rowIdx];
    const origIdx = rowData[0];
    const sku = rowData[1];
    const name = rowData[2];
    const batch = rowData[3];
    const categoryId = rowData[4];
    const cat = categoryLabel(categoryId);
    const stock = rowData[5];
    const price = rowData[6];
    const lastStocked = rowData[7];
    const threshold = rowData[8];
    const size = rowData[10];
    const imageData = rowData[11];

    const tr = document.createElement("tr");
    tr.className = "transition-colors hover:bg-slate-50";

    const skuTd = document.createElement("td");
    skuTd.className = "whitespace-nowrap px-4 py-3.5 font-mono text-xs font-semibold text-slate-700";
    skuTd.textContent = sku;
    tr.appendChild(skuTd);

    const imgTd = document.createElement("td");
    imgTd.className = "whitespace-nowrap px-4 py-3.5 text-center";
    const imgBox = document.createElement("div");
    imgBox.className = "mx-auto flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400";
    if (imageData) {
      const itemImage = document.createElement("img");
      itemImage.src = imageData;
      itemImage.alt = name;
      itemImage.className = "h-full w-full object-cover";
      imgBox.appendChild(itemImage);
    } else {
      imgBox.innerHTML = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
    }
    imgTd.appendChild(imgBox);
    tr.appendChild(imgTd);

    const nameTd = document.createElement("td");
    nameTd.className = "px-4 py-3.5";
    const nameDiv = document.createElement("div");
    nameDiv.className = "font-medium text-slate-900";
    nameDiv.textContent = name;
    nameTd.appendChild(nameDiv);
    tr.appendChild(nameTd);

    const sizeTd = document.createElement("td");
    sizeTd.className = "whitespace-nowrap px-4 py-3.5 text-slate-600 text-sm";
    sizeTd.textContent = size || "-";
    tr.appendChild(sizeTd);

    const catTd = document.createElement("td");
    catTd.className = "whitespace-nowrap px-4 py-3.5 text-slate-600 text-sm";
    catTd.textContent = cat;
    tr.appendChild(catTd);

    const stockTd = document.createElement("td");
    stockTd.className = "whitespace-nowrap px-4 py-3.5 text-right font-semibold text-slate-900";
    stockTd.textContent = formatQuantity(stock);
    tr.appendChild(stockTd);

    const priceTd = document.createElement("td");
    priceTd.className = "whitespace-nowrap px-4 py-3.5 text-right text-slate-700";
    const formattedPrice = formatCurrency(price);
    priceTd.textContent = formattedPrice.charAt(0) === "₱" ? formattedPrice.substring(1) : formattedPrice;
    tr.appendChild(priceTd);

    const valTd = document.createElement("td");
    valTd.className = "whitespace-nowrap px-4 py-3.5 text-right font-semibold text-slate-900";
    const formattedVal = formatCurrency(stock * price);
    valTd.textContent = formattedVal.charAt(0) === "₱" ? formattedVal.substring(1) : formattedVal;
    tr.appendChild(valTd);

    const dateTd = document.createElement("td");
    dateTd.className = "whitespace-nowrap px-4 py-3.5 text-center text-xs text-slate-500";
    dateTd.textContent = lastStocked;
    tr.appendChild(dateTd);

    const statusTd = document.createElement("td");
    statusTd.className = "whitespace-nowrap px-4 py-3.5 text-center";
    const badge = document.createElement("span");
    const statusDot = document.createElement("span");
    statusDot.className = "h-1.5 w-1.5 rounded-full";

    if (stock === 0) {
      badge.className = "inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 border border-red-200/60";
      statusDot.className += " bg-red-500";
      badge.appendChild(statusDot);
      badge.appendChild(document.createTextNode("Out of Stock"));
    } else if (stock <= threshold) {
      badge.className = "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200/60";
      statusDot.className += " bg-amber-500";
      badge.appendChild(statusDot);
      badge.appendChild(document.createTextNode("Low"));
    } else {
      badge.className = "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60";
      statusDot.className += " bg-emerald-500";
      badge.appendChild(statusDot);
      badge.appendChild(document.createTextNode("Good"));
    }
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);

    const actionTd = document.createElement("td");
    actionTd.className = "whitespace-nowrap px-4 py-3.5 text-center";
    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";
    viewButton.textContent = "View";
    viewButton.addEventListener("click", function () {
      showProductDetails(origIdx);
    });
    actionTd.appendChild(viewButton);
    tr.appendChild(actionTd);

    invTableBody.appendChild(tr);
    rowIdx += 1;
  }

  if (invPaginationInfo) {
    invPaginationInfo.textContent = "Showing " + (startIdx + 1) + " to " + endIdx + " of " + totalFiltered + " entries";
  }

  if (invPaginationControls) {
    while (invPaginationControls.firstChild) {
      invPaginationControls.removeChild(invPaginationControls.firstChild);
    }

    if (totalPages > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.textContent = "Previous";
      prevBtn.className = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40";
      prevBtn.disabled = invCurrentPage <= 1;
      prevBtn.addEventListener("click", function () {
        if (invCurrentPage > 1) {
          invCurrentPage -= 1;
          renderInventory();
        }
      });
      invPaginationControls.appendChild(prevBtn);

      let p = 1;
      while (p <= totalPages) {
        const pageBtn = document.createElement("button");
        pageBtn.type = "button";
        pageBtn.textContent = String(p);
        const isCurrent = p === invCurrentPage;
        pageBtn.className = isCurrent
          ? "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
          : "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";
        const targetPage = p;
        pageBtn.addEventListener("click", function () {
          invCurrentPage = targetPage;
          renderInventory();
        });
        invPaginationControls.appendChild(pageBtn);
        p += 1;
      }

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.textContent = "Next";
      nextBtn.className = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40";
      nextBtn.disabled = invCurrentPage >= totalPages;
      nextBtn.addEventListener("click", function () {
        if (invCurrentPage < totalPages) {
          invCurrentPage += 1;
          renderInventory();
        }
      });
      invPaginationControls.appendChild(nextBtn);
    }
  }
}

function openAddProductModal() {
  if (!invModal) return;
  if (invModalTitle) invModalTitle.textContent = "Add Stock to Finished Goods";
  if (invProductForm) invProductForm.reset();
  refreshCatalogSelectors();
  if (invInputStock) invInputStock.value = "0";
  let sizeInputIndex = 0;
  while (sizeInputIndex < invRtwStockInputs.length) {
    invRtwStockInputs[sizeInputIndex][1].value = "0";
    sizeInputIndex += 1;
  }
  if (invInputThreshold) invInputThreshold.value = "10";
  updateClassificationFields();
  invModal.classList.remove("hidden");
  invModal.classList.add("flex");
  if (invInputCategory) invInputCategory.focus();
}

function closeInventoryModal() {
  if (invModal) {
    invModal.classList.add("hidden");
    invModal.classList.remove("flex");
  }
}

function showProductDetails(idx) {
  if (!invDetailModal || !invDetailContent || idx < 0 || idx >= inventoryItems.length) return;
  if (invDetailTitle) invDetailTitle.textContent = "Product Details";
  const item = inventoryItems[idx];
  const stock = Number(item[INV_STOCK_INDEX]) || 0;
  const price = Number(item[INV_PRICE_INDEX]) || 0;
  const totalVal = stock * price;
  const threshold = getInventoryThreshold(item);
  const isLow = stock <= threshold && stock > 0;
  const isOut = stock === 0;

  let statusHtml = '<span class="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">Good</span>';
  if (isOut) {
    statusHtml = '<span class="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-red-600/20">Out of Stock</span>';
  } else if (isLow) {
    statusHtml = '<span class="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">Low</span>';
  }

  invDetailContent.innerHTML =
    '<div class="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2">' +
      '<div class="flex items-center justify-between">' +
        '<span class="text-xs font-mono font-bold text-slate-500">SKU: ' + item[INV_SKU_INDEX] + '</span>' +
        statusHtml +
      '</div>' +
      '<div class="text-base font-bold text-slate-900">' + item[INV_NAME_INDEX] + '</div>' +
      '<div class="text-xs text-slate-500">Size: <span class="font-semibold text-slate-700">' + (item[INV_SIZE_INDEX] || "-") + '</span></div>' +
      '<div class="text-xs text-slate-500">Batch / Tracking: <span class="font-mono text-slate-700 font-semibold">' + item[INV_BATCH_INDEX] + '</span></div>' +
    '</div>' +
    '<div class="grid grid-cols-2 gap-3 pt-2 text-xs">' +
      '<div class="rounded-lg border border-slate-100 p-2.5 bg-white"><div class="text-slate-400 font-medium">Category</div><div class="text-sm font-semibold text-slate-800 mt-0.5">' + categoryLabel(item[INV_CATEGORY_INDEX]) + '</div></div>' +
      '<div class="rounded-lg border border-slate-100 p-2.5 bg-white"><div class="text-slate-400 font-medium">Classification</div><div class="text-sm font-semibold text-slate-800 mt-0.5">' + (item[INV_TYPE_INDEX] === "Custom" ? "Custom (Dispatch Waiting)" : "RTW Completed Stock") + '</div></div>' +
      '<div class="rounded-lg border border-slate-100 p-2.5 bg-white"><div class="text-slate-400 font-medium">Current Stock</div><div class="text-sm font-bold text-slate-900 mt-0.5">' + formatQuantity(stock) + ' units</div></div>' +
      '<div class="rounded-lg border border-slate-100 p-2.5 bg-white"><div class="text-slate-400 font-medium">Unit Price</div><div class="text-sm font-bold text-slate-900 mt-0.5">' + formatCurrency(price) + '</div></div>' +
      '<div class="rounded-lg border border-slate-100 p-2.5 bg-white"><div class="text-slate-400 font-medium">Total Inventory Value</div><div class="text-sm font-bold text-emerald-700 mt-0.5">' + formatCurrency(totalVal) + '</div></div>' +
      '<div class="rounded-lg border border-slate-100 p-2.5 bg-white"><div class="text-slate-400 font-medium">Last Stocked Date</div><div class="text-sm font-semibold text-slate-800 mt-0.5">' + item[INV_LAST_STOCKED_INDEX] + '</div></div>' +
    '</div>';

  invDetailModal.classList.remove("hidden");
  invDetailModal.classList.add("flex");
}

function showInventoryItems(title, emptyMessage, isIncluded) {
  if (!invDetailModal || !invDetailContent) return;
  if (invDetailTitle) invDetailTitle.textContent = title;
  invDetailContent.replaceChildren();

  let includedCount = 0;
  let itemIndex = 0;
  while (itemIndex < inventoryItems.length) {
    if (isIncluded(inventoryItems[itemIndex])) includedCount += 1;
    itemIndex += 1;
  }

  if (includedCount === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "text-sm text-slate-500";
    emptyState.textContent = emptyMessage;
    invDetailContent.appendChild(emptyState);
  } else {
    const list = document.createElement("ul");
    list.className = "divide-y divide-slate-200";
    itemIndex = 0;
    while (itemIndex < inventoryItems.length) {
      const item = inventoryItems[itemIndex];
      if (!isIncluded(item)) {
        itemIndex += 1;
        continue;
      }
      const row = document.createElement("li");
      row.className = "flex items-start justify-between gap-4 py-3";
      const details = document.createElement("div");
      const name = document.createElement("p");
      name.className = "text-sm font-medium text-slate-900";
      name.textContent = item[INV_NAME_INDEX];
      const metadata = document.createElement("p");
      metadata.className = "mt-1 text-xs text-slate-500";
      metadata.textContent =
        `${item[INV_SKU_INDEX]} · ${categoryLabel(item[INV_CATEGORY_INDEX])} · Size ${item[INV_SIZE_INDEX] || "-"}`;
      details.append(name, metadata);
      const quantity = document.createElement("span");
      quantity.className = "shrink-0 text-xs font-medium text-slate-600";
      quantity.textContent =
        `${formatQuantity(item[INV_STOCK_INDEX])} in stock · Alert at ${formatQuantity(item[INV_THRESHOLD_INDEX])}`;
      row.append(details, quantity);
      list.appendChild(row);
      itemIndex += 1;
    }
    invDetailContent.appendChild(list);
  }

  invDetailModal.classList.remove("hidden");
  invDetailModal.classList.add("flex");
}

function showSoldOutItems() {
  showInventoryItems(
    "Sold-Out Items",
    "There are no sold-out items in inventory.",
    (item) => Number(item[INV_STOCK_INDEX]) === 0,
  );
}

function showLowStockItems() {
  showInventoryItems(
    "Low Stock Items",
    "There are no low-stock items in inventory.",
    (item) => {
      const stock = Number(item[INV_STOCK_INDEX]) || 0;
      const threshold = getInventoryThreshold(item);
      return stock > 0 && stock <= threshold;
    },
  );
}

function closeDetailModal() {
  if (invDetailModal) {
    invDetailModal.classList.add("hidden");
    invDetailModal.classList.remove("flex");
  }
  if (invDetailTitle) invDetailTitle.textContent = "Product Details";
}

if (invSearchInput) {
  invSearchInput.addEventListener("input", function () {
    invCurrentPage = 1;
    renderInventory();
  });
}

if (invCategoryFilter) {
  invCategoryFilter.addEventListener("change", function () {
    invCurrentPage = 1;
    renderInventory();
  });
}

if (invEntriesSelect) {
  invEntriesSelect.addEventListener("change", function () {
    const val = invEntriesSelect.value;
    invEntriesPerPage = val === "all" ? "all" : Number(val);
    invCurrentPage = 1;
    renderInventory();
  });
}

if (invBtnAdd) invBtnAdd.addEventListener("click", openAddProductModal);
if (invInputCategory) {
  invInputCategory.addEventListener("change", function () {
    refreshCatalogSelectors(invInputCategory.value);
    updateSelectedProductDetails();
  });
}
if (invInputProduct) {
  invInputProduct.addEventListener("change", function () {
    updateSelectedProductDetails();
  });
}
if (invInputType) {
  invInputType.addEventListener("change", updateClassificationFields);
}
window.addEventListener("storage", function (event) {
  if (event.key === CATALOG_STORAGE_KEY) {
    refreshCatalogSelectors(
      invInputCategory ? invInputCategory.value : "",
      invInputProduct ? invInputProduct.value : "",
    );
    updateSelectedProductDetails();
    loadInventory();
    renderInventory();
  }
});
if (invKpiLowstockView) {
  invKpiLowstockView.addEventListener("click", showLowStockItems);
}
if (invKpiStockoutView) {
  invKpiStockoutView.addEventListener("click", showSoldOutItems);
}
if (invModalClose) invModalClose.addEventListener("click", closeInventoryModal);
if (invBtnCancel) invBtnCancel.addEventListener("click", closeInventoryModal);

if (invDetailClose) invDetailClose.addEventListener("click", closeDetailModal);
if (invDetailBtnDone) invDetailBtnDone.addEventListener("click", closeDetailModal);

if (invProductForm) {
  invProductForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const product = findCatalogProduct(invInputProduct.value);
    const category = product ? findCatalogCategory(product.categoryId) : null;
    const size = invInputSize.value.trim();
    const thresholdValue = Number(invInputThreshold.value);
    const threshold = Number.isFinite(thresholdValue) ? thresholdValue : 10;
    let stockUpdates = [];
    const isRtwBatchAdd = invInputType.value === "RTW";

    if (!product || !category || product.categoryId !== invInputCategory.value) {
      showInventoryToast("Choose a category and an active product from that category.", "error");
      return;
    }

    if (isRtwBatchAdd) {
      let sizeIndex = 0;
      while (sizeIndex < RTW_SIZE_CODES.length) {
        const sizeCode = RTW_SIZE_CODES[sizeIndex];
        const stockValue = Number(invRtwStockInputs[sizeIndex][1].value);
        if (!Number.isInteger(stockValue) || stockValue < 0) {
          showInventoryToast("Enter a valid whole-number stock quantity for size " + sizeCode + ".", "error");
          return;
        }
        stockUpdates = window.arrayWithAppended(stockUpdates, [
          sizeCode,
          stockValue,
        ]);
        sizeIndex += 1;
      }
    } else {
      const singleStock = Number(invInputStock.value);
      if (!size) {
        showInventoryToast("Enter a size before adding stock.", "error");
        return;
      }
      if (!Number.isInteger(singleStock) || singleStock < 0) {
        showInventoryToast("Enter a valid whole-number stock quantity.", "error");
        return;
      }
      stockUpdates = window.arrayWithAppended(stockUpdates, [size, singleStock]);
    }

    if (!updateCatalogStock(product.id, stockUpdates, threshold)) return;
    loadInventory();
    renderInventory();
    closeInventoryModal();
    showInventoryToast("Stock added to '" + product.name + "'.", "success");
  });
}

refreshCatalogSelectors();
loadInventory();
renderInventory();