"""Per-photo settings: cfg.json, then cfg.d/<IMG>.json on top (one file per photo, so photos can be set up in parallel).
A photo with no "crop" gets the bag box from bags.json (3% side margin, 2%/1% top/bottom), as in/<IMG>.png."""
import json
from pathlib import Path
from plate import WD, BAGS

def crop_for(name, w=3024, h=4032):
    s = BAGS[name]
    x0 = int((min(s["l"]) - 0.03) * w); x1 = int((max(s["r"]) + 0.03) * w)
    y0 = int(max(0, s["top"] - 0.02) * h); y1 = int(min(1, s["bottom"] + 0.01) * h)
    return [max(0, x0), y0, min(w, x1), y1]

class _C(dict):
    def __missing__(self, k):
        if k in BAGS or (Path(__file__).parent / "cfg.d" / f"{k}.json").exists():
            self[k] = {}
            return self._fill(k)
        raise KeyError(k)
    def _fill(self, k):
        c = self[k]
        f = Path(__file__).parent / "cfg.d" / f"{k}.json"
        if f.exists():
            c.update(json.loads(f.read_text()))
        if "crop" not in c:
            c["crop"] = crop_for(k)   # a photo not in bags.json must give its own "crop" and "bagspec"
        return c

CFG = _C(json.loads((Path(__file__).parent / "cfg.json").read_text()))
for _k in list(CFG):
    CFG._fill(_k)
