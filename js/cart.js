/* ============================================================
   GACP LLC — cart.js
   Cart state (v2), cart page renderer, and a purchase-gate check
   used by both the product detail overlay and the cart page.

   Storage: localStorage[gacp_cart_v2] holds a snapshot-per-line so
   the checkout page can render totals without the products table
   being loaded. Pricing is also recomputed server-side in the
   gacp-checkout Worker — this module is UX only.
   ============================================================ */

(function () {
  const KEY = 'gacp_cart_v2';
  const LEGACY_KEY = 'gacp_cart';

  // Tier discount cache, populated by fetchTierDiscount() on cart-page
  // load. _discountDecimal drives the math; _userTier and _userPct drive
  // the display label. Defaults are the fail-safe state — if the fetch
  // fails for any reason, no tier line is shown and 0% is applied.
  let _userTier = null;
  let _userPct = 0;
  let _discountDecimal = 0;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(v) {
    localStorage.setItem(KEY, JSON.stringify(v));
    broadcast();
  }

  function broadcast() {
    document.dispatchEvent(new CustomEvent('cart:change', { detail: load() }));
    if (typeof updateCartBadge === 'function') updateCartBadge();
  }

  // One-shot migration from the legacy {id, qty} schema to {id, qty, snapshot}.
  // We don't have the product prices at this point, so if the old key is
  // populated we discard it — users will need to re-add their items.
  (function migrate() {
    try {
      if (localStorage.getItem(LEGACY_KEY)) localStorage.removeItem(LEGACY_KEY);
    } catch (_) {}
  })();

  const formatUSD = (cents) => '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const Cart = {
    all:   () => load(),
    count: () => load().reduce((n, l) => n + l.qty, 0),

    /**
     * Can the current profile place orders? Returns { ok, reason, msg }.
     * Called by the product detail overlay and the cart page.
     */
    canPurchase(profile) {
      if (!profile) return { ok: false, reason: 'anon',     msg: 'Sign in to order' };
      if (profile.role === 'pending')  return { ok: false, reason: 'pending',  msg: 'Account under review' };
      if (profile.role === 'rejected') return { ok: false, reason: 'rejected', msg: 'Account not approved' };
      if (profile.role === 'consumer') return { ok: false, reason: 'consumer', msg: 'Trade account required' };
      if (['trade-restricted', 'trade-full', 'admin'].includes(profile.role)) return { ok: true };
      return { ok: false, reason: 'unknown', msg: 'Sign in to order' };
    },

    add(product, qty) {
      const cart = load();
      const q = Math.max(1, Math.floor(Number(qty) || 1));
      const existing = cart.find((l) => l.id === product.id);
      if (existing) {
        existing.qty += q;
        // Refresh snapshot in case price/name/unit changed since last add.
        existing.snapshot = snapshotFor(product);
      } else {
        cart.push({ id: product.id, qty: q, snapshot: snapshotFor(product) });
      }
      save(cart);
      this.toast(`Added ${q} ${product.unit || 'kg'} — ${product.trade_name || product.name}`);
    },

    updateQty(id, qty) {
      const cart = load();
      const line = cart.find((l) => l.id === id);
      if (!line) return;
      const q = Math.max(1, Math.floor(Number(qty) || 1));
      line.qty = q;
      save(cart);
    },

    remove(id) { save(load().filter((l) => l.id !== id)); },
    clear()    { save([]); },

    totals() {
      const cart = load();
      const subtotal = cart.reduce((s, l) => s + l.snapshot.price * l.qty, 0);
      const discount = Math.round(subtotal * _discountDecimal);
      const shipping = 0;
      const tax      = 0;
      const total    = subtotal - discount + shipping + tax;
      return {
        subtotal, discount, shipping, tax, total, cart,
        tier:    _userTier,
        pct:     _userPct,
        decimal: _discountDecimal,
      };
    },

    /**
     * Fetch the calling user's tier+pct from /api/my-tier-discount
     * (Pages Function). Idempotent. On failure: defaults stay (no tier
     * shown, 0% applied — never overcharge).
     */
    async fetchTierDiscount() {
      try {
        const sess = await _sb.auth.getSession();
        const token = sess && sess.data && sess.data.session && sess.data.session.access_token;
        if (!token) return;
        const res = await fetch('/api/my-tier-discount', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        const tier = typeof body.tier === 'string' ? body.tier : null;
        const pct  = Number(body.pct);
        if (!tier || !Number.isFinite(pct)) return;
        _userTier = tier;
        _userPct = pct;
        _discountDecimal = pct / 100;
      } catch (_) { /* keep defaults */ }
    },

    formatUSD,

    /** Lightweight toast. Uses the shared .toast style if available. */
    toast(msg) {
      if (typeof showToast === 'function') {
        showToast(msg, 'success');
        return;
      }
      let el = document.getElementById('cart-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'cart-toast';
        el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--green);' +
          'color:var(--ink);padding:12px 18px;border-radius:6px;font-family:var(--font-body);' +
          'font-size:14px;z-index:9999;opacity:0;transition:opacity .2s;box-shadow:0 6px 20px rgba(0,0,0,.4)';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      requestAnimationFrame(() => (el.style.opacity = '1'));
      clearTimeout(el._t);
      el._t = setTimeout(() => (el.style.opacity = '0'), 2600);
    },

    // ---------- Cart page renderer ----------
    renderCartPage(container, profile) {
      const t = this.totals();
      if (!t.cart.length) {
        container.innerHTML = `
          <div class="cart-empty">
            <h2>Your quote builder is empty</h2>
            <p class="text-dim">Browse the catalogue to add products.</p>
            <a href="/portal/catalogue.html" class="btn btn--primary">Browse catalogue</a>
          </div>`;
        return;
      }

      const esc = (typeof escapeHtml === 'function')
        ? escapeHtml
        : (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

      const lines = t.cart.map((l) => `
        <tr data-line="${esc(l.id)}">
          <td class="cart-line-product">
            ${l.snapshot.img ? `<img src="${esc(l.snapshot.img)}" alt="">` : ''}
            <div><strong>${esc(l.snapshot.name)}</strong><br>
              <span class="text-dim">${esc(l.id)} &middot; ${formatUSD(l.snapshot.price)} / ${esc(l.snapshot.unit)}</span>
            </div>
          </td>
          <td class="cart-line-qty">
            <button type="button" class="qty-dec" aria-label="Decrease quantity">&minus;</button>
            <input type="number" min="1" step="1" value="${l.qty}" class="qty-input" aria-label="Quantity">
            <button type="button" class="qty-inc" aria-label="Increase quantity">+</button>
            <span class="text-dim">${esc(l.snapshot.unit)}</span>
          </td>
          <td class="cart-line-total">${formatUSD(l.snapshot.price * l.qty)}</td>
          <td><button type="button" class="cart-line-remove" aria-label="Remove line">&times;</button></td>
        </tr>`).join('');

      const gate = this.canPurchase(profile);
      // International gate: country set AND not US → show inquiry notice instead of checkout CTA.
      // Null/empty country treated as US-equivalent for legacy accounts.
      const country = String(profile?.country || '').trim().toUpperCase();
      const isIntl = country && country !== 'US';

      const gateBlock = isIntl
        ? `<div class="cart-international-notice">
             <h3>International orders</h3>
             <p>GACP currently ships to US destinations only. For international inquiries, please contact our sales team — we'll work with you on freight quoting, customs documentation, and product availability for your jurisdiction.</p>
             <a href="mailto:info@gacp.llc?subject=International%20Order%20Inquiry%20-%20GACP" class="btn btn--primary">Contact sales</a>
             <button type="button" class="btn btn--secondary" id="cart-clear">Clear cart</button>
           </div>`
        : (gate.ok
          ? `<button type="button" id="cart-submit-quote" class="btn btn--primary btn--full">Submit Quote Request</button>
             <div id="cart-submit-error" class="gate-notice gate-notice--error" style="display:none;margin-top:var(--sp-sm)" role="alert"></div>`
          : `<div class="gate-notice">${esc(gate.msg)}</div>
             ${gate.reason === 'consumer' || gate.reason === 'pending'
               ? `<a href="/portal/formulation.html" class="btn btn--secondary btn--full">Request a formulation consultation</a>`
               : ''}`);

      // Notes block — separate panel, only shown when the buyer is on
      // the domestic submit path. International / blocked gates skip it.
      const notesBlock = (!isIntl && gate.ok)
        ? `<div class="cart-notes">
             <h3 class="cart-notes__heading">Notes (optional)</h3>
             <textarea id="cart-quote-notes" class="form-textarea cart-notes__textarea" maxlength="2000" rows="4"></textarea>
             <p class="cart-notes__caption">Delivery date, batch needs, shipping account, anything else worth mentioning.</p>
           </div>`
        : '';

      // Tier-discount label: shown only when there's an actual discount
      // to display (Silver and above). Bronze (0%) is suppressed —
      // surfaces the line as a visual reward for upgraded tiers, avoids
      // zero-value noise. Trailing zeros are stripped by Number's
      // default toString — 2 → "2", 3.5 → "3.5".
      const discountLine = (t.tier && t.pct > 0)
        ? `<div class="cart-summary__row"><span>Tier discount (${esc(t.tier)} &minus; ${String(t.pct)}%)</span><span>&minus;${formatUSD(t.discount)}</span></div>`
        : '';

      container.innerHTML = `
        <table class="cart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Line total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${lines}</tbody>
        </table>
        ${notesBlock}
        <div class="cart-summary">
          <div class="cart-summary__row"><span>Subtotal</span><span>${formatUSD(t.subtotal)}</span></div>
          ${discountLine}
          <div class="cart-summary__row text-dim"><span>Shipping</span><span>Quoted separately</span></div>
          <div class="cart-summary__row cart-summary__row--total"><span>Total</span><span>${formatUSD(t.total)}</span></div>
          ${gateBlock}
          ${isIntl ? '' : `<button type="button" class="btn btn--text" id="cart-clear">Clear cart</button>`}
        </div>`;

      container.querySelectorAll('tr[data-line]').forEach((row) => {
        const id = row.dataset.line;
        const input = row.querySelector('.qty-input');
        row.querySelector('.qty-dec').addEventListener('click', () => {
          input.value = Math.max(1, Number(input.value) - 1);
          Cart.updateQty(id, input.value); Cart.renderCartPage(container, profile);
        });
        row.querySelector('.qty-inc').addEventListener('click', () => {
          input.value = Number(input.value) + 1;
          Cart.updateQty(id, input.value); Cart.renderCartPage(container, profile);
        });
        input.addEventListener('change', () => {
          Cart.updateQty(id, input.value); Cart.renderCartPage(container, profile);
        });
        row.querySelector('.cart-line-remove').addEventListener('click', () => {
          Cart.remove(id); Cart.renderCartPage(container, profile);
        });
      });
      const clearBtn = container.querySelector('#cart-clear');
      if (clearBtn) clearBtn.addEventListener('click', () => {
        if (confirm('Clear cart?')) { Cart.clear(); Cart.renderCartPage(container, profile); }
      });

      const submitBtn = container.querySelector('#cart-submit-quote');
      if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
          const errEl  = container.querySelector('#cart-submit-error');
          const notesEl = container.querySelector('#cart-quote-notes');
          const notes  = (notesEl?.value || '').trim();

          const showErr = (msg) => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Quote Request';
            errEl.textContent = msg;
            errEl.style.display = 'block';
          };

          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting…';
          errEl.style.display = 'none';
          errEl.textContent = '';

          let session = null;
          try {
            const r = await _sb.auth.getSession();
            session = r?.data?.session || null;
          } catch (_) { session = null; }
          if (!session) {
            showErr('Your session has expired. Please sign in again to submit your quote.');
            return;
          }

          const payload = {
            type: 'quote_request',
            line_items: Cart.all().map((l) => ({
              product_id: l.id,
              sku:        l.id,
              name:       l.snapshot.name,
              qty:        l.qty,
              unit:       l.snapshot.unit,
              unit_price_cents: l.snapshot.price,
            })),
            notes,
          };

          let res, body;
          try {
            res = await fetch('/api/contact', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify(payload),
            });
          } catch (_) {
            showErr('Network error. Please check your connection and try again.');
            return;
          }
          try { body = await res.json(); } catch { body = {}; }

          if (res.status === 200) {
            Cart.clear();
            container.innerHTML = `
              <div class="cart-empty">
                <h2>Quote request received</h2>
                <p>We'll respond within one US business day with a pro forma invoice.</p>
                <a href="/portal/catalogue.html" class="btn btn--primary">Back to catalogue</a>
              </div>`;
            return;
          }

          if (res.status === 401) {
            showErr('Your session has expired. Please sign in again to submit your quote.');
          } else if (res.status === 400) {
            showErr(body.error || body.message || 'There was a problem with your request.');
          } else {
            showErr('Something went wrong. Please try again, or email info@gacp.llc.');
          }
        });
      }
    },
  };

  function snapshotFor(product) {
    return {
      name:  product.trade_name || product.name,
      price: product.price,
      unit:  product.unit || 'kg',
      img:   product.img || product.image_url || '',
      moq:   product.moq || 1,
    };
  }

  window.Cart = Cart;
})();

