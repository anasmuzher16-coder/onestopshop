// Online payment through Stripe Checkout (Stripe's own hosted page), plus pay at the counter for pickup orders.
// Rules this file keeps (sources in store/docs/PAYMENTS.md):
//  - card numbers never reach this Worker: the shopper pays on Stripe's page (PCI SAQ A);
//  - the amount Stripe charges is built here from the order the server priced, in cents, never from the browser;
//  - an order turns paid ONLY from a webhook whose Stripe-Signature checks out (HMAC-SHA256, Web Crypto), whose
//    amount and currency match the order, and only once, however many times Stripe sends it;
//  - stock taken for an unpaid order comes back exactly once, when Stripe says the page expired or payment failed;
//  - every call that creates something at Stripe carries an Idempotency-Key, so a retry can never charge twice.
import * as rates from "../public/rates-core.js";
import { orderPlaced, newOrder, lowStock, writeEmail } from "./email.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const rand = () => hex(crypto.getRandomValues(new Uint8Array(16)));
const isoMs = s => Date.parse(s + (String(s).endsWith("Z") ? "" : "Z"));
export const HOLD_MIN = 35;          // Stripe keeps the page open this long (its floor is 30 minutes); the stock is held as long
export const LATE_SESSION_MS = 4 * 60000;   // past this, an order that never got its page is closed rather than given one
const TOLERANCE_S = 300;             // Stripe's own default: a signed event older than five minutes is refused

