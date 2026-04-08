/* ============================================================
   GACP LLC — public-product.js
   Public product detail: fetch single product, render, schema
   ============================================================ */

async function loadPublicProduct(slug) {
  const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await _sb
    .from('public_catalogue')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data;
}

function renderProduct(product) {
  const detail = document.getElementById('product-detail');
  if (!detail) return;

  const cat = product.category || '';
  const catLabel = (CATEGORIES.find(c => c.key === cat) || {}).label || cat;
  const imgSrc = product.image_url || '/images/logo.png';

  detail.innerHTML = `
    <div class="product-detail">
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.trade_name)}" class="product-detail__image">
      <div class="product-detail__info">
        <span class="product-card__category product-card__category--${escapeHtml(cat)}">${escapeHtml(catLabel)}</span>
        <h1 class="product-detail__name">${escapeHtml(product.trade_name)}</h1>
        ${product.description ? `<p class="product-detail__desc">${escapeHtml(product.description)}</p>` : ''}
        <div class="product-detail__specs">
          ${product.purity ? `
            <div class="product-spec">
              <span class="product-spec__label">Purity</span>
              <span class="product-spec__value">${escapeHtml(product.purity)}</span>
            </div>` : ''}
          ${product.form ? `
            <div class="product-spec">
              <span class="product-spec__label">Form</span>
              <span class="product-spec__value">${escapeHtml(product.form)}</span>
            </div>` : ''}
          ${product.moq_unit ? `
            <div class="product-spec">
              <span class="product-spec__label">MOQ Unit</span>
              <span class="product-spec__value">${escapeHtml(product.moq_unit)}</span>
            </div>` : ''}
          ${cat ? `
            <div class="product-spec">
              <span class="product-spec__label">Category</span>
              <span class="product-spec__value">${escapeHtml(catLabel)}</span>
            </div>` : ''}
        </div>
      </div>
    </div>
  `;

  // Update breadcrumb
  const crumb = document.getElementById('breadcrumb-name');
  if (crumb) crumb.textContent = product.trade_name;

  // Update page title
  document.title = product.trade_name + ' | GACP — Wholesale Botanical Ingredients';

  // Show gated teasers and CTA
  const teasers = document.getElementById('gated-teasers');
  const cta = document.getElementById('product-cta');
  if (teasers) teasers.style.display = '';
  if (cta) cta.style.display = '';

  // Inject JSON-LD
  injectProductSchema(product);
}

function injectProductSchema(product) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.trade_name,
    "description": product.description || '',
    "category": "Botanical Extracts",
    "brand": { "@type": "Brand", "name": "GACP LLC" },
    "url": "https://gacp.llc/product.html?slug=" + product.slug
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

function show404() {
  const detail = document.getElementById('product-detail');
  const notFound = document.getElementById('product-404');
  if (detail) detail.style.display = 'none';
  if (notFound) notFound.style.display = '';

  const crumb = document.getElementById('breadcrumb-name');
  if (crumb) crumb.textContent = 'Not Found';
}

async function initPublicProduct() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    show404();
    return;
  }

  const product = await loadPublicProduct(slug);

  if (!product) {
    show404();
    return;
  }

  renderProduct(product);
}
