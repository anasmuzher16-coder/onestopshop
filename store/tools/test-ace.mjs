// The real stock on view (2026-11-24): Ace hookahs with "Price TBD" can be seen and never bought, the supplier's price is
// never shown anywhere a shopper can reach, shisha and foil sell, the sample hookahs are gone with their links redirected.
// node store/tools/test-ace.mjs   (against the running local store; changes stock: reseed afterwards)
import { readFileSync } from "node:fs";
const B = process.env.BASE || "http://127.0.0.1:4486";
const KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
// each order comes from its own made-up address, as real shoppers do: the per-visitor order limits (src/guard.js) have their own checks in test-orders
const shopper = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;
const post = async body => { const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": shopper() }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const who = { name: "Test Shopper", email: "test@example.com" }, to = { postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" } };
// With no card keys (the live demo) a pickup is paid at the counter, and delivery or shipping is refused with the shop's number.
const CARD = /<meta name="oss-pay" content="card">/.test(await (await fetch(B + "/")).text()), pk = CARD ? {} : { pay: "at_pickup" };
const noKeys = r => r.status === 503 && r.data.pay_off === true && /519-255-2222/.test(r.data.error || "");
const master = JSON.parse(readFileSync(new URL("../catalog/suppliers/ace/master.json", import.meta.url), "utf8"));
// only what the shop ticked is on view (owner, 2026-11-26: a tick means in the shop, in stock; nothing is ordered in)
const tickedFams = master.families.filter(f => f.stamp.v !== "none"), unticked = new Set(master.families.filter(f => f.stamp.v === "none").flatMap(f => f.variants.map(v => v.sku)));
const supplier = new Map(); for (const fam of tickedFams) for (const v of fam.variants) supplier.set(v.sku, fam.supplier_price_cents.v);
const mod = await (await fetch(B + "/api/catalog-module")).text(), { PRODUCTS: P } = await import("data:text/javascript," + encodeURIComponent(mod));
const feed = await (await fetch(B + "/api/catalog")).json(), stockOf = async sku => (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === sku)?.stock;
const ace = P.filter(p => supplier.has(p.sku)), tbd = ace[0];

// 1 on view, never for sale
ok(ace.length === supplier.size, `every ticked Ace colour is on the site: ${ace.length} of ${supplier.size}`);
ok(!P.some(p => unticked.has(p.sku)), `no unticked Ace colour is on the site: ${P.filter(p => unticked.has(p.sku)).length} of ${unticked.size}`);
ok(new Set(ace.filter(p => p.lead).map(p => p.family)).size === tickedFams.length, "one card per ticked Ace family");
ok(ace.every(p => p.state === "tbd" && p.price === null && p.stock === 0), "every Ace item shows Price TBD: no price, no stock count");
for (const body of [{ ...who, ...pk, method: "pickup", lines: [{ sku: tbd.sku, qty: 1 }] }, { ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: tbd.sku, qty: 1, price: 1, unit_cents: 100 }] }]) {
  const r = await post(body); ok(!CARD && body.method === "ship" ? noKeys(r) : r.status === 409 && r.data.not_for_sale === true, `a TBD item is refused by the server (${body.method}): ${r.status} ${r.data.error || ""}`);
}
const shisha = P.find(p => p.cat === "shisha" && p.state === "sale" && p.stock > 1), before = await stockOf(shisha.sku);
const mixed = await post({ ...who, ...pk, method: "pickup", lines: [{ sku: shisha.sku, qty: 1 }, { sku: tbd.sku, qty: 1 }] });
ok(mixed.status === 409 && (await stockOf(shisha.sku)) === before, "a cart mixing a TBD item with a real one is refused whole, and no stock moves");
ok((await post({ ...who, ...pk, method: "pickup", lines: [{ sku: "OSS-1001", qty: 1 }] })).status === 409, "a retired sample hookah cannot be ordered");
// the back office cannot switch a catalogue item on without the shop's own price (the 0005 trigger)
const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const on = await fetch(B + `/api/admin/products/${tbd.sku}`, { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: cookie }, body: JSON.stringify({ active: true }) });
ok(on.status === 409 && /Set the shop price/.test((await on.json().catch(() => ({}))).error || ""), "switching a TBD item on without a price is refused with the reason: " + on.status);
ok((await post({ ...who, ...pk, method: "pickup", lines: [{ sku: tbd.sku, qty: 1 }] })).status === 409, "and it still cannot be ordered afterwards");

