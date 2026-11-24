# Back office: backend practices and where they come from

Written 2026-11-24 for branch backoffice-ops. Each rule below names the source it was checked against and
the place in the code that follows it. "Follow-up" items are known gaps left for a later branch.

## Sources read
- Cloudflare Workers best practices: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- Workers limits (10 ms CPU on Free, 30 s default on Paid): https://developers.cloudflare.com/workers/platform/limits/
- D1 Worker API, batches are transactions: https://developers.cloudflare.com/d1/worker-api/d1-database/
- D1 limits (100 bound parameters, 50 queries per invocation on Free, a batch counts as one): https://developers.cloudflare.com/d1/platform/limits/
- D1 indexes and EXPLAIN QUERY PLAN: https://developers.cloudflare.com/d1/best-practices/use-indexes/
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- D1 read replication and the Sessions API: https://developers.cloudflare.com/d1/best-practices/read-replication/
- workerd PBKDF2 cap of 100,000 iterations: https://github.com/cloudflare/workerd/issues/1346
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Authentication: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Logging: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- PIPEDA fair information principles: https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/
- OPC meaningful consent guidelines: https://www.priv.gc.ca/en/privacy-topics/collecting-personal-information/consent/gl_omc_201805/
- CASL scope: https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/canadas-anti-spam-legislation and section 6: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/section-6.html
- CRA, keep records six years: https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc188/keeping-records.html

## Staff PINs and sign-in (src/staff.js, src/admin.js)
- PINs are never stored. Hash = PBKDF2-HMAC-SHA256 over HMAC(pepper, PIN), 16-byte random salt, 100,000
  iterations, stored as `pbkdf2-sha256$iter$salt$hash` so the count can change per PIN later. OWASP asks for
  600,000 for PBKDF2-SHA256; Workers refuse more than 100,000 (workerd#1346), so the pepper (a Worker secret,
  `PIN_PEPPER`, falling back to `ADMIN_KEY`) carries the rest: a stolen database alone cannot be guessed offline.
- A 6-digit PIN is weak by itself (OWASP calls anything under 8 characters weak), so online guessing is capped:
  more than 5 tries from one address, 5 on one name from anywhere (names that do not exist lock the same way, so a
  lock does not reveal who works there), or 40 staff tries in total, lock sign-in for 15 minutes. Each try is
  written down before it is checked, so a burst of simultaneous tries on separate Workers is counted in full.
  The owner's passcode is held only by the per-address limit, so other people's wrong PINs cannot lock the owner
  out. Obvious PINs are refused. On the live site, staff sign-in refuses to run without `PIN_PEPPER`.
- One generic answer for a wrong name or a wrong PIN, and the same PBKDF2 work either way (a dummy hash).
- Secrets compared with `crypto.subtle.timingSafeEqual` over SHA-256 digests (Workers best practices).
- Sessions: 32 random bytes from `crypto.getRandomValues`, stored only as a SHA-256 hash; a new token at every
  sign-in; HttpOnly, SameSite=Strict, Secure on https; 12-hour absolute limit and a 2-hour idle limit; deleted on
  sign-out; all of a person's sessions deleted when the owner removes them or resets their PIN.
- Roles: staff do the daily work; staff, settings, the monthly report and the full backup are owner only (403).

## Writes from another site (CSRF)
- Every admin write needs JSON, the `X-OSS-Admin: 1` header (a custom header a form cannot send), a same-site
  cookie, a matching `Origin` when present, and is refused when the browser marks it `Sec-Fetch-Site` other than
  same-origin (OWASP: Fetch Metadata is the most useful single check). No state changes on GET.

## Stock integrity
- No read-then-write: every stock change is one conditional statement inside a D1 batch (a transaction). The
  count can never go below zero; the move row is written only if the stock row changed (`changes() = 1`).
- Count mode sends the number the screen showed (`seen`); if an order changed the stock meanwhile, nothing is saved
  and the new number is shown, so a sale is never counted away.
- Every tap carries a key (`op`). A unique partial index on `stock_moves.op` and a NOT EXISTS guard make a repeat
  of the same tap count once and answer with the same result; a key cannot be reused on another product.
- Cancel: exactly one request can move the order to cancelled (it writes its own key into `cancel_op`), and the
  restock, the stock-history lines and the log line are conditional on that key, all in one transaction. Retries
  and simultaneous taps cannot restock twice. The status buttons now refuse a second tap the same way, so one
  "ready" means one customer email.
- Money is whole cents end to end. The studio share is rounded once, at the end, half away from zero, in integer
  maths. Values typed as numbers into text (like "counted 9") are bound as strings, because D1 binds JS numbers as REAL.

## The audit trail (OWASP Logging)
- Who, what, when: `audit_log` (product edits, order steps, cancels, ID ticks, staff and settings changes, sign-ins)
  and `stock_moves` (every count, receipt, sale and put-back) carry the signed-in person's name and number.
- Never logged: PINs, passcodes, session tokens. Failed and locked sign-ins go to the Worker log as JSON with no
  secret in them, and to `login_attempts` keyed by a hash of the address.
- The backup file copies staff without PIN hashes and never copies sessions or sign-in attempts.

## D1 notes
- Prepared statements with `bind()` everywhere; no SQL is built from user input (column lists come from a fixed set).
- New indexes for every new query: orders by created and cancelled date (report), stock moves by key and by order
  (replay, put-back history), audit log by target (who-did-what), sessions by staff and expiry, sign-in attempts by staff.
- Read replication is off; if it is turned on later, the back office must use `withSession("first-primary")` for
  the count and cancel paths so a read never comes from a stale replica.

## Privacy and CASL (not legal advice)
- Order source keeps only short codes (`src`, `utm_*`), the referring site's name (never the full address, which can
  carry personal details) and the first page's path. It stays on the shopper's device (30 days) until they order,
  is used only to count which cards, posts and listings bring orders, and is never shared. The privacy page says so
  (PIPEDA openness and limiting collection). No cookie, no third-party tracker.
- CASL covers commercial electronic messages, not storing referral data. Nothing in this branch emails anyone.
- Order records, including the report's inputs, are kept six years (CRA).

## Follow-ups (not done here)
- Cookie name `__Host-oss_admin` (OWASP): changing it signs everyone out and the existing tests pin the name.
- Anyone can lock one staff name for 15 minutes by guessing it (that is the price of the per-name lock). Cloudflare
  rate limiting rules on /api/admin/login would blunt this further.
- PBKDF2 at 100,000 rounds measured about 100 ms of CPU in Node. The Workers Free plan allows 10 ms per request,
  so confirm the plan before staff sign in (REMOTE-STEPS step 5 gives the fallback).
- Today's day totals still use a fixed 5-hour offset (`LOCAL` in admin.js); the monthly report uses real Windsor time.
- Refunds after shipping or collection (a "refunded" step with an amount) are not built; the report counts any order
  marked refunded on its update date.
- Turn on Workers Logs and Traces in wrangler.jsonc (`observability`) before launch; left out here so this branch
  does not change deploy settings.
- `wrangler types` for a generated Env (the code is plain JavaScript today).
