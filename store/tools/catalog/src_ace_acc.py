"""Ace accessories catalogue (PDF) -> families. Read-only on the PDF.

Facts measured from the copy received 2026-11-26 (sha256 200ff2f8...): 108 pages, page 1 is the cover, pages 2-108 carry
one product each (107 products). The shop's ticks are Stamp annotations on 39 pages (all by "Mobile User"). Only the ticked
pages go on the site, each with Price TBD (owner, 2026-11-26); unticked pages stay off. The table below names every product
page so a page the shop ticks later needs no new decision. Ace's prices are the supplier price only.
"""
from __future__ import annotations

import hashlib
import re
from collections import Counter

from catlib import cell

SRC_ID = "ace-acc-2026"
EDITION = "Accessories, received 2026-11-26"
RECEIVED = "2026-11-26"
PAGES = 108
FIRST_PRODUCT_PAGE = 2   # page 1 is the cover

# Section and plain-English name for every product page: a written rule (owner, 2026-11-26), to confirm with the shop.
# Sections: bowls (bowls and heads), heat (heat management, wind covers, screens, charcoal holders, burners, tongs and every
# other charcoal tool: never the Charcoal section, which is charcoal only and pickup only), hoses (hoses, ice tips,
# mouthpieces, hose springs, rubbers and connectors), parts (bowl and base rubbers, brushes, cleaning kits, base mats,
# starter pumps), bases (glass bases), misc (bags, lights, decorative trays).
# Names fix only clear typos on the page (MOUTHPEICE, SILICORN, QAUSAR, STATER); supplier_ref keeps the page's own spelling.
# A third value is the name used while the page carries another maker's brand (Oblako, Quasar, Huqqabaz, T-Sar, Tsar, Vyro,
# Alpha): the same rule as the hookahs, the name waits until the shop confirms the piece is genuine.
RULE = "rule v2 2026-11-26: section and name from the printed name and the photo, to confirm"
ITEMS = {
    2: ("bowls", "Premium Oblako Bowl", "Bowl No. 2"), 3: ("bowls", "Crystal Bowl", None), 4: ("heat", "Black HMD", None),
    5: ("heat", "Grey HMD", None), 6: ("heat", "T-Sar HMD", "Heat Management Device No. 6"), 7: ("heat", "Cage HMD", None),
    8: ("heat", "HMD 9", None), 9: ("heat", "HMD Tray Y03", None), 10: ("heat", "HMD Tray Y05", None),
    11: ("heat", "Spider HMD", None), 12: ("heat", "Frankfurt Classic HMD", None),
    13: ("heat", "Silicone Quasar", "Heat Management Device No. 13"), 14: ("heat", "Wind Cover, Big", None),
    15: ("heat", "Wind Cover with Tray Lock", None), 16: ("heat", "Quasar 2", "Heat Management Device No. 16"),
    17: ("heat", "Huqqabaz", "Heat Management Device No. 17"), 18: ("heat", "Smoke Game HMD", None),
    19: ("heat", "Stainless HMD 2", None), 20: ("heat", "Stainless HMD 3", None), 21: ("heat", "Big HMD 07", None),
    22: ("heat", "HMD King", None), 23: ("hoses", "Vyro Carbon Mouthpiece, 40 cm", "Mouthpiece No. 23"),
    24: ("hoses", "Ice Hose", None), 25: ("hoses", "Ice Hose 2.0", None), 26: ("hoses", "Silicone Hose", None),
    27: ("parts", "Base Mat", None), 28: ("parts", "Cleaning Kit", None), 29: ("heat", "Shisha Fork", None),
    30: ("heat", "Black Charcoal Holder", None), 31: ("heat", "Charcoal Holder", None), 32: ("heat", "Big Charcoal Holder", None),
    33: ("parts", "Hookah Starter", None), 34: ("parts", "Big Hookah Starter", None),
    35: ("heat", "Charcoal Burner YS-1, 1000 W", None), 36: ("heat", "Charcoal Burner", None),
    37: ("heat", "Charcoal Burner Turbo", None), 38: ("heat", "Charcoal Burner, Big", None), 39: ("heat", "Toaster Burner", None),
    40: ("bowls", "ACE-326 Bowl", None), 41: ("bowls", "Bowl C-01", None), 42: ("bowls", "Bowl C-03", None),
    43: ("bowls", "Bowl C-06", None), 44: ("bowls", "QT-03 Bowl", None), 45: ("bowls", "Flat Rope Bowl", None),
    46: ("bowls", "Rope Bowl", None), 47: ("bowls", "JLY-3 Bowl", None), 48: ("bowls", "HMD Bowl 10", None),
    49: ("bowls", "Bowl 2", None), 50: ("bowls", "Bowl 3", None), 51: ("bowls", "D-317 Bowl", None),
    52: ("bowls", "Bowl C-07", None), 53: ("bowls", "Bowl 6", None), 54: ("bowls", "Bowl 7", None),
    55: ("bowls", "Tsar Bowl", "Bowl No. 55"), 56: ("bowls", "YS-1 Bowl", None), 57: ("bowls", "D-62 Bowl", None),
    58: ("bowls", "D-61 Bowl", None), 59: ("bowls", "Silicone Clay Bowl", None), 60: ("bowls", "Silicone Y-01 Clay Bowl", None),
    61: ("bowls", "Devil Bowl", None), 62: ("bowls", "Moon Bowl", None), 63: ("bowls", "Silicone Bowl", None),
    64: ("bowls", "Printed Bowl", None), 65: ("bowls", "Ice Cream Bowl", None), 66: ("bowls", "ACE-26 Bowl", None),
    67: ("bowls", "ACE-68 Bowl", None), 68: ("bowls", "Moon Bowl 2.0", None), 69: ("bowls", "D-85 Bowl", None),
    70: ("hoses", "Mouthpiece", None), 71: ("hoses", "Alpha Mouthpiece", "Mouthpiece No. 71"),
    72: ("heat", "Quasar Glass", "HMD Glass No. 72"), 73: ("misc", "Vyro Bag", "Hookah Bag No. 73"),
    74: ("parts", "HMD Rubber", None), 75: ("parts", "Bowl Rubber", None), 76: ("hoses", "Hose Rubber", None),
    77: ("hoses", "Hose Spring", None), 78: ("hoses", "Two-Hose Connector", None), 79: ("bowls", "Replacement Glass Bowl", None),
    80: ("heat", "Replacement Screen", None), 81: ("parts", "Stem Brush, Long", None), 82: ("parts", "Stem Brushes, Short", None),
    83: ("heat", "Charcoal Tongs No. 83", None), 84: ("heat", "Charcoal Tongs No. 84", None), 85: ("heat", "AK-47 Tongs", None),
    86: ("heat", "YS-1 Tongs", None), 87: ("parts", "Hookah Rubber", None), 88: ("misc", "Hookah Bag", None),
    89: ("misc", "Big Hookah Bag", None), 90: ("misc", "Hookah Bag, Upright", None), 91: ("misc", "Wood LED Base Light, Big", None),
    92: ("misc", "LED Base Light, Big", None), 93: ("misc", "Bulldog Nordic Tray", None), 94: ("misc", "Astro Tray", None),
    95: ("bases", "Clear Glass Base", None), 96: ("bases", "Clear Black Glass Base", None), 97: ("bases", "Crystal Drip Glass Base", None),
    98: ("bases", "Crystal Ice 2.0 Glass Base", None), 99: ("bases", "Crystal Drip Glass Base, Clear Black", None),
    100: ("bases", "Crystal Ice 7.0 Glass Base", None), 101: ("bases", "Glass Base without Lid (L)", None),
    102: ("bases", "Glass Base without Lid (M)", None), 103: ("bases", "Glass Base without Lid (S)", None),
    104: ("bases", "Small Glass Base", None), 105: ("bases", "Small Crystal Glass Base", None),
    106: ("bases", "Diamond Crystal Base", None), 107: ("hoses", "ACE Disposable Mouthpieces, 100 pack", None),
    108: ("bases", "Mr Ed Base", None),
}
# The product photo when a page has more than one cut-out (checked by eye on the contact sheets, 2026-11-26): the piece
# itself over its box shot or a second view; one colour stands for an item sold in several.
PHOTO_XREF = {13: 840, 16: 917, 17: 955, 23: 1124, 26: 1210, 35: 1426, 36: 1446, 49: 1786, 56: 1967, 71: 2383, 73: 2444,
              91: 2932, 97: 3107}
