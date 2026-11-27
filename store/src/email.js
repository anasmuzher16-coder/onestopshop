// The emails the store writes: order received, shipped, ready for pickup, and a low-stock note to the shop.
// Each one is saved in the database first. It is sent only when a mail service is connected (RESEND_API_KEY and
// EMAIL_FROM set); until then it is kept as "held", so nothing claims to have been sent when it was not.
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Words a customer typed (a note, an address, a name saved before names were checked), made safe for mail apps that turn
// anything link-shaped into a link: a zero-width space after each period, colon, @ or slash that runs straight into a letter
// or digit, and inside "www", so "evil.example" or "https://x" in mail from the shop stays plain words. Escape it after this.
export const unlink = s => String(s ?? "").replace(/([.:@\/])(?=[\p{L}\p{N}\/])/gu, "$1​").replace(/w(?=ww)/gi, "$&​");
// How long a pay-at-the-counter pickup request waits for the shop to confirm it (pay_expires_at, set by checkout.js from
// PICKUP_REQUEST_HOURS), in the shop's own time. Null for anything else. Nothing is held during that time (2026-11-27).
const holdOf = o => {
  if (o.pay_status !== "pay_at_pickup" || !o.pay_expires_at || !o.created_at) return null;
  const end = Date.parse(o.pay_expires_at.endsWith("Z") ? o.pay_expires_at : o.pay_expires_at + "Z"), start = Date.parse(o.created_at.endsWith("Z") ? o.created_at : o.created_at + "Z");
  if (!(end > start)) return null;
  return { hours: Math.round((end - start) / 3600e3), until: new Date(end).toLocaleString("en-CA", { timeZone: "America/Toronto", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) };
};

export function frame(site, heading, intro, rows, foot) {
  // a money figure stays on one line; a long value (an address, a note) wraps on a phone instead of pushing the table wide
  const long = b => String(b).replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, "x").length > 16;
  const row = ([a, b, strong]) => `<tr><td style="padding:10px 12px 10px 0;border-top:1px solid #e3ddd2;overflow-wrap:anywhere;word-break:break-word;${strong ? "font-weight:700;" : ""}">${a}</td><td align="right" style="padding:10px 0;border-top:1px solid #e3ddd2;${long(b) ? "overflow-wrap:anywhere;word-break:break-word;" : "white-space:nowrap;"}${strong ? "font-weight:700;font-size:18px;" : ""}">${b}</td></tr>`;
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
// Entities back to characters for the plain-text copy. Tags are stripped first, so decoding can never make one.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", times: "x", nbsp: " ", middot: "·", minus: "−", rarr: "→", larr: "←" };
const decode = t => t.replace(/&(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z]{2,8});/g, (m, e) => {
  if (e[0] !== "#") return ENT[e.toLowerCase()] ?? m;
  const n = /^#[xX]/.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
});
export const plain = (heading, intro, rows, foot) => decode([heading, "", intro, "", ...rows.map(r => `${r[0]}  ${r[1]}`), "", foot].join("\n").replace(/<[^>]+>/g, ""));

