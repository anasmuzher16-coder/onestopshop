"""Make the shop's hookah photos shop-ready: clear glass that reads as glass on any tile colour, with no mat seen through it.

  python store/tools/catalog/clear_glass2.py SRC_DIR CUT_DIR OUT_DIR [--method ratio|rebuild|lama|matting] [NAME ...]

SRC_DIR holds the photos (NAME.jpg, upright, 2600 px tall: the owner's HEIC decoded with ffmpeg, which applies the
rotation itself, resized with Lanczos, JPEG q95). CUT_DIR holds rembg's cut-out of each at the same size
(rembg p -m birefnet-general-lite SRC_DIR CUT_DIR). OUT_DIR gets NAME.png, an RGBA cut-out whose clear glass is
semi-transparent, so the site's tile colour shows through it. With no NAME, every photo in SRC_DIR is done; a photo
with no entry in PHOTOS gets the cut-out as it is.

The problem. The hookahs stand on a black-and-pale-cyan printed mat (MOZE in the middle) on a marble table. Clear glass
shows the mat and marble through it, and a cut-out keeps them. A matting model (BiRefNet-matting) keeps the mat;
inpainting (LaMa) erases the glass's own texture with it (methods sheet and METHODS.md, 2026-11-27).

The method (--method ratio, the default) is a backdrop division, the way a clean plate works in film compositing:
what the camera saw through the glass is the backdrop B changed by the glass, so photo / B is the glass alone.
  - Over the marble and wall, B is a clean plate: LaMa (big-lama, ONNX) paints the backdrop in behind the glass, then
    it is blurred, keeping only the backdrop's broad tone.
  - Over the mat, B is the mat's own two inks: each pixel gets a soft weight of light or dark ink from a median-filtered
    copy of the photo, and B is the local level of that ink. Where the weight is in between (the print's edges) nothing
    is read. The two backdrops are cross-faded over 50 px where the mat zone begins.
From photo / B comes the glass's feature map f (bubbles, drips, ridges): darker than the backdrop over light ink and
over the plate, brighter than it over dark ink. Broad shading in f is taken out (only detail under ~15 px is texture),
so a misread patch of print cannot become a blotch. f is drawn the way a bubble looks on a plain backdrop: a thin
cool-dark part and a softer white part. Real specular highlights (near-white, neutral) are kept as they are. The
outline gets a darker rim with a thin inner highlight, where glass is seen at a slant. Everything is merged into one
RGBA pixel over the tile: a dark layer (alpha a_d) under a white layer (alpha h).
Opaque parts stay as cut: the downstem (a tight mask with a round end, edges feathered), rubber rings and bands (their
dark pixels only), logo plates. The base's outline below its widest row is a fitted superellipse, so the mat's teeth
round the foot are cut off on a smooth curve.
--method rebuild draws only the outline, body tint and speculars (no texture); lama fills the see-through glass with
the tile colour by inpainting (baked on --tile, opaque); matting uses BiRefNet-matting's alpha with a pymatting
foreground (outline trimmed by the foot, but retouch and erase not applied; a photo with no entry gets the model's
matte). lama and matting are kept only for the methods comparison. A photo with an entry must be 2600 px tall and its
cut-out the same size; otherwise the run stops with a message.

Each PHOTOS entry (pixels of the 2600 px tall photo):
  foot     [cx, cy, rx, ry, k, side, blend] (with fill, rx is read off the photo unless given as [left, right],
           and the curve eases in over `blend` rows, default 60): the base's outline below its widest row cy, a superellipse
           |dx/rx|^k + |dy/ry|^k = 1; for `side` rows above cy (default 0) the base is also held to |x - cx| <= rx.
           Read off the photo with an overlay.
  fill     true when the cut-out is unsure of the base (clear glass, a glossy foot): below row cy the silhouette is the fitted curve itself,
           eased over 60 rows from the cut-out's own (smoothed) outline above it.
  glass    [y_top, y_bot]: rows holding clear glass; the glass is the cut-out within them, minus the opaque parts.
  stem     [x0, y0, x1, y1]: the downstem seen through the glass, kept opaque (round end at y1).
  band     [cx, cy, rx, ry, t]: a band between an ellipse's lower arc and the same arc t px lower, kept opaque. plate [x0, y0, x1, y1]: a logo plate kept opaque.
  dark     [L, y0, y1]: pixels darker than L in rows y0..y1, in pieces at least 150 px wide, stay opaque (a black
           rubber ring round the neck).
  mat      list of [cx, cy, rx, ry]: ellipses of glass that look onto the mat. mat_fine: ellipses over the mat's thin
           printed lettering, classed with a 3 px median instead of 9 px.
  erase    list of [x0, y0, x1, y1]: cleared (a mat tooth's smear just outside the glass).
  bridge   list of [y0, y1, "left"|"right"]: that side of the outline over rows y0..y1 replaced by a cubic that meets
           the edge's own line and slope at both ends (only ever cuts in: a mat tooth or tip on the edge is skipped).
  inset    list of [y0, y1, px, "left"|"right"]: that side of the outline moved in by up to px on a smooth bump
           over rows y0..y1 (a mat tooth's tip stuck to the edge).
  retouch  list of [x0, y0, x1, y1]: small areas LaMa paints over from their surround (mat print seen through a rim).
Needs numpy, scipy, pillow, onnxruntime (rembg's venv at C:\\dev\\_tools\\rembg-venv has them) and, for ratio, lama and
any photo with a retouch, the LaMa model (Carve/LaMa-ONNX lama_fp32.onnx, Apache-2.0; --lama PATH).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

LAMA = r"C:\dev\_tools\glass-models\lama_fp32.onnx"
MATTING = r"C:\dev\_tools\glass-models\birefnet-matting.onnx"
H = 2600                                  # PHOTOS entries are in pixels of a photo this tall

PHOTOS = {
    # Panda, drip-textured clear glass on the mat; the downstem runs down to the mat
    "IMG_0689": {"foot": [1013, 2310, 314, 205, 2.6, 40], "fill": True, "glass": [1612, 2600], "stem": [984, 1612, 1035, 2228],
                 "mat": [[1015, 2330, 335, 225]], "mat_fine": [[1010, 2305, 140, 45]]},
    # painted opaque base, off the mat
    "IMG_0670": {"foot": [1028, 2400, [174, 176], 112, 2.0], "fill": True},
    # clear glass on marble, black rubber ring round the neck
    "IMG_0679": {"glass": [1752, 2530], "stem": [982, 1752, 1035, 2243], "dark": [70, 2030, 2110]},
    # yellow frit base (opaque) on the mat
    "IMG_0697": {"foot": [1022, 2295, [333, 327], 245, 2.0, 60, 170], "fill": True, "bridge": [[2118, 2215, "left"], [2118, 2190, "right"]], "inset": [[2300, 2490, 7, "left"]]},
    # smooth clear glass on the mat, black base band with a logo plate (both part of the hookah)
    "IMG_0701": {"foot": [998, 2330, [303, 302], 220, 3.5, 100], "fill": True, "glass": [1700, 2560], "stem": [981, 1700, 1052, 2180],
                 "band": [998, 2328, 286, 122, 58], "plate": [917, 2464, 1027, 2524],
                 "mat": [[998, 2290, 320, 250], [998, 2470, 320, 95]], "mat_fine": [[1015, 2335, 170, 55]]},
    # smoked textured glass, off the mat: the cut-out took some of the counter's shadow along the foot
    "IMG_0674": {"foot": [976, 2331, [325, 327], 236, 2.0, 0, 60], "fill": True},
    "IMG_0678": {"foot": [955, 2342, [293, 295], 207, 2.0, 0, 60], "fill": True},
    # yellow frit base on the mat: two mat-tooth stubs on the shoulders
    "IMG_0699": {"foot": [977, 2293, [204, 205], 133, 2.0, 0, 60], "fill": True,
                 "bridge": [[2128, 2200, "right"], [2122, 2190, "left"], [2205, 2292, "left"]],
                 "inset": [[2300, 2425, 3, "left"]]},
    # green moulded glass base on the mat; white ceramic-look base on the mat (teeth round both feet)
    "IMG_0683": {"foot": [1016, 2330, 284, 209, 2.6, 60, 60], "fill": True},
    "IMG_0688": {"foot": [1018, 2380, 0, 136, 1.6, 0, 60], "fill": True},
    # blue frit base (opaque) on the mat; mat print shows through its rim at the front
    "IMG_0715": {"foot": [990, 2330, 286, 170, 2.6, 60], "retouch": [[1120, 2410, 1230, 2480], [705, 2420, 805, 2500], [1180, 2395, 1275, 2490]]},
}

DARK = np.array([36, 44, 50], float)     # the glass's dark layer: a cool grey, as clear soda glass reads at a slant


def lum(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


def ell(h, w, cx, cy, rx, ry):
    y, x = np.mgrid[0:h, 0:w]
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def foot_alpha(h, w, f):
    """Soft (anti-aliased) mask of the base's outline: 1 inside, 0 outside, only below row cy - side."""
    cx, cy, rx, ry, k = f[:5]
    if isinstance(rx, (list, tuple)):
        raise ValueError("foot: rx as [left, right] needs \"fill\": true")
    side = f[5] if len(f) > 5 else 0
    y, x = np.mgrid[0:h, 0:w].astype(float)
    dx = np.abs(x - cx)
    t = np.clip((y - cy) / ry, 0, 1)
    hw = np.where(y <= cy, rx, rx * np.clip(1 - t ** k, 0, 1) ** (1 / k))
    a = np.clip(hw - dx + 0.5, 0, 1)
    u = np.clip(dx / rx, 0, 1)
    bottom = cy + ry * np.clip(1 - u ** k, 0, 1) ** (1 / k)
    a = np.minimum(a, np.clip(bottom - y + 0.5, 0, 1))
    return np.where(y < cy - side, 1.0, a)


