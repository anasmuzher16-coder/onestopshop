# One-off edit (2026-11-13): his correction. The shipping calculator is a feature the owner asked for,
# not the focus of the site. Products lead; shipping lives on the product page, the cart and the shipping page.
def between(s, a, b, new):
    i = s.index(a); j = s.index(b, i); return s[:i] + new + s[j:]

p = 'site/app.js'; s = open(p, encoding='utf8').read()
s = between(s, 'function sticker(p', 'function card(p', '''function sticker(p, { big = false } = {}) {
  return `<span class="sticker ${big ? "sticker--big" : ""}"><span class="sticker__v">${whole(p.price)}</span></span>`;
}

''')
i = s.index('    <p class="card__meta">'); j = s.index('</p>', i) + 4
s = s[:i] + '    <p class="card__meta">${esc(p.note)}</p>' + s[j:]
s = between(s, 'const TICKER = [', 'function viewHome()', '''const WORDS = ["Egyptian brass", "Bohemian glass", "German steel", "Poured resin", "Hand-stitched leather", "Clay and stoneware", "Shipped across Canada", "Open seven days"];
function ticker() {
  const items = WORDS.map(w => `<span class="tick">${w}</span>`).join("");
  return `<div class="ticker" aria-hidden="true"><div class="ticker__run"><div class="ticker__track">${items}${items}</div></div></div>`;
}

''')
s = between(s, '    <div class="hero__in">', '  <section class="cats"', '''    <div class="hero__in">
      <p class="hero__ar" lang="ar" dir="rtl">&#x623;&#x647;&#x644;&#x627; &#x648;&#x633;&#x647;&#x644;&#x627;</p>
      <h1 class="hero__h">Hookahs worth <span class="hero__door">showing off.</span></h1>
      <p class="hero__p">Egyptian brass, German steel and hand-cut glass. On the counter in Windsor, and shipped anywhere in Canada.</p>
      <div class="hero__cta"><a class="btn" href="#/shop/hookahs">Shop hookahs</a><a class="btn btn--ghost" href="#/shop">See everything</a></div>
    </div>
  </section>
  ${ticker()}
''')
i = s.index('  const hero = PRODUCTS.find'); j = s.index('\n', i) + 1; s = s[:i] + s[j:]
s = s.replace(' It is already in the price you see.</li>', '</li>')
i = s.index('<span class="num">${list.length}</span> items'); j = s.index('</p>', i)
s = s[:i] + '<span class="num">${list.length}</span> items' + s[j:]
s = s.replace('Each one shows its price at your door.', 'Shipping is priced in the cart.')
s = between(s, '      <dl class="price">', '      ${inCart ?', '      <p class="pdp__price num">${money(p.price)}</p>\n')
s = between(s, '      ${opts.length ? `\n      <section class="ways"', '      <section class="spec"', '''      <section class="ways" aria-labelledby="ways-h">
        <h2 class="h3" id="ways-h">Shipping estimate</h2>
        ${opts.length ? `<p class="ways__to">To ${esc(state.dest.full)}${state.dest.city ? ", " + esc(state.dest.city) : ""}. <button class="link" type="button" data-open-postal>Change</button></p>
        <table class="ledger"><thead><tr><th scope="col">Service</th><th scope="col">Arrives</th><th scope="col" class="r">Cost</th></tr></thead>
        <tbody>${opts.map(o => `<tr><td>${o.carrier} ${o.service}</td><td>${days(o.days)}</td><td class="r num">${money(o.total)}</td></tr>`).join("")}
        <tr><td>Pick up at the Windsor counter</td><td>Today</td><td class="r num">Free</td></tr></tbody></table>`
        : `<p class="ways__to">Ships anywhere in Canada, or pick up free at the Windsor counter.</p><button class="btn btn--ghost btn--wide" type="button" data-open-postal>Estimate shipping to my postal code</button>`}
      </section>
''')
s = s.replace('<dt>Delivery</dt><dd class="num">${chosen ? money(chosen.total) : "not priced yet"}</dd>', '<dt>Shipping</dt><dd class="num">${chosen ? money(chosen.total) : "add postal code"}</dd>')
s = s.replace('<div class="totals__door"><dt>At your door</dt>', '<div class="totals__door"><dt>Total before tax</dt>')
s = s.replace('Add postal code to price delivery', 'Add postal code to price shipping').replace('<legend>Delivery to ', '<legend>Shipping to ')
s = between(s, '  $("[data-shipto]").textContent', '  const h = location.hash', '')
i = s.index('  $("[data-nav]").innerHTML'); j = s.index('\n', i)
s = s[:i] + '''  $("[data-nav]").innerHTML = CATEGORIES.slice(0, 6).map(c => `<a href="#/shop/${c.id}" ${h === "#/shop/" + c.id ? 'aria-current="page"' : ""}>${c.name}</a>`).join("") + `<a href="#/shipping" ${h === "#/shipping" ? 'aria-current="page"' : ""}>Shipping</a>`;''' + s[j:]
s = s.replace('a.dataset.dock === "cart" ? h === "#/cart" : h.startsWith("#/shop")', 'a.dataset.dock === "cart" ? h === "#/cart" : a.dataset.dock === "home" ? h === "#/" : h.startsWith("#/shop") || h.startsWith("#/p/")')
i = s.index('  document.body.classList.remove("slap")'); j = s.index('\n', i) + 1; s = s[:i] + s[j:]
s = between(s, '    <h2 class="h3">What you pay</h2>', '    <h2 class="h3">How glass is packed</h2>', '''    <h2 class="h3">What it costs</h2>
    <p>Shipping is worked out from the packed weight and box size of your order and the carrier's rate to your postal code. You see the cost on the product page and in the cart before you pay.</p>
    <p><button class="btn btn--ghost" type="button" data-open-postal>${state.dest ? "Estimating to " + esc(state.dest.full) + ". Change" : "Enter my postal code"}</button></p>
''')
s = s.replace('  const q = bestFor(p), tone = toneOf(p);', '  const tone = toneOf(p);')
open(p, 'w', encoding='utf8', newline='\n').write(s)

