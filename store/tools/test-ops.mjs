// Checks for the pieces around the store: order emails are written (and never claimed as sent), backups download,
// privacy and terms pages exist, a sign-in can be ended, and wrong passcodes lock sign-in.
// node store/tools/test-ops.mjs   (changes local data and locks local sign-in for 15 minutes: reseed afterwards)
import { readFileSync } from "node:fs";
const B = process.env.BASE || "http://127.0.0.1:4420";
const KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0, cookie = ""; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const call = async (path, { method = "GET", body } = {}) => {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body !== undefined) { headers["Content-Type"] = "application/json"; headers["X-OSS-Admin"] = "1"; }
  const r = await fetch(B + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data = {}; try { data = JSON.parse(text); } catch {} return { status: r.status, data, text, r };
};
for (const p of ["/privacy", "/terms"]) { const r = await call(p); ok(r.status === 200 && /Draft/.test(r.text) === false && /<title>(Privacy|Terms of sale) \| One Stop Shop<\/title>/.test(r.text), p + " page answers with its own title"); }
ok((await call("/api/admin/backup")).status === 401 && (await call("/api/admin/emails/1")).status === 401, "backup and emails need sign-in");

// a shopper orders the last Midnight Coal for pickup, and something to ship
const pick = await call("/api/orders", { method: "POST", body: { name: "Pat Pickup", email: "pat@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-7006", qty: 1 }] } });
const ship = await call("/api/orders", { method: "POST", body: { name: "Sam Sample", email: "sam@example.com", method: "ship", service: "cp-exp", postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" }, lines: [{ sku: "OSS-8001", qty: 1 }] } });
ok(pick.status === 201 && ship.status === 201, "two orders placed");
if (ship.data.pay?.url) await fetch(ship.data.pay.url, { method: "POST", redirect: "manual" });   // paid on the Stripe stand-in, which sends the signed webhook

const login = await call("/api/admin/login", { method: "POST", body: { passcode: KEY } }); cookie = (login.r.headers.get("set-cookie") || "").split(";")[0];
ok(login.status === 200 && /oss_admin=[a-f0-9]{64}/.test(cookie), "signed in");
const second = await call("/api/admin/login", { method: "POST", body: { passcode: KEY } });
ok((second.r.headers.get("set-cookie") || "").split(";")[0] !== cookie, "every sign-in gets its own token");

let d = (await call("/api/admin/orders/" + pick.data.order.id)).data;
ok(d.emails.some(e => e.kind === "order_placed" && e.recipient === "pat@example.com" && e.status === "held"), "order email is written and marked as not sent (no mail service connected)");
ok(d.emails.some(e => e.kind === "low_stock" && e.status === "held"), "selling the last one writes a low-stock note for the shop");
await call(`/api/admin/orders/${pick.data.order.id}/status`, { method: "POST", body: { status: "ready" } });
d = (await call("/api/admin/orders/" + pick.data.order.id)).data;
const ready = d.emails.find(e => e.kind === "pickup_ready"); ok(!!ready, "marking it ready writes the pickup email");
await call(`/api/admin/orders/${ship.data.order.id}/status`, { method: "POST", body: { status: "packed" } });
ok(((await call("/api/admin/orders/" + ship.data.order.id)).data.emails || []).filter(e => e.kind === "order_shipped").length === 0, "packing alone sends nothing");
await call(`/api/admin/orders/${ship.data.order.id}/status`, { method: "POST", body: { status: "shipped" } });
const shipped = (await call("/api/admin/orders/" + ship.data.order.id)).data.emails.find(e => e.kind === "order_shipped"); ok(!!shipped, "marking it shipped writes the shipped email");
const view = shipped ? (await call("/api/admin/emails/" + shipped.id)).data.email : null;
ok(view && view.html.includes(ship.data.order.id) && view.html.includes("Sunset shades") && !/<script/i.test(view.html), "the shipped email names the order and the item, and carries no script");
const evil = await call("/api/orders", { method: "POST", body: { name: '<img src=x onerror=alert(1)>', email: "x@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8003", qty: 1 }] } });
const evilMail = (await call("/api/admin/orders/" + evil.data.order.id)).data.emails.find(e => e.kind === "order_placed"), evilHtml = (await call("/api/admin/emails/" + evilMail.id)).data.email.html;
ok(!evilHtml.includes("<img src=x") && evilHtml.includes("&lt;img"), "a name with code in it is shown as text in the email");

const bk = await call("/api/admin/backup");
ok(bk.status === 200 && /attachment; filename="one-stop-shop-backup-\d{4}-\d\d-\d\d\.json"/.test(bk.r.headers.get("content-disposition") || ""), "backup downloads as a dated file");
ok(bk.data.tables && bk.data.tables.products.length === 98 + 69 + 15 + 47 + 296 && bk.data.tables.orders.length >= 50 && bk.data.tables.stock_moves.length > 90 && bk.data.tables.emails.length >= 5 && !("sessions" in bk.data.tables), "backup holds products, orders, stock history and emails, and no sign-in tokens");

ok((await call("/api/admin/logout", { method: "POST", body: {} })).status === 200 && (await call("/api/admin/summary")).status === 401, "signing out ends that sign-in for good");
cookie = "";
const wrong = []; for (let i = 0; i < 6; i++) wrong.push((await call("/api/admin/login", { method: "POST", body: { passcode: "wrong-" + i } })).status);
ok(wrong.slice(0, 5).every(s => s === 401) && wrong[5] === 429, "five wrong passcodes lock sign-in: " + wrong.join(","));
ok((await call("/api/admin/login", { method: "POST", body: { passcode: KEY } })).status === 429, "the right passcode is refused too while locked");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
