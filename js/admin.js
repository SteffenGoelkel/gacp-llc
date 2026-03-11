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

  if (profile.role !== 'trade-full' && profile.role !== 'admin') {
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
  initCoaAdmin();

  document.getElementById('btn-add-product').addEventListener('click', () => showProductForm(null));
  document.getElementById('btn-cancel-form').addEventListener('click', hideProductForm);
  document.getElementById('btn-add-compound-main').addEventListener('click', addCompoundRow);
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
  document.getElementById('compounds-list-main').innerHTML = '';
  document.getElementById('pf-img').value = '';
  document.getElementById('pf-img-status').textContent = '';
  document.getElementById('pf-sample').checked = false;
  document.getElementById('sample-fields').classList.add('hidden');

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

    // Sourcing fields
    document.getElementById('pf-src-supplier').value = product.source_supplier || '';
    document.getElementById('pf-src-country').value = product.source_country || '';
    document.getElementById('pf-src-region').value = product.source_region || '';
    document.getElementById('pf-src-facility').value = product.source_facility || '';
    document.getElementById('pf-src-certs').value = product.source_certifications || '';
    document.getElementById('pf-src-contact').value = product.source_contact || '';
    document.getElementById('pf-src-notes').value = product.source_notes || '';

    // Sample fields
    document.getElementById('pf-sample').checked = product.sample_available === true;
    document.getElementById('sample-fields').classList.toggle('hidden', !product.sample_available);
    document.getElementById('pf-sample-price').value = product.sample_price || '';
    document.getElementById('pf-sample-unit').value = product.sample_unit || '10g';

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
    }

    // Load compounds (available for all products)
    var compounds = getProductCompounds(product.id);
    compounds.forEach(function(c) { addCompoundRow(null, c.compound, c.pct); });
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
  var list = document.getElementById('compounds-list-main');
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
      source_supplier: document.getElementById('pf-src-supplier').value || null,
      source_country: document.getElementById('pf-src-country').value || null,
      source_region: document.getElementById('pf-src-region').value || null,
      source_facility: document.getElementById('pf-src-facility').value || null,
      source_certifications: document.getElementById('pf-src-certs').value || null,
      source_contact: document.getElementById('pf-src-contact').value || null,
      source_notes: document.getElementById('pf-src-notes').value || null,
      sample_available: document.getElementById('pf-sample').checked,
      sample_price: parseInt(document.getElementById('pf-sample-price').value) || 0,
      sample_unit: document.getElementById('pf-sample-unit').value || '10g',
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

    // Save compounds (available for all products)
    await _sb.from('product_compounds').delete().eq('product_id', productId);
    var rows = document.querySelectorAll('#compounds-list-main .compound-row');
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
    .in('role', ['pending', 'consumer', 'trade-restricted', 'trade-full', 'admin', 'rejected'])
    .order('created_at', { ascending: false });

  if (result.error) {
    container.innerHTML = '<p class="text-dim">Unable to load applications.</p>';
    return;
  }

  appProfiles = result.data || [];
  var pending = appProfiles.filter(function(p) { return p.role === 'pending'; });
  var rejected = appProfiles.filter(function(p) { return p.role === 'rejected'; });

  if (!appProfiles.length) {
    container.innerHTML = '<div class="empty-state"><h3 class="empty-state__title">No applications</h3></div>';
    return;
  }

  container.innerHTML =
    '<div style="display:flex;gap:var(--sp-md);margin-bottom:var(--sp-lg)">' +
      '<button class="filter-btn filter-btn--active" data-app-filter="pending">Pending (' + pending.length + ')</button>' +
      '<button class="filter-btn" data-app-filter="rejected">Rejected (' + rejected.length + ')</button>' +
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
    var reopenBtn = e.target.closest('[data-reopen]');

    if (detailBtn) {
      var p = appProfiles.find(function(x) { return x.id === detailBtn.dataset.detail; });
      if (p) showAppDetail(p);
    }
    if (approveBtn) await setAppRole(approveBtn.dataset.approve, 'consumer');
    if (rejectBtn) {
      if (!confirm('Reject this application?')) return;
      await setAppRole(rejectBtn.dataset.reject, 'rejected');
    }
    if (reopenBtn) {
      await setAppRole(reopenBtn.dataset.reopen, 'pending');
      showToast('Application re-opened for review', 'info');
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
      admin: '<span class="badge badge--green">Admin</span>',
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
        (p.role === 'rejected' ?
          '<button class="btn btn--sm btn--amber" data-reopen="' + p.id + '">Re-open</button>'
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
    if (p) {
      p.role = role;
      // Send notification email
      sendApplicationNotification(p, role);
    }
    var activeFilter = document.querySelector('[data-app-filter].filter-btn--active');
    renderAppTable(activeFilter ? activeFilter.dataset.appFilter : 'pending');
    showToast(role === 'rejected' ? 'Application rejected' : 'Application approved', role === 'rejected' ? 'info' : 'success');
  }
}

