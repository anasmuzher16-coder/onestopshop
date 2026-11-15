# One-off edit (kept as history): assembles the council's version of the effects.
#   VFX specialist: the smoke shader (tools/council-smoke.frag) and the canvas mist, sparks and steam
#     (tools/council-fx.js), tested on this machine's GPU and in a software canvas.
#   Illustrator: the eight solid objects (tools/objects-r4.txt -> public/fx-objects.js, built separately).
#   Motion director: the choreography already written into fx-sections.js.
#   Engineer: no doubled animation, no fade on re-draw, a shader clock that wraps, stills when the canvas cannot run.
# Run from store/: python tools/step-council.py
import re
def edit(path, pairs):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:80], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s)
def between(s, start, end, new):
    i = s.index(start); j = s.index(end, i)
    return s[:i] + new + s[j:]

# ---- smoke shader into fx-smoke.js
frag = open('tools/council-smoke.frag', encoding='utf8').read().strip()
pairs = [
    # no high precision: do not compile at all, so that phone gets the stills instead of blocky noise
    ('#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif', '#ifndef GL_FRAGMENT_PRECISION_HIGH\n#error high precision needed\n#endif\nprecision highp float;'),
    ('uniform float asp; uniform float gain;', 'uniform float asp; uniform float gain; uniform float grow;'),
    # the lattice wraps every 256 cells, so the hash keeps its precision however far the smoke has drifted
    ('float h(vec2 p){ p = fract(p * vec2(123.34, 456.21));', 'float h(vec2 p){ p = mod(p, 256.0); p = fract(p * vec2(123.34, 456.21));'),
    # the column climbs from its source when the page opens
    ('  float fade = smoothstep(0.0, 0.035, q.y) * (1.0 - smoothstep(0.6, 1.0, up));', '  float fade = smoothstep(0.0, 0.035, q.y) * (1.0 - smoothstep(0.6, 1.0, up)) * (1.0 - smoothstep(grow - 0.3, grow, up));'),
]
for a, b in pairs:
    assert frag.count(a) == 1, a[:60]; frag = frag.replace(a, b)
assert '`' not in frag and '${' not in frag
edit('public/fx-smoke.js', [('__FRAG__', '\n' + frag)])

# ---- canvas mist, sparks, steam into fx-sections.js
fx = open('tools/council-fx.js', encoding='utf8').read()
fx = fx[fx.index('// ---- one small 2D canvas'):].rstrip() + '\n'
for a, b in [
    ('else cv.remove();', 'else { cv.width = cv.height = 0; cv.remove(); } // hand the memory back'),
    ('const vents = [[0.36, 0.5], [0.64, 0.5], [0.5, 0.37], [0.5, 0.31]]', 'const vents = [[0.3, 0.3], [0.54, 0.3], [0.42, 0.385], [0.42, 0.27]]'),  # the two vents in the new lid
    ('const y = by + 0.31 * b.height,', 'const y = by + 0.19 * b.height,'),                                                                       # the cavity of the new bowl
]:
    assert fx.count(a) == 1, a[:60]; fx = fx.replace(a, b)
s = open('public/fx-sections.js', encoding='utf8').read()
s = between(s, '// ---- mist: two bursts from one point', '// ---- the label gun', fx + '\n')
for a, b in [
    ('spritz(layer, x, y, Math.PI * 1.02, 0.5); }); // the nozzle is 6 units down when it fires', 'spritz(layer, x, y, Math.PI * 1.02); }); // the nozzle is 6 units down when it fires'),
    ("cologne(layer, go) { if (go) when(layer, T0, () => spritz(layer, -0.02, 0.36, -0.07, 1)); },", "cologne(layer, go) { if (go) when(layer, T0, () => spritz(layer, -0.08, 0.36, Math.PI * 0.05, 2.4)); },"),
    # bowls: sits lower so the heat has room to rise; the heat is ribbons on the canvas
    ('const o = obj(layer, `${OBJ.bowls}<path class="lit" d="M34 22 q5 -5 0 -10 q-5 -5 0 -10"/><path class="lit" d="M50 24 q5 -5 0 -10 q-5 -5 0 -10"/><path class="lit" d="M66 22 q5 -5 0 -10 q-5 -5 0 -10"/>`);',
     'const o = obj(layer, OBJ.bowls, "low");'),
]:
    assert s.count(a) == 1, a[:70]; s = s.replace(a, b)
