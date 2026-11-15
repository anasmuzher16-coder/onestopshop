// 06 section entrances. One rule for every section of the shop:
//   the header band carries one real object from that section, a solid silhouette at the weight of the type, on
//   the right; when the page opens, a hand does the one thing you do to that object at the counter, once, and the
//   object reacts to it.
//   hookahs  smoke rolls in and pushes the hose (fx-smoke.js)   cologne  the pump is pressed twice; the bottle kicks
//   bases    the glass is tipped to the light and let go        bowls    dropped the last inch; knocks, rocks, heat lifts
//   heat     the vents light, the lid jumps, sparks leave       hoses    thrown out; the mouthpiece whips
//   parts    spun on, then wrenched tight; it seats             misc     the price gun: one hit alone, then faster
// Timing: every act makes contact at T0, after the page change has landed; a wind-up may start at WIND. Three
// curves: ENTER (things arriving), STRIKE (things driven into contact: they speed up), SEAT (the label spring).
// Everything sits behind the type. With motion turned off the objects are simply there, at rest.
// Rules kept here: a re-draw of the same page changes nothing a shopper can see; nothing already seen is hidden;
// a resting state never depends on a measurement.
import { OBJ } from "./fx-objects.js";
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const T0 = 450, WIND = T0 - 140;
const ENTER = "cubic-bezier(.16,1,.3,1)", STATE = "cubic-bezier(.4,0,.2,1)", STRIKE = "cubic-bezier(.33,0,.67,.33)";
// an unsupported easing string makes element.animate() throw, so the spring is feature-tested (linear(): Safari 17.2)
const SEAT = window.CSS && CSS.supports("animation-timing-function", "linear(0,1)")
  ? "linear(0,.25 6%,.62 14%,.9 22%,1.04 30%,1.07 36%,1.04 44%,.995 56%,.988 66%,1.002 82%,1)" : "cubic-bezier(.34,1.56,.64,1)";
