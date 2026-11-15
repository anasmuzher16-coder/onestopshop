-- Every email the store writes is kept here, whether or not a mail service is connected yet.
CREATE TABLE emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('order_placed','order_shipped','pickup_ready','low_stock')),
  recipient TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','sent','failed')),
  detail TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX emails_order ON emails(order_id, at);
-- Back office sign-ins: one row per signed-in device, so a sign-in can be ended, and it ends by itself.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  expires_at TEXT NOT NULL
);
-- Wrong passcodes are counted, so guessing gets locked out.
CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, who TEXT NOT NULL, ok INTEGER NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX login_attempts_at ON login_attempts(at);
