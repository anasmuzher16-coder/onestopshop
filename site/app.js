import { PRODUCTS, CATEGORIES, BOXES } from "./catalog.js";
import { parsePostal, pack, quote, money, ORIGIN } from "./rates.js";

// ---------- state ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("oss:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("oss:" + k, JSON.stringify(v)); } catch {} },
};
const state = {
  dest: store.get("postal", null) ? parsePostal(store.get("postal", null)) : null,
  cart: store.get("cart", []), // [{sku, qty}]
  ship: store.get("ship", null),
};
const bySku = Object.fromEntries(PRODUCTS.map(p => [p.sku, p]));
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function setDest(raw) {
  const d = parsePostal(raw);
  if (!d) return false;
  state.dest = d; store.set("postal", d.full);
  render(); return true;
}
function cheapestFor(product) {
  if (!state.dest) return null;
  return quote(state.dest, pack([{ product, qty: 1 }]))[0];
}
function cartLines() { return state.cart.filter(l => bySku[l.sku]).map(l => ({ product: bySku[l.sku], qty: l.qty })); }
function addToCart(sku) {
  const l = state.cart.find(x => x.sku === sku);
  l ? l.qty++ : state.cart.push({ sku, qty: 1 });
  store.set("cart", state.cart); updateCount();
}
function setQty(sku, qty) {
  state.cart = state.cart.map(l => l.sku === sku ? { ...l, qty } : l).filter(l => l.qty > 0);
  store.set("cart", state.cart); render();
}
function updateCount() {
  const n = state.cart.reduce((a, l) => a + l.qty, 0);
  $("[data-cart-count]").textContent = `(${n})`;
}

// ---------- the Door Tag (device) ----------
function doorTag({ big = false } = {}) {
  const d = state.dest;
  const id = big ? "postal-big" : "postal-head";
  return `
  <form class="doortag ${big ? "doortag--big" : ""} ${d ? "is-set" : ""}" data-doortag novalidate>
    <span class="doortag__hole" aria-hidden="true"></span>
    <label class="doortag__label" for="${id}">${d ? "Shipping to" : "Ship to"}</label>
    <input class="doortag__input mono" id="${id}" name="postal" inputmode="text" autocomplete="postal-code"
      maxlength="7" spellcheck="false" placeholder="Postal code" value="${d ? esc(d.full) : ""}"
      aria-describedby="${id}-hint">
    <button class="doortag__go" type="submit">${d ? "Change" : "Price it"}</button>
    <span class="doortag__hint" id="${id}-hint" role="status">${d
      ? `${d.city ? esc(d.city) + ", " : ""}${d.prov}${d.rural ? " &middot; rural route" : ""}. Prices below include delivery.`
      : "Every price updates to include delivery to you."}</span>
  </form>`;
}
function bindDoorTags(root = document) {
  root.querySelectorAll("[data-doortag]").forEach(f => {
    f.addEventListener("submit", e => {
      e.preventDefault();
      const input = f.querySelector("input");
      if (!setDest(input.value)) {
        f.classList.add("is-error");
        f.querySelector(".doortag__hint").textContent = "That is not a Canadian postal code. It looks like A1A 1A1.";
        input.focus();
      }
    });
    f.querySelector("input").addEventListener("input", () => f.classList.remove("is-error"));
  });
}

// ---------- product art (placeholders, drawn, never scraped) ----------
function hookahArt(p) {
  // Stem length follows real height; base shape varies by item so the grid is not one drawing x8.
  const n = p.name.toLowerCase();
  const v = /crystal|cut/.test(n) ? 2 : /stainless|aluminium|carbon|modern/.test(n) ? 1 : /travel|mini|four/.test(n) ? 3 : 0;
  const wl = [28, 14, 22, 34][v];
  const stem = Math.round(18 + (p.height || 60) * 0.42), top = 108 - 34 - 13 - stem; // bowl+tray 13, base 34
  const y0 = top + 13, yb = y0 + stem;
  const bases = [
    `M45 ${yb}c0 6-15 10-15 22 0 7 9 12 20 12s20-5 20-12c0-12-15-16-15-22`,           // round
    `M46 ${yb}l-4 6v22c0 3 4 6 8 6s8-3 8-6V${yb + 6}l-4-6`,                              // vase
    `M45 ${yb}l-13 14 6 20h24l6-20-13-14`,                                                // cut crystal
    `M46 ${yb}c0 8-18 12-18 24 0 6 10 10 22 10s22-4 22-10c0-12-18-16-18-24`,             // wide squat
  ][v];
  const knots = [y0 + stem * 0.3, y0 + stem * 0.62].map(y => `M45 ${Math.round(y)}h10`).join("");
  return `<path d="M44 ${top}h12l-2 8h-8z"/><path d="M33 ${top + 11}c0 3 34 3 34 0"/>
    <path d="M48 ${y0}v${stem}M52 ${y0}v${stem}${knots}"/><path d="M45 ${yb}h10"/><path d="${bases}"/>
    <path d="M${50 - wl / 2} ${yb + 22}h${wl}" stroke-dasharray="2 3"/><path d="M52 ${Math.round(y0 + stem * 0.8)}h6c10 0 15 8 13 18-1.5 8 5 12 14 11"/>`;
}
function art(p) {
  const s = {
    hookahs: hookahArt(p),
    bowls: `<path d="M30 48h40l-6 22H36z"/><path d="M42 70v10h16V70"/><path d="M34 48c4-8 28-8 32 0"/>`,
    hoses: `<path d="M26 30c20-10 30 4 24 18s6 26 26 18"/><path d="M22 26l8 8M74 62l8 8"/>`,
    frames: `<circle cx="34" cy="56" r="13"/><circle cx="66" cy="56" r="13"/><path d="M47 54c2-3 4-3 6 0M21 54l-6-4M79 54l6-4"/>`,
  }[p.cat];
  return `<svg viewBox="0 0 100 112" class="art" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${s}</svg>`;
}

