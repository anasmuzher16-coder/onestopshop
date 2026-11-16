// node tools/contact3.mjs <prefix> <out> : labelled sheet of cand/<prefix>*.jpg
import { createRequire } from "node:module"; import { readdirSync } from "node:fs";
const sharp = createRequire("C:/dev/dijji-crm/package.json")("sharp");
const [prefix, out] = process.argv.slice(2);
const files = readdirSync("cand").filter(f => f.startsWith(prefix) && /\.(jpg|png|webp)$/.test(f)).sort();
const W = 150, H = 190, cols = 12, rows = Math.ceil(files.length / cols);
const tiles = [];
for (const [i, f] of files.entries()) {
  try {
    const b = await sharp("cand/" + f).flatten({ background: "#fff" }).resize(W, H, { fit: "contain", background: "#fff" })
      .composite([{ input: Buffer.from(`<svg width="${W}" height="18"><rect width="100%" height="100%" fill="#000"/><text x="4" y="13" font-family="monospace" font-size="12" fill="#fff">${f.replace(/\..*/, "")}</text></svg>`), gravity: "south" }]).jpeg().toBuffer();
    tiles.push({ input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H });
  } catch (e) { console.log("bad", f); }
}
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: "#444" } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
console.log(out, files.length);
