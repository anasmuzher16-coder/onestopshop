"""Hand-traced hose: render each strand as a tube along a traced centreline, textured with the photo's own pixels
taken from a clear stretch of the same hose, then lay the real print/fittings cut from the photo on top.

cfg (json, full-photo coordinates):
  crop    : [x0,y0,x1,y1]  frame of the written cut (compose.py input)
  tex     : {id: {pts, w, ...}}   clear stretch of hose -> straightened, tileable texture. Optional keys: period, tile_periods,
            tile_len, keep_noise, raw (no rib template: the stretch mirrored), flat_across, flat (one colour across; light at
            render), sym (clearer side of each mirrored pair), hi (one soft highlight), rib_gain, roll (darker toward the edges),
            hue_rot, sat, gain, lift, contrast (Lab colour moves), flat_sigma, across_smooth, smooth
  strands : [{pts, w, tex, shade?, haze?, light?, jitter?, cap_start?, end_fade?, post?}]  back to front
  keep    : [{poly | line+w, src: "photo"|"prev", feather?, solid?, open?, one?, erode?, clip?, clip_grow?, drop_grey?, min_cc?,
             drop_hue?, drop_grow?, only_hue?, ink_yellow?, dark_max?, alpha?}]  real parts cut from the photo, on top
  prev    : {path, crop}   an earlier cut (RGBA, path under HOSE_WORK) whose alpha is reused inside 'prev' keeps
  pre     : [{poly, rgb, feather?}]   flat shapes behind the strands (the shadowed hollow of a coil)
  film    : {sigma, glare, dark, haze, soft}   the photo's own film sheen laid over the drawn tubes only
  warp    : {src, dst}   square up a skewed card (crop coords), as cut.py
usage (HOSE_WORK as for cut.py/compose.py; src is a file name in HOSE_WORK/hoses-work/full):
  python tube.py tube.d/IMG_xxxx.json $HOSE_WORK/hose-drawnbag/cut/IMG_xxxx.png [debug.jpg]
  python compose.py IMG_xxxx      (cfg.d/IMG_xxxx.json gives the same "crop")
"""
import sys, json
import numpy as np, cv2
from PIL import Image, ImageDraw
from scipy.interpolate import splprep, splev
from scipy.spatial import cKDTree
from scipy import ndimage as nd

import os
from pathlib import Path
FULL = Path(os.environ.get("HOSE_WORK", ".")) / "hoses-work" / "full"   # the shop's full photos (as plate.py)


def spline(pts, step=1.0, smooth=0.0):
    P = np.asarray(pts, np.float64)
    # drop duplicate consecutive points
    keep = np.r_[True, np.hypot(*np.diff(P, axis=0).T) > 1e-3]
    P = P[keep]
    k = min(3, len(P) - 1)
    tck, u = splprep(P.T, s=smooth * len(P), k=k)
    uu = np.linspace(0, 1, max(200, int(len(P) * 400)))
    x, y = splev(uu, tck)
    d = np.r_[0, np.cumsum(np.hypot(np.diff(x), np.diff(y)))]
    s = np.arange(0, d[-1], step)
    xs, ys = np.interp(s, d, x), np.interp(s, d, y)
    dx, dy = np.gradient(xs), np.gradient(ys)
    n = np.hypot(dx, dy) + 1e-9
    tx, ty = dx / n, dy / n
    return np.stack([xs, ys], 1), np.stack([-ty, tx], 1), s


def lab(rgb):
    return cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)


