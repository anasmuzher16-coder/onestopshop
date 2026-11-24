# Section transitions: performance pass (2026-11-24)

The owner's words: "the transitions on the site are pretty laggy I need them fixed and smooth as butter."
This is a performance pass only. Every approved look stays: inked fire, flowing puffy smoke for Hookahs, aerosol mist for
Cologne, the spiral hose, flying header-object parts, Home embers.

## How it is measured

`node tools/wave-perf.mjs` walks all fifteen waves twice (round 1 is the first tap of a visit, round 2 is warm), with a real tap
(pointerdown, 70 ms, click). Per transition it records every requestAnimationFrame gap from the tap to the wave's end, long tasks
(over 50 ms, Chromium only), and the time from the click to the first frame in which the wave has moved.

Configs: Chromium at 390x844 @3x with 4x and 6x CPU slowdown (`RATE`), 1440x900 @1x (`VIEW=desk`), software WebGL
(`GPU=0`, SwiftShader: the worst fill rate there is), and WebKit at 390x844 (`ENGINE=webkit`; no CPU slowdown or long-task API).
Chromium runs on this laptop's integrated GPU (AMD Radeon Vega 10, D3D11). A real iPhone was not available: WebKit here is the
closest stand-in, not proof.

Targets: p95 frame under 16.7 ms on the throttled phone profile, no long task over 50 ms during a transition, first moving frame
within 100 ms of the tap, rapid taps stay smooth.

## What we found (live build bf6976d, CPU profiles and traces per transition, 4x phone)

1. **Forced layout of every off-screen card.** fx-stick measured each `.tile` inside `.grid--shop .card`, which has
   `content-visibility:auto`. Asking a skipped element for its position lays it out, so every card on the page was laid out at the
   swap, and reads and writes alternated, restyling once per tile. Everything section: 1,361-1,541 ms of `getBoundingClientRect`
   in one transition; set: 508-827 ms in `scan`. fx-sections' misc act did the same.
2. **Shader compile and GL setup inside the tap.** Warm-up only began on the first pointerdown, so the first tap compiled its
   material; the Hookahs page then compiled nine simulation programs and ran 9-24 simulation steps in the swap frame (476-647 ms
   long tasks on Hookahs).
3. **The canvas read its own size every frame** (`clientWidth` in `cssSize`), which forced the new page's layout inside the wave's
   frame right after the swap (30-50 ms per transition at 4x).
4. **Backdrops kept full rate under the wave.** fx-air and the cologne mist spent 100-450 ms of `drawImage` per transition window.
5. **Sheets were freed 20 s after every wave**, so the next tap re-uploaded and re-mipmapped a 768x768 sheet (70-87 ms).
6. **The set page lays out 110 photo picks** (206-289 ms of layout at 4x).
7. **The swap itself** (app.js render: string building + innerHTML + parse, 100-250 ms at 4x on Everything and Set) is still one
   long task. It now happens under full cover and the reveal's clock starts after it, so the wake never jumps; making it short needs
   a chunked render in app.js, which other branches own.

## Numbers

Chromium 390x844 @3x, 4x CPU, integrated GPU. p95 frame / worst frame / tap to first moving frame, ms. Round 1 = first tap of the
visit, round 2 = warm. Same harness both sides (tools/wave-perf.mjs); the machine was shared with other sessions at ~70% CPU, so
single rows are noisy: read the medians.

| | p95 median | p95 worst | worst frame median | first move median |
|---|---|---|---|---|
| before, round 1 | 83.5 | 183.6 | 200 | 32 |
| after, round 1 | 33.4 | (one 1,218 outlier) 83.4 otherwise | 150 | 28 |
| before, round 2 | 33.5 | 116.6 | 150 | 28 |
| after, round 2 | 33.4 | 200 (one outlier) | 133 | 25 |

Per transition (round 1, before -> after, p95/worst): Hookahs 184/684 -> 50/300, Heat 117/834 -> 33/317, Set 167/584 -> 17/467,
Gifts 67/317 -> 17/217, Cologne 100/200 -> 33/100, Bowls 84/234 -> 50/150, Shipping 50/134 -> 17/67. Desktop 1440 unthrottled:
worst p95 200 -> 67 (round 1), 17.1 -> 16.9 (round 2). Software GL, 4x: median p95 517 -> 133. Frame strips at 390 show the first
Hookahs tap standing still for ~560 ms before; after, the smoke moves at 180 ms.

**Targets not met:** the swap frame (item 7) is still a 150-650 ms long task at 4x on most sections, so "no long task over 50 ms"
and "p95 under 16.7 ms on every transition" are not met on throttled phone emulation. WebKit here is headless on Windows with
~200 ms frames before and after; it cannot speak for an iPhone. A real iPhone was not available.

