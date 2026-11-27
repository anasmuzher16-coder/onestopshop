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
  twice on 2026-11-27 (breaker: about 10 addresses could lock all staff out; then ~6 IPv4 x 5 tries passed the 30-a-name cap, names
  that did not exist counted, so common first names could be locked in advance, and the cap allowed ~2,880 PIN guesses a day). Now:
  - one address (IPv4, or IPv6 by its /56), 15 minutes: more than 5 wrong tries and that address waits 15 minutes; its IPv6 /48 gets
    5 in all, so a tunnel cannot act as 256 addresses. Only that address is affected.
  - one staff name, a day, from unfamiliar devices and places: past 3 wrong tries each try is slowed (doubling from 500 ms, up to
    8 s); at 20 (`NAME_DAY_CAP`) that name refuses them for the rest of the day ("Too many wrong tries for this name today...").
    20 guesses a day against 10^6 PINs puts the expected time to guess one at about 68 years; the pepper keeps a stolen database
    from being guessed offline.
  - only names on the staff list count against a name (`n:` rows). A name that does not exist is counted under its own key (`u:`)
    with the same rules, so the answers never show who works here, and a staff member added later starts clean: a common first
    name cannot be locked in advance.
  - familiar devices and places are held by neither the delay nor the name cap: a phone or computer where THIS person signed in
    correctly before (the `oss_dev` cookie: a random id plus an HMAC of it keyed with the Worker secret, HttpOnly, SameSite=Strict,
    Secure on https, 400 days; recorded at that sign-in as a `login_attempts` row `d:` + keyed hash, ok = 1, with their staff id, at
    most one a day per device and person, pruned after 400 days; it counts for that name only, while they are still on the staff
    list; for the passcode, a device the owner signed in on), or an address where someone still on the staff list (or the owner)
    signed in correctly in the last 30 days. Each has its own ceiling: 10 wrong tries in a day from that device (`e:` rows, written
    before the PIN is checked so a burst is counted in full) or from that address, and it is unfamiliar for the rest of the day. So a
    removed staff member keeps no pass, a staff member's own cookies give no extra guesses at colleagues' names, and neither a device
    nor a place gets round the day's ceiling (breaker, 2026-11-27). The cookie never signs anyone in. A staff member on a new device
    AND a new network while their name is being hammered waits until the next day, signs in at the counter, or asks the owner. Not
    covered: anyone sharing the counter's public address can still use up that address's 5 tries in 15 minutes.
  - the owner's passcode (`ADMIN_KEY`): only the per-address limits; past 20 wrong owner tries shop-wide in 15 minutes, each try
    from an unfamiliar device and place is slowed (doubling, up to 8 s). Nothing locks the owner out. The passcode must be long and
    random (16 characters or more; the Worker log warns on the live site when it is shorter).
  Addresses, names and devices are stored only as keyed hashes (src/guard.js `keyedHash`). The keys changed on 2026-11-27, so every
  place and device is unfamiliar once after deploy, until it signs in again. A request already over a limit is refused before
  anything is written; one that gets through is written down and counted again, and only then is the staff name's own row written,
  so a burst of simultaneous tries on separate Workers is still counted in full. Signed-in sessions are never touched by these
  limits. Failed tries older than a day are deleted on every try and by the 10-minute sweep. Obvious PINs are refused. On the live
  site, staff sign-in refuses to run without `PIN_PEPPER`. These numbers are owner-vetoable (src/admin.js `NAME_DAY_CAP`,
  `DEVICE_WRONG_CAP`).
