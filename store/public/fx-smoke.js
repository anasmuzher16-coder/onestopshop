// 05 smoke. One canvas, three placements:
//   the hookah section's header: a low bank of smoke rolls in from the left the moment the page opens, carrying
//     its texture with it, lit from behind, and settles into a thin bank gathered round the hookah;
//   a product stage: one column rising behind the piece (heavier for hookahs, with smoke pooled along the floor;
//     none for cologne and misc);
//   the home hero: one column up the middle slab, behind the pieces, once the pieces have landed.
// Plus a short puff when a piece lands in the cart.
// A small fragment shader on a low-resolution canvas between the colour and the type or cut-out, so it never
// crosses a word or a price label. No library, no blend modes. Timed by the clock, so a phone that halves its
// frame rate shows the same motion. With motion turned off it is shown settled. Where the phone cannot draw it
// live (no context, no high precision, a lost context that does not come back) two drifting stills stand in.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const SIZE = { bank: [320, 72], stage: [176, 220], hero: [176, 220] }; // drawn small and scaled up: smoke is soft
const FRAG = `
#ifndef GL_FRAGMENT_PRECISION_HIGH
#error high precision needed
#endif
precision highp float;
uniform vec2 r; uniform float t; uniform vec2 src; uniform float mode; uniform float roll; uniform float asp; uniform float gain; uniform float grow;
float h(vec2 p){ p = mod(p, 256.0); p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1.0,0.0)), f.x), mix(h(i+vec2(0.0,1.0)), h(i+vec2(1.0,1.0)), f.x), f.y); }
float f2(vec2 p){ return 0.5 * n(p) + 0.25 * n(p * 2.03 + vec2(17.3, 9.1)); }            // two octaves
float o3(vec2 p){ return 0.125 * n(p * 4.1209 + vec2(52.419, 27.573)); }                  // the third
float o4(vec2 p){ return 0.0625 * n(p * 8.3654 + vec2(123.711, 65.073)); }                // the fourth
// BANK: thickness of a low body of smoke. xf = where its front is (0..1 across the band), st = 0 arriving .. 1 settled.
float bk(vec2 uv, float xf, float st, float fine){
  // the smoke is carried with the front (0.8 of its travel), the top lagging the bottom a little so it rolls
  vec2 p = vec2((uv.x - xf * 0.8) * asp + 0.5 * uv.y * (1.0 - exp(-roll * 0.8)) - t * 0.035, uv.y - t * 0.012) * 1.45;
  vec2 w = vec2(f2(p * 0.7 + vec2(0.0, t * 0.045)), f2(p * 0.7 + vec2(5.2 - t * 0.035, 1.3)));   // slow swirl
  vec2 q = p + 1.0 * w;
  float d = f2(q); if (fine > 0.5) d += o3(q);
  float s = (xf - uv.x) * asp + (d - 0.5) * 0.9 + (w.y - 0.5) - (1.0 - uv.y) * 0.25;   // band-heights behind the front, with lobes
  float head = 0.95 * smoothstep(-0.12, 0.6, s) * mix(1.0, 0.653, smoothstep(0.6, 2.1, s));   // raised head, lower body behind it
  float rest = (0.56 + (w.x - 0.5) * 0.5 + 0.16 * smoothstep(src.x - 0.36, src.x + 0.09, uv.x)) * smoothstep(-0.2, 0.4, s);   // settled: low, gathered round the hookah
  float top = mix(head, rest, st) + (d - 0.5) * 0.55 + (w.x - 0.4) * 0.3;                                   // the billowing upper surface
  float T = smoothstep(0.0, 0.6, top - uv.y) * mix(0.35, 1.0, smoothstep(0.2, 0.8, w.y + (d - 0.5) * 0.6));
  T += 0.10 * smoothstep(0.3, 0.8, w.x) * smoothstep(-0.1, 0.5, s) * (1.0 - uv.y * 0.5);   // a thin veil above the body
  return T * mix(1.0, 0.9 * mix(0.8, 1.0, smoothstep(0.15, 0.7, uv.x)), st);              // thins as it settles, a little more under the title
}
// PLUME: thickness of one column rising from src. Shape and texture are both functions of (height - rise), so they travel together.
float pl(vec2 uv, float fine){
  vec2 q = vec2((uv.x - src.x) * asp, uv.y - src.y);
  float up = clamp(q.y / (1.0 - src.y), 0.0, 1.0);
  float turb = smoothstep(0.10, 0.35, up);                       // a smooth thread for the first tenth, then it breaks up
  float ph = q.y - t * 0.075;
  vec2 p = vec2(q.x * 4.5, ph * 2.7);
  vec2 w = vec2(f2(p * 0.8 + vec2(0.0, 3.0 + t * 0.03)), f2(p * 0.8 + vec2(5.2, 1.3 - t * 0.02)));
  vec2 g = p + w * turb;
  float d = f2(g); if (fine > 0.5) d += o3(g) + o4(g);
  float sway = (n(vec2(ph * 2.6, 3.1)) - 0.5) * up * (0.3 + 0.7 * turb);
  float width = mix(0.03, 0.2, pow(up, 1.3));
  float x = (q.x - sway - (w.x - 0.5) * 0.5 * turb * up) / width;
  float puff = mix(1.0, smoothstep(0.2, 0.75, n(vec2(ph * 1.5 + 7.0, 7.1))), 0.45 * turb);   // it leaves in slow breaths
  float body = mix(1.0, smoothstep(0.3, 0.7, d), 0.15 + 0.85 * turb);
  float thin = clamp(mix(1.0, 0.18 / width, 0.55), 0.0, 1.0);    // the same smoke over more width
  float fade = smoothstep(0.0, 0.035, q.y) * (1.0 - smoothstep(0.6, 1.0, up)) * (1.0 - smoothstep(grow - 0.3, grow, up));
  float T = exp(-x * x) * body * puff * thin * fade * gain;
  // hookahs only (gain above 1): smoke pooled along the floor of the tile
  T += 1.1 * clamp(gain - 1.0, 0.0, 1.0) * (1.0 - smoothstep(0.0, 0.2 + (w.x - 0.5) * 0.25, uv.y)) * smoothstep(0.25, 0.75, d + (w.y - 0.5) * 0.5 + 0.1);
  return T;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  float T, T2, k, amax;
  if (mode > 0.5) {
    float xf = 1.32 * (1.0 - exp(-roll / (0.6 + 0.1 * asp))) - 0.08;   // fast in, slowing; a wider band takes a little longer (0.94 s time constant on a phone, 1.18 s on a desktop)
    float st = smoothstep(2.0, 6.5, roll);
    T = bk(uv, xf, st, 1.0) * gain; T2 = bk(uv + vec2(0.10 / asp, 0.14), xf, st, 0.0) * gain;   // second sample: a step toward the light, up and right
    k = 2.4; amax = 0.9 * smoothstep(0.0, 0.05, uv.y + 0.03);
  } else {
    T = pl(uv, 1.0); T2 = pl(uv + vec2(0.05 / asp, 0.08), 0.0);
    k = 2.2; amax = 0.8;
  }
  float a = 1.0 - exp(-k * T);                                   // thickness to opacity: never a flat white slab
  float lit = clamp(0.5 + (T - T2) * 3.5, 0.0, 1.0);             // 1 where the smoke thins toward the light: a bright rim
  float kk = clamp(lit + (1.0 - smoothstep(0.3, 1.0, a)) * 0.25, 0.0, 1.0);
  vec3 c = mix(vec3(0.87, 0.80, 0.795), vec3(1.0, 0.985, 0.955), kk);   // shaded core .. warm white edge
  a = clamp(a * amax + (h(gl_FragCoord.xy) - 0.5) / 255.0, 0.0, 1.0) * step(0.004, a);   // one level of fixed grain so the upscale does not band
  gl_FragColor = vec4(c * a, a);                                  // premultiplied
}`;
const cv = document.createElement("canvas"); cv.width = 176; cv.height = 220; cv.className = "smoke"; cv.setAttribute("aria-hidden", "true");
let gl = null, U = {}, raf = 0, t0 = performance.now(), placedAt = performance.now(), seen = false, lost = false, conf = null, fixedRoll = null, lastDraw = 0;
function setup() {
  if (new URLSearchParams(location.search).has("still")) return false; // lets us look at the fallback on any device
  const g = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!g) return false;
  const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null; };
  // the fragment shader refuses to compile without high precision (the noise needs it), which sends that phone to the stills
  const vs = sh(g.VERTEX_SHADER, "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }"), fs = sh(g.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return false;
  const prog = g.createProgram(); g.attachShader(prog, vs); g.attachShader(prog, fs); g.linkProgram(prog);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) return false;
  g.useProgram(prog);
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer()); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  const a = g.getAttribLocation(prog, "a"); g.enableVertexAttribArray(a); g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
  for (const k of ["r", "t", "src", "mode", "roll", "asp", "gain", "grow"]) U[k] = g.getUniformLocation(prog, k);
  g.clearColor(0, 0, 0, 0); gl = g;
  if (conf) apply();
  return true;
}
// size the canvas for where it is going, and tell the shader the real shape of that place
function apply() {
  const [w, h] = SIZE[conf.kind];
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(U.r, w, h); gl.uniform2f(U.src, conf.src[0], conf.src[1]); gl.uniform1f(U.mode, conf.mode); gl.uniform1f(U.asp, conf.asp); gl.uniform1f(U.gain, conf.gain);
}
function draw(now) {
  raf = 0; if (!gl || lost || !cv.isConnected) return;
  const still = RM.matches, s = Math.max(0, (now - placedAt - conf.wait) / 1000); // seconds since this placement's act began
  // once the smoke has arrived it only drifts: half the frames are enough, and it costs half as much
  if (!still && s > (conf.kind === "bank" ? 7 : 5) && now - lastDraw < 30) { raf = requestAnimationFrame(draw); return; }
  lastDraw = now;
  gl.uniform1f(U.roll, fixedRoll !== null ? fixedRoll : still ? 9 : s);
  gl.uniform1f(U.grow, still || conf.kind === "bank" ? 1.3 : 1.3 * (1 - Math.exp(-1.5 * s))); // the column climbs from its source
  gl.uniform1f(U.t, ((now - t0) / 1000) % 3600 + 40); // the clock wraps each hour, so the noise never loses its footing
  gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (!still && seen && !document.hidden) raf = requestAnimationFrame(draw);
}
const kick = () => { if (!raf && gl && !lost && cv.isConnected) raf = requestAnimationFrame(draw); };
// The layer behind the piece: the live canvas, or two drifting stills where the phone cannot draw it.
let layer = cv;
function still() { layer = document.createElement("span"); layer.className = "smoke smoke--still"; layer.setAttribute("aria-hidden", "true"); layer.append(document.createElement("i"), document.createElement("i")); }
function toStills() { // the live canvas is not coming back: stand the stills in where it was
  const host = cv.parentNode; cv.remove(); gl = null; still();
  if (host) { key = ""; place(); }
}
let lostTimer = 0;
cv.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; clearTimeout(lostTimer); lostTimer = setTimeout(() => { if (lost) toStills(); }, 2000); });
cv.addEventListener("webglcontextrestored", () => { clearTimeout(lostTimer); lost = false; gl = null; if (setup()) kick(); else toStills(); });
const io = new IntersectionObserver(es => { seen = es.some(e => e.isIntersecting); if (seen) kick(); });
const ro = window.ResizeObserver ? new ResizeObserver(() => { if (!conf || !layer.isConnected) return; const tg = target(); if (tg && tg.el === conf.el) { conf.asp = tg.asp; conf.src = tg.src; if (gl) apply(); kick(); } }) : null;
document.addEventListener("visibilitychange", kick); RM.addEventListener("change", kick);

