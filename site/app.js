import { PRODUCTS, CATEGORIES } from "./catalog.js";
import { parsePostal, pack, quote, money, days, MAX_QTY } from "./rates.js";

// ---------- state (everything read from storage is validated) ----------
const bySku = Object.fromEntries(PRODUCTS.map(p => [p.sku, p]));
const catById = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const GROUND = { hookahs: "emerald", bases: "teal", bowls: "midnight", heat: "oxblood", hoses: "forest", parts: "aubergine", frames: "umber" };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("oss:" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("oss:" + k, JSON.stringify(v)); } catch {} },
};
const cleanCart = x => Array.isArray(x)
  ? x.filter(l => l && bySku[l.sku] && Number.isInteger(l.qty) && l.qty > 0).map(l => ({ sku: l.sku, qty: Math.min(MAX_QTY, l.qty) })) : [];
const state = { dest: parsePostal(store.get("postal")), cart: cleanCart(store.get("cart")), ship: typeof store.get("ship") === "string" ? store.get("ship") : null };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const whole = n => "$" + Math.round(n).toLocaleString("en-CA");
const no = p => "No. " + p.sku.slice(-3);
const byName = n => PRODUCTS.find(p => p.name === n);

const cartLines = () => state.cart.map(l => ({ product: bySku[l.sku], qty: l.qty }));
const cartCount = () => state.cart.reduce((a, l) => a + l.qty, 0);
function saveCart() { store.set("cart", state.cart); syncChrome(); }
function addToCart(sku) {
  const l = state.cart.find(x => x.sku === sku);
  if (l) l.qty = Math.min(MAX_QTY, l.qty + 1); else state.cart.push({ sku, qty: 1 });
  saveCart();
}
function setQty(sku, qty) { state.cart = cleanCart(state.cart.map(l => l.sku === sku ? { ...l, qty } : l)); saveCart(); render(); }

// ---------- THE NICHE (device): every product stands in an arched display niche ----------
const imgSrc = (p, small) => p.photo ? `img/${p.img}.webp` : `img/p/${p.img}${small && !p.dark ? "-s" : ""}.webp`;
function niche(p, { small = false, eager = false, cls = "" } = {}) {
  const photo = p.dark || p.photo;
  return `<span class="niche ${photo ? "niche--photo" : ""} ${cls}"><img class="shot" src="${imgSrc(p, small)}" alt="" width="${p.dark ? 1200 : 720}" height="${p.dark ? 1200 : 900}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></span>`;
}
function card(p, i = 9) {
  return `
  <article class="card">
    <a class="card__a" href="#/p/${p.sku}">
      ${niche(p, { small: true, eager: i < 4 })}
      <span class="card__no num">${no(p)}</span>
      <h3 class="card__name">${esc(p.name)}</h3>
      <span class="card__price num">${whole(p.price)}</span>
    </a>
  </article>`;
}

