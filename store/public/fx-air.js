// The air of every other page. Hookahs have their smoke and cologne its mist (fx-pour.js); here each section gets the fine thing that
// belongs to its product, on the same black ground, behind every word, photo and button:
//   bases  bubbles rising through water      bowls  pale ash lifting off the foil     heat   embers     charcoal  slow deep sparks
//   hoses  long slow threads                 parts  brass glints                      misc   warm dust in shop light
//   home, browsing and gifts: warm motes      cart, checkout, the small print: the same, far quieter
// Each drop drifts, fades and is replaced somewhere new, so nothing loops. On a section's first open they fly out from its object.
// Plain 2D at half rate once settled, stopped when hidden. With motion turned off a designed still stands in.
// The drawing (air-core.js) runs in a worker on its own canvas (fx-air-worker.js), so the main thread never pays for hundreds of
// drops a frame: a page swap cannot stall the air and the air cannot stall a swap (profile, 2026-11-25: 150-250 ms of drawImage per
// transition on a 4x-throttled phone, the largest single cost). A browser without OffscreenCanvas draws it here, as before.
import { waved, afterSwap } from "./route.js";
import { makeAir } from "./air-core.js";
const RM = matchMedia("(prefers-reduced-motion: reduce)"), KEY = "oss:air:", root = document.documentElement;
const CATS = new Set(["bases", "bowls", "heat", "charcoal", "hoses", "parts", "misc"]);
function which() {
  if (document.querySelector('.shophead[data-cat="hookahs"],.shophead[data-cat="cologne"],.pdp[data-cat="hookahs"],.pdp[data-cat="cologne"]')) return null;   // fx-pour.js has these
  const c = document.querySelector(".shophead[data-cat],.pdp[data-cat]")?.dataset.cat; if (CATS.has(c)) return c;
  if (!document.querySelector("#main > :not(.ssr)")) return null;
  const a = location.pathname.split("/")[1] || "";
  return !a || a === "shop" || a === "set" || a === "gifts" || a === "p" ? "house" : "calm";
}
let cv = null, worker = null, local = null, raf = 0, wraf = 0, wkey = "", kind = null, want = null, mw = -1, mh = -1, stuckHead = null, stuckBar = null, popped = -1e9, noWorker = false;
const played = new Set(); let arrivedBack = performance.getEntriesByType("navigation")[0]?.type === "back_forward";
addEventListener("popstate", () => { popped = performance.now(); });
// whether this section's air flies out of its object: asked when the page changes, written down only once that air is really shown
function firstOpen(k) {
  if (!CATS.has(k) || played.has(k) || arrivedBack || performance.now() - popped < 800 || waved()) return false; // the wave was the entrance
  try { if (sessionStorage.getItem(KEY + k)) return false; } catch {} return true;
}
function shown(k, burst) { kind = k; if (!burst || !CATS.has(k)) return; played.add(k); try { sessionStorage.setItem(KEY + k, "1"); } catch {} }
const send = m => { if (worker) worker.postMessage(m); else if (local) { if (m.type === "size") local.size(m.w, m.h, m.d); else if (m.type === "want") local.want(m.kind, m.burst, m.origin); else if (m.type === "origin") local.origin(m.origin); } };
const objAt = () => { const o = document.querySelector(".fx-obj")?.getBoundingClientRect(); return o && o.width ? [o.left + o.width / 2, o.top + o.height * .4] : null; };
// the worker cannot see the page's transition: it is told when one starts, when its body covers the screen, and when it ends
function watch() { wraf = 0; if (!worker) return; wraf = requestAnimationFrame(watch); const a = window.__wave?.active, k = a ? (a.phase === "cover" && a.p > .92 ? "full" : "on") : ""; if (k !== wkey) { wkey = k; worker.postMessage({ type: "wave", wave: a ? { phase: a.phase, p: k === "full" ? 1 : 0 } : null }); } }
// measured from the canvas itself (CSS 100lvh), so it is never stretched; the drawing side ignores an address-bar-sized change
function measure() { if (!cv) return; const d = Math.min(2, devicePixelRatio || 1), nw = cv.clientWidth || innerWidth, nh = cv.clientHeight || innerHeight; if (nw === mw && nh === mh) return; mw = nw; mh = nh; send({ type: "size", w: nw, h: nh, d }); }
function loop(t) { raf = 0; if (!cv || !local) return; if (!document.hidden) raf = requestAnimationFrame(loop); local.frame(t, window.__wave?.active); }
function make() {
  cv = document.createElement("canvas"); cv.className = "pour pour--air"; cv.setAttribute("aria-hidden", "true"); document.body.prepend(cv);
  if (!noWorker && cv.transferControlToOffscreen && typeof Worker === "function") {
    try {
      const off = cv.transferControlToOffscreen(); worker = new Worker(new URL("./fx-air-worker.js", import.meta.url), { type: "module" });
      const me = worker; worker.onmessage = ({ data: m }) => { if (me !== worker) return; if (m.type === "kind") shown(m.kind, m.burst); else if (m.type === "fail") swap(); };
      worker.onerror = () => { if (me === worker) swap(); }; worker.postMessage({ type: "init", canvas: off, hidden: document.hidden }, [off]); wkey = ""; wraf = requestAnimationFrame(watch); return true;
    } catch { noWorker = true; if (worker) { try { worker.terminate(); } catch {} } worker = null; cv.remove(); cv = null; return make(); }   // no handover here: draw on the main thread
  }
  local = makeAir(cv, n => { const s = document.createElement("canvas"); s.width = s.height = n; return s; });
  if (!local) { cv.remove(); cv = null; return false; }
  local.onKind = shown; local.start(performance.now()); raf = requestAnimationFrame(loop); return true;
}
// the worker could not start (an old engine, a blocked module): the handed-over canvas is gone, so a fresh one is drawn here instead
function swap() { const k = want; noWorker = true; stopWorker(); if (cv) { cv.remove(); cv = null; } mw = mh = -1; want = null; if (k) start(k); }
function stopWorker() { if (wraf) cancelAnimationFrame(wraf); wraf = 0; if (!worker) return; const old = worker; worker = null; old.onmessage = old.onerror = null; try { old.terminate(); } catch {} }
function start(k) {
  root.classList.remove("air-still"); root.removeAttribute("data-air"); root.classList.add("air-page");
  const fresh = !cv; if (fresh && !make()) { still(k); return; }
  if (fresh) measure();   // reading the canvas size forces a layout: only on a new canvas, a resize or a return, never on every page
  if (k !== want) { want = k; const b = firstOpen(k); send({ type: "want", kind: k, burst: b, origin: b ? objAt() : null });
    if (b) setTimeout(() => { if (want === k && cv) send({ type: "origin", origin: objAt() }); }, 120); }   // the object may be drawn just after this page change
  if (local && !raf) raf = requestAnimationFrame(loop);
  if (fresh) requestAnimationFrame(() => { if (cv) cv.classList.add("on"); });
}
function end() { if (raf) cancelAnimationFrame(raf); raf = 0; stopWorker(); local = null; if (cv) { cv.remove(); cv = null; } mw = mh = -1; kind = want = null; }
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
let rs = 0; addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(() => { if (cv && !document.hidden) measure(); }, 200); });
// back from another app: the clock skips the time away, so the field carries on instead of all expiring and regrowing
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (!cv) return;
  if (document.hidden) { hiddenAt = performance.now(); if (worker) worker.postMessage({ type: "hide" }); return; }
  const gap = hiddenAt ? performance.now() - hiddenAt : 0; hiddenAt = 0; measure();
  if (worker) worker.postMessage({ type: "show", gap }); else if (local) { if (gap) local.shift(gap); if (!raf) raf = requestAnimationFrame(loop); }
});
addEventListener("pageshow", () => { if (document.hidden) return; if (local && !raf) raf = requestAnimationFrame(loop); if (worker) { worker.postMessage({ type: "show", gap: 0 }); if (!wraf) wraf = requestAnimationFrame(watch); } });
RM.addEventListener("change", () => { end(); place(); });
new MutationObserver(afterSwap(place, 1)).observe(document.getElementById("main"), { childList: true }); place();   // a background: at a wave's swap, just after the band act (route.js)
window.__air = { get kind() { return kind; }, get canvas() { return cv; }, get worker() { return !!worker; } };
