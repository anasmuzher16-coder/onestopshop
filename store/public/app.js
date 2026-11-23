import { PRODUCTS, CATEGORIES, BOXES } from "/api/catalog-module";
import { route, navigate, navInfo } from "./route.js";
import { parsePostal, pack, quote, money, days, MAX_QTY, fuelOn, taxRate, taxLabel, localArea, localDue, localEta, FREE_LOCAL_CENTS, SHOP_HOURS } from "./rates.js";

// ---------- state (everything read from storage is validated) ----------
const bySku = Object.fromEntries(PRODUCTS.map(p => [p.sku, p]));
const catById = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("oss:" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("oss:" + k, JSON.stringify(v)); } catch {} },
};
const cleanCart = x => Array.isArray(x)
  ? x.filter(l => l && bySku[l.sku] && Number.isInteger(l.qty) && l.qty > 0).map(l => ({ sku: l.sku, qty: Math.min(MAX_QTY, l.qty) })) : [];
const state = { reach: ["local", "nationwide"].includes(store.get("reach")) ? store.get("reach") : null, whyOpen: false, q: "", note: typeof store.get("note") === "string" ? store.get("note") : "", set: {}, dest: parsePostal(store.get("postal")), cart: cleanCart(store.get("cart")), ship: typeof store.get("ship") === "string" ? store.get("ship") : null };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const whole = n => "$" + (Math.round(n * 100) % 100 ? n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString("en-CA")); // cents only when the price has them
const TONES = ["ember", "teal", "ruby", "cobalt", "gilt", "emerald"];
const SERIES = { Sultan: "ruby", Mamoun: "gilt", Cairo: "teal", Regent: "cobalt", Stuttgart: "emerald" };
const seriesOf = p => p.name.split(" ")[0] in SERIES ? p.name.split(" ")[0] : "";
// Colour is decided, not random: one jewel per series; everything else takes the next jewel along within its category.
const toneOf = p => p.dark ? "" : p.photo ? "bone" : SERIES[seriesOf(p)] || TONES[PRODUCTS.filter(x => x.cat === p.cat && !seriesOf(x)).indexOf(p) % TONES.length];
const place = d => d.city ? d.city : d.fsa;
const byName = n => PRODUCTS.find(p => p.name === n);
const SOLD = new Set(["Resin Bishop, Clear Blue"]); // mockup: one of the one-of-one stems has sold
const isSold = p => SOLD.has(p.name) || p.stock === 0; // a one-off that has gone, or anything the shop has none of
const inCat = c => PRODUCTS.filter(p => p.cat === c && !p.dark);
const SHOP_STREET = "760 Wyandotte St E", SHOP_ADDRESS = "760 Wyandotte St E, Windsor, ON N9A 3J4", SHOP_MAP = "https://www.google.com/maps/search/?api=1&query=One%20Stop%20Shop%2C%20760%20Wyandotte%20St%20E%2C%20Windsor%2C%20ON%20N9A%203J4";
const directions = (label = "Get directions") => `<a class="link" href="${SHOP_MAP}" target="_blank" rel="noopener">${label}</a>`;
const HOURS = SHOP_HOURS, DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const h12 = h => (h % 12 || 12) + (h < 12 ? " am" : " pm");
function nowInWindsor() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "long", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: DAYS.indexOf(parts.weekday), t: (+parts.hour % 24) + +parts.minute / 60 };
}
function openLine() {
  const { day, t } = nowInWindsor(), [o, c] = HOURS[day], next = HOURS[(day + 1) % 7];
  return t >= o && t < c ? `Open now until ${h12(c)}` : t < o ? `Opens today at ${h12(o)}` : `Closed now. Opens ${DAYS[(day + 1) % 7]} at ${h12(next[0])}`;
}

const cartLines = () => state.cart.map(l => ({ product: bySku[l.sku], qty: l.qty }));
const cartCount = () => state.cart.reduce((a, l) => a + l.qty, 0);
const toCents = n => Math.round(n * 100);
const cartCents = (lines = cartLines()) => lines.reduce((a, l) => a + toCents(l.product.price) * l.qty, 0);
const feeText = n => n === 0 ? "Free" : money(n);
// Pickup-only pieces never go by Canada Post. Our own driver can still bring them.
const carried = lines => !lines.some(l => l.product.ship === "pickup_only");
const cpQuote = lines => state.dest && carried(lines) ? quote(state.dest, pack(lines)) : [];
const freeNote = sub => sub >= FREE_LOCAL_CENTS ? "Free local delivery: your items are $200 or more before tax." : `Local delivery is free on orders of $200 or more before tax. Add ${money((FREE_LOCAL_CENTS - sub) / 100)} more to get it.`;
function saveCart() { store.set("cart", state.cart); syncChrome(); }
function addToCart(sku) {
  if (!bySku[sku] || isSold(bySku[sku])) return;
  const l = state.cart.find(x => x.sku === sku);
  if (l) l.qty = Math.min(MAX_QTY, l.qty + 1); else state.cart.push({ sku, qty: 1 });
  saveCart();
}
function setQty(sku, qty) {
  state.cart = cleanCart(state.cart.map(l => l.sku === sku ? { ...l, qty } : l)); saveCart(); render();
}
const bestFor = p => cpQuote([{ product: p, qty: 1 }])[0] || null;

// ---------- images ----------
const V = "?v=1794615693"; // bumped on every photo rebuild so no phone keeps an old copy
const imgSrc = (p, small) => p.photo ? (p.img[0] === "/" ? p.img : `img/${p.img}.webp`) : `img/pc/${p.img}${small && !p.dark ? "-s" : ""}.webp${V}`;
const SIZES = { card: "(min-width:1500px) 18vw, (min-width:960px) 22vw, (min-width:640px) 30vw, 46vw", pdp: "(min-width:960px) 50vw, 100vw",
  thumb: "96px", slab: "(min-width:960px) 42vw, 58vw", lineup: "(min-width:960px) 370px, 240px", cat: "(min-width:960px) 24vw, 44vw", cat1: "(min-width:960px) 42vw, 44vw", resin: "(min-width:960px) 28vw, (min-width:640px) 40vw, 72vw" };
