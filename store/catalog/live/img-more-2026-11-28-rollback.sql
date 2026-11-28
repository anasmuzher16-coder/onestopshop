-- Undo img-more-2026-11-28.sql: these SKUs show their main photo only again. Safe to run twice.
UPDATE products SET img_more = NULL WHERE sku IN ('OSS-130040','OSS-130041','OSS-130042','OSS-130043','OSS-130062','OSS-130063');
