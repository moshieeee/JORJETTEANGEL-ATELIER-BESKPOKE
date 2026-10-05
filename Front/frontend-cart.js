// Manages the customer shopping cart.

const CART_STORAGE_KEY = "jorjetteangel-shopping-bag";


function readCart() {
  const saved = window.backendMemoryStorage.getItem(CART_STORAGE_KEY);
  if (saved === null) return [];
  const cart = JSON.parse(saved);
  if (!Array.isArray(cart)) {
    throw new Error("Saved shopping bag must be an array.");
  }
  return cart;
}


function saveCart(cart) {
  window.backendMemoryStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartCount(cart);
  window.dispatchEvent(new CustomEvent("jorjetteangel:cart-updated"));
}


function updateCartCount(cart = readCart()) {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = count;
  });
}

window.cartStore = {
  read: readCart,
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
      saveCart(window.arrayWithAppended(cart, item));
      return;
    }
    saveCart(cart);
  },
  update(index, quantity) {
    const cart = readCart();
    if (!cart[index]) return;
    cart[index].quantity = Math.max(1, Number(quantity) || 1);
    saveCart(cart);
  },
  remove(index) {
    const cart = readCart();
    const updatedCart = window.arrayWithoutRange(cart, index);
    saveCart(updatedCart);
  },
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
