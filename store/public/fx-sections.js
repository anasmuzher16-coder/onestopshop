// 06 section entrances. One rule for every section of the shop:
//   the header band carries one real object from that section, drawn in colour, on the right; when the page opens,
//   the one thing you do to that object at the counter is done to it, once, and the object reacts to it.
//   hookahs  it is drawn on (coals, bubbles); smoke rolls in       cologne  the pump is pressed twice; the bottle kicks
//   bases    the third ice cube is dropped in; it splashes         bowls    tongs set the third coal on the foil; it flares
//   heat     the coals take; the lid is let down on them           hoses    tossed down coiled; the handle bounces
//   charcoal the sixth cube is set on the stack; it catches from below
//   parts    the kit is set down on the counter, piece by piece      misc     the price gun labels a pair of sunglasses
// Timing: T0 is when the page change has landed; each act says in its own notes when its contact is. A tap on the
// band plays a short version with no page change to wait for (a tap while anything is still moving is left alone,
// so an arrival is never cut short). Curves: ENTER (things arriving), STATE, STRIKE (things driven into contact).
// Everything sits behind the type. With motion turned off the objects are simply there, at rest.
// Rules kept here: a re-draw of the same page changes nothing a shopper can see; nothing already seen is hidden;
// a resting state never depends on a measurement; nothing is sliced by the edge of the band by accident. What
// crosses it does so on purpose: the stems the bowl and the heat keeper stand on run off it, and the tongs, the
// price gun, the ice cube and the tossed hose come in from outside it.
import { OBJ } from "./fx-objects.js";
import { waved, afterSwap } from "./route.js";
const RM = matchMedia("(prefers-reduced-motion: reduce)");
let T0 = 450, WIND = T0 - 140;                                           // contact, and the earliest wind-up
const clock = replay => { T0 = replay ? 140 : waved() ? 520 : 450; WIND = T0 - 140; };   // a tap has no page change to wait for
const ENTER = "cubic-bezier(.16,1,.3,1)", STATE = "cubic-bezier(.4,0,.2,1)", STRIKE = "cubic-bezier(.33,0,.67,.33)";
const play = (node, frames, duration, delay = 0, fill = "backwards") => node.animate(frames, { duration, delay, fill });
const when = (layer, ms, fn) => setTimeout(() => { if (layer.isConnected) fn(); }, ms);
const el = (tag, cls, parent) => { const n = document.createElement(tag); n.className = cls; if (parent) parent.append(n); return n; };
const rnd = (a, b) => a + Math.random() * (b - a);
// the object: a square on the right of the band, drawn in a 100 x 100 box
const obj = (layer, inner, cls = "") => { const w = el("span", "fx-obj " + cls, layer); w.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`; fit(layer, w); return w; };
// The object rests at the weight set in styles.css (.fx .o). For its act it comes up to full strength, and eases
// back over 1.2 s once the act is over. One opacity animation, nothing held afterwards.
const REST = .72, FULL = .92;
const lift = (o, from, to, wet) => {
  const act = Math.max(1, to - from), d = act + 1200;
  return play(o.querySelector(".o"), [{ opacity: wet ? FULL : REST, easing: STATE }, { opacity: FULL, offset: wet ? 0 : Math.min(160, act) / d },
    { opacity: FULL, offset: act / d, easing: STATE }, { opacity: REST }], d, from, "none");
};
// The object never touches the title. Where a long title leaves less room beside it (a phone), the object takes
// the room there is. When that is too small to read, it drops under the end of the title.
function fit(layer, o) {
  o.style.cssText = "";
  const band = layer.parentNode, h1 = band && band.querySelector("h1"); if (!h1) return;
  const L = band.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(h1);
  const T = range.getBoundingClientRect(), box = o.getBoundingClientRect(), size = box.width, gutter = L.right - box.right;
  const beside = L.right - gutter - T.right - 10;
  // a solid object (the charcoal stack, dark from edge to edge) also keeps clear of the line under the title: where that line
  // runs under it, it rises into the room beside the title, above the line, instead of standing behind the words
  const note = o.classList.contains("fx-obj--clear") && band.querySelector(".shophead__n");
  if (note && beside >= 64) { const nr = document.createRange(); nr.selectNodeContents(note); const N = nr.getBoundingClientRect();
    if (N.width && N.right > box.left + box.width * .14 && N.top < box.bottom) { const h = Math.floor(Math.min(beside, N.top - L.top - 8)); if (h >= 64) { o.style.cssText = `height:${h}px;top:4px;translate:none`; return; } } }
  if (beside >= size) return;
  if (beside >= Math.max(72, size * .6)) { o.style.height = Math.floor(beside) + "px"; return; } // still big enough to read beside the title
  // the title's box, not its tall line box; a title with no tails (g, j, p, q, y) leaves a little more room under it
  const foot = Math.min(T.bottom, h1.getBoundingClientRect().bottom) - (/[gjpqy,]/.test(h1.textContent) ? 0 : 10);
  const under = L.bottom - foot - 4, s = Math.max(56, Math.floor(Math.min(size, under)));
  o.style.cssText = `height:${s}px;top:auto;bottom:4px;translate:none`;
}
let uid = 0;

// ---- idle life: one quiet beat every 9 to 14 s while the band is on screen and the tab is showing; eight at most,
// then it rests. One timer per band, no frame loop, transform and opacity only, never under reduced motion.
const SEEN = new WeakMap(), IO = window.IntersectionObserver && new IntersectionObserver(es => es.forEach(e => SEEN.set(e.target, e.isIntersecting)));
function idle(layer, beat) {
  if (!IO || RM.matches) return;
  IO.observe(layer); let n = 0;
  const tick = () => {
    if (!layer.isConnected) { IO.unobserve(layer); return; }
    if (SEEN.get(layer) && !document.hidden && !RM.matches) { beat(); n++; }
    if (n < 8) setTimeout(tick, rnd(9000, 14000)); else IO.unobserve(layer);
  };
  setTimeout(tick, rnd(7000, 9000));
}

// ---- one small 2D canvas over a layer; runs until tick() says its matter is spent, then removes itself
function fxCanvas(layer, tick, top) {
  const cv = el("canvas", top ? "fx-spritz fx-top" : "fx-spritz", layer), w = layer.clientWidth, h = layer.clientHeight;
  const dpr = Math.min(w * h > 250000 ? 1.5 : 2, devicePixelRatio || 1);   // a 1440 band at 2x is 1.4 M pixels to clear per frame; 1.5x is 0.8 M
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext("2d"); if (!g) { cv.remove(); return; }
  g.scale(dpr, dpr); g.lineCap = "round";
  let last = performance.now();
  const frame = now => {
    if (!cv.isConnected) { cv.width = cv.height = 0; return; }   // cut off in mid-air (a tap, a page change): hand the memory back
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000)); last = now;   // clock-timed: a slow phone shows the same motion and ends on time down to 4 fps
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
// Nothing is sliced by the top or bottom edge of the layer: whatever comes within 20 px of an edge thins out to nothing there.
const edge = (y, rad, h) => Math.max(0, Math.min(1, (Math.min(y, h - y) - rad) / 20));

// ---- sparks: the coal cracks three times. Each crack is a flash over the coals and a handful of embers: most are lofted and
// zigzag in the hot air, every fifth is spat out sideways and falls in an arc. They cool from pale yellow through orange to red.
function embers(layer, o, n = 30, top = false, fine = false) {
  const L = layer.getBoundingClientRect(), b = o.getBoundingClientRect(), bx = b.left - L.left, by = b.top - L.top, big = Math.max(1, Math.min(1.8, L.height / 120));
  const tops = [[0.23, 0.44], [0.42, 0.44], [0.61, 0.44], [0.42, 0.40]], ps = [], glow = soft("214,51,38"), flash = soft("255,222,150");   // the tops of the three coals
  const cx = bx + 0.42 * b.width, cy = by + 0.5 * b.height, h = L.height;
  for (let i = 0; i < n; i++) {
    const v = tops[i % 4], x = bx + (v[0] + rnd(-0.07, 0.07)) * b.width, y = by + v[1] * b.height, k = rnd(0.9, 1.6), far = i % 5 === 0;
    const rise = rnd(0.45, 0.95) * Math.max(24, y - 4);                               // never past the top edge of the band
    ps.push({ x, y, vx: (far ? rnd(90, 190) * (Math.random() < 0.6 ? -1 : 1) : rnd(-45, 45)) * big, vy: -rise * k, k, grav: (far ? 150 : 30) * big, r: rnd(1.7, 3.3) * big, life: rnd(1.0, 2.1),
      age: -(Math.floor(i / (n / 3)) * 0.26 + rnd(0, 0.16)), w: rnd(6, 9), ph: rnd(0, 6.28), amp: (far ? 0 : rnd(350, 800)) * big });
  }
  let T = 0;
  fxCanvas(layer, (g, dt) => {
    let alive = 0; T += dt;
    for (let c = 0; c < 3; c++) { const a = (T - c * 0.26 - 0.03) / 0.2; if (a < 0 || a >= 1) continue;   // the crack itself: a quick warm flash over the coals
      const fr = 26 * big * (0.5 + 1.5 * a); g.globalAlpha = 0.6 * (1 - a) * (1 - a); g.drawImage(flash, cx - fr * 1.5, cy - fr * 0.8, fr * 3, fr * 1.6); }
    for (const p of ps) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const d = Math.exp(-p.k * dt); p.vx = p.vx * d + Math.sin(p.ph + p.age * p.w) * p.amp * dt; p.vy = p.vy * d + p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const heat = 1 - p.age / p.life, fl = 0.8 + 0.2 * Math.sin(p.age * 38 + p.ph), sp = Math.hypot(p.vx, p.vy), len = Math.min(sp * 0.06, 22 * big);
      const hr = p.r * (2.4 + 3 * heat), ed = edge(p.y, p.r, h) * (fine ? Math.max(0, Math.min(1, Math.min(p.x, L.width - p.x) / 26)) * Math.min(1, heat * 3.2) : 1); if (ed <= 0) continue;   // one that falls to the floor of the band goes out there
      g.globalAlpha = (fine ? 0.6 * heat : 0.7) * heat * fl * ed; g.drawImage(glow, p.x - hr, p.y - hr, hr * 2, hr * 2);            // red glow
      if (len > 1) { g.globalAlpha = 0.85 * heat * ed; g.strokeStyle = heat > 0.55 ? "rgb(255,186,84)" : "rgb(214,51,38)"; g.lineWidth = 1.5 * p.r; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * len, p.y - p.vy / sp * len); g.stroke(); }
      g.globalAlpha = (fine ? Math.min(1, heat * heat * 2.6) : Math.min(1, heat * 2.2)) * fl * ed; g.fillStyle = heat > 0.6 ? "rgb(255,244,186)" : heat > 0.3 ? "rgb(255,186,84)" : "rgb(214,51,38)";
      g.beginPath(); g.arc(p.x, p.y, p.r * (0.55 + 0.45 * heat), 0, 6.283); g.fill();                     // the hot centre
    }
    return alive > 0 || T < 0.8;
  }, top);
}

// ---- steam: heat coming off a bowl. Six ribbons across the whole rim that rise fast and slow down, widen and waver more the
// higher they are, then let go; and under them a soft body of vapour that swells as it lifts and leans downwind.
function steam(layer, o) {
  const L = layer.getBoundingClientRect(), b = o.getBoundingClientRect(), bx = b.left - L.left, by = b.top - L.top, big = Math.max(1, Math.min(1.8, L.height / 120));
  const y0 = by + 0.19 * b.height, img = soft("255,252,246"), h = L.height;
  const ws = [0.2, 0.44, 0.68, 0.32, 0.8, 0.56].map((fx, i) => {
    const H = Math.max(26, y0 - 4) * rnd(0.82, 1);   // uses all the room there is above the rim
    return { x: bx + (fx + rnd(-0.03, 0.03)) * b.width, y: y0, H, A: rnd(6, 11) * big, f: rnd(0.5, 0.85), ph: rnd(0, 6.28), lean: rnd(-26, 8) * big, life: rnd(2.6, 3.4), age: -i * 0.12 - rnd(0, 0.08) };
  });
  const puffs = []; for (let i = 0; i < 12; i++) puffs.push({ x: bx + rnd(0.22, 0.78) * b.width, y: y0 + 2 * big, vx: rnd(-18, 4) * big, vy: -rnd(30, 52) * big, r: rnd(9, 16) * big, life: rnd(1.6, 2.6), age: -rnd(0, 1.6) });
  fxCanvas(layer, (g, dt) => {
    let alive = 0;
    for (const p of puffs) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      p.vy *= Math.exp(-1.3 * dt); p.x += p.vx * dt; p.y += p.vy * dt;
      const q = p.age / p.life, rad = p.r * (0.5 + 1.4 * q);
      g.globalAlpha = 0.24 * Math.min(1, p.age / 0.2) * Math.pow(1 - q, 1.3) * edge(p.y, rad * 0.5, h);
      g.drawImage(img, p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    for (const s of ws) {
      s.age += dt; if (s.age >= s.life) continue; alive++; if (s.age < 0) continue;
      const q = s.age / s.life, head = 1 - Math.exp(-s.age * 2), tk = Math.max(0, (s.age - 1.1) / (s.life - 1.1)), tail = tk * tk * 0.85 * head;
      const fade = Math.min(1, s.age / 0.18) * Math.pow(1 - q, 1.3);
      const pt = u => [s.x + s.lean * u * u + s.A * (0.1 + 1.2 * u) * Math.sin(6.283 * u * s.f - s.age * 2.6 + s.ph), s.y - u * s.H];
      const a = pt(tail), z = pt(head), grd = g.createLinearGradient(0, a[1], 0, z[1] - 0.01);
      grd.addColorStop(0, "rgba(255,252,246,0)"); grd.addColorStop(0.3, "rgba(255,252,246,1)"); grd.addColorStop(0.65, "rgba(255,252,246,.6)"); grd.addColorStop(1, "rgba(255,252,246,0)");
      g.strokeStyle = grd; g.beginPath(); g.moveTo(a[0], a[1]);
      for (let j = 1; j <= 14; j++) { const p = pt(tail + (head - tail) * j / 14); g.lineTo(p[0], p[1]); }
      g.globalAlpha = 0.26 * fade; g.lineWidth = 14 * big; g.stroke();     // soft body
      g.globalAlpha = 0.7 * fade; g.lineWidth = 3.5 * big; g.stroke();     // bright thread
    }
    return alive > 0;
  });
}

// ---- the label gun: a label comes down speeding up, twisted, hits at full size, presses in, springs, rests.
// shift = where it starts from, toward the middle of its tile, so that big and twisted it is never cut by the tile's edge.
const stamp = (s, hit, from = 1.3, twist = 7, shift = [0, 0]) => {
  play(s, [{ opacity: 0 }, { opacity: 1 }], 42, hit - 140);
  return play(s, [
    { scale: String(from), rotate: twist + "deg", translate: `${shift[0].toFixed(1)}px ${shift[1].toFixed(1)}px`, easing: STRIKE },
    { scale: "1", rotate: "0deg", translate: "0px 0px", offset: .3333, easing: ENTER },   // contact
    { scale: ".92", rotate: "0deg", offset: .4286, easing: STATE },
    { scale: "1.035", rotate: "0deg", offset: .5952, easing: STATE },
    { scale: ".995", rotate: "0deg", offset: .8095, easing: STATE },
    { scale: "1", rotate: "0deg", translate: "0px 0px" }], 420, hit - 140);
};
// a = the label's box at rest, t = its tile's box: how far in the label must start to stay inside the tile at that size and twist
const inward = (a, t, from, twist) => {
  const c = Math.cos(twist * Math.PI / 180), n = Math.abs(Math.sin(twist * Math.PI / 180)), pad = 3;
  const hw = from * (a.width * c + a.height * n) / 2, hh = from * (a.width * n + a.height * c) / 2, cx = a.left + a.width / 2, cy = a.top + a.height / 2;
  return [Math.max(0, t.left + pad - (cx - hw)) - Math.max(0, cx + hw - (t.right - pad)), Math.max(0, t.top + pad - (cy - hh)) - Math.max(0, cy + hh - (t.bottom - pad))];
};
// a label that is already on (it was seen, or it travelled here in the page change) is pressed home, never taken off and put back
const press = (s, hit) => play(s, [
  { scale: "1", easing: ENTER },
  { scale: ".9", offset: .14, easing: STATE },
  { scale: "1.045", offset: .4, easing: STATE },
  { scale: ".995", offset: .7, easing: STATE },
  { scale: "1" }], 360, hit);
const give = (tile, hit, depth = .972) => play(tile, [ // whatever is under the label gives a little
  { scale: "1", easing: ENTER }, { scale: String(depth), offset: .2273, easing: STATE }, { scale: "1.004", offset: .6, easing: STATE }, { scale: "1" }], 220, hit);

let arrivals = 0; // in-site page changes so far; 0 means this page was the first one loaded
// Every act takes (layer, go, host, re): go = play it (false: just be there, at rest), re = this is a tap, not an arrival.
const FX = {
  hookahs(layer, go, host, re) {
    // The whole pipe, drawn in colour. It is drawn on: the coals come up bright and the water bubbles. Then the smoke
    // gets to it, and the hose is pushed downwind and swings out. A tap is a short pull and a flick of the hose.
    const o = obj(layer, OBJ.hookahs.replaceAll("ID", "fxc" + (++uid))), hose = o.querySelector(".hose"), mouth = o.querySelector(".mouth"), all = c => [...o.querySelectorAll(c)];   // the mouthpiece is a weight on the end of the line: it trails it
    const draw = (at, n) => {   // a pull: the coals brighten, bubbles break at the foot of the downstem
      all(".fl").forEach((f, i) => play(f, [{ opacity: 0, easing: STATE }, { opacity: 1, offset: .25, easing: STATE }, { opacity: .7, offset: .7, easing: STATE }, { opacity: 0 }], n * 110 + 500, at + i * 60, "none"));
      all(".emb").forEach(e => play(e, [{ opacity: .9, easing: STATE }, { opacity: .3, offset: .3, easing: STATE }, { opacity: .9 }], n * 110 + 500, at, "none"));
      for (let k = 0; k < n; k++) { const bu = all(".bub")[k % 4], side = k % 2 ? 1 : -1;
        play(bu, [{ opacity: 0, transform: "translate(0px,0px)", easing: "linear" }, { opacity: 1, transform: `translate(${side * 2.2}px,-2.6px)`, offset: .25, easing: "linear" }, { opacity: 0, transform: `translate(${side * 4}px,-8px)` }], 400, at + 80 + k * 110, "none"); }
    };
    idle(layer, () => draw(0, 3));
    if (!go) return;
    // the gust lands when the smoke front gets to the hookah (the front is fx-smoke.js main(), xf; the two must change together)
    const GUST = re ? T0 : Math.round(60 + 900 * (0.6 + 0.1 * layer.clientWidth / Math.max(1, layer.clientHeight))), a = re ? .5 : 1;   // a tap is a flick of the hose, not a new bank
    const deg = v => `rotate(${(v * a).toFixed(2)}deg)`;
    draw(re ? T0 : 140, re ? 6 : 9);   // the pull comes first; the smoke it makes is the bank that rolls in
    play(hose, [ // pushed downwind, swings out
      { transform: deg(0), easing: ENTER },
      { transform: deg(-13), offset: .12, easing: STATE },
      { transform: deg(6), offset: .29, easing: STATE },
      { transform: deg(-3), offset: .46, easing: STATE },
      { transform: deg(1.4), offset: .63, easing: STATE },
      { transform: deg(-.5), offset: .8, easing: STATE },
      { transform: deg(0) }], 1500, GUST);
    play(mouth, [ // trails, then whips
      { transform: deg(0), easing: ENTER },
      { transform: deg(9), offset: .12, easing: STATE },
      { transform: deg(-5), offset: .29, easing: STATE },
      { transform: deg(2.4), offset: .46, easing: STATE },
      { transform: deg(-1), offset: .63, easing: STATE },
      { transform: deg(0) }], 1500, GUST + 60);
  },
  cologne(layer, go, host, re) {
    // A heavy glass flask, the scent in it, a dark pump with a brass nozzle. The pump is pressed twice: each press
    // throws a fan of droplets toward the title that slow in the air, drift and thin out; the bottle kicks, and the
    // scent rocks in it. On a tap it is pressed once.
    const o = obj(layer, OBJ.cologne.replaceAll("ID", "fxc" + (++uid))), q = c => o.querySelector(c), recoil = q(".recoil"), liq = q(".cliq"), drops = [...o.querySelectorAll(".md")];
    idle(layer, () => play(liq, [{ transform: "rotate(0deg)", easing: SINE }, { transform: "rotate(1.6deg)", offset: .3, easing: SINE }, { transform: "rotate(-1deg)", offset: .65, easing: SINE }, { transform: "rotate(0deg)" }], 1400, 0, "none"));
    if (!go) return;
    const spray = (at, set, k) => set.forEach((d, j) => {   // a fan 40 degrees across, aimed a little below level; fine droplets stop soonest
      const i = drops.indexOf(d), n = drops.length, u = (i * 61 % n) / (n - 1), w = ((i * i * 13 + i * 7 + 5) % 41) / 40, far = (12 + 34 * w * w) * k, ang = Math.PI * (1.04 + (u - .5) * .17), x = Math.cos(ang) * far, y = -Math.sin(ang) * far;   // most stop near the nozzle, a few carry: a fan, thick at the root
      play(d, [{ opacity: 0, transform: "translate(0px,0px) scale(.5)", easing: "cubic-bezier(.05,.7,.2,1)" }, { opacity: 1, offset: .08 }, { opacity: .9, transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(1)`, offset: .4, easing: "linear" }, { opacity: 0, transform: `translate(${(x - 4).toFixed(1)}px,${(y + 3).toFixed(1)}px) scale(1.9)` }], 700 + (i % 4) * 70, at + j * 5, "none"); });
    const pump = (at, deep) => {
      play(q(".head"), [{ transform: "translateY(0px)", easing: STRIKE }, { transform: `translateY(${deep}px)`, offset: .25 }, { transform: `translateY(${deep}px)`, offset: .56, easing: ENTER }, { transform: "translateY(0px)" }], 360, at - 90, "none");
      play(recoil, [{ transform: "rotate(0deg)", easing: ENTER }, { transform: `rotate(${(deep * .7).toFixed(2)}deg)`, offset: .22, easing: STATE }, { transform: `rotate(${(-deep * .24).toFixed(2)}deg)`, offset: .64, easing: STATE }, { transform: "rotate(0deg)" }], 360, at, "none");
    };
    // the first press is a short puff; the second is the full throw, and its mist reaches the far side of the band
    if (re) { pump(T0, 4.2); spray(T0, drops, 1.1); }
    else { pump(T0, 3); spray(T0, drops.filter((_, i) => i % 2 === 0), .8); pump(T0 + 380, 4.6); spray(T0 + 380, drops.filter((_, i) => i % 2 === 1), 1.25); }
    when(layer, T0, () => {
      const L = layer.getBoundingClientRect(), b = o.getBoundingClientRect(), band = layer.parentNode, t = band.querySelector("h1"), n = band.querySelector(".shophead__n"), keep = [];
      if (t) { const r = document.createRange(); r.selectNodeContents(t); keep.push(r.getBoundingClientRect()); }
      if (n) keep.push(n.getBoundingClientRect());
      mist(layer, b.left - L.left + .326 * b.width, b.top - L.top + .158 * b.height, re ? [{ at: 0, share: 1, reach: 1, life: 1.6 }] : [{ at: 0, share: .3, reach: .42, life: 2.5 }, { at: .38, share: .7, reach: 1, life: 3.7 }], keep.map(k => ({ l: k.left - L.left, r: k.right - L.left, t: k.top - L.top, b: k.bottom - L.top })));
    });
    play(liq, [0, -5, 3.4, -4.2, 2.6, -1.4, .6, 0].map((v, j, a) => ({ transform: `rotate(${v}deg)`, offset: j / (a.length - 1), easing: SINE })), 1500, T0, "none");
  },
  bases(layer, go, host, re) {
    // A glass bell base, deep water in it, two ice cubes afloat. The third cube is dropped in through the mouth from
    // above the band: it goes under, the water jumps and rocks, drops fly, bubbles come up, and it bobs back up to float
    // between the others. On a tap the base is given a swirl: the water rocks and the ice rides it.
    const o = obj(layer, OBJ.bases.replaceAll("ID", "fxc" + (++uid))), q = c => o.querySelector(c), all = c => [...o.querySelectorAll(c)];
    const ice = [q(".i0"), q(".i1"), q(".i2")], AT = ice.map(n => n.getAttribute("transform").match(/-?[\d.]+/g).map(Number));   // each cube rides where the drawing puts it
    const bob = (i, amp, ms, delay) => play(ice[i], [0, -1, .55, -.3, .14, 0].map((k, j, a) => ({ transform: `translate(${AT[i][0]}px,${(AT[i][1] + amp * k).toFixed(2)}px)`, offset: j / (a.length - 1), easing: SINE })), ms, delay, "none");
    const rock = (at, k, ms) => all(".slosh").forEach(n => play(n, [0, 1, -.7, .45, -.22, .08, 0].map((v, j, a) => ({ transform: `rotate(${(v * 3 * k).toFixed(2)}deg)`, offset: j / (a.length - 1), easing: SINE })), ms, at, "none"));
    const rise = (at, n) => all(".bub").slice(0, n).forEach((bu, i) => { const side = i % 2 ? 1 : -1;
      play(bu, [{ opacity: 0, transform: "translate(0px,0px) scale(.5)", easing: "linear" }, { opacity: 1, transform: `translate(${side * 3}px,-4px) scale(1)`, offset: .22, easing: "linear" }, { opacity: .95, transform: `translate(${-side * 1.6}px,-11px) scale(1.1)`, offset: .66, easing: "linear" }, { opacity: 0, transform: `translate(${side * 3.4}px,-15px) scale(1.4)` }], 540, at + i * 90, "none"); });
    idle(layer, () => { rise(0, 2); [0, 1, 2].forEach(i => bob(i, 1.1, 1400, 200 + i * 150)); });
    if (!go) return;
    if (re) { const S = T0 - 80; rock(S, 1.5, 1300); rise(S + 150, 6); [0, 1, 2].forEach(i => bob(i, 2.8, 1300, S + 60 + i * 80));
      play(q(".rock"), [{ transform: "rotate(0deg)", easing: SINE }, { transform: "rotate(-1.4deg)", offset: .3, easing: SINE }, { transform: "rotate(.7deg)", offset: .65, easing: SINE }, { transform: "rotate(0deg)" }], 560, S, "none"); return; }
    const C = Math.max(T0, 330), F = 330, D = 1400, N = Math.round((F + D) / 20), X = AT[2][0], Y = AT[2][1];   // C: the cube meets the water
    const y = t => t < 0 ? -(Y + 24) * (1 - Math.pow(1 + t / F, 2)) : 15 * Math.exp(-t / 300) * Math.sin(t / 165);   // the fall, then under and up
    play(ice[2], Array.from({ length: N + 1 }, (_, j) => { const t = -F + j / N * (F + D); return { transform: `translate(${X}px,${(j === N ? Y : Y + y(t)).toFixed(2)}px)`, opacity: Math.min(1, j / (N * .1)).toFixed(3) }; }), F + D, C - F);   // it comes into view on the way down
    all(".lvl").forEach(n => play(n, [{ transform: "translateY(1.6px)", easing: ENTER }, { transform: "translateY(-1.4px)", offset: .2, easing: SINE }, { transform: "translateY(.5px)", offset: .5, easing: SINE }, { transform: "translateY(0px)" }], 700, C));
    play(q(".rip"), [{ opacity: 1, transform: "scale(.4)", easing: ENTER }, { opacity: 0, transform: "scale(3.2)" }], 620, C, "none");
    all(".dr").forEach((dr, i) => { const dx = (i - 2) * 3.4, up = -(9 + (i * 5 % 7));
      play(dr, [{ opacity: 1, transform: "translate(0px,0px)", easing: "cubic-bezier(.2,.7,.5,1)" }, { opacity: 1, transform: `translate(${dx}px,${up}px)`, offset: .5, easing: "cubic-bezier(.5,0,.8,.4)" }, { opacity: 0, transform: `translate(${dx * 1.7}px,1px)` }], 460, C + 10 + i * 24, "none"); });
    rock(C + 40, 1, 1300); rise(C + 160, 6);
    play(q(".rock"), [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(1px)", offset: .3, easing: SINE }, { transform: "translateY(0px)" }], 260, C, "none");   // the base takes the weight
    [0, 1].forEach(i => bob(i, 2.4, 1200, C + 90 + i * 110));
  },
  bowls(layer, go, host, re) {
    // The clay bowl on its hookah, foil over it, two lit coals on the foil. Tongs come down from outside the band carrying
    // the third, set it down in the clear, let go and leave the way they came. The foil gives under it and it flares
    // once. On a tap the coal is already there: the tongs take it by its sides, lift it and set it back down.
    const o = obj(layer, OBJ.bowls), q = c => o.querySelector(c), all = c => [...o.querySelectorAll(c)], coal = q(".c1");
    idle(layer, () => all(".emb").forEach((e, i) => play(e, [{ opacity: .9, easing: STATE }, { opacity: .4, offset: .3, easing: STATE }, { opacity: .8, offset: .55, easing: STATE }, { opacity: .5, offset: .78, easing: STATE }, { opacity: .9 }], 1300, i * 170, "none"))); // their light on the foil breathes
    if (!go) return;
    const S = Math.max(0, T0 - 350), IN = 400, C = re ? 760 : 500, OPEN = C + 40, OFF = C + 110, D = OFF + 400;   // IN: the tongs are there. C: the coal is down. OFF: they leave
    // the tongs point straight down. Pads are 55.5 along each arm; SHUT puts their inner faces on the coal's two sides
    const ux = 0, uy = 1, SHUT = 9.9, WIDE = 14.5, L = 55.5 * Math.cos(SHUT * Math.PI / 180), X = 67, Y = 37.4, FAR = 74, HOLD = 4, LIFT = 14;
    const cl = v => Math.max(0, Math.min(1, v)), eo = v => 1 - Math.pow(1 - cl(v), 3), ei = v => cl(v) * cl(v);
    const away = t => t < IN ? FAR * (1 - eo(t / IN)) : t < OFF ? 0 : FAR * Math.pow(cl((t - OFF) / 400), 2.4);   // how far back up their own line the tongs are
    const up = t => re ? (t < 450 ? 0 : t < 620 ? LIFT * eo((t - 450) / 170) : t < C - 100 ? LIFT : LIFT * (1 - ei((t - C + 100) / 100))) : (t < C - 100 ? HOLD : HOLD * (1 - ei((t - C + 100) / 100)));   // how high the coal is held
    const jaw = t => re && t < IN ? WIDE : re && t < 450 ? WIDE - (WIDE - SHUT) * cl((t - IN) / 40) : t < OPEN ? SHUT : SHUT + (WIDE - SHUT) * eo((t - OPEN) / 110);
    const N = Math.ceil(D / 20), track = fn => Array.from({ length: N + 1 }, (_, k) => fn(k / N * D)), seen = k => cl((FAR - k) / (FAR * .55)).toFixed(3);   // they come into view, and go out of it, on the move
    play(q(".tongs"), track(t => { const k = away(t), h = t < OFF ? up(t) : 0; return { transform: `translate(${(X + .6 - ux * (L + k)).toFixed(2)}px,${(Y - 4.2 - h - uy * (L + k)).toFixed(2)}px) rotate(90deg)`, opacity: seen(k) }; }), D, S);
    [".arm.a", ".arm.b"].forEach((c, i) => play(q(c), track(t => ({ transform: `rotate(${((i ? 1 : -1) * jaw(t)).toFixed(2)}deg)` })), D, S));
    play(coal, track(t => { const k = re || t >= C ? 0 : away(t); return { transform: `translate(${(X - ux * k).toFixed(2)}px,${(Y - (t < C ? up(t) : 0) - uy * k).toFixed(2)}px)`, opacity: re ? 1 : seen(k) }; }), D, S);
    // its dent in the foil and its light on the foil come as it comes down, and go as it is lifted
    const near = t => re ? 1 - up(t) / (LIFT * 1.6) : (t > IN - 60 ? cl(1 - up(t) / HOLD) : 0);
    play(q(".d1"), track(t => ({ opacity: near(t).toFixed(3) })), D, S); play(q(".e1"), track(t => ({ opacity: (.9 * near(t)).toFixed(3) })), D, S);
    // down: the foil gives and comes back as the tongs let go, and the coal flares: bright on the moment, then back to its own heat
    play(q(".dip"), [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(1.2px)", offset: .25, easing: SINE }, { transform: "translateY(-.3px)", offset: .65, easing: SINE }, { transform: "translateY(0px)" }], 300, S + OPEN, "none");
    coal.querySelectorAll(".fl").forEach(f => play(f, [{ opacity: 0, easing: ENTER }, { opacity: 1, offset: .28 }, { opacity: 1, offset: .46, easing: STATE }, { opacity: 0 }], 540, S + C - 20, "none"));
  },
  heat(layer, go, host, re) {
    // A steel heat keeper on the foil of a bowl, three coals in it, its lid held up over it by the knob. The coals come
    // up to heat one after another, the lid is let down and shuts on the rim, and the heat shows: the slots and vents
    // burn up to yellow one after another. On a tap the lid is lifted for a look, the coals flare, and it is set back.
    const o = obj(layer, OBJ.heat), q = c => o.querySelector(c), all = c => [...o.querySelectorAll(c)], lid = q(".hlid");
    const up = (y, d) => `translate(${(-d * .5).toFixed(2)}px,${y}px) rotate(${d}deg)`, OPEN = up(-19, -13);
    const glow = (at, hi, ms = 1500) => {   // the heat shows in the slots and vents: each burns up to yellow in turn, holds, and eases back
      all(".hslotg,.hventg").forEach((g, i) => play(g, [{ opacity: .85, easing: STATE }, { opacity: hi, offset: .2, easing: STATE }, { opacity: hi, offset: .6, easing: STATE }, { opacity: .85 }], ms, at + (i % 5) * 70, "none"));
      all(".hsloth").forEach((g, i) => play(g, [{ opacity: .7, transform: "scaleY(1)", easing: STATE }, { opacity: 1, transform: "scaleY(1.45)", offset: .2, easing: STATE }, { opacity: 1, transform: "scaleY(1.45)", offset: .6, easing: STATE }, { opacity: .7, transform: "scaleY(1)" }], ms, at + (i % 5) * 70, "none"));
    };
    idle(layer, () => glow(0, 1, 1300));
    if (!go) return;
    const sit = at => play(q(".keeper"), [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(1.1px)", offset: .3, easing: SINE }, { transform: "translateY(0px)" }], 240, at, "none");
    if (re) {
      const S = T0 - 100;
      play(lid, [{ transform: up(0, 0), easing: "cubic-bezier(.3,0,.2,1)" }, { transform: up(-17, -11), offset: .3, easing: STATE }, { transform: up(-17, -11), offset: .55, easing: STRIKE }, { transform: up(0, 0), offset: .8, easing: STATE }, { transform: up(-1.6, 1.2), offset: .88, easing: STATE }, { transform: up(0, 0) }], 900, S, "none");
      all(".hc .fl").forEach((f, i) => play(f, [{ opacity: 0, easing: ENTER }, { opacity: .95, offset: .3, easing: STATE }, { opacity: 0 }], 440, S + 240 + i * 60, "none"));
      glow(S + 720, 1); sit(S + 720);
      return;
    }
    const S = Math.max(0, T0 - 380), C = S + 900;   // S: the first coal takes. C: the lid is down
    all(".hc").forEach((c, i) => {   // cold and black, then it takes: its faces and its core come up, with a flare
      play(c.querySelector(".cold"), [{ opacity: .92, easing: STATE }, { opacity: 0 }], 360, S + i * 170);
      play(c.querySelector(".core"), [{ opacity: 0, easing: STATE }, { opacity: 1 }], 420, S + 80 + i * 170);
      play(c.querySelector(".fl"), [{ opacity: 0, easing: ENTER }, { opacity: 1, offset: .3, easing: STATE }, { opacity: 0 }], 460, S + 200 + i * 170, "none");
    });
    play(q(".hglow"), [{ opacity: 0, easing: STATE }, { opacity: .6 }], 700, S + 100);
    all(".hslotg,.hventg").forEach(g => play(g, [{ opacity: 0, easing: STATE }, { opacity: .85 }], 600, S + 300));
    all(".hsloth").forEach(g => play(g, [{ opacity: 0, easing: STATE }, { opacity: .7 }], 560, S + 300));
    play(lid, [{ transform: OPEN, easing: STATE }, { transform: OPEN, offset: .52, easing: STRIKE }, { transform: up(0, 0), offset: .8, easing: STATE }, { transform: up(-2, 1.4), offset: .87, easing: STATE }, { transform: up(0, -.5), offset: .94, easing: STATE }, { transform: up(0, 0) }], (C - S) / .8, S);
    sit(C); glow(C, 1, 1700);
  },
  charcoal(layer, go, host, re) {
    // Six coconut charcoal cubes stacked 3-2-1 on the counter (2026-11-24). The sixth is set down on top from above the
    // band; the stack takes its weight; then it catches from below, where it sits on the others: the seams of light creep
    // along its bottom and up its corners one after another, its front warms, a crack opens, its top goes to ash and two
    // sparks lift off. At rest it is lit, so with motion off it is simply there, burning. On a tap it flares again.
    const o = obj(layer, OBJ.charcoal, "fx-obj--clear"), q = c => o.querySelector(c), all = c => [...o.querySelectorAll(c)], lit = q(".lit");
    const breathe = (at, lo = .55, ms = 1400) => all(".run").forEach((r, i) => play(r, [{ opacity: 1, easing: SINE }, { opacity: lo, offset: .45, easing: SINE }, { opacity: 1 }], ms, at + i * 60, "none"));
    const sparks = at => all(".spk").forEach((s, i) => { const dx = [-2.4, 1.2, 3, -1, 2][i] || 0, up = 10 + i * 3;
      play(s, [{ opacity: 0, transform: "translate(0px,0px)", easing: "cubic-bezier(.2,.7,.4,1)" }, { opacity: 1, transform: `translate(${dx * .3}px,${-up * .3}px)`, offset: .18 }, { opacity: 0, transform: `translate(${dx}px,${-up}px)` }], 900, at + i * 140, "none"); });
    idle(layer, () => breathe(0));
    if (!go) return;
    if (re) {   // a tap: the lit cube is nudged, it flares and throws two sparks
      const S = T0 - 100;
      play(lit, [{ transform: "translate(0px,0px)", easing: STATE }, { transform: "translate(0px,-2.2px)", offset: .35, easing: STRIKE }, { transform: "translate(0px,0px)", offset: .7, easing: ENTER }, { transform: "translate(0px,0px)" }], 300, S, "none");
      breathe(S + 200, .35, 900); play(q(".crack"), [{ opacity: 1, easing: ENTER }, { opacity: .4, offset: .3, easing: STATE }, { opacity: 1 }], 600, S + 200, "none"); sparks(S + 260);
      return;
    }
    const F = 300, C = Math.max(T0, F), S = C - F;   // F: the fall. C: it is down on the stack
    play(lit, [{ transform: "translate(0px,-64px)", opacity: 0, easing: "cubic-bezier(.45,0,.85,.55)" }, { opacity: 1, offset: .3 },
      { transform: "translate(0px,0px)", opacity: 1, offset: F / (F + 220), easing: ENTER }, { transform: "translate(0px,-1.4px)", offset: (F + 80) / (F + 220), easing: STATE }, { transform: "translate(0px,0px)", opacity: 1 }], F + 220, S);
    play(q(".stack"), [{ transform: "scale(1,1)", easing: ENTER }, { transform: "scale(1.012,.978)", offset: .3, easing: SINE }, { transform: "scale(1,1)" }], 260, C, "none");   // the stack takes the weight
    // it catches: cold until it is down, then the burn creeps round it, the front warms, the crack opens, the top goes to ash
    all(".run").forEach((r, i) => play(r, [{ opacity: 0, easing: STATE }, { opacity: 1 }], 320, C + 120 + [0, 90, 170, 250, 340][i]));
    play(q(".warm"), [{ opacity: 0, easing: STATE }, { opacity: 1 }], 640, C + 220);
    play(q(".rim"), [{ opacity: 0, easing: STATE }, { opacity: .75 }], 640, C + 300);   // its light reaches the cubes it sits on
    play(q(".crack"), [{ opacity: 0, easing: ENTER }, { opacity: 1 }], 260, C + 560);
    play(q(".cash"), [{ opacity: 0, easing: STATE }, { opacity: .9 }], 720, C + 420);
    sparks(C + 640);
  },
  hoses(layer, go, host, re) {
    // A wrapped hose lying coiled on the counter: steel connector at one end, two loose turns, its wooden handle lying
    // out to the right. It is tossed down from above the band: it lands, the turns flatten and spring back, and the
    // handle bounces twice on the counter and lies still. On a tap the handle is lifted and let drop.
    const o = obj(layer, OBJ.hoses), q = c => o.querySelector(c), tip = q(".tip"), line = q(".hline"), coil = q(".coilg");
    const r = v => `rotate(${v.toFixed(2)}deg)`;
    const bounce = (at, a) => play(tip, [{ transform: r(0), easing: "cubic-bezier(.2,.7,.4,1)" }, { transform: r(-13 * a), offset: .2, easing: "cubic-bezier(.6,0,.9,.5)" }, { transform: r(0), offset: .4, easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: r(-5 * a), offset: .56, easing: "cubic-bezier(.6,0,.9,.5)" }, { transform: r(0), offset: .72, easing: "cubic-bezier(.2,.7,.4,1)" }, { transform: r(-1.6 * a), offset: .84, easing: "cubic-bezier(.6,0,.9,.5)" }, { transform: r(0) }], 1040, at, "none");
    const flat = (at, a) => play(coil, [{ transform: "scale(1,1)", easing: ENTER }, { transform: `scale(${1 + .05 * a},${1 - .13 * a})`, offset: .22, easing: STATE }, { transform: `scale(${1 - .016 * a},${1 + .04 * a})`, offset: .55, easing: STATE }, { transform: `scale(${1 + .006 * a},${1 - .012 * a})`, offset: .8, easing: STATE }, { transform: "scale(1,1)" }], 620, at, "none");
    idle(layer, () => bounce(0, .35));
    if (!go) return;
    if (re) { bounce(T0 - 120, 1.7); flat(T0 + 60, .7); return; }
    const C = Math.max(T0, 330), F = 330, UP = 120;   // C: it lands
    play(line, [{ transform: `translate(14px,${-UP}px) rotate(-7deg)`, opacity: 0, easing: "cubic-bezier(.45,0,.85,.55)" }, { opacity: 1, offset: .35 }, { transform: "translate(0px,0px) rotate(0deg)", opacity: 1 }], F, C - F);
    flat(C, 1); bounce(C + 30, 1);
  },
  parts(layer, go, host, re) {
    // The kit laid out on the counter: a steel downstem, a rubber grommet, a steel adapter, and a bottle brush lying
    // in front. They are set down one at a time, each coming into view on the way down and landing with a small hop.
    // On a tap each one hops in turn.
    const o = obj(layer, OBJ.parts), kit = [0, 1, 2, 3].map(i => o.querySelector(".kit" + i));
    const hop = (n, at, h) => play(n, [{ transform: "translateY(0px)", easing: "cubic-bezier(.2,.7,.4,1)" }, { transform: `translateY(${-h}px)`, offset: .4, easing: "cubic-bezier(.6,0,.9,.5)" },
      { transform: "translateY(0px)", offset: .8, easing: ENTER }, { transform: "translateY(.6px)", offset: .9, easing: STATE }, { transform: "translateY(0px)" }], 360, at, "none");
    idle(layer, () => hop(kit[1], 0, 2.6));   // the grommet, the one that rolls about
    if (!go) return;
    if (re) { kit.forEach((n, i) => hop(n, T0 - 100 + i * 90, 5)); return; }
    const S = Math.max(0, T0 - 250);
    kit.forEach((n, i) => play(n, [{ transform: "translateY(-24px)", opacity: 0, easing: "cubic-bezier(.5,0,.9,.6)" }, { opacity: 1, offset: .3 }, { transform: "translateY(0px)", opacity: 1, offset: .62, easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: `translateY(${-3.4 + i * .3}px)`, offset: .8, easing: "cubic-bezier(.6,0,.9,.5)" }, { transform: "translateY(0px)", opacity: 1 }], 380, S + i * 140));   // lowered into view a short way, on the move, never through the title
  },
  misc(layer, go, host, re) {
    // A pair of sunglasses off the rack, and the price gun. The gun comes down from outside the band, clicks a label
    // on to a lens and goes back the way it came; the glasses take the knock. Then the cards on the page get theirs.
    const o = obj(layer, OBJ.misc), q = c => o.querySelector(c);
    if (!go) return;
    const S = Math.max(0, T0 - 330), HIT = S + 330, UP = 96, D = 900;   // HIT: the label is on
    const cl = v => Math.max(0, Math.min(1, v)), N = D / 20;
    const gy = t => t < 330 ? -UP * (1 - Math.pow(cl(t / 330), 2.2)) : t < 420 ? 2.2 * Math.sin((t - 330) / 90 * Math.PI) : -UP * Math.pow(cl((t - 420) / 480), 1.7);   // down speeding up, pressed in, away
    play(q(".gun"), Array.from({ length: N + 1 }, (_, j) => { const t = j / N * D, y = gy(t); return { transform: `translate(0px,${y.toFixed(2)}px)`, opacity: cl((UP + y) / (UP * .5)).toFixed(3) }; }), D, S);
    if (re) play(q(".mtag"), [{ transform: "scale(1)", easing: STATE }, { transform: "scale(.88)", offset: .3, easing: STATE }, { transform: "scale(1.06)", offset: .6, easing: STATE }, { transform: "scale(1)" }], 280, HIT, "none");   // a tap: pressed down again
    else {   // the label is pressed out where the nose comes down: it grows from that point under the nose, and seats
      play(q(".mtag"), [{ opacity: 0, transform: "scale(.3)", easing: "cubic-bezier(.2,.7,.4,1)" }, { opacity: 1, transform: "scale(1.06)", offset: .55, easing: STATE }, { opacity: 1, transform: "scale(1)" }], 220, HIT - 10);
    }
    play(q(".mset"), [{ transform: "translateY(0px) rotate(0deg)", easing: ENTER }, { transform: "translateY(2.2px) rotate(1.6deg)", offset: .2, easing: SINE }, { transform: "translateY(-.6px) rotate(-.9deg)", offset: .5, easing: SINE }, { transform: "translateY(0px) rotate(.4deg)", offset: .75, easing: SINE }, { transform: "translateY(0px) rotate(0deg)" }], 520, HIT, "none");
    if (re) return;   // a tap clicks the header's label again; no price on the page is touched
    if (!arrivals) return; // on a first load the prices are already on screen: nothing already seen is hidden
    const vh = innerHeight, todo = [];   // measure every card first, then start the moves
    for (const tile of document.querySelectorAll(".grid .card .tile")) {
      const s = tile.querySelector(".sticker"); if (!s || s.style.viewTransitionName) continue;
      const cb = tile.closest(".card")?.getBoundingClientRect(); if (cb && (cb.top >= vh || cb.bottom <= 0)) continue;   // the card first: a card off screen skips drawing, and measuring the tile inside it would lay it out
      const r = tile.getBoundingClientRect(); if (r.top >= vh || r.bottom <= 0) continue;
      todo.push([tile, s, inward(s.getBoundingClientRect(), r, 1.3, 7)]);
    }
    const GAPS = [260, 120, 100, 85, 75, 70]; let k = 0, hit = HIT; // then the cards, speeding up; nothing waits past the sixth
    for (const [tile, s, shift] of todo) {
      if (k < GAPS.length) hit += GAPS[k++];
      stamp(s, hit, 1.3, 7, shift); give(tile, hit);
    }
  },
};
FX.shisha = FX.bowls;   // shisha (2026-11-24): the clay bowl it is packed into is its object, band and product page alike
// ---- the pages that are not a shop section: same rule, one object, one act (tools/council-fx-pages.js)
const SINE = "cubic-bezier(.37,0,.63,1)";
// the object on a page band, from its layer or by name
const find = (layer, name) => { const l = layer || document.querySelector(`.shophead[data-fx="${name}"] > .fx`); return l ? l.querySelector(".fx-obj") : null; };
// a piece dropped into something: appears above it, falls speeding up, lands at `at`, one small knock
const drop = (node, at, from = -26) => {
  play(node, [{ opacity: 0 }, { opacity: 1 }], 60, at - 150);
  return play(node, [{ transform: `translateY(${from}px)`, easing: STRIKE }, { transform: "translateY(0px)", offset: .6, easing: ENTER },
    { transform: "translateY(-1.6px)", offset: .8, easing: STRIKE }, { transform: "translateY(0px)" }], 250, at - 150);
};
// whatever it landed in gives: wider and shorter for a moment, then back
const thump = (node, at, sx = 1.03, sy = .96) => play(node, [{ transform: "scale(1,1)", easing: ENTER }, { transform: `scale(${sx},${sy})`, offset: .25, easing: STATE },
  { transform: "scale(.996,1.01)", offset: .6, easing: STATE }, { transform: "scale(1,1)" }], 260, at, "none");
// a label slapped on (the price gun's stamp, written with transform so it is safe on a part inside the drawing)
const slap = (node, hit, from = 1.6) => {
  play(node, [{ opacity: 0 }, { opacity: 1 }], 42, hit - 140);
  return play(node, [{ transform: `scale(${from}) rotate(8deg)`, easing: STRIKE }, { transform: "scale(1) rotate(0deg)", offset: .3333, easing: ENTER },
    { transform: "scale(.92) rotate(0deg)", offset: .4286, easing: STATE }, { transform: "scale(1.035) rotate(0deg)", offset: .5952, easing: STATE },
    { transform: "scale(.995) rotate(0deg)", offset: .8095, easing: STATE }, { transform: "scale(1) rotate(0deg)" }], 420, hit - 140);
};

// ---- search: one strike of the bell. The button is lifted a hair, driven down, and the dome shivers until it is quiet.
const ding = (o, at, power = 1) => {
  const pl = o.querySelector(".plunger"), bell = o.querySelector(".bell"), fr = [{ transform: "translateX(0px)" }];
  play(pl, [{ transform: "translateY(0px)", easing: STATE }, { transform: `translateY(${-2.5 * power}px)`, offset: .3, easing: STRIKE },
    { transform: `translateY(${6 * power}px)`, offset: .52, easing: ENTER }, { transform: "translateY(-1px)", offset: .8, easing: STATE }, { transform: "translateY(0px)" }], 270, at - 140, "none");
  for (let i = 1; i < 10; i++) fr.push({ transform: `translateX(${(i % 2 ? 1 : -1) * 1.5 * power * Math.pow(.72, i - 1)}px)` });
  fr.push({ transform: "translateX(0px)" });
  play(bell, fr, 430, at, "none");
};
// ---- checkout: the receipt comes out a printed line at a time; the printer shakes with each line
const feed = (o, at) => {
  const paper = o.querySelector(".feed"), Y = [56, 40, 32.5, 25, 13.5, 0], per = 130, mv = 70, dur = (Y.length - 1) * per - (per - mv), fr = [], jit = [];
  for (let i = 0; i < Y.length - 1; i++) {
    const a = i * per / dur, b = (i * per + mv) / dur;
    fr.push({ transform: `translateY(${Y[i]}px)`, offset: a, easing: STATE }, { transform: `translateY(${Y[i + 1]}px)`, offset: b });
    jit.push({ transform: "translateX(0px)", offset: a }, { transform: `translateX(${i % 2 ? -.6 : .7}px)`, offset: (a + b) / 2 }, { transform: "translateX(0px)", offset: b });
  }
  play(paper, fr, dur, at - mv);           // the first line is out at `at`
  play(o.querySelector(".till"), jit, dur, at - mv, "none");
  play(o.querySelector(".slot"), [{ transform: "rotate(0deg)", easing: ENTER }, { transform: "rotate(1.6deg)", offset: .3, easing: STATE }, { transform: "rotate(-.7deg)", offset: .65, easing: STATE },
    { transform: "rotate(0deg)" }], 420, at - mv + dur, "none");   // the loose end sways once it stops
};
// what the page says, read from the page itself, so app.js has nothing to pass in
const haveOf = host => [...((host && host.dataset.have) || "1111").padEnd(4, "0").slice(0, 4)].map(c => c === "1"); // the set page always has four picks
const lineCount = () => document.querySelectorAll(".lines .line").length;
const qtySum = () => [...document.querySelectorAll(".lines .qty .num")].reduce((a, n) => a + (+n.textContent || 0), 0);
const destText = () => { const b = document.querySelector(".reading [data-open-postal]"); return b ? b.textContent : ""; };

Object.assign(FX, {
  set(layer, go, host) {
    const o = obj(layer, OBJ.set), q = c => o.querySelector(c), its = [...o.querySelectorAll(".it")], have = haveOf(host);
    its.forEach((n, i) => n.classList.toggle("in", have[i]));
    if (host && host.dataset.sealed != null) o.classList.add("shut");
    if (!go || o.classList.contains("shut")) return;
    // it arrives shut and taped. The tape is slit (wind-up), the flaps are thrown back at T0, the box hops,
    // then what is already picked on the page goes in, left to right.
    play(q(".tape"), [{ opacity: 1, transform: "scaleY(1)", transformOrigin: "50px 60px", easing: STRIKE }, { opacity: 1, transform: "scaleY(0)", transformOrigin: "50px 60px" }], 150, WIND - 70);
    const open = (n, from, at) => play(n, [{ transform: `rotate(${from}deg)`, easing: ENTER }, { transform: `rotate(${-from * .07}deg)`, offset: .5, easing: STATE },
      { transform: `rotate(${from * .03}deg)`, offset: .78, easing: STATE }, { transform: "rotate(0deg)" }], 520, at);
    open(q(".flapl"), 118, T0); open(q(".flapr"), -118, T0 + 70);
    play(q(".crate"), [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(-2.5px)", offset: .35, easing: STRIKE }, { transform: "translateY(0px)" }], 200, T0, "none");
    let at = T0 + 330;
    its.forEach((n, i) => { if (!have[i]) return; drop(n, at); thump(q(".crate"), at); at += 120; });
  },
  search(layer, go) {
    const o = obj(layer, OBJ.search);
    if (go) ding(o, T0);
  },
  cart(layer, go, host) {
    const o = obj(layer, OBJ.cart), pk = [...o.querySelectorAll(".pk")], bag = o.querySelector(".bag");
    const n = Math.min(3, lineCount()); let q = qtySum();
    pk.forEach((p, i) => p.classList.toggle("in", i < n));
    layer.fxAgain = () => { const now = qtySum(); if (now !== q) { q = now; cartBump(layer, lineCount()); } }; // the cart was re-drawn: did a quantity change?
    if (!go) return;
    play(bag, [{ opacity: 0 }, { opacity: 1 }], 70, T0 - 180); // it is not on the counter until it is put there
    play(bag, [ // set down: comes in tilted, lands, squashes, stands up straight
      { transform: "translateY(-20px) rotate(-3deg) scale(1,1)", easing: STRIKE }, { transform: "translateY(0px) rotate(1.2deg) scale(1.035,.95)", offset: .42, easing: ENTER },
      { transform: "translateY(0px) rotate(-.5deg) scale(.99,1.015)", offset: .7, easing: STATE }, { transform: "translateY(0px) rotate(0deg) scale(1,1)" }], 430, T0 - 180);
    play(o.querySelector(".handle"), [ // the handle keeps going after the bag has stopped, folds, and stands again
      { transform: "scale(1,1.06)", easing: STRIKE }, { transform: "scale(1,1.02)", offset: .35, easing: ENTER }, { transform: "scale(1.05,.76)", offset: .55, easing: STATE },
      { transform: "scale(.985,1.05)", offset: .8, easing: STATE }, { transform: "scale(1,1)" }], 520, T0 - 180);
    pk.slice(0, n).forEach((p, i) => { const at = T0 + 280 + i * 130; drop(p, at, -24); thump(bag, at, 1.025, .97); });
  },
  checkout(layer, go) {
    // the paper is cut off at the mouth of the printer, so it can only come up out of it
    const id = "fxp" + (++uid), o = obj(layer, `<defs><clipPath id="${id}"><rect x="-10" y="-40" width="120" height="105.2"/></clipPath></defs>${OBJ.checkout}`);
    o.querySelector(".slot").setAttribute("clip-path", `url(#${id})`);
    if (go) feed(o, T0);
  },
  shipping(layer, go) {
    const o = obj(layer, OBJ.shipping), q = c => o.querySelector(c); let dest = destText();
    layer.fxAgain = () => { const now = destText(); if (now !== dest) { dest = now; shippingLabel(layer); } }; // a new postal code: a new label
    if (!go) return;
    play(q(".tape"), [{ transform: "scaleY(0)", easing: STATE }, { transform: "scaleY(1)" }], 250, 60); // pulled over the top and down the front, done by the wind-up
    slap(q(".label"), T0);                                                                               // then the label, hard
    thump(q(".parcel"), T0, 1.012, .972);
  },
  gifts(layer, go) {
    const o = obj(layer, OBJ.gifts), q = c => o.querySelector(c);
    if (!go) return;
    // packed at the counter: the lid is held open over the box, comes down and seats at T0 (the box takes the knock),
    // then the bow is pulled tight and its loops spring out
    const C = Math.max(T0, 270);   // contact; on a tap T0 is too soon for the lid's fall, so it waits for it
    lift(o, C - 140, C + 900);
    play(q(".top"), [
      { transform: "translateY(0px) rotate(0deg)", easing: ENTER },                     // from rest: lifted off first, never found open
      { transform: "translateY(-8px) rotate(-6deg)", offset: .3, easing: STATE },
      { transform: "translateY(-9.5px) rotate(-7deg)", offset: .44, easing: STRIKE },  // a breath up before it comes down
      { transform: "translateY(0px) rotate(0deg)", offset: .64, easing: ENTER },        // C: seats
      { transform: "translateY(-2.2px) rotate(.8deg)", offset: .78, easing: STRIKE },
      { transform: "translateY(0px) rotate(0deg)", offset: .9 },
      { transform: "translateY(0px) rotate(0deg)" }], 420, C - 269, "none");
    play(q(".body"), [{ transform: "scale(1,1)", easing: ENTER }, { transform: "scale(1.05,.92)", offset: .28, easing: STATE }, { transform: "scale(.985,1.025)", offset: .62, easing: STATE }, { transform: "scale(1,1)" }], 320, C, "none");
    const TIE = C + 170, loop = s => [
      { transform: "rotate(0deg) scale(1,1)", easing: STATE },
      { transform: `rotate(${-8 * s}deg) scale(.8,.84)`, offset: .24, easing: STRIKE },  // drawn in
      { transform: `rotate(${5 * s}deg) scale(1.1,.93)`, offset: .46, easing: ENTER },   // pulled tight: the loops spring out
      { transform: `rotate(${-2.5 * s}deg) scale(.97,1.03)`, offset: .66, easing: STATE },
      { transform: `rotate(${1 * s}deg) scale(1.01,.99)`, offset: .84, easing: STATE },
      { transform: "rotate(0deg) scale(1,1)" }];
    play(q(".loopl"), loop(1), 700, TIE - 150, "none"); play(q(".loopr"), loop(-1), 700, TIE - 150, "none");
    play(q(".knot"), [{ transform: "scale(1,1)", easing: STATE }, { transform: "scale(1.16,1.12)", offset: .24, easing: STRIKE }, { transform: "scale(.84,.88)", offset: .46, easing: ENTER }, { transform: "scale(1.05,1.04)", offset: .7, easing: STATE }, { transform: "scale(1,1)" }], 700, TIE - 150, "none");
  },
  terms(layer, go) {
    const o = obj(layer, OBJ.terms, "signed");
    if (!go) return; // at rest the signature is simply drawn: no dash is left on it
    const sign = o.querySelector(".sign"), D = 640, lead = T0 - WIND, total = lead + D + 260;
    // the nib along the signature, in equal steps of its length, measured from where the pen ends up
    const P = [[-34, 6.5], [-32.1, 1.5], [-28.7, -2.6], [-25.9, .7], [-25.9, 6.1], [-21.8, 6.4], [-19, 1.5], [-16.1, -2.4], [-14.2, 1.9], [-13.7, 6.7], [-9.3, 4.3], [-4.8, 1.5], [0, 0]];
    const fr = [{ transform: "translate(-37px,-5px) rotate(-8deg)", easing: STRIKE }];
    P.forEach((p, i) => fr.push({ transform: `translate(${p[0]}px,${p[1]}px) rotate(0deg)`, offset: (lead + D * i / (P.length - 1)) / total, easing: i === P.length - 1 ? ENTER : "linear" }));
    fr.push({ transform: "translate(2.5px,-4px) rotate(-5deg)", offset: (lead + D + 110) / total, easing: STATE }, { transform: "translate(0px,0px) rotate(0deg)" });
    play(o.querySelector(".pen"), fr, total, WIND); // comes down, touches at T0, writes, lifts off with a flick, is put down
    sign.style.strokeDasharray = "1 1";
    play(sign, [{ opacity: 0 }, { opacity: 1 }], 1, T0);
    play(sign, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], D, T0).onfinish = () => { sign.style.strokeDasharray = ""; };
  },
  privacy(layer, go) {
    const o = obj(layer, OBJ.terms, "struck");
    if (!go) return;
    const D = 380, lead = T0 - WIND, total = lead + D + 260;
    play(o.querySelector(".redact"), [{ transform: "scaleX(0)", easing: SINE }, { transform: "scaleX(1)" }], D, T0); // one pass of the marker
    play(o.querySelector(".pen"), [{ transform: "translate(-38px,-45px) rotate(-8deg)", easing: STRIKE }, { transform: "translate(-35.5px,-35px) rotate(0deg)", offset: lead / total, easing: SINE },
      { transform: "translate(3.5px,-35px) rotate(0deg)", offset: (lead + D) / total, easing: ENTER }, { transform: "translate(6px,-39px) rotate(-5deg)", offset: (lead + D + 110) / total, easing: STATE },
      { transform: "translate(3.5px,-35px) rotate(0deg)" }], total, WIND);
  },
  docs(layer, go, host) { return (/privacy/.test(location.pathname) ? FX.privacy : FX.terms)(layer, go, host); },
  missing(layer, go) {
    const o = obj(layer, OBJ.missing);
    if (!go) return;
    // the piece is lifted off the hook and drags the tag with it; let go at T0, the tag swings out less each time
    const A = [0, 22, -15, 9.5, -6, 3.4, -1.8, .8, 0], lead = T0 - WIND, half = 290, total = lead + half * (A.length - 2);
    const fr = k => A.map((a, i) => ({ transform: `rotate(${a * k}deg)`, offset: i < 2 ? i * lead / total : (lead + half * (i - 1)) / total, easing: i ? SINE : STRIKE }));
    play(o.querySelector(".swing"), fr(1), total, WIND);
    play(o.querySelector(".tag"), fr(-.26), total, WIND + 40);  // the tag trails its string
    play(o.querySelector(".prong"), [{ transform: "rotate(0deg)", easing: STRIKE }, { transform: "rotate(-1.8deg)", offset: .3, easing: ENTER }, { transform: "rotate(.7deg)", offset: .6, easing: STATE },
      { transform: "rotate(0deg)" }], 460, WIND, "none"); // the hook bends under the pull and springs back
  },
  all(layer, go) {
    const o = obj(layer, OBJ.all), plank = o.querySelector(".plank");
    if (!go) return;
    let hit = T0; // put up one after the other, each a little sooner; the shelf dips under each
    [0, 240, 150].forEach((gap, i) => {
      hit += gap; const p = o.querySelector(".p" + i);
      play(p, [{ opacity: 0 }, { opacity: 1 }], 60, hit - 140);
      play(p, [{ transform: "translateY(-22px) rotate(-3deg)", easing: STRIKE }, { transform: "translateY(0px) rotate(2deg)", offset: .4, easing: ENTER },
        { transform: "translateY(-3px) rotate(-1.2deg)", offset: .6, easing: STRIKE }, { transform: "translateY(0px) rotate(.6deg)", offset: .8, easing: STATE }, { transform: "translateY(0px) rotate(0deg)" }], 350, hit - 140);
      play(plank, [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(1.4px)", offset: .3, easing: STATE }, { transform: "translateY(-.4px)", offset: .65, easing: STATE },
        { transform: "translateY(0px)" }], 220, hit, "none");
    });
  },
});

// ================= live state: app.js calls these when the page changes without a route change =================
// Each takes the band's layer, or null to find it. Each is a no-op when the band is not on the page, and with motion
// turned off it only sets the resting state.

// set: have = [hookah, bowl, heat keeper, hose] as booleans; changed = index of the slot just tapped (-1 if none).
// A new pick drops in; a swapped pick is lifted out and the new one dropped in its place; an unpicked one is lifted out.
export function setProgress(layer, have, changed = -1) {
  const o = find(layer, "set"); if (!o) return;
  const its = [...o.querySelectorAll(".it")], was = its.map(n => n.classList.contains("in")), crate = o.querySelector(".crate"), shut = o.classList.contains("shut");
  its.forEach((n, i) => n.classList.toggle("in", !!have[i]));
  o.classList.remove("shut");
  if (RM.matches) return;
  let at = 150;
  if (shut) { // changed after it was taped: it is opened again first
    play(o.querySelector(".flapl"), [{ transform: "rotate(118deg)", easing: ENTER }, { transform: "rotate(0deg)" }], 300);
    play(o.querySelector(".flapr"), [{ transform: "rotate(-118deg)", easing: ENTER }, { transform: "rotate(0deg)" }], 300, 50);
    its.forEach((n, i) => { if (have[i] && i !== changed) { drop(n, at + 100); } }); at += 220;
  }
  its.forEach((n, i) => {
    if (have[i] && was[i] && i === changed && !shut) { // swapped: up and out, then the new one in; lands at 336 ms
      play(n, [{ opacity: 1, transform: "translateY(0px)", easing: ENTER }, { opacity: 0, transform: "translateY(-30px)", offset: .3 }, { opacity: 0, transform: "translateY(-26px)", offset: .38 },
        { opacity: 1, transform: "translateY(-26px)", offset: .44, easing: STRIKE }, { opacity: 1, transform: "translateY(0px)", offset: .8, easing: ENTER },
        { opacity: 1, transform: "translateY(-1.6px)", offset: .9, easing: STRIKE }, { opacity: 1, transform: "translateY(0px)" }], 420, 0, "none");
      thump(crate, 336);
    } else if (have[i] && (!was[i] || (shut && i === changed))) { drop(n, at); thump(crate, at); at += 120; }
    else if (!have[i] && was[i]) play(n, [{ opacity: 1, transform: "translateY(0px)", easing: ENTER }, { opacity: 0, transform: "translateY(-28px)" }], 180);
  });
}
// set: "Add the set" was pressed. The pieces are pressed down, the flaps folded over, the tape run across. Returns the
// milliseconds until it is sealed (0 with motion off), so the caller may hold the page change that long if it wants to.
export function setSeal(layer) {
  const o = find(layer, "set"); if (!o || o.classList.contains("shut")) return 0;
  const crate = o.querySelector(".crate");
  o.classList.add("shut");
  if (RM.matches) return 0;
  o.querySelectorAll(".it.in").forEach(n => play(n, [{ opacity: 1, transform: "translateY(0px)", easing: STRIKE }, { opacity: 1, transform: "translateY(12px)", offset: .8 }, { opacity: 0, transform: "translateY(14px)" }], 150));
  play(o.querySelector(".flapl"), [{ transform: "rotate(0deg)", easing: STRIKE }, { transform: "rotate(118deg)" }], 150, 90);
  play(o.querySelector(".flapr"), [{ transform: "rotate(0deg)", easing: STRIKE }, { transform: "rotate(-118deg)" }], 150, 150);
  thump(crate, 300, 1.02, .975);
  play(o.querySelector(".tape"), [{ opacity: 1, transform: "scaleY(0)", easing: STATE }, { opacity: 1, transform: "scaleY(1)" }], 140, 320);
  return 460;
}

// search: call after the results are re-drawn, with the number of hits and the text typed.
// A light ding per keystroke (never more than one every 160 ms); the first time nothing matches it is rung twice, hard,
// and the bell rocks on its base. Cards that were not in the last set of results are dealt onto the counter.
let lastDing = 0, wasZero = false, shown = new Set();
export function searchTyped(layer, hits, q = "") {
  searchDeal();
  const o = find(layer, "search"); if (!o || RM.matches) return;
  const zero = !!q.trim() && hits === 0, now = performance.now();
  if (zero && !wasZero) {
    ding(o, 140, 1); ding(o, 340, .85);
    play(o.querySelector("svg"), [{ rotate: "0deg", transformOrigin: "50% 94%", easing: ENTER }, { rotate: "-4deg", transformOrigin: "50% 94%", offset: .2, easing: SINE },
      { rotate: "3deg", transformOrigin: "50% 94%", offset: .5, easing: SINE }, { rotate: "-1.2deg", transformOrigin: "50% 94%", offset: .78, easing: SINE }, { rotate: "0deg", transformOrigin: "50% 94%" }], 620, 140, "none");
    lastDing = now + 400;
  } else if (!zero && now - lastDing > 160) { ding(o, 140, .45); lastDing = now; }
  wasZero = zero;
}
export function searchDeal(out) {
  out = out || document.querySelector("[data-search-out]"); if (!out) return;
  const now = new Set(), fresh = [];
  for (const c of out.querySelectorAll(".card")) { const a = c.querySelector("[data-piece]"), sku = a ? a.dataset.piece : ""; now.add(sku); if (!shown.has(sku)) fresh.push(c); }
  shown = now;
  if (RM.matches) return;
  const vh = innerHeight; let k = 0;
  for (const c of fresh) { // only what is on screen, the first eight one after the other, the rest with the eighth
    const r = c.getBoundingClientRect(); if (r.top >= vh || r.bottom <= 0) continue;
    play(c, [{ opacity: 0, translate: "18px -8px", rotate: "2.4deg", easing: ENTER }, { opacity: 1, translate: "0 0", rotate: "0deg" }], 320, Math.min(k++, 7) * 34);
  }
}
addEventListener("routechange", () => { shown = new Set(); wasZero = false; });

// cart: call after the cart is re-drawn following a quantity change, with the number of lines now in it.
// The bag hops and its handle swings; a line that is new drops in, a line that is gone is lifted out.
export function cartBump(layer, lines) {
  const o = find(layer, "cart"); if (!o) return;
  const pk = [...o.querySelectorAll(".pk")], bag = o.querySelector(".bag"), still = RM.matches;
  if (lines != null) pk.forEach((p, i) => {
    const was = p.classList.contains("in"), is = i < Math.min(3, lines); p.classList.toggle("in", is);
    if (still || was === is) return;
    if (is) drop(p, 330, -24); else play(p, [{ opacity: 1, transform: "translateY(0px)", easing: ENTER }, { opacity: 0, transform: "translateY(-24px)" }], 180);
  });
  if (still) return;
  play(bag, [{ transform: "translateY(0px) rotate(0deg) scale(1,1)", easing: ENTER }, { transform: "translateY(-4px) rotate(1.5deg) scale(1,1)", offset: .35, easing: STRIKE },
    { transform: "translateY(0px) rotate(-.6deg) scale(1.02,.97)", offset: .62, easing: STATE }, { transform: "translateY(0px) rotate(0deg) scale(1,1)" }], 320, 0, "none");
  play(o.querySelector(".handle"), [{ transform: "rotate(0deg)", easing: ENTER }, { transform: "rotate(-6deg)", offset: .3, easing: SINE }, { transform: "rotate(3.5deg)", offset: .62, easing: SINE },
    { transform: "rotate(-1.2deg)", offset: .84, easing: SINE }, { transform: "rotate(0deg)" }], 520, 60, "none");
}

// checkout: "Place order" was pressed: the receipt is torn off and taken. If the order fails, call checkoutFeed and a
// new one is printed.
export function checkoutTear(layer) {
  const o = find(layer, "checkout"); if (!o || RM.matches) return;
  o.querySelector(".feed").animate([{ transform: "translate(0px,0px) rotate(0deg)", opacity: 1, easing: STATE }, { transform: "translate(0px,-3px) rotate(-3deg)", opacity: 1, offset: .3, easing: ENTER },
    { transform: "translate(8px,-18px) rotate(11deg)", opacity: 0 }], { duration: 380, fill: "forwards" });
}
export function checkoutFeed(layer) {
  const o = find(layer, "checkout"); if (!o) return;
  o.querySelector(".feed").getAnimations().forEach(a => a.cancel());
  if (!RM.matches) feed(o, 140);
}

// shipping: a postal code was entered or changed: a fresh label is slapped on.
export function shippingLabel(layer) {
  const o = find(layer, "shipping"); if (!o || RM.matches) return;
  slap(o.querySelector(".label"), 140); thump(o.querySelector(".parcel"), 140, 1.012, .972);
}

// ================= wiring: the page moments, heard from the page (app.js needs no change for these) =================
// These listeners are added after app.js has added its own (effects load after the page is up), so by the time they
// run app.js has already re-drawn whatever the tap or keystroke changed.
const SLOT = ["hookah", "bowl", "heat", "hose"];
document.addEventListener("click", e => {
  const pk = e.target.closest("[data-set]"), o = pk && find(null, "set"), i = pk ? SLOT.indexOf(pk.dataset.set) : -1;
  if (o && i >= 0) { const have = [...o.querySelectorAll(".it")].map(n => n.classList.contains("in")); have[i] = true; setProgress(null, have, i); }
  if (e.target.closest("[data-add-set]")) setSeal(null); // seen only if the page change waits for it: see pages.md
});
document.addEventListener("input", e => {
  const out = e.target.id === "q" && document.querySelector("[data-search-out]");
  if (out) searchTyped(null, out.querySelectorAll(".card").length, e.target.value);
});
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-checkout]"), btn = f && f.querySelector('button[type="submit"]');
  if (!btn || !btn.disabled) return;     // app.js disables the button only once the order is really on its way
  checkoutTear(null);
  new MutationObserver((m, ob) => { if (!btn.isConnected) return ob.disconnect(); if (!btn.disabled) { ob.disconnect(); checkoutFeed(null); } }).observe(btn, { attributes: true, attributeFilter: ["disabled"] });
});

// ================= home: a section below the hero that plays an object's act the first time it is seen =================
// UNVERIFIED sketch (never run in a browser). host is a tile with data-tone, position:relative and isolation:isolate,
// e.g. the empty right column of "How we ship glass" with name "shipping", or a tile in "Visit the counter" with "search".
export function onSight(host, name) {
  if (!host || !FX[name] || host.querySelector(":scope > .fx")) return;
  const run = go => { const layer = el("span", "fx"); layer.setAttribute("aria-hidden", "true"); host.prepend(layer); try { FX[name](layer, go, host); } catch (e) { console.error("fx " + name + ": " + (e && e.stack || e)); layer.remove(); } };
  if (RM.matches || !window.IntersectionObserver) return run(false);
  const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); if (host.isConnected) run(true); } }, { threshold: .4 });
  io.observe(host);
}
// ================= product pages: the piece itself does its section's act, once, where the photo is =================
// A cut-out's alpha is sampled once at 48 x 60 to find the box the piece fills. A full photo (no cut-out) has nothing to
// read, so it only ever gets the label. Hookahs: the smoke is the act (fx-smoke.js).
// Depth: the photo is raised one step, so anything in the layer sits BEHIND the piece unless it is marked fx-top
// (sparks and heat rise from behind it; light, mist and dust pass in front).
// RULE: no act is aimed at a feature of the piece (a cap, a rim, a nozzle, a thread). An act may use only the box the
// piece fills, the piece's own outline as a mask, and the tile. That is what lets any photo of any shape go in untouched.
const INK = new Map();
function ink(img) {
  const k = img.currentSrc || img.src; if (INK.has(k)) return INK.get(k);
  let out = null;
  try {
    const W = 48, H = 60, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data; let l = W, r = -1, t = -1, b = -1, n = 0;
    for (let y = 0; y < H; y++) {
      let a = W, z = -1; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 48) { if (x < a) a = x; z = x; n++; }
      if (z >= 0) { if (t < 0) t = y; b = y; if (a < l) l = a; if (z > r) r = z; }
    }
    if (r >= 0 && n < W * H * .92) out = { l: l / W, r: (r + 1) / W, t: t / H, b: (b + 1) / H };
    c.width = c.height = 0;
  } catch (e) { /* a photo that cannot be read simply has no act */ }
  INK.set(k, out); return out;
}
// where the picture is drawn inside the stage (object-fit: contain, centred, inside the photo's own padding), in stage px
function seat(stage, img) {
  const S = stage.getBoundingClientRect(), B = img.getBoundingClientRect(), cs = getComputedStyle(img), n = v => parseFloat(v) || 0;
  const pl = n(cs.paddingLeft), pt = n(cs.paddingTop), cw = B.width - pl - n(cs.paddingRight), ch = B.height - pt - n(cs.paddingBottom);
  const k = Math.min(cw / img.naturalWidth, ch / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
  return { x: B.left - S.left + pl + (cw - w) / 2, y: B.top - S.top + pt + (ch - h) / 2, w, h, ox: B.left - S.left, oy: B.top - S.top };
}
// a stand-in for a drawn object, so the band effects (steam, embers) can be given a box inside the tile
const box = (layer, x, y, w, h) => { const L = layer.getBoundingClientRect(); return { getBoundingClientRect: () => ({ left: L.left + x, top: L.top + y, width: w, height: h }) }; };
const turn = (v, y = 0) => `translateY(${y}px) rotate(${v}deg)`;

// ---- a landing: whatever is set down with weight throws dust out along the counter from under it. A fast low skirt
// that hugs the counter, and slower puffs that lift, swell and curl away. Called once behind the piece and once in front.
function kick(layer, cx, half, y, n = 22, top = false, power = 1, tint = "255,250,240") {   // tint: the puff's colour (charcoal throws dark dust)
  const img = soft(tint), w = layer.clientWidth, big = Math.max(1, Math.min(1.7, w / 420)), ps = [];
  for (let i = 0; i < n; i++) { const left = i % 2 === 0, low = i % 5 < 3, v = (low ? rnd(150, 520) : rnd(40, 170)) * big * power;
    ps.push({ x: cx + (left ? -1 : 1) * half * rnd(.5, 1), y: y - rnd(2, low ? 8 : 16) * big, vx: left ? -v : v, vy: -(low ? rnd(4, 26) : rnd(46, 130)) * big * power,
      r: (low ? rnd(9, 15) : rnd(15, 28)) * big * (.7 + .3 * power), life: low ? rnd(.5, .95) : rnd(1.1, 1.9), age: -rnd(0, low ? .04 : .12), low, drag: low ? 4.2 : 2.3, ph: rnd(0, 6.28) }); }
  fxCanvas(layer, (g, dt) => {
    let alive = 0;
    for (const p of ps) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const d = Math.exp(-p.drag * dt); p.vx = p.vx * d + (p.low ? 0 : Math.sin(p.ph + p.age * 3.2) * 26 * big * dt); p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt;
      const q = p.age / p.life, rad = p.r * (0.5 + 1.3 * (1 - Math.exp(-p.age * 4)));
      g.globalAlpha = (p.low ? 0.19 : 0.23) * Math.min(1, p.age / 0.07) * Math.pow(1 - q, 1.5) * Math.max(0, Math.min(1, Math.min(p.x, w - p.x) / 24));   // thins out before the side of the tile
      if (p.low) g.drawImage(img, p.x - rad * 1.5, p.y - rad * .95, rad * 3, rad * 1.9);   // low and wide: it hugs the counter
      else g.drawImage(img, p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    return alive > 0;
  }, top);
}
// ---- weight: a soft contact shadow on the counter under the piece, only while it is in the air and landing. It sits behind the piece.
function shade(layer, P, K, frames, ms, at) {
  const w = (K.r - K.l) * P.w * .86, h = Math.max(10, w * .13), n = el("i", "fx-shade", layer);
  n.style.cssText = `left:${P.x + (K.l + K.r) / 2 * P.w - w / 2}px;top:${P.y + K.b * P.h - h * .62}px;width:${w}px;height:${h}px`;
  play(n, frames, ms, at, "none").finished.then(() => n.remove(), () => n.remove());
}
// ---- heat behind the piece: a hot halo that swells on each crack and cools between them, so the piece is rim-lit from behind
function halo(layer, P, K, at) {
  const w = (K.r - K.l) * P.w * 2.1, h = Math.max((K.b - K.t) * P.h * 2.9, w * .7), n = el("i", "fx-halo", layer);
  n.style.cssText = `left:${P.x + (K.l + K.r) / 2 * P.w - w / 2}px;top:${P.y + (K.t + K.b) / 2 * P.h - h / 2}px;width:${w}px;height:${h}px`;
  const f = [{ opacity: 0, transform: "scale(.5)", easing: STRIKE }];
  [[0, .85, .9], [260, .78, 1], [520, .7, 1.08]].forEach(([t, o, sc]) => {
    f.push({ opacity: o, transform: `scale(${sc})`, offset: (t + 60) / 1700, easing: STATE }, { opacity: o * .36, transform: `scale(${sc * .86})`, offset: (t + 235) / 1700, easing: STRIKE }); });
  f.push({ opacity: .22, transform: "scale(.95)", offset: .62, easing: STATE }, { opacity: 0, transform: "scale(.8)" });
  play(n, f, 1700, at, "none").finished.then(() => n.remove(), () => n.remove());
}

// ---- light across the piece: one bright band crosses it, cut to the piece by its own photo, so it fits any shape with no setting up
function glint(layer, img, P, at, ms, hot) {
  const g = el("span", "fx-glint", layer), band = el("i", hot ? "hot" : "", g), src = `url("${img.currentSrc || img.src}")`;
  g.style.cssText = `left:${P.x}px;top:${P.y}px;width:${P.w}px;height:${P.h}px`; g.style.webkitMaskImage = src; g.style.maskImage = src;
  const frames = hot ? [{ opacity: 0, easing: STRIKE }, { opacity: .5, offset: .06, easing: STATE }, { opacity: .2, offset: .26, easing: STRIKE }, { opacity: .44, offset: .32, easing: STATE },
      { opacity: .18, offset: .52, easing: STRIKE }, { opacity: .38, offset: .58, easing: STATE }, { opacity: 0 }]   // three cracks, each a flare that cools
    : [{ transform: "translateX(-30%) skewX(-14deg)", opacity: 0, easing: STATE }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .86 }, { transform: "translateX(30%) skewX(-14deg)", opacity: 0 }];   // an upright stripe, leaned by a skew: where it is depends only on the width of the piece, never on the shape of the tile
  // the cut-out is used as a mask, and a mask that has not been fetched hides the whole band: wait for it, then keep to the clock
  const born = performance.now(), go = () => { if (g.isConnected) play(band, frames, ms, Math.max(0, at - (performance.now() - born)), "none").finished.then(() => g.remove(), () => g.remove()); };
  const pre = new Image(); pre.src = img.currentSrc || img.src; (pre.decode ? pre.decode() : Promise.resolve()).then(go, go);
  return g;
}
// ---- the spritz: perfume leaves the nozzle fast, brakes hard in the air, and hangs. Each droplet has its own place to reach, spread
// over the whole width, so one press fills the band. It holds for about 3 s, sinks a little and thins out one droplet at a time.
// Almost all of it is fine points; the haze under them is faint, so it reads as atomised scent and never as smoke. Over the
// title and the count (keep) it is held back, so the type keeps its contrast. Positions are worked out from age, so a slow phone sees the same spray.
function mist(layer, ox, oy, shots, keep = []) {
  const w = layer.clientWidth, h = layer.clientHeight, big = Math.max(1, Math.min(1.5, w / 700)), img = soft("255,252,246"), drops = [], haze = [];
  const cl = v => Math.max(0, Math.min(1, v)), smooth = v => { const t = cl(v); return t * t * (3 - 2 * t); };
  const held = (x, y, pad, floor) => { let k = 1; for (const z of keep) { const d = Math.hypot(Math.max(z.l - x, 0, x - z.r), Math.max(z.t - y, 0, y - z.b)); k = Math.min(k, floor + (1 - floor) * smooth((d - pad) / 26)); } return k; };
  const aim = s => { const tx = ox + (rnd(0, w) - ox) * s.reach, fan = Math.abs(tx - ox) / Math.max(1, w); return [tx, oy + (rnd(.06, .94) * h - oy) * Math.min(1, .22 + fan * 1.7)]; };
  const count = Math.min(540, Math.round(230 + w * .24));
  for (const s of shots) {
    for (let i = 0, n = Math.round(count * s.share); i < n; i++) { const [tx, ty] = aim(s), u = Math.random();
      drops.push({ tx, ty, k: rnd(2.6, 4.8), age: -s.at - rnd(0, .1), life: s.life * rnd(.82, 1), r: big * (.4 + .75 * u * u * u), a: rnd(.5, .95), fall: rnd(6, 24), amp: rnd(1.5, 7), f: rnd(.7, 1.6), ph: rnd(0, 6.28) }); }
    for (let i = 0, n = Math.round((14 + w / 36) * s.share); i < n; i++) { const [tx, ty] = aim(s);
      haze.push({ tx, ty, k: rnd(2.2, 3.6), age: -s.at - rnd(0, .14), life: s.life * rnd(.86, 1), r: h * rnd(.26, .5), fall: rnd(4, 14) }); }
  }
  fxCanvas(layer, (g, dt) => {
    let alive = 0;
    for (const p of haze) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const q = p.age / p.life, e = 1 - Math.exp(-p.k * p.age), x = ox + (p.tx - ox) * e, y = oy + (p.ty - oy) * e + p.fall * q * q, rad = p.r * (.35 + .95 * e);
      const a = .1 * smooth(p.age / .3) * (1 - smooth((q - .55) / .45)) * cl(Math.min(x + rad, w - x + rad) / (rad + 30)) * held(x, y, rad * .55, .12); if (a <= .002) continue;
      g.globalAlpha = a; g.drawImage(img, x - rad * 1.7, y - rad, rad * 3.4, rad * 2);
    }
    for (const p of drops) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const q = p.age / p.life, e = 1 - Math.exp(-p.k * p.age), x = ox + (p.tx - ox) * e + Math.sin(p.ph + p.age * p.f) * p.amp * e, y = oy + (p.ty - oy) * e + p.fall * q * q + Math.cos(p.ph + p.age * p.f * .8) * p.amp * .5 * e;
      const a = p.a * cl(p.age / .05) * (1 - smooth((q - .6) / .4)) * edge(y, p.r, h) * cl(Math.min(x, w - x) / 14) * held(x, y, 0, .34); if (a <= .004) continue;
      g.globalAlpha = a; const d = p.r * 1.9; g.drawImage(img, x - d, y - d, d * 2, d * 2);   // the soft round sprite: a droplet, never a square fleck
    }
    return alive > 0;
  });
}

