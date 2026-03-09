/* ============================================================
   GACP LLC — config.js
   Supabase initialisation, constants, shared utilities
   ============================================================ */

// Supabase
const SUPABASE_URL = 'https://dbpgofivflbzjupwpegr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRicGdvZml2Zmxiemp1cHdwZWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODc4MzEsImV4cCI6MjA4ODU2MzgzMX0.jh1a1JLGE4jf9LsWdVHqHIwzbGYTDGcmtMdXV8e8kW0'; // Replace with actual anon key

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Roles
const ROLES = {
  PENDING:          'pending',
  CONSUMER:         'consumer',
  TRADE_RESTRICTED: 'trade-restricted',
  TRADE_FULL:       'trade-full',
  REJECTED:         'rejected',
};

// Tiers
const TIERS = {
  BRONZE:   { key: 'bronze',   label: 'Bronze',   discount: 0 },
  SILVER:   { key: 'silver',   label: 'Silver',   discount: 0.08 },
  GOLD:     { key: 'gold',     label: 'Gold',     discount: 0.15 },
  PLATINUM: { key: 'platinum', label: 'Platinum', discount: 0.22 },
};

function getTierDiscount(tierKey) {
  const t = Object.values(TIERS).find(t => t.key === tierKey);
  return t ? t.discount : 0;
}

// Categories
const CATEGORIES = [
  { key: 'tropical', label: 'Tropical Botanicals', color: 'var(--green)' },
  { key: 'ethno',    label: 'Ethno-Pharma',        color: 'var(--amber)' },
  { key: 'extract',  label: 'Standardised Extracts', color: 'var(--green)' },
  { key: 'isolate',  label: 'Isolates',            color: 'var(--terra)' },
  { key: 'oil',      label: 'Oils & Distillates',  color: 'var(--amber)' },
];

// Paths
const PATHS = {
  HOME:        '/',
  ABOUT:       '/about.html',
  LOGIN:       '/login.html',
  REGISTER:    '/register.html',
  DASHBOARD:   '/portal/dashboard.html',
  CATALOGUE:   '/portal/catalogue.html',
  CART:        '/portal/cart.html',
  COA:         '/portal/coa.html',
  FORMULATION: '/portal/formulation.html',
  PRICING:     '/portal/pricing.html',
  ADMIN:       '/admin.html',
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
