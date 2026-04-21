// js/checkout.js — drives the checkout form, validates via Validation module,
// submits to /api/checkout, renders success/decline result screen.
(async function () {
  'use strict';

  const V = window.Validation;
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  const totals = Cart.totals(profile?.tier);
  if (!totals.cart.length) { location.replace('/portal/cart.html'); return; }

  // ---- Render summary ------------------------------------------------------
  const summaryBody = document.getElementById('summary-body');
  summaryBody.innerHTML =
    totals.cart.map((l) => `
      <div class="summary-line">
        <div>${escapeHtml(l.snapshot.name)}<small>${l.qty} ${escapeHtml(l.snapshot.unit)} × ${Cart.formatUSD(l.snapshot.price)}</small></div>
        <div>${Cart.formatUSD(l.snapshot.price * l.qty)}</div>
      </div>`).join('') +
    `<div class="summary-row"><span>Subtotal</span><span>${Cart.formatUSD(totals.subtotal)}</span></div>` +
    (totals.discount > 0
      ? `<div class="summary-row"><span>Tier discount (${escapeHtml(profile.tier)})</span><span>&minus;${Cart.formatUSD(totals.discount)}</span></div>`
      : '') +
    `<div class="summary-row"><span>Shipping</span><span>Quoted separately</span></div>
     <div class="summary-row total"><span>Total</span><span>${Cart.formatUSD(totals.total)}</span></div>`;

  // ---- Grab form elements --------------------------------------------------
  const form = document.getElementById('checkout-form');
  const fields = {
    ship_name:    form.ship_name,
    ship_addr1:   form.ship_addr1,
    ship_city:    form.ship_city,
    ship_state:   form.ship_state,
    ship_zip:     form.ship_zip,
    ship_phone:   form.ship_phone,
    card_name:    form.card_name,
    card_number:  form.card_number,
    card_expiry:  form.card_expiry,
    card_cvv:     form.card_cvv,
    bill_zip:     form.bill_zip,
  };

  // ---- Pre-fill from profile (only empty fields; no card data) -------------
  function prefillIfEmpty(field, value) {
    if (!field) return;
    if (field.value && field.value.trim()) return; // don't overwrite existing
    if (value == null || value === '') return;     // nothing to set
    field.value = String(value).trim();
  }

  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  prefillIfEmpty(fields.ship_name,  fullName);
  prefillIfEmpty(form.ship_company, profile?.company);
  prefillIfEmpty(fields.ship_addr1, profile?.addr1);
  prefillIfEmpty(form.ship_addr2,   profile?.addr2);
  prefillIfEmpty(fields.ship_city,  profile?.city);
  prefillIfEmpty(fields.ship_zip,   profile?.zip);
  prefillIfEmpty(fields.ship_phone, profile?.phone);
  prefillIfEmpty(fields.card_name,  fullName); // kept as "Trade Account" unless field empty

  // State dropdown: only set if value matches a US_STATES entry AND an <option> exists
  if (fields.ship_state && !fields.ship_state.value && profile?.state) {
    const st = String(profile.state).trim().toUpperCase();
    const hasOption = Array.from(fields.ship_state.options).some((o) => o.value === st);
    if (V.US_STATES.has(st) && hasOption) fields.ship_state.value = st;
  }

  // ---- Attach formatters ---------------------------------------------------
  V.attachCardFormatter(fields.card_number, document.getElementById('card_brand_hint'));
  fields.card_number.dispatchEvent(new Event('input')); // fire once so pre-filled value sets brand hint
  V.attachExpiryFormatter(fields.card_expiry);
  V.attachDigitsOnly(fields.card_cvv);
  V.attachDigitsOnly(fields.ship_zip);  // keep separators out; pattern allows dash via paste
  V.attachDigitsOnly(fields.bill_zip);

  // ---- Billing toggle ------------------------------------------------------
  const billingSame   = document.getElementById('billing_same');
  const billingFields = document.getElementById('billing-fields');
  billingSame.addEventListener('change', () => {
    billingFields.hidden = billingSame.checked;
    if (billingSame.checked) V.setFieldError(fields.bill_zip, '');
  });

  // ---- On-blur validation (per field) --------------------------------------
  function validateField(name) {
    const el = fields[name];
    if (!el) return { ok: true };
    let res;
    switch (name) {
      case 'ship_name':   res = V.validateName(el.value, 'Contact name'); break;
      case 'ship_addr1':  res = V.validateAddress1(el.value); break;
      case 'ship_city':   res = V.validateCity(el.value); break;
      case 'ship_state':  res = V.validateState(el.value); break;
      case 'ship_zip':    res = V.validateZip(el.value, 'ZIP'); break;
      case 'ship_phone':  res = V.validatePhoneRequired(el.value); break;
      case 'card_name':   res = V.validateName(el.value, 'Cardholder name'); break;
      case 'card_number': res = V.validateCardNumber(el.value); break;
      case 'card_expiry': res = V.validateExpiry(el.value); break;
      case 'card_cvv': {
        const cardRes = V.validateCardNumber(fields.card_number.value);
        res = V.validateCvv(el.value, cardRes.ok ? cardRes.brand : null);
        break;
      }
      case 'bill_zip':
        if (billingSame.checked) { res = { ok: true }; break; }
        res = V.validateZip(el.value, 'Billing ZIP'); break;
      default: res = { ok: true };
    }
    V.setFieldError(el, res.ok ? '' : res.msg);
    return res;
  }

  Object.keys(fields).forEach((name) => {
    const el = fields[name];
    if (!el) return;
    el.addEventListener('blur', () => validateField(name));
    el.addEventListener('input', () => {
      // Clear error as user edits, but don't re-validate until blur
      if (el.classList.contains('is-invalid')) V.setFieldError(el, '');
    });
  });

  // ---- Submit --------------------------------------------------------------
  const resultEl = document.getElementById('checkout-result');
  const btn      = document.getElementById('place-order-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate all fields
    const errors = [];
    const names = ['ship_name','ship_addr1','ship_city','ship_state','ship_zip','ship_phone',
                   'card_name','card_number','card_expiry','card_cvv','bill_zip'];
    const results = {};
    for (const name of names) {
      const r = validateField(name);
      results[name] = r;
      if (!r.ok) errors.push({ id: name, msg: r.msg });
    }

    if (errors.length) {
      V.showSummary(errors);
      const first = document.getElementById(errors[0].id);
      if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return;
    }
    V.showSummary([]);

    btn.disabled = true;
    btn.textContent = 'Processing…';

    const data = Object.fromEntries(new FormData(form));
    const shipping_addr = {
      name:    results.ship_name.value,
      company: (data.ship_company || '').trim(),
      addr1:   results.ship_addr1.value,
      addr2:   (data.ship_addr2 || '').trim(),
      city:    results.ship_city.value,
      state:   results.ship_state.value,
      zip:     results.ship_zip.value,
      phone:   results.ship_phone.value,
    };
    const billing_addr = billingSame.checked
      ? shipping_addr
      : { ...shipping_addr, zip: results.bill_zip.value };

    const payload = {
      items: totals.cart.map((l) => ({ id: l.id, qty: l.qty })),
      shipping_addr,
      billing_addr,
      contact_phone: shipping_addr.phone,
      notes: (data.notes || '').trim(),
      card: {
        number: results.card_number.value,   // digits only (from Luhn validator)
        expiry: results.card_expiry.value,   // MMYY
        cvv:    results.card_cvv.value,
        name:   results.card_name.value,
        brand:  results.card_number.brand || 'Card',
      },
      client_order_id: crypto.randomUUID(),
    };

    const { data: { session } } = await _sb.auth.getSession();
    if (!session) {
      showResult({ ok: false, gateway_message: 'Your session has expired. Please sign in again.' });
      return;
    }

    let res;
    try {
      res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      showResult({ ok: false, gateway_message: 'Network error. Check connection and retry.' });
      return;
    }
    let json;
    try { json = await res.json(); }
    catch { json = { ok: false, gateway_message: 'Unexpected server response.' }; }
    showResult(json);
  });

  function showResult(r) {
    btn.disabled = false;
    btn.textContent = 'Place order';
    // Hide only the form — keep order summary visible in the right column.
    form.hidden = true;
    resultEl.hidden = false;
    if (r.ok) {
      Cart.clear();
      resultEl.classList.remove('failed');
      resultEl.innerHTML = `
        <h2>Order placed</h2>
        <p>Thank you — a confirmation has been logged against your account. A receipt will arrive by email shortly.</p>
        <dl>
          <dt>Order ID</dt><dd>${escapeHtml(r.order_id || '—')}</dd>
          <dt>Transaction ID</dt><dd>${escapeHtml(r.payment_id || '—')}</dd>
          <dt>Auth code</dt><dd>${escapeHtml(r.auth_code || '—')}</dd>
          <dt>Amount</dt><dd>${Cart.formatUSD(r.total_cents || 0)}</dd>
          <dt>Card</dt><dd>${escapeHtml(r.card_brand || 'Card')} ending ${escapeHtml(r.last4 || '----')}</dd>
        </dl>
        <a href="/portal/dashboard.html" class="btn btn--primary">Back to dashboard</a>`;
    } else {
      resultEl.classList.add('failed');
      resultEl.innerHTML = `
        <h2>Payment not completed</h2>
        <p>${escapeHtml(r.gateway_message || r.error || 'The transaction could not be processed.')}</p>
        <a href="/portal/cart.html" class="btn btn--primary">Back to cart</a>
        <button type="button" class="btn btn--secondary" id="checkout-try-again">Try again</button>`;
      const tryAgainBtn = resultEl.querySelector('#checkout-try-again');
      if (tryAgainBtn) tryAgainBtn.addEventListener('click', () => {
        resultEl.hidden = true;
        resultEl.classList.remove('failed');
        resultEl.innerHTML = '';
        form.hidden = false;
      });
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
})();
