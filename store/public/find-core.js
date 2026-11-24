// Section filters, no page code: which facts each section can be filtered by, reading and writing them in the
// address, and counting. Every option is a fact the catalogue holds; an item without the fact never matches it.
// Used by find.js (the page) and tools/test-find.mjs (node).

const low = s => String(s ?? "").toLowerCase();
const F = p => p.facts || {};
const D = p => p.details || {};
export const slug = s => low(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------- facts, read the same way everywhere ----------
export const brandOf = p => F(p).brand || D(p).brand || null;
export const isRoll = p => !!D(p).box_sku || /\bsingle roll\b/i.test(p.name);
export const isCoal = p => !!D(p).charcoal;
export const heatKind = p => p.cat !== "heat" ? null : isCoal(p) ? (isRoll(p) ? "roll" : "box") : /foil/i.test(p.name + " " + (F(p).material || "")) ? "foil" : null;
export function shapeOf(p) {
  if (heatKind(p) !== "box") return null;
  const s = low(F(p).shape || D(p).shape); if (!s) return null;
  if (s.includes("tablet") || s === "hexa") return "tablet";
  if (s.includes("cub")) return "cube";
  return "flat";
}
export const countOf = p => { const c = F(p).count; return Number.isInteger(c) && c > 0 ? c : null; };
export const kgBox = p => !countOf(p) && /\b1 ?kg\b/i.test(p.name);
export function piecesBand(p) { const c = countOf(p); if (c) return c <= 60 ? "60" : c <= 90 ? "90" : "91"; return kgBox(p) ? "kg" : null; }
export function mmOf(p) { const m = String(F(p).size || "").match(/^(?:XL, )?(\d{2})(?: x \d{2})*(?: mm)?$/); return m ? +m[1] : null; }
export function madeOf(p) { const m = low(F(p).material || D(p).material); return m.includes("coco") ? "coconut" : m.includes("bamboo") ? "bamboo" : null; }
export function foilSize(p) { const s = String(F(p).size || ""); return /7 in/.test(s) ? "7in" : /5\.5 in|14 cm/.test(s) ? "55in" : /15 cm/.test(s) ? "15cm" : null; }
export function micOf(p) { const m = String(F(p).size || "").match(/(\d{2}) mic/); return m ? +m[1] : null; }
export const perPiece = p => p.price && countOf(p) ? p.price / countOf(p) : null;
// hookahs from a supplier catalogue: one card per family
const KINDS = { full_size: "full", compact_travel: "small", statement: "show", stem_set: "stem" };
export const kindOf = p => KINDS[F(p).group] || null;
// the same rule as the shop's own "In the shop" tier (picks.js ticked): any tick on the catalogue page, even an unclear one
export const hereOf = p => !F(p).stamp ? null : F(p).stamp !== "none" ? "here" : "order";
export const colourOf = p => p.named && p.colour ? low(p.colour) : null;

// ---------- the groups, per section ----------
// key: address key. multi: OR inside the group. of(p): the item's value (or values). note(list): the honest coverage line.
const cover = (list, f, what) => { const all = list.length, have = list.filter(f).length; return have && have < all ? `${what} on ${have} of ${all} so far.` : ""; };
const HEAT = [
  { key: "type", label: "What you are buying", of: heatKind, opts: [["box", "Boxes"], ["roll", "Single rolls"], ["foil", "Foil"]], quick: true },
  { key: "shape", label: "Shape", hint: "charcoal boxes", of: shapeOf, opts: [["cube", "Cubes"], ["tablet", "Tablets"], ["flat", "Flats"]], drawn: true, quick: true },
  { key: "n", label: "Pieces in the box", of: piecesBand, opts: [["60", "Up to 60"], ["90", "61 to 90"], ["91", "91 or more"], ["kg", "1 kg, count not listed"]] },
  { key: "made", label: "Made from", of: madeOf, opts: [["coconut", "Coconut"], ["bamboo", "Bamboo"]], quick: ["coconut"], note: l => cover(l.filter(p => heatKind(p) === "box"), madeOf, "Listed") },
  { key: "mm", label: "Size", of: p => mmOf(p) && String(mmOf(p)), opts: "dyn", fmt: v => v + " mm", note: l => cover(l.filter(p => heatKind(p) === "box"), mmOf, "Sizes listed") },
  { key: "foil", label: "Foil size", of: foilSize, opts: [["55in", "Standard, 5.5 in"], ["7in", "Large, 7 in"], ["15cm", "Wide, 15 cm"]], note: l => cover(l.filter(p => heatKind(p) === "foil"), foilSize, "Sizes listed") },
  { key: "mic", label: "Foil thickness", of: p => micOf(p) && String(micOf(p)), opts: "dyn", fmt: v => v + " micron" },
  { key: "brand", label: "Brand", of: p => brandOf(p) && slug(brandOf(p)), opts: "dyn", fmt: (v, list) => brandOf(list.find(p => slug(brandOf(p)) === v)) || v, top: 8 },
];
const HOOKAHS = [
  { key: "where", label: "Where it is", of: hereOf, opts: [["here", "In the shop now"], ["order", "We order it in"]], quick: ["here"] },
  { key: "kind", label: "Kind", of: kindOf, opts: [["full", "Full size"], ["small", "Small and travel"], ["show", "Display pieces"], ["stem", "Stem only, no base"]], quick: true },
  { key: "colour", label: "Colour", of: colourOf, opts: "dyn", fmt: v => v[0].toUpperCase() + v.slice(1), family: true, note: l => cover(l, colourOf, "Colours named") },
];
// shisha: the flavour family is read from the flavour's own name, with this word list and nothing else
const FLAVOUR = [["mint", /mint|ice|menthol/], ["sweet", /gummy|vanilla|gum\b|love|cane|pa+n\b|candy|cinnamon/], ["fruit", /apple|berr|peach|fruit|strawberr|guava|pineapple|melon|honeydew|cherry|grape|mango|lemon|orange|passion|tutti|watermelon|margarita/]];
export function flavourOf(p) {
  if (p.cat !== "shisha") return null;
  const f = low(p.colour || D(p).flavour || p.name.replace(/^.*molasses\s*/i, "").replace(/,\s*\d+\s*g$/i, ""));
  return (FLAVOUR.find(([, re]) => re.test(f)) || ["blend"])[0];
}
const SHISHA = [
  { key: "flavour", label: "Flavour", of: flavourOf, opts: [["mint", "Mint and ice"], ["fruit", "Fruit"], ["sweet", "Sweet and candy"], ["blend", "House blends"]], quick: true },
  { key: "brand", label: "Brand", of: p => brandOf(p) && slug(brandOf(p)), opts: "dyn", fmt: (v, list) => brandOf(list.find(p => slug(brandOf(p)) === v)) || v },
];
export const SORTS = { heat: [["", "As on the shelf"], ["price", "Price, low first"], ["piece", "Price per piece"], ["most", "Most pieces"]], hookahs: [["", "As on the shelf"], ["price", "Price, low first"]] };
export const GROUPS = { heat: HEAT, hookahs: HOOKAHS, shisha: SHISHA };
export const DEFAULT_SORTS = [["", "As on the shelf"], ["price", "Price, low first"]];
const MIN_ITEMS = 12;   // a smaller section gets Sort only
const G_CACHE = new WeakMap(), FAM_CACHE = new WeakMap();   // a list is read once: counting runs every option against every item
export function groupsFor(cat, list) {
  let c = G_CACHE.get(list); if (!c) G_CACHE.set(list, c = {});
  return c[cat] ||= (list.length < MIN_ITEMS ? [] : (GROUPS[cat] || [])).filter(g => list.some(p => g.of(p) != null));
}
// a sort that cannot order anything (no prices yet, no piece counts) is not offered
export const sortsFor = (cat, list = []) => (SORTS[cat] || DEFAULT_SORTS).filter(([v]) => !v || !list.length || (v === "price" ? list.some(p => p.price) : list.some(p => countOf(p) && (v === "most" || p.price))));

// ---------- the address ----------
export function readSel(cat, list, search) {
  const q = new URLSearchParams(search), sel = {}, gs = groupsFor(cat, list);
  for (const g of gs) {
    const allowed = new Set(optionsOf(g, list).map(o => o[0]));
    const vals = (q.get(g.key) || "").split(",").map(s => s.trim()).filter(v => allowed.has(v));
    if (vals.length) sel[g.key] = [...new Set(vals)];
  }
  const sort = q.get("sort"); if (sort && sortsFor(cat, list).some(s => s[0] === sort)) sel.sort = sort;
  return sel;
}
export function writeSel(cat, list, sel) {
  const q = new URLSearchParams();
  for (const g of groupsFor(cat, list)) if (sel[g.key]?.length) q.set(g.key, sel[g.key].join(","));
  if (sel.sort) q.set("sort", sel.sort);
  const s = q.toString().replace(/%2C/g, ","); return s ? "?" + s : "";
}
export const activeCount = sel => Object.entries(sel).filter(([k, v]) => k !== "sort" && v.length).reduce((a, [, v]) => a + v.length, 0);

// ---------- options, filtering and counting ----------
export function optionsOf(g, list) {
  if (g.opts !== "dyn") return g.opts;
  const seen = new Map(); for (const p of list) { const v = g.of(p); if (v != null) seen.set(v, (seen.get(v) || 0) + 1); }
  let vals = [...seen.keys()];
  vals = g.key === "mm" || g.key === "mic" ? vals.sort((a, b) => a - b) : vals.sort((a, b) => seen.get(b) - seen.get(a) || String(a).localeCompare(String(b)));
  return vals.map(v => [v, g.fmt ? g.fmt(v, list) : v]);
}
// hookah families: an item stands for its whole family, so a colour filter matches a family that has that colour
function familyMatch(g, p, vals, byFam) { return (byFam.get(p.family) || [p]).some(x => vals.includes(g.of(x))); }
export function matches(cat, list, sel, p, skip, byFam = families(list)) {
  for (const g of groupsFor(cat, list)) {
    if (g.key === skip) continue; const vals = sel[g.key]; if (!vals?.length) continue;
    if (g.family && p.family) { if (!familyMatch(g, p, vals, byFam)) return false; }
    else if (!vals.includes(g.of(p))) return false;
  }
  return true;
}
export function families(list) { if (FAM_CACHE.has(list)) return FAM_CACHE.get(list); const m = new Map(); FAM_CACHE.set(list, m); for (const p of list) if (p.family) { if (!m.has(p.family)) m.set(p.family, []); m.get(p.family).push(p); } return m; }
// the cards a section shows: one per family (its lead, or the colour that was asked for), every stand-alone item
export function cards(list, sel = {}) {
  const fam = families(list), out = [], done = new Set(), want = sel.colour || [];
  for (const p of list) {
    if (!p.family) { out.push(p); continue; }
    if (done.has(p.family)) continue; done.add(p.family);
    const all = fam.get(p.family), pick = want.length && all.find(x => want.includes(colourOf(x)));
    out.push(pick || all.find(x => x.lead) || all[0]);
  }
  return out;
}
const SORTERS = {
  price: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  piece: (a, b) => (perPiece(a) ?? Infinity) - (perPiece(b) ?? Infinity),
  most: (a, b) => (countOf(b) ?? -1) - (countOf(a) ?? -1),
};
const sold = p => p.stock === 0 && p.state !== "tbd" && p.state !== "soon";
export function apply(cat, list, sel) {
  const fam = families(list), hit = list.filter(p => matches(cat, list, sel, p, null, fam));
  let out = cards(hit, sel);
  if (sel.sort && SORTERS[sel.sort]) out = out.map((p, i) => [p, i]).sort((a, b) => SORTERS[sel.sort](a[0], b[0]) || a[1] - b[1]).map(x => x[0]);
  if (sel.sort) out = [...out.filter(p => !sold(p)), ...out.filter(sold)];   // sold pieces go last once someone sorts
  return out;
}
// how many cards each option would give if it were added (the count beside the option)
export function countFor(cat, list, sel, g, v) {
  // the option on its own, with every other group held as it is
  const base = { ...sel, [g.key]: [v] }, fam = families(list);
  return cards(list.filter(p => matches(cat, list, base, p, null, fam)), base).length;
}
// zero results: what each filter alone would give back if it were taken off
export function drops(cat, list, sel) {
  const out = [];
  for (const g of groupsFor(cat, list)) for (const v of sel[g.key] || []) {
    const next = { ...sel, [g.key]: sel[g.key].filter(x => x !== v) };
    out.push({ key: g.key, v, label: labelOf(g, list, v), n: apply(cat, list, next).length });
  }
  return out;
}
export const labelOf = (g, list, v) => (optionsOf(g, list).find(o => o[0] === v) || [v, v])[1];
