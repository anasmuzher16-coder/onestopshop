"""Publish the shop's original hookah photos (owner, 2026-11-27: "put up the og photos of the hookahs with a 'to be replaced'
tag"). Each photo (FULL_DIR/IMG_xxxx.jpg, the 4032x3024 HEIC converted as shot, the hookah lying base-left on the counter)
is turned upright (base down), cropped to the store's 4:5 frame (full width, a sliver off each end) and saved as
store/public/img/pc/hookah/<name>-<colour>{,-l,-m,-s}.webp. Counter and mat stay in: these are stand-ins, shown with
"Photo to be replaced" until a cleaned photo is saved under the same name.

An EXACT hookah's web photo is cut out (rembg p -m birefnet-general-lite WEB_DIR CUT_DIR) and framed like the Ace hookahs
(frame_cutouts.py CUT_DIR WEB_FRAMED --kind hookah IMG_xxxx ...); this copies WEB_FRAMED/IMG_xxxx{,-m,-s,-l}.webp in.

A cleaned shop photo (src_shop_hookahs.CLEANED: clear_glass2.py, then frame_cutouts.py CUT CLEAN_FRAMED --kind hookah
--glass IMG_xxxx ...) is copied in from CLEAN_FRAMED/IMG_xxxx{,-m,-s,-l}.webp in place of the original, same file name.
--clean-only copies just those (FULL_DIR and WEB_FRAMED are then not read) and leaves every other photo as it is.

  python store/tools/catalog/photos_shop_hookahs.py FULL_DIR WEB_FRAMED [CLEAN_FRAMED]
  python store/tools/catalog/photos_shop_hookahs.py --clean-only CLEAN_FRAMED
  python store/tools/catalog/photos_shop_hookahs.py --add FULL_DIR PHOTO ...   only these originals (the 2026-11-28 batch,
                                                       shot upright: src_shop_hookahs.UPRIGHT), every other photo untouched
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
            if src.stem not in src_shop_hookahs.UPRIGHT:
                raise SystemExit(f"{src.name} is portrait: expected the hookah lying base-left")
            up = im                                # the 2026-11-28 batch: shot upright, base down, only cropped
        else:
            up = im.rotate(90, expand=True)        # base (left) to the bottom
    w, h = up.size
    ch = round(w * 5 / 4)
    if ch > h:
        cw = round(h * 4 / 5)
        x = (w - cw) // 2
        return up.crop((x, 0, x + cw, h))
    y = (h - ch) // 2
    return up.crop((0, y, w, y + ch))


def copy_framed(folder: Path, photo: str, dst: Path, want: set):
    """Copy a framed cut-out (RGBA, 720x900 and the other sizes; the large one only if made) in under dst's name."""
    for suf, size in SIZES.items():
        src = folder / f"{photo}{suf}.webp"
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


def clean_only(clean: Path):
    pc = C.STORE / "public" / "img" / "pc"
    n = 0
    for name, _fam, _where, shots, _why, _group in src_shop_hookahs.HOOKAHS:
        for photo, colour, page in shots:
            if photo in src_shop_hookahs.CLEANED and not page:
                copy_framed(clean, photo, pc / src_shop_hookahs.photo_name(name, colour), set())
                n += 1
    print(f"{n} cleaned hookah photos copied to store/public/img/pc/hookah/")


def main(full: Path, web: Path, clean: Path | None = None):
    pc = C.STORE / "public" / "img" / "pc"
    want, done, webs = set(), 0, 0
    for name, _fam, _where, shots, _why, _group in src_shop_hookahs.HOOKAHS:
        for photo, colour, page in shots:
            dst = pc / src_shop_hookahs.photo_name(name, colour)
            dst.parent.mkdir(parents=True, exist_ok=True)
            if photo in src_shop_hookahs.CLEANED and not page:
                if clean is None:
                    raise SystemExit(f"{photo} is cleaned: give CLEAN_FRAMED")
                copy_framed(clean, photo, dst, want)
                done += 1
                continue
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


def add_only(full: Path, photos: list[str]):
    """Publish only the listed originals (the 2026-11-28 batch), leaving every other hookah photo as it is."""
    pc = C.STORE / "public" / "img" / "pc"
    want, n = set(photos), 0
    for name, _fam, _where, shots, _why, _group in src_shop_hookahs.HOOKAHS:
        for photo, colour, page in shots:
            if photo not in want:
                continue
            if page or photo in src_shop_hookahs.CLEANED:
                raise SystemExit(f"{photo} is a web or cleaned photo: --add publishes originals only")
            dst = pc / src_shop_hookahs.photo_name(name, colour)
            dst.parent.mkdir(parents=True, exist_ok=True)
            base = frame(full / f"{photo}.jpg")
            for suf, size in SIZES.items():
                base.resize(size, Image.LANCZOS).save(dst.with_name(dst.name + suf + ".webp"), "WEBP",
                                                      quality=82 if suf != "-l" else 78, method=6)
            want.discard(photo)
            n += 1
    if want:
        raise SystemExit(f"not on the hookah list: {sorted(want)}")
    print(f"{n} original hookah photos published to store/public/img/pc/hookah/")


if __name__ == "__main__":
    if sys.argv[1] == "--clean-only":
        clean_only(Path(sys.argv[2]))
    elif sys.argv[1] == "--add":
        add_only(Path(sys.argv[2]), sys.argv[3:])
    else:
        main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]) if len(sys.argv) > 3 else None)
