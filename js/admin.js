/* ============================================================
   GACP LLC — admin.js
   Admin panel: product management + application review
   with corporate verification via OpenCorporates
   ============================================================ */

let editingProduct = null;
let appProfiles = [];

async function initAdminPanel() {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  if (profile.role !== 'trade-full') {
    document.querySelector('.portal-content').innerHTML =
      '<div class="empty-state"><h3 class="empty-state__title">Access Denied</h3><p class="empty-state__text">Admin access required.</p></div>';
    return;
  }

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab--active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('admin-panel--active'));
      tab.classList.add('admin-tab--active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('admin-panel--active');
    });
  });

  await loadProducts();
  renderProductList();
  loadApplications();

  document.getElementById('btn-add-product').addEventListener('click', () => showProductForm(null));
  document.getElementById('btn-cancel-form').addEventListener('click', hideProductForm);
  document.getElementById('btn-add-compound').addEventListener('click', addCompoundRow);
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

  if (countEl) countEl.textContent = PRODUCTS.length + ' products';

  const visLabel = (p) => {
    const parts = [];
    if (p.visible_consumer) parts.push('C');
    if (p.visible_trade) parts.push('T');
    return parts.join('/') || '—';
  };

  list.innerHTML =
    '<div class="product-list-item product-list-header"><span>Product</span><span>Category</span><span>Price</span><span>Visibility</span><span>Actions</span></div>' +
    PRODUCTS.map(p => '<div class="product-list-item" data-id="' + p.id + '">' +
      '<div><strong style="color:var(--cream)">' + escapeHtml(p.name) + '</strong>' +
      (p.is_dual_layer ? ' <span class="badge badge--green" style="font-size:10px">Dual</span>' : '') +
      '<br><span class="text-xs text-dim">' + escapeHtml(p.id) + '</span></div>' +
      '<span class="badge badge--neutral">' + escapeHtml(p.cat) + '</span>' +
      '<span>' + (p.price ? formatPrice(p.price) : '—') + '</span>' +
      '<span class="text-xs">' + (p.active ? visLabel(p) : '<span style="color:var(--terra)">Inactive</span>') + '</span>' +
      '<div style="display:flex;gap:var(--sp-xs)">' +
        '<button class="btn btn--sm btn--secondary" onclick="editProduct(\'' + p.id + '\')">Edit</button>' +
        '<button class="btn btn--sm btn--ghost" style="color:var(--terra)" onclick="deleteProduct(\'' + p.id + '\')">Del</button>' +
      '</div></div>'
    ).join('');
}

// --- Image Upload ------------------------------------------

async function uploadProductImage(file, productId) {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = 'products/' + productId + '.' + ext;

  // Delete any existing images for this product (handles extension changes)
  const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const removePaths = extensions.map(e => 'products/' + productId + '.' + e);
  await _sb.storage.from('product-images').remove(removePaths);

  const { data, error } = await _sb.storage
    .from('product-images')
    .upload(path, file, { contentType: file.type });

  if (error) throw error;

  const { data: urlData } = _sb.storage
    .from('product-images')
    .getPublicUrl(path);

  return urlData.publicUrl + '?v=' + Date.now();
}

// --- Product Form ------------------------------------------

function showProductForm(product) {
  editingProduct = product;
  var wrap = document.getElementById('product-form-wrap');
  var form = document.getElementById('product-form');
  var title = document.getElementById('form-title');
  var panels = document.querySelectorAll('.admin-panel, .admin-tabs, #product-list, #btn-add-product, #product-count');

  panels.forEach(function(el) { if (el) el.style.display = 'none'; });
  wrap.classList.remove('hidden');

  title.textContent = product ? 'Edit Product' : 'Add Product';

  form.reset();
  document.getElementById('pf-active').checked = true;
  document.getElementById('pf-vis-consumer').checked = true;
  document.getElementById('pf-vis-trade').checked = true;
  document.getElementById('dual-fields').classList.add('hidden');
  document.getElementById('pf-dual').checked = false;
  document.getElementById('compounds-list').innerHTML = '';
  document.getElementById('pf-img').value = '';
  document.getElementById('pf-img-status').textContent = '';

  if (product) {
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
    document.getElementById('pf-vis-consumer').checked = product.visible_consumer !== false;
    document.getElementById('pf-vis-trade').checked = product.visible_trade !== false;

    if (product.img) {
      document.getElementById('pf-img-status').textContent = 'Current: ' + product.img;
    }

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

      var compounds = getProductCompounds(product.id);
      compounds.forEach(function(c) { addCompoundRow(null, c.compound, c.pct); });
    }
  }

  wrap.scrollIntoView({ behavior: 'smooth' });
}

