"""Charcoal and foil: the shop's own list, verified in the 2026-11-23 intake, plus the owner's decisions.

The prices on this list are the SHOP's prices (its own price list), so they are shop-owned with a shop source.
There is no supplier price for these items.
"""
from __future__ import annotations

import json
from pathlib import Path

from catlib import cell

SRC_ID = "oss-list-2026-11-23"
STOCK_RULING = "shop:ruling 2026-11-24 via Jamal: start every item at 10 and update as items sell"
CHARCOAL_RULE = "shop:ruling 2026-11-24 (owner): charcoal is pickup or local delivery only, never shipped"
FOIL_RULE = "shop:ruling 2026-11-23 (owner): foil can be shipped"


def load(intake: Path):
    data = json.loads((intake / "catalogue-verified.json").read_text(encoding="utf-8"))
    site_ready = intake / "photos" / "site-ready"
    photos = {p.stem for p in site_ready.glob("oss-*.webp") if not p.stem.endswith(("-m", "-s", "-l"))}
    return data, photos


def families(data, photos, source_file: str):
    fams = []
    for r in data["rows"]:
        p = f"list:{SRC_ID}#lines {r['source_line']}"
        is_charcoal = r["category"] == "charcoal"
        sku = r["sku"]
        photo_name = sku.lower() if sku.lower() in photos else None
        facts = {
            "brand": cell(r.get("brand"), p + ":text"),
            "count": cell(r.get("count"), p + ":text" if r.get("count") is not None else None),
            "size": cell(r.get("size"), p + ":text" if r.get("size") else None),
            "shape": cell(r.get("shape"), p + ":text" if r.get("shape") else None),
            "material": cell(r.get("material"), p + ":text" if r.get("material") else None),
            "weight_g": cell(None, None),
            "fulfilment": cell("pickup_or_local_delivery" if is_charcoal else "ships",
                               CHARCOAL_RULE if is_charcoal else FOIL_RULE),
            "verification": cell(r.get("final_score"), f"intake:catalogue-verified.json {sku}"),
        }
        flags = []
        if r.get("shop_to_confirm"):
            flags.append("NEEDS SHOP: " + r["shop_to_confirm"])
        if r.get("flags"):
            flags.append(r["flags"])
        if not is_charcoal:
            flags.append("Foil can ship, but each pack's weight is unknown: needed before it can be posted")
        if not r.get("size") and is_charcoal:
            flags.append("Size blank in the shop's list")
        price = int(round(r["price_cad"] * 100)) if r.get("price_cad") is not None else None
        shop = {
            "price_cents": cell(price, f"shop:price list {source_file} lines {r['source_line']}" if price else None),
            "display_name": cell(r["display_name"], f"shop:intake display name, verified ({r.get('final_score')})"),
            "stock": cell(10, STOCK_RULING),
            "active": cell(price is not None, "shop:owner ruling 2026-11-24, charcoal in Heat" if price else "rule: off until a price is set"),
            "colour_confirmed": cell(None, None),
            "in_stock_here": cell(True, "shop:it is on the shop's own price list"),
            "note": cell(r.get("web_description"), "shop:intake description" if r.get("web_description") else None),
        }
        variant = {"sku": sku, "key": f"legacy:{sku}",
                   "label": cell(r.get("variant"), p + ":text" if r.get("variant") else None),
                   "photo": {"img": photo_name, "status": "ready" if photo_name else "needs_store_photo",
                             "src": "intake:photos/site-ready (approved)" if photo_name else (r.get("photo_status") or "no photo")},
                   "shop": shop}
        fams.append({
            "family_id": f"{r['category']}-{sku.lower()}",
            "category": r["category"],
            "supplier_ref": cell(f"{r['product']}, {r.get('variant') or ''}".strip(", "), p + ":text"),
            "supplier_price_cents": cell(None, None),
            "price_basis": cell("shop shelf price, before tax", f"intake meta: {data['meta'].get('price_basis')}"),
            "facts": facts, "flags": flags, "variants": [variant],
        })
    for v in data["variants"]:
        p = f"list:{SRC_ID}#lines {v['source_line']}"
        price = int(round(v["roll_price_cad"] * 100)) if v.get("roll_price_cad") is not None else None
        flags = ["Single roll: only the rolls on the shop's list are real (shop, 2026-11-24)"]
        if v.get("flags"):
            flags.append(v["flags"])
        if price is None:
            flags.append("NEEDS SHOP: single-roll price is blank in the list")
        shop = {
            "price_cents": cell(price, f"shop:price list {source_file} lines {v['source_line']}" if price else None),
            "display_name": cell(v["roll_name"], "shop:intake roll name"),
            "stock": cell(10, STOCK_RULING),
            "active": cell(price is not None, "shop:owner ruling 2026-11-24, charcoal in Heat" if price else "rule: off until a price is set"),
            "colour_confirmed": cell(None, None),
            "in_stock_here": cell(True, "shop:it is on the shop's own price list"),
            "note": cell(None, None),
        }
        fams.append({
            "family_id": f"charcoal-roll-{v['roll_sku'].lower()}",
            "category": "charcoal",
            "supplier_ref": cell(v["roll_name"], p + ":text"),
            "supplier_price_cents": cell(None, None),
            "price_basis": cell("shop shelf price, before tax (assumed, same as the box)", p + ":tax note"),
            "facts": {"brand": cell(v.get("brand"), p + ":text"),
                      "box_sku": cell(v["box_sku"], f"intake:catalogue-verified.json variants {v['roll_sku']}"),
                      "fulfilment": cell("pickup_or_local_delivery", CHARCOAL_RULE),
                      "weight_g": cell(None, None)},
            "flags": flags,
            "variants": [{"sku": v["roll_sku"], "key": f"legacy:{v['roll_sku']}",
                          "label": cell("single roll", p + ":text"),
                          "photo": {"img": None, "status": "needs_store_photo", "src": "no photo"}, "shop": shop}],
        })
    retired = {r["sku"]: {"merged_into": r["merged_into"], "name": r["display_name"],
                          "src": "DECISIONS.md 2026-11-23: duplicates are the same product"} for r in data["retired"]}
    return fams, retired
