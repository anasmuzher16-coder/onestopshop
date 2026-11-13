import { PRODUCTS, BOXES, CATEGORIES } from "../site/catalog.js";
let bad = 0; const cats = new Set(CATEGORIES.map(c=>c.id)); const skus = new Set();
for (const x of PRODUCTS){ const e=[];
  if(!/^OSS-\d{4}$/.test(x.sku)) e.push("sku"); if(skus.has(x.sku)) e.push("dup"); skus.add(x.sku);
  if(!cats.has(x.cat)) e.push("cat"); if(!(x.price>0)) e.push("price"); if(!(x.kg>0)) e.push("kg");
  if(!BOXES[x.box]) e.push("box"); if(x.height && Math.round(x.height*0.75)+6 > Math.max(BOXES[x.box].l,BOXES[x.box].w,BOXES[x.box].h)) e.push("stem too long for box");
  if(e.length){bad++; console.log("FAIL",x.sku,e.join(","));} }
console.log(bad?`FAIL ${bad}`:`PASS ${PRODUCTS.length} products, ${CATEGORIES.length} categories, all fit their box`); process.exit(bad?1:0);
