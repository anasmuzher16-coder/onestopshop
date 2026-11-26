# Payments

How the store takes money, why Stripe, and what the shop does to switch it on. Every fact about a provider below
was read on that provider's own page on 2026-11-24; the link is next to it.

## Decision: Stripe Checkout (hosted page), plus pay at the counter for pickup

Confirmed over Square and Helcim. Three reasons, in order:

1. **Shisha is tobacco, and only Stripe allows it online at all.** Square Canada prohibits "internet/mail order/
   telephone order of age restricted products (e.g., tobacco)"
   ([Square prohibited goods](https://squareup.com/help/ca/en/article/5089-prohibited-goods-and-services-with-square-point-of-sale)).
   Helcim prohibits "Tobacco and nicotine product sales (except physical store sales)"
   ([Helcim acceptable use](https://legal.helcim.com/ca/acceptable-use-policy/)). Stripe lists tobacco as
   *restricted*: allowed only with Stripe's approval ([Stripe restricted businesses](https://stripe.com/legal/restricted-businesses)).
   None of the three names hookahs or accessories. So the store refuses card payment for shisha until the shop has
   Stripe's written approval and sets `STRIPE_TOBACCO_OK=1`; shisha can still be picked up and paid at the counter.
2. **It runs from a Cloudflare Worker with plain `fetch`** and Web Crypto for webhook signatures
   ([Stripe on Workers](https://blog.cloudflare.com/announcing-stripe-support-in-workers)). No SDK is bundled.
3. **The hosted Checkout page keeps the shop at PCI SAQ A**: card numbers are typed on Stripe's page, never ours
   ([Stripe PCI guide](https://stripe.com/guides/pci-compliance); PCI SSC: SAQ A is for merchants that "outsource
   all payment processing and do not store, process or transmit cardholder data",
   [PCI SSC FAQ](https://www.pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/how-do-pci-dss-requirements-2-6-and-8-apply-to-saq-a-merchants)).
   Apple Pay works on hosted Checkout with no extra setup ([Stripe Apple Pay](https://docs.stripe.com/apple-pay?platform=web));
   Google Pay is switched on in the Stripe dashboard's payment methods.

The cost gap is small: on a $100 order paid with a Canadian card, Stripe keeps $3.20 and Square $3.10.

| | Stripe Canada | Square Canada | Helcim Canada |
|---|---|---|---|
| Online, Canadian card | 2.9% + $0.30 | 2.8% + $0.30 | interchange + 0.50% + $0.25 (all-in varies by card) |
| Card from outside Canada | +0.8% (+2% if converted) | +1.5% | +0.68% network fee (CAD) |
| Monthly fee | none | none (Free plan) | none |
| Payout to the bank | 3 business days (first payout 7 days) | 1 to 2 business days | next business morning |
| Dispute | $15, plus $15 to contest (returned if won) | $0 | $15 if lost |
| Refund | the original fee is not returned | not returned | not returned |
| Counter reader | WisePad 3, $79; 2.7% + $0.05, Interac $0.15 | Reader $69; credit 2.5%, debit 0.75% + $0.07 | $249; interchange + 0.40% + $0.08 |
| Online tobacco | with Stripe's approval | prohibited | prohibited |

Sources: [Stripe pricing](https://stripe.com/en-ca/pricing), [Stripe payouts](https://docs.stripe.com/payouts),
[Square pricing](https://squareup.com/ca/en/pricing), [Square hardware](https://squareup.com/shop/hardware/ca/en/),
[Square disputes](https://squareup.com/help/ca/en/article/3882), [Square refunds](https://squareup.com/ca/en/press/refund-policy-update),
[Helcim pricing](https://www.helcim.com/pricing/), [Helcim fee disclosures](https://legal.helcim.com/ca/fee-disclosures/).

The counter reader is a separate decision. Square's is cheaper in store (2.5%) and can sit beside Stripe online.

## How a card order works

1. The browser sends only item numbers, quantities, the way to send it and the way to pay. The server prices
   everything from the database (OWASP: "Never accept a price, subtotal, tax, or total from the client",
   [Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)).
2. The order is written as `pending`, pay `awaiting`, and its stock is taken (the same guarded step as before).
3. The server creates a Checkout Session ([API](https://docs.stripe.com/api/checkout/sessions/create)) with one
   line per item, shipping and tax, all in cents ([smallest currency unit](https://docs.stripe.com/api/refunds/create)),
   checks that the lines add up to the order's total and that Stripe's `amount_total` equals it, and uses
   `Idempotency-Key: checkout-<order>` so a retry returns the same page
   ([idempotent requests](https://docs.stripe.com/api/idempotent_requests)). The page closes after 35 minutes
   (Stripe allows 30 minutes to 24 hours).
4. The shopper pays on Stripe's page and comes back to `/order/<code>`. The page asks `/api/pay/status` until the
   webhook has landed. Nothing says "paid" before that.
5. `POST /api/pay/webhook` checks the `Stripe-Signature` header itself: HMAC-SHA256 of `"<t>.<raw body>"` with the
   endpoint secret, compared in constant time, refused if older than 5 minutes ([webhooks](https://docs.stripe.com/webhooks)).
   Then `checkout.session.completed` (or `async_payment_succeeded`) marks the order paid only if the session id,
   amount, currency and test/live mode match. `payment_intent.succeeded` never pays an order: a PaymentIntent cannot
   prove which Checkout page it belongs to. A payment that lands on an order already closed (expired, or cancelled
   by the shop) is recorded as paid on that closed order, so the back office shows a refund is owed; it never
   revives the order or takes stock. The update is guarded (`status = 'pending' AND
   pay_status = 'awaiting'`), so the order turns paid once and the receipt is written once, however many times Stripe
   sends it. Event ids are kept in `pay_events`. This follows Stripe's fulfilment guide: webhooks required, the
   handler safe to run many times ([fulfil orders](https://docs.stripe.com/checkout/fulfillment?ui=full-page)).
6. `checkout.session.expired` (or `async_payment_failed`) closes the order as not paid and puts the held stock back.
   The release stamps a one-time token on the order and moves stock only where that token is its own, so two expiry
   events, or the sweep racing a webhook, can never put stock back twice.
7. Every 10 minutes a cron sweep asks Stripe about each order still waiting. A payment whose webhook was lost is
   marked paid; a page Stripe has closed gives its stock back; a page open past its time is expired at Stripe first
   ([expire a session](https://docs.stripe.com/api/checkout/sessions/expire)), so stock is never released while a
   payment could still land.

## Pay at the counter

For pickup only. The order is placed `pending` with pay `pay_at_pickup`, its stock is held, and the email says to
pay at the counter. In the back office it can be marked ready before payment but cannot be marked collected until
the shop taps "Mark paid at the counter" (`POST /api/admin/orders/<code>/paid`). Open item for the back-office
branch: a counter order never collected holds its stock until the shop cancels it with restock.

## Refunds

`POST /api/admin/orders/<code>/refund` with `{ op, amount_cents?, reason? }`, behind the back office sign-in.
No amount means the whole remainder. The amount is booked in `refunds` first, by one statement that checks what is
left (pending refunds count), so two taps at once can never refund more than was paid. The Stripe call carries
`Idempotency-Key: refund-<op>`, so the same tap sent twice refunds once. A refund Stripe refuses is marked failed
and books nothing; if Stripe does not answer at all, the refund stays booked as pending and the same tap can be
sent again safely. A refund Stripe reports as still pending is booked as done (card refunds normally settle at
once; refund-update and dispute events are not handled yet). Counter payments are refunded at the till. Refunds do not put stock back: a returned item is
counted in with the stock button ("return").

## Switching it on (the shop does this; nothing here deploys)

1. Open a Stripe account for the shop at https://dashboard.stripe.com/register (business in Canada, payouts in CAD).
   Ask Stripe in writing to approve shisha (tobacco) before selling it online; until then leave `STRIPE_TOBACCO_OK` unset.
2. In the dashboard, Settings, Payment methods: keep Cards, turn on Apple Pay and Google Pay.
3. Developers, Webhooks, Add endpoint: `https://<the store's domain>/api/pay/webhook`, events
   `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`. Copy its signing secret (`whsec_...`).
4. Developers, API keys: create a restricted key with write access to Checkout Sessions and Refunds (or use the
   secret key). Then, from `store/`:
   `wrangler secret put STRIPE_SECRET_KEY` and `wrangler secret put STRIPE_WEBHOOK_SECRET`.
   Do this first with test keys (`sk_test_`, test-mode webhook) and place a test order with card 4242 4242 4242 4242.
5. Apply migration `0008_payments.sql` to the live database before the Worker that uses it.

## Testing without keys

`node store/tools/fake-stripe.mjs` (port 4498) stands in for Stripe: sessions, expiry, refunds, idempotency rules,
a pretend payment page, and webhooks signed the way Stripe signs them. Run the store with
`--var STRIPE_SECRET_KEY:sk_test_local --var STRIPE_WEBHOOK_SECRET:whsec_local_test --var STRIPE_API_BASE:http://127.0.0.1:4498 --test-scheduled`,
then `node store/tools/test-payments.mjs`. Signed event fixtures are in `store/tools/fixtures/stripe-webhooks.mjs`.
`STRIPE_API_BASE` accepts only `https://api.stripe.com` or a localhost address, so a typo can never send the key elsewhere.
On GitHub the `card` shard of `store tests` does this on every push (`CARD=1 node store/tools/ci-suites.mjs ...`):
`test-payments`, `test-pay-card` (wallets, delayed payments, live-mode events, shisha with `STRIPE_TOBACCO_OK` off, and
again as `test-pay-card+tobacco` with it on, charcoal never by carrier) and `test-emails` against the Resend stand-in
(`store/tools/fake-resend.mjs`, port 4497; `RESEND_API_BASE` accepts only `https://api.resend.com` or localhost).
The owner's switch-on steps are in `inventory-2026-11-24-next/PAYMENTS-EMAIL-LIVE.md`.
