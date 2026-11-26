// Frame-by-frame contact sheet of every section entrance, so motion can be reviewed from stills.
// One row per section, six moments left to right. node store/tools/fx-sheet.mjs <out.png> [width]
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const sharp = createRequire(process.env.PW_FROM || "C:/dev/dijji-crm/package.json")("sharp");
const [out, width = "390"] = process.argv.slice(2), B = process.env.BASE || "http://127.0.0.1:4420", W = +width;
const PDP = (process.env.PDP || "").split(",").filter(Boolean); // product pages instead: PDP=OSS-7003,OSS-1001
const ROWS = PDP.length ? PDP.map(sku => [sku, "[data-stage]"]) : [["hookahs", ".shophead"], ["cologne", ".shophead"], ["bases", ".shophead"], ["bowls", ".shophead"], ["heat", ".shophead"], ["hoses", ".shophead"], ["parts", ".shophead"], ["misc", "#main"]];
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const TIMES = (process.env.TIMES || "260,520,850,1250,1800,3200").split(",").map(Number);
const b = await chromium.launch(); const errs = [], rows = [];
try {
  const p = await b.newPage({ viewport: { width: W, height: W < 500 ? 844 : 900 }, deviceScaleFactor: 1 });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
  await p.goto(B + "/shop", { waitUntil: "networkidle" }); await p.waitForFunction(() => window.__smoke, null, { timeout: 15000 }); await p.waitForTimeout(500);
  for (const [cat, sel] of ROWS.filter(r => !ONLY.length || ONLY.includes(r[0]))) {
    // arrive the way a shopper does: a tap on the section chip, so the entrance plays from its first frame
    await p.evaluate(c => { history.pushState(null, "", (/^OSS-/.test(c) ? "/p/" : "/shop/") + c); dispatchEvent(new Event("routechange")); }, cat);
    const t0 = Date.now(); await p.waitForSelector(/^OSS-/.test(cat) ? `[data-stage="${cat}"]` : `.shophead[data-cat="${cat}"]`);
    const box = await p.locator(sel).first().boundingBox(), clip = { x: 0, y: box.y, width: W, height: Math.min(sel === "#main" ? 520 : box.height, 520) }, shots = [];
    for (const t of TIMES) { const wait = t - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait); shots.push(await p.screenshot({ clip })); }
    rows.push({ cat, shots, h: Math.round(clip.height) });
    await p.evaluate(() => { history.pushState(null, "", "/shop"); dispatchEvent(new Event("routechange")); }); await p.waitForTimeout(700);
  }
  const gap = 6, total = rows.reduce((a, r) => a + r.h + gap, 0), comps = []; let y = 0;
  for (const r of rows) { r.shots.forEach((input, i) => comps.push({ input, left: i * (W + gap), top: y })); y += r.h + gap; }
  await sharp({ create: { width: TIMES.length * (W + gap), height: total, channels: 3, background: "#000" } }).composite(comps).png().toFile(out);
} finally { await b.close(); }
console.log(errs.length ? "ERRORS " + [...new Set(errs)].join(" | ") : "no page errors");