def fill_alpha(cut_a, f, blend=60):
    """For a base the cut-out is unsure of: above row cy - blend the cut-out's own outline; below cy the fitted curve,
    filled; in between, the traced edges ease into the curve. The traced edges are median-smoothed (a mat tooth does
    not count), and the curve's half-width on each side is read off the smoothed trace just above cy (unless the foot
    gives rx as [left, right]), so the two meet without a kink. For `side` rows above the blend the cut-out is also
    held inside its own smoothed trace, which takes off a tooth or nub there."""
    cx, cy, rx, ry, k = f[:5]
    side = f[5] if len(f) > 5 else 0
    blend = f[6] if len(f) > 6 else blend
    h, w = cut_a.shape
    sil = cut_a.astype(float) / 255
    m = cut_a > 127
    y0 = int(cy - blend)
    ys = max(0, int(cy - blend - max(side, 30)))
    rows = np.arange(ys, min(int(cy), h - 1) + 1)
    tl = np.array([np.flatnonzero(m[r]).min() if m[r].any() else cx - 1 for r in rows], float)
    tr = np.array([np.flatnonzero(m[r]).max() if m[r].any() else cx + 1 for r in rows], float)
    tl, tr = nd.median_filter(tl, 41, mode="nearest"), nd.median_filter(tr, 41, mode="nearest")
    if isinstance(rx, (list, tuple)):
        rxl, rxr = rx
    else:
        rxl, rxr = cx - np.median(tl[-12:]), np.median(tr[-12:]) - cx
    # above its widest row the base is no wider than that: from the first row where the trace runs out past it (a mat
    # tooth or the mat itself), the edge eases from its last good point to the full width at cy instead of being clipped
    for t_, lim, out_ in ((tl, cx - rxl, lambda v, l: v < l), (tr, cx + rxr, lambda v, l: v > l)):
        bad = np.flatnonzero(out_(t_, lim))
        if len(bad) and bad[0] > 0:
            # a cubic that leaves the trace 40 rows before it runs out, with the trace's own slope, and lands on the full
            # width at cy with zero slope: no corner at either end
            c0 = max(1, bad[0] - 40)
            m0 = t_[c0] - t_[c0 - 1]
            n = len(t_) - 1 - c0
            if n > 0:
                u = np.arange(n + 1) / n
                p0, p1 = t_[c0], lim
                t_[c0:] = ((2 * u ** 3 - 3 * u ** 2 + 1) * p0 + (u ** 3 - 2 * u ** 2 + u) * m0 * n + (-2 * u ** 3 + 3 * u ** 2) * p1)
        elif len(bad):
            t_[:] = lim
    y, x = np.mgrid[0:h, 0:w].astype(float)
    t = np.clip((y - cy) / ry, 0, 1)
    g = np.clip(1 - t ** k, 0, 1) ** (1 / k)
    xl, xr = cx - rxl * g, cx + rxr * g
    for i, r in enumerate(rows):
        if r < y0:
            xl[r], xr[r] = tl[i], tr[i]
            continue
        s_ = (r - y0) / blend
        s_ = s_ * s_ * (3 - 2 * s_)
        xl[r] = tl[i] + (cx - rxl - tl[i]) * s_
        xr[r] = tr[i] + (cx + rxr - tr[i]) * s_
    a = np.clip(x - xl + 0.5, 0, 1) * np.clip(xr - x + 0.5, 0, 1)
    rxs = np.where(x < cx, rxl, rxr)
    u = np.clip(np.abs(x - cx) / rxs, 0, 1)
    bottom = cy + ry * np.clip(1 - u ** k, 0, 1) ** (1 / k)
    a = np.minimum(a, np.clip(bottom - y + 0.5, 0, 1))
    a = np.where(y < y0, sil * a, a)          # above the blend: the cut-out, held inside its smoothed trace
    return np.where(y < ys, sil, a)


