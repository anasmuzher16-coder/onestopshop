-- Owner ruling 2026-11-26: a tick in the Ace catalogue means the shop has it in stock; nothing is ordered in.
-- Every Ace colour on an unticked page comes off view (listed = 0). Nothing is deleted or switched on; safe to run twice.
-- Rollback: UPDATE products SET listed = 1 WHERE supplier_id = 'ace' AND json_extract(facts_known,'$.stamp') = 'none';
UPDATE products SET listed = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
 WHERE supplier_id = 'ace' AND json_extract(facts_known, '$.stamp') = 'none' AND listed = 1;
INSERT INTO audit_log (actor, action, target, after) VALUES ('owner-ruling', 'catalog.unticked_off', 'ace', '{"date":"2026-11-26","rule":"only ticked catalogue items are on view"}');
