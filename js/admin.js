/* ============================================================
   GACP LLC — admin.js
   Admin panel: product management + application review
   ============================================================ */

let editingProduct = null;

async function initAdminPanel() {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  if (profile.role !== 'trade-full') {
    document.querySelector('.portal-content').innerHTML =
      '<div class="empty-state"><h3 class="empty-state__title">Access Denied</h3><p class="empty-state__text">Admin access required.</p></div>';
    return;
  }

  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab--active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('admin-panel--active'));
      tab.classList.add('admin-tab--active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('admin-panel--active');
    });
  });

  // Load products
  await loadProducts();
  renderProductList();

  // Load applications
  loadApplications();

  // Add product button
  document.getElementById('btn-add-product').addEventListener('click', () => showProductForm(null));
  document.getElementById('btn-cancel-form').addEventListener('click', hideProductForm);

  // Add compound button
  document.getElementById('btn-add-compound').addEventListener('click', addCompoundRow);

  // Form submit
  document.getElementById('product-form').addEventListener('submit', handleProductSave);
}

// --- Product List ------------------------------------------

function renderProductList() {
  const list = document.getElementById('product-list');
  const countEl = document.getElementById('product-count');

  if (!PRODUCTS.length) {
    list.innerHTML = '<div class="empty-state"><p class="text-sm text-dim">No products found.</p></div>';
    if (countEl) countEl.textContent = '0 products';
    return;
  }

  if (countEl) countEl.textContent = `${PRODUCTS.length} products`;

  list.innerHTML = `
    <div class="product-list-item product-list-header">
      <span>Product</span>
      <span>Category</span>
      <span>Price</span>
      <span>Status</span>
      <span>Actions</span>
    </div>
    ${PRODUCTS.map(p => `
      <div class="product-list-item" data-id="${p.id}">
        <div>
          <strong style="color:var(--cream)">${escapeHtml(p.name)}</strong>
          ${p.is_dual_layer ? '<span class="badge badge--green" style="margin-left:var(--sp-xs);font-size:10px">Dual</span>' : ''}
          <br><span class="text-xs text-dim">${escapeHtml(p.id)}</span>
        </div>
        <span class="badge badge--neutral">${escapeHtml(p.cat)}</span>
        <span>${p.price ? formatPrice(p.price) : '—'}</span>
        <span class="badge badge--${p.active ? 'green' : 'neutral'}">${p.active ? 'Active' : 'Inactive'}</span>
        <div style="display:flex;gap:var(--sp-xs)">
          <button class="btn btn--sm btn--secondary" onclick="editProduct('${p.id}')">Edit</button>
          <button class="btn btn--sm btn--ghost" style="color:var(--terra)" onclick="deleteProduct('${p.id}')">Del</button>
        </div>
      </div>
    `).join('')}
  `;
}

// --- Product Form ------------------------------------------

function showProductForm(product) {
  editingProduct = product;
  const wrap = document.getElementById('product-form-wrap');
  const form = document.getElementById('product-form');
  const title = document.getElementById('form-title');
  const panels = document.querySelectorAll('.admin-panel, .admin-tabs, #product-list, #btn-add-product, #product-count');

  panels.forEach(el => { if (el) el.style.display = 'none'; });
  wrap.classList.remove('hidden');

  title.textContent = product ? 'Edit Product' : 'Add Product';

  // Reset form
  form.reset();
  document.getElementById('pf-active').checked = true;
  document.getElementById('dual-fields').classList.add('hidden');
  document.getElementById('pf-dual').checked = false;
  document.getElementById('compounds-list').innerHTML = '';

  if (product) {
    // Populate form
    document.getElementById('pf-id').value = product.id;
    document.getElementById('pf-name').value = product.name || '';
    document.getElementById('pf-cat').value = product.cat || '';
    document.getElementById('pf-brand').value = product.brand || '';
    document.getElementById('pf-tagline').value = product.tagline || '';
    document.getElementById('pf-description').value = product.description || '';
    document.getElementById('pf-price').value = product.price || '';
    document.getElementById('pf-unit').value = product.unit || '100g';
    document.getElementById('pf-moq').value = product.moq || 1;
    document.getElementById('pf-form').value = product.form || '';
    document.getElementById('pf-purity').value = product.purity || '';
    document.getElementById('pf-shelf').value = product.shelf || '';
    document.getElementById('pf-sol').value = product.sol || '';
    document.getElementById('pf-color').value = product.color || '';
    document.getElementById('pf-img').value = product.img || '';
    document.getElementById('pf-restriction').value = product.restriction || '';
    document.getElementById('pf-sort').value = product.sort_order || 0;
    document.getElementById('pf-active').checked = product.active !== false;

    if (product.is_dual_layer) {
      document.getElementById('pf-dual').checked = true;
      document.getElementById('dual-fields').classList.remove('hidden');
      document.getElementById('pf-cname').value = product.consumer_name || '';
      document.getElementById('pf-cbrand').value = product.consumer_brand || '';
      document.getElementById('pf-ctagline').value = product.consumer_tagline || '';
      document.getElementById('pf-cdesc').value = product.consumer_desc || '';
      document.getElementById('pf-cingredients').value = product.consumer_ingredients || '';
      document.getElementById('pf-cbenefits').value = (product.consumer_benefits || []).join(', ');
      document.getElementById('pf-tname').value = product.trade_name || '';
      document.getElementById('pf-tspec').value = product.trade_spec || '';
      document.getElementById('pf-tpotency').value = product.trade_potency || '';
      document.getElementById('pf-tdesc').value = product.trade_desc || '';

      // Load compounds
      const compounds = getProductCompounds(product.id);
      compounds.forEach(c => addCompoundRow(null, c.compound, c.pct));
    }
  }

  wrap.scrollIntoView({ behavior: 'smooth' });
}

