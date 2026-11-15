# One-off edit (kept as history): second pass on the section entrances, after the independent review.
# Styles for the shared ink objects, smoke that reads as smoke and travels, and no doubled label animation on misc.
# Run from store/: python tools/step-fx-v2.py
import re
def edit(path, pairs):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s)

# styles: drop the first version's per-effect rules, add the shared object rules
p = 'public/styles.css'; s = open(p, encoding='utf8').read()
s, n = re.subn(r'^\.fx-(sheen|sheen--thin|ring|glow|ember|hose|hose svg|hose path|nut|nut svg|nut polygon,\.fx-nut circle|nut--small)\{[^\n]*\n', '', s, flags=re.M)
print('old effect rules removed:', n)
s += '''/* 06 the shared rule: one ink object per section, same line, same weight, on the right of the band */
.fx{--ink-w:3px}
@media (min-width:960px){.fx{--ink-w:4px}}
.fx-obj{position:absolute;right:max(var(--gutter),5%);top:50%;height:74%;aspect-ratio:1;margin-top:calc(-37% * 0)}
.fx-obj{translate:0 -50%}
.fx-obj svg,.fx-hose svg{display:block;width:100%;height:100%;overflow:visible}
.fx .ink{fill:none;stroke:currentColor;stroke-width:var(--ink-w);vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;opacity:.3}
.fx .lit{fill:none;stroke:oklch(0.99 0.01 90);stroke-width:var(--ink-w);vector-effect:non-scaling-stroke;opacity:0;transform-box:fill-box;transform-origin:center}
.fx .lit-fill{fill:oklch(1 0 0 / .62)}
.fx .turn{transform-box:view-box;transform-origin:50px 50px}
.fx .head{transform-box:view-box}
.fx-hose{position:absolute;inset:0}
.fx-hose .tip{stroke-width:calc(var(--ink-w) * 3)}
.fx-ember{position:absolute;border-radius:50%;background:radial-gradient(closest-side,oklch(0.97 0.1 95) 28%,var(--ember) 62%,oklch(0.58 0.215 29 / 0));opacity:0}
'''
open(p, 'w', encoding='utf8', newline='\n').write(s)

# smoke: soft volume instead of bright veins, a body that travels with its leading edge, a real thinning, a soft bottom
edit('public/fx-smoke.js', [
    ('vec2 p = vec2(uv.x * asp, uv.y) * 1.9; p.x -= t * 0.06; p.y -= t * 0.022;', 'vec2 p = vec2(uv.x * asp, uv.y) * 1.9; p.x -= t * 0.06 + 1.2 * (1.0 - exp(-roll * 1.1)); p.y -= t * 0.022;   // the body is carried in with the front, not uncovered by it'),
    ('float strand = pow(1.0 - abs(2.0 * fbm(p * 1.6 + 3.0 * w) - 1.0), 5.0);', 'float strand = pow(1.0 - abs(2.0 * fbm(p * 1.6 + 3.0 * w) - 1.0), 3.0);'),
    ('float surge = mix(1.0, 0.55, smoothstep(2.6, 7.0, roll));', 'float surge = mix(1.0, 0.4, smoothstep(1.8, 4.0, roll));'),
    ('a = clamp(((body * 0.8 + strand * 0.42) * mix(0.5, 1.0, low) + lead) * reveal, 0.0, 1.0) * surge * 0.9;', 'a = clamp(((body * 0.88 + strand * 0.15) * mix(0.5, 1.0, low) + lead) * reveal, 0.0, 1.0) * surge * 0.9 * smoothstep(0.0, 0.12, uv.y);'),
])

# misc: the header runs the price gun itself, so the everyday label animation steps aside for the first screen there
edit('public/fx-stick.js', [
    ('  const vh = innerHeight; let k = 0;\n  for (const t of main.querySelectorAll(".card .tile")) {', '  const vh = innerHeight, gun = !!main.querySelector(\'.shophead[data-cat="misc"]\'); let k = 0; // on misc the section entrance stamps the first screen\n  for (const t of main.querySelectorAll(".card .tile")) {'),
    ('    if (r.bottom > 0 && r.top < vh) { if (painted) go(t, 140 + Math.min(k++, 6) * 55); }', '    if (r.bottom > 0 && r.top < vh) { if (painted && !gun) go(t, 140 + Math.min(k++, 6) * 55); }'),
])
print('second pass applied')
