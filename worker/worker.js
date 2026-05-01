/**
 * GACP LLC — Contact Form Worker
 *
 * Route:  gacp.llc/api/contact*
 * Name:   gacp-contact-form
 *
 * Handles two POST shapes:
 *   1. General contact:  { name, email, message, subject? }
 *      → MailChannels send to info@gacp.llc. Unauthenticated.
 *   2. Quote request:    { type: 'quote_request', line_items, notes? }
 *      → Authenticated via Supabase JWT. Recomputes pricing server-side
 *        from products + profile.tier, inserts into quote_requests,
 *        emails admin + buyer. See spec X.5.
 *
 * Secrets (set via `wrangler secret put <NAME>` or the dashboard — do NOT commit):
 *   SUPABASE_URL                — https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   — service-role key (bypasses RLS)
 *
 * Note: gacp-checkout calls the same secret SUPABASE_SERVICE_KEY.
 *       This worker uses SUPABASE_SERVICE_ROLE_KEY per the quote-builder
 *       spec; both point at the same value.
 */

const TIER_DISCOUNT = { bronze: 0, silver: 0.08, gold: 0.15, platinum: 0.22 };

const ADMIN_RECIPIENT = { email: 'info@gacp.llc', name: 'GACP LLC' };
const FROM_ADDRESS = { email: 'noreply@gacp.llc', name: 'GACP Website' };

const CORS = {
  'Access-Control-Allow-Origin': 'https://gacp.llc',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'bad_json' }, 400); }

    if (body && body.type === 'quote_request') {
      return handleQuoteRequest(request, body, env);
    }
    return handleContact(body, env);
  },
};

// ---------------------------------------------------------------
// 1. General contact (unchanged behaviour)
// ---------------------------------------------------------------

async function handleContact(body, env) {
  const { name, email, message, subject } = body || {};
  if (!name || !email || !message) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const sent = await sendMail({
    to: [ADMIN_RECIPIENT],
    from: FROM_ADDRESS,
    reply_to: { email, name },
    subject: subject || `Contact Form: ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject || 'General Enquiry'}`,
      '',
      'Message:',
      message,
      '',
      '---',
      `IP Country: ${body.ip_country || 'N/A'}`,
      `IP City: ${body.ip_city || 'N/A'}`,
    ].join('\n'),
  });

  if (!sent.ok) {
    console.error('contact: MailChannels error:', sent.error);
    return json({ error: 'Email delivery failed' }, 500);
  }
  return json({ success: true }, 200);
}

// ---------------------------------------------------------------
// 2. Quote request
// ---------------------------------------------------------------