function hideProductForm() {
  document.getElementById('product-form-wrap').classList.add('hidden');
  document.querySelectorAll('.admin-panel, .admin-tabs, #product-list, #btn-add-product, #product-count')
    .forEach(function(el) { if (el) el.style.display = ''; });
  var activeTab = document.querySelector('.admin-tab--active');
  if (activeTab) activeTab.click();
  editingProduct = null;
}

function addCompoundRow(e, name, pct) {
  if (e) e.preventDefault();
  name = name || '';
  pct = pct || '';
  var list = document.getElementById('compounds-list');
  var row = document.createElement('div');
  row.className = 'compound-row';
  row.innerHTML =
    '<div class="form-group" style="margin:0"><input type="text" class="form-input compound-name" placeholder="Compound name" value="' + escapeHtml(String(name)) + '"></div>' +
    '<div class="form-group" style="margin:0"><input type="number" class="form-input compound-pct" placeholder="%" step="0.01" value="' + pct + '"></div>' +
    '<button type="button" class="btn btn--ghost" style="color:var(--terra);padding:var(--sp-xs)" onclick="this.closest(\'.compound-row\').remove()">✕</button>';
  list.appendChild(row);
}

// --- Save Product ------------------------------------------

async function handleProductSave(e) {
  e.preventDefault();
  var btn = document.getElementById('btn-save-product');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    var isEdit = !!document.getElementById('pf-id').value;
    var isDual = document.getElementById('pf-dual').checked;

    var benefitsStr = document.getElementById('pf-cbenefits').value;
    var benefits = benefitsStr ? benefitsStr.split(',').map(function(b) { return b.trim(); }).filter(Boolean) : null;

    var productId;
    if (isEdit) {
      productId = document.getElementById('pf-id').value;
    } else {
      productId = 'GACP-' + String(Date.now()).slice(-6);
    }

    var imgFile = document.getElementById('pf-img-file').files[0];
    var imgUrl = document.getElementById('pf-img').value;

    if (imgFile) {
      document.getElementById('pf-img-status').textContent = 'Uploading image…';
      try {
        imgUrl = await uploadProductImage(imgFile, productId);
        document.getElementById('pf-img-status').textContent = 'Image uploaded';
      } catch (imgErr) {
        console.error('Image upload error:', imgErr);
        document.getElementById('pf-img-status').textContent = 'Image upload failed';
      }
    }

    var productData = {
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
      img: imgUrl || null,
      restriction: document.getElementById('pf-restriction').value || null,
      sort_order: parseInt(document.getElementById('pf-sort').value) || 0,
      active: document.getElementById('pf-active').checked,
      visible_consumer: document.getElementById('pf-vis-consumer').checked,
      visible_trade: document.getElementById('pf-vis-trade').checked,
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
    } else {
      productData.consumer_name = null;
      productData.consumer_brand = null;
      productData.consumer_tagline = null;
      productData.consumer_desc = null;
      productData.consumer_ingredients = null;
      productData.consumer_benefits = null;
      productData.trade_name = null;
      productData.trade_spec = null;
      productData.trade_potency = null;
      productData.trade_desc = null;
    }

    if (isEdit) {
      var err1 = (await _sb.from('products').update(productData).eq('id', productId)).error;
      if (err1) throw err1;
    } else {
      productData.id = productId;
      var err2 = (await _sb.from('products').insert(productData)).error;
      if (err2) throw err2;
    }

    if (isDual) {
      await _sb.from('product_compounds').delete().eq('product_id', productId);
      var rows = document.querySelectorAll('.compound-row');
      var compounds = [];
      rows.forEach(function(row) {
        var nm = row.querySelector('.compound-name').value.trim();
        var pc = parseFloat(row.querySelector('.compound-pct').value);
        if (nm && !isNaN(pc)) compounds.push({ product_id: productId, compound: nm, pct: pc });
      });
      if (compounds.length) {
        var err3 = (await _sb.from('product_compounds').insert(compounds)).error;
        if (err3) console.error('Compounds save error:', err3);
      }
    }

    showToast(isEdit ? 'Product updated' : 'Product created', 'success');
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

function editProduct(id) {
  var product = PRODUCTS.find(function(p) { return p.id === id; });
  if (product) showProductForm(product);
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  try {
    await _sb.from('product_compounds').delete().eq('product_id', id);
    var err = (await _sb.from('products').delete().eq('id', id)).error;
    if (err) throw err;
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
  var container = document.getElementById('admin-container');

  var result = await _sb
    .from('profiles')
    .select('*')
    .in('role', ['pending', 'consumer', 'trade-restricted', 'trade-full', 'rejected'])
    .order('created_at', { ascending: false });

  if (result.error) {
    container.innerHTML = '<p class="text-dim">Unable to load applications.</p>';
    return;
  }

  appProfiles = result.data || [];
  var pending = appProfiles.filter(function(p) { return p.role === 'pending'; });

  if (!appProfiles.length) {
    container.innerHTML = '<div class="empty-state"><h3 class="empty-state__title">No applications</h3></div>';
    return;
  }

  container.innerHTML =
    '<div style="display:flex;gap:var(--sp-md);margin-bottom:var(--sp-lg)">' +
      '<button class="filter-btn filter-btn--active" data-app-filter="pending">Pending (' + pending.length + ')</button>' +
      '<button class="filter-btn" data-app-filter="all">All (' + appProfiles.length + ')</button>' +
    '</div>' +
    '<div class="table-wrap"><table class="table"><thead>' +
      '<tr><th>Date</th><th>Name</th><th>Email</th><th>Type</th><th>Company</th><th>Corp</th><th>Role</th><th>Actions</th></tr>' +
    '</thead><tbody id="admin-tbody"></tbody></table></div>' +
    '<div id="app-detail-overlay" class="overlay"><div class="overlay__panel" id="app-detail-panel"></div></div>';

  renderAppTable('pending');

  container.querySelectorAll('[data-app-filter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      container.querySelectorAll('[data-app-filter]').forEach(function(b) { b.classList.remove('filter-btn--active'); });
      btn.classList.add('filter-btn--active');
      renderAppTable(btn.dataset.appFilter);
    });
  });

  container.addEventListener('click', async function(e) {
    var approveBtn = e.target.closest('[data-approve]');
    var rejectBtn = e.target.closest('[data-reject]');
    var detailBtn = e.target.closest('[data-detail]');

    if (detailBtn) {
      var p = appProfiles.find(function(x) { return x.id === detailBtn.dataset.detail; });
      if (p) showAppDetail(p);
    }
    if (approveBtn) await setAppRole(approveBtn.dataset.approve, 'consumer');
    if (rejectBtn) {
      if (!confirm('Reject this application?')) return;
      await setAppRole(rejectBtn.dataset.reject, 'rejected');
    }
  });
}

