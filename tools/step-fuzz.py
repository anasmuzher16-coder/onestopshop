# Bring tools/test-fuzz.mjs in line with the engine after step-rates-2 (three services, per-service
# divisor, Regular Parcel first-$100 coverage, weekly fuel constant, nothing priced over 30 kg).
import re
p = 'tools/test-fuzz.mjs'; s = open(p, encoding='utf8').read()
s = s.replace('import { parsePostal, pack, quote, billableKg, sheetPrice, RATE_CARD, MAX_KG, MAX_QTY } from "../site/rates.js";',
              'import { parsePostal, pack, quote, billableKg, sheetPrice, RATE_CARD, FUEL, MAX_KG, MAX_QTY } from "../site/rates.js";')
s = s.replace('''function oracleBillable(p) {
  const u = Math.max(Math.round(p.kg * 100) * DIV / 100, p.l * p.w * p.h);''', '''function oracleBillable(p, DIV = RATE_CARD.divisor) {
  const u = Math.max(Math.round(p.kg * 100) * DIV / 100, p.l * p.w * p.h);''')
s = s.replace('''  if (i >= 0) return C(s.zones[z][i]);
  return C(s.zones[z][KGS.length - 1]) + C(s.over30per05[z]) * Math.round((kg - 30) * 2);''', '''  return i >= 0 ? C(s.zones[z][i]) : null;''')
s = s.replace('''function oracleCoverC(p) {
  if (!p.glass || p.value <= 100) return 0;
  return Math.ceil((p.value - 100) / 100) * C(RATE_CARD.coveragePer100) + C(RATE_CARD.signature);''', '''function oracleCoverC(p, c) {
  if (!p.glass || p.value <= 100) return 0;
  return C(c.first100) + Math.ceil((p.value - 100) / 100) * C(RATE_CARD.coveragePer100) + C(RATE_CARD.signature);''')
s = s.replace('Math.round(freightC * RATE_CARD.fuelPct)', 'Math.round(freightC * FUEL.pct)')
# over-30 block: replaced by "nothing over 30 kg is priced"
i = s.index('// sheetPrice past 30 kg'); j = s.index('\n}', s.index('over-30 xp never cheaper than exp', i)) + 2
s = s[:i] + '''// nothing over 30 kg is priced: the counter quotes those by hand
for (const svc of ["exp", "xp"]) for (let z = 0; z < 6; z++) for (let k = 30.5; k <= 60; k += 0.5) t(`${svc} over 30 kg is not priced #z${z}k${k}`, sheetPrice(svc, z, k) === null);
''' + s[j:]
s = s.replace('''    const svc = RATE_CARD.carriers.find(c => c.id === o.id).sheet;''', '''    const car = RATE_CARD.carriers.find(c => c.id === o.id), svc = car.sheet;''')
s = s.replace('const p = parcels[i], kg = oracleBillable(p), pc = oraclePriceC(svc, z, kg);', 'const p = parcels[i], kg = oracleBillable(p, car.divisor), pc = oraclePriceC(svc, z, kg);')
s = s.replace('fC += pc; cC += oracleCoverC(p);', 'fC += pc; cC += oracleCoverC(p, car);')
s = s.replace('"fuel = freight x " + RATE_CARD.fuelPct + ", half-cent up "', '"fuel = freight x " + FUEL.pct + ", half-cent up "')
s = s.replace('.length === 2);', '.length === 3);')
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok', len(re.findall('over30per05', s)))
