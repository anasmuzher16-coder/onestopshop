"""Ace photo pipeline: the catalogue's own cut-outs, framed like every product on the site.

  python store/tools/catalog/photos.py [--pdf PATH] [--work DIR] [--publish]

Ace's photos are already cut out: nearly every embedded image carries its own soft mask. This script
extracts image + mask (no background removal, no AI upscaling here; a photo upscaled by hand and recorded in
suppliers/<supplier>/upscaled.json is kept as it is, status ready, while its files and source match), sorts each image into hero / colour / group /
kit / lifestyle, splits rows of colours at the gaps in the mask, frames each product at 720x900 (product
810 px tall, 45 px foot, centred; -m 540x675, -s 360x450; Lanczos only; WebP method 4) and flags anything
enlarged past 1.25x as CHECK. It writes a manifest (store/catalog/suppliers/ace/photos.json) and contact
sheets on coal and the six tile colours. --publish copies the finished site images to store/public/img/pc/ace/.
Run catalog.py build before (for SKUs) and after (to pull photos and colour names into the master).
"""
from __future__ import annotations

import argparse
import colorsys
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catlib as C  # noqa: E402
import src_ace  # noqa: E402

W, H, PROD_H, FOOT, MAXW = 720, 900, 810, 45, 630
SIZES = (("", (720, 900), 86), ("-m", (540, 675), 84), ("-s", (360, 450), 82))
CHECK_SCALE = 1.25   # plan: gentle resize up to 1.25x is fine; above it a person looks (CHECK)
HOLD_SCALE = 2.0     # design review 2026-11-24: 2.2x Techno shots showed JPEG blocks at 720 (status needs_original)
# Owner ruling 2026-11-24: blurry or over-enlarged photos (CHECK, held, hand-crop) still go up as the main photo, each with a
# small "Photo to be upscaled" label, so nothing sits without a picture while better originals are awaited.
SHOWN = ("ready", "CHECK", "needs_original", "hand_crop")
PUBLIC = C.STORE / "public" / "img" / "pc" / "ace"
FONTS = C.STORE / "public" / "fonts"


def oklch_to_rgb(L, Cc, h):
    import math
    a, b = Cc * math.cos(math.radians(h)), Cc * math.sin(math.radians(h))
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
           -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
           -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_)
    f = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055  # noqa: E731
    return tuple(max(0, min(255, round(f(c) * 255))) for c in lin)


def tokens():
    """Coal and the six category tiles, read from store/public/tokens.css (not retyped)."""
    import re
    css = (C.STORE / "public" / "tokens.css").read_text(encoding="utf-8")
    def tok(name):
        m = re.search(r"--%s:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)" % re.escape(name), css)
        return oklch_to_rgb(*map(float, m.groups()))
    names = [("coal", "coal-0"), ("ruby", "ruby"), ("teal", "teal"), ("cobalt", "cobalt"), ("ember", "emberlt"), ("emerald", "emerald"), ("gilt", "gilt")]
    return {k: tok(v) for k, v in names}, {"bone": tok("bone"), "ash": tok("ash"), "ember": tok("ember"), "line": tok("coal-2")}


# ------------------------------------------------------------------ extraction

def extract(doc, xref, smask):
    import pymupdf
    pix = pymupdf.Pixmap(doc, xref)
    if pix.n - pix.alpha >= 4:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[..., :3].copy()
    a = None
    if smask:
        m = pymupdf.Pixmap(doc, smask)
        a = np.frombuffer(m.samples, np.uint8).reshape(m.h, m.w, m.n)[..., 0].copy()
        if a.shape != rgb.shape[:2]:
            a = np.asarray(Image.fromarray(a).resize((pix.w, pix.h), Image.LANCZOS))
    return rgb, a


def runs_of(mask, min_gap=3, min_w=25):
    col = mask.any(0)
    xs = np.where(col)[0]
    if not len(xs):
        return []
    out, s, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - prev > min_gap:
            out.append((int(s), int(prev + 1)))
            s = x
        prev = x
    out.append((int(s), int(prev + 1)))
    return [r for r in out if r[1] - r[0] > min_w]