function renderAppTable(filter) {
  var tbody = document.getElementById('admin-tbody');
  if (!tbody) return;

  var list = filter === 'all' ? appProfiles : appProfiles.filter(function(p) { return p.role === filter; });

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:var(--sp-xl)"><span class="text-dim">No applications found.</span></td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function(p) {
    var corpBadge = p.corp_verified === true ? '<span class="badge badge--green">Verified</span>'
      : p.corp_verified === false ? '<span class="badge badge--terra">Unverified</span>'
      : '<span class="badge badge--neutral">—</span>';

    var roleMap = {
      pending: '<span class="badge badge--amber">Pending</span>',
      consumer: '<span class="badge badge--green">Consumer</span>',
      'trade-restricted': '<span class="badge badge--green">Trade</span>',
      'trade-full': '<span class="badge badge--green">Trade Full</span>',
      rejected: '<span class="badge badge--terra">Rejected</span>',
    };
    var roleBadge = roleMap[p.role] || '<span class="badge badge--neutral">' + p.role + '</span>';

    return '<tr>' +
      '<td>' + new Date(p.created_at).toLocaleDateString() + '</td>' +
      '<td>' + escapeHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</td>' +
      '<td>' + escapeHtml(p.email || '') + '</td>' +
      '<td><span class="badge badge--' + (p.account_type === 'business' ? 'amber' : 'neutral') + '">' + (p.account_type || '—') + '</span></td>' +
      '<td>' + escapeHtml(p.company || '—') + '</td>' +
      '<td>' + corpBadge + '</td>' +
      '<td>' + roleBadge + '</td>' +
      '<td><div style="display:flex;gap:var(--sp-xs)">' +
        '<button class="btn btn--sm btn--secondary" data-detail="' + p.id + '">Detail</button>' +
        (p.role === 'pending' ?
          '<button class="btn btn--sm btn--primary" data-approve="' + p.id + '">Approve</button>' +
          '<button class="btn btn--sm btn--ghost" style="color:var(--terra)" data-reject="' + p.id + '">Reject</button>'
        : '') +
      '</div></td></tr>';
  }).join('');
}

