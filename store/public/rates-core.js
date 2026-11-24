// Rate engine for the mockup. Production swaps the sheet lookup for a live Canada Post Rating API
// call (see docs/SHIPPING.md); packing and the interface stay the same.
// Every price comes from cp-sheet.js, generated from the Canada Post price guide by tools/build-rates.py.
// Shared by the store pages and the server. The box sizes are handed in, so this file imports nothing page-only.
let BOXES = {};
export function useBoxes(b) { BOXES = b; }
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

// Cologne and anything else marked ground_only may not fly: the cart is then limited to the ground services.
export function pack(lines) {
  const parcels = packAll(lines);
  parcels.ground = lines.some(l => l.product.ship === "ground_only" && l.qty > 0);
  return parcels;
}
function packAll(lines) {
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
  // Loose parts: first-fit into L-sized bins, shrink each bin to the smallest box that holds it, then
  // rebalance. Tried in several orders; the packing that bills least wins.
  const cap = boxVol(BOXES.L) * BOX_FILL;
  const boxKey = bin => ["XS", "S", "M", "L"].find(k => boxVol(BOXES[k]) * BOX_FILL >= bin.vol) || "L";
  const dimKg = b => boxVol(b) / RATE_CARD.divisor;
  const move = (it, from, to) => {
    from.list.splice(from.list.indexOf(it), 1); from.vol -= looseVol(it); from.kg -= it.kg; from.value -= it.price;
    to.list.push(it); to.vol += looseVol(it); to.kg += it.kg; to.value += it.price;
  };
  const attempt = order => {
    const bins = [];
    for (const p of [...loose].sort(order)) {
      let bin = bins.find(b => b.vol + looseVol(p) <= cap && b.kg + p.kg + BOXES.L.tare <= MAX_KG);
      if (!bin) bins.push(bin = { vol: 0, kg: 0, value: 0, list: [] });
      bin.vol += looseVol(p); bin.kg += p.kg; bin.value += p.price; bin.list.push(p);
    }
    // A box is billed on the larger of its weight and its size, so a light box has billed weight to spare:
    // move items out of boxes billed on real weight into boxes with spare, heaviest first.
    for (let pass = 0; pass < 3; pass++) for (const to of bins) for (const from of bins) {
      if (from === to) continue;
      const tb = BOXES[boxKey(to)], fb = BOXES[boxKey(from)];
      if (from.kg + fb.tare <= dimKg(fb)) continue;
      for (const it of [...from.list].sort((x, y) => y.kg - x.kg)) {
        if (from.list.length > 1 && to.vol + looseVol(it) <= boxVol(tb) * BOX_FILL && to.kg + it.kg + tb.tare <= dimKg(tb)) move(it, from, to);
      }
    }
    const out = bins.map(bin => { const key = boxKey(bin), bx = BOXES[key];
      return { box: key, ...bx, kg: round(bin.kg + bx.tare, 2), value: bin.value, glass: bin.list.some(x => x.glass), fill: round(bin.vol / boxVol(bx)), items: bin.list.map(x => x.sku) }; });
    const score = out.reduce((t, p) => t + (sheetPrice("exp", 3, billableKg(p)) ?? 1e6), 0);
    return { out, score };
  };
  const orders = [(x, y) => looseVol(y) - looseVol(x) || y.kg - x.kg, (x, y) => y.kg - x.kg || looseVol(y) - looseVol(x), (x, y) => looseVol(x) - looseVol(y) || x.kg - y.kg, (x, y) => x.kg - y.kg];
  const best = orders.map(attempt).sort((x, y) => x.score - y.score || x.out.length - y.out.length)[0];
  parcels.push(...best.out);
  return parcels;
}

