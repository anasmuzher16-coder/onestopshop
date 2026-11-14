-- Photos the shop uploads from the admin. Small (resized in the browser before upload), so they live beside
-- the product for now. They move to file storage (R2) when real photo volumes arrive.
CREATE TABLE product_photos (
  sku TEXT PRIMARY KEY REFERENCES products(sku),
  type TEXT NOT NULL, bytes BLOB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
ALTER TABLE products ADD COLUMN photo_ver INTEGER NOT NULL DEFAULT 0;
