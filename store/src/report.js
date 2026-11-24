// The monthly sales report: what the shop sold online in one calendar month (Windsor time), what came back, and
// the studio's share. Money is whole cents throughout; the share is rounded once, at the end, half away from zero.
//
// How a month is counted (ledger style, so a closed month's sales never change later):
//   sales     = every order placed in the month that took money (see SOLD), on its order date
//   refunds   = money given back in the month, on the day: each card refund (part or whole), or a cancelled order, as a minus line
//   net       = sales - refunds
//   studio share = rate x net, on the basis in settings: "subtotal" (items, before tax and delivery, the default)
//                  or "total" (everything the customer paid). The owner still has to confirm the basis in writing.
const TZ = "America/Toronto";
const parts = ms => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms)).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
const offset = ms => { const p = parts(ms); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms; };
// The UTC instant of midnight at the start of the 1st of a month in Windsor (handles the switch to and from summer time).
export function monthStart(y, m) {
  const guess = Date.UTC(y, m - 1, 1); let t = guess - offset(guess); const o2 = offset(t); if (guess - o2 !== t) t = guess - o2; return t;
}
const iso = ms => new Date(ms).toISOString().slice(0, 19) + "Z";
export const localDay = s => { const p = parts(Date.parse(s)); return `${p.year}-${p.month}-${p.day}`; };
export function monthOf(v) {
  if (v === null || v === undefined || v === "") { const p = parts(Date.now()); return `${p.year}-${p.month}`; }
  const m = /^(20[2-9]\d)-(0[1-9]|1[0-2])$/.exec(String(v)); return m ? m[0] : null;
}
export const share = (basisCents, bp) => { const x = basisCents * bp; const r = Math.floor((Math.abs(x) + 5000) / 10000); return x < 0 ? -r : r; };   // integer maths: no floating point in money

