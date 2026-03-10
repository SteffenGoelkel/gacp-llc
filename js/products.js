/* ============================================================
   GACP LLC — products.js
   Product catalogue — fetches from Supabase database
   Product-level legal restrictions by jurisdiction
   ============================================================ */

const RESTRICTIONS = {
  kratom: {
    label: 'Kratom / Mitragyna',
    blocked_countries: ['AU','DK','FI','IL','LT','MY','MM','NZ','PL','RO','RU','SE','TH','VN','GB','IE','IT'],
    blocked_us_states: ['AL','AR','IN','VT','WI','RI'],
    notice: 'This product contains kratom-derived compounds and may not be available in your jurisdiction.',
  },
  cannabinoid: {
    label: 'Cannabinoid / Hemp',
    blocked_countries: ['RU','CN','JP','KR','SG','ID','MY','TH','PH','SA','AE','EG','TR','UA','BY'],
    blocked_us_states: ['ID'],
    notice: 'This product contains hemp-derived cannabinoids. US Farm Bill compliant (<0.3% THC).',
  },
  kanna: {
    label: 'Kanna / Sceletium',
    blocked_countries: ['AU'],
    blocked_us_states: ['LA'],
    notice: 'This product contains Sceletium tortuosum compounds.',
  },
};

let PRODUCTS = [];
let COMPOUNDS_MAP = {};

/** Fetch all active products from Supabase */
async function loadProducts() {
  if (PRODUCTS.length > 0) return PRODUCTS;

  const { data: products, error } = await _sb
    .from('products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to load products:', error);
    return [];
  }

  PRODUCTS = products || [];

  const { data: compounds, error: compErr } = await _sb
    .from('product_compounds')
    .select('*');

  if (!compErr && compounds) {
    COMPOUNDS_MAP = {};
    compounds.forEach(c => {
      if (!COMPOUNDS_MAP[c.product_id]) COMPOUNDS_MAP[c.product_id] = [];
      COMPOUNDS_MAP[c.product_id].push({ compound: c.compound, pct: parseFloat(c.pct) });
    });
  }

  return PRODUCTS;
}

function getProductCompounds(productId) {
  return COMPOUNDS_MAP[productId] || [];
}

// --- Restriction Helpers -----------------------------------

function isProductBlocked(product, geo) {
  if (!product.restriction || !geo) return false;
  const rule = RESTRICTIONS[product.restriction];
  if (!rule) return false;
  if (rule.blocked_countries.includes(geo.country)) return true;
  if (geo.country === 'US' && rule.blocked_us_states.includes(geo.region)) return true;
  return false;
}

function getRestrictionInfo(product) {
  if (!product.restriction) return null;
  return RESTRICTIONS[product.restriction] || null;
}

// --- Rendering Helpers -------------------------------------

function getProductLayer(product, profile, viewMode = 'auto') {
  if (!product.is_dual_layer) {
    return { name: product.name, desc: product.description || '', isTrade: false };
  }

  const isTrade = canViewTrade(profile);
  if (viewMode === 'consumer' || (!isTrade && viewMode === 'auto')) {
    return {
      name: product.consumer_name || product.name,
      desc: product.consumer_desc || product.description || '',
      isTrade: false,
    };
  }

  return {
    name: product.trade_name || product.name,
    desc: product.trade_desc || product.description || '',
    isTrade: true,
  };
}

