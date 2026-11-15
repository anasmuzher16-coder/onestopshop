// PASTE-READY (fx-sections.js). Uses the file's own helpers: el(tag, cls, parent), rnd(a, b).
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
    if (tick(g, dt)) requestAnimationFrame(frame); else cv.remove();
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
  const vents = [[0.36, 0.5], [0.64, 0.5], [0.5, 0.37], [0.5, 0.31]], ps = [], glow = soft("214,51,38");
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
    const y = by + 0.31 * b.height, H = Math.max(26, y - 4) * rnd(0.8, 1);   // uses all the room there is above the rim
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
