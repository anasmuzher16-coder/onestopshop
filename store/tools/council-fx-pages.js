// 06 section entrances, continued: the pages that are not a shop section. Same rule as fx-sections.js: one solid
// object on the right of the band, one act at the counter when the page opens, contact at T0, and the object reacts.
//   set       the carton is slit open, the flaps are thrown back, the four picks are dropped in; it is taped when bought
//   search    the counter bell is struck once and rings; it dings as you type and is rung hard when nothing matches
//   cart      the shop's paper bag is set down and what you are buying goes in; it hops when a quantity changes
//   checkout  the till prints the receipt a line at a time; "Place order" tears it off
//   shipping  tape is pulled over the seam, then the address label is slapped on and the box gives
//   gifts     the bow is pulled tight: the loops snap out, the knot bites, the tails flick
//   terms     the pen comes down and signs      privacy   the pen strikes one line out
//   missing   the last piece is lifted off the hook and its tag is left swinging
//   all       three pieces are faced up on the shelf, one after the other, each a little sooner
//
// PASTE: everything below goes into fx-sections.js after the FX object (it uses obj, play, when, T0, WIND, ENTER, STATE,
// STRIKE, RM, OBJ, FX and uid from that file, and adds nothing to the page until a band asks for it).
// One line of place() in fx-sections.js changes (the fxAgain hook), and build-objects.mjs must expect 17 drawings: see
// pages.md under "wiring". The `export`s are there so app.js may call the live functions directly if it prefers.
//
// Two drawing tools the first eight did not need (pages.css):
//   .cut / .cutl   a shape or line in the band's own colour: a knock-out that can move (tape, a signature, a label)
//   .halo          a solid part with a knock-out edge, so it reads where it crosses another part (the pen on the sheet)

const SINE = "cubic-bezier(.37,0,.63,1)";
// the object on a page band, from its layer or by name
const find = (layer, name) => { const l = layer || document.querySelector(`.shophead[data-fx="${name}"] > .fx`); return l ? l.querySelector(".fx-obj") : null; };
// a piece dropped into something: appears above it, falls speeding up, lands at `at`, one small knock
const drop = (node, at, from = -26) => {
  play(node, [{ opacity: 0 }, { opacity: 1 }], 60, at - 150);
  return play(node, [{ transform: `translateY(${from}px)`, easing: STRIKE }, { transform: "translateY(0px)", offset: .6, easing: ENTER },
    { transform: "translateY(-1.6px)", offset: .8, easing: STRIKE }, { transform: "translateY(0px)" }], 250, at - 150);
};
// whatever it landed in gives: wider and shorter for a moment, then back
const thump = (node, at, sx = 1.03, sy = .96) => play(node, [{ transform: "scale(1,1)", easing: ENTER }, { transform: `scale(${sx},${sy})`, offset: .25, easing: STATE },
  { transform: "scale(.996,1.01)", offset: .6, easing: STATE }, { transform: "scale(1,1)" }], 260, at, "none");
// a label slapped on (the price gun's stamp, written with transform so it is safe on a part inside the drawing)
const slap = (node, hit, from = 1.6) => {
  play(node, [{ opacity: 0 }, { opacity: 1 }], 42, hit - 140);
  return play(node, [{ transform: `scale(${from}) rotate(8deg)`, easing: STRIKE }, { transform: "scale(1) rotate(0deg)", offset: .3333, easing: ENTER },
    { transform: "scale(.92) rotate(0deg)", offset: .4286, easing: STATE }, { transform: "scale(1.035) rotate(0deg)", offset: .5952, easing: STATE },
    { transform: "scale(.995) rotate(0deg)", offset: .8095, easing: STATE }, { transform: "scale(1) rotate(0deg)" }], 420, hit - 140);
};

