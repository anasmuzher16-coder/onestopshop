// Rate engine for the mockup. Production swaps the sheet lookup for a live Canada Post Rating API
// call (see docs/SHIPPING.md); packing and the interface stay the same.
// Every price comes from cp-sheet.js, generated from the Canada Post price guide by tools/build-rates.py.
import { BOXES } from "./catalog.js";
import { KGS, SHEET } from "./cp-sheet.js";

export const ORIGIN = { postal: "N9A", city: "Windsor", prov: "ON" };

const PROV_BY_LETTER = {
  A: "NL", B: "NS", C: "PE", E: "NB", G: "QC", H: "QC", J: "QC",
  K: "ON", L: "ON", M: "ON", N: "ON", P: "ON", R: "MB", S: "SK", T: "AB", V: "BC", X: "NT", Y: "YT",
};
const CITY_HINT = {
  N9: "Windsor", N8: "Windsor", M5: "Toronto", M4: "Toronto", M6: "Toronto", K1: "Ottawa", K2: "Ottawa",
  H2: "Montreal", H3: "Montreal", G1: "Quebec City", R3: "Winnipeg", S4: "Regina", S7: "Saskatoon",
  T2: "Calgary", T3: "Calgary", T5: "Edmonton", T6: "Edmonton", V5: "Vancouver", V6: "Vancouver",
  V8: "Victoria", B3: "Halifax", E1: "Moncton", A1: "St. John's", C1: "Charlottetown", X1: "Yellowknife",
  Y1: "Whitehorse", P3: "Sudbury", P7: "Thunder Bay", L8: "Hamilton", N6: "London", K7: "Kingston",
};
// zone 1 = same metro, 2 = southern Ontario, 3 = Ontario north / Quebec, 4 = Prairies / Maritimes,
// 5 = BC / NL, 6 = territories. Approximates Canada Post rate codes until the live API is wired.
function zoneFor(fsa) {
  const L = fsa[0], P = PROV_BY_LETTER[L];
  if (fsa.startsWith("N8") || fsa.startsWith("N9") || fsa.startsWith("N0R")) return 1;
  if (L === "N" || L === "L" || L === "M" || L === "K") return 2;
  if (L === "P" || P === "QC") return 3;
  if (["MB", "SK", "AB", "NB", "NS", "PE"].includes(P)) return 4;
  if (P === "BC" || P === "NL") return 5;
  return 6;
}

export function parsePostal(raw) {
  const s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Canadian postal code: A1A 1A1. D, F, I, O, Q, U never appear; W and Z never lead.
  if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z](\d[ABCEGHJ-NPRSTV-Z]\d)?$/.test(s)) return null;
  const fsa = s.slice(0, 3);
  return {
    fsa, full: s.length === 6 ? `${fsa} ${s.slice(3)}` : fsa, complete: s.length === 6,
    prov: /^X0[ABC]/.test(fsa) ? "NU" : PROV_BY_LETTER[s[0]], city: CITY_HINT[s.slice(0, 2)] || null,
    rural: s[1] === "0", zone: zoneFor(fsa),
  };
}

// --- Packing: what actually goes on the truck -------------------------------------------
// Hookahs and glass ship in their own carton. Loose items are consolidated: they ride in a
// hookah carton if they fit its spare space, otherwise they fill as many boxes as needed.
// No parcel may exceed 30 kg real weight (Canada Post maximum, price guide "weight over 30 kg").
export const MAX_KG = 30, MAX_QTY = 99;
const LOOSE_FILL = 0.35, BOX_FILL = 0.7, RIDE_SHARE = 0.15;
const boxVol = b => b.l * b.w * b.h;
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const looseVol = p => boxVol(BOXES[p.box]) * LOOSE_FILL;

