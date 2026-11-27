// The band at the top of a shop section: its jewel colour (the section's tone), its name and the counted line under it.
// The Worker writes it into the HTML (src/seo.js) so a cold load paints it at once, and the page draws the same markup
// (app.js viewShop) and keeps the server's node when the two match, so nothing pops or moves when the page takes over.
// One function for both, so the two can never drift. Works on the storefront products (src/catalog.js toStorefront).
import { SHOP_HOURS } from "./rates-core.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const h12 = h => (h % 12 || 12) + (h < 12 ? " am" : " pm");
// one formatter, made once: building an Intl.DateTimeFormat is slow, and the home page asks for the time once per row of its hours table, inside the wave's swap
let WINDSOR = null;
export function nowInWindsor() {
  WINDSOR ||= new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "long", hour: "numeric", minute: "numeric", hour12: false });
  const parts = Object.fromEntries(WINDSOR.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: DAYS.indexOf(parts.weekday), t: (+parts.hour % 24) + +parts.minute / 60 };
}
export function openLine() {
  const { day, t } = nowInWindsor(), [o, c] = SHOP_HOURS[day], next = SHOP_HOURS[(day + 1) % 7];
  return t >= o && t < c ? `Open now until ${h12(c)}` : t < o ? `Opens today at ${h12(o)}` : `Closed now. Opens ${DAYS[(day + 1) % 7]} at ${h12(next[0])}`;
}
// the band line of a coming-soon page says what to do, not the hours (those are in the visit block and the footer; design
// review, 2026-11-26). Each page says what the counter does for it.
// From 640 px the page's own Call button is in the first screen and the band's call hides (styles.css), so the line reads whole without it.
export const soonBand = (say = "Ask the counter what is on the shelf") => `${say}. <a class="tel" href="tel:+15192552222">Call 519-255-2222</a>`;

// Pickup or local delivery only (charcoal): the same rule as app.js localOnly
const localOnly = p => !!p && (p.ship === "pickup_only" || !!(p.details && p.details.charcoal));
// Card payment off: every order is a pickup, so the line never offers local delivery (breaker, 2026-11-27). The page reads it from
// the meta tag the Worker writes; the Worker sets it per request (src/worker.js setPickupOnly) from the same switch, so the two
// draw the same markup.
let pickupOnly = typeof document !== "undefined" && document.querySelector('meta[name="oss-pay"]')?.content !== "card";
export const setPickupOnly = v => { pickupOnly = !!v; };
// The band's line under a section name, from the section's own items, counted: Heat says how many are charcoal and how
// many foil; Hookahs counts hookahs, Shisha flavours; the pickup line only when every item in the section is pickup or local.
const plural = (n, one, many) => `<span class="num">${n}</span> ${n === 1 ? one : many}`;
export function bandNote(c, list) {
  if (!c) return plural(list.length, "piece", "pieces");
  const local = list.length && list.every(localOnly) ? (pickupOnly ? ".<br>Pickup only." : ".<br>Pickup or local delivery only.") : "";
  if (c.id === "charcoal") {   // its own section since 2026-11-24: boxes and the single rolls cut from them
    const rolls = list.filter(p => p.details?.box_sku).length, boxes = list.length - rolls;
    return [boxes ? plural(boxes, "box of charcoal", "boxes of charcoal") : "", rolls ? plural(rolls, "single roll", "single rolls") : ""].filter(Boolean).join(" and ") + local;
  }
  if (c.id === "heat") {   // foil, and the heat management pieces back on the shelf
    const foil = list.filter(p => /foil/i.test(p.name)).length, other = list.length - foil;
    return [foil ? plural(foil, "foil pack", "foil packs") : "", other ? plural(other, "heat piece", "heat pieces") : ""].filter(Boolean).join(" and ") + local;
  }
  if (c.id === "hookahs") return plural(list.length, "hookah", "hookahs") + local;
  if (c.id === "shisha") return plural(list.length, "flavour", "flavours") + local;
  return plural(list.length, "piece", "pieces") + local;
}
// c: the section ({ id, name, tone }), or null for Everything. list: what the section shows, one per card (picks.js shelfOf).
export function shopBand(c, list) {
  const empty = !!c && !list.length;
  return `
  <section class="shophead" data-tone="${esc(c ? c.tone : "bone")}" ${c ? `data-cat="${esc(c.id)}"` : `data-fx="all"`}>
    <h1 class="shophead__h">${c ? esc(c.name) : "Everything"}</h1>
    <p class="shophead__n">${empty ? soonBand() : bandNote(c, list)}</p>
  </section>`;
}
