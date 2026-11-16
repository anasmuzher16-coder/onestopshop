// Contact sheet of every cut-out on a strong colour, to eyeball leftover white. node tools/cutsheet.mjs <prefix> <out>
import { createRequire } from "node:module"; import { readdirSync } from "node:fs";
const sharp = createRequire("C:/dev/dijji-crm/package.json")("sharp");
const [prefix, out] = process.argv.slice(2);
const files = readdirSync("site/img/pc").filter(f => f.startsWith(prefix) && f.endsWith("-m.webp")).sort();
const W = 180, H = 225, cols = 10, rows = Math.ceil(files.length / cols), tiles = [];
for (const [i, f] of files.entries()) tiles.push({ input: await sharp("site/img/pc/" + f).resize(W, H).toBuffer(), left: (i % cols) * W, top: Math.floor(i / cols) * H });
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: "#d0338f" } }).composite(tiles).jpeg({ quality: 85 }).toFile(out);
console.log(out, files.length);
