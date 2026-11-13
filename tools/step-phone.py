# Loop step (2026-11-13): crisp photos everywhere + the phone audit's fixes (scratchpad mobile2 report).
import re
def sub(s, a, b, count=1):
    assert a in s, 'missing: ' + a[:70]
    return s.replace(a, b, count)
def between(s, a, b, new):
    i = s.index(a); j = s.index(b, i); return s[:i] + new + s[j:]

# ---------------- app.js ----------------
p = 'site/app.js'; s = open(p, encoding='utf8').read()
# images: one srcset builder; every context passes the size it is really drawn at
s = between(s, 'const imgSrc = (p, small)', '// ---------- THE STICKER', '''const imgSrc = (p, small) => p.photo ? `img/${p.img}.webp` : `img/p/${p.img}${small && !p.dark ? "-s" : ""}.webp`;
const SIZES = { card: "(min-width:1500px) 18vw, (min-width:960px) 22vw, (min-width:640px) 30vw, 46vw", pdp: "(min-width:960px) 50vw, 100vw",
  thumb: "96px", lineup: "(min-width:960px) 370px, 240px", cat: "(min-width:960px) 24vw, 44vw", resin: "(min-width:960px) 28vw, (min-width:640px) 40vw, 72vw" };
function srcset(p) {
  if (p.photo) return "";
  if (p.dark) return `srcset="img/p/${p.img}.webp 800w${p.lw ? `, img/p/${p.img}-l.webp ${p.lw}w` : ""}"`;
  return `srcset="img/p/${p.img}-s.webp 360w, img/p/${p.img}.webp 720w${p.lw ? `, img/p/${p.img}-l.webp ${p.lw}w` : ""}"`;
}
function shot(p, { small = false, eager = false, use = small ? "card" : "pdp", cls = "" } = {}) {
  const plain = p.dark || p.photo;
  return `<img class="${plain ? "shot shot--photo" : "shot"} ${cls}" src="${imgSrc(p, small)}" ${srcset(p)} ${p.photo ? "" : `sizes="${SIZES[use]}"`} alt="" width="${p.dark ? 1080 : 720}" height="${p.dark ? 1080 : 900}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

''')
s = sub(s, '<img class="shot cat__img" src="${imgSrc(lead, true)}" alt="" loading="lazy" width="360" height="450">', '${shot(lead, { small: true, use: "cat", cls: "cat__img" })}')
s = sub(s, '<img class="lu__img" src="img/p/${p.img}-s.webp" alt="" loading="lazy" width="360" height="450">', '<img class="lu__img" src="img/p/${p.img}-s.webp" ${srcset(p)} sizes="${SIZES.lineup}" alt="" loading="lazy" width="360" height="450">')
s = sub(s, 'href="#/p/${p.sku}">${shot(p, { small: true })}</a>', 'href="#/p/${p.sku}">${shot(p, { small: true, use: "thumb" })}</a>')
s = sub(s, 'data-piece="${p.sku}">${shot(p)}<span class="resin__name">', 'data-piece="${p.sku}">${shot(p, { use: "resin" })}<span class="resin__name">')
s = sub(s, '"Woodline Sage", ', '')
s = sub(s, 'All 39 hookahs', 'All ${PRODUCTS.filter(p => p.cat === "hookahs").length} hookahs')
# hero: sharp on phones too (portrait crop of a landscape photo needs a wide file)
i = s.index('<picture class="hero__bg">'); j = s.index('</picture>', i) + 10
s = s[:i] + '<picture class="hero__bg"><img src="img/wide-bar.webp" srcset="img/wide-bar-800.webp 800w, img/wide-bar.webp 1600w, img/wide-bar-2400.webp 2400w" sizes="(max-width:700px) 230vw, 100vw" alt="" width="1600" height="1068" fetchpriority="high"></picture>' + s[j:]
# home order: products before the line-up
a = s.index('  <section class="lineup"'); b = s.index('  <section class="shelf">', a); c = s.index('  <section class="resin">', b)
s = s[:a] + s[b:c] + s[a:b] + s[c:]
# cart: remember whether the breakdown is open; dock shows total + checkout
s = sub(s, '<details class="why"><summary>', '<details class="why" ${state.whyOpen ? "open" : ""}><summary>')
s = sub(s, 'const state = {', 'const state = { whyOpen: false,')
s = between(s, '  dock.innerHTML = prod', '}\nconst sheet', '''  const lines = cartLines(), sub = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const qs = ra === "cart" && state.dest && lines.length ? quote(state.dest, pack(lines)) : [], ship = qs.find(o => o.id === state.ship) || qs[0];
  dock.classList.toggle("dock--buy", !!prod || (ra === "cart" && lines.length > 0));
  dock.innerHTML = prod
    ? `<a class="dock__side" href="#/shop/${prod.cat}">Back</a>${state.cart.some(l => l.sku === prod.sku)
        ? `<a class="dock__buy" href="#/cart">In cart. View cart</a>` : `<button class="dock__buy" type="button" data-add="${prod.sku}">Add to cart <span class="num">${whole(prod.price)}</span></button>`}<a class="dock__side" href="#/cart" aria-label="Cart">${count}</a>`
    : ra === "cart" && lines.length
    ? `<a class="dock__side" href="#/shop">Shop</a><button class="dock__buy" type="button" ${ship ? "" : "data-open-postal"}>${ship ? `Checkout <span class="num">${money(sub + ship.total)}</span>` : "Add postal code for shipping"}</button><span class="dock__side">${count}</span>`
    : `<a href="#/" ${h === "#/" ? 'aria-current="page"' : ""}>Home</a><a href="#/shop" ${h.startsWith("#/shop") ? 'aria-current="page"' : ""}>Shop</a><a href="#/cart" ${h === "#/cart" ? 'aria-current="page"' : ""}>Cart ${count}</a>`;
''')
# render keeps focus on the control that was used
s = sub(s, 'function render() {', '''document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches(".why")) state.whyOpen = e.target.open; }, true);
function focusKey(el) {
  if (!el || el === document.body) return null;
  for (const k of ["data-qty", "data-add"]) if (el.hasAttribute(k)) return `[${k}="${el.getAttribute(k)}"]` + (el.dataset.n ? `[aria-label="${el.getAttribute("aria-label")}"]` : "");
  if (el.name === "ship") return `input[name="ship"][value="${el.value}"]`;
  return null;
}
function render() {
  const keep = focusKey(document.activeElement);''')