// how: "paid" (written only after Stripe's signed webhook) or "at_pickup" (nothing paid yet: pay at the counter).
export function orderPlaced(site, o, items, how = "at_pickup") {
  const paid = how === "paid";
  const rows = [...lines(items), ["Items", money(o.subtotal_cents)], ...(o.reward_cents ? [["Points reward", "−" + money(o.reward_cents)]] : []), [o.method === "pickup" ? "Pickup at the counter" : o.ship_service === "Local delivery" ? "Local delivery" : `Shipping, ${esc(o.ship_service || "")}`, o.method === "pickup" || (o.ship_service === "Local delivery" && !o.shipping_cents) ? "Free" : money(o.shipping_cents)],
    [`Tax, ${esc(o.tax_province || "")}`, money(o.tax_cents)], [paid ? "Paid by card" : "To pay at pickup", money(o.total_cents), true]];
  const heading = paid ? `Order ${esc(o.id)} is paid` : `Order request ${esc(o.id)} is in`, first = esc(unlink(String(o.name).split(" ")[0]));
  const next = o.method === "pickup" ? "We email you when it is ready to pick up." : o.ship_service === "Local delivery" ? "Our driver calls before coming." : "We email the tracking number when it ships.";
  // A pay-at-the-counter pickup is a request (2026-11-27): nothing is set aside until the shop has checked the shelf, so the
  // receipt never promises a hold. It says to wait for the "ready" email before coming in.
  const req = paid ? null : holdOf(o);
  const asked = ` This is an order request. We check the shelf and email you as soon as it is ready. Please wait for that email before you come in: nothing is set aside for you until then.${req ? ` A request we have not confirmed is cancelled after ${req.hours >= 48 && req.hours % 24 === 0 ? `${req.hours / 24} days` : `${req.hours} hours`} (${esc(req.until)}).` : ""}`;
  const intro = paid ? `Thank you, ${first}. Your payment went through. ${next}` : `Thank you, ${first}. You pay at the counter when you pick it up.${asked}`;
  const foot = "Questions? Reply to this email or call the counter at 519-255-2222.";
  return { kind: "order_placed", subject: paid ? `Receipt for your ${site} order ${o.id}` : `Your ${site} order ${o.id}`, html: frame(site, heading, intro, rows, foot), body: plain(heading, intro, rows, foot) };
}
export function orderShipped(site, o, items) {
  const heading = `Order ${esc(o.id)} is on its way`, intro = o.ship_service === "Local delivery" ? "It is out for delivery from our Windsor shop. The driver will call if they need you." : `It left the shop by ${esc(o.ship_service || "Canada Post")}.${o.tracking ? ` Tracking number: <b>${esc(o.tracking)}</b>.` : " The tracking number follows as soon as the carrier scans it."}`;
  const foot = "If anything arrives broken, bring it into the store at 760 Wyandotte St E and talk to the store manager.";
  return { kind: "order_shipped", subject: o.ship_service === "Local delivery" ? `Your ${site} order ${o.id} is out for delivery` : `Your ${site} order ${o.id} has shipped`, html: frame(site, heading, intro, lines(items), foot), body: plain(heading, intro, lines(items), foot) };
}
export function pickupReady(site, o, items) {
  const heading = `Order ${esc(o.id)} is ready`, intro = "We checked the shelf and set it aside for you. It is waiting at 760 Wyandotte St E, Windsor, ON N9A 3J4. Bring this order number.";
  const foot = "We hold pickup orders for 14 days. Call 519-255-2222 if you need longer.";
  return { kind: "pickup_ready", subject: `Your ${site} order ${o.id} is ready for pickup`, html: frame(site, heading, intro, lines(items), foot), body: plain(heading, intro, lines(items), foot) };
}
// To the shop (OWNER_EMAIL): a new order to get ready. Short, so it reads on a phone at the counter.
export function newOrder(site, o, items, how = "at_pickup") {
  const paid = how === "paid", hold = paid ? null : holdOf(o), way = o.method === "pickup" ? "Pickup at the counter" : o.ship_service === "Local delivery" ? "Local delivery" : `Shipping, ${esc(o.ship_service || "")}`;
  const a = (() => { try { return JSON.parse(o.address || "{}"); } catch { return {}; } })();
  const where = o.method === "ship" && a.line1 ? unlink([a.line1, a.city, a.province, a.postal].filter(Boolean).join(", ")) : "";
  // the figures the customer was shown, line for line, so the counter can answer "what did I pay for delivery" from the note
  const rows = [...lines(items), ["Items", money(o.subtotal_cents)], ...(o.reward_cents ? [["Points reward", "−" + money(o.reward_cents)]] : []),
    [way, o.method === "pickup" || !o.shipping_cents ? "Free" : money(o.shipping_cents)], [`Tax, ${esc(o.tax_province || "")}`, money(o.tax_cents)],
    ...(where ? [["Deliver to", esc(where)]] : []), ...(a.note ? [["Note", esc(unlink(a.note))]] : []), ...(paid ? [] : [["Status", "To confirm"]]), ...(hold ? [["Open until", `${esc(hold.until)}`]] : []),
    [paid ? "Paid by card" : "To pay at pickup", money(o.total_cents), true]];
  const say = e => `${e(unlink(o.name))}${o.phone ? `, ${e(o.phone)}` : ""}${o.email ? `, ${e(o.email)}` : ""}. ${paid ? "Paid by card. Open it in the back office to get it ready." : "Pays at the counter. To confirm: nothing is held yet. Check the shelf, then mark it ready in the back office: that takes the items off the stock count and emails the customer to come in. If the shelf cannot cover it, call the customer."}${hold ? ` Not marked ready within ${hold.hours >= 48 && hold.hours % 24 === 0 ? `${hold.hours / 24} days` : `${hold.hours} hours`}, the request cancels itself.` : ""}`;
  const heading = `New order ${esc(o.id)}`, intro = say(esc);
  return { kind: "new_order", customer: o.email, subject: `${site}: new order ${o.id}, ${money(o.total_cents)}, ${o.method === "pickup" ? "pickup" : o.ship_service === "Local delivery" ? "local delivery" : "ship"}${paid ? "" : ", pay at pickup, to confirm"}`, html: frame(site, heading, intro, rows, "Sent to the shop for every new order. Reply to reach the customer."), body: plain(`New order ${o.id}`, say(String), rows, "") };   // the plain text carries the name as typed (O'Brien, not O&#39;Brien)
}
export function lowStock(site, list) {
  const rows = list.map(p => [esc(p.name), p.stock <= 0 ? "Out" : `${p.stock} left`]);
  const heading = list.length === 1 ? `${esc(list[0].name)} is running low` : `${list.length} products are running low`, intro = "After the last order, these are at or under the level you asked to be warned at.";
  return { kind: "low_stock", subject: `${site}: stock running low`, html: frame(site, heading, intro, rows, "Change the warning level on each product in the back office."), body: plain(heading, intro, rows, "") };
}

