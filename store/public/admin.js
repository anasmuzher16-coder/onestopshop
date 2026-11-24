// Back office screens: sign in, Today (shop numbers), Stock (the inventory), Orders. Plain modules, no framework.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (cents, whole = false) => (cents < 0 ? "-$" : "$") + (Math.abs(cents) / 100).toLocaleString("en-CA", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
const main = $("#main"), sheet = $("[data-sheet]"), toastEl = $("[data-toast]");
let toastT; const toast = msg => { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => toastEl.hidden = true, 2600); };

async function api(path, opts = {}) {
  const init = { method: opts.method || "GET", headers: {}, credentials: "same-origin" };
  if (opts.body !== undefined) { init.headers["X-OSS-Admin"] = "1"; if (opts.raw) { init.headers["Content-Type"] = opts.type; init.body = opts.body; } else { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); } }
  const r = await fetch("/api/admin" + path, init), data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/login") { state.in = false; gate(); throw new Error("signed out"); }
  if (!r.ok) throw Object.assign(new Error(data.error || "That did not work. Try again."), { data });
  return data;
}
const state = { in: false, tab: "home", products: [], categories: [], boxes: [], orders: [], q: "", cat: "all", oflt: "todo" };
const catOf = id => state.categories.find(c => c.id === id) || { name: id, tone: "bone" };
const thumbSrc = p => p.photo_ver ? `/api/photo/${p.sku}?v=${p.photo_ver}` : p.img ? `img/pc/${p.img}${p.img_dark ? "" : "-s"}.webp` : /"charcoal":true/.test(p.details || "") ? "img/pc/coming-charcoal.svg" : "";   // charcoal with no photo yet: the drawn stand-in
const thumb = (p, tone) => { const src = thumbSrc(p); return src ? `<img class="thumb" data-tone="${esc(tone)}" src="${esc(src)}" alt="" loading="lazy" width="52" height="64">` : `<span class="thumb" data-tone="${esc(tone)}"></span>`; };
const when = iso => { const d = new Date(iso), now = new Date(), days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  const t = d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }); return days === 0 ? "Today " + t : days === 1 ? "Yesterday " + t : d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }); };

// ---------- sign in ----------
function gate() {
  $("[data-tabs]").hidden = true; $("[data-end]").hidden = true;
  main.innerHTML = `<form class="gate" data-login novalidate>
    <p class="meta">One Stop Shop</p><h1 class="h1">Back office</h1>
    <label class="field"><span>Passcode</span><input class="input" id="passcode" name="passcode" type="password" autocomplete="current-password" required></label>
    <p class="err" role="alert" data-err></p>
    <button class="btn" type="submit">Sign in</button></form>`;
  $("#passcode").focus();
}
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-login]"); if (!f) return; e.preventDefault();
  try { await api("/login", { method: "POST", body: { passcode: f.passcode.value } }); state.in = true; await boot(); }
  catch (err) { $("[data-err]", f).textContent = err.message; }
});

