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
- the ones that match an item already on the site are not added again (the Ace Flat Rope, Rope, Bowl 3, Ice Cream,
  Silicone and D-61 bowls: IMG_0584 0585 0586 0593 0594 0599 0602 0603 0604 0632), nor second views of one bowl
  (IMG_0620 0622 0624 0626 0661 0663). IMG_0638 is not in the Drive folder (searched 2026-11-27);
- bowls with no readable brand (PLAIN_BOWLS, owner 2026-11-27: "We need all of the store's items on the site asap, if
  there's issues let's get around them") go up under a plain name that only describes what the photo shows (shape,
  finish, material); no brand, no model, every family flagged to confirm the name. A stamp we cannot read is noted.
The photo is the shop's own, cut off the sweep with rembg (birefnet-general-lite) and framed by frame_cutouts.py --kind bowl\n(720x900, accessory framing, store/public/img/pc/bowl/).
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
       "Red and black": "#c33a32", "Yellow and purple": "#e6dc2a",
       # PLAIN_BOWLS colours
       "Purple": "#5b3a8c", "Silver": "#b8b8b8", "Bronze": "#8c6a3a", "Grey": "#6e6e6e", "Clear": "#dfe8ec", "Olive": "#6b6a2e",
       "Amber": "#b8822e", "Multicolour": "#d8d2c4", "Brown and cream": "#8a5f3a", "Dark brown": "#4e3420"}

SHAPE = "named from the brand on the bowl; the shape word is ours (no model name is printed): check the name"
HIDDEN = "the brand is turned away in this photo; shape and finish match the family: check it is the same bowl"

