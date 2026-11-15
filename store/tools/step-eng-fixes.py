# One-off edit (kept as history): the iPhone engineer's fixes that do not depend on the other council reports.
#   B1 photo zoom + Back left the photo stuck over the page.
#   B2 Safari older than 17 has no Popover API: the zoom is not loaded there, and stays hidden unless proven open.
#   B4 a re-draw of the same page (add to cart) re-stuck every price label in view.
#   print: effect layers never print.
# Run from store/: python tools/step-eng-fixes.py
def edit(path, pairs, append=''):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s + append)

edit('public/fx-zoom.js', [
    ('addEventListener("routechange", () => { if (isOpen()) { anims.forEach(a => a.cancel()); anims = []; closing = true; close(); } });',
     'addEventListener("routechange", () => { if (isOpen()) { anims.forEach(a => a.cancel()); anims = []; closing = false; close(); } }); // leaving the page always closes the photo'),
])
s = open('public/boot.js', encoding='utf8').read()
i = s.index('addEventListener("load"')
new = ('addEventListener("load", () => {\n'
       '  const pop = "popover" in HTMLElement.prototype; // the photo zoom needs it (Safari 17+); without it the zoom is simply absent\n'
       '  for (const f of ["hero", "routes", "zoom", "stick", "cartfly", "lineup", "smoke", "sections", "till"])\n'
       '    if (f !== "zoom" || pop) import(`./fx-${f}.js`).catch(() => {}); // one effect failing to load never stops the others\n'
       '}, { once: true });\n')
open('public/boot.js', 'w', encoding='utf8', newline='\n').write(s[:i] + new)
edit('public/styles.css', [
    ('.zoom:not(:popover-open){display:none}', '.zoom{display:none}\n.zoom:popover-open{display:block}'),
], append='/* effect layers never print, and every price prints */\n@media print{.fx,.smoke,.puff,.fly,.zoom{display:none !important}.sticker{opacity:1 !important;scale:1 !important;animation:none !important}}\n')
edit('public/fx-stick.js', [
    ('function scan() {\n  if (!io) return; io.disconnect();\n  if (RM.matches) return;',
     'let stuck = "";\nfunction scan() {\n  if (!io) return; io.disconnect();\n  const again = stuck === location.pathname; stuck = location.pathname;\n  if (again || RM.matches) return; // the same page re-drawn (add to cart, a quantity change): labels stay where they are'),
])
print('engineer fixes applied')
