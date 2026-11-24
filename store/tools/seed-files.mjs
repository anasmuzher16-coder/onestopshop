// The files a local test database is built from, in order, after the migrations. One list, so the suites can work out
// what the shelf should hold from the seed itself instead of a number typed into a test.
//   node store/tools/seed-files.mjs        prints the paths (one per line), for a reset script to run in order
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STORE = new URL("../", import.meta.url);
export const SEED_FILES = [
  "seed/seed.sql",                              // sections, boxes, sample products, charcoal in Heat (store/tools/seed.mjs)
  "catalog/out/seed-ace.sql",                   // Ace, Price TBD (store/tools/catalog/catalog.py seed)
  "catalog/out/seed-shisha.sql",                // shisha flavours
  "catalog/out/seed-charcoal-foil-foil.sql",    // foil only (catalog.py seed --supplier charcoal-foil --category foil)
  "catalog/live/on-view-2026-11-24.sql",        // the on-view switch: samples off, shisha and foil on
  "catalog/out/descriptions.sql",               // the writer's descriptions
];
export const seedPath = f => fileURLToPath(new URL(f, STORE));

// Every distinct product SKU the seed files insert (INSERT and INSERT OR IGNORE alike).
export function seededSkus() {
  const out = new Set();
  for (const f of SEED_FILES) {
    const p = seedPath(f);
    if (!existsSync(p)) throw new Error(`seed file missing: ${f} (generate it with store/tools/catalog/catalog.py)`);
    for (const m of readFileSync(p, "utf8").matchAll(/INTO products \([^)]*\) VALUES \('(OSS-\d+)'/g)) out.add(m[1]);
  }
  return out;
}
export const seededProductCount = () => seededSkus().size;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) for (const f of SEED_FILES) console.log(seedPath(f));
