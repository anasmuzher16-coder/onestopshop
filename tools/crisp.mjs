// Crispness check: for every product image on key routes, compares the file's pixel width with the pixels
// it is drawn at (CSS width x device pixel ratio). Needs `node tools/serve.mjs`. One browser, closed at the end.
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const base = process.env.BASE || "http://localhost:4410/";
const b = await chromium.launch(); let bad = 0, n = 0;
try {
  for (const [name, vp, dpr] of [["phone", { width: 390, height: 844 }, 3], ["desktop", { width: 1440, height: 900 }, 1], ["desktop 2x", { width: 1440, height: 900 }, 2]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr }); const p = await ctx.newPage();
    for (const r of ["#/", "#/shop/hookahs", "#/shop/bowls", "#/p/OSS-1027", "#/p/OSS-1016", "#/p/OSS-3003"]) {
      await p.goto(base + r, { waitUntil: "networkidle" });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
      await p.waitForLoadState("networkidle");
      const rows = await p.evaluate(async () => {
        const real = {}; // srcset images report a density-corrected naturalWidth, so load each file plainly
        const size = src => real[src] ||= new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([0, 0]); im.src = src; });
        const out = [];
        for (const i of [...document.querySelectorAll("#main img")].filter(i => i.complete && i.currentSrc)) {
          const [w, h] = await size(i.currentSrc); if (!w) continue;
          const cs = getComputedStyle(i), bb = i.getBoundingClientRect(), fit = cs.objectFit; // content box: padding is not drawn on
          const r = { width: bb.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), height: bb.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) };
          const s = fit === "cover" ? Math.max(r.width / w, r.height / h) : fit === "contain" ? Math.min(r.width / w, r.height / h) : r.width / w;
          out.push({ src: i.currentSrc.split("/").slice(-2).join("/"), ratio: 1 / (s * devicePixelRatio) });
        }
        return out;
      });
      for (const x of rows) { n++; if (x.ratio < 0.8) { bad++; console.log(`SOFT ${name} ${r} ${x.src} has ${(x.ratio * 100).toFixed(0)}% of the pixels it needs`); } }
    }
    await ctx.close();
  }
} finally { await b.close(); }
console.log(bad ? `${bad} of ${n} images under 80% of needed pixels` : `PASS ${n} images, all at 80%+ of needed pixels`);
