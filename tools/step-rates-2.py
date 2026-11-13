# Loop step (2026-11-13): fixes from the heavy calculator test.
# 1 fuel = Canada Post's published weekly rate (was the 25% floor)  2 packer rebalances spare billed weight
# 3 money maths in integer cents  5 Regular Parcel offered (6000 divisor)  6 refuse billed weight over 30 kg
def between(s, a, b, new):
    i = s.index(a); j = s.index(b, i); return s[:i] + new + s[j:]

p = 'site/rates.js'; s = open(p, encoding='utf8').read()
s = between(s, '  for (const bin of bins) {', '  return parcels;\n}\n\n// --- Rating', '''  // Rebalance: a box is billed on the larger of its weight and its size, so a light box has billed weight
  // to spare. Move items out of boxes billed on real weight into boxes with spare, heaviest items first.
  const boxFor = bin => BOXES[["XS", "S", "M", "L"].find(k => boxVol(BOXES[k]) * BOX_FILL >= bin.vol) || "L"];
  const dimKg = b => boxVol(b) / RATE_CARD.divisor;
  for (let pass = 0; pass < 3; pass++) for (const to of bins) for (const from of bins) {
    if (from === to) continue;
    const tb = boxFor(to), fb = boxFor(from);
    if (from.kg + fb.tare <= dimKg(fb)) continue; // donor is already billed on size, nothing to gain
    for (const it of [...from.list].sort((a, b) => b.kg - a.kg)) {
      const fits = to.vol + looseVol(it) <= boxVol(tb) * BOX_FILL && to.kg + it.kg + tb.tare <= dimKg(tb);
      if (!fits || from.list.length === 1) continue;
      from.list.splice(from.list.indexOf(it), 1); from.vol -= looseVol(it); from.kg -= it.kg; from.value -= it.price;
      to.list.push(it); to.vol += looseVol(it); to.kg += it.kg; to.value += it.price; to.glass ||= !!it.glass;
    }
  }
  for (const bin of bins) {
    const b = boxFor(bin), key = Object.keys(BOXES).find(k => BOXES[k] === b);
    parcels.push({ box: key, ...b, kg: round(bin.kg + b.tare, 2), value: bin.value, glass: bin.list.some(x => x.glass), fill: round(bin.vol / boxVol(b)), items: bin.list.map(x => x.sku) });
  }
''')
s = s.replace('if (!bin) bins.push(bin = { vol: 0, kg: 0, value: 0, glass: false, items: [] });', 'if (!bin) bins.push(bin = { vol: 0, kg: 0, value: 0, glass: false, list: [] });')
s = s.replace('bin.glass ||= !!p.glass; bin.items.push(p.sku);', 'bin.glass ||= !!p.glass; bin.list.push(p);')
s = between(s, '// --- Rating', 'export const days', '''// --- Rating -------------------------------------------------------------------------------
// FUEL: Canada Post's published domestic fuel surcharge, relief rate, for the week shown. It changes
// weekly (canadapost.ca/fuelsurcharge), which is why production must read it from the Rating API.
export const FUEL = { pct: 0.412, week: "Nov 9 to Nov 15, 2026", next: { pct: 0.399, from: "2026-11-16" } };
export const RATE_CARD = {
  divisor: 5000,        // cm3 per kg, Priority / Xpresspost / Expedited (Canada Post "How to cube an item")
  coveragePer100: 2.75, // "Additional Liability Coverage ... $2.75 per additional $100"
  signature: 2.00,      // mandatory with additional coverage (guide footnote 1)
  carriers: [
    // Regular Parcel: same price table as Expedited at this level, but cubed at 6000 and the first $100 of
    // coverage is not free ($2.75). Cheaper for bulky boxes, slower, no delivery guarantee.
    { id: "cp-reg", sheet: "exp", divisor: 6000, first100: 2.75, carrier: "Canada Post", service: "Regular Parcel", days: [2, 3, 5, 6, 8, 12] },
    { id: "cp-exp", sheet: "exp", divisor: 5000, first100: 0, carrier: "Canada Post", service: "Expedited Parcel", days: [1, 2, 3, 4, 6, 9] },
    { id: "cp-xp", sheet: "xp", divisor: 5000, first100: 0, carrier: "Canada Post", service: "Xpresspost", days: [1, 1, 2, 2, 3, 5] },
  ],
};
const cents = n => Math.round(n * 100);

// Billable weight = the larger of real and volumetric weight, rounded UP to the next row on the sheet
// (0.5, 0.75, 1.0, then every 0.5 kg to 30).
export function billableKg(parcel, divisor = RATE_CARD.divisor) {
  const w = Math.max(parcel.kg, (parcel.l * parcel.w * parcel.h) / divisor);
  return KGS.find(k => k >= w - 1e-9) ?? Math.ceil(w * 2 - 1e-9) / 2;
}
export function sheetPrice(sheet, zoneIndex, kg) {
  const i = KGS.indexOf(kg);
  return i >= 0 ? SHEET[sheet].zones[zoneIndex][i] : null; // nothing over 30 kg is priced
}

// Returns options sorted by price, each itemised, all money in whole cents internally.
// Returns [] if any parcel cannot ship (real or billed weight over 30 kg): the counter quotes those by hand.
export function quote(dest, parcels, fuelPct = FUEL.pct) {
  if (!dest || !parcels.length || parcels.some(p => p.kg > MAX_KG)) return [];
  const z = dest.zone - 1, out = [];
  for (const c of RATE_CARD.carriers) {
    let freight = 0, cover = 0, ok = true;
    const perParcel = parcels.map(p => {
      const kg = billableKg(p, c.divisor), f = sheetPrice(c.sheet, z, kg);
      if (f === null) { ok = false; return null; }
      freight += cents(f);
      if (p.glass && p.value > 100) cover += cents(c.first100) + Math.ceil((p.value - 100) / 100) * cents(RATE_CARD.coveragePer100) + cents(RATE_CARD.signature);
      return { box: p.box, actualKg: p.kg, billableKg: kg, freight: f };
    });
    if (!ok) continue;
    const fuel = Math.round(freight * fuelPct);
    out.push({ id: c.id, carrier: c.carrier, service: c.service, days: c.days[z], perParcel, freight: freight / 100, cover: cover / 100, fuel: fuel / 100, total: (freight + cover + fuel) / 100 });
  }
  return out.sort((a, b) => a.total - b.total || a.days - b.days);
}

''')
open(p, 'w', encoding='utf8', newline='\n').write(s)

