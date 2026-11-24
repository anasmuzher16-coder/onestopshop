import { PRODUCTS, CATEGORIES, BOXES } from "/api/catalog-module";
import { route, navigate, navInfo, spotHere, canGoBack, setQuery, setSpotAnchor } from "./route.js";
import { parsePostal, pack, quote, money, days, MAX_QTY, fuelOn, orderTotals, taxRate, taxLabel, localArea, localDue, localEta, FREE_LOCAL_CENTS, SHOP_HOURS } from "./rates.js";
import { accountView, afterRender, rewardCents, rewardRow, rewardFlag, rewardGone } from "./account.js";
import { visitSource } from "./source.js";   // where the visit came from, sent with the order (back office report)
import { shelfOf, ticked, heroPicks } from "./picks.js";
import * as find from "./find.js";
import * as finder from "./search.js";

// ---------- state (everything read from storage is validated) ----------
const bySku = Object.assign(Object.create(null), Object.fromEntries(PRODUCTS.map(p => [p.sku, p])));   // no inherited keys: "constructor" in a saved cart or an address is not a product
const catById = Object.assign(Object.create(null), Object.fromEntries(CATEGORIES.map(c => [c.id, c])));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("oss:" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("oss:" + k, JSON.stringify(v)); } catch {} },
};
// On view is not the same as for sale: an item waiting for the shop's own price shows "Price TBD" and never reaches the cart.
const forSale = p => !!p && p.state === "sale";
const isSold = p => forSale(p) && p.stock === 0;   // stock is the one truth: the server's catalogue decides what has gone
const stockFor = p => !forSale(p) || isSold(p) ? 0 : Number.isInteger(p.stock) ? Math.min(MAX_QTY, Math.max(0, p.stock)) : MAX_QTY;   // the most of this piece one cart can hold
// Anything not known yet is said plainly, in one quiet style, never guessed and never left blank.
const TBD = what => `<span class="tbd">${what ? what + " " : ""}TBD</span>`;   // TBD("") when the label beside it already names the fact
const SHELF = shelfOf(PRODUCTS);   // one card per hookah family; every other item is its own card
const FAMILIES = new Map(); for (const p of PRODUCTS) if (p.family) { if (!FAMILIES.has(p.family)) FAMILIES.set(p.family, []); FAMILIES.get(p.family).push(p); }   // built once: every card used to filter the whole catalogue for its colours
const familyOf = p => p && p.family ? FAMILIES.get(p.family) || [p] : p ? [p] : [];
const GROUPS = [["full_size", "Full size"], ["stem_set", "Stem sets"], ["compact_travel", "Compact and travel"], ["statement", "Statement pieces"]];
const stemSet = p => !!(p && p.facts && p.facts.includes_base === false);
// ---------- THE COLOUR SWITCHER: every catalogue colour, a radio group; a colour without its own photo says "Photo coming" ----------
const ownPhoto = v => !!(v && v.img && (!v.family || v.facts.photo === "own"));
const photoOf = v => !!(v && v.img);   // its own photo or the family's, labelled
const colourName = (v, i) => v.colour ? (v.named ? v.colour : `${v.colour}, name TBD`) : `Colour ${i + 1}`;
// a light chip on the coal ground gets a ring; computed from the chip's own colour so it never disappears into the page
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0; const c = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const chipStyle = v => `--c:${esc(v.chip || "#8a8a8a")}${lum(v.chip) < .03 ? ";--ring:oklch(1 0 0 / .38)" : ""}`;
function swatchGroup(fam, chosen, { label, card = "", max = 99 } = {}) {
  const shown = fam.slice(0, max), more = fam.length - shown.length;
  return `<div class="swatches ${card ? "swatches--card" : ""}" role="radiogroup" aria-label="${esc(label)}">${shown.map((v, i) => `<button class="swatch" type="button" role="radio" data-swatch="${v.sku}" ${card ? `data-card="${card}"` : ""} aria-checked="${v.sku === chosen.sku}" tabindex="${v.sku === chosen.sku ? 0 : -1}" style="${chipStyle(v)}" aria-label="${esc(colourName(v, i))}${photoOf(v) ? "" : ", photo coming"}"></button>`).join("")}${more > 0 ? `<a class="swatches__more" href="/p/${fam[0].sku}" aria-label="${more} more colours">+${more}</a>` : ""}</div>`;
}
// The photo a colour shows, and its label in the quiet TBD style (owner, 2026-11-24): its own photo ("Photo to be upscaled" when it
// was enlarged), the family's photo with "Shown in <colour>", or the drawn stand-in with "Photo coming". The label is in the alt text too.
function photoLabel(v) {
  const f = (v && v.facts) || {};
  if (!v.img) return "";
  if (f.photo === "family") return `Shown in ${f.shown_in || "another colour"}${f.photo_upscale ? ". Photo to be upscaled" : ""}`;
  return f.photo_label === "upscale" ? "Photo to be upscaled" : "";
}
const colourShot = (v, o = {}) => { const l = photoLabel(v); return shot(v, { ...o, alt: o.alt ? (l ? `${o.alt}. ${l}` : o.alt) : "" }) + (l ? `<span class="shot__tag shot__tag--tbd" aria-hidden="true">${esc(l)}</span>` : ""); };
function cleanCart(x) {
  if (!Array.isArray(x)) return [];
  const qty = new Map();
  for (const l of x) if (l && typeof l.sku === "string" && bySku[l.sku] && Number.isInteger(l.qty) && l.qty > 0) qty.set(l.sku, (qty.get(l.sku) || 0) + l.qty);
  return [...qty].map(([sku, n]) => ({ sku, qty: Math.min(MAX_QTY, n) }));
}
// Holds a cart to what the shop has, and says in words what had to change.
function fitCart(cart) {
  const kept = [], news = [];
  for (const l of cart) {
    const p = bySku[l.sku], max = stockFor(p);
    if (!forSale(p)) { news.push(p.state === "tbd" ? `${p.name} has no shop price yet, so we took it out of your cart.` : `${p.name} is not on sale yet, so we took it out of your cart.`); continue; }
    if (!max) { news.push(`${p.name} has sold, so we took it out of your cart.`); continue; }
    if (l.qty > max) news.push(`We only have ${max} of ${p.name}, so your cart now has ${max}.`);
    kept.push({ sku: l.sku, qty: Math.min(max, l.qty) });
  }
  return { kept, news };
}
const state = { reach: ["local", "nationwide"].includes(store.get("reach")) ? store.get("reach") : null, whyOpen: false, q: "", note: typeof store.get("note") === "string" ? store.get("note") : "", set: {}, dest: parsePostal(store.get("postal")), cart: cleanCart(store.get("cart")), ship: typeof store.get("ship") === "string" ? store.get("ship") : null, cartNews: [] };
{ const fit = fitCart(state.cart); if (fit.news.length) { state.cart = fit.kept; state.cartNews = fit.news; store.set("cart", state.cart); } }
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NF_CENTS = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), NF_WHOLE = new Intl.NumberFormat("en-CA");   // made once: toLocaleString builds a new formatter on every call
const whole = n => "$" + (Math.round(n * 100) % 100 ? NF_CENTS.format(n) : NF_WHOLE.format(Math.round(n))); // cents only when the price has them
const TONES = ["ember", "teal", "ruby", "cobalt", "gilt", "emerald"];
const SERIES = { Sultan: "ruby", Mamoun: "gilt", Cairo: "teal", Regent: "cobalt", Stuttgart: "emerald" };
const seriesOf = p => p.name.split(" ")[0] in SERIES ? p.name.split(" ")[0] : "";
// Colour is decided, not random: one jewel per series; everything else takes the next jewel along within its category.
// Worked out once for the whole catalogue (it used to scan every product for every card): the same answer as before, item by item.
const TONE = new Map(); { const k = Object.create(null); for (const p of PRODUCTS) { const s = seriesOf(p), i = s ? -1 : (k[p.cat] = (k[p.cat] ?? -1) + 1); TONE.set(p, p.dark ? "" : p.photo ? "bone" : s ? SERIES[s] : TONES[i % TONES.length]); } }
const toneOf = p => TONE.has(p) ? TONE.get(p) : p.dark ? "" : p.photo ? "bone" : SERIES[seriesOf(p)] || TONES[0];
const place = d => d.city ? d.city : d.fsa;
const byName = n => PRODUCTS.find(p => p.name === n);
const inCat = c => SHELF.filter(p => p.cat === c && !p.dark);
const liveCat = c => inCat(c).filter(p => forSale(p) && !isSold(p));   // what we can suggest: nothing is promoted that cannot be bought
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

