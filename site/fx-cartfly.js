// 02 cart flight: on "Add to cart" the piece's cut-out flies on a short arc into the cart count, and the count
// ticks over when it lands. Fixed-position clone, transform + opacity only, never blocks input (pointer-events:none).
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const counts = () => [...document.querySelectorAll("[data-cart-count]")];
const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden" ? r : null; };
const target = () => counts().map(el => [el, shown(el)]).filter(x => x[1]).sort((a, b) => b[1].top - a[1].top)[0]; // the dock on phones, the top bar on desktop
function drawn(img) { // the rectangle the cut-out actually occupies (object-fit: contain, minus padding)
  const r = img.getBoundingClientRect(), cs = getComputedStyle(img);
  const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
  const bw = r.width - pl - pr, bh = r.height - pt - pb, ar = (img.naturalWidth || 4) / (img.naturalHeight || 5);
  const w = Math.min(bw, bh * ar), h = w / ar;
  return { left: r.left + pl + (bw - w) / 2, top: r.top + pt + (bh - h) / 2, width: w, height: h };
}
function bump(n) {
  for (const el of counts()) {
    el.textContent = n;
    if (!RM.matches && el.animate) el.animate([{ transform: "scale(1)" }, { transform: "scale(1.5)", background: "var(--color-action)", color: "var(--color-on-action)", offset: .3 }, { transform: "scale(1)" }],
      { duration: 420, easing: "cubic-bezier(.2,.8,.3,1)" });
  }
}
let pend = null;
// Capture phase, before app.js re-renders the page: measure where the photo and the cart count are.
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-add]"); if (!btn) return;
  const src = document.querySelector(`[data-stage="${CSS.escape(btn.dataset.add)}"] .shot`), t = target();
  pend = { before: counts()[0] ? +counts()[0].textContent || 0 : 0, t, a: src && src.complete && drawn(src), url: src && (src.currentSrc || src.src) };
}, true);
// Window bubble phase, after app.js (a document listener) has re-rendered: hold the old count and fly.
addEventListener("click", () => {
  if (!pend) return; const { before, t, a, url } = pend; pend = null;
  {
    const after = counts()[0] ? +counts()[0].textContent || 0 : before + 1;
    if (RM.matches || !a || !a.width || !t || !document.body.animate) return bump(after);
    const b = t[1];
    counts().forEach(el => el.textContent = before);
    const fly = new Image(); fly.src = url; fly.alt = ""; fly.className = "fly";
    Object.assign(fly.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
    document.body.append(fly);
    const s = Math.max(28 / a.height, 0.04), dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const lift = Math.min(160, Math.max(70, Math.abs(dx) * 0.35)) + Math.max(0, -dy) * 0.25; // arc height
    const ease = u => 1 - Math.pow(1 - u, 2.2), frames = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, q = ease(u), x = dx * q, y = dy * q - 4 * lift * q * (1 - q), k = 1 + (s - 1) * Math.pow(q, 0.8);
      frames.push({ transform: `translate(${x}px,${y}px) rotate(${-14 * q}deg) scale(${k})`, opacity: u < .85 ? 1 : 1 - (u - .85) / .15 * .6 });
    }
    fly.animate(frames, { duration: 640, easing: "linear" }).finished.then(() => {
      fly.remove(); bump(counts()[0] ? Math.max(after, +counts()[0].textContent || 0) : after);
    });
  }
});
