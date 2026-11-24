// The whole loop in a phone-sized browser: shop, cart, checkout (ship and pickup), confirmation, then the back
// office sees the order, moves it along, and changes stock and a product. One browser. Changes the local sample
// data: reseed afterwards. node store/tools/e2e-flow.mjs [screenshotDir]
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420", shots = process.argv[2];
const KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
const b = await chromium.launch(); const errs = [];
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("response", r => { if (r.status() === 404) errs.push("404 " + r.url()); }); p.on("console", m => m.type() === "error" && !/status of 404/.test(m.text()) && !/status of 40[19]/.test(m.text()) && errs.push(m.text()));
  const snap = async name => { if (shots) await p.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
  // 1 ship a cologne and a misc item to Toronto
  await p.goto(B + "/p/OSS-7001", { waitUntil: "networkidle" }); await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(900);
  await p.goto(B + "/p/OSS-8003", { waitUntil: "networkidle" }); await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(900);
  await p.goto(B + "/cart", { waitUntil: "networkidle" });
  t("cart offers pickup before a postal code", await p.locator('input[name="ship"][value="pickup"]').count() === 1);
  await p.locator("[data-open-postal]").first().tap(); await p.fill("#postal", "M5V 2T6"); await p.locator('[data-postal-form] button[type="submit"]').tap(); await p.waitForTimeout(500);
  const services = await p.locator('input[name="ship"]').evaluateAll(els => els.map(e => e.value));
  t("cologne in the cart hides Xpresspost", !services.includes("cp-xp") && services.includes("cp-exp") && services.includes("pickup"), services.join(","));
  await p.locator('input[name="ship"][value="cp-exp"]').check(); await p.waitForTimeout(300); await snap("flow-cart");
  await p.locator('a[href="/checkout"]:visible').first().tap(); await p.waitForURL(/\/checkout$/);
  await snap("flow-checkout");
  await p.locator('[data-checkout] button[type="submit"]').tap(); await p.waitForTimeout(300);
  t("empty form is stopped with a message", await p.locator("[data-co-err]").isVisible());
  await p.fill("#co-name", "Sam Sample"); await p.fill("#co-email", "sam@example.com"); await p.fill("#co-line1", "1 Test Street"); await p.fill("#co-city", "Toronto");
  const shown = await p.locator(".totals__door dd").innerText();
  await p.locator('[data-checkout] button[type="submit"]').tap(); await p.waitForURL(/\/order\/W[A-Z0-9]{6}$/, { timeout: 15000 });
  const id1 = new URL(p.url()).pathname.split("/").pop(), paid = await p.locator(".totals__door dd").innerText();
  t("confirmation shows the order code", (await p.locator(".done__tag b").innerText()) === id1);
  t("the total on the confirmation equals the total shown before paying", paid === shown, `${shown} vs ${paid}`);
  t("cart is empty after ordering", (await p.locator("[data-cart-count]").first().innerText()) === "0");
  await p.waitForTimeout(1200); await snap("flow-done");
  // 2 pickup order
  await p.goto(B + "/p/OSS-8004", { waitUntil: "networkidle" }); await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(900);
  await p.goto(B + "/cart", { waitUntil: "networkidle" }); await p.locator('input[name="ship"][value="pickup"]').check(); await p.waitForTimeout(300);
  await p.locator('a[href="/checkout"]:visible').first().tap(); await p.waitForURL(/\/checkout$/);
  t("pickup checkout asks for no address", await p.locator("#co-line1").count() === 0);
  await p.fill("#co-name", "Pat Pickup"); await p.fill("#co-email", "pat@example.com");
  await p.locator('[data-checkout] button[type="submit"]').tap(); await p.waitForURL(/\/order\/W[A-Z0-9]{6}$/, { timeout: 15000 });
  const id2 = new URL(p.url()).pathname.split("/").pop();
  // 3 sold out on the shelf
  await p.goto(B + "/p/OSS-7008", { waitUntil: "networkidle" });
  t("a product with no stock shows as sold and cannot be added", await p.locator("[data-add]").count() === 0 && /Sold out/.test(await p.locator(".soldline").innerText()));
  // 3b charcoal: pickup or our own local delivery only, never Canada Post (owner, 2026-11-24); nothing about age or ID for the customer.
  await p.evaluate(() => { localStorage.setItem("oss:postal", JSON.stringify("M5V 2T6")); localStorage.removeItem("oss:ship"); });
  await p.goto(B + "/p/OSS-9101", { waitUntil: "networkidle" });
  const pdp = await p.locator(".pdp__info").innerText();
  t("charcoal product page says pickup or local delivery only, offers no Canada Post, and says nothing about age or ID", /Pickup or local delivery only/.test(pdp) && !/Canada Post (Regular|Expedited|Xpresspost|Priority)/.test(pdp) && !/photo id|\bage\b|adult/i.test(pdp), pdp.slice(0, 200));
  t("a charcoal item with no photo shows the drawn stand-in, never a broken image", await p.locator(".pdp__tile img.shot--drawn").count() === 1 && await p.evaluate(() => [...document.images].every(i => !i.getAttribute("src") || !i.complete || i.naturalWidth > 0)));
  await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(700);
  await p.goto(B + "/p/OSS-8004", { waitUntil: "networkidle" }); await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(700);
  await p.goto(B + "/cart", { waitUntil: "networkidle" }); await p.waitForTimeout(600);
  let ways = await p.locator('input[name="ship"]').evaluateAll(els => els.map(e => e.value));
  t("a mixed cart going to Toronto offers pickup or leaving the charcoal out, never Canada Post", ways.join() === "pickup,drop", ways.join());
  t("the cart line says pickup or local delivery only", /Pickup or local delivery only/.test(await p.locator(".line", { hasText: "Coco Cafe" }).innerText()));
  await p.locator('input[name="ship"][value="drop"]').tap()   /* the radio acts at once and leaves the page, so it is tapped, not "checked" */; await p.waitForTimeout(500);
  ways = await p.locator('input[name="ship"]').evaluateAll(els => els.map(e => e.value));
  t("leaving the charcoal out keeps the rest and opens Canada Post for it", await p.locator(".line").count() === 1 && ways.some(w => /^cp-/.test(w)), ways.join());
  await p.locator("[data-undo-drop]").tap(); await p.waitForTimeout(500);
  ways = await p.locator('input[name="ship"]').evaluateAll(els => els.map(e => e.value));
  t("putting the charcoal back takes Canada Post away again", await p.locator(".line").count() === 2 && !ways.some(w => /^cp-/.test(w)), ways.join());
  // a Windsor postal code: the whole order can come by our own local delivery
  await p.evaluate(() => localStorage.setItem("oss:postal", JSON.stringify("N9A 1A1"))); await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('input[name="ship"][value="local"]', { timeout: 8000 }).catch(() => {});
  ways = await p.locator('input[name="ship"]').evaluateAll(els => els.map(e => e.value));
  t("a mixed cart near Windsor offers local delivery, pickup, or leaving the charcoal out", ways.join() === "local,pickup,drop", ways.join());
  await snap("flow-charcoal-mixed");
  await p.locator('input[name="ship"][value="pickup"]').check(); await p.waitForTimeout(300);
  await p.locator('a[href="/checkout"]:visible').first().tap(); await p.waitForURL(/\/checkout$/);
  t("checkout asks nothing about age", await p.locator('input[type="checkbox"]').count() === 0 && !/photo id|\bage\b|adult/i.test(await p.locator("#main").innerText()));
  await snap("flow-charcoal-checkout");
  await p.fill("#co-name", "Cole Coal"); await p.fill("#co-email", "cole@example.com");
  await p.locator('[data-checkout] button[type="submit"]').tap(); await p.waitForURL(/\/order\/W[A-Z0-9]{6}$/, { timeout: 15000 });
  const id3 = new URL(p.url()).pathname.split("/").pop();
  t("the confirmation says nothing about age or ID", !/photo id|\bage\b|adult/i.test(await p.locator("#main").innerText()));
  await p.evaluate(() => { localStorage.removeItem("oss:postal"); localStorage.removeItem("oss:ship"); });
  // 4 the back office
  await p.goto(B + "/admin", { waitUntil: "networkidle" }); await p.fill("#passcode", KEY); await p.locator('button[type="submit"]').tap(); await p.waitForSelector(".hero__fig");
  await p.locator('[data-tab="orders"]').tap(); await p.waitForSelector(".order");
  t("both new orders are waiting in the back office", await p.locator(`[data-order="${id1}"]`).count() === 1 && await p.locator(`[data-order="${id2}"]`).count() === 1);
  await p.locator(`[data-order="${id3}"]`).tap(); await p.waitForSelector("dialog[open] [data-next]");
  t("staff, and only staff, get a discreet ID note on the charcoal order", /Check ID if the customer looks young/.test(await p.locator("dialog[open]").innerText()));
  await p.locator("dialog[open] .sheet__act [data-close]").tap(); await p.waitForTimeout(200);
  await p.locator(`[data-order="${id1}"]`).tap(); await p.waitForSelector("dialog[open] [data-next]"); await snap("flow-admin-order");
  await p.locator("[data-next]").tap(); await p.waitForFunction(() => /Mark shipped/.test(document.querySelector("dialog[open] [data-next]")?.textContent || ""), null, { timeout: 8000 });
  t("order moves from To pack to Packed", /packed/i.test(await p.locator("dialog[open] .sheet__top .state").innerText()));
  await p.locator("dialog[open] .sheet__act [data-close]").tap();
  await p.locator('[data-tab="stock"]').tap(); await p.waitForSelector(".row[data-sku]"); await p.fill("#q", "Olive snapback"); await p.waitForTimeout(300);
  const row = p.locator('.row[data-sku="OSS-8003"]'), was = +(await row.locator("output").innerText());
  await row.locator('[data-step="1"]').tap(); await p.waitForTimeout(600);
  t("plus adds one to stock", +(await row.locator("output").innerText()) === was + 1);
  await row.locator('[data-step="-1"]').tap(); await p.waitForTimeout(600);
  t("minus takes one off", +(await row.locator("output").innerText()) === was);
  await row.locator("[data-edit]").tap(); await p.waitForSelector("dialog[open] form"); await p.fill('dialog[open] input[name="price"]', "27.50");
  await p.locator('dialog[open] button[type="submit"]').tap(); await p.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 8000 });
  await p.goto(B + "/p/OSS-8003", { waitUntil: "networkidle" });
  const mod = await p.evaluate(async () => (await import("/api/catalog-module?" + Date.now())).PRODUCTS.find(x => x.sku === "OSS-8003").price);
  t("a price changed in the back office shows in the store", mod === 27.5 && /27/.test(await p.locator(".pdp__tile .sticker__v").innerText()), String(mod));
  // new product from the phone
  await p.goto(B + "/admin", { waitUntil: "networkidle" }); await p.waitForSelector(".hero__fig"); await p.locator('[data-tab="stock"]').tap(); await p.locator("[data-new]").tap(); await p.waitForSelector("dialog[open] form");
  await p.fill('dialog[open] input[name="name"]', "Brass mouth tip"); await p.selectOption('dialog[open] select[name="category_id"]', "misc"); await p.fill('dialog[open] input[name="price"]', "12"); await p.fill('dialog[open] input[name="weight_g"]', "60"); await p.selectOption('dialog[open] select[name="box_id"]', "XS"); await p.fill('dialog[open] input[name="stock"]', "6");
  await p.locator('dialog[open] button[type="submit"]').tap(); await p.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 8000 });
  await p.goto(B + "/shop/misc", { waitUntil: "networkidle" });
  t("a product added in the back office appears in the store", /Brass mouth tip/.test(await p.locator("#main").innerText()));
  t("no sideways scroll", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await ctx.close();
} finally { await b.close(); }
t("no page errors", errs.length === 0, [...new Set(errs)].slice(0, 3).join(" | "));
console.log(f ? `FAIL ${f}/${n}` : `PASS ${n}/${n}`); process.exit(f ? 1 : 0);
