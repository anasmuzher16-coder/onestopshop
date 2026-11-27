// Local delivery checks: the fee at every edge, then the running local store with the stand-in map service.
// Needs tools/fake-geoapify.mjs and the store on 4420 with GEOAPIFY_KEY:test and GEOAPIFY_BASE. Changes local sample data.
import { samplesOn } from "./fixtures/samples-on.mjs";
import { readFileSync } from "node:fs";
import { deliveryFee, localDue, localEta, localArea, parsePostal, pack, quote, useBoxes } from "../public/rates-core.js";
import { toStorefront, weightUnknown, counterRow } from "../src/catalog.js";
const B = process.env.BASE || "http://127.0.0.1:4420", MAP = process.env.MAP || "http://127.0.0.1:4499";
// the made-up sample rows this suite buys, switched back on in its own throwaway database (tools/fixtures/samples-on.mjs)
await samplesOn(B, ["OSS-8004"]);
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
for (const [m, want] of [[0, 1000], [500, 1000], [10000, 1000], [10000.01, 1500], [10010, 1500], [25000, 1500], [25000.01, null], [25010, null], [-1, null], [NaN, null], [Infinity, null]]) ok(deliveryFee(m) === want, `fee at ${m} m is ${want}, got ${deliveryFee(m)}`);
// weight from the item editor (2026-11-27): products.weight_g marked details.weighed is the shipping weight rates are worked out from.
// Foil with it is no longer weight TBD and gets carrier prices; charcoal with it is still never shipped; a weight that equals the
// import's placeholder (2,500 g on an Ace hookah) still counts once the shop typed it, and shows in place of the maker's figure.
{ const { BOXES } = await import("data:text/javascript;base64," + Buffer.from(await (await fetch(B + "/api/catalog-module")).text()).toString("base64"));
  const boxes = Object.entries(BOXES).map(([id, b]) => ({ id, label: b.label, l_cm: b.l, w_cm: b.w, h_cm: b.h, tare_g: Math.round(b.tare * 1000) }));
  const base = { category_id: "heat", price_cents: 999, box_id: "XS", glass: 0, ship_class: "standard", height_cm: null, note: "", img: "", img_dark: 0, img_lw: null, photo_ver: 0, stock: 5, active: 1, listed: 1, variant_label: "", swatch_hex: null, availability: "counted" };
  const foil = { ...base, sku: "OSS-9301", name: "Foil", family: "foil-oss-9301", weight_g: 1, details: "{}", facts_known: '{"fulfilment":"ships","weight_g":null}' };
  const foilW = { ...foil, sku: "OSS-9302", weight_g: 120, details: '{"weighed":true}' };
  const coal = { ...base, sku: "OSS-9104", name: "Coal", category_id: "charcoal", family: "charcoal-oss-9104", ship_class: "standard", weight_g: 1000, details: '{"charcoal":true,"weighed":true}', facts_known: '{"fulfilment":"pickup_or_local_delivery","weight_g":null}' };
  const hk = { ...base, sku: "OSS-100001", name: "Hookah", category_id: "hookahs", box_id: "T", family: "ace-test", weight_g: 2500, details: '{"weighed":true}', facts_known: '{"weight_g":null,"item_weight_g":2800}' };
  const S = Object.fromEntries(toStorefront({ categories: [], boxes, products: [foil, foilW, coal, hk] }).PRODUCTS.map(p => [p.sku, p]));
  useBoxes(toStorefront({ categories: [], boxes, products: [] }).BOXES);
  const to = parsePostal("M5V 2T6"), q = p => quote(to, pack([{ product: p, qty: 1 }]));
  ok(weightUnknown(foil) && S["OSS-9301"].weightTbd && S["OSS-9301"].ship === "pickup_only", "weight: foil without a weight is weight TBD, pickup or local only");
  ok(!weightUnknown(foilW) && !S["OSS-9302"].weightTbd && S["OSS-9302"].ship === "standard" && S["OSS-9302"].kg === 0.12 && !("weighed" in S["OSS-9302"].details), "weight: foil with the shop's weight ships on 120 g, the mark stays in the back office");
  const qw = q(S["OSS-9302"]); ok(qw.length > 0 && qw.every(o => o.perParcel.every(pp => pp.billableKg >= 0.12)), "weight: foil with a weight gets carrier prices: " + qw.length);
  ok(S["OSS-9104"].ship === "pickup_only" && counterRow(coal), "weight: charcoal with a weight is still pickup or local only, never a carrier");
  ok(!weightUnknown(hk) && !S["OSS-100001"].weightTbd && S["OSS-100001"].kg === 2.5 && S["OSS-100001"].facts.item_weight_g === 2500, "weight: a typed weight equal to the import's placeholder counts, and is the weight shown"); }
