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
- A 6-digit PIN is weak by itself (OWASP calls anything under 8 characters weak), so online guessing is capped. Reworked
  2026-11-27 (breaker: about 10 addresses could lock all staff out, about 17 the owner, again and again): there is no
  shop-wide lock any more. Within 15 minutes:
  - one address (IPv4, or IPv6 by its /56): more than 5 wrong tries and that address waits 15 minutes; its IPv6 /48 gets
    5 in all, so a tunnel cannot act as 256 addresses. Only that address is affected.
  - one staff name (names that do not exist count the same, so nothing shows who works there): past 5 wrong tries from
    addresses not seen signing in, each try is slowed (doubling from 250 ms, up to 8 s); past 30 (`NAME_CAP`) such tries are
    refused for that name. An address that signed in correctly in the last 30 days (a `login_attempts` row with ok = 1,
    which is kept: the staff list reads "last signed in" from it) is held by neither the delay nor the name cap, so a
    stranger hammering a name never locks the real person out at the counter. A staff member on a network never used
    before, while someone is hammering their name, waits up to 15 minutes or signs in at the shop.
  - the owner's passcode (`ADMIN_KEY`): only the per-address limits; past 20 wrong owner tries shop-wide, each try from an
    address not seen signing in is slowed (doubling, up to 8 s). Nothing locks the owner out. The passcode must be long and
    random (16 characters or more; the Worker log warns on the live site when it is shorter): at 5 tries per address per 15
    minutes, a thousand addresses make under half a million guesses a day.
  - Brute force on a PIN: 10^6 PINs (obvious ones refused) and at most 30 tries per name per 15 minutes from unknown
    addresses (2,880 a day, however many addresses) puts the expected time to guess one PIN at about half a year; the pepper
    keeps a stolen database from being guessed offline.
  A request already over a limit is refused before anything is written; one that gets through is written down and counted
  again, and only then is the staff name's own row written, so a burst of simultaneous tries on separate Workers is still
  counted in full. Signed-in sessions are never touched by these limits. Failed tries older than a day are deleted on every
  try and by the 10-minute sweep. Obvious PINs are refused. On the live site, staff sign-in refuses to run without `PIN_PEPPER`.
  These numbers are owner-vetoable (src/admin.js `NAME_CAP` and the sign-in block).- **Create `PIN_PEPPER` before any staff account exists** (`npx wrangler secret put PIN_PEPPER`, a long random value
  kept in Bitwarden, never in the repo). Every PIN hash is made with it when it is set (checked in test-backoffice:
  a hash made with it fails without it). A PIN set before it existed was made with the `ADMIN_KEY` fallback and stops
  working the moment the pepper is created; changing or losing the pepper does the same to every PIN, and the owner
  must set each PIN again. So on the live site, adding staff or setting a PIN is refused until `PIN_PEPPER` exists.
- One generic answer for a wrong name or a wrong PIN, and the same PBKDF2 work either way (a dummy hash).
- Secrets compared with `crypto.subtle.timingSafeEqual` over SHA-256 digests (Workers best practices).
- Sessions: 32 random bytes from `crypto.getRandomValues`, stored only as a SHA-256 hash; a new token at every
  sign-in; HttpOnly, SameSite=Strict, Secure on https; 12-hour absolute limit and a 2-hour idle limit; deleted on
  sign-out; all of a person's sessions deleted when the owner removes them or resets their PIN.
- Roles: staff do the daily work; staff, settings, the monthly report and the full backup are owner only (403).

## Placing an order: limits and holds (src/guard.js, src/checkout.js, src/pay.js; 2026-11-26, reworked 2026-11-27)
All numbers here are owner-vetoable defaults; they live in src/guard.js (and DECISIONS.md beside the repo says so).
- Who is asking: `CF-Connecting-IP`, which Cloudflare sets at the edge; IPv6 is counted by its /56 (a home connection's
  usual block) and again by its /48. Only a hash keyed with a Worker secret is stored, in `order_attempts` (migration 0012),
  with the order it placed; rows are deleted after 30 days by the 10-minute sweep (`pruneGuards`).
- Per visitor and per email: 5 orders in 10 minutes, 15 a day, and 3 pay-at-the-counter orders still holding stock unpaid at
  once (a card page lets its stock go by itself in 35 minutes). A whole IPv6 /48 gets 10 in 10 minutes, 30 a day and 6 held.
  Checked before the order is written and again after (with it counted), so a burst gets no further than the limit.
