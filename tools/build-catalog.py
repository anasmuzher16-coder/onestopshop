# Builds site/catalog.js: fake products for the mockup, modelled on real retailer data
# (assets-src/picked.json: real photo, real price band, real shipping weight where the feed had one).
# Names are invented. Photos are PLACEHOLDERS to be replaced by the shop's own.
import json, math
src = {x['id']: x for x in json.load(open('assets-src/picked.json', encoding='utf8'))}
SZ = json.load(open('site/img/pc/sizes.json', encoding='utf8'))  # written by tools/products.mjs
N = {
 # id: (name, one-line note, height cm or None, glass)
 'hookah00': ('Sultan Gorgon', 'Cast steel sculpture stem, cut crystal base', 78, True),
 'hookah04': ('Sultan Nightfall', 'Hand-finished stem with rose inlay', 76, True),
 'hookah06': ('Sultan Totem', 'Carved totem stem, crystal base', 78, True),
 'hookah09': ('Sultan Sentinel', 'Polished steel, cut crystal base', 74, True),
 'hookah10': ('Sultan Legion', 'Polished steel, cut crystal base', 74, True),
 'hookah11': ('Resin Rook, Blue Honeycomb', 'Poured resin stem, one of one', 70, True),
 'hookah12': ('Resin Rook, Green Burl', 'Poured resin and burl wood stem', 70, True),
 'hookah14': ('Resin Bishop, Clear Blue', 'Poured resin stem, one of one', 72, True),
 'hookah18': ('Resin Rook, Cream', 'Poured resin stem, one of one', 70, True),
 'hookah16': ('Stuttgart One', 'German stainless, closed chamber', 68, True),
 'hookah22': ('Woodline Sage', 'Lacquered wood stem, steel core', 60, False),
 'hookah25': ('Steel Compact', 'Brushed stainless, wide base', 48, True),
 'hookah28': ('Regent Maroon', 'Laminated wood stem, gold-band base', 70, True),
 'hookah34': ('Pearwood Matte', 'Turned pear wood, steel tray', 58, False),
 'hookah36': ('Stuttgart Pure, Jade', 'Stainless stem, jade glass base', 56, True),
 'hookah37': ('Lounge Six', 'Stainless, click-lock clear base', 60, True),
 'hookah40': ('Regent Neon Blue', 'Anodised blue stem, gold-band base', 68, True),
 'hookah41': ('Regent Neon Pink', 'Glow stem, gold-band base', 68, True),
 'hookah45': ('Cairo Elwel', 'Egyptian brass, hand engraved', 76, True),
 'hookah46': ('Mini Classic', 'Compact steel, cut glass base', 38, True),
 'hookah50': ('Orbit', 'Steel stem, prism cut base', 62, True),
 'hookah51': ('Carbon Black', 'Carbon fibre stem, smoke glass', 58, True),
 'hookah52': ('Cairo Avatar', 'Egyptian brass and copper', 80, True),
 'hookah54': ('Cairo Iowa', 'Egyptian brass, tall stem', 82, True),
 'hookah57': ('Stuttgart Mini', 'Stainless, compact travel size', 42, True),
 'hookah64': ('Mamoun Cafe Chiller', 'Egyptian steel with ice chamber', 86, True),
 'hookah65': ('Mamoun Kamanja Gold', 'Egyptian brass, single hose', 74, True),
 'hookah67': ('Soft Draw', 'Slim steel, clear bell base', 52, True),
 'hookah71': ('Maister Steel', 'Stainless, straight stem', 50, True),
 'hookah76': ('Lima Alu', 'Aluminium stem, amber base', 56, True),
 'hookah77': ('Mamoun Hatshepsut', 'Egyptian brass, wide tray', 84, True),
 'hookah78': ('Mamoun Aten', 'Egyptian brass, tall stem', 88, True),
 'hookah84': ('Mamoun Star', 'Egyptian steel, painted base', 66, True),
 'hookah88': ('Mamoun Mini Shamadan', 'Black oxide, compact', 46, True),
 'hookah89': ('Mamoun Moagza Copper', 'Oxidised copper, single hose', 54, True),
 'hookah90': ('Mamoun Door, Green', 'Egyptian steel, green glass', 58, True),
 'hookah91': ('Aiko', 'Compact, blue glass base', 34, True),
 'hookah92': ('VIP Acrylic 10 in', 'Acrylic base, travel ready', 26, False),
 'hookah93': ('Pia', 'Compact, amber glass, leather hose', 28, True),
 'base00': ('Stuttgart click base', 'Clear, click-lock collar', None, True),
 'base01': ('Bell Pro base', 'Diamond cut crystal', None, True),
 'base02': ('Bubble base', 'Pressed glass, three colours', None, True),
 'base03': ('Craft drop base', 'Textured glass, black or red', None, True),
 'base04': ('Crystal cut base', 'Cut glass, green, amber or blue', None, True),
 'base06': ('Slim cone base', 'Clear, teal or red', None, True),
 'base07': ('Amber marble drop base', 'Mixed glass, each one different', None, True),
 'base12': ('Slate drop base', 'Smoke grey glass', None, True),
 'base13': ('Diamond drop base', 'Cut clear glass', None, True),
 'base15': ('Scratch base, black fade', 'Cut glass with black fade', None, True),
 'base18': ('Future mini base', 'Smoke grey, ribbed foot', None, True),
 'base21': ('Smooth drop base', 'Smoke black glass', None, True),
 'bowl01': ('Swirl phunnel, white', 'Ceramic insert, silicone body', None, False),
 'bowl03': ('Daily bowl, cobalt', 'Glazed stoneware', None, False),
 'bowl05': ('Red clay bowl', 'Glazed red clay, classic holes', None, False),
 'bowl06': ('Blush special bowl', 'Glazed clay, pink marble', None, False),
 'bowl09': ('Rook bowl, aurora glaze', 'Hand glazed, each one different', None, False),
 'bowl10': ('Atlantis phunnel', 'Carved stoneware, drip glaze', None, False),
 'bowl12': ('Black ribbed bowl', 'Matte black clay', None, False),
 'bowl16': ('Lava bowl', 'Red and gold glaze', None, False),
 'bowl19': ('Taiga bowl', 'Unglazed dark clay, fluted', None, False),
 'bowl20': ('Terracotta bowl', 'Raw terracotta, classic holes', None, False),
 'bowl22': ('Bark bowl', 'Textured brown clay', None, False),
 'bowl23': ('Crystal bowl', 'Pressed glass', None, True),
 'bowl29': ('Silicone funnel bowl', 'Unbreakable silicone', None, False),
 'bowl26': ('Vented heat lid', 'Aluminium, with handle', None, False),
 'bowl30': ('Metal screen with handle', 'Perforated steel', None, False),
 'hmd05': ('Steel heat ring', 'Stainless, low profile', None, False),
 'hmd06': ('Forge heat keeper', 'Ceramic-coated dome', None, False),
 'hmd07': ('Provost heat keeper', 'Stainless, adjustable vents', None, False),
 'hmd09': ('Steel heat keeper with lid', 'Stainless, two piece', None, False),
 'hmd10': ('Guideless heat ring', 'Brushed steel', None, False),
 'hmd12': ('Glass heat chamber', 'Borosilicate glass, silicone seat', None, True),
 'hmd13': ('Egyptian wind cover, large', 'Hammered copper and steel', None, False),
 'hose00': ('Quasar hose and mouthpiece', 'Soft-touch hose, steel handle', None, False),
 'hose01': ('Slim steel mouthpiece', 'Brushed stainless', None, False),
 'hose04': ('Hand-stitched leather hose', 'Leather wrap, 180 cm', None, False),
 'hose05': ('Knurl handle', 'Silver, black or gold', None, False),
 'hose09': ('Flaca handle', 'Slim aluminium, three colours', None, False),
 'hose12': ('Soft-touch hose', 'Matte silicone, 150 cm', None, False),
 'hose13': ('Asli woven hose', 'Traditional woven wrap', None, False),
 'hose15': ('Amira hose', 'Silicone with colour handle', None, False),
 'hose18': ('Silicone hose, aluminium tip', '150 cm, washable', None, False),
 'hose19': ('Soft-touch hose, three pack', 'Black, blue, red', None, False),
 'hose21': ('Ice bazooka, mini', 'Freezable handle', None, False),
 'hose22': ('Ice bazooka, large', 'Freezable handle', None, False),
 'acc01': ('Hygienic mouthpiece', 'Brass and steel, personal tip', None, False),
 'acc02': ('Downstem with diffuser', 'Stainless, removable diffuser', None, False),
 'acc03': ('Port upgrade set', 'Four steel adapters', None, False),
 'acc06': ('Cooling diffuser', 'Carbon and steel', None, False),
 'acc13': ('Fork and poker', 'Twisted steel', None, False),
 'acc19': ('Chainmail base cleaner', 'Stainless mesh', None, False),
 'acc20': ('Jumbo mouth tips, 50', 'Individually wrapped', None, False),
 'acc21': ('Bowl cleaning kit', 'Two brushes', None, False),
 'acc24': ('Stem brush, large', 'Nylon bristle', None, False),
 'acc25': ('Steel wire brush', '23 cm', None, False),
 'acc26': ('Ball bearings, set of 3', 'For purge valves', None, False),
 'acc30': ('Bowl grommet', 'Silicone, universal', None, False),
}
CAT = {'hookah': 'hookahs', 'base': 'bases', 'bowl': 'bowls', 'hmd': 'heat', 'hose': 'hoses', 'acc': 'parts'}
RECAT = {'bowl26': 'heat', 'bowl30': 'heat'}
DEFKG = {'hookahs': 4.5, 'bases': 2.0, 'bowls': 0.35, 'heat': 0.4, 'hoses': 0.5, 'parts': 0.15}
HALO = {'hookah00': 649, 'hookah04': 599, 'hookah06': 579, 'hookah09': 529, 'hookah10': 499, 'hookah11': 469, 'hookah12': 469, 'hookah14': 449, 'hookah18': 429, 'hookah16': 489}
def cad(usd):
    v = usd * 1.4
    if v < 10: return max(2, round(v))
    step = 5 if v < 100 else 10
    return int(math.ceil(v / step) * step - 1)
