-- More photos of one item (2026-11-28): the extra angles of a SKU, after its main photo (img). A JSON list of
-- {"img": "<path under img/pc, no extension>", "lw": 1440 or null}, each processed exactly like the main photo
-- (-s 360, -m 540, base 720, and -l at lw wide when the source carries it). NULL or [] means the main photo only.
-- Read by src/catalog.js morePhotos(); the product page shows a gallery only with two or more photos.
ALTER TABLE products ADD COLUMN img_more TEXT;
