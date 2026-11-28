-- More photos of one item (2026-11-28): the extra angles in the shop's Drive (inventory-2026-11-24-next/DRIVE-MANIFEST-2026-11-28.csv,
-- rows classed EXTRA ANGLE with one matched SKU) go on that SKU as products.img_more. Not applied live yet.
-- Needs migration 0013_img_more.sql applied first (wrangler d1 migrations apply onestopshop --remote), and the photos,
-- img-versions.json and the gallery code (app.js, styles.css, src/catalog.js) deployed with it.
-- This batch: the shop's own side views of six bowls whose main photo is the top-down view (IMG_0619/0621/0623/0625/0660/0662).
-- Each was cut off the white sweep with rembg (birefnet-general-lite) and framed by frame_cutouts.py --kind bowl, exactly like
-- its main photo: store/public/img/pc/bowl/<main>-2{,-l,-m,-s}.webp, 1440 -l (the bowl is over 1100 px tall in the source).
-- Only img_more moves, and only where the row still shows the main photo these were framed against (img guard): name, price,
-- stock, facts and img stay as they are live. Setting the same value again changes nothing: safe to run twice.
-- Undo: img-more-2026-11-28-rollback.sql (img_more back to NULL on these SKUs; the photo files can stay).
UPDATE products SET img_more = '[{"img":"bowl/horned-head-bowl-with-glass-top-silver-2","lw":1440}]' WHERE sku = 'OSS-130040' AND img = 'bowl/horned-head-bowl-with-glass-top-silver';   -- IMG_0620
UPDATE products SET img_more = '[{"img":"bowl/horned-head-bowl-with-glass-top-purple-2","lw":1440}]' WHERE sku = 'OSS-130041' AND img = 'bowl/horned-head-bowl-with-glass-top-purple';   -- IMG_0622
UPDATE products SET img_more = '[{"img":"bowl/horned-head-bowl-with-glass-top-bronze-2","lw":1440}]' WHERE sku = 'OSS-130042' AND img = 'bowl/horned-head-bowl-with-glass-top-bronze';   -- IMG_0624
UPDATE products SET img_more = '[{"img":"bowl/horned-head-bowl-with-glass-top-blue-2","lw":1440}]' WHERE sku = 'OSS-130043' AND img = 'bowl/horned-head-bowl-with-glass-top-blue';   -- IMG_0626
UPDATE products SET img_more = '[{"img":"bowl/carved-face-bowl-brown-2","lw":1440}]' WHERE sku = 'OSS-130062' AND img = 'bowl/carved-face-bowl-brown';   -- IMG_0661
UPDATE products SET img_more = '[{"img":"bowl/pirate-head-bowl-blue-2","lw":1440}]' WHERE sku = 'OSS-130063' AND img = 'bowl/pirate-head-bowl-blue';   -- IMG_0663