out = []
seq = {}
for pid, (name, note, height, glass) in N.items():
    s = src[pid]; cat = RECAT.get(pid, CAT[s['cat']])
    kg = round(s['grams'] / 1000, 2) if s['grams'] else DEFKG[cat]
    if cat == 'hookahs': kg = min(max(kg, 1.2), 9.5)
    if cat == 'bases': kg = min(max(kg, 1.2), 3.6)
    if cat in ('bowls', 'heat'): kg = min(kg, 0.9)
    if cat in ('hoses', 'parts'): kg = min(kg, 0.9)
    price = HALO.get(pid) or cad(s['price'])
    if cat == 'hookahs': box = 'M' if (height or 60) <= 46 else 'T'
    elif cat == 'bases': box = 'M'
    elif cat in ('bowls', 'heat'): box = 'S'
    elif cat == 'hoses': box = 'S'
    else: box = 'XS'
    seq[cat] = seq.get(cat, 0) + 1
    code = {'hookahs': 1, 'bases': 2, 'bowls': 3, 'heat': 4, 'hoses': 5, 'parts': 6}[cat]
    out.append({'sku': f'OSS-{code}{seq[cat]:03d}', 'name': name, 'cat': cat, 'price': price, 'kg': kg, 'box': box, 'glass': glass,
                'height': height, 'note': note, 'img': pid, 'dark': pid in ('hookah11', 'hookah12', 'hookah14', 'hookah18'), 'lw': SZ[pid]['lw']})