async function handleQuoteRequest(request, body, env) {
  // --- 2a. Authenticate -------------------------------------------------
  const accessToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'not_authenticated' }, 401);

  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!userRes.ok) return json({ error: 'invalid_session' }, 401);
  const user = await userRes.json();
  if (!user || !user.id) return json({ error: 'invalid_session' }, 401);

  // --- 2b. Pull profile (server-side, never trust client) ---------------
  const profRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}` +
      '&select=id,email,role,tier,company,first_name,last_name,country',
    { headers: supabaseServiceHeaders(env) },
  );
  if (!profRes.ok) {
    console.error('quote: profile fetch failed', await profRes.text());
    return json({ error: 'profile_fetch_failed' }, 500);
  }
  const [profile] = await profRes.json();
  if (!profile) return json({ error: 'no_profile' }, 403);
  if (!['trade-restricted', 'trade-full', 'admin'].includes(profile.role)) {
    return json({ error: 'not_authorised_to_quote' }, 403);
  }

  // --- 2c. Validate line_items shape ------------------------------------
  if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
    return json({ error: 'empty_line_items' }, 400);
  }
  for (const li of body.line_items) {
    if (!li || typeof li !== 'object') return json({ error: 'invalid_line_item' }, 400);
    if (!li.product_id) return json({ error: 'invalid_line_item:missing_product_id' }, 400);
    const qty = Number(li.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      return json({ error: `invalid_line_item:bad_qty:${li.product_id}` }, 400);
    }
  }

  // --- 2d. Re-fetch products and recompute totals server-side -----------
  // Don't trust client-supplied unit_price_cents — buyer could tamper.
  const ids = body.line_items
    .map((li) => `"${String(li.product_id).replace(/"/g, '')}"`)
    .join(',');
  const prodRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/products?id=in.(${ids})` +
      '&select=id,trade_spec,price,trade_name,name,unit,moq,active,site_id',
    { headers: supabaseServiceHeaders(env) },
  );
  if (!prodRes.ok) {
    console.error('quote: product fetch failed', await prodRes.text());
    return json({ error: 'product_fetch_failed' }, 500);
  }
  const prods = await prodRes.json();
  const prodMap = Object.fromEntries((prods || []).map((p) => [p.id, p]));

  const discountPct = TIER_DISCOUNT[profile.tier] || 0;
  let subtotalCents = 0;
  const computedItems = [];
  for (const li of body.line_items) {
    const p = prodMap[li.product_id];
    if (!p || p.site_id !== 'gacp' || !p.active) {
      return json({ error: `invalid_product:${li.product_id}` }, 400);
    }
    const qty = Math.floor(Number(li.qty));
    if (qty < (p.moq || 1)) {
      return json({ error: `below_moq:${p.id}:min=${p.moq || 1}` }, 400);
    }
    if (!p.price || p.price <= 0) {
      return json({ error: `price_on_request:${p.id}` }, 400);
    }
    const unitPrice = p.price; // tier discount applied at order level, not line level
    const lineTotal = unitPrice * qty;
    subtotalCents += lineTotal;
    computedItems.push({
      product_id: p.id,
      sku: p.trade_spec || p.id,
      name: p.trade_name || p.name,
      qty,
      unit: p.unit || 'kg',
      unit_price_cents: unitPrice,
      line_total_cents: lineTotal,
    });
  }
  const tierDiscountCents = Math.round(subtotalCents * discountPct);
  const totalCents = subtotalCents - tierDiscountCents;

  // --- 2e. Notes (optional, trim, cap) ----------------------------------
  const notes = typeof body.notes === 'string'
    ? body.notes.trim().slice(0, 2000)
    : null;

  // --- 2f. Insert quote_requests row ------------------------------------
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || null;
  const insertRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/quote_requests`,
    {
      method: 'POST',
      headers: {
        ...supabaseServiceHeaders(env),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: profile.id,
        user_email: profile.email,
        user_company: profile.company,
        user_tier: profile.tier,
        line_items: computedItems,
        subtotal_cents: subtotalCents,
        tier_discount_cents: tierDiscountCents,
        total_cents: totalCents,
        notes,
        status: 'new',
      }),
    },
  );
  if (!insertRes.ok) {
    const errText = await insertRes.text();
    console.error('quote: insert failed', errText);
    return json({ error: 'db_insert_failed' }, 500);
  }
  const [row] = await insertRes.json();
  const quoteId = row && row.id;

  // --- 2g. Emails (best-effort, row is already saved) -------------------
  const ctx = {
    quoteId,
    profile,
    fullName,
    items: computedItems,
    subtotalCents,
    tierDiscountCents,
    totalCents,
    discountPct,
    notes,
  };

  const adminEmail = await sendMail(buildAdminEmail(ctx));
  const buyerEmail = await sendMail(buildBuyerEmail(ctx));

  if (!adminEmail.ok) console.error('quote: admin email failed', adminEmail.error);
  if (!buyerEmail.ok) console.error('quote: buyer email failed', buyerEmail.error);

  const partial = !adminEmail.ok || !buyerEmail.ok;
  return json({
    ok: true,
    id: quoteId,
    ...(partial && {
      warning: 'received_but_email_failed',
      message: "Your quote request was received, but our email confirmation didn't go through. Please follow up at info@gacp.llc with your request ID if you don't hear back within 1 business day.",
    }),
  }, 200);
}

// ---------------------------------------------------------------
// 3. Email builders
// ---------------------------------------------------------------