// ---------- Today ----------
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
    <section><h2 class="h2">Needs you</h2><div class="needs">
      ${need(todo.to_pack, todo.to_pack === 1 ? "order to pack" : "orders to pack", "Open orders", "orders:todo")}
      ${need(todo.to_ship, todo.to_ship === 1 ? "packed order to send" : "packed orders to send", "Open orders", "orders:todo")}
      ${need(todo.waiting_pickup, "waiting for pickup", "Open orders", "orders:todo")}
      ${need(low, low === 1 ? "product low or out" : "products low or out", "Open stock", "stock:low")}</div></section>
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
    <button class="row__main" type="button" data-edit="${p.sku}"><span class="row__name">${esc(p.name)}</span><span class="row__meta">${p.sku} &middot; ${esc(c.name)}${p.active ? "" : " &middot; hidden"}${!p.photo_ver && /"photo":"coming"/.test(p.details || "") ? " &middot; photo coming" : ""}</span></button>
    <span class="row__price num">${money(p.price_cents)}</span>
    <span class="state ${k}" data-state>${label}</span>
    <span class="step"><button type="button" data-step="-1" aria-label="One fewer ${esc(p.name)}" ${p.stock <= 0 ? "disabled" : ""}>&minus;</button><output class="num" aria-label="In stock">${p.stock}</output><button type="button" data-step="1" aria-label="One more ${esc(p.name)}">+</button></span></div>`;
}
function stockList() {
  const q = state.q.trim().toLowerCase();
  return state.products.filter(p => (state.cat === "all" || (state.cat === "low" ? p.active && p.stock <= p.low_stock_at : p.category_id === state.cat)) && (!q || (p.name + " " + p.sku).toLowerCase().includes(q)));
}
function viewStock() {
  const list = stockList(), chip = (id, label) => `<button class="chip" type="button" data-cat="${id}" aria-pressed="${state.cat === id}">${esc(label)}</button>`;
  return `<div class="tools"><h1 class="h1">Stock</h1>
    <div class="tools__top"><input class="input" id="q" type="search" placeholder="Search stock" value="${esc(state.q)}" aria-label="Search stock"><button class="btn" type="button" data-new>Add product</button></div>
    <div class="chips" role="group" aria-label="Section">${chip("all", "All " + state.products.length)}${chip("low", "Low or out")}${state.categories.map(c => chip(c.id, c.name)).join("")}</div></div>
    <div class="rows" data-rows>${list.map(stockRow).join("") || `<p class="empty">Nothing matches. Clear the search or pick another section.</p>`}</div>`;
}
function editSheet(p) {
  const isNew = !p, d = p ? JSON.parse(p.details || "{}") : {}, c = p ? catOf(p.category_id) : state.categories[0];
  p = p || { name: "", category_id: c.id, price_cents: "", cost_cents: "", weight_g: "", box_id: "S", ship_class: "standard", note: "", low_stock_at: 1, active: 1, glass: 0, stock: 0 };
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`, dol = c => c === "" || c === null || c === undefined ? "" : (c / 100).toFixed(2);
  sheet.innerHTML = `<form class="sheet__in" data-product="${isNew ? "" : p.sku}" novalidate>
    <div class="sheet__top"><div><p class="meta">${isNew ? "New product" : p.sku}</p><h2 class="h2" style="margin:0">${isNew ? "Add a product" : esc(p.name)}</h2></div><button class="sheet__x" type="button" data-close>Close</button></div>
    ${isNew ? "" : `<div class="photo">${thumb(p, c.tone).replace('width="52" height="64"', 'width="96" height="120"')}<div><p>Take or choose a photo. Plain background, the whole piece in frame.</p><label class="btn btn--ghost">Change photo<input type="file" accept="image/*" data-photo hidden></label></div></div>`}
    <label class="field"><span>Name</span><input class="input" name="name" value="${esc(p.name)}" maxlength="80" required></label>
    <div class="grid2"><label class="field"><span>Section</span><select class="input" name="category_id">${state.categories.map(x => opt(x.id, x.name, p.category_id)).join("")}</select></label>
      <label class="field"><span>Price, $</span><input class="input num" name="price" inputmode="decimal" value="${dol(p.price_cents)}" required></label></div>
    <label class="field"><span>Description, one line</span><input class="input" name="note" value="${esc(p.note)}" maxlength="200"></label>
    <div data-cologne ${p.category_id === "cologne" ? "" : "hidden"}><div class="grid2"><label class="field"><span>Size, mL</span><input class="input num" name="ml" inputmode="numeric" value="${esc(d.ml ?? "")}"></label>
      <label class="field"><span>Kind</span><input class="input" name="kind" value="${esc(d.kind ?? "")}" placeholder="Eau de parfum"></label></div>
      <label class="field" style="margin-top:var(--s-3)"><span>Scent notes</span><input class="input" name="notes" value="${esc(d.notes ?? "")}" maxlength="120" placeholder="Saffron, rose, oud"></label></div>
    <div class="grid2"><label class="field"><span>Weight, grams</span><input class="input num" name="weight_g" inputmode="numeric" value="${esc(p.weight_g)}" required></label>
      <label class="field"><span>Ships in</span><select class="input" name="box_id">${state.boxes.map(b => opt(b.id, `${b.label} (${b.l_cm} x ${b.w_cm} x ${b.h_cm} cm)`, p.box_id)).join("")}</select></label></div>
    <label class="field"><span>How it can ship</span><select class="input" name="ship_class">${opt("standard", "Any service", p.ship_class)}${opt("ground_only", "Ground only (cologne, anything flammable)", p.ship_class)}${opt("pickup_only", "Pickup or local delivery only (never shipped)", p.ship_class)}</select></label>
    <div class="grid2"><label class="field"><span>Your cost, $ (private)</span><input class="input num" name="cost" inputmode="decimal" value="${dol(p.cost_cents)}"></label>
      <label class="field"><span>Warn me at</span><input class="input num" name="low_stock_at" inputmode="numeric" value="${esc(p.low_stock_at)}"></label></div>
    ${isNew ? `<label class="field"><span>How many on the shelf now</span><input class="input num" name="stock" inputmode="numeric" value="0"></label>` : ""}
    <label class="check"><input type="checkbox" name="glass" ${p.glass ? "checked" : ""}> Glass, pack with care</label>
    <label class="check"><input type="checkbox" name="active" ${p.active ? "checked" : ""}> Show in the store</label>
    <p class="err" role="alert" data-err></p>
    <div class="sheet__act"><button class="btn" type="submit">${isNew ? "Add product" : "Save"}</button><button class="btn btn--ghost" type="button" data-close>Cancel</button></div>
    ${isNew ? "" : `<section><h3 class="meta" style="margin-bottom:var(--s-2)">Stock history</h3><div class="hist" data-hist><div><span>Loading</span></div></div></section>`}</form>`;
  sheet.showModal();
  if (!isNew) api(`/products/${p.sku}/history`).then(r => { const h = $("[data-hist]", sheet); if (h) h.innerHTML = r.moves.map(m => `<div><span>${esc(m.reason[0].toUpperCase() + m.reason.slice(1))}, ${when(m.at)}</span><b class="num">${m.delta > 0 ? "+" : ""}${m.delta}</b></div>`).join("") || `<div><span>No changes yet.</span></div>`; }).catch(() => {});
}
const cents = v => { const n = Math.round(parseFloat(String(v).replace(/[$,\s]/g, "")) * 100); return Number.isFinite(n) ? n : null; };
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-product]"); if (!f) return; e.preventDefault();
  const sku = f.dataset.product, err = $("[data-err]", f), price = cents(f.price.value);
  if (!f.name.value.trim()) return err.textContent = "Give it a name.";
  if (price === null || price < 0) return err.textContent = "Enter the price as dollars, like 49.99.";
  if (!(parseInt(f.weight_g.value, 10) > 0)) return err.textContent = "Enter the weight in grams. A kitchen scale is fine.";
  const body = { name: f.name.value, category_id: f.category_id.value, price_cents: price, cost_cents: f.cost.value.trim() === "" ? null : cents(f.cost.value), weight_g: parseInt(f.weight_g.value, 10), box_id: f.box_id.value,
    ship_class: f.ship_class.value, note: f.note.value, low_stock_at: parseInt(f.low_stock_at.value, 10) || 0, glass: f.glass.checked, active: f.active.checked,
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

// ---------- Orders ----------
const ORDER_STATE = { pending: ["done", "Not paid"], paid: ["go", "To pack"], packed: ["go", "Packed, to send"], ready: ["go", "Ready for pickup"], shipped: ["done", "Shipped"], collected: ["done", "Collected"], cancelled: ["out", "Cancelled"], refunded: ["out", "Refunded"] };
const isLocal = o => o.ship_service === "Local delivery";
const stateLabel = o => isLocal(o) && o.status === "packed" ? "Packed, to deliver" : isLocal(o) && o.status === "shipped" ? "Out for delivery" : ORDER_STATE[o.status][1];
const dropInfo = o => { let a = {}; try { a = JSON.parse(o.address || "{}"); } catch {} const where = a.line1 ? `${a.line1}, ${a.city}, ${a.province} ${a.postal}` : ""; let q = {}; try { q = JSON.parse(o.ship_quote || "{}"); } catch {} return `${q.confirm_address ? `<div><dt>Check first</dt><dd>Priced from the postal code. Call to confirm the address before driving.</dd></div>` : ""}${a.note ? `<div><dt>Note</dt><dd>${esc(a.note)}</dd></div>` : ""}`; };
// Address and phone first and large: this is what gets read and tapped from a phone on the way out the door.
const dropCard = o => {
  let a = {}, q = {}; try { a = JSON.parse(o.address || "{}"); } catch {} try { q = JSON.parse(o.ship_quote || "{}"); } catch {}
  if (!a.line1 && !o.phone) return "";
  const where = a.line1 ? `${a.line1}, ${a.city}, ${a.province} ${a.postal}` : "", from = isLocal(o) && Number.isFinite(q.metres) ? `Road distance: ${(q.metres / 1000).toFixed(1)} km` : "";
  const title = o.method === "pickup" ? "Picking up" : isLocal(o) ? "Deliver to" : "Ship to";
  return `<section class="drop" aria-label="${title}"><p class="meta">${title}</p>
    ${a.line1 ? `<p class="drop__addr">${esc(a.line1)}<br>${esc(a.city)}, ${esc(a.province)} ${esc(a.postal)}</p>` : ""}${from ? `<p class="drop__from">${from}</p>` : ""}
    <div class="drop__act">${o.phone ? `<a class="btn" href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ""))}">Call ${esc(o.phone)}</a>` : ""}${where ? `<a class="btn btn--ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}" target="_blank" rel="noopener">Open in Maps</a>` : ""}</div></section>`;
};
const NEXT = o => ({ paid: o.method === "pickup" ? ["ready", "Mark ready for pickup"] : ["packed", "Mark packed"], packed: ["shipped", isLocal(o) ? "Mark out for delivery" : "Mark shipped"], ready: ["collected", "Mark collected"] }[o.status]);
function viewOrders() {
  const todo = o => ["paid", "packed", "ready"].includes(o.status), list = state.orders.filter(o => state.oflt === "all" || (state.oflt === "todo" ? todo(o) : !todo(o)));
  const chip = (id, label) => `<button class="chip" type="button" data-oflt="${id}" aria-pressed="${state.oflt === id}">${label}</button>`;
  return `<div class="tools"><h1 class="h1">Orders<span class="sample">Sample orders</span></h1><div class="chips" role="group" aria-label="Filter">${chip("todo", "To do " + state.orders.filter(todo).length)}${chip("done", "Finished")}${chip("all", "All " + state.orders.length)}</div></div>
    <div class="rows">${list.map(o => { const k = ORDER_STATE[o.status][0], label = stateLabel(o); return `<button class="row order" type="button" data-order="${o.id}"><span class="row__main"><span class="row__name">${esc(o.name)}</span><span class="row__meta">${o.id} &middot; ${when(o.created_at)} &middot; ${o.units} ${o.units === 1 ? "item" : "items"} &middot; ${o.method === "pickup" ? "Pickup" : isLocal(o) ? "Delivery" : esc(o.tax_province || "")}</span></span><span class="order__r"><b class="num">${money(o.total_cents)}</b><span class="state ${k}">${label}</span></span></button>`; }).join("") || `<p class="empty">Nothing waiting. New orders show up here.</p>`}</div>`;
}
async function orderSheet(id) {
  const { order: o, items, emails = [] } = await api("/orders/" + id), k = ORDER_STATE[o.status][0], label = stateLabel(o), next = NEXT(o);
  sheet.innerHTML = `<div class="sheet__in" data-ordersheet="${o.id}">
    <div class="sheet__top"><div><p class="meta">Order ${o.id} &middot; ${when(o.created_at)}</p><h2 class="h2" style="margin:0">${esc(o.name)}</h2><span class="state ${k}">${label}</span></div><button class="sheet__x" type="button" data-close>Close</button></div>
    ${dropCard(o)}
    ${items.some(i => i.category_id === "heat" || /"charcoal":true/.test(i.details || "")) ? `<p class="fineprint" data-staff-note>Charcoal order. Check ID if the customer looks young.</p>` : ""}
    <div class="rows items">${items.map(i => `<div class="row">${thumb(i, catOf((state.products.find(p => p.sku === i.sku) || {}).category_id).tone)}<span class="row__main"><span class="row__name">${esc(i.name)}</span><span class="row__meta">${i.sku}${i.box_id ? " &middot; box " + esc(i.box_id) : ""}</span></span><span class="num"><b style="color:var(--color-strong)">${i.qty}</b> &times; ${money(i.unit_cents)}</span></div>`).join("")}</div>
    <dl class="facts"><div><dt>Items</dt><dd class="num">${money(o.subtotal_cents)}</dd></div><div><dt>${o.method === "pickup" ? "Pickup at the counter" : isLocal(o) ? "Local delivery" : "Shipping, " + esc(o.ship_service || "")}</dt><dd class="num">${o.method === "pickup" || (isLocal(o) && !o.shipping_cents) ? "Free" : money(o.shipping_cents)}</dd></div>
      <div><dt>Tax, ${esc(o.tax_province || "")}</dt><dd class="num">${money(o.tax_cents)}</dd></div><div><dt><b style="color:var(--color-strong)">Total paid</b></dt><dd class="num"><b>${money(o.total_cents)}</b></dd></div>
      ${o.tracking ? `<div><dt>Tracking</dt><dd class="num">${esc(o.tracking)}</dd></div>` : ""}${dropInfo(o)}</dl>
    <section><h3 class="meta" style="margin-bottom:var(--s-2)">Emails to the customer</h3><div class="hist">${emails.map(e => `<button class="mailrow" type="button" data-mail="${e.id}"><span>${esc(MAIL[e.kind] || e.kind)}, ${when(e.at)}</span><span class="state ${e.status === "sent" ? "done" : e.status === "failed" ? "out" : "low"}">${e.status === "sent" ? "Sent" : e.status === "failed" ? "Failed" : "Written, not sent"}</span></button>`).join("") || `<div><span>None yet.</span></div>`}</div>
      ${emails.some(e => e.status === "held") ? `<p class="fineprint">Emails are written and kept here. They start sending once the shop's mail service is connected.</p>` : ""}<div data-mailview></div></section>
    <p class="err" role="alert" data-err></p>
    <div class="sheet__act">${next ? `<button class="btn" type="button" data-next="${next[0]}">${next[1]}</button>` : ""}<button class="btn btn--ghost" type="button" data-close>Close</button></div></div>`;
  if (!sheet.open) sheet.showModal();
}

const MAIL = { order_placed: "Order received", order_shipped: "Shipped", pickup_ready: "Ready for pickup", low_stock: "Low stock note to the shop" };
async function mailView(id) {
  const box = $("[data-mailview]", sheet); if (!box) return;
  const { email: e } = await api("/emails/" + id);
  box.innerHTML = `<p class="fineprint" style="margin-top:var(--s-4)">To ${esc(e.recipient)} &middot; ${esc(e.subject)}</p><iframe class="mail" title="Email preview" sandbox=""></iframe>`;
  $("iframe", box).srcdoc = e.html; // sandboxed: the preview cannot run scripts or touch the back office
}
// ---------- shell ----------
async function loadProducts() { const r = await api("/products"); state.products = r.products; state.categories = r.categories; state.boxes = r.boxes; }
async function loadOrders() { state.orders = (await api("/orders")).orders; }
function chrome() {
  const todo = state.orders.filter(o => ["paid", "packed", "ready"].includes(o.status)).length;
  $$("[data-tab]").forEach(b => { b.toggleAttribute("aria-current", false); if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page"); if (b.dataset.tab === "orders") b.innerHTML = "Orders" + (todo ? `<i class="num">${todo}</i>` : ""); });
}
async function render() {
  chrome();
  if (state.tab === "stock") main.innerHTML = viewStock();
  else if (state.tab === "orders") main.innerHTML = viewOrders();
  else { const s = await api("/summary"); if (state.tab === "home") main.innerHTML = viewHome(s); }
}
async function boot() {
  try { await Promise.all([loadProducts(), loadOrders()]); } catch { return; }
  state.in = true; $("[data-tabs]").hidden = false; $("[data-end]").hidden = false; await render();
}
document.addEventListener("click", async e => {
  const t = e.target;
  let el;
  if ((el = t.closest("[data-tab]"))) { state.tab = el.dataset.tab; await render(); scrollTo(0, 0); return; }
  if ((el = t.closest("[data-go]"))) { const [tab, f] = el.dataset.go.split(":"); state.tab = tab; if (tab === "stock") state.cat = f; else state.oflt = f; await render(); scrollTo(0, 0); return; }
  if ((el = t.closest("[data-cat]"))) { state.cat = el.dataset.cat; return render(); }
  if ((el = t.closest("[data-oflt]"))) { state.oflt = el.dataset.oflt; return render(); }
  if (t.closest("[data-new]")) return editSheet(null);
  if ((el = t.closest("[data-edit]"))) return editSheet(state.products.find(p => p.sku === el.dataset.edit));
  if ((el = t.closest("[data-order]"))) return orderSheet(el.dataset.order).catch(er => toast(er.message));
  if ((el = t.closest("[data-mail]"))) return mailView(el.dataset.mail).catch(er => toast(er.message));
  if (t.closest("[data-close]")) return sheet.close();
  if (t.closest("[data-logout]")) { await api("/logout", { method: "POST", body: {} }).catch(() => {}); state.in = false; return gate(); }
  if ((el = t.closest("[data-next]"))) { const id = el.closest("[data-ordersheet]").dataset.ordersheet; el.disabled = true;
    try { await api(`/orders/${id}/status`, { method: "POST", body: { status: el.dataset.next } }); await loadOrders(); await orderSheet(id); render(); toast("Order updated."); } catch (er) { $("[data-err]", sheet).textContent = er.message; el.disabled = false; } return; }
  if ((el = t.closest("[data-step]"))) {
    const row = el.closest("[data-sku]"), p = state.products.find(x => x.sku === row.dataset.sku), delta = +el.dataset.step, before = p.stock;
    if (p.stock + delta < 0) return;
    p.stock += delta; paintRow(row, p); // show it at once, then confirm with the store
    try { const r = await api(`/products/${p.sku}/stock`, { method: "POST", body: { delta, reason: "correction" } }); p.stock = r.stock; paintRow(row, p); }
    catch (er) { p.stock = er.data && typeof er.data.stock === "number" ? er.data.stock : before; paintRow(row, p); toast(er.message); }
  }
});
function paintRow(row, p) { const [k, label] = stockState(p), s = $("[data-state]", row); $("output", row).textContent = p.stock; s.className = "state " + k; s.textContent = label; $('[data-step="-1"]', row).disabled = p.stock <= 0; }
let qT; document.addEventListener("input", e => { if (e.target.id !== "q") return; state.q = e.target.value; clearTimeout(qT); qT = setTimeout(() => { const rows = $("[data-rows]"); if (rows) rows.innerHTML = stockList().map(stockRow).join("") || `<p class="empty">Nothing matches. Clear the search or pick another section.</p>`; }, 80); });
sheet.addEventListener("click", e => { if (e.target === sheet) sheet.close(); });

api("/products").then(() => boot()).catch(() => { if (!state.in) gate(); });
