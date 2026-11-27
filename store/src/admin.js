import { orderShipped, pickupReady, writeEmail, resendEmail, mailReady } from "./email.js";
import { snapshot } from "./backup.js";
import { CHARCOAL } from "./catalog.js";
import { adminPay, lowNote } from "./pay.js";
import { sameSecret, hashPin, checkPin, pinProblem, cleanName } from "./staff.js";
import { report, reportCsv, monthOf } from "./report.js";
import { isSample } from "./samples.js";
import { sourceOf, TAKEN_SQL, keyedHash, normEmailSql } from "./guard.js";
// The shop's back office: sign-in, shop numbers, stock and orders. Every route here needs the admin cookie,
// and every write also needs a same-site JSON request, so another website cannot trigger one.
// Two kinds of sign-in: the owner's passcode (ADMIN_KEY), and named staff with a 6-digit PIN. Every change is
// written down with the name of whoever was signed in. Staff can do the daily work; only the owner manages
// staff, settings, the monthly report and the full backup.
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
const COOKIE = "oss_admin";
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const sha = async s => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const cookieToken = request => ((request.headers.get("Cookie") || "").match(/(?:^|;\s*)oss_admin=([a-f0-9]{64})/) || [])[1];
const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
export async function signedIn(request, env) {
  // each sign-in is its own random token, kept only as a hash. It ends after 12 hours, after 2 hours left alone,
  // on sign-out, and (for staff) the moment the owner removes that person.
  const t = cookieToken(request); if (!t) return null;
  const h = await sha(t);
  const s = await env.DB.prepare(`SELECT s.actor, s.staff_id, s.last_seen, st.active FROM sessions s LEFT JOIN staff st ON st.id = s.staff_id
    WHERE s.token_hash = ? AND s.expires_at > ${NOW} AND (s.last_seen IS NULL OR s.last_seen > strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 hours'))`).bind(h).first();
  if (!s || (s.staff_id !== null && s.active !== 1)) return null;
  if (!s.last_seen || Date.parse(s.last_seen) < Date.now() - 5 * 60e3) await env.DB.prepare(`UPDATE sessions SET last_seen = ${NOW} WHERE token_hash = ?`).bind(h).run();
  return { actor: s.actor, staff_id: s.staff_id, owner: s.staff_id === null };
}
const LOCKED = "Too many wrong tries. Wait 15 minutes and try again.";
const NAME_DAY_CAP = 20;   // wrong tries on one staff name in a day from unfamiliar devices and places (docs/BACKEND-NOTES.md)
const NAME_LOCKED = "Too many wrong tries for this name today. Sign in from a phone or computer that has signed in here before, or ask the owner.";
const DEVICE_WRONG_CAP = 10, PLACE_WRONG_CAP = 10;   // wrong tries in a day after which a familiar device is treated as unfamiliar
// The known-device cookie (2026-11-27): a random id and an HMAC of it keyed with the Worker secret, set at every correct sign-in and
// recorded then (login_attempts, who = "d:" + keyed hash, ok = 1, staff_id). It counts as familiar only while that record is under
// 400 days old and the person who signed in there is still on the staff list (or it was the owner). It never signs anyone in.
const DEV_COOKIE = "oss_dev", DEVICE_DAYS = 400;
const deviceSig = async (env, id) => { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode("dev|" + (env.PIN_PEPPER || env.ADMIN_KEY || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(id))); };
async function deviceFrom(request, env) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)oss_dev=([a-f0-9]{32})\.([a-f0-9]{64})(?:;|$)/); if (!m) return null;
  return await sameSecret(m[2], await deviceSig(env, m[1])) ? m[1] : null;
}
export const shopDevice = async (request, env) => !!(await deviceFrom(request, env)) && !!(await env.DB.prepare("SELECT 1 AS x FROM login_attempts a LEFT JOIN staff st ON st.id = a.staff_id WHERE a.who = ? AND a.ok = 1 AND a.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days') AND (a.staff_id IS NULL OR st.active = 1) LIMIT 1").bind("d:" + await keyedHash(env, "dev", await deviceFrom(request, env))).first("x"));
// The test suites switch a few demo samples back on in their own throwaway local database (tools/fixtures/samples-on.mjs), so
// they have items of kinds the shop does not sell yet. Only with SAMPLES_TEST_ONLY=1 (set by the test runners, never in
// wrangler.jsonc), on a store reached at 127.0.0.1 or localhost, never with LIVE=1, and only when the fixture marks its own request
// (X-OSS-Test-Samples: 1), so a suite can still check that an ordinary save is refused. Everywhere else a sample stays off.
const samplesForTests = (env, url, request) => env.SAMPLES_TEST_ONLY === "1" && env.LIVE !== "1" && ["127.0.0.1", "localhost"].includes(url.hostname) && request.headers.get("X-OSS-Test-Samples") === "1";
const cleanOp = v => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v) ? v : null;   // a tap's own key, so a repeat counts once
// Whether migration 0011 (email retries) is applied, so the order sheet still opens on a database that is behind the code.
let retryCols = null;
const hasRetry = async db => retryCols ||= await db.prepare("SELECT next_try_at, tries FROM emails LIMIT 0").all().then(() => true, () => false);
const log = (event, fields) => console.log(JSON.stringify({ at: "admin", event, ...fields }));   // never a PIN, passcode or token
const CHARCOAL_ITEM = `(p.category_id = '${CHARCOAL}' OR p.details LIKE '%"charcoal":true%')`;   // Heat (foil, heat management) is not charcoal since 2026-11-24
// A product added to the charcoal section, and any charcoal item saved later, is stored as charcoal, pickup or local delivery only, whatever the form sent.
// (The storefront and checkout enforce the same from the section alone; this keeps the stored row honest too.)
function charcoalRules(out, was) {
  out.ship_class = "pickup_only";
  const d = "details" in out ? JSON.parse(out.details) : was;
  out.details = JSON.stringify({ ...d, charcoal: true });
}
const SOLD = "('paid','packed','shipped','ready','collected')";
// Pickup requests (2026-11-27): a pay-at-the-counter order takes no stock when placed. STOCKED: the order's own stock moves show it
// holds stock now. TO_CONFIRM: still a request the shop has to check against the shelf and mark ready (nothing held yet).
const STOCKED = t => `EXISTS (SELECT 1 FROM ${TAKEN_SQL(`${t}.id`)})`;
const TO_CONFIRM = t => `${t}.status = 'pending' AND ${t}.pay_status = 'pay_at_pickup' AND ${t}.release_op IS NULL AND NOT EXISTS (SELECT 1 FROM stock_moves sm WHERE sm.ref = ${t}.id AND sm.reason = 'sale')`;
// Other open pickup orders with the same email (as one person: normEmailSql) that were placed from a different network (2026-11-27):
// a stranger typing a customer's email shows up this way, so staff can see it on the list and cancel it. Counted only for open
// pickup orders, and only between orders whose network is on record (order_attempts, migration 0012; "o:" = IPv4 or IPv6 /56).
const OPEN_PICKUP = t => `${t}.pay_status = 'pay_at_pickup' AND ${t}.status IN ('pending','ready') AND ${t}.release_op IS NULL`;
// A phone as digits (separators and a leading North American 1 dropped), so the same customer on mobile data and then home Wi-Fi,
// with the same phone, is not flagged (breaker, 2026-11-27).
const PHONE_SQL = c => { const d = `replace(replace(replace(replace(replace(replace(COALESCE(${c},''),' ',''),'-',''),'(',''),')',''),'.',''),'+','')`; return `(CASE WHEN length(${d}) = 11 AND substr(${d},1,1) = '1' THEN substr(${d},2) ELSE ${d} END)`; };
const OTHER_NETS = t => `CASE WHEN ${OPEN_PICKUP(t)} AND EXISTS (SELECT 1 FROM order_attempts a0 WHERE a0.order_id = ${t}.id AND a0.who LIKE 'o:%') THEN (SELECT COUNT(*) FROM orders o2 WHERE o2.id != ${t}.id AND ${OPEN_PICKUP("o2")}
  AND NOT (COALESCE(o2.phone,'') != '' AND ${PHONE_SQL("o2.phone")} = ${PHONE_SQL(`${t}.phone`)})
  AND ${normEmailSql("o2.email")} = ${normEmailSql(`${t}.email`)} AND EXISTS (SELECT 1 FROM order_attempts a2 WHERE a2.order_id = o2.id AND a2.who LIKE 'o:%')
  AND NOT EXISTS (SELECT 1 FROM order_attempts a1 JOIN order_attempts a2 ON a2.who = a1.who WHERE a1.order_id = ${t}.id AND a2.order_id = o2.id AND a1.who LIKE 'o:%')) ELSE 0 END`;
