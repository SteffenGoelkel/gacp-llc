/* ============================================================
   GACP LLC — nav.js
   Navigation rendering, scroll effects, mobile menu
   ============================================================ */

// --- Shared Navigation HTML --------------------------------

function getNavHTML(activePage = '') {
  const cached = getCachedProfile();
  const isLoggedIn = !!cached;
  const authLabel = isLoggedIn ? 'Portal' : 'Sign In';
  const authHref = isLoggedIn ? PATHS.DASHBOARD : PATHS.LOGIN;
  const logoutClass = isLoggedIn ? '' : ' hidden';

  return `
    <nav class="nav nav--transparent" id="main-nav">
      <div class="nav__inner">
        <a href="/" class="nav__logo">
          <img src="/images/logo.png" alt="GACP" width="72" height="72">
          <span>GACP</span>
        </a>

        <div class="nav__links">
          <a href="/" class="nav__link ${activePage === 'home' ? 'nav__link--active' : ''}">Home</a>
          <a href="/catalogue.html" class="nav__link ${activePage === 'catalogue' ? 'nav__link--active' : ''}">Catalogue</a>
          <a href="/quality.html" class="nav__link ${activePage === 'quality' ? 'nav__link--active' : ''}">Quality</a>
          <a href="/about.html" class="nav__link ${activePage === 'about' ? 'nav__link--active' : ''}">About</a>
          <a href="${authHref}" class="nav__cta" id="nav-auth-btn">${authLabel}</a>
          <a href="#" class="nav__link nav__logout${logoutClass}" id="nav-logout-btn">Sign Out</a>
        </div>

        <button class="nav__toggle" id="nav-toggle" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>

    <div class="nav__mobile" id="nav-mobile">
      <a href="/" class="nav__link ${activePage === 'home' ? 'nav__link--active' : ''}">Home</a>
      <a href="/catalogue.html" class="nav__link ${activePage === 'catalogue' ? 'nav__link--active' : ''}">Catalogue</a>
      <a href="/about.html" class="nav__link ${activePage === 'about' ? 'nav__link--active' : ''}">About</a>
      <a href="${authHref}" class="nav__cta" id="nav-auth-btn-mobile">${authLabel}</a>
      <a href="#" class="nav__link nav__logout${logoutClass}" id="nav-logout-btn-mobile">Sign Out</a>
    </div>
  `;
}

// --- Shared Footer HTML ------------------------------------

