// The customer side: sign in with an emailed code, the account page (the usual label, orders, saved items, alerts,
// the charcoal reminder, details), and the small pieces it adds to other pages (Save and alerts on a product,
// prefill and points at checkout, points on the confirmation). Guest checkout never needs any of it.
// Design: store/docs/ACCOUNTS-LOYALTY.md. Idea: THE COUNTER REMEMBERS YOU. Device: THE USUAL LABEL.
import { PRODUCTS } from "/api/catalog-module";
import { navigate } from "./route.js";

const bySku = Object.assign(Object.create(null), Object.fromEntries(PRODUCTS.map(p => [p.sku, p])));
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = iso => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric", timeZone: "America/Toronto" });
const sess = { get(k) { try { return JSON.parse(sessionStorage.getItem("oss:" + k)); } catch { return null; } }, set(k, v) { try { v === null ? sessionStorage.removeItem("oss:" + k) : sessionStorage.setItem("oss:" + k, JSON.stringify(v)); } catch {} } };
const WORD = { pending: "Going through", paid: "Received", packed: "Packed", shipped: "On its way", ready: "Ready for pickup", collected: "Picked up", cancelled: "Cancelled", refunded: "Refunded" };
const DONE = new Set(["shipped", "collected"]);

// ---------- talking to the shop ----------
let me = null, meWait = null, orders = null;
const call = async (path, body, method = "POST") => {
  try { const r = await fetch("/api/account" + path, { method, headers: { "Content-Type": "application/json", "X-OSS-Account": "1" }, body: method === "GET" ? undefined : JSON.stringify(body || {}) }); return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }; }
  catch { return { ok: false, status: 0, data: { error: "We could not reach the shop. Check your connection and try again." } }; }
};
export function loadMe(force) {
  if (!force && meWait) return meWait;
  meWait = fetch("/api/account/me", { headers: { Accept: "application/json" } }).then(r => r.json()).catch(() => ({ signed_in: false, loyalty: { on: false }, offline: true }))
    .then(d => { me = d; chrome(); dispatchEvent(new Event("oss:account")); return d; });
  return meWait;
}
const signedIn = () => !!(me && me.signed_in);
function chrome() { $$("[data-account-link]").forEach(a => { a.textContent = signedIn() ? "Account" : "Sign in"; }); }

// ---------- points at checkout (read by app.js) ----------
const choice = { reward: sess.get("use-reward") !== false };
const L = () => (me && me.loyalty && me.loyalty.on ? me.loyalty : null);
export const rewardCents = subCents => { const l = L(); return signedIn() && l && l.can_redeem && choice.reward && subCents > 0 ? Math.min(l.reward_cents, subCents) : 0; };
export const rewardFlag = () => (rewardCents(1) ? "reward" : "");
export const rewardRow = cents => cents ? `<div class="totals__reward"><dt>Points reward</dt><dd class="num">&minus;${money(cents)}</dd></div>` : "";
export function rewardGone() { choice.reward = false; sess.set("use-reward", false); loadMe(true); }

