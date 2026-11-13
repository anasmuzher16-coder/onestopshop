// Processes assets-src/picked/*.img (retailer packshots, PLACEHOLDERS) into site/img/p/<id>.webp:
// white flattened, trimmed, padded to 4:5 so CSS multiply drops the white onto a colour tile.
import { createRequire } from "node:module"; import { readdirSync, mkdirSync } from "node:fs";
const sharp = createRequire("C:/dev/hm-barbershop/package.json")("sharp");
mkdirSync("site/img/p", { recursive: true });
const DARK = new Set(["hookah11", "hookah12", "hookah14", "hookah18"]);
let n = 0;
for (const f of readdirSync("assets-src/picked").filter(f => f.endsWith("-0.img"))) {
  const id = f.replace("-0.img", "");
  try {
    if (DARK.has(id)) { await sharp("assets-src/picked/" + f).resize(1200, null, { withoutEnlargement: true }).webp({ quality: 76 }).toFile(`site/img/p/${id}.webp`); n++; continue; }
    const flat = await sharp("assets-src/picked/" + f).flatten({ background: "#ffffff" }).trim({ background: "#ffffff", threshold: 12 }).toBuffer();
    for (const [w, h, suf] of [[720, 900, ""], [360, 450, "-s"]])
      await sharp(flat).resize(Math.round(w * 0.86), Math.round(h * 0.9), { fit: "inside", background: "#ffffff" })
        .extend({ top: 0, bottom: 0, left: 0, right: 0 }).toBuffer()
        .then(b => sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } }).composite([{ input: b, gravity: "centre" }]).webp({ quality: 78 }).toFile(`site/img/p/${id}${suf}.webp`));
    n++;
  } catch (e) { console.log("bad", id, e.message); }
}
console.log("products", n);
