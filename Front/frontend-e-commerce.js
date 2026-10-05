// Displays storefront products, details, and cart views.

tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#0C0907",
          charcoal: "#1A1A1A",
          espresso: "#24201D",
          taupe: "#695C50",
          sand: "#EAE1DC",
          cream: "#FAF9F7",
          pure: "#FFFFFF",
          hairline: "#E5DFD7",
          border: "#DDD5C9",
          gold: "#918779",
        },
      },
      fontFamily: {
        serif: ['"Bodoni Moda"', '"Cormorant Garamond"', "Georgia", "serif"],
        sans: ["Inter", "-apple-system", "sans-serif"],
      },
    },
  },
};


const validateCustomMeasurements = function (
  fields,
  measurements,
  container,
) {
  let missing = [];
  let errors = [];
  fields.forEach((field) => {
    const input = window.findArrayItem(
      Array.from(container.querySelectorAll("[data-custom-field]")),
      field.name,
      (element) => element.dataset.customField,
    );
    if (!input) return;
    const row = input.closest(".custom-measurement-row");
    const feedback = row.querySelector("[data-custom-feedback]");
    const rawValue = (measurements[field.name] || "").trim();
    const value = rawValue === "" ? NaN : Number(rawValue);
    const minimum = Number(field.minimum);
    const maximum = Number(field.maximum);
    const hasLimits =
      field.minimum !== "" &&
      field.maximum !== "" &&
      Number.isFinite(minimum) &&
      Number.isFinite(maximum);

    input.setCustomValidity("");
    feedback.classList.add("hidden");
    if (!rawValue) {
      missing = window.arrayWithAppended(missing, field.name);
      return;
    }
    if (!Number.isFinite(value)) {
      input.setCustomValidity("Enter a valid numeric measurement.");
      feedback.textContent = "Enter a valid numeric measurement.";
      feedback.classList.remove("hidden");
      errors = window.arrayWithAppended(errors, { field, input });
      return;
    }
    if (!hasLimits) return;

    if (value < minimum) {
      feedback.textContent = `This entry is below the valid minimum (${minimum} ${field.unit}). Please enter a correct measurement.`;
      feedback.classList.remove("hidden");
      input.setCustomValidity(feedback.textContent);
      errors = window.arrayWithAppended(errors, { field, input });
      return;
    }
    if (value > maximum) {
      feedback.textContent = `This entry exceeds the valid maximum (${maximum} ${field.unit}). Please enter a correct measurement.`;
      feedback.classList.remove("hidden");
      input.setCustomValidity(feedback.textContent);
      errors = window.arrayWithAppended(errors, { field, input });
      return;
    }
  });
  return { missing, errors };
};
window.validateCustomMeasurements = validateCustomMeasurements;

const sizePills = document.querySelectorAll(".size-pill");
const sizeHint = document.getElementById("size-hint");

const sizeDetails = {
  S: 'Standard Slim Fit (Chest: 36", Shoulder: 17.0")',
  M: 'Standard Regular Fit (Chest: 38", Shoulder: 17.5")',
  L: 'Standard Classic Fit (Chest: 40", Shoulder: 18.0")',
  XL: 'Standard Comfort Fit (Chest: 42", Shoulder: 18.5")',
};

sizePills.forEach((pill) => {
  pill.addEventListener("click", () => {
    sizePills.forEach((p) => {
      p.classList.remove(
        "bg-[#0C0907]",
        "text-white",
        "border-[#0C0907]",
        "border-2",
      );
      p.classList.add("border-[#E5DFD7]", "bg-white", "text-black");
    });
    pill.classList.remove("border-[#E5DFD7]", "bg-white", "text-black");
    pill.classList.add(
      "bg-[#0C0907]",
      "text-white",
      "border-[#0C0907]",
      "border-2",
    );

    const selectedSize = pill.getAttribute("data-size");
    if (sizeHint && sizeDetails[selectedSize]) {
      sizeHint.textContent = sizeDetails[selectedSize];
    }
  });
});

const qtyMinus = document.getElementById("qty-minus");
const qtyPlus = document.getElementById("qty-plus");
const qtyInput = document.getElementById("qty-input");

if (qtyMinus && qtyPlus && qtyInput) {
  qtyMinus.addEventListener("click", () => {
    let current = parseInt(qtyInput.value, 10) || 1;
    if (current > 1) {
      qtyInput.value = current - 1;
    }
  });

  qtyPlus.addEventListener("click", () => {
    let current = parseInt(qtyInput.value, 10) || 1;
    qtyInput.value = current + 1;
  });
}

