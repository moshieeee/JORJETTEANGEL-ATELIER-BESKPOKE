const CATALOG_STORAGE_KEY = "jorjetteangel-admin-catalog";
const queryParams = new URLSearchParams(window.location.search);
const productId = queryParams.get("id");
const backTarget = queryParams.get("from") || "ready-to-wear.html";


// Validate required custom measurements and enforce configured range limits.
window.validateCustomMeasurements = function (
  fields,
  measurements,
  container,
) {
  const missing = [];
  const errors = [];
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
      missing.push(field.name);
      return;
    }
    if (!Number.isFinite(value)) {
      input.setCustomValidity("Enter a valid numeric measurement.");
      feedback.textContent = "Enter a valid numeric measurement.";
      feedback.classList.remove("hidden");
      errors.push({ field, input });
      return;
    }
    if (!hasLimits) return;

    if (value < minimum) {
      feedback.textContent = `This entry is below the valid minimum (${minimum} ${field.unit}). Please enter a correct measurement.`;
      feedback.classList.remove("hidden");
      input.setCustomValidity(feedback.textContent);
      errors.push({ field, input });
      return;
    }
    if (value > maximum) {
      feedback.textContent = `This entry exceeds the valid maximum (${maximum} ${field.unit}). Please enter a correct measurement.`;
      feedback.classList.remove("hidden");
      input.setCustomValidity(feedback.textContent);
      errors.push({ field, input });
      return;
    }
  });
  return { missing, errors };
};

const backButton = document.getElementById("product-back-button");
if (backButton) {
  backButton.addEventListener("click", () => {
    window.location.href = backTarget;
  });
}

const fallbackCatalog = {
  categories: [],
  products: [],
};


// Read the shared catalog from browser storage or use an empty fallback.
function readCatalog() {
  const saved = localStorage.getItem(CATALOG_STORAGE_KEY);
  return saved ? JSON.parse(saved) : fallbackCatalog;
}


// Escape product text before inserting it into HTML markup.
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


