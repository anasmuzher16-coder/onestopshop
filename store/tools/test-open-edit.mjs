// The preview's open edit switch (src/preview.js), in whichever state the store was started: EXPECT_OPEN="" (off, as every
// deployed store by default), "items" or "all" (tools/ci-suites.mjs: test-open-edit, test-open-edit+openitems, test-open-edit+openall).
//   off:   no banner, no editor and no script in any page; /api/open-edit answers 404; the back office wall is as before.
//   items: banner on every page; anyone can fill in an item's name, colours, stock and price from its page; everything else in
//          the back office still needs the passcode; samples and unticked catalogue pages never switch on; names are escaped.
//   all:   banner; the back office opens without a passcode, as the owner, every change logged "preview (open) <tag>".
// node store/tools/test-open-edit.mjs [screenshot folder]     (changes local data: reseed afterwards)
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { openScope } from "../src/preview.js";
import { samplesOn } from "./fixtures/samples-on.mjs";
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, ""), MODE = process.env.EXPECT_OPEN || "", SHOTS = process.argv[2] || null;
const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
let n = 0, f = 0; const ok = (c, msg, extra = "") => { n++; if (!c) { f++; console.log("FAIL", msg, extra); } };
const req = async (path, { method = "GET", body, cookie, marker = true, type = "application/json", origin, site } = {}) => {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body !== undefined) { headers["Content-Type"] = type; if (marker) headers["X-OSS-Admin"] = "1"; } if (origin) headers.Origin = origin; if (site) headers["Sec-Fetch-Site"] = site;
  const r = await fetch(B + path, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})), r };
};
const html = async path => (await fetch(B + path)).text();
const catalog = async () => { const mod = await (await fetch(B + "/api/catalog-module")).text(); return (await import("data:text/javascript;base64," + Buffer.from(mod).toString("base64"))).PRODUCTS; };
const ACTOR = /^preview \(open\) [0-9a-f]{8}$/;

