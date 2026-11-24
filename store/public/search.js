// The search page: ways in before typing, results grouped by section while typing, and a way forward when nothing
// matches. The matching lives in search-core.js; app.js calls searchPage() and searchOut().
import { buildIndex, understand, search, grouped, jumps, nearest, popularBrands } from "./search-core.js";
import { heatKind } from "./find-core.js";
import { DRAWN } from "./find.js";

let X = null, IX = null;   // X: what app.js lends ({ PRODUCTS, CATEGORIES, esc, shot, sticker })
export function init(ctx) {
  X = ctx; IX = buildIndex(ctx.PRODUCTS, ctx.CATEGORIES);
  // Enter or the phone's Search key: the results are already on screen, so it only puts the keyboard away
  document.addEventListener("submit", e => { if (!e.target.matches?.("[data-search-form]")) return; e.preventDefault(); e.target.querySelector("input")?.blur(); });
  // a link from the search page to another search (a brand, "See all", "Did you mean") swaps the results in place:
  // the router only redraws when the path changes, and typing already keeps one history entry per search
  document.addEventListener("click", e => {
    const a = e.target.closest?.('a[href^="/search?"]'); if (!a || location.pathname !== "/search" || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); e.stopPropagation();
    const u = new URL(a.href), q = u.searchParams.get("q") || "", inCat = u.searchParams.get("in");
    history.replaceState(history.state, "", u.pathname + u.search);
    const box = document.getElementById("q"), out = document.querySelector("[data-search-out]");
    if (box) box.value = q; ctx.setQ?.(q);
    if (out) { out.innerHTML = inCat && q ? searchAll(q, inCat) : searchOut(q); scrollTo(0, 0); }
  }, true);
}

const S = (d, vb = "0 0 48 40") => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  set: S(`<path d="M19 3h10l-2 6h-6z"/><path d="M15 11h18M24 11v14"/><path d="M18 26h12c4 3 5 6 5 8a11 4 0 0 1-22 0c0-2 1-5 5-8z"/><path d="M27 20c6 0 9 3 9 8"/>`),
  coal: DRAWN.cube.replace('class="shape" ', ""),
  foil: DRAWN.flat.replace('class="shape" ', ""),
  gift: S(`<path d="M8 16h32v20H8zM6 10h36v6H6zM24 10v26"/><path d="M24 10c-4-6-12-6-10 0M24 10c4-6 12-6 10 0"/>`),
  part: S(`<path d="M10 30c8 0 8-10 16-10s8-8 14-8"/><circle cx="10" cy="30" r="3"/><path d="M36 8l6 6"/>`),
  scent: S(`<path d="M18 14h12v4l4 4v14H14V22l4-4z"/><path d="M20 8h8v6h-8z"/>`),
  jar: S(`<path d="M12 12h24v4H12z"/><path d="M14 16h20v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z"/><path d="M19 24c2-3 8-3 10 0"/>`),
  base: S(`<path d="M18 8h12M20 8v6c-8 4-10 10-10 15a14 7 0 0 0 28 0c0-5-2-11-10-15V8"/>`),
  bowl: S(`<path d="M12 12h24l-4 12H16z"/><path d="M20 24v6h8v-6"/>`),
  hose: S(`<path d="M8 32c10 0 6-20 18-20 8 0 10 6 14 6"/><path d="M38 14l4 4"/>`),
  hookah: S(`<path d="M19 3h10l-2 6h-6z"/><path d="M15 11h18M24 11v14"/><path d="M18 26h12c4 3 5 6 5 8a11 4 0 0 1-22 0c0-2 1-5 5-8z"/>`),
};
const CAT_ICON = { hookahs: "hookah", bases: "base", bowls: "bowl", heat: "coal", hoses: "hose", parts: "part", cologne: "scent", shisha: "jar", misc: "gift" };
const toneOf = id => (X.CATEGORIES.find(c => c.id === id) || {}).tone || "bone";
const has = cat => X.PRODUCTS.some(p => p.cat === cat);

