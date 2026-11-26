// Load-speed readout for the main pages on a mid-range phone profile (4x CPU slowdown, fast-4G-like network).
// node tools/perf.mjs            (BASE=https://... to point at the live site; default is the local store)
// Prints, per page, first visit and repeat visit: first paint, largest paint, when the page is usable,
// requests, bytes over the wire, long main-thread tasks, layout shift.
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420";
const PAGES = (process.env.PAGES || "/,/shop/hookahs,/p/OSS-1001,/set,/search,/cart").split(",");
const b = await chromium.launch(); const rows = [];
try {
  for (const path of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    for (const visit of ["first", "repeat"]) {
      const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8 * 1.0 * 4, uploadThroughput: 750e3 / 8 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      let bytes = 0, reqs = 0; cdp.on("Network.loadingFinished", e => { bytes += e.encodedDataLength; reqs++; });
      await p.addInitScript(() => {
        window.__p = { lcp: 0, cls: 0, long: 0, tbt: 0 };
        new PerformanceObserver(l => { for (const e of l.getEntries()) window.__p.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__p.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__p.long++; window.__p.tbt += Math.max(0, e.duration - 50); } }).observe({ type: "longtask", buffered: true });
      });
      await p.goto(B + path, { waitUntil: "load" });
      const ready = await p.evaluate(() => new Promise(res => { const t0 = performance.now(), tick = () => document.querySelector("#main > *") ? res(Math.round(performance.now())) : performance.now() - t0 > 15000 ? res(-1) : requestAnimationFrame(tick); tick(); }));
      await p.waitForTimeout(3500);
      const m = await p.evaluate(() => ({ ...window.__p, fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0, ttfb: performance.getEntriesByType("navigation")[0].responseStart }));
      rows.push({ page: path, visit, ttfb: Math.round(m.ttfb), firstPaint: Math.round(m.fcp), content: ready, largestPaint: Math.round(m.lcp), requests: reqs, kB: Math.round(bytes / 1024), longTasks: m.long, blockedMs: Math.round(m.tbt), shift: +m.cls.toFixed(3) });
      await p.close();
    }
    await ctx.close();
  }
} finally { await b.close(); }
console.table(rows);