// the switch itself: only "items" or "all", never on a launched shop (LIVE=1), whatever it says
ok(openScope({}) === null && openScope({ PREVIEW_OPEN_EDIT: "" }) === null && openScope({ PREVIEW_OPEN_EDIT: "ITEMS" }) === null && openScope({ PREVIEW_OPEN_EDIT: "yes" }) === null && openScope({ PREVIEW_OPEN_EDIT: "1" }) === null, "the switch is off unless it says items or all");
ok(openScope({ PREVIEW_OPEN_EDIT: "items" }) === "items" && openScope({ PREVIEW_OPEN_EDIT: "all", LIVE: "0" }) === "all", "items and all switch it on");
ok(openScope({ PREVIEW_OPEN_EDIT: "items", LIVE: "1" }) === null && openScope({ PREVIEW_OPEN_EDIT: "all", LIVE: "1" }) === null, "a launched shop (LIVE=1) ignores the switch");
// the repo never sets it: it is a deploy-time --var on the demo only
ok(!/PREVIEW_OPEN_EDIT/.test(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")), "wrangler.jsonc does not set PREVIEW_OPEN_EDIT");

// the owner's session, to find test items and read the change log
const login = await req("/api/admin/login", { method: "POST", body: { passcode: KEY } }), OWNER = (login.r.headers.get("set-cookie") || "").split(";")[0];
ok(login.status === 200, "owner sign-in works in every state: " + login.status);
const rows = (await req("/api/admin/products", { cookie: OWNER })).data.products, shop = await catalog(), onShop = new Set(shop.map(p => p.sku));
const t = rows.find(x => x.catalogue && !x.family?.startsWith("ace-") && x.needs && ["price", "colours", "stock"].every(k => x.needs.includes(k)) && x.listed === 1 && x.active === 0 && onShop.has(x.sku));
const t2 = rows.find(x => x.catalogue && !x.family?.startsWith("ace-") && x.needs?.includes("price") && x.listed === 1 && x.active === 0 && onShop.has(x.sku) && x.sku !== t?.sku);
const t3 = rows.find(x => x.needs?.includes("price") && x.listed === 1 && x.active === 0 && onShop.has(x.sku) && ![t?.sku, t2?.sku].includes(x.sku));
const sample = rows.find(x => x.sample);
const hoseC = rows.find(x => x.family?.startsWith("hose-") && x.needs?.includes("check") && !x.needs.includes("length") && onShop.has(x.sku));
const hoseL = rows.find(x => x.family?.startsWith("hose-") && x.needs?.includes("length") && onShop.has(x.sku) && x.sku !== hoseC?.sku);
const unticked = rows.find(x => x.catalogue && !onShop.has(x.sku) && !x.sample && x.availability !== "dropped");
const coal = rows.find(x => x.category_id === "charcoal" && /"charcoal":true/.test(x.details || "") && onShop.has(x.sku));
ok(hoseC && hoseL, "hose test items found", JSON.stringify({ hoseC: hoseC?.sku, hoseL: hoseL?.sku }));
ok(t && t2 && t3 && sample && unticked && coal, "test items found", JSON.stringify({ t: t?.sku, t2: t2?.sku, sample: sample?.sku, unticked: unticked?.sku, coal: coal?.sku }));
const history = async sku => (await req(`/api/admin/products/${sku}/history`, { cookie: OWNER })).data;
const row = async sku => (await req("/api/admin/products", { cookie: OWNER })).data.products.find(x => x.sku === sku);
const PAGES = ["/", "/shop", `/p/${t.sku}`, "/cart", "/terms", "/nope-404"];
const WALL = ["/summary", "/products", "/orders", "/orders/find?q=S1001", "/staff", "/settings", "/report", "/backup", "/intake", "/me", `/products/${t.sku}/history`];

if (!MODE) {
  // ---------- off: today's store exactly ----------
  for (const p of [...PAGES, "/admin"]) { const h = await html(p); ok(!/oss-open-edit|open-edit\.(js|css)|data-preview-banner|data-oe-|Preview: anyone can edit/.test(h), "off: nothing of the open edit is in " + p); }
  for (const m of ["GET", "PUT", "POST", "DELETE"]) ok((await req(`/api/open-edit/${t.sku}`, { method: m, body: m === "GET" ? undefined : { price_cents: 999 } })).status === 404, "off: /api/open-edit refuses " + m);
  ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: { price_cents: 999 }, cookie: OWNER })).status === 404, "off: /api/open-edit refuses even the signed-in owner");
  for (const p of WALL) ok((await req("/api/admin" + p)).status === 401, "off: " + p + " needs sign-in");
  ok((await req(`/api/admin/products/${t.sku}/info`, { method: "PUT", body: { price_cents: 999 } })).status === 401 && (await req("/api/admin/loyalty")).status === 401, "off: the item editor and the points settings need sign-in");
  const same = await row(t.sku); ok(same.price_cents === t.price_cents && same.active === t.active && same.name === t.name, "off: nothing was written");
}

