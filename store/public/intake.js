// The shop's questionnaire (the owner's ask via Jamal, 2026-11-25): everything still needed to go live, on one page the shop's
// owner fills in on his phone. Lists come from the live catalogue, so they always match the site. Answers save on the phone as he
// types and go to the store with Send (POST /api/intake/<link>, kept as a file per send; nothing is changed on the site by it).
const SLUG = location.pathname.split("/").filter(Boolean)[1] || "", KEY = "oss:intake:" + SLUG, root = document.getElementById("form-root");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byName = (a, b) => a.name.localeCompare(b.name);
// the catalogue is loaded here, not imported at the top, so a weak signal shows a message and a way back, never an endless "Loading"
let PRODUCTS, ticked;
try { [{ PRODUCTS }, { ticked }] = await Promise.all([import("/api/catalog-module"), import("/picks.js")]); }
catch { document.getElementById("loading").innerHTML = 'The shop list did not load. Check your signal, then <button class="link" type="button" id="retry">try again</button>. Anything you typed before is still saved on this phone.'; document.getElementById("retry").onclick = () => location.reload(); throw new Error("catalogue did not load"); }

// the catalogue, as the site shows it
const fams = new Map();
for (const p of PRODUCTS) if (p.cat === "hookahs" && p.family) { if (!fams.has(p.family)) fams.set(p.family, []); fams.get(p.family).push(p); }
const famList = [...fams.values()].map(v => ({ lead: v.find(p => p.lead) || v[0], all: v })).map(f => ({ ...f, name: f.lead.name, inShop: f.all.some(ticked) })).sort(byName);
const inShop = famList.filter(f => f.inShop), fromBook = famList.filter(f => !f.inShop);
const foil = PRODUCTS.filter(p => p.cat === "heat" && /foil/i.test(p.name)).sort(byName);
const coal = PRODUCTS.filter(p => p.cat === "charcoal").sort(byName);

// small builders; every control has a stable id and name
const text = (id, label, o = {}) => `<div class="q"><label class="q__l" for="${id}">${label}</label>${o.hint ? `<p class="q__h">${o.hint}</p>` : ""}${o.area ? `<textarea id="${id}" name="${id}" rows="${o.rows || 3}"></textarea>` : `<input id="${id}" name="${id}" type="${o.type || "text"}" ${o.mode ? `inputmode="${o.mode}"` : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} autocomplete="${o.ac || "off"}">`}</div>`;
const pick = (id, label, opts, o = {}) => `<fieldset class="q"><legend class="q__l">${label}</legend>${o.hint ? `<p class="q__h">${o.hint}</p>` : ""}<div class="opts">${opts.map((t, i) => `<label class="opt"><input type="radio" name="${id}" id="${id}-${i}" value="${esc(t)}"><span>${t}</span></label>`).join("")}</div></fieldset>`;
const check = (id, label) => `<label class="opt opt--check"><input type="checkbox" name="${id}" id="${id}" value="yes"><span>${label}</span></label>`;
const money = (id, label) => `<label class="money" for="${id}"><span class="money__n">${label}</span><span class="money__in"><span aria-hidden="true">$</span><input id="${id}" name="${id}" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off"></span></label>`;
const sec = (n, title, body, lead = "") => `<section class="sec" aria-labelledby="h${n}"><h2 class="sec__h" id="h${n}"><span class="sec__n">${n}</span>${title}</h2>${lead ? `<p class="sec__lead">${lead}</p>` : ""}${body}</section>`;

// a colour with no name, or a name two colours share, is shown by its swatch and a number, never guessed
function chipLabels(all) {
  const seen = {}, count = {}; for (const v of all) if (v.colour) count[v.colour] = (count[v.colour] || 0) + 1;
  let n = 0; return all.map(v => { if (!v.colour) return [v, "unnamed " + ++n]; if (count[v.colour] < 2) return [v, v.colour]; seen[v.colour] = (seen[v.colour] || 0) + 1; return [v, v.colour + " " + seen[v.colour]]; });
}
const hookahRows = inShop.map((f, i) => `<div class="item">
  <div class="item__top"><span class="item__name">${esc(f.name)}</span>${money("hp-" + f.lead.sku, "Price")}</div>
  ${f.all.length > 1 ? `<p class="q__h">Colours you have in the shop (tick by the swatch)</p><div class="chips">${chipLabels(f.all).map(([v, label]) => `<label class="chip"><input type="checkbox" name="hc-${f.lead.sku}" id="hc-${v.sku}" value="${v.sku}"><i style="background:${/^#[0-9a-f]{6}$/i.test(v.chip || "") ? v.chip : "transparent"}"></i><span>${esc(label)}</span></label>`).join("")}</div>
  <input class="q__mini" id="hn-${f.lead.sku}" name="hn-${f.lead.sku}" type="text" autocomplete="off" placeholder="Colour names, if you know them (e.g. gold, matte black)">` : ""}
</div>`).join("");

