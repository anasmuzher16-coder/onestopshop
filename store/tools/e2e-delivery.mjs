// Local delivery in a real browser, phone and desktop, Chrome and Safari's engine. Needs the store on 4420 with the stand-in
// map service. Changes local sample data. node store/tools/e2e-delivery.mjs [screenshotDir]
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const pw = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420", shots = process.argv[2], KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
let run = Date.now() % 100000;
for (const [engine, w, h, mobile] of [["chromium", 390, 844, true], ["webkit", 390, 844, true], ["chromium", 1440, 900, false], ["webkit", 1440, 900, false]]) {
  run++; const b = await pw[engine].launch(), tag = `${engine}-${w}`, errs = [];
  try {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(engine === "chromium" ? { isMobile: mobile } : {}), hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    const snap = async name => { if (shots) await p.screenshot({ path: `${shots}/${tag}-${name}.png`, fullPage: true }); };
    const press = l => l.click();
    await p.goto(B + "/p/OSS-8004", { waitUntil: "networkidle" }); await press(p.locator("[data-add]:visible").first()); await p.waitForTimeout(900);
    await p.goto(B + "/cart", { waitUntil: "networkidle" });
    const postal = async code => { await press(p.locator("[data-open-postal]:visible").first()); await p.fill("#postal", code); await press(p.locator('[data-postal-form] button[type="submit"]')); await p.waitForFunction(() => !/Checking delivery/.test(document.querySelector("#main")?.textContent || ""), null, { timeout: 12000 }); await p.waitForTimeout(250); };
    await postal("N8M 1A8");
    t(`${tag} too far: no delivery option, says so, Canada Post offered`, await p.locator('input[name="ship"][value="local"]').count() === 0 && /past our 25 km/.test(await p.locator(".cartship").innerText()) && await p.locator('input[name="ship"][value="cp-exp"]').count() === 1);
    await snap("too-far");
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
    t(`${tag} checkout already shows the exact fee`, /\$10\.00/.test(await p.locator(".totals").innerText()) && /Place order/.test(await go.innerText()));
    await p.fill("#co-name", "Dee Livery"); await p.fill("#co-email", "dee@example.com"); await p.fill("#co-city", "Windsor"); await p.fill("#co-line1", `7 D30000 ${run} St`); await p.fill("#co-phone", "519-555-0101");
    await press(go); await p.waitForSelector("[data-local-off]");
    t(`${tag} an address past 25 km is refused plainly`, /past our 25 km/.test(await p.locator("[data-deliv-msg]").innerText()));
    await snap("far");
    await p.fill("#co-line1", `7 D12500 ${run} St`); await press(go);
    await p.waitForFunction(() => /\$15\.00/.test(document.querySelector(".totals")?.textContent || ""));
    t(`${tag} a street that costs more shows the new price before ordering`, /\$15\.00/.test(await p.locator(".totals").innerText()) && new URL(p.url()).pathname === "/checkout");
    t(`${tag} no sideways scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await snap("checkout");
    const final = await p.locator(".totals__door dd").innerText();
    await press(go); await p.waitForURL(/\/order\/W[A-Z0-9]{6}$/, { timeout: 15000 }); await p.waitForTimeout(900);
    t(`${tag} confirmation total matches`, (await p.locator(".totals__door dd").innerText()) === final);
    t(`${tag} no tracking promise`, !/tracking/i.test(await p.locator("#main").innerText()));
    await snap("done");
    const id = new URL(p.url()).pathname.split("/").pop();
    await p.goto(B + "/admin", { waitUntil: "networkidle" }); if (await p.locator("#passcode").count()) { await p.fill("#passcode", KEY); await press(p.locator('button[type="submit"]')); } await p.waitForSelector(".hero__fig");
    await press(p.locator('[data-tab="orders"]')); await press(p.locator(`[data-order="${id}"]`)); await p.waitForSelector("dialog[open] [data-next]");
    const sheet = await p.locator("dialog[open]").innerText();
    t(`${tag} back office shows address and phone`, sheet.includes(`7 D12500 ${run} St`) && sheet.includes("519-555-0101") && /Local delivery/.test(sheet), sheet.slice(0, 200));
    await snap("admin");
    await press(p.locator("[data-next]")); await p.waitForFunction(() => /Mark out for delivery/.test(document.querySelector("dialog[open] [data-next]")?.textContent || ""), null, { timeout: 8000 });
    await ctx.close();
  } catch (e) { t(`${tag} finished the journey`, false, String(e.message).slice(0, 300)); } finally { await b.close(); }
  t(`${tag} no page errors`, !errs.length, errs.slice(0, 2).join(" | "));
}
console.log(f ? `FAIL ${f}/${n}` : `PASS ${n}/${n}`); process.exit(f ? 1 : 0);
