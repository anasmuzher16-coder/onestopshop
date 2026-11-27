"""Clear the shop wall seen through the clear bag, so each card's own tile colour shows through (owner 2026-11-27).

Starts from the shipped matte (matte.py, same framing, same bbox) and changes only two things:
  1. WALL: pixels inside the bag outline that look like the wall (no colour of their own, not darker than the local
     wall estimate) AND are connected, without crossing any non-wall pixel, to the wall-coloured band just inside the bag
     edge, whose colour also matches the wall beside the bag. Those go to alpha ~0; the film's bright specular streaks are
     kept at modest alpha as white. Anything fenced in by print, hose or card edges (card whites, white hoses, white print)
     is never reached, so it is left exactly as shipped. When in doubt the pixel is kept.
  2. CARD: per-photo card regions (CARDS) where printed white card ink had gone see-through: the photo pixel at full
     opacity (no invented pixels).
usage: clean.py [names...]
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SP = Path(r"C:\Users\anasm\AppData\Local\Temp\claude\4aea0a693923d208\2e9104f4-ae4d-4888-ac56-0336af4e029a\scratchpad")
sys.path.insert(0, str(SP / "hose-scripts"))
import matte as M  # noqa: E402

import os
TAG = os.environ.get("CLEAN_TAG", "")
OUT = SP / "hoseclean" / ("out" + TAG); OUT.mkdir(parents=True, exist_ok=True)
DBG = SP / "hoseclean" / ("dbg" + TAG); DBG.mkdir(parents=True, exist_ok=True)
_cf = SP / "hose-scripts" / f"clean-cfg{TAG}.json"
CFG = json.loads(_cf.read_text()) if _cf.exists() else {}


def smooth01(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def plate(I, spec):
    h, w = I.shape[:2]
    ys = np.arange(h)
    xl = (M.edge_x(spec["l"][0], spec["l"][1], ys / h, spec["top"], spec["bottom"]) - M.GROW) * w
    xr = (M.edge_x(spec["r"][0], spec["r"][1], ys / h, spec["top"], spec["bottom"]) + M.GROW) * w
    Lc = np.zeros((h, 3), np.float32); Rc = np.zeros((h, 3), np.float32)
    for y in range(h):
        a0, a1 = int(max(0, xl[y] - M.S1 * w)), int(max(1, xl[y] - M.S0 * w))
        b0, b1 = int(min(w - 1, xr[y] + M.S0 * w)), int(min(w, xr[y] + M.S1 * w))
        Lc[y] = np.median(I[y, a0:a1], 0) if a1 > a0 else I[y, 0]
        Rc[y] = np.median(I[y, b0:b1], 0) if b1 > b0 else I[y, -1]
    Lc = nd.median_filter(Lc, size=(9, 1)); Rc = nd.median_filter(Rc, size=(9, 1))
    X = np.arange(w)[None, :]
    t = np.clip((X - xl[:, None]) / np.maximum(1, (xr - xl)[:, None]), 0, 1)[..., None]
    return Lc[:, None, :] * (1 - t) + Rc[:, None, :] * t, xl, xr


def clean(name, spec):
    cfg = CFG.get(name, {})
    rgba0, (yt, yb, xl, xr) = M.matte(name, spec)
    A0 = np.asarray(rgba0).astype(np.float32)
    a0, C0 = A0[..., 3] / 255, A0[..., :3]
    im = Image.open(M.FULL / f"{name}.jpg").convert("RGB")
    s = M.WORK_H / im.height
    im = im.resize((round(im.width * s), M.WORK_H), Image.LANCZOS)
    I = np.asarray(im).astype(np.float32)
    h, w = I.shape[:2]
    B, xl, xr = plate(I, spec)
    X = np.arange(w)[None, :]; Y = np.arange(h)[:, None]
    inside = (X >= xl[:, None]) & (X <= xr[:, None]) & (Y >= yt) & (Y < yb)
    # local wall estimate seen through the film: a wide median (ignores thin print, streaks and narrow hose runs)
    q = 4
    small = np.asarray(im.resize((w // q, h // q), Image.BILINEAR)).astype(np.float32)
    med = np.dstack([nd.median_filter(small[..., k], size=cfg.get("med", 15)) for k in range(3)])
    W = np.asarray(Image.fromarray(med.clip(0, 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)).astype(np.float32)
    W = nd.gaussian_filter(W, (3, 3, 0))
    L, WL = I.mean(-1), W.mean(-1)
    dL = L - WL
    c = np.sqrt((((I - L[..., None]) - (W - WL[..., None])) ** 2).sum(-1))
    d = np.maximum(0, -dL)
    cmax, dmax = cfg.get("c", 12), cfg.get("d", 14)
    # not darker than the wall beside the bag (a large black hose would otherwise match its own wide median)
    wall = inside & (c < cmax) & (d < dmax) & (L > cfg.get("minL", 60)) & (L > B.mean(-1) - cfg.get("pdark", 20))
    # the pixel must also be close to the wall beside the bag (plate) in colour, so card whites of another tint stay
    cb = np.sqrt((((I - L[..., None]) - (B - B.mean(-1, keepdims=True))) ** 2).sum(-1))
    wall &= cb < cfg.get("cb", 16)
    # texture fence: dark-side edges (hose ribs, print, card edges, white hose shading) block the fill; the film's bright
    # crinkles are clamped to the wall level first, so they never fence anything
    Lc = nd.gaussian_filter(np.minimum(L, WL), 0.8)
    g = np.hypot(nd.sobel(Lc, 0), nd.sobel(Lc, 1)) / 8
    fence = nd.binary_dilation(g > cfg.get("grad", 4.0), iterations=1)
    wall &= ~fence
    lab, n = nd.label(wall)  # 4-connected: no diagonal leaks through 1 px print gaps
    band = cfg.get("band", 0.03) * w
    near_edge = inside & ((X - xl[:, None] < band) | (xr[:, None] - X < band) | (Y - yt < band * 0.6) | (yb - Y < band * 0.6))
    seed = wall & near_edge & (np.abs(I - B).max(-1) < cfg.get("seedtol", 22))
    keep_ids = np.unique(lab[seed]); keep_ids = keep_ids[keep_ids > 0]
    reached = np.isin(lab, keep_ids)
    # large interior islands of plain wall between hose loops, only where a photo is allowed it after a look
    if cfg.get("islands"):
        sizes = nd.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
        # the island must continue the wall beside the bag row by row: most of its pixels within tol of the plate
        frac = nd.mean((np.abs(I - B).max(-1) < cfg.get("island_tol", 16)).astype(np.float32), lab, index=np.arange(1, n + 1))
        ok = np.where((sizes > cfg.get("island_px", 3000)) & (frac > cfg.get("island_frac", 0.85)))[0] + 1
        reached |= np.isin(lab, ok)
    for r in cfg.get("never", []):  # [x0,y0,x1,y1] fractions: never cleared (packaging found white-on-white)
        x0, y0, x1, y1 = (int(r[0] * w), int(r[1] * h), int(r[2] * w), int(r[3] * h))
        reached[y0:y1, x0:x1] = False
    # tiny unreached specks wholly inside the cleared film (crinkle shadows): cleared too, so no flecks
    holes = nd.binary_fill_holes(reached) & ~reached
    hl, hn = nd.label(holes)
    if hn:
        hs = nd.sum(np.ones_like(hl), hl, index=np.arange(1, hn + 1))
        hc = nd.maximum(c, hl, index=np.arange(1, hn + 1))
        hd = nd.maximum(d, hl, index=np.arange(1, hn + 1))
        small_ids = np.where((hs < cfg.get("speck", 120)) & (hc < 24) & (hd < 40))[0] + 1
        reached |= np.isin(hl, small_ids)
    # smooth ramp: soft against the thresholds, then a light blur, never past the reached set's 2 px margin
    soft = smooth01(cmax + 2 - c, 0, 5) * smooth01(dmax + 2 - d, 0, 6)
    wgt = nd.gaussian_filter(reached.astype(np.float32), 1.4) * np.maximum(soft, reached * 0.0)
    wgt = np.where(nd.binary_dilation(reached, iterations=2), wgt, 0)
    wgt = np.clip(wgt * nd.gaussian_filter(inside.astype(np.float32), 1.2), 0, 1)
    # the film's own specular streaks: brighter than the wall, kept as white at modest alpha
    fa = smooth01(dL, cfg.get("spec0", 10), cfg.get("spec1", 70)) * cfg.get("specmax", 0.55)
    fa = nd.gaussian_filter(fa, 0.7)
    fa = np.minimum(fa, a0)
    Cf = np.clip((I - (1 - fa[..., None]) * W) / np.maximum(fa[..., None], 1e-3), 0, 255)
    A = a0 * (1 - wgt) + wgt * fa
    Cp = C0 * (a0 * (1 - wgt))[..., None] + Cf * (wgt * fa)[..., None]
    C = Cp / np.maximum(A[..., None], 1e-4)
    # printed card regions whose white ink had gone see-through: the photo itself, opaque
    cms = [card_mask(I, poly, h, w) for poly in cfg.get("cards", [])]
    if cfg.get("navy"):
        cms.append(navy_card(I, inside))
    for cm in cms:
        A = A * (1 - cm) + cm
        C = C * (1 - cm[..., None]) + I * cm[..., None]
    out = np.dstack([np.clip(C, 0, 255), np.clip(A * 255, 0, 255)]).astype(np.uint8)
    out[A < 0.004] = 0
    dbg = np.dstack([reached * 255, wall * 255, seed * 255]).astype(np.uint8)
    Image.fromarray(dbg).resize((w // 3, h // 3)).save(DBG / f"{name}-mask.png")
    drop = np.clip(a0 - A, 0, 1)
    vis = np.dstack([I, np.full((h, w), 255.0)])
    vis[..., :3] = vis[..., :3] * (1 - drop[..., None] * 0.85) + np.array([255, 0, 200]) * drop[..., None] * 0.85
    return Image.fromarray(out, "RGBA"), rgba0, Image.fromarray(vis.astype(np.uint8), "RGBA")


def card_mask(I, poly, h, w):
    """poly: list of [x,y] fractions (the card's printed edge, read off the photo); soft 1.5 px edge."""
    from PIL import ImageDraw
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon([(x * w, y * h) for x, y in poly], fill=255)
    return nd.gaussian_filter(np.asarray(m).astype(np.float32) / 255, 1.0)


def navy_card(I, inside):
    """Platinum's printed navy card: the convex hull of its navy ink (blue over red, dark) inside the bag, edge 1 px soft.
    Its white lettering sits inside the hull, so it comes back opaque from the photo."""
    from scipy.spatial import ConvexHull
    from PIL import ImageDraw
    h, w = I.shape[:2]
    navy = inside & (I[..., 2] - I[..., 0] > 18) & (I.mean(-1) < 120)
    navy = nd.binary_opening(navy, iterations=3)
    lab, n = nd.label(navy)
    sizes = nd.sum(navy, lab, index=np.arange(1, n + 1))
    big = np.isin(lab, np.where(sizes > 0.02 * sizes.sum())[0] + 1)
    ys, xs = np.nonzero(big)
    pts = np.c_[xs, ys]
    hull = pts[ConvexHull(pts).vertices]
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in hull], fill=255)
    return nd.gaussian_filter(np.asarray(m).astype(np.float32) / 255, 0.8)