// Card payment is on only when both Stripe secrets are set (Worker secrets, never in the repo).
export const cardReady = env => !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
// Where the Stripe API lives. Tests point it at the local stand-in; nothing else is accepted, so a typo can never
// send the secret key to a stranger.
function apiBase(env) {
  const b = String(env.STRIPE_API_BASE || "https://api.stripe.com").replace(/\/+$/, "");
  if (b === "https://api.stripe.com" || /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(b)) return b;
  throw new Error("STRIPE_API_BASE must be https://api.stripe.com");
}
// Stripe takes form-encoded bodies with bracketed keys: line_items[0][price_data][unit_amount]=100.
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, method, path, params, idem) {
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": "2025-03-31.basil" };
  if (params) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idem) headers["Idempotency-Key"] = idem;
  const r = await fetch(apiBase(env) + path, { method, headers, body: params ? form(params).toString() : undefined, signal: AbortSignal.timeout(10000) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// ---------- 1. the payment page ----------
// The Checkout Session for one order, built from the rows the server wrote. Its params depend only on the order,
// so a retry with the same Idempotency-Key is the same request and Stripe hands back the same page.
export async function openCheckout(env, origin, o) {
  const db = env.DB, items = (await db.prepare("SELECT sku, name, qty, unit_cents FROM order_items WHERE order_id = ? ORDER BY sku").bind(o.id).all()).results;
  const line = (name, cents, qty) => ({ quantity: qty, price_data: { currency: "cad", unit_amount: cents, product_data: { name } } });
  // a points reward comes off the items (tax was worked out after it): Stripe takes no negative lines, so the items
  // go as one line already reduced, and the page still adds up to exactly the order's total
  const itemCents = items.reduce((t, i) => t + i.unit_cents * i.qty, 0), reward = o.reward_cents || 0;
  const lines = reward > 0 ? (itemCents - reward > 0 ? [line(`Items, less a ${(reward / 100).toFixed(2)} points reward`, itemCents - reward, 1)] : []) : items.map(i => line(i.name, i.unit_cents, i.qty));
  if (o.shipping_cents > 0) lines.push(line(o.ship_service === "Local delivery" ? "Local delivery" : `Shipping, ${o.ship_service || "Canada Post"}`, o.shipping_cents, 1));
  if (o.tax_cents > 0) lines.push(line(rates.taxLabel(o.tax_province), o.tax_cents, 1));
  const sum = lines.reduce((a, l) => a + l.price_data.unit_amount * l.quantity, 0);
  if (sum !== o.total_cents) throw new Error(`order ${o.id}: lines add to ${sum}, total is ${o.total_cents}`);   // never send Stripe a figure the order does not hold
  const site = env.SITE_NAME || "One Stop Shop";
  const params = {
    mode: "payment", submit_type: "pay", customer_email: o.email, client_reference_id: o.id,
    line_items: Object.fromEntries(lines.map((l, i) => [i, l])),
    metadata: { order_id: o.id },
    payment_intent_data: { description: `${site} order ${o.id}`, metadata: { order_id: o.id } },
    success_url: `${origin}/order/${o.id}`, cancel_url: `${origin}/checkout?unpaid=${o.id}`,
    expires_at: Math.floor(isoMs(o.pay_expires_at) / 1000),
  };
  const r = await stripe(env, "POST", "/v1/checkout/sessions", params, `checkout-${o.id}`);
  if (!r.ok || !r.data.id || !r.data.url) throw new Error(`stripe answered ${r.status}: ${r.data.error?.message || "no session"}`);
  if (r.data.amount_total !== o.total_cents || r.data.currency !== "cad") throw new Error(`order ${o.id}: Stripe priced it at ${r.data.amount_total} ${r.data.currency}`);
  const put = await db.prepare("UPDATE orders SET pay_session = ?1, pay_url = ?2, updated_at = " + NOW + " WHERE id = ?3 AND (pay_session IS NULL OR pay_session = ?1) AND status = 'pending' AND pay_status = 'awaiting' AND release_op IS NULL").bind(r.data.id, r.data.url, o.id).run();
  if (!put.meta.changes) {   // the order closed while the page was being made: close the page too, so nobody can pay into a closed order
    await stripe(env, "POST", `/v1/checkout/sessions/${encodeURIComponent(r.data.id)}/expire`, {}).catch(() => null);
    throw new Error(`order ${o.id} closed before its payment page was attached`);
  }
  return { session: r.data.id, url: r.data.url };
}

// ---------- 2. putting held stock back, once ----------
// One batch: the order closes only if it is still pending and unpaid, and that winning step stamps a fresh op;
// the stock rows move only where the stamp is ours. A second expiry, a repeat webhook, or a sweep racing a webhook
// all find the stamp taken and change nothing.
export async function releaseHeld(db, id, why) {
  const op = rand();
  const held = (await db.prepare("SELECT sku, -SUM(delta) AS qty FROM stock_moves WHERE ref = ? AND reason IN ('sale','released') GROUP BY sku HAVING -SUM(delta) > 0").bind(id).all()).results;
  const ours = "EXISTS (SELECT 1 FROM orders WHERE id = ?3 AND release_op = ?4)";
  const res = await db.batch([
    db.prepare(`UPDATE orders SET status = 'cancelled', pay_status = ?1, release_op = ?2, pay_url = NULL, cancelled_at = ${NOW}, updated_at = ${NOW} WHERE id = ?3 AND status = 'pending' AND pay_status = 'awaiting' AND release_op IS NULL`).bind(why, op, id),
    ...held.flatMap(h => [
      db.prepare(`UPDATE products SET stock = stock + ?1, updated_at = ${NOW} WHERE sku = ?2 AND ${ours}`).bind(h.qty, h.sku, id, op),
      db.prepare(`INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT ?2, ?1, 'released', ?3, 'payments' WHERE ${ours}`).bind(h.qty, h.sku, id, op),
    ]),
  ]);
  return res[0].meta.changes === 1;
}

// ---------- 3. paid ----------
// Only from a verified event (or the shop at the counter). The guarded update is the single winner; the receipt and
// the low-stock note are written by whoever wins it, so a repeat never sends a second receipt.
async function markPaid(env, o, { intent, amount, session }) {
  const db = env.DB;
  const res = await db.prepare(`UPDATE orders SET status = 'paid', pay_status = 'paid', pay_intent = ?1, payment_ref = ?1, paid_cents = ?2, paid_at = ${NOW}, pay_url = NULL, updated_at = ${NOW}
    WHERE id = ?3 AND status = 'pending' AND pay_status = 'awaiting' AND pay_session = ?4 AND release_op IS NULL`).bind(intent, amount, o.id, session).run();
  if (res.meta.changes !== 1) {
    // Paid for an order the shop already cancelled: keep the money on record so the back office shows a refund is owed.
    const late = await db.prepare(`UPDATE orders SET pay_status = 'paid', pay_intent = ?1, payment_ref = ?1, paid_cents = ?2, paid_at = ${NOW}, updated_at = ${NOW}
      WHERE id = ?3 AND status = 'cancelled' AND pay_status IN ('awaiting','expired','failed') AND pay_session = ?4`).bind(intent, amount, o.id, session).run();
    if (late.meta.changes) { console.error(JSON.stringify({ at: "pay", problem: "paid after the order was cancelled: refund it from the back office", order: o.id })); return "paid_after_cancel"; }
    // a paid order whose receipt was never written (the Worker stopped in between) gets it on Stripe's redelivery
    const now = await db.prepare("SELECT pay_status, paid_at FROM orders WHERE id = ?").bind(o.id).first();
    if (now?.pay_status === "paid" && now.paid_at && Date.now() - isoMs(now.paid_at) > 60000 && !(await db.prepare("SELECT 1 AS y FROM emails WHERE order_id = ? AND kind = 'order_placed'").bind(o.id).first("y"))) { await receipt(env, o.id, "paid"); return "receipt_resent"; }
    return "repeat";
  }
  await receipt(env, o.id, "paid");
  return "paid";
}
export async function receipt(env, id, how) {
  const db = env.DB, o = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first(); if (!o) return;
  const items = (await db.prepare("SELECT sku, name, qty, unit_cents FROM order_items WHERE order_id = ? ORDER BY sku").bind(id).all()).results;
  const site = env.SITE_NAME || "One Stop Shop", q = (() => { try { return JSON.parse(o.ship_quote || "{}"); } catch { return {}; } })();
  await writeEmail(env, id, o.email, orderPlaced(site, { ...o, eta: q.eta ?? null }, items, how));
  // the shop hears about it too: held in the outbox (back office) until the mail service and OWNER_EMAIL are set
  await writeEmail(env, id, env.OWNER_EMAIL || "the shop", newOrder(site, o, items, how));
  const low = await db.prepare(`SELECT name, stock FROM products WHERE active = 1 AND stock <= low_stock_at AND sku IN (${items.map(() => "?").join(",") || "''"}) ORDER BY stock, name`).bind(...items.map(i => i.sku)).all();
  if (low.results.length) await writeEmail(env, id, env.OWNER_EMAIL || "the shop", lowStock(site, low.results));
}

// ---------- 4. the webhook ----------
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
// Stripe-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.<raw body>">[,v1=...]. Any matching v1 inside the window passes.
export async function signatureOk(secret, header, raw, nowS = Math.floor(Date.now() / 1000)) {
  if (!secret || !header) return false;
  const parts = header.split(","), t = parts.map(p => p.trim().split("=")).find(([k]) => k === "t")?.[1];
  const v1 = parts.map(p => p.trim().split("=")).filter(([k, v]) => k === "v1" && /^[0-9a-f]{64}$/.test(v || "")).map(([, v]) => v);
  if (!/^\d{9,11}$/.test(t || "") || !v1.length || Math.abs(nowS - Number(t)) > TOLERANCE_S) return false;
  const want = await hmac(secret, `${t}.${raw}`);
  let hit = false; for (const v of v1) hit = same(v, want) || hit;
  return hit;
}

export async function webhook(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!cardReady(env)) return json({ error: "Payments are not set up." }, 503);
  if (Number(request.headers.get("Content-Length") || 0) > 262144) return json({ error: "Too large." }, 413);
  const raw = await request.text();
  if (raw.length > 262144) return json({ error: "Too large." }, 413);
  if (!(await signatureOk(env.STRIPE_WEBHOOK_SECRET, request.headers.get("Stripe-Signature"), raw))) return json({ error: "Bad signature." }, 400);
  let ev; try { ev = JSON.parse(raw); } catch { return json({ error: "Bad body." }, 400); }
  if (!ev || typeof ev.id !== "string" || typeof ev.type !== "string" || !ev.data || typeof ev.data.object !== "object") return json({ error: "Bad event." }, 400);
  // a test-mode event can never pay a live order, or the other way round
  if (!!ev.livemode !== /^(sk|rk)_live_/.test(String(env.STRIPE_SECRET_KEY))) return json({ ok: true, ignored: "mode" });
  const db = env.DB;
  if (await db.prepare("SELECT 1 AS y FROM pay_events WHERE id = ?").bind(ev.id).first("y")) return json({ ok: true, repeat: true });
  const obj = ev.data.object, orderId = typeof obj.metadata?.order_id === "string" ? obj.metadata.order_id : typeof obj.client_reference_id === "string" ? obj.client_reference_id : null;
  const o = orderId && /^W[A-Z0-9]{6}$/.test(orderId) ? await db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first() : null;
  let result = "ignored";
  if (!o) result = "no_order";
  else if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
    if (obj.object !== "checkout.session" || obj.id !== o.pay_session) result = "mismatch";
    else if (obj.payment_status !== "paid") result = "waiting";   // a delayed method: the async_payment_succeeded event settles it
    else if (obj.amount_total !== o.total_cents || obj.currency !== "cad" || typeof obj.payment_intent !== "string") result = "mismatch";
    else result = await markPaid(env, o, { intent: obj.payment_intent, amount: obj.amount_total, session: obj.id });
  } else if (ev.type === "checkout.session.expired" || ev.type === "checkout.session.async_payment_failed") {
    if (obj.id !== o.pay_session) result = "mismatch";
    else result = (await releaseHeld(db, o.id, ev.type.endsWith("expired") ? "expired" : "failed")) ? "released" : "repeat";
  }
  if (result === "mismatch") console.error(JSON.stringify({ at: "pay", problem: "signed event does not match the order: left unpaid", order: o?.id, type: ev.type }));
  await db.prepare("INSERT OR IGNORE INTO pay_events (id, type, order_id, result) VALUES (?,?,?,?)").bind(ev.id, ev.type, o ? o.id : null, result).run();
  return json({ ok: true, result });
}