// ---------- views ----------
function viewHome() {
  const feature = byName("Mamoun Kamanja Gold");
  const edit = ["Sultan Totem", "Stuttgart Pure, Jade", "Regent Neon Blue", "Cairo Avatar", "Woodline Sage", "Carbon Black"].map(byName);
  const resin = PRODUCTS.filter(p => p.dark);
  return `
  <section class="hero">
    <div class="hero__copy">
      <p class="ar hero__ar" lang="ar" dir="rtl">&#x623;&#x647;&#x644;&#x627; &#x648;&#x633;&#x647;&#x644;&#x627;</p>
      <h1 class="hero__h">Hookahs, chosen <em>one by one.</em></h1>
      <p class="hero__p">Egyptian brass, German steel and hand-cut glass, picked at our counter in Windsor and shipped anywhere in Canada.</p>
      <div class="hero__cta"><a class="btn" href="#/shop/hookahs">Shop hookahs</a><a class="textlink" href="#/shop">See the whole counter</a></div>
    </div>
    <a class="hero__piece" href="#/p/${feature.sku}">
      ${niche(feature, { eager: true })}
      <span class="hero__cap"><span class="num">${no(feature)}</span><span class="hero__capname">${esc(feature.name)}</span><span class="num">${whole(feature.price)}</span></span>
    </a>
  </section>
  <section class="edit">
    <header class="sec__head"><p class="ar" lang="ar" dir="rtl" aria-hidden="true">&#x627;&#x62e;&#x62a;&#x64a;&#x627;&#x631;&#x646;&#x627;</p><h2 class="h2">The counter's picks</h2><p class="sec__note">Six we would put on our own table this month.</p></header>
    <div class="grid grid--stagger">${edit.map((p, i) => card(p, i + 8)).join("")}</div>
    <p class="sec__more"><a class="textlink" href="#/shop/hookahs">All 39 hookahs</a></p>
  </section>
  <section class="coll" aria-labelledby="coll-h">
    <header class="sec__head"><h2 class="h2" id="coll-h">Collections</h2></header>
    <ul class="coll__list">${CATEGORIES.map(c => { const list = PRODUCTS.filter(p => p.cat === c.id), lead = list.find(p => !p.dark);
      return `<li><a class="coll__row" href="#/shop/${c.id}">${niche(lead, { small: true, cls: "niche--thumb" })}<span class="coll__name">${c.name}</span><span class="ar coll__ar" lang="ar" dir="rtl" aria-hidden="true">${c.ar}</span><span class="coll__n num">${list.length}</span></a></li>`; }).join("")}</ul>
  </section>
  <section class="resin">
    <div class="resin__in">
      <header class="sec__head"><p class="ar" lang="ar" dir="rtl" aria-hidden="true">&#x642;&#x637;&#x639;&#x629; &#x648;&#x627;&#x62d;&#x62f;&#x629;</p><h2 class="h2">One of one</h2>
        <p class="sec__note">Poured resin stems. No two leave the mould the same, so when one sells, that one is gone.</p></header>
      <div class="resin__row">${resin.map(p => `<a class="resin__item" href="#/p/${p.sku}">${niche(p)}<span class="card__no num">${no(p)}</span><span class="card__name">${esc(p.name)}</span><span class="card__price num">${whole(p.price)}</span></a>`).join("")}</div>
    </div>
  </section>
  <section class="care">
    <span class="niche niche--photo care__img"><img class="shot" src="img/wide-row-800.webp" alt="" loading="lazy" width="800" height="534"></span>
    <div class="care__copy">
      <h2 class="h2">Glass that arrives as glass</h2>
      <ul class="care__list">
        <li><b>Taken apart.</b> Stem, base and tray are wrapped separately so nothing long carries the weight.</li>
        <li><b>Double boxed.</b> The base sits in its own box inside the shipping box.</li>
        <li><b>Covered.</b> Glass orders over $100 ship with signature and full coverage.</li>
      </ul>
      <a class="textlink" href="#/shipping">How shipping works</a>
    </div>
  </section>`;
}

function viewShop(cat) {
  const c = catById[cat] || null, list = c ? PRODUCTS.filter(p => p.cat === c.id) : PRODUCTS;
  return `
  <section class="shophead">
    <p class="ar" lang="ar" dir="rtl" aria-hidden="true">${c ? c.ar : "&#x643;&#x644; &#x634;&#x64a;"}</p>
    <h1 class="shophead__h">${c ? c.name : "The whole counter"}</h1>
    <p class="shophead__n"><span class="num">${list.length}</span> pieces</p>
    <nav class="chips" aria-label="Collections"><a href="#/shop" ${!c ? 'aria-current="page"' : ""}>All</a>${CATEGORIES.map(x => `<a href="#/shop/${x.id}" ${c && c.id === x.id ? 'aria-current="page"' : ""}>${x.name}</a>`).join("")}</nav>
  </section>
  <div class="grid grid--shop">${list.map(card).join("")}</div>`;
}