// Format a product price or show its consultation-only label.
function formatPrice(price) {
  return price
    ? `PHP ${Number(price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : "By consultation";
}


// Return the placeholder color associated with a product category.
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


// Return product images while retaining support for legacy single-image data.
function productImages(product) {
  return Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : product.image
      ? [product.image]
      : [];
}

const catalog = readCatalog();
const product = window.findArrayItem(
  catalog.products,
  productId,
  (item) => item.id,
);
const activeProduct = product?.status === "Archived" ? null : product;
const category = window.findArrayItem(
  catalog.categories,
  activeProduct?.categoryId,
  (item) => item.id,
);
const categorySnapshot = JSON.stringify(category);

if (!activeProduct) {
  document.getElementById("product-detail").innerHTML = `
    <div class="py-16">
      <h1 class="font-editorial text-3xl">Product not found</h1>
      <a class="mt-6 inline-block text-[12px] underline" href="ready-to-wear.html">Return to shop</a>
    </div>
  `;
} else {
  document.title = `${activeProduct.name} | Jorjetteangel Atelier`;
  document.getElementById("product-breadcrumb").textContent = activeProduct.name;
  document.getElementById("product-category").textContent =
    category?.name || "Ready-to-Wear";
  document.getElementById("product-name").textContent = activeProduct.name;
  document.getElementById("product-sku").textContent = `SKU: ${activeProduct.id}`;
  document.getElementById("product-price").textContent = formatPrice(
    activeProduct.price,
  );
  document.getElementById("product-description").textContent =
    activeProduct.description ||
    "A considered piece from the Jorjetteangel ready-to-wear collection.";
  const productImageContainer = document.getElementById("product-image");
  const images = productImages(activeProduct);


  // Render the selected product image and clickable thumbnails.
  function renderProductGallery(activeIndex = 0) {
    if (!images.length) {
      productImageContainer.innerHTML = `<div class="h-4/5 w-1/3 shadow-sm" style="background:${swatchFor(product.categoryId)}"></div>`;
      return;
    }
    const image = images[activeIndex];
    productImageContainer.innerHTML = `
      <div class="shop-product-gallery">
        <button class="shop-image-trigger" type="button" data-view-full-image data-full-image="${escapeHtml(image)}" data-full-image-alt="${escapeHtml(activeProduct.name)}">
          <img class="h-full w-full object-contain p-8" src="${escapeHtml(image)}" alt="${escapeHtml(activeProduct.name)}" />
          <span>View full image</span>
        </button>
        ${images.length > 1 ? `<div class="shop-image-thumbnails" aria-label="More product images">${images.map((thumbnail, index) => `<button class="shop-image-thumbnail ${index === activeIndex ? "is-active" : ""}" data-product-image-index="${index}" type="button" aria-label="Show product image ${index + 1}"><img src="${escapeHtml(thumbnail)}" alt="" /></button>`).join("")}</div>` : ""}
      </div>
    `;
    productImageContainer
      .querySelectorAll("[data-product-image-index]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          renderProductGallery(Number(button.dataset.productImageIndex)),
        );
      });
  }

  window.addEventListener("storage", (event) => {
      if (event.key !== CATALOG_STORAGE_KEY) return;
      const latestCatalog = readCatalog();
      const latestProduct = window.findArrayItem(
        latestCatalog.products,
        productId,
        (item) => item.id,
      );
      const latestCategory = window.findArrayItem(
        latestCatalog.categories,
        latestProduct?.status === "Archived" ? null : latestProduct?.categoryId,
        (item) => item.id,
      );
      if (
        JSON.stringify(latestProduct?.status === "Archived" ? null : latestProduct) !==
          JSON.stringify(activeProduct) ||
        JSON.stringify(latestCategory) !== categorySnapshot
      ) {
        window.location.href = "ready-to-wear.html";
      }
  });
  renderProductGallery();

  const imageViewer = document.getElementById("shop-image-viewer");
  const imageViewerImage = document.getElementById("shop-image-viewer-image");
  let imageViewerTrigger = null;


  // Close the full-image viewer and restore focus to its trigger.
  function closeImageViewer() {
    imageViewer.hidden = true;
    document.body.classList.remove("overflow-hidden");
    imageViewerTrigger?.focus();
    imageViewerTrigger = null;
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-view-full-image]");
    if (trigger) {
      imageViewerTrigger = trigger;
      imageViewerImage.src = trigger.dataset.fullImage;
      imageViewerImage.alt = trigger.dataset.fullImageAlt || "Product image";
      imageViewer.hidden = false;
      document.body.classList.add("overflow-hidden");
      imageViewer.querySelector("[data-image-viewer-close]").focus();
    } else if (
      event.target === imageViewer ||
      event.target.closest("[data-image-viewer-close]")
    ) {
      closeImageViewer();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !imageViewer.hidden) closeImageViewer();
  });

  const sizeOptionsContainer = document.getElementById("size-options");
  const customSizingPanel = document.getElementById("custom-sizing-panel");
  let selectedSize = "";
  let customMeasurements = {};
  const offerRegularSizing = product.offerRegularSizing ?? true;
  const offerCustomSizing =
    product.offerCustomSizing ?? product.sizeMode === "custom";


  // Build measurement inputs from the product's custom-sizing configuration.
  function renderCustomFields() {
    const customFields = Array.isArray(product.customFields)
      ? product.customFields
      : [];
    customMeasurements = {};
    if (!customFields.length || !offerCustomSizing) {
      customSizingPanel.classList.add("hidden");
      customSizingPanel.innerHTML = "";
      return;
    }

    customSizingPanel.innerHTML = `
      <div class="space-y-3 rounded border border-[#d9d2cb] bg-[#faf9f7] p-4">
        <p class="text-[11px] uppercase tracking-[0.2em] text-[#8b8279]">Custom sizing</p>
        ${customFields
          .map((savedField) => {
            const field =
              typeof savedField === "string"
                ? { name: savedField, unit: "in" }
                : savedField;
            const unitLabel = field.unit === "cm" ? "centimeters" : "inches";
            return `
              <div class="custom-measurement-row">
                <label class="block text-[11px] text-[#756d65]">
                  <span class="mb-1 block">${escapeHtml(field.name)} (${unitLabel})</span>
                  <input class="custom-size-field h-9 w-full border border-[#bdb7b0] bg-white px-2 text-[12px] outline-none" data-custom-field="${escapeHtml(field.name)}" type="number" step="any" placeholder="Enter ${escapeHtml(field.name)} in ${unitLabel}" required />
                </label>
                <p class="custom-measurement-feedback hidden" data-custom-feedback role="alert"></p>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
    customSizingPanel.classList.remove("hidden");

    customSizingPanel
      .querySelectorAll(".custom-size-field")
      .forEach((input) => {
        input.addEventListener("input", () => {
          customMeasurements[input.dataset.customField] = input.value.trim();
          const validation = validateCustomMeasurements(
            customFields.map((f) => (typeof f === "string" ? { name: f, unit: "in" } : f)),
            customMeasurements,
            customSizingPanel,
          );
          document.getElementById("add-to-cart-btn").disabled =
            validation.errors.length > 0;
        });
      });
  }

  const standardButtons = ["S", "M", "L", "XL"];
  sizeOptionsContainer.innerHTML = `${
    offerRegularSizing
      ? standardButtons
          .map(
            (size) =>
              `<button class="size-option border border-[#bdb7b0] px-4 py-2 text-[11px] transition" data-size="${size}" type="button">${size}</button>`,
          )
          .join("")
      : ""
  }${offerCustomSizing ? ` <button class="size-option border border-[#bdb7b0] px-4 py-2 text-[11px] transition" data-size="custom" type="button">Custom</button>` : ""}`;

  const sizeOptions = document.querySelectorAll(".size-option");
  sizeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      selectedSize = option.dataset.size;
      sizeOptions.forEach((item) => {
        item.classList.remove("bg-[#0c0907]", "text-white");
      });
      option.classList.add("bg-[#0c0907]", "text-white");
      if (selectedSize === "custom") {
        renderCustomFields();
      } else {
        customSizingPanel.classList.add("hidden");
        customSizingPanel.innerHTML = "";
      }
      document.getElementById("cart-message").textContent = "";
    });
  });

  const quantity = document.getElementById("product-quantity");
  document.getElementById("quantity-minus").addEventListener("click", () => {
    quantity.value = Math.max(1, Number(quantity.value) - 1);
  });
  document.getElementById("quantity-plus").addEventListener("click", () => {
    quantity.value = Number(quantity.value) + 1;
  });
  document.getElementById("add-to-cart").addEventListener("click", () => {
    if (!selectedSize) {
      document.getElementById("cart-message").textContent =
        "Please select a size before adding this item to your bag.";
      return;
    }

    if (selectedSize === "custom") {
      const customFields = Array.isArray(product.customFields)
        ? product.customFields
        : [];
      const missing = customFields
        .map((savedField) =>
          typeof savedField === "string"
            ? { name: savedField, unit: "in" }
            : savedField,
        )
        .filter((field) => !(customMeasurements[field.name] || "").trim())
        .map((field) => field.name);
      if (missing.length) {
        document.getElementById("cart-message").textContent =
          `Please enter your ${missing.join(", ")} before adding this custom-size item.`;
        return;
      }
      const customFieldsNormalized = customFields.map((f) =>
        typeof f === "string" ? { name: f, unit: "in" } : f,
      );
      const validation = validateCustomMeasurements(
        customFieldsNormalized,
        customMeasurements,
        document.getElementById("custom-sizing-panel"),
      );
      if (validation.errors.length) {
        document.getElementById("cart-message").textContent =
          "Correct the measurements outside the valid range before adding this item.";
        validation.errors[0].input.focus();
        return;
      }
      window.cartStore.add({
        productId: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        image: productImages(product)[0] || "",
        size: "Custom",
        quantity: Math.max(1, Number(quantity.value) || 1),
        customMeasurements,
      });
      document.getElementById("cart-message").textContent =
        `${quantity.value} ${product.name} in custom size added to your bag.`;
      return;
    }

    window.cartStore.add({
      productId: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: productImages(product)[0] || "",
      size: selectedSize,
      quantity: Math.max(1, Number(quantity.value) || 1),
    });
    document.getElementById("cart-message").textContent =
      `${quantity.value} ${product.name} in size ${selectedSize} added to your bag.`;
  });
}

