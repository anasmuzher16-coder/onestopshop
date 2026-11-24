// Customer accounts: sign in with an emailed 6-digit code or a one-tap link (no passwords), the account itself,
// favourites, back-in-stock alerts, the opt-in charcoal reminder, and the points view. Guest checkout never needs
// any of it. Design, rules and sources: store/docs/ACCOUNTS-LOYALTY.md.
import { writeEmail, frame, plain, esc } from "./email.js";
import { loyaltyView } from "./loyalty.js";
import { CHARCOAL } from "./catalog.js";

const COOKIE = "oss_c", SESSION_DAYS = 30, CODE_MINUTES = 10, MAX_TRIES = 5;
// rate limits: per email (any network), per network (any email), and the whole shop, so nobody can use the form to flood an inbox
const LIMIT = { perEmail15: 3, perWhoHour: 20, allHour: 300, wrongPerWho15: 30 };
const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
const SOLD = "('paid','packed','shipped','ready','collected')";
const SHOP_LINE = "One Stop Shop, 760 Wyandotte St E, Windsor, ON N9A 3J4. 519-255-2222.";
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const sha = async s => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const random = n => hex(crypto.getRandomValues(new Uint8Array(n)));
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function sixDigits() {   // uniform: values past the last whole million are thrown away rather than folded in
  const top = 4294000000; let n; do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= top); return String(n % 1000000).padStart(6, "0");
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
const who = request => sha("acct|" + (request.headers.get("CF-Connecting-IP") || "local"));
const cookieToken = request => ((request.headers.get("Cookie") || "").match(/(?:^|;\s*)oss_c=([a-f0-9]{64})(?:;|$)/) || [])[1];
const cookie = (url, token, maxAge) => `${COOKIE}=${token}; Path=/; HttpOnly;${url.protocol === "https:" ? " Secure;" : ""} SameSite=Lax; Max-Age=${maxAge}`;
export const cleanEmail = v => { if (typeof v !== "string") return null; const e = v.trim().toLowerCase(); return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null; };
const text = (v, max) => v === undefined || v === null ? "" : typeof v === "string" && v.trim().length <= max ? v.trim() : null;
const postal = v => { const m = String(v || "").trim().toUpperCase().match(/^([A-Z]\d[A-Z])[ -]?(\d[A-Z]\d)$/); return m ? m[1] + " " + m[2] : null; };
export const siteOrigin = env => (env.SITE_URL || "https://onestopshop-store.anas-dev.workers.dev").replace(/\/$/, "");

// The signed-in customer for this request, or null. Expired sessions never count.
export async function customerFrom(request, env) {
  const t = cookieToken(request); if (!t) return null;
  return await env.DB.prepare(`SELECT c.* FROM customer_sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ? AND s.expires_at > ${NOW}`).bind(await sha(t)).first();
}

