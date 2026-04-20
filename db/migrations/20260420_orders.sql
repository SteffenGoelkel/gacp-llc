-- GACP LLC — orders table for the portal checkout flow
-- Safe to re-run: every statement is idempotent.
--
-- Run this in the Supabase SQL editor on the project that backs gacp.llc.
-- The gacp-checkout Worker uses the service-role key, so RLS is bypassed
-- on INSERT; the SELECT policy is what lets the authenticated user read
-- their own orders from the client in the future.

-- ---------------------------------------------------------------
-- 1. Inspect the existing table (safe — read-only).
-- ---------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------
-- 2. Create the table if it doesn't exist.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         TEXT NOT NULL,
  user_id         UUID REFERENCES auth.users(id),
  items           JSONB NOT NULL,
  subtotal_cents  INTEGER NOT NULL,
  discount_cents  INTEGER NOT NULL DEFAULT 0,
  shipping_cents  INTEGER NOT NULL DEFAULT 0,
  tax_cents       INTEGER NOT NULL DEFAULT 0,
  total_cents     INTEGER NOT NULL,
  tier            TEXT,
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'pending',
  payment_id      TEXT,        -- MiCamp TransactionId
  auth_code       TEXT,        -- MiCamp AuthCode
  last4           TEXT,
  card_brand      TEXT,
  shipping_addr   JSONB,
  billing_addr    JSONB,
  contact_email   TEXT,
  contact_phone   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- 3. Columns that may be missing on an older orders table.
-- ---------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tier          TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last4         TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_brand    TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes         TEXT;

-- ---------------------------------------------------------------
-- 4. RLS — users may read/insert their own orders.
-- ---------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 5. Index for common read patterns.
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS orders_site_user_idx
  ON orders (site_id, user_id, created_at DESC);
