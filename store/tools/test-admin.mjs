// Back office checks against the running local store: sign-in wall, shop numbers, stock changes, product edits,
// order steps, photo upload. Reads the local passcode from .dev.vars. node store/tools/test-admin.mjs
import { samplesOn } from "./fixtures/samples-on.mjs";
import { readFileSync } from "node:fs";
import { seededProductCount } from "./seed-files.mjs";
const B = process.env.BASE || "http://127.0.0.1:4420";
// the made-up sample rows this suite buys, switched back on in its own throwaway database (tools/fixtures/samples-on.mjs)
await samplesOn(B, ["OSS-7001", "OSS-7002", "OSS-7003", "OSS-7004", "OSS-7006", "OSS-7008", "OSS-8004"]);
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0, cookie = "";
const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const call = async (path, { method = "GET", body, marker = true, type = "application/json", raw, origin } = {}) => {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body !== undefined) { headers["Content-Type"] = type; if (marker) headers["X-OSS-Admin"] = "1"; } if (origin) headers.Origin = origin;
  const r = await fetch(B + "/api/admin" + path, { method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})), r };
};
// the wall
for (const p of ["/summary", "/products", "/orders", "/orders/S1001", "/orders/find?q=S1001", "/orders?before=2026-01-01T00:00:00Z%7CS1001"]) ok((await call(p)).status === 401, p + " must need sign-in");
ok((await call("/orders/bulk-cancel", { method: "POST", body: { ids: ["S1001"], confirm: 1 } })).status === 401, "bulk cancel must need sign-in");
ok((await call("/products/OSS-1001/stock", { method: "POST", body: { delta: 1 } })).status === 401, "stock change must need sign-in");
ok((await call("/login", { method: "POST", body: { passcode: "wrong" } })).status === 401, "wrong passcode refused");
// the preview's open edit (src/preview.js): off, its address is refused; at "items" the wall above still stands (this suite runs as test-admin+openitems too)
if (!process.env.EXPECT_OPEN) ok((await fetch(B + "/api/open-edit/OSS-1001")).status === 404 && (await fetch(B + "/api/open-edit/OSS-1001", { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: '{"price_cents":100}' })).status === 404, "open edit off: its address is refused");
else ok((await call("/products/OSS-1001/info", { method: "PUT", body: { price_cents: 100 } })).status === 401 && (await call("/me")).status === 401, "open edit at items: the back office itself still needs sign-in");
const login = await call("/login", { method: "POST", body: { passcode: KEY } });
ok(login.status === 200 && /HttpOnly/.test(login.r.headers.get("set-cookie") || "") && /SameSite=Strict/.test(login.r.headers.get("set-cookie") || ""), "sign-in sets a locked-down cookie");
cookie = (login.r.headers.get("set-cookie") || "").split(";")[0];
{ // the order list: every open order, then finished ones a page at a time; find by number (2026-11-27)
  const l = (await call("/orders")).data, open = l.orders.filter(o => !["shipped", "collected", "cancelled", "refunded"].includes(o.status));
  ok(typeof l.open_count === "number" && open.length === l.open_count && "finished_more" in l, "the order list says how many are open and how to get older finished ones: " + l.open_count);
  const any = l.orders[0]; ok(!any || (await call("/orders/find?q=" + encodeURIComponent(any.id.toLowerCase()))).data.orders?.some(o => o.id === any.id), "find by order number"); }
ok((await call("/products/OSS-1001/stock", { method: "POST", body: { delta: 1 }, marker: false })).status === 400, "write without the request marker refused");
ok((await call("/products/OSS-1001/stock", { method: "POST", body: { delta: 1 }, origin: "https://evil.example" })).status === 403, "write from another site refused");

// numbers
const s = (await call("/summary")).data;
ok(s.totals && s.totals.month_orders > 20 && s.totals.month_cents > 0, "summary has 30-day totals");
ok(s.daily.reduce((a, d) => a + d.cents, 0) === s.totals.month_cents || s.daily.length > 0, "daily series present");
ok(s.top.length > 0 && s.top[0].cents >= s.top[s.top.length - 1].cents, "best sellers sorted");
ok(s.value.units > 0 && s.value.retail_cents > s.value.cost_cents, "stock value present");