function srcset(p) {
  if (p.photo) return "";
  if (p.dark) return `srcset="img/pc/${p.img}.webp${V} 800w${p.lw ? `, img/pc/${p.img}-l.webp${V} ${p.lw}w` : ""}"`;
  return `srcset="img/pc/${p.img}-s.webp${V} 360w, img/pc/${p.img}-m.webp${V} 540w, img/pc/${p.img}.webp${V} 720w${p.lw ? `, img/pc/${p.img}-l.webp${V} ${p.lw}w` : ""}"`;
}
function shot(p, { small = false, eager = false, use = small ? "card" : "pdp", cls = "", alt = "" } = {}) {
  if (!p.img) return `<span class="shot shot--none ${cls}" role="img" aria-label="${esc(alt || "Photo coming soon")}">Photo coming soon</span>`; // added in the back office, no photo yet
  const plain = p.dark || p.photo;
  return `<img class="${plain ? "shot shot--photo" : "shot"} ${cls}" src="${imgSrc(p, small)}" ${srcset(p)} ${p.photo ? "" : `sizes="${SIZES[use]}"`} alt="${esc(alt)}" width="${p.dark ? 1080 : 720}" height="${p.dark ? 1080 : 900}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// ---------- THE STICKER (device): the delivered price, slapped on the product ----------
function sticker(p, { big = false } = {}) {
  const n = parseInt(p.sku.slice(-3), 10), r = ((n * 37) % 23) - 13; // -13..+9 degrees, fixed per product
  return `<span class="sticker ${big ? "sticker--big" : ""} ${isSold(p) ? "sticker--sold" : ""}" style="--r:${r}deg"><span class="sticker__v">${isSold(p) ? "Sold" : whole(p.price)}</span></span>`;
}

function card(p, i = 9) {
  const tone = toneOf(p);
  return `
  <article class="card" data-tone="${tone}">
    <a class="card__a" href="/p/${p.sku}" data-piece="${p.sku}">
      <div class="tile ${p.dark || p.photo ? "tile--photo" : ""}">${shot(p, { small: true, eager: i < 2 })}${sticker(p)}</div>
      <h3 class="card__name">${esc(p.name)}</h3>
    </a>
    <p class="card__meta">${esc(p.note)}</p>
  </article>`;
}

// ---------- views ----------
// Every page opens with the same band the shop sections have: a flat jewel colour, the title, and room for the page's object.
const band = (fx, tone, title, note = "") => `<section class="shophead shophead--page" data-tone="${tone}" data-fx="${fx}"><h1 class="shophead__h">${title}</h1>${note ? `<p class="shophead__n">${note}</p>` : ""}</section>`;
function viewHome() {
  const picks = ["Sultan Totem", "Stuttgart Pure, Jade", "Regent Neon Blue", "Cairo Avatar", "Carbon Black", "Mamoun Moagza Copper", "Regent Neon Pink", "Orbit"].map(n => PRODUCTS.find(p => p.name === n)).filter(Boolean).slice(0, 8);
  const resin = PRODUCTS.filter(p => p.dark);
  const SLABS = ["gilt", "cobalt", "ruby", "emerald", "teal"];
  const ok = p => p && p.cat === "hookahs" && !p.dark && p.img && !isSold(p), named = ["Mamoun Hatshepsut", "Sultan Totem", "Mamoun Cafe Chiller", "Lounge Six", "Mamoun Star"].map(byName).filter(ok);
  const stars = [...named, ...PRODUCTS.filter(p => ok(p) && !named.includes(p))].slice(0, 5);   // always five live pieces while the shop has them; the grid follows the real count
  return `
  <section class="hero">
    <div class="hero__stage">
      <div class="hero__slabs" aria-hidden="true">${stars.map((p, i) => `<span data-tone="${SLABS[i]}"></span>`).join("")}</div>
      <p class="hero__word" aria-hidden="true">Hookahs,</p>
      <div class="hero__pieces">${stars.map((p, i) => `<a class="piece" href="/p/${p.sku}" style="--cm:${p.height};--i:${i}" aria-label="${esc(p.name)}, ${whole(p.price)}">${shot(p, { eager: i < 3, use: "slab" })}${sticker(p)}</a>`).join("")}</div>
    </div>
    <div class="hero__in">
      <h1 class="hero__h"><span class="hero__lead">Hookahs,</span> <span class="hero__rest">and everything that goes with them.</span></h1>
      <div class="hero__side">
        <p class="hero__p">Local delivery from $10 near Windsor, free pickup, and shipping across Canada. Egyptian brass, German steel and hand\u2011cut glass.</p>
        <div class="hero__cta"><a class="btn" href="/shop/hookahs">Shop hookahs</a><a class="btn btn--ghost" href="/shop">All ${PRODUCTS.length} pieces</a></div>
      </div>
    </div>
  </section>
  <section class="cats" aria-label="Shop by category">
    ${CATEGORIES.map((c, i) => { const n = PRODUCTS.filter(p => p.cat === c.id).length; const lead = PRODUCTS.find(p => p.cat === c.id && !p.dark);
      return `<a class="cat" data-tone="${c.tone}" href="/shop/${c.id}">${shot(lead, { small: i > 0, use: i ? "cat" : "cat1", cls: "cat__img" })}<span class="cat__name">${c.name}</span><span class="cat__n num">${n}</span></a>`; }).join("")}
  </section>
  <section class="shelf">
    <header class="shelf__head"><h2 class="h2">Counter picks</h2><a class="link" href="/shop/hookahs">All ${PRODUCTS.filter(p => p.cat === "hookahs").length} hookahs</a></header>
    <div class="grid">${picks.map((p, i) => card(p, i + 8)).join("")}</div>
  </section>
  <section class="gifts" aria-labelledby="gift-h">
    <header class="shelf__head"><h2 class="h2" id="gift-h">Gifts</h2><p class="gifts__note">Packed at the counter. Add a note in the cart.</p></header>
    <div class="gifts__row">
      ${[["under-50", "Under $50", "emerald", inCat("bowls")[0]], ["under-150", "Under $150", "cobalt", byName("Mamoun Moagza Copper")], ["set", "The full setup", "ruby", byName("Mamoun Kamanja Gold")]].map(([id, label, tone, lead]) =>
        `<a class="gift" data-tone="${tone}" href="${id === "set" ? "/set" : "/gifts/" + id}">${shot(lead, { small: true, use: "cat", cls: "gift__img" })}<span class="gift__name">${label}</span><span class="gift__sub">${id === "set" ? "Hookah, bowl, heat keeper, hose" : PRODUCTS.filter(p => !p.dark && (id === "under-50" ? p.price < 50 : p.price >= 50 && p.price <= 150)).length + " pieces"}</span></a>`).join("")}
    </div>
  </section>
  <section class="lineup" aria-labelledby="lu-h">
    <header class="lineup__head"><h2 class="h2 h2--xl" id="lu-h">Compare heights.</h2><p class="lineup__note">From the shelf, tallest to shortest.</p></header>
    <div class="lineup__row" tabindex="0" role="group" aria-label="Hookahs by height">
      ${PRODUCTS.filter(p => p.cat === "hookahs" && p.height && !p.dark).sort((a, b) => b.height - a.height).filter((p, i) => i % 3 === 0).map(p =>
        `<a class="lu" href="/p/${p.sku}" style="--cm:${p.height}"><img class="lu__img" src="img/pc/${p.img}-s.webp${V}" ${srcset(p)} sizes="${SIZES.lineup}" alt="" loading="lazy" width="360" height="450"><span class="lu__cm num">${p.height} cm</span><span class="lu__name">${esc(p.name)}</span></a>`).join("")}
    </div>
  </section>
  <section class="resin">
    <div class="resin__copy">
      <h2 class="h2 h2--xl">One of one.</h2>
      <p class="lead">Poured resin stems. No two come out of the mould the same, so when one sells, that one is gone.</p>
      <a class="btn" href="/shop/hookahs">See what is left</a>
    </div>
    <div class="resin__row">${resin.map(p => `<a class="resin__item" href="/p/${p.sku}" data-piece="${p.sku}">${shot(p, { use: "resin" })}<span class="resin__name">${esc(p.name)}</span>${sticker(p)}</a>`).join("")}</div>
  </section>
  <section class="pack">
    <div class="pack__copy">
      <h2 class="h2 h2--xl">How we ship glass.</h2>
      <ul class="pack__list">
        <li><b>Taken apart.</b> Stem, base and tray are wrapped separately so nothing long carries the weight.</li>
        <li><b>Double boxed.</b> The base sits in its own box inside the shipping box.</li>
        <li><b>Covered.</b> Glass orders over $100 ship with signature and full coverage.</li>
      </ul>
      <a class="link" href="/shipping">How shipping works</a>
    </div>
  </section>
  <section class="visit" aria-labelledby="visit-h">
    <div class="visit__main">
      <h2 class="h2 h2--xl" id="visit-h">Visit the counter.</h2>
      <p class="visit__now">${openLine()}</p>
      <dl class="visit__facts">
        <div><dt>Where</dt><dd>${SHOP_ADDRESS}<span class="visit__todo">${directions()}</span></dd></div>
        <div><dt>Pick up</dt><dd>Order online, pick up at the counter the same day. Free.</dd></div>
        <div><dt>Call</dt><dd><a class="link" href="tel:+15192552222">519-255-2222</a></dd></div>
        <div><dt>Rated</dt><dd>${directions("4.5 stars on Google, 115 reviews")}</dd></div>
      </dl>
    </div>
    <table class="visit__hours"><caption class="sr">Opening hours</caption><tbody>${[1, 2, 3, 4, 5, 6, 0].map(d => `<tr ${d === nowInWindsor().day ? 'class="is-today"' : ""}><th scope="row">${DAYS[d]}</th><td class="num">${h12(HOURS[d][0])} to ${h12(HOURS[d][1])}</td></tr>`).join("")}</tbody></table>
  </section>`;
}

function viewShop(cat) {
  const c = catById[cat] || null, list = c ? PRODUCTS.filter(p => p.cat === c.id) : PRODUCTS;
  const groups = cat === "hookahs" ? [...Object.keys(SERIES).map(k => [k, list.filter(p => seriesOf(p) === k)]), ["More from the shelf", list.filter(p => !seriesOf(p) && !p.dark)], ["One of one", list.filter(p => p.dark)]].filter(g => g[1].length) : [["", list]];
  return `
  <section class="shophead" data-tone="${c ? c.tone : "bone"}" ${c ? `data-cat="${c.id}"` : `data-fx="all"`}>
    <h1 class="shophead__h">${c ? c.name : "Everything"}</h1>
    <p class="shophead__n"><span class="num">${list.length}</span> pieces</p>
  </section>
  <nav class="chips" aria-label="Categories"><a href="/shop" ${!c ? 'aria-current="page"' : ""}>All</a>${CATEGORIES.map(x => `<a href="/shop/${x.id}" ${c && c.id === x.id ? 'aria-current="page"' : ""}>${x.name}</a>`).join("")}</nav>
  <div class="grid grid--shop">${groups.map(([name, items]) => (name ? `<h2 class="series" data-tone="${SERIES[name] || ""}">${name} <span class="num">${items.length} pieces, ${whole(Math.min(...items.map(x => x.price)))} to ${whole(Math.max(...items.map(x => x.price)))}</span></h2>` : "") + items.map(card).join("")).join("")}</div>`;
}

function viewProduct(sku) {
  const p = bySku[sku];
  if (!p) return `${band("missing", "ruby", "That one is gone.")}<section class="empty"><p class="lead">It may have sold. <a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
  const c = catById[p.cat], parcels = pack([{ product: p, qty: 1 }]), opts = cpQuote([{ product: p, qty: 1 }]), b = parcels[0];
  const inCart = state.cart.some(l => l.sku === sku);
  const more = PRODUCTS.filter(x => x.cat === p.cat && x.sku !== sku && !x.dark).sort((a, b) => (seriesOf(b) === seriesOf(p)) - (seriesOf(a) === seriesOf(p))).slice(0, 4);
  const n = parseInt(p.sku.slice(-3), 10), nth = (c, k) => { const l = inCat(c); return l[(n + k) % l.length]; };
  const goes = p.cat === "hookahs" ? [nth("bowls", 0), nth("heat", 1), nth("hoses", 2), nth("parts", 3)] : [];
  const sold = isSold(p);
  return `
  <article class="pdp" data-tone="${toneOf(p)}" data-cat="${p.cat}">
    <div data-stage="${p.sku}" class="pdp__tile tile ${p.dark || p.photo ? "tile--photo" : ""}">${shot(p, { eager: true, alt: p.name })}${sticker(p, { big: true })}</div>
    <div class="pdp__info">
      <p class="crumb"><a href="/shop/${p.cat}">${c.name}</a></p>
      <h1 class="pdp__name">${esc(p.name)}</h1>
      <p class="pdp__note">${esc(p.note)}${p.height ? `. Stands ${p.height} cm.` : "."}</p>
      ${p.details && p.details.notes ? `<p class="pdp__notes"><span>Notes</span> ${esc(p.details.notes)}</p>` : ""}
      ${sold ? `<p class="soldline">${SOLD.has(p.name) ? "This one has sold. Each resin stem is poured once." : "Sold out for now."}</p><a class="btn btn--ghost btn--call" href="tel:+15192552222">Call the counter</a>`
        : inCart ? `<a class="btn btn--wide" href="/cart">In your cart. View cart</a>` : `<button class="btn btn--wide" type="button" data-add="${p.sku}">Add to cart</button>`}
      ${deliveryLine(p, opts)}
      <section class="ways" aria-labelledby="ways-h">
        <h2 class="h3" id="ways-h">Delivery, shipping and pickup</h2>
        ${opts.length || (state.dest && p.ship === "pickup_only") ? `<p class="ways__to">To ${esc(state.dest.full)}${state.dest.city ? ", " + esc(state.dest.city) : ""}. <button class="link" type="button" data-open-postal>Change</button></p>
        <table class="ledger"><thead><tr><th scope="col">Service</th><th scope="col">Arrives</th><th scope="col" class="r">Cost</th></tr></thead>
        <tbody>${localRow(p)}${opts.map(o => `<tr><td>${o.carrier} ${o.service}</td><td>${days(o.days)}</td><td class="r num">${money(o.total)}</td></tr>`).join("")}
        <tr><td>Pick up at ${SHOP_STREET}</td><td>Today</td><td class="r num">Free</td></tr></tbody></table>`
        : `<p class="ways__to">Local delivery from $10 near Windsor. Free pickup. ${p.ship === "pickup_only" ? "Not sent by Canada Post." : p.ship === "ground_only" ? "Ships by ground across Canada." : "Ships across Canada."}</p><button class="btn btn--ghost btn--wide" type="button" data-open-postal>Check delivery to my postal code</button>`}
      </section>
      ${p.cat === "hookahs" ? `<section class="parts" aria-labelledby="parts-h">
        <h2 class="h3" id="parts-h">The parts</h2>
        <div class="parts__in">
          <svg class="parts__fig" viewBox="0 0 150 230" role="img" aria-label="Diagram of a hookah with six numbered parts" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
            <path d="M52 14h26l-5 20H57z"/><path d="M40 44c0 5 50 5 50 0"/><path d="M62 34v14M68 34v14"/>
            <path d="M62 48v84M68 48v84M58 72h14M58 100h14"/><path d="M56 132h18v10H56z"/><circle cx="50" cy="137" r="3.5"/>
            <path d="M74 137h9c16 0 22 14 18 30-3 13 6 22 22 20"/>
            <path d="M58 142c0 12-22 20-22 44 0 18 12 30 29 30s29-12 29-30c0-24-22-32-22-44"/><path d="M40 188h50" stroke-dasharray="3 4"/>
            <g class="parts__n" stroke="none" fill="currentColor" font-size="15" font-weight="600" text-anchor="middle">
              <text x="16" y="28">1</text><text x="16" y="50">2</text><text x="16" y="90">3</text><text x="16" y="141">4</text><text x="134" y="150">5</text><text x="16" y="200">6</text></g>
            <g stroke-width="1" opacity=".55"><path d="M24 24h26M24 46h14M24 86h36M24 137h20M126 146l-22 8M24 196h12"/></g>
          </svg>
          <ol class="parts__list">
            <li><b>Bowl.</b> Sits on top, under the heat keeper.</li><li><b>Tray.</b> Catches ash and holds the tongs.</li><li><b>Stem.</b> ${esc(p.note)}.</li>
            <li><b>Purge valve.</b> Clears the base in one breath out.</li><li><b>Hose port.</b> Takes any standard hose.</li><li><b>Base.</b> ${p.glass ? "Glass" : "Acrylic"}, holds the water.</li>
          </ol>
        </div>
        <h2 class="h3 parts__box">How it goes together</h2>
        <ul class="inbox">${[["1", "Stem"], ["1", p.glass ? "Glass base" : "Base"], ["1", "Tray"], ["1", "Bowl"], ["1", "Hose with handle"], ["1", "Tongs"], ["1 set", "Grommets"]].map(([q, t]) => `<li><span class="num">${q}</span>${t}</li>`).join("")}</ul>
      </section>` : ""}
      <section class="spec" aria-labelledby="spec-h">
        <h2 class="h3" id="spec-h">Packed size</h2>
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
  ${goes.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">Goes with this</h2><a class="link" href="/set">Build a set</a></header><div class="grid">${goes.map(card).join("")}</div></section>` : ""}
  ${more.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">More ${c.name.toLowerCase()}</h2><a class="link" href="/shop/${p.cat}">All ${c.name.toLowerCase()}</a></header><div class="grid">${more.map(card).join("")}</div></section>` : ""}`;
}

