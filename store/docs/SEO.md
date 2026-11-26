# Search and sharing (2026-11-24)

What search engines, maps and link previews read about the store, why each piece is built the way it is, and the
two switches that turn it on at launch. Code: `src/seo.js` (everything below), `src/worker.js` (wires it into each page),
`tools/photo-versions.mjs` (per-photo versions), `tools/test-seo.mjs` (the checks), `tools/test-golive.mjs` (the launch
settings proved on three local copies: the domain, the workers.dev address and the bare domain).

## Launch: the switches

1. Set `SITE_ORIGIN` in `wrangler.jsonc` to the shop's own address, `https://<domain>` (no path, no slash).
2. Set `LIVE` to `"1"`.
3. Nothing to change in `public/_headers`: its noindex rule names the workers.dev addresses only
   (`https://:preview.anas-dev.workers.dev/*`: the demo and its preview and version addresses), so photos, fonts and
   scripts on the shop's own domain can be indexed (Google Images, merchant listings) while the demo's stay out. Worker
   answers set their own header. Known gap, accepted: once the domain is attached and before LIVE is "1", its static
   files (photos) carry no noindex; its pages still do, so nothing on it is listed as a page. Flip LIVE soon after.
4. Deploy, then in Google Search Console add the domain, submit `https://<domain>/sitemap.xml`, and run the Rich Results
   Test on the home page, one item on sale and one Price TBD item (it is online-only, so it is not part of the suites).
5. Re-scrape the home page and one product in Facebook's Sharing Debugger so the first shares use the shop's own address.

What changes on its own when the switches flip: the `<meta name="robots">` tag and `X-Robots-Tag` header go away on
indexable pages, `/sitemap.xml` answers, `robots.txt` names it, and canonical, `og:url` and every structured-data address
use `SITE_ORIGIN`. The `workers.dev` address keeps `noindex` and points its canonical at the domain, so the two copies
never compete. Until both switches are set, every page says `noindex, nofollow` and there is no sitemap; redirects, errors, API answers
and uploaded photos carry the same `X-Robots-Tag` (worker.js `demoNoindex`); static files carry it on the workers.dev
addresses only (step 3).
`SITE_ORIGIN` must be exactly `https://host` (one trailing slash is forgiven). Left empty, the request's own address is
used, except that a `*.workers.dev` address is never indexable whatever the settings. Set but malformed (no scheme, `http`, a port or a path), it fails closed: nothing is indexable anywhere and the
Worker logs the problem, so a typo can never put the workers.dev copy into search.

## Rulings built in (owner)

- Never a supplier price. The catalogue the pages read (`loadCatalog`) does not select the supplier price column, and
  `test-seo` checks every Ace page against the master file's supplier prices.
- No price for Price TBD items: no Product data, no `Offer`, no price in the written content or the descriptions, the
  words "Price TBD" instead. A Coming soon item (the shop has set its price but not switched it on) shows that shop price
  with "coming soon", exactly as its page sticker does, and also gets no Product data or `Offer`. An item is offered
  only when it is switched on with the shop's own price (`sellable`).
- Availability only from the shop's own count: `InStock` when stock is above 0, else `OutOfStock`. Never assumed.
- No ID or age wording and no health claims: nothing new is said about products. The written content repeats the
  product's own name, description and price line exactly as the page shows them.

## 1. Content in the HTML (JavaScript SEO)

The store draws its pages with JavaScript into an empty `<main>`. Google can run scripts, but "not all bots can run
JavaScript" and server-side rendering "is still worth doing" [G-JS]. The Worker now writes a plain copy of each page's
content into `<main>`: home (the shop, its sections, address and phone), Everything (each section with its first items),
each section (one entry per item a shopper sees, with its photo, name and price or "Price TBD") and each product (trail,
name, photo, description, price line, how it is delivered).

It does not change how the page looks (checked with screenshots at 390 and 1440, JavaScript on and off). A style in the head hides `.ssr` before the body is parsed, and the page's own
render replaces `<main>` the moment it runs, so nobody with JavaScript ever sees it. Without JavaScript a `<noscript>`
style shows it. Its pictures are `loading="lazy"` inside a hidden block, so browsers never download them for people;
crawlers read the addresses from the HTML. `#main` keeps its full-screen height while only the copy is in it (the same
rule as `#main:empty`), so the footer never jumps. Google renders the page, so what it indexes is the same content the
page draws; nothing is shown only to crawlers.

