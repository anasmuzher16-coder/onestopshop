# Loop step (2026-11-13 night): the benchmark seat's gap list, all seven items (his instruction: "Do all").
# gifts row + pages, hookah parts and in-the-box, build your set, "goes with this", sold state, visit block, search,
# plus its copy fixes. Address is a marked placeholder until Angel supplies it.
def sub(s, a, b, count=1):
    assert a in s, 'missing: ' + a[:80]
    return s.replace(a, b, count)

p = 'site/app.js'; s = open(p, encoding='utf8').read()

# ---------- state + helpers ----------
s = sub(s, 'const state = { whyOpen: false,', 'const state = { whyOpen: false, q: "", note: typeof store.get("note") === "string" ? store.get("note") : "", set: {},')
s = sub(s, 'const place = d => d.city ? d.city : d.fsa;', '''const place = d => d.city ? d.city : d.fsa;
const byName = n => PRODUCTS.find(p => p.name === n);
const SOLD = new Set(["Resin Bishop, Clear Blue"]); // mockup: one of the one-of-one stems has sold
const isSold = p => SOLD.has(p.name);
const inCat = c => PRODUCTS.filter(p => p.cat === c && !p.dark);
// Shop hours, Windsor time. [open, close] in 24h, Sunday first.
const HOURS = [[11, 19], [10, 21], [10, 21], [10, 21], [10, 21], [10, 21], [10, 21]], DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const h12 = h => (h % 12 || 12) + (h < 12 ? " am" : " pm");
function nowInWindsor() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "long", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: DAYS.indexOf(parts.weekday), t: (+parts.hour % 24) + +parts.minute / 60 };
}
function openLine() {
  const { day, t } = nowInWindsor(), [o, c] = HOURS[day], next = HOURS[(day + 1) % 7];
  return t >= o && t < c ? `Open now until ${h12(c)}` : t < o ? `Opens today at ${h12(o)}` : `Closed now. Opens ${DAYS[(day + 1) % 7]} at ${h12(next[0])}`;
}''')
s = sub(s, '''function addToCart(sku) {
  const l = state.cart.find(x => x.sku === sku);''', '''function addToCart(sku) {
  if (!bySku[sku] || isSold(bySku[sku])) return;
  const l = state.cart.find(x => x.sku === sku);''')
s = sub(s, '''  return `<span class="sticker ${big ? "sticker--big" : ""}" style="--r:${r}deg"><span class="sticker__v">${whole(p.price)}</span></span>`;''',
        '''  return `<span class="sticker ${big ? "sticker--big" : ""} ${isSold(p) ? "sticker--sold" : ""}" style="--r:${r}deg"><span class="sticker__v">${isSold(p) ? "Sold" : whole(p.price)}</span></span>`;''')

# ---------- home ----------
s = sub(s, '<a class="btn btn--ghost" href="#/shop">See everything</a>', '<a class="btn btn--ghost" href="#/shop">All ${PRODUCTS.length} pieces</a>')
s = sub(s, '<h2 class="h2">New this week</h2>', '<h2 class="h2">Counter picks</h2>')
s = sub(s, '<p class="lineup__note">A dozen hookahs from the shelf, tallest to shortest.</p>', '<p class="lineup__note">From the shelf, tallest to shortest.</p>')
s = sub(s, '<a class="btn" href="#/p/${resin[0].sku}">See the resin stems</a>', '<a class="btn" href="#/shop/hookahs">See what is left</a>')
s = sub(s, '''  <section class="lineup" aria-labelledby="lu-h">''', '''  <section class="gifts" aria-labelledby="gift-h">
    <header class="shelf__head"><h2 class="h2" id="gift-h">Gifts</h2><p class="gifts__note">Packed at the counter. Add a note in the cart.</p></header>
    <div class="gifts__row">
      ${[["under-50", "Under $50", "emerald", inCat("bowls")[0]], ["under-150", "Under $150", "cobalt", byName("Mamoun Moagza Copper")], ["set", "The full setup", "ruby", byName("Mamoun Kamanja Gold")]].map(([id, label, tone, lead]) =>
        `<a class="gift" data-tone="${tone}" href="${id === "set" ? "#/set" : "#/gifts/" + id}">${shot(lead, { small: true, use: "cat", cls: "gift__img" })}<span class="gift__name">${label}</span><span class="gift__sub">${id === "set" ? "Hookah, bowl, heat keeper, hose" : PRODUCTS.filter(p => !p.dark && (id === "under-50" ? p.price < 50 : p.price >= 50 && p.price <= 150)).length + " pieces"}</span></a>`).join("")}
    </div>
  </section>
  <section class="lineup" aria-labelledby="lu-h">''')
