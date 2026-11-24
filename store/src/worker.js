// One Stop Shop store Worker. Answers the page routes (each with its own title, description and a real 404),
// serves the catalogue from the database, and passes every other request to the static files.
import { shopCatalog, dropCatalog, catalogModule, counterRow, sellable, toStorefront, CHARCOAL } from "./catalog.js";
import { heroPicks } from "../public/picks.js";
import { admin, photo, signedIn } from "./admin.js";
import { accountRoute, stockAlerts, restockReminders, scrubCodes } from "./account.js";
import { loyaltyAdmin } from "./loyalty.js";
import { placeOrder } from "./checkout.js";
import { webhook, payStatus, sweep, cardReady } from "./pay.js";
import { deliveryRoute } from "./delivery.js";
import { nightly } from "./backup.js";

const SECURITY = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
};
const money = cents => "$" + (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// What each page says about itself. Returns null for an address that does not exist.
function describe(path, cat, site) {
  const [a, b, extra] = path.split("/").filter(Boolean);
  const base = { title: `${site} | Hookahs and accessories, Windsor, shipped across Canada`, desc: "Hookahs, bases, bowls and hoses from our Windsor counter. Shipped anywhere in Canada.", index: true };
  if (!a) return base;
  if (extra) return null;
  if (a === "shop") {
    if (!b) return { ...base, title: `Shop | ${site}` };
    const c = cat.categories.find(x => x.id === b); if (!c) return null;
    const list = cat.products.filter(p => p.category_id === c.id), n = new Set(list.map(p => p.family && p.family.startsWith("ace-") ? p.family : p.sku)).size, counter = n && list.every(counterRow);
    // nothing in this section can be bought yet: say what stage it is at, never "in stock"
    if (n && !list.some(sellable)) return { title: `${c.name} | ${site}`, desc: list.some(p => p.price_cents > 0) ? `${n} ${c.name.toLowerCase()} coming soon to our Windsor counter.` : `${n} ${c.name.toLowerCase()} from the catalogue. Shop prices are on the way.`, index: true };
    return { title: `${c.name} | ${site}`, desc: counter ? `${n} ${c.id === CHARCOAL ? "kinds of hookah charcoal and foil" : c.name.toLowerCase()} at our Windsor counter. Pickup or local delivery only.` : `${n} ${c.name.toLowerCase()} in stock at our Windsor counter, shipped anywhere in Canada.`, index: true };
  }
  if (a === "p") {
    const p = cat.products.find(x => x.sku === b); if (!p) return null;
    const said = sellable(p) ? money(p.price_cents) : p.price_cents > 0 ? `${money(p.price_cents)}, coming soon` : "Price TBD";   // no shop price yet: nothing else stands in for it
    return { title: `${p.name} | ${site}`, desc: `${(() => { try { const d = JSON.parse(p.details || "{}").description; return d ? d + " " : p.note ? p.note + ". " : ""; } catch { return p.note ? p.note + ". " : ""; } })()}${said}.${!sellable(p) ? "" : counterRow(p) ? " Pickup in Windsor or local delivery near Windsor. Not shipped." : " Shipped across Canada or free pickup in Windsor."}`, index: true, product: p };
  }
  if (a === "order") return b && /^W[A-Z0-9]{6}$/.test(b) ? { ...base, title: `Order ${b} | ${site}`, index: false } : null;
  if (a === "gifts" && b && b !== "under-50" && b !== "under-150") return null;
  if (b && a !== "gifts") return null;
  const fixed = { account: "Your account", privacy: "Privacy", terms: "Terms of sale", checkout: "Checkout", cart: "Cart", shipping: "Shipping and returns", set: "Build a set", search: "Search", gifts: "Gifts" };
  if (!Object.hasOwn(fixed, a)) return null;
  return { ...base, title: `${fixed[a]} | ${site}`, index: ["shipping", "set", "privacy", "terms"].includes(a) };
}

// A product that has been taken off the shop (the demo's sample hookahs, 2026-11-24) is never deleted, because orders
// point at it. Its old address sends people to its section instead of a dead end. One small read, and only on a miss.
async function retiredTo(env, path) {
  const m = path.match(/^\/p\/(OSS-\d{4,6})\/?$/); if (!m) return null;
  if (!/^OSS-1\d{3}$/.test(m[1])) return null;   // only the retired sample hookahs; anything else the shop switches off is a plain 404
  const row = await env.DB.prepare("SELECT p.category_id FROM products p JOIN categories c ON c.id = p.category_id WHERE p.sku = ?1 AND p.active = 0 AND p.listed = 0 AND p.supplier_id IS NULL AND c.active = 1").bind(m[1]).first();
  return row ? `/shop/${row.category_id}` : null;
}
async function page(request, env, url, ctx) {
  const cat = await shopCatalog(env, ctx);
  const site = env.SITE_NAME || "One Stop Shop";
  const d = describe(url.pathname, cat, site);
  if (!d) { const to = await retiredTo(env, url.pathname); if (to) return new Response(null, { status: 301, headers: { ...SECURITY, Location: url.origin + to, "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex, nofollow" } }); }
  const meta = d || { title: `Page not found | ${site}`, desc: "That page does not exist.", index: false };
  const live = env.LIVE === "1";
  const canonical = url.origin + (url.pathname.replace(/\/+$/, "") || "/");
  const shell = await env.ASSETS.fetch(new URL("/index.html", url));
  const extra = [`<link rel="canonical" href="${canonical}">`, `<meta name="oss-pay" content="${cardReady(env) ? "card" : "off"}">`, `<meta name="oss-shisha-card" content="${env.STRIPE_TOBACCO_OK === "1" ? "1" : "0"}">`,
    `<meta property="og:type" content="${meta.product ? "product" : "website"}">`, `<meta property="og:site_name" content="${esc(site)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`, `<meta property="og:description" content="${esc(meta.desc)}">`, `<meta property="og:url" content="${canonical}">`];
  if (meta.product) {
    const p = meta.product, img = p.photo_ver ? `${url.origin}/api/photo/${p.sku}?v=${p.photo_ver}` : p.img ? `${url.origin}/img/pc/${p.img}.webp` : `${url.origin}/img/share.jpg`;   // no photo yet: the shop's share image, never a broken link
    extra.push(`<meta property="og:image" content="${esc(img)}">`);
    // an offer is stated only for something on sale at the shop's own price; an item on view without one has no offer at all
    const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, ...(p.note ? { description: p.note } : {}), image: img,
      ...(sellable(p) ? { offers: { "@type": "Offer", price: (p.price_cents / 100).toFixed(2), priceCurrency: "CAD", url: canonical, availability: "https://schema.org/" + (p.stock > 0 ? "InStock" : "OutOfStock"),
        ...(counterRow(p) ? { availableDeliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModePickUp" } : {}) } } : {}) };
    extra.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
  }
  else extra.push(`<meta property="og:image" content="${url.origin}/img/share.jpg">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`, `<meta name="twitter:card" content="summary_large_image">`);
  if (url.pathname === "/") {   // what search engines and maps read about the shop
    const hero = heroFirst(cat); if (hero) extra.push(heroPreload(hero));   // the picture the first screen is waiting for
    const ld = { "@context": "https://schema.org", "@type": "Store", name: site, url: url.origin, telephone: "+1-519-255-2222", address: { "@type": "PostalAddress", streetAddress: "760 Wyandotte St E", addressLocality: "Windsor", addressRegion: "ON", postalCode: "N9A 3J4", addressCountry: "CA" }, geo: { "@type": "GeoCoordinates", latitude: 42.3179407, longitude: -83.0263116 }, openingHours: ["Mo-Sa 10:00-21:00", "Su 11:00-19:00"], sameAs: ["https://www.instagram.com/one1_stop_shop/", "https://www.tiktok.com/@onestopshop6"] };
    extra.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
  }
  const out = new HTMLRewriter()
    .on("title", { element(e) { e.setInnerContent(meta.title); } })
    .on('meta[name="description"]', { element(e) { e.setAttribute("content", meta.desc); } })
    .on('meta[name="robots"]', { element(e) { if (live && meta.index) e.remove(); else e.setAttribute("content", "noindex, nofollow"); } })
    .on("head", { element(e) { e.append(extra.join("\n") + "\n", { html: true }); } })
    .transform(shell);
  const headers = new Headers(out.headers);
  for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-cache");
  if (url.pathname.startsWith("/account")) headers.set("Referrer-Policy", "no-referrer");   // sign-in and unsubscribe links never leak onward
  if (!(live && meta.index)) headers.set("X-Robots-Tag", "noindex, nofollow"); else headers.delete("X-Robots-Tag");   // _headers marks everything noindex for the demo; a live, indexable page must drop it
  return new Response(out.body, { status: d ? 200 : 404, headers });
}
// The public catalogue feed: what a shopper can already see, nothing more. Research notes, photo rights, source lines
// and catalogue facts stay in the database; an item not on sale shows no stock count.
const FEED = ["sku", "name", "category_id", "price_cents", "weight_g", "box_id", "glass", "ship_class", "height_cm", "note", "img", "stock"];
const FEED_DETAILS = ["charcoal", "brand", "variant", "shape", "box_sku", "photo", "description", "ml", "kind", "notes"];   // allowlist: anything added to details later stays private
function publicFeed(cat) {
  return { categories: cat.categories, boxes: cat.boxes, products: cat.products.map(p => {
    const o = {}; for (const k of FEED) o[k] = p[k];
    o.for_sale = sellable(p); if (!o.for_sale) o.stock = 0; if (!(p.price_cents > 0)) o.price_cents = null;
    // the item's own public details (the charcoal mark, brand, size, description); the shop's notes on photo rights and sources stay private
    let d = {}; try { d = JSON.parse(p.details || "{}") || {}; } catch {} o.details = JSON.stringify(Object.fromEntries(FEED_DETAILS.filter(k => k in d).map(k => [k, d[k]])));
    if (counterRow(p)) o.ship_class = "pickup_only";   // charcoal, and anything whose weight is not known yet
    return o; }) };
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// The first hookah in the home hero, picked by the page's own rule (public/picks.js), with the same image list, so the browser reuses this download.
const IMG_V = "?v=1794615693";   // IMG_V matches V in public/app.js
const heroFirst = cat => heroPicks(toStorefront(cat).PRODUCTS, 1)[0] || null;
const heroPreload = p => { const u = s => `img/pc/${p.img}${s}.webp${IMG_V}`; return `<link rel="preload" as="image" fetchpriority="high" href="${u("")}" imagesrcset="${u("-s")} 360w, ${u("-m")} 540w, ${u("")} 720w${p.lw ? `, ${u("-l")} ${p.lw}w` : ""}" imagesizes="(min-width:960px) 42vw, 58vw">`; };
// The sitemap exists only once the shop is live: the demo stays out of search engines.
function sitemap(cat, url) {
  const paths = ["/", "/shop", ...cat.categories.map(c => `/shop/${c.id}`), "/gifts/under-50", "/gifts/under-150", "/set", "/shipping", "/privacy", "/terms", ...cat.products.map(p => `/p/${p.sku}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p => `<url><loc>${esc(url.origin + p)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export default {
  // every night: a full copy of the shop's records into the backup bucket
  async scheduled(event, env, ctx) {
    if (event.cron === "*/10 * * * *") { ctx.waitUntil(sweep(env).then(r => { console.log(JSON.stringify({ at: "pay-sweep", ...r })); if (r.paid || r.released) dropCatalog(ctx); })); return; }   // every 10 minutes: unpaid orders checked with Stripe; stock it put back shows in the shop at once
    ctx.waitUntil(scrubCodes(env).then(() => nightly(env))); ctx.waitUntil(stockAlerts(env).then(() => restockReminders(env)));   // nightly: backup, and the customers' alerts and charcoal reminders
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/catalog-module") {
        if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
        // Always checked with the shop (so a back-office change shows on the next page), but the check is one small
        // round trip answered from memory: an unchanged catalogue is "304, use the copy you have".
        const body = catalogModule(await shopCatalog(env, ctx)); let h = 2166136261;
        for (let k = 0; k < body.length; k++) h = Math.imul(h ^ body.charCodeAt(k), 16777619);
        const tag = `"c${(h >>> 0).toString(36)}-${body.length}"`, head = { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache", ETag: tag, "X-Content-Type-Options": "nosniff" };
        if ((request.headers.get("If-None-Match") || "").replace(/^W\//, "") === tag) return new Response(null, { status: 304, headers: head });
        return new Response(body, { headers: head });
      }
      if (path === "/api/catalog") {
        if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
        // the shared copy (memory, then the data centre's cache), never a full database read per request; a short public cache on top
        const r = json(publicFeed(await shopCatalog(env, ctx))); r.headers.set("Cache-Control", "public, max-age=30"); return r;
      }
      if (path === "/api/admin/loyalty") return await loyaltyAdmin(request, env, url, async (r, e) => !!(await signedIn(r, e))?.owner);   // the points program is the owner's setting, never staff
      if (path.startsWith("/api/admin/")) { const r = await admin(request, env, url); if (request.method !== "GET" && r.ok) { dropCatalog(ctx); ctx.waitUntil(stockAlerts(env, url.origin)); } return r; } // a change in the back office shows in the shop at once; anything back in stock emails whoever asked
      if (path.startsWith("/api/account/")) return await accountRoute(request, env, url);
      if (path === "/api/orders") { if (request.method !== "POST") return json({ error: "Method not allowed" }, 405); const r = await placeOrder(request, env, url); if (r.ok) dropCatalog(ctx); return r; }
      if (path === "/api/delivery") return await deliveryRoute(request, env, url);
      if (path === "/api/pay/webhook") { const r = await webhook(request, env); if (r.ok) dropCatalog(ctx); return r; }   // Stripe calls this; the signature is the only way in
      if (path === "/api/pay/status") return await payStatus(request, env, url);
      const ph = path.match(/^\/api\/photo\/(OSS-\d{4,6})$/); if (ph && request.method === "GET") return await photo(env, ph[1]);
      if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
      if (path === "/admin" || path.startsWith("/admin/")) {
        if (path !== "/admin") return Response.redirect(url.origin + "/admin", 302);
        const shell = await env.ASSETS.fetch(new URL("/admin.html", url)), headers = new Headers(shell.headers);
        for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
        headers.set("Content-Security-Policy", SECURITY["Content-Security-Policy"].replace("img-src 'self' data:", "img-src 'self' data: blob:"));
        headers.set("X-Robots-Tag", "noindex, nofollow"); headers.set("Cache-Control", "no-cache");
        return new Response(shell.body, { status: 200, headers });
      }
      if (path === "/sitemap.xml") {
        if (env.LIVE !== "1") return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" } });
        return new Response(sitemap(await shopCatalog(env, ctx), url), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      }
      if (path === "/index.html") return Response.redirect(url.origin + "/", 301);
      const lower = path.match(/^\/p\/([A-Za-z]+-\d+)\/?$/); if (lower && lower[1] !== lower[1].toUpperCase()) return Response.redirect(`${url.origin}/p/${lower[1].toUpperCase()}`, 301);   // an item number typed in small letters
      if (/\.[a-z0-9]{2,5}$/i.test(path)) return env.ASSETS.fetch(request); // a file that is not there: plain 404
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      return await page(request, env, url, ctx);
    } catch (err) {
      console.error(JSON.stringify({ at: "fetch", path, message: String(err && err.message || err) }));
      return new Response("Something went wrong on our side. Please try again.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
