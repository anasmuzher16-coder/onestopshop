// The files a local test database is built from, in order, after the migrations. One list, so the suites can work out
// what the shelf should hold from the seed itself instead of a number typed into a test.
//   node store/tools/seed-files.mjs        prints the paths (one per line), for a reset script to run in order
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STORE = new URL("../", import.meta.url);
export const SEED_FILES = [
  "seed/seed.sql",                              // sections, boxes, sample products, charcoal in Heat (store/tools/seed.mjs)
  "catalog/out/seed-ace.sql",                   // Ace, Price TBD (store/tools/catalog/catalog.py seed)
  "catalog/out/seed-ace-acc.sql",               // Ace accessories the shop ticked, Price TBD (catalog.py seed --supplier ace-acc)
  "catalog/out/seed-shisha.sql",                // shisha flavours
  "catalog/out/seed-charcoal-foil-foil.sql",    // foil only (catalog.py seed --supplier charcoal-foil --category foil)
  "catalog/out/seed-charcoal-foil-charcoal.sql", // charcoal's catalogue facts (shape, material, brand) onto the rows already in seed.sql;
                                                 // also the 3 unpriced Titanium rolls, kept off (catalog.py seed ... --category charcoal)
  "catalog/live/on-view-2026-11-24.sql",        // the on-view switch: samples off, shisha and foil on
  "catalog/out/descriptions.sql",               // the writer's descriptions
  "catalog/live/charcoal-section-2026-11-24.sql", // Charcoal its own section; Heat keeps foil and gets its old pieces back
  "catalog/live/samples-off-2026-11-24.sql",    // every made-up sample off (kept, never deleted); empty sections say "stock arriving soon"
  "catalog/live/unticked-off-2026-11-26.sql",   // only ticked catalogue pages on view: a tick means in the shop, nothing is ordered in
  "catalog/live/menu-order-2026-11-26.sql",     // the menu order: hookahs, shisha, charcoal, heat, then the parts
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
