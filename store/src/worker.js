// One Stop Shop store Worker. Answers the page routes (each with its own title, description and a real 404),
// serves the catalogue from the database, and passes every other request to the static files.
import { shopCatalog, dropCatalog, catalogModule, counterRow, counterPayRow, setShishaCard, sellable, weightUnknown, CHARCOAL, isCharcoalRow, PUBLIC_PHOTO } from "./catalog.js";
import { seoFor, liveHere, robots, sitemap, view, SSR_STYLE, originProblem, setReady } from "./seo.js";
import { heroPicks } from "../public/picks.js";
import { admin, photo, signedIn } from "./admin.js";
import { accountRoute, stockAlerts, restockReminders, scrubCodes } from "./account.js";
import { loyaltyAdmin } from "./loyalty.js";
import { placeOrder } from "./checkout.js";
import { webhook, payStatus, sweep, cardReady } from "./pay.js";
import { deliveryRoute } from "./delivery.js";
import { retryEmails } from "./email.js";
import { nightly } from "./backup.js";
import { isSample } from "./samples.js";

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
  // the home line follows the hero (owner, 2026-11-26): shipping is promised only once something that can ship is on sale
  const ships = cat.products.some(p => sellable(p) && p.stock > 0 && !counterRow(p) && !counterPayRow(p));
  const base = ships ? { title: `${site} | Hookahs and accessories, Windsor, shipped across Canada`, desc: "Hookahs, charcoal, shisha and foil from our Windsor counter. Pickup, local delivery, and shipping across Canada except Quebec, for now.", index: true }
    : { title: `${site} | Hookahs and accessories, Windsor`, desc: "Hookahs, charcoal, shisha and foil from our Windsor counter. Pickup in Windsor and local delivery from $10. Shipping across Canada once prices are in.", index: true };
  if (!a) return base;
  if (extra) return null;
  if (a === "shop") {
    if (!b) return { ...base, title: `Shop | ${site}` };
    const c = cat.categories.find(x => x.id === b); if (!c) return null;
    const list = cat.products.filter(p => p.category_id === c.id), n = new Set(list.map(p => p.family && p.family.startsWith("ace-") ? p.family : p.sku)).size, counter = n && list.every(counterRow);
    // nothing on the shelf yet (the samples came off, 2026-11-24): the page says the stock is on its way, and is kept out
    // of search results and the sitemap until it holds something (a page with no products is thin content)
    if (!n) return { title: `${c.name} | ${site}`, desc: `${c.name}: coming soon to our site. Call 519-255-2222 to ask what is on the shelf today.`, index: false };
    // nothing in this section can be bought yet: say what stage it is at, never "in stock"
    if (n && !list.some(sellable)) return { title: `${c.name} | ${site}`, desc: list.some(p => p.price_cents > 0) ? `${n} ${c.name.toLowerCase()} coming soon to our Windsor counter.` : `${n} ${c.name.toLowerCase()} in the shop at our Windsor counter. Shop prices are on the way.`, index: true };
    if (n && list.every(counterPayRow)) return { title: `${c.name} | ${site}`, desc: `${n} ${c.name.toLowerCase()} at our Windsor counter. Pickup, paid in the shop.`, index: true };   // shisha while card payment for it waits on approval
    return { title: `${c.name} | ${site}`, desc: counter ? `${n} ${c.id === CHARCOAL ? "kinds of hookah charcoal" : c.id === "heat" ? "foil and heat items" : c.name.toLowerCase()} at our Windsor counter. Pickup or local delivery only.` : `${n} ${c.id === "heat" ? "foil and heat items" : c.name.toLowerCase()} at our Windsor counter, shipped across Canada except Quebec, for now.`, index: true };   // never "in stock": the count includes sold-out items
  }
  if (a === "p") {
    const p = cat.products.find(x => x.sku === b); if (!p) return null;
    const said = sellable(p) ? money(p.price_cents) : p.price_cents > 0 ? `${money(p.price_cents)}, coming soon` : "Price TBD";   // no shop price yet: nothing else stands in for it
    return { title: `${p.name} | ${site}`, desc: `${(() => { try { const d = JSON.parse(p.details || "{}").description; return d ? d + " " : p.note ? p.note + ". " : ""; } catch { return p.note ? p.note + ". " : ""; } })()}${said}.${!sellable(p) ? "" : counterPayRow(p) ? " Pickup in Windsor, paid in the shop." : counterRow(p) ? " Pickup in Windsor or local delivery near Windsor. Not shipped." : " Shipped across Canada except Quebec, or free pickup in Windsor."}`, index: true, product: p };
  }
  if (a === "order") return b && /^W[A-Z0-9]{6}$/.test(b) ? { ...base, title: `Order ${b} | ${site}`, index: false } : null;
  if (b) return null;
  const fixed = { account: "Your account", privacy: "Privacy", terms: "Terms of sale", checkout: "Checkout", cart: "Cart", shipping: "Shipping and returns", set: "Build a set", search: "Search" };
  if (!Object.hasOwn(fixed, a)) return null;
  return { ...base, title: `${fixed[a]} | ${site}`, index: ["shipping", "privacy", "terms"].includes(a) || (a === "set" && setReady(cat)) };
}

