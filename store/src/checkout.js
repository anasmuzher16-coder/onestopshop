// Placing an order. The server works out every number itself (prices, packing, shipping, tax) from the database,
// so nothing the shopper's phone sends can change what is charged. Stock comes down in the same step and can
// never go below zero. Then one of two things:
//  - pay by card: the order waits ('pending', pay 'awaiting') with its stock held, and the shopper is sent to
//    Stripe's own page for exactly the server's total. Only a signed Stripe webhook marks it paid (src/pay.js).
//  - pay at the counter (pickup only): the order is placed with pay 'pay_at_pickup', stock held, and the shop
//    marks it paid when the customer pays.
import * as rates from "../public/rates-core.js";
import { loadCatalog, toStorefront, isCharcoal } from "./catalog.js";
import { deliveryQuote } from "./delivery.js";
import { cardReady, openCheckout, releaseHeld, receipt, HOLD_MIN, LATE_SESSION_MS } from "./pay.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const text = (v, max) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;
const cents = n => Math.round(n * 100);
const code = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = crypto.getRandomValues(new Uint8Array(6)); return "W" + [...b].map(x => a[x % a.length]).join(""); };

const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const codeFrom = hex => "W" + Array.from({ length: 6 }, (_, i) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % 32]).join("");
const wait = ms => new Promise(f => setTimeout(f, ms));
const parsed = s => { try { return JSON.parse(s || "{}"); } catch { return {}; } };
const age = row => Date.now() - Date.parse(row.created_at + (row.created_at.endsWith("Z") ? "" : "Z"));
const OPEN_MS = 120000;   // an attempt still unfinished after this long died part way; it no longer blocks a new one
// Shisha is tobacco. Stripe sells it only with its written approval (stripe.com/legal/restricted-businesses), so until
// the shop has that and sets STRIPE_TOBACCO_OK=1, shisha is paid at the counter. Keyed on the section and on a details flag.
const tobacco = p => p.cat === "shisha" || !!(p.details && p.details.tobacco);

