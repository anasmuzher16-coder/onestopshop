// The whole loop in a phone-sized browser: shop, cart, checkout (ship and pickup), confirmation, then the back
// office sees the order, moves it along, and changes stock and a product. One browser. Changes the local sample
// data: reseed afterwards. node store/tools/e2e-flow.mjs [screenshotDir]
import { samplesOn } from "./fixtures/samples-on.mjs";
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420", shots = process.argv[2];
// the made-up sample rows this suite buys, switched back on in its own throwaway database (tools/fixtures/samples-on.mjs)
await samplesOn(B, ["OSS-7001", "OSS-7008", "OSS-8003", "OSS-8004"]);
// Card orders go to Stripe's page (the local stand-in, tools/fake-stripe.mjs): pay there, come back, wait for the signed webhook.
const payThrough = async (p, timeout = 15000) => { await p.waitForURL(u => /\/pay\/cs_/.test(String(u)) || /\/order\/W[A-Z0-9]{6}$/.test(String(u)), { timeout }); if (/\/pay\/cs_/.test(p.url())) { await p.locator("[data-fake-pay]").click(); await p.waitForURL(/\/order\/W[A-Z0-9]{6}$/, { timeout }); await p.waitForSelector('[data-pay-state="paid"]', { timeout }); } };
const KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
// With no card keys (the live demo) shipping cannot be ordered: checkout says so with the shop's number, and the same cart is
// ordered for pickup, paid at the counter. With keys the journey is the card one.
const CARD = /<meta name="oss-pay" content="card">/.test(await (await fetch(B + "/")).text());
const b = await chromium.launch(); const errs = [];
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("response", r => { if (r.status() === 404) errs.push("404 " + r.url()); }); p.on("console", m => m.type() === "error" && !/status of 404/.test(m.text()) && !/status of 40[19]/.test(m.text()) && errs.push(m.text()));
  const snap = async name => { if (shots) await p.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
  // 1 ship a cologne and a misc item to Toronto
  await p.goto(B + "/p/OSS-7001", { waitUntil: "networkidle" }); await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(900);
  await p.goto(B + "/p/OSS-8003", { waitUntil: "networkidle" }); await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(900);
  await p.goto(B + "/cart", { waitUntil: "networkidle" });
  if (CARD) {
    t("cart offers pickup before a postal code", await p.locator('input[name="ship"][value="pickup"]').count() === 1);
    await p.locator("[data-open-postal]").first().tap(); await p.fill("#postal", "M5V 2T6"); await p.locator('[data-postal-form] button[type="submit"]').tap(); await p.waitForTimeout(500);
    const services = await p.locator('input[name="ship"]').evaluateAll(els => els.map(e => e.value));
    t("cologne in the cart hides Xpresspost", !services.includes("cp-xp") && services.includes("cp-exp") && services.includes("pickup"), services.join(","));
    await p.locator('input[name="ship"][value="cp-exp"]').check(); await p.waitForTimeout(300);
  } else {
    // no card keys (the live demo; breaker, 2026-11-27): every order is a pickup paid at the counter, so the cart offers no
    // shipping or delivery at all, only the pickup, and asks for no postal code
    const cs = await p.locator(".cartship").innerText();
    t("no keys: the cart is a pickup, with no shipping, delivery or postal code", await p.locator('input[name="ship"]').count() === 0 && await p.locator(".pickline").count() === 1 && await p.locator("[data-open-postal]:visible").count() === 0 && !/Canada Post|local delivery/i.test(cs), cs.slice(0, 200));
  }
  await snap("flow-cart");
  await p.locator('a[href="/checkout"]:visible').first().tap(); await p.waitForURL(/\/checkout$/);
  await snap("flow-checkout");
  if (!CARD) t("no keys: the cart picked up is paid at the counter", /At the counter/.test(await p.locator(".co__pay").innerText()));
  await p.locator('[data-checkout] button[type="submit"]').tap(); await p.waitForTimeout(300);
  t("empty form is stopped with a message under the first field", await p.locator("#co-name-err").isVisible() && await p.locator("#co-name").getAttribute("aria-invalid") === "true");   // 2026-11-27: under the field, no longer above the button
  { const all = await p.locator("#co-name-err, #co-email-err").evaluateAll(es => es.map(e => !e.hidden)), who = await p.evaluate(() => document.activeElement && document.activeElement.id);
    t("an empty form shows every field's error at once, each field marked and described, the focus on the first", all.every(Boolean) && await p.locator("#co-email").getAttribute("aria-invalid") === "true" && await p.locator("#co-email").getAttribute("aria-describedby") === "co-email-err" && who === "co-name", `${all} ${who}`);
    await p.fill("#co-name", "Sam Sample"); await p.fill("#co-email", "not-an-email"); await p.fill("#co-phone", "123"); await p.locator('[data-checkout] button[type="submit"]').tap(); await p.waitForTimeout(300);
    const ph = await p.locator("#co-phone-err").isVisible(), em = await p.locator("#co-email-err").isVisible(), phNeeded = await p.locator("#co-phone").evaluate(e => e.required);
    t("a bad email and a bad phone both show, each under its own field, the focus on the email", em && (ph || !phNeeded) && await p.locator("#co-email").getAttribute("aria-invalid") === "true" && (!phNeeded || await p.locator("#co-phone").getAttribute("aria-describedby") === "co-phone-err") && await p.evaluate(() => document.activeElement.id) === "co-email", `email ${em} phone ${ph} needed ${phNeeded}`);
    const mark = await p.locator("#co-email-err").evaluate(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && getComputedStyle(e, "::before").textIndent === "0px"; });
    if (phNeeded) { await p.fill("#co-email", "sam@example.com"); await p.fill("#co-phone", "222-222-2222"); await p.locator('[data-checkout] button[type="submit"]').tap(); await p.waitForTimeout(300); t("a phone of one repeated digit is stopped under the phone field", await p.locator("#co-phone-err").isVisible() && await p.locator("#co-phone").getAttribute("aria-invalid") === "true"); }
    t("the error mark sits inside the field column, not hanging off the left edge", mark); }
  await p.fill("#co-name", "Sam Sample"); await p.fill("#co-email", "sam@example.com"); await p.fill("#co-phone", "519-555-0171"); /* a pickup gives a phone while the shop's mail is off (2026-11-27) */ if (CARD) { await p.fill("#co-line1", "1 Test Street"); await p.fill("#co-city", "Toronto"); }
  const shown = await p.locator(".totals__door dd").innerText();
  await p.locator('[data-checkout] button[type="submit"]').tap(); await payThrough(p, 15000);
  const id1 = new URL(p.url()).pathname.split("/").pop(), paid = await p.locator(".totals__door dd").innerText();
  t("confirmation shows the order code", (await p.locator(".done__tag b").innerText()) === id1);
  t("the total on the confirmation equals the total shown before paying", paid === shown, `${shown} vs ${paid}`);
  t("cart is empty after ordering", (await p.locator("[data-cart-count]").first().innerText()) === "0");
  await p.waitForTimeout(1200); await snap("flow-done");
  // 2 pickup order
  await p.goto(B + "/p/OSS-8004", { waitUntil: "networkidle" }); await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(900);
  await p.goto(B + "/cart", { waitUntil: "networkidle" }); if (CARD) { await p.locator('input[name="ship"][value="pickup"]').check(); await p.waitForTimeout(300); }
  await p.locator('a[href="/checkout"]:visible').first().tap(); await p.waitForURL(/\/checkout$/);
  t("pickup checkout asks for no address", await p.locator("#co-line1").count() === 0);
  await p.fill("#co-name", "Pat Pickup"); await p.fill("#co-email", "pat@example.com"); await p.fill("#co-phone", "519-555-0172");
  await p.locator('[data-checkout] button[type="submit"]').tap(); await payThrough(p, 15000);
  const id2 = new URL(p.url()).pathname.split("/").pop();
  // 3 sold out on the shelf
  await p.goto(B + "/p/OSS-7008", { waitUntil: "networkidle" });
  t("a product with no stock shows as sold and cannot be added", await p.locator("[data-add]").count() === 0 && /Sold out/.test(await p.locator(".soldline").innerText()));
  // 3b charcoal: pickup or our own local delivery only, never Canada Post (owner, 2026-11-24); nothing about age or ID for the customer.
  await p.evaluate(() => { localStorage.setItem("oss:postal", JSON.stringify("M5V 2T6")); localStorage.removeItem("oss:ship"); });
  await p.goto(B + "/p/OSS-9101", { waitUntil: "networkidle" });
  const pdp = await p.locator(".pdp__info").innerText();
  t(CARD ? "charcoal product page says pickup or local delivery only, offers no Canada Post, and says nothing about age or ID" : "no keys: charcoal product page says pickup at the counter like every item (2026-11-27: no separate never-shipped note while all is pickup), offers no Canada Post or delivery, and says nothing about age or ID", (CARD ? /Pickup or local delivery only/.test(pdp) : /Pickup at the Windsor counter/.test(pdp) && /Paid in the shop/.test(pdp) && !/Never shipped|local delivery/i.test(pdp)) &&!/Canada Post (Regular|Expedited|Xpresspost|Priority)/.test(pdp) && !/photo id|\bage\b|adult/i.test(pdp), pdp.slice(0, 200));
  t("a charcoal item with no photo shows the drawn stand-in, never a broken image", await p.locator(".pdp__tile img.shot--drawn").count() === 1 && await p.evaluate(() => [...document.images].every(i => !i.getAttribute("src") || !i.complete || i.naturalWidth > 0)));
  await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(700);
  await p.goto(B + "/p/OSS-8004", { waitUntil: "networkidle" }); await p.locator("[data-add]:visible").first().tap(); await p.waitForTimeout(700);
  await p.goto(B + "/cart", { waitUntil: "networkidle" }); await p.waitForTimeout(600);
  let ways = await p.locator('input[name="ship"]').evaluateAll(els => els.map(e => e.value));
  if (!CARD) {   // no keys: the mixed cart is one pickup, paid at the counter; no leaving the charcoal out, no delivery
    const line = await p.locator(".line", { hasText: "Coco Cafe" }).innerText();
    // design review 2026-11-27: card off, the whole site is pickup only, so the cart line no longer repeats it (rewritten for that rule)
    t("no keys: a charcoal cart is one pickup, with no other way offered", ways.length === 0 && await p.locator(".pickline").count() === 1 && !/Pickup with this order|Pickup only/.test(line) && !/local delivery/i.test(await p.locator("#main").innerText()), ways.join() + " " + line);
  } else {
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
  }
  await p.locator('a[href="/checkout"]:visible').first().tap(); await p.waitForURL(/\/checkout$/);
  t("checkout asks nothing about age", await p.locator('input[type="checkbox"]').count() === 0 && !/photo id|\bage\b|adult/i.test(await p.locator("#main").innerText()));
  await snap("flow-charcoal-checkout");
  await p.fill("#co-name", "Cole Coal"); await p.fill("#co-email", "cole@example.com"); await p.fill("#co-phone", "519-555-0173");
  await p.locator('[data-checkout] button[type="submit"]').tap(); await payThrough(p, 15000);
  const id3 = new URL(p.url()).pathname.split("/").pop();
  t("the confirmation says nothing about age or ID", !/photo id|\bage\b|adult/i.test(await p.locator("#main").innerText()));
  await p.evaluate(() => { localStorage.removeItem("oss:postal"); localStorage.removeItem("oss:ship"); });
  // 4 the back office
  // a pickup request whose note carries HTML (breaker, 2026-11-27: WSW333R): Today, the list and the order sheet show it as text
  const XSS = '<img src=x onerror="window.__xss=1"><b data-xss>bold</b>';
  const xr = await (await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "10.77.0.1" }, body: JSON.stringify({ name: "Nina Notes", email: "nina-notes@example.com", phone: "519-555-0177", method: "pickup", pay: "at_pickup", note: XSS, lines: [{ sku: "OSS-8004", qty: 1 }] }) })).json(), xid = xr.order?.id;
  await p.goto(B + "/admin", { waitUntil: "networkidle" }); await p.fill("#passcode", KEY); await p.locator('button[type="submit"]').tap(); await p.waitForSelector(".hero__fig");
  t("Today lists the new request", !!xid && await p.locator(`[data-confirmlist] [data-order="${xid}"]`).count() === 1, JSON.stringify(xr).slice(0, 200));
  await p.locator('[data-tab="orders"]').tap(); await p.waitForSelector(".order");
  t("both new orders are waiting in the back office", await p.locator(`[data-order="${id1}"]`).count() === 1 && await p.locator(`[data-order="${id2}"]`).count() === 1);
  if (xid) {
    await p.locator(`[data-order="${xid}"]`).tap(); await p.waitForSelector("dialog[open] [data-ordersheet]");
    const shown = await p.locator("dialog[open]").innerText();
    t("a note with HTML in it is shown as text on the order sheet, never run", shown.includes(XSS) && await p.locator('img[src="x"], [data-xss]').count() === 0 && await p.evaluate(() => window.__xss === undefined), shown.slice(0, 300));
    await p.locator("dialog[open] .sheet__act [data-close]").tap(); await p.waitForTimeout(200);
    // find it on the server by phone, written another way
    await p.fill("#oq", "(519) 555 0177"); await p.locator('[data-ofind] button[type="submit"]').tap(); await p.waitForSelector("[data-found]");
    t("Find by phone shows the order", await p.locator(`[data-order="${xid}"]`).count() === 1 && await p.locator(".rows .order").count() >= 1);
    await p.locator("[data-ofindclear]").tap(); await p.waitForTimeout(200);
    t("nothing from the note ran anywhere", await p.locator('img[src="x"], [data-xss]').count() === 0 && await p.evaluate(() => window.__xss === undefined));
  }
  await p.locator(`[data-order="${id3}"]`).tap(); await p.waitForSelector("dialog[open] [data-next]");
  t("staff, and only staff, get a discreet ID note on the charcoal order", /Check ID if the customer looks young/.test(await p.locator("dialog[open]").innerText()));
  if (CARD) t("a card-paid order shows it is paid and offers a refund to the card", /Payment\s*Paid, card/.test(await p.locator("dialog[open]").innerText()) && await p.locator("dialog[open] [data-refundform]").count() === 1);
  else t("no keys: the order is to be paid at the counter, with no card refund", /counter/i.test(await p.locator("dialog[open]").innerText()) && await p.locator("dialog[open] [data-refundform]").count() === 0, (await p.locator("dialog[open]").innerText()).slice(0, 300));
  await p.locator("dialog[open] .sheet__act [data-close]").tap(); await p.waitForTimeout(200);
  await p.locator(`[data-order="${id1}"]`).tap(); await p.waitForSelector("dialog[open] [data-next]"); await snap("flow-admin-order");
  if (CARD) {
  await p.locator("[data-next]").tap(); await p.waitForFunction(() => /Mark shipped/.test(document.querySelector("dialog[open] [data-next]")?.textContent || ""), null, { timeout: 8000 });
  t("order moves from To pack to Packed", /packed/i.test(await p.locator("dialog[open] .sheet__top .state").innerText()));
  } else { const st0 = await p.locator("dialog[open] .sheet__top .state").textContent(); await p.locator("[data-next]").tap();   // textContent both sides (the label is upper-cased by CSS in innerText)
    // no keys: the order is a pickup request; marking it ready (2026-11-27) checks the shelf and takes the stock
    const moved = await p.waitForFunction(s => /ready/i.test(document.querySelector("dialog[open] .sheet__top .state")?.textContent || "") && (document.querySelector("dialog[open] .sheet__top .state")?.textContent || s) !== s, st0, { timeout: 8000 }).then(() => true, () => false);
    t("no keys: the pickup order moves along", moved && /ready/i.test(await p.locator("dialog[open] .sheet__top .state").innerText()), st0); await p.waitForTimeout(800); }   // the sheet redraws once the ready email is written
  await p.locator("dialog[open] .sheet__act [data-close]").tap();
  t("the order sheet closes", await p.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 4000 }).then(() => true, () => false));
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