async function setAppRole(id, role) {
  var err = (await _sb.from('profiles').update({
    role: role,
    approved_at: new Date().toISOString(),
    approved_by: 'admin',
  }).eq('id', id)).error;

  if (!err) {
    var p = appProfiles.find(function(x) { return x.id === id; });
    if (p) p.role = role;
    var activeFilter = document.querySelector('[data-app-filter].filter-btn--active');
    renderAppTable(activeFilter ? activeFilter.dataset.appFilter : 'pending');
    showToast(role === 'rejected' ? 'Application rejected' : 'Application approved', role === 'rejected' ? 'info' : 'success');
  }
}

// --- Application Detail + Corporate Verification -----------

function showAppDetail(profile) {
  var overlay = document.getElementById('app-detail-overlay');
  var panel = document.getElementById('app-detail-panel');
  if (!overlay || !panel) return;

  var address = [profile.addr1, profile.addr2, profile.city, profile.state, profile.zip, profile.country].filter(Boolean).join(', ');

  var corpBadge = profile.corp_verified === true ? '<span class="badge badge--green">Verified</span>'
    : profile.corp_verified === false ? '<span class="badge badge--terra">Unverified</span>'
    : '<span class="badge badge--neutral">Not yet checked</span>';

  var fields = [
    ['Name', (profile.first_name || '') + ' ' + (profile.last_name || '')],
    ['Email', profile.email],
    ['Phone', profile.phone],
    ['Account Type', profile.account_type],
    ['Company', profile.company],
    ['Corp / EIN', profile.corp_num],
    ['VAT / Tax ID', profile.vat],
    ['Website', profile.website],
    ['Address', address],
    ['Business Category', profile.biz_category],
    ['Intended Use', profile.intended_use],
    ['IP Address', profile.ip_address],
    ['IP Location', (profile.ip_city || '') + ', ' + (profile.ip_country || '')],
    ['IP Org', profile.ip_org],
    ['Location Match', profile.location_match === true ? 'Yes' : profile.location_match === false ? 'No' : 'N/A'],
    ['Applied', new Date(profile.created_at).toLocaleString()],
    ['Role', profile.role],
  ];

  var fieldsHTML = fields.map(function(f) {
    return '<div><div class="text-muted text-xs" style="text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">' + f[0] + '</div>' +
      '<div class="text-cream">' + escapeHtml(f[1] || '—') + '</div></div>';
  }).join('');

  var corpSection = '';
  if (profile.company) {
    corpSection =
      '<a class="btn btn--secondary btn--sm" id="btn-verify-corp" ' +
        'href="https://opencorporates.com/companies?q=' + encodeURIComponent(profile.company) + '" ' +
        'target="_blank" rel="noopener">Search OpenCorporates ↗</a>' +
      '<a class="btn btn--secondary btn--sm" style="margin-left:var(--sp-sm)" ' +
        'href="https://www.google.com/search?q=' + encodeURIComponent('"' + profile.company + '" ' + (profile.corp_num || '') + ' company registry') + '" ' +
        'target="_blank" rel="noopener">Google Registry Search ↗</a>' +
      '<div style="margin-top:var(--sp-md);display:flex;gap:var(--sp-sm)">' +
        '<button class="btn btn--sm btn--primary" onclick="markCorpVerified(\'' + profile.id + '\', true)">Mark Verified</button>' +
        '<button class="btn btn--sm btn--ghost" style="color:var(--terra)" onclick="markCorpVerified(\'' + profile.id + '\', false)">Mark Unverified</button>' +
      '</div>';
  } else {
    corpSection = '<p class="text-xs text-dim">No company name provided.</p>';
  }

  var roleActions = '';
  if (profile.role === 'pending') {
    roleActions =
      '<div style="display:flex;gap:var(--sp-md);flex-wrap:wrap">' +
        '<button class="btn btn--primary" onclick="setAppRole(\'' + profile.id + '\',\'consumer\');closeAppDetail()">Approve Consumer</button>' +
        '<button class="btn btn--secondary" onclick="setAppRole(\'' + profile.id + '\',\'trade-restricted\');closeAppDetail()">Approve Trade</button>' +
        '<button class="btn btn--secondary" onclick="setAppRole(\'' + profile.id + '\',\'trade-full\');closeAppDetail()">Approve Trade Full</button>' +
        '<button class="btn btn--ghost" style="color:var(--terra)" onclick="setAppRole(\'' + profile.id + '\',\'rejected\');closeAppDetail()">Reject</button>' +
      '</div>';
  } else {
    roleActions =
      '<div style="display:flex;gap:var(--sp-md);align-items:center">' +
        '<label class="form-label" style="margin:0">Change role:</label>' +
        '<select class="form-select" style="width:auto" onchange="if(this.value){setAppRole(\'' + profile.id + '\',this.value);closeAppDetail();}">' +
          '<option value="">— Select —</option>' +
          '<option value="pending">Pending</option>' +
          '<option value="consumer">Consumer</option>' +
          '<option value="trade-restricted">Trade Restricted</option>' +
          '<option value="trade-full">Trade Full</option>' +
          '<option value="rejected">Rejected</option>' +
        '</select>' +
      '</div>';
  }

  panel.innerHTML =
    '<div style="max-width:600px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-xl)">' +
        '<h3>Application Detail</h3>' +
        '<button class="btn btn--ghost btn--sm" onclick="closeAppDetail()">Close</button>' +
      '</div>' +
      '<div class="grid grid-2 gap-lg" style="font-size:var(--fs-sm);margin-bottom:var(--sp-xl)">' + fieldsHTML + '</div>' +
      '<div class="card" style="margin-bottom:var(--sp-xl)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-md)">' +
          '<h4 style="font-size:var(--fs-sm)">Corporate Verification</h4>' + corpBadge +
        '</div>' + corpSection +
      '</div>' +
      roleActions +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeAppDetail();
  });
}

function closeAppDetail() {
  var overlay = document.getElementById('app-detail-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// --- Mark Corporate Verified/Unverified --------------------

async function markCorpVerified(profileId, verified) {
  var err = (await _sb.from('profiles')
    .update({ corp_verified: verified })
    .eq('id', profileId)).error;

  if (!err) {
    var p = appProfiles.find(function(x) { return x.id === profileId; });
    if (p) p.corp_verified = verified;
    showToast(verified ? 'Marked as verified' : 'Marked as unverified', verified ? 'success' : 'info');
    var activeFilter = document.querySelector('[data-app-filter].filter-btn--active');
    renderAppTable(activeFilter ? activeFilter.dataset.appFilter : 'pending');
    closeAppDetail();
  } else {
    showToast('Update failed: ' + err.message, 'error');
  }
}
