# Independent re-derivation of site/cp-sheet.js from the Canada Post SfSB level 4 price guide PDF.
# Method differs from tools/build-rates.py on purpose: it reads PyMuPDF word coordinates and assigns
# every price to the rate-code column whose right edge it shares, instead of splitting pdftotext rows.
# Usage: python tools/verify-sheet.py <priceguide-level-4.pdf> [--dump out.json]
# Needs: pip install pymupdf. Exits 0 on an exact match, 1 on any mismatch or parse anomaly.
import json, re, sys
try:
    import pymupdf
except ImportError:
    import fitz as pymupdf

KGS = [0.5, 0.75] + [x / 2 for x in range(2, 61)]
CODE = re.compile(r'^[A-Z]\d\d$')
PRICE = re.compile(r'^\d+\.\d\d$')
problems = []


def page_service(page):
    head = ' '.join(w[4] for w in page.get_text('words') if w[1] < 45)
    if 'USA' in head or 'International' in head:
        return None
    for name, key in (('Xpresspost', 'xp'), ('Expedited Parcel', 'exp'), ('Regular Parcel', 'reg'), ('Priority', 'pri')):
        if head.startswith(name):
            return key
    return None


def read_page(page, pno):
    words = page.get_text('words')
    heads = [w for w in words if CODE.match(w[4]) and w[1] < 90]
    if not heads:
        problems.append(f'p{pno}: no rate-code header'); return {}, {}
    cols = [(w[4], w[2]) for w in sorted(heads, key=lambda w: w[0])]   # (code, right edge)
    head_y = max(w[3] for w in heads)
    rows = {}
    for w in words:
        if w[1] <= head_y: continue
        rows.setdefault(round(w[1] * 2) / 2, []).append(w)
    over_y = next((y for y, ws in rows.items() if any(w[4] == 'OVER' for w in ws) and any(w[4] == 'ADD' for w in ws)), None)
    table, over = {c: {} for c, _ in cols}, {}

    def assign(ws, where):
        out = {}
        for w in ws:
            if not PRICE.match(w[4]):
                problems.append(f'p{pno} {where}: non-price token {w[4]!r} at x={w[0]:.1f}'); continue
            hit = [c for c, x1 in cols if abs(w[2] - x1) < 4.5]
            if len(hit) != 1:
                problems.append(f'p{pno} {where}: value {w[4]} at x1={w[2]:.1f} matches {len(hit)} columns'); continue
            if hit[0] in out:
                problems.append(f'p{pno} {where}: two values in column {hit[0]}'); continue
            out[hit[0]] = float(w[4])
        if len(out) != len(cols):
            problems.append(f'p{pno} {where}: {len(out)} values for {len(cols)} codes')
        return out

    for y in sorted(rows):
        ws = sorted(rows[y], key=lambda w: w[0])
        if over_y is not None and y > over_y:
            vals = [w for w in ws if PRICE.match(w[4]) and w[0] > 90]
            if vals and not over:
                over = assign(vals, 'over30')
            continue
        if not ws or ws[0][0] > 60: continue
        try:
            kg = float(ws[0][4])
        except ValueError:
            continue
        if kg not in KGS: continue
        if not (len(ws) > 1 and ws[1][0] < 90):
            problems.append(f'p{pno} kg {kg}: no lb column'); continue
        vals = assign([w for w in ws[2:] if w[0] > 90], f'kg {kg}')
        for c, v in vals.items():
            if kg in table[c]: problems.append(f'p{pno}: duplicate {c} {kg}')
            table[c][kg] = v
    for c in table:
        miss = [k for k in KGS if k not in table[c]]
        if miss: problems.append(f'p{pno} {c}: missing weights {miss[:5]}')
    if len(over) != len(cols): problems.append(f'p{pno}: over-30 row has {len(over)} of {len(cols)}')
    return table, over


def extract(pdf):
    doc = pymupdf.open(pdf)
    data = {}
    for i, page in enumerate(doc):
        svc = page_service(page)
        if not svc: continue
        t, o = read_page(page, i + 1)
        d = data.setdefault(svc, {'tables': {}, 'over': {}, 'page': {}})
        for c, v in t.items():
            if c in d['tables']: problems.append(f'{svc}: code {c} appears twice (p{d["page"][c]}, p{i + 1})')
            d['tables'][c] = v; d['page'][c] = i + 1
        d['over'].update(o)
    return data


