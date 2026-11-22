// Local delivery checks: the fee at every edge, then the running local store with the stand-in map service.
// Needs tools/fake-geoapify.mjs and the store on 4420 with GEOAPIFY_KEY:test and GEOAPIFY_BASE. Changes local sample data.
import { deliveryFee } from "../public/rates-core.js";
const B = process.env.BASE || "http://127.0.0.1:4420";
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
for (const [m, want] of [[0, 1000], [500, 1000], [10000, 1000], [10000.01, 1500], [10010, 1500], [25000, 1500], [25000.01, null], [25010, null], [-1, null], [NaN, null], [Infinity, null]]) ok(deliveryFee(m) === want, `fee at ${m} m is ${want}, got ${deliveryFee(m)}`);
const run = Date.now() % 1000;
const post = async (path, body) => { const r = await fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const check = (line1, postal = "N9A 1A1") => post("/api/delivery", { line1, city: "Windsor", postal });
const cases = [[`7 D10000 ${run} St`, "ok", 1000], [`7 D10000_1 ${run} St`, "ok", 1500], [`7 D25000 ${run} St`, "ok", 1500], [`7 D25000_1 ${run} St`, "far"], [`Unit 2, 7 D3000 ${run} St`, "ok", 1000], [`1-7 D3001 ${run} St`, "ok", 1000], [`D3002 ${run} St`, "unsure"], [`9 WRONGNUM ${run}`, "unsure"], [`9 ROADSAME ${run}`, "ok", 1000], [`9 ROADSPLIT ${run}`, "unsure"], [`9 NOBOX ${run}`, "unsure"], [`7 NOTFOUND ${run}`, "unsure"], [`7 MAPDOWN ${run}`, "down"], [`7 DETROIT ${run}`, "unsure"], [`7 WRONGPC ${run}`, "unsure"], [`7 VAGUE ${run}`, "unsure"]];
const wait = () => new Promise(r => setTimeout(r, 4100));
for (const [line, status, fee] of cases) { await wait(); const r = await check(line); ok(r.data.status === status && (fee === undefined || r.data.fee_cents === fee), `${line}: wanted ${status} ${fee ?? ""}, got ${JSON.stringify(r.data)}`); ok(!("metres" in r.data), "the shopper is not sent the distance"); }
await new Promise(r => setTimeout(r, 61000));
ok((await check(`7 D5000 ${run} St`, "M5V 2T6")).data.status === "far", "a Toronto postal code is out of the delivery area");
for (const [a, b] of [[`7 D4000 ${run} St`, `7-D4000 ${run} St`]]) ok((await check(a)).data.status === "ok" && (await check(b)).data.status === "unsure", "addresses that differ only by punctuation do not share an answer");
const who = { name: "Dee Livery", email: "dee@example.com", phone: "519-555-0101" }, base = { ...who, method: "ship", service: "local", postal: "N9A 1A1", lines: [{ sku: "OSS-8004", qty: 1 }] };
const at = line1 => ({ line1, city: "Windsor" });
const good = await post("/api/orders", { ...base, address: at(`7 D12500 ${run} St`), delivery_fee_cents: 1500 });
ok(good.status === 201, "delivery order placed: " + good.status + " " + (good.data.error || ""));
if (good.status === 201) { const o = good.data.order; ok(o.shipping_cents === 1500 && o.service === "Local delivery", "fee and service on the order"); ok(o.tax_cents === Math.round((o.subtotal_cents + 1500) * 0.13) && o.total_cents === o.subtotal_cents + 1500 + o.tax_cents, "HST on items plus delivery"); }
const forged = await post("/api/orders", { ...base, address: at(`7 D12500 ${run} St`), delivery_fee_cents: 1000 });
ok(forged.status === 409 && forged.data.delivery === "ok" && forged.data.fee_cents === 1500, "a forged lower fee is refused and the real one returned");
ok((await post("/api/orders", { ...base, address: at(`7 D25000_1 ${run} St`), delivery_fee_cents: 1500 })).status === 409, "past 25 km cannot be ordered");
ok((await post("/api/orders", { ...base, address: at(`7 MAPDOWN ${run}x`), delivery_fee_cents: 1000 })).status === 409, "map service down: no delivery order");
ok((await post("/api/orders", { ...base, phone: "", address: at(`7 D5000 ${run} St`), delivery_fee_cents: 1000 })).data.field === "phone", "delivery needs a phone number");
ok((await post("/api/orders", { ...base, postal: "M5V 2T6", address: at(`7 D5000 ${run} St`), delivery_fee_cents: 1000 })).status === 409, "a Toronto postal code cannot get local delivery");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