const btnStandard = document.getElementById("tab-btn-standard");
const btnCustom = document.getElementById("tab-btn-custom");
const standardPanel = document.getElementById("standard-sizing-panel");
const customPanel = document.getElementById("custom-sizing-panel");

if (btnStandard && btnCustom && standardPanel && customPanel) {
  btnStandard.addEventListener("click", () => {
    btnStandard.classList.add(
      "bg-white",
      "text-[#0C0907]",
      "shadow-sm",
      "font-semibold",
    );
    btnStandard.classList.remove("text-neutral-500", "font-medium");
    btnCustom.classList.remove(
      "bg-white",
      "text-[#0C0907]",
      "shadow-sm",
      "font-semibold",
    );
    btnCustom.classList.add("text-neutral-500", "font-medium");

    standardPanel.classList.remove("hidden");
    customPanel.classList.add("hidden");
  });

  btnCustom.addEventListener("click", () => {
    btnCustom.classList.add(
      "bg-white",
      "text-[#0C0907]",
      "shadow-sm",
      "font-semibold",
    );
    btnCustom.classList.remove("text-neutral-500", "font-medium");
    btnStandard.classList.remove(
      "bg-white",
      "text-[#0C0907]",
      "shadow-sm",
      "font-semibold",
    );
    btnStandard.classList.add("text-neutral-500", "font-medium");

    customPanel.classList.remove("hidden");
    standardPanel.classList.add("hidden");
  });
}

const SPA_CATALOG_STORAGE_KEY = "jorjetteangel-admin-catalog";

const spaFallbackCatalog = {
  categories: [],
  products: [],
};


function readSpaCatalog() {
  const saved = window.backendMemoryStorage.getItem(SPA_CATALOG_STORAGE_KEY);
  return saved ? JSON.parse(saved) : spaFallbackCatalog;
}


