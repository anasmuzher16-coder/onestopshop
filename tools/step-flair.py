# Loop step (2026-11-13 evening): flair + phone work on direction 2 (his ruling: keep direction 2, make it special).
# - line-up: hookahs standing on one shelf at true relative height (nobody in the niche shows scale)
# - stickers placed by hand (each at its own angle), shared-element view transition tile -> product page
# - phone: dock turns into a buy bar on product pages, responsive images, cheap grain (no live SVG filter)
def between(s, a, b, new):
    i = s.index(a); j = s.index(b, i); return s[:i] + new + s[j:]

p = 'site/app.js'; s = open(p, encoding='utf8').read()

# images: responsive sources for tiles
s = between(s, 'function shot(p', '// ---------- THE STICKER', '''function shot(p, { small = false, eager = false } = {}) {
  const plain = p.dark || p.photo, cls = plain ? "shot shot--photo" : "shot";
  const set = plain ? "" : `srcset="img/p/${p.img}-s.webp 360w, img/p/${p.img}.webp 720w" sizes="${small ? "(min-width:1500px) 18vw, (min-width:960px) 22vw, (min-width:640px) 30vw, 46vw" : "(min-width:960px) 50vw, 100vw"}"`;
  return `<img class="${cls}" src="${imgSrc(p, small)}" ${set} alt="" width="${p.dark ? 1200 : 720}" height="${p.dark ? 1200 : 900}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

''')
# sticker: each one sits at its own angle, like it was put on by hand
s = between(s, 'function sticker(p', 'function card(p', '''function sticker(p, { big = false } = {}) {
  const n = parseInt(p.sku.slice(-3), 10), r = ((n * 37) % 23) - 13; // -13..+9 degrees, fixed per product
  return `<span class="sticker ${big ? "sticker--big" : ""}" style="--r:${r}deg"><span class="sticker__v">${whole(p.price)}</span></span>`;
}

''')
s = s.replace('<a class="card__a" href="#/p/${p.sku}">', '<a class="card__a" href="#/p/${p.sku}" data-piece="${p.sku}">')
s = s.replace('<a class="resin__item" href="#/p/${p.sku}">', '<a class="resin__item" href="#/p/${p.sku}" data-piece="${p.sku}">')
i = s.index('<div class="pdp__tile tile'); s = s[:i] + '<div data-stage="${p.sku}" class="pdp__tile tile' + s[i + len('<div class="pdp__tile tile'):]

# home: the line-up
s = s.replace('''  <section class="shelf">
    <header class="shelf__head"><h2 class="h2">On the counter this week</h2>''', '''  <section class="lineup" aria-labelledby="lu-h">
    <header class="lineup__head"><h2 class="h2 h2--xl" id="lu-h">Size them up.</h2><p class="lineup__note">Every hookah on one shelf, drawn to scale. Swipe along.</p></header>
    <div class="lineup__row" tabindex="0" role="group" aria-label="Hookahs by height">
      ${PRODUCTS.filter(p => p.cat === "hookahs" && p.height && !p.dark).sort((a, b) => a.height - b.height).filter((p, i) => i % 3 === 0).map(p =>
        `<a class="lu" href="#/p/${p.sku}" style="--cm:${p.height}"><img class="lu__img" src="img/p/${p.img}-s.webp" alt="" loading="lazy" width="360" height="450"><span class="lu__cm num">${p.height} cm</span><span class="lu__name">${esc(p.name)}</span></a>`).join("")}
    </div>
  </section>
  <section class="shelf">
    <header class="shelf__head"><h2 class="h2">On the counter this week</h2>''')
s = s.replace("counter's", "counter\\u2019s")

# dock: buy bar on product pages
s = between(s, '  $$("[data-dock]").forEach(', '}\nconst sheet', '''  const [ra, rb] = h.replace(/^#\\/?/, "").split("/"), prod = ra === "p" ? bySku[rb] : null;
  const count = `<span data-cart-count>${cartCount()}</span>`, dock = $(".dock");
  dock.classList.toggle("dock--buy", !!prod);
  dock.innerHTML = prod
    ? `<a class="dock__side" href="#/shop/${prod.cat}">Back</a>${state.cart.some(l => l.sku === prod.sku)
        ? `<a class="dock__buy" href="#/cart">In cart. View cart</a>` : `<button class="dock__buy" type="button" data-add="${prod.sku}">Add to cart <span class="num">${whole(prod.price)}</span></button>`}<a class="dock__side" href="#/cart" aria-label="Cart">${count}</a>`
    : `<a href="#/" ${h === "#/" ? 'aria-current="page"' : ""}>Home</a><a href="#/shop" ${h.startsWith("#/shop") ? 'aria-current="page"' : ""}>Shop</a><a href="#/cart" ${h === "#/cart" ? 'aria-current="page"' : ""}>Cart ${count}</a>`;
''')

# navigation: the tile you tapped travels to the product page and back
s = between(s, 'let last = location.hash;', 'render();\n', '''let last = location.hash;
document.addEventListener("click", e => {
  const a = e.target.closest("[data-piece]"); if (!a) return;
  $$(".tile").forEach(n => n.style.viewTransitionName = "");
  const n = $(".tile", a) || a; n.style.viewTransitionName = "piece";
}, true);
function go() {
  const from = last.match(/^#\\/p\\/(.+)$/); last = location.hash;
  render(); scrollTo(0, 0);
  const stage = $("[data-stage]");
  if (stage) stage.style.viewTransitionName = "piece";
  else if (from) { const back = $(`[data-piece="${from[1]}"]`), n = back && ($(".tile", back) || back); if (n) { n.style.viewTransitionName = "piece"; n.scrollIntoView({ block: "center" }); } }
  $("#main").focus({ preventScroll: true });
}
window.addEventListener("hashchange", () => {
  if (location.hash === last) return;
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go); else go();
});
''')
open(p, 'w', encoding='utf8', newline='\n').write(s)

