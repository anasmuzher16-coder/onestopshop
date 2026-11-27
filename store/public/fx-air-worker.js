// The air, drawn off the main thread (fx-air.js hands its canvas over). Messages: init {canvas}, reset {hidden}, size {w, h, d}, want
// {kind, burst, origin}, origin {origin}, wave {wave}, hide, show {gap}, end. It posts back {kind, burst} each time the air shown changes.
import { makeAir } from "./air-core.js";
let air = null, raf = 0, on = false, wave = null, canvas = null;
const next = self.requestAnimationFrame ? f => self.requestAnimationFrame(f) : f => setTimeout(() => f(performance.now()), 16);
const stop = id => (self.cancelAnimationFrame ? self.cancelAnimationFrame(id) : clearTimeout(id));
function loop(t) { raf = 0; if (!on || !air) return; raf = next(loop); air.frame(t, wave); }
function run() { if (!raf && on && air) raf = next(loop); }
// a new air on the canvas: at init, and at reset (the page parked this worker and has taken it back), exactly as a new worker's would start
function fresh(hidden) {
  air = makeAir(canvas, n => new OffscreenCanvas(n, n));
  if (!air) { self.postMessage({ type: "fail" }); return; }
  air.onKind = (kind, burst) => self.postMessage({ type: "kind", kind, burst }); air.start(performance.now()); on = !hidden; run();
}
self.onmessage = ({ data: m }) => {
  if (m.type === "init") { canvas = m.canvas; fresh(m.hidden); }
  else if (m.type === "reset") { if (raf) stop(raf); raf = 0; wave = null; if (canvas) fresh(m.hidden); }
  else if (!air) return;
  else if (m.type === "size") air.size(m.w, m.h, m.d);
  else if (m.type === "wave") wave = m.wave;
  else if (m.type === "origin") air.origin(m.origin);
  else if (m.type === "want") { air.want(m.kind, m.burst, m.origin); run(); }
  else if (m.type === "hide") { on = false; if (raf) stop(raf); raf = 0; }
  else if (m.type === "show") { if (m.gap > 0) air.shift(m.gap); on = true; run(); }
  else if (m.type === "end") { on = false; if (raf) stop(raf); raf = 0; air = null; self.close(); }
};
