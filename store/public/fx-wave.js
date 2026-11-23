import { commitNav, setNavGate } from "./route.js";
// THE DRAW. Moving between the main sections pulls that section's own material across the counter: a designed leading edge, an
// opaque body that hides the page change, and a wake that leaves along the same bearing. One lazy WebGL2 canvas, z-index 15 (over the
// page and chips, under the top bar and dock), never takes a tap. If anything is wrong it steps aside and the normal transition runs.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const TIERS = [1280, 900, 640], COOL = 1500, MAX_MS = 860, GONE_MS = 895, FREE_MS = 20000;

// the store's tokens (tokens.css) as display sRGB. Anything darker is worked out in OKLCH at the jewel's own hue, never by scaling sRGB.
function ok(L, C, h) {
  const r = h * Math.PI / 180, a = C * Math.cos(r), b = C * Math.sin(r), l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  const e = v => { v = Math.max(0, Math.min(1, v)); return v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055; };
  return [e(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s), e(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s), e(-.0041960863 * l - .7034186147 * m + 1.707614701 * s)];
}
const C = { coal: ok(.155, .012, 50), coal1: ok(.205, .014, 50), coal2: ok(.275, .014, 52), ash: ok(.72, .018, 70), bone: ok(.925, .022, 80), ruby: ok(.72, .15, 18), teal: ok(.78, .105, 190), cobalt: ok(.72, .12, 265), emberlt: ok(.77, .14, 55), emerald: ok(.78, .13, 155), gilt: ok(.83, .12, 88), amethyst: ok(.76, .105, 312), bonelt: ok(.90, .03, 80), ember: ok(.58, .215, 29) };
const mid = h => ok(.46, .09, h), deep = h => ok(.30, .055, h), S2 = Math.SQRT1_2;
const tone = (c, h, accent = C.bone) => [c, mid(h), deep(h), accent];

// THE TILE ARRIVES. Every wave is the destination's own header colour: the material lives only on the leading edge, the body and tail are the flat token.
// m: edge, d: bearing (screen, y up), e: how far the edge reaches past the frame in CSS px (r: the same as a share of travel), p: [body, mid, deep, accent], c and ms: cover and reveal
const W = {
  hookahs: { m: "smoke", d: [S2, S2], e: 150, p: [C.coal, C.ash, C.coal2, C.bone], atlas: "smoke" },   // coal body: pink smoke is banned
  heat: { m: "fire", d: [0, 1], e: 130, p: [C.coal, C.emberlt, C.ember, C.gilt], atlas: "fire" },      // coal body: fire needs the dark to glow
  bases: { m: "water", d: [-S2, S2], e: 40, p: tone(C.teal, 190) },
  bowls: { m: "sweep", d: [0, -1], e: 2, p: tone(C.cobalt, 265) },
  hoses: { m: "rope", d: [1, 0], e: 6, p: tone(C.emerald, 155) },
  parts: { m: "sweep", d: [-1, 0], e: 2, p: tone(C.gilt, 88) },
  cologne: { m: "sweep", d: [-S2, -S2], e: 2, p: tone(C.amethyst, 312) },
  misc: { m: "labels", d: [S2, -S2], e: 150, p: [C.bonelt, C.ember, C.coal, C.bone] },
  home: { m: "motes", d: [.38, .925], e: 56, p: [C.coal, C.gilt, C.coal2, C.ember] },
  all: { m: "sweep", d: [0, 1], e: 2, p: [C.bonelt, C.bone, C.coal, C.bone] },
  gifts: { m: "ribbon", d: [S2, S2], e: 56, p: tone(C.cobalt, 265) },
  set: { m: "sweep", d: [1, 0], e: 2, p: tone(C.ruby, 18) },
  shipping: { m: "route", d: [1, 0], e: 140, p: tone(C.cobalt, 265) },
  search: { m: "sweep", d: [1, 0], e: 2, p: tone(C.teal, 190), c: 150, ms: 230 },
  cart: { m: "sweep", d: [0, 1], e: 2, p: tone(C.gilt, 88), c: 170, ms: 260 },
};
const pageTone = path => /^\/gifts\/under-50/.test(path) ? tone(C.emerald, 155) : tone(C.cobalt, 265);   // Gifts wears the colour of the page it lands on