// --- Rating -------------------------------------------------------------------------------
// FUEL: Canada Post's published domestic fuel surcharge, relief rate, for the week shown. It changes
// weekly (canadapost.ca/fuelsurcharge), which is why production must read it from the Rating API.
// Each row is one published week; the newest row that has started is the one in force. Add next week's
// row when Canada Post posts it. Rows 1 and 2 read 2026-11-15; row 3 read 2026-11-23 from
// canadapost-postescanada.ca/cpc/en/support/kb/sending/rates-dimensions/fuel-surcharges-on-mail-and-parcels (Domestic, 45.50%, 38.60% with relief).
const FUEL_WEEKS = [
  { from: "2026-11-09", pct: 0.412, week: "Nov 9 to Nov 15, 2026" },
  { from: "2026-11-16", pct: 0.399, week: "Nov 16 to Nov 22, 2026" },
  { from: "2026-11-23", pct: 0.386, week: "Nov 23 to Nov 29, 2026" },
];
// stale: the newest row's week has ended. The last posted rate is still used, but the cart says so and the server logs it.
export const fuelOn = (day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })) => {
  const row = FUEL_WEEKS.filter(w => w.from <= day).pop() || FUEL_WEEKS[0], last = FUEL_WEEKS[FUEL_WEEKS.length - 1];
  return { ...row, stale: row === last && Date.parse(day + "T00:00:00Z") > Date.parse(last.from + "T00:00:00Z") + 6 * 864e5 };
};
export const FUEL = fuelOn();
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
export function quote(dest, parcels, fuelPct = fuelOn().pct) {   // read at call time: a Worker has no clock at load
  if (!dest || !parcels.length || parcels.some(p => p.kg > MAX_KG)) return [];
  const z = dest.zone - 1, out = [];
  for (const c of RATE_CARD.carriers) {
    if (parcels.ground && c.id === "cp-xp") continue;
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

// Local delivery, the owner's terms: road distance from the shop. Up to 10 km is $10, over 10 through 25 km is $15, past 25 km is not offered. Per order, in cents.
export const LOCAL_LIMIT_M = 25000, FREE_LOCAL_CENTS = 20000;
export const deliveryFee = metres => !Number.isFinite(metres) || metres < 0 ? null : metres <= 10000 ? 1000 : metres <= LOCAL_LIMIT_M ? 1500 : null;
// An items subtotal of $200.00 or more before tax delivers free.
export const localDue = (feeCents, subtotalCents) => subtotalCents >= FREE_LOCAL_CENTS ? 0 : feeCents;
// Postal areas worth asking the map about, drawn wide around the shop: the road distance makes the real decision. Only Wallaceburg (N8A) is ruled out here.
export const localArea = d => !!d && d.prov === "ON" && /^N(?:9|0R|0P|8(?!A))/.test(d.fsa);
// Shop hours, Windsor time. [open, close] in 24h, Sunday first.
export const SHOP_HOURS = [[11, 19], [10, 21], [10, 21], [10, 21], [10, 21], [10, 21], [10, 21]];
// When a local order arrives, in words. Never an exact time.
export function localEta(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now).map(x => [x.type, x.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday.slice(0, 3)), t = (+parts.hour % 24) + +parts.minute / 60, [open, close] = SHOP_HOURS[day];
  return t >= open && t < close ? "Arrives in about 25 minutes to 1 hour" : t < open ? "Arrives this morning" : "Arrives tomorrow morning";
}

export const days = n => n + (n === 1 ? " day" : " days");
export const money = n => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Sales tax by the province the parcel goes to (pickup is Ontario). GST/HST only: provincial sales tax in BC,
// Saskatchewan, Manitoba and Quebec is charged once the shop is registered there.
const HST = { ON: 0.13, NB: 0.15, NL: 0.15, PE: 0.15, NS: 0.14 };
export const taxRate = prov => HST[prov] ?? 0.05;
// The one sum for an order's money, in whole cents, used by the checkout page and the server alike.
export const orderTotals = (subtotal, shipping, prov) => { const tax = Math.round((subtotal + shipping) * taxRate(prov)); return { subtotal, shipping, tax, total: subtotal + shipping + tax }; };
export const taxLabel = prov => `${HST[prov] ? "HST" : "GST"} ${Math.round(taxRate(prov) * 100)}%`;
