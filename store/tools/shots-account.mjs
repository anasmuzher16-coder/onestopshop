// Pictures of the account pieces, driven through the real screens: sign in with the emailed code, the account
// with the usual label and points, Save on a product, checkout with the points reward, Buy again into the cart.
// ENGINE=webkit (iPhone profile, 390) or chromium (1440). Needs the store with points on test data and PERSIST
// (codes are read from the local outbox). PERSIST=<dir> BASE=<url> ENGINE=webkit node store/tools/shots-account.mjs <out dir>
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFileSync } from "node:fs";
const pw = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const out = process.argv[2] || ".", B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, ""), ENGINE = process.env.ENGINE || "chromium", PERSIST = process.env.PERSIST;
const KEY = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
const WRANGLER = join(execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["root", "-g"], { encoding: "utf8", shell: process.platform === "win32" }).trim(), "wrangler", "bin", "wrangler.js");
const sql = cmd => { const o = execFileSync(process.execPath, [WRANGLER, "d1", "execute", "onestopshop", "--local", "--persist-to", PERSIST, "--json", "--command", cmd], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); return JSON.parse(o.slice(o.indexOf("["))).flatMap(r => r.results); };
const errs = [], check = (c, msg) => { if (!c) errs.push("FAIL " + msg); };
const b = await pw[ENGINE].launch();
try {
  const ctx = await b.newContext(ENGINE === "webkit" ? { ...pw.devices["iPhone 15"], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(), tag = ENGINE === "webkit" ? "390" : "1440";
  p.on("pageerror", e => errs.push("pageerror: " + e.message)); p.on("console", m => m.type() === "error" && !/interactive-widget/.test(m.text()) && errs.push("console: " + m.text()));
  const shot = async (name, full = true) => { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${tag}-${name}.png`, fullPage: full }); };
  const admin = await p.request.post(B + "/api/admin/login", { data: { passcode: KEY }, headers: { "CF-Connecting-IP": "10.1.1." + (Math.random() * 200 | 0) } });
  const ah = { "X-OSS-Admin": "1", Cookie: (admin.headers()["set-cookie"] || "").split(";")[0] };
  await p.request.put(B + "/api/admin/loyalty", { data: { on: true }, headers: ah });
  // 1 sign in, through the screens
  const email = `shots-${tag}-${Date.now().toString(36)}@example.com`;
  await p.goto(B + "/account", { waitUntil: "networkidle" }); await shot("1-sign-in", false);
  await p.fill("#acct-email", email); await p.click("[data-code-form] button[type=submit]"); await p.waitForSelector("#acct-code");
  await shot("2-code", false);
  const code = (sql(`SELECT body FROM emails WHERE recipient = '${email}' ORDER BY id DESC LIMIT 1`)[0].body.match(/\b(\d{3}) (\d{3})\b/) || []).slice(1).join("");
  await p.fill("#acct-code", code); await p.click("[data-verify-form] button[type=submit]"); await p.waitForSelector(".acct__who");
  await shot("3-account-empty");
  // 2 a history: two charcoal-and-foil style orders, one picked up (its points count), one on the way
  const cat = (await (await p.request.get(B + "/api/catalog")).json()).products;
  const coal = cat.filter(x => x.category_id === "heat" && x.stock >= 5).slice(0, 2), extra = cat.find(x => x.category_id !== "heat" && x.stock >= 3 && x.price_cents >= 4000 && x.price_cents < 12000);
  const place = lines => p.request.post(B + "/api/orders", { data: { name: "Sam Regular", email, phone: "519-555-0144", method: "pickup", lines } }).then(r => r.json());
  const o1 = await place([{ sku: coal[0].sku, qty: 3 }, { sku: extra.sku, qty: 1 }, { sku: coal[1].sku, qty: 1 }]);
  for (const s of ["ready", "collected"]) await p.request.post(B + `/api/admin/orders/${o1.order.id}/status`, { data: { status: s }, headers: ah });
  const o2 = await place([{ sku: coal[0].sku, qty: 2 }, { sku: coal[1].sku, qty: 2 }]);
  await p.request.put(B + "/api/account/details", { data: { name: "Sam Regular", phone: "519-555-0144", address: { line1: "7 D3000 Coal St", city: "Windsor", postal: "N9A 1A1" } }, headers: { "X-OSS-Account": "1" } });
  await p.goto(B + "/shop", { waitUntil: "networkidle" }); await p.goto(B + "/account", { waitUntil: "networkidle" }); await p.waitForSelector(".label");
  check(await p.locator(".ords .ord").count() === 2, "the account lists both orders"); check(await p.locator(".label [data-again]").count() === 1, "the usual label offers Buy again");
  check(/on the way/.test(await p.locator(".label__pts").textContent()), "points on the way are shown");
  check((await p.inputValue("#acct-name")) === "Sam Regular", "saved details fill the form as typed");
  await shot("4-account"); await shot("4-account-fold", false);
  // 3 Save on a product, and the alert on a sold-out one
  await p.goto(B + "/p/" + extra.sku, { waitUntil: "networkidle" }); await p.waitForSelector(".keep__b"); await p.click('.keep__b[data-keep="fav"]');
  await p.locator(".keep").scrollIntoViewIfNeeded(); check((await p.getAttribute('.keep__b[data-keep="fav"]', "aria-pressed")) === "true", "Save turns on"); await shot("5-product-saved", false);
  const sold = cat.find(x => x.stock === 0 && x.category_id !== "heat");
  if (sold) { await p.goto(B + "/p/" + sold.sku, { waitUntil: "networkidle" }); await p.waitForSelector(".keep__b"); await p.locator(".keep").scrollIntoViewIfNeeded(); await shot("6-product-sold", false); }
  // 4 a reward to spend: top the card up by hand, then checkout
  const cid = sql(`SELECT id FROM customers WHERE email = '${email}'`)[0].id; sql(`INSERT INTO loyalty_ledger (customer_id, kind, points, note) VALUES (${cid}, 'adjust', 100, 'screenshots')`);
  await p.goto(B + "/account", { waitUntil: "networkidle" }); await p.waitForSelector(".label"); await shot("7-account-reward", false);
  await p.click(".label [data-again]"); await p.waitForURL(/\/cart$/); check((await p.locator("[data-cart-count]").first().textContent()) !== "0", "Buy again fills the cart"); check(/Your usual is in your cart/.test(await p.locator("main").textContent()), "the cart says the usual is in"); check(await p.locator('input[name="ship"][value="pickup"]:checked').count() === 1, "Buy again keeps the pickup choice"); await shot("8-buy-again-cart");
  const pick = p.locator('input[name="ship"][value="pickup"]'); if (await pick.count()) await p.evaluate(() => { const r = document.querySelector('input[name="ship"][value="pickup"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); });   // the cart redraws on change, so a click-and-verify would race it
  await p.waitForTimeout(500); await p.evaluate(() => { history.pushState(history.state, "", "/checkout"); dispatchEvent(new Event("routechange")); }); await p.waitForSelector("[data-acct-co]"); await p.waitForTimeout(600);
  check(await p.locator(".totals__reward").count() === 1, "checkout shows the points reward"); check((await p.inputValue("#co-email")) === email, "checkout is filled in from the account");
  await shot("9-checkout");
  console.log(JSON.stringify({ engine: ENGINE, email, orders: [o1.order?.id, o2.order?.id], errors: errs }));
} finally { await b.close(); }
process.exit(errs.length ? 1 : 0);