function ways() {
  const foil = X.PRODUCTS.filter(p => heatKind(p) === "foil").length, flav = X.PRODUCTS.filter(p => p.cat === "shisha").length;
  const all = [
    ["/set", "ruby", "set", "Starting out", "A hookah, bowl and hose that go together", has("hookahs") || has("bowls")],
    ["/shop/heat?find=coal", "ember", "coal", "Need coals", "Pick the right box in two taps", X.PRODUCTS.some(p => heatKind(p) === "box")],
    ["/shop/shisha", "amethyst", "jar", "Flavours", `${flav} tobacco-free flavours`, flav > 0],
    ["/shop/heat?type=foil", "gilt", "foil", "Foil", `${foil} packs, by size and thickness`, foil > 0],
    ["/gifts/under-50", "emerald", "gift", "A gift", "Under $50 or under $150, packed at the counter", true],
    ["/shop/parts", "cobalt", "part", "Parts and care", `${X.PRODUCTS.filter(p => p.cat === "parts").length} pieces to fix or clean your setup`, has("parts")],
    ["/shop/cologne", "amethyst", "scent", "Smell good", "Cologne and fragrance", has("cologne")],
  ].filter(w => w[5]).slice(0, 6);
  return `<div class="ways2">${all.map(([href, tone, icon, name, sub]) => `<a class="way" data-tone="${tone}" href="${href}">${ICON[icon]}<span class="way__name">${name}</span><span class="way__sub">${X.esc(sub)}</span></a>`).join("")}</div>`;
}
const brandLink = b => `/search?q=${encodeURIComponent(b)}`;
function before() {
  const brands = popularBrands(X.PRODUCTS, 6);
  return `<h2 class="srch__h">Not sure what it is called? Start here.</h2>${ways()}
    ${brands.length ? `<h2 class="srch__h">Brands people ask for</h2><div class="pops">${brands.map(b => `<a href="${brandLink(b)}">${X.esc(b)}</a>`).join("")}</div>` : ""}
    <p class="srch__ask">Can’t find it? Call the counter at <a class="link" href="tel:+15192552222">519-255-2222</a> and we will check the shelf.</p>`;
}
// the matched words underlined, in one pass over the plain name, so one mark never lands inside another
function mark(name, words) {
  const ws = [...new Set(words.filter(w => /^[a-z0-9]{3,}$/.test(w)))];   // shop words are letters and digits only
  if (!ws.length) return X.esc(name);
  return name.split(new RegExp(`\\b((?:${ws.join("|")})\\w*)`, "i")).map((part, i) => i % 2 ? `<mark>${X.esc(part)}</mark>` : X.esc(part)).join("");
}
function meta(p) {
  const f = p.facts || {}, bits = [];
  if (p.family) { const n = X.PRODUCTS.filter(x => x.family === p.family).length; if (n > 1) bits.push(`${n} colours`); if (f.stamp === "stamped") bits.push("In the shop now"); }
  else { if (f.count) bits.push(`${f.count} pieces`); if (f.size) bits.push(f.size); if (!bits.length && p.note) bits.push(p.note); }
  return bits.join(" · ");
}
const row = (p, words) => `<li class="row"><a href="/p/${p.sku}" data-piece="${p.sku}"><span class="row__t tile">${X.shot(p, { small: true, use: "thumb" })}</span><span><span class="row__n">${mark(p.name, words)}</span><span class="row__m">${X.esc(meta(p))}</span></span>${X.sticker(p)}</a></li>`;
const jumpRow = j => `<li><a href="${j.href}" data-tone="${toneOf(j.cat.id)}"><i>${ICON[CAT_ICON[j.cat.id]] || ""}</i><span>${X.esc(j.whole ? `All of ${j.cat.name}` : j.label)}<small>${X.esc(j.whole ? "The whole section" : `${j.cat.name}, filtered for you`)}${j.quick ? ". Quick-light boxes say so on the box." : ""}</small></span><span class="num">${j.n}</span></a></li>`;
const pageRow = pg => `<li><a href="${pg.href}" data-tone="bone"><i>${S(`<path d="M18 12l10 8-10 8"/>`)}</i><span>${X.esc(pg.label)}<small>${X.esc(pg.sub)}</small></span><span class="num"></span></a></li>`;

