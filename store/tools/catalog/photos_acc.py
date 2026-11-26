"""Ace accessories photos: the catalogue's own cut-outs, framed like every product on the site (photos.py rules).

  python store/tools/catalog/photos_acc.py [--pdf PATH] [--work DIR] [--publish]

One photo per ticked page: the page's cut-out with its own soft mask (no background removal, no AI upscaling). A group
shot (rope bowls, D-61, silicone and ice cream bowls, brushes, connectors) stays one photo of the group. Loose specks under
1% of the mask (a stray watermark, a fleck) are left out. Framed at 720x900 (product 810 px tall, 45 px foot, centred;
-m and -s), status by enlargement: ready up to 1.25x, CHECK past it, needs_original past 2x (both go up labelled
"Photo to be upscaled", owner 2026-11-24). Writes store/catalog/suppliers/ace-acc/photos.json and a contact sheet;
--publish copies the site images to store/public/img/pc/acc/.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catlib as C  # noqa: E402
import photos as P  # noqa: E402
import src_ace_acc as S  # noqa: E402

PUBLIC = C.STORE / "public" / "img" / "pc" / "acc"
# Smaller than a hookah's 810 x 630: accessories are wide or squat, so a full-size one ran under the Price TBD sticker
# (top right) and the "Photo to be upscaled" label (bottom, two lines on a phone) (design review, 2026-11-26). 580 x 560,
# centred, leaves 160 px (18%) clear above and below: measured on the 390 WebKit grid, the sticker reaches 15% down the
# tile and the two-line label 17% up.
PROD_H, MAXW = 580, 560


def clean(a, largest_only=False):
    """Drop loose specks: pieces under 1% of the mask (a watermark, a fleck). Every real piece of a group shot stays.
    largest_only keeps just the biggest piece (a page whose cut-out carries someone else's signature)."""
    mask = a > 40
    lab, k = nd.label(mask, structure=np.ones((3, 3)))
    if k <= 1:
        return a, 0
    sizes = nd.sum(mask, lab, range(1, k + 1))
    if largest_only:
        big = int(np.argmax(sizes)) + 1
        keep = nd.binary_dilation(lab == big, iterations=2)
        return np.where(keep, a, 0).astype(np.uint8), k - 1
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 0.01 * mask.sum()])
    keep = nd.binary_dilation(keep, iterations=2)
    return np.where(keep, a, 0).astype(np.uint8), int((sizes < 0.01 * mask.sum()).sum())


