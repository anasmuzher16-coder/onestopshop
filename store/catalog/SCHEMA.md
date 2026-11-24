# Catalogue master files (schema oss-catalog/1)

One master file per supplier is the only place product data is written by hand or by a tool:
`store/catalog/suppliers/<supplier>/master.json`. The shop's spreadsheet and the site database are both
generated from it. Nobody edits two copies. Plan: life/dijji/clients/one-stop-shop/PLAN-2026-11-24-real-inventory.md.

| File | What it is |
|---|---|
| `suppliers/ace/master.json` | Ace Hookah, from the October 2026 PDF (sha256 in `sources`) |
| `suppliers/charcoal-foil/master.json` | The shop's own charcoal and foil list, verified 2026-11-23, plus the owner's rulings |
| `suppliers/shisha/master.json` | STUB until `inventory-2026-11-23/shisha/catalogue.json` exists |
| `suppliers/ace/photos.json` | Photo manifest: one entry per extracted image (page, xref, crop, sku, colour, scale, status) |
| `suppliers/ace/photo-overrides.json` | Decisions a person made on the contact sheets (gallery only, hand crop) |
| `registry.json` | Every SKU ever issued. Numbers are never changed or reused |
| `answers/` | Copies of every filled spreadsheet that was read back |
| `out/` | Generated: the spreadsheet, seed SQL (git-ignored, rebuild any time) |

## Provenance: every field is a cell

```json
"supplier_price_cents": {"v": 5000, "src": "pdf:ace-2026-10#p26:text '$50'"}
```

`v` is the value, `src` says where it came from. A cell with a value and no source fails validation.
Source prefixes: `pdf:<source>#p<page>` (catalogue page), `list:<source>#lines <n>` (the shop's list),
`photo:<file>` (measured from the photo), `rule:` (a written default, confirm), `intake:` (verification files),
`shop:` (the shop's own word: answers sheet, a ruling through Jamal, its own price list). `null` with a null
source means unknown, said out loud.

## Who owns what

| Owner | Fields | Written by |
|---|---|---|
| Supplier | name as printed (`supplier_ref`), supplier price, page, stamp, colour squares, photos, facts | `catalog.py build`, every run |
| Shop | its own price, display name, stock, on/off, confirmed colour name, in stock here, note | `catalog.py answers` (the Answers sheet) only |

A rebuild carries every shop cell (source starting `shop:`) across by SKU, so a new catalogue can only add,
change supplier facts, or retire. It never touches the shop's price or stock.

Rulings built in:
- Ace: the shop has its own prices. Ace's price is stored as `supplier_price_cents` only. The shelf price
  (`shop.price_cents`) starts empty and must have a `shop:` source. Every Ace item is off until the shop's price is set.
- Colour names come from the photos (`photo:` source, "human-confirm"), never from the colour squares. The squares
  only set the chip colour (`swatch_hex`).
- Charcoal: pickup or local delivery only, never shipped. Foil can ship; pack weight unknown. Stock starts at 10.
  Only the single rolls on the list are real rolls. Duplicates OSS-9137 and OSS-9159 are retired.

## Shape

```
{ schema, supplier {id, name, sku_block, credit}, sources [{id, kind, file, sha256, ...}], rulings [],
  families [ {
    family_id, page?, category?, supplier_ref, supplier_price_cents, price_basis, group?,
    stamp? {v: stamped|unclear|none, src, needs_shop, question, annotations[]},
    facts {includes_base, includes, height_cm, acrylic, weight_g, brand, count, size, fulfilment, ...},
    flags [plain sentences; "NEEDS SHOP: ..." become spreadsheet questions],
    variants [ { sku, key, swatch_hex?, colour?, label?, photo {img, status, src},
                 shop {price_cents, display_name, stock, active, colour_confirmed, in_stock_here, note} } ] } ],
  retired { sku: {...} }, shop_answers [ {file, sha256, read, fields_changed} ] }
```

Ace stamp status: `stamped`; `unclear` for page 16 (stamp has no position, invisible) and page 33 (a stroke, not a
tick); pages 26, 36 and 57 are `stamped` with `needs_shop` because a small second tick may limit it to one colour.
Ace group (Full size, Stem set, Compact and travel, Statement piece) is a written rule (`rule v1`), to confirm.

Photo status: `ready`; `CHECK` (enlarged past 1.25x: ask Ace for the original); `hand_crop` (products touch, needs a
drawn crop); `family_hero_only` (no photo of this colour, the family's main photo stands in); `none`;
`needs_store_photo` (charcoal and foil).

## SKUs: OSS-SSNNNN

`SS` is the supplier block (10 Ace, 20 charcoal and foil, 30 shisha), `NNNN` a sequence. `registry.json` maps each
SKU to `(supplier, key)`: the key is what makes an item the same item next month (Ace: family id plus colour square,
for example `ace-tsar-molotov#5271ff`). Rules, enforced by `validate_registry` and the tests:
- an item keeps its number forever, including when it leaves and comes back;
- a retired number stays in the registry and is never issued again (block counters only go up);
- the charcoal intake's earlier 4-digit numbers (OSS-9101, OSS-9501, ...) are kept as they are (`legacy`), because
  the site already uses them;
- the back office makes its own 4-digit numbers only (`admin.js` ignores 6-digit SKUs when counting).

## Database (migration 0005_catalog.sql)

New product columns: `family`, `variant_label`, `swatch_hex`, `supplier_id`, `supplier_ref`, `supplier_price_cents`
(private, never the shelf price), `availability` (counted, in_store_uncounted, special_order, dropped), `facts_known`
(JSON; null = unknown). New tables: `suppliers`, `catalog_imports` (one row per changing import, unique by master
hash). Triggers refuse to switch on a catalogue item whose shelf price is 0.

Supplier columns (`supplier_id, supplier_ref, supplier_price_cents, family, variant_label, swatch_hex, img, height_cm,
facts_known`) are refreshed by every import. Shop columns (`name, price_cents, stock, active, note, weight_g, box_id,
ship_class, category_id, sort, availability`) are written once, when the row is created, and never again. The only
exception: an item gone from the catalogue gets `availability = 'dropped'` (never deleted, never switched off).

## Commands (from the repo root)

```
python store/tools/catalog/catalog.py build                 # sources -> master files (+ registry)
python store/tools/catalog/photos.py --publish              # Ace photos -> store/public/img/pc/ace + manifest + sheets
python store/tools/catalog/catalog.py build                 # again, to pull photos and colour names in
python store/tools/catalog/catalog.py xlsx                  # out/OneStopShop-Catalogue.xlsx for the shop
python store/tools/catalog/catalog.py answers FILLED.xlsx   # the shop's Answers sheet -> shop cells (all or nothing)
python store/tools/catalog/catalog.py plan --db FILE.sqlite # added, changed, retired, price-review list
python store/tools/catalog/catalog.py apply --local --db FILE.sqlite [--shop-fill]
python store/tools/catalog/catalog.py seed                  # out/seed-<supplier>.sql for wrangler d1 execute
python store/tools/catalog/test_catalog.py                  # tests
```

How the shop's prices reach the site: the shop fills the Answers sheet; `answers` writes its prices into the master
with a `shop:answers <file> sha256:...` source; `plan` lists them on the price-review list; `apply --local --shop-fill`
(or the seed SQL path, then the back office) puts a price only into rows that have never had one, and turns an item on
only when the shop said "turn on". A price the shop has set in the back office is never overwritten.