// 2 the supplier's price is nowhere a shopper can reach
ok(!/supplier/i.test(mod) && !JSON.stringify(feed).includes("supplier"), "no supplier field in the catalogue module or the public feed");
const leak = (p, cents) => [p.price, p.price_cents].some(v => v != null && Math.round(v * (p.price_cents != null ? 1 : 100)) === cents);
ok(!ace.some(p => leak(p, supplier.get(p.sku))), "no Ace item carries its supplier price in the catalogue module");
ok(!feed.products.filter(p => supplier.has(p.sku)).some(p => p.price_cents !== null || p.for_sale), "the public feed gives TBD items no price and marks them not for sale");
const ALLOWED = ["charcoal", "brand", "variant", "shape", "box_sku", "photo", "description", "ml", "kind", "notes"];
ok(!feed.products.some(p => "facts_known" in p || "availability" in p || "supplier_ref" in p || Object.keys(JSON.parse(p.details || "{}")).some(k => !ALLOWED.includes(k))), "the public feed's details hold only the public keys (no photo rights, sources, research notes or catalogue facts)");
ok(feed.products.filter(p => /^OSS-93/.test(p.sku)).every(p => p.ship_class === "pickup_only"), "the feed says foil is pickup or local delivery while its weight is TBD");
let pageLeak = 0, offers = 0;
for (const p of ace.filter(x => x.lead).slice(0, 25)) {
  const t = await (await fetch(B + "/p/" + p.sku)).text(), c = supplier.get(p.sku); if (!c) continue;
  const d = (c / 100).toFixed(2), w = String(c / 100);
  if (t.includes("$" + d) || t.includes(`"price":"${d}"`) || new RegExp(`\\$${w.replace(".", "\\.")}\\b`).test(t)) pageLeak++;
  if (/"offers"/.test(t)) offers++;
}
ok(pageLeak === 0, "no product page (title, description, share tags, structured data) shows the supplier price: " + pageLeak);
ok(offers === 0, "structured data states no offer for an item without a shop price: " + offers);
const page = await (await fetch(B + "/p/" + tbd.sku)).text();
ok(/og:description" content="[^"]*Price TBD/.test(page) && /og:image" content="[^"]+\/img\/pc\/ace\//.test(page), "a TBD item shares its own photo and says Price TBD");
ok((await fetch(B + "/sitemap.xml")).status === 404, "no sitemap while the shop is not live");

const foilPage = await (await fetch(B + "/p/OSS-9301")).text(), coalPage = await (await fetch(B + "/shop/charcoal")).text(), heatPage = await (await fetch(B + "/shop/heat")).text();
// every promise follows the card switch (2026-11-27): card off, every order is a pickup paid at the counter, so pages say pickup only
const payOn = /<meta name="oss-pay" content="card">/.test(foilPage), counterWords = "Pickup in Windsor, paid in the shop";
ok((payOn ? /og:description" content="[^"]*Not shipped/.test(foilPage) : /og:description" content="[^"]*Pickup in Windsor, paid in the shop/.test(foilPage) && !/og:description" content="[^"]*local delivery/.test(foilPage)) && !/Shipped across Canada/.test(foilPage), "a foil page says pickup or local delivery (card off: pickup only), never shipped, while its weight is TBD");
// shisha is paid at the counter until card payment for it is approved, so its page, search results and the feed say pickup (council, 2026-11-25)
const shishaPage = await (await fetch(B + "/p/OSS-9601")).text();
ok(/og:description" content="[^"]*Pickup in Windsor, paid in the shop/.test(shishaPage) && !/Shipped across Canada/.test(shishaPage) && !/ParcelService/.test(shishaPage), "a shisha page says pickup, paid in the shop, never shipped");
ok(feed.products.filter(p => /^OSS-96/.test(p.sku)).every(p => p.ship_class === "pickup_only"), "the feed says shisha is pickup while it is paid at the counter");
const shishaSec = await (await fetch(B + "/shop/shisha")).text();
ok(/name="description" content="[^"]*Pickup, paid in the shop/.test(shishaSec) && !/shipped across Canada/i.test(shishaSec.match(/name="description" content="[^"]*/)?.[0] || ""), "the Shisha section says pickup, paid in the shop");
ok(new RegExp(`name="description" content="69 kinds of hookah charcoal[^"]*${payOn ? "Pickup or local delivery only" : counterWords}`).test(coalPage), "the Charcoal section says pickup or local delivery only (card off: pickup, paid in the shop)");
// Heat holds the 15 foil packs and 18 Ace accessories (2026-11-26); every weight is TBD, so the section is
// pickup or local delivery, and says so. It says "shipped" again once anything in it can ship.
ok(new RegExp(`name="description" content="33 foil and heat items at our Windsor counter\\. ${payOn ? "Pickup or local delivery only" : counterWords}`).test(heatPage), "Heat (foil and accessories, weight TBD) says pickup or local delivery only (card off: pickup, paid in the shop)");
const shPage = await (await fetch(B + "/shop/shisha")).text(); ok(/content="47 shisha/.test(shPage), "the shisha section counts its 47 flavours");
// 3 the sample hookahs are gone, their links land on the section
const r1 = await fetch(B + "/p/OSS-1001", { redirect: "manual" });
ok(r1.status === 301 && new URL(r1.headers.get("location")).pathname === "/shop/hookahs", "an old sample hookah link redirects to /shop/hookahs: " + r1.status);
ok(!P.some(p => /^OSS-1\d{3}$/.test(p.sku)), "no sample hookah is left on the site");
ok((await fetch(B + "/p/OSS-9999999", { redirect: "manual" })).status === 404, "an unknown item is still a real 404");

// 4 shisha sells like any product; foil sells for pickup or local delivery until its weight is known
// Shisha is paid at the counter until the card company approves it (payments, docs/PAYMENTS.md; STRIPE_TOBACCO_OK unset here):
// shipping it by card is refused with that reason, and a pickup paid at the counter sells it at the shop's price.
const shCard = await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: shisha.sku, qty: 1 }] });
ok(CARD ? shCard.status === 409 && shCard.data.counter_only === true : noKeys(shCard), `shisha is not taken by card while the card company has not approved it: ${shCard.status} ${shCard.data.error || ""}`);
const sh = await post({ ...who, method: "pickup", pay: "at_pickup", lines: [{ sku: shisha.sku, qty: 1 }] });
ok(sh.status === 201 && sh.data.order.subtotal_cents === Math.round(shisha.price * 100), `shisha sells at the shop's price, paid at the counter: ${sh.status} ${sh.data.error || ""}`);
ok(P.filter(p => p.cat === "shisha").length === 47 && P.filter(p => p.cat === "shisha" && p.stock === 0).length === 3, "all 47 shisha flavours are up, 3 sold out");
const sold = P.find(p => p.cat === "shisha" && p.stock === 0); ok((await post({ ...who, ...pk, method: "pickup", lines: [{ sku: sold.sku, qty: 1 }] })).status === 409, "a sold-out flavour cannot be ordered");
const foil = P.filter(p => p.weightTbd && p.cat === "heat" && !p.acc && !(p.details && p.details.charcoal));   // Ace accessories (acc) are Price TBD, not on sale   // charcoal now carries its catalogue facts too (weight unknown), and is pickup or local by its own rule
ok(foil.length === 15 && foil.every(p => p.state === "sale" && p.ship === "pickup_only"), "15 foil packs on sale, pickup or local delivery while the weight is TBD");
{ const r = await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: foil[0].sku, qty: 1 }] }); ok(CARD ? r.data.local_only === true : noKeys(r), "foil cannot be sent by a carrier on a made-up weight: " + r.status); }
ok((await post({ ...who, ...pk, method: "pickup", lines: [{ sku: foil[0].sku, qty: 1 }] })).status === 201, "foil can be picked up");

// 5 bad input is refused before anything else
for (const bad of [[{ sku: tbd.sku, qty: 0 }], [{ sku: tbd.sku, qty: 1.5 }], [{ sku: { $ne: 1 }, qty: 1 }], [{ sku: "OSS-100024' OR 1=1 --", qty: 1 }]]) {
  const r = await post({ ...who, ...pk, method: "pickup", lines: bad }); ok(r.status === 400 || r.status === 409, "odd line refused: " + JSON.stringify(bad) + " " + r.status);
}
console.log(`${n - f}/${n} passed`); process.exit(f ? 1 : 0);
