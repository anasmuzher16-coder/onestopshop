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
Coal ground, the wordmark with SHOP on the counter sticker (the site's device, as in the favicon), the address, and
the product standing on the bone tile it sits on in the shop. No price and no product name: prices change in the back
office and an image cannot follow them; the preview prints the page title beside it.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

STORE = Path(__file__).resolve().parent.parent
PC, OUT, VERS = STORE / "public/img/pc", STORE / "public/img/share", STORE / "src/img-versions.json"
HOME_OUT = STORE / "public/img/share.jpg"           # the shop's own card (home, sections, items with no photo)
FONT = STORE / "tools/assets/lalezar-latin.woff"   # Lalezar, the site's display face (SIL OFL), as WOFF so Pillow can read it
W, H, U = 1200, 630, 8                              # the card, and the 8 px unit every measure below is a multiple of
CARD = 4                                            # bump when the card's design changes: every share image is redrawn


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


# The shop's own card (home, sections, Everything): three of the shop's ticked Ace hookahs side by side on the tile.
# Plain names only (no other brand's name, plan section 8); the old card showed the retired sample hookahs.
HOME = ["ace/ace-226-wood-bronze", "ace/ace-dmx-red", "ace/ace-2312-mahir-ace-teal"]


def card(stem):
    font = lambda px: ImageFont.truetype(str(FONT), px)
    im = Image.new("RGB", (W, H), COAL0)
    d = ImageDraw.Draw(im)
    # the tile: the right 640 px, the bone the shop's photographed pieces stand on
    tx = W - 80 * U
    d.rectangle([tx, 0, W, H], fill=BONELT)
    if stem == "home":     # three pieces, each at the same scale, overlapping a little like a shelf
        tile = im.crop((tx, 0, W, H))   # drawn on the tile alone, so nothing crosses onto the coal or off the card
        for i, s_ in enumerate(HOME):
            src = Image.open(PC / f"{s_}.webp")
            s = (H - 8 * U) / src.height
            p = src.resize((round(src.width * s), H - 8 * U), Image.LANCZOS)
            tile.paste(p, (round(80 * U * (2 * i + 1) / 6 - p.width / 2), 8 * U), p)   # centres at 1/6, 3/6, 5/6, feet on one line
        im.paste(tile, (tx, 0))
        src = None
    else:
        src = Image.open(PC / f"{stem}.webp")
    if src is None:
        pass
    elif src.mode == "RGBA":   # a cut-out, framed 720 x 900 with its foot margin: stands on the tile at full height
        s = H / src.height
        p = src.resize((round(src.width * s), H), Image.LANCZOS)
        im.paste(p, (tx + (80 * U - p.width) // 2, 0), p)
    else:                    # a full photo (the few older shots with their own background): fills the tile
        s = max(80 * U / src.width, H / src.height)
        p = src.convert("RGB").resize((math.ceil(src.width * s), math.ceil(src.height * s)), Image.LANCZOS)
        im.paste(p.crop(((p.width - 80 * U) // 2, (p.height - H) // 2, (p.width - 80 * U) // 2 + 80 * U, (p.height - H) // 2 + H)), (tx, 0))
    # the wordmark, left-aligned on the 8 px grid: ONE STOP in bone, SHOP on the ember sticker set at -6 degrees
    x0, y0, px = 8 * U, 8 * U, 16 * U
    while font(px).getlength("ONE STOP") > tx - x0 - 8 * U:   # the widest size that keeps a full 64 px gutter before the tile
        px -= U // 2
    big = font(px)
    d.text((x0, y0), "ONE STOP", font=big, fill=BONE)
    asc = big.getbbox("ONE STOP")
    sw = big.getbbox("SHOP")
    pad = 3 * U
    st = Image.new("RGBA", (sw[2] + 2 * pad, (sw[3] - sw[1]) + 2 * pad), (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    sd.rounded_rectangle([0, 0, st.width - 1, st.height - 1], radius=U // 2, fill=EMBER)
    sd.text((pad, pad - sw[1]), "SHOP", font=big, fill=WHITE)
    st = st.rotate(6, resample=Image.BICUBIC, expand=True)
    im.paste(st, (x0 - U, y0 + asc[3] + 2 * U), st)
    # the address, the one fact every preview should carry: where the counter is
    small = font(4 * U)
    d.line([x0, H - 15 * U, tx - 8 * U, H - 15 * U], fill=COAL2, width=1)
    d.text((x0, H - 13 * U), "760 Wyandotte St E, Windsor", font=small, fill=ASH)
    return im


def main(argv):
    out_dir = Path(argv[argv.index("--out") + 1]) if "--out" in argv else None
    only = [a for i, a in enumerate(argv) if not a.startswith("--") and not (i and argv[i - 1] == "--out")]
    if only and out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        for stem in only:
            card(stem).save(out_dir / (stem.replace("/", "_") + ".jpg"), "JPEG", quality=82, optimize=True, progressive=True)
        return
    old = json.loads(VERS.read_text()) if VERS.exists() else {}
    vers, wrote = {}, 0
    for stem in base_photos():
        v = version(stem) + str(CARD)
        vers[stem] = v
        f = OUT / f"{stem}.jpg"
        if old.get(stem) == v and f.exists():
            continue
        f.parent.mkdir(parents=True, exist_ok=True)
        card(stem).save(f, "JPEG", quality=82, optimize=True, progressive=True)
        wrote += 1
    v = hashlib.sha256("".join(vers[s_] for s_ in HOME).encode()).hexdigest()[:8] + str(CARD)
    vers["_home"] = v
    if old.get("_home") != v:   # the shop's card keeps its old address (img/share.jpg), so it is redrawn only when its photos change
        card("home").save(HOME_OUT, "JPEG", quality=82, optimize=True, progressive=True)
        wrote += 1
    for f in OUT.rglob("*.jpg"):   # a photo that is gone takes its share image with it
        if f.relative_to(OUT).with_suffix("").as_posix() not in vers:
            f.unlink()
    VERS.write_text(json.dumps(vers, indent=0, sort_keys=True) + "\n")
    print(f"{len(vers)} photos, {wrote} share images written, versions in {VERS.relative_to(STORE)}")


if __name__ == "__main__":
    main(sys.argv[1:])
