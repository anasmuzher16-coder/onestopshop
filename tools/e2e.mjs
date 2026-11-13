// End-to-end checks in a phone viewport. Needs `node tools/serve.mjs`. Prints PASS n/n or FAILs; exits non-zero on failure.
import { createRequire } from "node:module";
const { chromium, devices } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const base = process.env.BASE || "http://localhost:4410/";
let n = 0, f = 0; const t = (name, ok, extra = "") => { n++; if (!ok) { f++; console.log("FAIL", name, extra); } };
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices["iPhone 13"] }); const p = await ctx.newPage();
const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
const cents = s => Math.round(parseFloat(s.replace(/[^0-9.]/g, "")) * 100);
await p.goto(base, { waitUntil: "networkidle" });
t("home h1", (await p.locator("h1").count()) === 1);
const cta = await p.locator(".hero__cta .btn").first().boundingBox(), vh = p.viewportSize().height;
t("hero action inside first screen, above the dock", cta && cta.y + cta.height < vh - 64, JSON.stringify(cta));
await p.locator('[data-piece]').first().tap(); await p.waitForURL(/#\/p\//);
t("product h1", (await p.locator("h1").count()) === 1);
const price = cents(await p.locator(".pdp__price").innerText());
await p.locator(".dock__buy").tap(); await p.waitForTimeout(100);
t("dock shows in cart", (await p.locator(".dock__buy").innerText()).includes("View cart"));
t("one unit after add", JSON.parse(await p.evaluate(() => localStorage.getItem("oss:cart")))[0].qty === 1);
await p.locator("[data-open-postal]").first().tap();
await p.fill("#postal", "zzz"); await p.locator('.sheet button[type="submit"]').tap();
t("bad code shows error", await p.locator("#postal-err").isVisible());
await p.fill("#postal", " m5v 2t6"); await p.locator('.sheet button[type="submit"]').tap(); await p.waitForTimeout(150);
t("sheet closed", !(await p.locator("dialog[open]").count()));
const pdpShip = cents(await p.locator(".ledger tbody tr").first().locator("td").last().innerText());
t("estimate shown on product", pdpShip > 0);
await p.goto(base + "#/cart"); await p.waitForTimeout(150);
const rows = await p.locator(".totals dd").allInnerTexts();
t("cart shipping equals product estimate", cents(rows[1]) === pdpShip, rows[1] + " vs " + pdpShip);
t("cart total = items + shipping", cents(rows[0]) + cents(rows[1]) === cents(rows[2]), rows.join(" | "));
t("items = price", cents(rows[0]) === price);
const parts = await p.locator(".why dd").allTextContents();
t("breakdown sums to shipping", parts.reduce((a, x) => a + cents(x), 0) === cents(rows[1]), parts.join("+"));
await p.locator('[data-qty][aria-label^="One more"]').tap(); await p.waitForTimeout(100);
const r2 = await p.locator(".totals dd").allInnerTexts();
t("qty 2 doubles items", cents(r2[0]) === price * 2); t("qty 2 total adds up", cents(r2[0]) + cents(r2[1]) === cents(r2[2]));
await p.locator('input[name="ship"]').nth(2).check(); await p.waitForTimeout(100);
const r3 = await p.locator(".totals dd").allInnerTexts();
t("second option changes shipping and still adds up", cents(r3[1]) > cents(r2[1]) && cents(r3[0]) + cents(r3[1]) === cents(r3[2]));
for (const bad of ["null", "{}", '"x"', '[{"sku":"OSS-1027","qty":-3}]', '[{"sku":"NOPE","qty":2}]', '[{"sku":"OSS-1027","qty":1e9}]']) {
  await p.evaluate(v => localStorage.setItem("oss:cart", v), bad); await p.reload({ waitUntil: "networkidle" });
  t("survives cart=" + bad, (await p.locator("h1").count()) === 1 && !(await p.locator("#main").innerText()).includes("NaN") && !(await p.locator("#main").innerText()).includes("-$"));
}
for (const r of ["#/", "#/shop", "#/shop/bowls", "#/p/OSS-1006", "#/p/NOPE", "#/nope", "#/shipping"]) {
  await p.goto(base + r, { waitUntil: "networkidle" }); await p.reload({ waitUntil: "networkidle" });
  t("route " + r + " renders one h1", (await p.locator("h1").count()) === 1);
  t("route " + r + " no sideways scroll", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
t("no console errors", errs.length === 0, errs.slice(0, 3).join(" ; "));
await b.close(); console.log(f ? "FAIL " + f + "/" + n : "PASS " + n + "/" + n); process.exit(f ? 1 : 0);
