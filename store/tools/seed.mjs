// Writes seed/seed.sql from the mockup's sample catalogue (site/catalog.js). Sample data only: the shop's real
// products replace it through the admin. node store/tools/seed.mjs
import { writeFileSync } from "node:fs";
import { BOXES, CATEGORIES, PRODUCTS } from "../../site/catalog.js";
const q = v => v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const out = ["DELETE FROM product_photos; DELETE FROM audit_log; DELETE FROM stock_moves; DELETE FROM order_items; DELETE FROM orders; DELETE FROM products; DELETE FROM boxes; DELETE FROM categories;"];
CATEGORIES.forEach((c, i) => out.push(`INSERT INTO categories (id,name,tone,sort) VALUES (${q(c.id)},${q(c.name)},${q(c.tone)},${i});`));
for (const [id, b] of Object.entries(BOXES)) out.push(`INSERT INTO boxes (id,label,l_cm,w_cm,h_cm,tare_g) VALUES (${q(id)},${q(b.label)},${b.l},${b.w},${b.h},${Math.round(b.tare * 1000)});`);
PRODUCTS.forEach((p, i) => {
  out.push(`INSERT INTO products (sku,name,category_id,price_cents,weight_g,box_id,glass,height_cm,note,img,img_dark,img_lw,stock,sort) VALUES (${[p.sku, p.name, p.cat, Math.round(p.price * 100), Math.round(p.kg * 1000), p.box, p.glass ? 1 : 0, p.height ?? null, p.note, p.img, p.dark ? 1 : 0, p.lw ?? null, 5, i].map(q).join(",")});`);
  out.push(`INSERT INTO stock_moves (sku,delta,reason,actor) VALUES (${q(p.sku)},5,'count','seed');`);
});

