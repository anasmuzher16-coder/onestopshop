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

// a glass piece to Toronto: shipping must equal the mockup's verified engine, tax must be Ontario HST on items plus shipping.
// (The sample hookahs were retired on 2026-11-24 and the Ace hookahs have no shop price yet, so a glass base stands in.)
const hk = PRODUCTS.find(p => p.sku === "OSS-2001"), ref = quote(parsePostal("M5V 2T6"), pack([{ product: hk, qty: 1 }]), fuelOn().pct).find(o => o.id === "cp-exp");
const before = await stockOf("OSS-2001");
const a = await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-2001", qty: 1, price: 1, unit_cents: 1 }], total_cents: 1 });
ok(a.status === 201, "ship order placed: " + a.status + " " + (a.data.error || ""));
if (a.status === 201) {
  const o = a.data.order;
  ok(o.subtotal_cents === 30900, "price comes from the database, not the request: " + o.subtotal_cents);
  ok(o.shipping_cents === Math.round(ref.total * 100), `shipping ${o.shipping_cents} equals the verified engine ${Math.round(ref.total * 100)}`);
  ok(o.tax_cents === Math.round((o.subtotal_cents + o.shipping_cents) * 0.13) && o.total_cents === o.subtotal_cents + o.shipping_cents + o.tax_cents, "Ontario HST 13% on items plus shipping");
  ok(/^W[A-Z0-9]{6}$/.test(o.id), "order code " + o.id);
  ok((await stockOf("OSS-2001")) === before - 1, "stock came down by one");
}
// Alberta: GST 5%. Nova Scotia: 14%.
const ab = await post({ ...who, postal: "T2P 1J9", address: { line1: "2 Test Ave", city: "Calgary" }, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-8003", qty: 1 }] });
ok(ab.status === 201 && ab.data.order.tax_cents === Math.round((ab.data.order.subtotal_cents + ab.data.order.shipping_cents) * 0.05) && ab.data.order.tax_label === "GST 5%", "Alberta charges GST 5%");
const ns = await post({ ...who, postal: "B3H 1A1", address: { line1: "3 Test Rd", city: "Halifax" }, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-8004", qty: 1 }] });
ok(ns.status === 201 && ns.data.order.tax_label === "HST 14%", "Nova Scotia charges HST 14%");
// Quebec: no carrier shipping until the site is in French (plan section 8); nothing is held for the refused order
const qc = await post({ ...who, postal: "H2Y 1C6", address: { line1: "4 Rue Test", city: "Montreal" }, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-8004", qty: 1 }] });
ok(qc.status === 409 && qc.data.quebec === true && !qc.data.order, "Quebec is refused for shipping, in words: " + qc.status);
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
const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) }), cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const orders = (await (await fetch(B + "/api/admin/orders", { headers: { Cookie: cookie } })).json()).orders;
ok(a.status === 201 && orders.some(o => o.id === a.data.order.id && o.status === "pending" && o.pay_status === "awaiting"), "before payment the order waits, not To pack");
if (a.data.pay?.url) await fetch(a.data.pay.url, { method: "POST", redirect: "manual" });   // pay on the Stripe stand-in: its signed webhook marks the order paid
const paidNow = (await (await fetch(B + "/api/admin/orders", { headers: { Cookie: cookie } })).json()).orders;
ok(a.status === 201 && paidNow.some(o => o.id === a.data.order.id && o.status === "paid"), "once paid, the new order is in the back office as To pack");
const hist = (await (await fetch(B + "/api/admin/products/OSS-2001/history", { headers: { Cookie: cookie } })).json()).moves;
ok(hist[0].reason === "sale" && hist[0].delta === -1, "the sale is in the stock history");
const lost = orders.filter(o => o.status === "pending" && !["awaiting", "pay_at_pickup"].includes(o.pay_status)).length; ok(lost === 0, "no half-made orders left behind (orders waiting on a payment are not half-made): " + lost);

// CHARCOAL (owner, 2026-11-24): pickup or our own local delivery only, never Canada Post or any carrier, and no age or ID
// step anywhere a customer can see (staff check ID in person).
const cat = await (await fetch(B + "/api/catalog")).json(), coal = cat.products.filter(p => p.category_id === "charcoal" && JSON.parse(p.details).charcoal === true), foilFeed = cat.products.filter(p => p.category_id === "heat" && /foil/i.test(p.name));
const coalSku = "OSS-9104", c0 = await stockOf(coalSku);
ok(coal.length === 69 && coal.every(p => p.ship_class === "pickup_only"), "the Charcoal section holds the shop's 69 charcoal items, all pickup or local delivery only: " + coal.length);
ok(foilFeed.length === 15 && foilFeed.every(p => p.for_sale), "and Heat its 15 foil packs (since 2026-11-24): " + foilFeed.length);
{ const back = cat.products.filter(p => /^OSS-40/.test(p.sku)); ok(back.length > 0 && back.every(p => p.category_id === "heat" && p.ship_class === "standard" && !JSON.parse(p.details || "{}").charcoal), "the Heat pieces hidden when charcoal moved in are back in Heat, shippable and not charcoal: " + back.map(p => p.sku).join(",")); }
ok(coal.every(p => p.stock === 10), "every charcoal item starts at 10 in stock");
// regression: no carrier service, on its own or mixed in, ever turns charcoal into a shipped order
const carrierIds = [...new Set(quote(parsePostal("M5V 2T6"), pack([{ product: PRODUCTS.find(p => p.sku === "OSS-1001"), qty: 1 }]), fuelOn().pct).map(o => o.id))];
ok(carrierIds.length >= 2, "the carrier services to try: " + carrierIds.join(","));
// an item moved into Charcoal in the back office is charcoal by its section, with or without the flag (breaker, 2026-11-24)
{ const was = cat.products.find(p => p.sku === "OSS-8003").category_id, put = c => fetch(B + "/api/admin/products/OSS-8003", { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify({ category_id: c }) });
  const mv = await put("charcoal"), moved = await post({ ...who, ...to, method: "ship", service: carrierIds[0], lines: [{ sku: "OSS-8003", qty: 1 }] });
  ok(mv.status === 200 && moved.status === 409 && moved.data.local_only === true, `an item moved into Charcoal cannot go by carrier: ${mv.status} ${moved.status}`);
  await put(was); }
// and the other way: an item from the charcoal list moved out of Charcoal (to Heat, marked standard with a weight) stays
// pickup or local delivery only (breaker, 2026-11-24)
{ const put = body => fetch(B + "/api/admin/products/OSS-9102", { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify(body) });
  const mv = await put({ category_id: "heat", ship_class: "standard", weight_g: 50 }), out = await post({ ...who, ...to, method: "ship", service: carrierIds[0], lines: [{ sku: "OSS-9102", qty: 1 }] });
  const feed = (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === "OSS-9102");
  ok(mv.status === 200 && out.status === 409 && out.data.local_only === true && feed.ship_class === "pickup_only" && JSON.parse(feed.details).charcoal === true, `charcoal moved out of Charcoal still cannot go by carrier: ${mv.status} ${out.status} ${feed.ship_class}`);
  await put({ category_id: "charcoal" }); }
for (const service of [...carrierIds, "cp-nope", undefined]) {
  const r = await post({ ...who, ...to, method: "ship", service, lines: [{ sku: coalSku, qty: 1 }] });
  ok(r.status === 409 && /cannot be shipped/.test(r.data.error || "") && !r.data.order, `charcoal cannot be shipped by ${service}: ${r.status}`);
  const m = await post({ ...who, ...to, method: "ship", service, lines: [{ sku: "OSS-8003", qty: 1 }, { sku: coalSku, qty: 1 }] });
  ok(m.status === 409 && m.data.sku === coalSku && !m.data.order, `a mixed cart cannot ship the charcoal by ${service}: ${m.status}`);
}
ok((await stockOf(coalSku)) === c0, "refused charcoal orders take no stock");
const localCoal = await post({ ...who, phone: "519-555-0101", postal: "N9A 1A1", address: { line1: "7 D3000 Coal St", city: "Windsor" }, method: "ship", service: "local", delivery_fee_cents: 1000, lines: [{ sku: coalSku, qty: 1 }, { sku: "OSS-8003", qty: 1 }] });
ok(localCoal.status === 201 && localCoal.data.order.service === "Local delivery" && localCoal.data.order.shipping_cents === 1000, "charcoal can come by our own local delivery, with the rest of the order: " + localCoal.status + " " + (localCoal.data.error || ""));
const coalOk = await post({ ...who, method: "pickup", lines: [{ sku: coalSku, qty: 1 }, { sku: "OSS-8003", qty: 1 }] });
ok(coalOk.status === 201 && coalOk.data.order.method === "pickup", "charcoal picked up goes through with no age step: " + coalOk.status + " " + (coalOk.data.error || ""));
ok(coalOk.data.order?.subtotal_cents === 1199 + 2195, "charcoal is charged the shop's price: " + coalOk.data.order?.subtotal_cents);
ok(!/\bage\b|photo id|legal age|age_/i.test(JSON.stringify(coalOk.data)), "the order answer says nothing about age or ID");if (coalOk.status === 201) {
  const seen = await (await fetch(B + "/api/admin/orders/" + coalOk.data.order.id, { headers: { Cookie: cookie } })).json();
  ok(seen.items.some(i => i.category_id === "charcoal"), "the back office can tell a charcoal order (for its staff-only ID note)");
  if (coalOk.data.pay?.url) await fetch(coalOk.data.pay.url, { method: "POST", redirect: "manual" });   // paid on the Stripe stand-in first
  await fetch(B + "/api/admin/orders/" + coalOk.data.order.id + "/status", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify({ status: "ready" }) });
  const mails = (await (await fetch(B + "/api/admin/orders/" + coalOk.data.order.id, { headers: { Cookie: cookie } })).json()).emails;
  ok(mails.length === 3 && ["order_placed", "new_order", "pickup_ready"].every(k => mails.some(m => m.kind === k)), "the receipt, the shop's new-order note and the ready-for-pickup email are written: " + mails.map(m => m.kind).join(","));
  for (const m of mails) { const e = (await (await fetch(B + "/api/admin/emails/" + m.id, { headers: { Cookie: cookie } })).json()).email; ok(!/\bID\b/.test(e.html + e.subject) && !/photo id|\bage\b|adult/i.test(e.html + e.subject), `the customer's ${m.kind} email says nothing about age or ID`); }
}
const mod = await (await fetch(B + "/api/catalog-module")).text();
ok(!/MinAge|age_check|RULES/.test(mod), "no age setting reaches the storefront");
// saving a charcoal item in the back office keeps its charcoal mark and photo status (the form only edits cologne fields)
const put = await fetch(B + "/api/admin/products/" + coalSku, { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify({ note: "Edited in the back office", details: {} }) });
const after = (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === coalSku);
ok(put.ok && JSON.parse(after.details).charcoal === true && JSON.parse(after.details).photo === "approved", "an admin save keeps the charcoal mark and photo status");
// charcoal added in the back office, even sent as "standard" with no details, takes the pickup rule from its section
const made = await (await fetch(B + "/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify({ name: "Back office charcoal", category_id: "charcoal", price_cents: 1500, weight_g: 1000, box_id: "XS", ship_class: "standard", details: {}, stock: 5 }) })).json();
const madeRow = (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === made.sku);
ok(madeRow && madeRow.ship_class === "pickup_only" && JSON.parse(madeRow.details).charcoal === true, "charcoal added in the back office is stored as pickup only: " + made.sku);
ok((await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: made.sku, qty: 1 }] })).status === 409, "back-office charcoal cannot be shipped");
await fetch(B + "/api/admin/products/" + made.sku, { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify({ ship_class: "standard" }) });
ok((await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: made.sku, qty: 1 }] })).status === 409, "switching it to standard in the back office still cannot ship it");
// a Heat piece saved in the back office stays what it was: never turned into charcoal
await fetch(B + "/api/admin/products/OSS-4009", { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify({ note: "Hammered copper and steel", details: {} }) });
const old = (await (await fetch(B + "/api/admin/products", { headers: { Cookie: cookie } })).json()).products.find(p => p.sku === "OSS-4009");
ok(old && old.ship_class === "standard" && !JSON.parse(old.details || "{}").charcoal, "a Heat piece saved in the back office is not made charcoal: " + (old && old.ship_class));console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
