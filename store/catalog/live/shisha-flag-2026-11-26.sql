-- Council 2026-11-26 (adversary): shisha's pay-at-the-counter, pickup-only rule knew a shisha only by its section id
-- ("shisha"), so moving or renaming the section would have made it shippable and card-paid. Every row from the shisha list
-- now carries the rule on itself (details.tobacco, the same flag checkout.js, catalog.js and app.js already read; it drives
-- the pay rule only and never shows to a shopper). Safe to run twice. Rollback: json_remove(details, '$.tobacco') on the same rows.
UPDATE products SET details = json_set(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.tobacco', json('true')),
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE supplier_id = 'shisha' AND COALESCE(json_extract(CASE WHEN json_valid(details) THEN details ELSE '{}' END, '$.tobacco'), 0) != 1;