const play = (node, frames, duration, delay = 0, fill = "backwards") => node.animate(frames, { duration, delay, fill });
const when = (layer, ms, fn) => setTimeout(() => { if (layer.isConnected) fn(); }, ms);
const el = (tag, cls, parent) => { const n = document.createElement(tag); n.className = cls; if (parent) parent.append(n); return n; };
const rnd = (a, b) => a + Math.random() * (b - a);
const SVG = "http://www.w3.org/2000/svg";
// wraps drawn parts in a named group, so a part can move on its own pivot (set in styles.css)
const group = (cls, nodes) => { const g = document.createElementNS(SVG, "g"); g.setAttribute("class", cls); nodes[0].before(g); nodes.forEach(n => g.append(n)); return g; };
// the object: a square on the right of the band, drawn in a 100 x 100 box
const obj = (layer, inner, cls = "") => { const w = el("span", "fx-obj " + cls, layer); w.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`; fit(layer, w); return w; };
// The object never touches the title. Where a long title leaves less room beside it (a phone), the object takes
// the room there is; only when that is too small to read does it drop under the end of the title.
function fit(layer, o) {
  o.style.cssText = "";
  const band = layer.parentNode, h1 = band && band.querySelector("h1"); if (!h1) return;
  const L = band.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(h1);
  const T = range.getBoundingClientRect(), box = o.getBoundingClientRect(), size = box.width, gutter = L.right - box.right;
  const beside = L.right - gutter - T.right - 10;
  if (beside >= size) return;
  if (beside >= 56) { o.style.height = Math.floor(beside) + "px"; return; }
  const under = L.bottom - T.bottom - 4, s = Math.max(56, Math.floor(Math.min(size, under)));
  o.style.cssText = `height:${s}px;top:auto;bottom:4px;translate:none`;
}
// a point inside the object's box, as a fraction of the layer
const at = (layer, o, fx, fy) => { const r = o.getBoundingClientRect(), L = layer.getBoundingClientRect(); return [(r.left - L.left + r.width * fx) / L.width, (r.top - L.top + r.height * fy) / L.height]; };
let uid = 0;

// ---- one small 2D canvas over a layer; runs until tick() says its matter is spent, then removes itself
function fxCanvas(layer, tick) {
  const cv = el("canvas", "fx-spritz", layer), w = layer.clientWidth, h = layer.clientHeight;
  const dpr = Math.min(w * h > 250000 ? 1.5 : 2, devicePixelRatio || 1);   // a 1440 band at 2x is 1.4 M pixels to clear per frame; 1.5x is 0.8 M
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext("2d"); if (!g) { cv.remove(); return; }
  g.scale(dpr, dpr); g.lineCap = "round";
  let last = performance.now();
  const frame = now => {
    if (!cv.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;   // clock-timed: a 30 fps phone shows the same motion
    g.globalAlpha = 1; g.clearRect(0, 0, w, h);
    if (tick(g, dt)) requestAnimationFrame(frame); else { cv.width = cv.height = 0; cv.remove(); } // hand the memory back
  };
  requestAnimationFrame(frame);
}
// one soft round sprite per colour, drawn once and reused (no gradient objects made per frame)
const SOFT = {};
function soft(rgb) {
  if (SOFT[rgb]) return SOFT[rgb];
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(0.35, `rgba(${rgb},.55)`); grd.addColorStop(0.7, `rgba(${rgb},.14)`); grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return SOFT[rgb] = c;
}
const bell = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;   // -1..1, most near 0

// ---- mist: a pump atomiser. Two presses; each sends a cone of droplets that streak while fast, are stopped by the air
// within one "reach", and leave a cloud that swells, drifts on, sinks a little and thins out.
function spritz(layer, ox, oy, angle, power = 1) {
  const w = layer.clientWidth, h = layer.clientHeight;
  const R = Math.min(w * 0.42, h * 2.4) * power;          // reach in px: 164 on a 390 band, 600 on a 1440 band, 246 on a phone product tile
  const S = Math.max(1, Math.min(1.5, R / 220));           // droplet scale: 1 on a phone, 1.5 on a desktop band
  const X = ox * w, Y = oy * h, drops = [], puffs = [], img = soft("255,252,246");
  const burst = (n, force, at) => {
    for (let i = 0; i < n; i++) {
      const u = Math.random(), off = bell(), a = angle + off * 0.36;             // cone: 41 degrees across, dense in the middle
      const k = 3.2 + 3.6 * (1 - u);                                              // air drag per second: fine droplets stop soonest
      const v = R * k * rnd(0.5, 1.25) * force * (1 - 0.3 * Math.abs(off));      // so each one travels 0.5 to 1.25 reaches
      drops.push({ x: X, y: Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, k, r: S * (0.4 + 1.3 * u * u * u),   // radius 0.4 to 1.7 px x S, most of them fine
        g: 70 * S * u * u - 5, life: 0.55 + 0.8 * u + rnd(0, 0.5), age: -at - rnd(0, 0.09), ph: rnd(0, 6.28) });   // the press lasts 90 ms
    }
    for (let i = 0; i < Math.round(n / 11); i++) {
      const a = angle + bell() * 0.3, v = R * 2.4 * rnd(0.3, 0.8) * force, off = rnd(0.04, 0.22) * R;   // the cloud starts out along the spray, never as a blob on the nozzle
      puffs.push({ x: X + Math.cos(a) * off, y: Y + Math.sin(a) * off, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: R * rnd(0.1, 0.3), life: rnd(1.4, 2.4), age: -at - rnd(0, 0.12) });
    }
  };
  burst(240, 1, 0); burst(160, 0.85, 0.34);
  fxCanvas(layer, (g, dt) => {
    let alive = 0;
    for (const p of puffs) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const d = Math.exp(-2.4 * dt); p.vx *= d; p.vy = p.vy * d + 5 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const q = p.age / p.life, rad = p.r * (0.3 + 0.7 * (1 - Math.exp(-p.age * 3.5))) * (1 + 0.6 * q);   // swells fast, then keeps spreading
      g.globalAlpha = 0.15 * Math.min(1, p.age / 0.12) * Math.pow(1 - q, 1.5);
      g.drawImage(img, p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = g.fillStyle = "rgb(255,252,246)";
    for (const p of drops) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const d = Math.exp(-p.k * dt);
      p.vx = p.vx * d + Math.sin(p.ph + p.age * 9) * 14 * dt; p.vy = p.vy * d + p.g * dt;   // a little swirl once slow; heavy ones settle, fine ones lift
      p.x += p.vx * dt; p.y += p.vy * dt;
      const q = p.age / p.life, sp = Math.hypot(p.vx, p.vy), len = Math.min(sp * 0.022, 18 * S), r = p.r * (1 - 0.5 * q);   // 22 ms of streak; it dries as it goes
      g.globalAlpha = 0.75 * Math.pow(1 - q, 1.2) * r / (r + len * 0.3);                    // a streak is the same light spread along a line
      g.beginPath();
      if (len > 1) { g.lineWidth = 2 * r; g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * len, p.y - p.vy / sp * len); g.stroke(); }
      else { g.arc(p.x, p.y, r, 0, 6.283); g.fill(); }
    }
    return alive > 0;
  });
}

// ---- sparks: embers thrown up from the vents of the heat keeper in three crackles. Each is lofted, zigzags in the hot air,
// slows, cools from pale yellow through orange to red, flickers, and is out before the top of the band.
function embers(layer, o) {
  const L = layer.getBoundingClientRect(), b = o.getBoundingClientRect(), bx = b.left - L.left, by = b.top - L.top, big = Math.max(1, Math.min(1.8, L.height / 120));
  const vents = [[0.3, 0.3], [0.54, 0.3], [0.42, 0.385], [0.42, 0.27]], ps = [], glow = soft("214,51,38");
  for (let i = 0; i < 18; i++) {
    const v = vents[i % 4], x = bx + (v[0] + rnd(-0.07, 0.07)) * b.width, y = by + v[1] * b.height, k = rnd(1.1, 1.9);
    const rise = rnd(0.4, 0.92) * Math.max(24, y - 4);                               // never past the top edge of the band
    ps.push({ x, y, vx: rnd(-26, 26) * big, vy: -rise * k, k, r: rnd(1.3, 2.6) * big, life: rnd(0.9, 1.9), age: -(Math.floor(i / 6) * 0.26 + rnd(0, 0.16)),
      w: rnd(6, 9), ph: rnd(0, 6.28), amp: rnd(350, 800) * big });
  }
  fxCanvas(layer, (g, dt) => {
    let alive = 0;
    for (const p of ps) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const d = Math.exp(-p.k * dt); p.vx = p.vx * d + Math.sin(p.ph + p.age * p.w) * p.amp * dt; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt;
      const heat = 1 - p.age / p.life, fl = 0.8 + 0.2 * Math.sin(p.age * 38 + p.ph), sp = Math.hypot(p.vx, p.vy), len = Math.min(sp * 0.05, 16 * big);
      const hr = p.r * (2.2 + 2.6 * heat);
      g.globalAlpha = 0.6 * heat * fl; g.drawImage(glow, p.x - hr, p.y - hr, hr * 2, hr * 2);            // red glow
      if (len > 1) { g.globalAlpha = 0.8 * heat; g.strokeStyle = "rgb(214,51,38)"; g.lineWidth = 1.5 * p.r; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * len, p.y - p.vy / sp * len); g.stroke(); }
      g.globalAlpha = Math.min(1, heat * 2.2) * fl; g.fillStyle = heat > 0.6 ? "rgb(255,244,186)" : heat > 0.3 ? "rgb(255,186,84)" : "rgb(214,51,38)";
      g.beginPath(); g.arc(p.x, p.y, p.r * (0.55 + 0.45 * heat), 0, 6.283); g.fill();                     // the hot centre
    }
    return alive > 0;
  });
}

// ---- steam: heat coming off a bowl. Thin ribbons that rise fast and slow down, widen and waver more the higher they are,
// then let go of the rim and thin out. Drawn as one tapered stroke each, with a wider faint one under it for softness.
function steam(layer, o) {
  const L = layer.getBoundingClientRect(), b = o.getBoundingClientRect(), bx = b.left - L.left, by = b.top - L.top, big = Math.max(1, Math.min(1.8, L.height / 120));
  const ws = [0.3, 0.44, 0.58, 0.71].map((fx, i) => {
    const y = by + 0.19 * b.height, H = Math.max(26, y - 4) * rnd(0.8, 1);   // uses all the room there is above the rim
    return { x: bx + (fx + rnd(-0.03, 0.03)) * b.width, y, H, A: rnd(5, 9) * big, f: rnd(0.55, 0.9), ph: rnd(0, 6.28), lean: rnd(-6, 12) * big, life: rnd(2.3, 3), age: -i * 0.16 - rnd(0, 0.08) };
  });
  fxCanvas(layer, (g, dt) => {
    let alive = 0;
    for (const s of ws) {
      s.age += dt; if (s.age >= s.life) continue; alive++; if (s.age < 0) continue;
      const q = s.age / s.life, head = 1 - Math.exp(-s.age * 2), tk = Math.max(0, (s.age - 1.1) / (s.life - 1.1)), tail = tk * tk * 0.85 * head;
      const fade = Math.min(1, s.age / 0.18) * Math.pow(1 - q, 1.3);
      const pt = u => [s.x + s.lean * u + s.A * (0.1 + 1.2 * u) * Math.sin(6.283 * u * s.f - s.age * 2.6 + s.ph), s.y - u * s.H];
      const a = pt(tail), z = pt(head), grd = g.createLinearGradient(0, a[1], 0, z[1] - 0.01);
      grd.addColorStop(0, "rgba(255,252,246,0)"); grd.addColorStop(0.3, "rgba(255,252,246,1)"); grd.addColorStop(0.65, "rgba(255,252,246,.6)"); grd.addColorStop(1, "rgba(255,252,246,0)");
      g.strokeStyle = grd; g.beginPath(); g.moveTo(a[0], a[1]);
      for (let j = 1; j <= 14; j++) { const p = pt(tail + (head - tail) * j / 14); g.lineTo(p[0], p[1]); }
      g.globalAlpha = 0.2 * fade; g.lineWidth = 10 * big; g.stroke();     // soft body
      g.globalAlpha = 0.55 * fade; g.lineWidth = 3 * big; g.stroke();    // bright thread
    }
    return alive > 0;
  });
}

// ---- the label gun: a label comes down speeding up, twisted, hits at full size, presses in, springs, rests
const stamp = (s, hit, from = 1.5) => {
  play(s, [{ opacity: 0 }, { opacity: 1 }], 42, hit - 140);
  return play(s, [
    { scale: String(from), rotate: "7deg", easing: STRIKE },
    { scale: "1", rotate: "0deg", offset: .3333, easing: ENTER },   // contact
    { scale: ".92", rotate: "0deg", offset: .4286, easing: STATE },
    { scale: "1.035", rotate: "0deg", offset: .5952, easing: STATE },
    { scale: ".995", rotate: "0deg", offset: .8095, easing: STATE },
    { scale: "1", rotate: "0deg" }], 420, hit - 140);
};
const give = (tile, hit, depth = .972) => play(tile, [ // whatever is under the label gives a little
  { scale: "1", easing: ENTER }, { scale: String(depth), offset: .2273, easing: STATE }, { scale: "1.004", offset: .6, easing: STATE }, { scale: "1" }], 220, hit);

let arrivals = 0; // in-site page changes so far; 0 means this page was the first one loaded
const FX = {
  hookahs(layer, go) {
    const o = obj(layer, OBJ.hookahs), kids = [...o.querySelector(".o").children], hose = group("hose", kids.slice(2));
    if (!go) return;
    play(hose, [ // the smoke front reaches the hookah and pushes the hose downwind; it swings back and settles
      { transform: "rotate(0deg)", easing: ENTER }, { transform: "rotate(-6deg)", offset: .2, easing: STATE }, { transform: "rotate(2.6deg)", offset: .467, easing: STATE },
      { transform: "rotate(-1.1deg)", offset: .733, easing: STATE }, { transform: "rotate(0deg)" }], 900, 780);
  },
  cologne(layer, go) {
    const o = obj(layer, OBJ.cologne), recoil = group("recoil", [...o.querySelector(".o").children]);
    if (!go) return;
    play(o.querySelector(".head"), [ // driven down, held while it sprays, sprung back; twice, the second a shade shallower
      { transform: "translateY(0px)", easing: STRIKE }, { transform: "translateY(6px)", offset: .1167 }, { transform: "translateY(6px)", offset: .2333, easing: ENTER },
      { transform: "translateY(0px)", offset: .4667 }, { transform: "translateY(0px)", offset: .5333, easing: STRIKE }, { transform: "translateY(5.2px)", offset: .65 },
      { transform: "translateY(5.2px)", offset: .7667, easing: ENTER }, { transform: "translateY(0px)" }], 600, T0 - 70);
    play(recoil, [ // the bottle kicks back from each spray and rocks home
      { transform: "rotate(0deg)", easing: ENTER }, { transform: "rotate(1.5deg)", offset: .1111, easing: STATE }, { transform: "rotate(-0.5deg)", offset: .3016, easing: STATE },
      { transform: "rotate(0deg)", offset: .4921 }, { transform: "rotate(0deg)", offset: .5079, easing: ENTER }, { transform: "rotate(1.1deg)", offset: .619, easing: STATE },
      { transform: "rotate(-0.35deg)", offset: .8095, easing: STATE }, { transform: "rotate(0deg)" }], 630, T0);
    when(layer, T0, () => { const [x, y] = at(layer, o, 0.37, 0.21); spritz(layer, x, y, Math.PI * 1.02); }); // the nozzle is 6 units down when it fires
  },
  bases(layer, go) {
    const id = "fxc" + (++uid), g = "fxg" + uid, body = "M40 15 H60 V40 C60 58 88 62 88 78 C88 88 80 94 70 94 H30 C20 94 12 88 12 78 C12 62 40 58 40 40 Z";
    const o = obj(layer, `<defs><clipPath id="${id}"><path d="${body}"/></clipPath><linearGradient id="${g}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <g class="rock">${OBJ.bases}<g clip-path="url(#${id})"><g class="beam"><path d="M0 -10 C10 28, 10 74, -6 112 H18 C34 74, 34 28, 24 -10 Z" fill="url(#${g})"/><path d="M-20 -10 C-10 28, -10 74, -26 112 H-19 C-3 74, -3 28, -13 -10 Z" fill="url(#${g})"/></g></g>
      <path class="lit gl" d="M40 42 C40 58, 14 62, 13 76"/><path class="lit gr" d="M60 42 C60 58, 86 62, 87 76"/><path class="lit sh" d="M24 71 C27 64, 32 60, 37 56 M47 20 V32"/></g>`);
    const q = c => o.querySelector(c);
    if (!go) { q(".beam").style.opacity = 0; q(".sh").style.opacity = .5; return; } // the lit glass, at rest
    play(o.querySelector(".rock"), [ // tipped to the light, let go, drops back with one small overshoot
      { transform: "rotate(0deg)", easing: STATE }, { transform: "rotate(-4deg)", offset: .2258, easing: SEAT }, { transform: "rotate(0deg)" }], 620, WIND);
    const run = { duration: 1100, delay: T0 - 60, fill: "both" }; // the light crosses because the glass turned; each shoulder glints as it passes
    q(".beam").animate([{ transform: "translateX(-44px) skewX(-14deg)" }, { transform: "translateX(138px) skewX(-14deg)" }], { ...run, easing: "cubic-bezier(.3,.1,.3,1)" });
    q(".beam").animate([{ opacity: 0 }, { opacity: 1, offset: .14 }, { opacity: 1, offset: .8 }, { opacity: 0 }], run);
    q(".gl").animate([{ opacity: 0 }, { opacity: 0, offset: .16 }, { opacity: .9, offset: .34 }, { opacity: 0, offset: .56 }, { opacity: 0 }], run);
    q(".gr").animate([{ opacity: 0 }, { opacity: 0, offset: .46 }, { opacity: .8, offset: .64 }, { opacity: 0, offset: .86 }, { opacity: 0 }], run);
    q(".sh").animate([{ opacity: 0 }, { opacity: 0, offset: .6 }, { opacity: .5 }], run); // and the glass keeps a highlight
  },
  bowls(layer, go) {
    const o = obj(layer, OBJ.bowls, "low");
    if (!go) return;
    const set = o.querySelector(".set");
    play(set, [{ opacity: 0 }, { opacity: 1 }], 70, WIND); // it is not on the counter until it is put there
    play(set, [ // falls the last inch tilted, lands low edge first, knocks once, rocks out
      { transform: "translateY(-22px) rotate(-3deg)", easing: STRIKE }, { transform: "translateY(0px) rotate(2deg)", offset: .4, easing: ENTER },
      { transform: "translateY(-3px) rotate(-1.2deg)", offset: .6, easing: STRIKE }, { transform: "translateY(0px) rotate(0.6deg)", offset: .8, easing: STATE }, { transform: "translateY(0px) rotate(0deg)" }], 350, WIND);
    when(layer, T0 + 250, () => steam(layer, o)); // heat lifts off the top once it has settled
  },
  heat(layer, go) {
    // the light that shows through the two vents in the lid sits under the solid, so it is seen only through them
    const o = obj(layer, `<g class="keeper"><path class="glow" d="M65.6 38.1 A27.3 8.2 0 0 1 18.4 38.1 L29.3 36.2 A14.7 4.4 0 0 0 54.7 36.2 Z"/><path class="glow" d="M19.6 29.3 A27.3 8.2 0 0 1 64.4 29.3 L54 31.5 A14.7 4.4 0 0 0 30 31.5 Z"/>${OBJ.heat}</g>`);
    if (!go) return;
    o.querySelectorAll(".glow").forEach(gl => play(gl, [ // the vents start to glow, flash, then cool to the level they stay at
      { opacity: 0, easing: STRIKE }, { opacity: .6, offset: .1273 }, { opacity: 1, offset: .1636, easing: ENTER }, { opacity: .45 }], 1100, WIND));
    play(o.querySelector(".keeper"), [ // the lid jumps and rattles down
      { transform: "translateY(0px) rotate(0deg)", easing: ENTER }, { transform: "translateY(-2.5px) rotate(0.8deg)", offset: .25, easing: STRIKE },
      { transform: "translateY(0px) rotate(-0.6deg)", offset: .5, easing: STATE }, { transform: "translateY(0px) rotate(0.3deg)", offset: .75, easing: STATE }, { transform: "translateY(0px) rotate(0deg)" }], 280, T0);
    when(layer, T0, () => embers(layer, o)); // three crackles of sparks leave the vents and die inside the band
  },
  hoses(layer, go) {
    const o = obj(layer, `<g class="whip">${OBJ.hoses}</g>`), p = o.querySelector(".coil");
    if (!go) return; // at rest the line is simply drawn: no dash is left on it
    const len = Math.ceil(p.getTotalLength()) + 1, tip = o.querySelector(".tip");
    p.style.strokeDasharray = len;
    play(p, [{ strokeDashoffset: len, easing: STATE }, { strokeDashoffset: 0 }], 960, T0).onfinish = () => { p.style.strokeDasharray = ""; }; // thrown out from the inside of the coil
    play(tip, [{ opacity: 0 }, { opacity: 1 }], 70, T0 + 900);
    play(tip, [ // the mouthpiece swings through as the line arrives, whips back and settles
      { transform: "scale(.2) rotate(40deg)", easing: ENTER }, { transform: "scale(1) rotate(-10deg)", offset: .26, easing: STATE }, { transform: "scale(1) rotate(4.5deg)", offset: .55, easing: STATE },
      { transform: "scale(1) rotate(-1.5deg)", offset: .8, easing: STATE }, { transform: "scale(1) rotate(0deg)" }], 620, T0 + 900);
    play(o.querySelector(".whip"), [ // the whole hose flexes as the tip snaps
      { transform: "rotate(0deg)", easing: ENTER }, { transform: "rotate(-2.2deg)", offset: .25, easing: STATE }, { transform: "rotate(1deg)", offset: .6, easing: STATE }, { transform: "rotate(0deg)" }], 560, T0 + 960);
  },
  parts(layer, go) {
    const o = obj(layer, OBJ.parts);
    if (!go) return;
    play(o.querySelector(".turn"), [ // backed off, spun on by hand, a rest, then the wrench gives the last turn and it stops dead
      { transform: "rotate(-200deg)", easing: STATE }, { transform: "rotate(-212deg)", offset: .1687, easing: STATE }, { transform: "rotate(-18deg)", offset: .747 },
      { transform: "rotate(-18deg)", offset: .8313, easing: STRIKE }, { transform: "rotate(0deg)" }], 830, WIND);
    play(o.querySelector("svg"), [{ scale: "1", easing: ENTER }, { scale: ".955", offset: .1333, easing: SEAT }, { scale: "1" }], 300, T0 + 690); // it seats
  },
  misc(layer, go) {
    const o = obj(layer, OBJ.misc);
    if (!go) return;
    stamp(o.querySelector("svg"), T0); // the header's label takes the first hit alone
    play(o.querySelector(".o"), [{ opacity: .42, easing: ENTER }, { opacity: .22 }], 480, T0, "none"); // the ink is wet, then dries
    if (!arrivals) return; // on a first load the prices are already on screen: nothing already seen is hidden
    const GAPS = [260, 120, 100, 85, 75, 70], vh = innerHeight; let k = 0, hit = T0; // then the cards, speeding up; nothing waits past the sixth
    for (const tile of document.querySelectorAll(".grid .card .tile")) {
      const s = tile.querySelector(".sticker"), r = tile.getBoundingClientRect(); if (!s || s.style.viewTransitionName || r.top >= vh || r.bottom <= 0) continue;
      if (k < GAPS.length) hit += GAPS[k++];
      stamp(s, hit); give(tile, hit);
    }
  },
};
const PIECE = {
  // someone spritzes the bottle: two sprays cross behind its shoulder from the left, below the price label
  cologne(layer, go) { if (go) when(layer, T0, () => spritz(layer, -0.08, 0.36, Math.PI * 0.05, 2.4)); },
  // the price gun again: the one label on the page lands with a thump, and the piece hops as anything does
  misc(layer, go, host) {
    const s = host.querySelector(".sticker"); if (!go || !s || s.style.viewTransitionName) return;
    stamp(s, T0, 1.35); give(host, T0, .99);
    const shot = host.querySelector(".shot");
    if (shot) play(shot, [{ translate: "0 0", easing: ENTER }, { translate: "0 -4px", offset: .4375, easing: STRIKE }, { translate: "0 0" }], 160, T0 + 20);
  },
};

// One layer per page. A re-draw of the same page (add to cart, a quantity change) moves the live layer into the
// new markup, so an act in mid-air carries on and nothing replays.
let live = null, playedKey = "", lastPath = location.pathname;
function place() {
  const head = document.querySelector(".shophead[data-cat]"), stage = document.querySelector('[data-cat="cologne"] [data-stage], [data-cat="misc"] [data-stage]');
  const host = head || stage; if (!host || host.querySelector(":scope > .fx")) return;
  const cat = (head || stage.closest("[data-cat]")).dataset.cat, run = head ? FX[cat] : PIECE[cat];
  if (!run) return;
  const key = (head ? "head|" : "piece|") + location.pathname;
  if (live && live.key === key && !live.layer.isConnected) { host.prepend(live.layer); return; }
  const fresh = key !== playedKey; playedKey = key;
  const layer = el("span", "fx"); layer.setAttribute("aria-hidden", "true"); host.prepend(layer);
  live = { key, layer };
  try { run(layer, fresh && !RM.matches, host); } catch (e) { layer.remove(); live = null; } // an effect that fails is simply absent
}
new MutationObserver(place).observe(document.getElementById("main"), { childList: true });
addEventListener("routechange", () => { if (location.pathname !== lastPath) { lastPath = location.pathname; arrivals++; playedKey = ""; live = null; } }); // arriving again plays it again
// the object is measured against the title, so it is measured again when the title can change size
const refit = () => { const o = document.querySelector(".shophead > .fx > .fx-obj"); if (o) fit(o.parentNode, o); };
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(refit, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
// a tap on the band plays its act again
document.addEventListener("click", e => {
  const band = e.target.closest(".shophead[data-cat]"); if (!band || RM.matches || e.target.closest("a,button")) return;
  const old = band.querySelector(":scope > .fx"); if (old) old.remove();
  live = null; playedKey = ""; place();
});
place();
