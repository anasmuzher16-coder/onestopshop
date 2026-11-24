// Checkout checks against the running local store: the server prices the order itself, tax follows the province,
// stock comes down and never oversells, cologne cannot take the fast service, bad input is refused.
// node store/tools/test-checkout.mjs   (changes the local sample data: reseed afterwards)
import { readFileSync } from "node:fs";
import { parsePostal, pack, quote } from "../../site/rates.js";
import { PRODUCTS } from "../../site/catalog.js";
import { fuelOn } from "../public/rates-core.js";   // the fuel rate changes weekly: the sample engine is given this week's, so it still checks packing and rates
const B = process.env.BASE || "http://127.0.0.1:4420";
const KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const post = async body => { const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const stockOf = async sku => (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === sku)?.stock;
const who = { name: "Test Shopper", email: "test@example.com" }, to = { postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" } };

// a hookah to Toronto: shipping must equal the mockup's verified engine, tax must be Ontario HST on items plus shipping
const hk = PRODUCTS.find(p => p.sku === "OSS-1001"), ref = quote(parsePostal("M5V 2T6"), pack([{ product: hk, qty: 1 }]), fuelOn().pct).find(o => o.id === "cp-exp");
const before = await stockOf("OSS-1001");
const a = await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-1001", qty: 1, price: 1, unit_cents: 1 }], total_cents: 1 });
ok(a.status === 201, "ship order placed: " + a.status + " " + (a.data.error || ""));
if (a.status === 201) {
  const o = a.data.order;
  ok(o.subtotal_cents === 64900, "price comes from the database, not the request: " + o.subtotal_cents);
  ok(o.shipping_cents === Math.round(ref.total * 100), `shipping ${o.shipping_cents} equals the verified engine ${Math.round(ref.total * 100)}`);
  ok(o.tax_cents === Math.round((o.subtotal_cents + o.shipping_cents) * 0.13) && o.total_cents === o.subtotal_cents + o.shipping_cents + o.tax_cents, "Ontario HST 13% on items plus shipping");
  ok(/^W[A-Z0-9]{6}$/.test(o.id), "order code " + o.id);
  ok((await stockOf("OSS-1001")) === before - 1, "stock came down by one");
}
// Alberta: GST 5%. Nova Scotia: 14%.
const ab = await post({ ...who, postal: "T2P 1J9", address: { line1: "2 Test Ave", city: "Calgary" }, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-8003", qty: 1 }] });
ok(ab.status === 201 && ab.data.order.tax_cents === Math.round((ab.data.order.subtotal_cents + ab.data.order.shipping_cents) * 0.05) && ab.data.order.tax_label === "GST 5%", "Alberta charges GST 5%");
const ns = await post({ ...who, postal: "B3H 1A1", address: { line1: "3 Test Rd", city: "Halifax" }, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-8004", qty: 1 }] });
ok(ns.status === 201 && ns.data.order.tax_label === "HST 14%", "Nova Scotia charges HST 14%");
// pickup: free, Ontario tax, no address needed
const pu = await post({ ...who, method: "pickup", lines: [{ sku: "OSS-8004", qty: 2 }] });
ok(pu.status === 201 && pu.data.order.shipping_cents === 0 && pu.data.order.tax_cents === Math.round(pu.data.order.subtotal_cents * 0.13), "pickup is free with Ontario tax");
// cologne: ground only
ok((await post({ ...who, ...to, method: "ship", service: "cp-xp", lines: [{ sku: "OSS-7001", qty: 1 }] })).status === 409, "cologne cannot take Xpresspost");
ok((await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-7001", qty: 1 }] })).status === 201, "cologne ships by Expedited");
ok((await post({ ...who, ...to, method: "ship", service: "cp-xp", lines: [{ sku: "OSS-8003", qty: 1 }, { sku: "OSS-7002", qty: 1 }] })).status === 409, "a mixed cart with cologne cannot take Xpresspost either");
// refusals
ok((await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [] })).status === 400, "empty cart refused");
ok((await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: "NOPE", qty: 1 }] })).status === 409, "unknown item refused");
ok((await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-8004", qty: -2 }] })).status === 400, "negative quantity refused");
ok((await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-8004", qty: 1.5 }] })).status !== 500, "odd quantity handled");
ok((await post({ ...who, postal: "M5V", address: to.address, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-8004", qty: 1 }] })).status === 400, "half a postal code refused");
ok((await post({ name: "", email: "x@y.ca", method: "pickup", lines: [{ sku: "OSS-8004", qty: 1 }] })).status === 400, "missing name refused");
ok((await post({ name: "A", email: "not-an-email", method: "pickup", lines: [{ sku: "OSS-8004", qty: 1 }] })).status === 400, "bad email refused");
ok((await post({ ...who, method: "pickup", lines: [{ sku: "OSS-7008", qty: 1 }] })).status === 409, "sold-out item refused");
const getR = await fetch(B + "/api/orders"); ok(getR.status === 405, "orders cannot be listed by the public");
// the last one: two shoppers at once, one wins
const last = await stockOf("OSS-7006");
const race = await Promise.all([1, 2, 3].map(() => post({ ...who, method: "pickup", lines: [{ sku: "OSS-7006", qty: last }] })));
ok(race.filter(r => r.status === 201).length === 1 && (await stockOf("OSS-7006")) === 0, `three shoppers after the last ${last}: exactly one gets it (${race.map(r => r.status).join(",")})`);
// the shop sees it
const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: KEY }) }), cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const orders = (await (await fetch(B + "/api/admin/orders", { headers: { Cookie: cookie } })).json()).orders;
ok(a.status === 201 && orders.some(o => o.id === a.data.order.id && o.status === "paid"), "the new order is in the back office as To pack");
const hist = (await (await fetch(B + "/api/admin/products/OSS-1001/history", { headers: { Cookie: cookie } })).json()).moves;
ok(hist[0].reason === "sale" && hist[0].delta === -1, "the sale is in the stock history");
const lost = orders.filter(o => o.status === "pending").length; ok(lost === 0, "no half-made orders left behind: " + lost);
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
