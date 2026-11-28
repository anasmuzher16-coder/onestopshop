"""Shared: load full photo, wall plate from strips beside the bag outline (as matte.py), at full resolution."""
import json, os
from pathlib import Path
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd

SP = Path(os.environ.get("HOSE_WORK", "."))   # folder holding hoses-work/full/IMG_xxxx.jpg and hose-drawnbag/
FULL = SP / "hoses-work" / "full"
WD = SP / "hose-drawnbag"
BAGS = json.loads((Path(__file__).parent / "bags.json").read_text())   # the hand-read bag outline per photo
GROW, S0, S1 = 0.012, 0.015, 0.05


def edge_x(top, bot, y, yt, yb):
    t = np.clip((y - yt) / max(1e-6, yb - yt), 0, 1)
    return top + (bot - top) * t


def load(name, spec=None):
    spec = spec or BAGS[name]
    I = np.asarray(Image.open(FULL / f"{name}.jpg").convert("RGB")).astype(np.float32)
    h, w = I.shape[:2]
    ys = np.arange(h)
    yt, yb = int(spec["top"] * h), int(min(1, spec["bottom"]) * h)
    xl0 = edge_x(spec["l"][0], spec["l"][1], ys / h, spec["top"], spec["bottom"]) * w
    xr0 = edge_x(spec["r"][0], spec["r"][1], ys / h, spec["top"], spec["bottom"]) * w
    xl, xr = xl0 - GROW * w, xr0 + GROW * w
    Lc = np.zeros((h, 3), np.float32); Rc = np.zeros((h, 3), np.float32)
    for y in range(h):
        a0, a1 = int(max(0, xl[y] - S1 * w)), int(max(1, xl[y] - S0 * w))
        b0, b1 = int(min(w - 1, xr[y] + S0 * w)), int(min(w, xr[y] + S1 * w))
        Lc[y] = np.median(I[y, a0:a1], 0) if a1 > a0 else I[y, 0]
        Rc[y] = np.median(I[y, b0:b1], 0) if b1 > b0 else I[y, -1]
    Lc = nd.median_filter(Lc, size=(15, 1)); Rc = nd.median_filter(Rc, size=(15, 1))
    X = np.arange(w)[None, :]
    t = np.clip((X - xl[:, None]) / np.maximum(1, (xr - xl)[:, None]), 0, 1)[..., None]
    B = Lc[:, None, :] * (1 - t) + Rc[:, None, :] * t
    inside = (X >= xl0[:, None]) & (X <= xr0[:, None]) & (ys[:, None] >= yt) & (ys[:, None] < yb)
    return I, B, inside, dict(yt=yt, yb=yb, xl=xl0, xr=xr0, w=w, h=h)


def lab(a):
    return cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
