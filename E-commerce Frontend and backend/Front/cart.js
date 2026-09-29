const CART_STORAGE_KEY = "jorjetteangel-shopping-bag";


// Read and validate the shopping-bag array from browser storage.
function readCart() {
  const saved = localStorage.getItem(CART_STORAGE_KEY);
  if (saved === null) return [];
  const cart = JSON.parse(saved);
  if (!Array.isArray(cart)) {
    throw new Error("Saved shopping bag must be an array.");
  }
  return cart;
}


// Persist cart changes, refresh the count, and notify connected views.
function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartCount(cart);
  window.dispatchEvent(new CustomEvent("jorjetteangel:cart-updated"));
}


// Display the total item quantity in every cart-count indicator.
function updateCartCount(cart = readCart()) {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = count;
  });
}

window.cartStore = {
  // Expose the validated cart reader to storefront modules.
  read: readCart,
  // Add an item or increase quantity when the same product and size exist.
  add(item) {
    const cart = readCart();
    const itemKey = `${item.productId}\u0000${item.size}`;
    const existingItem = window.findArrayItem(
      cart,
      itemKey,
      (entry) => `${entry.productId}\u0000${entry.size}`,
    );
    if (existingItem) {
      existingItem.quantity += item.quantity;
    } else {
      cart.push(item);
    }
    saveCart(cart);
  },
  // Update a cart item's quantity while keeping it at least one.
  update(index, quantity) {
    const cart = readCart();
    if (!cart[index]) return;
    cart[index].quantity = Math.max(1, Number(quantity) || 1);
    saveCart(cart);
  },
  // Remove one cart item by its current array position.
  remove(index) {
    const cart = readCart();
    cart.splice(index, 1);
    saveCart(cart);
  },
  // Empty the cart and notify all connected storefront views.
  clear() {
    saveCart([]);
  },
};

updateCartCount();

window.addEventListener("storage", (event) => {
  if (event.key !== CART_STORAGE_KEY) return;
  updateCartCount(readCart());
  window.dispatchEvent(new CustomEvent("jorjetteangel:cart-updated"));
});