function spaEscape(value) {
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


function spaFormatPrice(price) {
  return price
    ? `PHP ${Number(price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : "By consultation";
}


function spaSwatch(categoryId) {
  return (
    {
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
    }[categoryId] || "#d7d1c8"
  );
}


function spaProductImages(product) {
  return Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : product.image
      ? [product.image]
      : [];
}

function spaGetSizeStock(product, size) {
  const catalog = readSpaCatalog();
  const currentProduct = window.findArrayItem(
    catalog.products,
    product.id,
    (item) => item.id,
  );
  if (!currentProduct || !Array.isArray(currentProduct.finishedGoodsStock)) {
    return 0;
  }
  let i = 0;
  while (i < currentProduct.finishedGoodsStock.length) {
    const entry = currentProduct.finishedGoodsStock[i];
    if (entry && String(entry[0]).toUpperCase() === size.toUpperCase()) {
      return Math.max(0, Number(entry[1]) || 0);
    }
    i += 1;
  }
  return 0;
}


function spaHasSizeStock(product, size) {
  return spaGetSizeStock(product, size) > 0;
}

function updateSpaSizeAvailability(product, notifySelectionChange = false) {
  const message = document.getElementById("spa-cart-message");
  document
    .querySelectorAll("#spa-size-options .spa-size-option")
    .forEach((option) => {
      if (option.dataset.size === "custom") return;
      const size = option.dataset.size;
      const hasStock = spaHasSizeStock(product, size);
      option.disabled = !hasStock;
      option.textContent =
        hasStock
          ? size
          : `${size} — Out of stock`;
      option.setAttribute(
        "aria-label",
        hasStock
          ? `Size ${size}`
          : `Size ${size}, out of stock`,
      );
      option.classList.toggle("cursor-not-allowed", hasStock !== true);
      option.classList.toggle("opacity-50", hasStock !== true);
      if (spaSelectedSize === size && hasStock !== true) {
        spaSelectedSize = "";
        option.classList.remove("bg-[#0c0907]", "text-white");
        if (notifySelectionChange && message) {
          message.textContent = `Size ${size} is now out of stock. Please choose another size.`;
        }
      }
    });
}


let sharedCatalog = spaFallbackCatalog;


function refreshSpaCatalog() {
  const catalog = readSpaCatalog();
  sharedCatalog = {
    ...catalog,
    categories: catalog.categories.map((category) => ({
      ...category,
      status: category.status || "Active",
    })),
  };
}

refreshSpaCatalog();
let spaSelectedCategory = "";
let spaSelectedSize = "";
let spaCustomMeasurements = {};
let spaSearchQuery = "";


function spaProductCard(product, index) {
  const category = window.findArrayItem(
    sharedCatalog.categories,
    product.categoryId,
    (item) => item.id,
  );
  const customSizing =
    product.offerCustomSizing ?? product.sizeMode === "custom";
  const image = spaProductImages(product)[0];
  return `
    <article class="shop-product-card" style="--card-index:${index}">
      <a class="group block" href="#product/${encodeURIComponent(product.id)}" aria-label="View ${spaEscape(product.name)}">
        <div class="shop-product-image">
          ${
            image
              ? `<img src="${spaEscape(image)}" alt="${spaEscape(product.name)}" loading="lazy" />`
              : `<div class="shop-product-placeholder" style="background:${spaSwatch(product.categoryId)}"><span>${spaEscape(category?.name || "Atelier")}</span></div>`
          }
          ${customSizing ? '<span class="shop-product-badge">Made to measure</span>' : ""}
        </div>
        <div class="flex items-start justify-between gap-3 pt-4">
          <div class="min-w-0">
            <p class="mb-1 text-[9px] uppercase tracking-[0.16em] text-[#8b8279]">${spaEscape(category?.name || "Atelier")}</p>
            <h3 class="text-[12px] leading-5 text-[#1A1A1A] md:text-[13px]">${spaEscape(product.name)}</h3>
          </div>
          <span class="shrink-0 text-[11px] text-[#1A1A1A]">${spaFormatPrice(product.price)}</span>
        </div>
        <span class="mt-3 inline-flex items-center gap-2 border-b border-[#695C50] pb-1 text-[9px] uppercase tracking-[0.14em] text-[#695C50]">View piece <span aria-hidden="true">&rarr;</span></span>
      </a>
    </article>
  `;
}


function renderSpaHome() {
  refreshSpaCatalog();
  const categories = sharedCatalog.categories.filter(
    (category) => category.status !== "Archived",
  );
  const products = sharedCatalog.products.filter(
    (product) =>
      product.status !== "Archived" &&
      window.findArrayItem(
        categories,
        product.categoryId,
        (category) => category.id,
      ) !== null,
  );
  const productGrid = document.getElementById("spa-home-products-grid");
  if (!productGrid) return;
  productGrid.innerHTML = products.length
    ? products.slice(0, 8).map(spaProductCard).join("")
    : '<p class="col-span-full py-10 text-[13px] text-[#756d65]">The collection is being prepared. Please check back soon.</p>';
}

const newsletterForm = document.getElementById("shop-newsletter-form");
if (newsletterForm) {
  newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = document.getElementById("shop-newsletter-email");
    email.value = "";
    email.placeholder = "Thank you for subscribing";
  });
}


function renderSpaCatalog() {
  refreshSpaCatalog();
  const filter = document.getElementById("spa-category-filter");
  const search = document.getElementById("spa-product-search");
  const categories = sharedCatalog.categories.filter(
    (category) => category.status !== "Archived",
  );
  filter.innerHTML = `<option value="">All categories</option>${categories.map((category) => `<option value="${spaEscape(category.id)}">${spaEscape(category.name)}</option>`).join("")}`;
  filter.value = spaSelectedCategory;
  search.value = spaSearchQuery;
  const normalizedSearch = spaSearchQuery.trim().toLowerCase();
  const products = sharedCatalog.products.filter(
    (product) =>
      product.status !== "Archived" &&
      (!spaSelectedCategory || product.categoryId === spaSelectedCategory) &&
      (!normalizedSearch ||
        `${product.name} ${product.description || ""} ${window.findArrayItem(categories, product.categoryId, (category) => category.id)?.name || ""}`
          .toLowerCase()
          .includes(normalizedSearch)) &&
      window.findArrayItem(categories, product.categoryId, (category) => category.id) !== null,
  );
  document.getElementById("spa-catalog-grid").innerHTML =
    products.map(spaProductCard).join("") ||
    `<p class="text-[13px] text-[#9a938c]">No active products in this category.</p>`;
  filter.onchange = () => {
    spaSelectedCategory = filter.value;
    renderSpaCatalog();
  };
  search.oninput = () => {
    spaSearchQuery = search.value;
    renderSpaCatalog();
  };
}

document
  .getElementById("open-product-search")
  ?.addEventListener("click", () => {
    window.location.hash = "#catalog";
    window.setTimeout(() => {
      document.getElementById("spa-product-search")?.focus();
    }, 50);
  });


function renderSpaProduct(productId) {
  refreshSpaCatalog();
  const product = window.findArrayItem(
    sharedCatalog.products,
    productId,
    (item) => item.id,
  );
  if (product?.status === "Archived") {
    document.getElementById("spa-product-name").textContent =
      "Product not found";
    return;
  }
  const category = window.findArrayItem(
    sharedCatalog.categories,
    product?.categoryId,
    (item) => item.id,
  );
  if (!product) {
    document.getElementById("spa-product-name").textContent =
      "Product not found";
    return;
  }
  spaSelectedSize = "";
  spaCustomMeasurements = {};
  const offerRegularSizing = product.offerRegularSizing ?? true;
  const offerCustomSizing =
    product.offerCustomSizing ?? product.sizeMode === "custom";
  const sizeOptions = document.getElementById("spa-size-options");
  const customSizingPanel = document.getElementById("spa-custom-sizing-panel");
  let sizes = offerRegularSizing ? ["S", "M", "L", "XL"] : [];
  if (offerCustomSizing) sizes = window.arrayWithAppended(sizes, "Custom");
  const sizeFieldset = sizeOptions.closest("fieldset");
  sizeFieldset.hidden = sizes.length === 0;
  sizeOptions.innerHTML = sizes
    .map(
      (size) =>
        `<button class="spa-size-option border border-[#bdb7b0] px-4 py-2 text-[11px]" data-size="${size === "Custom" ? "custom" : size}" type="button">${size}</button>`,
    )
    .join("");
  updateSpaSizeAvailability(product);
  customSizingPanel.classList.add("hidden");
  customSizingPanel.innerHTML = "";
  document.getElementById("spa-product-breadcrumb").textContent = product.name;
  document.getElementById("spa-product-category").textContent =
    category?.name || "Ready-to-Wear";
  document.getElementById("spa-product-name").textContent = product.name;
  document.getElementById("spa-product-sku").textContent = `SKU: ${product.id}`;
  document.getElementById("spa-product-price").textContent = spaFormatPrice(
    product.price,
  );
  document.getElementById("spa-product-description").textContent =
    product.description ||
    "A considered piece from the Jorjetteangel ready-to-wear collection.";
  const productImageContainer = document.getElementById("spa-product-image");
  const productImages = spaProductImages(product);


  function renderProductGallery(activeIndex = 0) {
    if (!productImages.length) {
      productImageContainer.innerHTML = `<div class="h-4/5 w-1/3 shadow-sm" style="background:${spaSwatch(product.categoryId)}"></div>`;
      return;
    }
    const image = productImages[activeIndex];
    productImageContainer.innerHTML = `
      <div class="shop-product-gallery">
        <button class="shop-image-trigger" type="button" data-view-full-image data-full-image="${spaEscape(image)}" data-full-image-alt="${spaEscape(product.name)}">
          <img class="h-full w-full object-contain p-8" src="${spaEscape(image)}" alt="${spaEscape(product.name)}" />
          <span>View full image</span>
        </button>
        ${productImages.length > 1 ? `<div class="shop-image-thumbnails" aria-label="More product images">${productImages.map((thumbnail, index) => `<button class="shop-image-thumbnail ${index === activeIndex ? "is-active" : ""}" data-product-image-index="${index}" type="button" aria-label="Show product image ${index + 1}"><img src="${spaEscape(thumbnail)}" alt="" /></button>`).join("")}</div>` : ""}
      </div>
    `;
    productImageContainer
      .querySelectorAll("[data-product-image-index]")
      .forEach((button) => {
        button.onclick = () =>
          renderProductGallery(Number(button.dataset.productImageIndex));
      });
  }
  renderProductGallery();
  document.getElementById("spa-product-quantity").value = 1;
  document.getElementById("spa-cart-message").textContent = "";
  document.getElementById("spa-add-to-cart").disabled = false;
  sizeOptions.querySelectorAll(".spa-size-option").forEach((option) => {
    option.classList.remove("bg-[#0c0907]", "text-white");
    option.onclick = () => {
      spaSelectedSize = option.dataset.size;
      spaCustomMeasurements = {};
      document
        .querySelectorAll("#spa-size-options .spa-size-option")
        .forEach((item) => item.classList.remove("bg-[#0c0907]", "text-white"));
      option.classList.add("bg-[#0c0907]", "text-white");
      customSizingPanel.innerHTML = "";
      if (spaSelectedSize === "custom") {
        const fields = Array.isArray(product.customFields)
          ? product.customFields
          : [];
        customSizingPanel.innerHTML = fields.length
          ? `<div class="space-y-3 rounded border border-[#d9d2cb] bg-[#faf9f7] p-4"><p class="text-[11px] uppercase tracking-[0.2em] text-[#8b8279]">Custom sizing</p>${fields
              .map((savedField) => {
                const field =
                  typeof savedField === "string"
                    ? {
                        name: savedField,
                        unit: "in",
                        hardMin: "",
                        softMin: "",
                        softMax: "",
                        hardMax: "",
                      }
                    : savedField;
                const unitLabel =
                  field.unit === "cm" ? "centimeters" : "inches";
                return `
                  <div class="custom-measurement-row">
                    <label class="block text-[11px] text-[#756d65]">
                      <span class="mb-1 block">${spaEscape(field.name)} (${unitLabel})</span>
                      <input class="spa-custom-size-field h-9 w-full border border-[#bdb7b0] bg-white px-2 text-[12px]" data-custom-field="${spaEscape(field.name)}" placeholder="Enter ${spaEscape(field.name)} in ${unitLabel}" type="number" step="any" required />
                    </label>
                    <p class="custom-measurement-feedback hidden" data-custom-feedback role="alert"></p>
                  </div>`;
              })
              .join("")}</div>`
          : "";
        customSizingPanel.classList.toggle("hidden", !fields.length);
        customSizingPanel
          .querySelectorAll(".spa-custom-size-field")
          .forEach((input) => {
            input.oninput = () => {
              spaCustomMeasurements[input.dataset.customField] =
                input.value.trim();
              const validation = validateCustomMeasurements(
                fields,
                spaCustomMeasurements,
                customSizingPanel,
              );
              document.getElementById("spa-add-to-cart").disabled =
                validation.errors.length > 0;
              document.getElementById("spa-cart-message").textContent = "";
            };
          });
      } else {
        customSizingPanel.classList.add("hidden");
        document.getElementById("spa-add-to-cart").disabled = false;
      }
      document.getElementById("spa-cart-message").textContent = "";
    };
  });
  document.getElementById("spa-quantity-minus").onclick = () => {
    const quantity = document.getElementById("spa-product-quantity");
    quantity.value = Math.max(1, Number(quantity.value) - 1);
  };
  document.getElementById("spa-quantity-plus").onclick = () => {
    const quantity = document.getElementById("spa-product-quantity");
    quantity.value = Number(quantity.value) + 1;
  };
  document.getElementById("spa-add-to-cart").onclick = () => {
    const quantity = Math.max(
      1,
      Number(document.getElementById("spa-product-quantity").value) || 1,
    );
    const message = document.getElementById("spa-cart-message");
    if (sizes.length && !spaSelectedSize) {
      message.textContent =
        "Please select a size before adding this item to your bag.";
      return;
    }
    if (spaSelectedSize === "custom") {
      const fields = Array.isArray(product.customFields)
        ? product.customFields
        : [];
      const missing = fields
        .map((savedField) =>
          typeof savedField === "string"
            ? { name: savedField, unit: "in" }
            : savedField,
        )
        .filter((field) => !(spaCustomMeasurements[field.name] || "").trim())
        .map((field) => field.name);
      if (missing.length) {
        message.textContent = `Please enter your ${missing.join(", ")} before adding this custom-size item.`;
        return;
      }
      const validation = validateCustomMeasurements(
        fields,
        spaCustomMeasurements,
        customSizingPanel,
      );
      if (validation.errors.length) {
        message.textContent =
          "Correct the measurements outside the valid range before adding this item.";
        validation.errors[0].input.focus();
        return;
      }
      window.cartStore.add({
        productId: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        image: spaProductImages(product)[0] || "",
        size: "Custom",
        quantity,
        customMeasurements: spaCustomMeasurements,
      });
      message.textContent = `${quantity} ${product.name} in custom size added to your bag.`;
      return;
    }
    if (spaSelectedSize) {
      const selectedSize = spaSelectedSize;
      const availableStock = spaGetSizeStock(product, selectedSize);
      if (availableStock < quantity) {
        updateSpaSizeAvailability(product);
        message.textContent =
          availableStock <= 0
            ? `Size ${selectedSize} is out of stock. Please choose another size.`
            : `Only ${availableStock} unit${availableStock === 1 ? "" : "s"} of size ${selectedSize} remain in stock.`;
        return;
      }
    }
    window.cartStore.add({
      productId: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: spaProductImages(product)[0] || "",
      size: spaSelectedSize,
      quantity,
    });
    message.textContent = spaSelectedSize
      ? `${quantity} ${product.name} in size ${spaSelectedSize} added to your bag.`
      : `${quantity} ${product.name} added to your bag.`;
  };
}

const imageViewer = document.getElementById("shop-image-viewer");
const imageViewerImage = document.getElementById("shop-image-viewer-image");
let imageViewerTrigger = null;


function closeShopImageViewer() {
  if (!imageViewer) return;
  imageViewer.hidden = true;
  document.body.classList.remove("overflow-hidden");
  imageViewerTrigger?.focus();
  imageViewerTrigger = null;
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-view-full-image]");
  if (trigger && imageViewer && imageViewerImage) {
    imageViewerTrigger = trigger;
    imageViewerImage.src = trigger.dataset.fullImage;
    imageViewerImage.alt = trigger.dataset.fullImageAlt || "Product image";
    imageViewer.hidden = false;
    document.body.classList.add("overflow-hidden");
    imageViewer.querySelector("[data-image-viewer-close]").focus();
  } else if (
    imageViewer &&
    (event.target === imageViewer ||
      event.target.closest("[data-image-viewer-close]"))
  ) {
    closeShopImageViewer();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && imageViewer && !imageViewer.hidden) {
    closeShopImageViewer();
  }
});


function renderSpaBag() {
  const cart = window.cartStore.read();
  const items = document.getElementById("spa-bag-items");
  const summary = document.getElementById("spa-bag-summary");
  if (!items || !summary) return;

  if (!cart.length) {
    items.innerHTML = `<div class="border-t border-[#ded9d1] py-8 text-[13px] text-[#756d65]">Your bag is empty.</div>`;
    summary.innerHTML = `<div class="flex items-center justify-between gap-3"><a class="text-[12px] underline" href="#catalog">Continue shopping</a></div>`;
    return;
  }

  items.innerHTML = cart
    .map(
      (item, index) => `
      <article class="flex gap-4 border-b border-[#ded9d1] py-4 first:border-t">
        <div class="flex h-20 w-20 shrink-0 items-center justify-center bg-white">
          ${item.image ? `<img class="h-full w-full object-contain p-2" src="${spaEscape(item.image)}" alt="${spaEscape(item.name)}" />` : `<div class="h-4/5 w-1/3 bg-[#d9d4c8]"></div>`}
        </div>
        <div class="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-[14px]">${spaEscape(item.name)}</h2>
            ${item.size ? `<p class="mt-1 text-[12px] text-[#756d65]">Size ${spaEscape(item.size)}</p>` : ""}
            <p class="mt-1 text-[12px] text-[#756d65]">${spaFormatPrice(item.price)}</p>
          </div>
          <div class="text-right">
            <div class="flex items-center justify-end gap-2 rounded border border-[#bdb7b0] bg-white px-2 py-1">
              <button class="text-[16px] leading-none text-[#756d65]" data-spa-bag-decrease="${index}" type="button">−</button>
              <input class="quantity-input w-12 border-0 bg-transparent p-0 text-center text-[12px] outline-none" id="spa-bag-quantity-${index}" data-spa-bag-quantity="${index}" min="1" type="number" value="${item.quantity}" />
              <button class="text-[16px] leading-none text-[#756d65]" data-spa-bag-increase="${index}" type="button">+</button>
            </div>
            <button class="mt-3 text-[11px] underline" data-spa-remove="${index}" type="button">Remove</button>
          </div>
        </div>
      </article>
    `,
    )
    .join("");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 100;
  summary.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between text-[12px] text-[#756d65]">
        <span>Subtotal</span>
        <strong class="font-normal text-[#0C0907]">${spaFormatPrice(total)}</strong>
      </div>
      <div class="flex items-center justify-between text-[12px] text-[#756d65]">
        <span>Standard delivery</span>
        <strong class="font-normal text-[#0C0907]">${spaFormatPrice(deliveryFee)}</strong>
      </div>
      <div class="flex items-center justify-between border-t border-[#ded9d1] pt-4 text-[12px] text-[#756d65]">
        <span>Total</span>
        <strong class="font-normal text-[#0C0907]">${spaFormatPrice(total + deliveryFee)}</strong>
      </div>
      <button class="w-full bg-[#0C0907] px-4 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition hover:bg-[#24201D]" data-spa-checkout type="button">Checkout</button>
      <a class="block w-full border border-[#bdb7b0] bg-white px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-[#0C0907]" href="shopping-bag.html">View Cart</a>
    </div>
  `;

  items.querySelectorAll("[data-spa-bag-quantity]").forEach((input) => {
    input.onchange = () => {
      window.cartStore.update(
        Number(input.dataset.spaBagQuantity),
        input.value,
      );
      renderSpaBag();
    };
  });
  items.querySelectorAll("[data-spa-bag-increase]").forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.spaBagIncrease);
      const current = window.cartStore.read()[index]?.quantity || 1;
      window.cartStore.update(index, current + 1);
      renderSpaBag();
    };
  });
  items.querySelectorAll("[data-spa-bag-decrease]").forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.spaBagDecrease);
      const current = window.cartStore.read()[index]?.quantity || 1;
      window.cartStore.update(index, current - 1);
      renderSpaBag();
    };
  });
  items.querySelectorAll("[data-spa-remove]").forEach((button) => {
    button.onclick = () => {
      window.cartStore.remove(Number(button.dataset.spaRemove));
      renderSpaBag();
    };
  });
  summary.querySelector("[data-spa-checkout]").addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("jorjetteangel:checkout-requested"));
  });
}


