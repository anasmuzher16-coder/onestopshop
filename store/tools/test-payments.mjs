// Payment checks against the running local store and the Stripe stand-in (tools/fake-stripe.mjs). Covers: the total
// Stripe is asked for is the server's own (tampered prices and totals do nothing), only a signed, fresh, matching
// webhook marks an order paid, repeats and doubles count once, an expired page gives the stock back exactly once,
// a lost webhook is caught by the sweep, pay at the counter, charcoal never offered a carrier, and refunds.
// node store/tools/test-payments.mjs   (store started with the fake Stripe vars and --test-scheduled; changes local data: reseed afterwards)
import { readFileSync } from "node:fs";
import { post as hook, completed, expired, intentSucceeded, event } from "./fixtures/stripe-webhooks.mjs";
const B = (process.env.BASE || "http://127.0.0.1:4489").replace(/\/$/, ""), S = (process.env.STRIPE || "http://127.0.0.1:4498").replace(/\/$/, "");
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0, cookie = ""; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
// the shop's brake allows 12 new orders a minute: this suite makes more, so a 429 waits out the minute and goes again
const post = async body => { for (let i = 0; ; i++) { const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (r.status === 429 && i < 2) { await new Promise(w => setTimeout(w, 61000)); continue; } return { status: r.status, data: await r.json().catch(() => ({})) }; } };
const admin = async (path, body) => { const r = await fetch(B + "/api/admin" + path, { method: body === undefined ? "GET" : "POST", headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json", "X-OSS-Admin": "1" }) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const stockOf = async sku => (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === sku)?.stock;
const session = async id => (await fetch(S + "/__session/" + id)).json();
const order = async id => (await admin("/orders/" + id)).data;
const status = async s => (await (await fetch(B + "/api/pay/status?session=" + s)).json()).pay;
const wait = ms => new Promise(r => setTimeout(r, ms));
const who = { name: "Pay Tester", email: "pay@example.com" };
const pickup = (sku, qty, extra = {}) => ({ ...who, method: "pickup", lines: [{ sku, qty }], ...extra });
const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) }); cookie = (login.headers.get("set-cookie") || "").split(";")[0];
ok(login.status === 200, "signed in to the back office");

