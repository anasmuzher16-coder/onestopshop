// Section filters on the page: the filter row, the sheet (phone), the rail (desktop), the coal finder, and the
// address. The rules live in find-core.js; app.js calls findShop() from its section view and init() once.
import { groupsFor, sortsFor, readSel, writeSel, activeCount, optionsOf, countFor, apply, drops, labelOf, heatKind, piecesBand, shapeOf } from "./find-core.js";

let X = null;   // what app.js lends: { PRODUCTS, card, esc, render }
const listOf = cat => X.PRODUCTS.filter(p => p.cat === cat);
const here = () => { const m = location.pathname.match(/^\/shop\/([a-z0-9-]+)\/?$/); return m ? m[1] : null; };

// ---------- drawn marks: the same 2px ink line as the section objects ----------
const SVG = (d, vb = "0 0 48 40") => `<svg class="shape" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
export const DRAWN = {
  cube: SVG(`<path d="M24 4l16 8-16 8-16-8z" fill="#3a302a"/><path d="M8 12l16 8v16L8 28z" fill="#1d1714"/><path d="M40 12L24 20v16l16-8z" fill="#2a221d"/><path d="M14 22l3 1.5M30 27l3-1.5" stroke="#f26a3d" stroke-width="2.4"/><path d="M24 4l16 8v16l-16 8-16-8V12z"/>`),
  tablet: SVG(`<path d="M7 16v7c0 4 8 7 17 7s17-3 17-7v-7" fill="#1d1714"/><ellipse cx="24" cy="16" rx="17" ry="7" fill="#3a302a"/><ellipse cx="24" cy="16" rx="5" ry="2" fill="#f26a3d" stroke="none"/><path d="M7 16v7c0 4 8 7 17 7s17-3 17-7v-7"/>`),
  flat: SVG(`<path d="M6 18l22-8 14 6-22 8z" fill="#3a302a"/><path d="M6 18v6l14 6v-6z" fill="#1d1714"/><path d="M20 24l22-8v6l-22 8z" fill="#2a221d"/><path d="M6 18v6l14 6 22-8v-6M20 24v6"/>`),
  roll: SVG(`<rect x="6" y="13" width="36" height="14" rx="7" fill="#e9e2d6"/><path d="M6 20h36v0a7 7 0 0 1-7 7H13a7 7 0 0 1-7-7z" fill="#c9bfb0" stroke="none"/><path d="M14 13v14M20 13v14M26 13v14M32 13v14" stroke-width="1.4"/><rect x="6" y="13" width="36" height="14" rx="7"/>`),
};
const TICK = `<svg class="frow__tick" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>`;
const XMARK = `<svg class="qchip__x" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;
const SLIDERS = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2 4h7M13 4h1M2 12h1M7 12h7"/><circle cx="11" cy="4" r="2"/><circle cx="5" cy="12" r="2"/></svg>`;
const CLOSE = `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>`;
const ARROW = `<svg class="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 3l5 5-5 5"/></svg>`;

const noun = (cat, n) => cat === "heat" || cat === "charcoal" ? (n === 1 ? "item" : "items") : cat === "hookahs" ? (n === 1 ? "hookah" : "hookahs") : cat === "shisha" ? (n === 1 ? "flavour" : "flavours") : (n === 1 ? "piece" : "pieces");
const addr = (cat, list, sel) => `/shop/${cat}${writeSel(cat, list, sel)}`;
const toggle = (sel, key, v) => { const cur = sel[key] || [], next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]; const s = { ...sel }; if (next.length) s[key] = next; else delete s[key]; return s; };

