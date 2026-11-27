"""The shop's own hanging hoses -> families. No supplier catalogue: the source is the shop's shelf photos (IMG_0543..0579,
taken 2026-11-25 on the shop's own hanging rack) and the shop's recording, whose photo captions give each hose's name and
length. Owner, 2026-11-27: "Let's just get all on the site, the ones we're not sure about I'll go back through with Jamal and
we'll clean it up", then "still match them up to the best of your ability right now".

Rules (owner, 2026-11-27):
- names and lengths exactly as the recording's captions say them (only the typo "dispoable" fixed in a name); no online
  names, no cm conversion, no "handle included" notes;
- a hose with no caption is named from the brand and type printed on its bag; its length is "To confirm" (null here);
- every hose is in the shop (photographed on its shelf), Price TBD, stock not counted; the shop fills price, colours and
  stock in the back office's item editor;
- an unsure match (medium confidence, Babylon, every uncaptioned hose) carries needs_confirm with the reason, for the back
  office's "Needs info" list; it is never shown to shoppers.
The photo is the shop's own, cut out of the shelf with the bag kept as see-through film (720x900 frame, store/public/img/pc/hose/).
"""
from __future__ import annotations

from catlib import cell, slug

SRC_ID = "shop-hoses-2026-11-25"
EDITION = "Shop shelf photos and recording captions, 2026-11-25"
RECEIVED = "2026-11-25"
REC = "shop:recording 2026-11-25 caption"   # the shop's own word: a caption under its photo in the recording
RULE = "rule 2026-11-27 (owner: match them up to the best of your ability)"

# Plain colour names (seen on the shop's own photo) and the chip colour each one draws.
HEX = {"Orange": "#e8742a", "Pink": "#e58bb4", "Red": "#c2262e", "Bronze": "#8a5a2b", "Yellow": "#f2d21b", "Black": "#141414",
       "Purple": "#6c3fa6", "White": "#f3f1ea", "Green": "#2e8b57", "Teal": "#3fbfa8", "Grey": "#9a9a9a", "Blue": "#2b59c3"}

MEDIUM = "matched to the caption by the order of the recording's messages, not by print on the bag"
UNCAPTIONED = "not in the recording: name read from the bag, length not known"

