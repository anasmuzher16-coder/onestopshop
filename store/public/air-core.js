// The air's drawing, shared by the worker (fx-air-worker.js, the usual path: the main thread never pays for it, so a page swap
// cannot stall the dust and the dust cannot stall a swap) and the page itself (fx-air.js, for a browser without OffscreenCanvas).
// It knows nothing of the page: it is told the size, which air to show, whether it bursts from the section's object, and the time.
export const P = {
  bases: { sprite: "ring", rgb: [158, 236, 226], n: 150, r: [1.6, 5.2], a: [.16, .5], vx: 3, vy: [-27, -9], life: [7, 15], sway: 7, haze: .014 },
  bowls: { sprite: "dot", rgb: [206, 204, 198], n: 260, r: [.28, 1.25], a: [.16, .56], vx: 6, vy: [-11, -3], life: [6, 14], sway: 11, haze: .016 },
  heat: { sprite: "dot", rgb: [255, 150, 66], n: 190, r: [.45, 1.8], a: [.32, .9], vx: 6, vy: [-27, -8], life: [4, 10], sway: 9, haze: .016, flicker: 1.8 },
  charcoal: { sprite: "dot", rgb: [255, 112, 44], n: 130, r: [.4, 1.5], a: [.26, .85], vx: 4, vy: [-18, -5], life: [5, 12], sway: 6, haze: .015, flicker: 2.4 },   // deeper, slower sparks off lit coals
  hoses: { threads: 14, rgb: [132, 232, 176], haze: .012 },
  parts: { sprite: "star", rgb: [244, 208, 122], n: 46, r: [.7, 2.2], a: [.22, .85], vx: .8, vy: [-1.2, 1.2], life: [5, 11], sway: 1.5, haze: .012, flicker: .9, peak: 8 },
  misc: { sprite: "dot", rgb: [238, 226, 204], n: 140, r: [.5, 2.4], a: [.08, .3], vx: 7, vy: [-4, 7], life: [7, 16], sway: 8, haze: .014 },
  house: { sprite: "dot", rgb: [236, 222, 200], n: 120, r: [.5, 2.2], a: [.08, .3], vx: 6, vy: [-8, -1], life: [7, 16], sway: 7, haze: .013 },
  calm: { sprite: "dot", rgb: [226, 216, 200], n: 110, r: [.28, 1], a: [.09, .3], vx: 3.5, vy: [-4, -.5], life: [9, 18], sway: 4, haze: .007 },
};
// how present the air is: every section carries the same weight as the hookah smoke and cologne mist; the quiet pages stay quiet
for (const k in P) { const c = P[k], m = k === "calm" ? 1.3 : 1; if (c.n) { c.n = Math.round(c.n * (k === "calm" ? 1.4 : 1.8)); c.a = [c.a[0] * 1.2 * m / (k === "calm" ? 1.3 : 1), Math.min(.95, c.a[1] * 1.25)]; } c.haze *= k === "calm" ? 1.6 : 2.7; }
const rnd = (a, b) => a + Math.random() * (b - a);

