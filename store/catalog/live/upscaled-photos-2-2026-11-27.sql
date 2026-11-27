-- More upscaled photos (2026-11-27, owner: "start upscaling all of the photos that need upscaling"; second pass with the
-- Real-ESRGAN General x4 v3 and 4xLSDIRCompactC3 models). Every output was judged at shopper size (1440 desktop, 390@3x
-- phone, phone zoom) against the live photo, and only the ones a design review confirmed clearly crisper and clean are here.
-- 45 photos were tried (10 Ace, 35 charcoal/foil/shisha); 1 passed both the design review and the breaker: OSS-9301, a foil
--   box with flat printed text. It gets a 1440 photo (-l) beside its unchanged 720/540/360 files, and the shop's
--   details.photo 'upscale' becomes 'approved', as on its photographed foil neighbours (OSS-9302, OSS-9303). The other 44 stay
--   flagged: the models smoothed coal/glaze textures, invented patterns or re-drew small print (OSS-9304 passed the review but
--   the breaker found 'None' -> 'Nono' and 'Size' -> 'Sizo' in its small print, so it is out).
-- Needs store/public/img/pc/** and store/src/img-versions.json deployed with the same commit (img_lw names the -l file).
-- Every UPDATE is guarded on the row still showing the same photo and on there being something to change: safe to run twice.
-- Rollback, per row (updated_at moves on):
--   UPDATE products SET img_lw = NULL, details = json_set(details, '$.photo', 'upscale') WHERE sku = 'OSS-9301';
UPDATE products SET img_lw = 1440, details = CASE WHEN json_valid(details) AND json_extract(details, '$.photo') = 'upscale' THEN json_set(details, '$.photo', 'approved') ELSE details END, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-9301' AND img = 'oss-9301'
   AND (img_lw IS NOT 1440 OR (json_valid(details) AND json_extract(details, '$.photo') = 'upscale'));
