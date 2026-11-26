import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => console.log("PAGEERROR", e.message));
  await p.goto("http://127.0.0.1:4420/shop", { waitUntil: "networkidle" }); await p.waitForFunction(() => window.__smoke); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__t0 = performance.now(); history.pushState(null, "", "/shop/misc"); dispatchEvent(new Event("routechange")); });
  for (let i = 0; i < 5; i++) { await p.waitForTimeout(120);
    console.log(await p.evaluate(() => { const s = document.querySelector(".grid .sticker"), fx = document.querySelector(".shophead .fx"); return Math.round(performance.now() - window.__t0) + "ms fx=" + !!fx + " stickers=" + document.querySelectorAll(".grid .sticker").length + " anims=" + (s ? s.getAnimations().map(a => a.playState + "@" + Math.round(a.currentTime)).join(",") : "-") + " op=" + (s ? getComputedStyle(s).opacity : "-") + " cat=" + (document.querySelector(".shophead")?.dataset.cat); })); }
} finally { await b.close(); }
