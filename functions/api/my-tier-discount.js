/**
 * GACP LLC — My Tier Discount endpoint (Cloudflare Pages Function)
 *
 * GET /api/my-tier-discount
 * Returns the calling user's own tier and discount percentage. Used by
 * the cart-page renderer in js/cart.js to populate the discount line.
 *
 * Auth: Supabase JWT via `Authorization: Bearer <token>`.
 *
 * Response shape: { tier, pct }
 *   - tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null
 *   - pct:  number in 0–100; the frontend divides by 100 for the math.
 *
 * Fail-safe contract: on ANY error path (missing or invalid token,
 * profile not found, tier_discounts lookup miss, network error) the
 * response is { tier: null, pct: 0 } with HTTP 200. The frontend treats
 * a null tier as "no discount line shown" and a 0 pct as "0% applied" —
 * never overcharge by missing a discount, never grant one we can't
 * verify.
 *
 * Secrets (set per-Pages-project, separate from the Worker):
 *   wrangler pages secret put SUPABASE_URL              --project-name=gacp-llc
 *   wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=gacp-llc
 *
 * Note: tier_discounts is read in two places — here, for the cart-page
 * display, and in worker/worker.js handleQuoteRequest for the recompute
 * on quote submission. Intentional split: simple authenticated reads
 * live in Pages Functions; multi-step business logic (validate, recompute,
 * insert, email) lives in the Worker. Both paths use service_role because
 * tier_discounts has no SELECT policy for `authenticated`.
 */

const FAILSAFE = { tier: null, pct: 0 };

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://gacp.llc',
  'Cache-Control': 'no-store',
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: HEADERS });
  }
  const body = await lookup(request, env);
  return new Response(JSON.stringify(body), { status: 200, headers: HEADERS });
}

async function lookup(request, env) {
  try {
    const accessToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!accessToken) return FAILSAFE;

    // Validate the JWT.
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!userRes.ok) return FAILSAFE;
    const user = await userRes.json();
    if (!user || !user.id) return FAILSAFE;

    // Read profile.tier (service_role bypasses RLS).
    const profRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=tier`,
      { headers: serviceHeaders(env) },
    );
    if (!profRes.ok) return FAILSAFE;
    const [profile] = await profRes.json();
    const tier = profile && profile.tier ? String(profile.tier) : null;
    if (!tier) return FAILSAFE;

    // Look up the discount percentage for that tier.
    const discRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/tier_discounts?tier=eq.${encodeURIComponent(tier)}&select=discount_pct`,
      { headers: serviceHeaders(env) },
    );
    if (!discRes.ok) return FAILSAFE;
    const [row] = await discRes.json();
    const pct = Number(row && row.discount_pct);
    if (!Number.isFinite(pct)) return FAILSAFE;

    return { tier, pct };
  } catch (_) {
    return FAILSAFE;
  }
}

// Headers for service-role REST calls against PostgREST. Note the
// Bearer here is the SERVICE_ROLE_KEY, not the caller's user JWT —
// service_role bypasses RLS, which is required because tier_discounts
// has no SELECT policy for `authenticated`. Caller-identity gating is
// handled separately, above, by validating the user JWT against
// /auth/v1/user before we reach this code path.
function serviceHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}
