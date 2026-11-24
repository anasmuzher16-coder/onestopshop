// Where an order came from, cleaned before it is stored. Only short codes and a site name are kept: never a full
// address with its query string (those can carry personal details), never anything that follows a person around.
// The shopper's browser keeps the first visit's codes for 30 days and sends them with the order (public/source.js).
const code = v => typeof v === "string" && /^[a-z0-9][a-z0-9._-]{0,39}$/i.test(v.trim()) ? v.trim().toLowerCase() : null;
const host = v => { if (typeof v !== "string" || v.length > 300) return null; try { const u = new URL(v); const h = u.hostname.toLowerCase().replace(/^www\./, ""); return /^https?:$/.test(u.protocol) && /^[a-z0-9.-]{1,80}$/.test(h) ? h : null; } catch { return null; } };
const path = v => typeof v === "string" && /^\/[A-Za-z0-9/_.-]{0,80}$/.test(v) ? v : null;
// Sites that send people, named the way the shop would say them.
const KNOWN = [[/(^|\.)google\./, "google"], [/(^|\.)bing\.com$/, "bing"], [/(^|\.)instagram\.com$/, "instagram"], [/(^|\.)(facebook\.com|fb\.com|m\.facebook\.com|l\.facebook\.com)$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"], [/(^|\.)duckduckgo\.com$/, "duckduckgo"], [/(^|\.)yahoo\./, "yahoo"], [/(^|\.)maps\.apple\.com$/, "apple maps"]];

export function cleanSource(raw, shopHost) {
  const r = raw && typeof raw === "object" ? raw : {};
  const d = { src: code(r.src), utm_source: code(r.utm_source), utm_medium: code(r.utm_medium), utm_campaign: code(r.utm_campaign), ref_host: host(r.referrer), landing: path(r.landing) };
  if (d.ref_host && shopHost && d.ref_host === shopHost.replace(/^www\./, "")) d.ref_host = null;   // our own pages are not a source
  const fromRef = d.ref_host ? (KNOWN.find(([re]) => re.test(d.ref_host)) || [null, d.ref_host])[1] : null;
  const source = d.src || d.utm_source || fromRef || (raw && typeof raw === "object" ? "direct" : null);
  const detail = Object.fromEntries(Object.entries(d).filter(([, v]) => v));
  return { source, detail: JSON.stringify(detail) };
}