function viewProduct(sku) {
  const p = bySku[sku];
  if (!p) return `<section class="empty"><h1 class="h2">That one is gone.</h1><p class="lead">It may have sold. <a class="textlink" href="#/shop">See what is on the counter</a>.</p></section>`;
  const c = catById[p.cat], parcels = pack([{ product: p, qty: 1 }]), opts = state.dest ? quote(state.dest, parcels) : [], b = parcels[0];
  const inCart = state.cart.some(l => l.sku === sku);
  const more = PRODUCTS.filter(x => x.cat === p.cat && x.sku !== sku && !x.dark).slice(0, 3);
  return `
  <article class="pdp">
    <div class="pdp__stage">${niche(p, { eager: true })}</div>
    <div class="pdp__info">
      <p class="crumb"><a href="#/shop/${p.cat}">${c.name}</a> <span class="num">${no(p)}</span></p>
      <h1 class="pdp__name">${esc(p.name)}</h1>
      <p class="pdp__note">${esc(p.note)}${p.height ? `. Stands ${p.height} cm.` : "."}</p>
      <p class="pdp__price num">${money(p.price)}</p>
      ${inCart ? `<a class="btn btn--wide" href="#/cart">In your cart. View cart</a>` : `<button class="btn btn--wide" type="button" data-add="${p.sku}">Add to cart</button>`}
      <section class="ways" aria-labelledby="ways-h">
        <h2 class="h3" id="ways-h">Shipping estimate</h2>
        ${opts.length ? `<p class="ways__to">To ${esc(state.dest.full)}${state.dest.city ? ", " + esc(state.dest.city) : ""}. <button class="textlink" type="button" data-open-postal>Change</button></p>
        <table class="ledger"><thead><tr><th scope="col">Service</th><th scope="col">Arrives</th><th scope="col" class="r">Cost</th></tr></thead>
        <tbody>${opts.map(o => `<tr><td>${o.carrier} ${o.service}</td><td>${days(o.days)}</td><td class="r num">${money(o.total)}</td></tr>`).join("")}
        <tr><td>Pick up at the Windsor counter</td><td>Today</td><td class="r num">Free</td></tr></tbody></table>`
        : `<p class="ways__to">Ships anywhere in Canada, or pick up free at the Windsor counter.</p><button class="btn btn--ghost btn--wide" type="button" data-open-postal>Estimate shipping to my postal code</button>`}
      </section>
      <section class="spec" aria-labelledby="spec-h">
        <h2 class="h3" id="spec-h">Details</h2>
        <dl class="spec__list">
          <div><dt>Item</dt><dd class="num">${p.sku}</dd></div>
          ${p.height ? `<div><dt>Height</dt><dd class="num">${p.height} cm</dd></div>` : ""}
          <div><dt>Ships at</dt><dd><span class="num">${b.kg} kg</span> in a <span class="num">${b.l} x ${b.w} x ${b.h} cm</span> box</dd></div>
          ${p.glass ? `<div><dt>Glass</dt><dd>Double boxed${p.price > 100 ? ", signature and coverage included" : ""}</dd></div>` : ""}
        </dl>
      </section>
    </div>
  </article>
  ${more.length ? `<section class="edit"><header class="sec__head"><h2 class="h2">More ${c.name.toLowerCase()}</h2></header><div class="grid">${more.map(card).join("")}</div><p class="sec__more"><a class="textlink" href="#/shop/${p.cat}">All ${c.name.toLowerCase()}</a></p></section>` : ""}`;
}