function hideProductForm() {
  const wrap = document.getElementById('product-form-wrap');
  wrap.classList.add('hidden');

  const panels = document.querySelectorAll('.admin-panel, .admin-tabs, #product-list, #btn-add-product, #product-count');
  panels.forEach(el => {
    if (el) el.style.display = '';
  });

  // Re-show active tab
  const activeTab = document.querySelector('.admin-tab--active');
  if (activeTab) activeTab.click();

  editingProduct = null;
}

function addCompoundRow(e, name = '', pct = '') {
  if (e) e.preventDefault();
  const list = document.getElementById('compounds-list');
  const row = document.createElement('div');
  row.className = 'compound-row';
  row.innerHTML = `
    <div class="form-group" style="margin:0">
      <input type="text" class="form-input compound-name" placeholder="Compound name" value="${escapeHtml(String(name))}">
    </div>
    <div class="form-group" style="margin:0">
      <input type="number" class="form-input compound-pct" placeholder="%" step="0.01" value="${pct}">
    </div>
    <button type="button" class="btn btn--ghost" style="color:var(--terra);padding:var(--sp-xs)" onclick="this.closest('.compound-row').remove()">✕</button>
  `;
  list.appendChild(row);
}

// --- Save Product ------------------------------------------

async function handleProductSave(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-product');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const form = document.getElementById('product-form');
    const isEdit = !!document.getElementById('pf-id').value;
    const isDual = document.getElementById('pf-dual').checked;

    const benefitsStr = document.getElementById('pf-cbenefits').value;
    const benefits = benefitsStr ? benefitsStr.split(',').map(b => b.trim()).filter(Boolean) : null;

    const productData = {
      name: document.getElementById('pf-name').value,
      cat: document.getElementById('pf-cat').value.toLowerCase().trim(),
      brand: document.getElementById('pf-brand').value || null,
      tagline: document.getElementById('pf-tagline').value || null,
      description: document.getElementById('pf-description').value || null,
      price: parseInt(document.getElementById('pf-price').value) || 0,
      unit: document.getElementById('pf-unit').value || '100g',
      moq: parseInt(document.getElementById('pf-moq').value) || 1,
      form: document.getElementById('pf-form').value || null,
      purity: document.getElementById('pf-purity').value || null,
      shelf: document.getElementById('pf-shelf').value || null,
      sol: document.getElementById('pf-sol').value || null,
      color: document.getElementById('pf-color').value || null,
      img: document.getElementById('pf-img').value || null,
      restriction: document.getElementById('pf-restriction').value || null,
      sort_order: parseInt(document.getElementById('pf-sort').value) || 0,
      active: document.getElementById('pf-active').checked,
      is_dual_layer: isDual,
    };

    if (isDual) {
      productData.consumer_name = document.getElementById('pf-cname').value || null;
      productData.consumer_brand = document.getElementById('pf-cbrand').value || null;
      productData.consumer_tagline = document.getElementById('pf-ctagline').value || null;
      productData.consumer_desc = document.getElementById('pf-cdesc').value || null;
      productData.consumer_ingredients = document.getElementById('pf-cingredients').value || null;
      productData.consumer_benefits = benefits;
      productData.trade_name = document.getElementById('pf-tname').value || null;
      productData.trade_spec = document.getElementById('pf-tspec').value || null;
      productData.trade_potency = document.getElementById('pf-tpotency').value || null;
      productData.trade_desc = document.getElementById('pf-tdesc').value || null;
    }

    let productId;

    if (isEdit) {
      productId = document.getElementById('pf-id').value;
      const { error } = await _sb.from('products').update(productData).eq('id', productId);
      if (error) throw error;
    } else {
      // Generate ID
      productId = 'GACP-' + String(Date.now()).slice(-6);
      productData.id = productId;
      const { error } = await _sb.from('products').insert(productData);
      if (error) throw error;
    }

    // Save compounds if dual layer
    if (isDual) {
      // Delete existing compounds
      await _sb.from('product_compounds').delete().eq('product_id', productId);

      // Insert new
      const rows = document.querySelectorAll('.compound-row');
      const compounds = [];
      rows.forEach(row => {
        const name = row.querySelector('.compound-name').value.trim();
        const pct = parseFloat(row.querySelector('.compound-pct').value);
        if (name && !isNaN(pct)) {
          compounds.push({ product_id: productId, compound: name, pct });
        }
      });

      if (compounds.length) {
        const { error } = await _sb.from('product_compounds').insert(compounds);
        if (error) console.error('Compounds save error:', error);
      }
    }

    showToast(isEdit ? 'Product updated' : 'Product created', 'success');

    // Refresh
    PRODUCTS = [];
    COMPOUNDS_MAP = {};
    await loadProducts();
    renderProductList();
    hideProductForm();

  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Product';
  }
}

