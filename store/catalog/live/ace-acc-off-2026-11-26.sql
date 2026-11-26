-- Undo for the Ace accessories import (catalog/out/seed-ace-acc.sql, 2026-11-26): takes every accessory off the site
-- without deleting anything (orders and the audit log may point at the rows). Safe to run twice. Run it only if the
-- import has to come off. ace-acc-back-on-2026-11-26.sql puts each one back exactly as it was (on view, or on sale).
INSERT INTO audit_log (actor, action, target, before, after)
  SELECT 'owner-ruling', 'ace-acc-off-2026-11-26', sku, json_object('active', active, 'listed', listed), '{"active":0,"listed":0}'
  FROM products WHERE supplier_id = 'ace-acc' AND (active = 1 OR listed = 1);
UPDATE products SET active = 0, listed = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
  WHERE supplier_id = 'ace-acc' AND (active = 1 OR listed = 1);
