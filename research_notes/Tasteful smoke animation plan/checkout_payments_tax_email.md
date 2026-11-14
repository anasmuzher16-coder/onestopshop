# Production checkout for a custom Canadian store: payments, sales tax, order email, fraud, policies

All sources read 2026-11-14 unless a different date is given. "TEXT" = what the source says. "LIKELY" = my reading. "COULD NOT VERIFY" = no primary source reached this session; what would confirm it is stated. Amounts are CAD unless marked USD.

Method notes: government PDFs (BC PST 001, Manitoba RST 004, Manitoba RST 24-01) were read in full. Several primary pages blocked automated fetch (PayPal 403, CRTC 403, Revenu Quebec 403, Ontario e-Laws renders by script, Saskatchewan PST-5 certificate error, McCarthy 429). Those items are marked.

---

## 1. Payment integration options (custom front end, card data off our servers)

### Takeaway
Stripe (hosted Checkout or Payment Element) is the best technical fit for a Worker and is the only option here with a documented native SDK path on Workers, at 2.9% + $0.30. The deciding issue is not technology but category approval: none of Stripe, Square or Helcim names hookah pipes or accessories, but each has an adjacent clause (drug-use equipment, paraphernalia, age-restricted mail order, tobacco MCC 5993) that an underwriter could apply, so written pre-approval before build is the first task.

### Cited Findings

**Pricing, payouts, disputes (published rates)**

