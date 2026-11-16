// Labelled contact sheet of the cut-outs the catalogue actually uses. node tools/usedsheet.mjs <out> [cat,cat]
import { createRequire } from "node:module";
const sharp = createRequire("C:/dev/dijji-crm/package.json")("sharp");
const { PRODUCTS } = await import("../site/catalog.js");
const [out, cats] = process.argv.slice(2);
const ps = PRODUCTS.filter(p => !cats || cats.split(",").includes(p.cat));
const W = 200, H = 250, cols = 9, rows = Math.ceil(ps.length / cols), tiles = [];
for (const [i, p] of ps.entries()) {
  const l = (i % cols) * W, t = Math.floor(i / cols) * H;
  tiles.push({ input: await sharp(`site/img/pc/${p.img}-m.webp`).resize(W, H).toBuffer(), left: l, top: t });
  tiles.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="18"><text x="4" y="13" font-family="Arial" font-size="13" fill="#fff">${p.img}</text></svg>`), left: l, top: t });
}
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: "#7a1f3d" } }).composite(tiles).jpeg({ quality: 88 }).toFile(out);
console.log(out, ps.length);
