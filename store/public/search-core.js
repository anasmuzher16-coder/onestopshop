// Search, no page code: shop words, synonyms, typo tolerance, grouping by section, "Jump to" rows, and what to
// say when nothing matches. Used by search.js (the page) and tools/test-find.mjs (node).
import { groupsFor, labelOf, apply, cards, writeSel, heatKind, shapeOf, madeOf, kindOf, colourOf, flavourOf, brandOf, slug } from "./find-core.js";

export const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ")
  .replace(/(\d)(mm|cm|g|kg|in|mic)\b/g, "$1 $2").replace(/['’]/g, "").replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
const stem = w => w.length > 3 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("es") && /(sh|ch|x|ss)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
const toks = s => norm(s).split(" ").filter(Boolean).map(stem);

// Each line is one set: any word finds what the others find. Phrases are matched before single words.
export const SYNONYMS = `hookah, hooka, hookha, huka, hukka, shisha pipe, nargile, nargileh, narghile, narguile, argileh, argila, arghileh, hubbly, hubbly bubbly, waterpipe, water pipe
shisha, sheesha, shesha, molasses, flavour, flavor, tobacco free, herbal, muassel, moassel, maassel
charcoal, coal, coals, coalz, char, briquette, coconut coal, hookah coal
coconut, coco, coconut shell, natural
quick light, quicklight, quick lite, instant light, self light, self lighting, easy light
cube, cubes, cubic, cubette, square
tablet, tablets, disc, disk, round, puck
flat, flats, finger, fingers, stick, sticks, half moon, hexagon
foil, aluminium, aluminum, tin foil, screen
bowl, head, clay bowl, phunnel, funnel
hose, tube, mouthpiece, tip
base, vase, glass
heat management, hmd, kaloud, lotus
grommet, gasket, seal, rubber
stem, shaft
tong, tongs, clip
cologne, perfume, fragrance, scent, smell, oud, attar
mint, minty, menthol, fresh
fruit, fruity, berry, berries
sweet, candy, dessert, gummy
gift, present, birthday, for him, for her
starter, starting, beginner, first hookah, kit, set, bundle, complete
small, mini, travel, portable, car, compact
big, tall, large, full size
in store, in shop, today, near me, pickup today`.split("\n").map(l => l.split(",").map(s => norm(s).split(" ").map(stem).join(" ")).filter(Boolean));
const SYN = new Map(); for (const set of SYNONYMS) for (const w of set) SYN.set(w, set);
const PHRASES = [...SYN.keys()].filter(w => w.includes(" ")).sort((a, b) => b.split(" ").length - a.split(" ").length);

// Words that are about the shop, not a product: answered with the page.
// Card payment off (the meta tag the Worker writes): orders are pickup only, so delivery and shipping are said to be coming.
 const PICKUP_ONLY = typeof document !== "undefined" && document.querySelector('meta[name="oss-pay"]')?.content !== "card";
export const PAGES = [
  { words: ["hour", "open", "close", "closing", "when"], label: "Opening hours", sub: "Mon to Sat 10 to 9, Sun 11 to 7", href: "/#visit-h" },
  { words: ["address", "where", "direction", "location", "map", "visit"], label: "Visit the counter", sub: "760 Wyandotte St E, Windsor", href: "/#visit-h" },
  { words: ["delivery", "deliver", "local", "driver"], label: PICKUP_ONLY ? "Local delivery, coming" : "Local delivery", sub: PICKUP_ONLY ? "Opens once we take card payment online. Pickup is free" : "From $10 near Windsor", href: "/shipping" },
  { words: ["pickup", "pick", "collect"], label: "Pickup", sub: PICKUP_ONLY ? "Free at the counter, usually the same or the next day" : "Free at the counter, same day", href: "/shipping" },
  { words: ["ship", "shipping", "post", "canada post", "mail"], label: PICKUP_ONLY ? "Shipping, coming" : "Shipping across Canada", sub: PICKUP_ONLY ? "Opens once we take card payment online. Pickup is free" : "Everywhere but Quebec for now. How we pack and what it costs", href: "/shipping" },
  { words: ["return", "refund", "exchange", "broken"], label: "Returns and broken items", sub: "Shipping and returns", href: "/shipping" },
  { words: ["term", "condition"], label: "Terms of sale", sub: "", href: "/terms" },
  { words: ["privacy"], label: "Privacy", sub: "", href: "/privacy" },
  { words: ["phone", "call", "number", "contact"], label: "Call the counter", sub: "519-255-2222", href: "tel:+15192552222" },
];
const PAGE_WORD = new Map(); for (const pg of PAGES) for (const w of pg.words) PAGE_WORD.set(stem(norm(w)), pg);

// Damerau (optimal string alignment) distance, stopping early past max
export function dist(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) { let low = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      low = Math.min(low, d[i][j]);
    }
    if (low > max) return max + 1;
  }
  return d[a.length][b.length];
}
const allowed = w => w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;

