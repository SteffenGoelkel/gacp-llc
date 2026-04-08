/* ============================================================
   GACP LLC — profile-check.js
   Shared utility: gate actions behind profile field completion
   ============================================================ */

/**
 * Check if the current user's profile has all required fields populated.
 * If any are missing, redirects to the profile page to complete them.
 *
 * @param {string[]} requiredFields - Profile column names to check
 * @param {string}   returnUrl      - URL to redirect back to after completion
 * @param {string}   need           - Accordion section to auto-expand (contact|business|shipping)
 * @returns {Promise<object|null>}  - Profile data if complete, null if redirecting
 */
async function requireProfileFields(requiredFields, returnUrl, need) {
  const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: { session } } = await _sb.auth.getSession();
  if (!session) return null;

  const { data: profile } = await _sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile) return null;

  const missing = requiredFields.filter(f => !profile[f] || String(profile[f]).trim() === '');

  if (missing.length > 0) {
    const params = new URLSearchParams();
    params.set('return', returnUrl);
    params.set('need', need);
    window.location.href = `/portal/profile.html?${params.toString()}`;
    return null;
  }

  return profile;
}
