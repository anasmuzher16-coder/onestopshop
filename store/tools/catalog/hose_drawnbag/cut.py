"""Cut the real product (hose, fittings, printed card and the bag's own print) out of a hanging-bag photo.

Classes, all against the wall plate from plate.py (full resolution, in the bag-crop's coordinates):
  colour  : chroma clearly above the wall's (hose, gold foil, coloured print)
  ink     : dark print (black text, outlines)
  white   : opaque white/pale print, only inside cfg 'white' boxes: bright, smooth (opened), holes filled
  band    : pale hoses, inside cfg 'band' polylines: brighter than the wall
  dark_band: dark hoses over dark foil, inside cfg 'dark_band' corridors: near-black neutral pixels, closed over the ribs
  fill    : cfg polygons taken whole (opaque)
  clear   : cfg polygons of clear plastic parts: known-background alpha, colour un-mixed (translucent)
  drop    : cfg polygons removed
Writes cut/<name>.png (RGBA, crop coords) and cut/<name>-dbg.jpg.
"""
import sys, json
import numpy as np, cv2
from PIL import Image, ImageDraw
from scipy import ndimage as nd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from plate import load, lab, WD, BAGS

from cfgload import CFG
OUT = WD / "cut"; OUT.mkdir(exist_ok=True)


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def poly_mask(shape, polys, width=None):
    m = Image.new("L", (shape[1], shape[0]), 0); d = ImageDraw.Draw(m)
    for p in polys:
        pts = [tuple(q) for q in p]
        if width:
            d.line(pts, fill=255, width=width, joint="curve")
            for q in pts:
                d.ellipse([q[0] - width / 2, q[1] - width / 2, q[0] + width / 2, q[1] + width / 2], fill=255)
        elif len(pts) == 2:
            d.rectangle([pts[0], pts[1]], fill=255)
        else:
            d.polygon(pts, fill=255)
    return np.asarray(m) > 0


def small_cc(m, min_area):
    n, lbl, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= min_area
    return keep[lbl]


