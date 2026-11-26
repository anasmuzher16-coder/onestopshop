// What an iPhone actually gets: loads pages in WebKit (Safari's engine) with an iPhone profile and reports script
// errors, whether the section object and smoke are present, and saves a picture. node tools/webkit-check.mjs <out dir>
import { createRequire } from "node:module";
const { webkit, devices } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const out = process.argv[2] || ".", B = process.env.BASE || "http://127.0.0.1:4420";
const PAGES = (process.env.PAGES || "/shop/hookahs,/shop/cologne,/shop/heat,/set,/search,/cart,/p/OSS-100024,/shop/shisha").split(",");
const b = await webkit.launch(); let bad = 0;
try {
  const ctx = await b.newContext({ ...devices["iPhone 15 Plus"] });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message)); p.on("console", m => (m.type() === "error" || m.type() === "warning") && !/interactive-widget/.test(m.text()) && errs.push(m.type() + ": " + m.text()));
  p.on("requestfailed", r => errs.push("failed: " + r.url()));
  for (const path of PAGES) {
    errs.length = 0;
    await p.goto(B + path, { waitUntil: "load" }); await p.waitForTimeout(+(process.env.WAIT || 2500));
    const s = await p.evaluate(() => ({ obj: !!document.querySelector(".fx-obj svg"), layer: document.querySelectorAll(".fx").length, smoke: document.querySelector(".smoke") ? document.querySelector(".smoke").className + " " + document.querySelector(".smoke").tagName : "none", band: !!document.querySelector(".shophead") }));
    const want = s.band ? s.obj : true; if (!want || errs.length) bad++;
    console.log((want && !errs.length ? "ok   " : "FAIL ") + path, JSON.stringify(s), errs.slice(0, 4).join(" | "));
    await p.screenshot({ path: `${out}/wk${path.replace(/\W+/g, "-")}.png` });
  }
} finally { await b.close(); }
console.log(bad ? `FAIL ${bad} pages` : "PASS in WebKit");