p = 'site/index.html'; h = open(p, encoding='utf8').read()
h = between(h, '<nav class="dock"', '<dialog', '<nav class="dock" aria-label="Quick links"></nav>\n')
i = h.index('<svg width="0" height="0"'); j = h.index('</svg>', i) + 7; h = h[:i] + h[j:]
h = h.replace('<link rel="stylesheet" href="tokens.css">', '<link rel="preload" as="image" href="img/wide-bar-800.webp" media="(max-width:700px)" fetchpriority="high">\n<link rel="preload" as="image" href="img/wide-bar.webp" media="(min-width:701px)" fetchpriority="high">\n<link rel="stylesheet" href="tokens.css">')
open(p, 'w', encoding='utf8', newline='\n').write(h)

p = 'site/styles.css'; c = open(p, encoding='utf8').read()
c = c.replace('body::before{content:"";position:fixed;inset:0;z-index:50;pointer-events:none;filter:url(#grain);opacity:.07;mix-blend-mode:overlay}',
              'body::before{content:"";position:fixed;inset:0;z-index:50;pointer-events:none;background:url(img/grain.webp);opacity:.05}')
c = c.replace('text-align:center;transform:rotate(-8deg);', 'text-align:center;transform:rotate(var(--r,-8deg));transition:transform var(--dur-state) var(--ease-enter);')
c = c.replace('.sticker__k{', '.card__a:hover .sticker{transform:rotate(calc(var(--r,-8deg) + 10deg)) scale(1.08)}\n.sticker__k{', 1)
# dock: buy bar
c = c.replace('.dock>a[aria-current]{color:var(--color-strong);box-shadow:inset 0 2px 0 var(--color-strong)}', '''.dock>a[aria-current]{color:var(--color-strong);box-shadow:inset 0 2px 0 var(--color-strong)}
.dock--buy{grid-template-columns:72px 1fr 72px}
.dock .dock__buy{background:var(--color-action);color:var(--color-on-action);margin:var(--s-2) 0;border-radius:var(--radius);font-weight:600;gap:var(--s-3)}
.dock .dock__buy:active{background:var(--color-action-press)}
@media (max-width:959px){.pdp__info>.btn--wide{display:none}}''')
# line-up
c = c.replace('/* ---------- shelves + grid ---------- */', '''/* ---------- line-up: every hookah on one shelf, to scale ---------- */
.lineup{--lu-h:300px;margin-top:var(--s-12);background:var(--teal);color:var(--color-on-tile)}
.lineup__head{padding:var(--s-8) var(--gutter) 0}
.lineup .h2{color:var(--color-on-tile)}
.lineup__note{margin:var(--s-2) 0 0;font-size:var(--t-14);font-weight:500}
.lineup__row{display:flex;align-items:flex-end;gap:var(--s-2);padding:var(--s-6) var(--gutter) 0;overflow-x:auto;scroll-snap-type:x proximity;scroll-padding-inline:var(--gutter);scrollbar-width:none;
  background:repeating-linear-gradient(0deg,transparent 0 calc(var(--lu-h) / 92 * 30 - 1px),oklch(0.16 0.012 50 / .18) calc(var(--lu-h) / 92 * 30 - 1px) calc(var(--lu-h) / 92 * 30)) bottom / 100% calc(var(--lu-h) + 76px) no-repeat}
.lineup__row::-webkit-scrollbar{display:none}
.lu{flex:none;display:grid;justify-items:center;align-content:end;scroll-snap-align:start;text-decoration:none;color:inherit;width:calc(var(--lu-h) * .5)}
.lu__img{height:calc(var(--cm) / 92 * var(--lu-h));width:auto;max-width:none;mix-blend-mode:multiply;transform-origin:50% 100%;transition:transform var(--dur-state) var(--ease-enter)}
.lu:hover .lu__img{transform:scale(1.04)}
.lu__cm{width:100%;text-align:center;border-top:2px solid var(--ink);padding-top:var(--s-2);font:400 1.25rem/1 var(--font-display)}
.lu__name{font-size:var(--t-12);font-weight:500;text-align:center;padding:2px var(--s-1) var(--s-5);min-height:56px;max-width:100%}

/* ---------- shelves + grid ---------- */''')
c = c.replace('@media (min-width:960px){\n  body{padding-bottom:0}', '@media (min-width:960px){\n  body{padding-bottom:0}\n  .lineup{--lu-h:460px;margin-top:var(--s-24)}\n  .lineup__head{display:flex;justify-content:space-between;align-items:end;gap:var(--s-8);padding-top:var(--s-12)}\n  .lu__cm{font-size:1.6rem} .lu__name{font-size:var(--t-14)}')
c += '''
/* ---------- the tile you tapped travels to the product page ---------- */
::view-transition-old(root),::view-transition-new(root){animation-duration:.28s;animation-timing-function:var(--ease-state)}
::view-transition-group(piece){animation-duration:.5s;animation-timing-function:var(--ease-enter)}
::view-transition-old(piece),::view-transition-new(piece){height:100%;object-fit:cover;animation-duration:.25s}
'''
open(p, 'w', encoding='utf8', newline='\n').write(c)
print('ok')
