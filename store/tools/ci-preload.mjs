// Loaded before each suite by ci-suites.mjs (node --import) when it runs on GitHub's machines; the suites themselves are unchanged
// and the laptop runs them without it.
// Every request to the local store goes on a fresh connection. The local store (wrangler dev) closes a kept-alive connection
// after a short idle without saying how long it keeps them, and Node's fetch reuses an idle connection for up to 4 s: a request
// sent on one the store has just closed fails with "other side closed" before any answer. On these slower machines a suite that
// pauses for a database read (test-account: two `wrangler d1 execute` calls in a row) lands in that gap every time
// (runs 45895074323 and 45897763778, test-account.mjs:303, the store still answering afterwards). No retry: the request is sent once.
const real = globalThis.fetch;
const local = u => { try { const h = new URL(typeof u === "string" ? u : u instanceof URL ? u.href : u.url).hostname; return h === "127.0.0.1" || h === "localhost"; } catch { return false; } };
globalThis.fetch = async (input, init) => {
  init = init ?? {};
  if (!local(input)) return real(input, init);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));   // an invalid header rejects, as fetch itself does
  if (!headers.has("connection")) headers.set("connection", "close");
  return real(input, { ...init, headers });
};
