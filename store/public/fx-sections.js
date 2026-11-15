// 06 section entrances: each section of the shop has one signature move that plays once when its page opens.
//   hookahs  a bank of smoke rolls in (fx-smoke.js)        cologne  two spritzes of fine mist
//   bases    a sheen crosses, light catching glass          bowls    rings ripple out once
//   heat     embers rise and fade                           hoses    a hose line draws itself
//   parts    a nut turns and seats                          misc     the price labels stamp down
// Everything sits behind the type (z-index -1 inside the header band), moves by transform and opacity, and is
// skipped entirely when motion is turned off. Ornaments that stay (the hose line, the nut) are put back at rest
// if the page re-draws.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const el = (tag, cls, parent) => { const n = document.createElement(tag); n.className = cls; if (parent) parent.append(n); return n; };
const svg = (html, cls, parent) => { const w = el("span", cls, parent); w.innerHTML = html; return w; };
const rnd = (a, b) => a + Math.random() * (b - a);
const EASE = "cubic-bezier(.16,1,.3,1)";

// ---- cologne: spritz. Two short bursts of droplets and mist from one point, on a small 2D canvas.
function spritz(layer, ox, oy, angle, play) {
  if (!play) return;
  const cv = el("canvas", "fx-spritz", layer), dpr = Math.min(2, devicePixelRatio || 1), w = layer.clientWidth, h = layer.clientHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext("2d"); if (!g) return cv.remove();
  const scale = Math.max(0.75, Math.min(1.6, Math.min(w, h * 2.2) / 360)), parts = [];
  const burst = (n, power) => {
    for (let i = 0; i < n; i++) { const a = angle + rnd(-0.46, 0.46) * (0.35 + Math.random()), v = rnd(150, 520) * power * scale;
      parts.push({ x: ox * w, y: oy * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(0.7, 2.4), life: rnd(1.0, 2.1), age: 0, mist: false }); }
    for (let i = 0; i < Math.round(n / 14); i++) { const a = angle + rnd(-0.3, 0.3), v = rnd(60, 190) * power * scale;
      parts.push({ x: ox * w, y: oy * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(16, 38) * scale, life: rnd(1.9, 3.0), age: 0, mist: true }); }
  };
  burst(190, 1); const second = setTimeout(() => burst(130, 0.85), 340);
  let last = performance.now();
  const tick = now => {
    if (!cv.isConnected) return clearTimeout(second);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, cv.width, cv.height);
    let alive = 0;
    for (const p of parts) {
      p.age += dt; if (p.age >= p.life) continue; alive++;
      const drag = Math.exp(-(p.mist ? 1.25 : 2.5) * dt); p.vx *= drag; p.vy = p.vy * drag + (p.mist ? -3 : 30) * dt; // droplets fall, mist hangs
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.age / p.life;
      if (p.mist) { const rad = p.r * (1 + (1 - k) * 1.4) * dpr, grd = g.createRadialGradient(p.x * dpr, p.y * dpr, 0, p.x * dpr, p.y * dpr, rad);
        grd.addColorStop(0, `rgba(255,252,246,${0.1 * Math.min(1, k * 1.6)})`); grd.addColorStop(1, "rgba(255,252,246,0)"); g.fillStyle = grd; g.beginPath(); g.arc(p.x * dpr, p.y * dpr, rad, 0, 6.283); g.fill(); }
      else { g.fillStyle = `rgba(255,252,246,${0.92 * Math.pow(k, 1.4)})`; g.beginPath(); g.arc(p.x * dpr, p.y * dpr, p.r * dpr, 0, 6.283); g.fill(); }
    }
    if (alive || now - start < 400) requestAnimationFrame(tick); else cv.remove();
  };
  const start = last; requestAnimationFrame(tick);
}

