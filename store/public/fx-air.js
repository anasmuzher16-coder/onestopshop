// The air of every other page. Hookahs have their smoke and cologne its mist (fx-pour.js); here each section gets the fine thing that
// belongs to its product, on the same black ground, behind every word, photo and button:
//   bases  bubbles rising through water      bowls  pale ash lifting off the foil     heat   embers     charcoal  slow deep sparks
//   hoses  long slow threads                 parts  brass glints                      misc   warm dust in shop light
//   home, browsing and gifts: warm motes      cart, checkout, the small print: the same, far quieter
// Each drop drifts, fades and is replaced somewhere new, so nothing loops. On a section's first open they fly out from its object.
// Plain 2D at half rate once settled, stopped when hidden. With motion turned off a designed still stands in.
import { waved } from "./route.js";
const RM = matchMedia("(prefers-reduced-motion: reduce)"), KEY = "oss:air:", root = document.documentElement;
const P = {
  bases: { sprite: "ring", rgb: [158, 236, 226], n: 150, r: [1.6, 5.2], a: [.16, .5], vx: 3, vy: [-27, -9], life: [7, 15], sway: 7, haze: .014 },
  bowls: { sprite: "dot", rgb: [206, 204, 198], n: 260, r: [.28, 1.25], a: [.16, .56], vx: 6, vy: [-11, -3], life: [6, 14], sway: 11, haze: .016 },
  heat: { sprite: "dot", rgb: [255, 150, 66], n: 190, r: [.45, 1.8], a: [.32, .9], vx: 6, vy: [-27, -8], life: [4, 10], sway: 9, haze: .016, flicker: 1.8 },
  charcoal: { sprite: "dot", rgb: [255, 112, 44], n: 130, r: [.4, 1.5], a: [.26, .85], vx: 4, vy: [-18, -5], life: [5, 12], sway: 6, haze: .015, flicker: 2.4 },   // deeper, slower sparks off lit coals
  hoses: { threads: 14, rgb: [132, 232, 176], haze: .012 },
  parts: { sprite: "star", rgb: [244, 208, 122], n: 46, r: [.7, 2.2], a: [.22, .85], vx: .8, vy: [-1.2, 1.2], life: [5, 11], sway: 1.5, haze: .012, flicker: .9, peak: 8 },
  misc: { sprite: "dot", rgb: [238, 226, 204], n: 140, r: [.5, 2.4], a: [.08, .3], vx: 7, vy: [-4, 7], life: [7, 16], sway: 8, haze: .014 },
  house: { sprite: "dot", rgb: [236, 222, 200], n: 120, r: [.5, 2.2], a: [.08, .3], vx: 6, vy: [-8, -1], life: [7, 16], sway: 7, haze: .013 },
  calm: { sprite: "dot", rgb: [226, 216, 200], n: 110, r: [.28, 1], a: [.09, .3], vx: 3.5, vy: [-4, -.5], life: [9, 18], sway: 4, haze: .007 },
};
// how present the air is: every section carries the same weight as the hookah smoke and cologne mist; the quiet pages stay quiet
for (const k in P) { const c = P[k], m = k === "calm" ? 1.3 : 1; if (c.n) { c.n = Math.round(c.n * (k === "calm" ? 1.4 : 1.8)); c.a = [c.a[0] * 1.2 * m / (k === "calm" ? 1.3 : 1), Math.min(.95, c.a[1] * 1.25)]; } c.haze *= k === "calm" ? 1.6 : 2.7; }
const CATS = new Set(["bases", "bowls", "heat", "charcoal", "hoses", "parts", "misc"]);
const rnd = (a, b) => a + Math.random() * (b - a);
function which() {
  if (document.querySelector('.shophead[data-cat="hookahs"],.shophead[data-cat="cologne"],.pdp[data-cat="hookahs"],.pdp[data-cat="cologne"]')) return null;   // fx-pour.js has these
  const c = document.querySelector(".shophead[data-cat],.pdp[data-cat]")?.dataset.cat; if (CATS.has(c)) return c;
  if (!document.querySelector("#main > :not(.ssr)")) return null;
  const a = location.pathname.split("/")[1] || "";
  return !a || a === "shop" || a === "set" || a === "gifts" || a === "p" ? "house" : "calm";
}
function sprite(kind, [r, g, b]) {
  const s = document.createElement("canvas"); s.width = s.height = 32; const x = s.getContext("2d"), c = a => `rgba(${r},${g},${b},${a})`;
  if (kind === "ring") { x.strokeStyle = c(.85); x.lineWidth = 2.2; x.beginPath(); x.arc(16, 16, 12, 0, 6.283); x.stroke(); const f = x.createRadialGradient(16, 16, 2, 16, 16, 13); f.addColorStop(0, c(0)); f.addColorStop(1, c(.2)); x.fillStyle = f; x.beginPath(); x.arc(16, 16, 12, 0, 6.283); x.fill(); x.fillStyle = c(.95); x.beginPath(); x.arc(11.5, 11, 1.9, 0, 6.283); x.fill(); }
  else if (kind === "star") { const f = x.createRadialGradient(16, 16, 0, 16, 16, 8); f.addColorStop(0, c(.9)); f.addColorStop(1, c(0)); x.fillStyle = f; x.fillRect(0, 0, 32, 32); x.fillStyle = c(1); x.beginPath(); for (const [px, py] of [[16, 0], [17.4, 14.6], [32, 16], [17.4, 17.4], [16, 32], [14.6, 17.4], [0, 16], [14.6, 14.6]]) x.lineTo(px, py); x.closePath(); x.fill(); }
  else { const f = x.createRadialGradient(16, 16, 0, 16, 16, 16); f.addColorStop(0, c(1)); f.addColorStop(.42, c(.6)); f.addColorStop(1, c(0)); x.fillStyle = f; x.fillRect(0, 0, 32, 32); }
  return s;
}
const soft = rgb => sprite("dot", rgb);

