import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const root = new URL("../site/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const port = +process.env.PORT || 4410;
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^([\/])+/, "");
  if (!p || p.endsWith("/") || p.endsWith("\\")) p += "index.html";
  if (p.includes("..")) { res.writeHead(400); return res.end(); }
  try { const b = await readFile(join(root, p)); res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end("not found"); }
}).listen(port, () => console.log("http://localhost:" + port));