export function searchOut(q) {
  if (!IX) return "";
  q = String(q || "").trim(); if (!q) return before();
  const u = understand(IX, q), hits = search(IX, q, u), words = u.terms.flatMap(t => t.alts.flatMap(a => a.split(" "))), js = jumps(IX, q, u);
  const said = (u.fixed.length ? `<p class="meant">Showing <b>${X.esc(u.fixed.reduce((s, [from, to]) => s.replace(new RegExp("\\b" + from, "i"), to), q.toLowerCase()))}</b>. You typed ${X.esc(u.fixed.map(f => f[0]).join(", "))}.</p>` : "")
    + (u.terms.some(t => t.quick) ? `<p class="meant">Our boxes are not marked quick-light yet. These are the round tablets; the box says if it lights quickly.</p>` : "");
  const pages = u.pages.length ? `<ul class="jumps jumps--pages">${u.pages.map(pageRow).join("")}</ul>` : "";
  if (!hits.length) {
    if (u.pages.length) return said + pages;
    const near = nearest(IX, q);
    return `<h2 class="srch__none">No “${X.esc(q)}” on the shelf.</h2><p class="srch__nonep">${near.alone.length ? "Here is the nearest we have, or ask us to get it in." : near.mean ? "" : "Try one of these, or ask us to get it in."}</p>
      ${near.mean ? `<p class="meant">Did you mean <a class="link" href="/search?q=${encodeURIComponent(near.mean)}">${X.esc(near.mean)}</a>?</p>` : ""}
      ${near.alone.map(a => `<h3 class="srch__h">With just “${X.esc(a.word)}” <span class="num">${a.n}</span></h3>${a.jumps.length ? `<ul class="jumps">${a.jumps.map(jumpRow).join("")}</ul>` : ""}<ul class="rows">${a.hits.map(p => row(p, [a.word])).join("")}</ul>`).join("")}
      <h3 class="srch__h">Or start here</h3>${ways()}
      <p class="srch__ask">Look through <a class="link" href="/shop">everything</a>, or ask us to stock it: call <a class="link" href="tel:+15192552222">519-255-2222</a>.</p>`;
  }
  const groups = grouped(IX, hits);
  return `${said}${pages}${js.length ? `<ul class="jumps">${js.map(jumpRow).join("")}</ul>` : ""}
    <p class="sr" role="status">${hits.length} ${hits.length === 1 ? "match" : "matches"}</p>
    ${groups.map(g => { const more = g.items.length > 4, coal = g.cat.id === "heat" && g.items.some(p => heatKind(p) !== "foil");
      return `<section class="rgroup" data-tone="${g.cat.tone}"><div class="rgroup__h"><h2>${X.esc(g.cat.name)}</h2><span class="num">${g.items.length}</span></div>${coal ? `<p class="rgroup__note">Charcoal is pickup or local delivery only.</p>` : ""}
      <ul class="rows">${g.items.slice(0, 4).map(p => row(p, words)).join("")}</ul>${more ? `<a class="link rgroup__all" href="/search?q=${encodeURIComponent(q)}&in=${g.cat.id}" data-s-all="${g.cat.id}">See all ${g.items.length} in ${X.esc(g.cat.name)}</a>` : ""}</section>`; }).join("")}`;
}
// "See all": the same search, one section, every match
export function searchAll(q, cat) {
  const hits = search(IX, q).filter(p => p.cat === cat), c = X.CATEGORIES.find(x => x.id === cat);
  if (!c) return searchOut(q);
  const u = understand(IX, q), words = u.terms.flatMap(t => t.alts.flatMap(a => a.split(" ")));
  return `<p class="meant"><a class="link" href="/search?q=${encodeURIComponent(q)}">All sections</a></p><section class="rgroup" data-tone="${c.tone}"><div class="rgroup__h"><h2>${X.esc(c.name)}</h2><span class="num">${hits.length}</span></div><ul class="rows">${hits.map(p => row(p, words)).join("")}</ul></section>`;
}
const GLASS = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6"/><path d="M13 13l5 5"/></svg>`;
export function searchPage(q, inCat) {
  return `<section class="shophead shophead--ask" data-tone="teal" data-fx="search"><h1 class="shophead__h">What are you after?</h1>
    <form class="srch__box" role="search" data-search-form action="/search"><label class="sr" for="q">Search the shop</label>${GLASS}
    <input class="field" id="q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Type a name or a brand" value="${X.esc(q)}"></form></section>
    <section class="srch"><div class="search__out" data-search-out aria-live="polite">${inCat && q ? searchAll(q, inCat) : searchOut(q)}</div></section>`;
}