// ---------- 5. what the shopper's order page asks ----------
// Keyed by the Checkout Session id, which only the shopper's browser holds. Answers the state and nothing else.
export async function payStatus(request, env, url) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const s = url.searchParams.get("session") || "";
  if (!/^cs_[A-Za-z0-9_]{8,250}$/.test(s)) return json({ error: "Not found" }, 404);
  const o = await env.DB.prepare("SELECT id, pay_status FROM orders WHERE pay_session = ?").bind(s).first();
  return o ? json({ id: o.id, pay: o.pay_status }) : json({ error: "Not found" }, 404);
}

// ---------- 6. the safety net ----------
// Every few minutes: any order still waiting on payment is checked with Stripe itself, so a webhook that never
// arrived cannot leave an order unpaid-but-charged or hold stock for ever.
export async function sweep(env) {
  if (!cardReady(env)) return { checked: 0 };
  const db = env.DB, list = (await db.prepare("SELECT * FROM orders WHERE pay_status = 'awaiting' AND status = 'pending' ORDER BY updated_at, created_at LIMIT 25").all()).results;
  let paid = 0, released = 0;
  for (const o of list) {
    try {
      if (!o.pay_session) {   // the page was never made: past the short window, close it and give the stock back
        if (Date.now() - isoMs(o.created_at) > LATE_SESSION_MS) released += +(await releaseHeld(db, o.id, "failed"));
        continue;
      }
      let s = (await stripe(env, "GET", `/v1/checkout/sessions/${encodeURIComponent(o.pay_session)}`)).data;
      if (s.status === "open" && Date.now() > isoMs(o.pay_expires_at) + 120000) s = (await stripe(env, "POST", `/v1/checkout/sessions/${encodeURIComponent(o.pay_session)}/expire`, {})).data.status ? (await stripe(env, "GET", `/v1/checkout/sessions/${encodeURIComponent(o.pay_session)}`)).data : s;
      if (s.status === "complete" && s.payment_status === "paid" && s.amount_total === o.total_cents && s.currency === "cad") paid += +((await markPaid(env, o, { intent: s.payment_intent, amount: s.amount_total, session: s.id })) === "paid");
      else if (s.status === "expired") released += +(await releaseHeld(db, o.id, "expired"));
      else await db.prepare(`UPDATE orders SET updated_at = ${NOW} WHERE id = ? AND pay_status = 'awaiting'`).bind(o.id).run();   // not settled: to the back of the queue, so it never starves newer orders
    } catch (e) { console.error(JSON.stringify({ at: "pay-sweep", order: o.id, message: String(e && e.message || e) })); }
  }
  return { checked: list.length, paid, released };
}