// ---------- the pieces of the section page ----------
// the filters that are on, as chips with an x (the desktop overview above the grid)
function appliedChips(cat, list, sel) { return quickChips(cat, list, sel, true); }
function quickChips(cat, list, sel, onlyOn = false) {
  const gs = groupsFor(cat, list), on = [], off = [];
  for (const g of gs) for (const v of sel[g.key] || []) on.push(`<button class="qchip" type="button" aria-pressed="true" data-f-toggle="${g.key}" data-v="${X.esc(v)}" aria-label="Remove ${X.esc(labelOf(g, list, v))}">${X.esc(labelOf(g, list, v))}${XMARK}</button>`);
  if (onlyOn) return on.join("");
  for (const g of gs) if (g.quick) for (const [v, label] of optionsOf(g, list)) {
    if (Array.isArray(g.quick) && !g.quick.includes(v)) continue;
    if ((sel[g.key] || []).includes(v) || off.length >= 6) continue;
    const n = countFor(cat, list, sel, g, v); if (!n) continue;
    off.push(`<button class="qchip" type="button" aria-pressed="false" data-f-toggle="${g.key}" data-v="${X.esc(v)}">${X.esc(label)} <span class="num">${n}</span></button>`);
  }
  return on.join("") + off.join("");
}
function groupHTML(cat, list, sel, g) {
  const opts = optionsOf(g, list), top = g.top || (g.key === "mm" ? 4 : 0), many = top && opts.length > top + 1 && !open.has(g.key);
  const row = ([v, label], i) => {
    const on = (sel[g.key] || []).includes(v), n = countFor(cat, list, sel, g, v);
    if (g.drawn) return `<button class="fshape" type="button" role="checkbox" aria-checked="${on}" ${!n && !on ? 'aria-disabled="true"' : ""} data-f-toggle="${g.key}" data-v="${X.esc(v)}">${DRAWN[v] || ""}<span>${X.esc(label)}</span><span class="num">${n}</span>${TICK}</button>`;
    return `<button class="frow" type="button" role="checkbox" aria-checked="${on}" ${!n && !on ? 'aria-disabled="true"' : ""} data-f-toggle="${g.key}" data-v="${X.esc(v)}" ${many && i >= top && !on ? "data-more hidden" : ""}><span class="frow__box">${TICK}</span><span class="frow__l">${X.esc(label)}</span><span class="num">${n}</span></button>`;
  };
  const note = g.note ? g.note(list) : "";
  return `<fieldset class="fgroup"><legend class="fgroup__h">${g.label}${g.hint ? ` <small>${g.hint}</small>` : ""}</legend>
    <div class="${g.drawn ? "fshapes" : "frows"}">${opts.map(row).join("")}</div>
    ${many ? `<button class="fmore" type="button" data-f-more="${g.key}">All ${opts.length} ${g.key === "brand" ? "brands" : "sizes"}</button>` : ""}${note ? `<p class="fnote">${note}</p>` : ""}</fieldset>`;
}
function groupsHTML(cat, list, sel, sortLast = false) {
  const sorts = sortsFor(cat, list);
  const sort = (sorts.length < 2 ? "" : `<fieldset class="fgroup"><legend class="fgroup__h">Sort</legend><div class="frows" role="radiogroup" aria-label="Sort">${sorts.map(([v, label]) => `<button class="frow frow--radio" type="button" role="radio" aria-checked="${(sel.sort || "") === v}" data-f-sort="${v}"><span class="frow__box"></span><span class="frow__l">${label}</span></button>`).join("")}</div></fieldset>`);
  const groups = groupsFor(cat, list).map(g => groupHTML(cat, list, sel, g)).join("");
  return sortLast ? groups + sort : sort + groups;   // the sheet leads with the filters, so what is already set shows first
}
function finderLink(cat) {
  return cat === "charcoal" ? `<button class="finderlink" type="button" data-f-finder aria-haspopup="dialog">${DRAWN.cube}<span>What coal do I need?<small>Two questions, then the right boxes</small></span>${ARROW}</button>` : "";
}
function emptyHTML(cat, list, sel) {
  const back = drops(cat, list, sel).filter(d => d.n > 0).sort((a, b) => b.n - a.n);
  const names = Object.entries(sel).filter(([k]) => k !== "sort").flatMap(([k, vs]) => vs.map(v => labelOf(groupsFor(cat, list).find(g => g.key === k), list, v)));
  return `<section class="fempty" aria-live="polite"><h2 class="fempty__h">No match for ${X.esc(names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.at(-1) : names[0])}.</h2>
    <p class="fempty__p">${back.length ? "Take one off and there is something to see." : "Clear the filters to see the whole section."}</p>
    <ul class="drops">${back.map(d => `<li><a href="${addr(cat, list, { ...sel, [d.key]: sel[d.key].filter(x => x !== d.v) })}" data-f-go>Without “${X.esc(d.label)}”<span class="num">${d.n} ${noun(cat, d.n)}</span></a></li>`).join("")}
    <li><a href="/shop/${cat}" data-f-go>Clear all filters<span class="num">${apply(cat, list, {}).length} ${noun(cat, apply(cat, list, {}).length)}</span></a></li></ul></section>`;
}
const gridHTML = (cat, list, sel) => { const out = apply(cat, list, sel); return out.length ? `<div class="grid grid--shop">${out.map((p, i) => X.card(p, i)).join("")}</div>` : emptyHTML(cat, list, sel); };
function resultsHTML(cat, list, sel) {
  const n = apply(cat, list, sel).length, k = activeCount(sel);
  return `<div class="fres"><p class="fres__n" role="status"><b class="num">${n}</b>${noun(cat, n)}</p>${k || sel.sort ? `<a class="link" href="/shop/${cat}" data-f-go>Clear all</a>` : ""}</div>`;
}