// ---------- sending ----------
// Where the mail service lives. Tests point it at the local stand-in (tools/fake-resend.mjs); nothing else is accepted,
// so a typo can never send the mail key to a stranger.
function resendBase(env) {
  const b = String(env.RESEND_API_BASE || "https://api.resend.com").replace(/\/+$/, "");
  if (b === "https://api.resend.com" || /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(b)) return b;
  throw new Error("RESEND_API_BASE must be https://api.resend.com");
}
// A plain address the mail service will take: letters, digits and . _ % + - before the @, a dotted domain after it.
// Checkout takes looser addresses, so anything sent on (to, reply_to) is checked again here.
// RFC 5322 "dot-atom" on both sides (so o'brien@ and first&last@ pass), a real top-level domain (letters, or xn-- for an
// international one), no spaces, quotes, commas or angle brackets: nothing that could be read as a second address.
export const strictAddr = s => { const t = String(s ?? ""); return t.length <= 254 && !/\.\./.test(t) && /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:[A-Za-z]{2,24}|xn--[A-Za-z0-9-]{1,59})$/.test(t) && t.indexOf("@") <= 64; };
export const mailReady = env => !!(env.RESEND_API_KEY && env.EMAIL_FROM);
// Order, stock and account-alert emails are tried again; sign-in codes are not (a late code is no use): they are sent while
// the shopper waits, with no lease, so a stopped send never leaves a row waiting for a retry that will not come.
export const RETRY_KINDS = ["order_placed", "order_shipped", "pickup_ready", "low_stock", "new_order", "back_in_stock", "restock_reminder"];
const RETRIED = new Set(RETRY_KINDS);
// Tries: at once, then 10, 20 and 40 minutes later, then every hour, until a day after the email was written.
// Times are worked out in this unit; tests make it shorter (EMAIL_RETRY_UNIT_MS, only honoured against a local stand-in).
const unit = env => { const u = Number(env.EMAIL_RETRY_UNIT_MS); return u > 0 && /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}\/?$/.test(String(env.RESEND_API_BASE || "")) ? u : 60000; };
const WAIT = [10, 20, 40, 60], WINDOW = 24 * 60, LEASE_MS = 3 * 60000;   // a send that never reports back (the Worker stopped) is picked up after the lease
const iso = ms => new Date(ms).toISOString();
const atMs = s => Date.parse(String(s).endsWith("Z") ? s : s + "Z");
// When the next try is due after `tries` tries of an email written at `at`, or null once the day is used up.
function nextTry(env, at, tries) {
  const u = unit(env), due = Date.now() + WAIT[Math.min(tries - 1, WAIT.length - 1)] * u;
  return due <= atMs(at) + (WINDOW - 60) * u ? iso(due) : null;
}
// Who a reply goes to, fixed when the email is written: a customer's reply reaches the shop inbox (OWNER_EMAIL; EMAIL_FROM
// may be a sending-only address), and a reply to the shop's new-order note reaches the customer, if theirs is a plain address.
function replyTo(env, kind, to, customer) {
  if (kind === "new_order") return strictAddr(customer) ? customer : null;
  if (kind === "low_stock" || kind === "sign_in") return null;
  return strictAddr(env.OWNER_EMAIL) && env.OWNER_EMAIL !== to ? env.OWNER_EMAIL : null;
}
// One send. The row's own random key is the Idempotency-Key, and the payload (from, to, reply_to, words) is the one
// fixed on the row, so every try of the same email is the same request and the mail service delivers it at most once.
async function post(env, e) {
  try {
    const r = await fetch(resendBase(env) + "/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `oss-${e.send_key}` },
      body: JSON.stringify({ from: e.sent_from, to: [e.recipient], subject: e.subject, html: e.html, text: e.body, ...(e.reply_to ? { reply_to: e.reply_to } : {}) }), signal: AbortSignal.timeout(8000) });
    if (r.ok) return { ok: true };
    const why = (await r.json().catch(() => null))?.message;
    return { ok: false, detail: `mail service answered ${r.status}${why ? ": " + String(why).slice(0, 120) : ""}` };
  } catch (err) { return { ok: false, detail: String(err && err.message || err).slice(0, 120) }; }
}
// Try a row the caller has just claimed (tries = n, lease taken). The result is written only if the row is still that
// claim, so a slow try finishing late can never overwrite a later one, and a 'sent' row is never touched again.
async function attempt(env, e, n) {
  const r = await post(env, e), db = env.DB;
  const next = r.ok || !RETRIED.has(e.kind) ? null : nextTry(env, e.at, n);
  const detail = r.ok ? "" : !RETRIED.has(e.kind) ? `not sent: ${r.detail}` : next ? `try ${n}: ${r.detail}` : `gave up after ${n} tries in a day: ${r.detail}`;
  await db.prepare("UPDATE emails SET status = ?, detail = ?, next_try_at = ? WHERE id = ? AND tries = ? AND status != 'sent'").bind(r.ok ? "sent" : "failed", detail, next, e.id, n).run();
  if (!r.ok) console.error(JSON.stringify({ at: "email", problem: !RETRIED.has(e.kind) ? "not sent" : next ? "not sent, tried again later" : "not sent, gave up after a day: see the order in the back office", email: e.id, kind: e.kind, tries: n, detail: r.detail }));
  return r.ok;
}
const later = (env, p) => typeof env.waitUntil === "function" ? env.waitUntil(p) : p;