// ---------- product card ----------
function card(p) {
  const q = cheapestFor(p);
  return `
  <article class="card">
    <a class="card__link" href="#/p/${p.sku}">
      <div class="card__photo">${art(p)}<span class="card__photo-note">Photo to come</span></div>
      <h3 class="card__name">${esc(p.name)}</h3>
    </a>
    <p class="card__price"><span class="mono">${money(p.price)}</span> <span class="card__muted">item</span></p>
    ${q ? `<p class="card__door"><span class="mono">${money(p.price + q.total)}</span> at your door <span class="card__muted card__days"><span class="sep">&middot; </span>${q.days} ${q.days === 1 ? "day" : "days"}</span></p>`
        : `<p class="card__door card__door--empty">Add your postal code for the delivered price</p>`}
  </article>`;
}

// ---------- views ----------
function viewHome() {
  const hero = bySku["OSS-0102"];
  const q = cheapestFor(hero);
  return `
  <section class="fold">
    <div class="fold__copy">
      <p class="eyebrow">Windsor counter &middot; ships across Canada</p>
      <h1 class="display">The price you see is the price at your door.</h1>
      <p class="lead">Type your postal code once. Every hookah, bowl and frame in the shop shows what it costs delivered to you, packed and insured, before you ever reach checkout.</p>
      ${doorTag({ big: true })}
    </div>
    <aside class="fold__proof" aria-label="Example: ${esc(hero.name)}">
      <div class="proof__photo">${art(hero)}</div>
      <p class="proof__name">${esc(hero.name)}</p>
      <dl class="proof__ledger mono">
        <dt>Item</dt><dd>${money(hero.price)}</dd>
        <dt>${q ? `Delivery, ${q.days} days` : "Delivery"}</dt><dd>${q ? money(q.total) : "your code"}</dd>
        <dt class="proof__total">At your door</dt><dd class="proof__total ${q ? "is-price" : ""}">${q ? money(hero.price + q.total) : "--"}</dd>
      </dl>
      <p class="stamp mono">${hero.sku} / ${hero.kg} kg / ${BOXES[hero.box].label}</p>
    </aside>
  </section>
  <section class="shelf">
    <div class="shelf__head"><h2 class="h2">Hookahs</h2><a class="more" href="#/shop/hookahs">All hookahs</a></div>
    <div class="grid">${PRODUCTS.filter(p => p.cat === "hookahs").slice(0, 8).map(card).join("")}</div>
  </section>
  <section class="cats" aria-label="Shop by category">
    ${CATEGORIES.map(c => `<a class="cat" href="#/shop/${c.id}"><span class="cat__name">${c.name}</span><span class="mono cat__n">${PRODUCTS.filter(p => p.cat === c.id).length}</span></a>`).join("")}
  </section>
  <section class="promise">
    <h2 class="h2">How a glass hookah gets to ${state.dest?.city ? esc(state.dest.city) : "your door"} in one piece</h2>
    <ol class="steps">
      <li><span class="mono step__n">01</span><b>Taken apart.</b> Stem, base and tray are packed separately, so nothing long and thin carries the weight.</li>
      <li><span class="mono step__n">02</span><b>Double boxed.</b> The glass base sits in its own box, suspended in a second one. Every glass order ships insured.</li>
      <li><span class="mono step__n">03</span><b>Priced to the gram.</b> We weigh and measure every item, so the delivery charge you see is what the carrier charges us.</li>
    </ol>
  </section>`;
}

