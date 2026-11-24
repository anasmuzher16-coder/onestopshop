// Regression checks for the 2026-11-23 audit: buying and trust. Needs the store and tools/fake-geoapify.mjs running.
// node store/tools/e2e-buying.mjs   (changes local sample data: reseed afterwards)
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
// Card orders go to Stripe's page (the local stand-in, tools/fake-stripe.mjs): pay there, come back, wait for the signed webhook.
const payThrough = async (p, timeout = 15000) => { await p.waitForURL(u => /\/pay\/cs_/.test(String(u)) || /\/order\/W[A-Z0-9]{6}$/.test(String(u)), { timeout }); if (/\/pay\/cs_/.test(p.url())) { await p.locator("[data-fake-pay]").click(); await p.waitForURL(/\/order\/W[A-Z0-9]{6}$/, { timeout }); await p.waitForSelector('[data-pay-state="paid"]', { timeout }); } };
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
const b = await chromium.launch();
const open = async (seed = {}, clock) => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const p = await c.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(e.message));
  if (clock) await p.clock.setFixedTime(new Date(clock));
  await p.goto(B + "/terms", { waitUntil: "domcontentloaded" });
  await p.evaluate(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem("oss:" + k, typeof v === "string" && v.startsWith("RAW:") ? v.slice(4) : JSON.stringify(v)); }, seed);
  return { c, p };
};
const go = async (p, path) => { await p.goto(B + path, { waitUntil: "domcontentloaded" }); await p.waitForSelector("#main > *"); await p.waitForTimeout(450); };
const main = p => p.locator("#main").innerText();
const cart = p => p.evaluate(() => JSON.parse(localStorage.getItem("oss:cart") || "[]"));
try {
  { // 1 a shopper who chose nationwide, then gives a Windsor code, sees local delivery first
    const { c, p } = await open({ cart: [{ sku: "OSS-8004", qty: 1 }], postal: "M5V 2T6", reach: "nationwide", ship: "cp-exp" });
    await go(p, "/cart"); await p.locator("legend [data-open-postal]").click(); await p.fill("#postal", "N9A 1A1"); await p.locator('[data-postal-form] button[type="submit"]').click();
    await p.waitForSelector('input[name="ship"][value="local"]'); await p.waitForTimeout(300);
    t("1 Windsor code moves a nationwide shopper to local delivery", await p.locator('input[name="ship"][value="local"]').isChecked());
    await c.close();
  }
  { // 2 and 3 stock limits; a sold-out flavour cannot be bought from any saved cart (the sample Resin Bishop was retired 2026-11-24)
    const { c, p } = await open({ cart: [{ sku: "OSS-9616", qty: 2 }, { sku: "OSS-8004", qty: 1 }, { sku: "OSS-7008", qty: 1 }, { sku: "OSS-7006", qty: 5 }], postal: "M5V 2T6" });
    await go(p, "/cart"); const body = await main(p), saved = await cart(p);
    t("3 a saved sold-out flavour is taken out", !saved.some(l => l.sku === "OSS-9616") && !/English Master, 250 g\s*\n\s*OSS/.test(body), JSON.stringify(saved));
    t("3 the cart says the flavour has sold", /English Master, 250 g has sold/.test(await p.locator("[data-cart-news]").innerText()));
    t("2 a sold-out line is taken out", !saved.some(l => l.sku === "OSS-7008"));
    const one = saved.find(l => l.sku === "OSS-7006");
    t("2 a one-of-one cannot exceed its stock", one && one.qty === 1, JSON.stringify(one));
    t("2 the plus button stops at the stock", await p.locator('[data-qty="OSS-7006"][aria-label^="One more"]').isDisabled());
    await go(p, "/p/OSS-9616"); t("3 the sold-out page has no add button", await p.locator("[data-add]").count() === 0);
    await go(p, "/p/OSS-100024"); t("3 a Price TBD hookah has no add button", await p.locator("[data-add]").count() === 0 && !(await cart(p)).some(l => l.sku === "OSS-100024"));
    await p.evaluate(() => document.dispatchEvent(new CustomEvent("x"))); await c.close();
  }
  { // 6 two tabs share one cart
    const { c, p } = await open({ cart: [{ sku: "OSS-8004", qty: 1 }] }); await go(p, "/cart");
    const q = await c.newPage(); await go(q, "/p/OSS-5001"); await q.locator(".dock__buy").click(); await q.waitForTimeout(250);
    t("6 the other tab shows the new item", (await p.locator(".line__name").count()) === 2);
    await p.locator('[data-qty="OSS-8004"][aria-label^="One more"]').click(); await p.waitForTimeout(150);
    t("6 editing here keeps the other tab's item", (await cart(p)).some(l => l.sku === "OSS-5001")); await c.close();
  }
  { // 9 a set near Windsor is not quoted Canada Post
    const { c, p } = await open({ postal: "N9A 1A1" }); await go(p, "/set"); await p.waitForTimeout(500);
    const sum = await p.locator("[data-set-summary] .totals").innerText();
    t("9 set shows local delivery for a Windsor code", /Delivery to N9A 1A1/.test(sum) && !/^Shipping/m.test(sum), sum); await c.close();
  }
  { // 10 after closing, pickup is not today (Sunday 8 pm in Windsor, closed at 7)
    const { c, p } = await open({ cart: [{ sku: "OSS-8004", qty: 1 }], postal: "M5V 2T6" }, "2026-11-23T01:00:00Z");
    await go(p, "/cart"); t("10 cart says ready tomorrow", /Ready tomorrow/.test(await p.locator(".opts").innerText()));
    await go(p, "/p/OSS-8004"); t("10 product says tomorrow", /Pick up at[\s\S]*Tomorrow/.test(await p.locator(".ledger").innerText())); await c.close();
  }
  { // 11 sold pieces are not promoted
    const { c, p } = await open(); await go(p, "/");
    t("11 home picks hold no sold piece and stay full", await p.locator(".shelf .grid .sticker--sold").count() === 0 && await p.locator(".shelf .grid .card").count() === 8);
    for (const r of ["/gifts/under-50", "/gifts/under-150"]) { await go(p, r); t("11 no sold piece on " + r, await p.locator(".sticker--sold").count() === 0); }
    await c.close();
  }
  { // 12 a missing order is not dressed as a real one
    const { c, p } = await open(); await go(p, "/order/WABC234"); const body = await main(p);
    t("12 missing order says so", /cannot show that order/i.test(body) && !/Test order|WABC234/.test(body), body.slice(0, 120)); await c.close();
  }
  { // 13 a damaged saved cart cannot blank the page
    for (const sku of ["constructor", "__proto__"]) { const { c, p } = await open({ cart: "RAW:" + JSON.stringify([{ sku, qty: 1 }]) }); await go(p, "/cart");
      t("13 bad saved cart still shows the cart: " + sku, /Your cart/.test(await main(p)) && !p.errs.length, p.errs[0] || ""); await c.close(); }
  }
  { // 5 the answer is lost after the shop placed the order: the retry returns that order, once
    const { c, p } = await open({ cart: [{ sku: "OSS-8003", qty: 1 }] }); let sends = 0, keys = new Set();
    await c.route("**/api/orders", async r => { sends++; keys.add(r.request().postDataJSON().order_key); if (sends === 1) { await r.fetch(); return r.abort("connectionreset"); } return r.continue(); });
    await go(p, "/cart"); await p.locator('input[name="ship"][value="pickup"]').check(); await p.waitForTimeout(150); await go(p, "/checkout");
    await p.fill("#co-name", "Lost Answer"); await p.fill("#co-email", "lost@example.com");
    await p.locator('[data-checkout] button[type="submit"]').click(); await p.waitForSelector("[data-co-err]:not([hidden])");
    await p.locator('[data-checkout] button[type="submit"]').click(); await payThrough(p, 10000);
    t("5 the retry used the same order key", sends === 2 && keys.size === 1, `${sends} sends, ${keys.size} keys`); await c.close();
  }
  { // 4 the server's new total replaces the one on screen before anything is placed
    const { c, p } = await open({ cart: [{ sku: "OSS-8003", qty: 1 }] }); let hit = 0;
    await c.route("**/api/orders", r => { hit++; if (hit > 1) return r.continue(); return r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "The total is now $99.99. Check it, then place your order.", repriced: { subtotal_cents: 8000, shipping_cents: 0, tax_cents: 1999, total_cents: 9999 } }) }); });
    await go(p, "/cart"); await p.locator('input[name="ship"][value="pickup"]').check(); await p.waitForTimeout(150); await go(p, "/checkout");
    await p.fill("#co-name", "New Total"); await p.fill("#co-email", "total@example.com"); await p.locator('[data-checkout] button[type="submit"]').click(); await p.waitForSelector("[data-co-err]:not([hidden])");
    t("4 the new total is on screen", /\$99\.99/.test(await p.locator(".totals__door").innerText()) && /\$99\.99/.test(await p.locator("[data-co-err]").innerText())); await c.close();
  }
} finally { await b.close(); }
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
