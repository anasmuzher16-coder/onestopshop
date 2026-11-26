// Search and the phone keyboard (fx-wave.js holdKeyboard, 2026-11-26): a finger tap on Search focuses a stand-in field inside
// the tap (iOS and Android open the on-screen keyboard only for that), a mouse click does not (on Windows the early focus held a
// frame), and either way the real search field has the focus once the page is in. Chromium, motion on so the wave plays.
// Needs the store running. node store/tools/test-search-kbd.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
let n = 0, f = 0; const t = (name, c, extra = "") => { n++; if (!c) { f++; console.log("FAIL", name, extra); } };
// every stand-in the wave appends (a 1px, transparent search input outside #main) and whether it ever held the focus
const watch = () => { window.__proxy = { made: 0, focused: 0 }; new MutationObserver(ms => { for (const m of ms) for (const el of m.addedNodes) if (el.tagName === "INPUT" && el.type === "search" && el.tabIndex === -1 && !el.closest("#main")) { window.__proxy.made++; queueMicrotask(() => { if (document.activeElement === el) window.__proxy.focused++; }); } }).observe(document, { childList: true, subtree: true }); };   // the document itself: the init script runs before <html> exists
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
try {
  for (const [tag, opt, touch] of [["finger", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, true], ["mouse", { viewport: { width: 1440, height: 900 } }, false]]) {
    const ctx = await b.newContext(opt), p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.addInitScript(watch);
    await p.goto(B + "/shop", { waitUntil: "load" }); await p.waitForFunction(() => window.__wave, null, { timeout: 20000 }); await p.waitForTimeout(1500);
    const link = p.locator('a[href="/search"]:visible').first(); const box = await link.boundingBox();
    if (touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await link.click();
    await p.waitForURL("**/search**", { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(1600);
    const r = await p.evaluate(() => ({ ...window.__proxy, at: location.pathname, active: document.activeElement?.id || document.activeElement?.tagName, left: document.querySelectorAll('body > input[type="search"]').length }));
    t(`${tag}: Search opens`, r.at === "/search", JSON.stringify(r));
    if (touch) t(`${tag}: a stand-in field is focused inside the tap, so the keyboard opens`, r.made >= 1 && r.focused >= 1, JSON.stringify(r));
    else t(`${tag}: no stand-in field on a mouse click`, r.made === 0, JSON.stringify(r));
    t(`${tag}: the real search field has the focus once the page is in`, r.active === "q", JSON.stringify(r));
    t(`${tag}: no stand-in left behind`, r.left === 0, JSON.stringify(r));
    t(`${tag}: no page errors`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
} finally { await b.close(); }
console.log(f ? `FAIL ${f}/${n}` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