p = 'site/index.html'; h = open(p, encoding='utf8').read()
i = h.index('  <button class="shipto"'); j = h.index('\n', i) + 1; h = h[:i] + h[j:]
h = between(h, '<nav class="dock"', '<dialog', '''<nav class="dock" aria-label="Quick links">
  <a href="#/" data-dock="home">Home</a>
  <a href="#/shop" data-dock="shop">Shop</a>
  <a href="#/cart" data-dock="cart">Cart <span data-cart-count>0</span></a>
</nav>
''')
h = h.replace('>Where are we shipping?</h2>', '>Shipping estimate</h2>')
h = h.replace('Type your postal code once. Every price in the shop becomes the price at your door.', 'Enter your postal code to see shipping options and cost.')
h = h.replace('>Price everything</button>', '>Get estimate</button>')
h = h.replace('Hookahs, priced to your door across Canada', 'Hookahs and accessories, Windsor, shipped across Canada')
h = h.replace('Every price shown delivered to your postal code.', 'Shipped anywhere in Canada.')
open(p, 'w', encoding='utf8', newline='\n').write(h)

p = 'site/styles.css'; c = open(p, encoding='utf8').read()
c = c.replace('grid-template-columns:1fr 1.5fr 1fr;height:calc(var(--bar-h)', 'grid-template-columns:1fr 1fr 1fr;height:calc(var(--bar-h)')
c = c.replace('gap:1px;width:96px;height:96px;padding:var(--s-2);', 'gap:1px;width:76px;height:76px;padding:var(--s-2);')
c = c.replace('.grid .sticker{width:78px;height:78px;right:6px;bottom:6px}', '.grid .sticker{width:62px;height:62px;right:6px;bottom:6px}')
c = c.replace('.grid .sticker{width:96px;height:96px;right:var(--s-2);bottom:var(--s-2)} .grid .sticker__v{font-size:1.7rem}', '.grid .sticker{width:80px;height:80px;right:var(--s-2);bottom:var(--s-2)} .grid .sticker__v{font-size:1.6rem}')
c = c.replace('.pdp__note{margin:var(--s-3) 0 var(--s-5);color:var(--color-muted)}', '.pdp__note{margin:var(--s-3) 0 var(--s-4);color:var(--color-muted)}\n.pdp__price{font:400 2.6rem/1 var(--font-display);color:var(--color-strong);margin:0 0 var(--s-5);padding-top:.1em}\n.ways__to{margin:0 0 var(--s-3);font-size:var(--t-14);color:var(--color-muted)}')
c = c.replace('padding:0 var(--s-5);white-space:nowrap}', 'padding:0 var(--s-5);white-space:nowrap}\n.tick::after{content:"";display:inline-block;width:8px;height:8px;margin-left:calc(var(--s-5)*2);border-radius:50%;background:var(--ember);vertical-align:middle}')
c = c.replace('.ticker__run{overflow:hidden;padding:var(--s-1) 0 var(--s-3)}', '.ticker__run{overflow:hidden;padding:var(--s-3) 0}')
c = c.replace('  .ticker{grid-template-columns:auto 1fr;align-items:center}\n', '')
c = c.replace('.card__meta{margin:0;font-size:var(--t-12);color:var(--color-muted)}', '.card__meta{margin:0;font-size:var(--t-12);color:var(--color-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}')
c = c.replace('.dock>button{', '.dock>a[aria-current]{font-weight:600}\n.dock>button{')
open(p, 'w', encoding='utf8', newline='\n').write(c)

p = 'tools/capture.mjs'; t = open(p, encoding='utf8').read()
t = t.replace('"B3H 4R2"', '"M5V 2T6"').replace('["home", "", true], ', '').replace('["shop", "#/shop/hookahs", true]', '["shop", "#/shop/hookahs", false]').replace('["home-empty", "", false]', '["home", "", false]')
open(p, 'w', encoding='utf8', newline='\n').write(t)
print('ok')