function renderProductCard(product, profile, viewMode = 'auto', geo = null) {
  const layer = getProductLayer(product, profile, viewMode);
  const blocked = isProductBlocked(product, geo);
  const restriction = getRestrictionInfo(product);

  const card = document.createElement('div');
  card.className = 'card card--interactive product-card' + (blocked ? ' product-card--blocked' : '');
  card.dataset.productId = product.id;
  card.dataset.category = product.cat;

  const restrictionBadge = restriction
    ? `<span class="product-card__restriction product-card__restriction--${product.restriction}">${restriction.label}</span>`
    : '';

  const blockedOverlay = blocked
    ? `<div class="product-card__unavailable">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
         <span>Unavailable in your region</span>
       </div>`
    : '';

  const specLine = (layer.isTrade && product.trade_spec)
    ? `<p class="text-xs text-dim" style="margin-bottom:var(--sp-xs)">${escapeHtml(product.trade_spec)}</p>`
    : '';

  card.innerHTML = `
    <img class="product-card__img" src="${product.img || ''}" alt="${escapeHtml(layer.name)}"
         onerror="this.style.display='flex';this.style.alignItems='center';this.style.justifyContent='center';this.innerHTML='<span style=color:var(--text-muted)>No image</span>'">
    <span class="product-card__category product-card__category--${product.cat}">${product.cat}</span>
    ${restrictionBadge}
    <h3 class="product-card__name">${escapeHtml(layer.name)}</h3>
    ${specLine}
    <span class="product-card__price">${product.price ? formatPrice(product.price) + ' / ' + product.unit : 'Price on request'}</span>
    ${blockedOverlay}
  `;

  if (!blocked) {
    card.addEventListener('click', () => openProductDetail(product, profile, viewMode));
  }

  return card;
}

