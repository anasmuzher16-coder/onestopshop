-- Shisha gets its own jewel (2026-11-26): chartreuse, the band colour of the owner-approved still shisha-a6. Until now Shisha
-- shared Hoses' emerald. The token is --chartreuse in public/tokens.css ([data-tone="chartreuse"]); the band's near-black title
-- reads at 12.2:1 on it. Apply this with the code that carries the token: an older build has no chartreuse rule and would show
-- the band with no colour. Safe to run twice. Rollback: UPDATE categories SET tone = 'emerald' WHERE id = 'shisha';
UPDATE categories SET tone = 'chartreuse' WHERE id = 'shisha' AND tone <> 'chartreuse';
