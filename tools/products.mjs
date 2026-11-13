// Processes assets-src/hi/*.img (retailer packshots, PLACEHOLDERS, fetched at up to 2400px) into site/img/p:
//   <id>-s.webp 360x450, <id>.webp 720x900, <id>-l.webp 1440x1800 (only when the source has the pixels).
// White is flattened and trimmed, then the piece is centred on a 4:5 white canvas so CSS multiply drops the
// white onto a colour tile. Never upscales: a soft source stays at its real size. Writes site/img/p/sizes.json.
import { createRequire } from "node:module"; import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
const sharp = createRequire("C:/dev/hm-barbershop/package.json")("sharp");
sharp.concurrency(2); // keep the laptop responsive
mkdirSync("site/img/p", { recursive: true });
const DARK = new Set(["hookah11", "hookah12", "hookah14", "hookah18"]);
const sizes = {}; let n = 0;
for (const f of readdirSync("assets-src/hi").filter(f => f.endsWith(".img"))) {
  const id = f.replace(".img", "");
  try {
    if (DARK.has(id)) {
      const m = await sharp("assets-src/hi/" + f).metadata();
      for (const [w, suf] of [[800, ""], [1600, "-l"]]) await sharp("assets-src/hi/" + f).resize(Math.min(w, m.width), null, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(`site/img/p/${id}${suf}.webp`);
      sizes[id] = { srcW: m.width, srcH: m.height, dark: true, maxW: m.width, lw: m.width >= 1000 ? Math.min(1600, m.width) : 0 }; n++; continue;
    }
    const flat = await sharp("assets-src/hi/" + f).flatten({ background: "#ffffff" }).trim({ background: "#ffffff", threshold: 12 }).toBuffer();
    const m = await sharp(flat).metadata();
    const need = (W, H) => Math.min((W * 0.86) / m.width, (H * 0.9) / m.height); // scale factor to fit the canvas
    const maxW = Math.floor(Math.max(m.width / 0.86, (m.height / 0.9) * 0.8));       // widest canvas with no upscaling
    const lw = maxW >= 900 ? Math.min(1440, maxW) : 0;
    const out = { srcW: m.width, srcH: m.height, maxW, lw };
    for (const [W, suf, q] of [[360, "-s", 82], [720, "", 84], [lw, "-l", 82]]) {
      if (!W) continue;
      const H = Math.round(W * 1.25);
      const b = await sharp(flat).resize(Math.round(W * 0.86), Math.round(H * 0.9), { fit: "inside", kernel: "lanczos3" }).toBuffer();
      await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).composite([{ input: b, gravity: "centre" }]).webp({ quality: q, smartSubsample: true }).toFile(`site/img/p/${id}${suf}.webp`);
    }
    out.soft = maxW < 625; // source cannot fill even the 720 tile
    sizes[id] = out; n++;
  } catch (e) { console.log("bad", id, e.message); }
}
writeFileSync("site/img/p/sizes.json", JSON.stringify(sizes));
const v = Object.values(sizes);
console.log("products", n, "| with large version", v.filter(x => x.lw).length, "| soft sources:", Object.entries(sizes).filter(([, x]) => x.soft).map(([k]) => k).join(" ") || "none");
