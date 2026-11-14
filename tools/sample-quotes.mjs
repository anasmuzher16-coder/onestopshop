// Prints a few all-in sample quotes for the handout. node tools/sample-quotes.mjs
const { PRODUCTS } = await import("../site/catalog.js");
const R = await import("../site/rates.js");
const by = s => PRODUCTS.find(p => p.sku === s);
for (const [label, cart] of [["one tall hookah (OSS-1001)", [{ sku: "OSS-1001", qty: 1 }]], ["one hose (OSS-5006)", [{ sku: "OSS-5006", qty: 1 }]]])
  for (const pc of ["M5V 2T6", "H2X 1Y4", "B3H 1W5", "V6B 1A1"]) {
    const dest = R.parsePostal(pc), parcels = R.pack(cart.map(l => ({ ...l, p: by(l.sku), product: by(l.sku) })));
    let q; try { q = R.quote(dest, parcels, R.FUEL.pct); } catch (e) { q = "ERR " + e.message; }
    console.log(label, pc, JSON.stringify(q).slice(0, 400));
  }
