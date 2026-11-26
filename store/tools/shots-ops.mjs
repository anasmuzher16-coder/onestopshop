// Screenshots: the email preview inside an order in the back office, and the privacy page. node store/tools/shots-ops.mjs <outDir>
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420", out = process.argv[2];
const KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
const b = await chromium.launch(); const errs = [];
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/40[14]/.test(m.text()) && errs.push(m.text()));
  await p.goto(B + "/privacy", { waitUntil: "networkidle" }); await p.waitForTimeout(600); await p.screenshot({ path: `${out}/privacy-390.png` });
  await p.goto(B + "/admin", { waitUntil: "networkidle" }); await p.fill("#passcode", KEY); await p.click('button[type="submit"]'); await p.waitForSelector(".hero__fig");
  await p.click('[data-tab="orders"]'); await p.waitForSelector(".order");
  const withMail = p.locator(".order", { hasText: "Sam Sample" }).first(); await withMail.click(); await p.waitForSelector("dialog[open] [data-mail]");
  await p.locator("dialog[open] [data-mail]").first().click(); await p.waitForSelector("dialog[open] iframe.mail"); await p.waitForTimeout(800);
  await p.locator("dialog[open] [data-mailview]").scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/admin-mail-390.png` });
} finally { await b.close(); }
console.log(errs.length ? "ERRORS " + [...new Set(errs)].join(" | ") : "no page errors");
