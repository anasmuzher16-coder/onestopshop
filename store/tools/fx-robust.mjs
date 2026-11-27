// Robustness checks for the section animations (fx-sections, fx-smoke) in a phone viewport.
// Needs the store running on http://127.0.0.1:4420 (same as tools/e2e.mjs). Prints PASS n/n or FAILs; exits non-zero on failure.
//   node tools/fx-robust.mjs                 Chromium, iPhone 13 viewport (390 x 844 at 3x)
//   ENGINE=webkit node tools/fx-robust.mjs   the same under WebKit (closest thing to Safari without a phone)
//   STATIC=1 node tools/fx-robust.mjs        only the source checks; no browser is launched
//   ONLY=hoses,misc                          limit the section walk
// About 4 minutes for all nine sections. Written by the round-two council; first run against a browser by the builder.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const base = (process.env.BASE || "http://127.0.0.1:4420/").replace(/\/*$/, "/");
const engine = process.env.ENGINE === "webkit" ? "webkit" : "chromium";
const PUB = (process.env.FX_PUBLIC || "C:/dev/onestopshop/store/public").replace(/\/*$/, "/");
let n = 0, f = 0, sk = 0;
const t = (name, ok, extra = "") => { n++; if (!ok) { f++; console.log("FAIL", name, extra); } };
const skip = (name, why) => { sk++; console.log("SKIP", name, "(" + why + ")"); };
const J = x => JSON.stringify(x);
const end = () => { console.log((f ? "FAIL " + f + "/" + n : "PASS " + n + "/" + n) + (sk ? "  skipped " + sk : "")); process.exit(f ? 1 : 0); };

// ---------- 0. source checks: no browser needed ----------
{
  const rd = x => { try { return readFileSync(PUB + x, "utf8"); } catch { return null; } };
  const css = rd("styles.css"), boot = rd("boot.js"), sec = rd("fx-sections.js"), smk = rd("fx-smoke.js");
  if (!css || !boot || !sec || !smk) skip("source checks", "no public folder at " + PUB);
  else {
    t("source: the zoom is hidden unless the browser proves it is open", !/:not\(\s*:popover-open/.test(css) && /\.zoom\{display:none\}/.test(css));
    t("source: boot.js only loads the zoom where popovers exist", /"popover" in HTMLElement\.prototype/.test(boot));
    t("source: a print rule hides the effect layers", /@media print\{[^}]*\.fx[^}]*display:none/.test(css));
    t("source: no blend modes", !/mix-blend-mode/.test(css));
    const a = smk.indexOf("const FRAG = `"), frag = a < 0 ? "" : smk.slice(a + 14, smk.indexOf("`;", a));
    t("source: the shader is plain ASCII with no backslash", frag.length > 500 && !/[^\x09\x0a\x0d\x20-\x7e]|\\/.test(frag));
    t("source: the shader refuses to build without high precision", /#ifndef GL_FRAGMENT_PRECISION_HIGH\s+#error/.test(frag));
    t("source: the lattice is wrapped and the clock is wrapped", /mod\(p,\s*256\.0\)/.test(frag) && /% 3600/.test(smk));
    const loose = sec.split("\n").filter(l => l.includes("linear(") && !/CSS\.supports/.test(l) && !/^\s*(\/\/|\?)/.test(l));
    t("source: every linear() easing in script sits behind the support test", loose.length === 0, loose.join(" | ").slice(0, 160));
    t("source: smoke takes the LAST observer entry, not any entry (B14)", !/es\.some\(/.test(smk));
    t("source: a mist canvas is zeroed on both exits (B15)", (sec.match(/cv\.width = cv\.height = 0/g) || []).length >= 2);
    t("source: a product act skips photo tiles (B16)", /host\.classList\.contains\("tile--photo"\)/.test(sec));
  }
  if (process.env.STATIC) end();
}

// ---------- browser ----------
const pw = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const b = await pw[engine].launch();
const errs = [];
async function open(opts = {}) {
  const ctx = await b.newContext({ ...pw.devices["iPhone 13"], ...opts }), p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => m.type() === "error" && errs.push(m.text()));
  p.on("response", r => { if (r.status() >= 400) errs.push(r.status() + " " + r.url()); });
  return p;
}
const wait = (p, ms) => p.waitForTimeout(ms);
const load = (p, path) => p.goto(base + path.replace(/^\//, ""), { waitUntil: "networkidle" });
// what route.js navigate() does: an in-site move, so "arrivals" counts up and the page change runs
const nav = (p, path) => p.evaluate(x => { history.pushState(null, "", x); dispatchEvent(new Event("routechange")); }, path);
// what app.js does on a postal code: the same page drawn again. Answers whether #main really was re-drawn.
const CODES = ["M5V 2T6", "N9A 1A1", "V6B 1A1", "H2Y 1C6"];
const redraw = (p, code) => p.evaluate(c => {
  const m = document.getElementById("main"), was = m.firstElementChild, i = document.getElementById("postal");
  i.value = c; document.querySelector("[data-postal-form]").requestSubmit();
  return m.firstElementChild !== was;
}, code);
const ready = (p, sel = ".shophead[data-cat] > .fx") => p.waitForSelector(sel, { state: "attached", timeout: 6000 }).then(() => true, () => false);
const mark = p => p.evaluate(() => { const h = document.querySelector(".shophead[data-cat]") || document.querySelector("[data-stage]"); window.__l = h && h.querySelector(":scope > .fx"); });
// every canvas made from now on is remembered, so a canvas that was dropped without being emptied can be counted
const record = p => p.evaluate(() => {
  if (window.__cv) { window.__cv.length = 0; return; }
  window.__cv = []; const make = document.createElement.bind(document);
  document.createElement = (tag, o) => { const e = make(tag, o); if (String(tag).toLowerCase() === "canvas") window.__cv.push(e); return e; };
});
const probe = p => p.evaluate(() => {
  const band = document.querySelector(".shophead[data-cat]"), stage = document.querySelector("[data-stage]"), host = band || stage;
  const cvs = [...document.querySelectorAll("canvas")], run = document.getAnimations().filter(a => a.playState === "running");
  const tg = a => a.effect && a.effect.target, inFx = a => { const e = tg(a); return !!(e && e.closest && e.closest(".fx")); };
  const cls = e => !e ? "?" : typeof e.className === "string" ? e.className : (e.className && e.className.baseVal) || e.tagName;
  const vis = [...document.querySelectorAll(".sticker")].filter(s => { const r = s.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; });
  const o = host && host.querySelector(":scope > .fx > .fx-obj"), r = o && o.getBoundingClientRect(), coil = [...document.querySelectorAll(".fx path")].find(n => n.style.strokeDasharray);
  return {
    layers: host ? host.querySelectorAll(":scope > .fx").length : 0, allLayers: document.querySelectorAll(".fx").length,
    objs: document.querySelectorAll(".fx-obj").length, objW: r ? Math.round(r.width) : 0, ink: o ? (() => { const g = o.querySelector("svg"), b = g && g.getBBox(); return b && b.width > 20 && b.height > 20 ? +getComputedStyle(g).opacity * +getComputedStyle(o).opacity : 0; })() : 0,   // the drawing is there, has a size and is not faded out
    fxCanvas: cvs.filter(c => c.closest(".fx")).length, stray: cvs.filter(c => !c.closest(".fx") && !c.classList.contains("smoke") && !(c.classList.contains("pour") && !matchMedia("(prefers-reduced-motion: reduce)").matches)).length,
    smoke: document.querySelectorAll(".smoke").length, smokeIn: host ? host.querySelectorAll(":scope > .smoke").length : 0,
    running: run.length, runningInFx: run.filter(inFx).length, names: run.slice(0, 5).map(a => (a.animationName || a.transitionProperty || "script") + "@" + cls(tg(a))),
    hidden: vis.filter(s => +getComputedStyle(s).opacity < 1).length, stickers: vis.length, loose: document.querySelectorAll(".puff,.fly").length,
    sameLayer: !!window.__l && !!host && host.querySelector(":scope > .fx") === window.__l,
    dash: coil ? coil.style.strokeDasharray : "",
    gone: o ? [...o.querySelectorAll(".kit0,.kit1,.kit2,.kit3,.ice,.mtag,.hline,.hlid,.hc,.coal,.recoil,.pipe,.rock,.shfresh,.sapples,.smint,.sleafa")].filter(n => getComputedStyle(n).opacity === "0").map(n => n.getAttribute("class")) : [],   // the parts of a drawing that are always on show at rest
    orphans: (window.__cv || []).filter(c => c.width * c.height > 0 && !c.isConnected && !(c.width === 64 && c.height === 64)).length, // 64 x 64 is the kept sprite
  };
});
// shisha: the apples settle onto the lid (an arrival and a tap alike). Read from the act's own keyframes: they start above the
// lid (an arrival) or are lifted off it (a tap), come down onto it (contact: the first frame back at y 0 after a frame above),
// squash there (wider and shorter), give one bounce (above the lid again after the squash) and end at rest; they never fade
// (always on show, so nothing pops). The mint stands behind them on the lid: it is one move on the apples' own clock (same delay
// and length, so it is still there to read whenever the apples are), up with them while they are up (same start, same highest
// point; else its bare stem shows under them), down when they land, turning only once they are down (its sway starts at contact,
// never before) and it does sway. A few units, a soft squash, one bounce: bounded, so a wild act fails too. The apple's leaf nods from contact to 120 ms after it, never before.
const shishaClock = p => p.evaluate(() => {
  const o = document.querySelector(".shophead .fx-obj"), a = o && o.querySelector(".sapples").getAnimations()[0], m = o && o.querySelector(".smint").getAnimations()[0], l = o && o.querySelector(".sleafa").getAnimations()[0];
  if (!a || !m || !l) return { missing: [!a && "apples", !m && "mint", !l && "leaf"].filter(Boolean) };
  const at = a.effect.getTiming(), k = a.effect.getKeyframes(), mt = m.effect.getTiming(), mk = m.effect.getKeyframes();
  const tf = f => { const n = (/translate\(0px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+),\s*([\d.]+)\)/.exec(f.transform || "") || []).slice(1).map(Number); return n.length === 3 ? { y: n[0], sx: n[1], sy: n[2], o: f.computedOffset } : null; };
  const tr = f => { const n = (/translate\(0px,\s*(-?[\d.]+)px\)\s*rotate\((-?[\d.]+)deg\)/.exec(f.transform || "") || []).slice(1).map(Number); return n.length === 2 ? { y: n[0], r: n[1], o: f.computedOffset } : null; };
  const F = k.map(tf), M = mk.map(tr); if (F.some(f => !f) || M.some(f => !f)) return { bad: "a keyframe of another shape", k: k.map(f => f.transform), mk: mk.map(f => f.transform) };
  const c = F.findIndex((f, i) => i > 0 && f.y === 0 && F[i - 1].y < 0), sq = F.findIndex((f, i) => i > c && f.sx > 1 && f.sy < 1), bo = F.findIndex((f, i) => i > sq && f.y < 0), last = F[F.length - 1];
  if (c <= 0) return { land: null, k: k.map(f => f.transform) };
  const co = F[c].o, land = Math.round(at.delay + co * at.duration), up = F.slice(0, c).map(f => f.y), mUp = M.filter(f => f.o < co).map(f => f.y);
  const turn = M.findIndex(f => f.r !== 0), mintAt = turn > 0 ? Math.round(mt.delay + M[turn - 1].o * mt.duration) : null;
  return { land, mint: mintAt, leaf: Math.round(l.effect.getTiming().delay), dur: at.duration, squash: sq > c, bounce: bo > sq && sq > 0,
    rest: last.y === 0 && last.sx === 1 && last.sy === 1, few: Math.min(...up) >= -10 && F.every(f => f.y >= -10 && f.sx <= 1.12 && f.sy >= .86), once: F.filter((f, i) => i > c && f.y < 0).length === 1, fade: k.some(f => f.opacity !== undefined) || mk.some(f => f.opacity !== undefined),
    ride: mt.delay === at.delay && mt.duration === at.duration && mUp.length > 0 && mUp[0] === up[0] && Math.min(...mUp) === Math.min(...up)
      && M.filter(f => f.o >= co).every(f => f.y === 0) && M.filter(f => f.o < co).every(f => f.r === 0) && M[M.length - 1].r === 0 };
});
const inStep = c => !!c && c.land != null && c.squash && c.bounce && c.few && c.once && c.rest && !c.fade && c.ride && c.mint != null && Math.abs(c.mint - c.land) <= 1 && c.leaf >= c.land - 1 && c.leaf - c.land <= 120;   // 1 ms: both are rounded
// lowest opacity an element shows over a stretch of frames (catches a label that blinks off and on)
const lowest = (p, sel, ms) => p.evaluate(([sel, ms]) => new Promise(done => {
  let m = 1, seen = false; const t0 = performance.now();
  const step = () => { const e = document.querySelector(sel); if (e) { seen = true; m = Math.min(m, +getComputedStyle(e).opacity); } performance.now() - t0 < ms ? requestAnimationFrame(step) : done(seen ? m : -1); };
  step();
}), [sel, ms]);
// the object's square against the title's text box (a Range over the h1, as fit() measures it) and the band
const clear = p => p.evaluate(() => {
  const h1 = document.querySelector(".shophead h1"), o = document.querySelector(".shophead > .fx > .fx-obj"); if (!h1 || !o) return { ok: false, why: "no title or no object" };
  const r = document.createRange(); r.selectNodeContents(h1);
  // the title's ink, not its tall line box: the bottom is the heading's own box, less the tail room when the title has no tails
  const R = r.getBoundingClientRect(), T = { left: R.left, right: R.right, top: R.top, bottom: Math.min(R.bottom, h1.getBoundingClientRect().bottom) - (/[gjpqy,]/.test(h1.textContent) ? 0 : 10) }, O = o.getBoundingClientRect(), B = o.closest(".shophead").getBoundingClientRect(), rd = x => Math.round(x);
  const bleed = o.classList.contains("bleed"); // by design: the nut on a phone runs off the bottom-right corner, and what must stay clear of the title is its ink (a circle .42 of its size)
  const cx = (O.left + O.right) / 2, cy = (O.top + O.bottom) / 2, dx = Math.max(T.left - cx, 0, cx - T.right), dy = Math.max(T.top - cy, 0, cy - T.bottom);
  const hit = bleed ? Math.hypot(dx, dy) < O.width * .42 : O.left < T.right - 1 && O.right > T.left + 1 && O.top < T.bottom - 1 && O.bottom > T.top + 1;
  return { ok: !hit && O.width >= 44 && (bleed || O.right <= B.right + 1) && O.left >= B.left - 1, hit, bleed, obj: [rd(O.left), rd(O.top), rd(O.right), rd(O.bottom)], title: [rd(T.left), rd(T.top), rd(T.right), rd(T.bottom)], w: innerWidth };
});

// ---------- 1. what is in the shop ----------
const p = await open();
await load(p, "");
const shop = await p.evaluate(async () => { const m = await import("/api/catalog-module"); return { cats: m.CATEGORIES.map(c => c.id), prods: m.PRODUCTS.map(x => ({ sku: x.sku, cat: x.cat, photo: !!(x.dark || x.photo), img: !!x.img })) }; });
const only = (process.env.ONLY || "").split(",").filter(Boolean);
const SECS = ["hookahs", "shisha", "bases", "bowls", "heat", "charcoal", "hoses", "parts", "cologne", "misc"].filter(c => shop.cats.includes(c) && (!only.length || only.includes(c)));
const CANVAS = new Set([]), LONG = new Set(["hookahs", "hoses"]), SMOKY = new Set(["hookahs"]);
// a piece with a drawn-on-tile photo (the act plays on it); since the samples came off (2026-11-24) some sections hold items with no photo yet
const pick = c => shop.prods.find(x => x.cat === c && !x.photo && x.img) || shop.prods.find(x => x.cat === c && !x.photo) || shop.prods.find(x => x.cat === c);
t("the shop has the ten sections (charcoal its own since 2026-11-24, shisha its own act since 2026-11-26)", SECS.length === 10 || only.length > 0, SECS.join(","));

// ---------- 2. every section: direct load, in-site arrival, three re-draws, six seconds on, five taps ----------
for (const c of SECS) {
  await load(p, "shop/" + c);
  t(c + ": the layer appears on a direct load", await ready(p));
  let q = await probe(p);
  t(c + ": one layer and one object on a direct load", q.layers === 1 && q.allLayers === 1 && q.objs === 1 && q.objW >= 44, J(q));
  if (c === "misc" && shop.prods.some(x => x.cat === "misc")) t("misc: a direct load never hides a price already on screen", (await lowest(p, ".grid .card .sticker", 1200)) === 1);
  // a section with no stock online (2026-11-24): the band still plays its act over the coming-soon state, which is on the page
  if (!shop.prods.some(x => x.cat === c)) t(c + ": with no stock online the coming-soon state is on the page", await p.locator(".soon .soon__slot").count() === 1);

  await nav(p, "/"); await wait(p, 500);
  await nav(p, "/shop/" + c); const t0 = Date.now(); await wait(p, 500);
  q = await probe(p);
  t(c + ": one layer on an in-site arrival", q.layers === 1 && q.allLayers === 1, J(q));
  t(c + ": the act is playing", q.runningInFx > 0, J(q));
  // Sampled on the act's own clock, not 500 ms of wall time after the arrival: the act is made when the page lands (after the
  // fetch and the wave), and on GitHub's 2-core software-GL machines that, and the frames, ran late. The failures there read
  // opacity 0 at y -51 (the tongs' track had not begun 500 ms after the arrival) or y 4-20 (still coming down). The tongs are
  // down from 400 ms into their track until 610 ms; the first frame at 350 ms or later is read (a frame of up to 260 ms
  // still lands inside the hold), in that frame, so what is read is what the act draws at that moment.
  if (c === "bowls") { const b = await p.evaluate(() => new Promise(done => { const t0 = performance.now(); const step = () => {
      const o = document.querySelector(".shophead .fx-obj"), g = o && o.querySelector(".tongs"), a = g && g.getAnimations()[0];
      const at = a && a.currentTime != null ? a.currentTime - a.effect.getTiming().delay : null;
      if ((at == null || at < 350) && performance.now() - t0 < 6000) return requestAnimationFrame(step);
      done(g ? { opacity: +getComputedStyle(g).opacity, y: g.getBoundingClientRect().bottom - o.getBoundingClientRect().top, h: o.getBoundingClientRect().height, at: at == null ? null : Math.round(at) } : null); };
    step(); }));
    t("bowls: mid-act the tongs are in view and down at the bowl", !!b && b.opacity > .9 && b.y > b.h * .2 && b.y < b.h * .55, J(b)); }
  if (c === "shisha") { const d = await p.evaluate(() => { const o = document.querySelector(".shophead .fx-obj"), n = o && o.querySelector(".sapples"); return n ? { apples: n.getAnimations().filter(a => a.playState === "running").length, mint: o.querySelector(".smint").getAnimations().length, leaf: o.querySelector(".sleafa").getAnimations().length } : null; });
    t("shisha: mid-act the apples, the mint and the apple's leaf are all in the act", !!d && d.apples > 0 && d.mint > 0 && d.leaf > 0, J(d));
    const ck = await shishaClock(p); t("shisha: the apples come down onto the lid, squash, bounce once and sit; the mint sways as they land (arrival)", inStep(ck), J(ck)); }
  await wait(p, 650); q = await probe(p);
  if (CANVAS.has(c)) t(c + ": its canvas is up mid-act", q.fxCanvas === 1, J(q));
  await mark(p);
  for (let i = 0; i < 3; i++) {
    const did = await redraw(p, CODES[i]); await wait(p, i ? 250 : 80); q = await probe(p);
    t(`${c}: re-draw ${i + 1} really re-drew the page`, did);
    t(`${c}: exactly one layer after re-draw ${i + 1}, and it is the same layer`, q.layers === 1 && q.allLayers === 1 && q.sameLayer, J(q));
    if (!i && CANVAS.has(c)) t(c + ": the canvas carries on across a re-draw", q.fxCanvas === 1, J(q));
    if (!i && LONG.has(c)) t(c + ": the moves carry on across a re-draw", q.runningInFx > 0, J(q));
  }
  await wait(p, Math.max(0, 6200 - (Date.now() - t0))); q = await probe(p);
  t(c + ": no effect canvas 6 s after the entrance", q.fxCanvas === 0 && q.stray === 0, J(q));
  t(c + ": the only canvas left is the smoke, and only where smoke belongs", q.smoke <= 1 && (c === "hookahs" || q.smoke === 0), J(q));
  t(c + ": nothing loose on the page, every price showing", q.loose === 0 && q.hidden === 0, J(q));
  if (c === "bowls") { const b = await p.evaluate(() => { const o = document.querySelector(".shophead .fx-obj"); if (!o) return null; const cs = n => getComputedStyle(o.querySelector(n));
    return { tongs: cs(".tongs").opacity, coals: o.querySelectorAll(".coal").length, front: cs(".c1").transform + " " + cs(".c1").opacity, glow: cs(".e1").opacity, flash: cs(".c1 .fl").opacity, moving: o.getAnimations({ subtree: true }).filter(a => a.playState === "running" && a.effect.getTiming().duration < 1300).length }; });
    t("bowls: three coals at rest with their light, tongs gone, nothing still moving", !!b && b.tongs === "0" && b.coals === 3 && /matrix\(1, 0, 0, 1, 67, 37\.4\) 1$/.test(b.front) && b.glow === "0.9" && b.flash === "0" && b.moving === 0, J(b)); }
  if (c === "hoses") t("hoses: the drawn hose keeps no dash", q.dash === "none" || q.dash === "", q.dash);
  if (c === "shisha") { const d = await p.evaluate(() => { const o = document.querySelector(".shophead .fx-obj"); if (!o) return null; const cs = n => getComputedStyle(o.querySelector(n));
    return { apples: cs(".sapples").transform + " " + cs(".sapples").opacity, mint: cs(".smint").transform, leaf: cs(".sleafa").transform, moving: o.getAnimations({ subtree: true }).filter(a => a.playState === "running" && a.effect.getTiming().duration < 1300).length }; });
    t("shisha: at rest the apples sit on the lid where they are drawn, the mint and the leaf are home, nothing still moving", !!d && d.apples === "none 1" && d.mint === "none" && d.leaf === "none" && d.moving === 0, J(d)); }

  // five taps. A tap while the band's act is still moving is left alone by design (fx-sections.js), so whether the fifth tap lands
  // inside the fourth tap's act used to depend on how long each click took (about a second each on the laptop against a 1.7 s
  // hookah act): it often did, was rightly left alone, and the act had ended by the check below. The fifth tap now waits until the
  // band is still (at most 4 s), so the check always asks what it means to: does a tap play the act again.
  await record(p);
  const band = p.locator(".shophead[data-cat]");
  for (let i = 0; i < 5; i++) {
    if (i === 4) t(c + ": the band comes to rest before the fifth tap", await p.waitForFunction(() => { const l = document.querySelector(".shophead[data-cat] > .fx"); return !l || !l.querySelector("canvas") && l.getAnimations({ subtree: true }).every(a => a.playState !== "running" && !a.pending); }, null, { timeout: 4000 }).then(() => true, () => false));
    await band.click({ position: { x: 8, y: 8 } });
    if (i === 2 && c === "misc") { await wait(p, 200); t("misc: a tap never hides a price already on screen", (await probe(p)).hidden === 0); await wait(p, 700); }
    else if (i < 4) await wait(p, 900);
  }
  await wait(p, 500); q = await probe(p);
  t(c + ": a tap plays the act again", q.runningInFx > 0 || q.fxCanvas === 1, J(q));
  if (c === "shisha") { const ck = await shishaClock(p); t("shisha: a tap lifts the apples and settles them again, the mint on the same clock (the quick version)", inStep(ck) && ck.dur < 1000, J(ck)); }
  t(c + ": one layer and at most one canvas after five taps", q.layers === 1 && q.allLayers === 1 && q.fxCanvas <= 1 && q.stray === 0, J(q));
  await wait(p, 6000); q = await probe(p);
  t(c + ": one layer, no canvas, every price showing 6 s after the taps", q.layers === 1 && q.fxCanvas === 0 && q.stray === 0 && q.hidden === 0, J(q));
  t(c + ": no dropped canvas still holds memory", q.orphans === 0, "orphans " + q.orphans);
}

// ---------- 3. one product page per category ----------
for (const c of shop.cats) {
  const pr = pick(c); if (!pr) { skip(c + " product page", "no product in this category"); continue; }
  const wants = c === "hookahs" ? 0 : 1, smoky = SMOKY.has(c) && !pr.photo;
  if (c === "misc") { // the label has been on screen since first paint; the effects arrive after the load event
    await p.goto(base + "p/" + pr.sku, { waitUntil: "load" });
    t("misc product: a direct load never hides the price already on screen", (await lowest(p, "[data-stage] .sticker", 1800)) === 1);
  } else await load(p, "p/" + pr.sku);
  await wait(p, 1500); await mark(p); let q = await probe(p);
  t(`${c} product ${pr.sku}: ${wants} effect layer in the stage`, q.layers === wants && q.allLayers === wants, J(q));
  if (smoky) t(`${c} product: one smoke layer in the stage, showing`, q.smokeIn === 1 && q.smoke === 1 && (await lowest(p, "[data-stage] > .smoke", 100)) >= 0.95, J(q));
  for (let i = 0; i < 3; i++) {
    const did = await redraw(p, CODES[i + 1]);
    const low = smoky ? await lowest(p, "[data-stage] > .smoke", 400) : 1; q = await probe(p);
    t(`${c} product: re-draw ${i + 1} keeps one layer`, did && q.layers === wants && q.allLayers === wants && (!wants || q.sameLayer), J(q));
    if (smoky) t(`${c} product: the smoke does not blink on re-draw ${i + 1}`, low >= 0.95 && q.smoke === 1, "lowest opacity " + low);
  }
  if (wants) { // arriving from the section, the way a shopper does
    const moving = () => p.evaluate(() => { const i = document.querySelector("[data-stage] > img.shot"); return i ? i.getAnimations().filter(a => a.playState === "running").length : -1; });
    await nav(p, "/shop/" + c); await wait(p, 700); await nav(p, "/p/" + pr.sku); await wait(p, 600);
    if (!pr.photo) t(`${c} product: the photo itself is doing its act`, (await moving()) > 0, "running moves on the photo: " + await moving());
    if (!pr.photo && (c === "hoses" || c === "bases")) { const did = await redraw(p, CODES[0]); await wait(p, 80); t(`${c} product: a re-draw in mid-act hands the move to the new photo`, did && (await moving()) > 0, "running moves on the new photo: " + await moving()); }
    await wait(p, 500); q = await probe(p);
    t(`${c} product: one layer on an in-site arrival`, q.layers === 1 && q.allLayers === 1, J(q));
    if (c === "cologne" && !pr.photo) t("cologne product: the mist is in the air", q.fxCanvas === 1, J(q));
    if (c === "charcoal" && !pr.photo) t("charcoal product: the box's tap throws its coal dust", q.fxCanvas >= 1, J(q));   // its own act since 2026-11-26
    await wait(p, 7400); q = await probe(p); // the product-page mist hangs in the air for about six seconds
    t(`${c} product: no canvas 8 s on, price showing`, q.fxCanvas === 0 && q.stray === 0 && q.hidden === 0, J(q));
    const rest = await p.evaluate(() => { const i = document.querySelector("[data-stage] > img.shot"); return i ? getComputedStyle(i).transform + " | " + i.getAnimations().length : "no photo"; });
    t(`${c} product: the photo is back at rest, holding nothing`, rest === "none | 0", rest);
  }
}

// ---------- 4. back and forward ----------
{
  const c = ["cologne", ...SECS].find(x => SECS.includes(x) && shop.prods.some(y => y.cat === x && y.cat !== "hookahs")) || SECS[0];   // a section with cards to open
  await load(p, "shop/" + c); await ready(p); await wait(p, 600);
  await p.locator(".grid [data-piece]").first().click(); await p.waitForURL(/\/p\//); await wait(p, 900);
  for (const [step, name] of [[() => p.goBack(), "back"], [() => p.goForward(), "forward"], [() => p.goBack(), "back again"]]) {
    await step(); await wait(p, 1000); const q = await probe(p), onShop = /\/shop\//.test(new URL(p.url()).pathname);
    t(`${name}: one layer where one belongs (${onShop ? "section" : "product"})`, onShop ? q.layers === 1 && q.allLayers === 1 : q.allLayers <= 1 && q.layers === q.allLayers, J(q));
  }
  await wait(p, 6000); const q = await probe(p);
  t("back and forward: no canvas left, one layer", q.fxCanvas === 0 && q.stray === 0 && q.layers === 1 && q.hidden === 0, J(q));
}

// ---------- 5. resize 390 to 1440 and back: the object stays clear of the title ----------
for (const c of SECS) {
  await p.setViewportSize({ width: 390, height: 844 }); await load(p, "shop/" + c); await ready(p); await wait(p, 300);
  for (const [w, h] of [[390, 844], [1440, 900], [390, 844], [844, 390]]) {
    await p.setViewportSize({ width: w, height: h }); await wait(p, 450);
    const k = await clear(p); t(`${c}: object clear of the title at ${w} wide`, k.ok, J(k));
  }
  const q = await probe(p); t(c + ": still one layer after resizing", q.layers === 1 && q.allLayers === 1, J(q));
}
await p.setViewportSize({ width: 390, height: 844 });

// ---------- 6. layer order, print, a lost context ----------
if (SECS.includes("hookahs")) {
  await load(p, "shop/hookahs"); await ready(p); await wait(p, 800);
  const z = await p.evaluate(() => { const g = s => { const e = document.querySelector(s); return e ? parseInt(getComputedStyle(e).zIndex, 10) : null; }; return { fx: g(".shophead > .fx"), smoke: g(".shophead > .smoke") }; });
  if (z.smoke === null) skip("hookahs: smoke under the object", "no smoke layer in this browser"); else t("hookahs: the smoke bank sits under the object", z.smoke < z.fx, J(z));
  await p.emulateMedia({ media: "print" });
  const shown = await p.evaluate(() => [...document.querySelectorAll(".fx,.smoke,.puff,.fly")].filter(e => getComputedStyle(e).display !== "none").length);
  t("print: no effect layer prints", shown === 0, "showing " + shown);
  await p.emulateMedia({ media: "screen" });
  if (await p.evaluate(() => !!(window.__smoke && window.__smoke.canvas.getContext("webgl").getExtension("WEBGL_lose_context")))) {
    const t1 = Date.now(); await p.evaluate(() => window.__smoke.canvas.getContext("webgl").getExtension("WEBGL_lose_context").loseContext());
    // The page gives the context 2 s to come back, then takes the canvas out, puts the stills in and fades them on two frames
    // later (fx-smoke.js toStills, place). Read at a fixed 2.7 s of wall time, GitHub's 2-core software-GL machines caught the
    // one state in between: {"stills":0,"live":0}, the canvas gone and the stills in but not yet on (runs 45951384375,
    // 45954276171). So the check reads on the page's own steps: the canvas must be gone within the same 2.7 s of the loss as before,
    // then three frames for the fade, then it reads.
    const gone = await p.waitForFunction(() => !document.querySelector("canvas.smoke"), null, { timeout: Math.max(1, 2700 - (Date.now() - t1)) }).then(() => Date.now() - t1, () => -1);
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const s = await p.evaluate(() => ({ stills: document.querySelectorAll(".shophead > .smoke--still.smoke--bank.on").length, live: document.querySelectorAll("canvas.smoke").length })); s.goneAfter = gone;
    t("a lost context that does not come back is replaced by the stills", s.stills === 1 && s.live === 0, J(s));
  } else skip("lost context", "no live WebGL smoke in this browser");
}

// ---------- 7. ?still shows the stills ----------
{
  const s = await open();
  if (SECS.includes("hookahs")) {
    await load(s, "shop/hookahs?still"); const got = await ready(s, ".shophead > .smoke--still"); await wait(s, 600);
    const k = await s.evaluate(() => { const e = document.querySelector(".shophead > .smoke--still"); return e ? { cls: e.className, i: e.children.length, bg: getComputedStyle(e.firstElementChild).backgroundImage, live: document.querySelectorAll("canvas.smoke").length, op: +getComputedStyle(e).opacity } : null; });
    t("?still: the hookah page shows the smoke still on its black ground, no live smoke", await s.evaluate(() => document.documentElement.classList.contains("pour-still") && !document.querySelector("canvas.pour") && /pour-still/.test(getComputedStyle(document.body, "::before").backgroundImage)));
    t("?still: the hookah band shows the bank stills, no live canvas", got && k && /smoke--bank/.test(k.cls) && /\bon\b/.test(k.cls) && k.i === 2 && /smoke-bank-a/.test(k.bg) && k.live === 0 && k.op === 1, J(k));
    const pr = shop.prods.find(x => x.cat === "hookahs" && !x.photo);
    if (pr) {
      await load(s, "p/" + pr.sku + "?still"); const got2 = await ready(s, "[data-stage] > .smoke--still"); await wait(s, 1200);
      const k2 = await s.evaluate(() => { const e = document.querySelector("[data-stage] > .smoke--still"); return e ? { cls: e.className, bg: getComputedStyle(e.firstElementChild).backgroundImage, live: document.querySelectorAll("canvas.smoke").length, op: +getComputedStyle(e).opacity } : null; });
      t("?still: a hookah product shows the column stills", got2 && k2 && !/smoke--bank/.test(k2.cls) && /smoke-a/.test(k2.bg) && k2.live === 0 && k2.op === 1, J(k2));
    } else skip("?still on a product", "no cut-out hookah product");
  }
  await s.context().close();
}

// ---------- 8. reduced motion: objects at rest, nothing running ----------
{
  const r = await open({ reducedMotion: "reduce" });
  for (const c of SECS) {
    await load(r, "shop/" + c); const got = await ready(r); await wait(r, 1500); await mark(r);
    let q = await probe(r);
    t(c + ": reduced motion shows the object at rest", got && q.layers === 1 && q.objs === 1 && q.objW >= 44 && q.ink > 0 && q.gone.length === 0, J(q));
    t(c + ": reduced motion has no running animation and no canvas", q.running === 0 && q.fxCanvas === 0 && q.stray === 0, J(q));
    t(c + ": reduced motion hides no price", q.hidden === 0, J(q));
    if (c === "hoses") t("hoses: reduced motion leaves no dash on the hose", q.dash === "none" || q.dash === "", q.dash);
    await r.locator(".shophead[data-cat]").click({ position: { x: 8, y: 8 } }); await wait(r, 300); q = await probe(r);
    t(c + ": reduced motion ignores the tap", q.sameLayer && q.running === 0 && q.fxCanvas === 0, J(q));
  }
  if (SECS.includes("misc")) { // an in-site arrival is where the price gun would fire
    await nav(r, "/"); await wait(r, 300); await nav(r, "/shop/misc"); await wait(r, 200); let q = await probe(r);
    const miscStock = shop.prods.some(x => x.cat === "misc");   // no stock online since 2026-11-24: then no price to show, and the coming-soon state stands in
    t("misc: reduced motion shows every price on arrival", q.hidden === 0 && (miscStock ? q.stickers > 0 : await r.locator(".soon .soon__slot").count() === 1), J(q));
    await wait(r, 1300); q = await probe(r); t("misc: reduced motion, nothing running after arrival", q.running === 0 && q.fxCanvas === 0, J(q));
  }
  for (const c of ["hookahs", "cologne", "misc"].filter(x => shop.cats.includes(x))) {
    const pr = pick(c); if (!pr) continue;
    await load(r, "p/" + pr.sku); await wait(r, 1500); const q = await probe(r);
    t(`${c} product: reduced motion, nothing running, no canvas, price showing`, q.running === 0 && q.fxCanvas === 0 && q.hidden === 0, J(q));
  }
  await r.context().close();
}

t("no page errors, console errors or failed requests anywhere", errs.length === 0, [...new Set(errs)].slice(0, 5).join(" ; "));
await b.close(); end();