// stock: up, down, never below zero, history
const list = (await call("/products")).data; const p = list.products.find(x => x.sku === "OSS-8004"), start = p.stock;
// every product the seed files insert (samples kept but switched off, charcoal, foil, shisha, Ace colours), counted from the seed itself; Shisha is the ninth section
const SEEDED = seededProductCount();
ok(list.products.length === SEEDED && list.categories.length === 10 && list.categories.some(c => c.id === "charcoal"), `catalogue ${list.products.length} products (seed has ${SEEDED}), ${list.categories.length} sections`);
const up = await call("/products/OSS-8004/stock", { method: "POST", body: { delta: 3, reason: "received" } }); ok(up.data.stock === start + 3, "stock +3");
const dn = await call("/products/OSS-8004/stock", { method: "POST", body: { delta: -3, reason: "correction" } }); ok(dn.data.stock === start, "stock -3");
const neg = await call("/products/OSS-8004/stock", { method: "POST", body: { delta: -(start + 1) } }); ok(neg.status === 409 && neg.data.stock === start, "stock cannot go below zero: " + neg.status);
const hist = (await call("/products/OSS-8004/history")).data.moves; ok(hist[0].delta === -3 && hist[1].delta === 3 && hist[1].reason === "received", "history records both moves and no refused one");
const both = await Promise.all([1, 2, 3, 4, 5, 6].map(() => call("/products/OSS-8004/stock", { method: "POST", body: { delta: -Math.ceil(start / 2) } })));
const after = (await call("/products")).data.products.find(x => x.sku === "OSS-8004").stock;
ok(after >= 0 && both.filter(r => r.status === 200).length === Math.floor(start / Math.ceil(start / 2)), `six taps at once never oversell (ended at ${after})`);
await call("/products/OSS-8004/stock", { method: "POST", body: { delta: start - after, reason: "correction" } });

