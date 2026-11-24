-- Back office, round two: named staff with PINs, who-did-what on every sign-in, cancel with restock, the staff-only
-- ID tick on charcoal orders, where each order came from, and the settings behind the monthly report.
-- Numbered 0006 because 0005 is the catalogue migration on another branch. Nothing here touches products.

-- Staff. A PIN is never stored: only a salted, peppered PBKDF2 hash (see src/staff.js). Removing someone keeps the
-- row (old history still names them) and ends every sign-in they had.
CREATE TABLE staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,                       -- "pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>"
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  removed_at TEXT
);
CREATE UNIQUE INDEX staff_name_active ON staff(lower(name)) WHERE active = 1;

-- Each sign-in knows who it is: the owner (passcode) or one staff member (name and PIN).
ALTER TABLE sessions ADD COLUMN actor TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE sessions ADD COLUMN staff_id INTEGER REFERENCES staff(id);
ALTER TABLE sessions ADD COLUMN last_seen TEXT;               -- a sign-in left alone for 2 hours ends by itself
CREATE INDEX sessions_staff ON sessions(staff_id);
CREATE INDEX sessions_expires ON sessions(expires_at);
ALTER TABLE login_attempts ADD COLUMN staff_id INTEGER;
CREATE INDEX login_attempts_staff ON login_attempts(staff_id, at);

-- A tap sent twice (a slow phone, a double tap) carries the same key, and the database lets it count once.
ALTER TABLE stock_moves ADD COLUMN op TEXT;
CREATE UNIQUE INDEX stock_moves_op ON stock_moves(op) WHERE op IS NOT NULL;
CREATE INDEX stock_moves_ref ON stock_moves(ref, reason);

-- Orders: cancel, pickup clock, staff-only ID tick, and where the order came from.
ALTER TABLE orders ADD COLUMN ready_at TEXT;                  -- when it was marked ready for pickup (the 3-day reminder)
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_by TEXT;
ALTER TABLE orders ADD COLUMN cancel_reason TEXT CHECK (cancel_reason IS NULL OR cancel_reason IN ('no_show','customer','other'));
ALTER TABLE orders ADD COLUMN cancel_note TEXT;
ALTER TABLE orders ADD COLUMN cancel_op TEXT;                 -- the one cancel request that won; only it puts stock back
ALTER TABLE orders ADD COLUMN id_checked_by TEXT;             -- staff only, never shown to customers
ALTER TABLE orders ADD COLUMN id_checked_at TEXT;
ALTER TABLE orders ADD COLUMN source TEXT;                    -- short channel: card, gbp, instagram, google, direct...
ALTER TABLE orders ADD COLUMN source_detail TEXT NOT NULL DEFAULT '{}';   -- {"utm_source","src","utm_medium","utm_campaign","ref_host","landing"}: no names, no full URLs
CREATE INDEX orders_created ON orders(created_at);
CREATE INDEX orders_cancelled ON orders(cancelled_at) WHERE cancelled_at IS NOT NULL;
UPDATE orders SET ready_at = updated_at WHERE status = 'ready' AND ready_at IS NULL;
UPDATE orders SET cancelled_at = updated_at WHERE status IN ('cancelled','refunded') AND cancelled_at IS NULL;   -- a refund stays in the month it happened

-- Who-did-what lookups for one product or one order.
CREATE INDEX audit_log_target ON audit_log(target, id);

-- Settings the owner can change in the back office. The studio share basis waits on the owner's written word.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT 'setup',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('studio_share_basis', 'subtotal'), ('studio_share_bp', '500');
