// Regression checks for the 2026-11-23 audit: loading, caching, sharing and the demo staying out of search engines.
// Needs the store running. node store/tools/test-quality.mjs
import { readFileSync } from "node:fs";
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const get = async p => { const r = await fetch(B + p, { redirect: "manual" }); return { r, t: await r.text() }; };
const home = await get("/");
ok(!/modulepreload" href="fx-/.test(home.t), "no effect code is preloaded ahead of the first paint");
ok(/rel="preload" as="image" fetchpriority="high"[^>]+imagesrcset="img\/pc\/[^"]+-s\.webp/.test(home.t), "the hero picture is preloaded");
ok(/<noscript>[\s\S]*519-255-2222[\s\S]*760 Wyandotte[\s\S]*Monday to Saturday 10 to 9, Sunday 11 to 7[\s\S]*<\/noscript>/.test(home.t), "with JavaScript off, the phone, address and hours are there");
ok(home.r.headers.get("strict-transport-security") === "max-age=31536000", "HSTS one year, no subdomains: " + home.r.headers.get("strict-transport-security"));
ok(/og:image" content="[^"]+\/img\/share\.jpg"/.test(home.t), "pages have a default share image");
ok((await fetch(B + "/img/share.jpg")).status === 200, "the share image exists");
const prod = await get("/p/OSS-1001"); ok(/og:image" content="[^"]+\/img\/pc\/hookah00\.webp"/.test(prod.t) && !/share\.jpg/.test(prod.t), "a product shares its own photo");
ok(/<meta name="robots" content="noindex, nofollow">/.test(home.t) && home.r.headers.get("x-robots-tag") === "noindex, nofollow", "the demo stays noindex");
const map = await get("/sitemap.xml");
if (process.env.EXPECT_LIVE === "1") ok(map.r.status === 200 && map.t.includes(`<loc>${B}/shop/hookahs</loc>`) && map.t.includes("/p/OSS-1001</loc>") && !map.t.includes("/cart"), "live: the sitemap lists the shop");
else ok(map.r.status === 404 && map.r.headers.get("x-robots-tag") === "noindex, nofollow", "demo: no sitemap: " + map.r.status);
const heads = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
ok(!/\/\*\.(js|css)\r?\n\s*Cache-Control:[^\r\n]*stale-while-revalidate/.test(heads), "scripts and styles cannot stay stale for days");
const bishop = (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === "OSS-1008");
ok(bishop && bishop.stock === 0, "the sold Resin Bishop reads 0 in the catalogue");
const buy = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "No Sale", email: "nosale@example.com", method: "pickup", lines: [{ sku: "OSS-1008", qty: 1 }] }) });
ok(buy.status === 409, "the server refuses the sold Resin Bishop: " + buy.status);
const page = await get("/p/OSS-1008"); ok(/OutOfStock/.test(page.t), "the Bishop's product data says out of stock");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