function viewCart() {
  const lines = cartLines();
  if (!lines.length) return `<section class="empty"><h1 class="h2">Nothing in the cart yet.</h1><p class="lead">Start with the <a class="textlink" href="#/shop/hookahs">hookahs</a>.</p></section>`;
  const parcels = pack(lines), opts = state.dest ? quote(state.dest, parcels) : [];
  const chosen = opts.find(o => o.id === state.ship) || opts[0], sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const tooHeavy = state.dest && !opts.length;
  return `
  <section class="cart">
    <h1 class="h2">Your cart</h1>
    <ul class="lines">${lines.map(({ product: p, qty }) => `
      <li class="line">
        <a class="line__img" href="#/p/${p.sku}">${niche(p, { small: true, cls: "niche--thumb" })}</a>
        <div class="line__body"><a class="line__name" href="#/p/${p.sku}">${esc(p.name)}</a><p class="line__meta num">${no(p)}</p>
          <div class="qty"><button type="button" aria-label="One less ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty - 1}">&minus;</button><span class="num" aria-live="polite">${qty}</span><button type="button" aria-label="One more ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty + 1}" ${qty >= MAX_QTY ? "disabled" : ""}>+</button></div></div>
        <p class="line__price num">${money(p.price * qty)}</p>
      </li>`).join("")}</ul>
    <section class="cartship">
      <h2 class="h3">Shipping</h2>
      ${!state.dest ? `<p class="ways__to">Ships in ${parcels.length} ${parcels.length === 1 ? "box" : "boxes"}. Add your postal code for the cost.</p><button class="btn btn--ghost btn--wide" type="button" data-open-postal>Add postal code</button>` : ""}
      ${tooHeavy ? `<p class="note">One of these boxes is over the 30 kg carrier limit. Call the counter at 519-255-2222 and we will quote it by hand.</p>` : ""}
      ${opts.length ? `<fieldset class="opts"><legend>To ${esc(state.dest.full)} <button class="textlink" type="button" data-open-postal>Change</button></legend>
        ${opts.map(o => `<label class="opt"><input type="radio" name="ship" value="${o.id}" ${o.id === chosen.id ? "checked" : ""}><span class="opt__name">${o.carrier} ${o.service}<small>${days(o.days)}</small></span><span class="num">${money(o.total)}</span></label>`).join("")}
      </fieldset>
      <details class="why"><summary>What makes up ${money(chosen.total)}</summary><dl>
        ${parcels.map((p, i) => `<div><dt>Box ${i + 1}: <span class="num">${p.l} x ${p.w} x ${p.h} cm, ${p.kg} kg</span>, billed at <span class="num">${chosen.perParcel[i].billableKg} kg</span></dt><dd class="num">${money(chosen.perParcel[i].freight)}</dd></div>`).join("")}
        ${chosen.cover ? `<div><dt>Glass coverage and signature</dt><dd class="num">${money(chosen.cover)}</dd></div>` : ""}
        <div><dt>Carrier fuel charge</dt><dd class="num">${money(chosen.fuel)}</dd></div></dl></details>` : ""}
    </section>
    <dl class="totals">
      <div><dt>Items</dt><dd class="num">${money(sub)}</dd></div>
      <div><dt>Shipping</dt><dd class="num">${chosen ? money(chosen.total) : "add postal code"}</dd></div>
      <div class="totals__sum"><dt>Total before tax</dt><dd class="num">${money(sub + (chosen ? chosen.total : 0))}</dd></div>
    </dl>
    <button class="btn btn--wide" type="button" ${chosen ? "" : "disabled"}>Checkout</button>
    <p class="fine">Tax is added at checkout. Checkout is not connected in this mockup.</p>
  </section>`;
}

