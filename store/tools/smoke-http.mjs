// Address checks for the store Worker: status codes, page titles, robots, security headers, catalogue module.
// Needs the store running (npx wrangler dev --port 4420 --local). node store/tools/smoke-http.mjs
const B = process.env.BASE || "http://127.0.0.1:4420";
let n = 0, f = 0;
const ok = (cond, msg) => { n++; if (!cond) { f++; console.log("FAIL", msg); } };
const get = async p => { const r = await fetch(B + p, { redirect: "manual", signal: AbortSignal.timeout(15000) }); return { r, t: await r.text() }; };
const want = { "/": 200, "/shop": 200, "/shop/hookahs": 200, "/shop/nope": 404, "/p/OSS-1001": 301, "/p/OSS-100024": 200, "/p/OSS-9601": 200, "/shop/shisha": 200, "/p/NOPE": 404, "/cart": 200, "/shipping": 200,
  "/set": 200, "/search": 200, "/gifts/under-50": 301, "/cart/x": 404, "/shop/hookahs/x": 404, "/index.html": 301, "/api/catalog-module": 200, "/catalog.js": 404, "/nope": 404, "/styles.css": 200, "/api/catalog": 200,
  "/api/x": 404, "/admin": 200, "/privacy": 200, "/terms": 200, "/checkout": 200, "/order/WABC234": 200, "/order/nope": 404, "/app.js": 200, "/route.js": 200, "/img/pc/hookah00.webp": 200, "/nothing.png": 404 };
for (const [p, code] of Object.entries(want)) { const { r } = await get(p); ok(r.status === code, `${p} gave ${r.status}, wanted ${code}`); }

