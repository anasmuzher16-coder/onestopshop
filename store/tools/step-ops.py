# One-off edit (kept as history): sign-in sessions with a lockout, order emails, backups, privacy and terms
# pages, and a fix to how "the last N minutes/days" is compared. Run from store/: python tools/step-ops.py
import glob
def edit(path, pairs, append=''):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s + append)

# 0. Times are stored as 2026-11-14T23:10:00Z. SQLite's datetime() writes "2026-11-14 23:10:00", and comparing the
#    two as text is wrong inside the same day, so every "since" comparison now uses the stored format.
for f in ['src/admin.js', 'src/checkout.js']:
    s = open(f, encoding='utf8').read(); n = s.count("datetime('now','")
    s = s.replace("datetime('now','", "strftime('%Y-%m-%dT%H:%M:%SZ','now','")
    open(f, 'w', encoding='utf8', newline='\n').write(s); print(f, 'time comparisons fixed:', n)

NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')"
edit('src/admin.js', [
    ('// The shop\'s back office: sign-in, shop numbers, stock and orders. Every route here needs the admin cookie,',
     'import { orderShipped, pickupReady, writeEmail } from "./email.js";\nimport { snapshot } from "./backup.js";\n// The shop\'s back office: sign-in, shop numbers, stock and orders. Every route here needs the admin cookie,'),
    ('''async function token(env) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("oss-admin-v1|" + env.ADMIN_KEY))); }''',
     '''const sha = async s => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const cookieToken = request => ((request.headers.get("Cookie") || "").match(/(?:^|;\\s*)oss_admin=([a-f0-9]{64})/) || [])[1];'''),
    ('''  if (!env.ADMIN_KEY) return false;
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\\s*)oss_admin=([a-f0-9]{64})/);
  return !!m && same(m[1], await token(env));''',
     '''  // each sign-in is its own random token, kept only as a hash, and it expires by itself
  const t = cookieToken(request); if (!t) return false;
  return !!(await env.DB.prepare("SELECT 1 AS ok FROM sessions WHERE token_hash = ? AND expires_at > ''' + NOW + '''").bind(await sha(t)).first("ok"));'''),
    ('''    const body = await request.json().catch(() => ({}));
    if (typeof body.passcode !== "string" || !same(hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.passcode))), hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.ADMIN_KEY)))))
      return json({ error: "That passcode is not right." }, 401);
    const secure = url.protocol === "https:" ? " Secure;" : "";
    return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=${await token(env)}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${60 * 60 * 12}` });''',
     '''    const body = await request.json().catch(() => ({}));
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
      db.prepare("DELETE FROM sessions WHERE expires_at <= ''' + NOW + '''"), db.prepare("DELETE FROM login_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"),
    ]);
    const secure = url.protocol === "https:" ? " Secure;" : "";
    return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=${t}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${60 * 60 * 12}` });'''),
    ('''  if (path === "/logout" && method === "POST") return json({ ok: true }, 200, {''',
     '''  if (path === "/logout" && method === "POST") { const t = cookieToken(request); if (t) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(t)).run(); }
  if (path === "/logout" && method === "POST") return json({ ok: true }, 200, {'''),
    ('''    if (!o.results.length) return json({ error: "No such order." }, 404);
    return json({ order: o.results[0], items: i.results });''',
     '''    if (!o.results.length) return json({ error: "No such order." }, 404);
    const mail = await db.prepare("SELECT id, kind, recipient, subject, status, at FROM emails WHERE order_id = ? ORDER BY id").bind(m[1]).all();
    return json({ order: o.results[0], items: i.results, emails: mail.results });'''),
    ('''audit("order.status", m[1], { status: o.status }, { status: body.status })]);
    return json({ ok: true, status: body.status });''',
     '''audit("order.status", m[1], { status: o.status }, { status: body.status })]);
    if (body.status === "shipped" || body.status === "ready") {
      const [full, items] = await db.batch([db.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]), db.prepare("SELECT name, qty, unit_cents FROM order_items WHERE order_id = ?").bind(m[1])]);
      const site = env.SITE_NAME || "One Stop Shop", ord = full.results[0];
      await writeEmail(env, m[1], ord.email, (body.status === "shipped" ? orderShipped : pickupReady)(site, ord, items.results));
    }
    return json({ ok: true, status: body.status });'''),
    ('''  return json({ error: "Not found" }, 404);
}

// Uploaded product photo''',
     '''  if ((m = path.match(/^\\/emails\\/(\\d{1,9})$/)) && method === "GET") {
    const e = await db.prepare("SELECT id, kind, recipient, subject, html, status, detail, at FROM emails WHERE id = ?").bind(+m[1]).first();
    return e ? json({ email: e }) : json({ error: "No such email." }, 404);
  }
  if (path === "/backup" && method === "GET") {
    const snap = await snapshot(db);
    return new Response(JSON.stringify(snap, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="one-stop-shop-backup-${snap.taken_at.slice(0, 10)}.json"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  return json({ error: "Not found" }, 404);
}

// Uploaded product photo'''),
])

