// 05 line-up ruler: the line-up is drawn truly to scale (each cut-out is sized by where the piece sits in its frame,
// so a 74 cm hookah stands exactly 74 cm on the ruler), a fixed cm ruler sits behind the shelf, and a height line
// glides to the centred piece so every other piece can be read against it. Scroll work is one rAF, transform only.
import { bounds, imgName } from "./fx-bounds.js";
const main = document.getElementById("main");
let off = () => {};
function setup() {
  off();
  const sec = main.querySelector(".lineup"), row = sec && sec.querySelector(".lineup__row"); if (!row) return;
  const items = [...row.querySelectorAll(".lu")];
  for (const a of items) { const [t, b] = bounds(imgName(a.querySelector("img").getAttribute("src")) || ""); a.style.setProperty("--k", (1 / (b - t)).toFixed(4)); a.style.setProperty("--pb", (1 - b).toFixed(4)); }
  const rule = document.createElement("div"); rule.className = "lu-rule"; rule.setAttribute("aria-hidden", "true");
  rule.innerHTML = [30, 60, 90].map(c => `<span class="lu-rule__l" style="--c:${c}"><b>${c === 90 ? "90 cm" : c}</b></span>`).join("") + `<span class="lu-rule__m"></span>`;
  const read = document.createElement("div"); read.className = "lu-rule lu-rule--read"; read.setAttribute("aria-hidden", "true");
  read.innerHTML = `<span class="lu-rule__m"><b class="num"></b></span>`;
  sec.classList.add("lineup--ruled"); sec.append(rule, read);
  const marks = [rule.lastChild, read.firstChild], val = read.querySelector("b");
  let centers = [], luh = 0, cur = -1, raf = 0;
  const measure = () => {
    const rr = row.getBoundingClientRect(), sr = sec.getBoundingClientRect(), floor = items[0].querySelector(".lu__cm").getBoundingClientRect().top;
    luh = parseFloat(getComputedStyle(sec).getPropertyValue("--lu-h")) || 230;
    for (const el of [rule, read]) { el.style.top = (floor - sr.top - luh) + "px"; el.style.height = luh + "px"; }
    centers = items.map(a => { const r = a.getBoundingClientRect(); return r.left - rr.left + row.scrollLeft + r.width / 2; });
    cur = -1; pick();
  };
  const pick = (force) => {
    raf = 0; const c = row.scrollLeft + row.clientWidth / 2; let i = force ?? 0;
    if (force == null) for (let j = 1; j < centers.length; j++) if (Math.abs(centers[j] - c) < Math.abs(centers[i] - c)) i = j;
    if (i === cur) return; cur = i;
    const cm = +items[i].style.getPropertyValue("--cm");
    for (const m of marks) m.style.transform = `translateY(${(-cm / 92 * luh).toFixed(1)}px)`; val.textContent = cm + " cm";
    items.forEach((a, j) => a.classList.toggle("is-on", j === i));
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => pick()); };
  const onOver = e => { const a = e.target.closest(".lu"); if (a) pick(items.indexOf(a)); };
  row.addEventListener("scroll", onScroll, { passive: true });
  row.addEventListener("pointerover", onOver); row.addEventListener("focusin", onOver);
  addEventListener("resize", measure);
  measure();
  off = () => { removeEventListener("resize", measure); cancelAnimationFrame(raf); off = () => {}; };
}
new MutationObserver(setup).observe(main, { childList: true });
setup();
