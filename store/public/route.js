// Real page addresses (/shop/hookahs) with the History API. route() answers in the old "#/shop/hookahs" shape so the
// views and effects that compare against it did not have to change. "routechange" fires on every in-site move.
export const route = () => "#" + (location.pathname.replace(/\/+$/, "") || "/");
const fire = () => dispatchEvent(new Event("routechange"));
export function navigate(path, replace = false) {
  if (path === location.pathname + location.search) return;
  history[replace ? "replaceState" : "pushState"](null, "", path);
  fire();
}
addEventListener("popstate", fire);
// Old shared links used "#/p/OSS-1001". Fragments never reach the server, so they are upgraded here.
if (location.hash.startsWith("#/")) history.replaceState(null, "", location.hash.slice(1));
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