edit('src/checkout.js', [
    ('import { loadCatalog, toStorefront } from "./catalog.js";', 'import { loadCatalog, toStorefront } from "./catalog.js";\nimport { orderPlaced, lowStock, writeEmail } from "./email.js";'),
    ('''  return json({ ok: true, order: { id, method, name, email, service, province,''',
     '''  // the receipt to the shopper, and a note to the shop if this order took anything down to its warning level
  const site = env.SITE_NAME || "One Stop Shop", sold = lines.map(l => ({ name: l.product.name, qty: l.qty, unit_cents: cents(l.product.price) }));
  await writeEmail(env, id, email, orderPlaced(site, { id, name, method, ship_service: service, subtotal_cents: subtotal, shipping_cents: shipping, tax_cents: tax, total_cents: total, tax_province: province }, sold));
  const low = await db.prepare(`SELECT name, stock FROM products WHERE active = 1 AND stock <= low_stock_at AND sku IN (${lines.map(() => "?").join(",")}) ORDER BY stock, name`).bind(...lines.map(l => l.product.sku)).all();
  if (low.results.length) await writeEmail(env, id, env.OWNER_EMAIL || "the shop", lowStock(site, low.results));
  return json({ ok: true, order: { id, method, name, email, service, province,'''),
])

edit('src/worker.js', [
    ('import { placeOrder } from "./checkout.js";', 'import { placeOrder } from "./checkout.js";\nimport { nightly } from "./backup.js";'),
    ('const fixed = { checkout: "Checkout", cart: "Cart",', 'const fixed = { privacy: "Privacy", terms: "Terms of sale", checkout: "Checkout", cart: "Cart",'),
    ('index: a === "shipping" || a === "set" };', 'index: ["shipping", "set", "privacy", "terms"].includes(a) };'),
    ('export default {\n  async fetch(request, env) {', 'export default {\n  // every night: a full copy of the shop\'s records into the backup bucket\n  async scheduled(event, env, ctx) { ctx.waitUntil(nightly(env)); },\n  async fetch(request, env) {'),
])
edit('wrangler.jsonc', [
    ('  "vars": { "LIVE": "0", "SITE_NAME": "One Stop Shop" }',
     '  // Nightly backup at 3 am Windsor time. It saves to the BACKUPS bucket once that is connected:\n'
     '  //   npx wrangler r2 bucket create onestopshop-backups   then un-comment the next line.\n'
     '  // "r2_buckets": [{ "binding": "BACKUPS", "bucket_name": "onestopshop-backups" }],\n'
     '  "triggers": { "crons": ["0 8 * * *"] },\n'
     '  // Order emails send once RESEND_API_KEY (a secret) and EMAIL_FROM are set. Until then they are written and held.\n'
     '  "vars": { "LIVE": "0", "SITE_NAME": "One Stop Shop" }'),
])
print('ops wired')