def stem_alpha(h, w, s):
    x0, y0, x1, y1 = s
    y, x = np.mgrid[0:h, 0:w].astype(float)
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2
    side = np.clip(r - np.abs(x - cx) + 0.5, 0, 1)
    end = 10.0
    yy = np.clip((y - (y1 - end)) / end, 0, None)          # round end: an ellipse cap of height `end`
    cap = np.clip(r * np.sqrt(np.clip(1 - yy ** 2, 0, 1)) - np.abs(x - cx) + 0.5, 0, 1)
    a = np.where(y < y1 - end, side, cap) * (y >= y0)
    return nd.gaussian_filter(a, 0.8)


def band_alpha(h, w, b):
    """A band round a cylindrical base: between an ellipse's lower arc and the same arc t px lower (soft edges).
    Drawn from geometry, not from dark pixels: the mat's black ink touches the band and is just as dark."""
    cx, cy, rx, ry, t = b
    y, x = np.mgrid[0:h, 0:w].astype(float)
    u = np.clip((x - cx) / rx, -1, 1)
    arc = cy + ry * np.sqrt(1 - u ** 2)
    return np.clip(y - arc + 0.5, 0, 1) * np.clip(arc + t - y + 0.5, 0, 1) * np.clip(rx - np.abs(x - cx) + 0.5, 0, 1)


