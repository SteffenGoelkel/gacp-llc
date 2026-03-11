/* ============================================================
   GACP LLC — portal.js
   Portal navigation, dashboard initialisation
   ============================================================ */

// --- Portal Sidebar HTML -----------------------------------

function getPortalSidebarHTML(activePage = '', profile = null) {
  const links = [
    { href: PATHS.DASHBOARD,   label: 'Dashboard',     icon: 'grid',    key: 'dashboard' },
    { href: PATHS.CATALOGUE,   label: 'Catalogue',     icon: 'package', key: 'catalogue' },
    { href: PATHS.CART,        label: 'Cart',          icon: 'cart',    key: 'cart' },
    { href: PATHS.COA,         label: 'CoA Library',   icon: 'file',    key: 'coa' },
    { href: PATHS.FORMULATION, label: 'Formulation',   icon: 'flask',   key: 'formulation' },
    { href: PATHS.PRICING,     label: 'Bulk Pricing',  icon: 'tag',     key: 'pricing' },
  ];

  // Only show admin link to admin users
  if (profile && profile.role === 'admin') {
    links.push({ href: PATHS.ADMIN, label: 'Admin', icon: 'shield', key: 'admin' });
  }

  const icons = {
    grid:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>',
    cart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
    file:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    flask:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6M10 3v6.5L4 20h16L14 9.5V3"/></svg>',
    tag:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    shield:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  };

  return `
    <aside class="portal-sidebar">
      <div class="portal-sidebar__section">
        <div class="portal-sidebar__heading">Navigation</div>
        ${links.map(l => `
          <a href="${l.href}" class="portal-sidebar__link ${activePage === l.key ? 'portal-sidebar__link--active' : ''}">
            ${icons[l.icon]}
            <span>${l.label}</span>
            ${l.key === 'cart' ? '<span class="cart-badge badge badge--green hidden" style="margin-left:auto"></span>' : ''}
          </a>
        `).join('')}
      </div>
      <div class="portal-sidebar__section">
        <div class="portal-sidebar__heading">Account</div>
        <a href="#" class="portal-sidebar__link" id="portal-logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          <span>Sign Out</span>
        </a>
      </div>
    </aside>
  `;
}

// --- Init Portal Layout ------------------------------------

function initPortalLayout(activePage) {
  renderPortalSidebar(activePage);
  updateCartBadge();
}

function renderPortalSidebar(activePage) {
  const sidebarSlot = document.getElementById('portal-sidebar-slot');
  if (sidebarSlot) {
    const profile = getCachedProfile();
    sidebarSlot.innerHTML = getPortalSidebarHTML(activePage, profile);

    const logoutBtn = document.getElementById('portal-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    }
  }
}

/** Call after requireAuth to update sidebar with profile data */
function refreshPortalSidebar(activePage) {
  renderPortalSidebar(activePage);
  updateCartBadge();
}

// --- Dashboard Init ----------------------------------------

async function initDashboard() {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  refreshPortalSidebar('dashboard');
  await loadProducts();

  // Greeting
  const greetingEl = document.getElementById('dash-greeting');
  if (greetingEl) {
    const name = profile.first_name || profile.email?.split('@')[0] || 'there';
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    greetingEl.textContent = `${greeting}, ${name}`;
  }

  // Role badge
  const roleBadge = document.getElementById('dash-role');
  if (roleBadge) {
    const roleLabels = {
      pending: 'Pending Review',
      consumer: 'Consumer',
      'trade-restricted': 'Trade',
      'trade-full': 'Trade (Full)',
      admin: 'Admin',
      rejected: 'Application Rejected',
    };
    const roleColors = {
      pending: 'amber',
      consumer: 'green',
      'trade-restricted': 'green',
      'trade-full': 'green',
      admin: 'green',
      rejected: 'terra',
    };
    roleBadge.className = `badge badge--dot badge--${roleColors[profile.role] || 'neutral'}`;
    roleBadge.textContent = roleLabels[profile.role] || profile.role;
  }

  // Account details grid
  const accountEl = document.getElementById('account-details');
  if (accountEl) {
    const tierLabel = (profile.tier || 'bronze').charAt(0).toUpperCase() + (profile.tier || 'bronze').slice(1);
    const discount = (getTierDiscount(profile.tier) * 100).toFixed(0) + '%';
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '—';
    const address = [profile.addr1, profile.city, profile.state, profile.zip, profile.country].filter(Boolean).join(', ') || '—';
    const memberSince = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

    const fields = [
      ['Email', profile.email || '—'],
      ['Name', fullName],
      ['Phone', profile.phone || '—'],
      ['Account Type', (profile.account_type || 'individual').charAt(0).toUpperCase() + (profile.account_type || 'individual').slice(1)],
      ['Company', profile.company || '—'],
      ['Address', address],
      ['Tier', tierLabel],
      ['Discount', discount],
      ['Member Since', memberSince],
    ];

    accountEl.innerHTML = fields.map(([label, value]) => `
      <div class="account-field">
        <div class="account-field__label">${label}</div>
        <div class="account-field__value">${escapeHtml(String(value))}</div>
      </div>
    `).join('');
  }

  // Stats
  const statsMap = {
    'stat-products': PRODUCTS.length,
    'stat-cart': getCartCount(),
    'stat-tier': (profile.tier || 'bronze').charAt(0).toUpperCase() + (profile.tier || 'bronze').slice(1),
    'stat-discount': (getTierDiscount(profile.tier) * 100).toFixed(0) + '%',
  };

  Object.entries(statsMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });

  // Pending notice
  if (profile.role === ROLES.PENDING) {
    const notice = document.getElementById('pending-notice');
    if (notice) notice.classList.remove('hidden');
  }
}