const noTable = err => /no such table/i.test(String(err && err.message));   // a database without migration 0012: the note is left out
const LOCAL = "'-5 hours'"; // the shop's clock (Windsor), close enough for day totals
const clampInt = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const text = (v, max) => typeof v === "string" && v.trim().length <= max ? v.trim() : null;
// The colours the shop has for one item, from the item editor: [{ name, hex? }]. A name is letters (and spaces, & / ' -),
// up to 24; a hex only for a colour the shop added itself. The same name twice counts once. [] means "not known".
export function cleanColours(list) {
  if (!Array.isArray(list) || list.length > 16) return null;
  const out = [], seen = new Set();
  for (const c of list) {
    const raw = typeof c === "string" ? c : c && typeof c === "object" ? c.name : null;
    if (typeof raw !== "string") return null;
    const name = raw.replace(/\s+/g, " ").trim();
    if (!/^[\p{L}][\p{L} &/'-]{0,23}$/u.test(name)) return null;
    const hex = c && typeof c === "object" && c.hex != null ? (typeof c.hex === "string" && /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex.toLowerCase() : false) : null;
    if (hex === false) return null;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase()); out.push(hex ? { name, hex } : { name });
  }
  return out;
}
export const joinColours = names => names.length < 2 ? names[0] || "" : names.slice(0, -1).join(", ") + " and " + names.at(-1);
// What an item on view still needs from the shop before it reads complete: its price, its colours (Ace catalogue items),
// its shelf count. Shown as the "Needs info" list in the back office, in the order the list is in.
export function needsInfo(p) {
  let f = {}, d = {}; try { f = JSON.parse(p.facts_known || "{}") || {}; } catch {} try { d = JSON.parse(p.details || "{}") || {}; } catch {}
  const ace = ["ace", "ace-acc"].includes(p.supplier_id);
  const onView = (p.active === 1 || p.listed === 1) && p.availability !== "dropped" && !(ace && f.stamp === "none") && !isSample(p.sku);
  if (!onView) return [];
  return [!(p.price_cents > 0) && "price", ace && !(Array.isArray(d.colours) && d.colours.length) && !(String(p.family || "").startsWith("ace-") && d.colour) && "colours", ["in_store_uncounted", "special_order"].includes(p.availability) && "stock"].filter(Boolean);
}

export async function admin(request, env, url) {
  const path = url.pathname.replace(/^\/api\/admin/, ""), method = request.method, db = env.DB;
  // a browser says when a request comes from another site (Fetch Metadata); any write that does is refused, sign-in included
  const site = request.headers.get("Sec-Fetch-Site");
  if (method !== "GET" && site && site !== "same-origin") return json({ error: "Wrong origin." }, 403);
  if ((path === "/login" || path === "/logout") && method === "POST" && (!(request.headers.get("Content-Type") || "").startsWith("application/json") || request.headers.get("X-OSS-Admin") !== "1")) return json({ error: "Missing request marker." }, 400);   // no sign-in or sign-out from a plain form on another site
  if (path === "/login" && method === "POST") {
    if (!env.ADMIN_KEY) return json({ error: "The admin passcode has not been set up yet." }, 503);
    const body = await request.json().catch(() => ({}));
    const staffLogin = typeof body.name === "string" || typeof body.pin === "string";
    if (staffLogin && env.LIVE === "1" && !env.PIN_PEPPER) return json({ error: "Staff sign-in is not set up yet. Sign in with the owner passcode." }, 503);
    const name = staffLogin ? cleanName(body.name) : null;
    // Sign-in limits (docs/BACKEND-NOTES.md; reworked 2026-11-27 twice so no set of addresses can lock the shop out and a 6-digit PIN
    // cannot be guessed online). A request already over a limit is refused BEFORE anything is written, so it cannot keep adding tries;
    // a try that gets through is written down, then counted again, so a burst of tries at once is still counted in full.
    //  - one address (IPv4, or IPv6 by its /56), 15 minutes: more than 5 wrong tries and that address waits. Its wider IPv6 /48: 5 in all.
    //  - one staff name, a day, from devices and places the shop has not seen sign in: past 3 wrong tries each try is slowed
    //    (doubling from 500 ms, up to 8 s); at NAME_DAY_CAP (20) they are refused for that name for the rest of the day. 20 a day
    //    puts the expected time to guess one PIN at about 68 years. Only names on the staff list count against a name: a name that
    //    does not exist is counted under its own separate key with the same rules (so the answers never show who works here), and
    //    a staff member added later starts clean, so a common first name cannot be locked in advance.
    //  - familiar devices and places are not held by the name's count: a phone or computer where THIS person signed in correctly
    //    before (a signed oss_dev cookie, recorded at that sign-in with their staff id, while they are still on the staff list; for
    //    the owner, a device the owner signed in on), or an address where someone still on the staff list (or the owner) signed in
    //    correctly in the last 30 days. Each has its own ceiling: 10 wrong tries in a day from that device, or from that address,
    //    and it is treated as unfamiliar for the rest of the day. So a stranger hammering a name never locks the real person out at
    //    their own phone or the counter, and neither a device nor a place is a way round the day's ceiling (breaker, 2026-11-27).
    //    Not covered: anyone sharing the counter's public address can still use up that address's 5 tries in 15 minutes.
    //  - the owner's passcode: no shop-wide lock. Past 20 wrong tries shop-wide, each try from an unfamiliar device and place is
    //    slowed (doubling, up to 8 s). The passcode (ADMIN_KEY) must be long and random.
    // Addresses, names and devices are stored only as keyed hashes (src/guard.js keyedHash). Signed-in sessions are never touched.
    let staff = staffLogin && name ? await db.prepare("SELECT id, name, pin_hash FROM staff WHERE lower(name) = lower(?) AND active = 1").bind(name).first() : null;
    const nameKey = (staff ? "n:" : "u:") + await keyedHash(env, "name", (name || String(body.name || "")).toLowerCase());
    const who = await keyedHash(env, "who", sourceOf(request)), side = (staffLogin ? "s:" : "p:") + await keyedHash(env, "from", sourceOf(request, 48));   // the /48, its own count
    const dev = await deviceFrom(request, env), devKey = dev ? "d:" + await keyedHash(env, "dev", dev) : null, devWrong = dev ? "e:" + await keyedHash(env, "dev", dev) : null;
    const count = () => db.prepare(`SELECT COALESCE(SUM(ok = 0 AND who = ?1 AND at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')),0) AS mine, COALESCE(SUM(ok = 0 AND who = ?1),0) AS mine_day, COALESCE(SUM(ok = 0 AND who = ?2),0) AS name_day,
      COALESCE(SUM(ok = 0 AND who = ?3 AND at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')),0) AS place, COALESCE(SUM(ok = 0 AND who = ?4),0) AS dev_wrong,
      COALESCE(SUM(ok = 0 AND who LIKE 'p:%' AND at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')),0) AS owner_all FROM login_attempts WHERE at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day') AND ok = 0`).bind(who, nameKey, side, devWrong || "-").first();
    // a place: someone still on the staff list (or the owner) signed in there; a device: this very person (or, for the passcode, the owner)
    const [placeKnown, devKnown] = await db.batch([db.prepare("SELECT 1 AS x FROM login_attempts a LEFT JOIN staff st ON st.id = a.staff_id WHERE a.who = ? AND a.ok = 1 AND a.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') AND (a.staff_id IS NULL OR st.active = 1) LIMIT 1").bind(who),
      db.prepare("SELECT 1 AS x FROM login_attempts a LEFT JOIN staff st ON st.id = a.staff_id WHERE a.who = ?1 AND a.ok = 1 AND a.at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days') AND ((?2 = 0 AND a.staff_id IS NULL) OR (?2 = 1 AND a.staff_id = ?3 AND st.active = 1)) LIMIT 1").bind(devKey || "-", staffLogin ? 1 : 0, staff ? staff.id : -1)]);
    let tries = await count();
    const familiar = t => (placeKnown.results.length > 0 && t.mine_day < PLACE_WRONG_CAP) || (devKnown.results.length > 0 && t.dev_wrong < DEVICE_WRONG_CAP);
    const locked = t => t.mine > 5 || t.place > 5 || (staffLogin && !familiar(t) && t.name_day >= NAME_DAY_CAP);
    const lockWords = t => t.mine > 5 || t.place > 5 ? LOCKED : NAME_LOCKED;
    if (locked(tries)) { log("login_locked", { staff: staffLogin }); return json({ error: lockWords(tries) }, 429); }
    // the device's own wrong-try row is written with the others, before the PIN is checked (and taken back on success), so tries
    // at the same moment from many addresses are counted in full against the device's ceiling
    const mark = await db.batch([db.prepare("INSERT INTO login_attempts (who, ok) VALUES (?, 0)").bind(who), db.prepare("INSERT INTO login_attempts (who, ok) VALUES (?, 0)").bind(side),
      db.prepare("DELETE FROM login_attempts WHERE ok = 0 AND at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"), db.prepare("INSERT INTO login_attempts (who, ok) VALUES (?, 0)").bind(devWrong || "e:none")]);
    const own = t => ({ ...t, mine_day: t.mine_day - 1, dev_wrong: t.dev_wrong - (devWrong ? 1 : 0) });   // from here this try's own rows are in the count
    tries = own(await count());
    if (locked(tries)) { log("login_locked", { staff: staffLogin }); return json({ error: lockWords(tries) }, 429); }
    // the name's own row only once this address is through its own limit, so one address's burst cannot use up a name; a familiar
    // device or place writes none, so the real person signing in from their own phone never adds to a stranger's count
    let nameRow = null;
    if (staffLogin && !familiar(tries)) { nameRow = await db.prepare("INSERT INTO login_attempts (who, ok) VALUES (?, 0)").bind(nameKey).run(); tries = own(await count()); if (locked({ ...tries, name_day: tries.name_day - 1 })) { log("login_locked", { staff: true }); return json({ error: NAME_LOCKED }, 429); } }
    const slow = familiar(tries) ? 0 : staffLogin ? (tries.name_day > 3 ? Math.min(8000, 500 * 2 ** (tries.name_day - 4)) : 0) : (tries.owner_all > 20 ? Math.min(8000, 250 * 2 ** Math.floor((tries.owner_all - 21) / 10)) : 0);
    if (slow) await new Promise(r => setTimeout(r, slow));
    if (!staffLogin && env.LIVE === "1" && String(env.ADMIN_KEY).length < 16) console.error(JSON.stringify({ at: "admin", problem: "ADMIN_KEY is shorter than 16 characters: set a long random passcode (docs/BACKEND-NOTES.md)" }));
    let right = false;
    if (staffLogin) right = await checkPin(env, typeof body.pin === "string" ? body.pin : "", staff && staff.pin_hash) && !!staff;   // the same work whether or not the name exists
    else right = typeof body.passcode === "string" && await sameSecret(body.passcode, env.ADMIN_KEY);
    if (!right) {
      // the same write whether or not the name exists, so the answer's timing does not show who works here
      await db.prepare("UPDATE login_attempts SET staff_id = ? WHERE id = ?").bind(staff ? staff.id : null, mark[0].meta.last_row_id).run();
      log("login_failed", { staff: staffLogin }); return json({ error: staffLogin ? "That name and PIN do not match." : "That passcode is not right." }, 401);
    }
    if (!staffLogin) staff = null;
    const device = dev || hex(crypto.getRandomValues(new Uint8Array(16))), deviceKey = "d:" + await keyedHash(env, "dev", device);
    await db.batch([db.prepare("UPDATE login_attempts SET ok = 1, staff_id = ? WHERE id = ?").bind(staff ? staff.id : null, mark[0].meta.last_row_id), db.prepare("DELETE FROM login_attempts WHERE id IN (?, ?)").bind(mark[1].meta.last_row_id, mark[3].meta.last_row_id), ...(nameRow ? [db.prepare("DELETE FROM login_attempts WHERE id = ?").bind(nameRow.meta.last_row_id)] : []),
      // this device is now familiar for this person (deviceFrom); one row per device and person a day, so rows do not pile up
      db.prepare("INSERT INTO login_attempts (who, ok, staff_id) SELECT ?1, 1, ?2 WHERE NOT EXISTS (SELECT 1 FROM login_attempts WHERE who = ?1 AND ok = 1 AND staff_id IS ?2 AND at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day'))").bind(deviceKey, staff ? staff.id : null)]);
    const actor = staff ? `${staff.name} #${staff.id}` : "owner", t = hex(crypto.getRandomValues(new Uint8Array(32)));
    await db.batch([
      db.prepare(`INSERT INTO sessions (token_hash, expires_at, actor, staff_id, last_seen) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ','now','+12 hours'), ?, ?, ${NOW})`).bind(await sha(t), actor, staff ? staff.id : null),
      db.prepare("DELETE FROM sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%SZ','now') OR last_seen <= strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 hours')"), db.prepare("DELETE FROM login_attempts WHERE ok = 0 AND at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"),
      db.prepare("INSERT INTO audit_log (actor, action) VALUES (?, 'session.login')").bind(actor),
    ]);
    const secure = url.protocol === "https:" ? " Secure;" : "";
    const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    h.append("Set-Cookie", `${COOKIE}=${t}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${60 * 60 * 12}`);
    h.append("Set-Cookie", `${DEV_COOKIE}=${device}.${await deviceSig(env, device)}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${DEVICE_DAYS * 86400}`);
    return new Response(JSON.stringify({ ok: true, actor, owner: !staff }), { status: 200, headers: h });
  }
  if (path === "/logout" && method === "POST") { const t = cookieToken(request); if (t) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(t)).run(); }
  if (path === "/logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
  const session = await signedIn(request, env);
  if (!session) return json({ error: "Sign in first." }, 401);
  if (method !== "GET") {
    if (!(request.headers.get("Content-Type") || "").startsWith("application/json") && !path.endsWith("/photo")) return json({ error: "Send JSON." }, 415);
    if (request.headers.get("X-OSS-Admin") !== "1") return json({ error: "Missing request marker." }, 400);
    const origin = request.headers.get("Origin"); if (origin && origin !== url.origin) return json({ error: "Wrong origin." }, 403);
  }
  const actor = session.actor;
  const ownerOnly = /^\/(staff|settings|report|backup)/.test(path);
  if (ownerOnly && !session.owner) { log("forbidden", { actor, path }); return json({ error: "Only the owner can open this." }, 403); }
  if (path === "/me" && method === "GET") return json({ actor, owner: session.owner });

  if (path === "/summary" && method === "GET") {
    const [tot, daily, top, slow, low, prov, ship, value, todo] = await db.batch([
      db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN date(created_at,${LOCAL}) = date('now',${LOCAL}) THEN total_cents END),0) AS today_cents,
        COUNT(CASE WHEN date(created_at,${LOCAL}) = date('now',${LOCAL}) THEN 1 END) AS today_orders,
        COALESCE(SUM(CASE WHEN created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days') THEN total_cents END),0) AS week_cents,
        COUNT(CASE WHEN created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days') THEN 1 END) AS week_orders,
        COALESCE(SUM(CASE WHEN created_at < strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days') AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days') THEN total_cents END),0) AS prev_week_cents,
        COALESCE(SUM(CASE WHEN created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') THEN total_cents END),0) AS month_cents,
        COUNT(CASE WHEN created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') THEN 1 END) AS month_orders
        FROM orders WHERE status IN ${SOLD}`),
      db.prepare(`SELECT date(created_at,${LOCAL}) AS day, SUM(total_cents) AS cents, COUNT(*) AS orders FROM orders WHERE status IN ${SOLD} AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') GROUP BY day ORDER BY day`),
      db.prepare(`SELECT i.sku, i.name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_cents) AS cents FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status IN ${SOLD} AND o.created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') GROUP BY i.sku ORDER BY cents DESC LIMIT 6`),
      db.prepare(`SELECT p.sku, p.name, p.stock, p.price_cents FROM products p WHERE p.active = 1 AND p.stock > 0 AND NOT EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.sku = p.sku AND o.created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')) ORDER BY p.stock * p.price_cents DESC LIMIT 6`),
      db.prepare("SELECT sku, name, stock, low_stock_at FROM products WHERE active = 1 AND stock <= low_stock_at ORDER BY stock, name LIMIT 40"),
      db.prepare(`SELECT tax_province AS province, COUNT(*) AS orders, SUM(total_cents) AS cents FROM orders WHERE status IN ${SOLD} AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') GROUP BY tax_province ORDER BY orders DESC`),
      db.prepare(`SELECT COALESCE(SUM(shipping_cents),0) AS collected, COALESCE(SUM(label_cents),0) AS paid, COUNT(*) AS parcels FROM orders WHERE method = 'ship' AND label_cents IS NOT NULL AND status IN ${SOLD} AND created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')`),
      db.prepare("SELECT COALESCE(SUM(stock * COALESCE(cost_cents, 0)),0) AS cost_cents, COALESCE(SUM(stock * price_cents),0) AS retail_cents, COALESCE(SUM(stock),0) AS units, COUNT(*) AS products FROM products WHERE active = 1"),
      db.prepare(`SELECT SUM(status = 'paid') AS to_pack, SUM(status = 'packed') AS to_ship, SUM(status = 'ready') AS waiting_pickup, SUM(status = 'ready' AND COALESCE(ready_at, updated_at) <= strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days')) AS pickup_overdue, SUM(${TO_CONFIRM("orders")}) AS to_confirm FROM orders WHERE status IN ('paid','packed','ready','pending')`),
    ]);
    // the pickup requests still to confirm, newest first, for Today's own list (2026-11-27): while the shop's mail is not connected no
    // new-order note reaches anyone, so Today is where staff see a new request: name, phone, when, and how many items
    const confirm = (await db.prepare(`SELECT o.id, o.name, o.phone, o.created_at, o.pay_expires_at, o.total_cents, COALESCE((SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id), 0) AS units FROM orders o WHERE ${TO_CONFIRM("o")} ORDER BY o.created_at DESC LIMIT 25`).all()).results;
    return json({ totals: tot.results[0], daily: daily.results, top: top.results, slow: slow.results, low: low.results, provinces: prov.results, shipping: ship.results[0], value: value.results[0], todo: todo.results[0], confirm, mail_on: mailReady(env), actor, owner: session.owner });
  }

  if (path === "/products" && method === "GET") {
    const [p, c, b] = await db.batch([
      db.prepare("SELECT sku, name, category_id, price_cents, cost_cents, weight_g, box_id, glass, ship_class, height_cm, note, img, img_dark, photo_ver, details, stock, low_stock_at, active, listed, family, variant_label, availability, supplier_id, facts_known, updated_at FROM products ORDER BY active DESC, sort, sku"),
      db.prepare("SELECT id, name, tone FROM categories ORDER BY sort"), db.prepare("SELECT id, label, l_cm, w_cm, h_cm FROM boxes ORDER BY l_cm * w_cm * h_cm"),
    ]);
    // the demo's made-up samples are marked, so nobody switches one back on taking it for the shop's own stock (2026-11-24)
    // each row also says what it still needs from the shop (price, colours, shelf count), for the "Needs info" list and its count
    return json({ products: p.results.map(r => { const { supplier_id, facts_known, ...row } = r, needs = needsInfo(r); return { ...row, ...(isSample(r.sku) ? { sample: true } : {}), ...(needs.length ? { needs } : {}), ...(["ace", "ace-acc"].includes(supplier_id) ? { catalogue: true } : {}) }; }), categories: c.results, boxes: b.results });
  }

  // one product: fields to save, validated here so nothing odd reaches the storefront
  const fields = async body => {
    const out = {}, bad = [];
    const set = (k, v, label) => { if (v === null) bad.push(label); else out[k] = v; };
    if ("name" in body) set("name", text(body.name, 80) || null, "name");
    if ("category_id" in body) set("category_id", (await db.prepare("SELECT id FROM categories WHERE id = ?").bind(String(body.category_id)).first("id")) ?? null, "section");
    if ("price_cents" in body) set("price_cents", clampInt(body.price_cents, 0, 5000000), "price");
    if ("cost_cents" in body) out.cost_cents = body.cost_cents === null || body.cost_cents === "" ? null : clampInt(body.cost_cents, 0, 5000000);
    if ("weight_g" in body) set("weight_g", clampInt(body.weight_g, 1, 30000), "weight");
    if ("box_id" in body) set("box_id", (await db.prepare("SELECT id FROM boxes WHERE id = ?").bind(String(body.box_id)).first("id")) ?? null, "box");
    if ("ship_class" in body) set("ship_class", ["standard", "ground_only", "pickup_only"].includes(body.ship_class) ? body.ship_class : null, "shipping type");
    if ("glass" in body) out.glass = body.glass ? 1 : 0;
    if ("active" in body) out.active = body.active ? 1 : 0;
    if ("note" in body) set("note", text(body.note, 200), "description");
    // a catalogue colour's name (the photo's guess until the shop corrects it); an empty name is allowed and shows "Colours TBD"
    // Kept in details (a shop column) so a later catalogue import, which refreshes variant_label, never overwrites the shop's word.
    if ("variant_label" in body) { const v = body.variant_label === null ? "" : text(body.variant_label, 40); if (v === null) bad.push("colour name"); else out.colour = v; }
    if ("low_stock_at" in body) set("low_stock_at", clampInt(body.low_stock_at, 0, 9999), "low stock level");
    if ("details" in body) { const d = body.details || {}; out.details = JSON.stringify({ ...(clampInt(d.ml, 1, 5000) ? { ml: clampInt(d.ml, 1, 5000) } : {}), ...(text(d.kind, 40) ? { kind: text(d.kind, 40) } : {}), ...(text(d.notes, 120) ? { notes: text(d.notes, 120) } : {}) }); }
    return { out, bad };
  };
  const audit = (action, target, before, after) => db.prepare("INSERT INTO audit_log (actor, action, target, before, after) VALUES (?,?,?,?,?)").bind(actor, action, target, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null);

  // Prices are the shop's, so the owner sets them (owner, 2026-11-24). Staff keep the daily work: counting, receiving,
  // names, photos, the on/off switch. A new product always carries a price, so adding one is the owner's too.
  // Checked here, on the server, for every request (OWASP Authorization Cheat Sheet: deny by default, enforce server side).
  const PRICE_FIELDS = ["price_cents", "cost_cents"];
  const NOT_YOURS = "Only the owner can change prices. Ask the owner, or sign in with the owner passcode.";
  if (path === "/products" && method === "POST" && !session.owner) { log("forbidden", { actor, path }); return json({ error: "Only the owner can add products, because a new product needs the shop's price." }, 403); }
  if (path === "/products" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { out, bad } = await fields({ ship_class: "standard", note: "", low_stock_at: 1, ...body });
    delete out.colour;   // colour names belong to catalogue colours, never to a new back-office item
    for (const k of ["name", "category_id", "price_cents", "weight_g", "box_id"]) if (!(k in out)) bad.push(k.replace(/_.*/, ""));
    if (bad.length) return json({ error: "Check: " + [...new Set(bad)].join(", ") + "." }, 400);
    if (out.category_id === CHARCOAL) charcoalRules(out, {});
    const prefix = { hookahs: 1, bases: 2, bowls: 3, heat: 4, hoses: 5, parts: 6, cologne: 7, misc: 8 }[out.category_id] || 9;
    const last = await db.prepare("SELECT MAX(CAST(substr(sku, 5) AS INTEGER)) AS n FROM products WHERE sku LIKE ? AND length(sku) = 8").bind(`OSS-${prefix}%`).first("n"); // 4-digit numbers only: OSS-SSNNNN catalogue numbers belong to store/catalog/registry.json
    const sku = "OSS-" + String(Math.max(prefix * 1000, last || 0) + 1);
    const cols = Object.keys(out), stock = clampInt(body.stock ?? 0, 0, 99999) ?? 0;
    const stmts = [db.prepare(`INSERT INTO products (sku, sort, stock, ${cols.join(", ")}) VALUES (?, 9999, ?, ${cols.map(() => "?").join(", ")})`).bind(sku, stock, ...cols.map(k => out[k])), audit("product.create", sku, null, out)];
    if (stock) stmts.push(db.prepare("INSERT INTO stock_moves (sku, delta, reason, actor) VALUES (?,?, 'count', ?)").bind(sku, stock, actor));
    await db.batch(stmts);
    return json({ ok: true, sku }, 201);
  }

  let m;
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})$/)) && method === "PUT") {
    const before = await db.prepare("SELECT * FROM products WHERE sku = ?").bind(m[1]).first(); if (!before) return json({ error: "No such product." }, 404);
    const { out, bad } = await fields(await request.json().catch(() => ({})));
    if (bad.length) return json({ error: "Check: " + bad.join(", ") + "." }, 400);
    // a made-up demo sample never goes back on sale, from any form (breaker, 2026-11-27; the item editor refuses the same)
    if (out.active === 1 && isSample(m[1]) && !samplesForTests(env, url, request)) { log("refused", { actor, path, why: "sample" }); return json({ error: "This is a made-up sample from the demo, not the shop's stock, so it stays hidden. Add the real item as a new product." }, 409); }
    if (!session.owner) {   // the edit form sends every field back; an unchanged price from staff is fine, a changed one is refused whole
      if (PRICE_FIELDS.some(k => k in out && out[k] !== before[k])) { log("forbidden", { actor, path, field: "price" }); return json({ error: NOT_YOURS }, 403); }
      for (const k of PRICE_FIELDS) delete out[k];
    }
    // The form edits only the cologne fields. Everything else in details (the charcoal mark, photo status, brand,
    // source lines, a roll's box) is kept, so saving a charcoal item in the back office never erases its rules.
    let had = {}; try { had = JSON.parse(before.details || "{}"); } catch {}
    if ("details" in out) { const { ml, kind, notes, ...keep } = had; out.details = JSON.stringify({ ...keep, ...JSON.parse(out.details) }); }
    if ("colour" in out) {   // the shop's confirmed colour name; empty takes it back to the photo's guess ("Colours TBD")
      const base = "details" in out ? JSON.parse(out.details) : { ...had }; if (out.colour) base.colour = out.colour; else delete base.colour;
      out.details = JSON.stringify(base); delete out.colour;
    }
    // charcoal stays charcoal, an item from the charcoal list too, wherever it is moved. An ordinary item moved into Charcoal is
    // charcoal by its section while it is there (src/catalog.js), and goes back to what it was if it is moved out again.
    if (had.charcoal || String(before.family || "").startsWith("charcoal-")) charcoalRules(out, had);
    const cols = Object.keys(out); if (!cols.length) return json({ ok: true });
    const was = {}; for (const k of cols) was[k] = before[k];
    try { await db.batch([db.prepare(`UPDATE products SET ${cols.map(k => k + " = ?").join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?`).bind(...cols.map(k => out[k]), m[1]), audit("product.edit", m[1], was, out)]); }
    catch (e) { if (/Set the shop price/.test(String(e && e.message))) return json({ error: "Set the shop price before turning this item on." }, 409); throw e; }
    return json({ ok: true });
  }
  // The item editor (owner, 2026-11-26: "put fields for the client to fill out on each item"): name, the colours the shop
  // has, the shelf count and the price, filled in by the shop itself item by item. Nothing is ever filled in for them:
  // a field left out of the request is left as it is. Prices stay the owner's (same rule as the full form above).
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/info$/)) && method === "PUT") {
    const before = await db.prepare("SELECT * FROM products WHERE sku = ?").bind(m[1]).first(); if (!before) return json({ error: "No such product." }, 404);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Send the fields as JSON." }, 400);
    const out = {}, bad = [];
    if ("name" in body) { const v = text(body.name, 80); if (!v) bad.push("name (1 to 80 letters)"); else if (v !== before.name) out.name = v; }
    let colours = null;
    if ("colours" in body) { colours = cleanColours(body.colours); if (!colours) bad.push("colours (up to 16, each a name of up to 24 letters)"); }
    let price = null;
    if ("price_cents" in body) {
      price = Number.isInteger(body.price_cents) ? clampInt(body.price_cents, 1, 5000000) : null;
      if (price === null) bad.push("price (more than $0, up to $50,000, in cents)");
    }
    let count = null;
    if ("stock" in body) {
      const s = body.stock || {}, whole = v => Number.isInteger(v) ? clampInt(v, 0, 99999) : null;
      count = { counted: whole(s.counted), seen: whole(s.seen) };
      if (count.counted === null) bad.push("stock (a whole number, 0 to 99999)"); else if (count.seen === null) return json({ error: "Reload the item and count again." }, 400);
    }
    if (bad.length) return json({ error: "Check: " + bad.join(", ") + "." }, 400);
    if (price !== null && price !== before.price_cents && !session.owner) { log("forbidden", { actor, path, field: "price" }); return json({ error: NOT_YOURS }, 403); }
    if (price !== null && price !== before.price_cents) out.price_cents = price;
    let had = {}; try { had = JSON.parse(before.details || "{}") || {}; } catch {}
    if (colours) {
      const d = { ...had }; delete d.colours; delete d.colour_hex;
      const hex = Object.fromEntries(colours.filter(c => c.hex).map(c => [c.name, c.hex]));
      if (colours.length) { d.colours = colours.map(c => c.name); if (Object.keys(hex).length) d.colour_hex = hex; }
      // A hookah family's row is one colour of that hookah: its colours become its chip name ("Black and Gold"), unless the
      // shop already typed a name for it in the full form (that name is kept; only a name this editor wrote is replaced).
      if (String(before.family || "").startsWith("ace-")) {
        const ours = !had.colour || (Array.isArray(had.colours) && had.colour === joinColours(had.colours));
        if (ours) { if (colours.length) d.colour = joinColours(d.colours); else delete d.colour; }
        if (ours && colours.length && d.colour.length > 40) return json({ error: "Check: colours (a hookah colour's name is up to 40 letters; pick fewer)." }, 400);
      }
      if (JSON.stringify(d) !== JSON.stringify(had)) out.details = JSON.stringify(d);
    }
    if (out.details && (had.charcoal || String(before.family || "").startsWith("charcoal-"))) charcoalRules(out, JSON.parse(out.details));   // charcoal stays pickup or local only
    // A first price on an item on view with "Price TBD" puts it on sale, so it can be bought as soon as the shop has priced it.
    // Only an item that had no price (an item priced and switched off stays off), already on view: never a made-up sample,
    // an unticked catalogue page or a colour the supplier dropped.
    const ticked = !["ace", "ace-acc"].includes(before.supplier_id) || (() => { try { return (JSON.parse(before.facts_known || "{}") || {}).stamp !== "none"; } catch { return false; } })();
    if ("price_cents" in out && !(before.price_cents > 0) && before.active === 0 && before.listed === 1 && before.availability !== "dropped" && ticked && !isSample(before.sku)) out.active = 1;
    const cols = Object.keys(out);
    const was = {}; for (const k of cols) was[k] = before[k];
    const STALE = "An order changed this to %n while you were counting. Nothing was saved: check the shelf, then save again.";
    if (count && count.seen !== before.stock) return json({ error: STALE.replace("%n", before.stock), stock: before.stock, changed: true }, 409);
    const logged = { ...out }; if (logged.details) { logged.colours = colours.map(c => c.name); delete logged.details; }
    if (count) logged.stock = count.counted;
    if (!cols.length && !count) return json({ ok: true, changed: false, stock: before.stock });
    // One transaction. With a count, every statement holds only while the stock is still the number the screen showed, so an
    // order landing mid-save leaves the whole save unwritten (never half of it, never a log line for a count that did not happen).
    const seen = count ? count.seen : null, still = "(?9 IS NULL OR stock = ?9)";
    const stmts = [];
    if (cols.length) stmts.push(db.prepare(`UPDATE products SET ${cols.map((k, i) => `${k} = ?${i + 1}`).join(", ")}, updated_at = ${NOW} WHERE sku = ?8 AND ${still}`).bind(...cols.map(k => out[k]), ...Array(7 - cols.length).fill(null), m[1], seen));
    stmts.push(db.prepare(`INSERT INTO audit_log (actor, action, target, before, after) SELECT ?1, 'product.info', ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM products WHERE sku = ?2 AND (?5 IS NULL OR stock = ?5))`)
      .bind(actor, m[1], JSON.stringify(count ? { ...was, stock: before.stock } : was), JSON.stringify(logged), seen));
    let countAt = -1;
    if (count) {   // the shelf count, written as a count move like Count mode, and the item marked as counted
      countAt = stmts.length;
      stmts.push(db.prepare(`INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT sku, ?2 - stock, 'count', ?4, ?3 FROM products WHERE sku = ?1 AND stock = ?5`).bind(m[1], count.counted, actor, "counted " + count.counted, count.seen));
      stmts.push(db.prepare(`UPDATE products SET stock = ?2, availability = CASE WHEN availability = 'dropped' THEN availability ELSE 'counted' END, updated_at = ${NOW} WHERE sku = ?1 AND changes() = 1`).bind(m[1], count.counted));
    }
    stmts.push(db.prepare("SELECT stock, price_cents, active, availability FROM products WHERE sku = ?").bind(m[1]));
    let res;
    try { res = await db.batch(stmts); }
    catch (e) { if (/Set the shop price/.test(String(e && e.message))) return json({ error: "Set the shop price before turning this item on." }, 409); throw e; }
    const now = res.at(-1).results[0];
    if (count && !res[countAt].meta.changes) return json({ error: STALE.replace("%n", now.stock), stock: now.stock, changed: true }, 409);
    return json({ ok: true, changed: true, stock: now.stock, price_cents: now.price_cents, on_sale: now.active === 1 && now.price_cents > 0, counted: now.availability === "counted" });
  }
  // Stock changes. Each is one database transaction (a D1 batch): the move is written only if the count changed, the
  // count can never go below zero, and a tap's key (op) lets a repeated request count once and answer the same.
  const replayed = async op => { const r = await db.prepare("SELECT m.sku, p.stock FROM stock_moves m JOIN products p ON p.sku = m.sku WHERE m.op = ?").bind(op).first(); return r; };
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/(stock|receive)$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), receive = m[2] === "receive", op = cleanOp(body.op);
    const delta = !Number.isInteger(receive ? body.qty : body.delta) ? null : receive ? clampInt(body.qty, 1, 9999) : clampInt(body.delta, -9999, 9999);
    const reason = receive ? "received" : ["received", "damaged", "correction", "return"].includes(body.reason) ? body.reason : "correction";
    const ref = receive ? text(body.ref ?? "", 60) : null;
    if (!delta) return json({ error: receive ? "Enter how many arrived, 1 or more." : "Nothing to change." }, 400);
    if (ref === null && receive) return json({ error: "Keep the delivery note under 60 characters." }, 400);
    if (op) { const r = await replayed(op); if (r) return r.sku === m[1] ? json({ ok: true, stock: r.stock, replayed: true }) : json({ error: "That tap key was already used." }, 409); }
    const res = await db.batch([
      db.prepare(`UPDATE products SET stock = stock + ?1, updated_at = ${NOW} WHERE sku = ?2 AND stock + ?1 >= 0 AND (?3 IS NULL OR NOT EXISTS (SELECT 1 FROM stock_moves WHERE op = ?3))`).bind(delta, m[1], op),
      db.prepare("INSERT INTO stock_moves (sku, delta, reason, ref, actor, op) SELECT ?2, ?1, ?3, ?5, ?4, ?6 WHERE changes() = 1").bind(delta, m[1], reason, actor, ref || null, op),
      db.prepare("SELECT stock FROM products WHERE sku = ?").bind(m[1]),
    ]);
    if (!res[2].results.length) return json({ error: "No such product." }, 404);
    if (!res[0].meta.changes) { const r = op && await replayed(op); if (r) return r.sku === m[1] ? json({ ok: true, stock: r.stock, replayed: true }) : json({ error: "That tap key was already used." }, 409); return json({ error: "Stock cannot go below zero.", stock: res[2].results[0].stock }, 409); }
    return json({ ok: true, stock: res[2].results[0].stock });
  }
  // Count mode: the shelf count typed in. The server works out the difference and writes it as a "count" move, even
  // when nothing changed (a count that matched is worth knowing). If an order took stock since the screen was loaded
  // (seen no longer matches), nothing is saved and the new number is shown, so a sale is never counted away by mistake.
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/count$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), counted = clampInt(body.counted, 0, 99999), op = cleanOp(body.op);
    const whole = v => (Number.isInteger(v) || (typeof v === "string" && /^\d{1,5}$/.test(v.trim()))) ? clampInt(v, 0, 99999) : null;
    const seen = whole(body.seen);
    if (whole(body.counted) === null) return json({ error: "Type the number on the shelf, a whole number, 0 or more." }, 400);
    if (seen === null) return json({ error: "Reload the list and count again." }, 400);   // the number the screen showed is required: a count never overwrites a sale it did not see
    if (op) { const r = await replayed(op); if (r) return r.sku === m[1] ? json({ ok: true, stock: r.stock, replayed: true }) : json({ error: "That tap key was already used." }, 409); }
    const res = await db.batch([
      db.prepare(`INSERT INTO stock_moves (sku, delta, reason, ref, actor, op) SELECT sku, ?2 - stock, 'count', ?6, ?4, ?5 FROM products WHERE sku = ?1 AND (?3 IS NULL OR stock = ?3) AND (?5 IS NULL OR NOT EXISTS (SELECT 1 FROM stock_moves WHERE op = ?5))`).bind(m[1], counted, seen, actor, op, "counted " + counted),
      db.prepare(`UPDATE products SET stock = ?2, updated_at = ${NOW} WHERE sku = ?1 AND changes() = 1`).bind(m[1], counted),
      db.prepare("SELECT stock FROM products WHERE sku = ?").bind(m[1]),
      db.prepare("SELECT delta FROM stock_moves WHERE id = last_insert_rowid() AND sku = ?").bind(m[1]),
    ]);
    if (!res[2].results.length) return json({ error: "No such product." }, 404);
    if (!res[0].meta.changes) {
      const r = op && await replayed(op); if (r) return r.sku === m[1] ? json({ ok: true, stock: r.stock, replayed: true }) : json({ error: "That tap key was already used." }, 409);
      return json({ error: `An order changed this to ${res[2].results[0].stock} while you were counting. Check the shelf again.`, stock: res[2].results[0].stock, changed: true }, 409);
    }
    return json({ ok: true, stock: res[2].results[0].stock, delta: res[3].results[0]?.delta ?? null });
  }
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/history$/)) && method === "GET") {
    const [mv, au] = await db.batch([
      db.prepare("SELECT delta, reason, ref, actor, at FROM stock_moves WHERE sku = ? ORDER BY id DESC LIMIT 12").bind(m[1]),
      db.prepare("SELECT action, actor, before, after, at FROM audit_log WHERE target = ? ORDER BY id DESC LIMIT 8").bind(m[1]),
    ]);
    return json({ moves: mv.results, changes: au.results });
  }
  if ((m = path.match(/^\/products\/(OSS-\d{4,6})\/photo$/)) && method === "POST") {
    const type = (request.headers.get("Content-Type") || "").split(";")[0];
    if (!["image/webp", "image/jpeg", "image/png"].includes(type)) return json({ error: "Use a JPEG, PNG or WebP photo." }, 415);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength < 200 || bytes.byteLength > 600000) return json({ error: "That photo is too large after resizing." }, 413);
    const b = new Uint8Array(bytes.slice(0, 12)), isImg = (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57);
    if (!isImg) return json({ error: "That file is not a photo." }, 415);
    const ok = await db.prepare("SELECT sku FROM products WHERE sku = ?").bind(m[1]).first(); if (!ok) return json({ error: "No such product." }, 404);
    await db.batch([
      db.prepare("INSERT INTO product_photos (sku, type, bytes) VALUES (?,?,?) ON CONFLICT(sku) DO UPDATE SET type = excluded.type, bytes = excluded.bytes, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')").bind(m[1], type, bytes),
      db.prepare("UPDATE products SET photo_ver = photo_ver + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE sku = ?").bind(m[1]), audit("product.photo", m[1], null, { bytes: bytes.byteLength }),
    ]);
    return json({ ok: true });
  }

  if (path === "/orders" && method === "GET") {
    const list = nets => db.prepare(`SELECT o.id, o.status, o.method, o.name, o.total_cents, o.pay_method, o.pay_status, o.tax_province, o.ship_service, o.tracking, o.created_at, CASE WHEN o.status = 'ready' THEN COALESCE(o.ready_at, o.updated_at) END AS ready_at, o.source, (SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id) AS units, ${STOCKED("o")} AS stock_taken, (${TO_CONFIRM("o")}) AS to_confirm,
      ${nets ? OTHER_NETS("o") : "0"} AS other_networks, EXISTS (SELECT 1 FROM order_items i JOIN products p ON p.sku = i.sku WHERE i.order_id = o.id AND ${CHARCOAL_ITEM}) AS charcoal FROM orders o ORDER BY o.created_at DESC LIMIT 200`).all();
    const r = await list(true).catch(err => { if (noTable(err)) return list(false); throw err; });
    return json({ orders: r.results, mail_on: mailReady(env) });
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})$/)) && method === "GET") {
    const [o, i, mail, trail] = await db.batch([db.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]), db.prepare("SELECT i.sku, i.name, i.qty, i.unit_cents, p.img, p.img_dark, p.photo_ver, p.box_id, p.category_id, p.details FROM order_items i LEFT JOIN products p ON p.sku = i.sku WHERE i.order_id = ?").bind(m[1]),
      db.prepare(`SELECT id, kind, recipient, subject, status, at, ${await hasRetry(db) ? "tries, next_try_at," : "0 AS tries, NULL AS next_try_at,"} detail LIKE 'gave up%' AS gave_up FROM emails WHERE order_id = ? ORDER BY id`).bind(m[1]),
      db.prepare("SELECT action, actor, before, after, at FROM audit_log WHERE target = ? ORDER BY id").bind(m[1])]);
    if (!o.results.length) return json({ error: "No such order." }, 404);
    const { cancel_op, ...order } = o.results[0];
    const st = await db.prepare(`SELECT ${STOCKED("o")} AS stock_taken, (${TO_CONFIRM("o")}) AS to_confirm FROM orders o WHERE o.id = ?`).bind(m[1]).first();
    order.stock_taken = st.stock_taken; order.to_confirm = st.to_confirm;
    order.other_networks = await db.prepare(`SELECT ${OTHER_NETS("o")} AS n FROM orders o WHERE o.id = ?`).bind(m[1]).first("n").catch(err => { if (noTable(err)) return 0; throw err; });
    return json({ order, items: i.results, emails: mail.results, trail: trail.results, mail_on: mailReady(env) });
  }
  // Cancel and put the stock back. Exactly one request can win the change to "cancelled" (the row records that
  // request's own key), and only the winner's statements put stock back, all in one transaction. A second tap,
  // a retry or two people at once can never restock twice.
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/cancel$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), op = cleanOp(body.op) || crypto.randomUUID();
    const reason = ["no_show", "customer", "other"].includes(body.reason) ? body.reason : null, note = text(body.note ?? "", 200);
    if (!reason) return json({ error: "Pick why it is cancelled." }, 400);
    if (note === null) return json({ error: "Keep the note under 200 characters." }, 400);
    if (reason === "other" && !note) return json({ error: "Say why in a few words." }, 400);
    const o = await db.prepare("SELECT status, cancel_op, pay_status, pay_method FROM orders WHERE id = ?").bind(m[1]).first();
    if (!o) return json({ error: "No such order." }, 404);
    if (o.cancel_op && o.cancel_op === op) return json({ ok: true, status: "cancelled", replayed: true });
    // a pay-at-counter pickup is still "pending" (nothing paid): it can be cancelled too, which is the usual no-show
    if (!["paid", "packed", "ready"].includes(o.status) && !(o.status === "pending" && o.pay_status === "pay_at_pickup")) return json({ error: o.status === "cancelled" ? "This order is already cancelled." : "Only orders not yet sent or collected can be cancelled here." }, 409);
    // Part of a counter payment already given back at the till: a cancel would count the order as given back whole while
    // only that part is on the report, and a cancelled order takes no more till refunds. The rest is recorded as a till refund.
    const tillPart = "NOT (COALESCE(pay_method, '') = 'at_pickup' AND COALESCE(pay_status, '') = 'part_refunded')";
    if (o.pay_method === "at_pickup" && o.pay_status === "part_refunded") return json({ error: "Part of this order was already given back at the till. Record the rest as a counter refund instead of cancelling." }, 409);
    // Every statement asks the same question of the order as it was before this transaction: still open, never
    // cancelled. The order is flipped last. A retry, or a second tap, sees the flipped order and changes nothing.
    const open = `EXISTS (SELECT 1 FROM orders WHERE id = ?1 AND (status IN ('paid','packed','ready') OR (status = 'pending' AND pay_status = 'pay_at_pickup' AND release_op IS NULL)) AND cancel_op IS NULL AND ${tillPart})`;
    // A card order took its stock when it was placed, so it gets back what it ordered (unchanged). A pay-at-the-counter order takes
    // stock only when the shop marks it ready (2026-11-27), so it gets back exactly what its own stock moves show it took, once:
    // a request never confirmed gives back nothing, a ready order gives back what readying took.
    const back = o.pay_method === "at_pickup" ? TAKEN_SQL("?1") : "(SELECT sku, qty FROM order_items WHERE order_id = ?1)";
    const res = await db.batch([
      db.prepare(`UPDATE products SET stock = stock + (SELECT t.qty FROM ${back} t WHERE t.sku = products.sku), updated_at = ${NOW} WHERE sku IN (SELECT t.sku FROM ${back} t) AND ${open}`).bind(m[1]),
      db.prepare(`INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT t.sku, t.qty, 'released', ?1, ?2 FROM ${back} t WHERE ${open}`).bind(m[1], actor),
      db.prepare(`INSERT INTO audit_log (actor, action, target, before, after) SELECT ?2, 'order.cancel', ?1, ?3, ?4 WHERE ${open}`).bind(m[1], actor, JSON.stringify({ status: o.status }), JSON.stringify({ status: "cancelled", reason, ...(note ? { note } : {}) })),
      db.prepare(`UPDATE orders SET status = 'cancelled', cancelled_at = ${NOW}, cancelled_by = ?3, cancel_reason = ?4, cancel_note = ?5, cancel_op = ?2, updated_at = ${NOW} WHERE id = ?1 AND (status IN ('paid','packed','ready') OR (status = 'pending' AND pay_status = 'pay_at_pickup' AND release_op IS NULL)) AND cancel_op IS NULL AND ${tillPart}`).bind(m[1], op, actor, reason, note || null),
      db.prepare("SELECT status, cancel_op FROM orders WHERE id = ?1").bind(m[1]),
    ]);
    const now = res[4].results[0];
    if (!res[3].meta.changes) return now.cancel_op === op ? json({ ok: true, status: "cancelled", replayed: true }) : json({ error: now.status === "cancelled" ? "This order is already cancelled." : "This order changed. Reload it." }, 409);
    // a card payment is not given back by cancelling: the sheet keeps the refund button until it is refunded
    return json({ ok: true, status: "cancelled", restocked: res[1].meta.changes, refund_owed: o.pay_method === "card" && ["paid", "part_refunded"].includes(o.pay_status) });
  }
  // Staff-only: the ID tick on a charcoal order. Never part of anything a customer sees (order page, emails, catalogue).
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/id-check$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), on = body.checked === true;
    if (typeof body.checked !== "boolean") return json({ error: "Send checked: true or false." }, 400);
    const ok = await db.prepare(`SELECT o.id FROM orders o WHERE o.id = ? AND o.status IN ('paid','packed','ready','shipped','collected') AND EXISTS (SELECT 1 FROM order_items i JOIN products p ON p.sku = i.sku WHERE i.order_id = o.id AND ${CHARCOAL_ITEM})`).bind(m[1]).first();
    if (!ok) return json({ error: "Only open or finished charcoal orders have an ID check." }, 404);
    await db.batch([db.prepare(`UPDATE orders SET id_checked_by = ?, id_checked_at = ${on ? NOW : "NULL"} WHERE id = ?`).bind(on ? actor : null, m[1]), audit("order.id_check", m[1], null, { checked: on })]);
    return json({ ok: true, checked: on, by: on ? actor : null });
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/status$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), o = await db.prepare("SELECT status, method, pay_status FROM orders WHERE id = ?").bind(m[1]).first();
    if (!o) return json({ error: "No such order." }, 404);
    // a pay-at-counter pickup can be got ready before it is paid, but never handed over unpaid
    const next = { paid: o.method === "pickup" ? ["ready"] : ["packed"], packed: ["shipped"], ready: ["collected"], pending: o.pay_status === "pay_at_pickup" ? ["ready"] : [] }[o.status] || [];
    if (body.status === "collected" && o.pay_status === "pay_at_pickup") return json({ error: "Take the payment first, then mark it paid." }, 409);
    if (!next.includes(body.status)) return json({ error: "That step is not available for this order." }, 409);
    // A pickup request (pay at the counter, nothing taken yet) is confirmed here: marking it ready takes its stock (takeForReady).
    const confirming = o.status === "pending" && o.pay_status === "pay_at_pickup" && body.status === "ready";
    if (confirming) {
      const r = await takeForReady(db, m[1], actor);
      if (r.error) return r.error;
      if (r.took) { try { await lowNote(env, m[1], r.skus); } catch (e) { console.error(JSON.stringify({ at: "admin", problem: "low-stock note not written", message: String(e && e.message || e) })); } }
    } else {
      // only the request that actually moved the order writes the log line and the customer email (two taps, one email)
      const moved = await db.batch([db.prepare(`UPDATE orders SET status = ?, updated_at = ${NOW}${body.status === "ready" ? `, ready_at = ${NOW}` : ""} WHERE id = ? AND status = ?`).bind(body.status, m[1], o.status),
        db.prepare("INSERT INTO audit_log (actor, action, target, before, after) SELECT ?, 'order.status', ?, ?, ? WHERE changes() = 1").bind(actor, m[1], JSON.stringify({ status: o.status }), JSON.stringify({ status: body.status }))]);
      if (!moved[0].meta.changes) return json({ error: "Someone else just changed this order. Reload it." }, 409);
    }
    let call = null;
    if (body.status === "shipped" || body.status === "ready") {
      const [full, items] = await db.batch([db.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]), db.prepare("SELECT name, qty, unit_cents FROM order_items WHERE order_id = ?").bind(m[1])]);
      const site = env.SITE_NAME || "One Stop Shop", ord = full.results[0];
      await writeEmail(env, m[1], ord.email, (body.status === "shipped" ? orderShipped : pickupReady)(site, ord, items.results));
      // with the mail service not connected the email above is only kept: staff are told to call or text the customer instead
      if (!mailReady(env) && body.status === "ready") call = { phone: ord.phone || null };
    }
    return json({ ok: true, status: body.status, ...(call ? { call } : {}) });
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/(refund|paid|counter-refund)$/)) && method === "POST") {   // src/pay.js
    if (m[2] !== "paid" && !session.owner) { log("forbidden", { actor, path }); return json({ error: m[2] === "refund" ? "Only the owner can refund to a card." : "Only the owner can record a refund." }, 403); }   // money back is the owner's call; staff take counter payments
    return adminPay(request, env, m[1], m[2], actor);
  }
  if ((m = path.match(/^\/orders\/([A-Z0-9]{3,12})\/refunds$/)) && method === "GET") return json({ refunds: (await db.prepare("SELECT amount_cents, status, reason, actor, detail, at FROM refunds WHERE order_id = ? ORDER BY id").bind(m[1]).all()).results });
  if ((m = path.match(/^\/emails\/(\d{1,9})$/)) && method === "GET") {
    // only order and stock emails open here: a customer's sign-in code (and their account mail) is theirs, never the back office's
    const e = await db.prepare(`SELECT id, kind, recipient, subject, html, status, detail, at, ${await hasRetry(db) ? "tries, next_try_at" : "0 AS tries, NULL AS next_try_at"} FROM emails WHERE id = ? AND kind IN ('order_placed','order_shipped','pickup_ready','low_stock','new_order')`).bind(+m[1]).first();
    return e ? json({ email: e }) : json({ error: "No such email." }, 404);
  }
  // Send again, by hand, an order email that gave up after a day of tries (owner only; src/email.js resendEmail). Logged.
  if ((m = path.match(/^\/emails\/(\d{1,9})\/resend$/)) && method === "POST") {
    if (!session.owner) { log("forbidden", { actor, path }); return json({ error: "Only the owner can send an email again." }, 403); }
    const r = await resendEmail(env, +m[1]), e = await db.prepare("SELECT order_id, status FROM emails WHERE id = ?").bind(+m[1]).first();
    if (e && r.status !== 404) await audit("email.resend", e.order_id || String(m[1]), null, { email: +m[1], sent: !!r.ok, ...(r.ok ? {} : { why: r.error }) }).run();
    return r.ok ? json({ ok: true, email: r.email }) : json({ error: r.error }, r.status);
  }
  // ---- owner only: staff, settings, the monthly report ----
  if (path === "/staff" && method === "GET") {
    const r = await db.prepare(`SELECT st.id, st.name, st.created_at, st.created_by, (SELECT MAX(at) FROM login_attempts a WHERE a.staff_id = st.id AND a.ok = 1) AS last_in FROM staff st WHERE st.active = 1 ORDER BY lower(st.name)`).all();
    return json({ staff: r.results });
  }
  // Every PIN is hashed with the PIN_PEPPER secret (src/staff.js). A PIN set before the pepper exists would be hashed with the
  // fallback and stop working the moment the pepper is created, so on the live site no PIN is set until it exists.
  if (env.LIVE === "1" && !env.PIN_PEPPER && method === "POST" && (path === "/staff" || /^\/staff\/\d{1,9}\/pin$/.test(path))) return json({ error: "Create the PIN_PEPPER secret first (docs/BACKEND-NOTES.md), then add staff." }, 503);
  if (path === "/staff" && method === "POST") {
    const body = await request.json().catch(() => ({})), name = cleanName(body.name), bad = pinProblem(body.pin);
    if (!name) return json({ error: "Give a first name, letters only, up to 30.", field: "name" }, 400);
    if (bad) return json({ error: bad, field: "pin" }, 400);
    if (await db.prepare("SELECT 1 AS x FROM staff WHERE lower(name) = lower(?) AND active = 1").bind(name).first("x")) return json({ error: `There is already a ${name}. Add a last initial.`, field: "name" }, 409);
    const hash = await hashPin(env, body.pin);
    try {
      const r = await db.batch([db.prepare("INSERT INTO staff (name, pin_hash, created_by) VALUES (?, ?, ?)").bind(name, hash, actor), db.prepare("INSERT INTO audit_log (actor, action, target, after) VALUES (?, 'staff.add', 'staff #' || last_insert_rowid(), ?)").bind(actor, JSON.stringify({ name }))]);
      return json({ ok: true, id: r[0].meta.last_row_id, name }, 201);
    } catch (e) { if (/UNIQUE/i.test(String(e && e.message))) return json({ error: `There is already a ${name}. Add a last initial.`, field: "name" }, 409); throw e; }
  }
  if ((m = path.match(/^\/staff\/(\d{1,9})$/)) && method === "DELETE") {
    const st = await db.prepare("SELECT id, name FROM staff WHERE id = ? AND active = 1").bind(+m[1]).first();
    if (!st) return json({ error: "No such person." }, 404);
    // removed at once: the row stays (history names them), every sign-in they had ends now
    await db.batch([db.prepare(`UPDATE staff SET active = 0, removed_at = ${NOW} WHERE id = ?`).bind(st.id), db.prepare("DELETE FROM sessions WHERE staff_id = ?").bind(st.id),
      audit("staff.remove", `staff #${st.id}`, { name: st.name }, null)]);
    return json({ ok: true });
  }
  if ((m = path.match(/^\/staff\/(\d{1,9})\/pin$/)) && method === "POST") {
    const body = await request.json().catch(() => ({})), bad = pinProblem(body.pin);
    if (bad) return json({ error: bad, field: "pin" }, 400);
    const st = await db.prepare("SELECT id, name FROM staff WHERE id = ? AND active = 1").bind(+m[1]).first();
    if (!st) return json({ error: "No such person." }, 404);
    await db.batch([db.prepare("UPDATE staff SET pin_hash = ? WHERE id = ?").bind(await hashPin(env, body.pin), st.id), db.prepare("DELETE FROM sessions WHERE staff_id = ?").bind(st.id), audit("staff.pin", `staff #${st.id}`, null, { name: st.name })]);
    return json({ ok: true });
  }
  if (path === "/settings" && method === "GET") return json({ settings: Object.fromEntries((await db.prepare("SELECT key, value FROM settings").all()).results.map(r => [r.key, r.value])) });
  if (path === "/settings" && method === "PUT") {
    const body = await request.json().catch(() => ({}));
    if (!["subtotal", "total"].includes(body.studio_share_basis)) return json({ error: "Pick what the studio share is worked out on." }, 400);
    const was = await db.prepare("SELECT value FROM settings WHERE key = 'studio_share_basis'").first("value");
    await db.batch([db.prepare(`INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('studio_share_basis', ?1, ?2, ${NOW}) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_by = ?2, updated_at = ${NOW}`).bind(body.studio_share_basis, actor),
      audit("settings.studio_share_basis", "settings", { value: was }, { value: body.studio_share_basis })]);
    return json({ ok: true });
  }
  if (path === "/report" && method === "GET") {
    const mo = monthOf(url.searchParams.get("month")); if (!mo) return json({ error: "Month looks like 2026-11." }, 400);
    return json(await report(db, mo));
  }
  if (path === "/report.csv" && method === "GET") {
    const mo = monthOf(url.searchParams.get("month")); if (!mo) return json({ error: "Month looks like 2026-11." }, 400);
    return new Response(reportCsv(await report(db, mo, true)), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="one-stop-shop-sales-${mo}.csv"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  // the shop's questionnaire answers (public/intake.js): the owner reads the list of sends, or one send by its key
  if (path === "/intake" && method === "GET") {
    if (!session.owner) return json({ error: "Only the owner can read the shop's answers." }, 403);
    // Every send is its own dated file. A fixed "intake/latest.json" is never read or listed: before 2026-11-26 the public link
    // could overwrite it, so it is not trusted. Asking for that name gets the newest dated send instead.
    const sends = []; let cursor;
    // each send carries the short tag of the place it came from (a keyed hash, worker.js intakeSave) and its country, so a send from
    // somewhere new stands out; "from_n" counts the sends from that same place. Older sends (before 2026-11-27) have no tag.
    do { const l = await env.BACKUPS.list({ prefix: "intake/", cursor, limit: 1000, include: ["customMetadata"] }); for (const o of l.objects) if (o.key !== "intake/latest.json") sends.push({ key: o.key, size: o.size, at: o.uploaded, from: /^[0-9a-f]{8}$/.test(o.customMetadata?.from || "") ? o.customMetadata.from : null, country: /^[A-Z]{2}$/.test(o.customMetadata?.country || "") ? o.customMetadata.country : null, ...(o.customMetadata?.shop === "1" ? { shop: true } : {}) }); cursor = l.truncated ? l.cursor : undefined; } while (cursor && sends.length < 5000);
    sends.sort((a, b) => b.key.localeCompare(a.key));
    { const n = {}; for (const s of sends) if (s.from) n[s.from] = (n[s.from] || 0) + 1; for (const s of sends) s.from_n = s.from ? n[s.from] : null; }
    let key = url.searchParams.get("key");
    if (key === "intake/latest.json") { if (!sends.length) return json({ error: "No such send." }, 404); key = sends[0].key; }
    if (key) {
      if (!/^intake\/[\w.-]+\.json$/.test(key)) return json({ error: "No such send." }, 400);
      const o = await env.BACKUPS.get(key); if (!o) return json({ error: "No such send." }, 404);
      return new Response(o.body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    // the page reads the newest send by the name "intake/latest.json" (public/admin.js), so that name leads the list
    return json({ sends: sends.length ? [{ key: "intake/latest.json", size: sends[0].size, at: sends[0].at, newest: sends[0].key, from: sends[0].from, country: sends[0].country, from_n: sends[0].from_n }, ...sends] : [] });
  }
  // The owner removes questionnaire sends (breaker, 2026-11-27: the link stops taking sends at 300 kept, and nothing could delete one).
  // Only a dated send under intake/ (never a nightly backup, never the old fixed name), only the owner, and it is logged.
  if (path === "/intake" && method === "DELETE") {
    if (!session.owner) { log("forbidden", { actor, path }); return json({ error: "Only the owner can remove the shop's answers." }, 403); }
    const body = await request.json().catch(() => ({})), key = typeof body.key === "string" ? body.key : "";
    if (!/^intake\/[\w.-]+\.json$/.test(key) || key === "intake/latest.json" || key.includes("..")) return json({ error: "No such send." }, 400);
    if (!(await env.BACKUPS.head(key))) return json({ error: "No such send." }, 404);
    await env.BACKUPS.delete(key);
    await audit("intake.delete", key, null, { key }).run();
    return json({ ok: true });
  }
  if (path === "/backup" && method === "GET") {
    const snap = await snapshot(db);
    return new Response(JSON.stringify(snap, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="one-stop-shop-backup-${snap.taken_at.slice(0, 10)}.json"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  return json({ error: "Not found" }, 404);
}

// Confirming a pickup request (2026-11-27): staff checked the shelf and mark it ready. One D1 batch (one transaction):
//  1 the order moves pending -> ready only if it is still an open pickup request AND every item it has not taken yet is covered
//    by the stock count now (an item an order placed before 2026-11-27 already took needs nothing more);
//  2 the log line, only if 1 moved it;
//  3 per item, the stock comes down and a 'sale' move is written, only while the order is ready, the count still covers it, and
//    this order has no sale of that item yet. Nothing else runs inside the transaction, so 1 covering every item means every 3
//    goes through; a second tap finds the order ready and the sale written, and changes nothing.
// If the count cannot cover it, nothing moves and staff are told which items are short, to call the customer.
async function takeForReady(db, id, actor) {
  const items = (await db.prepare("SELECT i.sku, i.name, i.qty, EXISTS (SELECT 1 FROM stock_moves m WHERE m.ref = i.order_id AND m.sku = i.sku AND m.reason = 'sale') AS had FROM order_items i WHERE i.order_id = ? ORDER BY i.sku").bind(id).all()).results;
  const need = items.filter(i => !i.had);
  const short = `EXISTS (SELECT 1 FROM order_items i LEFT JOIN products p ON p.sku = i.sku WHERE i.order_id = ?1 AND COALESCE(p.stock, 0) < i.qty AND NOT EXISTS (SELECT 1 FROM stock_moves m WHERE m.ref = ?1 AND m.sku = i.sku AND m.reason = 'sale'))`;
  const res = await db.batch([
    db.prepare(`UPDATE orders SET status = 'ready', ready_at = ${NOW}, updated_at = ${NOW} WHERE id = ?1 AND status = 'pending' AND pay_status = 'pay_at_pickup' AND release_op IS NULL AND cancel_op IS NULL AND NOT ${short}`).bind(id),
    db.prepare("INSERT INTO audit_log (actor, action, target, before, after) SELECT ?, 'order.status', ?, ?, ? WHERE changes() = 1").bind(actor, id, JSON.stringify({ status: "pending" }), JSON.stringify({ status: "ready", stock_taken: need.map(i => ({ sku: i.sku, qty: i.qty })) })),
    ...need.flatMap(i => [
      db.prepare(`UPDATE products SET stock = stock - ?1, updated_at = ${NOW} WHERE sku = ?2 AND stock >= ?1 AND EXISTS (SELECT 1 FROM orders WHERE id = ?3 AND status = 'ready' AND release_op IS NULL AND cancel_op IS NULL) AND NOT EXISTS (SELECT 1 FROM stock_moves WHERE ref = ?3 AND sku = ?2 AND reason = 'sale')`).bind(i.qty, i.sku, id),
      db.prepare("INSERT INTO stock_moves (sku, delta, reason, ref, actor) SELECT ?2, -?1, 'sale', ?3, ?4 WHERE changes() = 1").bind(i.qty, i.sku, id, actor),
    ]),
  ]);
  if (res[0].meta.changes) return { took: need.length > 0, skus: need.map(i => i.sku) };
  const now = await db.prepare("SELECT status, pay_status, release_op, cancel_op FROM orders WHERE id = ?").bind(id).first();
  if (!now || now.status !== "pending" || now.pay_status !== "pay_at_pickup" || now.release_op || now.cancel_op) return { error: json({ error: "Someone else just changed this order. Reload it." }, 409) };
  const shelf = (await db.prepare("SELECT i.sku, i.name, i.qty, COALESCE(p.stock, 0) AS stock FROM order_items i LEFT JOIN products p ON p.sku = i.sku WHERE i.order_id = ? ORDER BY i.sku").bind(id).all()).results;
  const gap = shelf.filter(i => need.some(n => n.sku === i.sku) && i.stock < i.qty);
  return { error: json({ error: `The stock count does not cover this order: ${gap.map(i => `${i.name} (needs ${i.qty}, ${i.stock} on the count)`).join("; ") || "an item changed meanwhile"}. Nothing was taken. Check the shelf: if it really is short, call the customer.`, shortfall: gap.map(i => ({ sku: i.sku, name: i.name, need: i.qty, stock: i.stock })) }, 409) };
}

// Uploaded product photo, public (it is shown on the storefront).
export async function photo(env, sku) {
  const r = await env.DB.prepare("SELECT type, bytes FROM product_photos WHERE sku = ?").bind(sku).first();
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(r.bytes instanceof ArrayBuffer ? r.bytes : new Uint8Array(r.bytes), { headers: { "Content-Type": r.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
