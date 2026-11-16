// Looks for white boxes: samples the corner pixels of every product image as actually rendered on the page.
// A corner that renders near-white on a coloured tile means the photo's background is showing.
import { createRequire } from "node:module";
const pw = createRequire("C:/dev/puckempire-arena/package.json")("playwright"), chromium = pw[process.env.ENGINE || "chromium"]; // ENGINE=webkit checks the Safari engine
const sharp = createRequire("C:/dev/dijji-crm/package.json")("sharp");
const base = process.env.BASE || "http://localhost:4410/";
const b = await chromium.launch(); let bad = 0, n = 0;
try {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    for (const r of ["#/", "#/shop/hookahs", "#/shop/bowls", "#/shop/bases", "#/shop/parts", "#/p/OSS-1027", "#/cart"]) {
      await p.goto(base + r, { waitUntil: "networkidle" });
      await p.addStyleTag({ content: "*{animation:none!important;transition:none!important} .sticker,.truecolour{visibility:hidden!important}" });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
      await p.waitForLoadState("networkidle");
      const shot = await p.screenshot({ fullPage: true }); const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      const boxes = await p.evaluate(() => [...document.querySelectorAll("#main img.shot:not(.shot--photo):not(.piece img), #main img.lu__img")].map(i => { const r = i.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, src: i.currentSrc.split("/").pop() }; }).filter(r => r.w > 20));
      for (const bx of boxes) { n++;
        const px = (x, y) => { x = Math.round(Math.min(info.width - 1, Math.max(0, x))); y = Math.round(Math.min(info.height - 1, Math.max(0, y))); const o = (y * info.width + x) * info.channels; return [data[o], data[o + 1], data[o + 2]]; };
        const corners = [[bx.x + 3, bx.y + 3], [bx.x + bx.w - 4, bx.y + 3], [bx.x + 3, bx.y + bx.h * .4], [bx.x + bx.w - 4, bx.y + bx.h * .4]].map(([x, y]) => px(x, y));
        if (corners.filter(c => Math.min(...c) > 236).length >= 2) { bad++; console.log(`WHITE BOX ${w}px ${r} ${bx.src}`); }
      }
    }
    await p.close();
  }
} finally { await b.close(); }
console.log(bad ? `${bad} of ${n} product images show a white background` : `PASS ${n} product images, no white backgrounds`);
process.exit(bad ? 1 : 0);
