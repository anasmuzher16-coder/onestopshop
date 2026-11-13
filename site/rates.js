// Rate engine for the mockup. The production version swaps `tableQuote` for a live carrier
// rate API call (see docs/SHIPPING.md); the packing step and the interface stay the same.
// Every number in RATE_CARD is sourced in docs/SHIPPING.md.
import { BOXES } from "./catalog.js";

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
// zone 1 = same metro, 2 = southern Ontario, 3 = Ontario north / Quebec, 4 = Prairies / Atlantic,
// 5 = BC / NL, 6 = territories
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
    prov: PROV_BY_LETTER[s[0]], city: CITY_HINT[s.slice(0, 2)] || null,
    rural: s[1] === "0", zone: zoneFor(fsa),
  };
}

// --- Packing: what actually goes on the truck -------------------------------------------
// Large items (box M and up, or glass) ship in their own carton. Everything else is
// consolidated into the smallest box whose volume holds it at 70% fill.
export function pack(lines) {
  const parcels = [], loose = [];
  for (const { product, qty } of lines) {
    for (let i = 0; i < qty; i++) {
      if (["M", "L", "XL"].includes(product.box) || product.glass && product.box !== "XS") {
        const b = BOXES[product.box];
        parcels.push({ box: product.box, ...b, kg: round(product.kg + b.tare, 2), items: [product.sku] });
      } else loose.push(product);
    }
  }
  if (loose.length) {
    const vol = loose.reduce((v, p) => v + boxVol(BOXES[p.box]) * 0.55, 0);
    const kg = loose.reduce((k, p) => k + p.kg, 0);
    const key = ["XS", "S", "M", "L"].find(k => boxVol(BOXES[k]) * 0.7 >= vol) || "L";
    const b = BOXES[key];
    parcels.push({ box: key, ...b, kg: round(kg + b.tare, 2), items: loose.map(p => p.sku) });
  }
  return parcels;
}
const boxVol = b => b.l * b.w * b.h;
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// --- Rate card ----------------------------------------------------------------------------
// Source: Canada Post "Parcel Services Solutions for Small Business price guide", savings level 4,
// effective June 26, 2025 (docs/SHIPPING.md section 2). Prices are per parcel, before fuel.
// The real sheet prices by RATE CODE (origin-destination pair, canadapost.ca/ratecodes), which we
// do not have yet; each zone below uses a percentile of that service's 128 rate-code prices at
// 1, 5 and 10 kg (zone 1 = min, 2 = p10, 3 = p30, 4 = p50, 5 = p90 Expedited / p70 Xpresspost,
// 6 = max). Production replaces this table with the Canada Post Rating API.
// Expedited and Regular Parcel are the SAME price at this level (guide lines 2087 vs 2909), so
// Regular Parcel is never offered: Expedited is faster for the same money.
export const RATE_CARD = {
  divisor: 5000, // cm3 per kg, volumetric equivalent (research section 4; CP exact VE rule to confirm)
  fuelPct: 0.25, // floor after the 15% relief discount, CP news release 2026-10-05; live value weekly
  carriers: [
    { id: "cp-exp", carrier: "Canada Post", service: "Expedited Parcel", days: [1, 2, 3, 4, 6, 9],
      pts: [[9.09, 10.63, 14.23], [11.56, 15.53, 22.53], [14.82, 21.17, 30.03], [16.86, 25.00, 36.05], [20.52, 34.36, 50.48], [35.57, 88.55, 157.23]] },
    { id: "cp-xp", carrier: "Canada Post", service: "Xpresspost", days: [1, 1, 2, 2, 3, 5],
      pts: [[9.57, 12.67, 15.17], [12.92, 19.20, 25.50], [17.53, 27.18, 41.20], [19.80, 37.78, 63.55], [25.40, 54.97, 87.24], [46.09, 108.02, 188.40]] },
  ],
};
const KG = [1, 5, 10];
function priceAt(pts, kg) { // piecewise linear through (1,5,10 kg); flat below 1 kg; extrapolate past 10
  if (kg <= 1) return pts[0];
  const i = kg <= 5 ? 0 : 1;
  const [x0, x1] = [KG[i], KG[i + 1]], [y0, y1] = [pts[i], pts[i + 1]];
  return y0 + (y1 - y0) * (kg - x0) / (x1 - x0);
}

export function billableKg(parcel, divisor = RATE_CARD.divisor) {
  const dim = (parcel.l * parcel.w * parcel.h) / divisor;
  return Math.ceil(Math.max(parcel.kg, dim) * 2) / 2; // priced in 0.5 kg steps on the sheet
}

// Returns options sorted by price. Each option itemises every charge so the number is auditable.
export function quote(dest, parcels) {
  if (!dest || !parcels.length) return [];
  const z = dest.zone - 1;
  return RATE_CARD.carriers.map(c => {
    let freight = 0;
    const perParcel = parcels.map(p => {
      const kg = billableKg(p);
      const f = round(priceAt(c.pts[z], kg));
      freight += f;
      return { box: p.box, actualKg: p.kg, billableKg: kg, freight: f };
    });
    const surcharges = 0; // CP prices remote areas inside the rate code itself
    const fuel = round(freight * RATE_CARD.fuelPct);
    const total = round(freight + fuel);
    return { id: c.id, carrier: c.carrier, service: c.service, days: c.days[z], perParcel, freight: round(freight), surcharges, fuel, total };
  }).sort((a, b) => a.total - b.total);
}

export const money = n => "$" + n.toFixed(2);
