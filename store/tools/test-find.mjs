// Find checks: section filters, the address, synonyms, typo tolerance, the no-result and zero-filter pages.
// Part 1 runs the rules on the live catalogue module; part 2 drives a phone and a desktop browser (one browser).
// Needs the store running. node store/tools/test-find.mjs
import { createRequire } from "node:module";
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
let n = 0, f = 0;
const ok = (c, m) => { n++; if (c) return; f++; console.log("FAIL", m); };

// ---------- part 1: the rules, on the shop's real catalogue ----------
const mod = await (await fetch(B + "/api/catalog-module")).text();
const { PRODUCTS, CATEGORIES } = await import("data:text/javascript;base64," + Buffer.from(mod).toString("base64"));
const F = await import(new URL("../public/find-core.js", import.meta.url));
const S = await import(new URL("../public/search-core.js", import.meta.url));
// the page modules load too (a syntax error in one stops the whole storefront)
for (const m of ["find.js", "search.js"]) { let e = null; try { await import(new URL("../public/" + m, import.meta.url)); } catch (x) { e = x; } ok(!e, `${m} loads: ${e && e.message}`); }
const coal = PRODUCTS.filter(p => p.cat === "charcoal"), heat = PRODUCTS.filter(p => p.cat === "heat"), hk = PRODUCTS.filter(p => p.cat === "hookahs");
const keys = F.groupsFor("charcoal", coal).map(g => g.key), hkeys = F.groupsFor("heat", heat).map(g => g.key);
ok(["type", "shape", "brand"].every(k => keys.includes(k)), "Charcoal filters by type, shape and brand: " + keys);
ok(hkeys.includes("type") && hkeys.includes("foil") && !hkeys.includes("shape") && F.apply("heat", heat, { type: ["foil"] }).length === 15, "Heat filters its foil and heat pieces, with no charcoal facets: " + hkeys);
for (const g of F.groupsFor("heat", heat)) for (const [v] of F.optionsOf(g, heat)) ok(F.countFor("heat", heat, {}, g, v) === F.apply("heat", heat, { [g.key]: [v] }).length, `Heat count for ${g.key}=${v} is true`);
// every option count is what you get when you pick it
for (const g of F.groupsFor("charcoal", coal)) for (const [v] of F.optionsOf(g, coal)) {
  const c = F.countFor("charcoal", coal, {}, g, v), got = F.apply("charcoal", coal, { [g.key]: [v] }).length;
  ok(c === got, `count for ${g.key}=${v} says ${c}, gives ${got}`);
}
// OR inside a group, AND across groups
const cube = F.apply("charcoal", coal, { shape: ["cube"] }).length, tab = F.apply("charcoal", coal, { shape: ["tablet"] }).length;
ok(cube > 0 && tab > 0 && F.apply("charcoal", coal, { shape: ["cube", "tablet"] }).length === cube + tab, "two shapes give both");
const cc = F.apply("charcoal", coal, { shape: ["cube"], made: ["coconut"] });
ok(cc.length > 0 && cc.length <= cube && cc.every(p => F.shapeOf(p) === "cube" && F.madeOf(p) === "coconut"), "cube AND coconut");
// the address: unknown keys and values dropped, written back the same way
const sel = F.readSel("charcoal", coal, "?shape=cube,nope&made=coconut&evil=<x>&sort=piece&mm=999");
ok(JSON.stringify(sel) === JSON.stringify({ shape: ["cube"], made: ["coconut"], sort: "piece" }), "address read: " + JSON.stringify(sel));
ok(F.writeSel("charcoal", coal, sel) === "?shape=cube&made=coconut&sort=piece", "address written: " + F.writeSel("charcoal", coal, sel));
// price per piece really sorts by price over count
const pp = F.apply("charcoal", coal, { type: ["box"], sort: "piece" }).filter(F.perPiece).map(F.perPiece);
ok(pp.length > 5 && pp.every((x, i) => !i || x >= pp[i - 1]), "price per piece goes up");
// hookahs: one card per family, colour picks the card's colour
const fams = new Set(hk.filter(p => p.family).map(p => p.family));
ok(F.cards(hk).filter(p => p.family).length === fams.size, "one hookah card per family");
const black = F.apply("hookahs", hk, { colour: ["black"] });
ok(!F.groupsFor("hookahs", hk).some(g => g.key === "colour") || (black.length > 0 && black.every(p => F.colourOf(p) === "black")), "colour filter shows that colour");
// zero results: every drop row leads somewhere real
const z = { shape: ["tablet"], made: ["bamboo"] };
if (!F.apply("charcoal", coal, z).length) ok(F.drops("charcoal", coal, z).every(d => d.n === F.apply("charcoal", coal, { ...z, [d.key]: z[d.key].filter(x => x !== d.v) }).length), "drop counts are true");

