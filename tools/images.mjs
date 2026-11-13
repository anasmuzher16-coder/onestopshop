// Cuts product tiles (4:5, 720x900 webp) and wide editorial images out of assets-src into site/img.
// Sources and licences: docs/IMAGES.md.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const sharp = createRequire("C:/dev/hm-barbershop/package.json")("sharp");
mkdirSync("site/img", { recursive: true });
// name: [file, left, top, width, height]  (coordinates on the 1600px-wide source)
// Tall 2:3 tiles. [file, centreX, top, height] cuts a 2:3 box around one hookah; [file] = whole photo, centred.
const TILES = {
  "hk-copper":   ["p7518749", 310, 20, 1040],
  "hk-brass":    ["p7518749", 600, 90, 970],
  "hk-walnut":   ["p7518749", 905, 170, 895],
  "hk-ash":      ["p7518749", 1215, 170, 895],
  "hk-coral":    ["p7518765", 790, 275, 690],
  "hk-lathe":    ["p7518765", 915, 365, 590],
  "hk-onyx":     ["p7518765", 1090, 355, 590],
  "hk-marble":   ["p7518765", 375, 295, 690],
  "hk-smoke":    ["p7518765", 520, 320, 650],
  "hk-steel":    ["p18452312"], "hk-heritage": ["p20122617"], "hk-engraved": ["p20122596"], "hk-teal": ["p7567949"], "hk-sun": ["u-bar"],
  "base-engraved": ["p35754418"], "bowl-clay": ["p34547258"], "bowl-steel": ["p12568621"], "bowl-night": ["p35688051"],
  "bowl-basket": ["p28834322"], "bowl-stack": ["p9461907"],
  "fr-tortoise": ["p4226865"], "fr-red": ["p5202049"], "fr-clear": ["p29550559"], "fr-brown": ["p6011443"],
};
const WIDE = { "wide-bar": "p7518749", "wide-row": "p7518765", "wide-counter": "p7518748", "wide-window": "u-window", "wide-lamps": "u-lamps",
  "wide-ember": "p9461907", "wide-smoke": "p11230057", "wide-smoke2": "p4598191", "wide-steel": "p18452312" };
for (const [name, [f, cx, top, h]] of Object.entries(TILES)) {
  let img = sharp(`assets-src/${f}.jpg`);
  if (h) {
    const meta = await sharp(`assets-src/${f}.jpg`).metadata();
    const w = Math.round(h * 2 / 3), left = Math.max(0, Math.min(meta.width - w, Math.round(cx - w / 2)));
    img = img.extract({ left, top, width: w, height: Math.min(h, meta.height - top) });
  }
  await img.resize(640, 960, { fit: "cover", position: "centre" }).webp({ quality: 74 }).toFile(`site/img/${name}.webp`);
}
for (const [name, f] of Object.entries(WIDE)) {
  await sharp(`assets-src/${f}.jpg`).resize(1600, null, { withoutEnlargement: true }).webp({ quality: 70 }).toFile(`site/img/${name}.webp`);
  await sharp(`assets-src/${f}.jpg`).resize(800, null).webp({ quality: 68 }).toFile(`site/img/${name}-800.webp`);
}
console.log("tiles", Object.keys(TILES).length, "wide", Object.keys(WIDE).length);