const ACT = {
  // the spritz: the bottle takes two presses, the second harder; its mist opens across the whole tile BEHIND the piece, and the light runs once across the bottle
  cologne({ layer, img, K, P, pin, move }) {
    pin((K.l + K.r) / 2, K.b);
    const up = [{ transform: turn(0, 0), easing: STRIKE }, { transform: turn(0, 2.4), offset: .08, easing: ENTER }, { transform: turn(0, 0), offset: .26, easing: STRIKE }, { transform: turn(0, 4), offset: .36, easing: ENTER },
      { transform: turn(0, -6), offset: .58, easing: SINE }, { transform: turn(0, 0), offset: .84, easing: SINE }, { transform: turn(0, -1.2), offset: .92, easing: SINE }, { transform: turn(0, 0) }];
    move(up, 1150, T0 - 40);
    when(layer, T0, () => mist(layer, P.x + (K.l + K.r) / 2 * P.w, P.y + (K.t + (K.b - K.t) * .12) * P.h, [{ at: 0, share: .3, reach: .5, life: 2.5 }, { at: .38, share: .7, reach: 1, life: 3.7 }]));
    play(glint(layer, img, P, T0 + 520, 900), up, 1150, T0 - 40, "none");   // the light is cut to the bottle, so it rides with the bottle
  },
  // glass is held up to the light: tipped, a glint runs across it (cut to the glass by its own photo), let go, it rocks home
  bases({ layer, img, K, P, pin, move }) {
    const g = glint(layer, img, P, T0 - 40, 1000);
    const cx = (K.l + K.r) / 2; pin(cx, K.b); g.style.transformOrigin = `${cx * P.w}px ${K.b * P.h}px`;
    const rock = [
      { transform: turn(0), easing: ENTER },
      { transform: turn(-4.5), offset: .14 },                     // T0: tipped to the light
      { transform: turn(-4.5), offset: .6, easing: STATE },       // held while the glint crosses
      { transform: turn(2.2), offset: .72, easing: SINE },
      { transform: turn(-1.2), offset: .82, easing: SINE },
      { transform: turn(.5), offset: .91, easing: SINE },
      { transform: turn(0) }];
    move(rock, 1900, T0 - 266); play(g, rock, 1900, T0 - 266, "none");
  },
  // picked up, tipped, and dropped onto the counter. It lands with its weight (it squashes against the counter and its
  // shadow closes under it), bounces once, rocks out; dust is thrown along the counter on both landings; heat lifts off behind it
  bowls({ layer, K, P, pin, move, host }) {
    pin((K.l + K.r) / 2, K.b);
    const at = Math.max(0, T0 - 450), C = at + 450, B = C + 195;   // C: it lands. B: it lands again after the bounce
    const up = Math.max(8, Math.min(34, P.y + K.t * P.h - 8));   // only as high as the room above it: nothing is cut by the tile
    const tf = (y, r, sx = 1, sy = 1) => `translateY(${y}px) rotate(${r}deg) scale(${sx},${sy})`;
    move([
      { transform: tf(0, 0), easing: ENTER },
      { transform: tf(-up, -up / 11), offset: .15, easing: STATE },                // picked up, tipped
      { transform: tf(-up * 1.08, -up / 9.5), offset: .22, easing: STRIKE },               // a breath at the top
      { transform: tf(0, -.6, 1.045, .95), offset: .3, easing: ENTER },        // C: lands, squashes against the counter
      { transform: tf(-Math.min(8, up * .3), 1.7, .985, 1.02), offset: .365, easing: STRIKE },    // bounces
      { transform: tf(0, 1.1, 1.016, .984), offset: .43, easing: SINE },       // B: lands again
      { transform: tf(0, -1.3), offset: .55, easing: SINE },                   // rocks out
      { transform: tf(0, .75), offset: .68, easing: SINE },
      { transform: tf(0, -.38), offset: .8, easing: SINE },
      { transform: tf(0, .15), offset: .91, easing: SINE },
      { transform: tf(0, 0) }], 1500, at);
    shade(layer, P, K, [
      { opacity: 0, transform: "scale(1,1)", easing: ENTER },
      { opacity: .5, transform: "scale(.62,.8)", offset: .15, easing: STATE },   // in the air: small and soft
      { opacity: .46, transform: "scale(.58,.78)", offset: .22, easing: STRIKE },
      { opacity: 1, transform: "scale(1.12,1.1)", offset: .3, easing: ENTER },   // lands: closes under it
      { opacity: .7, transform: "scale(.9,.95)", offset: .365, easing: STRIKE },
      { opacity: .95, transform: "scale(1.04,1.02)", offset: .43, easing: STATE },
      { opacity: .7, transform: "scale(1,1)", offset: .6, easing: STATE },
      { opacity: 0, transform: "scale(1,1)" }], 1500, at);                       // and the tile is flat again
    give(host, C, .99);
    const iw = (K.r - K.l) * P.w, cx = P.x + (K.l + K.r) / 2 * P.w, foot = P.y + K.b * P.h, top = P.y + K.t * P.h, tall = (K.b - K.t) * P.h;
    when(layer, C, () => { kick(layer, cx, iw * .2, foot, 24, false); kick(layer, cx, iw * .2, foot, 16, true); });
    when(layer, B, () => kick(layer, cx, iw * .2, foot, 10, true, .55));
    when(layer, B + 140, () => steam(layer, box(layer, cx - iw * .35, top + tall * .08 - 19, iw * .7, 100)));   // starts behind the piece, shows above it
  },
  // the coals catch: three cracks. On each one the heat blooms behind the piece, sparks are thrown up from behind it (and a few
  // out in front), the piece is lit warm from below and jumps; after the last one a little heat keeps lifting off it
  heat({ layer, img, K, P, pin, move }) {
    pin((K.l + K.r) / 2, K.b);
    const C = T0, iw = (K.r - K.l) * P.w, bw = iw * 1.6, cx = P.x + (K.l + K.r) / 2 * P.w, mid = P.y + (K.t + K.b) / 2 * P.h, top = P.y + K.t * P.h, tall = (K.b - K.t) * P.h;
    halo(layer, P, K, C - 30);
    when(layer, C, () => { embers(layer, box(layer, cx - .42 * bw, mid - 44, bw, 100), 36, false, true); embers(layer, box(layer, cx - .42 * bw, mid - 30, bw, 100), 9, true, true); });
    const g = glint(layer, img, P, C, 1150, true);
    const hop = a => [
      { transform: "translateY(0px) scale(1,1)", easing: ENTER },
      { transform: `translateY(${-a}px) scale(.985,1.02)`, offset: .32, easing: STRIKE },
      { transform: `translateY(0px) scale(${1 + a * .004},${1 - a * .005})`, offset: .62, easing: ENTER },   // lands with its weight
      { transform: `translateY(${-a * .22}px) scale(1,1)`, offset: .8, easing: STRIKE },
      { transform: "translateY(0px) scale(1,1)" }];
    [9, 7, 5].forEach((a, i) => { move(hop(a), 240, C + 20 + i * 260); play(g, hop(a), 240, C + 20 + i * 260, "none"); });
    g.style.transformOrigin = img.style.transformOrigin ? `${(K.l + K.r) / 2 * P.w}px ${K.b * P.h}px` : "";
    when(layer, C + 760, () => steam(layer, box(layer, cx - iw * .3, top + tall * .1 - 19, iw * .6, 100)));
  },
  // hung back on its hook and let go: it swings from the top and settles. The swing is sized to the room beside the piece.
  hoses({ K, P, pin, move, host }) {
    pin((K.l + K.r) / 2, K.t);
    const room = Math.min(P.x + K.l * P.w, host.clientWidth - (P.x + K.r * P.w)), len = Math.max(1, (K.b - K.t) * P.h);
    const k = Math.max(2.2, Math.min(6.5, Math.atan(Math.max(0, room - 4) / len) * 57.3)) / 6.5;
    move([
      { transform: turn(0), easing: ENTER },
      { transform: turn(6.5 * k), offset: .1, easing: SINE },     // T0: let go
      { transform: turn(-4.4 * k), offset: .3, easing: SINE },
      { transform: turn(2.9 * k), offset: .48, easing: SINE },
      { transform: turn(-1.8 * k), offset: .64, easing: SINE },
      { transform: turn(1 * k), offset: .78, easing: SINE },
      { transform: turn(-.4 * k), offset: .9, easing: SINE },
      { transform: turn(0) }], 2300, T0 - 230);
  },
  // wrenched on: backed off, two clicks of the ratchet, and it seats
  parts({ layer, img, K, P, pin, move, host }) {
    pin((K.l + K.r) / 2, (K.t + K.b) / 2);
    move([
      { transform: "rotate(0deg) scale(1)", easing: ENTER },
      { transform: "rotate(-22deg) scale(1.04)", offset: .2, easing: STRIKE },   // from rest
      { transform: "rotate(-11deg) scale(1.04)", offset: .4 },    // click
      { transform: "rotate(-11deg) scale(1.04)", offset: .58, easing: STRIKE },
      { transform: "rotate(0deg) scale(1.04)", offset: .76, easing: ENTER },     // T0 + 230: click, tight
      { transform: "rotate(.8deg) scale(.985)", offset: .87, easing: STATE },
      { transform: "rotate(0deg) scale(1)" }], 700, T0 - 302);
    give(host, T0 + 230, .988);
    glint(layer, img, P, T0 + 330, 720);                          // tight and still: the light runs along it
  },
  // picked up off the counter, turned over once, put back
  misc({ layer, K, P, pin, move, hit }) {
    pin((K.l + K.r) / 2, K.b);
    shade(layer, P, K, [{ opacity: 0, transform: "scale(1,1)", easing: ENTER }, { opacity: .55, transform: "scale(.66,.8)", offset: .3, easing: SINE }, { opacity: .5, transform: "scale(.7,.82)", offset: .58, easing: STRIKE },
      { opacity: .95, transform: "scale(1.06,1.05)", offset: .78, easing: STATE }, { opacity: 0, transform: "scale(1,1)" }], 1150, hit + 40);
    move([
      { transform: turn(0, 0) + " scale(1)", easing: ENTER },
      { transform: turn(-8, -24) + " scale(1.05)", offset: .3, easing: SINE },
      { transform: turn(6, -20) + " scale(1.05)", offset: .58, easing: STRIKE },
      { transform: turn(0, 0) + " scale(1)", offset: .78, easing: ENTER },      // set down
      { transform: turn(0, -3) + " scale(1)", offset: .89, easing: STRIKE },
      { transform: turn(0, 0) + " scale(1)" }], 900, hit + 40);
  },
};
ACT.shisha = ACT.bowls;
// a charcoal product page has its own act (council, 2026-11-26: it borrowed Heat's lit coals). The box is tapped down on the
// counter twice and the cubes settle; each tap throws a low puff of cold, grey-black coal dust from its foot. No fire, no steam:
// charcoal is sold cold, by pickup or local delivery.
ACT.charcoal = function ({ layer, K, P, pin, move }) {
  pin((K.l + K.r) / 2, K.b);
  const C = T0, iw = (K.r - K.l) * P.w, cx = P.x + (K.l + K.r) / 2 * P.w, foot = P.y + K.b * P.h;
  const tap = a => [
    { transform: "translateY(0px) scale(1,1)", easing: ENTER },
    { transform: `translateY(${-a}px) scale(1,1.008)`, offset: .38, easing: STRIKE },
    { transform: `translateY(0px) scale(${1 + a * .0016},${1 - a * .0024})`, offset: .62, easing: ENTER },   // down on the counter, with its weight
    { transform: "translateY(0px) scale(1,1)" }];
  move(tap(10), 320, C); move(tap(6), 280, C + 460);
  when(layer, C + 200, () => kick(layer, cx, iw * .32, foot, 18, false, .7, "44,40,38"));
  when(layer, C + 635, () => kick(layer, cx, iw * .26, foot, 10, false, .5, "44,40,38"));
};
function piece(layer, go, host, cat) {
  if (!go) return;
  let hit = T0; const born = performance.now();
  if (cat === "misc") { // the price gun: the one label on the page lands with a thump
    const s = host.querySelector(".sticker");
    if (s && arrivals) { // a first load has already shown the price: nothing already seen is hidden
      // where the page change carries this label across (app.js names it "tag") it lands at 500 and is pressed home; elsewhere it is new and is stamped on
      const flew = !!document.startViewTransition; hit = flew ? 520 : T0;
      if (flew) press(s, hit); else stamp(s, hit, 1.35, 7, inward(s.getBoundingClientRect(), host.getBoundingClientRect(), 1.35, 7));
      give(host, hit, .985);
    }
  }
  let img = host.querySelector(":scope > img.shot"); if (!img || host.classList.contains("tile--photo") || !ACT[cat]) return;
  const moves = [], raise = i => { i.classList.add("shot--act"); };   // one step up: the layer's sparks and heat sit behind the piece
  const start = late => {
    if (!layer.isConnected || !img.isConnected) return;
    if (late) { T0 = Math.max(140, 450 - (performance.now() - born)); WIND = T0 - 140; hit = T0; }   // the photo came in after the page was drawn: the act still waits for the page change to land
    const K = ink(img); if (!K) return;
    raise(img);
    const P = seat(host, img), pin = (fx, fy) => { img.style.transformOrigin = `${(P.x - P.ox + fx * P.w).toFixed(1)}px ${(P.y - P.oy + fy * P.h).toFixed(1)}px`; };
    // every move of the photo starts and ends at rest and holds nothing, and is remembered so a re-draw can carry it over
    const move = (frames, duration, delay = 0) => { const m = { a: play(img, frames, duration, delay, "none"), frames, duration, delay }; moves.push(m); return m.a; };
    ACT[cat]({ layer, img, K, P, pin, move, host, hit });
    // the page was re-drawn in mid-act (add to cart, a postal code): the new photo takes over each move where the old one was
    layer.fxAgain = h => {
      const n = h.querySelector(":scope > img.shot"); if (!n || n === img) return;
      raise(n); n.style.transformOrigin = img.style.transformOrigin;
      for (const m of moves) {
        const at = m.a.currentTime; if (at == null || at >= m.delay + m.duration) continue;
        m.a = play(n, m.frames, m.duration, m.delay, "none"); m.a.currentTime = at;
      }
      img = n;
    };
  };
  if (img.complete && img.naturalWidth) start(false); else img.addEventListener("load", () => start(true), { once: true });
}
const PIECES = new Set(Object.keys(ACT));