p = 'tools/test-rates.mjs'; t = open(p, encoding='utf8').read()
t = t.replace('q.length === 2 && q.every', 'q.length === 3 && q.every').replace('quote(parsePostal("B3H4R2"), ps).length === 2', 'quote(parsePostal("B3H4R2"), ps).length === 3')
t = t.replace('quote(parsePostal("B3H4R2"), pack([{ product: hk, qty: 1 }]))[0].cover === Math.ceil((hk.price - 100) / 100) * 2.75 + 2', 'quote(parsePostal("B3H4R2"), pack([{ product: hk, qty: 1 }])).find(o => o.id === "cp-exp").cover === Math.ceil((hk.price - 100) / 100) * 2.75 + 2')
t = t.replace('quote(parsePostal(c), pack([{ product: hk, qty: 1 }]))[0];', 'quote(parsePostal(c), pack([{ product: hk, qty: 1 }])).find(o => o.id === "cp-exp");')
t = t.replace('v >= SHEET[svc].min[i] - 0.001', 'v !== null && v >= SHEET[svc].min[i] - 0.001')
open(p, 'w', encoding='utf8', newline='\n').write(t)

p = 'tools/e2e.mjs'; e = open(p, encoding='utf8').read()
e = e.replace('const parts = await p.locator(".why dd").allInnerTexts();', 'const parts = await p.locator(".why dd").allTextContents();')
e = e.replace('await p.locator(\'input[name="ship"]\').nth(1).check();', 'await p.locator(\'input[name="ship"]\').nth(2).check();')
open(p, 'w', encoding='utf8', newline='\n').write(e)

p = 'site/app.js'; a = open(p, encoding='utf8').read()
a = a.replace('import { parsePostal, pack, quote, money, days, MAX_QTY } from "./rates.js";', 'import { parsePostal, pack, quote, money, days, MAX_QTY, FUEL } from "./rates.js";')
a = a.replace('<div><dt>Carrier fuel charge</dt>', '<div><dt>Carrier fuel charge, ${(FUEL.pct * 100).toFixed(1)}% for ${FUEL.week}</dt>')
open(p, 'w', encoding='utf8', newline='\n').write(a)
print('ok')
