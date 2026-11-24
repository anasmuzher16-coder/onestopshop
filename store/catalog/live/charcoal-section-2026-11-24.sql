-- Charcoal gets its own section (shop request, 2026-11-24). Safe to run twice: every step checks it has not happened yet.
-- 1. the Charcoal section, after Heat; the sections after it move down one place
-- 2. every charcoal item (flagged charcoal in its details: 60 boxes, 9 priced single rolls, 3 unpriced rolls kept off) moves
--    from Heat to Charcoal, each move logged so the undo knows exactly which
-- 3. Heat keeps the foil and brings back exactly the Heat items hidden when charcoal moved in (logged on 2026-11-23 as
--    'charcoal-2026-11-23:retire'), each logged
-- Pickup or local delivery only follows the section: src/catalog.js treats every item in Charcoal as charcoal.
-- Undo: ROLLBACK.sql in the polish scratchpad (and REMOTE-STEPS.sql for the live database).
UPDATE categories SET sort = sort + 1 WHERE sort > 3 AND id <> 'charcoal' AND EXISTS (SELECT 1 FROM categories WHERE id <> 'charcoal' AND sort = 4) AND NOT EXISTS (SELECT 1 FROM categories WHERE id = 'charcoal');
INSERT OR IGNORE INTO categories (id, name, tone, sort, active) VALUES ('charcoal', 'Charcoal', 'ash', 4, 1);
INSERT INTO audit_log (actor, action, target, before, after) SELECT 'owner', 'charcoal-section-2026-11-24:move', sku, '{"category_id":"heat"}', '{"category_id":"charcoal"}' FROM products WHERE category_id = 'heat' AND (details LIKE '%"charcoal":true%' OR family LIKE 'charcoal-%') AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.action = 'charcoal-section-2026-11-24:move' AND a.target = products.sku);
UPDATE products SET category_id = 'charcoal', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE category_id = 'heat' AND (details LIKE '%"charcoal":true%' OR family LIKE 'charcoal-%');
INSERT INTO audit_log (actor, action, target, before, after) SELECT 'owner', 'charcoal-section-2026-11-24:restore', sku, '{"active":0}', '{"active":1}' FROM products WHERE category_id = 'heat' AND active = 0 AND sku IN (SELECT target FROM audit_log WHERE action = 'charcoal-2026-11-23:retire') AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.action = 'charcoal-section-2026-11-24:restore' AND a.target = products.sku);
UPDATE products SET active = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE category_id = 'heat' AND active = 0 AND sku IN (SELECT target FROM audit_log WHERE action = 'charcoal-2026-11-23:retire');
