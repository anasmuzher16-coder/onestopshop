-- Web photos (2026-11-27, owner: "if there's any high quality photos online let's just go ahead and use them, it's fair game",
-- then option 2: the brand's own high-res product photos). 13 Ace photos were replaced by sharper photos of the same product and
-- colour (Tsar's own site; Ace Hookah's own product shots hosted by shishazone.ca), each passed by a design review. Every row
-- that shows one gets facts_known.photo_src (the page the photo came from, so it can be swapped later). Photos now framed
-- without enlarging past 1.25x lose their "Photo to be upscaled" label (photo_label, or photo_upscale on a colour shown with
-- the family photo); the five Techno photos are sharper but still enlarged 1.37x, so they keep it. Same rows as
-- `catalog.py seed` after the build. Needs store/public/img/pc/ace/* and store/src/img-versions.json deployed first.
-- Only the keys named above change; the rest of facts_known stays as the row has it. Safe to run twice (each guard makes a
-- second run change nothing). The photo files themselves are rolled back with git; rollback for the rows:
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_label', 'upscale'), '$.photo_src') WHERE sku = 'OSS-100079' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_upscale', json('true')), '$.photo_src') WHERE sku = 'OSS-100080' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_label', 'upscale'), '$.photo_src') WHERE sku = 'OSS-100081' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_label', 'upscale'), '$.photo_src') WHERE sku = 'OSS-100082' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_upscale', json('true')), '$.photo_src') WHERE sku = 'OSS-100083' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_upscale', json('true')), '$.photo_src') WHERE sku = 'OSS-100084' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100088' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100089' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100090' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100091' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100092' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100107' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100108' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100109' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100110' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100111' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(facts_known, '$.photo_src') WHERE sku = 'OSS-100112' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_label', 'upscale'), '$.photo_src') WHERE sku = 'OSS-100231' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_label', 'upscale'), '$.photo_src') WHERE sku = 'OSS-100232' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_label', 'upscale'), '$.photo_src') WHERE sku = 'OSS-100233' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_upscale', json('true')), '$.photo_src') WHERE sku = 'OSS-100234' AND supplier_id = 'ace';
--   UPDATE products SET facts_known = json_remove(json_set(facts_known, '$.photo_upscale', json('true')), '$.photo_src') WHERE sku = 'OSS-100235' AND supplier_id = 'ace';
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_label'), '$.photo_src', 'https://tsar-hookah.com/tsar-molotov-x-plus/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100079' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_label') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-molotov-x-plus/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_upscale'), '$.photo_src', 'https://tsar-hookah.com/tsar-molotov-x-plus/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100080' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_upscale') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-molotov-x-plus/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_label'), '$.photo_src', 'https://tsar-hookah.com/tsar-molotov-x-plus/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100081' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_label') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-molotov-x-plus/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_label'), '$.photo_src', 'https://tsar-hookah.com/tsar-molotov-x-plus/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100082' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_label') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-molotov-x-plus/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_upscale'), '$.photo_src', 'https://tsar-hookah.com/tsar-molotov-x-plus/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100083' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_upscale') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-molotov-x-plus/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_upscale'), '$.photo_src', 'https://tsar-hookah.com/tsar-molotov-x-plus/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100084' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_upscale') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-molotov-x-plus/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://tsar-hookah.com/tsar-h-one/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100088' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-h-one/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://tsar-hookah.com/tsar-h-one/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100089' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-h-one/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://tsar-hookah.com/tsar-h-one/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100090' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-h-one/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://tsar-hookah.com/tsar-h-one/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100091' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-h-one/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://tsar-hookah.com/tsar-h-one/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100092' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://tsar-hookah.com/tsar-h-one/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://shishazone.ca/product/techno-hookah/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100107' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/techno-hookah/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://shishazone.ca/product/techno-hookah/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100108' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/techno-hookah/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://shishazone.ca/product/techno-hookah/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100109' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/techno-hookah/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://shishazone.ca/product/techno-hookah/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100110' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/techno-hookah/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://shishazone.ca/product/techno-hookah/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100111' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/techno-hookah/');
UPDATE products SET facts_known = json_set(facts_known, '$.photo_src', 'https://shishazone.ca/product/techno-hookah/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100112' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/techno-hookah/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_label'), '$.photo_src', 'https://shishazone.ca/product/wood-226/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100231' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_label') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/wood-226/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_label'), '$.photo_src', 'https://shishazone.ca/product/wood-226/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100232' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_label') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/wood-226/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_label'), '$.photo_src', 'https://shishazone.ca/product/wood-226/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100233' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_label') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/wood-226/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_upscale'), '$.photo_src', 'https://shishazone.ca/product/wood-226/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100234' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_upscale') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/wood-226/');
UPDATE products SET facts_known = json_set(json_remove(facts_known, '$.photo_upscale'), '$.photo_src', 'https://shishazone.ca/product/wood-226/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-100235' AND supplier_id = 'ace' AND json_valid(facts_known) AND (json_extract(facts_known, '$.photo_upscale') IS NOT NULL OR json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/wood-226/');