// --- Edit / Delete -----------------------------------------

function editProduct(id) {
  const product = PRODUCTS.find(p => p.id === id);
  if (product) showProductForm(product);
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;

  try {
    await _sb.from('product_compounds').delete().eq('product_id', id);
    const { error } = await _sb.from('products').delete().eq('id', id);
    if (error) throw error;

    showToast('Product deleted', 'info');
    PRODUCTS = [];
    COMPOUNDS_MAP = {};
    await loadProducts();
    renderProductList();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// --- Applications ------------------------------------------

async function loadApplications() {
  const container = document.getElementById('admin-container');

  const { data: profiles, error } = await _sb
    .from('profiles')
    .select('*')
    .eq('role', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<p class="text-dim">Unable to load applications.</p>';
    return;
  }

  if (!profiles.length) {
    container.innerHTML = '<div class="empty-state"><h3 class="empty-state__title">No pending applications</h3><p class="empty-state__text">All applications have been reviewed.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>Date</th><th>Name</th><th>Email</th><th>Type</th><th>Company</th><th>Country</th><th>IP Match</th><th>Actions</th></tr>
        </thead>
        <tbody id="admin-tbody"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById('admin-tbody');
  profiles.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(p.created_at).toLocaleDateString()}</td>
      <td>${escapeHtml((p.first_name || '') + ' ' + (p.last_name || ''))}</td>
      <td>${escapeHtml(p.email || '')}</td>
      <td><span class="badge badge--${p.account_type === 'business' ? 'amber' : 'neutral'}">${p.account_type || '—'}</span></td>
      <td>${escapeHtml(p.company || '—')}</td>
      <td>${escapeHtml(p.country || '—')}</td>
      <td>${p.location_match === true ? '<span class="badge badge--green">Match</span>' :
            p.location_match === false ? '<span class="badge badge--terra">Mismatch</span>' :
            '<span class="badge badge--neutral">N/A</span>'}</td>
      <td>
        <div style="display:flex;gap:var(--sp-xs)">
          <button class="btn btn--sm btn--primary" data-approve="${p.id}">Approve</button>
          <button class="btn btn--sm btn--ghost" style="color:var(--terra)" data-reject="${p.id}">Reject</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  tbody.addEventListener('click', async (e) => {
    const approveBtn = e.target.closest('[data-approve]');
    const rejectBtn = e.target.closest('[data-reject]');

    if (approveBtn) {
      const { error } = await _sb.from('profiles').update({
        role: 'consumer',
        approved_at: new Date().toISOString(),
        approved_by: 'admin',
      }).eq('id', approveBtn.dataset.approve);

      if (!error) {
        approveBtn.closest('tr').remove();
        showToast('Application approved', 'success');
      }
    }

    if (rejectBtn) {
      if (!confirm('Reject this application?')) return;
      const { error } = await _sb.from('profiles').update({
        role: 'rejected',
        approved_at: new Date().toISOString(),
        approved_by: 'admin',
      }).eq('id', rejectBtn.dataset.reject);

      if (!error) {
        rejectBtn.closest('tr').remove();
        showToast('Application rejected', 'info');
      }
    }
  });
}
