// The section swap in steps (app.js "the first screen first"), in Chromium and WebKit, against a running local store:
// after an in-site tap on a long section the cards fill in with none lost, duplicated or reordered (same as a direct load),
// aria-busy and the wave's hold (data-swapping) are cleared, the desktop filter rail is in with the first screen, the first
// screen's cards are in before the wave leaves, and Back to a card far down the list lands on that card.
//   BASE=http://127.0.0.1:4493 node store/tools/test-chunk.mjs
import { createRequire } from "node:module";
const { chromium, webkit } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
// hoses whose drawn-bag photo is approved (store/catalog/live/hose-drawnbag-2026-11-27.sql, hose-zanobia-2026-11-28.sql): those lose the "to be replaced" tag
const DRAWN = new Set(await (async () => { const fs = await import("node:fs"); return ["hose-drawnbag-2026-11-27.sql", "hose-zanobia-2026-11-28.sql"].flatMap(f => (fs.readFileSync(new URL("../catalog/live/" + f, import.meta.url), "utf8").match(/^UPDATE products SET details[^\n]*WHERE sku IN \(([^)]*)\)/m)?.[1] || "").match(/OSS-\d+/g) || []); })());
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
// the local server drops idle kept-alive connections while a database command runs beside it: a reset before any answer is retried (as test-backoffice does)
const fetch = async (u, o) => { for (let i = 0; ; i++) try { return await globalThis.fetch(u, o); } catch (e) { if (i >= 2 || e?.cause?.code !== "ECONNRESET") throw e; } };
const tap = (p, h) => p.evaluate(h => { const a = document.createElement("a"); a.href = h; document.body.append(a); a.click(); a.remove(); }, h);
const filled = (p, s) => p.waitForFunction(s => document.querySelector(`#main .shophead[data-cat="${s}"]`) && !document.querySelector("#main [data-later]") && !document.querySelector("#main[aria-busy]") && !document.documentElement.hasAttribute("data-swapping"), s, { timeout: 15000 }).then(() => true, () => false);
const skus = p => p.evaluate(() => [...document.querySelectorAll("#main .card [data-piece]")].map(a => a.dataset.piece));
// counts what is in #main at the moment the wave is let go (data-swapping cleared)
const watchLeave = (p, sel) => p.evaluate(sel => { window.__atLeave = null; let seen = false; new MutationObserver((m, o) => { const on = document.documentElement.hasAttribute("data-swapping"); if (on) seen = true; else if (seen) { window.__atLeave = document.querySelectorAll(sel).length; o.disconnect(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-swapping"] }); }, sel);
for (const eng of [chromium, webkit]) {
  const b = await eng.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on("pageerror", e => errs.push(e.message));
  for (const sec of ["hookahs", "charcoal", "shisha", "hoses"]) {   // hoses: 26 cards since the shop's own hoses (2026-11-27), past the 24 that draw at once
    await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(700);
    await watchLeave(p, "#main .card");
    await tap(p, "/shop/" + sec);
    const done = await filled(p, sec), got = await skus(p), atLeave = await p.evaluate(() => window.__atLeave);
    await p.goto(B + "/shop/" + sec, { waitUntil: "load" }); const direct = await skus(p);
    ok(done, `${eng.name()} ${sec}: the section fills in and clears aria-busy and the wave's hold`);
    ok(got.length === direct.length && JSON.stringify(got) === JSON.stringify(direct) && new Set(got).size === got.length, `${eng.name()} ${sec}: ${got.length} cards, the same and in the same order as a direct load (${direct.length})`);
    ok(atLeave === null || atLeave >= 4, `${eng.name()} ${sec}: the first screen's cards are in before the wave leaves (${atLeave})`);
  }
  // Home by a tap (2026-11-26): its tiles come in under the held cover, its counter picks just after, and it ends the same as a direct load
  await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(700);
  await watchLeave(p, "#main .cats .cat");
  await tap(p, "/");
  const homeDone = await p.waitForFunction(() => document.querySelector("#main .hero") && !document.querySelector("#main [data-later]") && !document.querySelector("#main[aria-busy]") && !document.documentElement.hasAttribute("data-swapping"), null, { timeout: 15000 }).then(() => true, () => false);
  const home = await p.evaluate(() => ({ tiles: document.querySelectorAll("#main .cats .cat").length, picks: document.querySelectorAll("#main .shelf .card").length, leave: window.__atLeave }));
  await p.goto(B + "/", { waitUntil: "load" }); const homeDirect = await p.evaluate(() => ({ tiles: document.querySelectorAll("#main .cats .cat").length, picks: document.querySelectorAll("#main .shelf .card").length }));
  ok(homeDone && home.tiles === homeDirect.tiles && home.picks === homeDirect.picks && home.tiles > 0, `${eng.name()} home: by a tap it fills in to match a direct load ${JSON.stringify(home)} vs ${JSON.stringify(homeDirect)}`);
  ok(home.leave === null || home.leave === homeDirect.tiles, `${eng.name()} home: every tile is in before the wave leaves (${home.leave})`);
  await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(500);
  await tap(p, "/shop/hookahs"); await filled(p, "hookahs");
  // well down the section, wherever its length puts that (Hookahs is 26 ticked families since 2026-11-26, not 83)
  await p.evaluate(() => scrollTo(0, Math.round((document.documentElement.scrollHeight - innerHeight) * 0.6))); await p.waitForTimeout(600);
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
// A cold load of a shop page (2026-11-26: the band was an empty dark slot until the script ran): the Worker writes the band into
// the HTML, so it is coloured, titled and its full height on the first paint, before the script (held back here, as on a slow
// phone) runs. The page then keeps that same node, in the same box, with no layout shift. Every section and Everything at 390,
// a few at 1440 and in WebKit, and a returning visitor who has answered the delivery question (no question drawn, none shown).
{ const CATS = (await import("data:text/javascript;base64," + Buffer.from(await (await fetch(B + "/api/catalog-module")).text()).toString("base64"))).CATEGORIES.map(c => c.id);
  const cold = async (eng, b, path, w, h, cookie) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); if (cookie) { await ctx.addCookies([{ name: "oss-ask", value: "0", url: B }]); await ctx.addInitScript(() => localStorage.setItem("oss:reach", '"local"')); }   // answered: the page's own record and the cookie it keeps from it
    const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.addInitScript(() => { window.__box = () => { const s = document.querySelector("#main > .shophead"); if (!s) return null; const r = s.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), bg: getComputedStyle(s).backgroundColor, title: s.querySelector("h1")?.textContent || "" }; };
      window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch { window.__cls = -1; } });
    await p.route(/\/app\.js(\?|$)/, r => setTimeout(() => r.continue(), 400));
    await p.goto(B + path, { waitUntil: "commit" });
    const before = await p.waitForFunction(() => { const s = document.querySelector("#main > .shophead"); if (!s || !document.body || document.body.dataset.route) return false; const bg = getComputedStyle(s).backgroundColor; if (!bg || bg === "rgba(0, 0, 0, 0)") return false; window.__band = s; return window.__box(); }, null, { timeout: 10000, polling: "raf" }).then(x => x.jsonValue(), () => null);
    await p.waitForFunction(() => document.body.dataset.route && !document.querySelector("#main [data-later]") && !document.querySelector("#main[aria-busy]"), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1200);   // the band's act lands its object
    const after = await p.evaluate(() => ({ ...window.__box(), same: document.querySelector("#main > .shophead") === window.__band, cls: +window.__cls.toFixed(4), strip: !document.querySelector("[data-delivery-strip]").hidden }));
    await ctx.close(); return { before, after, errs };
  };
  const bad = [];
  const one = async (eng, b, path, w, h, cookie = false) => {
    const { before, after, errs } = await cold(eng, b, path, w, h, cookie), tag = `${eng.name()} ${w} ${path}${cookie ? " (answered)" : ""}`;
    if (!before) { bad.push(`${tag}: no coloured band before the script ran`); return; }
    if (!after.same || before.top !== after.top || before.h !== after.h || before.w !== after.w || before.title !== after.title || before.bg !== after.bg) bad.push(`${tag}: band ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    if (after.cls > 0.001) bad.push(`${tag}: layout shift ${after.cls}`);
    if (cookie && after.strip) bad.push(`${tag}: the delivery question shows for a visitor who answered it`);
    if (errs.length) bad.push(`${tag}: page error ${errs[0]}`);
  };
  const b = await chromium.launch();
  for (const id of [...CATS, ""]) await one(chromium, b, "/shop" + (id ? "/" + id : ""), 390, 844);
  for (const id of ["hookahs", "charcoal", "misc"]) await one(chromium, b, "/shop/" + id, 1440, 900);
  await one(chromium, b, "/shop/hookahs", 390, 844, true);
  await b.close();
  const wb = await webkit.launch();
  for (const [id, w, h] of [["shisha", 390, 844], ["hookahs", 390, 844], ["heat", 1440, 900]]) await one(webkit, wb, "/shop/" + id, w, h);
  await wb.close();
  ok(bad.length === 0, `cold load: every shop page's band is painted from the HTML and kept by the page, same node and box, no layout shift (${CATS.length + 1} pages at 390, 3 at 1440, 3 in WebKit, 1 answered): ${bad.slice(0, 3).join("; ")}`);
}
// A single item's photo marked to be upscaled (charcoal, foil, shisha carry it as details.photo) shows no label to shoppers; a
// stand-in photo says "Photo to be replaced" until the shop's own photo goes up; a photo state the page has no use for never
// reaches the storefront.
if (process.env.PERSIST) {
  const { execFileSync } = await import("node:child_process"), { fileURLToPath } = await import("node:url");
  const { join } = await import("node:path");
  const WRANGLER = process.env.WRANGLER_JS || join(execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["root", "-g"], { encoding: "utf8", shell: process.platform === "win32" }).trim(), "wrangler", "bin", "wrangler.js");   // as test-account does
  const sql = cmd => execFileSync(process.execPath, [WRANGLER, "d1", "execute", "onestopshop", "--local", "--persist-to", process.env.PERSIST, "--command", cmd], { cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: "pipe" });
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
  // design review 2026-11-26: "to be upscaled" is the shop's work list, never stamped on a photo shoppers see (the data keeps it, checked above)
  ok(onCard === "" && onPage === "" && !/upscaled/i.test(alt) && !(await p.evaluate(() => /to be upscaled/i.test(document.body.innerText))), `a photo to be upscaled carries no label on its card or its page: "${onCard}" "${onPage}" "${alt}"`);
  // a stand-in photo still says so ("Photo to be replaced" is the shopper's business: it is not the item they will get)
  sql(`UPDATE products SET details = json_set(details, '$.photo', 'replace') WHERE sku = '${up.sku}'`);
  await fetch(B + "/api/admin/products/" + up.sku, { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie: ck }, body: JSON.stringify({ low_stock_at: 2 }) });
  await p.goto(B + "/p/" + up.sku, { waitUntil: "load" }); await p.waitForTimeout(600);
  const standIn = await p.evaluate(() => document.querySelector("[data-stage] .shot__tag--tbd")?.textContent || "");
  ok(standIn === "Photo to be replaced", `a stand-in photo is labelled on its page: "${standIn}"`);
  // the shop's own photo uploaded in the back office: the label about the old photo goes with it
  const jpeg = new Uint8Array(400); jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  const upl = await fetch(B + "/api/admin/products/" + up.sku + "/photo", { method: "POST", headers: { "Content-Type": "image/jpeg", "X-OSS-Admin": "1", Cookie: ck }, body: jpeg });
  await p.goto(B + "/shop/charcoal", { waitUntil: "load" }); await p.waitForTimeout(800);
  const afterCard = await p.evaluate(s => document.querySelector(`#main a[data-piece="${s}"] .shot__tag--tbd`)?.textContent || "", up.sku);
  await p.goto(B + "/p/" + up.sku, { waitUntil: "load" }); await p.waitForTimeout(600);
  const afterPage = await p.evaluate(() => document.querySelector("[data-stage] .shot__tag--tbd")?.textContent || "");
  ok(upl.status === 200 && afterCard === "" && afterPage === "", `after the shop uploads its own photo the label is gone: ${upl.status} "${afterCard}" "${afterPage}"`);
  // the shop's original hookah photos and every hose (owner 2026-11-27): "Photo to be replaced" on the card and the page; an
  // approved photo (the red Ace Rose, the shop's own cleaned photo) never carries it
  { const tagOf = async (path, sel) => { await p.goto(B + path, { waitUntil: "load" }); await p.waitForTimeout(800); return p.evaluate(s => document.querySelector(s)?.textContent || "", sel); };
    const hk = P1.find(x => x.sku === "OSS-140012"), web = P1.find(x => x.sku === "OSS-140001"), hose = P1.find(x => /^OSS-12\d{4}$/.test(x.sku) && x.img && !DRAWN.has(x.sku)) || P1.find(x => x.sku === "OSS-120011");   // a hose still waiting for its drawn-bag photo, while one is
    const hkCard = await tagOf("/shop/hookahs", `#main a[data-piece="${hk.sku}"] .shot__tag--tbd`), hkPage = await tagOf("/p/" + hk.sku, "[data-stage] .shot__tag--tbd");
    const hkFull = await p.evaluate(() => !!document.querySelector("[data-stage].tile--photo > img.shot--photo"));
    ok(hkCard === "Photo to be replaced" && hkPage === "Photo to be replaced" && hkFull, `a shop hookah's original photo fills its tile and is tagged on its card and page: "${hkCard}" "${hkPage}" ${hkFull}`);
    const webPage = await tagOf("/p/" + web.sku, "[data-stage] .shot__tag--tbd"), webCut = await p.evaluate(() => !!document.querySelector("[data-stage]:not(.tile--photo) > img.shot:not(.shot--photo)"));
    ok(webPage === "" && webCut, `an exact model's web photo is a cut-out with no tag: "${webPage}" ${webCut}`);
    const hoseCards = await (async () => { await p.goto(B + "/shop/hoses", { waitUntil: "load" }); await p.waitForTimeout(900); return p.evaluate(() => [...document.querySelectorAll("#main .card")].filter(c => /^OSS-12\d{4}$/.test(c.querySelector("[data-piece]")?.dataset.piece || "")).map(c => [c.querySelector("[data-piece]").dataset.piece, c.querySelector(".shot__tag--tbd")?.textContent || ""])); })();
    ok(DRAWN.size > 0 && hoseCards.length === 21 && hoseCards.every(([s, t]) => t === (DRAWN.has(s) ? "" : "Photo to be replaced")),
      `every hose card is tagged until its drawn-bag photo is approved: ${hoseCards.filter(([, t]) => t === "Photo to be replaced").length}/${hoseCards.length} tagged`);
    const hosePage = await tagOf("/p/" + hose.sku, "[data-stage] .shot__tag--tbd");
    ok(hosePage === (DRAWN.has(hose.sku) ? "" : "Photo to be replaced"), `a hose's page is tagged until its drawn-bag photo is approved: "${hosePage}"`);
    const drawnPage = DRAWN.size ? await tagOf("/p/" + [...DRAWN][0], "[data-stage] .shot__tag--tbd") : "?";
    ok(drawnPage === "", `a hose on its approved drawn-bag photo carries no tag: "${drawnPage}"`);
    const rosePage = await tagOf("/p/OSS-100150", "[data-stage] .shot__tag--tbd"), roseCard = await tagOf("/shop/hookahs", `#main a[data-piece="OSS-100150"] .shot__tag--tbd`);
    ok(rosePage === "" && roseCard === "", `an approved photo carries no tag: "${roseCard}" "${rosePage}"`); }
  // an item waiting for the shop's price is "in the shop": its page never offers a back-in-stock email, a sold-out item for sale does
  const tbd = P1.find(p => p.state === "tbd" && p.stock === 0), gone = P1.find(p => p.state === "sale" && p.stock === 0);
  if (tbd) { await p.goto(B + "/p/" + tbd.sku, { waitUntil: "load" }); await p.waitForSelector(".keep__b", { timeout: 8000 }).catch(() => {});
    ok(await p.locator('.keep__b[data-keep="fav"]').count() === 1 && await p.locator('.keep__b[data-keep="alert"]').count() === 0, `a Price TBD item (${tbd.sku}) offers Save but no back-in-stock email`); }
  else ok(false, "a Price TBD item with no count to check");
  if (gone) { await p.goto(B + "/p/" + gone.sku, { waitUntil: "load" }); await p.waitForSelector(".keep__b", { timeout: 8000 }).catch(() => {});
    // rewritten 2026-11-27 (fleet/guard4): the back-in-stock email is offered only while the shop's mail is connected (meta oss-mail)
    const mailOn = (await p.locator('meta[name="oss-mail"]').getAttribute("content")) === "on";
    ok(await p.locator('.keep__b[data-keep="alert"]').count() === (mailOn ? 1 : 0) && await p.locator('.keep__b[data-keep="fav"]').count() === 1, `a sold-out item for sale (${gone.sku}) offers the back-in-stock email only with mail on (mail ${mailOn ? "on" : "off"}), and Save either way`); }
  await b.close();
}
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
