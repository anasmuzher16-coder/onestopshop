// Contact sheet of the smoke at fixed moments, so motion can be judged from stills. node store/tools/smoke-sheet.mjs <out.png> [path] [width]
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const sharp = createRequire("C:/dev/hm-barbershop/package.json")("sharp");
const [out, path = "/p/OSS-1001", width = "390"] = process.argv.slice(2), B = process.env.BASE || "http://127.0.0.1:4420";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }); const errs = [];
try {
  const p = await b.newPage({ viewport: { width: +width, height: +width < 500 ? 844 : 900 }, deviceScaleFactor: 1 });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
  await p.goto(B + path, { waitUntil: "networkidle" }); await p.waitForFunction(() => window.__smoke && document.querySelector(".smoke.on"), null, { timeout: 15000 }); await p.waitForTimeout(1800);
  const box = await p.locator(path === "/" ? ".hero__stage" : "[data-stage]").boundingBox(), shots = [];
  for (const s of [40, 43, 46, 49, 52, 58, 70, 90]) { await p.evaluate(v => window.__smoke.at(v), s); await p.waitForTimeout(140); shots.push(await p.screenshot({ clip: box })); }
  const w = Math.round(box.width), h = Math.round(box.height), cols = 4;
  await sharp({ create: { width: w * cols, height: h * 2, channels: 3, background: "#000" } }).composite(shots.map((input, i) => ({ input, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).png().toFile(out);
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; performance.now() - t < 1000 ? requestAnimationFrame(f) : r(n); }; requestAnimationFrame(f); }));
  console.log("frames in one second (software rendering in this test browser):", fps);
} finally { await b.close(); }
console.log(errs.length ? "ERRORS " + errs.join(" | ") : "no page errors");
