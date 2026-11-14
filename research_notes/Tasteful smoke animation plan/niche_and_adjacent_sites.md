# Smoke and motion on hookah-niche and adjacent "smoke and atmosphere" sites (checked 2026-11-14)

Method note (applies to every section): homepages were fetched as raw HTML on 2026-11-14 and scanned for `<video>`, `<canvas>`, .mp4/.webm/.m3u8/.gif URLs, animation libraries, and any class, id or file name containing smoke/rauch/dampf/fog/vapor/particle. For the videos that could be opened, one or two still frames were pulled and looked at. No browser was run, so anything drawn by JavaScript after load (canvas injected at runtime, scroll effects, hover states) cannot be seen by this method. "Frames seen" means 1-2 frames, not the whole clip. COULD NOT VERIFY is used where the page or the asset could not be read.

## 1. What do hookah and shisha brand and retailer sites do with smoke and animation?

### Takeaway
Of 16 hookah sites reached, exactly one (Shishabucks) puts real smoke on its homepage, as a slow-motion looping product video on black. Nobody uses particles, WebGL, canvas or generated smoke; the niche's motion is a looping hero film (three premium makers) or a plain banner slider (every retailer), and zero sites had a smoke-named class, id or asset in the page.

### Cited Findings

Premium makers

- Shishabucks: the only confirmed smoke. Homepage hero is a full-bleed background `<video preload playsinline autoplay muted loop>` with a dark overlay div, source file `slow-motion-micro-main.mp4`. Frames seen: the cube-shaped Cloud Micro hookah lit warm orange on a pure black background, thick white smoke jetting out sideways from both sides in slow motion. It reads as premium: real footage, single subject, black field, smoke lit against dark. The file is in a 2023/03 uploads folder, so the hero has not changed in over three years. Rest of page: static product JPGs and an Instagram feed. No canvas, no smoke class names. — [shishabucks.com](https://www.shishabucks.com/); asset [slow-motion-micro-main.mp4](https://www.shishabucks.com/wp-content/uploads/2023/03/slow-motion-micro-main.mp4)
- Steamulation (Germany): two `<video>` tags, no smoke. A looping muted background video in a full-width row (`background-video-shortcode`, `loop playsinline muted`), file `steamulation_final_bw_mobile.mp4` uploaded 2026/10. Frames seen: black-and-white lifestyle film, a woman outdoors and a hookah standing on a golf-course lawn with people around it; no visible smoke in either frame. Second video tag is an empty product video modal (`pk-vidmodal__video`, muted loop). Slick carousels are present. No canvas, no smoke-named classes or files. — [shisha-steamulation.de](https://shisha-steamulation.de/); asset [steamulation_final_bw_mobile.mp4](https://shisha-steamulation.de/wp-content/uploads/2026/10/steamulation_final_bw_mobile.mp4)
- Moze (Germany): one hero `<video autoplay muted loop playsinline>` in a 16:7 black box with a gradient-to-black overlay and a countdown timer (a Black Week teaser; separate 1920x840 desktop and 1080x1080 mobile files, dated 26-11-12). Frames seen: black-and-white film of a craftsman assembling a hookah at a workbench, then an extreme close-up of an eye. No smoke in either frame. No canvas. The only "smoke" file names on the page are a tobacco brand's product photos ("smoke-island"). — [mozeshisha.de](https://mozeshisha.de/de/); asset [mobile teaser mp4](https://mozeshisha.de/media/dd/a1/aa/1794476564/26-11-12%20Black%20Week%20Spot%201%20Teaser%20Mobil%201080x1080.mp4)
- Kaloud (USA): the most ambitious motion in the niche, and none of it is smoke. A "launch film" section (`anqa-film`) with a lazy-loaded silent loop (`muted loop playsinline autoplay preload="none"`) plus a full film behind a play button ("Thirty birds. One name. The story behind ANQA, in under four minutes"), and a "Build your own ANQA System in 3D" configurator with a "Loading 3D" placeholder; the page script feature-tests for WebGL/WebGL2. Frames seen from the loop: near-black screen with the word "love" in many languages, then a small glass object on black. Copy describes a light effect, "colour moves slowly through the Ice base". No smoke imagery; "smoke" appears only in a link to an emissions study. — [kaloud.com](https://kaloud.com/); asset [launch-film loop mp4](https://kaloud.com/cdn/shop/videos/c/vp/ed330661f51347c2ba605eb4779e7d12/ed330661f51347c2ba605eb4779e7d12.HD-720p-1.6Mbps-100963852.mp4)
- Aeon (Germany): no video, no canvas, no GIF. Homepage is a Shopify theme slideshow with a pause/autoplay control and an announcement slider. The only "smoke" strings are the menu category "Smokebox/HMD" and product photos of one. — [aeon-shisha.com](https://aeon-shisha.com/)
- Wookah (Poland): redirects to its store; no video, no canvas, no GIF, no animation library found in the page. Static. — [store.wookah.pl/en](https://store.wookah.pl/en/)
- Oduman (Turkey): no video or canvas in the served HTML; a static image slider (`uploads/content/slider/...webp`) and factory photos (CNC production, handmade glass). The page is built by a script (`shared.js`), so later-injected content is COULD NOT VERIFY. — [oduman.com/en](https://www.oduman.com/en/)

Tobacco brands with hardware lines

- Al Fakher: a Squarespace site with one background video whose stored file name is "1659813_Black Background_Background_3840x2160.mp4". That name pattern (numeric ID plus generic description) matches a stock-footage download. The video itself returned 404 when requested directly, so what it shows is COULD NOT VERIFY. Headlines on the page: "ALWAYS FORWARD", "OUR LEGACY", "CRAFTSMANSHIP AT ITS BEST". No canvas. — [alfakher.com](https://www.alfakher.com/)
- Fumari: no video, no canvas, no real animation assets (the one .gif is a product placeholder image; the ".webm" hit is a script path, not a video). Slick slider only. — [fumari.com](https://www.fumari.com/)
- Starbuzz: COULD NOT VERIFY. Server returned HTTP 525 (SSL handshake failure). — [starbuzztobacco.com](https://www.starbuzztobacco.com/)

US retailers

- Hookah John: no video, no smoke. Hero is a Slider Revolution 7.2 module (`sr7-module`, alias "basic-hero-collection") whose first slide is a stock vector background (file name `vectorstock_64004674.webp`) under a "LIMITED TIME BUNDLE OFFER" link. The slider plugin registers three.js/WebGL add-on libraries, but that is the plugin's standard library list, not proof an effect is in use. The one distinctive motion: animated GIFs for category tiles (Bowls.gif, coals.gif, baSE.gif, Hosef.gif). Frames seen: a product on a white background (a phunnel bowl, a box of coconut coals), i.e. product-spin or slideshow GIFs. Cheap but functional. — [hookahjohn.com](https://hookahjohn.com/); assets [Bowls.gif](https://cdn.shopify.com/s/files/1/1293/6917/files/Bowls.gif), [coals.gif](https://cdn.shopify.com/s/files/1/1293/6917/files/coals.gif)
- Hookah-Shisha.com: now redirects to hookah.com. No video, no canvas, no GIF, no animation library; static hero banner image (alt text "Shisha World - Hero Banner") and a product slider background image. — [hookah.com](https://hookah.com/)
- 5StarHookah: no video, no canvas, no GIF. A run of promotional banner images (anniversary banner, brand banners, "Holiday Savings Galore"). "Smoke" appears only inside brand names (Social Smoke, Sahara Smoke). — [5starhookah.com](https://5starhookah.com/)
- BnB Tobacco: no video, no canvas; Flickity and Slick carousels. — [bnbtobacco.com](https://www.bnbtobacco.com/)

Canadian retailers

- MyHookah.ca: no video, no canvas, no GIF. 38 references to the Slick slider; category image tiles labelled ACCESSORIES, CHARCOAL, HOOKAH BOWLS, HERBAL MOLASSES; trust badges ("Free Ground Shipping", "Free Returns"). Standard template store. — [myhookah.ca](https://www.myhookah.ca/)
- Shisha World Canada: no video, no canvas, no GIF; Swiper carousels. — [shishaworld.ca](https://shishaworld.ca/)
- hookahcanada.ca redirects to thehookah.com: no video, no canvas, no GIF; one Swiper carousel. — [thehookah.com](https://www.thehookah.com/)
- shishanova.ca (listed on Trustpilot as a Canadian hookah retailer) no longer serves a hookah store: the domain now redirects to an unrelated gambling page. — [Trustpilot listing](https://ca.trustpilot.com/review/shishanova.ca)
- Shisha Virus, hookahplus.ca, torontohookah.ca, hookahtown.ca: COULD NOT VERIFY (connection failed, or the domain is a parked lander). — [shishavirus.com](https://www.shishavirus.com)

Award recognition in the niche

- No hookah or shisha brand site turned up as an Awwwards winner or nominee in search; the closest hits were freelancer portfolio pieces and a Framer community landing page for a hookah bar. — [Framer gallery: hookah web](https://www.framer.com/community/gallery/hookah-web/); [Contra: WooCommerce site for hookah flavours](https://contra.com/p/rFUemcFY-woocommerce-website-for-hookah-flavours-arbaab)

### Inferences
- The niche splits cleanly in two. Premium makers (Kaloud, Moze, Steamulation, Shishabucks) spend on film: one looping hero video, usually black-and-white or shot on black, about craft or lifestyle. Retailers (Hookah John, hookah.com, 5Star, MyHookah, Shisha World, thehookah.com, BnB, Aeon) run a platform-theme banner slider and nothing else.
- Smoke is close to absent, which is the surprise. The makers with the biggest budgets (Kaloud, Moze, Steamulation) show object, craftsman and lifestyle, and in the frames seen show no smoke at all. The product category is smoke, yet 15 of 16 homepages do not show it.
- No hookah site reached uses code-drawn smoke of any kind. Every moving thing is either a video file, a GIF, or a slider.
- Retailers selling parts and accessories (the client's actual category) have effectively no motion language at all. A hardware-only retailer with any considered motion would stand alone among the stores checked.
- Shishabucks is the benchmark for "smoke that looks good" in the niche, and its recipe is simple: real footage, one object, black field, side light, slow motion. It is also stale (2023).

### Gaps
- Product detail pages were not checked; smoke may appear in product videos there. Only homepages were scanned.
- Runtime-injected effects are invisible to an HTML scan. Kaloud's 3D configurator and Oduman's script-built page are the two most likely to hide something.
- Starbuzz, Shisha Virus and several small Canadian stores could not be reached. No Ontario-based hardware retailer with a working site was confirmed beyond MyHookah.ca and Shisha World (their province was not verified).
- Only 1-2 frames per video were viewed. Steamulation and Moze films may contain smoke shots elsewhere in the clip.
- Whether Al Fakher's background video is a smoke plate could not be confirmed (404 on the file).

## 2. What do adjacent premium categories do?

### Takeaway
Premium adjacent brands almost never draw smoke either. They use short looping film of the object, the hand and the room, and where smoke shows up at all it is a faint real wisp inside a filmed scene (Margiela, Cohiba) or landscape mist (Ardbeg), never an overlay or particle effect.

### Cited Findings

Cigars

- Cohiba (US site): three videos. An age-gate video (`agegate.mp4`, muted, not looped) and two autoplay muted loops in scroll-snapping full sections (`luxury.mp4` in a section headed "Experience Luxury", `collection.mp4`). Frames seen: a hand in a dark coat holding a lit cigar over a whisky glass with a faint wisp of smoke at the top of frame, then a wipe to solid brand red; a suited wrist with a watch; a macro of the cigar band on carbon-fibre texture. Smoke is incidental and tiny; the motion is slow macro product film. No canvas. — [cohiba.com](https://www.cohiba.com/); asset [agegate.mp4](https://cigarworld.b-cdn.net/public/cohiba/prod/Uploads/agegate.mp4)
- Davidoff: eight `<video>` tags, full-viewport (100vh) autoplay muted hero videos inside a carousel, separate desktop and mobile cuts, plus a small "scrollable area" GIF hint icon. Frames seen: white-and-gold gift boxes on a white set; an open box of cigars with a gold ribbon. Bright, clean, no smoke at all. — [davidoff.com](https://www.davidoff.com/)
- Habanos S.A. (official Cuban cigar site, Cohiba's parent catalogue): no video, no canvas; only loader GIFs. Static. — [habanos.com/en](https://www.habanos.com/en/)

Fragrance, incense, candles

- Maison Margiela Replica "By the Fireplace" product page: no `<video>` tag in the served HTML, but two hosted product videos are referenced in the page data. Frames seen: one is a brand film opening on a pale shelf wall of bottles with "REPLICA Maison Margiela presents"; the other shows the bottle on a block in deep amber firelight with a soft curl of smoke or shadow rising on the wall behind it. This is the closest adjacent example of "tasteful smoke": warm single light source, smoke barely there, the bottle is the subject. — [maisonmargiela-fragrances.us By the Fireplace](https://www.maisonmargiela-fragrances.us/fragrances/replica-eau-de-toilette/replica-by-the-fireplace/MM005.html); asset [product video](https://cfd718365.lwcdn.com/v-9e45f907-c649-4deb-b92a-b5f69541d2b2_high.mp4)
- Le Labo: four background `<video class="bg-asset bg-video" playsinline muted>` blocks (three with `preload="none"`), Vimeo-hosted. Content COULD NOT VERIFY (Vimeo returned 403 to a direct request). No canvas. — [lelabofragrances.com](https://www.lelabofragrances.com/)
- Byredo: no video, no canvas, no GIF on the homepage; Swiper carousel only. Static photography. — [byredo.com](https://www.byredo.com/ca_en)
- Diptyque: no video, no canvas, no GIF on the homepage. Static. — [diptyqueparis.com](https://us.diptyqueparis.com/en-us)
- Aesop: COULD NOT VERIFY (HTTP 403 to automated fetch). — [aesop.com](https://www.aesop.com/ca/)
- Astier de Villatte (incense, candles): no video, no canvas, no GIF. Static. — [astierdevillatte.com](https://www.astierdevillatte.com/en/)
- Boy Smells (candles): no video tag; the hero is an animated GIF (separate desktop and mobile hero GIFs) plus a GIF in the menu. Content of the GIF not viewed. — [boysmells.com](https://boysmells.com/)
- A trade article on selling scent online exists but was not read in full; listed for the report writer. — [Thingtesting: How do brands sell scents online?](https://thingtesting.com/stories/scents-online)

Whisky and mezcal

- Ardbeg: three Shopify `<video-block>` elements with six streamed videos, and a product line literally named "Heavy Vapours". Frames seen: the bottle standing in a misty, backlit Islay moorland with low cloud and haze (a composited landscape, atmosphere as mist rather than smoke); a neon-coloured bottle graphic on black. Atmosphere comes from the scene, not from an effect layer. — [ardbeg.com](https://www.ardbeg.com/en-gb)
- Lagavulin (Diageo Malts): one `<video>` with player controls, a 30-second ad film. Frames seen: a dim bar with bokeh lights; friends at a candle-lit table. No peat smoke in the frames seen. — [malts.com Lagavulin](https://www.malts.com/en-gb/lagavulin)
- Laphroaig: one autoplay muted video inside the age gate, with the lines "Welcome to Laphroaig. Hand-dipped. One at a time. Every time." Source URL is filled in by script, so content is COULD NOT VERIFY. — [laphroaig.com](https://www.laphroaig.com/)
- Del Maguey (mezcal): a hero that shows a still poster image first and swaps in a looping video (`hero-dm-loop-1.mp4`, same file for desktop and mobile) via a config element, plus a full intro film; 77 references to GSAP in the page. Video content COULD NOT VERIFY (403 on the file). — [delmaguey.com](https://delmaguey.com/)
- Whisky's smoke storytelling has mostly gone into film and VR rather than web effects: Laphroaig had a 360-degree aerial film of Islay's peat fields, and Lagavulin a VR tour of Islay with real peat for guests to smell. — [East City Films: Welcome to Laphroaig](https://eastcityfilms.com/laphroaig); [East City Films: The Lagavulin Experience](https://eastcityfilms.com/lagavulin-experience)
- Glenfiddich "Fire and Cane" was a CGI and photography campaign of smoke and sugar crystals (campaign imagery, not a site effect). — [Creativepool: Fire and Cane](https://creativepool.com/space/projects/experimental-series-fire-and-cane-for-glenfiddich-)

Premium vapes

- Puffco: the heaviest video user checked. 13 `<video>` tags on the homepage, all `playsinline muted loop`, most starting hidden (`invisible opacity-0 ... transition duration-300 ease-in-out`) and fading in, which is a hover or in-view reveal on product tiles. Frames seen: a hand holding the device over a bag; a hand loading a device; a hand gripping a device on black. No vapour in any frame seen. — [puffco.com](https://www.puffco.com/)
- PAX: four `<video autoplay muted loop playsinline>` blocks with poster images, the first with `preload="metadata"`, the rest `preload="none"`. Content COULD NOT VERIFY (not sampled). — [pax.com](https://www.pax.com/)

Barbecue

- Traeger: no video, no canvas on the homepage; Slick slider. — [traeger.com](https://www.traeger.com/)
- Weber (Canada): no video tag; a few promotional GIFs (for example a griddle/charcoal landing-page GIF) and one Swiper. No smoke effect. — [amer.weber.com/en-ca](https://amer.weber.com/en-ca/)

### Inferences
- The premium pattern is: film the object in a dark or warm room, loop it silently, let any smoke be real and small. Nobody in cigars, fragrance, whisky or vapes was found layering artificial smoke over a storefront.
- Even brands whose whole story is smoke (Cohiba, Ardbeg's "Heavy Vapours", Margiela's fireplace scent, Puffco) keep it out of the interface. Hands, materials and light carry the mood. Vape brands in particular seem to avoid showing vapour at all in the frames seen.
- The luxury end is frequently static (Byredo, Diptyque, Astier de Villatte, Habanos). "Premium" in these categories does not correlate with more animation.
- Consistent technical habits worth copying: muted, looped, playsinline; a poster image first; `preload="none"` or lazy sources for anything below the fold; separate mobile and desktop cuts (Davidoff, Moze, Margiela).
- Margiela's fireplace film and the Cohiba age-gate clip are the best reference points for "tasteful": one warm light, deep shadow, smoke as a trace.

### Gaps
- Le Labo, Aesop, Del Maguey, Laphroaig and PAX video content could not be viewed.
- No source was found describing a smoke animation or interactive build for Margiela "By the Fireplace"; only the product videos above. — [search hit: Lampoon article on the scent](https://lampoonmagazine.com/maison-margiela-replica-by-the-fireplace/)
- No WebGL peat-smoke whisky site case study was found. The nearest result was a 2014 Glenlivet WebGL sensory site, which does not mention peat. — [Rock Paper Reality: The Glenlivet](https://rockpaperreality.com/?p=85759)
- Incense-specialist brands (beyond Astier de Villatte) and independent candle makers were not surveyed.

## 3. Which award-recognised sites feature smoke, fog, vapour or fluid effects, and how are they used?

### Takeaway
On award sites, smoke is a studio and portfolio technique, used as a distortion layer over images, a cursor trail, or a page transition. No smoke-effect site belonging to a shop or a smoke-category brand was found, and the documented examples are several years old.

### Cited Findings
- PANAMAERA (French production company): the reference example. Awwwards lists two elements from it, "Smoke Effects Distortion on Scrolling" and "Cursor with Smoke Effect Distortion", both tagged webgl, shaders, glsl, effects, smoke, distortion. The live homepage still serves a persistent `<canvas class="WebglCanvas_container">` alongside 9 video tags. — [Awwwards: Smoke Effects Distortion on Scrolling](https://www.awwwards.com/inspiration/smoke-effects-distortion-on-scrolling); [Awwwards: Cursor with Smoke Effect Distortion](https://www.awwwards.com/inspiration/cursor-with-smoke-effect-distortion); [panamaera.fr](https://panamaera.fr/)
- How PANAMAERA's effect behaves, per a developer forum breakdown: "A Canvas over images/videos, that generates a smokey distortion effect"; "The Canvas remains active between pages", so navigation becomes a smoke transition; the pointer clears smoke off the image on hover. A GSAP moderator's verdict: "The wow factor comes WebGL shaders written in GLSL" and it is "Probably one of the hardest things to program". The thread is a developer question, not an official case study. — [GSAP forum thread](https://gsap.com/community/forums/topic/24175-interactive-smoke-distortion-on-images/)
- Hinderer and Wolff: Awwwards element "Smoke effect transition", tagged slideshow, transition, product page, 3D, i.e. smoke used as the wipe between product slides. The live site did not respond, so the effect is COULD NOT VERIFY. — [Awwwards: Smoke effect transition, Hinderer and Wolff](https://www.awwwards.com/inspiration/smoke-effect-transition-hinderer-and-wolff)
- Other Awwwards smoke elements, all from studio or portfolio sites: "Smoke Space Mouse Effect" by Torii Studio (tags: mouse, animation, threejs, shader); "Smoke Explosion" by And Then Jupiter (smoke, transition, hover, explosion, webgl); a "Smoke effect" portfolio transition; "Beyond the Fold - Smoke transition" (webgl, transition, TV landing page, sound design, smoke effect). Listings give tags and a preview only, no build detail. — [Torii Studio element](https://www.awwwards.com/inspiration/smoke-space-mouse-effect-torii-studio-1); [And Then Jupiter element](https://www.awwwards.com/inspiration/smoke-explosion-and-then-jupiter); [Smoke effect element](https://www.awwwards.com/inspiration/smoke-effect); [Beyond the Fold element](https://www.awwwards.com/inspiration/beyond-the-fold-smoke-transition)
- Awwwards also lists "Accelerated WebGL Fluid Simulation" as a code-snippet resource, the fluid simulation that most cursor-smoke effects descend from. — [Awwwards: Accelerated WebGL Fluid Simulation](https://www.awwwards.com/inspiration/accelerated-webgl-fluid-simulation)
- The cursor-smoke effect is now an off-the-shelf commodity: Framer marketplace sells "Liquid Smoke Cursor", "LiquidFluid", "Fluid Reveal WebGL" and a "smoke bg" component; npm has "smokey-fluid-cursor" and a React version; Webflow has a cloneable "Shader Puff" WebGL smoke cursor described as based on the same open-source fluid simulation. — [Framer: Liquid Smoke Cursor](https://www.framer.com/marketplace/components/liquid-smoke-cursor/); [Framer: smoke bg](https://www.framer.com/marketplace/components/smoke-bg/); [CSS Script: Smokey Fluid Cursor](https://www.cssscript.com/smokey-fluid-cursor/); [Webflow: Shader Puff](https://webflow.com/made-in-webflow/website/shader-puff)
- Codrops, July 2026, "The Sleepers" (a personal Three.js challenge entry, not a brand site): animated fog built deliberately cheaply. The author writes: "This fog is obviously not volumetric, it's just a kind of color trick applied to the materials of the scene", done by patching materials so anything below a set height takes the fog colour through a smooth gradient. The article also covers swirling noise-driven reveal transitions. — [Codrops: The Sleepers](https://tympanus.net/codrops/2026/07/10/the-sleepers-creating-an-atmospheric-webgl-experience-with-lightweight-techniques/)
- Codrops also has a procedural-clouds tutorial that uses layered noise to make cloud edges "like smoke", with the author's caveat that noise functions are expensive. — [Codrops: Procedural Clouds Using Three.js Sprites](https://tympanus.net/codrops/?p=46546)
- A performance precedent from an Awwwards case study: one team built a full interactive Three.js lighting scene for their hero, then rebuilt the effect in CSS to protect site performance. — [Awwwards case study: Superpower.com](https://www.awwwards.com/case-study-superpower-com.html)
- Fragrance is the one adjacent category with award-level WebGL work: Stink Studios built a WebGL experience for Chanel No 5 L'Eau ("Intangible Matter"). Whether it uses smoke specifically was not confirmed. — [Stink Studios: The Fifth Sense, Intangible Matter](https://www.stinkstudios.com/work/the-fifth-sense-intangible-matter)

### Inferences
- Award-site smoke is used four ways: (1) distortion layer over photos and video that clears under the pointer, (2) cursor trail, (3) page or slide transition, (4) scene fog in 3D worlds. No example of smoke used as a product reveal on a store, or tied to scroll on a shopping page, was found.
- All four are desktop-pointer ideas. A cursor trail and hover-to-clear do nothing on a phone, which matters for a phone-first store.
- The fluid cursor trail has moved from award-winning to template-store filler. Using it now signals "bought a component", not craft.
- The most recent serious write-up (Codrops 2026) argues for faking atmosphere cheaply rather than simulating it, and the Superpower case study shows a team retreating from WebGL to CSS for speed. The direction of travel among good builders is lighter, not heavier.
- Nobody has paired award-grade smoke craft with an actual shop in this category. That pairing is open.

### Gaps
- FWA, CSS Design Awards, Godly, Siteinspire and Land-book were not successfully searched; queries returned component marketplaces instead of gallery entries. Findings here are Awwwards and Codrops only.
- Awwwards element pages show no dates, so the age of each example is unconfirmed. The PANAMAERA forum thread is topic number 24175 on the GSAP forum, which places it around 2020, but the page date was not read.
- No agency case study describing how a smoke effect was built for a commercial brand site was found. The forum thread and the Codrops article are the only build descriptions.
- Award-winning 2025-2026 Three.js sites named in roundups (for example a glowing monolith over a dark landscape) were not checked for fog. — [Utsubo: Best Three.js Websites 2026](https://www.utsubo.com/blog/best-threejs-websites-2026)

## 4. What is the niche's cliche that we should avoid?

### Takeaway
Among real hookah stores the cliche is not smoke at all; it is the rotating sale-banner slider on a stock theme. The smoke cliche lives one level down, in templates, component marketplaces and concept mock-ups: a fullscreen smoke hero or a fluid smoke cursor trail.

### Cited Findings
- Banner slider as the default: Hookah John (Slider Revolution hero with a stock vector background, file `vectorstock_64004674.webp`), 5StarHookah (stacked promo banners), Aeon (theme slideshow with autoplay), MyHookah.ca (38 Slick slider references), Shisha World Canada (Swiper), thehookah.com (Swiper), BnB Tobacco (Flickity and Slick), hookah.com (static hero banner). — [hookahjohn.com](https://hookahjohn.com/); [5starhookah.com](https://5starhookah.com/); [aeon-shisha.com](https://aeon-shisha.com/); [myhookah.ca](https://www.myhookah.ca/); [shishaworld.ca](https://shishaworld.ca/); [thehookah.com](https://www.thehookah.com/); [bnbtobacco.com](https://www.bnbtobacco.com/); [hookah.com](https://hookah.com/)
- Stock assets in hero slots: Hookah John's hero background is a stock vector file; Al Fakher's background video carries a stock-style file name ("1659813_Black Background_Background_3840x2160.mp4"). — [hookahjohn.com](https://hookahjohn.com/); [alfakher.com](https://www.alfakher.com/)
- The premium-maker cliche: a black-and-white looping brand film in the hero. Moze and Steamulation both run one right now (frames seen: craftsman at a bench; lifestyle on a lawn). — [mozeshisha.de](https://mozeshisha.de/de/); [shisha-steamulation.de](https://shisha-steamulation.de/)
- Smoke as template material: ready-made hookah and smoking-bar WordPress themes are collected in roundups, and smoke backgrounds, smoke cursors and "cinematic smoke" shaders are sold as drop-in components. — [Colorlib: smoking and hookah bar WordPress themes](https://colorlib.com/wp/smoking-hookah-bar-wordpress-themes/); [Framer: smoke bg](https://www.framer.com/marketplace/components/smoke-bg/); [Framer: Liquid Smoke Cursor](https://www.framer.com/marketplace/components/liquid-smoke-cursor/); [Framer: cinematic background](https://www.framer.com/community/marketplace/components/cinematic-background/)
- The "fullscreen smoke-and-glass hero" is already the default output of generated concept sites: one AI showcase describes its perfume landing page exactly that way. — [Kimi showcase: Atelier Veil](https://www.kimi.com/showcases/websites/atelier-veil)
- Hookah lounge branding leans on smoke as a pattern motif and on dark, desert themes. — [Contra: hookah lounge brand identity](https://contra.com/p/LEFUkF3A-circler-brand-identity-hookah-lounge)

### Inferences
- Three things to avoid, in order of how common they are: (1) the auto-rotating promo banner slider, (2) a generic smoke plate or stock "smoke on black" video stretched across the hero, (3) a fluid smoke trail that follows the pointer. The first is what every competitor store does; the second and third are what a template or a generated mock-up would do.
- A fourth, softer cliche: the black-and-white craft film. It is good, but two of the four premium makers are running it at the same time, so it no longer differentiates.
- The gap is specific. No hardware retailer checked has any considered motion; no site in the niche draws smoke in code; and the only good smoke in the niche is filmed, three years old, and limited to one hero. Smoke that is small, tied to the product (rising from a bowl, sitting inside a glass base, picking up the tile's jewel colour) and behaves on a phone without a pointer is unclaimed by any site reviewed here.
- The adjacent premium brands suggest the tasteful rule: smoke is a trace inside a lit scene, never a layer on top of the interface.

### Gaps
- No design critique or gallery was found that explicitly names the smoke overlay as a hookah-site cliche; that label is an inference from templates and component stores, not a quoted opinion.
- Hookah lounge and bar sites (as opposed to stores and makers) were not surveyed directly; they are the most likely home of the smoke-background cliche and this was not tested.
- A page titled "Smoke Shop Website Examples" turned out to be a website-builder sales page with no site reviews, so it gave nothing. — [Zarla page](https://www.zarla.com/guides/smoke-shop-website-examples)