// Save it, then send it if a mail service is connected. Never throws: a mail problem must not undo an order.
// The row is written first, holding the first try's claim (tries 1, a lease), so if the Worker stops before the send
// reports back, retryEmails sends it after the lease. Order and stock emails send in the background (ctx.waitUntil, set
// by worker.js as env.waitUntil), so a shopper closing the page cannot cut them; a sign-in code is sent while they wait.
export async function writeEmail(env, orderId, to, mail) {
  try {
    const live = mailReady(env), ok = live && strictAddr(to), key = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
    const row = await env.DB.prepare(`INSERT INTO emails (order_id, kind, recipient, subject, html, body, send_key, sent_from, reply_to, tries, next_try_at, status, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id, at`)
      .bind(orderId, mail.kind, to, mail.subject, mail.html, mail.body, key, live ? env.EMAIL_FROM : null, replyTo(env, mail.kind, to, mail.customer), ok ? 1 : 0, ok && RETRIED.has(mail.kind) ? iso(Date.now() + LEASE_MS) : null,
        live && !ok ? "failed" : "held", live && !ok ? "not sent: the address is not one the mail service takes" : null).first()
      .catch(async err => {   // a database without migration 0011 yet: keep the email in the old columns and send it once, as before
        if (!/no such column|has no column/i.test(String(err && err.message))) throw err;
        console.error(JSON.stringify({ at: "email", problem: "migration 0011_email_retry.sql is not applied: sent once, no retries" }));
        const old = await env.DB.prepare("INSERT INTO emails (order_id, kind, recipient, subject, html, body) VALUES (?,?,?,?,?,?) RETURNING id").bind(orderId, mail.kind, to, mail.subject, mail.html, mail.body).first();
        if (live && !ok) await env.DB.prepare("UPDATE emails SET status = 'failed', detail = 'not sent: the address is not one the mail service takes' WHERE id = ?").bind(old.id).run();
        if (ok) {
          const r = await post(env, { recipient: to, subject: mail.subject, html: mail.html, body: mail.body, send_key: key, sent_from: env.EMAIL_FROM, reply_to: replyTo(env, mail.kind, to, mail.customer) });
          await env.DB.prepare("UPDATE emails SET status = ?, detail = ? WHERE id = ?").bind(r.ok ? "sent" : "failed", r.ok ? "" : `not sent: ${r.detail}`, old.id).run();
        }
        return null;
      });
    if (!ok || !row) return;
    const e = { id: row.id, at: row.at, kind: mail.kind, recipient: to, subject: mail.subject, html: mail.html, body: mail.body, send_key: key, sent_from: env.EMAIL_FROM, reply_to: replyTo(env, mail.kind, to, mail.customer) };
    const go = attempt(env, e, 1).catch(err => console.error(JSON.stringify({ at: "email", message: String(err && err.message || err) })));
    if (RETRIED.has(mail.kind)) later(env, go); else await go;
  } catch (err) { console.error(JSON.stringify({ at: "email", message: String(err && err.message || err) })); }
}
const claim = (db, e, n, env) => db.prepare("UPDATE emails SET tries = ?1, next_try_at = ?2, sent_from = COALESCE(sent_from, ?3), send_key = COALESCE(send_key, ?4) WHERE id = ?5 AND tries = ?6 AND status IN ('held','failed') AND next_try_at IS NOT NULL AND next_try_at <= ?7")
  .bind(n, iso(Date.now() + LEASE_MS), env.EMAIL_FROM, e.send_key, e.id, n - 1, iso(Date.now())).run();