// A product that has been taken off the shop (the demo's made-up samples, 2026-11-24) is never deleted, because orders
// point at it. Its old address sends people to its section (which says what is coming) instead of a dead end. One small
// read, and only on a miss.
async function retiredTo(env, path) {
  const m = path.match(/^\/p\/(OSS-\d{4,6})\/?$/); if (!m) return null;
  if (isSample(m[1])) {   // the retired samples (src/samples.js)
    const row = await env.DB.prepare("SELECT p.category_id FROM products p JOIN categories c ON c.id = p.category_id WHERE p.sku = ?1 AND p.active = 0 AND p.listed = 0 AND p.supplier_id IS NULL AND c.active = 1").bind(m[1]).first();
    return row ? `/shop/${row.category_id}` : null;
  }
  // an unticked catalogue page, on view until 2026-11-26 (owner: a tick means in the shop; the rest came off): its old address goes
  // to its section. Anything else the shop switches off is a plain 404.
  if (!/^OSS-1[01]\d{4}$/.test(m[1])) return null;
  const row = await env.DB.prepare("SELECT p.category_id FROM products p JOIN categories c ON c.id = p.category_id WHERE p.sku = ?1 AND p.supplier_id IN ('ace', 'ace-acc') AND json_extract(p.facts_known, '$.stamp') = 'none' AND c.active = 1").bind(m[1]).first();
  return row ? `/shop/${row.category_id}` : null;
}
// Charcoal left Heat for its own section (2026-11-24). Old links to the charcoal side of Heat (the coal finder, its boxes,
// rolls, shapes, piece counts, sizes and makes, the old search jumps and business cards) go to the same view in Charcoal,
// with the same filters. Plain /shop/heat and its foil filters stay where they are.
const COAL_KEYS = new Set(["find", "shape", "n", "made", "mm"]);
function charcoalMoved(url) {
  if (url.pathname.replace(/\/+$/, "") !== "/shop/heat" || !url.search) return null;
  const q = url.searchParams, type = (q.get("type") || "").split(",").filter(Boolean);
  const coalType = type.filter(t => t === "box" || t === "roll"), coalSort = ["piece", "most"].includes(q.get("sort"));   // the per-piece sorts are Charcoal's now
  const coal = [...q.keys()].some(k => COAL_KEYS.has(k)) || coalType.length > 0 || coalSort;
  if (!coal || (type.includes("foil") && !coalType.length)) return null;   // a foil link stays in Heat
  const out = new URLSearchParams(); for (const [k, v] of q) if (k === "sort" || k === "brand" || COAL_KEYS.has(k)) out.append(k, v);
  if (coalType.length) out.set("type", coalType.join(","));   // "box,foil" keeps its charcoal half
  const s = out.toString(); return "/shop/charcoal" + (s ? "?" + s.replace(/%2C/gi, ",") : "");
}
async function page(request, env, url, ctx) {
  const cat = await shopCatalog(env, ctx);
  const site = env.SITE_NAME || "One Stop Shop";
  const d = describe(url.pathname, cat, site);
  if (!d) { const to = await retiredTo(env, url.pathname); if (to) return new Response(null, { status: 301, headers: { ...SECURITY, Location: url.origin + to, "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex, nofollow" } }); }
  const meta = d || { title: `Page not found | ${site}`, desc: "That page does not exist.", index: false, missing: true };
  // indexable only when the shop is live AND this is its own address (SITE_ORIGIN); the workers.dev copy stays noindex
  const live = liveHere(env, url); if (env.LIVE === "1" && originProblem(env)) console.error(JSON.stringify({ at: "seo", problem: originProblem(env) }));
  const seo = seoFor({ env, url, cat, meta, site }), canonical = seo.canonical, img = seo.share;
  const shell = await env.ASSETS.fetch(new URL("/index.html", url));
  const extra = [`<link rel="canonical" href="${esc(canonical)}">`, `<meta name="oss-pay" content="${cardReady(env) ? "card" : "off"}">`, `<meta name="oss-shisha-card" content="${env.STRIPE_TOBACCO_OK === "1" ? "1" : "0"}">`,
    `<meta property="og:type" content="${meta.product ? "product" : "website"}">`, `<meta property="og:site_name" content="${esc(site)}">`, `<meta property="og:locale" content="en_CA">`,
    `<meta property="og:title" content="${esc(meta.title)}">`, `<meta property="og:description" content="${esc(meta.desc)}">`, `<meta property="og:url" content="${esc(canonical)}">`,
    // the share picture: absolute, versioned per photo (a changed photo gets a new address, so previews refresh), sized when known
    `<meta property="og:image" content="${esc(img.url)}">`, ...(img.type ? [`<meta property="og:image:type" content="${img.type}">`] : []),
    ...(img.w ? [`<meta property="og:image:width" content="${img.w}">`, `<meta property="og:image:height" content="${img.h}">`] : []), `<meta property="og:image:alt" content="${esc(img.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`, ...seo.head, SSR_STYLE];
  if (url.pathname === "/") { const hero = heroFirst(cat); if (hero) extra.push(heroPreload(hero)); }   // the picture the first screen is waiting for
  const out = new HTMLRewriter()
    .on("title", { element(e) { e.setInnerContent(meta.title); } })
    .on('meta[name="description"]', { element(e) { e.setAttribute("content", meta.desc); } })
    .on('meta[name="robots"]', { element(e) { if (live && meta.index) e.remove(); else e.setAttribute("content", "noindex, nofollow"); } })
    .on("head", { element(e) { e.append(extra.join("\n") + "\n", { html: true }); } })
    .on("main#main", { element(e) { if (seo.body) e.setInnerContent(seo.body, { html: true }); } })   // the content in the HTML; the page replaces it when it draws
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
    if (weightUnknown(p)) o.weight_g = null;   // the import's placeholder weight (1 g, 2,500 g) is not a fact: unknown says unknown
    // the item's own public details (the charcoal mark, brand, size, description); the shop's notes on photo rights and sources stay private
    let d = {}; try { d = JSON.parse(p.details || "{}") || {}; } catch {}
    if (isCharcoalRow(p)) d.charcoal = true;   // the mark follows the section and the charcoal list, as on the storefront
    if ("photo" in d && !PUBLIC_PHOTO.includes(d.photo)) delete d.photo;   // only the photo states a page shows; other photo notes stay private
    o.details = JSON.stringify(Object.fromEntries(FEED_DETAILS.filter(k => k in d).map(k => [k, d[k]])));
    if (counterRow(p) || counterPayRow(p)) o.ship_class = "pickup_only";   // counterPayRow: shisha, paid at the counter until card payment is approved   // charcoal, and anything whose weight is not known yet
    return o; }) };
}
// If-None-Match may carry a list of tags, weak or strong (RFC 9110 13.1.2): any one of them matching is a hit.
const matches = (request, tag) => (request.headers.get("If-None-Match") || "").split(",").some(t => t.trim().replace(/^W\//, "") === tag || t.trim() === "*");
const fnv = s => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return (h >>> 0).toString(36); };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// The first hookah in the home hero, picked by the page's own rule (public/picks.js), with the same image list, so the browser reuses this download.
const IMG_V = "?v=1794615693";   // IMG_V matches V in public/app.js; a photo with its own version (p.iv) uses that, as the page does
const heroFirst = cat => heroPicks([...view(cat).front.values()], 1)[0] || null;
const heroPreload = p => { const u = s => `img/pc/${p.img}${s}.webp${p.iv ? "?v=" + p.iv : IMG_V}`; return `<link rel="preload" as="image" fetchpriority="high" href="${u("")}" imagesrcset="${u("-s")} 360w, ${u("-m")} 540w, ${u("")} 720w${p.lw ? `, ${u("-l")} ${p.lw}w` : ""}" imagesizes="(min-width:960px) 42vw, 58vw">`; };

export default {
  // every night: a full copy of the shop's records into the backup bucket
  async scheduled(event, env, ctx) {
    if (event.cron === "*/10 * * * *") {   // every 10 minutes: unpaid orders checked with Stripe (stock it put back shows in the shop at once), and order emails the mail service refused sent again
      ctx.waitUntil(sweep(env).then(r => { console.log(JSON.stringify({ at: "pay-sweep", ...r })); if (r.paid || r.released) dropCatalog(ctx); }));
      ctx.waitUntil(retryEmails(env).then(r => { if (r.tried) console.log(JSON.stringify({ at: "email-retry", ...r })); }).catch(e => console.error(JSON.stringify({ at: "email-retry", message: String(e && e.message || e) }))));
      return;
    }
    ctx.waitUntil(scrubCodes(env).then(() => nightly(env))); ctx.waitUntil(stockAlerts(env).then(() => restockReminders(env)));   // nightly: backup, and the customers' alerts and charcoal reminders
  },
  async fetch(request, env, ctx) { setShishaCard(env.STRIPE_TOBACCO_OK); return demoNoindex(await route(request, env, ctx), env, request); },
};
// While the shop is not live on this address, every answer says noindex: redirects, errors, API answers and uploaded
// photos too (the static files get it from public/_headers). A page sets its own header in page().
function demoNoindex(r, env, request) {
  if (liveHere(env, new URL(request.url)) || r.headers.get("X-Robots-Tag")) return r;
  const out = new Response(r.body, r); out.headers.set("X-Robots-Tag", "noindex, nofollow"); return out;
}
const INTAKE = "ij9A2jg3vBRk";   // the questionnaire's private link: /intake/ij9A2jg3vBRk
async function intakeSave(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const site = request.headers.get("Sec-Fetch-Site"), origin = request.headers.get("Origin");
  if ((site && site !== "same-origin") || (origin && origin !== new URL(request.url).origin)) return json({ error: "Wrong origin." }, 403);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return json({ error: "Send it from the questionnaire page." }, 415);
  if (+(request.headers.get("content-length") || 0) > 200000) return json({ error: "That is too long to send" }, 413);
  // read at most 200 KB whatever the headers say (a body sent in chunks has no length to check)
  const reader = request.body?.getReader(), parts = []; let size = 0;
  if (!reader) return json({ error: "Nothing to save" }, 400);
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 200000) { try { await reader.cancel(); } catch {} return json({ error: "That is too long to send" }, 413); } parts.push(value); }
  let body; try { body = JSON.parse(new TextDecoder().decode(await new Blob(parts).arrayBuffer())); } catch { return json({ error: "That did not arrive whole" }, 400); }
  if (!body || typeof body.answers !== "object" || body.answers === null || Array.isArray(body.answers)) return json({ error: "Nothing to save" }, 400);
  const plain = v => typeof v === "string" ? v.slice(0, 20000) : v === true ? true : Array.isArray(v) ? v.slice(0, 50).map(x => String(x).slice(0, 120)) : String(v ?? "").slice(0, 2000);
  const answers = Object.fromEntries(Object.entries(body.answers).slice(0, 600).filter(([k]) => /^[\w-]{1,60}$/.test(k)).map(([k, v]) => [k, plain(v)]));
  const rows = (Array.isArray(body.rows) ? body.rows : []).filter(r => r && typeof r === "object" && typeof r.key === "string" && /^[\w-]{1,60}$/.test(r.key)).slice(0, 600).map(r => ({ key: r.key, ...(typeof r.item === "string" ? { item: r.item.slice(0, 120) } : {}), value: plain(r.value) }));
  const text = JSON.stringify({ answers, rows, sentAt: typeof body.sentAt === "string" ? body.sentAt.slice(0, 40) : null, receivedAt: new Date().toISOString() });
  await env.BACKUPS.put(`intake/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}.json`, text, { httpMetadata: { contentType: "application/json" } });
  await env.BACKUPS.put("intake/latest.json", text, { httpMetadata: { contentType: "application/json" } });   // the newest send, at a name that never changes
  return json({ ok: true });
}
async function route(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/catalog-module") {
        if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
        // Always checked with the shop (so a back-office change shows on the next page), but the check is one small
        // round trip answered from memory: an unchanged catalogue is "304, use the copy you have".
        const body = catalogModule(await shopCatalog(env, ctx));
        const tag = `"c${fnv(body)}-${body.length}"`, head = { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache", ETag: tag, "X-Content-Type-Options": "nosniff" };
        if (matches(request, tag)) return new Response(null, { status: 304, headers: head });
        return new Response(body, { headers: head });
      }
      if (path === "/api/catalog") {
        if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405);
        // the shared copy (memory, then the data centre's cache), never a full database read per request. The feed is
        // written once per copy (not per request) and tagged: a reader that has it gets "304, unchanged" without the body,
        // and stock is never older than the shop's own copy (no-cache: always checked, never served stale from a cache).
        const cat = await shopCatalog(env, ctx), v = view(cat);
        if (!v.feed) { const body = JSON.stringify(publicFeed(cat)); v.feed = { body, tag: `"f${fnv(body)}-${body.length}"` }; }
        const head = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache", ETag: v.feed.tag, "X-Content-Type-Options": "nosniff" };
        if (matches(request, v.feed.tag)) return new Response(null, { status: 304, headers: head });
        return new Response(request.method === "HEAD" ? null : v.feed.body, { headers: head });
      }
      if (path === "/api/admin/loyalty") return await loyaltyAdmin(request, env, url, async (r, e) => !!(await signedIn(r, e))?.owner);   // the points program is the owner's setting, never staff
      if (path.startsWith("/api/admin/")) { const r = await admin(request, env, url); if (request.method !== "GET" && r.ok) { dropCatalog(ctx); ctx.waitUntil(stockAlerts(env, url.origin)); } return r; } // a change in the back office shows in the shop at once; anything back in stock emails whoever asked
      if (path.startsWith("/api/account/")) return await accountRoute(request, env, url);
      if (path === "/api/orders") { if (request.method !== "POST") return json({ error: "Method not allowed" }, 405); const r = await placeOrder(request, env, url); if (r.ok) dropCatalog(ctx); return r; }
      if (path === "/api/delivery") return await deliveryRoute(request, env, url);
      if (path === "/api/pay/webhook") { const r = await webhook(request, env); if (r.ok) dropCatalog(ctx); return r; }   // Stripe calls this; the signature is the only way in
      if (path === "/api/pay/status") return await payStatus(request, env, url);
      const ph = path.match(/^\/api\/photo\/(OSS-\d{4,6})$/); if (ph && (request.method === "GET" || request.method === "HEAD")) { const r = await photo(env, ph[1]); return request.method === "HEAD" ? new Response(null, r) : r; }   // link-preview crawlers often ask HEAD first
      // the shop's questionnaire (2026-11-25): a private link, one page; each Send is kept as its own file in the backups bucket
      if (path === "/api/intake/" + INTAKE) return await intakeSave(request, env);
      if (path === "/intake/" + INTAKE) {
        const page = await env.ASSETS.fetch(new URL("/intake.html", url)); if (!page.ok) return new Response("Not found", { status: 404, headers: SECURITY });
        const headers = new Headers(page.headers);
        for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
        headers.set("X-Robots-Tag", "noindex, nofollow"); headers.set("Cache-Control", "no-cache"); headers.set("Referrer-Policy", "no-referrer");
        return new Response(page.body, { status: 200, headers });
      }
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
        // only once the shop is live, and only on its own address (SITE_ORIGIN): the demo copy stays out of search engines
        if (!liveHere(env, url)) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" } });
        return new Response(sitemap(env, url, await shopCatalog(env, ctx)), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" } });
      }
      if (path === "/robots.txt") return new Response(robots(env, url), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      if (path === "/index.html") return Response.redirect(url.origin + "/", 301);
      // the Gifts section is gone (owner, 2026-11-26: "it just adds clutter"): its old addresses go to the whole shop
      if (/^\/gifts(\/|$)/.test(url.pathname)) return new Response(null, { status: 301, headers: { ...SECURITY, Location: url.origin + "/shop", "Cache-Control": "public, max-age=86400" } });
  { const to = charcoalMoved(url); if (to) return new Response(null, { status: 301, headers: { ...SECURITY, Location: url.origin + to, "Cache-Control": "public, max-age=86400" } }); }
      const lower = path.match(/^\/p\/([A-Za-z]+-\d+)\/?$/); if (lower && lower[1] !== lower[1].toUpperCase()) return Response.redirect(`${url.origin}/p/${lower[1].toUpperCase()}`, 301);   // an item number typed in small letters
      if (path === "/intake.html") return new Response("Not found", { status: 404, headers: SECURITY });   // the questionnaire is only at its link
      if (/\.[a-z0-9]{2,5}$/i.test(path)) return env.ASSETS.fetch(request); // a file that is not there: plain 404
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      return await page(request, env, url, ctx);
    } catch (err) {
      console.error(JSON.stringify({ at: "fetch", path, message: String(err && err.message || err) }));
      return new Response("Something went wrong on our side. Please try again.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