| Processor | Online card rate | Foreign card / FX | Chargeback fee | Payout timing | Monthly fee | Source |
|---|---|---|---|---|---|---|
| Stripe | 2.9% + $0.30 | +0.8% international, +2% conversion | $15 dispute received, plus $15 if you counter (counter fee refunded if you win) | First payout delayed 7 business days in Canada, then about 3 business days; standard payouts free; instant payout 1%, min $0.60 | None | [Stripe CA pricing](https://stripe.com/en-ca/pricing), [Stripe payout speed](https://support.stripe.com/questions/accessing-faster-payout-speeds-in-europe-and-canada) |
| Square | 2.8% + $0.30 (Online Store, Online Checkout, eCommerce API) | +1.5% for cards issued outside Canada | Square says it does not charge a chargeback fee | "As soon as the next business day", FAQ says 1 to 2 business days, free; instant transfer 1.95% | None | [Square CA pricing](https://squareup.com/ca/en/pricing), [Square CA chargeback article](https://www.square.com/ca/townsquare/what-is-a-chargeback-what-makes-it-happen) |
| Helcim | Interchange + 0.50% + $0.25 (keyed and online, $0 to $50K/month volume); page says effective online rate is below 2.5% | Not stated on page | $15 only if lost, $0 if resolved in your favour | Next business morning | $0 | [Helcim pricing](https://www.helcim.com/pricing/) |
| Moneris | 2.85% + $0.30 card-not-present flat rate; Interac debit card-not-present $1.00 per transaction | Foreign card fee 0.80% (up to 1.00%) under Simplified Pricing | $25.00 (plus "authorization chargeback handling" $80.00 listed) | Next-day deposits | Not on pricing page. Third-party search results cite $39 to $46/month for "Moneris Online"; COULD NOT VERIFY | [Moneris pricing](https://www.moneris.com/en/pricing) |
| PayPal | COULD NOT VERIFY. paypal.com/ca fee pages returned 403. Search snippet of PayPal's Braintree CA page lists 2.9% + $0.30 and $15 chargeback; a third-party blog cites a $20.99 dispute fee | COULD NOT VERIFY | COULD NOT VERIFY | COULD NOT VERIFY | None known | To confirm: [PayPal CA merchant fees](https://www.paypal.com/ca/business/fees), PDF dated 4 Nov 2026 at [paypalobjects](https://www.paypalobjects.com/marketing/ua/OA/merchant-fees/en-CA-110426.pdf) |

- Helcim's rate table carries no currency code; the page is the Canadian default and references Interac and EFT-PAD. TEXT: "Interchange+ 0.50% + 25c" for $0 to $50K. LIKELY: CAD. [Helcim pricing](https://www.helcim.com/pricing/)
- Stripe Checkout and Payment Links carry no extra fee beyond Payments; a custom checkout domain is US$10/month. 3D Secure is included on standard pricing. [Stripe CA pricing](https://stripe.com/en-ca/pricing)

**PCI self-assessment type**

- Stripe: TEXT (Stripe PCI guide, via search snippet): "Checkout and Stripe.js and Elements host all card data collection inputs within an iframe served from Stripe's domain". Stripe's support page maps Checkout, Elements (v3) and mobile SDKs to SAQ A, and Stripe.js v2 with your own form to SAQ A-EP. [Stripe PCI guide](https://stripe.com/guides/pci-compliance), [Stripe support: what is PCI compliance](https://support.stripe.com/questions/what-is-pci-compliance)
- Stripe's security guide: use "low risk payment integrations" so card data goes "directly to Stripe without it passing through your servers"; TLS 1.2+ required; gives the exact CSP directives for Checkout and Stripe.js. [Stripe integration security guide](https://docs.stripe.com/security/guide)
- Square: developer reference says the Web Payments SDK lets you "easily create PCI-compliant inputs". A specific SAQ letter for the seller was not found on a Square page. COULD NOT VERIFY SAQ type; confirm in Square's PCI help article or by asking Square. [Square Web Payments SDK reference](https://developer.squareup.com/reference/sdks/web/payments)
- Conflict: third-party posts (cside.com) claim SAQ A merchants must still meet PCI DSS 6.4.3 and 11.6.1 script controls; a Paytia post claims Elements is SAQ A-EP, which contradicts Stripe's own pages. No PCI SSC primary text was retrieved. COULD NOT VERIFY the current SAQ A eligibility wording; confirm in the PCI SSC document library (SAQ A for PCI DSS v4.0.1 and FAQ 1588). [cside post](https://cside.com/blog/does-stripe-make-you-pci-compliant-6-4-3-11-6-1), [PCI SSC document library](https://www.pcisecuritystandards.org/document_library/)
- Helcim (HelcimPay.js), Moneris Checkout, PayPal: SAQ type COULD NOT VERIFY this session.

**Wallets and Interac online**

- Square Web Payments SDK "supports credit cards, debit cards, gift cards, Apple Pay, and Google Pay" and is available in Canada. [Square developer, Apple Pay page](https://developer.squareup.com/docs/payment-form/add-digital-wallets/apple-pay), [Square blog](https://developer.squareup.com/blog/web-payments-sdk-and-ach-beta/)
- Interac: on 2026-02-10 Interac announced Interac Debit is "now available to Stripe's Canadian retail customers for online purchases", offered "through participating digital wallets". Before this, Stripe supported Interac Debit in person only. Merchants are told to contact Stripe to enable it; no fee is stated. [Interac announcement](https://www.interac.ca/en/content/news/interac-debit-is-now-available-for-online-and-in-app-payments-with-stripes-customers/)
- Moneris lists a card-not-present Interac debit price of $1.00 per transaction, which implies an online Interac product. [Moneris pricing](https://www.moneris.com/en/pricing)
- Stripe in-person Interac is $0.15 per transaction (Terminal), relevant only if the shop later moves its counter to Stripe. [Stripe CA pricing](https://stripe.com/en-ca/pricing)
- Stripe Apple Pay / Google Pay in Checkout and Payment Element: not fetched from a primary page this session. COULD NOT VERIFY here; confirm at [Stripe payment methods](https://docs.stripe.com/payments/payment-methods/overview). Square online Interac, Helcim wallets, Moneris Checkout wallets, PayPal wallets: COULD NOT VERIFY.

**Calling it from a Cloudflare Worker**

- Stripe: Cloudflare's "Announcing Stripe support in Workers" post says the official Stripe JS SDK runs natively on Workers. Multiple sources agree the synchronous `constructEvent` fails on Workers and `constructEventAsync` with `Stripe.createSubtleCryptoProvider()` is the working path, with the raw body read by `request.text()`. The sources for the exact call shape are third-party guides and forum threads; verify against the current `stripe-node` README before coding. [Cloudflare blog](https://blog.cloudflare.com/announcing-stripe-support-in-workers)
- Stripe webhook signature, manual method (works with WebCrypto, no SDK): header `Stripe-Signature` has `t=` and one or more `v1=` entries; signed payload is `t + "." + raw body`; HMAC-SHA256 with the `whsec_` secret; constant-time compare; default tolerance 5 minutes; "Don't use a tolerance value of 0". Stripe may add `secret`, `destination`, `payload` debug entries that must be ignored. [Stripe webhooks](https://docs.stripe.com/webhooks)
- Square: every webhook carries `x-square-hmacsha256-signature`, an HMAC-SHA-256 over the signature key, notification URL and raw body; failed checks "cannot be trusted and should be discarded"; use constant-time comparison. [Square validate webhooks](https://developer.squareup.com/docs/webhooks/step3validate)
- Square, Helcim, Moneris, PayPal SDKs on Workers: no source found. All four expose HTTPS REST APIs, so plain `fetch` should work. COULD NOT VERIFY SDK compatibility.

**Category approval: what the policies actually say**

| Processor | Policy text (verbatim) | Source |
|---|---|---|
| Stripe (restricted = needs extra diligence) | "Tobacco products, including e-cigarettes, cigars and e-liquid sold in accordance with applicable law"; "Herbal and vitamin e-cigarettes and cigarettes"; "Production equipment specifically marketed for the production of tobacco products" | [Stripe restricted businesses, CA](https://stripe.com/en-ca/legal/restricted-businesses) |
| Stripe (prohibited) | "Equipment and items intended to be used for making or using drugs"; "Hydroponic equipment and other cultivation or production equipment marketed for growing marijuana" | same |
| Stripe (process) | "Businesses in these categories require additional due diligence by Stripe in order to confirm our ability to support them."; "Stripe might not be able to grant approval for your business to use our products"; FAQ: "Stripe might be able to support businesses on its Prohibited and Restricted Businesses list with explicit prior approval." | same, and [Stripe FAQ](https://support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs) |
| Square (Canada Payment Terms, s.3, last updated 2026-10-23) | "(2) paraphernalia that may be used for illegal activity"; "(20) high-risk products and services, including telemarketing sales"; "(24) internet/mail order/telephone order of age restricted products (e.g., fireworks, e-cigarettes)"; "(25) cigars, including any roll of tobacco wrapped in either leaf tobacco or any other substance containing tobacco" | [Square CA Payment Terms](https://squareup.com/ca/en/legal/general/payment) |
| Square (reserve, fees) | "We may require a Reserve for any reason related to your use of the Services."; "We reserve the right, upon notice to you, to charge a fee for mediating and/or investigating Chargeback disputes." | same |
| Helcim (Canada AUP, last updated 2026-09-30) | Prohibited: "Online, mail order or telephone order e-cigarettes and vapes (including devices, equipment, and liquids)"; "Tobacco and nicotine product sales (except physical store sales)"; "Drug paraphernalia". Restricted to card-present: "Herbal cigarettes" | [Helcim CA Acceptable Use Policy](https://legal.helcim.com/ca/acceptable-use-policy/) |
| Helcim (process) | "unable to approve every application"; high-risk applicants get a closer review; contact trustandsafety@helcim.com | [Helcim: before signing up](https://learn.helcim.com/docs/before-signing-up) |
| PayPal | COULD NOT VERIFY (403). Confirm at [PayPal CA Acceptable Use Policy](https://www.paypal.com/ca/legalhub/paypal/acceptableuse-full) | |
| Moneris | No public restricted list found. COULD NOT VERIFY; ask sales (1-855-463-5669 per pricing page) | [Moneris pricing](https://www.moneris.com/en/pricing) |

- None of the Stripe, Square or Helcim pages contains the words hookah, shisha, pipe, bong or "smoking accessories". Confirmed by reading each page for those terms.
- MCC 5993 and card-brand high-risk programs: Helcim's help article lists "Tobacco or e-cigarette sales" in the Visa and Mastercard high-risk merchant program, names "5993 (Tobacco Sales)", says it applies to card-not-present transactions only, and passes through: acquiring fee "$100.00 CAD annually", plus registration "VISA: $950.00 annually" and "Mastercard: $500.00 annually" for tobacco. Updated 2025-05-28. [Helcim high-risk program](https://learn.helcim.com/docs/high-risk-merchant-program-from-visa-and-mastercard)
- A TD merchant notice (PDF, date not shown in the snippet, not read in full) lists MCC 5993 under "high brand risk" with a $1,400 one-time registration fee and $120 monthly fee. PARTLY VERIFIED (search snippet only). [TD notice](https://www.td.com/content/dam/tdct/document/pdf/business-banking/pcn-fee-changes-for-merchants-in-high-brand-risk-categories-en.pdf)
- Industry MCC references describe 5993 as cigar stores and stands, covering tobacco and smoking accessories; one notes a business can ask its acquirer to correct a misclassification. These are vendor pages, not card-network rule text. [Paycompass](https://paycompass.com/?p=7455), [pxp MCC 5993](https://www.pxp.io/mcc-codes/5993-cigar-stores-and-stands)
- High-risk processors for Canadian smoke shops and their rates: only vendor marketing pages were found (PayKings, Corepay and similar). No published Canadian rate or reserve percentage was found. COULD NOT VERIFY; the only way to get real numbers is written quotes.

### Inferences
- LIKELY: the risk is classification, not an explicit ban. If an underwriter codes the store as 5993 (tobacco) and card-not-present, Helcim's own AUP prohibits it online and the card brands add registration fees ($950 + $500 a year at Helcim's pass-through). If it is coded as general retail (for example 5999 miscellaneous retail or a home/gift code), none of the quoted clauses applies. The business sells no tobacco, charcoal or vapes, which is the argument for a non-5993 code.
- LIKELY: Stripe's "equipment and items intended to be used for making or using drugs" and Square's "paraphernalia that may be used for illegal activity" are aimed at illegal-drug paraphernalia. Hookahs are used with legal products, but glass pieces are visually close to what reviewers flag. Product copy and photos should say plainly what the item is for.
- LIKELY: Square clause 24 turns on whether hookah accessories are an "age restricted product" in law. That depends on provincial tobacco-accessory rules, which this research did not cover.
- Practical order: (1) email each shortlisted processor a plain description (hookahs, glass bases, bowls, hoses, parts, cologne; no tobacco, charcoal, vapes; Canada only; age gate; adult signature) and ask for written approval and the MCC they will assign; (2) build only after one says yes in writing; (3) keep a second processor approved as a fallback because all three reserve the right to hold funds or close the account.
- Hosted Checkout versus Payment Element: both are SAQ A per Stripe. Hosted Checkout puts the least script on our pages and gives tax, wallets and receipts with one redirect; Payment Element keeps the customer on our page but our page then loads Stripe.js, so our own page's script hygiene (CSP, no third-party tags on the pay page) matters more.
- Cost at $100 order: Stripe $3.20, Square $3.10, Moneris $3.15, Helcim interchange-dependent (page claims under 2.5%, so under about $2.75). At small volume the spread is cents; approval and payout holds matter more.

### Gaps
- Written approval position of each processor for this exact catalogue. Only the processor can answer.
- PayPal fees and AUP text (403). Moneris Checkout monthly fee, wallets, SAQ type. HelcimPay.js wallets and SAQ type.
- Whether Stripe Interac Debit online has a per-transaction fee and whether it needs a separate application.
- PCI SSC primary text on SAQ A eligibility for iframe and redirect integrations in v4.0.1.
- Shopify Payments was not re-examined (out of scope for a custom build).

---

## 2. Order flow that prevents the classic bugs

### Takeaway
Create the order row first in a "pending" state with a server-computed total, hand the processor that total, and mark it paid only from a verified webhook that is processed idempotently. Stripe documents every failure mode this guards against: duplicates, out-of-order delivery, retries for up to three days, and sessions that expire.

### Cited Findings
- Duplicates: "Webhook endpoints might occasionally receive the same event more than once. You can guard against duplicated event receipts by logging the event IDs you've processed". In some cases two separate Event objects are generated; dedupe on `data.object` id plus `event.type`. [Stripe webhooks](https://docs.stripe.com/webhooks)
- Ordering: "Stripe doesn't guarantee the delivery of events in the order that they're generated." Do not use `created` to order events or detect duplicates; fetch the object from the API if something is missing. [Stripe webhooks](https://docs.stripe.com/webhooks)
- Late delivery: "Stripe attempts to deliver events to your destination for up to three days with an exponential back off in live mode." Manual resend from the Dashboard works for 15 days, from the CLI for 30 days. A retry gets a new signature and timestamp. [Stripe webhooks](https://docs.stripe.com/webhooks)
- Respond fast: the endpoint must "quickly return a successful status code (2xx) before any complex logic that could cause a timeout"; Stripe recommends an asynchronous queue. Redirect (3xx) responses count as failures. [Stripe webhooks](https://docs.stripe.com/webhooks)
- Verification: always verify the signature; Stripe also recommends allowlisting its webhook IPs. "Sensitive information is never included in a webhook event". [Stripe webhooks](https://docs.stripe.com/webhooks), [Stripe security guide](https://docs.stripe.com/security/guide)
- Abandoned checkout: a Checkout Session's `expires_at` "must be between 30 minutes and 24 hours after the current time"; default is 24 hours; expiry fires `checkout.session.expired`, which Stripe's "Manage limited inventory" guide uses to release stock. A session can also be expired by API call. PARTLY VERIFIED (search snippets of the Stripe pages). [Stripe: manage limited inventory](https://docs.stripe.com/payments/checkout/managing-limited-inventory), [Stripe: expire a session](https://docs.stripe.com/api/checkout/sessions/expire)
- Safe card facts to store: Stripe says card type, last four and expiry are "not subject to PCI compliance" and can be stored, as can anything the API returns. [Stripe security guide](https://docs.stripe.com/security/guide)
- D1: secondary sources say `batch()` runs statements as one transaction that rolls back on error, but it is not an interactive transaction, and a conditional `UPDATE ... WHERE stock >= ?` that matches zero rows does not by itself fail the batch. PARTLY VERIFIED (third-party articles); confirm in Cloudflare D1 docs. [event-driven.io on D1 transactions](https://event-driven.io/en/cloudflare_d1_transactions_and_tradeoffs/), [D1 docs](https://developers.cloudflare.com/d1/)
- Cloudflare Queues give at-least-once delivery, so consumers must be idempotent; 10,000 operations/day included then US$0.40 per million (search snippet of Cloudflare product page). [Cloudflare Queues](https://developers.cloudflare.com/queues/get-started)
- Refunds: Helcim states refunds carry no added fee "but the original transaction's processing fees still apply". [Helcim pricing](https://www.helcim.com/pricing/)

### Inferences (recommended design, not sourced rules)
1. Cart to order: the browser sends only SKU ids, quantities, ship-to province and postal code, pickup or ship. The Worker reads prices from D1, computes subtotal, shipping, tax by province and total. The browser's total is display only and is never read.
2. Create the order before payment: insert `orders` row with status `pending_payment`, an order number, the computed amounts, and a `reservation_expires_at`. Reserve stock in the same D1 batch with `UPDATE products SET reserved = reserved + ? WHERE id = ? AND stock - reserved >= ?`, then check `meta.changes` for each statement and compensate if any returned 0 (or enforce with a `CHECK (stock - reserved >= 0)` constraint so the batch throws).
3. Create the Stripe Checkout Session (or PaymentIntent) with the server total, `metadata.order_id`, and `expires_at` set to 30 minutes. Send an idempotency key derived from the order id so a double click or retry cannot create two sessions. Stripe idempotency-key retention period was not fetched; confirm at [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).
4. Webhook handler: read raw body, verify signature, insert the event id into a `processed_events` table with a UNIQUE constraint (insert failure means already handled, return 200), then push to a Queue or finish inline if fast. On `checkout.session.completed` with `payment_status = paid`: compare `amount_total` and currency to the order row; if they match, mark `paid`, convert the reservation into a real stock decrement, enqueue the confirmation email. If they do not match, mark `needs_review` and alert the owner; never fulfil.
5. The success page is not proof of payment. It reads order status from D1 and shows "confirming" until the webhook lands.
6. Release: on `checkout.session.expired`, and also on a Cron Trigger sweep for rows past `reservation_expires_at` (covers a lost webhook), release the reservation and mark `expired`.
7. Late payment after release: if a paid event arrives for an order already expired and stock is gone, mark `paid_oversold`, alert the owner, and refund or backorder. This is the one path that needs a human.
8. Refunds and partial refunds: always initiate from the admin through the processor API with an idempotency key; store each refund as its own row (amount, tax portion, reason, processor refund id); update order status from the `charge.refunded` / refund webhook, not from the API response alone; restock only when goods are back.
9. Pickup orders: same flow, ship method `pickup`, tax fixed at Ontario 13% (see section 3), no shipping line. States: paid, ready_for_pickup (email sent), picked_up (staff marks it, records name and time, checks ID against order name). Set an unclaimed-pickup rule in the policy (for example refund after N days).
10. Double-submit guard on the client (disable button) is cosmetic; the server idempotency key is the real guard.

### Gaps
- Stripe idempotency key lifetime and exact Checkout fulfilment guidance page were not read in full this session.
- Square's webhook retry schedule and event id field were not on the page fetched.
- D1 transactional behaviour needs a read of the official D1 batch documentation before the stock logic is written.

---

## 3. Canadian sales tax for an Ontario seller shipping to every province

### Takeaway
GST/HST is charged at the rate of the province the parcel is sent to (13% for in-store pickup), and the only federal threshold is the $30,000 small-supplier test. The four PST provinces each have their own trigger for an out-of-province seller: BC ($10,000 of BC sales, or any amount if you advertise into BC), Manitoba (soliciting plus delivering, with a $30,000 exception that is narrow for out-of-province sellers), Quebec ($30,000 of sales to Quebec consumers), and Saskatchewan (no dollar threshold found).

### Cited Findings

**GST/HST rate by destination (on or after 2025-04-01)**

| Destination | GST/HST | Separate provincial tax (only if registered there) |
|---|---|---|
| Ontario | 13% HST | none |
| New Brunswick, Newfoundland and Labrador, Prince Edward Island | 15% HST | none |
| Nova Scotia | 14% HST | none |
| Alberta, NWT, Nunavut, Yukon | 5% GST | none |
| British Columbia | 5% GST | PST 7% |
| Saskatchewan | 5% GST | PST 6% |
| Manitoba | 5% GST | RST 7% |
| Quebec | 5% GST | QST 9.975% |

- GST/HST rates: [CRA rates page, modified 2025-04-01](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html). BC 7%: [BC Bulletin PST 001](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-001-registering-to-collect-pst.pdf). SK 6%: [Saskatchewan PST page](https://www.saskatchewan.ca/business/taxes-licensing-and-reporting/provincial-taxes-policies-and-bulletins/provincial-sales-tax). MB 7%, "calculated on the selling price before the Goods and Services Tax (GST) is applied": [Manitoba Bulletin RST 004](https://www.gov.mb.ca/finance/taxation/pubs/bulletins/004.pdf). QST 9.975%: [Stripe Canada tax guide](https://stripe.com/resources/more/canada-vat) (secondary; confirm at Revenu Quebec).

**Place of supply**
- TEXT: for goods the place of supply is "the province in which the goods are delivered"; when the supplier mails or couriers them, "the place of supply is the province to which the goods are sent". [CRA place-of-supply page, modified 2026-07-15](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-place-supply.html)
- TEXT: a sale of goods "is generally made in a province if the supplier delivers the property or makes it available in the province to the recipient". [CRA Memorandum 3-3-3](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/3-3-3/place-supply-province-tangible-personal-property.html)
- LIKELY: in-store pickup in Ontario is "made available" in Ontario, so 13% HST regardless of where the customer lives. The CRA page fetched does not use the word pickup.

**Small supplier ($30,000)**
- TEXT: exceed $30,000 in a single calendar quarter and "Your effective date of registration is no later than the day of the supply that made you exceed $30,000". Exceed it over the previous four quarters and "You are no longer a small supplier at the end of the month following the quarter in which you exceed $30,000". The total counts worldwide taxable supplies of you and your associates. Examples give 29 days to register. [CRA: when to register, page dated 2026-06-16](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html)
- LIKELY: an existing retail shop with a storefront is almost certainly already a GST/HST registrant, in which case the online store charges from order one. Confirm the shop's GST/HST number.

**British Columbia** (Bulletin PST 001, revised October 2026, read in full)
- Scenario 1: an out-of-BC Canadian business must register if it does all of: sells taxable goods to BC customers; accepts orders from BC; delivers to BC (including "through a third party, such as a courier"); and "Solicit[s] persons in B.C. (through advertising or other means, including mail, email, fax, newspaper or the internet)". No dollar threshold in this scenario.
- Scenario 3: same first three conditions plus "gross revenue in the previous 12 months from all retail sales ... to B.C. customers is more than $10,000" or estimated next 12 months over $10,000.
- TEXT: "If you have only a website that is accessible from anywhere in the world, which does not target B.C. customers, you are not soliciting sales in B.C. However, if you ... also solicit sales in B.C. by other means, such as through targeted internet advertisements, promotional flyers or newspaper advertisements, you are soliciting sales in B.C."
- TEXT: "If you sell vapour products (including parts and accessories) to B.C. customers, you must register ... even if you do not meet the minimum B.C. revenue threshold." Must be registered "before delivering goods into B.C."
- Voluntary registration is available to Canadian sellers outside BC. If you collect PST without being registered you must still remit it.
- Source: [BC Bulletin PST 001](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-001-registering-to-collect-pst.pdf), [BC register page, updated 2026-10-01](https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/register)

**Manitoba** (Bulletin RST 004, revised June 2024, and Notice RST 24-01, April 2024, both read in full)
- TEXT: out-of-province businesses selling taxable goods to Manitoba purchasers for use in Manitoba must register and collect if the seller "causes the goods to be delivered in Manitoba ... shipped by arrangement of the seller by common carrier", "solicits the order for the sale in Manitoba, directly or through an agent, by advertising or any other means", "and accepts orders originating in Manitoba"; or holds inventory in Manitoba.
- TEXT: "Small businesses, with annual taxable sales under $30,000, are not required to register and collect". But: "Out of province businesses that have not paid Manitoba RST on all of their taxable goods and services that are purchased for resale in Manitoba are also not eligible for the registration exception."
- Invoices: registered vendors "must state separately on each invoice the sale price of each item and the total amount of RST payable". Records kept "for the current fiscal year plus the immediately preceding six years".
- Source: [Manitoba RST 004](https://www.gov.mb.ca/finance/taxation/pubs/bulletins/004.pdf), [Manitoba RST 24-01](https://gov.mb.ca/finance/taxation/pubs/bulletins/noticerst2401.pdf)

**Quebec**
- TEXT (Revenu Quebec, via search snippet; direct fetch returned 403): "If your threshold amount is $30,000 or less, you are not required to register under the specified QST system. However, as soon as your threshold amount exceeds $30,000, you must register under the specified system." Applies to suppliers outside Quebec registered under the general GST/HST system. [Revenu Quebec specified system page](https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/special-cases-gsthst-and-qst/suppliers-outside-quebec/qst-registration-for-suppliers-outside-quebec/registration-under-the-specified-system-suppliers-outside-quebec-who-are-registered-under-the-general-gsthst-system/)
- Secondary: threshold is the value of taxable supplies made in Quebec to consumers over the 12 months before the month; CFIB describes it as "over $30,000 of taxable goods or services to Quebec consumers". [CFIB](https://www.cfib-fcei.ca/en/tools-resources/new-qst-requirements-e-commerce-businesses-outside-quebec), [Sales Tax Institute](https://www.salestaxinstitute.com/?p=13276)
- PARTLY VERIFIED: exact definition of "threshold amount" and "specified Quebec consumer" should be read on the Revenu Quebec page in a normal browser.

**Saskatchewan**
- TEXT (Saskatchewan Finance notice, via search snippet): "Businesses located outside Saskatchewan that make retail sales in the province ... including tangible personal property ... acquired for use or consumption in or relating to Saskatchewan, are required to become licensed to collect PST." [Saskatchewan Bulletin PST-5](https://publications.saskatchewan.ca/api/v1/products/7936/formats/11408/download)
- Secondary guides state there is no dollar minimum. An earlier notice version used a three-part test (targeted solicitation, order from Saskatchewan, delivery arranged by vendor); whether that test survives was not confirmed. [Miller Thomson](https://www.millerthomson.com/en/insights/corporate-tax/retroactive-changes-to-saskatchewan-pst-applies-to-out-of-province-online-businesses/), [Ryan notice copy](https://www.ryan.com/contentassets/50328cff9ea347a0a2cf4fa727976947/sk-info-notice.pdf)
- COULD NOT VERIFY the no-threshold rule from the bulletin itself (the government PDF host failed certificate validation). Confirm by opening PST-5 (revised July 2025) in a browser or calling Saskatchewan Finance.

**Tax on shipping charges**
- CRA guidance found only in search snippets of canada.ca pages: shipping fees are subject to GST/HST; where goods are sold on a delivered basis as one supply, the tax follows the goods; where delivered goods are taxed at different rates the delivery charge is apportioned "at the same rate as the goods to which it is attributable". PARTLY VERIFIED; the specific page was not read in full. Candidates: [CRA RC4027](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4027/doing-business-canada-gst-hst-information-non-residents.html), [CRA GI-202](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-202/delivery-services-involving-platforms.html)
- PST on shipping: Shopify's Canadian tax reference says BC delivery charges "are generally taxable if the goods are also taxable" (secondary). [Shopify Canada tax reference](https://help.shopify.com/manual/taxes/canada/canada-tax-reference)
- LIKELY: every item in this catalogue is fully taxable, so shipping is simply taxed at the same destination rate as the goods.

**Receipt / invoice content**
- CRA thresholds are $100 and $500 (they replaced $30 and $150 effective 2021-04-20). Under $100: supplier name, date, total. $100 to $499.99: add the tax charged or a statement that tax is included with the rate, and the supplier's GST/HST registration number. $500 or more: add buyer's name, description of goods, terms of payment. A supplier must show its GST/HST number on receipts for taxable supplies of $100 or more. PARTLY VERIFIED (canada.ca search snippets; the receipts page itself returned 404). [CRA input tax credits page](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html), [CRA RC4022](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html)

**Ways to compute it**

| Option | Cost | Notes | Source |
|---|---|---|---|
| In-house table (13 rows: GST/HST rate per province, plus optional PST/QST columns switched on per registration) | $0 | Rates last changed 2025-04-01 (Nova Scotia). Must be maintained by hand | [CRA rates](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html) |
| Stripe Tax Basic | 0.5% per transaction with no-code (Checkout, Payment Links); $0.50 per transaction by API, including 10 calculation calls, then $0.05 per call | Stripe docs say that for Canadian-based businesses it "monitors whether you must collect provincial taxes when you sell products in provinces other than the province of your business origin"; tax is only collected where you add a registration | [Stripe CA pricing](https://stripe.com/en-ca/pricing), [Stripe Tax Canada](https://docs.stripe.com/tax/supported-countries/canada) |
| Stripe Tax Complete | from $120/month, 1-year contract | Adds filing; overkill here | [Stripe CA pricing](https://stripe.com/en-ca/pricing) |
| Other services (TaxJar, Avalara, Kintsugi, Quaderno) | not priced this session | COULD NOT VERIFY | |

### Inferences
- A 13-row table is enough to launch. On a $100 order Stripe Tax no-code adds $0.50, roughly a sixth again on top of the card fee, for a calculation that is one lookup.
- The threshold tracking is the real work. Build a small admin report: trailing-12-month sales by destination province. Alert at $8,000 for BC and $25,000 for Quebec and Manitoba.
- Advertising is a tax trigger. Geo-targeted ads into BC or Manitoba convert "passive website" into "soliciting" under both bulletins. Decide ad targeting with that in mind.
- LIKELY for Manitoba: an Ontario seller has not paid Manitoba RST on its inventory, so the $30,000 exception does not protect it once it is soliciting and delivering into Manitoba. Whether a national website alone is "soliciting" in Manitoba is not stated (BC states it; Manitoba does not). Ask Manitoba Finance (MBTax@gov.mb.ca) in writing.
- The BC "vapour products (including parts and accessories)" no-threshold rule should not apply to hookah gear, but the bulletin does not define the term. Confirm with BC (CTBTaxQuestions@gov.bc.ca) before the first BC shipment.
- Until registered in a PST province, charge only 5% GST to that province. Do not collect an amount "as if it were PST" unregistered; BC says such amounts must still be remitted.
- Store tax per order as separate columns (gst_hst, pst, qst, rate, destination province) so filings and refunds can be split.

### Gaps
- Saskatchewan: primary text on threshold and solicitation test.
- Quebec: exact "threshold amount" definition; whether QST applies to shipping the same way.
- CRA primary page for delivery-charge treatment and for the receipt table (both only seen as snippets).
- This is tax law; a short written confirmation from the shop's accountant is worth having before launch.

---

## 4. Transactional email from Cloudflare Workers

### Takeaway
Cloudflare's own Email Sending is the cheapest native fit (3,000 a month included on Workers Paid) but is still labelled beta; Resend's free tier (3,000 a month, 100 a day) is the low-risk production choice. All five planned messages are consent-exempt under CASL s.6(6) as long as they contain no promotion, but they still need sender identification; the newsletter needs its own unticked checkbox.

### Cited Findings

| Service | Price | Limits / status | Source |
|---|---|---|---|
| Cloudflare Email Service (Email Sending) | 3,000 emails/month included with Workers Paid, then US$0.35 per 1,000. Sends to your own verified addresses are free on all plans | "Sending to arbitrary recipients requires the Workers Paid plan." Docs say the service "is currently in beta. Features and APIs may change before general availability." Sent from a Worker via a `send_email` binding (`env.EMAIL.send()`) or REST | [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/), [Email Service docs](https://developers.cloudflare.com/email-service/), [changelog](https://developers.cloudflare.com/changelog/product/email-service/) |
| Resend | Free: 3,000/month, capped at 100/day, 3 domains. Pro US$20/month for 50,000, overage US$0.90 per 1,000 | HTTP API, works with `fetch` | [Resend pricing](https://resend.com/pricing) |
| Postmark | Free developer tier 100/month. Basic US$15/month from 10,000, overage US$1.80 per 1,000 | HTTP API | [Postmark pricing](https://postmarkapp.com/pricing) |
| Amazon SES | US$0.10 per 1,000 outbound (search summary of the AWS page; sources disagree on the free tier) | Needs AWS SigV4 signing from a Worker; new accounts start in a sandbox. PARTLY VERIFIED | [AWS SES pricing](https://aws.amazon.com/ses/pricing/) |
| MailChannels | The free Workers integration ended 2024-08-31. Current MailChannels Email API has a free plan of about 100 emails/day; next tier starts at 10,000/month | Sending pauses when the daily cap is hit | [MailChannels end-of-life notice](https://support.mailchannels.com/hc/en-us/articles/26814255454093-End-of-Life-Notice-Cloudflare-Workers), [MailChannels pricing docs](https://docs.mailchannels.com/email-api/billing/pricing.md) |

- Workers Paid plan price (commonly stated as US$5/month) was only seen on a third-party page. COULD NOT VERIFY here; confirm at [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- Deliverability: coverage of Cloudflare's 2025 launch says the service configures SPF, DKIM and DMARC automatically; the onboarding docs were not read. PARTLY VERIFIED. [InfoQ](https://www.infoq.com/news/2025/10/cloudflare-email-service)
- The owner low-stock alert can go to a verified destination address, which Cloudflare does not bill or count. [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)

**CASL (S.C. 2010, c. 23), statute current to 2026-10-19**
- s.6(6): the consent requirement does not apply to a message that "solely" does one of: gives a requested quote; "facilitates, completes or confirms a commercial transaction" the recipient previously agreed to; provides "warranty information, product recall information or safety or security information"; gives factual information about an ongoing account or subscription; or delivers a product the recipient is entitled to under a prior transaction. [CASL s.6](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html)
- s.6(2): every commercial electronic message must identify the sender (and anyone it is sent on behalf of), give contact information, and set out an unsubscribe mechanism. [CASL s.6](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html)
- s.10(1): a consent request must "set out clearly and simply" the purpose and who is asking. s.10(10): implied consent from an existing business relationship covers a purchase "within the two-year period immediately before the day on which the message was sent", and an inquiry within six months. [CASL s.10](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html)
- s.11: the unsubscribe link must be "valid for a minimum of 60 days after the message has been sent" and requests honoured "without delay, and in any event no later than 10 business days". [CASL s.11](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html)
- CRTC Bulletin 2012-549 (via search snippet and law-firm summaries): a pre-checked box is "toggling" and does not count as express consent; the user must actively tick; consent must be separate from accepting terms. PARTLY VERIFIED (crtc.gc.ca returned 403). [CRTC 2012-549](https://crtc.gc.ca/eng/archive/2012/2012-549.htm), [commentary](https://www.mondaq.com/canada/data-protection/203566/active-opt-in-consent-required-crtc-releases-anti-spam-law-compliance-guidelines)
- Maximum penalties ($1M individual, $10M business is the commonly quoted figure): COULD NOT VERIFY this session; confirm in CASL s.20.

### Inferences
- Order confirmation, shipping notice, pickup-ready and refund notice each fit s.6(6) ("completes or confirms a commercial transaction", "delivers a product"). Keep them free of promotions, coupons and "you may also like" blocks; the word "solely" is what the exemption hangs on.
- The statute's s.6(2) applies to every commercial electronic message and s.6(6) lifts only the consent requirement. LIKELY: transactional emails still need the business name, mailing address, a contact method, and an unsubscribe line. Put a standard footer on every template.
- Newsletter checkbox: unticked by default, separate from the terms checkbox, wording that states the purpose and the sender, with a note that they can unsubscribe any time. Store timestamp, IP, the exact wording shown, and source page as proof of consent.
- A purchase gives two years of implied consent, but express opt-in is cleaner and does not expire. Do not auto-enrol buyers.
- Setup regardless of provider: send from a subdomain (for example orders.domain), publish the provider's SPF include and DKIM keys, add a DMARC record starting at `p=none` with a reporting address, then tighten. Use a real reply-to mailbox.
- Volume: a single shop will send well under 3,000 emails a month, so Cloudflare (if already on Workers Paid for D1/Queues) or Resend free both cost nothing extra. Because Cloudflare's product is beta, put sending behind one function so the provider can be swapped in a day.
- Send email from the Queue consumer, not the webhook handler, and record a `sent_at` per order per template so a duplicate webhook cannot send twice.

### Gaps
- Cloudflare Email Sending GA date, daily rate limits and onboarding steps (limits page not read).
- CRTC primary guidance text (403) and CASL penalty section.
- Quebec French-language requirements for emails and the site were not researched.

---

## 5. Fraud and chargebacks for a small store

### Takeaway
The built-in tools are enough at this size: processor risk scoring, 3-D Secure on risky payments (which shifts fraud liability to the issuer), postal code and CVC checks, and signature delivery on higher-value parcels. For "not received" disputes, what wins is proof of delivery to the full address, submitted after delivery is confirmed.

### Cited Findings
- Chargeback fees in Canada (published): Stripe $15 received plus $15 to counter (returned if you win); Helcim $15 if lost, $0 if won; Moneris $25; Square says no chargeback fee, while its terms reserve the right to add one on notice. Square describes other processors' fees as $10 to $25. [Stripe CA pricing](https://stripe.com/en-ca/pricing), [Helcim pricing](https://www.helcim.com/pricing/), [Moneris pricing](https://www.moneris.com/en/pricing), [Square CA chargeback article](https://www.square.com/ca/townsquare/what-is-a-chargeback-what-makes-it-happen), [Square CA Payment Terms](https://squareup.com/ca/en/legal/general/payment)
- Stripe Radar: pay-as-you-go from $0.07 per screened transaction or from $14/month; 3D Secure included on standard pricing. Whether basic Radar screening is bundled into the 2.9% + $0.30 for Canadian accounts was not confirmed. [Stripe CA pricing](https://stripe.com/en-ca/pricing)
- Stripe dispute add-ons: Smart Disputes takes 30% of the disputed amount on wins only; Visa dispute resolution/CE3.0 block $15; Mastercard resolution $29. [Stripe CA pricing](https://stripe.com/en-ca/pricing)
- 3-D Secure: "Payments that have been successfully authenticated using 3D Secure are covered by a liability shift. Should a 3D Secure payment be disputed as fraudulent by the cardholder, the liability shifts from you to the card issuer." Non-fraud disputes are not covered. [Stripe support: liability shift](https://support.stripe.com/questions/liability-shift-with-frictionless-flow-for-3d-secure-v2-(3ds2))
- CVC and postal code rules: Radar's block rules act on CVC or postal code failures combined with risk score, and do not block wallet payments where no CVC is supplied; an issuer may still approve a payment that failed either check. [Stripe Radar rules](https://docs.stripe.com/radar/rules), [Stripe support](https://support.stripe.com/questions/cvc-or-avs-failed-but-payment-succeeded)
- "Product not received" evidence: provide "proof of shipment and delivery that includes the full delivery address, not just the city and postal code". A tracking number alone "might only confirm that the package left your facility". Stripe's own analysis: evidence submitted after delivery was confirmed had "a 27 percentage point higher win rate"; a GPS delivery map added about 15 points more. Return-policy evidence "isn't relevant" to a not-received claim. Suggested extras: delivery photo, signature, the notifications you sent. [Stripe dispute best practices](https://docs.stripe.com/disputes/best-practices), [Stripe blog analysis](https://stripe.com/blog/analyzing-the-evidence-that-helps-businesses-win-product-not-received-disputes), [Stripe visual evidence](https://docs.stripe.com/disputes/visual-evidence)
- Canada Post Signature: "a personal hand-off at delivery with proof"; records the signer's name and signature; no charge with Priority and Xpresspost Certified; mandatory for additional liability coverage. [Canada Post signature and identity services](https://www.canadapost-postescanada.ca/cpc/en/support/articles/parcel-services-shipping-in-canada/signature-and-identity-services.page)
- Square: current tools are Risk Manager, a disputes team and a Disputes Dashboard; the old Chargeback Protection programme ended 2019-04-19 (third-party). Risk Manager price and Canadian 3-D Secure behaviour: COULD NOT VERIFY. [Square CA dispute help](https://squareup.com/help/ca/en/subtopic/dispute-management)
- Quebec consumers have a statutory chargeback route: if a merchant does not refund within 15 days of a valid cancellation, the consumer can ask the card issuer within 60 days. [OPC Quebec: cancelling an online purchase](https://www.opc.gouv.qc.ca/en/consumer/topic/purchase/online-purchase/cancelling/)

### Inferences
- Settings to start with: request 3-D Secure when the processor's risk score is elevated or the order is above a set value; require CVC; collect full billing address with postal code; block on postal code fail plus elevated risk.
- Cheap manual rules in the admin: flag orders where billing and shipping provinces differ, first-time customer plus high value, several cards tried on one order, or a freight-forwarder address. Hold flagged orders for a phone or email check before shipping.
- Signature threshold: require signature above a chosen order value (for example $150) and for all glass. For pickup orders, record who collected and check photo ID against the order name; a card-not-present pickup has no delivery record otherwise.
- Keep per order: tracking number, carrier delivery scan with full address, signature image, every email sent with timestamps, IP, AVS/CVC/3DS results. That is the dispute packet.
- Respond to every dispute and inquiry, even hopeless ones; with Stripe the counter fee is returned on a win, and an unanswered inquiry can undo a 3DS liability shift (third-party claim, unverified).

### Gaps
- Dispute response deadlines by network were not found in this session's results.
- Square Risk Manager cost and rule features in Canada.
- Whether Canada AVS (postal code only versus full address) is passed through each processor.

---

## 6. Customer accounts and data retention

### Takeaway
Guest checkout should be the default: Baymard reports 18% of US shoppers abandoned an order because the site required an account. Keep only what the order, tax records and disputes need; the CRA sets the floor at six years for the order and tax records, and PIPEDA says to delete what no longer has a purpose.

### Cited Findings
- Baymard: average documented cart abandonment 70.22% (50 studies, 2006 to 2025). Reasons among US shoppers: extra costs 40%, "site required creating an account" 18%, distrust with card information 19%, checkout too long 17%, could not see total up front 12%, not enough payment methods 9%. Baymard recommends to "offer guest checkout". Sample size and survey year are not stated on the page. [Baymard cart abandonment statistics](https://baymard.com/lists/cart-abandonment-rate)
- Baymard benchmark: 62% of sites do not make guest checkout the most prominent option (2025 benchmark, per search snippet); Baymard also recommends offering account creation after the order, on the confirmation step. [Baymard: make guest checkout prominent](https://baymard.com/blog/make-guest-checkout-prominent), [Baymard: delayed account creation](https://baymard.com/blog/delayed-account-creation)
- PIPEDA Principle 5: "Keep personal information only as long as it is needed to serve those purposes." Set minimum and maximum retention periods that account for "any legal requirements or restrictions"; adopt written retention and destruction procedures; destroy or anonymize what is no longer needed. No numeric period is given. [OPC: limiting use, disclosure and retention](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_use/)
- CRA: keep records "for a period of six years from the end of the last tax year they relate to" (Income Tax Act and Excise Tax Act). "You must keep records at your place of business or your residence in Canada." Records stored outside Canada and accessed electronically from Canada do not count as kept in Canada without CRA permission. Page modified 2026-08-03. [CRA: where to keep records and for how long](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/keeping-records/where-keep-your-records-long-request-permission-destroy-them-early.html)
- Manitoba (if registered there): records for "the current fiscal year plus the immediately preceding six years". [Manitoba RST 004](https://www.gov.mb.ca/finance/taxation/pubs/bulletins/004.pdf)
- Card data: store only brand, last four, expiry and processor ids. [Stripe security guide](https://docs.stripe.com/security/guide)

### Inferences
- Minimum data set per order: name, email, phone (carrier needs it), shipping and billing address, items, amounts and tax by type, processor payment id, tracking, consent record if they opted in to the newsletter, age-confirmation timestamp. No date of birth unless a processor demands it.
- Retention schedule to write down: order and tax records 7 years (covers the CRA six-years-after-year-end rule); abandoned carts and unpaid pending orders 30 to 90 days; marketing list until unsubscribe, then keep only a suppression hash; server logs 30 to 90 days; dispute evidence for the life of the order record.
- CRA "records in Canada" rule: D1 data location is chosen by Cloudflare unless a jurisdiction or location hint is set. LIKELY simplest compliance: a scheduled export of orders and tax data (CSV or JSON) to storage physically held in Canada or downloaded to the shop's own computer monthly. Confirm with the accountant.
- Offer "save my details / create an account" on the confirmation page (Baymard's delayed account creation), using a magic link so there is no password store to protect.

### Gaps
- Baymard's sample size and survey date for the 18% figure.
- Quebec private-sector privacy law (Law 25) obligations for a seller with Quebec customers were not researched.
- D1 data residency options were not checked.

---

## 7. Age confirmation

### Takeaway
No processor page read this session states an age-check requirement for hookah accessories. Age verification is a card-brand and underwriter expectation for tobacco-coded (MCC 5993) card-not-present merchants, so a light age gate plus carrier proof-of-age is the customary way to make an approval request stronger, not a published rule.

### Cited Findings
- Stripe, Square and Helcim policy pages contain no age-verification requirement for accessories. Square's only age clause is the prohibition on "internet/mail order/telephone order of age restricted products (e.g., fireworks, e-cigarettes)". [Square CA Payment Terms](https://squareup.com/ca/en/legal/general/payment), [Stripe restricted businesses](https://stripe.com/en-ca/legal/restricted-businesses), [Helcim AUP](https://legal.helcim.com/ca/acceptable-use-policy/)
- Industry sources (LegitScript, a high-risk underwriting guide) say Visa requires age verification for card-absent tobacco sales and that underwriters expect an age notice on the site (pop-up and footer) for card-not-present tobacco. These concern tobacco, are US-centred, and are not card-network rule text. [LegitScript](https://www.legitscript.com/high-risk-and-problematic-products/how-legitscript-protects-payment-processors-from-tobacco-risk/), [underwriting guide PDF](https://partners.merchantservicedepot.com/wp-content/uploads/2025/01/MSD-High-Risk-UW-Guidelines-compressed.pdf)
- Canada Post Proof of Age: options for 18, 19 or 21. When the receiver appears under 30, staff ask for photo ID and record the signatory's name and signature; items go only to someone with acceptable ID. Available to Solutions for Small Business cardholders and commercial shippers using an approved electronic shipping system. A fee applies; the amount is not on the page. "The shipper is responsible for selecting the correct age". [Canada Post signature and identity services](https://www.canadapost-postescanada.ca/cpc/en/support/articles/parcel-services-shipping-in-canada/signature-and-identity-services.page)
- Purolator Adult Signature Required: government photo ID with proof of age at delivery; age 18 in Alberta, 21 in Quebec, 19 elsewhere per an older Purolator page, with a newer Purolator guide saying requirements "differ by province or territory"; held for pickup if no ID. PARTLY VERIFIED (search snippets). [Purolator resource](https://resources.purolator.com/responsibility-in-the-new-era-of-home-delivery/)
- UPS Canada adult signature: no result. COULD NOT VERIFY.

### Inferences
- Light-touch stack, in rising order of friction: (1) site-entry or checkout checkbox "I confirm I am of legal age in my province", stored with timestamp on the order; (2) date-of-birth field at checkout (more friction, more personal data to hold); (3) carrier Proof of Age or adult signature at the door; (4) third-party ID verification (Stripe Identity is $2.00 per check per Stripe's pricing page), which is far heavier than this catalogue warrants.
- Recommended default: checkbox at checkout, terms clause, and Canada Post Signature on all orders with Proof of Age offered as the stricter setting the owner can switch on if a processor asks for it. State the age gate and delivery check in the processor pre-approval email.
- In-store pickup: staff check ID at the counter, same as an in-store sale.

### Gaps
- Visa and Mastercard primary rule text on age verification for MCC 5993.
- Canada Post Proof of Age fee for 2026.
- Whether any province treats hookah pipes or accessories as age-restricted goods (provincial tobacco and smoking-accessory law was out of scope and not researched).

---

## 8. Policies to publish, and Ontario / Quebec online-sale rules that touch checkout

### Takeaway
Publish shipping, returns, privacy and terms pages, and build the checkout so that the legally required facts (who the seller is, full price with taxes and shipping, delivery date and method, cancellation and refund terms) are on screen before the pay button, followed by an emailed copy of the order. Quebec's rules were verified from the regulator; Ontario's could not be read from the statute this session and are flagged.

### Cited Findings

**Quebec (Office de la protection du consommateur, verified)**
- Before the contract the merchant must disclose: its name, address and phone number; a detailed description; the price, related fees and taxes; the total; payment terms; currency if not CAD; delivery date, mode and location; cancellation, return and refund conditions; any other restrictions. It must be clear, prominent, and easy to save and print. [OPC: cancelling an online purchase](https://www.opc.gouv.qc.ca/en/consumer/topic/purchase/online-purchase/cancelling/)
- The merchant must send a copy of the contract within 15 days, in a form the consumer can keep and print (CPA s.54.7, per search snippet of legislation summaries).
- Consumer cancellation rights: within 7 days of receiving the contract if required information was missing or it cannot be saved and printed; within 30 days of purchase if no contract was sent within 15 days; any time before delivery if goods are not delivered within 30 days of the agreed date (or 30 days after purchase if no date was set). [OPC](https://www.opc.gouv.qc.ca/en/consumer/topic/purchase/online-purchase/cancelling/)
- After a valid cancellation the merchant has 15 days to refund (CPA s.54.13); failing that the consumer may request a chargeback from the card issuer within 60 days. [OPC sample notice](https://www.opc.gouv.qc.ca/en/consumer/topic/purchase/online-purchase/cancelling/sample-cancellation-notice), [OPC](https://www.opc.gouv.qc.ca/en/consumer/topic/purchase/online-purchase/cancelling/)
- Whether these rules bind a merchant located outside Quebec: the OPC page that covers it returned only a cookie notice. COULD NOT VERIFY; confirm at [OPC: merchants outside Quebec](https://www.opc.gouv.qc.ca/en/consumer/topic/purchase/online-purchase/outside-quebec) and CPA s.54.2 on [LegisQuebec](https://www.legisquebec.gouv.qc.ca/en/document/cs/p-40.1).

**Ontario**
- The Consumer Protection Act, 2023 received Royal Assent 2023-12-06 and the e-Laws page states "THIS ACT IS NOT YET IN FORCE. It comes into force on a day to be named by proclamation". It will merge internet, remote and future-performance agreements into one "consumer agreement" regime. So the Consumer Protection Act, 2002 still governs. [CPA 2023 on e-Laws](https://www.ontario.ca/laws/statute/23c23), [Gowling summary](https://gowlingwlg.com/en/insights-resources/articles/2023/ontario-s-new-consumer-protection-act)
- The 2002 Act has an "Internet Agreements" part: s.37 application, s.38 disclosure of information, s.39 copy of internet agreement, s.40 cancellation of internet agreement (confirmed from the table of contents only). [CPA 2002 on e-Laws](https://www.ontario.ca/laws/statute/02c30)
- COULD NOT VERIFY from the statute text (e-Laws pages render by script and returned no body): the commonly cited rules are a $50 threshold; pre-purchase disclosure of seller identity, itemised price, taxes, shipping, total, delivery date and method, cancellation and return policy; an express chance to accept, decline and correct errors; a written copy within 15 days; cancellation within 7 days of receiving the copy if disclosure was deficient, within 30 days if no copy is sent, and where delivery is 30 days late; refund within 15 days of cancellation; and a card charge-reversal request if the supplier does not refund. To confirm: read CPA 2002 ss.26, 37 to 40, 92 to 96, 99 and O. Reg. 17/05 ss.31 to 33 in a browser at [O. Reg. 17/05](https://www.ontario.ca/laws/regulation/050017).

**Other items that belong on the published pages (sourced elsewhere in these notes)**
- Privacy: PIPEDA expects stated purposes and a retention practice. [OPC](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_use/)
- Email: sender identity, mailing address, unsubscribe. [CASL s.6](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html)
- Receipts: GST/HST number on receipts of $100 or more. [CRA RC4022](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html)
- Processors look for clear refund policies when underwriting higher-risk applicants. [Helcim: before signing up](https://learn.helcim.com/docs/before-signing-up)

### Inferences
- Designing to the Quebec list satisfies the stricter of the two regimes, so use it as the checkout checklist: review step shows legal business name, street address, phone and email; each item with description and price; shipping; each tax by name; total in CAD; delivery method and estimated date (or pickup location and ready time); link to and one-line summary of the return and cancellation terms; then the pay button.
- The order confirmation email is the "copy of the contract": send it immediately, include everything on the review step plus order number and date, in a form that prints cleanly. Immediate send comfortably meets a 15-day rule.
- Ship or contact the customer well inside 30 days of the stated date; the admin should flag unshipped paid orders at 7 and 21 days.
- Process approved refunds within 15 days; simplest is to refund through the processor the same day the return is accepted.
- Pages to publish: Shipping (carriers, costs, timelines, signature and age check, Canada only), Returns and Refunds (window, condition, who pays return shipping, breakage claims for glass, unclaimed pickup), Privacy (what is collected, why, processors used, retention, contact), Terms of Sale (seller identity, age confirmation, pricing and tax, order acceptance, cancellation rights, governing law), and a Contact page with street address and phone. Show the GST/HST number on receipts.
- A terms page drafted by the developer should be read once by a lawyer or reviewed against the statutes above before launch; these notes are research, not legal advice.

### Gaps
- Ontario statute and regulation text (verify in a browser; five-minute job).
- Quebec applicability to out-of-province merchants, and Quebec French-language obligations for a site selling into Quebec.
- BC, Alberta and other provinces' distance-sales rules were not researched; they are broadly similar in structure but were not checked.
- Competition Act drip-pricing rules (all mandatory fees in the advertised price) were not researched and are relevant to how shipping and fees are shown.
