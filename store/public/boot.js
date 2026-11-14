// Effects load after the page is up, so they never hold back the first paint.
addEventListener("load", () => { for (const f of ["hero", "routes", "zoom", "stick", "cartfly", "lineup"]) import(`./fx-${f}.js`); }, { once: true });
