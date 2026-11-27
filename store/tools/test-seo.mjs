// Search and sharing checks (store/docs/SEO.md): structured data validated against schema.org's own vocabulary, the
// server-written content, robots.txt, the sitemap, share images, per-photo versions and the public catalogue feed.
// Google's Rich Results Test only runs online, so the shapes are checked here instead: every property must belong to its
// type in schema.org (tools/fixtures/schema-org-subset.json, cut from schemaorg-current-https.jsonld), every enumeration
// value must be a real member, and Google's required fields (merchant listings, local business, breadcrumbs) must be there.
//   node store/tools/test-seo.mjs       against the running local store (LIVE "0", the demo). Read-only: changes nothing.
//   BASE_LIVE=http://127.0.0.1:4495 node store/tools/test-seo.mjs     also checks a second store started with --var LIVE:1
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const B = (process.env.BASE || "http://127.0.0.1:4494").replace(/\/$/, ""), BL = (process.env.BASE_LIVE || "").replace(/\/$/, "");
const STORE = new URL("../", import.meta.url);
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const get = async (p, base = B, opt = {}) => { const r = await fetch(base + p, { redirect: "manual", ...opt }); return { r, t: await r.text() }; };
const SCHEMA = JSON.parse(readFileSync(new URL("fixtures/schema-org-subset.json", import.meta.url), "utf8"));
const lds = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const mainOf = html => (html.match(/<main id="main"[^>]*>([\s\S]*?)<\/main>/) || ["", ""])[1];
const abs = u => typeof u === "string" && /^https?:\/\/[^/]+\//.test(u);

// ---------- a schema.org shape check ----------
const ENUM = { availability: "ItemAvailability", itemCondition: "OfferItemCondition", returnPolicyCategory: "MerchantReturnEnumeration", availableDeliveryMethod: "DeliveryMethod", dayOfWeek: "DayOfWeek" };
function shape(o, where, errs = []) {
  if (Array.isArray(o)) { o.forEach((x, i) => shape(x, `${where}[${i}]`, errs)); return errs; }
  if (!o || typeof o !== "object") return errs;
  const t = o["@type"];
  if (t) {
    const def = SCHEMA.types[t]; if (!def) { errs.push(`${where}: type ${t} not in the checked set`); return errs; }
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith("@")) continue;
      if (!def.props.includes(k)) errs.push(`${where}: ${k} is not a schema.org property of ${t}`);
      if (ENUM[k]) for (const x of [].concat(v)) { const m = String(x).match(/^https:\/\/schema\.org\/(\w+)$/), name = m ? m[1] : String(x); if (!SCHEMA.enums[ENUM[k]].includes(name) || (!m && k !== "dayOfWeek")) errs.push(`${where}: ${k} = ${x} is not a ${ENUM[k]} (full https://schema.org/ address expected)`); }
      shape(v, `${where}.${k}`, errs);
    }
  }
  return errs;
}

// ---------- what the shop holds (the same module the page draws from) ----------
const mod = await (await fetch(B + "/api/catalog-module")).text(), { PRODUCTS: P, CATEGORIES: C } = await import("data:text/javascript," + encodeURIComponent(mod));
const bySku = new Map(P.map(p => [p.sku, p]));
const shelf = P.filter(p => !p.family || p.lead);
const sale = P.filter(p => p.state === "sale"), tbd = P.filter(p => p.state === "tbd");
ok(sale.length > 0 && tbd.length > 0, `the seed has items on sale (${sale.length}) and Price TBD items (${tbd.length})`);

// supplier prices: never on any page a shopper or a crawler can reach
const master = JSON.parse(readFileSync(new URL("../catalog/suppliers/ace/master.json", import.meta.url), "utf8"));
const supplier = new Map(); for (const fam of master.families) for (const v of fam.variants) supplier.set(v.sku, fam.supplier_price_cents.v);

