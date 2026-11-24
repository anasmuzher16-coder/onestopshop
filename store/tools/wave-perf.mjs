// Frame times for every section transition (fx-wave), tap by tap, on a throttled phone or a desktop.
//   BASE=http://127.0.0.1:4491 node tools/wave-perf.mjs            Chromium, 390x844 at 3x, 4x CPU slowdown
//   RATE=6 / VIEW=desk (1440x900 at 1x) / ENGINE=webkit (no CPU slowdown or long-task API there) / GPU=0 (software WebGL)
//   ROUNDS=2 walks every section twice: round 1 is the first tap ever (cold), round 2 is warm. PROFILE=1 adds the hottest functions.
// Per transition: p50, p95 and worst rAF gap from the tap to the wave's end, long tasks over 50 ms, and tap -> first moving frame.
import { createRequire } from "node:module";
const { chromium, webkit } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/+$/, ""), ENGINE = process.env.ENGINE === "webkit" ? "webkit" : "chromium";
const DESK = process.env.VIEW === "desk", RATE = +(process.env.RATE || (ENGINE === "webkit" ? 1 : 4)), ROUNDS = +(process.env.ROUNDS || 2), JSONOUT = process.env.JSON;
const R = (process.env.ONLY ? process.env.ONLY.split(",") : null);
const WALK = [["hookahs", "/shop/hookahs"], ["heat", "/shop/heat"], ["shisha", "/shop/shisha"], ["bases", "/shop/bases"], ["bowls", "/shop/bowls"], ["hoses", "/shop/hoses"], ["parts", "/shop/parts"], ["cologne", "/shop/cologne"], ["misc", "/shop/misc"], ["home", "/"], ["all", "/shop"], ["gifts", "/gifts/under-50"], ["set", "/set"], ["shipping", "/shipping"], ["search", "/search"], ["cart", "/cart"]].filter(([k]) => !R || R.includes(k));
const GPU = process.env.GPU === "0" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"];
const q = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + .5))]; };
const b = ENGINE === "webkit" ? await webkit.launch() : await chromium.launch({ args: GPU, channel: process.env.GPU === "0" ? undefined : "chromium" });   // full Chromium headless reaches the real (integrated) GPU here
const out = [];
try {
  const ctx = await b.newContext(DESK ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: ENGINE !== "webkit" ? true : undefined, hasTouch: true });
  await ctx.addInitScript(() => {
    const F = window.__fr = []; let last = 0;
    const loop = t => { const a = window.__wave?.active; F.push([t, a ? a.p : -1, a ? (a.phase === "cover" ? 0 : 1) : -1]); if (F.length > 4000) F.splice(0, 2000); requestAnimationFrame(loop); };
    requestAnimationFrame(loop); window.__lt = [];
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true }); } catch {}
    window.__tapAt = 0;
  });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  let cdp = null; if (ENGINE === "chromium") { cdp = await ctx.newCDPSession(p); }
  const renderer = await p.evaluate(() => { const g = document.createElement("canvas").getContext("webgl2"); const i = g && g.getExtension("WEBGL_debug_renderer_info"); return i ? g.getParameter(i.UNMASKED_RENDERER_WEBGL) : "?"; });
  await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(2500);
  if (cdp && RATE > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  console.log("before the first tap:", JSON.stringify(await p.evaluate(() => ({ gauge: window.__wave?.gauge ?? null, tier: window.__wave?.tier, res: window.__wave?.res, canvas: !!window.__wave?.canvas }))));
  for (let round = 1; round <= ROUNDS; round++) for (const [key, href] of WALK) {
    if (await p.evaluate(() => location.pathname) === href.split("?")[0]) { await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(1500); if (key === "misc") { await p.goto(B + "/shop/heat", { waitUntil: "load" }); await p.waitForTimeout(1500); } }
    await p.waitForTimeout(300);
    // a real tap: pointerdown, a human 70 ms, then the click
    const t0 = await p.evaluate(h => { let a = [...document.querySelectorAll(`a[href="${h}"]`)].find(x => x.getClientRects().length) || null; if (!a) { a = document.createElement("a"); a.href = h; a.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0"; document.body.append(a); } window.__tapEl = a;
      a.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true, pointerType: "touch" })); return performance.now(); }, href);
    await p.waitForTimeout(70);
    if (cdp && process.env.PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 250 }); await cdp.send("Profiler.start"); }
    const ev = []; let onData = null;
    if (cdp && process.env.TRACE) { onData = e => ev.push(...e.value); cdp.on("Tracing.dataCollected", onData); await cdp.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "toplevel"] } }); }
    const [tap, got] = await p.evaluate(() => { const t = performance.now(); window.__tapEl.click(); return [t, window.__wave?.active?.key || null]; });
    await p.waitForTimeout(1500);
    let hot = "";
    if (cdp && process.env.TRACE) {   // the main thread's own work by kind (style, layout, paint, decode, script), longest first
      const done = new Promise(r => cdp.once("Tracing.tracingComplete", r)); await cdp.send("Tracing.end"); await done; cdp.off("Tracing.dataCollected", onData);
      const main = ev.find(e => e.name === "thread_name" && e.args?.name === "CrRendererMain"), by = {};
      for (const e of ev) if (e.ph === "X" && e.dur && main && e.pid === main.pid && e.tid === main.tid && /^(UpdateLayoutTree|Layout|Paint|PrePaint|Layerize|Commit|Decode.*|ImageDecodeTask|ParseHTML|FunctionCall|EvaluateScript|RunTask|ThreadControllerImpl::RunTask|HitTest|ScrollableArea.*|IntersectionObserverController.*|MajorGC|MinorGC)$/.test(e.name)) by[e.name] = (by[e.name] || [0, 0, 0]), by[e.name][0] += e.dur / 1000, by[e.name][1] = Math.max(by[e.name][1], e.dur / 1000), by[e.name][2]++;
      hot = Object.entries(by).sort((a, b) => b[1][0] - a[1][0]).slice(0, 8).map(([k, [s, m, n]]) => `${k} ${Math.round(s)}ms (max ${Math.round(m)}, x${n})`).join(" | ");
    }
    if (cdp && process.env.PROFILE) {
      const { profile } = await cdp.send("Profiler.stop"), self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
      const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n);
      const name = n => { const f = n.callFrame; return `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`; };
      profile.samples.forEach((id, i) => { const n = byId.get(id), up = parent.get(id), k = (!n.callFrame.url && up && up.callFrame.url ? name(up) + " > " : "") + name(n); self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000); });   // a browser call (layout, drawImage) is named with the script line that made it
      hot = [...self].filter(([k]) => !/^\((idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => Math.round(v) + "ms " + k).join(" | ");
    }
    const r = await p.evaluate(([tap, t0]) => {
      const F = window.__fr.filter(f => f[0] >= tap - 40); let end = F.findLastIndex(f => f[1] >= 0); end = end < 0 ? F.length - 1 : Math.min(F.length - 1, end);   // the window runs to the last frame the wave was still live
      window.__dbg = F.slice(0, 12).map(f => f.map(x => Math.round(x * 100) / 100));
      const win = F.slice(0, end + 2).filter(f => f[0] >= tap), d = []; for (let i = 1; i < win.length; i++) d.push(win[i][0] - win[i - 1][0]);
      // a frame's sample shows the state the wave left in the frame before, or in this one if it ran first: so the first moving frame is
      // counted as the frame that shows movement (an upper bound, at most one frame late), never one from before the tap
      const mv = F.findIndex(f => f[0] >= tap && f[1] > 0), first = mv >= 0 ? F[mv][0] - tap : -1;
      const lt = window.__lt.filter(([s, du]) => s + du >= t0 && s <= (win.at(-1)?.[0] || tap + 1000)).map(([s, du]) => Math.round(du));
      return { dbg: d.length < 8 ? JSON.stringify(window.__dbg) : "", d, first: Math.round(first), lt, played: F.some(f => f[1] >= 0), dur: Math.round((win.at(-1)?.[0] || tap) - tap) };
    }, [tap, t0]);
    const row = { round, key, played: got === key, frames: r.d.length, p50: +q(r.d, .5).toFixed(1), p95: +q(r.d, .95).toFixed(1), worst: Math.round(Math.max(0, ...r.d)), firstMove: r.first, longTasks: r.lt.join(" ") || "-", ms: r.dur };
    out.push(row); if (hot) console.log(round, key, hot); if (r.dbg) console.log("short window", round, key, r.dbg);
  }
  console.log(`${ENGINE} ${DESK ? "1440x900@1" : "390x844@3"} cpu x${RATE} | ${renderer} | errors ${errs.length} ${errs[0] || ""}`);
  console.table(out);
  for (const rd of [...new Set(out.map(o => o.round))]) { const rows = out.filter(o => o.round === rd); console.log(`round ${rd}: worst p95 ${Math.max(...rows.map(o => o.p95))} ms, worst frame ${Math.max(...rows.map(o => o.worst))} ms, worst first move ${Math.max(...rows.map(o => o.firstMove))} ms, transitions with a long task ${rows.filter(o => o.longTasks !== "-").length}/${rows.length}`); }
  if (JSONOUT) (await import("node:fs")).writeFileSync(JSONOUT, JSON.stringify({ engine: ENGINE, desk: DESK, rate: RATE, renderer, rows: out }, null, 1));
} finally { await b.close(); }
