// Seeded property and fuzz tests for site/rates.js. No dependencies.
// Run: node tools/test-fuzz.mjs [seed] [cases]   (defaults: seed 20261113, 200000 random carts)
// Every price is re-derived here with integer-cent arithmetic from site/cp-sheet.js and compared with
// what the engine returns. Prints PASS n/n, or FAIL with the first failing cases; exits 1 on failure.
import { parsePostal, pack, quote, billableKg, sheetPrice, RATE_CARD, FUEL, MAX_KG, MAX_QTY } from "../site/rates.js";
import { KGS, SHEET } from "../site/cp-sheet.js";
import { PRODUCTS, BOXES } from "../site/catalog.js";

const SEED = Number(process.argv[2] ?? 20261113) >>> 0, CASES = Number(process.argv[3] ?? 200000);
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = mulberry32(SEED), ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = a => a[Math.floor(rnd() * a.length)];

let n = 0, f = 0;
const fails = {};
function t(name, ok, detail) {
  n++;
  if (ok) return;
  f++;
  const k = name.replace(/\s*#.*$/, "");
  fails[k] = (fails[k] || 0) + 1;
  if (fails[k] <= 3) console.log("FAIL", name, detail === undefined ? "" : typeof detail === "string" ? detail : JSON.stringify(detail));
}
const C = x => Math.round(x * 100);                    // dollars -> integer cents
const DIV = RATE_CARD.divisor;

// ---- independent oracle -------------------------------------------------------------------
// billable row in units of 1/DIV kg: compare max(kg, l*w*h/DIV) against 0.5, 0.75, then 0.5 steps.
function oracleBillable(p, DIV = RATE_CARD.divisor) {
  const u = Math.max(Math.round(p.kg * 100) * DIV / 100, p.l * p.w * p.h);   // kg * DIV, exact for integer cm and 0.01 kg
  if (u <= 0.5 * DIV) return 0.5;
  if (u <= 0.75 * DIV) return 0.75;
  return Math.ceil(u / (0.5 * DIV)) * 0.5;
}
function oraclePriceC(svc, z, kg) {
  const s = SHEET[svc], i = KGS.indexOf(kg);
  return i >= 0 ? C(s.zones[z][i]) : null;
}
function oracleCoverC(p, c) {
  if (!p.glass || p.value <= 100) return 0;
  return C(c.first100) + Math.ceil((p.value - 100) / 100) * C(RATE_CARD.coveragePer100) + C(RATE_CARD.signature);
}
const fuelC = freightC => Math.round(freightC * FUEL.pct);  // half-cent rounds up, on integer cents

// ---- 1. sheet structure -------------------------------------------------------------------
t("KGS rows are 0.5, 0.75, 1..30 by 0.5", JSON.stringify(KGS) === JSON.stringify([0.5, 0.75, ...Array.from({ length: 59 }, (_, i) => (i + 2) / 2)]));
for (const svc of ["exp", "xp"]) {
  const s = SHEET[svc];
  t(svc + " shape", s.zones.length === 6 && s.zones.every(r => r.length === 61) && s.over30per05.length === 6 && s.min.length === 61 && s.max.length === 61);
  for (let z = 0; z < 6; z++) for (let i = 0; i < 61; i++) {
    const v = s.zones[z][i];
    t(`${svc} cell finite positive 2dp #z${z}i${i}`, Number.isFinite(v) && v > 0 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, v);
    t(`${svc} cell within min..max #z${z}i${i}`, v >= s.min[i] - 1e-9 && v <= s.max[i] + 1e-9, { v, min: s.min[i], max: s.max[i] });
    if (i) t(`${svc} heavier never cheaper #z${z}i${i}`, v >= s.zones[z][i - 1], { z, kg: KGS[i], v, prev: s.zones[z][i - 1] });
    if (z) t(`${svc} farther zone never cheaper #z${z}i${i}`, v >= s.zones[z - 1][i], { z, kg: KGS[i], v, prev: s.zones[z - 1][i] });
    if (svc === "xp") t(`xp never cheaper than exp #z${z}i${i}`, v >= SHEET.exp.zones[z][i], { zone: z + 1, kg: KGS[i], xp: v, exp: SHEET.exp.zones[z][i] });
  }
  t(svc + " min <= max per row", s.min.every((m, i) => m <= s.max[i]));
  t(svc + " zone 1 = min and zone 6 = max", s.zones[0].every((v, i) => v === s.min[i]) && s.zones[5].every((v, i) => v === s.max[i]));
  for (let z = 0; z < 6; z++) {
    t(`${svc} over30 positive #z${z}`, s.over30per05[z] > 0);
    if (z) t(`${svc} over30 farther never cheaper #z${z}`, s.over30per05[z] >= s.over30per05[z - 1]);
  }
}
// nothing over 30 kg is priced: the counter quotes those by hand
for (const svc of ["exp", "xp"]) for (let z = 0; z < 6; z++) for (let k = 30.5; k <= 60; k += 0.5) t(`${svc} over 30 kg is not priced #z${z}k${k}`, sheetPrice(svc, z, k) === null);


// ---- 2. postal codes ----------------------------------------------------------------------
const LETTER = { A: "NL", B: "NS", C: "PE", E: "NB", G: "QC", H: "QC", J: "QC", K: "ON", L: "ON", M: "ON", N: "ON", P: "ON", R: "MB", S: "SK", T: "AB", V: "BC", X: "NT", Y: "YT" };
for (const L of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  const r = parsePostal(L + "1A 1A1");
  if (LETTER[L]) t("first letter " + L + " -> " + LETTER[L], r?.prov === LETTER[L] && r.zone >= 1 && r.zone <= 6, r);
  else t("first letter " + L + " rejected", r === null, r);
}
// Real postal codes (public buildings, city halls, universities, post offices), one or more per province/territory.
const REAL = [
  ["A1C 5M2", "NL"], ["A1B 3X9", "NL"], ["A2H 6E6", "NL"], ["A0P 1E0", "NL"], ["A1A 5B2", "NL"],
  ["B3H 4R2", "NS"], ["B3J 3K5", "NS"], ["B1P 6L2", "NS"], ["B4P 2R6", "NS"], ["B2N 5E3", "NS"],
  ["C1A 4P3", "PE"], ["C1A 7N8", "PE"], ["C1N 4J9", "PE"], ["C0A 1H0", "PE"],
  ["E1C 4M3", "NB"], ["E3B 1B1", "NB"], ["E2L 4L1", "NB"], ["E3B 5A3", "NB"], ["E1A 3E9", "NB"],
  ["H2X 1Y4", "QC"], ["H3B 4W8", "QC"], ["G1R 4P5", "QC"], ["J8X 3X7", "QC"], ["G1V 0A6", "QC"], ["H3A 0G4", "QC"], ["J4K 2T7", "QC"],
  ["M5V 2T6", "ON"], ["K1A 0A6", "ON"], ["N9A 1A1", "ON"], ["L8P 4R5", "ON"], ["P3E 2C6", "ON"], ["N6A 3K7", "ON"], ["K7L 3N6", "ON"], ["P7B 6C3", "ON"], ["M5S 1A1", "ON"], ["N0R 1A0", "ON"],
  ["R3C 4T3", "MB"], ["R3B 0X3", "MB"], ["R7A 0B7", "MB"], ["R3T 2N2", "MB"],
  ["S4P 3V7", "SK"], ["S7K 0J5", "SK"], ["S7N 5A2", "SK"], ["S6H 3J9", "SK"],
  ["T2P 2M5", "AB"], ["T5J 2R7", "AB"], ["T6G 2R3", "AB"], ["T1J 0P3", "AB"], ["T4N 3T4", "AB"],
  ["V6B 1A1", "BC"], ["V8W 1P6", "BC"], ["V6T 1Z4", "BC"], ["V2C 1A1", "BC"], ["V1Y 1J4", "BC"], ["V5K 0A1", "BC"],
  ["X1A 2L9", "NT"], ["X0E 0T0", "NT"], ["X0E 0R9", "NT"], ["X0G 0A0", "NT"],
  ["X0A 0H0", "NU"], ["X0A 1H0", "NU"], ["X0B 0C0", "NU"], ["X0C 0G0", "NU"],
  ["Y1A 1B1", "YT"], ["Y1A 6E5", "YT"], ["Y0B 1G0", "YT"],
];
t("at least 60 real codes, all 13 provinces and territories", REAL.length >= 60 && new Set(REAL.map(r => r[1])).size === 13);
for (const [code, prov] of REAL) {
  for (const form of [code, code.replace(" ", ""), code.toLowerCase(), "  " + code.replace(" ", "-") + " "]) {
    const r = parsePostal(form);
    t("real " + JSON.stringify(form) + " -> " + prov, r?.prov === prov && r.full === code && r.complete === true && r.zone >= 1 && r.zone <= 6, r);
  }
  t("FSA " + code.slice(0, 3) + " -> " + prov, parsePostal(code.slice(0, 3))?.prov === prov);
}
t("territories are zone 6", REAL.filter(r => ["NT", "NU", "YT"].includes(r[1])).every(r => parsePostal(r[0]).zone === 6));
// malformed input never throws and never yields a bogus province
const MAL = [undefined, null, "", " ", 0, 1, NaN, Infinity, -1, true, false, {}, [], [1, 2], () => 1, Symbol("x"), "48226", "48226-1234",
  "K1A0B1X", "K1A 0B", "K1", "1A1 A1A", "KKA 0B1", "K1A 0BB", "D1A 1A1", "W1A 1A1", "Z1A 1A1", "K1O 1A1", "K1A 0U1", "\u0000K1A0B1",
  "Ｋ１Ａ０Ｂ１", "K1A 0B1", "k1a0b1k1a0b1", "x".repeat(100000), "SW1A 1AA", "K1A 0B1; DROP TABLE", "<script>"];
for (const m of MAL) {
  let r, threw = null;
  try { r = parsePostal(m); } catch (e) { threw = String(e); }
  t("malformed " + String(typeof m === "symbol" ? "Symbol" : m).slice(0, 30) + " does not throw", threw === null, threw);
  t("malformed " + String(typeof m === "symbol" ? "Symbol" : m).slice(0, 30) + " is null or a valid code", r === null || (r && /^[A-Z]\d[A-Z]( \d[A-Z]\d)?$/.test(r.full)), r);
}
for (let i = 0; i < 20000; i++) {                      // random strings
  const len = ri(0, 10), chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcxyz0123456789 -_.#é";
  const s = Array.from({ length: len }, () => pick(chars)).join("");
  let r, threw = null;
  try { r = parsePostal(s); } catch (e) { threw = String(e); }
  const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const want = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z](\d[ABCEGHJ-NPRSTV-Z]\d)?$/.test(clean);
  t("random postal #" + i, threw === null && (r === null) === !want && (!r || (r.prov === (/^X0[ABC]/.test(clean) ? "NU" : LETTER[clean[0]]) && r.zone >= 1 && r.zone <= 6)), { s, r, threw });
}

