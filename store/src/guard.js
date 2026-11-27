// Limits that keep one visitor from spoiling the shop for everyone else (breaker review, 2026-11-26).
//  - Who is asking: Cloudflare's CF-Connecting-IP (set by Cloudflare at the edge; a visitor cannot choose it there). An
//    IPv6 visitor usually holds a whole /64 block, so IPv6 is counted by its /64, or one phone could be a million visitors.
//    Only a keyed hash of that is ever stored, never the address.
//  - Placing an order: per visitor and per email, a cap on orders in 10 minutes and in a day, and on orders still holding
//    stock unpaid; per order, caps on lines and units that a real counter order never reaches. The shop-wide brake in
//    checkout.js stays as a last resort, and the per-visitor caps sit below it, so one visitor alone can never trip it.
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");

// The address as one visitor: IPv4 as it is, IPv6 by its first 64 bits, an IPv4 address written as IPv6 (::ffff:1.2.3.4)
// as the IPv4 address. Local runs (no Cloudflare in front) have no header and all count as one visitor, "local".
export function sourceBlock(raw) {
  let a = String(raw || "").trim().toLowerCase().split("%")[0];
  if (!a) return "local";
  if (!a.includes(":")) return a;
  const v4 = a.match(/(\d{1,3}(?:\.\d{1,3}){3})$/); if (v4 && /^(::ffff:|::)/.test(a)) return v4[1];
  const [head, tail] = a.split("::"), h = head ? head.split(":") : [], t = a.includes("::") && tail ? tail.split(":") : [];
  const groups = a.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return groups.slice(0, 4).map(g => (parseInt(g, 16) || 0).toString(16)).join(":") + "::/64";
}
export const sourceOf = request => sourceBlock(request.headers.get("CF-Connecting-IP"));

// ---------- the name on an order ----------
// It goes into "Thank you, {name}" in mail sent from the shop to whatever address was typed, so it must never be able to
// carry a link: letters (any language), spaces, apostrophes, hyphens and periods only, starting with a letter, and no
// period run straight into two or more letters (evil.example, www.x), which mail apps turn into links. "J.R. Smith",
// "Dr. Who", "O'Brien" and "Anne-Marie" pass; digits, "://", "@" and slashes cannot get in at all.
export const nameOk = s => typeof s === "string" && s.length <= 80 && /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u.test(s) && !/\.[\p{L}\p{M}]{2,}/u.test(s);

// ---------- placing an order ----------
// Owner-vetoable numbers, in one place. A counter order of 40 units over 20 different items is far past anything the shop
// has seen; a bigger order is a phone call.
export const ORDER_CAPS = { lines: 20, perLine: 20, units: 40 };
export const ORDER_LIMITS = { per10min: 5, perDay: 15, openHolds: 3 };
// How long an unpaid pay-at-the-counter order holds its stock (owner-vetoable, DECISIONS.md): PICKUP_HOLD_HOURS, 1 to 336, default 48.
export const pickupHoldHours = env => { const n = Number(env.PICKUP_HOLD_HOURS); return Number.isInteger(n) && n >= 1 && n <= 336 ? n : 48; };
// The visitor's key for the order_attempts table: a hash keyed with a Worker secret, so the table alone cannot be turned back into addresses.
export const orderWho = async (env, request) => "o:" + await sha(`order|${env.PIN_PEPPER || env.ADMIN_KEY || ""}|${sourceOf(request)}`);

const OPEN = "o.status = 'pending' AND o.release_op IS NULL AND o.pay_status IN ('pay_at_pickup','awaiting')";
// One read: how many orders this visitor and this email placed lately, and how many of each still hold stock unpaid.
// Answers null when a limit is reached (with the words to show), or { ok: true }. `missing` is true on a database that
// does not have migration 0012 yet: the visitor counts are skipped (and logged), the email counts still hold.
// `own`: the shopper is signed in with this very email, so they have shown the inbox is theirs; its 10-minute and daily
// counts then do not apply (those protect someone else's inbox from receipts it never asked for). Every other limit does.
export async function orderLimits(env, who, email, placed = 0, own = false) {   // placed: 1 when the order being checked is already written
  const db = env.DB, L = ORDER_LIMITS, k = placed;
  const byEmail = db.prepare(`SELECT COALESCE(SUM(created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 minutes')),0) AS m10, COALESCE(SUM(created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')),0) AS day,
    COALESCE(SUM(status = 'pending' AND release_op IS NULL AND pay_status IN ('pay_at_pickup','awaiting')),0) AS open
    FROM orders WHERE lower(email) = lower(?1) AND (created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day') OR (status = 'pending' AND release_op IS NULL))`).bind(email);
  const byWho = db.prepare(`SELECT COALESCE(SUM(a.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 minutes')),0) AS m10, COALESCE(SUM(a.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')),0) AS day,
    COALESCE(SUM(EXISTS (SELECT 1 FROM orders o WHERE o.id = a.order_id AND ${OPEN})),0) AS open FROM order_attempts a WHERE a.who = ?1`).bind(who);
  let e, w = { m10: 0, day: 0, open: 0 }, missing = false;
  try { [e, w] = (await db.batch([byEmail, byWho])).map(r => r.results[0]); }
  catch (err) {
    if (!/no such table/i.test(String(err && err.message))) throw err;
    missing = true; console.error(JSON.stringify({ at: "order-guard", problem: "migration 0012_order_guard.sql is not applied: per-visitor order limits are off" }));
    e = (await byEmail.first());
  }
  if (w.open >= L.openHolds + k || e.open >= L.openHolds + k) return { ok: false, missing, words: `You already have ${Math.max(w.open, e.open) - k} orders waiting to be paid and picked up. Pick those up first, or call the counter at 519-255-2222 to add to them.`, why: "open" };
  if (w.m10 >= L.per10min + k || w.day >= L.perDay + k || (!own && (e.m10 >= L.per10min + k || e.day >= L.perDay + k))) return { ok: false, missing, words: "That is a lot of orders in a short time. Wait a few minutes and try again, or call the counter at 519-255-2222.", why: "rate" };
  return { ok: true, missing };
}
// The row that counts this order for its visitor, written in the same batch as the order itself.
export const orderAttempt = (db, who, id) => db.prepare("INSERT INTO order_attempts (who, order_id) VALUES (?, ?)").bind(who, id);

// The scheduled sweep: sign-in tries older than a day, and order rows older than the longest hold plus a day, are deleted.
export async function pruneGuards(env) {
  const db = env.DB;
  await db.prepare("DELETE FROM login_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')").run();
  await db.prepare("DELETE FROM order_attempts WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 days')").run().catch(err => { if (!/no such table/i.test(String(err && err.message))) throw err; });
}
