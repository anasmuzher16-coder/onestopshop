# Downloads the chosen candidates at full size and writes assets-src/picked.json (id, source title, price, grams).
import json, os, urllib.request, concurrent.futures as cf
P = {'hookah': '00 04 06 09 10 16 22 25 28 34 36 37 40 41 45 46 50 51 52 54 57 64 65 67 71 76 77 78 84 88 89 90 91 92 93 11 12 14 18',
     'base': '00 01 02 03 04 06 07 12 13 15 18 21', 'bowl': '01 03 05 06 09 10 12 16 19 20 22 23 29 26 30',
     'hmd': '05 06 07 09 10 12 13', 'hose': '00 01 04 05 09 12 13 15 18 19 21 22', 'acc': '01 02 03 06 13 19 20 21 24 25 26 30'}
want = {k + n for k, v in P.items() for n in v.split()}
c = [x for x in json.load(open('assets-src/cand/cands.json', encoding='utf8')) if x['id'] in want]
os.makedirs('assets-src/picked', exist_ok=True)
def get(x):
    for n, src in enumerate(x['imgs'][:2]):
        u = src + ('&' if '?' in src else '?') + 'width=1200'
        try:
            req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
            open(f"assets-src/picked/{x['id']}-{n}.img", 'wb').write(urllib.request.urlopen(req, timeout=40).read())
        except Exception as e: print('fail', x['id'], n, e)
with cf.ThreadPoolExecutor(10) as ex: list(ex.map(get, c))
json.dump([{k: x[k] for k in ('id', 'cat', 'title', 'price', 'grams', 'site', 'vendor')} for x in c], open('assets-src/picked.json', 'w', encoding='utf8'), indent=1)
print(len(c), 'of', len(want))