for (const [sub, want] of [[0, 1500], [19999, 1500], [20000, 0], [20001, 0]]) ok(localDue(1500, sub) === want, `items of ${sub} cents pay ${want}`);
// November in Windsor is UTC-5. 2026-11-22 is a Sunday (open 11 to 7); Monday is open 10 to 9.
for (const [at, want] of [["2026-11-22T15:59:00Z", "this morning"], ["2026-11-22T16:00:00Z", "25 minutes"], ["2026-11-22T23:59:00Z", "25 minutes"], ["2026-11-23T00:00:00Z", "tomorrow morning"], ["2026-11-23T07:00:00Z", "this morning"], ["2026-11-23T15:00:00Z", "25 minutes"], ["2026-11-24T01:59:00Z", "25 minutes"], ["2026-11-24T02:00:00Z", "tomorrow morning"]]) ok(localEta(new Date(at)).includes(want), `at ${at} wanted "${want}", got "${localEta(new Date(at))}"`);
ok(localEta(new Date("2026-11-23T15:00:00Z")) === "Arrives in about 25 minutes to 1 hour", "open-hours wording is exact");
for (const code of ["N8R 1A2", "N8N 1W9", "N8L 1A1", "N9K 1A1", "N0R 1A0", "N8M 1A8", "N8H 1A1", "N0P 1A0", "N9Y 1A1"]) ok(localArea(parsePostal(code)), `${code} is left for the road distance to decide`);
const routeCount = async () => (await (await fetch(MAP + "/__routes")).json()).routes;
const run = Date.now() % 1000;
// each order comes from its own made-up address, as real shoppers do: the per-visitor order limits (src/guard.js) have their own checks in test-orders
const shopper = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;
// every request from its own made-up address: the delivery check counts real map lookups per visitor (src/delivery.js), with its own check below
const post = async (path, body, ip = shopper()) => { const r = await fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const CARD = /<meta name="oss-pay" content="card">/.test(await (await fetch(B + "/")).text());
// NO CARD KEYS (the live demo, breaker 2026-11-27): delivery cannot be ordered, so the public delivery check answers "pickup only for
// now" without a paid map lookup, whatever is asked
if (!CARD) {
  const before = await routeCount(), r = await post("/api/delivery", { line1: `7 D3000 ${run}nk St`, city: "Windsor", postal: "N9A 1A1" }), r2 = await post("/api/delivery", { postal: "N8X 1A1" });
  ok(r.status === 200 && r.data.status === "down" && r.data.pickup_only === true && /Pickup only for now/.test(r.data.message || "") && r2.data.pickup_only === true && !("fee_cents" in r.data), "no keys: the delivery check says pickup only for now: " + JSON.stringify(r.data));
  ok(await routeCount() === before, "no keys: the delivery check makes no map lookup");
}
const check = (line1, postal = "N9A 1A1") => post("/api/delivery", { line1, city: "Windsor", postal });
if (CARD) {
const cases = [[`7 D10000 ${run} St`, "ok", 1000], [`7 D10000_1 ${run} St`, "ok", 1500], [`7 D25000 ${run} St`, "ok", 1500], [`7 D25000_1 ${run} St`, "far"], [`Unit 2, 7 D3000 ${run} St`, "ok", 1000], [`1-7 D3001 ${run} St`, "ok", 1000], [`D3002 ${run} St`, "unsure"], [`9 WRONGNUM ${run}`, "ok", 1000], [`9 ROADSAME ${run}`, "ok", 1000], [`9 ROADSPLIT ${run}`, "ok", 1000], [`9 NOBOX ${run}`, "ok", 1000], [`7 NOTFOUND ${run}`, "ok", 1000], [`7 MAPDOWN ${run}`, "down"], [`7 DETROIT ${run}`, "unsure"], [`7 WRONGPC ${run}`, "unsure"], [`7 VAGUE ${run}`, "ok", 1000], [`100 FARHIT ${run}`, "unsure"],
  [`7 LZ9000W11000 ${run} St`, "ok", 1500], [`7 LZ11000W9000 ${run} St`, "ok", 1000], [`7 LZ10000W30000 ${run} St`, "far"], [`7 LZ30000W10000 ${run} St`, "ok", 1000], [`7 LZ25000W40000 ${run} St`, "far"], [`7 LZ40000W25000 ${run} St`, "ok", 1500], [`7 LZ25001W40000 ${run} St`, "far"], [`7 LZ26000W26000 ${run} St`, "far"]];
const wait = () => new Promise(r => setTimeout(r, 4100));
for (const [line, status, fee] of cases) { await wait(); const r = await check(line); ok(r.data.status === status && (fee === undefined || r.data.fee_cents === fee), `${line}: wanted ${status} ${fee ?? ""}, got ${JSON.stringify(r.data)}`); ok(!("metres" in r.data), "the shopper is not sent the distance"); }
await new Promise(r => setTimeout(r, 61000));
{ const before = await routeCount(), r = await check(`7 FARAWAY ${run} St`); ok(r.data.status === "far" && await routeCount() === before, "a place far past the shop is refused without a route lookup"); }
{ const before = await routeCount(), r = await check(`7 LZ3000W9000 ${run} St`); ok(r.data.status === "ok" && r.data.fee_cents === 1000 && await routeCount() === before + 1, "one shop means one road lookup"); }
{ const before = await routeCount(), r = await check(`7 LZ3000W9000 ${run} St`); ok(r.data.fee_cents === 1000 && await routeCount() === before, "a repeat address uses the cache, no map lookup"); }
ok((await check(`7 D5000 ${run} St`, "M5V 2T6")).data.status === "far", "a Toronto postal code is out of the delivery area");
const byPostal = postal => post("/api/delivery", { postal });
for (const [code, status, fee] of [["N9A 1A1", "ok", 1000], ["N8X 1A1", "ok", 1000], ["N8N 1W9", "ok", 1500], ["N9H 1A1", "ok", 1500], ["N0R 1A0", "far"], ["N8H 1A1", "far"], ["N8M 1A8", "far"], ["N9A 9Z9", "address"], ["T2P 1J9", "far"]]) { const r = await byPostal(code); ok(r.data.status === status && (fee === undefined || r.data.fee_cents === fee), `postal ${code}: wanted ${status} ${fee ?? ""}, got ${JSON.stringify(r.data)}`); }
ok((await post("/api/delivery", { line1: `7 NOTFOUND ${run}b`, city: "Detroit", postal: "N9A 1A1" })).data.status === "unsure", "an unmapped street in the wrong town is not priced by postal code");
{ const ip = shopper(); for (const [a, b] of [[`7 D4000 ${run} St`, `7-D4000 ${run} St`]]) ok((await post("/api/delivery", { line1: a, city: "Windsor", postal: "N9A 1A1" }, ip)).data.status === "ok" && (await post("/api/delivery", { line1: b, city: "Windsor", postal: "N9A 1A1" }, ip)).data.status === "unsure", "addresses that differ only by punctuation do not share an answer"); }
// one visitor gets 30 real map lookups an hour, counted in the database across every Worker; a cached address is free
{ const ip = shopper(), one = i => post("/api/delivery", { line1: `7 D2000 Q${i}x${run} St`, city: "Windsor", postal: "N9A 1A1" }, ip), got = [];
  for (let i = 0; i < 15; i++) got.push(await one(i));
  await new Promise(r => setTimeout(r, 61000));   // the per-Worker speed bump (15 a minute) is not what is being checked
  for (let i = 15; i < 30; i++) got.push(await one(i));
  const before = await routeCount(), past = await one(30), again = await post("/api/delivery", { line1: `7 D2000 Q0x${run} St`, city: "Windsor", postal: "N9A 1A1" }, ip);
  ok(got.every(r => r.data.status === "ok"), "30 lookups in an hour from one visitor are answered: " + got.map(r => r.data.status).join(","));
  ok(past.data.status === "down" && past.data.limited === true && await routeCount() === before, "the 31st new address in an hour is refused without a map lookup: " + JSON.stringify(past.data));
  ok(again.data.status === "ok", "an address already checked still answers from the cache: " + JSON.stringify(again.data)); }
}
const who = { name: "Dee Livery", email: "dee@example.com", phone: "519-555-0101" }, base = { ...who, method: "ship", service: "local", postal: "N9A 1A1", lines: [{ sku: "OSS-8004", qty: 1 }] };
const at = line1 => ({ line1, city: "Windsor" });
// NO CARD KEYS (the live demo): the delivery quote above still answers, but a delivery order is refused with the shop's
// number before anything is priced or held. The fee rules on real orders below are checked with keys.
if (!/<meta name="oss-pay" content="card">/.test(await (await fetch(B + "/")).text())) {
  const stock0 = (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === "OSS-8004").stock;
  for (const [what, body] of [["a delivery order", { ...base, address: at(`7 D12500 ${run} St`), delivery_fee_cents: 1500 }], ["a forged lower fee", { ...base, address: at(`7 D12500 ${run} St`), delivery_fee_cents: 1000 }],
    ["past 25 km", { ...base, address: at(`7 D25000_1 ${run} St`), delivery_fee_cents: 1500 }], ["a forged free delivery", { ...base, address: at(`7 D3000 ${run} St`), delivery_fee_cents: 0 }],
    ["a Toronto postal code", { ...base, postal: "M5V 2T6", address: at(`7 D5000 ${run} St`), delivery_fee_cents: 1000 }], ["Canada Post", { ...who, method: "ship", service: "cp-exp", postal: "M5V 2T6", lines: base.lines, address: { line1: "1 Test St", city: "Toronto" } }]]) {
    const r = await post("/api/orders", body);
    ok(r.status === 503 && r.data.pay_off === true && /519-255-2222/.test(r.data.error || "") && !r.data.order, `no keys: ${what} is refused with the shop's number: ${r.status} ${r.data.error || ""}`);
  }
  ok((await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === "OSS-8004").stock === stock0, "no keys: refused delivery orders hold no stock");
  console.log(f ? `FAIL ${f} of ${n} checks (no card keys)` : `PASS ${n} checks (no card keys)`); process.exit(f ? 1 : 0);
}
const good = await post("/api/orders", { ...base, address: at(`7 D12500 ${run} St`), delivery_fee_cents: 1500 });
ok(good.status === 201, "delivery order placed: " + good.status + " " + (good.data.error || ""));
if (good.status === 201) { const o = good.data.order; ok(o.shipping_cents === 1500 && o.service === "Local delivery", "fee and service on the order"); ok(o.tax_cents === Math.round((o.subtotal_cents + 1500) * 0.13) && o.total_cents === o.subtotal_cents + 1500 + o.tax_cents, "HST on items plus delivery"); }
const forged = await post("/api/orders", { ...base, address: at(`7 D12500 ${run} St`), delivery_fee_cents: 1000 });
ok(forged.status === 409 && forged.data.delivery === "ok" && forged.data.fee_cents === 1500, "a forged lower fee is refused and the real one returned");
ok((await post("/api/orders", { ...base, address: at(`7 D25000_1 ${run} St`), delivery_fee_cents: 1500 })).status === 409, "past 25 km cannot be ordered");
ok((await post("/api/orders", { ...base, address: at(`7 MAPDOWN ${run}x`), delivery_fee_cents: 1000 })).status === 409, "map service down: no delivery order");
ok((await post("/api/orders", { ...base, phone: "", address: at(`7 D5000 ${run} St`), delivery_fee_cents: 1000 })).data.field === "phone", "delivery needs a phone number");
ok((await post("/api/orders", { ...base, postal: "M5V 2T6", address: at(`7 D5000 ${run} St`), delivery_fee_cents: 1000 })).status === 409, "a Toronto postal code cannot get local delivery");
// the $200 line, a forged free delivery, and a pickup-only piece, on a real order. Puts the sample product back afterwards.
await new Promise(r => setTimeout(r, 61000));
const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) }), cookie = (login.headers.get("set-cookie") || "").split(";")[0];
ok(login.status === 200, "signed in to change the test product");
const edit = body => fetch(B + "/api/admin/products/OSS-8004", { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify(body) });
const ten = at(`7 D3000 ${run} St`);
try {
  ok((await edit({ price_cents: 19999 })).ok, "set price $199.99");
  const pays = await post("/api/orders", { ...base, address: ten, delivery_fee_cents: 1000 });
  ok(pays.status === 201 && pays.data.order.subtotal_cents === 19999 && pays.data.order.shipping_cents === 1000, "$199.99 pays the delivery fee: " + JSON.stringify(pays.data).slice(0, 120));
  const free199 = await post("/api/orders", { ...base, address: ten, delivery_fee_cents: 0 });
  ok(free199.status === 409 && free199.data.fee_cents === 1000, "free delivery forged on $199.99 is refused");
  ok((await edit({ price_cents: 20000 })).ok, "set price $200.00");
  const free = await post("/api/orders", { ...base, address: ten, delivery_fee_cents: 0 });
  ok(free.status === 201 && free.data.order.subtotal_cents === 20000 && free.data.order.shipping_cents === 0 && free.data.order.tax_cents === 2600 && free.data.order.total_cents === 22600, "$200.00 delivers free, tax on items only: " + JSON.stringify(free.data).slice(0, 120));
  const charged = await post("/api/orders", { ...base, address: ten, delivery_fee_cents: 1000 });
  ok(charged.status === 409 && charged.data.fee_cents === 0, "a fee sent on a free order is refused and the real one returned");
  ok(typeof free.data.order?.eta === "string" && /^Arrives /.test(free.data.order.eta), "the order carries arrival wording");
  ok((await edit({ price_cents: 5400, ship_class: "pickup_only" })).ok, "set pickup only");
  const carriedLocal = await post("/api/orders", { ...base, address: ten, delivery_fee_cents: 1000 });
  ok(carriedLocal.status === 201 && carriedLocal.data.order.service === "Local delivery", "a pickup-only piece can go by local delivery: " + (carriedLocal.data.error || ""));
  const byPost = await post("/api/orders", { ...who, method: "ship", service: "cp-exp", postal: "M5V 2T6", lines: base.lines, address: { line1: "1 Test St", city: "Toronto" } });
  ok(byPost.status === 409 && /pickup only/.test(byPost.data.error || ""), "a pickup-only piece still cannot go by Canada Post");
} finally { await edit({ price_cents: 5400, ship_class: "standard" }); }
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
