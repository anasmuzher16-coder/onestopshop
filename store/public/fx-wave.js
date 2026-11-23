import { commitNav, setNavGate } from "./route.js";
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
const C = { coal: ok(.155, .012, 50), coal1: ok(.205, .014, 50), coal2: ok(.275, .014, 52), ash: ok(.72, .018, 70), bone: ok(.925, .022, 80), ruby: ok(.72, .15, 18), teal: ok(.78, .105, 190), cobalt: ok(.72, .12, 265), emberlt: ok(.77, .14, 55), emerald: ok(.78, .13, 155), gilt: ok(.83, .12, 88), amethyst: ok(.76, .105, 312), bonelt: ok(.90, .03, 80), ember: ok(.58, .215, 29) };
const mid = h => ok(.46, .09, h), deep = h => ok(.30, .055, h), S2 = Math.SQRT1_2;
const tone = (c, h, accent = C.bone) => [c, mid(h), deep(h), accent];

// THE TILE ARRIVES. Every wave is the destination's own header colour: the material lives only on the leading edge, the body and tail are the flat token.
// m: edge, d: bearing (screen, y up), e: how far the edge reaches past the frame in CSS px (r: the same as a share of travel), p: [body, mid, deep, accent], c and ms: cover and reveal
const W = {
  hookahs: { m: "smoke", d: [S2, S2], e: 400, p: [C.bone, C.ash, C.coal, C.bonelt] },   // flowing inked clouds in bone and ash, never pink
  heat: { m: "fire", d: [0, 1], e: 290, p: [C.emberlt, C.ember, C.coal, C.gilt] },      // drawn flames: ember, the Heat tile's orange and gilt, with a coal ink line
  bases: { m: "water", d: [-S2, S2], e: 40, p: tone(C.teal, 190) },
  bowls: { m: "foil", d: [0, -1], e: 40, p: tone(C.cobalt, 265) },
  hoses: { m: "rope", d: [1, 0], e: 6, p: tone(C.emerald, 155) },
  parts: { m: "teeth", d: [-1, 0], e: 90, p: tone(C.gilt, 88) },
  cologne: { m: "mist", d: [-S2, -S2], e: 380, p: [C.amethyst, ok(.62, .1, 312), deep(312), ok(.86, .06, 312)] },
  misc: { m: "labels", d: [S2, -S2], e: 150, p: [C.bonelt, C.ember, C.coal, C.bone] },
  home: { m: "motes", d: [.38, .925], e: 56, p: [C.coal, C.gilt, C.coal2, C.ember] },
  all: { m: "tiles", d: [0, 1], e: 340, p: [C.bonelt, C.bone, C.coal, C.bone] },
  gifts: { m: "ribbon", d: [S2, S2], e: 56, p: tone(C.cobalt, 265) },
  set: { m: "pieces", d: [1, 0], e: 150, p: tone(C.ruby, 18) },
  shipping: { m: "route", d: [1, 0], e: 140, p: tone(C.cobalt, 265) },
  search: { m: "sweep", d: [1, 0], e: 2, p: tone(C.teal, 190), c: 150, ms: 230 },
  cart: { m: "receipt", d: [0, 1], e: 30, p: tone(C.gilt, 88), c: 170, ms: 260 },
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
      float ang = .55 * sin(cy / 190. + n * .7 + uTime * 1.3), ca = cos(ang), sa = sin(ang); u = vec2(ca * u.x + sa * u.y, -sa * u.x + ca * u.y); u.x *= .82;
      float a = atan(u.y, u.x) + dir * uTime * (.9 + s * .7), lobe = R * (.13 * abs(sin(a * (3. + floor(s * 3.)) + s * 9.)) + .045 * abs(sin(a * (7. + floor(s * 3.)) - s * 5.))), d = length(u) - R * .9 - lobe;
      if (d < m) m = d; if (d < 0.) { gD = d; gS = H2(vec2(n + 9., k)); gO = u; gR = R; gP = pl; } }
    return min(m, cy + 20. + 40. * sin(x / 137. + k * 1.7 + uTime * 1.1) + 22. * sin(x / 61. - k) - q.y); }
  ${SIG} { vec2 wv = vec2(sin(p.y / 170. + uTime * 1.1) + .6 * sin(p.x / 97. - uTime * .8 + p.y / 230.), cos(p.x / 150. - uTime * .9) + .6 * cos(p.y / 110. + uTime * .7 + p.x / 260.)) * .5, q = vec2(f.x + wv.x * 44. + 78. * sin(h / 300. - uTime * 1.7), h + wv.y * 26.); float z = clamp(uV.x / 620., 1., 1.7); q /= z; float k0 = floor(q.y / 92.);
    for (float k = k0 + 1.; k >= max(0., k0 - 2.); k--) { float d = puff(q, k); if (d < 0.) { vec2 u = gO / gR; float g = .22 * sin(gO.x / (gR * .45) + gS * 6.) * cos(gO.y / (gR * .5) - gS * 4.), aa = 1.5 * PX / (gR * z), sh = length(u + vec2(.2, .4)) + g * .7;
        c = gP > .62 ? uE : gP > .3 ? uA : mix(uA, uB, .5); c = mix(c, uB, ss(.98, .98 + aa, sh)); c = mix(c, mix(uB, uC, .38), ss(1.24, 1.24 + aa, sh)); c = mix(c, vec3(.985, .975, .955), .8 * (1. - ss(.4, .4 + aa, length(u + vec2(.26, .44)) + g * .9)));
        if (gD < -9e3) c = mix(uB, uA, .3); vec2 cu = u - vec2(.08, .06); float cr = length(cu), th = atan(cu.y, cu.x), arc = ss(-2.4, -1., th) * (1. - ss(2.2, 3., th)), ink = 1.1 + .7 * sin(th + gS * 6.28); c = mix(c, uC, .85 * step(.75, fract(gS * 7.)) * arc * (1. - ss(ink - .5, ink + .5, abs((cr - .44 - .07 * th - g * .22) * gR * z))));
        float bw = 3.6 * ss(-.25, .75, dot(gO / (length(gO) + .001), vec2(.45, .89)) + .25 * sin(gS * 6.28)); c = mix(c, uC, ss(.3, 1., bw) * ss(-bw - .5, -bw + .5, gD * z)); break; } }
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
  // bowls: a sheet of crimped hookah foil, pleated at the edge and punched with rows of holes
  foil: `${SIG} { float P = 40., x = f.x + 8. * sin(h / 60. + uTime * 3.), u = abs(fract(x / P) - .5) * 2., hh = h - 18. * u * u - 2.;
    if (hh < 112.) { c = fract(x / P) < .5 ? mix(uA, uE, .38) : mix(uA, uB, .28); c = mix(c, uA, ss(88., 112., hh)); float rw = floor((h - 34.) / 15.); vec2 g = vec2(f.x / 16. + mod(rw, 2.) * .5, (h - 34.) / 15.); float d = length((fract(g) - .5) * vec2(16., 15.)) - 2.2; if (h > 34. && h < 95.) { c = mix(uE, c, E(d - .8)); c = mix(uC, c, E(d)); } }
    c = mix(uC, c, E(hh - 3.)); h = hh; float b = t - 12. * abs(sin(f.x * 3.14159 / 40.)); c = mix(uC, c, E(b - 3.)); t = b; }`,
  // parts: five big machined gear teeth with a bevel and a bolt in each
  teeth: `${SIG} { float P = CR / 5., g = (f.x + CR * .5) / P, u = fract(g) - .5, tp = clamp((.36 - abs(u)) / .1, 0., 1.), hh = h - 72. * (1. - tp);
    if (hh < 16.) c = mix(uA, uE, .5); else if (hh < 26.) c = mix(uA, uB, .22); vec2 q = vec2(u * P, h - 82.); float d = length(q) - 13.; if (h < 130.) { c = mix(mix(uA, uB, .5), c, E(d - 3.)); c = mix(mix(uA, uE, .45), c, E(d)); c = mix(c, uC, (1. - E(abs(q.x + q.y) - 1.4)) * (1. - E(d + 3.))); }
    c = mix(uC, c, E(hh - 3.)); h = hh; float b = t - 40. * (1. - clamp((.36 - abs(fract(g + .5) - .5)) / .1, 0., 1.)); c = mix(uC, c, E(b - 3.)); t = b; }`,
  // everything: the store's jewel tiles deal in across the counter, then the page's bone
  tiles: `vec3 J(float i) { i = mod(i, 6.); return i < 1. ? vec3(${C.ruby}) : i < 2. ? vec3(${C.teal}) : i < 3. ? vec3(${C.cobalt}) : i < 4. ? vec3(${C.emberlt}) : i < 5. ? vec3(${C.emerald}) : vec3(${C.gilt}); }
  ${SIG} { float S = clamp(uV.x / 5., 78., 132.); vec2 g = p / S, id = floor(g), q = (fract(g) - .5) * S, ctr = (id + .5) * S; float sc = dot(ctr, uD) + L * .5 + H2(id) * 60., k = clamp((uH * L - sc + 150.) / 60., 0., 1.), lb = -1., bh = h - 250.; k = k * k * (3. - 2. * k);
    if (k > 0.) { vec2 w = q / max(.001, k); vec2 b = abs(w) - vec2(S * .5 - 11.); float d = length(max(b, 0.)) + min(max(b.x, b.y), 0.) - 7.; lb = -d * k; c = mix(uC, J(id.x + id.y * 2.), E(-d - 2.5)); }
    if (bh > 0.) { float e = step(250. + S * .5, uH * L - sc); c = mix(c, uA, lb > 0. ? e : 1.); } h = max(bh, lb); }`,
  // build a set: four pieces slide in at staggered depths and lock together on jigsaw tabs
  pieces: `${SIG} { float w = CR / 4., r = clamp(floor((f.x + CR * .5) / w), 0., 3.), cx = (r + .5) * w - CR * .5, even = mod(r, 2.) < .5 ? 1. : 0., o = even > .5 ? 0. : 86.; vec2 u = vec2(f.x - cx, h - o - 24.); float hh = max(h - o - 24., 58. - length(u));
    c = even > .5 ? uA : mix(uA, uB, .22); c = mix(c, mix(c, uE, .3), (1. - E(hh - 10.)) * E(hh - 3.)); c = mix(uC, c, E(w * .5 - abs(f.x - cx) - 1.5)); c = mix(uC, c, E(hh - 3.)); h = hh; float b = t - (even > .5 ? 86. : 0.); c = mix(uC, c, E(b - 3.)); t = b; }`,
  // cart: the till receipt tearing up the screen, printed lines on bone, a zigzag torn edge
  receipt: `${SIG} { float u = abs(fract(f.x / 22.) - .5) * 2., hh = h - 13. * u; if (h < 88.) { c = uE; float rn = floor((h - 24.) / 13.), ln = abs(fract((h - 24.) / 13.) - .5) * 13., rw = H2(vec2(rn, 3.)); if (h > 24. && h < 76. && abs(f.x) < CR * .5 - 14. && fract((f.x + rn * 37.) / (46. + rw * 60.)) < .7) c = mix(uC, c, E(ln - 2.)); }
    c = mix(uC, c, E(abs(h - 88.) - 1.5)); c = mix(uC, c, E(hh - 2.5)); h = hh; float b = t - 10. * u; c = mix(uC, c, E(b - 2.5)); t = b; }`,
  // the plain family wave: the flat header colour with a clean edge. Search uses it, because a search should feel instant
  sweep: `${SIG} { }`,
};
// cologne: an aerosol. A tight pressurised jet leaves the nozzle with a bright dense core, then blooms into an ultra-fine spray and soft amethyst mist that fills the screen
MAT.mist = `float sp(vec2 p, vec2 nz, float pitch, float k, float dn, float big, float seed) { vec2 a = nz + (p - nz) / (1. + uTime * k), g = a / pitch + seed, id = floor(g); if (H2(id + seed) > dn) return 0.; vec2 j = (vec2(H2(id + 1.), H2(id + 2.)) - .5) * .86; float z = H2(id + 3.), rad = pitch * (.12 + big * z * z * z); vec2 o = (fract(g) - .5 - j) * pitch, dr = normalize(p - nz + .001); float al = dot(o, dr) / (1. + uTime * 5.), ac = dot(o, vec2(-dr.y, dr.x)), d = rad - length(vec2(al, ac)); return (.5 + .5 * H2(id + 4.)) * ss(-.8, .6, d); }
  ${SIG} { vec2 nz = uV * .5 - vec2(min(uV.x * .16, 180.), 96.), w = abs(nz) + uV * .5, dir = normalize(p - nz + .001); float r = length(p - nz), RM = length(w), hr = uH * RM - r, tr = r - uT * RM, n = fbm(p / 11000. + vec2(-uTime * .03, uTime * .02)), n2 = fbm(p / 6400. + vec2(uTime * .035, .31)), fo = (n - .5) * 190.;
    float th = acos(clamp(dot(dir, vec2(-.6, -.8)), -1., 1.)) + (n2 - .5) * .42, wd = mix(.13, 5., pow(clamp(uH, 0., 1.), 2.2)), cn = 1. - ss(wd * .72, wd * 1.25, th), ce = 1. - ss(wd * .9, wd * 1.7, th), core = exp(-pow(th / (wd * .42), 2.));
    float m = ss(-60., 130., hr + fo) * ss(-60., 130., tr - fo) * cn, env = ss(-240., -40., hr + fo * .6) * ss(-230., -30., tr - fo * .6) * ce, pk = 1. - ss(70., 420., hr), dn = env * (.2 + .55 * pk), d1 = sp(p, nz, 3.4, 2.2, dn * .72, .13, 1.), d2 = sp(p, nz, 5.6, 3., dn * .85, .14, 7.), d3 = sp(p, nz, 10., 4., dn * .4, .1, 13.), da = max(d1, max(d2, d3));
    vec3 b = mix(mix(uA, uB, .12), mix(uA, uE, .5), ss(.34, .66, .6 * n + .4 * n2)); b = mix(b, mix(uE, vec3(.99), .4), .78 * core * exp(-r / (.75 * RM))); c = mix(b, vec3(.99, .97, 1.), da); h = (max(m, da) - .5) * 1.5 * PX; t = PX * 9.; }`;
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

