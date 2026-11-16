// 06 section entrances. One rule for every section of the shop:
//   the header band carries one real object from that section, a solid silhouette at the weight of the type, on
//   the right; when the page opens, a hand does the one thing you do to that object at the counter, once, and the
//   object reacts to it.
//   hookahs  smoke rolls in and pushes the hose (fx-smoke.js)   cologne  the pump is pressed twice; the bottle kicks
//   bases    the glass is tipped to the light, let go, rocks    bowls    the tongs set a coal and push it home; it flares 
//   heat     the coals light, the lid hops on each crackle      hoses    thrown out; the mouthpiece whips
//   parts    spun down the thread, wrenched tight; it seats     misc     the price gun: one hit alone, then faster
// Timing: every act makes contact at T0, after the page change has landed; a wind-up may start at WIND. A tap on
// the band plays a short version with no page change to wait for. Four curves: ENTER (things arriving), STRIKE
// (things driven into contact: they speed up), THROW (let go at full speed), SEAT (the label spring).
// Everything sits behind the type. With motion turned off the objects are simply there, at rest.
// Rules kept here: a re-draw of the same page changes nothing a shopper can see; nothing already seen is hidden;
// a resting state never depends on a measurement; nothing is sliced by the edge of the band.
import { OBJ } from "./fx-objects.js";
const RM = matchMedia("(prefers-reduced-motion: reduce)");
let T0 = 450, WIND = T0 - 140;                                           // contact, and the earliest wind-up
const clock = replay => { T0 = replay ? 140 : 450; WIND = T0 - 140; };   // a tap has no page change to wait for
const ENTER = "cubic-bezier(.16,1,.3,1)", STATE = "cubic-bezier(.4,0,.2,1)", STRIKE = "cubic-bezier(.33,0,.67,.33)";
const THROW = "cubic-bezier(.25,.6,.35,1)";                              // let go at full speed, slowed by drag, no creep at the end
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
// The object rests at the weight set in styles.css (.fx .o). For its act it comes up to full strength, and eases
// back over 1.2 s once the act is over. One opacity animation, nothing held afterwards.
const REST = .32, FULL = .55;
const lift = (o, from, to, wet) => {
  const act = Math.max(1, to - from), d = act + 1200;
  return play(o.querySelector(".o"), [{ opacity: wet ? FULL : REST, easing: STATE }, { opacity: FULL, offset: wet ? 0 : Math.min(160, act) / d },
    { opacity: FULL, offset: act / d, easing: STATE }, { opacity: REST }], d, from, "none");
};
// The object never touches the title. Where a long title leaves less room beside it (a phone), the object takes
// the room there is. When that is too small to read, it drops under the end of the title; an object marked "edge"
// (the nut, whose ink keeps clear of its box corners) instead goes large and runs off the bottom-right corner.
function fit(layer, o) {
  o.style.cssText = ""; o.classList.remove("bleed");
  const band = layer.parentNode, h1 = band && band.querySelector("h1"); if (!h1) return;
  const L = band.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(h1);
  const T = range.getBoundingClientRect(), box = o.getBoundingClientRect(), size = box.width, gutter = L.right - box.right;
  const beside = L.right - gutter - T.right - 10, edge = o.classList.contains("edge");
  if (beside >= size) return;
  if (beside >= Math.max(72, size * .6)) { o.style.height = Math.floor(beside) + "px"; return; } // still big enough to read beside the title
  // the title's box, not its tall line box; a title with no tails (g, j, p, q, y) leaves a little more room under it
  const foot = Math.min(T.bottom, h1.getBoundingClientRect().bottom) - (/[gjpqy,]/.test(h1.textContent) ? 0 : 10);
  const under = L.bottom - foot - 4, s = Math.max(56, Math.floor(Math.min(size, under)));
  o.style.cssText = `height:${s}px;top:auto;bottom:4px;translate:none`;
}
// a point inside the object's box, as a fraction of the layer
const at = (layer, o, fx, fy) => { const r = o.getBoundingClientRect(), L = layer.getBoundingClientRect(); return [(r.left - L.left + r.width * fx) / L.width, (r.top - L.top + r.height * fy) / L.height]; };
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
const bell = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;   // -1..1, most near 0
// Nothing is sliced by the top or bottom edge of the layer: whatever comes within 20 px of an edge thins out to nothing there.
const edge = (y, rad, h) => Math.max(0, Math.min(1, (Math.min(y, h - y) - rad) / 20));

