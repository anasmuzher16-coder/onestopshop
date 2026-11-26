// Checks the two till moments: the cart total rolls when a quantity changes, the order number is stamped once.
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = "http://127.0.0.1:4420", out = process.argv[2];
const b = await chromium.launch(); const errs = [];
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
  await p.addInitScript(() => { localStorage.setItem("oss:cart", JSON.stringify([{ sku: "OSS-8003", qty: 1 }])); localStorage.setItem("oss:ship", JSON.stringify("pickup")); });
  await p.goto(B + "/cart", { waitUntil: "networkidle" }); await p.waitForTimeout(900);
  const before = await p.locator(".totals__door dd").innerText();
  await p.locator('[data-qty="OSS-8003"][data-n="2"]').click(); await p.waitForTimeout(90);
  const mid = await p.evaluate(() => ({ spans: document.querySelectorAll(".totals__door dd span").length, anims: [...document.querySelectorAll(".totals__door dd span")].filter(s => s.getAnimations().length).length }));
  if (out) await p.screenshot({ path: out + "/till-roll.png", clip: { x: 0, y: 0, width: 390, height: 844 } });
  await p.waitForTimeout(600); const after = await p.locator(".totals__door dd").innerText();
  console.log("total", before, "->", after, "| characters", mid.spans, "rolling", mid.anims);
  await p.locator('a[href="/checkout"]:visible').first().click(); await p.waitForSelector("[data-checkout]");
  await p.fill("#co-name", "Sam Sample"); await p.fill("#co-email", "sam@example.com"); await p.locator('[data-checkout] button[type="submit"]').click();
  await p.waitForURL(/\/order\/W/); await p.waitForTimeout(560);
  const st = await p.evaluate(() => document.querySelector(".done__tag").getAnimations().map(a => a.playState).join(","));
  if (out) await p.screenshot({ path: out + "/till-stamp.png" });
  await p.waitForTimeout(700);
  console.log("order stamp animation while landing:", st || "none", "| after:", await p.evaluate(() => document.querySelector(".done__tag").getAnimations().length));
} finally { await b.close(); }
console.log(errs.length ? "ERRORS " + [...new Set(errs)].join(" | ") : "no page errors");
