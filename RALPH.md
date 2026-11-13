# RALPH LOOP - One Stop Shop mockup
Each turn, do exactly this:
1. Read PLAN.md. Take the FIRST unchecked item. Do only that item.
2. Verify it with the command named on the item (or `node tools/check.mjs` if none).
   Anything visual: screenshot at 390 and 1440 and look at both before ticking it.
3. Tick the item in PLAN.md with the evidence (command + one-line output). If it failed,
   write FAIL and why under the item and stop the turn; do not tick.
4. Commit by name (never -A): `git add <files>; git commit -m "<what>"`.
5. Append one line to docs/LOOP-LOG.md: turn number, item, PASS/FAIL.
Rules: brief = life/dijji/clients/one-stop-shop/PROJECT-2026-11-13.md section 6-7 (idea:
THE PRICE AT YOUR DOOR, device: Door Tag + Spec Stamp). No scraped images. Every shipping
number cites its source in docs/SHIPPING.md. Deploying and sending are his.
Done when: every PLAN.md item is ticked AND the final critique scores >=4 on all criteria.
