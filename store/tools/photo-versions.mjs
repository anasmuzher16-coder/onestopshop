// Per-photo versions: a short hash of each product photo's files, so changing one photo changes only its own address
// (img/pc/<photo>.webp?v=<version>) and every other photo stays cached on phones. docs/SEO.md section 5.
//   node store/tools/photo-versions.mjs     rewrites store/src/img-versions.json; run after any photo change.
// tools/test-seo.mjs fails when a photo on disk no longer matches its recorded version, so a forgotten run is caught.
// It draws nothing: share images stay as they are (the share-card generator is parked, docs/SEO.md section 4).
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const PC = fileURLToPath(new URL("../public/img/pc/", import.meta.url)), OUT = fileURLToPath(new URL("../src/img-versions.json", import.meta.url));
export function stems() {
  const out = []; const walk = d => { for (const e of readdirSync(PC + d, { withFileTypes: true })) { if (e.isDirectory()) walk(d + e.name + "/"); else if (/\.webp$/.test(e.name) && !/-[sml]\.webp$/.test(e.name)) out.push(d + e.name.slice(0, -5)); } };
  walk(""); return out.sort();
}
export function version(stem) {
  const h = createHash("sha256");
  for (const suf of ["", "-s", "-m", "-l"]) { const f = PC + stem + suf + ".webp"; if (existsSync(f)) { h.update(suf); h.update(readFileSync(f)); } }
  return h.digest("hex").slice(0, 8);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const v = Object.fromEntries(stems().map(s => [s, version(s)]));
  writeFileSync(OUT, JSON.stringify(v, null, 0).replace(/^\{/, "{\n").replace(/,"/g, ',\n"').replace(/\}$/, "\n}\n"));
  console.log(`${Object.keys(v).length} photo versions written to store/src/img-versions.json`);
}
