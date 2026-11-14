// Writes seed/seed.sql from the mockup's sample catalogue (site/catalog.js). Sample data only: the shop's real
// products replace it through the admin. node store/tools/seed.mjs
import { writeFileSync } from "node:fs";
import { BOXES, CATEGORIES, PRODUCTS } from "../../site/catalog.js";
const q = v => v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const out = ["DELETE FROM stock_moves; DELETE FROM order_items; DELETE FROM orders; DELETE FROM products; DELETE FROM boxes; DELETE FROM categories;"];
CATEGORIES.forEach((c, i) => out.push(`INSERT INTO categories (id,name,tone,sort) VALUES (${q(c.id)},${q(c.name)},${q(c.tone)},${i});`));
for (const [id, b] of Object.entries(BOXES)) out.push(`INSERT INTO boxes (id,label,l_cm,w_cm,h_cm,tare_g) VALUES (${q(id)},${q(b.label)},${b.l},${b.w},${b.h},${Math.round(b.tare * 1000)});`);
PRODUCTS.forEach((p, i) => {
  out.push(`INSERT INTO products (sku,name,category_id,price_cents,weight_g,box_id,glass,height_cm,note,img,img_dark,img_lw,stock,sort) VALUES (${[p.sku, p.name, p.cat, Math.round(p.price * 100), Math.round(p.kg * 1000), p.box, p.glass ? 1 : 0, p.height ?? null, p.note, p.img, p.dark ? 1 : 0, p.lw ?? null, 5, i].map(q).join(",")});`);
  out.push(`INSERT INTO stock_moves (sku,delta,reason,actor) VALUES (${q(p.sku)},5,'count','seed');`);
});
writeFileSync(new URL("../seed/seed.sql", import.meta.url), out.join("\n") + "\n");
console.log(`seed.sql: ${CATEGORIES.length} categories, ${Object.keys(BOXES).length} boxes, ${PRODUCTS.length} products`);