- Emails are compared as one person for these limits (2026-11-27): lowercase, any +tag dropped, and for Gmail the dots too
  (googlemail.com reads as gmail.com), in JS (`normEmail`) and the same rule in SQL (`normEmailSql`). The order keeps the
  address exactly as typed. A guest whose email already has 3 orders held is asked to sign in with it (which skips the
  email's counts: a signed-in shopper has shown the inbox is theirs) or call.
- The shop-wide brake: 60 orders a minute (`SHOP_BRAKE_PER_MIN`; it was 12, which one person with home IPv4, a tunnel /48
  and a phone could reach). With the per-network caps above, 60 in a minute takes 20 or more networks at once. A shopper
  signed in with the order's own email is never braked. Chosen over "brake only new visitors" because the shop cannot tell a
  returning guest from a stranger without trusting the typed email, which anyone can type.
- Per order: a card order 20 different items, 20 of one item (the cart's most, MAX_QTY), 40 units. An unpaid
  pay-at-the-counter order (`PICKUP_CAPS`): 5 of one item and 15 in all, which covers any counter order the shop has seen
  (charcoal by the box, foil by the pack, shisha by the tub, hookahs one at a time); while card payment is off the cart
  stops at 5 of an item and asks for a call past 15. A quantity must be a whole number sent as a number.
- Per item (2026-11-27): all unpaid pickups together hold at most half of an item's units (on the shelf plus already held),
  and always at least 1 (`holdMax`). Checked before the order is written for a plain answer, and again inside the very
  statement that takes the stock (one D1 transaction), so orders at the same moment cannot pass it together. Card orders
  are not held to it. So a handful of addresses can hold at most 3 x 15 units each and never more than half of any item.
- What a blocked shopper sees (all with the counter's number, 519-255-2222): too many held: "You already have N orders
  waiting to be paid and picked up. Pick those up first, or call..."; an email with 3 held: "...If it is yours, sign in with
  it to order, or call..."; too fast: "That is a lot of orders in a short time. Wait a few minutes and try again, or call...";
  too big: "Pickup orders paid at the counter take up to 15 items, 5 of any one item. For more, call..."; item held to its
  half: "We can hold N of <item> for a pickup order right now. Lower the number, or call the counter ... to hold more"; a real
  flood: "The shop is busy. Try again in a minute." A family on one Wi-Fi placing two orders, or a returning customer, meets
  none of these.
- Pay-at-the-counter holds end: `pay_expires_at` is set to `PICKUP_HOLD_HOURS` (default 48) after the order; the
  10-minute sweep cancels an order still pending and unpaid past it (payment 'expired') and puts its stock back once
  (`releaseHeld`, guarded on the deadline so staff marking it paid always wins). One the shop marked ready is held 14
  days from ready (as the ready email says), then let go the same way; ready-but-unpaid orders still count as held.
  Paid or cancelled ends it. The receipt and the shop's new-order note state the window; the back office shows "Held until" and
  "Hold ended, unpaid". Orders placed before this change have no deadline and never expire.
- The order name must be letters, spaces, apostrophes, hyphens and periods, with no period running into two letters,
  so it can never carry a link into "Thank you, {name}". Known limit: shoppers sharing one public IPv4 (carrier NAT, campus
  Wi-Fi) share one visitor's limits. Customer text in emails (notes, addresses) has zero-width spaces put into anything
  link-shaped, then is escaped.
- Turnstile is not wired anywhere on the site yet (ACCOUNTS-LOYALTY.md lists it as a next step), so orders do not ask for it.
- Apply migration 0012 before deploying this code. Without it, orders still go through on the email limits, the caps and
  the per-item hold ceiling (the visitor limits are skipped and the Worker log says so). No new migration for 2026-11-27.

## Card payment off: every promise follows the switch (2026-11-27)
- One switch: card payment is on when `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set (src/pay.js `cardReady`). The
  Worker writes it into every page as `<meta name="oss-pay">` and sets it per request for the server's own text
  (src/catalog.js `setCardOn`, public/band.js `setPickupOnly`), so server HTML and the page draw the same words.
- Off: every order is a pickup paid at the counter. Meta descriptions, the home line, section and product pages, the band,
  the cart, checkout, the set page, search's page links, the footer and structured data (OnSitePickup only) offer pickup
  only; the shipping, terms and privacy pages say delivery and shipping open once card payment is on. No delivery bar.
- On, with nothing on sale that ships by carrier: pickup and local delivery; no Nationwide choice, no "How we ship glass",
  one slim local-delivery bar. On, and something ships: today's wording, and the shop pages ask local or nationwide.

## Demo samples stay off (2026-11-27)
- The made-up sample products (src/samples.js) cannot be switched on from the full product form or the item editor; the
  back office shows no "Show in the store" switch on them. The test suites switch a few on in their own local database
  only with `SAMPLES_TEST_ONLY=1` (set by tools/ci-suites.mjs, never in wrangler.jsonc), on 127.0.0.1 or localhost, and
  never with LIVE=1.

## The questionnaire link (2026-11-27)
- `/api/intake/<link>` takes at most 5 sends a day from one place and 30 a day in all (rows in `login_attempts` under
  `k:` and a keyed hash of the address, deleted after a day), at most 200 KB each, and stops taking sends once 300 are kept.
  Each send is its own file labelled with its time, a short place tag (keyed hash, never the address) and its country;
  the back office lists every send that way and the owner picks which to read, so a stranger's newer send cannot pass for
  the shop's.
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

## The item editor (2026-11-26)
- `PUT /api/admin/products/:sku/info` takes any of `name`, `colours` (`[{ name, hex? }]`, up to 16), `stock`
  (`{ counted, seen }`) and `price_cents`. Only what is sent changes; nothing is filled in for the shop. Every field is
  checked before anything is written, so one bad field saves nothing.
- Same guards as every write: the admin cookie, the `X-OSS-Admin` marker, JSON only, same origin. Prices stay the
  owner's: a staff save carrying a changed price is refused whole (403).
- Colours live in `details.colours` (names) and `details.colour_hex` (only for colours the shop added itself). On an Ace
  hookah colour row they also become its chip name (`details.colour`, "Black and Gold"). No migration.
- The shelf count is a `count` move with the number the screen showed (`seen`), as in Count mode, and marks the row
  `availability = 'counted'`. A price set on an item on view with Price TBD (`listed = 1`, off, ticked, not dropped, not
  a sample) switches it on. Logged as `product.info` with the person's name.
- "Needs info" (`needs` on each row of `GET /products`): an item on view missing its price, its colours (Ace items) or
  its shelf count (`in_store_uncounted`, `special_order`).

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
- A stranger can still slow a staff name, and lock it for addresses never seen signing in, for 15 minutes. Cloudflare
  rate limiting rules on /api/admin/login would blunt this further.
- PBKDF2 at 100,000 rounds measured about 100 ms of CPU in Node. The Workers Free plan allows 10 ms per request,
  so confirm the plan before staff sign in (REMOTE-STEPS step 5 gives the fallback).
- Today's day totals still use a fixed 5-hour offset (`LOCAL` in admin.js); the monthly report uses real Windsor time.
- Refunds after shipping or collection (a "refunded" step with an amount) are not built; the report counts any order
  marked refunded on its update date.
- Turn on Workers Logs and Traces in wrangler.jsonc (`observability`) before launch; left out here so this branch
  does not change deploy settings.
- `wrangler types` for a generated Env (the code is plain JavaScript today).

## PIN hashing cost (integration, 2026-11-24)
- Staff PINs are hashed with PBKDF2-HMAC-SHA256 at `PIN_ROUNDS` rounds (src/staff.js, `PIN_ROUNDS_DEFAULT` = 100,000,
  the most workerd allows). That is about 100 ms of CPU per sign-in or PIN change. The Workers Free plan allows 10 ms
  of CPU per request, so on Free a staff sign-in may be cut off; the paid plan allows far more.
- `PIN_ROUNDS` (a Worker var, 10,000 to 100,000) sets the rounds for PINs set from then on. Every stored hash keeps
  the rounds it was made with, so changing the var never breaks an existing PIN; a PIN moves to the new count when
  it is next set. Measure on the demo before changing it; fewer rounds make a stolen database cheaper to guess
  (the pepper, PIN_PEPPER, is the main defence there).

