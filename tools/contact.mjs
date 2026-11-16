// Contact sheet of assets-src for review. node tools/contact.mjs <out.jpg> <files...>
import { createRequire } from "node:module";
const require = createRequire("C:/dev/dijji-crm/package.json");
const sharp = require("sharp");
const [out, ...files] = process.argv.slice(2);
const W = 360, H = 270, cols = 5, rows = Math.ceil(files.length / cols);
const tiles = await Promise.all(files.map(async (f, i) => ({
  input: await sharp(f).resize(W, H, { fit: "cover" }).composite([{ input: Buffer.from(`<svg width="${W}" height="24"><rect width="100%" height="100%" fill="#000"/><text x="6" y="17" font-family="monospace" font-size="14" fill="#fff">${f.replace(/.*[\/]/, "")}</text></svg>`), gravity: "south" }]).jpeg().toBuffer(),
  left: (i % cols) * W, top: Math.floor(i / cols) * H })));
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: "#222" } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
console.log(out, files.length);
