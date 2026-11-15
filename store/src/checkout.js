// Placing an order. The server works out every number itself (prices, packing, shipping, tax) from the database,
// so nothing the shopper's phone sends can change what is charged. Stock comes down in the same step and can
// never go below zero. Payment is not connected yet: orders are marked as demo orders and no card is taken.
import * as rates from "../public/rates-core.js";
import { loadCatalog, toStorefront } from "./catalog.js";
import { orderPlaced, lowStock, writeEmail } from "./email.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const text = (v, max) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;
const cents = n => Math.round(n * 100);
const code = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = crypto.getRandomValues(new Uint8Array(6)); return "W" + [...b].map(x => a[x % a.length]).join(""); };

export async function placeOrder(request, env, url) {
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return json({ error: "Send JSON." }, 415);
  const origin = request.headers.get("Origin"); if (origin && origin !== url.origin) return json({ error: "Wrong origin." }, 403);
  const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return json({ error: "That order could not be read." }, 400);
  const db = env.DB;
  // a brake, so nobody can flood the shop with orders
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 minute')").first("n");
  if (recent >= 12) return json({ error: "The shop is busy. Try again in a minute." }, 429);

  const name = text(body.name, 80), email = text(body.email, 120), phone = body.phone ? text(String(body.phone), 30) : null, note = body.note ? text(String(body.note), 240) : null;
  if (!name) return json({ error: "Tell us the name for the order.", field: "name" }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "That email address does not look right.", field: "email" }, 400);
  const method = body.method === "pickup" ? "pickup" : body.method === "ship" ? "ship" : null;
  if (!method) return json({ error: "Choose shipping or pickup." }, 400);
  if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 60) return json({ error: "Your cart is empty." }, 400);

  const cat = await loadCatalog(db), store = toStorefront(cat), bySku = Object.fromEntries(store.PRODUCTS.map(p => [p.sku, p]));
  rates.useBoxes(store.BOXES);
  const want = new Map();
  for (const l of body.lines) {
    const qty = Math.floor(Number(l && l.qty));
    if (!l || typeof l.sku !== "string" || !(qty >= 1 && qty <= rates.MAX_QTY)) return json({ error: "Something in the cart could not be read. Refresh and try again." }, 400);
    want.set(l.sku, (want.get(l.sku) || 0) + qty);
  }
  const lines = [];
  for (const [sku, qty] of want) {
    const p = bySku[sku];
    if (!p) return json({ error: "One of the items is no longer sold. Remove it and try again.", sku }, 409);
    if (p.stock < qty) return json({ error: p.stock ? `Only ${p.stock} left of ${p.name}.` : `${p.name} has just sold out.`, sku, stock: p.stock }, 409);
    if (method === "ship" && p.ship === "pickup_only") return json({ error: `${p.name} is pickup only.`, sku }, 409);
    lines.push({ product: p, qty });
  }
  const subtotal = lines.reduce((a, l) => a + cents(l.product.price) * l.qty, 0);
  let shipping = 0, service = null, quote = {}, province = "ON", address = { demo: true };
  if (method === "ship") {
    const dest = rates.parsePostal(body.postal);
    if (!dest || !dest.complete) return json({ error: "Enter the full postal code, like N9A 1A1.", field: "postal" }, 400);
    const line1 = text(body.address && body.address.line1, 120), city = text(body.address && body.address.city, 60);
    if (!line1) return json({ error: "Enter the street address.", field: "line1" }, 400);
    if (!city) return json({ error: "Enter the city or town.", field: "city" }, 400);
    const parcels = rates.pack(lines), opts = rates.quote(dest, parcels);
    if (!opts.length) return json({ error: "One of these boxes is over the carrier's 30 kg limit. Call the counter and we will quote it by hand." }, 409);
    const chosen = opts.find(o => o.id === body.service);
    if (!chosen) return json({ error: "That shipping service is not available for this cart. Pick another.", field: "service" }, 409);
    shipping = cents(chosen.total); service = chosen.service; province = dest.prov;
    quote = { id: chosen.id, days: chosen.days, parcels: chosen.perParcel, fuel: chosen.fuel, cover: chosen.cover };
    address = { demo: true, line1, city, province, postal: dest.full };
  }
  const tax = Math.round((subtotal + shipping) * rates.taxRate(province)), total = subtotal + shipping + tax;

  // 1 write the order as pending  2 take the stock, one guarded step per item  3 confirm, or put everything back
  const id = code();
  await db.batch([
    db.prepare("INSERT INTO orders (id, status, method, email, name, phone, address, subtotal_cents, shipping_cents, tax_cents, total_cents, tax_province, ship_service, ship_quote, payment_ref) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DEMO')")
      .bind(id, method, email, name, phone, JSON.stringify({ ...address, ...(note ? { note } : {}) }), subtotal, shipping, tax, total, province, service, JSON.stringify(quote)),
    ...lines.map(l => db.prepare("INSERT INTO order_items (order_id, sku, name, qty, unit_cents) VALUES (?,?,?,?,?)").bind(id, l.product.sku, l.product.name, l.qty, cents(l.product.price))),
  ]);
  const took = await db.batch(lines.flatMap(l => [
    db.prepare("UPDATE products SET stock = stock - ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?2 AND stock >= ?1").bind(l.qty, l.product.sku),
    db.prepare("INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT ?2, -?1, 'sale', ?3, 'store' WHERE changes() = 1").bind(l.qty, l.product.sku, id),
  ]));
  const failed = lines.filter((l, i) => !took[i * 2].meta.changes);
  if (failed.length) {
    const got = lines.filter((l, i) => took[i * 2].meta.changes);
    await db.batch([
      ...got.flatMap(l => [db.prepare("UPDATE products SET stock = stock + ? WHERE sku = ?").bind(l.qty, l.product.sku), db.prepare("INSERT INTO stock_moves (sku, delta, reason, ref, actor) VALUES (?, ?, 'released', ?, 'store')").bind(l.product.sku, l.qty, id)]),
      db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id), db.prepare("DELETE FROM orders WHERE id = ?").bind(id),
    ]);
    return json({ error: `${failed[0].product.name} sold out while you were checking out.`, sku: failed[0].product.sku }, 409);
  }
  await db.prepare("UPDATE orders SET status = 'paid', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?").bind(id).run();
  // the receipt to the shopper, and a note to the shop if this order took anything down to its warning level
  const site = env.SITE_NAME || "One Stop Shop", sold = lines.map(l => ({ name: l.product.name, qty: l.qty, unit_cents: cents(l.product.price) }));
  await writeEmail(env, id, email, orderPlaced(site, { id, name, method, ship_service: service, subtotal_cents: subtotal, shipping_cents: shipping, tax_cents: tax, total_cents: total, tax_province: province }, sold));
  const low = await db.prepare(`SELECT name, stock FROM products WHERE active = 1 AND stock <= low_stock_at AND sku IN (${lines.map(() => "?").join(",")}) ORDER BY stock, name`).bind(...lines.map(l => l.product.sku)).all();
  if (low.results.length) await writeEmail(env, id, env.OWNER_EMAIL || "the shop", lowStock(site, low.results));
  return json({ ok: true, order: { id, method, name, email, service, province, subtotal_cents: subtotal, shipping_cents: shipping, tax_cents: tax, total_cents: total,
    tax_label: rates.taxLabel(province), days: quote.days ?? null, address: method === "ship" ? address : null,
    items: lines.map(l => ({ sku: l.product.sku, name: l.product.name, qty: l.qty, unit_cents: cents(l.product.price) })) } }, 201);
}
