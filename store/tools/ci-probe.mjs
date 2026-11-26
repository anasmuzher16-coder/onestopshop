// TEMPORARY (CI diagnosis, ci-reliable branch): what a lost WebGL context does on GitHub's machines, step by step.
import { createRequire } from "node:module";
const pw = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
const b = await pw.chromium.launch();
const ctx = await b.newContext({ ...pw.devices["iPhone 13"] }), p = await ctx.newPage();
p.on("console", m => console.log("console", m.type(), m.text().slice(0, 300)));
p.on("pageerror", e => console.log("pageerror", e.message));
await p.goto(B + "/shop/hookahs", { waitUntil: "load" }); await p.waitForTimeout(3000);
console.log("info", JSON.stringify(await p.evaluate(async () => {
  const g = document.createElement("canvas").getContext("webgl"), i = g && g.getExtension("WEBGL_debug_renderer_info");
  let n = 0; const t = performance.now(); await new Promise(r => { const f = () => { if (++n < 30) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  return { renderer: i ? g.getParameter(i.UNMASKED_RENDERER_WEBGL) : "?", smoke: !!window.__smoke, msPerFrame: Math.round((performance.now() - t) / 30), cores: navigator.hardwareConcurrency };
})));
await p.evaluate(() => {
  window.__log = []; const cv = window.__smoke.canvas;
  cv.addEventListener("webglcontextlost", () => __log.push(["lost", Math.round(performance.now() - __t0)]));
  cv.addEventListener("webglcontextrestored", () => __log.push(["restored", Math.round(performance.now() - __t0)]));
  let n = 0; const f = () => { window.__raf = ++n; requestAnimationFrame(f); }; requestAnimationFrame(f);
  window.__t0 = performance.now(); cv.getContext("webgl").getExtension("WEBGL_lose_context").loseContext();
});
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(500);
  console.log("step", JSON.stringify(await p.evaluate(() => ({ t: Math.round(performance.now() - __t0), raf: window.__raf, log: __log, hidden: document.hidden, canvases: document.querySelectorAll("canvas.smoke").length,
    stills: [...document.querySelectorAll(".smoke--still")].map(e => e.className + " in " + (e.parentNode && e.parentNode.className)) }))));
}
await b.close();
console.log("PASS probe done");
