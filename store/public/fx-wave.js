import { commitNav, setNavGate } from "./route.js";
import { ART } from "./fx-wave-art.js";
// THE DRAW. Moving between the main sections pulls that section's own material across the counter: a designed leading edge, an
// opaque body that hides the page change, and a wake that leaves along the same bearing. One lazy WebGL2 canvas, z-index 15 (over the
// page and chips, under the top bar and dock), never takes a tap. If anything is wrong it steps aside and the normal transition runs.
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const TIERS = [1280, 900, 640], MAX_MS = 860, GONE_MS = 895, FREE_MS = 20000;

// the store's tokens (tokens.css) as display sRGB. Anything darker is worked out in OKLCH at the jewel's own hue, never by scaling sRGB.
function ok(L, C, h) {
  const r = h * Math.PI / 180, a = C * Math.cos(r), b = C * Math.sin(r), l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  const e = v => { v = Math.max(0, Math.min(1, v)); return v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055; };
  return [e(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s), e(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s), e(-.0041960863 * l - .7034186147 * m + 1.707614701 * s)];
}
const C = { coal: ok(.155, .012, 50), coal1: ok(.205, .014, 50), coal2: ok(.275, .014, 52), ash: ok(.72, .018, 70), bone: ok(.925, .022, 80), ruby: ok(.72, .15, 18), teal: ok(.78, .105, 190), cobalt: ok(.72, .12, 265), emberlt: ok(.77, .14, 55), emerald: ok(.78, .13, 155), gilt: ok(.83, .12, 88), amethyst: ok(.76, .105, 312), bonelt: ok(.90, .03, 80), ember: ok(.58, .215, 29), ashlt: ok(.80, .012, 60) };
const mid = h => ok(.46, .09, h), deep = h => ok(.30, .055, h), S2 = Math.SQRT1_2;
const tone = (c, h, accent = C.bone) => [c, mid(h), deep(h), accent];