i = s.index('  <section class="pack">'); j = s.index('  </section>`;\n}\n\nfunction viewShop', i) + len('  </section>')
s = s[:j] + '''
  <section class="visit" aria-labelledby="visit-h">
    <div class="visit__main">
      <h2 class="h2 h2--xl" id="visit-h">Visit the counter.</h2>
      <p class="visit__now">${openLine()}</p>
      <dl class="visit__facts">
        <div><dt>Where</dt><dd>Windsor, Ontario <span class="visit__todo">Street address to be added</span></dd></div>
        <div><dt>Pick up</dt><dd>Order online, pick up at the counter the same day. Free.</dd></div>
        <div><dt>Call</dt><dd><a class="link" href="tel:+15192552222">519-255-2222</a></dd></div>
      </dl>
    </div>
    <table class="visit__hours"><caption class="sr">Opening hours</caption><tbody>${[1, 2, 3, 4, 5, 6, 0].map(d => `<tr ${d === nowInWindsor().day ? 'class="is-today"' : ""}><th scope="row">${DAYS[d]}</th><td class="num">${h12(HOURS[d][0])} to ${h12(HOURS[d][1])}</td></tr>`).join("")}</tbody></table>
  </section>''' + s[j:]

# ---------- shop ----------
s = sub(s, '<p class="shophead__n"><span class="num">${list.length}</span> items</p>', '<p class="shophead__n"><span class="num">${list.length}</span> pieces</p>')

# ---------- product page ----------
s = sub(s, "  const more = PRODUCTS.filter(x => x.cat === p.cat && x.sku !== sku && !x.dark).slice(0, 4);", '''  const more = PRODUCTS.filter(x => x.cat === p.cat && x.sku !== sku && !x.dark).slice(0, 4);
  const n = parseInt(p.sku.slice(-3), 10), nth = (c, k) => { const l = inCat(c); return l[(n + k) % l.length]; };
  const goes = p.cat === "hookahs" ? [nth("bowls", 0), nth("heat", 1), nth("hoses", 2), nth("parts", 3)] : [];
  const sold = isSold(p);''')
s = sub(s, '''      ${inCart ? `<a class="btn btn--wide" href="#/cart">In your cart. View cart</a>` : `<button class="btn btn--wide" type="button" data-add="${p.sku}">Add to cart</button>`}''',
        '''      ${sold ? `<p class="soldline">This one has sold. Each resin stem is poured once.</p><button class="btn btn--ghost btn--wide" type="button" data-notify>Tell me when the next one is poured</button>`
        : inCart ? `<a class="btn btn--wide" href="#/cart">In your cart. View cart</a>` : `<button class="btn btn--wide" type="button" data-add="${p.sku}">Add to cart</button>`}''')
