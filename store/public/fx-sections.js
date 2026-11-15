// 06 section entrances. One rule for every section of the shop:
//   the header band shows one real object from that section, drawn in the same ink line at the same weight, sitting
//   on the right; when the page opens, that object does its one physical thing, once, and is finished by about
//   two seconds.
//   hookahs  smoke rolls in (fx-smoke.js)            cologne  an atomiser sprays two spritzes of mist
//   bases    light crosses the glass of a base        bowls    a bowl is turned into place, heat spreads to its rim
//   heat     sparks lift off a heat keeper            hoses    a hose uncoils to its mouthpiece
//   parts    a nut turns and seats                    misc     the price gun: a label is stamped, then the cards
// The object stays as part of the header. Everything sits behind the type, and nothing moves when motion is
// turned off (the objects are simply there).
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const START = 450; // after the page change has finished fading, so nothing plays into a half-faded page
const el = (tag, cls, parent) => { const n = document.createElement(tag); n.className = cls; if (parent) parent.append(n); return n; };
const rnd = (a, b) => a + Math.random() * (b - a);
// the object: a square on the right of the band, drawn in a 100 x 100 box
const obj = (layer, inner) => { const w = el("span", "fx-obj", layer); w.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`; fit(layer, w); return w; };
// The object never touches the title. Where a long title leaves no room beside it (a phone), the object drops
// to the lower right, under the end of the title, at the size that space allows.
function fit(layer, o) {
  const band = layer.parentNode, h1 = band.querySelector("h1"); if (!h1) return;
  const L = band.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(h1);
  const T = range.getBoundingClientRect(), size = o.getBoundingClientRect().width, gutter = L.right - o.getBoundingClientRect().right;
  const beside = L.right - gutter - T.right - 14;
  if (beside >= size) return;
  const under = L.bottom - T.bottom - 12;
  if (beside >= size * 0.72) { o.style.height = Math.floor(beside) + "px"; return; }
  const fitSize = Math.max(40, Math.floor(Math.min(size, (under + 6) / 0.84))); // may run a sixth of itself off the bottom edge, no more
  o.style.cssText = `height:${fitSize}px;top:auto;bottom:${-Math.round(fitSize * 0.16)}px;translate:none`;
}
// a point inside the object's box, as a fraction of the layer
const at = (layer, o, fx, fy) => { const r = o.getBoundingClientRect(), L = layer.getBoundingClientRect(); return [(r.left - L.left + r.width * fx) / L.width, (r.top - L.top + r.height * fy) / L.height]; };
let uid = 0;

// ---- mist: two short bursts of very fine droplets and a little haze, from one point, on a small 2D canvas
function spritz(layer, ox, oy, angle, power = 1) {
  const cv = el("canvas", "fx-spritz", layer), dpr = Math.min(2, devicePixelRatio || 1), w = layer.clientWidth, h = layer.clientHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext("2d"); if (!g) return cv.remove();
  const scale = Math.max(0.75, Math.min(2.6, Math.min(w, h * 2.2) / 360)) * power, parts = [], cx = Math.cos(angle), cy = Math.sin(angle);
  const burst = (n, force) => {
    for (let i = 0; i < n; i++) { const a = angle + rnd(-0.46, 0.46) * (0.3 + Math.random()), v = rnd(150, 540) * force * scale;
      parts.push({ x: ox * w, y: oy * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(0.4, 1.2), life: rnd(0.9, 1.7), age: 0, mist: false }); }
    for (let i = 0; i < Math.round(n / 26); i++) { const a = angle + rnd(-0.28, 0.28), v = rnd(50, 150) * force * scale, off = rnd(20, 60) * scale; // haze starts out along the spray, never as a blob at the nozzle
      parts.push({ x: ox * w + cx * off, y: oy * h + cy * off, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(16, 36) * scale, life: rnd(1.2, 1.8), age: 0, mist: true }); }
  };
  burst(320, 1); const second = setTimeout(() => burst(200, 0.85), 340);
  let last = performance.now(); const start = last;
  const tick = now => {
    if (!cv.isConnected) return clearTimeout(second);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, cv.width, cv.height);
    let alive = 0;
    for (const p of parts) {
      p.age += dt; if (p.age >= p.life) continue; alive++;
      const drag = Math.exp(-(p.mist ? 1.3 : 2.6) * dt); p.vx *= drag; p.vy = p.vy * drag + (p.mist ? -3 : 28) * dt; // droplets settle, haze hangs
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.age / p.life;
      if (p.mist) { const rad = p.r * (1 + (1 - k) * 1.3) * dpr, grd = g.createRadialGradient(p.x * dpr, p.y * dpr, 0, p.x * dpr, p.y * dpr, rad);
        grd.addColorStop(0, `rgba(255,252,246,${(0.05 * Math.min(1, k * 1.8)).toFixed(4)})`); grd.addColorStop(1, "rgba(255,252,246,0)"); g.fillStyle = grd; g.beginPath(); g.arc(p.x * dpr, p.y * dpr, rad, 0, 6.283); g.fill(); }
      else { g.fillStyle = `rgba(255,252,246,${(0.55 * Math.pow(k, 1.3)).toFixed(4)})`; g.beginPath(); g.arc(p.x * dpr, p.y * dpr, p.r * dpr, 0, 6.283); g.fill(); }
    }
    if (alive || now - start < 500) requestAnimationFrame(tick); else cv.remove();
  };
  requestAnimationFrame(tick);
}
const later = (layer, fn) => setTimeout(() => { if (layer.isConnected) fn(); }, START);

const FX = {
  cologne(layer, play) {
    const o = obj(layer, `<g class="head"><rect class="ink" x="52" y="28" width="32" height="22" rx="4"/><path class="ink" d="M52 35 H40 V43 H52"/></g>
      <path class="ink" d="M63 50 V60 M73 50 V60"/><rect class="ink" x="54" y="60" width="28" height="12" rx="3"/>
      <path class="ink" d="M44 100 V90 C44 80, 54 76, 60 72 M92 100 V90 C92 80, 82 76, 76 72"/>`);
    if (!play) return;
    // the pump is pressed twice, and each press sends a spritz out of the nozzle
    o.querySelector(".head").animate([{ transform: "translateY(0)" }, { transform: "translateY(6px)", offset: .12 }, { transform: "translateY(0)", offset: .3 }, { transform: "translateY(0)", offset: .46 }, { transform: "translateY(6px)", offset: .58 }, { transform: "translateY(0)", offset: .8 }, { transform: "translateY(0)" }], { duration: 740, delay: START - 60, easing: "ease-out" });
    later(layer, () => { const [x, y] = at(layer, o, 0.4, 0.39); spritz(layer, x, y, Math.PI * 1.02); });
  },
  bases(layer, play) {
    const id = "fxc" + (++uid), d = "M42 8 H58 V30 C58 44, 88 60, 88 80 C88 90, 80 94, 70 94 H30 C20 94, 12 90, 12 80 C12 60, 42 44, 42 30 Z";
    const o = obj(layer, `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${id})"><rect class="lit-fill" x="-70" y="-10" width="30" height="120"/></g><path class="ink" d="${d}"/><path class="ink" d="M42 20 H58"/>`);
    // light crosses the glass, inside the shape of the base only
    if (play) o.querySelector("rect").animate([{ transform: "translateX(0) skewX(-18deg)" }, { transform: "translateX(200px) skewX(-18deg)" }], { duration: 950, delay: START, easing: "cubic-bezier(.45,0,.25,1)", fill: "both" });
  },
  bowls(layer, play) {
    const holes = [0, 1, 2, 3, 4].map(i => { const a = i * 1.2566 - 1.57; return `<circle class="ink" cx="${(50 + Math.cos(a) * 17).toFixed(1)}" cy="${(50 + Math.sin(a) * 17).toFixed(1)}" r="4"/>`; }).join("");
    const o = obj(layer, `<g class="turn"><circle class="ink" cx="50" cy="50" r="45"/><circle class="ink" cx="50" cy="50" r="31"/>${holes}</g><circle class="lit" cx="50" cy="50" r="44"/><circle class="lit" cx="50" cy="50" r="44"/>`);
    if (!play) return;
    // the bowl is turned into place, then heat spreads from the middle to the rim and no further
    o.querySelector(".turn").animate([{ transform: "rotate(-95deg)" }, { transform: "rotate(0deg)" }], { duration: 800, delay: START, easing: "cubic-bezier(.3,1.25,.5,1)", fill: "both" });
    o.querySelectorAll(".lit").forEach((c, i) => c.animate([{ transform: "scale(.12)", opacity: 0 }, { opacity: .85, offset: .25 }, { transform: "scale(1)", opacity: 0 }], { duration: 900, delay: START + 420 + i * 260, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" }));
  },
  heat(layer, play) {
    const o = obj(layer, `<path class="ink" d="M16 60 C16 34, 84 34, 84 60"/><rect class="ink" x="13" y="60" width="74" height="16" rx="5"/><path class="ink" d="M33 51 H46 M54 51 H67 M41 43 H59 M87 68 L99 63"/>`);
    if (!play) return;
    // sparks lift off the heat keeper: few, large enough to read, in the label's own red with a hot centre
    later(layer, () => { const L = layer.getBoundingClientRect(), r = o.getBoundingClientRect(), big = Math.max(1, Math.min(1.7, L.height / 120));
      for (let i = 0; i < 12; i++) { const e = el("span", "fx-ember", layer), size = rnd(8, 15) * big;
        e.style.cssText = `left:${r.left - L.left + rnd(0.12, 0.88) * r.width - size / 2}px;top:${r.top - L.top + rnd(0.3, 0.5) * r.height}px;width:${size}px;height:${size}px`;
        e.animate([{ transform: "translate(0,0) scale(.5)", opacity: 0 }, { opacity: 1, offset: .18 }, { opacity: .9, offset: .55 }, { transform: `translate(${rnd(-34, 20)}px,${-rnd(0.55, 1.15) * L.height}px) scale(.3)`, opacity: 0 }],
          { duration: rnd(900, 1500), delay: rnd(0, 520), easing: "cubic-bezier(.25,.5,.3,1)", fill: "both" }).onfinish = () => e.remove(); } });
  },
  hoses(layer, play) {
    // a hose uncoils across the right half of the band and ends in its mouthpiece. It starts right of the title.
    const W = layer.clientWidth, H = layer.clientHeight, x = f => f * W, y = f => f * H, n = v => v.toFixed(1);
    const end = [x(.89), y(.5)], ctl = [x(.8), y(.92)], len0 = Math.hypot(end[0] - ctl[0], end[1] - ctl[1]), ux = (end[0] - ctl[0]) / len0, uy = (end[1] - ctl[1]) / len0, tip = Math.max(22, Math.min(44, H * 0.26));
    const d = `M${n(x(.47))} ${n(y(.8))} C ${n(x(.56))} ${n(y(.8))}, ${n(x(.57))} ${n(y(.2))}, ${n(x(.67))} ${n(y(.3))} S ${n(ctl[0])} ${n(ctl[1])}, ${n(end[0])} ${n(end[1])}`;
    const w = el("span", "fx-hose", layer);
    w.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path class="ink" d="${d}"/><path class="ink tip" d="M${n(end[0])} ${n(end[1])} L${n(end[0] + ux * tip)} ${n(end[1] + uy * tip)}"/></svg>`;
    const p = w.querySelector("path"), t = w.querySelector(".tip"), len = Math.ceil(p.getTotalLength());
    p.style.strokeDasharray = len;
    if (!play) return;
    p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1200, delay: START, easing: "cubic-bezier(.3,.1,.2,1)", fill: "both" });
    t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: START + 1120, easing: "ease-out", fill: "both" });
  },
  parts(layer, play) {
    const o = obj(layer, `<g class="turn"><polygon class="ink" points="93,50 71.5,87.2 28.5,87.2 7,50 28.5,12.8 71.5,12.8"/><circle class="ink" cx="50" cy="50" r="19"/></g>`);
    if (play) o.querySelector(".turn").animate([{ transform: "rotate(-170deg) scale(.72)", opacity: 0 }, { opacity: 1, offset: .3 }, { transform: "rotate(0deg) scale(1)", opacity: 1 }], { duration: 850, delay: START, easing: "cubic-bezier(.3,1.45,.5,1)", fill: "both" });
  },
  misc(layer, play) {
    const o = obj(layer, `<g class="turn" transform="rotate(-6 50 50)"><rect class="ink" x="12" y="20" width="76" height="60" rx="7"/><path class="ink" d="M12 39 H88"/><path class="ink" d="M24 50 H76" stroke-dasharray="3 6"/><path class="ink" d="M56 58 C50 55, 43 57, 43 62 C43 68, 57 65, 57 71 C57 76, 49 78, 43 74 M50 54 V79"/></g>`);
    if (!play) return;
    // the price gun: the header's label is stamped first, then each card's label on the first screen, one thump at a time
    const stamp = (s, delay, from) => s.animate([{ scale: String(from), opacity: 0 }, { opacity: 1, offset: .45 }, { scale: ".93", offset: .72 }, { scale: "1", opacity: 1 }], { duration: 300, delay, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" });
    stamp(o.querySelector("svg"), START, 1.6);
    const vh = innerHeight; let k = 0;
    for (const tile of document.querySelectorAll(".grid .card .tile")) {
      const s = tile.querySelector(".sticker"), r = tile.getBoundingClientRect(); if (!s || r.top >= vh || r.bottom <= 0) continue;
      const d = START + 260 + k++ * 140;
      stamp(s, d, 1.6);
      tile.animate([{ scale: "1" }, { scale: ".975", offset: .5 }, { scale: "1" }], { duration: 180, delay: d + 150, easing: "ease-out" }); // the tile gives a little under the gun
    }
  },
};
const PIECE = {
  // someone spritzes the bottle: mist crosses behind it from the left, below the price label
  cologne(layer, play) { if (play) later(layer, () => spritz(layer, -0.02, 0.36, Math.PI * 0.05, 0.62)); },
  // the price gun again: the one label on the page lands with a thump
  misc(layer, play, host) { const s = host.querySelector(".sticker"); if (play && s) s.animate([{ scale: "1.6", opacity: 0 }, { opacity: 1, offset: .45 }, { scale: ".93", offset: .72 }, { scale: "1", opacity: 1 }], { duration: 320, delay: START, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" }); },
};

let played = "";
function place() {
  const head = document.querySelector(".shophead[data-cat]"), stage = document.querySelector('[data-cat="cologne"] [data-stage], [data-cat="misc"] [data-stage]');
  const host = head || stage; if (!host || host.querySelector(":scope > .fx")) return;
  const cat = (head || stage.closest("[data-cat]")).dataset.cat, run = head ? FX[cat] : PIECE[cat];
  if (!run) return;
  const key = (head ? "head|" : "piece|") + location.pathname, fresh = key !== played; played = key;
  const layer = el("span", "fx"); layer.setAttribute("aria-hidden", "true"); host.prepend(layer);
  run(layer, fresh && !RM.matches, host);
}
new MutationObserver(place).observe(document.getElementById("main"), { childList: true });
addEventListener("routechange", () => { played = ""; }); // arriving again plays it again; a re-draw of the same page does not
place();
