"""Write the live file that takes "Photo to be replaced" off the shop's hookahs whose photo has been cleaned.

  python store/tools/catalog/live_clean_hookahs.py      writes store/catalog/live/hookah-clean-2026-11-27.sql (the first
                                                         cleaned photos, src_shop_hookahs.CLEANED_FIRST),
                                                         hookah-clean-a-2026-11-28.sql (group A, CLEANED_A) and
                                                         hookah-clean-b-2026-11-28.sql (group B, CLEANED_B, and the Panda)

A cleaned photo (src_shop_hookahs.CLEANED, clear_glass2.py) goes in under the same file name as the original it replaces,
so img does not change: only the photo keys of facts_known move. photo stays 'own'; photo_label ('replace') and
photo_full (the original filled the tile; the cut-out is framed like the Ace hookahs) go. Each line is set with
json_set/json_remove, so every other fact stays as it is live, and runs only where a value still differs: safe twice.
The values come from store/catalog/suppliers/shop-hookahs/master.json (catalog.py desired_rows); test_catalog.py checks
the file still matches. Re-run this after adding photos to CLEANED and after `catalog.py build --only shop`.
Each file lists its own photos (FILES): the 2026-11-27 file stays as it was applied for review; group B's cleaned photos go
in hookah-clean-b-2026-11-28.sql, which also puts the cleaned Panda (IMG_0689) on the Ace row OSS-100077 that had no photo.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catlib as C  # noqa: E402
import catalog as K  # noqa: E402
import src_shop_hookahs as S  # noqa: E402

OUT = C.CATALOG / "live" / "hookah-clean-2026-11-27.sql"
OUT_A = C.CATALOG / "live" / "hookah-clean-a-2026-11-28.sql"
OUT_B = C.CATALOG / "live" / "hookah-clean-b-2026-11-28.sql"
FILES = [(OUT, S.CLEANED_FIRST, "2026-11-27"), (OUT_A, S.CLEANED_A, "2026-11-28")]   # in the order they run (then OUT_B)
BATCH_12 = S.CLEANED_FIRST
GROUP_B = S.CLEANED_B          # group B's cleaned photos (hookah-clean-b); the Panda: PANDA below
PANDA = "OSS-100077"   # Ace "Panda Hookah", live with no photo: the cleaned IMG_0689 (shop_photos.py) goes on it
PANDA_READY = True     # True once the Panda's photo has passed review and is wired (then the B file carries its line)
FK = "CASE WHEN json_valid(facts_known) THEN facts_known ELSE '{}' END"
NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')"


def cleaned_rows(m, photos=BATCH_12):
    clean = {v["sku"] for _, v in C.iter_variants(m) if v["photo"]["status"] == "shop"
             and any(f"photo:{p} " in v["photo"]["src"] for p in photos)}
    return [r for r in K.desired_rows("shop-hookahs", m) if r["sku"] in clean]


def line(r):
    f = json.loads(r["sup"]["facts_known"])
    assert f["photo"] == "own" and "photo_label" not in f and "photo_full" not in f, r["sku"]
    sku = K.q(r["sku"])
    return (f"UPDATE products SET facts_known = json_remove(json_set({FK}, '$.photo', 'own'), '$.photo_label', '$.photo_full'), "
            f"updated_at = {NOW} WHERE sku = {sku} AND supplier_id = 'shop-hookahs' AND img = {K.q(r['sup']['img'])} AND "
            f"(json_extract(facts_known, '$.photo') IS NOT 'own' OR json_type(facts_known, '$.photo_label') IS NOT NULL "
            f"OR json_type(facts_known, '$.photo_full') IS NOT NULL);")


def rollback(r):
    sku = K.q(r["sku"])
    return (f"--   UPDATE products SET facts_known = json_set({FK}, '$.photo_label', 'replace', '$.photo_full', json('true')), "
            f"updated_at = {NOW} WHERE sku = {sku} AND supplier_id = 'shop-hookahs';")


def sql(m, photos=None, day="2026-11-27"):
    rows = cleaned_rows(m, S.CLEANED_FIRST if photos is None else photos)
    names = ", ".join(f"{r['sku']} ({r['shop']['name']}, {r['sup']['variant_label']})" for r in rows)
    after = "" if day == "2026-11-27" else " and hookah-clean-2026-11-27.sql"
    head = [
        f"-- The shop's hookahs whose photo has been cleaned ({day}): \"Photo to be replaced\" comes off. Not applied live yet.",
        "-- Owner: \"we really need to clean up these hookah photos, I know we can erase the mat and make these photos clean\".",
        "-- store/tools/catalog/clear_glass2.py cut each one out of the shop's photo and cleared the patterned mat seen under and",
        "-- through the glass; frame_cutouts.py framed it like the Ace hookahs; it went in under the original's file name",
        "-- (store/public/img/pc/hookah/, all four sizes; store/src/img-versions.json bumped), so img does not change.",
        f"-- Items: {names}.",
        "-- Only the photo keys of facts_known move (photo_label and photo_full go, photo stays 'own'); name, price, stock, every",
        "-- other fact and img stay as they are live. Each line runs only where a value still differs: safe to run twice.",
        f"-- Needs the photos and store/src/img-versions.json deployed with the same commit. Run after shop-hookahs-2026-11-27.sql{after};",
        "-- re-running that file later would put the tag back (run this one again after it if that happens).",
        "-- Generated by store/tools/catalog/live_clean_hookahs.py from store/catalog/suppliers/shop-hookahs/master.json;",
        "-- test_catalog.py checks it still matches.",
        "-- Rollback (puts the tag back; the photo files roll back with the deploy):",
    ]
    return "\n".join(head + [rollback(r) for r in rows] + [line(r) for r in rows]) + "\n"


PHOTO_KEYS = ("photo", "photo_hex", "photo_label", "shown_in", "photo_upscale", "photo_full", "photo_src")


def panda_row(ace):
    """OSS-100077's desired row; its photo must be the shop's (shop_photos.py, then catalog.py build)."""
    for r in K.desired_rows("ace", ace):
        if r["sku"] == PANDA:
            if not (r["sup"]["img"] or "").startswith("shop/"):
                raise SystemExit(f"PANDA_READY but {PANDA} has no shop photo in the Ace master: add it to shop_photos.py and "
                                 "run catalog.py build first")
            return r
    raise SystemExit(f"{PANDA} is not in the Ace master")


def jval(v):
    if isinstance(v, bool):
        return "json('true')" if v else "json('false')"
    return K.q(v)


def panda_line(r):
    """img, variant_label and the photo keys of facts_known, only on the row as it is live: no photo yet (img empty)."""
    f = json.loads(r["sup"]["facts_known"])
    sets = ", ".join(f"'$.{k}', {jval(f[k])}" for k in PHOTO_KEYS if k in f)
    gone = ", ".join(f"'$.{k}'" for k in PHOTO_KEYS if k not in f)
    fk = f"json_set({FK}, {sets})" if sets else FK
    if gone:
        fk = f"json_remove({fk}, {gone})"
    return (f"UPDATE products SET img = {K.q(r['sup']['img'])}, variant_label = {K.q(r['sup']['variant_label'])}, "
            f"facts_known = {fk}, updated_at = {NOW} WHERE sku = {K.q(PANDA)} AND supplier_id = 'ace' "
            f"AND (img IS NULL OR img = '');")


def sql_b(m, ace=None):
    rows = cleaned_rows(m, GROUP_B)
    pr = panda_row(ace) if ace is not None else None
    names = ", ".join(f"{r['sku']} ({r['shop']['name']}, {r['sup']['variant_label']})" for r in rows)
    head = [
        "-- Group B of the shop's hookahs whose photo has been cleaned (2026-11-28): \"Photo to be replaced\" comes off. Not applied",
        "-- live yet. Owner: \"Don't skip any hookahs\"; \"we really need to clean up these hookah photos, I know we can erase the mat\".",
        "-- store/tools/catalog/clear_glass2.py cut each one out of the shop's photo and cleared the patterned mat seen under and",
        "-- through the glass; frame_cutouts.py framed it like the Ace hookahs; it went in under the original's file name",
        "-- (store/public/img/pc/hookah/, all four sizes; store/src/img-versions.json bumped), so img does not change.",
        f"-- Items: {names}.",
        "-- Only the photo keys of facts_known move (photo_label and photo_full go, photo stays 'own'); name, price, stock, every",
        "-- other fact and img stay as they are live. Each line runs only where a value still differs: safe to run twice.",
        "-- Not applied live yet: until it is, it grows as more of group B pass review (re-generated each time).",
        "-- Run after hookah-clean-2026-11-27.sql (and after shop-hookahs-2026-11-27.sql: re-running that file later would put",
        "-- the tag back; run this one again after it if that happens). Needs the photos and img-versions.json deployed with it.",
    ]
    if pr:
        head += [
            f"-- Also the Ace Panda ({PANDA}, live with no photo): the shop's cleaned photo of it (IMG_0689, shop_photos.py) as",
            f"-- {pr['sup']['img']}; only img, variant_label and the photo keys of facts_known move, and only while img is empty.",
        ]
    head += [
        "-- Generated by store/tools/catalog/live_clean_hookahs.py from store/catalog/suppliers/shop-hookahs/master.json"
        + (" and ace/master.json" if pr else "") + ";",
        "-- test_catalog.py checks it still matches.",
        "-- Rollback (puts the tag back; the photo files roll back with the deploy):",
    ] + [rollback(r) for r in rows]
    if pr:
        head.append(f"--   (puts back the live values of 2026-11-28: img '', variant_label '', photo 'none', no other photo key)")
        head.append(f"--   UPDATE products SET img = '', variant_label = '', facts_known = json_remove(json_set({FK}, '$.photo', 'none'), "
                    + ", ".join(f"'$.{k}'" for k in PHOTO_KEYS if k != "photo") + f"), updated_at = {NOW} WHERE sku = {K.q(PANDA)} "
                    f"AND supplier_id = 'ace' AND img = {K.q(pr['sup']['img'])};")
    return "\n".join(head + [line(r) for r in rows] + ([panda_line(pr)] if pr else [])) + "\n"


if __name__ == "__main__":
    master = C.load_master("shop-hookahs")
    for out, photos, day in FILES:
        text = sql(master, photos, day)
        out.write_text(text, encoding="utf-8", newline="\n")
        print("wrote", out, f"({text.count('UPDATE products SET facts_known = json_remove')} items)")
    text = sql_b(master, C.load_master("ace") if PANDA_READY else None)
    OUT_B.write_text(text, encoding="utf-8", newline="\n")
    print("wrote", OUT_B, f"({text.count('UPDATE products SET facts_known = json_remove')} items, "
          f"{text.count('AND (img IS NULL')} Ace photo)")
