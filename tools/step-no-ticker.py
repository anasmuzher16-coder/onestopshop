# His veto 2026-11-13: the scrolling ticker is "an ai tell and corny". Removed entirely (markup, script, styles).
import re
p = 'site/app.js'; s = open(p, encoding='utf8').read()
i = s.index('const WORDS = ['); j = s.index('function viewHome()'); s = s[:i] + s[j:]
s = s.replace('  ${ticker()}\n', '')
assert 'ticker' not in s
open(p, 'w', encoding='utf8', newline='\n').write(s)
p = 'site/styles.css'; c = open(p, encoding='utf8').read()
i = c.index('/* ---------- ticker'); j = c.index('/* ---------- category blocks'); c = c[:i] + c[j:]
c = '\n'.join(l for l in c.split('\n') if 'ticker' not in l and '.tick' not in l)
assert 'tick' not in c
open(p, 'w', encoding='utf8', newline='\n').write(c)
print('ok')