def save_set(cut, name, outdir):
    for suf, (cw, ch), q in M.SIZES:
        if suf == "-l":
            continue
        k = cw / M.W
        s = min(M.PROD_H * k / cut.height, M.MAXW * k / cut.width)
        r = cut.resize((max(1, round(cut.width * s)), max(1, round(cut.height * s))), Image.LANCZOS)
        c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        c.alpha_composite(r, ((cw - r.width) // 2, ch - round(M.FOOT * k) - r.height))
        c.save(outdir / f"{name}{suf}.webp", "WEBP", quality=q, method=4)
        if suf == "":
            c.save(outdir / f"{name}.png")


if __name__ == "__main__":
    names = sys.argv[1:] or list(M.BAGS)
    for n in names:
        new, old, vis = clean(n, M.BAGS[n])
        _, _, bb = M.frame(old)  # the shipped crop box: framing unchanged
        save_set(new.crop(bb), n, OUT)
        v = vis.crop(bb); s = min(810 / v.height, 630 / v.width); v = v.resize((round(v.width * s), round(v.height * s)), Image.LANCZOS)
        c = Image.new("RGBA", (720, 900), (40, 40, 40, 255)); c.paste(v, ((720 - v.width) // 2, 900 - 45 - v.height)); c.convert("RGB").save(DBG / f"{n}-removed.png")
        print(n, bb)
