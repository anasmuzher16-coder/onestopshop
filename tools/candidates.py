# Picks candidate products from the downloaded retailer feeds and downloads 360px thumbs for review.
import json, glob, re, os, random, urllib.request, concurrent.futures as cf
random.seed(7)
CAT = {'hookah': r'^(hookah|hookahs|hookah pipe)$', 'bowl': r'bowl', 'base': r'^(base|bases|hookah bases)$',
       'hose': r'hose', 'hmd': r'hmd|heat management', 'acc': r'tong|mouth tip|brush|grommet|accessor|part|supplies|burner'}
BAN = re.compile(r'tobacco|shisha flav|charcoal|coal|vape|nicotine|disposable|bundle|gift card|sample|\d+\s?g\b|flavor', re.I)
out = {k: [] for k in CAT}
for f in glob.glob('feeds/*.json'):
    try: prods = json.load(open(f, encoding='utf8'))['products']
    except Exception: continue
    site = os.path.basename(f).rsplit('-', 1)[0]
    for p in prods:
        t = (p.get('product_type') or '').strip().lower()
        if not p.get('images') or BAN.search(p['title']) or BAN.search(t): continue
        if t in ('charcoal burner',): continue
        for k, rx in CAT.items():
            if re.search(rx, t):
                v = p['variants'][0]
                out[k].append({'site': site, 'title': p['title'], 'type': t, 'price': float(v['price']), 'grams': v.get('grams') or 0,
                               'img': p['images'][0]['src'], 'imgs': [i['src'] for i in p['images'][:4]], 'vendor': p.get('vendor', ''),
                               'w': p['images'][0].get('width'), 'h': p['images'][0].get('height')})
                break
LIM = {'hookah': 96, 'bowl': 32, 'base': 24, 'hose': 24, 'hmd': 16, 'acc': 32}
cands = []
for k, v in out.items():
    random.shuffle(v); v = sorted(v[:LIM[k]], key=lambda x: -x['price'])
    for i, x in enumerate(v): x['id'] = f'{k}{i:02d}'; x['cat'] = k; cands.append(x)
    print(k, len(out[k]), '->', len(v))
os.makedirs('cand', exist_ok=True)
def get(x):
    u = x['img'] + ('&' if '?' in x['img'] else '?') + 'width=360'
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        open(f"cand/{x['id']}.jpg", 'wb').write(urllib.request.urlopen(req, timeout=30).read())
    except Exception as e: print('fail', x['id'], e)
with cf.ThreadPoolExecutor(12) as ex: list(ex.map(get, cands))
json.dump(cands, open('cand/cands.json', 'w', encoding='utf8'), indent=0)
