-- Pack photos (2026-11-28): the shop's own photos as the MAIN photo. Photo columns only (img, img_lw, img_more, details.photo);
-- names, prices, stock and facts are never touched. Source: inventory-2026-11-24-next/DRIVE-MANIFEST-2026-11-28.csv (EXTRA ANGLE, one SKU
-- each, high confidence); full-size JPEGs in C:\dev\oss-work\drive2\full.
-- 1. Seven packs whose main photo was a stand-in of a similar pack ("Photo to be replaced") and whose shop photo was the gallery's
--    second photo (img-more-2-2026-11-28.sql): the shop photo, already framed as store/public/img/pc/<sku>-2{,-m,-s}.webp, becomes
--    img; the stand-in leaves the gallery (img_more NULL) and its label goes (details.photo 'replace' -> 'approved'). img_lw stays NULL
--    (no -l file: the stand-in had none either). The stand-in files stay on disk, unused, so this file can be undone.
-- 2. Six charcoal boxes with no photo (img '', details.photo 'coming'): the shop's photo, cut off the counter with rembg
--    birefnet-general-lite and framed like the charcoal box photos (720x900, inside 619x810 from x 50, foot on row 828, centred
--    across; -m 540x675, -s 360x450; no -l, img_lw NULL), as store/public/img/pc/<sku>{,-m,-s}.webp.
-- Needs store/public/img/pc/** and store/src/img-versions.json deployed first. Each UPDATE is guarded on the row still showing the
-- photo it replaces (img and details.photo, and img_more as img-more-2 left it or empty): run twice, the second run changes nothing.
-- Rebuilds: the catalogue masters carry no photo for these 13 SKUs (charcoal-foil and shisha master.json: img null), so the
-- catalogue seed gives them img ''. The six charcoal boxes then get their photo from this file. The seven packs only where the
-- row holds the stand-in main photo (live does; the test seed through tools/fixtures/pack-mains-live-2026-11-28.sql): a database
-- built from the masters alone, without that fixture, leaves those seven with no photo, as before this file.
-- Rollback (unguarded: run only to undo this file; updated_at moves on):
--   UPDATE products SET img = 'oss-9662', img_lw = NULL, img_more = '[{"img":"oss-9662-2"}]', details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'replace') WHERE sku = 'OSS-9662' AND img = 'oss-9662-2';
--   UPDATE products SET img = 'oss-9663', img_lw = NULL, img_more = '[{"img":"oss-9663-2"}]', details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'replace') WHERE sku = 'OSS-9663' AND img = 'oss-9663-2';
--   UPDATE products SET img = 'oss-9664', img_lw = NULL, img_more = '[{"img":"oss-9664-2"}]', details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'replace') WHERE sku = 'OSS-9664' AND img = 'oss-9664-2';
--   UPDATE products SET img = 'oss-9309', img_lw = NULL, img_more = '[{"img":"oss-9309-2"}]', details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'replace') WHERE sku = 'OSS-9309' AND img = 'oss-9309-2';
--   UPDATE products SET img = 'oss-9102', img_lw = NULL, img_more = '[{"img":"oss-9102-2"}]', details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'replace') WHERE sku = 'OSS-9102' AND img = 'oss-9102-2';
--   UPDATE products SET img = 'oss-9106', img_lw = NULL, img_more = '[{"img":"oss-9106-2"}]', details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'replace') WHERE sku = 'OSS-9106' AND img = 'oss-9106-2';
--   UPDATE products SET img = 'oss-9508', img_lw = NULL, img_more = '[{"img":"oss-9508-2"}]', details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'replace') WHERE sku = 'OSS-9508' AND img = 'oss-9508-2';
--   UPDATE products SET img = '', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'coming') WHERE sku = 'OSS-9148' AND img = 'oss-9148';
--   UPDATE products SET img = '', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'coming') WHERE sku = 'OSS-9125' AND img = 'oss-9125';
--   UPDATE products SET img = '', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'coming') WHERE sku = 'OSS-9136' AND img = 'oss-9136';
--   UPDATE products SET img = '', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'coming') WHERE sku = 'OSS-9124' AND img = 'oss-9124';
--   UPDATE products SET img = '', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'coming') WHERE sku = 'OSS-9139' AND img = 'oss-9139';
--   UPDATE products SET img = '', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'coming') WHERE sku = 'OSS-9101' AND img = 'oss-9101';
UPDATE products SET img = 'oss-9662-2', img_lw = NULL, img_more = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0507: Karizma herbal molasses tin, Mango
 WHERE sku = 'OSS-9662' AND img = 'oss-9662' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'replace' AND (img_more IS NULL OR img_more = '[{"img":"oss-9662-2"}]');
UPDATE products SET img = 'oss-9663-2', img_lw = NULL, img_more = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0509: Karizma herbal molasses tin, Gum Cinnamon
 WHERE sku = 'OSS-9663' AND img = 'oss-9663' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'replace' AND (img_more IS NULL OR img_more = '[{"img":"oss-9663-2"}]');
UPDATE products SET img = 'oss-9664-2', img_lw = NULL, img_more = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0511: Karizma herbal molasses tin, Grapefruit
 WHERE sku = 'OSS-9664' AND img = 'oss-9664' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'replace' AND (img_more IS NULL OR img_more = '[{"img":"oss-9664-2"}]');
UPDATE products SET img = 'oss-9309-2', img_lw = NULL, img_more = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0518: Alataa foil box
 WHERE sku = 'OSS-9309' AND img = 'oss-9309' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'replace' AND (img_more IS NULL OR img_more = '[{"img":"oss-9309-2"}]');
UPDATE products SET img = 'oss-9102-2', img_lw = NULL, img_more = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0520: Duracubes hexagon sticks box, 62 pcs
 WHERE sku = 'OSS-9102' AND img = 'oss-9102' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'replace' AND (img_more IS NULL OR img_more = '[{"img":"oss-9102-2"}]');
UPDATE products SET img = 'oss-9106-2', img_lw = NULL, img_more = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0521: Coco Max coconut charcoal box, 108
 WHERE sku = 'OSS-9106' AND img = 'oss-9106' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'replace' AND (img_more IS NULL OR img_more = '[{"img":"oss-9106-2"}]');
UPDATE products SET img = 'oss-9508-2', img_lw = NULL, img_more = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0523: Zanobia charcoal single roll, 38 mm
 WHERE sku = 'OSS-9508' AND img = 'oss-9508' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'replace' AND (img_more IS NULL OR img_more = '[{"img":"oss-9508-2"}]');
UPDATE products SET img = 'oss-9148', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0527: Coco Alkanz charcoal cubes box
 WHERE sku = 'OSS-9148' AND img = '' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'coming' AND img_more IS NULL;
UPDATE products SET img = 'oss-9125', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0530: Cleopatra charcoal box
 WHERE sku = 'OSS-9125' AND img = '' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'coming' AND img_more IS NULL;
UPDATE products SET img = 'oss-9136', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0532: Memtaz charcoal box
 WHERE sku = 'OSS-9136' AND img = '' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'coming' AND img_more IS NULL;
UPDATE products SET img = 'oss-9124', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0534: Red Star premium charcoal cubes box
 WHERE sku = 'OSS-9124' AND img = '' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'coming' AND img_more IS NULL;
UPDATE products SET img = 'oss-9139', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0537: Starlight bamboo triangle stick charcoal, 1 kg
 WHERE sku = 'OSS-9139' AND img = '' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'coming' AND img_more IS NULL;
UPDATE products SET img = 'oss-9101', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')   -- IMG_0540: Coco Cafe coconut charcoal cubes box
 WHERE sku = 'OSS-9101' AND img = '' AND json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo') = 'coming' AND img_more IS NULL;
