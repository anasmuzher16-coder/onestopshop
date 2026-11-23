import { commitNav, setNavGate } from "./route.js";
// THE DRAW. Moving between the main sections pulls that section's own material across the counter: a designed leading edge, an
// opaque body that hides the page change, and a wake that leaves along the same bearing. One lazy WebGL2 canvas, z-index 15 (over the
// page and chips, under the top bar and dock), never takes a tap. If anything is wrong it steps aside and the normal transition runs.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const TIERS = [900, 640, 480], COOL = 1500, MAX_MS = 860, GONE_MS = 895, FREE_MS = 20000;

// the store's tokens (tokens.css) as display sRGB
function ok(L, C, h) {
  const r = h * Math.PI / 180, a = C * Math.cos(r), b = C * Math.sin(r), l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  const e = v => { v = Math.max(0, Math.min(1, v)); return v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055; };
  return [e(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s), e(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s), e(-.0041960863 * l - .7034186147 * m + 1.707614701 * s)];
}
const C = { coal: ok(.155, .012, 50), coal1: ok(.205, .014, 50), coal2: ok(.275, .014, 52), coal3: ok(.56, .016, 60), ash: ok(.72, .018, 70), bone: ok(.925, .022, 80), white: ok(.985, .006, 85), ruby: ok(.72, .15, 18), teal: ok(.78, .105, 190), cobalt: ok(.72, .12, 265), ember: ok(.77, .14, 55), emerald: ok(.78, .13, 155), gilt: ok(.83, .12, 88), amethyst: ok(.76, .105, 312), bonelt: ok(.90, .03, 80) };
const JEWELS = [C.ruby, C.teal, C.cobalt, C.ember, C.emerald, C.gilt, C.amethyst, C.bonelt];
const dim = (c, k) => c.map(v => v * k), S2 = Math.SQRT1_2;

// section: material, bearing it travels (screen, y up), reach of its edge past the frame, palette [crest, mid, deep, glint], cover and reveal in ms
const W = {
  hookahs: { m: "smoke", d: [S2, S2], r: .3, p: [C.bone, C.ash, C.coal2, C.white], atlas: "smoke" },
  heat: { m: "fire", d: [0, 1], r: .3, p: [C.gilt, C.ember, dim(C.ember, .22), C.white], atlas: "fire" },
  bases: { m: "water", d: [-S2, S2], r: .13, p: [C.teal, dim(C.teal, .72), dim(C.teal, .17), C.white] },
  parts: { m: "rack", d: [-1, 0], r: .1, p: [C.gilt, dim(C.gilt, .62), dim(C.gilt, .17), C.bonelt] },
  cologne: { m: "stipple", d: [-S2, -S2], r: .29, p: [C.amethyst, dim(C.amethyst, .6), dim(C.amethyst, .16), C.white] },
  bowls: { m: "foil", d: [0, -1], r: .07, p: [C.cobalt, dim(C.cobalt, .62), dim(C.cobalt, .2), C.bone] },
  misc: { m: "tiles", d: [S2, -S2], r: .22, p: [C.bonelt, dim(C.bonelt, .82), C.coal, C.white] },
  hoses: { m: "braid", d: [1, 0], r: .24, p: [C.emerald, dim(C.emerald, .58), dim(C.emerald, .16), C.bone] },
  home: { m: "motes", d: [.38, .925], r: .08, p: [C.bone, C.ember, C.coal, C.white] },
  all: { m: "columns", d: [0, 1], r: .2, p: [C.white, C.bone, C.coal, C.white] },
  gifts: { m: "unwrap", d: [S2, S2], r: .03, p: [C.emerald, dim(C.emerald, .5), dim(C.cobalt, .3), C.bone] },
  set: { m: "panels", d: [1, 0], r: .34, p: [C.ruby, dim(C.ruby, .62), dim(C.ruby, .2), C.bone] },
  shipping: { m: "route", d: [1, 0], r: .2, p: [C.cobalt, dim(C.cobalt, .6), dim(C.cobalt, .19), C.bone] },
  search: { m: "sweep", d: [1, 0], r: .03, p: [C.teal, dim(C.teal, .6), dim(C.teal, .2), C.white], c: 0, ms: 380 },
  cart: { m: "sweep", d: [0, 1], r: .03, p: [C.gilt, dim(C.gilt, .6), dim(C.gilt, .2), C.bonelt], c: 170, ms: 260 },
};