s = sub(s, '<h2 class="h3" id="ways-h">Shipping estimate</h2>', '<h2 class="h3" id="ways-h">Shipping and pickup</h2>')
s = sub(s, '<h2 class="h3" id="spec-h">What ships</h2>', '<h2 class="h3" id="spec-h">Packed size</h2>')
s = sub(s, '''      <section class="spec" aria-labelledby="spec-h">''', '''      ${p.cat === "hookahs" ? `<section class="parts" aria-labelledby="parts-h">
        <h2 class="h3" id="parts-h">The parts</h2>
        <div class="parts__in">
          <svg class="parts__fig" viewBox="0 0 150 230" role="img" aria-label="Diagram of a hookah with six numbered parts" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
            <path d="M52 14h26l-5 20H57z"/><path d="M40 44c0 5 50 5 50 0"/><path d="M62 34v14M68 34v14"/>
            <path d="M62 48v84M68 48v84M58 72h14M58 100h14"/><path d="M56 132h18v10H56z"/><circle cx="50" cy="137" r="3.5"/>
            <path d="M74 137h9c16 0 22 14 18 30-3 13 6 22 22 20"/>
            <path d="M58 142c0 12-22 20-22 44 0 18 12 30 29 30s29-12 29-30c0-24-22-32-22-44"/><path d="M40 188h50" stroke-dasharray="3 4"/>
            <g class="parts__n" stroke="none" fill="currentColor" font-size="11" font-weight="600" text-anchor="middle">
              <text x="16" y="28">1</text><text x="16" y="50">2</text><text x="16" y="90">3</text><text x="16" y="141">4</text><text x="134" y="150">5</text><text x="16" y="200">6</text></g>
            <g stroke-width="1" opacity=".55"><path d="M24 24h26M24 46h14M24 86h36M24 137h20M126 146l-22 8M24 196h12"/></g>
          </svg>
          <ol class="parts__list">
            <li><b>Bowl.</b> Sits on top, under the heat keeper.</li><li><b>Tray.</b> Catches ash and holds the tongs.</li><li><b>Stem.</b> ${esc(p.note)}.</li>
            <li><b>Purge valve.</b> Clears the base in one breath out.</li><li><b>Hose port.</b> Takes any standard hose.</li><li><b>Base.</b> ${p.glass ? "Glass" : "Acrylic"}, holds the water.</li>
          </ol>
        </div>
        <h2 class="h3 parts__box">In the box</h2>
        <ul class="inbox">${[["1", "Stem"], ["1", p.glass ? "Glass base" : "Base"], ["1", "Tray"], ["1", "Bowl"], ["1", "Hose with handle"], ["1", "Tongs"], ["1 set", "Grommets"]].map(([q, t]) => `<li><span class="num">${q}</span>${t}</li>`).join("")}</ul>
        <p class="fine">Sample contents for the mockup. Each model lists its own at launch.</p>
      </section>` : ""}
      <section class="spec" aria-labelledby="spec-h">''')
s = sub(s, '''  ${more.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">More ${c.name.toLowerCase()}</h2>''',
        '''  ${goes.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">Goes with this</h2><a class="link" href="#/set">Build a set</a></header><div class="grid">${goes.map(card).join("")}</div></section>` : ""}
  ${more.length ? `<section class="shelf"><header class="shelf__head"><h2 class="h2">More ${c.name.toLowerCase()}</h2>''')
