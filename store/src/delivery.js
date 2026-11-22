// Local delivery: road distance from the shop to the shopper's full address, worked out on the server.
// The price comes only from deliveryFee() in rates-core.js. If the address cannot be confirmed, or the map service
// is down, delivery is simply not offered: shipping and pickup keep working.
import { deliveryFee, localArea, parsePostal } from "../public/rates-core.js";

// 760 Wyandotte St E, Windsor, ON N9A 3J4: the map pin, fixed here so one bad lookup can never move the shop.
const SHOP = { lat: 42.3179407, lon: -83.0263116 };
const PLACES = new Set(["building", "amenity", "street"]);
// Neighbourhoods and hamlets people write as their town, against the name the map files them under.
const ALSO = { windsor: ["riverside", "walkerville", "sandwich", "forestglade", "fontainebleau", "southwindsor", "eastwindsor"], lakeshore: ["belleriver", "stoneycreek", "emeryville", "puce", "pointeauxroches", "ruscom", "comber"], tecumseh: ["stclairbeach", "oldcastle", "maidstone", "sttarcisius"], essex: ["harrow", "colchester", "mcgregor"], amherstburg: ["malden", "anderdon"], lasalle: ["lasalle"] };
const WAIT = 5000, KEEP = 7 * 24 * 3600;

const base = env => (env.GEOAPIFY_BASE || "https://api.geoapify.com").replace(/\/+$/, "");
const same = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function ask(env, path, params) {
  const u = new URL(base(env) + path);
  for (const [k, v] of Object.entries({ ...params, format: "json", apiKey: env.GEOAPIFY_KEY })) u.searchParams.set(k, v);
  const r = await fetch(u, { signal: AbortSignal.timeout(WAIT) });
  if (!r.ok) throw new Error("map service answered " + r.status);
  return r.json();
}
const locate = async (env, text) => (await ask(env, "/v1/geocode/search", { text, filter: "countrycode:ca", limit: "1" })).results?.[0] || null;

// The street has to be a real place in Ontario and agree with the postal code the shopper typed.
export function trustworthy(hit, dest, city) {
  if (!hit || hit.country_code !== "ca" || hit.state_code !== "ON" || !PLACES.has(hit.result_type)) return false;
  if (!(Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) || (hit.rank?.confidence_street_level ?? 0) < 0.7) return false;
  return agrees(hit, dest, city);
}
// Same province, same postal area, same town. Anything that contradicts the shopper's postal code or town is never priced.
function agrees(hit, dest, city) {
  if (!hit || hit.country_code !== "ca" || hit.state_code !== "ON") return false;
  if (hit.postcode && same(hit.postcode).slice(0, 3) !== same(dest.fsa)) return false;
  return cityMatch(hit, city);
}
function cityMatch(hit, city) {
  const typed = same(city), names = [hit.city, hit.town, hit.village, hit.hamlet, hit.suburb, hit.district].filter(Boolean).map(same);
  return names.includes(typed) || names.some(n => (ALSO[n] || []).includes(typed));
}
// The number the shopper typed, allowing "2-345 Main" and "Unit 4, 345 Main".
export function houseNumber(line1) {
  const m = String(line1).trim().match(/^(?:(?:unit|apt|suite|#)\s*[\w-]+[,\s]+|\w+-)?(\d+[a-z]?)(?=[\s,]|$)/i);
  return m ? m[1].toLowerCase() : null;
}

// From the postal code alone: only a match on the whole code is trusted, because the first three characters can cover a whole county.
async function measurePostal(env, dest) {
  const hit = (await ask(env, "/v1/geocode/search", { text: `${dest.full}, Ontario, Canada`, type: "postcode", filter: "countrycode:ca", limit: "1" })).results?.[0];
  if (!hit || hit.country_code !== "ca" || hit.state_code !== "ON" || same(hit.postcode) !== same(dest.full) || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) return { status: "address" };
  const d = (await ask(env, "/v1/routing", { waypoints: `${SHOP.lat},${SHOP.lon}|${hit.lat},${hit.lon}`, mode: "drive" })).results?.[0]?.distance;
  return Number.isFinite(d) && d >= 0 ? { metres: d, hit } : { status: "address" };
}
async function measure(env, line1, city, dest) {
  const number = houseNumber(line1);
  const hit = await locate(env, `${line1}, ${city}, ON ${dest.full}, Canada`);
  if (!number) return { status: "unsure" };
  // A street or house number the map has not recorded is normal. If nothing contradicts the postal code, the postal code prices it.
  if (!hit) return { status: "unsure", soft: true };
  if (!trustworthy(hit, dest, city)) return agrees(hit, dest, city) ? { status: "unsure", soft: true, seen: PLACES.has(hit.result_type) ? hit : null } : { status: "unsure" };
  const road = async (lat, lon) => { const d = (await ask(env, "/v1/routing", { waypoints: `${SHOP.lat},${SHOP.lon}|${lat},${lon}`, mode: "drive" })).results?.[0]?.distance; return Number.isFinite(d) && d >= 0 ? d : null; };
  if (hit.housenumber) {
    if (same(hit.housenumber) !== same(number)) return { status: "unsure", soft: true, seen: hit };
    const metres = await road(hit.lat, hit.lon);
    return metres === null ? { status: "unsure" } : { metres };
  }
  // Only the street is known, not the house: price it only if both ends of the street land on the same fee.
  const b = hit.bbox; if (!b || ![b.lat1, b.lon1, b.lat2, b.lon2].every(Number.isFinite)) return { status: "unsure", soft: true, seen: hit };
  const [one, two] = await Promise.all([road(b.lat1, b.lon1), road(b.lat2, b.lon2)]);
  if (one === null || two === null || deliveryFee(one) !== deliveryFee(two)) return { status: "unsure", soft: true, seen: hit };
  return { metres: Math.max(one, two) };
}
const priced = (metres, confirm = false) => { const fee = deliveryFee(metres); return fee === null ? { status: "far", metres } : { status: "ok", fee_cents: fee, metres, ...(confirm ? { confirm: true } : {}) }; };
// straight-line metres between two map points
function apart(a, b) { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) * r / 2), y = (b.lat - a.lat) * r; return 6371000 * Math.hypot(x, y); }
const NEAR_POSTAL = 3000;

// A repeat of the same address is answered from the edge cache. The key is a hash, so no address is stored in it.
async function cacheKey(line1, city, full) {
  const raw = new TextEncoder().encode(JSON.stringify([line1, city, full].map(s => String(s).trim().toLowerCase().replace(/\s+/g, " "))));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))].map(b => b.toString(16).padStart(2, "0")).join("");
  return new Request("https://delivery.cache/v2/" + hash);
}