Robots: the page needs `/api/catalog-module` to draw its shelves and `/api/photo/*` for uploaded photos, so both stay
crawlable even though `/api/` is disallowed: "Google Search won't render JavaScript from blocked files" [G-JS].

## 2. Structured data (JSON-LD)

- **Store** on the home page [G-LB]: name, full postal address, coordinates (Google wants at least 5 decimals), phone with
  country code, `url`, `image`, `openingHoursSpecification` built from `SHOP_HOURS` in `public/rates-core.js` (the same
  hours the checkout uses, one object per group of days, `hh:mm`), Instagram and TikTok as `sameAs`, and the merchant
  return policy. Store is the specific LocalBusiness subtype Google asks for.
- **Return policy**: `MerchantReturnNotPermitted`, country CA, on the Store (merchant level; a product-level policy is
  only for overrides [G-ML]). The terms say all sales are final except faulty, wrong, damaged or undelivered items; those
  are legal remedies, not a return window, so "returns not permitted" is the honest category.
- **Product** on the page of every item on sale (only those: see Offer below): name, sku, url, description (the shop's own words), image (the product photo), brand only where the record has one (charcoal and shisha; Ace items carry other brands' names that the
  shop has not confirmed, plan section 8, so none is stated).
- **Offer**, only for items on sale: `price` (shop price, two decimals), `priceCurrency` CAD, `availability`,
  `itemCondition` New, `url`, `seller` and `availableAtOrFrom` (the Store), `availableDeliveryMethod` OnSitePickup, plus
  ParcelService for items that ship. Merchant listings require an Offer with a price above zero [G-ML], and product
  snippets require an offer, a review or a rating [G-PS]. The shop collects no reviews, so a Price TBD or Coming soon
  item gets no Product data at all (a Product with none of the three is reported as an invalid item). Its name,
  description and photo are still in the page and the written content, and its breadcrumbs are marked up.
- **Shipping details are not marked up.** Google's `OfferShippingDetails` needs a fixed rate, destination and delivery
  time [G-ML]; ours are live Canada Post quotes and a distance-priced local delivery. Stating a rate we do not charge would
  be worse than none. Set shipping in Merchant Center if the shop opens a merchant feed.
- **BreadcrumbList** on section and product pages (Home > Shop > section; Home > section > item), absolute addresses,
  the last one the page's canonical.
- **Hookah colours**: each colour has its own address, but the colours share one description and Ace's colour names are
  not confirmed, so every colour's canonical is its family's lead colour (the card in the shop) and only that one is in the
  sitemap. One exception: a colour on sale whose lead colour is not (Price TBD or coming soon) keeps its own canonical and
  sitemap entry, so its offer is never stated at a page without one. Google's variant guidance allows a single canonical for a group whose variants are chosen on one page [G-VAR].
  When the shop confirms colours and prices, switching to per-colour canonicals with `ProductGroup` is a small change in
  `canonicalSku` and `productLd`.

Validation: Google's Rich Results Test only runs online, so `tools/test-seo.mjs` checks every JSON-LD block offline
against schema.org's own vocabulary (`tools/fixtures/schema-org-subset.json`, cut from
`https://schema.org/version/latest/schemaorg-current-https.jsonld` on 2026-11-24): every property must belong to its type
or a parent type, and every enumeration value (`availability`, `itemCondition`, `returnPolicyCategory`,
`availableDeliveryMethod`, `dayOfWeek`) must be a real member. It also checks Google's required fields.

## 3. robots.txt and the sitemap

`/robots.txt` (Worker route) disallows `/admin`, `/api/` (except the catalogue module and photos), `/account` and
`/checkout` (written `/account$` and `/account/`: a bare prefix would also block `/account.js` and `/account.css`, which
every page loads, and Google would render a blank page; `test-seo` checks every file a page loads is allowed), and names the sitemap only when live. It never blocks the whole site: a page blocked in robots.txt can still
be listed from links because the crawler "will never see the noindex rule" [G-NOINDEX], so the demo relies on `noindex`
on every page instead. For the same reason `/cart` and `/order/` are not blocked: the cart is linked from every page, so
it stays crawlable and its `noindex` is seen. The trade-off on `/account` (also linked from every page) is accepted as
briefed: it is disallowed and `noindex`; if Search Console ever lists it as "indexed, though blocked by robots.txt", drop
its Disallow line and let the `noindex` work.

