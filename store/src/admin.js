import { orderShipped, pickupReady, writeEmail } from "./email.js";
import { snapshot } from "./backup.js";
import { CHARCOAL } from "./catalog.js";
import { adminPay } from "./pay.js";
import { sameSecret, hashPin, checkPin, pinProblem, cleanName } from "./staff.js";
import { report, reportCsv, monthOf } from "./report.js";
// The shop's back office: sign-in, shop numbers, stock and orders. Every route here needs the admin cookie,
// and every write also needs a same-site JSON request, so another website cannot trigger one.
// Two kinds of sign-in: the owner's passcode (ADMIN_KEY), and named staff with a 6-digit PIN. Every change is
// written down with the name of whoever was signed in. Staff can do the daily work; only the owner manages
// staff, settings, the monthly report and the full backup.
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
const COOKIE = "oss_admin";
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const sha = async s => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const cookieToken = request => ((request.headers.get("Cookie") || "").match(/(?:^|;\s*)oss_admin=([a-f0-9]{64})/) || [])[1];
const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
export async function signedIn(request, env) {
  // each sign-in is its own random token, kept only as a hash. It ends after 12 hours, after 2 hours left alone,
  // on sign-out, and (for staff) the moment the owner removes that person.
  const t = cookieToken(request); if (!t) return null;
  const h = await sha(t);
  const s = await env.DB.prepare(`SELECT s.actor, s.staff_id, s.last_seen, st.active FROM sessions s LEFT JOIN staff st ON st.id = s.staff_id
    WHERE s.token_hash = ? AND s.expires_at > ${NOW} AND (s.last_seen IS NULL OR s.last_seen > strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 hours'))`).bind(h).first();
  if (!s || (s.staff_id !== null && s.active !== 1)) return null;
  if (!s.last_seen || Date.parse(s.last_seen) < Date.now() - 5 * 60e3) await env.DB.prepare(`UPDATE sessions SET last_seen = ${NOW} WHERE token_hash = ?`).bind(h).run();
  return { actor: s.actor, staff_id: s.staff_id, owner: s.staff_id === null };
}
const LOCKED = "Too many wrong tries. Wait 15 minutes and try again.";
const cleanOp = v => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v) ? v : null;   // a tap's own key, so a repeat counts once
const log = (event, fields) => console.log(JSON.stringify({ at: "admin", event, ...fields }));   // never a PIN, passcode or token
const CHARCOAL_ITEM = `(p.category_id = '${CHARCOAL}' OR p.details LIKE '%"charcoal":true%')`;   // Heat (foil, heat management) is not charcoal since 2026-11-24
// A product added to the charcoal section, and any charcoal item saved later, is stored as charcoal, pickup or local delivery only, whatever the form sent.
// (The storefront and checkout enforce the same from the section alone; this keeps the stored row honest too.)
function charcoalRules(out, was) {
  out.ship_class = "pickup_only";
  const d = "details" in out ? JSON.parse(out.details) : was;
  out.details = JSON.stringify({ ...d, charcoal: true });
}
const SOLD = "('paid','packed','shipped','ready','collected')";
const LOCAL = "'-5 hours'"; // the shop's clock (Windsor), close enough for day totals
const clampInt = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const text = (v, max) => typeof v === "string" && v.trim().length <= max ? v.trim() : null;