// What the section view shows. Returns null when the section has nothing to filter by (it keeps its own grid).
export function findShop(cat, list = listOf(cat)) {
  const gs = groupsFor(cat, list); if (!gs.length) return null;
  const sel = readSel(cat, list, location.search), on = activeCount(sel) > 0 || !!sel.sort, k = activeCount(sel);
  const bar = `<div class="fbar" data-fbar><button class="fbar__btn" type="button" data-f-open aria-haspopup="dialog">${SLIDERS}Filter${k ? ` <span class="fbar__n num">${k}</span>` : ""}</button><div class="qchips" role="group" aria-label="Quick filters">${quickChips(cat, list, sel)}</div></div>`;
  return {
    on,
    // phone: the row, the count, the grid. desktop: the rail beside them. The grid is only replaced when something is set.
    html: grid => `${bar}<div class="fwrap" data-fwrap="${cat}"><aside class="frail" aria-label="Filter ${X.esc(cat)}">${X.defer ? X.defer(() => groupsHTML(cat, list, sel)) : groupsHTML(cat, list, sel)}</aside><div class="fmain">${resultsHTML(cat, list, sel)}${k ? `<div class="fapplied" role="group" aria-label="Filters on">${appliedChips(cat, list, sel)}</div>` : ""}${k ? "" : finderLink(cat)}<div data-fgrid>${on ? gridHTML(cat, list, sel) : typeof grid === "function" ? grid() : grid}</div></div></div>`,   // the plain grid is only built when it is shown
  };
}

// ---------- the sheet (phone) ----------
function shut() {
  if (!sheet?.open || sheet.classList.contains("is-leaving")) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return sheet.close();
  sheet.classList.add("is-leaving");
  setTimeout(() => { sheet.classList.remove("is-leaving"); if (sheet.open) sheet.close(); }, 160);
}
let sheet = null, draft = null;
const open = new Set();   // long groups ("All 39 brands") the shopper has opened stay open while they pick
function sheetEl() {
  if (sheet) return sheet;
  sheet = document.createElement("dialog"); sheet.className = "fsheet"; sheet.setAttribute("aria-labelledby", "fsheet-h");
  document.body.append(sheet);
  sheet.addEventListener("click", e => { if (e.target === sheet) shut(); });   // a tap on the dimmed page closes it
  sheet.addEventListener("cancel", e => { e.preventDefault(); shut(); });   // Esc leaves the same way
  // a drag down on the handle or the header closes it, as a sheet does
  let y0 = null;
  sheet.addEventListener("pointerdown", e => { if (e.target.closest(".fsheet__head") && !e.target.closest("button")) { y0 = e.clientY; sheet.setPointerCapture?.(e.pointerId); } });
  sheet.addEventListener("pointermove", e => { if (y0 == null) return; const dy = Math.max(0, e.clientY - y0); sheet.style.transform = dy ? `translateY(${dy}px)` : ""; });
  const end = e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; sheet.style.transform = ""; if (dy > 72) shut(); };
  sheet.addEventListener("pointerup", end); sheet.addEventListener("pointercancel", end);
  sheet.addEventListener("close", () => { draft = null; document.documentElement.classList.remove("fsheet-open"); });
  return sheet;
}
function drawSheet(cat) {
  const list = listOf(cat), n = apply(cat, list, draft).length, s = sheetEl(), y = s.querySelector(".fsheet__body")?.scrollTop || 0;
  s.innerHTML = `<div class="fsheet__head"><span class="fsheet__grip" aria-hidden="true"></span><h2 class="fsheet__h" id="fsheet-h" tabindex="-1">Filter</h2><button class="fsheet__x" type="button" data-f-close aria-label="Close">${CLOSE}</button></div>
    <div class="fsheet__body">${groupsHTML(cat, list, draft, true)}</div>
    <div class="fsheet__foot"><button class="link" type="button" data-f-clear>Clear all</button><button class="btn" type="button" data-f-apply ${n ? "" : "disabled"}>${n ? `Show ${n} ${noun(cat, n)}` : "Nothing matches"}</button></div>`;
  s.querySelector(".fsheet__body").scrollTop = y;
}
function openSheet(cat) {
  draft = readSel(cat, listOf(cat), location.search); drawSheet(cat);
  const s = sheetEl(); s.dataset.cat = cat; document.documentElement.classList.add("fsheet-open"); s.showModal();
  s.querySelector("#fsheet-h").focus();
}