// Where the smoke belongs on the page that is showing, and how strong it is there.
const SMOKY = { hookahs: 1.35, bases: 0.8, bowls: 0.8, heat: 0.95, hoses: 0.8, parts: 0.7 };
function target() {
  const shape = e => e.clientWidth / Math.max(1, e.clientHeight);
  const head = document.querySelector('.shophead[data-cat="hookahs"]');
  if (head) { const o = head.querySelector(".fx-obj"), a = head.getBoundingClientRect(), b = o && o.getBoundingClientRect(); // the bank gathers round the hookah drawing
    return { el: head, kind: "bank", mode: 1, gain: 1, wait: 250, src: [b ? (b.left + b.width / 2 - a.left) / a.width : 0.86, 0.2], asp: shape(head) }; }
  const stage = document.querySelector("[data-stage]:not(.tile--photo)"), cat = stage && stage.closest("[data-cat]")?.dataset.cat;
  if (stage && SMOKY[cat]) return { el: stage, kind: "stage", mode: 0, gain: SMOKY[cat], wait: 450, src: [0.5, 0.2], asp: shape(stage) };
  const hero = document.querySelector(".hero__stage");
  if (hero) return { el: hero, kind: "hero", mode: 0, gain: 1, wait: 500, src: [0.5, 0.04], asp: shape(hero), before: hero.querySelector(".hero__pieces") };
  return null;
}
// The page re-draws itself on every change, so the one layer is moved into whichever spot is on screen. A re-draw
// of the same page (add to cart, a quantity change) changes nothing a shopper can see: no fade, no restart.
let key = "";
function place() {
  const tg = target();
  if (!tg) { if (layer.isConnected) { layer.remove(); layer.classList.remove("on"); } key = ""; conf = null; return; }
  if (layer.parentNode === tg.el) return;
  const k = tg.kind + "|" + location.pathname, fresh = k !== key; key = k; conf = tg;
  layer.classList.toggle("smoke--hero", tg.kind === "hero"); layer.classList.toggle("smoke--bank", tg.kind === "bank");
  if (fresh) layer.classList.remove("on");
  if (tg.before) tg.el.insertBefore(layer, tg.before); else tg.el.prepend(layer);
  if (gl) apply();
  if (fresh) placedAt = performance.now(); // a new page: the bank rolls in, the column climbs
  seen = false; io.disconnect(); io.observe(layer); if (ro) { ro.disconnect(); ro.observe(tg.el); }
  if (fresh) requestAnimationFrame(() => layer.classList.add("on")); else layer.classList.add("on");
  kick();
}
if (!setup()) still();
new MutationObserver(place).observe(document.getElementById("main"), { childList: true }); place();
if (gl) window.__smoke = { canvas: cv, at: s => { t0 = performance.now() - (s - 40) * 1000; }, roll: v => { fixedRoll = v; } }; // for the frame-capture tool