let cv = null, gl = null, vao = null, noise = null, progs = {}, broken = false, tier = 0, atlas = null, tex = {}, imgs = {}, w = null, raf = 0, freeTimer = 0, undo = null, lastD = null, proxy = null;
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
const BOOKS = {};   // empty: smoke and fire are drawn in their shaders now, so nothing extra downloads
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
  gl.uniform2f(P.u.uR, cv.width, cv.height); gl.uniform2f(P.u.uV, vw, vh); gl.uniform2f(P.u.uD, o.d[0], o.d[1]); gl.uniform1f(P.u.uTime, (now - o.t0) / 1000); gl.uniform1f(P.u.uH, H); gl.uniform1f(P.u.uT, Tl);
  gl.uniform3fv(P.u.uA, a); if (P.u.uB) gl.uniform3fv(P.u.uB, b); if (P.u.uC) gl.uniform3fv(P.u.uC, c); if (P.u.uE) gl.uniform3fv(P.u.uE, e);
  gl.drawArrays(gl.TRIANGLES, 0, 3); o.lastH = H; o.lastT = Tl;
}
// one unbroken pass: the head arrives still moving and the tail leaves at that same speed, so nothing stops dead at the page swap
const coverEase = p => (1 - (1 - .82 * p) ** 2) / .9676, revealEase = p => ((.18 + .82 * p) ** 2 - .0324) / .9676;
function paint(now) {
  const o = w.o, m = margin(o), A = o.atlasOn;
  if (w.phase === "cover") { const p = Math.min(1, (now - w.t0) / o.cover), e = coverEase(p); w.p = p; const u = w.under;   // a wave that was interrupted holds its place underneath until the new one has covered it
    if (u) { draw(u, now, u.lastH, u.lastT, null); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    try { draw(o, now, -m + e * (1 + 2 * m), -m - .02, A ? e * A.fullCoverFrame : null); } finally { if (u) gl.disable(gl.BLEND); } return p >= 1; }
  const p = Math.min(1, (now - w.rt) / w.rd), e = revealEase(p); w.p = p; draw(o, now, 1 + m + .02, -m - .02 + e * (1 + 2 * m + .04), A ? A.fullCoverFrame + e * (A.frames - 1 - A.fullCoverFrame) : null); return p >= 1;
}
// Search: an input focused inside the tap, so an iPhone opens its keyboard; the real field takes the focus over at the swap
function holdKeyboard() { const i = document.createElement("input"); i.type = "search"; i.tabIndex = -1; i.setAttribute("aria-label", "Search"); i.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none;z-index:14"; document.body.append(i); i.focus({ preventScroll: true }); proxy = i; }
function dropKeyboard() { if (!proxy) return; const i = proxy; proxy = null; i.remove(); }
function swap() {
  if (!w || w.swapped) return; if (w.phase === "cover") try { paint(w.t0 + w.o.cover); } catch {} // a late frame clock still swaps under a full cover
  w.swapped = true; w.under = null; w.skip = true; const path = w.path; w.path = null; undo = null; if (path) commitNav(path, "wave"); dropKeyboard();
  if (!w) return; w.phase = "reveal"; const t = performance.now(); w.rt = t; w.rd = Math.max(120, Math.min(w.o.ms, w.t0 + Math.min(MAX_MS, w.o.cover + w.o.ms) - t));
}
function tick(now) {
  raf = 0; if (!w) return; raf = requestAnimationFrame(tick); now = Math.max(now, performance.now() - 40);
  const dt = now - w.last; w.last = now;
  if (w.frames++ > 0 && !w.skip) { w.sum += dt; w.n++; } w.skip = false;   // frame times for the governor, leaving out the swap frame, which is long on purpose
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
function finish() { const pending = w?.path; if (w?.n >= 2 && w.sum / w.n > 40 && tier < TIERS.length - 1) { tier++; try { sessionStorage.setItem("oss:wave-tier", tier); } catch {} } /* a slow device keeps its transitions and gets a lighter resolution from the next page load */ clearTimers(); w = null; hide(); undo = null; if (pending) commitNav(pending, proxy ? "wave" : "push"); dropKeyboard(); }
function abort() { const pending = w?.path; clearTimers(); w = null; hide(); undo = null; if (pending) commitNav(pending, proxy ? "wave" : "push"); dropKeyboard(); }
function lostGL() { gl = null; if (cv) cv.remove(); cv = null; progs = {}; tex = {}; noise = null; vao = null; if (w) abort(); }

function play(key, path, under = null) {
  if (!glInit()) return false;
  const base = W[key], o = { ...base, cover: base.c ?? 300, ms: base.ms ?? 480, t0: performance.now() }; if (base.atlas && atlas?.[base.atlas] && imgs[base.atlas]) o.atlasOn = atlas[base.atlas];
  if (key === "gifts") o.p = pageTone(path);
  if (key === "home" && lastD) o.d = [-lastD[0], -lastD[1]];   // home leaves the way you came
  try { if (o.atlasOn) { if (!atlasTex(o.atlas)) o.atlasOn = null; else prog("flip"); } if (!o.atlasOn) prog(o.m); } catch (e) { console.error("fx-wave: " + e); broken = true; return false; }
  clearTimeout(freeTimer); const t = performance.now(); lastD = o.d;
  o.t0 = t; w = { key, o, path, under, t0: t, last: t, phase: "cover", frames: 0, sum: 0, n: 0, skip: false, swapped: false, peak: false, rt: t, rd: o.ms, p: 0 };
  if (!cv.isConnected) document.body.append(cv); cv.style.opacity = "1"; if (key === "search") holdKeyboard();
  underline(path); try { paint(t); } catch (e) { console.error("fx-wave: " + e); broken = true; w.path = null; undo?.(); abort(); return false; } w.swapT = setTimeout(swap, o.cover + 70);   // a stalled frame clock still lands the page
  w.goneT = setTimeout(finish, Math.min(GONE_MS, o.cover + o.ms + 90)); raf = requestAnimationFrame(tick);
  return true;
}
// the page this wave was carrying is cancelled; the band itself keeps travelling, so nothing jumps
function drop(restore) { if (!w?.path) return; w.path = null; if (restore) undo?.(); undo = null; dropKeyboard(); }
const keeper = () => { const a = w.o, b = w.under; if (b && (a.lastH == null || b.lastH > a.lastH)) return b; return a.lastH == null ? null : a; };
setNavGate({
  // true: the wave owns this navigation and will commit it at full cover
  take(path, replace) {
    if (w) { // a tap during a wave replaces it, with one history entry; what it replaced never lands
      if (w.path === path) return true;
      const next = replace ? null : waveFor(path); if (!next) { drop(true); return false; }   // back to the page still showing: this band finishes its pass over it
      const under = keeper(); drop(true); clearTimers(); w = null; if (raf) cancelAnimationFrame(raf); raf = 0;   // the new tap plays its own wave over this one, so nothing pops off
      if (play(next, path, under)) return true; hide(); return false;
    }
    const key = replace ? null : waveFor(path); if (!key || !play(key, path)) return false;
    return true;
  },
  same() {   // a tap back to the page still showing, under a wave heading elsewhere: that page gets its own wave too
    if (!w?.path) return; const p = location.pathname + location.search, k = sectionOf(p); if (w.path === p) return; if (k === "search" || !W[k] || RM.matches || saveData() || document.hidden || broken) { drop(true); return; }
    const under = keeper(); drop(true); clearTimers(); w = null; if (raf) cancelAnimationFrame(raf); raf = 0; if (!play(k, p, under)) hide();
  },
  pop() { drop(false); },
  live: () => !!w,
});
// the work is done before the first tap: shaders on the first touch, flipbooks when the browser is idle
const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
const warm = () => { if (RM.matches || saveData() || broken) return; const todo = [...new Set(Object.values(W).map(x => x.m))];   // one shader per idle moment, so a first touch never stutters
  const next = () => { if (!todo.length || broken || w) { if (todo.length && w) setTimeout(() => idle(next), 1000); return; } try { if (glInit()) prog(todo.shift()); else return; } catch (e) { console.error("fx-wave: " + e); broken = true; return; } idle(next); }; idle(next); };
addEventListener("pointerdown", warm, { once: true, passive: true, capture: true });
addEventListener("pointerdown", e => {   // only the book this finger is about to open goes to the GPU, before the finger lifts
  const a = e.target.closest?.("a[href]"); if (!a) return; let u; try { u = new URL(a.href); } catch { return; } if (u.origin !== location.origin) return;
  const key = waveFor(u.pathname), k = key && W[key].atlas; if (!k || !imgs[k]) return; idle(() => { if (!gl || w || gl.isContextLost()) return; try { atlasTex(k); } catch {} });
}, { passive: true, capture: true });
idle(loadAtlas);
window.__wave = { palette: () => w ? w.o.p : null, get active() { return w ? { key: w.key, phase: w.phase, p: w.p, pending: w.path } : null; }, get canvas() { return cv; }, get tier() { return tier; }, sectionOf, waveFor };
