// Turns docs/FAQ.md and docs/HANDOUT.md into clean one-page PDFs (and PNG previews) for people who do not read markdown.
// node tools/docs-pdf.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
function md(src) {
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const open = t => { if (list !== t) { close(); out.push(`<${t}>`); list = t; } };
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]; let m;
    if (!l.trim()) { close(); continue; }
    if ((m = l.match(/^# (.+)/))) { close(); out.push(`<h1>${inline(m[1])}</h1>`); }
    else if ((m = l.match(/^## (.+)/))) { close(); out.push(`<h2>${inline(m[1])}</h2>`); }
    else if ((m = l.match(/^  - (.+)/))) { out.push(`<div class="sub">${inline(m[1])}</div>`); }
    else if ((m = l.match(/^- (.+)/))) { open("ul"); out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^\d+\. (.+)/))) { open("ol"); out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^\*\*(.+)\*\*$/))) { close(); out.push(`<div class="qa"><p class="q">${esc(m[1])}</p><p class="a">${inline(lines[++i] || "")}</p></div>`); }
    else { close(); out.push(`<p>${inline(l)}</p>`); }
  }
  close(); return out.join("\n");
}
const page = (body, tight) => `<!doctype html><meta charset="utf-8"><style>
@page{size:Letter;margin:${tight ? "13mm 16mm 12mm" : "10mm 17mm 8mm"}}
*{box-sizing:border-box}body{margin:0;font:${tight ? "10pt/1.38" : "9.1pt/1.3"} "Segoe UI",Arial,sans-serif;color:#1c1b19}
h1{font:700 ${tight ? "17pt" : "19pt"}/1.15 "Segoe UI",Arial,sans-serif;margin:0 0 5pt;letter-spacing:-.01em}
h1+p{margin:0 0 2pt;color:#55524c}h1+p+p{margin:0;color:#55524c}
h2{font:700 8.5pt/1.2 "Segoe UI",Arial,sans-serif;text-transform:uppercase;letter-spacing:.09em;color:#8a2b1c;margin:${tight ? "11pt" : "7pt"} 0 3.5pt;padding-top:6pt;border-top:1px solid #d9d5cc;break-after:avoid}
p{margin:0 0 5pt}ul,ol{margin:0;padding-left:15pt}li{margin:0 0 2.2pt}.sub{margin:0 0 3pt 15pt;color:#3a3833}
.cols{columns:2;column-gap:9mm}.qa{break-inside:avoid;margin:0 0 6pt}.q{font-weight:700;margin:0}.a{margin:0;color:#33312d}
.cols{margin-top:12pt;padding-top:9pt;border-top:1px solid #d9d5cc}.cols h2:first-child{margin-top:0;padding-top:0;border-top:0}a{color:inherit;text-decoration:none;font-weight:600}
footer{margin-top:10pt;padding-top:6pt;border-top:1px solid #d9d5cc;font-size:8.5pt;color:#77736b}
</style>${tight ? body.replace("<h2>", '<div class="cols"><h2>') + "</div>" : body}<footer>Dijji Softworks &middot; hello@dijji.ca</footer>`;
const b = await chromium.launch();
try {
  for (const [name, tight] of [["FAQ", true], ["HANDOUT", false]]) {
    const html = page(md(readFileSync(`docs/${name}.md`, "utf8")), tight);
    const p = await b.newPage({ viewport: { width: 816, height: 1056 } });
    await p.setContent(html);
    await p.pdf({ path: `docs/${name}.pdf`, format: "Letter", printBackground: true });
    const buf = readFileSync(`docs/${name}.pdf`);
    console.log(name, "pages", (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length, "bytes", buf.length);
    await p.close();
  }
} finally { await b.close(); }