// ---- search: one strike of the bell. The button is lifted a hair, driven down, and the dome shivers until it is quiet.
const ding = (o, at, power = 1) => {
  const pl = o.querySelector(".plunger"), bell = o.querySelector(".bell"), fr = [{ transform: "translateX(0px)" }];
  play(pl, [{ transform: "translateY(0px)", easing: STATE }, { transform: `translateY(${-2.5 * power}px)`, offset: .3, easing: STRIKE },
    { transform: `translateY(${6 * power}px)`, offset: .52, easing: ENTER }, { transform: "translateY(-1px)", offset: .8, easing: STATE }, { transform: "translateY(0px)" }], 270, at - 140, "none");
  for (let i = 1; i < 10; i++) fr.push({ transform: `translateX(${(i % 2 ? 1 : -1) * 1.5 * power * Math.pow(.72, i - 1)}px)` });
  fr.push({ transform: "translateX(0px)" });
  play(bell, fr, 430, at, "none");
};
// ---- checkout: the receipt comes out a printed line at a time; the printer shakes with each line
const feed = (o, at) => {
  const paper = o.querySelector(".feed"), Y = [56, 40, 32.5, 25, 13.5, 0], per = 130, mv = 70, dur = (Y.length - 1) * per - (per - mv), fr = [], jit = [];
  for (let i = 0; i < Y.length - 1; i++) {
    const a = i * per / dur, b = (i * per + mv) / dur;
    fr.push({ transform: `translateY(${Y[i]}px)`, offset: a, easing: STATE }, { transform: `translateY(${Y[i + 1]}px)`, offset: b });
    jit.push({ transform: "translateX(0px)", offset: a }, { transform: `translateX(${i % 2 ? -.6 : .7}px)`, offset: (a + b) / 2 }, { transform: "translateX(0px)", offset: b });
  }
  play(paper, fr, dur, at - mv);           // the first line is out at `at`
  play(o.querySelector(".till"), jit, dur, at - mv, "none");
  play(o.querySelector(".slot"), [{ transform: "rotate(0deg)", easing: ENTER }, { transform: "rotate(1.6deg)", offset: .3, easing: STATE }, { transform: "rotate(-.7deg)", offset: .65, easing: STATE },
    { transform: "rotate(0deg)" }], 420, at - mv + dur, "none");   // the loose end sways once it stops
};
// what the page says, read from the page itself, so app.js has nothing to pass in
const haveOf = host => [...((host && host.dataset.have) || "1111").padEnd(4, "0").slice(0, 4)].map(c => c === "1"); // the set page always has four picks
const lineCount = () => document.querySelectorAll(".lines .line").length;
const qtySum = () => [...document.querySelectorAll(".lines .qty .num")].reduce((a, n) => a + (+n.textContent || 0), 0);
const destText = () => { const b = document.querySelector(".reading [data-open-postal]"); return b ? b.textContent : ""; };

