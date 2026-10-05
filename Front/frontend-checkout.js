// Handles customer checkout and order creation.

const CHECKOUT_ORDERS_STORAGE_KEY = "jorjetteangel-orders";
const CHECKOUT_CATALOG_STORAGE_KEY = "jorjetteangel-admin-catalog";
const STANDARD_DELIVERY_FEE = 100;
let authorizedCheckoutCustomer = null;


function formatCheckoutPrice(price) {
  return `PHP ${Number(price).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;
}

function orderIdPrefix(item, isBulkOrder) {
  if (isBulkOrder) return "ORD-BLK";
  const size = typeof item.size === "string" ? item.size.toUpperCase() : "";
  if (size === "CUSTOM") return "ORD-CST";
  if (["S", "M", "L", "XL"].includes(size)) return "ORD-RTW";
  return "ORD";
}


function assignOrderIds(cart, orders) {
  const totalQuantity = cart.reduce(
    (total, item) => total + Math.max(0, Number(item.quantity) || 0),
    0,
  );
  const isBulkOrder = totalQuantity > 50;
  const prefixes = ["ORD-RTW", "ORD-CST", "ORD-BLK", "ORD"];
  const highestSequences = new Map(prefixes.map((prefix) => [prefix, 0]));
  const recordExistingId = (orderId) => {
    if (typeof orderId !== "string") return;
    const match = /^(ORD-RTW|ORD-CST|ORD-BLK|ORD)-(\d{4,})$/.exec(orderId);
    if (!match) return;
    const sequence = Number(match[2]);
    if (Number.isSafeInteger(sequence)) {
      highestSequences.set(
        match[1],
        Math.max(highestSequences.get(match[1]), sequence),
      );
    }
  };

  orders.forEach((order) => {
    recordExistingId(order?.reference);
    if (Array.isArray(order?.orderIds)) {
      order.orderIds.forEach(recordExistingId);
    }
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    orderItems.forEach((item) => {
      recordExistingId(item?.orderId);
    });
  });

  return cart.map((item) => {
    const prefix = orderIdPrefix(item, isBulkOrder);
    const sequence = highestSequences.get(prefix) + 1;
    highestSequences.set(prefix, sequence);
    return {
      ...item,
      orderId: `${prefix}-${String(sequence).padStart(4, "0")}`,
    };
  });
}

function deductFinishedGoodsStock(cart) {
  const savedCatalog = window.backendMemoryStorage.getItem(CHECKOUT_CATALOG_STORAGE_KEY);
  if (!savedCatalog) {
    throw new Error("Finished-goods stock is unavailable. Please refresh and try again.");
  }
  const catalog = JSON.parse(savedCatalog);
  if (!catalog || !Array.isArray(catalog.products)) {
    throw new Error("The shared product catalog is invalid.");
  }

  let i = 0;
  while (i < cart.length) {
    const item = cart[i];
    const size = String(item.size || "").toUpperCase();
    if (["S", "M", "L", "XL"].includes(size)) {
      const product = catalog.products.find(
        (entry) => entry.id === item.productId,
      );
      const sizeStock = Array.isArray(product?.finishedGoodsStock)
        ? product.finishedGoodsStock.find(
            (entry) => String(entry?.[0]).toUpperCase() === size,
          )
        : null;
      const available = Math.max(0, Number(sizeStock?.[1]) || 0);
      if (!sizeStock || available < item.quantity) {
        throw new Error(
          available > 0
            ? `Only ${available} unit${available === 1 ? "" : "s"} of ${item.name} size ${size} remain in stock.`
            : `${item.name} size ${size} is out of stock.`,
        );
      }
      sizeStock[1] = available - item.quantity;
    }
    i += 1;
  }
  return catalog;
}


function renderCheckoutSummary() {
  const orderItems = document.getElementById("checkout-order-items");
  const itemCount = document.getElementById("checkout-item-count");
  const totalElement = document.getElementById("checkout-total");
  if (!orderItems || !itemCount || !totalElement) return;
  const cart = window.cartStore.read();
  if (cart.length) {
    document.getElementById("checkout-content").classList.remove("hidden");
    document.getElementById("checkout-confirmation").classList.add("hidden");
    document.getElementById("checkout-message").textContent = "";
  }
  orderItems.replaceChildren();

  const quantityCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  itemCount.textContent = `${quantityCount} item${quantityCount === 1 ? "" : "s"}`;

  if (!cart.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "py-4 text-[12px] text-[#756D65]";
    emptyMessage.textContent = "Your bag is empty.";
    orderItems.append(emptyMessage);
  }

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "flex items-start gap-3 py-4 text-[12px]";
    if (item.image) {
      const image = document.createElement("img");
      image.className = "h-16 w-14 shrink-0 bg-[#FAF9F7] object-contain p-1";
      image.src = item.image;
      image.alt = item.name;
      row.append(image);
    }
    const detail = document.createElement("div");
    detail.className = "min-w-0 flex-1";
    const name = document.createElement("p");
    name.className = "font-medium";
    name.textContent = item.name;
    const description = document.createElement("p");
    description.className = "mt-1 text-[#756D65]";
    description.textContent = item.size
      ? `Size ${item.size} · Qty ${item.quantity}`
      : `Qty ${item.quantity}`;
    detail.append(name, description);
    const price = document.createElement("span");
    price.className = "shrink-0 text-right";
    price.textContent = formatCheckoutPrice(item.price * item.quantity);
    row.append(detail, price);
    orderItems.append(row);
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  totalElement.textContent = formatCheckoutPrice(
    subtotal + STANDARD_DELIVERY_FEE,
  );
}


function authorizeCheckout(customer) {
  authorizedCheckoutCustomer = customer;
  document.getElementById("checkout-name").value =
    `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
  document.getElementById("checkout-email").value = customer.email || "";
  document.getElementById("checkout-mobile").value = customer.mobile || "";
  renderCheckoutSummary();

  if (window.location.hash !== "#checkout") {
    window.location.hash = "checkout";
  } else {
    renderCheckoutSummary();
  }
}

