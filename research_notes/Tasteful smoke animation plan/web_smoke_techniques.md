# Web smoke, vapour and fog rendering techniques and their phone cost (as of 2026-11-14)

Method notes that apply to every section:
- "Measured" sizes were taken on 2026-11-14 by downloading the exact file at the cited URL and running `gzip -9`. They are raw file sizes, not bundlephobia figures. bundlephobia's API returned HTTP 429 for ogl, twgl.js and regl, so its numbers are COULD NOT VERIFY.
- Browser support versions come from the MDN browser-compat-data (BCD) JSON on GitHub, read on 2026-11-14. In BCD, `safari_ios` mirrors `safari` unless stated.
- No device benchmarking was done. No source found gives a measured frame time or wattage for any of these techniques on an iPhone 16 class device. Every "cost" statement below is either a quoted source or a labelled inference.

## 1. WebGL fluid simulation (Pavel Dobryakov's WebGL-Fluid-Simulation and derivatives)

### Takeaway
It is small (about 11 KB gzip of unminified script, MIT) and Safari on iOS exposes the half-float render targets it needs, but it is the heaviest per-frame option here, has no context-loss handling, and its rAF loop is halved to 30 fps in Low Power Mode. It is an interaction toy by default and would need to be stripped down and re-tuned to read as tasteful smoke.

