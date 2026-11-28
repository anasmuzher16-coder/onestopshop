// Looks for white boxes: samples the corner pixels of every product image as actually rendered on the page.
// A corner that renders near-white on a coloured tile means the photo's background is showing.
import { createRequire } from "node:module";
const pw = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright"), chromium = pw[process.env.ENGINE || "chromium"]; // ENGINE=webkit checks the Safari engine
const sharp = createRequire(process.env.PW_FROM || "C:/dev/dijji-crm/package.json")("sharp");
const base = process.env.BASE || "http://127.0.0.1:4420/";
// the product pages with more photos (products.img_more in the seed): every extra photo is shown in turn and checked too
import { readFileSync } from "node:fs";
import { SEED_FILES, seedPath } from "./seed-files.mjs";
const GALLERY = [...new Set(SEED_FILES.flatMap(f => [...readFileSync(seedPath(f), "utf8").matchAll(/^UPDATE products SET img_more = '[^']*' WHERE sku = '(OSS-\d+)'/gm)].map(x => "p/" + x[1])))];
const b = await chromium.launch(); let bad = 0, n = 0;
try {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    for (const r of ["", "shop/hookahs", "shop/bowls", "shop/bases", "shop/parts", "p/OSS-100024", "cart", "shop/cologne", "shop/misc", "shop/heat", "shop/hoses", "p/OSS-120011", "p/OSS-120021", "p/OSS-9601", "p/OSS-9308", ...GALLERY]) {
      await p.goto(base + r, { waitUntil: "networkidle" });
      await p.addStyleTag({ content: "*{animation:none!important;transition:none!important} .sticker,.truecolour{visibility:hidden!important}" });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
      await p.waitForLoadState("networkidle");
      const shot = await p.screenshot({ fullPage: true }); const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      const boxes = await p.evaluate(() => [...document.querySelectorAll("#main img.shot:not(.shot--photo):not(.piece img), #main img.lu__img")].map(i => { const r = i.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, src: i.currentSrc.split("/").pop() }; }).filter(r => r.w > 20));
      // a gallery: each extra photo in turn (the right arrow on the photo), its corners sampled like the rest
      const more = await p.evaluate(() => { const s = document.querySelector("[data-stage][data-gal]"); return s ? s.querySelectorAll(".gal__t").length - 1 : 0; });
      for (let k = 0; k < more; k++) {
        await p.evaluate(() => scrollTo(0, 0)); await p.focus("[data-stage] > .shot"); await p.keyboard.press("ArrowRight");
        const moved = await p.waitForFunction(i => document.querySelector("[data-stage]").dataset.gal === String(i) && document.querySelectorAll("[data-stage] > .shot").length === 1 && document.querySelector("[data-stage] > .shot").complete, k + 1, { timeout: 5000 }).then(() => true, () => false);
        if (!moved) { n++; bad++; console.log(`GALLERY ${w}px ${r}: photo ${k + 2} never came up`); continue; }
        const v = await p.screenshot(), g = await sharp(v).raw().toBuffer({ resolveWithObject: true });
        const r2 = await p.evaluate(() => { const i = document.querySelector("[data-stage] > .shot"), r = i.getBoundingClientRect(), cs = getComputedStyle(i);
          return { x: r.left + parseFloat(cs.paddingLeft), y: r.top + parseFloat(cs.paddingTop), w: r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h: r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), src: i.currentSrc.split("/").pop() }; });
        const px2 = (x, y) => { x = Math.round(Math.min(g.info.width - 1, Math.max(0, x))); y = Math.round(Math.min(g.info.height - 1, Math.max(0, y))); const o = (y * g.info.width + x) * g.info.channels; return [g.data[o], g.data[o + 1], g.data[o + 2]]; };
        n++; if ([[r2.x + 3, r2.y + 3], [r2.x + r2.w - 4, r2.y + 3], [r2.x + 3, r2.y + r2.h * .4], [r2.x + r2.w - 4, r2.y + r2.h * .4]].map(([x, y]) => px2(x, y)).filter(c => Math.min(...c) > 236).length >= 2) { bad++; console.log(`WHITE BOX ${w}px ${r} photo ${k + 2} ${r2.src}`); }
      }
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