Object.assign(FX, {
  set(layer, go, host) {
    const o = obj(layer, OBJ.set), q = c => o.querySelector(c), its = [...o.querySelectorAll(".it")], have = haveOf(host);
    its.forEach((n, i) => n.classList.toggle("in", have[i]));
    if (host && host.dataset.sealed != null) o.classList.add("shut");
    if (!go || o.classList.contains("shut")) return;
    // it arrives shut and taped. The tape is slit (wind-up), the flaps are thrown back at T0, the box hops,
    // then what is already picked on the page goes in, left to right.
    play(q(".tape"), [{ opacity: 1, transform: "scaleY(1)", transformOrigin: "50px 60px", easing: STRIKE }, { opacity: 1, transform: "scaleY(0)", transformOrigin: "50px 60px" }], 150, WIND - 70);
    const open = (n, from, at) => play(n, [{ transform: `rotate(${from}deg)`, easing: ENTER }, { transform: `rotate(${-from * .07}deg)`, offset: .5, easing: STATE },
      { transform: `rotate(${from * .03}deg)`, offset: .78, easing: STATE }, { transform: "rotate(0deg)" }], 520, at);
    open(q(".flapl"), 118, T0); open(q(".flapr"), -118, T0 + 70);
    play(q(".crate"), [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(-2.5px)", offset: .35, easing: STRIKE }, { transform: "translateY(0px)" }], 200, T0, "none");
    let at = T0 + 330;
    its.forEach((n, i) => { if (!have[i]) return; drop(n, at); thump(q(".crate"), at); at += 120; });
  },
  search(layer, go) {
    const o = obj(layer, OBJ.search);
    if (go) ding(o, T0);
  },
  cart(layer, go, host) {
    const o = obj(layer, OBJ.cart), pk = [...o.querySelectorAll(".pk")], bag = o.querySelector(".bag");
    const n = Math.min(3, lineCount()); let q = qtySum();
    pk.forEach((p, i) => p.classList.toggle("in", i < n));
    layer.fxAgain = () => { const now = qtySum(); if (now !== q) { q = now; cartBump(layer, lineCount()); } }; // the cart was re-drawn: did a quantity change?
    if (!go) return;
    play(bag, [{ opacity: 0 }, { opacity: 1 }], 70, T0 - 180); // it is not on the counter until it is put there
    play(bag, [ // set down: comes in tilted, lands, squashes, stands up straight
      { transform: "translateY(-20px) rotate(-3deg) scale(1,1)", easing: STRIKE }, { transform: "translateY(0px) rotate(1.2deg) scale(1.035,.95)", offset: .42, easing: ENTER },
      { transform: "translateY(0px) rotate(-.5deg) scale(.99,1.015)", offset: .7, easing: STATE }, { transform: "translateY(0px) rotate(0deg) scale(1,1)" }], 430, T0 - 180);
    play(o.querySelector(".handle"), [ // the handle keeps going after the bag has stopped, folds, and stands again
      { transform: "scale(1,1.06)", easing: STRIKE }, { transform: "scale(1,1.02)", offset: .35, easing: ENTER }, { transform: "scale(1.05,.76)", offset: .55, easing: STATE },
      { transform: "scale(.985,1.05)", offset: .8, easing: STATE }, { transform: "scale(1,1)" }], 520, T0 - 180);
    pk.slice(0, n).forEach((p, i) => { const at = T0 + 280 + i * 130; drop(p, at, -24); thump(bag, at, 1.025, .97); });
  },
  checkout(layer, go) {
    // the paper is cut off at the mouth of the printer, so it can only come up out of it
    const id = "fxp" + (++uid), o = obj(layer, `<defs><clipPath id="${id}"><rect x="-10" y="-40" width="120" height="105.2"/></clipPath></defs>${OBJ.checkout}`);
    o.querySelector(".slot").setAttribute("clip-path", `url(#${id})`);
    if (go) feed(o, T0);
  },
  shipping(layer, go) {
    const o = obj(layer, OBJ.shipping), q = c => o.querySelector(c); let dest = destText();
    layer.fxAgain = () => { const now = destText(); if (now !== dest) { dest = now; shippingLabel(layer); } }; // a new postal code: a new label
    if (!go) return;
    play(q(".tape"), [{ transform: "scaleY(0)", easing: STATE }, { transform: "scaleY(1)" }], 250, 60); // pulled over the top and down the front, done by the wind-up
    slap(q(".label"), T0);                                                                               // then the label, hard
    thump(q(".parcel"), T0, 1.012, .972);
  },
  gifts(layer, go) {
    const o = obj(layer, OBJ.gifts), q = c => o.querySelector(c);
    if (!go) return;
    // slack to start; the hands take the loops (they dip), pull them out and the knot bites at T0; then everything springs
    const D = 700, at = T0 - 200, loop = s => [
      { transform: `rotate(${-16 * s}deg) scale(.74,.8)`, easing: STATE }, { transform: `rotate(${-18 * s}deg) scale(.7,.78)`, offset: .1, easing: STRIKE },
      { transform: `rotate(${4 * s}deg) scale(1.12,.9)`, offset: .2857, easing: ENTER }, { transform: `rotate(${-2 * s}deg) scale(.97,1.03)`, offset: .5, easing: STATE },
      { transform: `rotate(${.8 * s}deg) scale(1.01,.995)`, offset: .75, easing: STATE }, { transform: "rotate(0deg) scale(1,1)" }];
    const tail = s => [
      { transform: `rotate(${6 * s}deg) scale(1.12)`, easing: STATE }, { transform: `rotate(${6 * s}deg) scale(1.12)`, offset: .1, easing: STRIKE },
      { transform: `rotate(${-7 * s}deg) scale(1)`, offset: .2857, easing: ENTER }, { transform: `rotate(${3 * s}deg) scale(1)`, offset: .5, easing: STATE },
      { transform: `rotate(${-1.2 * s}deg) scale(1)`, offset: .75, easing: STATE }, { transform: "rotate(0deg) scale(1)" }];
    play(q(".loopl"), loop(1), D, at); play(q(".loopr"), loop(-1), D, at);
    play(q(".taill"), tail(-1), D, at); play(q(".tailr"), tail(1), D, at);
    play(q(".knot"), [{ transform: "scale(1.25,1.2)", easing: STATE }, { transform: "scale(1.25,1.2)", offset: .1, easing: STRIKE }, { transform: "scale(.8,.86)", offset: .2857, easing: ENTER },
      { transform: "scale(1.05,1.05)", offset: .5, easing: STATE }, { transform: "scale(1,1)" }], D, at);
    play(q(".lid"), [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(1.2px)", offset: .25, easing: STATE }, { transform: "translateY(0px)" }], 240, T0, "none");
  },
  terms(layer, go) {
    const o = obj(layer, OBJ.terms, "signed");
    if (!go) return; // at rest the signature is simply drawn: no dash is left on it
    const sign = o.querySelector(".sign"), D = 640, lead = T0 - WIND, total = lead + D + 260;
    // the nib along the signature, in equal steps of its length, measured from where the pen ends up
    const P = [[-34, 6.5], [-32.1, 1.5], [-28.7, -2.6], [-25.9, .7], [-25.9, 6.1], [-21.8, 6.4], [-19, 1.5], [-16.1, -2.4], [-14.2, 1.9], [-13.7, 6.7], [-9.3, 4.3], [-4.8, 1.5], [0, 0]];
    const fr = [{ transform: "translate(-37px,-5px) rotate(-8deg)", easing: STRIKE }];
    P.forEach((p, i) => fr.push({ transform: `translate(${p[0]}px,${p[1]}px) rotate(0deg)`, offset: (lead + D * i / (P.length - 1)) / total, easing: i === P.length - 1 ? ENTER : "linear" }));
    fr.push({ transform: "translate(2.5px,-4px) rotate(-5deg)", offset: (lead + D + 110) / total, easing: STATE }, { transform: "translate(0px,0px) rotate(0deg)" });
    play(o.querySelector(".pen"), fr, total, WIND); // comes down, touches at T0, writes, lifts off with a flick, is put down
    sign.style.strokeDasharray = "1 1";
    play(sign, [{ opacity: 0 }, { opacity: 1 }], 1, T0);
    play(sign, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], D, T0).onfinish = () => { sign.style.strokeDasharray = ""; };
  },
  privacy(layer, go) {
    const o = obj(layer, OBJ.terms, "struck");
    if (!go) return;
    const D = 380, lead = T0 - WIND, total = lead + D + 260;
    play(o.querySelector(".redact"), [{ transform: "scaleX(0)", easing: SINE }, { transform: "scaleX(1)" }], D, T0); // one pass of the marker
    play(o.querySelector(".pen"), [{ transform: "translate(-38px,-45px) rotate(-8deg)", easing: STRIKE }, { transform: "translate(-35.5px,-35px) rotate(0deg)", offset: lead / total, easing: SINE },
      { transform: "translate(3.5px,-35px) rotate(0deg)", offset: (lead + D) / total, easing: ENTER }, { transform: "translate(6px,-39px) rotate(-5deg)", offset: (lead + D + 110) / total, easing: STATE },
      { transform: "translate(3.5px,-35px) rotate(0deg)" }], total, WIND);
  },
  docs(layer, go, host) { return (/privacy/.test(location.pathname) ? FX.privacy : FX.terms)(layer, go, host); },
  missing(layer, go) {
    const o = obj(layer, OBJ.missing);
    if (!go) return;
    // the piece is lifted off the hook and drags the tag with it; let go at T0, the tag swings out less each time
    const A = [0, 22, -15, 9.5, -6, 3.4, -1.8, .8, 0], lead = T0 - WIND, half = 290, total = lead + half * (A.length - 2);
    const fr = k => A.map((a, i) => ({ transform: `rotate(${a * k}deg)`, offset: i < 2 ? i * lead / total : (lead + half * (i - 1)) / total, easing: i ? SINE : STRIKE }));
    play(o.querySelector(".swing"), fr(1), total, WIND);
    play(o.querySelector(".tag"), fr(-.26), total, WIND + 40);  // the tag trails its string
    play(o.querySelector(".prong"), [{ transform: "rotate(0deg)", easing: STRIKE }, { transform: "rotate(-1.8deg)", offset: .3, easing: ENTER }, { transform: "rotate(.7deg)", offset: .6, easing: STATE },
      { transform: "rotate(0deg)" }], 460, WIND, "none"); // the hook bends under the pull and springs back
  },
  all(layer, go) {
    const o = obj(layer, OBJ.all), plank = o.querySelector(".plank");
    if (!go) return;
    let hit = T0; // put up one after the other, each a little sooner; the shelf dips under each
    [0, 240, 150].forEach((gap, i) => {
      hit += gap; const p = o.querySelector(".p" + i);
      play(p, [{ opacity: 0 }, { opacity: 1 }], 60, hit - 140);
      play(p, [{ transform: "translateY(-22px) rotate(-3deg)", easing: STRIKE }, { transform: "translateY(0px) rotate(2deg)", offset: .4, easing: ENTER },
        { transform: "translateY(-3px) rotate(-1.2deg)", offset: .6, easing: STRIKE }, { transform: "translateY(0px) rotate(.6deg)", offset: .8, easing: STATE }, { transform: "translateY(0px) rotate(0deg)" }], 350, hit - 140);
      play(plank, [{ transform: "translateY(0px)", easing: ENTER }, { transform: "translateY(1.4px)", offset: .3, easing: STATE }, { transform: "translateY(-.4px)", offset: .65, easing: STATE },
        { transform: "translateY(0px)" }], 220, hit, "none");
    });
  },
});

// ================= live state: app.js calls these when the page changes without a route change =================
// Each takes the band's layer, or null to find it. Each is a no-op when the band is not on the page, and with motion
// turned off it only sets the resting state.

// set: have = [hookah, bowl, heat keeper, hose] as booleans; changed = index of the slot just tapped (-1 if none).
// A new pick drops in; a swapped pick is lifted out and the new one dropped in its place; an unpicked one is lifted out.
export function setProgress(layer, have, changed = -1) {
  const o = find(layer, "set"); if (!o) return;
  const its = [...o.querySelectorAll(".it")], was = its.map(n => n.classList.contains("in")), crate = o.querySelector(".crate"), shut = o.classList.contains("shut");
  its.forEach((n, i) => n.classList.toggle("in", !!have[i]));
  o.classList.remove("shut");
  if (RM.matches) return;
  let at = 150;
  if (shut) { // changed after it was taped: it is opened again first
    play(o.querySelector(".flapl"), [{ transform: "rotate(118deg)", easing: ENTER }, { transform: "rotate(0deg)" }], 300);
    play(o.querySelector(".flapr"), [{ transform: "rotate(-118deg)", easing: ENTER }, { transform: "rotate(0deg)" }], 300, 50);
    its.forEach((n, i) => { if (have[i] && i !== changed) { drop(n, at + 100); } }); at += 220;
  }
  its.forEach((n, i) => {
    if (have[i] && was[i] && i === changed && !shut) { // swapped: up and out, then the new one in; lands at 336 ms
      play(n, [{ opacity: 1, transform: "translateY(0px)", easing: ENTER }, { opacity: 0, transform: "translateY(-30px)", offset: .3 }, { opacity: 0, transform: "translateY(-26px)", offset: .38 },
        { opacity: 1, transform: "translateY(-26px)", offset: .44, easing: STRIKE }, { opacity: 1, transform: "translateY(0px)", offset: .8, easing: ENTER },
        { opacity: 1, transform: "translateY(-1.6px)", offset: .9, easing: STRIKE }, { opacity: 1, transform: "translateY(0px)" }], 420, 0, "none");
      thump(crate, 336);
    } else if (have[i] && (!was[i] || (shut && i === changed))) { drop(n, at); thump(crate, at); at += 120; }
    else if (!have[i] && was[i]) play(n, [{ opacity: 1, transform: "translateY(0px)", easing: ENTER }, { opacity: 0, transform: "translateY(-28px)" }], 180);
  });
}
// set: "Add the set" was pressed. The pieces are pressed down, the flaps folded over, the tape run across. Returns the
// milliseconds until it is sealed (0 with motion off), so the caller may hold the page change that long if it wants to.
export function setSeal(layer) {
  const o = find(layer, "set"); if (!o || o.classList.contains("shut")) return 0;
  const crate = o.querySelector(".crate");
  o.classList.add("shut");
  if (RM.matches) return 0;
  o.querySelectorAll(".it.in").forEach(n => play(n, [{ opacity: 1, transform: "translateY(0px)", easing: STRIKE }, { opacity: 1, transform: "translateY(12px)", offset: .8 }, { opacity: 0, transform: "translateY(14px)" }], 150));
  play(o.querySelector(".flapl"), [{ transform: "rotate(0deg)", easing: STRIKE }, { transform: "rotate(118deg)" }], 150, 90);
  play(o.querySelector(".flapr"), [{ transform: "rotate(0deg)", easing: STRIKE }, { transform: "rotate(-118deg)" }], 150, 150);
  thump(crate, 300, 1.02, .975);
  play(o.querySelector(".tape"), [{ opacity: 1, transform: "scaleY(0)", easing: STATE }, { opacity: 1, transform: "scaleY(1)" }], 140, 320);
  return 460;
}

// search: call after the results are re-drawn, with the number of hits and the text typed.
// A light ding per keystroke (never more than one every 160 ms); the first time nothing matches it is rung twice, hard,
// and the bell rocks on its base. Cards that were not in the last set of results are dealt onto the counter.
let lastDing = 0, wasZero = false, shown = new Set();
export function searchTyped(layer, hits, q = "") {
  searchDeal();
  const o = find(layer, "search"); if (!o || RM.matches) return;
  const zero = !!q.trim() && hits === 0, now = performance.now();
  if (zero && !wasZero) {
    ding(o, 140, 1); ding(o, 340, .85);
    play(o.querySelector("svg"), [{ rotate: "0deg", transformOrigin: "50% 94%", easing: ENTER }, { rotate: "-4deg", transformOrigin: "50% 94%", offset: .2, easing: SINE },
      { rotate: "3deg", transformOrigin: "50% 94%", offset: .5, easing: SINE }, { rotate: "-1.2deg", transformOrigin: "50% 94%", offset: .78, easing: SINE }, { rotate: "0deg", transformOrigin: "50% 94%" }], 620, 140, "none");
    lastDing = now + 400;
  } else if (!zero && now - lastDing > 160) { ding(o, 140, .45); lastDing = now; }
  wasZero = zero;
}
export function searchDeal(out) {
  out = out || document.querySelector("[data-search-out]"); if (!out) return;
  const now = new Set(), fresh = [];
  for (const c of out.querySelectorAll(".card")) { const a = c.querySelector("[data-piece]"), sku = a ? a.dataset.piece : ""; now.add(sku); if (!shown.has(sku)) fresh.push(c); }
  shown = now;
  if (RM.matches) return;
  const vh = innerHeight; let k = 0;
  for (const c of fresh) { // only what is on screen, the first eight one after the other, the rest with the eighth
    const r = c.getBoundingClientRect(); if (r.top >= vh || r.bottom <= 0) continue;
    play(c, [{ opacity: 0, translate: "18px -8px", rotate: "2.4deg", easing: ENTER }, { opacity: 1, translate: "0 0", rotate: "0deg" }], 320, Math.min(k++, 7) * 34);
  }
}
addEventListener("routechange", () => { shown = new Set(); wasZero = false; });

// cart: call after the cart is re-drawn following a quantity change, with the number of lines now in it.
// The bag hops and its handle swings; a line that is new drops in, a line that is gone is lifted out.
export function cartBump(layer, lines) {
  const o = find(layer, "cart"); if (!o) return;
  const pk = [...o.querySelectorAll(".pk")], bag = o.querySelector(".bag"), still = RM.matches;
  if (lines != null) pk.forEach((p, i) => {
    const was = p.classList.contains("in"), is = i < Math.min(3, lines); p.classList.toggle("in", is);
    if (still || was === is) return;
    if (is) drop(p, 330, -24); else play(p, [{ opacity: 1, transform: "translateY(0px)", easing: ENTER }, { opacity: 0, transform: "translateY(-24px)" }], 180);
  });
  if (still) return;
  play(bag, [{ transform: "translateY(0px) rotate(0deg) scale(1,1)", easing: ENTER }, { transform: "translateY(-4px) rotate(1.5deg) scale(1,1)", offset: .35, easing: STRIKE },
    { transform: "translateY(0px) rotate(-.6deg) scale(1.02,.97)", offset: .62, easing: STATE }, { transform: "translateY(0px) rotate(0deg) scale(1,1)" }], 320, 0, "none");
  play(o.querySelector(".handle"), [{ transform: "rotate(0deg)", easing: ENTER }, { transform: "rotate(-6deg)", offset: .3, easing: SINE }, { transform: "rotate(3.5deg)", offset: .62, easing: SINE },
    { transform: "rotate(-1.2deg)", offset: .84, easing: SINE }, { transform: "rotate(0deg)" }], 520, 60, "none");
}

// checkout: "Place order" was pressed: the receipt is torn off and taken. If the order fails, call checkoutFeed and a
// new one is printed.
export function checkoutTear(layer) {
  const o = find(layer, "checkout"); if (!o || RM.matches) return;
  o.querySelector(".feed").animate([{ transform: "translate(0px,0px) rotate(0deg)", opacity: 1, easing: STATE }, { transform: "translate(0px,-3px) rotate(-3deg)", opacity: 1, offset: .3, easing: ENTER },
    { transform: "translate(8px,-18px) rotate(11deg)", opacity: 0 }], { duration: 380, fill: "forwards" });
}
export function checkoutFeed(layer) {
  const o = find(layer, "checkout"); if (!o) return;
  o.querySelector(".feed").getAnimations().forEach(a => a.cancel());
  if (!RM.matches) feed(o, 140);
}

// shipping: a postal code was entered or changed: a fresh label is slapped on.
export function shippingLabel(layer) {
  const o = find(layer, "shipping"); if (!o || RM.matches) return;
  slap(o.querySelector(".label"), 140); thump(o.querySelector(".parcel"), 140, 1.012, .972);
}

// ================= wiring: the page moments, heard from the page (app.js needs no change for these) =================
// These listeners are added after app.js has added its own (effects load after the page is up), so by the time they
// run app.js has already re-drawn whatever the tap or keystroke changed.
const SLOT = ["hookah", "bowl", "heat", "hose"];
document.addEventListener("click", e => {
  const pk = e.target.closest("[data-set]"), o = pk && find(null, "set"), i = pk ? SLOT.indexOf(pk.dataset.set) : -1;
  if (o && i >= 0) { const have = [...o.querySelectorAll(".it")].map(n => n.classList.contains("in")); have[i] = true; setProgress(null, have, i); }
  if (e.target.closest("[data-add-set]")) setSeal(null); // seen only if the page change waits for it: see pages.md
});
document.addEventListener("input", e => {
  const out = e.target.id === "q" && document.querySelector("[data-search-out]");
  if (out) searchTyped(null, out.querySelectorAll(".card").length, e.target.value);
});
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-checkout]"), btn = f && f.querySelector('button[type="submit"]');
  if (!btn || !btn.disabled) return;     // app.js disables the button only once the order is really on its way
  checkoutTear(null);
  new MutationObserver((m, ob) => { if (!btn.isConnected) return ob.disconnect(); if (!btn.disabled) { ob.disconnect(); checkoutFeed(null); } }).observe(btn, { attributes: true, attributeFilter: ["disabled"] });
});

// ================= home: a section below the hero that plays an object's act the first time it is seen =================
// UNVERIFIED sketch (never run in a browser). host is a tile with data-tone, position:relative and isolation:isolate,
// e.g. the empty right column of "How we ship glass" with name "shipping", or a tile in "Visit the counter" with "search".
export function onSight(host, name) {
  if (!host || !FX[name] || host.querySelector(":scope > .fx")) return;
  const run = go => { const layer = el("span", "fx"); layer.setAttribute("aria-hidden", "true"); host.prepend(layer); try { FX[name](layer, go, host); } catch (e) { layer.remove(); } };
  if (RM.matches || !window.IntersectionObserver) return run(false);
  const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); if (host.isConnected) run(true); } }, { threshold: .4 });
  io.observe(host);
}
