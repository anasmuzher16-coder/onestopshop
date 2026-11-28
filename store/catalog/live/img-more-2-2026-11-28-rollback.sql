-- Undo img-more-2-2026-11-28.sql: these SKUs show their main photo only again. Safe to run twice.
UPDATE products SET img_more = NULL WHERE sku IN ('OSS-9662','OSS-9663','OSS-9664','OSS-9309','OSS-9102','OSS-9106','OSS-9508');
