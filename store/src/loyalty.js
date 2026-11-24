// Points. One setting the shop can change (off until the owner turns it on), a balance that is always worked out
// from the orders behind it, and the one reward a customer can take at checkout. Design and sources:
// store/docs/ACCOUNTS-LOYALTY.md.
//
// How a balance is read: every ledger row is looked at beside its order's status at that moment.
//   earn    on the way while the order is paid, packed or ready; points once it is shipped or collected;
//           nothing if the order is cancelled or refunded. Cancel or refund takes the points back with no extra step,
//           whichever screen (or branch of the code) changed the status.
//   redeem  holds its points while its order exists and is not cancelled or refunded.
//   adjust  a hand correction.
// Points never expire with time: there is no expiry anywhere in this file, on purpose (Ontario CPA, see the doc).

export const LOYALTY_DEFAULTS = Object.freeze({ on: false, points_per_dollar: 1, reward_points: 100, reward_cents: 500 });
const MAX_BACK_CENTS = 10;
const LIMITS = { points_per_dollar: [1, 10], reward_points: [10, 10000], reward_cents: [100, 10000] };

export async function loyaltySettings(db) {
  const raw = await db.prepare("SELECT value FROM account_settings WHERE key = 'loyalty'").first("value");
  let v = {}; try { v = JSON.parse(raw || "{}"); } catch {}
  const out = { ...LOYALTY_DEFAULTS };
  if (typeof v.on === "boolean") out.on = v.on;
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) if (Number.isInteger(v[k]) && v[k] >= lo && v[k] <= hi) out[k] = v[k];
  return out;
}
// What it would cost the shop, in plain words, for the settings screen and the doc.
export const costNote = s => `Each ${money(s.reward_cents)} reward needs ${s.reward_points} points, so it gives back ${+(s.reward_cents * s.points_per_dollar / s.reward_points).toFixed(1)} cents on every dollar of items once the points are spent. Points nobody spends cost nothing.`;
const money = c => "$" + (c / 100).toFixed(c % 100 ? 2 : 0);

const POINTS = `COALESCE(SUM(CASE WHEN l.kind = 'earn' AND o.status IN ('shipped','collected') THEN l.points END), 0)
    + COALESCE(SUM(CASE WHEN l.kind = 'adjust' THEN l.points END), 0)
    - COALESCE(SUM(CASE WHEN l.kind = 'redeem' AND o.status NOT IN ('cancelled','refunded') THEN l.points END), 0)`;
const FROM = "FROM loyalty_ledger l LEFT JOIN orders o ON o.id = l.order_id WHERE l.customer_id = ?1";
const BALANCE = `SELECT ${POINTS} AS points, COALESCE(SUM(CASE WHEN l.kind = 'earn' AND o.status IN ('paid','packed','ready') THEN l.points END), 0) AS coming ${FROM}`;
export async function balance(db, customerId) {
  const r = await db.prepare(BALANCE).bind(customerId).first();
  return { points: r?.points ?? 0, coming: r?.coming ?? 0 };
}
// Everything the account page and checkout need to show, or { on: false } and nothing else.
export async function loyaltyView(db, customerId) {
  const s = await loyaltySettings(db); if (!s.on) return { on: false };
  const b = customerId ? await balance(db, customerId) : { points: 0, coming: 0 };
  return { on: true, points_per_dollar: s.points_per_dollar, reward_points: s.reward_points, reward_cents: s.reward_cents, points: b.points, coming: b.coming, can_redeem: b.points >= s.reward_points };
}
export const pointsFor = (s, itemCents) => Math.max(0, Math.floor(itemCents / 100) * s.points_per_dollar);