window.addEventListener("jorjetteangel:checkout-authorized", (event) => {
  authorizeCheckout(event.detail.customer);
});
window.addEventListener("hashchange", () => {
  if (window.location.hash === "#checkout") renderCheckoutSummary();
});
window.addEventListener("jorjetteangel:cart-updated", renderCheckoutSummary);
window.addEventListener("jorjetteangel:account-reset", () => {
  authorizedCheckoutCustomer = null;
});

document
  .getElementById("spa-checkout-form")
  .addEventListener("submit", (event) => {
    event.preventDefault();
    const message = document.getElementById("checkout-message");
    message.textContent = "";
    if (!authorizedCheckoutCustomer) {
      window.dispatchEvent(new CustomEvent("jorjetteangel:checkout-requested"));
      return;
    }

    const cart = window.cartStore.read();
    if (!cart.length) {
      message.textContent = "Your bag is empty. Add an item before checking out.";
      window.location.hash = "bag";
      return;
    }

    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    try {
      const savedOrders = window.backendMemoryStorage.getItem(CHECKOUT_ORDERS_STORAGE_KEY);
      let orders = savedOrders ? JSON.parse(savedOrders) : [];
      if (!Array.isArray(orders)) {
        throw new Error("Saved orders must be an array.");
      }
      const orderedItems = assignOrderIds(cart, orders);
      const orderIds = orderedItems.map((item) => item.orderId);
      const orderReference = orderIds[0];
      const subtotal = orderedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const order = {
        reference: orderReference,
        orderIds,
        accountEmail: authorizedCheckoutCustomer.email,
        customer: {
          name:
            `${authorizedCheckoutCustomer.firstName || ""} ${authorizedCheckoutCustomer.lastName || ""}`.trim(),
          email: authorizedCheckoutCustomer.email || "",
          mobile: authorizedCheckoutCustomer.mobile || "",
        },
        deliveryAddress: {
          street: document.getElementById("checkout-address").value.trim(),
          city: document.getElementById("checkout-city").value.trim(),
          province: document.getElementById("checkout-province").value.trim(),
          postalCode: document.getElementById("checkout-postal").value.trim(),
          notes: document.getElementById("checkout-notes").value.trim(),
        },
        paymentMethod: "Cash on delivery",
        items: orderedItems,
        subtotal,
        deliveryFee: STANDARD_DELIVERY_FEE,
        total: subtotal + STANDARD_DELIVERY_FEE,
        status: "Received",
        createdAt: new Date().toISOString(),
      };
      orders = window.arrayWithAppended(orders, order);
      const originalCatalog = window.backendMemoryStorage.getItem(
        CHECKOUT_CATALOG_STORAGE_KEY,
      );
      let updatedCatalog;
      if (orderedItems.some((item) => ["S", "M", "L", "XL"].includes(String(item.size || "").toUpperCase()))) {
        updatedCatalog = deductFinishedGoodsStock(orderedItems);
        window.backendMemoryStorage.setItem(
          CHECKOUT_CATALOG_STORAGE_KEY,
          JSON.stringify(updatedCatalog),
        );
      }
      try {
        window.backendMemoryStorage.setItem(CHECKOUT_ORDERS_STORAGE_KEY, JSON.stringify(orders));
      } catch (error) {
        if (updatedCatalog) {
          if (originalCatalog === null) {
            window.backendMemoryStorage.removeItem(CHECKOUT_CATALOG_STORAGE_KEY);
          } else {
            window.backendMemoryStorage.setItem(
              CHECKOUT_CATALOG_STORAGE_KEY,
              originalCatalog,
            );
          }
        }
        throw error;
      }
      window.cartStore.clear();
      document.getElementById("checkout-content").classList.add("hidden");
      document.getElementById("checkout-confirmation-reference").textContent =
        `Your order ID${orderIds.length === 1 ? "" : "s"}: ${orderIds.join(", ")}.`;
      document
        .getElementById("checkout-confirmation")
        .classList.remove("hidden");
    } catch (error) {
      console.error("Could not save the customer order.", error);
      message.textContent = error instanceof Error
        ? error.message
        : "We could not place your order. Please try again without closing this page.";
    }
  });

renderCheckoutSummary();