// THE TILE ARRIVES. Every wave is the destination's own header colour: the material lives only on the leading edge, the body and tail are the flat token.
// m: edge, d: bearing (screen, y up), e: how far the edge reaches past the frame in CSS px (r: the same as a share of travel), p: [body, mid, deep, accent], c and ms: cover and reveal
const W = {
  hookahs: { m: "smoke", d: [S2, S2], e: 400, p: [C.bone, C.ash, C.coal, C.bonelt] },   // flowing inked clouds in bone and ash, never pink
  heat: { m: "fire", d: [0, 1], e: 290, p: [C.emberlt, C.ember, C.coal, C.gilt] },      // drawn flames: ember, the Heat tile's orange and gilt, with a coal ink line
  charcoal: { m: "motes", d: [-.38, .925], e: 130, p: [C.ashlt, ok(.50, .17, 32), C.coal2, ok(.72, .17, 50)] },   // a coal burning down to ash: the ash tile arrives behind a glowing ember edge, throwing ember sparks
  bases: { m: "water", d: [0, 1], e: 80, p: tone(C.teal, 190) },
  bowls: { m: "fly", sprite: "bowls", d: [0, -1], e: 300, p: tone(C.cobalt, 265) },
  hoses: { m: "rope", d: [1, 0], e: 2, p: tone(C.emerald, 155), c: 340, ms: 500 },
  parts: { m: "fly", sprite: "parts", d: [-1, 0], e: 300, p: tone(C.gilt, 88) },
  cologne: { m: "mist", d: [-S2, -S2], e: 380, p: [C.amethyst, ok(.62, .1, 312), deep(312), ok(.86, .06, 312)] },
  misc: { m: "fly", sprite: "misc", d: [S2, -S2], e: 300, p: tone(C.bonelt, 80) },
  home: { m: "motes", d: [.38, .925], e: 110, c: 220, ms: 360, p: [C.coal, C.gilt, C.coal2, C.ember] },
  all: { m: "fly", sprite: "all", d: [0, 1], e: 300, p: tone(C.bonelt, 80) },
  gifts: { m: "fly", sprite: "gifts", d: [S2, S2], e: 300, p: tone(C.cobalt, 265) },
  set: { m: "fly", sprite: "set", d: [-S2, S2], e: 300, p: tone(C.ruby, 18) },
  shipping: { m: "fly", sprite: "shipping", d: [1, 0], e: 300, p: tone(C.cobalt, 265) },
  search: { m: "fly", sprite: "search", d: [-.38, -.925], e: 300, p: tone(C.teal, 190), c: 150, ms: 230 },
  cart: { m: "fly", sprite: "cart", d: [.92, .38], e: 300, p: tone(C.gilt, 88), c: 170, ms: 260 },
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
  // puffy smoke that flows: billows ride a winding current, lean and stretch along it, roll on their own axis and swell, each with a shadow, a crescent of light and a curl of brush ink
  smoke: `float gS, gD, gR, gP; vec2 gO;
  float puff(vec2 q, float k) { float W = 118., SP = 92., dir = mod(k, 2.) > .5 ? 1. : -1., x = q.x + k * 53. + dir * uTime * 34., id = floor(x / W), m = 1e5, cy = k * SP + 104.; gS = H2(vec2(k, 4.)) * .5; gD = -1e5; gO = vec2(0., 240.); gR = 80.; gP = .5;
    for (float i = -1.; i < 2.; i++) { float n = id + i, s = H2(vec2(n, k)), pl = .5 + .5 * sin(((n + .5) * W - k * 53. - dir * uTime * 34.) / 150. + k * .28), R = (52. + 54. * s * s) * mix(.58, 1., ss(.25, .8, pl)) * mix(.65, 1., ss(0., 5., k)) * (1. + .16 * min(uTime, .9)); vec2 u = vec2(x, q.y) - vec2((n + .5 + (H2(vec2(n, k + 3.)) - .5) * .42) * W, cy + (s - .5) * 76.);
      float ang = .55 * sin(cy / 190. + n * .7 + uTime * 1.3), ca = cos(ang), sa = sin(ang); u = vec2(ca * u.x + sa * u.y, -sa * u.x + ca * u.y); u.x *= .62;
      float a = atan(u.y, u.x) + dir * uTime * (.9 + s * .7), lobe = R * (.13 * abs(sin(a * (3. + floor(s * 3.)) + s * 9.)) + .045 * abs(sin(a * (7. + floor(s * 3.)) - s * 5.))), d = length(u) - R * .9 - lobe;
      if (d < m) m = d; if (d < 0.) { gD = d; gS = H2(vec2(n + 9., k)); gO = u; gR = R; gP = pl; } }
    return min(m, cy + 20. + 40. * sin(x / 137. + k * 1.7 + uTime * 1.1) + 22. * sin(x / 61. - k) - q.y); }
  ${SIG} { vec2 wv = vec2(sin(p.y / 170. + uTime * 1.1) + .6 * sin(p.x / 97. - uTime * .8 + p.y / 230.), cos(p.x / 150. - uTime * .9) + .6 * cos(p.y / 110. + uTime * .7 + p.x / 260.)) * .5, q = vec2(f.x + wv.x * 44. + 78. * sin(h / 300. - uTime * 1.7), h + wv.y * 26.); float z = clamp(uV.x / 620., 1., 1.7); q /= z; float k0 = floor(q.y / 92.);
    for (float k = k0 + 1.; k >= max(0., k0 - 2.); k--) { float d = puff(q, k); if (d < 0.) { vec2 u = gO / gR; float g = .22 * sin(gO.x / (gR * .45) + gS * 6.) * cos(gO.y / (gR * .5) - gS * 4.), aa = 1.5 * PX / (gR * z), sh = length(u + vec2(.2, .4)) + g * .7;
        c = gP > .62 ? uE : gP > .3 ? uA : mix(uA, uB, .5); c = mix(c, uB, ss(.98, .98 + aa, sh)); c = mix(c, mix(uB, uC, .16), ss(1.24, 1.24 + aa, sh)); c = mix(c, vec3(.985, .975, .955), .8 * (1. - ss(.4, .4 + aa, length(u + vec2(.26, .44)) + g * .9)) * ss(.3, .3 + aa, length(u + vec2(.12, .26))));
        if (gD < -9e3) c = mix(uB, uA, .3); vec2 cu = u - vec2(.08, .06); float cr = length(cu), th = atan(cu.y, cu.x), arc = ss(-2.4, -1., th) * (1. - ss(2.2, 3., th)), ink = 1.1 + .7 * sin(th + gS * 6.28); c = mix(c, uC, .85 * step(.75, fract(gS * 7.)) * arc * (1. - ss(ink - .5, ink + .5, abs((cr - .44 - .07 * th - g * .22) * gR * z))));
        float bw = 1.7 * ss(-.25, .75, dot(gO / (length(gO) + .001), vec2(.45, .89)) + .25 * sin(gS * 6.28)); c = mix(c, uC, ss(.3, 1., bw) * ss(-bw - .5, -bw + .5, gD * z)); break; } }
    h = -puff(q, 0.) * z; float b = t + 34. * (abs(sin(f.x / 52. + uTime * 1.4)) - 1.); c = mix(uC, c, E(b - 3.)); t = b; }`,
  // cartoon fire: rows of curling teardrop flames, each one ember outside, the Heat orange inside, a gilt heart, under a coal ink line
  fire: `float tear(vec2 q, float W, float T, float bend, float bulb) { float u = clamp(q.y / T, 0., 1.), x = q.x - bend * u * u * W * .5; return q.y > T ? T - q.y : W * .56 * pow(1. - u, .85) * (1. + .6 * u) * mix(1., sqrt(min(1., u * 5.)), bulb) - abs(x); }
  float row(vec2 p, float k, out vec3 col) { float W = 132., T = 230., x = p.x + mod(k, 2.) * W * .5 + k * 19., id = floor(x / W), best = -1e5, y = k * 136. + T - p.y; col = uB;
    for (float i = -1.; i < 2.; i++) { float n = id + i, s = H2(vec2(n, k)), Ts = T * (.72 + .38 * s), bd = (s - .5) * 1.1 + .35 * sin(uTime * 6. + s * 6.28); vec2 q = vec2(x - (n + .5) * W, y); float d = y < 0. ? max(-y, tear(q, W, Ts, bd, 0.)) : tear(q, W, Ts, bd, 0.); vec2 qi = q - vec2(0., Ts * .08);
      if (d > best) { best = d; col = uB; if (y >= 0.) { if (tear(q - vec2(W * .13, 0.), W * .8, Ts * .92, bd, 0.) < 0.) col = mix(uB, uC, .28); if (tear(qi, W * .62, Ts * .74, bd, 1.) > 0.) col = tear(qi + vec2(W * .07, 0.), W * .42, Ts * .62, bd, 1.) > 0. ? mix(uA, uE, .45) : uA; if (tear(qi, W * .3, Ts * .44, bd, 1.) > 0.) col = uE; if (tear(qi, W * .12, Ts * .24, bd, 1.) > 0.) col = mix(uE, vec3(.98, .95, .86), .7); } } }
    return best; }
  ${SIG} { vec3 col; vec2 g = vec2(f.x + 130. * (fbm(vec2(f.x / 3400., h / 4600. - uTime * .22)) - .5), h); float k0 = floor(h / 136.);
    for (float k = k0 + 1.; k >= max(0., k0 - 2.); k--) { float d = row(g, k, col); if (d > 0.) { c = mix(uC, col, E(d - 2.6)); break; } }
    h = row(g, 0., col); float b = t - 40. * abs(sin(f.x / 48. + uTime * 2.)); c = mix(uC, c, E(b - 3.)); t = b; }`,
  // bases: the screen fills like a glass base. A foaming water line surges up, layered currents behind it, big bubbles rising through all of it
  water: `void bub(vec2 q, float P, float v, float sd, inout vec3 c) { vec2 g = vec2(q.x + 9. * sin(q.y / 60. + sd + uTime * 3.), q.y - uTime * v) / P + sd, id = floor(g); if (H2(id + sd) > .56) return; vec2 j = (vec2(H2(id + 1.), H2(id + 2.)) - .5) * .36, u = (fract(g) - .5 - j) * P; float z = H2(id + 3.), r = P * (.1 + .2 * z), d = length(u) - r; if (d > 1.5) return;
    vec3 b = mix(c, uE, .2); b = mix(b, uC, ss(-2.6, -1.6, d)); b = mix(b, uE, 1. - E(length(u + vec2(r * .34, -r * .38)) - r * .22)); c = mix(b, c, ss(.6, 1.4, d)); }
  ${SIG} { float T = uTime, z = clamp(uV.x / 620., 1., 1.5), w = 14. * sin(f.x / 61. + T * 5.) + 8. * sin(f.x / 27. - T * 7. + 1.), hh = h + w - 30., b1 = hh - 48. - 12. * sin(f.x / 83. - T * 4.), b2 = hh - 150. - 18. * sin(f.x / 120. + T * 3. + 2.), b3 = hh - 310. - 22. * sin(f.x / 150. - T * 2.4), tb = t + 12. * sin(f.x / 70. + T * 3.); vec2 q = f / z;
    c = uE; c = mix(c, mix(uA, uE, .38), E(hh - 13.)); c = mix(c, uA, E(b1)); c = mix(c, mix(uA, uB, .2), E(b2)); c = mix(c, mix(uA, uB, .36), E(b3)); c = mix(uA, c, E(tb - 120.)); c = mix(uC, c, E(abs(b1) - 1.2));
    if (hh > 18.) { bub(q, 118., 250., 1., c); bub(q, 62., 360., 7., c); } c = mix(uC, c, E(hh - 2.6)); c = mix(uC, c, E(tb - 2.5)); h = hh; t = tb; }`,
  // hoses: one long braided hose with a brass tip coils in from the edge to the centre until it covers the page, then unwinds from the centre out to show the new one
  rope: `${SIG} { float P = clamp(uV.x / 6.2, 56., 96.), W = P * .5, TAU = 6.28318, r = length(p), th = mod(atan(p.y, p.x) + uTime * 1.2, TAU), ring = floor(r / P - th / TAU + .5), phi = max(th + TAU * ring, 0.), vr = r - P * phi / TAU, arc = P / (2. * TAU) * phi * phi, Rm = length(uV) * .5 + P, pm = TAU * (Rm / P + 1.2), Am = P / (2. * TAU) * pm * pm, span = Am + W + 40., Ah = -W - 20. + span * (1. - clamp(uH, 0., 1.)), At = -W - 20. + span * clamp(uT, 0., 1.), cap = W - sqrt(max(W * W - vr * vr, 0.)), a = arc - Ah, v = clamp(vr / W, -1., 1.), ed = (1. - abs(v)) * W;
    vec3 b = uA; b = mix(b, mix(b, uC, .4), ss(.26, .31, v)); b = mix(b, mix(b, uC, .24), ss(.68, .73, fract((arc + v * W * .9) / 15.))); b = mix(b, mix(b, uE, .68), 1. - ss(.12, .18, abs(v + .44)));
    if (a < 58.) { b = mix(vec3(${C.gilt}), vec3(.98, .94, .78), 1. - ss(.13, .2, abs(v + .42))); b = mix(b, mix(vec3(${C.gilt}), uC, .45), ss(.3, .36, v)); } b = mix(uC, b, E(abs(a - 58.) - 1.4)); c = mix(uC, b, ss(1.6, 2.8, ed)); float hh = a - cap, tb = arc - At - cap; c = mix(uC, c, E(hh - 2.6)); c = mix(uC, c, E(tb - 2.6)); h = hh; t = tb; }`,
  // home: the coal itself arrives behind a burning edge of gilt and ember, with embers rising through it
  motes: `${SIG} { float e = h - 26. + 130. * (fbm(vec2(f.x / 3400., h / 4600.)) - .5); c = mix(uB, mix(uE, uA, E(e - 18.)), E(e - 7.)); vec2 g = vec2(p.x + 12. * sin(p.y / 90. + uTime * 3.), p.y - uTime * 190.) / 44., id = floor(g); if (e > 20. && H2(id) > .55) { vec2 j = (vec2(H2(id + 1.), H2(id + 2.)) - .5) * .5, u = (fract(g) - .5 - j) * 44.; float z = H2(id + 3.), d = 1.3 + 3.4 * z * z - length(u * vec2(1., .42)); c = mix(c, mix(uE, uB, H2(id + 4.)), E(d)); } h = e; }`,
};
// cologne: an aerosol. A tight pressurised jet leaves the nozzle with a bright dense core, then blooms into an ultra-fine spray and soft amethyst mist that fills the screen
MAT.mist = `float sp(vec2 p, vec2 nz, float pitch, float k, float dn, float big, float seed) { vec2 a = nz + (p - nz) / (1. + uTime * k), g = a / pitch + seed, id = floor(g); if (H2(id + seed) > dn) return 0.; vec2 j = (vec2(H2(id + 1.), H2(id + 2.)) - .5) * .86; float z = H2(id + 3.), rad = pitch * (.12 + big * z * z * z); vec2 o = (fract(g) - .5 - j) * pitch * (1. + uTime * k), dr = normalize(p - nz + .001); float al = dot(o, dr) / (1. + uTime * 1.2), ac = dot(o, vec2(-dr.y, dr.x)), d = rad - length(vec2(al, ac)); return (.5 + .5 * H2(id + 4.)) * ss(-.8, .6, d); }
  ${SIG} { vec2 nz = uV * .5 - vec2(min(uV.x * .16, 180.), 96.), w = abs(nz) + uV * .5, dir = normalize(p - nz + .001); float r = length(p - nz), RM = length(w), hr = uH * RM - r, tr = r - uT * RM, n = fbm(p / 11000. + vec2(-uTime * .03, uTime * .02)), n2 = fbm(p / 6400. + vec2(uTime * .035, .31)), fo = (n - .5) * 190.;
    float th = acos(clamp(dot(dir, vec2(-.6, -.8)), -1., 1.)) + (n2 - .5) * .42, wd = mix(.13, 5., pow(clamp(uH, 0., 1.), 2.2)), cn = 1. - ss(wd * .72, wd * 1.25, th), ce = 1. - ss(wd * .9, wd * 1.7, th), core = exp(-pow(th / (wd * .42), 2.));
    float m = ss(-60., 130., hr + fo) * ss(-60., 130., tr - fo) * cn, env = ss(-240., -40., hr + fo * .6) * ss(-230., -30., tr - fo * .6) * ce, pk = 1. - ss(70., 420., hr), dn = env * (.3 + .45 * pk), d1 = sp(p, nz, 3.4, 2.2, dn * .72, .13, 1.), d2 = sp(p, nz, 5.6, 3., dn * .85, .14, 7.), d3 = sp(p, nz, 10., 4., dn * .4, .1, 13.), da = max(d1, max(d2, d3));
    vec3 b = mix(mix(uA, uB, .12), mix(uA, uE, .5), ss(.34, .66, .6 * n + .4 * n2)); b = mix(b, mix(uE, vec3(.99), .4), .78 * core * exp(-r / (.75 * RM))); c = mix(b, mix(uE, vec3(.99), .35), da * .8); h = (max(m, da) - .5) * 1.5 * PX; t = PX * 9.; }`;