// 1 tampering: prices, totals and amounts from the browser are ignored; Stripe is asked for the server's figure
const s0 = await stockOf("OSS-2001"), PRICE = (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === "OSS-2001").price_cents;   // the shelf price, read from the shop
const t = await post({ ...who, postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" }, method: "ship", service: "cp-exp", lines: [{ sku: "OSS-2001", qty: 1, price: 0.01, unit_cents: 1 }], total_cents: 1, amount: 1, subtotal_cents: 1 });
ok(t.status === 201 && t.data.pay?.status === "awaiting" && /^http:\/\/127\.0\.0\.1:4498\/pay\/cs_/.test(t.data.pay?.url || ""), "card order opens a payment page: " + t.status + " " + (t.data.error || ""));
const ts = await session(t.data.pay.session);
ok(ts.amount_total === t.data.order.total_cents && ts.currency === "cad" && t.data.order.subtotal_cents === PRICE, `Stripe is asked for the server's total ${t.data.order.total_cents}, got ${ts.amount_total}`);
ok(ts.line_items_sent.some(l => l.price_data.unit_amount === String(PRICE)) && !ts.line_items_sent.some(l => l.price_data.unit_amount === "1"), "line prices come from the database");
ok(ts.metadata.order_id === t.data.order.id && ts.client_reference_id === t.data.order.id, "the page carries the order code");
ok((await stockOf("OSS-2001")) === s0 - 1, "stock is held while payment is open");
ok((await order(t.data.order.id)).order.status === "pending", "not paid yet: the order waits");
ok((await post({ ...who, method: "pickup", lines: [{ sku: "OSS-8004", qty: 1 }], expected_total_cents: 1 })).status === 409, "a total the shopper did not see is refused");
ok((await post({ ...who, method: "pickup", pay: "bitcoin", lines: [{ sku: "OSS-8004", qty: 1 }] })).status === 400, "an unknown way to pay is refused");

// 2 forged and stale webhooks change nothing
const forged = completed(ts);
for (const [sig, label] of [["none", "unsigned"], ["wrong", "signed with another secret"], ["old", "signed ten minutes ago"], ["t=1,v1=abc", "garbage signature"]]) {
  const r = await hook(B, forged, sig); ok(r.status === 400, `${label} webhook refused: ${r.status}`);
}
const body = JSON.stringify(forged), tamperedBody = body.replace(`"amount_total":${ts.amount_total}`, '"amount_total":1');
const { sign } = await import("./fixtures/stripe-webhooks.mjs");
const swap = await fetch(B + "/api/pay/webhook", { method: "POST", headers: { "Stripe-Signature": sign(body) }, body: tamperedBody });
ok(swap.status === 400, "a body changed after signing is refused");
ok((await order(t.data.order.id)).order.status === "pending", "after the forgeries the order is still unpaid");
const cheap = await hook(B, completed(ts, { amount_total: 100 }));
ok(cheap.status === 200 && cheap.data.result === "mismatch" && (await order(t.data.order.id)).order.status === "pending", "a signed event for the wrong amount does not pay the order");
const otherSession = await hook(B, completed({ ...ts, id: "cs_test_notours000000" }));
ok(otherSession.data.result === "mismatch", "a signed event for another page does not pay the order");
const live = await hook(B, completed(ts, {}), "good"); // control below uses the real one
ok(live.status === 200 && live.data.result === "paid", "the real signed event marks it paid: " + JSON.stringify(live.data));

// 3 the same event again, and the other events for the same payment, count once
const o1 = await order(t.data.order.id);
ok(o1.order.status === "paid" && o1.order.pay_status === "paid" && o1.order.paid_cents === ts.amount_total, "order is paid for the full amount");
ok(o1.emails.filter(e => e.kind === "order_placed").length === 1, "one receipt, written after the webhook");
const again = await hook(B, completed(ts, { payment_intent: o1.order.pay_intent }));
const pi = await hook(B, intentSucceeded(ts, o1.order.pay_intent));
ok(again.data.result === "repeat" && pi.data.result !== "paid", "a second completed event changes nothing, and a payment_intent event never pays an order: " + again.data.result + "," + pi.data.result);
const replayEv = completed(ts, { payment_intent: o1.order.pay_intent }); await hook(B, replayEv); const r2 = await hook(B, replayEv);
ok(r2.data.repeat === true, "the very same event id is recognised as a repeat");
ok((await order(t.data.order.id)).emails.filter(e => e.kind === "order_placed").length === 1, "still one receipt after four deliveries");
const lateExpire = await hook(B, expired(ts));
ok(lateExpire.data.result === "repeat" && (await stockOf("OSS-2001")) === s0 - 1, "an expiry after payment puts no stock back");
ok(await status(ts.id) === "paid", "the order page's status call says paid");
ok((await fetch(B + "/api/pay/status?session=nope")).status === 404, "the status call needs a real page id");

// 4 the page expires unpaid: stock comes back once, however many expiry events arrive
const e0 = await stockOf("OSS-8004");
const ex = await post(pickup("OSS-8004", 2));
ok(ex.status === 201 && (await stockOf("OSS-8004")) === e0 - 2, "a second order holds 2");
const xs = await session(ex.data.pay.session), exp1 = expired(xs);
const both = await Promise.all([hook(B, exp1), hook(B, expired(xs)), hook(B, expired(xs))]);
ok(both.filter(r => r.data.result === "released").length === 1, "three expiry events at once release once: " + both.map(r => r.data.result).join(","));
ok((await stockOf("OSS-8004")) === e0, "the 2 are back on the shelf, not 4 or 6");
const exo = (await order(ex.data.order.id)).order;
ok(exo.status === "cancelled" && exo.pay_status === "expired", "the expired order is closed as not paid");
const late = await hook(B, completed(xs)), lateO = (await order(ex.data.order.id)).order;
ok(late.data.result === "paid_after_cancel" && lateO.status === "cancelled" && lateO.pay_status === "paid" && (await stockOf("OSS-8004")) === e0, "money arriving for a closed order never revives it or takes stock, but is kept on record as a refund owed");
ok((await order(ex.data.order.id)).emails.every(e => e.kind !== "order_placed"), "no receipt was ever written for it");

// 5 a lost webhook: the sweep asks Stripe itself
const l0 = await stockOf("OSS-8003");
const lost = await post(pickup("OSS-8003", 1)), lostExp = await post({ ...pickup("OSS-8002", 1), email: "lost2@example.com" }), l2 = await stockOf("OSS-8002");
await fetch(S + "/__complete/" + lost.data.pay.session + "?send=0", { method: "POST" });
await fetch(S + "/__expire/" + lostExp.data.pay.session + "?send=0", { method: "POST" });
const sw = await fetch(B + "/__scheduled?cron=" + encodeURIComponent("*/10 * * * *")); await wait(1500);
ok(sw.status === 200, "the sweep runs: " + sw.status);
ok((await order(lost.data.order.id)).order.status === "paid" && (await stockOf("OSS-8003")) === l0 - 1, "a payment whose webhook was lost is found by the sweep");
ok((await order(lostExp.data.order.id)).order.pay_status === "expired" && (await stockOf("OSS-8002")) === l2 + 1, "an expiry whose webhook was lost gives the stock back");

// 6 Stripe cannot make the page: nothing charged, stock straight back, the same key can try again
const f0 = await stockOf("OSS-8004");
await fetch(S + "/__fail?next=/v1/checkout/sessions");
const key = "pay-" + crypto.randomUUID();
const down = await post(pickup("OSS-8004", 1, { order_key: key }));
ok(down.status === 503 && down.data.pay_down === true && (await stockOf("OSS-8004")) === f0, "payment page failure: 503 and the stock is back");
const retry = await post(pickup("OSS-8004", 1, { order_key: key }));
ok(retry.status === 201 && retry.data.pay?.url, "the same order tried again gets a page: " + retry.status);
const replay = await post(pickup("OSS-8004", 1, { order_key: key }));
ok(replay.status === 200 && replay.data.replayed && replay.data.pay?.url === retry.data.pay.url && (await stockOf("OSS-8004")) === f0 - 1, "a retry returns the same payment page, stock held once");
const changed = await post({ ...pickup("OSS-8004", 1, { order_key: key }), name: "Pay Tester Changed" });
ok(changed.status === 201 && changed.data.order.id !== retry.data.order.id && (await session(retry.data.pay.session)).status === "expired", "changing details before paying closes the old page and starts a new order");
await wait(300);
ok((await stockOf("OSS-8004")) === f0 - 1, "the old order's stock went back, the new one holds 1");

// 7 pay at the counter
const c0 = await stockOf("OSS-8001");
ok((await post({ ...who, postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" }, method: "ship", service: "cp-exp", pay: "at_pickup", lines: [{ sku: "OSS-8001", qty: 1 }] })).status === 400, "pay at the counter is refused for shipping");
const cp = await post(pickup("OSS-8001", 1, { pay: "at_pickup" }));
ok(cp.status === 201 && cp.data.pay.status === "pay_at_pickup" && !cp.data.pay.url && (await stockOf("OSS-8001")) === c0 - 1, "pay at the counter: placed, stock held, no payment page");
let co = await order(cp.data.order.id);
ok(co.order.status === "pending" && co.order.pay_status === "pay_at_pickup", "it waits as pay at pickup");
const mail = co.emails.find(e => e.kind === "order_placed"), html = mail ? (await admin("/emails/" + mail.id)).data.email.html : "";
ok(/pay at the counter/i.test(html) && !/payment went through/i.test(html) && !/\bID\b|age/i.test(html.replace(/<[^>]+>/g, " ").replace(/page|message|manage/gi, "")), "its email says pay at the counter, never paid, and nothing about ID or age");
ok((await admin(`/orders/${cp.data.order.id}/refund`, { op: "x".repeat(20) })).status === 409, "nothing to refund on a counter order");
ok((await admin(`/orders/${cp.data.order.id}/status`, { status: "ready" })).status === 200, "it can be got ready before it is paid");
ok((await admin(`/orders/${cp.data.order.id}/status`, { status: "collected" })).status === 409, "it cannot be handed over unpaid");
ok((await admin(`/orders/${cp.data.order.id}/paid`, {})).status === 200, "the shop marks it paid at the counter");
ok((await admin(`/orders/${cp.data.order.id}/paid`, {})).status === 409, "marking it paid twice is refused");
co = await order(cp.data.order.id);
ok(co.order.pay_status === "paid" && co.order.paid_cents === co.order.total_cents && co.order.status === "ready", "paid at the counter, still ready for pickup");
ok((await admin(`/orders/${cp.data.order.id}/status`, { status: "collected" })).status === 200, "now it can be collected");
const forgedPickup = await hook(B, event("checkout.session.completed", { id: "cs_test_x1234567", object: "checkout.session", payment_status: "paid", amount_total: 1, currency: "cad", payment_intent: "pi_x", metadata: { order_id: cp.data.order.id } }));
ok(forgedPickup.data.result === "mismatch", "a webhook cannot touch a counter order");

// 8 charcoal: never a carrier, card or counter
const coal = (await (await fetch(B + "/api/catalog")).json()).products.find(p => /"charcoal":true/.test(p.details || "") && p.stock > 0);
if (coal) {
  const byPost = await post({ ...who, postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" }, method: "ship", service: "cp-exp", lines: [{ sku: coal.sku, qty: 1 }] });
  ok(byPost.status === 409 && byPost.data.local_only === true, "charcoal is never shipped by a carrier, even when paying by card: " + byPost.status);
  const pk = await post(pickup(coal.sku, 1, { pay: "at_pickup" }));
  ok(pk.status === 201, "charcoal can be picked up and paid at the counter");
} else ok(false, "no charcoal in the sample data to test with");

// 9 refunds: partial, full, never more than paid, never twice
const r0 = await post(pickup("OSS-8004", 1, { email: "refund@example.com" }));
await fetch(S + "/pay/" + r0.data.pay.session, { method: "POST", redirect: "manual" });
const rid = r0.data.order.id, total = r0.data.order.total_cents;
ok((await order(rid)).order.pay_status === "paid", "refund test order is paid");
ok((await admin(`/orders/${rid}/refund`, { amount_cents: 500 })).status === 400, "a refund needs its own key");
const op1 = crypto.randomUUID(), part = await admin(`/orders/${rid}/refund`, { op: op1, amount_cents: 1000, reason: "scratched base" });
ok(part.status === 200 && part.data.order.pay_status === "part_refunded" && part.data.order.refunded_cents === 1000, "partial refund of $10: " + part.status + " " + (part.data.error || ""));
const dup = await admin(`/orders/${rid}/refund`, { op: op1, amount_cents: 2000 });
ok(dup.status === 200 && (await order(rid)).order.refunded_cents === 1000, "the same refund tap sent twice (even with a different amount) refunds once, for what was booked");
ok((await admin(`/orders/${rid}/refund`, { op: crypto.randomUUID(), amount_cents: total })).status === 409, "more than is left is refused");
ok((await admin(`/orders/${rid}/refund`, { op: crypto.randomUUID(), amount_cents: -5 })).status === 400 && (await admin(`/orders/${rid}/refund`, { op: crypto.randomUUID(), amount_cents: 1.5 })).status === 400, "negative and fractional amounts are refused");
const left = total - 1000, race = await Promise.all([1, 2, 3].map(() => admin(`/orders/${rid}/refund`, { op: crypto.randomUUID(), amount_cents: left })));
ok(race.filter(r => r.status === 200).length === 1, "three full-remainder refunds at once: exactly one goes through: " + race.map(r => r.status).join(","));
const after = (await order(rid)).order;
ok(after.refunded_cents === total && after.pay_status === "refunded" && after.status === "refunded", "fully refunded, never past what was paid: " + after.refunded_cents + "/" + total);
ok((await admin(`/orders/${rid}/refund`, { op: crypto.randomUUID() })).status === 409, "nothing left to refund");
const rl = (await admin(`/orders/${rid}/refunds`)).data.refunds;
ok(rl.filter(r => r.status === "succeeded").reduce((a, r) => a + r.amount_cents, 0) === total, "the refunds list adds up to the payment");
const unpaid = await post(pickup("OSS-8003", 1, { email: "unpaid@example.com" }));
ok((await admin(`/orders/${unpaid.data.order.id}/refund`, { op: crypto.randomUUID() })).status === 409, "an unpaid order cannot be refunded");
ok((await fetch(B + `/api/admin/orders/${rid}/refund`, { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ op: crypto.randomUUID() }) })).status === 401, "refunds need the back office sign-in");
await fetch(S + "/__fail?next=/v1/refunds");
const r3 = await post(pickup("OSS-8003", 1, { email: "refund3@example.com" })); await fetch(S + "/pay/" + r3.data.pay.session, { method: "POST", redirect: "manual" });
const bad = await admin(`/orders/${r3.data.order.id}/refund`, { op: crypto.randomUUID() }), stillPaid = (await order(r3.data.order.id)).order;
ok(bad.status === 502 && stillPaid.pay_status === "paid" && stillPaid.refunded_cents === 0, "a refund Stripe refuses books nothing");
ok((await admin(`/orders/${r3.data.order.id}/refund`, { op: crypto.randomUUID() })).status === 200, "and can be tried again");

// 10 the order list in the back office shows how each order is paid; no order is left half-made
const list = (await admin("/orders")).data.orders;
ok(list.some(o => o.id === cp.data.order.id && o.pay_method === "at_pickup") && list.some(o => o.id === rid && o.pay_method === "card"), "the order list carries the way to pay");
ok((await fetch(B + "/api/pay/webhook")).status === 405, "the webhook only takes POST");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
