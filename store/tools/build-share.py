"""Per-photo versions and link-preview (Open Graph) images for every product photo.

  python store/tools/build-share.py            all photos (only what changed is rewritten)
  python store/tools/build-share.py acc01      one photo, to look at it (written to the scratch path given by --out)

Run it after any photo rebuild (catalog/photos.py --publish, or a new file in public/img/pc). It writes:
  store/public/img/share/<photo>.jpg   1200 x 630, the size Facebook, iMessage, WhatsApp and X show without cropping
  store/public/img/share.jpg           the shop's own card, for every page that is not one product with a photo
  store/src/img-versions.json          {photo: version}: a short hash of that photo's files, so changing one photo changes
                                       only its own address (?v=...), never every image on the site (plan section 7)
store/tools/test-seo.mjs fails when a photo on disk no longer matches its version, so a forgotten run is caught.

The card (docs/SEO.md, "Share images"): the shop's chassis is fixed, the product is the one thing that changes.
The product stands on the bone tile and shelf it sits on in the shop, the shop's price-gun label (the site's device:
styles.css .sticker, the favicon) is stuck on the tile's corner, and a coal band carries the address. No price and no product name: prices change in the back
office and an image cannot follow them; the preview prints the page title beside it.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

STORE = Path(__file__).resolve().parent.parent
PC, OUT, VERS = STORE / "public/img/pc", STORE / "public/img/share", STORE / "src/img-versions.json"
HOME_OUT = STORE / "public/img/share.jpg"           # the shop's own card (home, sections, items with no photo)
W, H, U = 1200, 630, 8                              # the card, and the 8 px unit every measure below is a multiple of
CARD = 7                                            # bump when the card's design changes: every share image is redrawn


def oklch(l, c, h):
    """oklch -> sRGB tuple, the same values as store/public/tokens.css."""
    a, b = c * math.cos(math.radians(h)), c * math.sin(math.radians(h))
    l_, m_, s_ = l + 0.3963377774 * a + 0.2158037573 * b, l - 0.1055613458 * a - 0.0638541728 * b, l - 0.0894841775 * a - 1.2914855480 * b
    lr, mr, sr = l_ ** 3, m_ ** 3, s_ ** 3
    rgb = (4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr, -1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr, -0.0041960863 * lr - 0.7034186147 * mr + 1.7076147010 * sr)
    enc = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return tuple(max(0, min(255, round(enc(x) * 255))) for x in rgb)


COAL0, COAL2, ASH, BONE, BONELT, EMBER, WHITE = oklch(.155, .012, 50), oklch(.275, .014, 52), oklch(.72, .018, 70), oklch(.925, .022, 80), oklch(.90, .03, 80), oklch(.58, .215, 29), oklch(.985, .006, 85)


def base_photos():
    """Every product photo's base name (no -s/-m/-l), as products.img stores it: 'acc01', 'ace/ace-dmx-red'."""
    out = []
    for f in sorted(PC.rglob("*.webp")):
        stem = f.relative_to(PC).with_suffix("").as_posix()
        if not stem.endswith(("-s", "-m", "-l")):
            out.append(stem)
    return out


def version(stem):
    """A short hash of the photo and its smaller and larger cuts: changes only when one of this photo's files changes."""
    h = hashlib.sha256()
    for suf in ("", "-s", "-m", "-l"):
        f = PC / f"{stem}{suf}.webp"
        if f.exists():
            h.update(suf.encode() + f.read_bytes())
    return h.hexdigest()[:8]


# The shop's own card (home, sections, Everything): three of the shop's ticked Ace hookahs on the shelf.
# Plain names only (no other brand's name, plan section 8); the old card showed the retired sample hookahs.
HOME = ["ace/ace-226-wood-bronze", "ace/ace-dmx-red", "ace/ace-2312-mahir-ace-teal"]

