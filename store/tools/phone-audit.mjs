// Phone audit: every route x four phone sizes (+ landscape). Fails on: sideways scroll, tap targets under
// 44px, text under 12px, clipped text, controls hidden under the fixed dock or top bar at rest, broken images,
// console errors, and too much fixed chrome. One browser, closed at the end. Needs `node tools/serve.mjs`.
import { createRequire } from "node:module";
const { chromium } = createRequire("C:/dev/puckempire-arena/package.json")("playwright");
const base = process.env.BASE || "http://127.0.0.1:4420/";
const SIZES = [[360, 740], [375, 667], [390, 844], [412, 915], [844, 390]];
const ROUTES = ["", "shop", "shop/hookahs", "shop/bowls", "p/OSS-100024", "p/OSS-9616", "p/OSS-9104", "cart", "shipping", "set", "search", "gifts/under-50", "gifts/under-150", "shop/cologne", "shop/misc", "p/OSS-9308", "p/OSS-9113", "checkout", "privacy", "terms"];
const cart = [{ sku: "OSS-9601", qty: 1 }, { sku: "OSS-9308", qty: 1 }, { sku: "OSS-9104", qty: 2 }];
let n = 0, f = 0; const seen = new Set();
const fail = (where, msg) => { f++; const k = msg.replace(/\d+(\.\d+)?/g, "#"); if (!seen.has(where.split(" ")[0] + k)) { seen.add(where.split(" ")[0] + k); console.log("FAIL", where, msg); } };
const b = await chromium.launch();
try {
  for (const [w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(c => { localStorage.setItem("oss:cart", JSON.stringify(c)); localStorage.setItem("oss:postal", JSON.stringify("M5V 2T6")); }, cart);
    const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
    for (const r of ROUTES) {
      const where = `${r} ${w}x${h}`;
      await p.goto(base + r, { waitUntil: "networkidle" }); await p.reload({ waitUntil: "networkidle" });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
      await p.waitForLoadState("networkidle");
      const res = await p.evaluate(() => {
        const out = [], vw = innerWidth, vh = innerHeight, vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
        if (document.documentElement.scrollWidth > vw) out.push("sideways scroll: page is " + document.documentElement.scrollWidth + "px wide");
        // tap targets: the element or the label/link that wraps it must be at least 44px in both directions
        for (const e of document.querySelectorAll("a[href], button, input, summary, [tabindex='0']")) {
          if (!vis(e) || e.closest("dialog:not([open])")) continue;
          let r = e.getBoundingClientRect(); const lab = e.closest("label"); if (lab) r = lab.getBoundingClientRect();
          const cs = getComputedStyle(e), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
          const hgt = Math.max(r.height, e.offsetHeight), inline = cs.display === "inline";
          const tapH = inline ? parseFloat(cs.lineHeight) + padY : hgt; // inline links: line box plus padding is the hit area
          if (tapH < 43.5 || (r.width < 43.5 && !inline)) out.push(`tap target ${Math.round(r.width)}x${Math.round(tapH)}: ${(e.className || e.tagName).toString().slice(0, 40)} "${(e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 24)}"`);
        }
        // text size and clipping
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const small = new Set();
        while (walker.nextNode()) { const t = walker.currentNode, e = t.parentElement; if (!t.textContent.trim() || !e || !vis(e) || e.closest("dialog:not([open]),script,style")) continue;
          const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 12) small.add(`text ${fs}px: ${(e.className || e.tagName).toString().slice(0, 30)}`); }
        out.push(...small);
        for (const e of document.querySelectorAll("h1,h2,h3,.btn,.dock>*,.chips a,.card__name,.cat__name,.line__name")) {
          if (!vis(e)) continue; const r = e.getBoundingClientRect();
          if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible") out.push(`clipped text: ${(e.className || e.tagName)} "${e.innerText.trim().slice(0, 30)}"`);
          if (r.right > vw + 1 && !e.closest(".lineup__row,.resin__row,.chips")) out.push(`runs off screen: ${(e.className || e.tagName)} "${e.innerText.trim().slice(0, 30)}"`);
        }
        for (const i of document.querySelectorAll("#main img")) if (i.complete && !i.naturalWidth) out.push("broken image " + i.src.split("/").pop());
        // fixed chrome at rest
        const top = document.querySelector(".top").getBoundingClientRect(), dock = document.querySelector(".dock").getBoundingClientRect();
        const chrome = top.height + dock.height;
        if (chrome / vh > (vw > vh ? 0.36 : 0.2)) out.push(`fixed bars take ${Math.round(chrome)}px of ${vh}px (${Math.round(chrome / vh * 100)}%)`);
        // first screen: one h1, and the main action is visible and not under the dock
        if (document.querySelectorAll("h1").length !== 1) out.push("h1 count " + document.querySelectorAll("h1").length);
        const h1 = document.querySelector("h1")?.getBoundingClientRect();
        if (h1 && h1.top > dock.top - 20 && vh > 500) out.push(`h1 starts under the dock (y ${Math.round(h1.top)}, dock ${Math.round(dock.top)})`);
        const act = document.querySelector(".hero__cta .btn, .dock__buy");
        if (act && vh > 500) { const r = act.getBoundingClientRect(); if (r.bottom > vh + 1 || (r.bottom > dock.top + 1 && !act.closest(".dock"))) out.push(`main action not clear of the dock (bottom ${Math.round(r.bottom)}, dock ${Math.round(dock.top)})`); }
        return out;
      });
      n++; for (const m of res) fail(where, m);
    }
    for (const e of [...new Set(errs)]) fail(`${w}x${h}`, "console: " + e.slice(0, 120));
    await ctx.close();
  }
} finally { await b.close(); }
console.log(f ? `FAIL ${f} problems (${seen.size} distinct) across ${n} page checks` : `PASS ${n} page checks: ${ROUTES.length} routes x 5 phone sizes, no problems`);
process.exit(f ? 1 : 0);
