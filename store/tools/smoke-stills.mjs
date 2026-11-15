// Renders two still frames of the smoke from the live shader, for the fallback layer. node store/tools/smoke-stills.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const sharp = createRequire("C:/dev/hm-barbershop/package.json")("sharp");
const B = process.env.BASE || "http://127.0.0.1:4420";
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(B + "/p/OSS-1001", { waitUntil: "networkidle" }); await p.waitForFunction(() => window.__smoke, null, { timeout: 15000 });
  for (const [name, t] of [["a", 43], ["b", 58]]) {
    const url = await p.evaluate(s => window.__smoke.frame(s), t), buf = Buffer.from(url.split(",")[1], "base64");
    const out = await sharp(buf).resize(352, 440, { kernel: "cubic" }).webp({ quality: 70, alphaQuality: 80 }).toFile(`public/img/smoke-${name}.webp`);
    console.log(`smoke-${name}.webp`, out.size, "bytes");
  }
} finally { await b.close(); }