const FX = {
  cologne(layer, play) { spritz(layer, 0.9, 0.56, Math.PI * 1.02, play); }, // from the right edge, almost level, so the mist stays inside the band
  bases(layer, play) {
    for (const [cls, delay, from, to] of [["fx-sheen", 220, -180, 460], ["fx-sheen fx-sheen--thin", 400, -500, 1700]]) { const s = el("span", cls, layer);
      if (play) s.animate([{ transform: `translateX(${from}%) skewX(-18deg)` }, { transform: `translateX(${to}%) skewX(-18deg)` }], { duration: 1500, delay, easing: "cubic-bezier(.45,0,.2,1)", fill: "both" }); }
  },
  bowls(layer, play) {
    for (let i = 0; i < 3; i++) { const r = el("span", "fx-ring", layer);
      if (play) r.animate([{ transform: "translate(-50%,-50%) scale(.12)", opacity: 0 }, { opacity: .5, offset: .18 }, { transform: "translate(-50%,-50%) scale(3.4)", opacity: 0 }], { duration: 1900, delay: 180 + i * 260, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" }); }
  },
  heat(layer, play) {
    const glow = el("span", "fx-glow", layer);
    if (!play) return;
    glow.animate([{ opacity: 0 }, { opacity: 1, offset: .35 }, { opacity: .45 }], { duration: 2200, delay: 150, easing: "ease-out", fill: "both" });
    const h = layer.clientHeight, big = Math.max(1, Math.min(2, h / 120)); // embers scale with the band, so they read on a desk screen too
    for (let i = 0; i < 28; i++) { const e = el("span", "fx-ember", layer), size = rnd(4, 10) * big; e.style.cssText = `left:${rnd(3, 97)}%;width:${size}px;height:${size}px`;
      e.animate([{ transform: "translate(0,0) scale(.6)", opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: .85, offset: .6 }, { transform: `translate(${rnd(-28, 28)}px,${-rnd(0.45, 1.05) * h}px) scale(.35)`, opacity: 0 }],
        { duration: rnd(1700, 3200), delay: 150 + rnd(0, 1600), easing: "cubic-bezier(.25,.5,.3,1)", fill: "both" }).onfinish = () => e.remove(); }
  },
  hoses(layer, play) {
    const W = layer.clientWidth, H = layer.clientHeight, x = f => (f * W).toFixed(1), y = f => (f * H).toFixed(1);
    const d = `M-12 ${y(.8)} C ${x(.12)} ${y(.8)}, ${x(.14)} ${y(.18)}, ${x(.28)} ${y(.26)} S ${x(.4)} ${y(.94)}, ${x(.53)} ${y(.72)} S ${x(.62)} ${y(.08)}, ${x(.74)} ${y(.3)} S ${x(.88)} ${y(.95)}, ${W + 12} ${y(.5)}`;
    const w = svg(`<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}"/></svg>`, "fx-hose", layer), p = w.querySelector("path"), len = Math.ceil(p.getTotalLength());
    p.style.strokeDasharray = len;
    if (play) p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1800, delay: 200, easing: "cubic-bezier(.3,.1,.2,1)", fill: "both" });
  },
  parts(layer, play) {
    const nut = points => `<svg viewBox="-50 -50 100 100" aria-hidden="true"><polygon points="${points}"/><circle r="19"/></svg>`, hex = "43,0 21.5,37.2 -21.5,37.2 -43,0 -21.5,-37.2 21.5,-37.2";
    const a = svg(nut(hex), "fx-nut", layer), b = svg(nut(hex), "fx-nut fx-nut--small", layer);
    if (!play) return;
    a.animate([{ transform: "rotate(-170deg) scale(.7)", opacity: 0 }, { opacity: 1, offset: .3 }, { transform: "rotate(0deg) scale(1)", opacity: 1 }], { duration: 900, delay: 200, easing: "cubic-bezier(.3,1.45,.5,1)", fill: "both" });
    b.animate([{ transform: "rotate(150deg) scale(.7)", opacity: 0 }, { opacity: 1, offset: .3 }, { transform: "rotate(0deg) scale(1)", opacity: 1 }], { duration: 800, delay: 420, easing: "cubic-bezier(.3,1.45,.5,1)", fill: "both" });
  },
  misc(layer, play) {
    if (!play) return;
    // the price gun: each label on the first screen lands with a small thump, one after another
    [...document.querySelectorAll(".grid .sticker")].slice(0, 10).forEach((s, i) => {
      s.animate([{ scale: "1.9", opacity: 0 }, { opacity: 1, offset: .4 }, { scale: ".94", offset: .72 }, { scale: "1", opacity: 1 }], { duration: 300, delay: 260 + i * 105 + rnd(0, 40), easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" });
    });
  },
};

let played = "";
function place() {
  const head = document.querySelector(".shophead[data-cat]"), stage = document.querySelector('[data-cat="cologne"] [data-stage], [data-cat="misc"] [data-stage]');
  const host = head || stage, cat = head ? head.dataset.cat : stage ? stage.closest("[data-cat]").dataset.cat + "-piece" : "";
  if (!host || host.querySelector(":scope > .fx")) return;
  const PIECE = {
    // from the side of the cap, out across the open part of the tile, behind the bottle and clear of the price label
    "cologne-piece": (layer, play) => spritz(layer, 0.37, 0.12, Math.PI * 1.04, play),
    // the price gun again: the one label on the page lands with a thump
    "misc-piece": (layer, play) => { const s = host.querySelector(".sticker"); if (play && s) s.animate([{ scale: "2.1", opacity: 0 }, { opacity: 1, offset: .4 }, { scale: ".93", offset: .72 }, { scale: "1", opacity: 1 }], { duration: 340, delay: 420, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" }); },
  };
  const run = PIECE[cat] || FX[cat];
  if (!run) return;
  const key = cat + "|" + location.pathname, fresh = key !== played; played = key;
  const layer = el("span", "fx"); layer.setAttribute("aria-hidden", "true"); host.prepend(layer);
  run(layer, fresh && !RM.matches);
}
new MutationObserver(place).observe(document.getElementById("main"), { childList: true });
addEventListener("routechange", () => { played = ""; }); // arriving again plays it again; a re-draw of the same page does not
place();
