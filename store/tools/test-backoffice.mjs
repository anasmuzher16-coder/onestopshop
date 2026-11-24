// Back office round two, against the running local store: staff sign-in with PINs (hashed, locked out after wrong
// tries, ended on removal), who-did-what on every change, Count and Receive (a repeated tap counts once), cancel with
// restock (never twice), the staff-only ID tick, where orders came from, and the monthly report with its 5% share.
// node store/tools/test-backoffice.mjs   (changes local data and locks local sign-in for 15 minutes at the end: reseed afterwards)
import { readFileSync } from "node:fs";
import { cleanSource } from "../src/source.js";
import { share, monthStart, monthOf, reportCsv } from "../src/report.js";
import { pinProblem } from "../src/staff.js";
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const jar = { owner: "", staff: "" };
const call = async (path, { method = "GET", body, as = "owner", headers = {} } = {}) => {
  const h = { ...headers }; if (jar[as]) h.Cookie = jar[as]; if (body !== undefined) { h["Content-Type"] = "application/json"; h["X-OSS-Admin"] = "1"; }
  const r = await fetch(B + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data = {}; try { data = JSON.parse(text); } catch {} return { status: r.status, data, text, r };
};
const A = (p, o) => call("/api/admin" + p, o);
const uuid = () => crypto.randomUUID();
const letters = () => Array.from({ length: 5 }, () => "abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 23)]).join("");

// ---- pure pieces: source cleaning, money rounding, Windsor month edges, PIN rules ----
const s1 = cleanSource({ src: "card", referrer: "https://www.google.com/search?q=private+stuff", landing: "/shop/heat", utm_medium: "qr" }, "127.0.0.1");
ok(s1.source === "card" && JSON.parse(s1.detail).ref_host === "google.com" && !s1.detail.includes("private") && JSON.parse(s1.detail).landing === "/shop/heat", "source: src wins, referrer kept as a site name only: " + s1.detail);
ok(cleanSource({ utm_source: "GBP" }).source === "gbp", "utm_source=gbp is recorded as gbp");
ok(cleanSource({ referrer: "https://l.instagram.com/x" }).source === "instagram" && cleanSource({}).source === "direct" && cleanSource(undefined).source === null, "referrer names the site; no codes is direct; an old page sends nothing");
ok(cleanSource({ src: "=HYPERLINK(\"x\")", utm_source: "<script>", landing: "/a?email=x@y.z", referrer: "javascript:alert(1)" }).source === "direct" && cleanSource({ src: "=1+1" }).detail === "{}", "source codes that are not plain words are dropped");
ok(cleanSource({ referrer: "http://127.0.0.1:4488/shop" }, "127.0.0.1").source === "direct", "our own pages are not a source");
ok(cleanSource({ referrer: "http://a\"onmouseover=x'b&c.com/" }).detail === "{}", "a referrer that is not a plain site name is dropped");
ok(share(100000, 500) === 5000 && share(12345, 500) === 617 && share(12350, 500) === 618 && share(-12350, 500) === -618 && share(0, 500) === 0, "5% share rounds once, half away from zero, in whole cents");
ok(new Date(monthStart(2026, 11)).toISOString() === "2026-11-01T04:00:00.000Z" && new Date(monthStart(2026, 12)).toISOString() === "2026-12-01T05:00:00.000Z" && new Date(monthStart(2026, 3)).toISOString() === "2026-03-01T05:00:00.000Z", "months start at midnight Windsor time, summer and winter");
ok(monthOf("2026-11") === "2026-11" && monthOf("2026-13") === null && monthOf("1999-01") === null && monthOf("2026-1") === null && /^\d{4}-\d\d$/.test(monthOf()), "month input is checked");
ok(pinProblem("482913") === null && pinProblem("123456") && pinProblem("111111") && pinProblem("12345") && pinProblem("abcdef") && pinProblem(482913), "PIN rules: 6 digits, not an obvious one");
const csv = reportCsv({ month: "2026-11", timezone: "America/Toronto", rows: [{ line: "sale", at: "2026-11-02T15:00:00Z", id: "=cmd", status: "paid", method: "pickup", source: "+x", subtotal_cents: 1000, shipping_cents: 0, tax_cents: 130, total_cents: 1130 }], sales: { orders: 1, subtotal: 1000, delivery: 0, tax: 130, total: 1130 }, refunds: { orders: 0, subtotal: 0, delivery: 0, tax: 0, total: 0 }, net: { orders: 1, subtotal: 1000, delivery: 0, tax: 130, total: 1130 }, studio: { rate_bp: 500, basis_label: "subtotal before tax and delivery", basis_cents: 1000, share_cents: 50 } });
ok(csv.includes('"\'=cmd"') && csv.includes('"\'+x"') && csv.includes('"-0.00"') === false && csv.includes('"10.00"'), "CSV cells that a spreadsheet would run as formulas are defused");

// ---- sign-in: owner passcode still works; staff are added by the owner ----
const lo = await A("/login", { method: "POST", body: { passcode: KEY } }); jar.owner = (lo.r.headers.get("set-cookie") || "").split(";")[0];
ok(lo.status === 200 && lo.data.owner === true, "the owner's passcode still signs in");
ok((await A("/me")).data.owner === true, "owner session knows it is the owner");
const name = "Tess" + letters(), pin = "482913";
ok((await A("/staff", { method: "POST", body: { name, pin: "123456" } })).status === 400, "an obvious PIN is refused");
ok((await A("/staff", { method: "POST", body: { name: "<b>x</b>", pin } })).status === 400, "a name with code in it is refused");
const add = await A("/staff", { method: "POST", body: { name, pin } }); ok(add.status === 201 && add.data.id > 0, "owner adds a staff member: " + add.status);
ok((await A("/staff", { method: "POST", body: { name: name.toUpperCase(), pin: "593024" } })).status === 409, "two active staff cannot share a name");
const staffList = (await A("/staff")).data.staff; ok(staffList.some(s => s.name === name) && !JSON.stringify(staffList).includes("pbkdf2"), "staff list never carries PIN hashes");
const bad1 = await A("/login", { method: "POST", as: "staff", body: { name, pin: "000001" } }), bad2 = await A("/login", { method: "POST", as: "staff", body: { name: "Nobody" + letters(), pin } });
ok(bad1.status === 401 && bad2.status === 401 && bad1.data.error === bad2.data.error, "a wrong PIN and an unknown name get the same answer");
const ls = await A("/login", { method: "POST", as: "staff", body: { name: name.toLowerCase(), pin } }); jar.staff = (ls.r.headers.get("set-cookie") || "").split(";")[0];
ok(ls.status === 200 && ls.data.owner === false && /HttpOnly/.test(ls.r.headers.get("set-cookie") || "") && /SameSite=Strict/.test(ls.r.headers.get("set-cookie") || ""), "staff signs in with name (any case) and PIN, locked-down cookie");
const me = (await A("/me", { as: "staff" })).data; ok(me.owner === false && me.actor.startsWith(name + " #"), "staff session is named: " + me.actor);
for (const p of ["/staff", "/settings", "/report", "/report.csv", "/backup"]) ok((await A(p, { as: "staff" })).status === 403, "staff cannot open " + p);
ok((await A("/staff/" + add.data.id, { method: "DELETE", body: {}, as: "staff" })).status === 403, "staff cannot remove staff");
ok((await A("/products/OSS-8004/stock", { method: "POST", body: { delta: 1 }, headers: { "Sec-Fetch-Site": "cross-site" } })).status === 403, "a write the browser marks cross-site is refused");
ok((await A("/login", { method: "POST", as: "staff", body: { passcode: KEY }, headers: { "Sec-Fetch-Site": "cross-site" } })).status === 403, "a sign-in from another site is refused");

// ---- Count and Receive, with names on every move ----
const prod = async sku => (await A("/products")).data.products.find(p => p.sku === sku);
const SKU = "OSS-8004", s0 = (await prod(SKU)).stock;
const c1 = await A(`/products/${SKU}/count`, { method: "POST", as: "staff", body: { counted: s0 + 4, seen: s0, op: uuid() } });
ok(c1.status === 200 && c1.data.stock === s0 + 4 && c1.data.delta === 4, "count: typed number saved, difference worked out by the server: " + JSON.stringify(c1.data));
const stale = await A(`/products/${SKU}/count`, { method: "POST", as: "staff", body: { counted: 1, seen: s0, op: uuid() } });
ok(stale.status === 409 && stale.data.changed && stale.data.stock === s0 + 4 && (await prod(SKU)).stock === s0 + 4, "count against an out-of-date number is refused, nothing saved");
const same = await A(`/products/${SKU}/count`, { method: "POST", as: "staff", body: { counted: s0 + 4, seen: s0 + 4, op: uuid() } });
ok(same.status === 200 && same.data.delta === 0, "a count that matches is still recorded");
const op1 = uuid(), twice = await Promise.all([1, 2, 3].map(() => A(`/products/${SKU}/count`, { method: "POST", as: "staff", body: { counted: s0, seen: s0 + 4, op: op1 } })));
ok(twice.every(r => r.status === 200 && r.data.stock === s0) && (await prod(SKU)).stock === s0, "the same count sent three times at once lands once: " + twice.map(r => r.status));
for (const bad of [-1, "abc", "", 1.5e9, null, 2.6, true]) ok((await A(`/products/${SKU}/count`, { method: "POST", as: "staff", body: { counted: bad, seen: s0, op: uuid() } })).status === 400, "count refuses " + JSON.stringify(bad));
ok((await A(`/products/${SKU}/count`, { method: "POST", as: "staff", body: { counted: 1, op: uuid() } })).status === 400 && (await prod(SKU)).stock === s0, "a count without the number the screen showed is refused");
ok((await A(`/products/${SKU}/receive`, { method: "POST", as: "staff", body: { qty: 2.5, op: uuid() } })).status === 400 && (await A(`/products/${SKU}/stock`, { method: "POST", as: "staff", body: { delta: 0.4, op: uuid() } })).status === 400, "receive and adjust take whole numbers only");
const op2 = uuid(), recv = await Promise.all([1, 2, 3].map(() => A(`/products/${SKU}/receive`, { method: "POST", as: "staff", body: { qty: 6, ref: "INV-2291", op: op2 } })));
ok(recv.every(r => r.status === 200) && (await prod(SKU)).stock === s0 + 6, "receive: three copies of one tap add 6 once: " + recv.map(r => r.data.stock));
ok((await A(`/products/${SKU}/receive`, { method: "POST", as: "staff", body: { qty: 0, op: uuid() } })).status === 400 && (await A(`/products/${SKU}/receive`, { method: "POST", as: "staff", body: { qty: 2, ref: "x".repeat(61) } })).status === 400, "receive refuses 0 and an over-long note");
const op3 = uuid(); await A(`/products/${SKU}/stock`, { method: "POST", as: "staff", body: { delta: -1, op: op3 } }); const rep3 = await A(`/products/${SKU}/stock`, { method: "POST", as: "staff", body: { delta: -1, op: op3 } });
ok(rep3.data.replayed === true && (await prod(SKU)).stock === s0 + 5, "the stepper's repeat tap counts once");
ok((await A(`/products/OSS-8003/stock`, { method: "POST", as: "staff", body: { delta: 1, op: op3 } })).status === 409, "a tap key cannot be reused on another product");
const hist = (await A(`/products/${SKU}/history`, { as: "staff" })).data;
const mine = hist.moves.filter(m => m.actor === me.actor);
ok(mine.some(m => m.reason === "count" && m.delta === 4 && m.ref === "counted " + (s0 + 4)) && mine.some(m => m.reason === "received" && m.delta === 6 && m.ref === "INV-2291") && mine.filter(m => m.reason === "received").length === 1 && mine.filter(m => m.reason === "count").length === 3, "history names who counted and received, once each");
await A(`/products/${SKU}`, { method: "PUT", as: "staff", body: { price_cents: 5500 } });
ok((await A(`/products/${SKU}/history`)).data.changes.some(c => c.action === "product.edit" && c.actor === me.actor && c.after.includes("5500")), "a price change records who made it");
await A(`/products/${SKU}`, { method: "PUT", body: { price_cents: 5400 } });

// ---- orders: source, cancel with restock, the ID tick ----
const place = async (sku, qty, extra = {}) => (await call("/api/orders", { method: "POST", as: "none", body: { name: "Rhea Mbeki", email: "rhea@example.com", method: "pickup", lines: [{ sku, qty }], ...extra } }));
const before = (await prod(SKU)).stock;
const o1 = await place(SKU, 2, { source: { src: "card", referrer: "https://www.google.com/maps?q=me", landing: "/p/OSS-8004", utm_campaign: "fall" } });
ok(o1.status === 201 && (await prod(SKU)).stock === before - 2, "an order takes stock");
const d1 = (await A("/orders/" + o1.data.order.id)).data;
ok(d1.order.source === "card" && JSON.parse(d1.order.source_detail).ref_host === "google.com" && JSON.parse(d1.order.source_detail).utm_campaign === "fall" && !d1.order.source_detail.includes("q=me") && !("cancel_op" in d1.order), "the order records where it came from, without the full address");
ok(!JSON.stringify(o1.data).includes("card") && !JSON.stringify(o1.data).includes("source"), "the shopper's confirmation does not echo tracking data");
const id1 = o1.data.order.id;
ok((await A(`/orders/${id1}/cancel`, { method: "POST", as: "staff", body: {} })).status === 400, "cancel needs a reason");
ok((await A(`/orders/${id1}/cancel`, { method: "POST", as: "staff", body: { reason: "other" } })).status === 400, "Other needs a few words");
const ops = [uuid(), uuid(), uuid(), uuid(), uuid()];
const race = await Promise.all(ops.map(op => A(`/orders/${id1}/cancel`, { method: "POST", as: "staff", body: { reason: "no_show", op } })));
const winners = race.filter(r => r.status === 200 && !r.data.replayed);
ok(winners.length === 1 && race.filter(r => r.status === 409).length === 4, "five cancels at once: exactly one wins: " + race.map(r => r.status));
ok((await prod(SKU)).stock === before, "stock goes back exactly once: " + (await prod(SKU)).stock + " vs " + before);
const win = ops[race.findIndex(r => r.status === 200 && !r.data.replayed)];
const again = await A(`/orders/${id1}/cancel`, { method: "POST", as: "staff", body: { reason: "no_show", op: win } });
ok(again.status === 200 && again.data.replayed && (await prod(SKU)).stock === before, "a retry of the winning cancel answers the same and restocks nothing");
ok((await A(`/orders/${id1}/cancel`, { method: "POST", as: "staff", body: { reason: "customer", op: uuid() } })).status === 409, "a cancelled order cannot be cancelled again");
const d2 = (await A("/orders/" + id1)).data;
ok(d2.order.status === "cancelled" && d2.order.cancelled_by === me.actor && d2.order.cancel_reason === "no_show" && d2.trail.some(t => t.action === "order.cancel" && t.actor === me.actor), "the cancel is on the order with who and why");
ok((await A(`/products/${SKU}/history`)).data.moves.filter(m => m.ref === id1 && m.reason === "released").length === 1, "one put-back line in the stock history");
ok((await A(`/orders/${id1}/status`, { method: "POST", body: { status: "ready" } })).status === 409, "a cancelled order cannot be moved on");
const shipped = (await A("/orders")).data.orders.find(o => ["shipped", "collected"].includes(o.status));
ok(shipped && (await A(`/orders/${shipped.id}/cancel`, { method: "POST", body: { reason: "customer", op: uuid() } })).status === 409, "a sent or collected order is not cancelled here");
// two people tap Mark ready at once: one moves it, one email
const o2 = await place("OSS-8003", 1), id2 = o2.data.order.id;
const st = await Promise.all([1, 2].map(() => A(`/orders/${id2}/status`, { method: "POST", as: "staff", body: { status: "ready" } })));
const d3 = (await A("/orders/" + id2)).data;
ok(st.filter(r => r.status === 200).length === 1 && d3.emails.filter(e => e.kind === "pickup_ready").length === 1 && d3.order.ready_at, "two taps on Mark ready: one change, one email: " + st.map(r => r.status));
// ID tick on charcoal only, staff only
const coal = (await A("/products")).data.products.find(p => p.active && p.stock > 0 && /"charcoal":true/.test(p.details || ""));
const o3 = coal ? await place(coal.sku, 1, { order_key: "idtick-" + uuid() }) : null;
ok(o3 && o3.status === 201, "a charcoal pickup order is placed");
if (o3) {
  const id3 = o3.data.order.id, tick = await A(`/orders/${id3}/id-check`, { method: "POST", as: "staff", body: { checked: true } });
  ok(tick.status === 200 && tick.data.by === me.actor && (await A("/orders/" + id3)).data.order.id_checked_by === me.actor, "staff ticks ID checked, with their name");
  const o5 = await place(coal.sku, 1); await A(`/orders/${o5.data.order.id}/cancel`, { method: "POST", body: { reason: "customer", op: uuid() } });
  const was5 = (await A("/orders/" + o5.data.order.id)).data.order.updated_at;
  ok((await A(`/orders/${o5.data.order.id}/id-check`, { method: "POST", body: { checked: true } })).status === 404 && (await A("/orders/" + o5.data.order.id)).data.order.updated_at === was5, "no ID tick on a cancelled order, and the tick never moves an order's date");
  ok((await A(`/orders/${id2}/id-check`, { method: "POST", body: { checked: true } })).status === 404 && (await A(`/orders/${id3}/id-check`, { method: "POST", body: { checked: "yes" } })).status === 400, "no ID tick on other orders; only true or false");
  const shopperSees = JSON.stringify(o3.data) + (await call("/order/" + id3, { as: "none" })).text + (await call("/api/catalog", { as: "none" })).text;
  ok(!/id_check|ID checked|Check ID/i.test(shopperSees), "nothing about ID reaches the shopper's confirmation, order page or catalogue");
  const mail = (await A("/orders/" + id3)).data.emails.find(e => e.kind === "order_placed"), html = mail ? (await A("/emails/" + mail.id)).data.email.html : "";
  ok(html && !/\bID\b|age|young/i.test(html.replace(/<[^>]+>/g, " ")), "the order email says nothing about ID");
}
// pickups waiting 3 days or more
const sum = (await A("/summary", { as: "staff" })).data;
ok(typeof sum.todo.pickup_overdue === "number" && sum.todo.pickup_overdue >= 1, "Today counts pickups waiting 3 days or more: " + sum.todo.pickup_overdue);

// ---- the monthly report ----
const mo = monthOf(), r1 = (await A("/report?month=" + mo)).data;
ok(r1.studio.basis === "subtotal" && r1.studio.basis_label === "subtotal before tax and delivery" && r1.studio.rate_bp === 500, "default basis: 5% of the subtotal before tax and delivery");
ok(r1.net.subtotal === r1.sales.subtotal - r1.refunds.subtotal && r1.studio.basis_cents === r1.net.subtotal && r1.studio.share_cents === share(r1.net.subtotal, 500), "report maths: net = sales - refunds, share = 5% of net subtotal");
ok(r1.sales.orders >= 3 && r1.refunds.orders >= 1 && r1.sources.some(s => s.source === "card"), "this month's sales, the cancel and the card source are in: " + JSON.stringify(r1.sources));
const o4 = await place("OSS-8003", 1, { source: { utm_source: "gbp" } }), r2 = (await A("/report?month=" + mo)).data;
ok(r2.sales.orders === r1.sales.orders + 1 && r2.sales.subtotal === r1.sales.subtotal + o4.data.order.subtotal_cents && r2.sources.some(s => s.source === "gbp"), "a new order adds its subtotal and its source");
await A(`/orders/${o4.data.order.id}/cancel`, { method: "POST", body: { reason: "customer", op: uuid() } });
const r3 = (await A("/report?month=" + mo)).data;
ok(r3.refunds.orders === r2.refunds.orders + 1 && r3.net.subtotal === r1.net.subtotal, "cancelling it puts the net back where it was");
ok((await A("/settings", { method: "PUT", body: { studio_share_basis: "everything" } })).status === 400, "an unknown basis is refused");
await A("/settings", { method: "PUT", body: { studio_share_basis: "total" } });
const r4 = (await A("/report?month=" + mo)).data;
ok(r4.studio.basis === "total" && r4.studio.basis_cents === r4.net.total && r4.studio.share_cents === share(r4.net.total, 500) && r4.studio.basis_set_by === "owner", "switching the basis to the full total recomputes the share");
await A("/settings", { method: "PUT", body: { studio_share_basis: "subtotal" } });
ok((await A("/report?month=2026-13")).status === 400 && (await A("/report.csv?month=x")).status === 400, "a bad month is refused");
const cs = await A("/report.csv?month=" + mo);
ok(cs.status === 200 && /text\/csv/.test(cs.r.headers.get("content-type")) && new RegExp(`filename="one-stop-shop-sales-${mo}\\.csv"`).test(cs.r.headers.get("content-disposition") || ""), "CSV downloads as a dated file");
const lines = cs.text.trim().split("\r\n").map(l => l.slice(1, -1).split('","'));
const rows = lines.filter(l => l[0] === "Sale" || l[0] === "Cancelled or refunded"), csvNet = rows.reduce((a, l) => a + Math.round(parseFloat(l[6]) * 100), 0);
const r5 = (await A("/report?month=" + mo)).data;
ok(csvNet === r5.net.subtotal && lines.some(l => l[0] === "Studio share" && l[9] === (r5.studio.share_cents / 100).toFixed(2)), `CSV lines add up to the net subtotal (${csvNet} vs ${r5.net.subtotal}) and carry the share`);
ok(!cs.text.includes("rhea@example.com") && !cs.text.includes("Rhea"), "the CSV carries no customer names or emails");
const bk = (await A("/backup")).data; ok(bk.tables && bk.tables.staff && !JSON.stringify(bk.tables.staff).includes("pbkdf2") && !("sessions" in bk.tables) && !("login_attempts" in bk.tables), "backup has staff without PIN hashes, and no sign-ins");

// ---- removing someone ends their sign-in at once ----
const add2 = await A("/staff", { method: "POST", body: { name: "Omar" + letters(), pin: "730518" } });
await A(`/staff/${add2.data.id}/pin`, { method: "POST", body: { pin: "730519" } });
ok((await A("/staff/" + add.data.id, { method: "DELETE", body: {} })).status === 200, "owner removes the staff member");
ok((await A("/me", { as: "staff" })).status === 401, "their open sign-in stops working at once");
ok((await A("/login", { method: "POST", as: "staff", body: { name, pin } })).status === 401, "and they cannot sign in again");
ok((await A(`/products/${SKU}/history`)).data.moves.some(m => m.actor === me.actor), "their past changes still carry their name");

ok((await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ passcode: KEY }) })).status === 400, "sign-in without the request marker (a plain form post) is refused");
// ---- lockout (last: it locks local sign-in for 15 minutes) ----
const wrongs = []; for (let i = 0; i < 5; i++) wrongs.push((await A("/login", { method: "POST", as: "staff", body: { name: add2.data.name, pin: "00000" + i }, headers: { "CF-Connecting-IP": "10.9.0." + i } })).status);
const locked = await A("/login", { method: "POST", as: "staff", body: { name: add2.data.name, pin: "730519" }, headers: { "CF-Connecting-IP": "10.9.1.1" } });
ok(wrongs.every(s => s === 401) && locked.status === 429, "five wrong PINs on one name lock that name, even with the right PIN: " + wrongs + "," + locked.status);
const ghost = "Ghost" + letters(), gw = []; for (let i = 0; i < 6; i++) gw.push((await A("/login", { method: "POST", as: "staff", body: { name: ghost, pin: "00000" + i }, headers: { "CF-Connecting-IP": "10.8.0." + i } })).status);
ok(gw[5] === 429, "a name that does not exist locks the same way, so the lock gives nobody away: " + gw);
const burst = await Promise.all(Array.from({ length: 8 }, (_, i) => A("/login", { method: "POST", as: "staff", body: { name: "Burst" + letters(), pin: "00000" + i }, headers: { "CF-Connecting-IP": "10.7.7.7" } })));
ok(burst.filter(r => r.status === 401).length <= 5 && burst.filter(r => r.status === 429).length >= 3, "eight tries at once from one place get at most five checks: " + burst.map(r => r.status));
for (let i = 0; i < 42; i++) await A("/login", { method: "POST", as: "staff", body: { name: "Flood" + letters(), pin: "000000" }, headers: { "CF-Connecting-IP": "10.6." + Math.floor(i / 5) + "." + i } });
const ownerStill = await A("/login", { method: "POST", as: "none", body: { passcode: KEY }, headers: { "CF-Connecting-IP": "10.5.5.5" } });
ok(ownerStill.status === 200, "forty-plus wrong staff PINs from all over do not lock the owner out: " + ownerStill.status);
ok((await A("/logout", { method: "POST", body: {} })).status === 200, "owner signs out");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
