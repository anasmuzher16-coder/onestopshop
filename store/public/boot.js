// Effects start as soon as the page has drawn. They used to wait for the window's load event, which on a phone
// waits for every photo on the page: the section objects and their acts arrived seconds late, or never.
const pop = "popover" in HTMLElement.prototype; // the photo zoom needs it (Safari 17+); without it the zoom is simply absent
// one effect failing never stops the others; it is tried once more (a page change can cut a download short), then says why
const get = f => import(`./fx-${f}.js`);
const load = list => list.forEach(f => get(f).catch(() => setTimeout(() => get(f).catch(e => console.error("fx-" + f + ": " + e)), 1500)));
requestAnimationFrame(() => requestAnimationFrame(() => {
  load(["objects", "bounds", "sections", "smoke", "hero", "stick"]); // what the first screen shows; the drawings are asked for at once, not after the code that uses them
  setTimeout(() => load(["routes", ...(pop ? ["zoom"] : []), "cartfly", "lineup", "till"]), 300); // what only a tap or a scroll needs
}));
