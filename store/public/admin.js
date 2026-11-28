// Back office screens: sign in, Today (shop numbers), Stock (the inventory), Orders. Plain modules, no framework.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (cents, whole = false) => (cents < 0 ? "−$" : "$") + (Math.abs(cents) / 100).toLocaleString("en-CA", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
const main = $("#main"), sheet = $("[data-sheet]"), toastEl = $("[data-toast]");
let toastT; const toast = msg => { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => toastEl.hidden = true, 2600); };

async function api(path, opts = {}) {
  const init = { method: opts.method || "GET", headers: {}, credentials: "same-origin" };
  if (opts.body !== undefined) { init.headers["X-OSS-Admin"] = "1"; if (opts.raw) { init.headers["Content-Type"] = opts.type; init.body = opts.body; } else { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); } }
  const r = await fetch("/api/admin" + path, init), data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/login") { state.in = false; gate(); throw new Error("signed out"); }
  if (!r.ok) throw Object.assign(new Error(data.error || "That did not work. Try again."), { data, status: r.status });
  return data;
}
const state = { in: false, tab: "home", products: [], categories: [], boxes: [], orders: [], finMore: null, openCut: false, found: null, oq: "", selecting: false, osel: new Set(), todayShown: 25, q: "", cat: "all", oflt: "todo", me: { actor: "", owner: false }, smode: "adjust", recvRef: "", counted: new Set(), month: null, ownerGate: (() => { try { return localStorage.getItem("oss:gate") !== "staff"; } catch { return true; } })() };   // this device remembers how it last signed in; a new device starts with the owner passcode
const opKey = () => crypto.randomUUID();   // one key per tap: a repeat of the same tap counts once
const who = a => a === "owner" ? "Owner" : a === "store" ? "Website" : a === "seed" ? "Setup" : String(a || "").replace(/ #\d+$/, "");
const catOf = id => state.categories.find(c => c.id === id) || { name: id, tone: "bone" };
const thumbSrc = p => p.photo_ver ? `/api/photo/${p.sku}?v=${p.photo_ver}` : p.img ? `img/pc/${p.img}${p.img_dark ? "" : "-s"}.webp` : /"charcoal":true/.test(p.details || "") ? "img/pc/coming-charcoal.svg" : "";   // charcoal with no photo yet: the drawn stand-in
const thumb = (p, tone) => { const src = thumbSrc(p); return src ? `<img class="thumb" data-tone="${esc(tone)}" src="${esc(src)}" alt="" loading="lazy" width="52" height="64">` : `<span class="thumb" data-tone="${esc(tone)}"></span>`; };
const when = iso => { const d = new Date(iso), now = new Date(), days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  const t = d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }); return days === 0 ? "Today " + t : days === 1 ? "Yesterday " + t : d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }); };

