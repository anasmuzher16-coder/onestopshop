var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/catalog.js
async function loadCatalog(db) {
  const [cats, boxes, prods] = await db.batch([
    db.prepare("SELECT id, name, tone FROM categories WHERE active = 1 ORDER BY sort, name"),
    db.prepare("SELECT id, label, l_cm, w_cm, h_cm, tare_g FROM boxes ORDER BY id"),
    db.prepare("SELECT p.sku, p.name, p.category_id, p.price_cents, p.weight_g, p.box_id, p.glass, p.ship_class, p.height_cm, p.note, p.img, p.img_dark, p.img_lw, p.details, p.stock FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active = 1 AND c.active = 1 ORDER BY p.sort, p.sku")
  ]);
  return { categories: cats.results, boxes: boxes.results, products: prods.results };
}
__name(loadCatalog, "loadCatalog");
function catalogModule(cat) {
  const BOXES = {};
  for (const b of cat.boxes) BOXES[b.id] = { l: b.l_cm, w: b.w_cm, h: b.h_cm, tare: b.tare_g / 1e3, label: b.label };
  const CATEGORIES = cat.categories.map((c) => ({ id: c.id, name: c.name, tone: c.tone }));
  const PRODUCTS = cat.products.map((p) => {
    let details = {};
    try {
      details = JSON.parse(p.details || "{}");
    } catch {
      details = {};
    }
    return {
      sku: p.sku,
      name: p.name,
      cat: p.category_id,
      price: p.price_cents / 100,
      kg: p.weight_g / 1e3,
      box: p.box_id,
      glass: !!p.glass,
      height: p.height_cm,
      note: p.note,
      img: p.img,
      dark: !!p.img_dark,
      lw: p.img_lw ?? void 0,
      ship: p.ship_class,
      stock: p.stock,
      details
    };
  });
  const lit = /* @__PURE__ */ __name((v) => JSON.stringify(v).split(String.fromCharCode(8232)).join("\\u2028").split(String.fromCharCode(8233)).join("\\u2029"), "lit");
  return `// Served from the store database.
export const BOXES = ${lit(BOXES)};
export const CATEGORIES = ${lit(CATEGORIES)};
export const PRODUCTS = ${lit(PRODUCTS)};
`;
}
__name(catalogModule, "catalogModule");

// src/worker.js
var SECURITY = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
var money = /* @__PURE__ */ __name((cents) => "$" + (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), "money");
function describe(path, cat, site) {
  const [a, b, extra] = path.split("/").filter(Boolean);
  const base = { title: `${site} | Hookahs and accessories, Windsor, shipped across Canada`, desc: "Hookahs, bases, bowls and hoses from our Windsor counter. Shipped anywhere in Canada.", index: true };
  if (!a) return base;
  if (extra) return null;
  if (a === "shop") {
    if (!b) return { ...base, title: `Shop | ${site}` };
    const c = cat.categories.find((x) => x.id === b);
    if (!c) return null;
    const n = cat.products.filter((p) => p.category_id === c.id).length;
    return { title: `${c.name} | ${site}`, desc: `${n} ${c.name.toLowerCase()} in stock at our Windsor counter, shipped anywhere in Canada.`, index: true };
  }
  if (a === "p") {
    const p = cat.products.find((x) => x.sku === b);
    if (!p) return null;
    return { title: `${p.name} | ${site}`, desc: `${p.note}. ${money(p.price_cents)}. Shipped across Canada or free pickup in Windsor.`, index: true, product: p };
  }
  if (b && a !== "gifts") return null;
  const fixed = { cart: "Cart", shipping: "Shipping and returns", set: "Build a set", search: "Search", gifts: "Gifts" };
  if (!fixed[a]) return null;
  return { ...base, title: `${fixed[a]} | ${site}`, index: a === "shipping" || a === "set" };
}
__name(describe, "describe");
async function page(request, env, url) {
  const cat = await loadCatalog(env.DB);
  const site = env.SITE_NAME || "One Stop Shop";
  const d = describe(url.pathname, cat, site);
  const meta = d || { title: `Page not found | ${site}`, desc: "That page does not exist.", index: false };
  const live = env.LIVE === "1";
  const canonical = url.origin + (url.pathname.replace(/\/+$/, "") || "/");
  const shell = await env.ASSETS.fetch(new URL("/index.html", url));
  const extra = [
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="${meta.product ? "product" : "website"}">`,
    `<meta property="og:site_name" content="${esc(site)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.desc)}">`,
    `<meta property="og:url" content="${canonical}">`
  ];
  if (meta.product) {
    const p = meta.product, img = `${url.origin}/img/pc/${p.img}.webp`;
    extra.push(`<meta property="og:image" content="${img}">`);
    const ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      sku: p.sku,
      description: p.note,
      image: img,
      offers: { "@type": "Offer", price: (p.price_cents / 100).toFixed(2), priceCurrency: "CAD", url: canonical, availability: "https://schema.org/" + (p.stock > 0 ? "InStock" : "OutOfStock") }
    };
    extra.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}<\/script>`);
  }
  const out = new HTMLRewriter().on("title", { element(e) {
    e.setInnerContent(meta.title);
  } }).on('meta[name="description"]', { element(e) {
    e.setAttribute("content", meta.desc);
  } }).on('meta[name="robots"]', { element(e) {
    if (live && meta.index) e.remove();
    else e.setAttribute("content", "noindex, nofollow");
  } }).on("head", { element(e) {
    e.append(extra.join("\n") + "\n", { html: true });
  } }).transform(shell);
  const headers = new Headers(out.headers);
  for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-cache");
  if (!(live && meta.index)) headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(out.body, { status: d ? 200 : 404, headers });
}
__name(page, "page");
var esc = /* @__PURE__ */ __name((s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"), "esc");
var worker_default = {
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
      if (/\.[a-z0-9]{2,5}$/i.test(path)) return env.ASSETS.fetch(request);
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      return await page(request, env, url);
    } catch (err) {
      console.error(JSON.stringify({ at: "fetch", path, message: String(err && err.message || err) }));
      return new Response("Something went wrong on our side. Please try again.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  }
};
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }), "json");

// ../../../Program Files/nodejs/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../Program Files/nodejs/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-PZXfTY/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../Program Files/nodejs/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-PZXfTY/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
