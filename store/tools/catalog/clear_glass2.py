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
  disc     [cx, cy, rx, ry, t]: a wide round dish under the base (its outline an ellipse): the silhouette is the base's
           united with the ellipse (the cut-out took the mat round it), and the base's outline, the dish's and its wall's
           inner edge t px in (optional) are each drawn, so the base reads as standing in the dish.
  glass    [y_top, y_bot]: rows holding clear glass; the glass is the cut-out within them, minus the opaque parts.
  stem     [x0, y0, x1, y1]: the downstem seen through the glass, kept opaque (round end at y1).
  stem_collar [x0, y0, x1, y1, a]: the stem behind a thick clear collar (the photo shows only the collar's glint there):
           the tube's own colour across its width (its median a little below y1) eased into the box and 20 rows below, fading from strength a at y1 to nothing at
           y0, the sides tapered (the glass drawn over the rest), so the stem runs up to the metal without a pasted-in block.
  band     [cx, cy, rx, ry, t, k]: a band between a superellipse's lower arc (exponent k, default 2) and the same arc
           t px lower, kept opaque; its light pixels (the glass's rim, a mat tooth) take the band's own dark colour. plate [x0, y0, x1, y1]: a logo plate kept opaque.
  dark     [L, y0, y1]: pixels darker than L in rows y0..y1, in pieces at least 150 px wide, stay opaque (a black
           rubber ring round the neck).
  mat      list of [cx, cy, rx, ry]: ellipses of glass that look onto the mat. mat_fine: ellipses over the mat's thin
           printed lettering, classed with a 3 px median instead of 9 px.
  holes    true: gaps the cut-out left inside the outline are filled.
  erase    list of [x0, y0, x1, y1]: cleared (a mat tooth's smear just outside the glass).
  bridge   list of [y0, y1, "left"|"right"]: that side of the outline over rows y0..y1 replaced by a cubic that meets
           the edge's own line and slope at both ends (only ever cuts in: a mat tooth or tip on the edge is skipped).
  inset    list of [y0, y1, px, "left"|"right"]: that side of the outline moved in by up to px on a smooth bump
           over rows y0..y1 (a mat tooth's tip stuck to the edge).
  retouch  list of [x0, y0, x1, y1]: small areas LaMa paints over from their surround (mat print seen through a rim).
  tex      [sigma, gain]: the texture band (detail finer than sigma px is texture) and its strength; default [7, 2.2].
           Cut glass with broad facets wants a wider band.
  borrow   [y, dy]: from row y down, the glass's texture is copied from dy rows higher (faded in over 40 rows): for a
           thick cut-glass foot over the mat, where the print and the facets cannot be told apart, the same cut
           pattern from the shoulder above, which stands over the plain wall.
  texture  false: smooth glass with no texture of its own: only outline, body tint and speculars are drawn (as
           --method rebuild), so nothing of the mat can be read into it.
  keep_dark list of [x0, y0, x1, y1, L]: in that box, pixels darker than L stay as cut (a black grommet seen through
           the neck), softened by 1 px; the rest is glass.
  keep_colour list of [x0, y0, x1, y1, C(, cx, cy, rx, ry)]: in that box, the coloured glass (one channel C above the
           other two) stays as cut, as one solid smooth piece (holes filled; below cy only inside the ellipse); the clear
           glass round it is drawn.
  keep_band list of [cx, cy, rx, ry, t, x0, x1]: between the ellipse's lower arc and the same arc t px lower, in
           columns x0..x1 (its ends rounded), stays as cut (a rubber ring seen through the neck: one clean band, its own
           highlights kept).
  rim      [a, d(, b)]: the outline's darker rim, a * exp(-dist / d) + b * exp(-dist / 20) (default [0.50, 3.5, 0.12];
           smooth thin glass wants far less, or it reads as an inked line).
  tex_to   y: with texture off, the texture is still read above row y (the wall behind the upper glass) and fades out
           over 80 rows above it, so the mat below gives none.
  arcs     list of [cx, cy, rx, ry, a0, a1, s, w]: a glass edge the photo shows but the method cannot read over the mat
           (a thick foot's inner ring), measured off the photo: an elliptical arc from angle a0 to a1 (degrees, 0 right,
           90 front; a1 - a0 >= 360 for the whole ring) drawn as a soft dark line of strength s and width w with a
           highlight just inside it where the photo shows the ring bright; the ends fade over 18 degrees.
           A ninth value is the angle the light comes from: the edge is strongest there, a third as strong opposite.
  inner    the thin highlight just inside the outline (default 0.18). body [dark, white]: the even tint of the glass
           (default [0.05, 0]; clear glass reads clearer a touch lighter than the tile than darker).
  streaks  [y0, y1, t]: in rows y0..y1 (over the plain wall), thin vertical streaks brighter than their surround by
           more than t are kept as highlights (the glass's own reflections, fainter than a specular).
  tex_median px: the median that takes noise out of the texture before its band is read (default 3); cut glass wants
           about 7, so its facets read as flat planes with crisp edges, not crinkled cellophane.
  mat_gain the strength of the texture read over the mat (default 1): below 1 where the print still shows as blotches.
  spec_off list of [x0, y0, x1, y1]: no highlight or texture kept there (one that reads as a printed mark).
  spec_min px: highlights in pieces smaller than this are dropped (lone specks read as noise, not as glass).
  thick    list of [cx, cy, rx, ry, y0, s]: glass outside the ellipse and below row y0 (eased over 30 rows) gets s more
           body (the thick foot's front face); a negative s makes it that much lighter instead.
  keep_above [cx, cy, rx, ry]: above this ellipse's lower arc (a metal flange's curved lower edge) stays as cut.
  keep_below [cx, cy, rx, ry]: below this ellipse's upper arc (a water line, a base seen through the glass) the glass
           stays as cut, and beside the ellipse everything below cy - ry - 60 does; the change eases over 10 px.
  smooth   [x0, x1, depth, sigma]: a coloured (opaque-drawn) base's bottom rim, the `depth` rows above its outline in
           columns x0..x1, blurred along the rim (sigma px) row by row, so the mat print bent through the thick rim goes
           and the rim's own shading (darker edge, the thin pale lip) stays. Near-white speculars are kept.
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
    "IMG_0701": {"foot": [995, 2320, [304, 302], 225, 4.0, 120], "fill": True, "glass": [1690, 2560], "stem": [962, 1700, 1010, 2180],
                 "band": [995, 2320, 302, 142, 57, 1.8], "plate": [[917, 2464, 1027, 2524], [900, 1688, 1070, 1731]], "texture": False,
                 "mat": [[998, 2290, 320, 250], [998, 2470, 320, 95]], "mat_fine": [[1015, 2335, 170, 55]]},
    # cut-glass (faceted) clear base on the mat, clear collar under the stem's metal
    "IMG_0687": {"foot": [993, 2320, [308, 312], 205, 3.2, 60, 60], "fill": True, "glass": [1650, 2600], "stem": [972, 1768, 1012, 2290],
                 "keep_above": [995, 1656, 130, 43], "mat": [[993, 2490, 330, 110]], "tex": [20, 2.6], "tex_to": 2410, "mat_gain": 0.0,
                 "stem_collar": [972, 1700, 1012, 1768, 1.0], "spec_off": [[955, 1692, 1035, 1714], [955, 1735, 1035, 1770]],
                 "bridge": [[2040, 2140, "left"], [2040, 2140, "right"]],
                 "rim": [0.0, 2.0, 0.08], "inner": 0.14, "body": [0.0, 0.03], "spec_min": 25},
    # smooth clear bulb standing in a wide clear dish, both on the mat
    "IMG_0690": {"foot": [1044, 2150, [200, 200], 90, 2.4, 110, 80], "fill": True, "disc": [1042, 2293, 318, 204, 22], "glass": [1722, 2600], "stem": [1017, 1735, 1078, 2185],
                 "plate": [955, 1690, 1140, 1736], "texture": False},
    # smooth clear vase on the mat (MOZE seen through its bottom)
    "IMG_0695": {"foot": [1000, 2320, [269, 271], 210, 2.2, 60, 60], "fill": True, "glass": [1700, 2600], "stem": [958, 1745, 1018, 2188],
                 "keep_above": [988, 1703, 100, 42], "texture": False, "tex_to": 2030, "rim": [0.0, 2.0, 0.06], "inner": 0.14, "body": [0.0, 0.04], "spec_min": 80, "tex": [20, 2.4], "streaks": [1750, 2250, 10],
                 "spec_off": [[955, 2190, 1000, 2255]],
                 "arcs": [[997, 2396, 163, 116, 350, 550, 0.07, 3.2], [997, 2396, 163, 116, 170, 370, 0.04, 3.2]],
                 "thick": [[997, 2396, 163, 116, 2470, 0.12]]},
    # smooth clear bell base on the mat (MOZE seen through it); thick glass lip and a black grommet under the gold top
    "IMG_0700": {"foot": [940, 2340, [355, 352], 197, 2.0, 0, 60], "fill": True, "glass": [1520, 2600], "stem": [912, 1600, 965, 2185],
                 "keep_above": [958, 1530, 140, 38], "keep_band": [[958, 1560, 150, 36, 41, 848, 1062]], "texture": False,
                 "tex_to": 2080, "rim": [0.0, 2.0, 0.06], "inner": 0.14, "body": [0.0, 0.04], "spec_min": 80, "tex": [20, 2.4], "streaks": [1650, 2080, 10], "spec_off": [[945, 2200, 970, 2240], [955, 2415, 1005, 2455]],
                 "arcs": [[940, 2340, 343, 187, 15, 165, 0.0, 3.0], [940, 2340, 349, 193, 140, 200, 0.05, 2.5, 180]],
                 "thick": [[940, 2340, 343, 187, 2460, -0.10]],
                 "bridge": [[1990, 2100, "left"], [2140, 2300, "right"], [2245, 2310, "left"]]},
    # blue swirl glass bell on a wide clear foot, on the mat
    "IMG_0698": {"foot": [1011, 2320, [282, 281], 195, 2.5, 0, 60], "fill": True, "glass": [2040, 2600], "holes": True,
                 "erase": [[845, 2030, 896, 2095], [1122, 2030, 1200, 2098]], "keep_above": [998, 2060, 120, 50],
                 "inset": [[2030, 2104, 11, "right"], [2030, 2100, 5, "left"]],
                 "keep_colour": [[700, 2040, 1330, 2430, 20, 1013, 2228, 228, 150]], "texture": False},
    # smoked textured glass, off the mat: the cut-out took some of the counter's shadow along the foot
    "IMG_0674": {"foot": [976, 2331, [325, 327], 236, 2.0, 0, 60], "fill": True},
    "IMG_0678": {"foot": [955, 2342, [293, 295], 207, 2.0, 0, 60], "fill": True},
    # yellow frit base on the mat: two mat-tooth stubs on the shoulders
    "IMG_0699": {"foot": [977, 2293, [204, 205], 133, 2.0, 0, 60], "fill": True,
                 "bridge": [[2128, 2200, "right"], [2122, 2190, "left"], [2205, 2292, "left"]],
                 "inset": [[2300, 2425, 3, "left"]]},
    # green moulded glass base on the mat; white ceramic-look base on the mat (teeth round both feet)
    "IMG_0683": {"foot": [1015, 2345, [282, 274], 183, 2.3, 60, 60], "fill": True, "smooth": [700, 1340, 70, 30]},
    "IMG_0688": {"foot": [1018, 2255, [376, 378], 245, 2.0, 0, 60], "fill": True, "glass": [1700, 2100], "stem": [987, 1700, 1043, 2050],
                 "plate": [880, 1690, 1150, 1731], "keep_below": [1018, 2047, 182, 36],
                 "retouch": [[1322, 2252, 1352, 2282]]},
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
                d = p1 - p0
                if d * m0 > 0 and abs(m0 * n) > 3 * abs(d):
                    m0 = 3 * d / n                  # a steeper start would swing the curve past the full width
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
    a = np.where(y < y1 - end, side, cap) * (y >= y0) * (y <= y1)       # nothing below the round end
    return nd.gaussian_filter(a, 0.8)


def band_alpha(h, w, b):
    """A band round a cylindrical base: between an ellipse's lower arc and the same arc t px lower (soft edges).
    Drawn from geometry, not from dark pixels: the mat's black ink touches the band and is just as dark."""
    cx, cy, rx, ry, t = b[:5]
    k = b[5] if len(b) > 5 else 2.0
    y, x = np.mgrid[0:h, 0:w].astype(float)
    u = np.clip(np.abs(x - cx) / rx, 0, 1)
    arc = cy + ry * (1 - u ** k) ** (1 / k)
    return np.clip(y - arc + 0.5, 0, 1) * np.clip(arc + t - y + 0.5, 0, 1) * np.clip(rx - np.abs(x - cx) + 0.5, 0, 1)


def smooth_rim(rgb, sil, sm):
    """Blur a base's bottom rim along the outline: rows are counted up from the outline's lowest pixel per column."""
    x0, x1, depth, sig = sm
    h, w = sil.shape
    inside = sil > 0.5
    bottom = np.where(inside.any(0), h - 1 - np.argmax(inside[::-1], 0), -10 ** 6)
    y = np.arange(h)[:, None]
    v = bottom[None, :] - y
    xs = np.arange(w)[None, :]
    band = inside & (v >= 0) & (v < depth) & (xs >= x0) & (xs < x1)
    acc = np.zeros((depth, w, 3)); cnt = np.zeros((depth, w))
    vv, xx = v[band], np.broadcast_to(xs, (h, w))[band]
    np.add.at(acc, (vv, xx), rgb[band]); np.add.at(cnt, (vv, xx), 1)
    acc = nd.gaussian_filter1d(acc, sig, axis=1, mode="nearest"); cnt = nd.gaussian_filter1d(cnt, sig, axis=1, mode="nearest")
    sm_rgb = acc / np.maximum(cnt, 1e-6)[..., None]
    out = rgb.astype(float).copy()
    L = lum(rgb.astype(float)); sat = rgb.max(2).astype(float) - rgb.min(2)
    spec = np.clip((L - 205) / 25, 0, 1) * np.clip((60 - sat) / 20, 0, 1)
    wv = np.clip((depth - v) / 15, 0, 1)                      # eased in over the band's top 15 rows
    wx = np.clip(np.minimum(xs - x0, x1 - xs) / 25, 0, 1)     # and over 25 columns at each end
    wgt = (wv * wx * (1 - spec)) * band
    out[band] = sm_rgb[vv, xx] * wgt[band][:, None] + out[band] * (1 - wgt[band][:, None])
    return out


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


def plates(cfg):
    p = cfg.get("plate", [])
    return [p] if p and not isinstance(p[0], (list, tuple)) else p


def masks(photo, cut_a, cfg):
    """Returns (silhouette alpha 0..1, glass mask, opaque-kept alpha 0..1, mat zone, fine-lettering zone, parts): parts
    are the separate glass pieces whose outlines show inside the silhouette (a base standing in a dish), or []."""
    h, w = cut_a.shape
    sil = cut_a.astype(float) / 255
    parts = []
    if "foot" in cfg:
        if cfg.get("fill"):
            sil = fill_alpha(cut_a, cfg["foot"])
        else:
            sil = sil * foot_alpha(h, w, cfg["foot"])
    if "disc" in cfg:
        cx, cy, rx, ry = cfg["disc"][:4]
        y, x = np.mgrid[0:h, 0:w].astype(float)

        def ellipse(rx, ry):
            r = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
            return np.clip((1 - r) * min(rx, ry) + 0.5, 0, 1)    # soft 1 px edge
        e = ellipse(rx, ry)
        parts = [sil.copy(), e]                                  # the base (its outline seen through the dish) and the dish
        if len(cfg["disc"]) > 4:                                 # the dish's wall: its inner edge, t px in
            t = cfg["disc"][4]
            parts.append(ellipse(rx - t, ry - t * ry / rx))
        sil = np.maximum(sil, e)
    if cfg.get("holes"):                                # gaps the cut-out left inside the glass are glass
        sil = np.maximum(sil, nd.binary_fill_holes(sil > 0.5).astype(float))
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
    if "stem_collar" in cfg:                 # the stem seen through a thick collar: the photo's own pixels, half covered
        x0, y0, x1, y1, a = cfg["stem_collar"]
        p = np.zeros((h, w))                 # fading up into the collar, the sides tapered into the glass
        ramp = np.concatenate([np.linspace(0, 1, y1 + 1 - y0) ** 1.5, np.ones(10)])         # held 10 rows into the tube: no dip
        p[y0:y1 + 11, x0:x1] = a * ramp[:, None] * np.sin(np.linspace(0.15, np.pi - 0.15, x1 - x0))[None, :] ** 0.5
        opaque = np.maximum(opaque, nd.gaussian_filter(p, 1.5))
    if "keep_below" in cfg:
        cx, cy, rx, ry = cfg["keep_below"]
        y, x = np.mgrid[0:h, 0:w].astype(float)
        arc = np.where(np.abs(x - cx) < rx, cy - ry * np.sqrt(np.clip(1 - ((x - cx) / rx) ** 2, 0, 1)), cy - ry - 60)
        opaque = np.maximum(opaque, np.clip((y - arc) / 10 + 0.5, 0, 1))
    for x0, y0, x1, y1, lv in cfg.get("keep_dark", []):
        d = np.zeros((h, w), bool); d[y0:y1, x0:x1] = lum(photo[y0:y1, x0:x1]) < lv
        d = nd.binary_opening(nd.binary_closing(d, iterations=4), iterations=2)   # one solid piece, no loose strokes
        d = nd.gaussian_filter(d.astype(float), 3) > 0.5                          # with a smooth outline
        opaque = np.maximum(opaque, nd.gaussian_filter(d.astype(float), 1.0))
    for kc in cfg.get("keep_colour", []):
        x0, y0, x1, y1, cv = kc[:5]
        d = np.zeros((h, w), bool)
        box = photo[y0:y1, x0:x1]
        d[y0:y1, x0:x1] = (box.max(2) - np.median(box, 2)) > cv     # one channel well above the other two
        d = nd.binary_opening(d, iterations=3)
        d = nd.binary_fill_holes(nd.binary_closing(d, iterations=8))
        if len(kc) > 5:                             # and above the lower arc of [cx, cy, rx, ry] (a dome's round bottom)
            cx, cy, rx, ry = kc[5:9]
            y, x = np.mgrid[0:h, 0:w].astype(float)
            d &= (y < cy) | (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)
        d = nd.gaussian_filter(nd.binary_opening(d, iterations=6).astype(float), 6) > 0.5   # a smooth outline
        lab, k = nd.label(d)
        if k > 1:                                   # the one big piece: loose bits of coloured reflection are glass
            sizes = nd.sum(d, lab, range(1, k + 1)); d = lab == (1 + int(np.argmax(sizes)))
        opaque = np.maximum(opaque, nd.gaussian_filter(d.astype(float), 1.2))
    for cx, cy, rx, ry, t, x0, x1 in cfg.get("keep_band", []):   # a rubber ring seen through the neck, as one clean band
        y, x = np.mgrid[0:h, 0:w].astype(float)
        arc = cy + ry * np.sqrt(np.clip(1 - ((x - cx) / rx) ** 2, 0, 1))
        xm, hw = (x0 + x1) / 2, (x1 - x0) / 2          # rounded ends, the way a ring bends away round the neck
        r = np.abs((x - xm) / hw) ** 8 + np.abs((y - arc - t / 2) / (t / 2)) ** 2
        b = np.clip((1 - r) * t / 4 + 0.5, 0, 1)
        opaque = np.maximum(opaque, b)
    if "keep_above" in cfg:
        cx, cy, rx, ry = cfg["keep_above"]
        y, x = np.mgrid[0:h, 0:w].astype(float)
        arc = cy + ry * np.sqrt(np.clip(1 - ((x - cx) / rx) ** 2, 0, 1))
        opaque = np.maximum(opaque, np.clip((arc - y) + 0.5, 0, 1))
    for x0, y0, x1, y1 in plates(cfg):
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
    return sil, glass, opaque, mat, fine, parts


def glass_layers(photo, glass, sil, mat, fine, lama, texture=True, rim_from=None, tex=(7, 2.2), borrow=None, parts=(),
                 rim=(0.50, 3.5), tex_to=None, inner_s=0.18, body=(0.05, 0.0), spec_min=0, streaks=None, spec_off=(), tex_median=3, mat_gain=1.0):
    """Returns (dark alpha, highlight alpha) for the glass pixels of a window of the photo."""
    L = lum(photo)
    h, w = L.shape
    sat = photo.max(2) - photo.min(2)
    spec = np.clip((L - 228) / 22, 0, 1) * np.clip((45 - sat) / 15, 0, 1)
    for x0, y0, x1, y1 in spec_off:    # a highlight that reads as a printed mark, not a reflection
        spec[max(y0, 0):max(y1, 0), max(x0, 0):max(x1, 0)] = 0
    if spec_min:                       # lone specks are not highlights: keep only pieces of spec_min px or more, the rest
        lab, k = nd.label(spec > 0.25)  # blurred along with their surround into nothing
        if k:
            sizes = nd.sum(np.ones_like(spec), lab, range(1, k + 1))
            keep = np.concatenate([[False], sizes >= spec_min])[lab]
            spec = spec * nd.gaussian_filter(nd.binary_dilation(keep, iterations=2).astype(float), 1.0)
    if streaks is not None:            # the glass's own thin bright streaks over the plain wall (fainter than a specular)
        y0s, y1s, thr = streaks
        th = L - nd.grey_opening(L, size=(1, 11))       # thin along x: the streaks run down the glass
        st = np.clip((th - thr) / 30, 0, 1) * np.clip((45 - sat) / 15, 0, 1)
        rows = np.arange(h)[:, None]
        st = st * np.clip((rows - y0s) / 30, 0, 1) * np.clip((y1s - rows) / 60, 0, 1)
        lab, n_ = nd.label(nd.binary_closing(st > 0.15, structure=np.ones((15, 3))))   # only long streaks (40 px or more
        # down the glass, gaps under 15 px bridged): short fragments read as scratches
        if n_:
            tall = np.array([0] + [sl[0].stop - sl[0].start for sl in nd.find_objects(lab)])
            st = st * nd.gaussian_filter((tall[lab] >= 40).astype(float), 1.0)
        spec = np.maximum(spec, 0.8 * nd.gaussian_filter(st, 0.8))
    f = np.zeros((h, w))
    wm = 0.0
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
        f = nd.median_filter(f, size=tex_median)                    # single-pixel noise is not texture (cut glass: crinkle)
        # detail only: broad patches are misread backdrop. Over the mat the band stays narrow (7 px) whatever `tex` says
        narrow = np.clip(f - nd.gaussian_filter(f, 7) - 0.02, 0, None) * 2.2 * mat_gain
        f = narrow if tuple(tex) == (7, 2.2) else (1 - wm) * np.clip(f - nd.gaussian_filter(f, tex[0]) - 0.02, 0, None) * tex[1] + wm * narrow
        f = np.clip(f, 0, 1)
        if tex_to is not None:             # texture read only above this row (the wall behind); below it the mat: none
            f = f * np.clip((tex_to - np.arange(h)) / 80, 0, 1)[:, None]
        for x0, y0, x1, y1 in spec_off:    # nor any texture there
            f[max(y0, 0):max(y1, 0), max(x0, 0):max(x1, 0)] = 0
        if borrow is not None:
            yb, dy = borrow
            assert dy > 0, "borrow: dy must be at least 1"
            src = np.zeros_like(f); src[dy:] = f[:-dy]
            ok = np.zeros_like(glass); ok[dy:] = glass[:-dy]
            q = np.clip((np.arange(h) - yb) / 40, 0, 1)[:, None]
            q = q * q * (3 - 2 * q) * ok
            f = np.where(glass, q * src + (1 - q) * f, f)
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
    rim_, inner = np.zeros((h, w)), np.zeros((h, w))
    for k_, m in enumerate([sil] + list(parts)):      # each piece's outline, also where it lies inside another
        inside = m > 0.5
        dist = nd.distance_transform_edt(inside)
        rim_ = np.maximum(rim_, np.where(inside | (k_ == 0), rim[0] * np.exp(-dist / rim[1]) + (rim[2] if len(rim) > 2 else 0.12) * np.exp(-dist / 20.0), 0))
        inner = np.maximum(inner, np.where(inside | (k_ == 0), inner_s * np.exp(-((dist - 6.0) ** 2) / 5.0), 0))
    a_d = 1 - (1 - 0.55 * f) * (1 - rim_) * (1 - body[0])
    hi = 1 - (1 - spec) * (1 - 0.22 * nd.gaussian_filter(f, 1.0)) * (1 - inner) * (1 - body[1])
    if spec_min:                       # and on the finished layer: any bright piece still under spec_min px is toned down
        lab, k = nd.label((hi > 0.45) & glass)
        if k:
            small = np.concatenate([[False], nd.sum(np.ones_like(hi), lab, range(1, k + 1)) < spec_min])[lab]
            small = nd.gaussian_filter(nd.binary_dilation(small, iterations=2).astype(float), 1.0)
            hi = hi * (1 - small) + np.minimum(hi, 0.25) * small
    return np.where(glass, a_d, 0), np.where(glass, hi, 0)


def ell_dist(h, w, cx, cy, rx, ry):
    """Signed distance in px to the ellipse (negative inside) and the angle round it (degrees, 0 right, 90 front)."""
    y, x = np.mgrid[0:h, 0:w].astype(float)
    dx, dy = x - cx, y - cy
    r = np.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
    g = np.sqrt((dx / rx ** 2) ** 2 + (dy / ry ** 2) ** 2) / np.maximum(r, 1e-6)
    return (r - 1) / np.maximum(g, 1e-6), np.degrees(np.arctan2(dy / ry, dx / rx)) % 360


def drawn_edges(h, w, cfg, photo=None):
    """Glass edges the photo shows but the method cannot read over the mat (the thick foot's inner ring, read off the
    photo where it crosses plain ink): `arcs` drawn like the outline, `thick` glass given more body."""
    d_, h_ = np.zeros((h, w)), np.zeros((h, w))
    for arc in cfg.get("arcs", []):
        cx, cy, rx, ry, a0, a1, s, wd = arc[:8]
        dist, ang = ell_dist(h, w, cx, cy, rx, ry)
        if len(arc) > 8:                                 # lit from angle arc[8]: strongest there, a third as strong opposite
            s = s * (0.67 + 0.33 * np.cos(np.radians(ang - arc[8])))
        span = (ang - a0) % 360
        len_ = a1 - a0                                   # 360 or more: the whole ring, no ends
        fade = np.ones((h, w)) if len_ >= 360 else np.clip(np.minimum(span, len_ - span) / 18, 0, 1) * (span <= len_)
        fade = fade * fade * (3 - 2 * fade)
        d_ = 1 - (1 - d_) * (1 - s * fade * np.exp(-(dist / wd) ** 2))
        if photo is not None:            # the ring's highlight only where the photo shows it bright (near-white, not the ink)
            Lm = nd.gaussian_filter(nd.grey_dilation(lum(photo), size=5), 2)
            lit = np.clip((Lm - 205) / 40, 0, 1) * np.clip(1 - np.abs(dist) / (3 * wd), 0, 1)
            h_ = 1 - (1 - h_) * (1 - 0.7 * fade * lit * np.exp(-((dist + 1.2 * wd) / wd) ** 2))
        else:
            h_ = 1 - (1 - h_) * (1 - 0.6 * s * fade * np.exp(-((dist + 1.6 * wd) / (0.7 * wd)) ** 2))
    for cx, cy, rx, ry, y0, s in cfg.get("thick", []):
        dist, _ = ell_dist(h, w, cx, cy, rx, ry)
        q = np.clip((np.arange(h) - y0) / 30, 0, 1)[:, None] * np.clip(dist / 3, 0, 1)
        if s < 0:                                        # negative: the face reads lighter (white body), never darker
            h_ = 1 - (1 - h_) * (1 + s * q)
        else:
            d_ = 1 - (1 - d_) * (1 - s * q)
    return d_, h_


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
    sil, glass, opaque, mat, fine, parts = masks(photo, cut[..., 3], cfg)
    if "stem_collar" in cfg:                # the collar's pixels are its glint, not the stem: the stem's own pixels from just
        x0, y0, x1, y1, _ = cfg["stem_collar"]   # below the collar, cloned upward (mirrored, so the seam at y1 matches)
        tone = np.median(cut[y1 + 30:y1 + 130, x0:x1, :3].astype(float), axis=0)          # the tube's own cross-section
        wgt = np.clip((y1 + 20 - np.arange(y0, y1 + 20)) / 20, 0, 1)[:, None, None]          # eased into the tube below
        cut[y0:y1 + 20, x0:x1, :3] = (wgt * tone[None] + (1 - wgt) * cut[y0:y1 + 20, x0:x1, :3]).astype(np.uint8)
    if "band" in cfg:                       # the band is black rubber: light bits caught in its outline (the glass's rim,
        h, w = sil.shape                    # a mat tooth) take the band's own dark colour
        ba = band_alpha(h, w, cfg["band"]) > 0.5
        for x0, y0, x1, y1 in plates(cfg):
            ba[y0 - 2:y1 + 2, x0 - 2:x1 + 2] = False
        rgb = cut[..., :3].astype(float); L = lum(rgb)
        dark = ba & (L < 60)
        if dark.any():
            col = np.median(rgb[dark], 0)
            wgt = np.clip((L - 60) / 40, 0, 1) * ba
            cut[..., :3] = (rgb * (1 - wgt[..., None]) + col * wgt[..., None]).clip(0, 255).astype(np.uint8)
    if "smooth" in cfg:
        cut[..., :3] = smooth_rim(cut[..., :3].astype(float), sil, cfg["smooth"]).clip(0, 255).astype(np.uint8)
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
        a_d[w], hi[w] = glass_layers(photo[w], glass[w], sil[w], mat[w], fine[w], lama, texture=(method == "ratio" and (cfg.get("texture", True) or "tex_to" in cfg)),
                                     rim_from=rim_from, tex=cfg.get("tex", (7, 2.2)),
                                     borrow=(cfg["borrow"][0] - y0, cfg["borrow"][1]) if "borrow" in cfg else None,
                                     parts=[p_[w] for p_ in parts], rim=cfg.get("rim", (0.50, 3.5)),
                                     tex_to=cfg["tex_to"] - y0 if "tex_to" in cfg else None,
                                     inner_s=cfg.get("inner", 0.18), body=cfg.get("body", (0.05, 0.0)), spec_min=cfg.get("spec_min", 0),
                                     streaks=(cfg["streaks"][0] - y0, cfg["streaks"][1] - y0, cfg["streaks"][2]) if "streaks" in cfg else None,
                                     spec_off=[(a - x0, b - y0, c - x0, d - y0) for a, b, c, d in cfg.get("spec_off", [])],
                                     tex_median=cfg.get("tex_median", 3), mat_gain=cfg.get("mat_gain", 1.0))
        if "arcs" in cfg or "thick" in cfg:
            e_d, e_h = drawn_edges(*glass.shape, cfg, photo)
            a_d = np.where(glass, 1 - (1 - a_d) * (1 - e_d), 0); hi = np.where(glass, 1 - (1 - hi) * (1 - e_h), 0)
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
