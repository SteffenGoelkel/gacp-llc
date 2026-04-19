/* ============================================================
   GACP LLC — auth.js
   Authentication: login, register, session, logout, guards
   ============================================================ */

// --- Session management ------------------------------------

async function getSession() {
  const { data: { session }, error } = await _sb.auth.getSession();
  if (error) { console.error('Session error:', error); return null; }
  return session;
}

async function getProfile(userId) {
  const { data, error } = await _sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) { console.error('Profile fetch error:', error); return null; }
  return data;
}

function cacheProfile(profile) {
  sessionStorage.setItem('gacp_profile', JSON.stringify(profile));
}

function getCachedProfile() {
  const raw = sessionStorage.getItem('gacp_profile');
  return raw ? JSON.parse(raw) : null;
}

function clearCachedProfile() {
  sessionStorage.removeItem('gacp_profile');
}

// --- Login -------------------------------------------------

async function login(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

// --- Registration ------------------------------------------

async function register(email, password) {
  const { data, error } = await _sb.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

async function updateProfile(userId, fields) {
  const { data, error } = await _sb
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Logout ------------------------------------------------

async function logout() {
  clearCachedProfile();
  const { error } = await _sb.auth.signOut();
  if (error) console.error('Logout error:', error);
  window.location.href = PATHS.LOGIN;
}

// --- Auth Guards -------------------------------------------

async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = PATHS.LOGIN;
    return null;
  }

  let profile = getCachedProfile();
  if (!profile || profile.id !== session.user.id) {
    profile = await getProfile(session.user.id);
    if (profile) cacheProfile(profile);
  }

  return { session, profile };
}

async function redirectIfAuth() {
  const session = await getSession();
  if (session) {
    await handlePostLogin(session);
    return true;
  }
  return false;
}

function hasRole(profile, ...roles) {
  return roles.includes(profile?.role);
}

function canViewTrade(profile) {
  return hasRole(profile, ROLES.TRADE_RESTRICTED, ROLES.TRADE_FULL, ROLES.ADMIN);
}

function canViewCompounds(profile) {
  return hasRole(profile, ROLES.TRADE_FULL, ROLES.ADMIN);
}

function canToggleView(profile) {
  return hasRole(profile, ROLES.TRADE_FULL, ROLES.ADMIN);
}

// --- Post-Login Routing ------------------------------------

async function handlePostLogin(session) {
  const { data: profile } = await _sb
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!profile || profile.role === 'pending') {
    window.location.href = '/portal/pending.html';
    return;
  }

  if (profile.role === 'rejected') {
    window.location.href = '/portal/rejected.html';
    return;
  }

  window.location.href = PATHS.DASHBOARD;
}

// --- Auth State Listener -----------------------------------

_sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    clearCachedProfile();
  }
});

// --- Login Page Logic --------------------------------------

function initLoginPage() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const emailInput = form.querySelector('[name="email"]');
  const passInput = form.querySelector('[name="password"]');
  const submitBtn = form.querySelector('[type="submit"]');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    try {
      const result = await login(emailInput.value, passInput.value);
      await handlePostLogin(result.session);
    } catch (err) {
      errorEl.textContent = err.message || 'Invalid credentials. Please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

// --- Registration Page Logic (Single Step) -----------------

function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot check
    const honeypot = document.querySelector('input[name="website_url"]');
    if (honeypot && honeypot.value) return;

    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const company = document.getElementById('reg-company').value.trim();
    const intendedUse = document.getElementById('reg-intended-use').value;
    const eligibilityCheckbox = document.getElementById('eligibility-confirm');
    const errorEl = document.getElementById('register-error');
    const submitBtn = document.getElementById('register-submit');

    errorEl.textContent = '';

    if (!email || !password || !company || !intendedUse) {
      errorEl.textContent = 'Please fill in all fields.';
      return;
    }
    if (password.length < 8) {
      errorEl.textContent = 'Password must be at least 8 characters.';
      return;
    }
    if (eligibilityCheckbox && !eligibilityCheckbox.checked) {
      errorEl.textContent = 'You must confirm eligibility and agree to the Terms of Service, Terms of Sale, and Privacy Policy to create an account.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      // 1. Create auth user
      const result = await register(email, password);
      const user = result.user;
      if (!user) throw new Error('Registration failed.');

      // 2. Update profile with company + intended use
      try {
        await updateProfile(user.id, {
          company: company,
          intended_use: intendedUse,
        });
      } catch (profileErr) {
        console.error('Profile update failed (non-fatal):', profileErr);
      }

      // 3. Silent IP geolocation capture (background, non-blocking)
      captureGeoData(user.id);

      // 4. Admin notification (background, non-blocking)
      notifyAdminNewApplication(email, company, intendedUse);

      // 5. Redirect to pending screen
      window.location.href = '/portal/pending.html';

    } catch (err) {
      console.error('Registration error:', err);
      errorEl.textContent = err.message || 'Registration failed. Please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Apply Now';
    }
  });
}

// --- Silent Geo Capture (non-blocking) ---------------------

async function captureGeoData(userId) {
  try {
    const geo = await detectLocation();
    if (!geo) return;

    await _sb
      .from('profiles')
      .update({
        ip_address: geo.ip || null,
        ip_city: geo.city || null,
        ip_country: geo.country || null,
        ip_org: geo.org || null,
      })
      .eq('id', userId);
  } catch (err) {
    console.error('Geo capture failed:', err);
  }
}

// --- Admin Notification (non-blocking) ---------------------

async function notifyAdminNewApplication(email, company, intendedUse) {
  try {
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: company,
        email: email,
        subject: 'New Trade Account Application — ' + company,
        message: [
          'New trade account application received:',
          '',
          'Company: ' + company,
          'Email: ' + email,
          'Intended use: ' + intendedUse,
          'Applied: ' + new Date().toISOString(),
          '',
          'Review in Supabase:',
          'https://supabase.com/dashboard/project/dbpgofivflbzjupwpegr/editor',
        ].join('\n'),
      }),
    });
  } catch (err) {
    console.error('Admin notification failed:', err);
  }
}
