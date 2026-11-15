# One-off edit (kept as history): emails and backup in the back office screens, privacy and terms pages, footer
# links, smoke fallback for phones with no graphics context. Run from store/: python tools/step-ui2.py
def edit(path, pairs, append=''):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s + append)

edit('tools/seed.mjs', [('const out = ["DELETE FROM product_photos;', 'const out = ["DELETE FROM emails; DELETE FROM sessions; DELETE FROM login_attempts; DELETE FROM product_photos;')])

# ---- back office screens
edit('public/admin.js', [
    ('  const { order: o, items } = await api("/orders/" + id),', '  const { order: o, items, emails = [] } = await api("/orders/" + id),'),
    ('''    <p class="err" role="alert" data-err></p>
    <div class="sheet__act">${next ?''',
     '''    <section><h3 class="meta" style="margin-bottom:var(--s-2)">Emails to the customer</h3><div class="hist">${emails.map(e => `<button class="mailrow" type="button" data-mail="${e.id}"><span>${esc(MAIL[e.kind] || e.kind)}, ${when(e.at)}</span><span class="state ${e.status === "sent" ? "done" : e.status === "failed" ? "out" : "low"}">${e.status === "sent" ? "Sent" : e.status === "failed" ? "Failed" : "Written, not sent"}</span></button>`).join("") || `<div><span>None yet.</span></div>`}</div>
      ${emails.some(e => e.status === "held") ? `<p class="fineprint">Emails are written and kept here. They start sending once the shop's mail service is connected.</p>` : ""}<div data-mailview></div></section>
    <p class="err" role="alert" data-err></p>
    <div class="sheet__act">${next ?'''),
    ('// ---------- shell ----------', '''const MAIL = { order_placed: "Order received", order_shipped: "Shipped", pickup_ready: "Ready for pickup", low_stock: "Low stock note to the shop" };
async function mailView(id) {
  const box = $("[data-mailview]", sheet); if (!box) return;
  const { email: e } = await api("/emails/" + id);
  box.innerHTML = `<p class="fineprint" style="margin-top:var(--s-4)">To ${esc(e.recipient)} &middot; ${esc(e.subject)}</p><iframe class="mail" title="Email preview" sandbox=""></iframe>`;
  $("iframe", box).srcdoc = e.html; // sandboxed: the preview cannot run scripts or touch the back office
}
// ---------- shell ----------'''),
    ('  if ((el = t.closest("[data-order]"))) return orderSheet(el.dataset.order).catch(er => toast(er.message));',
     '  if ((el = t.closest("[data-order]"))) return orderSheet(el.dataset.order).catch(er => toast(er.message));\n  if ((el = t.closest("[data-mail]"))) return mailView(el.dataset.mail).catch(er => toast(er.message));'),
    ('''        <div><dt>Stock at shelf price</dt><dd class="num">${money(s.value.retail_cents, true)}</dd></div></dl></section>''',
     '''        <div><dt>Stock at shelf price</dt><dd class="num">${money(s.value.retail_cents, true)}</dd></div></dl>
        <p class="fineprint" style="margin-top:var(--s-4)"><a href="/api/admin/backup" download>Download a backup</a> of every product, order and stock change, as one file.</p></section>'''),
])
edit('public/admin.css', [], '''
/* emails in the order view, and small print */
.mailrow{display:flex;justify-content:space-between;align-items:center;gap:var(--s-3);width:100%;min-height:44px;padding:6px 0;border-top:1px solid var(--color-line);text-align:left;font-size:var(--t-14)}
.mailrow:hover span:first-child{text-decoration:underline;text-underline-offset:.2em}
.fineprint{font-size:var(--t-12);color:var(--color-muted);margin-top:var(--s-2)}
.fineprint a{color:var(--color-strong)}
.mail{display:block;width:100%;height:420px;border:1px solid var(--color-line);border-radius:var(--radius);background:#f4f0e8;margin-top:var(--s-2)}
''')