export async function admin(request, env, url) {
  const path = url.pathname.replace(/^\/api\/admin/, ""), method = request.method, db = env.DB;
  // a browser says when a request comes from another site (Fetch Metadata); any write that does is refused, sign-in included
  const site = request.headers.get("Sec-Fetch-Site");
  if (method !== "GET" && site && site !== "same-origin") return json({ error: "Wrong origin." }, 403);
  if ((path === "/login" || path === "/logout") && method === "POST" && (!(request.headers.get("Content-Type") || "").startsWith("application/json") || request.headers.get("X-OSS-Admin") !== "1")) return json({ error: "Missing request marker." }, 400);   // no sign-in or sign-out from a plain form on another site
  if (path === "/login" && method === "POST") {
    if (!env.ADMIN_KEY) return json({ error: "The admin passcode has not been set up yet." }, 503);
    const body = await request.json().catch(() => ({}));
    const staffLogin = typeof body.name === "string" || typeof body.pin === "string";
    if (staffLogin && env.LIVE === "1" && !env.PIN_PEPPER) return json({ error: "Staff sign-in is not set up yet. Sign in with the owner passcode." }, 503);
    const name = staffLogin ? cleanName(body.name) : null, nameKey = "n:" + await sha("name|" + (name || String(body.name || "")).toLowerCase());
    // The try is written down BEFORE it is checked, so a burst of tries at once is counted in full. More than five
    // tries from one place, more than five on one staff name from anywhere (names that do not exist lock the same way,
    // so a lock does not reveal who works here), or more than forty staff tries in all, locks sign-in for fifteen
    // minutes. The owner's passcode is not held back by other people's wrong PINs.
    const who = await sha("who|" + (request.headers.get("CF-Connecting-IP") || "local"));
    const mark = await db.batch([db.prepare("INSERT INTO login_attempts (who, ok) VALUES (?, 0)").bind(who), ...(staffLogin ? [db.prepare("INSERT INTO login_attempts (who, ok) VALUES (?, 0)").bind(nameKey)] : [])]);
    const tries = await db.prepare("SELECT COALESCE(SUM(who = ?1 AND ok = 0),0) AS mine, COALESCE(SUM(who = ?2 AND ok = 0),0) AS this_name, COALESCE(SUM(ok = 0 AND who LIKE 'n:%'),0) AS everyone FROM login_attempts WHERE at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')").bind(who, nameKey).first();
    if (tries.mine > 5 || (staffLogin && (tries.this_name > 5 || tries.everyone > 40))) { log("login_locked", { staff: staffLogin }); return json({ error: LOCKED }, 429); }
    let right = false, staff = null;
    if (staffLogin) {
      staff = name ? await db.prepare("SELECT id, name, pin_hash FROM staff WHERE lower(name) = lower(?) AND active = 1").bind(name).first() : null;
      right = await checkPin(env, typeof body.pin === "string" ? body.pin : "", staff && staff.pin_hash) && !!staff;   // the same work whether or not the name exists
    } else right = typeof body.passcode === "string" && await sameSecret(body.passcode, env.ADMIN_KEY);
    if (!right) { if (staff) await db.prepare("UPDATE login_attempts SET staff_id = ? WHERE id = ?").bind(staff.id, mark[0].meta.last_row_id).run(); log("login_failed", { staff: staffLogin }); return json({ error: staffLogin ? "That name and PIN do not match." : "That passcode is not right." }, 401); }
    await db.batch([db.prepare("UPDATE login_attempts SET ok = 1, staff_id = ? WHERE id = ?").bind(staff ? staff.id : null, mark[0].meta.last_row_id), ...(staffLogin ? [db.prepare("DELETE FROM login_attempts WHERE id = ?").bind(mark[1].meta.last_row_id)] : [])]);
    const actor = staff ? `${staff.name} #${staff.id}` : "owner", t = hex(crypto.getRandomValues(new Uint8Array(32)));
    await db.batch([
      db.prepare(`INSERT INTO sessions (token_hash, expires_at, actor, staff_id, last_seen) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ','now','+12 hours'), ?, ?, ${NOW})`).bind(await sha(t), actor, staff ? staff.id : null),
      db.prepare("DELETE FROM sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%SZ','now') OR last_seen <= strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 hours')"), db.prepare("DELETE FROM login_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"),
      db.prepare("INSERT INTO audit_log (actor, action) VALUES (?, 'session.login')").bind(actor),
    ]);
    const secure = url.protocol === "https:" ? " Secure;" : "";
    return json({ ok: true, actor, owner: !staff }, 200, { "Set-Cookie": `${COOKIE}=${t}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${60 * 60 * 12}` });
  }
  if (path === "/logout" && method === "POST") { const t = cookieToken(request); if (t) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(t)).run(); }
  if (path === "/logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
  const session = await signedIn(request, env);
  if (!session) return json({ error: "Sign in first." }, 401);
  if (method !== "GET") {
    if (!(request.headers.get("Content-Type") || "").startsWith("application/json") && !path.endsWith("/photo")) return json({ error: "Send JSON." }, 415);
    if (request.headers.get("X-OSS-Admin") !== "1") return json({ error: "Missing request marker." }, 400);
    const origin = request.headers.get("Origin"); if (origin && origin !== url.origin) return json({ error: "Wrong origin." }, 403);
  }
  const actor = session.actor;
  const ownerOnly = /^\/(staff|settings|report|backup)/.test(path);
  if (ownerOnly && !session.owner) { log("forbidden", { actor, path }); return json({ error: "Only the owner can open this." }, 403); }
  if (path === "/me" && method === "GET") return json({ actor, owner: session.owner });

  if (path === "/summary" && method === "GET") {
    const [tot, daily, top, slow, low, prov, ship, value, todo] = await db.batch([
      db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN date(created_at,${LOCAL}) = date('now',${LOCAL}) THEN total_cents END),0) AS today_cents,
        COUNT(CASE WHEN date(created_at,${LOCAL}) = date('now',${LOCAL}) THEN 1 END) AS today_orders,
        COALESCE(SUM(CASE WHEN created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days') THEN total_cents END),0) AS week_cents,
        COUNT(CASE WHEN created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days') THEN 1 END) AS week_orders,
        COALESCE(SUM(CASE WHEN created_at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days') AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days') THEN total_cents END),0) AS prev_week_cents,
        COALESCE(SUM(CASE WHEN created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') THEN total_cents END),0) AS month_cents,
        COUNT(CASE WHEN created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') THEN 1 END) AS month_orders
        FROM orders WHERE status IN ${SOLD}`),
      db.prepare(`SELECT date(created_at,${LOCAL}) AS day, SUM(total_cents) AS cents, COUNT(*) AS orders FROM orders WHERE status IN ${SOLD} AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') GROUP BY day ORDER BY day`),
      db.prepare(`SELECT i.sku, i.name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_cents) AS cents FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status IN ${SOLD} AND o.created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') GROUP BY i.sku ORDER BY cents DESC LIMIT 6`),
      db.prepare(`SELECT p.sku, p.name, p.stock, p.price_cents FROM products p WHERE p.active = 1 AND p.stock > 0 AND NOT EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.sku = p.sku AND o.created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')) ORDER BY p.stock * p.price_cents DESC LIMIT 6`),
      db.prepare("SELECT sku, name, stock, low_stock_at FROM products WHERE active = 1 AND stock <= low_stock_at ORDER BY stock, name LIMIT 40"),
      db.prepare(`SELECT tax_province AS province, COUNT(*) AS orders, SUM(total_cents) AS cents FROM orders WHERE status IN ${SOLD} AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') GROUP BY tax_province ORDER BY orders DESC`),
      db.prepare(`SELECT COALESCE(SUM(shipping_cents),0) AS collected, COALESCE(SUM(label_cents),0) AS paid, COUNT(*) AS parcels FROM orders WHERE method = 'ship' AND label_cents IS NOT NULL AND status IN ${SOLD} AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')`),
      db.prepare("SELECT COALESCE(SUM(stock * COALESCE(cost_cents, 0)),0) AS cost_cents, COALESCE(SUM(stock * price_cents),0) AS retail_cents, COALESCE(SUM(stock),0) AS units, COUNT(*) AS products FROM products WHERE active = 1"),
      db.prepare("SELECT SUM(status = 'paid') AS to_pack, SUM(status = 'packed') AS to_ship, SUM(status = 'ready') AS waiting_pickup, SUM(status = 'ready' AND COALESCE(ready_at, updated_at) <= strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days')) AS pickup_overdue FROM orders WHERE status IN ('paid','packed','ready')"),
    ]);
    return json({ totals: tot.results[0], daily: daily.results, top: top.results, slow: slow.results, low: low.results, provinces: prov.results, shipping: ship.results[0], value: value.results[0], todo: todo.results[0], actor, owner: session.owner });
  }

  if (path === "/products" && method === "GET") {
    const [p, c, b] = await db.batch([
      db.prepare("SELECT sku, name, category_id, price_cents, cost_cents, weight_g, box_id, glass, ship_class, height_cm, note, img, img_dark, photo_ver, details, stock, low_stock_at, active, listed, family, variant_label, updated_at FROM products ORDER BY active DESC, sort, sku"),
      db.prepare("SELECT id, name, tone FROM categories ORDER BY sort"), db.prepare("SELECT id, label, l_cm, w_cm, h_cm FROM boxes ORDER BY l_cm * w_cm * h_cm"),
    ]);
    return json({ products: p.results, categories: c.results, boxes: b.results });
  }

  // one product: fields to save, validated here so nothing odd reaches the storefront
  const fields = async body => {
    const out = {}, bad = [];
    const set = (k, v, label) => { if (v === null) bad.push(label); else out[k] = v; };
    if ("name" in body) set("name", text(body.name, 80) || null, "name");
    if ("category_id" in body) set("category_id", (await db.prepare("SELECT id FROM categories WHERE id = ?").bind(String(body.category_id)).first("id")) ?? null, "section");
    if ("price_cents" in body) set("price_cents", clampInt(body.price_cents, 0, 5000000), "price");
    if ("cost_cents" in body) out.cost_cents = body.cost_cents === null || body.cost_cents === "" ? null : clampInt(body.cost_cents, 0, 5000000);
    if ("weight_g" in body) set("weight_g", clampInt(body.weight_g, 1, 30000), "weight");
    if ("box_id" in body) set("box_id", (await db.prepare("SELECT id FROM boxes WHERE id = ?").bind(String(body.box_id)).first("id")) ?? null, "box");
    if ("ship_class" in body) set("ship_class", ["standard", "ground_only", "pickup_only"].includes(body.ship_class) ? body.ship_class : null, "shipping type");
    if ("glass" in body) out.glass = body.glass ? 1 : 0;
    if ("active" in body) out.active = body.active ? 1 : 0;
    if ("note" in body) set("note", text(body.note, 200), "description");
    // a catalogue colour's name (the photo's guess until the shop corrects it); an empty name is allowed and shows "Colours TBD"
    // Kept in details (a shop column) so a later catalogue import, which refreshes variant_label, never overwrites the shop's word.
    if ("variant_label" in body) { const v = body.variant_label === null ? "" : text(body.variant_label, 40); if (v === null) bad.push("colour name"); else out.colour = v; }
    if ("low_stock_at" in body) set("low_stock_at", clampInt(body.low_stock_at, 0, 9999), "low stock level");
    if ("details" in body) { const d = body.details || {}; out.details = JSON.stringify({ ...(clampInt(d.ml, 1, 5000) ? { ml: clampInt(d.ml, 1, 5000) } : {}), ...(text(d.kind, 40) ? { kind: text(d.kind, 40) } : {}), ...(text(d.notes, 120) ? { notes: text(d.notes, 120) } : {}) }); }
    return { out, bad };
  };
  const audit = (action, target, before, after) => db.prepare("INSERT INTO audit_log (actor, action, target, before, after) VALUES (?,?,?,?,?)").bind(actor, action, target, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null);

  // Prices are the shop's, so the owner sets them (owner, 2026-11-24). Staff keep the daily work: counting, receiving,
  // names, photos, the on/off switch. A new product always carries a price, so adding one is the owner's too.
  // Checked here, on the server, for every request (OWASP Authorization Cheat Sheet: deny by default, enforce server side).
  const PRICE_FIELDS = ["price_cents", "cost_cents"];
  const NOT_YOURS = "Only the owner can change prices. Ask the owner, or sign in with the owner passcode.";
  if (path === "/products" && method === "POST" && !session.owner) { log("forbidden", { actor, path }); return json({ error: "Only the owner can add products, because a new product needs the shop's price." }, 403); }
  if (path === "/products" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { out, bad } = await fields({ ship_class: "standard", note: "", low_stock_at: 1, ...body });
    delete out.colour;   // colour names belong to catalogue colours, never to a new back-office item
    for (const k of ["name", "category_id", "price_cents", "weight_g", "box_id"]) if (!(k in out)) bad.push(k.replace(/_.*/, ""));
    if (bad.length) return json({ error: "Check: " + [...new Set(bad)].join(", ") + "." }, 400);
    if (out.category_id === CHARCOAL) charcoalRules(out, {});
    const prefix = { hookahs: 1, bases: 2, bowls: 3, heat: 4, hoses: 5, parts: 6, cologne: 7, misc: 8 }[out.category_id] || 9;
    const last = await db.prepare("SELECT MAX(CAST(substr(sku, 5) AS INTEGER)) AS n FROM products WHERE sku LIKE ? AND length(sku) = 8").bind(`OSS-${prefix}%`).first("n"); // 4-digit numbers only: OSS-SSNNNN catalogue numbers belong to store/catalog/registry.json
    const sku = "OSS-" + String(Math.max(prefix * 1000, last || 0) + 1);
    const cols = Object.keys(out), stock = clampInt(body.stock ?? 0, 0, 99999) ?? 0;
    const stmts = [db.prepare(`INSERT INTO products (sku, sort, stock, ${cols.join(", ")}) VALUES (?, 9999, ?, ${cols.map(() => "?").join(", ")})`).bind(sku, stock, ...cols.map(k => out[k])), audit("product.create", sku, null, out)];
    if (stock) stmts.push(db.prepare("INSERT INTO stock_moves (sku, delta, reason, actor) VALUES (?,?, 'count', ?)").bind(sku, stock, actor));
    await db.batch(stmts);
    return json({ ok: true, sku }, 201);
  }

  let m;
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})$/)) && method === "PUT") {
    const before = await db.prepare("SELECT * FROM products WHERE sku = ?").bind(m[1]).first(); if (!before) return json({ error: "No such product." }, 404);
    const { out, bad } = await fields(await request.json().catch(() => ({})));
    if (bad.length) return json({ error: "Check: " + bad.join(", ") + "." }, 400);
    if (!session.owner) {   // the edit form sends every field back; an unchanged price from staff is fine, a changed one is refused whole
      if (PRICE_FIELDS.some(k => k in out && out[k] !== before[k])) { log("forbidden", { actor, path, field: "price" }); return json({ error: NOT_YOURS }, 403); }
      for (const k of PRICE_FIELDS) delete out[k];
    }
    // The form edits only the cologne fields. Everything else in details (the charcoal mark, photo status, brand,
    // source lines, a roll's box) is kept, so saving a charcoal item in the back office never erases its rules.
    let had = {}; try { had = JSON.parse(before.details || "{}"); } catch {}
    if ("details" in out) { const { ml, kind, notes, ...keep } = had; out.details = JSON.stringify({ ...keep, ...JSON.parse(out.details) }); }
    if ("colour" in out) {   // the shop's confirmed colour name; empty takes it back to the photo's guess ("Colours TBD")
      const base = "details" in out ? JSON.parse(out.details) : { ...had }; if (out.colour) base.colour = out.colour; else delete base.colour;
      out.details = JSON.stringify(base); delete out.colour;
    }
    // charcoal stays charcoal, an item from the charcoal list too, wherever it is moved. An ordinary item moved into Charcoal is
    // charcoal by its section while it is there (src/catalog.js), and goes back to what it was if it is moved out again.
    if (had.charcoal || String(before.family || "").startsWith("charcoal-")) charcoalRules(out, had);
    const cols = Object.keys(out); if (!cols.length) return json({ ok: true });
    const was = {}; for (const k of cols) was[k] = before[k];
    try { await db.batch([db.prepare(`UPDATE products SET ${cols.map(k => k + " = ?").join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?`).bind(...cols.map(k => out[k]), m[1]), audit("product.edit", m[1], was, out)]); }
    catch (e) { if (/Set the shop price/.test(String(e && e.message))) return json({ error: "Set the shop price before turning this item on." }, 409); throw e; }
    return json({ ok: true });
  }
  // Stock changes. Each is one database transaction (a D1 batch): the move is written only if the count changed, the
  // count can never go below zero, and a tap's key (op) lets a repeated request count once and answer the same.
  const replayed = async op => { const r = await db.prepare("SELECT m.sku, p.stock FROM stock_moves m JOIN products p ON p.sku = m.sku WHERE m.op = ?").bind(op).first(); return r; };
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/(stock|receive)$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), receive = m[2] === "receive", op = cleanOp(body.op);
    const delta = !Number.isInteger(receive ? body.qty : body.delta) ? null : receive ? clampInt(body.qty, 1, 9999) : clampInt(body.delta, -9999, 9999);
    const reason = receive ? "received" : ["received", "damaged", "correction", "return"].includes(body.reason) ? body.reason : "correction";
    const ref = receive ? text(body.ref ?? "", 60) : null;
    if (!delta) return json({ error: receive ? "Enter how many arrived, 1 or more." : "Nothing to change." }, 400);
    if (ref === null && receive) return json({ error: "Keep the delivery note under 60 characters." }, 400);
    if (op) { const r = await replayed(op); if (r) return r.sku === m[1] ? json({ ok: true, stock: r.stock, replayed: true }) : json({ error: "That tap key was already used." }, 409); }
    const res = await db.batch([
      db.prepare(`UPDATE products SET stock = stock + ?1, updated_at = ${NOW} WHERE sku = ?2 AND stock + ?1 >= 0 AND (?3 IS NULL OR NOT EXISTS (SELECT 1 FROM stock_moves WHERE op = ?3))`).bind(delta, m[1], op),
      db.prepare("INSERT INTO stock_moves (sku, delta, reason, ref, actor, op) SELECT ?2, ?1, ?3, ?5, ?4, ?6 WHERE changes() = 1").bind(delta, m[1], reason, actor, ref || null, op),
      db.prepare("SELECT stock FROM products WHERE sku = ?").bind(m[1]),
    ]);
    if (!res[2].results.length) return json({ error: "No such product." }, 404);
    if (!res[0].meta.changes) { const r = op && await replayed(op); if (r) return r.sku === m[1] ? json({ ok: true, stock: r.stock, replayed: true }) : json({ error: "That tap key was already used." }, 409); return json({ error: "Stock cannot go below zero.", stock: res[2].results[0].stock }, 409); }
    return json({ ok: true, stock: res[2].results[0].stock });
  }
  // Count mode: the shelf count typed in. The server works out the difference and writes it as a "count" move, even
  // when nothing changed (a count that matched is worth knowing). If an order took stock since the screen was loaded
  // (seen no longer matches), nothing is saved and the new number is shown, so a sale is never counted away by mistake.
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/count$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), counted = clampInt(body.counted, 0, 99999), op = cleanOp(body.op);
    const whole = v => (Number.isInteger(v) || (typeof v === "string" && /^\d{1,5}$/.test(v.trim()))) ? clampInt(v, 0, 99999) : null;
    const seen = whole(body.seen);
    if (whole(body.counted) === null) return json({ error: "Type the number on the shelf, a whole number, 0 or more." }, 400);
    if (seen === null) return json({ error: "Reload the list and count again." }, 400);   // the number the screen showed is required: a count never overwrites a sale it did not see
    if (op) { const r = await replayed(op); if (r) return r.sku === m[1] ? json({ ok: true, stock: r.stock, replayed: true }) : json({ error: "That tap key was already used." }, 409); }
    const res = await db.batch([
      db.prepare(`INSERT INTO stock_moves (sku, delta, reason, ref, actor, op) SELECT sku, ?2 - stock, 'count', ?6, ?4, ?5 FROM products WHERE sku = ?1 AND (?3 IS NULL OR stock = ?3) AND (?5 IS NULL OR NOT EXISTS (SELECT 1 FROM stock_moves WHERE op = ?5))`).bind(m[1], counted, seen, actor, op, "counted " + counted),
      db.prepare(`UPDATE products SET stock = ?2, updated_at = ${NOW} WHERE sku = ?1 AND changes() = 1`).bind(m[1], counted),
      db.prepare("SELECT stock FROM products WHERE sku = ?").bind(m[1]),
      db.prepare("SELECT delta FROM stock_moves WHERE id = last_insert_rowid() AND sku = ?").bind(m[1]),
    ]);
    if (!res[2].results.length) return json({ error: "No such product." }, 404);
    if (!res[0].meta.changes) {
      const r = op && await replayed(op); if (r) return r.sku === m[1] ? json({ ok: true, stock: r.stock, replayed: true }) : json({ error: "That tap key was already used." }, 409);
      return json({ error: `An order changed this to ${res[2].results[0].stock} while you were counting. Check the shelf again.`, stock: res[2].results[0].stock, changed: true }, 409);
    }
    return json({ ok: true, stock: res[2].results[0].stock, delta: res[3].results[0]?.delta ?? null });
  }
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/history$/)) && method === "GET") {
    const [mv, au] = await db.batch([
      db.prepare("SELECT delta, reason, ref, actor, at FROM stock_moves WHERE sku = ? ORDER BY id DESC LIMIT 12").bind(m[1]),
      db.prepare("SELECT action, actor, before, after, at FROM audit_log WHERE target = ? ORDER BY id DESC LIMIT 8").bind(m[1]),
    ]);
    return json({ moves: mv.results, changes: au.results });
  }
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/photo$/)) && method === "POST") {
    const type = (request.headers.get("Content-Type") || "").split(";")[0];
    if (!["image/webp", "image/jpeg", "image/png"].includes(type)) return json({ error: "Use a JPEG, PNG or WebP photo." }, 415);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength < 200 || bytes.byteLength > 600000) return json({ error: "That photo is too large after resizing." }, 413);
    const b = new Uint8Array(bytes.slice(0, 12)), isImg = (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57);
    if (!isImg) return json({ error: "That file is not a photo." }, 415);
    const ok = await db.prepare("SELECT sku FROM products WHERE sku = ?").bind(m[1]).first(); if (!ok) return json({ error: "No such product." }, 404);
    await db.batch([
      db.prepare("INSERT INTO product_photos (sku, type, bytes) VALUES (?,?,?) ON CONFLICT(sku) DO UPDATE SET type = excluded.type, bytes = excluded.bytes, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')").bind(m[1], type, bytes),
      db.prepare("UPDATE products SET photo_ver = photo_ver + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?").bind(m[1]), audit("product.photo", m[1], null, { bytes: bytes.byteLength }),
    ]);
    return json({ ok: true });
  }

  if (path === "/orders" && method === "GET") {
    const r = await db.prepare(`SELECT o.id, o.status, o.method, o.name, o.total_cents, o.pay_method, o.pay_status, o.tax_province, o.ship_service, o.tracking, o.created_at, CASE WHEN o.status = 'ready' THEN COALESCE(o.ready_at, o.updated_at) END AS ready_at, o.source, (SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id) AS units,
      EXISTS (SELECT 1 FROM order_items i JOIN products p ON p.sku = i.sku WHERE i.order_id = o.id AND ${CHARCOAL_ITEM}) AS charcoal FROM orders o ORDER BY o.created_at DESC LIMIT 200`).all();
    return json({ orders: r.results });
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})$/)) && method === "GET") {
    const [o, i, mail, trail] = await db.batch([db.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]), db.prepare("SELECT i.sku, i.name, i.qty, i.unit_cents, p.img, p.img_dark, p.photo_ver, p.box_id, p.category_id, p.details FROM order_items i LEFT JOIN products p ON p.sku = i.sku WHERE i.order_id = ?").bind(m[1]),
      db.prepare("SELECT id, kind, recipient, subject, status, at FROM emails WHERE order_id = ? ORDER BY id").bind(m[1]),
      db.prepare("SELECT action, actor, before, after, at FROM audit_log WHERE target = ? ORDER BY id").bind(m[1])]);
    if (!o.results.length) return json({ error: "No such order." }, 404);
    const { cancel_op, ...order } = o.results[0];
    return json({ order, items: i.results, emails: mail.results, trail: trail.results });
  }
  // Cancel and put the stock back. Exactly one request can win the change to "cancelled" (the row records that
  // request's own key), and only the winner's statements put stock back, all in one transaction. A second tap,
  // a retry or two people at once can never restock twice.
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/cancel$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), op = cleanOp(body.op) || crypto.randomUUID();
    const reason = ["no_show", "customer", "other"].includes(body.reason) ? body.reason : null, note = text(body.note ?? "", 200);
    if (!reason) return json({ error: "Pick why it is cancelled." }, 400);
    if (note === null) return json({ error: "Keep the note under 200 characters." }, 400);
    if (reason === "other" && !note) return json({ error: "Say why in a few words." }, 400);
    const o = await db.prepare("SELECT status, cancel_op, pay_status, pay_method FROM orders WHERE id = ?").bind(m[1]).first();
    if (!o) return json({ error: "No such order." }, 404);
    if (o.cancel_op && o.cancel_op === op) return json({ ok: true, status: "cancelled", replayed: true });
    // a pay-at-counter pickup is still "pending" (nothing paid): it can be cancelled too, which is the usual no-show
    if (!["paid", "packed", "ready"].includes(o.status) && !(o.status === "pending" && o.pay_status === "pay_at_pickup")) return json({ error: o.status === "cancelled" ? "This order is already cancelled." : "Only orders not yet sent or collected can be cancelled here." }, 409);
    // Every statement asks the same question of the order as it was before this transaction: still open, never
    // cancelled. The order is flipped last. A retry, or a second tap, sees the flipped order and changes nothing.
    const open = `EXISTS (SELECT 1 FROM orders WHERE id = ?1 AND (status IN ('paid','packed','ready') OR (status = 'pending' AND pay_status = 'pay_at_pickup' AND release_op IS NULL)) AND cancel_op IS NULL)`;
    const res = await db.batch([
      db.prepare(`UPDATE products SET stock = stock + (SELECT qty FROM order_items i WHERE i.order_id = ?1 AND i.sku = products.sku), updated_at = ${NOW} WHERE sku IN (SELECT sku FROM order_items WHERE order_id = ?1) AND ${open}`).bind(m[1]),
      db.prepare(`INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT sku, qty, 'released', ?1, ?2 FROM order_items WHERE order_id = ?1 AND ${open}`).bind(m[1], actor),
      db.prepare(`INSERT INTO audit_log (actor, action, target, before, after) SELECT ?2, 'order.cancel', ?1, ?3, ?4 WHERE ${open}`).bind(m[1], actor, JSON.stringify({ status: o.status }), JSON.stringify({ status: "cancelled", reason, ...(note ? { note } : {}) })),
      db.prepare(`UPDATE orders SET status = 'cancelled', cancelled_at = ${NOW}, cancelled_by = ?3, cancel_reason = ?4, cancel_note = ?5, cancel_op = ?2, updated_at = ${NOW} WHERE id = ?1 AND (status IN ('paid','packed','ready') OR (status = 'pending' AND pay_status = 'pay_at_pickup' AND release_op IS NULL)) AND cancel_op IS NULL`).bind(m[1], op, actor, reason, note || null),
      db.prepare("SELECT status, cancel_op FROM orders WHERE id = ?1").bind(m[1]),
    ]);
    const now = res[4].results[0];
    if (!res[3].meta.changes) return now.cancel_op === op ? json({ ok: true, status: "cancelled", replayed: true }) : json({ error: now.status === "cancelled" ? "This order is already cancelled." : "This order changed. Reload it." }, 409);
    // a card payment is not given back by cancelling: the sheet keeps the refund button until it is refunded
    return json({ ok: true, status: "cancelled", restocked: res[1].meta.changes, refund_owed: o.pay_method === "card" && ["paid", "part_refunded"].includes(o.pay_status) });
  }
  // Staff-only: the ID tick on a charcoal order. Never part of anything a customer sees (order page, emails, catalogue).
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/id-check$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), on = body.checked === true;
    if (typeof body.checked !== "boolean") return json({ error: "Send checked: true or false." }, 400);
    const ok = await db.prepare(`SELECT o.id FROM orders o WHERE o.id = ? AND o.status IN ('paid','packed','ready','shipped','collected') AND EXISTS (SELECT 1 FROM order_items i JOIN products p ON p.sku = i.sku WHERE i.order_id = o.id AND ${CHARCOAL_ITEM})`).bind(m[1]).first();
    if (!ok) return json({ error: "Only open or finished charcoal orders have an ID check." }, 404);
    await db.batch([db.prepare(`UPDATE orders SET id_checked_by = ?, id_checked_at = ${on ? NOW : "NULL"} WHERE id = ?`).bind(on ? actor : null, m[1]), audit("order.id_check", m[1], null, { checked: on })]);
    return json({ ok: true, checked: on, by: on ? actor : null });
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/status$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), o = await db.prepare("SELECT status, method, pay_status FROM orders WHERE id = ?").bind(m[1]).first();
    if (!o) return json({ error: "No such order." }, 404);
    // a pay-at-counter pickup can be got ready before it is paid, but never handed over unpaid
    const next = { paid: o.method === "pickup" ? ["ready"] : ["packed"], packed: ["shipped"], ready: ["collected"], pending: o.pay_status === "pay_at_pickup" ? ["ready"] : [] }[o.status] || [];
    if (body.status === "collected" && o.pay_status === "pay_at_pickup") return json({ error: "Take the payment first, then mark it paid." }, 409);
    if (!next.includes(body.status)) return json({ error: "That step is not available for this order." }, 409);
    // only the request that actually moved the order writes the log line and the customer email (two taps, one email)
    const moved = await db.batch([db.prepare(`UPDATE orders SET status = ?, updated_at = ${NOW}${body.status === "ready" ? `, ready_at = ${NOW}` : ""} WHERE id = ? AND status = ?`).bind(body.status, m[1], o.status),
      db.prepare("INSERT INTO audit_log (actor, action, target, before, after) SELECT ?, 'order.status', ?, ?, ? WHERE changes() = 1").bind(actor, m[1], JSON.stringify({ status: o.status }), JSON.stringify({ status: body.status }))]);
    if (!moved[0].meta.changes) return json({ error: "Someone else just changed this order. Reload it." }, 409);
    if (body.status === "shipped" || body.status === "ready") {
      const [full, items] = await db.batch([db.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]), db.prepare("SELECT name, qty, unit_cents FROM order_items WHERE order_id = ?").bind(m[1])]);
      const site = env.SITE_NAME || "One Stop Shop", ord = full.results[0];
      await writeEmail(env, m[1], ord.email, (body.status === "shipped" ? orderShipped : pickupReady)(site, ord, items.results));
    }
    return json({ ok: true, status: body.status });
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/(refund|paid|counter-refund)$/)) && method === "POST") {   // src/pay.js
    if (m[2] !== "paid" && !session.owner) { log("forbidden", { actor, path }); return json({ error: m[2] === "refund" ? "Only the owner can refund to a card." : "Only the owner can record a refund." }, 403); }   // money back is the owner's call; staff take counter payments
    return adminPay(request, env, m[1], m[2], actor);
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/refunds$/)) && method === "GET") return json({ refunds: (await db.prepare("SELECT amount_cents, status, reason, actor, detail, at FROM refunds WHERE order_id = ? ORDER BY id").bind(m[1]).all()).results });
  if ((m = path.match(/^\/emails\/(\d{1,9})$/)) && method === "GET") {
    // only order and stock emails open here: a customer's sign-in code (and their account mail) is theirs, never the back office's
    const e = await db.prepare("SELECT id, kind, recipient, subject, html, status, detail, at FROM emails WHERE id = ? AND kind IN ('order_placed','order_shipped','pickup_ready','low_stock','new_order')").bind(+m[1]).first();
    return e ? json({ email: e }) : json({ error: "No such email." }, 404);
  }
  // ---- owner only: staff, settings, the monthly report ----
  if (path === "/staff" && method === "GET") {
    const r = await db.prepare(`SELECT st.id, st.name, st.created_at, st.created_by, (SELECT MAX(at) FROM login_attempts a WHERE a.staff_id = st.id AND a.ok = 1) AS last_in FROM staff st WHERE st.active = 1 ORDER BY lower(st.name)`).all();
    return json({ staff: r.results });
  }
  // Every PIN is hashed with the PIN_PEPPER secret (src/staff.js). A PIN set before the pepper exists would be hashed with the
  // fallback and stop working the moment the pepper is created, so on the live site no PIN is set until it exists.
  if (env.LIVE === "1" && !env.PIN_PEPPER && method === "POST" && (path === "/staff" || /^\/staff\/\d{1,9}\/pin$/.test(path))) return json({ error: "Create the PIN_PEPPER secret first (docs/BACKEND-NOTES.md), then add staff." }, 503);
  if (path === "/staff" && method === "POST") {
    const body = await request.json().catch(() => ({})), name = cleanName(body.name), bad = pinProblem(body.pin);
    if (!name) return json({ error: "Give a first name, letters only, up to 30.", field: "name" }, 400);
    if (bad) return json({ error: bad, field: "pin" }, 400);
    if (await db.prepare("SELECT 1 AS x FROM staff WHERE lower(name) = lower(?) AND active = 1").bind(name).first("x")) return json({ error: `There is already a ${name}. Add a last initial.`, field: "name" }, 409);
    const hash = await hashPin(env, body.pin);
    try {
      const r = await db.batch([db.prepare("INSERT INTO staff (name, pin_hash, created_by) VALUES (?, ?, ?)").bind(name, hash, actor), db.prepare("INSERT INTO audit_log (actor, action, target, after) VALUES (?, 'staff.add', 'staff #' || last_insert_rowid(), ?)").bind(actor, JSON.stringify({ name }))]);
      return json({ ok: true, id: r[0].meta.last_row_id, name }, 201);
    } catch (e) { if (/UNIQUE/i.test(String(e && e.message))) return json({ error: `There is already a ${name}. Add a last initial.`, field: "name" }, 409); throw e; }
  }
  if ((m = path.match(/^\/staff\/(\d{1,9})$/)) && method === "DELETE") {
    const st = await db.prepare("SELECT id, name FROM staff WHERE id = ? AND active = 1").bind(+m[1]).first();
    if (!st) return json({ error: "No such person." }, 404);
    // removed at once: the row stays (history names them), every sign-in they had ends now
    await db.batch([db.prepare(`UPDATE staff SET active = 0, removed_at = ${NOW} WHERE id = ?`).bind(st.id), db.prepare("DELETE FROM sessions WHERE staff_id = ?").bind(st.id),
      audit("staff.remove", `staff #${st.id}`, { name: st.name }, null)]);
    return json({ ok: true });
  }
  if ((m = path.match(/^\/staff\/(\d{1,9})\/pin$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), bad = pinProblem(body.pin);
    if (bad) return json({ error: bad, field: "pin" }, 400);
    const st = await db.prepare("SELECT id, name FROM staff WHERE id = ? AND active = 1").bind(+m[1]).first();
    if (!st) return json({ error: "No such person." }, 404);
    await db.batch([db.prepare("UPDATE staff SET pin_hash = ? WHERE id = ?").bind(await hashPin(env, body.pin), st.id), db.prepare("DELETE FROM sessions WHERE staff_id = ?").bind(st.id), audit("staff.pin", `staff #${st.id}`, null, { name: st.name })]);
    return json({ ok: true });
  }
  if (path === "/settings" && method === "GET") return json({ settings: Object.fromEntries((await db.prepare("SELECT key, value FROM settings").all()).results.map(r => [r.key, r.value])) });
  if (path === "/settings" && method === "PUT") {
    const body = await request.json().catch(() => ({}));
    if (!["subtotal", "total"].includes(body.studio_share_basis)) return json({ error: "Pick what the studio share is worked out on." }, 400);
    const was = await db.prepare("SELECT value FROM settings WHERE key = 'studio_share_basis'").first("value");
    await db.batch([db.prepare(`INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('studio_share_basis', ?1, ?2, ${NOW}) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_by = ?2, updated_at = ${NOW}`).bind(body.studio_share_basis, actor),
      audit("settings.studio_share_basis", "settings", { value: was }, { value: body.studio_share_basis })]);
    return json({ ok: true });
  }
  if (path === "/report" && method === "GET") {
    const mo = monthOf(url.searchParams.get("month")); if (!mo) return json({ error: "Month looks like 2026-11." }, 400);
    return json(await report(db, mo));
  }
  if (path === "/report.csv" && method === "GET") {
    const mo = monthOf(url.searchParams.get("month")); if (!mo) return json({ error: "Month looks like 2026-11." }, 400);
    return new Response(reportCsv(await report(db, mo, true)), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="one-stop-shop-sales-${mo}.csv"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  if (path === "/backup" && method === "GET") {
    const snap = await snapshot(db);
    return new Response(JSON.stringify(snap, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="one-stop-shop-backup-${snap.taken_at.slice(0, 10)}.json"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  return json({ error: "Not found" }, 404);
}

// Uploaded product photo, public (it is shown on the storefront).
export async function photo(env, sku) {
  const r = await env.DB.prepare("SELECT type, bytes FROM product_photos WHERE sku = ?").bind(sku).first();
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(r.bytes instanceof ArrayBuffer ? r.bytes : new Uint8Array(r.bytes), { headers: { "Content-Type": r.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