if (MODE) {
  // ---------- on, either scope: banner on every page ----------
  for (const p of [...PAGES, "/admin"]) { const h = await html(p); ok(h.includes(`<meta name="oss-open-edit" content="${MODE}">`) && /<body[^>]*>\s*<p class="pvbar" role="note" data-preview-banner>Preview: anyone can edit items\. This will be locked before launch\.<\/p>/.test(h) && h.includes('href="/open-edit.css"'), `${MODE}: the banner and the scope are in ${p}`); }
  ok((await html(`/p/${t.sku}`)).includes('<script type="module" src="/open-edit.js">'), `${MODE}: the item page loads the editor`);
  // the open edit endpoint: reads the editor's fields, nothing private
  const g = await req(`/api/open-edit/${t.sku}`);
  ok(g.status === 200 && g.data.sku === t.sku && g.data.name === t.name && g.data.price_cents === null && Array.isArray(g.data.colours) && JSON.stringify(g.data.needs) === '["price","colours","stock"]' && /^OSS-\d+$/.test(g.data.next || "") && g.data.next !== t.sku && g.data.left > 1, `${MODE}: the editor's fields for an item`, JSON.stringify(g.data));
  ok(!["supplier_id", "facts_known", "cost_cents", "details"].some(k => k in g.data), `${MODE}: no supplier, cost or private details in the answer`);
  ok((await req("/api/open-edit/OSS-999999")).status === 404 && (await req(`/api/open-edit/${t.sku}/x`)).status === 404 && (await req("/api/open-edit/oss-1001")).status === 404, `${MODE}: only a real item number`);
  // every write needs same site, JSON and the marker
  ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: { name: "X" }, marker: false })).status === 400, `${MODE}: a write without the marker is refused`);
  ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: { name: "X" }, origin: "https://evil.example" })).status === 403, `${MODE}: a write from another site (Origin) is refused`);
  ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: { name: "X" }, site: "cross-site" })).status === 403 && (await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: { name: "X" }, site: "same-site" })).status === 403, `${MODE}: a write another site's page sends (Fetch Metadata) is refused`);
  ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: "name=X", type: "text/plain" })).status === 415 && (await req(`/api/open-edit/${t.sku}`, { method: "POST", body: { name: "X" } })).status === 405, `${MODE}: a plain form post or another method is refused`);
  // the same validation as the back office
  for (const [body, what] of [[{ price_cents: -5 }, "negative price"], [{ price_cents: 0 }, "zero price"], [{ price_cents: "24.99" }, "price as text"], [{ price_cents: 5000001 }, "price over $50,000"], [{ stock: { counted: -1, seen: t.stock } }, "negative stock"], [{ stock: { counted: 4 } }, "a count without what it was counted against"],
    [{ colours: ["<b>Red</b>"] }, "a colour with code in it"], [{ colours: ['Red" onclick="x'] }, "a colour with quotes"], [{ colours: [{ name: "Teal", hex: "red;background:url(x)" }] }, "a swatch that is not a colour"], [{ name: " " }, "an empty name"], [{ name: "x".repeat(81) }, "a name over 80"], [{ name: "Fine", price_cents: -1 }, "a good field beside a bad one"]])
    ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body })).status === 400, `${MODE}: refuses ${what}`);
  ok(JSON.stringify(await row(t.sku)) === JSON.stringify(rows.find(x => x.sku === t.sku)), `${MODE}: nothing was written by a refused save`);
  // hoses: length and the name check, through the open route, clearing those needs; the panel reads them back
  { const hg = (await req(`/api/open-edit/${hoseC.sku}`)).data, lg = (await req(`/api/open-edit/${hoseL.sku}`)).data;
    ok(hg.has_length === true && typeof hg.length === "string" && hg.length && hg.check === true && hg.needs.includes("check") && !("confirm_why" in hg) && !JSON.stringify(hg).includes("recording"), `${MODE}: a hose reads its length and that it needs a check, no internal notes`, JSON.stringify(hg));
    ok(lg.has_length === true && lg.length === "" && lg.needs.includes("length") && !("check" in lg && lg.check === false), `${MODE}: a hose with no length reads it empty`, JSON.stringify(lg));
    ok(hg.family_row === true && Array.isArray(hg.colours) && hg.colours.length >= 1, `${MODE}: a hose's panel starts on its own colour`, JSON.stringify(hg.colours));
    ok(t && (await req(`/api/open-edit/${t.sku}`)).data.has_length === undefined, `${MODE}: an item without a length gets no length field`);
    ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: { length: "5 feet" } })).status === 400, `${MODE}: a length on an item that has none is refused`);
    for (const bad of ["x".repeat(31), "<b>5</b>", "", 5]) ok((await req(`/api/open-edit/${hoseL.sku}`, { method: "PUT", body: { length: bad } })).status === 400, `${MODE}: bad length refused: ${String(bad).slice(0, 12)}`);
    ok((await req(`/api/open-edit/${hoseC.sku}`, { method: "PUT", body: { checked: false } })).status === 400, `${MODE}: the check cannot be unticked`);
    const s1 = await req(`/api/open-edit/${hoseL.sku}`, { method: "PUT", body: { length: "  60.5   inches " } }), s2 = await req(`/api/open-edit/${hoseC.sku}`, { method: "PUT", body: { checked: true } });
    const ha = (await req(`/api/open-edit/${hoseC.sku}`)).data, la = (await req(`/api/open-edit/${hoseL.sku}`)).data;
    ok(s1.status === 200 && s2.status === 200 && !la.needs.includes("length") && la.length === "60.5 inches" && !ha.needs.includes("check") && !("check" in ha), `${MODE}: length and checked save and clear those needs`, JSON.stringify({ la: la.needs, ha: ha.needs, l: la.length }));
    ok((await req(`/api/open-edit/${hoseC.sku}`, { method: "PUT", body: { checked: true } })).status === 200, `${MODE}: ticking an already-checked item is harmless`);
  }
  // a body over ~16 KB is refused before it is parsed
  ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: JSON.stringify({ name: "ok", pad: "x".repeat(17000) }) })).status === 413, `${MODE}: a body over 16 KB is refused with 413`);
  ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: "{not json" })).status === 400, `${MODE}: a body that is not JSON is refused with 400`);
  // a name is cleaned: bidi overrides and control characters dropped, newlines and tabs become one space, accents and punctuation stay
  { const nm = await req(`/api/open-edit/${t3.sku}`, { method: "PUT", body: { name: "\u202eCr\u00e8me\n\tBr\u00fbl\u00e9e\u2066 Tray\u0007 (No. 5) & co.\u200f" } });
    const after = (await req(`/api/open-edit/${t3.sku}`)).data.name;
    ok(nm.status === 200 && after === "Cr\u00e8me Br\u00fbl\u00e9e Tray (No. 5) & co.", `${MODE}: a name is cleaned of direction overrides, controls and newlines`, JSON.stringify(after));
    ok((await req(`/api/open-edit/${t3.sku}`, { method: "PUT", body: { name: "\u202e\u202c\n" } })).status === 400, `${MODE}: a name that is only invisible characters is refused`);
    ok((await req(`/api/open-edit/${t3.sku}`, { method: "PUT", body: { name: "​⁠ㅤ­" } })).status === 400 && (await req(`/api/open-edit/${t3.sku}`, { method: "PUT", body: { name: "Zero​width" } })).status === 200 && (await req(`/api/open-edit/${t3.sku}`)).data.name === "Zerowidth", `${MODE}: zero-width characters are dropped from a name`); }
  // a hose's colour: picking another changes what the page shows, not just the panel
  { const r = await req(`/api/open-edit/${hoseC.sku}`, { method: "PUT", body: { colours: ["Teal"] } }), g2 = (await req(`/api/open-edit/${hoseC.sku}`)).data, after = (await catalog()).find(x => x.sku === hoseC.sku);
    ok(r.status === 200 && JSON.stringify(g2.colours.map(c => c.name)) === '["Teal"]' && /Teal/.test(JSON.stringify(after)), `${MODE}: a hose's changed colour shows in the catalogue the page reads`, JSON.stringify(after)?.slice(0, 300)); }
  // never a sample, never an unticked catalogue page: not even readable, and a price never switches one on
  for (const x of [sample, unticked]) {
    ok((await req(`/api/open-edit/${x.sku}`)).status === 404 && (await req(`/api/open-edit/${x.sku}`, { method: "PUT", body: { price_cents: 1234 } })).status === 404, `${MODE}: ${x.sample ? "a made-up sample" : "an unticked catalogue page"} cannot be edited openly (${x.sku})`);
    const after = await row(x.sku); ok(after.active === x.active && after.price_cents === x.price_cents, `${MODE}: ${x.sku} unchanged and still off`);
  }
  // a sample a suite switched on (a shopper can open its page): the page is told it is not editable (200, so no failed request), a save is refused
  { await samplesOn(B, ["OSS-7001"]); const sg = await req("/api/open-edit/OSS-7001"), sp7 = await req("/api/open-edit/OSS-7001", { method: "PUT", body: { price_cents: 4321, name: "x" } });
    ok(sg.status === 200 && sg.data.editable === false && !("name" in sg.data) && !("stock" in sg.data) && sp7.status === 404 && (await row("OSS-7001")).name !== "x", `${MODE}: a sample on view is marked not editable and its save refused`, JSON.stringify(sg.data)); }
  ok(g.data.editable === true, `${MODE}: an ordinary item is editable`);
  // a stale count is refused (an order landed while counting)
  ok((await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: { stock: { counted: 9, seen: t.stock + 3 } } })).status === 409, `${MODE}: a count against an old number is refused`);
  // charcoal stays pickup or local only
  ok((await req(`/api/open-edit/${coal.sku}`, { method: "PUT", body: { colours: ["Black"] } })).status === 200 && (await row(coal.sku)).ship_class === "pickup_only" && JSON.parse((await row(coal.sku)).details).charcoal === true, `${MODE}: charcoal keeps its pickup-only rule after an open save`);
  // the save: name, colours, count, price; a first price puts the Price TBD item on sale; logged as the open visitor
  const sv = await req(`/api/open-edit/${t.sku}`, { method: "PUT", body: { name: t.name + " (counter)", colours: ["Black", { name: "Sea glass", hex: "#7FB8A4" }], stock: { counted: 3, seen: t.stock }, price_cents: 2750 } });
  ok(sv.status === 200 && sv.data.on_sale === true && sv.data.price_cents === 2750 && sv.data.stock === 3, `${MODE}: an open save fills everything in and puts the item on sale`, JSON.stringify(sv.data));
  const sp = (await catalog()).find(x => x.sku === t.sku);
  ok(sp && sp.state === "sale" && sp.price === 27.5 && sp.stock === 3 && sp.name === t.name + " (counter)" && JSON.stringify(sp.details.colours) === '["Black","Sea glass"]', `${MODE}: the storefront shows it at once`, JSON.stringify(sp && { state: sp.state, price: sp.price, stock: sp.stock }));
  const h = await history(t.sku), ch = h.changes.find(a => a.action === "product.info"), mv = h.moves.find(m => m.reason === "count");
  ok(ch && ACTOR.test(ch.actor) && JSON.parse(ch.after).price_cents === 2750 && JSON.parse(ch.after).active === 1 && mv && ACTOR.test(mv.actor), `${MODE}: the change and the count are logged as "preview (open)" with a visitor tag`, JSON.stringify(ch && ch.actor));
  ok(!(await row(t.sku)).needs, `${MODE}: the item leaves the needs-info list`);
  ok((await req(`/api/open-edit/${t.sku}`)).data.on_sale === true, `${MODE}: the editor reads it back on sale`);
  // a priced item that is switched off (coming soon) stays off when its price changes
  const soon = (await req("/api/admin/products", { cookie: OWNER })).data.products.find(x => x.listed === 1 && x.active === 0 && x.price_cents > 0 && onShop.has(x.sku) && !x.sample);
  if (soon) { const r = await req(`/api/open-edit/${soon.sku}`, { method: "PUT", body: { price_cents: soon.price_cents + 100 } }); ok(r.status === 200 && r.data.on_sale === false && (await row(soon.sku)).active === 0, `${MODE}: a priced, switched-off item stays off`); }
}

