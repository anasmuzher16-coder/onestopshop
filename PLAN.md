# PLAN - One Stop Shop mockup (due to Angel 2026-11-14)
Direction 1 was vetoed 2026-11-13 (basic, colourless, not researched). Plan restarted on direction 2 (docs/DESIGN.md).
- [x] 1. Research: niche teardown (15 sites) + culture/palette/type research. Evidence: docs/DESIGN.md "Research it stands on".
- [x] 2. Rate engine rebuilt from the correctly read Canada Post sheet. PASS: node tools/test-rates.mjs -> "PASS 2598/2598".
- [x] 3. Fake catalog: 101 products, 7 categories, real price bands and weights. PASS: node tools/check-catalog.mjs.
- [x] 4. Tokens v2 (coal, jewels, ember; Lalezar + Readex Pro). PASS: node tools/contrast.mjs -> "ALL PASS (computed, 17 pairs)".
- [x] 5. Phone-first build: home, shop, product, cart, shipping, postal sheet, dock. PASS: node tools/capture.mjs -> 16 captures, 0 overflow; looked at 390 and 1440.
- [ ] 6. atelier:critique + design-reviewer agent on direction 2; apply fix list.
- [ ] 7. Impeccable detector + polish pass.
- [ ] 8. Adversarial pass on the rebuilt UI (cart states, postal sheet, keyboard, reduced motion).
- [ ] 9. Performance: image weights on mobile data, LCP image preload, no layout shift.
- [ ] 10. Angel handout: platform + carrier recommendation, live-rate plan, questions, photo shoot spec.
