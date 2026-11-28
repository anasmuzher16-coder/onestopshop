"""Charcoal the shop carries that is not on its own price list -> families. The charcoal list (src_charcoal.py) is the shop's
priced list from the 2026-11-23 intake; a box seen only in the shop's photos goes here instead, so the intake stays as the
shop wrote it. Owner, 2026-11-27: "every item the shop carries goes up, no skipping."

Rules:
- named from what the box prints (brand, product, count), nothing else; flagged to confirm in the back office;
- in the shop (its own photo), Price TBD, stock not counted; the shop fills price and stock in the item editor;
- charcoal: pickup or local delivery only, never shipped by a carrier (ship class pickup_only, like every charcoal item).
The photo is the shop's own, cut off the background with rembg (birefnet-general-lite) and framed by frame_cutouts.py
--kind bowl (720x900, accessory framing), published to store/public/img/pc/shop/<photo name>{,-l,-m,-s}.webp:

  rembg i -m birefnet-general-lite IMG_0524.jpg CUT/IMG_0524.png
  python store/tools/catalog/frame_cutouts.py CUT CROPS --kind bowl IMG_0524
  copy CROPS/IMG_0524{,-l,-m,-s}.webp to store/public/img/pc/shop/duracubes-coconut-charcoal-cubes-72-cubes{,-l,-m,-s}.webp
  node store/tools/photo-versions.mjs
"""
from __future__ import annotations

from catlib import cell, slug

SRC_ID = "shop-charcoal-2026-11-27"
EDITION = "Shop photos of charcoal not on the shop's price list, Google Drive 2026-11-27"
RECEIVED = "2026-11-27"
RULE = "rule 2026-11-27 (owner: every item the shop carries goes up; named only from the box)"

# (name, brand, what the box prints, photo, count, confirm reason)
BOXES = [
    ("Duracubes Coconut Charcoal Cubes, 72 cubes", "Duracubes", "DURACUBES, All natural coconut charcoal, 72 CUBES", "IMG_0524", 72,
     "seen only in the shop's photo IMG_0524, not on the shop's price list (the list has the 62-piece hexagon box, OSS-9102): "
     "check the name and that the shop sells it"),
]


def photo_name(name: str) -> str:
    """The photo's address under store/public/img/pc/ (no extension)."""
    return "shop/" + slug(name.replace(",", ""))


def families():
    out = []
    for i, (name, brand, printed, photo, count, why) in enumerate(BOXES):
        fid = "charcoal-shop-" + slug(name.replace(",", ""))
        src = f"photo:{photo} (box print: {printed}); {RULE}"
        out.append({
            "family_id": fid, "order": i, "category": "charcoal",
            "name": cell(name, src),
            "supplier_ref": cell(printed, f"photo:{photo}"),
            "facts": {"brand": cell(brand, src), "count": cell(count, f"photo:{photo} (box print)"), "shape": cell("Cube", f"photo:{photo} (box print: CUBES)"),
                      "material": cell("Coconut", f"photo:{photo} (box print: ALL NATURAL COCONUT CHARCOAL)"),
                      "weight_g": cell(None, None)},
            "flags": [f"NEEDS SHOP: {why}"],
            "variants_src": [{"key": fid, "photo_file": photo, "confirm": cell(why, RULE), "img": photo_name(name)}],
        })
    return out
