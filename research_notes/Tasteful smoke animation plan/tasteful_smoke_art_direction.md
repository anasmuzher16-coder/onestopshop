# Tasteful smoke, vapour and atmospheric motion: art direction for a dark hookah store (researched 2026-11-14)

Evidence grades used below:
- [RAW] = I read the page text directly.
- [FETCH] = quote returned by a page-fetch summariser from the live page. Likely verbatim, re-check before publishing.
- [SNIPPET] = quote came from a search-result excerpt only. Treat as a lead, not a verified quote.
Anything marked INFERENCE is mine, not a sourced claim.

## 1. What separates good smoke from bad (speed, density, colour, lighting, scale, placement, looping, restraint)

### Takeaway
Across cinematography and VFX the consistent rule is that smoke only looks good when it is lit from behind against dark, kept thin and even, and takes its colour from the light in the scene. Thick, front-lit, grey-on-black smoke is the documented failure ("murky", "gray blob"). I found no sourced rule on speed or loop length; those are inference.

### Cited Findings
- Lighting direction is the main variable. David Mullen ASC: "Side-lit smoke is not going to be nearly as visible as backlit smoke." [FETCH] - [Cinematography Mailing List: Shooting smoke](https://cinematography.net/edited-pages/CML-Shooting-smoke.htm)
- Sam Wells, same thread: "You must give smoke, steam, etc enough backlight." [FETCH] - [CML: Shooting smoke](https://cinematography.net/edited-pages/CML-Shooting-smoke.htm)
- Jay Holben, American Cinematographer (28 Oct 2018): "we need to backlight the atmospheric particles." [FETCH] - [ASC Shot Craft: Smoke and Fog](https://theasc.com/blog/shot-craft/smoke-and-fog)
- Front light is the failure mode: light from the camera side can "wash out the scene and reduce the contrast." [FETCH] - [ASC: Smoke and Fog](https://theasc.com/blog/shot-craft/smoke-and-fog)
- Neil Oseman (11 Feb 2024) gives the physics reason: "it shows up best when it's backlit." [FETCH] - [RedShark: How smoke can make your shots look magical](https://www.redsharknews.com/how-smoke-can-make-your-shots-look-magical)
- Grey on black reads as mud. Mullen: "If you put something medium grey against something black, it feels a little murky." He wants the smoke "a little hot" so the frame runs from dark to bright. [FETCH] - [CML: Shooting smoke](https://cinematography.net/edited-pages/CML-Shooting-smoke.htm)
- Density: the target is a "light but consistent level of fog", built in small doses. Too much leaves contrast "reduced to little more than a gray blob." [FETCH] - [ASC: Smoke and Fog](https://theasc.com/blog/shot-craft/smoke-and-fog)
- Thick textured smoke carries a warning: "Take care though, because this can easily get distracting." [FETCH] - [RedShark: Oseman](https://www.redsharknews.com/how-smoke-can-make-your-shots-look-magical)
- What haze is for: depth. Smoke "simulates a natural phenomenon called aerial perspective"; behind it "The background becomes brighter, less contrasty, less saturated." [FETCH] - [RedShark: Oseman](https://www.redsharknews.com/how-smoke-can-make-your-shots-look-magical)
- Subjects near camera stay clean: the closer they are, "the less they will be affected by the fog." [FETCH] - [ASC: Smoke and Fog](https://theasc.com/blog/shot-craft/smoke-and-fog)
- Smoke in front of a subject hides it: "Backlit smoke in front of a person or an object will obscure them." [FETCH] - [RedShark: Oseman](https://www.redsharknews.com/how-smoke-can-make-your-shots-look-magical)
- Colour should come from the scene light, not a flat tint. ActionVFX relighting tutorial: a tint is the shortcut, relighting means "the light interacts dynamically with the smoke." [SNIPPET; the URL returned is a mirror host of the ActionVFX blog] - [ActionVFX: normal map to relight 2D smoke](https://actionvfx-frontend-eta.vercel.app/blog/how-to-make-a-normal-map-to-relight-smoke-after-effects)
- Same tutorial inverts the depth map so thinner smoke reads brighter, as light passes through it. [SNIPPET] - [ActionVFX: relight smoke](https://actionvfx-frontend-eta.vercel.app/blog/how-to-make-a-normal-map-to-relight-smoke-after-effects)
- Blend mode is not automatic: "Don't always layer smoke on using an Add or a Screen layer mode." [SNIPPET] - [FutureLearn / MPC dossier: taking your 3D comp to the next level](https://www.futurelearn.com/courses/vfx-for-filmmakers/0/steps/13284)
- Smoke plates should be prepared neutral: true black point, no added colour or sharpening, so they can be matched to the scene later. [SNIPPET] - [SLR Lounge: Smoke textures for compositing](https://www.slrlounge.com/smoke-textures-for-compositing-in-3-simple-steps/)
- Sustained slow sway is a comfort risk. Apple: "Avoid showing objects that oscillate in a sustained way", especially "around 0.2 Hz". Written for visionOS, not the web. [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Peripheral motion pulls the eye whether you want it or not: "Movement in a person's peripheral vision triggers a stimulus-driven shift in visual attention." [FETCH] - [NN/g: Animation for Attention and Comprehension (Aurora Harley, 2014)](https://www.nngroup.com/articles/animation-usability/)
- Restraint, stated as a rule: "Employ animations sparingly and only when they add meaning to the interaction." [FETCH] - [NN/g: Harley 2014](https://www.nngroup.com/articles/animation-usability/)

### Inferences
- INFERENCE: Translate "backlit against dark" literally. The wisp should be brightest at its thin edges and nearly invisible in its body, sitting behind the cut-out product, with a soft light source implied behind the product. Not a grey layer at 20 percent opacity.
- INFERENCE: Tint the smoke with the jewel colour of the tile it sits on (as if the tile were the gel on the backlight). White or grey smoke on charcoal is exactly Mullen's "medium grey against black" murk.
- INFERENCE: Placement order from the cinematography sources is background haze, then product, then type. Smoke never crosses in front of type, a price label or the product, because the same sources say it lowers contrast and obscures.
- INFERENCE: Scale small. One wisp the width of the product reads as that product's smoke; a full-viewport layer reads as weather.
- INFERENCE: Speed. No source gave a number. Real incense smoke rises slowly and continuously; on a store, slow non-repeating drift keeps it out of peripheral-attention territory. Avoid a visible left-right sway on a roughly 5 second period (Apple's 0.2 Hz note).
- INFERENCE: Looping. A loop whose seam the eye can catch is the tell. Either generate it (noise-driven, never the same twice) or make it a one-shot that ends.
- INFERENCE: One place, one job. A page with smoke in the hero, the grid, the cart and the footer has fog, not smoke.

### Gaps
- No motion designer or VFX source gave explicit numbers for smoke speed, opacity or loop duration. School of Motion, Motionographer, fxguide and Corridor were not reached within the call budget.
- The ActionVFX and MPC quotes are snippet-level and need a direct read before being quoted to anyone.

## 2. How photographers light and shoot smoke, and what that implies for a dark site

### Takeaway
The studio recipe is: black background set far back, light the smoke from the side or behind, keep every bit of light off the background, overexpose the smoke slightly, colour it with light or white balance. A dark charcoal site is already the black backdrop; the job is to add the "light" and keep the background truly dark.

### Cited Findings
- Background: black, placed as far back as possible to "avoid light spilling onto it." [FETCH] - [Adaptalux: Smoke photography tutorial](https://adaptalux.com/smoke-photography-tutorial/)
- Light position: "Your flash needs to be next to the smoke, shooting across the scene." [FETCH] - [Adaptalux](https://adaptalux.com/smoke-photography-tutorial/)
- Source: incense cones over sticks, because "A cone stays in the same place as it burns." [FETCH] - [Adaptalux](https://adaptalux.com/smoke-photography-tutorial/)
- Colour is added through white balance and hue, not coloured smoke: "We set ours to be a little cooler than our flash." [FETCH] - [Adaptalux](https://adaptalux.com/smoke-photography-tutorial/)
- Exposure against black: "it's best to overexpose 1/3 to 1 stop." (speaker given as Mark) [FETCH] - [CML: Shooting smoke](https://cinematography.net/edited-pages/CML-Shooting-smoke.htm)
- Camera needs more smoke than the eye: "you need easily 2 or 3 times as much smoke density." (Sam Wells) [FETCH] - [CML: Shooting smoke](https://cinematography.net/edited-pages/CML-Shooting-smoke.htm)
- Smoke is translucent, so judge it by eye: "smoke efx are an eyeball thing to me." (Sam Wells) [FETCH] - [CML: Shooting smoke](https://cinematography.net/edited-pages/CML-Shooting-smoke.htm)
- Haze vs smoke vs fog: hazers release "a much finer amount of diffusion into the air"; hazers give "a more subtle and longer-lasting effect." [FETCH] - [ASC: Smoke and Fog](https://theasc.com/blog/shot-craft/smoke-and-fog); [RedShark: Oseman](https://www.redsharknews.com/how-smoke-can-make-your-shots-look-magical)
- Side vs back: photography guides mostly recommend side light for stills; cinematographers favour backlight. One guide notes backlit smoke looks more translucent and glowing. [SNIPPET] - [PictureCorrect: How to photograph smoke](https://www.picturecorrect.com/how-to-photograph-smoke/); contrast with [CML](https://cinematography.net/edited-pages/CML-Shooting-smoke.htm)
- Post: push the background to pure black with the levels black point. [SNIPPET] - [PictureCorrect](https://www.picturecorrect.com/how-to-photograph-smoke/)

### Inferences
- INFERENCE: If real smoke is ever shot for this store, shoot it as a separate plate on black with side or back light, one cone, then composite. That gives a real wisp with thin bright edges, which generated noise rarely matches.
- INFERENCE: The charcoal must stay charcoal where smoke sits. If the smoke layer lifts the background grey, the "light spilled on the backdrop" mistake has been reproduced in CSS.
- INFERENCE: Product cut-outs should carry a faint rim light on the side the smoke is lit from, so product and smoke share one light. This is the still-life equivalent of matching "temperature and intensity of a light source."
- INFERENCE: Two registers are available and should not be mixed: haze (even, barely visible, gives depth behind a hero) or wisp (a single defined ribbon from a single source). Thick cloud is the third register and the one the sources warn about.

### Gaps
- The ExpertPhotography guide returned 404; Digital Photography School and PetaPixel guides were listed but not read.
- No product-photography source specific to hookah or vape was found or sought (kept generic by constraint).

## 3. Recognised cliches, and who calls them out

### Takeaway
I found no authoritative designer or critic naming "smoke effect" itself as a cliche. The nearest sourced criticism is of blurred "fog" used as atmosphere in place of an idea, of parallax as a gimmick, and of any animation that repeats. The specific list (stock fog overlay, smoke text reveal, smoke cursor trail, neon vape clouds, drifting smoke.png, exhale video) is supported by principle, not by a named critic. Report that honestly.

### Cited Findings
- Fog as a substitute for design: the blur "suggests depth even when the page has none" and "flatters weak thinking." Anonymous site, opinion piece. [FETCH] - [aismells: Gradient Fog](https://aismells.pages.dev/gradient-fog.html)
- Same page, the fix: "a visual metaphor tied to the actual product." [FETCH] - [aismells: Gradient Fog](https://aismells.pages.dev/gradient-fog.html)
- Repetition is what turns an effect into an irritant: "the second viewing is tiresome, and the third is downright annoying." [FETCH] - [NN/g: Harley 2014](https://www.nngroup.com/articles/animation-usability/)
- "Gratuitous, purposeless animations discourage the user from interacting further with the website." [FETCH] - [NN/g: Harley 2014](https://www.nngroup.com/articles/animation-usability/)
- Apple: "Don't add motion for the sake of adding motion." [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Parallax called "a gimmick people overuse" (designer Morven Mac). [SNIPPET] - [Creative Bloq: 7 web trends we'd be better off without](https://creativebloq.com/features/7-web-trends-wed-be-better-off-without)
- Scroll hijacking: NN/g defines it as a pattern that changes scroll speed or direction and documents usability harm. [SNIPPET] - [NN/g: Scrolljacking 101](https://www.nngroup.com/articles/scrolljacking-101/)
- Counter-evidence: design galleries present smoke transitions approvingly, so the trade does not treat smoke as inherently corny. [SNIPPET] - [Designmodo: Smoke transitions](https://designmodo.com/smoke-transitions); [Awwwards: smoke effect collection](https://www.awwwards.com/inspiration/smoke-effect)

### Inferences
- INFERENCE: Why each item on the cliche list fails, mapped to sourced rules:
  - Full-page stock fog overlay: front-lit, flat, lowers contrast everywhere ("gray blob"), always in peripheral vision, runs forever.
  - "smoke.png" drifting sideways: real smoke rises from a source; sideways drift with a visible seam has no source and no light.
  - Smoke text reveal: puts smoke in front of type, the one place the cinematography sources say it obscures.
  - Smoke cursor trail: motion on the most frequent interaction there is, which Apple and Emil Kowalski both say not to animate.
  - Neon vape clouds: saturated colour that does not come from the scene light; also category-generic, the "same sky" problem.
  - Full-screen exhale video: heavy, autoplaying, over five seconds, decorative. Triggers WCAG 2.2.2 and says nothing about the product.
- INFERENCE: The owner's "AI tell" veto on tickers is the same test as the gradient-fog critique: an effect that could sit on any shop is the problem. Smoke passes only if it could not be moved to a shoe store.

### Gaps
- No Awwwards jury comment, named art director or critic was found calling out smoke overlays, smoke text or smoke cursors specifically. Two searches, zero direct hits. This is a real absence in what I searched, not proof that nobody has said it.
- No sourced criticism of vape or hookah category visual tropes.

## 4. "More animation" without smoke, and what respected sources say about how much helps or hurts

### Takeaway
The sources agree on a narrow recipe: animate to explain a change or confirm an action, keep it under about 300 ms, ease out, and animate less the more often something is seen. I found no primary study tying animation to conversion; every conversion figure that surfaced was an unsourced vendor claim and should not be used.

### Cited Findings
- Purpose first: "add them in places where they enrich the information on the page." (Emil Kowalski) [FETCH] - [Emil Kowalski: Great Animations](https://emilkowal.ski/ui/great-animations)
- Speed: "Your animations should also usually be shorter than 300ms." [FETCH] - [Emil Kowalski](https://emilkowal.ski/ui/great-animations)
- Easing: "The best type of easing for this purpose is ease-out." [FETCH] - [Emil Kowalski](https://emilkowal.ski/ui/great-animations)
- Frequency: "consider how often the user will see it" and "never animate keyboard initiated actions." [FETCH] - [Emil Kowalski](https://emilkowal.ski/ui/great-animations)
- Interruptible: good animation "allows the user to change the state of the animation at any time." [FETCH] - [Emil Kowalski](https://emilkowal.ski/ui/great-animations)
- NN/g durations (Page Laubheimer, 2020): "the duration of most animations should be in the range of 100-500 ms"; simple feedback "should be roughly 100 ms"; big changes "200-300 ms can be appropriate." [FETCH] - [NN/g: Animation duration](https://www.nngroup.com/articles/animation-duration/)
- "At 500ms, animations start to feel like a real drag for users." [FETCH] - [NN/g: Animation duration](https://www.nngroup.com/articles/animation-duration/)
- "it is far more common for animations to be too long than too short." [FETCH] - [NN/g: Animation duration](https://www.nngroup.com/articles/animation-duration/)
- Enter slower than exit: a popup "may take 300ms to appear" but "only 200 or 250ms to disappear." [FETCH] - [NN/g: Animation duration](https://www.nngroup.com/articles/animation-duration/)
- "Completely linear motion looks weird and unnatural to users." [FETCH] - [NN/g: Animation duration](https://www.nngroup.com/articles/animation-duration/)
- Frequent equals subtle: "the more subtle and shorter you'll want it to be." [FETCH] - [NN/g: Animation duration](https://www.nngroup.com/articles/animation-duration/)
- Legitimate goals include to "Show continuity in a transition." Repeated animations "are roadblocks to content." [FETCH] - [NN/g: Harley 2014](https://www.nngroup.com/articles/animation-usability/)
- Apple: "Aim for brevity and precision in feedback animations." [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Apple: "generally avoid adding motion to UI interactions that occur frequently." [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Apple: "Let people cancel motion." Do not make people wait, "especially if they have to experience the animation more than once." [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Apple: feedback motion "that doesn't make sense can make them feel disoriented." [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Rauno Freiberg (July 2023): "When so commonly executed, the interaction novelty is also diminished." [FETCH] - [Rauno: Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design)
- Rauno: "I removed motion from core interactions." [FETCH] - [Rauno](https://rauno.me/craft/interaction-design)
- Rauno: "Great interaction design rewards learning by reusing metaphors." and "Truly fluid gestures are immediately responsive." [FETCH] - [Rauno](https://rauno.me/craft/interaction-design)
- Material: motion "informs users by highlighting relationships between elements, action availability, and action outcomes." [SNIPPET; Material 2 page] - [Material Design: Understanding motion](https://material.io/design/motion)
- Container transform (grid tile grows into the product page): "creates a visible connection between two distinct UI elements." [SNIPPET] - [Android codelab: Material motion](https://developer.android.com/codelabs/material-motion-android)
- Web equivalent of the shared-element move: "A thumbnail image on a product listing page that transitions into" the full image on the detail page. [FETCH] - [Chrome for Developers: View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions)
- Conversion claims found were weak: a "14 percent" click-through lift attributed to VWO and a "23%" add-to-cart lift, both from vendor blogs with no linked study. Do not cite as evidence. [SNIPPET] - [Boundev blog](https://www.boundev.ai/blog/ux-microinteractions-ecommerce-conversion); [Growth Suite](https://www.growthsuite.net/questions/do-micro-animations-help-or-hurt-conversion-on-mobile)

### Inferences
- INFERENCE: Pattern shortlist that fits these rules and the store's look:
  1. Grid tile to product page as one move (cut-out photo and jewel tile travel and grow; View Transitions). Shows continuity, the strongest sanctioned use.
  2. Add-to-cart confirmation on the item and the cart count, about 200 to 300 ms, runs alongside the action, never blocks it.
  3. Price-gun label "stamp" on first appearance of a price or on a price change (variant switch). One-shot, under 300 ms, physical metaphor already in the brand.
  4. Quantity stepper: number ticks, no bounce. This is a high-frequency control, so near-instant.
  5. Staggered grid entrance once per page load only, short total duration, never re-run on scroll back or filter change.
  6. Hover and tap response on tiles: small lift or colour shift, about 100 ms. On touch, press state only.
  7. Product reveal on scroll: one-time, opacity plus small offset; no parallax, no scroll hijack.
- INFERENCE: A budget follows from the frequency rule. Things seen once per visit (hero, first grid entrance) can be expressive. Things seen every few seconds (hover, quantity, cart) must be nearly invisible. "More animation" should be spent on the first group.
- INFERENCE: The client asking for "more animations" is best answered with more places that respond, not longer or bigger motion. Every source above penalises duration and repetition, none penalises responsiveness.

### Gaps
- No Baymard, NN/g or peer-reviewed study on animation and e-commerce conversion was found. The honest position is "usability guidance exists, conversion evidence does not" in what I searched.
- Awwwards jury comments were not found.
- Material 3 and Material 2 motion pages returned empty to the fetcher; Material quotes are snippet-level only.
- Josh Comeau's general animation writing (beyond reduced motion) was not read.

## 5. Where smoke can carry meaning instead of decoration

### Takeaway
Film uses smoke for three jobs: depth, separation of subject from background, and concealing then revealing. Those map onto a store as state signals (selected, added, loading, changed) tied to a specific product. I found no documented web or e-commerce precedent for smoke as a state signal, so the ideas below are inference built on sourced principles.

### Cited Findings
- Smoke as depth and separation: fog can "add more depth into the scene." [FETCH] - [ASC: Smoke and Fog](https://theasc.com/blog/shot-craft/smoke-and-fog)
- Smoke as conceal and reveal: "Backlit smoke in front of a person or an object will obscure them." [FETCH] - [RedShark: Oseman](https://www.redsharknews.com/how-smoke-can-make-your-shots-look-magical)
- Classic use: dark or silhouetted figures in front of bright shafts of smoky light, credited to John Alton's 1949 manual. [SNIPPET] - [Neil Oseman: The Science of Smoke](https://neiloseman.com/?p=10366)
- A product-tied metaphor is the stated cure for generic atmosphere: "a visual metaphor tied to the actual product." [FETCH] - [aismells: Gradient Fog](https://aismells.pages.dev/gradient-fog.html)
- Animation earns its place when it is "precisely tied to a successful action." [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Fades are the approved way to move something without making people track it: "Consider using fades when you need to relocate an object." (visionOS context) [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Nearest real precedent: interface icon sets ship coffee cups whose steam plays only on hover, a state-triggered vapour cue. Decorative loops of the same thing also exist. [SNIPPET] - [Lordicon: coffee cup](https://lordicon.com/icons/wired/flat/239-coffee-cup); [21st.dev coffee icon](https://21st.dev/@avijit07x/components/hu-coffee-0-2.md)
- Rauno on metaphor reuse: "Great interaction design rewards learning by reusing metaphors." [FETCH] - [Rauno](https://rauno.me/craft/interaction-design)

### Inferences
- INFERENCE: Candidate ideas, each with the job it does and the rule it rests on:
  1. Lit, not idle. A thin wisp rises from a product only while it is the selected or hovered item, then thins out and stops. Meaning: "this one is active." Rests on: state-tied motion, one source, backlit, behind the product.
  2. Hero wisp. One slow ribbon behind the single hero product, tinted by its tile, rim-lit, non-repeating, with a pause control. Meaning: none beyond depth, so it is the weakest idea; allowed once because it is seen once.
  3. Cart puff. A short one-shot puff (well under 500 ms) at the cart when an item lands, then gone. Meaning: confirmation. Rests on: brief, precise, tied to a successful action. Risk: seen often, so it must be small and must not delay anything.
  4. Smoke as page transition. Old view thins out as the new one arrives. Meaning: continuity. Risk: it is the conceal-and-reveal use, which hides content and adds wait; under reduced motion it must fall back to a plain cross-fade. Compare against the tile-to-page shared move, which the sources back more strongly.
  5. Flavour colour. Smoke on a shisha flavour page takes the flavour's jewel colour. Meaning: carries information (which flavour), the strongest "meaning" case.
  6. Session timer. A coal or bowl graphic that burns down over a real session length. Meaning: utility. Note it is auto-updating content, so WCAG 2.2.2 requires pause or hide.
  7. Empty and loading states. Unlit bowl for an empty cart, first wisp while a page loads. Meaning: status. Loading smoke that is the only content on screen is outside 2.2.2's "in parallel" condition.
- INFERENCE: Test for each: remove the smoke and ask what the shopper no longer knows. If nothing, it is decoration and counts against the one-place budget.
- INFERENCE: Ideas 1, 3 and 5 pass that test. Idea 2 is the only purely atmospheric one worth keeping.

### Gaps
- No real shipped store or site was found using smoke or vapour as a functional state signal. Searches returned icon libraries and decorative demos only.
- Could not verify the Alton attribution directly; it is from a search excerpt of Oseman's blog.

## 6. Accessibility: vestibular triggers, WCAG 2.2, reduced motion

### Takeaway
Any smoke that starts by itself, runs longer than five seconds and sits beside other content needs a way to pause, stop or hide it (WCAG 2.2.2, Level A). Motion triggered by interaction should be switchable off (2.3.3, Level AAA), and honouring the operating system's reduced-motion setting is the accepted way. Opacity fades are the safe substitute for movement.

### Cited Findings
- WCAG 2.2.2 (Level A) applies to moving content that "(1) starts automatically, (2) lasts more than five seconds" and runs in parallel with other content; then "there is a mechanism for the user to pause, stop, or hide it." [FETCH] - [W3C: Understanding 2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- Why: "Moving content can also be a severe distraction for some people." [FETCH] - [W3C: 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- A preloader that is "the only content on the page" is not in parallel and needs no control. Auto-updating content has no five-second exception. [FETCH] - [W3C: 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- The fetch summariser's reading (not W3C's words): a decorative looping background "likely needs a control", and one control for all moving elements is better than several. [FETCH] - [W3C: 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- WCAG 2.3.3 (Level AAA): "Motion animation triggered by interaction can be disabled, unless the animation is essential." [FETCH] - [W3C: Understanding 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- Named triggers: parallax, decorative elements moving sideways during vertical scroll, non-essential page-flip transitions. [FETCH] - [W3C: 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- Colour and opacity changes are outside the "motion animation" definition. Blurring was listed as excluded but an erratum removes that exclusion, so treat blur as in scope. [FETCH] - [W3C: 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- "Vestibular (inner ear) disorder reactions include dizziness, nausea and headaches." [FETCH] - [W3C: 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- Sufficient techniques: C39 (CSS prefers-reduced-motion), SCR40 (the same in JavaScript), or a site-level preference. [FETCH] - [W3C: 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- Thomas Steiner: "some users outright experience motion sickness"; suggests "disabling certain purely decorative effects." [FETCH] - [web.dev: prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)
- Josh Comeau (updated 29 Apr 2026): "an element fading in and out is safe to use for everyone." [FETCH] - [Josh Comeau: Accessible animations](https://www.joshwcomeau.com/react/prefers-reduced-motion/)
- Comeau's default: "start without animations, and enable them if the user wishes." [FETCH] - [Josh Comeau](https://www.joshwcomeau.com/react/prefers-reduced-motion/)
- Apple: "Make motion optional." Never use motion "as the only way to communicate important information." [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Apple on periphery: people "can be particularly sensitive to motion that occurs in their peripheral vision." (visionOS) [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Apple on large moving things: "increase the object's translucency" or "lower its contrast to make its motion less noticeable." (visionOS) [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Apple on stable reference: "Consider giving people a stationary frame of reference." (visionOS) [RAW] - [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
- Do not strip everything: App Store Connect's reduced-motion criteria warn that removing animation unnecessarily can make an app more confusing, and name scaling, spinning and peripheral motion as triggers. [SNIPPET] - [Apple: Reduced Motion evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria)
- Emil Kowalski: "our animations need to account for people who don't want animations." [FETCH] - [Emil Kowalski](https://emilkowal.ski/ui/great-animations)

### Inferences
- INFERENCE: Rules for this build:
  - Ambient smoke (hero wisp) either ends within five seconds or has a visible pause control. A one-shot that settles into a still frame avoids the requirement and looks more deliberate.
  - Under reduced motion, smoke becomes a still frame or a slow opacity fade with no drift. Shared-element moves become cross-fades. Confirmation still happens (count changes, label appears) with no movement.
  - Smoke stays small, low contrast and inside a fixed tile, so the page itself is the stationary frame. No smoke that spans the viewport or moves with scroll.
  - Smoke never carries information by itself. "Selected" and "added" also show as a static state.
  - Because blur is now arguably in scope for 2.3.3, animated blur on interaction should also switch off under reduced motion.
- INFERENCE: The same choices that make smoke tasteful (small, thin, one place, one-shot, behind the product) are the ones that make it accessible. The two briefs do not pull against each other.

### Gaps
- I did not read the normative WCAG 2.2 text itself, only the Understanding documents, via a summariser. Exact wording should be re-checked before it goes in a spec.
- No source addressed particle or fluid-simulation effects specifically; all guidance is for motion in general.
- Unsourced prevalence figures for vestibular disorders appeared in secondary blogs and were left out.