// Cart puff: it bursts outward in a fan where the piece lands, then lifts and thins. Transform and opacity only.
addEventListener("cartlanded", e => {
  if (RM.matches) return;
  const r = e.detail && e.detail.rect; if (!r) return;
  for (let i = 0; i < 7; i++) {
    const d = document.createElement("span"); d.className = "puff"; const size = 16 + Math.random() * 26;
    d.style.cssText = `left:${r.left + r.width / 2 - size / 2}px;top:${r.top + r.height / 2 - size / 2}px;width:${size}px;height:${size}px`;
    document.body.append(d);
    const a = -Math.PI / 2 + (i - 3) * 0.42 + (Math.random() - 0.5) * 0.3, out = 14 + Math.random() * 16; // a fan of about 145 degrees, centred straight up
    const mx = Math.cos(a) * out, my = Math.sin(a) * out, dx = mx * 1.6 + (Math.random() - 0.5) * 14, dy = my - (30 + Math.random() * 36);
    d.animate([{ transform: "translate(0,0) scale(.3)", opacity: 0 }, { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: .6, offset: .22 }, { transform: `translate(${dx}px,${dy}px) scale(2.1)`, opacity: 0 }],
      { duration: 700 + Math.random() * 300, delay: i * 30, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" }).onfinish = () => d.remove();
  }
});