# Crisp rule: a product whose placeholder photo cannot fill a 720px tile (or a 1000px dark photo) is left out.
# SKUs are assigned before this filter so they stay stable.
dropped = [o['name'] for o in out if (SZ[o['img']]['maxW'] < (1000 if o['dark'] else 625)) or SZ[o['img']].get('boxed')]
out = [o for o in out if o['name'] not in dropped]
print('dropped for soft photos:', dropped)
# Frames removed from the site (his instruction 2026-11-13).
js = '''// GENERATED by tools/build-catalog.py. Fake products for the mockup, modelled on real retailer price
// bands and shipping weights. Photos are placeholders. box = packed carton (cm), kg = item weight.
export const BOXES = {
  XS: { l: 23, w: 16, h: 8,  tare: 0.15, label: "Mailer" },
  S:  { l: 30, w: 23, h: 15, tare: 0.30, label: "Small box" },
  M:  { l: 46, w: 30, h: 30, tare: 0.70, label: "Medium box, double wall" },
  L:  { l: 66, w: 36, h: 36, tare: 1.10, label: "Large box, double wall" },
  T:  { l: 76, w: 30, h: 30, tare: 1.20, label: "Tall slim box, double wall" },
};
export const CATEGORIES = [
  { id: "hookahs", name: "Hookahs", ar: "\\u0623\\u0631\\u0627\\u062c\\u064a\\u0644", tone: "ruby" },
  { id: "bases", name: "Bases", ar: "\\u0642\\u0648\\u0627\\u0639\\u062f", tone: "teal" },
  { id: "bowls", name: "Bowls", ar: "\\u0631\\u0624\\u0648\\u0633", tone: "cobalt" },
  { id: "heat", name: "Heat", ar: "\\u062d\\u0631\\u0627\\u0631\\u0629", tone: "ember" },
  { id: "hoses", name: "Hoses", ar: "\\u062e\\u0631\\u0627\\u0637\\u064a\\u0645", tone: "emerald" },
  { id: "parts", name: "Parts & care", ar: "\\u0642\\u0637\\u0639", tone: "gilt" },
];
export const PRODUCTS = ''' + json.dumps(out, indent=1) + ';\n'
open('site/catalog.js', 'w', encoding='utf8', newline='\n').write(js)
import collections
print(len(out), dict(collections.Counter(p['cat'] for p in out)))