# The composition. Previews crop: Facebook and X show 1.91:1, small iMessage and WhatsApp previews cut a centred square
# (x 285 to 915). Everything that must survive (the label and the product) sits inside that square; only the address,
# which the page title repeats anyway, lives in the coal band across the foot.
SAFE0, SAFE1 = (W - H) // 2, (W + H) // 2           # 285 .. 915
CX = 85 * U                                        # 680: the product's centre, right of the label, inside the square
FLOOR, FOOT = 65 * U, 71 * U                       # feet stand at y 520; the coal band starts at 568
BOX_W, BOX_H = 50 * U, 54 * U                      # 400 x 432: the longer side of every product is fitted to this box
SHELF = oklch(.86, .03, 78)                        # one step darker than the tile: the shelf the pieces stand on
PALE_TILE, PALE_SHELF = oklch(.56, .016, 60), oklch(.50, .016, 60)   # coal-3, the site's own field grey, for pale pieces


def lum(c):
    f = lambda v: (v / 255) / 12.92 if v / 255 <= .04045 else ((v / 255 + .055) / 1.055) ** 2.4
    return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2])


def contrast(piece, ground):
    """WCAG contrast between the piece's typical (median) opaque colour and the ground: computed, not guessed."""
    px = [p[:3] for p in piece.resize((max(1, piece.width // 4), max(1, piece.height // 4))).getdata() if p[3] > 200]
    if not px:
        return 21
    med = tuple(sorted(c[i] for c in px)[len(px) // 2] for i in range(3))
    a, b = lum(med), lum(ground)
    return (max(a, b) + .05) / (min(a, b) + .05)
_FACES = {}


def face(name, px, wght=None):
    """The site's own fonts (public/fonts, WOFF2), unpacked for Pillow with fontTools; Readex is variable."""
    import io
    from fontTools.ttLib import TTFont
    key = (name, px, wght)
    if key not in _FACES:
        t = TTFont(str(STORE / f"public/fonts/{name}-latin.woff2"))
        t.flavor = None
        buf = io.BytesIO()
        t.save(buf)
        buf.seek(0)
        f = ImageFont.truetype(buf, px)
        if wght:
            f.set_variation_by_axes([wght])
        _FACES[key] = f
    return _FACES[key]


SIZES = json.loads((PC / "sizes.json").read_text()) if (PC / "sizes.json").exists() else {}


def cutout(stem):
    """The product alone: a cut-out cropped to what is actually drawn (frame and foot margin dropped). A photo that was
    framed with its own soft shadow (sizes.json "shadow") loses that shadow first, so it never carries two. A photo with
    no transparency gets no card (None): pasted on the tile it would be a box, not a product on a shelf."""
    src = Image.open(PC / f"{stem}.webp")
    if src.mode != "RGBA":
        return None
    if (SIZES.get(stem.split("/")[-1]) or {}).get("shadow", 0) > .05:
        a = src.getchannel("A").point(lambda v: 0 if v < 110 else v)   # the baked shadow is faint; the product is not
        src = src.copy(); src.putalpha(a)
    box = src.getchannel("A").point(lambda a: 255 if a > 96 else 0).getbbox()
    return src.crop(box) if box else src


def fit(im, w, h):
    s = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def stand(card_im, piece, cx):
    """Puts a piece on the shelf at x = cx, feet on the floor line, with a soft contact shadow under the part that
    actually touches it (an angled piece rests on one end, not on the middle of its box)."""
    sh = Image.new("L", card_im.size, 0)
    a = piece.getchannel("A")
    foot = a.crop((0, max(0, piece.height - max(6, piece.height // 12)), piece.width, piece.height)).point(lambda v: 255 if v > 128 else 0).getbbox()
    x0 = round(cx - piece.width / 2)
    l, r = (x0 + foot[0], x0 + foot[2]) if foot else (x0, x0 + piece.width)
    pad = max(2 * U, (r - l) * .1)
    ImageDraw.Draw(sh).ellipse([l - pad, FLOOR - 1.5 * U, r + pad, FLOOR + 1.5 * U], fill=110)
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    card_im.paste(Image.new("RGB", card_im.size, COAL0), (0, 0), sh)
    card_im.paste(piece, (round(cx - piece.width / 2), FLOOR - piece.height), piece)


def label():
    """The shop's price-gun label (styles.css .sticker; the favicon): white stock, the ember band carrying ONE STOP,
    a perforation line, and SHOP in ink where the price would be. No price: an image cannot follow the back office."""
    em = 3 * U                                     # 1em of the site's label, in px
    band, pad = round(1.02 * em) + 2 * U, 2 * U + 4
    word = face("lalezar", 10 * U)
    wb = word.getbbox("SHOP")
    lw = wb[2] - wb[0] + 2 * pad
    lh = band + U + (wb[3] - wb[1]) + 2 * pad
    st = Image.new("RGBA", (lw, lh), (0, 0, 0, 0))
    d = ImageDraw.Draw(st)
    r = round(.2 * em)
    d.rounded_rectangle([0, 0, lw - 1, lh - 1], radius=r, fill=WHITE)
    d.rounded_rectangle([0, 0, lw - 1, band + r], radius=r, fill=EMBER)
    d.rectangle([0, band, lw - 1, band + r], fill=WHITE)
    bpx = 2 * U
    band_font = face("readex", bpx, 600)
    text, track = "ONE STOP", .14 * bpx
    tw = sum(band_font.getlength(c) for c in text) + track * (len(text) - 1)
    ob = band_font.getbbox("O")
    x, ty = (lw - tw) / 2, (band - (ob[3] - ob[1])) / 2 - ob[1]
    for c in text:                                   # letter-spaced like the site's band (.14em)
        d.text((x, ty), c, font=band_font, fill=WHITE)
        x += band_font.getlength(c) + track
    for x in range(round(.3 * em), lw - round(.3 * em), 6):   # the perforation, dashed
        d.line([x, band + U // 2 + 2, x + 2, band + U // 2 + 2], fill=(*COAL0, 90))
    d.text((pad - wb[0], band + U + pad - wb[1]), "SHOP", font=word, fill=COAL0)
    st = st.rotate(6, resample=Image.BICUBIC, expand=True)   # stuck on by hand, -6 degrees like the favicon
    # its shadow, like the site's (a contact edge and a soft drop): a blurred, offset copy of the label's shape
    out = Image.new("RGBA", (st.width + 8 * U, st.height + 8 * U), (0, 0, 0, 0))
    sa = Image.new("L", out.size, 0)
    sa.paste(st.getchannel("A").point(lambda v: v * 80 // 255), (4 * U, 4 * U + 6))
    shadow = Image.new("RGBA", out.size, (*COAL0, 0))
    shadow.putalpha(sa.filter(ImageFilter.GaussianBlur(9)))
    out.alpha_composite(shadow)
    out.alpha_composite(st, (4 * U, 4 * U))
    return out


_LAB = None


def label_box():
    """The label image and where its white stock actually is (measured from its pixels, shadow excluded)."""
    global _LAB
    if _LAB is None:
        lab = label()
        _LAB = (lab, lab.getchannel("A").point(lambda v: 255 if v > 200 else 0).getbbox())
    return _LAB


LABEL_LEFT, LABEL_TOP = SAFE0 + 3 * U, 3 * U                     # the stock's left edge: 24 px inside the square (rounded preview corners)
RIGHT = SAFE1 - 2 * U                                            # 899: nothing past the square's right edge, less a margin


def place(piece):
    """Where a piece stands: clear of the label's corner (a tall piece starts right of it), never past the square's right
    edge, and a flat piece is enlarged so it never shrinks to a sliver."""
    if piece.height < 18 * U:                                   # very flat (a stem, a mouthpiece): at least 144 px tall
        piece = fit(piece, 2 * (RIGHT - CX) + 10 * U, 18 * U)   # ... within the square, centred under the label
        return piece, (SAFE0 + RIGHT) // 2 + U
    lab, b = label_box()
    LABEL_R, LABEL_B = LABEL_LEFT + b[2] - b[0], LABEL_TOP + b[3] - b[1]
    if FLOOR - piece.height < LABEL_B:                          # its top reaches the label's height: start right of it
        room = RIGHT - LABEL_R
        if piece.width > room:
            piece = fit(piece, room, piece.height)
        return piece, LABEL_R + piece.width // 2 + max(0, (room - piece.width) // 4)
    return piece, CX


def card(stem):
    pieces = [cutout(s_) for s_ in (HOME if stem == "home" else [stem])]
    if any(p is None for p in pieces):
        return None
    lab, b = label_box()
    LABEL_R, LABEL_B = LABEL_LEFT + b[2] - b[0], LABEL_TOP + b[3] - b[1]
    # a pale piece (white rubber, clear glass) would vanish on bone: it gets the darker tile step instead
    tile, shelf = (BONELT, SHELF) if contrast(pieces[0], BONELT) >= 1.5 else (PALE_TILE, PALE_SHELF)
    im = Image.new("RGB", (W, H), tile)
    d = ImageDraw.Draw(im)
    d.rectangle([0, FLOOR - 4 * U, W, FOOT], fill=shelf)       # the shelf, the full width
    if stem == "home":     # three pieces at one scale below the label, overlapping a little, the middle one in front
        pieces = [fit(p, BOX_W, FLOOR - LABEL_B - 2 * U) for p in pieces]
        gap = 18 * U
        for i in (0, 2, 1):
            stand(im, pieces[i], LABEL_R - 2 * U + (i - 1) * gap)
    else:
        piece, cx = place(fit(pieces[0], BOX_W, BOX_H))
        stand(im, piece, cx)
    im.paste(lab, (LABEL_LEFT - b[0], LABEL_TOP - b[1]), lab)   # inside the top-left corner of the safe square
    # the foot: the address, the one fact every preview carries, in the site's text face
    d.rectangle([0, FOOT, W, H], fill=COAL0)
    small = face("readex", 3 * U + 4, 500)
    t = "760 Wyandotte St E, Windsor"
    tb = small.getbbox(t)                                  # centred, so a square crop keeps all of it
    d.text(((W - (tb[2] - tb[0])) / 2 - tb[0], FOOT + (H - FOOT - (tb[3] - tb[1])) / 2 - tb[1]), t, font=small, fill=BONE)
    return im


def main(argv):
    out_dir = Path(argv[argv.index("--out") + 1]) if "--out" in argv else None
    only = [a for i, a in enumerate(argv) if not a.startswith("--") and not (i and argv[i - 1] == "--out")]
    if only and out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        for stem in only:
            c = card(stem)
            if c is None:
                print(stem, "has no transparency: no card"); continue
            c.save(out_dir / (stem.replace("/", "_") + ".jpg"), "JPEG", quality=82, optimize=True, progressive=True)
        return
    old = json.loads(VERS.read_text()) if VERS.exists() else {}
    vers, wrote, nocard = {}, 0, []
    for stem in base_photos():
        v = version(stem) + str(CARD)
        vers[stem] = v
        f = OUT / f"{stem}.jpg"
        if old.get(stem) == v and (f.exists() or stem in old.get("_nocard", [])):
            if stem in old.get("_nocard", []): nocard.append(stem)
            continue
        c = card(stem)
        if c is None:                     # no transparency: the page shares the shop's card instead (src/seo.js)
            nocard.append(stem); f.unlink(missing_ok=True); continue
        f.parent.mkdir(parents=True, exist_ok=True)
        c.save(f, "JPEG", quality=82, optimize=True, progressive=True)
        wrote += 1
    v = hashlib.sha256("".join(vers[s_] for s_ in HOME).encode()).hexdigest()[:8] + str(CARD)
    vers["_home"] = v
    if old.get("_home") != v:   # the shop's card keeps its old address (img/share.jpg), so it is redrawn only when its photos change
        card("home").save(HOME_OUT, "JPEG", quality=82, optimize=True, progressive=True)
        wrote += 1
    for f in OUT.rglob("*.jpg"):   # a photo that is gone takes its share image with it
        if f.relative_to(OUT).with_suffix("").as_posix() not in vers:
            f.unlink()
    vers["_nocard"] = sorted(nocard)
    VERS.write_text(json.dumps(vers, indent=0, sort_keys=True) + "\n")
    print(f"{len(vers)} photos, {wrote} share images written, versions in {VERS.relative_to(STORE)}")


if __name__ == "__main__":
    main(sys.argv[1:])
