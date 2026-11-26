// Price labels never stay hidden on screen (fx-stick.js): first load, a section by tap, Back from a product to a long section, Misc.
// Chromium and WebKit, phone size. Needs the store running. node store/tools/test-stick.mjs
import { createRequire } from "node:module";
const { chromium, webkit } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
// a label counts as hidden only on a tile at least half on screen (the stick waits for 35% of a tile, by design)
const hidden = p => p.evaluate(() => [...document.querySelectorAll(".card .tile")].filter(x => { const r = x.getBoundingClientRect(); const vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0); return r.height > 0 && vis / r.height >= 0.5 && x.querySelector(".sticker") && getComputedStyle(x.querySelector(".sticker")).opacity === "0"; }).length);
for (const [tag, type] of [["chromium", chromium], ["webkit", webkit]]) {
  const b = await type.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(B + "/shop", { waitUntil: "load" }); await p.waitForTimeout(1800);
    t(`${tag}: first load, no label hidden on screen`, (await hidden(p)) === 0, String(await hidden(p)));
    await p.evaluate(() => document.querySelector('a[href="/shop/charcoal"]')?.click()); await p.waitForTimeout(2600);
    t(`${tag}: a section by tap, no label left hidden on screen`, (await hidden(p)) === 0, String(await hidden(p)));
    await p.evaluate(() => document.querySelector('a[href="/shop"]')?.click()); await p.waitForTimeout(2600);
    await p.evaluate(() => scrollTo(0, 1600)); await p.waitForTimeout(900);
    const sku = await p.evaluate(() => { const a = [...document.querySelectorAll("#main a[data-piece]")].find(x => { const r = x.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 120; }); if (a) a.click(); return a?.dataset.piece; });
    await p.waitForTimeout(2200); await p.goBack(); await p.waitForTimeout(2600);
    t(`${tag}: Back from a product to Everything, no label hidden on screen`, sku && (await hidden(p)) === 0, `${sku} ${await hidden(p)}`);
    await p.evaluate(() => scrollTo(0, 3200)); await p.waitForTimeout(1500);
    t(`${tag}: scrolled further, labels stick on as they arrive`, (await hidden(p)) === 0, String(await hidden(p)));
    await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(2200);
    t(`${tag}: Misc, no label hidden on screen`, (await hidden(p)) === 0, String(await hidden(p)));
    t(`${tag}: no page errors`, !errs.length, errs.join(" | "));
  } finally { await b.close(); }
}
console.log(f ? `FAIL ${f}/${n}` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
