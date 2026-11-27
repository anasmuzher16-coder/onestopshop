// What search engines and link previews read: the canonical address, robots.txt, the sitemap, structured data
// (JSON-LD), share images and a server-written copy of each page's content. Sources and rulings: store/docs/SEO.md.
//
// One switch turns it on. While LIVE is not "1" every page says noindex and there is no sitemap. Once LIVE is "1",
// the pages on the shop's own address (SITE_ORIGIN, e.g. https://onestopshopwindsor.ca) are indexable; the same pages
// reached any other way (the workers.dev demo address) keep noindex and point their canonical at SITE_ORIGIN.
import { sellable, counterRow, counterPayRow, toStorefront, IMG_VERSIONS } from "./catalog.js";
import { SHOP_HOURS } from "../public/rates-core.js";
import { shopBand } from "../public/band.js";
import { shelfOf } from "../public/picks.js";

const SHOP = { phone: "+1-519-255-2222", street: "760 Wyandotte St E", city: "Windsor", region: "ON", postal: "N9A 3J4", country: "CA",
  geo: { latitude: 42.3179407, longitude: -83.0263116 }, sameAs: ["https://www.instagram.com/one1_stop_shop/", "https://www.tiktok.com/@onestopshop6"] };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// SITE_ORIGIN: empty means "the address asked for"; set, it must be exactly https://host (one trailing slash allowed).
const setting = env => { const raw = String(env.SITE_ORIGIN || "").trim(), o = raw.replace(/\/$/, "");
  return !raw ? { set: false } : /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(o) ? { set: true, ok: true, origin: o.toLowerCase() } : { set: true, ok: false }; };