// ---------- gifts ----------
function viewGifts(kind) {
  const under = kind === "under-50", list = PRODUCTS.filter(p => !p.dark && (under ? p.price < 50 : p.price >= 50 && p.price <= 150)).sort((a, b) => b.price - a.price);
  return `
  <section class="shophead" data-tone="${under ? "emerald" : "cobalt"}" data-fx="gifts">
    <h1 class="shophead__h">${under ? "Under $50" : "Under $150"}</h1>
    <p class="shophead__n"><span class="num">${list.length}</span> gifts, packed at the counter</p>
  </section>
  <nav class="chips chips--on" aria-label="Gifts"><a href="/gifts/under-50" ${under ? 'aria-current="page"' : ""}>Under $50</a><a href="/gifts/under-150" ${!under ? 'aria-current="page"' : ""}>Under $150</a><a href="/set">The full setup</a></nav>
  <div class="grid grid--shop">${list.map(card).join("")}</div>`;
}

// ---------- build a set ----------
const SLOTS = [["hookah", "hookahs", "The hookah"], ["bowl", "bowls", "A bowl"], ["heat", "heat", "A heat keeper"], ["hose", "hoses", "A hose"]];
const setOpts = c => inCat(c).filter(p => !isSold(p));   // a set is never offered, or defaulted to, something the shop cannot sell
const canSet = p => p && !isSold(p) ? p : null;
function setPicks() { return SLOTS.map(([slot, cat]) => canSet(bySku[state.set[slot]]) || (slot === "hookah" ? canSet(byName("Mamoun Kamanja Gold")) : null) || setOpts(cat)[0] || null); }
function setSummary() {
  const picks = setPicks().filter(Boolean), lines = picks.map(product => ({ product, qty: 1 })), parcels = pack(lines), sum = picks.reduce((a, p) => a + p.price, 0);
  const q = cpQuote(lines)[0] || null;
  return `
    <h2 class="h3">Your set</h2>
    <ul class="setlines">${picks.map(p => `<li><span>${esc(p.name)}</span><span class="num">${money(p.price)}</span></li>`).join("")}</ul>
    <dl class="totals">
      <div><dt>Ships as</dt><dd>${parcels.length} ${parcels.length === 1 ? "box" : "boxes"}, <span class="num">${parcels.reduce((a, b) => a + b.kg, 0).toFixed(1)} kg</span></dd></div>
      <div><dt>Shipping${q ? " to " + esc(state.dest.full) : ""}</dt><dd>${q ? `<span class="num">${money(q.total)}</span>` : state.dest && !carried(lines) ? "Local delivery or pickup" : `<button class="link" type="button" data-open-postal>Add postal code</button>`}</dd></div>
      <div class="totals__door"><dt>Set price</dt><dd class="num">${money(sum)}</dd></div>
    </dl>
    ${picks.length ? `<button class="btn btn--wide" type="button" data-add-set>Add the set to cart</button>` : `<a class="btn btn--wide" href="/shop">See what is in stock</a>`}`;
}
function viewSet() {
  const picks = setPicks();
  return `
  <section class="shophead" data-tone="ruby" data-fx="set">
    <h1 class="shophead__h">Build a set</h1>
    <p class="shophead__n">Four picks. One box where it fits.</p>
  </section>
  <div class="set">
    <div class="set__steps">${SLOTS.map(([slot, cat, label], i) => `
      <section class="pick" aria-labelledby="pick-${slot}">
        <h2 class="h3" id="pick-${slot}"><span class="num">${i + 1}</span> ${label}</h2>
        <div class="pick__row" role="group" aria-label="${label}">${setOpts(cat).map(p => `<button class="pick__opt" type="button" data-set="${slot}" data-sku="${p.sku}" aria-pressed="${picks[i]?.sku === p.sku}" data-tone="${toneOf(p)}"><span class="tile">${shot(p, { small: true, use: "thumb" })}${sticker(p)}</span><span class="pick__name">${esc(p.name)}</span></button>`).join("")}</div>
      </section>`).join("")}</div>
    <aside class="set__sum" data-set-summary>${setSummary()}</aside>
  </div>`;
}