## What the research says, and what we took from it

- **Shader compiles block when you ask for their result.** MDN, WebGL best practices: "checking COMPILE_STATUS or LINK_STATUS blocks
  until the compile or link completes. In browsers where it's available, the KHR_parallel_shader_compile extension provides a
  non-blocking COMPLETION_STATUS query." Also: "Don't check shader compile status unless linking fails" and getProgramParameter is a
  "flush + shader compile + round-trip". https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
  Khronos, the extension itself: COMPLETION_STATUS_KHR "enables a non-blocking poll operation".
  https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/
  Taken: every wave material is handed to the driver after the page loads, polled with COMPLETION_STATUS_KHR, and only then
  collected. The smoke page's simulation programs are handed over the moment a wave sets off for Hookahs, so they compile while the
  wave covers the screen.
- **Warm with a hidden draw.** Drivers often finish a program at its first draw, and MDN says to prefer uploads "before starting
  drawing". Taken: each material draws once into a single hidden pixel at warm-up; sheets upload in idle moments, one per moment.
- **Uploads flush the pipeline.** MDN: "Most texture uploads from DOM elements will incur a processing pass ... causing a pipeline
  flush. Prefer doing uploads before starting drawing." Taken: the header-object sheets are uploaded ahead of the tap and kept while
  the tab is visible (they used to be freed 20 s after every wave, so the next tap re-uploaded and re-built mipmaps inside the tap).
  A hidden tab still gives them back.
- **Render fewer pixels and scale up.** MDN: "A common (and easy) way to trade off quality for speed is rendering into a smaller
  back buffer, and upscaling the result." Taken: the wave can draw into the top-left part of its buffer and a CSS transform stretches
  it back, so the scale can change between two frames without resizing the canvas (WebKit stops presenting a resized WebGL canvas).
  The scale is chosen by measured time: a timed quarter-size draw of the heaviest material at warm-up, and three slow frames in a row
  during a wave.
- **Decode images before the swap.** MDN, HTMLImageElement.decode(): it lets "the image ... be rendered immediately upon being added
  to the DOM", which "prevents the rendering of the next frame after adding the image to the DOM from causing a delay".
  https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode
  Already in place for the sheets (decode() before use); kept.
- **createImageBitmap** offers premultiplyAlpha and colorSpaceConversion "none" so an upload needs no conversion pass
  (https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap). Not needed once uploads leave the tap.
- **View Transitions freeze the page while the update runs.** Chrome docs: while the callback's promise is pending, "the page is
  frozen, so delays here should be kept to a minimum", and the old view is "a screenshot". https://developer.chrome.com/docs/web-platform/view-transitions/same-document
  The wave navigations already skip the View Transition (the wave covers the change), so no full-page snapshot is taken under a wave.
- **Pause what cannot be seen.** The backdrop simulation (fx-pour) and the 2D air (fx-air) skip their work while a wave's body fully
  covers the screen, so the GPU and main thread go to the wave.
- **The GPU switch.** powerPreference "high-performance" asks a two-GPU laptop to switch to the discrete GPU when the context is made;
  the wave now asks for "default".

## Atelier (motion first)

Read in full from C:\dev\atelier-marketplace\atelier\0.5.1\skills: motion, taste, critique, brief, concept, layout, color,
typography, ux-flows, brand-systems. One decision each changed:

- motion: "nonblocking always" and exits that leave in one pass. The reveal clock now starts at the first frame after the swap, so a
  slow swap holds the full cover instead of making the wake jump; a tap during a held compile cancels cleanly.
- taste: performance floors, "animation stays on the compositor". The render scale changes through a CSS transform, never a canvas
  resize.
- critique: "verified in motion". Before/after frame strips at 390 for all fifteen waves, reviewed by a fresh design reviewer.
- brief: the single job of this pass, written first: every tap moves within 100 ms and never stutters, look unchanged.
- concept: three directions weighed (bake flipbooks, lower quality for everyone, move the work out of the tap); the third kept the
  approved materials.
- layout: density choreography respected: long lists keep skipping off-screen cards; we measure the card, never the tile inside it.
- color: no colour changes; the timed gauge draw uses the smoke's own palette tokens so its cost is the real one.
- typography: the header object's fit beside the title was left exactly as it was; no type touched.
- ux-flows: the frequency law: section taps are frequent, so the nav answers at the tap and the backdrops yield to the wave.
- brand-systems: frozen vs flexes. Material, palette and timing are frozen; only pixel count flexes, and only below 25 fps or on a
  device measured too slow to fill the screen in time.
