// js/validation.js — shared validation helpers for GACP portal forms.
// Exposes window.Validation with pure-function validators (return {ok, msg, value})
// plus DOM helpers for inline error display and card/expiry auto-formatting.

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const US_STATES = new Set([
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
    'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
    'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
    'VT','VA','WA','WV','WI','WY',
  ]);

  const CARD_BRANDS = [
    { name: 'Visa',       test: /^4/,                    lengths: [16, 19], cvvLen: 3 },
    { name: 'Mastercard', test: /^(5[1-5]|2[2-7])/,      lengths: [16],     cvvLen: 3 },
    { name: 'Amex',       test: /^3[47]/,                lengths: [15],     cvvLen: 4 },
    { name: 'Discover',   test: /^6(?:011|5|4[4-9])/,    lengths: [16, 19], cvvLen: 3 },
  ];

  // ---------------------------------------------------------------------------
  // Core validators — pure functions returning {ok, msg, value}
  // ---------------------------------------------------------------------------
  function required(value, label) {
    const v = (value == null ? '' : String(value)).trim();
    if (!v) return { ok: false, msg: `${label} is required.` };
    return { ok: true, value: v };
  }

  function minLen(value, n, label) {
    const v = String(value || '').trim();
    if (v.length < n) return { ok: false, msg: `${label} must be at least ${n} characters.` };
    return { ok: true, value: v };
  }

  function validateName(value, label = 'Name') {
    const r = required(value, label);
    if (!r.ok) return r;
    return minLen(r.value, 2, label);
  }

  function validateAddress1(value) {
    const r = required(value, 'Address line 1');
    if (!r.ok) return r;
    return minLen(r.value, 3, 'Address line 1');
  }

  function validateCity(value) {
    const r = required(value, 'City');
    if (!r.ok) return r;
    return minLen(r.value, 2, 'City');
  }

  function validateState(value) {
    const v = String(value || '').trim().toUpperCase();
    if (!v) return { ok: false, msg: 'State is required.' };
    if (!US_STATES.has(v)) return { ok: false, msg: 'Select a valid US state.' };
    return { ok: true, value: v };
  }

  function validateZip(value, label = 'ZIP') {
    const v = String(value || '').trim();
    if (!v) return { ok: false, msg: `${label} is required.` };
    if (!/^\d{5}(-\d{4})?$/.test(v)) {
      return { ok: false, msg: `${label} must be 5 digits (or 5+4, e.g. 12345-6789).` };
    }
    return { ok: true, value: v };
  }

  function validatePhoneOptional(value) {
    const v = String(value || '').trim();
    if (!v) return { ok: true, value: '' };
    const digits = v.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return { ok: false, msg: 'Phone number looks invalid.' };
    }
    return { ok: true, value: v };
  }

  function validatePhoneRequired(value) {
    const v = String(value || '').trim();
    if (!v) return { ok: false, msg: 'Phone number is required.' };
    const digits = v.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return { ok: false, msg: 'Phone number looks invalid.' };
    }
    return { ok: true, value: v };
  }

  // Luhn check for card number
  function luhn(digits) {
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function detectBrand(digits) {
    for (const b of CARD_BRANDS) if (b.test.test(digits)) return b;
    return null;
  }

  function validateCardNumber(value) {
    const digits = String(value || '').replace(/\s+/g, '').replace(/\D/g, '');
    if (!digits) return { ok: false, msg: 'Card number is required.' };
    if (digits.length < 13 || digits.length > 19) {
      return { ok: false, msg: 'Card number length looks wrong.' };
    }
    const brand = detectBrand(digits);
    if (brand && !brand.lengths.includes(digits.length)) {
      return { ok: false, msg: `${brand.name} numbers should be ${brand.lengths.join(' or ')} digits.` };
    }
    if (!luhn(digits)) return { ok: false, msg: 'Card number is invalid (failed checksum).' };
    return { ok: true, value: digits, brand: brand ? brand.name : 'Card' };
  }

  // Accepts MM/YY or MMYY, emits MMYY. Rejects past dates.
  function validateExpiry(value) {
    const v = String(value || '').replace(/\s+/g, '');
    const m = /^(\d{2})\/?(\d{2})$/.exec(v);
    if (!m) return { ok: false, msg: 'Expiry must be MM/YY.' };
    const month = parseInt(m[1], 10);
    const yy    = parseInt(m[2], 10);
    if (month < 1 || month > 12) return { ok: false, msg: 'Expiry month must be 01–12.' };

    const now = new Date();
    const curYY = now.getFullYear() % 100;
    const curMM = now.getMonth() + 1;
    // Treat 2-digit year as 20YY (fine until 2099)
    if (yy < curYY || (yy === curYY && month < curMM)) {
      return { ok: false, msg: 'Card has expired.' };
    }
    if (yy > curYY + 20) {
      return { ok: false, msg: 'Expiry year seems too far in the future.' };
    }
    return { ok: true, value: `${String(month).padStart(2, '0')}${String(yy).padStart(2, '0')}` };
  }

  function validateCvv(value, cardBrandName) {
    const v = String(value || '').replace(/\D/g, '');
    if (!v) return { ok: false, msg: 'CVV is required.' };
    const expected = cardBrandName === 'Amex' ? 4 : 3;
    if (v.length !== expected) {
      return { ok: false, msg: `CVV must be ${expected} digits.` };
    }
    return { ok: true, value: v };
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------
  function setFieldError(input, msg) {
    const id = input.id;
    const errEl = document.getElementById('err-' + id);
    if (msg) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      if (errEl) errEl.textContent = msg;
    } else {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      if (errEl) errEl.textContent = '';
    }
  }

  function showSummary(errors) {
    const box = document.getElementById('form-error-summary');
    if (!box) return;
    const ul = box.querySelector('ul');
    if (!errors.length) {
      box.hidden = true;
      ul.innerHTML = '';
      return;
    }
    ul.innerHTML = errors.map((e) =>
      `<li><a href="#${e.id}" data-focus="${e.id}">${escapeHtml(e.msg)}</a></li>`
    ).join('');
    box.hidden = false;
    ul.querySelectorAll('a[data-focus]').forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const t = document.getElementById(a.dataset.focus);
        if (t) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      });
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ---------------------------------------------------------------------------
  // Auto-formatters
  // ---------------------------------------------------------------------------
  function attachCardFormatter(input, brandHintEl) {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 19);
      const brand = detectBrand(digits);
      const groupSize = brand && brand.name === 'Amex' ? [4, 6, 5] : [4, 4, 4, 4, 3];
      const groups = [];
      let i = 0;
      for (const len of groupSize) {
        if (i >= digits.length) break;
        groups.push(digits.slice(i, i + len));
        i += len;
      }
      input.value = groups.join(' ');
      if (brandHintEl) brandHintEl.textContent = brand ? brand.name : '';
    });
  }

  function attachExpiryFormatter(input) {
    input.addEventListener('input', (e) => {
      const wasDelete = e.inputType === 'deleteContentBackward';
      let digits = input.value.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) {
        input.value = digits.slice(0, 2) + '/' + digits.slice(2);
      } else if (digits.length === 2 && !wasDelete) {
        input.value = digits + '/';
      } else {
        input.value = digits;
      }
    });
  }

  function attachDigitsOnly(input) {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.Validation = {
    // primitives
    required, minLen,
    // field validators
    validateName, validateAddress1, validateCity, validateState, validateZip,
    validatePhoneOptional, validatePhoneRequired,
    validateCardNumber, validateExpiry, validateCvv,
    // helpers
    detectBrand, luhn,
    US_STATES,
    // DOM
    setFieldError, showSummary,
    attachCardFormatter, attachExpiryFormatter, attachDigitsOnly,
  };
})();
