"""Tobacco-free shisha: the shop's own list (owner, 2026-11-24), verified in inventory-2026-11-23/shisha.

Prices are the shop's (its own list), so they are shop-owned. Launch rule (plan section 6): after the legal
check and each supplier's lab certificate, so every item starts off whatever its price.
"""
from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path

from catlib import cell, slug

SRC_ID = "oss-shisha-2026-11-24"
STOCK_RULING = "shop:ruling 2026-11-24 via Jamal: start every item at 10, sold-out at 0"
OFF_RULE = "rule: off until the legal check is done and the supplier's lab certificate is on file (plan section 6 and 8)"


def load(intake: Path):
    p = intake / "shisha" / "catalogue.json"
    return json.loads(p.read_text(encoding="utf-8")), p


def families(data, public_img_dir: Path):
    fams = OrderedDict()
    meta = data["meta"]["families"]
    for r in sorted(data["rows"], key=lambda r: (r.get("family_sort", 99), r["sku"])):
        brand = r["brand"]
        fm = meta.get(brand, {})
        p = f"list:{SRC_ID}#lines {r['source_line']}"
        fid = "shisha-" + slug(r["family"])
        if fid not in fams:
            flags = []
            if fm.get("conflict"):
                flags.append("NEEDS SHOP: " + fm["conflict"])
            flags.append("Off until the legal check and the supplier's lab certificate (tobacco-free, nicotine-free)")
            fams[fid] = {
                "family_id": fid, "category": "shisha",
                "supplier_ref": cell(r["family"], p + ":text"),
                "supplier_price_cents": cell(None, None),
                "price_basis": cell("shop shelf price, before tax", p + ":'plus tax'"),
                "facts": {"brand": cell(brand, p + ":text"),
                          "size": cell(r.get("size"), "intake:" + (fm.get("size_source") or "catalogue.json")),
                          "line": cell(r.get("line"), "intake:shisha/catalogue.json (pack or retailer)"),
                          "base": cell(r.get("base"), "intake:shisha/catalogue.json"),
                          "maker": cell(fm.get("maker"), "intake:shisha/catalogue.json" if fm.get("maker") else None),
                          "package": cell(fm.get("package"), "intake:shisha/catalogue.json" if fm.get("package") else None),
                          "weight_g": cell(None, None),
                          "fulfilment": cell("to confirm", "intake: fulfilment CONFIRM")},
                "flags": flags, "variants": []}
        price = int(round(r["price_cad"] * 100)) if r.get("price_cad") is not None else None
        sku = r["sku"]
        on_site = (public_img_dir / f"{sku.lower()}.webp").exists()
        shop = {
            "price_cents": cell(price, f"shop:price list source-shisha-2026-11-24.txt lines {r['source_line']}" if price else None),
            "display_name": cell(r["display_name"], f"shop:intake display name ({r.get('verification')})"),
            "stock": cell(0 if r.get("sold_out_in_source") else 10, STOCK_RULING),
            "active": cell(False, OFF_RULE),
            "colour_confirmed": cell(None, None),
            "in_stock_here": cell(not r.get("sold_out_in_source"), "shop:list (sold out marked in the source)"),
            "note": cell(None, None),
        }
        flags = list(r.get("flags") or [])
        if r.get("tobacco_conflict"):
            flags.append(r["tobacco_conflict"])
        fams[fid]["variants"].append({
            "sku": sku, "key": f"legacy:{sku}",
            "label": cell(r.get("official_flavour") or r.get("source_flavour"), p + ":text"),
            "photo": {"img": sku.lower() if on_site else None,
                      "status": "ready" if on_site else ("approved_not_published" if r.get("photo_site_ready") else "needs_store_photo"),
                      "src": f"intake:shisha/{r.get('photo_site_ready')} ({r.get('photo_status')}; {r.get('photo_rights')})" if r.get("photo_site_ready") else "no photo"},
            "flags": flags,
            "shop": shop})
    return list(fams.values())
