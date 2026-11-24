// Signed Stripe webhook fixtures for the payment tests. sign() is Stripe's scheme: Stripe-Signature t=<unix>,v1=<hex
// HMAC-SHA256 of "<t>.<raw body>"> keyed with the endpoint's whsec_ secret (docs.stripe.com/webhooks).
import { createHmac, randomBytes } from "node:crypto";
export const SECRET = "whsec_local_test";
export const sign = (body, secret = SECRET, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
export const evtId = () => "evt_test_" + randomBytes(12).toString("hex");
export const event = (type, object, over = {}) => ({ id: evtId(), object: "event", type, livemode: false, created: Math.floor(Date.now() / 1000), api_version: "2025-03-31.basil", data: { object }, ...over });
// The shapes the store reads, built from a Checkout Session as the stand-in (or Stripe) returns it.
export const completed = (s, over = {}) => event("checkout.session.completed", { ...s, status: "complete", payment_status: "paid", payment_intent: s.payment_intent || "pi_test_" + randomBytes(8).toString("hex"), ...over });
export const expired = s => event("checkout.session.expired", { ...s, status: "expired", url: null });
export const intentSucceeded = (s, pi, over = {}) => event("payment_intent.succeeded", { id: pi, object: "payment_intent", amount: s.amount_total, amount_received: s.amount_total, currency: s.currency, status: "succeeded", metadata: s.metadata, ...over });
// POST one event to the store. sig: "good" (default), "none", "wrong" (another secret), "old" (outside the 5-minute window), or a raw header.
export async function post(base, ev, sig = "good") {
  const body = typeof ev === "string" ? ev : JSON.stringify(ev), now = Math.floor(Date.now() / 1000);
  const header = sig === "good" ? sign(body) : sig === "wrong" ? sign(body, "whsec_someone_else") : sig === "old" ? sign(body, SECRET, now - 600) : sig === "none" ? null : sig;
  const r = await fetch(base + "/api/pay/webhook", { method: "POST", headers: { "Content-Type": "application/json", ...(header ? { "Stripe-Signature": header } : {}) }, body });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
