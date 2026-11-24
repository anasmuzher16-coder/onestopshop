// Where this visit came from, kept on this device only and sent with an order. First visit wins for 30 days.
// Kept: the ?src= code (the business card's QR code is ?src=card), utm_source, utm_medium and utm_campaign, the
// referring site's name (not the full address) and the first page opened. No cookie, nothing sent anywhere else.
const KEY = "oss:visit-source", DAYS = 30;
const tidy = v => v && /^[a-z0-9][a-z0-9._-]{0,39}$/i.test(v) ? v.toLowerCase() : undefined;
function read() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && Date.now() - v.at < DAYS * 864e5 ? v : null; } catch { return null; } }
try {
  if (!read()) {
    const q = new URLSearchParams(location.search), ref = document.referrer && new URL(document.referrer);
    const v = { at: Date.now(), src: tidy(q.get("src")), utm_source: tidy(q.get("utm_source")), utm_medium: tidy(q.get("utm_medium")), utm_campaign: tidy(q.get("utm_campaign")),
      referrer: ref && ref.host !== location.host ? ref.origin : undefined, landing: location.pathname.slice(0, 80) };
    localStorage.setItem(KEY, JSON.stringify(v));
  }
} catch {}
export function visitSource() { const v = read(); if (!v) return { landing: location.pathname.slice(0, 80) }; const { at, ...rest } = v; return rest; }
