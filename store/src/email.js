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
  const rows = [...lines(items), ["How", way], [paid ? "Paid by card" : "To pay at pickup", money(o.total_cents), true]];
  const say = e => `${e(o.name)}${o.phone ? `, ${e(o.phone)}` : ""}. ${paid ? "Paid by card." : "Pays at the counter."} Open it in the back office to get it ready.`;
  const heading = `New order ${esc(o.id)}`, intro = say(esc);
  return { kind: "new_order", subject: `${site}: new order ${o.id}, ${money(o.total_cents)}${paid ? "" : ", pay at pickup"}`, html: frame(site, heading, intro, rows, "Sent to the shop for every new order."), body: plain(`New order ${o.id}`, say(String), rows, "") };   // the plain text carries the name as typed (O'Brien, not O&#39;Brien)
}
export function lowStock(site, list) {
  const rows = list.map(p => [esc(p.name), p.stock <= 0 ? "Out" : `${p.stock} left`]);
  const heading = list.length === 1 ? `${esc(list[0].name)} is running low` : `${list.length} products are running low`, intro = "After the last order, these are at or under the level you asked to be warned at.";
  return { kind: "low_stock", subject: `${site}: stock running low`, html: frame(site, heading, intro, rows, "Change the warning level on each product in the back office."), body: plain(heading, intro, rows, "") };
}

// Save it, then send it if a mail service is connected. Never throws: a mail problem must not undo an order.
export async function writeEmail(env, orderId, to, mail) {
  try {
    const row = await env.DB.prepare("INSERT INTO emails (order_id, kind, recipient, subject, html, body) VALUES (?,?,?,?,?,?) RETURNING id").bind(orderId, mail.kind, to, mail.subject, mail.html, mail.body).first();
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !/^[^\s@]+@[^\s@]+$/.test(to)) return;
    let status = "failed", detail = "";
    try {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: mail.subject, html: mail.html, text: mail.body }), signal: AbortSignal.timeout(8000) });
      status = r.ok ? "sent" : "failed"; detail = r.ok ? "" : `mail service answered ${r.status}`;
    } catch (e) { detail = String(e && e.message || e).slice(0, 120); }
    await env.DB.prepare("UPDATE emails SET status = ?, detail = ? WHERE id = ?").bind(status, detail, row.id).run();
  } catch (e) { console.error(JSON.stringify({ at: "email", message: String(e && e.message || e) })); }
}