const build = () => [
  sec(1, "Card payments (Stripe)", `${check("stripe-signed", "We signed up for Stripe at stripe.com, in the shop's name")}${check("stripe-team", "We added you (Dijji) as a team member")}${check("stripe-shisha", "We emailed Stripe support asking them to approve the herbal shisha in writing")}
    ${text("stripe-note", "Anything Stripe asked for that you got stuck on?", { area: true, rows: 2 })}`,
    "This is how the site takes cards. Signing up is free and needs the business name and address, Angel's ID, and the bank account for payouts. When it asks what you sell: hookahs, charcoal, foil and herbal tobacco-free shisha."),
  sec(2, "Hookah prices", `<p class="sec__lead">The ${inShop.length} hookahs you have in the shop. Price before tax, and tick the colours you actually have.</p><div class="items">${hookahRows}</div>
    ${pick("book", `The other ${fromBook.length} hookahs from the Ace catalogue`, ["Show them on the site as \"order from the catalogue\"", "Leave them off the site", "We will send a price for each"])}
    ${text("book-note", "Anything about the catalogue hookahs", { area: true, rows: 2 })}`),
  sec(3, "Prices we don't have yet", `<div class="items items--flat">${money("ti-cubettes", "Titanium Cubettes, single roll")}${money("ti-flats", "Titanium Flats, single roll")}${money("ti-cubes", "Titanium Cubes, single roll")}</div>
    ${text("other-stock", "Everything else you want on the site: bowls, hoses, parts, tongs, cologne and anything else", { area: true, rows: 6, hint: "One per line: name, price, how many you have. Example: Kaloud-style bowl, $25, 4. Or text shelf photos to Jamal instead." })}`),
  sec(4, "Stock", `${pick("stock", "Every item starts at 10 on the site. Is that OK for now?", ["Yes, 10 is fine for now", "No, we will send real counts", "We sent shelf photos to Jamal"])}
    ${text("stock-note", "Counts or notes", { area: true, rows: 3 })}`),
  sec(5, "Foil pack weights", `<p class="sec__lead">Roughly what each pack weighs, so foil can be shipped. A kitchen scale is fine.</p><div class="items items--flat">${foil.map(p => `<label class="money" for="fw-${p.sku}"><span class="money__n">${esc(p.name)}</span><span class="money__in"><input id="fw-${p.sku}" name="fw-${p.sku}" type="text" inputmode="numeric" placeholder="0" autocomplete="off"><span aria-hidden="true">g</span></span></label>`).join("")}</div>`),
  sec(6, "Quick-light charcoal", `<p class="sec__lead">Tick the boxes that light with a lighter (quick-light). Customers filter for it.</p><div class="opts opts--list">${coal.map(p => check("ql-" + p.sku, esc(p.name))).join("")}</div>`),
  sec(7, "Quick checks", [
    pick("sultana", "Sultana charcoal tablets: your list says 120, every box online says 100. Which do you have?", ["100 tablets", "120 tablets", "Both"]),
    pick("zanobia-foil", "Zanobia foil: your list says 27 sheets, the pack says 30.", ["30 sheets", "27 sheets", "Not sure"]),
    pick("cocomax", "Coco Max: your list says 108 half cubes, the box online is 72.", ["108 half cubes", "72", "Not sure"]),
    pick("duracubes", "Duracubes: your list says hexagon sticks, the box online is 64 cubes.", ["Hexagon sticks", "64 cubes", "Not sure"]),
    text("tablet-sizes", "Three Kings and Tanya tablets: what size (mm)?", { ph: "e.g. 33 mm and 40 mm" }),
    text("fuego", "Coco Fuego \"Jumbo Hexastar\": what does the box actually say?"),
    text("tub-names", "Karizma Gum Cinnamon, Karizma Grapefruit and Majalis 69: are those the exact names on the tubs?", { ph: "Yes, or the right names" }),
    pick("genuine", "Ace hookahs named after other brands (Darkside, Tsar, Maklaud and others): are they genuine?", ["Yes, genuine", "No, list them by model number only", "Not sure"]),
    pick("stems", "Ace stem sets (no base): how do you sell them?", ["On their own, no base", "With a base included", "Don't sell them"]),
    text("special", "What does \"SPECIAL\" mean on 10 of the Ace catalogue pages?"),
    pick("p16", "Is the page 16 hookah (EGY-XME3) in stock?", ["Yes", "No", "Not sure"]),
    text("p33", "What is the mark on page 33 of the Ace catalogue?"),
  ].join("")),
  sec(8, "Business details", `${text("legal", "Legal business name", { ac: "organization" })}${text("hst", "HST number", { ph: "123456789 RT0001" })}${text("phone", "Shop phone, as you want it shown", { type: "tel", ac: "tel" })}${text("hours", "Hours, as you want them shown", { area: true, rows: 3, ph: "Mon to Sat 10 to 9, Sun 11 to 7" })}${text("order-email", "Email for new-order notifications", { type: "email", ac: "email" })}`,
    "For receipts and the site's legal pages."),
  sec(9, "Canada Post", `${pick("cp", "A Canada Post business account (free) gets cheaper rates and printable labels.", ["We have one", "We made one", "Not yet"], { hint: "Sign up here if you don't have one: <a class=\"link\" href=\"https://www.canadapost-postescanada.ca/cpc/en/small-business.page\" target=\"_blank\" rel=\"noopener\">canadapost-postescanada.ca/cpc/en/small-business.page</a>" })}`),
  sec(10, "Google listing", `${check("google", "We added you (Dijji) as a manager on the shop's Google Business Profile")}`),
  sec(11, "Back office logins", `${text("logins", "How many back office logins would you like?", { mode: "numeric", ph: "e.g. 3" })}`),
  `<section class="send"><div class="q"><label class="q__l" for="who">Your name</label><input id="who" name="who" type="text" autocomplete="name"></div>
    ${text("anything", "Anything else we should know?", { area: true, rows: 3 })}
    <button class="btn btn--wide" type="submit" id="send">Send to Dijji</button><p class="send__msg" id="msg" role="status"></p></section>`,
].join("");

