// Limits that keep one visitor from spoiling the shop for everyone else (breaker review, 2026-11-26).
//  - Who is asking: Cloudflare's CF-Connecting-IP (set by Cloudflare at the edge; a visitor cannot choose it there). An
//    IPv6 visitor holds a whole block (a /64 at least, a /56 from most home providers, a /48 from a free tunnel), so IPv6
//    counts as one visitor per /56, and a shop-wide lock counts how many different places tried by /48.
//    Only a keyed hash of that is ever stored, never the address.
//  - Placing an order: per person (email plus phone, or email plus network) the main cap on open orders; per network looser
//    anti-spam caps (orderLimits below); per order, caps on lines and units that a real counter order never reaches (lower for an unpaid pickup).
//    An unpaid pickup holds no stock until the shop confirms it (2026-11-27), so these limits now guard staff time and
//    inboxes, not the shelf. The shop-wide brake in checkout.js is set for a
//    real flood (SHOP_BRAKE_PER_MIN), far above what one person's few networks can place, and never stops a signed-in shopper.
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");

// The address as one visitor: IPv4 as it is, IPv6 by its first `bits` bits (56 by default; 48 when counting different
// places for a shop-wide lock), an IPv4 address written as IPv6 (::ffff:1.2.3.4) as the IPv4 address. Local runs (no
// Cloudflare in front) have no header and all count as one visitor, "local".
export function sourceBlock(raw, bits = 56) {
  let a = String(raw || "").trim().toLowerCase().split("%")[0];
  if (!a) return "local";
  if (!a.includes(":")) return a;
  const v4 = a.match(/(\d{1,3}(?:\.\d{1,3}){3})$/); if (v4 && /^(::ffff:|::)/.test(a)) return v4[1];
  const [head, tail] = a.split("::"), h = head ? head.split(":") : [], t = a.includes("::") && tail ? tail.split(":") : [];
  const groups = a.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  const n = groups.slice(0, Math.ceil(bits / 16)).map(g => parseInt(g, 16) || 0), rest = bits % 16;
  if (rest) n[n.length - 1] &= (0xffff << (16 - rest)) & 0xffff;
  return n.map(g => g.toString(16)).join(":") + "::/" + bits;
}
export const sourceOf = (request, bits = 56) => sourceBlock(request.headers.get("CF-Connecting-IP"), bits);
// The one keyed hash for anything that would otherwise store who someone is (an address, an email): SHA-256 over the label, a Worker
// secret (PIN_PEPPER, falling back to ADMIN_KEY) and the value, so a copy of the tables alone cannot be turned back by trying every
// IPv4 address or a list of emails. Used for orders, customer sign-in codes, staff sign-in and the questionnaire (2026-11-27).
export const keyedHash = (env, label, value) => sha(`${label}|${env.PIN_PEPPER || env.ADMIN_KEY || ""}|${value}`);
// The key in an order's status link (/order/<id>?k=..., 2026-11-27): 128 bits of a keyed hash of the order id, so only the person
// the link was shown to can open it, and nothing is stored. Changing PIN_PEPPER (or ADMIN_KEY without one) ends old links.
export const statusToken = async (env, id) => (await keyedHash(env, "status", String(id))).slice(0, 32);

// ---------- the name on an order ----------
// It goes into "Thank you, {name}" in mail sent from the shop to whatever address was typed, so it must never be able to
// carry a link: letters (any language), spaces, apostrophes, hyphens and periods only, starting with a letter, and no
// period run straight into two or more letters (evil.example, www.x), which mail apps turn into links. "J.R. Smith",
// "Dr. Who", "O'Brien" and "Anne-Marie" pass; digits, "://", "@" and slashes cannot get in at all.
export const nameOk = s => typeof s === "string" && s.length <= 80 && /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u.test(s) && !/\.[\p{L}\p{M}]{2,}/u.test(s);