function getFooterHTML() {
  const year = new Date().getFullYear();
  const email = 'info' + '@' + 'gacp.llc';
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer__grid">
          <div class="footer__brand">
            <div class="footer__brand-logo">
              <img src="/images/logo.png" alt="GACP" width="32" height="32">
              <span>GACP LLC</span>
            </div>
            <p>US-based wholesale botanical ingredients — sourced at origin, refined in the lab, delivered with full traceability.</p>
          </div>
          <div>
            <h4 class="footer__col-heading">Products</h4>
            <a href="/how-to-order.html" class="footer__link">How to Order</a>
            <a href="/catalogue.html" class="footer__link">Browse Catalogue</a>
            <a href="/catalogue.html#tropical" class="footer__link">Tropical Botanicals</a>
            <a href="/catalogue.html#ethno" class="footer__link">Ethno-Pharma</a>
            <a href="/catalogue.html#extract" class="footer__link">Standardised Extracts</a>
            <a href="/catalogue.html#isolate" class="footer__link">Isolates</a>
            <a href="/catalogue.html#oil" class="footer__link">Oils &amp; Distillates</a>
          </div>
          <div>
            <h4 class="footer__col-heading">Legal</h4>
            <a href="/terms.html" class="footer__link">Terms of Service</a>
            <a href="/terms-of-sale.html" class="footer__link">Terms of Sale</a>
            <a href="/privacy.html" class="footer__link">Privacy Policy</a>
            <a href="/refund-policy.html" class="footer__link">Refund &amp; Returns</a>
          </div>
          <div>
            <h4 class="footer__col-heading">Company</h4>
            <a href="/about.html" class="footer__link">About Us</a>
            <a href="/product-disclaimer.html" class="footer__link">Product Disclaimer</a>
            <a href="/restricted-products.html" class="footer__link">Restricted Products</a>
            <a href="/compliance.html" class="footer__link">Quality &amp; Controlled Access</a>
            <a href="/quality-assurance.html" class="footer__link">Quality Assurance &amp; CoA</a>
            <a href="/accessibility.html" class="footer__link">Accessibility</a>
          </div>
          <div>
            <h4 class="footer__col-heading">Contact</h4>
            <!--email_off--><a href="mailto:${email}" class="footer__link">${email}</a><!--email_on-->
            <a href="/contact.html" class="footer__link">Contact Form</a>
            <a href="/portal/coa.html" class="footer__link">CoA Library</a>
            <a href="/register.html" class="footer__link">Apply for Trade Account</a>
          </div>
        </div>
        <div class="footer__disclaimer">
          <p>Products sold by GACP LLC are raw materials and ingredients intended for use by qualified trade buyers in manufacturing, formulation, or research. Products are not sold as finished dietary supplements or consumer goods. Statements on this website have not been evaluated by the Food and Drug Administration. Products are not intended to diagnose, treat, cure, or prevent any disease.</p>
        </div>
        <div class="footer__bottom">
          <span class="footer__copy">&copy; ${year} GACP LLC. All rights reserved.</span>
          <div class="footer__legal-links">
            <a href="/privacy.html">Privacy</a>
            <a href="/terms.html">Terms</a>
            <a href="/accessibility.html">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

// --- Inject Nav & Footer -----------------------------------

function injectNav(activePage) {
  const navSlot = document.getElementById('nav-slot');
  if (navSlot) navSlot.innerHTML = getNavHTML(activePage);
}

function injectFooter() {
  const footerSlot = document.getElementById('footer-slot');
  if (footerSlot) footerSlot.innerHTML = getFooterHTML();
}

// --- Scroll Effects ----------------------------------------

function initNavScroll() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  const onScroll = () => {
    if (window.scrollY > 40) {
      nav.classList.remove('nav--transparent');
      nav.classList.add('nav--solid');
    } else {
      nav.classList.add('nav--transparent');
      nav.classList.remove('nav--solid');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // Initial check
}

/** For pages that should always have a solid nav (portal, login, etc.) */
function setNavSolid() {
  const nav = document.getElementById('main-nav');
  if (nav) {
    nav.classList.remove('nav--transparent');
    nav.classList.add('nav--solid');
  }
}

// --- Mobile Menu -------------------------------------------

function initMobileMenu() {
  const toggle = document.getElementById('nav-toggle');
  const mobile = document.getElementById('nav-mobile');
  if (!toggle || !mobile) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    mobile.classList.toggle('open');
    document.body.style.overflow = mobile.classList.contains('open') ? 'hidden' : '';
  });

  // Close on link click
  mobile.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      mobile.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// --- Update Auth Button State ------------------------------

async function updateNavAuthState() {
  const session = await getSession();
  const btns = document.querySelectorAll('#nav-auth-btn, #nav-auth-btn-mobile');
  const logoutBtns = document.querySelectorAll('#nav-logout-btn, #nav-logout-btn-mobile');

  btns.forEach(btn => {
    if (session) {
      btn.textContent = 'Portal';
      btn.href = PATHS.DASHBOARD;
    } else {
      btn.textContent = 'Sign In';
      btn.href = PATHS.LOGIN;
    }
  });

  logoutBtns.forEach(btn => {
    if (session) {
      btn.classList.remove('hidden');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    } else {
      btn.classList.add('hidden');
    }
  });
}

// --- Init (called from each page) --------------------------

function initNavigation(activePage, solidNav = false) {
  injectNav(activePage);
  injectFooter();

  if (solidNav) {
    setNavSolid();
  } else {
    initNavScroll();
  }

  initMobileMenu();
  updateNavAuthState();
  initFadeObserver();
}