// the shop's questionnaire (2026-11-25): its private page, and a Send that only takes JSON, never a GET
{ const q = await get("/intake/ij9A2jg3vBRk"); ok(q.r.status === 200 && /Before the site goes live/.test(q.t) && q.r.headers.get("x-robots-tag") === "noindex, nofollow", "intake page: " + q.r.status);
  ok((await get("/intake/nope")).r.status === 404, "a wrong intake link is a 404");
  ok((await get("/api/intake/ij9A2jg3vBRk")).r.status === 405, "intake send refuses a GET");
  const bad = await fetch(B + "/api/intake/ij9A2jg3vBRk", { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json", signal: AbortSignal.timeout(15000) }); ok(bad.status === 400, "intake send refuses a broken body: " + bad.status);
  const form = await fetch(B + "/api/intake/ij9A2jg3vBRk", { method: "POST", body: "a=b", signal: AbortSignal.timeout(15000) }); ok(form.status === 415, "intake send refuses a plain form post: " + form.status);
  const away = await fetch(B + "/api/intake/ij9A2jg3vBRk", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.com" }, body: "{}", signal: AbortSignal.timeout(15000) }); ok(away.status === 403, "intake send refuses another site: " + away.status);
  const big = await fetch(B + "/api/intake/ij9A2jg3vBRk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: { x: "y".repeat(210000) } }), signal: AbortSignal.timeout(15000) }); ok(big.status === 413, "intake send refuses an oversized body: " + big.status);
  ok((await get("/intake.html")).r.status === 404, "the questionnaire file is not reachable without its link");
  ok(!(await get("/admin.js")).t.includes("ij9A2jg3vBRk"), "the questionnaire link is not printed in a public file"); }
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
const { SAMPLE_SKUS } = await import("../src/samples.js");
// Every made-up sample is off since 2026-11-24 (owner: "Hide samples, show coming soon"). What is on view is the real stock:
// 69 charcoal items, 15 foil packs (Heat), 47 shisha flavours, 91 Ace colours (Price TBD): only the colours on pages the shop
// ticked (86 stamped, 5 with an unclear tick); the 205 on unticked pages are off view (owner, 2026-11-26: a tick means in the
// shop, in stock; nothing is ordered in). Plus the 39 Ace accessories the shop ticked (Price TBD). All ten sections stay; the
// ones left with nothing say "stock arriving soon".
const coal = m.PRODUCTS.filter(p => p.cat === "charcoal"), heat = m.PRODUCTS.filter(p => p.cat === "heat"), foil = heat.filter(p => /foil/i.test(p.name));
const acc = m.PRODUCTS.filter(p => p.acc), accBy = id => acc.filter(p => p.cat === id).length;
ok(m.PRODUCTS.length === 69 + 15 + 47 + 91 + 39 + 32 + 65 && m.CATEGORIES.length === ref.CATEGORIES.length + 4, `catalogue size ${m.PRODUCTS.length}/${69 + 15 + 47 + 91 + 39 + 32 + 65}, sections ${m.CATEGORIES.length}`);
// the shop's own bowls (2026-11-27): 65 colours in 28 families (28 branded, 37 under plain names) (one card each, colours as chips), all in Bowls, Price TBD, the
// shop's own photo; the back office's check-the-name notes never reach the storefront
{ const bowl = m.PRODUCTS.filter(p => /^bowl-/.test(p.family || ""));
  ok(bowl.length === 65 && new Set(bowl.map(p => p.family)).size === 28 && bowl.filter(p => p.lead).length === 28 && bowl.every(p => p.cat === "bowls" && p.state === "tbd" && p.price === null && p.stock === 0 && p.named && p.colour && p.facts.stamp === "shelf" && p.facts.photo === "own" && /^bowl\//.test(p.img) && p.lw === 1440 && !("needs_confirm" in p.facts) && !("confirm_why" in p.facts)),
    `65 bowls in 28 families, Price TBD, own photos, no internal notes: ${bowl.length}`);
  for (const p of bowl) for (const suf of ["-s", "-l"]) { const r = await fetch(B + `/img/pc/${p.img}${suf}.webp`); ok(r.status === 200, `photo ${p.img}${suf}.webp: ${r.status}`); }
  const rose = m.PRODUCTS.find(p => p.sku === "OSS-100150");
  ok(rose && rose.img === "shop/ace-rose-red" && rose.facts.photo === "own" && !rose.facts.photo_label, `the Rose hookah shows the shop's own photo, no upscale label: ${rose && rose.img}`);
  const tsar = Object.fromEntries(m.PRODUCTS.filter(p => p.family === "ace-tsar-molotov").map(p => [p.sku, p]));
  ok(tsar["OSS-100084"]?.img === "shop/ace-tsar-molotov-green" && tsar["OSS-100084"].facts.photo === "own" && !tsar["OSS-100084"].facts.photo_label
     && tsar["OSS-100081"]?.img === "shop/ace-tsar-molotov-blue" && !tsar["OSS-100081"].facts.photo_label
     && ["OSS-100080", "OSS-100083"].every(s => tsar[s]?.img === "shop/ace-tsar-molotov-blue" && tsar[s].facts.shown_in === "blue"),
    `the Tsar Molotov shows the shop's own green and blue photos: ${Object.values(tsar).map(p => p.sku + "=" + p.img).join(" ")}`);
  for (const n of ["green", "blue"]) for (const suf of ["", "-s", "-m"]) { const r = await fetch(B + `/img/pc/shop/ace-tsar-molotov-${n}${suf}.webp`); ok(r.status === 200, `photo shop/ace-tsar-molotov-${n}${suf}.webp: ${r.status}`); } }
// the shop's own hanging hoses (2026-11-27): 32 colours in 21 families (one card each, colours as chips), all in Hoses, Price TBD,
// nothing to sell yet; the back office's unsure-match notes never reach the storefront
{ const hose = m.PRODUCTS.filter(p => /^hose-/.test(p.family || ""));
  ok(hose.length === 32 && new Set(hose.map(p => p.family)).size === 21 && hose.filter(p => p.lead).length === 21 && hose.every(p => p.cat === "hoses" && p.state === "tbd" && p.price === null && p.stock === 0 && p.named && p.colour && p.facts.stamp === "shelf" && "length" in p.facts && (/^hose\//.test(p.img) || (p.sku === "OSS-120032" && !p.img)) && !("needs_confirm" in p.facts) && !("confirm_why" in p.facts)),
    `32 hoses in 21 families, Price TBD, own photos, no internal notes: ${hose.length}`);
  const pl = await get("/p/OSS-120011"); ok(pl.r.status === 200 && /<title>Platinum Disposable Hose \| One Stop Shop<\/title>/.test(pl.t) && /Price TBD/.test(pl.t) && !/"offers"/.test(pl.t) && !/Ace Hookah/.test(pl.t), "a hose page: its name, Price TBD, no offer, never Ace");
  for (const p of hose.filter(p => p.img)) { const r = await fetch(B + `/img/pc/${p.img}-s.webp`); ok(r.status === 200, `photo ${p.img}-s.webp: ${r.status}`); } }
ok(m.PRODUCTS.filter(p => p.family || p.acc).every(p => p.facts && p.facts.stamp && p.facts.stamp !== "none"), "no unticked Ace page is on view (hookahs and accessories)");
ok(acc.length === 39 && accBy("heat") === 18 && accBy("bowls") === 8 && accBy("hoses") === 5 && accBy("bases") === 5 && accBy("parts") === 3 && accBy("charcoal") === 0,
  `39 Ace accessories in their sections, none in Charcoal: ${["heat", "bowls", "hoses", "bases", "parts", "charcoal"].map(id => id + " " + accBy(id)).join(", ")}`);
ok(acc.every(p => p.state === "tbd" && p.price === null && p.stock === 0 && p.weightTbd && !p.family && !/QUASAR|QAUSAR|HUQQABAZ|T-SAR/i.test(p.name)),
  "every accessory: Price TBD, no price, nothing to sell, weight TBD (pickup or local once priced, like the hookahs), one card each, no other maker's name");
ok(m.PRODUCTS.filter(p => p.cat === "shisha").every(p => p.details && p.details.tobacco === true), "every shisha carries its pay-at-the-counter rule itself (not only by its section)");
// the menu order (owner, 2026-11-26): hookahs, shisha, charcoal, heat, then the parts
ok(m.CATEGORIES.map(c => c.id).join(",") === "hookahs,shisha,charcoal,heat,bowls,hoses,bases,parts,cologne,misc", "menu order " + m.CATEGORIES.map(c => c.id).join(","));
ok(foil.length === 15 && foil.every(p => p.state === "sale" && p.ship === "pickup_only" && p.weightTbd), "15 foil packs: on sale, pickup or local delivery while their weight is TBD");
ok(!m.PRODUCTS.some(p => SAMPLE_SKUS.has(p.sku)) && SAMPLE_SKUS.size === 100 && !SAMPLE_SKUS.has("OSS-7009"), "no made-up sample is left in the catalogue (100 sample numbers, never 7009, the back office's next cologne; 98 are in this database, kept and switched off)");
ok(ref.PRODUCTS.every(a => SAMPLE_SKUS.has(a.sku)), "every row of the mockup's sample file is in the samples list");
ok(coal.length === 69 && heat.length === 15 + 18 && foil.length === 15 && !heat.some(p => p.details.charcoal), `Charcoal holds the 69 charcoal items; Heat holds the 15 foil packs, 18 accessories and no charcoal: ${coal.length}/${heat.length}`);
// the sections the samples leave empty: still there, answering 200, saying the stock is on its way and the phone, kept out of search
const empty = m.CATEGORIES.filter(c => !m.PRODUCTS.some(p => p.cat === c.id)).map(c => c.id);
ok(["cologne", "misc"].every(id => empty.includes(id)) && empty.length === 2, "two sections wait for their stock (Bases, Bowls, Hoses and Parts have Ace accessories since 2026-11-26): " + empty.join(","));
for (const id of empty) { const s = await get("/shop/" + id); ok(s.r.status === 200 && /coming soon to our site/i.test(s.t) && /tel:\+15192552222/.test(s.t) && /<meta name="robots" content="noindex, nofollow">/.test(s.t) && !/"@type":"(ItemList|Product)"/.test(s.t), `/shop/${id}: 200, says coming soon to our site with the phone, noindex, no product data`); }
// every switched-off sample's old address goes to its own section, which says what is coming (one request each)
{ const all = [...SAMPLE_SKUS]; let wrong = [];
  for (const sku of all) { const r = await fetch(B + "/p/" + sku, { redirect: "manual" }); if (["OSS-7005", "OSS-7007"].includes(sku)) { if (r.status !== 404) wrong.push(`${sku}:${r.status}`); continue; }   // listed in case a database kept them; this one never had them
    const sec = ref.PRODUCTS.find(a => a.sku === sku)?.cat || { 7: "cologne", 8: "misc" }[sku[4]]; if (r.status !== 301 || !(r.headers.get("location") || "").endsWith("/shop/" + sec)) wrong.push(`${sku}:${r.status}`); }
  ok(!wrong.length, `every sample's old address redirects to its section (${all.length}): ${wrong.slice(0, 5).join(" ")}`); }
ok(coal.every(p => p.ship === "pickup_only" && p.details.charcoal === true && p.stock === 10), "every charcoal item is pickup only and starts at 10 in stock");
ok(coal.filter(p => p.img).length === 28 && coal.every(p => p.img ? p.details.photo === "approved" : p.details.photo === "coming"), "28 charcoal photos, the rest carry photo status coming");
for (const p of coal.filter(x => x.img)) { const r = await fetch(B + `/img/pc/${p.img}-s.webp`); ok(r.status === 200, `photo ${p.img}-s.webp: ${r.status}`); }
ok((await fetch(B + "/img/pc/coming-charcoal.svg")).status === 200, "the drawn stand-in is served");
// every promise follows the card switch (2026-11-27): with card payment off (this suite's mode, the live demo's) every order is a
// pickup paid at the counter, so the charcoal page says pickup only; with card on it says pickup or local delivery
const coalPage = await get("/p/OSS-9101"), cardOn = /<meta name="oss-pay" content="card">/.test(coalPage.t);
ok((cardOn ? /Pickup in Windsor or local delivery near Windsor\. Not shipped/.test(coalPage.t) : /Pickup in Windsor, paid in the shop\./.test(coalPage.t) && !/local delivery|shipped across/i.test(((coalPage.t.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] || "") + ((coalPage.t.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "")))
  && /og:image" content="[^"]+\/img\/share\.jpg"/.test(coalPage.t), `a charcoal page without a photo says how it is bought (${cardOn ? "pickup or local delivery" : "pickup only, card off"}) and shares the shop image`);
if (!cardOn) {   // card off: no page the shop draws promises local delivery or shipping, in its description, its text or its footer
  for (const path of ["/", "/shop", "/shop/charcoal", "/shop/heat", "/shop/hookahs", "/p/OSS-9101"]) {
    const pg = await get(path), desc = (pg.t.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "", foot = (pg.t.match(/<p class="foot__en">([^<]*)</) || [])[1] || "";
    ok(!/local delivery|shipp|across Canada/i.test(desc + " " + foot) && /pickup|Pickup/.test(foot) && /hidden/.test((pg.t.match(/<div class="dstrip"[^>]*>/) || [""])[0]), `card off, ${path}: description and footer offer pickup only, no delivery bar: "${desc}" / "${foot}"`);
  }
}
// (the field-by-field match of the samples against the mockup file went with the samples: none is in the catalogue now)
for (const [id, a] of Object.entries(ref.BOXES)) { const b = m.BOXES[id]; ok(b && a.l === b.l && a.w === b.w && a.h === b.h && Math.abs(a.tare - b.tare) < 1e-9, "box " + id); }
// an item on sale whose weight is not known yet (foil; an Ace hookah once priced) is pickup or local delivery until it is (2026-11-24)
ok(m.PRODUCTS.every(p => (p.cat === "cologne" ? p.ship === "ground_only" : p.cat === "charcoal" || (p.weightTbd && p.state === "sale") ? p.ship === "pickup_only" : p.ship === "standard") && Number.isInteger(p.stock) && p.stock >= 0), "ship class and stock come through");

const post = await fetch(B + "/api/catalog", { method: "POST" }); ok(post.status === 405, "POST /api/catalog gave " + post.status);
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`);
process.exit(f ? 1 : 0);