// ---------- placing an order ----------
// Owner-vetoable numbers, in one place. A counter order of 40 units over 20 different items is far past anything the shop
// has seen; a bigger order is a phone call.
export const ORDER_CAPS = { lines: 20, perLine: 20, units: 40 };   // perLine matches the cart's own most (MAX_QTY, public/rates-core.js)
// An unpaid pay-at-the-counter order holds stock nobody has paid for, so it is held to what a real counter order needs (breaker,
// 2026-11-27): the shop sells charcoal by the box, foil by the pack, shisha by the tub and hookahs one at a time, and 5 of one
// item or 15 in all is past any counter order seen. A paid (card) order keeps ORDER_CAPS. The cart stops at 5 of an item while
// card payment is off (public/app.js), so a shopper meets this number in the cart, not at the last step.
export const PICKUP_CAPS = { lines: 15, perLine: 5, units: 15 };
// A pay-at-the-counter pickup RESERVES NOTHING when it is placed (2026-11-27, owner-vetoable, DECISIONS.md): it is a request the
// shop confirms. Stock is taken only when staff mark it ready (src/admin.js takeForReady), checked there in one transaction, so
// no number of requests can make an item unorderable for anyone else. The old "at most half an item" ceiling is gone.
// Whether an order has really taken stock: its own 'sale' moves less its put-backs, per item. One fragment, used wherever
// a put-back must give back exactly what was taken (cancel, expiry), never what the order merely asked for.
export const TAKEN_SQL = (ref) => `(SELECT sku, -SUM(delta) AS qty FROM stock_moves WHERE ref = ${ref} AND reason IN ('sale','released') GROUP BY sku HAVING -SUM(delta) > 0)`;
// The shop-wide brake: a real flood only. Per-network caps (below) bound one network to 5 orders in 10 minutes (10 for an IPv6
// /48), so reaching 60 orders in one minute takes 12 or more separate networks at once. A shopper
// signed in with the order's own email has proven the inbox is theirs and is never braked. (breaker, 2026-11-27: at 12 a minute,
// one person with home IPv4, a tunnel /48 and a phone could make the shop "busy" for everyone.)
export const SHOP_BRAKE_PER_MIN = 60;
// The email as one person, for limits only (the order keeps the address exactly as typed): lowercase (ASCII, as SQLite's lower()),
// any +tag dropped, and for Gmail the dots too, with googlemail.com read as gmail.com. normEmailSql is the same rule over a
// column, so the database compares like with like. The address was already checked to hold exactly one "@".
export function normEmail(e) {
  const s = String(e || "").trim().replace(/[A-Z]/g, c => c.toLowerCase()), at = s.indexOf("@"); if (at < 1) return s;
  let local = s.slice(0, at), dom = s.slice(at + 1); const plus = local.indexOf("+"); if (plus >= 0) local = local.slice(0, plus);
  if (dom === "googlemail.com") dom = "gmail.com"; if (dom === "gmail.com") local = local.replace(/\./g, "");
  return local + "@" + dom;
}
export function normEmailSql(col) {
  const le = `lower(trim(${col}))`, local = `substr(${le},1,instr(${le},'@')-1)`, dom0 = `substr(${le},instr(${le},'@')+1)`;
  const dom = `(CASE WHEN ${dom0} = 'googlemail.com' THEN 'gmail.com' ELSE ${dom0} END)`;
  const tagless = `(CASE WHEN instr(${local},'+') > 0 THEN substr(${local},1,instr(${local},'+')-1) ELSE ${local} END)`;
  return `((CASE WHEN ${dom} = 'gmail.com' THEN replace(${tagless},'.','') ELSE ${tagless} END) || '@' || ${dom})`;
}
// A counter order the shop has marked ready is held as long as the ready email promises (14 days, email.js pickupReady).
export const READY_HOLD_DAYS = 14;
// A phone number: digits with the usual separators, and an extension. Never letters, so never a link.
export const phoneOk = s => typeof s === "string" && s.length <= 30 && /^\+?[\d\s().\-]{7,24}(?:\s*(?:x|ext\.?)\s*\d{1,6})?$/i.test(s) && s.replace(/\D/g, "").length >= 7 && !/^\d{1,3}(?:\.\d{1,3}){3}/.test(s.trim());
// A phone as one person, for limits only: the digits without an extension, a leading North American 1 dropped.
export const phoneKey = p => { const d = String(p || "").replace(/\s*(?:x|ext\.?)\s*\d{1,6}\s*$/i, "").replace(/\D/g, ""); return d.length === 11 && d[0] === "1" ? d.slice(1) : d; };
// The order limits (reworked 2026-11-27, branch fleet/guard4, owner-vetoable; BACKEND-NOTES.md says what a shopper sees):
//  - PERSON: the main limit. One person is one email (normEmail) AND, when both orders carry a phone, the same phone; otherwise the
//    same network (the IPv4 address or IPv6 /56 it was placed from). So a stranger who types your email cannot use your slots
//    unless they also have your phone or your connection. Open = a pickup request waiting for the shop, or one the shop got ready
//    and that is not paid yet (both count here, and only here).
//  - NET (one IPv4 address or IPv6 /56) and GROUP (one IPv6 /48): anti-spam only. Carrier NAT, mobile IPv6 pools, iCloud Private
//    Relay and public Wi-Fi put strangers on one address, so these are set well above what one shared address sees in a day.
//    Open here counts only orders still waiting to be confirmed or paid by card (a ready order is the person's, not the network's).
//  - EMAIL_DAY_CAP: with mail connected, one inbox's receipts a day from guests (an inbox flood); signing in with it skips it.
//    With mail off nothing is sent, so there is nothing to protect and it does not apply (and sign-in codes cannot arrive).
export const PERSON_LIMITS = { per10min: 5, perDay: 15, open: 3 };
export const NET_LIMITS = { per10min: 5, perDay: 15, open: 20 };
export const EMAIL_DAY_CAP = 30;
// How long a pickup request waits for the shop to confirm it (owner-vetoable, inventory-2026-11-23/DECISIONS.md beside the repo):
// PICKUP_REQUEST_HOURS, 1 to 720, default 72 (3 days; an open request also fills one of its person's 3 open slots, so not longer). Past it, a request never confirmed cancels itself; it held nothing, so no
// stock moves. Once the shop marks it ready it is held READY_HOLD_DAYS from then, as the ready email says.
export const pickupRequestHours = env => { const n = Number(env.PICKUP_REQUEST_HOURS); return Number.isInteger(n) && n >= 1 && n <= 720 ? n : 72; };
// The visitor's key for the order_attempts table: a hash keyed with a Worker secret, so the table alone cannot be turned back into addresses.
// bits 48: the wider IPv6 block (one tunnel or one site), for a second, looser count, so one /48 cannot act as 256 visitors.
export const orderWho = async (env, request, bits = 56) => (bits === 56 ? "o:" : "g:") + await sha(`order|${env.PIN_PEPPER || env.ADMIN_KEY || ""}|${sourceOf(request, bits)}`);
// A whole /48 at most 10 orders in 10 minutes, 30 a day and 40 waiting at once: below the shop-wide brake, and room for a campus or a carrier pool.
export const GROUP_LIMITS = { per10min: 10, perDay: 30, open: 40 };