s = sub(s, '</div></section>` : ""}`;\n}\n\nfunction viewCart() {', '''</div></section>` : ""}`;
}

// ---------- gifts ----------
function viewGifts(kind) {
  const under = kind === "under-50", list = PRODUCTS.filter(p => !p.dark && (under ? p.price < 50 : p.price >= 50 && p.price <= 150)).sort((a, b) => b.price - a.price);
  return `
  <section class="shophead" data-tone="${under ? "emerald" : "cobalt"}">
    <h1 class="shophead__h">${under ? "Under $50" : "Under $150"}</h1>
    <p class="shophead__ar" lang="ar" dir="rtl" aria-hidden="true">&#x647;&#x62f;&#x627;&#x64a;&#x627;</p>
    <p class="shophead__n"><span class="num">${list.length}</span> gifts, packed at the counter</p>
  </section>
  <nav class="chips chips--on" aria-label="Gifts"><a href="#/gifts/under-50" ${under ? 'aria-current="page"' : ""}>Under $50</a><a href="#/gifts/under-150" ${!under ? 'aria-current="page"' : ""}>Under $150</a><a href="#/set">The full setup</a></nav>
  <div class="grid grid--shop">${list.map(card).join("")}</div>`;
}

// ---------- build a set ----------
const SLOTS = [["hookah", "hookahs", "The hookah"], ["bowl", "bowls", "A bowl"], ["heat", "heat", "A heat keeper"], ["hose", "hoses", "A hose"]];
function setPicks() { return SLOTS.map(([slot, cat]) => bySku[state.set[slot]] || (slot === "hookah" ? byName("Mamoun Kamanja Gold") : null) || inCat(cat)[0]); }
function setSummary() {
  const picks = setPicks(), lines = picks.map(product => ({ product, qty: 1 })), parcels = pack(lines), sum = picks.reduce((a, p) => a + p.price, 0);
  const q = state.dest ? quote(state.dest, parcels)[0] : null;
  return `
    <h2 class="h3">Your set</h2>
    <ul class="setlines">${picks.map(p => `<li><span>${esc(p.name)}</span><span class="num">${money(p.price)}</span></li>`).join("")}</ul>
    <dl class="totals">
      <div><dt>Ships as</dt><dd>${parcels.length} ${parcels.length === 1 ? "box" : "boxes"}, <span class="num">${parcels.reduce((a, b) => a + b.kg, 0).toFixed(1)} kg</span></dd></div>
      <div><dt>Shipping${q ? " to " + esc(state.dest.full) : ""}</dt><dd>${q ? `<span class="num">${money(q.total)}</span>` : `<button class="link" type="button" data-open-postal>Add postal code</button>`}</dd></div>
      <div class="totals__door"><dt>Set price</dt><dd class="num">${money(sum)}</dd></div>
    </dl>
    <button class="btn btn--wide" type="button" data-add-set>Add the set to cart</button>`;
}
function viewSet() {
  const picks = setPicks();
  return `
  <section class="shophead" data-tone="ruby">
    <h1 class="shophead__h">Build a set</h1>
    <p class="shophead__ar" lang="ar" dir="rtl" aria-hidden="true">&#x637;&#x642;&#x645;</p>
    <p class="shophead__n">Four picks. One box where it fits.</p>
  </section>
  <div class="set">
    <div class="set__steps">${SLOTS.map(([slot, cat, label], i) => `
      <section class="pick" aria-labelledby="pick-${slot}">
        <h2 class="h3" id="pick-${slot}"><span class="num">${i + 1}</span> ${label}</h2>
        <div class="pick__row" role="group" aria-label="${label}">${inCat(cat).map(p => `<button class="pick__opt" type="button" data-set="${slot}" data-sku="${p.sku}" aria-pressed="${picks[i].sku === p.sku}" data-tone="${toneOf(p)}"><span class="tile">${shot(p, { small: true, use: "thumb" })}</span><span class="pick__name">${esc(p.name)}</span><span class="num">${whole(p.price)}</span></button>`).join("")}</div>
      </section>`).join("")}</div>
    <aside class="set__sum" data-set-summary>${setSummary()}</aside>
  </div>`;
}

// ---------- search ----------
function searchResults() {
  const q = state.q.trim().toLowerCase(), words = q.split(/\\s+/).filter(Boolean);
  if (!words.length) return `<p class="lead">Try brass, steel, base, hose, or a name.</p>`;
  const hits = PRODUCTS.filter(p => { const hay = (p.name + " " + p.note + " " + catById[p.cat].name + " " + p.sku).toLowerCase(); return words.every(w => hay.includes(w)); });
  return hits.length ? `<p class="search__n"><span class="num">${hits.length}</span> ${hits.length === 1 ? "piece" : "pieces"}</p><div class="grid">${hits.slice(0, 40).map(card).join("")}</div>`
    : `<p class="lead">Nothing matches \\u201c${esc(state.q.trim())}\\u201d. Call the counter at <a class="link" href="tel:+15192552222">519-255-2222</a> and we will check the shelf.</p>`;
}
function viewSearch() {
  return `
  <section class="search">
    <h1 class="h2 h2--xl">Search</h1>
    <label class="field__label" for="q">Search all ${PRODUCTS.length} pieces</label>
    <input class="field field--text" id="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Brass, bowl, Sultan" value="${esc(state.q)}">
    <div class="search__out" data-search-out aria-live="polite">${searchResults()}</div>
  </section>`;
}

function viewCart() {''')

# ---------- cart ----------
s = sub(s, '<h1 class="h2 h2--xl">Nothing in the cart yet.</h1><p class="lead">Start with the <a class="link" href="#/shop/hookahs">hookahs</a>. Shipping is priced in the cart.</p>',
        '<h1 class="h2 h2--xl">Your cart is empty.</h1><p class="lead">Start with the <a class="link" href="#/shop/hookahs">hookahs</a>, the <a class="link" href="#/shop/bowls">bowls</a>, or <a class="link" href="#/set">build a set</a>.</p>')
