/* ============================================================
   GACP LLC — checkout.js
   Drives the Checkout form: renders summary from the cart,
   submits to /api/checkout, renders result.
   Pricing is recomputed server-side — this file is UX only.
   ============================================================ */

(async function () {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  const gate = window.Cart.canPurchase(profile);
  if (!gate.ok) {
    window.location.replace('/portal/cart.html');
    return;
  }

  const totals = window.Cart.totals(profile?.tier);
  if (!totals.cart.length) {
    window.location.replace('/portal/cart.html');
    return;
  }

  const { formatUSD } = window.Cart;
  const esc = escapeHtml;

  // ---- Render summary ----------------------------------------------------
  const body = document.getElementById('summary-body');
  body.innerHTML =
    totals.cart.map((l) => `
      <div class="summary-line">
        <div>
          <strong>${esc(l.snapshot.name)}</strong>
          <small>${l.qty} ${esc(l.snapshot.unit)} &times; ${formatUSD(l.snapshot.price)}</small>
        </div>
        <div>${formatUSD(l.snapshot.price * l.qty)}</div>
      </div>`).join('') +
    `<div class="summary-row"><span>Subtotal</span><span>${formatUSD(totals.subtotal)}</span></div>` +
    (totals.discount > 0
      ? `<div class="summary-row"><span>Tier discount (${esc(profile.tier)})</span><span>&minus;${formatUSD(totals.discount)}</span></div>`
      : '') +
    `<div class="summary-row"><span>Shipping</span><span class="text-dim">Quoted separately</span></div>
     <div class="summary-row summary-row--total"><span>Total</span><span>${formatUSD(totals.total)}</span></div>`;

  // ---- Pre-fill shipping fields from profile if we have them --------------
  const form = document.getElementById('checkout-form');
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  const setIfEmpty = (name, value) => {
    const el = form.elements.namedItem(name);
    if (el && !el.value && value) el.value = value;
  };
  setIfEmpty('ship_name',    fullName);
  setIfEmpty('ship_company', profile.company);
  setIfEmpty('ship_addr1',   profile.addr1);
  setIfEmpty('ship_addr2',   profile.addr2);
  setIfEmpty('ship_city',    profile.city);
  setIfEmpty('ship_state',   profile.state);
  setIfEmpty('ship_zip',     profile.zip);
  setIfEmpty('ship_phone',   profile.phone);

  // ---- Billing toggle ----------------------------------------------------
  const billingSame = document.getElementById('billing_same');
  const billingFields = document.getElementById('billing-fields');
  billingSame.addEventListener('change', () => { billingFields.hidden = billingSame.checked; });

  // ---- Submit ------------------------------------------------------------
  const resultEl = document.getElementById('checkout-result');
  const rootEl = document.getElementById('checkout-root');
  const btn = document.getElementById('place-order-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Processing…';

    const data = Object.fromEntries(new FormData(form));
    const shipping_addr = {
      name: data.ship_name, company: data.ship_company,
      addr1: data.ship_addr1, addr2: data.ship_addr2,
      city: data.ship_city, state: data.ship_state, zip: data.ship_zip,
      phone: data.ship_phone,
    };
    const billing_addr = billingSame.checked
      ? shipping_addr
      : { ...shipping_addr, zip: data.bill_zip || data.ship_zip };

    const payload = {
      items: totals.cart.map((l) => ({ id: l.id, qty: l.qty })),
      shipping_addr,
      billing_addr,
      contact_phone: data.ship_phone,
      notes: data.notes,
      card: {
        number: data.card_number,
        expiry: data.card_expiry,
        cvv:    data.card_cvv,
        name:   data.card_name,
      },
      client_order_id: crypto.randomUUID(),
    };

    const { data: { session } } = await _sb.auth.getSession();
    let res, respJson;
    try {
      res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      respJson = await res.json().catch(() => ({ ok: false, error: 'bad_response' }));
    } catch (err) {
      showResult({ ok: false, gateway_message: 'Network error. Check connection and retry.' });
      return;
    }
    showResult(respJson);
  });

  function showResult(r) {
    btn.disabled = false;
    btn.textContent = 'Place order';
    rootEl.hidden = true;
    resultEl.hidden = false;

    if (r.ok) {
      window.Cart.clear();
      resultEl.classList.remove('checkout-result--failed');
      resultEl.innerHTML = `
        <h2>Order placed</h2>
        <p>Thank you — a confirmation has been logged against your account.</p>
        <dl>
          <dt>Order ID</dt><dd>${esc(r.order_id || '—')}</dd>
          <dt>Transaction ID</dt><dd>${esc(r.payment_id || '—')}</dd>
          <dt>Auth code</dt><dd>${esc(r.auth_code || '—')}</dd>
          <dt>Amount</dt><dd>${formatUSD(r.total_cents || 0)}</dd>
          <dt>Card</dt><dd>${esc(r.card_brand || 'Card')} ending ${esc(r.last4 || '----')}</dd>
        </dl>
        <div style="display:flex;gap:var(--sp-md);justify-content:center;margin-top:var(--sp-lg)">
          <a href="/portal/dashboard.html" class="btn btn--primary">Back to dashboard</a>
          <a href="/portal/catalogue.html" class="btn btn--secondary">Keep browsing</a>
        </div>`;
    } else {
      resultEl.classList.add('checkout-result--failed');
      resultEl.innerHTML = `
        <h2>Payment not completed</h2>
        <p>${esc(r.gateway_message || r.error || 'The transaction could not be processed.')}</p>
        <div style="display:flex;gap:var(--sp-md);justify-content:center;margin-top:var(--sp-lg)">
          <a href="/portal/cart.html" class="btn btn--primary">Back to cart</a>
          <button type="button" class="btn btn--secondary" onclick="location.reload()">Try again</button>
        </div>`;
    }
  }
})();
