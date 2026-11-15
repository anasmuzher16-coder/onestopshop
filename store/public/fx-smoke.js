// 05 smoke: one thin, slow wisp behind the piece on its own page, and a short puff when a piece lands in the cart.
// Drawn by a small fragment shader on a low-resolution canvas that sits between the colour tile and the cut-out,
// so it never crosses type or the price label. No library, no blend modes. Timed by the clock, so a phone that
// halves its frame rate (Low Power Mode) shows the same motion. Still frame when motion is turned off; nothing
// at all if the graphics context is unavailable.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const W = 176, H = 220; // drawn small, scaled up by CSS: smoke is soft, so the upscale costs nothing visible
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r; uniform float t; uniform vec2 src;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1.0,0.0)), f.x), mix(h(i+vec2(0.0,1.0)), h(i+vec2(1.0,1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy / r;
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
  float a = clamp((body * 0.62 + strand * 0.5) * col * fade, 0.0, 1.0) * 0.8;
  gl_FragColor = vec4(vec3(1.0, 0.985, 0.955) * a, a);            // warm white, premultiplied
}`;
const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.className = "smoke"; cv.setAttribute("aria-hidden", "true");
let gl, prog, uT, uSrc, raf = 0, t0 = performance.now(), seen = false, lost = false;
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
  gl.uniform2f(gl.getUniformLocation(prog, "r"), W, H); uT = gl.getUniformLocation(prog, "t");
  uSrc = gl.getUniformLocation(prog, "src"); gl.uniform2f(uSrc, 0.5, 0.2);
  gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0);
  return true;
}
function draw(now) {
  raf = 0; if (lost || !cv.isConnected) return;
  gl.uniform1f(uT, (now - t0) / 1000 + 40); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
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

// The page re-draws itself on every change, so the one canvas is moved into whichever product stage is on screen.
function place() {
  const hero = document.querySelector(".hero__stage"), stage = document.querySelector("[data-stage]:not(.tile--photo)") || hero;
  if (!stage) { if (layer.isConnected) { layer.remove(); layer.classList.remove("on"); } return; }
  if (layer.parentNode === stage) return;
  layer.classList.remove("on"); layer.classList.toggle("smoke--hero", stage === hero);
  if (stage === hero) { stage.insertBefore(layer, stage.querySelector(".hero__pieces")); if (gl) gl.uniform2f(uSrc, 0.5, 0.04); } // one wisp up the middle slab, behind the pieces
  else { stage.prepend(layer); if (gl) gl.uniform2f(uSrc, 0.5, 0.2); }
  io.disconnect(); io.observe(layer);
  requestAnimationFrame(() => layer.classList.add("on")); kick();
}
const live = setup(); if (!live) still();
new MutationObserver(place).observe(document.getElementById("main"), { childList: true }); place();
if (live) window.__smoke = { canvas: cv, at: s => { t0 = performance.now() - (s - 40) * 1000; }, frame: s => { gl.uniform1f(uT, s); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); return cv.toDataURL("image/png"); } };

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
