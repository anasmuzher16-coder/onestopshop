// Close-up sheet of named cut-outs on dark coal and on a jewel, to judge fringes. node tools/edgesheet.mjs <out> <img ids...>
import { createRequire } from "node:module"; import { existsSync } from "node:fs";
const sharp = createRequire("C:/dev/hm-barbershop/package.json")("sharp");
const [out, ...ids] = process.argv.slice(2);
const W = 432, H = 540, tiles = [];
for (const [i, id] of ids.entries()) {
  const f = existsSync(`site/img/pc/${id}-l.webp`) ? `site/img/pc/${id}-l.webp` : `site/img/pc/${id}.webp`;
  const b = await sharp(f).resize(W, H).toBuffer();
  tiles.push({ input: b, left: i * W, top: 0 }, { input: b, left: i * W, top: H });
}
const bg = await sharp({ create: { width: W * ids.length, height: H * 2, channels: 3, background: "#14110f" } })
  .composite([{ input: await sharp({ create: { width: W * ids.length, height: H, channels: 3, background: "#0f5a5e" } }).png().toBuffer(), left: 0, top: H }]).png().toBuffer();
await sharp(bg).composite(tiles).jpeg({ quality: 90 }).toFile(out);
console.log(out, ids.join(" "));
