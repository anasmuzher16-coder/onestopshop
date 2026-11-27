"""The shop's own bowls (hookah heads) -> families. No supplier catalogue: the source is the shop's photos of each bowl on a
plain white sweep (IMG_0584..IMG_0665, Google Drive, 2026-11-27). Owner, 2026-11-27: "In the Google Drive there's now photos
of a bunch of hookahs and hookah heads, start extracting them, cropping, cleaning them up and putting them on the site."

Rules (same model as the shop's hoses, src_shop_hoses.py):
- only a bowl whose maker can be read off the bowl itself goes up: the name is that brand, as printed (ОБЛАКО written
  Oblako), plus one plain word for its shape where one brand has several shapes. The shape word is ours, not printed, so
  every family carries needs_confirm with that reason, for the back office's "Needs info" list (never shown to shoppers);
- a colour whose brand is hidden in its photo (tag turned away) but whose shape and finish match the family carries its
  own reason too;
- every bowl is in the shop (photographed there), Price TBD, stock not counted, weight unknown (pickup or local delivery
  once priced); the shop fills price and stock in the item editor;
- bowls with no readable brand, and the ones that match an item already on the site, are listed in the report, not added.
The photo is the shop's own, cut off the sweep (720x900 frame, accessory framing, store/public/img/pc/bowl/).
"""
from __future__ import annotations

from catlib import cell, slug

SRC_ID = "shop-bowls-2026-11-27"
EDITION = "Shop bowl photos on a white sweep, Google Drive 2026-11-27"
RECEIVED = "2026-11-27"
RULE = "rule 2026-11-27 (owner: put the photographed bowls on the site; name only from the brand on the bowl)"

# Plain colour names (seen on the shop's own photo) and the chip colour each one draws.
HEX = {"Green": "#2f6b2a", "Sage": "#7fa08a", "Black": "#141414", "Yellow": "#e3d21f", "Orange": "#e0662a", "Red and white": "#c8423a",
       "Brown": "#8a5a2b", "Blue": "#22409a", "Light blue": "#7fa7cf", "Red": "#c8372d", "Blue and red": "#2b3fa8",
       "Red and black": "#c33a32", "Yellow and purple": "#e6dc2a"}

SHAPE = "named from the brand on the bowl; the shape word is ours (no model name is printed): check the name"
HIDDEN = "the brand is turned away in this photo; shape and finish match the family: check it is the same bowl"

# (name, brand, where the brand is printed, [(photo, colour, confirm reason or None)], family confirm reason or None)
BOWLS = [
    # IMG_0589 (green), IMG_0616 (yellow) and IMG_0618 (sage) are left out: their grey clay stems and the pale band where
    # glaze meets clay could not be cut off the sweep cleanly
    ("Oblako Bowl", "Oblako", "ОБЛАКО stamped on the clay stem",
     [("IMG_0608", "Black", None), ("IMG_0617", "Orange", None)],
     "named from the stamp on the stem (ОБЛАКО, written Oblako): check the name"),
    # IMG_0606 (red and white), IMG_0610 (brown) and the short VON bowls IMG_0591 (orange) and IMG_0592 (blue) are left out:
    # their pale necks, white glaze edges and the sweep showing between tag and body could not be cut cleanly
    ("VON Funnel Bowl", "VON", "VON swing tag",
     [("IMG_0607", "Orange", None), ("IMG_0614", "Blue", None), ("IMG_0609", "Green", HIDDEN)], SHAPE),
    ("VON Ribbed Bowl", "VON", "VON swing tag", [("IMG_0596", "Green", None)], SHAPE),
    ("VON Speckled Bowl", "VON", "VON swing tag", [("IMG_0615", "Yellow", None)], SHAPE),
    ("TAS Bowl", "TAS", "TA$ stamped on the foot",
     [("IMG_0595", "Blue and red", None), ("IMG_0611", "Red and black", None), ("IMG_0612", "Yellow and purple", None)],
     "named from the stamp on the foot (TA$, written TAS): check the name"),
    ("Yahya Bowl", "Yahya", "YAHYA stamped on the stem", [("IMG_0605", "Brown", None), ("IMG_0613", "Blue", None)],
     "named from the stamp on the stem (YAHYA): check the name"),
    ("Zanobia Bowl", "Zanobia", "ZANOBIA moulded round the bowl",
     [("IMG_0641", "Blue", None), ("IMG_0642", "Red", None), ("IMG_0643", "Yellow", None), ("IMG_0645", "Black", None)],
     "named from the moulded band (ZANOBIA): check the name"),
    ("Zanobia Multi-hole Bowl", "Zanobia", "ZANOBIA moulded round the bowl",
     [("IMG_0649", "Black", None), ("IMG_0650", "Red", None), ("IMG_0651", "Blue", None), ("IMG_0648", "Yellow", HIDDEN)], SHAPE),
    ("Zanobia Star Bowl", "Zanobia", "ZANOBIA moulded on the stem", [("IMG_0644", "Light blue", None)], SHAPE),
]


def photo_name(name: str, colour: str) -> str:
    """The photo's address under store/public/img/pc/ (no extension)."""
    return f"bowl/{slug(name)}-{slug(colour)}"


def families():
    out = []
    for i, (name, brand, where, shots, why) in enumerate(BOWLS):
        fid = "bowl-" + slug(name)
        src = f"photo:{shots[0][0]} ({where}); {RULE}"
        variants = []
        for photo, colour, vwhy in shots:
            reason = "; ".join(r for r in (why, vwhy) if r) or None
            variants.append({"key": f"{fid}#{slug(colour)}", "photo_file": photo, "colour": cell(colour, f"photo:{photo} (the shop's own photo)"),
                             "swatch_hex": cell(HEX[colour], f"rule: chip colour for '{colour}'"),
                             "confirm": cell(reason, RULE if reason else None),
                             "img": photo_name(name, colour)})
        out.append({
            "family_id": fid, "order": i, "category": "bowls",
            "name": cell(name, src),
            "supplier_ref": cell(f"{brand} ({where})", f"photo:{shots[0][0]}"),
            "facts": {"brand": cell(brand, src), "weight_g": cell(None, None)},
            "flags": ([f"NEEDS SHOP: {why}"] if why else []) + [f"NEEDS SHOP: {v['colour']['v']}: {v['confirm']['v']}" for v in variants if v["confirm"]["v"] and v["confirm"]["v"] != why],
            "variants_src": variants,
        })
    return out
