import { parsePostal, pack, quote, billableKg } from "../site/rates.js";
import { PRODUCTS } from "../site/catalog.js";
let n = 0, f = 0;
const t = (name, ok) => { n++; if (!ok) { f++; console.log("FAIL", name); } };
// postal parsing
t("valid full", parsePostal("b3h 4r2")?.full === "B3H 4R2");
t("valid fsa only", parsePostal("T2P")?.fsa === "T2P");
t("rejects D lead", parsePostal("D1A 1A1") === null);
t("rejects US zip", parsePostal("48226") === null);
t("rejects W lead", parsePostal("W1A1A1") === null);
t("rejects O in 3rd", parsePostal("K1O 1A1") === null);
t("rural flag", parsePostal("N0R 1A0")?.rural === true);
t("Windsor zone 1", parsePostal("N9A 1A1")?.zone === 1);
t("Halifax zone 4", parsePostal("B3H 4R2")?.zone === 4);
t("Vancouver zone 5", parsePostal("V6B 1A1")?.zone === 5);
t("Yellowknife zone 6", parsePostal("X1A 2P7")?.zone === 6);
// dim weight
t("dim beats actual", billableKg({ l: 66, w: 36, h: 36, kg: 6.5 }) === 17.5);
t("actual beats dim", billableKg({ l: 23, w: 16, h: 8, kg: 2.1 }) === 2.5);
// packing
const hk = PRODUCTS.find(p => p.sku === "OSS-0101"), tips = PRODUCTS.find(p => p.sku === "OSS-0305"), hose = PRODUCTS.find(p => p.sku === "OSS-0301");
const pk = pack([{ product: hk, qty: 2 }, { product: tips, qty: 1 }, { product: hose, qty: 1 }]);
t("two hookahs = two cartons + one consolidated", pk.length === 3);
t("all items packed", pk.flatMap(p => p.items).length === 4);
t("packed weight includes tare", pk[0].kg > hk.kg);
// quotes: every product, every zone: finite, positive, itemised, farther never cheaper
const codes = ["N9A1A1", "M5V2T6", "H2X1Y4", "B3H4R2", "V6B1A1", "X1A2P7"];
for (const p of PRODUCTS) {
  let prev = 0;
  for (const c of codes) {
    const q = quote(parsePostal(c), pack([{ product: p, qty: 1 }]));
    const best = q[0];
    t(p.sku + " " + c + " finite", q.length === 2 && q.every(o => Number.isFinite(o.total) && o.total > 0));
    t(p.sku + " " + c + " itemised sums", q.every(o => Math.abs(o.freight + o.surcharges + o.fuel - o.total) < 0.011));
    t(p.sku + " " + c + " monotonic", best.total >= prev - 0.001); prev = best.total;
  }
}
t("empty cart quotes nothing", quote(parsePostal("B3H4R2"), []).length === 0);
t("no dest quotes nothing", quote(null, pk).length === 0);
const big = quote(parsePostal("B3H4R2"), pack([{ product: hk, qty: 1 }]))[0];
console.log("sample: OSS-0101 to Halifax: " + big.carrier + " " + big.service + " $" + big.total + " (billed " + big.perParcel[0].billableKg + " kg)");
console.log(f ? "FAIL " + f + "/" + n : "PASS " + n + "/" + n); process.exit(f ? 1 : 0);