// ---------- 7. the back office: refunds, and pay-at-pickup taken at the counter ----------
// Reached only through admin(), after its sign-in, same-origin and request-marker checks.
export async function adminPay(request, env, id, what, actor) {
  const db = env.DB, body = await request.json().catch(() => ({}));
  const o = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  if (!o) return json({ error: "No such order." }, 404);
  if (what === "paid") {   // the customer paid at the counter
    if (o.pay_status !== "pay_at_pickup") return json({ error: "This order is not waiting for payment at the counter." }, 409);
    const res = await db.batch([
      db.prepare(`UPDATE orders SET pay_status = 'paid', paid_cents = total_cents, paid_at = ${NOW}, payment_ref = 'counter', status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END, updated_at = ${NOW} WHERE id = ? AND pay_status = 'pay_at_pickup' AND status IN ('pending','ready')`).bind(id),
      db.prepare("INSERT INTO audit_log (actor, action, target, before, after) SELECT ?, 'order.paid_at_counter', ?, ?, ? WHERE changes() = 1").bind(actor, id, JSON.stringify({ pay_status: o.pay_status, status: o.status }), JSON.stringify({ pay_status: "paid", paid_cents: o.total_cents })),
    ]);
    if (!res[0].meta.changes) return json({ error: "That order changed. Refresh and try again." }, 409);
    return json({ ok: true, pay_status: "paid" });
  }
  if (what === "counter-refund") return counterRefund(db, o, body, actor);
  // refund: full when no amount is given, otherwise that many cents. Card orders only: counter payments are refunded at the till.
  if (o.pay_method !== "card" || !["paid", "part_refunded"].includes(o.pay_status) || !o.pay_intent) return json({ error: o.pay_method === "at_pickup" ? "This was paid at the counter. Refund it at the till." : "There is no card payment on this order to refund." }, 409);
  if (!cardReady(env)) return json({ error: "Card payments are not connected." }, 503);
  const op = typeof body.op === "string" && /^[A-Za-z0-9-]{16,64}$/.test(body.op) ? body.op : null;
  if (!op) return json({ error: "Refresh the page and try again." }, 400);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : null;
  const prior = await db.prepare("SELECT * FROM refunds WHERE op = ?").bind(op).first();
  if (prior) {   // the same tap, sent again: answer with what happened, never refund twice
    if (prior.order_id !== id) return json({ error: "That refund could not be read." }, 409);
    if (prior.status !== "pending") return json({ ok: prior.status === "succeeded", refund: { amount_cents: prior.amount_cents, status: prior.status }, error: prior.status === "failed" ? prior.detail : undefined }, prior.status === "succeeded" ? 200 : 502);
  }
  // what is left is paid minus every refund that has not failed (pending ones count, so two taps cannot both fit)
  const left = o.paid_cents - ((await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS c FROM refunds WHERE order_id = ? AND status != 'failed'").bind(id).first("c")) || 0) + (prior ? prior.amount_cents : 0);
  const amount = prior ? prior.amount_cents : body.amount_cents === undefined || body.amount_cents === null ? left : Number(body.amount_cents);   // a retried tap asks Stripe for exactly what was booked
  if (!Number.isInteger(amount) || amount < 1) return json({ error: "Enter the amount to refund in cents, more than zero." }, 400);
  if (amount > left) return json({ error: `Only ${(left / 100).toFixed(2)} is left to refund on this order.`, left_cents: left }, 409);
  if (!prior) {
    const put = await db.prepare(`INSERT INTO refunds (op, order_id, amount_cents, reason, actor) SELECT ?1, ?2, ?3, ?4, ?5
      WHERE (SELECT paid_cents FROM orders WHERE id = ?2) - (SELECT COALESCE(SUM(amount_cents),0) FROM refunds WHERE order_id = ?2 AND status != 'failed') >= ?3`).bind(op, id, amount, reason, actor).run();
    if (!put.meta.changes) return json({ error: "Another refund on this order just went through. Refresh to see what is left." }, 409);
  }
  let r; try { r = await stripe(env, "POST", "/v1/refunds", { payment_intent: o.pay_intent, amount, reason: "requested_by_customer", metadata: { order_id: id, op } }, `refund-${op}`); }
  catch { return json({ error: "Stripe did not answer. Tap refund again: it will not refund twice.", retry: true }, 502); }   // left pending: the same op retries safely
  if (!r.ok || !["succeeded", "pending"].includes(r.data.status)) {
    const why = r.data.error?.message ? String(r.data.error.message).slice(0, 200) : `Stripe answered ${r.status}`;
    await db.prepare(`UPDATE refunds SET status = 'failed', detail = ?, updated_at = ${NOW} WHERE op = ? AND status = 'pending'`).bind(why, op).run();
    return json({ error: `The refund did not go through: ${why}` }, 502);
  }
  const done = await db.batch([
    db.prepare(`UPDATE refunds SET status = 'succeeded', stripe_id = ?, updated_at = ${NOW} WHERE op = ? AND status = 'pending'`).bind(r.data.id, op),
    db.prepare(`UPDATE orders SET refunded_cents = refunded_cents + ?1, pay_status = CASE WHEN refunded_cents + ?1 >= paid_cents THEN 'refunded' ELSE 'part_refunded' END,
      status = CASE WHEN refunded_cents + ?1 >= paid_cents THEN 'refunded' ELSE status END, updated_at = ${NOW} WHERE id = ?2 AND changes() = 1`).bind(amount, id),
    db.prepare("INSERT INTO audit_log (actor, action, target, before, after) SELECT ?, 'order.refund', ?, ?, ? WHERE changes() = 1").bind(actor, id, JSON.stringify({ refunded_cents: o.refunded_cents }), JSON.stringify({ amount_cents: amount, stripe: r.data.id, reason })),
  ]);
  const now = await db.prepare("SELECT pay_status, status, paid_cents, refunded_cents FROM orders WHERE id = ?").bind(id).first();
  return json({ ok: true, refund: { amount_cents: amount, status: "succeeded", counted: done[1].meta.changes === 1 }, order: now });
}

// A refund handed back at the till for an order paid at the counter: the money has already moved, so this only records
// it, in the same refunds table as card refunds (detail 'counter', no Stripe id). That one row is what the monthly report,
// the 5% share and the points read, so a till refund lowers the report and takes back its points exactly as a card
// refund does. One D1 batch (one transaction): the row is written only if the order is still paid at the counter and
// the amount fits in what is left; the order moves only if that row went in; the log line only if the order moved.
// The request's own key (op) makes a repeated tap answer the same and record once.
async function counterRefund(db, o, body, actor) {
  const id = o.id, op = typeof body.op === "string" && /^[A-Za-z0-9-]{16,64}$/.test(body.op) ? body.op : null;
  if (!op) return json({ error: "Refresh the page and try again." }, 400);
  const prior = await db.prepare("SELECT order_id, amount_cents, status, detail FROM refunds WHERE op = ?").bind(op).first();
  if (prior) return prior.order_id === id && prior.detail === "counter" ? json({ ok: true, refund: { amount_cents: prior.amount_cents, status: prior.status }, replayed: true }) : json({ error: "That refund could not be read." }, 409);
  // a cancelled order is already counted as given back in full on its cancel day: a till refund on it would rewrite a past month
  if (o.status === "cancelled") return json({ error: "This order was cancelled, so the report already counts it as given back in full." }, 409);
  if (o.pay_method !== "at_pickup" || !["paid", "part_refunded"].includes(o.pay_status)) return json({ error: o.pay_method === "card" ? "This was paid by card. Refund it to the card." : "Only an order paid at the counter can have a counter refund recorded." }, 409);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  if (!reason) return json({ error: "Say why in a few words, for example: returned, faulty." }, 400);
  const left = o.paid_cents - ((await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS c FROM refunds WHERE order_id = ? AND status != 'failed'").bind(id).first("c")) || 0);
  const amount = body.amount_cents === undefined || body.amount_cents === null ? left : Number(body.amount_cents);
  if (!Number.isInteger(amount) || amount < 1) return json({ error: "Enter the amount given back, more than zero." }, 400);
  if (amount > left) return json({ error: `Only ${(left / 100).toFixed(2)} is left to refund on this order.`, left_cents: left }, 409);
  let res; try { res = await db.batch([
    db.prepare(`INSERT INTO refunds (op, order_id, amount_cents, status, reason, actor, detail) SELECT ?1, ?2, ?3, 'succeeded', ?4, ?5, 'counter'
      WHERE EXISTS (SELECT 1 FROM orders WHERE id = ?2 AND pay_method = 'at_pickup' AND pay_status IN ('paid','part_refunded') AND status <> 'cancelled')
      AND (SELECT paid_cents FROM orders WHERE id = ?2) - (SELECT COALESCE(SUM(amount_cents),0) FROM refunds WHERE order_id = ?2 AND status != 'failed') >= ?3`).bind(op, id, amount, reason, actor),
    db.prepare(`UPDATE orders SET refunded_cents = refunded_cents + ?1, pay_status = CASE WHEN refunded_cents + ?1 >= paid_cents THEN 'refunded' ELSE 'part_refunded' END,
      status = CASE WHEN refunded_cents + ?1 >= paid_cents THEN 'refunded' ELSE status END, updated_at = ${NOW} WHERE id = ?2 AND changes() = 1`).bind(amount, id),
    db.prepare("INSERT INTO audit_log (actor, action, target, before, after) SELECT ?, 'order.counter_refund', ?, ?, ? WHERE changes() = 1").bind(actor, id, JSON.stringify({ refunded_cents: o.refunded_cents, status: o.status }), JSON.stringify({ amount_cents: amount, reason })),
  ]); } catch (e) {   // the same tap twice at once: the op is unique, so the second batch rolls back whole; answer with the first
    if (!/UNIQUE/i.test(String(e && e.message))) throw e;
    const won = await db.prepare("SELECT order_id, amount_cents, status FROM refunds WHERE op = ?").bind(op).first();
    return won && won.order_id === id ? json({ ok: true, refund: { amount_cents: won.amount_cents, status: won.status }, replayed: true }) : json({ error: "That refund could not be read." }, 409);
  }
  if (!res[0].meta.changes) return json({ error: "This order changed, or another refund just used what was left. Refresh to see it." }, 409);
  const now = await db.prepare("SELECT pay_status, status, paid_cents, refunded_cents FROM orders WHERE id = ?").bind(id).first();
  return json({ ok: true, refund: { amount_cents: amount, status: "succeeded" }, order: now });
}