// the section's own drawn header objects, small, spinning and flying across the screen in three depths and speeds, ahead of and over its colour tile. Parts, Bowls, Misc, Everything, Gifts, Build a set, Shipping, Search and Cart
MAT.fly = `uniform sampler2D uS; uniform float uHas; vec4 spr(vec2 w, float i, float l) { if (w.x < .006 || w.x > .994 || w.y < .006 || w.y > .994) return vec4(0.); i = mod(i, 4.); return textureLod(uS, (vec2(mod(i, 2.), floor(i / 2.)) + vec2(w.x, 1. - w.y)) / 2., l); }
  void lay(vec2 p, float S, float v, float sd, float dn, inout vec3 ac, inout float aa) { vec2 drift = uD * uTime * v, g = (p - drift) / S; float ro = floor(g.y), sh = H1(ro + sd); g.x += sh; vec2 id = floor(g); if (H2(id + sd) > dn) return; vec2 j = (vec2(H2(id + sd + 1.), H2(id + sd + 2.)) - .5) * .14, u = (fract(g) - .5 - j) * S, ctr = (id + .5 + j - vec2(sh, 0.)) * S + drift; float sc = dot(ctr, uD) + L * .5, k = min(clamp((uH * L + 150. - sc) / 70., 0., 1.), clamp((sc - uT * L + 150.) / 70., 0., 1.)); if (k <= 0.) return; k = k * k * (3. - 2. * k);
    float an = (H2(id + sd + 4.) - .5) * 6.28 + uTime * (H2(id + sd + 5.) < .5 ? -1. : 1.) * (2.2 + 2.6 * H2(id + sd + 6.)) * (sd > 12. ? .55 : 1.), ca = cos(an), sa = sin(an), sz = S * .7 * max(k, .01); vec2 w = vec2(ca * u.x + sa * u.y, -sa * u.x + ca * u.y) / sz + .5; float l = max(0., log2(float(textureSize(uS, 0).x) * .5 * PX / sz)); vec4 t = spr(w, id.x + id.y * 2. + sd, l); if (sd > 12.) { float o = ss(.08, .3, spr(w, id.x + id.y * 2. + sd, l + 2.).a); ac = aa < .001 ? vec3(.93, .91, .86) : mix(ac, vec3(.93, .91, .86), o); aa = max(aa, o); } if (t.a <= 0.) return; ac = aa < .001 ? t.rgb : mix(ac, t.rgb, t.a); aa += t.a * (1. - aa); }
  ${SIG} { float z = clamp(uV.x / 620., 1., 1.6), aa = 0.; vec3 ac = vec3(0.); if (uHas > .5) { lay(p, 72. * z, 980., 1., .7, ac, aa); lay(p, 104. * z, 1360., 7., .5, ac, aa); lay(p, 164. * z, 1780., 13., .34, ac, aa); }
    float bh = h - 60. + 14. * z * sin(f.x / (53. * z) + uTime * 4.), b = t - 18. - 16. * z * sin(f.x / (37. * z) + uTime * 3.), m = E(bh) * E(b); vec3 tile = mix(uC, uA, E(bh - 3.) * E(b - 3.)); c = mix(ac, mix(tile, ac, aa), m); h = (max(m, aa) - .5) * 1.5 * PX; t = PX * 9.; }`;
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

