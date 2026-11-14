// One Stop Shop store Worker. Answers the page routes (each with its own title, description and a real 404),
// serves the catalogue from the database, and passes every other request to the static files.
import { loadCatalog, catalogModule } from "./catalog.js";

const SECURITY = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
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
    const n = cat.products.filter(p => p.category_id === c.id).length;
    return { title: `${c.name} | ${site}`, desc: `${n} ${c.name.toLowerCase()} in stock at our Windsor counter, shipped anywhere in Canada.`, index: true };
  }
  if (a === "p") {
    const p = cat.products.find(x => x.sku === b); if (!p) return null;
    return { title: `${p.name} | ${site}`, desc: `${p.note}. ${money(p.price_cents)}. Shipped across Canada or free pickup in Windsor.`, index: true, product: p };
  }
  if (b && a !== "gifts") return null;
  const fixed = { cart: "Cart", shipping: "Shipping and returns", set: "Build a set", search: "Search", gifts: "Gifts" };
  if (!fixed[a]) return null;
  return { ...base, title: `${fixed[a]} | ${site}`, index: a === "shipping" || a === "set" };
}

async function page(request, env, url) {
  const cat = await loadCatalog(env.DB);
  const site = env.SITE_NAME || "One Stop Shop";
  const d = describe(url.pathname, cat, site);
  const meta = d || { title: `Page not found | ${site}`, desc: "That page does not exist.", index: false };
  const live = env.LIVE === "1";
  const canonical = url.origin + (url.pathname.replace(/\/+$/, "") || "/");
  const shell = await env.ASSETS.fetch(new URL("/index.html", url));
  const extra = [`<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="${meta.product ? "product" : "website"}">`, `<meta property="og:site_name" content="${esc(site)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`, `<meta property="og:description" content="${esc(meta.desc)}">`, `<meta property="og:url" content="${canonical}">`];
  if (meta.product) {
    const p = meta.product, img = `${url.origin}/img/pc/${p.img}.webp`;
    extra.push(`<meta property="og:image" content="${img}">`);
    const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, description: p.note, image: img,
      offers: { "@type": "Offer", price: (p.price_cents / 100).toFixed(2), priceCurrency: "CAD", url: canonical, availability: "https://schema.org/" + (p.stock > 0 ? "InStock" : "OutOfStock") } };
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
  if (!(live && meta.index)) headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(out.body, { status: d ? 200 : 404, headers });
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/catalog-module") {
        if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
        return new Response(catalogModule(await loadCatalog(env.DB)), { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" } });
      }
      if (path === "/api/catalog") {
        if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
        return json(await loadCatalog(env.DB));
      }
      if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
      if (path === "/admin" || path.startsWith("/admin/")) return new Response("Not built yet", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
      if (path === "/index.html") return Response.redirect(url.origin + "/", 301);
      if (/\.[a-z0-9]{2,5}$/i.test(path)) return env.ASSETS.fetch(request); // a file that is not there: plain 404
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      return await page(request, env, url);
    } catch (err) {
      console.error(JSON.stringify({ at: "fetch", path, message: String(err && err.message || err) }));
      return new Response("Something went wrong on our side. Please try again.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
