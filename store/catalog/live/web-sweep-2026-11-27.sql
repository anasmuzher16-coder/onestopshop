-- Web sweep (2026-11-27, owner: "if we can find a better photo of the product online we are going to use that photo even if
-- it's from another shop it doesn't matter, we need the shop functional asap"). Weak charcoal photos replaced by a sharper photo
-- of the exact same pack found online (maker or retailer packshot; brand, count, size and box design checked side by side with
-- the photo it replaces). Each was cut off its plain background and framed like the shop's own cut-outs (720x900, 619 wide /
-- 810 tall, 71 px foot), with a 1440 -l only when the source needs no enlargement past 1.2x. The photo files keep their names;
-- store/src/img-versions.json gives each its new version, so browsers fetch the new file. Photo columns only, per row:
-- img_lw (1440 with a -l file, else NULL), details.photo -> 'approved' (the "upscale" to-do is done), details.photo_src = the
-- page the photo came from (private: the feed allowlist and the storefront both drop it). Sources and file hashes:
-- store/catalog/suppliers/charcoal-foil/web-photos.json. Needs store/public/img/pc/* and store/src/img-versions.json deployed
-- first. Every UPDATE is guarded on the row still showing the same photo (img) and on there being something to change: safe to
-- run twice. The photo files are rolled back with git; rollback for the rows (updated_at moves on):
--   UPDATE products SET img = 'oss-9116-r12', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'upscale'), '$.photo_src') WHERE sku = 'OSS-9116';
--   UPDATE products SET img = 'oss-9127', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'approved'), '$.photo_src') WHERE sku = 'OSS-9127';
--   UPDATE products SET img = 'oss-9128', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'approved'), '$.photo_src') WHERE sku = 'OSS-9128';
--   UPDATE products SET img = 'oss-9129', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'approved'), '$.photo_src') WHERE sku = 'OSS-9129';
--   UPDATE products SET img = 'oss-9154', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'approved'), '$.photo_src') WHERE sku = 'OSS-9154';
--   UPDATE products SET img = 'oss-9158', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'upscale'), '$.photo_src') WHERE sku = 'OSS-9158';
--   UPDATE products SET img = 'oss-9162', img_lw = NULL, details = json_remove(json_set(details, '$.photo', 'upscale'), '$.photo_src') WHERE sku = 'OSS-9162';
UPDATE products SET img = 'oss-9116-r12', img_lw = NULL, details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.photo', 'approved', '$.photo_src', 'https://www.zanobiaonline.com/product/quick-light-charcoal-38mm/'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-9116' AND img = 'oss-9116-r12'
   AND (img IS NOT 'oss-9116-r12' OR img_lw IS NOT NULL OR NOT json_valid(details) OR json_extract(details, '$.photo') IS NOT 'approved' OR json_extract(details, '$.photo_src') IS NOT 'https://www.zanobiaonline.com/product/quick-light-charcoal-38mm/');
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
