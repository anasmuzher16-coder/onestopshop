import { createRequire } from "node:module"; import { readdirSync } from "node:fs";
const sharp = createRequire("C:/dev/dijji-crm/package.json")("sharp");
const files = readdirSync("site/img").filter(f => !f.startsWith("wide")).sort();
const W = 200, H = 300, cols = 8, rows = Math.ceil(files.length / cols);
const tiles = await Promise.all(files.map(async (f, i) => ({ input: await sharp("site/img/" + f).resize(W, H).jpeg().toBuffer(), left: (i % cols) * W, top: Math.floor(i / cols) * H })));
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: "#222" } }).composite(tiles).jpeg({ quality: 82 }).toFile("assets-src/tiles.jpg");
console.log(files.join(" "));