s = between(s, '    const lit = [...o.querySelectorAll(".lit")];', '  },\n  heat(layer, go) {', '    when(layer, T0 + 250, () => steam(layer, o)); // heat lifts off the top once it has settled\n')
s = between(s, '    const VENTS = [[.3, .3], [.54, .3], [.42, .385]]', '  },\n  hoses(layer, go) {', '    when(layer, T0, () => embers(layer, o)); // three crackles of sparks leave the vents and die inside the band\n')
for a, b in [
    ('const obj = (layer, inner) => { const w = el("span", "fx-obj", layer);', 'const obj = (layer, inner, cls = "") => { const w = el("span", "fx-obj " + cls, layer);'),
    # bases: bowed bars of light, glints on each shoulder as it passes, and a highlight that stays
    ('''<g class="rock">${OBJ.bases}<g clip-path="url(#${id})"><rect class="beam" x="-25" y="-10" width="18" height="120" fill="url(#${g})"/><rect class="beam" x="-44" y="-10" width="7" height="120" fill="url(#${g})"/></g></g>`);''',
     '''<g class="rock">${OBJ.bases}<g clip-path="url(#${id})"><g class="beam"><path d="M0 -10 C10 28, 10 74, -6 112 H18 C34 74, 34 28, 24 -10 Z" fill="url(#${g})"/><path d="M-20 -10 C-10 28, -10 74, -26 112 H-19 C-3 74, -3 28, -13 -10 Z" fill="url(#${g})"/></g></g>
      <path class="lit gl" d="M40 42 C40 58, 14 62, 13 76"/><path class="lit gr" d="M60 42 C60 58, 86 62, 87 76"/><path class="lit sh" d="M24 71 C27 64, 32 60, 37 56 M47 20 V32"/></g>`);
    const q = c => o.querySelector(c);
    if (!go) { q(".beam").style.opacity = 0; q(".sh").style.opacity = .5; return; } // the lit glass, at rest'''),
    ('''    if (!go) return;
    play(o.querySelector(".rock"), [ // tipped to the light''', '''    play(o.querySelector(".rock"), [ // tipped to the light'''),
    ('''    o.querySelectorAll(".beam").forEach(b => play(b, [ // the highlight slides across the belly because the glass turned
      { transform: "translateX(0px) skewX(-18deg)", easing: STATE }, { transform: "translateX(142px) skewX(-18deg)" }], 560, T0 - 40, "both"));''',
     '''    const run = { duration: 1100, delay: T0 - 60, fill: "both" }; // the light crosses because the glass turned; each shoulder glints as it passes
    q(".beam").animate([{ transform: "translateX(-44px) skewX(-14deg)" }, { transform: "translateX(138px) skewX(-14deg)" }], { ...run, easing: "cubic-bezier(.3,.1,.3,1)" });
    q(".beam").animate([{ opacity: 0 }, { opacity: 1, offset: .14 }, { opacity: 1, offset: .8 }, { opacity: 0 }], run);
    q(".gl").animate([{ opacity: 0 }, { opacity: 0, offset: .16 }, { opacity: .9, offset: .34 }, { opacity: 0, offset: .56 }, { opacity: 0 }], run);
    q(".gr").animate([{ opacity: 0 }, { opacity: 0, offset: .46 }, { opacity: .8, offset: .64 }, { opacity: 0, offset: .86 }, { opacity: 0 }], run);
    q(".sh").animate([{ opacity: 0 }, { opacity: 0, offset: .6 }, { opacity: .5 }], run); // and the glass keeps a highlight'''),
]:
    assert s.count(a) == 1, a[:70]; s = s.replace(a, b)
open('public/fx-sections.js', 'w', encoding='utf8', newline='\n').write(s)

# ---- cart flight: thrown in, not floated in (it lands at speed)
edit('public/fx-cartfly.js', [('const ease = u => 1 - Math.pow(1 - u, 2.2), frames = [];', 'const ease = u => 0.7 * u + 0.3 * u * u, frames = []; // leaves at 70% of its average speed and lands at 130%')])

# ---- styles: replace the section-entrance and smoke rules
p = 'public/styles.css'; s = open(p, encoding='utf8').read()
s, n = re.subn(r'^(\.fx[ .{-]|@media \(min-width:960px\)\{\.fx\{)[^\n]*\n', '', s, flags=re.M)
s, m = re.subn(r'^\.smoke[^\n]*\n', '', s, flags=re.M)
print('section rules removed:', n, 'smoke rules removed:', m)
s += '''/* 05 smoke: between the colour and the type or cut-out. The bank sits under the section's object. */
.smoke{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0;transition:opacity 600ms var(--ease-state) 300ms}
.smoke.on{opacity:1}
.smoke--hero{z-index:auto;transition:opacity 600ms var(--ease-state) 500ms}
.smoke--bank{z-index:-2;transition:none}
.smoke--still{background:none}
.smoke--still i{position:absolute;inset:-6% 0 0;background:center / 100% 100% no-repeat;opacity:.9}
.smoke--still i:first-child{background-image:url(img/smoke-a.webp)}
.smoke--still i:last-child{background-image:url(img/smoke-b.webp);opacity:0}
.smoke--still.smoke--bank i{inset:0}
.smoke--still.smoke--bank i:first-child{background-image:url(img/smoke-bank-a.webp)}
.smoke--still.smoke--bank i:last-child{background-image:url(img/smoke-bank-b.webp)}
/* 06 section entrances: one solid object per section, at the weight of the type, on the right of the band */
.fx{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;color:var(--color-on-tile);--ink-w:6px}
@media (min-width:960px){.fx{--ink-w:9px}}
.fx-spritz{position:absolute;inset:0;width:100%;height:100%}
.fx-obj{position:absolute;right:max(var(--gutter),5%);top:50%;height:94%;aspect-ratio:1;translate:0 -50%}
.fx-obj.low{top:auto;bottom:4%;height:72%;translate:none}
.fx-obj svg{display:block;width:100%;height:100%;overflow:visible}
.fx .o{opacity:.22}
.fx .sol{fill:currentColor}
.fx .ink{fill:none;stroke:currentColor;stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round}
.fx .lit{fill:none;stroke:oklch(0.99 0.01 90);stroke-width:calc(var(--ink-w) * .6);vector-effect:non-scaling-stroke;stroke-linecap:round;opacity:0}
.fx .glow{fill:var(--ember);opacity:.45}
.fx .beam{opacity:0}
.fx .hose{transform-box:view-box;transform-origin:45.5px 52px}
.fx .recoil,.fx .rock,.fx .set{transform-box:view-box;transform-origin:50px 94px}
.fx .keeper{transform-box:view-box;transform-origin:42px 74px}
.fx .whip{transform-box:view-box;transform-origin:20px 64px}
.fx .tip{transform-box:view-box;transform-origin:68px 38px}
.fx .turn{transform-box:view-box;transform-origin:50px 50px}
.fx .head{transform-box:view-box}
'''
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('council version assembled')
