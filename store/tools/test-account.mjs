// Customer accounts, sticky features and loyalty, against the running local store. Breaks it on purpose: guessing
// codes, reusing codes and links, planted session cookies, other people's orders, account enumeration, and points
// farmed through cancel, refund and two orders at once.
// Needs the store running with --test-scheduled, and PERSIST set to its --persist-to folder (sign-in codes are read
// from the local outbox, the way a customer reads them from their inbox; nothing is sent).
//   PERSIST=<folder> BASE=http://127.0.0.1:4490 node store/tools/test-account.mjs   (changes local sample data: reseed afterwards)
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, ""), PERSIST = process.env.PERSIST;
if (!PERSIST) { console.log("FAIL set PERSIST to the store's --persist-to folder"); process.exit(1); }
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const run = Math.random().toString(36).slice(2, 8), ip = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;
const WRANGLER = process.env.WRANGLER_JS || join(execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["root", "-g"], { encoding: "utf8", shell: process.platform === "win32" }).trim(), "wrangler", "bin", "wrangler.js");
const sql = cmd => { const out = execFileSync(process.execPath, [WRANGLER, "d1", "execute", "onestopshop", "--local", "--persist-to", PERSIST, "--json", "--command", cmd], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); return JSON.parse(out.slice(out.indexOf("["))).flatMap(r => r.results); };
// the local server drops idle kept-alive connections while a database read runs: a reset before any answer is retried
const fetch = async (u, o) => { for (let i = 0; ; i++) try { return await globalThis.fetch(u, o); } catch (e) { if (i >= 2 || e?.cause?.code !== "ECONNRESET") throw e; } };
const H = (cookie, extra = {}) => ({ "Content-Type": "application/json", "X-OSS-Account": "1", "CF-Connecting-IP": extra.ip || "10.9.9.9", ...(cookie ? { Cookie: cookie } : {}), ...extra.h });
async function api(path, { method = "GET", body, cookie, ip: from, h } = {}) {
  const r = await fetch(B + "/api/account" + path, { method, headers: H(cookie, { ip: from, h }), body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})), setCookie: r.headers.get("set-cookie") || "" };
}
const tokenOf = sc => (sc.match(/oss_c=([a-f0-9]*)/) || [])[1];
const lastMail = email => sql(`SELECT id, kind, subject, body, html FROM emails WHERE recipient = '${email}' ORDER BY id DESC LIMIT 1`)[0];
const codeIn = m => (m.body.match(/\b(\d{3}) (\d{3})\b/) || []).slice(1).join("");
const linkIn = m => (m.body.match(/#signin=([a-f0-9]{64})/) || [])[1];
async function signIn(email, from = ip()) {
  const a = await api("/code", { method: "POST", body: { email }, ip: from }); if (a.status !== 200) return { fail: a };
  const v = await api("/verify", { method: "POST", body: { email, code: codeIn(lastMail(email)) }, ip: from });
  return { ...v, cookie: "oss_c=" + tokenOf(v.setCookie) };
}
// An order as a shopper places it. A card order is paid on the Stripe stand-in (tools/fake-stripe.mjs), whose signed
// webhook marks it paid, so "placed" here means paid, as it does for a real shopper.
const order = async (body, cookie) => {
  const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  const out = { status: r.status, data: await r.json().catch(() => ({})) };
  if (out.status === 201 && out.data.pay?.url) { await fetch(out.data.pay.url, { method: "POST", redirect: "manual" }); await new Promise(res => setTimeout(res, 300)); }
  return out;
};
const points = async cookie => (await api("/me", { cookie })).data.loyalty;
const opKey = () => "op-" + run + "-" + Math.random().toString(36).slice(2, 14);
const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", "CF-Connecting-IP": ip() }, body: JSON.stringify({ passcode: KEY }) }), admin = (login.headers.get("set-cookie") || "").split(";")[0];
const adm = async (path, method = "GET", body) => { const r = await fetch(B + "/api/admin" + path, { method, headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: admin }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const cat = (await (await fetch(B + "/api/catalog")).json()).products;
const inStock = cat.filter(p => p.stock >= 6 && p.ship_class !== "pickup_only" && p.category_id !== "shisha" && p.cat !== "shisha" && p.price_cents >= 1000 && p.price_cents < 20000).sort((a, b) => a.price_cents - b.price_cents);
const cheap = inStock[0], mid = inStock.find(p => p.price_cents >= 5000) || inStock[1];
ok(cheap && mid, "found items with stock to order: " + cheap?.sku + " " + mid?.sku);

// ---- 1. guest, enumeration, request rules
const me0 = await api("/me"); ok(me0.status === 200 && me0.data.signed_in === false && me0.data.loyalty.on === false, "a guest is signed out and points are off by default");
const known = `known-${run}@example.com`, unknown = `nobody-${run}@example.com`;
await signIn(known);
const k1 = await api("/code", { method: "POST", body: { email: known }, ip: ip() }), u1 = await api("/code", { method: "POST", body: { email: unknown }, ip: ip() });
ok(k1.status === u1.status && JSON.stringify(k1.data) === JSON.stringify(u1.data), "asking for a code says the same thing for a customer and a stranger (no account enumeration)");
ok((await api("/code", { method: "POST", body: { email: known }, h: { "X-OSS-Account": "" } })).status === 400, "a request without the site's marker is refused");
ok((await api("/code", { method: "POST", body: { email: known }, h: { Origin: "https://evil.example" } })).status === 403, "a request from another website is refused");
ok((await fetch(B + "/api/account/code", { method: "POST", headers: { "Content-Type": "text/plain", "X-OSS-Account": "1" }, body: "email=" + known })).status === 415, "a form post (cross-site style) is refused");
ok((await api("/code", { method: "POST", body: { email: "not an email" } })).status === 400, "a bad email is refused");
const flood = `flood-${run}@example.com`; const fl = [];
for (let i = 0; i < 4; i++) fl.push((await api("/code", { method: "POST", body: { email: flood }, ip: ip() })).status);
ok(fl.join() === "200,200,200,429", "a fourth code for one inbox within 15 minutes is refused, from any network: " + fl);
const m0 = lastMail(flood);
ok(m0 && m0.kind === "sign_in" && /^\d{3} \d{3} is your/.test(m0.subject) && !!linkIn(m0), "the code email holds a 6-digit code and a one-tap link");
const rows0 = sql(`SELECT code_hash, link_hash, used FROM sign_in_codes WHERE email = '${flood}' ORDER BY id`);
ok(rows0.length === 3 && rows0.every(r => r.code_hash.length === 64 && !rows0.some(x => x.code_hash.includes(codeIn(m0)))), "codes are kept only as hashes");
ok(rows0.slice(0, 2).every(r => r.used === 1) && rows0[2].used === 0, "a new code retires the earlier ones");

// ---- 2. guessing a code
const g = `guess-${run}@example.com`, gip = ip();
await api("/code", { method: "POST", body: { email: g }, ip: gip }); const real = codeIn(lastMail(g)), wrong = String((+real + 1) % 1000000).padStart(6, "0");
const tries = []; for (let i = 0; i < 5; i++) tries.push((await api("/verify", { method: "POST", body: { email: g, code: wrong }, ip: gip })).status);
ok(tries.every(s => s === 400), "five wrong codes are refused");
const late = await api("/verify", { method: "POST", body: { email: g, code: real }, ip: gip });
ok(late.status === 400 && !late.setCookie.includes("oss_c=") , "after five wrong tries even the right code is dead");
// parallel guesses cannot get past the five-try limit
const g2 = `race-${run}@example.com`; await api("/code", { method: "POST", body: { email: g2 }, ip: ip() }); const real2 = codeIn(lastMail(g2));
await Promise.all(Array.from({ length: 12 }, (_, i) => api("/verify", { method: "POST", body: { email: g2, code: String((+real2 + 1 + i) % 1000000).padStart(6, "0") }, ip: ip() })));
ok(sql(`SELECT tries FROM sign_in_codes WHERE email = '${g2}'`)[0].tries <= 5, "twelve guesses at once still count as at most five");
ok((await api("/verify", { method: "POST", body: { email: g2, code: real2 }, ip: ip() })).status === 400, "and the code is dead after them");
const cap = `cap-${run}@example.com`; let capSt = [];
for (let round = 0; round < 3; round++) { await new Promise(r => setTimeout(r, 0)); sql(`DELETE FROM sign_in_codes WHERE email = '${cap}'`); await api("/code", { method: "POST", body: { email: cap }, ip: ip() }); for (let i = 0; i < 5; i++) capSt.push((await api("/verify", { method: "POST", body: { email: cap, code: "000000" }, ip: ip() })).status); }
ok(capSt.every(s => s === 400) && (await api("/code", { method: "POST", body: { email: cap }, ip: ip() })).status === 429, "15 wrong codes at one inbox in a day, from any networks, stop new codes for it");
// one network guessing across many inboxes is slowed too
const bip = ip(); let st = [];
for (let i = 0; i < 31; i++) st.push((await api("/verify", { method: "POST", body: { email: `spray${i}-${run}@example.com`, code: "123456" }, ip: bip })).status);
ok(st[29] === 400 && st[30] === 429, "thirty wrong codes from one network lock it out for 15 minutes: " + st.slice(28));

// ---- 3. signing in, fixation, single use, the link
const a = `alice-${run}@example.com`, aip = ip();
await api("/code", { method: "POST", body: { email: a }, ip: aip }); const am = lastMail(a), acode = codeIn(am);
const planted = "a".repeat(64);
const va = await api("/verify", { method: "POST", body: { email: a.toUpperCase(), code: acode.slice(0, 3) + " " + acode.slice(3) }, cookie: "oss_c=" + planted, ip: aip });
const at = tokenOf(va.setCookie), alice = "oss_c=" + at;
ok(va.status === 200 && va.data.me.signed_in && va.data.me.customer.email === a, "the right code signs in (any case, with a space)");
ok(/HttpOnly/.test(va.setCookie) && /SameSite=Lax/.test(va.setCookie) && /Max-Age=2592000/.test(va.setCookie) && /Path=\//.test(va.setCookie), "the cookie is HttpOnly, SameSite=Lax, 30 days");
ok(at && at !== planted && at.length === 64, "sign-in issues a fresh random session, never the one the browser brought (no fixation)");
ok((await api("/me", { cookie: "oss_c=" + planted })).data.signed_in === false, "the planted cookie is worth nothing");
ok((await api("/verify", { method: "POST", body: { email: a, code: acode }, ip: aip })).status === 400, "a code works once");
ok(sql(`SELECT body FROM emails WHERE id = ${am.id}`)[0].body === "This sign-in code is no longer kept.", "the used code is wiped from the outbox copy");
await api("/code", { method: "POST", body: { email: a }, ip: aip }); const link = linkIn(lastMail(a));
const pk = await api("/peek", { method: "POST", body: { link }, ip: aip });
ok(pk.status === 200 && pk.data.email === a && !pk.setCookie.includes("oss_c="), "a link says whose account it opens before it is used (no silent sign-in to someone else's account)");
const vl = await api("/verify", { method: "POST", body: { link }, ip: aip }), alice2 = "oss_c=" + tokenOf(vl.setCookie);
ok(vl.status === 200 && vl.data.me.customer.email === a, "the one-tap link signs in");
ok((await api("/verify", { method: "POST", body: { link }, ip: aip })).status === 400, "the link works once");
ok((await api("/verify", { method: "POST", body: { link: "f".repeat(64) }, ip: aip })).status === 400, "a made-up link is refused");
ok((await api("/me", { cookie: alice2 })).data.signed_in && (await api("/me", { cookie: alice })).data.signed_in, "two devices can be signed in at once");
ok((await api("/me", { cookie: "oss_c=" + at.slice(0, 63) + "x" })).data.signed_in === false, "a tampered cookie is signed out");

// ---- 4. orders: guest orders join, nobody sees anyone else's
const guestOrder = await order({ name: "Alice Guest", email: a.toUpperCase(), method: "pickup", lines: [{ sku: cheap.sku, qty: 1 }] });
ok(guestOrder.status === 201 && guestOrder.data.order.account === false && guestOrder.data.order.points === 0, "guest checkout still works with no account");
const bob = (await signIn(`bob-${run}@example.com`)).cookie;
const bobOrder = await order({ name: "Bob", email: `bob-${run}@example.com`, method: "pickup", lines: [{ sku: cheap.sku, qty: 1 }] }, bob);
ok(bobOrder.status === 201 && bobOrder.data.order.account === true, "a signed-in order joins the account");
const aRe = await signIn(a); const aliceNow = aRe.cookie;
const ao = (await api("/orders", { cookie: aliceNow })).data.orders;
ok(ao.some(o => o.id === guestOrder.data.order.id), "an earlier guest order with the same email shows in the account after sign-in");
ok(!ao.some(o => o.id === bobOrder.data.order.id) && !(await api("/orders", { cookie: bob })).data.orders.some(o => o.id === guestOrder.data.order.id), "nobody sees another customer's orders");
ok((await api("/orders/" + bobOrder.data.order.id, { cookie: aliceNow })).status === 404, "there is no way to ask for an order by its code");
ok(ao[0].items.length && ao[0].items[0].sku === cheap.sku, "orders come with their items, for Buy again");
ok((await api("/orders")).status === 401, "orders need a sign-in");

// ---- 5. details, favourites, alerts
ok((await api("/details", { method: "PUT", cookie: aliceNow, body: { name: "Alice", phone: "123", address: {} } })).status === 400, "a short phone number is refused");
ok((await api("/details", { method: "PUT", cookie: aliceNow, body: { name: "Alice", phone: "", address: { postal: "12345" } } })).status === 400, "a US zip is refused as a postal code");
const d = await api("/details", { method: "PUT", cookie: aliceNow, body: { name: "Alice Test", phone: "519-555-0199", address: { line1: "7 D3000 Coal St", city: "Windsor", postal: "n9a1a1" } } });
ok(d.status === 200 && d.data.me.customer.address.postal === "N9A 1A1" && d.data.me.customer.phone === "519-555-0199", "details and the delivery address save, postal code tidied");
ok((await api("/favourites", { method: "POST", cookie: aliceNow, body: { sku: mid.sku, on: true } })).status === 200 && (await api("/me", { cookie: aliceNow })).data.favourites.includes(mid.sku), "an item can be saved");
await api("/favourites", { method: "POST", cookie: aliceNow, body: { sku: mid.sku, on: false } });
ok(!(await api("/me", { cookie: aliceNow })).data.favourites.includes(mid.sku), "and unsaved");
ok((await api("/favourites", { method: "POST", cookie: aliceNow, body: { sku: "OSS-0000", on: true } })).status === 404, "an item that does not exist cannot be saved");
ok((await api("/favourites", { method: "POST", body: { sku: mid.sku, on: true } })).status === 401, "saving needs a sign-in");
ok((await api("/alerts", { method: "POST", cookie: aliceNow, body: { sku: mid.sku, on: true } })).status === 409, "no back-in-stock alert for something in stock");
const soldSku = sql("SELECT sku FROM products WHERE active = 1 AND stock = 0 AND category_id != 'heat' LIMIT 1")[0].sku;
ok((await api("/alerts", { method: "POST", cookie: aliceNow, body: { sku: soldSku, on: true } })).status === 200, "a sold-out item can be watched: " + soldSku);
const restock = await adm(`/products/${soldSku}/stock`, "POST", { delta: 2, reason: "received" });
await new Promise(r => setTimeout(r, 1500));
const bis = lastMail(a);
ok(restock.status === 200 && bis.kind === "back_in_stock" && bis.body.includes("/p/" + soldSku) && /account\?stop=[a-f0-9]{48}/.test(bis.body) && /760 Wyandotte/.test(bis.body), "stock coming back writes the alert email, with the shop's address and an unsubscribe link");
ok(!(await api("/me", { cookie: aliceNow })).data.alerts.includes(soldSku), "the alert is used up after one email");

// ---- 6. the charcoal reminder (CASL)
ok((await api("/reminder", { method: "PUT", cookie: aliceNow, body: { days: 21 } })).status === 400, "the reminder needs the consent box");
ok((await api("/reminder", { method: "PUT", cookie: aliceNow, body: { days: 5, consent: true } })).status === 400, "only the offered intervals");
ok((await api("/reminder", { method: "PUT", cookie: aliceNow, body: { days: 21, consent: true } })).status === 200, "the reminder turns on with consent");
const cons = sql(`SELECT remind_days, remind_consent_at, remind_consent_text, unsub_token FROM customers WHERE email = '${a}'`)[0];
ok(cons.remind_days === 21 && cons.remind_consent_at && cons.remind_consent_text === (await api("/me", { cookie: aliceNow })).data.reminder.words, "the consent words kept are the words the page shows, with the time");
const log = sql(`SELECT words, detail, withdrawn_at FROM marketing_consents WHERE email = '${a}'`);
ok(log.length === 1 && /every 21 days/.test(log[0].detail) && !log[0].withdrawn_at, "the yes is logged with its interval");
await fetch(B + "/__scheduled?cron=0+8+*+*+*"); await new Promise(r => setTimeout(r, 1500));
ok(lastMail(a).kind !== "restock_reminder", "no reminder before the interval has passed");
sql(`UPDATE customers SET remind_consent_at = '2026-01-01T00:00:00Z' WHERE email = '${a}'`);
await fetch(B + "/__scheduled?cron=0+8+*+*+*"); await new Promise(r => setTimeout(r, 2000));
const rm = lastMail(a);
ok(rm.kind === "restock_reminder" && rm.body.includes("account?stop=" + cons.unsub_token) && /760 Wyandotte/.test(rm.body), "the reminder is written once due, with unsubscribe and the shop's address");
const before = sql(`SELECT COUNT(*) AS n FROM emails WHERE recipient = '${a}' AND kind = 'restock_reminder'`)[0].n;
await fetch(B + "/__scheduled?cron=0+8+*+*+*"); await new Promise(r => setTimeout(r, 1500));
ok(sql(`SELECT COUNT(*) AS n FROM emails WHERE recipient = '${a}' AND kind = 'restock_reminder'`)[0].n === before, "and not again the next day");
ok((await api("/unsubscribe", { method: "POST", body: { token: cons.unsub_token } })).status === 200 && (await api("/me", { cookie: aliceNow })).data.reminder.days === null, "the unsubscribe link turns it off without signing in");
ok((await api("/unsubscribe", { method: "POST", body: { token: "0".repeat(48) } })).status === 200, "a wrong unsubscribe token gets the same answer");

// ---- 7. points: off by default, then on
const offOrder = await order({ name: "Alice", email: a, method: "pickup", lines: [{ sku: cheap.sku, qty: 1 }] }, aliceNow);
ok(offOrder.data.order.points === 0 && sql(`SELECT COUNT(*) AS n FROM loyalty_ledger WHERE order_id = '${offOrder.data.order.id}'`)[0].n === 0, "with points off, orders earn nothing");
ok((await order({ name: "Alice", email: a, method: "pickup", use_reward: true, lines: [{ sku: cheap.sku, qty: 1 }] }, aliceNow)).status === 409, "with points off, a reward cannot be taken");
ok((await fetch(B + "/api/admin/loyalty", { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ on: true }) })).status === 401, "only the back office can turn points on");
ok((await adm("/loyalty", "PUT", { reward_points: 5 })).status === 400, "settings outside the limits are refused");
ok((await adm("/loyalty", "PUT", { points_per_dollar: 10, reward_points: 10, reward_cents: 10000 })).status === 400 && (await adm("/loyalty", "PUT", { reward_cents: 1100 })).status === 400, "a setting that gives back more than 10 cents a dollar is refused");
const on = await adm("/loyalty", "PUT", { on: true });
ok(on.status === 200 && on.data.loyalty.on && on.data.loyalty.points_per_dollar === 1 && on.data.loyalty.reward_points === 100 && on.data.loyalty.reward_cents === 500 && /5 cents on every dollar/.test(on.data.cost), "points turn on with the defaults: 1 a dollar, $5 at 100 (" + on.data.cost + ")");
const carol = (await signIn(`carol-${run}@example.com`)).cookie, carolEmail = `carol-${run}@example.com`;
const big = cat.find(p => p.stock >= 3 && p.price_cents >= 15000 && p.ship_class !== "pickup_only" && p.category_id !== "shisha" && p.active !== 0);
const o1 = await order({ name: "Carol", email: carolEmail, method: "pickup", lines: [{ sku: big.sku, qty: 1 }] }, carol);
const earned = Math.floor(big.price_cents / 100);
ok(o1.status === 201 && o1.data.order.points === earned, `a paid order earns 1 point a dollar of items: ${o1.data.order.points} for ${big.price_cents} cents`);
let lv = (await api("/me", { cookie: carol })).data.loyalty;
ok(lv.points === 0 && lv.coming === earned && !lv.can_redeem, "points are on the way until the order is picked up");
ok((await order({ name: "Carol", email: carolEmail, method: "pickup", use_reward: true, lines: [{ sku: cheap.sku, qty: 1 }] }, carol)).data.reward_gone === true, "points on the way cannot be spent yet");
await adm(`/orders/${o1.data.order.id}/status`, "POST", { status: "ready" }); await adm(`/orders/${o1.data.order.id}/status`, "POST", { status: "collected" });
lv = (await api("/me", { cookie: carol })).data.loyalty;
ok(lv.points === earned && lv.coming === 0 && lv.can_redeem, "picked up: the points count");
// a reward comes off before tax, and the shop's numbers agree
const sub = mid.price_cents, o2 = await order({ name: "Carol", email: carolEmail, method: "pickup", use_reward: true, lines: [{ sku: mid.sku, qty: 1 }] }, carol);
ok(o2.status === 201 && o2.data.order.reward_cents === 500 && o2.data.order.tax_cents === Math.round((sub - 500) * 0.13) && o2.data.order.total_cents === sub - 500 + Math.round((sub - 500) * 0.13), "the $5 reward comes off the items before HST: " + JSON.stringify({ r: o2.data.order.reward_cents, t: o2.data.order.tax_cents, tot: o2.data.order.total_cents }));
ok(o2.data.order.points === Math.floor((sub - 500) / 100), "points are earned on what was paid for, not on the reward");
const rec = lastMail(carolEmail); ok(rec.kind === "order_placed" && /Points reward/.test(rec.body), "the receipt shows the reward");
lv = (await api("/me", { cookie: carol })).data.loyalty; ok(lv.points === earned - 100, "the reward spent 100 points: " + lv.points);
// farming: cancel the order that used the reward -> points come back; refund the order that earned them -> they go
sql(`UPDATE orders SET status = 'cancelled' WHERE id = '${o2.data.order.id}'`);
lv = (await api("/me", { cookie: carol })).data.loyalty; ok(lv.points === earned && lv.coming === 0, "cancelling the order that spent points gives them back, and its own earnings never count");
sql(`UPDATE orders SET status = 'refunded' WHERE id = '${o1.data.order.id}'`);
lv = (await api("/me", { cookie: carol })).data.loyalty; ok(lv.points === 0 && !lv.can_redeem, "refunding the order that earned them takes them back: " + lv.points);
ok((await order({ name: "Carol", email: carolEmail, method: "pickup", use_reward: true, lines: [{ sku: cheap.sku, qty: 1 }] }, carol)).status === 409, "and they cannot be spent after the refund");
// two orders at once cannot spend the same 100 points
const carolId = sql(`SELECT id FROM customers WHERE email = '${carolEmail}'`)[0].id;
sql(`INSERT INTO loyalty_ledger (customer_id, kind, points, note) VALUES (${carolId}, 'adjust', 100, 'test')`);
const race = await Promise.all([1, 2, 3].map(() => order({ name: "Carol", email: carolEmail, method: "pickup", use_reward: true, lines: [{ sku: cheap.sku, qty: 1 }] }, carol)));
ok(race.filter(r => r.status === 201).length === 1 && race.filter(r => r.data.reward_gone).length === 2, "three orders at once with 100 points: exactly one gets the reward (" + race.map(r => r.status) + ")");
ok(sql("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'")[0].n === 0, "the refused ones leave no half-made order");
ok((await order({ name: "G", email: "g@example.com", method: "pickup", use_reward: true, lines: [{ sku: cheap.sku, qty: 1 }] })).status === 409, "a guest cannot take a reward");
const forged = await order({ name: "Carol", email: carolEmail, method: "pickup", use_reward: true, reward_cents: 99999, points: 99999, lines: [{ sku: cheap.sku, qty: 1 }] }, carol);
ok(forged.status === 409 && sql(`SELECT COUNT(*) AS n FROM loyalty_ledger WHERE customer_id = ${carolId} AND points > 1000`)[0].n === 0, "numbers sent by the phone are ignored");

// ---- 7b. the real refund and cancel paths take points back (payments refund, back office cancel), never a hand edit
const erinEmail = `erin-${run}@example.com`, erin = (await signIn(erinEmail)).cookie;
const e1 = await order({ name: "Erin", email: erinEmail, method: "pickup", lines: [{ sku: big.sku, qty: 1 }] }, erin), e1pts = Math.floor(big.price_cents / 100);
await adm(`/orders/${e1.data.order.id}/status`, "POST", { status: "ready" }); await adm(`/orders/${e1.data.order.id}/status`, "POST", { status: "collected" });
ok((await points(erin)).points === e1pts, "a card order paid through Stripe and collected earns its points: " + e1pts);
const paid1 = sql(`SELECT paid_cents FROM orders WHERE id = '${e1.data.order.id}'`)[0].paid_cents, half = Math.floor(paid1 / 2);
const rep0 = (await adm("/report")).data.refunds;
const rf1 = await adm(`/orders/${e1.data.order.id}/refund`, "POST", { op: opKey(), amount_cents: half });
const rep1 = (await adm("/report")).data.refunds;
ok(rep1.total === rep0.total + half && rep1.orders === rep0.orders, `the monthly report takes a part refund off the month, without counting a whole refunded order: ${rep0.total} -> ${rep1.total}`);
ok(rf1.status === 200 && (await points(erin)).points === Math.floor(e1pts * (paid1 - half) / paid1), `a part refund takes back its share of the points: ${(await points(erin)).points} of ${e1pts}`);
const rf2 = await adm(`/orders/${e1.data.order.id}/refund`, "POST", { op: opKey() });
ok(rf2.status === 200 && rf2.data.order?.status === "refunded" && (await points(erin)).points === 0, "refunding the rest through the back office takes every point back");
const rep2 = (await adm("/report")).data.refunds;
ok(rep2.total === rep0.total + paid1 && rep2.orders === rep0.orders + 1, "once fully refunded, the report holds the whole amount and one refunded order");
const signMail = sql(`SELECT id FROM emails WHERE kind = 'sign_in' ORDER BY id DESC LIMIT 1`)[0];
ok(signMail && (await adm(`/emails/${signMail.id}`)).status === 404, "the back office cannot open a customer's sign-in email");
const e2 = await order({ name: "Erin", email: erinEmail, method: "pickup", lines: [{ sku: mid.sku, qty: 1 }] }, erin), e2pts = Math.floor(mid.price_cents / 100);
ok((await points(erin)).coming === e2pts, "a paid order's points are on the way");
const cx = await adm(`/orders/${e2.data.order.id}/cancel`, "POST", { op: opKey(), reason: "customer" });
ok(cx.status === 200 && cx.data.refund_owed === true && (await points(erin)).coming === 0, "cancelling a paid order in the back office voids its points, and says the card refund is still owed");
await adm(`/orders/${e2.data.order.id}/refund`, "POST", { op: opKey() });
ok((await points(erin)).points === 0 && (await points(erin)).coming === 0, "refunding the cancelled order changes nothing more: " + JSON.stringify(await points(erin)));
const e3 = await order({ name: "Erin", email: erinEmail, method: "pickup", pay: "at_pickup", lines: [{ sku: mid.sku, qty: 1 }] }, erin);
ok(e3.status === 201 && (await points(erin)).coming === e2pts, "an order to pay at the counter shows its points on the way");
const cx3 = await adm(`/orders/${e3.data.order.id}/cancel`, "POST", { op: opKey(), reason: "no_show" });
ok(cx3.status === 200 && (await points(erin)).coming === 0 && (await points(erin)).points === 0, "a no-show cancelled in the back office earns nothing");
// a reward spent on an order the back office cancels comes back
const erinId = sql(`SELECT id FROM customers WHERE email = '${erinEmail}'`)[0].id;
sql(`INSERT INTO loyalty_ledger (customer_id, kind, points, note) VALUES (${erinId}, 'adjust', 100, 'test')`);
const e4 = await order({ name: "Erin", email: erinEmail, method: "pickup", use_reward: true, lines: [{ sku: mid.sku, qty: 1 }] }, erin);
ok(e4.status === 201 && e4.data.order.reward_cents === 500 && (await points(erin)).points === 0, "the reward spent 100 points on a card order");
const sess = sql(`SELECT pay_status, paid_cents, total_cents FROM orders WHERE id = '${e4.data.order.id}'`)[0];
ok(sess.pay_status === "paid" && sess.paid_cents === sess.total_cents, "Stripe charged exactly the total after the reward: " + JSON.stringify(sess));
await adm(`/orders/${e4.data.order.id}/cancel`, "POST", { op: opKey(), reason: "customer" });
ok((await points(erin)).points === 100, "cancelling that order in the back office gives the 100 points back");
// a refund handed back at the till, recorded in the back office: off the monthly report and the points, like a card refund
const e5 = await order({ name: "Erin", email: erinEmail, method: "pickup", pay: "at_pickup", lines: [{ sku: big.sku, qty: 1 }] }, erin), e5id = e5.data.order.id;
for (const step of [["status", { status: "ready" }], ["paid", {}], ["status", { status: "collected" }]]) await adm(`/orders/${e5id}/${step[0]}`, "POST", step[1]);
const paid5 = sql(`SELECT paid_cents FROM orders WHERE id = '${e5id}'`)[0].paid_cents, half5 = Math.floor(paid5 / 2);
ok((await points(erin)).points === 100 + e1pts && paid5 > 0, "a counter order paid and collected earns its points: " + JSON.stringify(await points(erin)));
ok((await adm(`/orders/${e5id}/counter-refund`, "POST", { op: opKey(), amount_cents: half5 })).status === 400, "a counter refund says why");
ok((await adm(`/orders/${e1.data.order.id}/counter-refund`, "POST", { op: opKey(), reason: "returned" })).status === 409, "a card order is refunded to the card, not recorded as a counter refund");
ok((await adm(`/orders/${e5id}/counter-refund`, "POST", { op: opKey(), amount_cents: paid5 + 1, reason: "returned" })).status === 409, "a counter refund can never be more than was paid");
const rep5 = (await adm("/report")).data.refunds, op5 = opKey();
const cr1 = await adm(`/orders/${e5id}/counter-refund`, "POST", { op: op5, amount_cents: half5, reason: "one piece returned" });
const cr1b = await adm(`/orders/${e5id}/counter-refund`, "POST", { op: op5, amount_cents: half5, reason: "one piece returned" });
ok(cr1.status === 200 && cr1b.status === 200 && cr1b.data.replayed && sql(`SELECT refunded_cents FROM orders WHERE id = '${e5id}'`)[0].refunded_cents === half5, "a part refund at the counter is recorded once, even when the tap is sent twice");
ok((await adm("/report")).data.refunds.total === rep5.total + half5 && (await points(erin)).points === 100 + Math.floor(e1pts * (paid5 - half5) / paid5), "it comes off the monthly report and takes back its share of the points: " + JSON.stringify(await points(erin)));
const cr2 = await adm(`/orders/${e5id}/counter-refund`, "POST", { op: opKey(), reason: "the rest returned" });
const rep6 = (await adm("/report")).data.refunds;
ok(cr2.status === 200 && cr2.data.order?.status === "refunded" && (await points(erin)).points === 100 && rep6.total === rep5.total + paid5 && rep6.orders === rep5.orders + 1, "the rest refunded at the counter: the order is refunded, every point it earned is gone, the report holds it whole");
const e6 = await order({ name: "Erin", email: erinEmail, method: "pickup", pay: "at_pickup", lines: [{ sku: mid.sku, qty: 1 }] }, erin), e6id = e6.data.order.id;
for (const step of [["status", { status: "ready" }], ["paid", {}], ["cancel", { op: opKey(), reason: "customer" }]]) await adm(`/orders/${e6id}/${step[0]}`, "POST", step[1]);
const rep7 = (await adm("/report")).data.refunds;
ok((await adm(`/orders/${e6id}/counter-refund`, "POST", { op: opKey(), reason: "returned" })).status === 409 && (await adm("/report")).data.refunds.total === rep7.total, "a cancelled order takes no counter refund: the report already counts it given back, and stays as it was");
ok((await adm(`/orders/${e5id}`)).data.trail.some(a => a.action === "order.counter_refund" && a.actor === "owner"), "the counter refund is in the order's history with who recorded it");

// ---- 8. sign out, sign out everywhere, delete
const dan = `dan-${run}@example.com`, d1 = (await signIn(dan)).cookie, d2 = (await signIn(dan)).cookie;
const so = await api("/sign-out", { method: "POST", cookie: d1, body: {} });
ok(so.status === 200 && /Max-Age=0/.test(so.setCookie) && !(await api("/me", { cookie: d1 })).data.signed_in && (await api("/me", { cookie: d2 })).data.signed_in, "signing out ends this device only");
const d3 = (await signIn(dan)).cookie;
await api("/sign-out", { method: "POST", cookie: d3, body: { everywhere: true } });
ok(!(await api("/me", { cookie: d2 })).data.signed_in && !(await api("/me", { cookie: d3 })).data.signed_in, "sign out everywhere ends every device");
ok((await api("/delete", { method: "POST", cookie: aliceNow, body: {} })).status === 400, "deleting needs the confirmation");
const del = await api("/delete", { method: "POST", cookie: aliceNow, body: { confirm: "delete" } });
ok(del.status === 200 && !(await api("/me", { cookie: aliceNow })).data.signed_in && !(await api("/me", { cookie: alice2 })).data.signed_in, "delete my account signs out every device");
ok(sql(`SELECT COUNT(*) AS n FROM customers WHERE email = '${a}'`)[0].n === 0 && sql(`SELECT COUNT(*) AS n FROM orders WHERE id = '${guestOrder.data.order.id}' AND customer_id IS NULL`)[0].n === 1, "the account is gone; its orders stay as guest orders (tax records)");
ok(sql(`SELECT COUNT(*) AS n FROM marketing_consents WHERE email = '${a}' AND withdrawn_at IS NOT NULL`)[0].n >= 1, "the consent record outlives the account, marked withdrawn (CASL proof)");

// ---- 9. nothing about age or ID where customers look
const words = JSON.stringify([(await api("/me", { cookie: carol })).data, (await api("/orders", { cookie: carol })).data]) + sql(`SELECT subject || html AS t FROM emails WHERE kind IN ('sign_in','back_in_stock','restock_reminder') ORDER BY id DESC LIMIT 20`).map(r => r.t).join(" ");
ok(!/\bage\b|photo id|legal age|adult|19\+/i.test(words) && !/\bID\b/.test(words), "no age or ID wording in account answers or account emails");
await adm("/loyalty", "PUT", { on: false });
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
