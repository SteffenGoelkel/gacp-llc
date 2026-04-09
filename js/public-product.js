/* ============================================================
   GACP LLC — public-product.js
   Public product detail: fetch single product, render, schema
   ============================================================ */

async function loadPublicProduct(slug) {
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
  const displayName = product.trade_name || product.name || product.consumer_name || 'Unnamed Product';

  detail.innerHTML = `
    <div class="product-detail">
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(displayName)}" class="product-detail__image">
      <div class="product-detail__info">
        <span class="product-card__category product-card__category--${escapeHtml(cat)}">${escapeHtml(catLabel)}</span>
        <h1 class="product-detail__name">${escapeHtml(displayName)}</h1>
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
              <span class="product-spec__label">MOQ</span>
              <span class="product-spec__value">${product.moq ? escapeHtml(product.moq + ' ' + product.moq_unit) : '1 ' + escapeHtml(product.moq_unit)}</span>
            </div>` : ''}
          ${cat ? `
            <div class="product-spec">
              <span class="product-spec__label">Category</span>
              <span class="product-spec__value">${escapeHtml(catLabel)}</span>
            </div>` : ''}
        </div>

      </div>
    </div>

    <!-- Ordering Information (full width, outside the 2-col grid) -->
    <div class="ordering-info">
      <h3 class="ordering-info__title">Ordering Information</h3>

      <div class="ordering-info__grid">
        <div class="ordering-info__card">
          <div class="ordering-info__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
          </div>
          <h4>Order Quantities</h4>
          <p>Available in <strong>1 kg</strong> and <strong>25 kg</strong></p>
        </div>

        <div class="ordering-info__card">
          <div class="ordering-info__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <h4>Shipping</h4>
          <p><strong>US:</strong> UPS/FedEx ground on your shipping account</p>
          <p><strong>International:</strong> Contact for quote or provide freight details</p>
          <p><strong>Expedited/next-day:</strong> Available — contact for pricing</p>
        </div>

        <div class="ordering-info__card">
          <div class="ordering-info__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><path d="M9 3h6M10 3v6.5L4 20h16L14 9.5V3"/></svg>
          </div>
          <h4>Free Samples</h4>
          <p>Available in <strong>50 g</strong> and <strong>100 g</strong></p>
          <p class="ordering-info__sub">Provide your UPS or FedEx account number for ground shipping.</p>
          <a href="/login.html" class="btn btn--amber btn--sm" style="margin-top:var(--sp-sm)">Sign In to Request Sample</a>
        </div>
      </div>
    </div>
  `;

  // Update breadcrumb
  const crumb = document.getElementById('breadcrumb-name');
  if (crumb) crumb.textContent = displayName;

  // Update page title
  document.title = displayName + ' | GACP — Wholesale Botanical Ingredients';

  // Show gated teasers and CTA
  const teasers = document.getElementById('gated-teasers');
  const cta = document.getElementById('product-cta');
  if (teasers) teasers.style.display = '';
  if (cta) cta.style.display = '';

  // Inject JSON-LD
  injectProductSchema(product, displayName);
}

function injectProductSchema(product, name) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": name,
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