i = s.index('  syncChrome();\n}', s.index('function render() {'))
s = s[:i] + '  syncChrome();\n  if (keep) { const el = document.querySelector(keep); if (el) el.focus({ preventScroll: true }); }\n}' + s[i + len('  syncChrome();\n}'):]
open(p, 'w', encoding='utf8', newline='\n').write(s)

# ---------------- index.html ----------------
p = 'site/index.html'; h = open(p, encoding='utf8').read()
h = sub(h, 'content="width=device-width, initial-scale=1, viewport-fit=cover"', 'content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"')
i = h.index('<link rel="preload" as="image" href="img/wide-bar-800.webp"'); j = h.index('<link rel="stylesheet" href="tokens.css">')
h = h[:i] + '<link rel="modulepreload" href="catalog.js">\n<link rel="modulepreload" href="rates.js">\n<link rel="modulepreload" href="cp-sheet.js">\n' + h[j:]
h = sub(h, 'Mockup for review. Sample products, placeholder photos, estimated delivery prices.', 'Mockup: sample products, placeholder photos, estimated shipping')
h = sub(h, '<nav class="dock" aria-label="Quick links"></nav>', '<nav class="dock" aria-label="Quick links"><a href="#/">Home</a><a href="#/shop">Shop</a><a href="#/cart">Cart <span data-cart-count>0</span></a></nav>')
open(p, 'w', encoding='utf8', newline='\n').write(h)

