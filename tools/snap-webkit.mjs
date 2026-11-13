// node tools/snap-webkit.mjs <url> <out.png> : iPhone-sized screenshot in WebKit (the engine Safari uses)
import { createRequire } from "node:module";
const { webkit, devices } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const [url, out] = process.argv.slice(2);
const b = await webkit.launch();
try { const ctx = await b.newContext({ ...devices["iPhone 13"] }); const p = await ctx.newPage(); await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(1500); await p.screenshot({ path: out }); console.log(out); }
finally { await b.close(); }
