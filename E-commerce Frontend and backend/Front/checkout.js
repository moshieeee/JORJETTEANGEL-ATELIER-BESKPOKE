const CHECKOUT_ORDERS_STORAGE_KEY = "jorjetteangel-orders";
const STANDARD_DELIVERY_FEE = 100;
let authorizedCheckoutCustomer = null;


// Format a checkout amount as Philippine pesos.
function formatCheckoutPrice(price) {
  return `PHP ${Number(price).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;
}


// Render checkout line items, quantities, and the delivery-inclusive total.
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
    description.textContent = `Size ${item.size} · Qty ${item.quantity}`;
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


// Populate read-only customer details and allow this customer to check out.
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
    const orderReference = `JA-${Date.now().toString(36).toUpperCase()}`;
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const order = {
      reference: orderReference,
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
      items: cart.map((item) => ({ ...item })),
      subtotal,
      deliveryFee: STANDARD_DELIVERY_FEE,
      total: subtotal + STANDARD_DELIVERY_FEE,
      status: "Received",
      createdAt: new Date().toISOString(),
    };

    try {
      const savedOrders = localStorage.getItem(CHECKOUT_ORDERS_STORAGE_KEY);
      const orders = savedOrders ? JSON.parse(savedOrders) : [];
      if (!Array.isArray(orders)) {
        throw new Error("Saved orders must be an array.");
      }
      orders.push(order);
      localStorage.setItem(CHECKOUT_ORDERS_STORAGE_KEY, JSON.stringify(orders));
      window.cartStore.clear();
      document.getElementById("checkout-content").classList.add("hidden");
      document.getElementById("checkout-confirmation-reference").textContent =
        `Your order reference is ${orderReference}.`;
      document
        .getElementById("checkout-confirmation")
        .classList.remove("hidden");
    } catch (error) {
      console.error("Could not save the customer order.", error);
      message.textContent =
        "We could not place your order. Please try again without closing this page.";
    }
  });

renderCheckoutSummary();