s = sub(s, '<h2 class="h3">How it ships</h2>', '<h2 class="h3">How we pack it</h2>')
s = sub(s, 'data-open-postal>Add postal code to price shipping</button>', 'data-open-postal>Price shipping to my postal code</button>')
s = sub(s, '''    <dl class="totals">
      <div><dt>Items</dt>''', '''    <div class="giftnote"><label class="field__label" for="note">Gift note <span class="fine">optional, written on a card in the box</span></label>
      <textarea class="field field--text field--area" id="note" data-note maxlength="240" rows="2" placeholder="Happy birthday, from all of us">${esc(state.note)}</textarea></div>
    <dl class="totals">
      <div><dt>Items</dt>''')
s = sub(s, '''<button class="btn btn--wide" type="button" ${chosen ? "" : "disabled"}>Checkout</button>''', '''<button class="btn btn--wide" type="button" ${chosen ? "" : "disabled"}>Check out</button>''')
s = sub(s, '`Checkout <span class="num">${money(sub + ship.total)}</span>`', '`Check out <span class="num">${money(sub + ship.total)}</span>`')

# ---------- chrome ----------
s = sub(s, '''+ `<a href="#/shipping" ${h === "#/shipping" ? 'aria-current="page"' : ""}>Shipping</a>`;''', '''+ `<a href="#/set" ${h === "#/set" ? 'aria-current="page"' : ""}>Build a set</a><a href="#/search" ${h === "#/search" ? 'aria-current="page"' : ""}>Search</a>`;''')
s = sub(s, '  dock.classList.toggle("dock--buy", !!prod || (ra === "cart" && lines.length > 0));', '  dock.classList.toggle("dock--buy", !!prod || ra === "set" || (ra === "cart" && lines.length > 0));')
s = sub(s, '''        ? `<a class="dock__buy" href="#/cart">In cart. View cart</a>` : `<button class="dock__buy" type="button" data-add="${prod.sku}">Add to cart <span class="num">${whole(prod.price)}</span></button>`}<a class="dock__side" href="#/cart" aria-label="Cart">${count}</a>`''',
        '''        ? `<a class="dock__buy" href="#/cart">In your cart. View cart</a>` : isSold(prod) ? `<a class="dock__buy dock__buy--off" href="#/shop/hookahs">Sold. See what is left</a>` : `<button class="dock__buy" type="button" data-add="${prod.sku}">Add to cart <span class="num">${whole(prod.price)}</span></button>`}<a class="dock__side" href="#/cart" aria-label="Cart">${count}</a>`
    : ra === "set"
    ? `<a class="dock__side" href="#/shop">Shop</a><button class="dock__buy" type="button" data-add-set>Add the set <span class="num">${whole(setPicks().reduce((a, p) => a + p.price, 0))}</span></button><a class="dock__side" href="#/cart" aria-label="Cart">${count}</a>`''')
s = sub(s, '''`<a href="#/" ${h === "#/" ? 'aria-current="page"' : ""}>Home</a><a href="#/shop" ${h.startsWith("#/shop") ? 'aria-current="page"' : ""}>Shop</a><a href="#/cart"''',
        '''`<a href="#/" ${h === "#/" ? 'aria-current="page"' : ""}>Home</a><a href="#/shop" ${h.startsWith("#/shop") ? 'aria-current="page"' : ""}>Shop</a><a href="#/search" ${h === "#/search" ? 'aria-current="page"' : ""}>Search</a><a href="#/cart"''')
