// TEMPORARY (CI diagnosis, ci-reliable branch): e2e-nav check 14 in WebKit, with the page's measurements over time.
import { createRequire } from "node:module";
const { webkit } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await webkit.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" }), p = await c.newPage();
p.on("pageerror", e => console.log("pageerror", e.message));
const m = (sku) => p.evaluate(s => ({ y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, ih: innerHeight, url: location.pathname,
  card: s && document.querySelector(`[data-piece="${s}"]`) ? Math.round(document.querySelector(`[data-piece="${s}"]`).getBoundingClientRect().top) : null,
  restoring: document.documentElement.classList.contains("restoring"), sr: history.scrollRestoration, cardH: getComputedStyle(document.documentElement).getPropertyValue("--card-h"),
  fonts: [...document.fonts].filter(f => f.status === "loaded").length + "/" + document.fonts.size }), sku);
await p.goto(B + "/shop/hookahs", { waitUntil: "domcontentloaded" }); await p.waitForSelector("#main > *"); await wait(350);
await p.evaluate(() => { const c = document.querySelectorAll("#main a[data-piece]")[9]; const r = c.getBoundingClientRect(); scrollTo(0, scrollY + r.top + r.height / 2 - (innerHeight + 70) / 2); }); await wait(250);
const pick = await p.evaluate(() => { const a = [...document.querySelectorAll("#main a[data-piece]")].find(x => { const r = x.getBoundingClientRect(); return r.top > 160 && r.bottom < innerHeight - 90; }); return Math.round(a.getBoundingClientRect().top); });
const sku = await p.evaluate(() => { const a = [...document.querySelectorAll("#main a[data-piece]")].find(x => { const r = x.getBoundingClientRect(); return r.top > 160 && r.bottom < innerHeight - 90; }); a.click(); return a.dataset.piece; });
console.log("list before tap", pick, sku);
await p.waitForURL(/\/p\//); await wait(300); console.log("product", JSON.stringify(await m()));
await p.evaluate(() => scrollTo(0, 300)); await wait(150); console.log("product after scrollTo 300", JSON.stringify(await m()));
await p.goBack();
for (const at of [0, 450, 1000, 2500]) { await wait(at ? at - (at === 450 ? 0 : at === 1000 ? 450 : 1000) : 0); console.log("back +" + at, JSON.stringify(await m(sku))); }
await p.goForward();
for (const at of [0, 450, 1000, 2500]) { await wait(at ? at - (at === 450 ? 0 : at === 1000 ? 450 : 1000) : 0); console.log("forward +" + at, JSON.stringify(await m())); }
await b.close();
console.log("PASS probe done");
