// The emails the store writes: order received, shipped, ready for pickup, and a low-stock note to the shop.
// Each one is saved in the database first. It is sent only when a mail service is connected (RESEND_API_KEY and
// EMAIL_FROM set); until then it is kept as "held", so nothing claims to have been sent when it was not.
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function frame(site, heading, intro, rows, foot) {
  const row = ([a, b, strong]) => `<tr><td style="padding:10px 0;border-top:1px solid #e3ddd2;${strong ? "font-weight:700;" : ""}">${a}</td><td align="right" style="padding:10px 0;border-top:1px solid #e3ddd2;white-space:nowrap;${strong ? "font-weight:700;font-size:18px;" : ""}">${b}</td></tr>`;
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f4f0e8;font-family:Arial,Helvetica,sans-serif;color:#1b1713;line-height:1.5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff">
<tr><td style="background:#17110d;padding:18px 24px;font-size:20px;font-weight:800;letter-spacing:.02em;color:#ffffff">${esc(site.toUpperCase().replace(/ SHOP$/, ""))} <span style="color:#e0291c">SHOP</span></td></tr>
<tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 10px;font-size:24px;line-height:1.2">${heading}</h1><p style="margin:0 0 18px;font-size:16px">${intro}</p>
${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${rows.map(row).join("")}</table>` : ""}</td></tr>
<tr><td style="padding:16px 24px 28px;font-size:13px;color:#6b6357">${foot}</td></tr>
</table></td></tr></table></body></html>`;
}
const lines = items => items.map(i => [`${i.qty} &times; ${esc(i.name)}`, money(i.unit_cents * i.qty)]);
export const plain =(heading, intro, rows, foot) => [heading, "", intro, "", ...rows.map(r => `${String(r[0]).replace(/&times;/g, "x").replace(/&amp;/g, "&")}  ${r[1]}`), "", foot].join("\n").replace(/<[^>]+>/g, "");

// how: "paid" (written only after Stripe's signed webhook) or "at_pickup" (nothing paid yet: pay at the counter).
export function orderPlaced(site, o, items, how = "at_pickup") {
  const paid = how === "paid";
  const rows = [...lines(items), ["Items", money(o.subtotal_cents)], ...(o.reward_cents ? [["Points reward", "−" + money(o.reward_cents)]] : []), [o.method === "pickup" ? "Pickup at the counter" : o.ship_service === "Local delivery" ? "Local delivery" : `Shipping, ${esc(o.ship_service || "")}`, o.method === "pickup" || (o.ship_service === "Local delivery" && !o.shipping_cents) ? "Free" : money(o.shipping_cents)],
    [`Tax, ${esc(o.tax_province || "")}`, money(o.tax_cents)], [paid ? "Paid by card" : "To pay at pickup", money(o.total_cents), true]];
  const heading = paid ? `Order ${esc(o.id)} is paid` : `Order ${esc(o.id)} is in`, first = esc(String(o.name).split(" ")[0]);
  const next = o.method === "pickup" ? "We email you when it is ready to pick up." : o.ship_service === "Local delivery" ? "Our driver calls before coming." : "We email the tracking number when it ships.";
  const intro = paid ? `Thank you, ${first}. Your payment went through. ${next}` : `Thank you, ${first}. You pay at the counter when you pick it up. ${next}`;
  const foot = "Questions? Reply to this email or call the counter at 519-255-2222.";
  return { kind: "order_placed", subject: paid ? `Receipt for your ${site} order ${o.id}` : `Your ${site} order ${o.id}`, html: frame(site, heading, intro, rows, foot), body: plain(heading, intro, rows, foot) };
}
export function orderShipped(site, o, items) {
  const heading = `Order ${esc(o.id)} is on its way`, intro = o.ship_service === "Local delivery" ? "It is out for delivery from our Windsor shop. The driver will call if they need you." : `It left the shop by ${esc(o.ship_service || "Canada Post")}.${o.tracking ? ` Tracking number: <b>${esc(o.tracking)}</b>.` : " The tracking number follows as soon as the carrier scans it."}`;
  const foot = "If anything arrives broken, bring it into the store at 760 Wyandotte St E and talk to the store manager.";
  return { kind: "order_shipped", subject: o.ship_service === "Local delivery" ? `Your ${site} order ${o.id} is out for delivery` : `Your ${site} order ${o.id} has shipped`, html: frame(site, heading, intro, lines(items), foot), body: plain(heading, intro, lines(items), foot) };
}
export function pickupReady(site, o, items) {
  const heading = `Order ${esc(o.id)} is ready`, intro = "It is waiting at 760 Wyandotte St E, Windsor, ON N9A 3J4. Bring this order number.";
  const foot = "We hold pickup orders for 14 days. Call 519-255-2222 if you need longer.";
  return { kind: "pickup_ready", subject: `Your ${site} order ${o.id} is ready for pickup`, html: frame(site, heading, intro, lines(items), foot), body: plain(heading, intro, lines(items), foot) };
}
// To the shop (OWNER_EMAIL): a new order to get ready. Short, so it reads on a phone at the counter.
export function newOrder(site, o, items, how = "at_pickup") {
  const paid = how === "paid", way = o.method === "pickup" ? "Pickup at the counter" : o.ship_service === "Local delivery" ? "Local delivery" : `Shipping, ${esc(o.ship_service || "")}`;
  const a = (() => { try { return JSON.parse(o.address || "{}"); } catch { return {}; } })();
  const where = o.method === "ship" && a.line1 ? [a.line1, a.city, a.province, a.postal].filter(Boolean).join(", ") : "";
  // the figures the customer was shown, line for line, so the counter can answer "what did I pay for delivery" from the note
  const rows = [...lines(items), ["Items", money(o.subtotal_cents)], ...(o.reward_cents ? [["Points reward", "−" + money(o.reward_cents)]] : []),
    [way, o.method === "pickup" || !o.shipping_cents ? "Free" : money(o.shipping_cents)], [`Tax, ${esc(o.tax_province || "")}`, money(o.tax_cents)],
    ...(where ? [["Deliver to", esc(where)]] : []), ...(a.note ? [["Note", esc(a.note)]] : []),
    [paid ? "Paid by card" : "To pay at pickup", money(o.total_cents), true]];
  const say = e => `${e(o.name)}${o.phone ? `, ${e(o.phone)}` : ""}${o.email ? `, ${e(o.email)}` : ""}. ${paid ? "Paid by card." : "Pays at the counter."} Open it in the back office to get it ready.`;
  const heading = `New order ${esc(o.id)}`, intro = say(esc);
  return { kind: "new_order", customer: o.email, subject: `${site}: new order ${o.id}, ${money(o.total_cents)}, ${o.method === "pickup" ? "pickup" : o.ship_service === "Local delivery" ? "local delivery" : "ship"}${paid ? "" : ", pay at pickup"}`, html: frame(site, heading, intro, rows, "Sent to the shop for every new order. Reply to reach the customer."), body: plain(`New order ${o.id}`, say(String), rows, "") };   // the plain text carries the name as typed (O'Brien, not O&#39;Brien)
}
export function lowStock(site, list) {
  const rows = list.map(p => [esc(p.name), p.stock <= 0 ? "Out" : `${p.stock} left`]);
  const heading = list.length === 1 ? `${esc(list[0].name)} is running low` : `${list.length} products are running low`, intro = "After the last order, these are at or under the level you asked to be warned at.";
  return { kind: "low_stock", subject: `${site}: stock running low`, html: frame(site, heading, intro, rows, "Change the warning level on each product in the back office."), body: plain(heading, intro, rows, "") };
}

// Where the mail service lives. Tests point it at the local stand-in (tools/fake-resend.mjs); nothing else is accepted,
// so a typo can never send the mail key to a stranger.
function resendBase(env) {
  const b = String(env.RESEND_API_BASE || "https://api.resend.com").replace(/\/+$/, "");
  if (b === "https://api.resend.com" || /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(b)) return b;
  throw new Error("RESEND_API_BASE must be https://api.resend.com");
}
const isAddr = s => /^[^\s@]+@[^\s@]+$/.test(String(s || ""));
export const mailReady = env => !!(env.RESEND_API_KEY && env.EMAIL_FROM);
// The emails tried again when the mail service fails (sign-in codes are not: a late code is no use).
const RETRY_KINDS = ["order_placed", "order_shipped", "pickup_ready", "low_stock", "new_order"], MAX_TRIES = 5;
// Who a reply goes to: a customer's reply reaches the shop inbox (OWNER_EMAIL; EMAIL_FROM may be a sending-only
// address), and a reply to the shop's new-order note reaches the customer.
function replyTo(env, kind, to, customer) {
  if (kind === "new_order") return isAddr(customer) ? customer : undefined;
  if (kind === "low_stock") return undefined;
  return isAddr(env.OWNER_EMAIL) && env.OWNER_EMAIL !== to ? env.OWNER_EMAIL : undefined;
}
// One send. The row id is the Idempotency-Key, so a retry after a lost answer never sends a second copy.
async function send(env, id, to, subject, html, text, reply) {
  try {
    const r = await fetch(resendBase(env) + "/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `oss-email-${id}` },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text, ...(reply ? { reply_to: reply } : {}) }), signal: AbortSignal.timeout(8000) });
    if (r.ok) return { ok: true };
    const why = (await r.json().catch(() => null))?.message;
    return { ok: false, detail: `mail service answered ${r.status}${why ? ": " + String(why).slice(0, 120) : ""}` };
  } catch (e) { return { ok: false, detail: String(e && e.message || e).slice(0, 120) }; }
}
const failNote = (tries, detail) => tries >= MAX_TRIES ? `gave up after ${tries} tries: ${detail}` : `try ${tries}: ${detail}`;
const failLog = (id, kind, tries, detail) => console.error(JSON.stringify({ at: "email", problem: tries >= MAX_TRIES ? "not sent, gave up: see the order in the back office" : "not sent, tried again within 10 minutes", email: id, kind, tries, detail }));

// Save it, then send it if a mail service is connected. Never throws: a mail problem must not undo an order.
// A failed send stays 'failed' with its reason ("try 1: ..."), is logged, shows as Failed on the order in the back office,
// and is sent again by retryEmails (every 10 minutes, up to 5 tries within a day).
export async function writeEmail(env, orderId, to, mail) {
  try {
    const row = await env.DB.prepare("INSERT INTO emails (order_id, kind, recipient, subject, html, body) VALUES (?,?,?,?,?,?) RETURNING id").bind(orderId, mail.kind, to, mail.subject, mail.html, mail.body).first();
    if (!mailReady(env) || !isAddr(to)) return;
    const r = await send(env, row.id, to, mail.subject, mail.html, mail.body, replyTo(env, mail.kind, to, mail.customer));
    if (!r.ok) failLog(row.id, mail.kind, 1, r.detail);
    await env.DB.prepare("UPDATE emails SET status = ?, detail = ? WHERE id = ?").bind(r.ok ? "sent" : "failed", r.ok ? "" : failNote(1, r.detail), row.id).run();
  } catch (e) { console.error(JSON.stringify({ at: "email", message: String(e && e.message || e) })); }
}
// Every 10 minutes (worker.js scheduled): order and stock emails that failed within the last day are sent again.
// Each row is claimed first (its note moves to the next try), so two runs at once never both send it.
export async function retryEmails(env) {
  if (!mailReady(env)) return { tried: 0, sent: 0 };
  const db = env.DB, list = (await db.prepare(`SELECT e.id, e.kind, e.recipient, e.subject, e.html, e.body, e.detail, o.email AS customer FROM emails e LEFT JOIN orders o ON o.id = e.order_id
    WHERE e.status = 'failed' AND e.kind IN (${RETRY_KINDS.map(() => "?").join(",")}) AND e.detail LIKE 'try %' AND e.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day') ORDER BY e.id LIMIT 20`).bind(...RETRY_KINDS).all()).results;
  let tried = 0, sent = 0;
  for (const e of list) {
    const was = +((/^try (\d+):/.exec(e.detail || "") || [])[1] || 1), now = was + 1;
    if (!isAddr(e.recipient)) continue;
    const claim = await db.prepare("UPDATE emails SET detail = ? WHERE id = ? AND status = 'failed' AND detail = ?").bind(`try ${now}: sending`, e.id, e.detail).run();
    if (!claim.meta.changes) continue;
    tried++;
    const r = await send(env, e.id, e.recipient, e.subject, e.html, e.body, replyTo(env, e.kind, e.recipient, e.customer));
    if (r.ok) sent++; else failLog(e.id, e.kind, now, r.detail);
    await db.prepare("UPDATE emails SET status = ?, detail = ? WHERE id = ?").bind(r.ok ? "sent" : "failed", r.ok ? "" : failNote(now, r.detail), e.id).run();
  }
  return { tried, sent };
}