export function pack(lines) {
  const parcels = [], loose = [];
  for (const { product, qty } of lines) {
    const n = Math.min(MAX_QTY, Math.max(0, Math.floor(Number(qty) || 0)));
    for (let i = 0; i < n; i++) {
      if (["M", "L", "T", "XL"].includes(product.box) || product.glass && product.box !== "XS") {
        const b = BOXES[product.box];
        parcels.push({ box: product.box, ...b, kg: round(product.kg + b.tare, 2), value: product.price, glass: !!product.glass, fill: null, items: [product.sku] });
      } else loose.push(product);
    }
  }
  if (!loose.length) return parcels;
  const vol = loose.reduce((v, p) => v + looseVol(p), 0), kg = loose.reduce((k, p) => k + p.kg, 0);
  const host = parcels.filter(p => p.box !== "XS" && p.box !== "S").sort((a, b) => boxVol(b) - boxVol(a))[0];
  if (host && vol <= boxVol(host) * RIDE_SHARE && host.kg + kg <= MAX_KG) {
    host.kg = round(host.kg + kg, 2); host.value += loose.reduce((v, p) => v + p.price, 0); host.items.push(...loose.map(p => p.sku));
    return parcels;
  }
  // First-fit into L-sized bins by volume and weight, then shrink each bin to the smallest box that holds it.
  const cap = boxVol(BOXES.L) * BOX_FILL, bins = [];
  for (const p of [...loose].sort((a, b) => looseVol(b) - looseVol(a))) {
    let bin = bins.find(b => b.vol + looseVol(p) <= cap && b.kg + p.kg + BOXES.L.tare <= MAX_KG);
    if (!bin) bins.push(bin = { vol: 0, kg: 0, value: 0, glass: false, items: [] });
    bin.vol += looseVol(p); bin.kg += p.kg; bin.value += p.price; bin.glass ||= !!p.glass; bin.items.push(p.sku);
  }
  for (const bin of bins) {
    const key = ["XS", "S", "M", "L"].find(k => boxVol(BOXES[k]) * BOX_FILL >= bin.vol) || "L";
    const b = BOXES[key];
    parcels.push({ box: key, ...b, kg: round(bin.kg + b.tare, 2), value: bin.value, glass: bin.glass, fill: round(bin.vol / boxVol(b)), items: bin.items });
  }
  return parcels;
}

// --- Rating -------------------------------------------------------------------------------
export const RATE_CARD = {
  divisor: 5000,        // cm3 per kg volumetric equivalent (Canada Post exact VE rule: to confirm)
  fuelPct: 0.25,        // floor after the 15% relief discount, CP news release 2026-10-05
  coveragePer100: 2.75, // "Additional Liability Coverage ... $2.75 per additional $100" (first $100 included)
  signature: 2.00,      // mandatory with additional coverage (guide footnote 1)
  carriers: [
    { id: "cp-exp", sheet: "exp", carrier: "Canada Post", service: "Expedited Parcel", days: [1, 2, 3, 4, 6, 9] },
    { id: "cp-xp", sheet: "xp", carrier: "Canada Post", service: "Xpresspost", days: [1, 1, 2, 2, 3, 5] },
  ],
};

// Billable weight = the larger of real and volumetric weight, rounded UP to the next row on the sheet
// (0.5, 0.75, 1.0, then every 0.5 kg). Past 30 kg (volumetric only) it continues in 0.5 kg steps.
export function billableKg(parcel, divisor = RATE_CARD.divisor) {
  const w = Math.max(parcel.kg, (parcel.l * parcel.w * parcel.h) / divisor);
  return KGS.find(k => k >= w - 1e-9) ?? Math.ceil(w * 2 - 1e-9) / 2;
}
export function sheetPrice(sheet, zoneIndex, kg) {
  const t = SHEET[sheet], i = KGS.indexOf(kg);
  if (i >= 0) return t.zones[zoneIndex][i];
  return round(t.zones[zoneIndex][KGS.length - 1] + t.over30per05[zoneIndex] * Math.round((kg - 30) * 2));
}

// Returns options sorted by price, each itemised. Returns [] if any parcel cannot ship (over 30 kg).
export function quote(dest, parcels) {
  if (!dest || !parcels.length || parcels.some(p => p.kg > MAX_KG)) return [];
  const z = dest.zone - 1;
  return RATE_CARD.carriers.map(c => {
    let freight = 0, cover = 0;
    const perParcel = parcels.map(p => {
      const kg = billableKg(p), f = sheetPrice(c.sheet, z, kg);
      freight += f;
      if (p.glass && p.value > 100) cover += Math.ceil((p.value - 100) / 100) * RATE_CARD.coveragePer100 + RATE_CARD.signature;
      return { box: p.box, actualKg: p.kg, billableKg: kg, freight: f };
    });
    freight = round(freight); cover = round(cover);
    const fuel = round(freight * RATE_CARD.fuelPct);
    return { id: c.id, carrier: c.carrier, service: c.service, days: c.days[z], perParcel, freight, cover, fuel, total: round(freight + cover + fuel) };
  }).sort((a, b) => a.total - b.total);
}

export const days = n => n + (n === 1 ? " day" : " days");
export const money = n => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
