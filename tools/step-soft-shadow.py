# 2026-11-13. Cut-out fringes: the soft studio shadow under a piece is light grey, not white, so the flood from
# the border stopped at it and left an opaque pale smear. Second flood: from the background, walk through neutral
# pixels that change smoothly (a blur, not an object edge) and turn them into a real translucent shadow.
p = 'tools/products.mjs'; s = open(p, encoding='utf8').read()
a = '  for (let i = 0; i < N; i++) {\n    if (bg[i]) { data[i * 4 + 3] = 0; continue; }'
assert a in s
b = '''  // Soft shadow pass. A pixel joins when it is neutral, light enough, and within 6 levels of the pixel it was
  // reached from: blurred shadows qualify, object edges (a sharp step) do not. Skipped when it would eat more
  // than a third of the piece (white glass with a soft edge) or when the id is in NOSOFT.
  const soft = new Uint8Array(N);
  if (softOk) {
    const mn = i => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]), mx = i => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    const q = []; let kept = 0;
    const tryPush = (j, from) => { if (bg[j] || soft[j]) return; const m = mn(j); if (m < 150 || mx(j) - m > 14 || Math.abs(m - from) > 6) return; soft[j] = 1; q.push(j); };
    for (let i = 0; i < N; i++) { if (!bg[i]) { kept++; continue; } const x = i % w;
      if (x > 0 && !bg[i - 1]) tryPush(i - 1, 246); if (x < w - 1 && !bg[i + 1]) tryPush(i + 1, 246); if (i >= w && !bg[i - w]) tryPush(i - w, 246); if (i < N - w && !bg[i + w]) tryPush(i + w, 246); }
    while (q.length) { const i = q.pop(), x = i % w, m = mn(i); if (x > 0) tryPush(i - 1, m); if (x < w - 1) tryPush(i + 1, m); if (i >= w) tryPush(i - w, m); if (i < N - w) tryPush(i + w, m); }
    let ns = 0; for (let i = 0; i < N; i++) ns += soft[i];
    if (ns > kept * 0.33) soft.fill(0); else cutout.last = ns / kept;
  }
  for (let i = 0; i < N; i++) {
    if (bg[i]) { data[i * 4 + 3] = 0; continue; }
    if (soft[i]) { const m = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]), al = 1 - m / 255;
      for (let c = 0; c < 3; c++) data[i * 4 + c] = al < 0.02 ? 0 : Math.max(0, Math.min(255, Math.round((data[i * 4 + c] - 255 * (1 - al)) / al)));
      data[i * 4 + 3] = Math.round(al * 255); continue; }'''
s = s.replace(a, b, 1)
a = 'async function cutout(buf, thr = 240) {'; assert a in s
s = s.replace(a, 'const NOSOFT = new Set((process.env.NOSOFT || "").split(",").filter(Boolean));\nasync function cutout(buf, softOk = true, thr = 240) {', 1)
a = 'const flat = await cutout(trimmed);'; assert a in s
s = s.replace(a, 'const flat = await cutout(trimmed, !NOSOFT.has(id));', 1)
a = '    const x = i % w, edge = (x > 0 && bg[i - 1])'; assert a in s
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok')
