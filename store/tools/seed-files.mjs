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
  "catalog/out/seed-shop-hoses.sql",            // the shop's own hoses, Price TBD (catalog.py seed --supplier shop-hoses, or plain seed)
  "catalog/live/hoses-2026-11-27.sql",          // the same hoses as the live database gets them (after seed-shop-hoses.sql, so the hose rows go in twice: proves it is safe)
  "catalog/out/seed-shop-bowls.sql",            // the shop's own bowls, Price TBD (catalog.py seed --supplier shop-bowls, or plain seed)
  "catalog/live/shop-photos-2026-11-27.sql",    // hoses' Starbuzz length + the shop's bowls, as the live database gets them (run twice)
  "catalog/live/hookah-glass-2026-11-27.sql",   // the Tsar Molotov's shop photos (glass cleared), as the live database gets them (run twice)
  "catalog/out/seed-shop-hookahs.sql",          // the shop's own hookahs, Price TBD, original photos (catalog.py seed --supplier shop-hookahs)
  "catalog/live/shop-hookahs-2026-11-27.sql",   // the same hookahs + every hose's "Photo to be replaced" tag, as the live database gets them (run twice)
  "catalog/live/missing-items-2026-11-27.sql", // the shop's bowls with no brand (37) + the Starbuzz light blue hose, as the live database gets them (run twice; after shop-hookahs, the order the live database got them)
  "catalog/live/hookah-clean-2026-11-27.sql",   // the first cleaned hookah photos: "Photo to be replaced" off (guarded on img, safe twice)
  "catalog/live/hookah-clean-a-2026-11-28.sql", // group A's cleaned hookah photos, the same way (after hookah-clean)
  "catalog/live/hookah-clean-b-2026-11-28.sql", // group B's cleaned hookah photos (after hookah-clean-a), and the Ace Panda's photo (guarded on its empty img)
  "catalog/live/hookah-clean-a3-2026-11-28.sql", // group A's held photos, reworked and cleaned, the same way (after hookah-clean-b)
  "catalog/live/hookah-clean-a2-2026-11-28.sql", // group A's second pass, the same way (after hookah-clean-a3)
  "catalog/out/seed-shisha.sql",                // shisha flavours
  "catalog/out/seed-charcoal-foil-foil.sql",    // foil only (catalog.py seed --supplier charcoal-foil --category foil)
  "catalog/out/seed-charcoal-foil-charcoal.sql", // charcoal's catalogue facts (shape, material, brand) onto the rows already in seed.sql;
                                                 // also the 3 unpriced Titanium rolls, kept off (catalog.py seed ... --category charcoal)
  "catalog/out/seed-shop-charcoal.sql",          // charcoal the shop carries but has not priced (after the charcoal list, which makes the Charcoal section)
  "catalog/live/missing-items-2-2026-11-27.sql", // the Duracubes 72-cube box, as the live database gets it (run twice)
  "catalog/live/on-view-2026-11-24.sql",        // the on-view switch: samples off, shisha and foil on
  "catalog/out/descriptions.sql",               // the writer's descriptions
  "catalog/live/charcoal-section-2026-11-24.sql", // Charcoal its own section; Heat keeps foil and gets its old pieces back
  "catalog/live/samples-off-2026-11-24.sql",    // every made-up sample off (kept, never deleted); empty sections say "stock arriving soon"
  "catalog/live/unticked-off-2026-11-26.sql",   // only ticked catalogue pages on view: a tick means in the shop, nothing is ordered in
  "catalog/live/menu-order-2026-11-26.sql",     // the menu order: hookahs, shisha, charcoal, heat, then the parts
  "catalog/live/shisha-flag-2026-11-26.sql",    // every shisha row carries its pay-at-the-counter rule itself, whatever its section
  "catalog/live/shisha-tone-2026-11-26.sql",    // Shisha's own jewel, chartreuse, in place of Hoses' emerald
  "catalog/live/upscaled-photos-2026-11-27.sql", // the upscaled photo: its label off, its 1440 photo on
  "catalog/live/reverse-search-facts-2026-11-27.sql", // makers' names for 4 stand-ins, facts from the exact reverse-search rows (no-op over this seed: proves it is safe twice)
  "catalog/live/web-photos-2026-11-27.sql",     // sharper web photos of the same products: their source kept, labels off where now crisp
  "catalog/live/upscaled-photos-2-2026-11-27.sql", // one foil photo upscaled (1440 -l on, 'upscale' -> 'approved'); guarded on img, safe twice
  "catalog/live/web-sweep-2026-11-27.sql",      // sharper web photos of 6 charcoal packs and the Ace Ice Hose: source kept (private), labels off; guarded on img, safe twice
  "catalog/live/hose-drawnbag-2026-11-27.sql",   // hoses on the drawn clear bag: photo 'approved', the "Photo to be replaced" tag off (after shop-hookahs); safe twice
  "catalog/live/drive2-2026-11-28.sql",          // the Drive folder's new items: 75 hookah colours + the green Simba hose, new rows only; last, as live: the earlier hookah and hose files' sweeps drop these rows and this file's guard lines bring them back
  "catalog/live/hookah-clean-crew3-2026-11-28.sql", // crew 3's cleaned hookah photos from the standing batch, the same way (after drive2: its rows come from that file)
  "catalog/live/img-more-2026-11-28.sql",        // more photos of one item: the extra angles (products.img_more, migration 0013), guarded on img
  "catalog/live/img-more-2026-11-28.sql",        // run twice: proves it is safe twice
  "catalog/live/hookah-clean-crew1-2026-11-28.sql", // crew 1's cleaned Drive-batch hookah photos: "Photo to be replaced" off (after drive2, which resets those rows' facts; guarded on img, safe twice)
  "catalog/live/hookah-clean-c2-2026-11-28.sql", // crew 2's cleaned photos from the second batch, the same way (after drive2 and crew 1, which reset or touch those rows)
  "catalog/live/hookah-clean-c5-2026-11-28.sql", // crew 5's cleaned Drive-batch hookah photos, the same way (after drive2, which resets those rows' facts)
  "catalog/live/hookah-clean-c6-2026-11-28.sql", // crew 6's cleaned Drive-batch photos, the same way (after drive2, which resets those rows' facts)
  "catalog/live/hookah-clean-c7-2026-11-28.sql", // crew 7's cleaned Drive-batch hookah photos, the same way (after drive2, which resets those rows' facts)
  "catalog/live/hookah-clean-c8-2026-11-28.sql", // crew 8's cleaned Drive-batch photos, the same way (after drive2, crew 6 and crew 7)
  "catalog/live/hookah-clean-c9-2026-11-28.sql", // crew 9's cleaned Drive-batch hookah photos, the same way (after drive2, which resets those rows' facts)
  "tools/fixtures/pack-mains-live-2026-11-28.sql", // test seed only: the seven packs' live main photos, so batch 2's guards apply here as live
  "catalog/live/img-more-2-2026-11-28.sql",      // batch 2: the shop's own photos of seven packs (guarded on img)
  "catalog/live/img-more-2-2026-11-28.sql",      // run twice: proves it is safe twice
  "catalog/live/pack-photos-2026-11-28.sql",     // the shop's own photos as main photos: the seven packs' stand-ins off (img_more emptied), six charcoal boxes photographed (guarded on img)
  "catalog/live/pack-photos-2026-11-28.sql",     // run twice: proves it is safe twice
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
