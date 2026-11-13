// Captures every route at 390 and 1440 into shots/. Needs `node tools/serve.mjs` running.
// Uses the Playwright install in the arena repo (no new dependency here).
import { createRequire } from "node:module";
const require = createRequire("C:/dev/puckempire-arena/package.json");
const { chromium } = require("playwright");
const base = process.env.BASE || "http://localhost:4410/";
const cart = [{ sku: "OSS-1021", qty: 1 }, { sku: "OSS-5006", qty: 1 }, { sku: "OSS-6007", qty: 2 }, { sku: "OSS-7001", qty: 1 }];
const routes = [["home", "", false], ["shop", "#/shop/hookahs", false], ["pdp", "#/p/OSS-1021", true], ["pdp-dark", "#/p/OSS-1006", true],
  ["pdp-empty", "#/p/OSS-1012", false], ["cart", "#/cart", true], ["shipping", "#/shipping", true]];
const browser = await chromium.launch();
for (const w of [390, 1440]) {
  for (const [name, hash, withCode] of routes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(([c, code]) => {
      localStorage.setItem("oss:cart", JSON.stringify(c));
      if (code) localStorage.setItem("oss:postal", JSON.stringify("M5V 2T6")); else localStorage.removeItem("oss:postal");
    }, [cart, withCode]);
    const page = await ctx.newPage();
    await page.goto(base + hash, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
    await page.waitForLoadState("networkidle");
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.screenshot({ path: `shots/${name}-${w}.png`, fullPage: true });
    await page.screenshot({ path: `shots/${name}-${w}-fold.png` });
    console.log(`${name}-${w}: scrollWidth ${sw}${sw > w ? " OVERFLOW" : ""}`);
    await ctx.close();
  }
}
await browser.close();