// Open for a person: a counter order not paid yet (a request waiting for the shop, or one the shop got ready). Card pages are left
// out: they let their stock go by themselves within 35 minutes.
const OPEN_PERSON = "o.release_op IS NULL AND o.pay_status = 'pay_at_pickup' AND o.status IN ('pending','ready')";
// Open for a network: only what is still waiting on the shop or on a card page. A ready-but-unpaid order counts for its person only.
const OPEN_NET = "o.release_op IS NULL AND o.status = 'pending' AND o.pay_status IN ('pay_at_pickup','awaiting')";
const RECENT = "strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')", M10 = "strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 minutes')";
// Is an earlier order (row) the same person as the one being placed? Same email (the query asks that), and the same phone when
// both carry one; otherwise the same network (row.same_net: it was placed from this IPv4 address or IPv6 /56).
const samePerson = (row, phone) => phone && row.phone ? phoneKey(row.phone) === phoneKey(phone) : !!row.same_net;
// One read: what this person, this network and its /48 placed lately and still have open. Answers { ok: true } or { ok: false,
// words, why } with the words to show. `missing` is true on a database without migration 0012: the network counts are skipped (and
// logged), and every order with this email counts as this person. `own`: signed in with this very email (the inbox is theirs):
// the email's day cap and the shop-wide brake do not apply to them. `mailOn`: the shop's mail is connected (email.js mailReady).
export async function orderLimits(env, { who, group = who, email, phone = null, placed = 0, own = false, mailOn = false }) {   // placed: 1 when the order being checked is already written
  const db = env.DB, P = PERSON_LIMITS, N = NET_LIMITS, G = GROUP_LIMITS, k = placed;
  const rowsSql = net => `SELECT o.phone, o.created_at >= ${M10} AS m10, o.created_at >= ${RECENT} AS day, (${OPEN_PERSON}) AS open, ${net ? "EXISTS (SELECT 1 FROM order_attempts a WHERE a.order_id = o.id AND a.who = ?2)" : "1"} AS same_net
    FROM orders o WHERE (o.created_at >= ${RECENT} OR o.status IN ('pending','ready')) AND ${normEmailSql("o.email")} = ?1 ORDER BY o.created_at DESC LIMIT 500`;
  const byWho = db.prepare(`SELECT COALESCE(SUM(a.at >= ${M10}),0) AS m10, COALESCE(SUM(a.at >= ${RECENT}),0) AS day,
    COALESCE(SUM(EXISTS (SELECT 1 FROM orders o WHERE o.id = a.order_id AND ${OPEN_NET})),0) AS open FROM order_attempts a WHERE a.who = ?1`);
  const zero = { m10: 0, day: 0, open: 0 };
  let rows, w = zero, g = zero, missing = false;
  try { let r; [r, w, g] = await db.batch([db.prepare(rowsSql(true)).bind(normEmail(email), who), byWho.bind(who), byWho.bind(group)]); rows = r.results; w = w.results[0]; g = group === who ? zero : g.results[0]; }
  catch (err) {
    if (!/no such table/i.test(String(err && err.message))) throw err;
    missing = true; console.error(JSON.stringify({ at: "order-guard", problem: "migration 0012_order_guard.sql is not applied: per-network order limits are off" }));
    rows = (await db.prepare(rowsSql(false)).bind(normEmail(email)).all()).results;
  }
  const mine = rows.filter(r => samePerson(r, phone)), sum = (list, key) => list.reduce((a, r) => a + (r[key] ? 1 : 0), 0);
  const p = { open: sum(mine, "open"), m10: sum(mine, "m10"), day: sum(mine, "day") }, emailDay = sum(rows, "day");
  if (p.open >= P.open + k) return { ok: false, missing, words: `You already have ${p.open - k} pickup ${p.open - k === 1 ? "request" : "requests"} waiting. Pick ${p.open - k === 1 ? "it" : "those"} up first, or call the counter at 519-255-2222 to add to ${p.open - k === 1 ? "it" : "them"}.`, why: "open" };
  if (w.open >= N.open + k || g.open >= G.open + k) return { ok: false, missing, words: "A lot of orders are already waiting from this internet connection (it may be shared, like a phone carrier or public Wi-Fi). Try again later, or call the counter at 519-255-2222 to order.", why: "network" };
  if (w.m10 >= N.per10min + k || w.day >= N.perDay + k || g.m10 >= G.per10min + k || g.day >= G.perDay + k || p.m10 >= P.per10min + k || p.day >= P.perDay + k) return { ok: false, missing, words: "That is a lot of orders in a short time. Wait a few minutes and try again, or call the counter at 519-255-2222.", why: "rate" };
  if (mailOn && !own && emailDay >= EMAIL_DAY_CAP + k) return { ok: false, missing, words: "This email has had a lot of orders today. If it is yours, sign in with it to order, or call the counter at 519-255-2222.", why: "email" };
  return { ok: true, missing };
}
// The row that counts this order for its visitor, written in the same batch as the order itself.
export const orderAttempt = (db, who, id) => db.prepare("INSERT INTO order_attempts (who, order_id) VALUES (?, ?)").bind(who, id);

// The scheduled sweep: failed sign-in tries older than a day (a good sign-in's row stays: the staff list reads "last
// signed in" from it), and order rows older than the longest hold (14 days ready plus the first hold) are deleted.
export async function pruneGuards(env) {
  const db = env.DB;
  await db.prepare("DELETE FROM login_attempts WHERE ok = 0 AND at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')").run();
  // known-device records past the 400 days they count for (src/admin.js oss_dev)
  await db.prepare("DELETE FROM login_attempts WHERE ok = 1 AND who LIKE 'd:%' AND at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')").run();
  // a customer's sign-in code counts (hashes of the address and of the email) go after a day, as the privacy page says, even in a quiet week
  await db.prepare("DELETE FROM account_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')").run().catch(err => { if (!/no such table/i.test(String(err && err.message))) throw err; });
  await db.prepare("DELETE FROM sign_in_codes WHERE created_at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')").run().catch(err => { if (!/no such table/i.test(String(err && err.message))) throw err; });
  await db.prepare("DELETE FROM order_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')").run().catch(err => { if (!/no such table/i.test(String(err && err.message))) throw err; });
}
