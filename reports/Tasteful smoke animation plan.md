# Turning the approved mockup into a working store

Research read on 2026-11-14. Prices are Canadian dollars unless marked USD. Labels used throughout: **INFERENCE** (our reasoning, not a sourced fact), **SNIPPET** (seen only in a search-result excerpt), **THIRD-PARTY** (not the company's own page), **COULD NOT VERIFY** (no primary source reached). Everything carrying one of those labels is collected again in the last section. This is research, not legal or tax advice.

## One-page summary

**The recommended path.** We keep the approved front end and its look, and build a small custom back end beside it on the same Cloudflare platform: a database for products, stock and orders (Cloudflare D1), file storage for photos (R2), a login wall for the owner's admin that needs no password code (Cloudflare Access), a hosted card form from a payment processor so card numbers never touch our servers, live Canada Post rates and labels through Canada Post's new JSON developer portal, and order emails through a mail service. Nothing here is a template: the storefront and the admin stay bespoke, and only payments, email and the carrier are adopted services. The running cost floor is **US$0 to US$5 a month** for Cloudflare ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) plus card fees of about **2.9% + $0.30** per order if Stripe approves the shop ([Stripe pricing](https://stripe.com/en-ca/pricing)). The real store is a new, separate site. The existing workers.dev preview is not touched.

**Smoke and motion.** Of 16 hookah sites we could reach, one shows real smoke, as a 2023 video, and none draws smoke in code ([Shishabucks](https://www.shishabucks.com/)). Small, backlit smoke that belongs to one product and works on a phone is unclaimed in the niche. We build it as one tiny hand-written graphics program (a "fragment shader") drawn at low resolution behind the product, with a slow image drift and a still image as fallbacks. Our current tools are enough. What changes is how we review motion: recorded frames, contact sheets, a frame-difference number, and a frame-time readout on the real iPhone.

**Build order.**

| Phase | What gets built | Gate to pass before moving on |
|---|---|---|
| 0 | Paperwork and answers: processor approval in writing, Canada Post accounts, domain login, which till system the shop uses | One processor says yes in writing |
| 1 | Foundation: new site with test and live copies, database, real page addresses, admin login | Test suite green on the new site |
| 2 | Owner admin, first version: products, photos, stock ledger, orders, home screen | Owner adds a product from his phone unaided |
| 3 | Checkout: server-side totals, payment, tax by province, order emails, policy pages | Real test orders in every tax zone, a refund, a declined card |
| 4 | Canada Post live: rates with fallback, labels, tracking, pickup orders, packing flow | Quoted price equals label price on test parcels |
| 5 | Cologne and misc sections, front and back | Canada Post acceptance terms in writing, supplier paperwork on file |
| 6 | Motion and smoke polish (a small phone test of the smoke runs back in phase 1) | Holds frame rate on the iPhone 16 Plus, Low Power Mode on and off |
| 7 | Hardening and launch: security, backups rehearsed, move off GoDaddy | Launch checklist complete |
| 8 | First 30 days and the care plan | Restore drill and owner check-in done |

**The five biggest risks.**

1. **Payment approval.** No processor names hookahs, but each has a nearby clause an underwriter could apply, and the outcome turns on which merchant category code the shop is given ([Stripe restricted businesses](https://stripe.com/en-ca/legal/restricted-businesses), [Square payment terms](https://squareup.com/ca/en/legal/general/payment), [Helcim policy](https://legal.helcim.com/ca/acceptable-use-policy/)). We get a written yes before building checkout, and keep a second processor approved.
2. **Cologne cannot ship until Canada Post says so in writing.** Alcohol-based perfume is non-mailable for the general public; it moves only under an acceptance program whose terms are not published ([Canada Post dangerous goods overview](https://www.canadapost-postescanada.ca/cpc/en/support/articles/non-mailable-matter/dangerous-goods-overview.page)).
3. **Google's shopping channels are closed to most of the catalogue.** Merchant Center names hookahs and pipes as not allowed ([Merchant Center policy](https://support.google.com/merchants/answer/6150004?hl=en)). Ordinary search results and the Google Business Profile carry the load instead, and today's "#/" addresses cannot be indexed at all until we change them ([Google URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure)).
4. **Glass breakage is probably not covered by the carrier.** THIRD-PARTY reports quote Canada Post's terms as excluding damage to fragile items ([Insurance Business](https://www.insurancebusinessmag.com/ca/news/breaking-news/canada-post-claims-insurance-does-not-cover-fragile-items-60956.aspx)). The coverage our mockup charges for likely protects against loss, not breakage. The shop needs its own breakage policy.
5. **One developer, many accounts.** If the domain, Cloudflare, payment or carrier accounts sit in the studio's name, the shop cannot run without us, and a lost GoDaddy login is the slowest item in the whole move ([GoDaddy account recovery](https://www.godaddy.com/help/regain-access-to-my-domain-or-my-godaddy-account-4043), SNIPPET).

**Decisions needed from the studio owner** (detail near the end): which processor to approach first; pay the US$5 Cloudflare plan from day one; whose Cloudflare account hosts the store; hosted payment page or embedded form; mail provider; whether to keep a dormant second carrier; the smoke placements; whether cologne launches with the store or after; the care plan price.

---

## Smoke that belongs to one product is unclaimed in the niche

### What the niche and its neighbours actually do

We scanned the homepages of hookah makers and retailers and found motion in only two forms. Premium makers run one looping hero film, usually black and white: a craftsman at a bench ([Moze](https://mozeshisha.de/de/)), lifestyle on a lawn ([Steamulation](https://shisha-steamulation.de/)), a launch film and a 3D configurator ([Kaloud](https://kaloud.com/)). Retailers run a rotating banner slider and nothing else ([Hookah John](https://hookahjohn.com/), [MyHookah.ca](https://www.myhookah.ca/), [Shisha World Canada](https://shishaworld.ca/), [5StarHookah](https://5starhookah.com/)). **Exactly one site of the 16 reached shows smoke**: a slow-motion product video on black, with a file dated 2023 ([Shishabucks hero video](https://www.shishabucks.com/wp-content/uploads/2023/03/slow-motion-micro-main.mp4)). No site had a smoke-named element, a drawing canvas or generated smoke. A hardware-only retailer with any considered motion would stand alone among the stores checked (INFERENCE).

Limits of that scan matter: it read the raw page code without running a browser, looked at one or two frames per video, and covered homepages only. Effects added by scripts after load, and product pages, were not seen.

Adjacent premium categories behave the same way. Cigar, fragrance, whisky and premium device brands film the object in a dark or warm room and let any smoke be real and small: a faint wisp over a glass ([Cohiba](https://www.cohiba.com/)), a soft curl on the wall behind a bottle in firelight ([Maison Margiela product page](https://www.maisonmargiela-fragrances.us/fragrances/replica-eau-de-toilette/replica-by-the-fireplace/MM005.html)), landscape mist ([Ardbeg](https://www.ardbeg.com/en-gb)). Several luxury houses are fully static ([Byredo](https://www.byredo.com/ca_en), [Diptyque](https://us.diptyqueparis.com/en-us)). On award sites, smoke is a studio showpiece used as an image distortion, a pointer trail or a page wipe ([Awwwards smoke distortion example](https://www.awwwards.com/inspiration/smoke-effects-distortion-on-scrolling)). Those are desktop-pointer ideas that do nothing on a phone, and the pointer-trail version is now sold as a drop-in component ([Framer marketplace](https://www.framer.com/marketplace/components/liquid-smoke-cursor/)), so using it signals a bought part (INFERENCE).

Three things to stay away from, in order of how common they are (INFERENCE): the rotating promo slider, a stock "smoke on black" clip stretched across the hero, and a smoke trail that follows the pointer. The first is already ruled out by the approved design. No critic or gallery we found names smoke overlays as a cliche in so many words; that judgement is ours, drawn from templates and component shops.

### What makes smoke read as tasteful

The film and photography sources agree on a short recipe. Smoke looks good **lit from behind against dark**: "Side-lit smoke is not going to be nearly as visible as backlit smoke" ([Cinematography Mailing List](https://cinematography.net/edited-pages/CML-Shooting-smoke.htm)). Grey smoke on black reads as mud, and too much of it turns contrast into "little more than a gray blob" ([American Society of Cinematographers](https://theasc.com/blog/shot-craft/smoke-and-fog)). Smoke in front of a subject hides it ([RedShark](https://www.redsharknews.com/how-smoke-can-make-your-shots-look-magical)). On the interface side, motion at the edge of vision pulls the eye whether we want it or not, and repeated animation becomes "downright annoying" by the third viewing ([Nielsen Norman Group](https://www.nngroup.com/articles/animation-usability/)). No source gave a number for smoke speed, opacity or loop length.

Translated to our dark coal page, the rules we will build to are all INFERENCE from those sources:

| Rule | Why |
|---|---|
| Smoke sits behind the cut-out product, never over type, a price label or the product | Smoke in front lowers contrast and hides the subject |
| Brightest at its thin edges, nearly invisible in its body | "Backlit against dark", not a grey layer |
| Tinted with the jewel colour of the tile it sits on | Colour should come from the light in the scene; white on coal is the "murky" case |
| One wisp about the width of the product | A full-screen layer reads as weather |
| Rises from a source, slowly, with no visible repeat | Sideways drift with a seam has no source and no light |
| One place, one job per page | Smoke in four places is fog |
| The coal background stays coal where smoke sits | Lifting the background grey is the "light spilled on the backdrop" mistake |

The same sources tell us where "more animation" should go. Interface motion should usually be under 300 milliseconds and ease out ([interface design essay on great animations](https://emilkowal.ski/ui/great-animations)); most animations belong between 100 and 500 ms, and "at 500ms, animations start to feel like a real drag" ([Nielsen Norman Group on duration](https://www.nngroup.com/articles/animation-duration/)); frequent interactions should carry little or no motion ([Apple motion guidelines](https://developer.apple.com/design/human-interface-guidelines/motion.md)). We found no study linking animation to sales. The only conversion figures that surfaced were unsourced vendor claims and we do not use them.

Our shortlist, all INFERENCE, spends expressive motion on things seen once per visit and keeps frequent things nearly instant:

| Move | Where | Budget |
|---|---|---|
| Grid tile grows into the product page as one move | Shop to product | The strongest sanctioned use: shows continuity ([Chrome View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions)) |
| Price-label "stamp" when a price first appears or changes | Product page, variant switch | One shot, under 300 ms, uses the price-gun idea already in the brand |
| Add-to-cart confirmation on the item and the cart count | Everywhere | 200 to 300 ms, never blocks the action |
| "Lit, not idle" wisp from the selected product, which thins and stops | Product page | The smoke placement that carries meaning: this one is active |
| One slow hero wisp behind the single hero product | Home | Atmosphere only, allowed once because it is seen once |
| A short puff at the cart when an item lands | Cart | Under 500 ms; seen often, so it must be small |
| Staggered grid entrance | Once per page load only | Never re-run on scroll back or filter change |

Smoke as a page transition is the weakest candidate: it hides content and adds waiting, and the tile-to-page move does the same job better (INFERENCE). We found no shipped store using smoke as a state signal, so the "lit, not idle" idea has no precedent to copy.

Accessibility sets two hard rules. Any motion that starts by itself, lasts more than five seconds and sits beside other content needs a way to pause, stop or hide it ([W3C on WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)). And we honour the phone's "reduce motion" setting, where a fade is safe for everyone ([accessible animations guide](https://www.joshwcomeau.com/react/prefers-reduced-motion/)). A hero wisp that plays once and settles into a still frame avoids the pause control and looks more deliberate (INFERENCE). The choices that make smoke tasteful (small, thin, one place, one shot, behind the product) are the same ones that make it accessible.

### How we build it for iPhone Safari

We compared every practical way to put smoke on a web page. No source gave a measured frame time for any of them on an iPhone 16 class device, so every cost statement is a quoted source or our reasoning, and the phone test in phase 1 is what settles it.

| Technique | Download cost | Work per frame | Known iPhone Safari problems | Verdict |
|---|---|---|---|---|
| Hand-written fragment shader, no library | 0 KB of library | Low if drawn small; grows with pixel count | Graphics context can be lost on app switch; 30 frames a second in Low Power Mode | **Primary** |
| Same shader through the OGL helper | Core 8 kb per its readme ([OGL](https://github.com/oframe/ogl)) | Same | Same | Only if a second drawing pass is needed |
| Full fluid simulation | 11,244 bytes compressed, measured ([source file](https://raw.githubusercontent.com/PavelDoGreat/WebGL-Fluid-Simulation/master/script.js)) | Highest: 20 pressure passes every frame | No context-loss handling in the source | Too heavy, reads as a toy |
| three.js | At least 89,376 bytes compressed, measured ([three.js build](https://cdn.jsdelivr.net/npm/three/build/three.module.min.js)) | Same shader cost | Same | Not justified for one rectangle |
| Soft particles on a 2D canvas | 0 KB | Limited by overdraw; no phone benchmark found | 30 fps in Low Power Mode | Reads as puffs, not vapour |
| Animated SVG turbulence filter | 0 KB | Reported "really sluggish on iOS", tab reloads ([GSAP forum](https://greensock.com/forums/topic/33075-gsap-and-feturbulence-mobile-performance/)) | Open WebKit bug reports | Avoid |
| Slow drift of still smoke images in CSS | Image bytes only | Handled by the browser's compositor, no script | None found | **Fallback tier** |
| Sprite sheet (one image holding many frames) | Image bytes only | Compositor only; memory is the limit | None found | **Plan B if the shader look falls short** |
| Transparent video | 0 KB | Decoder only | Safari needs a format that was 3.4 MB against 1.1 MB elsewhere on one test clip; Low Power Mode blocks autoplay and shows a play button ([web developer write-up on transparent video](https://jakearchibald.com/2024/video-with-transparency/), [WebKit bug 219889](https://bugs.webkit.org/show_bug.cgi?id=219889)) | Avoid |
| Lottie or Rive | 46,396 bytes and up, measured ([Lottie light player](https://cdn.jsdelivr.net/npm/lottie-web/build/player/lottie_light.min.js)) | Vector runtime | Wrong tool for soft smoke | Avoid |

**The build, step by step** (the technique is sourced; the settings are INFERENCE to be tuned on the phone):

1. **The look.** One full-screen triangle and one shader using layered noise where one noise field bends another ("domain warping"), the standard recipe for fluid-looking smoke with no simulation ([Book of Shaders, chapter 13](https://thebookofshaders.com/13/), [domain warping reference](https://iquilezles.org/articles/warp)). A cheaper variant samples a small repeating noise image instead of computing noise per pixel, the approach a July 2026 tutorial used for fog ([Codrops](https://tympanus.net/codrops/2026/07/10/the-sleepers-creating-an-atmospheric-webgl-experience-with-lightweight-techniques/)).
2. **Draw small, stretch big.** The canvas keeps a fixed small internal size and CSS scales it up. Smoke is soft, so the stretch is invisible, and ignoring the phone's 3x pixel density alone saves at least nine times the work.
3. **No blend modes.** The shader outputs colour already multiplied by its transparency, and the canvas sits under the product cut-out using ordinary layering. This respects the rule that came out of the white-box bug.
4. **Three tiers.** Tier C, a still smoke image, is what everyone sees first and what "reduce motion" users keep. Tier B, two still images drifting and cross-fading very slowly in pure CSS, is used when the phone is throttled or the graphics context fails. Tier A, the live shader, fades in over the still only when the element is on screen, the tab is visible, motion is allowed and frames are arriving at full rate.
5. **Low Power Mode.** Safari caps script-driven animation at 30 frames a second in Low Power Mode on purpose ([WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745)), and a page cannot ask whether the mode is on. So the shader advances by elapsed time, never by frame count, and we time the first second of frames: if they arrive about 33 ms apart, we drop to tier B.
6. **Context loss.** Safari can discard a page's graphics context under memory pressure or after an app switch (THIRD-PARTY: [iOS Safari guide](https://abratabia.com/mobile-web-games/ios-safari-gotchas.php)). We add the two event handlers that rebuild it, and fall to tier B if rebuilding fails.
7. **Battery.** The drawing loop stops when the smoke is off screen, when the tab is hidden, and after the wisp has finished. Only one canvas ever runs.
8. **Fallback stills come from the shader itself.** We render a few frames, read the pixels and save them with the image tool already installed. Both paths then match, and there is no licence to read.
9. **Page moves.** The tile-to-page transition works in Safari from version 18, and scroll-linked CSS animation from Safari 26, so both go behind a support check with a plain fallback ([browser data for view transitions](https://github.com/mdn/browser-compat-data/blob/main/api/Document.json), [browser data for scroll timelines](https://github.com/mdn/browser-compat-data/blob/main/css/properties/animation-timeline.json)). The new graphics standard, WebGPU, shipped in Safari 26 but gains nothing for one small shader ([WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)).

If the shader reads as "vapour" where the brief wants "smoke", plan B is a pre-rendered loop turned into a sprite sheet. Blender 5.1.2 is already on the laptop and its output is ours to use, but scripted smoke bakes have a bug history ([Blender bug report](https://projects.blender.org/blender/blender/issues/87828)) and current status is COULD NOT VERIFY. A purpose-built simulator costs about US$300 on a THIRD-PARTY figure ([JangaFX pricing](https://jangafx.com/software/pricing)). We would only go there after the phone test says the shader look is not enough.

### Our current tools are enough; the review method is what changes

The survey of add-ons found nothing worth installing for one hero effect. No mature shader tool server exists, the Blender connectors run unguarded code and do not document simulation, and no published skill reviews animation. What we already have (Playwright, the Chrome DevTools connection, ffmpeg 9.0.1, the motion and WebGL design skills) covers the job. Two free upgrades are worth making: confirm Playwright is at version 1.59 or later, which adds an interface that hands timestamped frames to code ([Playwright Screencast](https://playwright.dev/docs/api/class-screencast)), and update the Chrome DevTools connection, whose current release documents video capture and processor throttling ([tool reference](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)).

The quality gain comes from five habits (INFERENCE): make shader time a setting so any frame can be reproduced; capture frames at fixed steps; tile 12 to 16 of them into one contact sheet we can actually look at; compute a frame-to-frame difference number to catch a pop, a freeze or a loop seam; and show a frame-time readout on the page behind a "?debug=1" address, read on the real phone with Low Power Mode on and off. There is no first-party way to inspect iPhone Safari from Windows, and the free bridge lists its timeline and canvas views as broken ([ios-safari-remote-debug-kit](https://github.com/HimbeersaftLP/ios-safari-remote-debug-kit)), so that on-page readout is our profiler. No tool judges taste. We can prove "no pops, no seam, holds frame rate"; the studio owner's eye on the iPhone 16 Plus is the final gate.

---

## The owner runs the shop from a phone-first admin on a US$0 to US$5 platform

### The platform under it

Everything a one-shop back office needs fits inside Cloudflare's free allowances at this size, and the paid plan is a flat US$5 a month.

| Piece | What it does for us | Free allowance | Paid plan (US$5 a month minimum) | Source |
|---|---|---|---|---|
| Workers | Runs our server code | 100,000 requests a day, 10 ms of processor time per request | 10 million requests a month, up to 30 s per request by default | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1 | The database: products, stock, orders | 100,000 row writes a day, 5 GB | 50 million writes a month | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| D1 point-in-time restore | Undo for the whole database | 7 days back | 30 days back | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| R2 | Photo storage | 10 GB a month, no download fees | US$0.015 per GB | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Image resizing | Right-sized photos per screen | 5,000 unique resizes a month | Then US$0.50 per 1,000 | [Images pricing](https://developers.cloudflare.com/images/pricing/) |
| Access | The admin login wall | 50 users | US$7 per user beyond that | [Zero Trust plans](https://www.cloudflare.com/plans/sase-zero-trust.md) |
| Web Analytics | Visitor counts, no cookies | Free | Free | [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) |

We recommend paying the US$5 from day one (INFERENCE): the free plan's 10 ms processor limit is tight for checking payment signatures and importing spreadsheets, and 30 days of database undo against 7 is worth the money alone. The existing image pipeline that cuts product photos onto transparency stays; originals go to R2, and a small fixed set of widths keeps resizing inside the free 5,000.

**Login without passwords.** Cloudflare Access emails the owner a one-time code that expires in 10 minutes, with no identity provider needed ([one-time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)). We write no password handling at all. The page for that login method does not itself say it is on the free plan (COULD NOT VERIFY; the plans page lists Access on Free). Passkeys work in about 95% of browsers ([caniuse](https://caniuse.com/passkeys)) but mean building enrolment and recovery ourselves, so they wait unless the owner finds emailed codes annoying.

### Build the small back end, adopt only payments, email and the carrier

| Option | Monthly cost | Cut of sales | Fit with a bespoke admin | Source |
|---|---|---|---|---|
| Our own back end on D1 plus a payment processor | US$0 to US$5 | Card fees only | Full | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Shopify Basic used only as a back end | $49, or $37 a month paid yearly | 2.8% + 30 cents; 2% more with an outside processor | Replaces our admin with theirs | [Shopify pricing](https://www.shopify.com/ca/pricing) |
| Square free plan | $0 | 2.8% + 30 cents online | Gives a till, catalogue and stock interface | [Square pricing](https://squareup.com/ca/en/pricing) |
| Medusa Cloud | From US$29 | 0% | Needs a second host; brings its own admin | [Medusa pricing](https://medusajs.com/pricing/) |
| Swell | From US$29 | 1% to 2% above a revenue ceiling | Takes a fee for what we are building | [Swell pricing](https://www.swell.is/pricing) |
| Snipcart | US$20 under US$1,000 monthly sales | 2% | Same | [Snipcart pricing](https://snipcart.com/pricing) |

Building wins on cost and on the brief (INFERENCE): every adopted back end either charges monthly, takes a percentage, or needs a separate server that Cloudflare does not host, and each would hand the owner someone else's admin.

### What the admin does, first version

The admired small-merchant admins share a few concrete moves. The home screen leads with tasks waiting and four numbers ([Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home)). Every stock change is recorded with who, when and why ([Shopify adjustment history](https://help.shopify.com/en/manual/products/inventory/managing-inventory-quantities/inventory-adjustment-history)). The phone app gives the owner four destinations in the bottom bar ([Square Dashboard app](https://squareup.com/help/ca/en/article/5618)). Dashboard guidance asks for a single glanceable screen, bars and lines over pies and gauges, and never colour alone to carry meaning ([Nielsen Norman Group on dashboards](https://www.nngroup.com/articles/dashboards-preattentive/)).

Our first version (the scope is INFERENCE from those patterns):

| Screen | What the owner sees and does |
|---|---|
| Home | "Needs you" first: orders to pack, items low or out. Then four plain-word numbers: sold today, orders, average order, running low, each with its period and a comparison in words |
| Products | Photo first from the phone camera, then name, price, stock. Variants as rows with their own price, stock, weight and barcode. Box size picked from saved presets, because the shipping price depends on it. Archive, never hard delete |
| Stock | A ledger of movements (sold, received, count correction, damaged) with who, when and why. The on-hand number is the sum, which gives an audit trail and an undo for free |
| Orders | List by status with a word and a colour (Paid, Packed, Shipped), packing slip, label button, refund with a note |
| How the shop is doing | Best sellers, slow movers, stock value at cost, days of stock left, sales by province, shipping charged against Canada Post cost paid |
| More | Spreadsheet export always; import for prices and counts; a tax report by province by month; the audit log |

The stock-insight formulas are borrowed from a documented source: sell-through is quantity sold divided by sold plus on hand over 30 days, and days of stock left is quantity on hand divided by average daily sales over 28 days ([Shopify inventory reports](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/inventory-reports)). "Shipping collected against shipping paid" is not a standard card in either reference product, but it falls straight out of our own order table (INFERENCE).

**Two buyers, one last item.** A single database statement that subtracts stock only if enough remains is safe because the database has one writer; a held reservation during checkout is the fuller version (INFERENCE from the documented behaviour of D1 batches, which run as one transaction: [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/)).

**In-store sales and the till.** This depends on a fact we do not have: which till system the shop uses. If it is Square, Square publishes stock interfaces and sends a notice when a counter sale changes a count ([Square inventory webhooks](https://developer.squareup.com/docs/inventory-api/webhooks)), so Square holds the counts and we mirror them, with a nightly full recount to heal missed notices (INFERENCE). If it is Moneris, we found no public stock interface ([Moneris developer portal](https://developer.moneris.com/moneris-go/docs/cloud-integration)), so our admin becomes the record and staff need a fast "sold in store" tap on the phone.

**Scanning barcodes.** The browser's built-in barcode reader works on Android Chrome but is "disabled by default" in iPhone Safari through version 27.2 ([caniuse](https://caniuse.com/mdn-api_barcodedetector)). iPhone scanning needs a small decoder loaded only when required; no specific library was verified. This is a later feature.

**Privacy.** The federal privacy law applies to any business handling personal information across provincial borders ([Office of the Privacy Commissioner](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/)). Quebec adds that technology which identifies, locates or profiles cannot be on by default ([Quebec privacy regulator](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25)). Cookie-less visitor counts, order-derived numbers from our own database and no advertising trackers keep the shop out of consent-banner territory (INFERENCE, not legal advice). The admin needs a per-customer export and delete action, and a breach log kept for two years ([breach reporting guidance](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/)).

---

## Cologne ships by ground only, and only after Canada Post agrees in writing

### What cologne changes for shipping

For the general public, alcohol-based perfume is not mailable: "Perfumes and toiletries with an alcohol base are considered dangerous goods (flammable liquids). So, they're not allowed in the mail stream" ([Canada Post packaging examples](https://www.canadapost-postescanada.ca/cpc/en/support/articles/abcs-of-mailing/examples-of-how-to-package-and-wrap-items.page)). Canada Post does accept it from contract customers and Solutions for Small Business cardholders under an "expanded acceptance program" for limited quantities, with details only by phone at 1-888-550-6333 ([dangerous goods overview](https://www.canadapost-postescanada.ca/cpc/en/support/articles/non-mailable-matter/dangerous-goods-overview.page)). Its commercial guide, effective October 1, 2026, sets the conditions: such goods "may only be shipped within Canada by ground using the Regular Parcel or Expedited Parcel services", and shipping them by air, to remote fly-in post offices or outside Canada is prohibited ([Canada Post customer guide, section 6](https://www.canadapost-postescanada.ca/cpc/doc/en/support/customer-guide/section_6_the_abcs_of_shipping.pdf)). The enrolment terms themselves are COULD NOT VERIFY: nothing is published about an agreement, a fee, mixed boxes or a flag in the shipping system.

The federal rule behind it is simple for bottles this size. Perfume is listed as UN1266 with a limited-quantity figure of **5 litres per inner container**, and a box is a limited quantity if it weighs **30 kg or less** and carries the limited-quantity mark, a square on point at least 100 mm a side, or 50 mm on small boxes ([dangerous goods regulations, section 1.17](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2001-286/page-4.html)). When those conditions are met, the document, labelling and training parts of the regulations do not apply; Transport Canada says training is not required "when you are using an exemption" ([Transport Canada FAQ](https://tc.canada.ca/en/dangerous-goods/safety-awareness-materials-faq)).

The catch for our build: **Canada Post's rating and label systems have no dangerous-goods field at all** ([Get Rates documentation](https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/rating/getrates/default.jsf)). The system will not stop a wrong choice, so the store must enforce the rule itself. For any cart holding a flammable item (design is INFERENCE):

| Rule the store enforces | Reason |
|---|---|
| Offer only Regular Parcel and Expedited Parcel; hide Xpresspost and Priority | Ground only |
| Refuse the item for remote fly-in postal codes, using Canada Post's published list as a blocklist | No air stage offices ([air stage offices list](https://www.canadapost-postescanada.ca/cpc/doc/en/support/air-stage-offices.pdf), SNIPPET: the list itself was not opened) |
| Keep each box at or under 30 kg | Limited-quantity cap |
| Print a packing note: apply the mark, leak-proof inner packing, absorbent material | Regulation and Canada Post packaging rules |
| A mixed cart takes the strictest item's service list | The cart's allowed services are the overlap of every item's |
| Weigh the packed bottle, not the liquid | The price is based on packed weight and box size |

If Canada Post enrolment fails, Purolator publishes that it "accepts Limited Quantity courier and freight shipments for ground transportation only", at up to 30 kg a package and with a dangerous goods surcharge ([Purolator limited quantity](https://www.purolator.com/en/shipping-dangerous-goods-limited-quantity-exemption)). One page listed that surcharge at $14.00 and may be outdated (SNIPPET).

### What cologne changes beyond shipping

**Where the bottles come from decides the paperwork.** A shop reselling stock bought from a Canadian distributor is a plain retailer. A shop importing bottles itself is the "importer" under the cosmetics rules and must file a notification with Health Canada within 10 days of first sale; labels must be in English and French with an ingredient list ([Cosmetic Regulations](https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.,_c._869/FullText.html)). Disclosure of 24 listed fragrance allergens has applied since April 12, 2026 ([Health Canada labelling guide](https://www.canada.ca/en/health-canada/services/consumer-product-safety/reports-publications/industry-professionals/labelling-cosmetics.html)). Boxes printed only in English and Arabic would fail the bilingual rule unless relabelled (INFERENCE).

**How listings are worded.** The exposure in trademark law is using another brand's registered name in a title or tag, such as "smells like" a designer scent, and not the scent itself ([Trademarks Act, sections 19 to 22](https://laws-lois.justice.gc.ca/eng/acts/T-13/page-5.html); the reading is INFERENCE). We describe notes and style without naming the other brand. Stripe's own list prohibits "Counterfeit goods" and "Unauthorised sale of brand-name or designer products", and separately lists "flammable" materials ([Stripe restricted businesses](https://stripe.com/en-ca/legal/restricted-businesses)); the approval email in phase 0 names cologne plainly so there is no surprise later.

**Returns.** Common retailer practice is sealed-only returns with opened bottles final sale ([one Canadian fragrance retailer's policy](https://lelabofragrances.ca/faq/cancellation-rights.html)). A returned cologne is still a dangerous good, so a customer cannot post it back at a counter; fragrance returns should be in store or through a carrier that accepts limited quantities (INFERENCE).

### The new sections on the storefront and in the admin

Each cologne needs more than a normal product (the field list is our design, derived from the rules above):

| Group | Fields |
|---|---|
| What the shopper sees | Size in mL, concentration (cologne, eau de toilette, eau de parfum, extrait, oil), brand, who it is positioned for, top, heart and base notes, scent family, ingredient list |
| What shipping reads | One required "shipping type" per item (standard, flammable limited quantity, pickup only, and so on), packed weight and box |
| What the back office keeps | Supplier, supplier invoice reference, Health Canada notification confirmed, bilingual label confirmed, sealed, tester or boxed, returnable |

On the storefront, size and concentration sit beside the name, notes show as three short rows, and a plain line reads "Ships by ground only. Not available to some remote communities", repeated in the cart when it changes the delivery choices. A shipping-software vendor recommends that plain wording over regulatory language ([ShipAid](https://www.shipaid.com/blogs/ecommerce-tips/why-perfume-and-fragrance-brands-face-shipping-restrictions-beauty-brands-never-have-to-plan-for), vendor opinion). Filters: brand, positioning, concentration, size, scent family, price. How the large fragrance retailers lay out their pages is COULD NOT VERIFY; every page we tried refused automated reading.

**Misc.** Shipping rules attach to the item, not the menu section, so **each misc item needs a shipping type**, and the admin form refuses to save one without it. To keep the section from becoming a junk drawer, each product holds one real category plus free tags, and once a cluster of similar items builds up we promote it to a named section; public research names over-categorisation and overlapping categories as the main faults but says nothing specific about catch-all sections ([Baymard category research](https://baymard.com/research/homepage-and-category-usability)), so the handling is INFERENCE.

---

## Checkout is safe to build only after a processor says yes in writing

### Payments

Stripe is the best technical fit: its official code library runs natively on Cloudflare ([Cloudflare announcement](https://blog.cloudflare.com/announcing-stripe-support-in-workers)), and its hosted page or embedded form keeps card details inside a frame served by Stripe, the lightest security paperwork category (SNIPPET of [Stripe's card-security guide](https://stripe.com/guides/pci-compliance)).

| Processor | Online card rate | Disputed-charge fee | Payout timing | What its policy says that an underwriter could apply | Source |
|---|---|---|---|---|---|
| Stripe | 2.9% + $0.30 | $15, plus $15 to contest, returned on a win | First payout held 7 business days, then about 3 | Prohibited: "Equipment and items intended to be used for making or using drugs". Needs extra review and "might not be able to grant approval" for listed restricted categories | [pricing](https://stripe.com/en-ca/pricing), [payout speed](https://support.stripe.com/questions/accessing-faster-payout-speeds-in-europe-and-canada), [policy](https://stripe.com/en-ca/legal/restricted-businesses) |
| Square | 2.8% + $0.30 | Says it charges none | Next business day to 2 days | Prohibited: "paraphernalia that may be used for illegal activity" and "internet/mail order/telephone order of age restricted products" | [pricing](https://squareup.com/ca/en/pricing), [terms](https://squareup.com/ca/en/legal/general/payment) |
| Helcim | Interchange + 0.50% + $0.25 | $15 only if lost | Next business morning | Prohibits "Drug paraphernalia" and online sales under its tobacco category | [pricing](https://www.helcim.com/pricing/), [policy](https://legal.helcim.com/ca/acceptable-use-policy/) |
| Moneris | 2.85% + $0.30 | $25 | Next day | No public list found (COULD NOT VERIFY) | [pricing](https://www.moneris.com/en/pricing) |
| PayPal | COULD NOT VERIFY | COULD NOT VERIFY | COULD NOT VERIFY | Pages refused automated reading | [fees page](https://www.paypal.com/ca/business/fees) |

None of the Stripe, Square or Helcim pages contains the words hookah, shisha or pipe; we read each page for those terms. The risk is classification, not an explicit ban (INFERENCE). Card networks give every merchant a category code. If an underwriter files the store under code 5993, Helcim's published pass-through for that code on online sales is $100 a year plus card-brand registration of $950 and $500 a year ([Helcim high-risk program](https://learn.helcim.com/docs/high-risk-merchant-program-from-visa-and-mastercard)), and Helcim's policy would not allow it online at all. Under a general retail code, none of the quoted clauses applies. The shop sells no tobacco, charcoal or vapes, and that is the case for a general retail code.

So the first task of the whole project is an email to each shortlisted processor describing the catalogue plainly (hookahs, glass bases, bowls, hoses, parts, cologne, misc; Canada only; signature on delivery) and asking for written approval and the category code they will assign. We build only after one says yes, and keep a second approved, because all of them reserve the right to hold funds or close an account.

**Wallets and debit.** Square's payment kit supports Apple Pay and Google Pay in Canada ([Square developer docs](https://developer.squareup.com/docs/payment-form/add-digital-wallets/apple-pay)). Interac announced on February 10, 2026 that Interac Debit is available for online purchases to Stripe's Canadian customers through participating digital wallets ([Interac announcement](https://www.interac.ca/en/content/news/interac-debit-is-now-available-for-online-and-in-app-payments-with-stripes-customers/)). Stripe's own wallet documentation was not read (COULD NOT VERIFY).

### The order flow that prevents the classic bugs

Today the cart and the shipping sum live in the shopper's browser. In the real store the browser's total is display only. The design below is INFERENCE built on Stripe's documented behaviour: its notices to our server (called webhooks) can arrive twice, out of order, and up to three days late ([Stripe webhooks](https://docs.stripe.com/webhooks)).

| Step | What happens | Bug it prevents |
|---|---|---|
| 1 | Browser sends only item codes, quantities and the destination. The server reads prices from the database and computes subtotal, shipping, tax and total | A tampered price |
| 2 | The order is saved as "pending" and stock is reserved before payment | Two buyers, one last item |
| 3 | The payment session is created with the server's total and a 30-minute expiry, using a one-time key tied to the order | Double clicks creating two charges |
| 4 | The order is marked paid only when a signed notice arrives from the processor, checked against the saved total, and each notice is recorded so a repeat does nothing | Fake "success" pages, duplicate emails |
| 5 | The thank-you page reads the order's status and shows "confirming" until step 4 lands | Treating a redirect as proof of payment |
| 6 | Expired sessions release their stock, with a timed sweep as a backstop | Stock locked by abandoned carts |
| 7 | A payment that arrives after release, with stock gone, is flagged for the owner | The one case that needs a human |
| 8 | Refunds start in the admin, are stored as their own records, and restock only when goods are back | Books that do not add up |

The exact way to check a payment notice's signature on Cloudflare comes from third-party guides and needs checking against Stripe's current library documentation before coding.

### Tax

GST/HST is charged at the rate of the province the parcel is sent to ([Canada Revenue Agency place of supply](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-place-supply.html)).

| Destination | Federal tax to charge | Separate provincial tax, only once registered there |
|---|---|---|
| Ontario | 13% HST | None |
| New Brunswick, Newfoundland and Labrador, Prince Edward Island | 15% HST | None |
| Nova Scotia | 14% HST | None |
| Alberta, Northwest Territories, Nunavut, Yukon | 5% GST | None |
| British Columbia | 5% GST | 7% |
| Saskatchewan | 5% GST | 6% |
| Manitoba | 5% GST | 7% |
| Quebec | 5% GST | 9.975% |

Sources: [Canada Revenue Agency rates](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html), [British Columbia bulletin PST 001](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-001-registering-to-collect-pst.pdf), [Saskatchewan PST](https://www.saskatchewan.ca/business/taxes-licensing-and-reporting/provincial-taxes-policies-and-bulletins/provincial-sales-tax), [Manitoba bulletin 004](https://www.gov.mb.ca/finance/taxation/pubs/bulletins/004.pdf); the Quebec rate is from a secondary guide ([Stripe Canada tax guide](https://stripe.com/resources/more/canada-vat)).

A 13-row table in our database is enough to launch and costs nothing; Stripe's tax add-on would add 0.5% per order for what is one lookup ([Stripe pricing](https://stripe.com/en-ca/pricing)). In-store pickup is charged at Ontario's 13% (INFERENCE from the agency's "makes it available in the province" wording). Shipping is taxed at the same rate as the goods (SNIPPET-level agency guidance; confirm with the accountant).

The real work is the four provinces with their own sales tax, each of which has a different trigger for a seller outside the province:

| Province | Trigger for an Ontario seller | Status of the evidence |
|---|---|---|
| British Columbia | More than $10,000 of BC sales in 12 months, or any amount if the shop advertises into BC. A website alone "which does not target B.C. customers" is not soliciting | Read in full: [bulletin PST 001](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-001-registering-to-collect-pst.pdf) |
| Manitoba | Soliciting plus delivering into Manitoba. The $30,000 small-business exception is narrow for outside sellers | Read in full: [bulletin 004](https://www.gov.mb.ca/finance/taxation/pubs/bulletins/004.pdf). Whether a national website counts as soliciting is not stated |
| Quebec | More than $30,000 of sales to Quebec consumers | SNIPPET: [Revenu Quebec](https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/special-cases-gsthst-and-qst/suppliers-outside-quebec/qst-registration-for-suppliers-outside-quebec/registration-under-the-specified-system-suppliers-outside-quebec-who-are-registered-under-the-general-gsthst-system/) |
| Saskatchewan | No dollar minimum per secondary guides | COULD NOT VERIFY from the bulletin itself |

Two consequences. The admin gets a report of trailing 12-month sales by destination province, with an early warning before each threshold (INFERENCE). And **advertising is a tax trigger**: ads aimed at British Columbia or Manitoba turn a passive website into soliciting under both bulletins, so ad targeting is a tax decision. Until registered in a province we charge only the 5% GST there; British Columbia says amounts collected as its tax by an unregistered seller must still be remitted.

Records must be kept six years from the end of the tax year, and records held outside Canada and reached electronically "are not considered to be records kept in Canada" ([Canada Revenue Agency record keeping](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/keeping-records/where-keep-your-records-long-request-permission-destroy-them-early.html)). Orders are therefore never deleted, each stores its province, rate and tax amounts frozen at sale, and a monthly export saved on a computer in Canada is the low-cost way to meet the location rule (INFERENCE; confirm with the accountant). Invoices of $100 or more must show the GST/HST number, and at $500 or more the buyer's name and a description of each item ([input tax credit regulations](https://laws-lois.justice.gc.ca/eng/regulations/SOR-91-45/FullText.html)); building every receipt to the $500 standard is simplest.

### Order emails

| Service | Price | Limits | Source |
|---|---|---|---|
| Cloudflare Email Sending | 3,000 a month included with the paid plan, then US$0.35 per 1,000 | Still labelled beta: "Features and APIs may change" | [pricing](https://developers.cloudflare.com/email-service/platform/pricing/), [docs](https://developers.cloudflare.com/email-service/) |
| Resend | Free: 3,000 a month, 100 a day | Works with a plain web request | [pricing](https://resend.com/pricing) |
| Postmark | US$15 a month from 10,000 | Free tier of 100 a month | [pricing](https://postmarkapp.com/pricing) |

Resend's free tier is the low-risk choice for launch, with sending kept behind one function so the provider can be swapped in a day (INFERENCE). The five messages (order confirmed, shipped, ready for pickup, refunded, and a low-stock digest to the owner) are exempt from the consent rule in Canada's anti-spam law as long as each "solely" completes or confirms a transaction ([anti-spam law, section 6](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html)). That means no promotions or "you may also like" inside them. Every message still carries the business name, address and a contact method. The newsletter gets its own box, unticked by default and separate from the terms box, because a pre-ticked box does not count as consent (SNIPPET of the regulator's bulletin: [CRTC 2012-549](https://crtc.gc.ca/eng/archive/2012/2012-549.htm)).

### Fraud, accounts and the pages the law expects

The built-in tools are enough at this size. A card payment authenticated with the bank's extra step (3-D Secure) shifts fraud liability to the card issuer ([Stripe on liability shift](https://support.stripe.com/questions/liability-shift-with-frictionless-flow-for-3d-secure-v2-(3ds2))). For "not received" disputes, what wins is proof of delivery to the full address; Stripe's own analysis found evidence submitted after delivery was confirmed had "a 27 percentage point higher win rate" ([Stripe analysis](https://stripe.com/blog/analyzing-the-evidence-that-helps-businesses-win-product-not-received-disputes)). Each order therefore keeps its tracking number, delivery scan, signature and every email sent.

Guest checkout is the default: 18% of US shoppers in one survey abandoned an order because the site required an account ([Baymard](https://baymard.com/lists/cart-abandonment-rate); sample size and year not stated). An optional "save my details" offer comes after the order.

Quebec's regulator lists what must be on screen before the pay button: the seller's name, address and phone, a description, the price with fees and taxes, the total, delivery date and method, and cancellation and refund terms, followed by a copy of the contract within 15 days ([Quebec consumer protection office](https://www.opc.gouv.qc.ca/en/consumer/topic/purchase/online-purchase/cancelling/)). Designing the review step to that list meets the stricter regime, and the confirmation email is the contract copy (INFERENCE). Ontario's equivalent rules could not be read from the statute (COULD NOT VERIFY). We publish Shipping, Returns and Refunds, Privacy, Terms of Sale and Contact pages, and a lawyer reads the terms once before launch.

A light age confirmation (a checkout tick box stored on the order, with signature on delivery) is a customary way to strengthen a processor application, not a published rule: no processor page we read requires one for accessories (INFERENCE).

---

## Live Canada Post rates replace the saved price table, which stays as the safety net

### Which Canada Post system to build on

Canada Post now has two developer platforms. The old one still runs, but staff call it "deprecated" with no shutdown date ([Canada Post developer forum](https://forum.developer-developpeur.canadapost-postescanada.ca/t/is-soap-api-deprecated/78)). The new Developer Portal, with release notes dated April 30, 2026, is where rating, shipping, tracking, pickup, returns and address lookup now live, and where "all new Canada Post APIs will launch exclusively" ([release notes](https://developer-developpeur.canadapost-postescanada.ca/devportal-portaildesdeveloppeurs/release-notes), [Canada Post blog](https://www.canadapost-postescanada.ca/blogs/business/ecommerce/canada-post-developer-portal-faster-scalable-and-built-for-business-growth/)). We build on the new one. It speaks the web's standard data format, so our server needs no extra parsing code (INFERENCE). Its exact field names sit behind a sign-in, and its rate limits are not published; both are confirmed by registering a test app in phase 0.

### What a small-business account gets

A Solutions for Small Business account gets its discounted rates by sending its customer number and no contract number, pays for each label with the default credit card saved in its Canada Post profile, and needs no end-of-day manifest ([Get Rates](https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/rating/getrates/default.jsf), [staff answer on payment](https://forum.developer-developpeur.canadapost-postescanada.ca/t/shipment-api-please-select-a-different-method-of-payment-error-for-venture-one-small-business-account/68)). An expired card on that profile stops label printing, so the admin shows that error in plain words (INFERENCE). Through December 31, 2026, members "automatically receive the program's best available shipping discounts, regardless of shipping volume" ([Canada Post news release](https://www.canadapost-postescanada.ca/cpc/en/our-company/news-and-media/corporate-news/news-release/2026-09-21-canada-post-introduces-new-pricing-discounts-market-insights-and-ecommerce-solutions-to-support-canadian-businesses)). Whether that continues afterwards is not announced; the live call absorbs any change, and a saved table would not.

### What the live call returns, and what it settles

One rating request returns, per service, the base price, each option's price, the fuel surcharge, taxes, a final total, the billable volume weight and an expected delivery date ([Get Rates](https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/rating/getrates/default.jsf)). We show Canada Post's total and never a sum we recomputed. To make the quote match the label, we send the real packed-box size, persist the quoted service and box on the order, and reuse them when buying the label (INFERENCE).

Three things the live call corrects in the mockup's saved table:

| Item | Mockup today | What the notes found | Status |
|---|---|---|---|
| Signature on covered glass parcels | $2 signature fee on any glass parcel valued over $100, and $2.75 per additional $100 of cover | "purchase of the Signature option is mandatory when purchasing additional Liability Coverage of $200 or more"; Expedited, Xpresspost and Priority include up to $100 of cover; Regular Parcel includes none ([Parcel Services guide](https://origin-www.canadapost.ca/cpc/doc/en/support/parcel-services-shipping-in-canada.pdf)) | **Open discrepancy.** The live rating call settles it once we send the coverage and signature options |
| Regular against Expedited | Treated as the same price | Volume weight divides by 6,000 for Regular Parcel and 5,000 for the others ([ABCs of mailing](https://canadapost-postescanada.ca/cpc/doc/en/support/abcs-of-mailing.pdf)), so a light, bulky box can bill lower on Regular (INFERENCE) | Rate both and compare |
| Oversize surcharge in peak season | Whatever the table holds | $30, up from $21, from November 2, 2026 to January 10, 2027 ([peak season notice](https://www.canadapost-postescanada.ca/cpc/doc/en/business/customer-notice-peak-season2026-e.pdf)) | Live call prices it |

### Reliability, and why the saved table stays

Canada Post publishes no uptime figure and takes its web services down every weekend "from Saturday at 9 pm to Sunday at 7 am ET", plus monthly two-day windows ([service availability](https://developer-developpeur.canadapost-postescanada.ca/devportal-portaildesdeveloppeurs/service-availability)). Evenings and weekends are when people shop, so that window will be our main fallback trigger (INFERENCE). The rule: call live with a hard time limit of a few seconds; on a timeout, error or the maintenance window, price from the saved table and mark the order "estimated, check before label"; never block checkout. The mockup's 2,328 shipping checks keep guarding that fallback.

Strikes hit the pre-holiday peak in both 2024 and 2025 (THIRD-PARTY: [labour dispute summary](https://en.wikipedia.org/wiki/2024%E2%80%932025_Canada_Post_labour_dispute)), but the dispute is closed, with agreements in force until January 31, 2029 ([union ratification notice](https://www.cupw.ca/en/tentative-agreements-ratified-membership)). A dormant Purolator account that can be switched on is cheap insurance, and Purolator is also the one carrier found that explicitly publishes ground acceptance of limited quantities, which matters for cologne (INFERENCE). Multi-carrier middlemen add nothing for Canada Post itself; one drops carrier coverage and multi-box shipments when used with the shop's own account ([ShipStation Canada Post guide](https://docs.shipstation.com/apis/docs/carriers/canadapost-guide.md)).

Two terms in Canada Post's developer agreement touch our design: personal information obtained through the program must be stored on systems in Canada or a NATO country, and Canada Post may suspend access at its sole discretion ([Developer Portal Agreement](https://www.canadapost-postescanada.ca/cpc/en/support/kb/company-policies/terms-conditions/developer-portal-terms-and-conditions.page)). Where our database physically sits was not checked.

### Addresses

The postal code alone sets the price; a full, checked address mainly prevents failed deliveries. Canada Post's address lookup costs **$35 for 300 lookups**, about 11.6 cents each, valid for 12 months ([AddressComplete pricing](https://www.canadapost-postescanada.ca/ac/pricing/)). What counts as one billable lookup is not stated. A free format check catches gross typos but does not prove a postal code exists. We start with the free check and add the paid lookup if failed deliveries show up (INFERENCE).

### The daily loop for one or two people packing

The loop below is INFERENCE assembled from the carrier's documented pieces:

1. Morning: print the pick list and packing slips from the admin. Each slip names the box the quote assumed ("Box B, 40 by 30 by 20").
2. Pack into that box. If the packer changes the box, the admin re-prices before buying the label and shows the difference.
3. Press "buy label" once per box; each box gets its own tracking number. Labels come as a 4 by 6 inch file or a letter-size page, and can be reprinted ([Shipping overview](https://developer-developpeur.canadapost-postescanada.ca/devportal-portaildesdeveloppeurs/api/overview/shipping)).
4. The store marks the order shipped and sends our email with all tracking numbers. Canada Post can also email the customer on shipment, exception and delivery if we ask at label creation ([Create Shipment documentation](https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/onestepshipping/createshipment.jsf)).
5. End of day: drop at the post office, or book an on-demand pickup at a **$3.50 flat rate per pickup** for any number of parcels ([pickup for small business](https://www.canadapost-postescanada.ca/smbpickup)).

A label made in error can be refunded only if the parcel was not sent and has no scans ([Non-Contract Shipping](https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/onestepshipping/default.jsf)). For printing, an AirPrint thermal printer prints straight from an iPhone or iPad and was listed at US$279.99; budget Bluetooth models near US$120 need their own app, which adds a step per label (SNIPPET: [Rollo](https://www.rollo.com/product/rollo-wireless-printer/embed), [Phomemo](https://phomemo.com/en-jp/products/pm-241bt)). Plain paper works from day one.

**Boxes.** No packing library publishes real-world accuracy, so we keep the dependable approach (INFERENCE): a short list of stocked boxes; every hookah and glass item carries its own packed-box size and weight; only loose small items go through the existing packer, with room left for cushioning. Double-boxing glass adds about 15 cm to every side under one carrier's guidance (SNIPPET: [FedEx packing guide](https://www.fedex.com/content/dam/fedex/us-united-states/services/HowToPack_fxcom.pdf)), which on our arithmetic takes a 30 by 20 by 20 cm box from 2.4 kg to 11.0 kg of billable volume weight. The outer box is what must be stored and quoted.

**Pickup orders.** The proven pattern is three messages (confirmed, ready, reminder), a hold period of about 7 days (THIRD-PARTY retail sources: [HotWax](https://www.hotwax.co/blog/the-cost-of-forgotten-orders-managing-failed-pickups-in-retail)), and a manual refund decision for unclaimed orders. Staff mark "ready", the customer gets a code, and staff record who collected.

**Tracking and problems.** Canada Post tracking has no push notices; we ask for updates, and the old system's limit was only 20 tracking requests a minute ([throttle limits](https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/throttlelimits.jsf)). So we lean on Canada Post's own emails and check undelivered parcels a few times a day in the background (INFERENCE). A missing-parcel claim must be opened by the sender within 90 days of mailing, and pays "the lowest of" the item's value, the cover bought, or the cover included ([missing packages](https://www.canadapost-postescanada.ca/cpc/en/support/kb/claims/missing-packages.page)). The admin flags any parcel overdue so the clock is not missed.

The glass point from the summary needs action before any site copy is written. THIRD-PARTY press and partner pages quote Canada Post's terms as excluding damage to fragile items such as glass ([CTV News](https://toronto.ctvnews.ca/items-labelled-as-fragile-not-covered-by-canada-post-if-damaged-1.3299065), [Shippo partner terms](https://goshippo.com/partners_static/canada_post/terms/)); the current wording is COULD NOT VERIFY. If it holds, the cover the mockup charges on glass protects against loss only, and describing it to shoppers as breakage protection would be wrong. The real protection is packing plus a shop breakage policy (INFERENCE).

---

## Search, security and the move off GoDaddy decide whether launch goes quietly

### Being found

Google says plainly: "Don't use fragments to change the content of a page, as Google Search generally doesn't support URL fragments" ([Google URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure)). The mockup's "#/shop/hookahs" addresses will not be indexed as separate pages and cannot carry their own preview when shared.

| Option | Indexed by Google | Own preview when shared | Effort |
|---|---|---|---|
| Keep "#/" addresses | No | No | None |
| Real addresses, same page served for all | Only after Google runs our scripts; unknown addresses look valid | No | Low |
| **Real addresses, and the server writes each product's title, description and preview tags into the page before sending it** | Yes | Yes | Low to medium |
| Pre-build a page per product when the owner publishes | Yes | Yes | Medium; pages go stale |

We take the third (INFERENCE as a recommendation; the mechanics are documented). Cloudflare can serve the single page for any address and let our server code run first on product and category addresses, where a built-in streaming tool rewrites the page's head section ([Workers single-page routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/), [HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/)). This needs no framework and no build step. Unknown addresses return a real "not found", and a few lines of script send old "#/" links to their new addresses.

Third-party policies shape where search effort goes. Google Merchant Center, the system behind Shopping ads and free product listings, states that listings for products that "form a component part of a tobacco product" are not allowed and gives "rolling papers, pipes, tobacco filters, hookahs" as examples ([Merchant Center policy](https://support.google.com/merchants/answer/6150004?hl=en)). Google's product rich-result guideline also excludes content related to "tobacco and vaping products" ([product structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)). What to do about it: plan on no Merchant Center listings for hookah items, still include the structured product data for accuracy and for other search engines, and put the effort into ordinary search results and the Google Business Profile, which Merchant Center policy does not govern (INFERENCE). Whether cologne alone could be submitted without drawing warnings on a mixed account is untested.

Speed targets are unchanged: the main content painted within 2.5 seconds, a response to taps within 200 milliseconds, and layout shift of 0.1 or less, measured at the 75th percentile of real phone visits ([web.dev Web Vitals](https://web.dev/articles/vitals)). Writing the main product image into the first page the server sends fixes the usual weakness of script-drawn stores, and the smoke stays on transform and opacity so it cannot shift the layout (INFERENCE).

### Moving off GoDaddy

- [ ] Find out who the registrant of the domain is and who holds the login. If the shop owns it but lacks the login, start GoDaddy's account recovery now; it needs government ID (SNIPPET: [GoDaddy help](https://www.godaddy.com/help/regain-access-to-my-domain-or-my-godaddy-account-4043))
- [ ] Save everything by hand first: page text, product names, prices, original photos, policies, any customer list. The builder has no export tool (SNIPPET, THIRD-PARTY: [WPBeginner](https://www.wpbeginner.com/?p=30680))
- [ ] List every old address on both the custom domain and any godaddysites.com address
- [ ] Verify the old site in Google Search Console before touching anything
- [ ] Add the domain to Cloudflare and check every imported record against GoDaddy, especially the mail records; the scan "is not guaranteed to find all existing DNS records" ([Cloudflare DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/))
- [ ] Turn DNSSEC off at GoDaddy before changing nameservers, then allow up to 24 hours ([Cloudflare DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/))
- [ ] Permanently redirect every old address to its new one and keep the redirects "generally at least 1 year" ([Google site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes))
- [ ] Submit the new sitemap and update the Business Profile link

Web downtime should be nil if the records are right before the switch; the exposure is email if one record is missed (INFERENCE). If the shop is only on a godaddysites.com address, we found no way to redirect it, and any ranking held there should be treated as lost and rebuilt (INFERENCE; COULD NOT VERIFY with GoDaddy).

### Security

The two things most likely to hurt this shape of store are an admin that trusts the screen instead of checking on the server, the first item in the 2025 list of top web risks ([OWASP Top 10:2025](https://top10.owasp.org/2025)), and product text placed on the page in a way that lets it run as code.

- [ ] Every admin request is checked on the server against Access's signed token, not just hidden in the interface: "You should validate the token with your public key" ([Cloudflare Access token validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/))
- [ ] The workers.dev address and preview addresses of the live store are disabled or put behind Access; preview addresses are public when enabled ([Workers previews](https://developers.cloudflare.com/workers/configuration/previews/))
- [ ] Product names and descriptions are placed as plain text, the "most fundamental safe way" ([OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html))
- [ ] Database queries use bound values only, never text glued together
- [ ] Photo uploads: admin only, a short list of allowed types, a size cap, a server-generated file name ([OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html))
- [ ] Security headers set in both places, because the static-file header list is "not applied to responses generated by your Worker code" ([Workers headers](https://developers.cloudflare.com/workers/static-assets/headers/))
- [ ] Secrets stored as Cloudflare secrets per environment, never in the code; payment keys rotated before go-live ([Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live))
- [ ] Cloudflare's free human check (Turnstile) on contact and checkout, verified on the server ([Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)), plus the one rate-limit rule the free plan allows ([rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/))
- [ ] An append-only log of every admin change: who, when, what, before and after

### Backups and safe releases

Point-in-time restore overwrites the live database and cannot make a copy ([D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)), so it is an undo button, not a backup.

| Layer | Mechanism | Covers | Rehearsal |
|---|---|---|---|
| Minutes to days | Point-in-time restore, 30 days on the paid plan | A bad change, a bad edit | On the test copy, quarterly |
| Days to months | Nightly database export to a separate, locked storage bucket | Anything older | Monthly: load the latest export into a fresh database and compare counts |
| Photos | File names that are never overwritten, in a locked bucket | Accidental delete | Spot check |
| Off-platform | Monthly copy of the export and photos outside the Cloudflare account | Account lockout | Open the copy |
| Code | The code repository, plus Cloudflare's one-command rollback | A bad release | Rehearsed before launch |

The plan is INFERENCE built on documented pieces. An export blocks other database requests while it runs, so it goes at the quietest hour ([D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)). The store gets a test copy and a live copy, each with its own database and photo bucket ([Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)). A rollback restores code but "resources connected to your Worker will not be changed" ([rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)), so database changes are additive only and go in before the code that needs them. Cloudflare's free plan has no health checks or error-rate alerts ([notifications available](https://developers.cloudflare.com/notifications/notification-available/)), so an outside uptime check and an error tracker fill the gap; one tracker's free tier covers 5,000 errors ([Sentry pricing](https://sentry.io/pricing/)).

### Accessibility and privacy

Ontario's website accessibility rule binds public bodies and businesses "with 50 or more employees" ([Ontario accessibility guidance](https://www.ontario.ca/page/how-make-websites-accessible)), so a single-location shop is very likely outside it. Building to the current standard anyway is cheap now (INFERENCE): visible focus, tap targets of at least 24 by 24 pixels ([W3C, what is new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)), focus moved to the new page heading on each route change, and reduced motion honoured.

The privacy page names an accountable person with contact details, says what is collected and why, lists who it is shared with (the processor, carriers, Cloudflare, the mail service), states retention, and explains how to ask for access or correction. Quebec's law requires the responsible person's title and contact details to be published and an incident register kept ([Quebec privacy regulator](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25)). Under federal guidance the shop, as the organisation in control of the data, carries the breach duties even when someone else hosts it ([breach reporting guidance](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/)).

### Who owns what, and support after launch

Every account that would stop the store if we vanished should be owned by the shop with us added as a user (the table is INFERENCE and opinion):

| Account | Owner | Our role |
|---|---|---|
| Domain | The shop | Delegate |
| Cloudflare (site, database, photos, admin login) | The shop | Member with admin rights |
| Payment processor | The shop | Developer access or a restricted key |
| Canada Post and any second carrier | The shop | Key stored as a secret |
| Google Business Profile, Search Console | The shop | Manager |
| Code | The studio until paid, then transferred or mirrored | Maintainer |
| Error tracking, uptime monitor | The studio | Owner |

Canadian agency blogs put e-commerce care plans at roughly $400 to $900 a month, with 48-hour response on a middle tier (SNIPPET, vendor blogs, several from one publisher: [Kolonell](https://kolonell.com/en/blog/website-care-plan-tiers-sla-toronto-agency-2026)). That is not survey data and the tier pricing stays internal. A custom store's plan covers restore drills, platform updates, bill watching, admin user changes and search checks, with a promised response time in stated business hours and no promised fix time (INFERENCE). The shop also holds a one-page runbook (deploy, roll back, restore, change a secret), the list of accounts, and the latest export location. No Canadian legal source was found for contract terms such as ownership transfer and liability caps.

### Launch checklist

- [ ] Real addresses live; each product and category page sends its own title, description and preview tags
- [ ] Unknown addresses return a real "not found"
- [ ] Sitemap and robots file live; Search Console verified for old and new
- [ ] Old-address map built, redirects in place, "#/" links rewritten
- [ ] DNS records checked against the old zone, email tested, DNSSEC handled
- [ ] Admin behind Access, every admin request verified on the server, preview addresses closed
- [ ] No database text placed on pages as code; headers on both kinds of response
- [ ] Upload checks, human check verified on the server, rate-limit rule set
- [ ] Secrets set per environment; payment keys rotated; none in the repository
- [ ] Live payment notices registered; handler safe against repeats and out-of-order arrival
- [ ] Real test orders: each tax zone, each shipping zone, a pickup, a declined card, a refund, every email
- [ ] A cologne cart shows ground services only and refuses a remote postal code
- [ ] Quoted shipping equals label price on test parcels; fallback pricing works with Canada Post unreachable
- [ ] Nightly export running and one full restore rehearsed
- [ ] Rollback rehearsed on the test copy
- [ ] Speed targets met on the phone at 390 pixels wide; pages looked at, at 390 and 1440
- [ ] Smoke checked on the iPhone 16 Plus: normal, Low Power Mode, reduce motion, after an app switch
- [ ] Accessibility pass: focus, target size, contrast, motion, form errors
- [ ] Privacy, terms, shipping, returns and contact pages published; GST/HST number on receipts
- [ ] Error tracking and uptime check alerting us
- [ ] Business Profile link updated; name, address and phone match the site
- [ ] Owner trained; accounts in the shop's name; runbook handed over
- [ ] Merchant Center decision recorded
- [ ] The old preview site untouched throughout

### First 30 days

- [ ] Day 1 to 2: watch errors, place a real order, confirm emails arrive in the inbox
- [ ] Week 1: Search Console coverage of new addresses, fix any dead old links; confirm the nightly export opens; check usage against plan limits
- [ ] Week 2: review admin access and the audit log; review blocked-request numbers
- [ ] Weeks 2 to 4: expect "temporary fluctuation in site ranking"; a small site moves within "a few weeks" ([Google site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes))
- [ ] Week 4: real-visitor speed check, restore drill, owner check-in, compare quoted and paid shipping, settle the care plan

---

## Phased build order

**Phase 0, before any code.** Send the processor approval emails and wait for a written yes with the category code. Confirm the shop's Canada Post small-business account, register a test app on the new developer portal and download its interface files. Call Canada Post for the acceptance-program terms. Establish who holds the domain. Ask the questions listed below. Nothing built in later phases is wasted if an answer comes back badly, except checkout, which is why it waits.

**Phase 1, foundation.** A new site beside the preview, with test and live copies. The database schema, including the shipping-type field every product must carry. The hand-written product file moves into the database. Real page addresses with server-written page heads. The admin login wall. Photo storage wired to the existing cut-out pipeline. The existing 36 end-to-end checks, shipping checks and phone layout audit pointed at the new site. In parallel, a one-day smoke prototype on the real phone, because its performance is the largest unmeasured item in the motion plan.

**Phase 2, owner admin, first version.** Products and variants with photos, the stock ledger with a low-stock list, orders, the home screen, export, the audit log. The owner uses it on real stock before checkout exists, which finds problems while they are cheap.

**Phase 3, checkout.** Server-side totals, the payment session, the signed-notice handler, reservation and release, the province tax table, the five emails, guest checkout, the review step built to the Quebec list, the policy pages.

**Phase 4, Canada Post live.** Rating with a time limit and the saved-table fallback, label purchase, tracking checks, pickup orders, pick lists and packing slips, the claims clock. The signature discrepancy is settled here.

**Phase 5, cologne and misc.** The extra fields and admin form, the storefront sections and filters, ground-only enforcement, the remote-postal-code blocklist, packing notes. Gated on Canada Post's written terms and on supplier paperwork.

**Phase 6, motion and smoke.** The tile-to-page move, the price stamp, cart confirmation, then smoke in its chosen placements with all three tiers, reviewed by contact sheet and on the phone.

**Phase 7, hardening and launch.** The security list, backup rehearsal, the GoDaddy move, the launch checklist.

**Phase 8, after launch.** The first-30-days list, then the care plan.

## Decisions the studio owner must make

1. **Processor order.** Stripe first for technical fit, with Square or Helcim as the second application, or a different order.
2. **Hosted payment page or embedded form.** The hosted page puts the least outside code on our pages and is one redirect; the embedded form keeps the shopper on our page but makes our own page hygiene matter more.
3. **Cloudflare paid plan from day one** at US$5 a month. We recommend yes.
4. **Whose Cloudflare account.** We recommend the shop's, with us as a member.
5. **Mail provider.** Resend's free tier now, or Cloudflare's beta service.
6. **Tax engine.** Our own 13-row table, or Stripe's add-on at 0.5% per order.
7. **Second carrier.** Open a dormant Purolator account now, or wait.
8. **Paid address lookup** at launch, or the free format check first.
9. **Smoke placements.** Our shortlist is the "lit, not idle" wisp, one hero wisp and the cart puff. Pick which ship, and whether the hero wisp is a one-shot that settles or a loop with a pause control.
10. **Plan B for smoke.** Whether to spend time on a Blender-rendered sprite sheet if the shader reads as vapour.
11. **Cologne timing.** Launch with the store, or follow once Canada Post's terms and supplier paperwork are in hand.
12. **Label printer recommendation** for the shop: plain paper first, or a thermal printer from day one.
13. **Glass breakage wording** on the site, once Canada Post's current terms are read.
14. **Care plan scope and price**, and the handover terms in the contract.
15. **Barcode scanning and till sync**: in the first version or later.

## Questions to ask the client

1. Which till system does the shop use at the counter, and does it track stock today?
2. Is the shop registered for GST/HST, and what is the number? Who is the accountant?
3. Does the shop already have a Canada Post Solutions for Small Business card and customer number? Is a credit card saved on that profile?
4. Who registered the domain, and who holds the GoDaddy login? Is the public address the custom domain or a godaddysites.com address? Is email hosted through GoDaddy?
5. Where does the cologne come from: a Canadian distributor, or imported directly? Can the supplier show the Health Canada notification and bilingual labels? Are any products oil-based with no alcohol, and is there a safety data sheet?
6. Which brands and roughly how many colognes at launch? What sizes?
7. What will go in misc at launch? We need the list to assign each item a shipping type.
8. Who packs orders, on which days, and is there a phone or tablet at the packing spot? Is there a printer?
9. Which box sizes does the shop stock, and how is glass packed today?
10. What should happen when glass arrives broken: replace, refund, photos required within how many days?
11. What is the return policy today for opened and unopened items?
12. Will the shop advertise online, and to which provinces?
13. How long should a pickup order be held, and what happens to unclaimed ones?
14. Who should be named as the privacy contact on the site?
15. Which numbers does the owner look at today, and how often?
16. Does the shop have a customer or email list from the old site, and how was consent collected?
17. Does the shop want product cost recorded so stock value and margin can be shown?

## Open risks

| Risk | What would trigger it | What we do |
|---|---|---|
| Processor refuses, or approves and later holds funds | Underwriter applies a nearby clause or code 5993 | Written approval and code before build; second processor approved |
| Cologne cannot ship by Canada Post | Enrolment refused, or terms forbid mixed boxes | Purolator ground as fallback; cologne can launch as pickup only |
| A wrong service is chosen for a cologne parcel | The carrier's system has no dangerous-goods field | Enforced in our code, with a test in the launch checklist |
| Quote and label price differ | Packer uses a different box; fuel surcharge changes weekly | Box named on the slip; re-price before label; store both figures |
| Checkout prices from stale data on Saturday nights | Canada Post's weekly maintenance window | Saved-table fallback, flagged for review |
| Smoke stutters or drains battery on the phone | Shader too heavy; Low Power Mode | Small drawing size, three tiers, early phone test |
| Smoke looks like a bought effect | Too large, too grey, looping visibly | The rules table; contact-sheet review; the studio owner's eye |
| Store not found in search after launch | Hash addresses left in place; lost godaddysites.com ranking | Real addresses, redirects, Business Profile |
| Email breaks at the nameserver switch | A missed mail record | Line-by-line record check before switching |
| Provincial tax registration missed | Sales pass a threshold, or ads target a province | Trailing-12-month report with warnings; ad targeting treated as a tax decision |
| Records rule or carrier data rule not met | Database held outside Canada | Monthly export held in Canada; check database location options |
| Admin exposed | A preview address left open; a request not checked on the server | Launch checklist items; audit log |
| The developer is unavailable | Illness, or the relationship ends | Accounts in the shop's name; runbook; backups the shop can open |
| Shopper misled about glass cover | Site copy written before Canada Post's terms are read | Read the terms first; shop breakage policy |
| Brand complaint on cologne listings | Another brand's name in a title or tag | Listing rule in the admin form; supplier invoice on file |

## Not yet verified

**Smoke and motion**
- No measured frame time, battery drain or file size for any smoke technique on an iPhone 16 class phone. COULD NOT VERIFY; settled by our own phone test.
- Whether Low Power Mode on current iOS throttles CSS animations as well as script animation, and whether the 30 frames a second cap and the autoplay block still apply on iOS 26 and 27. COULD NOT VERIFY (sources are 2020 to 2021 bug threads plus one 2020 article).
- That the iPhone 16 Plus has a 60 Hz screen: stated from memory in the notes, unsourced.
- Context loss behaviour on iPhone Safari: THIRD-PARTY guide and SNIPPET summaries of WebKit bug reports.
- OGL's 8 kb figure is from its readme; the independent size checker could not be reached.
- Every design rule for the smoke (tint by tile, scale, placement, speed, three tiers, drawing size) is INFERENCE. No source gave numbers for speed, opacity or loop length.
- That smoke overlays, smoke text and pointer trails are recognised cliches: INFERENCE; no critic was found saying so.
- The motion pattern shortlist and the idea of smoke as a state signal: INFERENCE; no shipped precedent found.
- Colour-relighting and blend-mode advice from the visual-effects trade: SNIPPET only.
- The niche scan read raw page code, one or two frames per video, homepages only. Script-added effects and product pages were not seen. Several sites could not be reached.
- The domain-warping reference article's content could not be fetched in one of two attempts; read it before writing the shader.
- Blender's scripted smoke bake reliability on version 5.1.2, and that Blender output carries no licence cost: COULD NOT VERIFY.
- Simulator price of about US$300: THIRD-PARTY.
- Installed versions of Playwright and the Chrome DevTools connection were not checked.

**Owner admin and platform**
- That the emailed one-time code login is included on Cloudflare's free plan specifically: COULD NOT VERIFY.
- Which till system the shop uses: unknown, and it decides the stock-sync design.
- Whether Square's interfaces carry any charge beyond card fees: COULD NOT VERIFY.
- A specific barcode library for iPhone: not verified.
- Stock-reservation designs: INFERENCE from documented database behaviour; the note that a failed conditional update does not fail the batch is THIRD-PARTY and needs the official D1 pages.
- Whether cookie-less analytics need consent in the Quebec regulator's view: COULD NOT VERIFY; our reading is INFERENCE from secondary sources.
- Where the database physically sits and what location options exist: not researched.

**Cologne and misc**
- Canada Post's acceptance-program terms: agreement, fee, any cap, mixed boxes with ordinary goods, whether Expedited to far northern addresses moves by air. COULD NOT VERIFY; settled by a call and a written answer.
- The remote fly-in office list was seen only as a SNIPPET and its currency is unconfirmed.
- Purolator's current surcharge ($14.00 seen on a possibly outdated page): SNIPPET. UPS Canada and Canpar positions: COULD NOT VERIFY.
- Whether a second importer of an already-notified cosmetic must file its own notification: COULD NOT VERIFY.
- Whether the Middle Eastern fragrance houses have Canadian distributors who file notifications and supply bilingual labels: COULD NOT VERIFY.
- The trademark reading on "smells like" wording: INFERENCE; no Canadian guidance on "inspired by" marketing was found; one supporting case was recalled, not fetched.
- How the large fragrance retailers lay out pages and filters: COULD NOT VERIFY.
- The catalogue field list, storefront wording and misc handling: INFERENCE.
- Ontario's internet-sale threshold and disclosure list, and whether the 2023 consumer act has been proclaimed: COULD NOT VERIFY.

**Checkout, tax and email**
- Whether any processor will approve this catalogue, and under which category code: only the processor can answer.
- That the risk is classification under code 5993: INFERENCE. The card-network fees for that code beyond Helcim's page: SNIPPET (a bank notice not read in full).
- PayPal fees and policy; Moneris monthly fee and policy; wallet support on Stripe, Helcim and Moneris; the security paperwork category for Square, Helcim, Moneris and PayPal: COULD NOT VERIFY.
- Stripe's card-security category wording: SNIPPET; third-party posts dispute parts of it and the standards body's text was not retrieved.
- Signature-check code for payment notices on Cloudflare: THIRD-PARTY guides.
- Session expiry and stock-release behaviour at Stripe: SNIPPET.
- The whole order-flow design: INFERENCE.
- Quebec's $30,000 threshold: SNIPPET. Saskatchewan's no-minimum rule: COULD NOT VERIFY. Whether a national website counts as soliciting in Manitoba: not stated. Quebec's 9.975% rate: secondary source.
- Tax on shipping charges, and 13% on in-store pickup: SNIPPET and INFERENCE.
- Receipt content rules were confirmed in the regulation; the agency's plain-language page was SNIPPET only.
- Whether cloud-hosted records alone satisfy the "kept in Canada" rule: not established.
- The regulator's guidance that pre-ticked boxes are not consent: SNIPPET. The anti-spam law's maximum penalties: COULD NOT VERIFY.
- That transactional emails still need an unsubscribe line: INFERENCE.
- Cloudflare email's automatic sender-authentication setup: THIRD-PARTY coverage.
- Whether Quebec's online-sale rules bind a seller outside Quebec, and French-language duties for a site selling into Quebec: COULD NOT VERIFY (law-firm commentary says the language duties reach out-of-province sellers).
- Whether any province treats hookahs or accessories as age-restricted goods: not researched. Canada Post's proof-of-age fee: not on the page read.
- Drip-pricing rules under competition law: not researched.
- The 18% account-requirement figure has no stated sample size or year.

**Canada Post and fulfilment**
- The mockup's $2 signature fee over $100 against the guide's "mandatory at $200 or more of additional coverage": open discrepancy, settled by the live rating call.
- New-portal field names, exact addresses, the test gateway and rate limits: behind sign-in or unpublished.
- Whether the new portal keeps a separate small-business label call, and "complete feature parity" with the old one: stated by Canada Post, not seen.
- Whether small-business discounts continue after December 31, 2026: not announced.
- Shutdown date for the old developer program: none published.
- The fragile-items exclusion: THIRD-PARTY reports several years old; current wording COULD NOT VERIFY. The time limit for damage claims: not on the page read.
- Whether small-business accounts can create return labels by interface: COULD NOT VERIFY.
- What counts as one billable address lookup: not stated.
- The double-box 15 cm figure: SNIPPET of another carrier's guide; the weight arithmetic is ours.
- Packing fill limits, the daily loop, scan-to-verify: INFERENCE.
- Printer prices: SNIPPET, in USD, and they move.
- Pickup hold periods: THIRD-PARTY retail blogs.
- Strike history: THIRD-PARTY summary. Purolator's interface details and pricing: SNIPPET or unreadable.
- Whether middlemen return the shop's exact account rates: not stated by any vendor.
- A time-limit feature for outgoing calls on Cloudflare: not confirmed on the page read.

**Security, search, migration and support**
- Bing's position on fragment addresses: COULD NOT VERIFY.
- Whether Merchant Center's free-listing rules match the quoted page exactly, and how a mixed account with cologne would be treated: not confirmed.
- That local search is the highest-value channel: opinion.
- GoDaddy facts (no export tool, account recovery steps, 72-hour connection time): SNIPPET or THIRD-PARTY; GoDaddy's own nameserver page refused reading. Whether a godaddysites.com address can redirect, and whether cancelling the builder affects bundled email or the domain: COULD NOT VERIFY.
- Recovery rules for a .ca domain registered by someone else: not researched.
- Cloudflare's free-plan 50-user limit appears on its plans page; one note saw it only as a SNIPPET.
- Database query-binding documentation, storage-bucket locks and lifecycle rules, and whether file versioning exists in R2: SNIPPET or COULD NOT VERIFY.
- The backup plan, release routine and account-ownership table: INFERENCE.
- Ontario human-rights duties for small business websites: COULD NOT VERIFY.
- Contrast and motion criteria were not re-read from the standard itself; the pause rule came from the explanatory document through a summariser.
- Care plan prices: SNIPPET, vendor blogs. Contract terms: non-Canadian law-firm articles only; no Canadian legal source found.
- An outside uptime service was not priced.

## Conclusion

The mockup proved the look. The work ahead is mostly invisible to shoppers: the server decides the price, the processor confirms the payment, Canada Post prices the box that will actually be packed, and the owner sees one honest number for stock. The research changed three assumptions we were carrying. Smoke is not the niche's cliche but its gap, which makes restraint the differentiator and not a compromise. The saved shipping table is no longer the calculator but the safety net under a live one. And the binding constraints are not technical: a written yes from a payment processor, a written answer from Canada Post on cologne, and a domain login decide the schedule more than any line of code.

That argues for starting phase 0 immediately and in parallel, because each of those answers takes days we do not control, and for building in the order that keeps a bad answer cheap: admin before checkout, checkout before cologne, and the smoke tested on the real phone in the first week so the last phase is polish and not discovery.
