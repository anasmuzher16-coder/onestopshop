// Run by ci-suites.mjs as the first step on a fresh GitHub machine (its own store and database copy, like any suite; it checks
// nothing). The first browser start on a new machine is slow: fonts and browser files are read from disk for the first time,
// and a page's layout can still be settling when the first suite measures it. A laptop is always past that point.
//   node store/tools/ci-warm.mjs     (BASE = the running store)
import { createRequire } from "node:module";
const { chromium, webkit } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
for (const [name, type, ctx] of [["webkit", webkit, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }], ["chromium", chromium, { viewport: { width: 1440, height: 900 } }]]) {
  const t0 = Date.now(), b = await type.launch();
  try {
    const p = await (await b.newContext(ctx)).newPage();
    for (const u of ["/", "/shop/hookahs", "/shop", "/cart"]) { await p.goto(B + u, { waitUntil: "load" }); await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(500); }
    const a = await p.$("#main a[data-piece]"); if (a) { await p.goto(B + (await a.getAttribute("href")), { waitUntil: "load" }); await p.waitForTimeout(1500); }
  } finally { await b.close(); }
  console.log(`warmed ${name} in ${Math.round((Date.now() - t0) / 1000)} s`);
}
console.log("PASS warm-up (checks nothing)");
