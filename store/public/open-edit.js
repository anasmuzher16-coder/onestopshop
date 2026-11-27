// The preview's open edit on an item's own page (owner, 2026-11-27: "have it so they can fill in price on the actual item page,
// let's make it as easy as possible"). Loaded only while the Worker's PREVIEW_OPEN_EDIT switch is on (src/preview.js writes the
// script tag and the meta below into the page; off, neither is there and /api/open-edit answers 404).
// The item page gets an "Edit this item" bar under its name, and a sheet with the back office item editor's own fields: name,
// colours (the same swatches, add your own), shelf count and price. Save goes through the same server save as the back office
// (src/admin.js itemInfo), then the page reloads in place to show the new price, colours and stock.
const SCOPE = document.querySelector('meta[name="oss-open-edit"]')?.content;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HEX = /^#[0-9a-f]{6}$/i, SKU = /^OSS-\d{4,6}$/;
const NEED = { price: "price", colours: "colours", stock: "shelf count", length: "length", check: "a name check" };
const needs = d => (d.needs || []).filter(k => Object.hasOwn(NEED, k));   // a need the panel has no words for is not printed
const words = l => l.length > 1 ? l.slice(0, -1).join(", ") + " and " + l.at(-1) : l[0] || "";
// the back office's palette (public/admin.js PALETTE): Clear and Rainbow are drawn by CSS
const PALETTE = [["Black", "#141414"], ["Silver", "#c3c5c9"], ["Gold", "#c9a24a"], ["Rose gold", "#c48b7f"], ["Red", "#c2262e"], ["Blue", "#2b59c3"], ["Green", "#2e8b57"], ["Purple", "#6c3fa6"], ["Pink", "#e58bb4"], ["White", "#f3f1ea"], ["Clear", ""], ["Rainbow", ""], ["Gunmetal", "#4b5057"], ["Bronze", "#8a5a2b"]];
const swatch = (name, hex, on, custom) => `<button class="sw" type="button" data-sw data-name="${esc(name)}"${custom && HEX.test(hex) ? ` data-hex="${esc(hex)}"` : ""} aria-pressed="${on}"><i class="sw__dot${name === "Clear" && !custom ? " sw__dot--clear" : name === "Rainbow" && !custom ? " sw__dot--rainbow" : ""}"${HEX.test(hex) ? ` style="background:${hex}"` : ""}></i><span>${esc(name)}</span></button>`;
const store = { get(k) { try { return JSON.parse(sessionStorage.getItem("oss:oe-" + k)); } catch { return null; } }, set(k, v) { try { v == null ? sessionStorage.removeItem("oss:oe-" + k) : sessionStorage.setItem("oss:oe-" + k, JSON.stringify(v)); } catch {} } };