const HEAD = `#version 300 es
precision highp float;
uniform vec2 uR, uD; uniform float uTime, uH, uT; uniform vec3 uA, uB, uC, uE; uniform vec3 uJ[8]; uniform sampler2D uN;
in vec2 v; out vec4 fragColor; float PX, RR;
float N(vec2 p) { return texture(uN, p).r; }
float H1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float H2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fbm(vec2 p) { return .55 * N(p) + .3 * N(p * 2.03 + .37) + .15 * N(p * 4.1 + .71); }
float ss(float a, float b, float x) { return smoothstep(a, b, x); }
`;
const FOOT = `
void main() {
  float asp = uR.x / uR.y; vec2 p = (v - .5) * vec2(asp, 1.); RR = abs(uD.x) * asp * .5 + abs(uD.y) * .5;
  float s = (dot(p, uD) / RR + 1.) * .5; vec2 f = vec2(dot(p, vec2(-uD.y, uD.x)), s); PX = .5 / (RR * uR.y);
  float h = uH - s, t = s - uT; vec3 c = vec3(0.); mat(f, p, h, t, c);
  float a = ss(0., PX * 1.5, min(h, t)); fragColor = vec4(clamp(c, 0., 1.) * a, a);
}`;
// each material bends the head (h) and tail (t) distances into its own edge and paints the body
const MAT = {
  // temporary stand-ins, used only if the baked flipbooks are missing
  smoke: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    vec2 q = p * .42 + vec2(uTime * .05, -uTime * .09); float w = fbm(q + fbm(q * 1.7) * .34), e = (w - .5) * .5; h += e; t += e;
    float d = clamp(h / .3, 0., 1.); c = mix(uB * .8, uC, ss(0., .8, d)) + uA * .16 * ss(.42, .7, fbm(q * 3.1)) * (1. - d * .6); }`,
  fire: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    vec2 q = vec2(f.x * .7, f.y * .3 - uTime * .4); float e = (fbm(q) - .5) * .56; h += e; t += e * .7;
    float d = clamp(h / .22, 0., 1.); c = mix(uE, mix(uA, mix(uB, uC, ss(.3, 1., d)), ss(.05, .4, d)), ss(0., .12, d)); }`,
  water: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float e = .05 * sin(f.x * 2.6 + uTime * 4.) + .022 * sin(f.x * 7.3 - uTime * 6.) + .06 * (fbm(vec2(f.x * .22, uTime * .12)) - .5); h += e; t += e * .8;
    float d = clamp(h / .3, 0., 1.); vec2 q = p * 1.6 + vec2(uTime * .08, -uTime * .16); float w = fbm(q * .35 + fbm(q * .18) * .22);
    float ca = ss(.028, 0., abs(w - .5)) * .7 + ss(.016, 0., abs(fbm(q * .6 + .3) - .52)) * .4;
    c = mix(uB * .8, uC, ss(0., .9, d)) + uA * ca * (.14 + .26 * (1. - d));
    vec2 g = p * 15. + vec2(0., -uTime * 3.2), id = floor(g), u = fract(g) - .5;
    if (H2(id) > .8) { vec2 b = u - (vec2(H2(id + 1.), H2(id + 2.)) - .5) * .5; float r = .09 + .17 * H2(id + 3.); c += uE * ss(.05, 0., abs(length(b) - r)) * (.42 - .22 * d); }
    c = mix(c, uE, exp(-max(h, 0.) / (PX * 3. + .003)) * .95); c = mix(c, uA, exp(-max(t, 0.) / .006) * .55); }`,
  rack: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float x = f.x * 9., i = floor(x), u = fract(x), tooth = ss(.12, .16, u) * (1. - ss(.66, .7, u)), e = .05 * tooth + mod(i, 3.) * .012 - .03; h += e; t += e;
    float d = clamp(h / .34, 0., 1.), gr = ss(.34, .5, abs(fract(f.x * 64.) - .5)), cross = ss(.47, .5, abs(fract(f.y * 18.) - .5));
    c = mix(uB, uC, ss(0., .7, d)) + uA * (.1 * gr + .07 * cross);
    float bev = exp(-max(h, 0.) / (PX * 4. + .004)); c = mix(c, uA, bev);
    float gl = exp(-pow((fract(f.x * .45 - uTime * .9) - .5) / .06, 2.)); c += uE * gl * (.5 * exp(-max(h, 0.) / .05) + .07);
    c = mix(c, uA * .7, exp(-max(t, 0.) / .005)); }`,
  stipple: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float e = .12 * (fbm(vec2(f.x * .5, uTime * .2)) - .5); h += e; t += e;
    float wd = .2, m = clamp(h / wd, 0., 1.) * clamp(t / wd, 0., 1.); m = m * m * (3. - 2. * m);
    float g = H2(floor(gl_FragCoord.xy) + 13.), g2 = H2(floor(gl_FragCoord.xy / 2.) + 3.);
    float tip = 1. - m; c = mix(uC, uB, ss(.62, .96, g2) * .75) + uA * .22 * ss(.8, 1., g);
    c = mix(c, mix(uA, uE, ss(.5, 1., g)), tip * tip);
    float vis = m >= .999 ? 1. : (m - g * .985) * .3; h = vis; t = vis; }`,
  foil: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float z = abs(fract(f.x * 9.) * 2. - 1.), e = .05 * z - .025; h += e; t += e;
    vec2 g = p * vec2(12., 13.86); g.x += g.y * .5; vec2 i = floor(g), u = fract(g); float up = step(u.x + u.y, 1.), sh = H2(i + up * .37);
    float ed = up > .5 ? min(min(u.x, u.y), 1. - u.x - u.y) : min(min(1. - u.x, 1. - u.y), u.x + u.y - 1.);
    float d = clamp(h / .36, 0., 1.), wave = .5 + .5 * sin(sh * 6.28 + uTime * 5. + f.y * 3.);
    c = mix(uC, uB, sh * sh * .9 + .1) + uA * .22 * wave * sh + uE * ss(.82, 1., sh * wave) * (.6 - .35 * d);
    c += uE * ss(.035, 0., ed) * (.34 - .2 * d); c = mix(c, uE, exp(-max(h, 0.) / (PX * 3. + .003)) * .9); c = mix(c, uA, exp(-max(t, 0.) / .005) * .7); }`,
  tiles: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float n = 9.; vec2 g = p * n, i = floor(g), u = fract(g) - .5, ctr = (i + .5) / n; float sc = (dot(ctr, uD) / RR + 1.) * .5, r = H2(i);
    float k = clamp(min(uH - sc - r * .1, sc - uT - r * .1) / .04, 0., 1.); k = k * k * (3. - 2. * k);
    float side = max(abs(u.x), abs(u.y)), jew = H2(i + 5.); vec3 tile = jew < .2 ? uJ[int(H2(i + 9.) * 7.99)] : mix(uA, uB, H2(i + 2.));
    c = tile * (.86 + .14 * ss(-.5, .5, u.y - u.x)); c = mix(c, uC, ss(.45, .475, side));
    float vis = k >= .999 ? 1. : (.5 * k - side) / n; h = vis; t = vis; }`,
  braid: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float lane = floor(f.x * 7.), off = H1(lane + 3.) * .12, h2 = h - off, t2 = t - off * .8, wt = ss(0., .09, h2) * ss(0., .09, t2);
    vec2 g = vec2(f.x * 22., f.y * 2. * RR * 22.), id = floor(g), u = fract(g) - .5; float over = mod(id.x + id.y, 2.);
    float along = over > .5 ? u.x + u.y : u.x - u.y, across = over > .5 ? u.x - u.y : u.x + u.y, rd = sqrt(max(0., 1. - min(1., abs(across) * 1.5) * min(1., abs(across) * 1.5)));
    float strand = mod(floor((over > .5 ? id.x - id.y : id.x + id.y) * .5), 3.); vec3 base = strand < 1. ? uE : mix(uA, uB, strand - 1.);
    c = mix(uC, base * (.34 + .66 * rd), ss(.72, .6, abs(across))) * (.82 + .18 * ss(.5, .95, abs(fract(along * 5.) - .5) * 2.));
    c = mix(c, uC * .55, ss(.42, .5, abs(along)) * .75); c = mix(c, uE, exp(-max(h2, 0.) / .012) * .55);
    float band = max(abs(u.x), abs(u.y)) * 2.; float vis = wt >= .999 ? 1. : min(min(h2, t2), (wt - band) * .03); h = vis; t = vis; }`,
  motes: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float e = .07 * (fbm(vec2(f.x * .4, uTime * .18)) - .5) + .012 * sin(f.x * 6. + uTime * 2.); h += e; t += e;
    float d = clamp(h / .4, 0., 1.); c = mix(uC * 1.7, uC, ss(0., .8, d)) + uC * .55 * fbm(p * .5 + uTime * .03);
    for (int l = 0; l < 2; l++) { float z = 15. + float(l) * 11.; vec2 g = p * z + vec2(uTime * (.5 + float(l)), -uTime * (1.1 - float(l) * .3)), id = floor(g), u = fract(g) - .5;
      if (H2(id + float(l)) > .72) { vec2 q = u - (vec2(H2(id + 1.), H2(id + 2.)) - .5) * .6; c += uB * ss(.13, 0., length(q)) * (.55 + .45 * H2(id + 3.)); } }
    c = mix(c, uA, exp(-max(h, 0.) / (PX * 3. + .003)) * .95); c += uB * .28 * exp(-max(h, 0.) / .05); c = mix(c, uA * .6, exp(-max(t, 0.) / .005) * .6); }`,
  columns: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float x = clamp(v.x, 0., .9999) * 8., i = floor(x), u = fract(x), off = H1(i + 11.) * .17; h -= off; t -= (.17 - off);
    c = uJ[int(i)]; c *= .9 + .1 * ss(0., 1., f.y); c = mix(c, uC, ss(PX * 12., 0., min(u, 1. - u)) * .9);
    c = mix(c, uA, ss(PX * 7., PX * 3., h) * .95); }`,
  unwrap: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float hat = ss(.42, .5, abs(fract((f.x + f.y) * 34.) - .5)) * .09, d = clamp(h / .5, 0., 1.);
    c = mix(uB, uB * .62, d) + uA * hat; float fl = ss(.075, .07, h); vec3 under = mix(uC * 1.5, uC, clamp(h / .075, 0., 1.));
    c = mix(c, under, fl); c = mix(c, uE, ss(PX * 4., PX, abs(h - .072)) * .9); c = mix(c, uE, ss(PX * 4., PX * 1., h) * .9);
    c += uE * ss(.012, .004, abs(f.x)) * .8 * (1. - fl); float tf = ss(.05, .045, t); c = mix(c, uC * 1.3, tf); c = mix(c, uA, ss(PX * 4., PX, abs(t - .048)) * .8); }`,
  panels: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float asp = uR.x / uR.y, side = p.x < 0. ? 0. : 1., row = p.y < 0. ? 0. : 1., o = (side + row * 2.) * .075, tooth = sign(sin(p.y * 22.)) * .018;
    float u = 1. - abs(p.x + tooth) / (asp * .5 + .03); h = uH - u - o; t = u - uT - (.225 - o);
    float tone = .74 + .26 * H1(side + row * 2. + 4.), rib = ss(.46, .5, abs(fract(p.y * 30.) - .5)), inset = abs(abs(p.x) - .06);
    c = uB * tone * .78 + uC * .3; c += uA * .07 * rib; c = mix(c, uC, ss(.004, .0015, inset) * .55);
    c = mix(c, uA, exp(-max(h, 0.) / (PX * 3. + .003)) * .95); c = mix(c, uA * .75, exp(-max(t, 0.) / (PX * 3. + .003)) * .8);
    float seam = abs(p.x + tooth); c = mix(c, uC * .45, ss(PX * 5., PX * 1.5, seam)); c = mix(c, uC * .45, ss(PX * 4., PX * 1.2, abs(p.y))); c = mix(c, uE, ss(PX * 2.5, PX * .8, abs(seam - PX * 5.)) * .45); }`,
  route: `float rt(float x) { return .17 * sin(x * 4.2 + .6) + .07 * sin(x * 9.7 + 2.) + .018 * sin(x * 26.); }
  void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float lead = h + .16, dy = abs(p.y - rt(f.y)) - .0035, on = min(lead, -dy), tipd = length(vec2((uH + .16 - f.y) * RR * 2., p.y - rt(uH + .16)));
    vec2 g = p * 18.; float grid = max(ss(.47, .5, abs(fract(g.x) - .5)), ss(.47, .5, abs(fract(g.y) - .5))) * .16, dash = step(.5, fract(f.y * 26.));
    float d = clamp(h / .4, 0., 1.); c = mix(uB, uC, ss(0., .7, d)) + uA * grid; c += uE * ss(.012, 0., abs(p.y - rt(f.y) - .05)) * dash * .12;
    c = mix(c, uA, exp(-max(h, 0.) / (PX * 3. + .003)) * .85); if (-dy > 0. || tipd < .012) c = uE;
    h = max(h, max(on, .012 - tipd)); c = mix(c, uA * .6, exp(-max(t, 0.) / .005) * .6); }`,
  sweep: `void mat(vec2 f, vec2 p, inout float h, inout float t, out vec3 c) {
    float e = .012 * sin(f.x * 15. + uTime * 9.); h += e; t += e; float d = clamp(h / .28, 0., 1.), hatch = ss(.4, .5, abs(fract(f.x * 46.) - .5));
    c = mix(uB, uC, ss(0., .8, d)) + uA * .1 * hatch; c = mix(c, uE, exp(-max(h, 0.) / (PX * 3. + .003)) * .9); c = mix(c, uE, exp(-max(t, 0.) / (PX * 4. + .004)) * .9); c = mix(c, uA, exp(-max(t, 0.) / .035) * .5); }`,
};
// the baked smoke and fire: 6x4 flipbook, blended between frames, premultiplied. The body only fills what the frame left open at full cover.
const FLIP = `#version 300 es
precision highp float;
uniform sampler2D uAt; uniform vec2 uR, uCell; uniform float uF, uFloor, uHot; uniform vec3 uC; in vec2 v; out vec4 fragColor;
vec4 cel(float i, vec2 q) { vec2 c = vec2(mod(i, 6.), floor(i / 6.)), m = .5 / (uCell * vec2(6., 4.)); return texture(uAt, (c + clamp(q, m * 6., 1. - m * 6.)) / vec2(6., 4.)); }
void main() {
  float sa = uR.x / uR.y, fa = uCell.x / uCell.y; vec2 q = v; if (sa > fa) q.y = .5 + (q.y - .5) * max(fa / sa, .6); else q.x = .5 + (q.x - .5) * sa / fa; q.y = 1. - q.y;
  float a = floor(uF), b = min(a + 1., 23.); vec4 c = mix(cel(a, q), cel(b, q), uF - a);
  float pk = max(c.r, max(c.g, c.b)); c.rgb *= mix(vec3(1.), vec3(1., .74, .34), uHot * smoothstep(.55, .98, pk));   // fire keeps its colour; only the very tips reach white
  float al = max(c.a, uFloor); fragColor = vec4(c.rgb + uC * (al - c.a), al);
}`;
const VERT = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

