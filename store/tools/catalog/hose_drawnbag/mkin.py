"""in/<IMG>.png: the bag-box crop of each full photo (the coordinate frame for every cfg.d polygon)."""
import sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from cfgload import CFG
from plate import WD, FULL, BAGS
for n in (sys.argv[1:] or list(BAGS)):
    p = WD / "in" / f"{n}.png"
    if p.exists():
        continue
    x0, y0, x1, y1 = CFG[n]["crop"]
    Image.open(FULL / f"{n}.jpg").convert("RGB").crop((x0, y0, x1, y1)).save(p)
    print(n, CFG[n]["crop"])
