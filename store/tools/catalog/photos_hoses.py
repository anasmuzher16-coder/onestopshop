"""Publish the shop's hose photos: each cut-out master (IMG_xxxx.png, 720x900 RGBA: the hose in its bag, the bag kept as
see-through film, on transparency) -> store/public/img/pc/hose/<name>.webp, -m, -s, the same sizes and quality settings as
every catalogue photo (photos.save_set). The creased film is detailed, so these files come out about 4x heavier than the Ace
cut-outs at the same size (-s median about 64 KB against about 18 KB). The masters stay outside the repo; only the web sizes are kept.

  python store/tools/catalog/photos_hoses.py CROPS_DIR
  node store/tools/photo-versions.mjs          then, so each photo gets its version
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image  # noqa: E402

import catlib as C  # noqa: E402
import photos  # noqa: E402
import src_shop_hoses  # noqa: E402


def main(crops: Path):
    done = 0
    for name, _cap, _len, _brand, shots, _why in src_shop_hoses.HOSES:
        for photo, colour, _ in shots:
            if not (crops / f"{photo}.png").exists() and not photo.startswith("IMG_"):
                print(f"skipped {name} {colour}: no cut-out of {photo} (no photo of its own yet)")
                continue
            im = Image.open(crops / f"{photo}.png").convert("RGBA")
            if im.size != (photos.W, photos.H):
                raise SystemExit(f"{photo}.png is {im.size}, not the {photos.W}x{photos.H} frame")
            photos.save_set(im, C.STORE / "public" / "img" / "pc" / src_shop_hoses.photo_name(name, colour))
            done += 1
    print(f"{done} hose photos published to store/public/img/pc/hose/")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
