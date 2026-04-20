/**
 * GACP LLC — Checkout Worker
 *
 * Route:  gacp.llc/api/checkout*
 * Name:   gacp-checkout
 *
 * Receives the checkout payload from /portal/checkout.html, validates the
 * Supabase session, recomputes totals against the products table, calls
 * the MiCamp V2 Sale endpoint, writes an orders row, and returns the
 * transaction result.
 *
 * Secrets (set via `wrangler secret put <NAME>` or the dashboard):
 *   MICAMP_API_USER       — MiCamp API username (e.g. mcnorthapi1)
 *   MICAMP_API_PASS       — MiCamp API password
 *   MICAMP_MERCHANT_KEY   — MiCamp MerchantKey (sandbox: 123456789012)
 *   MICAMP_GATEWAY_URL    — https://gateway.mipaymentchoice.com
 *   SUPABASE_URL          — https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY  — service-role key (bypasses RLS; keep secret)
 *
 * Cross-check: reuse whatever auth/sale flow already works on the
 * altmed-checkout Worker. If field names or endpoint paths differ there,
 * prefer altmed-checkout's shape — this file is a best-effort match to
 * the playbook.
 */

const CORS = {
  'Access-Control-Allow-Origin': 'https://gacp.llc',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    let body;
    try { body = await request.json(); }
    catch { return json({ ok: false, error: 'bad_json' }, 400); }

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return json({ ok: false, error: 'empty_cart' }, 400);
    }
    if (!body.card || !body.card.number || !body.card.expiry || !body.card.cvv) {
      return json({ ok: false, error: 'missing_card' }, 400);
    }

    // --- 1. Validate the Supabase session the page sent us -----------------
    const authHeader = request.headers.get('Authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return json({ ok: false, error: 'not_authenticated' }, 401);

    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: env.SUPABASE_SERVICE_KEY },
    });
    if (!userRes.ok) return json({ ok: false, error: 'invalid_session' }, 401);
    const user = await userRes.json();

    // --- 2. Pull the profile to confirm role + tier ------------------------
    const profRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role,tier,first_name,last_name,company,email`,
      { headers: supabaseServiceHeaders(env) },
    );
    const profiles = await profRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile) return json({ ok: false, error: 'no_profile' }, 403);
    if (!['trade-restricted', 'trade-full'].includes(profile.role)) {
      return json({ ok: false, error: 'not_authorised_to_purchase' }, 403);
    }

    // --- 3. Recompute totals server-side -----------------------------------
    // Never trust client-submitted prices. Pull prices fresh from products.
    const ids = body.items.map((i) => `"${String(i.id).replace(/"/g, '')}"`).join(',');
    const prodRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/products?id=in.(${ids})&select=id,price,trade_name,name,unit,moq,active,site_id`,
      { headers: supabaseServiceHeaders(env) },
    );
    const prods = await prodRes.json();
    const prodMap = Object.fromEntries((prods || []).map((p) => [p.id, p]));

    let subtotal = 0;
    const items = [];
    for (const line of body.items) {
      const p = prodMap[line.id];
      if (!p || p.site_id !== 'gacp' || !p.active) {
        return json({ ok: false, error: `invalid_product:${line.id}` }, 400);
      }
      const qty = Math.max(1, Math.floor(Number(line.qty) || 0));
      const lineTotal = p.price * qty;
      subtotal += lineTotal;
      items.push({
        id: p.id,
        name: p.trade_name || p.name,
        unit: p.unit,
        moq: p.moq,
        price_cents: p.price,
        qty,
        line_total_cents: lineTotal,
      });
    }

    const tierDiscount = { bronze: 0, silver: 0.08, gold: 0.15, platinum: 0.22 };
    const discountPct = tierDiscount[profile.tier] || 0;
    const discount = Math.round(subtotal * discountPct);
    const shipping = 0;
    const tax = 0;
    const total = subtotal - discount + shipping + tax;
    const totalDollars = (total / 100).toFixed(2);

    // --- 4. Call MiCamp V2 Sale --------------------------------------------
    // Auth: POST username/password, get JWT, then POST Sale with Bearer JWT.
    const authRes = await fetch(`${env.MICAMP_GATEWAY_URL}/api/v2/authentication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: env.MICAMP_API_USER, password: env.MICAMP_API_PASS }),
    });
    if (!authRes.ok) return json({ ok: false, error: 'gateway_auth_failed' }, 502);
    const authJson = await authRes.json();
    const token = authJson.token || authJson.Token || authJson.access_token;
    if (!token) return json({ ok: false, error: 'gateway_auth_no_token' }, 502);

    const cardNumber = String(body.card.number || '').replace(/\s+/g, '');
    const salePayload = {
      MerchantKey: env.MICAMP_MERCHANT_KEY,
      Amount: totalDollars,
      CardNumber: cardNumber,
      CardExpiration: body.card.expiry, // MMYY
      CardCVV: body.card.cvv,
      CardholderName: body.card.name,
      BillingZip: body.billing_addr?.zip || '',
      OrderId: body.client_order_id || crypto.randomUUID(),
    };

    const saleRes = await fetch(`${env.MICAMP_GATEWAY_URL}/api/v2/transactions/sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(salePayload),
    });
    const saleJson = await saleRes.json().catch(() => ({}));
    const approved = saleJson.ResponseCode === '00' || saleJson.Status === 'Approved';

    // --- 5. Write order row ------------------------------------------------
    const orderRow = {
      site_id: 'gacp',
      user_id: user.id,
      items,
      subtotal_cents: subtotal,
      discount_cents: discount,
      shipping_cents: shipping,
      tax_cents: tax,
      total_cents: total,
      tier: profile.tier,
      currency: 'USD',
      status: approved ? 'paid' : 'failed',
      payment_id: saleJson.TransactionId || null,
      auth_code: saleJson.AuthCode || null,
      last4: cardNumber.slice(-4),
      card_brand: detectBrand(cardNumber),
      shipping_addr: body.shipping_addr || null,
      billing_addr: body.billing_addr || null,
      contact_email: profile.email || user.email,
      contact_phone: body.contact_phone || null,
      notes: body.notes || null,
    };

    const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: { ...supabaseServiceHeaders(env), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(orderRow),
    });
    const inserted = await insertRes.json().catch(() => null);
    const orderId = Array.isArray(inserted) ? inserted[0]?.id : null;

    if (!approved) {
      return json({
        ok: false,
        error: 'payment_declined',
        gateway_message: saleJson.ResponseText || saleJson.Message || 'Declined',
        order_id: orderId,
      }, 402);
    }

    return json({
      ok: true,
      order_id: orderId,
      payment_id: saleJson.TransactionId,
      auth_code: saleJson.AuthCode,
      total_cents: total,
      last4: orderRow.last4,
      card_brand: orderRow.card_brand,
    });
  },
};

function supabaseServiceHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function detectBrand(num) {
  if (/^4/.test(num)) return 'Visa';
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  if (/^6(?:011|5)/.test(num)) return 'Discover';
  return 'Card';
}