// The address canonicals, the sitemap and share images use.
export function siteOrigin(env, url) { const s = setting(env); return s.ok ? s.origin : url.origin; }
// Whether this request may be indexed at all: the shop is live and this is its own address. A SITE_ORIGIN that is set but
// malformed fails closed (nothing is indexable anywhere) instead of letting the workers.dev copy into search.
// The workers.dev address is never indexable, even with LIVE "1" and SITE_ORIGIN forgotten (go-live check, 2026-11-26):
// otherwise the demo copy and the shop's own domain would both be in search, each its own canonical.
export const liveHere = (env, url) => { if (env.LIVE !== "1" || /(^|\.)workers\.dev\.?$/i.test(url.hostname)) return false; const s = setting(env); return !s.set || (s.ok && s.origin === url.origin); };
export const originProblem = env => { const s = setting(env); return s.set && !s.ok ? `SITE_ORIGIN "${env.SITE_ORIGIN}" is not https://host: every page stays noindex until it is fixed` : ""; };

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = cents => "$" + (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const parse = s => { try { const v = JSON.parse(s || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
export const describeText = p => { const d = parse(p.details).description; return d ? String(d) : p.note ? String(p.note) : ""; };

// Worked out once per copy of the catalogue (the copy is shared for 20 s or more): the storefront view (family leads,
// photo versions) and each product by its number.
const memo = new WeakMap();
export function view(cat) {
  let v = memo.get(cat); if (v) return v;
  const sf = toStorefront(cat).PRODUCTS, front = new Map(sf.map(p => [p.sku, p])), lead = new Map();
  for (const p of sf) if (p.family && p.lead) lead.set(p.family, p.sku);
  v = { front, lead, bySku: new Map(cat.products.map(p => [p.sku, p])), feed: null };
  memo.set(cat, v); return v;
}
// A hookah's colours share one page in search: every colour's canonical is its family's lead colour (the card in the shop).
// Except a colour on sale whose lead is not (Price TBD or coming soon): it keeps its own address, so its offer is never
// stated at a page that has none, and it is in the sitemap (breaker, 2026-11-24).
export const canonicalSku = (cat, sku) => {
  const v = view(cat), f = v.front.get(sku), lead = f && f.family && v.lead.get(f.family);
  if (!lead || lead === sku) return sku;
  return sellable(v.bySku.get(sku)) && !sellable(v.bySku.get(lead)) ? sku : lead;
};
// What a shopper sees as one item in a section: one per hookah family, every other item on its own.
const shelf = (cat, list) => list.filter(p => { const f = view(cat).front.get(p.sku); return !f || !f.family || f.lead; });
// A shop page's band (public/band.js), visible from the first paint: the page draws the same markup and keeps this node, so
// the band is coloured, titled and its full height before the script runs, and nothing moves when it takes over. Its h1 is
// the page's heading, so the hidden copy below carries none of its own.
const bandFor = (cat, c) => { const sf = shelfOf([...view(cat).front.values()]); return shopBand(c && { id: c.id, name: c.name, tone: c.tone }, c ? sf.filter(p => p.cat === c.id) : sf); };

const photoUrl = (origin, p) => p.photo_ver ? `${origin}/api/photo/${p.sku}?v=${p.photo_ver}` : p.img ? `${origin}/img/pc/${p.img}.webp${IMG_VERSIONS[p.img] ? "?v=" + IMG_VERSIONS[p.img] : ""}` : null;
const smallUrl = p => p.photo_ver ? `/api/photo/${p.sku}?v=${p.photo_ver}` : p.img ? `/img/pc/${p.img}${p.img_dark ? "" : "-s"}.webp${IMG_VERSIONS[p.img] ? "?v=" + IMG_VERSIONS[p.img] : ""}` : null;
// The link-preview picture, the same files the live site shares (no new share cards: the card generator is parked until
// the owner approves a still, docs/SEO.md section 4). An uploaded photo (back office) is shared as it is, never the static
// photo it replaced; else the product's own photo; else the shop's card.
export function shareImage(origin, p, site) {
  if (p && p.photo_ver) return { url: `${origin}/api/photo/${p.sku}?v=${p.photo_ver}`, alt: `${p.name} at ${site}` };
  if (p && p.img) return { url: `${origin}/img/pc/${p.img}.webp`, alt: `${p.name} at ${site}` };
  return { url: `${origin}/img/share.jpg`, w: 1200, h: 630, type: "image/jpeg", alt: `${site}, ${SHOP.street}, Windsor` };
}

// What a shopper is told about an item's price, in the same words as the shop: the shop's own price, or that it is not set.
function priceWords(p) {
  if (sellable(p)) return `${money(p.price_cents)}${p.stock > 0 ? "" : ", sold out"}`;
  return p.price_cents > 0 ? `${money(p.price_cents)}, coming soon` : "Price TBD";   // the shop's own price, as the page's sticker shows it
}

// ---------- JSON-LD ----------
function hours() {   // grouped like the footer: Monday to Saturday 10 to 9, Sunday 11 to 7
  const groups = new Map();
  SHOP_HOURS.forEach(([o, c], i) => { const k = `${o}-${c}`; if (!groups.has(k)) groups.set(k, { o, c, days: [] }); groups.get(k).days.push(DAYS[i]); });
  const hh = n => String(n).padStart(2, "0") + ":00";
  return [...groups.values()].map(g => ({ "@type": "OpeningHoursSpecification", dayOfWeek: g.days.length === 1 ? g.days[0] : g.days, opens: hh(g.o), closes: hh(g.c) }));
}
const address = () => ({ "@type": "PostalAddress", streetAddress: SHOP.street, addressLocality: SHOP.city, addressRegion: SHOP.region, postalCode: SHOP.postal, addressCountry: SHOP.country });
const storeRef = (origin, site) => ({ "@type": "Store", "@id": `${origin}/#store`, name: site, address: address() });
export function storeLd(origin, site) {
  return { "@context": "https://schema.org", "@type": "Store", "@id": `${origin}/#store`, name: site, url: origin + "/", image: shareImage(origin, null, site).url, telephone: SHOP.phone,
    address: address(), geo: { "@type": "GeoCoordinates", ...SHOP.geo }, openingHoursSpecification: hours(), currenciesAccepted: "CAD", sameAs: SHOP.sameAs,
    // All sales final, except faulty, wrong, damaged or undelivered items (terms of sale): no change-of-mind returns.
    hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "CA", returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" } };
}
// Only for an item on sale. Google's product results need an offer (or reviews, which the shop does not collect), so a
// Price TBD or Coming soon item gets no Product data at all rather than an invalid item in Search Console; its name,
// description and photo are still in the page and the written content.
export function productLd(origin, p, site, canonical) {
  if (!sellable(p)) return null;
  const img = photoUrl(origin, p), brand = parse(p.details).brand, desc = describeText(p);
  const o = { "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, url: canonical, ...(desc ? { description: desc } : {}), ...(img ? { image: [img] } : {}),
    ...(brand ? { brand: { "@type": "Brand", name: String(brand) } } : {}) };
  // The offer: the shop's own price only. No price is ever guessed, and the supplier's price never reaches this page
  // (loadCatalog does not even read it).
  o.offers = { "@type": "Offer", url: canonical, price: (p.price_cents / 100).toFixed(2), priceCurrency: "CAD", itemCondition: "https://schema.org/NewCondition",
    availability: "https://schema.org/" + (p.stock > 0 ? "InStock" : "OutOfStock"),   // the shop's own count, never assumed
    availableDeliveryMethod: counterRow(p) || counterPayRow(p) ? "https://schema.org/OnSitePickup" : ["https://schema.org/OnSitePickup", "https://schema.org/ParcelService"],
    availableAtOrFrom: storeRef(origin, site), seller: storeRef(origin, site) };
  return o;
}
export function crumbsLd(trail) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: trail.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) };
}

// ---------- the server-written content ----------
// The page draws itself with JavaScript. This block carries the same content in the HTML for crawlers that do not run
// scripts and for anyone without JavaScript. It sits inside <main>, hidden by a style in the head; the page replaces it
// the moment it draws, so nobody with JavaScript ever sees it. Without JavaScript the <noscript> style shows it.
// (#main keeps the full-screen height it has while empty, styles.css #main:empty, so the footer never jumps; a shop page's
// band, bandFor above, is the one part shown to everyone from the first paint.)
export const SSR_STYLE = `<style>.ssr{display:none}#main:has(>.ssr){min-height:100svh}</style><noscript><style>.ssr{display:block;padding:var(--s-6,24px) var(--gutter,16px) var(--s-12,48px)}.ssr h1{font:400 var(--t-d1,2rem)/1 var(--font-display,sans-serif);margin:var(--s-4,16px) 0}.ssr p{max-width:65ch}`
  + `.ssr ol{display:flex;flex-wrap:wrap;gap:var(--s-2,8px);list-style:none;padding:0;margin:0;font-size:var(--t-14,.875rem)}.ssr ol li+li::before{content:"/";margin-right:var(--s-2,8px);color:var(--color-muted,#999)}.ssr ol li{white-space:nowrap}.ssr ol a{display:inline;padding:0;margin:0;min-height:0;min-width:0}`
  + `.ssr ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--s-6,24px) var(--s-4,16px);list-style:none;padding:0}.ssr li a{display:block}.ssr li img{display:block;width:100%;height:auto;background:var(--bonelt,#eee);margin-bottom:var(--s-2,8px)}article.ssr>img{display:block;width:100%;max-width:360px;height:auto;background:var(--bonelt,#eee)}body:has(#main>.ssr) .nojs>h1{display:none}</style></noscript>`;
const crumbNav = trail => `<nav aria-label="Breadcrumb"><ol>${trail.map(([name, href], i) => `<li>${i === trail.length - 1 ? `<span aria-current="page">${esc(name)}</span>` : `<a href="${esc(href)}">${esc(name)}</a>`}</li>`).join("")}</ol></nav>`;
const item = p => { const src = smallUrl(p); return `<li><a href="/p/${esc(p.sku)}">${src ? `<img src="${esc(src)}" alt="${esc(p.name)}" width="360" height="450" loading="lazy" decoding="async">` : ""}${esc(p.name)}</a> <span>${esc(priceWords(p))}</span></li>`; };

// Everything a page needs for search, given the page's description (worker.js describe()) and its path.
export function seoFor({ env, url, cat, meta, site }) {
  const origin = siteOrigin(env, url), path = url.pathname.replace(/\/+$/, "") || "/";
  const [a, b] = path.split("/").filter(Boolean);
  const out = { canonical: origin + path, head: [], body: "", share: shareImage(origin, null, site) };
  if (!meta || meta.missing) return out;
  const home = [["Home", origin + "/"]], shopCrumb = ["Shop", origin + "/shop"];
  if (!a) {
    out.head.push(ld(storeLd(origin, site)));
    const secs = cat.categories.map(c => [c, shelf(cat, cat.products.filter(p => p.category_id === c.id)).length]).filter(([, n]) => n);
    out.body = `<section class="ssr" aria-label="${esc(site)}"><h1>${esc(site)}</h1><p>${esc(meta.desc)}</p><h2>Shop by section</h2><ul>${secs.map(([c, n]) => `<li><a href="/shop/${esc(c.id)}">${esc(c.name)}</a> <span>${n}</span></li>`).join("")}</ul><p>${esc(SHOP.street)}, Windsor, ON ${esc(SHOP.postal)}. Call <a href="tel:+15192552222">519-255-2222</a>.</p></section>`;
  } else if (a === "shop" && !b) {
    const secs = cat.categories.map(c => [c, shelf(cat, cat.products.filter(p => p.category_id === c.id))]).filter(([, l]) => l.length);
    out.head.push(ld(crumbsLd([...home, shopCrumb])));
    out.body = bandFor(cat, null) + `<section class="ssr">${crumbNav([["Home", "/"], ["Shop", "/shop"]])}<p>${esc(meta.desc)}</p>${secs.map(([c, l]) => `<h2><a href="/shop/${esc(c.id)}">${esc(c.name)}</a></h2><ul>${l.slice(0, 12).map(item).join("")}</ul>`).join("")}</section>`;
  } else if (a === "shop") {
    const c = cat.categories.find(x => x.id === b); if (!c) return out;
    const list = shelf(cat, cat.products.filter(p => p.category_id === c.id));
    out.head.push(ld(crumbsLd([...home, shopCrumb, [c.name, `${origin}/shop/${c.id}`]])));
    out.body = bandFor(cat, c) + `<section class="ssr">${crumbNav([["Home", "/"], ["Shop", "/shop"], [c.name, `/shop/${c.id}`]])}<p>${esc(meta.desc)}</p>${list.length ? `<ul>${list.map(item).join("")}</ul>` : `<p><a href="tel:+15192552222">519-255-2222</a></p>`}</section>`;
  } else if (a === "p" && meta.product) {
    const p = meta.product, c = cat.categories.find(x => x.id === p.category_id), sku = canonicalSku(cat, p.sku), canon = `${origin}/p/${sku}`;
    out.canonical = canon; out.share = shareImage(origin, p, site);
    const pl = productLd(origin, p, site, canon);
    out.head.push(...(pl ? [ld(pl)] : []), ld(crumbsLd([...home, ...(c ? [[c.name, `${origin}/shop/${c.id}`]] : []), [p.name, canon]])));
    const src = photoUrl("", p), desc = describeText(p);
    out.body = `<article class="ssr">${crumbNav([["Home", "/"], ...(c ? [[c.name, `/shop/${c.id}`]] : []), [p.name, `/p/${p.sku}`]])}<h1>${esc(p.name)}</h1>${src ? `<img src="${esc(src)}" alt="${esc(p.name)}" width="720" height="900" loading="lazy" decoding="async">` : ""}`
      + `${desc ? `<p>${esc(desc)}</p>` : ""}<p>${esc(priceWords(p))}</p>${sellable(p) ? `<p>${counterPayRow(p) ? "Pickup in Windsor, paid in the shop." : counterRow(p) ? "Pickup in Windsor or local delivery near Windsor. Not shipped." : "Shipped across Canada except Quebec, or free pickup in Windsor."}</p>` : `<p>Ask the counter: <a href="tel:+15192552222">519-255-2222</a>.</p>`}</article>`;
  }
  return out;
}

// ---------- robots.txt and the sitemap ----------
export function robots(env, url) {
  const live = liveHere(env, url);
  // Private pages and the data routes stay out. The page needs /api/catalog-module to draw its shelves and /api/photo for
  // uploaded photos, so those two stay crawlable (a blocked script means a blank page to Google's renderer).
  const lines = ["User-agent: *", "Disallow: /admin", "Disallow: /api/", "Allow: /api/catalog-module", "Allow: /api/photo/", "Disallow: /account$", "Disallow: /account/", "Disallow: /checkout$", "Disallow: /checkout/"];
  // "$" ends the match: a bare "Disallow: /account" would also block /account.js and /account.css, which every page loads,
  // and Google's renderer would then draw nothing (breaker, 2026-11-24).
  // /cart and /order/ are NOT blocked: the cart is linked from every page, and a blocked page can still be listed from
  // its links because the crawler never sees its noindex (docs/SEO.md). They stay crawlable and say noindex instead.
  if (live) lines.push("", `Sitemap: ${siteOrigin(env, url)}/sitemap.xml`);
  return lines.join("\n") + "\n";
}
// Only pages that say "index": the sections with something on view, each item a shopper can open (one per hookah
// family), and the help pages. Never the cart, checkout, account, search, gifts or order pages.
// Build a set needs at least one piece on sale in its three main picks (hookah, bowl, hose); until then the page says the
// pieces are on their way, so it is not indexed or listed (worker.js describe() uses the same rule).
export const SET_SECTIONS = ["hookahs", "bowls", "hoses"];
export const setReady = cat => cat.products.some(p => SET_SECTIONS.includes(p.category_id) && sellable(p) && p.stock > 0);
export function sitemap(env, url, cat) {
  const origin = siteOrigin(env, url), secs = cat.categories.filter(c => cat.products.some(p => p.category_id === c.id));
  const items = cat.products.filter(p => canonicalSku(cat, p.sku) === p.sku).map(p => `/p/${p.sku}`);   // every page that is its own canonical
  const paths = ["/", "/shop", ...secs.map(c => `/shop/${c.id}`), ...(setReady(cat) ? ["/set"] : []), "/shipping", "/terms", "/privacy", ...items];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p => `<url><loc>${esc(origin + p)}</loc></url>`).join("\n")}\n</urlset>\n`;
}