// ---- 3. billable weight and per-parcel price, synthetic parcels ----------------------------
for (let i = 0; i < 50000; i++) {
  const p = { l: ri(1, 120), w: ri(1, 80), h: ri(1, 80), kg: ri(1, 3000) / 100 };
  const b = billableKg(p), want = oracleBillable(p);
  t("billable = oracle #" + i, b === want, { p, got: b, want });
  t("billable >= actual #" + i, b >= p.kg);
  t("billable is a sheet row or 0.5 step past 30 #" + i, KGS.includes(b) || (b > 30 && Number.isInteger(b * 2)), { p, b });
}

// ---- 4. carts: pack + quote against the oracle ---------------------------------------------
const PACKED = p => ["M", "L", "T", "XL"].includes(p.box) || (p.glass && p.box !== "XS");
const boxVol = b => b.l * b.w * b.h;
function randomCart() {
  const lines = [], used = new Set(), nl = ri(1, rnd() < 0.8 ? 4 : 10);
  for (let i = 0; i < nl; i++) {
    const p = pick(PRODUCTS);
    if (used.has(p.sku)) continue;
    used.add(p.sku);
    const r = rnd(), qty = r < 0.7 ? ri(1, 3) : r < 0.95 ? ri(1, 15) : ri(1, MAX_QTY);
    lines.push({ product: p, qty });
  }
  return lines;
}
const counts = lines => { const m = {}; for (const { product, qty } of lines) m[product.sku] = (m[product.sku] || 0) + Math.min(MAX_QTY, Math.max(0, Math.floor(Number(qty) || 0))); return m; };
const bySku = Object.fromEntries(PRODUCTS.map(p => [p.sku, p]));
const DESTS = REAL.map(r => parsePostal(r[0]));
const cheapest = q => (q.length ? q[0].total : Infinity);

