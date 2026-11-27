"""Cut the shop's bowls off the plain white sweep they were photographed on, framed like the site's accessories.

  python store/tools/catalog/cut_sweep.py FULL_DIR OUT_DIR [--specs specs.json] IMG_0608 IMG_0611 ...
  python store/tools/catalog/photos_shop_bowls.py OUT_DIR       then, to publish the web sizes

FULL_DIR holds the shop's photos as upright JPEGs (the iPhone HEICs converted with ffmpeg, orientation kept). Needs numpy,
scipy, Pillow and OpenCV (pip install opencv-python-headless); no background-removal model, nothing downloaded.

Method:
1. background plate: the sweep either side of the bowl, row by row; then re-estimated by inpainting the sweep over the
   (grown) bowl, so the slanted line where wall meets table is carried across instead of read as product;
2. first mask: colour distance to the plate, with cast shadows (a colourless darkening of the plate) kept out; the
   biggest piece plus pieces touching it or stacked straight above or below it (a stem cut off by a pale neck band);
3. OpenCV GrabCut seeded from it (definite product = the eroded first mask, definite background = pixels on the plate),
   worked in a window round the bowl; pieces kept as in step 2;
4. clean-up in a thin band inside the outline: sweep-coloured or shadow pixels that connect to the open background go
   (the grey crescent at a foot, the sweep showing between a swing tag and the body); holes are filled only where
   they are not the sweep (twine loops stay open);
5. edge feathered about 1 px and its colour un-mixed from the plate, so no white rim is left on a dark tile;
6. framed per photos_acc.py: 720x900, product up to 580 tall / 560 wide, centred both ways; -m 540x675, -s 360x450,
   and -l 1440x1800 only when the bowl is at least 1100 px tall in the source photo; WebP, method 4.
Every cut was checked by eye on coal, bone and cobalt tiles; bowls it could not cut cleanly were left out
(src_shop_bowls.py says which and why).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as nd

W, H = 720, 900
SIZES = (("-l", (1440, 1800), 86), ("", (720, 900), 86), ("-m", (540, 675), 84), ("-s", (360, 450), 82))


def plate(I, x0f=0.10, x1f=0.90):
    h, w = I.shape[:2]
    a, b = int(w * x0f), int(w * x1f)
    L = nd.median_filter(np.median(I[:, : max(4, a)], 1), size=(31, 1))
    R = nd.median_filter(np.median(I[:, min(w - 4, b):], 1), size=(31, 1))
    t = np.linspace(0, 1, w)[None, :, None]
    return L[:, None, :] * (1 - t) + R[:, None, :] * t


def pieces(lab, sizes, main, h, frac, stack):
    """Labels to keep: pieces of at least frac of the biggest that touch the main piece or sit straight above/below it."""
    near = nd.binary_dilation(main, iterations=6)
    ys, xs = np.where(main)
    mx0, mx1, my0, my1 = xs.min(), xs.max(), ys.min(), ys.max()
    out = []
    for i, sl in enumerate(nd.find_objects(lab)):
        if sizes[i] < frac * sizes.max():
            continue
        cx = (sl[1].start + sl[1].stop) / 2
        stacked = mx0 <= cx <= mx1 and (sl[0].start - my1 < 0.12 * h) and (my0 - sl[0].stop < 0.12 * h)
        if (near[sl] & (lab[sl] == i + 1)).any() or (stack and stacked):
            out.append(i + 1)
    return out


def biggest_and_kin(fg, h, frac=0.02, stack=True):
    lab, k = nd.label(fg)
    if not k:
        return fg
    sizes = nd.sum(fg, lab, range(1, k + 1))
    main = lab == (int(np.argmax(sizes)) + 1)
    return np.isin(lab, pieces(lab, sizes, main, h, frac, stack))


def cut(path: Path, spec: dict):
    im = Image.open(path).convert("RGB")
    s = spec.get("scale", 0.75)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    I = np.asarray(im).astype(np.float32)
    h, w = I.shape[:2]

    def measure(B):
        D = np.sqrt(((I - B) ** 2).sum(-1))
        dI, dB = I - I.mean(-1, keepdims=True), B - B.mean(-1, keepdims=True)
        chroma = np.sqrt(((dI - dB) ** 2).sum(-1))
        drop = B.mean(-1) - I.mean(-1)
        shadow = (drop > 0) & (chroma < spec.get("shadow_chroma", 16)) & (drop < spec.get("shadow_drop", 100))
        cand = nd.binary_opening(((D > spec.get("d", 45)) & ~shadow) | (chroma > spec.get("c", 30)), iterations=2)
        lab, k = nd.label(cand)
        if not k:
            raise SystemExit(f"{path.name}: nothing found")
        sizes = nd.sum(cand, lab, range(1, k + 1))
        main = lab == (int(np.argmax(sizes)) + 1)
        seed = np.isin(lab, pieces(lab, sizes, nd.binary_dilation(main, iterations=int(0.015 * w)), h, spec.get("seed_frac", 0.04), True))
        anyc = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= 0.01 * sizes.max()])
        return D, chroma, drop, shadow, seed, anyc

    D, chroma, drop, shadow, big, anyc = measure(plate(I, *spec.get("plate", (0.10, 0.90))))
    q = 4
    small = cv2.resize(I.astype(np.uint8), (w // q, h // q), interpolation=cv2.INTER_AREA)
    grow = nd.binary_fill_holes(anyc) & (np.abs(np.arange(w)[None, :] - w / 2) < 0.42 * w)
    hole = cv2.resize(nd.binary_dilation(grow, iterations=int(0.03 * w)).astype(np.uint8), (w // q, h // q), interpolation=cv2.INTER_NEAREST)
    Bs = cv2.GaussianBlur(cv2.inpaint(small, hole, 25, cv2.INPAINT_TELEA), (0, 0), 3)
    D, chroma, drop, shadow, big, anyc = measure(cv2.resize(Bs, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32))
    B = cv2.resize(Bs, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32)
    ys, xs = np.where(big)
    pad = int(0.04 * w)
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(w, xs.max() + pad), max(0, ys.min() - pad), min(h, ys.max() + pad)
    mg = int(0.06 * w)
    cx0, cy0, cx1, cy1 = max(0, x0 - mg), max(0, y0 - mg), min(w, x1 + mg), min(h, y1 + mg)
    I, B, D, chroma, drop, shadow, big = (a[cy0:cy1, cx0:cx1] for a in (I, B, D, chroma, drop, shadow, big))
    x0, x1, y0, y1 = x0 - cx0, x1 - cx0, y0 - cy0, y1 - cy0
    h, w = I.shape[:2]
    m = np.full((h, w), cv2.GC_BGD, np.uint8)
    m[y0:y1, x0:x1] = cv2.GC_PR_BGD
    inside = np.zeros((h, w), bool); inside[y0:y1, x0:x1] = True
    blob = nd.binary_fill_holes(nd.binary_closing(big, iterations=6)) & inside
    core = nd.binary_erosion(blob, iterations=spec.get("core", 14))
    m[blob] = cv2.GC_PR_FGD
    m[core] = cv2.GC_FGD
    m[inside & (D < 10) & ~blob] = cv2.GC_BGD
    m[inside & shadow & ~core & ~blob] = cv2.GC_PR_BGD
    bgm, fgm = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(np.ascontiguousarray(I.astype(np.uint8)[..., ::-1]), m, None, bgm, fgm, spec.get("iters", 6), cv2.GC_INIT_WITH_MASK)
    fg = nd.binary_opening((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD), iterations=2)
    fg = biggest_and_kin(fg, h, spec.get("keep_frac", 0.04))
    if spec.get("kill_green"):   # a green bowl behind peeks out beside a blue one (IMG_0641): green is never that bowl
        fg &= ~((I[..., 1] > I[..., 2] + 15) & (I[..., 1] > I[..., 0] + 15))
    rim = fg & ~nd.binary_erosion(fg, iterations=spec.get("rim_band", 14))
    pl = rim & ((D < spec.get("rim_d", 24)) | ((drop > 0) & (drop < 80) & (chroma < 13)))
    rl, _ = nd.label(pl | ~fg)
    out_ids = np.unique(rl[~fg])
    fg &= ~(np.isin(rl, out_ids[out_ids > 0]) & pl)
    fg = biggest_and_kin(nd.binary_opening(fg, iterations=2), h, 0.02, stack=False)
    hl, hk = nd.label(nd.binary_fill_holes(fg) & ~fg)
    for i in range(1, hk + 1):
        z = hl == i
        if np.median(D[z]) > 25:
            fg |= z
    a = np.clip((nd.gaussian_filter(fg.astype(np.float32), spec.get("feather", 1.0)) - 0.5) * 1.6 + 0.5, 0, 1)
    aa = np.maximum(a[..., None], 1e-3)
    C = np.where(a[..., None] < 0.999, np.clip((I - (1 - aa) * B) / aa, 0, 255), I)
    rgba = np.dstack([C, a * 255]).astype(np.uint8)
    rgba[a < 0.02] = 0
    return Image.fromarray(rgba, "RGBA"), s


def save_set(rgba, out: Path, name, src_scale, prod_h=580, maxw=560):
    bb = rgba.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    piece = rgba.crop(bb)
    src_h = piece.height / src_scale
    made = []
    for suf, (cw, ch), qual in SIZES:
        if suf == "-l" and src_h < 1100:
            continue
        k = cw / W
        sc = min(prod_h * k / piece.height, maxw * k / piece.width)
        r = piece.resize((max(1, round(piece.width * sc)), max(1, round(piece.height * sc))), Image.LANCZOS)
        c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        c.alpha_composite(r, ((cw - r.width) // 2, (ch - r.height) // 2))
        c.save(out / f"{name}{suf}.webp", "WEBP", quality=qual, method=4)
        made.append(suf or "720")
    return made, round(src_h)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("full"); ap.add_argument("out"); ap.add_argument("names", nargs="+")
    ap.add_argument("--specs", help="JSON {photo: {setting: value}} for the few photos that need one")
    a = ap.parse_args()
    specs = json.loads(Path(a.specs).read_text()) if a.specs else {}
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    for n in a.names:
        rgba, s = cut(Path(a.full) / f"{n}.jpg", specs.get(n, {}))
        print(n, *save_set(rgba, out, n, s), flush=True)
