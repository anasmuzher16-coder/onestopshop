// Reads the catalogue from the database, and writes it out as the JavaScript module the storefront imports
// (/catalog.js), in the same shape the hand-written sample file had.
export async function loadCatalog(db) {
  const [cats, boxes, prods] = await db.batch([
    db.prepare("SELECT id, name, tone FROM categories WHERE active = 1 ORDER BY sort, name"),
    db.prepare("SELECT id, label, l_cm, w_cm, h_cm, tare_g FROM boxes ORDER BY id"),
    db.prepare("SELECT p.sku, p.name, p.category_id, p.price_cents, p.weight_g, p.box_id, p.glass, p.ship_class, p.height_cm, p.note, p.img, p.img_dark, p.img_lw, p.photo_ver, p.details, p.stock FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active = 1 AND c.active = 1 ORDER BY p.sort, p.sku"),
  ]);
  return { categories: cats.results, boxes: boxes.results, products: prods.results.map(p => SOLD_PENDING_DB.has(p.sku) ? { ...p, stock: 0 } : p) };
}
// Sold, with the live database not yet updated. Every page, the catalogue and checkout read 0 from here, so it shows and acts sold before and after
// the owner's stock update. Once that update has run this entry does nothing and can be removed.
const SOLD_PENDING_DB = new Set(["OSS-1008"]);

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
  const PRODUCTS = cat.products.map(p => {
    let details = {}; try { details = JSON.parse(p.details || "{}"); } catch { details = {}; }
    return { sku: p.sku, name: p.name, cat: p.category_id, price: p.price_cents / 100, kg: p.weight_g / 1000, box: p.box_id, glass: !!p.glass,
      height: p.height_cm, note: p.note, ...(p.photo_ver ? { img: `/api/photo/${p.sku}?v=${p.photo_ver}`, photo: true, dark: false } : { img: p.img, dark: !!p.img_dark, lw: p.img_lw ?? undefined }), ship: p.ship_class, stock: p.stock, details };
  });
  return { BOXES, CATEGORIES, PRODUCTS };
}

export function catalogModule(cat) {
  const { BOXES, CATEGORIES, PRODUCTS } = toStorefront(cat);
  // JSON is valid JavaScript; U+2028/2029 are escaped so no product text can break the module.
  const lit = v => JSON.stringify(v).split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
  return `// Served from the store database.\nexport const BOXES = ${lit(BOXES)};\nexport const CATEGORIES = ${lit(CATEGORIES)};\nexport const PRODUCTS = ${lit(PRODUCTS)};\n`;
}
