// Frame-by-frame contact sheet of the page bands that are not shop sections (set, search, cart, ...).
// One row per page, moments left to right. node tools/fx-pages-sheet.mjs <out.png> [width]
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const sharp = createRequire("C:/dev/dijji-crm/package.json")("sharp");
const [out, width = "390"] = process.argv.slice(2), B = process.env.BASE || "http://127.0.0.1:4420", W = +width;
const ROWS = (process.env.ROWS || "/set,/search,/cart,/checkout,/shipping,/gifts,/terms,/privacy,/nothing-here,/shop").split(",");
const TIMES = (process.env.TIMES || "300,450,600,800,1100,1500,2200,3500").split(",").map(Number);
const b = await chromium.launch(); const errs = [], rows = [];
try {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("oss:cart", JSON.stringify([{ sku: "OSS-1001", qty: 1 }, { sku: "OSS-7003", qty: 2 }])); localStorage.setItem("oss:postal", JSON.stringify("N9A 1A1")); localStorage.setItem("oss:ship", JSON.stringify("pickup")); } catch {} });
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
  await p.goto(B + "/shop/bowls", { waitUntil: "networkidle" }); await p.waitForFunction(() => window.__smoke, null, { timeout: 15000 }); await p.waitForTimeout(600);
  for (const path of ROWS) {
    await p.evaluate(c => { history.pushState(null, "", c); dispatchEvent(new Event("routechange")); }, path);
    const t0 = Date.now(); await p.waitForSelector(".shophead[data-fx]");
    const box = await p.locator(".shophead[data-fx]").first().boundingBox(), clip = { x: 0, y: box.y, width: W, height: Math.min(box.height, 420) }, shots = [];
    for (const t of TIMES) { const wait = t - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait); shots.push(await p.screenshot({ clip })); }
    rows.push({ shots, h: Math.round(clip.height) });
    await p.evaluate(() => { history.pushState(null, "", "/shop/bowls"); dispatchEvent(new Event("routechange")); }); await p.waitForTimeout(700);
  }
  const gap = 6, total = rows.reduce((a, r) => a + r.h + gap, 0), comps = []; let y = 0;
  for (const r of rows) { r.shots.forEach((input, i) => comps.push({ input, left: i * (W + gap), top: y })); y += r.h + gap; }
  await sharp({ create: { width: TIMES.length * (W + gap), height: total, channels: 3, background: "#000" } }).composite(comps).png().toFile(out);
} finally { await b.close(); }
console.log(errs.length ? "ERRORS " + [...new Set(errs)].join(" | ") : "no page errors");
