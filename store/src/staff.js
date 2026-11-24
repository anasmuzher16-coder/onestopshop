// Staff PINs and secret comparison. A PIN is short, so it is protected three ways (OWASP Password Storage and
// Authentication cheat sheets): a server-side pepper (a Worker secret, never in the database, so a stolen database
// alone cannot be guessed offline), a per-PIN random salt, and PBKDF2-HMAC-SHA256 at the most iterations Workers
// allows (100,000: workerd refuses more, cloudflare/workerd#1346). Online guessing is stopped by the lockout in admin.js.
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const unhex = s => new Uint8Array((s.match(/../g) || []).map(h => parseInt(h, 16)));
export const MAX_ITER = 100000;
// The rounds new PINs are hashed with: one constant, overridable by the PIN_ROUNDS var (10,000 to 100,000). Each stored
// hash carries its own rounds ("pbkdf2-sha256$<rounds>$..."), so changing this later never breaks a PIN already set;
// a PIN picks up the new count the next time it is set. 100,000 is about 100 ms of CPU; see docs/BACKEND-NOTES.md.
export const PIN_ROUNDS_DEFAULT = MAX_ITER;
const iterations = env => { const n = parseInt(env.PIN_ROUNDS || env.PIN_ITERATIONS || "", 10); return n >= 10000 && n <= MAX_ITER ? n : PIN_ROUNDS_DEFAULT; };
const pepper = env => env.PIN_PEPPER || env.ADMIN_KEY || "";

// Same-length digests compared in constant time, so neither the length nor the first wrong byte leaks.
export async function sameSecret(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(String(a))), crypto.subtle.digest("SHA-256", enc.encode(String(b)))]);
  return crypto.subtle.timingSafeEqual(x, y);
}
async function derive(env, pin, salt, iter) {
  const pk = await crypto.subtle.importKey("raw", enc.encode(pepper(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const peppered = await crypto.subtle.sign("HMAC", pk, enc.encode(pin));
  const key = await crypto.subtle.importKey("raw", peppered, "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
}
export async function hashPin(env, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iter = iterations(env);
  return `pbkdf2-sha256$${iter}$${hex(salt)}$${hex(await derive(env, pin, salt, iter))}`;
}
// A stored hash that is missing or malformed still costs the same work, so a wrong name and a wrong PIN take as long.
// The stand-in uses the same iteration count new PINs get, so a missing name costs the same as a real one.
export async function checkPin(env, pin, stored) {
  const dummy = `pbkdf2-sha256$${iterations(env)}$${"0".repeat(32)}$${"0".repeat(64)}`;
  const [alg, it, salt, want] = String(stored || dummy).split("$"), iter = +it;
  const ok = !!stored && alg === "pbkdf2-sha256" && iter >= 1000 && iter <= MAX_ITER && /^[0-9a-f]{32}$/.test(salt) && /^[0-9a-f]{64}$/.test(want);
  const [, dIt, dSalt, dWant] = dummy.split("$");
  const got = await derive(env, String(pin), unhex(ok ? salt : dSalt), ok ? iter : +dIt);
  const match = crypto.subtle.timingSafeEqual(got, unhex(ok ? want : dWant).buffer);
  return ok && match;
}
// Six digits, and not one of the PINs everyone tries first.
export function pinProblem(pin) {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) return "A PIN is exactly 6 digits.";
  if (/^(\d)\1{5}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin) || ["123123", "121212", "112233", "696969", "007007"].includes(pin)) return "That PIN is too easy to guess. Pick another.";
  return null;
}
export const cleanName = v => typeof v === "string" && /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,29}$/u.test(v.trim()) ? v.trim().replace(/\s+/g, " ") : null;