# ---------------- styles.css ----------------
p = 'site/styles.css'; c = open(p, encoding='utf8').read()
c = sub(c, '#main{outline:none}', '#main{outline:none}\n#main:empty{min-height:100svh}\nbody:not([data-route]) .foot{visibility:hidden}')
c = sub(c, '.mock-ribbon{margin:0;font-size:11px;line-height:1.4;text-align:center;padding:var(--s-1) var(--gutter);', '.mock-ribbon{margin:0;font-size:var(--t-12);line-height:1.5;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px var(--gutter);')
c = sub(c, 'gap:var(--s-4);padding:var(--s-3) var(--gutter);', 'gap:var(--s-4);min-height:52px;padding:0 var(--gutter);')
c = sub(c, '.link{background:none;border:0;padding:0;', '.link{background:none;border:0;padding:12px 0;margin:-12px 0;')
c = sub(c, '.tile{position:relative;aspect-ratio:4/5;', '.tile{position:relative;isolation:isolate;aspect-ratio:4/5;')
c = sub(c, 'min-height:min(calc(100svh - 170px),700px);', 'min-height:min(calc(100svh - 236px),700px);')
c = sub(c, '.hero__big{display:block;font-size:26.2cqw;', '.hero__big{display:block;font-size:min(26.2cqw,30svh);')
c = sub(c, '.cat{position:relative;display:grid;', '.cat{position:relative;isolation:isolate;display:grid;')
c = sub(c, 'text-decoration:none;color:inherit;width:calc(var(--lu-h) * .4)}', 'text-decoration:none;color:inherit;isolation:isolate;min-width:calc(var(--lu-h) * .34);padding-inline:var(--s-1)}')
c = sub(c, '.card__meta{margin:0;font-size:var(--t-12);color:var(--color-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}', '.card__meta{margin:0;font-size:var(--t-12);line-height:1.4;color:var(--color-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}')
c = sub(c, '.grid .sticker{width:62px;height:62px;right:6px;bottom:6px}', '.grid .sticker{width:58px;height:58px;right:6px;top:6px;bottom:auto}')
c = sub(c, '.grid .sticker{width:80px;height:80px;right:var(--s-2);bottom:var(--s-2)}', '.grid .sticker{width:80px;height:80px;right:var(--s-2);top:var(--s-2)}')
c = sub(c, 'overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}', 'overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:var(--gutter);scrollbar-width:none}')
c = sub(c, '.chips{position:sticky;top:57px;', '.chips{position:sticky;top:52px;')
c = sub(c, 'align-items:center;min-height:40px;padding:0 var(--s-4);border-radius:20px;', 'align-items:center;min-height:44px;padding:0 var(--s-4);border-radius:22px;')
c = sub(c, '.pdp__tile{border-radius:0;aspect-ratio:1/1.05;', '.pdp__tile{border-radius:0;aspect-ratio:auto;height:min(105vw,52svh);')
c = sub(c, '.dock--buy{grid-template-columns:72px 1fr 72px}', '.dock--buy{grid-template-columns:72px 1fr 56px}\n.dock span.dock__side{cursor:default}')
c = sub(c, '@media (max-width:959px){.pdp__info>.btn--wide{display:none}}', '''@media (max-width:959px){.pdp__info>.btn--wide,.top__cart{display:none}}
@media (orientation:landscape) and (max-height:500px){
  .pdp{grid-template-columns:1fr 1fr} .pdp__tile{height:calc(100svh - 150px)}
  .hero{min-height:0;padding-top:var(--s-6)}
}''')
c = sub(c, '  .top__cart{margin-left:0}', '  .top{min-height:76px}\n  .top__cart{margin-left:0}')
c = sub(c, '  .chips{top:77px}', '  .chips{top:76px}')
c = sub(c, '  .pdp__tile{position:sticky;top:77px;height:calc(100svh - 77px);aspect-ratio:auto}', '  .pdp__tile{position:sticky;top:76px;height:calc(100svh - 76px);aspect-ratio:auto}')
open(p, 'w', encoding='utf8', newline='\n').write(c)
print('ok')
