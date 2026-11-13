// Load shift (CLS) and LCP on a throttled phone (Slow 4G, 4x CPU). One browser, closed at the end.
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const base = process.env.BASE || "https://onestopshop-preview.anas-dev.workers.dev/";
const b = await chromium.launch();
try {
  for (const r of (process.argv[2] || "#/,#/shop/hookahs,#/p/OSS-1027,#/cart").split(",")) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562, downloadThroughput: 180000, uploadThroughput: 84000 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await p.addInitScript(() => { window.__v = { cls: 0, lcp: 0, el: "" };
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver(l => { const e = l.getEntries().at(-1); window.__v.lcp = Math.round(e.startTime); window.__v.el = (e.element && (e.element.className || e.element.tagName)) + " " + (e.url || "").split("/").pop(); }).observe({ type: "largest-contentful-paint", buffered: true }); });
    await p.goto(base + r, { waitUntil: "networkidle", timeout: 80000 }); await p.waitForTimeout(800);
    const v = await p.evaluate(() => window.__v);
    console.log(r.padEnd(16), "CLS", v.cls.toFixed(3), "| LCP", v.lcp + " ms", "|", v.el);
    await ctx.close();
  }
} finally { await b.close(); }
