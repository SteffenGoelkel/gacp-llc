/**
 * GACP LLC — Geo endpoint (Cloudflare Pages Function)
 * Returns visitor country/city from Cloudflare's built-in request.cf object
 * No third-party API, no rate limits, no tokens
 *
 * GET /api/geo → { country, city, region, ip }
 */

export function onRequest(context) {
  const { request } = context;

  const cf = request.cf || {};
  const ip = request.headers.get('cf-connecting-ip') || '';

  const data = {
    country: cf.country || '',
    city: cf.city || '',
    region: cf.region || '',
    ip: ip,
    org: cf.asOrganization || '',
  };

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://gacp.llc',
    },
  });
}
