// The go-live switch, proved before a domain exists (docs/SEO.md "Launch", inventory GO-LIVE.md). Starts three copies of
// the store with the launch settings, LIVE "1" and SITE_ORIGIN https://www.example-oss.ca, each answering as one address:
//   own   https://www.example-oss.ca                      the shop's domain: indexable, sitemap, every address on it
//   copy  https://onestopshop-store.anas-dev.workers.dev  the demo address: noindex everywhere, canonical points at own
//   apex  https://example-oss.ca                           the bare domain: noindex, canonical points at own
// (wrangler dev --host X --upstream-protocol https makes every request arrive as https://X, as Cloudflare would deliver it.)
// Server only, no browser. Changes nothing: each copy runs on its own copy of the local database.
//   PERSIST=<seeded local state> node store/tools/test-golive.mjs        (in CI, store/tools/ci-suites.mjs sets PERSIST)
// Env: GOLIVE_PORT (default 4521, uses three ports), WRANGLER_JS (wrangler's bin/wrangler.js; else npx wrangler).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, rmSync, mkdtempSync, existsSync, openSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const STORE = fileURLToPath(new URL("../", import.meta.url)), WIN = process.platform === "win32";
const OWN = "https://www.example-oss.ca", COPY = "https://onestopshop-store.anas-dev.workers.dev", APEX = "https://example-oss.ca";
const PORT = +(process.env.GOLIVE_PORT || 4521), PERSIST = process.env.PERSIST;
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 0 the rule itself, no server: the workers.dev address is never indexable ----------
const seo = await import(new URL("../src/seo.js", import.meta.url));
for (const env of [{ LIVE: "1" }, { LIVE: "1", SITE_ORIGIN: OWN }, { LIVE: "1", SITE_ORIGIN: COPY }])
  ok(!seo.liveHere(env, new URL(COPY + "/")) && !seo.robots(env, new URL(COPY + "/")).includes("Sitemap:"), `workers.dev is never indexable (${JSON.stringify(env)})`);
ok(seo.liveHere({ LIVE: "1", SITE_ORIGIN: OWN }, new URL(OWN + "/shop")) && !seo.liveHere({ LIVE: "1", SITE_ORIGIN: OWN }, new URL(APEX + "/shop")), "with SITE_ORIGIN set, only that exact address is indexable (www, not the bare domain)");

if (!PERSIST || !existsSync(PERSIST)) { console.log("FAIL PERSIST must name a seeded local store state"); process.exit(1); }