// ---------- the coal finder: two questions that set ordinary filters ----------
const Q1 = [["roll", "One session", "A single roll"], ["90", "A regular box", "61 to 90 pieces"], ["91", "A big box", "91 pieces or more, or 1 kg"]];
const Q2 = [["cube", "Cubes", "Burn the longest. Light them on a stove or coal burner."], ["tablet", "Tablets", "Round discs. Quick-light ones say so on the box."], ["flat", "Flats and fingers", "Flat, half moon and stick shapes."]];
function finderHTML(step, n1) {
  const list = listOf("charcoal"), boxes = list.filter(p => heatKind(p) === "box");
  const bandOK = p => n1 === "91" ? ["91", "kg"].includes(piecesBand(p)) : piecesBand(p) === n1;
  const opts = step === 1
    ? Q1.map(([v, h, sub]) => { const c = v === "roll" ? list.filter(p => heatKind(p) === "roll").length : boxes.filter(p => v === "91" ? ["91", "kg"].includes(piecesBand(p)) : piecesBand(p) === v).length; return c ? `<button class="gf__opt" type="button" data-gf1="${v}">${v === "roll" ? DRAWN.roll : DRAWN.cube}<span><span class="gf__name">${h}</span><span class="gf__sub">${sub}</span></span><span class="num">${c}</span></button>` : ""; })
    : Q2.map(([v, h, sub]) => { const c = boxes.filter(p => bandOK(p) && shapeOf(p) === v).length; return c ? `<button class="gf__opt" type="button" data-gf2="${v}">${DRAWN[v]}<span><span class="gf__name">${h}</span><span class="gf__sub">${sub}</span></span><span class="num">${c}</span></button>` : ""; });
  return `<div class="fsheet__head"><span class="fsheet__grip" aria-hidden="true"></span><p class="gf__step">Question ${step} of 2</p><button class="fsheet__x" type="button" data-f-close aria-label="Close">${CLOSE}</button></div>
    <div class="fsheet__body"><h2 class="gf__q" id="fsheet-h">${step === 1 ? "How much do you need?" : "Which shape?"}</h2>
    ${step === 2 ? `<p class="gf__picked">For <b>${Q1.find(q => q[0] === n1)[1].toLowerCase()}</b> <button class="link" type="button" data-gf-back>Change</button></p>` : ""}
    <div class="gf__opts">${opts.join("")}</div>
    <button class="link gf__skip" type="button" data-gf-common>Not sure? Show every box</button></div>`;
}
let n1 = null;
function openFinder(step = 1) {
  const s = sheetEl(); s.dataset.cat = "charcoal"; s.innerHTML = finderHTML(step, n1);
  if (!s.open) { document.documentElement.classList.add("fsheet-open"); s.showModal(); }
  (s.querySelector(".gf__opt") || s.querySelector("[data-f-close]")).focus();
}

// ---------- moving between states ----------
// filter changes replace the address and redraw in place: the router only redraws when the path changes
function go(cat, sel) { history.replaceState(history.state, "", addr(cat, listOf(cat), sel)); redraw(cat); }
// redraw only the filter row, the rail and the grid: the section band and its animation stay where they are
function redraw(cat) {
  const wrap = document.querySelector(`[data-fwrap="${cat}"]`), bar = document.querySelector("[data-fbar]");
  if (!wrap || !bar) return X.render();
  const f = findShop(cat); if (!f) return X.render();
  const tmp = document.createElement("div"); tmp.innerHTML = f.html(() => X.grid(cat));
  const focusKey = document.activeElement?.closest?.("[data-f-toggle],[data-f-sort]");
  const key = focusKey && (focusKey.dataset.fToggle ? `[data-f-toggle="${focusKey.dataset.fToggle}"][data-v="${CSS.escape(focusKey.dataset.v)}"]` : `[data-f-sort="${focusKey.dataset.fSort}"]`);
  const inRail = !!focusKey?.closest(".frail"), group = focusKey?.closest(".fgroup")?.querySelector("[data-f-toggle],[data-f-sort]"), railY = wrap.querySelector(".frail")?.scrollTop || 0;
  bar.replaceWith(tmp.querySelector("[data-fbar]")); wrap.replaceWith(tmp.querySelector("[data-fwrap]"));
  const rail = document.querySelector(".frail"); if (rail) rail.scrollTop = railY;   // the rail keeps its place
  if (key) {   // focus stays on the control that was used, or the first one left in its group
    const el = document.querySelector((inRail ? ".frail " : "[data-fbar] ") + key + ":not([hidden])") || (inRail && group && document.querySelector(`.frail [data-f-toggle="${group.dataset.fToggle}"]`)) || document.querySelector(inRail ? ".frail [data-f-toggle]" : "[data-fbar] .fbar__btn");
    el?.focus({ preventScroll: true });
  }
}