let cv = null, gl = null, vao = null, noise = null, progs = {}, broken = false, tier = 0, atlas = null, tex = {}, imgs = {}, w = null, raf = 0, lastStart = -1e9, freeTimer = 0, undo = null;
try { tier = Math.min(2, +sessionStorage.getItem("oss:wave-tier") || 0); } catch {}
const saveData = () => !!navigator.connection?.saveData;

function glInit() {
  if (gl) return true; if (broken) return false;
  cv = document.createElement("canvas"); cv.width = cv.height = 0; cv.className = "fx-wave"; cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100lvh;z-index:15;pointer-events:none;display:none";
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
const BOOKS = { smoke: { file: "smoke.webp", frames: 24, frameWidth: 256, frameHeight: 512, fullCoverFrame: 8 }, fire: { file: "fire.webp", frames: 24, frameWidth: 256, frameHeight: 512, fullCoverFrame: 8 } };
// the flipbooks are asked for when the browser is idle, never on Save-Data or reduced motion
function loadAtlas() {
  if (atlas || saveData() || RM.matches) return; atlas = {};
  for (const k in BOOKS) { const im = new Image(); im.decoding = "async"; im.src = "img/wave/" + BOOKS[k].file; im.decode().then(() => { atlas[k] = BOOKS[k]; imgs[k] = im; }).catch(() => {}); }   // decoded off the main thread, so the tap never pays for it
}
function atlasTex(k) {
  if (tex[k]) return tex[k]; const im = imgs[k]; if (!im) return null; const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, im);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex[k] = t;
}
function fit() {
  const cw = cv.clientWidth || innerWidth, ch = cv.clientHeight || innerHeight, dp = Math.min(2, devicePixelRatio || 1), long = Math.min(TIERS[tier], Math.max(cw, ch) * dp), k = long / Math.max(cw, ch), nw = Math.max(2, Math.round(cw * k)), nh = Math.max(2, Math.round(ch * k));
  if (cv.width !== nw || cv.height !== nh) { cv.width = nw; cv.height = nh; } gl.viewport(0, 0, nw, nh);
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
const reach = o => 1 + o.r;
function draw(o, now, H, Tl, frame) {
  fit();
  if (frame != null && o.atlasOn) {
    const P = prog("flip"), A = o.atlasOn; gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex(o.atlas)); gl.uniform1i(P.u.uAt, 1);
    gl.uniform2f(P.u.uR, cv.width, cv.height); gl.uniform2f(P.u.uCell, A.frameWidth, A.frameHeight); gl.uniform1f(P.u.uF, Math.min(A.frames - 1, frame)); const dist = Math.abs(frame - A.fullCoverFrame), fl = Math.max(0, 1 - dist / 2.2);
    gl.uniform1f(P.u.uFloor, fl * fl * (3 - 2 * fl)); gl.uniform1f(P.u.uHot, o.atlas === "fire" ? 1 : 0); gl.uniform3fv(P.u.uC, C.coal); gl.drawArrays(gl.TRIANGLES, 0, 3); return;
  }
  const P = prog(o.m), [a, b, c, e] = o.p; gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, noise); gl.uniform1i(P.u.uN, 0);
  gl.uniform2f(P.u.uR, cv.width, cv.height); gl.uniform2f(P.u.uD, o.d[0], o.d[1]); gl.uniform1f(P.u.uTime, (now - w.t0) / 1000); gl.uniform1f(P.u.uH, H); gl.uniform1f(P.u.uT, Tl);
  gl.uniform3fv(P.u.uA, a); gl.uniform3fv(P.u.uB, b); gl.uniform3fv(P.u.uC, c); gl.uniform3fv(P.u.uE, e); if (P.u.uJ) gl.uniform3fv(P.u.uJ, JEWELS.flat());
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
const coverEase = p => 1 - (1 - p) ** 2.2, revealEase = p => p ** 1.6;
function paint(now) {
  const o = w.o, m = o.r, R = reach(o), A = o.atlasOn;
  if (w.phase === "cover") { const p = o.cover ? Math.min(1, (now - w.t0) / o.cover) : 1, e = coverEase(p); w.p = p; draw(o, now, -m + e * (R + m), -m - .02, A ? e * A.fullCoverFrame : null); return p >= 1; }
  const p = Math.min(1, (now - w.rt) / w.rd), e = revealEase(p); w.p = p; draw(o, now, R + .02, -m - .02 + e * (R + m + .04), A ? A.fullCoverFrame + e * (A.frames - 1 - A.fullCoverFrame) : null); return p >= 1;
}
function swap() {
  if (!w || w.swapped) return; if (w.phase === "cover") try { paint(w.t0 + w.o.cover); } catch {} // a late frame clock still swaps under a full cover
  w.swapped = true; const path = w.path; w.path = null; undo = null; if (path) commitNav(path, "wave");
  if (!w) return; w.phase = "reveal"; const t = performance.now(); w.rt = t; w.rd = Math.max(180, Math.min(w.o.ms, w.t0 + MAX_MS - t));
}
function tick(now) {
  raf = 0; if (!w) return; raf = requestAnimationFrame(tick); now = Math.max(now, performance.now() - 40);
  const dt = now - w.last; w.last = now;
  if (w.frames++ > 0 && w.phase === "cover" && !w.peak) { // the governor, measured only before the swap: the swap frame is long on purpose: a heavy frame drops the resolution; a device that cannot keep up gets the plain transition from then on
    w.slow = dt > 48 ? w.slow + 1 : 0; w.vslow = dt > 150 ? w.vslow + 1 : 0;
    if (w.slow >= 2 && tier < TIERS.length - 1) { tier++; w.slow = 0; try { sessionStorage.setItem("oss:wave-tier", tier); } catch {} }
    if (w.vslow >= 3 && tier === TIERS.length - 1) { broken = true; abort(); return; }
  }
  try {
    const done = paint(now);
    if (w.phase === "cover" && done) { if (w.peak) swap(); else w.peak = true; }
    else if (w.phase === "reveal" && done) finish();
  } catch (e) { console.error("fx-wave: " + e); broken = true; abort(); }
}
function clearTimers() { if (!w) return; clearTimeout(w.swapT); clearTimeout(w.goneT); }
function hide() {
  if (raf) cancelAnimationFrame(raf); raf = 0; if (cv) { cv.style.display = "none"; cv.remove(); cv.width = cv.height = 0; }   // off the page and its pixels released; the compiled shaders stay warm
  clearTimeout(freeTimer); freeTimer = setTimeout(freeTex, FREE_MS);
}
function freeTex() { if (w || !gl || gl.isContextLost()) return; for (const k in tex) { gl.deleteTexture(tex[k]); delete tex[k]; } }
function finish() { const pending = w?.path; clearTimers(); w = null; hide(); undo = null; if (pending) commitNav(pending, "push"); }
function abort() { const pending = w?.path; clearTimers(); w = null; hide(); undo = null; if (pending) commitNav(pending, "push"); }
function lostGL() { gl = null; if (cv) cv.remove(); cv = null; progs = {}; tex = {}; noise = null; vao = null; if (w) abort(); }

