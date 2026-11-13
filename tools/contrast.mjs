// Computed WCAG ratios for every ink/ground pair in site/tokens.css (culori, sRGB luminance).
import { readFileSync } from "node:fs";
import { parse, wcagContrast } from "culori";
const css = readFileSync(new URL("../site/tokens.css", import.meta.url), "utf8");
const v = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(oklch\([^)]+\))/g)].map(m => [m[1], parse(m[2])]));
const pairs = [
  ["n-6","n-0",4.5,"body ink on page"],["n-6","n-1",4.5,"body ink on surface"],
  ["n-5","n-0",4.5,"secondary ink"],["n-4","n-0",4.5,"muted meta on page"],["n-4","n-1",4.5,"muted meta on surface"],
  ["red","n-0",4.5,"price on page"],["red","n-1",4.5,"price on surface"],["n-0","red",4.5,"text on action"],
  ["n-0","red-press",4.5,"text on pressed action"],["ok","n-0",4.5,"ok text"],["warn","n-0",4.5,"warn text"],
  ["n-4","n-0",3,"input boundary vs page"],["n-4","tag",3,"input boundary vs tag"],
];
let fail = 0;
for (const [fg,bg,min,label] of pairs){ const r = wcagContrast(v[fg], v[bg]); const ok = r >= min; if(!ok) fail++;
  console.log(`${ok?"PASS":"FAIL"} ${r.toFixed(2)}:1 (min ${min}) ${label} [${fg} on ${bg}]`); }
console.log(fail ? `FAIL ${fail} pair(s)` : "ALL PASS (computed)"); process.exit(fail?1:0);
