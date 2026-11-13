import { PRODUCTS, CATEGORIES, BOXES } from "./catalog.js";
import { parsePostal, pack, quote, money, days, MAX_QTY, FUEL } from "./rates.js";

// ---------- state (everything read from storage is validated) ----------
const bySku = Object.fromEntries(PRODUCTS.map(p => [p.sku, p]));
const catById = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("oss:" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("oss:" + k, JSON.stringify(v)); } catch {} },
};
const cleanCart = x => Array.isArray(x)
  ? x.filter(l => l && bySku[l.sku] && Number.isInteger(l.qty) && l.qty > 0).map(l => ({ sku: l.sku, qty: Math.min(MAX_QTY, l.qty) })) : [];
const state = { whyOpen: false, dest: parsePostal(store.get("postal")), cart: cleanCart(store.get("cart")), ship: typeof store.get("ship") === "string" ? store.get("ship") : null };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const whole = n => "$" + Math.round(n).toLocaleString("en-CA");
const TONES = ["ember", "teal", "ruby", "cobalt", "gilt", "emerald"];
const SERIES = { Sultan: "ruby", Mamoun: "gilt", Cairo: "teal", Regent: "cobalt", Stuttgart: "emerald" };
const seriesOf = p => p.name.split(" ")[0] in SERIES ? p.name.split(" ")[0] : "";
// Colour is decided, not random: one jewel per series; everything else takes the next jewel along within its category.
const toneOf = p => p.dark ? "" : p.photo ? "bone" : SERIES[seriesOf(p)] || TONES[PRODUCTS.filter(x => x.cat === p.cat && !seriesOf(x)).indexOf(p) % TONES.length];
const place = d => d.city ? d.city : d.fsa;

const cartLines = () => state.cart.map(l => ({ product: bySku[l.sku], qty: l.qty }));
const cartCount = () => state.cart.reduce((a, l) => a + l.qty, 0);
function saveCart() { store.set("cart", state.cart); syncChrome(); }
function addToCart(sku) {
  const l = state.cart.find(x => x.sku === sku);
  if (l) l.qty = Math.min(MAX_QTY, l.qty + 1); else state.cart.push({ sku, qty: 1 });
  saveCart();
}
function setQty(sku, qty) {
  state.cart = cleanCart(state.cart.map(l => l.sku === sku ? { ...l, qty } : l)); saveCart(); render();
}
const bestFor = p => state.dest ? quote(state.dest, pack([{ product: p, qty: 1 }]))[0] : null;

// ---------- images ----------
const imgSrc = (p, small) => p.photo ? `img/${p.img}.webp` : `img/pc/${p.img}${small && !p.dark ? "-s" : ""}.webp`;
const SIZES = { card: "(min-width:1500px) 18vw, (min-width:960px) 22vw, (min-width:640px) 30vw, 46vw", pdp: "(min-width:960px) 50vw, 100vw",
  thumb: "96px", slab: "(min-width:960px) 42vw, 80vw", lineup: "(min-width:960px) 370px, 240px", cat: "(min-width:960px) 24vw, 44vw", resin: "(min-width:960px) 28vw, (min-width:640px) 40vw, 72vw" };
