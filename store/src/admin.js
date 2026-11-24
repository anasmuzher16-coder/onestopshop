import { orderShipped, pickupReady, writeEmail } from "./email.js";
import { snapshot } from "./backup.js";
import { CHARCOAL } from "./catalog.js";
// The shop's back office: sign-in, shop numbers, stock and orders. Every route here needs the admin cookie,
// and every write also needs a same-site JSON request, so another website cannot trigger one.
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
const COOKIE = "oss_admin";
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const sha = async s => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const cookieToken = request => ((request.headers.get("Cookie") || "").match(/(?:^|;\s*)oss_admin=([a-f0-9]{64})/) || [])[1];
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function signedIn(request, env) {
  // each sign-in is its own random token, kept only as a hash, and it expires by itself
  const t = cookieToken(request); if (!t) return false;
  return !!(await env.DB.prepare("SELECT 1 AS ok FROM sessions WHERE token_hash = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')").bind(await sha(t)).first("ok"));
}
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
  if (path === "/login" && method === "POST") {
    if (!env.ADMIN_KEY) return json({ error: "The admin passcode has not been set up yet." }, 503);
    const body = await request.json().catch(() => ({}));
    // five wrong tries from one place, or forty from anywhere, locks sign-in for fifteen minutes
    const who = await sha("who|" + (request.headers.get("CF-Connecting-IP") || "local"));
    const tries = await db.prepare("SELECT COALESCE(SUM(who = ?1 AND ok = 0),0) AS mine, COALESCE(SUM(ok = 0),0) AS everyone FROM login_attempts WHERE at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')").bind(who).first();
    if (tries.mine >= 5 || tries.everyone >= 40) return json({ error: "Too many wrong tries. Wait 15 minutes and try again." }, 429);
    const right = typeof body.passcode === "string" && same(await sha(body.passcode), await sha(env.ADMIN_KEY));
    await db.prepare("INSERT INTO login_attempts (who, ok) VALUES (?, ?)").bind(who, right ? 1 : 0).run();
    if (!right) return json({ error: "That passcode is not right." }, 401);
    const t = hex(crypto.getRandomValues(new Uint8Array(32)));
    await db.batch([
      db.prepare("INSERT INTO sessions (token_hash, expires_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ','now','+12 hours'))").bind(await sha(t)),
      db.prepare("DELETE FROM sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%SZ','now')"), db.prepare("DELETE FROM login_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"),
    ]);
    const secure = url.protocol === "https:" ? " Secure;" : "";
    return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=${t}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${60 * 60 * 12}` });
  }
  if (path === "/logout" && method === "POST") { const t = cookieToken(request); if (t) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(t)).run(); }
  if (path === "/logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
  if (!(await signedIn(request, env))) return json({ error: "Sign in first." }, 401);
  if (method !== "GET") {
    if (!(request.headers.get("Content-Type") || "").startsWith("application/json") && !path.endsWith("/photo")) return json({ error: "Send JSON." }, 415);
    if (request.headers.get("X-OSS-Admin") !== "1") return json({ error: "Missing request marker." }, 400);
    const origin = request.headers.get("Origin"); if (origin && origin !== url.origin) return json({ error: "Wrong origin." }, 403);
  }
  const actor = "owner";

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
      db.prepare("SELECT SUM(status = 'paid') AS to_pack, SUM(status = 'packed') AS to_ship, SUM(status = 'ready') AS waiting_pickup FROM orders"),
    ]);
    return json({ totals: tot.results[0], daily: daily.results, top: top.results, slow: slow.results, low: low.results, provinces: prov.results, shipping: ship.results[0], value: value.results[0], todo: todo.results[0] });
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
    // The form edits only the cologne fields. Everything else in details (the charcoal mark, photo status, brand,
    // source lines, a roll's box) is kept, so saving a charcoal item in the back office never erases its rules.
    let had = {}; try { had = JSON.parse(before.details || "{}"); } catch {}
    if ("details" in out) { const { ml, kind, notes, ...keep } = had; out.details = JSON.stringify({ ...keep, ...JSON.parse(out.details) }); }
    if ("colour" in out) {   // the shop's confirmed colour name; empty takes it back to the photo's guess ("Colours TBD")
      const base = "details" in out ? JSON.parse(out.details) : { ...had }; if (out.colour) base.colour = out.colour; else delete base.colour;
      out.details = JSON.stringify(base); delete out.colour;
    }
    if (had.charcoal) charcoalRules(out, had);   // charcoal stays charcoal; retired Heat pieces are never turned into it
    const cols = Object.keys(out); if (!cols.length) return json({ ok: true });
    const was = {}; for (const k of cols) was[k] = before[k];
    await db.batch([db.prepare(`UPDATE products SET ${cols.map(k => k + " = ?").join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?`).bind(...cols.map(k => out[k]), m[1]), audit("product.edit", m[1], was, out)]);
    return json({ ok: true });
  }
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/stock$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), delta = clampInt(body.delta, -9999, 9999);
    const reason = ["count", "received", "damaged", "correction", "return"].includes(body.reason) ? body.reason : "correction";
    if (!delta) return json({ error: "Nothing to change." }, 400);
    // one statement decides: the count can never go below zero, even if two people tap at once
    const res = await db.batch([
      db.prepare("UPDATE products SET stock = stock + ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?2 AND stock + ?1 >= 0").bind(delta, m[1]),
      db.prepare("INSERT INTO stock_moves (sku, delta, reason, actor) SELECT ?2, ?1, ?3, ?4 WHERE changes() = 1").bind(delta, m[1], reason, actor),
      db.prepare("SELECT stock FROM products WHERE sku = ?").bind(m[1]),
    ]);
    if (!res[2].results.length) return json({ error: "No such product." }, 404);
    if (!res[0].meta.changes) return json({ error: "Stock cannot go below zero.", stock: res[2].results[0].stock }, 409);
    return json({ ok: true, stock: res[2].results[0].stock });
  }
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/history$/)) && method === "GET") {
    const r = await db.prepare("SELECT delta, reason, actor, at FROM stock_moves WHERE sku = ? ORDER BY id DESC LIMIT 12").bind(m[1]).all();
    return json({ moves: r.results });
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
    const r = await db.prepare("SELECT o.id, o.status, o.method, o.name, o.total_cents, o.tax_province, o.ship_service, o.tracking, o.created_at, (SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id) AS units FROM orders o ORDER BY o.created_at DESC LIMIT 200").all();
    return json({ orders: r.results });
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})$/)) && method === "GET") {
    const [o, i] = await db.batch([db.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]), db.prepare("SELECT i.sku, i.name, i.qty, i.unit_cents, p.img, p.img_dark, p.photo_ver, p.box_id, p.category_id, p.details FROM order_items i LEFT JOIN products p ON p.sku = i.sku WHERE i.order_id = ?").bind(m[1])]);
    if (!o.results.length) return json({ error: "No such order." }, 404);
    const mail = await db.prepare("SELECT id, kind, recipient, subject, status, at FROM emails WHERE order_id = ? ORDER BY id").bind(m[1]).all();
    return json({ order: o.results[0], items: i.results, emails: mail.results });
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/status$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), o = await db.prepare("SELECT status, method FROM orders WHERE id = ?").bind(m[1]).first();
    if (!o) return json({ error: "No such order." }, 404);
    const next = { paid: o.method === "pickup" ? ["ready"] : ["packed"], packed: ["shipped"], ready: ["collected"] }[o.status] || [];
    if (!next.includes(body.status)) return json({ error: "That step is not available for this order." }, 409);
    await db.batch([db.prepare("UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ? AND status = ?").bind(body.status, m[1], o.status), audit("order.status", m[1], { status: o.status }, { status: body.status })]);
    if (body.status === "shipped" || body.status === "ready") {
      const [full, items] = await db.batch([db.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]), db.prepare("SELECT name, qty, unit_cents FROM order_items WHERE order_id = ?").bind(m[1])]);
      const site = env.SITE_NAME || "One Stop Shop", ord = full.results[0];
      await writeEmail(env, m[1], ord.email, (body.status === "shipped" ? orderShipped : pickupReady)(site, ord, items.results));
    }
    return json({ ok: true, status: body.status });
  }
  if ((m = path.match(/^\/emails\/(\d{1,9})$/)) && method === "GET") {
    const e = await db.prepare("SELECT id, kind, recipient, subject, html, status, detail, at FROM emails WHERE id = ?").bind(+m[1]).first();
    return e ? json({ email: e }) : json({ error: "No such email." }, 404);
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
