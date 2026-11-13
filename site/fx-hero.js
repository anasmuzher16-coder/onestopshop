// 04 hero entrance: plays once per visit. After the first home render (or the first navigation) it is switched off.
const done = () => document.documentElement.classList.add("hero-seen");
addEventListener("hashchange", done, { once: true });
setTimeout(done, 2000);
