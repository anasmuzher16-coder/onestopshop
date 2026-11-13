# Loop step (2026-11-13 night): design review of direction 2 (verdict REVISE). Applies its FIX list and the top
# ELEVATE items, inside his rulings (same direction, no ticker, professional headings).
#  - hero: the bar photo is replaced by the shop's own system: jewel slabs with hookahs standing on one line,
#    the giant word running across the slabs UNDER the packshots (multiply shows true colour through the letters)
#  - product page: full jewel stage, the sticker on it, a "True colour" switch (stage goes white, photo untouched)
#  - colour by series, shop grouped by series; category tiles stop covering the Arabic word; bilingual shop heads
#  - sticker gets a sheen and a raised dollar sign and travels in the page transition; favicon; small truths
import re
def sub(s, a, b, count=1):
    assert a in s, 'missing: ' + a[:80]
    return s.replace(a, b, count)
def between(s, a, b, new, include_b=False):
    i = s.index(a); j = s.index(b, i) + (len(b) if include_b else 0); return s[:i] + new + s[j:]

# ================= app.js =================
p = 'site/app.js'; s = open(p, encoding='utf8').read()
s = between(s, 'const TONES = [', 'const place = d =>', r'''const TONES = ["ember", "teal", "ruby", "cobalt", "gilt", "emerald"];
const SERIES = { Sultan: "ruby", Mamoun: "gilt", Cairo: "teal", Regent: "cobalt", Stuttgart: "emerald" };
const seriesOf = p => p.name.split(" ")[0] in SERIES ? p.name.split(" ")[0] : "";
// Colour is decided, not random: one jewel per series; everything else takes the next jewel along within its category.
const toneOf = p => p.dark ? "" : p.photo ? "bone" : SERIES[seriesOf(p)] || TONES[PRODUCTS.filter(x => x.cat === p.cat && !seriesOf(x)).indexOf(p) % TONES.length];
''')
s = between(s, 'function shot(p, {', '  const plain = p.dark || p.photo;', '''function shot(p, { small = false, eager = false, use = small ? "card" : "pdp", cls = "", alt = "" } = {}) {
''')
s = sub(s, '${p.photo ? "" : `sizes="${SIZES[use]}"`} alt=""', '${p.photo ? "" : `sizes="${SIZES[use]}"`} alt="${esc(alt)}"')
s = sub(s, 'thumb: "96px",', 'thumb: "96px", slab: "(min-width:960px) 20vw, 34vw",')
s = between(s, 'function sticker(p', 'function card(p', '''function sticker(p, { big = false } = {}) {
  const n = parseInt(p.sku.slice(-3), 10), r = ((n * 37) % 23) - 13; // -13..+9 degrees, fixed per product
  return `<span class="sticker ${big ? "sticker--big" : ""}" style="--r:${r}deg"><span class="sticker__v">${whole(p.price)}</span></span>`;
}

''')
# hero
i = s.index('  <section class="hero">'); j = s.index('  <section class="cats"', i)
s = s[:i] + '''  <section class="hero">
    <div class="hero__stage">
      <div class="hero__slabs" aria-hidden="true">${stars.map(p => `<span data-tone="${toneOf(p)}"></span>`).join("")}</div>
      <p class="hero__word" aria-hidden="true">Hookahs,</p>
      <div class="hero__pieces">${stars.map((p, i) => `<a class="piece" href="#/p/${p.sku}" style="--cm:${p.height};--i:${i}" aria-label="${esc(p.name)}, ${whole(p.price)}">${shot(p, { eager: true, use: "slab" })}${sticker(p)}</a>`).join("")}</div>
    </div>
    <div class="hero__in">
      <h1 class="hero__h"><span class="sr">Hookahs, </span>and everything that goes with them.</h1>
      <div class="hero__side">
        <p class="hero__p">Egyptian brass, German steel and hand\\u2011cut glass. In store in Windsor, shipped across Canada.</p>
        <div class="hero__cta"><a class="btn" href="#/shop/hookahs">Shop hookahs</a><a class="btn btn--ghost" href="#/shop">See everything</a></div>
      </div>
    </div>
  </section>
''' + s[j:]
s = sub(s, '  const resin = PRODUCTS.filter(p => p.dark);', '  const resin = PRODUCTS.filter(p => p.dark);\n  const stars = ["Mamoun Aten", "Regent Neon Blue", "Sultan Totem", "Stuttgart Pure, Jade", "Cairo Avatar"].map(n => PRODUCTS.find(p => p.name === n)).filter(Boolean);')
s = sub(s, 'A dozen hookahs from the shelf, drawn to scale.', 'A dozen hookahs from the shelf, tallest to shortest.')
# shop: grouped by series, bilingual head
s = between(s, 'function viewShop(cat) {', 'function viewProduct(sku) {', r'''function viewShop(cat) {
  const c = catById[cat] || null, list = c ? PRODUCTS.filter(p => p.cat === c.id) : PRODUCTS;
  const groups = cat === "hookahs" ? [...Object.keys(SERIES).map(k => [k, list.filter(p => seriesOf(p) === k)]), ["More from the shelf", list.filter(p => !seriesOf(p) && !p.dark)], ["One of one", list.filter(p => p.dark)]].filter(g => g[1].length) : [["", list]];
  return `
  <section class="shophead" data-tone="${c ? c.tone : "bone"}">
    <h1 class="shophead__h">${c ? c.name : "Everything"}</h1>
    <p class="shophead__ar" lang="ar" dir="rtl" aria-hidden="true">${c ? c.ar : "&#x643;&#x644; &#x634;&#x64a;"}</p>
    <p class="shophead__n"><span class="num">${list.length}</span> items</p>
  </section>
  <nav class="chips" aria-label="Categories"><a href="#/shop" ${!c ? 'aria-current="page"' : ""}>All</a>${CATEGORIES.map(x => `<a href="#/shop/${x.id}" ${c && c.id === x.id ? 'aria-current="page"' : ""}>${x.name}</a>`).join("")}</nav>
  <div class="grid grid--shop">${groups.map(([name, items]) => (name ? `<h2 class="series">${name} <span class="num">${items.length}</span></h2>` : "") + items.map(card).join("")).join("")}</div>`;
}

''')
# product page: jewel stage, sticker, true colour
i = s.index('    <div data-stage="${p.sku}" class="pdp__tile'); j = s.index('\n', i)
s = s[:i] + '''    <div data-stage="${p.sku}" class="pdp__tile tile ${p.dark || p.photo ? "tile--photo" : ""}">${shot(p, { eager: true, alt: p.name })}${sticker(p, { big: true })}${p.dark || p.photo ? "" : `<button class="truecolour" type="button" data-true aria-pressed="false">True colour</button>`}</div>''' + s[j:]
i = s.index('      <p class="pdp__price num">'); j = s.index('\n', i) + 1; s = s[:i] + s[j:]
s = s.replace('${b.l} x ${b.w} x ${b.h} cm', '${b.l} \\u00d7 ${b.w} \\u00d7 ${b.h} cm').replace('${p.l} x ${p.w} x ${p.h} cm', '${p.l} \\u00d7 ${p.w} \\u00d7 ${p.h} cm')
s = sub(s, "the carrier's rate", "the carrier\\u2019s rate")
s = sub(s, 'CATEGORIES.slice(0, 6).map(c =>', 'CATEGORIES.map(c =>')
# true colour switch + sticker travels
s = sub(s, '  const add = e.target.closest("[data-add]");', '''  const tc = e.target.closest("[data-true]");
  if (tc) { const on = tc.getAttribute("aria-pressed") !== "true"; tc.setAttribute("aria-pressed", on); tc.closest("[data-stage]").toggleAttribute("data-truecolour", on); }
  const add = e.target.closest("[data-add]");''')