function openBagOverlay() {
  const bagView = document.getElementById("spa-bag-view");
  if (bagView) {
    bagView.classList.remove("hidden");
  }
  document.body.classList.add("overflow-hidden");
  renderSpaBag();
}


function closeBagOverlay() {
  const bagView = document.getElementById("spa-bag-view");
  if (bagView) {
    bagView.classList.add("hidden");
  }
  document.body.classList.remove("overflow-hidden");
}


function renderSpaRoute() {
  const route = window.location.hash.slice(1) || "home";
  const productMatch = route.match(/^product\/(.+)$/);
  const view = productMatch
    ? "product"
    : window.findArrayItem(["catalog", "checkout"], route, (item) => item)
      ? route
      : "home";
  document
    .querySelectorAll(
      "body > section:not([data-spa-view]):not(#catalog-section):not(#account-welcome)",
    )
    .forEach((section) => section.classList.toggle("hidden", view !== "home"));
  document.querySelectorAll("[data-spa-view]").forEach((section) => {
    const shouldShow = section.dataset.spaView === view;
    section.classList.toggle("hidden", !shouldShow);
    if (section.dataset.spaView === "bag" && !shouldShow) {
      section.classList.add("hidden");
    }
  });

  if (view === "catalog") renderSpaCatalog();
  if (view === "home") renderSpaHome();
  if (view === "product") renderSpaProduct(decodeURIComponent(productMatch[1]));
  if (route === "bag") {
    openBagOverlay();
  } else {
    closeBagOverlay();
  }

  if (route === "bespoke-journey") {
    window.setTimeout(() => {
      const feature = document.getElementById("bespoke-journey");
      const header = document.querySelector("header");
      if (feature) {
        const top =
          window.scrollY +
          feature.getBoundingClientRect().top -
          (header?.offsetHeight || 0);
        window.scrollTo({ top, behavior: "instant" });
      }
    }, 0);
  } else if (view !== "bag") {
    window.scrollTo(0, 0);
  }
}

const closeBagButtons = document.querySelectorAll("[data-spa-bag-close]");
closeBagButtons.forEach((button) => {
  button.addEventListener("click", () => {
    closeBagOverlay();
    if (window.location.hash === "#bag") {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  });
});

const bagLinks = document.querySelectorAll('a[href="#bag"]');
bagLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    openBagOverlay();
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + "#bag",
    );
  });
});

window.addEventListener("storage", (event) => {
  if (event.key === SPA_CATALOG_STORAGE_KEY) renderSpaRoute();
});

window.addEventListener("jorjetteangel:cart-updated", () => {
  const bagView = document.getElementById("spa-bag-view");
  if (bagView && !bagView.classList.contains("hidden")) renderSpaBag();
});

window.addEventListener("hashchange", renderSpaRoute);
renderSpaRoute();
