// node tools/snap.mjs <url> <out.png> [width] [fullPage]
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const [url, out, w = "1440", full = ""] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +w < 500 ? 844 : 900 } });
await p.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(e => console.log(e.message));
await p.waitForTimeout(1500); await p.screenshot({ path: out, fullPage: !!full }); await b.close(); console.log(out);
