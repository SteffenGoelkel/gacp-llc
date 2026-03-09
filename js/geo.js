/* ============================================================
   GACP LLC — geo.js
   Location detection for product-level filtering
   No site-wide blocking — restrictions applied per product
   ============================================================ */

const GEO_KEY = 'gacp_geo';

/** Get cached location or return null */
function getGeoLocation() {
  const raw = sessionStorage.getItem(GEO_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Detect visitor location via Cloudflare Pages Function */
async function detectLocation() {
  const cached = getGeoLocation();
  if (cached) return cached;

  try {
    const res = await fetch('/api/geo');
    const data = await res.json();

    const geo = {
      country: data.country || '',
      city: data.city || '',
      region: data.region || '',
      ip: data.ip || '',
      org: data.org || '',
    };

    sessionStorage.setItem(GEO_KEY, JSON.stringify(geo));
    return geo;
  } catch (err) {
    console.warn('Location detection failed:', err);
    return null;
  }
}

/** Render location banner */
function renderLocationBanner(containerId) {
  const geo = getGeoLocation();
  if (!geo || !geo.country) return;

  const el = document.getElementById(containerId);
  if (!el) return;

  const location = [geo.city, geo.region, geo.country].filter(Boolean).join(', ');
  el.innerHTML = `
    <div class="location-banner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <span>Browsing from: ${escapeHtml(location)}</span>
    </div>
  `;
}

// Detect on page load
document.addEventListener('DOMContentLoaded', () => {
  detectLocation();
});