s = sub(s, '''  const n = $(".tile", a) || a; n.style.viewTransitionName = "piece";''', '''  const n = $(".tile", a) || a; n.style.viewTransitionName = "piece";
  $$(".sticker").forEach(x => x.style.viewTransitionName = ""); const st = $(".sticker", a); if (st) st.style.viewTransitionName = "tag";''')
s = sub(s, '''  if (stage) stage.style.viewTransitionName = "piece";''', '''  if (stage) { stage.style.viewTransitionName = "piece"; const st = $(".sticker", stage); if (st) st.style.viewTransitionName = "tag"; }''')
s = sub(s, '''if (n) { n.style.viewTransitionName = "piece"; n.scrollIntoView({ block: "center" }); }''', '''if (n) { n.style.viewTransitionName = "piece"; const st = $(".sticker", back); if (st) st.style.viewTransitionName = "tag"; n.scrollIntoView({ block: "center" }); }''')
open(p, 'w', encoding='utf8', newline='\n').write(s)

# ================= index.html =================
p = 'site/index.html'; h = open(p, encoding='utf8').read()
i = h.index('<link rel="preload" as="image" imagesrcset="img/wide-bar-phone'); j = h.index('\n', i) + 1; h = h[:i] + h[j:]
h = sub(h, '<link rel="stylesheet" href="tokens.css">', '''<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23d9291c'/%3E%3Cpath d='M32 12v40M41 23c-2-4-6-5-10-5-6 0-10 3-10 8 0 12 21 5 21 16 0 5-5 8-11 8-5 0-9-2-11-6' fill='none' stroke='%23fff' stroke-width='5.5' stroke-linecap='round' transform='rotate(-10 32 32)'/%3E%3C/svg%3E">
<link rel="stylesheet" href="tokens.css">''')
open(p, 'w', encoding='utf8', newline='\n').write(h)

