// The section swap in steps (app.js "the first screen first"), in Chromium and WebKit, against a running local store:
// after an in-site tap on a long section the cards fill in with none lost, duplicated or reordered (same as a direct load),
// aria-busy and the wave's hold (data-swapping) are cleared, the desktop filter rail is in with the first screen, the first
// screen's cards are in before the wave leaves, and Back to a card far down the list lands on that card.
//   BASE=http://127.0.0.1:4493 node store/tools/test-chunk.mjs
import { createRequire } from "node:module";
const { chromium, webkit } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const tap = (p, h) => p.evaluate(h => { const a = document.createElement("a"); a.href = h; document.body.append(a); a.click(); a.remove(); }, h);
const filled = (p, s) => p.waitForFunction(s => document.querySelector(`#main .shophead[data-cat="${s}"]`) && !document.querySelector("#main [data-later]") && !document.querySelector("#main[aria-busy]") && !document.documentElement.hasAttribute("data-swapping"), s, { timeout: 15000 }).then(() => true, () => false);
const skus = p => p.evaluate(() => [...document.querySelectorAll("#main .card [data-piece]")].map(a => a.dataset.piece));
// counts what is in #main at the moment the wave is let go (data-swapping cleared)
const watchLeave = (p, sel) => p.evaluate(sel => { window.__atLeave = null; let seen = false; new MutationObserver((m, o) => { const on = document.documentElement.hasAttribute("data-swapping"); if (on) seen = true; else if (seen) { window.__atLeave = document.querySelectorAll(sel).length; o.disconnect(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-swapping"] }); }, sel);
for (const eng of [chromium, webkit]) {
  const b = await eng.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  for (const sec of ["hookahs", "charcoal", "shisha"]) {
    await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(700);
    await watchLeave(p, "#main .card");
    await tap(p, "/shop/" + sec);
    const done = await filled(p, sec), got = await skus(p), atLeave = await p.evaluate(() => window.__atLeave);
    await p.goto(B + "/shop/" + sec, { waitUntil: "load" }); const direct = await skus(p);
    ok(done, `${eng.name()} ${sec}: the section fills in and clears aria-busy and the wave's hold`);
    ok(got.length === direct.length && JSON.stringify(got) === JSON.stringify(direct) && new Set(got).size === got.length, `${eng.name()} ${sec}: ${got.length} cards, the same and in the same order as a direct load (${direct.length})`);
    ok(atLeave === null || atLeave >= 4, `${eng.name()} ${sec}: the first screen's cards are in before the wave leaves (${atLeave})`);
  }
  await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(500);
  await tap(p, "/shop/hookahs"); await filled(p, "hookahs");
  await p.evaluate(() => scrollTo(0, 6000)); await p.waitForTimeout(600);
  const pick = await p.evaluate(() => { const a = [...document.querySelectorAll("#main a[data-piece]")].find(x => { const r = x.getBoundingClientRect(); return r.top > 200 && r.bottom < innerHeight - 90; }); const top = Math.round(a.getBoundingClientRect().top); a.click(); return { sku: a.dataset.piece, top }; });
  await p.waitForURL("**/p/**"); await p.waitForTimeout(900); await p.goBack(); await p.waitForTimeout(1200);
  const back = await p.evaluate(s => Math.round(document.querySelector(`#main [data-piece="${s}"]`)?.getBoundingClientRect().top ?? -9999), pick.sku);
  ok(Math.abs(back - pick.top) <= 40, `${eng.name()} Back lands on ${pick.sku}: ${pick.top} -> ${back}`);
  ok(!errs.length, `${eng.name()} no page errors: ${errs[0] || ""}`);
  await b.close();
}
// desktop: the filter rail is part of the first screen
{ const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(700);
  await watchLeave(p, "#main .frail [data-f-toggle]");
  await tap(p, "/shop/charcoal"); await filled(p, "charcoal");
  const rail = await p.evaluate(() => window.__atLeave);
  ok(rail === null || rail > 0, "1440: the filter rail is in before the wave leaves (" + rail + " options)");
  await b.close(); }
// A single item's photo marked to be upscaled (charcoal, foil, shisha carry it as details.photo) shows the same quiet label as
// the Ace colours, on its card and its page; a photo state the page has no use for never reaches the storefront.
if (process.env.PERSIST) {
  const { execFileSync } = await import("node:child_process"), { fileURLToPath } = await import("node:url");
  const sql = cmd => execFileSync("cmd", ["/c", "npx", "wrangler", "d1", "execute", "onestopshop", "--local", "--persist-to", process.env.PERSIST, "--command", `"${cmd}"`], { cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: "pipe" });
  const mod = async () => import("data:text/javascript;base64," + Buffer.from(await (await fetch(B + "/api/catalog-module")).text()).toString("base64"));
  const P0 = (await mod()).PRODUCTS.filter(p => p.cat === "charcoal" && p.img && p.state === "sale"), up = P0[0], other = P0[1];
  sql(`UPDATE products SET details = json_set(details, '$.photo', 'upscale') WHERE sku = '${up.sku}'; UPDATE products SET details = json_set(details, '$.photo', 'rejected, from a rival site') WHERE sku = '${other.sku}'`);
  // a save in the back office clears the shop's copy of the catalogue
  const login = await fetch(B + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: process.env.ADMIN_KEY || "int-local-only" }) }), ck = (login.headers.get("set-cookie") || "").split(";")[0];
  await fetch(B + "/api/admin/products/" + up.sku, { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: ck }, body: JSON.stringify({ low_stock_at: 1 }) });
  const P1 = (await mod()).PRODUCTS, a = P1.find(p => p.sku === up.sku), z = P1.find(p => p.sku === other.sku);
  ok(a.details.photo === "upscale" && !("photo" in z.details), "the storefront gets 'upscale', never another photo note: " + JSON.stringify(z.details.photo));
  { const feed = (await (await fetch(B + "/api/catalog")).json()).products, fa = feed.find(p => p.sku === up.sku), fz = feed.find(p => p.sku === other.sku);
    ok(JSON.parse(fa.details).photo === "upscale" && !("photo" in JSON.parse(fz.details)), "the public feed (/api/catalog) keeps other photo notes private too"); }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(B + "/shop/charcoal", { waitUntil: "load" }); await p.waitForTimeout(800);
  const onCard = await p.evaluate(s => document.querySelector(`#main a[data-piece="${s}"] .shot__tag--tbd`)?.textContent || "", up.sku);
  await p.goto(B + "/p/" + up.sku, { waitUntil: "load" }); await p.waitForTimeout(600);
  const onPage = await p.evaluate(() => document.querySelector("[data-stage] .shot__tag--tbd")?.textContent || ""), alt = await p.evaluate(() => document.querySelector("[data-stage] img")?.alt || "");
  ok(onCard === "Photo to be upscaled" && onPage === "Photo to be upscaled" && /Photo to be upscaled/.test(alt), `a single item's photo to be upscaled is labelled on its card and its page: "${onCard}" "${onPage}"`);
  await b.close();
}
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
