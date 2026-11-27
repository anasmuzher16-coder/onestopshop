// Local delivery checks: the fee at every edge, then the running local store with the stand-in map service.
// Needs tools/fake-geoapify.mjs and the store on 4420 with GEOAPIFY_KEY:test and GEOAPIFY_BASE. Changes local sample data.
import { samplesOn } from "./fixtures/samples-on.mjs";
import { readFileSync } from "node:fs";
import { deliveryFee, localDue, localEta, localArea, parsePostal } from "../public/rates-core.js";
const B = process.env.BASE || "http://127.0.0.1:4420", MAP = process.env.MAP || "http://127.0.0.1:4499";
// the made-up sample rows this suite buys, switched back on in its own throwaway database (tools/fixtures/samples-on.mjs)
await samplesOn(B, ["OSS-8004"]);
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
for (const [m, want] of [[0, 1000], [500, 1000], [10000, 1000], [10000.01, 1500], [10010, 1500], [25000, 1500], [25000.01, null], [25010, null], [-1, null], [NaN, null], [Infinity, null]]) ok(deliveryFee(m) === want, `fee at ${m} m is ${want}, got ${deliveryFee(m)}`);
for (const [sub, want] of [[0, 1500], [19999, 1500], [20000, 0], [20001, 0]]) ok(localDue(1500, sub) === want, `items of ${sub} cents pay ${want}`);
// November in Windsor is UTC-5. 2026-11-22 is a Sunday (open 11 to 7); Monday is open 10 to 9.
for (const [at, want] of [["2026-11-22T15:59:00Z", "this morning"], ["2026-11-22T16:00:00Z", "25 minutes"], ["2026-11-22T23:59:00Z", "25 minutes"], ["2026-11-23T00:00:00Z", "tomorrow morning"], ["2026-11-23T07:00:00Z", "this morning"], ["2026-11-23T15:00:00Z", "25 minutes"], ["2026-11-24T01:59:00Z", "25 minutes"], ["2026-11-24T02:00:00Z", "tomorrow morning"]]) ok(localEta(new Date(at)).includes(want), `at ${at} wanted "${want}", got "${localEta(new Date(at))}"`);
ok(localEta(new Date("2026-11-23T15:00:00Z")) === "Arrives in about 25 minutes to 1 hour", "open-hours wording is exact");
for (const code of ["N8R 1A2", "N8N 1W9", "N8L 1A1", "N9K 1A1", "N0R 1A0", "N8M 1A8", "N8H 1A1", "N0P 1A0", "N9Y 1A1"]) ok(localArea(parsePostal(code)), `${code} is left for the road distance to decide`);
const routeCount = async () => (await (await fetch(MAP + "/__routes")).json()).routes;
const run = Date.now() % 1000;
// each order comes from its own made-up address, as real shoppers do: the per-visitor order limits (src/guard.js) have their own checks in test-orders
const shopper = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;
const post = async (path, body) => { const r = await fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json", ...(path === "/api/orders" ? { "CF-Connecting-IP": shopper() } : {}) }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const check = (line1, postal = "N9A 1A1") => post("/api/delivery", { line1, city: "Windsor", postal });
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
for (const [a, b] of [[`7 D4000 ${run} St`, `7-D4000 ${run} St`]]) ok((await check(a)).data.status === "ok" && (await check(b)).data.status === "unsure", "addresses that differ only by punctuation do not share an answer");
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