### Cited Findings
- Licence: "The code is available under the MIT license." 16.8k stars, 91 commits, 61 open issues, description "Play with fluids in your browser (works even on mobile)". - [GitHub repo](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
- Size, measured: `script.js` is 51,849 bytes raw, 11,244 bytes gzip (unminified, includes the MIT header and all GLSL). - [script.js](https://raw.githubusercontent.com/PavelDoGreat/WebGL-Fluid-Simulation/master/script.js)
- The bundled `dat.gui.min.js` is 50,149 bytes raw, 14,358 bytes gzip. It is only the control panel and is not needed for a background effect. - [dat.gui.min.js](https://raw.githubusercontent.com/PavelDoGreat/WebGL-Fluid-Simulation/master/dat.gui.min.js)
- Config defaults in the source: `SIM_RESOLUTION` 128, `DYE_RESOLUTION` 1024 (lowered to 512 when `isMobile()` or when linear filtering is unsupported), `PRESSURE_ITERATIONS` 20, `BLOOM` true and `SUNRAYS` true (both forced off when linear filtering is unsupported). `isMobile()` is a user-agent test for `/Mobi|Android/i`. - [script.js](https://raw.githubusercontent.com/PavelDoGreat/WebGL-Fluid-Simulation/master/script.js)
- Format handling in the source: on WebGL2 it enables `EXT_color_buffer_float` and reads linear-filter support from `OES_texture_float_linear`; on WebGL1 it uses `OES_texture_half_float` and `OES_texture_half_float_linear`. `supportRenderTextureFormat` builds a 4x4 texture and checks `FRAMEBUFFER_COMPLETE`; `getSupportedFormat` falls back R16F to RG16F to RGBA16F. - [script.js](https://raw.githubusercontent.com/PavelDoGreat/WebGL-Fluid-Simulation/master/script.js)
- The source contains no `webglcontextlost` or `webglcontextrestored` listener and no restoration logic. - [script.js](https://raw.githubusercontent.com/PavelDoGreat/WebGL-Fluid-Simulation/master/script.js)
- Safari support per BCD: `WebGL2RenderingContext` Safari 15, `EXT_color_buffer_half_float` Safari 14, `EXT_color_buffer_float` Safari 15. - [BCD WebGL2RenderingContext](https://github.com/mdn/browser-compat-data/blob/main/api/WebGL2RenderingContext.json), [BCD EXT_color_buffer_half_float](https://github.com/mdn/browser-compat-data/blob/main/api/EXT_color_buffer_half_float.json), [BCD EXT_color_buffer_float](https://github.com/mdn/browser-compat-data/blob/main/api/EXT_color_buffer_float.json)
- `OES_texture_float_linear` on iOS Safari carries the BCD note "Only supported on iPadOS." - [BCD OES_texture_float_linear](https://github.com/mdn/browser-compat-data/blob/main/api/OES_texture_float_linear.json)
- WebKit bug history on half-float targets: an early report said the `EXT_color_buffer_half_float` fix did not work for WebGL2 contexts on iOS/iPadOS 14.4; later comments say the extension is exposed on iOS in both WebGL 1.0 and 2.0, that iOS only supported 16-bit float render targets when WebGL2 first shipped there, and recommend RGBA16F for compatibility because RGB16F is not universal. (Search-result summary of the bug threads; the bug pages themselves were not fetched in full.) - [WebKit bug 217107](https://bugs.webkit.org/show_bug.cgi?id=217107), [WebKit bug 241399](https://bugs.webkit.org/show_bug.cgi?id=241399)
- Low Power Mode: WebKit engineer on the 30 fps rAF cap: "This is intentional. In fact the behavior in iOS 13 was a bug." and "Running rAF with 30fps is a little bit rough but it is okay." Bug resolved INVALID, last modified 2020-08-24. - [WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745)
- Context loss on iOS: Safari "can lose the WebGL context when the system is under memory pressure, when the user switches to another app and back, or when the tab is in the background for an extended period", after which textures, shaders and buffers are gone and the canvas is blank until restored. (Third-party guide, not Apple documentation.) - [abratabia iOS Safari gotchas](https://abratabia.com/mobile-web-games/ios-safari-gotchas.php)
- 2025 WebKit reports: a March 2025 bug describes context loss during buffer uploads on iOS 18 after which new WebGL contexts could not be created until the browser was killed; an October 2025 bug describes a reload loop under memory pressure on WebGL and texture-heavy pages. (Search-result summaries.) - [WebKit bug 289601](https://bugs.webkit.org/show_bug.cgi?id=289601), [WebKit bug 300782](https://bugs.webkit.org/show_bug.cgi?id=300782)

### Inferences
- On an iPhone, the script's WebGL2 path will most likely report linear filtering as unsupported (it keys off `OES_texture_float_linear`, which BCD says is iPadOS only), so it would run with the 512 dye buffer, bloom off, sunrays off and its manual-filter shader path. That is the cheaper configuration, and it is what the author's own code picks, not something we would need to add.
- Per-frame work is many full-screen passes over float targets: at minimum the 20 pressure iterations confirmed above, plus curl, vorticity, divergence, gradient-subtract and two advection passes (pass list is from reading the public source, not from a profiler). This is the reason it is the most battery-hungry option, and it never goes idle unless the code pauses it.
- Because the simulation is driven by rAF and a `dt`, the 30 fps Low Power Mode cap halves smoothness but does not break it.
- Missing context-loss handling means a blank canvas after an app switch on iOS unless we add listeners. Any WebGL choice needs `webglcontextlost` (preventDefault) and `webglcontextrestored` (rebuild) handlers.
- Derivatives (OGL's fluid example, various Codrops cursor-smoke demos) use the same solver; the cost profile is the same.

### Gaps
- COULD NOT VERIFY: measured fps or GPU time of this simulation on an iPhone 15/16. A Safari Web Inspector timeline on the test device against https://paveldogreat.github.io/WebGL-Fluid-Simulation/ would confirm it.
- COULD NOT VERIFY: specific open issues in the repo's tracker about iOS (the issue list was not fetched; only the count of 61 open issues was read).
- COULD NOT VERIFY: size of the `LDR_LLL1_0.png` dithering texture the script loads.

## 2. Fragment-shader smoke with no simulation (fbm, domain warping, curl noise, raymarched volumetrics)

### Takeaway
A single full-screen-triangle fragment shader running domain-warped fbm at low resolution and upscaled by CSS is the cheapest live technique and needs no library at all. If a helper is wanted, OGL's core is the smallest sensible one (README says 8 kb minzipped for core); three.js is roughly 195 KB gzip and is not justified for one quad.

### Cited Findings
- Technique: domain warping replaces `f(p)` with `f(g(p))`; the canonical two-step version uses one fbm to compute an offset that feeds a second fbm, e.g. `fbm(p + 4.0*q)`. - [Inigo Quilez, "warp"](https://iquilezles.org/articles/warp)
- fbm reference and the `fbm(st + fbm(st))` warping pattern. - [The Book of Shaders, chapter 13](https://thebookofshaders.com/13/)
- A WebGL reconstruction of Android's "Magic Smoke" wallpaper produces fluid-looking smoke from iterated fbm domain warping, with no fluid solver. - [Nebula Remix](https://duangsuse.github.io/NebulaRemix)
- A short Android smoke shader gist recommends rendering at 1/8 size for best performance. (Search-result summary; single source.) - [markusfisch gist](https://gist.github.com/markusfisch/b45c25ceedb3de076532e6083acb5ee8)
- Codrops has a vortex/smoke-style procedural shader tutorial, but it uses Three.js and TSL, so it is a look reference, not a no-three implementation. - [Codrops, procedural vortex with Three.js and TSL](https://tympanus.net/codrops/?p=88757)
- A fragment-shader "fluid smoke" UI demo using the `fbm(uv + r)` pattern (2026-02-04). - [freefrontend WebGL fluid smoke button](https://freefrontend.com/code/webgl-fluid-smoke-button-2026-02-04/)
- OGL: "Written in es6 modules with zero dependencies." README size table (labelled "Size (minzipped)"): Core 8kb, Math 6kb, Extras 15kb, Total 29kb. Licence: Unlicense ("free and unencumbered software released into the public domain"). README shows direct ES-module import from a CDN (`import { ... } from 'https://unpkg.com/ogl';`), which suits a no-build site, and recommends pinning the version. - [OGL repo](https://github.com/oframe/ogl)
- OGL measured, full UMD build (not tree-shaken, unminified): `ogl.umd.js` 280,796 bytes raw, 53,547 bytes gzip, version 1.0.11. - [ogl.umd.js](https://cdn.jsdelivr.net/npm/ogl/dist/ogl.umd.js)
- OGL measured, individual unminified source modules at 1.0.11 (gzip): Renderer.js 3,594; Program.js 3,088; Geometry.js 2,898; Mesh.js 845; Transform.js 764; extras/Triangle.js 241; Texture.js 2,023; RenderTarget.js 1,285. These files import math modules that were not measured. - [Renderer.js](https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/core/Renderer.js), [Program.js](https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/core/Program.js), [Geometry.js](https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/core/Geometry.js), [Mesh.js](https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/core/Mesh.js), [Transform.js](https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/core/Transform.js), [Triangle.js](https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/extras/Triangle.js), [Texture.js](https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/core/Texture.js), [RenderTarget.js](https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/core/RenderTarget.js)
- twgl.js 7.0.0 measured: `twgl.min.js` 80,561 raw, 21,506 gzip; `twgl-full.min.js` 106,052 raw, 29,344 gzip. - [twgl.min.js](https://cdn.jsdelivr.net/npm/twgl.js/dist/7.x/twgl.min.js), [twgl-full.min.js](https://cdn.jsdelivr.net/npm/twgl.js/dist/7.x/twgl-full.min.js)
- regl 2.1.1 measured: `regl.min.js` 86,652 raw, 28,432 gzip. - [regl.min.js](https://cdn.jsdelivr.net/npm/regl/dist/regl.min.js)
- three.js 0.187.0 measured: `three.module.min.js` 392,177 raw, 89,376 gzip, and `three.core.min.js` 422,062 raw, 105,266 gzip. - [three.module.min.js](https://cdn.jsdelivr.net/npm/three/build/three.module.min.js), [three.core.min.js](https://cdn.jsdelivr.net/npm/three/build/three.core.min.js)
- Warning on shader noise and battery: per-pixel noise "can significantly drain battery on mobile devices" when used in many places at once. (Search-result summary of a secondary source; unverified claim, no measurement.) - [shader-noise reference](https://skillselion.com/skills/bbeierle12/skill-mcp-claude/shader-noise)

### Inferences
- three.js total for a WebGL page is about 195 KB gzip (89,376 + 105,266) if `three.module.min.js` imports `three.core.min.js` as the split build implies. Either way it is at least 89 KB gzip, 4 to 8 times every alternative.
- Raw WebGL for one full-screen triangle plus one program is roughly 60 to 100 lines of JS plus the GLSL. No library download at all. This is the default recommendation for a no-build site; OGL is the fallback if a second pass (render target) is wanted.
- Fragment cost scales with pixel count times noise taps. A two-level warp with 4 octaves is on the order of 12 fbm evaluations (each 4 noise taps) per pixel. Rendering the canvas at a fixed small backing size (for example 1/4 to 1/8 of CSS pixels per axis, DPR ignored) and letting CSS stretch it cuts the pixel count by 16 to 64 times versus CSS size, and by far more versus DPR 3. Smoke is low-frequency, so bilinear upscaling hides it.
- A cheaper variant: sample a small tiling noise texture (64 to 256 px, a few KB) two or three times with scrolling, warped UVs instead of computing procedural noise. This turns the shader into a handful of texture reads.
- Raymarched volumetrics (many steps per pixel, each step sampling noise) are the expensive end of this family and are not needed for flat 2D smoke behind tiles.
- Curl noise is mainly useful to move particles or to warp UVs without divergence; as a pure look it is equivalent in cost to one or two extra fbm evaluations.
- Alpha output: the canvas must be created with premultiplied alpha (the WebGL default) and the shader must output premultiplied colour. Normal source-over compositing of the canvas under or over the product PNGs then needs no CSS `mix-blend-mode`, which respects the no-blend-modes constraint.

### Gaps
- COULD NOT VERIFY: a named Shadertoy smoke shader with a published mobile benchmark. Shadertoy pages were not fetched. Candidate search terms on shadertoy.com: "warp" (iq), "smoke", "fbm fog".
- COULD NOT VERIFY: bundlephobia min+gzip numbers for ogl, twgl.js, regl (API returned HTTP 429). https://bundlephobia.com/package/ogl would confirm.
- COULD NOT VERIFY: a Codrops tutorial that does fbm smoke in raw WebGL with no library. None surfaced in search.
- COULD NOT VERIFY: actual ms per frame for a warped-fbm shader at, say, 256x512 on an A18. Needs a device test.

## 3. 2D canvas particle smoke with soft sprites

### Takeaway
Workable for small, localised wisps (tens to low hundreds of large soft sprites), with zero library cost, but large translucent sprites mean heavy overdraw and the look is "puffs", not continuous vapour. No reliable phone benchmark was found.

### Cited Findings
- Chrome's 2D canvas uses the GPU for `drawImage`. (Chrome only; says nothing about Safari.) - [Chrome developers blog](https://developer.chrome.com/blog/taking-advantage-of-gpu-acceleration-in-the-2d-canvas)
- Construct's manual advises avoiding "more than a couple of hundred particles if possible" on mobile. (General engine guidance, not canvas-2D specific.) - [Construct 2 performance tips](https://www.construct.net/en/construct-2/manuals/construct-2/overview/performance-tips)
- Desktop anecdote: "5,000 particles at 60fps in Canvas is pretty damn good." (One Stack Overflow answer, desktop, not a benchmark.) - [Stack Overflow mirror](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/13405063/maximixing-the-speed-of-particle-rendering-on-html5-canvas)
- A canvas covering 20% of the viewport "uses roughly 80% less GPU memory than a full-screen canvas". - [ribbons.js performance guide](https://ribbons.js.org/blog/performance-guide.html)
- `OffscreenCanvas` is supported in Safari from 16.4. - [BCD OffscreenCanvas](https://github.com/mdn/browser-compat-data/blob/main/api/OffscreenCanvas.json)
- Existing small packages for this exist (`@bijection/smoke`, `@zakkster/lite-smoke`); their sizes and quality were not checked. - [npm @bijection/smoke](https://www.npmjs.com/package/@bijection/smoke), [pkgstats lite-smoke](https://www.pkgstats.com/pkg:@zakkster/lite-smoke)

### Inferences
- Cost is dominated by fill rate: N sprites times sprite area times alpha blending. 100 sprites of 200x200 px is 4 million blended pixels per frame at DPR 1, which is more than a full iPhone screen at DPR 1. Keeping the canvas backing store at DPR 1 or lower and sizing it to the effect area is the main lever.
- Canvas 2D additive or screen compositing (`globalCompositeOperation`) happens inside the canvas, not as a CSS blend over the product photos, so it does not trigger the CSS `mix-blend-mode` problem. Plain source-over with a soft white or tinted sprite is enough on a charcoal background.
- The same particle approach in WebGL (instanced or point sprites) is cheaper per sprite but brings back shader and context-loss handling.

### Gaps
- COULD NOT VERIFY: any measured particle count that holds 60 fps on iOS Safari canvas 2D, or the cost of `globalAlpha` there. Needs a device test with a counter.
- COULD NOT VERIFY: whether Safari's canvas 2D on iOS is GPU-backed for `drawImage` in current versions. A WebKit source or a device profile would confirm.

## 4. SVG feTurbulence + feDisplacementMap smoke and CSS-only smoke

### Takeaway
Animated `feTurbulence` is repeatedly reported as sluggish on iOS Safari and should not be animated per frame there. CSS-only smoke that moves pre-rendered images with `transform` and `opacity` is safe and cheap; anything relying on animated `filter` is the risk.

### Cited Findings
- GreenSock forum report: an animated `feTurbulence` effect is "really sluggish on iOS" while smooth on desktop, and leaving it running ends in Safari refreshing the tab and/or removing the animated content. - [GSAP forum thread 33075](https://greensock.com/forums/topic/33075-gsap-and-feturbulence-mobile-performance/)
- WebKit bug 267511: lagginess and artefacts with an SVG filter reproduced in Safari on macOS and iOS 17.2.1 but not in Firefox 121.0.1. (Search-result summary.) - [WebKit bug 267511](https://bugs.webkit.org/show_bug.cgi?id=267511)
- WebKit bug 287982: a grain filter built on `feTurbulence` with high `baseFrequency`; resolution not stated in the snippet. - [WebKit bug 287982](https://bugs.webkit.org/show_bug.cgi?id=287982)
- Mozilla bug note on turbulence cost: "the more octaves the worse the performance". (Firefox, not Safari.) - [Mozilla bug 1787793](https://bugzilla.mozilla.org/show_bug.cgi?id=1787793)
- Safari 26.0 release post lists only an `feMerge` positioning fix under SVG filters; nothing about filter performance or GPU acceleration. - [WebKit features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

### Inferences
- A static `feTurbulence` used once to generate a texture (not animated) is fine; the cost is re-running the filter every frame over a large region.
- The safe CSS-only pattern is two or three pre-rendered, tiling, transparent smoke images (WebP or AVIF stills) on their own layers, drifting with `transform: translate3d()` and cross-fading with `opacity`. Both properties are compositor-only, so no per-frame paint or JS. This is also the natural reduced-motion-adjacent fallback (section 9).
- CSS smoke that uses `filter: blur()` on moving elements, or `mix-blend-mode`, is the part to avoid: blur re-rasterises large areas and blend modes are already ruled out.

### Gaps
- COULD NOT VERIFY: whether Safari 26 or 27 GPU-accelerates `feTurbulence`. No WebKit statement found. A WebKit blog or bug stating "accelerated filters" for `feTurbulence` would confirm.
- No measured fps number for animated `feTurbulence` on current iPhones was found; evidence is forum and bug reports from 2022 to 2025.

## 5. Pre-rendered smoke: alpha video, stacked alpha, sprite sheets, animated AVIF/WebP, Lottie, Rive

### Takeaway
Pre-rendered gives the best-looking smoke for the least GPU work, but native alpha video is fragile on iOS: Safari only does alpha through HEVC (large files), and Low Power Mode blocks autoplay even when muted. Jake Archibald's stacked-alpha approach halves the file size but needs a small WebGL component. Lottie and Rive are vector tools and a poor fit for soft volumetric smoke, and their runtimes are 46 KB to 490 KB gzip.

### Cited Findings
- Same test clip, file sizes: animated AVIF "504 kB"; native VP9 alpha (Chrome/Firefox) "1.1 MB"; native HEVC alpha (Safari) "3.4 MB"; stacked AV1 "460 kB"; stacked HEVC for Apple devices without AV1 hardware decoding "1.14 MB"; the alpha half "only adds 8 kB". (This clip is a UI animation, not smoke.) - [Jake Archibald, Video with alpha transparency on the web](https://jakearchibald.com/2024/video-with-transparency/)
- Stacked technique: "Top half: colour data. Bottom half: alpha data." A WebGL fragment shader applies the bottom half as a mask to the top half. Web component: `stacked-alpha-video`. - [Jake Archibald](https://jakearchibald.com/2024/video-with-transparency/)
- `stacked-alpha-video` 1.0.10 package file sizes (raw, from the jsDelivr file listing): `build/StackedAlphaVideo.js` 5,379 bytes, `build/gl-helpers.js` 5,154 bytes, `build/index.js` 155 bytes. - [jsDelivr package data](https://data.jsdelivr.com/v1/packages/npm/stacked-alpha-video@1.0.10?structure=flat)
- Safari "supports VP9 but not VP9 with transparency"; Compressor-encoded native HEVC is "much larger" than equivalent VP9, and the ffmpeg VideoToolbox route is "around double the file size" of the Compressor result. - [Jake Archibald](https://jakearchibald.com/2024/video-with-transparency/)
- AV1 hardware decode on Apple: used by "Safari on iPhone 15 Pro or M3 MacBook Pro & newer"; other Apple devices "don't support AV1". - [Jake Archibald](https://jakearchibald.com/2024/video-with-transparency/)
- Animated AVIF: Safari "doesn't correctly support transparency in an animated AVIF" and "its horrendously slow"; Chrome and Firefox struggle to hit 60 fps "even on an ultra high-end laptop"; on Android it "struggles to hit even a few frames per second". (Written 2024.) - [Jake Archibald](https://jakearchibald.com/2024/video-with-transparency/)
- Apple forum thread title: "Animated AVIF is rendered slowly on Safari". - [Apple Developer Forums 743834](https://developer.apple.com/forums/thread/743834)
- Android issues with native VP9 alpha (2024): Chrome Android "gets the alpha channel wrong" (fix in Canary at the time); Firefox Android "Playback often stalls". - [Jake Archibald](https://jakearchibald.com/2024/video-with-transparency/)
- HEVC with alpha has been supported by Safari since iOS 13 and macOS Catalina. - [Apple WWDC19 session 506](https://developer.apple.com/videos/play/wwdc2019/506/)
- Encoding: stacked layout filter `-filter_complex "[0:v]format=pix_fmts=yuva444p[main]; [main]split[main][alpha]; [alpha]alphaextract[alpha]; [main][alpha]vstack"`; native VP9 alpha uses `-pix_fmt yuva420p -c:v libvpx-vp9 -crf "$CRF" -b:v 0`; HEVC alpha via `-c:v hevc_videotoolbox -require_sw 1 -alpha_quality 0.1 -tag:v hvc1 -q:v 35` (macOS only). - [Jake Archibald](https://jakearchibald.com/2024/video-with-transparency/)
- Low Power Mode and autoplay, WebKit maintainer: "Autoplay is disabled when in low power mode to conserve battery, so we always show the 'play' button for videos with the autoplay attribute so it is possible for the user to start them." - [WebKit bug 219889](https://bugs.webkit.org/show_bug.cgi?id=219889)
- In Low Power Mode, `play()` on an autoplay video rejects with `NotAllowedError`; not present in normal mode. - [WebKit bug 216887](https://bugs.webkit.org/show_bug.cgi?id=216887)
- iOS does not expose Low Power Mode to web pages. (Third-party statement.) - [Veriff known issues](https://devdocs.veriff.com/docs/known-issues)
- Inline playback: `playsinline` is supported in Safari (BCD lists 10, with an earlier prefixed form at 8). WebKit's iOS video policy post is the primary reference for muted inline autoplay. - [BCD video element](https://github.com/mdn/browser-compat-data/blob/main/html/elements/video.json), [WebKit, New video policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/)
- Lottie runtime measured (lottie-web 5.13.0): `lottie_light.min.js` 168,394 raw, 46,396 gzip; `lottie.min.js` 305,704 raw, 76,046 gzip. - [lottie_light.min.js](https://cdn.jsdelivr.net/npm/lottie-web/build/player/lottie_light.min.js), [lottie.min.js](https://cdn.jsdelivr.net/npm/lottie-web/build/player/lottie.min.js)
- dotLottie wasm player measured: `dotlottie-player.wasm` 1,225,695 raw, 492,219 gzip. - [dotlottie-player.wasm](https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm)
- Rive runtime measured (`@rive-app/canvas-lite` 2.50.0): `rive.js` 545,250 raw, 122,470 gzip; `rive.wasm` 859,338 raw, 352,880 gzip. - [rive.js](https://cdn.jsdelivr.net/npm/@rive-app/canvas-lite/rive.js), [rive.wasm](https://cdn.jsdelivr.net/npm/@rive-app/canvas-lite/rive.wasm)

### Inferences
- A native `<video>` with alpha layered over the page has two hard failure modes on the owner's test phone: a 3x larger HEVC file, and a visible play button or a frozen first frame in Low Power Mode. If video is used, do not use the `autoplay` attribute as the only trigger; call `play()` from JS and treat the rejected promise as the signal to show the still fallback. That rejection is also the only practical Low Power Mode signal available to a page.
- Stacked alpha (AV1 with HEVC fallback, about 10.7 KB raw of component JS before minification) is the best pre-rendered route for file size, but it is a WebGL canvas, so it inherits context-loss handling, and it still depends on video playback being allowed.
- On a charcoal site, smoke does not actually need an alpha channel if it sits behind the tiles: an opaque video whose background is exactly the page colour avoids alpha entirely. The risk is colour mismatch between video decode and CSS colour (visible box edges), which is the same class of bug as the earlier white-box problem, so this needs a device check before being relied on. A soft CSS `mask-image` gradient on the video edge would hide small mismatches.
- A sprite sheet (one WebP or AVIF atlas of N frames, stepped with CSS `steps()` on `background-position` or `transform`) autoplays regardless of Low Power Mode, needs no JS and no decoder pipeline, and alpha works in every browser. The limit is frame count times resolution: smoke is soft, so small frames (for example 256 px) upscaled are plausible, but memory is width x height x 4 bytes decoded, so a 4096x4096 atlas costs about 64 MB of decoded memory (arithmetic, not a sourced figure).
- Seamless looping for any pre-rendered route is done at authoring time: render a loop longer than needed and cross-dissolve the tail over the head, or use a simulator's loop feature. Two layers of different loop lengths (say 7 s and 11 s) drifting over each other hide the repeat without extra frames.
- Lottie and Rive draw vector shapes; soft volumetric smoke would have to be embedded raster frames or heavy blur, which defeats the purpose. Their runtimes alone exceed every shader option.

### Gaps
- COULD NOT VERIFY: file size for a few seconds of looping smoke specifically, in any of these formats. Smoke is all semi-transparency and grain, which Jake Archibald notes will "likely grow more" than his UI clip. Encoding one 4 s test clip at 480 px in stacked AV1, HEVC alpha and a WebP sprite sheet would give real numbers.
- COULD NOT VERIFY: whether animated AVIF alpha and speed in Safari have been fixed since 2024. A Safari 26.x or 27.x release note mentioning animated AVIF would confirm. The Safari 26.0 post does not mention animated image formats.
- COULD NOT VERIFY: whether Safari has shipped WebM/VP9 alpha. One 2026 blog says it is "coming" but "going to take a while to land"; no Apple or WebKit source found. - [rotato blog](https://rotato.app/blog/transparent-videos-for-the-web)
- COULD NOT VERIFY: animated WebP decode cost on iOS. Not researched.
- COULD NOT VERIFY: current status (iOS 26/27) of the Low Power Mode autoplay block. The cited bugs are from 2020 to 2021; a device test with Low Power Mode on is the confirmation.
- Whether `rive.js` embeds the wasm or loads `rive.wasm` separately was not checked, so total Rive transfer is between 122 KB and 475 KB gzip.

## 6. Where to get smoke footage or simulations with commercial licences, and rough cost

### Takeaway
ActionVFX is the best-documented stock source with commercial-use licensing, priced by credits; EmberGen is the purpose-built real-time simulator at roughly 300 USD (third-party figure, official page not read); Blender is free and its output is unencumbered. Prices here are thinly verified.

### Cited Findings
- ActionVFX free packs are licensed for commercial projects: a 2022 free Inferno Collection included nine pre-keyed smoke, fire and spark clips in 2K MOV "licensed for use in commercial projects"; a January 2026 free Flamethrowers pack was "licensed for commercial use", needed a free account, and was free for one week. - [CG Channel, 2022](https://www.cgchannel.com/2022/05/download-actionvfx-and-filmpacs-free-inferno-collection), [CG Channel, January 2026](https://www.cgchannel.com/2026/01/download-30-free-flamethrower-effects-clips-from-actionvfx/)
- ActionVFX pricing is credit-based: the Flamethrowers pack was previously "20 download credits: equivalent to $276 on a monthly Individual subscription". (That is a 30-clip pack, not a smoke pack.) - [CG Channel, January 2026](https://www.cgchannel.com/2026/01/download-30-free-flamethrower-effects-clips-from-actionvfx/)
- ActionVFX has also released free smoke and explosion VDB volumes (2023) and 20 free 2K smoke plume clips (2016). - [CG Channel, 2023](https://www.cgchannel.com/2023/11/download-three-free-smoke-and-explosion-vdbs-from-actionvfx/), [CG Channel, 2016](https://www.cgchannel.com/2016/07/get-20-free-smoke-plume-and-10-dust-wave-fx-clips)
- Envato Elements carries smoke packs; some stock smoke ships on black, not with alpha: "Some of the products may have a black background instead of an alpha channel." - [Envato Elements smoke](https://elements.envato.com/smoke-2MY22GS), [AEJuice smoke](https://aejuice.com/product/smoke)
- EmberGen pricing (third-party reports of the official page): permanent indie licence 300 USD for the first year with 12 months of updates, optional 180 USD per year maintenance, plus a monthly rent-to-own option; Indie tier is for revenue or funding under 1M USD. Historical 2021 price was 199.99 USD perpetual or 19.99 USD per month. - [rfp.wiki EmberGen](https://www.rfp.wiki/design-multimedia/media-entertainment/3d-animation-vfx-software/embergen), [80.lv, 2021 price cut](https://80.lv/articles/jangafx-reduces-the-price-of-embergen-for-indie-users), [JangaFX pricing page](https://jangafx.com/software/pricing)

### Inferences
- Footage on black (no alpha) is usable on a dark charcoal site in two ways that avoid CSS blend modes: convert luminance to alpha once at authoring time (ffmpeg or a compositor) and export real alpha, or do the luma-to-alpha in a fragment shader. Do not rely on `mix-blend-mode: screen`.
- For a tasteful product-store wisp, a self-rendered loop (Blender Mantaflow, free; or EmberGen, which exports image sequences and flipbook atlases and is built for looping game smoke) gives control over colour, speed and loop point that stock clips do not. Stock is faster if a suitable slow plume exists.
- Blender itself is GPL but renders produced with it are the author's own; no licence cost. (Standard position of the Blender Foundation; not fetched in this research, so treat as COULD NOT VERIFY until https://www.blender.org/about/license/ is read.)

### Gaps
- COULD NOT VERIFY: current ActionVFX subscription and per-credit prices and licence text (pricing page returned HTTP 429). https://www.actionvfx.com/pricing and its licence page would confirm.
- COULD NOT VERIFY: EmberGen price from the official page directly (page not readable through search; figures above are third-party).
- Not researched: Houdini Indie pricing, Pexels/Pixabay/Videvo free smoke clips and their licences, Artgrid/Storyblocks subscription prices. The Pexels and Pixabay licence pages would be the place to confirm free commercial use.

## 7. WebGPU status on iOS Safari in 2026 and whether it matters here

### Takeaway
WebGPU has shipped by default in Safari on iOS since Safari 26.0 (2025-09-15). It does not matter for this job: a single low-resolution fragment shader gains nothing from it, and WebGL2 is still needed as the fallback for older iOS and non-Apple browsers.

### Cited Findings
- "WebGPU ... is now shipping in Safari 26.0 for macOS, iOS, iPadOS, and visionOS." Also: "WebGPU supersedes WebGL on macOS, iOS, iPadOS, and visionOS and is preferred for new sites and web apps", "It maps better to Metal, and the underlying hardware", and WebGL "required significant translation overhead due to being derived from OpenGL". Published 2025-09-15. - [WebKit features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- BCD: `GPU` interface and the `webgpu` canvas context are supported from Safari 26. Chrome: 113 partial (ChromeOS, macOS, Windows), 144 adds Linux on Intel Gen12+. Firefox: 141 partial (Windows; macOS Tahoe on Apple silicon from 145; no Linux). - [BCD GPU](https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json), [BCD HTMLCanvasElement](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLCanvasElement.json)
- web.dev lists WebGPU as available in iOS 26, iPadOS 26, macOS Tahoe 26 and visionOS 26. - [web.dev, WebGPU supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers)
- A Safari 27.2 beta entry mentions WebGPU fixes, i.e. the implementation is still being stabilised. (Third-party release tracker.) - [releasebot Safari](https://releasebot.io/updates/apple/safari)

### Inferences
- iPhones still on iOS 18 or earlier have no WebGPU, and Android Chrome and Firefox coverage is partial, so a WebGPU-only effect would need a WebGL2 twin. For one quad and one shader that doubles the code for no visible gain.
- WebGPU would only earn its place if the plan grew into a compute-shader fluid or particle simulation. That is outside "tasteful, cheap smoke".

### Gaps
- COULD NOT VERIFY: any measured power or frame-time advantage of WebGPU over WebGL2 for a simple full-screen fragment shader on iPhone. No source found.
- COULD NOT VERIFY: the share of iPhone traffic on iOS 26 or later as of November 2026. Apple's developer support page for iOS adoption would confirm.

## 8. Scroll-linked and interaction-linked smoke: support and battery hygiene

### Takeaway
CSS scroll-driven animations work in Safari from 26.0 (with reliability fixes through 26.5), same-document View Transitions from Safari 18 and cross-document from 18.2, so both can be used behind `@supports` on the test device. Battery hygiene is standard: pause when off-screen or hidden, cap resolution, and assume a 30 fps rAF in Low Power Mode.

### Cited Findings
- `animation-timeline`, including `scroll()` and `view()`: Safari 26, Chrome 115, Firefox 159. - [BCD animation-timeline](https://github.com/mdn/browser-compat-data/blob/main/css/properties/animation-timeline.json)
- Safari 26.0 release post confirms scroll-driven animations and shows `animation-timeline: view()` with `animation-range: 0% 50%`. - [WebKit features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- Later point releases: a Safari 27.3 note says accelerated scroll-driven animations have run in the remote layer tree "since Safari 26.3"; Safari 26.5 includes four reliability fixes, including scroll-driven animations "not being properly paused when animation-play-state was dynamically set to paused". (Search-result summaries of Apple release notes.) - [Safari 27.3 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-27_3-release-notes), [WebKit features for Safari 26.5](https://webkit.org/?p=17938)
- Authoring rule: `animation-timeline` must be declared after the `animation` shorthand or it will not work. - [WebKit, A guide to scroll-driven animations with just CSS](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/)
- View Transitions: `document.startViewTransition` Safari 18, Chrome 111, Firefox 144. Cross-document `@view-transition` Safari 18.2, Chrome 126, Firefox preview only. - [BCD Document](https://github.com/mdn/browser-compat-data/blob/main/api/Document.json), [BCD @view-transition](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/view-transition.json)
- Safari 26.0 fixed "an issue causing a `<canvas>` element to disappear for one frame if a view transition occurs". - [WebKit features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- Low Power Mode caps rAF at 30 fps by design. - [WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745)
- Claim that Low Power Mode also throttles CSS animations: "iOS throttles `requestAnimationFrame` in low-power mode, along with all CSS animations." (Article dated 2020-10-01; single source; the WebKit bug above does not confirm the CSS part.) - [Motion, When browsers throttle requestAnimationFrame](https://motion.dev/magazine/when-browsers-throttle-requestanimationframe)
- Safari also throttles rAF to 30 fps in cross-origin iframes until the user taps inside. - [Motion](https://motion.dev/magazine/when-browsers-throttle-requestanimationframe), [Popmotion](https://popmotion.io/blog/20180104-when-ios-throttles-requestanimationframe)
- There is no web API to detect Low Power Mode; WebKit has not implemented the Battery Status API. - [Popmotion](https://popmotion.io/blog/20180104-when-ios-throttles-requestanimationframe)
- Mobile devices report `devicePixelRatio` of 3 or more, and rendering at that scale multiplies pixel work. - [ribbons.js performance guide](https://ribbons.js.org/blog/performance-guide.html)

### Inferences
- Firefox 159 for `animation-timeline` appears to be at or just ahead of the current Firefox release as of this date, so treat Firefox as unsupported and wrap scroll-driven smoke in `@supports (animation-timeline: view())`. Without support the smoke simply does not react to scroll, which is an acceptable fallback.
- Scroll-linked smoke done in CSS (opacity or translate of a smoke layer tied to `view()`) costs no JS and no rAF, so it is unaffected by the rAF cap and cannot drain battery while the page is still. This is the cheapest way to make smoke feel responsive.
- For a canvas effect: start and stop the rAF loop from an `IntersectionObserver`, stop on `visibilitychange` when `document.hidden`, stop after a few seconds of no input if the effect is ambient, and never run more than one canvas loop at a time. A stopped loop costs nothing; a running one keeps the GPU awake at 60 Hz.
- Ignore `devicePixelRatio` for smoke entirely: set the canvas backing store to a fixed small size and let CSS scale it. On a DPR 3 phone that is at least a 9x saving before any further downscale.
- Measure rAF delta for the first second; if frames arrive at about 33 ms the device is in Low Power Mode or throttled, and the effect should drop to the cheap fallback instead of running a heavy shader at 30 fps.
- A View Transition snapshots the page, so a live canvas is frozen during the transition. Pausing the smoke loop for the transition duration avoids a visible jump.
- Thermal state is not observable from the web. The only defence is a low duty cycle: small buffers, pauses, and short-lived bursts instead of a permanent animation.

### Gaps
- COULD NOT VERIFY: whether Low Power Mode on current iOS throttles CSS animations and scroll-driven animations (one 2020 article says CSS is throttled; WebKit's bug does not address it). A device test with a CSS animation and Low Power Mode toggled would settle it.
- COULD NOT VERIFY: whether the 30 fps cap still applies on iOS 26/27 and how it interacts with 120 Hz ProMotion. iPhone 16 Plus is a 60 Hz panel, so ProMotion does not affect the owner's test device, but the cap should be confirmed on it.
- IntersectionObserver and Page Visibility support were not looked up in BCD in this pass (both are long-standing; https://github.com/mdn/browser-compat-data/blob/main/api/IntersectionObserver.json would confirm exact versions).
- No source found with measured battery drain for a continuously running small WebGL canvas on iPhone.

## 9. Reduced-motion and Low Power Mode fallback design

### Takeaway
Design three tiers: live effect, slow compositor-only CSS drift, and a still frame. Reduced motion gets the still; Low Power Mode cannot be detected directly, so infer it from a rejected `play()` promise or a 30 fps rAF cadence and drop to the CSS drift or the still.

### Cited Findings
- Low Power Mode cannot be read by a page: no Battery Status API in WebKit. - [Popmotion](https://popmotion.io/blog/20180104-when-ios-throttles-requestanimationframe)
- In Low Power Mode, autoplay is disabled and Safari shows a play button on `autoplay` videos; `play()` rejects with `NotAllowedError`. - [WebKit bug 219889](https://bugs.webkit.org/show_bug.cgi?id=219889), [WebKit bug 216887](https://bugs.webkit.org/show_bug.cgi?id=216887)
- Recommended handling when `play()` is rejected: "smoothly switch to a fallback", such as an animated image or a visible Play button. (Third-party guide.) - [testmuai autoplay policies](https://www.testmuai.com/blog/video-audio-autoplay-policies-across-browsers/)
- rAF runs at 30 fps in Low Power Mode by design. - [WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745)
- Safari 26.5 fixed scroll-driven animations not pausing when `animation-play-state` was set to `paused` dynamically, which matters if the fallback toggles play state. - [WebKit features for Safari 26.5](https://webkit.org/?p=17938)

### Inferences
- Tier A, live: the shader or sprite effect, only when `matchMedia('(prefers-reduced-motion: no-preference)')` matches, the element is on screen, the tab is visible and rAF cadence is about 16.7 ms.
- Tier B, drift: one or two pre-rendered transparent smoke stills moved with a very slow `transform` and `opacity` keyframe loop (20 s or longer). No JS, no canvas, no video, so nothing for Low Power Mode to block. Use this when rAF cadence is about 33 ms, when WebGL context creation fails or is lost, or when `play()` rejects.
- Tier C, still: the same smoke image, static. This is the `prefers-reduced-motion: reduce` state and also the first paint for everyone, so the live effect fades in over it and there is never an empty box. Reduced motion should remove the motion, not the atmosphere.
- Write the CSS so the still is the default and motion is added inside `@media (prefers-reduced-motion: no-preference)`. Listen for changes on the media query so toggling the setting mid-session takes effect.
- Never use the `autoplay` attribute alone for decorative video: in Low Power Mode it produces a visible play button over the product. Use a poster image, call `play()` in JS, and keep the poster if the promise rejects.
- The script that starts tier A should be a deferred ES module loaded after first paint (or on idle), so the effect can never block rendering and a load failure just leaves tier C in place.

### Gaps
- `prefers-reduced-motion` Safari version was not confirmed from BCD (the fetch path returned 404). https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion would confirm; it has been supported in Safari for years.
- No WebKit or Apple guidance was found that prescribes a Low Power Mode fallback pattern for decorative animation; the tiering above is inference from the cited behaviours.
- COULD NOT VERIFY: whether a slow CSS opacity or transform loop is itself throttled or paused in Low Power Mode (see section 8 gap). If it is throttled to 30 fps, a 20 s drift would still look smooth.

## Comparison summary (drawn only from the findings above)

| Technique | JS/runtime cost (gzip) | Per-frame cost | Known iOS Safari problems | Blend-mode safe |
|---|---|---|---|---|
| Fluid sim (Dobryakov) | 11.2 KB unminified script, measured | Highest: 20 pressure passes plus advection on float targets every frame | No context-loss handling; 30 fps in LPM; float-linear is iPadOS only so it self-downgrades | Yes (own canvas) |
| Fragment shader, raw WebGL | 0 KB library | Low if backing store is small; scales with pixels x noise taps | Context loss; 30 fps in LPM | Yes |
| Fragment shader via OGL | README: 8 kb core minzipped; full UMD 53.5 KB measured | Same as above | Same as above | Yes |
| twgl / regl / three | 21.5 KB / 28.4 KB / 89 to 195 KB measured | Same shader cost | Same as above | Yes |
| Canvas 2D soft particles | 0 KB library | Overdraw bound; no phone benchmark found | 30 fps in LPM | Yes (compositing inside canvas) |
| Animated feTurbulence | 0 KB | Reported sluggish on iOS, tab reloads | WebKit bugs 267511, 287982; GSAP forum report | Yes, but slow |
| CSS drift of stills | 0 KB plus image bytes | Compositor only | None found | Yes |
| Native alpha video | 0 KB | Decoder only | HEVC alpha 3.4 MB vs 1.1 MB VP9 on test clip; LPM blocks autoplay and shows play button | Yes |
| Stacked alpha video | about 10.7 KB raw component | Decoder plus one shader pass | LPM autoplay block; context loss | Yes |
| Sprite sheet | 0 KB | Compositor only; decoded memory is the limit | None found | Yes |
| Animated AVIF | 0 KB | "horrendously slow" in Safari (2024) | Alpha not rendered correctly in Safari (2024) | n/a |
| Lottie / Rive | 46 to 76 KB / 122 KB JS plus 353 KB wasm, measured | Vector runtime | Wrong tool for soft smoke | Yes |
