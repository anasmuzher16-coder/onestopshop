# One-off edit (kept as history): first review pass on the section entrances, from the frame sheet.
# Run from store/: python tools/step-fx-tune.py
def edit(path, pairs):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s)

edit('public/fx-sections.js', [
    # spritz: travelled too little and vanished in under a second
    ('const a = angle + rnd(-0.42, 0.42) * (0.4 + Math.random()), v = rnd(170, 560) * power * scale;\n      parts.push({ x: ox * w, y: oy * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(0.6, 2.1), life: rnd(0.7, 1.5), age: 0, mist: false }); }',
     'const a = angle + rnd(-0.46, 0.46) * (0.35 + Math.random()), v = rnd(240, 820) * power * scale;\n      parts.push({ x: ox * w, y: oy * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(0.7, 2.4), life: rnd(1.0, 2.1), age: 0, mist: false }); }'),
    ('for (let i = 0; i < Math.round(n / 11); i++) { const a = angle + rnd(-0.34, 0.34), v = rnd(60, 190) * power * scale;\n      parts.push({ x: ox * w, y: oy * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(22, 52) * scale, life: rnd(1.3, 2.1), age: 0, mist: true }); }',
     'for (let i = 0; i < Math.round(n / 8); i++) { const a = angle + rnd(-0.36, 0.36), v = rnd(90, 300) * power * scale;\n      parts.push({ x: ox * w, y: oy * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(26, 60) * scale, life: rnd(1.9, 3.0), age: 0, mist: true }); }'),
    ('burst(150, 1); const second = setTimeout(() => burst(95, 0.82), 300);', 'burst(190, 1); const second = setTimeout(() => burst(130, 0.85), 340);'),
    ('const drag = Math.exp(-(p.mist ? 1.5 : 3.1) * dt); p.vx *= drag; p.vy = p.vy * drag + (p.mist ? -6 : 55) * dt;', 'const drag = Math.exp(-(p.mist ? 1.25 : 2.5) * dt); p.vx *= drag; p.vy = p.vy * drag + (p.mist ? -5 : 46) * dt;'),
    ('grd.addColorStop(0, `rgba(255,252,246,${0.13 * k})`);', 'grd.addColorStop(0, `rgba(255,252,246,${0.2 * Math.min(1, k * 1.6)})`);'),
    # the thin second sheen stopped in the middle of the band
    ('for (const [cls, delay, dur] of [["fx-sheen", 220, 1500], ["fx-sheen fx-sheen--thin", 420, 1500]]) { const s = el("span", cls, layer);\n      if (play) s.animate([{ transform: "translateX(-180%) skewX(-18deg)" }, { transform: "translateX(460%) skewX(-18deg)" }], { duration: dur, delay, easing: "cubic-bezier(.45,0,.2,1)", fill: "both" }); }',
     'for (const [cls, delay, from, to] of [["fx-sheen", 220, -180, 460], ["fx-sheen fx-sheen--thin", 400, -500, 1700]]) { const s = el("span", cls, layer);\n      if (play) s.animate([{ transform: `translateX(${from}%) skewX(-18deg)` }, { transform: `translateX(${to}%) skewX(-18deg)` }], { duration: 1500, delay, easing: "cubic-bezier(.45,0,.2,1)", fill: "both" }); }'),
    # embers were too small to read
    ('for (let i = 0; i < 20; i++) { const e = el("span", "fx-ember", layer), size = rnd(3, 6.5);', 'for (let i = 0; i < 28; i++) { const e = el("span", "fx-ember", layer), size = rnd(4, 10);'),
    ('{ duration: rnd(1500, 2900), delay: 150 + rnd(0, 1200), easing: "cubic-bezier(.25,.5,.3,1)", fill: "both" }).onfinish = () => e.remove(); }',
     '{ duration: rnd(1700, 3200), delay: 150 + rnd(0, 1600), easing: "cubic-bezier(.25,.5,.3,1)", fill: "both" }).onfinish = () => e.remove(); }'),
    # the hose drew as a travelling dash: build the line in real pixels and measure it
    ('''    const w = svg(`<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" vector-effect="non-scaling-stroke" d="M-4 31 C 10 31, 13 9, 27 11 S 40 35, 52 28 S 61 5, 73 12 S 87 36, 104 21"/></svg>`, "fx-hose", layer), p = w.querySelector("path");
    if (play) p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1700, delay: 200, easing: "cubic-bezier(.3,.1,.2,1)", fill: "both" });''',
     '''    const W = layer.clientWidth, H = layer.clientHeight, x = f => (f * W).toFixed(1), y = f => (f * H).toFixed(1);
    const d = `M-12 ${y(.8)} C ${x(.12)} ${y(.8)}, ${x(.14)} ${y(.18)}, ${x(.28)} ${y(.26)} S ${x(.4)} ${y(.94)}, ${x(.53)} ${y(.72)} S ${x(.62)} ${y(.08)}, ${x(.74)} ${y(.3)} S ${x(.88)} ${y(.95)}, ${W + 12} ${y(.5)}`;
    const w = svg(`<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}"/></svg>`, "fx-hose", layer), p = w.querySelector("path"), len = Math.ceil(p.getTotalLength());
    p.style.strokeDasharray = len;
    if (play) p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1800, delay: 200, easing: "cubic-bezier(.3,.1,.2,1)", fill: "both" });'''),
])
edit('public/styles.css', [
    ('.fx-hose path{fill:none;stroke:currentColor;stroke-width:clamp(5px,1.1vw,10px);stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0;opacity:.2}',
     '.fx-hose path{fill:none;stroke:currentColor;stroke-width:clamp(5px,1.1vw,10px);stroke-linecap:round;stroke-dashoffset:0;opacity:.2}'),
    # the nut sat on top of the long title on a phone: it now sits low in the corner and runs off the edge
    ('.fx-nut{position:absolute;right:max(var(--gutter),6%);top:50%;width:clamp(64px,13vw,150px);aspect-ratio:1;margin-top:calc(clamp(64px,13vw,150px) / -2);opacity:1}',
     '.fx-nut{position:absolute;right:-3%;bottom:-34%;width:clamp(104px,19vw,230px);aspect-ratio:1;opacity:1}'),
    ('.fx-nut--small{width:clamp(34px,6.5vw,76px);margin-top:calc(clamp(34px,6.5vw,76px) / -2 + clamp(26px,5vw,60px));right:calc(max(var(--gutter),6%) + clamp(60px,12.4vw,142px))}',
     '.fx-nut--small{width:clamp(44px,8vw,96px);bottom:-10%;right:calc(-3% + clamp(100px,18.4vw,222px))}'),
    ('.fx-ember{position:absolute;bottom:-8px;border-radius:50%;background:radial-gradient(closest-side,oklch(0.99 0.03 95),oklch(0.93 0.12 85) 55%,oklch(0.93 0.12 85 / 0));opacity:0}',
     '.fx-ember{position:absolute;bottom:-10px;border-radius:50%;background:radial-gradient(closest-side,oklch(1 0.02 95),oklch(0.96 0.1 88) 50%,oklch(0.96 0.1 88 / 0));opacity:0}'),
    ('.fx-ring{position:absolute;left:82%;top:54%;', '.fx-ring{position:absolute;left:76%;top:52%;'),
])
print('tuned')