// ---------- start the three copies ----------
const work = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "oss-golive-"));
const wrangler = process.env.WRANGLER_JS ? [process.execPath, [process.env.WRANGLER_JS]] : [WIN ? "npx.cmd" : "npx", ["wrangler"]];
const kill = p => { if (!p || p.exitCode !== null) return; if (WIN) spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"]); else { try { process.kill(-p.pid, "SIGKILL"); } catch { p.kill("SIGKILL"); } } };
const copies = [["own", OWN], ["copy", COPY], ["apex", APEX]].map(([name, origin], i) => {
  const state = join(work, name); cpSync(PERSIST, state, { recursive: true });
  const port = PORT + i, host = new URL(origin).host, logFile = join(work, name + ".log"), log = openSync(logFile, "w");
  const proc = spawn(wrangler[0], [...wrangler[1], "dev", "--local", "--ip", "127.0.0.1", "--port", String(port), "--persist-to", state, "--host", host, "--upstream-protocol", "https",
    "--var", "LIVE:1", "--var", "SITE_ORIGIN:" + OWN], { cwd: STORE, stdio: ["ignore", log, log], shell: WIN && !process.env.WRANGLER_JS, detached: !WIN });
  return { name, origin, base: `http://127.0.0.1:${port}`, proc, logFile };
});
const [own, copy, apex] = copies;
const get = async (c, p) => { const r = await fetch(c.base + p, { redirect: "manual", signal: AbortSignal.timeout(20000) }); return { r, t: await r.text() }; };
const tag = (t, re) => (t.match(re) || [])[1];
const canon = t => tag(t, /<link rel="canonical" href="([^"]+)">/), ogUrl = t => tag(t, /<meta property="og:url" content="([^"]+)">/), ogImg = t => tag(t, /<meta property="og:image" content="([^"]+)">/);
const metaNoindex = t => /<meta name="robots" content="noindex, nofollow">/.test(t), hdrNoindex = r => /noindex/.test(r.headers.get("x-robots-tag") || "");
const indexable = g => !/<meta name="robots"/.test(g.t) && !g.r.headers.get("x-robots-tag");
const lds = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const urlsIn = (o, out = []) => { if (typeof o === "string") { if (/^https?:\/\//.test(o)) out.push(o); } else if (o && typeof o === "object") for (const v of Object.values(o)) urlsIn(v, out); return out; };
const OTHER = ["https://schema.org/", "https://schema.org", "https://www.instagram.com/", "https://www.tiktok.com/"];   // vocabulary and the shop's own social pages

try {
  for (const c of copies) { let up = false; for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(c.base + "/robots.txt", { signal: AbortSignal.timeout(3000) })).status === 200; } catch {} if (!up) await sleep(1000); } ok(up, c.name + ": the store started"); if (!up) console.log(readFileSync(c.logFile, "utf8").slice(-1500)); }
  if (f) throw new Error("a store did not start");
  await sleep(1500);

  // what the shop holds (the same module the page draws from)
  const mod = (await get(own, "/api/catalog-module")).t, { PRODUCTS: P, CATEGORIES: C } = await import("data:text/javascript," + encodeURIComponent(mod));
  const shelf = P.filter(p => !p.family || p.lead), sale = P.find(p => p.state === "sale" && p.img && (!p.family || p.lead)), tbd = P.find(p => p.state === "tbd" && !p.family);
  const sec = C.find(c => P.some(p => p.cat === c.id)), empty = C.find(c => !P.some(p => p.cat === c.id));
  ok(sale && tbd && sec, "the seed has an item on sale with a photo, a Price TBD item and a section with items");
  const PUBLIC = ["/", "/shop", "/shop/" + sec.id, "/p/" + sale.sku, "/p/" + tbd.sku, "/shipping", "/terms", "/privacy"];
  const PRIVATE = ["/cart", "/checkout", "/account", "/search", "/order/WABCDEF", ...(empty ? ["/shop/" + empty.id] : [])];

  // ---------- 1 own address: robots and the sitemap ----------
  const rb = await get(own, "/robots.txt");
  ok(rb.t.split("\n").includes(`Sitemap: ${OWN}/sitemap.xml`), "own: robots.txt names the sitemap on the shop's address");
  ok(["Disallow: /admin", "Disallow: /api/", "Disallow: /checkout$", "Disallow: /account$"].every(l => rb.t.split("\n").includes(l)) && !/^Disallow: \/\s*$/m.test(rb.t), "own: robots.txt still keeps the private pages out, never the whole shop");
  const sm = await get(own, "/sitemap.xml"), locs = [...sm.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]);
  ok(sm.r.status === 200 && /^application\/xml/.test(sm.r.headers.get("content-type") || "") && /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sm.t), "own: /sitemap.xml is served as XML: " + sm.r.status);
  ok(locs.length > 10 && locs.every(l => l.startsWith(OWN + "/")), `own: every sitemap address is on ${OWN} (${locs.length}): ` + locs.filter(l => !l.startsWith(OWN + "/")).slice(0, 3).join(" "));
  ok(!locs.some(l => /\/(cart|checkout|account|admin|api|search|order|gifts)\b/.test(l)), "own: no private or noindex page in the sitemap");
  ok(locs.filter(l => l.includes("/p/")).length === shelf.length, `own: one sitemap entry per item a shopper can open (${locs.filter(l => l.includes("/p/")).length} of ${shelf.length})`);
  const badLoc = [];
  for (let i = 0; i < locs.length; i += 8) await Promise.all(locs.slice(i, i + 8).map(async l => { const g = await get(own, l.slice(OWN.length)); if (g.r.status !== 200 || !indexable(g) || canon(g.t) !== l || ogUrl(g.t) !== l) badLoc.push(`${l} ${g.r.status} canon ${canon(g.t)}`); }));
  ok(badLoc.length === 0, `own: every sitemap address is a 200, indexable page whose canonical and og:url are itself (${locs.length}): ` + badLoc.slice(0, 3).join("; "));

  // ---------- 2 own address: the public pages, share images, structured data ----------
  for (const p of PUBLIC) {
    const g = await get(own, p), want = OWN + (p === "/" ? "/" : p), img = ogImg(g.t);
    ok(g.r.status === 200 && indexable(g), `own ${p}: 200 and indexable (no robots tag, no X-Robots-Tag): ${g.r.status} ${g.r.headers.get("x-robots-tag")}`);
    ok(canon(g.t) === want && ogUrl(g.t) === want, `own ${p}: canonical and og:url are ${want}: ${canon(g.t)} ${ogUrl(g.t)}`);
    ok(img && img.startsWith(OWN + "/") && /<meta property="og:image:alt" content="[^"]+">/.test(g.t), `own ${p}: og:image is on the shop's address, with alt text: ${img}`);
    if (img) { const pic = await fetch(own.base + img.slice(OWN.length), { signal: AbortSignal.timeout(20000) }); await pic.arrayBuffer();
      ok(pic.status === 200 && /^image\//.test(pic.headers.get("content-type") || "") && !pic.headers.get("x-robots-tag"), `own ${p}: the share image loads and may be indexed (Google Images, merchant listings): ${pic.status} ${pic.headers.get("x-robots-tag")}`); }
    const stray = lds(g.t).flatMap(o => urlsIn(o)).filter(u => !u.startsWith(OWN + "/") && !OTHER.some(o => u.startsWith(o)));
    ok(stray.length === 0, `own ${p}: every address in the structured data is on ${OWN}: ` + stray.slice(0, 3).join(" "));
    ok(!/workers\.dev|127\.0\.0\.1|localhost/.test(g.t), `own ${p}: no demo or local address anywhere in the page`);
  }
  const home = lds((await get(own, "/")).t).find(x => x["@type"] === "Store");
  ok(home && home["@id"] === OWN + "/#store" && home.url === OWN + "/" && home.image === OWN + "/img/share.jpg", "own: the home page's Store data names the shop's address: " + JSON.stringify(home && [home["@id"], home.url, home.image]));
  const prod = lds((await get(own, "/p/" + sale.sku)).t).find(x => x["@type"] === "Product");
  ok(prod && prod.url === `${OWN}/p/${sale.sku}` && prod.offers.url === prod.url && prod.image.every(u => u.startsWith(OWN + "/")) && prod.offers.seller["@id"] === OWN + "/#store", `own: ${sale.sku}'s Product and Offer point at the shop's address`);
  ok(!/"Product"/.test((await get(own, "/p/" + tbd.sku)).t), `own: ${tbd.sku} (Price TBD) still carries no Product data when live`);
  const low = await get(own, "/p/" + sale.sku.toLowerCase());
  // (wrangler dev rewrites a Location on the --host address back to its own local address, so either form is the shop's own)
  ok(low.r.status === 301 && [`${OWN}/p/${sale.sku}`, `${own.base}/p/${sale.sku}`].includes(low.r.headers.get("location")), "own: a redirect stays on the shop's address: " + low.r.headers.get("location"));

  // ---------- 3 own address: what must stay out of search ----------
  for (const p of PRIVATE) { const g = await get(own, p); ok(metaNoindex(g.t) && hdrNoindex(g.r), `own ${p}: still noindex when live`); }
  for (const p of ["/admin", "/nope"]) ok(hdrNoindex((await get(own, p)).r), `own ${p}: X-Robots-Tag noindex`);   // (the data routes are kept out by robots.txt once live)

  // ---------- 4 the workers.dev copy and the bare domain: never in search, everything points at the shop's address ----------
  for (const c of [copy, apex]) {
    const r2 = await get(c, "/robots.txt"), s2 = await get(c, "/sitemap.xml");
    ok(!/Sitemap:/i.test(r2.t), `${c.name}: robots.txt names no sitemap`);
    ok(s2.r.status === 404 && hdrNoindex(s2.r), `${c.name}: no sitemap: ${s2.r.status}`);
    for (const p of [...PUBLIC, ...PRIVATE]) {
      const g = await get(c, p);
      ok(metaNoindex(g.t) && hdrNoindex(g.r), `${c.name} ${p}: noindex in the page and the header`);
      if (PUBLIC.includes(p)) ok(canon(g.t) === OWN + (p === "/" ? "/" : p) && ogUrl(g.t) === canon(g.t) && (ogImg(g.t) || "").startsWith(OWN + "/"), `${c.name} ${p}: canonical, og:url and og:image point at the shop's address: ${canon(g.t)}`);
    }
  }
  // the demo's own photos and scripts stay noindex too (public/_headers names the workers.dev address)
  for (const p of ["/img/share.jpg", "/app.js"]) { const r = await fetch(copy.base + p, { signal: AbortSignal.timeout(20000) }); await r.arrayBuffer(); ok(r.status === 200 && hdrNoindex(r), `copy ${p}: a static file on workers.dev says noindex: ${r.status} ${r.headers.get("x-robots-tag")}`); }
} catch (e) { ok(false, "stopped early: " + (e && e.message || e)); } finally {
  for (const c of copies) kill(c.proc);
  await sleep(1500); try { rmSync(work, { recursive: true, force: true }); } catch {}
}
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
