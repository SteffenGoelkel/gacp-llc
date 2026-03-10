/* ============================================================
   GACP LLC — cart.js
   Cart management: add, remove, update, render, persist
   ============================================================ */

const CART_KEY = 'gacp_cart';

function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId, qty = 1) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const cart = getCart();
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: productId, qty });
  }

  saveCart(cart);
  showToast('Added to cart', 'success');
  closeOverlay();
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
}

function updateCartQty(productId, qty) {
  if (qty < 1) return removeFromCart(productId);
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) item.qty = qty;
  saveCart(cart);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-badge');
  const count = getCartCount();
  badges.forEach(b => {
    b.textContent = count;
    b.classList.toggle('hidden', count === 0);
  });
}

// --- Cart Page Rendering -----------------------------------

async function initCartPage() {
  const container = document.getElementById('cart-container');
  if (!container) return;

  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  await loadProducts();
  renderCart(profile);
}

function renderCart(profile) {
  const container = document.getElementById('cart-container');
  if (!container) return;

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
          </svg>
        </div>
        <h3 class="empty-state__title">Your cart is empty</h3>
        <p class="empty-state__text">Browse our catalogue to find products.</p>
        <a href="${PATHS.CATALOGUE}" class="btn btn--primary">View Catalogue</a>
      </div>
    `;
    return;
  }

  const discount = getTierDiscount(profile?.tier);
  let subtotal = 0;

  const itemsHTML = cart.map(item => {
    const product = PRODUCTS.find(p => p.id === item.id);
    if (!product) return '';

    const layer = getProductLayer(product, profile);
    const lineTotal = product.price * item.qty;
    subtotal += lineTotal;

    return `
      <div class="cart-item" data-id="${product.id}">
        <img class="cart-item__img" src="${product.img}" alt="${escapeHtml(layer.name)}"
             onerror="this.style.background='var(--ink-mid)'">
        <div>
          <div class="cart-item__name">${escapeHtml(layer.name)}</div>
          <div class="cart-item__unit">${product.unit} · ${formatPrice(product.price)} each</div>
        </div>
        <div class="qty">
          <button class="qty__btn" data-action="dec" data-id="${product.id}">−</button>
          <span class="qty__val">${item.qty}</span>
          <button class="qty__btn" data-action="inc" data-id="${product.id}">+</button>
        </div>
        <span class="cart-item__price">${formatPrice(lineTotal)}</span>
        <button class="cart-item__remove" data-action="remove" data-id="${product.id}" aria-label="Remove">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  const discountAmount = Math.round(subtotal * discount);
  const total = subtotal - discountAmount;

  container.innerHTML = `
    <div class="cart-items">${itemsHTML}</div>
    <div class="cart-summary">
      <div class="cart-summary__row">
        <span>Subtotal</span>
        <span>${formatPrice(subtotal)}</span>
      </div>
      ${discount > 0 ? `
        <div class="cart-summary__row cart-summary__discount">
          <span>${profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)} discount (${(discount * 100).toFixed(0)}%)</span>
          <span>−${formatPrice(discountAmount)}</span>
        </div>
      ` : ''}
      <div class="cart-summary__row cart-summary__row--total">
        <span>Total</span>
        <span>${formatPrice(total)}</span>
      </div>
      <button class="btn btn--primary btn--full" style="margin-top:var(--sp-lg)" disabled>
        Proceed to Checkout
      </button>
      <p class="text-xs text-muted" style="text-align:center;margin-top:var(--sp-sm)">
        Checkout coming soon — contact us to place an order.
      </p>
    </div>
  `;

  // Event delegation for qty buttons
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'remove') {
      removeFromCart(id);
      renderCart(profile);
    } else if (action === 'inc') {
      const item = getCart().find(i => i.id === id);
      if (item) { updateCartQty(id, item.qty + 1); renderCart(profile); }
    } else if (action === 'dec') {
      const item = getCart().find(i => i.id === id);
      if (item) { updateCartQty(id, item.qty - 1); renderCart(profile); }
    }
  });
}
