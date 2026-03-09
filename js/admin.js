/* ============================================================
   GACP LLC — admin.js
   Admin panel: review pending applications, approve/reject
   ============================================================ */

async function initAdmin() {
  const container = document.getElementById('admin-container');
  if (!container) return;

  // For demo: load all pending profiles
  // In production: this would require admin role check + service role key
  const { data: profiles, error } = await _sb
    .from('profiles')
    .select('*')
    .eq('role', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="text-dim">Unable to load applications. Admin access required.</p>`;
    return;
  }

  if (!profiles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3 class="empty-state__title">No pending applications</h3>
        <p class="empty-state__text">All applications have been reviewed.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Email</th>
            <th>Type</th>
            <th>Company</th>
            <th>Country</th>
            <th>IP Match</th>
            <th>Actions</th>
          </tr>
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
      <td>
        ${p.location_match === true ? '<span class="badge badge--green">Match</span>' :
          p.location_match === false ? '<span class="badge badge--terra">Mismatch</span>' :
          '<span class="badge badge--neutral">N/A</span>'}
      </td>
      <td>
        <div class="flex gap-sm">
          <button class="btn btn--sm btn--primary" data-approve="${p.id}">Approve</button>
          <button class="btn btn--sm btn--secondary" data-detail="${p.id}">Detail</button>
          <button class="btn btn--sm btn--ghost" data-reject="${p.id}" style="color:var(--terra)">Reject</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Event delegation
  tbody.addEventListener('click', async (e) => {
    const approveBtn = e.target.closest('[data-approve]');
    const rejectBtn = e.target.closest('[data-reject]');
    const detailBtn = e.target.closest('[data-detail]');

    if (approveBtn) {
      const id = approveBtn.dataset.approve;
      await setApplicationRole(id, 'consumer');
      approveBtn.closest('tr').remove();
      showToast('Application approved', 'success');
    }

    if (rejectBtn) {
      const id = rejectBtn.dataset.reject;
      if (confirm('Reject this application?')) {
        await setApplicationRole(id, 'rejected');
        rejectBtn.closest('tr').remove();
        showToast('Application rejected', 'info');
      }
    }

    if (detailBtn) {
      const id = detailBtn.dataset.detail;
      const p = profiles.find(x => x.id === id);
      if (p) showApplicationDetail(p);
    }
  });
}

async function setApplicationRole(userId, role) {
  const { error } = await _sb
    .from('profiles')
    .update({
      role,
      approved_at: new Date().toISOString(),
      approved_by: 'admin',
    })
    .eq('id', userId);

  if (error) {
    showToast('Failed to update: ' + error.message, 'error');
  }
}

function showApplicationDetail(profile) {
  const overlay = document.getElementById('admin-overlay');
  if (!overlay) return;

  const panel = overlay.querySelector('.overlay__panel');
  panel.innerHTML = `
    <h3 style="margin-bottom:var(--sp-lg)">Application Detail</h3>
    <div class="grid grid-2 gap-lg" style="font-size:var(--fs-sm)">
      ${[
        ['Name', (profile.first_name || '') + ' ' + (profile.last_name || '')],
        ['Email', profile.email],
        ['Phone', profile.phone],
        ['Account Type', profile.account_type],
        ['Company', profile.company],
        ['Corp Number', profile.corp_num],
        ['VAT', profile.vat],
        ['Website', profile.website],
        ['Address', [profile.addr1, profile.addr2, profile.city, profile.state, profile.zip, profile.country].filter(Boolean).join(', ')],
        ['Business Category', profile.biz_category],
        ['Intended Use', profile.intended_use],
        ['IP Address', profile.ip_address],
        ['IP Location', (profile.ip_city || '') + ', ' + (profile.ip_country || '')],
        ['IP Org', profile.ip_org],
        ['Location Match', profile.location_match === true ? 'Yes' : profile.location_match === false ? 'No' : 'N/A'],
        ['Applied', new Date(profile.created_at).toLocaleString()],
      ].map(([label, val]) => `
        <div>
          <div class="text-muted text-xs" style="text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">${label}</div>
          <div class="text-cream">${escapeHtml(val || '—')}</div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:var(--sp-xl);display:flex;gap:var(--sp-md)">
      <button class="btn btn--primary" onclick="setApplicationRole('${profile.id}','consumer').then(()=>{closeOverlay();initAdmin();})">Approve as Consumer</button>
      <button class="btn btn--secondary" onclick="setApplicationRole('${profile.id}','trade-restricted').then(()=>{closeOverlay();initAdmin();})">Approve as Trade</button>
      <button class="btn btn--ghost" onclick="closeOverlay()">Close</button>
    </div>
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
