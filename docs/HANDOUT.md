# One Stop Shop online store: mockup notes for Angel

Preview: https://onestopshop-preview.anas-dev.workers.dev
Everything on it is a sample: the products, prices and photos are stand-ins until we have yours.

## What the mockup shows
- A store for hookahs, bases, bowls, heat keepers, hoses and parts, built for phones first.
- Browse by type, search, build a set piece by piece, gifts by budget, a cart with a gift note.
- A shipping price for any Canadian postal code, worked out from the weight and the box size of what is in the cart.
- Free pickup at the shop as an option beside shipping.

## How the shipping price works
- The customer types a postal code. We pack the cart into boxes, then price each box by distance and by weight or size, whichever is greater.
- The numbers come from Canada Post's small business price guide, plus this week's fuel charge and glass cover on orders over $100.
- Sample, all in before tax, shipped from Windsor by Regular Parcel:
  - A tall $649 hookah: Montreal $56.68, Halifax $60.24, Vancouver $74.96.
  - A single hose: Toronto $15.89, Vancouver $31.36.
- Box size matters more than weight. A tall hookah in a slim box bills at about half of what a wide box does.

## How it stays correct once live
- Canada Post changes its fuel charge every week, so a fixed table goes stale.
- The live store will ask Canada Post for the price at checkout, using your own account, so the customer pays what you are billed.
- The table in the mockup stays as a backup for the rare moment Canada Post does not answer.
- We tested the mockup's math against the price guide: 988 of 988 prices match, and 2,328 of 2,328 order checks pass.

## Carrier recommendation
- Start with Canada Post on a Solutions for Small Business account. It reaches every address in Canada and its prices are published.
- Add Purolator as a second option once the store is live and we can compare real quotes on heavy boxes.

## What can and cannot ship
- Hookahs, glass, bowls, hoses and parts ship anywhere in Canada.
- Federal law does not allow shisha tobacco to be sent to another province, or advertised that way, so the store does not list it.
- Charcoal and vapes are left out until a carrier confirms in writing that it will take them.

## What we need from you
1. The shop's street address and hours as you want them shown.
2. Your product list with prices. A spreadsheet or a supplier list is fine.
3. Weights and box sizes. We only need one of each kind of product weighed and measured in its shipping box, then the odd ones.
4. Photos. If you have them, send the largest files. If we shoot new ones: plain white or grey background, the whole piece in frame, straight on, one piece per photo.
5. Who packs the orders, and how many days a week parcels can go out.
6. The web address you want, and who holds the login for the current GoDaddy site.
7. A Canada Post business account number, or a yes for us to help set one up.
8. Whether you want Arabic on the site. If yes, we need someone to write or check it.

## What happens next
- You tell us what to change on the mockup.
- We load the real products and photos, connect live Canada Post prices and payments, and test real orders before launch.