# ================= styles.css =================
p = 'site/styles.css'; c = open(p, encoding='utf8').read()
c = sub(c, 'body{margin:0;', 'body{margin:0;min-height:100svh;display:flex;flex-direction:column;')
c = sub(c, '#main{outline:none}', '#main{outline:none;flex:1}\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}')
c = re.sub(r'\.shipto\{display:none\}\n', '', c)
c = sub(c, 'min-width:24px;height:24px;padding:0 6px;border-radius:12px;', 'min-width:24px;height:24px;padding:0 6px;border-radius:var(--radius);')
# sticker: an object, not a red disc
c = sub(c, 'border-radius:50%;background:var(--color-sticker);color:var(--color-on-sticker);', 'border-radius:50%;background:radial-gradient(circle at 34% 28%,oklch(0.65 0.21 31),var(--color-sticker) 62%);color:var(--color-on-sticker);')
c = sub(c, '.sticker__v{font:400 1.7rem/1 var(--font-display);padding-top:.1em;font-variant-numeric:tabular-nums}', '.sticker__v{font:400 1.7rem/1 var(--font-display);padding-top:.1em;font-variant-numeric:tabular-nums}\n.sticker__v::first-letter{font-size:.62em;vertical-align:.42em;margin-right:.04em}\n.card__a:active .sticker,.piece:active .sticker{transform:rotate(var(--r,-8deg)) scale(.94)}')
c = re.sub(r'\.sticker--ask\{[^\n]*\n\.sticker--ask [^\n]*\n', '', c)
c = re.sub(r'\.slap \.sticker[^\n]*\n@keyframes slap\{[^\n]*\n', '@keyframes slap{from{transform:rotate(calc(var(--r,-8deg) + 22deg)) scale(1.5);opacity:0}}\n', c)
# hero
c = between(c, '/* ---------- hero ---------- */', '/* ---------- category blocks', '''/* ---------- hero: the counter. Jewel slabs, hookahs standing on one line, the word under the packshots ---------- */
.hero{padding:0 0 var(--s-8)}
.hero__stage{position:relative;isolation:isolate;container-type:inline-size;height:max(280px,calc(100svh - 440px));overflow:hidden}
.hero__slabs,.hero__pieces{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr)}
.hero__slabs span{background:var(--tile)}
.hero__slabs span:nth-child(n+4),.hero__pieces .piece:nth-child(n+4){display:none}
.hero__word{position:absolute;left:var(--gutter);bottom:-.07em;margin:0 0 0 -.045em;font:400 calc((100cqw - 2 * var(--gutter)) * .262)/.8 var(--font-display);letter-spacing:-.02em;color:var(--color-strong);white-space:nowrap}
.piece{position:relative;display:grid;align-items:end;justify-items:center;text-decoration:none;min-width:0}
.piece .shot{height:calc(var(--cm) / 96 * 100cqh);width:100%;object-fit:contain;object-position:50% 100%;animation:rise var(--dur-reveal) var(--ease-enter) both;animation-delay:calc(var(--i) * 70ms)}
.piece .sticker{top:var(--s-3);right:var(--s-2);bottom:auto;width:54px;height:54px;animation:slap var(--dur-reveal) var(--ease-enter) both;animation-delay:calc(420ms + var(--i) * 70ms)}
.piece .sticker__v{font-size:1.2rem}
.piece:focus-visible{outline-offset:-4px}
@keyframes rise{from{transform:translateY(28px);opacity:0}}
@supports not (height:1cqh){.piece .shot{height:92%}}
.hero__in{display:grid;gap:var(--s-4);padding:var(--s-5) var(--gutter) 0}
.hero__h{font:400 var(--t-d1)/1.02 var(--font-display);color:var(--color-strong);margin:0;max-width:15ch;text-wrap:balance}
.hero__p{max-width:34ch;margin:0 0 var(--s-4);font-size:var(--t-16);color:var(--color-text)}
.hero__cta{display:grid;grid-template-columns:1fr 1fr;gap:var(--s-2)}
.hero__cta .btn{padding:0 var(--s-3)}

''')
c = between(c, '  .hero{min-height:min(88svh,860px)', '  .hero__p{font-size:var(--t-18)}', '''  .hero{padding-bottom:var(--s-12)}
  .hero__stage{height:max(360px,calc(100svh - 360px))}
  .hero__slabs,.hero__pieces{grid-template-columns:repeat(5,1fr)}
  .hero__slabs span:nth-child(n+4),.hero__pieces .piece:nth-child(n+4){display:block}
  .hero__pieces .piece:nth-child(n+4){display:grid}
  .piece .sticker{width:76px;height:76px;top:var(--s-5);right:var(--s-5)} .piece .sticker__v{font-size:1.6rem}
  .hero__in{grid-template-columns:1fr auto;align-items:end;column-gap:var(--s-16);padding-top:var(--s-8)}
  .hero__h{font-size:var(--t-d2);line-height:.95;max-width:16ch}
  .hero__side{max-width:380px}
  .hero__cta .btn{padding:0 var(--s-6)}
  .hero__p{font-size:var(--t-18)}''', include_b=True)