// Two new sections. Names are made up; photos are placeholders. Cologne travels by ground only.
out.push(`INSERT INTO categories (id,name,tone,sort) VALUES ('cologne','Cologne','amethyst',6),('misc','Misc','bone',7);`);
const COLOGNE = [
  ["OSS-7001", "Qasr Ivory", 8900, "cologne00", 100, "Eau de parfum", "White musk, cedar, soft amber"],
  ["OSS-7002", "Ruby Majlis", 7900, "cologne01", 100, "Eau de parfum", "Saffron, rose, oud"],
  ["OSS-7003", "Ember Night", 9500, "cologne02", 105, "Eau de parfum", "Blood orange, leather, vanilla"],
  ["OSS-7004", "Gold Souk", 2900, "cologne03", 240, "All over spray", "Honey, sandalwood, warm spice"],
  ["OSS-7005", "Amber Hour", 2900, "cologne04", 240, "All over spray", "Amber, citrus peel, white tea"],
  ["OSS-7006", "Midnight Coal", 2900, "cologne05", 240, "All over spray", "Black pepper, vetiver, dark woods"],
  ["OSS-7007", "Rosewater Lattice", 6900, "cologne06", 100, "Eau de parfum", "Rosewater, pistachio, musk"],
  ["OSS-7008", "Canyon Road", 6500, "cologne07", 55, "Eau de parfum", "Sage, dry woods, amber"],
  ["OSS-7009", "Glacier Mint", 6500, "cologne08", 55, "Eau de parfum", "Mint, sea salt, white woods"],
];
const MISC = [
  ["OSS-8001", "Glow ring LED base", 5999, "misc00", 600, "S", "Lights a glass base from underneath, 16 colours"],
  ["OSS-8002", "Tripod stand", 5499, "misc01", 900, "M", "Steel tripod that holds a hookah steady outdoors"],
  ["OSS-8003", "Gold tongs", 2499, "misc04", 150, "XS", "Brushed gold tongs with a carry sleeve"],
  ["OSS-8004", "Hose holder, bicycle", 499, "misc05", 40, "XS", "Clips to the stem and keeps the hose off the floor"],
];
const extra = [];
COLOGNE.forEach(([sku, name, cents, img, ml, kind, notes], i) => extra.push({ sku, name, cat: "cologne", cents, g: 250 + ml * 2, box: "XS", ship: "ground_only", note: `${kind}, ${ml} mL`, img, details: { ml, kind, notes }, stock: [6, 4, 3, 12, 9, 1, 5, 0, 7][i], sort: 200 + i }));
MISC.forEach(([sku, name, cents, img, g, box, note], i) => extra.push({ sku, name, cat: "misc", cents, g, box, ship: "standard", note, img, details: {}, stock: [4, 2, 8, 20][i], sort: 300 + i }));
for (const e of extra) {
  out.push(`INSERT INTO products (sku,name,category_id,price_cents,weight_g,box_id,glass,ship_class,note,img,img_dark,img_lw,details,stock,low_stock_at,sort) VALUES (${[e.sku, e.name, e.cat, e.cents, e.g, e.box, 0, e.ship, e.note, e.img, 0, null, JSON.stringify(e.details), e.stock, 2, e.sort].map(q).join(",")});`);
  if (e.stock) out.push(`INSERT INTO stock_moves (sku,delta,reason,actor) VALUES (${q(e.sku)},${e.stock},'count','seed');`);
}
// Give the sample catalogue believable stock and cost, so the admin has something to show.
let seed = 20261114; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const all = [...PRODUCTS.map(p => ({ sku: p.sku, name: p.name, cents: Math.round(p.price * 100) })), ...extra.map(e => ({ sku: e.sku, name: e.name, cents: e.cents }))];
for (const p of PRODUCTS) {
  const st = p.dark ? 1 : p.cat === "hookahs" ? Math.floor(rnd() * 5) : Math.floor(rnd() * 14);
  out.push(`UPDATE products SET stock=${st}, low_stock_at=${p.cat === "hookahs" ? 1 : 3}, cost_cents=${Math.round(p.price * 100 * (0.45 + rnd() * 0.15))} WHERE sku=${q(p.sku)};`);
  out.push(`UPDATE stock_moves SET delta=${st} WHERE sku=${q(p.sku)} AND actor='seed';`);
}
for (const e of extra) out.push(`UPDATE products SET cost_cents=${Math.round(e.cents * 0.5)} WHERE sku=${q(e.sku)};`);
// Sample orders across the last 35 days, so the home screen has numbers. Every one is marked as a sample.
const PROV = [["ON", 0.13, 0.52], ["QC", 0.05, 0.14], ["BC", 0.05, 0.1], ["AB", 0.05, 0.1], ["NS", 0.14, 0.05], ["MB", 0.05, 0.04], ["SK", 0.05, 0.03], ["NB", 0.15, 0.02]];
const NAMES = ["Sample Customer A", "Sample Customer B", "Sample Customer C", "Sample Customer D", "Sample Customer E", "Sample Customer F"];
const DAY = 86400000, NOW = Date.now();
let k = 0;
for (let d = 34; d >= 0; d--) {
  const dow = new Date(NOW - d * DAY).getUTCDay(), count = Math.floor(rnd() * 3) + (dow === 5 || dow === 6 ? 2 : 0) + (d < 10 ? 1 : 0);
  for (let j = 0; j < count; j++) {
    const id = "S" + String(1001 + k++), at = new Date(NOW - d * DAY - Math.floor(rnd() * 8 * 3600000)).toISOString().replace(/\.\d+Z$/, "Z");
    let r = rnd(), prov = PROV[0]; for (const pr of PROV) { if (r < pr[2]) { prov = pr; break; } r -= pr[2]; }
    const pickup = prov[0] === "ON" && rnd() < 0.3, items = new Map();
    const lines = 1 + Math.floor(rnd() * 3);
    for (let l = 0; l < lines; l++) { const p = all[Math.floor(rnd() * all.length) % all.length]; items.set(p.sku, { p, qty: (items.get(p.sku)?.qty || 0) + (p.cents < 3000 && rnd() < 0.4 ? 2 : 1) }); }
    const sub = [...items.values()].reduce((a, x) => a + x.p.cents * x.qty, 0), ship = pickup ? 0 : 1400 + Math.floor(rnd() * 5200), tax = Math.round((sub + ship) * prov[1]);
    const status = d === 0 ? "paid" : d === 1 ? (pickup ? "ready" : "packed") : rnd() < 0.04 ? "refunded" : pickup ? "collected" : "shipped";
    out.push(`INSERT INTO orders (id,status,method,email,name,address,subtotal_cents,shipping_cents,tax_cents,total_cents,tax_province,ship_service,tracking,label_cents,created_at,updated_at) VALUES (${[id, status, pickup ? "pickup" : "ship", "sample@example.com", NAMES[k % NAMES.length], JSON.stringify({ province: prov[0], sample: true }), sub, ship, tax, sub + ship + tax, prov[0], pickup ? null : (rnd() < 0.7 ? "Expedited Parcel" : "Regular Parcel"), status === "shipped" ? "SAMPLE" + (700000 + k) : null, pickup ? null : ship - Math.floor(rnd() * 180), at, at].map(q).join(",")});`);
    for (const { p, qty } of items.values()) out.push(`INSERT INTO order_items (order_id,sku,name,qty,unit_cents) VALUES (${[id, p.sku, p.name, qty, p.cents].map(q).join(",")});`);
  }
}
console.log("sample orders:", k);
writeFileSync(new URL("../seed/seed.sql", import.meta.url), out.join("\n") + "\n");
console.log(`seed.sql: ${CATEGORIES.length} categories, ${Object.keys(BOXES).length} boxes, ${PRODUCTS.length} products`);
