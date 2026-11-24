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
