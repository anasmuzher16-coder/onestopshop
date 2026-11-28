-- More photos of one item, batch 2 (2026-11-28): the shop's own photos of seven packs (DRIVE-MANIFEST-2026-11-28.csv, EXTRA ANGLE,
-- one SKU each, high confidence) as the second photo of their SKU (products.img_more). Not applied live yet.
-- Needs migration 0013 (applied live 2026-11-28) and the photos and img-versions.json deployed with it.
-- Each main photo here is a stand-in of a similar pack ("Photo to be replaced"); the shop's photo shows the pack itself. It was cut
-- off the counter with rembg (birefnet-general-lite) and framed like the pack photos on the site (720x900, inside 618x810, foot on
-- row 828; -m, -s; no -l, as the mains): store/public/img/pc/<main>-2{,-m,-s}.webp.
-- Only img_more moves, and only where the row still shows the main photo it was framed beside (img guard). Setting the same
-- value again changes nothing: safe to run twice. Undo: img-more-2-2026-11-28-rollback.sql.
UPDATE products SET img_more = '[{"img":"oss-9662-2"}]' WHERE sku = 'OSS-9662' AND img = 'oss-9662';   -- IMG_0507: Karizma herbal molasses tin, Mango
UPDATE products SET img_more = '[{"img":"oss-9663-2"}]' WHERE sku = 'OSS-9663' AND img = 'oss-9663';   -- IMG_0509: Karizma herbal molasses tin, Gum Cinnamon
UPDATE products SET img_more = '[{"img":"oss-9664-2"}]' WHERE sku = 'OSS-9664' AND img = 'oss-9664';   -- IMG_0511: Karizma herbal molasses tin, Grapefruit
UPDATE products SET img_more = '[{"img":"oss-9309-2"}]' WHERE sku = 'OSS-9309' AND img = 'oss-9309';   -- IMG_0518: Alataa foil box
UPDATE products SET img_more = '[{"img":"oss-9102-2"}]' WHERE sku = 'OSS-9102' AND img = 'oss-9102';   -- IMG_0520: Duracubes hexagon sticks box, 62 pcs
UPDATE products SET img_more = '[{"img":"oss-9106-2"}]' WHERE sku = 'OSS-9106' AND img = 'oss-9106';   -- IMG_0521: Coco Max coconut charcoal box, 108
UPDATE products SET img_more = '[{"img":"oss-9508-2"}]' WHERE sku = 'OSS-9508' AND img = 'oss-9508';   -- IMG_0523: Zanobia charcoal single roll