def frame(rgba: Image.Image):
    """photos.py's frame (product up to 810 px tall or 630 px wide, Lanczos), centred both ways. A tall piece lands exactly
    where photos.py puts it (45 px foot); a wide, low one (a tray, a row of bowls, a mouthpiece) sits in the middle of the
    tile instead of on its floor with an empty top (owner, 2026-11-26: tight and centred)."""
    bb = rgba.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    cut = rgba.crop(bb)
    s = min(PROD_H / cut.height, MAXW / cut.width)
    r = cut.resize((max(1, round(cut.width * s)), max(1, round(cut.height * s))), Image.LANCZOS)
    c = Image.new("RGBA", (P.W, P.H), (0, 0, 0, 0))
    c.alpha_composite(r, ((P.W - r.width) // 2, (P.H - r.height) // 2))
    return c, s, bb


def run(pdf: Path, work: Path, publish: bool):
    doc, pages = S.read_pdf(pdf)
    framed = work / "framed"
    framed.mkdir(parents=True, exist_ok=True)
    images = []
    for r in pages:
        fid = f"acc-p{r['page']}"
        ph = r["photo"]
        if not ph or r["page"] in S.HOLD_PHOTO:
            images.append({"page": r["page"], "family_id": fid, "status": "none", "out": None,
                           "note": S.HOLD_PHOTO.get(r["page"]) or S.NO_PHOTO.get(r["page"], "no cut-out on the page")})
            continue
        rgb, a = P.extract(doc, ph["xref"], ph["smask"])
        a = np.where(a < 16, 0, a).astype(np.uint8)   # Ace's masks keep a near-invisible box around the product: flattened, so no tile ever shows it
        a, dropped = clean(a, r["page"] in S.KEEP_LARGEST)
        if r["page"] in S.KEEP_PART:   # a hand crop: the pieces of the mask whose middle sits in this part (the product, not its box)
            x0, y0, x1, y1 = S.KEEP_PART[r["page"]]
            lab, k = nd.label(a > 40, structure=np.ones((3, 3)))
            hh, ww = a.shape
            cms = nd.center_of_mass(a > 40, lab, range(1, k + 1))
            ids = [i + 1 for i, (cy, cx) in enumerate(cms) if x0 <= cx / ww <= x1 and y0 <= cy / hh <= y1]
            a = np.where(nd.binary_dilation(np.isin(lab, ids), iterations=2), a, 0).astype(np.uint8)
        if r["page"] in S.DROP_PART:   # a box touching the product: its own rectangle goes
            hh, ww = a.shape
            a = a.copy()
            for x0, y0, x1, y1, what in S.DROP_PART[r["page"]]:
                ys, xs = slice(int(y0 * hh), int(y1 * hh)), slice(int(x0 * ww), int(x1 * ww))
                if what == "light":   # only the light pixels (the white box), never the dark product beside it
                    a[ys, xs] = np.where(rgb[ys, xs].mean(-1) > 75, 0, a[ys, xs])
                else:
                    a[ys, xs] = 0
            a, _ = clean(a, True)   # what is left of the box is loose now: only the product (its biggest piece) stays
        cv, s, bb = frame(Image.fromarray(np.dstack([rgb, a]), "RGBA"))
        status = "ready" if s <= P.CHECK_SCALE else ("CHECK" if s <= P.HOLD_SCALE else "needs_original")
        note = "single cut-out" + (f", {dropped} loose speck(s) left out" if dropped else "")
        if status == "needs_original":
            note += f"; enlarged {s:.2f}x from a small source: needs Ace's original"
        tmp = framed / fid
        P.save_set(cv, tmp)
        images.append({"page": r["page"], "family_id": fid, "xref": ph["xref"], "src_px": [int(rgb.shape[1]), int(rgb.shape[0])],
                       "crop": list(bb), "scale": round(s, 3), "status": status, "out": f"acc/{fid}", "note": note,
                       "tmp": str(tmp), "file": str(tmp) + "-s.webp"})
    if publish:
        PUBLIC.mkdir(parents=True, exist_ok=True)
        want = set()
        for im in images:
            if not im.get("tmp"):
                continue
            for suf, _, _ in P.SIZES:
                src = Path(im["tmp"] + suf + ".webp")
                dst = PUBLIC / (im["out"].split("/", 1)[1] + suf + ".webp")
                want.add(dst.name)
                if not dst.exists() or dst.read_bytes() != src.read_bytes():
                    shutil.copyfile(src, dst)
        for old in PUBLIC.glob("*.webp"):
            if old.name not in want:
                old.unlink()
    manifest = {"schema": "oss-photos/1", "source": {"id": S.SRC_ID, "file": pdf.name, "sha256": C.sha256_file(pdf)},
                "frame": {"w": P.W, "h": P.H, "product_h": P.PROD_H, "foot": P.FOOT, "max_w": P.MAXW, "resample": "Lanczos",
                          "webp_method": 4, "check_above_scale": P.CHECK_SCALE, "hold_above_scale": P.HOLD_SCALE, "ai_upscaling": False},
                "published_dir": "store/public/img/pc/acc",
                "images": [{k: im.get(k) for k in ("page", "family_id", "xref", "src_px", "crop", "scale", "status", "out", "note")} for im in images]}
    C.write_json(C.SUPPLIERS / "ace-acc" / "photos.json", manifest)
    pal_bg, pal = P.tokens()
    pal["coal"] = pal_bg["coal"]
    shown = [dict(im, sku=im["family_id"], colour="") for im in images if im.get("file")]
    sheets = work / "sheets"
    made = [P.contact_sheet(shown, pal_bg[n], sheets / f"acc-site-{n}.jpg", f"Ace accessories, ticked, site images on {n}", pal, cols=8)
            for n in ("coal", "cobalt", "ember", "teal", "gilt", "emerald")]
    counts = {}
    for im in images:
        counts[im["status"]] = counts.get(im["status"], 0) + 1
    print(json.dumps({"images": len(images), "by_status": counts, "sheets": [str(p) for p in made]}, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default=str(C.ACE_ACC_PDF))
    ap.add_argument("--work", default=str(C.OUT / "acc-photo-work"))
    ap.add_argument("--publish", action="store_true")
    a = ap.parse_args()
    run(Path(a.pdf), Path(a.work), a.publish)
