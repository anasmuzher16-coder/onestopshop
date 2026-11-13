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