function checkCart(lines, dest, tag) {
  let parcels, q, threw = null;
  try { parcels = pack(lines); q = quote(dest, parcels); } catch (e) { threw = e.stack; }
  t("no throw " + tag, threw === null, threw);
  if (threw) return null;
  // conservation: every unit packed exactly once
  const want = counts(lines), got = {};
  for (const p of parcels) for (const s of p.items) got[s] = (got[s] || 0) + 1;
  const keys = new Set([...Object.keys(want).filter(k => want[k]), ...Object.keys(got)]);
  t("pack conserves items " + tag, [...keys].every(k => want[k] === got[k]), { want, got });
  for (const [pi, p] of parcels.entries()) {
    const b = BOXES[p.box];
    t("parcel box exists " + tag, !!b && p.l === b.l && p.w === b.w && p.h === b.h, p.box);
    const itemKg = p.items.reduce((s, k) => s + Math.round(bySku[k].kg * 100), 0);
    t("parcel kg = items + tare " + tag, Math.round(p.kg * 100) === itemKg + Math.round(b.tare * 100), { box: p.box, kg: p.kg, itemKg: itemKg / 100, tare: b.tare });
    t("parcel value = item prices " + tag, p.value === p.items.reduce((s, k) => s + bySku[k].price, 0));
    t("parcel glass flag covers every glass item " + tag, !p.items.some(k => bySku[k].glass) || p.glass, { pi, box: p.box, items: p.items });
    t("parcel <= 30 kg " + tag, p.kg <= MAX_KG, { box: p.box, kg: p.kg });
    const own = p.items.filter(k => PACKED(bySku[k]));
    t("own-carton product never shares its slot with another own-carton product " + tag, own.length <= 1, p.items);
    const looseVol = p.items.filter(k => !PACKED(bySku[k])).reduce((s, k) => s + boxVol(BOXES[bySku[k].box]) * 0.35, 0);
    if (own.length === 0) t("consolidated box filled <= 70% " + tag, looseVol <= boxVol(b) * 0.7 + 1e-6 && p.fill != null && p.fill <= 0.7 + 1e-9, { box: p.box, fill: looseVol / boxVol(b) });
    else t("ride-along uses <= 15% of host " + tag, looseVol <= boxVol(b) * 0.15 + 1e-6, { box: p.box, fill: looseVol / boxVol(b) });
  }
  // quote: [] exactly when it should
  const shouldQuote = !!dest && parcels.length > 0 && parcels.every(p => p.kg <= MAX_KG);
  t("quote [] iff unshippable " + tag, (q.length > 0) === shouldQuote, { n: parcels.length, q: q.length });
  if (!q.length) return { parcels, q };
  t("quote sorted cheapest first " + tag, q.every((o, i) => !i || o.total >= q[i - 1].total));
  const z = dest.zone - 1;
  for (const o of q) {
    const car = RATE_CARD.carriers.find(c => c.id === o.id), svc = car.sheet;
    for (const v of [o.total, o.freight, o.cover, o.fuel]) t("finite non-negative " + tag, Number.isFinite(v) && v >= 0, o);
    t("money values are whole cents " + tag, [o.total, o.freight, o.cover, o.fuel].every(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6), o);
    let fC = 0, cC = 0;
    o.perParcel.forEach((pp, i) => {
      const p = parcels[i], kg = oracleBillable(p, car.divisor), pc = oraclePriceC(svc, z, kg);
      t("per-parcel billable = oracle " + tag, pp.billableKg === kg, { box: p.box, kg: p.kg, got: pp.billableKg, want: kg });
      t("per-parcel freight = sheet " + tag, C(pp.freight) === pc, { svc, zone: z + 1, kg, got: pp.freight, want: pc / 100 });
      fC += pc; cC += oracleCoverC(p, car);
    });
    t("freight = sum of parcels " + tag, C(o.freight) === fC, { got: o.freight, want: fC / 100 });
    t("cover = coverage + signature per glass parcel over $100 " + tag, C(o.cover) === cC, { got: o.cover, want: cC / 100 });
    t("fuel = freight x " + FUEL.pct + ", half-cent up " + tag, C(o.fuel) === fuelC(fC), { freight: fC / 100, got: o.fuel, want: fuelC(fC) / 100 });
    t("total = freight + cover + fuel to the cent " + tag, C(o.total) === C(o.freight) + C(o.cover) + C(o.fuel), o);
  }
  t("xp never cheaper than exp " + tag, q.find(o => o.id === "cp-xp").total >= q.find(o => o.id === "cp-exp").total);
  return { parcels, q };
}

