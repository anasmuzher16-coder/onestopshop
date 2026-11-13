# PLAN - One Stop Shop mockup (due to Angel 2026-11-14)
- [x] 1. Tokens: color, type, spacing as CSS custom properties (site/tokens.css). Verify: contrast script AA PASS.
  PASS: node tools/contrast.mjs -> "ALL PASS (computed)", 13 pairs, lowest 4.69:1 muted on surface.
- [x] 2. Rate engine: site/rates.js, quote(dest postal, parcels) -> carrier options, zone + dim-weight + surcharges from docs/SHIPPING.md. Verify: node tools/test-rates.mjs.
  PASS: node tools/test-rates.mjs -> "PASS 450/450"; calibrated to Canada Post SfSB level 4 sheet (docs/SHIPPING.md s.2).
- [x] 3. Catalog data: 24 realistic sample products (hookahs, accessories, frames) with weight + box. Verify: schema check.
  PASS: node tools/check-catalog.mjs -> "PASS 24 products, 4 categories, all fit their box" (first run caught 5 assembled-height misfits; model now ships disassembled).
- [ ] 4. Header + Door Tag (postal code entry, persists). Verify: 390/1440 screenshots.
- [ ] 5. Home page fold enacting the idea. Verify: 390/1440.
- [ ] 6. Catalog grid with delivered price per card + filters. Verify: 390/1440.
- [ ] 7. Product page: Spec Stamp, packing note, carrier options. Verify: 390/1440.
- [ ] 8. Cart with multi-box packing + live shipping choice. Verify: 390/1440 + rate test.
- [ ] 9. Shipping/returns page + regulated-goods note. Verify: 390/1440.
- [ ] 10. Impeccable pass + atelier:critique + design-reviewer agent; fix list applied.
- [ ] 11. Adversarial pass on the calculator (agent briefed to break it).
- [ ] 12. Angel handout: one-page summary of platform + carrier recommendation + questions.