// edit, validation, create
ok((await call("/products/OSS-8004", { method: "PUT", body: { price_cents: -5 } })).status === 400, "negative price refused");
ok((await call("/products/OSS-8004", { method: "PUT", body: { category_id: "nope" } })).status === 400, "unknown section refused");
ok((await call("/products/OSS-8004", { method: "PUT", body: { ship_class: "by-rocket" } })).status === 400, "unknown shipping type refused");
ok((await call("/products/OSS-8004", { method: "PUT", body: { price_cents: 549, note: 'Clips <b>on</b> "tight"' } })).status === 200, "edit saved");
const mod = await (await fetch(B + "/api/catalog-module")).text(), m = await import("data:text/javascript;base64," + Buffer.from(mod).toString("base64"));
const sp = m.PRODUCTS.find(x => x.sku === "OSS-8004"); ok(sp.price === 5.49 && sp.note === 'Clips <b>on</b> "tight"', "storefront sees the edit");
await call("/products/OSS-8004", { method: "PUT", body: { price_cents: 5400, note: "Soy candle, salted caramel, 50 hour burn" } });
ok(m.PRODUCTS.filter(x => x.cat === "cologne").every(x => x.ship === "ground_only" && x.details.ml > 0), "cologne is ground only with a size");
const made = await call("/products", { method: "POST", body: { name: "Test bottle", category_id: "cologne", price_cents: 4200, weight_g: 300, box_id: "XS", ship_class: "ground_only", details: { ml: 50, kind: "Eau de parfum", notes: "Test" }, stock: 2, active: false } });
ok(made.status === 201 && /^OSS-70\d\d$/.test(made.data.sku), "new product gets a number in its section: " + made.data.sku);
ok((await call("/products", { method: "POST", body: { name: "", category_id: "misc" } })).status === 400, "product with no name refused");
// photo
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
ok((await call(`/products/${made.data.sku}/photo`, { method: "POST", body: Buffer.from("not an image at all, just text padded out ".repeat(8)), raw: true, type: "image/png" })).status === 415, "a file that is not a photo is refused");
const big = Buffer.concat([png, Buffer.alloc(300)]);
ok((await call(`/products/${made.data.sku}/photo`, { method: "POST", body: big, raw: true, type: "image/png" })).status === 200, "photo upload accepted");
const ph = await fetch(`${B}/api/photo/${made.data.sku}`); ok(ph.status === 200 && ph.headers.get("content-type") === "image/png", "uploaded photo is served");
// orders
const orders = (await call("/orders")).data.orders, paid = orders.find(o => o.status === "paid" && o.method === "ship");
ok(orders.length >= 50, "orders listed: " + orders.length);
if (paid) {
  ok((await call(`/orders/${paid.id}/status`, { method: "POST", body: { status: "shipped" } })).status === 409, "cannot skip packing");
  ok((await call(`/orders/${paid.id}/status`, { method: "POST", body: { status: "packed" } })).status === 200, "mark packed");
  ok((await call(`/orders/${paid.id}`)).data.order.status === "packed", "order shows packed");
} else ok(false, "no paid shipping order in the sample data to test with");
// ---- the item editor: name, colours, shelf count and price, filled in by the shop item by item (2026-11-26) ----
{
  const all = (await call("/products")).data.products, needN = all.filter(x => x.needs).length;
  const t = all.find(x => x.catalogue && !x.family?.startsWith("ace-") && x.needs && ["price", "colours", "stock"].every(k => x.needs.includes(k)) && x.listed === 1 && x.active === 0);
  const hk = all.find(x => x.catalogue && x.family?.startsWith("ace-") && x.needs && x.sku !== t?.sku);
  ok(t && hk && needN > 2, `"needs info" lists unpriced, uncoloured, uncounted catalogue items (${needN})`);
  ok(!all.some(x => x.needs && (x.sample || x.availability === "dropped")), "a made-up sample or a dropped colour never needs info");
  ok(!all.some(x => "supplier_id" in x || "facts_known" in x), "the list carries no supplier columns");
  const info = (sku, body, o = {}) => call(`/products/${sku}/info`, { method: "PUT", body, ...o });
  const row = async sku => (await call("/products")).data.products.find(x => x.sku === sku);
  // refused before anything is written: bad price, bad stock, bad colours, empty name
  for (const [body, what] of [[{ price_cents: -5 }, "negative price"], [{ price_cents: 0 }, "zero price"], [{ price_cents: "24.99" }, "price as text"], [{ price_cents: 12.5 }, "price in part cents"], [{ price_cents: 5000001 }, "price over $50,000"],
    [{ stock: { counted: -1, seen: t.stock } }, "negative stock"], [{ stock: { counted: 2.5, seen: t.stock } }, "stock in parts"], [{ stock: { counted: "4", seen: t.stock } }, "stock as text"], [{ stock: { counted: 4 } }, "a count without the number it was counted against"],
    [{ colours: ["<b>Red</b>"] }, "a colour with code in it"], [{ colours: Array.from({ length: 17 }, (_, i) => "Red" + "abcdefghijklmnopq"[i]) }, "17 colours"], [{ colours: [{ name: "Teal", hex: "javascript:x" }] }, "a swatch that is not a colour"], [{ colours: "Red" }, "colours not as a list"],
    [{ name: "  " }, "an empty name"], [{ name: "x".repeat(81) }, "a name over 80"], [{ name: "Fine", price_cents: -1 }, "a good field beside a bad one"]]) ok((await info(t.sku, body)).status === 400, "item editor refuses " + what);
  const same = await row(t.sku); ok(same.price_cents === t.price_cents && same.stock === t.stock && same.details === t.details && same.name === t.name, "nothing was written by a refused save");
  ok((await info(t.sku, { name: "X" }, { marker: false })).status === 400 && (await info(t.sku, { name: "X" }, { origin: "https://evil.example" })).status === 403 && (await info("OSS-999999", { name: "X" })).status === 404, "item editor: request marker, same site and a real item");
  { const dirty = "\u202eBay\n\tLeaf\u2069 Tray\u0001 (No. 5)", r = await info(t.sku, { name: dirty });
    ok(r.status === 200 && (await row(t.sku)).name === "Bay Leaf Tray (No. 5)", "item editor cleans a name of direction overrides, controls, newlines and tabs", (await row(t.sku)).name);
    ok((await info(t.sku, { name: "\u202e\n" })).status === 400, "item editor refuses a name with nothing visible in it"); await info(t.sku, { name: t.name }); }
  // staff fill in name, colours and the shelf count; the price is the owner's
  const sname = "Rami" + Array.from({ length: 4 }, () => "abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 23)]).join("");
  ok((await call("/staff", { method: "POST", body: { name: sname, pin: "593024" } })).status === 201, "owner adds a staff member for the editor");
  const ownerCookie = cookie; cookie = "";
  ok((await info(t.sku, { name: "X" })).status === 401, "item editor needs sign-in");
  const sl = await call("/login", { method: "POST", body: { name: sname, pin: "593024" } }); cookie = (sl.r.headers.get("set-cookie") || "").split(";")[0];
  ok(sl.status === 200 && sl.data.owner === false, "staff signed in: " + sl.status);
  ok((await info(t.sku, { price_cents: 2499 })).status === 403, "staff cannot set a price in the item editor");
  ok((await info(t.sku, { name: "Renamed by staff", price_cents: 2499, colours: ["Black"] })).status === 403, "a staff save carrying a price change is refused whole");
  ok((await row(t.sku)).name === t.name, "nothing from the refused staff save was written");
  const sv = await info(t.sku, { name: t.name + " (shop)", colours: [{ name: "Black" }, "Rose gold", "rose  GOLD", { name: "Teal", hex: "#1A8F8C" }], stock: { counted: 4, seen: t.stock } });
  ok(sv.status === 200 && sv.data.stock === 4 && sv.data.counted === true && sv.data.on_sale === false, "staff save name, colours and shelf count: " + JSON.stringify(sv.data));
  const s1 = await row(t.sku), d1 = JSON.parse(s1.details || "{}");
  ok(s1.name === t.name + " (shop)" && JSON.stringify(d1.colours) === '["Black","Rose gold","Teal"]' && d1.colour_hex?.Teal === "#1a8f8c" && !d1.colour_hex?.Black && s1.stock === 4 && s1.availability === "counted", "saved: name, colours once each (custom swatch kept), count, counted: " + s1.details);
  ok(JSON.stringify(s1.needs) === '["price"]', "after the staff save only the price is still needed: " + JSON.stringify(s1.needs));
  ok((await info(t.sku, { stock: { counted: 9, seen: 3 } })).status === 409 && (await row(t.sku)).stock === 4, "a count against an old number is refused, so a sale is never counted away");
  const st = (await call(`/products/${t.sku}/history`)).data;
  ok(st.changes.some(a => a.action === "product.info" && a.actor.startsWith(sname)) && st.moves.some(m => m.reason === "count" && m.actor.startsWith(sname)), "the save and the count are logged with the staff member's name");
  await call("/logout", { method: "POST", body: {} }); cookie = ownerCookie;
  // the owner prices it: Price TBD goes, the item is on sale with the shop's colours and its count
  const op = await info(t.sku, { price_cents: 2499 });
  ok(op.status === 200 && op.data.on_sale === true && op.data.price_cents === 2499, "owner's price puts the on-view item on sale: " + JSON.stringify(op.data));
  ok(!(await row(t.sku)).needs, "the item leaves the needs-info list");
  ok((await call("/products")).data.products.filter(x => x.needs).length === needN - 1, "the needs-info count drops by one");
  ok((await call(`/products/${t.sku}/history`)).data.changes.some(a => a.action === "product.info" && a.actor === "owner" && JSON.parse(a.after).price_cents === 2499 && JSON.parse(a.after).active === 1), "the price and the switch-on are logged as the owner's");
  // a hookah colour row: its colours are its chip name
  ok((await info(hk.sku, { colours: ["Black", "Gold"] })).status === 200, "a hookah colour row takes its colours");
  const mod2 = await (await fetch(B + "/api/catalog-module")).text(), m2 = await import("data:text/javascript;base64," + Buffer.from(mod2).toString("base64"));
  const sp2 = m2.PRODUCTS.find(x => x.sku === t.sku), hp = m2.PRODUCTS.find(x => x.sku === hk.sku);
  ok(sp2 && sp2.state === "sale" && sp2.price === 24.99 && sp2.stock === 4 && sp2.counted === true && JSON.stringify(sp2.details.colours) === '["Black","Rose gold","Teal"]' && sp2.name === t.name + " (shop)", "storefront shows the new price, colours, count and name: " + JSON.stringify(sp2 && { state: sp2.state, price: sp2.price, stock: sp2.stock }));
  ok(hp && hp.colour === "Black and Gold" && hp.named === true && JSON.stringify(hp.details.colours) === '["Black","Gold"]', "storefront names the hookah colour from the shop's pick: " + (hp && hp.colour));
  ok(!sp2.weightTbd || sp2.ship === "pickup_only", "an item with no known weight is pickup or local only once on sale");
  // clearing colours takes the item back to "colours unknown"; an unchanged save writes nothing
  ok((await info(hk.sku, { colours: [] })).status === 200 && !JSON.parse((await row(hk.sku)).details || "{}").colour && (await row(hk.sku)).needs?.includes("colours"), "clearing the colours puts them back on the needs list");
  // a name the shop typed in the full form is kept; a priced item that is switched off stays off when its price changes
  ok((await call(`/products/${hk.sku}`, { method: "PUT", body: { variant_label: "Midnight Blue" } })).status === 200 && (await info(hk.sku, { colours: ["Blue"] })).status === 200, "a hookah row named in the full form takes colours");
  const hk2 = JSON.parse((await row(hk.sku)).details); ok(hk2.colour === "Midnight Blue" && JSON.stringify(hk2.colours) === '["Blue"]' && !(await row(hk.sku)).needs?.includes("colours"), "the full form's colour name is kept: " + hk2.colour);
  ok((await info(hk.sku, { colours: [] })).status === 200 && JSON.parse((await row(hk.sku)).details).colour === "Midnight Blue", "clearing the editor's colours keeps the shop's typed name");
  const soon = (await call("/products")).data.products.find(x => x.needs?.includes("price") && x.listed === 1 && x.active === 0 && x.sku !== t.sku && x.sku !== hk.sku);
  ok(soon && (await call(`/products/${soon.sku}`, { method: "PUT", body: { price_cents: 3000 } })).status === 200 && (await row(soon.sku)).active === 0, "an item priced in the full form and left off is off (coming soon)");
  const re = await info(soon.sku, { price_cents: 3200 }); ok(re.status === 200 && re.data.on_sale === false && (await row(soon.sku)).active === 0, "changing the price of a priced, switched-off item never switches it on");
  // one of the shop's own hoses matched by best guess (2026-11-27): it needs a check of its name and length, with the reason,
  // until the shop ticks "Checked with the shop" in the item editor; a sure one never asks for it
  { const prods = (await call("/products")).data.products, hz = prods.find(x => /^hose-/.test(x.family || "") && x.needs?.includes("check") && x.sku !== soon.sku);
    ok(hz && typeof hz.check_why === "string" && hz.check_why.length > 10 && !hz.catalogue, "an unsure hose needs a check, with its reason: " + (hz && hz.sku));
    ok(prods.some(x => /^hose-/.test(x.family || "") && x.needs && !x.needs.includes("check") && !("check_why" in x)), "a hose matched for sure never asks for a check");
    ok((await info(hz.sku, { checked: "yes" })).status === 400 && (await row(hz.sku)).needs.includes("check"), "the check takes true only");
    const ck = await info(hz.sku, { checked: true }), hr = await row(hz.sku);
    ok(ck.status === 200 && !hr.needs?.includes("check") && JSON.parse(hr.details || "{}").checked === true && !("check_why" in hr), "ticking it takes the hose off the check: " + JSON.stringify(hr.needs));
    // a hose with no known length asks for it; the shop types it once and every page shows it (the tick and the typed value stay out of the details shoppers get)
    const hl = prods.find(x => /^hose-/.test(x.family || "") && x.needs?.includes("length") && x.sku !== soon.sku);
    ok(hl && (await info(hl.sku, { length: "<b>6</b>" })).status === 400 && (await info(t.sku, { length: "60 inches" })).status === 400, "a length takes plain words only, and only on an item that has one");
    ok((await info(hl.sku, { length: "66.5 inches" })).status === 200 && !(await row(hl.sku)).needs?.includes("length"), "the typed length takes the hose off the length need");
    const m3 = await import("data:text/javascript;base64," + Buffer.from(await (await fetch(B + "/api/catalog-module")).text()).toString("base64"));
    const h3 = m3.PRODUCTS.find(x => x.sku === hl.sku), c3 = m3.PRODUCTS.find(x => x.sku === hz.sku);
    ok(h3 && h3.facts.length === "66.5 inches" && !("length" in h3.details) && c3 && !("checked" in c3.details), "the storefront shows the typed length; the check tick never leaves the back office"); }
  // weight (2026-11-27): typed as the shop thinks it ("250 g", "1.2 kg"), stored as whole grams in products.weight_g, the weight
  // rates and checkout read. It asks for a weight only where a missing one blocks shipping (foil), never for charcoal; staff may set it.
  { const prods = (await call("/products")).data.products, needW = prods.filter(x => x.needs?.includes("weight"));
    ok(needW.length >= 15 && needW.every(x => /^foil-/.test(x.family || "")), "only items that ship but have no weight yet (the foil) ask for one: " + needW.length);
    ok(!prods.some(x => x.needs?.includes("weight") && (x.category_id === "charcoal" || /^charcoal-/.test(x.family || ""))) && !prods.find(x => x.sku === t.sku).needs?.includes("weight") && !prods.find(x => x.sku === hk.sku).needs?.includes("weight"), "charcoal, a priced accessory and a hookah are not on the list for a weight");
    const wf = needW[0], wn = prods.filter(x => x.needs).length;
    ok(!("weight_known_g" in wf) && prods.find(x => x.sku === "OSS-1001")?.weight_known_g > 0, "the list says the known weight, never an import's placeholder");
    for (const bad of ["0 g", "30.5 kg", "30001 g", "12.5 g", "2.0005 kg", "-3 kg", "250", "1,5 kg", "lots", 250, true, null])
      ok((await info(wf.sku, { weight: bad })).status === 400, "item editor refuses a weight of " + JSON.stringify(bad));
    ok((await row(wf.sku)).weight_g === wf.weight_g && (await row(wf.sku)).details === wf.details, "nothing was written by a refused weight");
    cookie = ""; const sl2 = await call("/login", { method: "POST", body: { name: sname, pin: "593024" } }); cookie = (sl2.r.headers.get("set-cookie") || "").split(";")[0];
    const sw = await info(wf.sku, { weight: "0.5 kg" }), wr = await row(wf.sku);
    ok(sw.status === 200 && wr.weight_g === 500 && wr.weight_known_g === 500 && JSON.parse(wr.details).weighed === true && !wr.needs, "staff set a weight in kilograms: stored as 500 g, off the needs list: " + JSON.stringify({ g: wr.weight_g, needs: wr.needs }));
    ok((await call("/products")).data.products.filter(x => x.needs).length === wn - 1, "the needs-info count drops by one");
    const wh = (await call(`/products/${wf.sku}/history`)).data.changes.find(a => a.action === "product.info");
    ok(wh && wh.actor.startsWith(sname) && JSON.parse(wh.after).weight_g === 500 && JSON.parse(wh.before).weight_g === wf.weight_g, "the weight change is logged with the staff member's name: " + (wh && wh.after));
    await call("/logout", { method: "POST", body: {} }); cookie = ownerCookie;
    ok((await info(wf.sku, { weight: "750 g" })).status === 200 && (await row(wf.sku)).weight_g === 750, "the owner changes it in grams");
    // a hookah weighed at exactly the import's 2,500 g placeholder: typed, so known; shown on its page in place of the maker's figure
    ok((await info(hk.sku, { weight: "2.5 kg" })).status === 200 && (await row(hk.sku)).weight_known_g === 2500, "a typed weight equal to the placeholder is known");
    const coalR = prods.find(x => x.category_id === "charcoal" && /"charcoal":true/.test(x.details || ""));
    ok((await info(coalR.sku, { weight: "1 kg" })).status === 200 && (await row(coalR.sku)).ship_class === "pickup_only" && (await row(coalR.sku)).weight_g === 1000, "charcoal takes a weight and stays pickup only");
    const m4 = await import("data:text/javascript;base64," + Buffer.from(await (await fetch(B + "/api/catalog-module")).text()).toString("base64"));
    const f4 = m4.PRODUCTS.find(x => x.sku === wf.sku), h4 = m4.PRODUCTS.find(x => x.sku === hk.sku), c4 = m4.PRODUCTS.find(x => x.sku === coalR.sku);
    ok(f4 && !f4.weightTbd && f4.ship === "standard" && f4.kg === 0.75 && !("weighed" in f4.details), "foil with a weight is no longer weight TBD: it ships on its own weight: " + JSON.stringify(f4 && { tbd: f4.weightTbd, ship: f4.ship, kg: f4.kg }));
    ok(h4 && !h4.weightTbd && h4.kg === 2.5 && h4.facts.item_weight_g === 2500, "the hookah's typed weight is its shipping weight and the weight its page shows");
    ok(c4 && c4.ship === "pickup_only" && c4.details.charcoal === true, "charcoal with a weight is still never shippable"); }
  const sample = (await call("/products")).data.products.find(x => x.sample && x.active === 0);
  ok(sample && (await info(sample.sku, { price_cents: 1234 })).status === 200 && (await row(sample.sku)).active === 0, "a made-up sample is never switched on by a price");
  // the full product form refuses it too (breaker, 2026-11-27: it used to switch a sample on), whatever else the save carries
  const formOn = await call(`/products/${sample.sku}`, { method: "PUT", body: { active: true } });
  const formAll = await call(`/products/${sample.sku}`, { method: "PUT", body: { name: sample.name, price_cents: 1234, note: "x", active: 1 } });
  ok(formOn.status === 409 && formAll.status === 409 && /sample/i.test(formOn.data.error || "") && (await row(sample.sku)).active === 0, "the full product form never switches a made-up sample on: " + formOn.status + "," + formAll.status);
  ok((await call(`/products/${sample.sku}`, { method: "PUT", body: { active: false, note: "Kept off" } })).status === 200, "a sample can still be saved while it stays off");
  // the back office offers no "Show in the store" switch on a sample (public/admin.js productForm)
  { const src = (await import("node:fs")).readFileSync(new URL("../public/admin.js", import.meta.url), "utf8"); ok(/p\.sample \? `<p class="fineprint">[^`]*stays hidden[^`]*` : `<label class="check"><input type="checkbox" name="active"/.test(src), "the product form draws the store switch only for items that are not samples"); }
  const nothing = await info(t.sku, { name: t.name + " (shop)", price_cents: 2499 }); ok(nothing.status === 200 && nothing.data.changed === false, "a save with nothing new writes nothing");
  // charcoal stays pickup or local only whatever the editor saves
  const coal = all.find(x => x.category_id === "charcoal" && /"charcoal":true/.test(x.details || ""));
  ok(coal && (await info(coal.sku, { colours: ["Black"] })).status === 200, "a charcoal item takes colours");
  const cr = coal && await row(coal.sku); ok(cr && cr.ship_class === "pickup_only" && JSON.parse(cr.details).charcoal === true, "charcoal keeps its pickup-only rule and its mark after an editor save");
}
ok((await call("/logout", { method: "POST", body: {} })).status === 200, "sign out");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