export async function report(db, month, withRows = false) {
  const [y, m] = month.split("-").map(Number), from = iso(monthStart(y, m)), to = iso(monthStart(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1));
  const REFUND_AT = "COALESCE(cancelled_at, updated_at)";
  // a sale is an order that took money (card paid by webhook, or paid at the counter). A card page that closed unpaid,
  // or a pay-at-counter pickup nobody collected, never counts, so it never shows as a refund either.
  const SOLD = "(status <> 'pending' AND (pay_status IS NULL OR pay_status IN ('paid','refunded','part_refunded')))";
  // what came back, on the day it came back: a card refund (whole or part) from the refunds table, split across items,
  // delivery and tax in the order's own proportions; a cancelled or till-refunded order with no card refund, whole.
  // An order counts as one refunded order only when the last of its refunds empties it.
  const REFUND_LINES = `SELECT id, status, method, source, ${REFUND_AT} AS at, subtotal_cents AS subtotal, shipping_cents AS delivery, tax_cents AS tax, total_cents AS total, 1 AS whole
      FROM orders WHERE ${SOLD} AND status IN ('cancelled','refunded') AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = orders.id AND r.status = 'succeeded')
    UNION ALL SELECT o.id, o.status, o.method, o.source, r.updated_at, r.amount_cents * o.subtotal_cents / o.total_cents, r.amount_cents * o.shipping_cents / o.total_cents,
      r.amount_cents - r.amount_cents * o.subtotal_cents / o.total_cents - r.amount_cents * o.shipping_cents / o.total_cents, r.amount_cents,
      CASE WHEN o.refunded_cents >= o.paid_cents AND r.id = (SELECT MAX(id) FROM refunds x WHERE x.order_id = o.id AND x.status = 'succeeded') THEN 1 ELSE 0 END
      FROM refunds r JOIN orders o ON o.id = r.order_id WHERE r.status = 'succeeded' AND o.total_cents > 0`;
  const q = [
    db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal_cents),0) AS subtotal, COALESCE(SUM(shipping_cents),0) AS delivery, COALESCE(SUM(tax_cents),0) AS tax, COALESCE(SUM(total_cents),0) AS total
      FROM orders WHERE created_at >= ?1 AND created_at < ?2 AND ${SOLD}`).bind(from, to),
    db.prepare(`SELECT * FROM (${REFUND_LINES}) WHERE at >= ?1 AND at < ?2 ORDER BY at, id`).bind(from, to),
    db.prepare(`SELECT COALESCE(source, 'not recorded') AS source, COUNT(*) AS orders, SUM(subtotal_cents) AS subtotal FROM orders WHERE created_at >= ?1 AND created_at < ?2 AND ${SOLD} GROUP BY 1 ORDER BY subtotal DESC, source`).bind(from, to),
    db.prepare("SELECT key, value, updated_by, updated_at FROM settings WHERE key IN ('studio_share_basis','studio_share_bp')"),
  ];
  if (withRows) q.push(
    db.prepare(`SELECT 'sale' AS line, id, status, method, source, created_at AS at, subtotal_cents, shipping_cents, tax_cents, total_cents FROM orders WHERE created_at >= ?1 AND created_at < ?2 AND ${SOLD}
      UNION ALL SELECT 'refund', id, status, method, source, at, -subtotal, -delivery, -tax, -total FROM (${REFUND_LINES}) WHERE at >= ?1 AND at < ?2
      ORDER BY at, id`).bind(from, to));
  const res = await db.batch(q);
  const sales = res[0].results[0], set = Object.fromEntries(res[3].results.map(r => [r.key, r]));
  const refunds = res[1].results.reduce((t, l) => ({ orders: t.orders + l.whole, subtotal: t.subtotal + l.subtotal, delivery: t.delivery + l.delivery, tax: t.tax + l.tax, total: t.total + l.total }), { orders: 0, subtotal: 0, delivery: 0, tax: 0, total: 0 });
  const basis = set.studio_share_basis?.value === "total" ? "total" : "subtotal", bp = Math.max(0, Math.min(10000, parseInt(set.studio_share_bp?.value ?? "500", 10) || 0));
  const net = { orders: sales.orders - refunds.orders, subtotal: sales.subtotal - refunds.subtotal, delivery: sales.delivery - refunds.delivery, tax: sales.tax - refunds.tax, total: sales.total - refunds.total };
  const basisCents = net[basis];
  return {
    month, from, to, timezone: TZ, sales, refunds, net,
    studio: { basis, basis_label: basis === "total" ? "full total paid, including tax and delivery" : "subtotal before tax and delivery", rate_bp: bp, basis_cents: basisCents, share_cents: share(basisCents, bp),
      confirmed: false, basis_set_by: set.studio_share_basis?.updated_by || "setup", basis_set_at: set.studio_share_basis?.updated_at || null },
    sources: res[2].results,
    ...(withRows ? { rows: res[4].results } : {}),
  };
}

// CSV for a spreadsheet. Every cell is quoted, and a cell that a spreadsheet would run as a formula is defused.
const cell = v => { let s = v === null || v === undefined ? "" : String(v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
const dollars = c => (c < 0 ? "-" : "") + (Math.abs(c) / 100).toFixed(2);
export function reportCsv(r) {
  const out = [["One Stop Shop online sales", r.month, `Windsor time (${r.timezone})`]];
  out.push([], ["Line", "Date", "Order", "Status now", "Method", "Source", "Items subtotal", "Delivery", "Tax", "Total"]);
  for (const x of r.rows) out.push([x.line === "sale" ? "Sale" : "Cancelled or refunded", localDay(x.at), x.id, x.status, x.method, x.source || "not recorded", dollars(x.subtotal_cents), dollars(x.shipping_cents), dollars(x.tax_cents), dollars(x.total_cents)]);
  out.push([], ["Summary", "", "Orders", "", "", "", "Items subtotal", "Delivery", "Tax", "Total"]);
  out.push(["All sales", "", r.sales.orders, "", "", "", dollars(r.sales.subtotal), dollars(r.sales.delivery), dollars(r.sales.tax), dollars(r.sales.total)]);
  out.push(["All cancelled or refunded", "", r.refunds.orders, "", "", "", dollars(-r.refunds.subtotal), dollars(-r.refunds.delivery), dollars(-r.refunds.tax), dollars(-r.refunds.total)]);
  out.push(["Net", "", r.net.orders, "", "", "", dollars(r.net.subtotal), dollars(r.net.delivery), dollars(r.net.tax), dollars(r.net.total)]);
  out.push([], ["Studio share", `${r.studio.rate_bp / 100}% of the ${r.studio.basis_label}`, "", "", "", "", "Basis", dollars(r.studio.basis_cents), "Share", dollars(r.studio.share_cents)]);
  out.push(["Note", "The basis is waiting for the owner's written confirmation."]);
  return out.map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
