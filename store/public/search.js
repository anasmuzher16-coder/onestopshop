// The search page: ways in before typing, results grouped by section while typing, and a way forward when nothing
// matches. The matching lives in search-core.js; app.js calls searchPage() and searchOut().
import { buildIndex, understand, search, grouped, jumps, nearest, popularBrands, arriving } from "./search-core.js";
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
// Small objects in the band objects' own manner: flat fills, a lit side and a shade side (light from the top left),
// one ink outline. Colours are the objects' own materials (steel, glass, brass, paper, coal), not UI colours.
const STEEL = "#d9dde3", STEEL_D = "#9aa3ae", GLASS = "#5fb7b0", GLASS_D = "#2f7f7a", BRASS = "#e6c25a", BRASS_D = "#b48a2c", PAPER = "#f6f1e7", PAPER_D = "#d8cfbf", COAL = "#3a302a", COAL_D = "#1d1714", EMBER = "#f26a3d";
const ICON = {
  set: S(`<path d="M19 3h10l-2 6h-6z" fill="${COAL}"/><path d="M14 10h20l-2 3H16z" fill="${STEEL}"/><path d="M22 13h4v13h-4z" fill="${STEEL_D}"/><path d="M18 26h12c4 3 6 6 6 8a12 5 0 0 1-24 0c0-2 2-5 6-8z" fill="${GLASS}"/><path d="M14 33c3 3 17 3 20 0a12 5 0 0 1-20 0z" fill="${GLASS_D}" stroke="none"/><path d="M26 18c7 0 11 4 11 10" stroke-width="2.4"/><path d="M18 26h12c4 3 6 6 6 8a12 5 0 0 1-24 0c0-2 2-5 6-8z"/>`),
  coal: DRAWN.cube.replace('class="shape" ', ""),
  foil: S(`<ellipse cx="24" cy="21" rx="18" ry="11" fill="${STEEL}"/><path d="M6 21a18 11 0 0 0 36 0c-4 6-30 6-36 0z" fill="${STEEL_D}" stroke="none"/><g fill="${COAL_D}" stroke="none"><circle cx="18" cy="18" r="1.4"/><circle cx="24" cy="16" r="1.4"/><circle cx="30" cy="18" r="1.4"/><circle cx="21" cy="23" r="1.4"/><circle cx="27" cy="23" r="1.4"/></g><path d="M9 15c6-7 24-8 31 0" stroke="#fff" stroke-width="1.6" opacity=".8"/><ellipse cx="24" cy="21" rx="18" ry="11"/>`),
  gift: S(`<path d="M8 16h32v20H8z" fill="${PAPER}"/><path d="M24 16h16v20H24z" fill="${PAPER_D}" stroke="none"/><path d="M6 10h36v6H6z" fill="${PAPER}"/><path d="M21 10h6v26h-6z" fill="${EMBER}"/><path d="M24 10c-4-6-12-6-10 0M24 10c4-6 12-6 10 0" stroke-width="2.4"/><path d="M8 16h32v20H8zM6 10h36v6H6z"/>`),
  part: S(`<path d="M8 30l18-18 6 6-18 18z" fill="${STEEL}"/><path d="M20 24l12-12 3 3-12 12z" fill="${STEEL_D}" stroke="none"/><circle cx="36" cy="11" r="6" fill="${BRASS}"/><circle cx="36" cy="11" r="2.5" fill="${BRASS_D}"/><path d="M8 30l18-18 6 6-18 18z"/>`),
  scent: S(`<path d="M20 6h8v7h-8z" fill="${BRASS}"/><path d="M16 13h16l3 5v17a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V18z" fill="${GLASS}"/><path d="M24 13h8l3 5v17a2 2 0 0 1-2 2h-9z" fill="${GLASS_D}" stroke="none"/><path d="M17 18v12" stroke="#fff" stroke-width="2" opacity=".7"/><path d="M16 13h16l3 5v17a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V18z"/>`),
  jar: S(`<path d="M11 9h26v6H11z" fill="${COAL}"/><path d="M13 15h22v19a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z" fill="${PAPER}"/><path d="M24 15h11v19a3 3 0 0 1-3 3h-8z" fill="${PAPER_D}" stroke="none"/><path d="M13 22h22v8H13z" fill="${EMBER}"/><path d="M13 15h22v19a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z"/>`),
  base: S(`<path d="M20 8v6c-8 4-10 10-10 15a14 7 0 0 0 28 0c0-5-2-11-10-15V8z" fill="${GLASS}"/><path d="M24 14v22a14 7 0 0 0 14-7c0-5-2-11-10-15z" fill="${GLASS_D}" stroke="none"/><path d="M18 8h12"/><path d="M20 8v6c-8 4-10 10-10 15a14 7 0 0 0 28 0c0-5-2-11-10-15V8"/>`),
  bowl: S(`<path d="M12 12h24l-4 12H16z" fill="${COAL}"/><path d="M24 12h12l-4 12h-8z" fill="${COAL_D}" stroke="none"/><path d="M20 24v6h8v-6z" fill="${STEEL_D}"/><path d="M12 12h24l-4 12H16z"/>`),
  hose: S(`<path d="M8 32c10 0 6-20 18-20 8 0 10 6 14 6" stroke-width="4"/><path d="M8 32c10 0 6-20 18-20 8 0 10 6 14 6" stroke="${STEEL}" stroke-width="1.6"/><path d="M38 14l5 5" stroke-width="4"/>`),
  hookah: S(`<path d="M19 3h10l-2 6h-6z" fill="${COAL}"/><path d="M14 10h20l-2 3H16z" fill="${STEEL}"/><path d="M22 13h4v13h-4z" fill="${STEEL_D}"/><path d="M18 26h12c4 3 6 6 6 8a12 5 0 0 1-24 0c0-2 2-5 6-8z" fill="${GLASS}"/><path d="M18 26h12c4 3 6 6 6 8a12 5 0 0 1-24 0c0-2 2-5 6-8z"/>`),
};
const CAT_ICON = { hookahs: "hookah", bases: "base", bowls: "bowl", charcoal: "coal", heat: "foil", hoses: "hose", parts: "part", cologne: "scent", shisha: "jar", misc: "gift" };
const toneOf = id => (X.CATEGORIES.find(c => c.id === id) || {}).tone || "bone";
const has = cat => X.PRODUCTS.some(p => p.cat === cat);

