-- Puts back what ace-acc-off-2026-11-26.sql took off: each accessory gets the exact active and listed values it had just
-- before the undo (its latest 'ace-acc-off-2026-11-26' audit entry), so an item the shop had priced and switched on comes
-- back on, and one that was only on view comes back on view. Safe to run twice. Rows never switched off are not touched.
INSERT INTO audit_log (actor, action, target, before, after)
  SELECT 'owner-ruling', 'ace-acc-back-on-2026-11-26', p.sku, json_object('active', p.active, 'listed', p.listed), a.before
  FROM products p JOIN audit_log a ON a.id = (SELECT MAX(id) FROM audit_log WHERE action = 'ace-acc-off-2026-11-26' AND target = p.sku)
  WHERE p.supplier_id = 'ace-acc' AND (p.active IS NOT json_extract(a.before, '$.active') OR p.listed IS NOT json_extract(a.before, '$.listed'));
UPDATE products SET
    active = (SELECT json_extract(before, '$.active') FROM audit_log WHERE id = (SELECT MAX(id) FROM audit_log WHERE action = 'ace-acc-off-2026-11-26' AND target = products.sku)),
    listed = (SELECT json_extract(before, '$.listed') FROM audit_log WHERE id = (SELECT MAX(id) FROM audit_log WHERE action = 'ace-acc-off-2026-11-26' AND target = products.sku)),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
  WHERE supplier_id = 'ace-acc' AND sku IN (SELECT target FROM audit_log WHERE action = 'ace-acc-off-2026-11-26');
