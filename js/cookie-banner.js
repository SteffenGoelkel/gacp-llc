/* ============================================================
   GACP LLC — cookie-banner.js
   Essential-site-technology notice. Dismissible, localStorage-backed.
   ============================================================ */

(function() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    if (localStorage.getItem('gacp_cookie_acknowledged')) return;
  } catch (_) {
    // localStorage may be unavailable (private mode, sandboxing) — bail silently.
    return;
  }

  function mount() {
    if (document.querySelector('.cookie-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie and site technology notice');
    banner.innerHTML = `
      <div class="cookie-banner__content">
        <p>We use essential site technologies, including IP-based location checks, to operate this site and enforce jurisdictional controls. We do not use advertising cookies or tracking pixels. For more information, see our <a href="/privacy.html">Privacy Policy</a>.</p>
        <button type="button" class="cookie-banner__btn" id="cookie-acknowledge">Understood</button>
      </div>
    `;
    document.body.appendChild(banner);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.add('cookie-banner--visible'));
    });

    document.getElementById('cookie-acknowledge').addEventListener('click', function() {
      try { localStorage.setItem('gacp_cookie_acknowledged', 'true'); } catch (_) {}
      banner.classList.remove('cookie-banner--visible');
      setTimeout(() => banner.remove(), 300);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