const HEAD = `#version 300 es
precision highp float;
uniform vec2 uR, uV, uD; uniform float uTime, uH, uT; uniform vec3 uA, uB, uC, uE; uniform sampler2D uN;
in vec2 v; out vec4 fragColor; float PX, L, CR;
float N(vec2 p) { return texture(uN, p).r; }
float H1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float H2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fbm(vec2 p) { return .55 * N(p) + .3 * N(p * 2.03 + .37) + .15 * N(p * 4.1 + .71); }
float ss(float a, float b, float x) { return smoothstep(a, b, x); }
float E(float d) { return ss(-PX * .75, PX * .75, d); }
`;
// all distances are CSS pixels, so a pattern is the same size on a phone and a desktop. h: px behind the head, t: px ahead of the tail.
const FOOT = `
void main() {
  vec2 p = (v - .5) * uV; L = abs(uD.x) * uV.x + abs(uD.y) * uV.y; CR = abs(uD.y) * uV.x + abs(uD.x) * uV.y; PX = uV.y / uR.y;
  float s = dot(p, uD) + L * .5; vec2 f = vec2(dot(p, vec2(-uD.y, uD.x)), s);
  float h = uH * L - s, t = s - uT * L; vec3 c = uA; mat(f, p, h, t, c);
  float a = E(min(h, t)); fragColor = vec4(clamp(c, 0., 1.) * a, a);
}`;
const SIG = "void mat(vec2 f, vec2 p, inout float h, inout float t, inout vec3 c)";
const MAT = {
  // stand-ins, used only if the baked flipbooks are missing
  smoke: `${SIG} { vec2 q = p / 900. + vec2(uTime * .05, -uTime * .09); float e = (fbm(q + fbm(q * 1.7) * .34) - .5) * 190.; h += e - 60.; t += e * .4; c = mix(uB, uA, ss(0., 90., h)); }`,
  fire: `${SIG} { vec2 q = vec2(f.x / 620., f.y / 900. - uTime * .4); float e = (fbm(q) - .5) * 170.; h += e - 50.; t += e * .4; c = mix(uE, mix(uB, mix(uC, uA, ss(26., 84., h)), ss(4., 26., h)), ss(0., 5., h)); }`,
  // a water line sloshing, one bone crest, a few bubbles riding just behind it
  water: `${SIG} { float e = 11. * sin(f.x / 47. + uTime * 5.) + 5. * sin(f.x / 19. - uTime * 7. + 1.) - 18.; h += e; t += 5. * sin(f.x / 70. + uTime * 3.);
    float b = h - 15. - 4. * sin(f.x / 31. - uTime * 4.); c = mix(uB, c, ss(1., 1. + PX, abs(b))); c = mix(uE, c, E(h - 3.));
    float z = 17.; vec2 g = vec2(f.x, f.y + uTime * 30.) / z, id = floor(g), u = fract(g) - .5;
    if (H2(id) > .66) { vec2 o = (vec2(H2(id + 1.), H2(id + 2.)) - .5) * .46; float hc = h + (u.y - o.y) * z, d = length(u - o) * z - (1.4 + 2.2 * H2(id + 7.)); if (hc > 24. && hc < 58.) c = mix(uE, c, E(d)); } }`,
  // one twisted hose rope along the edge, one colour, shaded by the twist
  rope: `${SIG} { float P = 24., W = 32.; h += 3. * abs(sin(3.14159 * (f.x + h * 1.1) / P)) - 3.;
    if (h < W + 2.) { float s = abs(fract((f.x + h * 1.1) / P) - .5) * 2.; c = mix(uA, uB, ss(.66, .76, s)); c = mix(c, uC, ss(.88, .95, s)); c = mix(uC, c, E(abs(h - W) - 1.)); if (h > W + 1.) c = uA; } }`,
  // large blank price labels dealt across, the body following under them
  labels: `${SIG} { vec2 cl = vec2(128., 82.), g = p / cl; float ro = mod(floor(g.y), 2.); g.x += ro * .5; vec2 id = floor(g), q = (fract(g) - .5) * cl, ctr = (id + .5 - vec2(ro * .5, 0.)) * cl;
    float sc = dot(ctr, uD) + L * .5 + H2(id) * 34., k = clamp((uH * L - sc + 76.) / 56., 0., 1.); k = k * k * (3. - 2. * k); float bh = h - 64., lb = -1.; vec3 lc = uA;
    if (k > 0.) { vec2 w = (q + uD * (1. - k) * 38.) / (.72 + .28 * k), b = abs(w) - vec2(46., 23.); float d = length(max(b, 0.)) + min(max(b.x, b.y), 0.) - 6.; lb = -d; lc = w.y > 12. ? uB : uE; lc = mix(uC, lc, E(-d - 1.5)); }
    c = mix(lc, uA, E(bh)); h = max(bh, lb); }`,
  // coal, with a few embers rising off the edge
  motes: `${SIG} { float z = 34., dr = -1.; vec2 g = vec2(p.x + uTime * 7., p.y - uTime * 42.) / z, id = floor(g), u = fract(g) - .5; float bh = h - 10.;
    if (H2(id) > .78) { vec2 j = (vec2(H2(id + 1.), H2(id + 2.)) - .5) * .5; float hc = h + dot((u - j) * z, uD); if (hc > -38. && hc < 26.) { dr = (1.2 + 1.7 * H2(id + 3.)) - length(u - j) * z; if (dr > 0.) c = H2(id + 4.) > .7 ? uB : uE; } }
    if (bh > 0. && dr <= 0.) c = uA; h = max(bh, dr); }`,
  // a bone ribbon crossing on the page's own colour, tied in a bow
  ribbon: `${SIG} { float e = 4. * sin(f.x / 63. + uTime * 3.) - 34.; float b = h + e; vec2 q = vec2(f.x, b - 17.); vec2 l = vec2(abs(q.x) - 25., q.y - abs(q.x) * .16); float loop = 1. - length(l / vec2(25., 15.)), hole = length(vec2(abs(q.x) - 25., l.y) / vec2(11., 5.)) - 1., knot = 7. - length(q);
    float bow = max(min(loop * 15., hole * 5.), knot); if (b < 34. || bow > 0.) c = uE; if (b > 0. && b < 34.) c = mix(uB, c, E(abs(b - 17.) - 12.) + step(0., bow)); if (bow > 0.) c = mix(uB, uE, E(bow - 1.4)); h = max(b, bow); t += 0.; }`,
  // one bone route line running out ahead of the flat colour, ending in a map pin
  route: `float rt(float x) { return 64. * sin(x / 130. + .6) + 28. * sin(x / 61. + 2.); }
  ${SIG} { float tip = uH * L, dl = 3. - abs(f.x - rt(f.y)); vec2 q = vec2(f.y - tip, f.x - rt(tip) - 25.); float pin = 15. - length(q), tp = min(q.y + 25., 15. - abs(q.x) - (q.y < 0. ? -q.y * .62 : 99.)), hole = length(q) - 5.5, bh = h - 120.;
    pin = max(pin, q.y < -4. ? tp : -1.); c = mix(uA, uE, E(dl) * E(h) * E(230. - h)); c = mix(c, uE, E(pin)); c = mix(uB, c, 1. - E(pin) * (1. - E(hole))); h = max(bh, max(min(h, dl), pin)); }`,
  // the plain family wave: the flat header colour with a clean edge. Bowls, Parts, Cologne, Everything, Build a set and Cart use it because their drawn edges failed the two-round name test
  sweep: `${SIG} { }`,
};
// the baked smoke and fire: a flipbook, sampled at one uniform cover scale. With a flow map, frames warp into each other instead of double-exposing.
const FLIP = `#version 300 es
precision highp float;
uniform sampler2D uAt, uFl; uniform vec2 uR, uCell, uGrid; uniform float uF, uFloor, uHot, uFlow; uniform vec3 uC; in vec2 v; out vec4 fragColor;
vec2 slot(float i) { return vec2(mod(i, uGrid.x), floor(i / uGrid.x)); }
vec4 cel(float i, vec2 q) { vec2 m = .5 / uCell; return texture(uAt, (slot(i) + clamp(q, m, 1. - m)) / uGrid); }
vec2 flw(float i, vec2 q) { return (texture(uFl, (slot(i) + q) / uGrid).rg * 2. - 1.) * uFlow; }
void main() {
  float sa = uR.x / uR.y, fa = uCell.x / uCell.y; vec2 q = v; if (sa > fa) q.y = .5 + (q.y - .5) * fa / sa; else q.x = .5 + (q.x - .5) * sa / fa; q.y = 1. - q.y;
  float a = floor(uF), b = min(a + 1., uGrid.x * uGrid.y - 1.), fr = uF - a; vec4 c;
  if (uFlow > 0.) { vec2 m = flw(a, q); c = mix(cel(a, q - m * fr), cel(b, q + m * (1. - fr)), fr); } else c = mix(cel(a, q), cel(b, q), fr);
  float pk = max(c.r, max(c.g, c.b)); c.rgb *= mix(vec3(1.), vec3(1., .74, .34), uHot * smoothstep(.55, .98, pk));   // fire keeps its colour; only the very tips reach white
  float al = max(c.a, uFloor); fragColor = vec4(c.rgb + uC * (al - c.a), al);
}`;
const VERT = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

