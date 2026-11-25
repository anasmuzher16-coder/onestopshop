-- The demo's made-up sample products come off the shop (owner, 2026-11-24: "Hide samples, show coming soon").
-- Run AFTER on-view-2026-11-24.sql and charcoal-section-2026-11-24.sql. Safe to run twice. Nothing is deleted: orders
-- point at these rows, so they stay, switched off (active = 0). Each one switched off is logged, so the undo
-- (ROLLBACK.sql beside REMOTE-STEPS.sql) turns back on exactly these and nothing else.
-- The list is every sample row outside Hookahs (the sample hookahs went off with the Ace catalogue). It matches
-- store/src/samples.js. Real items (supplier rows: charcoal, foil, shisha, Ace) and anything the back office adds are
-- never in it, and the supplier_id IS NULL check keeps it that way even if a number were ever reused.
-- Sections left with nothing on sale (Bases, Bowls, Hoses, Parts and care, Cologne, Misc) stay on the site and show
-- "stock arriving soon" with the shop's phone, until the shop's own lists arrive. Heat keeps its foil.
INSERT INTO audit_log (actor, action, target, before, after)
  SELECT 'owner-ruling', 'samples-off-2026-11-24', sku, json_object('active', active, 'listed', listed), '{"active":0,"listed":0}' FROM products
  WHERE supplier_id IS NULL AND (active = 1 OR listed = 1) AND sku IN (
    'OSS-2001','OSS-2002','OSS-2003','OSS-2004','OSS-2005','OSS-2006','OSS-2007','OSS-2008','OSS-2009','OSS-2010','OSS-2011','OSS-2012',
    'OSS-3001','OSS-3003','OSS-3004','OSS-3006','OSS-3007','OSS-3008','OSS-3009','OSS-3010','OSS-3011','OSS-3012','OSS-3013',
    'OSS-4001','OSS-4002','OSS-4003','OSS-4004','OSS-4005','OSS-4006','OSS-4007','OSS-4008','OSS-4009',
    'OSS-5001','OSS-5002','OSS-5003','OSS-5005','OSS-5006','OSS-5007','OSS-5008','OSS-5009','OSS-5011','OSS-5012',
    'OSS-6002','OSS-6003','OSS-6004','OSS-6005','OSS-6006','OSS-6008','OSS-6009','OSS-6010',
    'OSS-7001','OSS-7002','OSS-7003','OSS-7004','OSS-7005','OSS-7006','OSS-7007','OSS-7008',
    'OSS-8001','OSS-8002','OSS-8003','OSS-8004','OSS-8005','OSS-8006');
UPDATE products SET active = 0, listed = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
  WHERE supplier_id IS NULL AND (active = 1 OR listed = 1) AND sku IN (
    'OSS-2001','OSS-2002','OSS-2003','OSS-2004','OSS-2005','OSS-2006','OSS-2007','OSS-2008','OSS-2009','OSS-2010','OSS-2011','OSS-2012',
    'OSS-3001','OSS-3003','OSS-3004','OSS-3006','OSS-3007','OSS-3008','OSS-3009','OSS-3010','OSS-3011','OSS-3012','OSS-3013',
    'OSS-4001','OSS-4002','OSS-4003','OSS-4004','OSS-4005','OSS-4006','OSS-4007','OSS-4008','OSS-4009',
    'OSS-5001','OSS-5002','OSS-5003','OSS-5005','OSS-5006','OSS-5007','OSS-5008','OSS-5009','OSS-5011','OSS-5012',
    'OSS-6002','OSS-6003','OSS-6004','OSS-6005','OSS-6006','OSS-6008','OSS-6009','OSS-6010',
    'OSS-7001','OSS-7002','OSS-7003','OSS-7004','OSS-7005','OSS-7006','OSS-7007','OSS-7008',
    'OSS-8001','OSS-8002','OSS-8003','OSS-8004','OSS-8005','OSS-8006');
-- OSS-7009 is also the number the back office gives its next new cologne, so it is matched only by the sample's own name
-- (seeded for about an hour on 2026-11-14 as "Glacier Mint", then dropped; a database seeded then may still hold it).
INSERT INTO audit_log (actor, action, target, before, after)
  SELECT 'owner-ruling', 'samples-off-2026-11-24', sku, json_object('active', active, 'listed', listed), '{"active":0,"listed":0}' FROM products
  WHERE sku = 'OSS-7009' AND name = 'Glacier Mint' AND supplier_id IS NULL AND (active = 1 OR listed = 1);
UPDATE products SET active = 0, listed = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
  WHERE sku = 'OSS-7009' AND name = 'Glacier Mint' AND supplier_id IS NULL AND (active = 1 OR listed = 1);
