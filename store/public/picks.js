// Which hookahs stand in the home page's first screen. The page and the Worker both use this, so the picture the
// Worker tells the browser to fetch early is always the one the page shows first.
// One piece per family, ones with their own photo, the shop's ticked (in-store) pieces before the rest of the catalogue.
export const shelfOf = list => list.filter(p => !p.family || p.lead);
export const ticked = p => !!(p.facts && p.facts.stamp && p.facts.stamp !== "none");
export function heroPicks(products, n = 5) {
  const ok = p => p.cat === "hookahs" && !p.dark && !p.photo && !!p.img && !(p.facts && p.facts.photo_full) && (p.family ? p.facts.photo === "own" : p.state === "sale" && p.stock !== 0);   // never a stand-in original (photo_full): the hero shows no tag
  const list = shelfOf(products).filter(ok);
  return [...list.filter(ticked), ...list.filter(p => !ticked(p))].slice(0, n);
}
