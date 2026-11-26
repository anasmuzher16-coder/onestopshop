import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const b = await chromium.launch(process.env.SW ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } : {});
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => console.log("PAGEERROR", e.message, (e.stack || "").split("\n")[1] || "")); p.on("console", m => console.log("CONSOLE", m.type(), m.text().slice(0, 200)));
  await p.goto("http://127.0.0.1:4420/shop", { waitUntil: "networkidle" }); await p.waitForFunction(() => window.__smoke); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__t0 = performance.now(); let n = 0; const raf = requestAnimationFrame; window.__frames = () => n; (function f() { n++; raf(f); })(); history.pushState(null, "", "/shop/cologne"); dispatchEvent(new Event("routechange")); });
  console.log("webgl:", await p.evaluate(() => !!window.__smoke)); for (let i = 0; i < 5; i++) { await p.waitForTimeout(250);
    console.log(await p.evaluate(() => { const c = document.querySelector(".fx-spritz"); if (!c) return "no canvas"; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) lit++;
      return Math.round(performance.now() - window.__t0) + "ms canvas " + c.width + "x" + c.height + " lit pixels " + lit + " frames " + window.__frames(); })); }
} finally { await b.close(); }
