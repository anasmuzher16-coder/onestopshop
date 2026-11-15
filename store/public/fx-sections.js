// 06 section entrances. One rule for every section of the shop:
//   the header band shows one real object from that section, drawn in the same heavy ink line, sitting on the
//   right at the height of the band; when the page opens, that object does its one physical thing, once.
//   hookahs  a hookah, and smoke rolls in (fx-smoke.js)   cologne  an atomiser sprays two spritzes of mist
//   bases    light crosses the glass of a base            bowls    a bowl is set down and heat lifts off it
//   heat     sparks lift off a heat keeper                hoses    a hose uncoils to its mouthpiece
//   parts    a nut turns and seats                        misc     the price gun: a label is stamped, then the cards
// The object is part of the header from the first frame (only the misc label arrives, because arriving is its
// act). Everything sits behind the type, and nothing moves when motion is turned off.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const START = 450; // after the page change has finished fading, so nothing plays into a half-faded page
const el = (tag, cls, parent) => { const n = document.createElement(tag); n.className = cls; if (parent) parent.append(n); return n; };
const rnd = (a, b) => a + Math.random() * (b - a);
// the object: a square on the right of the band, drawn in a 100 x 100 box
const obj = (layer, inner) => { const w = el("span", "fx-obj", layer); w.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`; fit(layer, w); return w; };
// The object never touches the title. Where a long title leaves no room beside it (a phone), the object drops
// to the lower right, under the end of the title, as large as that space allows.
function fit(layer, o) {
  const band = layer.parentNode, h1 = band.querySelector("h1"); if (!h1) return;
  const L = band.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(h1);
  const T = range.getBoundingClientRect(), box = o.getBoundingClientRect(), size = box.width, gutter = L.right - box.right;
  const beside = L.right - gutter - T.right - 16;
  if (beside >= size) return;
  if (beside >= size * 0.6) { o.style.height = Math.floor(beside) + "px"; return; }
  const under = L.bottom - T.bottom - 4, s = Math.max(44, Math.floor(Math.min(size, under / 0.7))); // may run up to 30% of itself off the bottom edge
  o.style.cssText = `height:${s}px;top:auto;bottom:${-Math.round(s * 0.3)}px;translate:none`;
}
// a point inside the object's box, as a fraction of the layer
const at = (layer, o, fx, fy) => { const r = o.getBoundingClientRect(), L = layer.getBoundingClientRect(); return [(r.left - L.left + r.width * fx) / L.width, (r.top - L.top + r.height * fy) / L.height]; };
let uid = 0;

// ---- mist: two short bursts of very fine droplets and a little haze, from one point, on a small 2D canvas
function spritz(layer, ox, oy, angle, power = 1) {
  const cv = el("canvas", "fx-spritz", layer), dpr = Math.min(2, devicePixelRatio || 1), w = layer.clientWidth, h = layer.clientHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext("2d"); if (!g) return cv.remove();
  const scale = Math.max(0.75, Math.min(2.6, Math.min(w, h * 4) / 360)) * power, parts = [], cx = Math.cos(angle), cy = Math.sin(angle);
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
  // the smoke is drawn by fx-smoke.js; here is the hookah it belongs to
  hookahs(layer) {
    obj(layer, `<path class="ink" d="M38 6 H62 L57 17 H43 Z"/><path class="ink" d="M30 24 H70"/><path class="ink" d="M50 17 V58"/>
      <path class="ink" d="M43 58 H57 C57 68, 76 72, 76 86 C76 92, 70 96, 62 96 H38 C30 96, 24 92, 24 86 C24 72, 43 68, 43 58 Z"/><path class="ink" d="M57 48 C80 48, 92 62, 86 84"/>`);
  },
  cologne(layer, play) {
    // a whole bottle: squat body, one stem, a small pump head with its nozzle pointing left
    const o = obj(layer, `<rect class="ink" x="28" y="50" width="48" height="46" rx="7"/><path class="ink" d="M52 50 V38"/>
      <g class="head"><rect class="ink" x="41" y="20" width="22" height="18" rx="4"/><path class="ink" d="M41 28 H29"/></g>`);
    if (!play) return;
    // the pump is pressed twice, and each press sends a spritz out of the nozzle
    o.querySelector(".head").animate([{ transform: "translateY(0)" }, { transform: "translateY(7px)", offset: .12 }, { transform: "translateY(0)", offset: .3 }, { transform: "translateY(0)", offset: .46 }, { transform: "translateY(7px)", offset: .58 }, { transform: "translateY(0)", offset: .8 }, { transform: "translateY(0)" }], { duration: 740, delay: START - 60, easing: "ease-out" });
    later(layer, () => { const [x, y] = at(layer, o, 0.27, 0.28); spritz(layer, x, y, Math.PI * 1.02); });
  },
  bases(layer, play) {
    // a hookah base, not lab glass: flared lip, and water standing two thirds of the way up the belly
    const id = "fxc" + (++uid), g = "fxg" + uid, body = "M42 10 V34 C42 46, 12 60, 12 80 C12 90, 20 94, 30 94 H70 C80 94, 88 90, 88 80 C88 60, 58 46, 58 34 V10 Z";
    const o = obj(layer, `<defs><clipPath id="${id}"><path d="${body}"/></clipPath><linearGradient id="${g}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <g clip-path="url(#${id})"><rect class="beam" x="-25" y="-10" width="16" height="120" fill="url(#${g})"/><rect class="beam" x="-42" y="-10" width="6" height="120" fill="url(#${g})"/></g>
      <path class="ink" d="${body}"/><path class="ink" d="M35 9 H65"/><path class="ink" d="M17 70 C30 65, 40 75, 50 70 S 72 65, 83 70"/>`);
    // light crosses the glass and spends its whole run inside the shape
    if (play) o.querySelectorAll(".beam").forEach(b => b.animate([{ transform: "translateX(0) skewX(-18deg)" }, { transform: "translateX(140px) skewX(-18deg)" }], { duration: 1300, delay: START, easing: "cubic-bezier(.4,0,.3,1)", fill: "both" }));
  },
  bowls(layer, play) {
    // the bowl in profile: a cup on a stem. It is set down, and heat lifts off the top.
    const o = obj(layer, `<g class="set"><path class="ink" d="M16 34 H84"/><path class="ink" d="M21 34 C21 58, 38 64, 43 68 V88 M79 34 C79 58, 62 64, 57 68 V88"/><path class="ink" d="M34 90 H66"/></g>
      <path class="lit" d="M34 24 q5 -5 0 -10 q-5 -5 0 -10"/><path class="lit" d="M50 26 q5 -5 0 -10 q-5 -5 0 -10"/><path class="lit" d="M66 24 q5 -5 0 -10 q-5 -5 0 -10"/>`);
    if (!play) return;
    o.querySelector(".set").animate([{ transform: "translateY(-12px)" }, { transform: "translateY(2px)", offset: .7 }, { transform: "translateY(0)" }], { duration: 520, delay: START, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" });
    o.querySelectorAll(".lit").forEach((c, i) => c.animate([{ transform: "translateY(6px)", opacity: 0 }, { opacity: .9, offset: .3 }, { transform: "translateY(-8px)", opacity: 0 }], { duration: 1100, delay: START + 480 + i * 170, easing: "cubic-bezier(.2,.6,.3,1)", fill: "both" }));
  },
  heat(layer, play) {
    // a heat keeper: a lidded dome with vent slots and its handle, filling the box
    const o = obj(layer, `<path class="ink" d="M10 64 C10 24, 90 24, 90 64"/><rect class="ink" x="7" y="64" width="86" height="18" rx="7"/><path class="ink" d="M29 50 H44 M56 50 H71 M40 37 H60"/><path class="ink" d="M93 73 L104 67"/>`);
    if (!play) return;
    // sparks lift off it and die inside the band: few, large enough to read, the label's red with a hot centre
    later(layer, () => { const L = layer.getBoundingClientRect(), r = o.getBoundingClientRect(), big = Math.max(1, Math.min(1.7, L.height / 120));
      for (let i = 0; i < 12; i++) { const e = el("span", "fx-ember", layer), size = rnd(10, 18) * big;
        e.style.cssText = `left:${r.left - L.left + rnd(0.15, 0.85) * r.width - size / 2}px;top:${r.top - L.top + rnd(0.28, 0.48) * r.height}px;width:${size}px;height:${size}px`;
        e.animate([{ transform: "translate(0,0) scale(.5)", opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: .9, offset: .55 }, { transform: `translate(${rnd(-30, 18)}px,${-rnd(0.25, 0.5) * L.height}px) scale(.3)`, opacity: 0 }],
          { duration: rnd(1300, 2000), delay: rnd(0, 520), easing: "cubic-bezier(.25,.5,.3,1)", fill: "both" }).onfinish = () => e.remove(); } });
  },
  hoses(layer, play) {
    // a hose in one coil, ending in its tapered mouthpiece
    const o = obj(layer, `<path class="ink coil" d="M2 84 C18 84, 22 62, 36 54 C54 44, 70 56, 60 70 C50 84, 30 70, 42 50 C50 36, 62 34, 72 30"/><path class="ink tip" d="M69 26 L84 6 L94 13 L79 34 Z"/>`);
    const p = o.querySelector(".coil"), len = Math.ceil(p.getTotalLength() * o.getBoundingClientRect().width / 100) + 2; // the line weight does not scale, so the dash is measured in screen pixels
    p.style.strokeDasharray = len;
    if (!play) return;
    p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1150, delay: START, easing: "cubic-bezier(.3,.1,.2,1)", fill: "both" });
    o.querySelector(".tip").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: START + 1050, easing: "ease-out", fill: "backwards" }); // back to the shared ink weight afterwards, never darker
  },
  parts(layer, play) {
    const o = obj(layer, `<g class="turn"><polygon class="ink" points="93,50 71.5,87.2 28.5,87.2 7,50 28.5,12.8 71.5,12.8"/><circle class="ink" cx="50" cy="50" r="19"/></g>`);
    if (play) o.querySelector(".turn").animate([{ transform: "rotate(-150deg)" }, { transform: "rotate(0deg)" }], { duration: 850, delay: START, easing: "cubic-bezier(.3,1.45,.5,1)", fill: "backwards" });
  },
  misc(layer, play) {
    // the shop's own price label: near square, a top strip, a price in the display face
    const o = obj(layer, `<g transform="rotate(-6 50 50)"><rect class="ink" x="15" y="12" width="70" height="76" rx="9"/><path class="ink" d="M15 34 H85"/><text class="inkfill" x="50" y="76" text-anchor="middle">$5</text></g>`);
    if (!play) return;
    // the price gun: the header's label is stamped first, then each card's label on the first screen, one thump at a time
    const stamp = (s, delay) => s.animate([{ scale: "1.35", opacity: 0 }, { opacity: 1, offset: .45 }, { scale: ".94", offset: .72 }, { scale: "1", opacity: 1 }], { duration: 280, delay, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" });
    stamp(o.querySelector("svg"), START);
    const vh = innerHeight; let k = 0;
    for (const tile of document.querySelectorAll(".grid .card .tile")) {
      const s = tile.querySelector(".sticker"), r = tile.getBoundingClientRect(); if (!s || r.top >= vh || r.bottom <= 0) continue;
      const d = START + 120 + Math.min(k++, 5) * 80; // no price waits past the sixth
      stamp(s, d);
      tile.animate([{ scale: "1" }, { scale: ".975", offset: .5 }, { scale: "1" }], { duration: 170, delay: d + 130, easing: "ease-out" }); // the tile gives a little under the gun
    }
  },
};
const PIECE = {
  // someone spritzes the bottle: mist crosses behind it from off the left edge, below the price label
  cologne(layer, play) { if (play) later(layer, () => spritz(layer, -0.08, 0.36, Math.PI * 0.05, 1.5)); },
  // the price gun again: the one label on the page lands with a thump
  misc(layer, play, host) { const s = host.querySelector(".sticker"); if (play && s) s.animate([{ scale: "1.35", opacity: 0 }, { opacity: 1, offset: .45 }, { scale: ".94", offset: .72 }, { scale: "1", opacity: 1 }], { duration: 300, delay: START, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" }); },
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