// words each item answers to, by weight: 3 name and brand, 2 section and facet words, 1 note
const FACET_WORDS = p => [heatKind(p) === "foil" ? "foil" : heatKind(p) ? "charcoal" : "", heatKind(p) === "roll" ? "single roll" : "",
  shapeOf(p) || "", madeOf(p) || "", kindOf(p) === "small" ? "small compact travel" : kindOf(p) === "stem" ? "stem set" : kindOf(p) === "full" ? "full size" : kindOf(p) === "show" ? "display statement piece" : "",
  colourOf(p) || "", flavourOf(p) || "", p.details?.tags || ""].join(" ");
export function buildIndex(PRODUCTS, CATEGORIES) {
  const catName = Object.fromEntries(CATEGORIES.map(c => [c.id, c.name]));
  const docs = PRODUCTS.map(p => ({ p, w3: new Set(toks(p.name + " " + (brandOf(p) || ""))), w2: new Set(toks(catName[p.cat] + " " + FACET_WORDS(p))), w1: new Set(toks(p.note + " " + p.sku + " " + (p.colour || ""))) }));
  const freq = new Map(); for (const d of docs) for (const s of [d.w3, d.w2, d.w1]) for (const w of s) freq.set(w, (freq.get(w) || 0) + 1);
  for (const w of SYN.keys()) for (const t of w.split(" ")) if (!freq.has(t)) freq.set(t, 0);
  return { docs, vocab: [...freq.keys()], freq, PRODUCTS, CATEGORIES, catName };
}

