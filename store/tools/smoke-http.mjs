// Address checks for the store Worker: status codes, page titles, robots, security headers, catalogue module.
// Needs the store running (npx wrangler dev --port 4420 --local). node store/tools/smoke-http.mjs
const B = process.env.BASE || "http://127.0.0.1:4420";
let n = 0, f = 0;
const ok = (cond, msg) => { n++; if (!cond) { f++; console.log("FAIL", msg); } };
const get = async p => { const r = await fetch(B + p, { redirect: "manual", signal: AbortSignal.timeout(15000) }); return { r, t: await r.text() }; };
const want = { "/": 200, "/shop": 200, "/shop/hookahs": 200, "/shop/nope": 404, "/p/OSS-1001": 301, "/p/OSS-100024": 200, "/p/OSS-9601": 200, "/shop/shisha": 200, "/p/NOPE": 404, "/cart": 200, "/shipping": 200,
  "/set": 200, "/search": 200, "/gifts/under-50": 200, "/cart/x": 404, "/shop/hookahs/x": 404, "/index.html": 301, "/api/catalog-module": 200, "/catalog.js": 404, "/nope": 404, "/styles.css": 200, "/api/catalog": 200,
  "/api/x": 404, "/admin": 200, "/privacy": 200, "/terms": 200, "/checkout": 200, "/order/WABC234": 200, "/order/nope": 404, "/app.js": 200, "/route.js": 200, "/img/pc/hookah00.webp": 200, "/nothing.png": 404 };
for (const [p, code] of Object.entries(want)) { const { r } = await get(p); ok(r.status === code, `${p} gave ${r.status}, wanted ${code}`); }

