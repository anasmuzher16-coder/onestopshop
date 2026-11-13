# PLAN - One Stop Shop mockup (due to Angel 2026-11-14)
Direction 1 was vetoed 2026-11-13 (basic, colourless, not researched). Plan restarted on direction 2 (docs/DESIGN.md).
- [x] 1. Research: niche teardown (15 sites) + culture/palette/type research. Evidence: docs/DESIGN.md "Research it stands on".
- [x] 2. Rate engine rebuilt from the correctly read Canada Post sheet. PASS: node tools/test-rates.mjs -> "PASS 2598/2598".
- [x] 3. Fake catalog: 101 products, 7 categories, real price bands and weights. PASS: node tools/check-catalog.mjs.
- [x] 4. Tokens v2 (coal, jewels, ember; Lalezar + Readex Pro). PASS: node tools/contrast.mjs -> "ALL PASS (computed, 17 pairs)".
- [x] 5. Phone-first build: home, shop, product, cart, shipping, postal sheet, dock. PASS: node tools/capture.mjs -> 16 captures, 0 overflow; looked at 390 and 1440.
- [x] 6. Calculator heavy test + fixes. PASS: tools/verify-sheet.py "PASS 988/988"; node tools/test-rates.mjs "PASS 2598/2598"; node tools/e2e.mjs "PASS 36/36". Fuzz: 6 of 33.9M checks fail, all the repacking limit above.
- [x] 7. Direction 3 tried and vetoed; direction 2 restored (ruling in docs/DESIGN.md).
- [x] 8. Flair pass 1: line-up, hand-set stickers, view transition, buy dock, responsive images.
- [ ] 9. Phone audit on real device sizes (one agent at a time: laptop load) and fixes.
- [ ] 10. Technical signature move (hero) from the technical seat's spec; 60 fps on phones.
- [ ] 11. Design review of direction 2 with flair; fix list applied.
- [ ] 12. Angel handout: platform + carrier recommendation, live-rate plan, questions, photo shoot spec.