let cv = null, gl = null, vao = null, noise = null, progs = {}, broken = false, tier = 0, atlas = null, tex = {}, imgs = {}, w = null, raf = 0, lastStart = -1e9, freeTimer = 0, undo = null, lastD = null, proxy = null;
try { tier = Math.min(2, +sessionStorage.getItem("oss:wave-tier") || 0); } catch {}
const saveData = () => !!navigator.connection?.saveData;

function glInit() {
  if (gl) return true; if (broken) return false;
  cv = document.createElement("canvas"); cv.width = cv.height = 0; cv.className = "fx-wave"; cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100lvh;z-index:15;pointer-events:none;display:block;opacity:0";
  gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance", desynchronized: false });
  if (!gl) { cv = null; broken = true; return false; }
  cv.addEventListener("webglcontextlost", e => { e.preventDefault(); lostGL(); });
  return setup();
}
function setup() {
  vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  const n = 256, d = new Uint8Array(n * n), r = new Uint8Array(n * n); for (let i = 0; i < r.length; i++) r[i] = Math.random() * 256;
  // tiling value noise: every texel the average of a small wrapped neighbourhood, stretched back to full range
  let lo = 255, hi = 0; const sum = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) s += r[((y + j + n) % n) * n + (x + i + n) % n]; s /= 25; sum[y * n + x] = s; if (s < lo) lo = s; if (s > hi) hi = s; }
  for (let i = 0; i < d.length; i++) d[i] = (sum[i] - lo) / (hi - lo) * 255;
  noise = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, noise); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, d); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return !gl.isContextLost();
}
function build(fs) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error("wave shader: " + gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(), a = sh(gl.VERTEX_SHADER, VERT), b = sh(gl.FRAGMENT_SHADER, fs); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); gl.deleteShader(a); gl.deleteShader(b);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error("wave link: " + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace("[0]", ""); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}
const prog = key => progs[key] || (progs[key] = build(key === "flip" ? FLIP : HEAD + MAT[key] + FOOT));
// THE SLOT for the baked art. A new bake only changes its entry here: file, grid, cell size, full-cover frame, and optionally flow (a same-grid RG map) with flowMax (its reach in cell UV).
const BOOKS = {
  smoke: { file: "smoke.webp", cols: 4, rows: 4, frames: 16, frameWidth: 360, frameHeight: 780, fullCoverFrame: 5 },
  fire: { file: "fire.webp", cols: 4, rows: 4, frames: 16, frameWidth: 360, frameHeight: 780, fullCoverFrame: 5 },
};
// the flipbooks are asked for when the browser is idle, never on Save-Data or reduced motion
function loadAtlas() {
  if (atlas || saveData() || RM.matches) return; atlas = {};
  for (const k in BOOKS) { const B = BOOKS[k], im = new Image(); im.decoding = "async"; im.src = "img/wave/" + B.file;
    const fl = B.flow ? new Image() : null; if (fl) { fl.decoding = "async"; fl.src = "img/wave/" + B.flow; }
    Promise.all([im.decode(), fl?.decode()]).then(() => { atlas[k] = B; imgs[k] = im; if (fl) imgs[k + ":flow"] = fl; }).catch(() => {}); }   // decoded off the main thread, so the tap never pays for it
}
function upload(key, unit, im) {
  if (tex[key]) return tex[key]; const t = gl.createTexture(); gl.activeTexture(unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, im);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex[key] = t;
}
function atlasTex(k) { const im = imgs[k]; if (!im) return null; if (imgs[k + ":flow"]) upload(k + ":flow", gl.TEXTURE2, imgs[k + ":flow"]); return upload(k, gl.TEXTURE1, im); }
function fit() {   // sized once: the shaders work in CSS pixels, so a later rotation only stretches the buffer. A slower tier applies from the next page load.
  if (cv.width < 2) { const cw = cv.clientWidth || innerWidth, ch = cv.clientHeight || innerHeight, dp = Math.min(2, devicePixelRatio || 1), long = Math.min(TIERS[tier], Math.max(cw, ch) * dp), k = long / Math.max(cw, ch); cv.width = Math.max(2, Math.round(cw * k)); cv.height = Math.max(2, Math.round(ch * k)); }
  gl.viewport(0, 0, cv.width, cv.height);
}