// the sample hookahs are retired (2026-11-24): a real product on sale (a shisha flavour) carries these checks now
const prod = await get("/p/OSS-9601"), h = prod.r.headers;
ok(/<title>Zanobia Herbal Molasses Double Apple, 250 g \| One Stop Shop<\/title>/.test(prod.t), "product title: " + (prod.t.match(/<title>[^<]*/) || [""])[0]);
ok(prod.t.includes(`<link rel="canonical" href="${B}/p/OSS-9601">`), "canonical link missing");
ok(/og:image" content="[^"]+\/img\/pc\/oss-9601\.webp"/.test(prod.t), "og:image missing");
ok(/application\/ld\+json">\{[^<]*"@type":"Product"[^<]*"price":"12\.99"/.test(prod.t), "product data block missing or wrong price");
const tbd = await get("/p/OSS-100024"); ok(/<title>DMX Hookah \| One Stop Shop<\/title>/.test(tbd.t) && !/"offers"/.test(tbd.t) && /Price TBD/.test(tbd.t), "a Price TBD hookah has its page, no offer, and says Price TBD");
const old = await get("/p/OSS-1001"); ok(old.r.status === 301 && /\/shop\/hookahs$/.test(old.r.headers.get("location") || ""), "a retired sample hookah redirects to its section");
ok(/<meta name="robots" content="noindex, nofollow">/.test(prod.t) && h.get("x-robots-tag") === "noindex, nofollow", "noindex must be on until launch");
ok((h.get("content-security-policy") || "").includes("script-src 'self'") && h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff", "security headers missing");
ok(!/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)/.test(prod.t), "an inline script is still in the page (blocked by the security policy)");
ok(/<base href="\/">/.test(prod.t), "base tag missing");

const cat = await get("/shop/hookahs"); ok(/<title>Hookahs \| One Stop Shop<\/title>/.test(cat.t), "category title");
const nf = await get("/p/NOPE"); ok(/<title>Page not found/.test(nf.t), "404 page title");

const mod = await get("/api/catalog-module");
ok((mod.r.headers.get("content-type") || "").startsWith("text/javascript"), "catalog.js content type");
const m = await import("data:text/javascript;base64," + Buffer.from(mod.t).toString("base64"));
const ref = await import("../../site/catalog.js");
// Charcoal has its own section since 2026-11-24 (69 items). Heat keeps the 15 foil packs and brings back the Heat pieces
// that were hidden when charcoal moved in on 2026-11-23 (exactly those, from the audit log): the sample ones with a sound photo.
const FLAWED = ["hookah50", "bowl30", "acc03", "bowl26", "hmd12", "acc06", "hose09", "bowl06"], oldHeat = ref.PRODUCTS.filter(p => p.cat === "heat");
// Since 2026-11-24 the sample hookahs are retired too, and the real stock is on view: 296 Ace colours (Price TBD), 47 shisha, 15 foil.
const coal = m.PRODUCTS.filter(p => p.cat === "charcoal"), heat = m.PRODUCTS.filter(p => p.cat === "heat"), foil = heat.filter(p => /foil/i.test(p.name));
const back = oldHeat.filter(a => !FLAWED.includes(a.img)), backIn = heat.filter(p => back.some(a => a.sku === p.sku));
const kept = ref.PRODUCTS.filter(p => p.cat !== "hookahs" && p.cat !== "heat" && !FLAWED.includes(p.img)).length;
ok(m.PRODUCTS.length === kept + 12 + 69 + 15 + 47 + 296 + back.length && m.CATEGORIES.length === ref.CATEGORIES.length + 4, `catalogue size ${m.PRODUCTS.length}/${kept + 12 + 69 + 15 + 47 + 296 + back.length}, sections ${m.CATEGORIES.length}`);
ok(m.CATEGORIES.findIndex(c => c.id === "charcoal") === m.CATEGORIES.findIndex(c => c.id === "heat") + 1, "Charcoal sits right after Heat");
ok(foil.length === 15 && foil.every(p => p.state === "sale" && p.ship === "pickup_only" && p.weightTbd), "15 foil packs: on sale, pickup or local delivery while their weight is TBD");
ok(!m.PRODUCTS.some(p => ref.PRODUCTS.some(a => a.cat === "hookahs" && a.sku === p.sku)), "no sample hookah is left in the catalogue");
ok(coal.length === 69 && heat.length === 15 + back.length && backIn.length === back.length && back.length > 0 && !heat.some(p => p.details.charcoal), `Charcoal holds the 69 charcoal items; Heat holds the foil and the ${back.length} Heat pieces brought back, and no charcoal: ${coal.length}/${heat.length}`);
ok(coal.every(p => p.ship === "pickup_only" && p.details.charcoal === true && p.stock === 10), "every charcoal item is pickup only and starts at 10 in stock");
ok(coal.filter(p => p.img).length === 28 && coal.every(p => p.img ? p.details.photo === "approved" : p.details.photo === "coming"), "28 charcoal photos, the rest carry photo status coming");
for (const p of coal.filter(x => x.img)) { const r = await fetch(B + `/img/pc/${p.img}-s.webp`); ok(r.status === 200, `photo ${p.img}-s.webp: ${r.status}`); }
ok((await fetch(B + "/img/pc/coming-charcoal.svg")).status === 200, "the drawn stand-in is served");
const coalPage = await get("/p/OSS-9101"); ok(/Pickup in Windsor or local delivery near Windsor\. Not shipped/.test(coalPage.t) && /og:image" content="[^"]+\/img\/share\.jpg"/.test(coalPage.t), "a charcoal page without a photo says pickup or local delivery only and shares the shop image");
let diff = 0;
for (const a of ref.PRODUCTS) { if (FLAWED.includes(a.img) || a.cat === "heat" || a.cat === "hookahs") continue; const b = m.PRODUCTS.find(x => x.sku === a.sku); if (!b) { diff++; continue; }
  for (const k of ["name", "cat", "price", "kg", "box", "glass", "note", "img", "dark"]) if (a[k] !== b[k]) diff++;   // (Heat's pieces brought back are checked above)
  if ((a.height ?? null) !== (b.height ?? null) || (a.lw ?? null) !== (b.lw ?? null)) diff++; }
ok(diff === 0, `${diff} product fields differ between the database and the sample file`);
for (const [id, a] of Object.entries(ref.BOXES)) { const b = m.BOXES[id]; ok(b && a.l === b.l && a.w === b.w && a.h === b.h && Math.abs(a.tare - b.tare) < 1e-9, "box " + id); }
// an item on sale whose weight is not known yet (foil; an Ace hookah once priced) is pickup or local delivery until it is (2026-11-24)
ok(m.PRODUCTS.every(p => (p.cat === "cologne" ? p.ship === "ground_only" : p.cat === "charcoal" || (p.weightTbd && p.state === "sale") ? p.ship === "pickup_only" : p.ship === "standard") && Number.isInteger(p.stock) && p.stock >= 0), "ship class and stock come through");

const post = await fetch(B + "/api/catalog", { method: "POST" }); ok(post.status === 405, "POST /api/catalog gave " + post.status);
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`);
process.exit(f ? 1 : 0);
