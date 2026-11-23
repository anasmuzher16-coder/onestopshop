// Hookah smoke and cologne mist: a real simulation that lives on the black page ground, behind every word, photo and button.
// Hookahs open with thick smoke rising from the bottom. Cologne opens with mist bursting from the bottle across the page. Both settle into a living background.
// Nothing is looped or played back: the flow is computed live and new drifts start at random, so it never repeats.
// WebGL2, no library, no images. With motion turned off, or on a phone that cannot run it, a designed still stands in.
import { waved } from "./route.js";
const RM = matchMedia("(prefers-reduced-motion: reduce)"), KEY = "oss:pour-open";
const HOLD = 3.2, SETTLE = 4.8, CELLS = 422; // seconds; CELLS sets the size of one unit of flow against the height of the screen
const V = `#version 300 es
in vec2 a; out vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;
const H = `#version 300 es
precision highp float; precision highp sampler2D; in vec2 v; out vec4 o;`;
const NEAR = `uniform vec2 tx; vec2 L(){return v-vec2(tx.x,0.);} vec2 R(){return v+vec2(tx.x,0.);} vec2 B(){return v-vec2(0.,tx.y);} vec2 T(){return v+vec2(0.,tx.y);}`;
const SRC = {
  adv: `${H} uniform sampler2D U, Q; uniform vec2 ts; uniform float dt, k, lift, w; void main(){ vec2 c = v - (dt * texture(U, v).xy + lift * vec2(.62 * sin(v.y * 8. + w * .22 + 2.2 * sin(v.x * 6.3 - w * .13)), .72 + .28 * sin(v.x * 11. + v.y * 3. + w * .17))) * ts; o = k * texture(Q, c) * smoothstep(-.002, .012, c.y); }`,
  force: `${H} uniform sampler2D U, D; uniform float g, dt, keep; void main(){ vec2 u = texture(U, v).xy; u.y -= g * dt * min(texture(D, v).r, 3.); u *= keep;
    float f = 1. - smoothstep(0., .05, v.y); if (u.y < 0.) u.y *= 1. - f; if (u.y > 0.) u.y *= smoothstep(0., .06, 1. - v.y); u *= .85 * smoothstep(0., .025, v.x) * smoothstep(0., .025, 1. - v.x) * smoothstep(0., .02, 1. - v.y) + .15;
    float m = length(u); if (m > 2.6) u *= 2.6 / m; o = vec4(u, 0., 1.); }`,
  vort: `${H} ${NEAR} uniform sampler2D U; uniform float e, dt; float c(vec2 p){ return texture(U, p + vec2(tx.x, 0.)).y - texture(U, p - vec2(tx.x, 0.)).y - texture(U, p + vec2(0., tx.y)).x + texture(U, p - vec2(0., tx.y)).x; }
    void main(){ float w = c(v); vec2 n = vec2(abs(c(R())) - abs(c(L())), abs(c(T())) - abs(c(B()))); n /= length(n) + 1e-4; o = vec4(texture(U, v).xy + e * dt * .5 * w * vec2(n.y, -n.x), 0., 1.); }`,
  div: `${H} ${NEAR} uniform sampler2D U; void main(){ o = vec4(.5 * (texture(U, R()).x - texture(U, L()).x + texture(U, T()).y - texture(U, B()).y), 0., 0., 1.); }`,
  prs: `${H} ${NEAR} uniform sampler2D P, D; void main(){ o = vec4((texture(P, L()).r + texture(P, R()).r + texture(P, B()).r + texture(P, T()).r - texture(D, v).r) * .25, 0., 0., 1.); }`,
  grad: `${H} ${NEAR} uniform sampler2D P, U; void main(){ o = vec4(texture(U, v).xy - .5 * vec2(texture(P, R()).r - texture(P, L()).r, texture(P, T()).r - texture(P, B()).r), 0., 1.); }`,
  splat: `${H} uniform sampler2D Q; uniform vec2 p; uniform vec3 c; uniform float r, asp; void main(){ vec2 d = v - p; d.x *= asp; o = texture(Q, v) + vec4(c * exp(-dot(d, d) / r), 0.); }`,
  // the thick opening bank lives in its own channel, so the slow drift underneath is untouched and is exactly what remains when the bank has gone
  bank: `${H} uniform sampler2D Q; uniform float front, fill, keep, cut, w, asp, sc, rest, soft, radial; uniform vec2 org; uniform int oct; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
    float fb(vec2 p){ float s = 0., a = .5, t = 0.; for (int i = 0; i < oct; i++) { s += a * n(p); t += a; p = p * 2.03 + vec2(7.1, 3.3); a *= .5; } return s / t; }
    void main(){ vec2 p = vec2(v.x * asp, v.y) * sc - vec2(0., w * .1), d = vec2(fb(p + w * .03), fb(p + vec2(5.2, 1.3) - w * .02)); float m = fb(p + 1.8 * d), at = radial > .5 ? length((v - org) * vec2(asp, 1.)) : v.y, edge = 1. - smoothstep(front - .24, front + .1, at + .34 * (m - .5));
      float big = edge * (radial > .5 ? .45 + 2.6 * smoothstep(.3, .72, m) : .95 + 3. * pow(smoothstep(.3, .74, m), 1.35)), base = rest * (.35 + 1.3 * smoothstep(.28, .74, m)); vec4 q = texture(Q, v); float g = mix(q.g, soft > .5 ? base : max(q.g, big), fill);
      o = vec4(q.r, max(soft > .5 ? 0. : base * edge, g * keep - cut), q.b, q.a); }`,
  show: `${H} uniform sampler2D D; uniform vec3 c[5]; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } float dn(vec2 p){ vec2 s = texture(D, p).rg; return s.r + s.g; }
    void main(){ vec2 e = 1.4 / vec2(textureSize(D, 0)); float q = max(.4 * dn(v) + .15 * (dn(v + e) + dn(v - e) + dn(v + vec2(e.x, -e.y)) + dn(v + vec2(-e.x, e.y))), 0.); float t = pow(1. - exp(-.8 * q), 1.25); vec3 s;
      if (t < .25) s = mix(c[0], c[1], t / .25); else if (t < .55) s = mix(c[1], c[2], (t - .25) / .3); else if (t < .82) s = mix(c[2], c[3], (t - .55) / .27); else s = mix(c[3], c[4], (t - .82) / .18);
      o = vec4(s + (h(gl_FragCoord.xy) - .5) / 255., 1.); }`,
};
// the store's own coal, then plain neutral smoke greys
function srgb(L, C, h) {
  const x = C * Math.cos(h * Math.PI / 180), y = C * Math.sin(h * Math.PI / 180), l = (L + .3963377774 * x + .2158037573 * y) ** 3, m = (L - .1055613458 * x - .0638541728 * y) ** 3, s = (L - .0894841775 * x - 1.291485548 * y) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s].map(n => { n = Math.min(1, Math.max(0, n)); return n <= .0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - .055; });
}
const RAMP = [[.155, .012, 50], [.205, .008, 80], [.265, .007, 80], [.315, .006, 80], [.345, .005, 80]].flatMap(c => srgb(...c));
const MIST = [[.155, .012, 50], [.205, .006, 240], [.265, .008, 235], [.318, .009, 232], [.345, .009, 230]].flatMap(c => srgb(...c));
// what each section's air does: how it opens, how much stays afterward, and how it moves
const MODES = {
  hookahs: { end: 9, radial: false, rest: .3, sc: 2.1, lift: 2, restLift: .2, ramp: RAMP, power: [.03, .03], drifts: 9, size: [.0024, .0042] },
  cologne: { air: true, end: 7.2, radial: true, rest: .74, sc: 6.4, lift: .34, restLift: .09, ramp: MIST, power: [.012, .018], drifts: 9, size: [.0012, .0024] },
};
let lite = false, M = MODES.hookahs, modeName = null, tick = 0, org = [.75, .8];
const ease = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };

const cv = document.createElement("canvas"); cv.className = "pour"; cv.setAttribute("aria-hidden", "true"); cv.width = cv.height = 0;
let gl = null, P = {}, F = null, raf = 0, on = false, lost = false, last = 0, T = 0, heavy = false, drifts = [], iters = 14, slow = 0, owed = 0, skip = false, odd = false, parked = false, tried = false, lostTimer = 0, manual = false, head = null, chips = null, W = 0, Hh = 0, asp = 1;
const phase = [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3], seed = Math.random() * 400;
function setup() {
  if (new URLSearchParams(location.search).has("still")) return false;
  const g = cv.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!g || !(g.getExtension("EXT_color_buffer_float") || g.getExtension("EXT_color_buffer_half_float"))) return false;
  const info = g.getExtension("WEBGL_debug_renderer_info"); lite = !!info && /swiftshader|llvmpipe|software|basic render/i.test(g.getParameter(info.UNMASKED_RENDERER_WEBGL) || "");   // no real graphics chip: skip the costly resting layer
  const sh = (t, s) => { const x = g.createShader(t); g.shaderSource(x, s); g.compileShader(x); return g.getShaderParameter(x, g.COMPILE_STATUS) ? x : null; }, vs = sh(g.VERTEX_SHADER, V);
  if (!vs) return false;
  P = {};
  for (const k in SRC) {
    const fs = sh(g.FRAGMENT_SHADER, SRC[k]); if (!fs) return false;
    const p = g.createProgram(); g.attachShader(p, vs); g.attachShader(p, fs); g.bindAttribLocation(p, 0, "a"); g.linkProgram(p); if (!g.getProgramParameter(p, g.LINK_STATUS)) return false;
    const u = {}, n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const name = g.getActiveUniform(p, i).name.replace("[0]", ""); u[name] = g.getUniformLocation(p, name); }
    P[k] = { p, u };
  }
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer()); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW); g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
  g.disable(g.BLEND); gl = g; return true;
}
function target(w, h) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  for (const [k, x] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, x);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  return { t, f, w, h, ok };
}
const pair = (w, h) => { const x = { a: target(w, h), b: target(w, h), swap() { const s = x.a; x.a = x.b; x.b = s; } }; return x; };
function release() { if (!F || !gl) { F = null; return; } for (const x of [F.u.a, F.u.b, F.d.a, F.d.b, F.p.a, F.p.b, F.div]) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } F = null; }
function size() {
  W = Math.max(1, innerWidth); Hh = Math.max(1, innerHeight); asp = W / Hh;
  const k = Math.min(1, 900 / Math.max(W, Hh)), long = Math.max(W, Hh), g = n => [Math.max(8, Math.round(n * W / long)), Math.max(8, Math.round(n * Hh / long))];
  const cw = Math.round(W * k), ch = Math.round(Hh * k); if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  release(); const [uw, uh] = g(170), [dw, dh] = g(560);
  F = { u: pair(uw, uh), p: pair(uw, uh), div: target(uw, uh), d: pair(dw, dh) };
  return F.u.a.ok && F.d.a.ok && F.p.a.ok && F.div.ok;
}
const tex = (i, x) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, x.t); return i; };
function pass(name, into, set) { const p = P[name]; gl.useProgram(p.p); set(p.u); gl.bindFramebuffer(gl.FRAMEBUFFER, into ? into.f : null); gl.viewport(0, 0, into ? into.w : cv.width, into ? into.h : cv.height); gl.drawArrays(gl.TRIANGLES, 0, 3); }
const splat = (x, px, py, r, a, b, c) => { pass("splat", x.b, u => { gl.uniform1i(u.Q, tex(0, x.a)); gl.uniform2f(u.p, px, py); gl.uniform1f(u.r, r); gl.uniform1f(u.asp, asp); gl.uniform3f(u.c, a, b, c); }); x.swap(); };
// how fast the air moves: a slow build on opening, then a very slow drift that never pulls the eye from the products
const pace = () => heavy ? .62 - .42 * ease(HOLD, SETTLE + 2.5, T) : .2;
function emit(dt, raw) {
  const R = .0011 * Math.max(1, asp * asp), BASE = .045;
  if (heavy && M.radial && T < .6) aim();   // the bottle may land a moment after the page does
  if (heavy && M.radial && T > .5 && T < 2.2) {   // the spray leaves the bottle and pushes the air across the page
    const go = Math.sin(Math.PI * (T - .5) / 1.7); splat(F.u, org[0], org[1], .006, -1.5 * go * dt, -1.1 * go * dt, 0);
  }
  if (heavy && !M.radial && T < SETTLE) {
    const fade = 1 - ease(HOLD, SETTLE - .3, T), spots = asp > 1 ? [.5, .14, .86, .32, .68, .03, .97] : [.5, .14, .86, .32, .68];
    spots.forEach((s, i) => {
      const go = ease(.05 + i * .06, .6 + i * .06, T) * fade * .8; if (go <= 0) return;   // smoke pours up from the floor the moment the page opens
      const x = s + .035 * Math.sin(T * .8 + phase[i % 3]), pulse = .64 + .36 * Math.sin(T * (2 + i * .23) + phase[i % 3] + i), side = .3 * Math.sin(T * 1.4 + phase[i % 3]);
      splat(F.u, x, BASE, R, side * go * dt, 2.1 * pulse * go * dt, 0); splat(F.d, x, BASE, R * 1.1, .28 * pulse * go * raw, 0, 0);   // lighter columns, so the bank's crests and hollows stay visible instead of filling to one grey
    });
  }
  if (!heavy || T > HOLD) {
    while (drifts.length < M.drifts) { const rise = Math.PI / 2 + (Math.random() - .5) * 1.2, born = T + (drifts.length ? Math.random() * 2.4 : 0), life = 3 + Math.random() * 4.5;
      drifts.push({ x: .04 + Math.random() * .92, y: .02 + Math.random() * .38, a: rise, born, life, power: M.power[0] + Math.random() * M.power[1], turn: (Math.random() - .5) * .16, r: M.size[0] + Math.random() * M.size[1] }); }
    drifts = drifts.filter(e => T < e.born + e.life);
    for (const e of drifts) { const s = (T - e.born) / e.life; if (s < 0) continue; const go = Math.sin(Math.PI * s), a = e.a + e.turn * s * 6;
      splat(F.u, e.x, e.y, e.r * 1.4, Math.cos(a) * .5 * go * dt, Math.sin(a) * .5 * go * dt, 0); splat(F.d, e.x, e.y, e.r, e.power * go * raw, 0, 0); e.x += Math.cos(a) * .0007 * dt / asp; e.y += Math.sin(a) * .0007 * dt; }
  }
}
// a thick bank climbs from the floor at once, holds for about four seconds, then wears away slowly, thin parts first; timed by the clock so a slow phone sees the same thing
function bank(raw, full = false) {
  const opening = heavy && T < M.end; if (!opening && (lite || skip)) return; if (!opening && !full) { tick = (tick + 1) % 4; if (tick) return; }   // the resting layer moves slowly, so a third of the frames is enough
  const el = Math.min(8, owed || raw), wear = !opening ? 0 : M.radial ? ease(3.4, 7, T) : ease(4.2, 8.6, T), feed = !opening ? 1 : 1 - (M.radial ? ease(3, 3.6, T) : ease(3.9, 4.5, T));   // hookah smoke holds thick for about four seconds, then goes slowly
  const front = !opening ? 9 : M.radial ? (Math.hypot(Math.max(org[0], 1 - org[0]) * asp, Math.max(org[1], 1 - org[1])) + .34) * ease(.2, 2.2, T) : -.25 + 1.6 * ease(.05, 1.25, T), fill = full ? 1 : opening ? feed * (1 - Math.pow(.88, el)) : 1 - Math.pow(.985, el * 4);
  pass("bank", F.d.b, n => { gl.uniform1i(n.Q, tex(0, F.d.a)); gl.uniform1f(n.front, front); gl.uniform1f(n.fill, fill); gl.uniform1f(n.keep, opening ? Math.pow(1 - (M.radial ? .028 : .016) * wear, el) : 1); gl.uniform1f(n.cut, opening ? (M.radial ? .006 : .0035) * wear * el : 0); gl.uniform1f(n.w, T + seed); gl.uniform1f(n.asp, asp); gl.uniform1f(n.sc, M.sc); gl.uniform1f(n.rest, M.rest); gl.uniform1f(n.soft, opening ? 0 : 1); gl.uniform1f(n.radial, M.radial ? 1 : 0); gl.uniform2f(n.org, org[0], org[1]); gl.uniform1i(n.oct, opening ? 4 : 3); }); F.d.swap();
}
function step(raw) {
  const dt = raw * pace(), u = F.u, tx = () => gl.uniform2f(P[cur].u.tx, 1 / u.a.w, 1 / u.a.h); let cur = "vort";
  pass("vort", u.b, n => { gl.uniform1i(n.U, tex(0, u.a)); tx(); gl.uniform1f(n.e, .035); gl.uniform1f(n.dt, dt); }); u.swap();
  pass("force", u.b, n => { gl.uniform1i(n.U, tex(0, u.a)); gl.uniform1i(n.D, tex(1, F.d.a)); gl.uniform1f(n.g, -.03); gl.uniform1f(n.dt, dt); gl.uniform1f(n.keep, Math.pow(.996, dt)); }); u.swap();
  emit(dt, raw);
  cur = "div"; pass("div", F.div, n => { gl.uniform1i(n.U, tex(0, u.a)); tx(); });
  cur = "prs"; for (let i = 0; i < iters; i++) { pass("prs", F.p.b, n => { gl.uniform1i(n.P, tex(0, F.p.a)); gl.uniform1i(n.D, tex(1, F.div)); tx(); }); F.p.swap(); }
  cur = "grad"; pass("grad", u.b, n => { gl.uniform1i(n.P, tex(0, F.p.a)); gl.uniform1i(n.U, tex(1, u.a)); tx(); }); u.swap();
  const ts = [Hh / (CELLS * W), 1 / CELLS];
  pass("adv", u.b, n => { gl.uniform1i(n.U, tex(0, u.a)); gl.uniform1i(n.Q, tex(0, u.a)); gl.uniform2f(n.ts, ts[0], ts[1]); gl.uniform1f(n.dt, dt); gl.uniform1f(n.k, 1); gl.uniform1f(n.lift, 0); gl.uniform1f(n.w, T); }); u.swap();
  const thin = heavy && T < HOLD ? .9992 : heavy && T < SETTLE ? .9992 - .0062 * ease(HOLD, SETTLE, T) : .993 + .0032 * ease(SETTLE, SETTLE + 3, T); // it thins after the heavy opening, then what is added and what fades stay in balance
  pass("adv", F.d.b, n => { gl.uniform1i(n.U, tex(0, u.a)); gl.uniform1i(n.Q, tex(1, F.d.a)); gl.uniform2f(n.ts, ts[0], ts[1]); gl.uniform1f(n.dt, dt); gl.uniform1f(n.k, Math.pow(thin, raw)); gl.uniform1f(n.lift, raw * (heavy ? M.lift - (M.lift - M.restLift) * ease(HOLD, SETTLE + 2, T) : M.restLift)); gl.uniform1f(n.w, T + seed); }); F.d.swap();
  bank(raw);
  owed = 0;
}
const show = () => pass("show", null, n => { gl.uniform1i(n.D, tex(0, F.d.a)); gl.uniform3fv(n.c, M.ramp); });
function frame(now) {
  raf = 0; if (!on || lost || manual) return;
  const ms = Math.min(120, Math.max(1, now - last)); last = now;
  // a phone that truly struggles does less work and keeps moving. A steady 30 fps (Low Power Mode) is fine and is left alone.
  slow = ms > 45 ? slow + 1 : Math.max(0, slow - 2);
  if (slow > 60) { slow = 0; if (iters > 7) iters = 7; else skip = true; }
  if (T < .45) aim();   // the bottle can mount a moment after the page
  T += ms / 1000; odd = !odd; owed += ms / 16.667;
  if (!skip || odd) { step(Math.min(2.4, ms / 16.667 * (skip ? 2 : 1))); show(); }
  if (!document.hidden) raf = requestAnimationFrame(frame);
}
const kick = () => { if (on && !raf && gl && F && !lost && !parked && !manual && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
// the heavy opening plays once per visit (per tab), and never when arriving by Back or Forward
const played = new Set(); let popped = -1e9, arrivedBack = performance.getEntriesByType("navigation")[0]?.type === "back_forward"; addEventListener("popstate", () => { popped = performance.now(); });
function firstOpen() {
  if (played.has(modeName) || performance.now() - popped < 800 || arrivedBack) return false;
  played.add(modeName); try { const k = KEY + ":" + modeName; if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, "1"); } catch {} return true;
}
const toStill = () => { off(); gl = null; document.documentElement.classList.add("pour-still", "pour-page"); };
function settle() { heavy = false; for (let i = 0; i < 24; i++) { T += 1 / 30; step(2); } bank(1, true); show(); }
// the cologne background: the same fine droplets the spray throws, hanging in the air behind the page. Each one drifts, glints, fades
// and is replaced somewhere new, so the field never repeats. No smoke, no clouds. It is plain 2D and runs at half rate once settled.
let air = null;
function endAir() { if (!air) return; cancelAnimationFrame(air.raf); removeEventListener("resize", air.fit); document.removeEventListener("visibilitychange", air.fit); document.removeEventListener("visibilitychange", air.vis); air.c.width = air.c.height = 0; air.c.remove(); air = null; }
function beginAir() {
  const open = firstOpen() && !waved(); W = innerWidth; Hh = innerHeight; aim();
  const c = document.createElement("canvas"); c.className = "pour pour--air"; c.setAttribute("aria-hidden", "true"); document.body.prepend(c);
  const g = c.getContext("2d"); if (!g) { c.width = c.height = 0; c.remove(); document.documentElement.classList.add("pour-still", "pour-mist", "pour-page"); return; }
  const dot = document.createElement("canvas"); dot.width = dot.height = 24; const x = dot.getContext("2d"), rg = x.createRadialGradient(12, 12, 0, 12, 12, 12); rg.addColorStop(0, "rgba(255,253,248,1)"); rg.addColorStop(.42, "rgba(255,253,248,.6)"); rg.addColorStop(1, "rgba(255,253,248,0)"); x.fillStyle = rg; x.fillRect(0, 0, 24, 24);
  const rnd = (a, b) => a + Math.random() * (b - a); let w = 0, h = 0, drops = [], veil = [], limit = 1, slowFrames = 0, odd = false, prev = performance.now();
  let t0 = performance.now(), hiddenAt = 0; const ox = () => org[0] * w, oy = () => (1 - org[1]) * h;
  const place = (p, now, first) => { const u = Math.random(), v = veil.length && Math.random() < .64 ? veil[Math.floor(Math.random() * veil.length)] : null, near = () => (Math.random() + Math.random() + Math.random() - 1.5) * .24; p.x = (v ? v.x + near() : rnd(-.02, 1.02)) * w; p.y = (v ? v.y + near() : rnd(-.02, 1.02)) * h; p.vx = rnd(-7, 7); p.vy = rnd(1.5, 11); p.r = .18 + .62 * u * u * u; p.a = rnd(.16, .58); p.life = rnd(6, 15); p.born = first ? now - rnd(0, p.life) : now + rnd(0, 700); p.tw = rnd(.5, 1.6); p.ph = rnd(0, 6.28); p.sw = rnd(2, 8); p.fly = 0; };
  const fit = () => { const d = Math.min(1.5, devicePixelRatio || 1), nw = c.clientWidth || innerWidth, nh = c.clientHeight || innerHeight, pw = Math.round(nw * d), ph = Math.round(nh * d); if (document.hidden && w) return; if (c.width && w === nw && Math.abs(h - nh) <= 140) return; w = nw; h = nh; W = w; Hh = h; c.width = pw; c.height = ph; g.setTransform(d, 0, 0, d, 0, 0); const n = Math.round(Math.min(2400, 300 + w * h / 620)), now = performance.now();
    if (!veil.length) for (let i = 0; i < 18; i++) veil.push({ x: Math.random(), y: Math.random(), r: rnd(.16, .32), vx: rnd(-.006, .006), vy: rnd(.002, .008), ph: rnd(0, 6.28) });
    while (drops.length < n) { const p = {}; place(p, now, !open); if (open) { p.born = t0 + rnd(650, 1150); p.fly = rnd(2.4, 4.2); p.life = rnd(8, 16); } drops.push(p); } drops.length = n; };
  fit(); aim();
  const run = now => {
    if (!air) return; air.raf = requestAnimationFrame(run); const ms = now - prev; odd = !odd; const settled = now - t0 > 4600;
    if (settled && odd) return;   // the air moves slowly: every other frame is plenty once the spray has landed
    prev = now; slowFrames = ms > (settled ? 80 : 45) ? slowFrames + 1 : Math.max(0, slowFrames - 2); if (slowFrames > 40) { slowFrames = 0; limit = Math.max(.4, limit * .75); }
    g.clearRect(0, 0, w, h); const s = (now - t0) / 1000, grow = open ? Math.min(1, Math.max(0, (s - .7) / 1.6)) : 1, size = Math.max(w, h);
    for (const v of veil) { const px = ((v.x + v.vx * s) % 1.3 + 1.3) % 1.3 - .15, py = ((v.y + v.vy * s) % 1.3 + 1.3) % 1.3 - .15, z = v.r * size; g.globalAlpha = (.036 + .012 * Math.sin(s * .22 + v.ph)) * grow; g.drawImage(dot, px * w - z, py * h - z, z * 2, z * 2); }
    const count = Math.round(drops.length * limit);
    for (let i = 0; i < count; i++) { const p = drops[i], age = (now - p.born) / 1000; if (age < 0) continue; if (age >= p.life) { place(p, now, false); continue; }
      const q = age / p.life, fade = Math.min(1, q / .14) * Math.min(1, (1 - q) / .22), glint = .72 + .28 * Math.sin(p.ph + s * p.tw), e = p.fly ? 1 - Math.exp(-p.fly * age) : 1;
      const dx = p.vx * age + Math.sin(p.ph + age * .55) * p.sw, dy = p.vy * age + Math.cos(p.ph + age * .42) * p.sw * .5, px = ox() + (p.x - ox()) * e + dx, py = oy() + (p.y - oy()) * e + dy, sz = p.r * 2.4;
      g.globalAlpha = p.a * fade * glint; g.drawImage(dot, px - sz, py - sz, sz * 2, sz * 2); }
    g.globalAlpha = 1;
  };
  // back from another app: the clock skips the time away, so the field carries on instead of all expiring and regrowing
  const vis = () => { if (document.hidden) { hiddenAt = performance.now(); return; } if (!hiddenAt) return; const gap = performance.now() - hiddenAt; hiddenAt = 0; t0 += gap; prev = performance.now(); for (const p of drops) p.born += gap; };
  air = { c, fit, vis, raf: requestAnimationFrame(run) }; addEventListener("resize", fit); document.addEventListener("visibilitychange", fit); document.addEventListener("visibilitychange", vis); requestAnimationFrame(() => { if (air && air.c === c) c.classList.add("on"); });
  document.documentElement.classList.remove("pour-still", "pour-mist"); document.documentElement.classList.add("pour-page");
  if (open) spritzAll();
}
function begin() {
  if (on || air) return;
  if (M.air) {
    if (RM.matches || new URLSearchParams(location.search).has("still")) { document.documentElement.classList.add("pour-still", "pour-mist", "pour-page"); return; }
    beginAir(); return;
  }
  if (!RM.matches && !gl && !tried) { tried = true; if (!setup()) gl = null; }   // only the smoke and mist pages ever pay for this
  if (RM.matches || !gl) { document.documentElement.classList.add("pour-still", "pour-page"); return; }
  document.body.prepend(cv); if (!size()) { toStill(); return; }
  on = true; parked = false; skip = false; odd = false; slow = 0; iters = 14; T = 0; drifts = []; aim(); heavy = firstOpen();
  if (heavy && waved()) for (let i = 0; i < 9; i++) { T += 1 / 30; step(2); } // the smoke wave hands over to a bank already rising
  if (!heavy) settle(); else if (M.radial) spritzAll(); // a later visit opens on air already drifting, with no second big entrance
  document.documentElement.classList.remove("pour-still"); document.documentElement.classList.add("pour-page"); show(); requestAnimationFrame(() => { if (on) cv.classList.add("on"); }); kick();
}
// the cologne spritz: on first open, fine droplets leave the bottle and fly across the whole screen, over everything, then fall away.
// Taps pass straight through it, and it is gone in about four seconds, leaving the mist behind the page.
let spray = null;
function endSpray() { if (!spray) return; cancelAnimationFrame(spray.raf); spray.c.width = spray.c.height = 0; spray.c.remove(); spray = null; }
function spritzAll() {
  endSpray(); const d = Math.min(1.5, devicePixelRatio || 1), c = document.createElement("canvas"); c.className = "pour pour--spritz"; c.setAttribute("aria-hidden", "true"); document.body.append(c); const w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight; c.width = Math.round(w * d); c.height = Math.round(h * d);
  const g = c.getContext("2d"); if (!g) { c.width = c.height = 0; c.remove(); return; } g.scale(d, d);
  const dot = document.createElement("canvas"); dot.width = dot.height = 24; const x = dot.getContext("2d"), rg = x.createRadialGradient(12, 12, 0, 12, 12, 12); rg.addColorStop(0, "rgba(255,253,248,1)"); rg.addColorStop(.45, "rgba(255,253,248,.62)"); rg.addColorStop(1, "rgba(255,253,248,0)"); x.fillStyle = rg; x.fillRect(0, 0, 24, 24);
  const rnd = (a, b) => a + Math.random() * (b - a), ox = org[0] * w, oy = (1 - org[1]) * h, n = Math.round(Math.min(1500, 240 + w * h / 700) * (lite ? .35 : 1)), drops = [], veil = [];
  for (let i = 0; i < 34; i++) veil.push({ tx: rnd(-.1, 1.1) * w, ty: rnd(-.1, 1.1) * h, k: rnd(1.8, 3), at: rnd(.5, .95), life: rnd(2.2, 3.2), r: Math.max(w, h) * rnd(.16, .3) });
  for (let i = 0; i < n; i++) { const late = i % 10 < 7, u = Math.random(); drops.push({ tx: rnd(-.02, 1.02) * w, ty: rnd(-.02, 1.02) * h, k: rnd(2.2, 4.2), at: (late ? .83 : .45) + rnd(0, .12), life: rnd(2.1, 3.1) * (late ? 1 : .8), r: .2 + .6 * u * u * u, a: rnd(.16, .48), fall: rnd(4, 16), ph: rnd(0, 6.28) }); }
  const t0 = performance.now(), run = now => {
    if (!spray) return; const s = (now - t0) / 1000; if (s > 4.3) { dot.width = dot.height = 0; endSpray(); return; }
    g.clearRect(0, 0, w, h);
    for (const p of veil) { const age = s - p.at; if (age <= 0 || age >= p.life) continue; const q = age / p.life, e = 1 - Math.exp(-p.k * age), z = p.r * (.3 + .8 * e); g.globalAlpha = .026 * Math.min(1, age / .3) * (1 - q * q); g.drawImage(dot, ox + (p.tx - ox) * e - z, oy + (p.ty - oy) * e - z, z * 2, z * 2); }
    for (const p of drops) { const age = s - p.at; if (age <= 0 || age >= p.life) continue; const q = age / p.life, e = 1 - Math.exp(-p.k * age), fade = q < .6 ? 1 : 1 - ((q - .6) / .4) ** 2, px = ox + (p.tx - ox) * e + Math.sin(p.ph + age) * 4 * e, py = oy + (p.ty - oy) * e + p.fall * q * q, sz = p.r * 2.4;
      g.globalAlpha = p.a * Math.min(1, age / .06) * fade; g.drawImage(dot, px - sz, py - sz, sz * 2, sz * 2); }
    g.globalAlpha = 1; spray.raf = requestAnimationFrame(run);
  };
  spray = { c, raf: requestAnimationFrame(run) };
}
function off() { endSpray(); endAir(); on = false; if (raf) cancelAnimationFrame(raf); raf = 0; cv.classList.remove("on"); release(); cv.width = cv.height = 0; cv.remove(); }
function stop() { document.documentElement.classList.remove("pour-page", "pour-still", "pour-mist"); if (on || air || spray || cv.isConnected) off(); }
// the filter bar is see-through while it sits in the page, and solid once it sticks over the products
function stick() { if (!head || !chips || !head.isConnected) return; chips.classList.toggle("is-stuck", head.getBoundingClientRect().bottom < chips.getBoundingClientRect().top - .5); }
// where the spray leaves the bottle
function aim() { const o = head && (head.querySelector(".fx-obj") || head), r = o && o.getBoundingClientRect(), h = cv.getBoundingClientRect().height || Hh; if (r && r.width) org = [(r.left + r.width / 2) / W, 1 - (r.top + r.height * .2) / h]; }
function place() {
  const hk = document.querySelector('.shophead[data-cat="hookahs"]'), hkp = document.querySelector('.pdp[data-cat="hookahs"]'), co = document.querySelector('.shophead[data-cat="cologne"]'), pdp = document.querySelector('.pdp[data-cat="cologne"]');
  const next = hk || hkp ? "hookahs" : co || pdp ? "cologne" : null;
  head = hk || co || ((pdp || hkp) && (pdp || hkp).querySelector("[data-stage]")) || null; chips = hk || co ? head.parentNode.querySelector(":scope > .chips") : null;
  const settled = () => { if (document.getElementById("main").childElementCount) arrivedBack = false; };   // only the page you came Back to skips its opening
  if (!next) { stop(); modeName = null; settled(); return; }
  if (next !== modeName) { document.documentElement.classList.remove("pour-still", "pour-mist"); if (on || air || spray || cv.isConnected) off(); }
  modeName = next; M = MODES[next]; begin(); stick(); settled();
}
addEventListener("scroll", stick, { passive: true });
let rs = 0; addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(() => { if (on && !lost && !parked && (innerWidth !== W || Math.abs(innerHeight - Hh) > 140)) { if (size()) { if (heavy && T < M.end) show(); else settle(); } else toStill(); } }, 200); });
document.addEventListener("visibilitychange", kick);
addEventListener("pagehide", () => { if (on && !lost) { if (raf) cancelAnimationFrame(raf); raf = 0; release(); parked = true; } });
addEventListener("pageshow", () => { if (parked && on && !lost) { parked = false; if (size()) settle(); else { toStill(); return; } } kick(); });
RM.addEventListener("change", () => { if (modeName) { stop(); place(); } });
const giveUp = () => { if (!lost || !on) return; if (document.hidden) { lostTimer = setTimeout(giveUp, 2000); return; } lost = false; F = null; toStill(); };
cv.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; if (raf) cancelAnimationFrame(raf); raf = 0; F = null; clearTimeout(lostTimer); lostTimer = setTimeout(giveUp, 2000); });
cv.addEventListener("webglcontextrestored", () => { clearTimeout(lostTimer); lost = false; parked = false; gl = null; const live = on, ok = setup(); if (!live) return; if (!ok || !size()) { toStill(); return; } if (heavy && T < M.end) show(); else settle(); kick(); });
new MutationObserver(place).observe(document.getElementById("main"), { childList: true }); place();
window.__pour = { canvas: cv, hold() { manual = true; if (raf) cancelAnimationFrame(raf); raf = 0; }, advance(sec, fps = 60) { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) { T += 1 / fps; step(60 / fps); } show(); return T; }, get t() { return T; } };
