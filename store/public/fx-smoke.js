// 05 smoke. Three placements, one canvas:
//   a section header: on the hookah page a bank of smoke rolls in from the left when the page opens, then thins
//     to a slow drift;
//   a product stage: one thin wisp behind the piece (stronger for hookahs, none for cologne and misc);
//   the home hero: one wisp up the middle slab, behind the pieces.
// Plus a short puff when a piece lands in the cart.
// Drawn by a small fragment shader on a low-resolution canvas that sits between the colour and the cut-out or
// type, so it never crosses a word or a price label. No library, no blend modes. Timed by the clock, so a phone
// that halves its frame rate (Low Power Mode) shows the same motion. Still frame when motion is turned off; two
// drifting stills where the phone cannot draw it live.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const W = 176, H = 220; // drawn small, scaled up by CSS: smoke is soft, so the upscale costs nothing visible
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r; uniform float t; uniform vec2 src; uniform float mode; uniform float roll; uniform float asp; uniform float gain;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1.0,0.0)), f.x), mix(h(i+vec2(0.0,1.0)), h(i+vec2(1.0,1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  float a;
  if (mode > 0.5) {
    // a bank of smoke filling a wide band: rolls in from the left, heavier along the bottom, then settles
    vec2 p = vec2(uv.x * asp, uv.y) * 1.9; p.x -= t * 0.06 + 1.2 * (1.0 - exp(-roll * 1.1)); p.y -= t * 0.022;   // the body is carried in with the front, not uncovered by it
    vec2 w = vec2(fbm(p + vec2(0.0, t * 0.03)), fbm(p + vec2(5.2, 1.3) - vec2(t * 0.025, 0.0)));
    float body = smoothstep(0.34, 0.82, fbm(p + 2.4 * w));
    float strand = pow(1.0 - abs(2.0 * fbm(p * 1.6 + 3.0 * w) - 1.0), 3.0);
    float low = 1.0 - smoothstep(0.1, 1.0, uv.y);
    float front = roll * 0.8 - 0.04 + (fbm(vec2(uv.y * 3.0, t * 0.5)) - 0.5) * 0.36;   // the billowing leading edge
    float reveal = 1.0 - smoothstep(front - 0.42, front + 0.04, uv.x);
    float surge = mix(1.0, 0.4, smoothstep(1.8, 4.0, roll));                            // thick on arrival, then it thins
    float lead = exp(-pow((uv.x - front) / 0.16, 2.0)) * (1.0 - smoothstep(1.6, 2.6, roll)) * 0.35;  // brighter where it is still arriving
    a = clamp(((body * 0.88 + strand * 0.15) * mix(0.5, 1.0, low) + lead) * reveal, 0.0, 1.0) * surge * 0.9 * smoothstep(0.0, 0.12, uv.y);
  } else {
    vec2 q = vec2((uv.x - src.x) * r.x / r.y, uv.y - src.y);      // centred on where the smoke starts
    float up = clamp(q.y / (1.0 - src.y), 0.0, 1.0);               // 0 at the source, 1 at the top edge
    vec2 p = vec2(q.x, q.y) * 2.6; p.y -= t * 0.085;                // everything rises
    vec2 w = vec2(fbm(p + vec2(0.0, t * 0.021)), fbm(p + vec2(5.2, 1.3) - vec2(0.0, t * 0.017)));
    float sway = (fbm(vec2(q.y * 1.7 - t * 0.06, 3.1)) - 0.5) * 0.55 * up;   // the column wanders as it climbs
    float width = mix(0.045, 0.34, pow(up, 0.8));                   // thin at the source, opening out
    float col = exp(-pow((q.x - sway) / width, 2.0));               // the plume
    float body = smoothstep(0.38, 0.8, fbm(p + 2.3 * w));
    float strand = pow(1.0 - abs(2.0 * fbm(p * 1.7 + 3.0 * w) - 1.0), 6.0);  // the bright curling edges
    float fade = smoothstep(0.0, 0.07, q.y) * (1.0 - smoothstep(0.55, 1.0, up));
    a = clamp((body * 0.62 + strand * 0.5) * col * fade * gain, 0.0, 1.0) * 0.8;
  }
  gl_FragColor = vec4(vec3(1.0, 0.985, 0.955) * a, a);            // warm white, premultiplied
}`;
const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.className = "smoke"; cv.setAttribute("aria-hidden", "true");
let gl, prog, U = {}, raf = 0, t0 = performance.now(), placedAt = performance.now(), seen = false, lost = false, conf = null, fixedRoll = null;
function setup() {
  if (new URLSearchParams(location.search).has("still")) return false; // lets us look at the fallback on any device
  gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return false;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }"), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return false;
  prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  for (const k of ["r", "t", "src", "mode", "roll", "asp", "gain"]) U[k] = gl.getUniformLocation(prog, k);
  gl.uniform2f(U.r, W, H); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0);
  if (conf) apply();
  return true;
}
function apply() { gl.uniform2f(U.src, conf.src[0], conf.src[1]); gl.uniform1f(U.mode, conf.mode); gl.uniform1f(U.asp, conf.asp); gl.uniform1f(U.gain, conf.gain); }
function draw(now) {
  raf = 0; if (lost || !cv.isConnected) return;
  // with motion turned off the bank is shown already settled; otherwise it rolls in from the moment it was placed
  gl.uniform1f(U.roll, fixedRoll !== null ? fixedRoll : RM.matches ? 9 : (now - placedAt) / 1000);
  gl.uniform1f(U.t, (now - t0) / 1000 + 40); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (!RM.matches && seen && !document.hidden) raf = requestAnimationFrame(draw);
}
const kick = () => { if (!raf && gl && !lost && cv.isConnected) raf = requestAnimationFrame(draw); };
// The layer that goes behind the piece: the live canvas, or two drifting stills where the phone cannot draw it.
let layer = cv;
function still() { layer = document.createElement("span"); layer.className = "smoke smoke--still"; layer.setAttribute("aria-hidden", "true"); layer.append(document.createElement("i"), document.createElement("i")); }
cv.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; });
cv.addEventListener("webglcontextrestored", () => { lost = false; if (setup()) kick(); });
const io = new IntersectionObserver(es => { seen = es.some(e => e.isIntersecting); if (seen) kick(); });
document.addEventListener("visibilitychange", kick); RM.addEventListener("change", kick);

// Where the smoke belongs on the page that is showing, and how strong it is there.
const SMOKY = { hookahs: 1.35, bases: 0.8, bowls: 0.8, heat: 0.95, hoses: 0.8, parts: 0.7 };
function target() {
  const head = document.querySelector('.shophead[data-cat="hookahs"]');
  if (head) return { el: head, kind: "bank", mode: 1, gain: 1, src: [0.5, 0.2], asp: Math.max(0.6, head.clientWidth / Math.max(1, head.clientHeight)) * (H / W) };
  const stage = document.querySelector("[data-stage]:not(.tile--photo)"), cat = stage && stage.closest("[data-cat]")?.dataset.cat;
  if (stage && SMOKY[cat]) return { el: stage, kind: "stage", mode: 0, gain: SMOKY[cat], src: [0.5, 0.2], asp: 1 };
  const hero = document.querySelector(".hero__stage");
  if (hero) return { el: hero, kind: "hero", mode: 0, gain: 1, src: [0.5, 0.04], asp: 1, before: hero.querySelector(".hero__pieces") };
  return null;
}
// The page re-draws itself on every change, so the one layer is moved into whichever spot is on screen.
let key = "";
function place() {
  const tg = target();
  if (!tg) { if (layer.isConnected) { layer.remove(); layer.classList.remove("on"); } key = ""; return; }
  if (layer.parentNode === tg.el) return;
  const k = tg.kind + "|" + location.pathname, fresh = k !== key; key = k; conf = tg;
  layer.classList.remove("on"); layer.classList.toggle("smoke--hero", tg.kind === "hero"); layer.classList.toggle("smoke--bank", tg.kind === "bank");
  if (tg.before) tg.el.insertBefore(layer, tg.before); else tg.el.prepend(layer);
  if (gl) apply();
  if (fresh) placedAt = performance.now(); // a new page: the bank rolls in again. A re-draw of the same page does not restart it.
  io.disconnect(); io.observe(layer);
  requestAnimationFrame(() => layer.classList.add("on")); kick();
}
const live = setup(); if (!live) still();
new MutationObserver(place).observe(document.getElementById("main"), { childList: true }); place();
if (live) window.__smoke = { canvas: cv, at: s => { t0 = performance.now() - (s - 40) * 1000; }, roll: v => { fixedRoll = v; },
  frame: s => { gl.uniform1f(U.mode, 0); gl.uniform1f(U.gain, 1); gl.uniform1f(U.t, s); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); const d = cv.toDataURL("image/png"); if (conf) apply(); return d; } };

// Cart puff: a few soft blobs lift off the cart count when a piece lands. Transform and opacity only.
addEventListener("cartlanded", e => {
  if (RM.matches) return;
  const r = e.detail && e.detail.rect; if (!r) return;
  for (let i = 0; i < 5; i++) {
    const d = document.createElement("span"); d.className = "puff"; const size = 18 + Math.random() * 22;
    d.style.cssText = `left:${r.left + r.width / 2 - size / 2}px;top:${r.top + r.height / 2 - size / 2}px;width:${size}px;height:${size}px`;
    document.body.append(d);
    const dx = (Math.random() - 0.5) * 46, dy = -(34 + Math.random() * 44);
    d.animate([{ transform: "translate(0,0) scale(.4)", opacity: 0 }, { opacity: .5, offset: .25 }, { transform: `translate(${dx}px,${dy}px) scale(1.9)`, opacity: 0 }],
      { duration: 760 + Math.random() * 380, delay: i * 45, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }).onfinish = () => d.remove();
  }
});
