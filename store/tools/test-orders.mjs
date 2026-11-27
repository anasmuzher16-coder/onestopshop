import { samplesOn } from "./fixtures/samples-on.mjs";
import { withPhone, phoneFor } from "./fixtures/phone.mjs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { orderPlaced, newOrder } from "../src/email.js";
// Order safety against the running local store: the server refuses a total the shopper did not see, and a retry
// after a lost answer can never make a second order. node store/tools/test-orders.mjs   (changes local sample data: reseed afterwards)
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
// The same test-rig guard as test-backoffice.mjs (see its comment): wrangler dev's proxy and the store's process both close a
// kept-alive connection idle for 5 s, and a request handed one just as it closes fails with ECONNRESET (seen here at the line
// after a burst, 2026-11-27, laptop and CI runner alike, store still up). No request starts while a pooled connection is 3.5-7 s
// idle, and a reset before any answer is retried. The requests, their order and every check stay the same.
const pool = [];
const clearOfIdleEdge = async (from = 3500) => {
  for (;;) {
    const now = Date.now(); for (let i = pool.length - 1; i >= 0; i--) if (now - pool[i] >= 7000) pool.splice(i, 1);
    const edge = pool.filter(t => now - t > from).map(t => t + 7000 - now); if (!edge.length) return;
    await new Promise(r => setTimeout(r, Math.max(...edge)));
  }
};
const fetch = async (u, o) => {
  await clearOfIdleEdge(); if (pool.length) pool.splice(pool.indexOf(Math.max(...pool)), 1);
  try { for (let i = 0; ; i++) try { return await globalThis.fetch(u, o); } catch (e) { if (i >= 2 || e?.cause?.code !== "ECONNRESET") throw e; } }
  finally { pool.push(Date.now()); }
};
// the made-up sample rows this suite buys, switched back on in its own throwaway database (tools/fixtures/samples-on.mjs)
await samplesOn(B, ["OSS-7006", "OSS-8004", "OSS-8003", "OSS-7004", "OSS-8001", "OSS-8002", "OSS-8006"]);
// A pay-at-the-counter pickup is a request (2026-11-27): it takes no stock until the shop marks it ready. This suite places many
// requests of the same few samples to test the per-visitor limits, so those get a deep shelf first (the back office's own receive),
// and the request rules have their own checks below on samples left at their seeded stock (OSS-8002, OSS-8006).
const KEY = process.env.ADMIN_KEY || (await import("node:fs")).readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
const adminCookie = ((await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) })).headers.get("set-cookie") || "").split(";")[0];
for (const sku of ["OSS-8004", "OSS-8003", "OSS-7004", "OSS-8001"]) { const r = await fetch(`${B}/api/admin/products/${sku}/receive`, { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: adminCookie }, body: JSON.stringify({ qty: 200, ref: "test shelf" }) }); if (!r.ok) { console.log("FAIL could not stock", sku, r.status); process.exit(1); } }
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
// each order comes from its own made-up address, as real shoppers do: the per-visitor order limits (src/guard.js) have their own checks in test-orders
const shopper = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;
// a counter pickup carries its customer's phone (needed while the shop's mail is off, 2026-11-27: tools/fixtures/phone.mjs)
const post = async body => { const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": shopper() }, body: JSON.stringify(withPhone(body)) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const stockOf = async sku => (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === sku)?.stock;
// each part below orders as its own customer (its own email): one email holds at most 3 unpaid orders at once (src/guard.js)
const who = { name: "Key Tester", email: "key@example.com" }, as = tag => { who.email = `key-${tag}@example.com`; }, key = s => `test-${s}-${crypto.randomUUID()}`.slice(0, 60);
// with no card keys (the live demo) a pickup is paid at the counter, so these orders say so
const pk = /<meta name="oss-pay" content="card">/.test(await (await fetch(B + "/")).text()) ? {} : { pay: "at_pickup" };
const pickup = (sku, qty, extra = {}) => ({ ...who, ...pk, method: "pickup", lines: [{ sku, qty }], ...extra });
// what one order takes from the shelf when it is placed: a card order takes it at once; a pay-at-the-counter request takes nothing
const takes = qty => pk.pay ? 0 : qty;
const admin = (path, body) => fetch(`${B}/api/admin${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: adminCookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }));

// the total
as("total");
const s0 = await stockOf("OSS-8004");
const wrong = await post(pickup("OSS-8004", 1, { expected_total_cents: 1 }));
ok(wrong.status === 409 && wrong.data.repriced?.total_cents > 1, "a total the shopper did not see is refused: " + wrong.status);
ok((await stockOf("OSS-8004")) === s0, "a refused total takes no stock");
const right = await post(pickup("OSS-8004", 1, { expected_total_cents: wrong.data.repriced.total_cents }));
ok(right.status === 201 && right.data.order.total_cents === wrong.data.repriced.total_cents, "the server's own figure goes through: " + right.status);
ok((await post(pickup("OSS-8004", 1, { expected_total_cents: "x" }))).status === 409, "a total that is not a number is refused");

// the same order, sent twice
as("twice");
const k1 = key("a"), s1 = await stockOf("OSS-8004");
const a = await post(pickup("OSS-8004", 1, { order_key: k1 })), b = await post(pickup("OSS-8004", 1, { order_key: k1 }));
ok(a.status === 201 && /^W[A-Z0-9]{6}$/.test(a.data.order?.id), "first send places the order: " + a.status);
ok(b.status === 200 && b.data.replayed === true && b.data.order?.id === a.data.order?.id, "a retry gets the same order back: " + b.status);
ok(b.data.order?.total_cents === a.data.order?.total_cents && b.data.order?.items?.length === 1 && b.data.order?.tax_label === a.data.order?.tax_label, "the retry carries the same figures");
ok((await stockOf("OSS-8004")) === s1 - takes(1), pk.pay ? "a pickup request and its retry take no stock at all" : "stock came down once, not twice");

// sent at the same moment
as("race");
const k2 = key("b"), s2 = await stockOf("OSS-8004");
const race = await Promise.all([1, 2, 3].map(() => post(pickup("OSS-8004", 1, { order_key: k2 }))));
const ids = new Set(race.filter(r => r.data.order).map(r => r.data.order.id));
ok(ids.size === 1 && race.filter(r => r.status === 201).length === 1, "three copies at once make one order: " + race.map(r => r.status).join(","));
ok((await stockOf("OSS-8004")) === s2 - takes(1), pk.pay ? "three copies of a request take no stock" : "three copies take one from stock");

// the last one, then a retry: the retry must not say sold out
as("last");
const last = await stockOf("OSS-7006"), k3 = key("c");
const got = await post(pickup("OSS-7006", last, { order_key: k3 })), again = await post(pickup("OSS-7006", last, { order_key: k3 }));
ok(got.status === 201 && again.status === 200 && again.data.order?.id === got.data.order?.id, `retry of the order that took the last ${last}: ${got.status},${again.status}`);

// a key is not a way to read or change something else
as("twice");   // the customer of the first keyed order
if (a.data.pay?.url) await fetch(a.data.pay.url, { method: "POST", redirect: "manual" });   // the order is paid (Stripe stand-in): it is now final
const other = await post({ ...who, email: "someone@example.com", ...pk, method: "pickup", lines: [{ sku: "OSS-8004", qty: 1 }], order_key: k1 });
ok(other.status === 409 && !other.data.order, "a key with different order details is refused: " + other.status);
const moved = await post({ ...who, name: "Key Corrected", ...pk, method: "pickup", lines: [{ sku: "OSS-8004", qty: 1 }], order_key: k1 });
ok(moved.status === 409 && moved.data.existing_order === a.data.order.id && !moved.data.order, "changed details never replay the old order as a success: " + moved.status);
ok((await post(pickup("OSS-8004", 1, { order_key: "short" }))).status === 400, "a malformed key is refused");
ok((await post(pickup("OSS-8004", 1, { order_key: 12345 }))).status === 400, "a key that is not text is refused");

// ---------- guards against fake orders (breaker review, 2026-11-26; src/guard.js) ----------
// Reads and backdates rows in this suite's own local database (PERSIST, as test-account does).
const PERSIST = process.env.PERSIST;
const WRANGLER = process.env.WRANGLER_JS || join(execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["root", "-g"], { encoding: "utf8", shell: process.platform === "win32" }).trim(), "wrangler", "bin", "wrangler.js");
const sql = cmd => { const out = execFileSync(process.execPath, [WRANGLER, "d1", "execute", "onestopshop", "--local", "--persist-to", PERSIST, "--json", "--command", cmd], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); return JSON.parse(out.slice(out.indexOf("["))).flatMap(r => r.results); };
const wait = ms => new Promise(r => setTimeout(r, ms));
// one shopper at a given address; the shop-wide brake (60 a minute) would be waited out like a shopper would, never a visitor limit
const from = async (ip, body) => { for (let i = 0; ; i++) { const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify(withPhone(body)) }); const out = { status: r.status, data: await r.json().catch(() => ({})) }; if (out.status === 429 && (!out.data.limited || out.data.limited === "busy") && i < 2) { await wait(61000); continue; } return out; } };
const run = Math.random().toString(36).slice(2, 8), counter = (email, sku = "OSS-8003", extra = {}) => ({ name: "Guard Tester", email, method: "pickup", pay: "at_pickup", lines: [{ sku, qty: 1 }], ...extra });
// mail from the shop never carries a link someone typed: a name saved before names were checked, a note, an address
{ const o = { id: "WTEST23", name: "https://evil.example/claim x", method: "pickup", pay_status: "pay_at_pickup", created_at: "2026-11-26T20:00:00Z", pay_expires_at: "2026-11-28T20:00:00Z", subtotal_cents: 100, tax_cents: 13, total_cents: 113, tax_province: "ON", email: "a@b.co", address: JSON.stringify({ note: "go to www.evil.example now" }) };
  const items = [{ name: "Coal", qty: 1, unit_cents: 100 }], mails = [orderPlaced("One Stop Shop", o, items, "at_pickup"), newOrder("One Stop Shop", o, items, "at_pickup")];
  ok(mails.every(m => !/evil\.example|https:\/\/|www\./.test(m.html + m.body)), "no link-shaped text a customer typed survives into the shop's mail, in the HTML or the text part"); }
if (!PERSIST) ok(false, "set PERSIST to the store's --persist-to folder for the guard checks");
else {
  // quantities: a whole number sent as a number, never rounded
  for (const [q, what] of [[99.9, "99.9"], ["50", 'the text "50"'], [0, "0"], [1.5, "1.5"], [null, "nothing"]])
    ok((await from(shopper(), { ...counter(`q-${run}@example.com`), lines: [{ sku: "OSS-8003", qty: q }] })).status === 400, `a quantity of ${what} is refused, not rounded`);
  // caps a real counter order never reaches
  const big = await from(shopper(), { ...counter(`big-${run}@example.com`), lines: [{ sku: "OSS-8003", qty: 21 }] });
  ok(big.status === 400 && big.data.too_big, "21 of one item is refused with the phone number: " + big.status);
  ok((await from(shopper(), { ...counter(`big-${run}@example.com`), lines: [{ sku: "OSS-8003", qty: 15 }, { sku: "OSS-8003", qty: 15 }] })).data.too_big, "the same item split over two lines counts as one line (30 of it)");
  ok((await from(shopper(), { ...counter(`big-${run}@example.com`), lines: ["OSS-8001", "OSS-8003", "OSS-8004"].map(sku => ({ sku, qty: 15 })) })).data.too_big, "45 units in one order is refused");
  ok((await from(shopper(), { ...counter(`big-${run}@example.com`), lines: Array.from({ length: 21 }, (_, i) => ({ sku: "OSS-" + (9000 + i), qty: 1 })) })).data.too_big, "21 different items in one order is refused");
  // the name goes into the shop's mail: letters only, nothing a mail app turns into a link
  const phone = await from(shopper(), counter(`ph-${run}@example.com`, "OSS-8001", { phone: "evil.example/pay" }));
  ok(phone.status === 400 && phone.data.field === "phone", "a phone that is not a phone number is refused: " + phone.status);
  for (const bad of ["https://evil.example/claim x", "evil.example", "Visit www.example.com", "Sam 2", "a@b.co", "<b>x</b>"]) {
    const r = await from(shopper(), counter(`name-${run}@example.com`, "OSS-8001", { name: bad }));
    ok(r.status === 400 && r.data.field === "name", `the name "${bad}" is refused: ${r.status}`);
  }
  const fine = await from(shopper(), counter(`fine-${run}@example.com`, "OSS-8001", { name: "Seán O'Brien-Smith J.R." }));
  ok(fine.status === 201, "a real name with an accent, apostrophe, hyphen and initials goes through: " + fine.status);

  // ---------- 2026-11-27 (fleet/guard4): one PERSON is the main open-order limit; networks only guard against spam ----------
  // Rewritten: these checks used to hold one address to 3 open orders whatever email it typed (carrier NAT, mobile IPv6 pools,
  // Private Relay and public Wi-Fi put strangers on one address, so real customers were turned away for days), and one email to 3
  // from anywhere (so a stranger typing your email used up your slots). Now a person is an email plus the same phone or the same
  // network: 3 open, 5 in 10 minutes, 15 a day. A network takes 20 open, 10 in 10 minutes, 40 a day (an IPv6 /48: 40, 20, 80).
  const em = `same-${run}@example.com`, heldE = [];
  for (let i = 0; i < 3; i++) heldE.push(await from(shopper(), counter(em)));
  const fourthE = await from(shopper(), counter(em.toUpperCase()));
  ok(heldE.every(r => r.status === 201) && fourthE.status === 429 && fourthE.data.limited === "open" && /You already have 3 pickup requests waiting/.test(fourthE.data.error || "") && /519-255-2222/.test(fourthE.data.error || ""), "one person (email and phone) holds 3 open requests from any address, in any case; the fourth is told why, with the shop's number: " + heldE.map(r => r.status) + "," + fourthE.status + " " + (fourthE.data.error || ""));
  const samePhone = await from(shopper(), counter(em, "OSS-8003", { phone: "+1 " + phoneFor(em).replace(/-/g, " ") }));
  ok(samePhone.status === 429 && samePhone.data.limited === "open", "the same phone written another way (+1, spaces) is the same person: " + samePhone.status);
  const stranger = await from(shopper(), counter(em, "OSS-8003", { phone: "226-555-0199" }));
  ok(stranger.status === 201, "a stranger who types that email with their own phone, from their own connection, is not blocked by it, so they cannot use its slots either: " + stranger.status + " " + (stranger.data.error || ""));
  sql(`UPDATE orders SET status = 'ready', ready_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id IN (${heldE.map(r => `'${r.data.order.id}'`).join(",")})`);
  const readyE = await from(shopper(), counter(em));
  ok(readyE.status === 429 && readyE.data.limited === "open", "orders the shop got ready but not yet paid still count for their person: " + readyE.status);
  // changing the phone from one connection does not make a new person (breaker, 2026-11-27: one network could queue 20 that way)
  const ipP = "10.248.5." + ((Math.random() * 200) | 0), spam = `spam-${run}@example.com`, spun = [];
  for (const ph of ["519-555-0301", "519-555-0302", "519-555-0303", "519-555-0304"]) spun.push(await from(ipP, counter(spam, "OSS-8004", { phone: ph })));
  ok(spun.slice(0, 3).every(r => r.status === 201) && spun[3].status === 429 && spun[3].data.limited === "open", "one email from one connection holds 3 open whatever phone it types: " + spun.map(r => r.status));
  // one carrier-shared address: a real customer with 3 open does not block the next real customer on the same address
  const ipA = "10.250.1." + ((Math.random() * 200) | 0), custA = `carrier-a-${run}@example.com`, heldA = [];
  for (let i = 0; i < 3; i++) heldA.push(await from(ipA, counter(custA, "OSS-8004")));
  const fourthA = await from(ipA, counter(custA, "OSS-8004")), custB = await from(ipA, counter(`carrier-b-${run}@example.com`, "OSS-8004"));
  ok(heldA.every(r => r.status === 201) && fourthA.status === 429 && fourthA.data.limited === "open" && custB.status === 201, "on one shared address, a customer with 3 open is stopped and the next customer still orders: " + heldA.map(r => r.status) + "," + fourthA.status + "," + custB.status + " " + (custB.data.error || ""));
  // one address still takes at most 20 open requests from different people (anti-spam). The rate limits (10 in 10 minutes, 40 a
  // day) would stop this first, so this suite moves its own rows' times back two days after each 10 to reach the open count.
  const net = "10.252.3." + ((Math.random() * 200) | 0), netHeld = [], back = list => sql(`UPDATE order_attempts SET at = strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days') WHERE order_id IN (${list.map(r => `'${r.data.order?.id}'`).join(",")})`);
  for (let i = 0; i < 20; i++) { netHeld.push(await from(net, counter(`net${i}-${run}@example.com`, "OSS-8004"))); if (i % 10 === 9) back(netHeld.slice(-10)); }
  const net21 = await from(net, counter(`net20-${run}@example.com`, "OSS-8004"));
  ok(netHeld.every(r => r.status === 201) && net21.status === 429 && net21.data.limited === "network" && /internet connection/.test(net21.data.error || "") && /519-255-2222/.test(net21.data.error || ""), "one address takes 20 open requests from 20 people; the 21st is told the connection may be shared, with the shop's number: " + netHeld.map(r => r.status).join("") + "," + net21.status + " " + (net21.data.error || ""));
  // an IPv6 visitor is one network across its /56: 10 orders in 10 minutes from different /64s inside it, then the rate limit
  const v6 = `2001:db8:${((Math.random() * 65000) | 0).toString(16)}:${(16 + ((Math.random() * 230) | 0)).toString(16)}`, heldV6 = [];   // the first 56 bits; each order adds the last byte of the 4th group (its own /64)
  for (let i = 0; i < 10; i++) heldV6.push(await from(`${v6}${(i + 1).toString(16).padStart(2, "0")}::1`, counter(`v${i}-${run}@example.com`)));
  const eleventhV6 = await from(`${v6}ff:abcd::9`, counter(`v10-${run}@example.com`));
  ok(heldV6.every(r => r.status === 201) && eleventhV6.status === 429 && eleventhV6.data.limited === "rate", "IPv6 addresses in different /64s of one /56 count as one network: " + heldV6.map(r => r.status) + "," + eleventhV6.status);
  // one /48 (a free tunnel holds 256 /56s) is held to 20 orders in 10 minutes in all, however many of its /56s it uses
  const g48 = `2001:db8:${((Math.random() * 65000) | 0).toString(16)}`, heldG = [];
  for (let i = 0; i < 20; i++) heldG.push(await from(`${g48}:${((i + 1) * 256 + 1).toString(16)}::1`, counter(`g${i}-${run}@example.com`, "OSS-8004")));
  const g21 = await from(`${g48}:f901::1`, counter(`g20-${run}@example.com`, "OSS-8004"));
  ok(heldG.every(r => r.status === 201) && g21.status === 429 && g21.data.limited === "rate", "one IPv6 /48 cannot act as many networks: " + heldG.map(r => r.status).join("") + "," + g21.status);
  // one address places at most 10 orders in 10 minutes, and one person at most 5
  const ipR = "10.249.4." + ((Math.random() * 200) | 0), more = [];
  for (let i = 0; i < 10; i++) more.push(await from(ipR, counter(`r10-${i}-${run}@example.com`, "OSS-7004")));
  const extra = await from(ipR, counter(`r10-x-${run}@example.com`, "OSS-7004"));
  ok(more.every(r => r.status === 201) && extra.status === 429 && extra.data.limited === "rate", "an 11th order in 10 minutes from one address is refused: " + more.map(r => r.status).join("") + "," + extra.status);

  // the shop-wide brake cannot be reached by one visitor: a burst of 15 at once places at most 10, the refused ones leave no count
  // behind (breaker, 2026-11-27: they used to stay counted, locking a shared address for a day), and the next shopper gets in
  await wait(61000);   // the last minute holds only this burst
  const ipB = "10.251.2." + ((Math.random() * 200) | 0);
  const burst = await Promise.all(Array.from({ length: 15 }, (_, i) => fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ipB }, body: JSON.stringify(withPhone(counter(`b${i}-${run}@example.com`, "OSS-7004"))) }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }))));
  const placed = burst.filter(r => r.status === 201).length;
  ok(placed <= 10 && burst.every(r => r.status === 201 || r.data.limited), "15 orders at once from one address place at most 10, each refusal from its own limit: " + burst.map(r => r.status));
  const left = sql(`SELECT COUNT(*) AS n FROM order_attempts a WHERE a.who LIKE 'o:%' AND a.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 minutes') AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = a.order_id)`)[0].n;
  ok(left === 0, "an order refused after it was written leaves no network count behind: " + left);
  const next = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": shopper() }, body: JSON.stringify(withPhone(counter(`next-${run}@example.com`, "OSS-8004"))) });
  ok(next.status === 201, "a different shopper is not told the shop is busy after one visitor's burst: " + next.status);

  // ---------- 2026-11-27: the brake, unpaid pickup caps, the half-of-an-item ceiling, emails as one person ----------
  // the shop-wide brake is for a real flood: 14 different shoppers in a minute (past the old 12) all get through
  const crowd = []; for (let i = 0; i < 14; i++) crowd.push(await from(shopper(), counter(`crowd${i}-${run}@example.com`, "OSS-8004")));
  ok(crowd.every(r => r.status === 201), "14 shoppers in one minute are all served (the brake is 60 a minute, not 12): " + crowd.map(r => r.status));
  // an unpaid pickup holds what a counter order needs: 5 of one item, 15 in all
  const six = await from(shopper(), { ...counter(`six-${run}@example.com`), lines: [{ sku: "OSS-8004", qty: 6 }] });
  ok(six.status === 400 && six.data.too_big && /5 of any one item/.test(six.data.error || "") && /519-255-2222/.test(six.data.error || ""), "6 of one item paid at the counter is refused with the shop's number: " + six.status + " " + (six.data.error || ""));
  const fifteen = await from(shopper(), { ...counter(`f15-${run}@example.com`), lines: ["OSS-8004", "OSS-8003", "OSS-8001"].map(sku => ({ sku, qty: 5 })) });
  ok(fifteen.status === 201, "5 each of three items (15 in all) paid at the counter goes through: " + fifteen.status + " " + (fifteen.data.error || ""));
  const sixteen = await from(shopper(), { ...counter(`f16-${run}@example.com`), lines: [...["OSS-8004", "OSS-8003", "OSS-8001"].map(sku => ({ sku, qty: 5 })), { sku: "OSS-7004", qty: 1 }] });
  ok(sixteen.status === 400 && sixteen.data.too_big, "16 in all paid at the counter is refused: " + sixteen.status);
  if (!pk.pay) {   // card keys on: a card order is not an unpaid hold, so it keeps the higher caps
    const card6 = await from(shopper(), { ...counter(`card6-${run}@example.com`), pay: "card", lines: [{ sku: "OSS-8004", qty: 6 }] });
    ok(card6.status === 201, "6 of one item paid by card is still taken: " + card6.status + " " + (card6.data.error || ""));
  }
  // ---------- 2026-11-27: a pay-at-the-counter pickup is a request; stock is taken when the shop marks it ready ----------
  // (replaces the "at most half of an item" checks: that ceiling let one order of 5, or a few real shoppers, make an item
  // unorderable for 48 hours, and ~43 orders from ~15 addresses shut the whole shop)
  const s8002 = await stockOf("OSS-8002"), reqs = [];
  for (let i = 0; i < 8; i++) reqs.push(await from(shopper(), counter(`r${i}-${run}@example.com`, "OSS-8002")));
  const five = await from(shopper(), { ...counter(`r5x-${run}@example.com`), lines: [{ sku: "OSS-8002", qty: 5 }] });
  ok(s8002 === 5 && reqs.every(r => r.status === 201 && r.data.order?.request === true) && five.status === 201, `nine requests for an item with 5 on the shelf (one for all 5) are all taken: ${s8002} ${reqs.map(r => r.status)},${five.status} ${five.data.error || ""}`);
  ok((await stockOf("OSS-8002")) === 5 && sql(`SELECT COUNT(*) AS n FROM stock_moves WHERE ref IN (${[...reqs, five].map(r => `'${r.data.order.id}'`).join(",")})`)[0].n === 0, "requests take no stock and write no stock moves: the shelf still shows 5");
  const rush = await Promise.all(Array.from({ length: 4 }, (_, i) => from(shopper(), counter(`rush${i}-${run}@example.com`, "OSS-8006"))));
  ok(rush.every(r => r.status === 201) && (await stockOf("OSS-8006")) === 4, "4 requests at once for an item with 4 all go through and take nothing: " + rush.map(r => r.status));
  if (!pk.pay) {   // card keys on: a card order still takes its stock at once, whatever requests are open
    const cardAll = await from(shopper(), { ...counter(`cardall-${run}@example.com`), pay: "card", lines: [{ sku: "OSS-8006", qty: 4 }] });
    ok(cardAll.status === 201 && (await stockOf("OSS-8006")) === 0, "a card order takes its stock when placed, unchanged by open requests: " + cardAll.status);
    if (cardAll.data.pay?.url) await fetch(cardAll.data.pay.url, { method: "POST", redirect: "manual" });
  }
  // marking ready takes the stock, all of it or none, in one step
  const ready5 = await admin(`/orders/${five.data.order.id}/status`, { status: "ready" });
  ok(ready5.status === 200 && (await stockOf("OSS-8002")) === 0, "marking the request for 5 ready takes the 5: " + ready5.status + " " + (ready5.data.error || ""));
  ok(sql(`SELECT COUNT(*) AS n FROM stock_moves WHERE ref = '${five.data.order.id}' AND reason = 'sale' AND delta = -5`)[0].n === 1, "one sale line in the stock history, at ready");
  const short = await admin(`/orders/${reqs[0].data.order.id}/status`, { status: "ready" });
  ok(short.status === 409 && Array.isArray(short.data.shortfall) && short.data.shortfall[0]?.sku === "OSS-8002" && short.data.shortfall[0].stock === 0 && /call the customer/.test(short.data.error || ""), "a request the shelf cannot cover is not marked ready: staff are told what is short, to call the customer: " + JSON.stringify(short.data));
  ok((await stockOf("OSS-8002")) === 0 && sql(`SELECT status FROM orders WHERE id = '${reqs[0].data.order.id}'`)[0].status === "pending", "nothing is oversold and the request stays to confirm");
  const twice = await admin(`/orders/${five.data.order.id}/status`, { status: "ready" });
  ok(twice.status === 409 && (await stockOf("OSS-8002")) === 0, "a second tap on ready takes nothing more: " + twice.status);
  ok((await admin(`/orders/${reqs[1].data.order.id}/paid`, {})).status === 409, "a request cannot be marked paid before it is marked ready (that is what checks the shelf)");
  // cancelling a ready order puts its stock back once; cancelling a request never confirmed puts nothing back
  const cx = await Promise.all([1, 2, 3].map(() => admin(`/orders/${five.data.order.id}/cancel`, { reason: "customer", op: crypto.randomUUID() })));
  ok(cx.filter(r => r.status === 200).length === 1 && (await stockOf("OSS-8002")) === 5, "three cancels at once of the ready order: one wins and the 5 go back once: " + cx.map(r => r.status) + " stock " + await stockOf("OSS-8002"));
  const cx2 = await admin(`/orders/${reqs[2].data.order.id}/cancel`, { reason: "customer", op: crypto.randomUUID() });
  ok(cx2.status === 200 && (await stockOf("OSS-8002")) === 5 && sql(`SELECT COUNT(*) AS n FROM stock_moves WHERE ref = '${reqs[2].data.order.id}'`)[0].n === 0, "cancelling a request never confirmed changes no stock: " + cx2.status);
  // two requests of 3 marked ready at the same moment on an item with 5: exactly one is covered
  const t1 = await from(shopper(), { ...counter(`t1-${run}@example.com`), lines: [{ sku: "OSS-8002", qty: 3 }] }), t2 = await from(shopper(), { ...counter(`t2-${run}@example.com`), lines: [{ sku: "OSS-8002", qty: 3 }] });
  const both = await Promise.all([t1, t2].map(t => admin(`/orders/${t.data.order.id}/status`, { status: "ready" })));
  ok(both.filter(r => r.status === 200).length === 1 && both.filter(r => r.status === 409 && r.data.shortfall).length === 1 && (await stockOf("OSS-8002")) === 2, "two requests of 3 marked ready at once on 5: one taken, one told it is short, never below zero: " + both.map(r => r.status) + " stock " + await stockOf("OSS-8002"));
  // an order placed before 2026-11-27 took its stock when placed: it keeps it, ready takes nothing more, a cancel gives back what it took once
  const old = await from(shopper(), counter(`legacy-${run}@example.com`, "OSS-8001"));
  sql(`UPDATE products SET stock = stock - 1 WHERE sku = 'OSS-8001'`); sql(`INSERT INTO stock_moves (sku, delta, reason, ref, actor) VALUES ('OSS-8001', -1, 'sale', '${old.data.order.id}', 'store')`);
  const oldBefore = await stockOf("OSS-8001"), oldReady = await admin(`/orders/${old.data.order.id}/status`, { status: "ready" });
  ok(oldReady.status === 200 && (await stockOf("OSS-8001")) === oldBefore, "an order that already took its stock is marked ready without taking it again: " + oldReady.status);
  await admin(`/orders/${old.data.order.id}/cancel`, { reason: "customer", op: crypto.randomUUID() });
  ok((await stockOf("OSS-8001")) === oldBefore + 1, "and cancelling it puts back the 1 it took, once");
  // an email is one person for the limits: case, +tags and Gmail dots or googlemail do not make a new one (one phone throughout:
  // the same person with the same phone, so only the email's spelling changes)
  const nb = `normtester${run}`, variants = [`Norm.Tester${run.toUpperCase()}+a@gmail.com`, `${nb}+b@googlemail.com`, `n.o.r.m.tester${run}@GMAIL.com`], nph = { phone: phoneFor(nb) };
  const heldN = []; for (const e of variants) heldN.push(await from(shopper(), counter(e, "OSS-8004", nph)));
  const fourthN = await from(shopper(), counter(`${nb}+zzz@gmail.com`, "OSS-8004", nph));
  ok(heldN.every(r => r.status === 201) && fourthN.status === 429 && fourthN.data.limited === "open", "three spellings of one Gmail inbox (same phone) hold 3, the fourth is refused: " + heldN.map(r => r.status) + "," + fourthN.status);
  const kept = sql(`SELECT email FROM orders WHERE id = '${heldN[0].data.order?.id}'`)[0];
  ok(kept && kept.email === variants[0], "the order keeps the email exactly as typed: " + JSON.stringify(kept));
  const plusA = [], dom = `p${run}@example.com`, pph = { phone: phoneFor(dom) };
  for (const tag of ["a", "b", "c"]) plusA.push(await from(shopper(), counter(dom.replace("@", "+" + tag + "@"), "OSS-8004", pph)));
  const plusD = await from(shopper(), counter(dom, "OSS-8004", pph));
  ok(plusA.every(r => r.status === 201) && plusD.status === 429, "+tags on any mail service count as one inbox: " + plusA.map(r => r.status) + "," + plusD.status);

  // a request waits 3 days for the shop to confirm it, holding nothing; the receipt never promises a hold (2026-11-27)
  const stock = async sku => (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === sku)?.stock;
  const before = await stock("OSS-8001"), hold = await from(shopper(), counter(`hold-${run}@example.com`, "OSS-8001"));
  ok(hold.status === 201 && (await stock("OSS-8001")) === before, "the counter request takes no stock: " + hold.status);
  const row = sql(`SELECT CAST((julianday(pay_expires_at) - julianday(created_at)) * 24 + 0.5 AS INTEGER) AS h FROM orders WHERE id = '${hold.data.order.id}'`)[0];
  ok(row && row.h === 72, "the request stays open 3 days for the shop to confirm: " + JSON.stringify(row));
  const mails = sql(`SELECT kind, subject, body FROM emails WHERE order_id = '${hold.data.order.id}'`), rcpt = mails.find(m => m.kind === "order_placed"), note = mails.find(m => m.kind === "new_order");
  ok(rcpt && /order request/.test(rcpt.body) && /wait for that email before you come in/.test(rcpt.body) && /nothing is set aside for you until then/.test(rcpt.body) && !/We hold it/.test(rcpt.body), "the receipt says plainly the shop confirms it is ready before they come in, and promises no hold");
  ok(note && /To confirm/.test(note.body) && /nothing is held yet/.test(note.body) && /mark it ready/.test(note.body) && /to confirm/.test(note.subject) && !/Held until/.test(note.body), "the shop's new-order note shows it as to confirm");
  ok(!mails.some(m => m.kind === "low_stock"), "a request writes no low-stock note: it took nothing");
  // one request still unconfirmed past its time, one the shop marked ready: only the first is closed, and no stock moves
  const ready = await from(shopper(), counter(`ready-${run}@example.com`, "OSS-8001"));
  ok((await admin(`/orders/${ready.data.order.id}/status`, { status: "ready" })).status === 200, "the shop marks the second one ready");
  const readyMail = sql(`SELECT body FROM emails WHERE order_id = '${ready.data.order.id}' AND kind = 'pickup_ready'`)[0];
  ok(readyMail && /set it aside for you/.test(readyMail.body) && /14 days/.test(readyMail.body), "the ready email says it is now set aside, for 14 days");
  sql(`UPDATE orders SET pay_expires_at = strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 minute') WHERE id IN ('${hold.data.order.id}', '${ready.data.order.id}')`);
  const mid = await stock("OSS-8001");
  for (let i = 0; i < 2; i++) { await fetch(B + "/__scheduled?cron=" + encodeURIComponent("*/10 * * * *")); await wait(2000); }
  const after = sql(`SELECT id, status, pay_status FROM orders WHERE id IN ('${hold.data.order.id}', '${ready.data.order.id}') ORDER BY id`), h = after.find(o => o.id === hold.data.order.id), rd = after.find(o => o.id === ready.data.order.id);
  ok(h && h.status === "cancelled" && h.pay_status === "expired", "the request never confirmed is cancelled when its time is up: " + JSON.stringify(h));
  ok(rd && rd.status === "ready" && rd.pay_status === "pay_at_pickup", "an order the shop got ready is not touched: " + JSON.stringify(rd));
  ok((await stock("OSS-8001")) === mid && sql(`SELECT COUNT(*) AS n FROM stock_moves WHERE ref = '${hold.data.order.id}'`)[0].n === 0, "the lapsed request moved no stock: it held none");
  // the ready order is held as the ready email promises, 14 days, then let go, its stock back once
  sql(`UPDATE orders SET ready_at = strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 days') WHERE id = '${ready.data.order.id}'`);
  const mid2 = await stock("OSS-8001");
  for (let i = 0; i < 2; i++) { await fetch(B + "/__scheduled?cron=" + encodeURIComponent("*/10 * * * *")); await wait(2000); }
  const rd2 = sql(`SELECT status, pay_status FROM orders WHERE id = '${ready.data.order.id}'`)[0];
  ok(rd2.status === "cancelled" && rd2.pay_status === "expired" && (await stock("OSS-8001")) === mid2 + 1, "a ready order still unpaid 14 days after it was ready is let go, its 1 back once: " + JSON.stringify(rd2));
  ok(sql(`SELECT COUNT(*) AS n FROM stock_moves WHERE ref = '${ready.data.order.id}' AND reason = 'released'`)[0].n === 1, "one put-back line in the stock history");
}
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
