# One-off edit (kept as history): shares the shipping maths between the store pages and the server, adds tax by
# province, the checkout and order-confirmation pages, and the order route. Run from store/: python tools/step-checkout.py
import os
def edit(path, pairs, append=''):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s + append)

# 1. shipping maths: one core module with no page-only import, used by both sides
s = open('public/rates.js', encoding='utf8').read()
a = 'import { BOXES } from "/api/catalog-module";\n'
assert s.count(a) == 1
core = s.replace(a, '// Shared by the store pages and the server. The box sizes are handed in, so this file imports nothing page-only.\nlet BOXES = {};\nexport function useBoxes(b) { BOXES = b; }\n')
core += '''
// Sales tax by the province the parcel goes to (pickup is Ontario). GST/HST only: provincial sales tax in BC,
// Saskatchewan, Manitoba and Quebec is charged once the shop is registered there.
const HST = { ON: 0.13, NB: 0.15, NL: 0.15, PE: 0.15, NS: 0.14 };
export const taxRate = prov => HST[prov] ?? 0.05;
export const taxLabel = prov => `${HST[prov] ? "HST" : "GST"} ${Math.round(taxRate(prov) * 100)}%`;
'''
open('public/rates-core.js', 'w', encoding='utf8', newline='\n').write(core)
open('public/rates.js', 'w', encoding='utf8', newline='\n').write(
    '// The store pages\' view of the shipping maths: the shared core, fed the box sizes from the catalogue.\n'
    'import { BOXES } from "/api/catalog-module";\nimport { useBoxes } from "./rates-core.js";\nuseBoxes(BOXES);\nexport * from "./rates-core.js";\n')

# 2. server: catalogue in storefront shape, order route, page titles
edit('src/catalog.js', [
    ('export function catalogModule(cat) {', 'export function toStorefront(cat) {'),
    ('  // JSON is valid JavaScript;', '  return { BOXES, CATEGORIES, PRODUCTS };\n}\n\nexport function catalogModule(cat) {\n  const { BOXES, CATEGORIES, PRODUCTS } = toStorefront(cat);\n  // JSON is valid JavaScript;'),
])
edit('src/worker.js', [
    ('import { admin, photo } from "./admin.js";', 'import { admin, photo } from "./admin.js";\nimport { placeOrder } from "./checkout.js";'),
    ('      if (path.startsWith("/api/admin/")) return await admin(request, env, url);',
     '      if (path.startsWith("/api/admin/")) return await admin(request, env, url);\n      if (path === "/api/orders") return request.method === "POST" ? await placeOrder(request, env, url) : json({ error: "Method not allowed" }, 405);'),
    ('  if (b && a !== "gifts") return null;', '  if (a === "order") return b && /^W[A-Z0-9]{6}$/.test(b) ? { ...base, title: `Order ${b} | ${site}`, index: false } : null;\n  if (b && a !== "gifts") return null;'),
    ('const fixed = { cart: "Cart",', 'const fixed = { checkout: "Checkout", cart: "Cart",'),
])
edit('public/index.html', [('<link rel="modulepreload" href="rates.js">', '<link rel="modulepreload" href="rates.js">\n<link rel="modulepreload" href="rates-core.js">')])

