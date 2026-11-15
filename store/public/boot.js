// Effects load after the page is up, so they never hold back the first paint.
addEventListener("load", () => {
  const pop = "popover" in HTMLElement.prototype; // the photo zoom needs it (Safari 17+); without it the zoom is simply absent
  for (const f of ["hero", "routes", "zoom", "stick", "cartfly", "lineup", "smoke", "sections", "till"])
    if (f !== "zoom" || pop) import(`./fx-${f}.js`).catch(() => {}); // one effect failing to load never stops the others
}, { once: true });