STAMP_QUESTIONS = {
    77: ("unclear", "The tick on page 77 sits mostly off the top of the page and does not show. Is the hose spring in stock?"),
}
# Pages whose cut-out also carries another shop's signature beside the product (p81, bottom right): only the product stays.
KEEP_LARGEST = {81}
# Hand crops: keep the mask pieces whose middle lies in this part of Ace's image (fractions x0, y0, x1, y1): the product, never its retail box (design review 2026-11-26).
KEEP_PART = {12: (0.45, 0.0, 1.0, 1.0)}
# The box on page 9 touches the tray's mask, so it is cut out by its own rectangle (fractions of Ace's image; the handle
# passes below it and is kept whole, checked on a gridded render 2026-11-26).
DROP_PART = {9: [(0.505, 0.25, 0.97, 0.6, "all"), (0.48, 0.6, 0.97, 0.7, "light")]}   # "light": only the white box, the black handle stays
# Photos held back while the name is: these show the other maker's mark on the product or its box (QUASAR on the ring,
# Huqqabaz on the grip, the T-Sar box), so showing them would undo the withheld name. The drawn stand-in shows until the shop
# confirms the piece is genuine or sends its own photo (design review 2026-11-26).
HOLD_PHOTO = {p: "held with the name: the photo shows another maker's mark; the shop's own photo or its confirmation frees it"
              for p, v in ITEMS.items() if v[2]}
