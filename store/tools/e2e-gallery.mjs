// More photos of one item (products.img_more, 2026-11-28): the product page's gallery. Phone (Safari's engine, and Chrome with a
// real touch swipe): "1 / N" on the photo, a sideways swipe moves, an upward one does not, arrow keys move, a colour starts its own
// photos from 1, nothing on the page moves. Wide (Chrome): the photos as buttons on a plate inside the photo, a click and the arrow
// keys move, a row too long for its plate shows its arrows. Fails when any of it breaks. Needs the store running with the seed
// (the gallery items are read from the seed's img_more lines, so it never passes on a page without a gallery).
//   node store/tools/e2e-gallery.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { SEED_FILES, seedPath } from "./seed-files.mjs";
const { chromium, webkit } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const MORE = new Map(SEED_FILES.flatMap(file => [...readFileSync(seedPath(file), "utf8").matchAll(/^UPDATE products SET img_more = '([^']*)' WHERE sku = '(OSS-\d+)'/gm)].map(x => [x[2], JSON.parse(x[1])])));
t("the seed gives at least two items extra photos", MORE.size >= 2, String(MORE.size));
// an item with extra photos whose family has another colour with its own extra photos (the colour check), else the first one
const skus = [...MORE.keys()], SKU = skus[0], OTHER = skus.find(s => s !== SKU);
const state = p => p.evaluate(() => { const s = document.querySelector("[data-stage]"), shots = s ? [...s.querySelectorAll(":scope > .shot")] : [];
  const c = s && s.querySelector("[data-gal-n]"), g = s && s.querySelector(".gal");
  return { sku: s?.dataset.stage, gal: s?.dataset.gal, count: c?.textContent, countShown: !!c && getComputedStyle(c).display !== "none" && c.getBoundingClientRect().width > 0,
    plateShown: !!g && getComputedStyle(g).display !== "none" && g.getBoundingClientRect().width > 2, img: shots.at(-1) ? `${shots.at(-1).offsetWidth}x${shots.at(-1).offsetHeight}` : "", src: (shots.at(-1)?.currentSrc || shots.at(-1)?.src || "").replace(/^.*\/img\/pc\//, "").replace(/(-[sml])?\.webp.*$/, ""), shots: shots.length,
    say: s?.querySelector("[data-gal-say]")?.textContent || "", tile: s && [s.offsetTop, s.offsetHeight, s.offsetWidth].join(","), title: document.querySelector(".pdp__name")?.offsetTop, zoom: !!document.querySelector(".zoom:popover-open") }; });
const settle = async p => { await wait(450); await p.waitForFunction(() => document.querySelectorAll("[data-stage] > .shot").length === 1, null, { timeout: 4000 }).catch(() => {}); };

for (const [tag, type, ctx, touch] of [
  ["webkit390", webkit, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, "synthetic"],
  ["chromium390", chromium, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, "cdp"],
  ["chromium1440", chromium, { viewport: { width: 1440, height: 900 } }, null],
  ["chromium800-mouse", chromium, { viewport: { width: 800, height: 900 } }, null],   // a narrow window with a mouse gets the plate, not a swipe it cannot do
  ["chromium390-reduced", chromium, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" }, "cdp"]]) {
  const b = await type.launch();
  try {
    const c = await b.newContext(ctx), p = await c.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    const open = async (u, sel = "[data-stage] > .shot") => { await p.goto(B + u, { waitUntil: "domcontentloaded" }); await p.waitForSelector(sel, { state: "attached" }); await wait(600); };
    await open("/p/" + SKU);
    const s0 = await state(p), N = 1 + MORE.get(SKU).length, extra = MORE.get(SKU)[0].img;
    t(`${tag} the page has a gallery`, s0.gal === "0", JSON.stringify(s0));
    // layout is read from offsets: the product act springs the tile by 0.4% (fx-sections.js give), a transform, not a move
    // a swipe (or a pointer drag) from (x0,y) by (dx,dy), as a real touch in Chrome or as pointer events in Safari's engine
    const swipe = async (dx, dy = 0) => {
      const r = await p.evaluate(() => { const b = document.querySelector("[data-stage]").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      if (touch === "cdp") { const cdp = await c.newCDPSession(p); const pt = (x, y) => [{ x, y, id: 1 }];
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(r.x, r.y) });
        for (let k = 1; k <= 8; k++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(r.x + dx * k / 8, r.y + dy * k / 8) }); await wait(16); }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach();
      } else await p.evaluate(({ r, dx, dy }) => { const el = document.elementFromPoint(r.x, r.y), o = (x, y) => ({ bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x, clientY: y });
        el.dispatchEvent(new PointerEvent("pointerdown", o(r.x, r.y))); for (let k = 1; k <= 8; k++) el.dispatchEvent(new PointerEvent("pointermove", o(r.x + dx * k / 8, r.y + dy * k / 8)));
        el.dispatchEvent(new PointerEvent("pointerup", o(r.x + dx, r.y + dy)));
        // a sideways drag ends in a click on Safari (a page scroll does not): it must not open the zoom
        if (Math.abs(dx) > Math.abs(dy)) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: r.x + dx, clientY: r.y + dy })); }, { r, dx, dy });
    };
    if (touch) {
      t(`${tag} "1 / ${N}" shows on the photo, no plate`, s0.count === `1 / ${N}` && s0.countShown && !s0.plateShown, JSON.stringify(s0));
      await p.evaluate(() => scrollTo(0, 0)); await wait(100);
      await swipe(-160); await settle(p); const s1 = await state(p);
      t(`${tag} a swipe to the left shows photo 2`, s1.gal === "1" && s1.count === `2 / ${N}` && s1.src === extra && s1.shots === 1, JSON.stringify(s1));
      t(`${tag} the screen reader hears "Photo 2 of ${N}"`, s1.say === `Photo 2 of ${N}`, s1.say);
      t(`${tag} nothing on the page moved`, s1.tile === s0.tile && s1.title === s0.title && s1.img === s0.img, `${s0.tile}/${s0.title}/${s0.img} -> ${s1.tile}/${s1.title}/${s1.img}`);
      t(`${tag} the tap ending a swipe opens no zoom`, !s1.zoom);
      await swipe(160); await settle(p); const s2 = await state(p);
      t(`${tag} a swipe to the right goes back to photo 1`, s2.gal === "0" && s2.count === `1 / ${N}` && s2.src === s0.src, JSON.stringify(s2));
      await swipe(-30, -170); await settle(p); const s3 = await state(p);
      t(`${tag} an upward swipe leaves the photo alone`, s3.gal === "0" && s3.src === s0.src, JSON.stringify(s3));
      if (touch === "cdp") t(`${tag} an upward swipe still scrolls the page`, await p.evaluate(() => scrollY > 40), String(await p.evaluate(() => scrollY)));
      await p.evaluate(() => scrollTo(0, 0)); await wait(100);
    } else {
      const thumbs = await p.$$eval("[data-stage] .gal__t", l => l.map(b => ({ label: b.getAttribute("aria-label"), cur: b.getAttribute("aria-current"), tag: b.tagName, in: (() => { const r = b.getBoundingClientRect(), s = b.closest("[data-stage]").getBoundingClientRect(); return r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom && r.bottom <= innerHeight; })() })));
      t(`${tag} ${N} photo buttons on a plate inside the photo, in view, no count`, s0.plateShown && !s0.countShown && thumbs.length === N && thumbs.every((x, i) => x.tag === "BUTTON" && x.label === `Photo ${i + 1} of ${N}` && x.cur === String(i === 0) && x.in), JSON.stringify(thumbs));
      await p.click(`[data-stage] [data-gal-to="1"]`); await settle(p); const s1 = await state(p);
      t(`${tag} a click on photo 2 shows it`, s1.gal === "1" && s1.src === extra && s1.shots === 1 && await p.$eval(`[data-gal-to="1"]`, b => b.getAttribute("aria-current") === "true"), JSON.stringify(s1));
      t(`${tag} nothing on the page moved`, s1.tile === s0.tile && s1.title === s0.title && s1.img === s0.img, `${s0.tile}/${s0.title}/${s0.img} -> ${s1.tile}/${s1.title}/${s1.img}`);
      // quick clicks: the last one wins, and only its picture is left
      await p.click(`[data-stage] [data-gal-to="0"]`); await p.click(`[data-stage] [data-gal-to="1"]`); await p.click(`[data-stage] [data-gal-to="0"]`); await p.click(`[data-stage] [data-gal-to="1"]`); await settle(p); await wait(300);
      const rq = await state(p); t(`${tag} quick clicks end on the last photo clicked, one picture in the tile`, rq.gal === "1" && rq.src === extra && rq.shots === 1, JSON.stringify(rq));
      await p.focus(`[data-gal-to="1"]`); await p.keyboard.press("ArrowLeft"); await settle(p); const s2 = await state(p);
      t(`${tag} the left arrow on a photo button goes back and takes the focus along`, s2.gal === "0" && s2.src === s0.src && await p.evaluate(() => document.activeElement?.dataset.galTo === "0"), JSON.stringify(s2));
      // a plate too narrow for its row: the arrows and the fade come on, and an arrow scrolls the row
      await p.evaluate(() => { document.querySelector("[data-stage] .gal").style.maxWidth = "150px"; dispatchEvent(new Event("resize")); }); await wait(150);
      const over = await p.evaluate(() => { const g = document.querySelector("[data-stage] .gal"), on = g.querySelector(".gal__go--on"); return { over: g.hasAttribute("data-over"), more: g.hasAttribute("data-more-on"), arrow: getComputedStyle(on).display !== "none" }; });
      t(`${tag} a row longer than its plate shows the arrows and a fade`, over.over && over.more && over.arrow, JSON.stringify(over));
      await p.click("[data-stage] .gal__go--on"); await wait(600);
      t(`${tag} the arrow scrolls the row`, await p.evaluate(() => document.querySelector("[data-stage] .gal__row").scrollLeft > 0));
      await p.evaluate(() => { document.querySelector("[data-stage] .gal").style.maxWidth = ""; dispatchEvent(new Event("resize")); }); await wait(100);
    }
    // the arrow keys on the photo itself (the zoom's button)
    // the photo must be reachable by the keyboard whenever the zoom armed it (even if it armed a picture that was fading out)
    await p.waitForFunction(() => { const l = document.querySelectorAll("[data-stage] > .shot"); return l.length === 1 && l[0].tabIndex === 0; }, null, { timeout: 5000 }).catch(() => {});
    await p.focus("[data-stage] > .shot");
    t(`${tag} the photo takes the keyboard focus`, await p.evaluate(() => document.activeElement?.matches("[data-stage] > .shot") && document.activeElement.getAttribute("role") === "button"), await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)));
    await p.keyboard.press("ArrowRight"); await settle(p); const k1 = await state(p);
    t(`${tag} the right arrow on the photo shows photo 2 and keeps the focus on the photo`, k1.gal === "1" && k1.src === extra && await p.evaluate(() => document.activeElement?.matches("[data-stage] > .shot")), JSON.stringify(k1));
    // a redraw of the page (the cart changed in another tab) keeps the photo shown and the focus on it
    await p.evaluate(() => dispatchEvent(new StorageEvent("storage", { key: "oss:cart" }))); await wait(500); const rd = await state(p);
    t(`${tag} a redraw keeps photo 2 and the focus on the photo`, rd.gal === "1" && rd.src === extra && (!rd.count || rd.count === `2 / ${N}`) && await p.evaluate(() => document.activeElement?.matches("[data-stage] > .shot")), JSON.stringify(rd));
    await p.keyboard.press("Alt+ArrowLeft").catch(() => {}); await wait(300); t(`${tag} Alt+Left is left to the browser`, (await state(p)).gal !== "0" || p.url().includes("/p/" + SKU) === false);
    if (!p.url().includes("/p/" + SKU)) { await open("/p/" + SKU); await p.focus("[data-stage] > .shot"); }
    await p.keyboard.press("End"); await settle(p); t(`${tag} End shows the last photo`, (await state(p)).gal === String(N - 1));
    await p.keyboard.press("Home"); await settle(p); t(`${tag} Home shows the first photo`, (await state(p)).gal === "0");
    // another colour of the same family starts on its own first photo
    const fam = await p.$$eval("[data-stage] ~ * [role=radio][data-swatch], .pdp [role=radio][data-swatch]", l => l.map(b => b.dataset.swatch));
    const to = fam.find(s => s !== SKU && s === OTHER) || fam.find(s => s !== SKU);
    if (to) {
      await p.keyboard.press("ArrowRight"); await settle(p);
      await p.click(`.pdp [data-swatch="${to}"]`); await settle(p); const cs = await state(p), want = MORE.get(to);
      t(`${tag} a colour shows its own main photo, from photo 1`, cs.sku === to && (want ? cs.gal === "0" && cs.count === `1 / ${1 + want.length}` : cs.gal === undefined) && !cs.src.endsWith("-2"), JSON.stringify(cs));
    } else t(`${tag} the gallery item has another colour to pick`, false, SKU);
    t(`${tag} no page errors`, !errs.length, errs.join(" | "));
    // cards keep the main photo only: a card of the item shows its main photo and no gallery
    await open("/shop/bowls", "#main .card"); t(`${tag} cards and lists carry no gallery`, await p.evaluate(() => !document.querySelector(".card .gal, .card [data-gal-n]")));
    await c.close();
  } finally { await b.close(); }
}
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`);
process.exit(f ? 1 : 0);