# (name, caption as written or None, length as captioned or None, brand, [(photo, colour, confirm reason or None)], family confirm reason or None)
HOSES = [
    ("Aljomeyra Disposable Hose", "Aljomeyra dispoable hose 174cm", "174 cm", "Aljomeyra", [("IMG_0565", "Orange", None)], None),
    ("No-name Disposable Hose", "No name brand disposable hose 71 inches", "71 inches", None, [("IMG_0564", "Pink", None)], None),
    ("Khalil Maamoon Disposable Hose", "Khalil maamoon disposable hose 61 inches", "61 inches", "Khalil Maamoon", [("IMG_0561", "Red", None)], None),
    ("Alwan Disposable Hose", "Alwan disposable hose 61 inches", "61 inches", "Alwan", [("IMG_0572", "Bronze", None)], None),
    ("No-name hose with end and mouthpiece attachments", "No name brand hose plus end and mouth peice attachments total length 67 inches",
     "67 inches total", None, [("IMG_0566", "Yellow", None)], None),
    ("Super Al Ameer Disposable Hose", "Super Al Ameer disposable hose 67 inches", "67 inches", "Super Al Ameer", [("IMG_0547", "Black", None)], None),
    ("Starbuzz Fabric Disposable Hose", "Starbuzz fabric disposable hose 66.5 inches", "66.5 inches", "Starbuzz", [("IMG_0550", "Black", None)],
     "the recording's photo shows a tan handle, partly hidden in the hanging shot: check it is this hose"),
    ("Simba Disposable Hose", "Simba disposable hose 60.5 inches", "60.5 inches", "Simba",
     [("IMG_0579", "Purple", None), ("IMG_0545", "White", "the white hose is in a differently printed Simba bag and is not in the recording's photo: check the caption covers it")], None),
    ("Crown Disposable Hose", "Crown disposable hose 60.5 inches", "60.5 inches", "Crown", [("IMG_0577", "Orange", None)], None),
    ("Platinum Disposable Hose", "Platinum disposable hose 60.5 inch", "60.5 inch", "Platinum",
     [("IMG_0575", "Yellow", None), ("IMG_0576", "Black", None), ("IMG_0578", "Green", None)], None),
    ("Crystal Disposable Hose", "Crystal disposable hose 69.5 inches", "69.5 inches", "Crystal", [("IMG_0563", "Orange", None)], None),
    ("Zanobia Premium Ice Hose", "Zanobia premium ice hose 72 inches", "72 inches", "Zanobia", [("IMG_0552", "Red", None), ("IMG_0553", "Black", None)], MEDIUM),
    ("Zanobia Disposable Ice Hose", "Zanobia disposable ice hose 63 inch", "63 inch", "Zanobia",
     [("IMG_0557", "White", None), ("IMG_0548", "Green", None), ("IMG_0556", "Yellow", None)], MEDIUM + "; the bag says disposable, not ice"),
    # owner 2026-11-27: the Babylon caption goes to the yellow hose (the long clear handle with foam grips that ice hoses use);
    # the blue one has a short ordinary handle. Length written as the coordinator's ruling has it ("77inch" -> "77 inches").
    ("Babylon Disposable Ice Hose", "Babylon disposable ice hose 77inch", "77 inches", "Babylon", [("IMG_0558", "Yellow", None)],
     "one caption was left for two uncaptioned photos (this yellow one and the blue one); given to this one for its ice-hose handle with foam grips"),
    # not in the recording: named from the bag
    ("Starbuzz Ribbed Hose", None, None, "Starbuzz",
     [("IMG_0543", "Red", None), ("IMG_0549", "Teal", None), ("IMG_0551", "Pink", None), ("IMG_0555", "Grey", None)], UNCAPTIONED + " (bag: Starbuzz Tobacco)"),
    ("Al Ataa Disposable Hose", None, None, "Al Ataa", [("IMG_0544", "Black", None)], UNCAPTIONED + " (bag: Alataa, disposable)"),
    ("Zanobia Washable Hose", None, None, "Zanobia", [("IMG_0559", "Yellow", None), ("IMG_0560", "Green", None)], UNCAPTIONED + " (bag: Zanobia, Washable)"),
    ("Sager Washable Hose", None, None, "Sager", [("IMG_0568", "Pink", None)], UNCAPTIONED + " (bag: Sager Hookah, Washable)"),
    ("Zanobia Hose", None, None, "Zanobia", [("IMG_0569", "Black", None)], UNCAPTIONED + " (card: Zanobia, type not readable)"),
    ("Royal Disposable Hose", None, None, "Royal", [("IMG_0571", "Black", None)], UNCAPTIONED + " (bag: Royal, Disposable Hookah Hose)"),
    ("Hookah Hose, Blue", None, None, None, [("IMG_0562", "Blue", None)], UNCAPTIONED + "; no brand on the bag (the other photo left after the Babylon caption)"),
]


def photo_name(name: str, colour: str) -> str:
    """The photo's address under store/public/img/pc/ (no extension)."""
    s = slug(name)
    return f"hose/{s}" if s.endswith("-" + slug(colour)) else f"hose/{s}-{slug(colour)}"


def families():
    out = []
    for i, (name, caption, length, brand, shots, why) in enumerate(HOSES):
        fid = "hose-" + slug(name)
        src_name = f"{REC} '{caption}'" if caption else f"photo:{shots[0][0]} (bag print); {RULE}"
        variants = []
        for photo, colour, vwhy in shots:
            reason = "; ".join(r for r in (why, vwhy) if r) or None
            variants.append({"key": f"{fid}#{slug(colour)}", "photo_file": photo, "colour": cell(colour, f"photo:{photo} (the shop's shelf photo)"),
                             "swatch_hex": cell(HEX[colour], f"rule: chip colour for '{colour}'"),
                             "confirm": cell(reason, RULE if reason else None),
                             "img": photo_name(name, colour)})
        out.append({
            "family_id": fid, "order": i, "category": "hoses",
            "name": cell(name, src_name),
            "supplier_ref": cell(caption or name, f"{REC}" if caption else f"photo:{shots[0][0]} (bag print)"),
            "facts": {"length": cell(length, f"{REC} '{caption}'" if length else None),
                      "brand": cell(brand, src_name if brand else None),
                      "weight_g": cell(None, None)},
            "flags": ([f"NEEDS SHOP: {why}"] if why else []) + [f"NEEDS SHOP: {v['colour']['v']}: {v['confirm']['v']}" for v in variants if v["confirm"]["v"] and v["confirm"]["v"] != why],
            "variants_src": variants,
        })
    return out