// ---------- 1 robots, sitemap, noindex while not live ----------
const rb = await get("/robots.txt");
ok(rb.r.status === 200 && /^text\/plain/.test(rb.r.headers.get("content-type") || ""), "robots.txt is served as text: " + rb.r.status);
for (const line of ["Disallow: /admin", "Disallow: /api/", "Allow: /api/catalog-module", "Allow: /api/photo/", "Disallow: /account$", "Disallow: /account/", "Disallow: /checkout$", "Disallow: /checkout/"]) ok(rb.t.split("\n").includes(line), "robots.txt: " + line);
ok(!/Disallow: \/(cart|order)/.test(rb.t), "robots.txt leaves /cart and /order/ crawlable so their noindex is seen (the cart is linked from every page)");
ok(!/Sitemap:/i.test(rb.t), "demo: robots.txt names no sitemap");
// Google's rule: the longest matching Allow/Disallow wins ("*" any run, "$" the end). Every file a page loads must be allowed.
const toRe = v => { const end = v.endsWith("$"), body = end ? v.slice(0, -1) : v; return new RegExp("^" + body.split("").map(ch => ch === "*" ? ".*" : /[.+?^{}()|[\]\\$]/.test(ch) ? "\\" + ch : ch).join("") + (end ? "$" : "")); };
const rules = rb.t.split("\n").map(l => l.match(/^(Allow|Disallow): (\S+)/)).filter(Boolean).map(([, k, v]) => ({ allow: k === "Allow", len: v.length, re: toRe(v) }));
const allowed = p => { const m = rules.filter(r => r.re.test(p)).sort((a, b) => b.len - a.len || b.allow - a.allow)[0]; return !m || m.allow; };
const shellHtml = (await get("/")).t, loads = [...shellHtml.matchAll(/(?:src|href)="\/?([a-z0-9-]+\.(?:js|css))[^"]*"/g)].map(x => "/" + x[1]);
const appJs = await (await fetch(B + "/app.js")).text(); for (const m of appJs.matchAll(/from "\.\/([a-z0-9-]+\.js)"/g)) loads.push("/" + m[1]);
ok(loads.length > 3 && loads.every(allowed) && ["/account.js", "/account.css", "/api/catalog-module", "/api/photo/OSS-9601"].every(allowed), "robots.txt lets crawlers load every script and stylesheet a page needs: " + loads.filter(p => !allowed(p)).join(", "));
ok(!allowed("/account") && !allowed("/account/") && !allowed("/checkout") && !allowed("/admin") && !allowed("/api/orders"), "robots.txt still keeps out /account, /checkout, /admin and the data routes");
ok(!/Disallow: \/\s*$/m.test(rb.t), "robots.txt never blocks the whole shop (Google must reach the noindex on each page)");
const sm = await get("/sitemap.xml"); ok(sm.r.status === 404, "demo: no sitemap: " + sm.r.status);
const pages = ["/", "/shop", "/shop/" + C[0].id, "/p/" + sale[0].sku, "/p/" + tbd[0].sku, "/shipping", "/account", "/cart", "/checkout", "/search"];
for (const p of pages) { const g = await get(p); ok(/<meta name="robots" content="noindex, nofollow">/.test(g.t) && g.r.headers.get("x-robots-tag") === "noindex, nofollow", `demo: ${p} says noindex in the page and the header`); }
const adm = await get("/admin"); ok(adm.r.headers.get("x-robots-tag") === "noindex, nofollow", "the back office is noindex");

// ---------- 2 the home page: the shop, its hours from the code, the sections ----------
const home = await get("/");
const store = lds(home.t).find(x => x["@type"] === "Store");
ok(store, "home carries Store data");
if (store) {
  ok(shape(store, "Store").length === 0, "Store matches schema.org: " + shape(store, "Store").join("; "));
  ok(store.name && store.address && store.address.streetAddress === "760 Wyandotte St E" && store.address.addressLocality === "Windsor" && store.address.addressRegion === "ON" && store.address.addressCountry === "CA" && /^N9A 3J4$/.test(store.address.postalCode), "Store: name and full Windsor address");
  ok(/^\+1-519-255-2222$/.test(store.telephone) && abs(store.url) && abs(store.image), "Store: phone with country code, absolute url and image");
  ok(String(store.geo.latitude).split(".")[1].length >= 5 && String(store.geo.longitude).split(".")[1].length >= 5, "Store: coordinates to 5 decimals (Google's minimum)");
  const { SHOP_HOURS } = await import(new URL("../public/rates-core.js", import.meta.url));
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], said = {};
  for (const h of store.openingHoursSpecification) for (const d of [].concat(h.dayOfWeek)) said[d] = [h.opens, h.closes];
  ok(DAYS.every((d, i) => said[d] && said[d][0] === String(SHOP_HOURS[i][0]).padStart(2, "0") + ":00" && said[d][1] === String(SHOP_HOURS[i][1]).padStart(2, "0") + ":00"), "Store: opening hours are the code's SHOP_HOURS, every day: " + JSON.stringify(said));
  ok(store.hasMerchantReturnPolicy && store.hasMerchantReturnPolicy.applicableCountry === "CA" && /MerchantReturnNotPermitted$/.test(store.hasMerchantReturnPolicy.returnPolicyCategory), "Store: return policy says final sale (terms), country CA");
}
const hm = mainOf(home.t);
ok(/<section class="ssr"/.test(hm) && /<h1>One Stop Shop<\/h1>/.test(hm), "home: content written into the page for crawlers");
ok(C.filter(c => P.some(p => p.cat === c.id)).every(c => hm.includes(`href="/shop/${c.id}"`)), "home: every section with something on view is linked in the HTML");
ok(/<style>\.ssr\{display:none\}/.test(home.t) && /<noscript><style>\.ssr\{display:block/.test(home.t), "the written content is hidden for people with JavaScript (the page draws its own), shown without it");
ok(/og:image" content="https?:\/\/[^"]+\/img\/share\.jpg"/.test(home.t) && /og:image:width" content="1200"/.test(home.t) && /og:image:height" content="630"/.test(home.t) && /og:image:alt" content="[^"]+"/.test(home.t), "home: the shop's share card, absolute, sized, with alt text");

// ---------- 3 every product page: content, Product + Offer, breadcrumbs ----------
let badShape = [], offerWrong = [], tbdLeak = [], supplierLeak = [], ssrWrong = [], crumbWrong = [], canonWrong = [], shareWrong = [];
const checkProduct = async p => {
  const g = await get("/p/" + p.sku); if (g.r.status !== 200) { ssrWrong.push(p.sku + " " + g.r.status); return; }
  const all = lds(g.t), prod = all.find(x => x["@type"] === "Product"), crumbs = all.find(x => x["@type"] === "BreadcrumbList"), m = mainOf(g.t);
  // Product data only for an item on sale (Google needs an offer); Price TBD and Coming soon items carry none at all
  if (p.state === "sale" && !prod) { badShape.push(p.sku + " on sale but no Product"); return; }
  if (prod) { const e = shape(prod, p.sku); if (e.length) badShape.push(...e); if (!prod.name || !prod.sku || prod.sku !== p.sku || (prod.image && !prod.image.every(abs))) badShape.push(p.sku + " name/sku/image"); }
  const lp = p.family && P.find(x => x.family === p.family && x.lead), lead = !lp || (p.state === "sale" && lp.state !== "sale") ? p.sku : lp.sku, canon = (g.t.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
  if (!canon || !canon.endsWith("/p/" + lead) || !abs(canon)) canonWrong.push(`${p.sku} -> ${canon}`);
  if (p.state === "sale") {
    const o = prod.offers;
    if (!o || o.price !== p.price.toFixed(2) || o.priceCurrency !== "CAD" || o.availability !== "https://schema.org/" + (p.stock > 0 ? "InStock" : "OutOfStock") || !abs(o.url) || !o.itemCondition) offerWrong.push(`${p.sku} ${JSON.stringify(o)}`);
    if (o && p.ship === "pickup_only" && [].concat(o.availableDeliveryMethod).some(x => /ParcelService/.test(x))) offerWrong.push(p.sku + " pickup-only item offered by parcel");
    const money = "$" + p.price.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!m.includes(`<h1>${p.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h1>`) || !m.includes(money)) ssrWrong.push(p.sku + " sale block");
  } else {
    // Price TBD / coming soon: no Product, no offer, no price in the data; a TBD item has no "$" in the written content
    // or the descriptions either (a coming-soon item may show the shop's own price, as its page sticker does)
    const desc = (g.t.match(/<meta property="og:description" content="([^"]*)"/) || ["", ""])[1] + (g.t.match(/<meta name="description" content="([^"]*)"/) || ["", ""])[1];
    if (prod || /"price"|"offers"/.test(JSON.stringify(all)) || (p.state === "tbd" && (/\$\d/.test(m) || /\$\d/.test(desc)))) tbdLeak.push(p.sku);
    if (p.state === "tbd" && !m.includes("Price TBD")) ssrWrong.push(p.sku + " says no Price TBD");
  }
  if (supplier.has(p.sku)) { const sp = supplier.get(p.sku) / 100, txt = JSON.stringify(all) + m + (g.t.match(/<meta property="og:description" content="([^"]*)"/) || ["", ""])[1]; if (txt.includes("$" + sp.toFixed(2)) || txt.includes(`"${sp.toFixed(2)}"`) || txt.includes(`"price":${sp}`)) supplierLeak.push(p.sku); }
  if (!crumbs || shape(crumbs, "crumbs").length || crumbs.itemListElement.some((x, i) => x.position !== i + 1 || !abs(x.item) || !x.name) || crumbs.itemListElement.at(-1).item !== canon) crumbWrong.push(p.sku);
  if (!/<nav aria-label="Breadcrumb">/.test(m)) crumbWrong.push(p.sku + " no visible trail");
  const img = (g.t.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
  // the files the live site already shares (owner: no new share card until he approves a still): an uploaded photo as it
  // is, else the product's own photo, else the shop's card; never a generated card under img/share/
  const want = p.photo ? p.img : p.img && !p.img.startsWith("/") ? `/img/pc/${p.img}.webp` : "/img/share.jpg";
  if (!abs(img) || !img.endsWith(want) || /\/img\/share\//.test(img)) shareWrong.push(`${p.sku} ${img} (want ${want})`);
};
for (let i = 0; i < P.length; i += 16) await Promise.all(P.slice(i, i + 16).map(checkProduct));
ok(badShape.length === 0, `every product's data matches schema.org (${P.length} pages): ` + badShape.slice(0, 5).join("; "));
ok(offerWrong.length === 0, "every item on sale states the shop's price, CAD, condition and availability from its real stock: " + offerWrong.slice(0, 3).join("; "));
ok(tbdLeak.length === 0, `no Price TBD or coming-soon item states any price or offer (${tbd.length} TBD): ` + tbdLeak.slice(0, 5).join(", "));
ok(supplierLeak.length === 0, "no supplier price appears on any product page: " + supplierLeak.slice(0, 5).join(", "));
ok(ssrWrong.length === 0, "every product page carries its name, price or Price TBD in the HTML: " + ssrWrong.slice(0, 5).join("; "));
ok(crumbWrong.length === 0, "every product page has breadcrumbs (data and a visible trail), ending at its canonical address: " + crumbWrong.slice(0, 5).join(", "));
ok(canonWrong.length === 0, "canonical: absolute, and a hookah colour points at its family's lead colour: " + canonWrong.slice(0, 3).join("; "));
ok(shareWrong.length === 0, "share image: absolute, the item's uploaded photo, else its own photo, else the shop's card (no new cards): " + shareWrong.slice(0, 3).join("; "));

// ---------- 4 section pages ----------
// Every shop page opens with its band in the HTML, shown from the first paint, exactly the markup the page draws (public/band.js),
// so the page keeps it in place: its tone, its name as the page's only h1, and its counted line. The hidden copy carries no h1.
{ const { shopBand, openLine } = await import(new URL("../public/band.js", import.meta.url));
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const wrong = [];
  for (const c of [...C, null]) {
    const at = openLine(), g = await get(c ? "/shop/" + c.id : "/shop"), m = mainOf(g.t);
    const want = shopBand(c, c ? shelf.filter(p => p.cat === c.id) : shelf), head = m.slice(0, want.length);
    const tone = c ? c.tone : "bone", name = c ? esc(c.name) : "Everything";
    if (head !== want && openLine() === at) wrong.push(`${c ? c.id : "shop"}: ${JSON.stringify(head.slice(0, 160))}`);   // a minute turning over mid-check is not a failure
    if (!head.includes(`class="shophead" data-tone="${tone}"`) || !head.includes(`<h1 class="shophead__h">${name}</h1>`) || (m.match(/<h1[\s>]/g) || []).length !== 1) wrong.push(`${c ? c.id : "shop"}: tone ${tone}, h1 ${name}`);
    if (/<section class="ssr"[^>]*>[^]*?<h1/.test(m)) wrong.push(`${c ? c.id : "shop"}: a second h1 in the hidden copy`);
  }
  ok(wrong.length === 0, `every shop page (${C.length} sections and Everything) has the page's own band in its HTML, with its tone and title: ${wrong.slice(0, 3).join("; ")}`);
  ok(/<style>\.ssr\{display:none\}#main:has\(>\.ssr\)\{min-height:100svh\}/.test((await get("/shop/" + C[0].id)).t), "a shop page holds the full screen under its band until the page draws, so the footer never jumps");
  // the delivery question above the band is drawn open when the page will open it (a first visit to a section that ships), so the band never moves down
  const strip = t => { const s = (t.match(/<div class="dstrip"[^>]*>/) || [""])[0]; return { open: !/\shidden/.test(s) && /data-mode="choose"/.test(s), btnHidden: /<button class="dstrip__btn"[^>]*\shidden/.test(t), chooseOpen: /<div class="dchoose"(?![^>]*\shidden)/.test(t) }; };
  const card = /<meta name="oss-shisha-card" content="1">/.test((await get("/shop")).t);
  const never = c => { const l = P.filter(p => p.cat === c.id && p.state === "sale"); return l.length > 0 && l.every(p => p.ship === "pickup_only" || p.details?.charcoal || ((p.cat === "shisha" || p.details?.tobacco) && !card)); };   // app.js syncDelivery's rule
  const renew = (await get("/shop/" + C[0].id, B, { headers: { Cookie: "oss-ask=0" } })).r.headers.get("set-cookie") || "";
  ok(/^oss-ask=0; Path=\/; Max-Age=31536000; SameSite=Lax/.test(renew) && !(await get("/shop/" + C[0].id)).r.headers.get("set-cookie"), "the Worker renews the page's oss-ask as it came (Safari drops script cookies after 7 days), and sets none of its own: " + renew);
  const ships = C.find(c => !never(c));
  const first = strip((await get("/shop/" + ships.id)).t), back = strip((await get("/shop/" + ships.id, B, { headers: { Cookie: "a=1; oss-ask=0" } })).t), coal = strip((await get("/shop/charcoal")).t), home = strip((await get("/")).t);
  ok(first.open && first.btnHidden && first.chooseOpen, `/shop/${ships.id}, first visit: the delivery question is drawn open, as the page draws it: ${JSON.stringify(first)}`);
  ok(!back.open && !back.chooseOpen && !coal.open && !home.open, `drawn closed once answered (oss-ask=0), in a section that never ships, and off the shop pages: ${JSON.stringify({ back, coal, home })}`);
}
for (const c of C) {
  const g = await get("/shop/" + c.id), m = mainOf(g.t);
  ok(!/in stock/i.test(m + (g.t.match(/<meta name="description" content="([^"]*)"/) || ["", ""])[1]), `/shop/${c.id}: the section never claims its items are in stock (some may be sold out)`);
  const want = shelf.filter(p => p.cat === c.id), links = [...m.matchAll(/<li><a href="\/p\/(OSS-\d+)"/g)].map(x => x[1]);
  if (!want.length) continue;
  ok(links.length === want.length && want.every(p => links.includes(p.sku)), `/shop/${c.id}: one entry per item a shopper sees (${links.length} of ${want.length})`);
  ok(want.filter(p => p.state === "tbd").every(p => new RegExp(`/p/${p.sku}"[^]*?</a> <span>Price TBD</span>`).test(m)), `/shop/${c.id}: TBD items say Price TBD, never a number`);
  const cr = lds(g.t).find(x => x["@type"] === "BreadcrumbList"); ok(cr && cr.itemListElement.length === 3 && cr.itemListElement[2].name === c.name, `/shop/${c.id}: breadcrumbs Home > Shop > ${c.name}`);
  ok(!/loading="eager"|<img(?![^>]*loading="lazy")[^>]*>/.test(m), `/shop/${c.id}: written pictures are lazy, so nobody with JavaScript downloads them`);
}

// ---------- 5 share images and per-photo versions ----------
const vers = JSON.parse(readFileSync(new URL("../src/img-versions.json", import.meta.url), "utf8"));
const { stems: photoStems, version } = await import(new URL("./photo-versions.mjs", import.meta.url));
const stems = photoStems(), stale = stems.filter(s => vers[s] !== version(s));
ok(stale.length === 0, `every photo's version matches its files (run node store/tools/photo-versions.mjs after changing photos): ${stale.slice(0, 5).join(", ")}`);
ok(P.filter(p => p.img && !p.photo && vers[p.img]).every(p => p.iv === vers[p.img]), "the catalogue hands the page each photo's own version");
ok(!existsSync(fileURLToPath(new URL("../public/img/share/", import.meta.url))) && !existsSync(fileURLToPath(new URL("../tools/build-share.py", import.meta.url))), "no generated share cards in the build (parked until the owner approves a still)");
const jpegSize = buf => { for (let i = 2; i < buf.length;) { const m = buf[i + 1], len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + len; } return null; };
for (const p of [sale.find(x => x.img && x.iv), tbd.find(x => x.img && x.iv)].filter(Boolean)) {
  const g = await get("/p/" + p.sku), u = g.t.match(/<meta property="og:image" content="([^"]+)"/)[1], r = await fetch(u.replace(/^https?:\/\/[^/]+/, B));
  ok(r.status === 200 && /^image\//.test(r.headers.get("content-type") || ""), `${p.sku}: its share image loads: ${r.status} ${r.headers.get("content-type")}`);
  ok(/og:image:alt" content="[^"]+"/.test(g.t), p.sku + ": the share image has alt text");
  const pic = await fetch(`${B}/img/pc/${p.img}-s.webp?v=${p.iv}`); ok(pic.status === 200, `${p.sku}: the versioned photo address loads`);
}
const sh = await fetch(B + "/img/share.jpg"), shb = Buffer.from(await sh.arrayBuffer()); ok(sh.status === 200 && JSON.stringify(jpegSize(shb)) === "[1200,630]", "the shop's card is 1200 x 630");
const live0 = execSync("git show 0d6ac11:store/public/img/share.jpg", { cwd: fileURLToPath(STORE), maxBuffer: 1 << 24 });
ok(Buffer.compare(shb, live0) === 0, "the shop's card is the one the live site shares today (0d6ac11), not the parked redraw");

// ---------- 6 the public catalogue feed ----------
const feed = await fetch(B + "/api/catalog"), tag = feed.headers.get("etag"), fj = await feed.json();
ok(feed.headers.get("cache-control") === "no-cache" && /^"f[0-9a-z]+-\d+"$/.test(tag || ""), "feed: tagged and always checked (never stale stock): " + feed.headers.get("cache-control") + " " + tag);
ok((await fetch(B + "/api/catalog", { headers: { "If-None-Match": tag } })).status === 304, "feed: an unchanged feed answers 304 without the body");
ok((await fetch(B + "/api/catalog", { headers: { "If-None-Match": `"old", W/${tag}` } })).status === 304, "feed: a list of tags, weak or strong, still matches");
const KEYS = ["sku", "name", "category_id", "price_cents", "weight_g", "box_id", "glass", "ship_class", "height_cm", "note", "img", "stock", "for_sale", "details"];
ok(fj.products.every(p => Object.keys(p).every(k => KEYS.includes(k))), "feed: only public fields (no cost, supplier, facts or switches)");
const DET = ["charcoal", "brand", "variant", "shape", "box_sku", "photo", "description", "ml", "kind", "notes"];
ok(fj.products.every(p => Object.keys(JSON.parse(p.details)).every(k => DET.includes(k))), "feed: details carry only the public keys");
ok(fj.products.filter(p => !p.for_sale).every(p => p.stock === 0 && p.price_cents === null || p.price_cents > 0 && p.stock === 0), "feed: nothing off sale shows a stock count");
const aceFeed = fj.products.filter(p => supplier.has(p.sku)); ok(aceFeed.length > 0 && aceFeed.every(p => p.weight_g === null && p.price_cents === null), "feed: a TBD hookah shows no price and no placeholder weight");
ok(!JSON.stringify(fj).match(/supplier|cost_cents|facts_known|photo_rights|source_lines/), "feed: no internal field names at all");

// ---------- 7 the live switch, without a second server: the module's own rules ----------
const seo = await import(new URL("../src/seo.js", import.meta.url));
const u = s => new URL(s), demo = u("https://onestopshop-store.anas-dev.workers.dev/p/OSS-9601"), own = u("https://shop.example.ca/p/OSS-9601");
ok(!seo.liveHere({ LIVE: "0" }, own), "LIVE 0: nothing is indexable");
for (const bad of ["shop.example.ca", "http://shop.example.ca", "https://shop.example.ca:443", "https://shop.example.ca/shop", "javascript:alert(1)"])
  ok(!seo.liveHere({ LIVE: "1", SITE_ORIGIN: bad }, demo) && !seo.liveHere({ LIVE: "1", SITE_ORIGIN: bad }, own) && seo.siteOrigin({ SITE_ORIGIN: bad }, demo) === demo.origin && !seo.robots({ LIVE: "1", SITE_ORIGIN: bad }, demo).includes("Sitemap:"), `a malformed SITE_ORIGIN (${bad}) fails closed: nothing indexable, no sitemap`);
ok(seo.liveHere({ LIVE: "1" }, own), "LIVE 1 with no SITE_ORIGIN: the address asked for is the shop's");
ok(seo.liveHere({ LIVE: "1", SITE_ORIGIN: "https://shop.example.ca" }, own) && !seo.liveHere({ LIVE: "1", SITE_ORIGIN: "https://shop.example.ca" }, demo), "LIVE 1 with SITE_ORIGIN: only the shop's own address is indexable, the workers.dev copy is not");
ok(seo.siteOrigin({ SITE_ORIGIN: "https://Shop.Example.ca/" }, demo) === "https://shop.example.ca", "SITE_ORIGIN: https://host, case and one trailing slash forgiven");
const env = { LIVE: "1", SITE_ORIGIN: "https://shop.example.ca" };
ok(seo.robots(env, own).includes("Sitemap: https://shop.example.ca/sitemap.xml") && !seo.robots(env, demo).includes("Sitemap:"), "live: robots.txt names the sitemap on the shop's address only");
const fake = { categories: C.map(c => ({ id: c.id, name: c.name, tone: c.tone })), boxes: [], products: [] };
// a small catalogue in the database's shape: one item on sale, one Ace colour family of two, one coming soon
const row = (sku, o) => ({ sku, name: "Item " + sku, category_id: o.cat || "bowls", price_cents: o.price ?? 0, weight_g: 500, box_id: "XS", glass: 0, ship_class: "standard", height_cm: null, note: "", img: null, img_dark: 0, img_lw: null, photo_ver: 0, details: "{}", stock: o.stock ?? 0, active: o.active ?? 0, listed: o.listed ?? 1, family: o.family || null, variant_label: null, swatch_hex: null, availability: "unknown", facts_known: "{}" });
fake.products = [row("OSS-2001", { price: 2500, stock: 3, active: 1 }), row("OSS-100001", { cat: "hookahs", family: "ace-x" }), row("OSS-100002", { cat: "hookahs", family: "ace-x" }), row("OSS-2002", { price: 999 })];
const map = seo.sitemap(env, own, fake), locs = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]);
ok(locs.every(l => l.startsWith("https://shop.example.ca/")), "sitemap: every address absolute on SITE_ORIGIN");
ok(locs.includes("https://shop.example.ca/p/OSS-2001") && locs.includes("https://shop.example.ca/p/OSS-100001") && !locs.includes("https://shop.example.ca/p/OSS-100002"), "sitemap: items on view, one per hookah family");
ok(!locs.some(l => /\/(cart|checkout|account|admin|api|search|gifts|order)\b/.test(l)), "sitemap: no private, search or noindex pages");
ok(locs.includes("https://shop.example.ca/shop/bowls") && locs.includes("https://shop.example.ca/shop/hookahs") && !locs.some(l => /\/shop\/(?!bowls$|hookahs$)/.test(l)), "sitemap: only sections with something on view");
{ const withCoal = { ...fake, products: [...fake.products, row("OSS-9301", { cat: "charcoal", price: 1500, stock: 2, active: 1 })] }, cm = seo.sitemap(env, own, withCoal);
  ok(cm.includes("<loc>https://shop.example.ca/shop/charcoal</loc>") && !/<loc>[^<]*\?/.test(cm), "sitemap: the Charcoal section is listed; no redirecting Heat filter address (or any query) is"); }
const fromHeat = await get("/shop/heat?find=1"); ok(fromHeat.r.headers.get("x-robots-tag") === "noindex, nofollow", "demo: a redirect says noindex too"); for (const q of ["/api/nope", "/index.html"]) ok(((await get(q)).r.headers.get("x-robots-tag") || "") === "noindex, nofollow", "demo: noindex on " + q);
ok(fromHeat.r.status === 301 && /\/shop\/charcoal\?find=1$/.test(fromHeat.r.headers.get("location") || ""), "an old charcoal link into Heat is a 301 to Charcoal: " + fromHeat.r.status + " " + fromHeat.r.headers.get("location"));
{ const mixed = { ...fake, products: [row("OSS-100011", { cat: "hookahs", family: "ace-y" }), row("OSS-100012", { cat: "hookahs", family: "ace-y", price: 9900, stock: 1, active: 1 })] };
  const sc = seo.seoFor({ env, url: own, cat: mixed, meta: { title: "x", desc: "x", index: true, product: mixed.products[1] }, site: "One Stop Shop" }), lm = seo.sitemap(env, own, mixed);
  ok(sc.canonical === "https://shop.example.ca/p/OSS-100012" && !/OSS-100011/.test(sc.head.join("")) && lm.includes("/p/OSS-100012</loc>") && lm.includes("/p/OSS-100011</loc>"), "a colour on sale whose lead is Price TBD keeps its own canonical, offer address and sitemap entry: " + sc.canonical); }
const s1 = seo.seoFor({ env, url: u("https://onestopshop-store.anas-dev.workers.dev/p/OSS-100002"), cat: fake, meta: { title: "x", desc: "x", index: true, product: fake.products[2] }, site: "One Stop Shop" });
ok(s1.canonical === "https://shop.example.ca/p/OSS-100001", "canonical on the demo address points at the shop's own address and the family lead: " + s1.canonical);
const s2 = seo.seoFor({ env, url: own, cat: fake, meta: { title: "x", desc: "x", index: true, product: fake.products[3] }, site: "One Stop Shop" });
ok(!/"offers"|"Product"/.test(s2.head.join("")) && /\$9\.99, coming soon/.test(s2.body), "a priced item not switched on: no Product or offer data; the written content says its shop price, coming soon, as the page does");
// Build a set is listed only when a set can be built (something on sale and in stock in hookahs, bowls or hoses): the
// samples came off on 2026-11-24, and a page that only says "arriving soon" is kept out of the sitemap (and says noindex)
ok(locs.includes("https://shop.example.ca/set"), "sitemap: /set while a bowl is on sale");
{ const none = { ...fake, products: fake.products.filter(p => !(p.active && ["hookahs", "bowls", "hoses"].includes(p.category_id))) }, nm = seo.sitemap(env, own, none);
  ok(!nm.includes("/set</loc>") && !seo.setReady(none) && seo.setReady(fake), "sitemap: no /set while no set can be built"); }
// the live switch and the samples list are the same SKUs (the hookahs went off earlier, with the Ace catalogue)
{ const { SAMPLE_SKUS } = await import("../src/samples.js"), sql = readFileSync(new URL("../catalog/live/samples-off-2026-11-24.sql", import.meta.url), "utf8");
  const lists = [...sql.matchAll(/sku IN \(([^)]*)\)/g)].map(x => [...x[1].matchAll(/'(OSS-\d+)'/g)].map(y => y[1]).sort().join(","));
  const want = [...SAMPLE_SKUS].filter(s => !/^OSS-1/.test(s)).sort().join(",");
  ok(lists.length === 2 && lists.every(l => l === want) && want.split(",").length === 64, "samples-off SQL switches off exactly the 64 non-hookah sample numbers of src/samples.js, in both statements"); }
// an empty section (Cologne and Misc since 2026-11-26; Bowls and the rest hold Ace accessories) answers 200, says noindex and
// the stock is coming, and is not in the demo's page data as a list of products
{ const e = await get("/shop/misc"); ok(e.r.status === 200 && /<meta name="robots" content="noindex, nofollow">/.test(e.t) && /Misc: coming soon to our site/.test(e.t) && !/"ItemList"/.test(e.t), "an empty section: 200, noindex, says it is coming soon to the site"); }
// a section holding only Price TBD accessories: a real page with its items, and no price or "in stock" offer in its data
{ const b = await get("/shop/bowls"); ok(b.r.status === 200 && !/Bowls: coming soon to our site/.test(b.t) && !/"price"\s*:/.test(b.t) && !/InStock/.test(b.t), "Bowls (Ace accessories, Price TBD): a real section page, no price or in-stock offer in its data"); }

// ---------- 8 a second store started with LIVE "1" (optional) ----------
if (BL) {
  const h = await get("/", BL), p = await get("/p/" + sale[0].sku, BL), sm2 = await get("/sitemap.xml", BL), rb2 = await get("/robots.txt", BL);
  ok(!/name="robots"/.test(h.t) && !h.r.headers.get("x-robots-tag"), "live: the home page can be indexed");
  ok(!/name="robots"/.test(p.t) && !p.r.headers.get("x-robots-tag"), "live: a product page can be indexed");
  // an empty section (2026-11-24) and a set that cannot be built stay noindex when live
  for (const q of ["/account", "/cart", "/checkout", "/search", "/order/WABCDEF", "/shop/misc", ...(sm2.t.includes("/set</loc>") ? [] : ["/set"])]) { const g = await get(q, BL); ok(/noindex/.test(g.r.headers.get("x-robots-tag") || "") && /<meta name="robots" content="noindex/.test(g.t), "live: still noindex " + q); }
  ok((await get("/admin", BL)).r.headers.get("x-robots-tag") === "noindex, nofollow", "live: the back office stays noindex");
  ok(sm2.r.status === 200 && /<urlset/.test(sm2.t) && !/\/(cart|checkout|account|admin|gifts)/.test(sm2.t) && rb2.t.includes(`Sitemap: ${BL}/sitemap.xml`), "live: sitemap served and named in robots.txt");
  const locs2 = [...sm2.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1].replace(BL, ""));
  ok(locs2.filter(l => l.startsWith("/p/")).length === shelf.length, `live: the sitemap lists every item a shopper can open, once (${locs2.filter(l => l.startsWith("/p/")).length} of ${shelf.length})`);
  for (const l of locs2.slice(0, 40)) { const g = await get(l, BL); if (g.r.status !== 200 || /name="robots"/.test(g.t)) ok(false, "live: sitemap address is a 200 indexable page: " + l); }
}

console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
