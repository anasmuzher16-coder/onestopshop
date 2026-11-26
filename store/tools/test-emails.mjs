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
const sweep = async () => { const r = await fetch(B + "/__scheduled?cron=" + encodeURIComponent("*/10 * * * *")); await wait(2000); return r.status; };
const money = c => "$" + (c / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const who = { name: "Mail O'Tester", email: "mail@example.com", phone: "519-555-0101" };
const to = { postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" } };
ok(login.status === 200, "signed in to the back office");
ok((await fetch(R + "/__reset", { method: "POST" })).status === 200, "the mail stand-in is up");

// 1 a pickup paid at the counter: one note to the shop inbox, one receipt to the customer, both sent
const a = await post({ ...who, method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8004", qty: 2 }, { sku: "OSS-8001", qty: 1 }] });
ok(a.status === 201, "a counter pickup is placed: " + a.status + " " + (a.data.error || ""));
const A = a.data.order, am = await forOrder(A.id), shopA = am.filter(m => m.to.includes(SHOP)), custA = am.filter(m => m.to.includes(who.email));
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
ok(keys.length && keys.every(k => /^oss-email-\d+$/.test(k || "")), "every send carries its own Idempotency-Key");

// 2 ready for pickup: one email to the customer
ok((await admin(`/orders/${A.id}/status`, { status: "ready" })).status === 200, "the shop marks it ready");
const ready = (await forOrder(A.id)).filter(m => /ready for pickup/.test(m.subject));
ok(ready.length === 1 && ready[0].to[0] === who.email && ready[0].reply_to === SHOP, "the ready-for-pickup email goes to the customer once, replies to the shop");

// 3 a card order (card mode only): nothing to the shop until Stripe's signed webhook says paid, then one note, however often Stripe calls
if (CARD) {
  const c = await post({ ...who, email: "card-mail@example.com", ...to, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-2001", qty: 1 }] });
  ok(c.status === 201 && c.data.pay?.url, "a card order to ship opens its payment page: " + c.status + " " + (c.data.error || ""));
  ok((await forOrder(c.data.order.id)).length === 0, "an unpaid card order sends no email at all");
  await fetch(S + "/pay/" + c.data.pay.session, { method: "POST", redirect: "manual" });
  await sweep();   // the safety net runs too: it must not send a second copy
  const cm = await forOrder(c.data.order.id), sc = cm.filter(m => m.to.includes(SHOP));
  ok(sc.length === 1 && cm.filter(m => m.to.includes("card-mail@example.com")).length === 1, "paid: one note to the shop and one receipt: " + cm.map(m => m.subject).join(" | "));
  const h = sc[0]?.html || "";
  ok(/Paid by card/.test(h) && /Shipping, /.test(h) && h.includes(money(c.data.order.shipping_cents)) && /Deliver to/.test(h) && h.includes("1 Test Street") && h.includes("M5V 2T6"), "the note says paid by card, the shipping charge, and where it goes");
} else ok(true, "no card keys: the card part is covered in card mode");

// 4 the mail service fails: kept as Failed with the reason, shown in the back office, sent again by the 10-minute job, once
await fetch(R + "/__fail?n=2&status=500", { method: "POST" });
const b = await post({ ...who, email: "fail-once@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8003", qty: 1 }] });
ok(b.status === 201, "an order still goes through while the mail service is down: " + b.status);
let be = (await admin("/orders/" + b.data.order.id)).data.emails.filter(e => ["new_order", "order_placed"].includes(e.kind));
ok(be.length === 2 && be.every(e => e.status === "failed"), "both emails are kept as Failed, not lost: " + be.map(e => e.status).join(","));
const note = (await admin("/emails/" + be.find(e => e.kind === "new_order").id)).data.email;
ok(/^try 1: mail service answered 500/.test(note.detail || ""), "the back office shows why: " + note.detail);
ok((await forOrder(b.data.order.id)).length === 0, "nothing reached anyone yet");
ok((await sweep()) === 200, "the 10-minute job runs");
const bm = await forOrder(b.data.order.id);
ok(bm.filter(m => m.to.includes(SHOP)).length === 1 && bm.filter(m => m.to.includes("fail-once@example.com")).length === 1, "the job sends each one: " + bm.map(m => m.to.join()).join(" | "));
be = (await admin("/orders/" + b.data.order.id)).data.emails.filter(e => ["new_order", "order_placed"].includes(e.kind));
ok(be.every(e => e.status === "sent"), "and the back office now shows them as sent");
const shopKey = (await mail()).calls.filter(c => c.key === `oss-email-${be.find(e => e.kind === "new_order").id}`);
ok(shopKey.length === 2 && shopKey[0].failed === 500 && !shopKey[1].failed, "the retry used the same Idempotency-Key as the failed try");
await sweep();
ok((await forOrder(b.data.order.id)).length === 2, "another run sends nothing more");

// 5 the mail service stays down: 5 tries, then it stops and says so
await fetch(R + "/__fail?n=1000&status=503", { method: "POST" });
const d = await post({ ...who, email: "fail-always@example.com", method: "pickup", pay: "at_pickup", lines: [{ sku: "OSS-8004", qty: 1 }] });
const dnote = () => admin("/orders/" + d.data.order.id).then(r => r.data.emails.find(e => e.kind === "new_order"));
for (let i = 0; i < 5; i++) await sweep();
const dn = await dnote(), dd = (await admin("/emails/" + dn.id)).data.email.detail;
ok(dn.status === "failed" && /^gave up after 5 tries: mail service answered 503/.test(dd || ""), "after 5 tries it stops, still Failed, and says so: " + dd);
ok((await mail()).calls.filter(c => c.key === `oss-email-${dn.id}`).length === 5, "exactly 5 tries were made");
await fetch(R + "/__reset", { method: "POST" });
console.log(f ? `FAIL ${f} of ${n} checks (emails${CARD ? ", card" : ""})` : `PASS ${n} checks (emails${CARD ? ", card" : ""})`); process.exit(f ? 1 : 0);