def lama_fill(img, mask, sess):
    """Inpaint img (H,W,3 uint8) under mask (bool) with LaMa at 512x512 over the mask's box; returns a float image."""
    ys, xs = np.where(mask)
    if not len(ys):
        return img.astype(float)
    pad = 60
    y0, y1 = max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad)
    crop = Image.fromarray(img[y0:y1, x0:x1]); m = Image.fromarray((mask[y0:y1, x0:x1] * 255).astype(np.uint8))
    a = np.asarray(crop.resize((512, 512), Image.BICUBIC), np.float32) / 255
    b = (np.asarray(m.resize((512, 512), Image.NEAREST), np.float32) > 127).astype(np.float32)
    out = sess.run(None, {"image": a.transpose(2, 0, 1)[None], "mask": b[None, None]})[0][0].transpose(1, 2, 0)
    if out.max() <= 1.5:
        out = out * 255
    out = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize(crop.size, Image.BICUBIC), float)
    res = img.astype(float).copy()
    sub = res[y0:y1, x0:x1]
    mm = mask[y0:y1, x0:x1]
    sub[mm] = out[mm]
    return res


def masks(photo, cut_a, cfg):
    """Returns (silhouette alpha 0..1, glass mask, opaque-kept alpha 0..1, mat zone, fine-lettering zone)."""
    h, w = cut_a.shape
    sil = cut_a.astype(float) / 255
    if "foot" in cfg:
        if cfg.get("fill"):
            sil = fill_alpha(cut_a, cfg["foot"])
        else:
            sil = sil * foot_alpha(h, w, cfg["foot"])
    for x0, y0, x1, y1 in cfg.get("erase", []):
        sil[y0:y1, x0:x1] = 0
    for y0, y1, px, side in cfg.get("inset", []):      # move one side of the outline in by up to px, on a smooth bump
        xx = np.arange(w, dtype=float)
        rr = np.arange(y0 - 20, y1 + 20)
        edge = np.array([(np.flatnonzero(sil[r] > 0.5)[[0, -1]] if (sil[r] > 0.5).any() else (0, w - 1)) for r in rr], float)
        edge = nd.gaussian_filter1d(nd.median_filter(edge, (21, 1), mode="nearest"), 4, axis=0)   # the edge's own smooth line
        for i, r in enumerate(rr):
            if not y0 <= r < y1:
                continue
            d = px * np.sin(np.pi * (r - y0) / (y1 - y0)) ** 2     # zero slope at both ends: no corner where it starts or stops
            if side == "left":
                sil[r] *= np.clip(xx - (edge[i, 0] + d) + 0.5, 0, 1)
            else:
                sil[r] *= np.clip((edge[i, 1] - d) - xx + 0.5, 0, 1)
    for y0, y1, side in cfg.get("bridge", []):         # an edge bridged over rows y0..y1 by a cubic from its own line
        xx = np.arange(w, dtype=float)                  # and slope at both ends (a mat tooth on the edge is skipped)
        rr = np.arange(y0 - 30, y1 + 31)
        e = np.array([(np.flatnonzero(sil[r] > 0.5)[[0, -1]] if (sil[r] > 0.5).any() else (0, w - 1)) for r in rr], float)
        k = 0 if side == "left" else 1
        e = nd.gaussian_filter1d(e[:, k], 3)
        i0, i1 = 30, 30 + (y1 - y0)
        m0, m1 = (e[i0] - e[i0 - 10]) / 10, (e[i1 + 10] - e[i1]) / 10
        n = i1 - i0
        u = np.arange(n + 1) / n
        line = (2 * u ** 3 - 3 * u ** 2 + 1) * e[i0] + (u ** 3 - 2 * u ** 2 + u) * m0 * n +                (-2 * u ** 3 + 3 * u ** 2) * e[i1] + (u ** 3 - u ** 2) * m1 * n
        for j, r in enumerate(range(y0, y1 + 1)):
            if side == "left":
                sil[r] *= np.clip(xx - line[j] + 0.5, 0, 1)
            else:
                sil[r] *= np.clip(line[j] - xx + 0.5, 0, 1)
    fg = sil > 0.5
    opaque = np.zeros((h, w))
    if "stem" in cfg:
        opaque = np.maximum(opaque, stem_alpha(h, w, cfg["stem"]))
    if "band" in cfg:
        opaque = np.maximum(opaque, band_alpha(h, w, cfg["band"]))
    if "plate" in cfg:
        x0, y0, x1, y1 = cfg["plate"]
        p = np.zeros((h, w)); p[y0:y1, x0:x1] = 1
        opaque = np.maximum(opaque, nd.gaussian_filter(p, 0.8))
    if "dark" in cfg:
        lv, y0, y1 = cfg["dark"]
        d = lum(photo) < lv
        d[:y0] = False; d[y1:] = False
        lab, k = nd.label(d)                 # the ring runs right round the neck; shadows seen through glass do not
        for i, sl in enumerate(nd.find_objects(lab), 1):
            if sl[1].stop - sl[1].start < 150:
                d[lab == i] = False
        cols = np.flatnonzero(d.any(0))      # and it is thin: keep only what lies within 6 px of its own centre line
        if len(cols):
            yy = np.arange(h)[:, None]
            centre = np.full(w, np.nan)
            centre[cols] = (d[:, cols] * yy).sum(0) / d[:, cols].sum(0)
            centre[cols] = nd.median_filter(centre[cols], 31, mode="nearest")
            near = np.abs(yy - centre[None, :]) <= 6
            d &= np.nan_to_num(near, nan=False).astype(bool)
        opaque = np.maximum(opaque, nd.gaussian_filter(nd.binary_dilation(d, iterations=2).astype(float), 0.8))
    glass = np.zeros((h, w), bool)
    if "glass" in cfg:
        y0, y1 = cfg["glass"]
        glass[y0:y1] = True
        glass &= fg
        glass = nd.binary_opening(glass, iterations=2)
        edge = nd.binary_dilation(glass, iterations=3) & (sil > 0.02)   # the outline's soft pixels are glass too
        edge[:y0] = False; edge[y1:] = False
        glass |= edge
    mat = np.zeros((h, w), bool)
    for e in cfg.get("mat", []):
        mat |= ell(h, w, *e)
    mat &= glass
    fine = np.zeros((h, w), bool)
    for e in cfg.get("mat_fine", []):
        fine |= ell(h, w, *e)
    return sil, glass, opaque, mat, fine


