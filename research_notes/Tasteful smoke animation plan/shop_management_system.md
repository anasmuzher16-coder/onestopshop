# Shop management system for a custom online store (inventory, orders, analytics)

All sources read 2026-11-14 unless a line says otherwise. Cloudflare, Medusa, Saleor, Swell, Snipcart, Plausible, Fathom and Lightspeed prices are USD (or EUR for Vendure) as published; Shopify, Square and Stripe prices are from their Canadian pages in CAD. "COULD NOT VERIFY" marks anything not confirmed on a primary page.

## 1. Cloudflare architecture options for a custom back office: limits and prices

### Takeaway
Everything a one-shop back office needs (D1 for products, stock and orders; R2 for photos; image transformations; Durable Objects for last-item reservation; Queues; Analytics Engine) fits inside the Workers Free plan at small-shop volume, and the Workers Paid plan is a flat US$5/month minimum that raises every quota by orders of magnitude. The real constraints are the free plan's 10 ms CPU per request, 50 D1 queries per request, and 5,000 unique image transformations per month.

### Cited Findings

| Service | Free plan | Workers Paid (US$5/mo minimum per account) | Source |
|---|---|---|---|
| Workers requests | 100,000/day | 10M/month included, then US$0.30 per million | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Workers CPU | 10 ms per invocation | 30M CPU-ms/month included, then US$0.02 per million; up to 5 min per invocation (default 30 s) | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Static assets | Free and unlimited | Free and unlimited | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1 rows read | 5M/day | 25B/month included, then US$0.001 per million | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| D1 rows written | 100,000/day | 50M/month included, then US$1.00 per million | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| D1 storage | 5 GB total | 5 GB included, then US$0.75 per GB-month | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| D1 max database size | 500 MB | 10 GB (cannot be increased) | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| D1 databases per account | 10 | 1,000,000 (first 100,000 included) | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| D1 queries per Worker invocation | 50 | 1,000 | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| D1 Time Travel (point-in-time restore) | 7 days | 30 days | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| D1 row / string / BLOB max | 2 MB | 2 MB | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| D1 bound parameters per query | 100 | 100 | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| D1 max query duration | 30 s | 30 s | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| R2 storage (Standard) | 10 GB-month free | US$0.015 per GB-month | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| R2 Class A ops (writes, lists) | 1M/month free | US$4.50 per million | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| R2 Class B ops (reads) | 10M/month free | US$0.36 per million | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| R2 egress | Free | Free | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Images: transformations | 5,000 unique/month free | First 5,000 included, then US$0.50 per 1,000 unique/month | [Images pricing](https://developers.cloudflare.com/images/pricing/) |
| Images: stored in Cloudflare Images | Not on free | US$5 per 100,000 images stored/month | [Images pricing](https://developers.cloudflare.com/images/pricing/) |
| Images: delivered from Cloudflare Images | Not on free | US$1 per 100,000 delivered/month | [Images pricing](https://developers.cloudflare.com/images/pricing/) |
| KV reads | 100,000/day | 10M/month, then US$0.50 per million | [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/) |
| KV writes / deletes / lists | 1,000/day each | 1M/month each, then US$5.00 per million | [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/) |
| KV storage | 1 GB | 1 GB included, then US$0.50 per GB-month | [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/) |
| Durable Objects requests | 100,000/day (SQLite backend only) | 1M/month, then US$0.15 per million | [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| Durable Objects duration | 13,000 GB-s/day | 400,000 GB-s/month, then US$12.50 per million GB-s | [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| Durable Objects SQLite storage | 5M rows read/day, 100,000 rows written/day, 5 GB total | 25B rows read and 50M rows written per month included; 5 GB-month then US$0.20 per GB-month | [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| Queues | 10,000 operations/day, 24 h retention | 1M operations/month, then US$0.40 per million; retention 4 days default, up to 14 | [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| Workers Analytics Engine | 100,000 data points written/day, 10,000 read queries/day | 10M data points/month then US$0.25 per million; 1M read queries then US$1.00 per million | [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) |
| Web Analytics | Free | Free | [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) |

- Free-plan daily limits reset at 00:00 UTC; on D1, KV and Durable Objects, once a free limit is hit further operations of that type fail with an error. - [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/); [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/); [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- D1 charges no egress or bandwidth fees. - [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- A `db.batch()` call counts as one query against the queries-per-invocation limit; each Worker invocation can open up to six simultaneous D1 connections; max query result size is 50 MB effective 2026-11-04. - [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- D1 `batch()`: "Batched statements are SQL transactions"; a failed statement "aborts or rolls back the entire sequence". The page documents no interactive BEGIN/COMMIT. - [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- Durable Objects are "single-threaded and cooperatively multi-tasked", each has "a globally-unique name" and "its own durable, transactional, and strongly consistent storage", and they provide "a single-point-of-coordination between Cloudflare Workers". - [What are Durable Objects](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/)
- Durable Objects on the free plan work only with the SQLite storage backend; the key-value backend needs Workers Paid. - [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- A unique image transformation is one source image plus one set of parameters, counted once per calendar month; `format` and `quality` do not create a new one. Over the free 5,000, already-cached transformations keep serving, new ones return error `9422`, and there is no charge. - [Images pricing](https://developers.cloudflare.com/images/pricing/)
- Transformations work on remote images stored outside Cloudflare Images, are switched on per zone in the dashboard, and by default only accept source images from the same zone (other origins can be allowed). - [Transform images](https://developers.cloudflare.com/images/transform-images/)
- A queue message typically costs 3 operations (write, read, delete); an operation is counted per 64 KB. - [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- Analytics Engine: "Currently, you will not be billed for your use of Workers Analytics Engine"; listed prices are advance notice. - [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)
- Web Analytics "does not use any client-side state, such as cookies or localStorage", does not fingerprint via IP or User Agent, and works either by a JavaScript beacon or from the edge for proxied sites. - [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)

### Inferences
- Sizing: a product with 4 photos served at 3 widths is 12 unique transformations a month. 5,000 free transformations covers roughly 400 such products; beyond that it is US$0.50 per extra 1,000. Because `format` and `quality` are free dimensions, AVIF/WebP negotiation does not multiply the count. Keeping a fixed, small set of widths is what keeps this free.
- Storing originals in R2 and transforming on the fly avoids the US$5 per 100,000 "images stored" product entirely; R2's 10 GB free holds about 3,000 photos at 3 MB each.
- 100,000 D1 row writes a day is far above a single shop's needs (an order with 3 lines, stock movements and an audit row is under 20 writes). The free limit that bites first is 50 queries per request on bulk import or bulk edit; batching (one `batch()` = one query) or the US$5 plan (1,000) removes it.
- The 10 ms free CPU limit is the practical reason to budget for US$5/month: CSV import, signature checks on webhooks and order PDF or email rendering can exceed it.
- Two workable designs for "two buyers, one last item": (a) a single conditional D1 statement inside a `batch()` (`UPDATE ... SET available = available - ? WHERE id = ? AND available >= ?`, then check rows changed), which is atomic because D1 has one writer; (b) a Durable Object per product or one for the whole shop that holds timed reservations during checkout. (a) is simpler and enough for decrement-at-payment; (b) is needed only if the cart must hold stock for N minutes before payment. This is reasoning from the documented properties above, not a Cloudflare recommendation for inventory specifically.
- KV is eventually consistent by design and its free tier allows only 1,000 writes a day, so it suits cached catalogue JSON for the storefront, not stock counts.
- Realistic running cost: US$0 on free, US$5/month on paid, plus any transformations over 5,000.

### Gaps
- Analytics Engine data retention period: not stated on the pricing page. COULD NOT VERIFY; the Analytics Engine limits page would confirm.
- Exact transformation URL format, supported output formats and input size limits were not on the page read; the Images "transform via URL" and limits subpages would confirm.
- Whether Durable Object SQLite storage billing (page says it starts January 2026) is now live as described: the page still words it as upcoming. Current invoice or changelog would confirm.

## 2. Authentication for one or two staff logins without building password handling

### Takeaway
Cloudflare Access in front of the admin path is the simplest safe choice: free for up to 50 users, no password code to write, and login by emailed one-time code with no identity provider needed. Passkeys are well supported (about 95% of browsers) but mean building enrolment and recovery yourself.

### Cited Findings
- Zero Trust Free plan: "$0" "forever", 50 users, includes ZTNA (Access), community support, log retention up to 24 hours. Pay-as-you-go: US$7 per user per month, log retention up to 30 days. - [Cloudflare Zero Trust plans](https://www.cloudflare.com/plans/sase-zero-trust.md)
- Access one-time PIN: the user enters an email, and if an Access policy allows that address Cloudflare emails a code; it expires 10 minutes after the request and is single use; no identity provider is required; blocked addresses see the same "code emailed" message but get nothing. - [One-time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- Known OTP failure: mail security tools that follow links can consume the code first, giving an "already used" error. - [One-time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- Passkeys: supported in Safari on iOS from 16.0, Chrome for Android (157 listed), Chrome and Edge 108+, Safari 16.1+, Firefox 122+; global usage 95.43%. - [caniuse: passkeys](https://caniuse.com/passkeys)

| Option | Code to write | Running cost | Main risk |
|---|---|---|---|
| Cloudflare Access, email one-time PIN | None for login; Worker only verifies the Access JWT | US$0 up to 50 users | Depends on the owner's email account security; code can be eaten by mail scanners |
| Cloudflare Access with Google login | None | US$0 up to 50 users | Owner needs a Google account; inherits its 2-step setup |
| Passkeys (WebAuthn) built in-house | Registration, login, session, device loss recovery | US$0 | Recovery flow is where home-built auth goes wrong |
| Magic links built in-house | Token issue, expiry, session, email sending | Email provider cost | Same mail-scanner problem; you own the session security |

Sources for the table rows: [Cloudflare Zero Trust plans](https://www.cloudflare.com/plans/sase-zero-trust.md); [One-time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/); [caniuse: passkeys](https://caniuse.com/passkeys). The "code to write" and "main risk" columns are inference.

### Inferences
- Access OTP is effectively a managed magic link, so building magic links yourself adds work and no safety.
- With Access the audit log should still record the staff email from the verified token, since Access's own free-plan logs last only 24 hours.
- A sensible layering: Access now; add passkeys later only if the owner finds emailed codes annoying.

### Gaps
- The OTP docs page does not itself say OTP is on the free plan. The plans page lists Access (ZTNA) on Free; COULD NOT VERIFY the OTP method specifically. The Zero Trust dashboard on a free account would confirm.
- Session length defaults for Access were not read.

## 3. Build versus adopt for the commerce backend (bespoke storefront and bespoke admin kept)

### Takeaway
For this shop the commerce backend choice is driven less by features than by two facts: payment processors treat tobacco-adjacent goods as restricted, and every adopted backend either costs a fixed monthly fee, takes a percentage, or needs a Node/Postgres server that Workers does not host. Building the small backend on D1 with a processor that explicitly approves the merchant is the cheapest route; Square is the only adopt option whose POS, catalogue, inventory and webhooks come at no monthly fee, but its payment terms prohibit online orders of age-restricted products.

### Cited Findings

**Platform cost comparison**

| Option | Monthly cost | Transaction fees | Admin you get | Source |
|---|---|---|---|---|
| Shopify Basic (headless via Storefront API) | CA$49 monthly, CA$37/mo on annual | Shopify Payments 2.8% + 30c online, 2.6% in person; 2% extra if a third-party processor is used | Full Shopify admin and mobile app; additional staff accounts not included | [Shopify pricing CA](https://www.shopify.com/ca/pricing) |
| Shopify Grow | CA$132 monthly, CA$99/mo annual | 2.6% + 30c online, 2.5% in person; 1% third-party fee | 5 staff accounts | [Shopify pricing CA](https://www.shopify.com/ca/pricing) |
| Shopify Advanced | CA$517 monthly, CA$389/mo annual | 2.4% + 30c; 0.6% third-party fee | 15 staff accounts | [Shopify pricing CA](https://www.shopify.com/ca/pricing) |
| Shopify POS Pro add-on | CA$119/mo per location | n/a | n/a | [Shopify pricing CA](https://www.shopify.com/ca/pricing) |
| Square (Free plan) | CA$0 | 2.5% in person; 2.8% + 30c online incl. eCommerce API; 3.3% + 15c keyed; debit card present 0.75% + 7c; +1.5% for non-Canadian cards | Square Dashboard, item library, POS app | [Square pricing CA](https://squareup.com/ca/en/pricing) |
| Square Plus | From CA$35/mo | Same table of rates | More features | [Square pricing CA](https://squareup.com/ca/en/pricing) |
| Stripe (payments only, own backend) | CA$0 | 2.9% + CA$0.30 domestic cards; +0.8% international; +2% conversion; Terminal 2.7% + CA$0.05; Interac in person CA$0.15; dispute CA$15 | Stripe Dashboard for payments only | [Stripe pricing CA](https://stripe.com/en-ca/pricing) |
| Stripe Tax (optional) | n/a | 0.5% per transaction (no-code) or CA$0.50 per transaction via API incl. 10 calculation calls | n/a | [Stripe pricing CA](https://stripe.com/en-ca/pricing) |
| Medusa Cloud | Develop from US$29, Launch from US$99, Scale from US$299 | 0% GMV fee | Medusa Admin included, unlimited users | [Medusa pricing](https://medusajs.com/pricing/) |
| Saleor Cloud | Select US$1,599/mo (to US$200,000 GMV/mo), Volume US$3,999/mo; free sandbox for prototyping only | 0.8% / 0.4% over the GMV limit | Saleor Dashboard | [Saleor pricing](https://saleor.io/pricing) |
| Vendure | Open source GPLv3 with plugin exception; commercial plans Starter EUR 199/mo (annual), Growth EUR 599, Scale EUR 2,499 | None stated | Not described on pricing page | [Vendure pricing](https://vendure.io/pricing) |
| Swell | Starter US$29/mo, Basic US$79, Standard US$299 (yearly billing; monthly costs more) | 2% / 1.5% / 1% of sales above the plan's 12-month revenue ceiling (US$50K / 250K / 1M) | 2 / 5 / 15 admin users; 100K / 500K / 2M API requests | [Swell pricing](https://www.swell.is/pricing) |
| Snipcart | US$20/mo if monthly sales are under US$1,000 | 2% of sales plus gateway fees | Merchant dashboard, inventory, abandoned cart recovery | [Snipcart pricing](https://snipcart.com/pricing) |
| Lightspeed Retail (X-Series) | Basic US$89, Core US$149, Plus US$289 per month | Lightspeed Payments 1.5% card present (online rate not listed) | Lightspeed back office; built-in eCommerce on all three ("Basic" version on Basic) | [Lightspeed Retail pricing](https://www.lightspeedhq.com/pos/retail/pricing/) |

- Shopify Storefront API: "Buyer traffic isn't rate-limited at all"; bot limits and a checkout throttle apply. - [Shopify API limits](https://shopify.dev/docs/api/usage/limits)
- Vendure Cloud is in closed beta with general availability planned for Q1 2027. - [Vendure pricing](https://vendure.io/pricing)

**Whether a hookah and accessories merchant is allowed**

| Processor | What the published list says | Source |
|---|---|---|
| Stripe (Canada) | Restricted, needs approval: "Tobacco products, including e-cigarettes, cigars and e-liquid sold in accordance with applicable law". Prohibited: "Equipment and items intended to be used for making or using drugs". Restricted businesses need extra due diligence and Stripe "might not be able to grant approval". Hookahs and smoking accessories are not named. | [Stripe restricted businesses](https://stripe.com/en-ca/legal/restricted-businesses) |
| Shopify Payments (Canada) | Processor for Canada is "Stripe Payments Canada, Ltd." and the prohibited list is Stripe's list. | [Shopify processor list](https://www.shopify.com/legal/processor-list); [Shopify Payments terms CA](https://www.shopify.com/legal/terms-payments/ca) |
| Square (Canada) | Prohibited: "(24) internet/mail order/telephone order of age restricted products (e.g., fireworks, e-cigarettes)"; "(25) cigars, including any roll of tobacco wrapped in either leaf tobacco or any other substance containing tobacco"; "(2) paraphernalia that may be used for illegal activity"; "(26) cannabis or cannabis byproducts". Hookahs not named. | [Square Payment Terms CA](https://squareup.com/ca/en/legal/general/payment) |
| PayPal (Canada) | Search snippet of the Canadian policy: pre-approval required for "Non-cigarette tobacco products, e-cigarettes, cigars"; transactions involving "drug paraphernalia" and "cigarettes" are restricted. The page itself returned HTTP 403 to the fetch tool. PARTLY VERIFIED (search snippet only). | [PayPal AUP CA](https://www.paypal.com/ca/legalhub/acceptableuse-full) |

- Shopify platform (separate from payments): multiple trade and vendor sources report Shopify told merchants selling electronic nicotine delivery systems to remove them by 2026-07-08 or face suspension; sources conflict on whether it is US-only or global and on whether accessories are covered; none mention hookah. These are secondary sources. - [TaxCloud](https://taxcloud.com/sales-tax-radar/shopify-bans-all-vape-products-from-its-platform/); [Shopify Community thread](https://community.shopify.com/t/shopify-to-ban-vape-stores/639458)

### Inferences
- None of the four processors names hookahs or shisha accessories. Hardware (pipes, hoses, bowls, charcoal) falls in a grey zone between "tobacco products" (restricted) and "items intended to be used for ... drugs" (prohibited); shisha tobacco itself is plainly a tobacco product. The safe planning assumption is: written pre-approval from the chosen processor before building around it, and a catalogue flag that can hide tobacco-containing products from online checkout.
- Square's item 24 is the sharpest risk for an adopt-Square plan: if any product is age-restricted, taking the online order through Square breaches the terms even though in-person sale of the same item is fine.
- Shopify headless would cost CA$444 to CA$588 a year before fees, replaces the bespoke admin with Shopify's, and carries platform policy risk for this category in 2026. It contradicts the goal of a custom admin.
- Medusa, Saleor and Vendure are Node plus Postgres servers. They do not run on Workers, so adopting one adds a second host and a monthly bill (US$29+ on Medusa Cloud) and gives an admin the studio would then replace anyway. Saleor Cloud's pricing puts it out of range.
- Snipcart and Swell both take a cut or a fee for functions (cart, inventory, dashboard) that the bespoke build is meant to own.
- Cost floor for build: US$0 to US$5/month Cloudflare plus card fees (2.9% + CA$0.30 on Stripe, if approved).

### Gaps
- Shopify Starter plan price in CAD and whether the Headless channel works on it: community posts conflict and the CA pricing page read does not list Starter. COULD NOT VERIFY; Shopify support or a Starter admin would confirm.
- Lightspeed prices are from the global page in USD; the Canadian pricing URL returned 404. CAD figures and whether the listed prices are the annual or monthly rate: COULD NOT VERIFY; a Lightspeed Canada quote would confirm.
- Lightspeed and Moneris restricted-business lists were not found.
- Whether Stripe or Square will actually approve this specific merchant: only an application or written answer from each will confirm.
- Whether the reported Shopify vape ban applies in Canada or to hookah: no primary Shopify page found.
- Canadian federal and Ontario rules on selling tobacco products and accessories online (age verification, shipping) were out of scope here and not researched; they affect which products can be listed for delivery.

## 4. In-store and online stock in one place (POS sync)

### Takeaway
The standard pattern is one system of record for stock, with the other side updated by webhooks plus a periodic full reconcile. Square has the most complete free tooling for this (Catalog API, Inventory API, an `inventory.count.updated` webhook fired by POS sales). Clover has inventory endpoints and is mid-way through changing its stock webhooks. Moneris shows no public inventory API.

### Cited Findings

| POS | Inventory API | Webhooks | Notes | Source |
|---|---|---|---|---|
| Square | Inventory API tracks InventoryCount, InventoryAdjustment, InventoryPhysicalCount per CatalogItemVariation; states include IN_STOCK, SOLD, WASTE; needs `INVENTORY_READ` / `INVENTORY_WRITE` | `inventory.count.updated` fires on a completed sale in Square Point of Sale, an Orders API order, a Dashboard "Manage stock" edit, or a BatchChangeInventory call; up to 100 counts per notification | Respond 2xx within 10 seconds; dedupe on `event_id`; InventoryTransfer retired as of version 2026-07-15 | [Square Inventory API](https://developer.squareup.com/docs/inventory-api/what-it-does); [Square inventory webhooks](https://developer.squareup.com/docs/inventory-api/webhooks) |
| Square Catalog | Items, variations (up to 250 per item), images, categories, modifiers, taxes; custom attribute definitions exist; needs `ITEMS_READ` / `ITEMS_WRITE`; writes need an idempotency key | Page links to a "Sync Your External Catalog" webhooks guide | | [Square Catalog API](https://developer.squareup.com/docs/catalog-api/what-it-does) |
| Clover | REST endpoints to get all items' stock, get one item's stock, update and delete item stock; quantity is updated only through `item_stocks` | Item webhook being split into three topics; new Item Stock topic fires on manual or API stock updates and low-stock breaches; in sandbox from 2026-07-07; general Item webhook does not fire on plain stock changes unless the low-stock threshold is hit | Needs an app with Read Inventory permission | [Clover inventory webhook changes](https://docs.clover.com/dev/docs/upcoming-changes-to-inventory-webhooks); [Clover request inventory stock](https://docs.clover.com/dev/docs/querying-inventory); [Clover webhooks](https://docs.clover.com/docs/webhooks) |
| Lightspeed Retail | Not read | Not read | Built-in eCommerce on all plans | [Lightspeed Retail pricing](https://www.lightspeedhq.com/pos/retail/pricing/) |
| Moneris Go Retail | No public inventory API found | None found | Moneris pairs its POS with an online store "built on the Wix platform"; developer portal covers payment and terminal integration | [Moneris Total Commerce](https://go.moneris.com/totalcommerce); [Moneris Go cloud integration](https://developer.moneris.com/moneris-go/docs/cloud-integration) |

### Inferences
- If the shop already runs Square POS: make Square the system of record for counts, mirror counts into D1 from the webhook, push web orders to Square as inventory adjustments, and run a nightly full count pull to heal missed webhooks. The bespoke admin then edits products through the Catalog API or keeps web-only fields (box size, weight, extra photos) in D1 keyed by Square variation id.
- If the shop runs Moneris or a terminal-only setup: there is nothing to sync against. The bespoke admin becomes the system of record and in-store sales need a fast "sold in store" action on the phone (scan or tap to decrement), or a simple counter-sale screen.
- Webhooks alone are not enough on any POS; a scheduled reconcile is the usual safeguard (Clover's own community advice per the search result, and Square's 100-count batches and retry rules imply the same).
- A small oversell buffer for web (for example, hide the last unit online when a POS is the source of truth) covers the seconds between a counter sale and the webhook.

### Gaps
- Which POS the shop uses is unknown; this decides the whole section.
- Clover Item Stock webhook production date: not given. COULD NOT VERIFY.
- Lightspeed Retail API and webhook details were not read; Lightspeed developer docs would confirm.
- Whether Square APIs carry any charge beyond processing fees: the docs pages read do not mention cost. COULD NOT VERIFY from those pages.
- Whether Square custom attributes can hold weight and box dimensions: not confirmed; the "Add Custom Attributes" page would confirm.

## 5. What the best small-merchant admin experiences do well, and phone-first patterns

### Takeaway
The admired admins share a few concrete moves: a home screen that leads with tasks waiting and four numbers, spreadsheet-style bulk edit with CSV as the escape hatch, every stock change recorded with who, when and why, and camera-first product and stock entry on the phone. The browser BarcodeDetector API works on Android Chrome but is still switched off by default in iOS Safari, so iPhone scanning needs a fallback.

### Cited Findings
- Shopify Home default metrics: sessions, total sales, total orders, conversion rate; default range last 30 days across all channels; plus open order tasks with counts (capture payments, fulfil orders, process returns, review high-risk orders, submit chargeback evidence); new stores see setup tasks first. - [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home)
- Shopify bulk editor: a table where "each column in the table represents a product property" and "each row ... a selected product or product variant"; arrow-key navigation, multi-cell select, drag fill handle; columns chosen by the user; changes apply on Save; for larger volumes Shopify points to CSV files for products, inventory or customers. - [Shopify bulk editing](https://help.shopify.com/en/manual/shopify-admin/productivity-tools/bulk-editing-products)
- Shopify inventory: "Every adjustment is recorded", showing who changed a quantity, when, and why. - [Shopify inventory adjustment history](https://help.shopify.com/en/manual/products/inventory/managing-inventory-quantities/inventory-adjustment-history)
- Shopify mobile app listing: upload product photos, set product details, "Scan barcodes to adjust inventory". (App Store listing via search result.) - [Shopify app, App Store](https://apps.apple.com/sg/app/id371294472)
- Square models stock as movements between states (IN_STOCK to SOLD, WASTE) with separate physical counts for reconciling, and optional reason, cost and vendor on adjustments. - [Square Inventory API](https://developer.squareup.com/docs/inventory-api/what-it-does)
- Square Dashboard app lets the owner pick up to four tools for the bottom navigation bar and offers an iOS home-screen widget with gross sales, net sales, transactions and average sale. - [Square Dashboard app](https://squareup.com/help/ca/en/article/5618)
- Clover's new stock webhook includes low-stock threshold breaches as a first-class event. - [Clover inventory webhook changes](https://docs.clover.com/dev/docs/upcoming-changes-to-inventory-webhooks)
- D1 Time Travel gives point-in-time restore for 7 days (free) or 30 days (paid). - [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

**BarcodeDetector support (browser scanning)**

| Browser | Status | Source |
|---|---|---|
| Chrome for Android | Supported (157 listed) | [caniuse BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector) |
| Samsung Internet | Supported from 13.0 | [caniuse BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector) |
| Safari on iOS | Not supported to 16.7; "disabled by default" in 17.0 through 27.2 | [caniuse BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector) |
| Chrome desktop | Partial support 83 to 160 | [caniuse BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector) |
| Firefox (desktop and Android) | Not supported | [caniuse BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector) |

- MDN marks the API experimental and "not Baseline because it does not work in some of the most widely-used browsers"; secure context (HTTPS) only; formats include `ean_13`, `ean_8`, `upc_a`, `upc_e`, `code_128`, `code_39`, `qr_code`; feature-detect with `"BarcodeDetector" in globalThis` and call `getSupportedFormats()`. - [MDN Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API)

### Inferences
- On iPhone, scanning needs a JavaScript or WebAssembly decoder fed from `getUserMedia` as the fallback, loaded only when the native API is missing. No specific library was verified in this research.
- Camera to listing on the web needs no special API: `<input type="file" accept="image/*" capture="environment">` opens the phone camera; resize in the browser before upload to R2 to keep uploads fast on mobile data. (Standard web platform behaviour, not verified against a source in this session.)
- Patterns to copy into a first version, each traceable to the findings above:
  - Home: "needs you" list first (orders to pack, items low or out), then four numbers.
  - Product entry: photo first, then name, price, stock; weight and box size chosen from saved box presets rather than typed every time, since Canada Post rating depends on them.
  - Variants as rows under a product, each with its own price, stock, weight, barcode.
  - Stock as a ledger of movements (sale, received, count correction, damaged) with who, when, why; the on-hand number is the sum. This gives audit log and undo (a reversing entry) for free.
  - Low-stock threshold per variant, shown as a filter and a home-screen count; email only as a daily digest.
  - Bulk edit as a simple grid on desktop; on phone, per-item quick edit. CSV export always, CSV import for prices and counts.
  - Soft delete (archive) for products so order history stays intact; undo toast for destructive actions.
  - D1 Time Travel as the disaster undo behind all of it.
- First version scope that matches the owner's stated needs: products and variants with photos; stock ledger with low-stock list; orders list with status, packing slip and refund note; home screen; CSV export; audit log; Access login. Later: barcode scanning, bulk grid, POS sync, abandoned carts.

### Gaps
- Stripe Dashboard and Big Cartel admin specifics were not researched in this session.
- Shopify's official help text on creating a product from the phone camera was not found; only the App Store listing line. COULD NOT VERIFY the exact flow.
- Which desktop operating systems Chrome's "partial" BarcodeDetector support covers: caniuse summary did not say; the MDN compatibility table would confirm.
- Whether iOS Safari 27 exposes the flag to ordinary users: not checked; irrelevant for a non-technical owner either way.

## 6. Which analytics a small shop owner actually uses

### Takeaway
The two reference products both open on a very small set: Shopify shows sessions, total sales, orders and conversion rate; Square shows gross sales, net sales, transactions and average sale. Inventory insight is a second tier: sell-through, days of stock left, ABC grading and stock value.

### Cited Findings
- Shopify Home defaults: sessions, total sales, total orders, conversion rate, last 30 days. - [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home)
- Shopify's Analytics page shows "key sales, sessions, and fulfillment metrics" with cards that can be added, removed and rearranged. - [Shopify overview dashboard](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/overview-dashboard)
- Square Dashboard app Home: gross sales, net sales, transactions, average sale amount, with comparison to prior dates; returns, discounts and comps also viewable; item and category breakdowns are one tap away. - [Square Dashboard app (US article)](https://square.com/help/us/en/article/5618-get-started-with-the-square-dashboard-app); [Square Dashboard app (CA article)](https://squareup.com/help/ca/en/article/5618)
- Square definitions: net sales = gross sales minus discounts and refunds. - [Square glossary](https://square.com/help/gb/en/article/5200-square-glossary)
- Shopify default inventory reports and formulas: - [Shopify inventory reports](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/inventory-reports)

| Report | Formula as documented |
|---|---|
| Sell-through rate | quantity sold / (quantity sold + quantity still in inventory), most recent 30 days |
| Days of inventory remaining | ending quantity / average quantity sold per day over the last 28 days; N/A when no sales |
| ABC product analysis | variants making up the top 80% of 28-day revenue are A, next 15% B, last 5% C |
| Month-end inventory value | cost per item x ending quantity, summed |
| Products by percentage sold | quantity sold / starting quantity |

- Conversion rate is orders divided by visitors; average order value is revenue divided by orders over the same range; one small-business guide advises checking most KPIs weekly. - [Fit Small Business ecommerce KPIs](https://fitsmallbusiness.com/ecommerce-kpis/); [Xero ecommerce metrics](https://www.xero.com/ca/guides/ecommerce-metrics/)

### Inferences
- Home screen for this shop: sales today and this week (with the same period last week), orders, average order value, and items low or out. Conversion rate needs a visitor count, which a cookie-less tool or Analytics Engine can supply.
- Second screen ("How the shop is doing"): best sellers, slow movers (no sales in 28 days with stock on hand), stock on hand value at cost (needs a cost field per variant), days of stock left, sales by province, shipping charged versus Canada Post cost paid.
- "Shipping collected versus paid" and "top postal regions" are not default cards in either reference product, but both fall straight out of the order table in a custom build (store the quoted rate, the label cost, and the first three postal code characters).
- Abandoned carts need a server-side cart record and an email address before checkout; it is a later feature and carries consent implications (see section 7).

### Gaps
- No merchant survey ranking which numbers owners actually open most was found; the evidence here is what the two leading products put first, plus general guides.
- The full default card list of Shopify's Analytics overview was not on the page read.
- Square's Canadian article did not list Home tab metrics; the US article did.

## 7. Privacy and compliance for a Canadian store's own analytics and customer data

### Takeaway
PIPEDA applies to any business handling personal information across provincial borders, so a shop shipping Canada-wide is covered; Quebec's private-sector law adds a default-off rule for technology that identifies, locates or profiles. Cookie-less, non-identifying analytics (Cloudflare Web Analytics free; Plausible from US$9/month; Fathom from US$15/month) sidestep most of the consent question.

### Cited Findings
- PIPEDA "applies to private-sector organizations across Canada" that collect, use or disclose personal information in commercial activity; Alberta, British Columbia and Quebec have substantially similar laws for activity within those provinces; any business handling personal information that crosses provincial or national borders is subject to PIPEDA. - [OPC: PIPEDA in brief](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/)
- The 10 fair information principles: accountability; identifying purposes; consent; limiting collection; limiting use, disclosure and retention; accuracy; safeguards; openness; individual access; challenging compliance. - [OPC: PIPEDA in brief](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/)
- Breaches that "pose a real risk of significant harm to individuals" must be reported to the OPC and affected people notified "as soon as feasible"; a record of every breach must be kept for two years; knowingly contravening these is an offence that can lead to fines. - [OPC: privacy breaches at your business](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/)
- Quebec (secondary source, law firm): section 8.1 of the private-sector act covers technology with functions that "identify, locate or profile"; the revised wording "implies that the technology must be deactivated by default"; section 9.1 is the only provision that mentions cookies. - [McCarthy Tetrault: Law 25 and cookies](https://mccarthy.ca/en/insights/blogs/techlex/quebecs-law-25-and-cookies-not-so-cookie-cutter)
- Quebec government guidance for public bodies states functions enabling identification, location or profiling must be deactivated by default. - [Quebec.ca: identification, localisation et profilage](https://www.quebec.ca/gouvernement/travailler-gouvernement/normes-gouvernance-pratiques-internes/protection-des-renseignements-personnels/technologie-et-droit-a-la-protection-des-renseignements-personnels/identification-localisation-profilage)

| Analytics tool | Price | Cookies | Source |
|---|---|---|---|
| Cloudflare Web Analytics | Free | No cookies or localStorage; no fingerprinting by IP or User Agent | [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) |
| Plausible | Starter US$9/month, up to 10k monthly pageviews; Growth, Business, Enterprise above | "No cookies"; no persistent identifiers, no cross-site or cross-device tracking; open source, can be self-run | [Plausible](https://plausible.io/) |
| Fathom | US$15/month, 100,000 monthly pageviews, 50 sites; event and revenue tracking on all plans | "No cookie banners required" | [Fathom pricing](https://usefathom.com/pricing) |
| Workers Analytics Engine (own events) | Free quota 100,000 data points/day; not currently billed | Whatever the build writes | [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) |

### Inferences
- A workable baseline: Cloudflare Web Analytics for traffic, order-derived numbers from D1 for everything else, no third-party marketing pixels. With no identifiers stored and no profiling, the Quebec default-off rule is unlikely to be triggered; this is a reading of secondary sources, not legal advice.
- Admin requirements that follow from PIPEDA: a named privacy contact and plain privacy notice; collect only what an order needs; an export and delete (or anonymise) action per customer for access requests; a breach log; staff access limited and logged.
- Deleting customer data conflicts with the six-year tax record rule (section 8); the usual answer is to keep the order and tax fields and strip marketing data.
- Abandoned-cart emails and any per-visitor tracking move the shop into consent territory, particularly for Quebec visitors.
- Order regions shown as province or first three postal characters keep the analytics view non-identifying.

### Gaps
- The Commission d'acces a l'information's own guidance and the statute text on Legis Quebec could not be fetched (404 and 403). The exact wording of sections 8.1 and 9.1, and whether aggregate cookie-less analytics need consent in the CAI's view: COULD NOT VERIFY. The CAI consent guidelines or legisquebec.gouv.qc.ca chapter P-39.1 would confirm.
- Cloudflare Web Analytics limits (sites, retention, sampling) and how a "visit" is defined were not on the pages read.
- Plausible's self-hosted licence name was not on the page read.
- CASL (email marketing consent) was not researched and matters for abandoned-cart and newsletter features.

## 8. Tax and order record needs in Canada that the admin must cover

### Takeaway
GST/HST is charged by where the goods are delivered: 13% Ontario, 15% in New Brunswick, Newfoundland and Labrador and PEI, 14% Nova Scotia, 5% elsewhere. Order and tax records must be kept six years in Canada, and invoices at or above CA$100 must show the GST/HST number and tax.

### Cited Findings

| Province or territory | GST/HST to charge | Separate provincial tax (not collected by CRA) |
|---|---|---|
| Ontario | 13% HST | n/a |
| New Brunswick | 15% HST | n/a |
| Newfoundland and Labrador | 15% HST | n/a |
| Prince Edward Island | 15% HST | n/a |
| Nova Scotia | 14% HST (15% until 2025-03-31) | n/a |
| Quebec | 5% GST | QST 9.975% |
| British Columbia | 5% GST | PST 7% |
| Manitoba | 5% GST | RST 7% |
| Saskatchewan | 5% GST | PST 6% |
| Alberta, Northwest Territories, Nunavut, Yukon | 5% GST | none |

Source: [CRA GST/HST calculator and rates](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html), which also states the rate depends on "Where the supply is made".

- Records must be kept "for a period of six years from the end of the last tax year they relate to", at the place of business or residence in Canada unless the CRA gives written permission; "Records kept outside of Canada and accessed electronically from Canada are not considered to be records kept in Canada"; early destruction needs written CRA permission (Form T137). - [CRA: where to keep records and for how long](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/keeping-records/where-keep-your-records-long-request-permission-destroy-them-early.html)
- Invoice information by total (Input Tax Credit Information (GST/HST) Regulations, SOR/91-45, last amended 2024-06-20): - [Justice Laws: SOR/91-45](https://laws-lois.justice.gc.ca/eng/regulations/SOR-91-45/FullText.html)

| Invoice total | Must show |
|---|---|
| Under CA$100 | Supplier name or trading name; invoice date; total paid or payable |
| CA$100 to under CA$500 | The above, plus supplier's GST/HST registration number; the tax amount, or a statement that tax is included with the rate; tax status of each supply if mixed |
| CA$500 or more | The above, plus the buyer's name; terms of payment; a description of each supply sufficient to identify it |

- British Columbia: a business located outside B.C. "may" need to register for PST if it makes sales to B.C. customers; details are in Bulletin PST 001. - [BC PST registration](https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/register)
- Secondary sources put the out-of-province thresholds at CA$10,000 of B.C. sales, CA$30,000 for Quebec QST and Manitoba RST, and no threshold in Saskatchewan; they also disagree with each other on Saskatchewan and Manitoba. - [SAL Accounting](https://salaccounting.ca/blog/gst-hst-compliance-ecommerce-stores/); [SimplyVAT](https://support.simplyvat.com/knowledgehub/when-to-register-for-pst/rst/qst-canada)
- Stripe Tax can compute this for CA$0.50 per transaction via API or 0.5% no-code. - [Stripe pricing CA](https://stripe.com/en-ca/pricing)

### Inferences
- The admin must store, per order and frozen at the time of sale: ship-to province, tax rate applied, tax amount per line and on shipping, the GST/HST number printed, invoice number, date, buyer name and item descriptions. Meeting the CA$500 tier on every invoice is simplest.
- A 13-row province tax table in D1, editable by the developer rather than the owner, covers GST/HST without a paid tax service. Provincial PST/QST can be a per-province on/off switch that is turned on only once the accountant confirms registration.
- Orders are never hard-deleted; refunds and cancellations are new records. Keep at least six full years plus the current year.
- D1 data location matters for the "kept in Canada" rule. A monthly CSV or PDF export of orders and invoices saved by the owner on a computer in Canada is a low-cost way to satisfy it; whether cloud-hosted D1 alone satisfies the CRA was not established.
- Owner-facing tax report: tax collected by province by month, matching the GST/HST return periods.

### Gaps
- The CRA plain-language page on invoice requirements returned 404 at the URL tried; the regulation itself was used instead.
- Official provincial sources for out-of-province seller thresholds in Saskatchewan, Manitoba and Quebec were not read; BC's page gave no dollar figure. COULD NOT VERIFY thresholds; BC Bulletin PST 001, Saskatchewan Finance, Manitoba Finance and Revenu Quebec would confirm.
- Small supplier (CA$30,000) registration rule was only seen in secondary sources.
- Tobacco-specific taxes and Ontario retail tobacco rules were not researched.
- Whether shipping charges follow the goods' tax rate was not sourced here (it is the usual treatment; confirm with the accountant).

## 9. Dashboard design guidance for non-technical users

### Takeaway
Respected guidance agrees on a single glanceable screen that communicates only critical information with minimal interaction, uses bars and lines rather than pies and gauges, and never relies on colour alone. The two leading merchant products apply this by opening on four numbers plus a short list of tasks.

### Cited Findings
- A dashboard is a "single-page view that imparts at-a-glance information" and should need "a minimum of interaction or cognitive processing". - [NN/g: Dashboards and preattentive processing](https://www.nngroup.com/articles/dashboards-preattentive/)
- "Operational dashboards aim to impart critical information quickly to users as they are engaged in time-sensitive tasks"; analytical dashboards support later analysis. - [NN/g](https://www.nngroup.com/articles/dashboards-preattentive/)
- Length and 2D position are "ideal for quantitative representation"; bar charts are "a reliable means of representing quantitative data". - [NN/g](https://www.nngroup.com/articles/dashboards-preattentive/)
- "color should not be used to communicate information about quantitative values or magnitude"; colour-blind users are common, so shape or grouping is the more reliable signal. - [NN/g](https://www.nngroup.com/articles/dashboards-preattentive/)
- Pie charts "should be avoided most of the time"; radial gauges waste space and read worse than linear graphs; 3D charts "will make the chart much more difficult to interpret quickly and accurately". - [NN/g](https://www.nngroup.com/articles/dashboards-preattentive/)
- Shopify Home: four default metrics, one default period, open tasks with counts, and setup tasks for a new store in place of empty charts. - [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home)
- Square lets the owner choose only four tools for the phone's bottom bar. - [Square Dashboard app](https://squareup.com/help/ca/en/article/5618)

### Inferences
- For this owner the home screen is an operational dashboard (what needs doing now), and the performance page is the analytical one; keeping them separate follows the NN/g split.
- Plain words over metric jargon: "Sold today", "Orders to pack", "Running low", "Average order". Every number carries its period and a comparison in words ("up from last week").
- Empty states follow Shopify's lead: before the first order, show the next step to take, not a blank chart.
- Phone first means a bottom bar of four destinations (Home, Orders, Products, More), thumb-reach primary actions, and tables that become stacked rows.
- Status must not be colour-only: pair colour with a word (Paid, Packed, Shipped, Low).

### Gaps
- NN/g gives no number for how many items a dashboard should hold; the "four" comes from Shopify's and Square's defaults, not from a stated rule.
- Shopify Polaris empty-state guidance could not be read (the Polaris URL now redirects to a general docs page). COULD NOT VERIFY its wording.
- No Stripe or Square design-blog article on dashboard simplicity was read in this session.