let cv = null, gl = null, par = null, vao = null, noise = null, progs = {}, broken = false, tier = 0, atlas = null, tex = {}, imgs = {}, w = null, raf = 0, freeTimer = 0, undo = null, lastD = null, proxy = null;
try { tier = Math.min(2, +sessionStorage.getItem("oss:wave-tier") || 0); } catch {}
const saveData = () => !!navigator.connection?.saveData;

function glInit() {
  if (gl) return true; if (broken) return false;
  cv = document.createElement("canvas"); cv.width = cv.height = 0; cv.className = "fx-wave"; cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100lvh;z-index:15;pointer-events:none;display:block;opacity:0;transform-origin:0 0"; shown = ""; css = null;
  // "default", not "high-performance": on a two-GPU laptop asking for the big GPU switches the whole machine over at that moment, a visible hitch
  gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "default", desynchronized: false });
  if (!gl) { cv = null; broken = true; return false; }
  par = gl.getExtension("KHR_parallel_shader_compile");
  cv.addEventListener("webglcontextlost", e => { e.preventDefault(); lostGL(); });
  return setup();
}
function setup() {
  vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  const n = 256, d = new Uint8Array(n * n), r = new Uint8Array(n * n); for (let i = 0; i < r.length; i++) r[i] = Math.random() * 256;
  // tiling value noise: every texel the average of a small wrapped neighbourhood, stretched back to full range. The 5x5 box runs as two 5-tap passes (same result, a fifth of the work)
  let lo = 255, hi = 0; const row = new Float32Array(n * n), sum = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let i = -2; i <= 2; i++) s += r[y * n + (x + i + n) % n]; row[y * n + x] = s; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let j = -2; j <= 2; j++) s += row[((y + j + n) % n) * n + x]; s /= 25; sum[y * n + x] = s; if (s < lo) lo = s; if (s > hi) hi = s; }
  for (let i = 0; i < d.length; i++) d[i] = (sum[i] - lo) / (hi - lo) * 255;
  noise = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, noise); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, d); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return !gl.isContextLost();
}
// Compiling is split in two. start() hands the source to the driver and returns at once; with KHR_parallel_shader_compile the driver
// compiles on its own threads. ready() asks for the result, which blocks only if the compile is still running, so it is asked for when
// the extension says the work is done (warm), or at a tap that came first (the old cost, paid once).
function start(fs) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const p = gl.createProgram(), a = sh(gl.VERTEX_SHADER, VERT), b = sh(gl.FRAGMENT_SHADER, fs); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
  return { p, a, b, u: null };
}
function ready(P) {
  if (P.u) return P;
  if (!gl.getProgramParameter(P.p, gl.LINK_STATUS) && !gl.isContextLost()) { const log = [P.a, P.b].map(s => gl.getShaderInfoLog(s)).join(" ") + " " + gl.getProgramInfoLog(P.p); throw new Error("wave shader: " + log); }
  gl.deleteShader(P.a); gl.deleteShader(P.b); P.a = P.b = null;
  const u = {}, n = gl.getProgramParameter(P.p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(P.p, i).name.replace("[0]", ""); u[name] = gl.getUniformLocation(P.p, name); }
  P.u = u; return P;
}
const srcOf = key => key === "flip" ? FLIP : HEAD + MAT[key] + FOOT;
const prog = key => ready(progs[key] || (progs[key] = start(srcOf(key))));
const compiling = key => { const P = progs[key]; return !!P && !P.u && !!par && !gl.getProgramParameter(P.p, par.COMPLETION_STATUS_KHR); };
// THE SLOT for the baked art. A new bake only changes its entry here: file, grid, cell size, full-cover frame, and optionally flow (a same-grid RG map) with flowMax (its reach in cell UV).
const BOOKS = { parts: { file: "parts.webp", mip: true }, bowls: { file: "kit-bowls.webp", mip: true }, misc: { file: "kit-misc.webp", mip: true }, set: { file: "kit-set.webp", mip: true }, shipping: { file: "kit-shipping.webp", mip: true }, search: { file: "kit-search.webp", mip: true }, cart: { file: "kit-cart.webp", mip: true }, gifts: { file: "kit-gifts.webp", mip: true }, all: { file: "kit-all.webp", mip: true } };   // empty: smoke and fire are drawn in their shaders now, so nothing extra downloads
// the flipbooks are asked for when the browser is idle, never on Save-Data or reduced motion
const FIRST_BOOKS = ["all", "cart", "search"];   // what the dock and the hero reach first; the other six wait for the shopper's first touch, scroll or key
function loadAtlas() {
  if (atlas || saveData() || RM.matches) return; atlas = {}; loadBooks(FIRST_BOOKS);
  const evs = ["pointerdown", "touchstart", "keydown", "scroll", "click"], rest = () => { evs.forEach(e => removeEventListener(e, rest, true)); loadBooks(Object.keys(BOOKS).filter(k => !FIRST_BOOKS.includes(k))); };
  evs.forEach(e => addEventListener(e, rest, { passive: true, capture: true }));
}
function loadBooks(keys) {
  for (const k of keys) { const B = BOOKS[k], im = new Image(); im.decoding = "async"; im.src = "img/wave/" + B.file + "?v=" + (ART[B.file] || "0");   /* the version is the file's own hash, from tools/build-wave-art.mjs */
    const fl = B.flow ? new Image() : null; if (fl) { fl.decoding = "async"; fl.src = "img/wave/" + B.flow; }
    Promise.all([im.decode(), fl?.decode()]).then(() => { atlas[k] = B; imgs[k] = im; if (fl) imgs[k + ":flow"] = fl; if (warmed) idle(upAll); }).catch(() => {}); }   // decoded off the main thread, so the tap never pays for it
}
function upload(key, unit, im) {
  if (tex[key]) return tex[key]; const t = gl.createTexture(); gl.activeTexture(unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); while (gl.getError()); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, im); if (gl.getError()) { gl.deleteTexture(t); delete imgs[key]; return null; }
  if (BOOKS[key]?.mip) gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, BOOKS[key]?.mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex[key] = t;
}
function atlasTex(k) { const im = imgs[k]; if (!im) return null; if (imgs[k + ":flow"]) upload(k + ":flow", gl.TEXTURE2, imgs[k + ":flow"]); return upload(k, gl.TEXTURE1, im); }
function fit() {   // sized once: the shaders work in CSS pixels, so a later rotation only stretches the buffer. A slower tier applies from the next page load.
  if (cv.width < 2) { const [cw, ch] = cssSize(), dp = Math.min(2, devicePixelRatio || 1), long = Math.min(TIERS[tier], Math.max(cw, ch) * dp), k = long / Math.max(cw, ch); cv.width = Math.max(2, Math.round(cw * k)); cv.height = Math.max(2, Math.round(ch * k)); }
  view();
}
// THE RENDER SCALE. The effect can draw into the top-left part of its buffer and the canvas is stretched back over the screen with a
// CSS transform: fewer pixels for the shader, no resize (WebKit stops presenting a resized WebGL canvas), and it can change between two frames.
let res = 1, shown = "";
try { res = Math.max(.5, Math.min(1, +sessionStorage.getItem("oss:wave-res") || 1)); } catch {}
let vp = [0, 0];
function view() {
  const vw = Math.max(2, Math.round(cv.width * res)), vh = Math.max(2, Math.round(cv.height * res)); vp = [vw, vh];
  gl.viewport(0, cv.height - vh, vw, vh);
  const tf = res === 1 ? "" : `scale(${cv.width / vw},${cv.height / vh})`; if (tf !== shown) { shown = tf; cv.style.transform = tf; }
}
function lower(to) { to = Math.max(.5, to); if (to >= res) return; res = to; try { sessionStorage.setItem("oss:wave-res", res); } catch {} }