def glass_layers(photo, glass, sil, mat, fine, lama, texture=True, rim_from=None):
    """Returns (dark alpha, highlight alpha) for the glass pixels of a window of the photo."""
    L = lum(photo)
    h, w = L.shape
    sat = photo.max(2) - photo.min(2)
    spec = np.clip((L - 228) / 22, 0, 1) * np.clip((45 - sat) / 15, 0, 1)
    f = np.zeros((h, w))
    if texture:
        # backdrop over the marble and wall: a LaMa clean plate, broad tone only
        hole = nd.binary_dilation(glass, iterations=6)
        plate = nd.gaussian_filter(lum(lama_fill(photo.astype(np.uint8), hole, lama)), 6)
        f_plate = np.clip(1 - L / np.maximum(plate, 1), 0, 1) + 0.6 * np.clip((L - plate) / np.maximum(255 - plate, 20), 0, 1)
        f = f_plate
        if mat.any():
            Lm = nd.median_filter(L, size=9)
            if fine.any():                 # printed lettering is thinner than the 9 px median: class it with a 3 px one
                Lm = np.where(fine, nd.median_filter(L, size=3), Lm)
            c = np.clip((Lm - 85) / 50, 0, 1)                      # soft light-ink weight
            c = nd.gaussian_filter(c, 1.0)
            z = nd.binary_dilation(mat, iterations=40)
            sure_l, sure_d = z & (c > 0.95), z & (c < 0.05)

            def level(m):
                wgt = nd.gaussian_filter(m.astype(float), 30)
                return nd.gaussian_filter(np.where(m, Lm, 0), 30) / np.maximum(wgt, 1e-3)
            Bl, Bd = level(sure_l), level(sure_d)
            f_l = np.clip(1 - L / np.maximum(Bl, 1), 0, 1)
            f_d = np.clip((L - Bd) / np.maximum(Bl - Bd, 40), 0, 1) * 0.8
            rel = np.clip(1 - 4.5 * c * (1 - c), 0, 1) ** 2           # zero where the ink weight is in between
            f_mat = (c * f_l + (1 - c) * f_d) * rel
            inside = nd.distance_transform_edt(mat)
            wm = np.clip(inside / 50, 0, 1)
            wm = wm * wm * (3 - 2 * wm)
            f = wm * f_mat + (1 - wm) * f_plate
            # a highlight is only one where it is brighter than the ink behind it (the pale ink is near-white)
            spec = spec * np.where(mat, np.clip((L - Bl - 18) / 15, 0, 1), 1)
        f = np.clip(f - 0.04, 0, None)
        f = nd.median_filter(f, size=3)                             # single-pixel noise is not texture
        f = np.clip(f - nd.gaussian_filter(f, 7) - 0.02, 0, None) * 2.2   # detail only: broad patches are misread backdrop
        f = np.clip(f, 0, 1)
        if rim_from is not None:
            # the thick bottom rim shows the mat's teeth bent through it, so its texture is not read there: it is
            # borrowed from the same glass 70 px further in along the (smoothed) normal, faded in over 55 px
            dd = nd.distance_transform_edt(sil > 0.5)
            yy, xx = np.mgrid[0:h, 0:w]
            ny, nx = np.gradient(nd.gaussian_filter(dd, 10))   # a smooth inward normal: the copy is a local shift, no streaks
            nn = np.maximum(np.hypot(ny, nx), 1e-3)
            sy = np.clip(np.round(yy + ny / nn * 70), 0, h - 1).astype(int)
            sx = np.clip(np.round(xx + nx / nn * 70), 0, w - 1).astype(int)
            borrowed = f[sy, sx]
            q = np.clip(dd / 55, 0, 1)
            q = q * q * (3 - 2 * q)
            low = (np.arange(h) >= rim_from)[:, None]
            f = np.where(low, q * f + (1 - q) * borrowed, f)
    # outline: a darker rim where the glass is seen at a slant, a thin inner highlight just inside it
    dist = nd.distance_transform_edt(sil > 0.5)
    rim = 0.50 * np.exp(-dist / 3.5) + 0.12 * np.exp(-dist / 20.0)
    inner = 0.18 * np.exp(-((dist - 6.0) ** 2) / 5.0)
    body = 0.05
    a_d = 1 - (1 - 0.55 * f) * (1 - rim) * (1 - body)
    hi = 1 - (1 - spec) * (1 - 0.22 * nd.gaussian_filter(f, 1.0)) * (1 - inner)
    return np.where(glass, a_d, 0), np.where(glass, hi, 0)