export function init(ctx) {
  X = ctx;
  document.addEventListener("click", e => {
    const t = e.target.closest?.("[data-f-open],[data-f-toggle],[data-f-sort],[data-f-apply],[data-f-clear],[data-f-close],[data-f-more],[data-f-finder],[data-gf1],[data-gf2],[data-gf-back],[data-gf-common]");
    if (!t || t.getAttribute("aria-disabled") === "true") return;
    const inSheet = !!t.closest(".fsheet"), cat = inSheet ? sheet.dataset.cat : here();
    if (!cat) return;
    const list = listOf(cat);
    if (t.matches("[data-f-open]")) return openSheet(cat);
    if (t.matches("[data-f-close]")) return shut();
    if (t.matches("[data-f-more]")) { const grp = t.closest(".fgroup"), more = [...grp.querySelectorAll("[data-more]")]; more.forEach(b => b.hidden = false); open.add(t.dataset.fMore); more[0]?.focus(); t.remove(); return; }
    if (t.matches("[data-f-finder]")) { e.preventDefault(); n1 = null; return openFinder(1); }
    if (t.matches("[data-gf1]")) { n1 = t.dataset.gf1; if (n1 === "roll") { shut(); return go("charcoal", { type: ["roll"] }); } return openFinder(2); }
    if (t.matches("[data-gf-back]")) return openFinder(1);
    if (t.matches("[data-gf2]")) { const sel = { type: ["box"], n: n1 === "91" ? ["91", "kg"] : [n1], shape: [t.dataset.gf2] }; shut(); return go("charcoal", sel); }
    if (t.matches("[data-gf-common]")) { shut(); return go("charcoal", { type: ["box"] }); }
    if (inSheet && draft) {   // the sheet works on a draft; "Show N" applies it
      if (t.matches("[data-f-toggle]")) draft = toggle(draft, t.dataset.fToggle, t.dataset.v);
      else if (t.matches("[data-f-sort]")) { draft = { ...draft }; if (t.dataset.fSort) draft.sort = t.dataset.fSort; else delete draft.sort; }
      else if (t.matches("[data-f-clear]")) draft = {};
      else if (t.matches("[data-f-apply]")) { const sel = draft; shut(); go(cat, sel); document.querySelector("[data-fbar] .fbar__btn")?.focus({ preventScroll: true }); return; }
      const key = t.dataset.fToggle ? `[data-f-toggle="${t.dataset.fToggle}"][data-v="${CSS.escape(t.dataset.v)}"]` : t.dataset.fSort !== undefined ? `[data-f-sort="${t.dataset.fSort}"]` : "[data-f-clear]";
      drawSheet(cat); sheet.querySelector(key)?.focus({ preventScroll: true }); return;
    }
    // the row and the desktop rail apply at once
    const sel = readSel(cat, list, location.search);
    if (t.matches("[data-f-toggle]")) go(cat, toggle(sel, t.dataset.fToggle, t.dataset.v));
    else if (t.matches("[data-f-sort]")) { const s = { ...sel }; if (t.dataset.fSort) s.sort = t.dataset.fSort; else delete s.sort; go(cat, s); }
  });
  // Clear all and the empty state's links stay on the page: no wave, no scroll to the top
  document.addEventListener("click", e => {
    const a = e.target.closest?.("a[data-f-go]"); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const cat = here(); if (!cat) return;
    e.preventDefault(); e.stopPropagation(); history.replaceState(history.state, "", a.getAttribute("href")); redraw(cat);
  }, true);
  addEventListener("routechange", () => { if (sheet?.open) sheet.close(); open.clear(); });
}
// a link to /shop/charcoal?find=coal opens the finder once the page is drawn
export function afterRender() {
  if (here() === "charcoal" && new URLSearchParams(location.search).get("find") === "coal") {
    history.replaceState(history.state, "", "/shop/charcoal" + location.search.replace(/[?&]find=coal/, "").replace(/^&/, "?"));
    n1 = null; openFinder(1);
  }
}