// which section a path belongs to
const CATS = new Set(["hookahs", "bases", "bowls", "heat", "charcoal", "hoses", "parts", "cologne", "misc"]);
function sectionOf(path) {
  const [a = "", b] = path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "").split("/");
  // shisha rides the bowls wave. (The gifts/set/shipping/search/cart line below once sat after this comment on one
  // line, which commented it out: those pages lost their waves. Keep it on its own line.)
  if (!a) return "home"; if (a === "shop") return !b ? "all" : CATS.has(b) ? b : b === "shisha" ? "bowls" : "missing";
  if (a === "gifts" || a === "set" || a === "shipping" || a === "search" || a === "cart") return a;
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
// the canvas's CSS size, read once and again only after a resize: reading it inside a frame right after the page swap forced the browser
// to lay out the whole new page there and then
let css = null; addEventListener("resize", () => { css = null; }, { passive: true });
// Before the canvas is on the page (it is only attached by the first wave) a stand-in of the same CSS box is measured, at a quiet moment
function box() { const d = document.createElement("div"); d.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100lvh;visibility:hidden;pointer-events:none"; document.body.append(d); const r = [d.clientWidth || innerWidth, d.clientHeight || innerHeight]; d.remove(); return r; }
const cssSize = () => css || (css = cv?.isConnected ? [cv.clientWidth || innerWidth, cv.clientHeight || innerHeight] : box());
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
  if (P.u.uS) { const st = o.sprite && imgs[o.sprite] ? atlasTex(o.sprite) : null; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, st); gl.uniform1i(P.u.uS, 1); gl.uniform1f(P.u.uHas, st ? 1 : 0); }
  gl.uniform2f(P.u.uR, vp[0], vp[1]); gl.uniform2f(P.u.uV, vw, vh); gl.uniform2f(P.u.uD, o.d[0], o.d[1]); gl.uniform1f(P.u.uTime, (now - o.t0) / 1000); gl.uniform1f(P.u.uH, H); gl.uniform1f(P.u.uT, Tl);
  gl.uniform3fv(P.u.uA, a); if (P.u.uB) gl.uniform3fv(P.u.uB, b); if (P.u.uC) gl.uniform3fv(P.u.uC, c); if (P.u.uE) gl.uniform3fv(P.u.uE, e);
  gl.drawArrays(gl.TRIANGLES, 0, 3); o.lastH = H; o.lastT = Tl;
}
// one unbroken pass: the head arrives still moving and the tail leaves at that same speed, so nothing stops dead at the page swap
const coverEase = p => (1 - (1 - .82 * p) ** 2) / .9676, revealEase = p => ((.18 + .82 * p) ** 2 - .0324) / .9676;
function paint(now) {
  const o = w.o, m = margin(o), A = o.atlasOn;
  if (w.phase === "cover") { const p = Math.min(1, (now - w.t0) / o.cover), e = coverEase(p); w.p = p; const u = w.under;   // a wave that was interrupted holds its place underneath until the new one has covered it
    if (u) { gl.disable(gl.BLEND); u.forEach((x, i) => { draw(x, now, x.lastH, x.lastT, null); if (!i) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } }); }
    try { draw(o, now, -m + e * (1 + 2 * m), -m - .02, A ? e * A.fullCoverFrame : null); } finally { if (u) gl.disable(gl.BLEND); } return p >= 1; }
  if (!w.rt) { if (document.documentElement.hasAttribute("data-swapping")) { draw(o, now, 1 + m + .02, -m - .02, A ? A.fullCoverFrame : null); return false; } unveil(now); }   // app.js is still putting the new page in (its own task): hold the full cover one frame more
  const p = Math.min(1, (now - w.rt) / w.rd), e = revealEase(p); w.p = p; draw(o, now, 1 + m + .02, -m - .02 + e * (1 + 2 * m + .04), A ? A.fullCoverFrame + e * (A.frames - 1 - A.fullCoverFrame) : null); return p >= 1;
}
// Search: an input focused inside the tap, so a phone opens its keyboard; the real field takes the focus over at the swap.
// Only on a touch screen (iPhone, iPad, Android): iOS and Android open the on-screen keyboard only for a focus made inside the
// tap, while a desktop with a mouse has no such rule and the search field is focused once the page is in (app.js). On Windows
// the early focus woke the system's text services and held the next frame 68-100 ms at 2x CPU (wave-perf, 2026-11-26).
// The tap itself decides: the last pointer down was a finger or a pen (a 2-in-1 or a tablet with a mouse still taps with a
// finger), or, before any pointer event, a coarse primary pointer (never the user agent: an iPad reports itself as a Mac).
const COARSE = matchMedia("(pointer: coarse)"); let lastPointer = "";
addEventListener("pointerdown", e => { lastPointer = e.pointerType || ""; }, { capture: true, passive: true });
const touchTap = () => lastPointer ? lastPointer === "touch" || lastPointer === "pen" : COARSE.matches;
function holdKeyboard() { if (!touchTap()) return; const i = document.createElement("input"); i.type = "search"; i.tabIndex = -1; i.setAttribute("aria-label", "Search"); i.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none;z-index:14"; document.body.append(i); i.focus({ preventScroll: true }); proxy = i; }
function dropKeyboard() { if (!proxy) return; const i = proxy; proxy = null; i.remove(); }
function swap() {
  if (!w || w.swapped) return; if (w.phase === "cover") try { paint(w.t0 + w.o.cover); } catch {} // a late frame clock still swaps under a full cover
  w.swapped = true; w.under = null; w.skip = 2; const path = w.path; w.path = null; undo = null; if (path) commitNav(path, "wave"); dropKeyboard();
  if (!w) return; w.phase = "reveal"; w.rt = 0; clearTimeout(w.goneT); w.goneT = setTimeout(finish, w.o.ms + 600);   // the reveal's clock starts at its first frame (unveil)
}
// The new page is built, styled and laid out in the frame after the swap, and on a slow phone that frame is long. The reveal clock starts
// when the first frame after it arrives, so the screen holds at full cover through that frame and the wake then leaves in one smooth
// pass, instead of jumping a third of the way the moment the frame lands.
function unveil(now) {
  w.rt = now; w.rd = Math.max(120, Math.min(w.o.ms, w.t0 + Math.min(MAX_MS, w.o.cover + w.o.ms) - now));   // the whole pass keeps its time budget: a slow swap makes the wake leave a little faster, never later
  clearTimeout(w.goneT); w.goneT = setTimeout(finish, w.rd + 90);
}
function tick(now) {
  raf = 0; if (!w) return; raf = requestAnimationFrame(tick); now = Math.max(now, performance.now() - 40);
  if (w.hold) { try { if (!release(now)) return; } catch (e) { console.error("fx-wave: " + e); broken = true; abort(); return; } now = w.t0; }
  const dt = now - w.last; w.last = now;
  if (w.frames++ > 0 && !w.skip) { w.sum += dt; w.n++;   // frame times for the governor, leaving out the swap and the frame that first paints the new page
    // three frames in a row under 25 fps: fewer pixels from the next frame on, for the rest of the visit. A steady 30 fps (Low Power Mode) is left alone
    w.slow = dt > 40 ? w.slow + 1 : 0; if (w.slow >= 3 && res > .5) { w.slow = 0; lower(res - .25); } }
  w.skip = Math.max(0, w.skip - 1);
  try {
    const done = paint(now);
    if (w.phase === "cover" && done) { if (w.peak) swap(); else w.peak = true; }
    else if (w.phase === "reveal" && done) finish();
  } catch (e) { console.error("fx-wave: " + e); broken = true; abort(); }
}
function clearTimers() { if (!w) return; clearTimeout(w.swapT); clearTimeout(w.goneT); }
function hide() {
  if (raf) cancelAnimationFrame(raf); raf = 0; if (cv) cv.style.opacity = "0";   // it stays attached and keeps its size: WebKit stops presenting a WebGL canvas that was resized or re-attached. The compiled shaders stay warm
}
// the sheets stay on the GPU while the shop is on screen (re-uploading one inside a tap is a stutter); a tab left in the background gives them back
function freeTex() { if (w || !gl || gl.isContextLost() || !document.hidden) return; for (const k in tex) { gl.deleteTexture(tex[k]); delete tex[k]; } }
document.addEventListener("visibilitychange", () => { clearTimeout(freeTimer); if (document.hidden) freeTimer = setTimeout(freeTex, FREE_MS); else if (warmed) idle(upAll); });
function finish() { const pending = w?.path; if (w?.n >= 2 && w.sum / w.n > 40 && tier < TIERS.length - 1) { tier++; try { sessionStorage.setItem("oss:wave-tier", tier); } catch {} } /* a slow device keeps its transitions and gets a lighter resolution from the next page load */ clearTimers(); w = null; hide(); undo = null; if (pending) commitNav(pending, proxy ? "wave" : "push"); dropKeyboard(); }
function abort() { const pending = w?.path; clearTimers(); w = null; hide(); undo = null; if (pending) commitNav(pending, proxy ? "wave" : "push"); dropKeyboard(); }
function lostGL() { gl = null; par = null; if (cv) cv.remove(); cv = null; progs = {}; tex = {}; noise = null; vao = null; warmed = false; if (w) abort(); }

// Never more than two full-screen colour changes in any second, however fast someone taps: past that the plain page change runs.
const starts = [], tooFast = t => { while (starts.length && t - starts[0] > 1000) starts.shift(); return starts.length >= 2; };
function play(key, path, under = null) {
  if (tooFast(performance.now())) return false;
  if (!glInit()) return false; starts.push(performance.now());
  const base = W[key], o = { ...base, cover: base.c ?? 300, ms: base.ms ?? 480, t0: performance.now() }; if (base.atlas && atlas?.[base.atlas] && imgs[base.atlas]) o.atlasOn = atlas[base.atlas];
  if (key === "gifts") o.p = pageTone(path);
  if (key === "home" && lastD) o.d = [-lastD[0], -lastD[1]];   // home leaves the way you came
  // a tap that beats the warm-up to this material: the driver is still compiling it on its own threads, so the wave waits a frame or
  // two for it with the page still answering, instead of freezing the page until the compile is done
  let hold = false; try { hold = !o.atlasOn && compiling(o.m); } catch { hold = false; }
  try { if (o.atlasOn) { if (!atlasTex(o.atlas)) o.atlasOn = null; else prog("flip"); } if (!o.atlasOn && !hold) prog(o.m); } catch (e) { console.error("fx-wave: " + e); broken = true; return false; }
  clearTimeout(freeTimer); const t = performance.now(); lastD = o.d;
  o.t0 = t; w = { key, o, path, under, t0: t, last: t, phase: "cover", frames: 0, sum: 0, n: 0, skip: 0, slow: 0, swapped: false, peak: false, rt: t, rd: o.ms, p: 0 };
  if (!cv.isConnected) document.body.append(cv); cv.style.opacity = "1"; if (key === "search") holdKeyboard();
  try { dispatchEvent(new CustomEvent("wave:start", { detail: { key, path } })); } catch {}   // the page behind can start its own slow setup while the wave covers it
  underline(path); if (hold) { w.hold = true; w.swapT = setTimeout(() => { if (w?.hold) { try { release(1e12); } catch { abort(); } } }, 450); raf = requestAnimationFrame(tick); return true; }   // a hidden tab has no frames: the timer still starts it
  try { paint(t); } catch (e) { console.error("fx-wave: " + e); broken = true; w.path = null; undo?.(); abort(); return false; }
  arm(); raf = requestAnimationFrame(tick);
  return true;
}
function arm() { w.swapT = setTimeout(swap, w.o.cover + 70); w.goneT = setTimeout(finish, Math.min(GONE_MS, w.o.cover + w.o.ms + 90)); }   // a stalled frame clock still lands the page
function release(now) {   // the held material is ready (or 400 ms have gone): the wave starts now, from its first frame
  if (compiling(w.o.m) && now - w.t0 < 400) return false;
  w.hold = false; clearTimeout(w.swapT); prog(w.o.m); const t = performance.now(); w.t0 = w.o.t0 = w.last = w.rt = t; arm(); return true;
}
// the page this wave was carrying is cancelled; the band itself keeps travelling, so nothing jumps
function drop(restore) { if (!w?.path) return; if (w.hold) { if (restore) undo?.(); undo = null; w.path = null; abort(); return; }   // a held wave has drawn nothing yet: it never starts for a page that was cancelled
  w.path = null; if (restore) undo?.(); undo = null; dropKeyboard(); }
const keeper = () => { const list = [...(w.under || [])]; if (w.o.lastH != null) list.push(w.o); return list.length ? list.slice(-4) : null; };
setNavGate({
  // true: the wave owns this navigation and will commit it at full cover
  take(path, replace) {
    if (w) { // a tap during a wave replaces it, with one history entry; what it replaced never lands
      if (w.path === path) return true;
      const next = replace ? null : waveFor(path); if (!next) { drop(true); return false; }   // back to the page still showing: this band finishes its pass over it
      if (tooFast(performance.now())) { undo?.(); undo = null; w.path = path; underline(path); return true; }   // too many in a second: this band carries the new page instead of a third one starting
      const under = keeper(); drop(true); clearTimers(); w = null; if (raf) cancelAnimationFrame(raf); raf = 0;   // the new tap plays its own wave over this one, so nothing pops off
      if (play(next, path, under)) return true; hide(); return false;
    }
    const key = replace ? null : waveFor(path); if (!key || !play(key, path)) return false;
    return true;
  },
  same() {   // a tap back to the page still showing, under a wave heading elsewhere: that page gets its own wave too
    if (!w?.path) return; const p = location.pathname + location.search, k = sectionOf(p); if (w.path === p) return; if (k === "search" || !W[k] || RM.matches || saveData() || document.hidden || broken || tooFast(performance.now())) { drop(true); return; }
    const under = keeper(); drop(true); clearTimers(); w = null; if (raf) cancelAnimationFrame(raf); raf = 0; if (!play(k, p, under)) hide();
  },
  pop() { drop(false); },
  live: () => !!w,
});
// the work is done before the first tap: shaders on the first touch, flipbooks when the browser is idle
const idle = (f, o) => window.requestIdleCallback ? requestIdleCallback(f, o) : setTimeout(f, 60);
// WARM. After the page has loaded and gone quiet, every material is compiled, linked and drawn once into a single hidden pixel, so the
// driver's last-minute work (it often finishes a program only at its first draw) is never paid inside a tap. With the parallel-compile
// extension all of them compile at once off the main thread and are only asked for when done; without it, one per idle moment.
// The first warm draw of the heaviest material is also timed: a device that cannot fill the screen in time starts at a lower render scale.
let warmed = false, warming = false;
const KEYS = () => [...new Set(Object.values(W).map(x => x.m))];
function hush(k) { if (!gl || gl.isContextLost()) return; fit(); const [x, y] = vp; gl.viewport(0, cv.height - 1, 1, 1); const P = prog(k); gl.useProgram(P.p);   // one pixel, every uniform it reads set
  if (P.u.uN) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, noise); gl.uniform1i(P.u.uN, 0); } if (P.u.uS) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.uniform1i(P.u.uS, 1); gl.uniform1f(P.u.uHas, 0); }
  gl.uniform2f(P.u.uR, x, y); gl.uniform2f(P.u.uV, 390, 844); gl.uniform2f(P.u.uD, 0, 1); gl.uniform1f(P.u.uTime, 0); gl.uniform1f(P.u.uH, .5); gl.uniform1f(P.u.uT, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); view(); }