const pickupDay = () => { const { day, t } = nowInWindsor(); return t >= HOURS[day][1] ? "Tomorrow" : "Today"; };   // after closing, the counter's next chance is tomorrow
const pickupReady = () => pickupDay() === "Today" ? "Ready the same day" : "Ready tomorrow";
const cartLines = () => state.cart.map(l => ({ product: bySku[l.sku], qty: l.qty }));
const cartCount = () => state.cart.reduce((a, l) => a + l.qty, 0);
const toCents = n => Math.round(n * 100);
const cartCents = (lines = cartLines()) => lines.reduce((a, l) => a + toCents(l.product.price) * l.qty, 0);
const feeText = n => n === 0 ? "Free" : money(n);
// Pickup or local delivery only (charcoal): never Canada Post or any carrier; our own driver may bring it. The server holds the same rule.
const isCharcoal = p => !!(p && p.details && p.details.charcoal);
const localOnly = p => !!p && (p.ship === "pickup_only" || isCharcoal(p));
const carried = lines => !lines.some(l => localOnly(l.product));
// No shipping to Quebec until the site has a French version (Charter of the French Language; plan section 8). The server refuses it too.
const toQuebec = () => !!(state.dest && state.dest.prov === "QC");
const QC_NOTE = "We do not ship to Quebec yet: the site is in English only for now. Pickup in Windsor is free, or call 519-255-2222.";
const cpQuote = lines => state.dest && carried(lines) && !toQuebec() ? quote(state.dest, pack(lines)) : [];
const freeNote = sub => sub >= FREE_LOCAL_CENTS ? "Free local delivery: your items are $200 or more before tax." : `Local delivery is free on orders of $200 or more before tax. Add ${money((FREE_LOCAL_CENTS - sub) / 100)} more to get it.`;
function saveCart() { store.set("cart", state.cart); syncChrome(); }
function addToCart(sku) {
  const p = bySku[sku]; if (!forSale(p) || !stockFor(p)) return;   // nothing without a shop price ever reaches the cart
  const l = state.cart.find(x => x.sku === sku), wasMixed = mixedCart();
  if (l) l.qty = Math.min(stockFor(p), l.qty + 1); else state.cart.push({ sku, qty: 1 });
  if (!wasMixed && mixedCart() && state.ship === "pickup") { state.ship = null; store.set("ship", null); }   // a cart that has just become charcoal plus other pieces asks afresh: no earlier pickup choice is carried over
  saveCart();
}
const mixedCart = () => { const k = state.cart.map(x => localOnly(bySku[x.sku])); return k.includes(true) && k.includes(false); };
function setQty(sku, qty) {
  const p = bySku[sku]; state.cart = cleanCart(state.cart.map(l => l.sku === sku ? { ...l, qty: p ? Math.min(stockFor(p), qty) : qty } : l)); saveCart(); render();
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
  // a single roll with no photo of its own shows the box it is sold from, and says so
  const box = !p.img && !p.photo && p.details?.box_sku && bySku[p.details.box_sku];
  if (box && box.img) return shot(box, { small, eager, use, cls, alt: alt ? `${alt}, shown with the box it comes from` : "" }) + `<span class="shot__tag" aria-hidden="true">Sold by the roll</span>`;
  // charcoal still waiting for the shop's photo: the drawn box stands in, so the grid never shows a broken picture
  if (!p.img && isCharcoal(p)) return `<img class="shot shot--drawn ${cls}" src="img/pc/coming-charcoal.svg" alt="${esc(alt ? alt + ", drawing until the photo is ready" : "")}" width="720" height="900" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span class="shot__tag" aria-hidden="true">Photo coming</span>`;
  // a hookah or a shisha flavour still waiting for its photo: the drawn stand-in, in the same style as the charcoal box
  const drawn = !p.img && (p.cat === "hookahs" ? "coming-hookah" : p.cat === "shisha" ? "coming-shisha" : "");
  if (drawn) return `<img class="shot shot--drawn ${cls}" src="img/pc/${drawn}.svg" alt="${esc(alt ? alt + ", drawing until the photo is ready" : "")}" width="720" height="900" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span class="shot__tag" aria-hidden="true">Photo coming</span>`;
  if (!p.img) return `<span class="shot shot--none ${cls}" role="img" aria-label="${esc(alt || "Photo coming soon")}">Photo coming soon</span>`; // added in the back office, no photo yet
  const plain = p.dark || p.photo;
  return `<img class="${plain ? "shot shot--photo" : "shot"} ${cls}" src="${imgSrc(p, small)}" ${srcset(p)} ${p.photo ? "" : `sizes="${SIZES[use]}"`} alt="${esc(alt)}" width="${p.dark ? 1080 : 720}" height="${p.dark ? 1080 : 900}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// ---------- THE STICKER (device): the delivered price, slapped on the product ----------
function sticker(p, { big = false } = {}) {
  const n = parseInt(p.sku.slice(-3), 10), r = ((n * 37) % 23) - 13; // -13..+9 degrees, fixed per product
  if (p.state === "tbd") return `<span class="sticker sticker--tbd ${big ? "sticker--big" : ""}" style="--r:${r}deg"><span class="sticker__k">Price</span><span class="sticker__v">TBD</span></span>`;   // the price gun's own words until the shop sets its price
  if (p.state === "soon") return `<span class="sticker sticker--tbd ${big ? "sticker--big" : ""}" style="--r:${r}deg"><span class="sticker__k">Soon</span><span class="sticker__v">${whole(p.price)}</span></span>`;
  return `<span class="sticker ${big ? "sticker--big" : ""} ${isSold(p) ? "sticker--sold" : ""}" style="--r:${r}deg"><span class="sticker__v">${isSold(p) ? "Sold" : whole(p.price)}</span></span>`;
}

// ---------- THE FIRST SCREEN FIRST: a section swap draws the cards you can see, then the rest in idle moments ----------
// A long section (83 hookah families, 84 Heat items, every piece on Everything) was one 150-650 ms task on a slow phone, in the
// middle of the wave. While a navigation draws, cards past the first screen leave a sized slot and wait in a queue; the queue is
// drawn a few cards at a time between frames, never more than ~8 ms of work per turn. Parts of the page nobody sees in the first
// frame (the desktop filter rail, hidden on a phone) wait the same way. Back to a spot down the list draws through it first.
// The swap itself stays small: under the wave's full cover it puts in the page with every card as a slot, the section's band and its
// objects; the cards of the first screen follow in their own task straight after (before the wave starts to leave), the rest in
// idle moments. Each step is its own task, so none of them holds the wave.
// How many cards fill the first screen: the grid's columns at this width (styles.css) times the rows that fit, plus one row.
const firstScreen = () => { const w = innerWidth, cols = w >= 1500 ? 5 : w >= 960 ? 4 : w >= 640 ? 3 : 2; return cols * (Math.ceil(innerHeight / (w / cols * 1.25 + 90)) + 1); };
let queue = null;     // only while render() draws a section: { q parts waiting: { html(), sku? } }
let pending = null;   // after the draw, until every waiting part is in: { q, order, slots, at, step, run, first }
let runs = 0;
function card(p, i = 9) {
  if (queue) return `<div class="later" data-later="${queue.q.push({ html: () => cardHTML(p, i), sku: p.sku }) - 1}" aria-hidden="true"></div>`;
  return cardHTML(p, i);
}
// any part of the page that can arrive a moment after the first screen (find.js passes the filter rail through here)
const defer = make => queue ? `<div class="later--part" data-later="${queue.q.push({ html: make }) - 1}" aria-hidden="true"></div>` : make();
const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 120 }) : f => setTimeout(() => f(null), 16);   // Safari has no idle callback: one short turn per frame
const soon = (() => { const ch = new MessageChannel(), fns = []; ch.port1.onmessage = () => fns.shift()?.(); return f => { fns.push(f); ch.port2.postMessage(0); }; })();   // the next task, with no timer clamp
function laterStart(q) {   // called once #main holds the new page; any earlier queue is dropped with the page it belonged to
  const main = $("#main"), run = ++runs; pending = null;
  if (!q || !q.q.length) { main.removeAttribute("aria-busy"); return; }
  const slots = []; for (const s of main.querySelectorAll("[data-later]")) slots[+s.dataset.later] = s;
  // cards in page order first, then the parts that wait for a quiet moment (the desktop rail)
  const order = [...q.q.keys()].sort((a, b) => (!q.q[a].sku) - (!q.q[b].sku) || a - b);
  pending = { q: q.q, order, slots, at: 0, step: 2, run };
  main.setAttribute("aria-busy", "true");   // screen readers wait for the whole list
  const first = q.first;
  soon(() => { if (!pending || pending.run !== run) return; drawLater(0, first - 1, true); if (pending) drain(run); });
}
// Draws waiting parts in order for up to `budget` ms, or through position `upto` whatever it costs (the first screen; Back to a spot).
function drawLater(budget = 8, upto = -1, first = false) {
  const L = pending; if (!L) return;
  const t0 = performance.now(), made = [];
  while (L.at < L.order.length) {
    // a few parts per parse; the count grows while there is time left, so the cost per card is measured, not guessed
    const end = Math.min(L.order.length, upto >= L.at ? upto + 1 : L.at + L.step), idx = [];
    for (let j = L.at; j < end; j++) { const k = L.order[j]; if (L.slots[k] && L.slots[k].isConnected) idx.push(k); }   // a slot a filter redraw has replaced is skipped
    if (idx.length) {
      const tpl = document.createElement("template"); tpl.innerHTML = idx.map(k => L.q[k].html() + "<!--/later-->").join("");
      let i = 0, group = [];   // each part's nodes run up to its marker
      for (const n of [...tpl.content.childNodes]) {
        if (n.nodeType === 8 && n.data === "/later") { L.slots[idx[i]].replaceWith(...group); made.push(...group.filter(g => g.nodeType === 1)); group = []; i++; }
        else group.push(n);
      }
    }
    L.at = end;
    const used = performance.now() - t0;
    if (L.at > upto && used >= budget) break;
    if (used < budget / 3) L.step = Math.min(24, L.step * 2);
  }
  const cards = made.filter(m => m.classList.contains("card"));
  if (cards.length) dispatchEvent(new CustomEvent("oss:cards", { detail: { cards, first } }));   // fx-stick sticks their labels like the rest
  if (L.at >= L.order.length) { pending = null; $("#main").removeAttribute("aria-busy"); }
}
function drain(run) { idle(dl => { if (!pending || pending.run !== run) return; drawLater(dl ? Math.max(4, Math.min(8, dl.timeRemaining())) : 6); if (pending) drain(run); }); }
// Back to a spot down a long list: the cards through the remembered one (and a screen after it) are drawn before the scroll lands.
function drawThrough(sku) {
  if (!pending) return; const L = pending, j = sku ? L.order.findIndex(k => L.q[k].sku === sku) : -1, first = firstScreen();
  drawLater(0, j >= 0 ? j + first : L.order.length, true);   // no card to aim at: everything, so the remembered height exists
}

function cardHTML(p, i = 9) {
  const tone = toneOf(p);
  return `
  <article class="card" data-tone="${tone}" ${p.family ? `data-family="${p.sku}"` : ""}>
    <a class="card__a" href="/p/${p.sku}" data-piece="${p.sku}">
      <div class="tile ${p.dark || p.photo ? "tile--photo" : ""}">${p.family ? colourShot(p, { small: true, eager: i < 2 }) : shot(p, { small: true, eager: i < 2 })}${sticker(p)}</div>
      <h3 class="card__name">${esc(p.name)}</h3>
    </a>
    ${cardMeta(p)}${localOnly(p) ? `<p class="card__pick">Pickup or local delivery only</p>` : ""}
  </article>`;
}

// What a card says under the name: the item's own line, or for a hookah family its colours and whether it has a base.
function cardMeta(p) {
  const desc = p.details?.description;   // one line on the card, the whole of it on the product page
  if (!p.family) return `<p class="card__meta ${desc ? "card__meta--one" : ""}">${esc(desc || p.note || (p.facts && p.facts.size) || "")}</p>`;
  const fam = familyOf(p), bits = stemSet(p) ? "Stem set, no base" : "";   // the chips carry the colour count
  return `${desc ? `<p class="card__meta card__meta--one">${esc(desc)}</p>` : ""}${fam.length > 1 ? swatchGroup(fam, p, { label: `Colours of ${p.name}`, card: p.sku, max: 5 }) : ""}${bits ? `<p class="card__meta card__meta--fam">${bits}</p>` : ""}`;
}

// ---------- views ----------
// Every page opens with the same band the shop sections have: a flat jewel colour, the title, and room for the page's object.
const band = (fx, tone, title, note = "") => `<section class="shophead shophead--page" data-tone="${tone}" data-fx="${fx}"><h1 class="shophead__h">${title}</h1>${note ? `<p class="shophead__n">${note}</p>` : ""}</section>`;
function viewHome() {
  // the first screen and the counter picks: the shop's ticked (in-store) hookahs with their own photo, one per family (public/picks.js, the Worker preloads the same first one)
  const ranked = heroPicks(PRODUCTS, 13), stars = ranked.slice(0, 5), picks = ranked.slice(5, 13);
  for (const p of SHELF.filter(x => x.cat === "hookahs" && !x.dark)) { if (picks.length >= 8) break; if (!picks.includes(p) && !stars.includes(p)) picks.push(p); }
  const resin = SHELF.filter(p => p.dark && forSale(p));
  const SLABS = ["gilt", "cobalt", "ruby", "emerald", "teal"];
  const priceWord = p => p.state === "tbd" ? "price TBD" : whole(p.price);
  const tall = SHELF.filter(p => p.cat === "hookahs" && p.height && !p.dark && p.img).sort((a, b) => b.height - a.height);   // only measured heights: a guessed height is never drawn
  return `
  <section class="hero">
    <div class="hero__stage">
      <div class="hero__slabs" aria-hidden="true">${stars.map((p, i) => `<span data-tone="${SLABS[i]}"></span>`).join("")}</div>
      <p class="hero__word" aria-hidden="true">Hookahs,</p>
      <div class="hero__pieces">${stars.map((p, i) => `<a class="piece" href="/p/${p.sku}" style="--cm:${p.height || 72};--i:${i}" aria-label="${esc(p.name)}, ${priceWord(p)}">${shot(p, { eager: i < 3, use: "slab" })}${sticker(p)}</a>`).join("")}</div>
      <p class="hero__word hero__word--comma" aria-hidden="true"><span>Hookahs</span>,</p>
    </div>
    <div class="hero__in">
      <h1 class="hero__h"><span class="hero__lead">Hookahs,</span> <span class="hero__rest">and everything that goes with them.</span></h1>
      <div class="hero__side">
        <p class="hero__p">Local delivery from $10 near Windsor, free pickup, and shipping across Canada.</p>
        <div class="hero__cta"><a class="btn" href="/shop/hookahs">Shop hookahs</a><a class="btn btn--ghost" href="/shop">All ${SHELF.length} pieces</a></div>
      </div>
    </div>
  </section>
  <section class="cats" aria-label="Shop by category">
    ${CATEGORIES.map((c, i) => { const n = SHELF.filter(p => p.cat === c.id).length; const lead = (c.id === "hookahs" && stars[0]) || SHELF.find(p => p.cat === c.id && !p.dark && p.img) || SHELF.find(p => p.cat === c.id && !p.dark);
      return `<a class="cat" data-tone="${c.tone}" href="/shop/${c.id}">${shot(lead, { small: i > 0, use: i ? "cat" : "cat1", cls: "cat__img" })}<span class="cat__name">${c.name}</span><span class="cat__n num">${n}</span></a>`; }).join("")}
  </section>
  <section class="shelf">
    <header class="shelf__head"><h2 class="h2">Counter picks</h2><a class="link" href="/shop/hookahs">All ${SHELF.filter(p => p.cat === "hookahs").length} hookahs</a></header>
    <div class="grid">${picks.map((p, i) => card(p, i + 8)).join("")}</div>
  </section>
  <section class="gifts" aria-labelledby="gift-h">
    <header class="shelf__head"><h2 class="h2" id="gift-h">Gifts</h2><p class="gifts__note">Packed at the counter. Add a note in the cart.</p></header>
    <div class="gifts__row">
      ${[["under-50", "Under $50", "emerald", giftList(true)[0] || liveCat("bowls")[0]], ["under-150", "Under $150", "cobalt", giftList(false)[0]], ["set", "The full setup", "ruby", liveCat("hookahs")[0] || liveCat("bowls")[0]]].filter(g => g[3]).map(([id, label, tone, lead]) =>
        `<a class="gift" data-tone="${tone}" href="${id === "set" ? "/set" : "/gifts/" + id}">${shot(lead, { small: true, use: "cat", cls: "gift__img" })}<span class="gift__name">${label}</span><span class="gift__sub">${id === "set" ? (liveCat("hookahs").length ? "Hookah, bowl, hose" : "Bowl and hose, hookahs once priced") : giftList(id === "under-50").length + " pieces"}</span></a>`).join("")}
    </div>
  </section>
  ${tall.length >= 3 ? `<section class="lineup" aria-labelledby="lu-h">
    <header class="lineup__head"><h2 class="h2 h2--xl" id="lu-h">Compare heights.</h2><p class="lineup__note">From the shelf, tallest to shortest.</p></header>
    <div class="lineup__row" tabindex="0" role="group" aria-label="Hookahs by height">
      ${tall.filter((p, i) => tall.length < 12 || i % 3 === 0).map(p =>
        `<a class="lu" href="/p/${p.sku}" style="--cm:${p.height}"><img class="lu__img" src="img/pc/${p.img}-s.webp${V}" ${srcset(p)} sizes="${SIZES.lineup}" alt="" loading="lazy" width="360" height="450"><span class="lu__cm num">${p.height} cm</span><span class="lu__name">${esc(p.name)}</span></a>`).join("")}
    </div>
  </section>` : ""}
  ${resin.length ? `<section class="resin">
    <div class="resin__copy">
      <h2 class="h2 h2--xl">One of one.</h2>
      <p class="lead">Poured resin stems. No two come out of the mould the same, so when one sells, that one is gone.</p>
      <a class="btn" href="/shop/hookahs">See what is left</a>
    </div>
    <div class="resin__row">${resin.map(p => `<a class="resin__item" href="/p/${p.sku}" data-piece="${p.sku}">${shot(p, { use: "resin" })}<span class="resin__name">${esc(p.name)}</span>${sticker(p)}</a>`).join("")}</div>
  </section>` : ""}
  <section class="pack">
    <div class="pack__copy">
      <h2 class="h2 h2--xl">How we ship glass.</h2>
      <ul class="pack__list">
        <li><b>Taken apart.</b> Stem, base and tray are wrapped separately so nothing long carries the weight.</li>
        <li><b>Double boxed.</b> The base sits in its own box inside the shipping box.</li>
        <li><b>Covered.</b> A glass box worth over $100 ships with signature and full coverage.</li>
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

function shopGrid(cat) {
  const c = catById[cat] || null, list = c ? SHELF.filter(p => p.cat === c.id) : SHELF;
  // Hookahs: the shop's ticked (in-store) pieces first, then the rest of the catalogue, each grouped by kind
  const fams = list.filter(p => p.family), byKind = l => GROUPS.map(([k, name]) => [name, l.filter(p => (p.facts.group || "full_size") === k)]).filter(g => g[1].length);
  const tiers = cat === "hookahs" && fams.length ? [["In the shop", "Pieces the shop has in. Prices and counts TBD.", byKind(fams.filter(ticked))], ["From the catalogue", "From Ace Hookah\u2019s catalogue. Ask the counter about one.", byKind(fams.filter(p => !ticked(p)))]].filter(t => t[2].length) : null;
  const groups = tiers ? null : cat === "hookahs" ? [...Object.keys(SERIES).map(k => [k, list.filter(p => seriesOf(p) === k)]), ["More from the shelf", list.filter(p => !seriesOf(p) && !p.dark)], ["One of one", list.filter(p => p.dark)]].filter(g => g[1].length) : [["", list]];
  const range = items => { const pr = items.filter(forSale).map(x => x.price); return pr.length === items.length && pr.length ? `, ${whole(Math.min(...pr))} to ${whole(Math.max(...pr))}` : ""; };
  return `${tiers ? tiers.map(([t, note, gs]) => `<section class="tier" aria-label="${t}"><header class="tier__head"><h2 class="tier__h">${t}</h2><p class="tier__n"><span class="num">${gs.reduce((a, g) => a + g[1].length, 0)}</span>&nbsp;hookahs. ${note}</p></header>
    <div class="grid grid--shop">${gs.map(([name, items]) => `<h3 class="series">${name} <span class="num">${items.length} ${items.length === 1 ? "hookah" : "hookahs"}</span></h3>` + items.map(card).join("")).join("")}</div></section>`).join("")
  : `<div class="grid grid--shop">${groups.map(([name, items]) => (name ? `<h2 class="series" data-tone="${SERIES[name] || ""}">${name} <span class="num">${items.length} pieces${range(items)}</span></h2>` : "") + items.map(card).join("")).join("")}</div>`}`;
}
// The band's line under a section name, from the section's own items, counted: Heat says how many are charcoal and how
// many foil; Hookahs counts hookahs, Shisha flavours; the pickup line only when every item in the section is pickup or local.
const plural = (n, one, many) => `<span class="num">${n}</span> ${n === 1 ? one : many}`;
function bandNote(c, list) {
  if (!c) return plural(list.length, "piece", "pieces");
  const local = list.length && list.every(localOnly) ? ".<br>Pickup or local delivery only." : "";
  if (c.id === "heat") {
    const coal = list.filter(isCharcoal).length, other = list.length - coal;
    return [coal ? plural(coal, "kind of charcoal", "kinds of charcoal") : "", other ? plural(other, list.filter(p => !isCharcoal(p)).every(p => /foil/i.test(p.name)) ? "foil pack" : "piece", list.filter(p => !isCharcoal(p)).every(p => /foil/i.test(p.name)) ? "foil packs" : "pieces") : ""].filter(Boolean).join(" and ") + local;
  }
  if (c.id === "hookahs") return plural(list.length, "hookah", "hookahs") + local;
  if (c.id === "shisha") return plural(list.length, "flavour", "flavours") + local;
  return plural(list.length, "piece", "pieces") + local;
}
function viewShop(cat) {
  const c = catById[cat] || null, list = c ? SHELF.filter(p => p.cat === c.id) : SHELF;
  const f = c && find.findShop(c.id);   // section filters (find.js); null when a section has nothing to filter by
  return `
  <section class="shophead" data-tone="${c ? c.tone : "bone"}" ${c ? `data-cat="${c.id}"` : `data-fx="all"`}>
    <h1 class="shophead__h">${c ? c.name : "Everything"}</h1>
    <p class="shophead__n">${bandNote(c, list)}</p>
  </section>
  <nav class="chips" aria-label="Categories"><a href="/shop" ${!c ? 'aria-current="page"' : ""}>All</a>${CATEGORIES.map(x => `<a href="/shop/${x.id}" ${c && c.id === x.id ? 'aria-current="page"' : ""}>${x.name}</a>`).join("")}<a href="/gifts/under-50">Gifts</a></nav>
  ${f ? f.html(() => shopGrid(cat)) : shopGrid(cat)}`;
}

// The product page for charcoal: one plain answer about how it is bought, in place of the delivery and shipping rows.
// The rule sits above the button, so nobody adds it to the cart before reading how it is bought.
const counterLine = p => p.weightTbd && !isCharcoal(p)
  ? `<div class="dline dline--fixed dline--above" role="note"><span class="dline__msg">Pickup or local delivery for now</span><span class="dline__sub">Shipping TBD: the pack weight is being confirmed. Free pickup at ${SHOP_STREET}, or local delivery from $10 near Windsor.</span></div>`
  : `<div class="dline dline--fixed dline--above" role="note"><span class="dline__msg">Pickup or local delivery only</span><span class="dline__sub">Never shipped by Canada Post. Free pickup at ${SHOP_STREET}, or local delivery from $10 near Windsor.</span></div>`;
// a charcoal box's size and count, read from the shop's own line; a size the list leaves blank says so
const sizeOf = p => { const t = [p.details?.variant, p.name, p.facts?.size].filter(Boolean).join(" "); const m = t.match(/\b\d+(?:\.\d+)?\s?(?:mm|cm|in)\b/i); return m ? m[0] : ""; };
function counterSpec(p) {
  const d = p.details || {}, box = d.box_sku && bySku[d.box_sku], rolls = PRODUCTS.filter(x => x.details?.box_sku === p.sku);
  return `<section class="spec" aria-labelledby="spec-h">
        <h2 class="h3" id="spec-h">Details</h2>
        <dl class="spec__list">
          <div><dt>Item</dt><dd class="num">${p.sku}</dd></div>
          ${d.brand ? `<div><dt>Brand</dt><dd>${esc(d.brand)}</dd></div>` : ""}
          ${box ? `<div><dt>From the box</dt><dd><a class="link" href="/p/${box.sku}">${esc(box.name)}</a>, ${whole(box.price)}</dd></div>` : ""}
          ${rolls.map(r => `<div><dt>One roll</dt><dd><a class="link" href="/p/${r.sku}">Single roll</a>, ${whole(r.price)}</dd></div>`).join("")}
          ${isCharcoal(p) || p.weightTbd ? `<div><dt>Size</dt><dd>${sizeOf(p) ? esc(sizeOf(p)) : TBD("")}</dd></div>` : ""}
          ${p.facts && "count" in p.facts ? `<div><dt>${isCharcoal(p) ? "Pieces" : "Sheets"}</dt><dd>${p.facts.count ? `<span class="num">${p.facts.count}</span>` : TBD("")}</dd></div>` : ""}
          ${p.weightTbd ? `<div><dt>Weight</dt><dd>${TBD("")}</dd></div>` : ""}
          <div><dt>Getting it</dt><dd>${p.weightTbd && !isCharcoal(p) ? `Pickup or local delivery. ${TBD("Shipping")}` : "Pickup or local delivery only"}</dd></div>
          ${!p.img && !p.photo ? `<div><dt>Photo</dt><dd>${box && box.img ? "Shows the box this roll comes from." : "Coming. The drawing stands in until the shop's photo is up."}</dd></div>` : ""}
        </dl>
      </section>`;
}
// What is known about an item on view, and what is not yet: unknowns are said as "TBD", never guessed or left out.
function factsSpec(p, fam) {
  const f = p.facts || {}, base = f.includes_base === true ? "Included" : f.includes_base === false ? "Not included: stem set, no base" : TBD("");
  return `<section class="spec" aria-labelledby="spec-h">
        <h2 class="h3" id="spec-h">Details</h2>
        <dl class="spec__list">
          <div><dt>Item</dt><dd class="num">${p.sku}</dd></div>
          <div><dt>Price</dt><dd>${p.state === "tbd" ? TBD("") : `<span class="num">${whole(p.price)}</span>, coming soon`}</dd></div>
          ${p.family ? `<div><dt>Base</dt><dd>${base}</dd></div>
          <div><dt>Height</dt><dd>${f.height_cm ? `<span class="num">${f.height_cm} cm</span>` : TBD("")}</dd></div>
          ${f.acrylic ? `<div><dt>Material</dt><dd>Acrylic</dd></div>` : ""}
          ${Array.isArray(f.includes) && f.includes.length ? `<div><dt>Comes with</dt><dd>${esc(f.includes.join(", "))}</dd></div>` : ""}
          <div><dt>Colours</dt><dd>${fam.length > 1 ? `<span class="num">${fam.length}</span> in the catalogue. ` : ""}${fam.every(v => v.named) ? esc(fam.map(v => v.colour).join(", ")) : TBD("Colour names")}</dd></div>` : ""}
          <div><dt>Availability</dt><dd>${p.family && ticked(p) ? "In the shop. " : ""}${TBD("Count")}</dd></div>
          ${!p.img ? `<div><dt>Photo</dt><dd>Coming. The drawing stands in until the photo is ready.</dd></div>` : p.family && f.photo === "family" ? `<div><dt>Photo</dt><dd>Shows another colour of this hookah.</dd></div>` : ""}
          ${p.family ? `<div><dt>From</dt><dd>Ace Hookah\u2019s October 2026 catalogue</dd></div>` : ""}
        </dl>
      </section>`;
}
function viewProduct(sku) {
  const asked = new URLSearchParams(location.search).get("colour"), base = bySku[sku];
  const p = base && base.family && bySku[asked] && bySku[asked].family === base.family ? bySku[asked] : base;
  if (!p) return `${band("missing", "ruby", "That one is gone.")}<section class="empty"><p class="lead">It may have sold. <a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
  const c = catById[p.cat], parcels = pack([{ product: p, qty: 1 }]), opts = cpQuote([{ product: p, qty: 1 }]), b = parcels[0];
  const inCart = state.cart.some(l => l.sku === p.sku);   // the colour chosen, not the address's first colour
  const fam = familyOf(p), sale = forSale(p);
  const more = SHELF.filter(x => x.cat === p.cat && x.sku !== sku && (!p.family || x.family !== p.family) && !x.dark && !isSold(x))
    .sort((a, b) => p.family ? ((b.facts?.group === p.facts.group) - (a.facts?.group === p.facts.group)) || (ticked(b) - ticked(a)) : (seriesOf(b) === seriesOf(p)) - (seriesOf(a) === seriesOf(p))).slice(0, 4);
  const n = parseInt(p.sku.slice(-3), 10), nth = (c, k) => { const l = liveCat(c); return l.length ? l[(n + k) % l.length] : null; };
  const goes = p.cat === "hookahs" ? [nth("bowls", 0), nth("heat", 1), nth("hoses", 2), nth("parts", 3)].filter(Boolean) : [];
  // a hookah family's colours: each chip shows its colour and swaps the photo; a name the shop has not confirmed is never stated as fact
  const chips = fam.length > 1 ? `<p class="swatches__n" id="colour-h">Colour <b data-colour-name ${p.colour ? "" : "hidden"}>${esc(p.colour || "")}</b> <span class="num">${fam.indexOf(p) + 1} of ${fam.length}</span> ${fam.every(v => v.named) ? "" : TBD("Colours")}</p>
      ${swatchGroup(fam, p, { label: "Colour" })}` : "";
  const sold = isSold(p);
  return `
  <article class="pdp" data-tone="${toneOf(p)}" data-cat="${p.cat}">
    <div data-stage="${p.sku}" class="pdp__tile tile ${p.dark || p.photo ? "tile--photo" : ""}">${p.family ? colourShot(p, { eager: true, alt: p.colour ? `${p.name}, ${p.colour}` : p.name }) : shot(p, { eager: true, alt: p.name })}${sticker(p, { big: true })}</div>
    <div class="pdp__info">
      <p class="crumb"><a href="/shop/${p.cat}">${c.name}</a></p>
      <h1 class="pdp__name">${esc(p.name)}</h1>
      ${p.family ? (stemSet(p) ? `<p class="pdp__note">Stem set, no base.</p>` : "") : `<p class="pdp__note">${esc(p.note || p.facts?.size || "")}${p.height ? `. Stands ${p.height} cm.` : /[.!?]$/.test(p.note || p.facts?.size || ".") ? "" : "."}</p>`}
      ${p.details?.description ? `<p class="pdp__desc">${esc(p.details.description)}</p>` : ""}
      ${chips}
      ${p.details && p.details.notes ? `<p class="pdp__notes"><span>Notes</span> ${esc(p.details.notes)}</p>` : ""}
      ${localOnly(p) ? counterLine(p) : ""}
      ${!sale ? `${p.state === "tbd" ? "" : `<p class="soldline">Coming soon.</p>`}<p class="pdp__avail">${p.family ? (ticked(p) ? `In the shop. ${TBD("Availability")}` : `From Ace Hookah\u2019s catalogue. ${TBD("Availability")}`) : TBD("Availability")}</p><a class="btn btn--ghost btn--call" href="tel:+15192552222">Ask the counter</a>`
        : sold ? `<p class="soldline">${p.dark ? "This one has sold. Each resin stem is poured once." : "Sold out for now."}</p><a class="btn btn--ghost btn--call" href="tel:+15192552222">Call the counter</a>`
        : inCart ? `<a class="btn btn--wide" href="/cart">In your cart. View cart</a>` : `<button class="btn btn--wide" type="button" data-add="${p.sku}">Add to cart</button>`}
      ${sale ? deliveryLine(p, opts) : ""}
      ${!sale ? factsSpec(p, fam) : `<section class="ways" aria-labelledby="ways-h">
        <h2 class="h3" id="ways-h">Delivery, shipping and pickup</h2>
        ${opts.length || (state.dest && localOnly(p)) ? `<p class="ways__to">To ${esc(state.dest.full)}${state.dest.city ? ", " + esc(state.dest.city) : ""}. <button class="link" type="button" data-open-postal>Change</button></p>
        <table class="ledger"><thead><tr><th scope="col">Service</th><th scope="col">Arrives</th><th scope="col" class="r">Cost</th></tr></thead>
        <tbody>${localRow(p)}${opts.map(o => `<tr><td>${o.carrier} ${o.service}</td><td>${days(o.days)}</td><td class="r num">${money(o.total)}</td></tr>`).join("")}
        <tr><td>Pick up at ${SHOP_STREET}</td><td>${pickupDay()}</td><td class="r num">Free</td></tr></tbody></table>`
        : `<p class="ways__to">Local delivery from $10 near Windsor. Free pickup. ${localOnly(p) ? "" : p.ship === "ground_only" ? "Ships by ground across Canada." : "Ships across Canada."}</p>`}
      </section>`}
      ${!sale ? "" : localOnly(p) ? counterSpec(p) : `<section class="spec" aria-labelledby="spec-h">
        <h2 class="h3" id="spec-h">Packed size</h2>
        <dl class="spec__list">
          <div><dt>Item</dt><dd class="num">${p.sku}</dd></div>
          ${p.facts?.size ? `<div><dt>Size</dt><dd>${esc(p.facts.size)}</dd></div>` : ""}
          <div><dt>Weight, packed</dt><dd class="num">${b.kg} kg</dd></div>
          <div><dt>Box</dt><dd><span class="num">${b.l} \u00d7 ${b.w} \u00d7 ${b.h} cm</span>, ${esc(b.label.toLowerCase())}</dd></div>
          ${opts.length ? `<div><dt>Billed as</dt><dd><span class="num">${opts[0].perParcel[0].billableKg} kg</span>, the larger of weight and box size</dd></div>` : ""}
          ${p.glass ? `<div><dt>Glass</dt><dd>Double boxed${p.price > 100 ? ", signature and coverage included" : ""}</dd></div>` : ""}
        </dl>
      </section>`}
    </div>
  </article>
  ${goes.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">Goes with this</h2>${sale ? `<a class="link" href="/set">Build a set</a>` : ""}</header><div class="grid">${goes.map(card).join("")}</div></section>` : ""}
  ${more.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">More ${localOnly(p) ? "charcoal" : c.name.toLowerCase()}</h2><a class="link" href="/shop/${p.cat}">All ${localOnly(p) ? "charcoal" : c.name.toLowerCase()}</a></header><div class="grid">${more.map(card).join("")}</div></section>` : ""}`;
}

// ---------- gifts ----------
function giftList(under) { return SHELF.filter(p => forSale(p) && !p.dark && !isSold(p) && !localOnly(p) && (under ? p.price < 50 : p.price >= 50 && p.price <= 150)).sort((a, b) => b.price - a.price); }
function viewGifts(kind) {
  const under = kind !== "under-150", list = giftList(under);
  return `
  <section class="shophead" data-tone="${under ? "emerald" : "cobalt"}" data-fx="gifts">
    <h1 class="shophead__h">${under ? "Under $50" : "Under $150"}</h1>
    <p class="shophead__n"><span class="num">${list.length}</span> gifts, packed at the counter</p>
  </section>
  <nav class="chips chips--on" aria-label="Gifts"><a href="/shop">Everything</a><a href="/gifts/under-50" ${under ? 'aria-current="page"' : ""}>Under $50</a><a href="/gifts/under-150" ${!under ? 'aria-current="page"' : ""}>Under $150</a><a href="/set">The full setup</a></nav>
  <div class="grid grid--shop">${list.map(card).join("")}</div>`;
}

// ---------- build a set ----------
// The heat section is charcoal now: pickup or local delivery only, so it is an optional pick, never put in a set by default.
const SLOTS = [["hookah", "hookahs", "The hookah"], ["bowl", "bowls", "A bowl"], ["heat", "heat", "Charcoal, pickup or local delivery only"], ["hose", "hoses", "A hose"]];
const OPTIONAL = new Set(["heat"]);
const setOpts = c => inCat(c).filter(p => forSale(p) && !isSold(p));   // a set is never offered, or defaulted to, something the shop cannot sell (a hookah with "Price TBD" included)
const canSet = p => forSale(p) && !isSold(p) ? p : null;
function setPicks() { return SLOTS.map(([slot, cat]) => canSet(bySku[state.set[slot]]) || (OPTIONAL.has(slot) ? null : setOpts(cat)[0] || null)); }
function setSummary() {
  const picks = setPicks().filter(Boolean), lines = picks.map(product => ({ product, qty: 1 })), parcels = pack(lines), sum = picks.reduce((a, p) => a + p.price, 0);
  const d = state.dest, near = !!d && localArea(d), lq = near && d.complete ? localQ() : null;
  const localVal = !near ? null : !d.complete ? `<button class="link" type="button" data-open-postal>Add full postal code</button>` : !lq || lq.status === "checking" ? "Checking" : lq.status === "ok" ? `<span class="num">${feeText(localDue(lq.fee_cents, cartCents(lines)) / 100)}</span>` : lq.status === "far" || lq.status === "down" ? null : "At checkout";
  const q = localVal === null ? cpQuote(lines)[0] || null : null;
  return `
    <h2 class="h3">Your set</h2>
    <ul class="setlines">${picks.map(p => `<li><span>${esc(p.name)}</span><span class="num">${money(p.price)}</span></li>`).join("")}</ul>
    <dl class="totals">${!carried(lines) ? `
      <div><dt>Charcoal</dt><dd>Pickup or local delivery only</dd></div>` : `
      <div><dt>Ships as</dt><dd>${parcels.length} ${parcels.length === 1 ? "box" : "boxes"}, <span class="num">${parcels.reduce((a, b) => a + b.kg, 0).toFixed(1)} kg</span></dd></div>`}
      <div><dt>${localVal !== null ? "Delivery to " + esc(d.full) : "Shipping" + (q ? " to " + esc(state.dest.full) : "")}</dt><dd>${localVal !== null ? localVal : q ? `<span class="num">${money(q.total)}</span>` : state.dest && !carried(lines) ? "Local delivery or pickup" : !carried(lines) ? "Pickup free, or local delivery" : `<button class="link" type="button" data-open-postal>Add postal code</button>`}</dd></div>
      <div class="totals__door"><dt>Set price</dt><dd class="num">${money(sum)}</dd></div>
    </dl>
    ${picks.length ? `<button class="btn btn--wide" type="button" data-add-set>Add the set to cart</button>` : `<a class="btn btn--wide" href="/shop">See what is in stock</a>`}`;
}
function viewSet() {
  const picks = setPicks();
  return `
  <section class="shophead" data-tone="ruby" data-fx="set">
    <h1 class="shophead__h">Build a set</h1>
    <p class="shophead__n">Three picks, plus charcoal if you want it.</p>
  </section>
  <div class="set">
    <div class="set__steps">${SLOTS.map(([slot, cat, label], i) => `
      <section class="pick" aria-labelledby="pick-${slot}">
        <h2 class="h3" id="pick-${slot}"><span class="num">${i + 1}</span> ${label}</h2>
        ${!setOpts(cat).length && slot === "hookah" ? `<p class="pick__none">Hookahs join sets once the shop sets their prices. <a class="link" href="/shop/hookahs">See the hookahs</a></p>` : ""}
        <div class="pick__row" role="group" aria-label="${label}">${setOpts(cat).map(p => `<button class="pick__opt" type="button" data-set="${slot}" data-sku="${p.sku}" aria-pressed="${picks[i]?.sku === p.sku}" data-tone="${toneOf(p)}"><span class="tile">${shot(p, { small: true, use: "thumb" })}${sticker(p)}</span><span class="pick__name">${esc(p.name)}</span></button>`).join("")}</div>
      </section>`).join("")}</div>
    <aside class="set__sum" data-set-summary>${setSummary()}</aside>
  </div>`;
}

// ---------- search (search.js: ways in, grouped results, synonyms, typo tolerance) ----------
const searchResults = () => finder.searchOut(state.q);
const viewSearch = () => finder.searchPage(state.q, new URLSearchParams(location.search).get("in"));

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
  if (on === "set") { const s = $("[data-set-summary]"); if (s) s.innerHTML = setSummary(); syncChrome(); return; }
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
  if (isSold(p) || !forSale(p)) return "";
  let s = deliveryNow(cartCents() + (state.cart.some(l => l.sku === p.sku) ? 0 : toCents(p.price)));
  if (localOnly(p) && (s.key === "far" || s.key === "ship" || s.key === "down")) s = { msg: "This one goes by local delivery or pickup", sub: "Canada Post does not carry it. Pickup is free", act: "Change" };
  else if (toQuebec()) s = { msg: "We do not ship to Quebec yet", sub: "The site is in English only for now. Pickup in Windsor is free", act: "Change" };
  else if (state.dest && !opts.length && (s.key === "far" || s.key === "ship" || s.key === "down")) s = { msg: `We cannot price shipping to ${state.dest.full} here`, sub: "Call 519-255-2222, or pickup is free", act: "Change" };
  return `<button class="dline" type="button" data-open-postal><span class="dline__msg">${esc(s.msg)}</span>${s.sub ? `<span class="dline__sub">${esc(s.sub)}</span>` : ""}<span class="dline__act">${esc(s.act)}</span></button>`;
}
function syncDelivery() {
  const box = $("[data-delivery-strip]"), btn = $(".dstrip__btn", box), on = route().replace(/^#\/?/, "").split("/")[0], answered = !!state.reach || (!!state.dest && (state.dest.complete || !localArea(state.dest))),
    choosing = on === "shop" && !answered && !store.get("choose-off"), show = choosing || (!["cart", "checkout", "order", "shop", "p"].includes(on) && !answered && !store.get("strip-off"));   // gone once we have their answer, or once they close it. The product page and cart can still take one
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
  // Charcoal in the cart: the whole order goes by pickup or local delivery (cpQuote offers no Canada Post for it).
  // With other pieces too, the shopper can also leave the charcoal out and have the rest shipped.
  const counter = lines.some(l => localOnly(l.product)), mixed = counter && lines.some(l => !localOnly(l.product));
  const parcels = pack(lines), opts = cpQuote(lines), q = localQ();
  const near = localArea(state.dest) && !!state.dest.complete && state.localOff !== state.dest.full;
  const checking = near && (!q || q.status === "checking"), canLocal = near && !!q && (q.status === "ok" || q.status === "address" || q.status === "unsure");
  const localFee = canLocal && q.status === "ok" ? localDue(q.fee_cents, cartCents(lines)) / 100 : null;
  const wantsLocal = state.ship === "local" || (!state.ship && !counter && state.reach !== "nationwide");   // someone who chose nationwide is never defaulted onto local delivery; a cart with charcoal chooses for itself
  // a cart holding shisha (paid at the counter until the card company approves it) is a pickup, whatever was chosen before
  const pickup = state.ship === "pickup" || counterPayIn(lines).length > 0, local = !pickup && canLocal && wantsLocal, waiting = checking && wantsLocal;
  return { parcels, opts, canLocal, checking, localFee, status: near && q ? q.status : null, pickup, local, counter, mixed, chosen: pickup || local || waiting || state.ship === "local" ? null : opts.find(o => o.id === state.ship) || opts[0] || null };
}
// On a phone the dock asks for the postal code, so the page does not ask a second time. Crossing the width puts the right one back.
const WIDE = matchMedia("(min-width:960px)");
WIDE.addEventListener("change", () => { if (route() === "#/cart") render(); });
// A mixed cart's other way: leave the charcoal out, so the rest can be shipped anywhere.
const dropOpt = lines => { const c = lines.filter(l => localOnly(l.product)), n = c.reduce((a, l) => a + l.qty, 0), worth = c.reduce((a, l) => a + l.product.price * l.qty, 0);
  return `<label class="opt"><input type="radio" name="ship" value="drop" data-drop-counter><span class="opt__name">Leave the charcoal out, ship the rest<small>Takes out ${n} charcoal ${n === 1 ? "box" : "boxes"} (${money(worth)}). You can put ${n === 1 ? "it" : "them"} back.</small></span><span class="num">Shipping next</span></label>`; };
function viewCart() {
  const lines = cartLines(), news = state.cartNews.length ? `<div class="cartnews" role="status" data-cart-news>${state.cartNews.map(m => `<p>${esc(m)}</p>`).join("")}${state.dropped?.length ? `<button class="link cartnews__undo" type="button" data-undo-drop>Put the charcoal back</button>` : ""}</div>` : ""; state.newsSeen = state.cartNews.length > 0;
  if (!lines.length) return `${band("cart", "gilt", "Your cart", "Nothing in it yet.")}<section class="empty">${news}<p class="lead">Start with the <a class="link" href="/shop/hookahs">hookahs</a>, the <a class="link" href="/shop/bowls">bowls</a>, or <a class="link" href="/set">build a set</a>.</p></section>`;
  const was = shipChoice(lines); if (state.ship === "local" && !was.canLocal && !was.checking) { state.ship = null; store.set("ship", null); }   // the cart is where a new way of sending it is shown and chosen
  const { parcels, opts, canLocal, checking, localFee, status, pickup, local, chosen, counter, mixed } = shipChoice(lines), sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const ready = pickup || local || !!chosen, otherWay = carried(lines) ? "You can still ship it or pick it up free." : "You can still pick it up free.";
  const localNote = !state.dest ? "" : !state.dest.complete && localArea(state.dest) ? `<p class="note">Add your full postal code to see your delivery price. <button class="link" type="button" data-open-postal>Add it</button></p>`
    : checking ? `<p class="note" role="status">Checking delivery to ${esc(state.dest.full)}.</p>`
    : status === "far" || (state.dest.complete && !localArea(state.dest) && state.dest.prov === "ON" && /^N[089]/.test(state.dest.fsa)) ? `<p class="note">${esc(state.dest.full)} is past our 25 km delivery area. ${otherWay}</p>`
    : status === "down" ? `<p class="note">We cannot check delivery right now. ${otherWay}</p>` : "";
  const tooHeavy = state.dest && !opts.length && !canLocal && carried(lines) && !toQuebec();
  return `
  ${band("cart", "gilt", "Your cart", `<span class="num">${lines.reduce((a, l) => a + l.qty, 0)}</span> ${lines.reduce((a, l) => a + l.qty, 0) === 1 ? "piece" : "pieces"}, packed at the counter`)}
  <section class="cart">
    ${news}
    <ul class="lines">${lines.map(({ product: p, qty }) => `
      <li class="line" data-tone="${toneOf(p)}">
        <a class="line__tile tile ${p.dark || p.photo ? "tile--photo" : ""}" href="/p/${p.sku}" aria-label="${esc(p.name)}">${shot(p, { small: true, use: "thumb" })}</a>
        <div class="line__body"><a class="line__name" href="/p/${p.sku}">${esc(p.name)}</a><p class="line__meta num">${p.sku} &middot; ${localOnly(p) ? `<b class="line__pick">Pickup or local delivery only</b>` : `${p.kg} kg`}${qty >= stockFor(p) && stockFor(p) < MAX_QTY ? ` &middot; only ${stockFor(p)} in stock` : ""}</p>
          <div class="qty"><button type="button" aria-label="One less ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty - 1}">&minus;</button><span class="num" aria-live="polite">${qty}</span><button type="button" aria-label="One more ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty + 1}" ${qty >= stockFor(p) ? "disabled" : ""}>+</button></div></div>
        <p class="line__price num">${money(p.price * qty)}</p>
      </li>`).join("")}</ul>
    <section class="cartship" data-pickup-choice tabindex="-1">
      <h2 class="h3">${counter ? "How you get it" : "How we pack it"}</h2>
      ${counter ? "" : `<ol class="boxes">${parcels.map(p => `<li><span class="num">${p.l} \u00d7 ${p.w} \u00d7 ${p.h} cm, ${p.kg} kg</span> ${esc(p.label.toLowerCase())}, ${p.items.length} ${p.items.length === 1 ? "item" : "items"}</li>`).join("")}</ol>`}
      ${!state.dest && WIDE.matches ? `<button class="btn btn--wide" type="button" data-open-postal>Check delivery to my postal code</button>` : ""}
      ${localNote}
      ${counter ? `<p class="note">${canLocal ? "Choose local delivery or free pickup for the whole order" : "Choose free pickup for the whole order"}${mixed ? ", or leave the charcoal out to ship the rest" : ""}. Charcoal goes by pickup or local delivery only, never by Canada Post.${state.dest?.complete && !canLocal && !checking && !localArea(state.dest) ? ` Local delivery does not reach ${esc(state.dest.full)}.` : ""}</p>` : ""}
      ${toQuebec() && carried(lines) ? `<p class="note">${QC_NOTE}</p>` : ""}
      ${tooHeavy ? `<p class="note">One of these boxes is over the 30 kg carrier limit. Call the counter at 519-255-2222 and we will quote it by hand.</p>` : ""}
      ${opts.length || canLocal ? `<fieldset class="opts"><legend>Getting it to ${esc(state.dest.full)} <button class="link" type="button" data-open-postal>Change</button></legend>
        ${canLocal ? `<label class="opt"><input type="radio" name="ship" value="local" ${local ? "checked" : ""}><span class="opt__name">Local delivery<small>${localFee !== null ? localEta() : "We price it from your street address at checkout"}</small></span><span class="num">${localFee !== null ? feeText(localFee) : "At checkout"}</span></label>` : ""}
        <label class="opt"><input type="radio" name="ship" value="pickup" ${pickup ? "checked" : ""}><span class="opt__name">Pick up at the Windsor counter<small>${SHOP_STREET}, Windsor. ${pickupReady()}</small></span><span class="num">Free</span></label>
        ${opts.map(o => `<label class="opt"><input type="radio" name="ship" value="${o.id}" ${chosen && o.id === chosen.id ? "checked" : ""}><span class="opt__name">${o.carrier} ${o.service}<small>${days(o.days)}</small></span><span class="num">${money(o.total)}</span></label>`).join("")}
        ${mixed ? dropOpt(lines) : ""}
      </fieldset>
      ${canLocal ? `<p class="note" data-free-note>${freeNote(cartCents(lines))}</p>` : ""}
      ${chosen ? `<details class="why" ${state.whyOpen ? "open" : ""}><summary>What makes up ${money(chosen.total)}</summary><dl>
        ${chosen.perParcel.map((p, i) => `<div><dt>Box ${i + 1}, billed at ${p.billableKg} kg</dt><dd class="num">${money(p.freight)}</dd></div>`).join("")}
        ${chosen.cover ? `<div><dt>Glass coverage and signature</dt><dd class="num">${money(chosen.cover)}</dd></div>` : ""}
        <div><dt>Carrier fuel charge, ${(fuelOn().pct * 100).toFixed(1)}%, ${fuelOn().stale ? "the last rate we have, for" : "the rate posted for"} ${fuelOn().week}</dt><dd class="num">${money(chosen.fuel)}</dd></div></dl></details>` : ""}` : `<fieldset class="opts"><legend>${counter && state.dest ? `Getting it to ${esc(state.dest.full)} <button class="link" type="button" data-open-postal>Change</button>` : counter ? "Choose one" : "Or skip shipping"}</legend><label class="opt"><input type="radio" name="ship" value="pickup" ${pickup ? "checked" : ""}><span class="opt__name">Pick up at the Windsor counter<small>${SHOP_STREET}, Windsor. ${pickupReady()}</small></span><span class="num">Free</span></label>${mixed ? dropOpt(lines) : ""}</fieldset>`}
    </section>
    <div class="giftnote"><label class="field__label" for="note">Gift note <span class="fine">optional, written on a card in the box</span></label>
      <textarea class="field field--text field--area" id="note" data-note maxlength="240" rows="2" placeholder="Happy birthday, from all of us">${esc(state.note)}</textarea></div>
    <dl class="totals">
      <div><dt>Items</dt><dd class="num">${money(sub)}</dd></div>
      <div><dt>${pickup ? "Pickup" : local ? "Delivery" : counter ? "Pickup or delivery" : "Shipping"}</dt><dd class="num">${pickup ? "Free" : local ? (localFee !== null ? feeText(localFee) : "At checkout") : chosen ? money(chosen.total) : checking ? "Checking" : counter ? "Choose above" : "add postal code"}</dd></div>
      <div class="totals__door"><dt>${local && localFee === null ? "Total before delivery and tax" : "Total before tax"}</dt><dd class="num">${local ? money(sub + (localFee || 0)) : chosen ? money(sub + chosen.total) : money(sub)}</dd></div>
    </dl>
    ${!ready && !checking && !tooHeavy ? `<p class="fine" id="checkout-why">${counter ? (canLocal ? "Choose local delivery or pickup to check out." : mixed ? "Choose pickup, or leave the charcoal out to ship the rest, to check out." : "Choose pickup to check out.") : "Add a postal code or choose pickup to check out."}</p>` : ""}
    ${ready ? `<a class="btn btn--wide" href="/checkout">Check out</a>` : `<button class="btn btn--wide" type="button" disabled ${!checking && !tooHeavy ? 'aria-describedby="checkout-why"' : ""}>Check out</button>`}
    <p class="fine">Tax is added at checkout.</p>
  </section>`;
}

function viewShipping() {
  return `
  ${band("shipping", "cobalt", "Shipping", "From Windsor across Canada.")}
  <section class="reading">
    <p class="lead">We pack every order at the counter in Windsor and ship to every province and territory except Quebec, for now: the site is in English only, and we will ship there once it is also in French. Pickup in Windsor is open to everyone.</p>
    <h2 class="h3">Local delivery</h2>
    <p>We deliver from our Walkerville shop, priced by road distance: $10 up to 10 km and $15 up to 25 km, per order, plus tax. Orders with $200 or more in items before tax deliver free. Anything in the shop can come by local delivery. Enter your postal code and we show your exact price, or tell you if you are past our delivery area.</p>
    <p>While the shop is open, it arrives in about 25 minutes to 1 hour. After closing, it arrives the next morning. These are estimates, not set times. Local delivery is paid online when you order.</p>
    <h2 class="h3">What it costs</h2>
    <p>Shipping is worked out from the packed weight and box size of your order and the carrier\u2019s rate to your postal code. You see the cost on the product page and in the cart before you pay.</p>
    <p><button class="btn btn--ghost" type="button" data-open-postal>${state.dest ? "Estimating to " + esc(state.dest.full) + ". Change" : "Enter my postal code"}</button></p>
    <h2 class="h3">How glass is packed</h2>
    <p>Hookahs ship taken apart. The glass base is double boxed. If anything arrives broken, bring it into the store and talk to the store manager.</p>
    <h2 class="h3">What we ship</h2>
    <p>Hookahs, bases, bowls, hoses and parts. Charcoal goes by pickup or local delivery only: it is never sent by Canada Post.</p>
    <h2 class="h3">Pick up</h2>
    <p>Order online and pick up for free at ${SHOP_ADDRESS}. ${directions()} or call <a class="link" href="tel:+15192552222">519-255-2222</a>.</p>
    <h2 class="h3">Returns</h2>
    <p>All sales are final, except faulty, wrong, damaged or undelivered items. If something arrives broken or is not what you ordered, call 519-255-2222 or bring it into the store and talk to the store manager: we repair, replace or refund it. <a class="link" href="/terms">Terms of sale</a>.</p>
  </section>`;
}

// ---------- chrome, sheet, router ----------
function syncChrome() {
  $$("[data-cart-count]").forEach(e => e.textContent = cartCount());
  const h = route() || "#/";
  const [ra, rb] = h.replace(/^#\/?/, "").split("/"), asked = bySku[new URLSearchParams(location.search).get("colour")], base = ra === "p" ? bySku[rb] : null;
  const prod = base && base.family && asked && asked.family === base.family ? asked : base;   // the dock buys the colour shown
  const here = (on, exact = on) => on ? `aria-current="${exact ? "page" : "true"}"` : "";   // the page itself, or the section a product belongs to
  $("[data-nav]").innerHTML = `<a href="/shop" ${here(h === "#/shop")}>Everything</a>` + CATEGORIES.map(c => `<a href="/shop/${c.id}" ${here(h === "#/shop/" + c.id || prod?.cat === c.id, h === "#/shop/" + c.id)}>${c.name}</a>`).join("") + `<a href="/gifts/under-50" ${here(ra === "gifts")}>Gifts</a><a href="/set" ${here(h === "#/set")}>Build a set</a><a href="/search" ${here(h === "#/search")}>Search</a>`;
  const topCart = $(".top__cart"); if (h === "#/cart") topCart.setAttribute("aria-current", "page"); else topCart.removeAttribute("aria-current");
  const count = `<span data-cart-count>${cartCount()}</span>`, dock = $(".dock");
  dock.classList.toggle("dock--buy", !!prod);
  const lines = cartLines(), sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const sc = ra === "cart" && lines.length ? shipChoice(lines) : null, ship = sc && sc.chosen, canPay = !!sc && (sc.pickup || sc.local || !!ship);
  dock.classList.toggle("dock--buy", !!prod || ra === "set" || (ra === "cart" && lines.length > 0));
  dock.innerHTML = prod
    ? `<a class="dock__side" href="/shop/${prod.cat}" data-back>Back</a>${state.cart.some(l => l.sku === prod.sku)
        ? `<a class="dock__buy" href="/cart">In your cart. View cart</a>` : !forSale(prod) ? `<a class="dock__buy dock__buy--off" href="tel:+15192552222">Ask the counter</a>` : isSold(prod) ? `<a class="dock__buy dock__buy--off" href="/shop/${prod.cat}">Sold. See what is left</a>` : `<button class="dock__buy" type="button" data-add="${prod.sku}">Add to cart <span class="num">${whole(prod.price)}</span></button>`}<a class="dock__side" href="/cart" aria-label="Cart">${count}</a>`
    : ra === "set"
    ? `<a class="dock__side" href="/shop">Shop</a>${setPicks().some(Boolean) ? `<button class="dock__buy" type="button" data-add-set>Add the set <span class="num">${whole(setPicks().filter(Boolean).reduce((a, p) => a + p.price, 0))}</span></button>` : `<a class="dock__buy dock__buy--off" href="/shop">See what is in stock</a>`}<a class="dock__side" href="/cart" aria-label="Cart">${count}</a>`
    : ra === "cart" && lines.length
    ? `<a class="dock__side" href="/shop">Shop</a>${canPay ? `<a class="dock__buy" href="/checkout">Check out <span class="num">${money(sub + (ship ? ship.total : sc && sc.local ? sc.localFee || 0 : 0))}</span></a>` : sc && sc.counter ? `<button class="dock__buy dock__buy--ask" type="button" data-pickup-jump>Choose how you get it</button>` : sc && sc.checking ? `<span class="dock__buy dock__buy--off">Checking delivery</span>` : `<button class="dock__buy" type="button" data-open-postal>${state.dest ? "Change postal code" : "Add postal code for shipping"}</button>`}<span class="dock__side">${count}</span>`
    : `<a href="/" ${h === "#/" ? 'aria-current="page"' : ""}>Home</a><a href="/shop" ${here(h.startsWith("#/shop") || ra === "gifts", h === "#/shop")}>Shop</a><a href="/search" ${h === "#/search" ? 'aria-current="page"' : ""}>Search</a><a href="/cart" ${h === "#/cart" ? 'aria-current="page"' : ""}>Cart ${count}</a>`;
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
  const sw = e.target.closest("[data-swatch]"); if (sw) { e.preventDefault(); pickColour(sw, false); }
  const q = e.target.closest("[data-qty]"); if (q) setQty(q.dataset.qty, +q.dataset.n);
  const pk = e.target.closest("[data-set]");
  if (pk) { const off = OPTIONAL.has(pk.dataset.set) && state.set[pk.dataset.set] === pk.dataset.sku;   // tapping the chosen charcoal again takes it back out
    if (off) delete state.set[pk.dataset.set]; else state.set[pk.dataset.set] = pk.dataset.sku; $$(`[data-set="${pk.dataset.set}"]`).forEach(b => b.setAttribute("aria-pressed", !off && b === pk)); $("[data-set-summary]").innerHTML = setSummary(); syncChrome(); }
  if (e.target.closest("[data-add-set]")) { setPicks().filter(Boolean).forEach(p => addToCart(p.sku)); navigate("/cart"); }
  if (e.target.closest("[data-pickup-jump]")) { const s = $("[data-pickup-choice]"); if (s) { s.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); s.focus({ preventScroll: true }); } }
  if (e.target.closest("[data-undo-drop]") && state.dropped) {   // put the charcoal back: the choice is asked again
    const fit = fitCart(cleanCart([...state.cart, ...state.dropped])); state.cart = fit.kept; state.dropped = null; state.cartNews = fit.news;
    state.ship = null; store.set("ship", null); saveCart(); render(); const s = $("[data-pickup-choice]"); if (s) s.focus({ preventScroll: true });
  }
});
// A colour swaps the photo where it was chosen (the product page or its card). The new picture is decoded before it shows,
// so there is no blank frame, and it lands in the same box, so nothing moves.
function paintColour(tile, v, alt) {
  const old = tile.querySelector(":scope > .shot"); if (!old) return;
  const frag = document.createElement("template"); frag.innerHTML = colourShot(v, { eager: true, small: !tile.matches("[data-stage]"), alt });
  const img = frag.content.querySelector(".shot"), tag = frag.content.querySelector(".shot__tag");
  tile.querySelectorAll(":scope > .shot__tag").forEach(t => t.remove());
  const done = () => { if (!old.isConnected) return; img.classList.add("shot--in"); old.after(img); if (tag) img.after(tag);
    requestAnimationFrame(() => { img.classList.add("is-on"); const end = () => { old.remove(); img.classList.remove("shot--in", "is-on"); }; if (matchMedia("(prefers-reduced-motion: reduce)").matches) end(); else setTimeout(end, 280); }); };
  (img.decode ? img.decode() : Promise.resolve()).then(done, done);
}
function pickColour(btn, focus) {
  const v = bySku[btn.dataset.swatch]; if (!v) return;
  const group = btn.closest("[role=radiogroup]");
  $$("[role=radio]", group).forEach(b => { const on = b === btn; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
  if (focus) btn.focus();
  const card = btn.dataset.card && btn.closest("[data-family]");
  if (card) {   // the card's photo and its link follow the colour
    paintColour($(".tile", card), v, ""); const a = $(".card__a", card); a.href = `/p/${btn.dataset.card}?colour=${v.sku}`; a.dataset.piece = btn.dataset.card;
    return;
  }
  const stage = $("[data-stage]"); if (!stage) return;
  const was = bySku[stage.dataset.stage], u = new URL(location.href); u.searchParams.set("colour", v.sku); history.replaceState(history.state, "", u.pathname + u.search);
  // a colour that is on sale, or the one it replaces, rebuilds the buy area and the dock, so the button always adds the colour shown
  if (forSale(v) || forSale(was)) { render(); const b = $(`[data-swatch="${v.sku}"]`); if (b && focus) b.focus(); return; }
  stage.dataset.stage = v.sku;
  paintColour(stage, v, v.colour ? `${v.name}, ${v.colour}` : v.name);
  const name = $("[data-colour-name]"); if (name) { name.textContent = v.colour || ""; name.hidden = !v.colour; name.nextElementSibling.textContent = `${familyOf(v).indexOf(v) + 1} of ${familyOf(v).length}`; }
  // the address and the share link name the colour (set above); the page itself is the same piece, so history gets no new entry
}
// Arrow keys move through the colours like any radio group; Home and End jump to the ends.
document.addEventListener("keydown", e => {
  const btn = e.target.closest?.("[role=radio][data-swatch]"); if (!btn) return;
  const all = $$("[role=radio]", btn.closest("[role=radiogroup]")), i = all.indexOf(btn);
  const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
  if (to === undefined) return; e.preventDefault(); pickColour(all[(to + all.length) % all.length], true);
});
// each colour's photo is fetched quietly once the product page is up, so a tap shows it at once
function preloadColours() {
  const stage = $("[data-stage]"), v = stage && bySku[stage.dataset.stage]; if (!v || !v.family) return;
  const go = () => familyOf(v).filter(ownPhoto).forEach(x => { const im = new Image(); im.decoding = "async"; im.src = `img/pc/${x.img}-m.webp${V}`; });
  // fetched the moment a hand or a key reaches the chips, or a few seconds after the page has settled, so the colours
  // never compete with the page's own first pictures and its smoke
  let done = false; const once = () => { if (done) return; done = true; go(); };
  const g = $(".pdp [role=radiogroup]"); if (g) ["pointerenter", "touchstart", "focusin"].forEach(t => g.addEventListener(t, once, { once: true, passive: true }));
  setTimeout(() => { if (window.requestIdleCallback) requestIdleCallback(once, { timeout: 2000 }); else once(); }, 3500);
}
document.addEventListener("input", e => {
  if (e.target.id === "q") { state.q = e.target.value; setQuery(state.q.trim()); $("[data-search-out]").innerHTML = searchResults(); }
  if (e.target.matches("[data-note]")) { state.note = e.target.value; store.set("note", state.note); }
});
document.addEventListener("change", e => {
  if (e.target.name === "ship" && e.target.value === "drop") return dropCounter();
  if (e.target.name === "ship") { state.ship = e.target.value; store.set("ship", state.ship); render(); }
});
// The mixed cart's other way: the charcoal comes out, the rest can be sent. Undo puts it back.
function dropCounter() {
  const gone = state.cart.filter(l => localOnly(bySku[l.sku]));
  state.cart = state.cart.filter(l => !localOnly(bySku[l.sku])); state.dropped = gone;
  state.cartNews = [`We took ${gone.length === 1 ? bySku[gone[0].sku].name : gone.length + " charcoal items"} out of your cart. The rest can now be shipped.`];
  if (state.ship === "pickup") { state.ship = null; store.set("ship", null); }
  saveCart(); render(); const s = $("[data-cart-news]"); if (s) { s.setAttribute("tabindex", "-1"); s.focus({ preventScroll: true }); }
}
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
  else if (d.full !== state.dest?.full && localArea(d)) {   // "nationwide" and a carrier were chosen for the old address: a Windsor shopper must see local delivery first
    if (state.reach === "nationwide") { state.reach = null; store.set("reach", null); }
    if (state.ship && state.ship !== "pickup") { state.ship = null; store.set("ship", null); }
  }
  state.dest = d; store.set("postal", d.full); sheet.close(); render();
  if (chose) $("#main").focus({ preventScroll: true });
});
postalInput.addEventListener("input", () => { postalErr.hidden = true; postalInput.removeAttribute("aria-invalid"); });

document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches(".why")) state.whyOpen = e.target.open; }, true);
function focusKey(el) {
  if (!el || el === document.body) return null;
  for (const k of ["data-qty", "data-add"]) if (el.hasAttribute(k)) return `[${k}="${el.getAttribute(k)}"]` + (el.dataset.n ? `[aria-label="${el.getAttribute("aria-label")}"]` : "");
  if (el.name === "ship" || el.name === "pay") return `input[name="${el.name}"][value="${el.value}"]`;
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
// What this exact order is: the same lines, way of sending and destination always give the same words.
const orderSig = (lines, sc) => JSON.stringify([lines.map(l => [l.product.sku, l.qty]).sort(), sc.pickup ? "pickup" : "ship", sc.pickup ? "" : sc.local ? "local" : sc.chosen?.id || "", sc.pickup ? "" : state.dest?.full || "", rewardFlag()]);
// The figures the shopper is shown, in cents, by the server's own sum. If the server has re-priced this exact order, its figures win.
function shownTotals(lines, sc) {
  const fee = sc.local ? deliveryFeeNow() : null, prov = sc.pickup || sc.local ? "ON" : state.dest.prov, p = state.priced?.sig === orderSig(lines, sc) ? state.priced : null;
  const sub = cartCents(lines), reward = p ? p.reward_cents || 0 : rewardCents(sub);   // a points reward comes off the items before tax, as the server does it
  return { fee, prov, reward, ...(p ? { subtotal: p.subtotal_cents, shipping: p.shipping_cents, tax: p.tax_cents, total: p.total_cents } : { ...orderTotals(sub - reward, sc.pickup ? 0 : sc.local ? toCents(fee || 0) : toCents(sc.chosen.total), prov), subtotal: sub }) };
}
function coTotals(lines, sc) {
  const { pickup, local } = sc, t = shownTotals(lines, sc), units = lines.reduce((a, l) => a + l.qty, 0);
  return `<dl class="totals" data-total="${t.total}">
        <div><dt>${units} ${units === 1 ? "item" : "items"}</dt><dd class="num">${money(t.subtotal / 100)}</dd></div>
        ${rewardRow(t.reward)}<div><dt>${pickup ? "Pickup" : local ? "Delivery" : "Shipping"}</dt><dd class="num">${pickup ? "Free" : local ? (t.fee === null ? "Enter your address" : feeText(t.shipping / 100)) : money(t.shipping / 100)}</dd></div>
        <div><dt>${taxLabel(t.prov)}</dt><dd class="num">${money(t.tax / 100)}</dd></div>
        <div class="totals__door"><dt>${local && t.fee === null ? "Total before delivery" : "Total"}</dt><dd class="num">${money(t.total / 100)}</dd></div>
      </dl>`;
}
// One key per order attempt. A retry after a lost answer sends the same key, so the shop can never make the order twice.
function orderKey(sig) {
  let k = state.orderKey; if (!k) try { k = JSON.parse(sessionStorage.getItem("oss:order-key")); } catch {}
  if (k?.sig === sig && typeof k.key === "string") return state.orderKey = k, k.key;
  const key = crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
  state.orderKey = { sig, key }; try { sessionStorage.setItem("oss:order-key", JSON.stringify(state.orderKey)); } catch {}
  return key;
}
function orderKeyDone() { state.orderKey = null; try { sessionStorage.removeItem("oss:order-key"); } catch {} }
// ---------- paying ----------
// Card goes to Stripe's own page (the card number never touches this site). Pickup can also pay at the counter.
// The server says whether card payment is switched on, in a meta tag it writes on every page.
const CARD_ON = document.querySelector('meta[name="oss-pay"]')?.content === "card";
// Shisha is paid at the counter until the card company approves it in writing (src/checkout.js, docs/PAYMENTS.md):
// a cart holding it is picked up and paid at the counter, and the page says so before the shopper taps anything.
const SHISHA_CARD = document.querySelector('meta[name="oss-shisha-card"]')?.content === "1";
const counterPay = p => !!p && p.cat === "shisha" && !SHISHA_CARD;
const counterPayIn = lines => lines.filter(l => counterPay(l.product));
const payWay = sc => !sc.pickup ? "card" : !CARD_ON || counterPayIn(cartLines()).length ? "at_pickup" : state.pay === "at_pickup" ? "at_pickup" : "card";
const payLabel = (sc, total) => sc.local && deliveryFeeNow() === null ? "Check delivery price" : payWay(sc) === "card" ? `Pay ${money(total / 100)}` : "Place order";
function payBlock(sc, total) {
  const shisha = counterPayIn(cartLines());
  if (shisha.length) return `<fieldset class="co__set co__pay"><legend class="h3">Payment</legend><p class="co__p">${sc.pickup ? "At the counter when you pick it up. Shisha is paid in the shop." : `Shisha is paid at the counter when you pick it up, so this order needs pickup. <a class="link" href="/cart">Choose pickup</a>, or take ${shisha.length === 1 ? esc(shisha[0].product.name) : "the shisha"} out to have the rest delivered.`}</p></fieldset>`;
  if (!sc.pickup) return `<fieldset class="co__set co__pay"><legend class="h3">Payment</legend><p class="co__p">${CARD_ON ? "By card on the next page. Apple Pay and Google Pay work there too." : "Card payment is not switched on yet. Choose pickup to pay at the counter, or call 519-255-2222."}</p></fieldset>`;
  if (!CARD_ON) return `<fieldset class="co__set co__pay"><legend class="h3">Payment</legend><p class="co__p">At the counter when you pick it up.</p></fieldset>`;
  const way = payWay(sc), opt = (v, name, small, right) => `<label class="opt"><input type="radio" name="pay" value="${v}" ${way === v ? "checked" : ""}><span class="opt__name">${name}<small>${small}</small></span><span class="num">${right}</span></label>`;
  return `<fieldset class="co__set co__pay"><legend class="h3">Payment</legend><div class="opts">
    ${opt("card", "Pay now by card", "Card, Apple Pay or Google Pay", "Now")}
    ${opt("at_pickup", "Pay at the counter", "When you pick it up", "At pickup")}</div></fieldset>`;
}
// What the order page knows about the payment, kept with the order on this device only.
const paidKey = id => "oss:order:" + id;
function savePaid(o) { try { sessionStorage.setItem(paidKey(o.id), JSON.stringify(o)); } catch {} }
function clearCartAfterOrder() { orderKeyDone(); state.priced = null; state.cart = []; saveCart(); state.delivery = null; state.refused = null; state.form = {}; state.note = ""; store.set("note", ""); state.pay = null; try { sessionStorage.removeItem("oss:co-form"); } catch {} }
// After Stripe sends the shopper back: ask the shop until the signed webhook has landed (usually a second or two).
async function watchPayment(o) {
  if (state.watching === o.id) return; state.watching = o.id;
  for (let i = 0; i < 20 && o.pay?.status === "awaiting"; i++) {
    try { const r = await fetch("/api/pay/status?session=" + encodeURIComponent(o.pay.session)); if (r.ok) { const d = await r.json(); if (d.pay && d.pay !== "awaiting") o.pay.status = d.pay; } } catch {}
    if (o.pay.status !== "awaiting") break;
    await new Promise(w => setTimeout(w, i < 5 ? 1500 : 3000));
  }
  if (o.pay.status === "awaiting") o.pay.slow = true;
  if (o.pay.status === "paid") { for (const i of o.items) if (bySku[i.sku]) bySku[i.sku].stock = Math.max(0, bySku[i.sku].stock - i.qty); clearCartAfterOrder(); }
  savePaid(o); state.watching = null;
  // the words change in place: the page is not redrawn, so nothing on it jumps or plays its entrance again
  const [a, b] = route().replace(/^#\/?/, "").split("/").filter(Boolean), m = $("#main");
  if (a === "order" && b === o.id) { const w = payWords(o), h = m.querySelector("[data-pay-head]"), l = m.querySelector("[data-pay-state]"), d = m.querySelector("[data-pay-door]"); if (h && l && d) { h.textContent = w.head; l.innerHTML = w.lead; l.dataset.payState = o.pay.status; d.textContent = w.door; } else render(); }
}
function viewCheckout() {
  const lines = cartLines();
  if (!lines.length) return viewCart();
  const sc = shipChoice(lines), { pickup, local, chosen } = sc;
  if (!state.ship && !chosen && (sc.status === "far" || sc.status === "down")) return `${band("checkout", "emerald", "One step back.")}<section class="empty"><p class="lead">${sc.status === "far" ? `${esc(state.dest.full)} is past our 25 km delivery area.` : "We cannot check delivery right now."} You can still <a class="link" href="/cart">${carried(lines) ? "ship it or pick it up free" : "pick it up free"}</a>.</p></section>`;
  if (sc.checking && !pickup && !chosen && !local) return `${band("checkout", "emerald", "Checkout")}<section class="empty"><p class="lead" role="status">Checking delivery to ${esc(state.dest.full)}.</p></section>`;
  if (!pickup && !local && !chosen) return `${band("checkout", "emerald", "One step back.")}<section class="empty"><p class="lead">Choose shipping or pickup in <a class="link" href="/cart">your cart</a> first.</p></section>`;
  if (!state.form?.name) try { const kept = JSON.parse(sessionStorage.getItem("oss:co-form")); if (kept) state.form = { ...kept, ...(state.form || {}) }; } catch {}
  const f = state.form || {}, quoted = local && deliveryFeeNow() !== null;
  const back = new URLSearchParams(location.search).get("unpaid"), unpaid = back && /^W[A-Z0-9]{6}$/.test(back) ? `<p class="co__back" role="status"><b>Payment not finished.</b> Nothing was charged. Your items are held for 30 minutes.</p>` : "";
  const field = (id, label, attrs, hint = "") => `<label class="field__label" for="co-${id}">${label}${hint ? ` <span class="fine">${hint}</span>` : ""}</label><input class="field" id="co-${id}" name="${id}" value="${esc(f[id] || "")}" ${attrs}>`;
  return `
  ${band("checkout", "emerald", "Checkout", `<a href="/cart">Back to the cart</a>`)}
  <section class="cart checkout">
    <form class="co" data-checkout novalidate>
      ${unpaid}
      <fieldset class="co__set"><legend class="h3">Who it is for</legend>
        ${field("name", "Full name", 'autocomplete="name" maxlength="80" required')}
        ${field("email", "Email", 'type="email" autocomplete="email" inputmode="email" maxlength="120" required', local ? "for the receipt" : pickup ? "for the receipt and the ready-for-pickup note" : "for the receipt and tracking")}
        ${field("phone", "Phone", `type="tel" autocomplete="tel" inputmode="tel" maxlength="30"${local ? " required" : ""}`, local ? "so the driver can reach you" : "optional")}
      </fieldset>
      ${pickup ? `<fieldset class="co__set"><legend class="h3">Pickup</legend><p class="co__p">At ${SHOP_ADDRESS}. We email you when it is ready, usually ${pickupDay() === "Today" ? "the same day" : "tomorrow"}. Bring the order number. ${directions()}</p></fieldset>`
        : `<fieldset class="co__set"><legend class="h3">Where it is going</legend>
        ${field("line1", "Street address", 'autocomplete="address-line1" maxlength="120" required')}
        ${field("city", "City or town", 'autocomplete="address-level2" maxlength="60" required')}
        ${state.dest.complete ? `<p class="co__p">Postal code <b class="num">${esc(state.dest.full)}</b>, ${esc(state.dest.prov)}. <button class="link" type="button" data-open-postal>Change</button></p>`
          : `<p class="co__p">We need the full postal code for the label. <button class="link" type="button" data-open-postal>Enter it</button></p>`}
        ${local ? `<p class="co__p">Local delivery from our Windsor shop. ${localEta()}. <a class="link" href="/cart">Change</a></p><p class="co__p">${freeNote(cartCents(lines))}</p><div class="co__p" role="status" data-deliv-msg>${quoted ? `Good news, we deliver to ${esc(state.dest.full)}.` : ""}</div><p class="fine">Address check by <a class="link" href="https://www.geoapify.com/" rel="noopener">Geoapify</a>. Map data from OpenStreetMap contributors.</p>`
          : `<p class="co__p">${chosen.carrier} ${chosen.service}, ${days(chosen.days)}. <a class="link" href="/cart">Change</a></p>`}</fieldset>`}
      ${sc.counter ? `<p class="co__p co__coal"><b class="line__pick">Pickup or local delivery only</b> ${lines.filter(l => localOnly(l.product)).map(l => esc(l.product.name)).join(", ")}</p>` : ""}
      ${payBlock(sc, shownTotals(lines, sc).total)}
      ${coTotals(lines, sc)}
      <p class="field__err" role="alert" data-co-err hidden></p>
      <button class="btn btn--wide" type="submit" ${(!pickup && !state.dest.complete) || (!pickup && !CARD_ON) || (!pickup && counterPayIn(lines).length) ? "disabled" : ""}>${payLabel(sc, shownTotals(lines, sc).total)}</button>
      ${CARD_ON ? `<p class="fine" data-pay-fine ${payWay(sc) === "card" ? "" : "hidden"}>Payment is taken by Stripe. We never see your card number.</p>` : ""}
    </form>
  </section>`;
}
// the heading and one line say where the money stands; nothing says paid until the shop has Stripe's signed word
function payWords(o) {
  const p = o.pay || {}, first = esc(o.name.split(" ")[0]), closed = p.status === "expired" || p.status === "failed";
  return {
    head: closed ? "This payment did not go through." : p.method === "card" && p.status !== "paid" ? `One moment, ${first}.` : `Thank you, ${first}.`,
    lead: closed ? `Nothing was charged. <a class="link" href="/cart">Your cart</a> is still here.`
      : p.method === "at_pickup" ? `Pay at the counter when you pick it up. We email ${esc(o.email)} when it is ready.`
      : p.status === "paid" ? `Paid. Your receipt is on its way to ${esc(o.email)}. ${o.method === "pickup" ? "We email you again when it is ready." : o.service === "Local delivery" ? "Our driver calls before coming." : "The tracking number follows when it ships."}`
      : p.slow ? `Your payment is still being confirmed. The receipt comes to ${esc(o.email)} as soon as it is.`
      : "Confirming your payment. This page updates by itself.",
    door: p.status === "paid" ? "Paid" : p.method === "at_pickup" ? "To pay at pickup" : "Total",
  };
}
function viewOrder(id) {
  let o = null; try { o = JSON.parse(sessionStorage.getItem("oss:order:" + id)); } catch { o = null; }
  if (!o) return `${band("missing", "ruby", "We cannot show that order.")}<section class="empty"><p class="lead">Order details only open on the phone or computer that placed the order. To ask about one, call the counter at <a class="link" href="tel:+15192552222">519-255-2222</a>.</p><p class="lead"><a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
  const c = n => money(n / 100), p = o.pay || {}, first = esc(o.name.split(" ")[0]);
  if (p.method === "card" && p.status === "awaiting" && p.session && !p.slow) watchPayment(o);
  const { head, lead, door } = payWords(o);
  return `
  <section class="cart done">
    <p class="done__tag"><span>Order</span> <b class="num">${esc(o.id)}</b></p>
    <h1 class="h2 h2--xl" data-pay-head>${head}</h1>
    <p class="lead" role="status" aria-live="polite" data-pay-state="${esc(p.status || "")}">${lead}</p>
    <p class="fine">${o.method === "pickup" ? `Pickup at ${SHOP_ADDRESS}. ${directions()}` : o.service === "Local delivery" ? `Local delivery.${o.eta ? " " + esc(o.eta) + "." : ""}` : `${esc(o.service)}.`}</p>
    <ul class="done__lines">${o.items.map(i => `<li><span><b class="num">${i.qty}</b> &times; ${esc(i.name)}</span><span class="num">${c(i.unit_cents * i.qty)}</span></li>`).join("")}</ul>
    <dl class="totals">
      <div><dt>Items</dt><dd class="num">${c(o.subtotal_cents)}</dd></div>
      <div><dt>${o.method === "pickup" ? "Pickup" : o.service === "Local delivery" ? "Delivery" : "Shipping"}</dt><dd class="num">${o.method === "pickup" || (o.service === "Local delivery" && !o.shipping_cents) ? "Free" : c(o.shipping_cents)}</dd></div>
      <div><dt>${esc(o.tax_label)}</dt><dd class="num">${c(o.tax_cents)}</dd></div>
      <div class="totals__door"><dt data-pay-door>${door}</dt><dd class="num">${c(o.total_cents)}</dd></div>
    </dl>
    ${o.address ? `<p class="fine">Going to ${esc(o.address.line1)}, ${esc(o.address.city)}, ${esc(o.address.province)} ${esc(o.address.postal)}.</p>` : ""}
    <a class="btn btn--wide" href="/shop">Keep looking</a>
  </section>`;
}
document.addEventListener("change", e => {   // the choice changes the button and the small print in place; the form is never rebuilt
  const f = e.target.name === "pay" && e.target.closest("[data-checkout]"); if (!f) return;
  state.pay = e.target.value; const lines = cartLines(), sc = shipChoice(lines);
  f.querySelector('button[type="submit"]').textContent = payLabel(sc, shownTotals(lines, sc).total); f.querySelector("[data-pay-fine]").hidden = payWay(sc) !== "card";
});
document.addEventListener("input", e => { const f = e.target.closest("[data-checkout]"); if (f && e.target.name) { state.form = state.form || {}; state.form[e.target.name] = e.target.value; if ((e.target.name === "line1" || e.target.name === "city") && f.querySelector("[data-deliv-msg]")) refreshDelivery(f); } });
function refreshDelivery(f, msg) {
  const lines = cartLines(), sc = shipChoice(lines), quoted = deliveryFeeNow() !== null, box = f.querySelector("[data-deliv-msg]"), btn = f.querySelector('button[type="submit"]');
  f.querySelector(".totals").outerHTML = coTotals(lines, sc);
  if (box) box.innerHTML = msg !== undefined ? msg : quoted ? `Good news, we deliver to ${esc(state.dest.full)}.` : "";
  btn.textContent = payLabel(sc, shownTotals(lines, sc).total);
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
  if (sc.counter && chosen) return fail("Charcoal goes by pickup or local delivery only. Choose one in your cart.");
  if (!pickup && !v("line1")) return fail("Enter the street address.", "line1");
  if (!pickup && !v("city")) return fail("Enter the city or town.", "city");
  if (local) {
    if (v("phone").replace(/\D/g, "").length < 10) return fail("Enter a phone number so the driver can reach you.", "phone");
    state.form = { ...(state.form || {}), line1: v("line1"), city: v("city") }; err.hidden = true;
    if (deliveryFeeNow() === null) return checkDelivery(f, btn);   // show the price first: the next tap places the order
  }
  const pay = payWay(sc), label = payLabel(sc, +f.querySelector(".totals").dataset.total);
  btn.disabled = true; btn.textContent = pay === "card" ? "Opening secure payment" : "Placing your order"; err.hidden = true;
  const sent = cartLines(), sig = orderSig(sent, sc), shownTotal = +f.querySelector(".totals").dataset.total;   // the figure on the screen, not a fresh sum: if the rate moved since, the server says so
  try {
    const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_key: orderKey(sig + pay + v("email").toLowerCase()), expected_total_cents: shownTotal, use_reward: rewardCents(cartCents(sent)) > 0, lines: state.cart, method: pickup ? "pickup" : "ship", service: local ? "local" : chosen && chosen.id, delivery_fee_cents: local ? Math.round(deliveryFeeNow() * 100) : undefined, postal: state.dest && state.dest.full,
      name: v("name"), email: v("email"), phone: v("phone"), note: state.note, address: { line1: v("line1"), city: v("city") }, pay, source: visitSource() }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { btn.disabled = false; btn.textContent = label; if (local && data.delivery) { if (data.delivery === "far") state.farFor = state.dest.full; state.delivery = data.delivery === "ok" ? { key: deliveryKey(), fee_cents: data.base_fee_cents ?? data.fee_cents, due: data.fee_cents, sub: cartCents() } : null; state.refused = data.delivery === "ok" ? null : deliveryKey(); refreshDelivery(f, data.delivery === "ok" ? undefined : deliveryMsg(data.delivery)); if (data.delivery !== "ok") return; } 
      if (data.local_only) { state.cartNews = [data.error]; state.ship = null; store.set("ship", null); navigate("/cart"); return; }   // an out-of-date page offered a carrier: back to the cart, where the real choices are
      if (data.reward_gone) { rewardGone(); state.priced = null; f.querySelector(".totals").outerHTML = coTotals(sent, sc); btn.textContent = payLabel(sc, +f.querySelector(".totals").dataset.total); return fail(data.error); }   // the points were spent elsewhere: the full price is shown before anything is placed
      if (data.repriced) { state.priced = { sig, ...data.repriced }; f.querySelector(".totals").outerHTML = coTotals(sent, sc); btn.textContent = payLabel(sc, data.repriced.total_cents); }
      if (typeof data.stock === "number" && bySku[data.sku]) {   // the shelf changed: the cart is put right and says what happened
        bySku[data.sku].stock = data.stock; const fit = fitCart(state.cart); state.cart = fit.kept; state.cartNews = fit.news.length ? fit.news : [data.error]; state.priced = null; saveCart(); navigate("/cart"); return;
      }
      return fail(data.error || "That did not go through. Please try again.", data.field); }
    const o = { ...data.order, pay: data.pay || {} }; savePaid(o);
    if (o.pay.status === "awaiting" && o.pay.url) {   // keep what they typed: if they come back from Stripe unpaid, the form is filled and the same order resumes
      try { sessionStorage.setItem("oss:co-form", JSON.stringify({ ...(state.form || {}), name: v("name"), email: v("email"), phone: v("phone"), line1: v("line1"), city: v("city") })); } catch {}
      location.assign(o.pay.url); return; }   // to Stripe; the cart stays until the payment is confirmed
    if (o.pay.status === "paid") { clearCartAfterOrder(); navigate("/order/" + o.id, true); return; }   // a retry of an order already paid
    if (!data.replayed) for (const i of o.items) if (bySku[i.sku]) bySku[i.sku].stock = Math.max(0, bySku[i.sku].stock - i.qty);
    clearCartAfterOrder();
    navigate("/order/" + o.id, true);
  } catch { btn.disabled = false; btn.textContent = label; fail("We could not reach the shop. Check your connection and try again."); }
});
// ---------- the small print ----------
const DRAFT = `<p class="done__tag"><span>Draft</span> <b>for the shop to review</b></p>`;
const doc = (title, lead, parts) => `${band("docs", "bone", title, lead)}<section class="cart doc">${DRAFT}${parts.map(([h, body]) => `<h2 class="h3">${h}</h2>${body.map(t => `<p>${t}</p>`).join("")}`).join("")}</section>`;
const viewPrivacy = () => doc("Privacy", "What we collect when you order, why, and how to ask about it.", [
  ["What we collect", ["Your name, email, phone number if you give it, and delivery address, so we can send your order and answer questions about it.", "Your card details go straight to the payment company. We never see or store the card number."]],
  ["How you found us", ["When you place an order, we save with it where your first visit in the last 30 days came from: a short code from our business card or a link we posted, the name of the site that sent you (like Google or Instagram), and the first page you opened. It stays on your device until you order. We use it only to count which of our cards, posts and listings bring orders. It is not used to follow you around the web, and we never share it."]],
  ["What we do not do", ["We do not sell or rent your details. We do not use advertising trackers. Visit counts on this site use no cookies and do not identify you."]],
  ["Who else sees it", ["The carrier or our driver gets your name, phone number and address to deliver the order. For local delivery, your address goes to our map service, Geoapify, to work out the distance. Card payments are taken by Stripe, which gets what it needs to take the payment. Our hosting company, Cloudflare, stores the shop's records on our behalf, and our email service sends the order emails.", "Some of these companies work outside Canada, mostly in the United States, so your details may be stored or handled there and can be reached by the courts and authorities of that country. Each of them may use your details only to do this work for us."]],
  ["If you make an account", ["You sign in with a code we email you. We keep your email, the details you choose to save, your saved items, back-in-stock requests, your charcoal reminder choice and any points, so they are there next time. A cookie keeps you signed in for up to 30 days. You can delete the account yourself from the account page at any time."]],
  ["Emails we send", ["Emails about your order: that it was placed, that it is ready or on its way. A back-in-stock email only when you ask for one, and a charcoal reminder only when you turn it on. Each reminder and alert has an unsubscribe link, and we act on it at once (the law allows up to 10 business days). We do not send newsletters."]],
  ["How long we keep it", ["Order records are kept for six years, because tax law requires it. After that they are deleted."]],
  ["Keeping it safe", ["The shop's records are behind a sign-in with named staff, and every change is logged with who made it. If something ever went wrong with your details that could put you at real risk, we would tell you and the Privacy Commissioner of Canada as soon as we could."]],
  ["Your choices", ["You can ask to see what we hold about you, to correct it, or to have it deleted where the law allows. Email or call the counter and we will answer within 30 days."]],
  ["Who to ask", ["The person responsible for privacy at the shop is the manager. Call 519-255-2222 or ask at 760 Wyandotte St E. If you are not happy with the answer, you can contact the Privacy Commissioner of Canada."]],
]);
const viewTerms = () => doc("Terms of sale", "The plain rules for buying from us online.", [
  ["Who you are buying from", [`One Stop Shop, 760 Wyandotte St E, Windsor, ON N9A 3J4. Call 519-255-2222. Legal business name ${TBD("")}.`]],
  ["Prices and tax", ["Prices are in Canadian dollars. Tax is added at checkout, based on the province the order ships to. Before you pay, checkout shows each item's price, delivery or shipping, tax and the total, and you can go back and change anything. We email you a copy of your order."]],
  ["Shipping", ["We ship within Canada, except to Quebec for now: the site is in English only, and we will ship there once it is also in French. Anyone can pick up in Windsor. The price at checkout is the price you pay for shipping. Delivery times are the carrier's estimates. Cologne ships by ground only."]],
  ["Local delivery", ["We deliver within 25 km by road of our Windsor shop: $10 up to 10 km and $15 from there to 25 km, per order, plus tax. Orders with $200 or more in items before tax deliver free. Arrival times are estimates. Local delivery is paid online when you order."]],
  ["Pickup", ["Pickup at 760 Wyandotte St E, Windsor, ON N9A 3J4 is free. We email you when the order is ready and hold it for 14 days."]],
  ["Charcoal", ["Charcoal is sold for pickup or local delivery only. It is not shipped by Canada Post or any other carrier."]],
  ["Returns", ["All sales are final, except faulty, wrong, damaged or undelivered items. We do not take back an item because you changed your mind."]],
  ["Faulty, wrong or damaged", ["If an item is faulty, is not what you ordered, or arrives broken, call 519-255-2222 or bring it to 760 Wyandotte St E and talk to the store manager. We will repair it, replace it or refund it. Nothing here takes away your rights under Ontario's Consumer Protection Act."]],
  ["If it does not arrive", ["If we do not deliver within 30 days of the delivery date we gave you (or of your order, if we gave none), you can cancel for a full refund. We refund within 15 days of your cancelling, to the way you paid."]],
]);
const viewMissing = () => `${band("missing", "ruby", "Nothing at this address.")}<section class="empty"><p class="lead">The link may be old. <a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
const SITE = "One Stop Shop", HOME_TITLE = document.title, PLAIN = { account: "Your account", cart: "Cart", shipping: "Shipping and returns", set: "Build a set", search: "Search", privacy: "Privacy", terms: "Terms of sale", checkout: "Checkout" };
// The same addresses the server answers. Anything else is the missing page, never a page that merely looks right.
function realPage(a, b, more) {
  if (more) return false; if (!a) return true;
  if (a === "shop") return !b || !!catById[b]; if (a === "p") return !!b; if (a === "gifts") return !b || b === "under-50" || b === "under-150";
  if (a === "order") return !!b && /^W[A-Z0-9]{6}$/.test(b);
  return !b && Object.hasOwn(PLAIN, a);
}
function pageTitle(a, b, real) {
  if (!real || (a === "p" && !bySku[b])) return `Page not found | ${SITE}`; if (!a) return HOME_TITLE;
  const name = a === "shop" ? (b ? catById[b].name : "Shop") : a === "p" ? bySku[b].name : a === "gifts" ? "Gifts" : a === "order" ? `Order ${b}` : PLAIN[a];
  return `${name} | ${SITE}`;
}
function render({ chunk = false } = {}) {
  const keep = focusKey(document.activeElement);
  const [a, b, more] = route().replace(/^#\/?/, "").split("/").filter(Boolean), real = realPage(a, b, more);
  if (a === "search") state.q = new URLSearchParams(location.search).get("q") ?? state.q;
  document.title = pageTitle(a, b, real);
  // a long section reached by a tap: the page now, its cards in the tasks after. Short sections draw whole, as before (the Misc
  // act stamps the labels already on its first screen at the swap, so its cards must be there).
  queue = chunk && real && a === "shop" && (b ? SHELF.filter(p => p.cat === b).length : SHELF.length) > 24 ? { q: [], first: firstScreen() } : null;   // the window's size read before the page changes, so reading it forces no layout
  let html, q; try { html = !real ? viewMissing() : a === "shop" ? viewShop(b) : a === "p" ? viewProduct(b) : a === "cart" ? viewCart() : a === "shipping" ? viewShipping() : a === "gifts" ? viewGifts(b) : a === "set" ? viewSet() : a === "search" ? viewSearch() : a === "privacy" ? viewPrivacy() : a === "terms" ? viewTerms() : a === "checkout" ? viewCheckout() : a === "order" ? viewOrder(b) : a === "account" ? accountView(band) : !a ? viewHome() : viewMissing(); } finally { q = queue; queue = null; }
  $("#main").innerHTML = html; laterStart(q);
  document.body.dataset.route = a || "home";
  syncChrome();
  const chip = $(".chips [aria-current]"); if (chip) chip.parentNode.scrollLeft = chip.offsetLeft - (chip.parentNode.clientWidth - chip.offsetWidth) / 2;   // the section you are in sits centred in the row
  if (keep) { const el = document.querySelector(keep); if (el) el.focus({ preventScroll: true }); }
  priceLocal();
  preloadColours();
  find.afterRender();
  if (real) afterRender(a, b);   // the account pieces: Save on a product, prefill and points at checkout
}
let last = route();
document.addEventListener("click", e => {
  const a = e.target.closest("[data-piece]"); if (!a) return;
  $$(".tile").forEach(n => n.style.viewTransitionName = "");
  const n = $(".tile", a) || a; n.style.viewTransitionName = "piece";
  $$(".sticker").forEach(x => x.style.viewTransitionName = ""); const st = $(".sticker", a); if (st) st.style.viewTransitionName = "tag";
}, true);
// Another tab changed the cart: take its version, so neither tab can overwrite the other.
function cartFromStorage() {
  const fit = fitCart(cleanCart(store.get("cart"))); state.cart = fit.kept; if (fit.news.length) state.cartNews = fit.news;
  const on = route().replace(/^#\/?/, "").split("/")[0], f = $("[data-checkout]"), lines = cartLines();
  if (f && lines.length) { const sc = shipChoice(lines); if (sc.pickup || sc.local || sc.chosen) { f.querySelector(".totals").outerHTML = coTotals(lines, sc); syncChrome(); return; } }   // never rebuild a form someone is typing in
  if (["cart", "checkout", "p"].includes(on)) render(); else syncChrome();
}
// The account changed the cart (Buy again), or signed in, or the points reward was switched at checkout.
addEventListener("oss:cart", e => {   // Buy again: the usual's pickup choice comes along, and the cart says what was left off
  if (store.get("ship") === "pickup") state.ship = "pickup";
  cartFromStorage(); if (e.detail && e.detail.news) state.cartNews = e.detail.news;
});
const refreshCo = () => { const f = $("[data-checkout]"), lines = cartLines(); if (!f || !lines.length) return; const sc = shipChoice(lines); if (sc.pickup || sc.local || sc.chosen) f.querySelector(".totals").outerHTML = coTotals(lines, sc); };
addEventListener("oss:account", refreshCo); addEventListener("oss:totals", refreshCo);
addEventListener("storage", e => { if (e.key === null || e.key === "oss:cart") cartFromStorage(); });
addEventListener("pageshow", e => { if (e.persisted) cartFromStorage(); });
// Long lists skip drawing what is off screen, so their height is a guess until they are drawn: draw it all for one frame to land exactly.
setSpotAnchor(() => { for (const a of $$("#main [data-piece]")) { const r = a.getBoundingClientRect(); if (r.bottom > 80) return { sku: a.dataset.piece, top: Math.round(r.top) }; } return null; });
function putScroll(spot) {
  const y = typeof spot === "number" ? spot : spot.y || 0, root = document.documentElement, land = () => { scrollTo(0, y); const a = spot.sku && document.querySelector(`#main [data-piece="${spot.sku}"]`); if (a) scrollBy(0, a.getBoundingClientRect().top - spot.top); };
  drawThrough(spot.sku); root.classList.add("restoring"); land();
  requestAnimationFrame(() => { land(); root.classList.remove("restoring"); });
}
function go() {
  if (state.newsSeen && !/^#\/cart/.test(route())) { state.cartNews = []; state.newsSeen = false; state.dropped = null; }
  const from = last.match(/^#\/p\/(.+)$/), spot = navInfo().cause === "pop" ? spotHere() : undefined; last = route();
  render({ chunk: true }); if (spot === undefined) scrollTo(0, 0); else putScroll(spot);
  const stage = $("[data-stage]");
  if (stage) { stage.style.viewTransitionName = "piece"; const st = $(".sticker", stage); if (st) st.style.viewTransitionName = "tag"; }
  else if (from) { if (pending && pending.q.some(x => x.sku === from[1])) drawThrough(from[1]); const back = $(`[data-piece="${from[1]}"]`), n = back && ($(".tile", back) || back); if (n) { n.style.viewTransitionName = "piece"; const st = $(".sticker", back); if (st) st.style.viewTransitionName = "tag"; const box = n.getBoundingClientRect(); if (spot === undefined || box.bottom < 60 || box.top > innerHeight - 60) n.scrollIntoView({ block: "center" }); } }
  const sq = $("#q"); if (sq) sq.focus({ preventScroll: true }); else $("#main").focus({ preventScroll: true });
}
// 15 the dock's Back is the real Back; from a shared link there is nothing behind it, so it goes to the section
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-back]"); if (!b || !canGoBack() || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault(); e.stopPropagation(); history.back();
}, true);
window.addEventListener("routechange", () => {
  if (route() === last) return;
  // A long section landed by the wave is drawn in the task after the wave's own frame, so the wave's drawing and the page's building
  // are two tasks, not one. The wave holds its full cover while data-swapping is set (fx-wave.js), so nothing old is ever revealed.
  const [ra, rb] = route().replace(/^#\/?/, "").split("/").filter(Boolean);
  if (navInfo().cause === "wave" && ra === "shop" && (rb ? SHELF.filter(p => p.cat === rb).length : SHELF.length) > 24) {
    const root = document.documentElement; root.dataset.swapping = "";
    soon(() => { try { if (route() !== last) go(); } finally { delete root.dataset.swapping; } });
    return;
  }
  if (!navInfo().instant && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go); else go();   // a wave is already covering the change
});
find.init({ PRODUCTS, esc, card, render, navigate, grid: shopGrid, defer });
finder.init({ PRODUCTS, CATEGORIES, esc, shot, sticker, setQ: q => { state.q = q; } });
render();
if (spotHere()) putScroll(spotHere());   // a reload, or Back from another site, lands where you were