NO_PHOTO = {83: "Ace's page has the tongs printed into its background, with no cut-out: needs a photo"}
# The page's price when its text runs the label and the price together ("Price: $25", page 71).
PRICE_FIX = {71: "$25"}


def read_pdf(path, every=False):
    import pymupdf
    pymupdf.TOOLS.mupdf_display_errors(False)
    doc = pymupdf.open(str(path))
    md5, use = {}, Counter()
    for pg in doc:
        for im in pg.get_images(full=True):
            x = im[0]
            if x not in md5:
                md5[x] = hashlib.md5(doc.xref_stream_raw(x) or b"").hexdigest()
            use[md5[x]] += 1
    pages = []
    for i, pg in enumerate(doc, 1):
        stamps = [a for a in (pg.annots() or []) if a.type[1] == "Stamp"]
        if i < FIRST_PRODUCT_PAGE or (not stamps and not every):
            continue
        lines = []
        for b in pg.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                t = "".join(s["text"] for s in ln["spans"]).strip()
                if t and "ACE IT" not in t and "ACEIT" not in t and t not in ("ACE HOOKAH", "ACE COLLECTION", "Accessories", "COLOUR") \
                        and not t.endswith(":") and not re.fullmatch(r"(E IT|CEIT|ACE I|ACE|I)", t):
                    lines.append(t)
        price = [t for t in lines if re.fullmatch(r"\$\d+(\.\d{1,2})?", t)] or ([PRICE_FIX[i]] if i in PRICE_FIX else [])
        ref = re.sub(r"\s*Price:\s*\$[\d.]+", "", re.sub(r"\s+", " ", " ".join(t for t in lines if t not in price))).strip()
        W = pg.rect.width
        squares = sum(1 for d in pg.get_drawings() if d.get("fill") is not None and 50 < d["rect"].width < 160 and abs(d["rect"].width - d["rect"].height) < 20)
        st_rects = [a.rect for a in stamps]
        photos = []
        seen = set()
        for im in pg.get_images(full=True):
            x, sm = im[0], im[1]
            if x in seen or not sm:
                continue   # a product cut-out always carries its own mask
            seen.add(x)
            rects = pg.get_image_rects(x)
            if not rects or use[md5[x]] > 3 or min(im[2], im[3]) < 40:
                continue
            r = rects[0]
            c = ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
            if any(s.x0 <= c[0] <= s.x1 and s.y0 <= c[1] <= s.y1 for s in st_rects) and (im[2] == 512 or im[3] == 512 or r.width < 0.15 * W):
                continue   # the tick's own drawing tiles
            if im[2] == 512 or im[3] == 512 or im[2] == 1 or im[3] == 1:
                continue
            photos.append({"xref": x, "smask": sm, "w": im[2], "h": im[3], "area": r.width * r.height})
        photos.sort(key=lambda p: -p["area"])
        if i in PHOTO_XREF:
            photos = [p for p in photos if p["xref"] == PHOTO_XREF[i]]
        pages.append({"page": i, "ref": ref, "price": price[0] if price else None, "squares": squares, "nphotos": len(photos),
                      "photo": photos[0] if photos and i not in NO_PHOTO else None,
                      "stamps": [{"rect": [round(v) for v in a.rect] if all(abs(v) < 1e6 for v in a.rect) else None,
                                  "author": a.info.get("title"), "modified": a.info.get("modDate")} for a in stamps]})
    return doc, pages


