-- One Stop Shop store, first schema. Money is whole cents, weight is whole grams, times are ISO 8601 UTC text.
CREATE TABLE categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, tone TEXT NOT NULL DEFAULT 'gilt',
  sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE boxes (
  id TEXT PRIMARY KEY, label TEXT NOT NULL,
  l_cm REAL NOT NULL, w_cm REAL NOT NULL, h_cm REAL NOT NULL, tare_g INTEGER NOT NULL
);
CREATE TABLE products (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
  weight_g INTEGER NOT NULL CHECK (weight_g > 0),
  box_id TEXT NOT NULL REFERENCES boxes(id),
  glass INTEGER NOT NULL DEFAULT 0,
  -- how it may travel: standard (any service), ground_only (cologne and the like), pickup_only (never shipped)
  ship_class TEXT NOT NULL DEFAULT 'standard' CHECK (ship_class IN ('standard','ground_only','pickup_only')),
  height_cm REAL,
  note TEXT NOT NULL DEFAULT '',
  img TEXT NOT NULL DEFAULT '', img_dark INTEGER NOT NULL DEFAULT 0, img_lw INTEGER,
  details TEXT NOT NULL DEFAULT '{}',          -- JSON for section-specific fields (cologne size, strength)
  stock INTEGER NOT NULL DEFAULT 0,            -- kept equal to SUM(stock_moves.delta) by the code that writes moves
  low_stock_at INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX products_category ON products(category_id, active, sort);
-- Every change to a stock count is one row here, so the number can always be explained.
CREATE TABLE stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL REFERENCES products(sku),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('count','received','sale','return','damaged','reserved','released','correction')),
  ref TEXT, actor TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX stock_moves_sku ON stock_moves(sku, at);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,                         -- public order code
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','packed','shipped','ready','collected','cancelled','refunded')),
  method TEXT NOT NULL CHECK (method IN ('ship','pickup')),
  email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT,
  address TEXT NOT NULL DEFAULT '{}',          -- JSON
  subtotal_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL, tax_province TEXT,
  ship_service TEXT, ship_quote TEXT NOT NULL DEFAULT '{}', tracking TEXT, label_cents INTEGER,
  payment_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX orders_status ON orders(status, created_at);
CREATE TABLE order_items (
  order_id TEXT NOT NULL REFERENCES orders(id), sku TEXT NOT NULL REFERENCES products(sku),
  name TEXT NOT NULL, qty INTEGER NOT NULL CHECK (qty > 0), unit_cents INTEGER NOT NULL,
  PRIMARY KEY (order_id, sku)
);
-- Who changed what in the admin.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL,
  target TEXT, before TEXT, after TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