const ix = S.buildIndex(PRODUCTS, CATEGORIES);
const finds = (q, test, m) => { const r = S.search(ix, q); ok(r.length && test(r), `"${q}" ${m} (got ${r.length}: ${r.slice(0, 3).map(p => p.name).join(" | ")})`); };
finds("hooka", r => r.some(p => p.cat === "hookahs"), "finds hookahs");
finds("nargile", r => r.some(p => p.cat === "hookahs"), "finds hookahs");
finds("shisha pipe", r => r.some(p => p.cat === "hookahs"), "finds hookahs");
finds("coals", r => r.some(p => F.heatKind(p) === "box"), "finds charcoal");
finds("cocnut cubes", r => r.every(p => /cub/i.test(p.name)), "fixes the typo and finds cubes");
if (PRODUCTS.some(p => p.cat === "shisha")) finds("fruit", r => r.filter(p => p.cat === "shisha").length === F.apply("shisha", PRODUCTS.filter(p => p.cat === "shisha"), { flavour: ["fruit"] }).length, "fruit finds every fruit flavour");finds("titanum", r => r.every(p => /titanium/i.test(p.name)), "fixes the brand typo");
finds("coco fu", r => r.every(p => /fuego/i.test(p.name)), "finds a brand as it is typed");
finds("quick light", r => r.every(p => /tablet/i.test(p.name)), "finds round tablets");
finds("foil 30 mic", r => r.every(p => F.heatKind(p) === "foil"), "finds foil");
if (PRODUCTS.some(p => p.cat === "shisha")) finds("minty", r => r.every(p => p.cat === "shisha" && /mint|ice/i.test(p.name)), "finds mint flavours");
ok(S.understand(ix, "cocnut").fixed[0]?.[1] === "coconut", "says what it corrected");
ok(S.jumps(ix, "coconut cubes").some(j => j.href === "/shop/charcoal?shape=cube&made=coconut"), "Jump to coconut cubes");
ok(S.understand(ix, "opening hours").pages.some(p => /hours/i.test(p.label)), "hours answers with the page");
ok(S.understand(ix, "delivery").pages.length === 1, "delivery answers with the page");
ok(!S.search(ix, "rose water").length && S.nearest(ix, "rose water").alone.length >= 1, "no rose water, but the nearest");
ok(!S.search(ix, "xqzv").length, "nonsense finds nothing");
ok(S.dist("cocnut", "coconut") === 1 && S.dist("ab", "ba") === 1, "edit distance");

