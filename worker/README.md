# gacp-contact-form Worker — deployment notes

Cloudflare Worker that backs `gacp.llc/api/contact*`. Two POST shapes:

1. **General contact** — `{ name, email, message, subject? }`. Unauthenticated;
   forwards to `info@gacp.llc` via MailChannels.
2. **Quote request** — `{ type: 'quote_request', line_items, notes? }`.
   Authenticated via Supabase JWT; recomputes pricing server-side, inserts
   into `quote_requests`, emails admin + buyer.

---

## 1. Prerequisites

- Migration [`../db/migrations/20260430_quote_requests.sql`](../db/migrations/20260430_quote_requests.sql) already
  applied. Verify the `quote_requests` table exists, RLS is on, and
  `is_admin(uuid)` is callable.

---

## 2. Secrets

Set via `wrangler secret put <NAME>` from this directory, or via the
Cloudflare dashboard (**Worker → Settings → Variables → Add secret**).
Do **not** commit either to `wrangler.toml`.

| Secret | Value |
|---|---|
| `SUPABASE_URL` | `https://dbpgofivflbzjupwpegr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key from Supabase project settings |

> The sibling `gacp-checkout` Worker uses `SUPABASE_SERVICE_KEY` for the
> same value. This Worker uses `SUPABASE_SERVICE_ROLE_KEY` per the
> quote-builder spec naming. Keep both in sync if you rotate.

---

## 3. Deploy

```sh
cd site/worker
wrangler deploy
```

Route binding (`gacp.llc/api/contact*`) is in `wrangler.toml`.

---

## 4. Submission shapes

### General contact

```http
POST /api/contact
Content-Type: application/json

{
  "name":    "Jane Buyer",
  "email":   "jane@example.com",
  "subject": "Question about kava extract",
  "message": "Do you have a 50:1 spec available?"
}
```

Response: `200 { "success": true }`.

### Quote request

```http
POST /api/contact
Content-Type: application/json
Authorization: Bearer <supabase-jwt>

{
  "type": "quote_request",
  "line_items": [
    { "product_id": "gacp-001", "qty": 5 },
    { "product_id": "gacp-014", "qty": 2 }
  ],
  "notes": "Need by end of May if possible."
}
```

The Worker ignores any `unit_price_cents`, `name`, or `sku` the client
sends — those are pulled from the `products` table server-side. Only
`product_id` and `qty` are read from the payload.

Response (success):

```json
{ "ok": true, "id": "<uuid>" }
```

Response (success but email failed; row is saved):

```json
{
  "ok": true,
  "id": "<uuid>",
  "warning": "received_but_email_failed",
  "message": "Your quote request was received, but our email confirmation didn't go through. Please follow up at info@gacp.llc with your request ID if you don't hear back within 1 business day."
}
```

Error responses:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "bad_json" }` | Body is not valid JSON |
| 400 | `{ "error": "empty_line_items" }` | `line_items` missing or empty |
| 400 | `{ "error": "invalid_line_item:..." }` | A line is missing `product_id` or has bad `qty` |
| 400 | `{ "error": "invalid_product:<id>" }` | Product not found, not active, or not on the gacp site |
| 400 | `{ "error": "below_moq:<id>:min=<n>" }` | qty below the product's MOQ |
| 400 | `{ "error": "price_on_request:<id>" }` | Product has no listed price (`price = 0`) |
| 401 | `{ "error": "not_authenticated" }` | Missing `Authorization` header |
| 401 | `{ "error": "invalid_session" }` | Supabase rejected the JWT |
| 403 | `{ "error": "no_profile" }` | Authenticated user has no `profiles` row |
| 403 | `{ "error": "not_authorised_to_quote" }` | Profile role is not `trade-restricted`, `trade-full`, or `admin` |
| 500 | `{ "error": "db_insert_failed" }` | Insert into `quote_requests` failed |

---

## 5. Smoke tests

After deploy, run from a shell where `JWT` is a valid Supabase access
token for a trade account:

```sh
# 1. Unauthenticated → 401
curl -i -X POST https://gacp.llc/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"type":"quote_request","line_items":[{"product_id":"gacp-001","qty":1}]}'

# 2. Empty line_items → 400
curl -i -X POST https://gacp.llc/api/contact \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT" \
  -d '{"type":"quote_request","line_items":[]}'

# 3. Below MOQ → 400 (replace product_id with one whose MOQ > 1)
curl -i -X POST https://gacp.llc/api/contact \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT" \
  -d '{"type":"quote_request","line_items":[{"product_id":"<moq-product>","qty":1}]}'

# 4. Tampered unit_price_cents → server ignores, recomputes
curl -i -X POST https://gacp.llc/api/contact \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT" \
  -d '{"type":"quote_request","line_items":[{"product_id":"gacp-001","qty":5,"unit_price_cents":1}]}'

# 5. Happy path
curl -i -X POST https://gacp.llc/api/contact \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT" \
  -d '{"type":"quote_request","line_items":[{"product_id":"gacp-001","qty":5}],"notes":"Smoke test."}'
```

Verify after #5:

- Row in `quote_requests` with `status='new'`, computed totals, computed `line_items` JSONB
- Admin email at `info@gacp.llc` with the line item table and admin link
- Buyer email at the test account's address

---

## 6. General contact path is unchanged

The Worker only branches into the quote path when `body.type === 'quote_request'`.
All other shapes fall through to the original MailChannels-only handler,
so the contact form on [`/contact.html`](../contact.html) keeps working
without changes.