- **Create `PIN_PEPPER` before any staff account exists** (`npx wrangler secret put PIN_PEPPER`, a long random value
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

## Placing an order: limits, and pickups as requests (src/guard.js, src/checkout.js, src/admin.js, src/pay.js; 2026-11-26, reworked twice 2026-11-27)
All numbers here are owner-vetoable defaults; they live in src/guard.js (and DECISIONS.md beside the repo says so).
- **A pay-at-the-counter pickup reserves nothing when it is placed (2026-11-27, breaker launch blocker).** Before, unpaid pickups held
  stock under a shared "at most half an item" ceiling for 48 hours, renewable, so with card off one order of 5 (or two real shoppers
  ordering 3 and 2) made an item unorderable online, and ~43 orders from ~15 IPv4s shut the whole shop. Now:
  - placing it writes the order (status `pending`, pay `pay_at_pickup`) and no stock moves at all, so no number of requests can
    block another shopper. The shelf count must still cover the quantity asked (a request for more than the count is refused).
  - the customer's receipt says it is an order request: the shop checks the shelf and emails when it is ready, wait for that email
    before coming in, nothing is set aside until then. The shop's new-order note (subject "..., to confirm") and the back office show
    it as "To confirm" (`to_confirm` on the order list and sheet, a count on Today).
  - staff mark it ready once it is on the shelf (src/admin.js `takeForReady`): one D1 batch moves the order to `ready` only if every
    item it has not taken yet is covered by the stock count, and in the same transaction takes the stock with a `sale` move by the
    person who marked it. All of it or none. If the count cannot cover it, nothing moves and staff are told which items are short
    (`shortfall`), to call the customer. A second tap takes nothing more. The low-stock note is written then, not at placement.
  - it cannot be marked paid before it is ready (marking ready is what checks the shelf); collected and paid completes as before.
  - cancelling gives back exactly what the order's own stock moves show it took, once (`TAKEN_SQL`): a request never confirmed gives
    back nothing, a ready order gives back what readying took. Card orders still get back what they ordered, unchanged.
  - a request never confirmed cancels itself after `PICKUP_REQUEST_HOURS` (default 72, 3 days; 1 to 720; kept short because an open request also fills one of its person's 3 open slots), payment `expired`, with
    no stock effect. A ready order is held 14 days from ready (as the ready email says), then let go the same way, its stock back once.
  - card orders (when card payment is on) are unchanged: stock is taken when the order is placed and held for the 35-minute payment
    page, and given back once if it is not paid.
  - Migration of open orders (no SQL migration): pay-at-the-counter orders placed before this change took their stock when placed and
    keep it. Readying one takes nothing more (it already has its `sale` moves); cancelling or expiry gives back what it took, once;
    those still pending keep their 48-hour `pay_expires_at` and are let go then as before.
- Who is asking: `CF-Connecting-IP`, which Cloudflare sets at the edge; IPv6 is counted by its /56 (a home connection's
  usual block) and again by its /48. Only a hash keyed with a Worker secret is stored, in `order_attempts` (migration 0012),
  with the order it placed; rows are deleted after 30 days by the 10-minute sweep (`pruneGuards`).
- **Per person is the main limit (2026-11-27, branch fleet/guard4; breaker: network slots were shared by strangers, and a stranger
  typing your email used your slots).** One person = one email (normalised, below) AND the same phone when both orders carry one
  (`phoneKey`: digits, extension and a leading 1 dropped), otherwise the same network (the IPv4 address or IPv6 /56 it was placed
  from, `order_attempts`). A person holds 3 open pay-at-the-counter orders (a request waiting for the shop, or one the shop got
  ready and not yet paid) and places at most 5 in 10 minutes and 15 a day (`PERSON_LIMITS`). So a stranger typing your email
  cannot use your slots unless they also have your phone or your connection.
- Per network, anti-spam only (`NET_LIMITS`, `GROUP_LIMITS`): one IPv4 address or IPv6 /56 takes 20 open and 5 orders in 10 minutes,
  15 a day; one IPv6 /48 40 open, 10 in 10 minutes, 30 a day. Open here counts only orders still waiting to be confirmed or
  paid by card; a ready-but-unpaid order counts for its person only. Carrier NAT, mobile IPv6 pools, iCloud Private Relay and
  public Wi-Fi put strangers on one address; 20 open is far past what one shared address sees. Checked before the order is
  written and again after (with it counted), so a burst gets no further than the limit.
- With mail connected only: one inbox takes 30 orders a day from guests (`EMAIL_DAY_CAP`, an inbox flood); signing in with it skips
  that. With mail off nothing is sent, and a sign-in code cannot arrive, so it does not apply.
- Emails are compared as one person for these limits (2026-11-27): lowercase, any +tag dropped, and for Gmail the dots too
  (googlemail.com reads as gmail.com), in JS (`normEmail`) and the same rule in SQL (`normEmailSql`). The order keeps the
  address exactly as typed.
- The back office marks open pickup orders that share an email but came from different networks ("Same email, N from another
  network" on the order list, and a line on the order sheet saying to cancel them if the customer did not place them).
- The shop-wide brake: 60 orders a minute (`SHOP_BRAKE_PER_MIN`). A shopper signed in with the order's own email is never braked.
- Per order: a card order 20 different items, 20 of one item (the cart's most, MAX_QTY), 40 units. A pay-at-the-counter order
  (`PICKUP_CAPS`): 5 of one item and 15 in all; while card payment is off the cart stops at 5 of an item and asks for a call past
  15. A quantity must be a whole number sent as a number.
- What a blocked shopper sees (all with the counter's number, 519-255-2222): their own 3 open: "You already have 3 pickup requests
  waiting. Pick those up first, or call the counter at 519-255-2222 to add to them."; a shared address past 20 open: "A lot of
  orders are already waiting from this internet connection (it may be shared, like a phone carrier or public Wi-Fi). Try again
  later, or call..."; too fast: "That is a lot of orders in a short time..."; an inbox past 30 a day (mail on): "...If it is yours,
  sign in with it to order, or call..."; too big: "Pickup orders paid at the counter take up to 15 items, 5 of any one item...";
  a real flood: "The shop is busy. Try again in a minute."
- The order name must be letters, spaces, apostrophes, hyphens and periods, with no period running into two letters,
  so it can never carry a link into "Thank you, {name}". Shoppers sharing one public IPv4 (carrier NAT, campus Wi-Fi) still share
  the network's rate limits (5 in 10 minutes, 15 a day), but no longer its open slots. Customer text in emails (notes, addresses) has zero-width spaces put into anything
  link-shaped, then is escaped.
- Turnstile is not wired anywhere on the site yet (ACCOUNTS-LOYALTY.md lists it as a next step), so orders do not ask for it.
- Migration 0012 stays the last one; nothing new for 2026-11-27.

## Mail connected or not: one switch (2026-11-27, branch fleet/guard4)
- Mail is on when `RESEND_API_KEY` and `EMAIL_FROM` are set (src/email.js `mailReady`), the same way card payment follows its keys.
  The Worker writes it into every page as `<meta name="oss-mail" content="on|off">` (and `oss-req-hours`, PICKUP_REQUEST_HOURS),
  and every order answer carries `notify: "email" | "call"`, so the page and the server say the same thing.
- Off (live today): no receipt, ready email or new-order note can reach anyone (they are kept in the outbox, never sent late). A
  pickup request needs a phone with its area code, checked by the server (`phone_needed`, 400) and the page; every customer line
  (checkout, cart, confirmation, shipping, terms, privacy) says the shop calls or texts. The confirmation shows the order number,
  what was asked for, "We call or text you at <phone> when it is on the shelf. Or call 519-255-2222 with your order number". Staff
  learn of requests from Today: a list of the newest 25 requests to confirm (name, phone, time, items) above "Needs you", saying to
  call the customer; marking one ready answers `call: { phone }` and the order sheet says to call or text.
- On: today's email wording, the phone optional for pickup.
- The customer's status page: `/order/<id>?k=<key>`, linked from the confirmation. The key is the first 128 bits of a keyed hash of the
  order id (`statusToken`, label "status"), checked in constant time; nothing is stored, and changing PIN_PEPPER ends old links.
  `/api/order-status` answers only the first name, the items and the state (requested, payment, preparing, ready with its hold date,
  shipped, collected, cancelled): no email, phone, address or money. The page sends no referrer and is never indexed.

## Customer sign-in codes and other keyed hashes (2026-11-27)
- Lockouts (fleet/guard4; breaker: 3 requests or 15 wrong guesses typed with someone's email locked them out): code requests are 3 per
  15 minutes per inbox AND network, 10 an hour per inbox from every network, 20 an hour per network, 1000 shop-wide. Wrong codes:
  15 a day per inbox AND network stop that network asking or typing codes for that inbox (the customer's own network is not
  affected); 100 a day per inbox from every network (NIST's ceiling) stop typed codes for it, while the one-tap link in the code
  email (256 bits, cannot be guessed) still signs in, so the real customer always has a way in. 30 wrong in 15 minutes per network
  stays. Known limit: someone asking 10 codes an hour for one inbox from many networks keeps it from getting new codes for that hour.
- The sign-in code limits count a visitor the way every other limit does (IPv6 by its /56) and store the visitor, the inbox and the
  code itself only as hashes keyed with the Worker secret (`keyedHash`: label, `PIN_PEPPER` or `ADMIN_KEY`, value). Before, they were
  plain SHA-256, which a list of IPv4 addresses or emails (or the 10^6 codes) undoes. The privacy page says "a coded form ... made with
  a secret key". Codes outstanding at deploy (10 minutes) stop working once.

## The public delivery check (2026-11-27)
- While card payment is off, `/api/delivery` answers `{ status: "down", pickup_only: true }` with no Geoapify lookup (delivery cannot
  be ordered). With card on, each visitor (IPv6 by /56, keyed hash, `v:` rows in `login_attempts`, deleted after a day) gets 30 real
  map lookups an hour across every Worker, counted and written in one statement so a burst cannot pass it; checkout's local-delivery
  quote uses the same count (breaker, 2026-11-27: a wrong fee made checkout a free lookup). A cached address is free. The
  per-instance speed bump stays behind it.

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
- `/api/intake/<link>` takes at most 5 sends a day from one place, 10 from one IPv6 /48 and 30 a day in all (rows in
  `login_attempts` under `k:` and `q:` with keyed hashes of the address, deleted after a day), at most 200 KB each, and stops taking
  sends once 300 are kept. The shop's own sends skip those counts and are not counted (breaker: 6 outside addresses could use up the
  day and block the shop): a browser signed in to the back office, or a shop device that signed in before (`oss_dev`, see staff
  sign-in). They are labelled "sent from a shop device".
  Each send is its own file labelled with its time, a short place tag (keyed hash, never the address) and its country;
  the back office lists every send that way, says whether each came from the same place as the first send, and the
  owner picks which to read, so a stranger's newer send cannot pass for the shop's. The owner removes a send from the back office
  (`DELETE /api/admin/intake`, owner only, only `intake/<dated name>.json`, logged as `intake.delete`), which also makes room under 300.
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
- A stranger can still slow a staff name, and lock it for a day for devices and places never seen signing in. Cloudflare
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

