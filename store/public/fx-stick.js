// 01 label stick: each price label is stuck on as its tile comes into view (spring settle, transform + opacity only).
// Labels already on screen at first paint are left alone; labels on screen after a route change stick on in sequence.
// Positions come from the IntersectionObserver alone, after the browser's own layout: nothing here asks for a position during the page
// swap, which used to force the whole new page to lay out inside the swap and stall the transition (wave-perf PROFILE=1, 2026-11-26,
// live build, 4x CPU: fx-stick 39 ms on Hookahs, 93 ms on Everything).
const main = document.getElementById("main"), RM = matchMedia("(prefers-reduced-motion: reduce)");
let painted = false; requestAnimationFrame(() => requestAnimationFrame(() => { painted = true; }));
document.addEventListener("touchstart", () => {}, { passive: true }); // iOS Safari only applies :active with a touch listener
const go = (t, d) => { t.style.setProperty("--stick-d", d + "ms"); t.dataset.stick = "go"; };
const show = t => { delete t.dataset.stick; };
// a tile's first report says whether it was on screen when it arrived: those stick on in sequence, or simply show on a first paint and
// on Misc (whose entrance stamps them); the rest wait below the fold and stick on as they scroll in. Nothing is ever left hidden on screen.
const first = new WeakMap();
const io = window.IntersectionObserver && new IntersectionObserver(es => {
  let k = 0, j = 0;
  for (const e of es) {
    const t = e.target, f = first.get(t);
    if (f) {
      first.delete(t);
      if (e.isIntersecting) { io.unobserve(t); if (f.animate) go(t, 140 + Math.min(j++, 6) * 55); else show(t); }
      else if (e.boundingClientRect.top >= (e.rootBounds ? e.rootBounds.bottom : innerHeight) || e.boundingClientRect.bottom <= 0) t.dataset.stick = "wait";
      else { io.unobserve(t); show(t); }   // reported off screen but sitting inside it (a card not drawn yet): shown, never blanked
      continue;
    }
    if (e.isIntersecting) { io.unobserve(t); go(t, Math.min(k++, 4) * 55); }
  }
}, { threshold: 0.35 });
// held back from the first frame when it will stick on, so it never shows then jumps
const watch = (t, animate) => { first.set(t, { animate }); if (animate) t.dataset.stick = "wait"; io.observe(t); };
const isMisc = () => !!main.querySelector('.shophead[data-cat="misc"]');   // on misc the section entrance stamps the first screen
let stuck = "";
function scan() {
  if (!io) return; io.disconnect();
  const tiles = [...main.querySelectorAll(".card .tile")].filter(t => t.querySelector(".sticker"));
  const again = stuck === location.pathname; stuck = location.pathname;
  if (RM.matches) { tiles.forEach(show); return; }
  // the same page re-drawn (add to cart, a quantity change): labels stay where they are, and any still waiting keep waiting
  if (again) { for (const t of tiles) if (t.dataset.stick === "wait") io.observe(t); return; }
  const animate = painted && !isMisc();
  for (const t of tiles) {
    if (t.querySelector(".sticker").style.viewTransitionName) { show(t); continue; }   // the label travelling in the view transition is never hidden
    watch(t, animate);
  }
}
new MutationObserver(scan).observe(main, { childList: true });
// cards drawn after the first screen (app.js draws long sections in idle moments) wait for their label like every other card;
// the first screen's cards arrive one task after the swap and stick on in sequence exactly as scan() does
addEventListener("oss:cards", e => {
  if (!io || RM.matches) return; const animate = painted && !isMisc();
  for (const c of e.detail.cards) { const t = c.querySelector(".tile"); if (t && t.querySelector(".sticker") && !t.dataset.stick) { if (e.detail.first) watch(t, animate); else { t.dataset.stick = "wait"; io.observe(t); } } }
});
scan();
addEventListener("beforeprint", () => main.querySelectorAll("[data-stick=wait]").forEach(t => t.dataset.stick = "go"));