const drops = { n: 0, max: 0, at: null };
for (let i = 0; i < CASES; i++) {
  const lines = randomCart(), dest = pick(DESTS), tag = "#" + i;
  const r = checkCart(lines, dest, tag);
  if (!r || !r.q.length) continue;
  if (i % 4 === 0) {                                  // farther zone never cheaper, same parcels
    let prev = null;
    for (let zz = 1; zz <= 6; zz++) {
      const q = quote({ ...dest, zone: zz }, r.parcels), byId = Object.fromEntries(q.map(o => [o.id, o.total]));
      if (prev) for (const id in byId) t("farther zone never cheaper " + tag, byId[id] >= prev[id], { zone: zz, id, now: byId[id], before: prev[id] });
      prev = byId;
    }
  }
  if (i % 2 === 0) {                                  // one more unit never lowers the cheapest total
    const add = pick(PRODUCTS), more = lines.map(l => ({ ...l }));
    const hit = more.find(l => l.product.sku === add.sku);
    if (hit) { if (hit.qty < MAX_QTY) hit.qty++; else continue; } else more.push({ product: add, qty: 1 });
    const q2 = quote(dest, pack(more));
    if (q2.length) {
      const drop = Math.round((cheapest(r.q) - cheapest(q2)) * 100) / 100;
      if (drop > 0) { drops.n++; if (drop > drops.max) { drops.max = drop; drops.at = { dest: dest.full, cart: lines.map(l => l.product.sku + "x" + l.qty), add: add.sku, before: cheapest(r.q), after: cheapest(q2) }; } }
      t("adding an item never lowers the total by more than $2 or 1% " + tag, drop <= Math.max(2, cheapest(r.q) * 0.01),
        { dest: dest.full, cart: lines.map(l => l.product.sku + "x" + l.qty), add: add.sku, before: cheapest(r.q), after: cheapest(q2) });
    }
  }
}

