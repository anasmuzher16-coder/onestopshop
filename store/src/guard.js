// Limits that keep one visitor from spoiling the shop for everyone else (breaker review, 2026-11-26).
//  - Who is asking: Cloudflare's CF-Connecting-IP (set by Cloudflare at the edge; a visitor cannot choose it there). An
//    IPv6 visitor holds a whole block (a /64 at least, a /56 from most home providers, a /48 from a free tunnel), so IPv6
//    counts as one visitor per /56, and a shop-wide lock counts how many different places tried by /48.
//    Only a keyed hash of that is ever stored, never the address.
//  - Placing an order: per visitor and per email, a cap on orders in 10 minutes and in a day, and on orders still holding
//    stock unpaid; per order, caps on lines and units that a real counter order never reaches (lower for an unpaid pickup);
//    per item, a ceiling on how much of it unpaid pickups may hold together. The shop-wide brake in checkout.js is set for a
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
// All unpaid pickup orders together hold at most this share of an item's units (on the shelf plus already held), and always at
// least 1, so a handful of addresses can never empty an item: the rest stays buyable. More is a phone call.
// HOLD_DIV 2: half. checkout.js repeats it inside the stock statement as "/ 2" (SQLite integer division), so change both together.
export const HOLD_DIV = 2;
export const holdMax = units => Math.max(1, Math.floor(units / HOLD_DIV));
// How many of each item unpaid pickup orders hold now (excluding one order, when given). One fragment, used for the check before
// an order is written and, the same, inside the statement that takes the stock, so simultaneous orders cannot pass it together.
export const HELD_SQL = (sku, notOrder) => `(SELECT COALESCE(SUM(hi.qty),0) FROM order_items hi JOIN orders ho ON ho.id = hi.order_id WHERE hi.sku = ${sku} AND ho.id != ${notOrder} AND ho.pay_status = 'pay_at_pickup' AND ho.status IN ('pending','ready') AND ho.release_op IS NULL)`;
// The shop-wide brake: a real flood only. Per-visitor caps (below) bound one network to 3 unpaid orders at once (6 for an IPv6
// /48) and 5 orders in 10 minutes, so reaching 60 orders in one minute takes 20 or more separate networks at once. A shopper
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
export const ORDER_LIMITS = { per10min: 5, perDay: 15, openHolds: 3 };
// How long an unpaid pay-at-the-counter order holds its stock (owner-vetoable, inventory-2026-11-23/DECISIONS.md beside the repo): PICKUP_HOLD_HOURS, 1 to 336, default 48.
export const pickupHoldHours = env => { const n = Number(env.PICKUP_HOLD_HOURS); return Number.isInteger(n) && n >= 1 && n <= 336 ? n : 48; };
// The visitor's key for the order_attempts table: a hash keyed with a Worker secret, so the table alone cannot be turned back into addresses.
// bits 48: the wider IPv6 block (one tunnel or one site), for a second, looser count, so one /48 cannot act as 256 visitors.
export const orderWho = async (env, request, bits = 56) => (bits === 56 ? "o:" : "g:") + await sha(`order|${env.PIN_PEPPER || env.ADMIN_KEY || ""}|${sourceOf(request, bits)}`);
// A whole /48 at most 10 orders in 10 minutes, 30 a day and 6 held at once: below the shop-wide brake, and room for a family or an office.
export const GROUP_LIMITS = { per10min: 10, perDay: 30, openHolds: 6 };