// --- Legacy flat-function shims ---------------------------------
// Existing call sites (portal dashboard, product overlay click handlers)
// still reference these names. They now proxy into window.Cart.

function getCart()       { return window.Cart.all(); }
function getCartCount()  { return window.Cart.count(); }
function removeFromCart(id) { window.Cart.remove(id); }
function updateCartQty(id, qty) { window.Cart.updateQty(id, qty); }

/** Legacy: called as `addToCart(productId, qty=1)` from inline onclick
 *  handlers in the product overlay. Looks up the product in the loaded
 *  PRODUCTS list so we can snapshot name/price/unit. */
function addToCart(productId, qty = 1) {
  const product = (typeof PRODUCTS !== 'undefined')
    ? PRODUCTS.find((p) => p.id === productId)
    : null;
  if (!product) {
    console.warn('addToCart: product not in PRODUCTS', productId);
    return;
  }
  window.Cart.add(product, qty);
  if (typeof closeOverlay === 'function') closeOverlay();
}

function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-badge');
  const count = window.Cart.count();
  badges.forEach((b) => {
    b.textContent = count;
    b.classList.toggle('hidden', count === 0);
  });
}

// Keep the badge in sync whenever the cart changes.
document.addEventListener('cart:change', updateCartBadge);
document.addEventListener('DOMContentLoaded', updateCartBadge);

// --- Cart page init (called from portal/cart.html) -----------
async function initCartPage() {
  const container = document.getElementById('cart-container');
  if (!container) return;

  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  // loadProducts is not strictly required — snapshot holds pricing —
  // but keep it so the nav/sidebar counts etc. reflect catalogue state.
  if (typeof loadProducts === 'function') await loadProducts();

  // Populate the tier-discount cache before the first render so the
  // discount line is correct on initial paint, not after a flicker.
  await window.Cart.fetchTierDiscount();

  window.Cart.renderCartPage(container, profile);
  document.addEventListener('cart:change', () => window.Cart.renderCartPage(container, profile));
}
