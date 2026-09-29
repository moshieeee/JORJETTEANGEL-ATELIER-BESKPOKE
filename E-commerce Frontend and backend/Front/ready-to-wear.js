const CATALOG_STORAGE_KEY = "jorjetteangel-admin-catalog";

const fallbackCatalog = { categories: [], products: [] };


// Read the shared catalog, or return an empty catalog when it is uninitialized.
function readCatalog() {
  const saved = localStorage.getItem(CATALOG_STORAGE_KEY);
  return saved ? JSON.parse(saved) : fallbackCatalog;
}


// Escape text before inserting catalog data into HTML markup.
function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}


// Return all saved product images while supporting legacy single-image records.
function productImages(product) {
  return Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : product.image
      ? [product.image]
      : [];
}


// Format a catalog price or show the consultation label for unpriced products.
function formatPrice(price) {
  return price
    ? `From PHP ${Number(price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : "By consultation";
}


// Choose a placeholder color for products without an uploaded image.
function swatchFor(categoryId) {
  const colors = {
    uniforms: "#1f3159",
    college: "#eeeae1",
    school: "#26365e",
    scouting: "#f7f4ed",
    barongs: "#f7f4ed",
    traditional: "#16233d",
    modern: "#d9d4c8",
    "half-button": "#f1eee7",
    custom: "#b9b4aa",
    other: "#e5d5b0",
    accessories: "#302c27",
    trousers: "#1f3159",
  };
  return colors[categoryId] || "#d7d1c8";
}

const categoryFilters = document.getElementById("category-filters");
const catalogGrid = document.getElementById("catalog-grid");
const categoryTitle = document.getElementById("category-title");
const productCount = document.getElementById("product-count");
let catalog = { categories: [], products: [] };
let activeCategories = [];
let activeProducts = [];
let selectedCategory = "all";


// Render the category-filter buttons using the current catalog categories.
function renderCategories() {
  categoryFilters.innerHTML = [{ id: "all", name: "All" }, ...activeCategories]
    .map(
      (category) => `
    <button class="text-left ${category.id === selectedCategory ? "text-black" : ""}" data-category="${escapeHtml(category.id)}" aria-pressed="${category.id === selectedCategory}">
      ${escapeHtml(category.name)}
    </button>
  `,
    )
    .join("");
}


// Render products for the selected category and update the product count.
function renderProducts() {
  const visibleProducts =
    selectedCategory === "all"
      ? activeProducts
      : activeProducts.filter(
          (product) => product.categoryId === selectedCategory,
        );
  const selectedName =
    selectedCategory === "all"
      ? "All Products"
      : window.findArrayItem(
          activeCategories,
          selectedCategory,
          (category) => category.id,
        )
          ?.name || "Ready-to-Wear Uniforms";

  categoryTitle.textContent = selectedName;
  productCount.textContent = `${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"}`;
  catalogGrid.innerHTML =
    visibleProducts
      .map(
        (product) => `
    <a class="group block" href="product-detail.html?id=${encodeURIComponent(product.id)}&from=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}">
      <div class="shop-image flex items-center justify-center">
        ${
          productImages(product)[0]
            ? `<img class="h-full w-full object-contain p-5 transition duration-500 group-hover:scale-105" src="${escapeHtml(productImages(product)[0])}" alt="${escapeHtml(product.name)}" />`
            : `<div class="h-4/5 w-1/3 shadow-sm" style="background:${swatchFor(product.categoryId)}"></div>`
        }
      </div>
      <h3 class="mt-4 text-[13px]">${escapeHtml(product.name)}</h3>
      ${product.description ? `<p class="mt-2 text-[12px] leading-relaxed text-[#756d65]">${escapeHtml(product.description)}</p>` : ""}
      <p class="mt-1 text-[12px] text-[#9a938c]">${formatPrice(product.price)}</p>
    </a>
  `,
      )
      .join("") ||
    `<p class="text-[13px] text-[#9a938c]">No active products in this category.</p>`;
}


// Reload catalog data, select active entries, and redraw the catalog view.
function renderCatalog() {
  catalog = readCatalog();
  catalog.categories = catalog.categories.map((category) => ({
    ...category,
    status: category.status || "Active",
  }));
  activeCategories = catalog.categories.filter(
    (category) => category.status !== "Archived",
  );
  const activeCategoryIds = new Set(
    activeCategories.map((category) => category.id),
  );
  activeProducts = catalog.products.filter(
    (product) =>
      product.status !== "Archived" &&
      activeCategoryIds.has(product.categoryId),
  );
  if (
    selectedCategory !== "all" &&
    !activeCategoryIds.has(selectedCategory)
  ) {
    selectedCategory = "all";
  }
  renderCategories();
  renderProducts();
}

categoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderCategories();
  renderProducts();
  catalogGrid.scrollIntoView({ behavior: "smooth", block: "center" });
});

renderCatalog();

window.addEventListener("storage", (event) => {
  if (event.key === CATALOG_STORAGE_KEY) renderCatalog();
});

