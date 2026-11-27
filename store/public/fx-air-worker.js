// The air, drawn off the main thread (fx-air.js hands its canvas over). Messages: init {canvas}, size {w, h, d}, want {kind, burst,
// origin}, origin {origin}, wave {wave}, hide, show {gap}, end. It posts back {kind, burst} each time the air shown changes.
// The drawing code is a dynamic import, never a static one: in Safari's engine a module worker whose static import fails to load
// (a page change cutting the download short, a dropped connection) throws "Importing a module script failed." as an uncaught
// error on the page itself, which no handler on the Worker can stop (GitHub runs 46032165082, 46033764055, 46034474945,
// 46036050108: e2e-delivery's "no page errors" on WebKit). A dynamic import's failure is caught here and answered with "fail",
// and fx-air.js then draws the air on the main thread, as for an engine without workers. Messages that arrive before the code
// has loaded wait in order.
const core = import("./air-core.js");
let air = null, raf = 0, on = false, wave = null, makeAir = null, waiting = [];
const next = self.requestAnimationFrame ? f => self.requestAnimationFrame(f) : f => setTimeout(() => f(performance.now()), 16);
const stop = id => (self.cancelAnimationFrame ? self.cancelAnimationFrame(id) : clearTimeout(id));
function loop(t) { raf = 0; if (!on || !air) return; raf = next(loop); air.frame(t, wave); }
function run() { if (!raf && on && air) raf = next(loop); }
function handle(m) {
  if (m.type === "init") {
    air = makeAir(m.canvas, n => new OffscreenCanvas(n, n));
    if (!air) { self.postMessage({ type: "fail" }); return; }
    air.onKind = (kind, burst) => self.postMessage({ type: "kind", kind, burst }); air.start(performance.now()); on = !m.hidden; run();
  } else if (m.type === "end") { on = false; if (raf) stop(raf); raf = 0; air = null; waiting = null; self.close(); }
  else if (!air) return;
  else if (m.type === "size") air.size(m.w, m.h, m.d);
  else if (m.type === "wave") wave = m.wave;
  else if (m.type === "origin") air.origin(m.origin);
  else if (m.type === "want") { air.want(m.kind, m.burst, m.origin); run(); }
  else if (m.type === "hide") { on = false; if (raf) stop(raf); raf = 0; }
  else if (m.type === "show") { if (m.gap > 0) air.shift(m.gap); on = true; run(); }
}
self.onmessage = ({ data: m }) => { if (waiting) waiting.push(m); else if (makeAir) handle(m); };
// a throw while the waiting messages are handled (inside this promise, it would never reach the Worker's onerror) is answered
// with "fail" too, so the main thread still takes the air over (breaker, 2026-11-27)
core.then(mod => { if (!waiting) return; makeAir = mod.makeAir; const q = waiting; waiting = null; try { for (const m of q) handle(m); } catch { air = null; if (raf) stop(raf); raf = 0; makeAir = null; self.postMessage({ type: "fail" }); } },
  () => { if (!waiting) return; waiting = null; self.postMessage({ type: "fail" }); });
