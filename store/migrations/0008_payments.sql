-- Online payment (Stripe Checkout) and pay at the counter. Numbered 0008, not 0007: 0006 is taken twice on other
-- branches (catalogue, back office) and 0007 is the next number any of them would reach for. Only new columns and
-- tables: the orders table is not rebuilt, so columns other branches add to it survive.
--
-- How an order is paid, and where that stands. orders.status keeps its meaning (the shop's work on the order);
-- pay_status is the money. An order turns 'paid' only from a signed Stripe webhook or the shop marking a
-- pay-at-pickup order paid at the counter.
ALTER TABLE orders ADD COLUMN pay_method TEXT CHECK (pay_method IS NULL OR pay_method IN ('card','at_pickup'));
ALTER TABLE orders ADD COLUMN pay_status TEXT CHECK (pay_status IS NULL OR pay_status IN ('awaiting','paid','pay_at_pickup','expired','failed','refunded','part_refunded'));
ALTER TABLE orders ADD COLUMN pay_session TEXT;        -- Stripe Checkout Session id (cs_...)
ALTER TABLE orders ADD COLUMN pay_intent TEXT;         -- Stripe PaymentIntent id (pi_...), known once paid; refunds go against it
ALTER TABLE orders ADD COLUMN pay_url TEXT;            -- the hosted payment page, so a retry goes back to the same page
ALTER TABLE orders ADD COLUMN pay_expires_at TEXT;     -- when Stripe closes that page (UTC)
ALTER TABLE orders ADD COLUMN paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0);
ALTER TABLE orders ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0);
ALTER TABLE orders ADD COLUMN paid_at TEXT;
ALTER TABLE orders ADD COLUMN release_op TEXT;         -- the one expiry/failure that won; only it puts the held stock back
CREATE UNIQUE INDEX orders_pay_session ON orders(pay_session) WHERE pay_session IS NOT NULL;
CREATE INDEX orders_pay_wait ON orders(pay_status, created_at) WHERE pay_status = 'awaiting';

-- Every Stripe event we accepted (signature checked), so a resent event is seen as a repeat. No foreign key, so a
-- reseed of sample orders never trips over it.
CREATE TABLE pay_events (
  id TEXT PRIMARY KEY,                               -- Stripe event id (evt_...)
  type TEXT NOT NULL,
  order_id TEXT,
  result TEXT NOT NULL,                              -- what we did: paid, released, ignored, mismatch, repeat
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX pay_events_order ON pay_events(order_id, at);

-- Refunds from the back office. The amount is booked here first (status 'pending') inside one statement that checks
-- what is left to refund, so two taps at once can never refund more than was paid.
CREATE TABLE refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op TEXT NOT NULL UNIQUE,                           -- the request's own key: also Stripe's Idempotency-Key
  order_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  stripe_id TEXT,
  reason TEXT,
  actor TEXT NOT NULL,
  detail TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX refunds_order ON refunds(order_id, status);
