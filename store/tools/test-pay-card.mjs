// Card mode, the parts test-payments.mjs does not cover: what the payment page offers (card, Apple Pay and Google Pay come
// from the Stripe Dashboard because the page names no payment method), a payment that settles later (a wallet or bank
// method: "waiting", then paid only by its own signed event), a later failure giving the stock back, a live-mode event
// never paying a test order, shisha refused for card until STRIPE_TOBACCO_OK=1 and taken by card once it is, and charcoal
// never sent by a carrier however it is paid. Card mode only: it fails if the store has no card keys.
// node store/tools/test-pay-card.mjs   (store started with the fake Stripe vars, optionally STRIPE_TOBACCO_OK:1; changes local data: reseed afterwards)
import { readFileSync } from "node:fs";
import { samplesOn } from "./fixtures/samples-on.mjs";
import { post as hook, completed, event } from "./fixtures/stripe-webhooks.mjs";
const B = (process.env.BASE || "http://127.0.0.1:4489").replace(/\/$/, ""), S = (process.env.STRIPE || "http://127.0.0.1:4498").replace(/\/$/, "");
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const home = await (await fetch(B + "/")).text();
if (!/<meta name="oss-pay" content="card">/.test(home)) { console.log("FAIL this suite needs card mode: start the store with the fake Stripe keys"); process.exit(1); }
const TOBACCO = /<meta name="oss-shisha-card" content="1">/.test(home);
// the runner says which mode it started the store in (ci-suites.mjs: "+tobacco" runs set EXPECT_TOBACCO=1); a store in the other mode fails here
if (process.env.EXPECT_TOBACCO !== undefined && (process.env.EXPECT_TOBACCO === "1") !== TOBACCO) { console.log(`FAIL expected shisha by card ${process.env.EXPECT_TOBACCO === "1" ? "on" : "off"}, the store says ${TOBACCO ? "on" : "off"}`); process.exit(1); }
await samplesOn(B, ["OSS-8003", "OSS-8004"]);
const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
// each order comes from its own made-up address, as real shoppers do: the per-visitor order limits (src/guard.js) have their own checks in test-orders
const shopper = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;
const post = async body => { for (let i = 0; ; i++) { const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": shopper() }, body: JSON.stringify(body) }); if (r.status === 429 && i < 2) { await new Promise(w => setTimeout(w, 61000)); continue; } return { status: r.status, data: await r.json().catch(() => ({})) }; } };
const order = async id => (await (await fetch(B + "/api/admin/orders/" + id, { headers: { Cookie: cookie } })).json());
const session = async id => (await fetch(S + "/__session/" + id)).json();
const stockOf = async sku => (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === sku)?.stock;
const who = { name: "Card Tester", email: "card@example.com" }, to = { postal: "M5V 2T6", address: { line1: "1 Test Street", city: "Toronto" } };
const pickup = (sku, qty = 1, extra = {}) => ({ ...who, method: "pickup", lines: [{ sku, qty }], ...extra });
ok(login.status === 200, "signed in to the back office");

// 1 the payment page: built by the server, paid on Stripe's own page, no method pinned (the Dashboard turns on card, Apple Pay, Google Pay)
const a = await post(pickup("OSS-8004"));
ok(a.status === 201 && a.data.pay?.status === "awaiting" && /\/pay\/cs_/.test(a.data.pay?.url || ""), "a card pickup opens Stripe's payment page: " + a.status + " " + (a.data.error || ""));
const as = await session(a.data.pay.session);
ok(as.mode === "payment" && as.currency === "cad" && as.amount_total === a.data.order.total_cents, "one payment in Canadian dollars for exactly the order's total");
ok(as.payment_method_types === null, "the page names no payment method, so card, Apple Pay and Google Pay follow the Stripe Dashboard: " + JSON.stringify(as.payment_method_types));

// 2 a method that settles later: the page completes unpaid, the order waits, and only the success event pays it
const a0 = await stockOf("OSS-8004");
const waiting = await hook(B, completed(as, { payment_status: "unpaid", payment_intent: "pi_test_later000001" }));
ok(waiting.status === 200 && waiting.data.result === "waiting" && (await order(a.data.order.id)).order.status === "pending", "completed but not yet paid: the order waits, unpaid: " + JSON.stringify(waiting.data));
ok(!(await order(a.data.order.id)).emails.some(e => e.kind === "order_placed" || e.kind === "new_order"), "no receipt and no shop note while the money has not landed");
const later = await hook(B, event("checkout.session.async_payment_succeeded", { ...as, status: "complete", payment_status: "paid", payment_intent: "pi_test_later000001" }));
const ao = await order(a.data.order.id);
ok(later.data.result === "paid" && ao.order.status === "paid" && ao.order.paid_cents === as.amount_total && ao.order.pay_intent === "pi_test_later000001", "the signed success event pays it: " + JSON.stringify(later.data));
ok(ao.emails.filter(e => e.kind === "order_placed").length === 1 && ao.emails.filter(e => e.kind === "new_order").length === 1, "then one receipt and one note to the shop");
ok((await stockOf("OSS-8004")) === a0, "paying takes no more stock than the order already held");

// 3 a method that fails later: the order closes and its stock comes back once
const b0 = await stockOf("OSS-8003"), b = await post({ ...pickup("OSS-8003"), email: "later-fail@example.com" }), bs = await session(b.data.pay.session);
ok(b.status === 201 && (await stockOf("OSS-8003")) === b0 - 1, "a second order holds its stock");
await hook(B, completed(bs, { payment_status: "unpaid", payment_intent: "pi_test_later000002" }));
const fails = await Promise.all([1, 2].map(() => hook(B, event("checkout.session.async_payment_failed", { ...bs, status: "complete", payment_status: "unpaid" }))));
const bo = (await order(b.data.order.id)).order;
ok(fails.filter(r => r.data.result === "released").length === 1 && bo.status === "cancelled" && bo.pay_status === "failed" && (await stockOf("OSS-8003")) === b0, "a later failure closes it unpaid and gives the stock back once: " + fails.map(r => r.data.result).join(","));

// 4 a live-mode event can never pay a test-mode order
const c = await post({ ...pickup("OSS-8004"), email: "livemode@example.com" }), cs = await session(c.data.pay.session);
const liveEv = await hook(B, { ...completed(cs), livemode: true });
ok(liveEv.status === 200 && liveEv.data.ignored === "mode" && (await order(c.data.order.id)).order.status === "pending", "a live-mode event is ignored by a test-mode shop: " + JSON.stringify(liveEv.data));

// 5 shisha: paid in the shop until the card company approves it in writing (STRIPE_TOBACCO_OK=1), then by card like anything else
const mod = await (await fetch(B + "/api/catalog-module")).text(), { PRODUCTS: P } = await import("data:text/javascript," + encodeURIComponent(mod));
const shisha = P.find(p => p.cat === "shisha" && p.state === "sale" && p.stock > 2), plain = P.find(p => p.sku === "OSS-8004");
ok(!!shisha, "there is a shisha flavour on sale to test with");
if (shisha) {
  const s0 = await stockOf(shisha.sku);
  ok(P.filter(p => p.cat === "shisha").every(p => p.details && p.details.tobacco === true), "every shisha row carries the tobacco flag, not only its section");
  if (!TOBACCO) {
    const card = await post(pickup(shisha.sku));
    ok(card.status === 409 && card.data.counter_only === true && !card.data.pay, "STRIPE_TOBACCO_OK off: shisha by card is refused with pay at the counter: " + card.status + " " + (card.data.error || ""));
    const mixed = await post({ ...who, method: "pickup", lines: [{ sku: plain.sku, qty: 1 }, { sku: shisha.sku, qty: 1 }] });
    ok(mixed.status === 409 && mixed.data.counter_only === true, "a card cart mixing shisha with anything else is refused whole");
    const ship = await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: shisha.sku, qty: 1 }] });
    ok(ship.status === 409 && (ship.data.counter_only === true || ship.data.local_only === true), "shisha is never shipped while it is paid in the shop: " + ship.status + " " + (ship.data.error || ""));
    ok((await stockOf(shisha.sku)) === s0, "refused shisha orders hold no stock");
    const counter = await post(pickup(shisha.sku, 1, { pay: "at_pickup" }));
    ok(counter.status === 201 && counter.data.pay.status === "pay_at_pickup" && !counter.data.pay.url && counter.data.order.subtotal_cents === Math.round(shisha.price * 100), "shisha picked up and paid at the counter sells at the shop's price: " + counter.status);
    ok(/Pickup in Windsor, paid in the shop/.test(await (await fetch(B + "/p/" + shisha.sku)).text()), "its page says pickup, paid in the shop");
  } else {
    const card = await post(pickup(shisha.sku));
    ok(card.status === 201 && /\/pay\/cs_/.test(card.data.pay?.url || "") && card.data.order.subtotal_cents === Math.round(shisha.price * 100), "STRIPE_TOBACCO_OK=1: shisha by card opens a payment page at the shop's price: " + card.status + " " + (card.data.error || ""));
    await fetch(S + "/pay/" + card.data.pay.session, { method: "POST", redirect: "manual" });
    const co = (await order(card.data.order.id)).order;
    ok(co.status === "paid" && co.pay_method === "card", "and the signed webhook marks it paid");
    ok(!/paid in the shop/.test(await (await fetch(B + "/p/" + shisha.sku)).text()), "its page no longer says paid in the shop");
  }
}