// Every 10 minutes (worker.js scheduled): order and stock emails whose next try is due, and any whose first send never
// reported back (lease run out). A row is taken only by the run that moves its try count on, so two runs never both send it.
export async function retryEmails(env) {
  if (!mailReady(env)) return { tried: 0, sent: 0 };
  const db = env.DB, now = iso(Date.now());
  const list = (await db.prepare(`SELECT id, at, kind, recipient, subject, html, body, send_key, sent_from, reply_to, tries FROM emails
    WHERE status IN ('held','failed') AND next_try_at IS NOT NULL AND next_try_at <= ? AND kind IN (${RETRY_KINDS.map(() => "?").join(",")}) ORDER BY next_try_at LIMIT 25`).bind(now, ...RETRY_KINDS).all()).results;
  let tried = 0, sent = 0;
  for (const e of list) {
    const n = e.tries + 1;
    if (!strictAddr(e.recipient)) { await db.prepare("UPDATE emails SET status = 'failed', next_try_at = NULL, detail = 'not sent: the address is not one the mail service takes' WHERE id = ? AND tries = ?").bind(e.id, e.tries).run(); continue; }
    // a try booked inside the day is still made even if this run is a little late; only a row stranded well past it is closed
    if (atMs(e.at) + WINDOW * unit(env) < Date.now()) { await db.prepare("UPDATE emails SET status = 'failed', next_try_at = NULL, detail = 'gave up after ' || tries || ' tries in a day' WHERE id = ? AND tries = ?").bind(e.id, e.tries).run(); continue; }
    e.send_key ||= [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
    if (!(await claim(db, e, n, env)).meta.changes) continue;
    e.sent_from ||= env.EMAIL_FROM;
    tried++; if (await attempt(env, e, n)) sent++;
  }
  return { tried, sent };
}
// The back office's "Send again" on an email that gave up (owner only, logged by admin.js): one more try now, with the
// same key and words. Answers the new state.
export async function resendEmail(env, id) {
  if (!(await env.DB.prepare("SELECT next_try_at FROM emails LIMIT 0").all().then(() => true, () => false))) return { error: "Apply migration 0011_email_retry.sql first.", status: 503 };
  const db = env.DB, e = await db.prepare("SELECT id, order_id, at, kind, recipient, subject, html, body, send_key, sent_from, reply_to, tries, status, next_try_at FROM emails WHERE id = ?").bind(id).first();
  if (!e || !RETRIED.has(e.kind) || !e.order_id) return { error: "No such order email.", status: 404 };   // a customer's account mail is theirs, never the back office's
  if (!mailReady(env)) return { error: "The mail service is not connected.", status: 503 };
  if (e.status === "sent") return { error: "This email was already sent.", status: 409 };
  if (e.status !== "failed") return { error: "Only an email that could not be sent can be sent again.", status: 409 };   // held = written before mail was connected: never sent late
  if (e.next_try_at) return { error: "This email is still being tried. Wait for it to finish.", status: 409 };
  if (!strictAddr(e.recipient)) return { error: "This address is not one the mail service takes. Phone the customer instead.", status: 409 };
  e.send_key ||= [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
  const n = e.tries + 1;
  const took = await db.prepare("UPDATE emails SET tries = ?1, next_try_at = ?2, sent_from = COALESCE(sent_from, ?3), send_key = COALESCE(send_key, ?4), detail = 'sending again' WHERE id = ?5 AND tries = ?6 AND status IN ('held','failed') AND next_try_at IS NULL")
    .bind(n, iso(Date.now() + LEASE_MS), env.EMAIL_FROM, e.send_key, e.id, e.tries).run();
  if (!took.meta.changes) return { error: "This email changed. Refresh and look again.", status: 409 };
  e.sent_from ||= env.EMAIL_FROM;
  const ok = await post(env, e);
  await db.prepare("UPDATE emails SET status = ?, detail = ?, next_try_at = NULL WHERE id = ? AND tries = ? AND status != 'sent'").bind(ok.ok ? "sent" : "failed", ok.ok ? "" : `gave up, sent again by hand and refused: ${ok.detail}`, e.id, n).run();
  return ok.ok ? { ok: true, status: 200, email: { status: "sent" } } : { error: `It did not go out: ${ok.detail}`, status: 502 };
}
