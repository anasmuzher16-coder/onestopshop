// A stand-in for Resend (the mail service), for local tests only. No keys, no network, nothing is ever delivered: it
// speaks the one call the store makes (POST /emails), checks the key, keeps Resend's Idempotency-Key rule (the same key
// with the same body answers the same id and is not counted twice), and can be told to fail the next sends.
// node store/tools/fake-resend.mjs   then run the store with
//   --var RESEND_API_KEY:re_test_local --var EMAIL_FROM:"One Stop Shop <orders@shop.test>" --var OWNER_EMAIL:counter@shop.test --var RESEND_API_BASE:http://127.0.0.1:4497
// Test-only controls: GET /__log (every email accepted, in order), POST /__fail?n=2&status=500 (fail the next n sends), POST /__reset.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
const PORT = +(process.env.RESEND_PORT || 4497), KEY = process.env.RESEND_KEY || "re_test_local";
let sent = [], calls = [], idem = new Map(), fail = { n: 0, status: 500 };
const reply = (res, o, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
const body = req => new Promise(f => { let d = ""; req.on("data", c => d += c); req.on("end", () => f(d)); });

createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), raw = await body(req);
  if (u.pathname === "/__log") return reply(res, { sent, calls });
  if (u.pathname === "/__fail") { fail = { n: +(u.searchParams.get("n") || 1), status: +(u.searchParams.get("status") || 500) }; return reply(res, { ok: true, fail }); }
  if (u.pathname === "/__reset") { sent = []; calls = []; idem = new Map(); fail = { n: 0, status: 500 }; return reply(res, { ok: true }); }
  if (req.method !== "POST" || u.pathname !== "/emails") return reply(res, { statusCode: 404, name: "not_found", message: "Not found" }, 404);
  const key = req.headers["idempotency-key"] || null;
  calls.push({ at: Date.now(), key });
  if (req.headers.authorization !== `Bearer ${KEY}`) return reply(res, { statusCode: 401, name: "missing_api_key", message: "API key is invalid" }, 401);
  if (fail.n > 0) { fail.n--; calls[calls.length - 1].failed = fail.status; return reply(res, { statusCode: fail.status, name: "application_error", message: "The stand-in was told to fail" }, fail.status); }
  let m; try { m = JSON.parse(raw); } catch { return reply(res, { statusCode: 422, name: "validation_error", message: "Body is not JSON" }, 422); }
  if (!m.from || !Array.isArray(m.to) || !m.to.length || !m.subject || !(m.html || m.text)) return reply(res, { statusCode: 422, name: "validation_error", message: "from, to, subject and html or text are required" }, 422);
  // like Resend, an address it cannot parse is refused (and refused again on every retry)
  const addr = s => typeof s === "string" && s.length <= 254 && !s.includes("..") && /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@([A-Za-z0-9-]+\.)+([A-Za-z]{2,}|xn--[A-Za-z0-9-]+)$/.test(s);
  if (!m.to.every(addr)) return reply(res, { statusCode: 422, name: "validation_error", message: "Invalid `to` field." }, 422);
  if (m.reply_to !== undefined && !(Array.isArray(m.reply_to) ? m.reply_to : [m.reply_to]).every(addr)) return reply(res, { statusCode: 422, name: "validation_error", message: "Invalid `reply_to` field." }, 422);
  if (key && idem.has(key)) {
    const was = idem.get(key);
    if (was.raw !== raw) return reply(res, { statusCode: 409, name: "invalid_idempotent_request", message: "Same idempotency key used with a different request payload" }, 409);
    return reply(res, { id: was.id });
  }
  const id = randomBytes(16).toString("hex");
  if (key) idem.set(key, { id, raw });
  sent.push({ id, key, from: m.from, to: m.to, reply_to: m.reply_to ?? null, subject: m.subject, html: m.html || "", text: m.text || "" });
  return reply(res, { id });
}).listen(PORT, "127.0.0.1", () => console.log(`fake resend on ${PORT}`));
