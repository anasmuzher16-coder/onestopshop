// Frame-by-frame contact sheets of the product-page acts, one PNG per product, big enough to judge.
// node tools/fx-piece-sheet.mjs <out dir> [width]     SKUS=OSS-7001,... TIMES=...  ENGINE=webkit  COLS=4
import { createRequire } from "node:module";
const pw = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const sharp = createRequire(process.env.PW_FROM || "C:/dev/dijji-crm/package.json")("sharp");
const [out, width = "390"] = process.argv.slice(2), B = process.env.BASE || "http://127.0.0.1:4420", W = +width, webkit = process.env.ENGINE === "webkit";
const SKUS = (process.env.SKUS || "OSS-1001,OSS-7001,OSS-2001,OSS-3001,OSS-4003,OSS-5001,OSS-6002,OSS-8001").split(",");
const TIMES = (process.env.TIMES || "420,560,700,860,1050,1300,1700,2600").split(",").map(Number), COLS = +(process.env.COLS || 4);
const b = await (webkit ? pw.webkit : pw.chromium).launch(); const errs = [];
try {
  const ctx = await b.newContext(webkit && W < 500 ? { ...pw.devices["iPhone 14 Pro Max"] } : { viewport: { width: W, height: W < 500 ? 844 : 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(), scale = webkit && W < 500 ? pw.devices["iPhone 14 Pro Max"].deviceScaleFactor : 1;
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
  await p.goto(B + "/shop", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  for (const sku of SKUS) {
    await p.evaluate(c => { history.pushState(null, "", "/p/" + c); dispatchEvent(new Event("routechange")); }, sku);
    const t0 = Date.now(); await p.waitForSelector(`[data-stage="${sku}"]`);
    const box = await p.locator("[data-stage]").first().boundingBox(), vw = p.viewportSize().width, clip = { x: 0, y: box.y, width: Math.min(box.width, vw), height: Math.min(box.height, +(process.env.TALL || 1000)) }, shots = [];
    for (const t of TIMES) { const wait = t - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait); shots.push([Date.now() - t0, await p.screenshot({ clip })]); }
    const cw = Math.round(clip.width), chh = Math.round(clip.height), gap = 4, rows = Math.ceil(shots.length / COLS), comps = [];
    for (let i = 0; i < shots.length; i++) comps.push({ input: await sharp(shots[i][1]).resize({ width: cw, height: chh, fit: "fill" }).png().toBuffer(), left: (i % COLS) * (cw + gap), top: Math.floor(i / COLS) * (chh + gap) });
    await sharp({ create: { width: COLS * (cw + gap), height: rows * (chh + gap), channels: 3, background: "#000" } }).composite(comps).jpeg({ quality: 80 }).toFile(`${out}/${sku}-${W}${webkit ? "-wk" : ""}.jpg`);
    console.log(sku, "frames at", shots.map(s => s[0]).join(" "));
    await p.evaluate(() => { history.pushState(null, "", "/shop"); dispatchEvent(new Event("routechange")); }); await p.waitForTimeout(700);
  }
} finally { await b.close(); }
console.log(errs.length ? "ERRORS " + [...new Set(errs)].join(" | ") : "no page errors");