// ---------- the emails ----------
function signInMail(site, code, link) {
  const big = `${code.slice(0, 3)} ${code.slice(3)}`;
  const heading = "Your sign-in code", intro = `<span style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:6px;margin:4px 0 12px">${big}</span><br>Type it on the sign-in page within ${CODE_MINUTES} minutes. Or <a href="${esc(link)}" style="color:#1b1713;font-weight:700">sign in with one tap</a> on this phone or computer.`;
  const foot = `If you did not ask for this, ignore it: nobody can sign in without the code. ${SHOP_LINE}`;
  return { kind: "sign_in", subject: `${big} is your ${site} sign-in code`, html: frame(site, heading, intro, [], foot), body: plain(heading, `${big}\n\nType it on the sign-in page within ${CODE_MINUTES} minutes, or open this link to sign in: ${link}`, [], foot) };
}
function backInStockMail(site, origin, p, token) {
  const url = `${origin}/p/${p.sku}`, stop = `${origin}/account?stop=${token}`;
  const heading = `${esc(p.name)} is back`, intro = `You asked us to tell you. It is on the counter again: <a href="${esc(url)}" style="color:#1b1713;font-weight:700">see it in the shop</a>.`;
  const foot = `You asked for this one email when it sold out. <a href="${esc(stop)}" style="color:#6b6357">Stop all emails like this</a>. ${SHOP_LINE}`;
  return { kind: "back_in_stock", subject: `${p.name} is back at ${site}`, html: frame(site, heading, intro, [], foot), body: plain(heading, `You asked us to tell you. It is on the counter again: ${url}`, [], `Stop all emails like this: ${stop}\n${SHOP_LINE}`) };
}
function reminderMail(site, origin, c, items) {
  const stop = `${origin}/account?stop=${c.unsub_token}`, acct = `${origin}/account`, weeks = Math.round(c.remind_days / 7);
  const heading = "Time to restock your charcoal?", rows = items.map(i => [esc(i.name), `${i.qty} last time`]);
  const intro = items.length ? `It has been about ${weeks} ${weeks === 1 ? "week" : "weeks"} since your last charcoal order. <a href="${esc(acct)}" style="color:#1b1713;font-weight:700">Buy it again</a> in one tap, for pickup or local delivery.`
    : `You asked for a charcoal reminder every ${weeks} ${weeks === 1 ? "week" : "weeks"}. <a href="${esc(origin + "/shop/" + CHARCOAL)}" style="color:#1b1713;font-weight:700">See the charcoal</a>, for pickup or local delivery.`;
  const foot = `You get this because you turned on charcoal reminders in your account. <a href="${esc(stop)}" style="color:#6b6357">Unsubscribe</a> or change how often in <a href="${esc(acct)}" style="color:#6b6357">your account</a>. ${SHOP_LINE}`;
  return { kind: "restock_reminder", subject: "Time to restock your charcoal?", html: frame(site, heading, intro, rows, foot), body: plain(heading, intro.replace(/<[^>]+>/g, ""), rows, `Unsubscribe: ${stop}\n${SHOP_LINE}`) };
}

// ---------- what the account page shows ----------
async function meData(db, c) {
  const [fav, al] = await db.batch([db.prepare("SELECT sku FROM favourites WHERE customer_id = ? ORDER BY at DESC").bind(c.id), db.prepare("SELECT sku FROM stock_alerts WHERE customer_id = ? ORDER BY at DESC").bind(c.id)]);
  let address = {}; try { address = JSON.parse(c.address || "{}"); } catch {}
  return { signed_in: true, customer: { email: c.email, name: c.name, phone: c.phone, address, since: c.created_at.slice(0, 10) },
    loyalty: await loyaltyView(db, c.id), favourites: fav.results.map(r => r.sku), alerts: al.results.map(r => r.sku),
    reminder: { days: c.remind_days ?? null, since: c.remind_days ? c.remind_consent_at : null } };
}
async function ordersOf(db, c) {
  const os = (await db.prepare("SELECT id, status, method, ship_service, subtotal_cents, reward_cents, total_cents, created_at FROM orders WHERE customer_id = ? AND status != 'pending' ORDER BY created_at DESC LIMIT 50").bind(c.id).all()).results;
  if (!os.length) return [];
  const ids = os.map(o => o.id), q = ids.map(() => "?").join(",");
  const [items, pts] = await db.batch([
    db.prepare(`SELECT i.order_id, i.sku, i.name, i.qty, i.unit_cents, p.category_id FROM order_items i LEFT JOIN products p ON p.sku = i.sku WHERE i.order_id IN (${q}) ORDER BY i.order_id, i.sku`).bind(...ids),
    db.prepare(`SELECT order_id, kind, points FROM loyalty_ledger WHERE customer_id = ? AND order_id IN (${q})`).bind(c.id, ...ids),
  ]);
  return os.map(o => ({ ...o, items: items.results.filter(i => i.order_id === o.id).map(({ order_id, ...i }) => i),
    points: pts.results.filter(p => p.order_id === o.id).reduce((a, p) => ({ ...a, [p.kind]: p.points }), {}) }));
}

