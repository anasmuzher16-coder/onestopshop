// Regression checks for the 2026-11-23 audit: navigation. Phone in Safari's engine, desktop in Chrome. Needs the store running.
// node store/tools/e2e-nav.mjs
import { createRequire } from "node:module";
const { chromium, webkit } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const [tag, type, ctx] of [["webkit390", webkit, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" }], ["chromium1440", chromium, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }]]) {
  const b = await type.launch();
  try {
    const c = await b.newContext(ctx), p = await c.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    const open = async u => { await p.goto(B + u, { waitUntil: "domcontentloaded" }); await p.waitForSelector("#main > *"); await wait(350); };
    const y = () => p.evaluate(() => Math.round(scrollY));
    const tapCard = () => p.evaluate(() => { const a = [...document.querySelectorAll("#main a[data-piece]")].find(x => { const r = x.getBoundingClientRect(); return r.top > 160 && r.bottom < innerHeight - 90; }); a.click(); return a.dataset.piece; });
    // 14 back and forward keep the place
    // deep in the list with a card in full view (hookah cards grew colour chips on 2026-11-24, so a fixed 2600 px can land between cards)
    await open("/shop/hookahs"); await p.evaluate(() => { const c = document.querySelectorAll("#main a[data-piece]")[9]; const r = c.getBoundingClientRect(); scrollTo(0, scrollY + r.top + r.height / 2 - (innerHeight + 70) / 2); }); await wait(250);  const pick = await p.evaluate(() => { const a = [...document.querySelectorAll("#main a[data-piece]")].find(x => { const r = x.getBoundingClientRect(); return r.top > 160 && r.bottom < innerHeight - 90; }); return Math.round(a.getBoundingClientRect().top); }); const sku = await tapCard(); await p.waitForURL(/\/p\//); await wait(300);
    t(`${tag} 14 a new page starts at the top`, (await y()) === 0, String(await y()));
    await p.evaluate(() => scrollTo(0, 300)); await wait(150);
    await p.goBack(); await wait(450); const back = await p.evaluate(s => Math.round(document.querySelector(`[data-piece="${s}"]`).getBoundingClientRect().top), sku);
    t(`${tag} 14 Back puts the tapped card where it was`, Math.abs(back - pick) <= 4, `${pick} -> ${back}`);
    t(`${tag} 14 the tapped card is on screen`, await p.evaluate(s => { const r = document.querySelector(`[data-piece="${s}"]`).getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }, sku));
    await p.goForward(); await wait(450); t(`${tag} 14 Forward returns to the place on the product`, Math.abs((await y()) - 300) <= 4, String(await y()));
    // 16 titles
    for (const [u, want] of [["/shop/bowls", /^Bowls \|/], ["/cart", /^Cart \|/], ["/p/OSS-9601", /^Zanobia Herbal Molasses Double Apple, 250 g \|/]]) { await open("/terms"); await p.evaluate(x => { const a = document.createElement("a"); a.href = x; a.style.display = "none"; document.body.append(a); a.click(); a.remove(); }, u); await p.waitForURL("**" + u); await wait(250); t(`${tag} 16 title changes on ${u}`, want.test(await p.title()), await p.title()); }
    // 17 Everything from anywhere (Gifts is gone, owner 2026-11-26)
    for (const u of ["/shop/hookahs", "/p/OSS-100024", "/cart", "/set"]) { await open(u); const v = await p.evaluate(() => [...document.querySelectorAll("a[href]")].filter(a => a.getBoundingClientRect().width > 0).map(a => a.getAttribute("href"))); t(`${tag} 17 ${u} reaches Everything, and no Gifts link`, v.includes("/shop") && !v.some(h => h.startsWith("/gifts")), v.length + " links"); }
    // 18 chips hold still
    if (tag === "webkit390") { await open("/shop/parts"); t(`${tag} 18 chips are their own layer in a page change`, await p.evaluate(() => getComputedStyle(document.querySelector(".chips")).viewTransitionName) === "chips"); }
    // 19 current page
    if (tag === "chromium1440") {
      await open("/p/OSS-9601"); t(`${tag} 19 a product marks its section`, await p.locator('.top__nav a[href="/shop/shisha"][aria-current]').count() === 1 || await p.locator(".top__nav a[aria-current]").count() === 1);
      // Gifts left the menu (owner, 2026-11-26: "it just adds clutter")
      t(`${tag} 19 no Gifts in the menu`, await p.locator('.top__nav a[href^="/gifts"]').count() === 0);
      await open("/cart"); t(`${tag} 19 Cart is marked`, await p.locator(".top__cart[aria-current]").count() === 1);
      t(`${tag} 17 nav stays on one line`, await p.evaluate(() => { const n = document.querySelector(".top__nav"); return new Set([...n.children].filter(a => !a.hidden).map(a => Math.round(a.getBoundingClientRect().top))).size === 1; }));
      // no link is ever cut off or scrolled out of sight: what does not fit sits behind "More" (owner, 2026-11-26)
      t(`${tag} 17 no menu link cut off`, await p.evaluate(() => { const n = document.querySelector(".top__nav"), r = n.getBoundingClientRect(); return n.scrollWidth <= n.clientWidth + 1 && [...n.querySelectorAll(":scope > a, :scope > .top__more:not([hidden])")].every(a => { const b = a.getBoundingClientRect(); return b.left >= r.left - 8 && b.right <= r.right + 8; }); }));
    } else { await open("/shop/hookahs"); t(`${tag} 19 dock marks Shop on a section`, await p.locator('.dock a[href="/shop"][aria-current]').count() === 1); }
    // 15 dock Back is the real Back
    if (tag === "webkit390") {
      // the search word was "brass", then "bowl", until the samples were retired on 2026-11-24; "mint" finds real shisha flavours
      await open("/search"); await p.fill("#q", "mint"); await wait(250); const s = await p.evaluate(() => { const a = document.querySelector("[data-search-out] a[data-piece]"); a.click(); return a.dataset.piece; }); await p.waitForURL("**/p/" + s); await wait(250);
      await p.locator(".dock a.dock__side", { hasText: "Back" }).click(); await p.waitForURL(/\/search/); await wait(250);
      t(`${tag} 15 dock Back returns to the search`, /\/search\?q=mint$/.test(p.url()) && await p.inputValue("#q") === "mint", p.url());
      await open("/p/OSS-100024"); await p.locator(".dock a.dock__side", { hasText: "Back" }).click(); await p.waitForURL("**/shop/hookahs"); t(`${tag} 15 from a shared link Back goes to the section`, true);
    }
    // 20 search and addresses
    await open("/search?q=mint"); t(`${tag} 20 /search?q= runs the search`, await p.inputValue("#q") === "mint" && await p.locator("[data-search-out] a[data-piece]").count() > 0);
    // Bowls and Parts hold the ticked Ace accessories since 2026-11-26 (Price TBD), so they are no longer empty: Misc and
    // Cologne are the sections with nothing online, and a search for one still says so; a bowl search now finds the bowls
    await open("/search?q=bowl"); t(`${tag} 20 a search for bowl finds the ticked Ace bowls`, await p.locator("[data-search-out] a[data-piece]").count() > 0);
    for (const w of ["misc", "cologne"]) { await open("/search?q=" + w); t(`${tag} 20 a search naming a section with no stock online says it is coming soon (${w})`, /coming soon to the site/i.test(await p.locator("[data-search-out]").innerText()) && await p.locator('[data-search-out] a[href="tel:+15192552222"]').count() > 0); }
    await p.fill("#q", "zzzqqq"); await wait(200); t(`${tag} 20 no results offers a way on`, await p.locator('[data-search-out] a[href="/shop"]').count() === 1);
    const lower = await p.goto(B + "/p/oss-100024", { waitUntil: "domcontentloaded" }); await p.waitForSelector("#main > *"); t(`${tag} 20 a lowercase item number opens the item`, lower.status() === 200 && /\/p\/OSS-100024$/.test(p.url()) && /DMX Hookah/.test(await p.locator("h1").innerText()), p.url());
    for (const u of ["/cart/extra", "/set/extra", "/shop/hookahs/extra", "/order/nope", "/search/x"]) { const r = await p.goto(B + u, { waitUntil: "domcontentloaded" }); await p.waitForSelector("#main > *"); await wait(120); t(`${tag} 20 ${u} is a real 404`, r.status() === 404 && /Nothing at this address/.test(await p.locator("h1").innerText()) && /^Page not found/.test(await p.title()), r.status() + " " + await p.locator("h1").innerText()); }
    t(`${tag} no script errors`, !errs.length, errs[0] || "");
    await c.close();
    // the air draws in a worker where the engine can (2026-11-25): it starts, follows a change of section, and leaves one canvas
    {
      const c2 = await b.newContext({ viewport: { width: 390, height: 844 } }), q = await c2.newPage();
      await q.goto(B + "/shop/heat", { waitUntil: "domcontentloaded" }); await q.waitForSelector("#main > *"); await wait(1500);
      const a1 = await q.evaluate(() => ({ kind: window.__air?.kind, worker: window.__air?.worker, n: document.querySelectorAll("canvas.pour--air").length }));
      t(`${tag} air: heat air is up in a worker`, a1.kind === "heat" && a1.n === 1 && (type !== chromium || a1.worker === true), JSON.stringify(a1));
      await q.evaluate(() => document.querySelector('a[href="/shop/bowls"]')?.click()); await wait(2600);
      const a2 = await q.evaluate(() => ({ at: location.pathname, kind: window.__air?.kind, n: document.querySelectorAll("canvas.pour--air").length }));
      t(`${tag} air: a change of section brings that section's air`, a2.at === "/shop/bowls" && a2.kind === "bowls" && a2.n === 1, JSON.stringify(a2));
      await q.goto(B + "/shop/hookahs", { waitUntil: "domcontentloaded" }); await q.waitForSelector("#main > *"); await wait(900);
      t(`${tag} air: the hookah page has no air canvas (its smoke is its own)`, await q.evaluate(() => !document.querySelector("canvas.pour--air") && !window.__air?.kind));
      await c2.close();
    }
  } finally { await b.close(); }
}
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