const tone = (id, fallback) => (X.CATEGORIES.find(c => c.id === id) || {}).tone || fallback;
// on sale and not sold out: a way in only leads somewhere that has something to buy (the samples came off, 2026-11-24)
const buyable = p => p.state === "sale" && p.stock > 0;
function ways() {
  const foil = X.PRODUCTS.filter(p => heatKind(p) === "foil").length, flav = X.PRODUCTS.filter(p => p.cat === "shisha").length;
  const all = [
    ["/set", tone("hookahs", "ruby"), "set", "Starting out", "A hookah, bowl and hose that go together", X.PRODUCTS.some(p => ["hookahs", "bowls", "hoses"].includes(p.cat) && buyable(p))],
    ["/shop/charcoal?find=coal", tone("charcoal", "ash"), "coal", "Need coals", "Pick the right box in two taps", X.PRODUCTS.some(p => heatKind(p) === "box")],
    ["/shop/shisha", tone("shisha", "amethyst"), "jar", "Flavours", `${flav} tobacco-free flavours`, flav > 0],
    ["/shop/heat?type=foil", tone("heat", "ember"), "foil", "Foil", `${foil} packs, by size and thickness`, foil > 0],
    ["/gifts/under-50", "emerald", "gift", "A gift", "Under $50 or under $150, packed at the counter", X.PRODUCTS.some(p => buyable(p) && p.ship !== "pickup_only" && !(p.details && p.details.charcoal) && !p.dark && p.price < 50)],
    ["/shop/parts", tone("parts", "gilt"), "part", "Parts and care", `${X.PRODUCTS.filter(p => p.cat === "parts").length} pieces to fix or clean your setup`, has("parts")],
    ["/shop/cologne", tone("cologne", "amethyst"), "scent", "Smell good", "Cologne and fragrance", has("cologne")],
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
  if (p.family) { const n = X.PRODUCTS.filter(x => x.family === p.family).length; if (n > 1) bits.push(`${n} colours`); if (f.stamp && f.stamp !== "none") bits.push("In the shop now"); }
  else { if (f.count) bits.push(`${f.count} pieces`); if (f.size) bits.push(f.size); }
  // never repeat what the name already says ("1 kg, 27 mm" then "27 mm")
  const name = p.name.toLowerCase(), num = s => (s.match(/\d+(?:\.\d+)?/) || [""])[0];
  return bits.filter(b => !name.includes(num(b) || b.toLowerCase())).join(" · ");
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
  const soon = arriving(IX, q, u), soonNames = soon.map(c => c.name).join(" and ");
  const soonLink = soon.map(c => `<a class="link" href="/shop/${c.id}">${X.esc(c.name)}</a>`).join(", ");
  if (!hits.length) {
    if (u.pages.length) return said + pages;
    const near = nearest(IX, q);
    if (soon.length) return `<h2 class="srch__none">${X.esc(soonNames)}: stock arriving soon.</h2><p class="srch__nonep">We are putting the shop’s own list online. Call the counter at <a class="link" href="tel:+15192552222">519-255-2222</a> and we will check the shelf, or see ${soonLink}.</p>
      <h3 class="srch__h">On the shelf now</h3>${ways()}`;
    return `<h2 class="srch__none">No “${X.esc(q)}” on the shelf.</h2><p class="srch__nonep">${near.alone.length ? "Here is the nearest we have, or ask us to get it in." : near.mean ? "" : "Try one of these, or ask us to get it in."}</p>
      ${near.mean ? `<p class="meant">Did you mean <a class="link" href="/search?q=${encodeURIComponent(near.mean)}">${X.esc(near.mean)}</a>?</p>` : ""}
      ${near.alone.map(a => `<h3 class="srch__h">With just “${X.esc(a.word)}” <span class="num">${a.n}</span></h3>${a.jumps.length ? `<ul class="jumps">${a.jumps.map(jumpRow).join("")}</ul>` : ""}<ul class="rows">${a.hits.map(p => row(p, [a.word])).join("")}</ul>`).join("")}
      <h3 class="srch__h">Or start here</h3>${ways()}
      <p class="srch__ask">Look through <a class="link" href="/shop">everything</a>, or ask us to stock it: call <a class="link" href="tel:+15192552222">519-255-2222</a>.</p>`;
  }
  const groups = grouped(IX, hits);
  return `${said}${soon.length ? `<p class="meant">${X.esc(soonNames)}: stock arriving soon. See ${soonLink}, or call <a class="link" href="tel:+15192552222">519-255-2222</a>.</p>` : ""}${pages}${js.length ? `<ul class="jumps">${js.map(jumpRow).join("")}</ul>` : ""}
    <p class="sr" role="status">${hits.length} ${hits.length === 1 ? "match" : "matches"}</p>
    ${groups.map(g => { const more = g.items.length > 4, coal = g.cat.id === "charcoal";
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
const LENS = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6"/><path d="M13 13l5 5"/></svg>`;
export function searchPage(q, inCat) {
  return `<section class="shophead shophead--ask" data-tone="teal" data-fx="search"><h1 class="shophead__h">What are you after?</h1>
    <form class="srch__box" role="search" data-search-form action="/search"><label class="sr" for="q">Search the shop</label>${LENS}
    <input class="field" id="q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Type a name or a brand" value="${X.esc(q)}"></form></section>
    <section class="srch"><div class="search__out" data-search-out aria-live="polite">${inCat && q ? searchAll(q, inCat) : searchOut(q)}</div></section>`;
}
