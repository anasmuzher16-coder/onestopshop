import { PRODUCTS, CATEGORIES, BOXES } from "/api/catalog-module";
import { route, navigate, navInfo, spotHere, canGoBack, setQuery, setSpotAnchor, afterSwap } from "./route.js";
import { parsePostal, pack, quote, money, days, MAX_QTY, fuelOn, orderTotals, taxRate, taxLabel, localArea, localDue, localEta, FREE_LOCAL_CENTS, SHOP_HOURS } from "./rates.js";
import { accountView, afterRender, rewardCents, rewardRow, rewardFlag, rewardGone } from "./account.js";
import { visitSource } from "./source.js";   // where the visit came from, sent with the order (back office report)
import { shelfOf, ticked, heroPicks } from "./picks.js";
import * as find from "./find.js";
import * as finder from "./search.js";
import { shopBand, soonBand, openLine, nowInWindsor, h12, DAYS } from "./band.js";   // the section band, the same markup the Worker writes into the HTML

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
// Card payment on or off: the Worker writes it into every page (meta oss-pay, from the same switch checkout.js uses). While it is
// off, every order is a pickup paid at the counter, so nothing on the site offers delivery or shipping (breaker, 2026-11-27), and
// an unpaid pickup holds at most 5 of one item and 15 in all (src/guard.js PICKUP_CAPS), so the cart stops there too.
const CARD_ON = document.querySelector('meta[name="oss-pay"]')?.content === "card";
const PICKUP_ONLY = !CARD_ON;
// The shop's mail connected or not: the Worker writes it into every page (meta oss-mail, from the same switch the server uses,
// src/email.js mailReady). While it is off no email reaches a customer, so every line says the shop calls or texts instead, and a
// pickup request needs a phone (checked by the server too). REQ_SPAN: how long an unconfirmed request waits (PICKUP_REQUEST_HOURS).
const MAIL_ON = document.querySelector('meta[name="oss-mail"]')?.content === "on";
const REQ_SPAN = (h => h >= 48 && h % 24 === 0 ? `${h / 24} days` : `${h} hours`)((n => Number.isInteger(n) && n >= 1 && n <= 720 ? n : 72)(Number(document.querySelector('meta[name="oss-req-hours"]')?.content)));
const TELL = MAIL_ON ? "email you" : "call or text you", TOLD = MAIL_ON ? "that email" : "our call";   // "we check the shelf and TELL when it is ready; please wait for TOLD"
const LINE_MAX = PICKUP_ONLY ? 5 : MAX_QTY, PICKUP_UNITS = 15;
const stockFor = p => !forSale(p) || isSold(p) ? 0 : Number.isInteger(p.stock) ? Math.min(LINE_MAX, Math.max(0, p.stock)) : LINE_MAX;   // the most of this piece one cart can hold
const stockShort = (p, qty) => Number.isInteger(p.stock) && p.stock < LINE_MAX && qty >= p.stock;   // the shelf, not the cart's rule, is what stops it
// Anything not known yet is said plainly, in one quiet style, never guessed and never left blank.
const TBD = what => `<span class="tbd">${what ? what + " " : ""}TBD</span>`;   // TBD("") when the label beside it already names the fact
// one card per hookah family; every other item is its own card. Items with their own photo come first, in shelf order, so a
// section never opens on a row of drawn stand-ins (design review, 2026-11-26: Heat opened on four "photo coming" cards)
const SHELF = (l => [...l.filter(p => p.img), ...l.filter(p => !p.img)])(shelfOf(PRODUCTS));
const FAMILIES = new Map(); for (const p of PRODUCTS) if (p.family) { if (!FAMILIES.has(p.family)) FAMILIES.set(p.family, []); FAMILIES.get(p.family).push(p); }   // built once: every card used to filter the whole catalogue for its colours
const familyOf = p => p && p.family ? FAMILIES.get(p.family) || [p] : p ? [p] : [];
const GROUPS = [["full_size", "Full size"],   // the Kind filter (find-core.js HOOKAHS) uses these same names: change both together
 ["stem_set", "Stem only, no base"], ["compact_travel", "Compact and travel"], ["statement", "Statement pieces"]];
const stemSet = p => !!(p && p.facts && p.facts.includes_base === false);
// ---------- THE COLOUR SWITCHER: every catalogue colour, a radio group; a colour without its own photo says "Photo coming" ----------
const catItem = p => !!(p && (p.family || p.acc));   // a catalogue item: an Ace hookah family, an Ace accessory (one card each), or one of the shop's own hoses (hose-...)
const aceItem = p => !!(p && (p.acc || /^ace-/.test(p.family || "")));   // from an Ace catalogue only: the hoses are the shop's own, never "Supplier: Ace Hookah"
const ownPhoto = v => !!(v && v.img && (!v.family || v.facts.photo === "own"));
const photoOf = v => !!(v && v.img);   // its own photo or the family's, labelled
const colourName = (v, i) => v.colour ? (v.named ? v.colour : `${v.colour}, name TBD`) : `Colour ${i + 1}`;
// a light chip on the coal ground gets a ring; computed from the chip's own colour so it never disappears into the page
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0; const c = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const chipStyle = v => `--c:${esc(v.chip || "#8a8a8a")}${lum(v.chip) < .1 ? ";--ring:oklch(1 0 0 / .36)" : ""}`;   // a dark chip (charcoal, mid grey and darker) gets a light inner ring, so it never sinks into the coal
// THE COLOUR SWITCHER on a card: every chip has a 44 px target, and the row never runs past the card. How many targets fit
// is the card's own width (a container query, styles.css): when the colours do not all fit, the last place becomes "+N",
// N being exactly the colours not shown at that width. The "+N" for each possible width is written once, here, and CSS shows
// the one that fits, so nothing is measured while a section is drawn. Up to 8 places on the widest card.
const SW_MAX = 8;
function swatchGroup(fam, chosen, { label, card = "" } = {}) {
  // the "photo coming" mark only tells colours apart when some have a photo and some do not; on a family with no photo at all
  // (Panda) every chip carried it and read as a stray dot (design review, 2026-11-27). The words stay in every chip's name.
  const mark = fam.some(photoOf) && !fam.every(photoOf);
  const chip = (v, i) => `<button class="swatch" type="button" role="radio" data-swatch="${v.sku}" ${card ? `data-card="${card}"` : ""} aria-checked="${v.sku === chosen.sku}" tabindex="${v.sku === chosen.sku ? 0 : -1}" style="${chipStyle(v)}" aria-label="${esc(colourName(v, i))}${photoOf(v) ? "" : ", photo coming"}">${photoOf(v) || !mark ? "" : `<span class="swatch__none" aria-hidden="true"></span>`}</button>`;
  if (!card) return `<div class="swatches" role="radiogroup" aria-label="${esc(label)}">${fam.map(chip).join("")}</div>`;   // the product page wraps: every colour shows
  // the chosen colour always shows on the card: it leads the row when it would otherwise be hidden
  const at = fam.findIndex(v => v.sku === chosen.sku), row = at > 0 ? [fam[at], ...fam.slice(0, at), ...fam.slice(at + 1)] : fam, n = row.length;
  const over = [], more = [];
  for (let k = 2; k <= SW_MAX; k++) if (n > k) { over.push("o" + k); more.push(`<a class="swatches__more" data-k="${k}" href="/p/${card}" aria-label="${n - k + 1} more ${n - k + 1 === 1 ? "colour" : "colours"} of ${esc(label.replace(/^Colours of /, ""))}"><span class="num">+${n - k + 1}</span></a>`); }
  return `<div class="swatchbox ${over.join(" ")}"><div class="swatches swatches--card" role="radiogroup" aria-label="${esc(label)}">${row.map(v => chip(v, fam.indexOf(v))).join("")}</div>${more.join("")}</div>`;
}
// The photo a colour shows, and its label in the quiet TBD style (owner, 2026-11-24): its own photo (no label: an enlarged one
// is the shop's to-do, not the shopper's), the family's photo with "Shown in <colour>", or the drawn stand-in with "Photo coming". The label is in the alt text too.
function photoLabel(v) {
  const f = (v && v.facts) || {};
  if (!v.img || v.photo === true) return "";   // the shop's own photo, uploaded in the back office, replaces whatever the label was about
  // "to be upscaled" is the shop's own work list, never a shopper's business (design review, 2026-11-26): it stays in the
  // catalogue data, and the storefront shows the photo without it
  if (f.photo === "family") return `Shown in ${f.shown_in || "another colour"}`;
  // the shop's original photo standing in until a cleaned one goes up (owner 2026-11-27: the shop's hookahs, and every hose)
  if (f.photo === "own" && f.photo_label === "replace") return "Photo to be replaced";
  if (v.details?.photo === "replace") return "Photo to be replaced";   // a stand-in photo of a similar pack (owner, 2026-11-24)
  return "";
}
// a number and its unit never part at the end of a line ("250 g", "72 cm"): one non-breaking space between them
const nb = s => String(s).replace(/(\d)\s+(g|kg|cm|mm|ml|in|pcs?|sheets?)\b/gi, "$1 $2");
const escN = s => nb(esc(s));
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
    if (!max) { news.push(`${p.name} has sold out, so we took it out of your cart.`); continue; }
    if (l.qty > max) news.push(stockShort(p, max) || max < LINE_MAX || !PICKUP_ONLY ? `We only have ${max} of ${p.name}, so your cart now has ${max}.` : `A pickup request takes up to ${max} of one item, so your cart now has ${max} of ${p.name}. Call 519-255-2222 for more.`);
    kept.push({ sku: l.sku, qty: Math.min(max, l.qty) });
  }
  return { kept, news };
}
// A saved cart can hold an item that is no longer sold online at all (the demo's samples, taken off 2026-11-24): its row is
// gone from the catalogue, so it has no name to show. It is taken out and said once in words (here, and when another tab
// changes the cart). Read before anything below rewrites the saved cart.
const SAVED_CART = store.get("cart");
function goneNote(saved) {
  const gone = Array.isArray(saved) ? new Set(saved.filter(l => l && typeof l.sku === "string" && /^OSS-\d{4,6}$/.test(l.sku) && !bySku[l.sku]).map(l => l.sku)).size : 0;
  return gone ? `${gone === 1 ? "One item" : gone + " items"} in your cart ${gone === 1 ? "is" : "are"} no longer sold online, so we took ${gone === 1 ? "it" : "them"} out. Call the counter at 519-255-2222 to ask about ${gone === 1 ? "it" : "them"}.` : null;
}
const state = { reach: ["local", "nationwide"].includes(store.get("reach")) ? store.get("reach") : null, whyOpen: false, q: "", note: typeof store.get("note") === "string" ? store.get("note") : "", set: {}, dest: parsePostal(store.get("postal")), cart: cleanCart(store.get("cart")), ship: typeof store.get("ship") === "string" ? store.get("ship") : null, cartNews: [] };
{ const fit = fitCart(state.cart); if (fit.news.length) { state.cart = fit.kept; state.cartNews = fit.news; store.set("cart", state.cart); } }
{ const gone = goneNote(SAVED_CART); if (gone) { state.cartNews.push(gone); store.set("cart", state.cart); } }
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
// One sentence per delivery situation, said the same everywhere (design review, 2026-11-26; owner: "say pickup and local for now").
// "for now" never parts across a line. The rules themselves live in rates.js and the server (checkout.js, delivery.js).
const SAY = {
  local: "Free pickup in Windsor, or local delivery near Windsor from $10.",   // nothing that ships is on sale yet
  ships: "Free pickup in Windsor, local delivery from $10, and shipping across Canada except Quebec, for now.",
  shipsOne: "Ships across Canada, except Quebec for now.",
  groundOne: "Ships by ground across Canada, except Quebec for now.",
  shisha: "Paid in the shop, pickup only.",
  pickup: "Free pickup at our Windsor counter: order online, pay when you pick it up.",   // card payment off: no delivery, no shipping
};
// Shipping by carrier is promised only when it can really be ordered: card payment on AND something that ships is on sale and in
// stock (the Worker's footer and page descriptions follow the same rule, src/worker.js). Read at draw time.
const shipsNow = () => CARD_ON && PRODUCTS.some(p => forSale(p) && !isSold(p) && !localOnly(p) && !counterPay(p));
const homeLine = () => PICKUP_ONLY ? SAY.pickup : shipsNow() ? SAY.ships : SAY.local;
const realName = p => !/^Hookah No\.?\s*\d+$/i.test(p.name || "");
const SHOP_STREET = "760 Wyandotte St E", SHOP_ADDRESS = "760 Wyandotte St E, Windsor, ON N9A 3J4", SHOP_MAP = "https://www.google.com/maps/search/?api=1&query=One%20Stop%20Shop%2C%20760%20Wyandotte%20St%20E%2C%20Windsor%2C%20ON%20N9A%203J4";
const directions = (label = "Get directions") => `<a class="link" href="${SHOP_MAP}" target="_blank" rel="noopener">${label}</a>`;
const HOURS = SHOP_HOURS;   // DAYS, h12, nowInWindsor and openLine live in band.js: the Worker writes the band's open line too

const pickupDay = () => { const { day, t } = nowInWindsor(); return t >= HOURS[day][1] ? "Tomorrow" : "Today"; };   // after closing, the counter's next chance is tomorrow
// A pickup request's ready time, said the same way everywhere (the /shipping page's words, design review 2026-11-27): the shop
// checks the shelf first, so "today" is never promised. A paid pickup (card on) still says today or tomorrow.
const READY_WHEN = "usually the same or the next day";
const pickupReady = (request = PICKUP_ONLY) => request ? "Usually ready the same or the next day" : pickupDay() === "Today" ? "Ready the same day" : "Ready tomorrow";
const REQ_LAPSE = () => `A request we have not confirmed is cancelled after ${REQ_SPAN}.`;
// the counter's address and hours, one line for the confirmation and the order's own page (the footer's hours)
const SHOP_OPEN = "Open Mon to Sat 10&nbsp;to&nbsp;9, Sun 11&nbsp;to&nbsp;7", pickupWhere = () => `Pickup at ${SHOP_ADDRESS}. ${SHOP_OPEN}. ${directions()}`;
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
const QC_NOTE = "<b>Not shipping to Quebec yet.</b> The site is in English only for now. Pickup in Windsor is free, or call <a class=\"link tel\" href=\"tel:+15192552222\">519-255-2222</a>.";
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
const vq = p => p.iv ? "?v=" + p.iv : V;   // each photo's own version (store/src/img-versions.json): changing one photo re-downloads only that one
// a photo that fills its tile (no cut-out): a resin piece's dark photo, the shop's own upload, or a shop hookah's original photo
// standing in until a cleaned one goes up (facts.photo_full, 2026-11-27)
const fullTile = p => !!(p.dark || p.photo || (p.facts && p.facts.photo_full === true));
const imgSrc = (p, small) => p.photo ? (p.img[0] === "/" ? p.img : `img/${p.img}.webp`) : `img/pc/${p.img}${small && !p.dark ? "-s" : ""}.webp${vq(p)}`;
const SIZES = { card: "(min-width:1500px) 18vw, (min-width:960px) 22vw, (min-width:640px) 30vw, 46vw", pdp: "(min-width:960px) 50vw, 100vw",
  thumb: "96px", slab: "(min-width:960px) 42vw, 58vw", lineup: "(min-width:960px) 370px, 240px", cat: "(min-width:960px) 24vw, 44vw", cat1: "(min-width:960px) 42vw, 44vw", resin: "(min-width:960px) 28vw, (min-width:640px) 40vw, 72vw" };
