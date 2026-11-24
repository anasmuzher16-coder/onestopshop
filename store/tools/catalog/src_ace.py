"""Ace Hookah catalogue (PDF) -> families and variants. Read-only on the PDF.

Facts measured from the October 2026 edition (sha256 569b9fe0...): 84 pages, page 1 is the cover, pages 2-84
carry one product each (83 products). The shop's ticks are Stamp annotations on 26 pages.
"""
from __future__ import annotations

import hashlib
import re
from collections import Counter, defaultdict

from catlib import cell, slug

SRC_ID = "ace-2026-10"
EDITION = "October 2026"
RECEIVED = "2026-11-23"

# What the shop must still tell us about its ticks (checked by eye on the rendered pages, 2026-11-24).
STAMP_QUESTIONS = {
    16: ("unclear", "The tick on this page has no position (it does not show on the page). Is EGY-XME3 in stock?"),
    33: ("unclear", "The mark on this page is a long stroke, not a clear tick. Is D-207 Connoisseur in stock?"),
    26: ("stamped", "A small second tick sits on the box photo. Does it mean only that colour or the box set?"),
    36: ("stamped", "A small second tick sits beside the purple gun. Is only that colour in stock?"),
    57: ("stamped", "A small second tick sits on the yellow train. Is only yellow in stock?"),
}
THIRD_PARTY = ("DARKSIDE", "ALPHA", "MATTPEAR", "TSAR", "NA GRANI", "MAKLAUD", "MAKLOUD", "EL BOMBER", "ELBOMBER",
               "AMOTION", "DOSHA", "MISHA", "CHAOS", "ELEMENTS", "YOTO", "YOUTO")
SPECIAL_BADGE = "49964871"   # md5 prefix of the "SPECIAL" badge image that Ace puts on 10 pages


def _ov(a, b):
    return not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])


def read_pdf(path):
    import pymupdf
    doc = pymupdf.open(str(path))
    raw_md5 = {}
    use = Counter()
    for pg in doc:
        for im in pg.get_images(full=True):
            x = im[0]
            if x not in raw_md5:
                raw_md5[x] = hashlib.md5(doc.xref_stream_raw(x) or b"").hexdigest()
            use[raw_md5[x]] += 1
    pages = []
    for i, pg in enumerate(doc, 1):
        if i == 1:
            continue
        lines = []
        for b in pg.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                t = "".join(s["text"] for s in ln["spans"]).strip()
                if t and "ACE IT" not in t and t not in ("ACE HOOKAH", "ACE COLLECTION") and not t.endswith(":"):
                    lines.append((t, ln["bbox"]))
        price = [t for t, _ in lines if re.fullmatch(r"\$\d+(\.\d\d)?", t)]
        notes = [t for t, _ in lines if t.lower() in ("without base", "80 cm")]
        ref = re.sub(r"\s+", " ", " ".join(t for t, _ in lines if t not in price and t not in notes)).strip()
        byrect = defaultdict(list)
        for d in pg.get_drawings():
            r = d["rect"]
            if d.get("fill") is not None and 50 < r.width < 160 and 50 < r.height < 160 and abs(r.width - r.height) < 20:
                byrect[(round(r.x0 / 10), round(r.y0 / 10))].append((tuple(round(c * 255) for c in d["fill"]), [round(v) for v in r]))
        sw = []
        for _, v in sorted(byrect.items()):
            nonblack = [c for c, _ in v if c != (0, 0, 0)]
            c = nonblack[0] if nonblack else (0, 0, 0)
            sw.append({"hex": "#%02x%02x%02x" % c, "rect": v[0][1]})
        imgs = []
        special = False
        for im in pg.get_images(full=True):
            h = raw_md5[im[0]]
            if h.startswith(SPECIAL_BADGE):
                special = True
            if use[h] > 3:
                continue
            imgs.append({"xref": im[0], "w": im[2], "h": im[3], "smask": bool(im[1])})
        stamps = []
        for a in pg.annots() or []:
            if a.type[1] != "Stamp":
                continue
            r = [round(v) for v in a.rect]
            stamps.append({"rect": r if all(abs(v) < 1e6 for v in r) else None,
                           "author": a.info.get("title"), "modified": a.info.get("modDate")})
        pages.append({"page": i, "ref": ref, "price": price[0] if price else None, "notes": notes,
                      "swatches": sw, "images": imgs, "stamps": stamps, "special": special})
    return doc, pages


