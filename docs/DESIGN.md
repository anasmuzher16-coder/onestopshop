# DESIGN - One Stop Shop, direction 2 (2026-11-13)
Direction 1 (cream paper, line drawings, label red) was rejected by Anas the same day: "basic, no swag, no
flavour", not grounded in research. It was designed before any look at the niche. This replaces it.

## Research it stands on
- Niche teardown, 15 live sites (scratchpad niche/TEARDOWN.md + screenshots): the category reflex is a cut-out
  hookah on a white or grey tile, in either black-and-gold or white-plus-one-deal-colour, default sans type.
  Nobody uses ember, jewel or spice colour. Nobody promises unbroken arrival. Canadian shops gate free
  shipping by province and hide the real cost until checkout.
- Culture research (niche/CULTURE.md): the object's own colours are Bohemian glass jewels, Egyptian brass,
  ember. Rule taken from it: one jewel per surface, used flat, no arabesque wallpaper, Arabic lettering as
  the hero, no camels/falcons, no people smoking (TVPA lifestyle-advertising limits).
- His brand register (life/dijji/BRAND.md): the colours pop.

## Brief, changed lines only
4. Category default: white tile packshots; black and gold; shipping revealed at checkout.
5. Idea: THE PRICE LANDS AT YOUR DOOR (unchanged). The store re-prices itself to the visitor's postal code.
6. Register: loud, warm, night. Streetwear poster energy on a coal ground. Phone first.

## Device: THE STICKER
A round counter price sticker, tilted, ember red, carrying the delivered price and days. It sits on every
product tile and is the only round, only tilted, only ember thing on the page besides the primary action.
Provenance: the shop's mechanics (a counter price gun) crossed with the ask (shipping). It also generates
Instagram price cards, box labels and packing tape. Before a postal code is known the sticker is an empty
outline asking for one, so the page visibly completes itself when the code goes in.

## System
- Colour: coal chassis (hue 50). Six jewels, one per tile, flat. Ember = sticker + primary action only.
  Gilt is used for Arabic display lines. 17 pairs computed AA: node tools/contrast.mjs.
- Type: Lalezar (Arabic + Latin, one poster weight) for display and prices; Readex Pro for UI. Both OFL.
  Arabic strings need a native read by Angel before anything ships.
- Layout: phone first. Bottom dock (Shop / postal code / Cart) is the chassis on phones; the top bar takes
  over at 960. Product tiles 4:5, two columns on a phone, up to five on wide screens.
- Photos: packshots multiply onto the jewel tile so white backgrounds vanish. Product pages use a 38% tint so
  the real finish reads. ALL PRODUCT PHOTOS ARE PLACEHOLDERS pulled from retailer feeds (his instruction
  2026-11-13); they are replaced by the shop's own photos and must not go on a public URL as they are.
- Motion: two moves. The ticker (one hookah priced to twelve cities, ambient, pauses on hover, static under
  reduced motion) and the sticker slap when a postal code is set (480ms, once).

