"""Lay the cut-out product inside one drawn clear bag, framed like the store's hose photos.

Frame (store/tools/catalog/photos.py, matte.py): 720x900 canvas, subject 810 px tall (or 630 wide), 45 px foot,
centred; drawn at 1440x1800 and Lanczos-reduced. The subject is the drawn bag.
Bag (identical for every hose; only its size follows the real bag):
  behind the product : film fill, white 5 % (8 % toward the side folds)
  over the product   : 3 vertical shine streaks (same x fractions, same light from the left), header heat-seal band
                       with fine crimp lines, bottom seal line, crisp 1 px white edge with a faint dark hairline outside
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from plate import WD, BAGS

from cfgload import CFG
OUT = WD / "out"; OUT.mkdir(exist_ok=True)
K = 2                      # draw at 2x of 720x900
W, H, PROD_H, FOOT, MAXW = 720 * K, 900 * K, 810 * K, 45 * K, 630 * K

LOOK = dict(fill=0.06, fill_side=0.17, side_w=0.06, edge=0.62, hair=0.10, radius=0.008,
            seal_h=0.040, seal=0.15, seal_line=0.42, crimp=0.07, bot_seal_h=0.022, bot_seal=0.15,
            shadow=0.16, shadow_blur=8, shadow_off=(3, 6),
            streaks=[(0.15, 0.050, 0.14), (0.235, 0.0065, 0.32), (0.205, 0.016, 0.10), (0.865, 0.022, 0.13)])
BASE_LOOK = dict(LOOK)
BAG_W, BAG_H = 385 * K, 810 * K          # one bag for every hose
M_SIDE, M_TOP, M_BOT = 0.035, 0.022, 0.032  # product inset inside the bag (fractions of bag size; top is below the seal)


def rrect_sdf(X, Y, x0, y0, x1, y1, r):
    cx, cy, bx, by = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    qx, qy = np.abs(X - cx) - bx + r, np.abs(Y - cy) - by + r
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def over(dst, rgb, a):
    """dst: HxWx4 float premultiplied-free RGBA in 0..1; paint colour rgb (3,) or HxWx3 with alpha a."""
    a = a[..., None]
    da = dst[..., 3:4]
    oa = a + da * (1 - a)
    dst[..., :3] = np.where(oa > 0, (rgb * a + dst[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-6), 0)
    dst[..., 3:4] = oa


def bag_rect(name, cut):
    c, s = CFG[name], BAGS[name]
    fw, fh = 3024, 4032
    x0c, y0c = c["crop"][:2]
    l = np.mean(s["l"]) * fw - x0c; r = np.mean(s["r"]) * fw - x0c
    t = s["top"] * fh - y0c; b = min(1, s["bottom"]) * fh - y0c
    if "bag" in c:
        l, t, r, b = c["bag"]
    A = np.asarray(cut.getchannel("A")) > 128
    ys, xs = np.nonzero(A)
    m = 0.02 * (r - l)
    l, r = min(l, xs.min() - m), max(r, xs.max() + m)
    t, b = min(t, ys.min() - m), max(b, ys.max() + m * 0.5)
    return l, t, r, b


def compose(name):
    c = CFG[name]
    global LOOK
    LOOK = {**BASE_LOOK, **c.get("look", {})}   # per-photo override, e.g. a shine streak moved off the print ("streak_dx")
    if "streak_dx" in c:
        LOOK["streaks"] = [(x + c["streak_dx"].get(str(i), 0), w, a) for i, (x, w, a) in enumerate(BASE_LOOK["streaks"])]
    cut = Image.open(WD / "cut" / f"{name}.png")
    if c.get("rotate"):
        cut = cut.rotate(c["rotate"], resample=Image.BICUBIC, expand=True)
    A = np.asarray(cut.getchannel("A")) > 128
    ys, xs = np.nonzero(A)
    l, t, r, b = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    cut = cut.crop((l, t, r, b))
    ow, oh = BAG_W, BAG_H
    ox, oy = (W - ow) / 2, H - FOOT - oh
    seal = LOOK["seal_h"] * oh
    mb = 0 if c.get("bottom_cut") else M_BOT * oh
    iw, ih = ow * (1 - 2 * M_SIDE), oh - seal - M_TOP * oh - mb
    s = min(iw / cut.width, ih / cut.height)
    prod = cut.resize((round(cut.width * s), round(cut.height * s)), Image.LANCZOS)
    P = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if c.get("top_cut"):   # the photo cuts the product off at the top: it runs up under the header seal
        ih = oh - seal * 0.5 - mb
        s = min(iw / cut.width, ih / cut.height)
        prod = cut.resize((round(cut.width * s), round(cut.height * s)), Image.LANCZOS)
    bot = oy + oh - (LOOK["bot_seal_h"] * oh * 0.5 if c.get("bottom_cut") else mb)
    if c.get("top_cut"):
        bot = oy + seal * 0.5 + prod.height
    elif not c.get("bottom_cut"):   # a short product (a coil) sits in the middle of the bag, not slumped at its foot
        bot -= (ih - prod.height) / 2
    px, py = round(ox + (ow - prod.width) / 2), round(bot - prod.height)
    P.alpha_composite(prod, (px, py))
    rot = c.get("rotate", 0)
    (OUT / f"{name}-map.json").write_text(json.dumps(dict(l=int(l), t=int(t), s=s, px=px, py=py, K=K, rotate=rot)))
    P = np.asarray(P).astype(np.float32) / 255
    if c.get("seal_fade"):   # a product the photo cuts off fades into the seal it runs under, not a square photo edge
        f = c["seal_fade"] * K
        yy = np.arange(H, dtype=np.float32)[:, None]
        if c.get("top_cut"):
            P[..., 3] *= np.clip((yy - py) / f, 0, 1)
        if c.get("bottom_cut"):
            P[..., 3] *= np.clip((py + prod.height - yy) / f, 0, 1)
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    x0, y0, x1, y1 = ox, oy, ox + ow, oy + oh
    sd = rrect_sdf(X, Y, x0, y0, x1, y1, LOOK["radius"] * ow)
    inside = np.clip(0.5 - sd, 0, 1)
    u = np.clip((X - x0) / ow, 0, 1); v = np.clip((Y - y0) / oh, 0, 1)
    white = np.array([1, 1, 1], np.float32)
    D = np.zeros((H, W, 4), np.float32)
    # film fill, a touch denser toward the side folds
    side = np.exp(-((u / LOOK["side_w"]) ** 2)) + np.exp(-(((1 - u) / LOOK["side_w"]) ** 2))
    over(D, white, inside * (LOOK["fill"] + LOOK["fill_side"] * side))
    # soft contact shadow of the product on the back film
    sa = nd.gaussian_filter(P[..., 3], LOOK["shadow_blur"] * K)
    sa = nd.shift(sa, (LOOK["shadow_off"][1] * K, LOOK["shadow_off"][0] * K), order=1)
    over(D, np.array([0.08, 0.06, 0.05], np.float32), sa * LOOK["shadow"] * inside)
    # product inside the bag (clipped to it)
    over(D, P[..., :3], P[..., 3] * inside)
    # shine streaks, vertical, fading in under the seal and out near the foot
    env = np.clip((v - LOOK["seal_h"]) / 0.06, 0, 1) * np.clip((1 - v - LOOK["bot_seal_h"]) / 0.10, 0, 1)
    env = env * (0.85 + 0.15 * np.cos(v * np.pi * 1.3))
    sh = np.zeros_like(u)
    for cx, sg, pk in LOOK["streaks"]:
        sh = 1 - (1 - sh) * (1 - pk * np.exp(-0.5 * ((u - cx) / sg) ** 2))
    over(D, white, sh * env * inside)
    # header heat-seal: denser band, fine crimp lines, a crisp seal line at its foot
    hs = LOOK["seal_h"] * oh
    band = (Y < y0 + hs) * inside
    crimp = (np.sin((Y - y0) / (2.2 * K) * np.pi) > 0.6) * LOOK["crimp"]
    over(D, white, band * (LOOK["seal"] + crimp))
    line = np.clip(1 - np.abs(Y - (y0 + hs)) / (0.75 * K), 0, 1) * inside
    over(D, white, line * LOOK["seal_line"])
    bsl = np.clip(1 - np.abs(Y - (y1 - LOOK["bot_seal_h"] * oh)) / (0.75 * K), 0, 1) * inside
    over(D, white, bsl * LOOK["seal_line"] * 0.8)
    bcrimp = (np.sin((Y - y1) / (2.2 * K) * np.pi) > 0.6) * LOOK["crimp"]
    over(D, white, (Y > y1 - LOOK["bot_seal_h"] * oh) * inside * (LOOK["bot_seal"] + bcrimp))
    # edge: crisp white line on the outline, faint dark hairline just outside it
    edge = np.clip(1 - np.abs(sd + 0.6 * K) / (0.6 * K), 0, 1)
    over(D, white, edge * LOOK["edge"])
    hair = np.clip(1 - np.abs(sd - 0.9 * K) / (0.8 * K), 0, 1)
    over(D, np.array([0.05, 0.04, 0.03], np.float32), hair * LOOK["hair"])
    out = Image.fromarray((np.clip(D, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
    out.save(OUT / f"{name}-l.png")
    out.resize((720, 900), Image.LANCZOS).save(OUT / f"{name}.png")
    print(name, "bag px at 720:", round(ow / K), "x", round(oh / K), "product scale", round(s, 3))


if __name__ == "__main__":
    for n in sys.argv[1:]:
        compose(n)
