-- What the shop shows from 2026-11-24 (owner): the real stock goes up, the demo's sample hookahs come down.
-- Run AFTER migrations 0005 and 0006 and the generated catalogue seeds (store/catalog/out/seed-ace.sql, seed-shisha.sql,
-- seed-charcoal-foil-foil.sql). Safe to run twice. Nothing is deleted.
--
-- 1. Ace Hookah: every colour is on view with "Price TBD" (listed = 1, written by seed-ace.sql). None can be bought until
--    the shop sets its own price and turns it on: the 0005 triggers, the storefront and checkout all hold that rule.
-- 2. Shisha (owner: "Just put up the shisha"): all 47 flavours on sale at the shop's prices, stock as the shop gave it
--    (10, or 0 for the three sold out). Shipping weight is an estimate (250 g net plus the tub) until the shop weighs one.
UPDATE categories SET active = 1 WHERE id = 'shisha' AND active = 0;
UPDATE products SET active = 1 WHERE supplier_id = 'shisha' AND active = 0 AND price_cents > 0;
UPDATE products SET weight_g = 400 WHERE supplier_id = 'shisha' AND weight_g = 1;
-- the 26 approved photos (store/public/img/pc/oss-96NN.webp, -m, -s); the rest show "Photo coming"
UPDATE products SET img = 'oss-' || substr(sku, 5) WHERE supplier_id = 'shisha' AND img = '' AND sku IN ('OSS-9601','OSS-9602','OSS-9603','OSS-9604','OSS-9605','OSS-9606','OSS-9608','OSS-9610','OSS-9612','OSS-9613','OSS-9614','OSS-9615','OSS-9616','OSS-9621','OSS-9622','OSS-9623','OSS-9624','OSS-9625','OSS-9626','OSS-9627','OSS-9628','OSS-9629','OSS-9630','OSS-9631','OSS-9632','OSS-9633');
-- 3. Foil is on sale from seed-charcoal-foil-foil.sql. Its pack weights are not known yet, so the storefront offers it by
--    pickup or local delivery until they are ("Shipping TBD").
-- 4. The demo's sample hookahs (OSS-1001 to OSS-1039) are switched off. Orders point at them, so they stay in the
--    database; their old addresses redirect to /shop/hookahs.
UPDATE products SET active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE category_id = 'hookahs' AND supplier_id IS NULL AND sku LIKE 'OSS-1___' AND active = 1;
INSERT INTO audit_log (actor, action, target, after) VALUES ('owner-ruling', 'catalog.on_view', 'all', '{"date":"2026-11-24","ace":"listed, price TBD","shisha":"on sale","foil":"on sale, pickup or local","sample_hookahs":"off"}');
