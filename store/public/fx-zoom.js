// 06 photo zoom: tap the product photo and it grows (FLIP, transform only) out of its tile into a full-screen view on
// its own jewel colour, swaps to the largest file once decoded, and shows a height line measured from the piece itself.
// Tap anywhere, Esc or the close button reverses it from wherever it is. No pinch, no drag, nothing to learn.
import { bounds, imgName } from "./fx-bounds.js";
import { PRODUCTS } from "/api/catalog-module";
const RM = matchMedia("(prefers-reduced-motion: reduce)");
// A manual popover, not a modal dialog (showModal makes the whole page inert).
// Focus and Esc are handled here instead.
const dlg = document.createElement("div");
dlg.className = "zoom"; dlg.setAttribute("popover", "manual"); dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Product photo");
dlg.innerHTML = `<div class="zoom__bg"></div><img class="zoom__img" alt=""><span class="zoom__h" hidden><b class="num"></b></span><button class="zoom__x" type="button" aria-label="Close photo">Close</button>`;
document.body.append(dlg);
const bg = dlg.querySelector(".zoom__bg"), img = dlg.querySelector(".zoom__img"), hl = dlg.querySelector(".zoom__h");
let anims = [], src = null, closing = false;
const fit = (box, ar) => { const w = Math.min(box.width, box.height * ar), h = w / ar; return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h }; };
function from(el) { // the drawn rectangle of the photo inside its tile
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el), pl = parseFloat(cs.paddingLeft), pt = parseFloat(cs.paddingTop);
  const box = { left: r.left + pl, top: r.top + pt, width: r.width - pl - parseFloat(cs.paddingRight), height: r.height - pt - parseFloat(cs.paddingBottom) };
  return cs.objectFit === "cover" ? box : fit(box, el.naturalWidth / el.naturalHeight);
}
const isOpen = () => dlg.matches(":popover-open");
function open(el) {
  src = el; closing = false;
  const tile = el.closest(".tile"), photo = el.classList.contains("shot--photo"), ar = el.naturalWidth / el.naturalHeight;
  const a = from(el), tr = tile.getBoundingClientRect(); // all reads first, then writes: one layout, not three
  const pad = innerWidth < 640 ? 12 : 40, to = fit({ left: pad, top: pad + 44, width: innerWidth - 2 * pad, height: innerHeight - 2 * pad - 88 }, ar);
  dlg.dataset.tone = photo ? "" : (el.closest("[data-tone]") || {}).dataset?.tone || ""; dlg.classList.toggle("zoom--photo", photo);
  img.src = el.currentSrc || el.src; img.alt = el.alt;
  Object.assign(img.style, { left: to.left + "px", top: to.top + "px", width: to.width + "px", height: to.height + "px" });
  dlg.showPopover(); dlg.querySelector(".zoom__x").focus({ preventScroll: true });
  // height line, measured from where the piece sits in its frame
  const sku = (el.closest("[data-stage]") || {}).dataset?.stage, cm = sku && (PRODUCTS.find(p => p.sku === sku) || {}).height;
  hl.hidden = !cm || photo;
  if (!hl.hidden) { const [t, b] = bounds(imgName(img.src) || ""); Object.assign(hl.style, { left: (to.left + 6) + "px", top: (to.top + t * to.height) + "px", height: ((b - t) * to.height) + "px" }); hl.firstChild.textContent = cm + " cm"; }
  el.style.visibility = "hidden";
  const big = (el.getAttribute("srcset") || "").split(",").map(s => s.trim().split(/\s+/)).sort((x, y) => parseInt(y[1]) - parseInt(x[1]))[0];
  if (big && big[0] && !img.src.endsWith(big[0])) { const pre = new Image(); pre.src = big[0]; pre.decode().then(() => { if (isOpen() && src === el) img.src = pre.src; }, () => {}); }
  if (RM.matches || !img.animate) return;
  const k = a.width / to.width, dx = a.left - to.left, dy = a.top - to.top;
  const o = { duration: 440, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" };
  anims = [
    img.animate([{ transform: `translate(${dx}px,${dy}px) scale(${k})` }, { transform: "none" }], o),
    bg.animate([{ clipPath: `inset(${tr.top}px ${innerWidth - tr.right}px ${innerHeight - tr.bottom}px ${tr.left}px)` }, { clipPath: "inset(0 0 0 0)" }], o),
    dlg.querySelector(".zoom__x").animate([{ opacity: 0 }, { opacity: 1 }], { ...o, duration: 300, delay: 180 }),
    hl.animate([{ opacity: 0, transform: "scaleY(.6)" }, { opacity: 1, transform: "none" }], { ...o, duration: 360, delay: 260 }),
  ];
}
function close() {
  if (!isOpen() || closing) return; closing = true;
  const done = () => { dlg.hidePopover(); if (src) { src.style.visibility = ""; if (document.activeElement === dlg.querySelector(".zoom__x")) src.focus({ preventScroll: true }); }  anims.forEach(a => a.cancel()); anims = []; closing = false; };
  if (RM.matches || !anims.length) return done();
  anims.forEach(a => { a.playbackRate = -1.25; a.play(); }); // reverses from wherever it is, so a quick tap mid-open just goes back
  anims[0].finished.then(done, done);
}
document.addEventListener("click", e => {
  const el = e.target.closest("[data-stage] .shot"); if (!el || e.target.closest(".sticker") || !el.complete || !el.naturalWidth) return;
  open(el);
});
dlg.addEventListener("click", close);
document.addEventListener("keydown", e => { const el = e.target.closest && e.target.closest("[data-stage] .shot"); if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(el); } });
const main = document.getElementById("main"), arm = () => { const el = main.querySelector("[data-stage] .shot"); if (el) { el.tabIndex = 0; el.setAttribute("role", "button"); el.setAttribute("aria-label", "Enlarge photo: " + el.alt); } };
new MutationObserver(arm).observe(main, { childList: true }); arm();
addEventListener("keydown", e => { if (e.key === "Escape" && isOpen()) { e.preventDefault(); close(); } else if (e.key === "Tab" && isOpen()) { e.preventDefault(); dlg.querySelector(".zoom__x").focus(); } });
addEventListener("routechange", () => { if (isOpen()) { anims.forEach(a => a.cancel()); anims = []; closing = false; close(); } }); // leaving the page always closes the photo
