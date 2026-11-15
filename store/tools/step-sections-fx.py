# One-off edit (kept as history): hooks the section entrances into the pages. Run from store/: python tools/step-sections-fx.py
def edit(path, pairs, append=''):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s + append)

edit('public/app.js', [
    ('<section class="shophead" data-tone="${c ? c.tone : "bone"}">\n    <h1 class="shophead__h">${c ? c.name : "Everything"}</h1>', '<section class="shophead" data-tone="${c ? c.tone : "bone"}" ${c ? `data-cat="${c.id}"` : ""}>\n    <h1 class="shophead__h">${c ? c.name : "Everything"}</h1>'),
    ('<article class="pdp" data-tone="${toneOf(p)}">', '<article class="pdp" data-tone="${toneOf(p)}" data-cat="${p.cat}">'),
])
edit('public/boot.js', [('"cartfly", "lineup", "smoke"]', '"cartfly", "lineup", "smoke", "sections"]')])
edit('public/styles.css', [], '''
/* 06 section entrances: one signature move per section, behind the type, inside the header band */
.shophead{position:relative;isolation:isolate}
.fx{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;color:var(--color-on-tile)}
.fx-spritz{position:absolute;inset:0;width:100%;height:100%}
.fx-sheen{position:absolute;top:-25%;bottom:-25%;left:0;width:30%;background:linear-gradient(90deg,oklch(1 0 0 / 0),oklch(1 0 0 / .5) 42%,oklch(1 0 0 / .5) 58%,oklch(1 0 0 / 0));transform:translateX(-180%) skewX(-18deg)}
.fx-sheen--thin{width:7%;margin-left:12%;background:linear-gradient(90deg,oklch(1 0 0 / 0),oklch(1 0 0 / .65),oklch(1 0 0 / 0))}
.fx-ring{position:absolute;left:82%;top:54%;width:clamp(84px,16vw,190px);aspect-ratio:1;border:2px solid currentColor;border-radius:50%;opacity:0;transform:translate(-50%,-50%) scale(.12)}
.fx-glow{position:absolute;inset:auto 0 0;height:75%;background:radial-gradient(120% 100% at 50% 100%,oklch(0.99 0.05 90 / .5),oklch(0.99 0.05 90 / 0) 70%);opacity:0}
.fx-ember{position:absolute;bottom:-8px;border-radius:50%;background:radial-gradient(closest-side,oklch(0.99 0.03 95),oklch(0.93 0.12 85) 55%,oklch(0.93 0.12 85 / 0));opacity:0}
.fx-hose{position:absolute;inset:0}
.fx-hose svg{display:block;width:100%;height:100%;overflow:visible}
.fx-hose path{fill:none;stroke:currentColor;stroke-width:clamp(5px,1.1vw,10px);stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0;opacity:.2}
.fx-nut{position:absolute;right:max(var(--gutter),6%);top:50%;width:clamp(64px,13vw,150px);aspect-ratio:1;margin-top:calc(clamp(64px,13vw,150px) / -2);opacity:1}
.fx-nut svg{display:block;width:100%;height:100%;overflow:visible}
.fx-nut polygon,.fx-nut circle{fill:none;stroke:currentColor;stroke-width:5;stroke-linejoin:round;opacity:.22}
.fx-nut--small{width:clamp(34px,6.5vw,76px);margin-top:calc(clamp(34px,6.5vw,76px) / -2 + clamp(26px,5vw,60px));right:calc(max(var(--gutter),6%) + clamp(60px,12.4vw,142px))}
''')
print('section effects wired')
