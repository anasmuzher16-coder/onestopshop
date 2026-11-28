"""check/<IMG>.jpg: source photo | new on chartreuse | orange | teal (each 540x675, from the 1440 file), for a quick look.
usage: check.py IMG_xxxx [...]"""
import sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from tiles import TILES
from plate import WD
(WD / "check").mkdir(exist_ok=True)
for n in sys.argv[1:]:
    a = Image.open(WD / "out" / f"{n}-l.png")
    src = Image.open(WD / "in" / f"{n}.png").convert("RGB"); src.thumbnail((540, 675))
    sheet = Image.new("RGB", (540 * 4, 675), (30, 28, 26)); sheet.paste(src, ((540 - src.width) // 2, 0))
    for i, c in enumerate(TILES.values()):
        t = Image.new("RGBA", a.size, c + (255,)); t.alpha_composite(a)
        sheet.paste(t.convert("RGB").resize((540, 675), Image.LANCZOS), (540 * (i + 1), 0))
    sheet.save(WD / "check" / f"{n}.jpg", quality=90)
    print("check/" + n + ".jpg")
