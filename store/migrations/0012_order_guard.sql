-- Per-visitor order limits (src/guard.js, src/checkout.js), 2026-11-26.
-- One row per order placed: `who` is a keyed hash of the visitor's address (IPv4 as it is, IPv6 by its /56, and a second
-- row by its /48), never the address itself, and `order_id` the order it placed, so the shop can count how many of that
-- visitor's orders still hold stock unpaid. Rows are deleted after 30 days by the 10-minute sweep (src/guard.js pruneGuards;
-- comment corrected 2026-11-27, the code always said 30), and the backup never copies this table.
CREATE TABLE order_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  who TEXT NOT NULL,
  order_id TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX order_attempts_who ON order_attempts(who, at);
CREATE INDEX order_attempts_at ON order_attempts(at);
-- the sweep that ends unpaid pay-at-the-counter holds reads only open ones
CREATE INDEX orders_pickup_hold ON orders(pay_expires_at) WHERE pay_status = 'pay_at_pickup' AND status = 'pending';
