"""Light-blue Starbuzz ribbed (OSS-120032): the teal sibling's cut (IMG_0549, same tube, stem and card) recoloured to the
light-blue hose's own shade, sampled from the shop's group shot (Star_buzz_are_76.5_inches.jpg) and white-balanced on the
bag's barcode label: Lab hue about 262, chroma about 18 (the photo has a violet LED cast, so the hue is the midpoint of the white-balanced samples) at the hose's lightness. Only teal/green pixels move; the card stays."""
import numpy as np, cv2, json, shutil, os
from pathlib import Path
from PIL import Image
WD = Path(os.environ.get("HOSE_WORK", ".")) / "hose-drawnbag"   # the work folder holding cut/ and cfg.d/, as plate.py
src = np.asarray(Image.open(WD / "cut" / "IMG_0549.png")).copy()
rgb, A = src[..., :3], src[..., 3]
L = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
a, b = L[..., 1] - 128, L[..., 2] - 128
ch = np.hypot(a, b); hue = np.degrees(np.arctan2(b, a)) % 360
m = (hue > 120) & (hue < 260) & (ch > 2.5)                      # the teal tube and its dark green stem
pink = (ch > 15) & ((hue < 40) | (hue > 330)) & (A > 128)   # the round Starbuzz card stays as printed
n, lbl, st, _ = cv2.connectedComponentsWithStats(pink.astype(np.uint8), 8)
k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
pts = cv2.findNonZero((lbl == k).astype(np.uint8)); hull = cv2.convexHull(pts)
card = np.zeros(A.shape, np.uint8); cv2.fillConvexPoly(card, hull, 1)
x, y, w_, h_ = cv2.boundingRect(hull)
card = cv2.dilate(card, np.ones((15, 15), np.uint8)) > 0
ribbon = np.zeros(A.shape, bool); ribbon[y + int(0.6 * h_): y + int(1.08 * h_), max(0, x - int(0.2 * w_)): x + int(1.2 * w_)] = True
keep = card | (ribbon & (ch < 9))
m &= ~keep
stem = m & (L[..., 0] < 110)
# the stem is one solid part: take its largest dark piece, close it and fill it, so glare chips on it move too
n2, l2, st2, _ = cv2.connectedComponentsWithStats(stem.astype(np.uint8), 8)
big = l2 == 1 + int(np.argmax(st2[1:, cv2.CC_STAT_AREA]))
big = cv2.morphologyEx(big.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))) > 0
from scipy import ndimage as nd
stem = nd.binary_fill_holes(big) & (A > 60) & ~keep
m |= stem
w = np.maximum(np.clip((ch - 4) / 8, 0, 1), stem.astype(np.float32)) * m
w = cv2.GaussianBlur(w.astype(np.float32), (0, 0), 1.2)
H, C = np.radians(262.0), 18.0
Lt = L[..., 0].copy()
Ls = cv2.GaussianBlur(L[..., 0], (0, 0), 3)
Lt = np.where(stem, 75 + np.minimum(L[..., 0], Ls + 12) * 0.7, L[..., 0] * 1.04 + 4)   # glare chips on the stem toned to its body   # the stem is pale translucent blue, not dark
Cn = np.where(stem, C * 1.1, C * np.clip(ch / 17.0, 0.6, 1.3))
out = L.copy()
out[..., 0] = L[..., 0] * (1 - w) + np.clip(Lt, 0, 255) * w
out[..., 1] = (a * (1 - w) + np.cos(H) * Cn * w) + 128
out[..., 2] = (b * (1 - w) + np.sin(H) * Cn * w) + 128
res = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
Image.fromarray(np.dstack([res, A]), "RGBA").save(WD / "cut" / "SB_LIGHTBLUE.png")
dst = Path(__file__).parent / "cfg.d" / "SB_LIGHTBLUE.json"
if not dst.exists():   # framing as the teal sibling; never overwrite a tuned copy
    shutil.copy(Path(__file__).parent / "cfg.d" / "IMG_0549.json", dst)
print("stem px", int(stem.sum()), "moved px", int((w > 0.5).sum()))