function buildAdminEmail(ctx) {
  const { quoteId, profile, fullName, items, subtotalCents, tierDiscountCents, totalCents, discountPct, notes } = ctx;
  const company = profile.company || '(no company)';
  const totalDollars = formatUSD(totalCents);

  const rows = items.map((i) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${esc(i.sku)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(i.name)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${i.qty} ${esc(i.unit)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${formatUSD(i.unit_price_cents)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${formatUSD(i.line_total_cents)}</td>
    </tr>`).join('');

  const html = `
    <p><strong>${items.length} item${items.length === 1 ? '' : 's'} — ${totalDollars}</strong></p>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 12px;text-align:left">SKU</th>
          <th style="padding:8px 12px;text-align:left">Product</th>
          <th style="padding:8px 12px;text-align:right">Qty</th>
          <th style="padding:8px 12px;text-align:right">Unit</th>
          <th style="padding:8px 12px;text-align:right">Line total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="4" style="padding:6px 12px;text-align:right">Subtotal</td><td style="padding:6px 12px;text-align:right">${formatUSD(subtotalCents)}</td></tr>
        ${tierDiscountCents > 0 ? `<tr><td colspan="4" style="padding:6px 12px;text-align:right">Tier discount (${esc(profile.tier)} − ${(discountPct * 100).toFixed(0)}%)</td><td style="padding:6px 12px;text-align:right">−${formatUSD(tierDiscountCents)}</td></tr>` : ''}
        <tr><td colspan="4" style="padding:8px 12px;text-align:right;font-weight:bold">Total</td><td style="padding:8px 12px;text-align:right;font-weight:bold">${totalDollars}</td></tr>
      </tfoot>
    </table>

    <h3 style="font-family:Arial,sans-serif;margin-top:24px">Buyer</h3>
    <table style="font-family:Arial,sans-serif;font-size:14px">
      <tr><td style="padding:2px 12px 2px 0;color:#666">Company</td><td>${esc(company)}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#666">Contact</td><td>${esc(fullName || '(not set)')}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#666">Email</td><td><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#666">Country</td><td>${esc(profile.country || '(not set)')}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#666">Tier</td><td>${esc(profile.tier || '(none)')}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#666">Role</td><td>${esc(profile.role)}</td></tr>
    </table>

    ${notes ? `<h3 style="font-family:Arial,sans-serif;margin-top:24px">Notes from buyer</h3><pre style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap;background:#f9f9f9;padding:12px;border-left:3px solid #ccc">${esc(notes)}</pre>` : ''}

    <p style="margin-top:24px"><a href="https://gacp.llc/admin.html#quotes/${esc(quoteId)}">Open in admin →</a></p>
  `;

  const text = [
    `${items.length} item${items.length === 1 ? '' : 's'} — ${totalDollars}`,
    '',
    ...items.map((i) => `  ${i.sku}  ${i.name}  ${i.qty} ${i.unit}  @ ${formatUSD(i.unit_price_cents)}  =  ${formatUSD(i.line_total_cents)}`),
    '',
    `Subtotal:        ${formatUSD(subtotalCents)}`,
    tierDiscountCents > 0 ? `Tier discount:   -${formatUSD(tierDiscountCents)} (${profile.tier} ${(discountPct * 100).toFixed(0)}%)` : '',
    `Total:           ${totalDollars}`,
    '',
    'Buyer:',
    `  Company:  ${company}`,
    `  Contact:  ${fullName || '(not set)'}`,
    `  Email:    ${profile.email}`,
    `  Country:  ${profile.country || '(not set)'}`,
    `  Tier:     ${profile.tier || '(none)'}`,
    `  Role:     ${profile.role}`,
    notes ? '' : null,
    notes ? 'Notes from buyer:' : null,
    notes ? notes : null,
    '',
    `Open in admin: https://gacp.llc/admin.html#quotes/${quoteId}`,
  ].filter((l) => l !== null).join('\n');

  return {
    to: [ADMIN_RECIPIENT],
    from: FROM_ADDRESS,
    reply_to: { email: profile.email, name: fullName || profile.email },
    subject: `[GACP Quote] ${company} — ${items.length} item${items.length === 1 ? '' : 's'}, ${totalDollars}`,
    text,
    html,
  };
}

function buildBuyerEmail(ctx) {
  const { profile, fullName, items, totalCents } = ctx;
  const totalDollars = formatUSD(totalCents);

  const rows = items.map((i) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(i.name)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${i.qty} ${esc(i.unit)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${formatUSD(i.line_total_cents)}</td>
    </tr>`).join('');

  const html = `
    <p>Hi${fullName ? ` ${esc(fullName.split(' ')[0])}` : ''},</p>
    <p>Thank you for your quote request. We've received the following and will respond within <strong>1 US business day</strong> with a pro forma invoice and bank payment details.</p>

    <table style="border-collapse:collapse;width:100%;max-width:560px;font-family:Arial,sans-serif;font-size:14px;margin:16px 0">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 12px;text-align:left">Product</th>
          <th style="padding:8px 12px;text-align:right">Qty</th>
          <th style="padding:8px 12px;text-align:right">Indicative total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="2" style="padding:8px 12px;text-align:right;font-weight:bold">Indicative total</td><td style="padding:8px 12px;text-align:right;font-weight:bold">${totalDollars}</td></tr>
      </tfoot>
    </table>

    <p style="color:#666;font-size:13px">Final pricing — including any volume adjustments, freight, and lot-specific factors — is confirmed on the pro forma invoice we'll send by reply.</p>

    <p>If anything in your request needs to change, just reply to this email.</p>

    <p style="margin-top:24px">Best,<br>
    GACP LLC<br>
    <a href="mailto:info@gacp.llc">info@gacp.llc</a> · <a href="https://gacp.llc">gacp.llc</a></p>
  `;

  const text = [
    `Hi${fullName ? ` ${fullName.split(' ')[0]}` : ''},`,
    '',
    "Thank you for your quote request. We've received the following and will respond",
    'within 1 US business day with a pro forma invoice and bank payment details.',
    '',
    ...items.map((i) => `  ${i.name}  —  ${i.qty} ${i.unit}  —  ${formatUSD(i.line_total_cents)}`),
    '',
    `Indicative total: ${totalDollars}`,
    '',
    'Final pricing — including any volume adjustments, freight, and lot-specific',
    "factors — is confirmed on the pro forma invoice we'll send by reply.",
    '',
    'If anything in your request needs to change, just reply to this email.',
    '',
    'Best,',
    'GACP LLC',
    'info@gacp.llc · https://gacp.llc',
  ].join('\n');

  return {
    to: [{ email: profile.email, name: fullName || profile.email }],
    from: FROM_ADDRESS,
    reply_to: ADMIN_RECIPIENT,
    subject: 'Quote request received — GACP LLC',
    text,
    html,
  };
}

// ---------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------

function supabaseServiceHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function sendMail({ to, from, reply_to, subject, text, html }) {
  const content = [{ type: 'text/plain', value: text }];
  if (html) content.push({ type: 'text/html', value: html });
  try {
    const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to }],
        from,
        reply_to,
        subject,
        content,
      }),
    });
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function formatUSD(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