def compose(cut, sil, glass, opaque, a_d, hi, rows=None):
    rgb = cut[..., :3].astype(float)
    A = 1 - (1 - a_d) * (1 - hi)
    C = (DARK[None, None] * (a_d * (1 - hi))[..., None] + 255 * hi[..., None]) / np.maximum(A, 1e-4)[..., None]
    g = glass.astype(float) * (1 - opaque)                   # weight of the drawn glass; opaque parts stay as cut
    if rows is not None:                                     # fade the drawn glass in and out over 16 rows at y_top, y_bot
        yy = np.arange(g.shape[0], dtype=float)[:, None]
        top = np.clip((yy - rows[0]) / 16, 0, 1)
        bot = 1.0 if rows[1] >= cut.shape[0] else np.clip((rows[1] - yy) / 16, 0, 1)
        g = g * top * bot
    g = np.maximum(g, 0)
    out_rgb = C * g[..., None] + rgb * (1 - g[..., None])
    out_a = (A * g + (1 - g)) * sil
    return np.dstack([out_rgb.clip(0, 255), (out_a * 255).clip(0, 255)]).astype(np.uint8)


def run_one(src, cut_p, cfg, method, lama, tile=None, matting=None):
    photo = np.asarray(Image.open(src).convert("RGB"), float)
    cut = np.asarray(Image.open(cut_p).convert("RGBA")).copy()
    if cut.shape[:2] != photo.shape[:2]:
        raise ValueError(f"{cut_p.name}: cut-out {cut.shape[1]}x{cut.shape[0]} is not the photo's size "
                         f"{photo.shape[1]}x{photo.shape[0]}")
    if cfg and photo.shape[0] != H:
        raise ValueError(f"{src.name}: {photo.shape[0]} px tall; its PHOTOS entry is in pixels of a {H} px tall photo")
    if not cfg and method != "matting":
        return cut                                            # nothing known about this photo: the cut-out as it is
    if cfg.get("retouch") and lama is not None:
        m = np.zeros(photo.shape[:2], bool)
        for x0, y0, x1, y1 in cfg["retouch"]:
            m[y0:y1, x0:x1] = True
        m &= cut[..., 3] > 127
        fill = lama_fill(photo.astype(np.uint8), m, lama)
        photo = fill
        cut[..., :3] = np.where(m[..., None], fill, cut[..., :3]).astype(np.uint8)
    sil, glass, opaque, mat, fine = masks(photo, cut[..., 3], cfg)
    if method == "matting":                                   # comparison only: retouch and erase are not applied
        return matting_cut(photo, cfg, matting)
    if method == "lama":
        return lama_tile(photo, cut, sil, glass, opaque, lama, tile)
    a_d = np.zeros(glass.shape); hi = np.zeros(glass.shape)
    if glass.any():
        ys, xs = np.where(glass)
        y0, y1 = max(0, ys.min() - 90), min(glass.shape[0], ys.max() + 90)
        x0, x1 = max(0, xs.min() - 90), min(glass.shape[1], xs.max() + 90)
        w = (slice(y0, y1), slice(x0, x1))
        rim_from = int(cfg["foot"][1]) - y0 if cfg.get("fill") and "glass" in cfg else None
        a_d[w], hi[w] = glass_layers(photo[w], glass[w], sil[w], mat[w], fine[w], lama, texture=(method == "ratio"),
                                     rim_from=rim_from)
    return compose(cut, sil, glass, opaque, a_d, hi, cfg.get("glass"))


