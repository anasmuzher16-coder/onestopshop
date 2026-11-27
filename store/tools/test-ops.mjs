// Checks for the pieces around the store: order emails are written (and never claimed as sent), backups download,
// privacy and terms pages exist, a sign-in can be ended, and wrong passcodes lock sign-in.
// node store/tools/test-ops.mjs   (changes local data and locks local sign-in for 15 minutes: reseed afterwards)
import { samplesOn } from "./fixtures/samples-on.mjs";
import { readFileSync } from "node:fs";
import { seededProductCount } from "./seed-files.mjs";   // the shelf the seed builds, not a typed number
const B = process.env.BASE || "http://127.0.0.1:4420";
// the made-up sample rows this suite buys, switched back on in its own throwaway database (tools/fixtures/samples-on.mjs)
await samplesOn(B, ["OSS-7006", "OSS-8001", "OSS-8003"]);
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
// with no card keys (the live demo) the ship order is refused with the shop's number: the shipped email is checked with keys
const CARD = /<meta name="oss-pay" content="card">/.test((await call("/")).text);
ok(pick.status === 201 && (CARD ? ship.status === 201 : ship.status === 503 && ship.data.pay_off === true && /519-255-2222/.test(ship.data.error || "")), "two orders placed (no keys: the ship order refused with the shop's number): " + ship.status);
if (ship.data.pay?.url) await fetch(ship.data.pay.url, { method: "POST", redirect: "manual" });   // paid on the Stripe stand-in, which sends the signed webhook

const login = await call("/api/admin/login", { method: "POST", body: { passcode: KEY } }); cookie = (login.r.headers.get("set-cookie") || "").split(";")[0];
ok(login.status === 200 && /oss_admin=[a-f0-9]{64}/.test(cookie), "signed in");
const second = await call("/api/admin/login", { method: "POST", body: { passcode: KEY } });
ok((second.r.headers.get("set-cookie") || "").split(";")[0] !== cookie, "every sign-in gets its own token");

let d = (await call("/api/admin/orders/" + pick.data.order.id)).data;
ok(d.emails.some(e => e.kind === "order_placed" && e.recipient === "pat@example.com" && e.status === "held"), "order email is written and marked as not sent (no mail service connected)");
// rewritten 2026-11-27: a counter pickup is a request and takes nothing when placed, so its low-stock note comes when the shop marks it ready
ok(!d.emails.some(e => e.kind === "low_stock"), "a pickup request for the last one writes no low-stock note yet: nothing was taken");
{ const no = d.emails.filter(e => e.kind === "new_order"), body = no[0] ? (await call("/api/admin/emails/" + no[0].id)).data.email : null;
  ok(no.length === 1 && no[0].recipient !== "pat@example.com" && no[0].status === "held" && body && body.subject.includes(pick.data.order.id) && /back office/.test(body.html), "the shop gets one new-order note for it, held in the outbox until mail is set up: " + (no[0] && no[0].recipient)); }
