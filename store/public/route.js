// Real page addresses (/shop/hookahs) with the History API. route() answers in the old "#/shop/hookahs" shape so the
// views and effects that compare against it did not have to change. "routechange" fires on every in-site move.
export const route = () => "#" + (location.pathname.replace(/\/+$/, "") || "/");
const fire = () => dispatchEvent(new Event("routechange"));
// Each step in the history has its own key and remembers its own scroll position, so Back and Forward land where you were.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const SPOTS = "oss:spots", newKey = () => Math.random().toString(36).slice(2, 10);
let spots = {}; try { spots = JSON.parse(sessionStorage.getItem(SPOTS)) || {}; } catch {}
let entry = history.state?.k || newKey(), depth = history.state?.d ?? 0;
if (!history.state?.k) history.replaceState({ k: entry, d: depth }, "");
let anchor = null;
export const setSpotAnchor = f => { anchor = f; };   // a thing on the page to land on exactly, since long lists guess their height
function saveSpot() {
  spots[entry] = { y: Math.round(scrollY), ...(anchor?.() || {}) }; const keys = Object.keys(spots); if (keys.length > 60) delete spots[keys[0]];
  try { sessionStorage.setItem(SPOTS, JSON.stringify(spots)); } catch {}
}
const pushEntry = path => { saveSpot(); entry = newKey(); depth++; history.pushState({ k: entry, d: depth }, "", path); };
export const spotHere = () => spots[entry];
export const canGoBack = () => depth > 0;   // a step inside this shop to go back to
export const setQuery = q => history.replaceState(history.state, "", location.pathname + (q ? "?q=" + encodeURIComponent(q) : ""));
addEventListener("pagehide", saveSpot);
// why the page last changed: "load", "push", "replace", "pop" or "wave". instant means an overlay is covering the move, so no View Transition.
let info = { cause: "load", at: 0, instant: false }, gate = null;
const mark = (cause, instant) => { info = { cause, at: performance.now(), instant: !!instant }; };
export const navInfo = () => info;
export const waved = () => info.cause === "wave" && performance.now() - info.at < 1500;
export const setNavGate = g => { gate = g; };
// A section's effects (its band act, its smoke, mist or air) attach to a page the wave has just put in under its full cover in the
// frame after the swap, not inside it: the swap frame then carries the new page alone, and each frame stays short (2x CPU trace,
// 2026-11-26: band, smoke, mist and air setup were 20-45 ms of a 50-110 ms swap). The wave still covers the whole page in those
// frames (its wake starts past the screen edge), so the effect is in place before any of the page shows, and nothing appears late. Outside a
// wave (a first load, Back without a wave, a re-draw after add to cart) it runs at once, as before.
// "The frame after" is the task that follows the next rendering update (a frame callback, then a message task): a page put in from a
// frame callback (the wave's swap) and one put in from a plain task (a long section, app.js) both get the swap's frame to themselves.
// The waiting jobs share one queue and one frame takes about 8 ms of them (always at least one), lowest rank first: the band act
// (rank 0) is in the page in the first frame after the swap; the backgrounds (rank 1: smoke, mist, air, which fade in over 0.35 s)
// and what sits below the first screen (rank 2) follow a frame or two later, still under the wave.
const post = (() => { const ch = new MessageChannel(), fns = []; ch.port1.onmessage = () => fns.shift()?.(); return f => { fns.push(f); ch.port2.postMessage(0); }; })();
const jobs = []; let armed = false;
function pump() {
  armed = false; const t0 = performance.now();
  do { const j = jobs.shift(); if (!j) break; try { j.f(); } catch (e) { console.error(e); } } while (jobs.length && performance.now() - t0 < 8);
  if (jobs.length) arm();
}
function arm() { if (armed) return; armed = true; requestAnimationFrame(() => post(pump)); }
export function afterSwap(f, rank = 0) {
  const j = { f, rank };
  return () => {
    const at = jobs.indexOf(j);
    if (!gate?.live()) { if (at >= 0) jobs.splice(at, 1); f(); return; }   // no wave: at once, and a run still waiting is now stale
    if (at >= 0) return;
    const i = jobs.findIndex(x => x.rank > rank); jobs.splice(i < 0 ? jobs.length : i, 0, j); arm();
  };
}
export function navigate(path, replace = false) {
  if (path === location.pathname + location.search || path === location.pathname) { gate?.same(); return; }   // the same page, with or without its search words
  if (gate?.take(path, replace)) return;
  if (replace) history.replaceState({ k: entry, d: depth }, "", path); else pushEntry(path);
  mark(replace ? "replace" : "push", gate?.live() || /^\/search(\?|$)/.test(path));   // Search swaps inside the tap, or an iPhone will not open the keyboard
  fire();
}
// the wave lands its page at full cover
export function commitNav(path, cause = "wave") {
  if (path === location.pathname + location.search) return;
  pushEntry(path); mark(cause, cause === "wave"); fire();
}
addEventListener("popstate", () => { saveSpot(); entry = history.state?.k || newKey(); depth = history.state?.d ?? 0; gate?.pop(); mark("pop", gate?.live()); fire(); });
// Old shared links used "#/p/OSS-1001". Fragments never reach the server, so they are upgraded here.
if (location.hash.startsWith("#/")) history.replaceState(history.state, "", location.hash.slice(1));
document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a[href]"); if (!a || a.target || a.hasAttribute("download")) return;
  const raw = a.getAttribute("href");
  if (raw.startsWith("#")) { // in-page jump; <base href="/"> would otherwise send it to the home page
    e.preventDefault(); const el = document.getElementById(raw.slice(1)); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView(); }
    return;
  }
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || /^\/(api|admin|img|fonts)\//.test(u.pathname) || /\.[a-z0-9]+$/i.test(u.pathname)) return;
  e.preventDefault(); navigate(u.pathname + u.search);
});
