// Screenshots of the back office at phone and desk width, signed in with the local passcode. One browser.
// node store/tools/shots-admin.mjs <outDir>
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420", out = process.argv[2];
const KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
const b = await chromium.launch(); const errs = [];
try {
  for (const [w, h, tag] of [[390, 844, "390"], [1440, 900, "1440"]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1, isMobile: w < 500, hasTouch: w < 500 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/401/.test(m.text()) && errs.push(m.text()));
    await p.goto(B + "/admin", { waitUntil: "networkidle" });
    if (tag === "390") await p.screenshot({ path: `${out}/admin-gate-${tag}.png` });
    await p.fill("#passcode", KEY); await p.click('button[type="submit"]'); await p.waitForSelector(".hero__fig"); await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/admin-today-${tag}.png`, fullPage: true });
    await p.click('[data-tab="stock"]'); await p.waitForSelector(".row"); await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/admin-stock-${tag}.png` });
    await p.click('[data-cat="cologne"]'); await p.waitForTimeout(300); await p.click('[data-edit="OSS-7003"]'); await p.waitForSelector("dialog[open]"); await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/admin-edit-${tag}.png` });
    await p.click("[data-close]"); await p.click('[data-tab="orders"]'); await p.waitForSelector(".order"); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/admin-orders-${tag}.png` });
    await p.locator(".order").first().click(); await p.waitForSelector("dialog[open]"); await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/admin-order-${tag}.png` });
    const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth); if (wide) errs.push("sideways scroll at " + tag);
    await ctx.close();
  }
} finally { await b.close(); }
console.log(errs.length ? "ERRORS " + [...new Set(errs)].join(" | ") : "no page errors");