// ---- 5. malformed pack / quote input ---------------------------------------------------------
const any = PRODUCTS[0];
for (const qty of [NaN, Infinity, -Infinity, -1, 0, 0.4, 2.9, "3", "x", null, undefined, {}, [], 1e300, -0]) {
  let ps, threw = null;
  try { ps = pack([{ product: any, qty }]); quote(DESTS[0], ps); } catch (e) { threw = String(e); }
  const want = Math.min(MAX_QTY, Math.max(0, Math.floor(Number(qty) || 0)));
  t("pack qty " + String(qty) + " no throw, " + want + " units", threw === null && ps.flatMap(p => p.items).length === want, threw || ps.length);
}
for (const dest of [null, undefined, false, 0, ""]) t("quote with no destination -> []", quote(dest, pack([{ product: any, qty: 1 }])).length === 0);
t("pack([]) -> []", pack([]).length === 0);
t("quote(dest, []) -> []", quote(DESTS[0], []).length === 0);
t("31 kg parcel -> []", quote(DESTS[0], [{ box: "S", ...BOXES.S, kg: 31, value: 0, glass: false, items: [] }]).length === 0);
t("30.00 kg parcel quotes", quote(DESTS[0], [{ box: "S", ...BOXES.S, kg: 30, value: 0, glass: false, items: [] }]).length === 3);

const top = Object.entries(fails).sort((a, b) => b[1] - a[1]);
if (top.length) { console.log("failures by check:"); for (const [k, c] of top) console.log("  " + c + "  " + k); }
console.log(`seed ${SEED}, ${CASES} random carts`);
console.log("add-an-item price drops (repacking): " + drops.n + " carts, worst $" + drops.max.toFixed(2) + (drops.at ? " " + JSON.stringify(drops.at) : ""));
console.log(f ? `FAIL ${f}/${n}` : `PASS ${n}/${n}`);
process.exit(f ? 1 : 0);