c = c.replace('''  .pdp{grid-template-columns:1fr 1fr} .pdp__tile{height:calc(100svh - 150px)}
  .hero{min-height:0;padding-top:var(--s-6)}''', '''  .pdp{grid-template-columns:1fr 1fr} .pdp__tile{height:calc(100svh - 150px)}
  .hero__stage{height:calc(100svh - 150px)} .hero__slabs,.hero__pieces{grid-template-columns:repeat(5,1fr)}
  .hero__slabs span:nth-child(n+4){display:block} .hero__pieces .piece:nth-child(n+4){display:grid}''')
# category tiles: Arabic and picture stop fighting
i = c.index('.cat{position:relative;isolation:isolate;'); j = c.index('.cat:hover .cat__name')
c = c[:i] + '''.cat{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) 42%;grid-template-rows:1fr auto;column-gap:var(--s-2);min-height:156px;padding:var(--s-3);
  background:var(--tile);color:var(--color-on-tile);text-decoration:none;overflow:hidden;border-radius:var(--radius)}
.cat:first-child{grid-column:1 / -1;min-height:220px}
.cat__ar{grid-column:1;grid-row:1;align-self:start;justify-self:start;font-size:2.1rem;line-height:1.15;opacity:.6}
.cat:first-child .cat__ar{font-size:4rem}
.cat .cat__img{grid-column:2;grid-row:1 / 3;position:static;width:100%;height:100%;min-height:0;object-fit:contain;object-position:50% 100%;mix-blend-mode:multiply}
.cat__name{grid-column:1;grid-row:2;font:400 1.5rem/1 var(--font-display);padding-top:.12em}
.cat:first-child .cat__name{font-size:2.6rem}
.cat__n{position:absolute;top:var(--s-3);right:var(--s-3);font-size:var(--t-12);font-weight:600}
''' + c[j:]
c = sub(c, '  .cat:first-child .cat__ar{font-size:13rem} .cat:first-child .cat__name{font-size:4.5rem}', '  .cat:first-child .cat__ar{font-size:7.5rem} .cat:first-child .cat__name{font-size:4.5rem}')
c = sub(c, '  .cat__ar{font-size:5rem} .cat__name{font-size:2.2rem}', '  .cat__ar{font-size:3.2rem} .cat__name{font-size:2.2rem}')
# line-up on phones: more of them per screen
c = sub(c, '.lineup{isolation:isolate;--lu-h:300px;', '.lineup{isolation:isolate;--lu-h:230px;')
# shelf, resin, shop head, series rows
c = sub(c, '.shelf{padding:var(--s-12) var(--gutter) 0}', '.shelf{padding:var(--s-12) var(--gutter) 0}\n.pdp + .shelf{padding-bottom:var(--s-16)}\n.series{grid-column:1 / -1;display:flex;justify-content:space-between;align-items:baseline;margin:var(--s-6) 0 0;padding-top:var(--s-3);border-top:1px solid var(--color-line);font:400 var(--t-d1)/1 var(--font-display);color:var(--color-strong)}\n.series:first-child{margin-top:0}\n.series .num{font:500 var(--t-14)/1 var(--font-ui);color:var(--color-muted)}')
c = sub(c, '.resin__ar{margin:0;font-size:var(--t-d1);color:var(--teal)}', '.resin__ar{margin:0;font-size:var(--t-d1);color:var(--gilt);text-align:left}')
i = c.index('.shophead{'); j = c.index('.reading .shophead__ar')
c = c[:i] + '''.shophead{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;column-gap:var(--s-4);padding:var(--s-8) var(--gutter) var(--s-5);background:var(--tile);color:var(--color-on-tile);overflow:hidden}
.shophead__h{font:400 var(--t-d3)/.86 var(--font-display);margin:0;padding-top:.08em}
.shophead__ar{margin:0;font-size:var(--t-d3);line-height:1}
.shophead__n{flex-basis:100%;margin:var(--s-2) 0 0;font-size:var(--t-14);font-weight:500}
''' + c[j:]
c = sub(c, '.reading .shophead__ar{color:var(--gilt);opacity:1}', '.reading .shophead__ar{color:var(--gilt);font-size:var(--t-d1);text-align:left}')
# product stage: the jewel carries through; true colour; sticker
c = sub(c, 'height:min(105vw,52svh);background:color-mix(in oklch,var(--tile,var(--color-raised)) 38%,var(--white))}', 'height:min(105vw,52svh);background:var(--tile,var(--color-raised));transition:background-color var(--dur-state) var(--ease-state)}\n.pdp__tile[data-truecolour]{background:var(--white)}\n.pdp__tile .sticker{top:var(--s-4);right:var(--s-4);bottom:auto;width:92px;height:92px} .pdp__tile .sticker__v{font-size:2rem}\n.truecolour{position:absolute;left:var(--s-3);bottom:var(--s-3);min-height:44px;padding:0 var(--s-4);border:0;border-radius:var(--radius);background:var(--ink);color:var(--white);font-size:var(--t-14);font-weight:500;cursor:pointer}\n.truecolour[aria-pressed="true"]{background:var(--white);color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}')
c = re.sub(r'\.sticker--big\{[^\n]*\n\.sticker--big \.sticker__v[^\n]*\n', '', c)
c = re.sub(r'  \.sticker--big\{[^\n]*\n', '  .pdp__tile .sticker{width:150px;height:150px;top:var(--s-8);right:var(--s-8)} .pdp__tile .sticker__v{font-size:3.1rem}\n  .truecolour{left:var(--s-8);bottom:var(--s-8)}\n', c)
c = re.sub(r'  \.shipto\{[^\n]*\n  \.shipto__k[^\n]*\n', '', c)
c = sub(c, '.top__nav a[aria-current]{color:var(--color-strong);box-shadow:0 2px 0 var(--ember)}', '.top__nav a[aria-current]{color:var(--color-strong);box-shadow:0 2px 0 var(--color-strong)}')
c = sub(c, '  .chips{top:76px}', '  .chips{display:none}')
c = sub(c, '.h2--xl{', '.h2--xl{letter-spacing:-.01em;')
c += '::view-transition-group(tag){animation-duration:.5s;animation-timing-function:var(--ease-enter)}\n@media (prefers-reduced-motion:reduce){.piece .shot,.piece .sticker{animation:none}}\n'
open(p, 'w', encoding='utf8', newline='\n').write(c)

p = 'site/tokens.css'; t = open(p, encoding='utf8').read()
t = sub(t, '   Idea: THE PRICE LANDS AT YOUR DOOR. Device: THE STICKER (a counter price sticker carrying the delivered price).', '   Idea: THE COUNTER, ONLINE. Device: THE STICKER (the counter price sticker, set by hand on every piece).')
open(p, 'w', encoding='utf8', newline='\n').write(t)
print('ok')
