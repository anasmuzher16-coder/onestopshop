# Tooling, plugins, skills and MCP servers that would raise the quality of an agent-built web smoke animation (read 2026-11-14)

Conventions: "COULD NOT VERIFY" means the README or docs I could fetch did not confirm it. "Secondhand" means the fact came from a third-party page, not the vendor's own. Last-commit dates were not exposed by the GitHub pages as fetched, so most are COULD NOT VERIFY; star counts are as read on 2026-11-14.

## 1. MCP servers for 3D/VFX authoring (Blender, Houdini, EmberGen, After Effects, Fusion, TouchDesigner, Unity/Unreal)

### Takeaway
Two real Blender MCP servers exist (the community one, now renamed "MCP for Blender", and an official Blender Lab one). Both work by running agent-written Python inside Blender, so they can in principle script a Mantaflow smoke bake, but neither documents simulation support, and Mantaflow baking from Python/background mode has a record of crashes and a transparent-film bug. For one hero effect whose primary path is a fragment shader, a Blender MCP is overkill; plain `blender --background --python` (no MCP) is the lighter route if plates are ever simulated.

### Cited Findings
- Community server: repo renamed from `blender-mcp` to `mcp-for-blender`; 34.4k stars, MIT, 28 open issues, 30 open PRs, 272 commits; releases section empty; last commit date COULD NOT VERIFY. - [github.com/ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Community server features: socket link between client and Blender; `execute_blender_code` (arbitrary Python); a `look` tool giving "Multi-angle, camera, wireframe, X-ray and animation-strip views, plus renders, so the AI checks its own work"; asset pulls from Poly Haven, Sketchfab, Poly Pizza and AI 3D generators, some behind a paid "Premium" tier. Simulation is not mentioned. Headless/background mode is not mentioned. - [github.com/ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Community server install on Windows: needs Blender 3.0+, Python 3.10+, and uv. Either `irm https://www.mcp-for-blender.com/install.ps1 | iex`, or `winget install --id=astral-sh.uv -e` then `uvx mcp-for-blender setup` and `uvx mcp-for-blender install-addon`. Known Windows snag: `spawn uvx ENOENT` in GUI clients, fixed with the full uvx path or `cmd /c uvx mcp-for-blender`. - [github.com/ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Community server security: "The `execute_blender_code` tool allows running arbitrary Python code in Blender"; "the addon's socket server has no authentication or encryption"; safe mode (`BLENDER_MCP_SAFE_MODE=1`) is off by default; a "minimal anonymous usage record" is collected unless `DISABLE_TELEMETRY=true`, and data "may be used to improve MCP for Blender, for research, and to train AI models." - [github.com/ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- Official server (Blender Lab): v1.0.0 on 27 Apr 2026, v1.0.3 on 11 Sep 2026; requires Blender 5.1+; free, GPL-3.0-or-later; 26 tools (code execution, blend-file and object summaries, screenshots, viewport navigation, thumbnail and viewport renders, search over bundled Python API reference and manual). Six tools have `_for_cli` variants that open a .blend in a background Blender process. Secondhand: the Blender pages themselves returned HTTP 403 to my fetch. - [StraySpark comparison, published 25 Sep 2026, updated 3 Nov 2026](https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026); primary pages (not fetchable): [blender.org/lab/mcp-server](https://www.blender.org/lab/mcp-server/), [projects.blender.org/lab/blender_mcp](https://projects.blender.org/lab/blender_mcp)
- Official server security: the Lab's page says it will "execute LLM generated code in Blender without any guards" and recommends "a virtual machine, or a system without access to sensitive information"; the bundled `weak_sandbox.py` describes itself as "more of a slap on the wrist". Secondhand quote. - [StraySpark comparison](https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026)
- Both Blender servers default to localhost port 9876, so only one can be wired up at a time without reconfiguring. Secondhand (search summary of the same article). - [StraySpark comparison](https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026)
- Mantaflow from Python is fragile: a developer reported `bpy.ops.manta.bake_data()` crashing Blender; a bug report says a render started from Python does not render the Mantaflow domain and hangs; another says background mode rendered despite an error; a further report says fire without smoke does not render with transparent film in EEVEE and Cycles. All are older reports; current status COULD NOT VERIFY. - [devtalk feature request](https://devtalk.blender.org/t/feature-request-mantaflow-bake-command/11105); [blender-addons #73618](https://projects.blender.org/blender/blender-addons/issues/73618); [blender #87828](https://projects.blender.org/blender/blender/issues/87828); [T78314](https://developer.blender.org/T78314)
- Blender's own CLI can render a numbered image sequence in background mode (`-o //render_####` then `-f` or `-a`, PNG among the formats). - [Blender manual, command line arguments](https://docs.blender.org/manual/en/4.4/advanced/command_line/arguments.html)
- Houdini MCP servers exist (community): oculairmedia/houdini-mcp (via hrpyc, RPC port 18811), fxhoudinimcp on PyPI (167 tools), eetumartola/houdini-mcp (66 tools), capoom/houdini-mcp. Not individually verified beyond listing pages; licences and dates COULD NOT VERIFY. - [lobehub listing](https://lobehub.com/mcp/oculairmedia-houdini-mcp); [pypi fxhoudinimcp](https://pypi.org/project/fxhoudinimcp/0.3.1/); [glama capoom/houdini-mcp](https://glama.ai/mcp/servers/capoom/houdini-mcp)
- TouchDesigner MCP servers exist (community): 8beeeaaat/touchdesigner-mcp (MIT, bridges to the WebServer DAT), Pantani/tdmcp, dreamrec/tdpilot, and a Derivative community post about a TDMCP beta. Not individually verified. - [mcpservers.org listing](https://mcpservers.org/servers/8beeeaaat/touchdesigner-mcp); [github.com/Pantani/tdmcp](https://github.com/Pantani/tdmcp); [derivative.ca post](https://derivative.ca/community-post/derivative-tdmcp-mcp-server-touchdesigner-beta/75406)
- After Effects MCP servers exist (community): Dakkshin/after-effects-mcp (original, ExtendScript bridge) and forks (a-y-ibrahim, TheLlamainator), p10q/ae-mcp. All need After Effects running locally with a bridge panel. Not individually verified. - [github.com/a-y-ibrahim/after-effects-mcp](https://github.com/a-y-ibrahim/after-effects-mcp); [mcpservers.org p10q/ae-mcp](https://mcpservers.org/de/servers/p10q/ae-mcp)

### Inferences
- "Can a Blender MCP drive Mantaflow and render transparent frames headlessly": possible only via arbitrary Python, undocumented by either server, and the Mantaflow-from-Python path is the part with the bug history. Treat as COULD NOT VERIFY, not as a supported feature.
- The MCP layer adds nothing a one-off `bake.py` script would not; its value is interactive scene building, which this job does not need.
- Houdini, After Effects and TouchDesigner MCPs all presuppose owning and running the host app. None is justified for a single shader effect.

### Gaps
- EmberGen MCP: none found (no search surfaced one; I did not run a dedicated second search, so treat as "none found in the searches run").
- DaVinci Resolve/Fusion MCP, Unity VFX Graph MCP, Unreal Niagara MCP: not searched specifically; no finding either way.
- Official Blender Lab pages could not be fetched (403), so its install steps and exact tool names are unconfirmed at the primary source.

## 2. MCP servers and tools for shader work (compile, lint, render without a human)

### Takeaway
No mature, widely-adopted shader MCP was found. The few that exist are either zero-star, tied to another product, or need a UI host. The existing Playwright setup already does the job: load the page, read `gl.getShaderInfoLog` from the console, screenshot. The only cheap addition worth considering is `glslangValidator` as an offline lint, and even that is optional because the browser's own compiler is the one that matters.

### Cited Findings
- agent-shader (rbstxt/agent-shader): npm CLI plus MCP server plus skill; "Rendering launches Chromium through Playwright and requests a WebGL 1 context with antialiasing disabled"; tools `validate_shader`, `render_shader`, `test_shader`, `build_shader_object`; outputs PNGs and a JSON report; MIT; Node 22+; 0 stars, 9 commits; built around Panzoid shader JSON, not general pages. Last commit COULD NOT VERIFY. - [github.com/rbstxt/agent-shader](https://github.com/rbstxt/agent-shader)
- @modelcontextprotocol/server-shadertoy: a demo MCP App that "renders ShaderToy-compatible GLSL fragment shaders in real-time using WebGL 2.0"; single `render-shadertoy` tool; "Displays compilation errors in an overlay" (in the UI); must be viewed in "the basic-host example or another MCP Apps-compatible host". Whether errors or frames come back to the model: COULD NOT VERIFY. Licence not stated on the page. - [modelcontextprotocol/ext-apps shadertoy-server](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/shadertoy-server)
- ShaderToy-MCP (wilsonchenghy): fetches and searches Shadertoy shaders; it is a reference lookup, not a compiler or renderer. Secondhand from listing. - [glama listing](https://glama.ai/mcp/servers/@wilsonchenghy/ShaderToy-MCP)
- shaderc-vkrunner-mcp: compiles GLSL to SPIR-V and runs via Vulkan/Mesa; desktop Vulkan, not WebGL; frame output COULD NOT VERIFY. - [ecosyste.ms entry](https://awesome.ecosyste.ms/projects/github.com%2Fmehmetoguzderin%2Fshaderc-vkrunner-mcp)
- glslang (Khronos reference compiler, includes `glslangValidator`): latest release 16.6.0, dated 2026-09-10/11; takes a `.frag` file and prints warnings and errors. Prebuilt Windows binary in the release assets: COULD NOT VERIFY (12 assets listed, names not shown). - [github.com/KhronosGroup/glslang/releases](https://github.com/KhronosGroup/glslang/releases)
- glslViewer (patriciogonzalezvivo): has a `--headless` flag ("headless rendering. Very useful for making images or benchmarking") and `-E <command>` to run a command and exit; Windows requires compiling with Visual Studio 2019+. - [glslViewer wiki, Using GlslViewer](https://github.com/patriciogonzalezvivo/glslViewer/wiki/Using-GlslViewer); [Compile on Windows](https://github.com/patriciogonzalezvivo/glslViewer/wiki/Compile-on-Windows)

### Inferences
- glslang validates desktop/Vulkan GLSL and ESSL, but passing it does not guarantee Safari's compiler accepts the shader, and failing precision rules on iOS will not show up. The real compile check stays in the browser.
- glslViewer on Windows means a Visual Studio build; that cost outweighs the benefit when Playwright can already render the actual page.
- A 15-line local harness (HTML page that compiles the shader, prints the info log, and exposes a `?t=` time parameter for deterministic frames) gives the agent everything a shader MCP would, with zero new dependencies.

### Gaps
- glsl-canvas (VS Code extension) and other hot-reload previewers were not researched; they target a human watching an editor, which the agent cannot use.
- Shadertoy's official API (needs an app key) was not checked for current status.

## 3. Ways for an agent to evaluate motion rather than stills

### Takeaway
This is where the gap closes, and it needs no new product: Playwright's Screencast API (v1.59+) can save a video and hand JPEG frames with timestamps to code, Chrome DevTools MCP upstream now has `screencast_start`/`screencast_stop` (mp4) plus performance traces and CPU throttling, and ffmpeg tiles frames into one contact sheet the agent can read. No published "agent reviews an animation" skill or workflow was found, so the plan should write its own small review script.

### Cited Findings
- Playwright Screencast API: `page.screencast.start({ path, onFrame, quality, size, fps })`. `onFrame` "receives JPEG-encoded frame data" with `timestamp`, `viewportWidth`, `viewportHeight`; `path` saves a video on stop (example uses `video.webm`); `fps` option added in v1.64, default 25; Firefox and WebKit "currently capture up to 25 frames per second"; default size is the viewport scaled to fit 800x800. All methods added in v1.59. - [playwright.dev/docs/api/class-screencast](https://playwright.dev/docs/api/class-screencast)
- Playwright classic video: `recordVideo: { dir }` on `browser.newContext()`; "The video size defaults to the viewport size scaled down to fit 800x800"; the file is only available after the context closes. Format and frame rate not stated on that page. - [playwright.dev/docs/videos](https://playwright.dev/docs/videos)
- Chrome DevTools MCP upstream tool list includes `screencast_start` ("Starts recording a screencast (video) of the target page", output .mp4) and `screencast_stop`, `performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight`, and `emulate` with `cpuThrottlingRate` ("Represents the CPU slowdown factor"). Repo: 56.2k stars, Apache-2.0. Latest release version/date COULD NOT VERIFY. - [tool-reference.md](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md); [github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- The trace tool's own description is aimed at load performance: "find frontend performance issues, Core Web Vitals (LCP, INP, CLS), and improve page load speed"; it can save raw trace data to a file. - [tool-reference.md](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)
- ffmpeg contact sheets: `ffmpeg -i input.mp4 -vf "thumbnail,tile=4x4" -frames:v 1 sheet.png`, or fixed-interval sampling of the form `fps=1/10,scale=320:-1,tile=4x3`. - [techearl.com ffmpeg contact sheet](https://techearl.com/ffmpeg-contact-sheet-preview)
- Open-source wrappers that build contact sheets from video: vcsi and vimg. - [github.com/amietn/vcsi](https://github.com/amietn/vcsi); [github.com/alexheretic/vimg](https://github.com/alexheretic/vimg)
- Search for a published skill or workflow for an agent verifying animation motion (jitter, timing, seams) returned nothing relevant. - none found (search run 2026-11-14)

### Inferences
- Observation from this machine's session, not a web source: the Chrome DevTools MCP currently loaded exposes no `screencast_start`/`screencast_stop` tools, while upstream documents them. Updating that server is probably the single cheapest motion-capture win. Needs confirming against the installed version.
- The Claude-in-Chrome extension already exposes a GIF recorder tool in this session, a second existing way to capture motion.
- Strongest review recipe with what is installed: (a) make shader time a parameter so frame N is reproducible; (b) capture frames at fixed steps via `onFrame` or repeated screenshots; (c) tile 12 to 16 frames into one sheet with ffmpeg or sharp and read that single image; (d) compute a per-frame difference number (sharp can subtract two frames and report mean) to catch a pop, a frozen frame or a loop seam, where the last-to-first difference should match the typical frame-to-frame difference; (e) measure smoothness separately with an in-page `requestAnimationFrame` delta logger, because a 25 fps screencast cannot show dropped frames at 60.
- Fixed-interval sampling is better than ffmpeg's `thumbnail` filter for motion review, since `thumbnail` picks "representative" frames and can skip the glitch.
- Headless Chromium on a modest laptop may use software rendering, so frame-time numbers from it describe the laptop, not the phone. Treat them as a regression signal only.
- Optical-flow and frame-difference metrics (ffmpeg `ssim`, `tblend`, `mpdecimate`, `freezedetect`, OpenCV Farneback) exist to my knowledge, but I did not source them this session; verify flags before relying on them.

### Gaps
- No source found for an automated "is this motion tasteful" judgement. Stills plus numbers catch defects (pops, seams, stalls, banding), not taste. The owner's eye on the phone stays the final gate.
- Whether Playwright's `fps` option can exceed 25 on Chromium was not confirmed.

## 4. Testing on a real iPhone from a Windows machine

### Takeaway
There is no first-party way to inspect iOS Safari from Windows. The free route (ios-webkit-debug-proxy via ios-safari-remote-debug-kit) gives console and DOM but its Timelines events and canvas view are listed as broken, so it will not give GPU frame timing. Playwright WebKit on Windows is explicitly not representative of iOS. For one effect, the cheapest faithful test is an on-page frame-time readout viewed on the owner's own phone, with Low Power Mode toggled by hand.

### Cited Findings
- ios-safari-remote-debug-kit: "Remotely debugging iOS Safari on Windows and Linux"; downloads ios-webkit-debug-proxy automatically on Windows but you must "also install and trust the device in Apple Devices (formerly in iTunes)"; needs Git, a Chromium browser and a local web server; known broken: "Events" on the "Timelines" tab, canvas content on the "Graphics" tab; GPL-3.0; 465 stars; 67 commits. Supported iOS versions not stated; last commit COULD NOT VERIFY. - [github.com/HimbeersaftLP/ios-safari-remote-debug-kit](https://github.com/HimbeersaftLP/ios-safari-remote-debug-kit)
- Inspect (inspect.dev): runs on Windows, connects to iPhones over USB or WiFi. Pricing as relayed by an aggregator quoting inspect.dev/pricing: free tier of two 15-minute sessions a day, $29 seven-day pass, Pro $79/year, Teams $99/user/year. Other aggregators give conflicting figures; official page not fetched. Secondhand. - [aisotools.com/pricing/inspect-dev](https://aisotools.com/pricing/inspect-dev); vendor: [inspect.dev](https://inspect.dev)
- BrowserStack Live: real iPhone Safari from a Windows browser with DevTools in a toolbar. Price conflict: official pricing snapshot in search showed Live at $150/month billed annually; older third-party listings show $29 to $49/month. Current single-user price COULD NOT VERIFY. - [browserstack.com/pricing?product=live](https://www.browserstack.com/pricing?product=live); [browserstack guide](https://www.browserstack.com/guide/debug-iphone-safari-on-windows)
- Playwright WebKit is a patched build from WebKit main, not Safari; on Linux and Windows it "uses a non-macOS network stack, uses non-Core Animation to composite scene and produce image raster"; one source: WebKit on Windows "should not be considered representative of how a page will render on a macOS, iOS, or similar device". Nothing WebGL-specific was found. - [endform.dev WebKit support](https://endform.dev/docs/explanation/webkit-browser-support); [dev.to, running WebKit on Windows](https://dev.to/dustinbrett/running-the-latest-safari-webkit-on-windows-33pb)
- Low Power Mode: WebKit throttles `requestAnimationFrame` to 30 fps deliberately; an Apple engineer called the throttle intentional in the bug thread. A December 2025 WebKit commit still refers to roughly 30 fps callbacks in Low Power Mode. CSS and WAAPI animations are also capped (30 in Low Power Mode, 60 on 120 Hz devices otherwise, per a 2024 report). - [WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745); [motion.dev, when browsers throttle rAF](https://motion.dev/magazine/when-browsers-throttle-requestanimationframe)
- WebKit has not implemented the Battery Status API, so a page cannot ask directly whether Low Power Mode is on. - [motion.dev, when browsers throttle rAF](https://motion.dev/magazine/when-browsers-throttle-requestanimationframe)

### Inferences
- None of the three remote options was confirmed to expose GPU frame timing or to let you toggle Low Power Mode. Cloud devices are plugged-in lab phones; Low Power Mode control there is COULD NOT VERIFY and unlikely.
- The shader must advance by elapsed time, never by frame count, or it runs at half speed under the 30 fps cap. The CSS fallback is capped too, so slow drift is the right design for both paths.
- A page can infer the cap itself by measuring rAF deltas for a second, then lower canvas resolution or switch to the stills. That same measurement, printed in a `?debug=1` corner overlay, is the agent's "remote profiler": the owner reads the number or sends a screen recording, which ffmpeg can turn into a contact sheet.
- The iPhone 16 Plus is a 60 Hz panel to my knowledge (unsourced), so 60 fps is the ceiling to design for.

### Gaps
- LambdaTest (now TestMu AI) real-device pricing not researched.
- Whether ios-webkit-debug-proxy works against the iOS version on the test phone is unconfirmed; the README states no supported versions.

## 5. Claude Code skills or plugins for shaders, WebGL, creative coding, motion, animation review

### Takeaway
Community shader skills exist and one is popular (MiniMax shader-dev), but nothing found does animation review, and the official Anthropic marketplace has nothing shader-specific. The stack already holds a motion skill, a UI-effects skill and a realtime WebGL skill; a shader skill would add reference snippets the agent can equally get by reading the Book of Shaders and Quilez directly.

### Cited Findings
- MiniMax-AI/skills: 13.8k stars, MIT, 84 commits, 17 skills including `shader-dev` (marked Official): "Comprehensive GLSL shader techniques for creating stunning visual effects", listing "ray marching, SDF modeling, fluid simulation, particle systems, procedural generation, lighting, post-processing, and more", ShaderToy-compatible. Install: `claude plugin marketplace add https://github.com/MiniMax-AI/skills` then `claude plugin install minimax-skills`. fbm, domain warping and smoke are not named on the repo page (COULD NOT VERIFY). Last commit COULD NOT VERIFY. - [github.com/MiniMax-AI/skills](https://github.com/MiniMax-AI/skills)
- A listing describes shader-dev as covering 36 GLSL techniques with WebGL2 adaptation rules; single-skill install `npx skills add minimax-ai/skills --skill shader-dev --agent claude-code`. Secondhand. - [x-cmd.com shader-dev](https://www.x-cmd.com/skill/minimax/shader-dev)
- Other community shader/WebGL skills seen only on directories (not verified, licences and dates COULD NOT VERIFY): ckorhonen shadertoy skill, martinholovsky glsl and webgl skills, ronnycoding webgl-expert. - [openskillindex ckorhonen](https://openskillindex.com/skills/ckorhonen-claude-skills-shadertoy); [claudemarketplaces martinholovsky glsl](https://claudemarketplaces.com/skills/martinholovsky/claude-skills-generator/glsl); [claude-plugins.dev webgl-expert](https://claude-plugins.dev/skills/@ronnycoding/.claude/webgl-expert)
- Official Anthropic marketplace (`anthropics/claude-plugins-official`): the relevant first-party item is `frontend-design` (`/plugin install frontend-design@claude-plugins-official`); listings name code-review, security-guidance and plugin-dev alongside it. No shader, WebGL or animation-review plugin appeared. Secondhand; the repo itself was not fetched. - [claude.com/marketplace/plugins/frontend-design](https://claude.com/marketplace/plugins/frontend-design); [skills.sh anthropics/claude-plugins-official](https://skills.sh/anthropics/claude-plugins-official)
- agent-shader also ships a skill (`panzoid-shader`), specific to Panzoid. - [github.com/rbstxt/agent-shader](https://github.com/rbstxt/agent-shader)

### Inferences
- shader-dev's ShaderToy conventions (`iTime`, `mainImage`, WebGL2) differ from a hand-rolled raw-WebGL page that should also run as WebGL1 on old phones, so its snippets need adapting either way.
- Installing a 17-skill marketplace for one skill adds context weight; if wanted, the single-skill install is the cleaner option, and the skill text should be read before installing since it instructs the agent.

### Gaps
- Animation-review skill: none found.
- The official marketplace's full current plugin list was not read at source.

## 6. Asset pipeline for the fallback stills

### Takeaway
The cheapest good source for fallback plates is the shader itself: render a few frames, read the pixels, and encode with sharp, which is already installed. Real-smoke stock and simulation tools produce prettier plates but bring licence reading, GPU time or a $300 purchase. AI video with true alpha exists as open research (Wan-Alpha) but needs a strong GPU or a hosted API and has known alpha defects.

### Cited Findings
- EmberGen (JangaFX): indie tier for revenue under $1M USD; permanent licence about $300 with 12 months of updates, optional $180/year maintenance after; a monthly rent-to-own path that becomes permanent after 18 months (2025 figure $19.99/month). Secondhand; the official page did not render fully. - [jangafx.com/software/pricing](https://jangafx.com/software/pricing); [CG Channel, Jan 2025](https://www.cgchannel.com/2025/01/check-out-the-new-features-due-in-embergen-2-0)
- ActionVFX free material: Practice Footage Library of 500+ clips, usable "in both educational and commercial projects, under the terms of ActionVFX's standard licence", free account required, 10 downloads per day; three free smoke and explosion VDBs (Nov 2023); earlier free smoke plume packs described as licensed for commercial projects. Paid assets from $39. All secondhand via CG Channel; ActionVFX's licence text was not read. - [CG Channel, Oct 2023](https://www.cgchannel.com/2023/10/actionvfx-launches-free-practice-footage-library/); [CG Channel, Nov 2023](https://www.cgchannel.com/2023/11/download-three-free-smoke-and-explosion-vdbs-from-actionvfx/); [CG Channel, 2016](https://www.cgchannel.com/2016/07/get-20-free-smoke-plume-and-10-dust-wave-fx-clips)
- Wan-Alpha: open-source text-to-video with a real alpha channel, built on Wan2.1, Apache-2.0; hosted on Replicate and Segmind with WebM or animated WebP output; a review notes unintended background elements and alpha masks with holes. - [huggingface.co/htdong/Wan-Alpha](https://huggingface.co/htdong/Wan-Alpha); [replicate.com/atonamy/wan-alpha](https://replicate.com/atonamy/wan-alpha); [themoonlight.io review](https://www.themoonlight.io/review/wan-alpha-high-quality-text-to-video-generation-with-alpha-channel)
- TransPixar/TransPixeler (Adobe Research with HKUST, CVPR 2025): RGBA video generation, with smoke named as a use case. - [arxiv.org/abs/2501.03006](https://arxiv.org/abs/2501.03006v2); [project page](https://wileewang.github.io/TransPixar)
- Many AI tools export green-screen rather than true alpha; verify the file by compositing it over different backgrounds. - [capcut.com guide](https://www.capcut.com/create/transparent-video-export-alpha-channels)
- No 2026 source confirmed that a major commercial video generator ships native alpha output. - none found (search run 2026-11-14)
- Blender Mantaflow plate route: see section 1 for the background-mode and transparent-film bug reports. - [T78314](https://developer.blender.org/T78314)

### Inferences
- Stock "smoke on black" footage has no alpha. On a dark store that is fine: either blend with `mix-blend-mode: screen`, or build alpha from luminance in sharp (white RGB, luminance as alpha) so the plate tints cleanly.
- For soft, low-contrast smoke, a small plate (around 512 to 768 px wide) upscaled by CSS looks the same as a large one; that keeps each WebP in the tens of kilobytes. Check for banding in the alpha gradient at low quality settings, and compare AVIF only if WebP bands.
- Rendering the fallback from the same shader guarantees the two paths match in look and avoids every licence question.
- AI-generated plates: the licence caveats are that model terms vary (Apache-2.0 covers the Wan-Alpha code and weights, not a hosted provider's output terms) and that generated imagery may carry no copyright protection in some jurisdictions; I did not source the legal point this session. Quality caveat: holes and stray background in the alpha, exactly the defect a smoke plate cannot hide.
- Simulated smoke (Mantaflow, EmberGen) reads as "real smoke"; domain-warped noise reads as "vapour". If the brief is tasteful haze, the shader look is the right one and simulation is unnecessary.

### Gaps
- ProductionCrate free tier and licence: not researched.
- Free VDB libraries beyond ActionVFX's three (for example JangaFX's free VDB pack): not researched this session.
- squoosh CLI status: not researched; sharp and ffmpeg cover the conversion, so it is not needed.
- EmberGen's GPU requirement on a modest laptop: not researched; it is a real-time GPU simulator, so assume it wants a discrete GPU.

## 7. Reference sources the agent should read before writing the shader

### Takeaway
Four pages cover the whole technique: the Book of Shaders fbm chapter (which includes domain warping), Quilez on warping and on fbm, and one Codrops piece on cheap atmospheric fog. Heckel's raymarching post is background only, since the chosen design is 2D noise, not a raymarched volume.

### Cited Findings
- The Book of Shaders, chapter 13, "Fractal Brownian Motion": explains fbm as summed octaves with lacunarity and gain, and has a "Domain Warping" section using fbm to warp the coordinates of another fbm. Confirmed by fetch. - [thebookofshaders.com/13/](https://thebookofshaders.com/13/)
- Inigo Quilez, domain warping article. The path exists (server answered 301 to the trailing-slash URL), but content could not be fetched this session (one attempt returned 404 over https with trailing slash), so content is COULD NOT VERIFY. - [iquilezles.org/articles/warp](https://iquilezles.org/articles/warp)
- Inigo Quilez, fbm article. Same status: path answered 301, content COULD NOT VERIFY. - [iquilezles.org/articles/fbm](https://iquilezles.org/articles/fbm)
- Maxime Heckel, "Real-time dreamy Cloudscapes with Volumetric Raymarching": volumetric raymarched clouds in React Three Fiber and WebGL, referencing Quilez's "Clouds". - [blog.maximeheckel.com](https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/)
- Cost warning for the raymarched route: quality needs about 128 march steps with about 6 light steps each per pixel. - [arxiv.org/pdf/1609.05344](https://arxiv.org/pdf/1609.05344)
- Codrops, "The Sleepers: Creating an Atmospheric WebGL Experience with Lightweight Techniques" (10 Jul 2026): animated fog using a sampled seamless noise texture instead of per-pixel noise, plus domain warping. - [tympanus.net/codrops, The Sleepers](https://tympanus.net/codrops/2026/07/10/the-sleepers-creating-an-atmospheric-webgl-experience-with-lightweight-techniques/)
- Codrops, "How to Create Procedural Clouds Using Three.js Sprites" (28 Jan 2020): fbm on cloud edges for a smoke-like look; warns in-shader noise is costly and suggests image textures. - [tympanus.net/codrops, procedural clouds](https://tympanus.net/codrops/2020/01/28/how-to-create-procedural-clouds-using-three-js-sprites/)
- No dedicated Codrops smoke or fbm shader tutorial was found. - none found (site-restricted search, 2026-11-14)

### Inferences
- Both Codrops pieces point the same way as the plan's "small canvas, upscaled": the cost is per-pixel noise, so cut pixels or sample a baked noise texture. A baked tiling noise texture is a legitimate third option between full shader and static stills.
- The 128-step figure is the reason to stay with 2D domain-warped fbm on a phone.

### Gaps
- Quilez article contents unverified this session; the agent should open both before writing code.

## 8. Verdicts: worth it or overkill for a single hero effect, and is the existing stack enough

### Takeaway
The existing stack is enough. The quality gain comes from using it differently (deterministic time, frame capture, contact sheets, a frame-difference number, an on-device frame-time overlay), not from installing more. Two zero-cost upgrades are worth doing: update Chrome DevTools MCP to get `screencast_start`/`screencast_stop`, and make sure Playwright is at v1.59+ (v1.64+ for the `fps` option).

### Cited Findings
Shortlist. Sources for every row are the citations in sections 1 to 7.

| Candidate | URL | Licence | Price | Last updated (as read) | Install | Verdict | Reason |
|---|---|---|---|---|---|---|---|
| Playwright Screencast API (`onFrame`, video) | https://playwright.dev/docs/api/class-screencast | Apache-2.0 (Playwright; licence not re-read this session) | Free | API added v1.59; `fps` option v1.64 | Already installed; check version | Worth it | Gives timestamped frames and video with no human; closes most of the "cannot see motion" gap |
| Chrome DevTools MCP update (screencast, traces, CPU throttle) | https://github.com/ChromeDevTools/chrome-devtools-mcp | Apache-2.0 | Free | 56.2k stars; release date COULD NOT VERIFY | Update the existing server | Worth it | mp4 capture plus `cpuThrottlingRate` to mimic a slower device; already in the stack |
| ffmpeg contact sheets (`tile` filter) | https://techearl.com/ffmpeg-contact-sheet-preview | LGPL/GPL (ffmpeg; not re-read this session) | Free | n/a | Check whether ffmpeg is on PATH; sharp can tile instead | Worth it | Turns N frames into one image the agent can read |
| Custom frame-difference and loop-seam script (sharp) | no product; own script | n/a | Free | n/a | A few dozen lines | Worth it | Catches pops, freezes and seams numerically; no published tool found |
| On-page rAF frame-time overlay (`?debug=1`) | no product; own code | n/a | Free | n/a | A few lines in the page | Worth it | Only way found to get real iPhone and Low Power Mode numbers from Windows |
| glslang (`glslangValidator`) | https://github.com/KhronosGroup/glslang/releases | Not shown on page (COULD NOT VERIFY) | Free | 16.6.0, 2026-09-10 | Download release binary (Windows asset COULD NOT VERIFY) | Optional | Fast lint, but the browser's compiler log already gives errors |
| MiniMax shader-dev skill | https://github.com/MiniMax-AI/skills | MIT | Free | 13.8k stars; last commit COULD NOT VERIFY | `npx skills add minimax-ai/skills --skill shader-dev --agent claude-code` | Optional | Technique snippets; fbm/warp coverage unconfirmed; primary sources teach the same |
| ios-safari-remote-debug-kit | https://github.com/HimbeersaftLP/ios-safari-remote-debug-kit | GPL-3.0 | Free | 465 stars; last commit COULD NOT VERIFY | Setup script, plus Apple Devices app and trust the phone | Optional | Console and errors from the real phone; Timelines and canvas views broken, so no frame timing |
| Inspect (inspect.dev) | https://inspect.dev | Proprietary | Free tier 2 x 15 min/day; paid figures conflict (secondhand) | COULD NOT VERIFY | Desktop app | Optional | Easier than the kit if the free tier still exists; verify on the vendor page |
| BrowserStack Live | https://www.browserstack.com/pricing?product=live | Proprietary | $29 to $150/month, sources conflict | n/a | Web | Overkill | The owner already holds the target phone |
| Playwright WebKit on Windows | https://playwright.dev | Apache-2.0 (not re-read) | Free | n/a | `npx playwright install webkit` | Overkill as an iOS proxy | Not Safari, different compositor; useful only as a rough second-engine smoke test |
| MCP for Blender (community) | https://github.com/ahujasid/blender-mcp | MIT | Free, paid Premium tier for some generators | 34.4k stars; last commit COULD NOT VERIFY | `winget install --id=astral-sh.uv -e`, `uvx mcp-for-blender setup` | Overkill | Runs unguarded Python, telemetry on by default; simulation unsupported in docs |
| Blender Lab MCP (official) | https://www.blender.org/lab/mcp-server/ | GPL-3.0-or-later | Free | v1.0.3, 2026-09-11 (secondhand) | Blender 5.1+ extension repo | Overkill | Same reason; scene analysis tool, not a smoke pipeline |
| Blender Mantaflow via plain CLI | https://docs.blender.org/manual/en/4.4/advanced/command_line/arguments.html | GPL (Blender) | Free | n/a | Blender install plus a bake script | Overkill | Python bake and transparent-film bugs on record; long bakes on a modest laptop |
| EmberGen | https://jangafx.com/software/pricing | Proprietary | About $300 indie (secondhand) | EmberGen 2.0 features announced Jan 2025 | Installer | Overkill | Cost and GPU need for a handful of fallback stills |
| ActionVFX free footage and VDBs | https://www.actionvfx.com | ActionVFX standard licence (text not read) | Free with account, 10 files/day | Library launched Oct 2023 | Download | Optional | Only if real-smoke plates are preferred; read the licence first; footage is on black, no alpha |
| Wan-Alpha (AI RGBA video) | https://huggingface.co/htdong/Wan-Alpha | Apache-2.0 | Free locally (strong GPU); hosted API pay per run | COULD NOT VERIFY | Replicate or Segmind API | Overkill | Alpha holes and stray backgrounds; hosted output terms unread |
| agent-shader MCP | https://github.com/rbstxt/agent-shader | MIT | Free | 0 stars, 9 commits | `npm install --global agent-shader` | Overkill | Panzoid-specific, untested by anyone; duplicates Playwright |
| @modelcontextprotocol/server-shadertoy | https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/shadertoy-server | Not stated | Free | COULD NOT VERIFY | `npx -y @modelcontextprotocol/server-shadertoy --stdio` | Overkill | Needs an MCP Apps host UI; errors shown in an overlay, not confirmed returned to the model; npx-launched |
| glslViewer | https://github.com/patriciogonzalezvivo/glslViewer | COULD NOT VERIFY | Free | 3.2.3 seen on a mirror; date COULD NOT VERIFY | Compile with Visual Studio 2019+ | Overkill | Build cost on Windows; not the browser's compiler |
| Houdini / After Effects / TouchDesigner MCPs | see section 1 | Mixed (8beeeaaat TD: MIT; others COULD NOT VERIFY) | Free servers; host apps paid | COULD NOT VERIFY | Host app plus bridge | Overkill | Need the host app; nothing here feeds a web shader |
| EmberGen MCP | n/a | n/a | n/a | n/a | n/a | Not found | No server surfaced in the searches run |
| "Agent reviews an animation" skill or published workflow | n/a | n/a | n/a | n/a | n/a | Not found | Search returned only generic ffmpeg how-tos |
| Shader or animation plugin in the official Anthropic marketplace | https://claude.com/marketplace/plugins/frontend-design | n/a | n/a | n/a | n/a | Not found | Only general `frontend-design`; the existing design skills cover it |

### Inferences
- Ranked by value for this job: (1) deterministic time plus frame capture plus contact sheet, (2) frame-difference and loop-seam number, (3) on-device frame-time overlay with Low Power Mode on and off, (4) Chrome DevTools MCP update, (5) reading the four reference pages. Everything else is optional or overkill.
- This machine's notes say npx-launched MCP servers fail to connect, which is a further practical strike against the shadertoy and agent-shader servers.
- Remaining honest limit: no tool found judges whether motion feels tasteful. The agent can prove "no pops, no seam, holds frame budget, matches reference stills"; the owner's eye on the phone decides taste.

### Gaps
- Licence text for ffmpeg, Playwright, glslang and glslViewer was not re-read this session; licences shown for those are from general knowledge or marked COULD NOT VERIFY.
- Last-commit dates for almost every GitHub repo were not exposed in the fetched pages.
- Installed versions of Playwright and Chrome DevTools MCP on this machine were not checked (no installs or local probing were in scope).