def families(pages):
    out = []
    for r in pages:
        p = f"pdf:{SRC_ID}#p{r['page']}"
        sec, name, withheld = ITEMS[r["page"]]
        cents = int(round(float(r["price"][1:]) * 100)) if r["price"] else None
        flags = []
        if cents is None:
            flags.append("NEEDS SHOP: no price on Ace's page; what does the shop sell it for?")
        if r["squares"] >= 5:
            flags.append("The colour squares on this page are Ace's standard row, not this item's colours: which colours does the shop have?")
        elif r["squares"]:
            flags.append(f"{r['squares']} colour squares on the page: which colours does the shop have?")
        if withheld:
            flags.append("The name carries another maker's brand: confirm it is genuine before naming it on the site")
        if r["page"] in NO_PHOTO:
            flags.append(NO_PHOTO[r["page"]])
        status, question = STAMP_QUESTIONS.get(r["page"], ("stamped" if r["stamps"] else "none", None))
        if question:
            flags.append("NEEDS SHOP: " + question)
        glass = sec == "bases" or r["page"] in (40, 72, 79)
        out.append({
            "family_id": f"acc-p{r['page']}",
            "page": r["page"],
            "category": sec,
            "name": cell(name, f"{RULE}; printed '{r['ref']}'"),
            "withheld_name": cell(withheld, RULE if withheld else None),
            "supplier_ref": cell(r["ref"], f"{p}:text"),
            "supplier_price_cents": cell(cents, f"{p}:text '{r['price']}'" if r["price"] else None),
            "price_basis": cell("unknown", "the catalogue does not say retail or wholesale"),
            "group": cell(sec, f"{RULE}"),
            "stamp": {"v": status, "src": f"{p}:stamp annotation" if r["stamps"] else f"{p}:no stamp annotation", "needs_shop": question is not None, "question": question,
                      "annotations": r["stamps"]},
            "facts": {"glass": cell(True, f"{p}:photo (glass piece)") if glass else cell(None, None),
                      "weight_g": cell(None, None), "size": cell(None, None)},
            "flags": flags,
            "photo_src": r["photo"],
        })
    return out