async function sendApplicationNotification(profile, role) {
  var name = (profile.first_name || '').trim() || 'there';
  var email = profile.email;
  if (!email) return;

  var subject, message;

  if (role === 'rejected') {
    subject = 'GACP LLC — Application Update';
    message = 'Dear ' + name + ',\n\n' +
      'Thank you for your interest in GACP LLC.\n\n' +
      'After reviewing your application, we are unable to approve your account at this time. ' +
      'If you believe this is in error or would like to provide additional information, ' +
      'please reply to this email or contact us through our website.\n\n' +
      'Kind regards,\nGACP LLC';
  } else {
    var roleLabel = {
      consumer: 'Consumer',
      'trade-restricted': 'Trade',
      'trade-full': 'Trade (Full Access)',
      admin: 'Admin',
    }[role] || role;

    subject = 'GACP LLC — Account Approved';
    message = 'Dear ' + name + ',\n\n' +
      'Your GACP LLC account has been approved. You now have ' + roleLabel + ' access.\n\n' +
      'You can sign in to your portal at:\nhttps://gacp.llc/login.html\n\n' +
      'From your portal you can browse our product catalogue, view documentation, ' +
      'and place enquiries.\n\n' +
      'If you have any questions, please don\'t hesitate to contact us.\n\n' +
      'Kind regards,\nGACP LLC';
  }

  try {
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'GACP LLC',
        email: 'info@gacp.llc',
        to: email,
        to_name: name,
        subject: subject,
        message: message,
      }),
    });
  } catch (e) {
    console.error('Notification email failed:', e);
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
          '<option value="admin">Admin</option>' +
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

// --- CoA Library Admin -------------------------------------

let allCoas = [];

function initCoaAdmin() {
  // Show upload form
  document.getElementById('btn-upload-coa').addEventListener('click', function() {
    var form = document.getElementById('coa-upload-form');
    form.classList.toggle('hidden');

    // Populate product dropdown
    var select = document.getElementById('coa-product');
    select.innerHTML = '<option value="">Select product…</option>' +
      PRODUCTS.map(function(p) {
        return '<option value="' + p.id + '">' + escapeHtml(p.name) + ' (' + p.id + ')</option>';
      }).join('');
  });

  // Save CoA
  document.getElementById('btn-save-coa').addEventListener('click', handleCoaUpload);

  // Load existing CoAs
  loadCoaList();
}

async function loadCoaList() {
  var listEl = document.getElementById('coa-admin-list');
  var countEl = document.getElementById('coa-count');

  var result = await _sb.from('product_coas').select('*').order('uploaded_at', { ascending: false });

  if (result.error) {
    listEl.innerHTML = '<p class="text-dim">Unable to load CoAs.</p>';
    return;
  }

  allCoas = result.data || [];
  if (countEl) countEl.textContent = allCoas.length + ' certificates';

  if (!allCoas.length) {
    listEl.innerHTML = '<div class="empty-state"><p class="text-sm text-dim">No certificates uploaded yet.</p></div>';
    return;
  }

  listEl.innerHTML =
    '<div class="product-list-item product-list-header" style="grid-template-columns:1fr 1fr 120px 100px 100px"><span>Product</span><span>Batch</span><span>Test Date</span><span>Notes</span><span>Actions</span></div>' +
    allCoas.map(function(coa) {
      var product = PRODUCTS.find(function(p) { return p.id === coa.product_id; });
      var productName = product ? product.name : coa.product_id;
      var testDate = coa.tested_date ? new Date(coa.tested_date).toLocaleDateString() : '—';

      return '<div class="product-list-item" style="grid-template-columns:1fr 1fr 120px 100px 100px">' +
        '<div><strong style="color:var(--cream)">' + escapeHtml(productName) + '</strong><br><span class="text-xs text-dim">' + escapeHtml(coa.product_id) + '</span></div>' +
        '<span>' + escapeHtml(coa.batch_number) + '</span>' +
        '<span class="text-sm">' + testDate + '</span>' +
        '<span class="text-xs text-dim">' + escapeHtml(coa.notes || '—') + '</span>' +
        '<div style="display:flex;gap:var(--sp-xs)">' +
          '<a href="' + coa.file_url + '" target="_blank" class="btn btn--sm btn--secondary">View</a>' +
          '<button class="btn btn--sm btn--ghost" style="color:var(--terra)" onclick="deleteCoa(' + coa.id + ')">Del</button>' +
        '</div></div>';
    }).join('');
}

async function handleCoaUpload() {
  var productId = document.getElementById('coa-product').value;
  var batch = document.getElementById('coa-batch').value.trim();
  var file = document.getElementById('coa-file').files[0];
  var testDate = document.getElementById('coa-date').value || null;
  var notes = document.getElementById('coa-notes').value || null;

  if (!productId || !batch || !file) {
    showToast('Please fill in product, batch number, and file.', 'error');
    return;
  }

  var btn = document.getElementById('btn-save-coa');
  btn.disabled = true;
  btn.textContent = 'Uploading…';

  try {
    // Upload PDF to storage
    var path = 'coa/' + productId + '/' + batch.replace(/[^a-zA-Z0-9\-_]/g, '_') + '.pdf';

    // Delete existing file if any
    await _sb.storage.from('coa-documents').remove([path]);

    var uploadResult = await _sb.storage.from('coa-documents').upload(path, file, { contentType: 'application/pdf' });
    if (uploadResult.error) throw uploadResult.error;

    var urlResult = _sb.storage.from('coa-documents').getPublicUrl(path);
    var fileUrl = urlResult.data.publicUrl;

    // Save record
    var insertResult = await _sb.from('product_coas').insert({
      product_id: productId,
      batch_number: batch,
      file_url: fileUrl,
      file_name: file.name,
      tested_date: testDate,
      notes: notes,
    });

    if (insertResult.error) throw insertResult.error;

    showToast('CoA uploaded successfully', 'success');
    document.getElementById('coa-upload-form').classList.add('hidden');
    document.getElementById('coa-product').value = '';
    document.getElementById('coa-batch').value = '';
    document.getElementById('coa-file').value = '';
    document.getElementById('coa-date').value = '';
    document.getElementById('coa-notes').value = '';

    await loadCoaList();
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload & Save';
  }
}

async function deleteCoa(coaId) {
  if (!confirm('Delete this certificate? This cannot be undone.')) return;

  try {
    var coa = allCoas.find(function(c) { return c.id === coaId; });

    // Delete from storage
    if (coa && coa.file_url) {
      var path = coa.file_url.split('/coa-documents/')[1];
      if (path) await _sb.storage.from('coa-documents').remove([path]);
    }

    // Delete record
    var err = (await _sb.from('product_coas').delete().eq('id', coaId)).error;
    if (err) throw err;

    showToast('CoA deleted', 'info');
    await loadCoaList();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}