// ---- mist: a pump atomiser. Two presses; each sends a cone of droplets that streak while fast, are stopped by the air
// within one "reach", and leave a cloud that swells, drifts on, sinks a little and thins out.
function spritz(layer, ox, oy, angle, power = 1, reach = 0, fat = 1) {
  const w = layer.clientWidth, h = layer.clientHeight;
  const R = reach || Math.min(Math.max(w * 0.42, Math.min(w * 0.6, 240)), h * 2.4) * power;   // reach in px: 234 on a 390 band, 602 on a 1440 band
  const near = Math.max(0, Math.min(1, (520 - R) / 260));   // 1 on a phone band, 0 on a desktop band: a small spray is drawn heavier
  const S = Math.max(1 + 0.35 * near, Math.min(1.5, R / 220));                        // droplet scale: 1.35 on a phone band, 1.5 on a desktop band
  const X = ox * w, Y = oy * h, drops = [], puffs = [], img = soft("255,252,246");
  const burst = (n, force, at) => {
    for (let i = 0; i < n; i++) {
      const u = Math.random(), off = bell(), a = angle + off * 0.36;             // cone: 41 degrees across, dense in the middle
      const k = 3.2 + 3.6 * (1 - u);                                              // air drag per second: fine droplets stop soonest
      const v = R * k * rnd(0.5, 1.25) * force * (1 - 0.3 * Math.abs(off));      // so each one travels 0.5 to 1.25 reaches
      drops.push({ x: X, y: Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, k, r: S * (0.4 + 1.3 * u * u * u),
        g: 70 * S * u * u - 5, life: (0.55 + 0.8 * u + rnd(0, 0.5)) * (1 + 0.35 * near), age: -at - rnd(0, 0.09), ph: rnd(0, 6.28) });
    }
    for (let i = 0; i < Math.round(n / (11 - 2 * near)); i++) {
      const a = angle + bell() * 0.3, v = R * 2.4 * rnd(0.3, 0.8) * force, off = rnd(0.04, 0.22) * R;   // the cloud starts out along the spray, never as a blob on the nozzle
      puffs.push({ x: X + Math.cos(a) * off, y: Y + Math.sin(a) * off, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: R * rnd(0.1, 0.3) * fat, life: rnd(1.4, 2.4) * (1 + 0.4 * near), age: -at - rnd(0, 0.12) });
    }
  };
  burst(240, 1, 0); burst(160, 0.85, 0.38);   // the second press lands 380 ms after the first
  const pa = 0.15 + 0.05 * near, da = 0.75 + 0.2 * near;
  fxCanvas(layer, (g, dt) => {
    let alive = 0;
    for (const p of puffs) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const d = Math.exp(-2.4 * dt); p.vx *= d; p.vy = p.vy * d + 5 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const q = p.age / p.life, room = Math.min(p.y, h - p.y) - 2;
      const rad = Math.min(p.r * (0.3 + 0.7 * (1 - Math.exp(-p.age * 3.5))) * (1 + 0.6 * q), room / 0.8);   // swells fast, then keeps spreading, but never wider than the room it has
      if (rad < 1) continue;
      g.globalAlpha = pa * Math.min(1, p.age / 0.12) * Math.pow(1 - q, 1.5) * edge(p.y, rad * 0.5, h);
      g.drawImage(img, p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = g.fillStyle = "rgb(255,252,246)";
    for (const p of drops) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      const d = Math.exp(-p.k * dt);
      p.vx = p.vx * d + Math.sin(p.ph + p.age * 9) * 14 * dt; p.vy = p.vy * d + p.g * dt;   // a little swirl once slow; heavy ones settle, fine ones lift
      p.x += p.vx * dt; p.y += p.vy * dt;
      const q = p.age / p.life, sp = Math.hypot(p.vx, p.vy), len = Math.min(sp * 0.022, 18 * S), r = p.r * (1 - 0.5 * q);   // 22 ms of streak; it dries as it goes
      g.globalAlpha = da * Math.pow(1 - q, 1.2) * r / (r + len * 0.3) * edge(p.y, r, h);    // a streak is the same light spread along a line
      if (g.globalAlpha <= 0) continue;
      g.beginPath();
      if (len > 1) { g.lineWidth = 2 * r; g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * len, p.y - p.vy / sp * len); g.stroke(); }
      else { g.arc(p.x, p.y, r, 0, 6.283); g.fill(); }
    }
    return alive > 0;
  });
}

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