// The order a retry refers to. The order code comes from the shopper's key, so the database's own unique id stops a second copy, with no new table.
async function findKeyed(env, key, sameOrder) {
  const db = env.DB, idem = await sha("key:" + key);
  for (let i = 0; i < 6; i++) {
    const id = codeFrom(await sha(`id:${i}:${key}`)), row = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
    if (!row) return { id, idem };
    const q = parsed(row.ship_quote);
    if (q.idem !== idem) continue;   // another order happens to hold this code: try the next one
    if (row.pay_status === "expired" || row.pay_status === "failed") continue;   // that try closed unpaid: this is a new order
    if (q.idem_req !== sameOrder) {
      // still waiting on a card payment and the shopper changed something: close the old page, put its stock back, start fresh
      if (row.pay_status === "awaiting" && row.status === "pending" && await closeUnpaid(env, row)) continue;
      return { changed: true, id };
    }
    if (row.status === "pending" && (row.pay_status === "awaiting" || row.pay_status === "pay_at_pickup")) {
      const sold = await db.prepare("SELECT COUNT(*) AS n FROM stock_moves WHERE ref = ? AND reason = 'sale'").bind(id).first("n");
      if (!sold) {   // written but no stock taken yet
        if (age(row) < OPEN_MS) return { open: true };
        await db.batch([db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id), db.prepare("DELETE FROM orders WHERE id = ? AND status = 'pending' AND release_op IS NULL").bind(id)]);
        return { id, idem };
      }
      if (row.pay_status === "awaiting" && !row.pay_session) {   // stock held, payment page not made yet
        if (age(row) < OPEN_MS / 4) return { open: true };
        if (age(row) > LATE_SESSION_MS) { await releaseHeld(db, id, "failed"); continue; }
      }
    }
    return { row };
  }
  return { spent: true };   // every slot for this key is used: a random code here could not be found by a retry
}
// An unpaid order whose details changed. True once its page is closed at Stripe (or never existed) and its stock is back.
async function closeUnpaid(env, row) {
  if (row.pay_session) {
    const base = String(env.STRIPE_API_BASE || "https://api.stripe.com").replace(/\/+$/, "");
    if (base !== "https://api.stripe.com" && !/^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(base)) return false;
    const r = await fetch(`${base}/v1/checkout/sessions/${encodeURIComponent(row.pay_session)}/expire`, { method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Idempotency-Key": `expire-${row.id}` }, signal: AbortSignal.timeout(10000) }).catch(() => null);
    const s = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || s.status !== "expired") return false;   // it was paid meanwhile, or Stripe could not be reached: leave it alone
  }
  await releaseHeld(env.DB, row.id, "expired");
  return true;
}
// The answer for an order that already exists: its figures, and where the payment stands.
async function replay(env, origin, row) {
  const db = env.DB;
  let pay = payOut(row);
  if (row.pay_method === "card" && row.pay_status === "awaiting" && !row.pay_session) {
    try { pay = { ...pay, ...(await openCheckout(env, origin, row)) }; } catch (e) { console.error(JSON.stringify({ at: "checkout", order: row.id, message: String(e && e.message || e) })); return stillOpen(); }
  }
  const items = (await db.prepare("SELECT sku, name, qty, unit_cents FROM order_items WHERE order_id = ? ORDER BY sku").bind(row.id).all()).results, q = parsed(row.ship_quote), a = parsed(row.address);
  return json({ ok: true, replayed: true, pay, order: { id: row.id, method: row.method, name: row.name, email: row.email, service: row.ship_service, province: row.tax_province, subtotal_cents: row.subtotal_cents, shipping_cents: row.shipping_cents, tax_cents: row.tax_cents, total_cents: row.total_cents,
    tax_label: rates.taxLabel(row.tax_province), days: q.days ?? null, eta: q.eta ?? null, address: row.method === "ship" ? { line1: a.line1, city: a.city, province: a.province, postal: a.postal } : null, items } });
}
const payOut = row => ({ method: row.pay_method, status: row.pay_status, ...(row.pay_status === "awaiting" && row.pay_url ? { url: row.pay_url, session: row.pay_session } : {}), ...(row.pay_session ? { session: row.pay_session } : {}) });
const stillOpen = () => json({ error: "Your order is still going through. Wait a moment, then try again.", in_progress: true }, 409);

export async function placeOrder(request, env, url) {
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return json({ error: "Send JSON." }, 415);
  const origin = request.headers.get("Origin"); if (origin && origin !== url.origin) return json({ error: "Wrong origin." }, 403);
  const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return json({ error: "That order could not be read." }, 400);
  const db = env.DB;
  const name = text(body.name, 80), email = text(body.email, 120), phone = body.phone ? text(String(body.phone), 30) : null, note = body.note ? text(String(body.note), 240) : null;
  if (!name) return json({ error: "Tell us the name for the order.", field: "name" }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "That email address does not look right.", field: "email" }, 400);
  const method = body.method === "pickup" ? "pickup" : body.method === "ship" ? "ship" : null;
  if (!method) return json({ error: "Choose shipping or pickup." }, 400);
  const pay = body.pay === undefined || body.pay === "card" ? "card" : body.pay === "at_pickup" ? "at_pickup" : null;
  if (!pay) return json({ error: "Choose how to pay." }, 400);
  if (pay === "at_pickup" && method !== "pickup") return json({ error: "Paying at the counter is for pickup orders. Pay by card for delivery.", field: "pay" }, 400);
  if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 60) return json({ error: "Your cart is empty." }, 400);

  const cat = await loadCatalog(db), store = toStorefront(cat), bySku = Object.fromEntries(store.PRODUCTS.map(p => [p.sku, p]));
  rates.useBoxes(store.BOXES);
  const want = new Map();
  for (const l of body.lines) {
    const qty = Math.floor(Number(l && l.qty));
    if (!l || typeof l.sku !== "string" || !(qty >= 1 && qty <= rates.MAX_QTY)) return json({ error: "Something in the cart could not be read. Refresh and try again." }, 400);
    want.set(l.sku, (want.get(l.sku) || 0) + qty);
  }
  // a retry of an order that already went through gets that order back, before stock or the brake can refuse it
  const key = body.order_key === undefined ? null : typeof body.order_key === "string" && /^[A-Za-z0-9-]{16,64}$/.test(body.order_key) ? body.order_key : false;
  if (key === false) return json({ error: "That order could not be read. Refresh and try again." }, 400);
  let keyed = null, sameOrder = null;
  if (key) {
    const postal = rates.parsePostal(body.postal)?.full || "";
    sameOrder = await sha(JSON.stringify([[...want].map(([s, q]) => [s, q]).sort(), method, method === "ship" ? String(body.service || "") : "", method === "ship" ? postal : "", email.toLowerCase(), name, phone || "", note || "", ...(method === "ship" ? [String(body.address?.line1 || "").trim().toLowerCase(), String(body.address?.city || "").trim().toLowerCase()] : []), pay]));
    keyed = await findKeyed(env, key, sameOrder);
    for (let i = 0; keyed.open && i < 3; i++) { await wait(300); keyed = await findKeyed(env, key, sameOrder); }
    if (keyed.open) return stillOpen();
    if (keyed.spent) return json({ error: "This order was tried too many times. Refresh the page and place it again.", key_spent: true }, 409);
    if (keyed.changed) return json({ error: `We already have this as order ${keyed.id}. To change its details, call the counter at 519-255-2222.`, existing_order: keyed.id }, 409);
    if (keyed.row) return replay(env, url.origin, keyed.row);
  }
  if (pay === "card" && !cardReady(env)) return json({ error: method === "pickup" ? "Card payment is not switched on yet. Choose pay at the counter." : "Card payment is not switched on yet. Call the counter at 519-255-2222 to order.", pay_off: true }, 503);
  // a brake, so nobody can flood the shop with orders
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 minute')").first("n");
  if (recent >= 12) return json({ error: "The shop is busy. Try again in a minute." }, 429);

  const lines = [];
  for (const [sku, qty] of want) {
    const p = bySku[sku];
    if (!p) return json({ error: "One of the items is no longer sold. Remove it and try again.", sku, stock: 0 }, 409);
    if (p.stock < qty) return json({ error: p.stock ? `Only ${p.stock} left of ${p.name}.` : `${p.name} has just sold out.`, sku, stock: p.stock }, 409);
    // Charcoal (and anything stored as pickup_only) goes by pickup or our own local delivery, never by Canada Post or any
    // carrier (owner, 2026-11-24). Every service other than "local" is a carrier service, so all of them are refused.
    if (method === "ship" && body.service !== "local" && (p.ship === "pickup_only" || isCharcoal(p))) return json({ error: `${p.name} is pickup only or local delivery near Windsor: it cannot be shipped by Canada Post.`, sku, local_only: true }, 409);
    if (pay === "card" && tobacco(p) && env.STRIPE_TOBACCO_OK !== "1") return json({ error: `${p.name} is paid at the counter when you pick it up.`, sku, field: "pay", counter_only: true }, 409);
    lines.push({ product: p, qty });
  }
  const subtotal = lines.reduce((a, l) => a + cents(l.product.price) * l.qty, 0);
  let shipping = 0, service = null, quote = {}, province = "ON", address = {}, eta = null;
  if (method === "ship") {
    const dest = rates.parsePostal(body.postal);
    if (!dest || !dest.complete) return json({ error: "Enter the full postal code, like N9A 1A1.", field: "postal" }, 400);
    const line1 = text(body.address && body.address.line1, 120), city = text(body.address && body.address.city, 60);
    if (!line1) return json({ error: "Enter the street address.", field: "line1" }, 400);
    if (!city) return json({ error: "Enter the city or town.", field: "city" }, 400);
    if (body.service === "local") {   // the fee comes only from the road distance worked out here
      if (!phone || String(phone).replace(/\D/g, "").length < 10) return json({ error: "Enter a phone number so the driver can reach you.", field: "phone" }, 400);
      const d = await deliveryQuote(env, { line1, city, postal: dest.full }, request.headers.get("CF-Connecting-IP") || "local");
      const other = lines.some(l => l.product.ship === "pickup_only" || isCharcoal(l.product)) ? "You can still pick it up free." : "You can still ship it or pick it up free.";
      if (d.status !== "ok") return json({ error: d.status === "far" ? `${dest.full} is past our 25 km delivery area. ${other}` : d.status === "down" ? `Delivery cannot be checked right now. ${other}` : "We could not confirm that address. Check the street number and postal code.", field: "line1", delivery: d.status }, 409);
      const due = rates.localDue(d.fee_cents, subtotal);   // $200.00 of items before tax delivers free
      if (body.delivery_fee_cents !== due) return json({ error: `Delivery to this address is ${due ? "$" + due / 100 : "free"}. Check the new total, then place your order.`, delivery: "ok", fee_cents: due, base_fee_cents: d.fee_cents }, 409);
      shipping = due; service = "Local delivery"; province = "ON"; eta = rates.localEta(); quote = { id: "local", eta, metres: d.metres, shop: d.shop, base_fee_cents: d.fee_cents, ...(d.confirm ? { confirm_address: true } : {}) };
      address = { line1, city, province, postal: dest.full };
    } else {
    if (rates.fuelOn().stale) console.error(JSON.stringify({ at: "checkout", problem: "Canada Post fuel rate is out of date: add this week's row to FUEL_WEEKS in rates-core.js", using: rates.fuelOn().week }));
    const parcels = rates.pack(lines), opts = rates.quote(dest, parcels);
    if (!opts.length) return json({ error: "One of these boxes is over the carrier's 30 kg limit. Call the counter and we will quote it by hand." }, 409);
    const chosen = opts.find(o => o.id === body.service);
    if (!chosen) return json({ error: "That shipping service is not available for this cart. Pick another.", field: "service" }, 409);
    shipping = cents(chosen.total); service = chosen.service; province = dest.prov;
    quote = { id: chosen.id, days: chosen.days, parcels: chosen.perParcel, fuel: chosen.fuel, cover: chosen.cover };
    address = { line1, city, province, postal: dest.full };
    }
  }
  const { tax, total } = rates.orderTotals(subtotal, shipping, province);
  // the shopper agreed to a figure: if ours is different, nothing is placed and they are shown the new one
  if (body.expected_total_cents !== undefined && body.expected_total_cents !== total) return json({ error: `The total is now ${rates.money(total / 100)}. Check it, then place your order.`, repriced: { subtotal_cents: subtotal, shipping_cents: shipping, tax_cents: tax, total_cents: total } }, 409);
  if (key) quote = { ...quote, idem: keyed.idem, idem_req: sameOrder };

  // 1 write the order as pending  2 take the stock, one guarded step per item  3 open the payment page, or put everything back
  const id = key ? keyed.id : code();
  try { await db.batch([
    db.prepare(`INSERT INTO orders (id, status, method, email, name, phone, address, subtotal_cents, shipping_cents, tax_cents, total_cents, tax_province, ship_service, ship_quote, pay_method, pay_status, pay_expires_at)
      VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${pay === "card" ? `strftime('%Y-%m-%dT%H:%M:%SZ','now','+${HOLD_MIN} minutes')` : "NULL"})`)
      .bind(id, method, email, name, phone, JSON.stringify({ ...address, ...(note ? { note } : {}) }), subtotal, shipping, tax, total, province, service, JSON.stringify(quote), pay, pay === "card" ? "awaiting" : "pay_at_pickup"),
    ...lines.map(l => db.prepare("INSERT INTO order_items (order_id, sku, name, qty, unit_cents) VALUES (?,?,?,?,?)").bind(id, l.product.sku, l.product.name, l.qty, cents(l.product.price))),
  ]); } catch (e) {   // two copies of one retry at the same moment: the database let one through
    if (!key || !/UNIQUE|constraint/i.test(String(e && e.message))) throw e;
    let again = await findKeyed(env, key, sameOrder);
    for (let i = 0; again.open && i < 3; i++) { await wait(300); again = await findKeyed(env, key, sameOrder); }
    return again.row ? replay(env, url.origin, again.row) : stillOpen();
  }
  const took = await db.batch(lines.flatMap(l => [
    db.prepare("UPDATE products SET stock = stock - ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?2 AND stock >= ?1 AND EXISTS (SELECT 1 FROM orders WHERE id = ?3 AND status = 'pending' AND release_op IS NULL)").bind(l.qty, l.product.sku, id),
    db.prepare("INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT ?2, -?1, 'sale', ?3, 'store' WHERE changes() = 1").bind(l.qty, l.product.sku, id),
  ]));
  const failed = lines.filter((l, i) => !took[i * 2].meta.changes);
  if (failed.length) {
    const got = lines.filter((l, i) => took[i * 2].meta.changes);
    await db.batch([
      ...got.flatMap(l => [db.prepare("UPDATE products SET stock = stock + ? WHERE sku = ?").bind(l.qty, l.product.sku), db.prepare("INSERT INTO stock_moves (sku, delta, reason, ref, actor) VALUES (?, ?, 'released', ?, 'store')").bind(l.product.sku, l.qty, id)]),
      db.prepare("DELETE FROM order_items WHERE order_id = ? AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'pending' AND release_op IS NULL)").bind(id, id), db.prepare("DELETE FROM orders WHERE id = ? AND status = 'pending' AND release_op IS NULL").bind(id),
    ]);
    const left = await db.prepare("SELECT stock FROM products WHERE sku = ?").bind(failed[0].product.sku).first("stock");
    return json({ error: `${failed[0].product.name} sold out while you were checking out.`, sku: failed[0].product.sku, stock: left ?? 0 }, 409);
  }
  let payInfo = { method: pay, status: pay === "card" ? "awaiting" : "pay_at_pickup" };
  if (pay === "card") {
    try {
      const row = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
      payInfo = { ...payInfo, ...(await openCheckout(env, url.origin, row)) };
    } catch (e) {   // Stripe could not make the page: nothing was charged, so the stock goes straight back
      console.error(JSON.stringify({ at: "checkout", order: id, problem: "payment page not made", message: String(e && e.message || e) }));
      await releaseHeld(db, id, "failed");
      return json({ error: "The payment page did not open. Nothing was charged. Try again in a minute.", pay_down: true }, 503);
    }
  } else await receipt(env, id, "at_pickup");   // the receipt says pay at the counter; a card receipt waits for the webhook
  return json({ ok: true, pay: payInfo, order: { id, method, name, email, service, province, subtotal_cents: subtotal, shipping_cents: shipping, tax_cents: tax, total_cents: total,
    tax_label: rates.taxLabel(province), days: quote.days ?? null, eta, address: method === "ship" ? address : null,
    items: lines.map(l => ({ sku: l.product.sku, name: l.product.name, qty: l.qty, unit_cents: cents(l.product.price) })) } }, 201);
}
