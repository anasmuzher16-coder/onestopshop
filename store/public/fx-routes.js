import { route } from "./route.js";
// 03 route direction: every route change gets one direction language. Deeper (home > shop > piece > cart) enters
// from the right, going back enters from the left, category to category follows the chip order, same depth crossfades.
// The top bar and the phone dock are lifted out of the slide so the chassis never moves.
const CATS = ["hookahs", "bases", "bowls", "heat", "charcoal", "hoses", "parts", "cologne", "misc", "shisha"];   // the chip order (charcoal after heat, 2026-11-24)
const depth = h => {
  const [a, b] = h.replace(/^#\/?/, "").split("/");
  if (a === "shop") return 1 + (b ? (CATS.indexOf(b) + 1) / 10 : 0);
  return a === "p" ? 2 : a === "cart" ? 3 : a === "shipping" ? 1.9 : 0;
};
const root = document.documentElement;
let prev = route(), timer;
addEventListener("routechange", () => { // registered after app.js, so this runs before the old page is captured
  const d = depth(route()) - depth(prev); prev = route();
  root.dataset.vtDir = Math.abs(d) < .001 ? "fade" : d > 0 ? "fwd" : "back";
  clearTimeout(timer); timer = setTimeout(() => delete root.dataset.vtDir, 900);
});