if (MODE === "items") {
  // ---------- items: everything but the item fields still needs the passcode ----------
  for (const p of WALL) ok((await req("/api/admin" + p)).status === 401, "items: " + p + " still needs sign-in");
  ok((await req("/api/admin/orders/bulk-cancel", { method: "POST", body: { ids: ["S1001"], confirm: 1 } })).status === 401, "items: cancelling orders still needs sign-in");
  ok((await req(`/api/admin/products/${t2.sku}/info`, { method: "PUT", body: { price_cents: 999 } })).status === 401, "items: the back office's own item editor still needs sign-in");
  ok((await req(`/api/admin/products/${t2.sku}`, { method: "PUT", body: { active: true } })).status === 401 && (await req("/api/admin/products", { method: "POST", body: { name: "x" } })).status === 401, "items: the full product form and adding products still need sign-in");
  ok((await req(`/api/admin/products/${t2.sku}/stock`, { method: "POST", body: { delta: 5 } })).status === 401, "items: stock moves still need sign-in");
  ok((await req("/api/admin/loyalty")).status === 401 && (await req("/api/admin/staff", { method: "POST", body: { name: "Evil", pin: "123456" } })).status === 401, "items: points settings and staff still need sign-in");
  // only the four item fields can be written: anything else in the body is ignored
  await req(`/api/open-edit/${t2.sku}`, { method: "PUT", body: { active: 1, ship_class: "standard", cost_cents: 1, category_id: "misc", note: "x", weight_g: 9, details: { notes: "x" }, availability: "dropped" } });
  const a2 = await row(t2.sku), b2 = rows.find(x => x.sku === t2.sku);
  ok(a2.active === b2.active && a2.ship_class === b2.ship_class && a2.cost_cents === b2.cost_cents && a2.category_id === b2.category_id && a2.note === b2.note && a2.weight_g === b2.weight_g && a2.availability === b2.availability && a2.details === b2.details, "items: fields outside name, colours, stock and price are never written");
}