function gauge() {   // a quarter-size full draw of the smoke, waited for: what one frame of the heaviest wave costs here
  if (!gl || gl.isContextLost() || w) return; fit(); const keep = res, P = prog("smoke"), [vw, vh] = cssSize(), px = new Uint8Array(4); res = .5; view();
  gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, noise); gl.uniform1i(P.u.uN, 0); gl.uniform2f(P.u.uR, vp[0], vp[1]); gl.uniform2f(P.u.uV, vw, vh); gl.uniform2f(P.u.uD, S2, S2); gl.uniform1f(P.u.uTime, .2); gl.uniform1f(P.u.uH, .6); gl.uniform1f(P.u.uT, -.1);
  [C.bone, C.ash, C.coal, C.bonelt].forEach((c, i) => gl.uniform3fv(P.u[["uA", "uB", "uC", "uE"][i]], c));
  let best = 1e9, trip = 1e9;
  try {
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // the first wait flushes the warm draws
    for (let i = 0; i < 2; i++) { let t = performance.now(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); trip = Math.min(trip, performance.now() - t);   // the round trip alone, taken off the draw's time
      t = performance.now(); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); best = Math.min(best, performance.now() - t); }
  } finally { res = keep; }
  const full = Math.max(0, best - trip) * 4; if (full > 30) lower(.5); else if (full > 18) lower(.75); view(); window.__wave.gauge = Math.round(full * 10) / 10;   // a 60 fps frame is 16.7 ms: only a device that clearly cannot fill the screen in time draws fewer pixels
}
function warm() {
  if (warmed || warming || RM.matches || saveData() || broken || document.hidden) return; warming = true;
  try { if (!glInit()) { warming = false; return; } } catch { warming = false; return; }
  cssSize();   // its real 100lvh box, measured now rather than inside a tap
  const todo = KEYS(); if (par) todo.forEach(k => { if (!progs[k]) progs[k] = start(srcOf(k)); });
  const next = () => {
    if (!gl || gl.isContextLost() || broken) { warming = false; return; }
    if (w) { setTimeout(() => idle(next), 600); return; }   // never during a wave
    const k = todo[0]; if (k == null) { warming = false; warmed = true; try { gauge(); } catch {} idle(upAll); return; }
    if (compiling(k)) { setTimeout(() => idle(next, { timeout: 200 }), 40); return; }
    try { hush(k); todo.shift(); } catch (e) { console.error("fx-wave: " + e); broken = true; warming = false; return; }
    idle(next, { timeout: 200 });   // a page that is always animating has few idle moments: each step still runs within 200 ms
  };
  idle(next, { timeout: 200 });
}
// the decoded sheets go to the GPU in quiet moments too, one per moment, so no tap pays for an upload
function upAll() { const k = Object.keys(imgs).find(x => !tex[x] && !x.endsWith(":flow")); if (!k || !gl || gl.isContextLost()) return; if (w) { setTimeout(() => idle(upAll), 600); return; } try { atlasTex(k); } catch {} idle(upAll, { timeout: 500 }); }
const afterLoad = f => document.readyState === "complete" ? setTimeout(f, 500) : addEventListener("load", () => setTimeout(f, 500), { once: true });
afterLoad(() => idle(warm, { timeout: 1000 }));
addEventListener("pointerdown", () => warm(), { passive: true, capture: true });   // someone faster than the quiet moment
addEventListener("pointerdown", e => {   // only the book this finger is about to open goes to the GPU, before the finger lifts
  const a = e.target.closest?.("a[href]"); if (!a) return; let u; try { u = new URL(a.href); } catch { return; } if (u.origin !== location.origin) return;
  const key = waveFor(u.pathname), k = key && (W[key].atlas || W[key].sprite); if (!k || !imgs[k]) return; idle(() => { if (!gl || w || gl.isContextLost()) return; try { atlasTex(k); } catch {} });
}, { passive: true, capture: true });
idle(loadAtlas);
window.__wave = { palette: () => w ? w.o.p : null, get active() { return w ? { key: w.key, phase: w.phase, p: w.p, pending: w.path } : null; }, get canvas() { return cv; }, get tier() { return tier; }, get res() { return res; }, sectionOf, waveFor };
