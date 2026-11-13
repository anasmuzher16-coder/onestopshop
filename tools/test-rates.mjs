import { parsePostal, pack, quote, billableKg, sheetPrice, MAX_KG } from "../site/rates.js";
import { KGS, SHEET } from "../site/cp-sheet.js";
import { PRODUCTS } from "../site/catalog.js";
let n = 0, f = 0;
const t = (name, ok) => { n++; if (!ok) { f++; console.log("FAIL", name); } };
// postal parsing
t("valid full", parsePostal("b3h 4r2")?.full === "B3H 4R2");
t("leading and double spaces", parsePostal(" K1A  0B1")?.full === "K1A 0B1");
t("valid fsa only", parsePostal("T2P")?.fsa === "T2P");
t("rejects D lead", parsePostal("D1A 1A1") === null);
t("rejects US zip", parsePostal("48226") === null);
t("rejects W lead", parsePostal("W1A1A1") === null);
t("rejects O in 3rd", parsePostal("K1O 1A1") === null);
t("rural flag", parsePostal("N0R 1A0")?.rural === true);
t("Nunavut", parsePostal("X0A 0H0")?.prov === "NU");
t("Windsor zone 1", parsePostal("N9A 1A1")?.zone === 1);
t("Halifax zone 4", parsePostal("B3H 4R2")?.zone === 4);
t("Vancouver zone 5", parsePostal("V6B 1A1")?.zone === 5);
t("Yellowknife zone 6", parsePostal("X1A 2P7")?.zone === 6);
// billable weight follows the sheet's rows
t("dim beats actual", billableKg({ l: 66, w: 36, h: 36, kg: 6.5 }) === 17.5);
t("actual beats dim", billableKg({ l: 23, w: 16, h: 8, kg: 2.1 }) === 2.5);
t("0.75 row used", billableKg({ l: 23, w: 16, h: 8, kg: 0.3 }) === 0.75);
// every price the engine can return sits inside the sheet's own min..max for that weight row
for (const svc of ["exp", "xp"]) for (let z = 0; z < 6; z++) KGS.forEach((k, i) => {
  const v = sheetPrice(svc, z, k);
  t(svc + " z" + z + " " + k + " kg inside sheet range", v !== null && v >= SHEET[svc].min[i] - 0.001 && v <= SHEET[svc].max[i] + 0.001);
});
// known cells, read off the PDF: Expedited rate code C02 at 0.5 / 1 / 17.5 / 30 kg
t("exp cheapest 0.5 kg = 8.23", sheetPrice("exp", 0, 0.5) === 8.23);
t("exp cheapest 1 kg = 9.09", sheetPrice("exp", 0, 1) === 9.09);
t("exp dearest 5 kg = 48.10", sheetPrice("exp", 5, 5) === 48.1);
t("exp dearest 10 kg = 82.43", sheetPrice("exp", 5, 10) === 82.43);
// packing
const byName = n => PRODUCTS.find(p => p.name === n);
const hk = byName("Mamoun Kamanja Gold"), tips = byName("Jumbo mouth tips, 50"), hose = byName("Soft-touch hose");
const fr = byName("Tortoise round frame"), lh = byName("Hand-stitched leather hose");
const pk = pack([{ product: hk, qty: 2 }, { product: tips, qty: 1 }, { product: hose, qty: 1 }]);
t("two hookahs = two cartons, accessories ride along", pk.length === 2);
t("all items packed", pk.flatMap(p => p.items).length === 4);
t("packed weight includes tare", pk[0].kg > hk.kg);
const acc = pack([{ product: tips, qty: 2 }, { product: hose, qty: 1 }]);
t("accessories alone = one small box", acc.length === 1 && ["XS", "S"].includes(acc[0].box));
for (const [prod, q] of [[fr, 99], [lh, 40], [hose, 50], [hk, 12]]) {
  const ps = pack([{ product: prod, qty: q }]);
  t(prod.sku + " x" + q + " all packed", ps.flatMap(p => p.items).length === q);
  t(prod.sku + " x" + q + " no parcel over 30 kg", ps.every(p => p.kg <= MAX_KG));
  t(prod.sku + " x" + q + " no box over 70% full", ps.every(p => p.fill == null || p.fill <= 0.7001));
  t(prod.sku + " x" + q + " quotes", quote(parsePostal("B3H4R2"), ps).length === 3);
}
t("50 hoses need more than one box", pack([{ product: hose, qty: 50 }]).length > 1);
t("qty capped at 99", pack([{ product: fr, qty: 1e8 }]).flatMap(p => p.items).length === 99);
t("bad qty ignored", pack([{ product: fr, qty: -3 }]).length === 0 && pack([{ product: fr, qty: "x" }]).length === 0);
t("over 30 kg parcel refuses to quote", quote(parsePostal("B3H4R2"), [{ l: 30, w: 30, h: 30, kg: 31, value: 0, glass: false, items: [] }]).length === 0);
t("glass over $100 carries cover + signature", quote(parsePostal("B3H4R2"), pack([{ product: hk, qty: 1 }])).find(o => o.id === "cp-exp").cover === Math.ceil((hk.price - 100) / 100) * 2.75 + 2);
t("non-glass carries no cover", quote(parsePostal("B3H4R2"), pack([{ product: fr, qty: 1 }]))[0].cover === 0);
// quotes: every product, every zone: finite, positive, itemised, farther never cheaper
const codes = ["N9A1A1", "M5V2T6", "H2X1Y4", "B3H4R2", "V6B1A1", "X1A2P7"];
for (const p of PRODUCTS) {
  let prev = 0;
  for (const c of codes) {
    const q = quote(parsePostal(c), pack([{ product: p, qty: 1 }]));
    const best = q[0];
    t(p.sku + " " + c + " finite", q.length === 3 && q.every(o => Number.isFinite(o.total) && o.total > 0));
    t(p.sku + " " + c + " itemised sums", q.every(o => Math.abs(o.freight + o.cover + o.fuel - o.total) < 0.011));
    t(p.sku + " " + c + " monotonic", best.total >= prev - 0.001); prev = best.total;
  }
}
t("empty cart quotes nothing", quote(parsePostal("B3H4R2"), []).length === 0);
t("no dest quotes nothing", quote(null, pk).length === 0);
for (const c of ["B3H4R2", "X1A2P7"]) {
  const b = quote(parsePostal(c), pack([{ product: hk, qty: 1 }])).find(o => o.id === "cp-exp");
  console.log("sample: " + hk.name + " ($" + hk.price + ") to " + c + ": " + b.service + " $" + b.total + " (freight " + b.freight + ", cover " + b.cover + ", fuel " + b.fuel + ", billed " + b.perParcel[0].billableKg + " kg)");
}
console.log(f ? "FAIL " + f + "/" + n : "PASS " + n + "/" + n); process.exit(f ? 1 : 0);
