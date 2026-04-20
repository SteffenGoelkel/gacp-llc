# gacp-checkout Worker — deployment notes

Cloudflare Worker that backs `gacp.llc/api/checkout*`. Receives the
cart+card payload from `portal/checkout.html`, validates the Supabase
session, recomputes totals against the `products` table, calls MiCamp
V2 Sale, writes an `orders` row, and returns the result.

**Status at commit time:** code + config committed only. Infra
(database schema, Worker creation, secrets, route binding) is done
manually in the Cloudflare + Supabase dashboards.

---

## 1. Supabase — run the migration

Open the SQL editor for the gacp Supabase project and paste the contents of
[`../db/migrations/20260420_orders.sql`](../db/migrations/20260420_orders.sql).
The file is idempotent — re-running is safe.

Verify afterwards: `SELECT column_name FROM information_schema.columns
WHERE table_name = 'orders'` should list every column the Worker writes
(`site_id`, `user_id`, `items`, `subtotal_cents`, `discount_cents`,
`shipping_cents`, `tax_cents`, `total_cents`, `tier`, `currency`,
`status`, `payment_id`, `auth_code`, `last4`, `card_brand`,
`shipping_addr`, `billing_addr`, `contact_email`, `contact_phone`,
`notes`, `created_at`, `updated_at`).

---

## 2. Cloudflare — create the Worker

Dashboard path: **Workers & Pages → Create application → Create Worker**.

- Name: **`gacp-checkout`**
- Paste in the contents of `worker.js` and save/deploy.

## 3. Set secrets

Either via `wrangler secret put <NAME>` in this directory, or via the
dashboard (**Worker → Settings → Variables → Add secret**). All six are
required:

```
MICAMP_API_USER       = mcnorthapi1           # copy from altmed-checkout
MICAMP_API_PASS       = <sandbox pass>        # copy from altmed-checkout
MICAMP_MERCHANT_KEY   = 123456789012          # sandbox
MICAMP_GATEWAY_URL    = https://gateway.mipaymentchoice.com
SUPABASE_URL          = https://dbpgofivflbzjupwpegr.supabase.co
SUPABASE_SERVICE_KEY  = <service-role key>    # Supabase → Project Settings → API
```

## 4. Bind the route

**Worker → Triggers → Add route**

- Zone: `gacp.llc`
- Route: `gacp.llc/api/checkout*`

(The route is intentionally left commented in `wrangler.toml` so the
dashboard remains the source of truth. If you prefer `wrangler deploy`
with an active trigger, uncomment the `[triggers]` block.)

---

## 5. Cross-check against `altmed-checkout`

Before swapping to live MiCamp credentials, diff this worker against the
live `altmed-checkout` worker and reconcile any differences in:

- `/api/v2/authentication` request/response shape (token key name)
- `/api/v2/transactions/sale` request shape (field casing, required
  fields like `TransactionIndustryType`, `AVSZip`, etc.)
- Approval signal (`ResponseCode === '00'` vs. `Status === 'Approved'`)

The playbook draws from the MiCamp developer wiki, so the shape here
should be current — but production workers sometimes drift.

---

## 6. Promoting to live

When live credentials land, only two things change:

1. Update the three MiCamp secrets (`MICAMP_API_USER`,
   `MICAMP_API_PASS`, `MICAMP_MERCHANT_KEY`). `MICAMP_GATEWAY_URL`
   stays the same.
2. In `portal/checkout.html`, change `<body data-env="sandbox">` to
   `<body data-env="production">` — the sandbox badge auto-hides via
   the CSS rule in `portal.css`. Also remove the pre-filled test
   card values from the form.

No code changes to the Worker.
