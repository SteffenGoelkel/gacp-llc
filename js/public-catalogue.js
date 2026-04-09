/* ============================================================
   GACP LLC — public-catalogue.js
   Public catalogue: fetch from public_catalogue view, render grid
   ============================================================ */

async function loadPublicCatalogue() {
  const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await _sb
    .from('public_catalogue')
    .select('*');

  if (error) {
    console.error('Failed to load catalogue:', error);
    return [];
  }
  return data || [];
}

function renderCatalogueCard(product) {
  const cat = product.category || '';
  const catLabel = (CATEGORIES.find(c => c.key === cat) || {}).label || cat;

  const card = document.createElement('a');
  card.href = '/product.html?slug=' + encodeURIComponent(product.slug);
  card.className = 'card card--interactive product-card catalogue-card';
  card.dataset.category = cat;

  const imgSrc = product.image_url || '/images/logo.png';

  card.innerHTML = `
    <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.trade_name)}" class="product-card__img" loading="lazy">
    <span class="product-card__category product-card__category--${escapeHtml(cat)}">${escapeHtml(catLabel)}</span>
    <h3 class="product-card__name">${escapeHtml(product.trade_name)}</h3>
    <div class="catalogue-card__specs">
      ${product.purity ? `<span class="catalogue-card__spec">Purity: ${escapeHtml(product.purity)}</span>` : ''}
      ${product.form ? `<span class="catalogue-card__spec">Form: ${escapeHtml(product.form)}</span>` : ''}
    </div>
  `;

  return card;
}

function renderCatalogueGrid(products) {
  const grid = document.getElementById('catalogue-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!products.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No products found</div>
        <div class="empty-state__text">Try selecting a different category.</div>
      </div>
    `;
    return;
  }

  products.forEach(p => grid.appendChild(renderCatalogueCard(p)));
}

function initCategoryFilter(allProducts) {
  const filterBar = document.getElementById('category-filter');
  if (!filterBar) return;

  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
    btn.classList.add('filter-btn--active');

    const cat = btn.dataset.cat;
    const filtered = cat === 'all'
      ? allProducts
      : allProducts.filter(p => p.category === cat);

    renderCatalogueGrid(filtered);
  });
}

async function initPublicCatalogue() {
  const products = await loadPublicCatalogue();

  // Auto-select category from URL param (e.g. ?category=tropical)
  const urlCat = new URLSearchParams(window.location.search).get('category');
  if (urlCat && urlCat !== 'all') {
    const filtered = products.filter(p => p.category === urlCat);
    renderCatalogueGrid(filtered.length ? filtered : products);

    // Activate matching filter button after DOM is ready
    requestAnimationFrame(() => {
      const filterBar = document.getElementById('category-filter');
      if (filterBar) {
        const match = filterBar.querySelector('[data-cat="' + urlCat + '"]');
        if (match) {
          filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
          match.classList.add('filter-btn--active');
        }
      }
    });
  } else {
    renderCatalogueGrid(products);
  }

  initCategoryFilter(products);
}
