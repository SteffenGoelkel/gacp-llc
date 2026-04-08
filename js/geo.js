/* ============================================================
   GACP LLC — geo.js
   Location detection for product-level filtering
   No site-wide blocking — restrictions applied per product
   ============================================================ */

const GEO_KEY = 'gacp_geo';

const GEO_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Get cached location or return null (expires after TTL) */
function getGeoLocation() {
  const raw = sessionStorage.getItem(GEO_KEY);
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw);
    if (cached._ts && Date.now() - cached._ts > GEO_TTL_MS) {
      sessionStorage.removeItem(GEO_KEY);
      return null;
    }
    return cached;
  } catch {
    sessionStorage.removeItem(GEO_KEY);
    return null;
  }
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
      _ts: Date.now(),
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

  // Display city + country name. Use Intl API to resolve ISO code to full name.
  // Avoids showing region (e.g. "England") which is confusing for non-US locations.
  let countryName = geo.country;
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    countryName = displayNames.of(geo.country) || geo.country;
  } catch { /* fallback to ISO code */ }
  const location = [geo.city, countryName].filter(Boolean).join(', ');
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

// Detect on page load and show international banner if non-US
document.addEventListener('DOMContentLoaded', async () => {
  const geo = await detectLocation();
  if (geo && geo.country && geo.country !== 'US') {
    window.GACP_GEO = 'international';
    const banner = document.createElement('div');
    banner.className = 'geo-banner';
    banner.innerHTML = 'GACP currently serves US-based businesses. International enquiries welcome — <a href="mailto:' + 'info' + '@' + 'gacp.llc' + '">contact us</a>' +
      '<button class="geo-banner__close" aria-label="Dismiss">&times;</button>';
    // Insert before .page so CSS sibling selector (.geo-banner + .page) works
    const page = document.querySelector('.page');
    if (page) {
      page.parentNode.insertBefore(banner, page);
    } else {
      document.body.prepend(banner);
    }
    // Set CSS variable for banner height so nav + content offset correctly
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--geo-banner-h', banner.offsetHeight + 'px');
    });
    // Dismiss handler
    banner.querySelector('.geo-banner__close').addEventListener('click', () => {
      banner.remove();
      document.documentElement.style.setProperty('--geo-banner-h', '0px');
    });
  }
});