// ---------- sign in ----------
function gate() {
  $("[data-tabs]").hidden = true; $("[data-end]").hidden = true;
  $("[data-office]").hidden = true;
  const owner = state.ownerGate;
  main.innerHTML = `<form class="gate" data-login novalidate>
    <p class="meta">One Stop Shop</p><h1 class="h1">Back office</h1>
    ${owner ? `<label class="field"><span>Owner passcode</span><input class="input" id="passcode" name="passcode" type="password" autocomplete="current-password" required></label>`
      : `<label class="field"><span>Your name</span><input class="input" id="staffname" name="staffname" autocomplete="username" autocapitalize="words" spellcheck="false" maxlength="30" required></label>
    <label class="field"><span>PIN, 6 digits</span><input class="input input--pin num" id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" required></label>`}
    <p class="err" role="alert" data-err></p>
    <button class="btn" type="submit">Sign in</button>
    <button class="gate__swap" type="button" data-gate-swap>${owner ? "Sign in with your name and PIN" : "Owner? Use the passcode"}</button></form>`;
  $(owner ? "#passcode" : "#staffname").focus();
}
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-login]"); if (!f) return; e.preventDefault();
  const btn = $('button[type="submit"]', f); btn.disabled = true;
  try { await api("/login", { method: "POST", body: state.ownerGate ? { passcode: f.passcode.value } : { name: f.staffname.value, pin: f.pin.value } }); state.in = true; try { localStorage.setItem("oss:gate", state.ownerGate ? "owner" : "staff"); } catch {} await boot(); }
  catch (err) { $("[data-err]", f).textContent = err.message; btn.disabled = false; if (f.pin) { f.pin.value = ""; f.pin.focus(); } }
});

// ---------- Today ----------
// New pickup requests, first and by name (2026-11-27): while the shop's mail is not connected no new-order note reaches anyone, so
// this list is how staff learn of a request. Newest first; each row opens the order. With mail off it says to call the customer.
// Every request to confirm is listed (breaker, 2026-11-27: a newest-25 list let junk push real requests out of sight). A long list
// scrolls in its own box and shows 25 at a time with "Show more"; nothing is dropped without saying so.
function confirmList(s) {
  const list = s.confirm || [], n = Math.max((s.todo && s.todo.to_confirm) || 0, list.length);
  if (!n) return "";
  const shown = list.slice(0, state.todayShown), left = list.length - shown.length;
  return `<section class="wide" data-confirmlist><h2 class="h2"><b class="num">${n}</b> new pickup ${n === 1 ? "request" : "requests"} to confirm</h2>
    <p class="fineprint">${s.mail_on ? "Check the shelf, then mark each one ready: that emails the customer to come in." : "The shop's email is not connected, so customers get no email from us. Check the shelf, mark it ready, then call or text the customer at the number on the order."}</p>
    <div class="rows" data-confirmrows style="max-height:70vh;overflow-y:auto">${shown.map(o => `<button class="row order" type="button" data-order="${esc(o.id)}"><span class="row__main"><span class="row__name">${esc(o.name)}</span><span class="row__meta">${esc(o.id)} &middot; ${when(o.created_at)} &middot; ${esc(o.units)} ${o.units === 1 ? "item" : "items"}${o.phone ? ` &middot; ${esc(o.phone)}` : ""}</span></span><span class="order__r"><b class="num">${money(o.total_cents)}</b><span class="state go">To confirm</span></span></button>`).join("")}</div>
    <p class="fineprint">Showing <b class="num" data-confirmshown>${shown.length}</b> of ${n}.${left > 0 ? ` <button class="chip" type="button" data-moreconfirm>Show ${Math.min(100, left)} more</button>` : ""} ${n > 5 ? `<button class="chip" type="button" data-go="orders:todo">Find or clear junk in Orders</button>` : ""}</p>
    ${s.confirm_cut || n > list.length ? `<p class="remind" data-confirmcut><b>Not all ${n} could be listed here.</b> Use Find in Orders, or clear junk requests there.</p>` : ""}</section>`;
}
function viewHome(s) {
  const t = s.totals, aov = t.month_orders ? t.month_cents / t.month_orders : 0;
  const wk = t.prev_week_cents ? Math.round((t.week_cents - t.prev_week_cents) / t.prev_week_cents * 100) : null;
  const byDay = Object.fromEntries(s.daily.map(d => [d.day, d])), days = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - 5 * 36e5 - i * 864e5).toISOString().slice(0, 10); days.push({ day: d, cents: byDay[d]?.cents || 0 }); }
  const max = Math.max(1, ...days.map(d => d.cents)), fmt = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
  const todo = s.todo, low = s.low.length, pmax = Math.max(1, ...s.provinces.map(p => p.orders));
  const need = (n, label, hint, go) => `<button class="need ${n ? "" : "zero"}" type="button" data-go="${go}"><b class="num">${n || 0}</b><span>${label}</span><em>${n ? hint : "All clear"}</em></button>`;
  const whole = money(t.today_cents).slice(1).split(".");
  return `<div class="today">
    <section class="hero wide"><p class="meta">${new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}<span class="sample">Sample numbers</span></p>
      <h1 class="hero__fig num"><sup>$</sup>${whole[0]}</h1>
      <p class="hero__sub">sold today across ${t.today_orders} ${t.today_orders === 1 ? "order" : "orders"}</p></section>
    <section class="wide trio">
      <div><p class="meta">7 days</p><b class="num">${money(t.week_cents, true)}</b><small>${wk === null ? `${t.week_orders} orders` : `<span class="${wk >= 0 ? "up" : "down"}">${wk >= 0 ? "Up" : "Down"} ${Math.abs(wk)}%</span> on the week before`}</small></div>
      <div><p class="meta">30 days</p><b class="num">${money(t.month_cents, true)}</b><small>${t.month_orders} orders</small></div>
      <div><p class="meta">Average sale</p><b class="num">${money(aov, true)}</b><small>last 30 days</small></div>
    </section>
    ${confirmList(s)}
    <section><h2 class="h2">Needs you</h2><div class="needs">
      ${need(todo.to_confirm, todo.to_confirm === 1 ? "pickup request to confirm" : "pickup requests to confirm", "Check the shelf, mark ready", "orders:todo")}
      ${need(todo.to_pack, todo.to_pack === 1 ? "order to pack" : "orders to pack", "Open orders", "orders:todo")}
      ${need(todo.to_ship, todo.to_ship === 1 ? "packed order to send" : "packed orders to send", "Open orders", "orders:todo")}
      ${need(todo.waiting_pickup, "waiting for pickup", todo.pickup_overdue ? `${todo.pickup_overdue} waiting 3 days or more` : "Open orders", "orders:todo")}
      ${need(low, low === 1 ? "product low or out" : "products low or out", "Open stock", "stock:low")}
      ${need(needCount(), needCount() === 1 ? "item needs info" : "items need info", "Price, colours, stock", "stock:needs")}</div></section>
    <section><h2 class="h2">Sales, last 30 days</h2>
      <div class="chart" role="img" aria-label="Daily sales for the last 30 days. Best day ${money(max, true)}.">${days.map((d, i) => `<i style="--h:${Math.round(d.cents / max * 100)};--i:${i}" class="${i === 29 ? "now" : i >= 23 ? "wk" : ""}" title="${fmt(d.day)}: ${money(d.cents, true)}"></i>`).join("")}</div>
      <div class="chart__ax"><span>${fmt(days[0].day)}</span><span>Best day ${money(max, true)}</span><span>Today</span></div></section>
    <div class="wide cols">
      <section><h2 class="h2">Best sellers</h2><table class="ledger"><thead><tr><th scope="col">30 days</th><th scope="col" class="r">Sold</th><th scope="col" class="r">Sales</th></tr></thead>
        <tbody>${s.top.map(p => `<tr><td>${esc(p.name)}</td><td class="r num">${p.qty}</td><td class="r num">${money(p.cents, true)}</td></tr>`).join("") || `<tr><td colspan="3">No sales yet.</td></tr>`}</tbody></table></section>
      <section><h2 class="h2">Not moving</h2><table class="ledger"><thead><tr><th scope="col">In stock, no sale in 30 days</th><th scope="col" class="r">On hand</th><th scope="col" class="r">Tied up</th></tr></thead>
        <tbody>${s.slow.map(p => `<tr><td>${esc(p.name)}</td><td class="r num">${p.stock}</td><td class="r num">${money(p.stock * p.price_cents, true)}</td></tr>`).join("") || `<tr><td colspan="3">Everything in stock has sold this month.</td></tr>`}</tbody></table></section>
      <section><h2 class="h2">Where orders go</h2>${s.provinces.map(p => `<div class="prov"><b>${esc(p.province || "?")}</b><span style="--w:${Math.round(p.orders / pmax * 100)}"></span><i class="num" style="font-style:normal;text-align:right">${p.orders}</i></div>`).join("")}</section>
      <section><h2 class="h2">Shipping and stock</h2><dl class="facts">
        <div><dt>Shipping charged to customers</dt><dd class="num">${money(s.shipping.collected)}</dd></div>
        <div><dt>Paid for labels</dt><dd class="num">${money(s.shipping.paid)}</dd></div>
        <div><dt>Difference over ${s.shipping.parcels} parcels</dt><dd class="num ${s.shipping.collected - s.shipping.paid >= 0 ? "up" : "down"}">${money(s.shipping.collected - s.shipping.paid)}</dd></div>
        <div><dt>Units on the shelf</dt><dd class="num">${s.value.units} across ${s.value.products} products</dd></div>
        <div><dt>Stock at cost</dt><dd class="num">${money(s.value.cost_cents, true)}</dd></div>
        <div><dt>Stock at shelf price</dt><dd class="num">${money(s.value.retail_cents, true)}</dd></div></dl>
        <p class="fineprint" style="margin-top:var(--s-4)"><a href="/api/admin/backup" download>Download a backup</a> of every product, order and stock change, as one file.</p></section>
    </div></div>`;
}

// ---------- Stock ----------
const stockState = p => p.stock <= 0 ? ["out", "Out"] : p.stock <= p.low_stock_at ? ["low", "Low"] : ["ok", "In stock"];
function stockRow(p) {
  const c = catOf(p.category_id), [k, label] = stockState(p);
  return `<div class="row ${p.active ? "" : "off"}" data-sku="${p.sku}">${thumb(p, c.tone)}
    <button class="row__main" type="button" data-edit="${p.sku}"><span class="row__name">${esc(p.name)}</span><span class="row__meta">${p.sku} &middot; ${esc(c.name)}${p.active ? "" : " &middot; hidden"}${p.sample ? " &middot; made-up sample" : ""}${!p.photo_ver && /"photo":"coming"/.test(p.details || "") ? " &middot; photo coming" : ""}</span></button>
    <span class="row__price num">${money(p.price_cents)}</span>
    <span class="state ${k}" data-state>${label}</span>
    <span class="step"><button type="button" data-step="-1" aria-label="One fewer ${esc(p.name)}" ${p.stock <= 0 ? "disabled" : ""}>&minus;</button><output class="num" aria-label="In stock">${p.stock}</output><button type="button" data-step="1" aria-label="One more ${esc(p.name)}">+</button></span></div>`;
}
function stockList() {
  const q = state.q.trim().toLowerCase();
  return state.products.filter(p => (state.cat === "all" || (state.cat === "needs" ? !!p.needs : state.cat === "low" ? p.active && p.stock <= p.low_stock_at : p.category_id === state.cat)) && (!q || (p.name + " " + p.sku).toLowerCase().includes(q)));
}
// Count and Receive: one number per row, typed on the phone's number pad. Enter (Next) saves the row and moves to the
// next one, so a shelf can be counted without lifting a thumb off the keypad.
function tallyRow(p) {
  const c = catOf(p.category_id), count = state.smode === "count", done = count && state.counted.has(p.sku);
  return `<div class="row tally ${p.active ? "" : "off"}" data-sku="${p.sku}">${thumb(p, c.tone)}
    <span class="row__main"><span class="row__name">${esc(p.name)}</span><span class="row__meta">${p.sku} &middot; <span data-was>${count ? "On record" : "Now"} <b class="num">${p.stock}</b></span></span><span class="tally__say" data-say aria-live="polite">${done ? "Counted" : ""}</span></span>
    <label class="tally__box"><span class="sr">${count ? "Counted on the shelf" : "Arrived"}, ${esc(p.name)}</span>${count ? "" : `<span class="tally__plus" aria-hidden="true">+</span>`}<input class="tally__in num" data-tally inputmode="numeric" pattern="[0-9]*" enterkeyhint="next" autocomplete="off" maxlength="5" data-seen="${p.stock}"></label></div>`;
}
const modeChip = (id, label) => `<button class="seg__b" type="button" data-smode="${id}" aria-pressed="${state.smode === id}">${label}</button>`;
const MODE_HELP = { adjust: "", count: "Type what is on the shelf and press Next. The difference is saved as a count, with your name.", receive: "Type how many came in and press Next. Each one is added and saved with your name." };
function viewStock() {
  const list = stockList(), chip = (id, label) => `<button class="chip" type="button" data-cat="${id}" aria-pressed="${state.cat === id}">${esc(label)}</button>`, tally = state.smode !== "adjust";
  const progress = state.smode === "count" ? `<p class="tally__progress num" data-progress>${state.counted.size} counted this session</p>` : "";
  return `<div class="tools"><div class="tools__head"><h1 class="h1">Stock</h1><div class="seg" role="group" aria-label="What you are doing">${modeChip("adjust", "Adjust")}${modeChip("count", "Count")}${modeChip("receive", "Receive")}</div></div>
    ${tally ? `<p class="tools__help">${MODE_HELP[state.smode]}</p>` : state.cat === "needs" ? `<p class="tools__help">Items in the store still missing their price, colours or shelf count. Tap one, fill in what you know, and Save and next opens the one after.</p>` : ""}
    ${state.smode === "receive" ? `<label class="field tools__ref"><span>Delivery note or invoice number, optional</span><input class="input" id="recvref" value="${esc(state.recvRef)}" maxlength="60" autocomplete="off"></label>` : ""}
    <div class="tools__top"><input class="input" id="q" type="search" placeholder="Search stock" value="${esc(state.q)}" aria-label="Search stock">${tally || !state.me.owner ? "" : `<button class="btn" type="button" data-new>Add product</button>`}</div>
    <div class="chips" role="group" aria-label="Section">${chip("all", "All " + state.products.length)}${chip("needs", "Needs info " + needCount())}${chip("low", "Low or out")}${state.categories.map(c => chip(c.id, c.name)).join("")}</div>${progress}</div>
    <div class="rows" data-rows>${rowsHtml(list)}</div>`;
}
const rowsHtml = list => list.map(state.smode !== "adjust" ? tallyRow : state.cat === "needs" ? needRow : stockRow).join("") || `<p class="empty">${state.cat === "needs" && !state.q.trim() ? "Every item on view has its price, colours and shelf count." : "Nothing matches. Clear the search or pick another section."}</p>`;
async function saveTally(input) {
  const row = input.closest("[data-sku]"), p = state.products.find(x => x.sku === row.dataset.sku), say = $("[data-say]", row), raw = input.value.trim();
  if (input.dataset.busy) return true;
  if (raw === "") { if (state.smode === "count" && !state.counted.has(p.sku)) { say.textContent = "Not counted"; say.className = "tally__say skip"; } return true; }
  if (!/^\d{1,5}$/.test(raw)) { say.textContent = "Numbers only"; say.className = "tally__say bad"; return false; }
  const n = +raw, count = state.smode === "count";
  if (!count && n === 0) { input.value = ""; return true; }
  input.dataset.busy = "1"; say.textContent = "Saving"; say.className = "tally__say";
  try {
    const op = input.dataset.op || (input.dataset.op = opKey());
    const r = count ? await api(`/products/${p.sku}/count`, { method: "POST", body: { counted: n, seen: +input.dataset.seen, op } })
      : await api(`/products/${p.sku}/receive`, { method: "POST", body: { qty: n, ref: state.recvRef, op } });
    p.stock = r.stock; delete input.dataset.op; input.dataset.seen = r.stock;
    if (count) { state.counted.add(p.sku); const d = r.delta; say.textContent = d === null || d === undefined ? "Counted" : d === 0 ? "Counted, matches" : `Counted, ${d > 0 ? "+" : "−"}${Math.abs(d)}`; say.className = "tally__say " + (d ? "diff" : "ok"); input.value = ""; const pg = $("[data-progress]"); if (pg) pg.textContent = `${state.counted.size} counted this session`; }
    else { say.textContent = `+${n} in, now ${r.stock}`; say.className = "tally__say ok"; input.value = ""; }
    $("[data-was] b", row).textContent = r.stock;
    return true;
  } catch (er) {
    if (er.status && er.status < 500) delete input.dataset.op;   // a lost answer keeps its key: tapping again cannot add the delivery twice
    if (er.data && typeof er.data.stock === "number") { p.stock = er.data.stock; input.dataset.seen = er.data.stock; $("[data-was] b", row).textContent = er.data.stock;  }
    say.textContent = er.message; say.className = "tally__say bad"; return false;
  } finally { delete input.dataset.busy; }
}
function editSheet(p) {
  const isNew = !p, d = p ? JSON.parse(p.details || "{}") : {}, c = p ? catOf(p.category_id) : state.categories[0];
  p = p || { name: "", category_id: c.id, price_cents: "", cost_cents: "", weight_g: "", box_id: "S", ship_class: "standard", note: "", low_stock_at: 1, active: 1, glass: 0, stock: 0 };
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`, dol = c => c === "" || c === null || c === undefined ? "" : (c / 100).toFixed(2);
  sheet.innerHTML = `<form class="sheet__in" data-product="${isNew ? "" : p.sku}" novalidate>
    <div class="sheet__top"><div><p class="meta">${isNew ? "New product" : p.sku}</p><h2 class="h2" style="margin:0">${isNew ? "Add a product" : esc(p.name)}</h2></div><button class="sheet__x" type="button" data-close>Close</button></div>
    ${isNew ? "" : `<div class="photo">${thumb(p, c.tone).replace('width="52" height="64"', 'width="96" height="120"')}<div><p>Take or choose a photo. Plain background, the whole piece in frame.</p><label class="btn btn--ghost">Change photo<input type="file" accept="image/*" data-photo hidden></label></div></div>`}
    ${isNew ? "" : `<button class="btn btn--ghost" type="button" data-info="${p.sku}">Fill in name, colours, stock and price</button>`}
    <label class="field"><span>Name</span><input class="input" name="name" value="${esc(p.name)}" maxlength="80" required></label>
    <div class="grid2"><label class="field"><span>Section</span><select class="input" name="category_id">${state.categories.map(x => opt(x.id, x.name, p.category_id)).join("")}</select></label>
      <label class="field"><span>Price, $</span><input class="input num" name="price" inputmode="decimal" value="${dol(p.price_cents)}" required ${state.me.owner ? "" : 'readonly aria-describedby="price-who"'}></label></div>
    ${state.me.owner ? "" : `<p class="fineprint" id="price-who">Prices are set by the owner. Everything else here you can change.</p>`}
    <label class="field"><span>Description, one line</span><input class="input" name="note" value="${esc(p.note)}" maxlength="200"></label>
    ${p.family ? `<label class="field"><span>Colour name, as customers see it</span><input class="input" name="variant_label" value="${esc((() => { try { return JSON.parse(p.details || "{}").colour || ""; } catch { return ""; } })())}" placeholder="${esc(p.variant_label || "")}" maxlength="40"></label>` : ""}
    <div data-cologne ${p.category_id === "cologne" ? "" : "hidden"}><div class="grid2"><label class="field"><span>Size, mL</span><input class="input num" name="ml" inputmode="numeric" value="${esc(d.ml ?? "")}"></label>
      <label class="field"><span>Kind</span><input class="input" name="kind" value="${esc(d.kind ?? "")}" placeholder="Eau de parfum"></label></div>
      <label class="field" style="margin-top:var(--s-3)"><span>Scent notes</span><input class="input" name="notes" value="${esc(d.notes ?? "")}" maxlength="120" placeholder="Saffron, rose, oud"></label></div>
    <div class="grid2"><label class="field"><span>Weight, grams</span><input class="input num" name="weight_g" inputmode="numeric" value="${esc(p.weight_g)}" required></label>
      <label class="field"><span>Ships in</span><select class="input" name="box_id">${state.boxes.map(b => opt(b.id, `${b.label} (${b.l_cm} x ${b.w_cm} x ${b.h_cm} cm)`, p.box_id)).join("")}</select></label></div>
    <label class="field"><span>How it can ship</span><select class="input" name="ship_class">${opt("standard", "Any service", p.ship_class)}${opt("ground_only", "Ground only (cologne, anything flammable)", p.ship_class)}${opt("pickup_only", "Pickup or local delivery only (never shipped)", p.ship_class)}</select></label>
    <div class="grid2"><label class="field"><span>Your cost, $ (private)</span><input class="input num" name="cost" inputmode="decimal" value="${dol(p.cost_cents)}" ${state.me.owner ? "" : 'readonly aria-describedby="price-who"'}></label>
      <label class="field"><span>Warn me at</span><input class="input num" name="low_stock_at" inputmode="numeric" value="${esc(p.low_stock_at)}"></label></div>
    ${isNew ? `<label class="field"><span>How many on the shelf now</span><input class="input num" name="stock" inputmode="numeric" value="0"></label>` : ""}
    <label class="check"><input type="checkbox" name="glass" ${p.glass ? "checked" : ""}> Glass, pack with care</label>
    ${p.sample ? `<p class="fineprint">A made-up sample from the demo, not the shop's stock, so it stays hidden from the store. Add the real item as a new product.</p>` : `<label class="check"><input type="checkbox" name="active" ${p.active ? "checked" : ""}> Show in the store</label>`}
    <p class="err" role="alert" data-err></p>
    <div class="sheet__act"><button class="btn" type="submit">${isNew ? "Add product" : "Save"}</button><button class="btn btn--ghost" type="button" data-close>Cancel</button></div>
    ${isNew ? "" : `<section><h3 class="meta" style="margin-bottom:var(--s-2)">Stock history</h3><div class="hist" data-hist><div><span>Loading</span></div></div></section><section><h3 class="meta" style="margin-bottom:var(--s-2)">Edits</h3><div class="hist" data-changes><div><span>None yet.</span></div></div></section>`}</form>`;
  sheet.showModal();
  if (!isNew) api(`/products/${p.sku}/history`).then(r => { const h = $("[data-hist]", sheet); if (h) h.innerHTML = r.moves.map(m => `<div><span>${esc(MOVE[m.reason] ? MOVE[m.reason](m) : m.reason)}, ${esc(who(m.actor))}, ${when(m.at)}</span><b class="num">${m.delta > 0 ? "+" : ""}${m.delta}</b></div>`).join("") || `<div><span>No changes yet.</span></div>`;
    const c = $("[data-changes]", sheet); if (c && r.changes && r.changes.length) c.innerHTML = trailHtml(r.changes); }).catch(() => {});
}
const MOVE = { count: m => m.delta ? "Counted" : "Counted, matched", received: m => "Received" + (m.ref ? ` (${m.ref})` : ""), sale: m => `Sold, order ${m.ref || ""}`, released: m => /^W/.test(m.ref || "") ? `Back from cancelled order ${m.ref}` : "Put back", correction: () => "Adjusted", damaged: () => "Damaged", return: () => "Returned" };
const cents = v => { const n = Math.round(parseFloat(String(v).replace(/[$,\s]/g, "")) * 100); return Number.isFinite(n) ? n : null; };
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-product]"); if (!f) return; e.preventDefault();
  const sku = f.dataset.product, err = $("[data-err]", f), price = cents(f.price.value);
  if (!f.name.value.trim()) return err.textContent = "Give it a name.";
  if (price === null || price < 0) return err.textContent = "Enter the price as dollars, like 49.99.";
  if (!(parseInt(f.weight_g.value, 10) > 0)) return err.textContent = "Enter the weight in grams. A kitchen scale is fine.";
  const body = { name: f.name.value, category_id: f.category_id.value, price_cents: price, cost_cents: f.cost.value.trim() === "" ? null : cents(f.cost.value), weight_g: parseInt(f.weight_g.value, 10), box_id: f.box_id.value,
    ship_class: f.ship_class.value, note: f.note.value, ...(f.variant_label ? { variant_label: f.variant_label.value } : {}), low_stock_at: parseInt(f.low_stock_at.value, 10) || 0, glass: f.glass.checked, ...(f.active ? { active: f.active.checked } : {}),   // a sample has no switch (it stays off)
    details: f.category_id.value === "cologne" ? { ml: parseInt(f.ml.value, 10) || null, kind: f.kind.value, notes: f.notes.value } : {} };
  if (!sku) body.stock = parseInt(f.stock.value, 10) || 0;
  const btn = $('button[type="submit"]', f); btn.disabled = true;
  try { await api(sku ? `/products/${sku}` : "/products", { method: sku ? "PUT" : "POST", body }); sheet.close(); await loadProducts(); render(); toast(sku ? "Saved. The store is updated." : "Added to the store."); }
  catch (er) { err.textContent = er.message; btn.disabled = false; }
});
document.addEventListener("change", async e => {
  if (e.target.name === "category_id" && e.target.closest("[data-product]")) { const on = e.target.value === "cologne", f = e.target.form; $("[data-cologne]", f).hidden = !on; if (on && f.ship_class.value === "standard") f.ship_class.value = "ground_only"; return; }
  if (!e.target.matches("[data-photo]") || !e.target.files[0]) return;
  const sku = e.target.closest("[data-product]").dataset.product;
  try {
    const bmp = await createImageBitmap(e.target.files[0]), k = Math.min(1, 900 / Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    let blob = await new Promise(r => cv.toBlob(r, "image/webp", 0.82)); if (!blob || blob.type !== "image/webp") blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
    await api(`/products/${sku}/photo`, { method: "POST", body: blob, raw: true, type: blob.type });
    await loadProducts(); const p = state.products.find(x => x.sku === sku); $(".photo .thumb", sheet).src = thumbSrc(p); render(); toast("Photo updated.");
  } catch (er) { toast(er.message || "That photo could not be read."); }
});

// ---------- Item editor: name, colours, shelf count, price ----------
// The shop fills in what it knows for each item on its own phone, instead of sending a sheet (owner, 2026-11-26). Only
// what is typed or picked is sent; a field left alone stays as it is, and nothing is ever filled in for them.
const needCount = () => state.products.filter(p => p.needs).length;
const NEED = { price: "price", colours: "colours", stock: "shelf count", check: "a check of its name", length: "its length", weight: "weight" };
// A weight as the shop types it: a number in the unit picked (g or kg), or with its unit typed ("1.2 kg"). Sent as "<n> <unit>";
// the server turns it into whole grams and refuses anything outside 1 g to 30 kg (src/catalog.js weightGrams).
const readWeight = (raw, unit) => { const m = String(raw).trim().toLowerCase().replace(",", ".").match(/^(\d{1,5})(?:\.(\d{1,3}))?\s*(g|kg)?$/); if (!m) return null; const u = m[3] || unit; if (u === "g" && m[2] !== undefined) return null; return { n: m[1] + (m[2] !== undefined ? "." + m[2] : ""), unit: u, typed: !!m[3], g: u === "kg" ? +m[1] * 1000 + +(m[2] || "").padEnd(3, "0") : +m[1] }; };   // whole grams, or kg to 3 places, as the server takes it
const isCoal = p => p.category_id === "charcoal" || /^charcoal-/.test(p.family || "") || pj(p.details).charcoal === true;
const needWords = n => { const w = n.map(k => NEED[k]); return w.length > 1 ? w.slice(0, -1).join(", ") + " and " + w.at(-1) : w[0]; };
function needRow(p) {
  const c = catOf(p.category_id);
  return `<div class="row row--need ${p.active ? "" : "off"}" data-sku="${p.sku}">${thumb(p, c.tone)}
    <button class="row__main" type="button" data-info="${p.sku}"><span class="row__name">${esc(p.name)}</span><span class="row__meta">${p.sku} &middot; ${esc(c.name)}</span><span class="state lack">Needs ${needWords(p.needs)}</span></button>
    <button class="bar__link" type="button" data-info="${p.sku}" aria-label="Fill in ${esc(p.name)}">Fill in</button></div>`;
}
// Common hookah colours. Clear and Rainbow are drawn by CSS (a check pattern, a colour wheel).
const PALETTE = [["Black", "#141414"], ["Silver", "#c3c5c9"], ["Gold", "#c9a24a"], ["Rose gold", "#c48b7f"], ["Red", "#c2262e"], ["Blue", "#2b59c3"], ["Green", "#2e8b57"], ["Purple", "#6c3fa6"], ["Pink", "#e58bb4"], ["White", "#f3f1ea"], ["Clear", ""], ["Rainbow", ""], ["Gunmetal", "#4b5057"], ["Bronze", "#8a5a2b"]];
const swatch = (name, hex, on, custom) => `<button class="sw" type="button" data-sw data-name="${esc(name)}"${custom && hex ? ` data-hex="${esc(hex)}"` : ""} aria-pressed="${on}"><i class="sw__dot${name === "Clear" && !custom ? " sw__dot--clear" : name === "Rainbow" && !custom ? " sw__dot--rainbow" : ""}"${hex ? ` style="background:${esc(hex)}"` : ""}></i><span>${esc(name)}</span></button>`;
const pickedColours = f => $$("[data-sw][aria-pressed=true]", f).map(b => b.dataset.hex ? { name: b.dataset.name, hex: b.dataset.hex } : { name: b.dataset.name });
function colourCount(f) { const n = pickedColours(f).length, o = $("[data-colcount]", f); if (o) o.textContent = n ? `${n} picked` : "none picked"; }
function infoSheet(p) {
  if (!p) return;
  const d = pj(p.details), had = Array.isArray(d.colours) ? d.colours : [], hexes = d.colour_hex || {}, c = catOf(p.category_id), owner = state.me.owner;
  const known = new Set(PALETTE.map(x => x[0].toLowerCase())), custom = had.filter(n => !known.has(n.toLowerCase()));
  const queue = state.products.filter(x => x.needs), at = queue.findIndex(x => x.sku === p.sku), counted = p.availability === "counted";
  const hookahRow = /^(ace|hose|bowl|hookah)-/.test(p.family || "");   // one colour of a hookah, or of one of the shop's hoses or bowls
  const check = (p.needs || []).includes("check"), d0 = pj(p.details), lenRow = (p.needs || []).includes("length") || typeof d0.length === "string";
  sheet.innerHTML = `<form class="sheet__in info" data-info-form="${p.sku}" data-orig="${esc(JSON.stringify(had))}" novalidate>
    <div class="sheet__top"><div><p class="meta">${p.sku}${at >= 0 ? ` &middot; ${at + 1} of ${queue.length} to fill in` : ""}</p><h2 class="h2" style="margin:0">${esc(p.name)}</h2></div><button class="sheet__x" type="button" data-close>Close</button></div>
    <div class="photo">${thumb(p, c.tone).replace('width="52" height="64"', 'width="96" height="120"')}<div><p data-stillneed>${p.needs ? `Still needed: ${needWords(p.needs)}.` : "Everything is filled in. Change anything that is not right."}</p><p class="fineprint">Fill in what you know and leave the rest. Only what you change is saved, with your name.</p></div></div>
    <label class="field"><span>Name</span><input class="input" name="name" value="${esc(p.name)}" maxlength="80" autocomplete="off" required></label>
    ${check ? `<fieldset class="cols-pick"><legend class="field__l">${/^hose-/.test(p.family || "") ? "Name and length" : "Name"}</legend><p class="fineprint">Not sure yet: ${esc(p.check_why || "matched by best guess")}. Fix the name above if it is wrong, then tick this.${p.family ? " Each colour is ticked on its own." : ""}</p>
      <label class="field"><span><input type="checkbox" name="checked"> Checked with the shop</span></label></fieldset>` : ""}
    ${lenRow ? `<label class="field"><span>Length, as the shop says it</span><input class="input" name="length" value="${esc(d0.length || "")}" maxlength="30" autocomplete="off" placeholder="60.5 inches"></label>` : ""}
    <fieldset class="cols-pick"><legend class="field__l">Colours <span class="num" data-colcount></span></legend>
      <p class="fineprint">${hookahRow ? `This is one colour of this ${p.category_id === "hookahs" ? "hookah" : "item"}. Pick its colour; for two tones, pick both.` : "Tap every colour the shop has of this item."}</p>
      <div class="sw-grid" data-swgrid>${PALETTE.map(([n, h]) => swatch(n, h, had.some(x => x.toLowerCase() === n.toLowerCase()), false)).join("")}${custom.map(n => swatch(n, Object.hasOwn(hexes, n) && /^#[0-9a-f]{6}$/i.test(hexes[n]) ? hexes[n] : "", true, true)).join("")}</div>
      <button class="bar__link" type="button" data-addcol aria-expanded="false" aria-controls="newcol">Add another colour</button>
      <div class="newcol" id="newcol" data-newcol hidden><label class="field"><span>Colour name</span><input class="input" name="newcol" maxlength="24" autocomplete="off"></label>
        <label class="field newcol__pick"><span>Swatch</span><input class="newcol__hex" name="newhex" type="color" value="#808080"></label><button class="btn btn--ghost" type="button" data-addcol-go>Add</button></div></fieldset>
    ${(() => { const g = p.weight_known_g || 0, unit = g >= 1000 || (!g && /^(ace|hookah)-/.test(p.family || "")) ? "kg" : "g", v = !g ? "" : unit === "kg" ? String(+(g / 1000).toFixed(3)) : String(g), need = (p.needs || []).includes("weight");
      return `<div class="field"><label class="field" for="info-weight"><span>Weight</span></label><div class="wrow"><input class="input num" id="info-weight" name="weight" inputmode="decimal" autocomplete="off" value="${v}" placeholder="${unit === "kg" ? "1.2" : "250"}" data-was="${g || ""}" aria-describedby="weight-say">
        <div class="wunit" role="radiogroup" aria-label="Weight unit">${["g", "kg"].map(u => `<label><input type="radio" name="wunit" value="${u}"${u === unit ? " checked" : ""}><span>${u}</span></label>`).join("")}</div></div>
        <p class="fineprint" id="weight-say">${isCoal(p) ? "Charcoal is never shipped, whatever it weighs. This is for the record." : need ? "Needed before it can ship. Weigh the item on its own; the box is added for you." : g ? "Weighed. Type a new weight to change it." : "Weigh the item on its own; the box is added for you. Up to 30 kg."}</p></div>`; })()}
    <div class="grid2 info__nums">
      <div class="field"><label class="field" for="info-stock"><span>Stock, on the shelf</span></label><input class="input num" id="info-stock" name="stock" inputmode="numeric" pattern="[0-9]*" maxlength="5" autocomplete="off" value="${counted ? p.stock : ""}" data-seen="${p.stock}" data-was="${counted ? p.stock : ""}" aria-describedby="stock-was">
        <p class="fineprint" id="stock-was">${counted ? "Counted. Type a new count to change it." : "Not counted yet. Type what is on the shelf, 0 if none."}</p></div>
      <div class="field"><label class="field" for="info-price"><span>Price, $ CAD</span></label><input class="input num" id="info-price" name="price" inputmode="decimal" autocomplete="off" value="${p.price_cents > 0 ? (p.price_cents / 100).toFixed(2) : ""}" ${owner ? 'aria-describedby="price-say"' : 'readonly aria-describedby="price-say"'}>
        <p class="fineprint" id="price-say">${!owner ? "Prices are set by the owner." : p.price_cents > 0 ? "In dollars, like 24.99." : `In dollars, like 24.99. A price puts it on sale${p.listed && !p.active ? ", in place of Price TBD" : ""}.`}</p></div></div>
    <p class="err" role="alert" data-err></p><p class="remind" data-saved aria-live="polite"></p>
    <div class="sheet__act"><button class="btn" type="submit" data-then="stay">Save</button>${queue.some(x => x.sku !== p.sku) ? `<button class="btn btn--ghost" type="submit" data-then="next">Save and next</button>` : ""}</div></form>`;
  colourCount($("[data-info-form]", sheet));
  if (!sheet.open) sheet.showModal();
}
function addColour() {
  const f = $("[data-info-form]", sheet), name = f.newcol.value.replace(/\s+/g, " ").trim(), err = $("[data-err]", f);
  if (!/^\p{L}[\p{L} &/'-]{0,23}$/u.test(name)) { err.textContent = "Give the colour a name, letters only, up to 24."; f.newcol.focus(); return; }
  const same = $$("[data-sw]", f).find(b => b.dataset.name.toLowerCase() === name.toLowerCase());
  if (same) same.setAttribute("aria-pressed", "true"); else $("[data-swgrid]", f).insertAdjacentHTML("beforeend", swatch(name, f.newhex.value, true, true));
  err.textContent = ""; f.newcol.value = ""; f.newhex.value = "#808080"; colourCount(f); f.newcol.focus();
}
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.name === "newcol") { e.preventDefault(); addColour(); } });
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-info-form]"); if (!f) return; e.preventDefault();
  const sku = f.dataset.infoForm, p = state.products.find(x => x.sku === sku), err = $("[data-err]", f), said = $("[data-saved]", f), then = e.submitter?.dataset.then || "stay";
  err.textContent = ""; said.textContent = ""; $$("[aria-invalid]", f).forEach(i => i.removeAttribute("aria-invalid"));
  const body = {}, name = f.name.value.trim(), stock = f.stock.value.trim(), price = f.price.value.trim().replace(/^\$\s*/, "").replace(/,/g, "");
  if (!name) { err.textContent = "Give it a name."; return f.name.focus(); }
  if (name !== p.name) body.name = name;
  if (f.checked && f.checked.checked) body.checked = true;
  if (f.length && f.length.value.trim() && f.length.value.trim() !== (pj(p.details).length || "")) body.length = f.length.value.trim();
  if (f.weight && f.weight.value.trim() !== "") {
    const w = readWeight(f.weight.value, (f.querySelector("input[name=wunit]:checked") || {}).value || "g");
    if (!w || !(w.g >= 1) || w.g > 30000) { err.textContent = "Weight is a number in grams or kilograms, like 250 g or 1.2 kg, up to 30 kg."; f.weight.setAttribute("aria-invalid", "true"); return f.weight.focus(); }
    if (w.unit === "g" && w.g < 10 && !w.typed) { err.textContent = `${w.g} g is very light. If you meant kilograms, tap kg. If it really is ${w.g} g, type it as ${w.g} g.`; f.weight.setAttribute("aria-invalid", "true"); return f.weight.focus(); }
    if (String(w.g) !== f.weight.dataset.was) body.weight = `${w.n} ${w.unit}`;
  }
  const picked = pickedColours(f), orig = JSON.parse(f.dataset.orig);
  if (picked.map(c => c.name.toLowerCase()).sort().join("|") !== orig.map(n => n.toLowerCase()).sort().join("|")) body.colours = picked;
  if (stock !== "" && stock !== f.stock.dataset.was) { if (!/^\d{1,5}$/.test(stock)) { err.textContent = "Stock is a whole number, like 4. Type 0 if there are none."; f.stock.setAttribute("aria-invalid", "true"); return f.stock.focus(); } body.stock = { counted: +stock, seen: +f.stock.dataset.seen }; }
  if (state.me.owner && price !== "") {
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(price) || !(+price > 0) || +price > 50000) { err.textContent = "Enter the price in dollars, like 24.99."; f.price.setAttribute("aria-invalid", "true"); return f.price.focus(); }
    const c = Math.round(+price * 100); if (c !== p.price_cents) body.price_cents = c;
  }
  if (!Object.keys(body).length) { if (then === "next") return nextInfo(sku); said.textContent = "Nothing changed yet."; return; }
  const btns = $$("button[type=submit]", f); btns.forEach(b => b.disabled = true); said.textContent = "Saving";
  try {
    const r = await api(`/products/${sku}/info`, { method: "PUT", body });
    await loadProducts(); render();
    const q = state.products.find(x => x.sku === sku);
    if (then === "next") { toast(`Saved ${q.name}.`); return nextInfo(sku); }
    infoSheet(q);
    const s2 = $("[data-saved]", sheet); s2.innerHTML = `<b>Saved${r.on_sale && body.price_cents ? ", now on sale" : ""}.</b> The store is updated.`;
  } catch (er) {
    // an order changed the stock while counting: nothing was saved. The typed fields stay; only the number counted against is new
    if (er.data && er.data.changed) { await loadProducts(); render(); const q = state.products.find(x => x.sku === sku); f.stock.dataset.seen = q.stock; f.stock.dataset.was = ""; f.stock.value = ""; f.stock.setAttribute("aria-invalid", "true"); $("#stock-was", f).innerHTML = `On record now: <b class="num">${q.stock}</b>. Count again.`; err.textContent = er.message; said.textContent = ""; btns.forEach(b => b.disabled = false); f.stock.focus(); return; }
    err.textContent = er.message; said.textContent = ""; btns.forEach(b => b.disabled = false);
  }
});
// the next item still needing info, in list order after this one (going round to the top); done when none is left
function nextInfo(sku) {
  const all = state.products, i = all.findIndex(x => x.sku === sku), after = [...all.slice(i + 1), ...all.slice(0, i)].find(x => x.needs);
  if (after) return infoSheet(after);
  sheet.close(); toast("Every item has its info. Thank you.");
}

// ---------- Orders ----------
const ORDER_STATE = { pending: ["done", "Not paid"], paid: ["go", "To pack"], packed: ["go", "Packed, to send"], ready: ["go", "Ready for pickup"], shipped: ["done", "Shipped"], collected: ["done", "Collected"], cancelled: ["out", "Cancelled"], refunded: ["out", "Refunded"] };
const isLocal = o => o.ship_service === "Local delivery";
const holdEnded = o => o.pay_method === "at_pickup" && o.pay_status === "expired";   // an unpaid counter order whose hold ran out (src/pay.js expirePickups)
// toConfirm: a pickup request (2026-11-27). It holds nothing until staff check the shelf and mark it ready, which takes the stock.
const toConfirm = o => !!o.to_confirm;
const stateLabel = o => holdEnded(o) ? "Lapsed, unpaid" : toConfirm(o) ? "To confirm: check the shelf" : o.status === "pending" && o.pay_status === "pay_at_pickup" ? "Pay at pickup, to get ready" : o.status === "pending" && o.pay_status === "awaiting" ? "Waiting for card payment" : isLocal(o) && o.status === "packed" ? "Packed, to deliver" : isLocal(o) && o.status === "shipped" ? "Out for delivery" : ORDER_STATE[o.status][1];
const dropInfo = o => { let a = {}; try { a = JSON.parse(o.address || "{}"); } catch {} const where = a.line1 ? `${a.line1}, ${a.city}, ${a.province} ${a.postal}` : ""; let q = {}; try { q = JSON.parse(o.ship_quote || "{}"); } catch {} return `${q.confirm_address ? `<div><dt>Check first</dt><dd>Priced from the postal code. Call to confirm the address before driving.</dd></div>` : ""}${a.note ? `<div><dt>Note</dt><dd>${esc(a.note)}</dd></div>` : ""}`; };
// Address and phone first and large: this is what gets read and tapped from a phone on the way out the door.
const dropCard = o => {
  let a = {}, q = {}; try { a = JSON.parse(o.address || "{}"); } catch {} try { q = JSON.parse(o.ship_quote || "{}"); } catch {}
  if (!a.line1 && !o.phone) return "";
  const where = a.line1 ? `${a.line1}, ${a.city}, ${a.province} ${a.postal}` : "", from = isLocal(o) && Number.isFinite(q.metres) ? `Road distance: ${(q.metres / 1000).toFixed(1)} km` : "";
  const title = o.method === "pickup" ? "Picking up" : isLocal(o) ? "Deliver to" : "Ship to";
  return `<section class="drop" aria-label="${title}"><p class="meta">${title}</p>
    ${a.line1 ? `<p class="drop__addr">${esc(a.line1)}<br>${esc(a.city)}, ${esc(a.province)} ${esc(a.postal)}</p>` : ""}${from ? `<p class="drop__from">${from}</p>` : ""}
    <div class="drop__act">${o.phone ? `<a class="btn${o.method === "pickup" ? " btn--ghost" : ""}" href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ""))}">Call ${esc(o.phone)}</a>` : ""}${where ? `<a class="btn btn--ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}" target="_blank" rel="noopener">Open in Maps</a>` : ""}</div></section>`;
};
const waitDays = o => o.status === "ready" && (o.ready_at || o.updated_at) ? Math.floor((Date.now() - Date.parse(o.ready_at || o.updated_at)) / 864e5) : 0;
const REASON = { no_show: "Not picked up", customer: "Customer asked", other: "Other" };
const pj = s => { try { return JSON.parse(s || "{}") || {}; } catch { return {}; } };
const FIELD = { stock: "shelf count", price_cents: "price", cost_cents: "cost", low_stock_at: "warning level", category_id: "section", ship_class: "shipping", note: "description", weight_g: "weight", box_id: "box" };
const ACTION = { "order.status": a => `Marked ${(pj(a.after).status || "").replace("ready", "ready for pickup")}`, "order.cancel": a => `Cancelled: ${(REASON[pj(a.after).reason] || "").toLowerCase()}`, "order.id_check": a => pj(a.after).checked ? "ID checked" : "ID tick removed",
  "product.edit": a => `Edited ${Object.keys(pj(a.after)).map(k => FIELD[k] || k.replace(/_/g, " ")).join(", ")}`, "product.create": () => "Added to the store", "product.info": a => `Filled in ${Object.keys(pj(a.after)).filter(k => k !== "active").map(k => FIELD[k] || k.replace(/_/g, " ")).join(", ")}${pj(a.after).active ? ", now on sale" : ""}`, "product.photo": () => "New photo",
  "order.refund": a => `Refunded ${money(pj(a.after).amount_cents || 0)} to the card`, "order.counter_refund": a => `Recorded ${money(pj(a.after).amount_cents || 0)} given back at the counter${pj(a.after).reason ? ": " + pj(a.after).reason : ""}`, "order.paid_at_counter": () => "Paid at the counter" };
const trailHtml = list => list.map(a => `<div><span>${esc((ACTION[a.action] || (() => a.action))(a))}, ${esc(who(a.actor))}</span><span class="num">${when(a.at)}</span></div>`).join("");
const NEXT = o => ({ pending: o.pay_status === "pay_at_pickup" ? ["ready", toConfirm(o) ? "On the shelf: mark ready" : "Mark ready for pickup"] : undefined, paid: o.method === "pickup" ? ["ready", "Mark ready for pickup"] : ["packed", "Mark packed"], packed: ["shipped", isLocal(o) ? "Mark out for delivery" : "Mark shipped"], ready: o.pay_status === "pay_at_pickup" ? undefined : ["collected", "Mark collected"] }[o.status]);
const isTodo = o => ["paid", "packed", "ready"].includes(o.status) || (o.status === "pending" && o.pay_status === "pay_at_pickup");
// How the order is paid, in words, and what can be done about it from here.
const PAY = { awaiting: "Card, not paid yet", paid: "Paid", pay_at_pickup: "To pay at the counter", expired: "Card page closed unpaid", failed: "Card payment failed", refunded: "Refunded", part_refunded: "Part refunded" };
const holdEnd = o => o.pay_status !== "pay_at_pickup" || !o.pay_expires_at ? null : o.status === "pending" ? o.pay_expires_at : o.status === "ready" ? new Date(Date.parse(o.ready_at || o.updated_at) + 14 * 864e5).toISOString() : null;   // src/pay.js expirePickups
// Same email, other networks (src/admin.js netNotes): a stranger may have typed this customer's email. A small note, no new UI.
const otherNets = o => o.other_networks > 0 ? `<b class="wait" data-othernets>Same email, ${o.other_networks} from another network</b>` : "";
const reqUntil = (o, mailOn = true) => `<div><dt>To confirm</dt><dd>Nothing is held for this customer yet. Check the shelf, then mark it ready: ${mailOn ? "that takes the items off the stock count and emails them to come in" : "that takes the items off the stock count. Then call or text them to come in: the shop's email is not connected, so no email goes out"}. If the shelf is short, call them.${o.pay_expires_at ? ` Not marked ready by ${esc(new Date(o.pay_expires_at).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}, it cancels itself.` : ""}</dd></div>`;
const holdUntil = (o, mailOn = true) => toConfirm(o) ? reqUntil(o, mailOn) :holdEnd(o) ? `<div><dt>Held until</dt><dd>${esc(new Date(holdEnd(o)).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}. ${o.status === "pending" ? "Mark it ready or paid before then" : "Take the payment before then"}, or it cancels itself and the stock goes back.</dd></div>` : "";
const payFacts = (o, mailOn = true) => !o.pay_status ? "" : holdUntil(o, mailOn) +`<div><dt>Payment</dt><dd>${holdEnded(o) ? "Not confirmed, or not paid and picked up, in time. It cancelled itself; anything it had taken off the shelf went back." : PAY[o.pay_status] || esc(o.pay_status)}${o.pay_method === "card" && o.paid_cents ? `, card ${money(o.paid_cents)}` : o.pay_status === "paid" && o.pay_method === "at_pickup" ? ", at the counter" : ""}${o.refunded_cents ? `, ${money(o.refunded_cents)} refunded` : ""}</dd></div>`;
const payActs = o => toConfirm(o) ? `<p class="fineprint" data-confirmfirst>Mark it ready first (that checks the shelf and takes the stock), then take the payment.</p>`
  : o.pay_status === "pay_at_pickup" ? `<button class="btn" type="button" data-markpaid>Mark paid at the counter</button>`
  : o.pay_method === "card" && ["paid", "part_refunded"].includes(o.pay_status) && state.me.owner ? `<form class="refund" data-refundform><label class="meta" for="rf-amt">Refund to the card</label><div class="refund__row"><input class="field num" id="rf-amt" name="amount" inputmode="decimal" value="${((o.paid_cents - (o.refunded_cents || 0)) / 100).toFixed(2)}" aria-describedby="rf-note"><button class="btn btn--ghost" type="submit">Refund</button></div><p class="fineprint" id="rf-note">Up to ${money(o.paid_cents - (o.refunded_cents || 0))}. Stock is not put back: count returns in with the stock button.</p></form>`
  : o.pay_method === "card" && ["paid", "part_refunded"].includes(o.pay_status) ? `<p class="fineprint">Refunds to the card are done by the owner.</p>`
  : o.pay_method === "at_pickup" && ["paid", "part_refunded"].includes(o.pay_status) && o.status !== "cancelled" && state.me.owner ? `<form class="refund" data-tillrefund novalidate><p class="meta">Refund given at the counter</p>
      <div class="refund__row"><label class="field"><span>Amount given back, $</span><input class="input num" name="amount" inputmode="decimal" value="${((o.paid_cents - (o.refunded_cents || 0)) / 100).toFixed(2)}" aria-describedby="tr-note"></label></div>
      <label class="field"><span>Why</span><input class="input" name="why" maxlength="200" placeholder="Returned, faulty" aria-describedby="tr-note"></label>
      <button class="btn btn--ghost" type="submit">Record the refund</button>
      <p class="fineprint" id="tr-note">For money already given back at the till. Up to ${money(o.paid_cents - (o.refunded_cents || 0))}. It comes off the monthly report and takes back the customer's points. Count returned items in with the stock button.</p></form>`
  : o.pay_method === "at_pickup" && ["paid", "part_refunded"].includes(o.pay_status) && o.status !== "cancelled" ? `<p class="fineprint">Refunds given at the counter are recorded by the owner.</p>` : "";
const orderMeta = o => `${esc(o.id)} &middot; ${when(o.created_at)} &middot; ${esc(o.units)} ${o.units === 1 ? "item" : "items"} &middot; ${o.method === "pickup" ? "Pickup" : isLocal(o) ? "Delivery" : esc(o.tax_province || "")}`;
const orderEnd = o => { const k = (ORDER_STATE[o.status] || ["done"])[0]; return `<span class="order__r"><b class="num">${money(o.total_cents)}</b><span class="state ${k}">${esc(stateLabel(o))}</span>${waitDays(o) >= 3 ? `<b class="wait">Waiting ${waitDays(o)} days</b>` : ""}${otherNets(o)}</span>`; };
const orderRow = o => `<button class="row order" type="button" data-order="${esc(o.id)}"><span class="row__main"><span class="row__name">${esc(o.name)}</span><span class="row__meta">${orderMeta(o)}</span></span>${orderEnd(o)}</button>`;
// Clear junk: a request row with a tick box, its phone and the short tag of the network it came from
const selRow = o => `<label class="row order" data-selrow="${esc(o.id)}"><input type="checkbox" data-osel="${esc(o.id)}" ${state.osel.has(o.id) ? "checked" : ""} aria-label="Select ${esc(o.name)}, ${esc(o.id)}"><span class="row__main"><span class="row__name">${esc(o.name)}</span><span class="row__meta">${orderMeta(o)}${o.phone ? ` &middot; ${esc(o.phone)}` : ""}${o.net ? ` &middot; network ${esc(o.net)}` : ""}</span></span>${orderEnd(o)}</label>`;
function viewOrders() {
  const todo = isTodo, found = state.found, reqs = state.orders.filter(toConfirm);
  const list = found ? found.orders : state.selecting ? reqs : state.orders.filter(o => state.oflt === "all" || (state.oflt === "todo" ? todo(o) : !todo(o)));
  const chip = (id, label) => `<button class="chip" type="button" data-oflt="${id}" aria-pressed="${state.oflt === id && !found}">${label}</button>`;
  const nets = Object.entries(reqs.reduce((a, o) => { if (o.net) a[o.net] = (a[o.net] || 0) + 1; return a; }, {})).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
  const junkBar = !found && state.oflt === "todo" && reqs.length ? (state.selecting ? `<div class="junk" data-junkbar><p class="tools__help">Tick the requests to cancel, or pick every request from one network. A flagged request (same email, other network) may be the customer's or a stranger's: open it to check before ticking it. Only requests still to confirm can be cleared here; each is cancelled with your name.</p>
      <div class="chips"><button class="chip" type="button" data-selnone>Select none</button></div>
      ${nets.length ? `<label class="field"><span>Select every request from one network</span><select class="input" data-onet><option value="">Pick a network</option>${nets.map(([n, c]) => `<option value="${esc(n)}">Network ${esc(n)}: ${c} requests</option>`).join("")}</select></label>` : ""}
      <div class="sheet__act"><button class="btn btn--danger" type="button" data-bulkcancel ${state.osel.size ? "" : "disabled"}>Cancel <span data-selcount>${state.osel.size}</span> selected</button><button class="btn btn--ghost" type="button" data-selecting>Done</button></div><p class="err" role="alert" data-bulkerr></p></div>`
    : `<p><button class="chip" type="button" data-selecting>Clear junk requests</button></p>`) : "";
  return `<div class="tools"><h1 class="h1">Orders<span class="sample">Sample orders</span></h1>
    <form class="tools__top" data-ofind role="search"><input class="input" id="oq" type="search" placeholder="Find: order number, name, phone or email" value="${esc(state.oq)}" maxlength="80" aria-label="Find an order by number, name, phone or email"><button class="btn" type="submit">Find</button></form>
    <div class="chips" role="group" aria-label="Filter">${chip("todo", "To do " + state.orders.filter(todo).length)}${chip("done", "Finished")}${chip("all", "All " + state.orders.length)}</div>
    ${found ? `<p class="tools__help" data-found>${found.orders.length} found for &ldquo;${esc(found.q)}&rdquo;${found.more ? `, the newest ${found.orders.length} shown: type more to narrow it` : ""}. <button class="chip" type="button" data-ofindclear>Clear</button></p>` : ""}
    ${state.openCut ? `<p class="remind" data-opencut><b>There are more open orders than this list can hold.</b> Every ready, paid and packed order is here; use Find for a request, or clear junk requests.</p>` : ""}
    ${junkBar}</div>
    <div class="rows">${list.map(state.selecting && !found ? selRow : orderRow).join("") || `<p class="empty">${found ? "No order matches. Try the order number, or part of the name, phone or email." : "Nothing waiting. New orders show up here."}</p>`}</div>
    ${!found && !state.selecting && state.oflt !== "todo" && state.finMore ? `<p><button class="btn btn--ghost" type="button" data-olderfin>Show older finished orders</button></p>` : ""}`;
}
async function orderSheet(id) {
  const { order: o, items, emails = [], trail = [], mail_on = false } = await api("/orders/" + id), k = ORDER_STATE[o.status][0], label = stateLabel(o), next = NEXT(o);
  const charcoal = items.some(i => i.category_id === "charcoal" || /"charcoal":true/.test(i.details || "")), canCancel = ["paid", "packed", "ready"].includes(o.status) || (o.status === "pending" && o.pay_status === "pay_at_pickup"), wait = waitDays(o), units = items.reduce((a, i) => a + i.qty, 0), src = pj(o.source_detail);
  sheet.innerHTML = `<div class="sheet__in" data-ordersheet="${esc(o.id)}">
    <div class="sheet__top"><div><p class="meta">Order ${esc(o.id)} &middot; ${when(o.created_at)}</p><h2 class="h2" style="margin:0">${esc(o.name)}</h2><span class="state ${k}">${esc(label)}</span></div><button class="sheet__x" type="button" data-close>Close</button></div>
    ${dropCard(o)}
    ${wait >= 3 ? `<p class="remind" data-remind><b>Waiting ${wait} days.</b> A friendly call usually does it. We hold pickups for 14 days.</p>` : ""}
    ${o.status === "cancelled" ? `<p class="remind"><b>Cancelled${o.cancel_reason ? ", " + esc(REASON[o.cancel_reason].toLowerCase()) : ""}.</b> ${o.cancelled_by ? `By ${esc(who(o.cancelled_by))}, ${when(o.cancelled_at).replace(/[.]$/, "")}.` : ""} ${o.cancel_note ? esc(o.cancel_note) : ""}${o.cancelled_by ? (o.pay_method === "at_pickup" ? " Anything it had taken off the shelf went back." : " The stock went back on the shelf.") : ""}</p>` : ""}
    ${charcoal ? `<div class="idcheck" data-staff-note><p>Charcoal order. Check ID if the customer looks young.</p><label class="check"><input type="checkbox" data-idcheck ${o.id_checked_at ? "checked" : ""}> ID checked</label><p class="fineprint">${o.id_checked_at ? `By ${esc(who(o.id_checked_by))}, ${when(o.id_checked_at).replace(/[.]$/, "")}. ` : ""}Staff only: customers never see this.</p></div>` : ""}
    <div class="rows items">${items.map(i => `<div class="row">${thumb(i, catOf((state.products.find(p => p.sku === i.sku) || {}).category_id).tone)}<span class="row__main"><span class="row__name">${esc(i.name)}</span><span class="row__meta">${esc(i.sku)}${i.box_id ? " &middot; box " + esc(i.box_id) : ""}</span></span><span class="num"><b style="color:var(--color-strong)">${esc(i.qty)}</b> &times; ${money(i.unit_cents)}</span></div>`).join("")}</div>
    <dl class="facts"><div><dt>Items</dt><dd class="num">${money(o.subtotal_cents)}</dd></div><div><dt>${o.method === "pickup" ? "Pickup at the counter" : isLocal(o) ? "Local delivery" : "Shipping, " + esc(o.ship_service || "")}</dt><dd class="num">${o.method === "pickup" || (isLocal(o) && !o.shipping_cents) ? "Free" : money(o.shipping_cents)}</dd></div>
      <div><dt>Tax, ${esc(o.tax_province || "")}</dt><dd class="num">${money(o.tax_cents)}</dd></div><div><dt><b style="color:var(--color-strong)">${o.pay_status === "paid" || o.pay_status === "refunded" || o.pay_status === "part_refunded" || !o.pay_status ? "Total paid" : "Total"}</b></dt><dd class="num"><b>${money(o.total_cents)}</b></dd></div>
      ${payFacts(o, mail_on)}${o.other_networks > 0 ? `<div data-othernets><dt>Same email</dt><dd>${o.other_networks} other open ${o.other_networks === 1 ? "order uses" : "orders use"} this email from a different network. If the customer did not place ${o.other_networks === 1 ? "it" : "them"}, cancel ${o.other_networks === 1 ? "it" : "them"}.</dd></div>` : ""}${!mail_on && o.status === "ready" && o.pay_status === "pay_at_pickup" ? `<div><dt>Tell them</dt><dd>The shop's email is not connected: call or text ${o.phone ? esc(o.phone) : "the customer"} to say it is ready.</dd></div>` : ""}${o.tracking ? `<div><dt>Tracking</dt><dd class="num">${esc(o.tracking)}</dd></div>` : ""}${dropInfo(o)}
      <div><dt>Found us through</dt><dd>${esc(o.source || "Not recorded")}${src.landing && src.landing !== "/" ? `, first page ${esc(src.landing)}` : ""}</dd></div></dl>
    ${trail.length ? `<section><h3 class="meta" style="margin-bottom:var(--s-2)">Who did what</h3><div class="hist">${trailHtml(trail)}</div></section>` : ""}
    <section><h3 class="meta" style="margin-bottom:var(--s-2)">Emails to the customer</h3><div class="hist">${emails.map(e => { const st = mailState(e, mail_on); return `<button class="mailrow" type="button" data-mail="${e.id}"><span>${esc(MAIL[e.kind] || e.kind)}, ${when(e.at)}</span><span class="state ${st[0]}">${st[1]}</span></button>`; }).join("") || `<div><span>None yet.</span></div>`}</div>
      ${emails.some(e => mailState(e, mail_on)[2] === "off") ? `<p class="fineprint">Emails written while the shop's mail service is not connected are kept here.</p>` : ""}${emails.some(e => mailState(e, mail_on)[2] === "retry") ? `<p class="fineprint" data-mailretry>An email has not gone out yet. The shop tries it again after 10, 20 and 40 minutes, then every hour, for a day.</p>` : ""}${emails.some(e => mailState(e, mail_on)[2] === "gaveup") ? `<p class="fineprint" data-mailgaveup>An email could not be sent${state.me.owner ? ". Open it to see why and fix the cause. Before sending it again, check the mail service's own email list: if it shows as delivered there, do not send it twice" : ". Open it to see why; the owner can send it again"}.</p>` : ""}<div data-mailview></div></section>
    ${payActs(o)}
    <p class="err" role="alert" data-err></p>
    <div class="sheet__act">${next ? `<button class="btn" type="button" data-next="${next[0]}">${next[1]}</button>` : ""}<button class="btn btn--ghost" type="button" data-close>Close</button></div>
    ${canCancel ? `<details class="cancel"><summary>Cancel this order</summary><form data-cancel novalidate>
      <fieldset class="cancel__why"><legend class="meta">Why</legend>${Object.entries(REASON).map(([v, l]) => `<label class="check"><input type="radio" name="reason" value="${v}"> ${l}</label>`).join("")}</fieldset>
      <label class="field"><span>Note (needed for Other)</span><input class="input" name="note" maxlength="200" autocomplete="off"></label>
      <p class="fineprint">The order stays on record, marked cancelled with your name. Nothing is emailed to the customer.</p>
      <p class="err" role="alert" data-cerr></p>
      <button class="btn btn--danger" type="submit">Cancel ${esc(o.id)} and put ${units} ${units === 1 ? "item" : "items"} back</button></form></details>` : ""}</div>`;
  if (!sheet.open) sheet.showModal();
}

// What an email row shows: [colour, label, group]. A failed email with a next try booked is still being tried; one with none has given up.
const mailState = (e, on) => e.status === "sent" ? ["done", "Sent", "sent"] : e.status === "failed" ? (e.next_try_at ? ["low", "Trying again", "retry"] : ["out", "Not sent", "gaveup"])
  : on && e.next_try_at ? ["low", "Sending", "retry"] : ["low", "Written, not sent", "off"];   // held with no try booked: written before the mail service was connected
const MAIL = { order_placed: "Order received", order_shipped: "Shipped", pickup_ready: "Ready for pickup", low_stock: "Low stock note to the shop", new_order: "New order note to the shop" };
async function mailView(id) {
  const box = $("[data-mailview]", sheet); if (!box) return;
  const { email: e } = await api("/emails/" + id);
  const gaveUp = e.status === "failed" && !e.next_try_at;
  box.innerHTML = `<p class="fineprint" style="margin-top:var(--s-4)">To ${esc(e.recipient)} &middot; ${esc(e.subject)}${e.status === "failed" && e.detail ? ` &middot; ${gaveUp ? "Not sent" : "Not sent yet"}: ${esc(e.detail)}` : ""}</p>${gaveUp && state.me.owner ? `<button class="btn btn--ghost" type="button" data-resendmail="${e.id}">Send it again</button>` : ""}<iframe class="mail" title="Email preview" sandbox=""></iframe>`;
  $("iframe", box).srcdoc = e.html; // sandboxed: the preview cannot run scripts or touch the back office
}
// ---------- Office (owner only): the monthly report, the 5% basis, the team ----------
const shiftMonth = (mo, d) => { const [y, m] = mo.split("-").map(Number), t = new Date(Date.UTC(y, m - 1 + d, 1)); return t.toISOString().slice(0, 7); };
const monthName = mo => new Date(mo + "-15T12:00:00Z").toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
function viewOffice(r, staff, settings, intake) {
  const s = r.studio, mo = r.month, thisMonth = new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 7), pct = (s.rate_bp / 100).toLocaleString("en-CA");
  const line = (label, n, c, cls = "") => `<tr class="${cls}"><td>${label}</td><td class="r num">${n}</td><td class="r num">${money(c)}</td></tr>`;
  const smax = Math.max(1, ...r.sources.map(x => x.subtotal));
  return `<div class="office">
    <section class="hero wide"><div class="month"><button class="month__b" type="button" data-month="${shiftMonth(mo, -1)}" aria-label="Month before">&larr;</button><p class="meta" aria-live="polite">${monthName(mo)}</p>${mo < thisMonth ? `<button class="month__b" type="button" data-month="${shiftMonth(mo, 1)}" aria-label="Next month">&rarr;</button>` : `<span class="month__b" aria-hidden="true"></span>`}</div>
      <h1 class="hero__fig num">${r.net.subtotal < 0 ? "&minus;" : ""}<sup>$</sup>${money(Math.abs(r.net.subtotal), true).slice(1)}</h1>
      <p class="hero__sub">net online sales, before tax and delivery</p>
      <div class="share"><p class="meta">Studio share</p><b class="num">${money(s.share_cents)}</b><small>${pct}% of the ${esc(s.basis_label)}, ${money(s.basis_cents)}</small></div>
      <p class="fineprint">The basis waits on the owner's written confirmation. Set by ${esc(who(s.basis_set_by))}${s.basis_set_at ? ", " + when(s.basis_set_at).replace(/\.$/, "") : ""}.</p></section>
    <section><h2 class="h2">Online sales</h2><p class="fineprint office__note">Subtotal is the items, before tax and delivery. Sales count on the order date, cancels on the day they happen.</p><table class="ledger"><thead><tr><th scope="col">${monthName(mo)}</th><th scope="col" class="r">Orders</th><th scope="col" class="r">Subtotal</th></tr></thead><tbody>
      ${line("Paid orders", r.sales.orders, r.sales.subtotal)}
      ${line("Cancelled or refunded", r.refunds.orders, -r.refunds.subtotal, r.refunds.orders ? "minus" : "")}
      ${line("<b>Net</b>", r.net.orders, r.net.subtotal, "net")}</tbody></table>
      <dl class="facts"><div><dt>Delivery and shipping charged, net</dt><dd class="num">${money(r.net.delivery)}</dd></div><div><dt>Tax collected, net</dt><dd class="num">${money(r.net.tax)}</dd></div><div><dt>Total paid by customers, net</dt><dd class="num">${money(r.net.total)}</dd></div></dl>
      <p class="fineprint"><a href="/api/admin/report.csv?month=${mo}" download>Download ${monthName(mo)} as a spreadsheet (CSV)</a>: every order and refund line, the totals and the share.</p></section>
    <section><h2 class="h2">Where orders came from</h2>${r.sources.map(x => `<div class="prov src"><b>${esc(x.source)}</b><span style="--w:${Math.round(Math.max(0, x.subtotal) / smax * 100)}"></span><i class="num">${x.orders}</i><i class="num">${money(x.subtotal, true)}</i></div>`).join("") || `<p class="empty">No online orders in ${monthName(mo)}.</p>`}
      <p class="fineprint">From the first visit's link: ?src=card on the business card, utm_source=gbp on Google, or the site that sent them.</p></section>
    <section><h2 class="h2">Studio share basis</h2><fieldset class="basis"><legend class="sr">What the studio share is worked out on</legend>
      <label class="check"><input type="radio" name="basis" value="subtotal" data-basis ${settings.studio_share_basis !== "total" ? "checked" : ""}> Items subtotal, before tax and delivery</label>
      <label class="check"><input type="radio" name="basis" value="total" data-basis ${settings.studio_share_basis === "total" ? "checked" : ""}> Full total paid, with tax and delivery</label></fieldset>
      <button class="btn btn--ghost" type="button" data-savebasis hidden>Save the new basis</button><p class="fineprint">Change it only when the owner has confirmed the basis in writing. Each change is logged with your name.</p></section>
    <section class="wide team"><h2 class="h2">Team</h2>
      <div class="rows">${staff.map(p => `<div class="row staff"><span class="row__main"><span class="row__name">${esc(p.name)}</span><span class="row__meta">${p.last_in ? "Last in " + when(p.last_in) : "Not signed in yet"} &middot; added ${when(p.created_at)}</span></span><span class="staff__act"><button class="bar__link" type="button" data-repin="${p.id}" data-name="${esc(p.name)}">New PIN</button><button class="bar__link" type="button" data-unstaff="${p.id}" data-name="${esc(p.name)}">Remove</button></span></div>`).join("") || `<p class="empty">No staff yet. Add the first person below; they sign in with their name and PIN.</p>`}</div>
      <form class="addstaff" data-addstaff novalidate><label class="field"><span>First name</span><input class="input" name="sname" maxlength="30" autocomplete="off" required></label>
        <label class="field"><span>PIN, 6 digits</span><input class="input num" name="spin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" required></label>
        <button class="btn" type="submit">Add</button><p class="err" role="alert" data-err></p></form>
      <p class="fineprint">Every stock count, price change and order step is saved with the name of whoever made it. Removing someone ends their sign-in at once.</p></section>
    ${intakeView(intake)}</div>`;
}
// the shop's questionnaire (the private /intake page): the newest send, read here so nobody digs through storage
function intakeView(q) {
  if (!q || !q.sends) return "";
  if (!q.sends.length) return `<section class="wide"><h2 class="h2">Shop answers</h2><p class="empty">No answers sent yet.</p></section>`;
  // what was stored is never trusted: a row that is not a plain object with a text key is skipped, never allowed to break the tab
  const rows = (q.latest && Array.isArray(q.latest.rows) ? q.latest.rows : []).filter(r => r && typeof r === "object" && typeof r.key === "string").slice(0, 500).map(r => { const k = r.key.slice(0, 80), v = Array.isArray(r.value) ? r.value.map(String).join(", ") : r.value === true ? "yes" : String(r.value ?? ""); return `<tr><td>${esc(typeof r.item === "string" ? r.item.slice(0, 120) + " (" + k.replace(/-OSS-\d+$/, "") + ")" : k)}</td><td>${esc(v.slice(0, 2000))}</td></tr>`; }).join("");
  // every send is listed by when it came and the place it came from (a short tag, never the address), so a stranger's send can
  // never pass for the shop's: a place seen once, or a new country, reads differently from the counter's usual one
  const list = q.sends.filter(x => x.key !== "intake/latest.json"), shown = q.shownKey || q.sends[0].newest || list[0]?.key, cur = list.find(x => x.key === shown) || list[0];
  // the oldest kept send with a tag is most likely the shop's own: a send from that same place says so, so a stranger's cannot pass for it
  const first = [...list].reverse().find(s => s.from)?.from;
  const label = s => `${when(s.at)}${s.shop ? ", sent from a shop device" : ""}${s.from ? `, from place ${s.from}${s.country ? " (" + s.country + ")" : ""}${s.from === first ? ", the same place as the first send" : ", a different place from the first send"}, ${s.from_n === 1 ? "its only send" : s.from_n + " sends from there"}` : ", place not recorded"}`;
  return `<section class="wide"><h2 class="h2">Shop answers</h2><p class="fineprint">${list.length} sends. Showing ${cur && cur.key === list[0].key ? "the newest" : "an earlier one"}: ${cur ? esc(label(cur)) : ""}.</p>
    ${list.length > 1 ? `<label class="field"><span>Read another send</span><select class="input" data-intake>${list.slice(0, 300).map(s => `<option value="${esc(s.key)}" ${cur && s.key === cur.key ? "selected" : ""}>${esc(label(s))}</option>`).join("")}</select></label>` : ""}
    <table class="ledger"><thead><tr><th scope="col">Question</th><th scope="col">Answer</th></tr></thead><tbody>${rows || `<tr><td colspan="2">The newest send could not be read.</td></tr>`}</tbody></table>
    ${cur ? `<p><button class="btn btn--ghost" type="button" data-intakedel="${esc(cur.key)}">Remove this send</button></p><p class="fineprint">The link takes up to 300 kept sends; removing old or stranger's sends makes room. This cannot be undone.</p><p class="err" data-intakeerr role="alert"></p>` : ""}</section>`;
}
// ---------- shell ----------
async function loadProducts() { const r = await api("/products"); state.products = r.products; state.categories = r.categories; state.boxes = r.boxes; }
// every open order, and the newest finished ones (older ones a page at a time, data-olderfin); a search on screen is run again
async function loadOrders() {
  const r = await api("/orders"); state.orders = r.orders; state.finMore = r.finished_more || null; state.openCut = !!r.open_cut;
  const ids = new Set(r.orders.map(o => o.id)); for (const id of [...state.osel]) if (!ids.has(id) || !toConfirm(r.orders.find(o => o.id === id))) state.osel.delete(id);
  if (state.found) state.found = await api("/orders/find?q=" + encodeURIComponent(state.found.q)).catch(er => { toast("The search could not be refreshed: " + er.message); return state.found; });
}
function chrome() {
  const todo = state.orders.filter(isTodo).length;
  $$("[data-tab]").forEach(b => { b.toggleAttribute("aria-current", false); if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page"); if (b.dataset.tab === "orders") b.innerHTML = "Orders" + (todo ? `<i class="num">${todo}</i>` : ""); });
}
async function render() {
  chrome();
  if (state.tab === "stock") main.innerHTML = viewStock();
  else if (state.tab === "orders") main.innerHTML = viewOrders();
  else if (state.tab === "office" && state.me.owner) { const [r, st, se, iq] = await Promise.all([api("/report?month=" + (state.month || "")), api("/staff"), api("/settings"), api("/intake").catch(() => null)]); const pick = iq?.sends?.some(x => x.key === state.intakeKey) ? state.intakeKey : iq?.sends?.[0]?.newest, latest = pick ? await api("/intake?key=" + encodeURIComponent(pick)).catch(() => null) : null; state.month = r.month; if (state.tab === "office") { let extra = iq && { ...iq, latest, shownKey: pick }; try { intakeView(extra); } catch { extra = null; } main.innerHTML = viewOffice(r, st.staff, se.settings, extra); } }
  else { const s = await api("/summary"); state.summary = s; if (state.tab === "home") main.innerHTML = viewHome(s); }
}
async function boot() {
  try { await Promise.all([loadProducts(), loadOrders()]); } catch { return; }
  try { state.me = await api("/me"); } catch { return; }
  state.in = true; $("[data-tabs]").hidden = false; $("[data-end]").hidden = false; $("[data-office]").hidden = !state.me.owner; $("[data-tabs]").classList.toggle("tabs--4", state.me.owner);
  $("[data-who]").textContent = who(state.me.actor); if (!state.me.owner && state.tab === "office") state.tab = "home"; await render();
}
document.addEventListener("click", async e => {
  const t = e.target;
  let el;
  if ((el = t.closest("[data-tab]"))) { state.tab = el.dataset.tab; await render(); scrollTo(0, 0); return; }
  if ((el = t.closest("[data-go]"))) { const [tab, f] = el.dataset.go.split(":"); state.tab = tab; if (tab === "stock") { state.cat = f; state.smode = "adjust"; } else state.oflt = f; await render(); scrollTo(0, 0); return; }
  if ((el = t.closest("[data-cat]"))) { state.cat = el.dataset.cat; return render(); }
  if ((el = t.closest("[data-oflt]"))) { state.oflt = el.dataset.oflt; state.found = null; state.selecting = false; return render(); }
  if (t.closest("[data-moreconfirm]")) { state.todayShown += 100; const box = $("[data-confirmrows]"), top = box ? box.scrollTop : 0; await render(); const b2 = $("[data-confirmrows]"); if (b2) b2.scrollTop = top; return; }   // fresh from the server, keeping the place
  if (t.closest("[data-ofindclear]")) { state.found = null; state.oq = ""; return render(); }
  if (t.closest("[data-selecting]")) { state.selecting = !state.selecting; state.osel.clear(); return render(); }
  if (t.closest("[data-selnone]")) { state.osel.clear(); return render(); }
  if ((el = t.closest("[data-olderfin]"))) { el.disabled = true;
    try { const r = await api("/orders?before=" + encodeURIComponent(state.finMore)), have = new Set(state.orders.map(o => o.id)); state.orders = [...state.orders, ...r.orders.filter(o => !have.has(o.id))]; state.finMore = r.finished_more || null; await render(); } catch (er) { toast(er.message); el.disabled = false; } return; }
  if ((el = t.closest("[data-bulkcancel]"))) {   // asks first, then cancels in groups of 100 (src/admin.js bulk-cancel), each with this person's name
    const ids = [...state.osel].filter(id => toConfirm(state.orders.find(o => o.id === id) || {})), err = $("[data-bulkerr]");
    if (!ids.length) return;
    const names = ids.slice(0, 12).map(id => { const o = state.orders.find(x => x.id === id) || {}; return `${o.name || ""}, ${id}${o.phone ? ", " + o.phone : ""}`; }).join("\n");   // plain text in the dialog, never HTML
    if (!confirm(`Cancel ${ids.length} pickup ${ids.length === 1 ? "request" : "requests"}? Each is marked cancelled with your name. Nothing is emailed and nothing was taken off the shelf.\n\n${names}${ids.length > 12 ? `\nand ${ids.length - 12} more` : ""}`)) return;
    el.disabled = true; let done = 0, skipped = 0, failed = "";
    try { for (let i = 0; i < ids.length; i += 100) { const part = ids.slice(i, i + 100), r = await api("/orders/bulk-cancel", { method: "POST", body: { ids: part, confirm: part.length, note: "Cleared as junk", op: opKey() } }); done += r.cancelled.length; skipped += r.skipped.length; part.forEach(id => state.osel.delete(id)); } }
    catch (er) { failed = er.message; }
    if (!failed) { state.osel.clear(); state.selecting = false; } await loadOrders(); await render();
    if (failed) { const e2 = $("[data-bulkerr]"); if (e2) e2.textContent = `Cancelled ${done}, then: ${failed}`; else toast(failed); return; }
    toast(`Cancelled ${done}.${skipped ? ` ${skipped} could not be: they were no longer requests to confirm.` : ""}`); return; }
  if (t.closest("[data-new]")) return editSheet(null);
  if ((el = t.closest("[data-smode]"))) { state.smode = el.dataset.smode; await render(); return; }
  if (t.closest("[data-gate-swap]")) { state.ownerGate = !state.ownerGate; return gate(); }
  if ((el = t.closest("[data-savebasis]"))) { const v = ($('input[name="basis"]:checked') || {}).value; el.disabled = true; try { await api("/settings", { method: "PUT", body: { studio_share_basis: v } }); toast("Saved. The report is worked out again."); render(); } catch (er) { toast(er.message); el.disabled = false; } return; }
  if ((el = t.closest("[data-month]"))) { state.month = el.dataset.month; return render(); }
  if ((el = t.closest("[data-unstaff]"))) { const n = el.dataset.name; if (!confirm(`Remove ${n}? Their sign-in stops now. Their past changes keep their name.`)) return; try { await api(`/staff/${el.dataset.unstaff}`, { method: "DELETE", body: {} }); toast(`${n} removed.`); render(); } catch (er) { toast(er.message); } return; }
  if ((el = t.closest("[data-repin]"))) { const pin = prompt(`New 6-digit PIN for ${el.dataset.name}`); if (pin === null) return; try { await api(`/staff/${el.dataset.repin}/pin`, { method: "POST", body: { pin: pin.trim() } }); toast("PIN changed. Their old sign-ins ended."); } catch (er) { toast(er.message); } return; }
  if ((el = t.closest("[data-edit]"))) return editSheet(state.products.find(p => p.sku === el.dataset.edit));
  if ((el = t.closest("[data-info]"))) return infoSheet(state.products.find(p => p.sku === el.dataset.info));
  if ((el = t.closest("[data-sw]"))) { el.setAttribute("aria-pressed", el.getAttribute("aria-pressed") === "true" ? "false" : "true"); colourCount(el.closest("form")); return; }
  if ((el = t.closest("[data-addcol]"))) { const box = $("[data-newcol]", sheet), open = box.hidden; box.hidden = !open; el.setAttribute("aria-expanded", String(open)); if (open) $("[name=newcol]", box).focus(); return; }
  if (t.closest("[data-addcol-go]")) return addColour();
  if ((el = t.closest("[data-order]"))) return orderSheet(el.dataset.order).catch(er => toast(er.message));
  if ((el = t.closest("[data-resendmail]"))) { el.disabled = true; const oid = $("[data-ordersheet]", sheet)?.dataset.ordersheet; try { await api(`/emails/${el.dataset.resendmail}/resend`, { method: "POST", body: {} }); toast("Sent."); } catch (er) { toast(er.message); } if (oid) return orderSheet(oid).catch(er => toast(er.message)); return; }
  if ((el = t.closest("[data-mail]"))) return mailView(el.dataset.mail).catch(er => toast(er.message));
  if (t.closest("[data-close]")) return sheet.close();
  if (t.closest("[data-logout]")) { await api("/logout", { method: "POST", body: {} }).catch(() => {}); state.in = false; state.tab = "home"; state.smode = "adjust"; state.counted = new Set(); state.month = null; sheet.open && sheet.close(); return gate(); }   // the next person starts fresh
  if ((el = t.closest("[data-intakedel]"))) {   // two taps: the first asks, the second removes (owner only, src/admin.js)
    if (el.dataset.armed !== "1") { el.dataset.armed = "1"; el.textContent = "Tap again to remove it"; return; }
    el.disabled = true;
    try { await api("/intake", { method: "DELETE", body: { key: el.dataset.intakedel } }); state.intakeKey = null; await render(); toast("Send removed."); } catch (er) { const m = $("[data-intakeerr]"); if (m) m.textContent = er.message; el.disabled = false; } return; }
  if ((el = t.closest("[data-markpaid]"))) { const id = el.closest("[data-ordersheet]").dataset.ordersheet; el.disabled = true;
    try { await api(`/orders/${id}/paid`, { method: "POST", body: {} }); await loadOrders(); await orderSheet(id); render(); toast("Marked paid."); } catch (er) { $("[data-err]", sheet).textContent = er.message; el.disabled = false; } return; }
  if ((el = t.closest("[data-next]"))) { const id = el.closest("[data-ordersheet]").dataset.ordersheet; el.disabled = true;
    try { const done = await api(`/orders/${id}/status`, { method: "POST", body: { status: el.dataset.next } }); await Promise.all([loadOrders(), loadProducts()]); await orderSheet(id); render(); toast(done && done.call ? `Marked ready. Now call or text ${done.call.phone || "the customer"}: no email goes out.` : "Order updated."); } /* marking a pickup ready (or cancelling) moves stock: the Stock tab must not show the old counts */ catch (er) { $("[data-err]", sheet).textContent = er.message; el.disabled = false; } return; }
  if ((el = t.closest("[data-step]"))) {
    const row = el.closest("[data-sku]"), p = state.products.find(x => x.sku === row.dataset.sku), delta = +el.dataset.step, before = p.stock;
    if (p.stock + delta < 0) return;
    p.stock += delta; paintRow(row, p); // show it at once, then confirm with the store
    try { const r = await api(`/products/${p.sku}/stock`, { method: "POST", body: { delta, reason: "correction", op: opKey() } }); p.stock = r.stock; paintRow(row, p); }
    catch (er) { p.stock = er.data && typeof er.data.stock === "number" ? er.data.stock : before; paintRow(row, p); toast(er.message); }
  }
});
function paintRow(row, p) { const [k, label] = stockState(p), s = $("[data-state]", row); $("output", row).textContent = p.stock; s.className = "state " + k; s.textContent = label; $('[data-step="-1"]', row).disabled = p.stock <= 0; }
let qT; document.addEventListener("input", e => { if (e.target.id !== "q") return; state.q = e.target.value; clearTimeout(qT); qT = setTimeout(() => { const rows = $("[data-rows]"); if (rows) rows.innerHTML = rowsHtml(stockList()); }, 80); });
sheet.addEventListener("click", e => { if (e.target === sheet) sheet.close(); });
document.addEventListener("keydown", async e => {
  if (e.key !== "Enter" || !e.target.matches("[data-tally]")) return; e.preventDefault();
  const ok = await saveTally(e.target); if (!ok) return;
  const all = $$("[data-tally]"), next = all[all.indexOf(e.target) + 1]; if (next) next.focus(); else e.target.blur();
});
document.addEventListener("focusout", e => { if (e.target.matches("[data-tally]") && e.target.value.trim() && !e.target.dataset.busy) saveTally(e.target); });
document.addEventListener("change", async e => {
  if (e.target.id === "recvref") { state.recvRef = e.target.value.trim(); return; }
  if (e.target.matches("[data-intake]")) { state.intakeKey = e.target.value; render(); return; }
  if (e.target.matches("[data-basis]")) { const b = $("[data-savebasis]"); if (b) b.hidden = false; return; }
  if (e.target.matches("[data-osel]")) { const id = e.target.dataset.osel; if (e.target.checked) state.osel.add(id); else state.osel.delete(id); const c = $("[data-selcount]"), b = $("[data-bulkcancel]"); if (c) c.textContent = state.osel.size; if (b) b.disabled = !state.osel.size; return; }
  if (e.target.matches("[data-onet]")) { const net = e.target.value; if (net) { state.orders.filter(o => toConfirm(o) && o.net === net).forEach(o => state.osel.add(o.id)); render(); } return; }
  if (!e.target.matches("[data-idcheck]")) return;
  const id = e.target.closest("[data-ordersheet]").dataset.ordersheet, on = e.target.checked; e.target.disabled = true;
  try { await api(`/orders/${id}/id-check`, { method: "POST", body: { checked: on } }); await orderSheet(id); } catch (er) { e.target.checked = !on; e.target.disabled = false; toast(er.message); }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-cancel]"); if (!f) return; e.preventDefault();
  const id = f.closest("[data-ordersheet]").dataset.ordersheet, err = $("[data-cerr]", f), reason = (f.querySelector('input[name="reason"]:checked') || {}).value;
  if (!reason) return err.textContent = "Pick why it is cancelled.";
  if (reason === "other" && !f.note.value.trim()) return err.textContent = "Say why in a few words.";
  const btn = $('button[type="submit"]', f); btn.disabled = true; f.dataset.op = f.dataset.op || opKey();
  try { const r = await api(`/orders/${id}/cancel`, { method: "POST", body: { reason, note: f.note.value, op: f.dataset.op } }); await Promise.all([loadOrders(), loadProducts()]); await orderSheet(id); render(); toast(r.replayed ? "Already cancelled." : "Cancelled. The stock is back on the shelf."); }
  catch (er) { err.textContent = er.message; btn.disabled = false; }
});
// Find an order on the server (src/admin.js /orders/find), so no order is out of reach whatever the list holds
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-ofind]"); if (!f) return; e.preventDefault();
  const q = f.oq.value.trim(); state.oq = q;
  if (!q) { state.found = null; return render(); }
  if (q.length < 2) return toast("Type at least 2 characters.");
  const btn = $('button[type="submit"]', f); btn.disabled = true;
  try { state.found = await api("/orders/find?q=" + encodeURIComponent(q)); state.selecting = false; await render(); } catch (er) { toast(er.message); btn.disabled = false; }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-addstaff]"); if (!f) return; e.preventDefault();
  const err = $("[data-err]", f), btn = $('button[type="submit"]', f); btn.disabled = true;
  try { const r = await api("/staff", { method: "POST", body: { name: f.sname.value, pin: f.spin.value } }); toast(`${r.name} can sign in now.`); render(); }
  catch (er) { err.textContent = er.message; btn.disabled = false; }
});

api("/products").then(() => boot()).catch(() => { if (!state.in) gate(); });

document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-refundform]"); if (!f) return; e.preventDefault();
  const id = f.closest("[data-ordersheet]").dataset.ordersheet, btn = f.querySelector("button"), err = $("[data-err]", sheet);
  const cents = Math.round(parseFloat(String(f.elements.amount.value).replace(/[^\d.]/g, "")) * 100);
  if (!(cents > 0)) { err.textContent = "Enter the amount to refund."; return; }
  if (!confirm(`Refund ${money(cents)} to the customer's card? This cannot be undone.`)) return;
  f.dataset.op = f.dataset.op && f.dataset.cents === String(cents) ? f.dataset.op : crypto.randomUUID(); f.dataset.cents = String(cents);
  btn.disabled = true; err.textContent = "";
  try { await api(`/orders/${id}/refund`, { method: "POST", body: { op: f.dataset.op, amount_cents: cents } }); await loadOrders(); await orderSheet(id); render(); toast(`Refunded ${money(cents)}.`); }
  catch (er) { err.textContent = er.message; btn.disabled = false; }
});
// A refund already handed back at the till: recorded so the report, the 5% and the customer's points all see it.
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-tillrefund]"); if (!f) return; e.preventDefault();
  const id = f.closest("[data-ordersheet]").dataset.ordersheet, btn = f.querySelector("button"), err = $("[data-err]", sheet);
  const cents = Math.round(parseFloat(String(f.elements.amount.value).replace(/[^\d.]/g, "")) * 100), why = f.elements.why.value.trim();
  if (!(cents > 0)) { err.textContent = "Enter the amount given back."; return; }
  if (!why) { err.textContent = "Say why in a few words, for example: returned, faulty."; f.elements.why.focus(); return; }
  f.dataset.op = f.dataset.op && f.dataset.cents === String(cents) ? f.dataset.op : crypto.randomUUID(); f.dataset.cents = String(cents);
  btn.disabled = true; err.textContent = "";
  try { await api(`/orders/${id}/counter-refund`, { method: "POST", body: { op: f.dataset.op, amount_cents: cents, reason: why } }); await loadOrders(); await orderSheet(id); render(); toast(`Recorded ${money(cents)} given back at the counter.`); }
  catch (er) { err.textContent = er.message; btn.disabled = false; }
});
