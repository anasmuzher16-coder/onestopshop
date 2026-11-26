// Loaded before each suite by ci-suites.mjs (node --import), on GitHub's machines only; the suites themselves are unchanged.
// Every request to the local store goes on a fresh connection. The local store (wrangler dev) closes a kept-alive connection
// after a short idle without saying how long it keeps them, and Node's fetch reuses an idle connection for up to 4 s: a request
// sent on one the store has just closed fails with "other side closed" before any answer. On these slower machines a suite that
// pauses for a database read (test-account: two `wrangler d1 execute` calls in a row) lands in that gap every time
// (runs 45895074323 and 45897763778, test-account.mjs:303, the store still answering afterwards). No retry: the request is sent once.
const real = globalThis.fetch;
const local = u => { try { const h = new URL(typeof u === "string" ? u : u instanceof URL ? u.href : u.url).hostname; return h === "127.0.0.1" || h === "localhost"; } catch { return false; } };
globalThis.fetch = (input, init = {}) => {
  if (!local(input)) return real(input, init);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  if (!headers.has("connection")) headers.set("connection", "close");
  return real(input, { ...init, headers });
};

// TEMPORARY (CI diagnosis): CI_PAGE_LOG=1 prints every page's console, errors and navigations, with times, to the suite output.
if (process.env.CI_PAGE_LOG) {
  const { createRequire } = await import("node:module");
  const pw = createRequire(process.env.PW_FROM)("playwright"), t0 = Date.now(), ts = () => ((Date.now() - t0) / 1000).toFixed(2);
  const watch = p => { p.on("console", m => console.error(`[page ${ts()}] ${m.type()} ${m.text().slice(0, 300)}`)); p.on("pageerror", e => console.error(`[page ${ts()}] pageerror ${(e.stack || e.message).slice(0, 600)}`));
    p.on("framenavigated", f => { if (f === p.mainFrame()) console.error(`[page ${ts()}] nav ${f.url()}`); });
    const shot = p.screenshot.bind(p); p.screenshot = async o => { console.error(`[page ${ts()}] screenshot start ${o?.fullPage ? "fullPage" : ""}`); const r = await shot(o); console.error(`[page ${ts()}] screenshot end`); return r; }; };
  for (const type of [pw.chromium, pw.webkit]) {
    const launch = type.launch.bind(type);
    type.launch = async (...a) => { const b = await launch(...a), nc = b.newContext.bind(b), np = b.newPage.bind(b);
      b.newContext = async (...o) => { const c = await nc(...o); c.on("page", watch); const cnp = c.newPage.bind(c); c.newPage = async () => { const p = await cnp(); return p; }; return c; };
      b.newPage = async (...o) => { const p = await np(...o); watch(p); return p; }; return b; };
  }
}