// one request per item at a time (the page may redraw while it is on its way); known: the answers already back
const cache = new Map(), known = new Map();
function load(sku, fresh = false) {
  if (!fresh && cache.has(sku)) return cache.get(sku);
  const p = fetch("/api/open-edit/" + sku, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(r => r.ok ? r.json() : null).catch(() => null).then(d => { if (d) known.set(sku, d); else cache.delete(sku); return d; });   // a failed request is tried again on the next draw
  cache.set(sku, p); return p;
}

let sheet = null;
function makeSheet() {
  sheet = document.createElement("dialog");
  sheet.className = "sheet oe"; sheet.setAttribute("aria-labelledby", "oe-h"); sheet.dataset.oeSheet = "";
  document.body.append(sheet);
  sheet.addEventListener("click", e => { if (e.target === sheet) sheet.close(); });   // a tap on the dimmed page closes it
  return sheet;
}

// ---------- the bar under the item's name ----------
const shownSku = () => { const s = $(".pdp [data-stage]")?.dataset.stage; return SKU.test(s || "") ? s : null; };
async function ensureBar() {
  const sku = shownSku(), name = $(".pdp .pdp__name");
  if (!sku || !name) return;
  const had = $("[data-oe-bar]");
  if (had && had.dataset.oeBar === sku) return;
  if (known.has(sku) && !known.get(sku)?.editable) { had?.remove(); return; }   // known not editable: never drawn again (no draw-and-remove loop)
  had?.remove();
  const bar = document.createElement("div");
  bar.className = "oe-bar"; bar.dataset.oeBar = sku;
  bar.innerHTML = `<p class="oe-bar__k">Shop edit</p><p class="oe-bar__need" data-oe-need></p>
    <div class="oe-bar__row"><button class="btn oe-bar__edit" type="button" data-oe-open>Edit this item</button><a class="oe-bar__next" data-oe-next hidden href="/shop">Next item that needs info</a></div>
    <p class="oe-bar__said" role="status" data-oe-said></p>`;
  name.after(bar);
  const saved = store.get("saved"); if (saved && typeof saved.msg === "string") { $("[data-oe-said]", bar).textContent = saved.msg; store.set("saved", null); }
  const d = await load(sku); if (!bar.isConnected) return;
  if (!d) { $("[data-oe-need]", bar).textContent = "Could not load this item. Tap Edit this item to try again."; return; }   // the bar stays (no redraw), the button tries again
  if (!d.editable) { bar.remove(); return; }   // a made-up sample or anything else not editable here: no bar at all
  $("[data-oe-need]", bar).textContent = needs(d).length ? `Needs ${words(needs(d).map(k => NEED[k]))}.` : "Everything is filled in.";
  const next = $("[data-oe-next]", bar);
  if (d.next) { next.href = "/p/" + d.next; next.hidden = false; next.textContent = `Next item that needs info (${d.left - (d.needs.length ? 1 : 0)} left)`; }
  if (store.get("open") === sku) { store.set("open", null); openSheet(sku); }
}

// ---------- the editor ----------
async function openSheet(sku) {
  const d = await load(sku, true); if (!d || !d.editable) return;
  if (!sheet) makeSheet();
  const had = d.colours.map(c => c.name), known = new Set(PALETTE.map(x => x[0].toLowerCase()));
  const custom = d.colours.filter(c => !known.has(c.name.toLowerCase()));
  sheet.innerHTML = `<form class="sheet__form oe__form" data-oe-form="${esc(d.sku)}" novalidate>
    <div class="oe__top"><div><p class="oe__meta">${esc(d.sku)}${needs(d).length ? ` &middot; needs ${esc(words(needs(d).map(k => NEED[k])))}` : ""}</p><h2 class="sheet__h" id="oe-h">Edit this item</h2></div><button class="oe__x" type="button" data-oe-close>Close</button></div>
    <p class="sheet__p">Fill in what you know and leave the rest. Only what you change is saved.</p>
    <label class="field__label" for="oe-name">Name</label>
    <input class="field field--text" id="oe-name" name="name" value="${esc(d.name)}" maxlength="80" autocomplete="off" required>
    ${d.has_length ? `<label class="field__label" for="oe-length">Length</label>
    <input class="field field--text" id="oe-length" name="length" value="${esc(d.length)}" maxlength="30" autocomplete="off" placeholder="60.5 inches" aria-describedby="oe-length-say">
    <p class="oe__help" id="oe-length-say">Up to 30 letters and numbers, like 60.5 inches.</p>` : ""}
    ${d.check ? `<label class="oe__check"><input type="checkbox" id="oe-checked" name="checked" value="1"> <span>Checked with the shop</span></label>
    <p class="oe__help">Tick it once the name and length are right. It cannot be unticked here.</p>` : ""}
    <fieldset class="oe__cols"><legend class="field__label">Colours <span class="oe__n" data-oe-count></span></legend>
      <p class="oe__help">${d.family_row || d.hookah_row ? "This is one colour version of this item, so these colours are for this one only. Pick its colour; for two tones, pick both." : "Tap every colour the shop has of this item."}</p>
      <div class="sw-grid" data-swgrid>${PALETTE.map(([n, h]) => swatch(n, h, had.some(x => x.toLowerCase() === n.toLowerCase()), false)).join("")}${custom.map(c => swatch(c.name, c.hex || "", true, true)).join("")}</div>
      <button class="link oe__add" type="button" data-oe-addcol aria-expanded="false" aria-controls="oe-newcol">Add another colour</button>
      <div class="oe__new" id="oe-newcol" data-oe-newcol hidden>
        <div><label class="field__label" for="oe-newname">Colour name</label><input class="field field--text" id="oe-newname" name="newcol" maxlength="24" autocomplete="off"></div>
        <div><label class="field__label" for="oe-newhex">Swatch</label><input class="oe__hex" id="oe-newhex" name="newhex" type="color" value="#808080"></div>
        <button class="btn btn--ghost" type="button" data-oe-addgo>Add</button></div></fieldset>
    <div class="oe__nums">
      <div><label class="field__label" for="oe-stock">Stock, on the shelf</label><input class="field num" id="oe-stock" name="stock" inputmode="numeric" pattern="[0-9]*" maxlength="5" autocomplete="off" enterkeyhint="next" value="${d.counted ? esc(d.stock) : ""}" data-seen="${esc(d.stock)}" data-was="${d.counted ? esc(d.stock) : ""}" aria-describedby="oe-stock-say">
        <p class="oe__help" id="oe-stock-say">${d.counted ? "Counted. Type a new count to change it." : "Not counted yet. Type what is on the shelf, 0 if none."}</p></div>
      <div><label class="field__label" for="oe-price">Price, $ CAD</label><input class="field num" id="oe-price" name="price" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${d.price_cents ? (d.price_cents / 100).toFixed(2) : ""}" aria-describedby="oe-price-say">
        <p class="oe__help" id="oe-price-say">${d.price_cents ? "In dollars, like 24.99." : "In dollars, like 24.99. A price puts it on sale in place of Price TBD."}</p></div></div>
    <p class="field__err" role="alert" data-oe-err hidden></p>
    <div class="sheet__row oe__act"><button class="btn" type="submit" data-then="stay">Save</button>${d.next ? `<button class="btn btn--ghost" type="submit" data-then="next">Save and next item</button>` : ""}</div></form>`;
  const f = $("[data-oe-form]", sheet); f.dataset.orig = JSON.stringify(had); f.dataset.next = d.next || ""; f.dataset.priceWas = d.price_cents || ""; f.dataset.nameWas = d.name; f.dataset.lengthWas = d.length || "";
  count(f);
  if (!sheet.open) sheet.showModal();
}
const picked = f => $$("[data-sw][aria-pressed=true]", f).map(b => b.dataset.hex ? { name: b.dataset.name, hex: b.dataset.hex } : { name: b.dataset.name });
function count(f) { const n = picked(f).length, o = $("[data-oe-count]", f); if (o) o.textContent = n ? `${n} picked` : "none picked"; }
const fail = (f, msg, input) => { const e = $("[data-oe-err]", f); e.textContent = msg; e.hidden = !msg; if (input) { input.setAttribute("aria-invalid", "true"); input.focus(); } };
function addColour(f) {
  const name = f.newcol.value.replace(/\s+/g, " ").trim();
  if (!/^\p{L}[\p{L} &/'-]{0,23}$/u.test(name)) return fail(f, "Give the colour a name, letters only, up to 24.", f.newcol);
  const same = $$("[data-sw]", f).find(b => b.dataset.name.toLowerCase() === name.toLowerCase());
  if (same) same.setAttribute("aria-pressed", "true"); else $("[data-swgrid]", f).insertAdjacentHTML("beforeend", swatch(name, f.newhex.value, true, true));
  fail(f, ""); f.newcol.removeAttribute("aria-invalid"); f.newcol.value = ""; f.newhex.value = "#808080"; count(f); f.newcol.focus();
}

document.addEventListener("click", e => {
  const t = e.target;
  if (t.closest("[data-oe-open]")) { const s = t.closest("[data-oe-bar]")?.dataset.oeBar; if (s) openSheet(s); return; }
  if (!sheet || !sheet.contains(t)) return;
  const f = $("[data-oe-form]", sheet); let el;
  if (t.closest("[data-oe-close]")) return sheet.close();
  if ((el = t.closest("[data-sw]"))) { el.setAttribute("aria-pressed", el.getAttribute("aria-pressed") === "true" ? "false" : "true"); return count(f); }
  if ((el = t.closest("[data-oe-addcol]"))) { const box = $("[data-oe-newcol]", f), open = box.hidden; box.hidden = !open; el.setAttribute("aria-expanded", String(open)); if (open) f.newcol.focus(); return; }
  if (t.closest("[data-oe-addgo]")) return addColour(f);
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.name === "newcol" && sheet?.contains(e.target)) { e.preventDefault(); addColour(e.target.form); } });
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-oe-form]"); if (!f) return; e.preventDefault();
  const sku = f.dataset.oeForm, then = e.submitter?.dataset.then || "stay";
  fail(f, ""); $$("[aria-invalid]", f).forEach(i => i.removeAttribute("aria-invalid"));
  const body = {}, name = f.name.value.trim(), stock = f.stock.value.trim(), price = f.price.value.trim().replace(/^\$\s*/, "").replace(/,/g, "");
  if (!name) return fail(f, "Give it a name.", f.name);
  if (name !== f.dataset.nameWas) body.name = name;
  const lenIn = $("#oe-length", f), tick = $("#oe-checked", f);
  if (lenIn) { const len = lenIn.value.replace(/\s+/g, " ").trim(); if (len !== f.dataset.lengthWas) { if (!/^[\p{L}\p{N} .,'"\/-]{1,30}$/u.test(len)) return fail(f, "Length is up to 30 letters and numbers, like 60.5 inches.", lenIn); body.length = len; } }
  if (tick?.checked) body.checked = true;
  const cols = picked(f), orig = JSON.parse(f.dataset.orig);
  if (cols.map(c => c.name.toLowerCase()).sort().join("|") !== orig.map(n => n.toLowerCase()).sort().join("|")) body.colours = cols;
  if (stock !== "" && stock !== f.stock.dataset.was) { if (!/^\d{1,5}$/.test(stock)) return fail(f, "Stock is a whole number, like 4. Type 0 if there are none.", f.stock); body.stock = { counted: +stock, seen: +f.stock.dataset.seen }; }
  if (price !== "") {
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(price) || !(+price > 0) || +price > 50000) return fail(f, "Enter the price in dollars, like 24.99.", f.price);
    const c = Math.round(+price * 100); if (String(c) !== f.dataset.priceWas) body.price_cents = c;
  }
  const go = () => { if (then === "next" && f.dataset.next) { store.set("open", f.dataset.next); location.assign("/p/" + f.dataset.next); } else location.reload(); };
  if (!Object.keys(body).length) { if (then === "next") return go(); return fail(f, "Nothing changed yet."); }
  const btns = $$("button[type=submit]", f); btns.forEach(b => b.disabled = true);
  try {
    const r = await fetch("/api/open-edit/" + sku, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (d.changed) { f.stock.dataset.seen = d.stock; f.stock.dataset.was = ""; f.stock.value = ""; $("#oe-stock-say", f).textContent = `On record now: ${d.stock}. Count again.`; }
      btns.forEach(b => b.disabled = false); return fail(f, d.error || "That did not save. Try again.", d.changed ? f.stock : null);
    }
    store.set("saved", { sku, msg: d.on_sale && body.price_cents ? `Saved. ${name} is on sale at $${(d.price_cents / 100).toFixed(2)}.` : "Saved. The page shows the change." });
    go();
  } catch { btns.forEach(b => b.disabled = false); fail(f, "That did not save. Check the connection and try again."); }
});

if (SCOPE) {
  const main = $("#main");
  if (main) { new MutationObserver(() => { ensureBar(); }).observe(main, { childList: true, subtree: true }); ensureBar(); }
}
