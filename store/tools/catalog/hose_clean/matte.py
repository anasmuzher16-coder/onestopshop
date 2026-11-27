"""Cut hanging, bagged hoses off the shop's white shelving and frame them like every product on the site.

Method (no model, no download): a hand-read outline of the bag per photo (fractions of the frame), a background plate
estimated row by row from the wall just left and right of the bag (so shelf edges and shadows are carried across), then
known-background matting inside the outline: alpha = the least opacity that explains the pixel against the plate, raised
to opaque where the pixel clearly differs (hose, print), with a faint floor so the clear film still reads as a bag.
Colour is un-mixed from the plate, so the clear film takes on the tile colour instead of carrying the wall with it.
Framed per store/tools/catalog/photos.py: 720x900, product 810 px tall (or 630 wide), 45 px foot, centred; -m 540x675,
-s 360x450, -l 1440x1800; Lanczos; WebP method 4.

usage: matte.py [names...]   (default: all in BAGS)
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SP = Path(r"C:\Users\anasm\AppData\Local\Temp\claude\4aea0a693923d208\2e9104f4-ae4d-4888-ac56-0336af4e029a\scratchpad")
FULL, OUT = SP / "hoses-work" / "full", SP / "hoses-work" / "crops"
OUT.mkdir(parents=True, exist_ok=True)
BAGS = json.loads((SP / "hose-scripts" / "bags.json").read_text())

W, H, PROD_H, FOOT, MAXW = 720, 900, 810, 45, 630
SIZES = (("-l", (1440, 1800), 86), ("", (720, 900), 86), ("-m", (540, 675), 84), ("-s", (360, 450), 82))
WORK_H = 2200
GROW, S0, S1 = 0.012, 0.015, 0.05   # outline grown outward; plate strip from S0 to S1 beyond it (fractions of width)
FLOOR = 0.10                        # the clear film's base opacity


def edge_x(top, bot, y, yt, yb):
    t = np.clip((y - yt) / max(1e-6, yb - yt), 0, 1)
    return top + (bot - top) * t


def matte(name, spec):
    im = Image.open(FULL / f"{name}.jpg").convert("RGB")
    s = WORK_H / im.height
    im = im.resize((round(im.width * s), WORK_H), Image.LANCZOS)
    I = np.asarray(im).astype(np.float32)
    h, w = I.shape[:2]
    yt, yb = int(spec["top"] * h), int(min(1, spec["bottom"]) * h)
    ys = np.arange(h)
    xl = (edge_x(spec["l"][0], spec["l"][1], ys / h, spec["top"], spec["bottom"]) - GROW) * w
    xr = (edge_x(spec["r"][0], spec["r"][1], ys / h, spec["top"], spec["bottom"]) + GROW) * w
    # plate: per row, median of the wall strips either side, smoothed down the column
    Lc = np.zeros((h, 3), np.float32); Rc = np.zeros((h, 3), np.float32)
    for y in range(h):
        a0, a1 = int(max(0, xl[y] - S1 * w)), int(max(1, xl[y] - S0 * w))
        b0, b1 = int(min(w - 1, xr[y] + S0 * w)), int(min(w, xr[y] + S1 * w))
        Lc[y] = np.median(I[y, a0:a1], 0) if a1 > a0 else I[y, 0]
        Rc[y] = np.median(I[y, b0:b1], 0) if b1 > b0 else I[y, -1]
    Lc = nd.median_filter(Lc, size=(9, 1)); Rc = nd.median_filter(Rc, size=(9, 1))
    X = np.arange(w)[None, :]
    t = np.clip((X - xl[:, None]) / np.maximum(1, (xr - xl)[:, None]), 0, 1)[..., None]
    B = Lc[:, None, :] * (1 - t) + Rc[:, None, :] * t
    # known-background alpha
    up = np.where(I > B, (I - B) / np.maximum(1, 255 - B), (B - I) / np.maximum(1, B))
    a_min = up.max(-1)
    D = np.sqrt(((I - B) ** 2).sum(-1))
    lo, hi = spec.get("lo", 22), spec.get("hi", 60)
    a_prod = np.clip((D - lo) / (hi - lo), 0, 1)
    a = np.maximum(np.maximum(a_min, a_prod), FLOOR)
    # wall shadows the side strips cannot see (the round shadow behind the bag, bracket shade): a grey darkening with
    # no colour of its own reads as film, capped faint, never as an opaque grey smear
    dI, dB = I - I.mean(-1, keepdims=True), B - B.mean(-1, keepdims=True)
    chroma = np.sqrt(((dI - dB) ** 2).sum(-1))
    drop = B.mean(-1) - I.mean(-1)
    shade = (drop > 0) & (drop < spec.get("shade", 75)) & (chroma < 16)
    a = np.where(shade, np.minimum(a, np.maximum(FLOOR, 0.22)), a)
    # mild colourless brightening is the film's own sheen: kept as a light veil, not a milky panel (white print, far
    # brighter than the wall, is untouched)
    sheen = (drop <= 0) & (drop > -spec.get("sheen", 0)) & (chroma < 14)
    a = np.where(sheen, np.minimum(a, 0.28), a)
    a = nd.gaussian_filter(a, 0.8)
    # inside the outline only, edge feathered 2 px
    inside = (X >= xl[:, None]) & (X <= xr[:, None]) & (ys[:, None] >= yt) & (ys[:, None] < yb)
    feather = nd.gaussian_filter(inside.astype(np.float32), 1.2)
    a = np.clip(a, 0, 1) * feather
    # clear the film's own soft opacity where a long band of it touches the outline (no hard veil line at the cut)
    C = (I - (1 - a[..., None]) * B) / np.maximum(a[..., None], 1e-3)
    C = np.clip(C, 0, 255)
    rgba = np.dstack([C, a * 255]).astype(np.uint8)
    rgba[a < 0.004] = 0
    return Image.fromarray(rgba, "RGBA"), (yt, yb, xl, xr)


def frame(rgba, prod_h=PROD_H, maxw=MAXW):
    bb = rgba.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    cut = rgba.crop(bb)
    s = min(prod_h / cut.height, maxw / cut.width)
    return cut, s, bb


def save_set(cut, name):
    for suf, (cw, ch), q in SIZES:
        k = cw / W
        s = min(PROD_H * k / cut.height, MAXW * k / cut.width)
        r = cut.resize((max(1, round(cut.width * s)), max(1, round(cut.height * s))), Image.LANCZOS)
        c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        c.alpha_composite(r, ((cw - r.width) // 2, ch - round(FOOT * k) - r.height))
        c.save(OUT / f"{name}{suf}.webp", "WEBP", quality=q, method=4)
        if suf == "":
            c.save(OUT / f"{name}.png")


if __name__ == "__main__":
    names = sys.argv[1:] or list(BAGS)
    rep = {}
    for n in names:
        rgba, _ = matte(n, BAGS[n])
        cut, s, bb = frame(rgba)
        save_set(cut, n)
        rep[n] = {"crop_px_at_work": list(bb), "scale_720": round(s * W / W, 3)}
        print(n, bb, round(s, 3))
    (OUT / "report.json").write_text(json.dumps(rep, indent=1))