// ---------- search ----------
function searchResults() {
  const q = state.q.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return `<p class="lead">Try brass, steel, base, hose, or a name.</p>`;
  const hits = PRODUCTS.filter(p => { const hay = (p.name + " " + p.note + " " + catById[p.cat].name + " " + p.sku).toLowerCase(); return words.every(w => hay.includes(w)); });
  return hits.length ? `<p class="search__n"><span class="num">${hits.length}</span> ${hits.length === 1 ? "piece" : "pieces"}</p><div class="grid">${hits.slice(0, 40).map(card).join("")}</div>`
    : `<p class="lead">Nothing matches \u201c${esc(state.q.trim())}\u201d. Call the counter at <a class="link" href="tel:+15192552222">519-255-2222</a> and we will check the shelf.</p>`;
}
function viewSearch() {
  return `
  ${band("search", "teal", "Search")}
  <section class="search">
    <label class="field__label" for="q">Search all ${PRODUCTS.length} pieces</label>
    <input class="field field--text" id="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Brass, bowl, Sultan" value="${esc(state.q)}">
    <div class="search__out" data-search-out aria-live="polite">${searchResults()}</div>
  </section>`;
}

// One place decides how an order is travelling, so the cart, the dock and checkout can never disagree.
let localTicket = 0;
const localQ = () => state.localQ && state.localQ.postal === state.dest?.full ? state.localQ : null;
// The postal code alone gives the shopper one answer: $10, $15, or too far.
async function priceLocal() {
  const d = state.dest; if (!d || !d.complete || !localArea(d) || localQ()) return;
  const postal = d.full, ticket = ++localTicket; state.localQ = { postal, status: "checking" }; syncDelivery();
  let a = { status: "down" }; try { const r = await fetch("/api/delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postal }), signal: AbortSignal.timeout?.(20000) }); a = await r.json(); } catch {}
  if (ticket !== localTicket) return;   // a newer lookup owns the answer
  if (state.dest?.full !== postal) { state.localQ = null; return; }
  state.localQ = { postal, status: a.status, fee_cents: a.fee_cents }; syncDelivery();
  const on = route().replace(/^#\/?/, "").split("/")[0], f = $("[data-checkout]");
  if (f) {   // never rebuild a form someone is typing in
    const box = f.querySelector("[data-deliv-msg]"), btn = f.querySelector('button[type="submit"]');
    if (box && !btn.disabled) { if (a.status === "ok") refreshDelivery(f); else if (a.status === "far" || a.status === "down") { if (a.status === "far") state.farFor = postal; box.innerHTML = deliveryMsg(a.status); } }
    return;
  }
  if (["cart", "p", "checkout"].includes(on)) {
    const note = document.activeElement?.matches?.("[data-note]") ? document.activeElement : null, at = note ? [note.selectionStart, note.selectionEnd] : null;
    render();
    if (note) { const n = $("[data-note]"); if (n) { n.focus({ preventScroll: true }); n.setSelectionRange(at[0], at[1]); } }
  }
}
// What we can honestly say about delivery right now. The strip and the product line both read this, so they never disagree.
function deliveryNow(subCents = cartCents()) {
  const d = state.dest, from = "Local delivery from $10 near Windsor", either = "It ships across Canada, or pickup is free";
  if (!d) return { key: "none", msg: from, sub: "", act: "Check your postal code" };
  const far = { key: "far", msg: `${d.full} is past our delivery area`, sub: either, act: "Change" };
  if (localArea(d) && !d.complete) return { key: "partial", msg: from, sub: "", act: "Add your full postal code" };
  if (localArea(d)) {
    const q = localQ();
    if (!q || q.status === "checking") return { key: "checking", msg: `Checking delivery to ${d.full}`, sub: "", act: "Change" };
    if (q.status === "ok") { const due = localDue(q.fee_cents, subCents); return { key: "ok", msg: due ? `We deliver to ${d.full} for ${whole(due / 100)}` : `Free local delivery to ${d.full}`, sub: "", act: "Change" }; }
    if (q.status === "far") return far;
    if (q.status === "down") return { key: "down", msg: "We cannot check delivery right now", sub: either, act: "Try again" };
    return { key: "later", msg: `Delivery to ${d.full} is priced at checkout`, sub: "", act: "Change" };
  }
  if (d.complete && d.prov === "ON" && /^N[089]/.test(d.fsa)) return far;
  return { key: "ship", msg: `We ship to ${d.full}`, sub: "", act: "Change" };
}
function deliveryLine(p, opts) {
  if (isSold(p)) return "";
  let s = deliveryNow(cartCents() + (state.cart.some(l => l.sku === p.sku) ? 0 : toCents(p.price)));
  if (p.ship === "pickup_only" && (s.key === "far" || s.key === "ship" || s.key === "down")) s = { msg: "This one goes by local delivery or pickup", sub: "Canada Post does not carry it. Pickup is free", act: "Change" };
  else if (state.dest && !opts.length && (s.key === "far" || s.key === "ship" || s.key === "down")) s = { msg: `We cannot price shipping to ${state.dest.full} here`, sub: "Call 519-255-2222, or pickup is free", act: "Change" };
  return `<button class="dline" type="button" data-open-postal><span class="dline__msg">${esc(s.msg)}</span>${s.sub ? `<span class="dline__sub">${esc(s.sub)}</span>` : ""}<span class="dline__act">${esc(s.act)}</span></button>`;
}
function syncDelivery() {
  const box = $("[data-delivery-strip]"), btn = $(".dstrip__btn", box), on = route().replace(/^#\/?/, "").split("/")[0], answered = !!state.reach || (!!state.dest && (state.dest.complete || !localArea(state.dest))),
    choosing = on === "shop" && !answered && !store.get("choose-off"), show = choosing || (!["cart", "checkout", "order", "shop"].includes(on) && !answered && !store.get("strip-off"));   // gone once we have their answer, or once they close it. The product page and cart can still take one
  box.hidden = !show; box.dataset.mode = choosing ? "choose" : "slim"; btn.hidden = choosing; $(".dchoose", box).hidden = !choosing;
  btn.toggleAttribute("data-open-postal", show && !choosing);   // a hidden strip must never be the control that opens the sheet
  if (!show || choosing) return;
  const s = deliveryNow(), line = [s.msg, s.sub, s.act].filter(Boolean).join(". ");
  if (btn.getAttribute("aria-label") === line) return;   // same words: leave it alone
  const said = btn.hasAttribute("aria-label");
  $(".dstrip__msg", box).textContent = s.msg; $(".dstrip__sub", box).textContent = s.sub; $(".dstrip__act", box).textContent = s.act;
  btn.setAttribute("aria-label", line); box.dataset.state = s.key;
  if (said) $("[data-delivery-live]", box).textContent = s.sub ? `${s.msg}. ${s.sub}.` : `${s.msg}.`;
}
function localRow(p) {
  const q = localQ(); if (!state.dest?.complete || !localArea(state.dest) || !q || q.status === "far" || q.status === "down") return "";
  const sub = cartCents() + (state.cart.some(l => l.sku === p.sku) ? 0 : toCents(p.price)), when = localEta().replace(/^Arrives /, "");
  return `<tr><td>Local delivery</td><td>${when[0].toUpperCase() + when.slice(1)}</td><td class="r num">${q.status === "ok" ? feeText(localDue(q.fee_cents, sub) / 100) : q.status === "checking" ? "Checking" : "At checkout"}</td></tr>`;
}
function shipChoice(lines) {
  const parcels = pack(lines), opts = cpQuote(lines), q = localQ();
  const near = localArea(state.dest) && !!state.dest.complete && state.localOff !== state.dest.full;
  const checking = near && (!q || q.status === "checking"), canLocal = near && !!q && (q.status === "ok" || q.status === "address" || q.status === "unsure");
  const localFee = canLocal && q.status === "ok" ? localDue(q.fee_cents, cartCents(lines)) / 100 : null;
  const wantsLocal = state.ship === "local" || (!state.ship && state.reach !== "nationwide");   // someone who chose nationwide is never defaulted onto local delivery
  const pickup = state.ship === "pickup", local = !pickup && canLocal && wantsLocal, waiting = checking && wantsLocal;
  return { parcels, opts, canLocal, checking, localFee, status: near && q ? q.status : null, pickup, local, chosen: pickup || local || waiting || state.ship === "local" ? null : opts.find(o => o.id === state.ship) || opts[0] || null };
}
function viewCart() {
  const lines = cartLines();
  if (!lines.length) return `${band("cart", "gilt", "Your cart", "Nothing in it yet.")}<section class="empty"><p class="lead">Start with the <a class="link" href="/shop/hookahs">hookahs</a>, the <a class="link" href="/shop/bowls">bowls</a>, or <a class="link" href="/set">build a set</a>.</p></section>`;
  const was = shipChoice(lines); if (state.ship === "local" && !was.canLocal && !was.checking) { state.ship = null; store.set("ship", null); }   // the cart is where a new way of sending it is shown and chosen
  const { parcels, opts, canLocal, checking, localFee, status, pickup, local, chosen } = shipChoice(lines), sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const ready = pickup || local || !!chosen, otherWay = carried(lines) ? "You can still ship it or pick it up free." : "You can still pick it up free.";
  const localNote = !state.dest ? "" : !state.dest.complete && localArea(state.dest) ? `<p class="note">Add your full postal code to see your delivery price. <button class="link" type="button" data-open-postal>Add it</button></p>`
    : checking ? `<p class="note" role="status">Checking delivery to ${esc(state.dest.full)}.</p>`
    : status === "far" || (state.dest.complete && !localArea(state.dest) && state.dest.prov === "ON" && /^N[089]/.test(state.dest.fsa)) ? `<p class="note">${esc(state.dest.full)} is past our 25 km delivery area. ${otherWay}</p>`
    : status === "down" ? `<p class="note">We cannot check delivery right now. ${otherWay}</p>` : "";
  const tooHeavy = state.dest && !opts.length && !canLocal && carried(lines);
  return `
  ${band("cart", "gilt", "Your cart", `<span class="num">${lines.reduce((a, l) => a + l.qty, 0)}</span> ${lines.reduce((a, l) => a + l.qty, 0) === 1 ? "piece" : "pieces"}, packed at the counter`)}
  <section class="cart">
    <ul class="lines">${lines.map(({ product: p, qty }) => `
      <li class="line" data-tone="${toneOf(p)}">
        <a class="line__tile tile ${p.dark || p.photo ? "tile--photo" : ""}" href="/p/${p.sku}">${shot(p, { small: true, use: "thumb" })}</a>
        <div class="line__body"><a class="line__name" href="/p/${p.sku}">${esc(p.name)}</a><p class="line__meta num">${p.sku} &middot; ${p.kg} kg</p>
          <div class="qty"><button type="button" aria-label="One less ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty - 1}">&minus;</button><span class="num" aria-live="polite">${qty}</span><button type="button" aria-label="One more ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty + 1}" ${qty >= MAX_QTY ? "disabled" : ""}>+</button></div></div>
        <p class="line__price num">${money(p.price * qty)}</p>
      </li>`).join("")}</ul>
    <section class="cartship">
      <h2 class="h3">How we pack it</h2>
      <ol class="boxes">${parcels.map(p => `<li><span class="num">${p.l} \u00d7 ${p.w} \u00d7 ${p.h} cm, ${p.kg} kg</span> ${esc(p.label.toLowerCase())}, ${p.items.length} ${p.items.length === 1 ? "item" : "items"}</li>`).join("")}</ol>
      ${!state.dest ? `<button class="btn btn--wide" type="button" data-open-postal>Check delivery to my postal code</button>` : ""}
      ${localNote}
      ${state.dest && !carried(lines) ? `<p class="note">One piece here does not go by Canada Post. ${canLocal ? "Choose local delivery or free pickup." : "Pickup at the Windsor counter is free."}</p>` : ""}
      ${tooHeavy ? `<p class="note">One of these boxes is over the 30 kg carrier limit. Call the counter at 519-255-2222 and we will quote it by hand.</p>` : ""}
      ${opts.length || canLocal ? `<fieldset class="opts"><legend>Getting it to ${esc(state.dest.full)} <button class="link" type="button" data-open-postal>Change</button></legend>
        ${canLocal ? `<label class="opt"><input type="radio" name="ship" value="local" ${local ? "checked" : ""}><span class="opt__name">Local delivery<small>${localFee !== null ? localEta() : "We price it from your street address at checkout"}</small></span><span class="num">${localFee !== null ? feeText(localFee) : "At checkout"}</span></label>` : ""}
        <label class="opt"><input type="radio" name="ship" value="pickup" ${pickup ? "checked" : ""}><span class="opt__name">Pick up at the Windsor counter<small>${SHOP_STREET}, Windsor. Ready the same day</small></span><span class="num">Free</span></label>
        ${opts.map(o => `<label class="opt"><input type="radio" name="ship" value="${o.id}" ${chosen && o.id === chosen.id ? "checked" : ""}><span class="opt__name">${o.carrier} ${o.service}<small>${days(o.days)}</small></span><span class="num">${money(o.total)}</span></label>`).join("")}
      </fieldset>
      ${canLocal ? `<p class="note" data-free-note>${freeNote(cartCents(lines))}</p>` : ""}
      ${chosen ? `<details class="why" ${state.whyOpen ? "open" : ""}><summary>What makes up ${money(chosen.total)}</summary><dl>
        ${chosen.perParcel.map((p, i) => `<div><dt>Box ${i + 1}, billed at ${p.billableKg} kg</dt><dd class="num">${money(p.freight)}</dd></div>`).join("")}
        ${chosen.cover ? `<div><dt>Glass coverage and signature</dt><dd class="num">${money(chosen.cover)}</dd></div>` : ""}
        <div><dt>Carrier fuel charge, ${(fuelOn().pct * 100).toFixed(1)}%, the rate posted for ${fuelOn().week}</dt><dd class="num">${money(chosen.fuel)}</dd></div></dl></details>` : ""}` : `<fieldset class="opts"><legend>Or skip shipping</legend><label class="opt"><input type="radio" name="ship" value="pickup" ${pickup ? "checked" : ""}><span class="opt__name">Pick up at the Windsor counter<small>${SHOP_STREET}, Windsor. Ready the same day</small></span><span class="num">Free</span></label></fieldset>`}
    </section>
    <div class="giftnote"><label class="field__label" for="note">Gift note <span class="fine">optional, written on a card in the box</span></label>
      <textarea class="field field--text field--area" id="note" data-note maxlength="240" rows="2" placeholder="Happy birthday, from all of us">${esc(state.note)}</textarea></div>
    <dl class="totals">
      <div><dt>Items</dt><dd class="num">${money(sub)}</dd></div>
      <div><dt>${pickup ? "Pickup" : local ? "Delivery" : "Shipping"}</dt><dd class="num">${pickup ? "Free" : local ? (localFee !== null ? feeText(localFee) : "At checkout") : chosen ? money(chosen.total) : checking ? "Checking" : state.dest && !carried(lines) ? "Choose pickup" : "add postal code"}</dd></div>
      <div class="totals__door"><dt>${local && localFee === null ? "Total before delivery and tax" : "Total before tax"}</dt><dd class="num">${local ? money(sub + (localFee || 0)) : chosen ? money(sub + chosen.total) : money(sub)}</dd></div>
    </dl>
    ${!ready && !checking && !tooHeavy ? `<p class="fine" id="checkout-why">Add a postal code or choose pickup to check out.</p>` : ""}
    ${ready ? `<a class="btn btn--wide" href="/checkout">Check out</a>` : `<button class="btn btn--wide" type="button" disabled ${!checking && !tooHeavy ? 'aria-describedby="checkout-why"' : ""}>Check out</button>`}
    <p class="fine">Tax is added at checkout.</p>
  </section>`;
}

function viewShipping() {
  return `
  ${band("shipping", "cobalt", "Shipping", "From Windsor to every province and territory.")}
  <section class="reading">
    <p class="lead">We pack every order at the counter in Windsor and ship to every province and territory.</p>
    <h2 class="h3">Local delivery</h2>
    <p>We deliver from our Walkerville shop, priced by road distance: $10 up to 10 km and $15 up to 25 km, per order, plus tax. Orders with $200 or more in items before tax deliver free. Anything in the shop can come by local delivery. Enter your postal code and we show your exact price, or tell you if you are past our delivery area.</p>
    <p>While the shop is open, it arrives in about 25 minutes to 1 hour. After closing, it arrives the next morning. These are estimates, not set times. Local delivery is paid online when you order.</p>
    <h2 class="h3">What it costs</h2>
    <p>Shipping is worked out from the packed weight and box size of your order and the carrier\u2019s rate to your postal code. You see the cost on the product page and in the cart before you pay.</p>
    <p><button class="btn btn--ghost" type="button" data-open-postal>${state.dest ? "Estimating to " + esc(state.dest.full) + ". Change" : "Enter my postal code"}</button></p>
    <h2 class="h3">How glass is packed</h2>
    <p>Hookahs ship taken apart. The glass base is double boxed. If anything arrives broken, bring it into the store and talk to the store manager.</p>
    <h2 class="h3">What we ship</h2>
    <p>Hookahs, bases, bowls, heat keepers, hoses and parts. A piece marked pickup only does not go by Canada Post, but we can still bring it to you by local delivery.</p>
    <h2 class="h3">Pick up</h2>
    <p>Order online and pick up for free at ${SHOP_ADDRESS}. ${directions()} or call <a class="link" href="tel:+15192552222">519-255-2222</a>.</p>
    <h2 class="h3">Returns</h2>
    <p>All sales are final. If something arrives broken, bring it into the store and talk to the store manager.</p>
  </section>`;
}

// ---------- chrome, sheet, router ----------
function syncChrome() {
  $$("[data-cart-count]").forEach(e => e.textContent = cartCount());
  const h = route() || "#/";
  $("[data-nav]").innerHTML = CATEGORIES.map(c => `<a href="/shop/${c.id}" ${h === "#/shop/" + c.id ? 'aria-current="page"' : ""}>${c.name}</a>`).join("") + `<a href="/set" ${h === "#/set" ? 'aria-current="page"' : ""}>Build a set</a><a href="/search" ${h === "#/search" ? 'aria-current="page"' : ""}>Search</a>`;
  const [ra, rb] = h.replace(/^#\/?/, "").split("/"), prod = ra === "p" ? bySku[rb] : null;
  const count = `<span data-cart-count>${cartCount()}</span>`, dock = $(".dock");
  dock.classList.toggle("dock--buy", !!prod);
  const lines = cartLines(), sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const sc = ra === "cart" && lines.length ? shipChoice(lines) : null, ship = sc && sc.chosen, canPay = !!sc && (sc.pickup || sc.local || !!ship);
  dock.classList.toggle("dock--buy", !!prod || ra === "set" || (ra === "cart" && lines.length > 0));
  dock.innerHTML = prod
    ? `<a class="dock__side" href="/shop/${prod.cat}">Back</a>${state.cart.some(l => l.sku === prod.sku)
        ? `<a class="dock__buy" href="/cart">In your cart. View cart</a>` : isSold(prod) ? `<a class="dock__buy dock__buy--off" href="/shop/${prod.cat}">Sold. See what is left</a>` : `<button class="dock__buy" type="button" data-add="${prod.sku}">Add to cart <span class="num">${whole(prod.price)}</span></button>`}<a class="dock__side" href="/cart" aria-label="Cart">${count}</a>`
    : ra === "set"
    ? `<a class="dock__side" href="/shop">Shop</a>${setPicks().some(Boolean) ? `<button class="dock__buy" type="button" data-add-set>Add the set <span class="num">${whole(setPicks().filter(Boolean).reduce((a, p) => a + p.price, 0))}</span></button>` : `<a class="dock__buy dock__buy--off" href="/shop">See what is in stock</a>`}<a class="dock__side" href="/cart" aria-label="Cart">${count}</a>`
    : ra === "cart" && lines.length
    ? `<a class="dock__side" href="/shop">Shop</a>${canPay ? `<a class="dock__buy" href="/checkout">Check out <span class="num">${money(sub + (ship ? ship.total : sc && sc.local ? sc.localFee || 0 : 0))}</span></a>` : sc && sc.checking ? `<span class="dock__buy dock__buy--off">Checking delivery</span>` : `<button class="dock__buy" type="button" data-open-postal>${state.dest ? "Change postal code" : "Add postal code for shipping"}</button>`}<span class="dock__side">${count}</span>`
    : `<a href="/" ${h === "#/" ? 'aria-current="page"' : ""}>Home</a><a href="/shop" ${h.startsWith("#/shop") ? 'aria-current="page"' : ""}>Shop</a><a href="/search" ${h === "#/search" ? 'aria-current="page"' : ""}>Search</a><a href="/cart" ${h === "#/cart" ? 'aria-current="page"' : ""}>Cart ${count}</a>`;
  syncDelivery();
}
const sheet = $("[data-postal-sheet]"), postalInput = $("#postal"), postalErr = $("#postal-err");
const sheetH = $("#sheet-h"), sheetP = $(".sheet__p", sheet), sheetGo = $('button[type="submit"]', sheet), postalBad = postalErr.textContent;
const SHEET_WORDS = {
  plain: { h: sheetH.textContent, p: sheetP.textContent, go: sheetGo.textContent },
  local: { h: "Where should we deliver?", p: "Local delivery is $10 up to 10 km and $15 up to 25 km from our Windsor shop. Free on orders of $200 or more before tax.", go: "Check local delivery" },
  nationwide: { h: "Where should we ship it?", p: "We ship anywhere in Canada by Canada Post. Enter your postal code to see the prices.", go: "See shipping prices" },
};
function sheetWords(mode) { const w = SHEET_WORDS[mode || "plain"]; state.sheetMode = mode || null; sheetH.textContent = w.h; sheetP.textContent = w.p; sheetGo.textContent = w.go; }
function openSheet(mode) { sheetWords(mode); state.sheetFell = false; postalInput.value = state.dest ? state.dest.full : ""; postalErr.textContent = postalBad; postalErr.hidden = true; postalInput.removeAttribute("aria-invalid"); sheet.showModal(); postalInput.focus(); postalInput.select(); }
document.addEventListener("click", e => {
  if (e.target.closest("[data-strip-close]")) { store.set("strip-off", true); if ($("[data-delivery-strip]").dataset.mode === "choose") store.set("choose-off", true); syncDelivery(); $("#main").focus({ preventScroll: true }); return; }
  const reach = e.target.closest("[data-reach]"); if (reach) { openSheet(reach.dataset.reach); return; }
  if (e.target.closest("[data-open-postal]")) openSheet();
  if (e.target.closest("[data-local-off]")) { const o = cpQuote(cartLines())[0] || null; if (state.farFor === state.dest?.full) state.localOff = state.farFor; state.delivery = null; state.ship = o ? o.id : "pickup"; store.set("ship", state.ship); navigate("/cart"); }
  else if (e.target.closest("[data-close-postal]") || e.target === sheet) sheet.close();
  const add = e.target.closest("[data-add]"); if (add) { addToCart(add.dataset.add); render(); }
  const q = e.target.closest("[data-qty]"); if (q) setQty(q.dataset.qty, +q.dataset.n);
  const pk = e.target.closest("[data-set]");
  if (pk) { state.set[pk.dataset.set] = pk.dataset.sku; $$(`[data-set="${pk.dataset.set}"]`).forEach(b => b.setAttribute("aria-pressed", b === pk)); $("[data-set-summary]").innerHTML = setSummary(); syncChrome(); }
  if (e.target.closest("[data-add-set]")) { setPicks().filter(Boolean).forEach(p => addToCart(p.sku)); navigate("/cart"); }
});
document.addEventListener("input", e => {
  if (e.target.id === "q") { state.q = e.target.value; $("[data-search-out]").innerHTML = searchResults(); }
  if (e.target.matches("[data-note]")) { state.note = e.target.value; store.set("note", state.note); }
});
document.addEventListener("change", e => { if (e.target.name === "ship") { state.ship = e.target.value; store.set("ship", state.ship); render(); } });
$("[data-postal-form]").addEventListener("submit", e => {
  e.preventDefault();
  const d = parsePostal(postalInput.value);
  const refuse = msg => { postalErr.textContent = msg; postalErr.hidden = false; postalInput.setAttribute("aria-invalid", "true"); postalInput.focus(); };
  if (!d) return refuse(postalBad);
  if (state.sheetFell && localArea(d)) { sheetWords("local"); state.sheetFell = false; }   // they corrected a mistyped code: they still asked for local delivery
  if (state.sheetMode === "local" && !localArea(d)) { sheetWords("nationwide"); state.sheetFell = true; return refuse(`${d.full} is past our local delivery area. We can ship it to you anywhere in Canada.`); }
  if (state.sheetMode === "local" && !d.complete) return refuse("Enter the full postal code, like N9A 1A1, so we can check the distance.");
  if (state.localQ?.status === "down") state.localQ = null;   // a new try after the map service was unavailable
  const chose = state.sheetMode;
  if (chose) { state.reach = chose; store.set("reach", chose); state.ship = null; store.set("ship", null); }
  state.dest = d; store.set("postal", d.full); sheet.close(); render();
  if (chose) $("#main").focus({ preventScroll: true });
});
postalInput.addEventListener("input", () => { postalErr.hidden = true; postalInput.removeAttribute("aria-invalid"); });

document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches(".why")) state.whyOpen = e.target.open; }, true);
function focusKey(el) {
  if (!el || el === document.body) return null;
  for (const k of ["data-qty", "data-add"]) if (el.hasAttribute(k)) return `[${k}="${el.getAttribute(k)}"]` + (el.dataset.n ? `[aria-label="${el.getAttribute("aria-label")}"]` : "");
  if (el.name === "ship") return `input[name="ship"][value="${el.value}"]`;
  return null;
}
// ---------- checkout and confirmation ----------
const deliveryKey = () => [state.form?.line1, state.form?.city, state.dest?.full].map(s => String(s || "").trim().toLowerCase()).join("|");
const baseFeeNow = () => state.refused === deliveryKey() ? null : state.delivery && state.delivery.key === deliveryKey() ? state.delivery.fee_cents : localQ()?.status === "ok" ? localQ().fee_cents : null;
const deliveryFeeNow = () => {
  const base = baseFeeNow(), told = state.delivery; if (base === null) return null;
  if (told && told.key === deliveryKey() && told.sub === cartCents() && Number.isFinite(told.due)) return told.due / 100;   // the server has spoken for this exact cart: its figure wins over ours
  return localDue(base, cartCents()) / 100;
};   // the same free-over-$200 rule the server applies
function coTotals(lines, sc) {
  const { pickup, local, chosen } = sc, fee = local ? deliveryFeeNow() : null, sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0), ship = pickup ? 0 : local ? fee || 0 : chosen.total, prov = pickup || local ? "ON" : state.dest.prov;
  const tax = Math.round((sub + ship) * taxRate(prov) * 100) / 100, units = lines.reduce((a, l) => a + l.qty, 0);
  return `<dl class="totals">
        <div><dt>${units} ${units === 1 ? "item" : "items"}</dt><dd class="num">${money(sub)}</dd></div>
        <div><dt>${pickup ? "Pickup" : local ? "Delivery" : "Shipping"}</dt><dd class="num">${pickup ? "Free" : local ? (fee === null ? "Enter your address" : feeText(fee)) : money(ship)}</dd></div>
        <div><dt>${taxLabel(prov)}</dt><dd class="num">${money(tax)}</dd></div>
        <div class="totals__door"><dt>${local && fee === null ? "Total before delivery" : "Total"}</dt><dd class="num">${money(sub + ship + tax)}</dd></div>
      </dl>`;
}
function viewCheckout() {
  const lines = cartLines();
  if (!lines.length) return viewCart();
  const sc = shipChoice(lines), { pickup, local, chosen } = sc;
  if (!state.ship && !chosen && (sc.status === "far" || sc.status === "down")) return `${band("checkout", "emerald", "One step back.")}<section class="empty"><p class="lead">${sc.status === "far" ? `${esc(state.dest.full)} is past our 25 km delivery area.` : "We cannot check delivery right now."} You can still <a class="link" href="/cart">${carried(lines) ? "ship it or pick it up free" : "pick it up free"}</a>.</p></section>`;
  if (sc.checking && !pickup && !chosen && !local) return `${band("checkout", "emerald", "Checkout")}<section class="empty"><p class="lead" role="status">Checking delivery to ${esc(state.dest.full)}.</p></section>`;
  if (!pickup && !local && !chosen) return `${band("checkout", "emerald", "One step back.")}<section class="empty"><p class="lead">Choose shipping or pickup in <a class="link" href="/cart">your cart</a> first.</p></section>`;
  const f = state.form || {}, quoted = local && deliveryFeeNow() !== null;
  const field = (id, label, attrs, hint = "") => `<label class="field__label" for="co-${id}">${label}${hint ? ` <span class="fine">${hint}</span>` : ""}</label><input class="field" id="co-${id}" name="${id}" value="${esc(f[id] || "")}" ${attrs}>`;
  return `
  ${band("checkout", "emerald", "Checkout", `<a href="/cart">Back to the cart</a>`)}
  <section class="cart checkout">
    <form class="co" data-checkout novalidate>
      <fieldset class="co__set"><legend class="h3">Who it is for</legend>
        ${field("name", "Full name", 'autocomplete="name" maxlength="80" required')}
        ${field("email", "Email", 'type="email" autocomplete="email" inputmode="email" maxlength="120" required', local ? "for the receipt" : "for the receipt and tracking")}
        ${field("phone", "Phone", `type="tel" autocomplete="tel" inputmode="tel" maxlength="30"${local ? " required" : ""}`, local ? "so the driver can reach you" : "optional")}
      </fieldset>
      ${pickup ? `<fieldset class="co__set"><legend class="h3">Pickup</legend><p class="co__p">At ${SHOP_ADDRESS}. We email you when it is ready, usually the same day. Bring the order number. ${directions()}</p></fieldset>`
        : `<fieldset class="co__set"><legend class="h3">Where it is going</legend>
        ${field("line1", "Street address", 'autocomplete="address-line1" maxlength="120" required')}
        ${field("city", "City or town", 'autocomplete="address-level2" maxlength="60" required')}
        ${state.dest.complete ? `<p class="co__p">Postal code <b class="num">${esc(state.dest.full)}</b>, ${esc(state.dest.prov)}. <button class="link" type="button" data-open-postal>Change</button></p>`
          : `<p class="co__p">We need the full postal code for the label. <button class="link" type="button" data-open-postal>Enter it</button></p>`}
        ${local ? `<p class="co__p">Local delivery from our Windsor shop. ${localEta()}. <a class="link" href="/cart">Change</a></p><p class="co__p">${freeNote(cartCents(lines))}</p><div class="co__p" role="status" data-deliv-msg>${quoted ? `Good news, we deliver to ${esc(state.dest.full)}.` : ""}</div><p class="fine">Address check by <a class="link" href="https://www.geoapify.com/" rel="noopener">Geoapify</a>. Map data from OpenStreetMap contributors.</p>`
          : `<p class="co__p">${chosen.carrier} ${chosen.service}, ${days(chosen.days)}. <a class="link" href="/cart">Change</a></p>`}</fieldset>`}
      ${coTotals(lines, sc)}
      <p class="field__err" role="alert" data-co-err hidden></p>
      <button class="btn btn--wide" type="submit" ${!pickup && !state.dest.complete ? "disabled" : ""}>${local && !quoted ? "Check delivery price" : "Place order"}</button>
      <p class="fine">This store is still in build. Placing an order here takes no payment: it goes to the shop's back office as a demo order.</p>
    </form>
  </section>`;
}
function viewOrder(id) {
  let o = null; try { o = JSON.parse(sessionStorage.getItem("oss:order:" + id)); } catch { o = null; }
  if (!o) return `<section class="empty"><h1 class="h2 h2--xl">Order ${esc(id)}</h1><p class="lead">Test order. No payment is taken, and nothing will be packed or sent.</p><p class="lead"><a class="link" href="/shop">Back to the shop</a>.</p></section>`;
  const c = n => money(n / 100);
  return `
  <section class="cart done">
    <p class="done__tag"><span>Order</span> <b class="num">${esc(o.id)}</b></p>
    <h1 class="h2 h2--xl">Thank you, ${esc(o.name.split(" ")[0])}.</h1>
    <p class="lead">Test order. No payment is taken, and nothing will be packed or sent.</p>
    <p class="fine">${o.method === "pickup" ? `You chose free pickup at ${SHOP_ADDRESS}. ${directions()}` : o.service === "Local delivery" ? `You chose local delivery.${o.eta ? " On a real order: " + esc(o.eta) + "." : ""}` : `You chose ${esc(o.service)}.`}</p>
    <ul class="done__lines">${o.items.map(i => `<li><span><b class="num">${i.qty}</b> &times; ${esc(i.name)}</span><span class="num">${c(i.unit_cents * i.qty)}</span></li>`).join("")}</ul>
    <dl class="totals">
      <div><dt>Items</dt><dd class="num">${c(o.subtotal_cents)}</dd></div>
      <div><dt>${o.method === "pickup" ? "Pickup" : o.service === "Local delivery" ? "Delivery" : "Shipping"}</dt><dd class="num">${o.method === "pickup" || (o.service === "Local delivery" && !o.shipping_cents) ? "Free" : c(o.shipping_cents)}</dd></div>
      <div><dt>${esc(o.tax_label)}</dt><dd class="num">${c(o.tax_cents)}</dd></div>
      <div class="totals__door"><dt>Total</dt><dd class="num">${c(o.total_cents)}</dd></div>
    </dl>
    ${o.address ? `<p class="fine">Going to ${esc(o.address.line1)}, ${esc(o.address.city)}, ${esc(o.address.province)} ${esc(o.address.postal)}.</p>` : ""}
    <p class="fine">Demo order: no payment was taken.</p>
    <a class="btn btn--wide" href="/shop">Keep looking</a>
  </section>`;
}
document.addEventListener("input", e => { const f = e.target.closest("[data-checkout]"); if (f && e.target.name) { state.form = state.form || {}; state.form[e.target.name] = e.target.value; if ((e.target.name === "line1" || e.target.name === "city") && f.querySelector("[data-deliv-msg]")) refreshDelivery(f); } });
function refreshDelivery(f, msg) {
  const lines = cartLines(), sc = shipChoice(lines), quoted = deliveryFeeNow() !== null, box = f.querySelector("[data-deliv-msg]"), btn = f.querySelector('button[type="submit"]');
  f.querySelector(".totals").outerHTML = coTotals(lines, sc);
  if (box) box.innerHTML = msg !== undefined ? msg : quoted ? `Good news, we deliver to ${esc(state.dest.full)}.` : "";
  btn.textContent = quoted ? "Place order" : "Check delivery price";
}
const deliveryMsg = status => {
  const can = carried(cartLines()), way = can ? "See shipping and pickup" : "See pickup", btn = w => `<button class="link" type="button" data-local-off>${w}</button>`, other = can ? "You can still ship it or pick it up free." : "You can still pick it up free.";
  return status === "far" ? `${esc(state.dest.full)} is past our 25 km delivery area. ${other} ${btn(way)}`
    : status === "down" ? `We cannot check delivery right now. ${other} ${btn(way)}`
    : `We could not confirm that address. Check the street number and postal code, or ${btn(way[0].toLowerCase() + way.slice(1))}.`;
};
async function checkDelivery(f, btn) {
  btn.disabled = true; btn.textContent = "Checking your address";
  let d = { status: "down" }, key = deliveryKey();
  try { const r = await fetch("/api/delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ line1: state.form.line1, city: state.form.city, postal: state.dest.full }) }); d = await r.json(); } catch {}
  btn.disabled = false; if (d.status === "far") state.farFor = state.dest.full;
  state.delivery = d.status === "ok" && key === deliveryKey() ? { key, fee_cents: d.fee_cents } : null; state.refused = d.status === "ok" ? null : key;
  refreshDelivery(f, d.status === "ok" ? undefined : deliveryMsg(d.status));
}
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-checkout]"); if (!f) return; e.preventDefault();
  const err = f.querySelector("[data-co-err]"), btn = f.querySelector('button[type="submit"]'), sc = shipChoice(cartLines()), pickup = sc.pickup, local = sc.local, chosen = sc.chosen;
  const fail = (msg, field) => { err.textContent = msg; err.hidden = false; const el = field && f.querySelector(`[name="${field}"]`); if (el) el.focus(); };
  const v = n => (f.elements[n] ? f.elements[n].value.trim() : "");
  if (!v("name")) return fail("Tell us the name for the order.", "name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email"))) return fail("That email address does not look right.", "email");
  if (!pickup && !local && !chosen && !state.ship && (sc.status === "far" || sc.status === "down")) return fail("Delivery is not available here. Choose shipping or pickup in your cart.");
  if (!pickup && !v("line1")) return fail("Enter the street address.", "line1");
  if (!pickup && !v("city")) return fail("Enter the city or town.", "city");
  if (local) {
    if (v("phone").replace(/\D/g, "").length < 10) return fail("Enter a phone number so the driver can reach you.", "phone");
    state.form = { ...(state.form || {}), line1: v("line1"), city: v("city") }; err.hidden = true;
    if (deliveryFeeNow() === null) return checkDelivery(f, btn);   // show the price first: the next tap places the order
  }
  btn.disabled = true; btn.textContent = "Placing your order"; err.hidden = true;
  try {
    const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: state.cart, method: pickup ? "pickup" : "ship", service: local ? "local" : chosen && chosen.id, delivery_fee_cents: local ? Math.round(deliveryFeeNow() * 100) : undefined, postal: state.dest && state.dest.full,
      name: v("name"), email: v("email"), phone: v("phone"), note: state.note, address: { line1: v("line1"), city: v("city") } }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { btn.disabled = false; btn.textContent = "Place order"; if (local && data.delivery) { if (data.delivery === "far") state.farFor = state.dest.full; state.delivery = data.delivery === "ok" ? { key: deliveryKey(), fee_cents: data.base_fee_cents ?? data.fee_cents, due: data.fee_cents, sub: cartCents() } : null; state.refused = data.delivery === "ok" ? null : deliveryKey(); refreshDelivery(f, data.delivery === "ok" ? undefined : deliveryMsg(data.delivery)); if (data.delivery !== "ok") return; } if (typeof data.stock === "number" && bySku[data.sku]) bySku[data.sku].stock = data.stock; return fail(data.error || "That did not go through. Please try again.", data.field); }
    try { sessionStorage.setItem("oss:order:" + data.order.id, JSON.stringify(data.order)); } catch {}
    for (const i of data.order.items) if (bySku[i.sku]) bySku[i.sku].stock = Math.max(0, bySku[i.sku].stock - i.qty);
    state.cart = []; saveCart(); state.delivery = null; state.refused = null; state.form = {}; state.note = ""; store.set("note", "");
    navigate("/order/" + data.order.id, true);
  } catch { btn.disabled = false; btn.textContent = "Place order"; fail("We could not reach the shop. Check your connection and try again."); }
});
// ---------- the small print ----------
const DRAFT = `<p class="done__tag"><span>Draft</span> <b>for the shop to review</b></p>`;
const doc = (title, lead, parts) => `${band("docs", "bone", title, lead)}<section class="cart doc">${DRAFT}${parts.map(([h, body]) => `<h2 class="h3">${h}</h2>${body.map(t => `<p>${t}</p>`).join("")}`).join("")}</section>`;
const viewPrivacy = () => doc("Privacy", "What we collect when you order, why, and how to ask about it.", [
  ["What we collect", ["Your name, email, phone number if you give it, and delivery address, so we can send your order and answer questions about it.", "Your card details go straight to the payment company. We never see or store the card number."]],
  ["What we do not do", ["We do not sell or rent your details. We do not use advertising trackers. Visit counts on this site use no cookies and do not identify you."]],
  ["Who else sees it", ["The carrier or our driver gets your name, phone number and address to deliver the order. For local delivery, your address goes to our map service, Geoapify, to work out the distance. The payment company gets what it needs to take the payment. Our hosting company stores the order on our behalf."]],
  ["How long we keep it", ["Order records are kept for six years, because tax law requires it. After that they are deleted."]],
  ["Your choices", ["You can ask to see what we hold about you, to correct it, or to have it deleted where the law allows. Email or call the counter and we will answer within 30 days.", "Marketing emails are only sent if you ask for them, and every one has an unsubscribe link."]],
  ["Who to ask", ["The person responsible for privacy at the shop is the manager. Call 519-255-2222."]],
]);
const viewTerms = () => doc("Terms of sale", "The plain rules for buying from us online.", [
  ["Prices and tax", ["Prices are in Canadian dollars. Tax is added at checkout, based on the province the order ships to."]],
  ["Shipping", ["We ship within Canada. The price at checkout is the price you pay for shipping. Delivery times are the carrier's estimates. Cologne ships by ground only."]],
  ["Local delivery", ["We deliver within 25 km by road of our Windsor shop: $10 up to 10 km and $15 from there to 25 km, per order, plus tax. Orders with $200 or more in items before tax deliver free. Arrival times are estimates. Local delivery is paid online when you order."]],
  ["Pickup", ["Pickup at 760 Wyandotte St E, Windsor, ON N9A 3J4 is free. We email you when the order is ready and hold it for 14 days."]],
  ["Returns", ["All sales are final."]],
  ["Broken on arrival", ["If something arrives broken, bring it into the store at 760 Wyandotte St E and talk to the store manager."]],
  ["If something is wrong with the order", ["If we cannot ship within 30 days of the date promised, you can cancel for a full refund."]],
]);
const viewMissing = () => `${band("missing", "ruby", "Nothing at this address.")}<section class="empty"><p class="lead">The link may be old. <a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
function render() {
  const keep = focusKey(document.activeElement);
  const [a, b] = route().replace(/^#\/?/, "").split("/");
  $("#main").innerHTML = a === "shop" ? (b && !catById[b] ? viewMissing() : viewShop(b)) : a === "p" ? viewProduct(b) : a === "cart" ? viewCart() : a === "shipping" ? viewShipping() : a === "gifts" ? viewGifts(b) : a === "set" ? viewSet() : a === "search" ? viewSearch() : a === "privacy" ? viewPrivacy() : a === "terms" ? viewTerms() : a === "checkout" ? viewCheckout() : a === "order" ? viewOrder(b) : !a ? viewHome() : viewMissing();
  document.body.dataset.route = a || "home";
  syncChrome();
  const chip = $(".chips [aria-current]"); if (chip) chip.parentNode.scrollLeft = chip.offsetLeft - (chip.parentNode.clientWidth - chip.offsetWidth) / 2;   // the section you are in sits centred in the row
  if (keep) { const el = document.querySelector(keep); if (el) el.focus({ preventScroll: true }); }
  priceLocal();
}
let last = route();
document.addEventListener("click", e => {
  const a = e.target.closest("[data-piece]"); if (!a) return;
  $$(".tile").forEach(n => n.style.viewTransitionName = "");
  const n = $(".tile", a) || a; n.style.viewTransitionName = "piece";
  $$(".sticker").forEach(x => x.style.viewTransitionName = ""); const st = $(".sticker", a); if (st) st.style.viewTransitionName = "tag";
}, true);
function go() {
  const from = last.match(/^#\/p\/(.+)$/); last = route();
  render(); scrollTo(0, 0);
  const stage = $("[data-stage]");
  if (stage) { stage.style.viewTransitionName = "piece"; const st = $(".sticker", stage); if (st) st.style.viewTransitionName = "tag"; }
  else if (from) { const back = $(`[data-piece="${from[1]}"]`), n = back && ($(".tile", back) || back); if (n) { n.style.viewTransitionName = "piece"; const st = $(".sticker", back); if (st) st.style.viewTransitionName = "tag"; n.scrollIntoView({ block: "center" }); } }
  const sq = $("#q"); if (sq) sq.focus({ preventScroll: true }); else $("#main").focus({ preventScroll: true });
}
window.addEventListener("routechange", () => {
  if (route() === last) return;
  if (!navInfo().instant && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go); else go();   // a wave is already covering the change
});
render();