const form = document.createElement("form"); form.className = "iq__form"; form.noValidate = true; form.innerHTML = build();
document.getElementById("loading").remove(); root.append(form);

// every named answer, as one plain object (checkbox groups become lists)
function answers() {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.type === "submit") continue;
    if (el.type === "checkbox") { if (!el.checked) continue; if (el.name.startsWith("hc-")) (out[el.name] ||= []).push(el.value); else out[el.name] = true; }
    else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; }
    else if (el.value.trim()) out[el.name] = el.value.trim();
  }
  return out;
}
function restore(a) {
  for (const el of form.elements) {
    if (!el.name || !(el.name in a)) continue; const v = a[el.name];
    if (el.type === "checkbox") el.checked = Array.isArray(v) ? v.includes(el.value) : !!v; else if (el.type === "radio") el.checked = el.value === v; else el.value = v;
  }
}
const saved = document.getElementById("saved");
try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); if (d) { restore(d); saved.textContent = "Your saved answers are back."; } } catch {}
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(answers())); saved.textContent = "Saved on this phone."; } catch {} };
let tm = 0; form.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(keep, 400); });
addEventListener("pagehide", keep); document.addEventListener("visibilitychange", () => { if (document.hidden) keep(); });
// Go or Enter on a phone keyboard moves on; only the Send button sends
form.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "submit") { e.preventDefault(); e.target.blur(); } });

// labels, so the answers read on their own at the other end
function labelled(a) {
  const name = Object.fromEntries(PRODUCTS.map(p => [p.sku, p.name])), rows = [];
  for (const [k, v] of Object.entries(a)) { const sku = k.match(/(OSS-\d+)$/)?.[1]; rows.push({ key: k, item: sku ? name[sku] : undefined, value: v }); }
  return rows;
}
const msg = document.getElementById("msg"), btn = document.getElementById("send");
form.addEventListener("submit", async e => {
  e.preventDefault(); const a = answers();
  if (!Object.keys(a).length) { msg.textContent = "Nothing filled in yet. Answer what you can, then send."; return; }
  btn.disabled = true; btn.textContent = "Sending..."; msg.textContent = "";
  try {
    const r = await fetch("/api/intake/" + encodeURIComponent(SLUG), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: a, rows: labelled(a), sentAt: new Date().toISOString() }), signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "The store did not take it");
    msg.textContent = "Sent. Thank you. You can change anything and send again; we keep every version.";
  } catch (err) { msg.textContent = (["TypeError", "TimeoutError", "AbortError"].includes(err.name) ? "That did not go through: the connection dropped." : "That did not go through: " + err.message + ".") + " Your answers are still here. Press Send again when you have signal."; }
  btn.disabled = false; btn.textContent = "Send to Dijji";
});