`/sitemap.xml` exists only when live on the shop's own address. It lists only indexable pages, absolute and canonical
[G-SM]: home, Everything, each section with something on view, Build a set, shipping, terms, privacy, and each item a
shopper can open (one per hookah family). Never cart, checkout, account, search, gifts or order pages. No `priority` or
`changefreq` (Google ignores them [G-SM]) and no `lastmod` (only worth sending when accurate [G-SM]).
Charcoal has its own section since 2026-11-24, so `/shop/charcoal` is listed like any section with something on view. The
old charcoal links into Heat (`/shop/heat?find=...`, `?type=box`, the per-piece sorts) answer `301` to the same view in
Charcoal and are never listed: a sitemap holds only final, canonical addresses. Plain `/shop/heat` (foil and heat
management) stays listed.

## 4. Share images (Open Graph)

Unchanged from the live site (0d6ac11): an item with an uploaded photo (back office) shares that photo as it is, so a
preview never shows the static photo it replaced; any other item with a photo shares its own photo
(`img/pc/<photo>.webp`); everything else (home, sections, items without a photo) shares the shop's card `img/share.jpg`,
the same file the live site serves. `/api/photo/*` also answers `HEAD`, which preview crawlers use.

Every page states `og:image` (absolute), `og:image:alt` [OGP], `og:url` equal to the canonical, `og:locale` en_CA and
`twitter:card` summary_large_image; the shop's card also states its type and 1200 x 630 size (so the first share renders
at once [FB]).

**Parked: the share-card generator.** A per-product 1200 x 630 card (`tools/build-share.py`, the redrawn card on a bone
ground with the price-gun label) was built on `seo-launch` (52db2f1). It was REVISE or REJECT in four design reviews and
uses a cream ground the owner has vetoed, so by his rule no new share card ships until he gives references and approves a
still. It is not in this build: the script, its `img/share/` cards and its redrawn `img/share.jpg` stay on that branch
only, and `test-seo` fails if any of them reappears or if `img/share.jpg` stops matching the live file. Open questions
for that round are in the branch's own SEO.md.

## 5. Per-photo versions

Every photo used to share one version number (`?v=1794615693` in `app.js`), so changing one photo made every phone
download every photo again. `node store/tools/photo-versions.mjs` (run after any photo change) records a short hash of each photo's files in `src/img-versions.json`; the
catalogue hands it to the page as `iv` and the page asks for `img/pc/<photo>.webp?v=<iv>`. A changed photo gets a new
address and nothing else moves. Photos without an entry keep the old shared number. The home hero preload uses the same
address as the page, so the browser reuses that download.

## 6. The public catalogue feed (`/api/catalog`)

It was rebuilt as JSON on every request with `public, max-age=30`, so a browser could show stock 30 seconds old. It is now
written once per copy of the catalogue (the same shared copy the pages use) and tagged: `Cache-Control: no-cache` with an
`ETag`, so a reader always checks and an unchanged feed answers `304` with no body (a list of tags in `If-None-Match`
works too). Only public fields go out (an allowlist); items off sale show stock 0; Price TBD items show no price (a
Coming soon item keeps its shop price, as on its page); the import's placeholder weights (1 g, 2,500 g for unweighed
hookahs) are `null`: unknown is not a fact. Section descriptions no longer say "in stock": they counted sold-out items.

## 7. "Show more" after 48 cards: not built

The polish branch (`polish-2026-11-24`, commit 8ab16fa) draws long sections in steps: the first screen at once, the rest
as slots filled in idle moments, with Back landing on the remembered card. A "Show more" cut would fight that queue and
its scroll restoration, so it is left out here; if still wanted, it belongs in that render code after the merge.

## Sources

- [G-JS] Google Search Central, JavaScript SEO basics: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- [G-ML] Merchant listing (Product, Offer) structured data: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- [G-PS] Product snippet structured data: https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- [G-VAR] Product variant structured data: https://developers.google.com/search/docs/appearance/structured-data/product-variants
- [G-LB] Local business structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business
- [G-SM] Build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- [G-NOINDEX] Block indexing with noindex: https://developers.google.com/search/docs/crawling-indexing/block-indexing
- [OGP] The Open Graph protocol: https://ogp.me/
- [FB] Meta for Developers, images in link shares: https://developers.facebook.com/docs/sharing/webmasters/images/
- schema.org vocabulary: https://schema.org/version/latest/schemaorg-current-https.jsonld