await call(`/api/admin/orders/${pick.data.order.id}/status`, { method: "POST", body: { status: "ready" } });
d = (await call("/api/admin/orders/" + pick.data.order.id)).data;
const ready = d.emails.find(e => e.kind === "pickup_ready"); ok(!!ready, "marking it ready writes the pickup email");
ok(d.emails.some(e => e.kind === "low_stock" && e.status === "held"), "marking the last one ready (taking it off the shelf) writes a low-stock note for the shop");
if (CARD) {
await call(`/api/admin/orders/${ship.data.order.id}/status`, { method: "POST", body: { status: "packed" } });
ok(((await call("/api/admin/orders/" + ship.data.order.id)).data.emails || []).filter(e => e.kind === "order_shipped").length === 0, "packing alone sends nothing");
await call(`/api/admin/orders/${ship.data.order.id}/status`, { method: "POST", body: { status: "shipped" } });
const shipped = (await call("/api/admin/orders/" + ship.data.order.id)).data.emails.find(e => e.kind === "order_shipped"); ok(!!shipped, "marking it shipped writes the shipped email");
const view = shipped ? (await call("/api/admin/emails/" + shipped.id)).data.email : null;
ok(view && view.html.includes(ship.data.order.id) && view.html.includes("Sunset shades") && !/<script/i.test(view.html), "the shipped email names the order and the item, and carries no script");
}
// Updated 2026-11-26 (fleet/order-guard): a name with code in it is now refused at the order (names are letters only, src/guard.js),
// so it never reaches an email; the email's own escaping is still checked, with the one markup character a real name holds.
const evil = await call("/api/orders", { method: "POST", body: { name: '<img src=x onerror=alert(1)>', email: "x@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8003", qty: 1 }] } });
ok(evil.status === 400 && evil.data.field === "name", "a name with code in it is refused before any order or email: " + evil.status);
const quoted = await call("/api/orders", { method: "POST", body: { name: "O'Neil", email: "x@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8003", qty: 1 }] } });
const evilMail = (await call("/api/admin/orders/" + quoted.data.order.id)).data.emails.find(e => e.kind === "order_placed"), evilHtml = (await call("/api/admin/emails/" + evilMail.id)).data.email.html;
ok(!evilHtml.includes("O'Neil") && evilHtml.includes("O&#39;Neil"), "the name is escaped in the email");