s = sub(s, '''  const q = e.target.closest("[data-qty]"); if (q) setQty(q.dataset.qty, +q.dataset.n);
});''', '''  const q = e.target.closest("[data-qty]"); if (q) setQty(q.dataset.qty, +q.dataset.n);
  const pk = e.target.closest("[data-set]");
  if (pk) { state.set[pk.dataset.set] = pk.dataset.sku; $$(`[data-set="${pk.dataset.set}"]`).forEach(b => b.setAttribute("aria-pressed", b === pk)); $("[data-set-summary]").innerHTML = setSummary(); syncChrome(); }
  if (e.target.closest("[data-add-set]")) { setPicks().forEach(p => addToCart(p.sku)); location.hash = "#/cart"; }
  const nt = e.target.closest("[data-notify]"); if (nt) { nt.textContent = "Noted. We will let you know."; nt.disabled = true; }
});
document.addEventListener("input", e => {
  if (e.target.id === "q") { state.q = e.target.value; $("[data-search-out]").innerHTML = searchResults(); }
  if (e.target.matches("[data-note]")) { state.note = e.target.value; store.set("note", state.note); }
});''')
s = sub(s, '''a === "shipping" ? viewShipping() : viewHome();''', '''a === "shipping" ? viewShipping() : a === "gifts" ? viewGifts(b) : a === "set" ? viewSet() : a === "search" ? viewSearch() : viewHome();''')
s = sub(s, '''  $("#main").focus({ preventScroll: true });
}''', '''  const sq = $("#q"); if (sq) sq.focus({ preventScroll: true }); else $("#main").focus({ preventScroll: true });
}''')
open(p, 'w', encoding='utf8', newline='\n').write(s)

p = 'site/index.html'; h = open(p, encoding='utf8').read()
h = sub(h, '<a href="#/">Home</a><a href="#/shop">Shop</a><a href="#/cart">', '<a href="#/">Home</a><a href="#/shop">Shop</a><a href="#/search">Search</a><a href="#/cart">')
open(p, 'w', encoding='utf8', newline='\n').write(h)