// 6 charcoal: by card or at the counter, never a carrier
const coal = P.find(p => p.details && p.details.charcoal && p.state === "sale" && p.stock > 1);
ok(!!coal, "there is charcoal on sale to test with");
if (coal) {
  for (const service of ["cp-exp", "cp-reg", "cp-xp"]) {
    const r = await post({ ...who, ...to, method: "ship", service, lines: [{ sku: coal.sku, qty: 1 }] });
    ok(r.status === 409 && r.data.local_only === true && !r.data.pay, `charcoal by card is never sent by carrier (${service}): ${r.status} ${r.data.error || ""}`);
  }
  const mixed = await post({ ...who, ...to, method: "ship", service: "cp-exp", lines: [{ sku: plain.sku, qty: 1 }, { sku: coal.sku, qty: 1 }] });
  ok(mixed.status === 409 && mixed.data.local_only === true, "a shipped cart with charcoal in it is refused whole");
  const pk = await post(pickup(coal.sku));
  ok(pk.status === 201 && /\/pay\/cs_/.test(pk.data.pay?.url || ""), "charcoal picked up can be paid by card: " + pk.status + " " + (pk.data.error || ""));
}
console.log(f ? `FAIL ${f} of ${n} checks (card${TOBACCO ? ", shisha by card on" : ""})` : `PASS ${n} checks (card${TOBACCO ? ", shisha by card on" : ""})`); process.exit(f ? 1 : 0);