// One layer per page. A re-draw of the same page (add to cart, a quantity change) moves the live layer into the
// new markup, so an act in mid-air carries on and nothing replays (a product's photo is handed its moves by fxAgain).
let live = null, playedKey = "", lastPath = location.pathname, again = false;
function place() {
  if (document.hidden) { document.addEventListener("visibilitychange", place, { once: true }); return; } // opened in the background: the act waits to be seen
  const head = document.querySelector(".shophead[data-cat], .shophead[data-fx]"), stage = document.querySelector("[data-stage]");
  const host = head || stage; if (!host || host.querySelector(":scope > .fx")) return;
  const cat = head ? head.dataset.cat || head.dataset.fx : stage.closest("[data-cat]").dataset.cat, run = head ? FX[cat] : PIECES.has(cat) && piece;
  if (!run) return;
  // a band's layer sits behind its type; a product's sits over the photo and under the price label
  const mount = l => { const shot = !head && host.querySelector(":scope > .shot"); if (shot) shot.after(l); else host.prepend(l); };
  const key = (head ? "head|" : "piece|") + location.pathname;
  if (live && live.key === key && !live.layer.isConnected) { mount(live.layer); live.layer.fxAgain && live.layer.fxAgain(host); return; }
  const fresh = key !== playedKey; playedKey = key;
  const layer = el("span", head ? "fx" : "fx fx--over"); layer.setAttribute("aria-hidden", "true"); mount(layer);
  live = { key, layer };
  clock(again);
  try { run(layer, fresh && !RM.matches, host, head ? again : cat); } catch (e) { console.error("fx " + key + ": " + (e && e.stack || e)); layer.remove(); live = null; } // an effect that fails is simply absent, and says why
}
new MutationObserver(afterSwap(place)).observe(document.getElementById("main"), { childList: true });   // at a wave's swap, the frame after (route.js)
addEventListener("routechange", () => { if (location.pathname !== lastPath) { lastPath = location.pathname; arrivals++; playedKey = ""; live = null; } }); // arriving again plays it again
// the object is measured against the title, so it is measured again when the title can change size
const refit = () => { const o = document.querySelector(".shophead > .fx > .fx-obj"); if (o) fit(o.parentNode, o); };
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(refit, 120); });
if (document.fonts && document.fonts.ready) { document.fonts.ready.then(refit); if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", refit); }
// a tap on the band plays its act again: the short version, the header's own act only (prices already on screen stay put)
document.addEventListener("click", e => {
  const band = e.target.closest(".shophead[data-cat], .shophead[data-fx]"); if (!band || RM.matches || e.target.closest("a,button,input,select,label,summary")) return;
  const sel = window.getSelection && getSelection(); if (sel && !sel.isCollapsed && band.contains(sel.anchorNode)) return; // the end of a drag-select of the title is not a tap
  const old = band.querySelector(":scope > .fx"); if (!old) return;
  if (old.querySelector("canvas") || old.getAnimations({ subtree: true }).some(a => a.playState === "running" || a.pending)) return;   // something is still moving: an arrival is never cut short
  old.remove(); live = null; playedKey = ""; again = true; try { place(); } finally { again = false; }
});
place();