def lama_tile(photo, cut, sil, glass, opaque, lama, tile):
    """Bake the cut-out on the tile, then let LaMa paint the see-through glass (minus speculars) from its surround."""
    a = sil[..., None]
    base = cut[..., :3] * a + np.array(tile, float) * (1 - a)
    L = lum(photo); sat = photo.max(2) - photo.min(2)
    spec = (L > 228) & (sat < 40)
    dist = nd.distance_transform_edt(sil > 0.5)
    hole = glass & ~spec & (dist > 8) & (opaque < 0.5)
    out = lama_fill(base.clip(0, 255).astype(np.uint8), hole, lama)
    # baked on the tile (comparison only): opaque wherever the product is, so the tile is not composited twice
    return np.dstack([out.clip(0, 255), np.where(sil > 0.02, 255.0, 0)]).astype(np.uint8)


def matting_cut(photo, cfg, sess):
    from pymatting import estimate_foreground_ml
    h, w = photo.shape[:2]
    im = Image.fromarray(photo.astype(np.uint8))
    a = np.asarray(im.resize((1024, 1024), Image.BICUBIC), np.float32) / 255
    a = (a - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    o = sess.run(None, {"input_image": a.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    al = 1 / (1 + np.exp(-o))
    al = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), float) / 255
    if "foot" in cfg:
        al *= fill_alpha(np.full((h, w), 255, np.uint8), cfg["foot"]) if cfg.get("fill") else foot_alpha(h, w, cfg["foot"])
    F = estimate_foreground_ml(photo / 255, al)
    return np.dstack([(F * 255).clip(0, 255), al * 255]).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("cut"); ap.add_argument("out")
    ap.add_argument("names", nargs="*")
    ap.add_argument("--method", default="ratio", choices=["ratio", "rebuild", "lama", "matting"])
    ap.add_argument("--tile", default="198,216,108", help="lama only: the tile colour the result is baked on")
    ap.add_argument("--lama", default=LAMA)
    ap.add_argument("--matting", default=MATTING)
    a = ap.parse_args()
    src, cut, out = Path(a.src), Path(a.cut), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    tile = tuple(int(v) for v in a.tile.split(","))
    if len(tile) != 3 or not all(0 <= v <= 255 for v in tile):
        ap.error("--tile takes three numbers 0-255, e.g. 198,216,108")
    names = [Path(n).stem for n in a.names] or sorted(p.stem for p in src.glob("*.jpg"))
    missing = [n for n in names if not (src / f"{n}.jpg").exists() or not (cut / f"{n}.png").exists()]
    if missing:
        ap.error("no photo (SRC_DIR/NAME.jpg) or cut-out (CUT_DIR/NAME.png) for: " + ", ".join(missing))
    need_lama = a.method in ("ratio", "lama") or any(PHOTOS.get(n, {}).get("retouch") for n in names)
    import onnxruntime as ort
    so = ort.SessionOptions(); so.intra_op_num_threads = 4
    lama = ort.InferenceSession(a.lama, so, providers=["CPUExecutionProvider"]) if need_lama and a.method != "matting" else None
    mat = ort.InferenceSession(a.matting, so, providers=["CPUExecutionProvider"]) if a.method == "matting" else None
    for n in names:
        cfg = PHOTOS.get(n, {})
        res = run_one(src / f"{n}.jpg", cut / f"{n}.png", cfg, a.method, lama, tile, mat)
        Image.fromarray(res, "RGBA").save(out / f"{n}.png")
        did = [k for k in ("foot", "glass", "stem", "band", "retouch") if k in cfg] if a.method != "matting" else ["model matte"]
        print(n, a.method, ", ".join(did) if cfg else "no entry: cut-out as it is", flush=True)


if __name__ == "__main__":
    sys.exit(main())
