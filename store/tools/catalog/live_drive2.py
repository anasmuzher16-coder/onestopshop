"""Write store/catalog/live/drive2-2026-11-28.sql: the items from the shop's Google Drive folder of 2026-11-28 that were not
on the site (reports/DRIVE-MANIFEST-2026-11-28.csv, class NEW), as new rows only.

  python store/tools/catalog/live_drive2.py

Each part is the lines `catalog.py seed` writes for those SKUs and nothing else: the INSERT OR IGNORE, the supplier-column
UPDATE that only fires where a value differs, and the 'dropped' guard of that one row. The seed's whole-supplier lines (the
'dropped' sweep and the catalog_imports row) are left out, so no existing row is touched. test_catalog.py checks the file
still matches the masters. Re-run after `catalog.py build --only shop`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catlib as C  # noqa: E402
import catalog as K  # noqa: E402

OUT = C.CATALOG / "live" / "drive2-2026-11-28.sql"
# the new SKUs, by supplier (issued by `catalog.py build --only shop` on 2026-11-28)
NEW = {"shop-hookahs": [f"OSS-14{n:04d}" for n in range(28, 103)],   # 75 hookah colours, 57 cards
       "shop-hoses": ["OSS-120033"]}                                   # the green Simba

HEADER = """-- The shop's Google Drive folder, 2026-11-28 (owner: "in the Google Drive there's more inventory in the folders ... get to
-- work getting them ready and on the site"). Every NEW item in reports/DRIVE-MANIFEST-2026-11-28.csv, as new rows only:
-- 1. Hookahs (store/catalog/suppliers/shop-hookahs/master.json, src_shop_hookahs.BATCH_2): 75 colours in 57 cards,
--    OSS-140028 to OSS-140102. Section Hookahs, Price TBD, in the shop, stock not counted, weight unknown; the shop's original
--    photo (shot standing, cropped to the 4:5 tile) with "Photo to be replaced"; the brand only where printed on the piece,
--    otherwise a plain description; every one is on the back office's Needs info list to rename and check.
-- 2. Hoses (store/catalog/suppliers/shop-hoses/master.json): the green Simba Disposable Hose, OSS-120033, one more colour
--    of the Simba card; only in a counter photo, so no photo of its own yet ("Photo coming soon").
-- Exactly the lines `catalog.py seed` writes for these SKUs (store/tools/catalog/live_drive2.py; test_catalog.py checks they
-- still match). Not applied live yet. Safe to run twice: each row is inserted once and its UPDATE only fires where a value
-- differs. No existing row is touched (the seed's whole-supplier 'dropped' sweep and import row are left out).
-- Needs store/public/img/pc/hookah/ and store/src/img-versions.json deployed with the same commit.
-- Order: run after shop-hookahs-2026-11-27.sql, hoses-2026-11-27.sql and missing-items-2026-11-27.sql. Never re-run those three
-- after this file: each ends with a whole-supplier sweep (availability 'dropped' for every SKU not on its own list) that hides
-- these 76 rows again. If that happens, run this file again: its last line per row puts 'dropped' back to 'in_store_uncounted'.
-- The green Simba takes sort 4509, which the live OSS-120010 also has (a rebuild shifts the later hoses' sort by one, and a
-- seed never changes sort on an existing row): the Simba card still leads with its purple (4507); only that tie is new.
-- Rollback. First check nothing has been sold:
--   SELECT COUNT(*) FROM order_items WHERE sku BETWEEN 'OSS-140028' AND 'OSS-140102' OR sku = 'OSS-120033';
-- if that is not 0, do not delete: UPDATE products SET listed = 0, active = 0 WHERE <same condition>. Otherwise (this also
-- drops any shelf count, photo upload, favourite or back-in-stock alert made on them since), for X in that condition:
--   DELETE FROM product_photos WHERE X; DELETE FROM favourites WHERE X; DELETE FROM stock_alerts WHERE X;
--   DELETE FROM stock_moves WHERE X; DELETE FROM products WHERE (sku BETWEEN 'OSS-140028' AND 'OSS-140102'
--   AND supplier_id = 'shop-hookahs') OR (sku = 'OSS-120033' AND supplier_id = 'shop-hoses');
"""


def part(supplier: str, skus: list[str]) -> str:
    m = C.load_master(supplier)
    have = {v["sku"] for _, v in C.iter_variants(m)}
    missing = set(skus) - have
    if missing:
        raise SystemExit(f"{supplier}: not in the master: {sorted(missing)}")
    want = set(skus)
    out = []
    for line in K.seed_sql(supplier, m).splitlines():
        if line.startswith("-- ") or line.startswith("INSERT OR IGNORE INTO suppliers"):
            out.append(line)
            continue
        hit = re.search(r"VALUES \('(OSS-\d+)'|WHERE sku = '(OSS-\d+)'|SELECT '(OSS-\d+)'", line)
        if hit and next(g for g in hit.groups() if g) in want:
            out.append(line)
    return "\n".join(out) + "\n"


def sql() -> str:
    return HEADER + "".join(part(s, k) for s, k in NEW.items())


if __name__ == "__main__":
    OUT.write_text(sql(), encoding="utf-8", newline="\n")
    print("wrote", OUT)
