-- Customer accounts, sticky features and loyalty (branch accounts-loyalty, 2026-11-24). Design and sources:
-- store/docs/ACCOUNTS-LOYALTY.md. Numbered 0009: 0006 is taken on two branches and 0007/0008 are left free for
-- the payments and back-office branches, so the three can merge in any order.

-- One row per customer. Email is stored lower-cased and is the only way in (no passwords).
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '{}',          -- saved delivery address, JSON {line1, city, postal}
  -- the charcoal reminder: off (NULL) unless the customer turned it on themselves (CASL express consent)
  remind_days INTEGER CHECK (remind_days IS NULL OR remind_days BETWEEN 7 AND 90),
  remind_consent_at TEXT, remind_consent_text TEXT, remind_last_at TEXT,
  unsub_token TEXT NOT NULL,                   -- lets an email's unsubscribe link work without signing in; it can do nothing else
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  last_sign_in_at TEXT
);
CREATE UNIQUE INDEX customers_unsub ON customers(unsub_token);
CREATE INDEX customers_remind ON customers(remind_days) WHERE remind_days IS NOT NULL;

-- Signed-in devices. The cookie holds a random token; only its SHA-256 is kept here.
CREATE TABLE customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX customer_sessions_customer ON customer_sessions(customer_id);
CREATE INDEX customer_sessions_expires ON customer_sessions(expires_at);

-- Emailed sign-in codes. The 6-digit code and the link token are kept only as salted hashes, live 10 minutes,
-- work once, and allow 5 wrong tries before they die.
CREATE TABLE sign_in_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  salt TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  link_hash TEXT NOT NULL UNIQUE,
  tries INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  who TEXT NOT NULL,                           -- hash of the requesting network address, for the rate limit
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX sign_in_codes_email ON sign_in_codes(email, created_at);
CREATE INDEX sign_in_codes_who ON sign_in_codes(who, created_at);
CREATE INDEX sign_in_codes_created ON sign_in_codes(created_at);

-- Wrong codes, counted per network address so guessing across many emails is slowed too.
CREATE TABLE account_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, who TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX account_attempts_who ON account_attempts(who, at);

CREATE TABLE favourites (
  customer_id INTEGER NOT NULL REFERENCES customers(id), sku TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (customer_id, sku)
);
-- "Email me when it is back": one email, then the row is removed.
CREATE TABLE stock_alerts (
  customer_id INTEGER NOT NULL REFERENCES customers(id), sku TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (customer_id, sku)
);
CREATE INDEX stock_alerts_sku ON stock_alerts(sku);

-- Points. A row never changes; what it is worth is read from its order's status at the time of asking:
--   earn   counts as "on the way" while the order is paid, packed or ready, and as points once shipped or collected;
--          it stops counting if the order is cancelled or refunded (so cancel or refund takes the points back by itself)
--   redeem holds its points while its order exists and is not cancelled or refunded (a cancelled order gives them back)
--   adjust a hand correction by the shop
-- Points never expire with time (Ontario Consumer Protection Act, see the design doc).
CREATE TABLE loyalty_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('earn','redeem','adjust')),
  points INTEGER NOT NULL CHECK (points >= 0 OR kind = 'adjust'),
  note TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (order_id, kind)
);
CREATE INDEX loyalty_customer ON loyalty_ledger(customer_id);

-- Shop settings the owner can change without a code change (the loyalty program lives here, off until turned on).
CREATE TABLE account_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Proof of consent for marketing email (CASL s.13 puts the proof on the sender). One row per yes, with the exact
-- words shown; withdrawn_at is set on unsubscribe, turning off, or deleting the account. Kept after the account is
-- deleted, because it is the record for emails already sent.
CREATE TABLE marketing_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL, purpose TEXT NOT NULL, words TEXT NOT NULL, detail TEXT,
  given_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  withdrawn_at TEXT
);
CREATE INDEX marketing_consents_email ON marketing_consents(email, given_at);

ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);
ALTER TABLE orders ADD COLUMN reward_cents INTEGER NOT NULL DEFAULT 0;
CREATE INDEX orders_customer ON orders(customer_id, created_at);
CREATE INDEX orders_email_lower ON orders(lower(email));

-- The email outbox gains the account kinds. SQLite cannot change a CHECK in place, so the table is rebuilt with
-- every row and id kept.
CREATE TABLE emails_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('order_placed','order_shipped','pickup_ready','low_stock','sign_in','back_in_stock','restock_reminder')),
  recipient TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','sent','failed')),
  detail TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO emails_new (id, order_id, kind, recipient, subject, html, body, status, detail, at)
  SELECT id, order_id, kind, recipient, subject, html, body, status, detail, at FROM emails;
DROP TABLE emails;
ALTER TABLE emails_new RENAME TO emails;
CREATE INDEX emails_order ON emails(order_id, at);
