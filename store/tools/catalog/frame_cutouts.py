"""Frame the shop's own product cut-outs like every product on the site.

  python store/tools/catalog/frame_cutouts.py CUTOUT_DIR OUT_DIR --kind bowl|hookah NAME [NAME...]

CUTOUT_DIR holds one RGBA PNG per photo (NAME.png), the product already cut off its background at the photo's full size.
The shop's 2026-11-27 photos were cut with rembg's BiRefNet model (birefnet-general-lite, installed on the laptop by the
owner, 2026-11-27); no model is used here. Each cut-out is cleaned (alpha under 4% is cleared, loose specks under 1% of
the product are dropped) and framed:
  bowl:   like the Ace accessories (photos_acc.py): 720x900, product up to 580 tall / 560 wide, centred both ways;
  hookah: like the Ace hookahs (photos.py): 720x900, product 810 tall (or 630 wide), 45 px foot, centred across;
sizes -m 540x675 and -s 360x450, and -l 1440x1800 only when the product is at least 1100 px tall in the source photo
(so the large size is never an enlargement); Lanczos, WebP method 4, same qualities as photos.py.
Every framed photo is then checked by eye on coal, bone and cobalt tiles before it is published.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

W, H = 720, 900
SIZES = (("-l", (1440, 1800), 86), ("", (720, 900), 86), ("-m", (540, 675), 84), ("-s", (360, 450), 82))
FRAME = {"bowl": (580, 560, None), "hookah": (810, 630, 45)}   # product height, max width, foot (None = centred)
LARGE_FROM = 1100


def clean(rgba: Image.Image) -> Image.Image:
    a = np.asarray(rgba.getchannel("A")).copy()
    a[a < 10] = 0
    mask = a > 40
    lab, k = nd.label(mask, structure=np.ones((3, 3)))
    if k > 1:
        sizes = nd.sum(mask, lab, range(1, k + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 0.01 * sizes.max()])
        a = np.where(nd.binary_dilation(keep, iterations=3), a, 0).astype(np.uint8)
    out = np.asarray(rgba).copy()
    out[..., 3] = a
    out[a == 0] = 0
    return Image.fromarray(out, "RGBA")


def trim_base(rgba: Image.Image, below: int) -> Image.Image:
    """Below row `below`, keep only what lies inside the convex hull of the base's own warm-coloured glass (red/orange),
    which takes off a display stand and table showing round a coloured glass base (IMG_0713, the Rose hookah: below=3560)."""
    from scipy.spatial import ConvexHull, Delaunay
    c = np.asarray(rgba).copy()
    R, G, B, A = (c[..., i].astype(int) for i in range(4))
    top = max(0, below - 40)
    warm = (R > B + 50) & (R > 110) & (A > 200)
    warm[:top] = False
    warm = nd.binary_opening(warm, iterations=3)
    ys, xs = np.nonzero(warm)
    pts = np.c_[xs, ys][::7]
    hull = Delaunay(pts[ConvexHull(pts).vertices])
    yy, xx = np.mgrid[top:c.shape[0], 0:c.shape[1]]
    inside = (hull.find_simplex(np.c_[xx.ravel(), yy.ravel()]) >= 0).reshape(xx.shape)
    inside = nd.binary_erosion(inside, iterations=2)[below - top:]
    a = c[..., 3].copy()
    a[below:] = np.where(inside, a[below:], 0)
    c[..., 3] = a
    c[a == 0] = 0
    return Image.fromarray(c, "RGBA")


def frame(rgba: Image.Image, out: Path, name: str, kind: str):
    prod_h, maxw, foot = FRAME[kind]
    bb = rgba.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    piece = rgba.crop(bb)
    made = []
    for suf, (cw, ch), q in SIZES:
        if suf == "-l" and piece.height < LARGE_FROM:
            continue
        k = cw / W
        s = min(prod_h * k / piece.height, maxw * k / piece.width)
        r = piece.resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS)
        c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        y = (ch - r.height) // 2 if foot is None else ch - round(foot * k) - r.height
        c.alpha_composite(r, ((cw - r.width) // 2, y))
        c.save(out / f"{name}{suf}.webp", "WEBP", quality=q, method=4)
        made.append(suf or "720")
    return made, piece.height


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cutouts"); ap.add_argument("out"); ap.add_argument("names", nargs="+")
    ap.add_argument("--kind", choices=sorted(FRAME), required=True)
    ap.add_argument("--trim-base-below", type=int, help="source row below which only the coloured glass base's own outline is kept")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    for n in a.names:
        im = Image.open(Path(a.cutouts) / f"{n}.png").convert("RGBA")
        if a.trim_base_below:
            im = trim_base(im, a.trim_base_below)
        made, src_h = frame(clean(im), out, n, a.kind)
        print(n, made, f"product {src_h} px tall in the source")