# ---- store pages: privacy and terms
edit('public/app.js', [
    ('const viewMissing = () =>', '''// ---------- the small print ----------
const DRAFT = `<p class="done__tag"><span>Draft</span> <b>for the shop to review</b></p>`;
const doc = (title, lead, parts) => `<section class="cart doc">${DRAFT}<h1 class="h2 h2--xl">${title}</h1><p class="lead">${lead}</p>${parts.map(([h, body]) => `<h2 class="h3">${h}</h2>${body.map(t => `<p>${t}</p>`).join("")}`).join("")}</section>`;
const viewPrivacy = () => doc("Privacy", "What we collect when you order, why, and how to ask about it.", [
  ["What we collect", ["Your name, email, phone number if you give it, and delivery address, so we can send your order and answer questions about it.", "Your card details go straight to the payment company. We never see or store the card number."]],
  ["What we do not do", ["We do not sell or rent your details. We do not use advertising trackers. Visit counts on this site use no cookies and do not identify you."]],
  ["Who else sees it", ["The carrier gets your name and address to deliver the parcel. The payment company gets what it needs to take the payment. Our hosting company stores the order on our behalf."]],
  ["How long we keep it", ["Order records are kept for six years, because tax law requires it. After that they are deleted."]],
  ["Your choices", ["You can ask to see what we hold about you, to correct it, or to have it deleted where the law allows. Email or call the counter and we will answer within 30 days.", "Marketing emails are only sent if you ask for them, and every one has an unsubscribe link."]],
  ["Who to ask", ["The person responsible for privacy at the shop is the manager. Call 519-255-2222."]],
]);
const viewTerms = () => doc("Terms of sale", "The plain rules for buying from us online.", [
  ["Prices and tax", ["Prices are in Canadian dollars. Tax is added at checkout, based on the province the order ships to."]],
  ["Shipping", ["We ship within Canada. The price at checkout is the price you pay for shipping. Delivery times are the carrier's estimates. Cologne ships by ground only."]],
  ["Pickup", ["Pickup at the Windsor counter is free. We email you when the order is ready and hold it for 14 days."]],
  ["Returns", ["Unused items in their original packaging can be returned within 14 days for a refund to the original payment method. Opened cologne cannot be returned."]],
  ["Damage in transit", ["If something arrives broken, keep the packaging, take a photo and tell us within 3 days. We will replace it or refund it."]],
  ["If something is wrong with the order", ["If we cannot ship within 30 days of the date promised, you can cancel for a full refund."]],
]);
const viewMissing = () =>'''),
    (': a === "checkout" ? viewCheckout() :', ': a === "privacy" ? viewPrivacy() : a === "terms" ? viewTerms() : a === "checkout" ? viewCheckout() :'),
])
edit('public/index.html', [
    ('<dd><a href="/shipping">Shipping and returns</a></dd>', '<dd><a href="/shipping">Shipping and returns</a>, <a href="/terms">Terms</a>, <a href="/privacy">Privacy</a></dd>'),
])
edit('public/styles.css', [], '''
/* privacy and terms */
.doc{max-width:68ch}
.doc .h3{margin:var(--s-8) 0 var(--s-2)}
.doc p{margin:0 0 var(--s-3)}
.doc .done__tag b{font:600 var(--t-12)/1.6 var(--font-ui);letter-spacing:.09em}
/* 05 smoke, fallback: where the phone cannot draw it live, two soft stills drift instead */
.smoke--still{background:none}
.smoke--still i{position:absolute;inset:-6% 0 0;background:center / 100% 100% no-repeat;opacity:.9}
.smoke--still i:first-child{background-image:url(img/smoke-a.webp)}
.smoke--still i:last-child{background-image:url(img/smoke-b.webp);opacity:0}
@media (prefers-reduced-motion:no-preference){
  .smoke--still i:first-child{animation:smoke-a 16s ease-in-out infinite alternate}
  .smoke--still i:last-child{animation:smoke-b 16s ease-in-out infinite alternate}
  @keyframes smoke-a{from{transform:translateY(3%) scale(1);opacity:.9}to{transform:translateY(-5%) scale(1.06);opacity:.15}}
  @keyframes smoke-b{from{transform:translateY(5%) scale(1.05);opacity:0}to{transform:translateY(-3%) scale(1);opacity:.9}}
}
''')

# ---- smoke: fall back to drifting stills when there is no graphics context; expose a still frame for the tool
edit('public/fx-smoke.js', [
    ('function setup() {\n  gl = cv.getContext(', 'function setup() {\n  if (new URLSearchParams(location.search).has("still")) return false; // lets us look at the fallback on any device\n  gl = cv.getContext('),
    ('const kick = () => { if (!raf && gl && !lost && cv.isConnected) raf = requestAnimationFrame(draw); };',
     'const kick = () => { if (!raf && gl && !lost && cv.isConnected) raf = requestAnimationFrame(draw); };\n'
     '// The layer that goes behind the piece: the live canvas, or two drifting stills where the phone cannot draw it.\n'
     'let layer = cv;\nfunction still() { layer = document.createElement("span"); layer.className = "smoke smoke--still"; layer.setAttribute("aria-hidden", "true"); layer.append(document.createElement("i"), document.createElement("i")); }'),
    ('  if (!stage) { if (cv.isConnected) { cv.remove(); cv.classList.remove("on"); } return; }\n  if (cv.parentNode === stage) return;\n  cv.classList.remove("on"); cv.classList.toggle("smoke--hero", stage === hero);',
     '  if (!stage) { if (layer.isConnected) { layer.remove(); layer.classList.remove("on"); } return; }\n  if (layer.parentNode === stage) return;\n  layer.classList.remove("on"); layer.classList.toggle("smoke--hero", stage === hero);'),
    ('  if (stage === hero) { stage.insertBefore(cv, stage.querySelector(".hero__pieces")); gl.uniform2f(uSrc, 0.5, 0.04); } // one wisp up the middle slab, behind the pieces\n  else { stage.prepend(cv); gl.uniform2f(uSrc, 0.5, 0.2); }\n  io.disconnect(); io.observe(cv);',
     '  if (stage === hero) { stage.insertBefore(layer, stage.querySelector(".hero__pieces")); if (gl) gl.uniform2f(uSrc, 0.5, 0.04); } // one wisp up the middle slab, behind the pieces\n  else { stage.prepend(layer); if (gl) gl.uniform2f(uSrc, 0.5, 0.2); }\n  io.disconnect(); io.observe(layer);'),
    ('  requestAnimationFrame(() => cv.classList.add("on")); kick();', '  requestAnimationFrame(() => layer.classList.add("on")); kick();'),
    ('if (setup()) { new MutationObserver(place).observe(document.getElementById("main"), { childList: true }); place(); window.__smoke = { canvas: cv, at: s => { t0 = performance.now() - (s - 40) * 1000; } }; }',
     'const live = setup(); if (!live) still();\nnew MutationObserver(place).observe(document.getElementById("main"), { childList: true }); place();\n'
     'if (live) window.__smoke = { canvas: cv, at: s => { t0 = performance.now() - (s - 40) * 1000; }, frame: s => { gl.uniform1f(uT, s); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); return cv.toDataURL("image/png"); } };'),
])
print('ui wired')
