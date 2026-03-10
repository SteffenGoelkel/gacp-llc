/**
 * GACP LLC — Corporate Search Proxy
 * Proxies OpenCorporates API to avoid CORS issues
 * GET /api/corp-search?q=company&jurisdiction=gb&number=12345
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const q = url.searchParams.get('q');
  if (!q) {
    return new Response(JSON.stringify({ error: 'Missing query' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let apiUrl = 'https://api.opencorporates.com/v0.4/companies/search?q=' + encodeURIComponent(q) + '&per_page=5';

  const jurisdiction = url.searchParams.get('jurisdiction');
  if (jurisdiction) apiUrl += '&jurisdiction_code=' + jurisdiction;

  const number = url.searchParams.get('number');
  if (number) apiUrl += '&company_number=' + encodeURIComponent(number);

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