function srcset(p) {
  if (p.photo) return "";
  if (p.dark) return `srcset="img/pc/${p.img}.webp${vq(p)} 800w${p.lw ? `, img/pc/${p.img}-l.webp${vq(p)} ${p.lw}w` : ""}"`;
  return `srcset="img/pc/${p.img}-s.webp${vq(p)} 360w, img/pc/${p.img}-m.webp${vq(p)} 540w, img/pc/${p.img}.webp${vq(p)} 720w${p.lw ? `, img/pc/${p.img}-l.webp${vq(p)} ${p.lw}w` : ""}"`;
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
  const plain = fullTile(p);
  return `<img class="${plain ? "shot shot--photo" : "shot"} ${cls}" src="${imgSrc(p, small)}" ${srcset(p)} ${p.photo ? "" : `sizes="${SIZES[use]}"`} alt="${esc(alt)}" width="${p.dark ? 1080 : 720}" height="${p.dark ? 1080 : 900}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// ---------- THE STICKER (device): the delivered price, slapped on the product ----------
function sticker(p, { big = false } = {}) {
  const n = parseInt(p.sku.slice(-3), 10), r = ((n * 37) % 23) - 13; // -13..+9 degrees, fixed per product
  if (p.state === "tbd") return `<span class="sticker sticker--tbd ${big ? "sticker--big" : ""}" style="--r:${r}deg"><span class="sticker__k">Price</span><span class="sticker__v">TBD</span></span>`;   // the price gun's own words until the shop sets its price
  if (p.state === "soon") return `<span class="sticker sticker--tbd ${big ? "sticker--big" : ""}" style="--r:${r}deg"><span class="sticker__k">Soon</span><span class="sticker__v">${whole(p.price)}</span></span>`;
  return `<span class="sticker ${big ? "sticker--big" : ""} ${isSold(p) ? "sticker--sold" : ""}" style="--r:${r}deg"><span class="sticker__v">${isSold(p) ? "Sold out" : whole(p.price)}</span></span>`;
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
  // The first screen: on a desktop the filter rail is part of it (find.css shows it from 960 px), so it goes first and is drawn
  // with the first cards; on a phone the rail is hidden and waits until the cards are in.
  const parts = q.q.filter(x => !x.sku).length, partsFirst = q.wide;
  const order = [...q.q.keys()].sort((a, b) => (partsFirst ? (!q.q[b].sku) - (!q.q[a].sku) : (!q.q[a].sku) - (!q.q[b].sku)) || a - b);
  pending = { q: q.q, order, slots, at: 0, step: 2, run };
  main.setAttribute("aria-busy", "true");   // screen readers wait for the whole list
  const upto = q.first - 1 + (partsFirst ? parts : 0);
  setTimeout(() => { if (runs === run) delete document.documentElement.dataset.swapping; }, 400);   // never hold the wave longer than this after the page is in
  soon(() => {
    try { if (pending && pending.run === run) { drawLater(0, upto, true); if (pending) drain(run); } }
    finally { delete document.documentElement.dataset.swapping; }   // the wave may leave now: the first screen is in
  });
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
  drawLater(0, j >= 0 ? j + first : L.order.length, false);   // no card to aim at: everything, so the remembered height exists. Not "first":
  // the scroll has not landed yet, so these labels wait for their cards to come into view, as on any Back
}

// A shisha card leads with its flavour; the maker and the tub size go on a quiet line under it (council, 2026-11-26: 47 names
// that all began "Zanobia Herbal Molasses" wrapped two or three lines and hid what makes each one different). Product pages,
// titles and search keep the full name.
const shishaName = p => { const m = p.cat === "shisha" && /^(.+?) Herbal Molasses (.+), (\d+ ?g)$/.exec(p.name || ""); return m ? { flavour: m[2], line: `${m[1]} herbal molasses, ${m[3]}` } : null; };
function cardHTML(p, i = 9) {
  const tone = toneOf(p), sh = shishaName(p);
  return `
  <article class="card" data-tone="${tone}" ${p.family ? `data-family="${p.sku}"` : ""}>
    <a class="card__a" href="/p/${p.sku}" data-piece="${p.sku}">
      <div class="tile ${fullTile(p) ? "tile--photo" : ""}">${colourShot(p, { small: true, eager: i < 2 })}${sticker(p)}</div>
      <h3 class="card__name">${sh ? `${esc(sh.flavour)}<span class="sr">, ${escN(sh.line)}</span>` : escN(p.name)}</h3>${sh ? `<p class="card__maker" aria-hidden="true">${escN(sh.line)}</p>` : ""}
    </a>
    ${cardMeta(p)}${localOnly(p) && !PICKUP_ONLY ? `<p class="card__pick">Pickup or local delivery only</p>` : ""}
  </article>`;
}

// What a card says under the name: the item's own line, or for a hookah family its colours and whether it has a base.
function cardMeta(p) {
  const desc = p.details?.description;   // one line on the card, the whole of it on the product page
  // nothing to say (the Ace accessories have no catalogue description): the card is its name alone, never an empty line or a
  // line written for it (design review, 2026-11-27)
  if (!p.family) { const line = desc || p.note || (p.facts && p.facts.size) || ""; return line ? `<p class="card__meta ${desc ? "card__meta--one" : ""}">${escN(line)}</p>` : ""; }
  const fam = familyOf(p), bits = stemSet(p) ? "Stem set, no base" : "";   // the chips carry the colour count
  return `${desc ? `<p class="card__meta card__meta--one">${escN(desc)}</p>` : ""}${fam.length > 1 ? swatchGroup(fam, p, { label: `Colours of ${p.name}`, card: p.sku }) : ""}${bits ? `<p class="card__meta card__meta--fam">${bits}</p>` : ""}`;
}

// ---------- views ----------
// Every page opens with the same band the shop sections have: a flat jewel colour, the title, and room for the page's object.
const band = (fx, tone, title, note = "") => `<section class="shophead shophead--page" data-tone="${tone}" data-fx="${fx}"><h1 class="shophead__h">${title}</h1>${note ? `<p class="shophead__n">${note}</p>` : ""}</section>`;

// ---------- STOCK ARRIVING SOON (owner, 2026-11-24: "Hide samples, show coming soon") ----------
// A section, gift list or set with nothing in it shows its empty place on the shelf instead of an empty grid. The store's
// rule for an unknown is a dashed hairline, never a coloured block (styles.css, "quiet TBD"), so the first slot of the grid
// is drawn as a dashed empty slot on the coal, and the section's own drawn object (the one its band plays with) stands in it,
// still. Beside it one claim, one sentence and the one action, the counter's phone; beside that, what is on the shelf now,
// counted, as a ledger. No form: the shop answers the phone.
const SOON_NOUN = { parts: "parts and care pieces", misc: "odds and ends", heat: "heat pieces", cologne: "colognes" };
const shelfNow = c => { const l = SHELF.filter(p => p.cat === c.id), sale = l.filter(forSale).length; return [c, l.length, sale]; };
// the drawings are the band's own (fx-objects.js, already fetched by the effects); a slot is filled once they are here
let objs = null, slotN = 0;
const fillSlots = () => (objs ||= import("./fx-objects.js")).then(({ OBJ }) => { for (const s of document.querySelectorAll(".soon__art[data-obj]:empty")) { const o = OBJ[s.dataset.obj]; if (o) s.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${o.replaceAll("ID", "soon" + (++slotN))}</svg>`; } }).catch(() => { objs = null; });   // a failed fetch is tried again on the next page
function nowLedger() {
  const now = CATEGORIES.map(shelfNow).filter(([, n]) => n).sort((a, b) => (b[2] > 0) - (a[2] > 0));   // sections with something to buy first; prices TBD last
  return now.length ? `<nav class="soonnow" aria-labelledby="soonnow-h"><h2 class="soonnow__h" id="soonnow-h">On the shelf now</h2>
      <ul>${now.map(([c, n, sale]) => `<li><a href="/shop/${c.id}" data-tone="${c.tone}"><span class="soonnow__sw" aria-hidden="true"></span><span class="soonnow__n">${esc(c.name)}</span><span class="soonnow__c"><span class="num">${n}</span>${sale ? "" : ` ${TBD("Prices")}`}</span></a></li>`).join("")}</ul></nav>` : "";
}
function soonShelf({ tone, obj, title = "Coming soon to the site.", lead }) {
  setTimeout(fillSlots, 0);   // after the page has put this in
  return `<section class="soon" data-tone="${tone}" aria-labelledby="soon-h">
    <div class="soon__slot tile" aria-hidden="true"><span class="soon__art" data-obj="${obj}"></span><span class="sticker sticker--tbd"><span class="sticker__k">Ask</span><span class="sticker__v">the counter</span></span></div>
    <div class="soon__copy">
      <h2 class="soon__h" id="soon-h">${title}</h2>
      <p class="soon__p">${lead}</p>
      <div class="soon__acts"><a class="btn" href="tel:+15192552222">Call 519-255-2222</a>${directions()}</div>
    </div>
    ${nowLedger()}
  </section>`;
}
const soonSection = c => soonShelf({ tone: c.tone, obj: c.id, lead: `Our ${SOON_NOUN[c.id] || c.name.toLowerCase()} are not online yet. Call the counter and we will check the shelf for you.` });
function viewHome() {
  // the first screen and the counter picks: the shop's ticked (in-store) hookahs with their own photo, one per family (public/picks.js, the Worker preloads the same first one)
  // Counter picks show names, so a catalogue piece still waiting for its real name ("Hookah No. 26") is never one of them (design review, 2026-11-26)
  const ranked = heroPicks(PRODUCTS, 40), stars = ranked.slice(0, 5), picks = ranked.slice(5).filter(realName).slice(0, 8);
  for (const p of SHELF.filter(x => x.cat === "hookahs" && !x.dark && realName(x))) { if (picks.length >= 8) break; if (!picks.includes(p) && !stars.includes(p)) picks.push(p); }
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
        <p class="hero__p">${homeLine()}</p>
        <div class="hero__cta"><a class="btn" href="/shop/hookahs">Shop hookahs</a><a class="btn btn--ghost" href="/shop">All ${SHELF.length} pieces</a></div>
      </div>
    </div>
  </section>
  <section class="cats" aria-label="Shop by category">
    ${defer(() => CATEGORIES.filter(c => SHELF.some(p => p.cat === c.id)).map((c, i) => { const n = SHELF.filter(p => p.cat === c.id).length; const lead = (c.id === "hookahs" && stars[0]) || SHELF.find(p => p.cat === c.id && !p.dark && p.img) || SHELF.find(p => p.cat === c.id && !p.dark);
      return `<a class="cat" data-tone="${c.tone}" href="/shop/${c.id}">${shot(lead, { small: i > 0, use: i ? "cat" : "cat1", cls: "cat__img" })}<span class="cat__name">${c.name}</span><span class="cat__n num">${n}</span></a>`; }).join(""))}
  </section>
  ${(() => { const waiting = CATEGORIES.filter(c => !SHELF.some(p => p.cat === c.id));   // sections whose stock is not on the site yet: one quiet line, never a tile (2026-11-24)
    const names = waiting.map(c => `<a class="link" href="/shop/${c.id}">${esc(c.name)}</a>`), list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.at(-1) : names[0];
    return waiting.length ? `<p class="cats__soon">${list}: no pieces online yet. Call <a class="link" href="tel:+15192552222">519-255-2222</a> and we will check the shelf for you.</p>` : ""; })()}  <section class="shelf">
    <header class="shelf__head"><h2 class="h2">Counter picks</h2><a class="link" href="/shop/hookahs">All ${SHELF.filter(p => p.cat === "hookahs").length} hookahs</a></header>
    <div class="grid">${picks.map((p, i) => card(p, i + 8)).join("")}</div>
  </section>
  ${tall.length >= 3 ? `<section class="lineup" aria-labelledby="lu-h">
    <header class="lineup__head"><h2 class="h2 h2--xl" id="lu-h">Compare heights.</h2><p class="lineup__note">From the shelf, tallest to shortest.</p></header>
    <div class="lineup__row" tabindex="0" role="group" aria-label="Hookahs by height">
      ${tall.filter((p, i) => tall.length < 12 || i % 3 === 0).map(p =>
        `<a class="lu" href="/p/${p.sku}" style="--cm:${p.height}"><img class="lu__img" src="img/pc/${p.img}-s.webp${vq(p)}" ${srcset(p)} sizes="${SIZES.lineup}" alt="" loading="lazy" width="360" height="450"><span class="lu__cm num">${p.height}&nbsp;cm</span><span class="lu__name">${esc(p.name)}</span></a>`).join("")}
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
  ${shipsNow() ? `<section class="pack">
    <div class="pack__copy">
      <h2 class="h2 h2--xl">How we ship glass.</h2>
      <ul class="pack__list">
        <li><b>Taken apart.</b> Stem, base and tray are wrapped separately so nothing long carries the weight.</li>
        <li><b>Double boxed.</b> The base sits in its own box inside the shipping box.</li>
        <li><b>Covered.</b> A glass box worth over $100 ships with signature and full coverage.</li>
      </ul>
      <a class="link" href="/shipping">How shipping works</a>
    </div>
  </section>` : ""}
  <section class="visit" aria-labelledby="visit-h">
    <div class="visit__main">
      <h2 class="h2 h2--xl" id="visit-h">Visit the counter.</h2>
      <p class="visit__now">${openLine()}</p>
      <dl class="visit__facts">
        <div><dt>Where</dt><dd>${SHOP_ADDRESS}<span class="visit__todo">${directions()}</span></dd></div>
        <div><dt>Pick up</dt><dd>${PICKUP_ONLY ? `Order online, pick up at the counter, ${READY_WHEN}. Free.` : "Order online, pick up at the counter the same day. Free."}</dd></div>
        <div><dt>Call</dt><dd><a class="link" href="tel:+15192552222">519-255-2222</a></dd></div>
        <div><dt>Rated</dt><dd>${directions("4.5 stars on Google, 115 reviews")}</dd></div>
      </dl>
    </div>
    <table class="visit__hours"><caption class="sr">Opening hours</caption><tbody>${[1, 2, 3, 4, 5, 6, 0].map(d => `<tr ${d === nowInWindsor().day ? 'class="is-today"' : ""}><th scope="row">${DAYS[d]}</th><td class="num">${h12(HOURS[d][0])} to ${h12(HOURS[d][1])}</td></tr>`).join("")}</tbody></table>
  </section>`;
}

function shopGrid(cat) {
  const c = catById[cat] || null, list = c ? SHELF.filter(p => p.cat === c.id) : SHELF;
  // Hookahs: the shop's ticked pieces, grouped by kind. A tick means it is in the shop, in stock; nothing is ordered in, so an
  // unticked catalogue page is never shown (owner, 2026-11-26), and there is no "In the shop" / "From the catalogue" split.
  const fams = list.filter(p => p.family), byKind = l => GROUPS.map(([k, name]) => [name, l.filter(p => (p.facts.group || "full_size") === k)]).filter(g => g[1].length);
  const tiers = cat === "hookahs" && fams.length ? [["", "", byKind(fams.filter(ticked))]].filter(t => t[2].length) : null;
  const groups = tiers ? null : cat === "hookahs" ? [...Object.keys(SERIES).map(k => [k, list.filter(p => seriesOf(p) === k)]), ["More from the shelf", list.filter(p => !seriesOf(p) && !p.dark)], ["One of one", list.filter(p => p.dark)]].filter(g => g[1].length) : [["", list]];
  const range = items => { const pr = items.filter(forSale).map(x => x.price); return pr.length === items.length && pr.length ? `, ${whole(Math.min(...pr))} to ${whole(Math.max(...pr))}` : ""; };
  return `${tiers ? tiers.map(([, , gs]) => `<section class="tier">
    <div class="grid grid--shop">${gs.map(([name, items]) => `<h2 class="series">${name} <span class="num">${items.length} ${items.length === 1 ? "hookah" : "hookahs"}</span></h2>` + items.map(card).join("")).join("")}</div></section>`).join("")
  : `<div class="grid grid--shop">${groups.map(([name, items]) => (name ? `<h2 class="series" data-tone="${SERIES[name] || ""}">${name} <span class="num">${items.length} pieces${range(items)}</span></h2>` : "") + items.map(card).join("")).join("")}</div>`}`;
}
// The band (band.js): the Worker writes the same markup into the HTML, so a cold load paints it before this script runs
function viewShop(cat) {
  const c = catById[cat] || null, list = c ? SHELF.filter(p => p.cat === c.id) : SHELF;
  const empty = !!c && !list.length, f = c && !empty && find.findShop(c.id);   // section filters (find.js); null when a section has nothing to filter by
  return `${shopBand(c, list)}
  <nav class="chips" aria-label="Categories"><a href="/shop" ${!c ? 'aria-current="page"' : ""}>All</a>${CATEGORIES.map(x => `<a href="/shop/${x.id}" ${c && c.id === x.id ? 'aria-current="page"' : ""}>${x.name}</a>`).join("")}</nav>
  ${empty ? soonSection(c) : f ? f.html(() => shopGrid(cat)) : shopGrid(cat)}`;
}

// The product page for charcoal: one plain answer about how it is bought, in place of the delivery and shipping rows.
// The rule sits above the button, so nobody adds it to the cart before reading how it is bought.
// While card payment is off every item is a pickup, so charcoal gets the same pickup line as everything else (deliveryLine) and
// this note, which would imply other items ship today, is not drawn (design review, 2026-11-27).
const counterLine = p => p.weightTbd && !isCharcoal(p)
  ? `<div class="dline dline--fixed dline--above" role="note"><span class="dline__msg">Pickup or local delivery for now</span><span class="dline__sub">Shipping TBD: the pack weight is being confirmed. Free pickup at ${SHOP_STREET}, or local delivery from $10 near Windsor.</span></div>`
  : `<div class="dline dline--fixed dline--above" role="note"><span class="dline__msg">Pickup or local delivery only</span><span class="dline__sub">Never shipped by Canada Post. Free pickup at ${SHOP_STREET}, or local delivery from $10 near Windsor.</span></div>`;
// a hose's length as the shop says it; one not known yet says so, never a guess
const lengthRow = p => `<div><dt>Length</dt><dd>${p.facts.length ? escN(p.facts.length) : `<span class="tbd">To confirm</span>`}</dd></div>`;
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
          ${p.facts && "length" in p.facts ? lengthRow(p) : (isCharcoal(p) || p.weightTbd) && (sizeOf(p) || !PICKUP_ONLY) ? `<div><dt>Size</dt><dd>${sizeOf(p) ? escN(sizeOf(p)) : TBD("")}</dd></div>` : ""}
          ${p.facts && "count" in p.facts && (p.facts.count || !PICKUP_ONLY) ? `<div><dt>${isCharcoal(p) ? "Pieces" : "Sheets"}</dt><dd>${p.facts.count ? `<span class="num">${p.facts.count}</span>` : TBD("")}</dd></div>` : ""}
          ${p.weightTbd && !PICKUP_ONLY ? `<div><dt>Weight</dt><dd>${TBD("")}</dd></div>` : ""}
          <div><dt>Getting it</dt><dd>${PICKUP_ONLY ? "Pickup at the counter, paid in the shop" : p.weightTbd && !isCharcoal(p) ? `Pickup or local delivery. ${TBD("Shipping")}` : "Pickup or local delivery only"}</dd></div>
          ${!p.img && !p.photo ? `<div><dt>Photo</dt><dd>${box && box.img ? "Shows the box this roll comes from." : "Photo coming soon"}</dd></div>` : ""}
        </dl>
      </section>`;
}
// What is known about an item on view, and what is not yet: unknowns are said as "TBD", never guessed or left out.
function factsSpec(p, fam) {
  const f = p.facts || {}, named = fam.every(v => v.named), base = f.includes_base === true ? "Included" : f.includes_base === false ? "Not included: stem set, no base" : null;
  // only what the shop has given: the list of details still to come is the shop's to-do, not the shopper's (design review,
  // 2026-11-26). "Price TBD" above already says what is pending, and the shop fills the rest in from the back office's item editor.
  const shopCols = v => Array.isArray(v.details?.colours) && v.details.colours.length > 0;
  return `<section class="spec" aria-labelledby="spec-h">
        <h2 class="h3" id="spec-h">Details</h2>
        <dl class="spec__list">
          ${p.state === "tbd" ? "" : `<div><dt>Price</dt><dd><span class="num">${whole(p.price)}</span>, coming soon</dd></div>`}
          ${p.family ? `${base ? `<div><dt>Base</dt><dd>${base}</dd></div>` : ""}
          ${f.height_cm ? `<div><dt>Height</dt><dd><span class="num">${f.height_cm}&nbsp;cm</span></dd></div>` : ""}
          ${aceItem(p) && f.item_weight_g > 0 ? `<div><dt>Weight</dt><dd><span class="num">${f.item_weight_g < 1000 ? `${Math.round(f.item_weight_g)}&nbsp;g` : `${+(f.item_weight_g / 1000).toFixed(2)}&nbsp;kg`}</span></dd></div>` : ""}
          ${"length" in f ? lengthRow(p) : ""}
          ${aceItem(p) && f.material ? `<div><dt>Material</dt><dd>${esc(f.material)}</dd></div>` : f.acrylic ? `<div><dt>Material</dt><dd>Acrylic</dd></div>` : ""}
          ${aceItem(p) && f.size ? `<div><dt>Size</dt><dd>${escN(f.size)}</dd></div>` : ""}
          ${aceItem(p) && f.features ? `<div><dt>Features</dt><dd>${esc(f.features)}</dd></div>` : ""}
          ${Array.isArray(f.includes) && f.includes.length ? `<div><dt>Comes with</dt><dd>${esc(f.includes.join(", "))}</dd></div>` : ""}
          <div><dt>Colours</dt><dd>${fam.length > 1 ? `<span class="num">${fam.length}</span> shown${named ? ": " + esc(fam.map(v => v.colour).join(", ")) : ""}` : named ? esc(fam.map(v => v.colour).join(", ")) : "One"}</dd></div>` : ""}
          ${p.acc ? `${f.item_weight_g > 0 ? `<div><dt>Weight</dt><dd><span class="num">${f.item_weight_g < 1000 ? `${Math.round(f.item_weight_g)}&nbsp;g` : `${+(f.item_weight_g / 1000).toFixed(2)}&nbsp;kg`}</span></dd></div>` : ""}${f.material ? `<div><dt>Material</dt><dd>${esc(f.material)}</dd></div>` : ""}${f.features ? `<div><dt>Features</dt><dd>${esc(f.features)}</dd></div>` : ""}` : ""}
          ${catItem(p) && ticked(p) ? `<div><dt>Availability</dt><dd>In the shop</dd></div>` : ""}
          ${shopCols(p) ? `<div><dt>${p.family ? "In the shop" : "Colours"}</dt><dd>${esc(p.details.colours.join(", "))}</dd></div>` : ""}
          ${!p.img ? `<div><dt>Photo</dt><dd>Photo coming soon</dd></div>` : p.family && f.photo === "family" ? `<div><dt>Photo</dt><dd>Shows another colour of this ${p.cat === "hookahs" ? "hookah" : "piece"}.</dd></div>` : ""}
          ${aceItem(p) ? `<div><dt>Supplier</dt><dd>Ace Hookah</dd></div>` : ""}
          <div><dt>Item</dt><dd class="num">${p.sku}</dd></div>
        </dl>
      </section>`;
}
function viewProduct(sku) {
  const asked = new URLSearchParams(location.search).get("colour"), base = bySku[sku];
  const p = base && base.family && bySku[asked] && bySku[asked].family === base.family ? bySku[asked] : base;
  if (!p) return `${band("missing", "ruby", "That one is gone.")}<section class="empty"><p class="lead">It may have sold out. <a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
  const c = catById[p.cat], parcels = pack([{ product: p, qty: 1 }]), opts = cpQuote([{ product: p, qty: 1 }]), b = parcels[0];
  const inCart = state.cart.some(l => l.sku === p.sku);   // the colour chosen, not the address's first colour
  const fam = familyOf(p), sale = forSale(p);
  const more = SHELF.filter(x => x.cat === p.cat && x.sku !== sku && (!p.family || x.family !== p.family) && !x.dark && !isSold(x))
    .sort((a, b) => p.family ? ((b.facts?.group === p.facts.group) - (a.facts?.group === p.facts.group)) || (ticked(b) - ticked(a)) : (seriesOf(b) === seriesOf(p)) - (seriesOf(a) === seriesOf(p))).slice(0, 4);
  const n = parseInt(p.sku.slice(-3), 10), nth = (c, k) => { const l = liveCat(c).filter(x => x.img); return l.length ? l[(n + k) % l.length] : null; };   // a suggestion always has its photo
  // what a hookah is smoked with, one from each section that has something on sale (foil from Heat too); never padded with anything else
  const goes = p.cat === "hookahs" ? [nth("bowls", 0), nth("charcoal", 1), nth("hoses", 2), nth("parts", 3), nth("heat", 4)].filter(Boolean).slice(0, 4) : [];
  // a hookah family's colours: each chip shows its colour and swaps the photo; a name the shop has not confirmed is never stated as fact
  const chips = fam.length > 1 ? `<p class="swatches__n" id="colour-h">Colour <b data-colour-name ${p.named ? "" : "hidden"}>${esc(p.named ? p.colour : "")}</b> <span class="num">${fam.indexOf(p) + 1} of ${fam.length}</span></p>
      ${swatchGroup(fam, p, { label: "Colour" })}` : "";
  const sold = isSold(p);
  const gi = galIndex(p), gn = photosOf(p).length, gp = photosOf(p)[gi];   // the photo shown (more photos of one item: products.img_more)
  return `
  <article class="pdp" data-tone="${toneOf(p)}" data-cat="${p.cat}">
    <div data-stage="${p.sku}" class="pdp__tile tile ${fullTile(gp) ? "tile--photo" : ""}"${gn > 1 ? ` data-gal="${gi}"` : ""}>${colourShot(gp, { eager: true, alt: gi ? `${photoAlt(p)}, photo ${gi + 1} of ${gn}` : photoAlt(p) })}${sticker(p, { big: true })}${galleryHtml(p, gi)}</div>
    <div class="pdp__info">
      <p class="crumb"><a href="/shop/${p.cat}">${c.name}</a></p>
      <h1 class="pdp__name${p.name.length > 30 ? " pdp__name--long" : ""}">${escN(p.name)}</h1>
      ${p.family ? (stemSet(p) ? `<p class="pdp__note">Stem set, no base.</p>` : "") : (p.note || p.facts?.size || p.height) && !(!p.height && p.name.toLowerCase().includes(String(p.note || p.facts?.size).toLowerCase().replace(/\.$/, ""))) ? `<p class="pdp__note">${escN(p.note || p.facts?.size || "")}${p.height ? `${p.note || p.facts?.size ? ". " : ""}Stands ${p.height}&nbsp;cm.` : /[.!?]$/.test(p.note || p.facts?.size || ".") ? "" : "."}</p>` : ""}
      ${p.details?.description ? `<p class="pdp__desc">${escN(p.details.description)}</p>` : ""}
      ${chips}
      ${p.details && p.details.notes ? `<p class="pdp__notes"><span>Notes</span> ${esc(p.details.notes)}</p>` : ""}
      ${!p.family && sale && Array.isArray(p.details?.colours) && p.details.colours.length ? `<p class="pdp__notes"><span>Colours</span> ${esc(p.details.colours.join(", "))}</p>` : ""}
      ${localOnly(p) && !PICKUP_ONLY ? counterLine(p) : ""}
      ${!sale ? `${p.state === "tbd" ? `<p class="pdp__avail">Price TBD. ${catItem(p) ? "In the shop now. " : ""}The shop sets the price and confirms stock.</p>` : `<p class="soldline">Coming soon.</p>`}<a class="btn btn--ghost btn--call btn--ask" href="tel:+15192552222">Ask the counter, 519-255-2222</a>`
        : sold ? `<p class="soldline">${p.dark ? "This one has sold. Each resin stem is poured once." : "Sold out for now."}</p><a class="btn btn--ghost btn--call" href="tel:+15192552222">Call the counter</a>`
        : `<p class="pdp__price num">${whole(p.price)}</p>${inCart ? `<a class="btn btn--wide" href="/cart">In your cart. View cart</a>` : `<button class="btn btn--wide" type="button" data-add="${p.sku}">Add to cart</button>`}`}
      ${sale ? deliveryLine(p, opts) : ""}
      ${!sale ? factsSpec(p, fam) : counterPay(p) || PICKUP_ONLY ? "" : `<section class="ways" aria-labelledby="ways-h">
        <h2 class="h3" id="ways-h">Delivery, shipping and pickup</h2>
        ${opts.length || (state.dest && localOnly(p)) ? `<p class="ways__to">To ${esc(state.dest.full)}${state.dest.city ? ", " + esc(state.dest.city) : ""}. <button class="link" type="button" data-open-postal>Change</button></p>
        <table class="ledger"><thead><tr><th scope="col">Service</th><th scope="col">Arrives</th><th scope="col" class="r">Cost</th></tr></thead>
        <tbody>${localRow(p)}${opts.map(o => `<tr><td>${o.carrier} ${o.service}</td><td>${days(o.days)}</td><td class="r num">${money(o.total)}</td></tr>`).join("")}
        <tr><td>Pick up at ${SHOP_STREET}</td><td>${pickupDay()}</td><td class="r num">Free</td></tr></tbody></table>`
        : `<p class="ways__to">Local delivery from $10 near Windsor. Free pickup. ${localOnly(p) ? "" : p.ship === "ground_only" ? SAY.groundOne : SAY.shipsOne}</p>`}
      </section>`}
      ${!sale ? "" : counterPay(p) || (PICKUP_ONLY && !localOnly(p)) ? `<section class="spec" aria-labelledby="spec-h"><h2 class="h3" id="spec-h">Details</h2><dl class="spec__list"><div><dt>Item</dt><dd class="num">${p.sku}</dd></div>${p.facts && "length" in p.facts ? lengthRow(p) : ""}${p.facts?.size || p.note ? `<div><dt>Size</dt><dd>${escN(p.facts?.size || p.note)}</dd></div>` : ""}<div><dt>Getting it</dt><dd>Pickup at the counter, paid in the shop</dd></div></dl></section>` : localOnly(p) ? counterSpec(p) : `<section class="spec" aria-labelledby="spec-h">
        <h2 class="h3" id="spec-h">Packed size</h2>
        <dl class="spec__list">
          <div><dt>Item</dt><dd class="num">${p.sku}</dd></div>
          ${p.facts?.size ? `<div><dt>Size</dt><dd>${escN(p.facts.size)}</dd></div>` : ""}
          <div><dt>Weight, packed</dt><dd class="num">${b.kg} kg</dd></div>
          <div><dt>Box</dt><dd><span class="num">${b.l} \u00d7 ${b.w} \u00d7 ${b.h} cm</span>, ${esc(b.label.toLowerCase())}</dd></div>
          ${opts.length ? `<div><dt>Billed as</dt><dd><span class="num">${opts[0].perParcel[0].billableKg} kg</span>, the larger of weight and box size</dd></div>` : ""}
          ${p.glass ? `<div><dt>Glass</dt><dd>Double boxed${p.price > 100 ? ", signature and coverage included" : ""}</dd></div>` : ""}
        </dl>
      </section>`}
    </div>
  </article>
  ${goes.length ? `<section class="shelf${goes.length < 4 ? " shelf--few" : ""}"><header class="shelf__head"><h2 class="h2">Goes with this</h2>${sale ? `<a class="link" href="/set">Build a set</a>` : ""}</header><div class="grid">${goes.map(card).join("")}</div></section>` : ""}
  ${more.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">More ${localOnly(p) ? "charcoal" : c.name.toLowerCase()}</h2><a class="link" href="/shop/${p.cat}">All ${localOnly(p) ? "charcoal" : c.name.toLowerCase()}</a></header><div class="grid">${more.map(card).join("")}</div></section>` : ""}`;
}


// ---------- build a set ----------
// The heat section is charcoal now: pickup or local delivery only, so it is an optional pick, never put in a set by default.
const SLOTS = [["hookah", "hookahs", "The hookah"], ["bowl", "bowls", "A bowl"], ["heat", "charcoal", PICKUP_ONLY ? "Charcoal, pickup only" : "Charcoal, pickup or local delivery only"], ["hose", "hoses", "A hose"]];
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
    <dl class="totals">${PICKUP_ONLY ? `
      <div><dt>Getting it</dt><dd>Pickup at the counter, paid in the shop</dd></div>` : `${!carried(lines) ? `
      <div><dt>Charcoal</dt><dd>Pickup or local delivery only</dd></div>` : `
      <div><dt>Ships as</dt><dd>${parcels.length} ${parcels.length === 1 ? "box" : "boxes"}, <span class="num">${parcels.reduce((a, b) => a + b.kg, 0).toFixed(1)} kg</span></dd></div>`}
      <div><dt>${localVal !== null ? "Delivery to " + esc(d.full) : "Shipping" + (q ? " to " + esc(state.dest.full) : "")}</dt><dd>${localVal !== null ? localVal : q ? `<span class="num">${money(q.total)}</span>` : state.dest && !carried(lines) ? "Local delivery or pickup" : !carried(lines) ? "Pickup free, or local delivery" : `<button class="link" type="button" data-open-postal>Add postal code</button>`}</dd></div>`}
      <div class="totals__door"><dt>Set price</dt><dd class="num">${money(sum)}</dd></div>
    </dl>
    ${picks.length ? `<button class="btn btn--wide" type="button" data-add-set>Add the set to cart</button>` : `<a class="btn btn--wide" href="/shop">See what is in stock</a>`}`;
}
// A set needs something on sale in at least one of its three main picks; until then the page says the pieces are on their way
// (src/seo.js setReady is the same rule for the page's title and the sitemap).
const setReady = () => SLOTS.some(([slot, cat]) => !OPTIONAL.has(slot) && setOpts(cat).length);
// why no set can be built yet, said from the shelf itself: no shop price yet, sold out, or no stock on the site yet
function setWhy() {
  const by = { tbd: [], sold: [], soon: [] }, and = l => l.length > 1 ? l.slice(0, -1).join(", ") + " and " + l.at(-1) : l[0];
  for (const [slot, cat] of SLOTS) { if (OPTIONAL.has(slot)) continue; const l = inCat(cat), name = (catById[cat]?.name || cat).toLowerCase(); by[!l.length ? "soon" : l.some(forSale) ? "sold" : "tbd"].push(name); }
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const parts = [by.tbd.length ? `${and(by.tbd.map(n => n.replace(/s$/, "")))} prices are on the way` : "", by.soon.length ? `our ${and(by.soon)} are not on the site yet` : "", by.sold.length ? `the ${and(by.sold)} are sold out for now` : ""].filter(Boolean);
  return parts.length ? cap(parts.length > 1 ? parts.slice(0, -1).join(", ") + ", and " + parts.at(-1) : parts[0]) + "." : "";
}
// While sets are put together at the counter, the band says so without the number: the page's own Call button is in the first
// screen at every width, so the number shows once (design review, 2026-11-27).
function viewSet() {
  const picks = setPicks();
  if (!setReady()) return `
  <section class="shophead" data-tone="ruby" data-fx="set">
    <h1 class="shophead__h">Build a set</h1>
    <p class="shophead__n">The counter puts a set together with you.</p>
  </section>
  ${soonShelf({ tone: "ruby", obj: "set", title: "Sets are put together at the counter for now.", lead: `A set is a hookah, a bowl and a hose that go together. ${setWhy()}` })}`;
  return `
  <section class="shophead" data-tone="ruby" data-fx="set">
    <h1 class="shophead__h">Build a set</h1>
    <p class="shophead__n">Three picks, plus charcoal if you want it.</p>
  </section>
  <div class="set">
    <div class="set__steps">${SLOTS.map(([slot, cat, label], i) => `
      <section class="pick" aria-labelledby="pick-${slot}">
        <h2 class="h3" id="pick-${slot}"><span class="num">${i + 1}</span> ${label}</h2>
        ${!setOpts(cat).length && slot === "hookah" ? `<p class="pick__none">Hookahs join sets once the shop sets their prices. <a class="link" href="/shop/hookahs">See the hookahs</a></p>`
          : !setOpts(cat).length && !OPTIONAL.has(slot) ? `<p class="pick__none">${esc(catById[cat]?.name || label)}: coming soon to the site. <a class="link" href="tel:+15192552222">Call the counter</a></p>` : ""}
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
  const d = state.dest, from = "Local delivery from $10 near Windsor", either = shipsNow() ? "It ships across Canada except Quebec, or pickup is free" : "Pickup is free";   // nothing that ships is on sale: never promise shipping (breaker, 2026-11-27)
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
  return shipsNow() ? { key: "ship", msg: `We ship to ${d.full}`, sub: "", act: "Change" } : { key: "far", msg: `${d.full} is past our delivery area`, sub: either, act: "Change" };
}
function deliveryLine(p, opts) {
  if (isSold(p) || !forSale(p)) return "";
  // shisha is paid at the counter until the card company approves it, so it is a pickup: never promise shipping the cart will not offer
  if (counterPay(p)) return `<p class="dline dline--fixed"><span class="dline__msg">Pickup at the Windsor counter</span><span class="dline__sub">Free pickup, usually ready the same or the next day. ${SAY.shisha}</span></p>`;
  // card payment off: every order is a pickup paid at the counter, charcoal included, said the same way for every item
  if (PICKUP_ONLY) return `<p class="dline dline--fixed"><span class="dline__msg">Pickup at the Windsor counter</span><span class="dline__sub">Free pickup, usually ready the same or the next day. Paid in the shop.</span></p>`;
  // another item, with shisha already in the cart: the whole order is a pickup, so say that before anyone counts on shipping
  if (counterPayIn(cartLines()).length) return `<p class="dline dline--fixed"><span class="dline__msg">Your order is a pickup while it has shisha</span><span class="dline__sub">Shisha is pickup only and paid in the shop, so the whole order is picked up in Windsor</span></p>`;
  let s = deliveryNow(cartCents() + (state.cart.some(l => l.sku === p.sku) ? 0 : toCents(p.price)));
  if (localOnly(p) && (s.key === "far" || s.key === "ship" || s.key === "down")) s = { msg: "This one goes by local delivery or pickup", sub: "Canada Post does not carry it. Pickup is free", act: "Change" };
  else if (toQuebec()) s = { msg: "We do not ship to Quebec yet", sub: "The site is in English only for now. Pickup in Windsor is free", act: "Change" };
  else if (state.dest && !opts.length && (s.key === "far" || s.key === "ship" || s.key === "down")) s = { msg: `We cannot price shipping to ${state.dest.full} here`, sub: "Call 519-255-2222, or pickup is free", act: "Change" };
  return `<button class="dline" type="button" data-open-postal><span class="dline__msg">${esc(s.msg)}</span>${s.sub ? `<span class="dline__sub">${esc(s.sub)}</span>` : ""}<span class="dline__act">${esc(s.act)}</span></button>`;
}
function syncDelivery() {
  const box = $("[data-delivery-strip]"), btn = $(".dstrip__btn", box), on = route().replace(/^#\/?/, "").split("/")[0], answered = !!state.reach || (!!state.dest && (state.dest.complete || !localArea(state.dest))),
    // a section that never ships (charcoal: pickup or local; shisha: paid at the counter, so pickup) never asks how to send it (design review, 2026-11-26)
    sec = route().replace(/^#\/?/, "").split("/")[1] || "", card = document.querySelector('meta[name="oss-shisha-card"]')?.content === "1", forSec = PRODUCTS.filter(p => p.cat === sec && p.state === "sale"),
    counterOnly = p => (p.cat === "shisha" || p.details?.tobacco) && !card,
    // One bar, following what can really be ordered (breaker and design review, 2026-11-27; the Worker's asksHow is the same rule):
    //  - card payment off: every order is a pickup paid at the counter, so there is nothing to choose and no bar at all;
    //  - card on, nothing on sale ships by carrier: no Nationwide choice; the one slim local-delivery bar, on the shop pages too;
    //  - card on and something ships: the shop pages ask local or nationwide, other pages carry the slim bar.
    ships = shipsNow(), neverShips = on === "shop" && forSec.length > 0 && forSec.every(p => ships ? localOnly(p) || counterOnly(p) : counterOnly(p)),
    off = ships ? store.get("choose-off") : store.get("strip-off"),
    choosing = !PICKUP_ONLY && ships && on === "shop" && !neverShips && !answered && !off,
    show = !PICKUP_ONLY && !neverShips && (choosing || (!["cart", "checkout", "order", "p", ...(ships ? ["shop"] : [])].includes(on) && !answered && !store.get("strip-off")));   // gone once we have their answer, or once they close it. The product page and cart can still take one
  box.hidden = !show; box.dataset.mode = choosing ? "choose" : "slim"; btn.hidden = choosing; $(".dchoose", box).hidden = !choosing;
  // the Worker draws the shop pages' bar already open from this, so a cold load's band is where it stays (worker.js asksHow).
  // Whether to show it, nothing more: no answer, postal code or address goes in it.
  const ask = !PICKUP_ONLY && !answered && !off ? "1" : "0";
  if (!document.cookie.split("; ").includes("oss-ask=" + ask)) document.cookie = `oss-ask=${ask}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;   // the Worker renews it on every page load
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
  // card payment off: the only way is pickup, paid at the counter (checkout.js refuses delivery and shipping without card)
  if (PICKUP_ONLY) return { parcels: [], opts: [], canLocal: false, checking: false, localFee: null, status: null, pickup: true, local: false, counter, mixed: false, chosen: null };
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
  if (!lines.length) return `${band("cart", "gilt", "Your cart", "Nothing in it yet.")}<section class="empty">${news}<p class="lead">${(() => { const on = CATEGORIES.filter(c => liveCat(c.id).length).slice(0, 3).map(c => `<a class="link" href="/shop/${c.id}">${esc(c.name.toLowerCase())}</a>`); return on.length ? `Start with the ${on.length > 1 ? on.slice(0, -1).join(", ") + " or the " + on.at(-1) : on[0]}.` : `See <a class="link" href="/shop">everything on the shelf</a>.`; })()}</p></section>`;
  const was = shipChoice(lines); if (state.ship === "local" && !was.canLocal && !was.checking) { state.ship = null; store.set("ship", null); }   // the cart is where a new way of sending it is shown and chosen
  const { parcels, opts, canLocal, checking, localFee, status, pickup, local, chosen, counter, mixed } = shipChoice(lines), sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const shishaIn = counterPayIn(lines).length > 0, atCounter = shishaIn || PICKUP_ONLY, overUnits = PICKUP_ONLY && cartCount() > PICKUP_UNITS, ready = !overUnits && (pickup || local || !!chosen), inShop = pickup && (!CARD_ON || atCounter), otherWay = carried(lines) ? "You can still ship it or pick it up free." : "You can still pick it up free.";
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
        <a class="line__tile tile ${fullTile(p) ? "tile--photo" : ""}" href="/p/${p.sku}" aria-label="${esc(p.name)}">${shot(p, { small: true, use: "thumb" })}</a>
        <div class="line__body"><a class="line__name" href="/p/${p.sku}">${esc(p.name)}</a><p class="line__meta num">${p.sku}${PICKUP_ONLY ? "" : ` &middot; ${counterPay(p) ? `<b class="line__pick">Pickup only, paid in the shop</b>` : localOnly(p) ? `<b class="line__pick">${atCounter ? "Pickup with this order" : "Pickup or local delivery only"}</b>` : `${p.kg} kg`}`}${stockShort(p, qty) ? ` &middot; only ${stockFor(p)} in stock` : qty >= LINE_MAX && PICKUP_ONLY ? ` &middot; ${LINE_MAX} is the most for one online order` : ""}</p>
          <div class="qty"><button type="button" aria-label="One less ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty - 1}">&minus;</button><span class="num" aria-live="polite">${qty}</span><button type="button" aria-label="One more ${esc(p.name)}" data-qty="${p.sku}" data-n="${qty + 1}" ${qty >= stockFor(p) ? "disabled" : ""}>+</button></div></div>
        <p class="line__price num">${money(p.price * qty)}</p>
      </li>`).join("")}</ul>
    <section class="cartship" data-pickup-choice tabindex="-1">
      <h2 class="h3">${counter || atCounter ? "How you get it" : "How we pack it"}</h2>
      ${counter || atCounter ? "" : `<ol class="boxes">${parcels.map(p => `<li><span class="num">${p.l} \u00d7 ${p.w} \u00d7 ${p.h} cm, ${p.kg} kg</span> ${esc(p.label.toLowerCase())}, ${p.items.length} ${p.items.length === 1 ? "item" : "items"}</li>`).join("")}</ol>`}
      ${!state.dest && WIDE.matches && !atCounter ? `<button class="btn btn--wide" type="button" data-open-postal>Check delivery to my postal code</button>` : ""}
      ${shishaIn ? `<p class="note">Shisha is pickup only and paid in the shop, so this order is a pickup.</p>` : atCounter ? `<p class="note">Online orders are picked up and paid at our Windsor counter for now.</p>` : localNote}
      ${overUnits ? `<p class="note" id="checkout-units">A pickup request takes up to ${PICKUP_UNITS} items, ${LINE_MAX} of any one item. Take some out, or call the counter at <a class="link tel" href="tel:+15192552222">519-255-2222</a> for more.</p>` : ""}
      ${counter && !atCounter ? `<p class="note">${canLocal ? "Choose local delivery or free pickup for the whole order" : "Choose free pickup for the whole order"}${mixed ? ", or leave the charcoal out to ship the rest" : ""}. Charcoal goes by pickup or local delivery only, never by Canada Post.${state.dest?.complete && !canLocal && !checking && !localArea(state.dest) ? ` Local delivery does not reach ${esc(state.dest.full)}.` : ""}</p>` : ""}
      ${toQuebec() && carried(lines) && !atCounter ? `<p class="note">${QC_NOTE}</p>` : ""}
      ${tooHeavy && !atCounter ? `<p class="note">One of these boxes is over the 30 kg carrier limit. Call the counter at 519-255-2222 and we will quote it by hand.</p>` : ""}
      ${!atCounter && (opts.length || canLocal) ? `<fieldset class="opts"><legend>Getting it to ${esc(state.dest.full)} <button class="link" type="button" data-open-postal>Change</button></legend>
        ${canLocal ? `<label class="opt"><input type="radio" name="ship" value="local" ${local ? "checked" : ""}><span class="opt__name">Local delivery<small>${localFee !== null ? localEta() : "We price it from your street address at checkout"}</small></span><span class="num">${localFee !== null ? feeText(localFee) : "At checkout"}</span></label>` : ""}
        <label class="opt"><input type="radio" name="ship" value="pickup" ${pickup ? "checked" : ""}><span class="opt__name">Pick up at the Windsor counter<small>${SHOP_STREET}, Windsor. ${pickupReady()}</small></span><span class="num">Free</span></label>
        ${opts.map(o => `<label class="opt"><input type="radio" name="ship" value="${o.id}" ${chosen && o.id === chosen.id ? "checked" : ""}><span class="opt__name">${o.carrier} ${o.service}<small>${days(o.days)}</small></span><span class="num">${money(o.total)}</span></label>`).join("")}
        ${mixed ? dropOpt(lines) : ""}
      </fieldset>
      ${canLocal ? `<p class="note" data-free-note>${freeNote(cartCents(lines))}</p>` : ""}
      ${chosen ? `<details class="why" ${state.whyOpen ? "open" : ""}><summary>What makes up ${money(chosen.total)}</summary><dl>
        ${chosen.perParcel.map((p, i) => `<div><dt>Box ${i + 1}, billed at ${p.billableKg} kg</dt><dd class="num">${money(p.freight)}</dd></div>`).join("")}
        ${chosen.cover ? `<div><dt>Glass coverage and signature</dt><dd class="num">${money(chosen.cover)}</dd></div>` : ""}
        <div><dt>Carrier fuel charge, ${(fuelOn().pct * 100).toFixed(1)}%, ${fuelOn().stale ? "the last rate we have, for" : "the rate posted for"} ${fuelOn().week}</dt><dd class="num">${money(chosen.fuel)}</dd></div></dl></details>` : ""}` : atCounter ? `<p class="pickline"><b>Pick up at the Windsor counter</b> <span>${SHOP_STREET}, Windsor. ${pickupReady(true)}</span> <span class="num">Free</span></p>` : `<fieldset class="opts"><legend>${counter && state.dest ? `Getting it to ${esc(state.dest.full)} <button class="link" type="button" data-open-postal>Change</button>` : counter ? "Choose one" : "Or skip shipping"}</legend><label class="opt"><input type="radio" name="ship" value="pickup" ${pickup ? "checked" : ""}><span class="opt__name">Pick up at the Windsor counter<small>${SHOP_STREET}, Windsor. ${pickupReady()}</small></span><span class="num">Free</span></label>${mixed && !atCounter ? dropOpt(lines) : ""}</fieldset>`}
    </section>
    <div class="giftnote"><label class="field__label" for="note">Gift note <span class="fine">optional, written on a card with your order</span></label>
      <textarea class="field field--text field--area" id="note" data-note maxlength="240" rows="2" placeholder="Happy birthday, from all of us">${esc(state.note)}</textarea></div>
    <div class="cart__sum">
    <dl class="totals">
      <div><dt>Items</dt><dd class="num">${money(sub)}</dd></div>
      <div><dt>${pickup ? "Pickup" : local ? "Delivery" : counter ? "Pickup or delivery" : "Shipping"}</dt><dd class="num">${pickup ? "Free" : local ? (localFee !== null ? feeText(localFee) : "At checkout") : chosen ? money(chosen.total) : checking ? "Checking" : counter ? "Choose above" : "add postal code"}</dd></div>
      <div class="totals__door"><dt>${local && localFee === null ? "Total before delivery and tax" : "Total before tax"}</dt><dd class="num">${local ? money(sub + (localFee || 0)) : chosen ? money(sub + chosen.total) : money(sub)}</dd></div>
    </dl>
    ${!ready && !checking && !tooHeavy && !overUnits ? `<p class="fine" id="checkout-why">${counter ? (canLocal ? "Choose local delivery or pickup to check out." : mixed ? "Choose pickup, or leave the charcoal out to ship the rest, to check out." : "Choose pickup to check out.") : "Add a postal code or choose pickup to check out."}</p>` : ""}
    ${ready ? `<a class="btn btn--wide" href="/checkout">${inShop ? "Request pickup" : "Check out"}</a>` : `<button class="btn btn--wide" type="button" disabled ${overUnits ? 'aria-describedby="checkout-units"' : !checking && !tooHeavy ? 'aria-describedby="checkout-why"' : ""}>Check out</button>`}
    <p class="fine">${inShop ? `Tax is added on the next step. We check the shelf and ${TELL} when it is ready; you pay at the counter when you pick it up.` : "Tax is added at checkout."}</p>
    </div>
  </section>`;
}

function viewShipping() {
  const pickup = `<h2 class="h3">Pick up</h2>
    <p>Order online and pick up for free at ${SHOP_ADDRESS}. ${PICKUP_ONLY ? `Your order is a request: we check the shelf and ${TELL} when it is ready, usually the same or the next day. Please wait for ${TOLD} before you come in, because nothing is set aside until then. You pay at the counter, and we hold it for 14 days from ${MAIL_ON ? "the email" : "our call"}. A request we have not confirmed is cancelled after ${REQ_SPAN}.` : `We ${TELL} when it is ready and hold it for 14 days.`} ${directions()} or call <a class="link" href="tel:+15192552222">519-255-2222</a>.</p>`;
  const returns = `<h2 class="h3">Returns</h2>
    <p>All sales are final, except faulty, wrong, damaged or undelivered items. If something ${PICKUP_ONLY ? "is faulty" : "arrives broken"} or is not what you ordered, call 519-255-2222 or bring it into the store and talk to the store manager: we repair, replace or refund it. <a class="link" href="/terms">Terms of sale</a>.</p>`;
  // While card payment is off, every order is a pickup (breaker and design review, 2026-11-27): pickup and returns come first, and
  // delivery and shipping are described as what opens with card payment, in the future tense, with no postal-code tool.
  if (PICKUP_ONLY) return `
  ${band("shipping", "cobalt", "Shipping", "Pickup at our Windsor counter, for now.")}
  <section class="reading">
    <p class="lead"><b>For now, online orders are picked up and paid at our Windsor counter.</b> Local delivery and shipping open once we take card payment online.</p>
    ${pickup}
    ${returns}
    <h2 class="h3">When card payment opens</h2>
    <p>Local delivery will come from our Windsor counter, priced by road distance: $10 up to 10 km and $15 up to 25 km, per order, plus tax, and free on orders with $200 or more in items before tax. Delivery times will be estimates, and local delivery will be paid online when you order.</p>
    <p>Shipping will go to every province and territory except Quebec, for now: the site is in English only, and we will ship there once it is also in French. Its price will be worked out from the packed weight and box size of your order and the carrier\u2019s rate to your postal code, and shown before you pay. Hookahs will ship taken apart, with the glass base double boxed.</p>
    <p>Charcoal will never be shipped by Canada Post or any carrier: it stays pickup or local delivery only. Other items ship once their packed weight is known.</p>
  </section>`;
  return `
  ${band("shipping", "cobalt", "Shipping", !shipsNow() ? "Pickup and local delivery in Windsor, for now." :"From Windsor across Canada, except Quebec for now.")}
  <section class="reading">
    <p class="lead">We pack every order at the counter in Windsor and ship to every province and territory except Quebec, for now: the site is in English only, and we will ship there once it is also in French. Pickup in Windsor is open to everyone.</p>
    <h2 class="h3">Local delivery</h2>
    <p>We deliver from our Windsor counter, priced by road distance: $10 up to 10 km and $15 up to 25 km, per order, plus tax. Orders with $200 or more in items before tax deliver free. Anything in the shop can come by local delivery. Enter your postal code and we show your exact price, or tell you if you are past our delivery area.</p>
    <p>While the shop is open, it arrives in about 25 minutes to 1 hour. After closing, it arrives the next morning. These are estimates, not set times. Local delivery is paid online when you order.</p>
    <h2 class="h3">What it costs</h2>
    <p>Shipping is worked out from the packed weight and box size of your order and the carrier\u2019s rate to your postal code. You see the cost on the product page and in the cart before you pay.</p>
    <p><button class="btn btn--ghost" type="button" data-open-postal>${state.dest ? "Estimating to " + esc(state.dest.full) + ". Change" : "Enter my postal code"}</button></p>
    <h2 class="h3">How glass is packed</h2>
    <p>Hookahs ship taken apart. The glass base is double boxed. If anything arrives broken, bring it into the store and talk to the store manager.</p>
    <h2 class="h3">What we ship</h2>
    <p>Everything in the shop except charcoal, once its packed weight is known: until then an item says it is pickup or local delivery for now. Charcoal goes by pickup or local delivery only: it is never sent by Canada Post.</p>
    ${pickup}
    ${returns}
  </section>`;
}

// ---------- chrome, sheet, router ----------
// The desktop menu never cuts a link off (owner, 2026-11-26: "fix every issue like that"): links that do not fit move, from
// the end, behind a labelled "More" button, in the same order. Whole links only; nothing scrolls out of sight.
// Under 960 px the row is display:none (styles.css): that is asked of the media query, not of offsetWidth, which made the whole new
// page lay out inside the wave's page swap on every phone tap (trace, 2x CPU, 2026-11-26: 10-56 ms of style and layout at fitNav)
function fitNav() {
  if (!WIDE.matches) return;
  const nav = $("[data-nav]"); if (!nav || !nav.offsetWidth) return;   // phones hide the row (the dock and the /shop chips carry it)
  const more = nav.querySelector(".top__more"), menu = more.querySelector(".top__menu");
  for (const a of [...menu.children]) more.before(a);   // start from the whole row
  more.hidden = true; more.open = false;
  if (nav.scrollWidth <= nav.clientWidth) return;
  more.hidden = false;
  const links = [...nav.querySelectorAll(":scope > a")];
  while (nav.scrollWidth > nav.clientWidth && links.length > 1) menu.prepend(links.pop());
  if (menu.querySelector("[aria-current]")) more.querySelector("summary").setAttribute("aria-current", "true"); else more.querySelector("summary").removeAttribute("aria-current");
}
let fitRaf = 0; addEventListener("resize", () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitNav); }, { passive: true });
document.fonts?.ready.then(fitNav).catch(() => {});
addEventListener("click", e => { const m = document.querySelector(".top__more[open]"); if (m && !m.contains(e.target)) m.open = false; });
addEventListener("keydown", e => { if (e.key === "Escape") { const m = document.querySelector(".top__more[open]"); if (m) { m.open = false; m.querySelector("summary").focus(); } } });
function syncChrome() {
  $$("[data-cart-count]").forEach(e => e.textContent = cartCount());
  const h = route() || "#/";
  const [ra, rb] = h.replace(/^#\/?/, "").split("/"), asked = bySku[new URLSearchParams(location.search).get("colour")], base = ra === "p" ? bySku[rb] : null;
  const prod = base && base.family && asked && asked.family === base.family ? asked : base;   // the dock buys the colour shown
  const here = (on, exact = on) => on ? `aria-current="${exact ? "page" : "true"}"` : "";   // the page itself, or the section a product belongs to
  // Gifts is gone from the menu (owner, 2026-11-26: "it just adds clutter")
  $("[data-nav]").innerHTML = `<a href="/shop" ${here(h === "#/shop")}>Everything</a>` + CATEGORIES.map(c => `<a href="/shop/${c.id}" ${here(h === "#/shop/" + c.id || prod?.cat === c.id, h === "#/shop/" + c.id)}>${c.name}</a>`).join("") + `<a href="/set" ${here(h === "#/set")}>Build a set</a><a href="/search" ${here(h === "#/search")}>Search</a>`
    + `<details class="top__more" hidden><summary>More</summary><div class="top__menu"></div></details>`;
  fitNav();
  const topCart = $(".top__cart"); if (h === "#/cart") topCart.setAttribute("aria-current", "page"); else topCart.removeAttribute("aria-current");
  const count = `<span data-cart-count>${cartCount()}</span>`, dock = $(".dock");
  dock.classList.toggle("dock--buy", !!prod);
  const lines = cartLines(), sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const sc = ra === "cart" && lines.length ? shipChoice(lines) : null, ship = sc && sc.chosen, canPay = !!sc && !(PICKUP_ONLY && cartCount() > PICKUP_UNITS) && (sc.pickup || sc.local || !!ship);
  dock.classList.toggle("dock--buy", !!prod || ra === "set" || (ra === "cart" && lines.length > 0));
  dock.innerHTML = prod
    ? `<a class="dock__side" href="/shop/${prod.cat}" data-back>Back</a>${state.cart.some(l => l.sku === prod.sku)
        ? `<a class="dock__buy" href="/cart">In your cart. View cart</a>` : !forSale(prod) ? `<a class="dock__buy dock__buy--call" href="tel:+15192552222">Ask the counter</a>` : isSold(prod) ? `<a class="dock__buy dock__buy--off" href="/shop/${prod.cat}">Sold out. See what is left</a>` : `<button class="dock__buy" type="button" data-add="${prod.sku}">Add to cart <span class="num">${whole(prod.price)}</span></button>`}<a class="dock__side dock__cart" href="/cart">Cart ${count}</a>`
    : ra === "set"
    ? `<a class="dock__side" href="/shop">Shop</a>${setPicks().some(Boolean) ? `<button class="dock__buy" type="button" data-add-set>Add the set <span class="num">${whole(setPicks().filter(Boolean).reduce((a, p) => a + p.price, 0))}</span></button>` : `<a class="dock__buy dock__buy--off" href="/shop">See what is in stock</a>`}<a class="dock__side dock__cart" href="/cart">Cart ${count}</a>`
    : ra === "cart" && lines.length
    ? `<a class="dock__side" href="/shop">Shop</a>${canPay ? `<a class="dock__buy" href="/checkout">${sc.pickup && (!CARD_ON || counterPayIn(lines).length) ? "Request pickup" : "Check out"} <span class="num">${money(sub + (ship ? ship.total : sc && sc.local ? sc.localFee || 0 : 0))}</span></a>` : sc && sc.counter ? `<button class="dock__buy dock__buy--ask" type="button" data-pickup-jump>Choose how you get it</button>` : sc && sc.checking ? `<span class="dock__buy dock__buy--off">Checking delivery</span>` : `<button class="dock__buy" type="button" data-open-postal>${state.dest ? "Change postal code" : "Add postal code for shipping"}</button>`}<span class="dock__side dock__cart"><span class="dock__w">Cart </span>${count}</span>`
    : `<a href="/" ${h === "#/" ? 'aria-current="page"' : ""}>Home</a><a href="/shop" ${here(h.startsWith("#/shop"), h === "#/shop")}>Shop</a><a href="/search" ${h === "#/search" ? 'aria-current="page"' : ""}>Search</a><a href="/cart" ${h === "#/cart" ? 'aria-current="page"' : ""}>Cart ${count}</a>`;
  syncDelivery();
}
const sheet = $("[data-postal-sheet]"), postalInput = $("#postal"), postalErr = $("#postal-err");
const sheetH = $("#sheet-h"), sheetP = $(".sheet__p", sheet), sheetGo = $('button[type="submit"]', sheet), postalBad = postalErr.textContent;
const SHEET_WORDS = {
  plain: { h: sheetH.textContent, p: sheetP.textContent, go: sheetGo.textContent },
  local: { h: "Where should we deliver?", p: "Local delivery is $10 up to 10 km and $15 up to 25 km from our Windsor shop. Free on orders of $200 or more before tax.", go: "Check local delivery" },
  nationwide: { h: "Where should we ship it?", p: "We ship across Canada by Canada Post, except to Quebec for now. Enter your postal code to see the prices.", go: "See shipping prices" },
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
  if (!tile.querySelector(":scope > .shot")) return;
  const frag = document.createElement("template"); frag.innerHTML = colourShot(v, { eager: true, small: !tile.matches("[data-stage]"), alt });
  const img = frag.content.querySelector(".shot"), tag = frag.content.querySelector(".shot__tag");
  // the newest pick wins: a quicker second tap (a colour, or a photo of the gallery) never leaves an older picture on top
  const token = tile._paint = {};
  // the old label stays until the new picture is in: a tile with a label keeps its photo clear of it (styles.css), so taking the
  // label off early would resize the old photo while the new one decodes
  const done = () => { if (tile._paint !== token || !tile.isConnected) return;
    const olds = [...tile.querySelectorAll(":scope > .shot")], last = olds[olds.length - 1], had = olds.includes(document.activeElement);
    tile.querySelectorAll(":scope > .shot__tag").forEach(t => t.remove()); tile.classList.toggle("tile--photo", fullTile(v)); img.classList.add("shot--in"); last.after(img); if (tag) img.after(tag);
    // the product photo is the zoom's button (fx-zoom.js arm): the new one keeps that, and keeps the keyboard's place
    if (last.hasAttribute("tabindex")) { img.tabIndex = 0; img.setAttribute("role", "button"); img.setAttribute("aria-label", "Enlarge photo: " + img.alt); }
    if (had) img.focus({ preventScroll: true });
    requestAnimationFrame(() => { img.classList.add("is-on"); const end = () => { olds.forEach(o => o.remove()); img.classList.remove("shot--in", "is-on"); }; if (matchMedia("(prefers-reduced-motion: reduce)").matches) end(); else setTimeout(end, 280); }); };
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
  setGallery(stage, v);   // the extra angles belong to the colour they were shot for: the new colour's own, from its first photo
  const name = $("[data-colour-name]"); if (name) { name.textContent = v.named ? v.colour : ""; name.hidden = !v.named;   /* a colour the shop has not confirmed is never named as fact */ name.nextElementSibling.textContent = `${familyOf(v).indexOf(v) + 1} of ${familyOf(v).length}`; }
  // the address and the share link name the colour (set above); the page itself is the same piece, so history gets no new entry
}
// Arrow keys move through the colours like any radio group; Home and End jump to the ends.
document.addEventListener("keydown", e => {
  const btn = e.target.closest?.("[role=radio][data-swatch]"); if (!btn) return;
  const all = $$("[role=radio]", btn.closest("[role=radiogroup]")).filter(b => b.getClientRects().length), i = all.indexOf(btn);   // only the colours the card has room to show
  const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
  if (to === undefined) return; e.preventDefault(); pickColour(all[(to + all.length) % all.length], true);
});
// each colour's photo is fetched quietly once the product page is up, so a tap shows it at once
function preloadColours() {
  const stage = $("[data-stage]"), v = stage && bySku[stage.dataset.stage]; if (!v || !v.family) return;
  const go = () => familyOf(v).filter(ownPhoto).forEach(x => { const im = new Image(); im.decoding = "async"; im.src = `img/pc/${x.img}-m.webp${vq(x)}`; });
  // fetched the moment a hand or a key reaches the chips, or a few seconds after the page has settled, so the colours
  // never compete with the page's own first pictures and its smoke
  let done = false; const once = () => { if (done) return; done = true; go(); };
  const g = $(".pdp [role=radiogroup]"); if (g) ["pointerenter", "touchstart", "focusin"].forEach(t => g.addEventListener(t, once, { once: true, passive: true }));
  setTimeout(() => { if (window.requestIdleCallback) requestIdleCallback(once, { timeout: 2000 }); else once(); }, 3500);
}
// ---------- more photos of one item (products.img_more, 2026-11-28, owner-approved stills) ----------
// The main photo first, then the extra angles shot for this SKU. A phone shows "1 / 3" on the photo and takes a sideways swipe;
// a wide screen shows the photos as small tiles on a coal plate inside the photo. Every change goes through paintColour (decoded
// first, then a crossfade; none with reduced motion), into the same box, so nothing moves. Cards and lists keep the main photo.
// (function declarations: the first render can run before this part of the module has been reached)
function photosOf(p) {
  return !p || !p.img || !Array.isArray(p.more) || !p.more.length ? [p]
    : [p, ...p.more.map(m => ({ ...p, img: m.img, lw: m.lw, iv: m.iv, photo: false, dark: false,
        facts: { ...(p.facts || {}), photo: "extra", photo_label: "", photo_full: false }, details: { ...(p.details || {}), photo: "", box_sku: "" } }))];
}
function photoAlt(p) { return p.family && p.named && p.colour && !p.name.toLowerCase().endsWith(p.colour.toLowerCase()) ? `${p.name}, ${p.colour}` : p.name; }
// the photo shown stays through a redraw of the same page (add to cart, a quantity, the cart changed in another tab); another
// product, or another colour, starts from its first photo
var galAt = { sku: null, i: 0 };
function galIndex(p) { if (galAt.sku !== p.sku) galAt = { sku: p.sku, i: 0 }; return Math.min(galAt.i, photosOf(p).length - 1); }
function galleryHtml(p, at = 0) {
  const all = photosOf(p), n = all.length; if (n < 2) return "";
  return `<span class="gal__n num" data-gal-n aria-hidden="true">${at + 1} / ${n}</span><p class="sr" data-gal-say aria-live="polite"></p>
    <div class="gal" role="group" aria-label="Photos, ${n}">
      <button class="gal__go gal__go--back" type="button" data-gal-go="-1" tabindex="-1" aria-label="Scroll the photos back"></button>
      <div class="gal__row">${all.map((v, i) => `<button class="gal__t${fullTile(v) ? " gal__t--photo" : ""}" type="button" data-gal-to="${i}" aria-label="Photo ${i + 1} of ${n}" aria-current="${i === at}"><img src="${imgSrc(v, true)}" alt="" width="360" height="450" loading="lazy" decoding="async"></button>`).join("")}</div>
      <button class="gal__go gal__go--on" type="button" data-gal-go="1" tabindex="-1" aria-label="Scroll the photos on"></button>
    </div>`;
}
// a colour picked without a full redraw: its own photos, from the first
function setGallery(stage, v) {
  stage.querySelectorAll(":scope > .gal, :scope > [data-gal-n], :scope > [data-gal-say]").forEach(el => el.remove());
  galAt = { sku: v.sku, i: 0 };
  const n = photosOf(v).length; if (n < 2) { delete stage.dataset.gal; return; }
  stage.dataset.gal = "0"; stage.insertAdjacentHTML("beforeend", galleryHtml(v)); galInit();
}
function showPhoto(stage, i) {
  const p = bySku[stage.dataset.stage], all = photosOf(p), n = all.length; if (n < 2) return;
  i = (i % n + n) % n; if (i === +(stage.dataset.gal || 0)) return;
  stage.dataset.gal = String(i); galAt = { sku: p.sku, i };
  // the photo keeps the keyboard and its new name is read out; only a swipe or a photo button needs the count said
  const say = !document.activeElement?.matches?.("[data-stage] > .shot");
  paintColour(stage, all[i], i ? `${photoAlt(p)}, photo ${i + 1} of ${n}` : photoAlt(p));
  $$(".gal__t", stage).forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
  const c = $("[data-gal-n]", stage); if (c) c.textContent = `${i + 1} / ${n}`;
  const s = $("[data-gal-say]", stage); if (s && say) s.textContent = `Photo ${i + 1} of ${n}`;
  const row = $(".gal__row", stage), t = $(`[data-gal-to="${i}"]`, stage);
  if (row && t && row.scrollWidth > row.clientWidth) { const l = t.offsetLeft - row.offsetLeft, r = l + t.offsetWidth;
    if (l < row.scrollLeft || r > row.scrollLeft + row.clientWidth) row.scrollTo({ left: l - (row.clientWidth - t.offsetWidth) / 2, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
}
// a long row (6 or more photos, or a narrow plate): a fade at the edge that has more, and the arrows, only while it overflows
function galEdges(row) {
  const g = row.parentNode, over = row.scrollWidth > row.clientWidth + 1;
  g.toggleAttribute("data-over", over);
  g.toggleAttribute("data-more-back", over && row.scrollLeft > 1);
  g.toggleAttribute("data-more-on", over && row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
}
function galInit() {
  const stage = $("[data-stage][data-gal]"); if (!stage) return;
  const row = $(".gal__row", stage); if (row && !row._edges) { row._edges = true; row.addEventListener("scroll", () => galEdges(row), { passive: true }); }
  if (row) galEdges(row);
  // the extra photos are fetched quietly once a hand or a key reaches the photo, or once the page has settled
  const p = bySku[stage.dataset.stage]; let done = false;
  const go = () => { if (done) return; done = true; photosOf(p).slice(1).forEach(x => { const im = new Image(); im.decoding = "async"; im.src = `img/pc/${x.img}-m.webp${vq(x)}`; }); };
  ["pointerenter", "touchstart", "focusin"].forEach(t => stage.addEventListener(t, go, { once: true, passive: true }));
  setTimeout(() => { if (!stage.isConnected) return; if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2000 }); else go(); }, 3500);
}
addEventListener("resize", () => { const row = $("[data-stage][data-gal] .gal__row"); if (row) galEdges(row); }, { passive: true });
document.addEventListener("click", e => {
  const t = e.target.closest?.("[data-gal-to]"); if (t) { showPhoto(t.closest("[data-stage]"), +t.dataset.galTo); return; }
  const g = e.target.closest?.("[data-gal-go]"); if (g) { const row = $(".gal__row", g.parentNode); row.scrollBy({ left: +g.dataset.galGo * row.clientWidth * .8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
});
// arrow keys on the photo or on its tiles move through the photos; Home and End jump to the ends
document.addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;   // Alt+Left is the browser's Back
  const el = e.target.closest?.("[data-stage][data-gal] > .shot, [data-stage][data-gal] .gal__t"); if (!el) return;
  const stage = el.closest("[data-stage]"), n = photosOf(bySku[stage.dataset.stage]).length, i = +stage.dataset.gal;
  const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[e.key]; if (to === undefined) return;
  e.preventDefault(); showPhoto(stage, to);
  if (el.classList.contains("gal__t")) { const t = $(`[data-gal-to="${(to % n + n) % n}"]`, stage); if (t) t.focus(); }
});
// a sideways swipe on a phone's photo: only a clearly sideways move counts, so the page still scrolls under an upward thumb
// (the tile leaves vertical panning to the browser: touch-action pan-y in styles.css)
var swipe = null, swiped = 0;
document.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" || !e.isPrimary || (window.visualViewport && visualViewport.scale > 1.01)) return;   // pinched in: a sideways move pans the page
  const stage = e.target.closest?.("[data-stage][data-gal]"); if (!stage || e.target.closest(".gal, .sticker")) return;
  swipe = { stage, x: e.clientX, y: e.clientY, id: e.pointerId, way: "" };
}, { passive: true });
document.addEventListener("pointermove", e => {
  if (!swipe || e.pointerId !== swipe.id || swipe.way) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) swipe.way = "y";
  else if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) swipe.way = "x";
}, { passive: true });
document.addEventListener("pointerup", e => {
  const s = swipe; swipe = null; if (!s || e.pointerId !== s.id || s.way !== "x") return;
  const dx = e.clientX - s.x; if (Math.abs(dx) < 40) return;
  swiped = performance.now(); showPhoto(s.stage, +s.stage.dataset.gal + (dx < 0 ? 1 : -1));
}, { passive: true });
document.addEventListener("pointercancel", () => { swipe = null; }, { passive: true });
// pinched in, the photo gives sideways panning back to the browser (styles.css: .pdp__tile.is-pinched)
if (window.visualViewport) visualViewport.addEventListener("resize", () => { const s = $("[data-stage][data-gal]"); if (s) s.classList.toggle("is-pinched", visualViewport.scale > 1.01); }, { passive: true });
// the tap at the end of a swipe never opens the zoom
document.addEventListener("click", e => { if (performance.now() - swiped < 450 && e.target.closest?.("[data-stage]")) { e.stopPropagation(); e.preventDefault(); } }, true);
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
  if (state.sheetMode === "local" && !localArea(d)) { sheetWords("nationwide"); state.sheetFell = true; return refuse(`${d.full} is past our local delivery area. We can ship it to you anywhere in Canada except Quebec.`); }
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
  if (el.matches?.("[data-stage] > .shot")) return "[data-stage] > .shot";   // the product photo (the zoom's button) and its gallery
  if (el.dataset?.galTo) return `[data-gal-to="${el.dataset.galTo}"]`;
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
        <div><dt>Items</dt><dd class="num">${money(t.subtotal / 100)}</dd></div>
        ${rewardRow(t.reward)}<div><dt>${pickup ? "Pickup" : local ? "Delivery" : "Shipping"}</dt><dd class="num">${pickup ? "Free" : local ? (t.fee === null ? "Enter your address" : feeText(t.shipping / 100)) : money(t.shipping / 100)}</dd></div>
        <div><dt>${taxLabel(t.prov)}</dt><dd class="num">${money(t.tax / 100)}</dd></div>
        <div class="totals__door"><dt>${local && t.fee === null ? "Total before delivery" : pickup && payWay(sc) === "at_pickup" ? "To pay at pickup" : "Total"}</dt><dd class="num">${money(t.total / 100)}</dd></div>
      </dl>`;
}
// what is asked for, one line per item, the way the confirmation lists it ("2 × name", colour under it, the line's price)
const coLines = lines => `<ul class="co__lines done__lines">${lines.map(({ product: p, qty }) => `<li><span><b class="num">${qty}</b> &times; ${esc(p.name)}${p.family && p.named && p.colour ? `<small class="co__col">${esc(p.colour)}</small>` : ""}</span><span class="num">${money(p.price * qty)}</span></li>`).join("")}</ul>`;
// the checkout's lines and totals change together (another tab's cart, a new price from the shop, points spent elsewhere)
function swapTotals(f, lines, sc) { const t = f.querySelector(".totals"), l = f.querySelector(".co__lines"); if (t) t.outerHTML = coTotals(lines, sc); if (l) l.outerHTML = coLines(lines); }
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
// The server says whether card payment is switched on, in a meta tag it writes on every page (CARD_ON, at the top).
// Shisha is paid at the counter until the card company approves it in writing (src/checkout.js, docs/PAYMENTS.md):
// a cart holding it is picked up and paid at the counter, and the page says so before the shopper taps anything.
const SHISHA_CARD = document.querySelector('meta[name="oss-shisha-card"]')?.content === "1";
const counterPay = p => !!p && (p.cat === "shisha" || !!p.details?.tobacco) && !SHISHA_CARD;   // the same rule as checkout.js tobacco()
const counterPayIn = lines => lines.filter(l => counterPay(l.product));
const payWay = sc => !sc.pickup ? "card" : !CARD_ON || counterPayIn(cartLines()).length ? "at_pickup" : state.pay === "at_pickup" ? "at_pickup" : "card";
const payLabel = (sc, total) => sc.local && deliveryFeeNow() === null ? "Check delivery price" : payWay(sc) === "card" ? `Pay ${money(total / 100)}` : "Send pickup request";   // paid at the counter: nothing is charged, so no total on the button
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
  // each field carries its own error line, shown under it (design review 2026-11-27: the phone's error sat ~700 px below the field)
  const field = (id, label, attrs, hint = "") => `<label class="field__label" for="co-${id}">${label}${hint ? ` <span class="fine">${hint}</span>` : ""}</label><input class="field" id="co-${id}" name="${id}" value="${esc(f[id] || "")}" ${attrs}><p class="field__err co__ferr" id="co-${id}-err" hidden></p>`;
  const atCounter = pickup && payWay(sc) === "at_pickup";
  return `
  ${band("checkout", "emerald", "Checkout", `<a href="/cart">Back to the cart</a>`)}
  <section class="cart checkout">
    <form class="co" data-checkout novalidate>
      <div class="co__main">
      ${unpaid}
      <fieldset class="co__set"><legend class="h3">Who it is for</legend>
        ${field("name", "Full name", 'autocomplete="name" maxlength="80" required')}
        ${field("email", "Email", 'type="email" autocomplete="email" inputmode="email" maxlength="120" required', !MAIL_ON ? "kept with your order" : local ? "for the receipt" : pickup ? "for the receipt and the ready-for-pickup note" : "for the receipt and tracking")}
        ${field("phone", "Phone", `type="tel" autocomplete="tel" inputmode="tel" maxlength="30"${local || phoneNeeded(sc) ? " required" : ""}`, local ? "so the driver can reach you" : phoneNeeded(sc) ? "we call or text you when it is ready" : "optional")}
      </fieldset>
      <div data-acct-co></div>
      ${pickup ? `<fieldset class="co__set"><legend class="h3">Pickup</legend><p class="co__p">At ${SHOP_ADDRESS}. ${atCounter ? `We check the shelf and ${TELL} when it is ready, ${READY_WHEN}. Please wait for ${TOLD} before you come in: nothing is set aside until then. ${REQ_LAPSE()}` : `We ${TELL} when it is ready, usually ${pickupDay() === "Today" ? "the same day" : "tomorrow"}.`} Bring the order number. ${directions()}</p></fieldset>`
        : `<fieldset class="co__set"><legend class="h3">Where it is going</legend>
        ${field("line1", "Street address", 'autocomplete="address-line1" maxlength="120" required')}
        ${field("city", "City or town", 'autocomplete="address-level2" maxlength="60" required')}
        ${state.dest.complete ? `<p class="co__p">Postal code <b class="num">${esc(state.dest.full)}</b>, ${esc(state.dest.prov)}. <button class="link" type="button" data-open-postal>Change</button></p>`
          : `<p class="co__p">We need the full postal code for the label. <button class="link" type="button" data-open-postal>Enter it</button></p>`}
        ${local ? `<p class="co__p">Local delivery from our Windsor shop. ${localEta()}. <a class="link" href="/cart">Change</a></p><p class="co__p">${freeNote(cartCents(lines))}</p><div class="co__p" role="status" data-deliv-msg>${quoted ? `Good news, we deliver to ${esc(state.dest.full)}.` : ""}</div><p class="fine">Address check by <a class="link" href="https://www.geoapify.com/" rel="noopener">Geoapify</a>. Map data from OpenStreetMap contributors.</p>`
          : `<p class="co__p">${chosen.carrier} ${chosen.service}, ${days(chosen.days)}. <a class="link" href="/cart">Change</a></p>`}</fieldset>`}
      ${sc.counter && !PICKUP_ONLY ? `<p class="co__p co__coal"><b class="line__pick">Pickup or local delivery only</b> ${lines.filter(l => localOnly(l.product)).map(l => esc(l.product.name)).join(", ")}</p>` : ""}
      ${payBlock(sc, shownTotals(lines, sc).total)}
      </div>
      <div class="co__sum">
      <h2 class="h3">${PICKUP_ONLY ? "Your pickup request" : "Your order"}</h2>
      ${coLines(lines)}
      ${coTotals(lines, sc)}
      <p class="field__err" role="alert" data-co-err hidden></p>
      <button class="btn btn--wide" type="submit" ${(!pickup && !state.dest.complete) || (!pickup && !CARD_ON) || (!pickup && counterPayIn(lines).length) ? "disabled" : ""}>${payLabel(sc, shownTotals(lines, sc).total)}</button>
      ${CARD_ON ? `<p class="fine" data-pay-fine ${payWay(sc) === "card" ? "" : "hidden"}>Payment is taken by Stripe. We never see your card number.</p>` : ""}
      </div>
    </form>
  </section>`;
}
// While the shop's mail is off, a pickup needs a phone so the shop can call or text when it is ready (the server insists for a
// pickup request; the page asks for any pickup, since no email can reach them either way).
const phoneNeeded = sc => !!sc.pickup && !MAIL_ON;
// The order's own words for how it hears back: the server says, per order, "email" or "call" (checkout.js follow), so a page kept
// from before mail was connected still says what really happens. Older saved orders without it follow the page's switch.
const byCall = o => (o.notify || (MAIL_ON ? "email" : "call")) === "call";
const callLine = o => o.phone ? `We call or text you at <b class="num">${esc(o.phone)}</b> when it is on the shelf.` : "";
const askLine = o => `${o.phone ? "Or call" : "Call"} <a class="link" href="tel:+15192552222">519-255-2222</a> with your order number, <b class="num">${esc(o.id)}</b>${o.phone ? "" : ", to ask when it is ready"}.`;
// the heading and one line say where the money stands; nothing says paid until the shop has Stripe's signed word
function payWords(o) {
  const p = o.pay || {}, first = esc(o.name.split(" ")[0]), closed = p.status === "expired" || p.status === "failed";
  return {
    head: closed ? "This payment did not go through." : p.method === "card" && p.status !== "paid" ? `One moment, ${first}.` : `Thank you, ${first}.`,
    lead: closed ? `Nothing was charged. <a class="link" href="/cart">Your cart</a> is still here.`
      : p.method === "at_pickup" && byCall(o) ? `This is an order request. We check the shelf first. ${callLine(o)} ${askLine(o)} Please wait for our call before you come in: nothing is set aside until then. You pay at the counter.`
      : p.method === "at_pickup" ? `This is an order request. We check the shelf and email ${esc(o.email)} when it is ready. Please wait for that email before you come in: nothing is set aside until then. You pay at the counter.`
      : p.status === "paid" && byCall(o) ? `Paid. ${o.method === "pickup" ? `${callLine(o)} ${askLine(o)}` : o.service === "Local delivery" ? "Our driver calls before coming." : `For tracking, call <a class="link" href="tel:+15192552222">519-255-2222</a> with your order number, <b class="num">${esc(o.id)}</b>.`}`
      : p.status === "paid" ? `Paid. Your receipt is on its way to ${esc(o.email)}. ${o.method === "pickup" ? "We email you again when it is ready." : o.service === "Local delivery" ? "Our driver calls before coming." : "The tracking number follows when it ships."}`
      : p.slow ? (byCall(o) ? `Your payment is still being confirmed. This page shows it as soon as it is. ${askLine(o)}` : `Your payment is still being confirmed. The receipt comes to ${esc(o.email)} as soon as it is.`)
      : "Confirming your payment. This page updates by itself.",
    door: p.status === "paid" ? "Paid" : p.method === "at_pickup" ? "To pay at pickup" : "Total",
  };
}
// ---------- the customer's own order status page: /order/<id>?k=<key> (2026-11-27) ----------
// The link is shown on the confirmation page. The key is checked by the shop (src/checkout.js orderStatus), which answers only the
// first name, what was asked for and where it stands. The page draws a holding line, then fills in once the answer is back.
const STATUS = {
  requested: (s, call) => [`We have your request, ${esc(s.first)}.`, `We check the shelf and ${call ? "call or text you" : "email you"} when it is ready. Please wait for ${call ? "our call" : "that email"} before you come in: nothing is set aside until then.${s.pay_at_counter ? " You pay at the counter." : ""}`],
  payment: s => ["Waiting for the card payment.", "Nothing is ready yet. If you closed the payment page, nothing was charged."],
  preparing: s => [`We are getting it ready, ${esc(s.first)}.`, s.method === "pickup" ? "It is paid. We tell you when it is on the counter." : "It is paid. We tell you when it leaves the shop."],
  ready: s => ["It is ready for pickup.", `It is waiting at ${SHOP_ADDRESS}${s.held_until ? `, held until ${esc(new Date(s.held_until).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" }))}` : ""}. Bring your order number.${s.pay_at_counter ? " You pay at the counter." : ""} ${directions()}`],
  shipped: s => [s.local ? "It is out for delivery." : "It is on its way.", s.local ? "Our driver calls before coming." : "It left our Windsor shop."],
  collected: s => [`Picked up. Thank you, ${esc(s.first)}.`, "We hope you enjoy it."],
  cancelled: s => ["This order is cancelled.", "Nothing is held for it. To order again, visit the shop or call the counter."],
};
const STATUS_TAG = { requested: "Requested", payment: "Waiting for payment", preparing: "Being prepared", ready: "Ready for pickup", shipped: "On its way", collected: "Collected", cancelled: "Cancelled" };
function statusHtml(id, s) {
  if (s && s.unreachable) return `<section class="cart done" data-status-page><p class="done__tag"><span>Order</span> <b class="num">${esc(id)}</b></p><h1 class="h2 h2--xl">We could not reach the shop.</h1><p class="lead" role="status">Check your connection and reload this page, or call the counter at <a class="link" href="tel:+15192552222">519-255-2222</a> with your order number.</p></section>`;
  // drawn in place of the holding line, inside the same page: no new band, so nothing else on the page starts again
  if (!s) return `<section class="cart done" data-status-page data-status="missing"><p class="done__tag"><span>Order</span> <b class="num">${esc(id)}</b></p><h1 class="h2 h2--xl">We cannot find that order.</h1><p class="lead">Check the link, or call the counter at <a class="link" href="tel:+15192552222">519-255-2222</a> with your order number.</p><p class="lead"><a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
  const [head, lead] = (STATUS[s.status] || STATUS.requested)(s, s.notify === "call");
  return `<section class="cart done" data-status-page data-status="${esc(s.status)}">
    <p class="done__tag"><span>Order</span> <b class="num">${esc(id)}</b> <span data-status-tag>${esc(STATUS_TAG[s.status] || "")}</span></p>
    <h1 class="h2 h2--xl">${head}</h1>
    <p class="lead" role="status" aria-live="polite">${lead}</p>
    <ul class="done__lines">${s.items.map(i => `<li><span><b class="num">${i.qty}</b> &times; ${esc(i.name)}</span></li>`).join("")}</ul>
    ${Number.isInteger(s.total_cents) ? `<dl class="totals"><div class="totals__door"><dt>${s.pay_at_counter && !["collected", "cancelled"].includes(s.status) ? "To pay at pickup" : "Total"}</dt><dd class="num">${money(s.total_cents / 100)}</dd></div></dl>` : ""}
    ${s.method === "pickup" && !["cancelled", "collected"].includes(s.status) ? `<p class="fine">${s.status === "ready" ? `${SHOP_OPEN}.` : pickupWhere()}</p>` : ""}
    <p class="fine">Questions? Call the counter at <a class="link" href="tel:+15192552222">519-255-2222</a> with your order number.</p>
    <a class="btn btn--wide" href="/shop">Keep looking</a>
  </section>`;
}
function viewStatus(id, k) {
  const got = state.orderStatus;
  if (got && got.id === id && got.k === k && Date.now() - got.at < 60000) return statusHtml(id, got.s);   // a redraw right after the answer; never an old one
  (async () => {
    let s = null, lost = true; try { const r = await fetch(`/api/order-status?id=${encodeURIComponent(id)}&k=${encodeURIComponent(k)}`, { cache: "no-store" }); if (r.ok) { s = (await r.json()).order || null; lost = !s; } else lost = r.status !== 404; } catch {}
    if (lost) s = { unreachable: true };   // a dropped connection or a busy shop is never "no such order", and is not kept
    else state.orderStatus = { id, k, s, at: Date.now() };
    for (let i = 0; i < 60; i++) {   // the page may still be drawing (a page swap): wait for it, unless the shopper has moved on
      if (location.pathname.replace(/\/+$/, "") !== "/order/" + id) return;
      const box = document.querySelector("[data-status-page]");
      if (box) { box.outerHTML = statusHtml(id, s); return; }
      await new Promise(r => requestAnimationFrame(r));
    }
  })();
  return `<section class="cart done" data-status-page><p class="done__tag"><span>Order</span> <b class="num">${esc(id)}</b></p><h1 class="h2 h2--xl">Looking up your order.</h1><p class="lead" role="status" aria-live="polite">One moment.</p></section>`;
}
function viewOrder(id) {
  const k = new URLSearchParams(location.search).get("k");
  if (k && /^[a-f0-9]{32}$/.test(k)) return viewStatus(id, k);
  let o = null; try { o = JSON.parse(sessionStorage.getItem("oss:order:" + id)); } catch { o = null; }
  if (!o) return `${band("missing", "ruby", "We cannot show that order.")}<section class="empty"><p class="lead">This order opens from its private link. Lost it? Call <a class="link" href="tel:+15192552222">519-255-2222</a> with your order number.</p><p class="lead"><a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
  const c = n => money(n / 100), p = o.pay || {}, first = esc(o.name.split(" ")[0]);
  if (p.method === "card" && p.status === "awaiting" && p.session && !p.slow) watchPayment(o);
  const { head, lead, door } = payWords(o);
  const link = o.status_url && /^\/order\/W[A-Z0-9]{6}\?k=[a-f0-9]{32}$/.test(o.status_url) ? o.status_url : "";
  // the private link is the way back to this order from any phone or computer, so it gets buttons beside the order sticker
  // (design review 2026-11-27: with mail off nothing else carries it, and a small grey link was easy to lose)
  const keep = link ? `<div class="keeplink"><button class="btn btn--ghost keeplink__b" type="button" data-copy-link>Copy link</button>${typeof navigator.share === "function" ? `<button class="btn btn--ghost keeplink__b" type="button" data-share-link>Share</button>` : ""}</div>` : "";
  return `
  <section class="cart done">
    <div class="done__head"><p class="done__tag"><span>Order</span> <b class="num">${esc(o.id)}</b></p>${keep}</div>
    <h1 class="h2 h2--xl" data-pay-head>${head}</h1>
    <p class="lead" role="status" aria-live="polite" data-pay-state="${esc(p.status || "")}">${lead}</p>
    ${link ? `<p class="fine" data-status-link data-link="${esc(link)}">See where it stands any time on <a class="link" href="${esc(link)}">your order's private page</a>. It opens on any phone or computer. <span class="sr" role="status" aria-live="polite" data-copy-said></span></p>` : ""}
    ${o.method === "pickup" && p.method === "at_pickup" ? `<p class="fine">Usually ready the same or the next day. ${REQ_LAPSE()}</p>` : ""}
    <p class="fine">${o.method === "pickup" ? pickupWhere() : o.service === "Local delivery" ? `Local delivery.${o.eta ? " " + esc(o.eta) + "." : ""}` : `${esc(o.service)}.`}</p>
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
// Copy link / Share on the confirmation: the full address of the order's private page. Copy falls back to a hidden text box when
// the clipboard API is missing or refused; if that fails too, the link is selected on screen to copy by hand. Says what happened.
let copySaidT = 0;
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-copy-link],[data-share-link]"); if (!b) return;
  const box = document.querySelector("[data-status-link]"), said = box && box.querySelector("[data-copy-said]"); if (!box) return;
  const url = new URL(box.dataset.link, location.origin).href;
  if (b.hasAttribute("data-share-link")) { try { await navigator.share({ title: "One Stop Shop order", url }); } catch {} return; }   // a closed share sheet is not an error
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch {}
  if (!ok) try { const t = document.createElement("textarea"); t.value = url; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.append(t); t.select(); ok = document.execCommand("copy"); t.remove(); } catch {}
  if (!ok) { const a = box.querySelector("a"); if (a) { const r = document.createRange(); r.selectNodeContents(a); getSelection().removeAllRanges(); getSelection().addRange(r); } }
  b.textContent = ok ? "Link copied" : "Copy link"; if (said) said.textContent = ok ? "Link copied." : "Select the link to copy it.";
  clearTimeout(copySaidT); copySaidT = setTimeout(() => { if (b.isConnected) b.textContent = "Copy link"; }, 2600);
});
document.addEventListener("change", e => {   // the choice changes the button and the small print in place; the form is never rebuilt
  const f = e.target.name === "pay" && e.target.closest("[data-checkout]"); if (!f) return;
  state.pay = e.target.value; const lines = cartLines(), sc = shipChoice(lines);
  swapTotals(f, lines, sc); f.querySelector('button[type="submit"]').textContent = payLabel(sc, shownTotals(lines, sc).total); f.querySelector("[data-pay-fine]").hidden = payWay(sc) !== "card";
});
// a field's own error goes as soon as it is being put right
function clearFieldErrs(f, only) { for (const el of f.querySelectorAll("input[aria-invalid]")) { if (only && el !== only) continue; el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); const own = f.querySelector(`#co-${el.name}-err`); if (own) own.hidden = true; } }
document.addEventListener("input", e => { const f = e.target.closest("[data-checkout]"); if (f && e.target.name && e.target.hasAttribute("aria-invalid")) clearFieldErrs(f, e.target); });
document.addEventListener("input", e => { const f = e.target.closest("[data-checkout]"); if (f && e.target.name) { state.form = state.form || {}; state.form[e.target.name] = e.target.value; if ((e.target.name === "line1" || e.target.name === "city") && f.querySelector("[data-deliv-msg]")) refreshDelivery(f); } });
function refreshDelivery(f, msg) {
  const lines = cartLines(), sc = shipChoice(lines), quoted = deliveryFeeNow() !== null, box = f.querySelector("[data-deliv-msg]"), btn = f.querySelector('button[type="submit"]');
  swapTotals(f, lines, sc);
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
  // a field's error shows under that field, which is marked invalid and brought into view with the focus; anything else above the button
  const fail = (msg, field) => {
    clearFieldErrs(f); err.hidden = true;
    const el = field && f.querySelector(`input[name="${field}"]`), own = el && f.querySelector(`#co-${field}-err`);
    if (!own) { err.textContent = msg; err.hidden = false; if (el) el.focus(); return; }
    own.textContent = msg; own.hidden = false; el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", own.id);
    el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const v = n => (f.elements[n] ? f.elements[n].value.trim() : "");
  if (!pickup && !local && !chosen && !state.ship && (sc.status === "far" || sc.status === "down")) return fail("Delivery is not available here. Choose shipping or pickup in your cart.");
  if (sc.counter && chosen) return fail("Charcoal goes by pickup or local delivery only. Choose one in your cart.");
  // every field is checked and every error shows under its own field (aria-invalid + aria-describedby); the focus goes to the first
  const bad = [];
  if (!v("name")) bad.push(["name", "Tell us the name for the order."]);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email"))) bad.push(["email", "That email address does not look right."]);
  if (phoneNeeded(sc)) {   // the server's own rule (src/guard.js callable): a North American number the shop can call back
    const d = v("phone").replace(/\s*(?:x|ext\.?)\s*\d{1,6}\s*$/i, "").replace(/\D/g, "").replace(/^(?:011|00)/, "").replace(/^1(?=\d{10}$)/, "");
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d) || /^(\d)\1{9}$/.test(d)) bad.push(["phone", "Enter a phone number with its area code, like 519-555-0144. We call or text you when your order is ready."]);
  } else if (local && v("phone").replace(/\D/g, "").length < 10) bad.push(["phone", "Enter a phone number so the driver can reach you."]);
  if (!pickup && !v("line1")) bad.push(["line1", "Enter the street address."]);
  if (!pickup && !v("city")) bad.push(["city", "Enter the city or town."]);
  if (bad.length) {
    clearFieldErrs(f); err.hidden = true; let first = null;
    for (const [field, msg] of bad) {
      const el = f.querySelector(`input[name="${field}"]`), own = f.querySelector(`#co-${field}-err`); if (!el || !own) continue;
      own.textContent = msg; own.hidden = false; el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", own.id); first = first || el;
    }
    if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
    else return fail(bad[0][1]);
    return;
  }
  if (local) {
    state.form = { ...(state.form || {}), line1: v("line1"), city: v("city") }; err.hidden = true;
    if (deliveryFeeNow() === null) return checkDelivery(f, btn);   // show the price first: the next tap places the order
  }
  const pay = payWay(sc), label = payLabel(sc, +f.querySelector(".totals").dataset.total);
  btn.disabled = true; btn.textContent = pay === "card" ? "Opening secure payment" : "Sending your request"; err.hidden = true; clearFieldErrs(f);
  const sent = cartLines(), sig = orderSig(sent, sc), shownTotal = +f.querySelector(".totals").dataset.total;   // the figure on the screen, not a fresh sum: if the rate moved since, the server says so
  try {
    const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_key: orderKey(sig + pay + v("email").toLowerCase()), expected_total_cents: shownTotal, use_reward: rewardCents(cartCents(sent)) > 0, lines: state.cart, method: pickup ? "pickup" : "ship", service: local ? "local" : chosen && chosen.id, delivery_fee_cents: local ? Math.round(deliveryFeeNow() * 100) : undefined, postal: state.dest && state.dest.full,
      name: v("name"), email: v("email"), phone: v("phone"), note: state.note, address: { line1: v("line1"), city: v("city") }, pay, source: visitSource() }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { btn.disabled = false; btn.textContent = label; if (local && data.delivery) { if (data.delivery === "far") state.farFor = state.dest.full; state.delivery = data.delivery === "ok" ? { key: deliveryKey(), fee_cents: data.base_fee_cents ?? data.fee_cents, due: data.fee_cents, sub: cartCents() } : null; state.refused = data.delivery === "ok" ? null : deliveryKey(); refreshDelivery(f, data.delivery === "ok" ? undefined : deliveryMsg(data.delivery)); if (data.delivery !== "ok") return; } 
      if (data.local_only) { state.cartNews = [data.error]; state.ship = null; store.set("ship", null); navigate("/cart"); return; }   // an out-of-date page offered a carrier: back to the cart, where the real choices are
      if (data.reward_gone) { rewardGone(); state.priced = null; swapTotals(f, sent, sc); btn.textContent = payLabel(sc, +f.querySelector(".totals").dataset.total); return fail(data.error); }   // the points were spent elsewhere: the full price is shown before anything is placed
      if (data.repriced) { state.priced = { sig, ...data.repriced }; swapTotals(f, sent, sc); btn.textContent = payLabel(sc, data.repriced.total_cents); }
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
const doc = (title, lead, parts, tag = DRAFT) => `${band("docs", "bone", title, lead)}<section class="cart doc">${tag}${parts.map(([h, body]) => `<h2 class="h3">${h}</h2>${body.map(t => `<p>${t}</p>`).join("")}`).join("")}</section>`;
// Privacy: checked line by line against the code on 2026-11-26 (research and sources: inventory-2026-11-24-next/PRIVACY-RESEARCH-2026-11-26.md).
// Change this page whenever what the shop collects, keeps or shares changes. No draft tag: the owner asked for it to go.
const viewPrivacy = () => doc("Privacy", "What we collect, why, who else handles it, and how to ask about it. Updated November 27, 2026.", [
  ["Who we are", [`One Stop Shop, 760 Wyandotte St E, Windsor, ON N9A 3J4. This page covers our online shop: this website, the emails it sends and the orders placed on it. ${PICKUP_ONLY ? "For now we sell for pickup in Windsor, paid at the counter. Local delivery and shipping within Canada, except Quebec, open once we take card payment online." : "We sell for pickup in Windsor, local delivery and shipping within Canada, except Quebec for now."} We follow Canada's privacy law for businesses (PIPEDA) and Canada's anti-spam law (CASL).`]],
  ["What we collect and why", [
    `When you order: your name, your email, your phone number (${MAIL_ON ? "needed for local delivery so the driver can reach you, otherwise up to you" : "needed for local delivery so the driver can reach you, and for now for pickup requests, so we can call or text you when your order is ready"}), the delivery address if we deliver or ship it, and any note you add. We also keep what you bought, what you paid and how you chose to get it. We use these to fill your order, ${MAIL_ON ? "email" : "call or text"} you about it and answer your questions.`,
    "When you pay by card: you type your card details on Stripe's payment page, not ours. We never see or store your card number. Stripe tells us only whether the payment went through.",
    "When you check delivery: the postal code you enter, and for local delivery your street address, are used to work out whether we deliver to you and what it costs.",
    "To stop abuse, when you place an order we keep a coded form of your internet address, scrambled with a secret key so it cannot be turned back into the address, only to limit how many orders and open pickup requests can come from one place. For orders it is deleted after 30 days. When you ask for a sign-in code we keep a coded form of your internet address and of your email, made the same way with a secret key so it cannot be turned back, only to count codes asked for and wrong codes typed, and delete them after a day.",
    "We collect only what we need for these jobs. We do not use your details for anything else unless you agree first.",
  ]],
  ["How you found us", ["When you place an order, we save with it where your first visit in the last 30 days came from: a short code from our business card or a link we posted, the name of the site that sent you (like Google or Instagram), and the first page you opened. It stays on your device until you order. We use it only to count which of our cards, posts and listings bring orders. It is not used to follow you around the web, and we never share it."]],
  ["Cookies and storage on your device", [
    "We use no advertising, analytics or social media trackers, and no other company's scripts run on our pages. We use four small cookies, each needed for the site to work:",
    "oss_c keeps you signed in to your account, for up to 30 days. You only get it if you sign in.",
    "oss-ask holds a single yes or no: whether the shop pages should still ask how you want your order, so they open the right way. It holds no answer, postal code, address or name, and lasts a year.",
    "oss_admin is for shop staff only. It keeps them signed in to the back office for up to 12 hours.",
    "oss_dev is for shop staff only. It marks a shop phone or computer that has signed in to the back office before, for up to 400 days, so a stranger's wrong guesses never lock staff out. It holds a random number, no name.",
    "Your browser also keeps a few things on your device: your cart, the postal code you entered, how you want your order (pickup, delivery or shipping), your order note, where your first visit came from, and a few settings for how the site behaves, like a note you closed or an animation you have already seen. They are sent to us only when you use them: the postal code when you check delivery, the rest when you place an order. While you check out, what you typed, and then your order's details for its confirmation page, are kept until you close the tab, so they are still there if you come back from the payment page. You can clear all of this in your browser's settings. The shop still works, but your cart will be empty.",
    "Like any web host, Cloudflare, which runs this site, sees your internet address and the pages you ask for, to deliver them and protect the site from attacks.",
  ]],
  ["Who else handles your details", [
    "Our staff and driver see your order to get it ready and deliver it. If we ship it, the carrier gets the name, address and details needed on the label. The shop's email inbox gets a note of each new order with your name, phone, email and address, so the counter can get it ready.",
    "Stripe takes card payments and refunds. It gets your email, what you are buying and the amount, plus the card and billing details you type on its page. Stripe also uses payment details to prevent fraud, under its own privacy policy.",
    "Resend sends our emails. It gets your email address and what each email says.",
    "Geoapify, our map service, gets the postal code you enter near Windsor and, for local delivery, your street address, to work out the road distance from our shop. It does not get your name.",
    "Cloudflare hosts the site and stores the shop's records and backups for us. The company that builds and looks after this site for us can reach these records only to keep the shop running.",
    "We share only what each one needs for its job. We do not sell, rent or trade your details. We would give them to police or a court only when the law requires it.",
    "Where it is handled: Stripe, Resend and Cloudflare are based in the United States, and Geoapify in Germany. So your details may be stored or handled outside Canada, and can be reached by the courts and authorities of those countries. We stay responsible for your details while they do this work for us.",
  ]],
  ["If you make an account", [
    `An account is up to you. Guest checkout always works.${MAIL_ON ? "" : " Accounts open once our email is switched on."} You sign in with a 6-digit code we email you, which works once, for 10 minutes. We keep your email, the name, phone and address you choose to save, your saved items, your back-in-stock requests, your charcoal reminder choice and any points, so they are there next time. Orders you placed as a guest with the same email join your account when you sign in.`,
    "You can delete the account yourself on the account page at any time. That removes your sign-ins, saved details, saved items, back-in-stock requests, reminder and points at once. Your past orders stay in our records as guest orders, because tax law requires us to keep sales records. The record of any yes you gave to reminders also stays, as proof of what you agreed to.",
  ]],
  ["Emails we send", [
    ...(MAIL_ON ? [] : ["For now our email is not switched on, so we send no emails at all and accounts cannot be opened yet. We call or text the phone number on your order instead. What follows is what we will send once it is on."]),
    "Emails about your order: that it is in or paid, that it is ready, or that it is on its way. These are part of your order, not marketing. Sign-in codes when you ask for one.",
    "A back-in-stock email only when you ask for one: one email, then the request is gone. A charcoal reminder only when you tick the box to say yes, as often as you choose. We keep the words you agreed to and the date, because the law asks us to be able to show your consent.",
    "Every reminder and back-in-stock email names the shop with its address and phone and has an unsubscribe link. It works without signing in and takes effect at once (the law allows up to 10 business days). You can also turn reminders off in your account. We do not send newsletters.",
  ]],
  ["How long we keep it", [
    "Orders, including ones that were cancelled or never paid, and copies of the emails we sent about them: we keep these with the shop's sales records, which tax law requires us to keep for six years.",
    "Your account: until you delete it. Sign-in sessions end after 30 days, or when you sign out. Our copy of a sign-in email is wiped soon after it is sent, used or expires.",
    "Back-in-stock requests: until the email goes out or you remove the request. Copies of the reminder and back-in-stock emails we sent, and the record of your yes to reminders, are kept as proof of what we sent and what you agreed to.",
    "Backups: the shop's records are copied every night, and only the last 30 nightly copies are kept.",
    "On your device: until you clear it. The note of how you found us counts only for 30 days.",
  ]],
  ["Keeping it safe", ["The shop's records are behind a sign-in: each staff member has their own, and the owner has a passcode. Every change is logged with who made it. Sign-in cookies are kept on our side only in scrambled form, sign-in codes are checked against a scrambled copy, and everything you send us travels over an encrypted connection. If a breach of our safeguards could put you at real risk of significant harm, we will tell you and the Privacy Commissioner of Canada as soon as we can. We keep a record of every breach."]],
  ["Your choices and rights", [
    "See it: you can ask what personal information we hold about you, how we have used it and who we have given it to, and get a copy. Ask in writing: reply to any email we sent you, write to us, or ask at the counter. We answer within 30 days, free. If we need longer, we tell you why within those 30 days.",
    "Correct it: if something is wrong, tell us and we will fix it. You can change your saved details yourself in your account.",
    "Change your mind: turn off reminders or unsubscribe at any time, remove back-in-stock requests, or delete your account.",
    "Delete it: ask us to delete what we hold about you. We delete everything the law does not require us to keep, and tell you what we kept and why.",
    "We may ask you to confirm it is you first, for example by writing from the email on your order.",
  ]],
  ["Who to ask", ["The store manager is responsible for privacy at One Stop Shop. Call 519-255-2222, reply to any email we sent you, or write to or visit the store manager at One Stop Shop, 760 Wyandotte St E, Windsor, ON N9A 3J4. If you are not happy with our answer, you can complain to the Office of the Privacy Commissioner of Canada at <a class=\"link\" href=\"https://www.priv.gc.ca/en/\">priv.gc.ca</a> or 1-800-282-1376."]],
  ["Changes to this page", ["If we change how we handle your details, we update this page and its date. If we want to use details we already hold for a new purpose, we ask you first. Updated November 27, 2026."]],
], "");
const viewTerms = () => doc("Terms of sale", "The plain rules for buying from us online.", [
  ["Who you are buying from", [`One Stop Shop, 760 Wyandotte St E, Windsor, ON N9A 3J4. Call 519-255-2222. Legal business name ${TBD("")}.`]],
  ["Prices and tax", [`Prices are in Canadian dollars. ${PICKUP_ONLY ? "Tax is added at checkout. For now every order is picked up at our Windsor counter, so Ontario's 13% HST applies. Before you send a pickup request, checkout shows each item's price, the tax and the total, and you can go back and change anything. You pay at the counter when you pick it up." : "Tax is added at checkout, based on the province the order ships to. Before you pay, checkout shows each item's price, delivery or shipping, tax and the total, and you can go back and change anything."} ${MAIL_ON ? "We email you a copy of your order." : "The confirmation page shows your order number and what you asked for."}`]],
  ...(PICKUP_ONLY ? [["For now", ["Online orders are picked up at 760 Wyandotte St E and paid at the counter. Local delivery and shipping open once we take card payment online; the rules for them are below."]]] : []),
  [PICKUP_ONLY ? "Shipping, once card payment opens" : "Shipping", ["We ship within Canada, except to Quebec for now: the site is in English only, and we will ship there once it is also in French. Anyone can pick up in Windsor. The price at checkout is the price you pay for shipping. Delivery times are the carrier's estimates. Cologne ships by ground only."]],
  [PICKUP_ONLY ? "Local delivery, once card payment opens" : "Local delivery", ["We deliver within 25 km by road of our Windsor shop: $10 up to 10 km and $15 from there to 25 km, per order, plus tax. Orders with $200 or more in items before tax deliver free. Arrival times are estimates. Local delivery is paid online when you order."]],
  ["Pickup", [`Pickup at 760 Wyandotte St E, Windsor, ON N9A 3J4 is free. An order you pay for at the counter is a request: we check the shelf and ${TELL} when it is ready, and nothing is set aside before ${TOLD}, so please wait for it before you come in. From then we hold it for 14 days. A request we have not confirmed is cancelled after ${REQ_SPAN}.`]],
  ["Charcoal", [`Charcoal is sold for pickup${PICKUP_ONLY ? "" : " or local delivery"} only. It is not shipped by Canada Post or any other carrier.`]],
  ["Returns", ["All sales are final, except faulty, wrong, damaged or undelivered items. We do not take back an item because you changed your mind."]],
  ["Faulty, wrong or damaged", ["If an item is faulty, is not what you ordered, or arrives broken, call 519-255-2222 or bring it to 760 Wyandotte St E and talk to the store manager. We will repair it, replace it or refund it. Nothing here takes away your rights under Ontario's Consumer Protection Act."]],
  ["If it does not arrive", ["If we do not deliver within 30 days of the delivery date we gave you (or of your order, if we gave none), you can cancel for a full refund. We refund within 15 days of your cancelling, to the way you paid."]],
]);
const viewMissing = () => `${band("missing", "ruby", "Nothing at this address.")}<section class="empty"><p class="lead">The link may be old. <a class="link" href="/shop">See what is on the counter</a>.</p></section>`;
const SITE = "One Stop Shop", HOME_TITLE = document.title, PLAIN = { account: "Your account", cart: "Cart", shipping: "Shipping and returns", set: "Build a set", search: "Search", privacy: "Privacy", terms: "Terms of sale", checkout: "Checkout" };
// The same addresses the server answers. Anything else is the missing page, never a page that merely looks right.
function realPage(a, b, more) {
  if (more) return false; if (!a) return true;
  if (a === "shop") return !b || !!catById[b]; if (a === "p") return !!b;
  if (a === "order") return !!b && /^W[A-Z0-9]{6}$/.test(b);
  return !b && Object.hasOwn(PLAIN, a);
}
function pageTitle(a, b, real) {
  if (!real || (a === "p" && !bySku[b])) return `Page not found | ${SITE}`; if (!a) return HOME_TITLE;
  const name = a === "shop" ? (b ? catById[b].name : "Shop") : a === "p" ? bySku[b].name : a === "order" ? `Order ${b}` : PLAIN[a];
  return `${name} | ${SITE}`;
}
// the section you are in sits centred in the chip row. Reading its place lays the page out, so at a wave's swap it is read in the
// frame after (route.js afterSwap), still under the wave's cover, once that layout is done anyway
// the row starts on the page gutter like the Filter row under it; it only scrolls when the chosen chip would be cut off (design review, 2026-11-26)
const centreChip = afterSwap(() => { const chip = $(".chips [aria-current]"); if (!chip) return; const row = chip.parentNode, pad = parseFloat(getComputedStyle(row).paddingRight) || 0;
  row.scrollLeft = chip.offsetLeft + chip.offsetWidth <= row.clientWidth - pad ? 0 : chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2; });
// The first draw of a cold load: the Worker has already painted the section band (band.js). When the page's band is the same
// node for node, the server's stays in place and only what is around it is swapped, so the band never blinks, moves or redraws.
let served = true;
function putMain(html) {
  const main = $("#main"), old = served && main.querySelector(":scope > .shophead"); served = false;
  if (old) {
    const t = document.createElement("template"); t.innerHTML = html;
    const kids = [...t.content.childNodes], at = kids.findIndex(n => n.nodeType === 1);
    if (at >= 0 && kids[at].isEqualNode(old)) {
      for (const n of [...main.childNodes]) if (n !== old) n.remove();
      old.before(...kids.slice(0, at)); old.after(...kids.slice(at + 1)); return;
    }
  }
  main.innerHTML = html;
}
function render({ chunk = false } = {}) {
  const keep = focusKey(document.activeElement);
  const [a, b, more] = route().replace(/^#\/?/, "").split("/").filter(Boolean), real = realPage(a, b, more);
  if (a === "search") state.q = new URLSearchParams(location.search).get("q") ?? state.q;
  document.title = pageTitle(a, b, real);
  // a long section reached by a tap: the page now, its cards in the tasks after. Short sections draw whole, as before (the Misc
  // act stamps the labels already on its first screen at the swap, so its cards must be there).
  queue = chunk && real && a === "shop" && (b ? SHELF.filter(p => p.cat === b).length : SHELF.length) > 24 ? { q: [], first: firstScreen(), wide: innerWidth >= 960 } : null;   // the window's size read before the page changes, so reading it forces no layout
  // Home reached by a tap: the hero is the first screen; the section tiles and the counter picks below it come in the frames
  // after the swap (wave-perf 2x, 2026-11-26: Home's build, style and layout took 55-70 ms inside the swap)
  // (wide: the tiles, a part, are drawn before the cards and still under the wave's cover, so nothing pops in on screen)
  if (chunk && real && !a && navInfo().cause === "wave") queue = { q: [], first: 1, wide: true };   // only under a wave: a crossfade to Home draws it whole
  let html, q; try { html = !real ? viewMissing() : a === "shop" ? viewShop(b) : a === "p" ? viewProduct(b) : a === "cart" ? viewCart() : a === "shipping" ? viewShipping() : a === "set" ? viewSet() : a === "search" ? viewSearch() : a === "privacy" ? viewPrivacy() : a === "terms" ? viewTerms() : a === "checkout" ? viewCheckout() : a === "order" ? viewOrder(b) : a === "account" ? accountView(band) : !a ? viewHome() : viewMissing(); } finally { q = queue; queue = null; }
  putMain(html); laterStart(q);
  document.body.dataset.route = a || "home";
  syncChrome();
  centreChip();
  if (keep) { const el = document.querySelector(keep); if (el) { if (el.matches(".shot") && !el.hasAttribute("tabindex")) el.tabIndex = 0; el.focus({ preventScroll: true }); } }   // the photo: fx-zoom.js arms it a moment later
  priceLocal();
  preloadColours();
  galInit();
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
  const saved = store.get("cart"), fit = fitCart(cleanCart(saved)), gone = goneNote(saved); state.cart = fit.kept; if (fit.news.length || gone) state.cartNews = [...fit.news, ...(gone ? [gone] : [])]; if (gone) store.set("cart", state.cart);
  const on = route().replace(/^#\/?/, "").split("/")[0], f = $("[data-checkout]"), lines = cartLines();
  if (f && lines.length) { const sc = shipChoice(lines); if (sc.pickup || sc.local || sc.chosen) { swapTotals(f, lines, sc); syncChrome(); return; } }   // never rebuild a form someone is typing in
  if (["cart", "checkout", "p"].includes(on)) render(); else syncChrome();
}
// The account changed the cart (Buy again), or signed in, or the points reward was switched at checkout.
addEventListener("oss:cart", e => {   // Buy again: the usual's pickup choice comes along, and the cart says what was left off
  if (store.get("ship") === "pickup") state.ship = "pickup";
  cartFromStorage(); if (e.detail && e.detail.news) state.cartNews = e.detail.news;
});
const refreshCo = () => { const f = $("[data-checkout]"), lines = cartLines(); if (!f || !lines.length) return; const sc = shipChoice(lines); if (sc.pickup || sc.local || sc.chosen) swapTotals(f, lines, sc); };
addEventListener("oss:account", refreshCo); addEventListener("oss:totals", refreshCo);
addEventListener("storage", e => { if (e.key === null || e.key === "oss:cart") cartFromStorage(); });
addEventListener("pageshow", e => { if (e.persisted) cartFromStorage(); });
// Long lists skip drawing what is off screen, so their height is a guess until they are drawn: draw it all for one frame to land exactly.
setSpotAnchor(() => { for (const a of $$("#main [data-piece]")) { const r = a.getBoundingClientRect(); if (r.bottom > 80) return { sku: a.dataset.piece, top: Math.round(r.top) }; } return null; });
function putScroll(spot) {
  const y = typeof spot === "number" ? spot : spot.y || 0, root = document.documentElement, land = () => { scrollTo(0, y); const a = spot.sku && document.querySelector(`#main [data-piece="${spot.sku}"]`); if (a) scrollBy(0, a.getBoundingClientRect().top - spot.top); };
  drawThrough(spot.sku); root.classList.add("restoring"); land();
  // cards off screen fall back to a guessed height once drawing stops (WebKit keeps no remembered size): the guess is set to a real card's
  // height first, so leaving the restoring state cannot move the page
  // The restoring state is kept through one painted frame, so Chromium records each card's real size (contain-intrinsic-size
  // auto) before the off-screen cards fall back to a guess: cards of mixed heights (two-line names, the shop's hookahs
  // 2026-11-27) would otherwise each take the first card's height and move the page. Landed once more after it lifts.
  requestAnimationFrame(() => { land(); const c = document.querySelector("#main .grid--shop .card"); if (c && c.offsetHeight) root.style.setProperty("--card-h", c.offsetHeight + "px");
    requestAnimationFrame(() => { root.classList.remove("restoring"); land(); }); });
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
  if (navInfo().cause === "wave" && ((ra === "shop" && (rb ? SHELF.filter(p => p.cat === rb).length : SHELF.length) > 24) || !ra)) {   // Home too: its tiles come in under the held cover
    const root = document.documentElement; root.dataset.swapping = "";
    // data-swapping stays on until the first screen's cards are in (laterStart clears it); with no chunked draw after all it is
    // cleared here, and a timer makes sure the wave is never held longer than 400 ms whatever happens
    soon(() => { try { if (route() !== last) go(); } finally { if (!pending) delete root.dataset.swapping; } });
    setTimeout(() => delete root.dataset.swapping, 1500);
    return;
  }
  // a wave is already covering the change. A transition the browser cuts short (a resize or a second tap mid-change) rejects its
  // promises; the page itself has already changed, so that is not an error (CI review, 2026-11-26: it surfaced as uncaught)
  if (!navInfo().instant && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) { const vt = document.startViewTransition(go); vt.ready.catch(() => {}); vt.finished.catch(() => {}); vt.updateCallbackDone?.catch(() => {}); } else go();
});
find.init({ PRODUCTS, esc, card, render, navigate, grid: shopGrid, defer });
finder.init({ PRODUCTS, CATEGORIES, esc, shot, sticker, nowLedger, setQ: q => { state.q = q; } });
render();
if (spotHere()) putScroll(spotHere());   // a reload, or Back from another site, lands where you were
