"""Publish the shop's bowl photos: each cut-out (CROPS_DIR/IMG_xxxx.webp, -m, -s and, where the source carried the
detail, -l; already framed at 720x900 like the Ace accessories: product up to 580 tall / 560 wide, centred, transparent)
-> store/public/img/pc/bowl/<name>-<colour>{,-l,-m,-s}.webp. The shop's photos are 3024x4032 HEIC: they are converted and cut
out (rembg, birefnet-general-lite) outside the repo; only the web sizes are kept here.

  rembg p -m birefnet-general-lite FULL_JPEG_DIR CUTOUT_DIR
  python store/tools/catalog/frame_cutouts.py CUTOUT_DIR CROPS_DIR --kind bowl IMG_0589 ...
  python store/tools/catalog/photos_shop_bowls.py CROPS_DIR
  node store/tools/photo-versions.mjs          then, so each photo gets its version
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image  # noqa: E402

import catlib as C  # noqa: E402
import src_shop_bowls  # noqa: E402

SIZES = {"": (720, 900), "-m": (540, 675), "-s": (360, 450), "-l": (1440, 1800)}


def main(crops: Path):
    pc = C.STORE / "public" / "img" / "pc"
    done = large = 0
    want = set()
    for name, _brand, _where, shots, _why in src_shop_bowls.ALL_BOWLS:
        for photo, colour, _ in shots:
            dst = pc / src_shop_bowls.photo_name(name, colour)
            dst.parent.mkdir(parents=True, exist_ok=True)
            for suf, size in SIZES.items():
                src = crops / f"{photo}{suf}.webp"
                if not src.exists():
                    if suf == "-l":
                        continue
                    raise SystemExit(f"missing {src}")
                with Image.open(src) as im:
                    if im.size != size or im.mode != "RGBA":
                        raise SystemExit(f"{src.name} is {im.size} {im.mode}, not {size} RGBA")
                out = dst.with_name(dst.name + suf + ".webp")
                want.add(out.name)
                shutil.copyfile(src, out)
                large += suf == "-l"
            done += 1
    want |= C.more_photo_files("bowl")   # the extra angles of an item (products.img_more) stay
    for old in (pc / "bowl").glob("*.webp"):   # a photo no longer on the list goes
        if old.name not in want:
            old.unlink()
    print(f"{done} bowl photos published to store/public/img/pc/bowl/ ({large} with a 1440 size)")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
