-- Supplier catalogues (2026-11-24). Each colour is its own sellable row, grouped into a product family.
-- Supplier columns are written only by the catalogue import (store/tools/catalog); the shop's own columns
-- (name, price_cents, stock, active, note) are never written by an import once a row exists.
-- Numbered 0005 on purpose: 0004 is left free for the charcoal-in-Heat branch. Rules: store/catalog/SCHEMA.md.
ALTER TABLE products ADD COLUMN family TEXT;                                -- 'ace-tsar-molotov'; NULL = a stand-alone product
ALTER TABLE products ADD COLUMN variant_label TEXT NOT NULL DEFAULT '';     -- the colour chip's name, from the photo, person-confirmed
ALTER TABLE products ADD COLUMN swatch_hex TEXT;                            -- the chip colour, '#5271ff'
ALTER TABLE products ADD COLUMN supplier_id TEXT;                           -- 'ace'; NULL = made in the back office
ALTER TABLE products ADD COLUMN supplier_ref TEXT;                          -- the supplier's own name for it, verbatim
ALTER TABLE products ADD COLUMN supplier_price_cents INTEGER CHECK (supplier_price_cents IS NULL OR supplier_price_cents >= 0);
                                                                            -- as printed by the supplier; private, NEVER the shelf price
ALTER TABLE products ADD COLUMN availability TEXT NOT NULL DEFAULT 'counted'
  CHECK (availability IN ('counted','in_store_uncounted','special_order','dropped'));
ALTER TABLE products ADD COLUMN facts_known TEXT NOT NULL DEFAULT '{}';     -- {"includes_base":false,"weight_g":null}: null = unknown, said out loud
CREATE INDEX products_family ON products(family, sort);
CREATE INDEX products_supplier ON products(supplier_id, availability);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, sku_block TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
);

-- One row per catalogue import that changed something, keyed by the master file's hash: the same file twice is a no-op.
CREATE TABLE catalog_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  source_sha256 TEXT NOT NULL,                 -- the supplier's file (the PDF, the list)
  master_sha256 TEXT NOT NULL,                 -- store/catalog/suppliers/<id>/master.json as applied
  edition TEXT NOT NULL DEFAULT '',
  added INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0, retired INTEGER NOT NULL DEFAULT 0,
  price_review INTEGER NOT NULL DEFAULT 0,
  actor TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (supplier_id, master_sha256)
);

-- A catalogue item cannot be switched on until the shop has set its own price (the supplier's price never counts).
CREATE TRIGGER products_shop_price_before_on_insert BEFORE INSERT ON products
  WHEN NEW.supplier_id IS NOT NULL AND NEW.active = 1 AND NEW.price_cents <= 0
  BEGIN SELECT RAISE(ABORT, 'Set the shop price before turning this item on.'); END;
CREATE TRIGGER products_shop_price_before_on_update BEFORE UPDATE OF active, price_cents, supplier_id ON products
  WHEN NEW.supplier_id IS NOT NULL AND NEW.active = 1 AND NEW.price_cents <= 0
  BEGIN SELECT RAISE(ABORT, 'Set the shop price before turning this item on.'); END;