# (name, brand, where the brand is printed, [(photo, colour, confirm reason or None)], family confirm reason or None)
BOWLS = [
    ("Oblako Bowl", "Oblako", "ОБЛАКО stamped on the clay stem",
     [("IMG_0589", "Green", None), ("IMG_0618", "Sage", None), ("IMG_0608", "Black", None), ("IMG_0616", "Yellow", None), ("IMG_0617", "Orange", None)],
     "named from the stamp on the stem (ОБЛАКО, written Oblako): check the name"),
    ("VON Funnel Bowl", "VON", "VON swing tag",
     [("IMG_0606", "Red and white", None), ("IMG_0607", "Orange", None), ("IMG_0610", "Brown", None), ("IMG_0614", "Blue", None),
      ("IMG_0609", "Green", HIDDEN)], SHAPE),
    ("VON Short Bowl", "VON", "VON swing tag", [("IMG_0591", "Orange", None), ("IMG_0592", "Blue", None)], SHAPE),
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

# Bowls with no readable brand (owner 2026-11-27: all of the shop's items on the site). Same tuple as BOWLS with brand None;
# `where` says what the name is read from. Every family carries PLAIN (or its own reason) for the Needs info list.
PLAIN = "no brand on the bowl: the name only describes what the shop's photo shows; check the name"
STAMP = "an Arabic word is stamped on the stem (not read here): the name only describes the bowl; check the name and brand"
TWIN = "IMG_0654 and IMG_0655 look much alike: check they are two different bowls before both are sold"
RULE_PLAIN = "rule 2026-11-27 (owner: all of the store's items on the site; a bowl with no brand gets a plain descriptive name)"
PLAIN_BOWLS = [
    ("Hexagon Bowl", None, "six-sided glazed top on a six-sided clay stem",
     [("IMG_0587", "Red", None), ("IMG_0588", "Black", None)], PLAIN),
    ("Two-tone Funnel Bowl", None, "glazed funnel top on a plain brown clay stem",
     [("IMG_0590", "Red and white", None), ("IMG_0600", "Yellow", None), ("IMG_0601", "Blue", None)], PLAIN),
    ("Speckled Funnel Bowl", None, "speckled glaze, funnel top on a waisted stem", [("IMG_0597", "Purple", None)],
     PLAIN + "; its shape is close to the VON Speckled Bowl (IMG_0615) but no tag shows: check whether it is a VON"),
    ("Hexagon-stem Funnel Bowl", None, "glazed funnel top on a six-sided brown stem with an Arabic stamp",
     [("IMG_0598", "Green", None)], STAMP),
    ("Glazed Multi-hole Bowl", None, "glazed multi-hole top on a fluted brown stem with an Arabic stamp",
     [("IMG_0630", "Red", None), ("IMG_0637", "Blue", None)], STAMP),
    ("Matte Clay Bowl", None, "unglazed clay, multi-hole top on a patterned stem",
     [("IMG_0631", "Brown", None), ("IMG_0636", "Grey", None)], PLAIN),
    ("Horned Head Bowl with Glass Top", None, "cut-glass bowl on a sculpted horned head",
     [("IMG_0619", "Silver", None), ("IMG_0621", "Purple", None), ("IMG_0623", "Bronze", None), ("IMG_0625", "Blue", None)], PLAIN),
    ("Glass Bowl on Silicone Base", None, "clear glass funnel bowl seated in a silicone base",
     [("IMG_0627", "Orange", None), ("IMG_0628", "Blue", None), ("IMG_0629", "Green", None)], PLAIN),
    ("Glass Bowl on Painted Base", None, "clear glass funnel bowl on a white base painted with coloured lines",
     [("IMG_0640", "Multicolour", None)], PLAIN),
    ("Silicone Bowl with Clay Insert", None, "ribbed silicone body holding a clay multi-hole insert",
     [("IMG_0635", "Blue", None), ("IMG_0639", "Red", None), ("IMG_0646", "Green", None)], PLAIN),
    ("Glazed Flower Bowl", None, "wavy, petal-like rim in a running glaze",
     [("IMG_0633", "Light blue", None), ("IMG_0634", "Red", None), ("IMG_0647", "Olive", None), ("IMG_0652", "Brown and cream", None)], PLAIN),
    ("Glazed Tiered Bowl", None, "wide stepped rim in a running glaze on a short foot",
     [("IMG_0654", "Amber", TWIN), ("IMG_0655", "Brown", TWIN), ("IMG_0656", "Grey", None), ("IMG_0657", "Dark brown", None)], PLAIN),
    ("Faceted Bowl", None, "glossy faceted top on a slim stem", [("IMG_0653", "Black", None)], PLAIN),
    ("Metallic-rim Bowl", None, "metallic glazed top on a rounded glazed stem",
     [("IMG_0658", "Light blue", None), ("IMG_0659", "Blue", None)], PLAIN),
    ("Carved Face Bowl", None, "glazed multi-hole top on a carved face", [("IMG_0660", "Brown", None)], PLAIN),
    ("Pirate Head Bowl", None, "bowl set in a sculpted pirate's head and hat", [("IMG_0662", "Blue", None)], PLAIN),
    ("Glass Bowl with Screen", None, "cut-glass cup with a metal screen on top", [("IMG_0664", "Clear", None)], PLAIN),
    ("Silicone Bowl with Metal Insert", None, "silicone body holding a metal insert with a centre spike", [("IMG_0665", "Blue", None)], PLAIN),
]
ALL_BOWLS = BOWLS + PLAIN_BOWLS


def photo_name(name: str, colour: str) -> str:
    """The photo's address under store/public/img/pc/ (no extension)."""
    return f"bowl/{slug(name)}-{slug(colour)}"


def families():
    out = []
    for i, (name, brand, where, shots, why) in enumerate(ALL_BOWLS):
        fid = "bowl-" + slug(name)
        rule = RULE if brand else RULE_PLAIN
        src = f"photo:{shots[0][0]} ({where}); {rule}"
        variants = []
        for photo, colour, vwhy in shots:
            reason = "; ".join(r for r in (why, vwhy) if r) or None
            variants.append({"key": f"{fid}#{slug(colour)}", "photo_file": photo, "colour": cell(colour, f"photo:{photo} (the shop's own photo)"),
                             "swatch_hex": cell(HEX[colour], f"rule: chip colour for '{colour}'"),
                             "confirm": cell(reason, rule if reason else None),
                             "img": photo_name(name, colour)})
        out.append({
            "family_id": fid, "order": i, "category": "bowls",
            "name": cell(name, src),
            "supplier_ref": cell(f"{brand} ({where})" if brand else f"No brand ({where})", f"photo:{shots[0][0]}"),
            "facts": {"brand": cell(brand, src if brand else None), "weight_g": cell(None, None)},
            "flags": ([f"NEEDS SHOP: {why}"] if why else []) + [f"NEEDS SHOP: {v['colour']['v']}: {v['confirm']['v']}" for v in variants if v["confirm"]["v"] and v["confirm"]["v"] != why],
            "variants_src": variants,
        })
    return out