def derive(svc, d):
    tables, over = d['tables'], d['over']
    full = sorted(c for c in tables if all(k in tables[c] for k in KGS))

    def pct(vals, p):
        v = sorted(vals); return v[min(len(v) - 1, int(len(v) * p))]
    ps = [0.0, 0.10, 0.30, 0.50, 0.90 if svc == 'exp' else 0.70, 1.0]
    return {'zones': [[round(pct([tables[c][k] for c in full], p), 2) for k in KGS] for p in ps],
            'over30per05': [round(pct([over[c] for c in full if c in over], p), 2) for p in ps],
            'min': [min(tables[c][k] for c in full) for k in KGS],
            'max': [max(tables[c][k] for c in full) for k in KGS]}, full


def load_sheet(path):
    src = open(path, encoding='utf8').read()
    kgs = json.loads(re.search(r'export const KGS = (\[.*?\]);', src).group(1))
    sheet = json.loads(re.search(r'export const SHEET = (\{.*\});', src).group(1))
    return kgs, sheet


def main():
    if len(sys.argv) < 2:
        print('usage: python tools/verify-sheet.py <priceguide-level-4.pdf> [--dump out.json]'); sys.exit(2)
    data = extract(sys.argv[1])
    kgs, sheet = load_sheet('site/cp-sheet.js')
    mism = 0
    if kgs != KGS: print('MISMATCH KGS row list'); mism += 1
    for svc in ('exp', 'xp'):
        der, full = derive(svc, data[svc])
        print(f'{svc}: {len(data[svc]["tables"])} codes read, {len(full)} complete, over-30 for {len(data[svc]["over"])}')
        for key in ('zones', 'over30per05', 'min', 'max'):
            a, b = der[key], sheet[svc][key]
            pairs = [((z, i), a[z][i], b[z][i]) for z in range(6) for i in range(len(KGS))] if key == 'zones' \
                else [((i,), a[i], b[i]) for i in range(len(a))]
            if len(a) != len(b): print(f'MISMATCH {svc} {key} length {len(a)} vs {len(b)}'); mism += 1
            for idx, pv, fv in pairs:
                if abs(pv - fv) > 1e-9:
                    mism += 1
                    where = f'zone {idx[0] + 1} kg {KGS[idx[1]]}' if key == 'zones' else (f'kg {KGS[idx[0]]}' if key in ('min', 'max') else f'zone {idx[0] + 1}')
                    print(f'MISMATCH {svc} {key} {where}: pdf-derived {pv} file {fv}')
    # Regular Parcel vs Expedited, every code, every row
    if 'reg' in data:
        r, e = data['reg'], data['exp']
        diff = [(c, k, r['tables'][c].get(k), e['tables'].get(c, {}).get(k)) for c in sorted(r['tables']) for k in KGS
                if r['tables'][c].get(k) != e['tables'].get(c, {}).get(k)]
        od = [c for c in r['over'] if r['over'][c] != e['over'].get(c)]
        print(f'regular vs expedited: {len(r["tables"])} codes, {len(diff)} differing cells, {len(od)} differing over-30')
        for x in diff[:20]: print('  REG!=EXP', x)
        if set(r['tables']) != set(e['tables']): print('  code sets differ')
    for p in problems: print('PARSE', p)
    if '--dump' in sys.argv:
        json.dump({s: {'tables': {c: {str(k): v for k, v in t.items()} for c, t in d['tables'].items()}, 'over': d['over'], 'page': d['page']}
                   for s, d in data.items()}, open(sys.argv[sys.argv.index('--dump') + 1], 'w'))
    cells = 2 * (6 * len(KGS) + 6 + 2 * len(KGS))
    if mism or problems:
        print(f'FAIL {mism} mismatches, {len(problems)} parse anomalies'); sys.exit(1)
    print(f'PASS {cells}/{cells} sheet values match the PDF'); sys.exit(0)


main()
