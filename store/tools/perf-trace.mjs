// What the browser itself spends time on while a page loads (style, layout, paint, image decode, script), 4x CPU slowdown.
// node tools/perf-trace.mjs /        Prints main-thread time by kind, and the biggest single events.
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE || "http://127.0.0.1:4420", path = process.argv[2] || "/", HOLD = +(process.env.HOLD || 3000);
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const events = []; cdp.on("Tracing.dataCollected", e => events.push(...e.value));
  await cdp.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing", "loading"] } });
  await p.goto(B + path, { waitUntil: "load" }); await p.waitForTimeout(HOLD);
  const done = new Promise(r => cdp.once("Tracing.tracingComplete", r)); await cdp.send("Tracing.end"); await done;
  const main = events.find(e => e.name === "thread_name" && e.args?.name === "CrRendererMain"), nav = events.filter(e => e.name === "navigationStart").pop();
  const KINDS = { Layout: "layout", UpdateLayoutTree: "style", RecalculateStyles: "style", Paint: "paint", PrePaint: "paint", Layerize: "paint", Commit: "paint", "Decode Image": "image decode", "Decode LazyPixelRef": "image decode", "Draw LazyPixelRef": "image decode", ImageDecodeTask: "image decode", EvaluateScript: "script", FunctionCall: "script", "v8.compile": "script", "v8.compileModule": "script", "v8.evaluateModule": "script", TimerFire: "script", FireAnimationFrame: "script", EventDispatch: "script", RunMicrotasks: "script", ParseHTML: "parse", ParseAuthorStyleSheet: "parse", MajorGC: "gc", MinorGC: "gc", "V8.GC_MC_BACKGROUND_MARKING": "gc", RasterTask: "raster", GPUTask: "gpu", HitTest: "layout", IntersectionObserverController: "script", "IntersectionObserverController::computeIntersections": "layout" };
  const by = {}, byThread = {}, big = [];
  for (const e of events) {
    if (e.ph !== "X" || !e.dur) continue; const kind = KINDS[e.name]; if (!kind) continue;
    const onMain = main && e.pid === main.pid && e.tid === main.tid, ms = e.dur / 1000;
    if (onMain && ["layout", "style", "paint", "parse", "gc"].includes(kind) || onMain && ["EvaluateScript", "FunctionCall", "TimerFire", "FireAnimationFrame", "EventDispatch", "v8.compile", "v8.compileModule"].includes(e.name)) { by[kind] = (by[kind] || 0) + ms; if (ms > 25) big.push([Math.round((e.ts - (nav?.ts || 0)) / 1000), Math.round(ms), e.name, JSON.stringify(e.args?.data || e.args?.beginData || "").slice(0, 110)]); }
    else if (!onMain) byThread[kind] = (byThread[kind] || 0) + ms;
  }
  const r = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)]));
  console.log("main thread ms (script nests, so it can double-count):", r(by)); console.log("other threads ms:", r(byThread));
  console.log("layouts:", events.filter(e => e.name === "Layout" && e.ph === "X").length, "style recalcs:", events.filter(e => e.name === "UpdateLayoutTree" && e.ph === "X").length, "paints:", events.filter(e => e.name === "Paint" && e.ph === "X").length);
  const names = {}, late = {}; for (const e of events) if (e.ph === "X" && e.dur && main && e.pid === main.pid && e.tid === main.tid && KINDS[e.name]) { names[e.name] = (names[e.name] || 0) + e.dur / 1000; if ((e.ts - (nav?.ts || 0)) / 1000 > 2500) late[e.name] = (late[e.name] || 0) + e.dur / 1000; }
  console.log("main by event:", r(names)); console.log("after 2.5 s only (steady state):", r(late));
  console.log(big.sort((a, b) => b[1] - a[1]).slice(0, 18).map(x => x.join("\t")).join("\n"));
} finally { await b.close(); }