p = 'site/styles.css'; c = open(p, encoding='utf8').read()
c = sub(c, 'display:grid;grid-template-columns:1fr 1fr 1fr;height:calc(var(--bar-h)', 'display:grid;grid-template-columns:repeat(4,1fr);height:calc(var(--bar-h)')
c += '''
/* ================= benchmark additions (2026-11-13) ================= */
.sticker--sold .sticker__v{font-size:.82em} .sticker--sold .sticker__v::first-letter{font-size:1em;vertical-align:0;margin:0}
.soldline{margin:0 0 var(--s-3);color:var(--color-strong);font-weight:500}
.dock .dock__buy--off{background:var(--color-line);color:var(--color-text)}
.field--text{font:400 var(--t-16)/1.4 var(--font-ui);letter-spacing:0;text-transform:none}
.field--area{padding:var(--s-3) var(--s-4);min-height:72px;resize:vertical}

/* gifts */
.gifts{padding:var(--s-12) var(--gutter) 0}
.gifts__note{margin:0;font-size:var(--t-14);color:var(--color-muted)}
.gifts .shelf__head{flex-wrap:wrap}
.gifts__row{display:grid;gap:var(--s-2)}
.gift{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 34%;grid-template-rows:1fr auto auto;column-gap:var(--s-3);min-height:120px;padding:var(--s-3);background:var(--tile);color:var(--color-on-tile);text-decoration:none;border-radius:var(--radius);overflow:hidden}
.gift .gift__img{grid-column:2;grid-row:1 / 4;width:100%;height:100%;min-height:0;object-fit:contain;object-position:50% 100%}
.gift__name{grid-column:1;grid-row:2;font:400 1.9rem/1 var(--font-display);padding-top:.1em}
.gift__sub{grid-column:1;grid-row:3;font-size:var(--t-14);font-weight:500}
.gift:hover .gift__name{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.12em}
.chips--on{display:flex !important}

/* product page: parts + in the box */
.parts{margin-top:var(--s-8)}
.parts__in{display:grid;grid-template-columns:120px 1fr;gap:var(--s-4);align-items:start}
.parts__fig{width:100%;height:auto;color:var(--color-strong)}
.parts__list{margin:0;padding:0 0 0 1.4em;font-size:var(--t-14);display:grid;gap:var(--s-2)}
.parts__list li::marker{font-weight:600;color:var(--color-strong)}
.parts__list b{color:var(--color-strong);font-weight:600}
.parts__box{margin-top:var(--s-6)}
.inbox{list-style:none;margin:0 0 var(--s-2);padding:0;display:grid;grid-template-columns:1fr 1fr;font-size:var(--t-14)}
.inbox li{display:flex;gap:var(--s-3);padding:var(--s-2) 0;border-top:1px solid var(--color-line)}
.inbox .num{min-width:3.2em;color:var(--color-muted)}

/* build a set */
.set{display:grid;gap:var(--s-8);padding:var(--s-6) 0 var(--s-16)}
.pick{padding:0 0 var(--s-6)}
.pick .h3{padding:0 var(--gutter);display:flex;gap:var(--s-3);align-items:baseline}
.pick .h3 .num{font:400 1.5rem/1 var(--font-display);color:var(--color-muted)}
.pick__row{display:flex;gap:var(--s-2);padding:var(--s-1) var(--gutter);overflow-x:auto;scroll-snap-type:x proximity;scroll-padding-inline:var(--gutter);scrollbar-width:none}
.pick__row::-webkit-scrollbar{display:none}
.pick__opt{flex:0 0 132px;display:grid;gap:2px;justify-items:start;padding:0 0 var(--s-2);border:0;background:none;text-align:left;cursor:pointer;scroll-snap-align:start;font-size:var(--t-12);color:var(--color-muted)}
.pick__opt .tile{width:100%;margin-bottom:var(--s-2);box-shadow:inset 0 0 0 0 var(--color-strong);transition:box-shadow var(--dur-micro) var(--ease-state)}
.pick__opt[aria-pressed="true"] .tile{outline:3px solid var(--color-strong);outline-offset:-3px}
.pick__opt[aria-pressed="true"]{color:var(--color-strong)}
.pick__name{font-size:var(--t-14);font-weight:500;color:var(--color-strong);line-height:1.25}
.set__sum{padding:0 var(--gutter)}
.setlines{list-style:none;margin:0;padding:0;font-size:var(--t-14)}
.setlines li{display:flex;justify-content:space-between;gap:var(--s-4);padding:var(--s-3) 0;border-top:1px solid var(--color-line)}
.set__sum .totals{margin:0 0 var(--s-5)}

/* search */
.search{padding:var(--s-8) var(--gutter) var(--s-16);max-width:1440px;margin:0 auto}
.search .field{max-width:560px;margin-bottom:var(--s-6)}
.search__n{margin:0 0 var(--s-4);font-size:var(--t-14);color:var(--color-muted)}

/* cart gift note */
.giftnote{margin-top:var(--s-8)}
.giftnote .fine{font-weight:400;margin-left:var(--s-2)}

/* visit */
.visit{display:grid;gap:var(--s-6);padding:var(--s-12) var(--gutter) var(--s-16);border-top:1px solid var(--color-line)}
.visit__now{margin:var(--s-3) 0 var(--s-5);font:400 var(--t-d1)/1.05 var(--font-display);color:var(--gilt)}
.visit__facts{margin:0;display:grid}
.visit__facts>div{display:grid;grid-template-columns:72px 1fr;gap:var(--s-3);padding:var(--s-3) 0;border-top:1px solid var(--color-line)}
.visit__facts dt{color:var(--color-muted);font-size:var(--t-14)} .visit__facts dd{margin:0}
.visit__todo{display:block;font-size:var(--t-12);color:var(--color-muted)}
.visit__hours{width:100%;border-collapse:collapse;font-size:var(--t-14);align-self:end}
.visit__hours th{text-align:left;font-weight:400;color:var(--color-muted);padding:var(--s-2) 0;border-top:1px solid var(--color-line)}
.visit__hours td{text-align:right;padding:var(--s-2) 0;border-top:1px solid var(--color-line)}
.visit__hours .is-today th,.visit__hours .is-today td{color:var(--color-strong);font-weight:600}

@media (max-width:959px){.set__sum .btn--wide{display:none}}
@media (min-width:640px){.gifts__row{grid-template-columns:repeat(3,1fr)} .gift{min-height:200px;grid-template-columns:minmax(0,1fr) 44%}}
@media (min-width:960px){
  .gifts{padding-top:var(--s-24)}
  .gift{min-height:260px} .gift__name{font-size:2.6rem}
  .set{grid-template-columns:minmax(0,1fr) 380px;align-items:start;padding-top:var(--s-12)}
  .set__sum{position:sticky;top:100px;padding:0 var(--gutter) 0 0}
  .pick__opt{flex-basis:160px}
  .visit{grid-template-columns:minmax(0,6fr) minmax(0,4fr);gap:var(--s-16);padding-block:var(--s-24)}
  .parts__in{grid-template-columns:150px 1fr}
}
'''
open(p, 'w', encoding='utf8', newline='\n').write(c)
print('ok')