function openProductDetail(product, profile, viewMode = 'auto') {
  const layer = getProductLayer(product, profile, viewMode);
  const isTrade = layer.isTrade;
  const restriction = getRestrictionInfo(product);
  const compounds = getProductCompounds(product.id);
  const overlay = document.getElementById('product-overlay');
  if (!overlay) return;

  let restrictionHTML = '';
  if (restriction) {
    restrictionHTML = `
      <div class="product-detail__notice product-detail__notice--${product.restriction}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${escapeHtml(restriction.notice)}</span>
      </div>
    `;
  }

  let compoundsHTML = '';
  if (isTrade && canViewCompounds(profile) && compounds.length) {
    compoundsHTML = `
      <div class="product-detail__section">
        <h4>Compound Profile</h4>
        ${compounds.map(c => `
          <div class="compound-bar">
            <span class="compound-bar__name">${escapeHtml(c.compound)}</span>
            <div class="compound-bar__track">
              <div class="compound-bar__fill" style="width:${Math.min(c.pct, 100)}%"></div>
            </div>
            <span class="compound-bar__pct">${c.pct}%</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  let specsHTML = '';
  if (isTrade && product.trade_spec) {
    specsHTML = `
      <div class="product-detail__meta">
        ${product.trade_spec ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">Spec Code</div><div class="product-detail__meta-value">${escapeHtml(product.trade_spec)}</div></div>` : ''}
        ${product.purity ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">Purity</div><div class="product-detail__meta-value">${escapeHtml(product.purity)}</div></div>` : ''}
        ${product.form ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">Form</div><div class="product-detail__meta-value">${escapeHtml(product.form)}</div></div>` : ''}
        ${product.sol ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">Solubility</div><div class="product-detail__meta-value">${escapeHtml(product.sol)}</div></div>` : ''}
        ${product.shelf ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">Shelf Life</div><div class="product-detail__meta-value">${escapeHtml(product.shelf)}</div></div>` : ''}
        ${product.moq ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">MOQ</div><div class="product-detail__meta-value">${product.moq} units</div></div>` : ''}
      </div>
    `;
  } else if (product.form || product.shelf || product.purity) {
    specsHTML = `
      <div class="product-detail__meta">
        ${product.purity ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">Specification</div><div class="product-detail__meta-value">${escapeHtml(product.purity)}</div></div>` : ''}
        ${product.form ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">Form</div><div class="product-detail__meta-value">${escapeHtml(product.form)}</div></div>` : ''}
        ${product.shelf ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">Shelf Life</div><div class="product-detail__meta-value">${escapeHtml(product.shelf)}</div></div>` : ''}
        ${product.moq ? `<div class="product-detail__meta-item"><div class="product-detail__meta-label">MOQ</div><div class="product-detail__meta-value">${product.moq} units</div></div>` : ''}
      </div>
    `;
  }

  let benefitsHTML = '';
  if (!isTrade && product.consumer_benefits?.length) {
    benefitsHTML = `
      <div class="product-detail__section">
        <h4>Benefits</h4>
        <div class="benefits-list">
          ${product.consumer_benefits.map(b => `<span class="benefit-tag">${escapeHtml(b)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  const tagline = (!isTrade && product.consumer_tagline)
    ? `<p class="product-detail__tagline">${escapeHtml(product.consumer_tagline)}</p>`
    : (isTrade && product.trade_potency)
      ? `<p class="text-sm text-dim">${escapeHtml(product.trade_potency)}</p>`
      : (product.tagline ? `<p class="product-detail__tagline">${escapeHtml(product.tagline)}</p>` : '');

  const priceHTML = product.price
    ? `<span style="font-size:var(--fs-xl);font-weight:700;color:var(--green)">${formatPrice(product.price)}</span><span class="text-sm text-dim"> / ${product.unit}</span>`
    : `<span style="font-size:var(--fs-lg);color:var(--amber)">Price on request</span>`;

  const panel = overlay.querySelector('.overlay__panel');
  panel.innerHTML = `
    <div class="product-detail">
      <div class="product-detail__header">
        <img class="product-detail__img" src="${product.img || ''}" alt="${escapeHtml(layer.name)}"
             onerror="this.style.background='var(--ink-mid)'">
        <div class="product-detail__info">
          <span class="product-card__category product-card__category--${product.cat}">${product.cat}</span>
          <h2 class="product-detail__name">${escapeHtml(layer.name)}</h2>
          ${tagline}
          <div style="margin-top:var(--sp-md)">${priceHTML}</div>
        </div>
      </div>

      ${restrictionHTML}
      ${specsHTML}

      <div class="product-detail__section">
        <h4>Description</h4>
        <p class="product-detail__desc">${escapeHtml(layer.desc)}</p>
      </div>

      ${benefitsHTML}
      ${compoundsHTML}

      <div style="display:flex;gap:var(--sp-md);margin-top:var(--sp-xl)">
        ${product.price ? `<button class="btn btn--primary" onclick="addToCart('${product.id}')">Add to Cart</button>` : ''}
        <button class="btn btn--secondary" onclick="closeOverlay()">Close</button>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  const overlay = document.getElementById('product-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// --- Catalogue Page Init -----------------------------------

async function initCatalogue() {
  const grid = document.getElementById('catalogue-grid');
  const countEl = document.getElementById('catalogue-count');
  if (!grid) return;

  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  grid.innerHTML = '<div class="loading-screen"><div class="spinner"></div><span>Loading catalogue…</span></div>';
  await loadProducts();

  const geo = await detectLocation();
  renderLocationBanner('location-banner-slot');

  // Build dynamic category filters
  const cats = [...new Set(PRODUCTS.map(p => p.cat))].sort();
  const filterBar = document.querySelector('.filter-bar');
  if (filterBar) {
    filterBar.innerHTML = `<button class="filter-btn filter-btn--active" data-cat="all">All</button>` +
      cats.map(c => `<button class="filter-btn" data-cat="${c}">${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))}</button>`).join('');
  }

  let viewMode = 'auto';
  let activeCategory = 'all';
  let searchQuery = '';

  function render() {
    let filtered = PRODUCTS;

    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.cat === activeCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const layer = getProductLayer(p, profile, viewMode);
        return layer.name.toLowerCase().includes(q) ||
               p.cat.toLowerCase().includes(q) ||
               p.id.toLowerCase().includes(q);
      });
    }

    grid.innerHTML = '';
    filtered.forEach(p => grid.appendChild(renderProductCard(p, profile, viewMode, geo)));

    if (countEl) countEl.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
  }

  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      activeCategory = btn.dataset.cat;
      render();
    });
  }

  const searchInput = document.getElementById('catalogue-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      searchQuery = e.target.value;
      render();
    }, 200));
  }

  if (canToggleView(profile)) {
    const toggleWrap = document.getElementById('view-toggle');
    if (toggleWrap) {
      toggleWrap.classList.remove('hidden');
      toggleWrap.querySelectorAll('.view-toggle__btn').forEach(btn => {
        btn.addEventListener('click', () => {
          toggleWrap.querySelectorAll('.view-toggle__btn').forEach(b => b.classList.remove('view-toggle__btn--active'));
          btn.classList.add('view-toggle__btn--active');
          viewMode = btn.dataset.view;
          render();
        });
      });
    }
  }

  const overlay = document.getElementById('product-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
  }

  render();
}
