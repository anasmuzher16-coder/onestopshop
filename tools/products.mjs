// Processes assets-src/hi/*.img (retailer packshots, PLACEHOLDERS, fetched at up to 2400px) into site/img/p:
//   <id>-s.webp 360x450, <id>.webp 720x900, <id>-l.webp 1440x1800 (only when the source has the pixels).
// White is flattened and trimmed, then the piece is centred on a 4:5 white canvas so CSS multiply drops the
// white onto a colour tile. Never upscales: a soft source stays at its real size. Writes site/img/pc/sizes.json.
import { createRequire } from "node:module"; import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
const sharp = createRequire("C:/dev/hm-barbershop/package.json")("sharp");
sharp.concurrency(2); // keep the laptop responsive
mkdirSync("site/img/pc", { recursive: true });
const DARK = new Set(["hookah11", "hookah12", "hookah14", "hookah18"]);
// Background removal: flood-fill from the image border through near-white pixels and make that region
// transparent. White that is enclosed by the object (glass, chrome highlights) is kept. The alpha edge is
// softened by one pixel, and edge pixels are un-mixed from white so no pale fringe is left on dark grounds.
async function cutout(buf, thr = 240) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, N = w * h, bg = new Uint8Array(N), stack = [];
  const white = i => data[i * 4] >= thr && data[i * 4 + 1] >= thr && data[i * 4 + 2] >= thr;
  const push = i => { if (!bg[i] && white(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) { const i = stack.pop(), x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < N - w) push(i + w); }
  // Enclosed paper white (inside a hose loop, between a stem and its hose): the flood from the border cannot
  // reach it. Any connected patch of pure white (>= 248) bigger than a highlight is background too.
  const seen = new Uint8Array(N), pure = i => !bg[i] && data[i * 4] >= 248 && data[i * 4 + 1] >= 248 && data[i * 4 + 2] >= 248, minArea = Math.max(250, N * 0.0005);
  for (let s = 0; s < N; s++) {
    if (seen[s] || !pure(s)) continue;
    const comp = [s]; seen[s] = 1;
    for (let k = 0; k < comp.length; k++) { const i = comp[k], x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < N - w ? i + w : -1]) if (j >= 0 && !seen[j] && pure(j)) { seen[j] = 1; comp.push(j); } }
    if (comp.length >= minArea) for (const i of comp) bg[i] = 1;
  }
  for (let i = 0; i < N; i++) {
    if (bg[i]) { data[i * 4 + 3] = 0; continue; }
    const x = i % w, edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < N - w && bg[i + w]);
    if (!edge) continue;
    const m = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]), a = Math.max(0.15, 1 - m / 255); // how far from white
    if (a >= 0.98) continue;
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.max(0, Math.min(255, Math.round((data[i * 4 + c] - 255 * (1 - a)) / a)));
    data[i * 4 + 3] = Math.round(a * 255);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}
const sizes = {}; let n = 0;
for (const f of readdirSync("assets-src/hi").filter(f => f.endsWith(".img"))) {
  const id = f.replace(".img", "");
  try {
    if (DARK.has(id)) {
      const m = await sharp("assets-src/hi/" + f).metadata();
      for (const [w, suf] of [[800, ""], [1600, "-l"]]) await sharp("assets-src/hi/" + f).resize(Math.min(w, m.width), null, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(`site/img/pc/${id}${suf}.webp`);
      sizes[id] = { srcW: m.width, srcH: m.height, dark: true, maxW: m.width, lw: m.width >= 1000 ? Math.min(1600, m.width) : 0 }; n++; continue;
    }
    const trimmed = await sharp("assets-src/hi/" + f).flatten({ background: "#ffffff" }).trim({ background: "#ffffff", threshold: 12 }).toBuffer();
    const flat = await cutout(trimmed); // real transparency: no white box can ever show, whatever the CSS does
    const m = await sharp(flat).metadata();
    // A photo shot on a grey or coloured studio ground cannot be cut out this way: its frame stays opaque.
    const raw = await sharp(flat).raw().toBuffer(); let edge = 0, solid = 0;
    for (let x = 0; x < m.width; x++) for (const y of [0, m.height - 1]) { edge++; if (raw[(y * m.width + x) * 4 + 3] > 200) solid++; }
    for (let y = 0; y < m.height; y++) for (const x of [0, m.width - 1]) { edge++; if (raw[(y * m.width + x) * 4 + 3] > 200) solid++; }
    const boxed = solid / edge > 0.5;
    const need = (W, H) => Math.min((W * 0.86) / m.width, (H * 0.9) / m.height); // scale factor to fit the canvas
    const maxW = Math.floor(Math.max(m.width / 0.86, (m.height / 0.9) * 0.8));       // widest canvas with no upscaling
    const lw = maxW >= 900 ? Math.min(1440, maxW) : 0;
    const out = { srcW: m.width, srcH: m.height, maxW, lw, boxed };
    for (const [W, suf, q] of [[360, "-s", 78], [540, "-m", 76], [720, "", 76], [lw, "-l", 74]]) {
      if (!W) continue;
      const H = Math.round(W * 1.25);
      const b = await sharp(flat).resize(Math.round(W * 0.86), Math.round(H * 0.9), { fit: "inside", kernel: "lanczos3" }).toBuffer();
      await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } }).composite([{ input: b, gravity: "centre" }]).webp({ quality: q, alphaQuality: 82, effort: 5, smartSubsample: true }).toFile(`site/img/pc/${id}${suf}.webp`);
    }
    out.soft = maxW < 625; // source cannot fill even the 720 tile
    sizes[id] = out; n++;
  } catch (e) { console.log("bad", id, e.message); }
}
writeFileSync("site/img/pc/sizes.json", JSON.stringify(sizes));
const v = Object.values(sizes);
console.log("products", n, "| with large version", v.filter(x => x.lw).length, "| boxed (no clean cut-out):", Object.entries(sizes).filter(([, x]) => x.boxed).map(([k]) => k).join(" ") || "none", "| soft sources:", Object.entries(sizes).filter(([, x]) => x.soft).map(([k]) => k).join(" ") || "none");
