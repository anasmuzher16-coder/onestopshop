// TEMPORARY (CI diagnosis, ci-reliable branch): how fast Chromium draws the hookah page on GitHub's machines under each GL path,
// and how long a lost smoke context takes to hand over to the stills.
import { createRequire } from "node:module";
const pw = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
const V = [["default", {}], ["no-gpu-compositing", { args: ["--disable-gpu-compositing"] }], ["no-gpu-compositing+raster", { args: ["--disable-gpu-compositing", "--disable-gpu-rasterization"] }],
  ["in-process-gpu", { args: ["--in-process-gpu"] }], ["no-gpu-compositing+in-process", { args: ["--disable-gpu-compositing", "--in-process-gpu"] }], ["default again", {}]];
for (const [name, opt] of V) {
  let b; try { b = await pw.chromium.launch(opt); } catch (e) { console.log(name, "launch failed", e.message.split("\n")[0]); continue; }
  try {
    const p = await (await b.newContext({ ...pw.devices["iPhone 13"] })).newPage();
    await p.goto(B + "/shop/hookahs", { waitUntil: "load" }); await p.waitForTimeout(3000);
    const info = await p.evaluate(async () => {
      const g = document.createElement("canvas").getContext("webgl"), i = g && g.getExtension("WEBGL_debug_renderer_info");
      let n = 0; const t = performance.now(); await new Promise(r => { const f = () => { if (++n < 40) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
      return { renderer: i ? g.getParameter(i.UNMASKED_RENDERER_WEBGL).slice(0, 80) : "none", smoke: !!window.__smoke, msPerFrame: Math.round((performance.now() - t) / 40) };
    });
    let stillsAt = null;
    if (info.smoke) {
      await p.evaluate(() => { window.__t0 = performance.now(); window.__smoke.canvas.getContext("webgl").getExtension("WEBGL_lose_context").loseContext(); });
      for (let i = 0; i < 40 && stillsAt === null; i++) { await p.waitForTimeout(100); stillsAt = await p.evaluate(() => document.querySelector(".shophead > .smoke--still.smoke--bank.on") ? Math.round(performance.now() - __t0) : null); }
    }
    await p.goto(B + "/shop/bowls", { waitUntil: "load" }); await p.waitForTimeout(3000);
    const bowls = await p.evaluate(async () => { let n = 0; const t = performance.now(); await new Promise(r => { const f = () => { if (++n < 40) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return Math.round((performance.now() - t) / 40); });
    console.log(name, JSON.stringify({ ...info, stillsAt, bowlsMsPerFrame: bowls }));
  } catch (e) { console.log(name, "error", e.message.split("\n")[0]); }
  await b.close();
}
console.log("PASS probe done");
