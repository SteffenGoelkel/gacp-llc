/* ============================================================
   GACP LLC — config.js
   Supabase initialisation, constants, shared utilities
   ============================================================ */

// Supabase
const SUPABASE_URL = 'https://dbpgofivflbzjupwpegr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRicGdvZml2Zmxiemp1cHdwZWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODc4MzEsImV4cCI6MjA4ODU2MzgzMX0.jh1a1JLGE4jf9LsWdVHqHIwzbGYTDGcmtMdXV8e8kW0'; // Replace with actual anon key

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SITE_ID = 'gacp';

// Roles
const ROLES = {
  PENDING:          'pending',
  CONSUMER:         'consumer',
  TRADE_RESTRICTED: 'trade-restricted',
  TRADE_FULL:       'trade-full',
  ADMIN:            'admin',
  REJECTED:         'rejected',
};

// Tiers
// Fetch the calling user's tier + pct from /api/my-tier-discount, cached
// for the page lifetime. Source of truth is the tier_discounts table
// (RLS-locked, read via service_role inside the Pages Function). On any
// failure: { tier: null, pct: 0 } — never throws, never reads stale state.
// Concurrent first-callers share one in-flight promise.
let _myTierPromise = null;
async function fetchMyTier() {
  if (_myTierPromise !== null) return _myTierPromise;
  _myTierPromise = (async () => {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session) return { tier: null, pct: 0 };
      const r = await fetch('/api/my-tier-discount', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!r.ok) return { tier: null, pct: 0 };
      const body = await r.json();
      const tier = typeof body.tier === 'string' ? body.tier : null;
      const pct  = Number(body.pct);
      if (!tier || !Number.isFinite(pct)) return { tier: null, pct: 0 };
      return { tier, pct };
    } catch (_) {
      return { tier: null, pct: 0 };
    }
  })();
  return _myTierPromise;
}

// Categories
const CATEGORIES = [
  { key: 'tropical', label: 'Tropical Botanicals', color: 'var(--green)' },
  { key: 'ethno',    label: 'Ethno-Pharma',        color: 'var(--amber)' },
  { key: 'extract',  label: 'Standardised Extracts', color: 'var(--green)' },
  { key: 'isolate',  label: 'Isolates',            color: 'var(--terra)' },
  { key: 'oil',      label: 'Oils & Distillates',  color: 'var(--amber)' },
  { key: 'superfood', label: 'Superfoods',         color: 'var(--berry)' },
];

// Paths
const PATHS = {
  HOME:         '/',
  ABOUT:        '/about.html',
  LOGIN:        '/login.html',
  REGISTER:     '/register.html',
  HOW_TO_ORDER: '/how-to-order.html',
  DASHBOARD:    '/portal/dashboard.html',
  CATALOGUE:    '/portal/catalogue.html',
  CART:         '/portal/cart.html',
  COA:          '/portal/coa.html',
  FORMULATION:  '/portal/formulation.html',
  PRICING:      '/portal/pricing.html',
  PROFILE:      '/portal/profile.html',
  ADMIN:        '/admin.html',
};

// --- Utility helpers ----------------------------------------

/** Show a toast notification */
function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/** Format currency */
function formatPrice(cents) {
  return '$' + (cents / 100).toFixed(2);
}

/** Sanitise HTML */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Simple debounce */
function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Intersection Observer for fade-in animations */
function initFadeObserver() {
  document.body.classList.add('js-ready');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}
