// Reads the catalogue from the database, and writes it out as the JavaScript module the storefront imports
// (/catalog.js), in the same shape the hand-written sample file had.
// Each photo's own version (store/tools/photo-versions.mjs): a changed photo gets a new address, the rest stay cached.
import IMG_VERSIONS from "./img-versions.json" with { type: "json" };
export { IMG_VERSIONS };
export async function loadCatalog(db) {
  const [cats, boxes, prods] = await db.batch([
    db.prepare("SELECT id, name, tone FROM categories WHERE active = 1 ORDER BY sort, name"),
    db.prepare("SELECT id, label, l_cm, w_cm, h_cm, tare_g FROM boxes ORDER BY id"),
    // Sold items (active) and items on view before they can be sold (listed: "Price TBD", "Coming soon"). Columns are
    // named one by one: the supplier's price and name never leave the database this way.
    db.prepare("SELECT p.sku, p.name, p.category_id, p.price_cents, p.weight_g, p.box_id, p.glass, p.ship_class, p.height_cm, p.note, p.img, p.img_dark, p.img_lw, p.photo_ver, p.details, p.stock, p.active, p.listed, p.family, p.variant_label, p.swatch_hex, p.availability, p.facts_known FROM products p JOIN categories c ON c.id = p.category_id WHERE (p.active = 1 OR (p.listed = 1 AND p.availability != 'dropped')) AND c.active = 1 ORDER BY p.sort, p.sku"),   // a colour Ace has dropped leaves the shop's view
  ]);
  return { categories: cats.results, boxes: boxes.results, products: prods.results };
}
// A catalogue item's weight is unknown while its facts say so and the row still holds the import's placeholder
// (1 g; 2,500 g for an Ace hookah). It cannot be priced for a carrier until the weight is known: pickup or local delivery only.
// toStorefront, counterRow (page titles and descriptions) and the public feed all use this one rule.
export const weightUnknown = p => { if (!p || !p.family) return false; const f = parse(p.facts_known); if (!("weight_g" in f) || f.weight_g > 0) return false; return p.weight_g <= 1 || (p.family.startsWith("ace-") && p.weight_g === 2500); };
// Sellable means switched on with the shop's own price. Anything else on view is shown, never sold.
export const sellable = p => !!p && p.active === 1 && p.price_cents > 0;
const parse = s => { try { const v = JSON.parse(s || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
// What a shopper may see of a catalogue item's facts. Unknown stays null and is shown as "TBD", never guessed.
const FACT_KEYS = ["includes_base", "height_cm", "acrylic", "includes", "group", "stamp", "photo", "photo_hex", "colour_confirmed", "photo_label", "shown_in", "photo_upscale", "count", "size", "brand", "shape", "material", "weight_g"];
function shownFacts(p) {
  const f = parse(p.facts_known), out = {};
  for (const k of FACT_KEYS) if (k in f) out[k] = f[k];
  return out;
}

// The storefront's copy of the catalogue. Reading the database costs a few tenths of a second on every page, so
// pages and the catalogue module are served from a copy: this worker's memory (20 s), then the data centre's cache
// (a day), then the database. A stale copy is still served at once while a fresh one is fetched behind it. Any change in the back office, and any order, drops the copy. Checkout never uses it: it reads the database.
const KEY = "https://catalogue.internal/v1", FRESH = 20e3, USABLE = 600e3;
let mem = null, refreshing = null;
async function refill(env) {
  const cat = await loadCatalog(env.DB); mem = { at: Date.now(), cat };
  try { await caches.default.put(KEY, new Response(JSON.stringify(cat), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=86400", "X-At": String(mem.at) } })); } catch {}
  return cat;
}
export async function shopCatalog(env, ctx) {
  const now = Date.now();
  if (mem && now - mem.at < FRESH) return mem.cat;
  if (mem && now - mem.at < USABLE) { // serve what we have, refresh behind it
    if (!refreshing) { refreshing = refill(env).catch(() => {}).finally(() => { refreshing = null; }); if (ctx) ctx.waitUntil(refreshing); }
    return mem.cat;
  }
  // a worker that has just started: the data centre's copy (kept a day) answers at once, however old, and a fresh one
  // is fetched behind it. Only the very first visitor to a data centre ever waits on the database.
  try {
    const hit = await caches.default.match(KEY);
    if (hit) {
      const cat = await hit.json(), at = +hit.headers.get("X-At") || 0; mem = { at, cat };
      if (now - at >= FRESH && !refreshing) { refreshing = refill(env).catch(() => {}).finally(() => { refreshing = null; }); if (ctx) ctx.waitUntil(refreshing); }
      return cat;
    }
  } catch {}
  return refill(env);
}
export function dropCatalog(ctx) { mem = null; try { const d = caches.default.delete(KEY); if (ctx) ctx.waitUntil(d); } catch {} }

export function toStorefront(cat) {
  const BOXES = {};
  for (const b of cat.boxes) BOXES[b.id] = { l: b.l_cm, w: b.w_cm, h: b.h_cm, tare: b.tare_g / 1000, label: b.label };
  const CATEGORIES = cat.categories.map(c => ({ id: c.id, name: c.name, tone: c.tone }));
  // the first colour of each family that has its own photo leads it (one card per family); else its first colour
  const lead = {};
  const grouped = p => !!p.family && p.family.startsWith("ace-");   // hookahs: one card per family, colours as chips. Shisha flavours and charcoal stay one card each.
  for (const p of cat.products) if (grouped(p)) { const own = parse(p.facts_known).photo === "own"; if (!lead[p.family] || (own && !lead[p.family].own)) lead[p.family] = { sku: p.sku, own }; }
  const PRODUCTS = cat.products.map(p => {
    const details = parse(p.details);
    // charcoal by its flag, or by its section: anything in Charcoal is charcoal, so moving an item into Charcoal in the
    // back office can never leave it shippable by a carrier (breaker, 2026-11-24)
    if (isCharcoalRow(p)) details.charcoal = true;   // also an item from the charcoal list, wherever the back office puts it
    const coal = !!details.charcoal; delete details.photo_rights; delete details.photo_rejected; delete details.source_lines;   // shop-only notes stay in the back office
    if ("photo" in details && !PUBLIC_PHOTO.includes(details.photo)) delete details.photo;   // only the photo states a page shows; any other note on a photo stays in the back office
    const sale = sellable(p), facts = p.family ? shownFacts(p) : {};
    // a catalogue item whose pack weight is not known yet cannot be priced for a carrier: pickup or local delivery until it is
    const weightTbd = weightUnknown(p);
    return { sku: p.sku, name: p.name, cat: p.category_id,
      // "sale": can go in the cart. "soon": priced and on view, not switched on yet. "tbd": waiting for the shop's price.
      state: sale ? "sale" : p.price_cents > 0 ? "soon" : "tbd",
      price: p.price_cents > 0 ? p.price_cents / 100 : null,
      // a weight set later in the master file (facts) replaces the import's 1 g placeholder, and shipping switches on by itself
      kg: (p.weight_g <= 1 && facts.weight_g > 0 ? facts.weight_g : p.weight_g) / 1000, box: p.box_id, glass: !!p.glass,
      height: p.height_cm, note: p.note, ...(p.photo_ver ? { img: `/api/photo/${p.sku}?v=${p.photo_ver}`, photo: true, dark: false } : { img: p.img, dark: !!p.img_dark, lw: p.img_lw ?? undefined, ...(IMG_VERSIONS[p.img] ? { iv: IMG_VERSIONS[p.img] } : {}) }),
      // an unpriced hookah is not sold at all, so it carries no "pickup only" line; once priced without a weight, it is pickup or local only
      // an unpriced Ace accessory is the same: shown, not sold, so no pickup line until it is priced (then pickup or local until weighed)
      ship: coal || (weightTbd && (sale || !(grouped(p) || p.family.startsWith("acc-")))) ? "pickup_only" : p.ship_class, stock: sale ? p.stock : 0, details,
      ...(p.family && !grouped(p) ? { facts, ...(p.family.startsWith("acc-") ? { acc: true } : {}), ...(weightTbd ? { weightTbd: true } : {}) } : {}),   // acc: an item from Ace's accessories catalogue, one card each
      ...(grouped(p) ? { family: p.family, lead: lead[p.family].sku === p.sku, colour: details.colour || p.variant_label || "", named: !!details.colour || facts.colour_confirmed === true, chip: [facts.photo_hex, p.swatch_hex].find(h => /^#[0-9a-f]{6}$/i.test(h || "")) || null, facts,
        counted: p.availability === "counted", ...(weightTbd ? { weightTbd: true } : {}) } : {}) };
  });
  return { BOXES, CATEGORIES, PRODUCTS };
}

// Charcoal (owner, 2026-11-23) has its own section since 2026-11-24 (Heat keeps foil and heat management) and carries
// details.charcoal. toStorefront makes every marked item, and everything in this section, pickup or local delivery only
// (ship class pickup_only: never Canada Post or any carrier) whatever its row says, so a back-office edit can never let it ship.
export const CHARCOAL = "charcoal";
// Storefront products: charcoal (always pickup or local delivery, never a carrier).
export const isCharcoal = p => !!(p && p.details && p.details.charcoal);
// Shisha (and anything flagged tobacco) is paid at the counter until the card company approves it (STRIPE_TOBACCO_OK=1, set
// per request by the worker), so it is a pickup: pages, search results and the feed never promise shipping for it. checkout.js holds the same rule.
let shishaCard = false;
export const setShishaCard = v => { shishaCard = v === "1"; };
export const counterPayRow = p => !!p && !shishaCard && (p.category_id === "shisha" || !!parse(p.details).tobacco);
export const counterRow = p => { if (!p) return false; if (p.ship_class === "pickup_only" || isCharcoalRow(p) || weightUnknown(p)) return true; try { return !!JSON.parse(p.details || "{}").charcoal; } catch { return false; } };
// A database row is charcoal by its section (anything in Charcoal but foil), or by coming from the charcoal list (family
// charcoal-...), so moving an item out of Charcoal in the back office never makes it shippable (breaker, 2026-11-24).
export function isCharcoalRow(p) { const f = String(p.family || ""); return (p.category_id === CHARCOAL && !f.startsWith("foil-")) || f.startsWith("charcoal-"); }
// The photo states a page shows; any other note on a photo stays in the back office.
export const PUBLIC_PHOTO = ["approved", "coming", "upscale", "replace"];
export function catalogModule(cat) {
  const { BOXES, CATEGORIES, PRODUCTS } = toStorefront(cat);
  // JSON is valid JavaScript; U+2028/2029 are escaped so no product text can break the module.
  const lit = v => JSON.stringify(v).split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
  return `// Served from the store database.\nexport const BOXES = ${lit(BOXES)};\nexport const CATEGORIES = ${lit(CATEGORIES)};\nexport const PRODUCTS = ${lit(PRODUCTS)};\n`;
}