// which section a path belongs to
const CATS = new Set(["hookahs", "bases", "bowls", "heat", "hoses", "parts", "cologne", "misc"]);
function sectionOf(path) {
  const [a = "", b] = path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "").split("/");
  if (!a) return "home"; if (a === "shop") return !b ? "all" : CATS.has(b) ? b : "missing"; if (a === "gifts" || a === "set" || a === "shipping" || a === "search" || a === "cart") return a;
  if (a === "p") return "piece"; return a === "checkout" || a === "order" || a === "terms" || a === "privacy" ? "quiet" : "missing";
}
function waveFor(path) {
  const to = sectionOf(path), from = sectionOf(location.pathname); if (!W[to] || to === from || from === "quiet") return null;
  if (from === "piece" && document.querySelector(".pdp[data-cat]")?.dataset.cat === to) return null;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || saveData() || document.hidden || broken) return null; return to;
}

// the top nav answers at the tap, before the wave reaches it
function underline(path) {
  const nav = document.querySelector("[data-nav]"); if (!nav) return; const was = nav.querySelector("[aria-current]"), next = [...nav.querySelectorAll("a")].find(a => a.getAttribute("href") === path.split(/[?#]/)[0]);
  if (was === next) return; was?.removeAttribute("aria-current"); next?.setAttribute("aria-current", "page"); undo = () => { if (!nav.isConnected) return; next?.removeAttribute("aria-current"); was?.setAttribute("aria-current", "page"); };
}
const cssSize = () => [cv.clientWidth || innerWidth, cv.clientHeight || innerHeight];
const margin = o => { const [x, y] = cssSize(), L = Math.abs(o.d[0]) * x + Math.abs(o.d[1]) * y; return Math.max(o.r || 0, (o.e || 0) / L) + .005; };   // how far past the frame the edge has to start and finish
function draw(o, now, H, Tl, frame) {
  fit(); const [vw, vh] = cssSize();
  if (frame != null && o.atlasOn) {
    const P = prog("flip"), A = o.atlasOn; gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex(o.atlas)); gl.uniform1i(P.u.uAt, 1);
    const fl = tex[o.atlas + ":flow"]; if (fl && P.u.uFl) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fl); gl.uniform1i(P.u.uFl, 2); } gl.uniform1f(P.u.uFlow, fl ? A.flowMax || 0 : 0);
    gl.uniform2f(P.u.uR, vw, vh); gl.uniform2f(P.u.uCell, A.frameWidth, A.frameHeight); gl.uniform2f(P.u.uGrid, A.cols, A.rows); gl.uniform1f(P.u.uF, Math.min(A.frames - 1, frame)); const dist = Math.abs(frame - A.fullCoverFrame), fl2 = Math.max(0, 1 - dist / 2.2);
    gl.uniform1f(P.u.uFloor, fl2 * fl2 * (3 - 2 * fl2)); gl.uniform1f(P.u.uHot, o.atlas === "fire" ? 1 : 0); gl.uniform3fv(P.u.uC, C.coal); gl.drawArrays(gl.TRIANGLES, 0, 3); return;
  }
  const P = prog(o.m), [a, b, c, e] = o.p; gl.useProgram(P.p); if (P.u.uN) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, noise); gl.uniform1i(P.u.uN, 0); }
  gl.uniform2f(P.u.uR, cv.width, cv.height); gl.uniform2f(P.u.uV, vw, vh); gl.uniform2f(P.u.uD, o.d[0], o.d[1]); gl.uniform1f(P.u.uTime, (now - w.t0) / 1000); gl.uniform1f(P.u.uH, H); gl.uniform1f(P.u.uT, Tl);
  gl.uniform3fv(P.u.uA, a); if (P.u.uB) gl.uniform3fv(P.u.uB, b); if (P.u.uC) gl.uniform3fv(P.u.uC, c); if (P.u.uE) gl.uniform3fv(P.u.uE, e);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