// ---------- routes: /api/account/* ----------
export async function accountRoute(request, env, url) {
  const path = url.pathname.replace(/^\/api\/account/, ""), method = request.method, db = env.DB, site = env.SITE_NAME || "One Stop Shop";
  if (method !== "GET") {   // every change: JSON, from this site, with our marker (another site cannot send this)
    if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return json({ error: "Send JSON." }, 415);
    if (request.headers.get("X-OSS-Account") !== "1") return json({ error: "Missing request marker." }, 400);
    const origin = request.headers.get("Origin"); if (origin && origin !== url.origin) return json({ error: "Wrong origin." }, 403);
  }
  const body = method === "GET" ? {} : await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "That could not be read." }, 400);

  // Ask for a code. The answer is the same whether or not an account exists, so the form tells nobody who shops here.
  if (path === "/code" && method === "POST") {
    const email = cleanEmail(body.email); if (!email) return json({ error: "That email address does not look right.", field: "email" }, 400);
    const w = await who(request);
    const n = await db.prepare(`SELECT COALESCE(SUM(email = ?1 AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')),0) AS mail, COALESCE(SUM(who = ?2),0) AS mine, COUNT(*) AS everyone FROM sign_in_codes WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hour')`).bind(email, w).first();
    if (n.mail >= LIMIT.perEmail15 || n.mine >= LIMIT.perWhoHour || n.everyone >= LIMIT.allHour) return json({ error: "That is a lot of codes in a short time. Wait 15 minutes, then ask again." }, 429);
    const code = sixDigits(), link = random(32), salt = random(16);
    await db.batch([
      db.prepare("UPDATE sign_in_codes SET used = 1 WHERE email = ? AND used = 0").bind(email),   // only the newest code works
      db.prepare(`INSERT INTO sign_in_codes (email, salt, code_hash, link_hash, who, expires_at) VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now','+${CODE_MINUTES} minutes'))`).bind(email, salt, await sha(salt + ":" + code), await sha(link), w),
      db.prepare("DELETE FROM sign_in_codes WHERE created_at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"),
      db.prepare("DELETE FROM account_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"),
      db.prepare(`UPDATE emails SET subject = 'Sign-in code (expired)', html = '<p>This sign-in code has expired.</p>', body = 'This sign-in code has expired.' WHERE kind = 'sign_in' AND at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-${CODE_MINUTES + 5} minutes') AND body != 'This sign-in code has expired.'`),
    ]);
    await writeEmail(env, null, email, signInMail(site, code, `${url.origin}/account#signin=${link}`));
    return json({ ok: true, minutes: CODE_MINUTES });
  }

  // Use a code (with its email) or a link token. Either works once; a code dies after 5 wrong tries.
  if (path === "/verify" && method === "POST") {
    const w = await who(request);
    const wrong = await db.prepare("SELECT COUNT(*) AS n FROM account_attempts WHERE who = ? AND at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')").bind(w).first("n");
    if (wrong >= LIMIT.wrongPerWho15) return json({ error: "Too many wrong codes. Wait 15 minutes and try again." }, 429);
    const miss = async (msg, status = 400) => { await db.prepare("INSERT INTO account_attempts (who) VALUES (?)").bind(w).run(); return json({ error: msg }, status); };
    let row = null;
    if (typeof body.link === "string") {
      if (!/^[a-f0-9]{64}$/.test(body.link)) return miss("That sign-in link is not complete. Ask for a new code.");
      row = await db.prepare(`SELECT * FROM sign_in_codes WHERE link_hash = ? AND used = 0 AND expires_at > ${NOW}`).bind(await sha(body.link)).first();
      if (!row) return miss("That sign-in link has expired or was already used. Ask for a new code.");
    } else {
      const email = cleanEmail(body.email), code = String(body.code ?? "").replace(/\s+/g, "");
      if (!email || !/^\d{6}$/.test(code)) return json({ error: "Enter the 6 numbers from the email.", field: "code" }, 400);
      row = await db.prepare(`SELECT * FROM sign_in_codes WHERE email = ? AND used = 0 AND expires_at > ${NOW} ORDER BY id DESC LIMIT 1`).bind(email).first();
      if (!row) return miss("That code is not right, or it has expired. Ask for a new one.");
      // count the try before checking it, in one guarded step, so parallel guesses cannot slip past the limit
      const counted = await db.prepare(`UPDATE sign_in_codes SET tries = tries + 1 WHERE id = ? AND used = 0 AND tries < ${MAX_TRIES}`).bind(row.id).run();
      if (!counted.meta.changes) return miss("Too many wrong tries for this code. Ask for a new one.");
      if (!same(await sha(row.salt + ":" + code), row.code_hash)) {
        if (row.tries + 1 >= MAX_TRIES) await db.prepare("UPDATE sign_in_codes SET used = 1 WHERE id = ?").bind(row.id).run();
        return miss("That code is not right, or it has expired. Ask for a new one.");
      }
    }
    const spent = await db.prepare("UPDATE sign_in_codes SET used = 1 WHERE id = ? AND used = 0").bind(row.id).run();
    if (!spent.meta.changes) return miss("That code was already used. Ask for a new one.");
    // a new random session every time: a token from before sign-in is never promoted (no session fixation)
    const c = await db.prepare(`INSERT INTO customers (email, unsub_token, last_sign_in_at) VALUES (?, ?, ${NOW}) ON CONFLICT(email) DO UPDATE SET last_sign_in_at = excluded.last_sign_in_at RETURNING *`).bind(row.email, random(24)).first();
    const t = random(32), old = cookieToken(request);
    await db.batch([
      db.prepare(`INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now','+${SESSION_DAYS} days'))`).bind(await sha(t), c.id),
      ...(old ? [db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").bind(await sha(old))] : []),
      db.prepare(`DELETE FROM customer_sessions WHERE expires_at <= ${NOW}`),
      db.prepare("UPDATE sign_in_codes SET used = 1 WHERE email = ? AND used = 0").bind(row.email),
      db.prepare("UPDATE emails SET subject = 'Sign-in code (used)', html = '<p>This sign-in code has been used.</p>', body = 'This sign-in code has been used.' WHERE kind = 'sign_in' AND recipient = ?").bind(row.email),
      // orders placed as a guest with this email are theirs: they proved they own it
      db.prepare("UPDATE orders SET customer_id = ? WHERE customer_id IS NULL AND lower(email) = ?").bind(c.id, row.email),
    ]);
    return json({ ok: true, me: await meData(db, c) }, 200, { "Set-Cookie": cookie(url, t, SESSION_DAYS * 86400) });
  }

  // One unsubscribe link per customer, in every reminder and alert email. Works without signing in; does nothing else.
  if (path === "/unsubscribe" && method === "POST") {
    if (typeof body.token !== "string" || !/^[a-f0-9]{48}$/.test(body.token)) return json({ error: "That unsubscribe link is not complete." }, 400);
    const c = await db.prepare("SELECT id FROM customers WHERE unsub_token = ?").bind(body.token).first();
    if (c) await db.batch([db.prepare("UPDATE customers SET remind_days = NULL WHERE id = ?").bind(c.id), db.prepare("DELETE FROM stock_alerts WHERE customer_id = ?").bind(c.id)]);
    return json({ ok: true });   // the same answer either way
  }

  const c = await customerFrom(request, env);
  if (path === "/me" && method === "GET") return json(c ? await meData(db, c) : { signed_in: false, loyalty: { on: (await loyaltyView(db, null)).on } });
  if (!c) return json({ error: "Sign in first.", signed_in: false }, 401, cookieToken(request) ? { "Set-Cookie": cookie(url, "", 0) } : {});

  if (path === "/orders" && method === "GET") return json({ orders: await ordersOf(db, c) });

  if (path === "/details" && method === "PUT") {
    const name = text(body.name, 80), phone = text(body.phone, 30), a = body.address || {};
    if (name === null) return json({ error: "Keep the name under 80 letters.", field: "name" }, 400);
    if (phone === null || (phone && phone.replace(/\D/g, "").length < 10)) return json({ error: "Enter a 10-digit phone number, or leave it empty.", field: "phone" }, 400);
    const line1 = text(a.line1, 120), city = text(a.city, 60), pc = a.postal ? postal(a.postal) : "";
    if (line1 === null) return json({ error: "Keep the street address under 120 letters.", field: "line1" }, 400);
    if (city === null) return json({ error: "Keep the city under 60 letters.", field: "city" }, 400);
    if (pc === null) return json({ error: "That postal code does not look right. It looks like N9A 1A1.", field: "postal" }, 400);
    const address = line1 || city || pc ? { line1, city, postal: pc } : {};
    await db.prepare("UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?").bind(name, phone, JSON.stringify(address), c.id).run();
    return json({ ok: true, me: await meData(db, { ...c, name, phone, address: JSON.stringify(address) }) });
  }

  if ((path === "/favourites" || path === "/alerts") && method === "POST") {
    const fav = path === "/favourites", sku = typeof body.sku === "string" && /^OSS-\d{4,6}$/.test(body.sku) ? body.sku : null;
    if (!sku || typeof body.on !== "boolean") return json({ error: "That could not be read." }, 400);
    const table = fav ? "favourites" : "stock_alerts";
    if (body.on) {
      const p = await db.prepare("SELECT stock FROM products WHERE sku = ? AND active = 1").bind(sku).first();
      if (!p) return json({ error: "That item is not in the shop any more." }, 404);
      if (!fav && p.stock > 0) return json({ error: "It is in stock now.", in_stock: true }, 409);
      const n = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE customer_id = ?`).bind(c.id).first("n");
      if (n >= (fav ? 200 : 50)) return json({ error: fav ? "You have saved 200 items. Remove some first." : "You are waiting on 50 items. Remove some first." }, 409);
      await db.prepare(`INSERT OR IGNORE INTO ${table} (customer_id, sku) VALUES (?, ?)`).bind(c.id, sku).run();
    } else await db.prepare(`DELETE FROM ${table} WHERE customer_id = ? AND sku = ?`).bind(c.id, sku).run();
    return json({ ok: true, on: body.on });
  }

  // The charcoal reminder: off until the customer turns it on and agrees to the exact words, which are kept with the time (CASL).
  if (path === "/reminder" && method === "PUT") {
    if (body.days === null) { await db.prepare("UPDATE customers SET remind_days = NULL WHERE id = ?").bind(c.id).run(); return json({ ok: true, reminder: { days: null } }); }
    if (![14, 21, 30, 45, 60].includes(body.days)) return json({ error: "Choose how often." }, 400);
    if (body.consent !== true) return json({ error: "Tick the box to say yes to these emails.", field: "consent" }, 400);
    const words = `Yes, email me a reminder to restock charcoal every ${body.days} days. I can unsubscribe at any time.`;
    await db.prepare(`UPDATE customers SET remind_days = ?, remind_consent_at = ${NOW}, remind_consent_text = ? WHERE id = ?`).bind(body.days, words, c.id).run();
    return json({ ok: true, reminder: { days: body.days } });
  }

  if (path === "/sign-out" && method === "POST") {
    const t = cookieToken(request);
    if (body.everywhere === true) await db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(c.id).run();
    else await db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").bind(await sha(t)).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie(url, "", 0) });
  }

  // Delete the account: sign-ins, saved details, favourites, alerts, reminder and points go. Orders stay as plain
  // guest orders, because tax law says we keep sales records for six years.
  if (path === "/delete" && method === "POST") {
    if (body.confirm !== "delete") return json({ error: "Confirm first." }, 400);
    await db.batch([
      db.prepare("UPDATE orders SET customer_id = NULL WHERE customer_id = ?").bind(c.id),
      db.prepare("DELETE FROM loyalty_ledger WHERE customer_id = ?").bind(c.id),
      db.prepare("DELETE FROM favourites WHERE customer_id = ?").bind(c.id),
      db.prepare("DELETE FROM stock_alerts WHERE customer_id = ?").bind(c.id),
      db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(c.id),
      db.prepare("DELETE FROM sign_in_codes WHERE email = ?").bind(c.email),
      db.prepare("DELETE FROM emails WHERE kind = 'sign_in' AND recipient = ?").bind(c.email),
      db.prepare("DELETE FROM customers WHERE id = ?").bind(c.id),
    ]);
    return json({ ok: true }, 200, { "Set-Cookie": cookie(url, "", 0) });
  }
  return json({ error: "Not found" }, 404);
}

// ---------- jobs: back-in-stock alerts and charcoal reminders ----------
// Alerts go out after any back-office change and every night. Each alert row is removed before its email is
// written, so two runs at once can never send the same one twice.
export async function stockAlerts(env, origin = siteOrigin(env)) {
  const db = env.DB, site = env.SITE_NAME || "One Stop Shop";
  try {
    const due = (await db.prepare("SELECT a.customer_id, a.sku, c.email, c.unsub_token, p.name FROM stock_alerts a JOIN customers c ON c.id = a.customer_id JOIN products p ON p.sku = a.sku WHERE p.stock > 0 AND p.active = 1 LIMIT 100").all()).results;
    for (const d of due) {
      const took = await db.prepare("DELETE FROM stock_alerts WHERE customer_id = ? AND sku = ?").bind(d.customer_id, d.sku).run();
      if (took.meta.changes) await writeEmail(env, null, d.email, backInStockMail(site, origin, d, d.unsub_token));
    }
    return due.length;
  } catch (e) { console.error(JSON.stringify({ at: "stock-alerts", message: String(e && e.message || e) })); return 0; }
}
// Daily: a reminder to each customer who asked for one, counted from their last charcoal order (or from when they
// asked, or the last reminder, whichever is latest). A guarded update claims each send, so it goes once.
export async function restockReminders(env, origin = siteOrigin(env)) {
  const db = env.DB, site = env.SITE_NAME || "One Stop Shop"; let sent = 0;
  try {
    const list = (await db.prepare(`SELECT c.*, (SELECT MAX(o.created_at) FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.sku = i.sku WHERE o.customer_id = c.id AND o.status IN ${SOLD} AND p.category_id = ?) AS last_coal FROM customers c WHERE c.remind_days IS NOT NULL LIMIT 500`).bind(CHARCOAL).all()).results;
    const now = Date.now();
    for (const c of list) {
      const from = Math.max(...[c.last_coal, c.remind_last_at, c.remind_consent_at].filter(Boolean).map(t => Date.parse(t)));
      if (!Number.isFinite(from) || now - from < c.remind_days * 86400000) continue;
      const claim = await db.prepare(`UPDATE customers SET remind_last_at = ${NOW} WHERE id = ? AND remind_days IS NOT NULL AND COALESCE(remind_last_at, '') = ?`).bind(c.id, c.remind_last_at || "").run();
      if (!claim.meta.changes) continue;
      const items = c.last_coal ? (await db.prepare("SELECT i.name, i.qty FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.sku = i.sku WHERE o.customer_id = ? AND o.created_at = ? AND p.category_id = ? ORDER BY i.name").bind(c.id, c.last_coal, CHARCOAL).all()).results : [];
      await writeEmail(env, null, c.email, reminderMail(site, origin, c, items)); sent++;
    }
  } catch (e) { console.error(JSON.stringify({ at: "restock-reminders", message: String(e && e.message || e) })); }
  return sent;
}
