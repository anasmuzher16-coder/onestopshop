"""Clear the shop's patterned mat seen through a hookah's clear glass base, keeping the glass's own features.

  python store/tools/catalog/clear_glass.py SRC_DIR CUTOUT_DIR OUT_DIR NAME [NAME...]

SRC_DIR holds the shop's photo (NAME.jpg, upright, 2600 px tall: the HEIC from the owner's Google Drive decoded with
`ffmpeg -i NAME.HEIC -frames:v 1 NAME.png`, which applies the rotation, then resized to 2600 px tall with Lanczos and saved
as JPEG quality 95; every fraction in PHOTOS is read off that raster), CUTOUT_DIR the rembg cut-out of it at the same size
(NAME.png: rembg p -m birefnet-general-lite SRC_DIR CUTOUT_DIR). The cut-out keeps the clear base opaque, with the shop's
black-and-pale-cyan mat (and the mirrored MOZE logo printed in its middle) seen through the glass. Inside the clear-glass
region of each photo (PHOTOS below: rows y_top..y_bot of the cut-out, minus the opaque parts) the output keeps only what
belongs to the glass:
  - its outline: within `edge` px of the silhouette the photo pixel stays, alpha ramping from 0.8 at the edge to 0;
  - its highlights: neutral pixels brighter than hi0..hi1 stay as they are, alpha up to hi_a; highlight scraps under 150 px are dropped (broken
    ring dashes read as dirt);
  - the body: nearly clear in the middle (alpha 0.06), denser toward the outline (0.30, thicker glass seen at a slant),
    coloured by the photo itself blurred wide (the base's broad shading, none of the mat's print) mixed with the outline's
    median colour (the glass's own colour at a grazing angle). The site's tile shows through it.
Opaque parts stay exactly as cut: `keep` rects; `keep_poly`, a swing tag's four corners read off the photo; `keep_sat`, a
coloured downstem (per row, the span of its saturated pixels); `sat_keep`, the anodised collar (strongly coloured pixels
connected to the collar above y_top, cut along `collar_arc`, its lower rim as an ellipse arc). Nothing is drawn that is not
in the photo. Fractions are of the photo's width (x) and height (y).
Each result is framed by frame_cutouts.py --kind hookah --glass, checked by eye on coal, bone and cobalt at 1440 and at
390@3x, and reviewed (atelier:design-reviewer) before it is used.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

DEFAULTS = {"edge": 12, "edge_a": 0.8, "hi0": 180, "hi1": 245, "hi_c": 12, "hi_a": 0.8,
            "tint_c": 0.06, "tint_e": 0.30, "tint_fall": 30, "body_blur": 14, "body_mix": 0.5, "hi_min_px": 150}
PHOTOS = {
    # Tsar Molotov, green (catalogue p26): tag and green downstem in front of / inside the cone base
    "IMG_0684": {"y_top": 0.69, "y_bot": 0.91, "sat_keep": 22, "sat_keep_below": 0.75, "collar_arc": [0.500, 0.717, 0.092, 0.009],
                 "keep": [[0.446, 0.63, 0.570, 0.757]], "keep_sat": [[0.47, 0.758, 0.55, 0.806, 20]]},
    # Tsar Molotov, blue: the tag hangs slightly turned
    "IMG_0685": {"y_top": 0.72, "y_bot": 0.99, "sat_keep": 40, "sat_keep_below": 0.80, "collar_arc": [0.508, 0.745, 0.118, 0.020],
                 "keep_poly": [[[0.4427, 0.656], [0.582, 0.660], [0.5776, 0.794], [0.4381, 0.783]]],
                 "keep_sat": [[0.49, 0.786, 0.565, 0.845, 20]]},
    # Not used: IMG_0689 (Panda, catalogue p25). Its hammered base's texture is as fine as the mat's print seen through it, so
    # clearing the mat also erased the texture (reviewed 2026-11-27: smooth flask, HOLD). Needs a reshoot on a plain backdrop.
}


def sm(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def rect_mask(h, w, r):
    m = np.zeros((h, w), bool)
    x0, y0, x1, y1 = r
    m[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = True
    return m


def clear(photo: Image.Image, cutout: Image.Image, spec: dict) -> Image.Image:
    c = {**DEFAULTS, **spec}
    I = np.asarray(photo.convert("RGB")).astype(np.float32)
    a0 = np.asarray(cutout.convert("RGBA")).astype(np.float32)[..., 3] / 255
    h, w = a0.shape
    Y = np.arange(h)[:, None] * np.ones((1, w)); X = np.ones((h, 1)) * np.arange(w)[None, :]
    fg = a0 > 0.5
    L = I.mean(-1); ch = I.max(-1) - I.min(-1)
    keep = np.zeros((h, w), bool)
    for r in c.get("keep", []):
        keep |= rect_mask(h, w, r)
    for poly in c.get("keep_poly", []):
        pm = Image.new("L", (w, h), 0)
        ImageDraw.Draw(pm).polygon([(x * w, y * h) for x, y in poly], fill=255)
        keep |= nd.binary_erosion(np.asarray(pm) > 0, iterations=1)
    for r in c.get("keep_sat", []):
        m = nd.binary_opening(rect_mask(h, w, r[:4]) & (ch > r[4]), iterations=1)
        y0, y1 = int(r[1] * h), int(r[3] * h)
        lo = np.full(h, -1.0); hi = np.full(h, -1.0)
        for y in range(y0, y1):
            xs = np.nonzero(m[y])[0]
            if len(xs) > 3:
                lo[y], hi[y] = xs.min(), xs.max()
        ok = lo[y0:y1] >= 0
        if ok.sum() > 10:
            lft = nd.median_filter(np.where(ok, lo[y0:y1], np.median(lo[y0:y1][ok])), 15)
            rgt = nd.median_filter(np.where(ok, hi[y0:y1], np.median(hi[y0:y1][ok])), 15)
            last = y0 + np.nonzero(ok)[0].max() - 4
            for k, y in enumerate(range(y0, min(y1, last + 1))):
                keep[y, int(lft[k]) - 1:int(rgt[k]) + 2] = True
    if c.get("sat_keep"):
        sk = nd.binary_opening(ch > c["sat_keep"], iterations=3) & fg
        lab, _ = nd.label(sk)
        ids = np.unique(lab[: int(c["y_top"] * h)]); ids = ids[ids > 0]
        sk = np.isin(lab, ids) & (Y < c.get("sat_keep_below", 1) * h)
        if c.get("collar_arc"):
            ax_, ay_, arx, ary = c["collar_arc"]
            u = np.clip((X - ax_ * w) / (arx * w), -1, 1)
            sk &= Y < (ay_ + ary * np.sqrt(1 - u ** 2)) * h
        keep |= nd.binary_opening(sk, structure=np.ones((1, 9)))
    R = fg & (Y >= c["y_top"] * h) & (Y <= c["y_bot"] * h) & ~keep
    sil = nd.binary_fill_holes(nd.gaussian_filter(a0, 2.5) > 0.5)
    D = nd.distance_transform_edt(sil)
    edge_w = np.where(D < c["edge"], c["edge_a"] * np.clip(1 - D / c["edge"], 0, 1) ** 0.8, 0)
    hi_w = sm(L, c["hi0"], c["hi1"]) * (1 - sm(ch, c["hi_c"], c["hi_c"] + 10)) * c["hi_a"]
    band = R & (D < c["edge"])
    if not band.any():
        raise SystemExit("no glass outline found inside y_top..y_bot: check the photo's spec")
    tint = np.median(I[band], 0)
    hm = hi_w > 0.15
    lab, n = nd.label(hm)
    if n:
        sz = nd.sum(hm, lab, np.arange(1, n + 1))
        small = np.isin(lab, np.nonzero(sz < c["hi_min_px"])[0] + 1)
        hi_w = np.where(nd.binary_dilation(small, iterations=2) & ~nd.binary_dilation(hm & ~small, iterations=2), 0, hi_w)
    pw = np.clip(np.maximum(edge_w, hi_w), 0, 1)
    pw = nd.gaussian_filter(pw, 0.6)
    Rf = R.astype(np.float32); sg = c["body_blur"]
    blur = np.dstack([nd.gaussian_filter(I[..., k] * Rf, sg) for k in range(3)]) / np.maximum(nd.gaussian_filter(Rf, sg), 1e-3)[..., None]
    body = blur * (1 - c["body_mix"]) + tint[None, None] * c["body_mix"]
    ta = c["tint_c"] + (c["tint_e"] - c["tint_c"]) * np.exp(-D / c["tint_fall"])
    A_g = ta * (1 - pw) + pw
    Cp = body * (ta * (1 - pw))[..., None] + I * pw[..., None]   # premultiplied: body under, photo pixel over
    a_out = np.where(R, A_g * a0, a0)
    Cp_out = np.where(R[..., None], Cp * a0[..., None], I * a0[..., None])
    Rs = nd.gaussian_filter(R.astype(np.float32), 1.5)   # 1.5 px seam between cleared glass and untouched parts
    a_fin = a0 * (1 - Rs) + a_out * Rs
    Cp_fin = (I * a0[..., None]) * (1 - Rs[..., None]) + Cp_out * Rs[..., None]
    col = Cp_fin / np.maximum(a_fin[..., None], 1e-4)
    out = np.dstack([np.clip(col, 0, 255), np.clip(a_fin * 255, 0, 255)]).astype(np.uint8)
    out[a_fin < 0.004] = 0
    return Image.fromarray(out, "RGBA")


if __name__ == "__main__":
    src, cuts, outd = (Path(p) for p in sys.argv[1:4])
    outd.mkdir(parents=True, exist_ok=True)
    for n in sys.argv[4:]:
        if n not in PHOTOS:
            raise SystemExit(f"{n}: no spec in PHOTOS (only {', '.join(PHOTOS)})")
        clear(Image.open(src / f"{n}.jpg"), Image.open(cuts / f"{n}.png"), PHOTOS[n]).save(outd / f"{n}.png")
        print(n, "cleared")