# 3. store pages: pickup as a choice, checkout, confirmation
edit('public/app.js', [
    ('import { parsePostal, pack, quote, money, days, MAX_QTY, FUEL } from "./rates.js";', 'import { parsePostal, pack, quote, money, days, MAX_QTY, FUEL, taxRate, taxLabel } from "./rates.js";'),
    # cart: pickup is always a choice; the button goes to checkout
    ('${o.id === chosen.id ? "checked" : ""}', '${chosen && o.id === chosen.id ? "checked" : ""}'),
    ('  const chosen = opts.find(o => o.id === state.ship) || opts[0], sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);',
     '  const pickup = state.ship === "pickup", chosen = pickup ? null : opts.find(o => o.id === state.ship) || opts[0], sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);\n  const ready = pickup || !!chosen;'),
    ('<span class="num">${money(o.total)}</span></label>`).join("")}\n      </fieldset>',
     '<span class="num">${money(o.total)}</span></label>`).join("")}\n        <label class="opt"><input type="radio" name="ship" value="pickup" ${pickup ? "checked" : ""}><span class="opt__name">Pick up at the Windsor counter<small>Ready the same day</small></span><span class="num">Free</span></label>\n      </fieldset>'),
    ('      <details class="why" ${state.whyOpen ? "open" : ""}><summary>What makes up ${money(chosen.total)}</summary><dl>',
     '      ${chosen ? `<details class="why" ${state.whyOpen ? "open" : ""}><summary>What makes up ${money(chosen.total)}</summary><dl>'),
    ('<dd class="num">${money(chosen.fuel)}</dd></div></dl></details>` : ""}',
     '<dd class="num">${money(chosen.fuel)}</dd></div></dl></details>` : ""}` : `<fieldset class="opts"><legend>Or skip shipping</legend><label class="opt"><input type="radio" name="ship" value="pickup" ${pickup ? "checked" : ""}><span class="opt__name">Pick up at the Windsor counter<small>Ready the same day</small></span><span class="num">Free</span></label></fieldset>`}'),
    ('      <div><dt>Shipping</dt><dd class="num">${chosen ? money(chosen.total) : "add postal code"}</dd></div>',
     '      <div><dt>${pickup ? "Pickup" : "Shipping"}</dt><dd class="num">${pickup ? "Free" : chosen ? money(chosen.total) : "add postal code"}</dd></div>'),
    ('    <button class="btn btn--wide" type="button" ${chosen ? "" : "disabled"}>Check out</button>\n    <p class="fine">Tax is added at checkout. Checkout is not connected in this mockup.</p>',
     '    ${ready ? `<a class="btn btn--wide" href="/checkout">Check out</a>` : `<button class="btn btn--wide" type="button" disabled>Check out</button>`}\n    <p class="fine">Tax is added at checkout.</p>'),
    ('const viewMissing = () =>', CHECKOUT_VIEWS := '''// ---------- checkout and confirmation ----------
function viewCheckout() {
  const lines = cartLines();
  if (!lines.length) return viewCart();
  const pickup = state.ship === "pickup", parcels = pack(lines), opts = !pickup && state.dest ? quote(state.dest, parcels) : [], chosen = opts.find(o => o.id === state.ship) || opts[0];
  if (!pickup && !chosen) return `<section class="empty"><h1 class="h2 h2--xl">One step back.</h1><p class="lead">Choose shipping or pickup in <a class="link" href="/cart">your cart</a> first.</p></section>`;
  const sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0), ship = pickup ? 0 : chosen.total, prov = pickup ? "ON" : state.dest.prov;
  const tax = Math.round((sub + ship) * taxRate(prov) * 100) / 100, units = lines.reduce((a, l) => a + l.qty, 0), f = state.form || {};
  const field = (id, label, attrs, hint = "") => `<label class="field__label" for="co-${id}">${label}${hint ? ` <span class="fine">${hint}</span>` : ""}</label><input class="field" id="co-${id}" name="${id}" value="${esc(f[id] || "")}" ${attrs}>`;
  return `
  <section class="cart checkout">
    <p class="crumb"><a href="/cart">Cart</a></p>
    <h1 class="h2 h2--xl">Checkout</h1>
    <form class="co" data-checkout novalidate>
      <fieldset class="co__set"><legend class="h3">Who it is for</legend>
        ${field("name", "Full name", 'autocomplete="name" maxlength="80" required')}
        ${field("email", "Email", 'type="email" autocomplete="email" inputmode="email" maxlength="120" required', "for the receipt and tracking")}
        ${field("phone", "Phone", 'type="tel" autocomplete="tel" inputmode="tel" maxlength="30"', "optional")}
      </fieldset>
      ${pickup ? `<fieldset class="co__set"><legend class="h3">Pickup</legend><p class="co__p">At the Windsor counter. We email you when it is ready, usually the same day. Bring the order number.</p></fieldset>`
        : `<fieldset class="co__set"><legend class="h3">Where it is going</legend>
        ${field("line1", "Street address", 'autocomplete="address-line1" maxlength="120" required')}
        ${field("city", "City or town", 'autocomplete="address-level2" maxlength="60" required')}
        ${state.dest.complete ? `<p class="co__p">Postal code <b class="num">${esc(state.dest.full)}</b>, ${esc(state.dest.prov)}. <button class="link" type="button" data-open-postal>Change</button></p>`
          : `<p class="co__p">We need the full postal code for the label. <button class="link" type="button" data-open-postal>Enter it</button></p>`}
        <p class="co__p">${chosen.carrier} ${chosen.service}, ${days(chosen.days)}. <a class="link" href="/cart">Change</a></p></fieldset>`}
      <dl class="totals">
        <div><dt>${units} ${units === 1 ? "item" : "items"}</dt><dd class="num">${money(sub)}</dd></div>
        <div><dt>${pickup ? "Pickup" : "Shipping"}</dt><dd class="num">${pickup ? "Free" : money(ship)}</dd></div>
        <div><dt>${taxLabel(prov)}</dt><dd class="num">${money(tax)}</dd></div>
        <div class="totals__door"><dt>Total</dt><dd class="num">${money(sub + ship + tax)}</dd></div>
      </dl>
      <p class="field__err" role="alert" data-co-err hidden></p>
      <button class="btn btn--wide" type="submit" ${!pickup && !state.dest.complete ? "disabled" : ""}>Place order</button>
      <p class="fine">This store is still in build. Placing an order here takes no payment: it goes to the shop's back office as a demo order.</p>
    </form>
  </section>`;
}
function viewOrder(id) {
  let o = null; try { o = JSON.parse(sessionStorage.getItem("oss:order:" + id)); } catch { o = null; }
  if (!o) return `<section class="empty"><h1 class="h2 h2--xl">Order ${esc(id)}</h1><p class="lead">Thank you. The details are in your email. <a class="link" href="/shop">Back to the shop</a>.</p></section>`;
  const c = n => money(n / 100);
  return `
  <section class="cart done">
    <p class="done__tag"><span>Order</span> <b class="num">${esc(o.id)}</b></p>
    <h1 class="h2 h2--xl">Thank you, ${esc(o.name.split(" ")[0])}.</h1>
    <p class="lead">${o.method === "pickup" ? "We will email you when it is ready at the Windsor counter. Bring this order number." : `We pack it and send it by ${esc(o.service)}. Tracking comes by email${o.days ? `, and it should arrive in about ${days(o.days)}` : ""}.`}</p>
    <ul class="done__lines">${o.items.map(i => `<li><span><b class="num">${i.qty}</b> &times; ${esc(i.name)}</span><span class="num">${c(i.unit_cents * i.qty)}</span></li>`).join("")}</ul>
    <dl class="totals">
      <div><dt>Items</dt><dd class="num">${c(o.subtotal_cents)}</dd></div>
      <div><dt>${o.method === "pickup" ? "Pickup" : "Shipping"}</dt><dd class="num">${o.method === "pickup" ? "Free" : c(o.shipping_cents)}</dd></div>
      <div><dt>${esc(o.tax_label)}</dt><dd class="num">${c(o.tax_cents)}</dd></div>
      <div class="totals__door"><dt>Total</dt><dd class="num">${c(o.total_cents)}</dd></div>
    </dl>
    ${o.address ? `<p class="fine">Going to ${esc(o.address.line1)}, ${esc(o.address.city)}, ${esc(o.address.province)} ${esc(o.address.postal)}.</p>` : ""}
    <p class="fine">Demo order: no payment was taken.</p>
    <a class="btn btn--wide" href="/shop">Keep looking</a>
  </section>`;
}
document.addEventListener("input", e => { const f = e.target.closest("[data-checkout]"); if (f && e.target.name) { state.form = state.form || {}; state.form[e.target.name] = e.target.value; } });
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-checkout]"); if (!f) return; e.preventDefault();
  const err = f.querySelector("[data-co-err]"), btn = f.querySelector('button[type="submit"]'), pickup = state.ship === "pickup";
  const fail = (msg, field) => { err.textContent = msg; err.hidden = false; const el = field && f.querySelector(`[name="${field}"]`); if (el) el.focus(); };
  const v = n => (f.elements[n] ? f.elements[n].value.trim() : "");
  if (!v("name")) return fail("Tell us the name for the order.", "name");
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(v("email"))) return fail("That email address does not look right.", "email");
  if (!pickup && !v("line1")) return fail("Enter the street address.", "line1");
  if (!pickup && !v("city")) return fail("Enter the city or town.", "city");
  const opts = !pickup && state.dest ? quote(state.dest, pack(cartLines())) : [], chosen = opts.find(o => o.id === state.ship) || opts[0];
  btn.disabled = true; btn.textContent = "Placing your order"; err.hidden = true;
  try {
    const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: state.cart, method: pickup ? "pickup" : "ship", service: chosen && chosen.id, postal: state.dest && state.dest.full,
      name: v("name"), email: v("email"), phone: v("phone"), note: state.note, address: { line1: v("line1"), city: v("city") } }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { btn.disabled = false; btn.textContent = "Place order"; if (typeof data.stock === "number" && bySku[data.sku]) bySku[data.sku].stock = data.stock; return fail(data.error || "That did not go through. Please try again.", data.field); }
    try { sessionStorage.setItem("oss:order:" + data.order.id, JSON.stringify(data.order)); } catch {}
    for (const i of data.order.items) if (bySku[i.sku]) bySku[i.sku].stock = Math.max(0, bySku[i.sku].stock - i.qty);
    state.cart = []; saveCart(); state.form = {}; state.note = ""; store.set("note", "");
    navigate("/order/" + data.order.id, true);
  } catch { btn.disabled = false; btn.textContent = "Place order"; fail("We could not reach the shop. Check your connection and try again."); }
});
const viewMissing = () =>'''),
    (': a === "search" ? viewSearch() : !a ? viewHome() : viewMissing();', ': a === "search" ? viewSearch() : a === "checkout" ? viewCheckout() : a === "order" ? viewOrder(b) : !a ? viewHome() : viewMissing();'),
])
edit('public/styles.css', [], '''
/* checkout and confirmation */
.co{display:grid;gap:var(--s-6)}
.co__set{border:0;margin:0;padding:0;display:grid;gap:var(--s-2);min-width:0}
.co__set legend{padding:0;margin-bottom:var(--s-2)}
.co__set .field{margin-bottom:var(--s-3)}
.co__p{margin:0 0 var(--s-2);color:var(--color-text)}
.done__tag{display:inline-flex;align-items:baseline;gap:var(--s-2);margin:0 0 var(--s-4);padding:6px 12px 4px;background:var(--white);color:var(--ink);border-bottom:4px solid var(--ember);transform:rotate(-2deg);font-size:var(--t-12);letter-spacing:.09em;text-transform:uppercase}
.done__tag b{font:400 1.5rem/1 var(--font-display);letter-spacing:.02em}
.done__lines{list-style:none;margin:var(--s-6) 0;padding:0;border-bottom:1px solid var(--color-line)}
.done__lines li{display:flex;justify-content:space-between;gap:var(--s-4);padding:var(--s-3) 0;border-top:1px solid var(--color-line)}
.done__lines b{color:var(--color-strong)}
@media (min-width:960px){.checkout,.done{max-width:640px}}
''')
print('checkout wired')
