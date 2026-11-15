// Where the main thread's time goes while a page loads (4x CPU slowdown). node tools/perf-profile.mjs /cart
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420", path = process.argv[2] || "/";
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start");
  await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true }); });
  await p.goto(B + path, { waitUntil: "load" }); await p.waitForTimeout(3000);
  const { profile } = await cdp.send("Profiler.stop");
  const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map(n => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame, k = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
  console.log("long tasks [start, ms]:", JSON.stringify(await p.evaluate(() => window.__lt)));
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => v.toFixed(0).padStart(5) + " ms  " + k).join("\n"));
  const marks = await p.evaluate(() => performance.getEntriesByType("resource").map(r => [Math.round(r.startTime), Math.round(r.responseEnd), r.name.split("/").slice(3).join("/").slice(0, 40)]).sort((a, b) => a[0] - b[0]).slice(0, 30));
  console.log(marks.map(m => m.join("\t")).join("\n"));
} finally { await b.close(); }
