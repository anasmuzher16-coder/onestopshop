// Full-page pictures of every page that is not a shop section, at phone and desktop width, for design review.
// node tools/shots-pages.mjs <out dir> [width]     (BASE=https://... for the live site)
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const [out, width = "390"] = process.argv.slice(2), B = process.env.BASE || "http://127.0.0.1:4420", W = +width;
const PAGES = (process.env.PAGES || "home=/,shop=/shop,set=/set,search=/search,gifts=/gifts,cart=/cart,shipping=/shipping,checkout=/checkout,terms=/terms,missing=/nothing-here").split(",").map(x => x.split("="));
const b = await chromium.launch(); const errs = [];
try {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("oss:cart", JSON.stringify([{ sku: "OSS-1001", qty: 1 }, { sku: "OSS-7003", qty: 2 }])); localStorage.setItem("oss:postal", JSON.stringify("N9A 1A1")); } catch {} });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  for (const [name, path] of PAGES) {
    await p.goto(B + path, { waitUntil: "networkidle" }); await p.waitForTimeout(1800);
    if (name === "search") { await p.fill('input[type="search"], [data-q], input[name="q"]', "bowl").catch(() => {}); await p.waitForTimeout(700); }
    await p.screenshot({ path: `${out}/${name}-${W}.png`, fullPage: true });
  }
} finally { await b.close(); }
console.log(errs.length ? "ERRORS " + [...new Set(errs)].join(" | ") : "no page errors");
