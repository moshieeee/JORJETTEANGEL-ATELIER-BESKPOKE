// Format a numeric price as Philippine pesos for the bag.
function formatBagPrice(price) {
  return `PHP ${Number(price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}


// Render cart items, totals, and quantity/removal controls on the bag page.
function renderBag() {
  const cart = window.cartStore.read();
  const items = document.getElementById("bag-items");
  const summary = document.getElementById("bag-summary");

  if (!cart.length) {
    items.innerHTML = `<p class="border-t border-[#ded9d1] py-8 text-[13px] text-[#756d65]">Your bag is empty.</p>`;
    summary.innerHTML = `<a class="text-[12px] underline" href="E-commerce.html#catalog">Continue shopping</a>`;
    return;
  }

  items.innerHTML = cart
    .map(
      (item, index) => `
    <article class="flex gap-5 border-t border-[#ded9d1] py-5">
      <div class="flex h-28 w-24 shrink-0 items-center justify-center bg-white">
        ${item.image ? `<img class="h-full w-full object-contain p-2" src="${item.image}" alt="${item.name}" />` : `<div class="h-4/5 w-1/3 bg-[#d9d4c8]"></div>`}
      </div>
      <div class="flex min-w-0 flex-1 items-start justify-between gap-4">
        <div>
          <h2 class="text-[14px]">${item.name}</h2>
          <p class="mt-2 text-[12px] text-[#756d65]">Size ${item.size}</p>
          <p class="mt-1 text-[12px] text-[#756d65]">${formatBagPrice(item.price)}</p>
        </div>
        <div class="text-right">
          <label class="text-[11px] text-[#756d65]" for="bag-quantity-${index}">Quantity</label>
          <input class="mt-2 block w-16 border border-[#bdb7b0] bg-white px-2 py-2 text-center text-[12px]" id="bag-quantity-${index}" data-bag-quantity="${index}" min="1" type="number" value="${item.quantity}" />
          <button class="mt-3 text-[11px] underline" data-remove-bag-item="${index}" type="button">Remove</button>
        </div>
      </div>
    </article>
  `,
    )
    .join("");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  summary.innerHTML = `
    <div>
      <span class="text-[12px]">Total</span>
      <strong class="ml-3 font-normal">${formatBagPrice(total)}</strong>
    </div>
    <a class="bg-[#0C0907] px-6 py-4 text-center text-[10px] uppercase tracking-[0.18em] text-white" href="E-commerce.html#checkout">Checkout</a>
  `;

  items.querySelectorAll("[data-bag-quantity]").forEach((input) => {
    input.addEventListener("change", () => {
      window.cartStore.update(Number(input.dataset.bagQuantity), input.value);
      renderBag();
    });
  });
  items.querySelectorAll("[data-remove-bag-item]").forEach((button) => {
    button.addEventListener("click", () => {
      window.cartStore.remove(Number(button.dataset.removeBagItem));
      renderBag();
      window.addEventListener("jorjetteangel:cart-updated", renderBag);
    });
  });
}

renderBag();

