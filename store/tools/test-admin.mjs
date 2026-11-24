// Back office checks against the running local store: sign-in wall, shop numbers, stock changes, product edits,
// order steps, photo upload. Reads the local passcode from .dev.vars. node store/tools/test-admin.mjs
import { readFileSync } from "node:fs";
import { seededProductCount } from "./seed-files.mjs";
const B = process.env.BASE || "http://127.0.0.1:4420";
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0, cookie = "";
const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const call = async (path, { method = "GET", body, marker = true, type = "application/json", raw, origin } = {}) => {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body !== undefined) { headers["Content-Type"] = type; if (marker) headers["X-OSS-Admin"] = "1"; } if (origin) headers.Origin = origin;
  const r = await fetch(B + "/api/admin" + path, { method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})), r };
};
// the wall
for (const p of ["/summary", "/products", "/orders", "/orders/S1001"]) ok((await call(p)).status === 401, p + " must need sign-in");
ok((await call("/products/OSS-1001/stock", { method: "POST", body: { delta: 1 } })).status === 401, "stock change must need sign-in");
ok((await call("/login", { method: "POST", body: { passcode: "wrong" } })).status === 401, "wrong passcode refused");
const login = await call("/login", { method: "POST", body: { passcode: KEY } });
ok(login.status === 200 && /HttpOnly/.test(login.r.headers.get("set-cookie") || "") && /SameSite=Strict/.test(login.r.headers.get("set-cookie") || ""), "sign-in sets a locked-down cookie");
cookie = (login.r.headers.get("set-cookie") || "").split(";")[0];
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
ok((await call("/logout", { method: "POST", body: {} })).status === 200, "sign out");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
