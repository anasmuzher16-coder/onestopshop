# Packer: try several packing orders for loose parts and keep the one that bills least (scored on the
# sheet's median zone). Cuts the cases where adding an item repacks into something cheaper.
p = 'site/rates.js'; s = open(p, encoding='utf8').read()
a = s.index('  // First-fit into L-sized bins by volume and weight')
b = s.index('  return parcels;\n}\n\n// --- Rating')
s = s[:a] + '''  // Loose parts: first-fit into L-sized bins, shrink each bin to the smallest box that holds it, then
  // rebalance. Tried in several orders; the packing that bills least wins.
  const cap = boxVol(BOXES.L) * BOX_FILL;
  const boxKey = bin => ["XS", "S", "M", "L"].find(k => boxVol(BOXES[k]) * BOX_FILL >= bin.vol) || "L";
  const dimKg = b => boxVol(b) / RATE_CARD.divisor;
  const move = (it, from, to) => {
    from.list.splice(from.list.indexOf(it), 1); from.vol -= looseVol(it); from.kg -= it.kg; from.value -= it.price;
    to.list.push(it); to.vol += looseVol(it); to.kg += it.kg; to.value += it.price;
  };
  const attempt = order => {
    const bins = [];
    for (const p of [...loose].sort(order)) {
      let bin = bins.find(b => b.vol + looseVol(p) <= cap && b.kg + p.kg + BOXES.L.tare <= MAX_KG);
      if (!bin) bins.push(bin = { vol: 0, kg: 0, value: 0, list: [] });
      bin.vol += looseVol(p); bin.kg += p.kg; bin.value += p.price; bin.list.push(p);
    }
    // A box is billed on the larger of its weight and its size, so a light box has billed weight to spare:
    // move items out of boxes billed on real weight into boxes with spare, heaviest first.
    for (let pass = 0; pass < 3; pass++) for (const to of bins) for (const from of bins) {
      if (from === to) continue;
      const tb = BOXES[boxKey(to)], fb = BOXES[boxKey(from)];
      if (from.kg + fb.tare <= dimKg(fb)) continue;
      for (const it of [...from.list].sort((x, y) => y.kg - x.kg)) {
        if (from.list.length > 1 && to.vol + looseVol(it) <= boxVol(tb) * BOX_FILL && to.kg + it.kg + tb.tare <= dimKg(tb)) move(it, from, to);
      }
    }
    const out = bins.map(bin => { const key = boxKey(bin), bx = BOXES[key];
      return { box: key, ...bx, kg: round(bin.kg + bx.tare, 2), value: bin.value, glass: bin.list.some(x => x.glass), fill: round(bin.vol / boxVol(bx)), items: bin.list.map(x => x.sku) }; });
    const score = out.reduce((t, p) => t + (sheetPrice("exp", 3, billableKg(p)) ?? 1e6), 0);
    return { out, score };
  };
  const orders = [(x, y) => looseVol(y) - looseVol(x) || y.kg - x.kg, (x, y) => y.kg - x.kg || looseVol(y) - looseVol(x), (x, y) => looseVol(x) - looseVol(y) || x.kg - y.kg, (x, y) => x.kg - y.kg];
  const best = orders.map(attempt).sort((x, y) => x.score - y.score || x.out.length - y.out.length)[0];
  parcels.push(...best.out);
''' + s[b:]
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok')