if (MODE === "all") {
  // ---------- all: the whole back office, as the owner ----------
  const me = await req("/api/admin/me"); ok(me.status === 200 && me.data.owner === true && ACTOR.test(me.data.actor), "all: no sign-in needed, the visitor is the owner", JSON.stringify(me.data));
  for (const p of ["/summary", "/products", "/orders", "/staff", "/settings"]) ok((await req("/api/admin" + p)).status === 200, "all: " + p + " opens");
  ok((await req("/api/admin/loyalty")).status === 200, "all: the points settings open");
  const w = await req(`/api/admin/products/${t3.sku}/info`, { method: "PUT", body: { price_cents: 1999 } });
  ok(w.status === 200 && w.data.on_sale === true, "all: the back office's own item editor saves without sign-in");
  ok((await history(t3.sku)).changes.some(a => a.action === "product.info" && ACTOR.test(a.actor)), "all: logged as preview (open)");
  ok((await req(`/api/admin/products/${t2.sku}/stock`, { method: "POST", body: { delta: 1 }, origin: "https://evil.example" })).status === 403 && (await req(`/api/admin/products/${t2.sku}/stock`, { method: "POST", body: { delta: 1 }, marker: false })).status === 400, "all: back office writes still need same site and the marker");
  ok((await req(`/api/admin/products/${sample.sku}`, { method: "PUT", body: { active: true } })).status === 409, "all: a made-up sample still never switches on");
}