// ---------- part 2: the page ----------
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const b = process.env.FIND_RULES_ONLY ? null : await chromium.launch();   // FIND_RULES_ONLY=1: part 1 only, no browser
if (b) try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(B + "/shop/charcoal?shape=cube&made=coconut", { waitUntil: "load" }); await p.waitForSelector("[data-fbar]");
  const want = F.apply("charcoal", coal, { shape: ["cube"], made: ["coconut"] }).length;
  ok(await p.locator(".grid--shop .card").count() === want, "address filters the grid on load");
  ok(/Filter\s*2/.test(await p.locator(".fbar__btn").innerText()), "Filter button counts 2");
  ok(await p.locator('.fbar .qchip[aria-pressed="true"]').count() === 2, "applied filters lead the chip row");
  await p.locator('.fbar .qchip[aria-pressed="true"]').first().click();
  ok(!/shape=/.test(new URL(p.url()).search) && /made=coconut/.test(new URL(p.url()).search), "removing a chip updates the address: " + p.url());
  await p.locator(".fbar__btn").click(); await p.waitForSelector(".fsheet[open]");
  const btn = p.locator("[data-f-apply]"), before = await btn.innerText();
  await p.locator('.fsheet [data-f-toggle="type"][data-v="box"]').click();
  ok(await btn.innerText() !== before || /Show \d+/.test(before), "the Show button counts as you tick");
  ok(/made=coconut/.test(p.url()) && !/type=box/.test(p.url()), "the sheet does not apply until Show");
  await btn.click(); await p.waitForFunction(() => !document.querySelector(".fsheet[open]"), null, { timeout: 2000 }).catch(() => {});   // the sheet leaves in 160 ms; a busy machine can take longer
  ok(/type=box/.test(p.url()) && !(await p.locator(".fsheet[open]").count()), "Show applies and closes");
  const want2 = F.apply("charcoal", coal, { made: ["coconut"], type: ["box"] }).length;
  await p.locator(".grid--shop .card__a").first().click(); await p.waitForURL(/\/p\//); await p.waitForTimeout(600);
  await p.goBack(); await p.waitForSelector("[data-fbar]"); await p.waitForTimeout(800);
  ok(/type=box/.test(p.url()) && await p.locator(".grid--shop .card").count() === want2, "Back from a product keeps the filters: " + p.url());
  await p.goto(B + "/shop/charcoal?shape=tablet&made=bamboo&mm=40", { waitUntil: "load" }); await p.waitForSelector("[data-fbar]");
  const zero = !F.apply("charcoal", coal, F.readSel("charcoal", coal, "?shape=tablet&made=bamboo&mm=40")).length;
  if (zero) { ok(await p.locator(".fempty").count() === 1, "zero filters show the way back"); ok(!(await p.locator(".drops .num").allInnerTexts()).some(t => /^0 /.test(t)), "no way back leads to zero"); }
  await p.goto(B + "/shop/heat?find=coal", { waitUntil: "load" }); await p.waitForSelector(".fsheet[open] .gf__opt");   // an old Heat link: the coal finder now lives in Charcoal
  ok(new URL(p.url()).pathname === "/shop/charcoal", "an old /shop/heat?find=coal link lands on Charcoal: " + p.url());
  await p.locator("[data-gf1]").nth(1).click(); await p.locator("[data-gf2]").first().click(); await p.waitForTimeout(800);
  const fsel = F.readSel("charcoal", coal, new URL(p.url()).search);
  ok(fsel.shape?.length === 1 && fsel.n?.length >= 1 && await p.locator(".grid--shop .card").count() === F.apply("charcoal", coal, fsel).length && /Filter\s*\d/.test(await p.locator(".fbar__btn").innerText()), "the coal finder lands on the filtered shelf it names: " + p.url());
  // the finder offer steps aside once a filter is set; opening and closing it changes nothing
  await p.goto(B + "/shop/charcoal?type=roll", { waitUntil: "load" }); await p.waitForSelector("[data-fbar]");
  ok(!(await p.locator("[data-f-finder]").count()), "no finder offer once a filter is set");
  // the results count shows once a filter is on, and is only for screen readers when none is (the band already says it)
  ok(await p.locator(".fres:not(.fres--quiet) .fres__n").first().isVisible(), "with a filter on, the results count shows");
  await p.goto(B + "/shop/charcoal", { waitUntil: "load" }); await p.waitForSelector("[data-fbar]");
  ok(await p.locator(".fres.fres--quiet").count() > 0 && await p.locator(".fres:not(.fres--quiet)").count() === 0 && (await p.locator(".fres__n").first().textContent()).trim().length > 0, "with no filter, the count is said once (by the band) and kept for screen readers");
  await p.goto(B + "/shop/charcoal?type=roll", { waitUntil: "load" }); await p.waitForSelector("[data-fbar]");
  await p.goto(B + "/shop/heat?type=foil", { waitUntil: "load" }); await p.waitForSelector("[data-fbar]");
  ok(new URL(p.url()).pathname === "/shop/heat" && !(await p.locator("[data-f-finder]").count()) && await p.locator(".grid--shop .card").count() === 15, "Heat keeps its foil filter and has no coal finder");
  await p.goto(B + "/shop/charcoal", { waitUntil: "load" }); await p.waitForSelector("[data-f-finder]");
  await p.locator("[data-f-finder]").click(); await p.waitForSelector(".fsheet[open]"); await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  ok(new URL(p.url()).pathname === "/shop/charcoal" && !new URL(p.url()).search && !(await p.locator(".fsheet[open]").count()), "the finder closes and leaves the address alone: " + p.url());
  await p.goto(B + "/search", { waitUntil: "load" });
  ok(await p.locator(".way").count() >= 4, "search opens with ways in");
  await p.locator("#q").fill("cocnut cubes"); await p.waitForTimeout(200);
  ok(/You typed cocnut/.test(await p.locator("[data-search-out]").innerText()), "search says what it corrected");
  ok(/q=cocnut/.test(p.url()), "search words go in the address");
  ok(await p.locator(".jumps a").count() >= 1 && await p.locator(".rgroup .row").count() >= 1, "jump rows and grouped results");
  await p.locator("#q").fill("rose water"); await p.waitForTimeout(200);
  const none = await p.locator("[data-search-out]").innerText();
  ok(/on the shelf/.test(none) && /519-255-2222/.test(none) && await p.locator("[data-search-out] .way").count() >= 3, "no results is never a dead end");
  ok(await p.locator('[data-search-out] a[href="/shop"]').count() >= 1, "no results links to everything");
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(400);
  ok(await p.locator("#q").inputValue() === "rose water", "a reload keeps the search");
  // underlined words never break the name
  await p.locator("#q").fill("laziz mar"); await p.waitForTimeout(200);
  ok(!(await p.locator("[data-search-out] .row__n").allInnerTexts()).some(t => /[<>]/.test(t)), "matched words are underlined cleanly");
  // a brand link on the search page swaps the results in place
  await p.goto(B + "/search", { waitUntil: "load" }); const brand = p.locator(".pops a").first(), bname = await brand.innerText(); await brand.click(); await p.waitForTimeout(300);
  ok(await p.locator("#q").inputValue() === bname && await p.locator("[data-search-out] .row").count() > 0, "a brand on the search page shows its results");
  // phone: nothing wider than the screen, every control 44px
  for (const u of ["/shop/charcoal", "/shop/heat", "/search?q=coal"]) {
    await p.goto(B + u, { waitUntil: "load" }); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), u + " has no sideways scroll");
    const small = await p.evaluate(() => [...document.querySelectorAll(".qchip,.fbar__btn,.frow,.fshape,.way,.pops a,.row a,.jumps a")].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.className));
    ok(!small.length, u + " tap targets 44px: " + small.slice(0, 3));
  }
  ok(!errs.length, "no page errors: " + errs.slice(0, 2));
  // desktop: the rail applies at once
  const d = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await d.goto(B + "/shop/charcoal", { waitUntil: "load" }); await d.waitForSelector(".frail");
  ok(await d.locator(".frail").isVisible(), "desktop shows the rail");
  await d.locator('.frail [data-f-toggle="shape"][data-v="cube"]').click(); await d.waitForTimeout(200);
  ok(/shape=cube/.test(d.url()) && await d.locator(".grid--shop .card").count() === F.apply("charcoal", coal, { shape: ["cube"] }).length, "the rail filters at once");
} finally { await b.close(); }
console.log(f ? `FAIL ${f}/${n}` : `PASS ${n}/${n}`);
process.exit(f ? 1 : 0);
