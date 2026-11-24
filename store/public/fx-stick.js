// 01 label stick: each price label is stuck on as its tile comes into view (spring settle, transform + opacity only).
// Labels already on screen at first paint are left alone; labels on screen after a route change stick on in sequence.
const main = document.getElementById("main"), RM = matchMedia("(prefers-reduced-motion: reduce)");
let painted = false; requestAnimationFrame(() => requestAnimationFrame(() => { painted = true; }));
document.addEventListener("touchstart", () => {}, { passive: true }); // iOS Safari only applies :active with a touch listener
const io = window.IntersectionObserver && new IntersectionObserver(es => {
  let k = 0;
  for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); go(e.target, Math.min(k++, 4) * 55); }
}, { threshold: 0.35 });
const go = (t, d) => { t.style.setProperty("--stick-d", d + "ms"); t.dataset.stick = "go"; };
let stuck = "";
function scan() {
  if (!io) return; io.disconnect();
  const again = stuck === location.pathname; stuck = location.pathname;
  if (again || RM.matches) return; // the same page re-drawn (add to cart, a quantity change): labels stay where they are
  const vh = innerHeight, gun = !!main.querySelector('.shophead[data-cat="misc"]'); let k = 0; // on misc the section entrance stamps the first screen
  // every position is read first and every label written after: one layout for the whole page. Reading and writing in turn made the
  // browser restyle the page once per tile, which on a long section held a page change for most of a second
  const all = []; for (const t of main.querySelectorAll(".card .tile")) { const s = t.querySelector(".sticker"); if (s && !s.style.viewTransitionName) all.push(t); }   // the label travelling in the view transition is not re-stuck
  // measured on the card, never the tile inside it: the cards skip drawing while off screen (content-visibility), and asking a tile
  // inside one for its position makes the browser lay that card out after all, for every card on a long section
  const on = all.map(t => { const r = (t.closest(".card") || t).getBoundingClientRect(); return r.bottom > 0 && r.top < vh; });
  all.forEach((t, i) => { if (on[i]) { if (painted && !gun) go(t, 140 + Math.min(k++, 6) * 55); } else { t.dataset.stick = "wait"; io.observe(t); } });
}
new MutationObserver(scan).observe(main, { childList: true });
// cards drawn after the first screen (app.js draws long sections in idle moments) wait for their label like every other card
// the first screen's cards arrive one task after the swap: on screen they stick on in sequence exactly as scan() does; the rest wait
addEventListener("oss:cards", e => {
  if (!io || RM.matches) return; const vh = innerHeight; let k = 0;
  const ts = e.detail.cards.map(c => c.querySelector(".tile")).filter(t => t && t.querySelector(".sticker") && !t.dataset.stick);
  const on = e.detail.first ? ts.map(t => { const r = t.closest(".card").getBoundingClientRect(); return r.bottom > 0 && r.top < vh; }) : [];
  ts.forEach((t, i) => { if (on[i]) { if (painted) go(t, 140 + Math.min(k++, 6) * 55); } else { t.dataset.stick = "wait"; io.observe(t); } });
});
scan();
addEventListener("beforeprint", () => main.querySelectorAll("[data-stick=wait]").forEach(t => t.dataset.stick = "go"));