def make_tex(I, t):
    C, N, s = spline(t["pts"], 1.0, t.get("smooth", 0.0))
    w = t["w"]
    half = w / 2
    off = np.linspace(-half, half, int(round(w)) + 1)
    X = (C[:, 0:1] + off[None] * N[:, 0:1]).astype(np.float32)
    Y = (C[:, 1:2] + off[None] * N[:, 1:2]).astype(np.float32)
    T = np.stack([cv2.remap(I[..., c], X, Y, cv2.INTER_LINEAR) for c in range(3)], -1)   # (L, W, 3)
    # flatten slow light changes along the strand (film haze patches), keep ribs and the across-tube shading
    rows = T.mean(1, keepdims=True)
    slow = nd.gaussian_filter1d(rows, t.get("flat_sigma", 40), axis=0, mode="nearest")
    T = T - slow + slow.mean(0, keepdims=True)
    if t.get("across_smooth"):   # film creases running along the strand: average them out across rows (keeps ribs)
        prof = T.mean(0, keepdims=True)
        prof_s = nd.gaussian_filter1d(T, t["across_smooth"], axis=0, mode="wrap").mean(0, keepdims=True)
        T = T - prof + prof_s
    if t.get("raw"):   # random material (glitter, satin): the stretch itself, mirrored end to end so it tiles
        T = np.concatenate([T, T[::-1]], 0)
        reps = int(np.ceil(t.get("tile_len", 1200) / len(T)))
        T = np.concatenate([T] * max(1, reps), 0)
        if t.get("flat_across"):   # the stretch's own across-light removed (lighting is done at render time)
            P = T.mean(0, keepdims=True)
            T = T - P + np.median(P[:, int(P.shape[1] * .3):int(P.shape[1] * .7)], axis=1, keepdims=True)
        return _colour(T, t), 0
    # rib period (fractional) from the autocorrelation of the along-strand light
    g = T[:, int(T.shape[1] * 0.25):int(T.shape[1] * 0.75)].mean((1, 2)); g = g - nd.gaussian_filter1d(g, 25)
    ac = np.correlate(g, g, "full")[len(g) - 1:]
    F = np.abs(np.fft.rfft(g * np.hanning(len(g))))
    fr = np.fft.rfftfreq(len(g))
    okf = (fr > 1 / 60) & (fr < 1 / 6)
    p0 = t.get("period") or (1 / fr[okf][np.argmax(F[okf])])
    best = (-1e18, p0)
    for pp in np.arange(p0 - 2, p0 + 2, 0.02):   # refine on several multiples
        sc = sum(np.interp(k * pp, np.arange(len(ac)), ac) for k in range(1, int(len(g) / pp) - 1))
        if sc > best[0]:
            best = (sc, pp)
    p = best[1]
    # one rib template: average every period, phase-aligned (film creases are random, ribs are not)
    n = int(len(T) / p) - 1
    ph = int(round(p * t.get("tile_periods", 1)))
    rows = np.arange(len(T))
    tmpl = np.zeros((ph, T.shape[1], 3), np.float32)
    for k in range(n - int(t.get("tile_periods", 1)) + 1):
        src = k * p + np.arange(ph)
        for ch in range(3):
            tmpl[..., ch] += np.stack([np.interp(src, rows, T[:, j, ch]) for j in range(T.shape[1])], 1)
    tmpl /= max(1, n - int(t.get("tile_periods", 1)) + 1)
    reps = int(np.ceil(t.get("tile_len", 600) / ph))
    tile = np.concatenate([tmpl] * reps, 0)
    keep = t.get("keep_noise", 0.25)   # a little of the real stretch's life back on top of the clean ribs
    if keep:
        res = T - nd.gaussian_filter1d(T, p, axis=0, mode="wrap")
        res = res[: len(tile)] if len(res) >= len(tile) else np.concatenate([res] * (len(tile) // len(res) + 1), 0)[: len(tile)]
        tile = tile + keep * nd.gaussian_filter(res, (0, 1.5, 0))
    T = tile
    P = T.mean(0, keepdims=True)
    R = T - P
    if t.get("flat"):   # lighting is done at render time: one even colour across the tube
        P = np.repeat(np.median(P[:, int(P.shape[1] * .3):int(P.shape[1] * .7)], axis=1, keepdims=True), P.shape[1], 1)
    if t.get("sym"):   # film haze over one side of the sample: take the clearer (darker) side of each mirrored pair
        P = np.minimum(P, P[:, ::-1])
    if t.get("hi"):    # one soft highlight from the left, as on the other hoses
        u = np.linspace(-1, 1, T.shape[1])[None, :, None]
        P = P + t["hi"] * np.exp(-0.5 * ((u + 0.38) / 0.22) ** 2) * (255 - P)
    T = P + R * t.get("rib_gain", 1.0)
    if t.get("roll"):   # round the tube a touch: darker toward its edges
        u = np.linspace(-1, 1, T.shape[1])[None, :, None]
        T = T * (1 - t["roll"] * u ** 4)
    return _colour(T, t), p


def _colour(T, t):
    # colour: lift saturation / gain in Lab (the film over it washes the colour out)
    Lb = lab(T)
    if t.get("hue_rot"):
        r = np.radians(t["hue_rot"]); a, b = Lb[..., 1] - 128, Lb[..., 2] - 128
        Lb[..., 1], Lb[..., 2] = 128 + a * np.cos(r) - b * np.sin(r), 128 + a * np.sin(r) + b * np.cos(r)
    if t.get("sat", 1) != 1:
        Lb[..., 1:] = 128 + (Lb[..., 1:] - 128) * t["sat"]
    if t.get("gain", 1) != 1 or t.get("lift", 0):
        Lb[..., 0] = Lb[..., 0] * t.get("gain", 1) + t.get("lift", 0)
    if t.get("contrast", 1) != 1:
        m = Lb[..., 0].mean()
        Lb[..., 0] = m + (Lb[..., 0] - m) * t["contrast"]
    T = cv2.cvtColor(np.clip(Lb, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
    return T


def over(dst, rgb, a):
    a = a[..., None]
    da = dst[..., 3:4]
    oa = a + da * (1 - a)
    dst[..., :3] = np.where(oa > 0, (rgb * a + dst[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-6), 0)
    dst[..., 3:4] = oa


def render_strand(D, st, T, crop):
    x0, y0 = crop[:2]
    C, N, s = spline(st["pts"], 1.0, st.get("smooth", 0.0))
    C = C - [x0, y0]
    w = st["w"]
    H, W = D.shape[:2]
    m = np.zeros((H, W), np.uint8)
    cv2.polylines(m, [np.round(C).astype(np.int32).reshape(-1, 1, 2)], False, 255, thickness=int(w + 6), lineType=cv2.LINE_8)
    ys, xs = np.nonzero(m)
    tree = cKDTree(C)
    P = np.stack([xs, ys], 1).astype(np.float64) + 0.5
    _, idx = tree.query(P)
    v = P - C[idx]
    d = (v * N[idx]).sum(1)
    along = (v * np.stack([N[idx][:, 1], -N[idx][:, 0]], 1)).sum(1)   # beyond the ends
    half = w / 2
    ok = np.abs(along) < 1.5
    Lt, Wt = T.shape[:2]
    scale = (Wt - 1) / w
    u = (d + half) * scale
    sv = s[idx]
    if st.get("jitter"):   # ribs not stamped: their spacing drifts a little along the hose
        sv = sv + st["jitter"] * np.sin(sv / st.get("jitter_len", 85) + st.get("phase", 0)) + 0.6 * st["jitter"] * np.sin(sv / 37.0 + 1.3)
    vv = (sv + st.get("phase", 0)) % Lt
    rgb = np.stack([nd.map_coordinates(T[..., c], [vv, u], order=1, mode="wrap") for c in range(3)], 1)
    a = np.clip(half - np.abs(d) + 0.5, 0, 1) * ok
    # end caps fade over a few px so a strand that runs under something never shows a square cut
    end = st.get("end_fade", 0)
    if end:
        sa = s[idx]
        a = a * np.clip(sa / end, 0, 1) ** (1 if st.get("fade_start", True) else 0) \
              * np.clip((s[-1] - sa) / end, 0, 1) ** (1 if st.get("fade_end", True) else 0)
    sh = st.get("shade", 1.0)
    rgb = rgb * sh
    if st.get("light"):   # one light for the whole picture (upper left, toward the viewer): round tube shading
        lt = np.array(st.get("light_dir", [-0.45, -0.6, 0.66])); lt = lt / np.linalg.norm(lt)
        q = np.clip(d / half, -0.999, 0.999)
        nz = np.sqrt(1 - q ** 2)
        nx, ny = q * N[idx][:, 0], q * N[idx][:, 1]
        lam = np.clip(nx * lt[0] + ny * lt[1] + nz * lt[2], 0, 1)
        amb = st.get("amb", 0.45)
        k = amb + (1 - amb) * lam
        hv = lt + np.array([0, 0, 1.0]); hv = hv / np.linalg.norm(hv)
        spec = np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1) ** st.get("shine", 30) * st.get("spec", 0.35)
        rgb = rgb * k[:, None] / st.get("light_norm", 0.85) + spec[:, None] * 255
    if st.get("haze"):   # behind a layer of film: lift toward the film's pale grey
        hz = st["haze"]
        rgb = rgb * (1 - hz) + np.array(st.get("haze_rgb", [225, 228, 226])) * hz
    layer = np.zeros((H, W, 4), np.float32)
    layer[ys, xs, :3] = rgb / 255
    layer[ys, xs, 3] = a
    over(D, layer[..., :3], layer[..., 3])
    for key, i, sg in (("cap_start", 0, -1), ("cap_end", -1, 1)):
        if st.get(key):   # an open hose end: the tube's mouth, seen a little from the side
            cc = st[key]
            p0 = C[i]; n0 = N[i]; t0 = np.array([n0[1], -n0[0]]) * sg
            ang = np.degrees(np.arctan2(n0[1], n0[0]))
            mk = np.zeros((H, W), np.uint8); inner = np.zeros((H, W), np.uint8)
            ax = (int(half), max(2, int(half * cc.get("open", 0.32))))
            cv2.ellipse(mk, (int(round(p0[0])), int(round(p0[1]))), ax, ang, 0, 360, 255, -1, cv2.LINE_AA)
            ax2 = (int(half * 0.8), max(1, int(ax[1] * 0.7)))
            cv2.ellipse(inner, (int(round(p0[0])), int(round(p0[1]))), ax2, ang, 0, 360, 255, -1, cv2.LINE_AA)
            m1 = mk.astype(np.float32) / 255; m2 = cv2.GaussianBlur(inner.astype(np.float32) / 255, (0, 0), 1.2)
            rim = np.array(cc.get("rim", [0.55, 0.8, 0.45]), np.float32); hole = np.array(cc.get("hole", [0.12, 0.25, 0.1]), np.float32)
            over(D, rim, m1); over(D, hole, m2)


def hue_mask(I, lo, hi, cmin):
    Lb = lab(I)
    a, b = Lb[..., 1] - 128, Lb[..., 2] - 128
    C = np.hypot(a, b); h = np.degrees(np.arctan2(b, a)) % 360
    inh = ((h >= lo) & (h <= hi)) if lo <= hi else ((h >= lo) | (h <= hi))
    return inh & (C > cmin)


def main(cfgp, outp, dbg=None):
    c = json.loads(open(cfgp).read())
    src = Path(c["src"]) if Path(c["src"]).is_absolute() else FULL / c["src"]
    I = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    x0, y0, x1, y1 = c["crop"]
    H, W = y1 - y0, x1 - x0
    D = np.zeros((H, W, 4), np.float32)
    TEX = {k: make_tex(I, t) for k, t in c["tex"].items()}
    for k, (T, p) in TEX.items():
        print("tex", k, T.shape, "period", p)
        if dbg:
            Image.fromarray(np.clip(T, 0, 255).astype(np.uint8)).save(str(dbg).replace(".jpg", f"-tex-{k}.png"))
    for kp in c.get("pre", []):   # flat shapes behind everything (the shadowed hollow of a coil)
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).polygon([(q[0] - x0, q[1] - y0) for q in kp["poly"]], fill=255)
        M = cv2.GaussianBlur(np.asarray(m).astype(np.float32) / 255, (0, 0), kp.get("feather", 6))
        over(D, np.array(kp["rgb"], np.float32) / 255, M * kp.get("alpha", 1.0))
    for st in c["strands"]:
        if st.get("off") or st.get("post"):
            continue
        render_strand(D, st, TEX[st["tex"]][0], c["crop"])
    drawn = D[..., 3].copy()          # where the drawn tubes are (the film layer goes over these only)
    Ic = I[y0:y1, x0:x1]
    prev = None
    if c.get("prev"):
        pc = c["prev"]["crop"]
        pp = Path(c["prev"]["path"]); pp = pp if pp.is_absolute() else FULL.parent.parent / pp
        pa = np.asarray(Image.open(pp).convert("RGBA")).astype(np.float32) / 255
        prev = np.zeros((H, W, 4), np.float32)
        # place prev (its own crop frame) into ours
        ox, oy = pc[0] - x0, pc[1] - y0
        sy0, sx0 = max(0, -oy), max(0, -ox)
        dy0, dx0 = max(0, oy), max(0, ox)
        hh = min(pa.shape[0] - sy0, H - dy0); ww = min(pa.shape[1] - sx0, W - dx0)
        prev[dy0:dy0 + hh, dx0:dx0 + ww] = pa[sy0:sy0 + hh, sx0:sx0 + ww]
    for kp in c.get("keep", []):
        if kp.get("off"):
            continue
        m = Image.new("L", (W, H), 0)
        if "line" in kp:
            ImageDraw.Draw(m).line([(q[0] - x0, q[1] - y0) for q in kp["line"]], fill=255, width=int(kp["w"]))
        else:
            ImageDraw.Draw(m).polygon([(q[0] - x0, q[1] - y0) for q in kp["poly"]], fill=255)
        M = np.asarray(m).astype(np.float32) / 255
        if kp.get("feather"):
            M = cv2.GaussianBlur(M, (0, 0), kp["feather"])
        if kp.get("src", "photo") == "prev":
            M = M * prev[..., 3]
            rgb = prev[..., :3]
        else:
            rgb = Ic / 255
        if kp.get("solid"):   # opaque print: close the cut's gaps, fill its holes, keep one clean outline
            r = kp["solid"]
            b = (M > 0.5).astype(np.uint8)
            b = cv2.morphologyEx(b, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2))
            b = nd.binary_fill_holes(b).astype(np.uint8)
            ro = kp.get("open", r // 2)
            b = cv2.morphologyEx(b, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * ro + 1,) * 2))
            n, lbl, st, _ = cv2.connectedComponentsWithStats(b, 8)
            if n > 1:
                b = (lbl == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8) if kp.get("one", True) else b
            if kp.get("erode"):   # pull the outline in past the photo's grey film fringe
                b = cv2.erode(b, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * kp["erode"] + 1,) * 2))
            M = cv2.GaussianBlur(b.astype(np.float32), (0, 0), 0.9)
            rgb = Ic / 255
        if kp.get("drop_grey"):   # film fragments: pale, colourless, not white print and not ink
            lo, hi, cm = kp["drop_grey"]
            Lb = lab(Ic); Cc = np.hypot(Lb[..., 1] - 128, Lb[..., 2] - 128); LL = Lb[..., 0] * 100 / 255
            g = ((LL > lo) & (LL < hi) & (Cc < cm)).astype(np.uint8)
            g = cv2.morphologyEx(g, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            M = M * (1 - g)
            b = (M > 0.5).astype(np.uint8)
            n, lbl, st, _ = cv2.connectedComponentsWithStats(b, 8)
            keepc = np.r_[False, st[1:, cv2.CC_STAT_AREA] >= kp.get("min_cc", 400)]
            M = M * keepc[lbl]
        if kp.get("drop_hue"):
            lo, hi, cm = kp["drop_hue"]
            hm = hue_mask(Ic, lo, hi, cm).astype(np.uint8)
            if kp.get("drop_grow"):
                hm = cv2.dilate(hm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * kp["drop_grow"] + 1,) * 2))
            M = M * (1 - cv2.GaussianBlur(hm.astype(np.float32), (0, 0), 1.0))
        if kp.get("only_hue"):
            lo, hi, cm = kp["only_hue"]
            hm = hue_mask(Ic, lo, hi, cm).astype(np.uint8)
            hm = cv2.morphologyEx(hm, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
            M = M * cv2.GaussianBlur(hm.astype(np.float32), (0, 0), 0.8)
        if kp.get("ink_yellow"):   # line art: only its yellow and its dark ink, no white backing
            ylo, yhi, ycm, lmax = kp["ink_yellow"]
            Lb = lab(Ic); LL = Lb[..., 0] * 100 / 255
            keepm = (hue_mask(Ic, ylo, yhi, ycm) | (LL < lmax)).astype(np.uint8)
            keepm = cv2.dilate(keepm, np.ones((3, 3), np.uint8))
            n, lbl, stt, _ = cv2.connectedComponentsWithStats(keepm, 8)
            keepm = np.r_[False, stt[1:, cv2.CC_STAT_AREA] >= kp.get("min_cc", 300)][lbl]
            M = M * cv2.GaussianBlur(keepm.astype(np.float32), (0, 0), 0.8)
        if kp.get("dark_max") is not None:   # keep only ink darker than this L
            Lb = lab(Ic)[..., 0]
            M = M * np.clip((kp["dark_max"] - Lb) / 12, 0, 1)
        if kp.get("clip"):   # hand-read outline of the print (photo coords), grown a little: nothing outside it
            cm = Image.new("L", (W, H), 0)
            ImageDraw.Draw(cm).polygon([(q[0] - x0, q[1] - y0) for q in kp["clip"]], fill=255)
            cm = np.asarray(cm).astype(np.uint8)
            g = kp.get("clip_grow", 8)
            if g:
                cm = cv2.dilate(cm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * g + 1,) * 2))
            M = M * cv2.GaussianBlur(cm.astype(np.float32) / 255, (0, 0), 1.0)
        M = M * kp.get("alpha", 1.0)
        over(D, rgb, M)
        drawn = drawn * (1 - M)
    for st in c["strands"]:
        if st.get("post") and not st.get("off"):   # drawn over the cut-out parts (a hose end sleeved over a mouthpiece)
            before = D[..., 3].copy()
            render_strand(D, st, TEX[st["tex"]][0], c["crop"])
            drawn = np.maximum(drawn, np.clip(D[..., 3] - before, 0, 1))
    if c.get("film"):   # the photo's own film over the drawn tubes: its glare streaks and creases, plus a little haze
        f = c["film"]
        Lc = lab(Ic)[..., 0]
        hp = Lc - cv2.GaussianBlur(Lc, (0, 0), f.get("sigma", 18))
        g = np.clip((hp - f.get("t", 6)) / f.get("k", 30), 0, 1) * f.get("glare", 0.6)
        if f.get("soft"):   # wide soft sheen, never thin white scratches
            g = cv2.GaussianBlur(g, (0, 0), f["soft"])
        dk = np.clip((-hp - f.get("t", 6)) / f.get("k", 30), 0, 1) * f.get("dark", 0.25)
        wgt = cv2.GaussianBlur(drawn, (0, 0), 1.0)
        over(D, np.array([1, 1, 1], np.float32), np.clip(f.get("haze", 0.06) + g, 0, 1) * wgt)
        over(D, np.array([0.1, 0.1, 0.1], np.float32), dk * wgt)
    if c.get("warp"):   # square up a skewed print card (crop coords), the same as cut.py
        Mw = cv2.getPerspectiveTransform(np.float32(c["warp"]["src"]), np.float32(c["warp"]["dst"]))
        pm = D.copy(); pm[..., :3] *= pm[..., 3:4]
        pm = cv2.warpPerspective(pm, Mw, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
        pm = np.clip(pm, 0, 1)
        D = pm.copy(); D[..., :3] = np.where(pm[..., 3:4] > 1e-3, np.clip(pm[..., :3] / np.maximum(pm[..., 3:4], 1e-3), 0, 1), 0)
        Ic = cv2.warpPerspective(Ic, Mw, (W, H))
    out = Image.fromarray((np.clip(D, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
    out.save(outp)
    if dbg:
        t = Image.new("RGBA", out.size, (0, 128, 128, 255)); t.alpha_composite(out)
        src = Image.fromarray(Ic.astype(np.uint8)).convert("RGBA")
        sheet = Image.new("RGB", (W * 2, H)); sheet.paste(src.convert("RGB"), (0, 0)); sheet.paste(t.convert("RGB"), (W, 0))
        sheet.thumbnail((1400, 1400)); sheet.save(dbg, quality=88)


if __name__ == "__main__":
    main(*sys.argv[1:])