// The query as the shop understands it: phrases joined, typos fixed against the shop's own words, synonyms expanded.
export function understand(ix, q) {
  let words = toks(q); const fixed = [], terms = [], pages = new Set();
  for (let i = 0; i < words.length; i++) {
    let hit = null;
    for (const ph of PHRASES) { const n = ph.split(" ").length; if (words.slice(i, i + n).join(" ") === ph) { hit = ph; i += n - 1; break; } }
    let w = hit || words[i]; const last = !hit && i === words.length - 1;
    if (!hit && !ix.freq.has(w) && !SYN.has(w) && !PAGE_WORD.has(w) && !(last && w.length >= 2 && ix.vocab.some(v => v.startsWith(w) && ix.freq.get(v)))) {
      const max = allowed(w); let best = null, bd = max + 1;
      if (max) for (const v of ix.vocab) { if (v.length < 3) continue; const d = dist(w, v, max); if (d < bd || (d === bd && best && (ix.freq.get(v) || 0) > (ix.freq.get(best) || 0))) { bd = d; best = v; } }
      if (best) { fixed.push([w, best]); w = best; }
    }
    if (PAGE_WORD.has(w)) pages.add(PAGE_WORD.get(w));
    // quick-light is not marked on the boxes yet: it finds the round tablets, and the page says so
    const quick = SYN.get(w) === SYN.get("quick light");
    terms.push({ w, last, typed: hit ? null : words[i], quick, alts: quick ? ["tablet"] : SYN.get(w) || [w] });
  }
  return { terms, fixed, pages: [...pages] };
}
function termScore(d, t) {
  let best = 0;
  for (const alt of t.alts) {
    const parts = alt.split(" ");
    for (const [set, wt] of [[d.w3, 3], [d.w2, 2], [d.w1, 1]]) {
      if (parts.every(x => set.has(x))) best = Math.max(best, wt);
      else if (t.last && alt === t.w && alt.length >= 2 && [...set].some(x => x.startsWith(alt))) best = Math.max(best, wt - 0.5);   // as you type: the word typed, never its synonyms
    }
  }
  return best;
}
export function search(ix, q, { terms } = understand(ix, q)) {
  const product = terms.filter(t => !PAGE_WORD.has(t.w));
  if (!product.length) return [];
  const out = [];
  for (const d of ix.docs) { let s = 0, ok = true; for (const t of product) { const v = termScore(d, t); if (!v) { ok = false; break; } s += v; } if (ok) out.push([d.p, s]); }
  out.sort((a, b) => b[1] - a[1]);
  return cards(out.map(x => x[0]));
}
// results grouped by section, sections in shop order, the best match leading
export function grouped(ix, hits) {
  const by = new Map(); for (const p of hits) { if (!by.has(p.cat)) by.set(p.cat, []); by.get(p.cat).push(p); }
  return ix.CATEGORIES.filter(c => by.has(c.id)).map(c => ({ cat: c, items: by.get(c.id) }));
}
// "Jump to": a section with filters already set, when the words name facts that section filters by
export function jumps(ix, q, { terms } = understand(ix, q)) {
  const out = [];
  for (const c of ix.CATEGORIES) {
    const list = ix.PRODUCTS.filter(p => p.cat === c.id), sel = {}, named = [];
    const unit = i => terms[i + 1]?.w;
    for (const g of groupsFor(c.id, list)) {
      terms.forEach((t, i) => { for (const alt of t.alts) {
        let v = null;
        if (/^\d+$/.test(alt)) { if ((g.key === "mm" && unit(i) === "mm") || (g.key === "mic" && /^mic/.test(unit(i) || ""))) v = alt; }
        else if (g.key === "brand") { const b = [...new Set(list.map(brandOf).filter(Boolean))], one = b.filter(x => slug(x) === slug(alt) || (alt === t.w && !SYN.has(alt) && alt.length >= 4 && toks(x).includes(alt))); if (one.length === 1) v = slug(one[0]); }
        else if (g.opts === "dyn") { if (list.some(p => g.of(p) === alt)) v = alt; }
        else { const o = g.opts.find(o => o[0] === alt || toks(o[1]).join(" ") === alt || (toks(o[1]).length <= 2 && toks(o[1]).includes(alt)) || (o[2] || []).includes(alt)); if (o) v = o[0]; }
        if (v != null && list.some(p => g.of(p) === v) && !(sel[g.key] || []).includes(v)) { (sel[g.key] ||= []).push(v); named.push(labelOf(g, list, v)); }
      } });
    }
    if (!named.length) { const w = SECTION_WORDS[c.id]; if (w && terms.some(t => t.alts.some(x => w.includes(x))) && list.length) out.push({ cat: c, label: "All " + c.name.toLowerCase(), n: cards(list).length, href: `/shop/${c.id}`, whole: true }); continue; }
    const n = apply(c.id, list, sel).length; if (!n) continue;
    out.push({ cat: c, label: named.reverse().map((x, i) => i ? x.toLowerCase() : x).join(" "), n, href: `/shop/${c.id}${writeSel(c.id, list, sel)}`, quick: terms.some(t => t.quick) });
  }
  return out.sort((a, b) => (a.whole || 0) - (b.whole || 0) || b.label.split(" ").length - a.label.split(" ").length || b.n - a.n).slice(0, 3);
}
// a word that names a whole section opens it
const SECTION_WORDS = { hookahs: ["hookah"], bases: ["base"], bowls: ["bowl"], charcoal: ["charcoal"], heat: ["foil", "heat management"], hoses: ["hose"], parts: ["part", "brush", "cleaner"], cologne: ["cologne"], misc: ["misc"] };
// a word that names a section with nothing in it yet (its stock is on the way): the page says so and links the section
export function arriving(ix, q, { terms } = understand(ix, q)) {
  // the words as typed count too (singular), before any typo fix: "parts" must not become "pari", nor "misc" "mic"
  const raw = String(q || "").toLowerCase().split(/[^a-z]+/).filter(Boolean).map(w => w.replace(/s$/, ""));
  return ix.CATEGORIES.filter(c => { const w = SECTION_WORDS[c.id]; return w && !ix.PRODUCTS.some(p => p.cat === c.id) && (raw.some(x => w.includes(x)) || terms.some(t => t.alts.some(x => w.includes(x)))); });
}
// nothing matched: each word on its own, then the closest shop word
export function nearest(ix, q) {
  const u = understand(ix, q), words = u.terms.map(t => t.w), alone = [];
  if (words.length > 1) for (let i = 0; i < words.length; i++) {
    const w = words[i], hits = search(ix, w); if (hits.length) alone.push({ word: w, hits: hits.slice(0, 3), n: hits.length, jumps: jumps(ix, w) });
  }
  let mean = null;
  if (!alone.length && !u.pages.length) for (const t of u.terms) { const max = allowed(t.w) + 1; let best = null, bd = max + 1; for (const v of ix.vocab) { if (!ix.freq.get(v) || v.length < 3 || v[0] !== t.w[0]) continue; const d = dist(t.w, v, max); if (d < bd) { bd = d; best = v; } } if (best && best !== t.w) { mean = best; break; } }
  return { alone, mean };
}
export function popularBrands(PRODUCTS, n = 8) {
  const c = new Map(); for (const p of PRODUCTS) { const b = brandOf(p); if (b && p.state !== "tbd") c.set(b, (c.get(b) || 0) + 1); }
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(x => x[0]);
}
