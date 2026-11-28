"""Write store/catalog/live/hose-drawnbag-2026-11-27.sql for the hoses whose drawn-bag photo is in the branch.
usage: gen_sql.py OUT.sql OSS-120001 OSS-120009 ..."""
import sys
out, skus = sys.argv[1], sys.argv[2:]
inl = ", ".join(f"'{s}'" for s in skus)
D = "CASE WHEN json_valid(details) THEN details ELSE '{}' END"
F = "CASE WHEN json_valid(facts_known) THEN facts_known ELSE '{}' END"
head = f"""-- The shop's hoses on the drawn clear bag (owner, 2026-11-27, on the samples: "That's so much better"). Each hose and its
-- printed card or bag print is cut out of the shop's photo and laid in one drawn clear bag (same size, shine, seals, shadow
-- and light on every hose); no shop wall shows. The photo files are store/public/img/pc/hose/<name>{{,-m,-s}}.webp, replaced
-- in the same commit (versions in store/src/img-versions.json); tools in store/tools/catalog/hose_drawnbag/. Not applied live yet.
-- This file only moves each hose's photo state: details.photo becomes 'approved', and the "Photo to be replaced" tag is taken
-- off (facts_known.photo_label 'replace', set by shop-hookahs-2026-11-27.sql and kept by missing-items-2026-11-27.sql, and a details.photo
-- 'replace' if one was set by hand). No other key and no other column moves (updated_at is stamped on a changed row).
-- {len(skus)} hoses: {", ".join(skus)}.
-- Run after shop-hookahs-2026-11-27.sql and missing-items-2026-11-27.sql (both re-seed the hose rows with the tag, since store/catalog/suppliers/shop-hoses/master.json still marks every hose photo
-- 'replace'); if either,
-- or any later re-seed of shop-hoses, is run again afterwards, run this file again after it. Safe to run twice: a row already approved and untagged is not touched. A row whose
-- details is something other than a JSON object (none live) is left alone rather than overwritten.
-- Rollback (live before this change, 2026-11-27: details '{{}}' with no photo key on every hose):
--   UPDATE products SET details = json_remove(details, '$.photo'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
--     WHERE sku IN ({inl}) AND supplier_id = 'shop-hoses' AND json_valid(details) AND json_extract(details, '$.photo') = 'approved';
--   and, only if shop-hookahs-2026-11-27.sql had been applied before this file, put its tag back:
--   UPDATE products SET facts_known = json_set(facts_known, '$.photo_label', 'replace'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
--     WHERE sku IN ({inl}) AND supplier_id = 'shop-hoses' AND json_valid(facts_known);
"""
body = (f"UPDATE products SET details = json_set({D}, '$.photo', 'approved'), "
        f"facts_known = CASE WHEN json_valid(facts_known) AND json_extract(facts_known, '$.photo_label') = 'replace' THEN json_remove(facts_known, '$.photo_label') ELSE facts_known END, "
        f"updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') "
        f"WHERE sku IN ({inl}) AND supplier_id = 'shop-hoses' "
        f"AND (details IS NULL OR details = '' OR (json_valid(details) AND json_type(details) = 'object')) "
        f"AND (json_extract({D}, '$.photo') IS NOT 'approved' OR json_extract({F}, '$.photo_label') IS 'replace');\n")
open(out, "w", newline="\n").write(head + body)
print(out, len(skus))
