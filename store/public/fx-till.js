// 07 the till. Two small moments at the counter:
//   the cart's total rolls to its new figure when the cart changes, like the wheels of a till;
//   the order number is stamped onto the confirmation, the hardest stamp on the site.
// Transform and opacity only. Nothing happens when motion is turned off: the figures are simply there.
const RM = matchMedia("(prefers-reduced-motion: reduce)"), main = document.getElementById("main");
let lastTotal = "", lastPath = "", stamped = "";
function roll(dd, from, to) {
  // each character that changed drops in from above; unchanged ones stay still, so a $5 change does not move the whole line
  dd.textContent = "";
  const pad = Math.max(from.length, to.length), a = from.padStart(pad), b = to.padStart(pad);
  [...b].forEach((ch, i) => {
    const s = document.createElement("span"); s.textContent = ch; s.style.display = "inline-block"; dd.append(s);
    if (ch !== a[i] && ch !== " ") s.animate([{ transform: "translateY(-0.7em)", opacity: 0 }, { transform: "translateY(0.06em)", opacity: 1, offset: .7 }, { transform: "translateY(0)", opacity: 1 }],
      { duration: 260, delay: (pad - 1 - i) * 28, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" }); // the cents turn first, as on a till
  });
}
function scan() {
  const path = location.pathname, dd = main.querySelector(".cart .totals__door dd");
  if (dd && !dd.firstElementChild) {
    const now = dd.textContent.trim();
    if (!RM.matches && path === lastPath && lastTotal && now !== lastTotal) roll(dd, lastTotal, now);
    lastTotal = now;
  } else if (!dd) lastTotal = "";
  lastPath = path;
  const tag = main.querySelector(".done__tag");
  if (tag && !tag.closest(".doc") && stamped !== path) {
    stamped = path;
    if (!RM.matches) {
      tag.animate([{ transform: "rotate(-2deg) scale(1.55)", opacity: 0 }, { transform: "rotate(-2deg) scale(1.55)", opacity: 1, offset: .01 }, { transform: "rotate(-3.2deg) scale(.94)", offset: .62 }, { transform: "rotate(-2deg) scale(1)" }],
        { duration: 300, delay: 480, easing: "cubic-bezier(.3,0,.2,1)", fill: "backwards" });
      const page = tag.closest(".done"); // the page gives a little under it
      if (page) page.animate([{ transform: "translateY(0)" }, { transform: "translateY(3px)", offset: .4 }, { transform: "translateY(0)" }], { duration: 220, delay: 480 + 180, easing: "ease-out" });
    }
  }
}
new MutationObserver(scan).observe(main, { childList: true });
scan();