## Correction, same day (his words: "The shipping calculator isn't meant to be a focus for consumers, it's just a
feature the owner of the shop really wanted"; "why do you keep focusing on Halifax?")
I had made shipping the idea of the whole site and used my own test postal code (Halifax) in every capture.
Changed: the site is about the products and the shop. Hero sells the hookahs. The sticker carries the shop's
price only. The postal code is asked for only where shipping matters: a "Shipping estimate" block on the product
page, the cart, and the shipping page. No postal button in the top bar or the dock. The ticker lists what is
on the counter (materials), not delivered prices. Captures now run with no postal code except product/cart
shots (Toronto, as an example only).
Idea, restated: THE COUNTER, ONLINE. Device: the price sticker (the counter's price gun), unchanged in form.

## Direction 3 (2026-11-13 evening): THE COUNTER, CURATED
His words on direction 2: "not sure I'm a fan of the blocky look, it somewhat looks similar to hmbarbershop.com,
I want it to feel more curated". Checked against a capture of hmbarbershop.com: shared DNA was near-black ground,
giant white display type over a full-bleed photo, hard rectangles, red accent. All four are gone.
- Device: THE NICHE. Every product stands in an arched display niche (pale sand), numbered like a piece
  ("No. 027"). Provenance: the shop's own form (things on a counter, shown one at a time) and the arch of the
  niche a hookah sits in at a lounge. It generates the hero, the grid, the collection thumbnails, the cart
  thumbnails and print (a numbered tag per piece).
- Colour: deep jewel grounds, one per collection (emerald hookahs, teal bases, midnight bowls, oxblood heat,
  forest hoses, aubergine parts, umber frames). The page ground changes as you move between collections.
  Gilt is the one accent: Arabic display lines, link underlines, the cart count.
- Type: Bodoni Moda (display; the perfume-house register the shop already sells in) with italic for the one
  emphasis; Aref Ruqaa for Arabic display; Readex Pro for UI. Rounded pill controls, no hard rectangles.
- Layout: fewer pieces per row (2 on a phone, 3 on desktop), staggered picks, collections as a ledger list
  rather than colour blocks, a floating pill dock on phones.
- Motion: one quiet move, niches rise into place once when first seen. Reduced motion shows them in place.

## RULING 2026-11-13 late: direction 3 is dead, direction 2 stands
His words: "Direction 3 is far worse ... By curated I meant that I wanted it to feel special. I liked the previous
direction, it was way better, we just have to give it more flare ... the new one is trash."
Do not reopen the arch/serif/green look. Direction 2 (coal, jewel tiles, Lalezar, price stickers) is the base;
the work is flair, phone quality and technical craft on top of it.
Added since: the line-up (a dozen hookahs on one shelf, drawn to scale, a thing none of the 15 competitor sites
show); stickers set at their own angle per product; the tapped tile travels to the product page (View
Transitions); the phone dock becomes a buy bar on product pages; responsive tile images; static grain texture
instead of a live SVG filter (cheaper on phones).
Calculator (heavy test, 200,000 random carts): price table matches the PDF in all 988 values; fuel is now the
published weekly rate (41.2% for Nov 9-15, 2026), was wrongly the 25% floor; Regular Parcel added; money in
whole cents. Known limit: in carts of 40+ loose parts, adding an item can repack and lower shipping (40 of
200,000 carts, worst $7.31). Each quote is still the true price of the packing shown.

## AS BUILT 2026-11-15 (the store, store/public). Where this file and the store disagree, this section wins.
Live: https://onestopshop-store.anas-dev.workers.dev (the old mockup address redirects to it). The mockup in
site/ is frozen history; everything above describes how the look was reached, not what ships.
- Base: direction 2, unchanged. Coal ground, flat jewel tiles, Lalezar + Readex Pro, price-gun labels.
- Dropped by his rulings since: the scrolling ticker (no tickers), Arabic lettering ("pull the arabic for
  now"), multiply or any blend mode over photos, white grounds behind photos.
- Photos: cut-outs sit straight on the jewel tile. Opaque photos get the plain tile (.tile--photo). All
  photos are still stand-ins; five products are hidden until the shop supplies its own.
- Motion, three layers, each with a reduced-motion still:
  1. Smoke (fx-smoke.js): strongest in the hookah section, his ruling.
  2. Page bands (fx-sections.js FX): every page opens with a header band holding one drawn object that does
     one act (bowl, hose, gift box and so on). Drawings live in tools/objects-r5.txt and objects-pages.txt
     and are built into fx-objects.js by tools/build-objects.mjs. Never edit fx-objects.js by hand.
  3. Product acts (fx-sections.js ACT): one act per section on the product photo. RULE: no act is aimed at
     a feature of the piece. An act may use only the box the piece fills, its outline as a mask, and the
     tile, so any photo the shop uploads later works with no tuning. Hookahs get smoke only.
- Phone and desktop ship together and are checked in Safari's engine with an iPhone profile as well as
  Chrome at 390 and 1440 (tools/webkit-check.mjs, ENGINE=webkit on the fx tools).
- Checks: tools/fx-robust.mjs, e2e.mjs, phone-audit.mjs, smoke-http.mjs. Frame sheets for judging motion:
  tools/fx-sheet.mjs (section bands), fx-pages-sheet.mjs (page bands), fx-piece-sheet.mjs (product acts).