function viewShipping() {
  return `
  <section class="reading">
    <p class="ar" lang="ar" dir="rtl" aria-hidden="true">&#x627;&#x644;&#x62a;&#x648;&#x635;&#x64a;&#x644;</p>
    <h1 class="h2">Shipping</h1>
    <p class="lead">We pack every order at the counter in Windsor and ship to every province and territory.</p>
    <h2 class="h3">What it costs</h2>
    <p>Shipping is worked out from the packed weight and box size of your order and the carrier's rate to your postal code. You see the cost on the product page and in the cart before you pay.</p>
    <p><button class="btn btn--ghost" type="button" data-open-postal>${state.dest ? "Estimating to " + esc(state.dest.full) + ". Change" : "Enter my postal code"}</button></p>
    <h2 class="h3">How glass is packed</h2>
    <p>Hookahs ship taken apart. The glass base is double boxed. If anything arrives broken, send a photo and we make it right.</p>
    <h2 class="h3">What we ship</h2>
    <p>Hookahs, bases, bowls, heat keepers, hoses, parts and frames. Anything else in the shop is counter only.</p>
    <h2 class="h3">Pick up</h2>
    <p>Order online and pick up at the counter for free. Call <a class="textlink" href="tel:+15192552222">519-255-2222</a>.</p>
  </section>`;
}

// ---------- chrome, sheet, router ----------
function syncChrome() {
  $$("[data-cart-count]").forEach(e => e.textContent = cartCount());
  const h = location.hash || "#/";
  $("[data-nav]").innerHTML = CATEGORIES.slice(0, 6).map(c => `<a href="#/shop/${c.id}" ${h === "#/shop/" + c.id ? 'aria-current="page"' : ""}>${c.name}</a>`).join("") + `<a href="#/shipping" ${h === "#/shipping" ? 'aria-current="page"' : ""}>Shipping</a>`;
  $$("[data-dock]").forEach(a => a.toggleAttribute("aria-current", a.dataset.dock === "cart" ? h === "#/cart" : a.dataset.dock === "home" ? h === "#/" : h.startsWith("#/shop") || h.startsWith("#/p/")));
}
const sheet = $("[data-postal-sheet]"), postalInput = $("#postal"), postalErr = $("#postal-err");
function openSheet() { postalInput.value = state.dest ? state.dest.full : ""; postalErr.hidden = true; postalInput.removeAttribute("aria-invalid"); sheet.showModal(); postalInput.focus(); postalInput.select(); }
document.addEventListener("click", e => {
  if (e.target.closest("[data-open-postal]")) openSheet();
  else if (e.target.closest("[data-close-postal]") || e.target === sheet) sheet.close();
  const add = e.target.closest("[data-add]"); if (add) { addToCart(add.dataset.add); render(); }
  const q = e.target.closest("[data-qty]"); if (q) setQty(q.dataset.qty, +q.dataset.n);
});
document.addEventListener("change", e => { if (e.target.name === "ship") { state.ship = e.target.value; store.set("ship", state.ship); render(); } });
$("[data-postal-form]").addEventListener("submit", e => {
  e.preventDefault();
  const d = parsePostal(postalInput.value);
  if (!d) { postalErr.hidden = false; postalInput.setAttribute("aria-invalid", "true"); postalInput.focus(); return; }
  state.dest = d; store.set("postal", d.full); sheet.close(); render();
});
postalInput.addEventListener("input", () => { postalErr.hidden = true; postalInput.removeAttribute("aria-invalid"); });

// one quiet move: niches rise into place the first time they are seen
const seen = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); seen.unobserve(e.target); } }), { threshold: .2 }) : null;
function render() {
  const [a, b] = location.hash.replace(/^#\/?/, "").split("/");
  $("#main").innerHTML = a === "shop" ? viewShop(b) : a === "p" ? viewProduct(b) : a === "cart" ? viewCart() : a === "shipping" ? viewShipping() : viewHome();
  document.body.dataset.route = a || "home";
  document.documentElement.dataset.ground = a === "shop" ? (GROUND[b] || "emerald") : a === "p" && bySku[b] ? GROUND[bySku[b].cat] : "emerald";
  $$(".niche").forEach(n => seen ? seen.observe(n) : n.classList.add("is-in"));
  syncChrome();
}
let last = location.hash;
window.addEventListener("hashchange", () => { render(); if (location.hash !== last) { scrollTo(0, 0); $("#main").focus({ preventScroll: true }); } last = location.hash; });
render();
