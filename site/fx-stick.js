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
function scan() {
  if (!io) return; io.disconnect();
  if (RM.matches) return;
  const vh = innerHeight; let k = 0;
  for (const t of main.querySelectorAll(".card .tile")) {
    const s = t.querySelector(".sticker"); if (!s || s.style.viewTransitionName) continue; // the label travelling in the view transition is not re-stuck
    const r = t.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh) { if (painted) go(t, 140 + Math.min(k++, 6) * 55); }
    else { t.dataset.stick = "wait"; io.observe(t); }
  }
}
new MutationObserver(scan).observe(main, { childList: true });
scan();
addEventListener("beforeprint", () => main.querySelectorAll("[data-stick=wait]").forEach(t => t.dataset.stick = "go"));
