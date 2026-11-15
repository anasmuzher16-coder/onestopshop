// Debug probe: samples the section layer over time after arriving on a section page.
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const B = "http://127.0.0.1:4420", cat = process.argv[2] || "bases";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => console.log("PAGEERROR", e.message)); p.on("console", m => m.type() === "error" && console.log("CONSOLE", m.text()));
  await p.goto(B + "/shop", { waitUntil: "networkidle" }); await p.waitForFunction(() => window.__smoke); await p.waitForTimeout(500);
  await p.evaluate(c => { window.__log = []; window.__mo = new MutationObserver(ms => window.__log.push(Math.round(performance.now() - window.__t0) + "ms main changed")); window.__mo.observe(document.getElementById("main"), { childList: true });
    window.__t0 = performance.now(); history.pushState(null, "", "/shop/" + c); dispatchEvent(new Event("routechange")); }, cat);
  for (const t of [200, 400, 600, 800, 1100, 1500, 2200]) {
    await p.waitForTimeout(t === 200 ? 200 : 200);
    console.log(await p.evaluate(() => { const fx = document.querySelector(".shophead .fx"), kids = fx ? [...fx.children].map(k => k.className + ":" + (getComputedStyle(k).transform || "").slice(0, 34) + " op" + getComputedStyle(k).opacity) : null;
      return Math.round(performance.now() - window.__t0) + "ms fx=" + !!fx + " anims=" + document.getAnimations().length + " " + JSON.stringify(kids).slice(0, 260); }));
  }
  console.log((await p.evaluate(() => window.__log)).join(" | "));
} finally { await b.close(); }