// ---------- the item page, in a browser ----------
const lock = process.env.BROWSER_LOCK || null;
const { chromium } = createRequire(process.env.PW_FROM || "C:/dev/puckempire-arena/package.json")("playwright");
const b = await chromium.launch();
try {
  const page = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" }); const p = await c.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(e.message)); return { c, p }; };
  const go = async (p, path) => { await p.goto(B + path, { waitUntil: "domcontentloaded" }); await p.waitForSelector("body[data-route]", { state: "attached" }); await p.waitForTimeout(500); };
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  if (!MODE) {
    const { c, p } = await page(390, 844); await go(p, `/p/${t2.sku}`);
    ok(await p.locator(".pdp__name").count() === 1 && await p.locator("[data-oe-bar], [data-oe-sheet], [data-preview-banner], .pvbar").count() === 0, "off: the item page has no editor and no banner");
    ok(!(await p.evaluate(() => [...document.scripts].some(s => /open-edit/.test(s.src)) || [...document.styleSheets].some(s => /open-edit/.test(s.href || "")))), "off: the editor's script and styles are not loaded");
    ok(!p.errs.length, "off: no page errors", p.errs.join(" | ")); await c.close();
  } else {
    // XSS: a name with markup is shown as text, in the page and in the editor
    const evil = `<img src=x onerror="window.__x=1">Tray "A" & co`;
    ok((await req(`/api/open-edit/${t2.sku}`, { method: "PUT", body: { name: evil } })).status === 200, `${MODE}: a name with markup is stored as text`);
    // the wide look first, while the item still says Price TBD; the phone then saves it
    for (const [w, hgt] of [[1440, 900], [390, 844]]) {
      const { c, p } = await page(w, hgt); await go(p, `/p/${t2.sku}`);
      const bar = p.locator("[data-oe-bar]"); await bar.waitFor({ timeout: 8000 });
      await p.waitForFunction(() => /Needs/.test(document.querySelector("[data-oe-need]")?.textContent || ""), null, { timeout: 8000 });
      const banner = await p.locator(".pvbar").boundingBox(), top = await p.locator(".top").boundingBox();
      ok(banner && top && banner.y === 0 && banner.y + banner.height <= top.y + 0.5 && banner.height < 48 && await p.locator(".pvbar").innerText() === "Preview: anyone can edit items. This will be locked before launch.", `${MODE} ${w}: the banner is at the very top, above the header, and slim`, JSON.stringify({ banner, top }));
      ok(await p.locator(".pdp__name").innerText().then(s => s.includes('<img src=x onerror="window.__x=1">Tray')) && await p.locator(".pdp__name img").count() === 0, `${MODE} ${w}: the name is shown as text`);
      const edit = p.locator("[data-oe-open]"), eb = await edit.boundingBox();
      ok(await edit.innerText() === "Edit this item" && eb.height >= 48, `${MODE} ${w}: a big "Edit this item" button under the name`, JSON.stringify(eb));
      const next = p.locator("[data-oe-next]"); ok(await next.isVisible() && /^\/p\/OSS-\d+$/.test(await next.getAttribute("href")), `${MODE} ${w}: a "Next item that needs info" link`);
      ok(await p.locator(".pdp__avail").count() === 1 && await p.locator("[data-add]").count() === 0, `${MODE} ${w}: before the price, Price TBD and no Add to cart`);
      if (SHOTS) await p.screenshot({ path: join(SHOTS, `item-bar-${w}.png`) });
      await edit.click(); const sheet = p.locator("dialog[data-oe-sheet][open]"); await sheet.waitFor({ timeout: 5000 });
      ok(await p.inputValue("#oe-name") === evil && await sheet.locator("img:not(.sw__dot)").count() === 0, `${MODE} ${w}: the editor shows the name as typed, never as markup`);
      ok(await p.getAttribute("#oe-stock", "inputmode") === "numeric" && await p.getAttribute("#oe-price", "inputmode") === "decimal", `${MODE} ${w}: number keyboards for stock and price`);
      const swb = await sheet.locator("[data-sw]").first().boundingBox(); ok(swb.height >= 44 && await sheet.locator("[data-sw]").count() >= 14, `${MODE} ${w}: the back office's swatches, big enough to tap`);
      ok(!(await p.evaluate(() => window.__x)), `${MODE} ${w}: no script ran from the name`);
      if (w === 390) {
        // add your own colour, pick one, count, price, save
        await sheet.locator('[data-sw][data-name="Gold"]').click();
        await sheet.locator("[data-oe-addcol]").click(); await p.fill("#oe-newname", "Smoke <b>"); await sheet.locator("[data-oe-addgo]").click();
        ok(await sheet.locator("[data-oe-err]").isVisible(), `${MODE}: a colour name with markup is refused in the page`);
        await p.fill("#oe-newname", "Smoke teal"); await sheet.locator("[data-oe-addgo]").click();
        ok(await sheet.locator('[data-sw][data-name="Smoke teal"][aria-pressed="true"]').count() === 1, `${MODE}: an added colour is picked`);
        await p.fill("#oe-name", "Counter tray"); await p.fill("#oe-stock", "6"); await p.fill("#oe-price", "19.50");
        if (SHOTS) { await p.screenshot({ path: join(SHOTS, `item-editor-${w}.png`) }); }
        await Promise.all([p.waitForNavigation({ waitUntil: "domcontentloaded" }), sheet.locator('button[data-then="stay"]').click()]);
        await p.waitForSelector("body[data-route]", { state: "attached" }); await p.waitForTimeout(600);
        ok(await p.locator(".pdp__name").innerText() === "Counter tray" && /\$19\.50|\$19\.5\b/.test(await p.locator(".pdp__price").innerText().catch(() => "")) && await p.locator("[data-add]").count() >= 1 && await p.locator(".pdp__avail").count() === 0, `${MODE}: after Save the page shows the new name and price, and Add to cart`, await p.locator("#main").innerText().then(s => s.slice(0, 300)));
        await p.locator("[data-oe-said]").waitFor({ timeout: 5000 }).catch(() => {});
        ok(/on sale at \$19\.50/.test(await p.locator("[data-oe-said]").innerText().catch(() => "")), `${MODE}: the page says it saved and is on sale`);
        const d = (await req(`/api/open-edit/${t2.sku}`)).data; ok(d.stock === 6 && d.counted && JSON.stringify(d.colours.map(c => c.name).sort()) === '["Gold","Smoke teal"]', `${MODE}: colours and count saved from the page`, JSON.stringify(d.colours));
        if (SHOTS) await p.screenshot({ path: join(SHOTS, `item-saved-${w}.png`) });
        // walk the needs-info list from the page
        const href = await p.locator("[data-oe-next]").getAttribute("href"); await p.locator("[data-oe-next]").click(); await p.waitForURL(B + href, { timeout: 8000 }); await p.waitForSelector("[data-oe-bar]", { timeout: 8000 });
        ok(p.url() === B + href && await p.locator("[data-oe-bar]").getAttribute("data-oe-bar") === href.slice(3), `${MODE}: Next item that needs info opens the next item, with its own editor`);
      } else {
        if (SHOTS) await p.screenshot({ path: join(SHOTS, `item-editor-${w}.png`) });
        await sheet.locator("[data-oe-close]").click(); ok(await p.locator("dialog[data-oe-sheet][open]").count() === 0, `${MODE} ${w}: Close closes the editor`);
      }
      ok(!p.errs.length, `${MODE} ${w}: no page errors`, p.errs.join(" | ")); await c.close();
    }
    { // a page whose item is not editable here (a sample a suite switched on): no bar, one quiet request, no redraw loop
      const { c, p } = await page(390, 844); let asks = 0; p.on("request", r => { if (r.url().includes("/api/open-edit/")) asks++; }); await go(p, "/p/OSS-7001"); await p.waitForTimeout(1500);
      ok(await p.locator(".pdp__name").count() === 1 && await p.locator("[data-oe-bar]").count() === 0 && asks === 1 && !p.errs.length, `${MODE}: no editor on a page whose item is not editable, and one request`, "requests " + asks); await c.close(); }
    { // a hose page: the panel says nothing undefined, offers length and the check, preselects its colour, and saves through the page
      const hq = rows.find(x => x.family?.startsWith("hose-") && x.needs?.includes("check") && onShop.has(x.sku) && ![hoseC.sku, hoseL.sku].includes(x.sku)) || rows.find(x => x.family?.startsWith("hose-") && onShop.has(x.sku) && !x.needs?.includes("length"));
      const { c, p } = await page(390, 844); await go(p, `/p/${hq.sku}`);
      await p.waitForFunction(() => /Needs|Everything/.test(document.querySelector("[data-oe-need]")?.textContent || ""), null, { timeout: 8000 });
      const need = await p.locator("[data-oe-need]").innerText(); ok(!/undefined|null/.test(need), `${MODE}: a hose's need line has no "undefined"`, need);
      await p.locator("[data-oe-open]").click(); const sh = p.locator("dialog[data-oe-sheet][open]"); await sh.waitFor({ timeout: 5000 });
      const all = await sh.innerText(); ok(!/undefined|null/.test(all) && await p.locator("#oe-length").count() === 1 && !/none picked/.test(all), `${MODE}: the hose panel has a Length field, no "undefined", its colour picked`, all.slice(0, 300));
      ok(await p.getAttribute("#oe-price", "placeholder") === null, `${MODE}: the price box has no bright placeholder`);
      if (await p.locator("#oe-checked").count()) {
        await p.locator("#oe-checked").check(); await p.fill("#oe-length", "61 inches");
        if (SHOTS) await p.screenshot({ path: join(SHOTS, "hose-editor-390.png") });
        await Promise.all([p.waitForNavigation({ waitUntil: "domcontentloaded" }), sh.locator('button[data-then="stay"]').click()]);
        await p.waitForTimeout(800); const d2 = (await req(`/api/open-edit/${hq.sku}`)).data;
        ok(!d2.needs.includes("check") && d2.length === "61 inches", `${MODE}: the page's Checked box and Length save`, JSON.stringify(d2.needs));
      } else if (SHOTS) await p.screenshot({ path: join(SHOTS, "hose-editor-390.png") });
      ok(!p.errs.length, `${MODE}: no page errors on a hose`, p.errs.join(" | ")); await c.close(); }
    // the back office: "items" still asks for the passcode; "all" opens without one
    const { c, p } = await page(1440, 900); await p.goto(B + "/admin", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(1200);
    ok(await p.locator(".pvbar").count() === 1, `${MODE}: the back office shows the banner`);
    if (MODE === "items") ok(await p.locator("[data-login] #passcode, [data-login] #staffname").count() === 1 && await p.locator("[data-tabs]").isHidden(), "items: the back office still asks for the passcode");
    else ok(await p.locator("[data-login]").count() === 0 && await p.locator("[data-tabs]").isVisible(), "all: the back office opens without a passcode");
    if (SHOTS) await p.screenshot({ path: join(SHOTS, `admin-${MODE}-1440.png`) });
    await c.close();
  }
} finally { await b.close(); }
await req("/api/admin/logout", { method: "POST", body: {}, cookie: OWNER });
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