// one unbroken pass: the head arrives still moving and the tail leaves at that same speed, so nothing stops dead at the page swap
const coverEase = p => (1 - (1 - .82 * p) ** 2) / .9676, revealEase = p => ((.18 + .82 * p) ** 2 - .0324) / .9676;
function paint(now) {
  const o = w.o, m = margin(o), A = o.atlasOn;
  if (w.phase === "cover") { const p = Math.min(1, (now - w.t0) / o.cover), e = coverEase(p); w.p = p; draw(o, now, -m + e * (1 + 2 * m), -m - .02, A ? e * A.fullCoverFrame : null); return p >= 1; }
  const p = Math.min(1, (now - w.rt) / w.rd), e = revealEase(p); w.p = p; draw(o, now, 1 + m + .02, -m - .02 + e * (1 + 2 * m + .04), A ? A.fullCoverFrame + e * (A.frames - 1 - A.fullCoverFrame) : null); return p >= 1;
}
// Search: an input focused inside the tap, so an iPhone opens its keyboard; the real field takes the focus over at the swap
function holdKeyboard() { const i = document.createElement("input"); i.type = "search"; i.tabIndex = -1; i.setAttribute("aria-label", "Search"); i.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none;z-index:14"; document.body.append(i); i.focus({ preventScroll: true }); proxy = i; }
function dropKeyboard() { if (!proxy) return; const i = proxy; proxy = null; i.remove(); }
function swap() {
  if (!w || w.swapped) return; if (w.phase === "cover") try { paint(w.t0 + w.o.cover); } catch {} // a late frame clock still swaps under a full cover
  w.swapped = true; const path = w.path; w.path = null; undo = null; if (path) commitNav(path, "wave"); dropKeyboard();
  if (!w) return; w.phase = "reveal"; const t = performance.now(); w.rt = t; w.rd = Math.max(120, Math.min(w.o.ms, w.t0 + Math.min(MAX_MS, w.o.cover + w.o.ms) - t));
}
function tick(now) {
  raf = 0; if (!w) return; raf = requestAnimationFrame(tick); now = Math.max(now, performance.now() - 40);
  const dt = now - w.last; w.last = now;
  if (w.frames++ > 0 && w.phase === "cover" && !w.peak) { // the governor, measured only before the swap: the swap frame is long on purpose: a heavy frame drops the resolution; a device that cannot keep up gets the plain transition from then on
    w.slow = dt > 48 ? w.slow + 1 : 0; w.vslow = dt > 150 ? w.vslow + 1 : 0;
    if (w.slow >= 2 && tier < TIERS.length - 1) { tier++; w.slow = 0; try { sessionStorage.setItem("oss:wave-tier", tier); } catch {} }
    if (w.vslow >= 2) { broken = true; abort(); return; }
  }
  try {
    const done = paint(now);
    if (w.phase === "cover" && done) { if (w.peak) swap(); else w.peak = true; }
    else if (w.phase === "reveal" && done) finish();
  } catch (e) { console.error("fx-wave: " + e); broken = true; abort(); }
}
function clearTimers() { if (!w) return; clearTimeout(w.swapT); clearTimeout(w.goneT); }
function hide() {
  if (raf) cancelAnimationFrame(raf); raf = 0; if (cv) cv.style.opacity = "0";   // it stays attached and keeps its size: WebKit stops presenting a WebGL canvas that was resized or re-attached. The compiled shaders stay warm
  clearTimeout(freeTimer); freeTimer = setTimeout(freeTex, FREE_MS);
}
function freeTex() { if (w || !gl || gl.isContextLost()) return; for (const k in tex) { gl.deleteTexture(tex[k]); delete tex[k]; } }
function finish() { const pending = w?.path; clearTimers(); w = null; hide(); undo = null; if (pending) commitNav(pending, proxy ? "wave" : "push"); dropKeyboard(); }
function abort() { const pending = w?.path; clearTimers(); w = null; hide(); undo = null; if (pending) commitNav(pending, proxy ? "wave" : "push"); dropKeyboard(); }
function lostGL() { gl = null; if (cv) cv.remove(); cv = null; progs = {}; tex = {}; noise = null; vao = null; if (w) abort(); }

function play(key, path) {
  if (!glInit()) return false;
  const base = W[key], o = { ...base, cover: base.c ?? 300, ms: base.ms ?? 480 }; if (base.atlas && atlas?.[base.atlas] && imgs[base.atlas]) o.atlasOn = atlas[base.atlas];
  if (key === "gifts") o.p = pageTone(path);
  if (key === "home" && lastD) o.d = [-lastD[0], -lastD[1]];   // home leaves the way you came
  try { if (o.atlasOn) { if (!atlasTex(o.atlas)) o.atlasOn = null; else prog("flip"); } if (!o.atlasOn) prog(o.m); } catch (e) { console.error("fx-wave: " + e); broken = true; return false; }
  clearTimeout(freeTimer); const t = performance.now(); lastStart = t; lastD = o.d;
  w = { key, o, path, t0: t, last: t, phase: "cover", frames: 0, slow: 0, vslow: 0, swapped: false, peak: false, rt: t, rd: o.ms, p: 0 };
  if (!cv.isConnected) document.body.append(cv); cv.style.opacity = "1"; if (key === "search") holdKeyboard();
  underline(path); try { paint(t); } catch (e) { console.error("fx-wave: " + e); broken = true; w.path = null; undo?.(); abort(); return false; } w.swapT = setTimeout(swap, o.cover + 70);   // a stalled frame clock still lands the page
  w.goneT = setTimeout(finish, Math.min(GONE_MS, o.cover + o.ms + 90)); raf = requestAnimationFrame(tick);
  return true;
}
// the page this wave was carrying is cancelled; the band itself keeps travelling, so nothing jumps
function drop(restore) { if (!w?.path) return; w.path = null; if (restore) undo?.(); undo = null; dropKeyboard(); }
setNavGate({
  // true: the wave owns this navigation and will commit it at full cover
  take(path, replace) {
    if (w) { // a tap during a wave goes through at once, with one history entry; what it replaced never lands
      if (w.path === path) return true;
      drop(true); return false;
    }
    if (replace || performance.now() - lastStart < COOL) return false;
    const key = waveFor(path); if (!key) return false;
    if (!play(key, path)) return false;
    return true;
  },
  same() { drop(true); },
  pop() { drop(false); },
  live: () => !!w,
});
// the work is done before the first tap: shaders on the first touch, flipbooks when the browser is idle
const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
const warm = () => { if (RM.matches || saveData() || broken) return; const todo = ["flip", ...new Set(Object.values(W).map(x => x.m))];   // one shader per idle moment, so a first touch never stutters
  const next = () => { if (!todo.length || broken || w) { if (todo.length && w) setTimeout(() => idle(next), 1000); return; } try { if (glInit()) prog(todo.shift()); else return; } catch (e) { console.error("fx-wave: " + e); broken = true; return; } idle(next); }; idle(next); };
addEventListener("pointerdown", warm, { once: true, passive: true, capture: true });
addEventListener("pointerdown", e => {   // only the book this finger is about to open goes to the GPU, before the finger lifts
  const a = e.target.closest?.("a[href]"); if (!a) return; let u; try { u = new URL(a.href); } catch { return; } if (u.origin !== location.origin) return;
  const key = waveFor(u.pathname), k = key && W[key].atlas; if (!k || !imgs[k]) return; idle(() => { if (!gl || w || gl.isContextLost()) return; try { atlasTex(k); } catch {} });
}, { passive: true, capture: true });
idle(loadAtlas);
window.__wave = { palette: () => w ? w.o.p : null, get active() { return w ? { key: w.key, phase: w.phase, p: w.p, pending: w.path } : null; }, get canvas() { return cv; }, get tier() { return tier; }, sectionOf, waveFor };
