// Address checks for the store Worker: status codes, page titles, robots, security headers, catalogue module.
// Needs the store running (npx wrangler dev --port 4420 --local). node store/tools/smoke-http.mjs
import { readFileSync } from "node:fs";
import { SEED_FILES, seedPath } from "./seed-files.mjs";
const B = process.env.BASE || "http://127.0.0.1:4420";
// hoses whose drawn-bag photo is approved (store/catalog/live/hose-drawnbag-2026-11-27.sql): those lose the "to be replaced" tag
const DRAWN = new Set(((await import("node:fs")).readFileSync(new URL("../catalog/live/hose-drawnbag-2026-11-27.sql", import.meta.url), "utf8").match(/^UPDATE products SET details[^\n]*WHERE sku IN \(([^)]*)\)/m)?.[1] || "").match(/OSS-\d+/g) || []);
// the shop hookahs whose cleaned photo the seed puts in (the hookah-clean files): no tag, framed like the Ace hookahs
const CLEANED = new Set(SEED_FILES.filter(f => /\/hookah-clean/.test(f))
  .flatMap(f => [...readFileSync(seedPath(f), "utf8").matchAll(/^UPDATE products .* WHERE sku = '(OSS-14\d{4})'/gm)].map(m => m[1])));
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
// 69 charcoal items on the shop's list + the Duracubes 72 box (Price TBD), 15 foil packs (Heat), 47 shisha flavours, 91 Ace colours (Price TBD): only the colours on pages the shop
// ticked (86 stamped, 5 with an unclear tick); the 205 on unticked pages are off view (owner, 2026-11-26: a tick means in the
// shop, in stock; nothing is ordered in). Plus the 39 Ace accessories the shop ticked (Price TBD). All ten sections stay; the
// ones left with nothing say "stock arriving soon".
const coal = m.PRODUCTS.filter(p => p.cat === "charcoal"), heat = m.PRODUCTS.filter(p => p.cat === "heat"), foil = heat.filter(p => /foil/i.test(p.name));
const acc = m.PRODUCTS.filter(p => p.acc), accBy = id => acc.filter(p => p.cat === id).length;
ok(m.PRODUCTS.length === 69 + 1 + 15 + 47 + 91 + 39 + 33 + 65 + 102 && m.CATEGORIES.length === ref.CATEGORIES.length + 4, `catalogue size ${m.PRODUCTS.length}/${69 + 1 + 15 + 47 + 91 + 39 + 33 + 65 + 102}, sections ${m.CATEGORIES.length}`);
// the shop's own hookahs (2026-11-27, + the Drive folder's 75 colours in 57 cards on 2026-11-28, drive2-2026-11-28.sql): 102 colours
// (101 in 78 hookah-... families, the blue Ace Rose in the Ace Rose's family), all
// in Hookahs, Price TBD; the four Steamulations on the maker's photo, untagged; the other 98 on the shop's original photo, full
// tile, tagged "to be replaced" (facts.photo_label 'replace') unless a hookah-clean file has put its cleaned photo in; every hose carries the same tag; no approved or catalogue photo
// ever does; the back office's notes never reach the storefront
{ const hk = m.PRODUCTS.filter(p => /^OSS-14\d{4}$/.test(p.sku)), fams = new Set(hk.map(p => p.family));
  const clean = hk.filter(p => CLEANED.has(p.sku)), web = hk.filter(p => !p.facts.photo_label && !CLEANED.has(p.sku)), orig = hk.filter(p => p.facts.photo_label === "replace");
  ok(hk.length === 102 && fams.size === 79 && hk.every(p => p.cat === "hookahs" && p.state === "tbd" && p.price === null && p.stock === 0 && p.glass && p.colour && p.facts.stamp === "shelf" && p.facts.photo === "own" && /^hookah\//.test(p.img) && !("needs_confirm" in p.facts) && !("confirm_why" in p.facts) && !("photo_src" in p.facts) && p.height == null),
    `102 shop hookahs, Price TBD, own photos, no internal notes: ${hk.length} in ${fams.size} families`);
  ok(web.length === 4 && web.every(p => /^Steamulation /.test(p.name) && !p.facts.photo_full) && orig.length === 98 - CLEANED.size && orig.every(p => p.facts.photo_full === true),
    `4 Steamulations on the maker's photo, untagged; ${98 - CLEANED.size} originals full tile and tagged: ${web.length}/${orig.length}`);
  ok(CLEANED.size > 0 && clean.length === CLEANED.size && clean.every(p => !p.facts.photo_label && !p.facts.photo_full),
    `the ${CLEANED.size} cleaned shop photos carry no tag and are framed: ${clean.length}`);
  ok(hk.filter(p => p.lead).length === 78 && hk.find(p => p.family === "ace-rose")?.lead === false, "one card per shop hookah family; the blue Rose is a chip on the red Rose's card");
  for (const p of hk) for (const suf of ["", "-s"]) { const r = await fetch(B + `/img/pc/${p.img}${suf}.webp`); ok(r.status === 200, `photo ${p.img}${suf}.webp: ${r.status}`); }
  const hose = m.PRODUCTS.filter(p => /^hose-/.test(p.family || ""));
  // 33 hoses: each photographed one carries the tag until its drawn-bag photo is approved (DRAWN); the light blue Starbuzz
  // (OSS-120032) and the green Simba (OSS-120033, 2026-11-28) have no photo until its drawn-bag cut-out goes in ("Photo coming soon"), so it never carries the tag
  const shot = hose.filter(p => p.img), waiting = shot.filter(p => !DRAWN.has(p.sku));
  ok(DRAWN.size > 0 && hose.length === 33 && hose.every(p => DRAWN.has(p.sku) ? !p.facts.photo_label : p.img ? p.facts.photo_label === "replace" : ["OSS-120032", "OSS-120033"].includes(p.sku) && !p.facts.photo_label),
    `every photographed hose is tagged "to be replaced" until its drawn-bag photo is approved: ${waiting.filter(p => p.facts.photo_label === "replace").length}/${waiting.length} tagged, ${DRAWN.size} approved, of ${hose.length}`);
  const tagged = m.PRODUCTS.filter(p => p.facts?.photo_label === "replace").map(p => p.sku);
  ok(tagged.length === 98 - CLEANED.size + waiting.length && tagged.every(s => /^OSS-1[24]\d{4}$/.test(s)), `only the shop hookahs and hoses carry the tag: ${tagged.length}`); }
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
// the shop's own hanging hoses (2026-11-27): 33 colours in 21 families (the green Simba from the Drive folder, 2026-11-28) (one card each, colours as chips), all in Hoses, Price TBD,
// nothing to sell yet; the back office's unsure-match notes never reach the storefront
{ const hose = m.PRODUCTS.filter(p => /^hose-/.test(p.family || ""));
  ok(hose.length === 33 && new Set(hose.map(p => p.family)).size === 21 && hose.filter(p => p.lead).length === 21 && hose.every(p => p.cat === "hoses" && p.state === "tbd" && p.price === null && p.stock === 0 && p.named && p.colour && p.facts.stamp === "shelf" && "length" in p.facts && (/^hose\//.test(p.img) || (["OSS-120032", "OSS-120033"].includes(p.sku) && !p.img)) && !("needs_confirm" in p.facts) && !("confirm_why" in p.facts)),
    `33 hoses in 21 families, Price TBD, own photos, no internal notes: ${hose.length}`);
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
ok(coal.length === 70 && heat.length === 15 + 18 && foil.length === 15 && !heat.some(p => p.details.charcoal), `Charcoal holds the 69 listed charcoal items and the Duracubes 72 box; Heat holds the 15 foil packs, 18 accessories and no charcoal: ${coal.length}/${heat.length}`);
// the sections the samples leave empty: still there, answering 200, saying the stock is on its way and the phone, kept out of search
const empty = m.CATEGORIES.filter(c => !m.PRODUCTS.some(p => p.cat === c.id)).map(c => c.id);
ok(["cologne", "misc"].every(id => empty.includes(id)) && empty.length === 2, "two sections wait for their stock (Bases, Bowls, Hoses and Parts have Ace accessories since 2026-11-26): " + empty.join(","));
for (const id of empty) { const s = await get("/shop/" + id); ok(s.r.status === 200 && /coming soon to our site/i.test(s.t) && /tel:\+15192552222/.test(s.t) && /<meta name="robots" content="noindex, nofollow">/.test(s.t) && !/"@type":"(ItemList|Product)"/.test(s.t), `/shop/${id}: 200, says coming soon to our site with the phone, noindex, no product data`); }
// every switched-off sample's old address goes to its own section, which says what is coming (one request each)
{ const all = [...SAMPLE_SKUS]; let wrong = [];
  for (const sku of all) { const r = await fetch(B + "/p/" + sku, { redirect: "manual" }); if (["OSS-7005", "OSS-7007"].includes(sku)) { if (r.status !== 404) wrong.push(`${sku}:${r.status}`); continue; }   // listed in case a database kept them; this one never had them
    const sec = ref.PRODUCTS.find(a => a.sku === sku)?.cat || { 7: "cologne", 8: "misc" }[sku[4]]; if (r.status !== 301 || !(r.headers.get("location") || "").endsWith("/shop/" + sec)) wrong.push(`${sku}:${r.status}`); }
  ok(!wrong.length, `every sample's old address redirects to its section (${all.length}): ${wrong.slice(0, 5).join(" ")}`); }
// the Duracubes 72-cube box (OSS-150001, 2026-11-27) is in the shop's photo but not on its price list: Price TBD, not counted
const listed = coal.filter(p => p.sku !== "OSS-150001"), dura = coal.find(p => p.sku === "OSS-150001");
ok(coal.every(p => p.ship === "pickup_only" && p.details.charcoal === true) && listed.every(p => p.stock === 10), "every charcoal item is pickup only; the listed ones start at 10 in stock");
ok(dura && dura.state === "tbd" && dura.price === null && dura.stock === 0 && dura.ship === "pickup_only" && dura.img === "shop/duracubes-coconut-charcoal-cubes-72-cubes" && dura.facts.photo === "own" && !("needs_confirm" in dura.facts) && !("confirm_why" in dura.facts),
  `the Duracubes 72 box: Price TBD, not counted, pickup only, the shop's photo, no internal notes: ${JSON.stringify(dura && { s: dura.state, p: dura.price, st: dura.stock, img: dura.img })}`);
// (a stand-in photo of a similar pack, "Photo to be replaced", as live: tools/fixtures/pack-mains-live-2026-11-28.sql)
// since catalog/live/pack-photos-2026-11-28.sql: 37 (the shop's own photos replaced 3 stand-ins and gave 6 boxes their first photo)
ok(listed.filter(p => p.img && p.details.photo === "approved").length === 37 && listed.every(p => p.img ? ["approved", "replace"].includes(p.details.photo) : p.details.photo === "coming"), "37 charcoal photos on the listed items, stand-ins marked, the rest carry photo status coming");
for (const p of coal.filter(x => x.img)) { const r = await fetch(B + `/img/pc/${p.img}-s.webp`); ok(r.status === 200, `photo ${p.img}-s.webp: ${r.status}`); }
ok((await fetch(B + "/img/pc/coming-charcoal.svg")).status === 200, "the drawn stand-in is served");
// every promise follows the card switch (2026-11-27): with card payment off (this suite's mode, the live demo's) every order is a
// pickup paid at the counter, so the charcoal page says pickup only; with card on it says pickup or local delivery
const coalPage = await get("/p/OSS-9147"), cardOn = /<meta name="oss-pay" content="card">/.test(coalPage.t);
ok((cardOn ? /Pickup in Windsor or local delivery near Windsor\. Not shipped/.test(coalPage.t) : /Pickup in Windsor, paid in the shop\./.test(coalPage.t) && !/local delivery|shipped across/i.test(((coalPage.t.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] || "") + ((coalPage.t.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "")))
  && /og:image" content="[^"]+\/img\/share\.jpg"/.test(coalPage.t), `a charcoal page without a photo says how it is bought (${cardOn ? "pickup or local delivery" : "pickup only, card off"}) and shares the shop image`);
if (!cardOn) {   // card off: no page the shop draws promises local delivery or shipping, in its description, its text or its footer
  for (const path of ["/", "/shop", "/shop/charcoal", "/shop/heat", "/shop/hookahs", "/p/OSS-9147"]) {
    const pg = await get(path), desc = (pg.t.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "", foot = (pg.t.match(/<p class="foot__en">([^<]*)</) || [])[1] || "";
    ok(!/local delivery|shipp|across Canada/i.test(desc + " " + foot) && /pickup|Pickup/.test(foot) && /hidden/.test((pg.t.match(/<div class="dstrip"[^>]*>/) || [""])[0]), `card off, ${path}: description and footer offer pickup only, no delivery bar: "${desc}" / "${foot}"`);
  }
}
// (the field-by-field match of the samples against the mockup file went with the samples: none is in the catalogue now)
for (const [id, a] of Object.entries(ref.BOXES)) { const b = m.BOXES[id]; ok(b && a.l === b.l && a.w === b.w && a.h === b.h && Math.abs(a.tare - b.tare) < 1e-9, "box " + id); }
// an item on sale whose weight is not known yet (foil; an Ace hookah once priced) is pickup or local delivery until it is (2026-11-24)
ok(m.PRODUCTS.every(p => (p.cat === "cologne" ? p.ship === "ground_only" : p.cat === "charcoal" || (p.weightTbd && p.state === "sale") ? p.ship === "pickup_only" : p.ship === "standard") && Number.isInteger(p.stock) && p.stock >= 0), "ship class and stock come through");

// more photos of one item (products.img_more, 2026-11-28): every SKU the seed gives extra photos carries them, in order, each
// served at the main photo's sizes (-s, -m, the 720 and the 1440 -l when lw says so); never on an item without a main photo
// (each line is guarded on the main photo it was framed beside: where the seed's row has another main photo, it gets none)
// A later file that moves the extra photo to the main photo and empties img_more (catalog/live/pack-photos-2026-11-28.sql:
// "UPDATE products SET img = '<new main>', img_lw = ..., img_more = NULL ... WHERE sku = ...") takes that SKU off the list, in seed order,
// and the SKU must then show the new main photo with no gallery.
{ const guard = new Map(), want = new Map(), cleared = new Map();
  for (const f of SEED_FILES) for (const x of readFileSync(seedPath(f), "utf8").matchAll(/^UPDATE products SET (?:img_more = '([^']*)' WHERE sku = '(OSS-\d+)'(?: AND img = '([^']*)')?|img = '([^']*)', img_lw = [^,]+, img_more = NULL[^\n]*\n WHERE sku = '(OSS-\d+)')/gm)) {
    if (x[2]) { guard.set(x[2], x[3]); want.set(x[2], JSON.parse(x[1])); cleared.delete(x[2]); } else { guard.delete(x[5]); want.delete(x[5]); cleared.set(x[5], x[4]); } }
  const notCleared = [...cleared].filter(([sku, img]) => { const p = m.PRODUCTS.find(x => x.sku === sku); return !p || p.img !== img || "more" in p; }).map(([sku]) => sku);
  ok(cleared.size && !notCleared.length, `an extra photo made the main photo shows as the main photo, with no gallery left (${cleared.size}): ` + notCleared.join(" "));
  const g = m.PRODUCTS.filter(p => "more" in p);
  ok(g.every(p => p.img && Array.isArray(p.more) && p.more.length && p.more.every(x => typeof x.img === "string" && x.img !== p.img && (x.lw === undefined || x.lw === 1440))), "img_more only on items with a main photo, never the main photo twice");
  const off = [...want].filter(([sku, l]) => { const p = m.PRODUCTS.find(x => x.sku === sku); if (!p) return false; const applies = guard.get(sku) === undefined || guard.get(sku) === p.img;
    return JSON.stringify((p.more || []).map(x => x.img)) !== JSON.stringify(applies ? l.map(x => x.img) : []); }).map(([sku]) => sku);
  const absent = [...want.keys()].filter(sku => !m.PRODUCTS.some(x => x.sku === sku));
  const skipped = [...want.keys()].filter(sku => { const p = m.PRODUCTS.find(x => x.sku === sku); return p && guard.get(sku) !== undefined && guard.get(sku) !== p.img; });
  ok(!off.length, "the seed's extra photos come through in order: " + off.join(" "));
  ok(!absent.length, "every SKU given extra photos is on view: missing " + absent.join(" "));
  ok(!skipped.length, "every img_more line's main-photo guard holds in the seed (as it must live): " + skipped.join(" "));
  ok(g.length >= want.size, `every SKU given extra photos has its gallery (${g.length} of ${want.size})`);
  for (const p of g) for (const x of p.more) for (const suf of ["", "-s", "-m", ...(x.lw ? ["-l"] : [])]) { const r = await fetch(B + `/img/pc/${x.img}${suf}.webp`, { signal: AbortSignal.timeout(15000) }); ok(r.status === 200 && r.headers.get("content-type") === "image/webp", `extra photo ${x.img}${suf}.webp of ${p.sku}: ${r.status}`); await r.arrayBuffer(); } }
const post = await fetch(B + "/api/catalog", { method: "POST" }); ok(post.status === 405, "POST /api/catalog gave " + post.status);
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`);
process.exit(f ? 1 : 0);