def bbox(mask):
    ys, xs = np.where(mask)
    return (int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)) if len(xs) else None


def colour_of(rgb, a):
    """A plain colour name for the product's body, from its own pixels. Always flagged for a person to confirm."""
    op = a > 200
    px = rgb[op].astype(float) / 255
    if len(px) < 50:
        return None, None
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px[:: max(1, len(px) // 6000)]])
    h, s, v = hsv[:, 0] * 360, hsv[:, 1], hsv[:, 2]
    sat = (s > 0.35) & (v > 0.25)
    mean = tuple(int(x) for x in (px.mean(0) * 255))
    if sat.mean() > 0.12:
        hs = h[sat]
        ang = np.deg2rad(hs)
        hue = (np.rad2deg(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) + 360) % 360
        ss, vv = float(np.median(s[sat])), float(np.median(v[sat]))
        rep = tuple(int(c * 255) for c in colorsys.hsv_to_rgb(hue / 360, ss, vv))
        if hue < 12 or hue >= 340:
            name = "red"
        elif hue < 38:
            name = "orange" if ss > 0.55 and vv > 0.55 else "bronze"
        elif hue < 65:
            name = "yellow" if ss > 0.62 and vv > 0.8 else "gold"
        elif hue < 160:
            name = "green"
        elif hue < 200:
            name = "teal"
        elif hue < 255:
            name = "blue"
        elif hue < 290:
            name = "purple"
        else:
            name = "pink"
        return name, rep
    vm, sm = float(np.median(v)), float(np.median(s))
    if vm < 0.3:
        return "black", mean
    if vm > 0.82 and sm < 0.12:
        return "white", mean
    return ("silver" if vm > 0.55 else "grey"), mean


def frame(rgba: Image.Image):
    bb = rgba.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    cut = rgba.crop(bb)
    s = min(PROD_H / cut.height, MAXW / cut.width)
    r = cut.resize((max(1, round(cut.width * s)), max(1, round(cut.height * s))), Image.LANCZOS)
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    c.alpha_composite(r, ((W - r.width) // 2, H - FOOT - r.height))
    return c, s, bb


def upscaled_kept(supplier: str, public: Path, pdf: Path) -> dict:
    """Photos re-made from a 4x upscale (store/catalog/suppliers/<supplier>/upscaled.json, owner 2026-11-27). One is kept,
    files and "ready" status, only while it came from this same PDF and every recorded file on disk still matches its hash;
    a rebuild never overwrites it. A dropped one is printed loudly: its row's img_lw must go back to NULL in the database,
    or the browser asks for a -l file that --publish has just deleted."""
    rec = C.load_json(C.SUPPLIERS / supplier / "upscaled.json", {}) or {}
    kept = {}
    src = C.sha256_file(pdf) if rec.get("images") else None
    for out, r in rec.get("images", {}).items():
        files = r.get("files") or {}
        same_src = r.get("source_sha256") in (None, src)
        if same_src and files and all((public / n).exists() and C.sha256_file(public / n) == h for n, h in files.items()):
            kept[out] = r
        else:
            print(f"WARNING: upscaled photo {out} ({r.get('sku')}) no longer matches upscaled.json "
                  f"({'new source PDF' if not same_src else 'files changed'}): it is rebuilt from the PDF and flagged again. "
                  f"Remove it from upscaled.json, and set img_lw = NULL for {r.get('sku')} in the database"
                  + (" (its -l file goes)." if r.get("lw") else "."))
    return kept


def apply_upscaled(it: dict, kept: dict):
    """Marks an image as its kept upscale when it is the same cut of the same Ace image (xref and crop unchanged)."""
    r = kept.get(it.get("out"))
    if r and r["xref"] == it.get("xref") and list(r["crop"]) == list(it.get("crop") or []) and it["status"] in ("CHECK", "needs_original"):
        it["note"] = f"{it['note']}; upscaled 4x ({r['method']}) {r['date']}, was {it['status']} {it['scale']}x"
        it["status"] = "ready"
        it["upscaled"] = sorted(r["files"])


def save_set(canvas: Image.Image, base: Path):
    base.parent.mkdir(parents=True, exist_ok=True)
    for suf, size, qual in SIZES:
        im = canvas if size == (W, H) else canvas.resize(size, Image.LANCZOS)
        im.save(base.with_name(base.name + suf + ".webp"), "WEBP", quality=qual, method=4)


# ------------------------------------------------------------------ classify and split

def classify(rgb, a):
    """-> (class, items) where items are (x0, x1, note) column ranges holding one product each."""
    if a is None:
        return "lifestyle", [], "no mask: photo on its own background"
    mask = a > 40
    if mask.mean() > 0.9:
        return "lifestyle", [], "mask covers the whole frame"
    bb = bbox(mask)
    fill = mask[bb[1]:bb[3], bb[0]:bb[2]].mean()
    # one item per connected piece of the mask (products in a row stand apart even when their hoses share columns)
    lab, k = nd.label(mask, structure=np.ones((3, 3)))
    if not k:
        return "kit", [], "nothing in the mask"
    objs = nd.find_objects(lab)
    total = mask.sum()
    info = []
    for n, sl in enumerate(objs, 1):
        piece = lab[sl] == n
        if piece.sum() < 0.005 * total:
            continue
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        # stems reaching the top of the piece: two or more means products touching each other
        top = np.where(piece.any(0), piece.argmax(0), h)
        high = top < 0.12 * h
        tops = [r for r in runs_of(high[None, :], min_gap=max(4, int(0.08 * h)), min_w=1)]
        info.append({"label": n, "x0": sl[1].start, "x1": sl[1].stop, "y0": sl[0].start, "h": h, "w": w,
                     "fill": float(piece.mean()), "tops": len(tops)})
    maxh = max(i["h"] for i in info)
    tall = [i for i in info if i["h"] >= 0.6 * maxh and i["h"] / i["w"] >= 1.0 and i["fill"] < 0.8]
    thin = [i for i in tall if i["w"] / i["h"] < 0.08]
    tall = [i for i in tall if i not in thin]
    if not tall:
        if thin:
            return "kit", [], "stem only, no base: a parts shot"
        return "kit", [], "packaging box" if fill > 0.8 else "accessory spread or packaging"
    items = []
    for i in sorted(tall, key=lambda i: i["x0"]):
        if i["tops"] >= 2:
            note = f"OVERLAP: {i['tops']} products touch in Ace's photo, needs a hand crop"
        elif len(tall) >= 2:
            note = "split from a row of colours at a gap in the mask"
        else:
            extra = len(info) - 1
            note = "single product" + (f", {extra} loose piece(s) left out" if extra else "")
        items.append((i["label"], note))
    if len(tall) == 1 and tall[0]["tops"] < 2 and tall[0]["w"] / tall[0]["h"] > 0.95:
        return "kit", [], "wide spread, not one standing product"
    return ("group" if len(tall) >= 2 or tall[0]["tops"] >= 2 else "colour"), (items, lab), f"{len(tall)} standing piece(s)"


# ------------------------------------------------------------------ matching photos to colour variants

def _lab(rgb):
    c = np.array(rgb, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    x, y, z = M @ c / np.array([0.95047, 1.0, 1.08883])
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116  # noqa: E731
    fx, fy, fz = f(x), f(y), f(z)
    return np.array([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])


def match(items, variants):
    """Greedy nearest pairs, photo colour vs the page's colour square. The square only steers the pairing;
    the name always comes from the photo. Returns {item_index: variant_key}."""
    pairs = []
    for i, it in enumerate(items):
        if not it.get("rgb"):
            continue
        for v in variants:
            hx = v["swatch_hex"]["v"]
            if not hx:
                continue
            sw = tuple(int(hx[k:k + 2], 16) for k in (1, 3, 5))
            pairs.append((float(np.linalg.norm(_lab(it["rgb"]) - _lab(sw))), i, v["key"]))
    pairs.sort()
    got, used = {}, set()
    for d, i, k in pairs:
        if i in got or k in used or d > 70:
            continue
        got[i] = k
        used.add(k)
    if len(variants) == 1 and not variants[0]["swatch_hex"]["v"] and items:
        best = min(range(len(items)), key=lambda i: items[i]["scale"])
        got = {best: variants[0]["key"]}
    return got


# ------------------------------------------------------------------ contact sheets

def contact_sheet(entries, bg, path: Path, title: str, pal, tile=240, cols=10):
    lal = ImageFont.truetype(str(FONTS / "lalezar-latin.woff2"), 44)
    rx = ImageFont.truetype(str(FONTS / "readex-latin.woff2"), 15)
    rxs = ImageFont.truetype(str(FONTS / "readex-latin.woff2"), 13)
    th = int(tile * 1.25)
    gut, cap, head, margin = 8, 62, 96, 32
    rows = max(1, -(-len(entries) // cols))
    S = Image.new("RGB", (margin * 2 + cols * tile + (cols - 1) * gut, head + rows * (th + cap + gut) + margin), pal["coal"])
    d = ImageDraw.Draw(S)
    d.text((margin, 24), title, font=lal, fill=pal["bone"])
    d.text((margin, 72), f"{len(entries)} images  ·  720x900 frame, product 810 px, 45 px foot  ·  CHECK = enlarged past 1.25x", font=rxs, fill=pal["ash"])
    for k, e in enumerate(entries):
        r, c = divmod(k, cols)
        x, y = margin + c * (tile + gut), head + r * (th + cap + gut)
        im = Image.open(e["file"]).convert("RGBA").resize((tile, th), Image.LANCZOS)
        t = Image.new("RGBA", (tile, th), bg + (255,))
        t.alpha_composite(im)
        S.paste(t.convert("RGB"), (x, y))
        lab = f"{e.get('sku') or 'no SKU'}  {e.get('colour') or ''}"
        d.text((x, y + th + 4), lab, font=rx, fill=pal["bone"])
        fname = (e.get("out") or "").split("/")[-1] or f"x{e['xref']}"
        d.text((x, y + th + 40), fname[:34], font=rxs, fill=pal["ash"])
        st = e["status"]
        col = pal["ember"] if st in ("CHECK", "hand_crop", "needs_original") else pal["ash"]
        # status as data: a word plus a drawn glyph (the UI font has no geometric shapes)
        gx, gy, g = x + 1, y + th + 26, 8
        if st == "ready":
            d.rectangle((gx, gy, gx + g, gy + g), fill=col)
        elif st == "CHECK":
            d.polygon([(gx, gy + g), (gx + g // 2, gy), (gx + g, gy + g)], fill=col)
        elif st == "hand_crop":
            d.rectangle((gx, gy, gx + g, gy + g), outline=col, width=2)
        else:
            d.ellipse((gx, gy, gx + g, gy + g), outline=col, width=2)
        word = {"ready": "ready", "CHECK": f"CHECK {e['scale']:.2f}x", "hand_crop": "hand crop", "gallery_only": "gallery only", "needs_original": f"held {e['scale']:.2f}x"}.get(st, st)
        d.text((x + 14, y + th + 22), f"{word}   p{e['page']}", font=rxs, fill=col)
    path.parent.mkdir(parents=True, exist_ok=True)
    S.save(path, quality=86)
    return path


# ------------------------------------------------------------------ main

def run(pdf: Path, work: Path, publish: bool):
    master = C.load_master("ace")
    if not master:
        raise SystemExit("Run catalog.py build first: the Ace master is missing.")
    fams = {f["page"]: f for f in master["families"]}
    doc, pages = src_ace.read_pdf(pdf)
    order = sorted(pages, key=lambda r: (fams[r["page"]]["stamp"]["v"] == "none", r["page"]))
    raw = work / "raw"
    framed = work / "framed"
    raw.mkdir(parents=True, exist_ok=True)
    framed.mkdir(parents=True, exist_ok=True)
    smask_of = {}
    for pg in doc:
        for im in pg.get_images(full=True):
            smask_of[im[0]] = im[1]
    overrides = C.load_json(C.SUPPLIERS / "ace" / "photo-overrides.json", {}).get("images", {})
    kept = upscaled_kept("ace", PUBLIC, pdf)
    images = []
    for r in order:
        f = fams[r["page"]]
        items = []
        for im in r["images"]:
            xref = im["xref"]
            rgb, a = extract(doc, xref, smask_of.get(xref, 0))
            if a is not None:
                Image.fromarray(np.dstack([rgb, a]), "RGBA").save(raw / f"p{r['page']:02d}_x{xref}.png")
            else:
                Image.fromarray(rgb, "RGB").save(raw / f"p{r['page']:02d}_x{xref}.png")
            cls, cuts, why = classify(rgb, a)
            ov = overrides.get(f"p{r['page']}-x{xref}")
            if ov and ov.get("role") == "gallery":
                cls, cuts, why = ov.get("class", "lifestyle"), [], "person checked: " + ov["why"]
            if not cuts:
                rec = {"page": r["page"], "xref": xref, "family_id": f["family_id"], "class": cls, "note": why,
                       "src_px": [int(rgb.shape[1]), int(rgb.shape[0])], "status": "gallery_only", "role": "gallery"}
                if a is not None or cls == "lifestyle":
                    rgba = Image.fromarray(np.dstack([rgb, a if a is not None else np.full(rgb.shape[:2], 255, np.uint8)]), "RGBA")
                    cv, s, bb = frame(rgba)
                    tmp = framed / f"{f['family_id']}-p{r['page']}-x{xref}-gallery"
                    save_set(cv, tmp)
                    rec.update({"crop": list(bb), "scale": round(s, 3), "file": str(tmp) + "-s.webp"})
                images.append(rec)
                continue
            pieces, lab = cuts
            for n, (label, note) in enumerate(pieces):
                # the piece itself plus its soft edge (2 px), nothing from its neighbours
                keep = nd.binary_dilation(lab == label, iterations=2)
                sub_a = np.where(keep, a, 0).astype(np.uint8)
                rgba = Image.fromarray(np.dstack([rgb, sub_a]), "RGBA")
                cv, s, bb = frame(rgba)
                # colour from the upper body (stem, crown), not the base: many families share one clear base
                hh = bb[3] - bb[1]
                y0, y1 = bb[1] + int(0.05 * hh), bb[1] + int(0.62 * hh)
                name, rep = colour_of(rgb[y0:y1, bb[0]:bb[2]], sub_a[y0:y1, bb[0]:bb[2]])
                status = "hand_crop" if note.startswith("OVERLAP") else ("CHECK" if s > CHECK_SCALE else "ready")
                pov = overrides.get(f"p{r['page']}-x{xref}-{n}") or ov
                if pov and pov.get("role") == "hand_crop":
                    status, note = "hand_crop", "person checked: " + pov["why"]
                elif pov and pov.get("role") == "gallery":
                    status, note = "gallery_only", "person checked: " + pov["why"]
                elif pov and pov.get("role") == "check":
                    status, note = "CHECK", "person checked: " + pov["why"]
                if status in ("ready", "CHECK") and s > HOLD_SCALE:
                    # too far from the source to look right on the site (review 2026-11-24): held until Ace sends originals
                    status, note = "needs_original", f"enlarged {s:.2f}x from a small source: needs Ace's original"
                tmp = framed / f"{f['family_id']}-p{r['page']}-x{xref}-{n}"
                save_set(cv, tmp)
                items.append({"page": r["page"], "xref": xref, "family_id": f["family_id"], "class": cls, "note": note,
                              "src_px": [int(rgb.shape[1]), int(rgb.shape[0])], "crop": list(bb), "scale": round(s, 3),
                              "colour": name, "rgb": list(rep) if rep else None, "status": status, "tmp": str(tmp)})
        # pair colour photos with the page's colour variants. Held (enlarged past 2x) and hand-crop images go up too, as the
        # main photo with "Photo to be upscaled" (owner, 2026-11-24); the family's hero prefers a clean one when it has one.
        usable = [it for it in items if it["status"] in SHOWN]
        got = match(usable, f["variants"])
        key_to_sku = {v["key"]: v["sku"] for v in f["variants"]}
        names_used = {}
        hero = min(usable, key=lambda it: (it["status"] not in ("ready", "CHECK"), it["class"] != "colour", it["scale"])) if usable else None
        for i, it in enumerate(usable):
            k = got.get(i)
            it["variant_key"] = k
            it["sku"] = key_to_sku.get(k)
            it["role"] = "hero" if it is hero else ("colour" if k else "unmatched")
        for it in items:
            if it["status"] == "gallery_only":
                it["role"] = "gallery"
                it["variant_key"] = it["sku"] = None
            cname = it.get("colour") or "x"
            base = f"{f['family_id']}-{cname}"
            names_used[base] = names_used.get(base, 0) + 1
            out = base if names_used[base] == 1 else f"{base}-{names_used[base]}"
            it["out"] = f"ace/{out}"
            it["file"] = it["tmp"] + "-s.webp"
            apply_upscaled(it, kept)   # after roles are set, so an upscale never reshuffles which photo is the hero
            images.append(it)
    # publish: only the images a product row will show (matched to a colour, or the family's hero)
    shipped = [im for im in images if im.get("status") in SHOWN and im.get("role") in ("hero", "colour")]
    if publish:
        PUBLIC.mkdir(parents=True, exist_ok=True)
        want = set()
        for im in shipped:
            if im.get("upscaled"):   # its upscaled files (with the 1440 -l) stay exactly as they are
                want.update(im["upscaled"])
                continue
            for suf, _, _ in SIZES:
                src = Path(im["tmp"] + suf + ".webp")
                dst = PUBLIC / (im["out"].split("/", 1)[1] + suf + ".webp")
                want.add(dst.name)
                if not dst.exists() or dst.read_bytes() != src.read_bytes():
                    shutil.copyfile(src, dst)
        for old in PUBLIC.glob("*.webp"):
            if old.name not in want:
                old.unlink()
    manifest = {"schema": "oss-photos/1", "source": master["sources"][0],
                "frame": {"w": W, "h": H, "product_h": PROD_H, "foot": FOOT, "max_w": MAXW, "resample": "Lanczos",
                          "webp_method": 4, "check_above_scale": CHECK_SCALE, "ai_upscaling": False},
                "published_dir": "store/public/img/pc/ace", "images": []}
    for im in images:
        manifest["images"].append({k: im.get(k) for k in ("page", "xref", "family_id", "class", "role", "crop", "src_px", "scale",
                                                          "colour", "rgb", "variant_key", "sku", "status", "out", "note")})
    C.write_json(C.SUPPLIERS / "ace" / "photos.json", manifest)
    # contact sheets
    pal_bg, pal = tokens()
    pal["coal"] = pal_bg["coal"]
    stamped_pages = {p for p, f in fams.items() if f["stamp"]["v"] != "none"}
    st = [im for im in images if im["page"] in stamped_pages and im.get("file")]
    sheets = work / "sheets"
    made = []
    for name, rgbv in pal_bg.items():
        ship_st = [im for im in st if im.get("role") in ("hero", "colour")]
        made.append(contact_sheet(ship_st, rgbv, sheets / f"ace-stamped-site-{name}.jpg", f"Ace, ticked products, site images on {name}", pal))
    made.append(contact_sheet(st, pal_bg["coal"], sheets / "ace-stamped-all-coal.jpg", "Ace, ticked products, every image (tag check)", pal))
    rest = [im for im in images if im["page"] not in stamped_pages and im.get("file")]
    made.append(contact_sheet(rest, pal_bg["coal"], sheets / "ace-unticked-all-coal.jpg", "Ace, other products, every image", pal, cols=14, tile=180))
    counts = {}
    for im in images:
        counts[im["status"]] = counts.get(im["status"], 0) + 1
    print(json.dumps({"images": len(images), "by_status": counts, "published_sets": len(shipped),
                      "roles": {r: sum(1 for im in images if im.get("role") == r) for r in ("hero", "colour", "unmatched", "hand_crop", "gallery")},
                      "sheets": [str(p) for p in made]}, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default=str(C.ACE_PDF))
    ap.add_argument("--work", default=str(C.OUT / "ace-photo-work"))
    ap.add_argument("--publish", action="store_true")
    a = ap.parse_args()
    run(Path(a.pdf), Path(a.work), a.publish)
