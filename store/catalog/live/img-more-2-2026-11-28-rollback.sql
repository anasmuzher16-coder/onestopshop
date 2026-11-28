-- Undo img-more-2-2026-11-28.sql: these SKUs show their main photo only again. Only where img_more is still the value it set; safe to run twice.
UPDATE products SET img_more = NULL WHERE sku = 'OSS-9662' AND img_more = '[{"img":"oss-9662-2"}]';
UPDATE products SET img_more = NULL WHERE sku = 'OSS-9663' AND img_more = '[{"img":"oss-9663-2"}]';
UPDATE products SET img_more = NULL WHERE sku = 'OSS-9664' AND img_more = '[{"img":"oss-9664-2"}]';
UPDATE products SET img_more = NULL WHERE sku = 'OSS-9309' AND img_more = '[{"img":"oss-9309-2"}]';
UPDATE products SET img_more = NULL WHERE sku = 'OSS-9102' AND img_more = '[{"img":"oss-9102-2"}]';
UPDATE products SET img_more = NULL WHERE sku = 'OSS-9106' AND img_more = '[{"img":"oss-9106-2"}]';
UPDATE products SET img_more = NULL WHERE sku = 'OSS-9508' AND img_more = '[{"img":"oss-9508-2"}]';
