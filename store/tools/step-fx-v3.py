# One-off edit (kept as history): third pass on the section entrances, after the second independent review.
# Heavier ink, larger objects, sparks with a hot centre, smoke that waits for the page fade.
# Run from store/: python tools/step-fx-v3.py
def edit(path, pairs):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s)

edit('public/styles.css', [
    ('.fx{--ink-w:3px}\n@media (min-width:960px){.fx{--ink-w:4px}}', '.fx{--ink-w:6px}\n@media (min-width:960px){.fx{--ink-w:9px}}'),
    ('.fx-obj{position:absolute;right:max(var(--gutter),5%);top:50%;height:74%;aspect-ratio:1;translate:0 -50%}', '.fx-obj{position:absolute;right:max(var(--gutter),5%);top:50%;height:94%;aspect-ratio:1;translate:0 -50%}'),
    ('.fx .ink{fill:none;stroke:currentColor;stroke-width:var(--ink-w);vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;opacity:.3}',
     '.fx .ink{fill:none;stroke:currentColor;stroke-width:var(--ink-w);vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;opacity:.22}\n'
     '.fx .inkfill{fill:currentColor;opacity:.22;font:400 44px/1 var(--font-display)}\n'
     '.fx .set{transform-box:view-box}'),
    ('.fx .lit{fill:none;stroke:oklch(0.99 0.01 90);stroke-width:var(--ink-w);vector-effect:non-scaling-stroke;opacity:0;transform-box:fill-box;transform-origin:center}',
     '.fx .lit{fill:none;stroke:oklch(0.99 0.01 90);stroke-width:calc(var(--ink-w) * .6);vector-effect:non-scaling-stroke;stroke-linecap:round;opacity:0;transform-box:view-box}'),
    ('.fx-hose{position:absolute;inset:0}\n.fx-hose .tip{stroke-width:calc(var(--ink-w) * 3)}\n', ''),
    ('background:radial-gradient(closest-side,var(--ember) 0 58%,oklch(0.58 0.215 29 / 0));opacity:0}', 'background:radial-gradient(closest-side,oklch(0.97 0.1 95) 0 24%,var(--ember) 46% 70%,oklch(0.58 0.215 29 / 0));opacity:0}'),
])
# smoke waits for the page fade like everything else, then rolls in
edit('public/fx-smoke.js', [
    ('gl.uniform1f(U.roll, fixedRoll !== null ? fixedRoll : RM.matches ? 9 : (now - placedAt) / 1000);', 'gl.uniform1f(U.roll, fixedRoll !== null ? fixedRoll : RM.matches ? 9 : Math.max(0, (now - placedAt - 450) / 1000)); // starts once the page change has faded in'),
    ('float front = roll * 0.8 - 0.04 +', 'float front = roll * 0.8 - 0.2 +'),
])
print('third pass applied')
