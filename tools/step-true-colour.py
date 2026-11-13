# 2026-11-13 late. His iPhone showed: white inside a hose loop, and a hero word that "looks funky".
# Cause 1: iOS Safari does not apply the multiply tint in the hero, so any white left in a photo shows.
# Decision: stop depending on blend modes anywhere. Photos are real cut-outs (enclosed white removed too) shown in
# their true colours on the jewel tiles: identical in every browser. The "True colour" switch is no longer needed.
# Cause 2: on a phone the word-under-the-hookahs trick is too busy. On phones the hookahs stand clear on the slabs
# and "Hookahs," sits below them as plain large type. Desktop keeps the word behind the hookahs, without the
# doubled outline.
import re
def sub(s, a, b, count=1):
    assert a in s, 'missing: ' + a[:80]
    return s.replace(a, b, count)

p = 'site/app.js'; s = open(p, encoding='utf8').read()
i = s.index('\n      <p class="hero__word hero__word--line"'); j = s.index('\n', i + 1); s = s[:i] + s[j:]
s = sub(s, '<h1 class="hero__h"><span class="sr">Hookahs, </span>and everything that goes with them.</h1>', '<h1 class="hero__h"><span class="hero__lead">Hookahs,</span> and everything that goes with them.</h1>')
s = sub(s, '${p.dark || p.photo ? "" : `<button class="truecolour" type="button" data-true aria-pressed="false">True colour</button>`}', '')
i = s.index('  const tc = e.target.closest("[data-true]");'); j = s.index('  const add = e.target.closest("[data-add]");'); s = s[:i] + s[j:]
open(p, 'w', encoding='utf8', newline='\n').write(s)

p = 'site/styles.css'; c = open(p, encoding='utf8').read()
n0 = c.count('mix-blend-mode:multiply')
c = c.replace('mix-blend-mode:multiply;', '').replace(';mix-blend-mode:multiply', '').replace('mix-blend-mode:multiply', '')
c = c.replace('.shot--photo{mix-blend-mode:normal;object-fit:cover}', '.shot--photo{object-fit:cover}').replace('.resin__item .shot{object-fit:cover;mix-blend-mode:normal}', '.resin__item .shot{object-fit:cover}')
assert 'multiply' not in c, re.findall(r'[^\n]*multiply[^\n]*', c)[:3]
# hero word: one clean layer
i = c.index('/* The word is drawn twice'); j = c.index('\n', c.index('.hero__word--line{', i)) + 1; c = c[:i] + c[j:]
c = sub(c, 'white-space:nowrap;text-shadow:.028em .028em 0 var(--ink)}', 'white-space:nowrap;display:none}')
c = sub(c, '.hero__h{font:400 var(--t-d1)/1.02 var(--font-display);color:var(--color-strong);margin:0;max-width:15ch;text-wrap:balance}',
        '.hero__in{container-type:inline-size}\n.hero__h{font:400 var(--t-d1)/1.02 var(--font-display);color:var(--color-strong);margin:0}\n.hero__lead{display:block;font-size:26.2cqw;line-height:.86;letter-spacing:-.02em;margin:0 0 .06em -.045em;white-space:nowrap}')
c = sub(c, '.piece .shot{flex:none;height:calc(var(--cm) / 118 * 100%);margin-bottom:calc(100cqw * .2);', '.piece .shot{flex:none;height:calc(var(--cm) / 92 * 100%);')
c = sub(c, '.hero__stage{position:relative;isolation:isolate;container-type:inline-size;height:max(280px,calc(100svh - 440px));overflow:hidden}', '.hero__stage{position:relative;container-type:inline-size;height:max(260px,calc(100svh - 500px));overflow:hidden}')
c = sub(c, '  .piece .shot{height:calc(var(--cm) / 86 * 100%);margin-bottom:0}\n', '''  .piece .shot{height:calc(var(--cm) / 86 * 100%)}
  .hero__word{display:block}
  .hero__lead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  .hero__in{container-type:normal}
''')
c = sub(c, '  .hero__h{font-size:var(--t-d2);line-height:.95;max-width:16ch}', '  .hero__h{font-size:var(--t-d2);line-height:.95;max-width:16ch;text-wrap:balance}')
# product stage: no switch
c = re.sub(r'\n\.pdp__tile\[data-truecolour\]\{[^\n]*', '', c)
c = re.sub(r'\n\.truecolour\{[^\n]*\n\.truecolour\[aria-pressed="true"\]\{[^\n]*', '', c)
c = re.sub(r'\n  \.truecolour\{[^\n]*', '', c)
assert 'truecolour' not in c
open(p, 'w', encoding='utf8', newline='\n').write(c)
print('ok, multiply rules removed:', n0)
