-- Test seed only (store/tools/seed-files.mjs): the main photos the live database has for seven packs, read from the live backup
-- inventory-2026-11-24-next/backups/full-before-crew1-2-2026-11-28.sql (their img came from the stand-in photo round,
-- photos-found/standin/FOUND.sql and later rounds, which never joined the seed). Without them the seed's rows have no main photo,
-- so catalog/live/img-more-2-2026-11-28.sql (guarded on these img values) could never be tested. Only fills an empty img, and marks the
-- photo a stand-in (details.photo 'replace', "Photo to be replaced") as the live rows are.
UPDATE products SET img = 'oss-9662', details = json_set(COALESCE(details, '{}'), '$.photo', 'replace') WHERE sku = 'OSS-9662' AND img = '';
UPDATE products SET img = 'oss-9663', details = json_set(COALESCE(details, '{}'), '$.photo', 'replace') WHERE sku = 'OSS-9663' AND img = '';
UPDATE products SET img = 'oss-9664', details = json_set(COALESCE(details, '{}'), '$.photo', 'replace') WHERE sku = 'OSS-9664' AND img = '';
UPDATE products SET img = 'oss-9309', details = json_set(COALESCE(details, '{}'), '$.photo', 'replace') WHERE sku = 'OSS-9309' AND img = '';
UPDATE products SET img = 'oss-9102', details = json_set(COALESCE(details, '{}'), '$.photo', 'replace') WHERE sku = 'OSS-9102' AND img = '';
UPDATE products SET img = 'oss-9106', details = json_set(COALESCE(details, '{}'), '$.photo', 'replace') WHERE sku = 'OSS-9106' AND img = '';
UPDATE products SET img = 'oss-9508', details = json_set(COALESCE(details, '{}'), '$.photo', 'replace') WHERE sku = 'OSS-9508' AND img = '';