// Still holding stock unpaid: a counter order not paid yet (also once the shop has got it ready) and, for a visitor, a card
// page not paid yet. An email's count leaves card pages out: they let their stock go by themselves within 35 minutes.
const OPEN = "o.release_op IS NULL AND o.pay_status = 'pay_at_pickup' AND o.status IN ('pending','ready')";
const OPEN_VISITOR = "o.release_op IS NULL AND ((o.pay_status = 'pay_at_pickup' AND o.status IN ('pending','ready')) OR (o.pay_status = 'awaiting' AND o.status = 'pending'))";
// One read: how many orders this visitor and this email placed lately, and how many of each still hold stock unpaid.
// Answers null when a limit is reached (with the words to show), or { ok: true }. `missing` is true on a database that
// does not have migration 0012 yet: the visitor counts are skipped (and logged), the email counts still hold.
// `own`: the shopper is signed in with this very email, so they have shown the inbox is theirs; the email's own counts then
// do not apply (they protect an inbox from receipts it never asked for, and must not let a stranger who typed that email
// block its owner). The visitor limits still do.
export async function orderLimits(env, who, email, placed = 0, own = false, group = who) {   // placed: 1 when the order being checked is already written
  const db = env.DB, L = ORDER_LIMITS, k = placed;
  const byEmail = db.prepare(`SELECT COALESCE(SUM(created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 minutes')),0) AS m10, COALESCE(SUM(created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')),0) AS day,
    COALESCE(SUM(${OPEN}),0) AS open
    FROM orders o WHERE (created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day') OR status IN ('pending','ready')) AND ${normEmailSql("o.email")} = ?1`).bind(normEmail(email));
  const byWho = db.prepare(`SELECT COALESCE(SUM(a.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 minutes')),0) AS m10, COALESCE(SUM(a.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')),0) AS day,
    COALESCE(SUM(EXISTS (SELECT 1 FROM orders o WHERE o.id = a.order_id AND ${OPEN_VISITOR})),0) AS open FROM order_attempts a WHERE a.who = ?1`);
  let e, w = { m10: 0, day: 0, open: 0 }, g = { m10: 0, day: 0, open: 0 }, missing = false;
  try { [e, w, g] = (await db.batch([byEmail, byWho.bind(who), byWho.bind(group)])).map(r => r.results[0]); if (group === who) g = { m10: 0, day: 0, open: 0 }; }
  catch (err) {
    if (!/no such table/i.test(String(err && err.message))) throw err;
    missing = true; console.error(JSON.stringify({ at: "order-guard", problem: "migration 0012_order_guard.sql is not applied: per-visitor order limits are off" }));
    e = (await byEmail.first());
  }
  const G = GROUP_LIMITS;
  if (!own && e.open >= L.openHolds + k) return { ok: false, missing, words: `This email already has ${e.open - k} orders waiting to be paid and picked up. If it is yours, sign in with it to order, or call the counter at 519-255-2222.`, why: "open" };
  if (w.open >= L.openHolds + k || g.open >= G.openHolds + k) return { ok: false, missing, words: `You already have ${Math.max(w.open, Math.min(g.open, L.openHolds + k)) - k} orders waiting to be paid and picked up. Pick those up first, or call the counter at 519-255-2222 to add to them.`, why: "open" };
  if (w.m10 >= L.per10min + k || w.day >= L.perDay + k || g.m10 >= G.per10min + k || g.day >= G.perDay + k || (!own && (e.m10 >= L.per10min + k || e.day >= L.perDay + k))) return { ok: false, missing, words: "That is a lot of orders in a short time. Wait a few minutes and try again, or call the counter at 519-255-2222.", why: "rate" };
  return { ok: true, missing };
}
// The row that counts this order for its visitor, written in the same batch as the order itself.
export const orderAttempt = (db, who, id) => db.prepare("INSERT INTO order_attempts (who, order_id) VALUES (?, ?)").bind(who, id);

// The scheduled sweep: failed sign-in tries older than a day (a good sign-in's row stays: the staff list reads "last
// signed in" from it), and order rows older than the longest hold (14 days ready plus the first hold) are deleted.
export async function pruneGuards(env) {
  const db = env.DB;
  await db.prepare("DELETE FROM login_attempts WHERE ok = 0 AND at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')").run();
  await db.prepare("DELETE FROM order_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')").run().catch(err => { if (!/no such table/i.test(String(err && err.message))) throw err; });
}
