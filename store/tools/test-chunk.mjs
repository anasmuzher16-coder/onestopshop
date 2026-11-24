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
  for (const sec of ["hookahs", "heat", "shisha"]) {
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
  await tap(p, "/shop/heat"); await filled(p, "heat");
  const rail = await p.evaluate(() => window.__atLeave);
  ok(rail === null || rail > 0, "1440: the filter rail is in before the wave leaves (" + rail + " options)");
  await b.close(); }
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
