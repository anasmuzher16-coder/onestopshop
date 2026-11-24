// A stand-in for Stripe, for local tests only. No keys, no network: it speaks the few calls the store makes
// (Checkout Sessions create/get/expire, Refunds), keeps Stripe's Idempotency-Key rules, serves a pretend
// payment page, and sends webhooks signed exactly as Stripe signs them (t=,v1= HMAC-SHA256 of "t.body").
// node store/tools/fake-stripe.mjs   then run the store with
//   --var STRIPE_SECRET_KEY:sk_test_local --var STRIPE_WEBHOOK_SECRET:whsec_local_test --var STRIPE_API_BASE:http://127.0.0.1:4498
// STORE (default http://127.0.0.1:4489) is where webhooks go. Test-only controls live under /__.
import { createServer } from "node:http";
import { createHmac, randomBytes } from "node:crypto";
const PORT = +(process.env.PORT || 4498), STORE = (process.env.STORE || "http://127.0.0.1:4489").replace(/\/$/, "");
const KEY = process.env.SK || "sk_test_local", SECRET = process.env.WHSEC || "whsec_local_test";
const sessions = new Map(), intents = new Map(), idem = new Map(), log = []; let failNext = null;
const id = p => p + "_test_" + randomBytes(12).toString("hex");
export const sign = (body, secret = SECRET, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
// Stripe's bracketed form keys back into an object: line_items[0][price_data][unit_amount]=100
function unform(text) {
  const out = {};
  for (const [k, v] of new URLSearchParams(text)) {
    const path = k.replace(/\]/g, "").split("["); let o = out;
    path.forEach((p, i) => { if (i === path.length - 1) o[p] = v; else o = o[p] ??= {}; });
  }
  return out;
}
const err = (res, status, message, type = "invalid_request_error") => send(res, { error: { type, message } }, status);
function send(res, o, s = 200) { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); }
export function event(type, object) { return { id: id("evt"), object: "event", type, livemode: false, created: Math.floor(Date.now() / 1000), api_version: "2025-03-31.basil", data: { object } }; }
async function deliver(ev) {
  const body = JSON.stringify(ev);
  const r = await fetch(STORE + "/api/pay/webhook", { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": sign(body) }, body }).catch(e => ({ status: 0, text: async () => String(e) }));
  log.push({ webhook: ev.type, status: r.status }); return r.status;
}
function complete(s) {
  const pi = id("pi"); s.status = "complete"; s.payment_status = "paid"; s.payment_intent = pi;
  intents.set(pi, { id: pi, object: "payment_intent", amount: s.amount_total, amount_received: s.amount_total, currency: s.currency, status: "succeeded", metadata: s.metadata, refunded: 0 });
}
const body = req => new Promise(f => { let d = ""; req.on("data", c => d += c); req.on("end", () => f(d)); });

createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), raw = await body(req), parts = u.pathname.split("/").filter(Boolean);
  // ---------- test controls ----------
  if (u.pathname === "/__log") return send(res, { log, sessions: [...sessions.values()].map(s => ({ id: s.id, status: s.status, amount_total: s.amount_total, order: s.metadata?.order_id })) });
  if (u.pathname === "/__fail") { failNext = u.searchParams.get("next"); return send(res, { ok: true, failNext }); }
  if (parts[0] === "__session") { const s = sessions.get(parts[1]); return s ? send(res, s) : send(res, {}, 404); }
  if (parts[0] === "__complete" || parts[0] === "__expire") {   // ?send=0 changes the state at "Stripe" but sends no webhook (a lost webhook)
    const s = sessions.get(parts[1]); if (!s) return send(res, {}, 404);
    if (s.status !== "open") return send(res, { error: "not open", status: s.status }, 400);
    if (parts[0] === "__complete") complete(s); else { s.status = "expired"; s.url = null; }
    const ev = event(parts[0] === "__complete" ? "checkout.session.completed" : "checkout.session.expired", { ...s });
    const delivered = u.searchParams.get("send") === "0" ? null : await deliver(ev);
    return send(res, { ok: true, event: ev, delivered });
  }
  // ---------- the pretend payment page ----------
  if (parts[0] === "pay" && parts[1]) {
    const s = sessions.get(parts[1]); if (!s) { res.writeHead(404); return res.end("No such page"); }
    if (req.method === "POST") {
      if (s.status === "open") { complete(s); await deliver(event("checkout.session.completed", { ...s })); }
      res.writeHead(303, { Location: s.success_url }); return res.end();
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Test payment</title><body style="font:16px system-ui;margin:24px">
<p>Test payment page (stand-in for Stripe). ${s.status === "open" ? "" : "This page is " + s.status + "."}</p><p data-amount>${(s.amount_total / 100).toFixed(2)} ${s.currency.toUpperCase()}</p>
<form method="post"><button data-fake-pay type="submit" style="font-size:18px;padding:12px 20px">Pay</button></form><p><a data-fake-back href="${s.cancel_url}">Back</a></p>`);
  }
  // ---------- the API ----------
  if (req.headers.authorization !== `Bearer ${KEY}`) return err(res, 401, "Invalid API Key provided", "authentication_error");
  const key = req.headers["idempotency-key"];
  if (req.method === "POST" && key) {
    const was = idem.get(key);
    if (was) { if (was.req !== req.url + raw) return err(res, 400, "Keys for idempotent requests can only be used with the same parameters they were first used with.", "idempotency_error"); return send(res, was.body, was.status); }
  }
  const remember = (o, s = 200) => { if (req.method === "POST" && key) idem.set(key, { req: req.url + raw, body: o, status: s }); log.push({ call: req.method + " " + u.pathname, status: s, key }); return send(res, o, s); };
  if (failNext && u.pathname.includes(failNext)) { failNext = null; log.push({ call: req.method + " " + u.pathname, status: 500 }); return err(res, 500, "Something went wrong at the stand-in", "api_error"); }
  const p = req.method === "POST" ? unform(raw) : {};
  if (req.method === "POST" && u.pathname === "/v1/checkout/sessions") {
    const items = Object.values(p.line_items || {}), now = Math.floor(Date.now() / 1000), exp = +p.expires_at;
    if (!items.length) return remember({ error: { message: "line_items required" } }, 400);
    if (exp && (exp < now + 1800 - 5 || exp > now + 86400)) return remember({ error: { message: "The `expires_at` timestamp must be between 30 minutes and 24 hours from Checkout Session creation." } }, 400);
    const currencies = new Set(items.map(i => i.price_data.currency));
    const total = items.reduce((a, i) => a + Number(i.price_data.unit_amount) * Number(i.quantity), 0);
    const s = { id: id("cs"), object: "checkout.session", mode: p.mode, status: "open", payment_status: "unpaid", amount_total: total, currency: [...currencies][0],
      customer_email: p.customer_email, client_reference_id: p.client_reference_id, metadata: p.metadata || {}, success_url: p.success_url, cancel_url: p.cancel_url, expires_at: exp || now + 86400, payment_intent: null, livemode: false, line_items_sent: items };
    s.url = `http://127.0.0.1:${PORT}/pay/${s.id}`;
    sessions.set(s.id, s); return remember(s);
  }
  if (parts[0] === "v1" && parts[1] === "checkout" && parts[2] === "sessions" && parts[3]) {
    const s = sessions.get(parts[3]); if (!s) return remember({ error: { message: "No such checkout.session" } }, 404);
    if (req.method === "GET") return remember(s);
    if (parts[4] === "expire" && req.method === "POST") {
      if (s.status !== "open") return remember({ error: { message: `Only Checkout Sessions with a status in ["open"] can be expired. This Checkout Session has a status of "${s.status}".` } }, 400);
      s.status = "expired"; s.url = null; setTimeout(() => deliver(event("checkout.session.expired", { ...s })), 50); return remember(s);
    }
  }
  if (req.method === "POST" && u.pathname === "/v1/refunds") {
    const pi = intents.get(p.payment_intent); if (!pi) return remember({ error: { message: "No such payment_intent" } }, 404);
    const amount = p.amount ? +p.amount : pi.amount_received - pi.refunded;
    if (amount > pi.amount_received - pi.refunded) return remember({ error: { message: `Refund amount (${amount}) is greater than unrefunded amount on charge (${pi.amount_received - pi.refunded})` } }, 400);
    pi.refunded += amount;
    return remember({ id: id("re"), object: "refund", amount, currency: pi.currency, payment_intent: pi.id, status: "succeeded", metadata: p.metadata || {} });
  }
  return remember({ error: { message: "Unrecognized request URL" } }, 404);
}).listen(PORT, "127.0.0.1", () => console.log(`fake stripe on ${PORT}, webhooks to ${STORE}`));
