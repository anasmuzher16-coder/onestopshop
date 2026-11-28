"""Before (live) / after (drawn bag) on the three tiles, at the size shoppers see.
desktop 1440x900: product tile 720 x 824 css (100svh-76), shot padding 5% 12%, 4:5 contain, bottom-aligned, DPR 1, 720 file
phone 390x844 @3x: tile 390 x 409 css (min(105vw,52svh)), padding 7% 6% 5% of width, DPR 3, 720 file (largest shipped)"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, str(Path(__file__).parent))
from tiles import TILES
from plate import WD
LIVE = Path(__file__).resolve().parents[3] / "public" / "img" / "pc" / "hose"   # the shipped files (before/after sheets)
ROWS = [("IMG_0577", "crown-disposable-hose-orange", "Crown (coloured hose, printed card)"),
        ("IMG_0568", "sager-washable-hose-pink", "Sager (white print on the bag)"),
        ("IMG_0545", "simba-disposable-hose-white", "Simba (white hose)")]
F = lambda s: ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", s)
FB = lambda s: ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", s)


def tile(img, tone, tw, th, pad, dpr):
    t = Image.new("RGBA", (tw * dpr, th * dpr), TILES[tone] + (255,))
    pt, pr, pb, pl = [round(p * dpr) for p in pad]
    bw, bh = t.width - pl - pr, t.height - pt - pb
    s = min(bw / img.width, bh / img.height)
    r = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    t.alpha_composite(r, (pl + (bw - r.width) // 2, pt + bh - r.height))
    return t.convert("RGB")


def build(kind):
    if kind == "1440":
        tw, th, dpr = 720, 824, 1; pad = (824 * .05, 720 * .12, 824 * .05, 720 * .12); suf = ""
    else:
        tw, th, dpr = 390, 409, 3; pad = (390 * .07, 390 * .06, 390 * .05, 390 * .06); suf = ""   # the store ships 720 as its largest hose file
    W, H = tw * dpr, th * dpr
    gap, head, lab = 24, 90, 110
    sheet = Image.new("RGB", (6 * W + 7 * gap, head + 3 * (lab + H + gap)), (22, 20, 18))
    d = ImageDraw.Draw(sheet)
    d.text((gap, 20), f"Hoses, drawn clear bag: live (left of each pair) vs new (right) at {'1440 desktop product page, 1x' if kind == '1440' else '390 phone product page, 3x'}",
           fill=(235, 232, 225), font=FB(36))
    for i, (n, live, title) in enumerate(ROWS):
        y = head + i * (lab + H + gap)
        d.text((gap, y + 4), title, fill=(235, 232, 225), font=FB(34))
        before = Image.open(LIVE / f"{live}{suf}.webp").convert("RGBA")
        after = Image.open(WD / "out" / f"{n}{suf}.png").convert("RGBA")
        for j, tone in enumerate(TILES):
            for k, (im, nm) in enumerate(((before, "live"), (after, "new"))):
                x = gap + (j * 2 + k) * (W + gap)
                sheet.paste(tile(im, tone, tw, th, pad, dpr), (x, y + lab))
                d.text((x + 4, y + 62), f"{tone} / {nm}", fill=(170, 165, 155), font=F(26))
    return sheet


if __name__ == "__main__":
    a, b = build("1440"), build("390")
    a.save(WD / "samples-1440.png"); b.save(WD / "samples-390.png")
    # overview: both blocks, reduced to one readable sheet
    s = 2400 / b.width
    b2 = b.resize((2400, round(b.height * s)), Image.LANCZOS)
    a2 = a.resize((2400, round(a.height * 2400 / a.width)), Image.LANCZOS)
    ov = Image.new("RGB", (2400, a2.height + b2.height), (22, 20, 18)); ov.paste(a2, (0, 0)); ov.paste(b2, (0, a2.height))
    ov.save(WD / "samples-sheet.png")
    print(a.size, b.size, ov.size)
