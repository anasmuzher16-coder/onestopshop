// Local delivery in a real browser, phone and desktop, Chrome and Safari's engine. Needs the store on 4420 with the stand-in
// map service. Changes local sample data. node store/tools/e2e-delivery.mjs [screenshotDir]
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const pw = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420", shots = process.argv[2], KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
// Card orders go to Stripe's page (the local stand-in, tools/fake-stripe.mjs): pay there, come back, wait for the signed webhook.
const payThrough = async (p, timeout = 15000) => { await p.waitForURL(u => /\/pay\/cs_/.test(String(u)) || /\/order\/W[A-Z0-9]{6}$/.test(String(u)), { timeout }); if (/\/pay\/cs_/.test(p.url())) { await p.locator("[data-fake-pay]").click(); await p.waitForURL(/\/order\/W[A-Z0-9]{6}$/, { timeout }); await p.waitForSelector('[data-pay-state="paid"]', { timeout }); } };
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
// With no card keys (the live demo) delivery and shipping cannot be ordered: the page says so with the shop's number, and a
// pickup is ordered and paid at the counter instead
const CARD = /<meta name="oss-pay" content="card">/.test(await (await fetch(B + "/")).text());
let run = Date.now() % 100000;
// Each engine buys five of the test piece, so make sure the sample shelf has enough before starting.
{ const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) }), Cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  const stocked = await fetch(B + "/api/admin/products/OSS-8004/stock", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie }, body: JSON.stringify({ delta: 40, reason: "count" }) });
  if (!stocked.ok) { console.log("FAIL could not stock the test piece", stocked.status, await stocked.text()); process.exit(1); } }
