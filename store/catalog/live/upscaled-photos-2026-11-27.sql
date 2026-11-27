-- Upscaled supplier photo (2026-11-27, owner: "start upscaling all of the photos that need upscaling"). 20 flagged on-view
-- photos were upscaled 4x (Real-ESRGAN x4plus, or Lanczos + mild sharpen where it reshaped label text) and judged at display
-- size by a design review: only OSS-110026 (Hose Rubber, acc-p76) came out crisper and clean, so only its "Photo to be
-- upscaled" label comes off and its 1440 photo (-l) is switched on. The other 19 stay flagged (garbled ring/logo text,
-- smoothed grain or glitter, or no visible gain). Same row as `catalog.py seed --supplier ace-acc` after the build.
-- Needs store/public/img/pc/acc/acc-p76*.webp and store/src/img-versions.json deployed first (img_lw names the -l file).
-- Only removes the label key and sets img_lw: the rest of facts_known stays as the row has it. Safe to run twice (the guard
-- makes a second run change nothing). Rollback (puts the label back and turns the 1440 photo off; updated_at moves on):
--   UPDATE products SET facts_known = json_set(facts_known, '$.photo_label', 'upscale'), img_lw = NULL WHERE sku = 'OSS-110026' AND supplier_id = 'ace-acc';
UPDATE products SET facts_known = json_remove(facts_known, '$.photo_label'), img_lw = 1440, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE sku = 'OSS-110026' AND supplier_id = 'ace-acc' AND json_valid(facts_known)
   AND (json_extract(facts_known, '$.photo_label') IS NOT NULL OR img_lw IS NOT 1440);