// Checkout, step 1: what this order takes off and earns. A reward is taken only when the customer asked for it and
// has the points now; asking without them is an error the shopper sees (never a silent full price).
export async function orderLoyalty(db, customer, wantReward, subtotalCents) {
  if (!customer) return { on: false, reward_cents: 0, cost: 0, earn: 0, refused: !!wantReward };
  const s = await loyaltySettings(db);
  if (!s.on) return { on: false, reward_cents: 0, cost: 0, earn: 0, refused: !!wantReward };
  let reward = 0, cost = 0, refused = false;
  if (wantReward) {
    const b = await balance(db, customer.id);
    if (b.points >= s.reward_points && subtotalCents > 0) { reward = Math.min(s.reward_cents, subtotalCents); cost = s.reward_points; } else refused = true;
  }
  return { on: true, reward_cents: reward, cost, earn: pointsFor(s, subtotalCents - reward), refused };
}
// Checkout, step 2: statements that run in the same batch (one transaction) as the order's first write.
// The redeem row is written only if the balance still covers it at that instant, so two orders at once cannot
// both spend the same points; the caller reads its changes() and backs the order out if it was refused.
export function orderLoyaltyStatements(db, orderId, customer, loy) {
  const st = [db.prepare("DELETE FROM loyalty_ledger WHERE order_id = ?").bind(orderId)];   // a reclaimed order code never inherits old rows
  if (!customer) return { statements: st, redeemAt: -1 };
  st.push(db.prepare("UPDATE orders SET customer_id = ?, reward_cents = ? WHERE id = ?").bind(customer.id, loy.reward_cents || 0, orderId));
  if (!loy.on) return { statements: st, redeemAt: -1 };
  if (loy.earn > 0) st.push(db.prepare("INSERT INTO loyalty_ledger (customer_id, order_id, kind, points) VALUES (?, ?, 'earn', ?)").bind(customer.id, orderId, loy.earn));
  let redeemAt = -1;
  if (loy.cost > 0) {
    redeemAt = st.length;
    st.push(db.prepare(`INSERT INTO loyalty_ledger (customer_id, order_id, kind, points) SELECT ?1, ?2, 'redeem', ?3 WHERE (SELECT ${POINTS} ${FROM}) >= ?3`).bind(customer.id, orderId, loy.cost));
  }
  return { statements: st, redeemAt };
}

// Back office: read and change the program. Needs the admin sign-in (passed in, so this file does not reach into admin.js).
export async function loyaltyAdmin(request, env, url, signedIn) {
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  if (!(await signedIn(request, env))) return json({ error: "Sign in first." }, 401);
  const db = env.DB;
  if (request.method === "GET") { const s = await loyaltySettings(db); return json({ loyalty: s, cost: costNote(s) }); }
  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return json({ error: "Send JSON." }, 415);
  if (request.headers.get("X-OSS-Admin") !== "1") return json({ error: "Missing request marker." }, 400);
  const origin = request.headers.get("Origin"); if (origin && origin !== url.origin) return json({ error: "Wrong origin." }, 403);
  const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return json({ error: "That could not be read." }, 400);
  const before = await loyaltySettings(db), next = { ...before };
  if ("on" in body) { if (typeof body.on !== "boolean") return json({ error: "Check: on." }, 400); next.on = body.on; }
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) if (k in body) { if (!Number.isInteger(body[k]) || body[k] < lo || body[k] > hi) return json({ error: `Check: ${k.replace(/_/g, " ")} (${lo} to ${hi}).` }, 400); next[k] = body[k]; }
  // a typo must not become a giveaway: the program may give back at most 10 cents on a dollar of items
  if (next.reward_cents * next.points_per_dollar / next.reward_points > MAX_BACK_CENTS) return json({ error: `That gives back more than ${MAX_BACK_CENTS} cents on every dollar. ${costNote(next)}` }, 400);
  await db.batch([
    db.prepare("INSERT INTO account_settings (key, value) VALUES ('loyalty', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')").bind(JSON.stringify(next)),
    db.prepare("INSERT INTO audit_log (actor, action, target, before, after) VALUES ('owner', 'loyalty.settings', 'loyalty', ?, ?)").bind(JSON.stringify(before), JSON.stringify(next)),
  ]);
  return json({ ok: true, loyalty: next, cost: costNote(next) });
}