def group_for(ref, price_cents, tags):
    u = ref.upper()
    if "without_base" in tags:
        return "stem_set", "rule v1: the page says 'without base'"
    if "acrylic" in tags or any(w in u for w in ("MINI", "CAR HOOKAH", "BABY", "UFO")) or (price_cents is not None and price_cents <= 3000):
        return "compact_travel", "rule v1: acrylic, mini/car/baby/UFO in the name, or a small piece"
    if any(w in u for w in ("GUN", "BASEBALL", "ROSE", "CONNOISSEUR", "MAKLAUD", "MAKLOUD", "GRAVITY", "DRAGON", "SCORPION")) \
            or (price_cents is not None and price_cents >= 15000):
        return "statement", "rule v1: a sculptural or top-end piece"
    return "full_size", "rule v1: default"


def families(pages):
    out = []
    for r in pages:
        p = f"pdf:{SRC_ID}#p{r['page']}"
        ref = r["ref"]
        low = ref.lower()
        tags = []
        if any(n.lower() == "without base" for n in r["notes"]):
            tags.append("without_base")
        if "with base" in low:
            tags.append("with_base")
        if "acrylic" in low:
            tags.append("acrylic")
        cents = int(round(float(r["price"][1:]) * 100)) if r["price"] else None
        s = slug(re.sub(r"(?i)with base|hookah", " ", ref))
        fid = ("ace-" + s.removeprefix("ace-")) if s else f"ace-p{r['page']}"
        flags = []
        if cents is None:
            flags.append("NO PRICE ON THE PAGE")
        if not r["swatches"]:
            flags.append("NO COLOUR SQUARES ON THE PAGE")
        if r["special"]:
            flags.append("Ace marks this page SPECIAL: meaning unknown, ask the shop")
        if any(b in ref.upper() for b in THIRD_PARTY):
            flags.append("The name carries another brand's name: confirm it is genuine before naming it on the site")
        if r["stamps"]:
            status, question = STAMP_QUESTIONS.get(r["page"], ("stamped", None))
        else:
            status, question = "none", None
        stamp = {"v": status, "src": f"{p}:stamp annotation" if r["stamps"] else f"{p}:no stamp annotation",
                 "needs_shop": question is not None, "question": question,
                 "annotations": r["stamps"]}
        if question:
            flags.append("NEEDS SHOP: " + question)
        g, gsrc = group_for(ref, cents, tags)
        facts = {
            "includes_base": cell(False, f"{p}:text 'without base'") if "without_base" in tags else
            (cell(True, f"{p}:name 'with base'") if "with_base" in tags else cell(None, None)),
            "includes": cell([x for x, w in (("briefcase", "briefcase"), ("bag", "with bag")) if w in low] or None,
                             f"{p}:name" if ("briefcase" in low or "with bag" in low) else None),
            "height_cm": cell(80, f"{p}:text '80 CM'") if any("cm" in n.lower() for n in r["notes"]) else cell(None, None),
            "acrylic": cell(True, f"{p}:name") if "acrylic" in tags else cell(None, None),
            "weight_g": cell(None, None),
        }
        out.append({
            "family_id": fid,
            "page": r["page"],
            "supplier_ref": cell(ref, f"{p}:text"),
            "supplier_price_cents": cell(cents, f"{p}:text '{r['price']}'" if r["price"] else None),
            "price_basis": cell("unknown", "the catalogue does not say retail or wholesale"),
            "group": cell(g, gsrc + ", confirm"),
            "stamp": stamp,
            "facts": facts,
            "flags": flags,
            "swatches": r["swatches"],
            "images": r["images"],
        })
    seen = Counter(f["family_id"] for f in out)
    for f in out:
        if seen[f["family_id"]] > 1:
            f["family_id"] += f"-p{f['page']}"
    return out