// the shop's questionnaire: its private link can add a send but never replace one; the back office shows the newest
const INTAKE = B.replace(/\/$/, "") + "/api/intake/ij9A2jg3vBRk", mark = "m" + Math.random().toString(36).slice(2, 8);
const sendIntake = v => fetch(INTAKE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: { probe: v }, rows: [{ key: "probe", value: v }] }) });
ok((await sendIntake(mark + "-1")).status === 200 && (await sendIntake(mark + "-2")).status === 200, "two sends from the questionnaire are taken");
const list = (await call("/api/admin/intake")).data.sends || [], newest = (await call("/api/admin/intake?key=intake/latest.json")).data;
ok(list.filter(x => x.key === "intake/latest.json").length === 1 && list[0].key === "intake/latest.json" && /^intake\/\d{4}-/.test(list[0].newest || ""), "the list leads with the newest send by name, not a stored file");
ok(newest.answers && newest.answers.probe === mark + "-2", "the back office's newest send is the last one sent: " + JSON.stringify(newest.answers));
ok(list.some(x => x.key !== "intake/latest.json" && x.key !== list[0].newest), "the earlier send is still kept as its own file");
// 2026-11-27: the link is rate-limited (5 a day from one place, 30 a day in all) and every send is labelled with its time and a
// short tag for the place it came from, so a stranger's newer send can never pass for the shop's
{ const from = (v, ip) => fetch(INTAKE, { method: "POST", headers: { "Content-Type": "application/json", ...(ip ? { "CF-Connecting-IP": ip } : {}) }, body: JSON.stringify({ answers: { probe: v }, rows: [] }) });
  const more = []; for (let i = 3; i <= 5; i++) more.push((await from(mark + "-" + i)).status);
  const sixth = await from(mark + "-6"), sixthBody = await sixth.json().catch(() => ({}));
  ok(more.every(s => s === 200) && sixth.status === 429 && /519-255-2222/.test(sixthBody.error || ""), "five sends a day from one place are taken, the sixth is refused with the shop's number: " + more + "," + sixth.status);
  const stranger = await from(mark + "-stranger", "203.0.113.9");
  ok(stranger.status === 200, "another place can still send: " + stranger.status);
  const l2 = (await call("/api/admin/intake")).data.sends || [], top = l2[0], mine = l2.find(x => x.key !== "intake/latest.json" && x.key !== top.newest);
  ok(top && /^[0-9a-f]{8}$/.test(top.from || "") && top.from_n === 1 && mine && /^[0-9a-f]{8}$/.test(mine.from || "") && mine.from !== top.from && mine.from_n === 5, "each send carries its place tag and how many sends came from that place: the stranger's newest stands apart: " + JSON.stringify([top, mine]));
  const earlier = (await call("/api/admin/intake?key=" + encodeURIComponent(mine.key))).data;
  ok(earlier.answers && /^m/.test(earlier.answers.probe) && earlier.from === mine.from, "the owner can open any earlier send by its own name");
  const all = []; for (let i = 0; i < 26; i++) all.push((await from(mark + "-all" + i, `198.51.100.${i + 1}`)).status);
  ok(all.slice(0, 24).every(s => s === 200) && all.slice(24).every(s => s === 429), "thirty sends a day in all are taken, then the link waits for tomorrow: " + all.join(","));
  // breaker 2026-11-27: strangers filling the day never block the shop's own send. A browser signed in to the back office (or a shop
  // device that signed in before) sends past the limits and is not counted against them; a stranger is still refused.
  const shopSend = await fetch(INTAKE, { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.200", Cookie: cookie }, body: JSON.stringify({ answers: { probe: mark + "-shop" }, rows: [] }) });
  ok(shopSend.status === 200, "the shop's own send goes through after strangers used up the day: " + shopSend.status);
  ok((await from(mark + "-late", "198.51.100.201")).status === 429, "a stranger is still refused");
  const l3 = (await call("/api/admin/intake")).data.sends || [], shopRow = l3.find(x => x.key === l3[0].newest);
  ok(shopRow && shopRow.shop === true, "the shop's send is labelled as sent from a shop device");
  // the owner removes sends (the link stops at 300 kept): only dated intake sends, never a backup, and it is logged
  const victim = l3.find(x => x.key !== "intake/latest.json" && x.key !== l3[0].newest);
  const del = await call("/api/admin/intake", { method: "DELETE", body: { key: victim.key } });
  ok(del.status === 200 && !((await call("/api/admin/intake")).data.sends || []).some(x => x.key === victim.key), "the owner removes one send: " + del.status);
  ok((await call("/api/admin/intake", { method: "DELETE", body: { key: victim.key } })).status === 404, "removing it again finds nothing");
  for (const bad of ["backups/2026-11-27.json", "intake/../backups/x.json", "intake/latest.json", "intake/a/b.json", ""]) ok((await call("/api/admin/intake", { method: "DELETE", body: { key: bad } })).status === 400, "only a dated questionnaire send can be removed, not " + JSON.stringify(bad));
  ok((await call("/api/admin/intake", { method: "DELETE" })).status === 415 || (await call("/api/admin/intake", { method: "DELETE" })).status === 400, "a delete without JSON is refused");
}

const bk = await call("/api/admin/backup");
ok(bk.status === 200 && /attachment; filename="one-stop-shop-backup-\d{4}-\d\d-\d\d\.json"/.test(bk.r.headers.get("content-disposition") || ""), "backup downloads as a dated file");
ok(bk.data.tables && bk.data.tables.products.length === seededProductCount() && bk.data.tables.orders.length >= 50 && bk.data.tables.stock_moves.length > 90 && bk.data.tables.emails.length >= 5 && !("sessions" in bk.data.tables), "backup holds products, orders, stock history and emails, and no sign-in tokens");

ok((await call("/api/admin/logout", { method: "POST", body: {} })).status === 200 && (await call("/api/admin/summary")).status === 401, "signing out ends that sign-in for good");
cookie = "";
const wrong = []; for (let i = 0; i < 6; i++) wrong.push((await call("/api/admin/login", { method: "POST", body: { passcode: "wrong-" + i } })).status);
ok(wrong.slice(0, 5).every(s => s === 401) && wrong[5] === 429, "five wrong passcodes lock sign-in: " + wrong.join(","));
ok((await call("/api/admin/login", { method: "POST", body: { passcode: KEY } })).status === 429, "the right passcode is refused too while locked");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