let cv = null, g = null, raf = 0, now0 = 0, kind = null, want = null, w = 0, h = 0, drops = [], veil = [], lines = [], img = null, glow = null, odd = false, prev = 0, slowN = 0, limit = 1, level = 0, born = 0, stuckHead = null, stuckBar = null, popped = -1e9, surge = 0, wave = false;
const played = new Set(); let arrivedBack = performance.getEntriesByType("navigation")[0]?.type === "back_forward";
addEventListener("popstate", () => { popped = performance.now(); });
function firstOpen(k) {
  if (!CATS.has(k) || played.has(k) || arrivedBack || performance.now() - popped < 800) return false; played.add(k); if (waved()) return false; // the wave was the entrance
  try { if (sessionStorage.getItem(KEY + k)) return false; sessionStorage.setItem(KEY + k, "1"); } catch {} return true;
}
function seat(p, c, t, first) {
  const u = Math.random(); p.x = rnd(-.03, 1.03) * w; p.y = rnd(-.03, 1.03) * h; p.vx = rnd(-c.vx, c.vx); p.vy = rnd(c.vy[0], c.vy[1]); p.r = c.r[0] + (c.r[1] - c.r[0]) * u * u * u; if (c.sprite === "ring") p.vy = -(7 + p.r * 3.8); p.a = rnd(c.a[0], c.a[1]);
  p.life = rnd(c.life[0], c.life[1]); p.born = first ? t - rnd(0, p.life) : t + rnd(0, 900); p.ph = rnd(0, 6.28); p.tw = rnd(.5, 1.7); p.sw = rnd(.3, 1) * c.sway; p.fly = 0;
}
function fill(k, burst) {
  const c = P[k], t = performance.now(), scale = Math.max(.7, Math.min(2.4, w * h / (390 * 844)));
  surge = burst ? 1 : 0; img = c.sprite ? sprite(c.sprite, c.rgb) : null; glow = soft(c.rgb); drops = []; lines = []; limit = 1;
  if (c.n) { const n = Math.round(c.n * scale); let ox = w * .75, oy = h * .22; const o = document.querySelector(".fx-obj")?.getBoundingClientRect(); if (o && o.width) { ox = o.left + o.width / 2; oy = o.top + o.height * .4; }
    for (let i = 0; i < n; i++) { const p = {}; seat(p, c, t, !burst); if (burst && i % 2) { p.born = t + rnd(380, 900); p.fly = rnd(2.2, 4); p.ox = ox; p.oy = oy; p.life = Math.max(p.life, 6); } drops.push(p); } }
  if (c.threads) for (let i = 0; i < Math.round(c.threads * Math.min(1.7, scale)); i++) lines.push({ x: rnd(-.05, 1.05), amp: rnd(.03, .09), f: rnd(.7, 1.8), sp: rnd(.08, .24), f2: rnd(1.6, 3), sp2: rnd(.05, .17), dr: rnd(.004, .016) * (Math.random() < .5 ? -1 : 1), ph: rnd(0, 6.28), a: rnd(.16, .44), lw: rnd(.6, 1.6) });
  veil = []; for (let i = 0; i < 12; i++) veil.push({ x: Math.random(), y: Math.random(), r: rnd(.16, .32), vx: rnd(-.005, .005), vy: rnd(-.006, .003), ph: rnd(0, 6.28) });
}
// measured from the canvas itself (CSS 100lvh), so it is never stretched; a moving URL bar changes nothing and wipes nothing
function size() { const d = Math.min(2, devicePixelRatio || 1), nw = cv.clientWidth || innerWidth, nh = cv.clientHeight || innerHeight, pw = Math.round(nw * d), ph = Math.round(nh * d); if (cv.width && w === nw && Math.abs(h - nh) <= 140) return false; /* the phone address bar moving is not a new page: nothing reshuffles */ w = nw; h = nh; cv.width = pw; cv.height = ph; g.setTransform(d, 0, 0, d, 0, 0); return true; }
function draw(t) {
  const c = P[kind], s = (t - now0) / 1000, big = Math.max(w, h); g.clearRect(0, 0, w, h);
  for (const v of veil) { const x = ((v.x + v.vx * s) % 1.3 + 1.3) % 1.3 - .15, y = ((v.y + v.vy * s) % 1.3 + 1.3) % 1.3 - .15, z = v.r * big; g.globalAlpha = (c.haze + c.haze * .35 * Math.sin(s * .2 + v.ph)) * level * (1 + 1.9 * surge * Math.max(0, 1 - s / 4.6)); g.drawImage(glow, x * w - z, y * h - z, z * 2, z * 2); }
  if (lines.length) { g.strokeStyle = `rgb(${c.rgb})`; g.lineCap = "round"; for (const l of lines) { g.lineWidth = l.lw; g.globalAlpha = l.a * level * (.72 + .28 * Math.sin(s * .19 + l.ph)); g.beginPath();
    for (let i = 0; i <= 48; i++) { const q = i / 48 * 1.12 - .06, b = ((l.x + l.dr * s) % 1.5 + 1.5) % 1.5 - .25, x = b * w + (l.amp * Math.sin(q * l.f * 3.14 + s * l.sp + l.ph) + l.amp * .3 * Math.sin(q * l.f2 * 3.14 - s * l.sp2 + l.ph * 2)) * Math.min(w, 520); if (i) g.lineTo(x, q * h); else g.moveTo(x, q * h); } g.stroke(); } }
  const n = Math.round(drops.length * limit);
  for (let i = 0; i < n; i++) { const p = drops[i], age = (t - p.born) / 1000; if (age < 0) continue; if (age >= p.life) { seat(p, c, t, false); continue; }
    const q = age / p.life, fade = Math.min(1, q / .14) * Math.min(1, (1 - q) / .22), shine = c.peak ? Math.abs(Math.sin(p.ph + s * c.flicker * p.tw)) ** c.peak : c.flicker ? .5 + .5 * Math.sin(p.ph + s * c.flicker * p.tw) ** 2 : .74 + .26 * Math.sin(p.ph + s * p.tw), e = p.fly ? 1 - Math.exp(-p.fly * age) : 1;
    const dx = p.vx * age + Math.sin(p.ph + age * .6) * p.sw, dy = p.vy * age + Math.cos(p.ph + age * .44) * p.sw * .45, x = (p.fly ? p.ox + (p.x - p.ox) * e : p.x) + dx, y = (p.fly ? p.oy + (p.y - p.oy) * e : p.y) + dy, z = p.r * (c.sprite === "ring" ? 1 : 2.4);
    g.globalAlpha = p.a * fade * shine * level; g.drawImage(img, x - z, y - z, z * 2, z * 2); }
  g.globalAlpha = 1;
}
function loop(t) {
  raf = 0; if (!cv) return; if (!document.hidden) raf = requestAnimationFrame(loop);
  const wv = window.__wave?.active; if (wv) { wave = !wave; if (wave || wv.phase === "cover" && wv.p > .92) return; }   // while a wave plays the air draws every other frame (drifting dust at 30 fps reads the same), and not at all under its full body: the wave gets the frame
  // a change of page: this air thins away, the next comes up
  if (want !== kind) { level = Math.max(0, level - (t - prev) / 180); if (level <= 0) { kind = want; fill(kind, firstOpen(kind)); now0 = t; born = t; } }
  else level = Math.min(1, level + Math.max(0, t - prev) / 450);
  odd = !odd; if (t - born > 4200 && odd && want === kind && level >= 1) return;
  const ms = t - prev; prev = t; slowN = ms > 80 ? slowN + 1 : Math.max(0, slowN - 2); if (slowN > 40) { slowN = 0; limit = Math.max(.4, limit * .75); }
  draw(t);
}
function start(k) {
  root.classList.remove("air-still"); root.removeAttribute("data-air"); root.classList.add("air-page"); want = k;
  if (cv) { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(loop); } return; }
  cv = document.createElement("canvas"); cv.className = "pour pour--air"; cv.setAttribute("aria-hidden", "true"); g = cv.getContext("2d"); if (!g) { cv.width = cv.height = 0; cv = null; still(k); return; }
  document.body.prepend(cv); size(); kind = k; fill(k, firstOpen(k)); now0 = born = prev = performance.now(); level = 0; raf = requestAnimationFrame(loop); requestAnimationFrame(() => { if (cv) cv.classList.add("on"); });
}
function end() { if (raf) cancelAnimationFrame(raf); raf = 0; if (cv) { cv.width = cv.height = 0; cv.remove(); cv = null; g = null; } w = h = 0; /* the next canvas must measure itself, or it stays at the browser's 300x150 default and stretches */ kind = want = null; drops = []; lines = []; }
function still(k) { root.classList.add("air-page", "air-still"); root.dataset.air = k; }
function clear() { end(); root.classList.remove("air-page", "air-still"); root.removeAttribute("data-air"); }
function stick() { if (stuckHead?.isConnected && stuckBar) stuckBar.classList.toggle("is-stuck", stuckHead.getBoundingClientRect().bottom < stuckBar.getBoundingClientRect().top - .5); }
function place() {
  const k = which(); stuckHead = document.querySelector(".shophead"); stuckBar = stuckHead && stuckHead.parentNode.querySelector(":scope > .chips");
  if (!k) { if (document.querySelector("#main > :not(.ssr)")) { clear(); arrivedBack = false; } return; }
  if (RM.matches || new URLSearchParams(location.search).has("still")) { end(); still(k); } else start(k);
  stick(); arrivedBack = false;
}
addEventListener("scroll", stick, { passive: true });
let rs = 0; addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(() => { if (cv && !document.hidden && size() && kind) fill(kind, false); }, 200); });
// back from another app: the clock skips the time away, so the field carries on instead of all expiring and regrowing
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => { if (cv && !document.hidden && size() && kind) fill(kind, false); if (document.hidden) { hiddenAt = performance.now(); return; } if (hiddenAt) { const gap = performance.now() - hiddenAt; hiddenAt = 0; now0 += gap; born += gap; for (const p of drops) p.born += gap; } if (cv && !raf) { prev = performance.now(); raf = requestAnimationFrame(loop); } });
addEventListener("pageshow", () => { if (cv && !raf) { prev = performance.now(); raf = requestAnimationFrame(loop); } });
RM.addEventListener("change", () => { end(); place(); });
new MutationObserver(place).observe(document.getElementById("main"), { childList: true }); place();
window.__air = { get kind() { return kind; }, get canvas() { return cv; } };
