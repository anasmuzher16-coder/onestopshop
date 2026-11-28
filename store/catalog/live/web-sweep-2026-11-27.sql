-- Web sweep (2026-11-27, owner: "if we can find a better photo of the product online we are going to use that photo even if
-- it's from another shop it doesn't matter, we need the shop functional asap"). Weak photos replaced by a sharper photo of the
-- exact same product found online (maker or retailer packshot; brand, count, size, colour and pack design checked side by side
-- with the photo it replaces): 6 charcoal packs (Titanium Cubettes, Flats, Cubes; Coco Army 90; Coco Fuego Boss and Bermuda)
-- and the Ace Ice Hose (Ace's own shot, hosted by shishazone.ca). Each was cut off its plain background or its own
-- transparency and framed like the photo it replaces, with a 1440 -l only when the source needs no enlargement past 1.2x.
-- The photo files keep their names; store/src/img-versions.json gives each its new version, so browsers fetch the new file.
-- Photo columns only, per row:
--   charcoal (OSS-9NNN): img_lw (1440 with a -l file, else NULL), details.photo -> 'approved', details.photo_src = the page
--     the photo came from (private: the feed allowlist and the storefront both drop it);
--   accessory (OSS-110011): img_lw = 1440, facts_known.photo_label ('upscale') removed, facts_known.photo_src = the page
--     (as the catalogue seed now builds it: suppliers/ace-acc/web-photos.json, kept by photos_acc.py on a rebuild).
-- Sources and file hashes: store/catalog/suppliers/charcoal-foil/web-photos.json and ace-acc/web-photos.json. Needs
-- store/public/img/pc/** and store/src/img-versions.json deployed first. Every UPDATE is guarded on the row still showing the
-- same photo (img) and on there being something to change: safe to run twice. Proven on a copy of the 2026-11-27 18:28 backup
-- (full-before-crowned-glass); a row changed on live since then is skipped, not overwritten. The photo files are rolled back
-- with git; rollback for the rows (unguarded: run only to undo this file; updated_at moves on):
--   UPDATE products SET img_lw = NULL, facts_known = json_remove(json_set(facts_known, '$.photo_label', 'upscale'), '$.photo_src') WHERE sku = 'OSS-110011';
--   UPDATE products SET img = 'oss-9127', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'approved'), '$.photo_src') WHERE sku = 'OSS-9127';
--   UPDATE products SET img = 'oss-9128', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'approved'), '$.photo_src') WHERE sku = 'OSS-9128';
--   UPDATE products SET img = 'oss-9129', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'approved'), '$.photo_src') WHERE sku = 'OSS-9129';
--   UPDATE products SET img = 'oss-9154', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'approved'), '$.photo_src') WHERE sku = 'OSS-9154';
--   UPDATE products SET img = 'oss-9158', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'upscale'), '$.photo_src') WHERE sku = 'OSS-9158';
--   UPDATE products SET img = 'oss-9162', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'upscale'), '$.photo_src') WHERE sku = 'OSS-9162';
UPDATE products SET img_lw = 1440, facts_known = json_set(json_remove(facts_known, '$.photo_label'), '$.photo_src', 'https://shishazone.ca/product/hookah-ice-hose-handle-freezable/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-110011' AND img = 'acc/acc-p24' AND json_valid(facts_known)
   AND (img_lw IS NOT 1440 OR json_extract(facts_known, '$.photo_src') IS NOT 'https://shishazone.ca/product/hookah-ice-hose-handle-freezable/' OR json_extract(facts_known, '$.photo_label') IS NOT NULL);
UPDATE products SET img = 'oss-9127', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved', '$.photo_src', 'https://hookahjohn.com/products/cubettes-by-titanium-coconut-charcoal'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-9127' AND img = 'oss-9127'
   AND (img IS NOT 'oss-9127' OR img_lw IS NOT NULL OR NOT json_valid(details) OR json_extract(details, '$.photo') IS NOT 'approved' OR json_extract(details, '$.photo_src') IS NOT 'https://hookahjohn.com/products/cubettes-by-titanium-coconut-charcoal');
UPDATE products SET img = 'oss-9128', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved', '$.photo_src', 'https://hookahjohn.com/products/titanium-coconut-coal-108ct-1kg-box-flats'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-9128' AND img = 'oss-9128'
   AND (img IS NOT 'oss-9128' OR img_lw IS NOT NULL OR NOT json_valid(details) OR json_extract(details, '$.photo') IS NOT 'approved' OR json_extract(details, '$.photo_src') IS NOT 'https://hookahjohn.com/products/titanium-coconut-coal-108ct-1kg-box-flats');
UPDATE products SET img = 'oss-9129', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved', '$.photo_src', 'https://hookahjohn.com/products/titanium-coconut-coal-the-cube-72ct-1kg-box'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-9129' AND img = 'oss-9129'
   AND (img IS NOT 'oss-9129' OR img_lw IS NOT NULL OR NOT json_valid(details) OR json_extract(details, '$.photo') IS NOT 'approved' OR json_extract(details, '$.photo_src') IS NOT 'https://hookahjohn.com/products/titanium-coconut-coal-the-cube-72ct-1kg-box');
UPDATE products SET img = 'oss-9154', img_lw = 1440, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved', '$.photo_src', 'https://www.zanobiaonline.com/product/coco-army-charcoal-90/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-9154' AND img = 'oss-9154'
   AND (img IS NOT 'oss-9154' OR img_lw IS NOT 1440 OR NOT json_valid(details) OR json_extract(details, '$.photo') IS NOT 'approved' OR json_extract(details, '$.photo_src') IS NOT 'https://www.zanobiaonline.com/product/coco-army-charcoal-90/');
UPDATE products SET img = 'oss-9158', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved', '$.photo_src', 'https://thehookahshop.com/shop/charcoal/charcoal-by-brand/coco-fuego-charcoal/coco-fuego-big-boss-cubes-2/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-9158' AND img = 'oss-9158'
   AND (img IS NOT 'oss-9158' OR img_lw IS NOT NULL OR NOT json_valid(details) OR json_extract(details, '$.photo') IS NOT 'approved' OR json_extract(details, '$.photo_src') IS NOT 'https://thehookahshop.com/shop/charcoal/charcoal-by-brand/coco-fuego-charcoal/coco-fuego-big-boss-cubes-2/');
UPDATE products SET img = 'oss-9162', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved', '$.photo_src', 'https://thehookahshop.com/shop/charcoal/charcoal-by-brand/coco-fuego-charcoal/coco-fuego-bermuda-triangle-2/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-9162' AND img = 'oss-9162'
   AND (img IS NOT 'oss-9162' OR img_lw IS NOT NULL OR NOT json_valid(details) OR json_extract(details, '$.photo') IS NOT 'approved' OR json_extract(details, '$.photo_src') IS NOT 'https://thehookahshop.com/shop/charcoal/charcoal-by-brand/coco-fuego-charcoal/coco-fuego-bermuda-triangle-2/');