function viewShop(cat) {
  const c = CATEGORIES.find(x => x.id === cat) || null;
  const list = c ? PRODUCTS.filter(p => p.cat === c.id) : PRODUCTS;
  return `
  <section class="shophead">
    <h1 class="display display--s">${c ? c.name : "Everything"}</h1>
    <p class="mono shophead__n">${list.length} items</p>
    <nav class="chips" aria-label="Categories">
      <a href="#/shop" ${!c ? 'aria-current="page"' : ""}>All</a>
      ${CATEGORIES.map(x => `<a href="#/shop/${x.id}" ${c && c.id === x.id ? 'aria-current="page"' : ""}>${x.name}</a>`).join("")}
    </nav>
  </section>
  <div class="grid grid--shop">${list.map(card).join("")}</div>`;
}

function viewProduct(sku) {
  const p = bySku[sku];
  if (!p) return `<section class="empty"><h1 class="display display--s">That item is not here.</h1><p><a href="#/shop">Back to the shop</a></p></section>`;
  const parcels = pack([{ product: p, qty: 1 }]);
  const opts = state.dest ? quote(state.dest, parcels) : [];
  const b = BOXES[parcels[0].box];
  return `
  <article class="pdp">
    <div class="pdp__photo">${art(p)}<span class="card__photo-note">Photo to come</span></div>
    <div class="pdp__info">
      <p class="eyebrow"><a href="#/shop/${p.cat}">${CATEGORIES.find(c => c.id === p.cat).name}</a></p>
      <h1 class="pdp__name">${esc(p.name)}</h1>
      <p class="pdp__price"><span class="mono">${money(p.price)}</span></p>
      ${opts.length ? `<p class="pdp__door"><span class="mono">${money(p.price + opts[0].total)}</span> at your door in ${esc(state.dest.city || state.dest.fsa)} <span class="muted">&middot; ${opts[0].days} days</span></p>` : `<p class="pdp__door pdp__door--empty"><a href="#ship-h">Add your postal code</a> to see the delivered price.</p>`}
      <p class="pdp__note">${esc(p.note)}${p.height ? `. Stands ${p.height} cm assembled.` : "."}</p>
      <button class="btn" data-add="${p.sku}">Add to cart</button>
      <p class="stamp mono">${p.sku} / ${p.kg} kg item / ${parcels[0].kg} kg packed / ${b.l} x ${b.w} x ${b.h} cm ${esc(b.label.toLowerCase())}</p>
      <section class="ship" aria-labelledby="ship-h">
        <h2 class="h3" id="ship-h">Delivery to you</h2>
        ${doorTag()}
        ${opts.length ? `
        <table class="ledger">
          <thead><tr><th scope="col">Carrier</th><th scope="col">Arrives</th><th scope="col" class="num">Delivery</th><th scope="col" class="num">Total</th></tr></thead>
          <tbody>${opts.map((o, i) => `<tr><td>${o.carrier} <span class="muted">${o.service}</span></td><td class="mono">${o.days} ${o.days === 1 ? "day" : "days"}</td><td class="num mono">${money(o.total)}</td><td class="num mono ${i === 0 ? "is-price" : ""}">${money(p.price + o.total)}</td></tr>`).join("")}</tbody>
        </table>
        <p class="fine">${p.glass ? "Glass ships double-boxed and insured. " : ""}Billed on ${opts[0].perParcel[0].billableKg} kg (the larger of real weight and box size). Includes fuel and ${state.dest.rural ? "rural " : ""}delivery charges.</p>` : ""}
      </section>
    </div>
  </article>`;
}

