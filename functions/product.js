// functions/product.js
// Intercepts /product.html?slug=XXX and injects SEO meta tags server-side

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (!url.pathname.endsWith('/product.html') && url.pathname !== '/product.html') {
    return context.next();
  }

  const slug = url.searchParams.get('slug');
  if (!slug) {
    return context.next();
  }

  const supabaseUrl = context.env.SUPABASE_URL;
  const supabaseKey = context.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return context.next();
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/public_catalogue?slug=eq.${encodeURIComponent(slug)}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    const products = await res.json();

    if (!products || products.length === 0) {
      return context.next();
    }

    const product = products[0];

    const response = await context.next();
    let html = await response.text();

    const title = `${product.trade_name} | GACP Wholesale Botanical Ingredients`;
    const desc = product.description
      ? product.description.substring(0, 160)
      : `Wholesale ${product.trade_name} — ${product.form} form, ${product.purity} purity. US-based B2B supplier.`;
    const canonical = `https://gacp.llc/product.html?slug=${slug}`;

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    const metaTags = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="product">
    <meta property="og:url" content="${canonical}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(desc)}">`;

    if (html.includes('<!-- SEO_META_PLACEHOLDER -->')) {
      html = html.replace('<!-- SEO_META_PLACEHOLDER -->', metaTags);
    } else {
      html = html.replace('</head>', metaTags + '\n</head>');
    }

    return new Response(html, {
      status: response.status,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err) {
    console.error('Meta injection error:', err);
    return context.next();
  }
}