function srcset(p) {
  if (p.photo) return "";
  if (p.dark) return `srcset="img/pc/${p.img}.webp 800w${p.lw ? `, img/pc/${p.img}-l.webp ${p.lw}w` : ""}"`;
  return `srcset="img/pc/${p.img}-s.webp 360w, img/pc/${p.img}-m.webp 540w, img/pc/${p.img}.webp 720w${p.lw ? `, img/pc/${p.img}-l.webp ${p.lw}w` : ""}"`;
}
function shot(p, { small = false, eager = false, use = small ? "card" : "pdp", cls = "", alt = "" } = {}) {
  const plain = p.dark || p.photo;
  return `<img class="${plain ? "shot shot--photo" : "shot"} ${cls}" src="${imgSrc(p, small)}" ${srcset(p)} ${p.photo ? "" : `sizes="${SIZES[use]}"`} alt="${esc(alt)}" width="${p.dark ? 1080 : 720}" height="${p.dark ? 1080 : 900}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// ---------- THE STICKER (device): the delivered price, slapped on the product ----------
function sticker(p, { big = false } = {}) {
  const n = parseInt(p.sku.slice(-3), 10), r = ((n * 37) % 23) - 13; // -13..+9 degrees, fixed per product
  return `<span class="sticker ${big ? "sticker--big" : ""}" style="--r:${r}deg"><span class="sticker__v">${whole(p.price)}</span></span>`;
}

function card(p, i = 9) {
  const tone = toneOf(p);
  return `
  <article class="card" data-tone="${tone}">
    <a class="card__a" href="#/p/${p.sku}" data-piece="${p.sku}">
      <div class="tile ${p.dark || p.photo ? "tile--photo" : ""}">${shot(p, { small: true, eager: i < 2 })}${sticker(p)}</div>
      <h3 class="card__name">${esc(p.name)}</h3>
    </a>
    <p class="card__meta">${esc(p.note)}</p>
  </article>`;
}

// ---------- views ----------
function viewHome() {
  const picks = ["Sultan Totem", "Stuttgart Pure, Jade", "Regent Neon Blue", "Cairo Avatar", "Carbon Black", "Mamoun Moagza Copper", "Regent Neon Pink", "Orbit"].map(n => PRODUCTS.find(p => p.name === n)).filter(Boolean).slice(0, 8);
  const resin = PRODUCTS.filter(p => p.dark);
  const SLABS = ["gilt", "cobalt", "ruby", "emerald", "teal"];
  const stars = ["Mamoun Hatshepsut", "Orbit", "Mamoun Cafe Chiller", "Lounge Six", "Mamoun Star"].map(n => PRODUCTS.find(p => p.name === n)).filter(Boolean);
  return `
  <section class="hero">
    <div class="hero__stage">
      <div class="hero__slabs" aria-hidden="true">${stars.map((p, i) => `<span data-tone="${SLABS[i]}"></span>`).join("")}</div>
      <p class="hero__word" aria-hidden="true">Hookahs,</p>
      <div class="hero__pieces">${stars.map((p, i) => `<a class="piece" href="#/p/${p.sku}" style="--cm:${p.height};--i:${i}" aria-label="${esc(p.name)}, ${whole(p.price)}">${shot(p, { eager: true, use: "slab" })}${sticker(p)}</a>`).join("")}</div>
    </div>
    <div class="hero__in">
      <h1 class="hero__h"><span class="sr">Hookahs, </span>and everything that goes with them.</h1>
      <div class="hero__side">
        <p class="hero__p">Egyptian brass, German steel and hand\u2011cut glass. In store in Windsor, shipped across Canada.</p>
        <div class="hero__cta"><a class="btn" href="#/shop/hookahs">Shop hookahs</a><a class="btn btn--ghost" href="#/shop">See everything</a></div>
      </div>
    </div>
  </section>
  <section class="cats" aria-label="Shop by category">
    ${CATEGORIES.map(c => { const n = PRODUCTS.filter(p => p.cat === c.id).length; const lead = PRODUCTS.find(p => p.cat === c.id && !p.dark);
      return `<a class="cat" data-tone="${c.tone}" href="#/shop/${c.id}"><span class="cat__ar" lang="ar" dir="rtl" aria-hidden="true">${c.ar}</span>${shot(lead, { small: true, use: "cat", cls: "cat__img" })}<span class="cat__name">${c.name}</span><span class="cat__n num">${n}</span></a>`; }).join("")}
  </section>
  <section class="shelf">
    <header class="shelf__head"><h2 class="h2">New this week</h2><a class="link" href="#/shop/hookahs">All ${PRODUCTS.filter(p => p.cat === "hookahs").length} hookahs</a></header>
    <div class="grid">${picks.map((p, i) => card(p, i + 8)).join("")}</div>
  </section>
  <section class="lineup" aria-labelledby="lu-h">
    <header class="lineup__head"><h2 class="h2 h2--xl" id="lu-h">Compare heights.</h2><p class="lineup__note">A dozen hookahs from the shelf, tallest to shortest.</p></header>
    <div class="lineup__row" tabindex="0" role="group" aria-label="Hookahs by height">
      ${PRODUCTS.filter(p => p.cat === "hookahs" && p.height && !p.dark).sort((a, b) => b.height - a.height).filter((p, i) => i % 3 === 0).map(p =>
        `<a class="lu" href="#/p/${p.sku}" style="--cm:${p.height}"><img class="lu__img" src="img/pc/${p.img}-s.webp" ${srcset(p)} sizes="${SIZES.lineup}" alt="" loading="lazy" width="360" height="450"><span class="lu__cm num">${p.height} cm</span><span class="lu__name">${esc(p.name)}</span></a>`).join("")}
    </div>
  </section>
  <section class="resin">
    <div class="resin__copy">
      <p class="resin__ar" lang="ar" dir="rtl" aria-hidden="true">&#x642;&#x637;&#x639;&#x629; &#x648;&#x627;&#x62d;&#x62f;&#x629;</p>
      <h2 class="h2 h2--xl">One of one.</h2>
      <p class="lead">Poured resin stems. No two come out of the mould the same, so when one sells, that one is gone.</p>
      <a class="btn" href="#/p/${resin[0].sku}">See the resin stems</a>
    </div>
    <div class="resin__row">${resin.map(p => `<a class="resin__item" href="#/p/${p.sku}" data-piece="${p.sku}">${shot(p, { use: "resin" })}<span class="resin__name">${esc(p.name)}</span>${sticker(p)}</a>`).join("")}</div>
  </section>
  <section class="pack">
    <img class="pack__img" src="img/wide-ember-800.webp" srcset="img/wide-ember-800.webp 800w, img/wide-ember.webp 1600w" sizes="(min-width:960px) 42vw, 100vw" alt="" loading="lazy" width="800" height="533">
    <div class="pack__copy">
      <h2 class="h2 h2--xl">How we ship glass.</h2>
      <ul class="pack__list">
        <li><b>Taken apart.</b> Stem, base and tray are wrapped separately so nothing long carries the weight.</li>
        <li><b>Double boxed.</b> The base sits in its own box inside the shipping box.</li>
        <li><b>Covered.</b> Glass orders over $100 ship with signature and full coverage.</li>
      </ul>
      <a class="link" href="#/shipping">How shipping works</a>
    </div>
  </section>`;
}

function viewShop(cat) {
  const c = catById[cat] || null, list = c ? PRODUCTS.filter(p => p.cat === c.id) : PRODUCTS;
  const groups = cat === "hookahs" ? [...Object.keys(SERIES).map(k => [k, list.filter(p => seriesOf(p) === k)]), ["More from the shelf", list.filter(p => !seriesOf(p) && !p.dark)], ["One of one", list.filter(p => p.dark)]].filter(g => g[1].length) : [["", list]];
  return `
  <section class="shophead" data-tone="${c ? c.tone : "bone"}">
    <h1 class="shophead__h">${c ? c.name : "Everything"}</h1>
    <p class="shophead__ar" lang="ar" dir="rtl" aria-hidden="true">${c ? c.ar : "&#x643;&#x644; &#x634;&#x64a;"}</p>
    <p class="shophead__n"><span class="num">${list.length}</span> items</p>
  </section>
  <nav class="chips" aria-label="Categories"><a href="#/shop" ${!c ? 'aria-current="page"' : ""}>All</a>${CATEGORIES.map(x => `<a href="#/shop/${x.id}" ${c && c.id === x.id ? 'aria-current="page"' : ""}>${x.name}</a>`).join("")}</nav>
  <div class="grid grid--shop">${groups.map(([name, items]) => (name ? `<h2 class="series">${name} <span class="num">${items.length}</span></h2>` : "") + items.map(card).join("")).join("")}</div>`;
}

function viewProduct(sku) {
  const p = bySku[sku];
  if (!p) return `<section class="empty"><h1 class="h2 h2--xl">That one is gone.</h1><p class="lead">It may have sold. <a class="link" href="#/shop">See what is on the counter</a>.</p></section>`;
  const c = catById[p.cat], parcels = pack([{ product: p, qty: 1 }]), opts = state.dest ? quote(state.dest, parcels) : [], b = parcels[0];
  const inCart = state.cart.some(l => l.sku === sku);
  const more = PRODUCTS.filter(x => x.cat === p.cat && x.sku !== sku && !x.dark).slice(0, 4);
  return `
  <article class="pdp" data-tone="${toneOf(p)}">
    <div data-stage="${p.sku}" class="pdp__tile tile ${p.dark || p.photo ? "tile--photo" : ""}">${shot(p, { eager: true, alt: p.name })}${sticker(p, { big: true })}${p.dark || p.photo ? "" : `<button class="truecolour" type="button" data-true aria-pressed="false">True colour</button>`}</div>
    <div class="pdp__info">
      <p class="crumb"><a href="#/shop/${p.cat}">${c.name}</a></p>
      <h1 class="pdp__name">${esc(p.name)}</h1>
      <p class="pdp__note">${esc(p.note)}${p.height ? `. Stands ${p.height} cm.` : "."}</p>
      ${inCart ? `<a class="btn btn--wide" href="#/cart">In your cart. View cart</a>` : `<button class="btn btn--wide" type="button" data-add="${p.sku}">Add to cart</button>`}
      <section class="ways" aria-labelledby="ways-h">
        <h2 class="h3" id="ways-h">Shipping estimate</h2>
        ${opts.length ? `<p class="ways__to">To ${esc(state.dest.full)}${state.dest.city ? ", " + esc(state.dest.city) : ""}. <button class="link" type="button" data-open-postal>Change</button></p>
        <table class="ledger"><thead><tr><th scope="col">Service</th><th scope="col">Arrives</th><th scope="col" class="r">Cost</th></tr></thead>
        <tbody>${opts.map(o => `<tr><td>${o.carrier} ${o.service}</td><td>${days(o.days)}</td><td class="r num">${money(o.total)}</td></tr>`).join("")}
        <tr><td>Pick up at the Windsor counter</td><td>Today</td><td class="r num">Free</td></tr></tbody></table>`
        : `<p class="ways__to">Ships anywhere in Canada, or pick up free at the Windsor counter.</p><button class="btn btn--ghost btn--wide" type="button" data-open-postal>Estimate shipping to my postal code</button>`}
      </section>
      <section class="spec" aria-labelledby="spec-h">
        <h2 class="h3" id="spec-h">What ships</h2>
        <dl class="spec__list">
          <div><dt>Item</dt><dd class="num">${p.sku}</dd></div>
          <div><dt>Weight, packed</dt><dd class="num">${b.kg} kg</dd></div>
          <div><dt>Box</dt><dd><span class="num">${b.l} \u00d7 ${b.w} \u00d7 ${b.h} cm</span>, ${esc(b.label.toLowerCase())}</dd></div>
          ${opts.length ? `<div><dt>Billed as</dt><dd><span class="num">${opts[0].perParcel[0].billableKg} kg</span>, the larger of weight and box size</dd></div>` : ""}
          ${p.glass ? `<div><dt>Glass</dt><dd>Double boxed${p.price > 100 ? ", signature and coverage included" : ""}</dd></div>` : ""}
        </dl>
      </section>
    </div>
  </article>
  ${more.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">More ${c.name.toLowerCase()}</h2><a class="link" href="#/shop/${p.cat}">All ${c.name.toLowerCase()}</a></header><div class="grid">${more.map(card).join("")}</div></section>` : ""}`;
}

function viewCart() {
  const lines = cartLines();
  if (!lines.length) return `<section class="empty"><h1 class="h2 h2--xl">Nothing in the cart yet.</h1><p class="lead">Start with the <a class="link" href="#/shop/hookahs">hookahs</a>. Shipping is priced in the cart.</p></section>`;
  const parcels = pack(lines), opts = state.dest ? quote(state.dest, parcels) : [];
  const chosen = opts.find(o => o.id === state.ship) || opts[0], sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const tooHeavy = state.dest && !opts.length;
  return `
  <section class="cart">
    <h1 class="h2 h2--xl">Your cart</h1>
    <ul class="lines">${lines.map(({ product: p, qty }) => `
      <li class="line" data-tone="${toneOf(p)}">
        <a class="line__tile tile ${p.dark || p.photo ? "tile--photo" : ""}" href="#/p/${p.sku}">${shot(p, { small: true, use: "thumb" })}</a>
        <div class="line__body"><a class="line__name" href="#/p/${p.sku}">${esc(p.name)}</a><p class="line__meta num">${p.sku} &middot; ${p.kg} kg</p>
          <div class="qty"><button type="button" aria-label="One less ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty - 1}">&minus;</button><span class="num" aria-live="polite">${qty}</span><button type="button" aria-label="One more ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty + 1}" ${qty >= MAX_QTY ? "disabled" : ""}>+</button></div></div>
        <p class="line__price num">${money(p.price * qty)}</p>
      </li>`).join("")}</ul>
    <section class="cartship">
      <h2 class="h3">How it ships</h2>
      <ol class="boxes">${parcels.map(p => `<li><span class="num">${p.l} \u00d7 ${p.w} \u00d7 ${p.h} cm, ${p.kg} kg</span> ${esc(p.label.toLowerCase())}, ${p.items.length} ${p.items.length === 1 ? "item" : "items"}</li>`).join("")}</ol>
      ${!state.dest ? `<button class="btn btn--wide" type="button" data-open-postal>Add postal code to price shipping</button>` : ""}
      ${tooHeavy ? `<p class="note">One of these boxes is over the 30 kg carrier limit. Call the counter at 519-255-2222 and we will quote it by hand.</p>` : ""}
      ${opts.length ? `<fieldset class="opts"><legend>Shipping to ${esc(state.dest.full)} <button class="link" type="button" data-open-postal>Change</button></legend>
        ${opts.map(o => `<label class="opt"><input type="radio" name="ship" value="${o.id}" ${o.id === chosen.id ? "checked" : ""}><span class="opt__name">${o.carrier} ${o.service}<small>${days(o.days)}</small></span><span class="num">${money(o.total)}</span></label>`).join("")}
      </fieldset>
      <details class="why" ${state.whyOpen ? "open" : ""}><summary>What makes up ${money(chosen.total)}</summary><dl>
        ${chosen.perParcel.map((p, i) => `<div><dt>Box ${i + 1}, billed at ${p.billableKg} kg</dt><dd class="num">${money(p.freight)}</dd></div>`).join("")}
        ${chosen.cover ? `<div><dt>Glass coverage and signature</dt><dd class="num">${money(chosen.cover)}</dd></div>` : ""}
        <div><dt>Carrier fuel charge, ${(FUEL.pct * 100).toFixed(1)}% for ${FUEL.week}</dt><dd class="num">${money(chosen.fuel)}</dd></div></dl></details>` : ""}
    </section>
    <dl class="totals">
      <div><dt>Items</dt><dd class="num">${money(sub)}</dd></div>
      <div><dt>Shipping</dt><dd class="num">${chosen ? money(chosen.total) : "add postal code"}</dd></div>
      <div class="totals__door"><dt>Total before tax</dt><dd class="num">${chosen ? money(sub + chosen.total) : money(sub)}</dd></div>
    </dl>
    <button class="btn btn--wide" type="button" ${chosen ? "" : "disabled"}>Checkout</button>
    <p class="fine">Tax is added at checkout. Checkout is not connected in this mockup.</p>
  </section>`;
}

function viewShipping() {
  return `
  <section class="reading">
    <p class="shophead__ar" lang="ar" dir="rtl" aria-hidden="true">&#x627;&#x644;&#x62a;&#x648;&#x635;&#x64a;&#x644;</p>
    <h1 class="h2 h2--xl">Shipping</h1>
    <p class="lead">We pack every order at the counter in Windsor and ship to every province and territory.</p>
    <h2 class="h3">What it costs</h2>
    <p>Shipping is worked out from the packed weight and box size of your order and the carrier\u2019s rate to your postal code. You see the cost on the product page and in the cart before you pay.</p>
    <p><button class="btn btn--ghost" type="button" data-open-postal>${state.dest ? "Estimating to " + esc(state.dest.full) + ". Change" : "Enter my postal code"}</button></p>
    <h2 class="h3">How glass is packed</h2>
    <p>Hookahs ship taken apart. The glass base is double boxed. If anything arrives broken, send a photo and we make it right.</p>
    <h2 class="h3">What we ship</h2>
    <p>Hookahs, bases, bowls, heat keepers, hoses, parts and frames. Anything else in the shop is counter only.</p>
    <h2 class="h3">Pick up</h2>
    <p>Order online and pick up at the counter for free. Call <a class="link" href="tel:+15192552222">519-255-2222</a>.</p>
  </section>`;
}

// ---------- chrome, sheet, router ----------
function syncChrome() {
  $$("[data-cart-count]").forEach(e => e.textContent = cartCount());
  const h = location.hash || "#/";
  $("[data-nav]").innerHTML = CATEGORIES.map(c => `<a href="#/shop/${c.id}" ${h === "#/shop/" + c.id ? 'aria-current="page"' : ""}>${c.name}</a>`).join("") + `<a href="#/shipping" ${h === "#/shipping" ? 'aria-current="page"' : ""}>Shipping</a>`;
  const [ra, rb] = h.replace(/^#\/?/, "").split("/"), prod = ra === "p" ? bySku[rb] : null;
  const count = `<span data-cart-count>${cartCount()}</span>`, dock = $(".dock");
  dock.classList.toggle("dock--buy", !!prod);
  const lines = cartLines(), sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const qs = ra === "cart" && state.dest && lines.length ? quote(state.dest, pack(lines)) : [], ship = qs.find(o => o.id === state.ship) || qs[0];
  dock.classList.toggle("dock--buy", !!prod || (ra === "cart" && lines.length > 0));
  dock.innerHTML = prod
    ? `<a class="dock__side" href="#/shop/${prod.cat}">Back</a>${state.cart.some(l => l.sku === prod.sku)
        ? `<a class="dock__buy" href="#/cart">In cart. View cart</a>` : `<button class="dock__buy" type="button" data-add="${prod.sku}">Add to cart <span class="num">${whole(prod.price)}</span></button>`}<a class="dock__side" href="#/cart" aria-label="Cart">${count}</a>`
    : ra === "cart" && lines.length
    ? `<a class="dock__side" href="#/shop">Shop</a><button class="dock__buy" type="button" ${ship ? "" : "data-open-postal"}>${ship ? `Checkout <span class="num">${money(sub + ship.total)}</span>` : "Add postal code for shipping"}</button><span class="dock__side">${count}</span>`
    : `<a href="#/" ${h === "#/" ? 'aria-current="page"' : ""}>Home</a><a href="#/shop" ${h.startsWith("#/shop") ? 'aria-current="page"' : ""}>Shop</a><a href="#/cart" ${h === "#/cart" ? 'aria-current="page"' : ""}>Cart ${count}</a>`;
}
const sheet = $("[data-postal-sheet]"), postalInput = $("#postal"), postalErr = $("#postal-err");
function openSheet() { postalInput.value = state.dest ? state.dest.full : ""; postalErr.hidden = true; postalInput.removeAttribute("aria-invalid"); sheet.showModal(); postalInput.focus(); postalInput.select(); }
document.addEventListener("click", e => {
  if (e.target.closest("[data-open-postal]")) openSheet();
  else if (e.target.closest("[data-close-postal]") || e.target === sheet) sheet.close();
  const tc = e.target.closest("[data-true]");
  if (tc) { const on = tc.getAttribute("aria-pressed") !== "true"; tc.setAttribute("aria-pressed", on); tc.closest("[data-stage]").toggleAttribute("data-truecolour", on); }
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

document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches(".why")) state.whyOpen = e.target.open; }, true);
function focusKey(el) {
  if (!el || el === document.body) return null;
  for (const k of ["data-qty", "data-add"]) if (el.hasAttribute(k)) return `[${k}="${el.getAttribute(k)}"]` + (el.dataset.n ? `[aria-label="${el.getAttribute("aria-label")}"]` : "");
  if (el.name === "ship") return `input[name="ship"][value="${el.value}"]`;
  return null;
}
function render() {
  const keep = focusKey(document.activeElement);
  const [a, b] = location.hash.replace(/^#\/?/, "").split("/");
  $("#main").innerHTML = a === "shop" ? viewShop(b) : a === "p" ? viewProduct(b) : a === "cart" ? viewCart() : a === "shipping" ? viewShipping() : viewHome();
  document.body.dataset.route = a || "home";
  syncChrome();
  if (keep) { const el = document.querySelector(keep); if (el) el.focus({ preventScroll: true }); }
}
let last = location.hash;
document.addEventListener("click", e => {
  const a = e.target.closest("[data-piece]"); if (!a) return;
  $$(".tile").forEach(n => n.style.viewTransitionName = "");
  const n = $(".tile", a) || a; n.style.viewTransitionName = "piece";
  $$(".sticker").forEach(x => x.style.viewTransitionName = ""); const st = $(".sticker", a); if (st) st.style.viewTransitionName = "tag";
}, true);
function go() {
  const from = last.match(/^#\/p\/(.+)$/); last = location.hash;
  render(); scrollTo(0, 0);
  const stage = $("[data-stage]");
  if (stage) { stage.style.viewTransitionName = "piece"; const st = $(".sticker", stage); if (st) st.style.viewTransitionName = "tag"; }
  else if (from) { const back = $(`[data-piece="${from[1]}"]`), n = back && ($(".tile", back) || back); if (n) { n.style.viewTransitionName = "piece"; const st = $(".sticker", back); if (st) st.style.viewTransitionName = "tag"; n.scrollIntoView({ block: "center" }); } }
  $("#main").focus({ preventScroll: true });
}
window.addEventListener("hashchange", () => {
  if (location.hash === last) return;
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go); else go();
});
render();