// ---------- the usual label: the device ----------
// Ten holes, each a tenth of the reward. Counted points are punched through; points on their way are dashed.
// With a reward ready, the row shows the next card, so progress never hides behind a full row.
// The newest hole presses in only when the count grew since this device last saw it.
function punches(l, press = false) {
  const per = l.reward_points / 10, have = Math.max(0, l.points) - (l.can_redeem ? l.reward_points : 0);
  const full = Math.min(10, Math.floor(have / per)), coming = Math.min(10 - full, Math.ceil(l.coming / per));
  let fresh = false;
  if (press) { let seen = null; try { seen = JSON.parse(localStorage.getItem("oss:punches")); } catch {} fresh = typeof seen === "number" && full > seen; try { localStorage.setItem("oss:punches", JSON.stringify(full)); } catch {} }
  return `<ol class="punch" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<li class="punch__h${i < full ? " is-in" : i < full + coming ? " is-coming" : ""}${fresh && i === full - 1 ? " is-new" : ""}"></li>`).join("")}</ol>`;
}
function pointsWords(l) {
  const left = Math.max(0, l.reward_points - l.points);
  return `${l.can_redeem ? `<p class="label__big">You have a ${money(l.reward_cents)} reward.</p><p class="label__p">It comes off your next order at checkout.</p>`
    : `<p class="label__big"><span class="num">${Math.max(0, l.points)}</span> of <span class="num">${l.reward_points}</span> points</p><p class="label__p"><span class="num">${left}</span> more for ${money(l.reward_cents)} off.</p>`}
    ${l.coming ? `<p class="label__p"><span class="num">${l.coming}</span> on the way. They count once your order is picked up or shipped.</p>` : ""}`;
}
function usualLabel(o) {
  const l = L();
  const items = o ? o.items : [], can = items.filter(i => bySku[i.sku] && bySku[i.sku].stock !== 0), gone = items.length - can.length;
  return `<article class="label" aria-labelledby="usual-h">
    <header class="label__band"><span>ONE STOP</span><span>${o ? "Your usual" : "Your card"}</span></header>
    <div class="label__body">
      ${o ? `<h2 class="label__h" id="usual-h">Your last order, ${esc(day(o.created_at))}</h2>
        <ul class="label__items">${items.map(i => `<li><span class="num">${i.qty}</span> <span>${esc(i.name)}</span>${bySku[i.sku] && bySku[i.sku].stock !== 0 ? "" : ` <span class="label__gone">sold out</span>`}</li>`).join("")}</ul>
        <p class="label__total"><span>Total</span> <b class="num">${money(o.total_cents)}</b></p>
        ${can.length ? `<button class="btn btn--wide" type="button" data-again="${esc(o.id)}">${gone ? `Add the ${can.length} ${can.length === 1 ? "item" : "items"} still in stock` : "Buy again"}</button>` : `<p class="label__p">Everything in it has sold out. <a class="link" href="/shop">See what is on the counter</a>.</p>`}`
      : `<h2 class="label__h" id="usual-h">Nothing here yet</h2><p class="label__p">Your first order lands on this label, ready to buy again in one tap.</p><a class="btn btn--wide" href="/shop/charcoal">Shop charcoal</a>`}
      ${l ? `<div class="label__pts" aria-label="Points">${punches(l, true)}${pointsWords(l)}<p class="label__fine">${l.points_per_dollar === 1 ? "1 point" : `${l.points_per_dollar} points`} for every dollar of items. Points never expire.</p></div>` : ""}
    </div>
  </article>`;
}

// ---------- the account page ----------
export const accountView = band => `${band("docs", "gilt", "Your account", "")}<section class="acct" data-acct aria-busy="true"><p class="fine" role="status">Opening your account.</p></section>`;
const next = () => { const n = new URLSearchParams(location.search).get("next"); return n && /^\/(?!\/)[\w\-/]*$/.test(n) ? n : null; };
function signInForm(err = "") {
  const sent = sess.get("code-to"), wantEmail = sess.get("sign-in-email") || "";
  return `<div class="acct__in">
    <h2 class="h3">Sign in, or make an account</h2>
    <p class="acct__lead">No password. We email you a 6-digit code. Your orders, saved items and reminders are kept here.</p>
    <form class="acct__form" data-code-form novalidate ${sent ? "hidden" : ""}>
      <label class="field__label" for="acct-email">Email</label>
      <input class="field field--text" id="acct-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="120" required value="${esc(wantEmail)}">
      <button class="btn btn--wide" type="submit">Email me a code</button>
    </form>
    <form class="acct__form" data-verify-form novalidate ${sent ? "" : "hidden"}>
      <p class="acct__sent" role="status">We sent a code to <b>${esc(sent || "")}</b>. It works for 10 minutes.</p>
      <label class="field__label" for="acct-code">6-digit code</label>
      <input class="field field--code num" id="acct-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" pattern="[0-9 ]*" required>
      <button class="btn btn--wide" type="submit">Sign in</button>
      <p class="acct__row"><button class="link" type="button" data-resend>Send a new code</button><button class="link" type="button" data-other-email>Use a different email</button></p>
    </form>
    <p class="field__err" role="alert" data-acct-err ${err ? "" : "hidden"}>${esc(err)}</p>
    <p class="fine">You never need an account to buy. Guest checkout always works.</p>
  </div>`;
}
// The link says whose account it opens before it is used, so nobody can sign you into theirs unawares.
const linkPanel = email => `<div class="acct__in"><h2 class="h3">Finish signing in</h2><p class="acct__lead">This link signs you in as <b>${esc(email)}</b>. Only carry on if that is your email.</p>
  <button class="btn btn--wide" type="button" data-use-link>Sign in as ${esc(email)}</button><p class="acct__row"><button class="link" type="button" data-other-email>That is not me</button></p><p class="field__err" role="alert" data-acct-err hidden></p></div>`;
const stopPanel = () => `<div class="acct__in"><h2 class="h3">Unsubscribe</h2><p class="acct__lead">Stop charcoal reminders and back-in-stock emails from us. Order emails still come.</p>
  <button class="btn btn--wide" type="button" data-stop>Unsubscribe</button><p class="field__err" role="alert" data-acct-err hidden></p></div>`;

function orderRow(o) {
  const can = o.items.filter(i => bySku[i.sku] && bySku[i.sku].stock !== 0).length, n = o.items.reduce((a, i) => a + i.qty, 0);
  return `<li class="ord">
    <p class="ord__when num">${esc(day(o.created_at))}</p>
    <div class="ord__what"><ul class="ord__items">${o.items.map(i => `<li><b class="num">${i.qty} &times;</b> ${esc(i.name)}</li>`).join("")}</ul>
      <p class="ord__meta"><span class="ord__status${DONE.has(o.status) ? " is-done" : ""}">${WORD[o.status] || esc(o.status)}</span> <span class="num">${esc(o.id)}</span> <span class="num">${n} ${n === 1 ? "item" : "items"}</span>${o.points && o.points.earn && L() ? ` <span class="num">${o.points.earn} pts</span>` : ""}</p></div>
    <p class="ord__total num">${money(o.total_cents)}</p>
    ${can ? `<button class="btn btn--ghost ord__again" type="button" data-again="${esc(o.id)}">Buy again</button>` : `<span class="ord__again ord__none">Sold out</span>`}
  </li>`;
}
function savedList(skus, alerts) {
  const list = skus.map(s => bySku[s]).filter(Boolean);
  if (!list.length) return `<p class="acct__empty">Nothing saved yet. Tap <b>Save</b> on any product to keep it here.</p>`;
  return `<ul class="saved">${list.map(p => `<li class="saved__i"><a class="saved__name" href="/p/${p.sku}">${esc(p.name)}</a><span class="saved__price num">${money(Math.round(p.price * 100))}</span>
    ${p.stock === 0 ? `<span class="saved__st">${alerts.includes(p.sku) ? "Sold out. We will email you" : "Sold out"}</span>` : `<button class="link" type="button" data-add-one="${p.sku}">Add to cart</button>`}
    <button class="link saved__x" type="button" data-unsave="${p.sku}" aria-label="Remove ${esc(p.name)} from saved">Remove</button></li>`).join("")}</ul>`;
}
function alertList(skus) {
  const list = skus.map(s => bySku[s]).filter(Boolean);
  return list.length ? `<ul class="saved">${list.map(p => `<li class="saved__i"><a class="saved__name" href="/p/${p.sku}">${esc(p.name)}</a><span class="saved__st">We email you once when it is back</span><button class="link saved__x" type="button" data-unalert="${p.sku}" aria-label="Stop waiting for ${esc(p.name)}">Remove</button></li>`).join("")}</ul>`
    : `<p class="acct__empty">None. On a sold-out product, tap <b>Email me when it is back</b>.</p>`;
}
function reminderBox(r) {
  if (r.days) return `<p class="acct__p">On: a reminder every <b class="num">${r.days}</b> days after your last charcoal order. <button class="link" type="button" data-remind-off>Turn off</button></p>`;
  return `<form class="acct__form" data-remind-form novalidate>
    <label class="field__label" for="acct-days">How often</label>
    <select class="field" id="acct-days" name="days">${[[14, "Every 2 weeks"], [21, "Every 3 weeks"], [30, "Every 4 weeks"], [45, "Every 6 weeks"], [60, "Every 8 weeks"]].map(([v, t]) => `<option value="${v}"${v === 21 ? " selected" : ""}>${t}</option>`).join("")}</select>
    <label class="check"><input type="checkbox" name="consent" required> <span>${esc(r.words)}</span></label>
    <button class="btn btn--ghost" type="submit">Turn on reminders</button>
    <p class="field__err" role="alert" data-remind-err hidden></p>
  </form>`;
}
function detailsForm(c) {
  const a = c.address || {}, f = (id, label, val, attrs, hint = "") => `<label class="field__label" for="acct-${id}">${label}${hint ? ` <span class="fine">${hint}</span>` : ""}</label><input class="field field--text" id="acct-${id}" name="${id}" value="${esc(val || "")}" ${attrs}>`;
  return `<form class="acct__form" data-details-form novalidate>
    ${f("name", "Full name", c.name, 'autocomplete="name" maxlength="80"')}
    ${f("phone", "Phone", c.phone, 'type="tel" autocomplete="tel" inputmode="tel" maxlength="30"', "for local delivery")}
    ${f("line1", "Street address", a.line1, 'autocomplete="address-line1" maxlength="120"')}
    ${f("city", "City or town", a.city, 'autocomplete="address-level2" maxlength="60"')}
    ${f("postal", "Postal code", a.postal, 'autocomplete="postal-code" maxlength="7" spellcheck="false"')}
    <button class="btn btn--ghost" type="submit">Save details</button>
    <p class="acct__p" role="status" data-details-msg></p>
  </form>`;
}
function accountBody() {
  const m = me, c = m.customer, last = orders && orders[0];
  return `<div class="acct__rail"><p class="acct__who">Signed in as <b>${esc(c.email)}</b></p>
    ${usualLabel(last)}</div><div class="acct__main">
    <section class="acct__sec" aria-labelledby="ord-h"><h2 class="h3" id="ord-h">Orders</h2>
      ${orders && orders.length ? `<ol class="ords">${orders.map(orderRow).join("")}</ol>` : `<p class="acct__empty">No orders yet. Orders you place while signed in, and earlier ones with this email, show here.</p>`}</section>
    <section class="acct__sec" aria-labelledby="sav-h"><h2 class="h3" id="sav-h">Saved</h2>${savedList(m.favourites, m.alerts)}</section>
    <section class="acct__sec" aria-labelledby="al-h"><h2 class="h3" id="al-h">Back-in-stock emails</h2>${alertList(m.alerts)}</section>
    <section class="acct__sec" aria-labelledby="rm-h"><h2 class="h3" id="rm-h">Charcoal reminder</h2>
      <p class="acct__p">An email when it is time to restock, if you want one. Off unless you turn it on.</p>${reminderBox(m.reminder)}</section>
    <section class="acct__sec" aria-labelledby="dt-h"><h2 class="h3" id="dt-h">Your details</h2><p class="acct__p">Filled in for you at checkout.</p>${detailsForm(c)}</section>
    <section class="acct__sec" aria-labelledby="out-h"><h2 class="h3" id="out-h">Signing in</h2>
      <p class="acct__row"><button class="btn btn--ghost" type="button" data-sign-out>Sign out</button><button class="link" type="button" data-sign-out-all>Sign out on every device</button></p>
      <details class="acct__del"><summary>Delete my account</summary>
        <p class="acct__p">This removes your sign-in, saved details, saved items, alerts, reminder and points. Your past orders stay in the shop's sales records, which tax law says we keep for six years. It cannot be undone.</p>
        <button class="btn btn--ghost btn--danger" type="button" data-delete>Delete my account</button></details></section></div>`;
}
async function drawAccount() {
  const root = $("[data-acct]"); if (!root) return;
  const hash = new URLSearchParams(location.hash.slice(1)), link = hash.get("signin"), stop = new URLSearchParams(location.search).get("stop");
  if (link && /^[a-f0-9]{64}$/.test(link)) { sess.set("link", link); history.replaceState(history.state, "", location.pathname + location.search); }   // off the address bar at once
  if (stop && /^[a-f0-9]{48}$/.test(stop)) { sess.set("stop", stop); history.replaceState(history.state, "", location.pathname); }
  await loadMe();
  if (!$("[data-acct]")) return;   // they moved on while it loaded
  if (sess.get("stop")) { fill(stopPanel()); return; }
  if (!signedIn() && sess.get("link")) {
    const r = await call("/peek", { link: sess.get("link") }); if (!$("[data-acct]")) return;
    if (r.ok) { fill(linkPanel(r.data.email)); return; }
    sess.set("link", null); fill(signInForm(r.data.error)); return;
  }
  if (!signedIn()) { fill(signInForm()); const e = $("#acct-email"); if (e && !e.value) e.focus({ preventScroll: true }); return; }
  sess.set("link", null);
  if (orders === null) { const r = await call("/orders", undefined, "GET").catch(() => null); orders = r && r.ok ? r.data.orders : []; }
  if (!$("[data-acct]")) return;
  fill(accountBody());
}
function fill(html) { const root = $("[data-acct]"); if (!root) return; root.innerHTML = html; root.removeAttribute("aria-busy"); root.classList.toggle("acct--two", !!root.querySelector(".acct__rail")); }
const err = (msg, sel = "[data-acct-err]") => { const e = $(sel); if (e) { e.textContent = msg; e.hidden = !msg; } };
async function signedInNow(d) {
  me = d.me; orders = null; sess.set("code-to", null); sess.set("link", null); chrome(); dispatchEvent(new Event("oss:account"));
  const want = sess.get("want"); sess.set("want", null);
  if (want && bySku[want.sku]) await call(want.kind === "alert" ? "/alerts" : "/favourites", { sku: want.sku, on: true });
  const go = next(); if (go) { loadMe(true); navigate(go, true); return; }
  drawAccount();
}

// ---------- buy again: into the cart app.js keeps, then the cart ----------
function buyAgain(id) {
  const o = (orders || []).find(x => x.id === id); if (!o) return;
  let cart = []; try { cart = JSON.parse(localStorage.getItem("oss:cart")) || []; } catch {}
  if (!Array.isArray(cart)) cart = [];
  for (const i of o.items) {
    const p = bySku[i.sku]; if (!p || p.stock === 0) continue;
    const l = cart.find(x => x && x.sku === i.sku); if (l) l.qty += i.qty; else cart.push({ sku: i.sku, qty: i.qty });
  }
  const left = o.items.filter(i => !bySku[i.sku] || bySku[i.sku].stock === 0).map(i => i.name);
  try { localStorage.setItem("oss:cart", JSON.stringify(cart)); if (o.method === "pickup") localStorage.setItem("oss:ship", JSON.stringify("pickup")); } catch {}   // the counter remembers how you collect
  dispatchEvent(new CustomEvent("oss:cart", { detail: { news: [`Your usual is in your cart.${left.length ? ` ${left.join(", ")} ${left.length === 1 ? "has" : "have"} sold out, so we left ${left.length === 1 ? "it" : "them"} off.` : ""}`] } }));   // app.js reads it back, holds each line to the stock left and says what changed
  navigate("/cart");
}

// ---------- taps and forms ----------
document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.matches("[data-code-form]")) {
    e.preventDefault(); const email = f.email.value.trim(), b = f.querySelector("button");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err("That email address does not look right."); f.email.focus(); return; }
    b.disabled = true; b.textContent = "Sending your code";
    const r = await call("/code", { email }); b.disabled = false; b.textContent = "Email me a code";
    if (!r.ok) { err(r.data.error || "That did not go through. Try again."); return; }
    sess.set("code-to", email); sess.set("sign-in-email", email); drawAccount().then(() => { const c = $("#acct-code"); if (c) c.focus(); });
  }
  if (f.matches("[data-verify-form]")) {
    e.preventDefault(); const code = f.code.value.replace(/\s+/g, ""), b = f.querySelector('button[type="submit"]');
    if (!/^\d{6}$/.test(code)) { err("Enter the 6 numbers from the email."); f.code.focus(); return; }
    b.disabled = true; b.textContent = "Signing in";
    const r = await call("/verify", { email: sess.get("code-to"), code }); b.disabled = false; b.textContent = "Sign in";
    if (!r.ok) { err(r.data.error || "That did not go through. Try again."); f.code.select(); return; }
    signedInNow(r.data);
  }
  if (f.matches("[data-details-form]")) {
    e.preventDefault(); const v = n => f.elements[n].value, msg = $("[data-details-msg]");
    const r = await call("/details", { name: v("name"), phone: v("phone"), address: { line1: v("line1"), city: v("city"), postal: v("postal") } }, "PUT");
    if (!r.ok) { msg.textContent = r.data.error || "That did not save."; const el = r.data.field && f.elements[r.data.field]; if (el) el.focus(); return; }
    me = r.data.me; f.elements.postal.value = me.customer.address.postal || ""; msg.textContent = "Saved.";
  }
  if (f.matches("[data-remind-form]")) {
    e.preventDefault();
    if (!f.consent.checked) { err("Tick the box to say yes to these emails.", "[data-remind-err]"); f.consent.focus(); return; }
    const r = await call("/reminder", { days: +f.days.value, consent: true }, "PUT");
    if (!r.ok) { err(r.data.error || "That did not save.", "[data-remind-err]"); return; }
    me.reminder = r.data.reminder; drawAccount();
  }
});
document.addEventListener("click", async e => {
  const t = e.target.closest("button, a"); if (!t) return;
  if (t.matches("[data-again]")) { buyAgain(t.dataset.again); return; }
  if (t.matches("[data-resend]")) { sess.set("code-to", null); const email = sess.get("sign-in-email"); const r = await call("/code", { email }); if (!r.ok) { sess.set("code-to", email); err(r.data.error); return; } sess.set("code-to", email); drawAccount().then(() => err("A new code is on its way. The old one no longer works.")); return; }
  if (t.matches("[data-other-email]")) { sess.set("code-to", null); sess.set("sign-in-email", null); sess.set("link", null); drawAccount(); return; }
  if (t.matches("[data-use-link]")) { t.disabled = true; const r = await call("/verify", { link: sess.get("link") }); sess.set("link", null); if (!r.ok) { fill(signInForm(r.data.error)); return; } signedInNow(r.data); return; }
  if (t.matches("[data-stop]")) { t.disabled = true; const r = await call("/unsubscribe", { token: sess.get("stop") }); sess.set("stop", null); fill(r.ok ? `<div class="acct__in"><h2 class="h3">Unsubscribed</h2><p class="acct__lead">You will get no more reminders or back-in-stock emails. Order emails still come.</p><a class="btn btn--ghost" href="/shop">Back to the shop</a></div>` : stopPanel()); if (!r.ok) err(r.data.error); return; }
  if (t.matches("[data-remind-off]")) { const r = await call("/reminder", { days: null }, "PUT"); if (r.ok) { me.reminder = { days: null }; drawAccount(); } return; }
  if (t.matches("[data-unsave], [data-unalert]")) { const fav = t.matches("[data-unsave]"), sku = t.dataset.unsave || t.dataset.unalert; const r = await call(fav ? "/favourites" : "/alerts", { sku, on: false }); if (r.ok) { me[fav ? "favourites" : "alerts"] = me[fav ? "favourites" : "alerts"].filter(s => s !== sku); drawAccount(); } return; }
  if (t.matches("[data-add-one]")) { const sku = t.dataset.addOne; let cart = []; try { cart = JSON.parse(localStorage.getItem("oss:cart")) || []; } catch {} const l = cart.find(x => x && x.sku === sku); if (l) l.qty += 1; else cart.push({ sku, qty: 1 }); try { localStorage.setItem("oss:cart", JSON.stringify(cart)); } catch {} dispatchEvent(new Event("oss:cart")); t.outerHTML = `<a class="link" href="/cart">In your cart</a>`; return; }
  if (t.matches("[data-sign-out], [data-sign-out-all]")) { await call("/sign-out", { everywhere: t.matches("[data-sign-out-all]") }); me = { signed_in: false, loyalty: { on: !!L() } }; orders = null; chrome(); dispatchEvent(new Event("oss:account")); drawAccount(); return; }
  if (t.matches("[data-delete]")) {
    if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Yes, delete my account"; t.insertAdjacentHTML("beforebegin", `<p class="acct__p" role="alert">Tap again to delete it for good.</p>`); return; }
    const r = await call("/delete", { confirm: "delete" }); if (!r.ok) return;
    me = { signed_in: false, loyalty: { on: false } }; orders = null; chrome(); dispatchEvent(new Event("oss:account"));
    fill(`<div class="acct__in"><h2 class="h3">Your account is deleted</h2><p class="acct__lead">Everything tied to it is gone. You can still shop as a guest any time.</p><a class="btn btn--ghost" href="/shop">Back to the shop</a></div>`); return;
  }
  if (t.matches("[data-keep]")) {   // Save, or Email me when it is back, on a product page
    const kind = t.dataset.keep, sku = t.dataset.sku, on = t.getAttribute("aria-pressed") !== "true";
    if (!signedIn()) { sess.set("want", { kind, sku }); navigate(`/account?next=${encodeURIComponent("/p/" + sku)}`); return; }
    t.setAttribute("aria-pressed", String(on)); keepWords(t);   // instant: this is a frequent control
    const r = await call(kind === "alert" ? "/alerts" : "/favourites", { sku, on });
    if (!r.ok) { t.setAttribute("aria-pressed", String(!on)); keepWords(t); return; }
    const list = kind === "alert" ? "alerts" : "favourites"; me[list] = on ? [sku, ...me[list].filter(s => s !== sku)] : me[list].filter(s => s !== sku);
  }
});
document.addEventListener("change", e => { if (e.target.matches("[data-use-reward]")) { choice.reward = e.target.checked; sess.set("use-reward", choice.reward); dispatchEvent(new Event("oss:totals")); } });
function keepWords(b) { const on = b.getAttribute("aria-pressed") === "true"; b.textContent = b.dataset.keep === "alert" ? (on ? "We will email you when it is back" : "Email me when it is back") : (on ? "Saved" : "Save"); }

// ---------- pieces on other pages ----------
function productKeep(sku) {
  const p = bySku[sku], info = $(".pdp__info"); if (!p || !info || $(".keep", info)) return;
  const at = $(".pdp__info > .btn", info) || $(".pdp__info > .soldline", info); if (!at) return;
  const fav = signedIn() && me.favourites.includes(sku), al = signedIn() && me.alerts.includes(sku);
  at.insertAdjacentHTML("afterend", `<div class="keep"><button class="keep__b" type="button" data-keep="fav" data-sku="${sku}" aria-pressed="${fav}"></button>${p.stock === 0 && p.state === "sale" ? `<button class="keep__b" type="button" data-keep="alert" data-sku="${sku}" aria-pressed="${al}"></button>` : ""}</div>`);
  $$(".keep [data-keep]", info).forEach(keepWords);
}
const earnNow = l => { let cart = []; try { cart = JSON.parse(localStorage.getItem("oss:cart")) || []; } catch {} const sub = cart.reduce((a, x) => a + (bySku[x.sku] ? Math.round(bySku[x.sku].price * 100) * x.qty : 0), 0); return Math.floor(Math.max(0, sub - rewardCents(sub)) / 100) * l.points_per_dollar; };
function checkoutBits() {
  const f = $("[data-checkout]"); if (!f) return;
  const l = L(), box = $("[data-acct-co]", f);
  const html = signedIn() ? (l ? `${l.can_redeem ? `<label class="check co__reward"><input type="checkbox" data-use-reward ${choice.reward ? "checked" : ""}> <span>Use my ${money(l.reward_cents)} points reward</span></label>` : ""}<div class="co__pts">${punches(l)}<p>This order earns <b class="num">${earnNow(l)}</b> points, counted once it is picked up or delivered. <a class="link" href="/account">Your card</a></p></div>` : "")
    : `<p class="co__p co__acct"><a class="link" href="/account?next=%2Fcheckout">Sign in</a> to fill this in for you${l ? " and collect points" : ""}. Or just carry on as a guest.</p>`;
  if (box) box.innerHTML = html; else { const t = $(".totals", f); if (t) t.insertAdjacentHTML("beforebegin", `<div data-acct-co>${html}</div>`); }
  if (!signedIn()) return;
  const c = me.customer, a = c.address || {}; let postal = null; try { postal = JSON.parse(localStorage.getItem("oss:postal")); } catch {}
  const put = (n, v) => { const el = f.elements[n]; if (el && !el.value && v) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); } };
  put("name", c.name); put("email", c.email); put("phone", c.phone);
  if (a.postal && postal && a.postal === postal) { put("line1", a.line1); put("city", a.city); }   // only for the same postal code as this order
}
function orderBits(id) {
  const box = $(".done"); if (!box || $("[data-acct-done]", box)) return;
  let o = null; try { o = JSON.parse(sessionStorage.getItem("oss:order:" + id)); } catch {}
  if (!o) return;
  const l = L(), at = $(".done__lines", box); if (!at) return;
  const html = o.account ? (l && o.points ? `<div class="co__pts" data-acct-done>${punches(l)}<p><b class="num">${o.points}</b> points on the way. They count once the order is ${o.method === "pickup" ? "picked up" : "delivered"}.</p></div>` : `<p class="fine" data-acct-done>This order is in <a class="link" href="/account">your account</a>, ready to buy again.</p>`)
    : `<p class="fine" data-acct-done>Next time in one tap: <a class="link" href="/account" data-sign-in-as="${esc(o.email || "")}">sign in with this email</a> and this order will be in your account.</p>`;
  at.insertAdjacentHTML("afterend", html);
}
document.addEventListener("click", e => { const a = e.target.closest("[data-sign-in-as]"); if (a) sess.set("sign-in-email", a.dataset.signInAs); }, true);

// app.js calls this after every page it draws
export function afterRender(a, b) {
  if (a === "account") { drawAccount(); return; }
  if (a === "order") { orders = null; choice.reward = true; sess.set("use-reward", null); }   // an order just went through: points and the reward are read fresh
  loadMe(a === "order").then(() => {
    const now = location.pathname.split("/").filter(Boolean);
    if (now[0] !== a || (now[1] || undefined) !== b) return;   // a later page took over
    if (a === "p") productKeep(b);
    if (a === "checkout") checkoutBits();
    if (a === "order") orderBits(b);
  });
}
addEventListener("oss:account", () => { if (location.pathname === "/checkout") checkoutBits(); });
addEventListener("oss:totals", () => { const b = $("[data-acct-co] .co__pts b.num"), l = L(); if (b && l) b.textContent = earnNow(l); });   // the points this order earns follow the reward switch
loadMe();
