// Computed WCAG ratios (culori) for direction 3: light text on every jewel ground and its deep band; ink on niche and action.
import { readFileSync } from "node:fs";
import { parse, wcagContrast, interpolate } from "culori";
const css = readFileSync(new URL("../site/tokens.css", import.meta.url), "utf8");
const v = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(oklch\([^)]+\))/g)].map(m => [m[1], parse(m[2])]));
const deep = g => interpolate([g, "black"], "oklch")(0.18);
let fail = 0, n = 0;
const t = (fg, bg, min, label) => { const r = wcagContrast(fg, bg); n++; if (r < min) { fail++; console.log("FAIL " + r.toFixed(2) + ":1 (min " + min + ") " + label); } return r; };
let low = 99;
for (const g of ["emerald", "teal", "midnight", "oxblood", "forest", "aubergine", "umber"]) {
  for (const [name, bg] of [[g, v["g-" + g]], [g + " deep", deep(v["g-" + g])]]) {
    low = Math.min(low, t(v.bone, bg, 4.5, "text on " + name), t(v.mist, bg, 4.5, "muted on " + name), t(v.gilt, bg, 4.5, "gilt on " + name));
  }
}
t(v.ink, v.sand, 4.5, "ink on niche"); t(v.ink, v.bone, 4.5, "ink on action"); t(v.ink, v.gilt, 4.5, "ink on cart count");
console.log(fail ? "FAIL " + fail + "/" + n : "ALL PASS (computed, " + n + " pairs, lowest light-on-ground " + low.toFixed(2) + ":1)"); process.exit(fail ? 1 : 0);
