"""Publish the shop's original hookah photos (owner, 2026-11-27: "put up the og photos of the hookahs with a 'to be replaced'
tag"). Each photo (FULL_DIR/IMG_xxxx.jpg, the 4032x3024 HEIC converted as shot, the hookah lying base-left on the counter)
is turned upright (base down), cropped to the store's 4:5 frame (full width, a sliver off each end) and saved as
store/public/img/pc/hookah/<name>-<colour>{,-l,-m,-s}.webp. Counter and mat stay in: these are stand-ins, shown with
"Photo to be replaced" until a cleaned photo is saved under the same name.

An EXACT hookah's web photo is cut out (rembg p -m birefnet-general-lite WEB_DIR CUT_DIR) and framed like the Ace hookahs
(frame_cutouts.py CUT_DIR WEB_FRAMED --kind hookah IMG_xxxx ...); this copies WEB_FRAMED/IMG_xxxx{,-m,-s,-l}.webp in.

  python store/tools/catalog/photos_shop_hookahs.py FULL_DIR WEB_FRAMED
  node store/tools/photo-versions.mjs          then, so each photo gets its version
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image  # noqa: E402

import catlib as C  # noqa: E402
import src_shop_hookahs  # noqa: E402

SIZES = {"": (720, 900), "-m": (540, 675), "-s": (360, 450), "-l": (1440, 1800)}


def frame(src: Path) -> Image.Image:
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width < im.height:
            raise SystemExit(f"{src.name} is portrait: expected the hookah lying base-left")
        up = im.rotate(90, expand=True)            # base (left) to the bottom
    w, h = up.size
    ch = round(w * 5 / 4)
    if ch > h:
        cw = round(h * 4 / 5)
        x = (w - cw) // 2
        return up.crop((x, 0, x + cw, h))
    y = (h - ch) // 2
    return up.crop((0, y, w, y + ch))


def main(full: Path, web: Path):
    pc = C.STORE / "public" / "img" / "pc"
    want, done, webs = set(), 0, 0
    for name, _fam, _where, shots, _why, _group in src_shop_hookahs.HOOKAHS:
        for photo, colour, page in shots:
            dst = pc / src_shop_hookahs.photo_name(name, colour)
            dst.parent.mkdir(parents=True, exist_ok=True)
            if page:   # the web photo, already cut out and framed (RGBA, 720x900 and the other sizes)
                for suf, size in SIZES.items():
                    src = web / f"{photo}{suf}.webp"
                    if not src.exists():
                        if suf == "-l":
                            continue
                        raise SystemExit(f"missing {src}")
                    with Image.open(src) as im:
                        if im.size != size or im.mode != "RGBA":
                            raise SystemExit(f"{src.name} is {im.size} {im.mode}, not {size} RGBA")
                    out = dst.with_name(dst.name + suf + ".webp")
                    shutil.copyfile(src, out)
                    want.add(out.name)
                webs += 1
                continue
            base = frame(full / f"{photo}.jpg")
            for suf, size in SIZES.items():
                out = dst.with_name(dst.name + suf + ".webp")
                base.resize(size, Image.LANCZOS).save(out, "WEBP", quality=82 if suf != "-l" else 78, method=6)
                want.add(out.name)
            done += 1
    for old in (pc / "hookah").glob("*.webp"):   # a photo no longer on the list goes
        if old.name not in want:
            old.unlink()
    print(f"{done} original and {webs} web hookah photos published to store/public/img/pc/hookah/")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