def cut(name):
    c = CFG[name]
    I, B, inside, g = load(name, c.get("bagspec"))   # bagspec: {top, bottom, l:[t,b], r:[t,b]} as bags.json, for a photo not in it
    x0, y0, x1, y1 = c["crop"]
    I, B, inside = I[y0:y1, x0:x1], B[y0:y1, x0:x1], inside[y0:y1, x0:x1]
    for ip in c.get("inpaint", []):   # shop background seen through a tinted print (a shadow, the wall rail): filled from the tint around it
        Li = lab(I); Ci = np.hypot(Li[..., 1] - 128, Li[..., 2] - 128); Hi = np.degrees(np.arctan2(Li[..., 2] - 128, Li[..., 1] - 128)) % 360
        z = poly_mask(I.shape[:2], [ip["poly"]])
        z &= (Li[..., 0] >= ip.get("Lmin", 0)) & (Li[..., 0] <= ip.get("Lmax", 255)) & (Ci <= ip.get("Cmax", 255))
        if ip.get("keep_red"):   # the red hose behind stays
            z &= ~((Ci > ip["keep_red"]) & ((Hi < 45) | (Hi > 330)))
        z = cv2.dilate(z.astype(np.uint8), disk(ip.get("grow", 3)))
        if ip.get("flat"):   # a clean tint: the median colour of the tinted film around it, with the film's own fine grain kept
            w = (~(cv2.dilate(z, disk(4)) > 0) & (Ci > ip["flat"]) & (Li[..., 0] > 90)).astype(np.float32)   # tinted film only
            sg = ip.get("sigma", 35)
            base = cv2.GaussianBlur(I * w[..., None], (0, 0), sg) / np.maximum(cv2.GaussianBlur(w, (0, 0), sg), 1e-3)[..., None]
            grain = I - cv2.GaussianBlur(I, (0, 0), 3)
            k = cv2.GaussianBlur((z > 0).astype(np.float32), (0, 0), ip.get("soft", 3))[..., None]
            I = I * (1 - k) + (base + 0.5 * grain) * k
        elif ip.get("ink_L"):   # next to black print: fill as if the print were not there, then put the print back
            z = (z > 0) & ~(cv2.dilate((Li[..., 0] < ip["ink_L"] * 0.4).astype(np.uint8), disk(1)) > 0) & ~(Li[..., 0] > 200)
            z = z.astype(np.uint8)
            near = (cv2.dilate(z, disk(40)) > 0) & (Li[..., 0] < ip["ink_L"]) & ~(z > 0)
            near = cv2.dilate(near.astype(np.uint8), disk(2)) > 0
            J = cv2.inpaint(np.clip(I, 0, 255).astype(np.uint8), ((z > 0) | near).astype(np.uint8), ip.get("r", 15), cv2.INPAINT_TELEA).astype(np.float32)
            I = np.where((z > 0)[..., None], J, I)
        else:
            I = cv2.inpaint(np.clip(I, 0, 255).astype(np.uint8), z, ip.get("r", 15), cv2.INPAINT_TELEA).astype(np.float32)
    LI, LB = lab(I), lab(B)
    L = LI[..., 0]; dL = L - LB[..., 0]
    chI = np.hypot(LI[..., 1] - 128, LI[..., 2] - 128); chB = np.hypot(LB[..., 1] - 128, LB[..., 2] - 128)
    dC = chI - chB
    sh = L.shape
    area = poly_mask(sh, [c["area"]]) if "area" in c else inside
    if c.get("area_add"):   # print that runs past the hand-read bag edge (onto the fold)
        area = area | poly_mask(sh, c["area_add"])

    colour = (dC > c.get("chroma", 16))
    hue = np.degrees(np.arctan2(LI[..., 2] - 128, LI[..., 1] - 128)) % 360
    if "hose_hue" in c:   # red/pink hose parts only (a tinted print panel shares the 'colour' test)
        hmax, cmin = c["hose_hue"]
        colour = (chI > cmin) & ((hue < hmax) | (hue > 330))
        for ex in c.get("colour_extra", []):
            colour |= (chI > ex["cmin"]) & ((hue < hmax) | (hue > 330)) & poly_mask(sh, [ex["poly"]])
        if c.get("colour_drop"):
            colour &= ~poly_mask(sh, c["colour_drop"])
    if "hue_drop" in c:   # e.g. Sager's orange-tinted panel is not 'product colour'
        hue = np.degrees(np.arctan2(LI[..., 2] - 128, LI[..., 1] - 128)) % 360
        lo, hi, cmax = c["hue_drop"]
        colour &= ~((hue >= lo) & (hue <= hi) & (chI < cmax))
    colour = cv2.morphologyEx(colour.astype(np.uint8), cv2.MORPH_OPEN, disk(2)) > 0
    if c.get("colour_close"):   # ribbed hose: close the gaps between ribs so it reads solid
        colour = cv2.morphologyEx(colour.astype(np.uint8), cv2.MORPH_CLOSE, disk(c["colour_close"])) > 0
    colour = small_cc(colour, c.get("colour_min", 1500))
    holes = nd.binary_fill_holes(colour) & ~colour
    colour |= holes & ~small_cc(holes, c.get("hole_max", 4000))

    neutral = chI < c.get("ink_C", 255)
    if c.get("ink_C_skip"):   # print laid on a tinted panel picks up the tint
        neutral |= poly_mask(sh, c["ink_C_skip"])
    ink = (L < c.get("ink_L", 95)) & (dL < -45) & neutral
    big = small_cc(ink, c.get("ink_big", 200))
    near = cv2.dilate(big.astype(np.uint8), disk(45)) > 0
    ink = big | (small_cc(ink, 12) & near)
    for ie in c.get("ink_extra", []):   # print over a shadowed stretch of wall: plain darkness test
        z = poly_mask(sh, [ie["poly"]])
        Ls = cv2.GaussianBlur(L, (0, 0), 0.8)
        if ie.get("adapt"):   # glare over the print: a letter is darker than the film right around it, not dark outright
            sg, k = ie["adapt"]
            ik = (Ls < cv2.GaussianBlur(L, (0, 0), sg) - k) & z & (chI < ie.get("C", 30))
        else:
            ik = (Ls < ie.get("L", 110)) & z & (chI < ie.get("C", 30))
        ik = cv2.morphologyEx(ik.astype(np.uint8), cv2.MORPH_OPEN, disk(1)) > 0
        if ie.get("close"):   # glare breaks a letter's stroke into specks: join them back (inside the zone only)
            ik = (cv2.morphologyEx(ik.astype(np.uint8), cv2.MORPH_CLOSE, disk(ie["close"])) > 0) & z
        ink |= small_cc(ik, ie.get("min", 60))
    if c.get("ink_within"):
        ink &= poly_mask(sh, c["ink_within"])
    if c.get("ink_thin"):   # only pen-width ink here (a broad dark patch is shadow, not print)
        z = poly_mask(sh, c["ink_thin"])
        thick = cv2.dilate(cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, disk(9)), disk(1)) > 0
        ink &= ~(thick & z)

    for pt in c.get("patch", []):   # stray print on the film over a ribbed hose: the hose's own ribs from just above, feathered
        a0, b0, a1, b1 = pt["box"]; dy = pt.get("dy", -40)
        k = np.zeros(sh, np.float32); k[b0:b1, a0:a1] = 1; k = cv2.GaussianBlur(k, (0, 0), 4)[..., None]
        I = I * (1 - k) + np.roll(I, -dy, axis=0) * k
    for g in c.get("glyph_copy", []):   # a letter lost under glare, restored from the same letter printed on the same line
        if g.get("clear"):
            a0, b0, a1, b1 = g["clear"]; ink[b0:b1, a0:a1] = False
        a0, b0, a1, b1 = g["src"]; dx, dy = g["to"]
        m = ink[b0:b1, a0:a1].copy()
        dst = np.s_[b0 + dy:b1 + dy, a0 + dx:a1 + dx]
        ink[dst] |= m
        I[dst] = np.where(m[..., None], I[b0:b1, a0:a1], I[dst])
    for z in c.get("ink_holes", []):   # a solid printed shape (a teardrop) whose middle is lost under glare
        zm = poly_mask(sh, [z["poly"]])
        ink |= (cv2.morphologyEx((ink & zm).astype(np.uint8), cv2.MORPH_CLOSE, disk(z.get("close", 6))) > 0) & zm
        hl = nd.binary_fill_holes(ink & zm) & ~ink & zm
        ink |= hl & ~small_cc(hl, z.get("max", 3000))

    white = np.zeros(sh, bool)
    for box in c.get("white", []):
        z = poly_mask(sh, [box]) if not (isinstance(box, dict)) else poly_mask(sh, [box["poly"]])
        if c.get("white_lowC"):   # white print on a tinted panel: whatever has no tint and is not ink
            br = (chI < c["white_lowC"]) & (L > c.get("white_L", 110)) & z
            if c.get("white_within"):
                br &= poly_mask(sh, c["white_within"])
        else:
            br = (L > c.get("white_L", 190)) & (dL > c.get("white_dL", 22)) & (chI < c.get("white_C", 30)) & z
        br = cv2.morphologyEx(br.astype(np.uint8), cv2.MORPH_OPEN, disk(c.get("white_open", 7))) > 0
        br = cv2.morphologyEx((br | (ink & z)).astype(np.uint8), cv2.MORPH_CLOSE, disk(c.get("white_close", 5))) > 0
        holes = nd.binary_fill_holes(br) & ~br
        br = (br | (holes & ~small_cc(holes, c.get("white_hole", 25000)))) & z
        white |= small_cc(br, 6000)

    sticker = np.zeros(sh, bool); c["_r"] = []
    for st in c.get("sticker", []):
        z = poly_mask(sh, [st["box"]])
        core = (ink & z)
        if st.get("colour"):
            core |= colour & poly_mask(sh, [st["colour"]])
        core = small_cc(core, st.get("core_min", 3000))
        core = nd.binary_fill_holes(cv2.morphologyEx(core.astype(np.uint8), cv2.MORPH_CLOSE, disk(15)) > 0)
        r = st.get("r")
        if r is None:   # widest offset whose ring is still brighter than the wall seen through film
            prev = core; r = 0
            for rr in range(6, 90, 6):
                d = cv2.dilate(core.astype(np.uint8), disk(rr)) > 0
                ring = d & ~prev & ~colour
                if ring.sum() < 50 or np.median(dL[ring]) < st.get("ring_dL", 18):
                    break
                r, prev = rr, d
        c["_r"].append(r)
        m = cv2.dilate(core.astype(np.uint8), disk(max(1, r))) > 0
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, disk(st.get("close", 25))) > 0
        m = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 6) > 0.5   # die-cut smooth
        sticker |= nd.binary_fill_holes(m)
    white |= sticker

    band = np.zeros(sh, bool)
    c["_bands"] = c.get("band", [])
    if c.get("band"):
        g = cv2.GaussianBlur(cv2.resize(L, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA), (0, 0), 2)
        th = g - cv2.morphologyEx(g, cv2.MORPH_OPEN, disk(40))
        th = cv2.resize(th, (sh[1], sh[0]))
        ridge = cv2.GaussianBlur(th, (0, 0), 25)
    for b in c.get("band", []):
        pts = np.asarray(b["pts"], np.float32)
        # densify every ~25 px
        seg = [pts[0]]
        for p0, p1 in zip(pts[:-1], pts[1:]):
            n = max(1, int(np.hypot(*(p1 - p0)) / 25))
            seg += [p0 + (p1 - p0) * (k / n) for k in range(1, n + 1)]
        P = np.asarray(seg)
        for it, rad in enumerate(b.get("snap", [90, 60, 45])):   # centre of the hose's bright mass across a narrow corridor
            T = np.gradient(P, axis=0); T /= np.maximum(1e-6, np.hypot(T[:, 0], T[:, 1]))[:, None]
            Nn = np.stack([-T[:, 1], T[:, 0]], 1)
            offs = np.arange(-rad, rad + 1, 3, dtype=np.float32)
            Q = P[:, None, :] + Nn[:, None, :] * offs[None, :, None]
            qx = np.clip(Q[..., 0], 0, sh[1] - 1).astype(int); qy = np.clip(Q[..., 1], 0, sh[0] - 1).astype(int)
            wgt = np.clip(th[qy, qx] - 10, 0, None) ** 2
            sh_ = (wgt * offs[None, :]).sum(1) / np.maximum(wgt.sum(1), 1e-3)
            sh_ = np.where(wgt.sum(1) > 1, sh_, 0)
            P = P + Nn * nd.uniform_filter1d(sh_, 7, mode="nearest")[:, None]
            P = nd.uniform_filter1d(P, b.get("smooth", 9), axis=0, mode="nearest")
        b["_snapped"] = P.round().astype(int).tolist()
        m = poly_mask(sh, [P.tolist()], width=int(b["w"]))
        m = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 4) > 0.5
        band |= m

    if c.get("gc"):   # pale hose: graph-cut on brightness / rib texture / top-hat, seeded by hand strokes
        g = c["gc"]
        Lsm = cv2.GaussianBlur(L, (0, 0), 1.2)
        dog = cv2.GaussianBlur(L, (0, 0), 1.5) - cv2.GaussianBlur(L, (0, 0), 5)
        en = cv2.GaussianBlur(np.abs(dog), (0, 0), 6)
        g2 = cv2.GaussianBlur(cv2.resize(L, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA), (0, 0), 2)
        th = cv2.resize(g2 - cv2.morphologyEx(g2, cv2.MORPH_OPEN, disk(45)), (sh[1], sh[0]))
        feat = np.dstack([Lsm, np.clip(en * 25, 0, 255), np.clip(th * 3, 0, 255)]).astype(np.uint8)
        sc = 0.5
        fs = cv2.resize(feat, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
        hs = fs.shape[:2]
        gm = np.full(hs, cv2.GC_BGD, np.uint8)
        A_ = cv2.resize(area.astype(np.uint8), (hs[1], hs[0])) > 0
        gm[A_] = cv2.GC_PR_BGD
        for st in g["strokes"]:
            P = (np.asarray(st["pts"]) * sc).tolist()
            gm[poly_mask(hs, [P], width=int(g.get("pr_w", 190) * sc)) & A_] = cv2.GC_PR_FGD
        for st in g["strokes"]:
            if st.get("sure", True):
                P = (np.asarray(st["pts"]) * sc).tolist()
                gm[poly_mask(hs, [P], width=int(g.get("fg_w", 40) * sc)) & A_] = cv2.GC_FGD
        gm[cv2.resize((ink).astype(np.uint8), (hs[1], hs[0])) > 0] = np.where(gm[cv2.resize((ink).astype(np.uint8), (hs[1], hs[0])) > 0] == cv2.GC_FGD, cv2.GC_FGD, cv2.GC_PR_BGD)
        dark = cv2.resize((cv2.GaussianBlur(L, (0, 0), 5) < g.get("dark", 150)).astype(np.uint8), (hs[1], hs[0])) > 0
        gm[dark & (gm != cv2.GC_FGD)] = cv2.GC_BGD
        bg_, fg_ = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(fs, gm, None, bg_, fg_, 6, cv2.GC_INIT_WITH_MASK)
        m = ((gm == cv2.GC_FGD) | (gm == cv2.GC_PR_FGD)).astype(np.float32)
        m = cv2.resize(m, (sh[1], sh[0]), interpolation=cv2.INTER_LINEAR)
        m = cv2.GaussianBlur(m, (0, 0), 3) > 0.5
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, disk(12)) > 0
        hl = nd.binary_fill_holes(m) & ~m
        m |= hl & ~small_cc(hl, 8000)
        m = small_cc(m, 20000)
        if g.get("tube"):   # re-centre each stroke on the cut, then draw a clean constant tube along it
            dt = nd.distance_transform_edt(m)
            tube = np.zeros(sh, bool); c["_w"] = []
            for st in g["strokes"]:
                pts = np.asarray(st["pts"], np.float32)
                seg = [pts[0]]
                for p0, p1 in zip(pts[:-1], pts[1:]):
                    n = max(1, int(np.hypot(*(p1 - p0)) / 20))
                    seg += [p0 + (p1 - p0) * (k / n) for k in range(1, n + 1)]
                P = np.asarray(seg)
                for rad in (80, 60, 40):
                    T = np.gradient(P, axis=0); T /= np.maximum(1e-6, np.hypot(T[:, 0], T[:, 1]))[:, None]
                    Nn = np.stack([-T[:, 1], T[:, 0]], 1)
                    offs = np.arange(-rad, rad + 1, 2, dtype=np.float32)
                    Q = P[:, None, :] + Nn[:, None, :] * offs[None, :, None]
                    qx = np.clip(Q[..., 0], 0, sh[1] - 1).astype(int); qy = np.clip(Q[..., 1], 0, sh[0] - 1).astype(int)
                    wgt = dt[qy, qx] ** 2
                    ok = wgt.sum(1) > 1
                    sh_ = np.where(ok, (wgt * offs).sum(1) / np.maximum(wgt.sum(1), 1e-3), 0)
                    P = P + Nn * sh_[:, None]
                    P = nd.uniform_filter1d(P, st.get("smooth", 11), axis=0, mode="nearest")
                qx = np.clip(P[:, 0], 0, sh[1] - 1).astype(int); qy = np.clip(P[:, 1], 0, sh[0] - 1).astype(int)
                c["_w"].append(float(np.median(dt[qy, qx]) * 2))
                st["_P"] = P
            W_ = g.get("w") or float(np.median([w for w in c["_w"] if w > 40]))
            for st in g["strokes"]:
                if st.get("draw", True):
                    tube |= poly_mask(sh, [st["_P"].tolist()], width=int(st.get("w", W_)))
            m = cv2.GaussianBlur(tube.astype(np.float32), (0, 0), 3) > 0.5
            print("tube widths", [round(w) for w in c["_w"]], "->", round(W_))
        band |= m

    if c.get("dark_band"):   # dark hose over a dark printed/foil backing: hand corridors, only the near-black neutral pixels in them
        o = c.get("dark_band_opts", {})
        Lb, Cb = cv2.GaussianBlur(L, (0, 0), 1.5), cv2.GaussianBlur(chI, (0, 0), 2)
        cor = np.zeros(sh, bool); dk = np.zeros(sh, bool)
        for b in c["dark_band"]:
            z = poly_mask(sh, [b["pts"]], width=int(b["w"])); cor |= z
            dk |= z & (Lb < b.get("L", 45)) & (Cb < b.get("C", 8))
        dk = cv2.morphologyEx(dk.astype(np.uint8), cv2.MORPH_CLOSE, disk(o.get("close", 9))) > 0
        hl = nd.binary_fill_holes(dk) & ~dk
        dk |= hl & ~small_cc(hl, o.get("hole", 6000))
        dk = cv2.morphologyEx(dk.astype(np.uint8), cv2.MORPH_OPEN, disk(o.get("open", 6))) > 0
        dk = small_cc(dk, o.get("min", 4000)) & cor
        band |= cv2.GaussianBlur(dk.astype(np.float32), (0, 0), 3) > 0.5

    fill = poly_mask(sh, c["fill"]) if c.get("fill") else np.zeros(sh, bool)
    drop = poly_mask(sh, c["drop"]) if c.get("drop") else np.zeros(sh, bool)
    for db in c.get("drop_bright", []):   # wall/film seen through the bag next to a dark hose: drop only what is bright
        z = poly_mask(sh, [db["poly"]])
        br = cv2.GaussianBlur(L, (0, 0), db.get("blur", 3)) > db.get("L", 140)
        if "C" in db:   # clear film only: the tinted print and a pale hose keep their colour
            br &= cv2.GaussianBlur(chI, (0, 0), db.get("blur", 3)) < db["C"]
        br = cv2.morphologyEx(br.astype(np.uint8), cv2.MORPH_OPEN, disk(db.get("open", 4))) > 0
        drop |= z & br
    for dt in c.get("drop_tint", []):   # dark foil showing beside a black hose: whatever carries its tint goes
        drop |= poly_mask(sh, [dt["poly"]]) & (cv2.GaussianBlur(chI, (0, 0), 2) > dt["C"])
    if c.get("fill_noborder") and c.get("fill"):   # the bag's own orange border is redrawn; keep it out of hose fills
        fill &= ~((chI > 40) & (hue > 45) & (hue < 68))
    solid = (colour | ink | white | band | fill) & area & ~drop
    if c.get("classdbg"):
        v = np.zeros(sh + (3,), np.uint8); v[colour] = (255, 0, 0); v[ink] = (0, 0, 255); v[white] = (0, 255, 0); v[fill] = (255, 255, 0)
        v[drop] //= 3
        im_ = Image.fromarray(v); im_.thumbnail((900, 900)); im_.save(OUT / f"{name}-classes.png")

    alpha = solid.astype(np.float32)
    col = I.copy()
    for rc in c.get("recolour", []):   # wall seen through a translucent part takes the part's own colour
        z = poly_mask(sh, [rc["poly"]]) & solid
        red = (chI > rc.get("cmin", 18)) & ((hue < rc.get("hmax", 36)) | (hue > 330))
        good = z & red
        med = np.median(I[good], 0)
        bad = z & ~red
        k = nd.gaussian_filter(bad.astype(np.float32), 2)[..., None] * z[..., None]
        Lb = cv2.GaussianBlur(L, (0, 0), 6)
        shade = (Lb[..., None] / max(1.0, float(np.median(L[good])))).clip(0.75, 1.2)
        col = col * (1 - k) + (med * shade) * k
    if c.get("clear"):
        cz = poly_mask(sh, c["clear"]) & ~solid & area
        up = np.where(I > B, (I - B) / np.maximum(1, 255 - B), (B - I) / np.maximum(1, B))
        a = np.clip(up.max(-1) * c.get("clear_gain", 1.6), 0, 1)
        if c.get("clear_mode") == "hp":   # only the plastic's own edges and glints, no flat wall tone
            hp = np.abs(L - cv2.GaussianBlur(L, (0, 0), 12))
            a = np.clip((cv2.GaussianBlur(hp, (0, 0), 1.2) - 4) / c.get("clear_hp", 30), 0, 0.85)
        a = np.maximum(a, c.get("clear_floor", 0.12))
        a = nd.gaussian_filter(a, 1.0)
        C = np.clip((I - (1 - a[..., None]) * B) / np.maximum(a[..., None], 1e-3), 0, 255)
        alpha = np.where(cz, a, alpha); col = np.where(cz[..., None], C, col)
    # 1 px soft edge at full res (the 4-5x downscale does the rest)
    alpha = np.where(alpha >= 1, nd.gaussian_filter(alpha, 0.7), alpha)
    if c.get("white_clean") and white.any():   # white print reads as clean white, not film-grey
        k = c["white_clean"] * (white & solid & (chI < c.get("white_clean_C", 255)) & ~(cv2.dilate(ink.astype(np.uint8), disk(2)) > 0))[..., None]
        col = col * (1 - k) + np.array(c.get("white_rgb", [240, 238, 233]), np.float32) * k
    if c.get("panels"):   # the bag's own print, redrawn flat beneath the cut-out
        base = np.zeros(sh + (4,), np.float32)
        if c.get("warp"):
            Minv = cv2.getPerspectiveTransform(np.float32(c["warp"]["dst"]), np.float32(c["warp"]["src"]))
        for pn in c["panels"]:
            if pn.get("post"):
                continue
            if pn.get("auto"):   # colour from the photo: median of tint pixels in the panel
                z = poly_mask(sh, [pn["poly"]]) & ~solid & (chI > 15) & (hue > 35) & (hue < 60)
                rgb = np.median(I[z], 0)
                W_ = np.array(pn.get("wall", [205, 205, 200]), np.float32)
                if not pn.get("raw"):
                    rgb = np.clip((rgb - (1 - pn["a"]) * W_) / pn["a"], 0, 255)
                print("panel rgb", rgb.round())
            else:
                rgb = np.array(pn["rgb"], np.float32)
            m = (poly_mask(sh, [pn["poly"]], width=pn["w"]) if pn.get("w") else poly_mask(sh, [pn["poly"]])).astype(np.float32)
            m = cv2.GaussianBlur(m, (0, 0), 1.0) * pn["a"]
            da = base[..., 3:4]; oa = m[..., None] + da * (1 - m[..., None])
            base[..., :3] = (rgb * m[..., None] + base[..., :3] * da * (1 - m[..., None])) / np.maximum(oa, 1e-6)
            base[..., 3:4] = oa
        a2 = alpha[..., None]; oa = a2 + base[..., 3:4] * (1 - a2)
        col = (col * a2 + base[..., :3] * base[..., 3:4] * (1 - a2)) / np.maximum(oa, 1e-6)
        alpha = oa[..., 0]
    rgba = np.dstack([col, alpha * 255]).clip(0, 255).astype(np.uint8)
    if c.get("warp"):   # square up a skewed print panel
        src = np.float32(c["warp"]["src"]); dst = np.float32(c["warp"]["dst"])
        M = cv2.getPerspectiveTransform(src, dst)
        rgba = cv2.warpPerspective(rgba, M, (sh[1], sh[0]), flags=cv2.INTER_LANCZOS4, borderValue=(0, 0, 0, 0))
        alpha = rgba[..., 3].astype(np.float32) / 255; I = cv2.warpPerspective(I, M, (sh[1], sh[0]))
        col = rgba[..., :3].astype(np.float32)
        post = [pn for pn in c.get("panels", []) if pn.get("post") and not pn.get("front")]
        if post:   # print panels given in squared-up coordinates, beneath the warped cut-out
            base = np.zeros(sh + (4,), np.float32)
            for pn in post:
                m = (poly_mask(sh, [pn["poly"]], width=pn["w"]) if pn.get("w") else poly_mask(sh, [pn["poly"]])).astype(np.float32)
                m = cv2.GaussianBlur(m, (0, 0), 1.0) * pn["a"]; rgb = np.array(pn["rgb"], np.float32)
                da = base[..., 3:4]; oa = m[..., None] + da * (1 - m[..., None])
                base[..., :3] = (rgb * m[..., None] + base[..., :3] * da * (1 - m[..., None])) / np.maximum(oa, 1e-6)
                base[..., 3:4] = oa
            a2 = alpha[..., None]; oa = a2 + base[..., 3:4] * (1 - a2)
            col = (col * a2 + base[..., :3] * base[..., 3:4] * (1 - a2)) / np.maximum(oa, 1e-6)
            alpha = oa[..., 0]
            rgba = np.dstack([col, alpha * 255]).clip(0, 255).astype(np.uint8)
        front = [pn for pn in c.get("panels", []) if pn.get("front")]
        for pn in front:
            m = (poly_mask(sh, [pn["poly"]], width=pn["w"]) if pn.get("w") else poly_mask(sh, [pn["poly"]])).astype(np.float32)
            m = cv2.GaussianBlur(m, (0, 0), 1.0) * pn["a"]; rgb = np.array(pn["rgb"], np.float32)
            a2 = m[..., None]; oa = a2 + alpha[..., None] * (1 - a2)
            col = (rgb * a2 + col * alpha[..., None] * (1 - a2)) / np.maximum(oa, 1e-6); alpha = oa[..., 0]
            rgba = np.dstack([col, alpha * 255]).clip(0, 255).astype(np.uint8)
        for dp in c.get("drop_post", []):
            z = poly_mask(sh, [dp]); rgba[z, 3] = 0
            alpha = rgba[..., 3].astype(np.float32) / 255
        if c["warp"].get("clip_x"):
            x0_, x1_ = c["warp"]["clip_x"]; rgba[:, :x0_] = 0; rgba[:, x1_:] = 0; alpha = rgba[..., 3].astype(np.float32) / 255
    if c.get("min_cc"):   # stray specks (shadow, wall glints) that are not part of the product
        keep = small_cc(rgba[..., 3] > 60, c["min_cc"])
        keep = cv2.dilate(keep.astype(np.uint8), disk(3)) > 0
        rgba[~keep, 3] = 0
    for mz in c.get("speck_zones", []):   # loose specks in one area only (letters elsewhere can be small)
        z = poly_mask(rgba.shape[:2], [mz["poly"]]); a = rgba[..., 3] > 60
        rgba[z & a & ~small_cc(a, mz["min"]), 3] = 0
    for dp in c.get("drop_final", []):   # final-frame polygons removed (after any warp)
        rgba[poly_mask(rgba.shape[:2], [dp]), 3] = 0
    Image.fromarray(rgba, "RGBA").save(OUT / f"{name}.png")
    if c.get("band") or c.get("gc"):   # overlay of the tube outlines on the photo
        ov = Image.fromarray(I.astype(np.uint8)); dr = ImageDraw.Draw(ov)
        edge = band ^ (cv2.erode(band.astype(np.uint8), disk(3)) > 0)
        ova = np.asarray(ov).copy(); ova[edge] = (255, 0, 0)
        ov = Image.fromarray(ova); ov.thumbnail((1400, 1400)); ov.save(OUT / f"{name}-tube.jpg", quality=90)
    # debug: product over magenta, classes tinted
    dbg = np.full_like(I, (255, 0, 200))
    dbg = dbg * (1 - alpha[..., None]) + col * alpha[..., None]
    im = Image.fromarray(dbg.astype(np.uint8)); im.thumbnail((1000, 1000)); im.save(OUT / f"{name}-dbg.jpg", quality=88)
    print(name, "colour", colour.mean().round(3), "ink", ink.mean().round(3), "white", white.mean().round(3),
          "band", band.mean().round(3), "r", c["_r"])


if __name__ == "__main__":
    for n in sys.argv[1:]:
        cut(n)
