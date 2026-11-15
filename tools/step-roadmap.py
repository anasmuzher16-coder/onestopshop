# One-off edit (kept as history): turns the roadmap from a week plan into a status page. python tools/step-roadmap.py
import re
p = 'docs/roadmap.html'; s = open(p, encoding='utf8').read()
i = s.index('  <section>\n    <h2>The weeks</h2>'); j = s.index('</section>', i) + len('</section>\n')
s = s[:i] + s[j:]
status = [
    ('wait', 'Waiting on other people', 'Nothing has come back yet. These five answers are the only thing between the build and a store that takes money.'),
    ('done', 'Done', 'Live at onestopshop-store.anas-dev.workers.dev beside the untouched preview. Still to add: a separate test copy.'),
    ('part', 'First version done', 'Today, Stock and Orders work with sample data. Sign-in is a passcode with a lockout. Still to add: the shop\'s real products and photos, and the emailed one-time code.'),
    ('part', 'Built, no payment yet', 'Orders place for real, the store prices them itself, tax follows the province, emails are written, privacy and terms pages are drafted. Still to add: card payment, and connecting a mail service so the emails send.'),
    ('todo', 'Not started', 'Shipping still prices from the saved table. Needs the shop\'s Canada Post account.'),
    ('part', 'Sections done', 'Both sections are in the store and the back office, and cologne is held to ground services. Still to add: Canada Post\'s cologne terms and the shop\'s real items.'),
    ('part', 'Mostly done', 'A wisp behind the product and on the home page, a puff at the cart, and a still-image fallback. Still to confirm on an iPhone with Low Power Mode on.'),
    ('todo', 'Not started', 'A backup can be downloaded today and a nightly one is ready to switch on. The security pass and the move off GoDaddy are still ahead.'),
    ('todo', 'Not started', 'Begins at launch.'),
]
whens = re.findall(r'        <p class="when">.*?</p>\n', s)
assert len(whens) == 9, len(whens)
for w, (k, label, note) in zip(whens, status):
    s = s.replace(w, f'        <p class="when"><span class="st st--{k}">{label}</span></p>\n        <p class="stnote">{note}</p>\n', 1)
a = '    <p class="lede">Nine steps take the approved One Stop Shop mockup to a real store that takes payment, prices shipping live, and lets the shop run its own stock. The preview the shop has seen stays as it is. The real store is built beside it.</p>'
assert s.count(a) == 1
s = s.replace(a, '    <p class="lede">Nine steps take the approved One Stop Shop mockup to a real store that takes payment, prices shipping live, and lets the shop run its own stock. Five of the nine are built or partly built. What is left is mostly waiting on answers, not on building.</p>')
a = '<p class="meta">Dijji Softworks &middot; written 14 November 2026</p>'; assert s.count(a) == 1
s = s.replace(a, '<p class="meta">Dijji Softworks &middot; status as of 14 November 2026</p>')
a = '      <div><h3>Us</h3><ul><li>Pick which payment company to ask first</li><li>Write the approval request</li><li>Start the new site beside the preview</li></ul></div>'
assert s.count(a) == 1
s = s.replace(a, '      <div><h3>Us</h3><ul><li>Pick which payment company to ask first</li><li>Write the approval request</li><li>Connect a mail service so order emails send</li></ul></div>')
a = '.phase .when{font-size:12.5px;color:var(--muted);letter-spacing:.04em;margin-bottom:10px}'; assert s.count(a) == 1
s = s.replace(a, '.phase .when{margin-bottom:6px}\n.st{font:600 11.5px/1 var(--body);letter-spacing:.1em;text-transform:uppercase}\n.st::before{content:"";display:inline-block;width:.7em;height:.7em;margin-right:.5em}\n.st--done{color:var(--teal)}.st--done::before{background:var(--teal)}\n.st--part{color:var(--amber)}.st--part::before{background:linear-gradient(90deg,var(--amber) 50%,transparent 50%);outline:1.5px solid var(--amber);outline-offset:-1.5px}\n.st--todo{color:var(--muted)}.st--todo::before{outline:1.5px solid var(--muted);outline-offset:-1.5px}\n.st--wait{color:var(--red)}.st--wait::before{background:var(--red);clip-path:polygon(50% 0,100% 100%,0 100%)}\n.stnote{font-size:14px;color:var(--muted);max-width:68ch;margin-bottom:12px}')
a = '<footer>The full plan, with sources for every number, is in the report "Turning the approved mockup into a working store". Week estimates are ours and change with the answers in step 0.</footer>'
assert s.count(a) == 1
s = s.replace(a, '<footer>The full plan, with sources for every number, is in the report "Turning the approved mockup into a working store". Everything marked done or built has passed its checks on the live site or on the build machine; card payment and live Canada Post are not built.</footer>')
for a, b in [('<tr><td>Smoke stutters on the phone</td><td>Test it in week 2, so week 11 is polish</td></tr>', '<tr><td>Smoke stutters on the phone</td><td>Check it on the iPhone with Low Power Mode on; a still-image fallback is built</td></tr>'),
             ('<tr><td>Nobody has the website login</td><td>Start GoDaddy\'s recovery in week 1</td></tr>', '<tr><td>Nobody has the website login</td><td>Start GoDaddy\'s recovery as soon as we know</td></tr>'),
             ('<li><b>Till sync and barcode scanning.</b> First version or later. Later keeps step 2 at three weeks.</li>', '<li><b>Till sync and barcode scanning.</b> First version or later. Later is simpler.</li>')]:
    assert s.count(a) == 1, a[:40]; s = s.replace(a, b)
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('roadmap updated; weeks left in text:', len(re.findall(r'[Ww]eeks? \d', s)))
