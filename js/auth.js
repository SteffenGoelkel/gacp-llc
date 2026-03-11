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
    window.location.href = PATHS.DASHBOARD;
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
      await login(emailInput.value, passInput.value);
      window.location.href = PATHS.DASHBOARD;
    } catch (err) {
      errorEl.textContent = err.message || 'Invalid credentials. Please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

// --- Registration Page Logic (Single Page) -----------------

function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (!form) return;

  // Toggle business fields
  form.querySelectorAll('[name="account_type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const bizFields = document.getElementById('biz-fields');
      bizFields.classList.toggle('hidden', radio.value !== 'business');

      // Style the radio cards
      form.querySelectorAll('.account-type-card').forEach(c => c.classList.remove('account-type-card--active'));
      radio.closest('label').querySelector('.account-type-card').classList.add('account-type-card--active');
    });
  });

  // Set initial active state
  const checkedRadio = form.querySelector('[name="account_type"]:checked');
  if (checkedRadio) {
    checkedRadio.closest('label').querySelector('.account-type-card').classList.add('account-type-card--active');
  }

  // Handle submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('register-submit');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    // Validate password match
    if (data.password !== data.password_confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    if (data.password.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    try {
      // Capture IP info
      const geo = await detectLocation();
      if (geo) {
        data.ip_address = geo.ip;
        data.ip_city = geo.city;
        data.ip_country = geo.country;
        data.ip_org = geo.org;
        data.location_match = geo.country === data.country;
      }

      // Create auth user
      const result = await register(data.email, data.password);
      const user = result.user;
      if (!user) throw new Error('Registration failed');

      // Build profile fields (exclude auth fields)
      const profileFields = { ...data };
      delete profileFields.email;
      delete profileFields.password;
      delete profileFields.password_confirm;
      delete profileFields.terms;

      await updateProfile(user.id, profileFields);

      // Notify admin of new application
      try {
        const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Unknown';
        await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'GACP Website',
            email: data.email,
            subject: 'New Application: ' + fullName,
            message: [
              'A new account application has been submitted.',
              '',
              'Name: ' + fullName,
              'Email: ' + data.email,
              'Account Type: ' + (data.account_type || 'individual'),
              'Company: ' + (data.company || 'N/A'),
              'Business Category: ' + (data.biz_category || 'N/A'),
              'Intended Use: ' + (data.intended_use || 'N/A'),
              'Country: ' + (data.country || 'N/A'),
              '',
              'Review this application at:',
              'https://gacp.llc/admin.html',
            ].join('\n'),
          }),
        });
      } catch (notifyErr) {
        // Don't block registration if notification fails
        console.error('Admin notification failed:', notifyErr);
      }

      showToast('Account created! Your application is under review.', 'success');
      setTimeout(() => { window.location.href = PATHS.LOGIN; }, 2000);
    } catch (err) {
      showToast(err.message || 'Registration failed. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Application';
    }
  });
}
