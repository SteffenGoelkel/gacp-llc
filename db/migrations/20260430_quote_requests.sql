-- GACP LLC — quote_requests table for the Quote Builder flow
-- Safe to re-run: every statement is idempotent.
--
-- Run this in the Supabase SQL editor on the project that backs gacp.llc.
-- Replaces the parked checkout flow (orders / gacp-checkout). The
-- gacp-contact-form Worker uses the service-role key on INSERT;
-- the per-row policies below are what authenticated buyers and admins
-- see from the client.
--
-- Build order: this is step 1 of Section X.8 in the Quote Builder spec.

-- ---------------------------------------------------------------
-- 1. Inspect existing state (read-only — run first, decide what to skip).
-- ---------------------------------------------------------------

-- Does the table already exist?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quote_requests'
ORDER BY ordinal_position;

-- Does is_admin() already exist? If a row comes back, skip section 2.
SELECT n.nspname AS schema,
       p.proname AS name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'is_admin' AND n.nspname = 'public';

-- ---------------------------------------------------------------
-- 2. is_admin() helper (SECURITY DEFINER) — created only if missing.
--
-- Avoids RLS recursion on profiles. Reads profiles.role directly with
-- definer privileges so the calling user does not need a SELECT policy
-- on profiles to evaluate the admin check.
--
-- Skip this block if section 1 showed an existing is_admin(uuid)
-- with a different definition you want to preserve.
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid) = 'uid uuid'
  ) THEN
    CREATE FUNCTION public.is_admin(uid uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $fn$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = uid AND role = 'admin'
      );
    $fn$;

    REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- 3. Create the table if it doesn't exist.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email          TEXT NOT NULL,
  user_company        TEXT,
  user_tier           TEXT,
  line_items          JSONB NOT NULL,
    -- [{ product_id, sku, name, qty, unit, unit_price_cents, line_total_cents }]
  subtotal_cents      BIGINT,
  tier_discount_cents BIGINT,
  total_cents         BIGINT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'new',
  pro_forma_url       TEXT,
  pro_forma_sent_at   TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  shipped_at          TIMESTAMPTZ,
  tracking_number     TEXT,
  carrier             TEXT,
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quote_requests_status_check CHECK (
    status IN ('new','quoted','accepted','paid','shipped','declined','cancelled')
  )
);

-- ---------------------------------------------------------------
-- 4. Columns / constraints that may be missing on an older table.
--    (No-ops on a fresh install; keeps re-runs safe.)
-- ---------------------------------------------------------------
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS pro_forma_url     TEXT;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS pro_forma_sent_at TIMESTAMPTZ;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS shipped_at        TIMESTAMPTZ;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS tracking_number   TEXT;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS carrier           TEXT;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS admin_notes       TEXT;

-- ---------------------------------------------------------------
-- 5. updated_at trigger.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_requests_updated_at ON public.quote_requests;
CREATE TRIGGER trg_quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------
-- 6. RLS — buyers see/insert their own; admins see/manage all.
-- ---------------------------------------------------------------
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_requests_select_own" ON public.quote_requests;
CREATE POLICY "quote_requests_select_own"
  ON public.quote_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "quote_requests_insert_own" ON public.quote_requests;
CREATE POLICY "quote_requests_insert_own"
  ON public.quote_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "quote_requests_admin_all" ON public.quote_requests;
CREATE POLICY "quote_requests_admin_all"
  ON public.quote_requests FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------
-- 7. Indexes for common read patterns.
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_quote_requests_status
  ON public.quote_requests (status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_user
  ON public.quote_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created
  ON public.quote_requests (created_at DESC);