for (const [engine, w, h, mobile] of [["chromium", 390, 844, true], ["webkit", 390, 844, true], ["chromium", 1440, 900, false], ["webkit", 1440, 900, false]]) {
  run++; const b = await pw[engine].launch(), tag = `${engine}-${w}`, errs = [];
  try {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(engine === "chromium" ? { isMobile: mobile } : {}), hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    // a capture for a person to look at, not a check: a page taller than WebKit can photograph in one piece (32,767 px; the
    // 83 hookah families since 2026-11-24) is captured to the first screen instead of failing the journey
    const snap = async name => { if (!shots) return; try { await p.screenshot({ path: `${shots}/${tag}-${name}.png`, fullPage: true }); } catch (e) { if (!/32767/.test(String(e))) throw e; await p.screenshot({ path: `${shots}/${tag}-${name}.png` }); } };
    const press = l => l.click();
    // the chooser: first arrival on the hookah page, no layout shift, nothing covered, X and both answers remembered
    await p.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {} });
    await p.goto(B + "/shop/hookahs", { waitUntil: "networkidle" }); await p.waitForTimeout(600);
    const opts = p.locator(".dchoose__opt");
    t(`${tag} chooser shows LOCAL and NATIONWIDE`, await opts.count() === 2 && await opts.nth(0).isVisible() && /LOCAL DELIVERY/i.test(await opts.nth(0).innerText()) && /NATIONWIDE DELIVERY/i.test(await opts.nth(1).innerText()));
    t(`${tag} nationwide says Canada except Quebec, not anywhere in Canada`, /except Quebec/i.test(await opts.nth(1).innerText()) && !/anywhere in Canada(?! except)/i.test(await p.locator("body").innerText()));
    const geo = await p.evaluate(() => ({ strip: document.querySelector(".dstrip").getBoundingClientRect().bottom, card: document.querySelector(".card").getBoundingClientRect().top, sizes: [...document.querySelectorAll(".dchoose__opt,.dstrip__x")].map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }), wide: document.documentElement.scrollWidth <= innerWidth, cls: window.__cls ?? 0, pos: getComputedStyle(document.querySelector(".dstrip")).position }));
    t(`${tag} chooser is above the products, in the page flow`, geo.strip <= geo.card && geo.pos === "relative", JSON.stringify(geo));
    t(`${tag} chooser targets are at least 44px`, geo.sizes.every(s => s >= 44), geo.sizes.join(","));
    t(`${tag} chooser: no sideways scroll`, geo.wide);
    if (engine === "chromium") t(`${tag} chooser: no layout shift`, geo.cls < 0.01, String(geo.cls));
    await snap("chooser");
    await press(p.locator("[data-strip-close]")); t(`${tag} X closes the chooser`, await p.locator(".dchoose").isHidden());
    await p.reload({ waitUntil: "networkidle" }); t(`${tag} X is remembered`, await p.locator("[data-delivery-strip]").isHidden());
    const fresh = async () => p.evaluate(() => localStorage.clear()).then(() => p.goto(B + "/shop", { waitUntil: "networkidle" }));
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem("oss:strip-off", "true"); }); await p.goto(B + "/shop", { waitUntil: "networkidle" });
    t(`${tag} closing the small strip elsewhere still leaves the chooser on the shop`, await p.locator(".dchoose").isVisible());
    await fresh(); await press(p.locator('[data-reach="local"]'));
    t(`${tag} local path has local wording`, /deliver/i.test(await p.locator("#sheet-h").innerText()) && /\$200/.test(await p.locator(".sheet__p").innerText()));
    await p.fill("#postal", "M5V 2T6"); await press(p.locator('[data-postal-form] button[type="submit"]'));
    t(`${tag} local path refuses a far postal code and offers shipping`, /past our local delivery area/.test(await p.locator("#postal-err").innerText()) && /ship/i.test(await p.locator("#sheet-h").innerText()));
    await p.fill("#postal", "N9A 1A1"); await press(p.locator('[data-postal-form] button[type="submit"]')); await p.waitForTimeout(400);
    t(`${tag} local answer closes the chooser`, await p.locator("[data-delivery-strip]").isHidden());
    t(`${tag} a corrected typo stays a local choice`, await p.evaluate(() => JSON.parse(localStorage.getItem("oss:reach"))) === "local");
    await p.reload({ waitUntil: "networkidle" }); t(`${tag} local answer is remembered`, await p.locator("[data-delivery-strip]").isHidden());
    await fresh(); await press(p.locator('[data-reach="nationwide"]'));
    t(`${tag} nationwide path has shipping wording`, /ship/i.test(await p.locator("#sheet-h").innerText()) && /Canada Post/.test(await p.locator(".sheet__p").innerText()));
    await p.fill("#postal", "N9A 1A1"); await press(p.locator('[data-postal-form] button[type="submit"]')); await p.waitForTimeout(400);
    t(`${tag} nationwide answer closes the chooser`, await p.locator("[data-delivery-strip]").isHidden());
    await p.evaluate(() => localStorage.setItem("oss:cart", JSON.stringify([{ sku: "OSS-8004", qty: 1 }]))); await p.goto(B + "/cart", { waitUntil: "networkidle" }); await p.waitForSelector('input[name="ship"][value="local"]');
    t(`${tag} nationwide never preselects local`, !(await p.locator('input[name="ship"][value="local"]').isChecked()) && await p.locator('input[name="ship"]:checked').count() === 1 && /^cp-/.test(await p.locator('input[name="ship"]:checked').getAttribute("value")));
    // $200 and over is free in the cart and at checkout; under $200 says how the rule works
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem("oss:postal", JSON.stringify("N9A 1A1")); localStorage.setItem("oss:cart", JSON.stringify([{ sku: "OSS-8004", qty: 3 }])); });
    await p.goto(B + "/cart", { waitUntil: "networkidle" }); await p.waitForSelector('input[name="ship"][value="local"]');
    t(`${tag} under $200 pays and is told the rule`, /\$10\.00/.test(await p.locator(".opts").innerText()) && /free on orders of \$200 or more/i.test(await p.locator("[data-free-note]").innerText()) && /Add \$38\.00 more/.test(await p.locator("[data-free-note]").innerText()));
    await p.evaluate(() => localStorage.setItem("oss:cart", JSON.stringify([{ sku: "OSS-8004", qty: 4 }]))); await p.reload({ waitUntil: "networkidle" }); await p.waitForSelector('input[name="ship"][value="local"]');
    t(`${tag} $200 or more shows Free in the cart`, /Local delivery[\s\S]*Free/.test(await p.locator(".opts").innerText()) && /Delivery\s*Free/.test(await p.locator(".totals").innerText()));
    await p.goto(B + "/checkout", { waitUntil: "networkidle" }); await p.waitForSelector("[data-checkout]");
    t(`${tag} $200 or more shows Free at checkout`, /Delivery\s*Free/.test(await p.locator(".totals").innerText()));
    await p.fill("#co-name", "Dee Livery"); await p.fill("#co-email", "dee@example.com"); await p.fill("#co-city", "Windsor"); await p.fill("#co-line1", `7 D3000 ${run} St`); await p.fill("#co-phone", "519-555-0101");
    if (CARD) {
      await press(p.locator('[data-checkout] button[type="submit"]')); await payThrough(p, 15000); await p.waitForTimeout(500);
      t(`${tag} order page shows Free and arrival wording`, /Delivery\s*Free/.test(await p.locator(".totals").innerText()) && /Arrives /.test(await p.locator("#main").innerText()));
    } else t(`${tag} no keys: delivery cannot be paid yet, and the page gives the shop's number`, await p.locator('[data-checkout] button[type="submit"]').isDisabled() && /not switched on[\s\S]*519-255-2222/.test(await p.locator(".co__pay").innerText()));
    // after hours: Sunday 8 pm in Windsor, the shop closed at 7
    // A separate context: a frozen clock must not leak into the rest of the journey.
    { const later = await b.newContext({ viewport: { width: w, height: h }, ...(engine === "chromium" ? { isMobile: mobile } : {}), hasTouch: mobile }), q = await later.newPage();
      await q.addInitScript(() => { localStorage.setItem("oss:postal", JSON.stringify("N9A 1A1")); localStorage.setItem("oss:cart", JSON.stringify([{ sku: "OSS-8004", qty: 1 }])); });
      await q.clock.setFixedTime(new Date("2026-11-23T01:00:00Z"));
      await q.goto(B + "/cart", { waitUntil: "domcontentloaded" }); await q.waitForSelector('input[name="ship"][value="local"]', { state: "attached" });
      const words = await q.locator(".opts").innerText(); t(`${tag} after closing says tomorrow morning`, /Arrives tomorrow morning/.test(words) && !/25 minutes/.test(words), words.slice(0, 120));
      await q.clock.setFixedTime(new Date("2026-11-23T16:00:00Z")); await q.reload({ waitUntil: "domcontentloaded" }); await q.waitForSelector('input[name="ship"][value="local"]', { state: "attached" });
      t(`${tag} while open says 25 minutes to 1 hour`, /Arrives in about 25 minutes to 1 hour/.test(await q.locator(".opts").innerText()));
      await later.close(); }
    await p.goto(B + "/shipping", { waitUntil: "networkidle" });
    { const words = await p.locator("#main").innerText(); t(`${tag} shipping page: store manager, final sale, no pay at door`, /talk to the store manager/.test(words) && /All sales are final/.test(words) && !/send a photo|\bcash\b|at the door/i.test(words)); }
    await p.goto(B + "/terms", { waitUntil: "networkidle" });
    { const words = await p.locator("#main").innerText(); t(`${tag} terms: draft marker, final sale, store manager`, /for the shop to review/i.test(words) && /All sales are final/.test(words) && /talk to the store manager/.test(words) && !/take a photo|within 14 days for a refund|\bcash\b/i.test(words)); }
    { const terms = await p.locator("#main").innerText(); await p.goto(B + "/shipping", { waitUntil: "networkidle" }); const words = terms + " " + await p.locator("#main").innerText();
      t(`${tag} terms and shipping: final sale keeps the legal carve-outs, no Quebec shipping yet, nothing about ID or age`, /All sales are final, except faulty, wrong, damaged or undelivered items/.test(words) && /except (to )?Quebec/.test(words) && !/\bID\b|\bage\b|\b19\+|\bminimum age/i.test(words)); }
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem("oss:strip-off", "true"); });
    await p.goto(B + "/p/OSS-8004", { waitUntil: "networkidle" }); await press(p.locator("[data-add]:visible").first()); await p.waitForTimeout(900);
    await p.goto(B + "/cart", { waitUntil: "networkidle" });
    const postal = async code => { await press(p.locator("[data-open-postal]:visible").first()); await p.fill("#postal", code); await press(p.locator('[data-postal-form] button[type="submit"]')); await p.waitForFunction(() => !/Checking delivery/.test(document.querySelector("#main")?.textContent || ""), null, { timeout: 12000 }); await p.waitForTimeout(250); };
    await postal("N8M 1A8");
    t(`${tag} too far: no delivery option, says so, Canada Post offered`, await p.locator('input[name="ship"][value="local"]').count() === 0 && /past our 25 km/.test(await p.locator(".cartship").innerText()) && await p.locator('input[name="ship"][value="cp-exp"]').count() === 1);
    await snap("too-far");
    await p.goto(B + "/checkout", { waitUntil: "networkidle" }); await p.waitForSelector("[data-checkout]", { timeout: 12000 });
    t(`${tag} past 25 km can still check out by Canada Post`, /Canada Post/.test(await p.locator("[data-checkout]").innerText()));
    await p.goto(B + "/cart", { waitUntil: "networkidle" });
    await postal("N8N 1W9");
    t(`${tag} 10 to 25 km shows exactly $15`, /Local delivery[\s\S]*\$15\.00/.test(await p.locator(".opts").innerText()) && !/\$10 or \$15/.test(await p.locator("#main").innerText()));
    await postal("N9A 1A1");
    const ways = await p.locator('input[name="ship"]').evaluateAll(e => e.map(x => x.value));
    t(`${tag} delivery is listed first, pickup second`, ways[0] === "local" && ways[1] === "pickup", ways.join(","));
    t(`${tag} delivery is preselected`, await p.locator('input[name="ship"][value="local"]').isChecked());
    t(`${tag} up to 10 km shows exactly $10`, /Local delivery[\s\S]*\$10\.00/.test(await p.locator(".opts").innerText()) && !/\$10 or \$15/.test(await p.locator("#main").innerText()));
    await p.waitForTimeout(500); await snap("cart");
    await p.goto(B + "/checkout", { waitUntil: "networkidle" }); await p.waitForSelector("[data-checkout]");
    const go = p.locator('[data-checkout] button[type="submit"]');
    if (!CARD) {
      // no card keys: the exact fee is shown but delivery cannot be ordered; the same cart picked up is ordered and paid at the counter
      t(`${tag} no keys: checkout shows the exact fee, delivery cannot be ordered, the shop's number is given`, /\$10\.00/.test(await p.locator(".totals").innerText()) && await go.isDisabled() && /519-255-2222/.test(await p.locator(".co__pay").innerText()));
      await p.goto(B + "/cart", { waitUntil: "networkidle" }); await p.locator('input[name="ship"][value="pickup"]').check({ force: true }); await p.waitForTimeout(400);
      await p.goto(B + "/checkout", { waitUntil: "networkidle" }); await p.waitForSelector("[data-checkout]");
      t(`${tag} no keys: a pickup is paid at the counter`, /At the counter when you pick it up/.test(await p.locator(".co__pay").innerText()) && await go.isEnabled());
      await p.fill("#co-name", "Dee Livery"); await p.fill("#co-email", "dee@example.com"); if (await p.locator("#co-phone").isVisible()) await p.fill("#co-phone", "519-555-0101");
      await press(go); await p.waitForURL(/\/order\/W[A-Z0-9]{6}$/, { timeout: 15000 }); await p.waitForTimeout(600);
      t(`${tag} no keys: the pickup order is placed, to pay at the counter`, /counter/i.test(await p.locator("#main").innerText()) && !/tracking/i.test(await p.locator("#main").innerText()));
      await snap("done");
      const id = new URL(p.url()).pathname.split("/").pop();
      await p.goto(B + "/admin", { waitUntil: "networkidle" }); if (await p.locator("#passcode").count()) { await p.fill("#passcode", KEY); await press(p.locator('button[type="submit"]')); } await p.waitForSelector(".hero__fig");
      await press(p.locator('[data-tab="orders"]')); await press(p.locator(`[data-order="${id}"]`)); await p.waitForSelector("dialog[open]");
      t(`${tag} no keys: the back office has the pickup order, to be paid at the counter`, /Dee Livery/.test(await p.locator("dialog[open]").innerText()) && /counter/i.test(await p.locator("dialog[open]").innerText()));
      await ctx.close(); t(`${tag} no page errors`, !errs.length, errs.slice(0, 2).join(" | ")); continue;   // the browser closes in finally
    }
    t(`${tag} checkout already shows the exact fee`, /\$10\.00/.test(await p.locator(".totals").innerText()) && /^Pay \$/.test(await go.innerText()));
    await p.fill("#co-name", "Dee Livery"); await p.fill("#co-email", "dee@example.com"); await p.fill("#co-city", "Windsor"); await p.fill("#co-line1", `7 D30000 ${run} St`); await p.fill("#co-phone", "519-555-0101");
    await press(go); await p.waitForSelector("[data-local-off]");
    t(`${tag} an address past 25 km is refused plainly`, /past our 25 km/.test(await p.locator("[data-deliv-msg]").innerText()));
    await snap("far");
    await p.fill("#co-line1", `7 LZ12500W13500 ${run} St`); await press(go);
    await p.waitForFunction(() => /\$15\.00/.test(document.querySelector(".totals")?.textContent || ""));
    t(`${tag} a street that costs more shows the new price before ordering`, /\$15\.00/.test(await p.locator(".totals").innerText()) && new URL(p.url()).pathname === "/checkout");
    t(`${tag} no sideways scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await snap("checkout");
    const final = await p.locator(".totals__door dd").innerText();
    await press(go); await payThrough(p, 15000); await p.waitForTimeout(900);
    t(`${tag} confirmation total matches`, (await p.locator(".totals__door dd").innerText()) === final);
    t(`${tag} no tracking promise`, !/tracking/i.test(await p.locator("#main").innerText()));
    await snap("done");
    const id = new URL(p.url()).pathname.split("/").pop();
    await p.goto(B + "/admin", { waitUntil: "networkidle" }); if (await p.locator("#passcode").count()) { await p.fill("#passcode", KEY); await press(p.locator('button[type="submit"]')); } await p.waitForSelector(".hero__fig");
    await press(p.locator('[data-tab="orders"]')); await press(p.locator(`[data-order="${id}"]`)); await p.waitForSelector("dialog[open] [data-next]");
    const sheet = await p.locator("dialog[open]").innerText();
    t(`${tag} back office shows address and phone`, sheet.includes(`7 LZ12500W13500 ${run} St`) && sheet.includes("519-555-0101") && /Local delivery/.test(sheet), sheet.slice(0, 200));
    t(`${tag} back office shows the road distance`, /Road distance: 13\.5 km/.test(sheet), sheet.slice(0, 300));
    { const call = p.locator('dialog[open] .drop a[href^="tel:"]'), map = p.locator('dialog[open] .drop a[href^="https://www.google.com/maps/search/"]'), h = await call.evaluate(e => e.getBoundingClientRect().height); t(`${tag} back office has a big call button and a map link`, await call.getAttribute("href") === "tel:5195550101" && h >= 48 && await map.count() === 1, String(h)); }
    await snap("admin");
    await press(p.locator("[data-next]")); await p.waitForFunction(() => /Mark out for delivery/.test(document.querySelector("dialog[open] [data-next]")?.textContent || ""), null, { timeout: 8000 });
    await ctx.close();
  } catch (e) { t(`${tag} finished the journey`, false, String(e.message).slice(0, 300)); } finally { await b.close(); }
  t(`${tag} no page errors`, !errs.length, errs.slice(0, 2).join(" | "));
}
console.log(f ? `FAIL ${f}/${n}` : `PASS ${n}/${n}`); process.exit(f ? 1 : 0);
