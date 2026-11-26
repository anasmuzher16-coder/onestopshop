import { createRequire } from "module";
const { chromium, webkit } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const B = process.env.BASE, GL = ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];
const R = [["hookahs", "/shop/hookahs"], ["heat", "/shop/heat"], ["bases", "/shop/bases"], ["bowls", "/shop/bowls"], ["hoses", "/shop/hoses"], ["parts", "/shop/parts"], ["cologne", "/shop/cologne"], ["misc", "/shop/misc"], ["home", "/"], ["all", "/shop"], ["set", "/set"], ["shipping", "/shipping"], ["search", "/search"], ["cart", "/cart"]];
let bad = 0;
for (const [n, t, a] of [["webkit", webkit, []], ["chromium", chromium, GL]]) {
  const b = await t.launch({ args: a }), p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = []; let ok = 0;
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && /fx-wave|shader/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForFunction(() => window.__wave, null, { timeout: 20000 }); await p.waitForTimeout(2000);
  for (const [k, h] of R) {
    if (await p.evaluate(() => location.pathname) === h) { await p.evaluate(() => { const a = document.createElement("a"); a.href = "/terms"; a.style.display = "none"; document.body.append(a); a.click(); }); await p.waitForTimeout(1100); await p.goto(B + "/shop/misc", { waitUntil: "load" }); await p.waitForTimeout(800); }
    const got = await p.evaluate(x => { let a = document.querySelector(`a[href="${x}"]`); if (!a) { a = document.createElement("a"); a.href = x; a.style.display = "none"; document.body.append(a); } a.click(); return window.__wave.active?.key || null; }, h);
    if (got === k) ok++; else { bad++; console.log("  miss", n, k, got); }
    await p.waitForTimeout(+(process.env.WAVE_SETTLE || 1050));
    const left = await p.evaluate(() => ({ active: !!window.__wave.active, op: window.__wave.canvas?.style.opacity, at: location.pathname })); if (left.active || left.op !== "0" || left.at !== h.split("?")[0]) { bad++; console.log("  stuck", n, k, JSON.stringify(left)); }
  }
  console.log(n, "waves played", ok + "/" + R.length, "shader or page errors", errs.length, errs[0] || ""); bad += errs.length; await b.close();
}
process.exit(bad ? 1 : 0);
