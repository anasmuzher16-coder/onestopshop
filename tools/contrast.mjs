// Computed WCAG ratios (culori, sRGB luminance) for every text/ground pair used in site/styles.css.
import { readFileSync } from "node:fs";
import { parse, wcagContrast } from "culori";
const css = readFileSync(new URL("../site/tokens.css", import.meta.url), "utf8");
const v = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(oklch\([^)]+\))/g)].map(m => [m[1], parse(m[2])]));
const pairs = [
  ["bone", "coal-0", 4.5, "text on page"], ["bone", "coal-1", 4.5, "text on raised"], ["white", "coal-0", 4.5, "strong on page"],
  ["ash", "coal-0", 4.5, "muted on page"], ["ash", "coal-1", 4.5, "muted on raised"],
  ["white", "ember", 4.5, "price on sticker / label on action"], ["white", "ember-press", 4.5, "label on pressed action"],
  ["ember", "coal-0", 3, "ember large display on page"], ["coal-3", "coal-0", 3, "control boundary on page"], ["coal-3", "coal-1", 3, "control boundary on raised"],
  ...["ruby", "teal", "cobalt", "emberlt", "emerald", "gilt", "bonelt"].map(t => ["ink", t, 4.5, "ink on " + t + " tile"]),
];
let fail = 0;
for (const [fg, bg, min, label] of pairs) { const r = wcagContrast(v[fg], v[bg]); const ok = r >= min; if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${r.toFixed(2)}:1 (min ${min}) ${label}`); }
console.log(fail ? `FAIL ${fail} pair(s)` : `ALL PASS (computed, ${pairs.length} pairs)`); process.exit(fail ? 1 : 0);