// canvas: the visible canvas (an OffscreenCanvas in the worker); make(n): a fresh n x n canvas for the sprites
export function makeAir(canvas, make) {
  const g = canvas.getContext("2d"); if (!g) return null;
  let now0 = 0, kind = null, want = null, burst = false, origin = null, w = 0, h = 0, drops = [], veil = [], lines = [], img = null, glow = null, odd = false, prev = 0, slowN = 0, limit = 1, level = 0, born = 0, surge = 0, onKind = null, half = false;
  function sprite(type, [r, gr, b]) {
    const s = make(32), x = s.getContext("2d"), c = a => `rgba(${r},${gr},${b},${a})`;
    if (type === "ring") { x.strokeStyle = c(.85); x.lineWidth = 2.2; x.beginPath(); x.arc(16, 16, 12, 0, 6.283); x.stroke(); const f = x.createRadialGradient(16, 16, 2, 16, 16, 13); f.addColorStop(0, c(0)); f.addColorStop(1, c(.2)); x.fillStyle = f; x.beginPath(); x.arc(16, 16, 12, 0, 6.283); x.fill(); x.fillStyle = c(.95); x.beginPath(); x.arc(11.5, 11, 1.9, 0, 6.283); x.fill(); }
    else if (type === "star") { const f = x.createRadialGradient(16, 16, 0, 16, 16, 8); f.addColorStop(0, c(.9)); f.addColorStop(1, c(0)); x.fillStyle = f; x.fillRect(0, 0, 32, 32); x.fillStyle = c(1); x.beginPath(); for (const [px, py] of [[16, 0], [17.4, 14.6], [32, 16], [17.4, 17.4], [16, 32], [14.6, 17.4], [0, 16], [14.6, 14.6]]) x.lineTo(px, py); x.closePath(); x.fill(); }
    else { const f = x.createRadialGradient(16, 16, 0, 16, 16, 16); f.addColorStop(0, c(1)); f.addColorStop(.42, c(.6)); f.addColorStop(1, c(0)); x.fillStyle = f; x.fillRect(0, 0, 32, 32); }
    return s;
  }
  function seat(p, c, t, first) {
    const u = Math.random(); p.x = rnd(-.03, 1.03) * w; p.y = rnd(-.03, 1.03) * h; p.vx = rnd(-c.vx, c.vx); p.vy = rnd(c.vy[0], c.vy[1]); p.r = c.r[0] + (c.r[1] - c.r[0]) * u * u * u; if (c.sprite === "ring") p.vy = -(7 + p.r * 3.8); p.a = rnd(c.a[0], c.a[1]);
    p.life = rnd(c.life[0], c.life[1]); p.born = first ? t - rnd(0, p.life) : t + rnd(0, 900); p.ph = rnd(0, 6.28); p.tw = rnd(.5, 1.7); p.sw = rnd(.3, 1) * c.sway; p.fly = 0;
  }
  function fill(k, b, t) {
    const c = P[k], scale = Math.max(.7, Math.min(2.4, w * h / (390 * 844)));
    surge = b ? 1 : 0; img = c.sprite ? sprite(c.sprite, c.rgb) : null; glow = sprite("dot", c.rgb); drops = []; lines = []; limit = 1;
    if (c.n) { const n = Math.round(c.n * scale), ox = origin ? origin[0] : w * .75, oy = origin ? origin[1] : h * .22;
      for (let i = 0; i < n; i++) { const p = {}; seat(p, c, t, !b); if (b && i % 2) { p.born = t + rnd(380, 900); p.fly = rnd(2.2, 4); p.ox = ox; p.oy = oy; p.life = Math.max(p.life, 6); } drops.push(p); } }
    if (c.threads) for (let i = 0; i < Math.round(c.threads * Math.min(1.7, scale)); i++) lines.push({ x: rnd(-.05, 1.05), amp: rnd(.03, .09), f: rnd(.7, 1.8), sp: rnd(.08, .24), f2: rnd(1.6, 3), sp2: rnd(.05, .17), dr: rnd(.004, .016) * (Math.random() < .5 ? -1 : 1), ph: rnd(0, 6.28), a: rnd(.16, .44), lw: rnd(.6, 1.6) });
    veil = []; for (let i = 0; i < 12; i++) veil.push({ x: Math.random(), y: Math.random(), r: rnd(.16, .32), vx: rnd(-.005, .005), vy: rnd(-.006, .003), ph: rnd(0, 6.28) });
  }
  function draw(t) {
    const c = P[kind], s = (t - now0) / 1000, big = Math.max(w, h); g.clearRect(0, 0, w, h);
    for (const v of veil) { const x = ((v.x + v.vx * s) % 1.3 + 1.3) % 1.3 - .15, y = ((v.y + v.vy * s) % 1.3 + 1.3) % 1.3 - .15, z = v.r * big; g.globalAlpha = (c.haze + c.haze * .35 * Math.sin(s * .2 + v.ph)) * level * (1 + 1.9 * surge * Math.max(0, 1 - s / 4.6)); g.drawImage(glow, x * w - z, y * h - z, z * 2, z * 2); }
    if (lines.length) { g.strokeStyle = `rgb(${c.rgb})`; g.lineCap = "round"; for (const l of lines) { g.lineWidth = l.lw; g.globalAlpha = l.a * level * (.72 + .28 * Math.sin(s * .19 + l.ph)); g.beginPath();
      for (let i = 0; i <= 48; i++) { const q = i / 48 * 1.12 - .06, b = ((l.x + l.dr * s) % 1.5 + 1.5) % 1.5 - .25, x = b * w + (l.amp * Math.sin(q * l.f * 3.14 + s * l.sp + l.ph) + l.amp * .3 * Math.sin(q * l.f2 * 3.14 - s * l.sp2 + l.ph * 2)) * Math.min(w, 520); if (i) g.lineTo(x, q * h); else g.moveTo(x, q * h); } g.stroke(); } }
    const n = Math.round(drops.length * limit);
    for (let i = 0; i < n; i++) { const p = drops[i], age = (t - p.born) / 1000; if (age < 0) continue; if (age >= p.life) { seat(p, c, t, false); continue; }
      const q = age / p.life, fade = Math.min(1, q / .14) * Math.min(1, (1 - q) / .22), shine = c.peak ? Math.abs(Math.sin(p.ph + s * c.flicker * p.tw)) ** c.peak : c.flicker ? .5 + .5 * Math.sin(p.ph + s * c.flicker * p.tw) ** 2 : .74 + .26 * Math.sin(p.ph + s * p.tw), e = p.fly ? 1 - Math.exp(-p.fly * age) : 1;
      const dx = p.vx * age + Math.sin(p.ph + age * .6) * p.sw, dy = p.vy * age + Math.cos(p.ph + age * .44) * p.sw * .45, x = (p.fly ? p.ox + (p.x - p.ox) * e : p.x) + dx, y = (p.fly ? p.oy + (p.y - p.oy) * e : p.y) + dy, z = p.r * (c.sprite === "ring" ? 1 : 2.4);
      g.globalAlpha = p.a * fade * shine * level; g.drawImage(img, x - z, y - z, z * 2, z * 2); }
    g.globalAlpha = 1;
  }
  return {
    get kind() { return kind; },
    set onKind(f) { onKind = f; },
    // css size and pixel ratio; the phone address bar moving is not a new page: nothing reshuffles
    size(nw, nh, d) { if (canvas.width > 2 && w === nw && Math.abs(h - nh) <= 140) return false; w = nw; h = nh; canvas.width = Math.round(nw * d); canvas.height = Math.round(nh * d); g.setTransform(d, 0, 0, d, 0, 0); if (kind) fill(kind, false, prev || 0); else if (want && w) { kind = want; fill(kind, burst, prev || 0); level = 0; onKind?.(kind, burst); } return true; },
    // which air comes next; b: it flies out of the section's object at [x, y] the first time a section opens
    want(k, b, o) { want = k; burst = !!b; origin = o || null; if (!kind && w) { kind = k; fill(k, burst, prev || 0); level = 0; onKind?.(kind, burst); } },
    // the section's object is drawn a moment after the page changes: its place arrives here before the old air has thinned away
    origin(o) { origin = o || null; },
    start(t) { now0 = born = prev = t; },
    // one frame at time t: the old air thins away, the next comes up, and once settled it draws every other frame
    // wave: the page's transition, { phase, p }, or null. Under a wave the air draws every other frame, and not at all under its full
    // body (docs/TRANSITIONS-PERF.md): the GPU goes to the wave.
    frame(t, wave) {
      if (!w || !kind) { prev = t; return; }
      if (wave) { half = !half; if (half || wave.phase === "cover" && wave.p > .92) return; }
      if (want !== kind) { level = Math.max(0, level - (t - prev) / 180); if (level <= 0) { kind = want; fill(kind, burst, t); now0 = t; born = t; onKind?.(kind, burst); } }
      else level = Math.min(1, level + Math.max(0, t - prev) / 450);
      odd = !odd; if (t - born > 4200 && odd && want === kind && level >= 1) return;
      const ms = t - prev; prev = t; slowN = ms > 80 ? slowN + 1 : Math.max(0, slowN - 2); if (slowN > 40) { slowN = 0; limit = Math.max(.4, limit * .75); }
      draw(t);
    },
    // back from another app: the clock skips the time away, so the field carries on instead of all expiring and regrowing
    shift(gap) { now0 += gap; born += gap; prev += gap; for (const p of drops) p.born += gap; },
  };
}