function viewCart() {
  const lines = cartLines();
  if (!lines.length) return `<section class="empty"><h1 class="display display--s">Your cart is empty.</h1><p>Start with the <a href="#/shop/hookahs">hookahs</a>; every one shows its price at your door.</p></section>`;
  const parcels = pack(lines);
  const opts = state.dest ? quote(state.dest, parcels) : [];
  const chosen = opts.find(o => o.id === state.ship) || opts[0];
  const sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  return `
  <section class="cart">
    <h1 class="display display--s">Cart</h1>
    <table class="ledger ledger--cart">
      <thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col" class="num">Price</th></tr></thead>
      <tbody>${lines.map(l => `<tr><td><a href="#/p/${l.product.sku}">${esc(l.product.name)}</a><span class="stamp mono">${l.product.sku} / ${l.product.kg} kg</span></td>
        <td><span class="qty"><button aria-label="One less" data-qty="${l.product.sku}" data-n="${l.qty - 1}">-</button><span class="mono">${l.qty}</span><button aria-label="One more" data-qty="${l.product.sku}" data-n="${l.qty + 1}">+</button></span></td>
        <td class="num mono">${money(l.product.price * l.qty)}</td></tr>`).join("")}</tbody>
    </table>
    <div class="cart__ship">
      <h2 class="h3">How it ships</h2>
      <ul class="boxes">${parcels.map((p, i) => `<li class="mono">Box ${i + 1}: ${p.label}, ${p.l}x${p.w}x${p.h} cm, ${p.kg} kg <span class="muted">(${p.items.length} ${p.items.length === 1 ? "item" : "items"})</span></li>`).join("")}</ul>
      ${doorTag()}
      ${opts.length ? `<fieldset class="opts"><legend class="sr">Choose delivery</legend>
        ${opts.map(o => `<label class="opt"><input type="radio" name="ship" value="${o.id}" ${o.id === chosen.id ? "checked" : ""}>
          <span>${o.carrier} ${o.service}<span class="muted mono"> ${o.days} ${o.days === 1 ? "day" : "days"}</span></span><span class="mono num">${money(o.total)}</span></label>`).join("")}
      </fieldset>
      <details class="why"><summary>What makes up ${money(chosen.total)}</summary>
        <dl class="mono">${chosen.perParcel.map((p, i) => `<dt>Box ${i + 1}, billed ${p.billableKg} kg</dt><dd>${money(p.freight)}</dd>`).join("")}
        ${chosen.surcharges ? `<dt>Residential${state.dest.rural ? " + rural" : ""}</dt><dd>${money(chosen.surcharges)}</dd>` : ""}
        <dt>Fuel</dt><dd>${money(chosen.fuel)}</dd></dl></details>` : ""}
    </div>
    <dl class="totals mono">
      <dt>Items</dt><dd>${money(sub)}</dd>
      <dt>Delivery</dt><dd>${chosen ? money(chosen.total) : "add postal code"}</dd>
      <dt class="totals__grand">At your door</dt><dd class="totals__grand ${chosen ? "is-price" : ""}">${chosen ? money(sub + chosen.total) : "--"}</dd>
    </dl>
    <button class="btn btn--wide" ${chosen ? "" : "disabled"}>Checkout</button>
    <p class="fine">Tax is added at checkout. Mockup: checkout is not connected.</p>
  </section>`;
}

function viewShipping() {
  return `
  <section class="reading">
    <h1 class="display display--s">Shipping</h1>
    <p class="lead">We ship from our counter in Windsor to every province and territory.</p>
    <h2 class="h3">What you pay</h2>
    <p>The delivery price on every product is calculated from that item's real packed weight and box size, the carrier's rate to your postal code, and any fuel, residential or rural charges. It is the same number we pay the carrier.</p>
    <h2 class="h3">How glass is packed</h2>
    <p>Hookahs ship taken apart. Glass bases are double boxed and every glass order is insured. If something arrives broken, send us a photo within 48 hours and we replace it.</p>
    <h2 class="h3">What we ship</h2>
    <p>Hookahs, bowls, hoses, parts and frames go anywhere in Canada. Coals and anything consumable are sold at the counter only.</p>
    <h2 class="h3">Pickup</h2>
    <p>Order online and pick up at the counter for free. Call <a href="tel:+15192552222" class="mono">519-255-2222</a>.</p>
  </section>`;
}

// ---------- router ----------
function render() {
  const h = location.hash.replace(/^#\/?/, "");
  const [a, b] = h.split("/");
  const main = $("#main");
  main.innerHTML = a === "shop" ? viewShop(b) : a === "p" ? viewProduct(b) : a === "cart" ? viewCart() : a === "shipping" ? viewShipping() : viewHome();
  const showHeadTag = a !== "" && a !== undefined && a !== "p" && a !== "cart";
  $("[data-doortag-slot]").innerHTML = showHeadTag ? doorTag() : "";
  bindDoorTags();
  main.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => { addToCart(b.dataset.add); b.textContent = "Added. View cart"; b.onclick = () => location.hash = "#/cart"; }));
  main.querySelectorAll("[data-qty]").forEach(b => b.addEventListener("click", () => setQty(b.dataset.qty, +b.dataset.n)));
  main.querySelectorAll('input[name="ship"]').forEach(r => r.addEventListener("change", () => { state.ship = r.value; store.set("ship", r.value); render(); }));
  document.querySelectorAll(".nav a").forEach(l => l.toggleAttribute("aria-current", l.getAttribute("href") === location.hash));
  updateCount();
}
let lastRoute = location.hash;
window.addEventListener("hashchange", () => { render(); if (location.hash !== lastRoute) { window.scrollTo(0, 0); $("#main").focus({ preventScroll: true }); } lastRoute = location.hash; });
render();