export async function deliveryQuote(env, { line1, city, postal }, ip = "local") {
  const dest = parsePostal(postal);
  const byPostal = !line1 && !city;
  if (dest && dest.prov !== "ON" || dest && !localArea(dest)) return { status: "far" };
  if (!dest || !dest.complete || (!byPostal && (!line1 || !city))) return { status: "unsure" };
  if (!env.GEOAPIFY_KEY) return { status: "down" };
  let key = null;
  try { key = await cacheKey(line1 || "", city || "", dest.full); const c = await caches.default.match(key); if (c) { const k = await c.json(); if (Number.isFinite(k.metres)) return priced(k.metres, k.confirm); } } catch { key = null; }
  if (tooFast(ip)) return { status: "down" };   // only real map lookups count, so a repeat of a checked address is never held up
  let out;
  try {
    out = await (byPostal ? measurePostal(env, dest) : measure(env, line1, city, dest));
    if (out.soft) {   // the map placed this street somewhere: it must be beside the postal code, or it is not priced from it
      const p = await measurePostal(env, dest), close = !out.seen || (Number.isFinite(p.hit?.lat) && apart(out.seen, p.hit) <= NEAR_POSTAL);
      out = Number.isFinite(p.metres) && cityMatch(p.hit, city) && close ? { metres: p.metres, confirm: true } : { status: "unsure" };
    }
    if (Number.isFinite(out.metres)) out = priced(out.metres, out.confirm);
  }
  catch (e) { console.error(JSON.stringify({ at: "delivery", message: String(e && e.message || e).replace(/apiKey=[^&\s]+/g, "apiKey=hidden").slice(0, 160) })); return { status: "down" }; }
  if (key && Number.isFinite(out.metres)) { try { await caches.default.put(key, new Response(JSON.stringify({ metres: out.metres, confirm: !!out.confirm }), { headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${KEEP}` } })); } catch {} }
  return out;
}

// A brake on one visitor burning the day's free lookups. Per Worker instance, so it is a speed bump and not a wall.
const seen = new Map();
function tooFast(ip) {
  const now = Date.now(), list = (seen.get(ip) || []).filter(t => now - t < 60000);
  if (seen.size > 500) seen.clear();
  if (list.length >= 15) { seen.set(ip, list); return true; }
  list.push(now); seen.set(ip, list); return false;
}

export async function deliveryRoute(request, env, url) {
  const send = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  if (request.method !== "POST") return send({ error: "Method not allowed" }, 405);
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return send({ error: "Send JSON." }, 415);
  const origin = request.headers.get("Origin"); if (origin && origin !== url.origin) return send({ error: "Wrong origin." }, 403);
  const b = await request.json().catch(() => null);
  const clean = (v, max) => typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;
  const q = await deliveryQuote(env, { line1: clean(b && b.line1, 120), city: clean(b && b.city, 60), postal: b && b.postal }, request.headers.get("CF-Connecting-IP") || "local");
  return send(q.status === "ok" ? { status: "ok", fee_cents: q.fee_cents } : { status: q.status });
}
