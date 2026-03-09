/* ============================================================
   GACP LLC — nav.js
   Navigation rendering, scroll effects, mobile menu
   ============================================================ */

// --- Shared Navigation HTML --------------------------------

function getNavHTML(activePage = '') {
  return `
    <nav class="nav nav--transparent" id="main-nav">
      <div class="nav__inner">
        <a href="/" class="nav__logo">
          <img src="/images/logo.png" alt="GACP" width="72" height="72">
          <span>GACP</span>
        </a>

        <div class="nav__links">
          <a href="/" class="nav__link ${activePage === 'home' ? 'nav__link--active' : ''}">Home</a>
          <a href="/about.html" class="nav__link ${activePage === 'about' ? 'nav__link--active' : ''}">About</a>
          <a href="/portal/catalogue.html" class="nav__link ${activePage === 'catalogue' ? 'nav__link--active' : ''}">Products</a>
          <a href="/login.html" class="nav__cta" id="nav-auth-btn">Sign In</a>
        </div>

        <button class="nav__toggle" id="nav-toggle" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>

    <div class="nav__mobile" id="nav-mobile">
      <a href="/" class="nav__link ${activePage === 'home' ? 'nav__link--active' : ''}">Home</a>
      <a href="/about.html" class="nav__link ${activePage === 'about' ? 'nav__link--active' : ''}">About</a>
      <a href="/portal/catalogue.html" class="nav__link ${activePage === 'catalogue' ? 'nav__link--active' : ''}">Products</a>
      <a href="/login.html" class="nav__cta" id="nav-auth-btn-mobile">Sign In</a>
    </div>
  `;
}

// --- Shared Footer HTML ------------------------------------

function getFooterHTML() {
  const year = new Date().getFullYear();
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer__grid">
          <div class="footer__brand">
            <div class="footer__brand-logo">
              <img src="/images/logo.png" alt="GACP" width="32" height="32">
              <span>GACP LLC</span>
            </div>
            <p>Precision botanicals sourced at origin, refined in the lab, and delivered with full traceability.</p>
          </div>
          <div>
            <h4 class="footer__col-heading">Company</h4>
            <a href="/about.html" class="footer__link">About Us</a>
            <a href="/portal/catalogue.html" class="footer__link">Products</a>
            <a href="/portal/coa.html" class="footer__link">CoA Library</a>
          </div>
          <div>
            <h4 class="footer__col-heading">Trade</h4>
            <a href="/portal/pricing.html" class="footer__link">Bulk Pricing</a>
            <a href="/portal/formulation.html" class="footer__link">Custom Formulation</a>
            <a href="/register.html" class="footer__link">Apply for Trade Account</a>
          </div>
          <div>
            <h4 class="footer__col-heading">Contact</h4>
            <a href="/contact.html" class="footer__link">Get in Touch</a>
          </div>
        </div>
        <div class="footer__bottom">
          <span class="footer__copy">&copy; ${year} GACP LLC. All rights reserved.</span>
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

  btns.forEach(btn => {
    if (session) {
      btn.textContent = 'Portal';
      btn.href = PATHS.DASHBOARD;
    } else {
      btn.textContent = 'Sign In';
      btn.href = PATHS.LOGIN;
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
