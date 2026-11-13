# Hero typography (atelier:typography + atelier:layout, 2026-11-13). His note: line is fine, the type and
# placement were boring. Decisions:
# - Two sizes, one sentence: "Hookahs," is the statement (fit to the full width of the frame, ~9x body on
#   desktop, leading .8, tracking -.02em, hung left so the H's stem sits on the margin); the rest of the
#   sentence continues at sub-display size. Size is the only variable that changes between the two.
# - Placement: the statement sits on the bottom edge of the photo and owns the fold; the continuation hangs
#   under its left edge, the paragraph and actions sit bottom-right on the same baseline row (asymmetric,
#   three shared alignment lines: left margin, right margin, bottom row).
# - Photo scrim comes from the bottom only, so the picture stays a picture at the top.
p = 'site/styles.css'; c = open(p, encoding='utf8').read()
def swap(a, b):
    global c
    assert a in c, a[:60]; c = c.replace(a, b)
swap('.hero{position:relative;isolation:isolate;display:grid;align-items:end;min-height:min(78svh,640px);padding:var(--s-12) var(--gutter) var(--s-8)}',
     '.hero{position:relative;isolation:isolate;display:grid;align-items:end;min-height:min(86svh,700px);padding:var(--s-12) var(--gutter) var(--s-6)}')
swap('.hero__bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,oklch(0.155 0.012 50 / .35) 0%,oklch(0.155 0.012 50 / .55) 45%,var(--color-bg) 100%)}',
     '.hero__bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,oklch(0.155 0.012 50 / .15) 0%,oklch(0.155 0.012 50 / .3) 38%,oklch(0.155 0.012 50 / .86) 70%,var(--color-bg) 100%)}')
swap('.hero__h{font:400 clamp(2.6rem,1.3rem + 5.6vw,6rem)/.95 var(--font-display);letter-spacing:-.005em;color:var(--color-strong);margin:0;max-width:13ch;text-wrap:balance}\n.hero__p{max-width:40ch;margin:var(--s-5) 0 var(--s-6);font-size:var(--t-16);color:var(--color-strong)}',
     '''.hero__in{container-type:inline-size;display:grid;gap:var(--s-5)}
.hero__h{font:400 var(--t-d1)/1.02 var(--font-display);color:var(--color-strong);margin:0}
.hero__big{display:block;font-size:26.2cqw;line-height:.8;letter-spacing:-.02em;margin:0 0 .1em -.045em;white-space:nowrap}
.hero__rest{display:block;max-width:15ch;text-wrap:balance}
.hero__p{max-width:34ch;margin:0 0 var(--s-5);font-size:var(--t-16);color:var(--color-text)}''')
swap('''  .hero{min-height:min(84svh,820px);padding-bottom:var(--s-12)}
  .hero__bg::after{background:linear-gradient(90deg,oklch(0.155 0.012 50 / .9) 0%,oklch(0.155 0.012 50 / .55) 45%,oklch(0.155 0.012 50 / .1) 100%),linear-gradient(180deg,transparent 60%,var(--color-bg) 100%)}
  .hero__p{font-size:var(--t-18)}''',
     '''  .hero{min-height:min(88svh,860px);padding-bottom:var(--s-8)}
  .hero__in{grid-template-columns:1fr auto;align-items:end;column-gap:var(--s-16);row-gap:var(--s-4)}
  .hero__h{display:contents}
  .hero__big{grid-column:1 / -1;margin-bottom:0}
  .hero__rest{font:400 var(--t-d2)/.95 var(--font-display);max-width:14ch;align-self:end}
  .hero__side{max-width:360px;justify-self:end}
  .hero__p{font-size:var(--t-18)}''')
open(p, 'w', encoding='utf8', newline='\n').write(c)
print('ok')
