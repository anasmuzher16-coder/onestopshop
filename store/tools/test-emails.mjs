// Order emails through the mail service, against the Resend stand-in (tools/fake-resend.mjs). A new order sends exactly one
// note to the shop inbox (OWNER_EMAIL) from EMAIL_FROM, with the order lines, the totals and how it goes (pickup, delivery,
// shipping), and one receipt to the customer; a card order sends nothing until Stripe's signed webhook says paid; a send the
// mail service refuses is kept as Failed with its reason, shown in the back office, and sent again by the 10-minute job with
// the same Idempotency-Key (never a second copy); after 5 tries it stops and says so. Works with or without card keys.
// node store/tools/test-emails.mjs   (store started with the fake Resend vars, see fake-resend.mjs; changes local data: reseed afterwards)
import { readFileSync } from "node:fs";
import { samplesOn } from "./fixtures/samples-on.mjs";
const B = (process.env.BASE || "http://127.0.0.1:4489").replace(/\/$/, ""), R = (process.env.RESEND || "http://127.0.0.1:4497").replace(/\/$/, ""), S = (process.env.STRIPE || "http://127.0.0.1:4498").replace(/\/$/, "");
const SHOP = process.env.SHOP_INBOX || "counter@shop.test", FROM = process.env.MAIL_FROM || "One Stop Shop <orders@shop.test>";
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const CARD = /<meta name="oss-pay" content="card">/.test(await (await fetch(B + "/")).text());
await samplesOn(B, ["OSS-2001", "OSS-8001", "OSS-8003", "OSS-8004"]);
const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const admin = async (path, body) => { const r = await fetch(B + "/api/admin" + path, { method: body === undefined ? "GET" : "POST", headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json", "X-OSS-Admin": "1" }) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const post = async body => { for (let i = 0; ; i++) { const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (r.status === 429 && i < 2) { await wait(61000); continue; } return { status: r.status, data: await r.json().catch(() => ({})) }; } };
const mail = async () => (await fetch(R + "/__log")).json();
const forOrder = async id => (await mail()).sent.filter(m => m.subject.includes(id));
// order emails go out in the background after the answer: wait (up to 5 s) until n have reached the stand-in
const settle = async (id, n) => { for (let i = 0; i < 50; i++) { const l = await forOrder(id); if (l.length >= n) return l; await wait(100); } return forOrder(id); };
const sweep = async (ms = 2000) => { const r = await fetch(B + "/__scheduled?cron=" + encodeURIComponent("*/10 * * * *")); await wait(ms); return r.status; };
const emailsOf = async id => (await admin("/orders/" + id)).data.emails;
const money = c => "$" + (c / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const who = { name: "Mail O'Tester", email: "mail@example.com", phone: "519-555-0101" };
const to = { postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" } };
ok(login.status === 200, "signed in to the back office");
ok((await fetch(R + "/__reset", { method: "POST" })).status === 200, "the mail stand-in is up");

// 1 a pickup paid at the counter: one note to the shop inbox, one receipt to the customer, both sent
const a = await post({ ...who, method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8004", qty: 2 }, { sku: "OSS-8001", qty: 1 }] });
ok(a.status === 201, "a counter pickup is placed: " + a.status + " " + (a.data.error || ""));
const A = a.data.order, am = await settle(A.id, 2), shopA = am.filter(m => m.to.includes(SHOP)), custA = am.filter(m => m.to.includes(who.email));
ok(shopA.length === 1 && custA.length === 1 && am.length === 2, `exactly one note to the shop inbox and one receipt: ${am.map(m => m.to.join()).join(" | ")}`);
const sa = shopA[0] || { html: "", text: "", to: [], subject: "" };
ok(sa.from === FROM && am.every(m => m.from === FROM), "both come from EMAIL_FROM: " + sa.from);
ok(sa.to.length === 1 && sa.to[0] === SHOP, "the note goes to the shop inbox only");
ok(sa.subject.includes(A.id) && sa.subject.includes(money(A.total_cents)) && /pickup/.test(sa.subject), "its subject carries the order code, the total and pickup: " + sa.subject);
ok(A.items.every(i => sa.html.includes(`${i.qty} &times; ${i.name.replace(/&/g, "&amp;")}`) && sa.text.includes(`${i.qty} x ${i.name}`)), "it lists every line with its quantity, in the HTML and the plain text");
ok(sa.html.includes(money(A.subtotal_cents)) && sa.html.includes(money(A.tax_cents)) && sa.html.includes(money(A.total_cents)) && /Tax, ON/.test(sa.html), "it carries the items total, the tax and the order total");
ok(/Pickup at the counter/.test(sa.html) && /To pay at pickup/.test(sa.html), "it says pickup at the counter, to pay at pickup");
ok(sa.text.includes("Mail O'Tester") && sa.text.includes(who.phone) && sa.text.includes(who.email), "the plain text names the customer as typed, with phone and email");
ok(sa.reply_to === who.email && custA[0]?.reply_to === SHOP, "a reply to the note reaches the customer; a reply to the receipt reaches the shop inbox");
ok(!/\bID\b|\bage\b|19\+/i.test((custA[0]?.text || "")), "the customer's receipt says nothing about ID or age");
const em = (await admin("/orders/" + A.id)).data.emails;
ok(em.filter(e => e.kind === "new_order").length === 1 && em.filter(e => ["new_order", "order_placed"].includes(e.kind)).every(e => e.status === "sent"), "the back office shows both as sent");
const keys = (await mail()).calls.map(c => c.key);
ok(keys.length >= 2 && keys.every(k => /^oss-[0-9a-f]{32}$/.test(k || "")) && new Set(keys).size === keys.length, "every send carries its own random Idempotency-Key: " + keys.join(","));

// 2 ready for pickup: one email to the customer
ok((await admin(`/orders/${A.id}/status`, { status: "ready" })).status === 200, "the shop marks it ready");
const ready = (await settle(A.id, 3)).filter(m => /ready for pickup/.test(m.subject));
ok(ready.length === 1 && ready[0].to[0] === who.email && ready[0].reply_to === SHOP, "the ready-for-pickup email goes to the customer once, replies to the shop");

// 3 a card order (card mode only): nothing to the shop until Stripe's signed webhook says paid, then one note, however often Stripe calls
if (CARD) {
  const c = await post({ ...who, email: "card-mail@example.com", ...to, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-2001", qty: 1 }] });
  ok(c.status === 201 && c.data.pay?.url, "a card order to ship opens its payment page: " + c.status + " " + (c.data.error || ""));
  ok((await forOrder(c.data.order.id)).length === 0, "an unpaid card order sends no email at all");
  await fetch(S + "/pay/" + c.data.pay.session, { method: "POST", redirect: "manual" });
  await settle(c.data.order.id, 2); await sweep();   // the safety net runs too: it must not send a second copy
  const cm = await forOrder(c.data.order.id), sc = cm.filter(m => m.to.includes(SHOP));
  ok(sc.length === 1 && cm.filter(m => m.to.includes("card-mail@example.com")).length === 1, "paid: one note to the shop and one receipt: " + cm.map(m => m.subject).join(" | "));
  const h = sc[0]?.html || "";
  ok(/Paid by card/.test(h) && /Shipping, /.test(h) && h.includes(money(c.data.order.shipping_cents)) && /Deliver to/.test(h) && h.includes("1 Test Street") && h.includes("M5V 2T6"), "the note says paid by card, the shipping charge, and where it goes");
} else ok(true, "no card keys: the card part is covered in card mode");

// 4 a customer address the mail service would refuse: the shop's note still goes, with no reply-to, and the receipt is
// marked not sent instead of being refused for a day (the stand-in refuses a malformed to or reply_to, as Resend does)
const odd = await post({ ...who, email: "odd<x>@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8004", qty: 1 }] });
ok(odd.status === 201, "checkout takes the looser address: " + odd.status + " " + (odd.data.error || ""));
const om = await settle(odd.data.order.id, 1); await wait(300);
const oe = await emailsOf(odd.data.order.id), on = oe.find(e => e.kind === "new_order"), oc = oe.find(e => e.kind === "order_placed");
ok(om.length === 1 && om[0].to[0] === SHOP && om[0].reply_to === null && on?.status === "sent", "the shop's note is sent, with no reply-to: " + JSON.stringify(om.map(m => m.reply_to)));
ok(oc?.status === "failed" && !oc.next_try_at && /address/.test((await admin("/emails/" + oc.id)).data.email.detail || ""), "the receipt to that address is marked not sent, and not tried again");

// an unusual but valid address (an apostrophe) still gets its receipt, and is the reply-to on the shop's note
const ob = await post({ ...who, email: "o'brien@example.ca", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8004", qty: 1 }] });
const obm = await settle(ob.data.order.id, 2);
ok(obm.some(m => m.to[0] === "o'brien@example.ca") && obm.some(m => m.to[0] === SHOP && m.reply_to === "o'brien@example.ca"), "o'brien@example.ca gets the receipt and is the note's reply-to: " + obm.map(m => m.to.join() + ">" + m.reply_to).join(" | "));

// 5 the mail service fails: kept as Failed with the reason, shown in the back office, sent again by the 10-minute job, once
await fetch(R + "/__fail?n=2&status=500", { method: "POST" });
const b = await post({ ...who, email: "fail-once@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8003", qty: 1 }] });
ok(b.status === 201, "an order still goes through while the mail service is down: " + b.status);
let be = []; for (let i = 0; i < 30; i++) { be = (await emailsOf(b.data.order.id)).filter(e => ["new_order", "order_placed"].includes(e.kind)); if (be.length === 2 && be.every(e => e.status === "failed")) break; await wait(100); }
ok(be.length === 2 && be.every(e => e.status === "failed" && e.next_try_at && !e.gave_up), "both emails are kept as Failed with a next try booked, not lost: " + be.map(e => e.status).join(","));
const note = (await admin("/emails/" + be.find(e => e.kind === "new_order").id)).data.email;
ok(/^try 1: mail service answered 500/.test(note.detail || ""), "the back office shows why: " + note.detail);
ok((await forOrder(b.data.order.id)).length === 0, "nothing reached anyone yet");
await wait(300);
ok((await sweep()) === 200, "the 10-minute job runs");
const bm = await forOrder(b.data.order.id);
ok(bm.filter(m => m.to.includes(SHOP)).length === 1 && bm.filter(m => m.to.includes("fail-once@example.com")).length === 1, "the job sends each one: " + bm.map(m => m.to.join()).join(" | "));
be = (await emailsOf(b.data.order.id)).filter(e => ["new_order", "order_placed"].includes(e.kind));
ok(be.every(e => e.status === "sent" && !e.next_try_at), "and the back office now shows them as sent");
const shopKey = (await mail()).calls.filter(c => c.key === bm.find(m => m.to.includes(SHOP))?.key);
ok(shopKey.length === 2 && shopKey[0].failed === 500 && !shopKey[1].failed, "the retry used the same Idempotency-Key as the failed try");
await sweep();
ok((await forOrder(b.data.order.id)).length === 2, "another run sends nothing more");

// 6 the mail service stays down: tried again for a whole day (here a day is 14.4 s: EMAIL_RETRY_UNIT_MS=10 makes each
// minute 10 ms), backing off, then it stops, says so, and the owner can send it again by hand
const UNIT = +(process.env.EMAIL_RETRY_UNIT_MS || 0);
if (UNIT > 0 && UNIT <= 20) {
  await fetch(R + "/__fail?n=100000&status=503", { method: "POST" });
  const d = await post({ ...who, email: "fail-always@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8004", qty: 1 }] });
  const dnote = async () => (await emailsOf(d.data.order.id)).find(e => e.kind === "new_order");
  const t0 = Date.now(); let early = null, dn = null;
  for (let i = 0; i < 120 && Date.now() - t0 < 1440 * UNIT * 2; i++) {
    await sweep(250); dn = await dnote();
    if (i === 4) early = dn;
    if (dn.status === "failed" && !dn.next_try_at) break;
  }
  ok(early && early.status === "failed" && early.next_try_at && !early.gave_up, "after 5 runs it is still being tried, not given up: " + JSON.stringify(early));
  const log = await mail(), last = log.calls.filter(c => c.failed === 503).pop(), mine = log.calls.filter(c => c.key && c.key === last?.key);
  const span = mine.length > 1 ? mine[mine.length - 1].at - mine[0].at : 0, dd = (await admin("/emails/" + dn.id)).data.email.detail;
  ok(dn.status === "failed" && !dn.next_try_at && dn.gave_up && /^gave up after \d+ tries in a day/.test(dd || ""), "after the day it stops, still Failed, and says so: " + dd);
  ok(span >= 1440 * UNIT * 0.75 && mine.length >= 8, `the tries span the whole day with backoff: ${mine.length} tries over ${span} ms`);
  ok(mine.slice(1).every((c, i) => c.at - mine[i].at >= 9 * UNIT), "never two tries closer than the first wait");
  await fetch(R + "/__fail?n=0", { method: "POST" });
  const re = await admin(`/emails/${dn.id}/resend`, {});
  ok(re.status === 200 && (await dnote()).status === "sent" && (await forOrder(d.data.order.id)).some(m => m.to.includes(SHOP)), "the owner sends it again by hand and it goes: " + re.status + " " + (re.data.error || ""));
  ok((await admin(`/emails/${dn.id}/resend`, {})).status === 409, "a sent email cannot be sent again");
  ok((await admin("/orders/" + d.data.order.id)).data.trail.some(t => t.action === "email.resend"), "the resend is in the order's log");
} else ok(false, "set EMAIL_RETRY_UNIT_MS (10) on the store and this suite to test the day of retries");
await fetch(R + "/__reset", { method: "POST" });
console.log(f ? `FAIL ${f} of ${n} checks (emails${CARD ? ", card" : ""})` : `PASS ${n} checks (emails${CARD ? ", card" : ""})`); process.exit(f ? 1 : 0);