// the light of the coals: three under the cubes, five in the slots of the cup. Drawn under the solid, so it shows through it.
const COALS = '<path class="glow" d="M15 44 H31 V59 H15 Z"/><path class="glow" d="M34 44 H50 V59 H34 Z"/><path class="glow" d="M53 44 H69 V59 H53 Z"/><path class="glow" d="M17.75 73 H22.25 V86 H17.75 Z"/><path class="glow" d="M28.75 73 H33.25 V86 H28.75 Z"/><path class="glow" d="M39.75 73 H44.25 V86 H39.75 Z"/><path class="glow" d="M50.75 73 H55.25 V86 H50.75 Z"/><path class="glow" d="M61.75 73 H66.25 V86 H61.75 Z"/>';

let arrivals = 0; // in-site page changes so far; 0 means this page was the first one loaded
// Every act takes (layer, go, host, re): go = play it (false: just be there, at rest), re = this is a tap, not an arrival.
const FX = {
  hookahs(layer, go, host, re) {
    const o = obj(layer, OBJ.hookahs), line = o.querySelector(".o > .ink"), handle = line.nextElementSibling;
    const hose = group("hose", [line, handle]), mouth = group("mouth", [handle]);   // the mouthpiece is a weight on the end of the line: it trails it
    if (!go) return;
    // the gust lands when the smoke front gets to the hookah (the front is fx-smoke.js main(), xf; the two must change together)
    const GUST = re ? T0 : Math.round(60 + 900 * (0.6 + 0.1 * layer.clientWidth / Math.max(1, layer.clientHeight))), a = re ? .5 : 1;   // a tap is a flick of the hose, not a new bank
    const deg = v => `rotate(${(v * a).toFixed(2)}deg)`;
    lift(o, WIND, GUST + 1560);
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
    const o = obj(layer, OBJ.cologne), recoil = group("recoil", [...o.querySelector(".o").children]);
    if (!go) return;
    lift(o, T0 - 90, T0 + 760);
    play(o.querySelector(".head"), [ // driven down, held while it sprays, sprung back; twice, the second a shade shallower
      { transform: "translateY(0px)", easing: STRIKE },
      { transform: "translateY(7px)", offset: .1216 },                  // T0: bottom, spray 1
      { transform: "translateY(7px)", offset: .2703, easing: ENTER },   // held 110 ms
      { transform: "translateY(0px)", offset: .4865 },
      { transform: "translateY(0px)", offset: .5135, easing: STRIKE },
      { transform: "translateY(6px)", offset: .6351 },                  // T0 + 380: bottom, spray 2
      { transform: "translateY(6px)", offset: .7838, easing: ENTER },
      { transform: "translateY(0px)" }], 740, T0 - 90);
    play(recoil, [ // the bottle kicks back from each spray and rocks home
      { transform: "rotate(0deg)", easing: ENTER },
      { transform: "rotate(2.6deg)", offset: .1053, easing: STATE },
      { transform: "rotate(-0.9deg)", offset: .3026, easing: STATE },
      { transform: "rotate(0deg)", offset: .4737 },
      { transform: "rotate(0deg)", offset: .5, easing: ENTER },
      { transform: "rotate(1.9deg)", offset: .6053, easing: STATE },
      { transform: "rotate(-0.6deg)", offset: .8026, easing: STATE },
      { transform: "rotate(0deg)" }], 760, T0);
    when(layer, T0, () => { const [x, y] = at(layer, o, 0.42, 0.22); spritz(layer, x, y, Math.PI * 0.95); }); // the spray hole, 7 units down when it fires; aimed a little below level, behind the title
  },
  bases(layer, go, host, re) {
    const id = "fxc" + (++uid), g = "fxg" + uid, body = "M35 22.3 A20 5 0 0 0 65 22.3 V38 C65 54 70 62 84 70 C91 74 92 80 92 84 C92 90 88 94 80 94 H20 C12 94 8 90 8 84 C8 80 9 74 16 70 C30 62 35 54 35 38 Z";
    const o = obj(layer, `<defs><clipPath id="${id}"><path d="${body}"/></clipPath><linearGradient id="${g}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <g class="rock">${OBJ.bases}<g clip-path="url(#${id})"><g class="beam"><path d="M0 -10 C10 28, 10 74, -6 112 H18 C34 74, 34 28, 24 -10 Z" fill="url(#${g})"/><path d="M-20 -10 C-10 28, -10 74, -26 112 H-19 C-3 74, -3 28, -13 -10 Z" fill="url(#${g})"/></g></g>
      <path class="lit gl" d="M35 40 C35 54 30 62 16 70 C10 74 9 79 9 83"/><path class="lit gr" d="M65 40 C65 54 70 62 84 70 C90 74 91 79 91 83"/><path class="lit sh" d="M22 76 C27 71 34 66 38 60 M42 27 V40"/></g>`);
    const q = c => o.querySelector(c), rest = () => { q(".beam").style.opacity = 0; q(".sh").style.opacity = .5; }; // the lit glass, at rest
    idle(layer, () => play(q(".sh"), [{ opacity: .5, easing: STATE }, { opacity: .95, offset: .4, easing: STATE }, { opacity: .5 }], 1400, 0, "none")); // the highlight catches the light again
    if (!go) { rest(); return; }
    lift(o, WIND, T0 + 1040);
    play(q(".rock"), [ // tipped to the light, let go, rocks out on its foot: each swing smaller and quicker
      { transform: "rotate(0deg)", easing: STATE },
      { transform: "rotate(-6deg)", offset: .1667, easing: STATE },     // T0: let go
      { transform: "rotate(2.4deg)", offset: .4762, easing: STATE },
      { transform: "rotate(-1.1deg)", offset: .7381, easing: STATE },
      { transform: "rotate(0.4deg)", offset: .9048, easing: STATE },
      { transform: "rotate(0deg)" }], 840, WIND);
    const run = { duration: 1100, delay: T0 - 60, fill: "both" }; // the light crosses because the glass turned; each shoulder glints as it passes
    const lights = [
      q(".beam").animate([{ transform: "translateX(-44px) skewX(-14deg)" }, { transform: "translateX(138px) skewX(-14deg)" }], { ...run, easing: "cubic-bezier(.3,.1,.3,1)" }),
      q(".beam").animate([{ opacity: 0 }, { opacity: 1, offset: .14 }, { opacity: 1, offset: .8 }, { opacity: 0 }], run),
      q(".gl").animate([{ opacity: 0 }, { opacity: 0, offset: .16 }, { opacity: .9, offset: .34 }, { opacity: 0, offset: .56 }, { opacity: 0 }], run),
      q(".gr").animate([{ opacity: 0 }, { opacity: 0, offset: .46 }, { opacity: .8, offset: .64 }, { opacity: 0, offset: .86 }, { opacity: 0 }], run),
      q(".sh").animate([{ opacity: 0 }, { opacity: 0, offset: .6 }, { opacity: .5 }], run)]; // and the glass keeps a highlight
    lights[4].onfinish = () => { rest(); lights.forEach(x => x.cancel()); }; // the resting look is handed to plain styles: nothing stays alive
  },
  bowls(layer, go) {
    // coals are being set on the bowl: one sits on top of the other two. The tongs come down, take it, carry it over and
    // set it down beside them, let go, then push it in until it knocks against its neighbour. Every coal flares when it is touched.
    const o = obj(layer, OBJ.bowls), q = c => o.querySelector(c), glows = [...o.querySelectorAll(".glow")];
    idle(layer, () => glows.forEach((gl, i) => play(gl, [ // the coals breathe
      { opacity: .62, easing: STATE }, { opacity: .85, offset: .3, easing: STATE }, { opacity: .55, offset: .55, easing: STATE }, { opacity: .75, offset: .8, easing: STATE }, { opacity: .62 }], 900, i * 110, "none")));
    if (!go) return;
    const S = Math.max(0, T0 - 200), D = 1300, f = ms => ms / D;   // S: the tongs start down. S + 200: they close on the coal
    lift(o, S, S + D);
    // the tongs: where the hinge is; the tips are 36 units down the arms, which point down and left at 143 degrees
    const at = (x, y) => `translate(${x}px,${y}px) rotate(143deg)`, tr = (x, y, r = 0) => `translate(${x}px,${y}px) rotate(${r}deg)`;
    play(q(".tongs"), [
      { transform: at(92.75, 4.73), easing: ENTER },
      { transform: at(73.25, 6.23), offset: f(200), easing: STATE },      // on the top coal
      { transform: at(76.75, 1.73), offset: f(320), easing: SINE },        // lifted clear
      { transform: at(85.75, 2.73), offset: f(520), easing: STRIKE },     // carried over
      { transform: at(92.75, 15.23), offset: f(640), easing: ENTER },     // set down
      { transform: at(95.75, 7.73), offset: f(760), easing: STATE },      // let go, up and round behind it
      { transform: at(99.25, 15.23), offset: f(900), easing: STRIKE },
      { transform: at(96.25, 15.23), offset: f(1000), easing: ENTER },    // pushed in
      { transform: at(92.75, 4.73) }], D, S, "none");
    const jaw = s => [10, 10, 8, 8, 11, 11, 2.2, 2.2, 10].map((d, i) => ({ transform: `rotate(${d * s}deg)`, offset: [0, f(140), f(200), f(640), f(700), f(760), f(860), f(1040), 1][i], easing: STATE }));
    play(q(".arm.a"), jaw(-1), D, S, "none"); play(q(".arm.b"), jaw(1), D, S, "none");
    play(q(".c2"), [ // the coal that is moved: it starts on top of the other two
      { transform: tr(-16.5, -9), easing: ENTER },
      { transform: tr(-16.5, -9), offset: f(200), easing: STATE },
      { transform: tr(-13, -13.5, -6), offset: f(320), easing: SINE },
      { transform: tr(-4, -12.5, 5), offset: f(520), easing: STRIKE },
      { transform: tr(3, 0), offset: f(640), easing: ENTER },
      { transform: tr(3, 0), offset: f(900), easing: STRIKE },
      { transform: tr(-.7, 0), offset: f(1000), easing: ENTER },          // knocks into its neighbour
      { transform: tr(0, 0), offset: f(1070) },
      { transform: tr(0, 0) }], D, S);
    const bump = (x, t) => [{ transform: "translateX(0px)" }, { transform: "translateX(0px)", offset: f(t), easing: ENTER }, { transform: `translateX(${x}px)`, offset: f(t + 50), easing: STATE }, { transform: "translateX(0px)", offset: f(t + 170) }, { transform: "translateX(0px)" }];
    play(q(".c3"), bump(-.9, 990), D, S, "none"); play(q(".c1"), bump(-.45, 1030), D, S, "none");
    play(q(".set"), [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(1.3px)", offset: .3, easing: STATE }, { transform: "translateY(0px)" }], 220, S + 640, "none");   // the bowl takes the weight
    glows.forEach(gl => play(gl, [{ opacity: .62, easing: STATE }, { opacity: .62, offset: f(630), easing: ENTER }, { opacity: 1, offset: f(670), easing: STATE }, { opacity: .66, offset: f(900), easing: STRIKE },
      { opacity: 1, offset: f(1010), easing: STATE }, { opacity: .62 }], D, S, "none"));
    when(layer, S + 640, () => { const L = layer.getBoundingClientRect(), B = o.getBoundingClientRect(); embers(layer, box(layer, B.left - L.left + .08 * B.width, B.top - L.top - .115 * B.height, B.width, B.height), 9, false, true); });   // a few sparks when it is set down and when it knocks
  },
  heat(layer, go, host, re) {
    const o = obj(layer, `<g class="keeper">${COALS}${OBJ.heat}</g>`), glows = [...o.querySelectorAll(".glow")];
    idle(layer, () => glows.forEach(gl => play(gl, [ // the coal breathes
      { opacity: .45, easing: STATE }, { opacity: .72, offset: .25, easing: STATE }, { opacity: .38, offset: .5, easing: STATE }, { opacity: .6, offset: .75, easing: STATE }, { opacity: .45 }], 900, 0, "none")));
    if (!go) return;
    lift(o, WIND, T0 + 1160);
    glows.forEach(gl => play(gl, [ // glows, then flashes with each crackle, each flash lower, and cools to the level it stays at
      { opacity: 0, easing: STRIKE },
      { opacity: .6, offset: .1077 },
      { opacity: 1, offset: .1385, easing: ENTER },
      { opacity: .55, offset: .3077 },
      { opacity: .9, offset: .3385, easing: ENTER },
      { opacity: .5, offset: .5077 },
      { opacity: .75, offset: .5385, easing: ENTER },
      { opacity: .45 }], 1300, WIND));
    const lid = (y, d) => `translateY(${y}px) rotate(${(d - 6).toFixed(1)}deg)`;   // the lid rests tilted 6 degrees (styles.css .fx .lid)
    play(o.querySelector(".lid"), [ // the lid hops on each crackle, less each time
      { transform: lid(0, 0), easing: ENTER },
      { transform: lid(-6, 2), offset: .0889, easing: STRIKE },
      { transform: lid(0, -1.2), offset: .1778, easing: STATE },
      { transform: lid(0, .5), offset: .2444, easing: STATE },
      { transform: lid(0, 0), offset: .2889, easing: ENTER },
      { transform: lid(-3, -1.2), offset: .3667, easing: STRIKE },
      { transform: lid(0, .6), offset: .4444, easing: STATE },
      { transform: lid(0, 0), offset: .5778, easing: ENTER },
      { transform: lid(-1.5, .6), offset: .6444, easing: STRIKE },
      { transform: lid(0, -.3), offset: .7111, easing: STATE },
      { transform: lid(0, 0) }], 900, T0);
    when(layer, T0, () => embers(layer, o)); // three crackles of sparks leave the coals and die inside the band
  },
  hoses(layer, go, host, re) {
    const o = obj(layer, `<g class="whip">${OBJ.hoses}</g>`), p = o.querySelector(".coil"), tip = o.querySelector(".tip"), whip = o.querySelector(".whip");
    const flick = (t, a, slow, first) => { // the mouthpiece whips and the hose flexes with it; a = size, slow = stretch
      const r = v => `rotate(${(v * a).toFixed(2)}deg)`;
      play(tip, [
        { transform: first || "scale(1) " + r(0), easing: ENTER },
        { transform: "scale(1) " + r(-22), offset: .2, easing: STATE },
        { transform: "scale(1) " + r(11), offset: .44, easing: STATE },
        { transform: "scale(1) " + r(-5), offset: .66, easing: STATE },
        { transform: "scale(1) " + r(2), offset: .84, easing: STATE },
        { transform: "scale(1) " + r(0) }], 760 * slow, t);
      play(whip, [
        { transform: r(0), easing: ENTER },
        { transform: r(-5), offset: .2, easing: STATE },
        { transform: r(2.4), offset: .5, easing: STATE },
        { transform: r(-1), offset: .76, easing: STATE },
        { transform: r(0) }], 700 * slow, t + 40 * slow);
    };
    idle(layer, () => flick(0, .2, 2.4)); // every so often the end of the hose sways: 4 degrees over 1.8 s
    if (!go) return;                      // at rest the line is simply drawn: no dash is left on it
    if (re) { lift(o, 0, 760); flick(0, .7, 1); return; }  // a tap flicks it; the line is never taken away and drawn again
    const len = Math.ceil(p.getTotalLength()) + 1, hit = WIND + 650;
    lift(o, WIND, hit + 760);
    p.style.strokeDasharray = len;
    play(p, [{ strokeDashoffset: len * .65, easing: THROW }, { strokeDashoffset: 0 }], 700, WIND).onfinish = () => { p.style.strokeDasharray = ""; }; // the inner turn is in the hand from the start (the band is never empty); the rest is thrown out from it
    play(tip, [{ opacity: 0 }, { opacity: 1 }], 60, hit);
    flick(hit, 1, 1, "scale(.2) rotate(55deg)");
  },
  parts(layer, go, host, re) {
    const o = obj(layer, OBJ.parts, "edge");
    if (!go) return;
    const turn = o.querySelector(".turn"), depth = o.getBoundingClientRect().width < 72 ? ".88" : ".94";
    const hit = re ? 340 : WIND + 810, up = o.classList.contains("bleed") ? 3 : 12;   // beside the end of the title it has less thread to come down
    lift(o, re ? 0 : WIND, hit + 360);
    if (re) play(turn, [ // a tap: backed off a sixth and wrenched tight again; it never jumps
      { transform: "translateY(0px) rotate(0deg)", easing: STATE },
      { transform: "translateY(-2px) rotate(-40deg)", offset: .4118 },
      { transform: "translateY(-2px) rotate(-40deg)", offset: .6471, easing: STRIKE },
      { transform: "translateY(0px) rotate(0deg)" }], 340, 0);
    else play(turn, [ // backed off, spun on by hand down the thread, a rest, then the wrench gives the last turn and it stops dead
      { transform: `translateY(${-up}px) rotate(-200deg)`, easing: STATE },
      { transform: `translateY(${-up - 1}px) rotate(-214deg)`, offset: .1728, easing: STATE },
      { transform: "translateY(-2px) rotate(-40deg)", offset: .716 },
      { transform: "translateY(-2px) rotate(-40deg)", offset: .8519, easing: STRIKE },
      { transform: "translateY(0px) rotate(0deg)" }], 810, WIND);
    play(o.querySelector("svg"), [{ scale: "1", easing: ENTER }, { scale: depth, offset: .1389, easing: SEAT }, { scale: "1" }], 360, hit); // it seats
  },
  misc(layer, go, host, re) {
    const o = obj(layer, OBJ.misc);
    if (!go) return;
    const svg = o.querySelector("svg");
    if (re) { press(svg, T0); lift(o, T0, T0 + 360); return; } // a tap presses the header's label home again; no price on the page is touched
    stamp(svg, T0, 1.22);               // the header's label takes the first hit alone; from 1.22 it stays inside the band on a phone
    lift(o, T0 - 140, T0 + 280, true);  // the ink is wet, then dries
    if (!arrivals) return; // on a first load the prices are already on screen: nothing already seen is hidden
    const vh = innerHeight, todo = [];   // measure every card first, then start the moves
    for (const tile of document.querySelectorAll(".grid .card .tile")) {
      const s = tile.querySelector(".sticker"); if (!s || s.style.viewTransitionName) continue;
      const r = tile.getBoundingClientRect(); if (r.top >= vh || r.bottom <= 0) continue;
      todo.push([tile, s, inward(s.getBoundingClientRect(), r, 1.3, 7)]);
    }
    const GAPS = [260, 120, 100, 85, 75, 70]; let k = 0, hit = T0; // then the cards, speeding up; nothing waits past the sixth
    for (const [tile, s, shift] of todo) {
      if (k < GAPS.length) hit += GAPS[k++];
      stamp(s, hit, 1.3, 7, shift); give(tile, hit);
    }
  },
};
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
function kick(layer, cx, half, y, n = 22, top = false, power = 1) {
  const img = soft("255,250,240"), w = layer.clientWidth, big = Math.max(1, Math.min(1.7, w / 420)), ps = [];
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
// ---- mist in the air: fine droplets and soft cloud appear across the upper part of the tile, drift down and across, and thin out.
// It belongs to the tile, not to a point on the photo.
function veil(layer) {
  const w = layer.clientWidth, h = layer.clientHeight, big = Math.max(1, Math.min(1.8, w / 400)), img = soft("255,252,246"), drops = [], puffs = [];
  for (let i = 0; i < 150; i++) { const u = Math.random();
    drops.push({ x: rnd(-.05, .95) * w, y: rnd(.04, .5) * h, vx: rnd(14, 46) * big, vy: rnd(10, 34) * big + 26 * u * big, r: big * (.5 + 1.2 * u * u), life: rnd(1.3, 2.6), age: -rnd(0, .7), ph: rnd(0, 6.28) }); }
  for (let i = 0; i < 30; i++) puffs.push({ x: rnd(-.05, .85) * w, y: rnd(.06, .5) * h, vx: rnd(16, 44) * big, vy: rnd(8, 22) * big, r: rnd(46, 96) * big, life: rnd(2, 3.2), age: -rnd(0, .7) });
  const side = x => Math.max(0, Math.min(1, Math.min(x, w - x) / 26));   // nothing is sliced by the side of the tile either
  fxCanvas(layer, (g, dt) => {
    let alive = 0;
    for (const p of puffs) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; const q = p.age / p.life, rad = p.r * (.7 + .6 * q);
      g.globalAlpha = .27 * Math.min(1, p.age / .35) * Math.pow(1 - q, 1.4) * edge(p.y, rad * .4, h) * side(p.x);
      g.drawImage(img, p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    g.fillStyle = "rgb(255,252,246)";
    for (const p of drops) {
      p.age += dt; if (p.age >= p.life) continue; alive++; if (p.age < 0) continue;
      p.x += (p.vx + Math.sin(p.ph + p.age * 5) * 9) * dt; p.y += p.vy * dt; const q = p.age / p.life;
      g.globalAlpha = .8 * Math.min(1, p.age / .15) * Math.pow(1 - q, 1.2) * edge(p.y, p.r, h) * side(p.x); if (g.globalAlpha <= 0) continue;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
    }
    return alive > 0;
  }, true);
}

const ACT = {
  // scent in the air: a fine mist drifts down through the whole tile and thins out, and the light runs once across the bottle.
  cologne({ layer, img, K, P, pin, move }) {
    pin((K.l + K.r) / 2, K.b);
    const up = [{ transform: turn(0, 0), easing: ENTER }, { transform: turn(0, -7), offset: .3, easing: SINE }, { transform: turn(0, 0), offset: .75, easing: SINE }, { transform: turn(0, -1.5), offset: .88, easing: SINE }, { transform: turn(0, 0) }];
    move(up, 900, T0 - 120);
    when(layer, T0 - 60, () => veil(layer));
    play(glint(layer, img, P, T0 + 260, 900), up, 900, T0 - 120, "none");   // the light is cut to the bottle, so it rides with the bottle
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
new MutationObserver(place).observe(document.getElementById("main"), { childList: true });
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
  old.remove(); live = null; playedKey = ""; again = true; try { place(); } finally { again = false; }
});
place();
