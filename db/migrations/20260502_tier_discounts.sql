-- GACP LLC — tier_discounts table for the Quote Builder flow
-- Safe to re-run: every statement is idempotent.
--
-- Run this in the Supabase SQL editor on the project that backs gacp.llc.
-- Replaces the hardcoded tier→discount map that previously lived in cart.js
-- and worker/worker.js (bronze 0, silver 8, gold 15, platinum 22). The new
-- values are 0 / 1 / 2 / 3.5 — recalibrated for the quote-builder model.
--
-- Build order: depends on 20260430_quote_requests.sql for is_admin(uuid)
-- and set_updated_at(). Run that first if it's not already applied.
--
-- RLS deliberately denies all authenticated SELECT — discount percentages
-- are read only by the Worker via service_role. Frontend reads its own
-- tier via /api/my-tier-discount.

-- ---------------------------------------------------------------
-- 1. Inspect existing state (read-only — run first, decide what to skip).
-- ---------------------------------------------------------------

-- Does the table already exist?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tier_discounts'
ORDER BY ordinal_position;

-- Current rows: see Section 6 (verify) — that block runs after the table
-- is guaranteed to exist, which keeps the migration safe to apply as a
-- single transaction (apply_migration / CI runners) as well as a
-- copy-paste into the Supabase SQL editor.

-- ---------------------------------------------------------------
-- 2. Create the table if it doesn't exist.
--    discount_pct is stored as a percentage 0–100. Frontend and Worker
--    divide by 100 to apply.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tier_discounts (
  tier         TEXT PRIMARY KEY,
  discount_pct NUMERIC NOT NULL
    CHECK (discount_pct >= 0 AND discount_pct <= 100),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Columns that may be missing on an older partial table.
-- (No-op on a fresh install; lets re-runs heal earlier exploratory state.)
ALTER TABLE public.tier_discounts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------
-- 3. Seed the four canonical tiers.
--    ON CONFLICT … DO UPDATE means re-running the migration corrects
--    the values if someone tweaked them in the dashboard.
-- ---------------------------------------------------------------
INSERT INTO public.tier_discounts (tier, discount_pct) VALUES
  ('bronze',   0),
  ('silver',   1),
  ('gold',     2),
  ('platinum', 3.5)
ON CONFLICT (tier) DO UPDATE
  SET discount_pct = EXCLUDED.discount_pct,
      updated_at   = now();

-- ---------------------------------------------------------------
-- 4. updated_at trigger.
--    Uses the existing public.set_updated_at() function from the
--    quote_requests migration.
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_tier_discounts_updated_at ON public.tier_discounts;
CREATE TRIGGER trg_tier_discounts_updated_at
  BEFORE UPDATE ON public.tier_discounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------
-- 5. RLS — table is locked behind the Worker. No SELECT policy for
--    authenticated users; the Worker reads via service_role (which
--    bypasses RLS). Only admins may INSERT/UPDATE/DELETE.
-- ---------------------------------------------------------------
ALTER TABLE public.tier_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_discounts_admin_all" ON public.tier_discounts;
CREATE POLICY "tier_discounts_admin_all"
  ON public.tier_discounts FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------
-- 6. Verify (read-only — run after the rest to confirm).
-- ---------------------------------------------------------------
SELECT tier, discount_pct, updated_at
FROM public.tier_discounts
ORDER BY tier;
