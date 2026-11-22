// The hookah section's smoke: a real simulation that lives on the black page ground, behind every word, photo and button.
// It opens with one tornado touching down, smoke rising from the bottom, then thins and keeps drifting slowly upward while the page is open.
// Nothing is looped or played back: the flow is computed live and new drifts start at random, so it never repeats.
// WebGL2, no library, no images. With motion turned off, or on a phone that cannot run it, a designed still stands in.
const RM = matchMedia("(prefers-reduced-motion: reduce)"), KEY = "oss:pour-open";
const HOLD = 3.2, SETTLE = 4.8, CELLS = 422; // seconds; CELLS sets the size of one unit of flow against the height of the screen
const V = `#version 300 es
in vec2 a; out vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;
const H = `#version 300 es
precision highp float; precision highp sampler2D; in vec2 v; out vec4 o;`;
const NEAR = `uniform vec2 tx; vec2 L(){return v-vec2(tx.x,0.);} vec2 R(){return v+vec2(tx.x,0.);} vec2 B(){return v-vec2(0.,tx.y);} vec2 T(){return v+vec2(0.,tx.y);}`;
// The opening tornado: one slim funnel under the header, its tail running down the gap between the products.
const TOR = `uniform vec4 tg; uniform vec2 ta; uniform float tw;
float tor(vec2 p){ float y = 1. - p.y, wy = y + .006 * sin(p.x * tg.z * 9. + tg.w * .35) + .003 * sin(p.x * tg.z * 23. - tg.w * .5), s = clamp((wy - tg.x) / (tg.y - tg.x), 0., 1.), m = 1. - s;
  float cx = .5 + .038 * sin(s * 7. + .5 + tg.w * .3) * m * m, r = .006 + .188 * tw * pow(m, 4.1), u = clamp((p.x - cx) * tg.z / r, -1.35, 1.35), a = asin(clamp(u, -1., 1.)), q = 1. - pow(m, 2.4);
  float bands = .5 + .38 * sin(a * 1.9 + q * 34. + tg.w) + .12 * sin(a * 3.8 + q * 71. - tg.w * 1.3), shape = exp(-pow(abs(u) / .92, 4.2)) * (.72 + .28 * abs(u));
  float edge = clamp((wy - tg.x + .007) / .025, 0., 1.) * clamp((tg.y + .005 - wy) / .071, 0., 1.), front = tg.x + (tg.y - tg.x + .1) * ta.x;
  return clamp(shape * bands, 0., 1.) * 4.4 * edge * (1. - smoothstep(front - .06, front, wy)) * ta.y; }`;
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
  feed: `${H} ${TOR} uniform sampler2D Q; uniform float rate; void main(){ o = texture(Q, v) + vec4(rate * tor(v), 0., 0., 0.); }`,
  show: `${H} ${TOR} uniform sampler2D D; uniform vec3 c[5]; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec2 e = 1.4 / vec2(textureSize(D, 0)); float q = max(.4 * texture(D, v).r + .15 * (texture(D, v + e).r + texture(D, v - e).r + texture(D, v + vec2(e.x, -e.y)).r + texture(D, v + vec2(-e.x, e.y)).r), 0.); if (ta.x > 0. && ta.y > 0.) q += tor(v); float t = pow(1. - exp(-.8 * q), 1.25); vec3 s;
      if (t < .25) s = mix(c[0], c[1], t / .25); else if (t < .55) s = mix(c[1], c[2], (t - .25) / .3); else if (t < .82) s = mix(c[2], c[3], (t - .55) / .27); else s = mix(c[3], c[4], (t - .82) / .18);
      o = vec4(s + (h(gl_FragCoord.xy) - .5) / 255., 1.); }`,
};
// the store's own coal, then plain neutral smoke greys
function srgb(L, C, h) {
  const x = C * Math.cos(h * Math.PI / 180), y = C * Math.sin(h * Math.PI / 180), l = (L + .3963377774 * x + .2158037573 * y) ** 3, m = (L - .1055613458 * x - .0638541728 * y) ** 3, s = (L - .0894841775 * x - 1.291485548 * y) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s].map(n => { n = Math.min(1, Math.max(0, n)); return n <= .0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - .055; });
}
const RAMP = [[.155, .012, 50], [.205, .008, 80], [.265, .007, 80], [.315, .006, 80], [.345, .005, 80]].flatMap(c => srgb(...c));
const ease = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };

const cv = document.createElement("canvas"); cv.className = "pour"; cv.setAttribute("aria-hidden", "true"); cv.width = cv.height = 0;
let gl = null, P = {}, F = null, raf = 0, on = false, lost = false, last = 0, T = 0, heavy = false, drifts = [], iters = 14, slow = 0, skip = false, odd = false, parked = false, tried = false, lostTimer = 0, manual = false, head = null, chips = null, W = 0, Hh = 0, asp = 1;
const phase = [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3], seed = Math.random() * 400;
function setup() {
  if (new URLSearchParams(location.search).has("still")) return false;
  const g = cv.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!g || !(g.getExtension("EXT_color_buffer_float") || g.getExtension("EXT_color_buffer_half_float"))) return false;
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
// touches down in .75 s, turns slowly, and from 3 s loosens into the smoke around it
const TOR_END = 4.4, torNow = () => heavy && T < TOR_END ? [ease(0, .75, T), 1 - ease(3, TOR_END, T)] : null;
function torUniforms(n) {
  const b = head && head.isConnected ? head.getBoundingClientRect().bottom : 0, h = cv.getBoundingClientRect().height || Hh, top = Math.min(.8, Math.max(.04, b / h)), a = torNow() || [0, 0];
  gl.uniform4f(n.tg, top, Math.min(.94, top + .55), asp, T * 2.6); gl.uniform1f(n.tw, Math.max(1, asp * .9)); gl.uniform2f(n.ta, a[0], a[1]);
}
// how fast the air moves: a slow build on opening, then a very slow drift that never pulls the eye from the products
const pace = () => heavy ? .62 - .42 * ease(HOLD, SETTLE + 2.5, T) : .2;
function emit(dt, raw) {
  const R = .0011 * Math.max(1, asp * asp), BASE = .045;
  if (heavy && T < SETTLE) {
    const fade = 1 - ease(HOLD, SETTLE - .3, T), spots = asp > 1 ? [.5, .14, .86, .32, .68, .03, .97] : [.5, .14, .86, .32, .68];
    spots.forEach((s, i) => {
      const go = ease(2.3 + i * .12, 2.8 + i * .12, T) * fade * .8;   // the funnel stands clear first, then smoke rises as it loosens if (go <= 0) return;
      const x = s + .035 * Math.sin(T * .8 + phase[i % 3]), pulse = .64 + .36 * Math.sin(T * (2 + i * .23) + phase[i % 3] + i), side = .3 * Math.sin(T * 1.4 + phase[i % 3]);
      splat(F.u, x, BASE, R, side * go * dt, 2.1 * pulse * go * dt, 0); splat(F.d, x, BASE, R * 1.5, 1.05 * pulse * go * raw, 0, 0);
    });
  }
  if (!heavy || T > HOLD) {
    while (drifts.length < 7) { const rise = Math.PI / 2 + (Math.random() - .5) * 1.2, born = T + (drifts.length ? Math.random() * 2.4 : 0), life = 3 + Math.random() * 4.5;
      drifts.push({ x: .04 + Math.random() * .92, y: .02 + Math.random() * .38, a: rise, born, life, power: .03 + Math.random() * .035, turn: (Math.random() - .5) * .16, r: .0018 + Math.random() * .0034 }); }
    drifts = drifts.filter(e => T < e.born + e.life);
    for (const e of drifts) { const s = (T - e.born) / e.life; if (s < 0) continue; const go = Math.sin(Math.PI * s), a = e.a + e.turn * s * 6;
      splat(F.u, e.x, e.y, e.r * 1.4, Math.cos(a) * .5 * go * dt, Math.sin(a) * .5 * go * dt, 0); splat(F.d, e.x, e.y, e.r, e.power * go * raw, 0, 0); e.x += Math.cos(a) * .0007 * dt / asp; e.y += Math.sin(a) * .0007 * dt; }
  }
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
  pass("adv", F.d.b, n => { gl.uniform1i(n.U, tex(0, u.a)); gl.uniform1i(n.Q, tex(1, F.d.a)); gl.uniform2f(n.ts, ts[0], ts[1]); gl.uniform1f(n.dt, dt); gl.uniform1f(n.k, Math.pow(thin, raw)); gl.uniform1f(n.lift, raw * (heavy ? 2 - 1.8 * ease(HOLD, SETTLE + 2, T) : .2)); gl.uniform1f(n.w, T + seed); }); F.d.swap();
  if (torNow() && T > 3) { pass("feed", F.d.b, n => { gl.uniform1i(n.Q, tex(0, F.d.a)); torUniforms(n); gl.uniform1f(n.rate, .02 * raw); }); F.d.swap(); }
}
const show = () => pass("show", null, n => { gl.uniform1i(n.D, tex(0, F.d.a)); gl.uniform3fv(n.c, RAMP); torUniforms(n); });
function frame(now) {
  raf = 0; if (!on || lost || manual) return;
  const ms = Math.min(120, Math.max(1, now - last)); last = now;
  // a phone that truly struggles does less work and keeps moving. A steady 30 fps (Low Power Mode) is fine and is left alone.
  slow = ms > 45 ? slow + 1 : Math.max(0, slow - 2);
  if (slow > 60) { slow = 0; if (iters > 7) iters = 7; else skip = true; }
  T += ms / 1000; odd = !odd;
  if (!skip || odd) { step(Math.min(2.4, ms / 16.667 * (skip ? 2 : 1))); show(); }
  if (!document.hidden) raf = requestAnimationFrame(frame);
}
const kick = () => { if (on && !raf && gl && F && !lost && !parked && !manual && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
// the heavy opening plays once per visit (per tab), and never when arriving by Back or Forward
let played = false, popped = -1e9; addEventListener("popstate", () => { popped = performance.now(); });
function firstOpen() {
  if (played || performance.now() - popped < 800 || performance.getEntriesByType("navigation")[0]?.type === "back_forward") return false;
  played = true; try { if (sessionStorage.getItem(KEY)) return false; sessionStorage.setItem(KEY, "1"); } catch {} return true;
}
const toStill = () => { off(); gl = null; document.documentElement.classList.add("pour-still", "pour-page"); };
function settle() { heavy = false; for (let i = 0; i < 24; i++) { T += 1 / 30; step(2); } show(); }
function begin() {
  if (on) return;
  if (!RM.matches && !gl && !tried) { tried = true; if (!setup()) gl = null; }   // only the hookah page ever pays for this
  if (RM.matches || !gl) { document.documentElement.classList.add("pour-still", "pour-page"); return; }
  document.body.prepend(cv); if (!size()) { toStill(); return; }
  on = true; parked = false; skip = false; odd = false; slow = 0; iters = 14; T = 0; drifts = []; heavy = firstOpen();
  if (!heavy) settle(); // a later visit opens on smoke already drifting, with no second big entrance
  document.documentElement.classList.remove("pour-still"); document.documentElement.classList.add("pour-page"); show(); requestAnimationFrame(() => { if (on) cv.classList.add("on"); }); kick();
}
function off() { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; cv.classList.remove("on"); release(); cv.width = cv.height = 0; cv.remove(); }
function stop() { document.documentElement.classList.remove("pour-page", "pour-still"); if (on || cv.isConnected) off(); }
// the filter bar is see-through while it sits in the page, and solid once it sticks over the products
function stick() { if (!head || !chips || !head.isConnected) return; chips.classList.toggle("is-stuck", head.getBoundingClientRect().bottom < chips.getBoundingClientRect().top - .5); }
function place() {
  head = document.querySelector('.shophead[data-cat="hookahs"]'); chips = head && head.parentNode.querySelector(":scope > .chips");
  if (head) { begin(); stick(); } else stop();
}
addEventListener("scroll", stick, { passive: true });
let rs = 0; addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(() => { if (on && !lost && !parked && (innerWidth !== W || Math.abs(innerHeight - Hh) > 140)) { if (size()) settle(); else toStill(); } }, 200); });
document.addEventListener("visibilitychange", kick);
addEventListener("pagehide", () => { if (on && !lost) { if (raf) cancelAnimationFrame(raf); raf = 0; release(); parked = true; } });
addEventListener("pageshow", () => { if (parked && on && !lost) { parked = false; if (size()) settle(); else { toStill(); return; } } kick(); });
RM.addEventListener("change", () => { if (document.querySelector('.shophead[data-cat="hookahs"]')) { stop(); place(); } });
const giveUp = () => { if (!lost || !on) return; if (document.hidden) { lostTimer = setTimeout(giveUp, 2000); return; } lost = false; F = null; toStill(); };
cv.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; if (raf) cancelAnimationFrame(raf); raf = 0; F = null; clearTimeout(lostTimer); lostTimer = setTimeout(giveUp, 2000); });
cv.addEventListener("webglcontextrestored", () => { clearTimeout(lostTimer); lost = false; gl = null; const live = on, ok = setup(); if (!live) return; if (!ok || !size()) { toStill(); return; } settle(); kick(); });
new MutationObserver(place).observe(document.getElementById("main"), { childList: true }); place();
window.__pour = { canvas: cv, hold() { manual = true; if (raf) cancelAnimationFrame(raf); raf = 0; }, advance(sec, fps = 60) { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) { T += 1 / fps; step(60 / fps); } show(); return T; }, get t() { return T; } };