function play(key, path) {
  if (!glInit()) return false;
  const base = W[key], o = { ...base, cover: base.c ?? 300, ms: base.ms ?? 480 }; if (base.atlas && atlas?.[base.atlas] && imgs[base.atlas]) o.atlasOn = atlas[base.atlas];
  try { if (o.atlasOn) { if (!atlasTex(o.atlas)) o.atlasOn = null; else prog("flip"); } if (!o.atlasOn) prog(o.m); } catch (e) { console.error("fx-wave: " + e); broken = true; return false; }
  clearTimeout(freeTimer); const t = performance.now(); lastStart = t;
  w = { key, o, path, t0: t, last: t, phase: "cover", frames: 0, slow: 0, vslow: 0, swapped: false, peak: false, rt: t, rd: o.ms, p: 0 };
  document.body.append(cv); cv.style.display = "block";
  if (!o.cover) { w.swapped = true; w.path = null; w.phase = "reveal"; try { paint(t); } catch (e) { console.error("fx-wave: " + e); broken = true; abort(); return false; } }
  else { underline(path); try { paint(t); } catch (e) { console.error("fx-wave: " + e); broken = true; abort(); return false; } w.swapT = setTimeout(swap, o.cover + 70); } // a stalled frame clock still lands the page
  w.goneT = setTimeout(finish, Math.min(GONE_MS, (o.cover || 0) + o.ms + 120)); raf = requestAnimationFrame(tick);
  return true;
}
// the page this wave was carrying is cancelled; the band itself keeps travelling, so nothing jumps
function drop(restore) { if (!w?.path) return; w.path = null; if (restore) undo?.(); undo = null; }
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
    return W[key].c !== 0; // Search commits in the same tap, so its keyboard can open
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
addEventListener("pointerdown", () => idle(() => { if (!gl || w || gl.isContextLost()) return; try { for (const k in imgs) atlasTex(k); } catch {} }), { passive: true, capture: true });   // the flipbooks are on the GPU before the finger lifts
idle(loadAtlas);
window.__wave = { get active() { return w ? { key: w.key, phase: w.phase, p: w.p, pending: w.path } : null; }, get canvas() { return cv; }, get tier() { return tier; }, sectionOf, waveFor };
