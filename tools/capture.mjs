// Captures every route at 390 and 1440 into shots/. Needs `node tools/serve.mjs` running.
// Uses the Playwright install in the arena repo (no new dependency here).
import { createRequire } from "node:module";
const require = createRequire("C:/dev/puckempire-arena/package.json");
const { chromium } = require("playwright");
const base = process.env.BASE || "http://localhost:4410/";
const cart = [{ sku: "OSS-0101", qty: 1 }, { sku: "OSS-0301", qty: 1 }, { sku: "OSS-0305", qty: 2 }, { sku: "OSS-0401", qty: 1 }];
const routes = [["home-empty", "", false], ["home", "", true], ["shop", "#/shop/hookahs", true], ["pdp", "#/p/OSS-0102", true],
  ["pdp-empty", "#/p/OSS-0104", false], ["cart", "#/cart", true], ["shipping", "#/shipping", true]];
const browser = await chromium.launch();
for (const w of [390, 1440]) {
  for (const [name, hash, withCode] of routes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(([c, code]) => {
      localStorage.setItem("oss:cart", JSON.stringify(c));
      if (code) localStorage.setItem("oss:postal", JSON.stringify("B3H 4R2")); else localStorage.removeItem("oss:postal");
    }, [cart, withCode]);
    const page = await ctx.newPage();
    await page.goto(base + hash, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.screenshot({ path: `shots/${name}-${w}.png`, fullPage: true });
    await page.screenshot({ path: `shots/${name}-${w}-fold.png` });
    console.log(`${name}-${w}: scrollWidth ${sw}${sw > w ? " OVERFLOW" : ""}`);
    await ctx.close();
  }
}
await browser.close();
