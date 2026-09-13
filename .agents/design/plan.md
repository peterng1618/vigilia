# PC stats display — development design

Revision 9 · 12 September 2026 · Self-contained proposal for supervised coding agents.

## 1. Product and scope

Build an open-source PC-hosted website for live monitoring over local Wi-Fi. Full editing runs in a desktop browser; phones show one assigned dashboard per device and basic settings. V1 hosts on Windows; preserve boundaries for future Linux/macOS support without promising identical sensor coverage. Local hardware metrics require no internet; remote API sensors and weather require their endpoints.

Charts/graphs and typography with extensive visual styling are first-class product capabilities and the primary v1 authoring priorities. They must remain native, editable and data-aware. Ship premade chart/text widgets and full theme packs, plus blank-artboard authoring.

Shape drawing begins with a minimal foundation sufficient to validate the architecture. V1 may use individual bitmap/SVG assets for decorative frames, panels and other artwork. Gradually expand native drawing to reduce external-editor dependence; advanced shape tools must not delay chart or typography quality. This staging supersedes earlier native-shapes-first priorities.

V1 includes static bitmap/SVG elements, GIF elements, and video backgrounds. “Static artwork” excludes sensor-driven bitmap masks, sprite gauges, and bitmap needles, not GIF/video playback. Exclude wireless wake-up, multiple pages per device, arbitrary theme scripts, and USB/serial implementation. Future screen support affects architecture only; no bitmap capture worker or simulator now.

## 2. Design principles and scrutiny

This document contains the requirements agents need; earlier prototypes and private source files are not prerequisites or implementation authorities.

Primary inspirations and aspirations:

| Reference | What to learn and aspire to |
| --- | --- |
| [Rainmeter repository](https://github.com/rainmeter/rainmeter), [manual](https://docs.rainmeter.net/manual/) | Separate data measures from visual meters; extensive styling, reusable skins and configurable update behavior. |
| [turing-smart-screen-python](https://github.com/mathoudebine/turing-smart-screen-python), [wiki](https://github.com/mathoudebine/turing-smart-screen-python/wiki), [theme examples](https://github.com/mathoudebine/turing-smart-screen-python/tree/main/res/themes/--Theme%20examples) | Dedicated PC dashboards, sensor coverage, compact information design and theme sharing; future hardware-output knowledge. |
| [KWGT / Kustom documentation](https://docs.kustom.rocks/) | Visual authoring, shapes, groups/Komponents, global parameters and rich data-driven customization. Consult the documentation's Groups, Global Variables, Shapes and Web Get topics. |

These are design references, not promised feature parity, compatible file formats, or licenses to copy code/assets. Prioritize their chart, typography and customization aspirations; decorative artwork may initially be imported. Kustom documentation spans several apps; do not assume every documented feature belongs to KWGT. Formula-driven styling is a future aspiration beyond v1's typed bindings and thresholds.

Use centralized document commands to keep canvas, layers and inspectors synchronized, but keep transient UI state and telemetry outside the saved document. Reuse editor history where it can enforce gesture boundaries; avoid maintaining competing undo stacks.

Shared rendering prevents editor/display drift. Expand native drawing incrementally; do not build a general-purpose graphics editor before the monitoring experience. Avoid mandatory bitmap baking, legacy-format compatibility and bespoke video processing.

Treat library feature lists and prior design ideas as hypotheses until demonstrated. In particular, verify live chart/media composition, group transforms, clipboard correctness and independent snap controls. Cut must succeed at copying before deletion. Completed checklists require observable behavior and tests.

## 3. Reuse-first stack and first decision gate

Prototype [vue-fabric-editor](https://github.com/ikuaitu/vue-fabric-editor) first. Its MIT open-source frontend documents history, rulers/guides, grouping, alignment, polygon drawing, typography, gradients, strokes, shadows, and image/SVG handling. Verify the OSS build, not commercial features. It is an editor foundation, not an existing telemetry product.

Accept Vue/TypeScript if this avoids rebuilding an editor. Evaluate [yft-design](https://github.com/dromara/yft-design) only if the first candidate fails. Moveable/Selecto are fallback primitives, not complete editors.

Proposed supporting stack: ASP.NET Core + SignalR; LibreHardwareMonitor as the initial Windows provider; SQLite metadata and managed asset files; [Apache ECharts](https://echarts.apache.org/en/index.html); JSON Schema; Playwright. Pin supported versions and inventory licenses at Gate 0. Select the project's open-source license before incorporating third-party code; open-source distribution does not make all licenses interchangeable.

Gate 0 must demonstrate a richly styled live donut/radial gauge and filled line chart, editable sensor text with separately styled value/unit, a packaged font, transparent artwork, GIF and video. Include only a rectangle, ellipse and line to prove extensible node types, transforms and styling. Verify gradients/outlines/shadows, font loading/metrics, chart updates, layering, undo and JSON round-trip on desktop and phone. Evaluate advanced layout controls for feasibility; full implementation belongs to Gate 2. Reject flattened charts/text or incompatible editor/display rendering. Human approves the editor and renderer strategy.

Rank editor candidates by chart embedding, typography fidelity, lightweight playback and extensibility before drawing-tool breadth. Existing polygon/path tools are a bonus, not a reason to accept weaker text or charts. Chart and text styles must be editable through dedicated visual inspectors, not raw JSON.

Also prove that the shared renderer runs in a small display-only bundle without downloading editor controls or inspectors. Test on a real low-end/older phone; editor reuse must not force a heavyweight player.

## 4. Artboard and editor contract

Themes define logical width/height. Apply one uniform transform to all content, including UI-bearing backgrounds, strokes, typography and shadows.

- Fit entire design: use the smaller viewport/artboard dimension ratio; center with configurable color bars.
- Fill screen: use the larger ratio; center and crop edges. Preview cropping in the editor.
- Decorative background media may contain/cover within its own bounds. UI-bearing backgrounds must stay aligned with foreground content.

No automatic element reflow. Configuration pages remain responsive. Editor zoom is not document geometry. Use group-local coordinates and composable transforms; grouping/ungrouping preserves world appearance.

Required editor controls:

- Layers, rename/reorder, copy/paste, duplicate, group/ungroup, hide/lock. Locked objects remain inspectable in the tree but cannot transform until unlocked.
- Initial shapes: rectangle with uniform corner radius, ellipse and line; solid fill, stroke, opacity and shared transforms. Decorative images retain sizing/crop, transparency, layering and replacement controls.
- First-class chart and typography inspectors as specified below; sensor text uses fixed boxes by default to avoid jitter.
- Pixel rulers; configurable grid spacing/subdivisions/color/visibility; add/move/remove guides. Persist these as editor metadata.
- Independent grid/guide/object snapping and temporary bypass. Screen-pixel snap tolerance remains usable across zoom levels.
- Align to artboard, selection or key object; distribute centers or equal gaps. Groups act as units; locked objects are excluded.
- Undo/redo: one drag or slider gesture per transaction. Guide changes are undoable. Telemetry, playback, selection and viewport changes never enter document history.

Register inspectors by element capability; reuse transform/style sections rather than expanding one conditional panel.

### Theme globals (v1)

Provide named, typed constants for palette colors, heading/body fonts, font sizes, spacing and asset references. Each compatible property chooses either a global reference or its own literal value; local values remain unchanged when globals change. Show that choice explicitly in inspectors, with “use global” and “make local” actions. Constants are author-defined values, not scripts or sensor expressions.

Use stable IDs plus editable names. Example property values: {"ref":"palette.accent"} or {"value":"#00B8D9"}. Validate reference types and missing references; renaming preserves links, and deletion requires reassignment or conversion to current literals. V1 globals contain literals only, avoiding reference cycles. Global edits are undoable and update dependent elements without rewriting their properties.

Widgets expose compatible parameters that can bind to theme globals or retain widget defaults. Standalone widget export includes required default values; import uses explicit mapping rather than silently merging same-name globals. Include constants/references in JSON round-trip, font/asset packaging and visual tests.

## 5. First-class charts, typography and live data

V1 families: pie/donut; full/half/arbitrary-sweep radial gauges; horizontal/vertical bars and progress bars; multi-series line, sparkline and filled-area charts.

Expose applicable solid/linear/radial gradient fills with editable stops, opacity, outlines/dashes, shadows, rounded caps, tracks, thresholds, labels, legends, axes, ranges and time windows. Include ring thickness/start/end angles, pie gaps, bar width/spacing, line width/interpolation/markers and independent area fill. Distinguish pie composition from gauge progress. Preserve raw values while clamping gauge display; missing samples create gaps, not zeroes.

Define a chart-family/style acceptance matrix at Gate 0. Each applicable combination must have an inspector control, JSON representation, preset and visual fixture. Mark engine gaps explicitly and obtain human agreement on alternatives before committing. Radial gauge geometry is a chart requirement even while general-purpose arc drawing is deferred. Extensive styling is release scope, not a post-release polish task.

Use typed chart settings translated into ECharts configuration. No raw executable options. Share style tokens across charts and other elements.

**Typography:** support inline editing; packaged/imported licensed fonts and fallback handling; font size, weight/style, letter spacing, line height, horizontal/vertical alignment, rotation, wrapping and explicit clipping/ellipsis. Provide solid/gradient text fill, outline, shadow and opacity. Support styled runs so labels, live values, units and prefixes/suffixes can differ within one text element. Expose decimal precision, unit display and tabular numerals where the font supports them.

Apply shared typography tokens to chart titles, axis labels, legends and value readouts, with a documented support matrix. If the chart engine cannot reproduce a required treatment, use a shared native text overlay when appropriate; never substitute a bitmap label. Reserve stable text boxes during font loading and show missing-font diagnostics. Verify multilingual glyphs, changing digit widths, baseline alignment and overflow at multiple artboard scales.

Sample contract: sensorId, timestamp, value, unit, status. Catalog entries include stable provider-instance/sensor IDs, value type, display name, unit and capabilities. A mapping layer resolves semantic theme bindings to actual sensors; changing providers must not require editing the theme. Provide missing/stale/error states and explicit remapping.

**Replaceable providers:** define a versioned interface for configuration validation, sensor discovery, start/stop, health and cancellable asynchronous sampling. The registry supports multiple provider instances, enabling/disabling and replacement. Providers own acquisition; the host owns scheduling, normalization, bounded history and publication. Apply timeouts/backoff per provider so a failing API cannot stall hardware collection. Use a fake provider for contract tests. V1 uses compiled modules via dependency injection; arbitrary downloaded code plugins and hot-loading are deferred.

Keep Windows hardware APIs, secret storage, startup, tray and firewall integration in platform adapters. Shared contracts, domain logic, API collection and rendering must not depend on Windows types. Future Linux/macOS providers report available capabilities rather than fabricate unsupported readings.

**Custom API sensors:** provide a desktop configuration wizard for HTTP(S) JSON endpoints, initially GET polling. Configure URL/query/headers, interval/timeout and authentication: none, API key, bearer token or Basic over HTTPS. Support secret references in headers/query values. Map response fields with JSON Pointer into named numeric, string or Boolean sensors, with units and optional scale/offset. Charts accept numeric sensors only. Include Test Connection with redacted preview and field-mapping validation. Defer OAuth login/refresh flows, arbitrary scripts, mutation requests and streaming protocols.

Fetch on the PC, never on the phone. Store credentials through the platform secret adapter; redact requests/errors and omit secrets from browser responses and packages. Custom endpoints require explicit admin configuration, never activation by a theme import. Allow intentionally configured local endpoints; validate destinations and redirects, and never forward credentials across origins. Bound response size/concurrency, honor rate limits, and share one request across fields from the same endpoint. Authentication failures and invalid JSON become visible sensor errors.

Start hardware sampling at one second; API/weather polling uses separate endpoint-appropriate intervals and caching. No browser count should multiply upstream requests. Custom sensor definitions remain host configuration; themes export only binding requirements, not endpoint credentials.

Renderer inputs: document, resolved assets/fonts, metric snapshot/history, viewport and clock. Editor/display share render components/adapters; editor adds interaction overlays. Update charts without recreating the scene. Reconnect fetches a current snapshot and bounded history, not an unlimited backlog.

Future bitmap output needs deterministic inputs and an output-neutral document only. Do not implement that adapter now.

### Runtime resource contract

Minimal PC overhead is a release requirement for performance-conscious users, including gamers.

| PC host | Phone display |
| --- | --- |
| Hardware acquisition, shared API fetching, credentials and small bounded reconnect history | Full dashboard rendering, value/unit formatting, thresholds and chart presentation |
| Compact batched samples with timestamps/status; cacheable assets | Chart window buffers/downsampling, animations, GIF/video decoding and asset caching |

Normal operation must not require a PC browser, render loop, bitmap streaming, video transcoding or live editor preview. Package/build-time optimizations must not become continuous runtime work.

Subscribe to the union of sensors needed by active clients and poll once at the required cadence within configured limits. Respect providers that acquire sensor groups together; do not claim per-sensor savings without measurement. Reuse provider connections and avoid repeated discovery. Suspend unused acquisition after a grace period unless background history is explicitly enabled. Opening another phone must not multiply upstream polling.

Keep sampling, transmission and animation rates separate. Batch updates; bound per-client queues and discard obsolete pending snapshots for slow clients. Phone animations interpolate locally and must not imply additional measured samples. Refresh only affected elements and cache static graphics where beneficial. HTTP-cache versioned assets, support efficient media delivery, and avoid repeated transfers.

V1 uses one measured baseline with bounded chart points/history and animation work. Performance presets, automatic quality adjustment and preset-preview UI are future scope. Keep existing media playback fallbacks. Pause unnecessary rendering when hidden or disconnected. Define tested minimum browser/WebView versions, feature detection and a clear compatibility screen. Do not make service workers or newer performance APIs mandatory for LAN display. Deferring presets does not defer old-phone testing or low-PC-overhead requirements.

Gate 0 establishes numerical budgets on named reference PCs/phones for CPU, memory, network, frame time and startup. Release testing compares repeated monitoring-off/on game runs, including frame-time percentiles and polling spikes; average CPU alone is insufficient. Separate steady-state display from editing/import workloads. Test one/multiple phones, static/media-heavy themes, disconnects and sustained phone heat/responsiveness. Publish measured results and limitations.

## 6. JSON, widgets and packages

**SVG icon import (v1):** user pastes a direct HTTPS SVG URL, previews it and inserts it; retain local file upload. Fetch once through the PC's admin-only importer with timeout/size limits and validated destinations/redirects; block private/loopback destinations for this public-asset importer. Reject HTML/storefront links with a clear request for a direct SVG link; no scraping or paid-account integration. Downloads never run from theme-provided URLs automatically.

Sanitize before preview and save locally as an undoable icon element. Preserve vectors and multicolor originals; expose size, rotation, flip, opacity and monochrome recoloring. Store source/hash plus supplied or available license/attribution metadata; a URL alone does not establish reuse rights. Preserve required notices in packages; consult [Font Awesome licensing](https://fontawesome.com/license/free). Icons work offline without CDN/font-kit dependencies. Test URL/file import, invalid URLs, unsafe SVG, recoloring/undo and offline ZIP round-trip. Browsing/searching catalogs is future scope.

Own the JSON schema; Fabric JSON, DOM snapshots and raw chart options are not the theme format.

- Document: schemaVersion, ID/metadata, artboard/background, ordered node tree, typed globals/style references, asset references, editor metadata. Future mode overrides extend this document, not duplicate its node tree.
- Node: stable ID, type, local transform, visibility/lock, style, typed content/binding, ordered children. Child order alone determines stacking.
- Widget: reusable subtree/local artboard, exposed style/data parameters, defaults and preview. V1 insertion embeds a copy with fresh IDs and provenance; no automatic library-update propagation.
- ZIP: manifest.json, theme.json or widget.json, assets/, optional preview/licenses. Packs embed all required dependencies.

Validate schema versions, references, types, numeric limits, nesting and fonts. Import into staging; reject traversal, symlinks, decompression bombs and executable content. Sanitize SVG, block external resources, and impose asset/media limits. Unsupported schemas fail without changing the library.

Save atomically with recoverable drafts. Save marks history clean without clearing it. New/open prompts Save/Discard/Cancel and clears history only after successful replacement. Preview drafts separately; Publish atomically activates a validated revision. Device assignments reference published revisions. Never export credentials, weather coordinates or device tokens.

## 7. Hosting and settings

Keep localhost administration available when LAN serving is off. Tray controls complete process start/stop: a stopped server cannot restart itself through its website. LAN starts disabled with explicit interface/port selection and firewall guidance.

Pair phones with short-lived codes and revocable display-scoped sessions. Full editing remains localhost-only by default. Enforce authorization, host/origin checks, CSRF protection where applicable, safe asset access and request limits. Plain LAN HTTP provides no confidentiality; document trusted-network-only use and prohibit internet exposure.

Settings cover units, locale/timezone, weather coordinates/provider/key, sensor mapping, libraries, device assignments, fit mode and hosting. Weather keys stay server-side. Mobile autoplay, fullscreen and keeping the screen awake are browser-dependent; provide a poster/manual playback fallback.

## 8. Coding-agent execution gates

| Gate | Deliverable and acceptance evidence |
| --- | --- |
| 0 — Feasibility | Chart/typography-led prototype, minimal shapes, independent display bundle and old-phone test; styling matrices, pinned dependencies, license inventory, compatibility floor and performance budgets. Human approves stack. |
| 1 — Document/rendering | Schema, typed globals/references, shared renderer, contain/cover and nested transforms. JSON round-trip and deterministic screenshot tests. |
| 2 — Authoring | Complete chart/style matrices, typography/rich sensor text, visual style presets, globals inspector and core editor controls. Test global/local overrides, rename/delete, font fidelity, gesture undos, grouping/alignment and snapping. Advanced drawing is not a gate. |
| 3 — Live display | Provider registry, Windows/fake/API providers, custom-sensor wizard, pairing and reconnect. Test replacement without theme edits, provider failures, secret redaction, subscription sharing, slow clients and LAN-off with localhost available. Human verifies real sensors and Android/iPhone browsers. |
| 4 — Reuse/packages | Premade chart/text widgets, SVG URL/file importer, theme packs, secure import/export and draft recovery. Offline round-trip preserves globals/widget bindings, fonts, icons and required license notices. |
| 5 — Release | Installer/tray, recovery, permissions review, malicious-package tests, two-hour phone soak and repeatable game benchmarks with monitoring off/on. Meet Gate 0 budgets, bounded memory/history and documented compatibility targets. |

Each change gets a short proposal, acceptance scenarios, tasks and test evidence in the new repository. Report untested behavior; seek human review for schema breaks, major dependency changes or scope expansion. Do not infer requirements from unavailable historical artifacts.

Windows-first and open-source distribution are confirmed. The precise license remains a human decision before code incorporation/distribution. API support above is a proposed bounded v1 scope; expand it only for concrete endpoint needs. Establish sensor coverage and performance budgets from measured hardware.

## 9. Later milestones

**Dark/light variants:** one theme declares dark-only, light-only or both, with an author-selected default. Dual-mode themes share one node tree, layout and sensor bindings. Store sparse overrides for globals and compatible element styles, asset references and visibility, covering chart/text colors, drawable fills/strokes, backgrounds and UI artwork. Do not automatically invert bitmap colors. Resolve mode-specific globals first; then resolve a property's mode override or base value. Explicit element literals remain literal unless the author adds a mode override.

Switch modes per display device without duplicating the theme or saving a new document revision; keep the choice separate from editor/application chrome appearance. A single-mode theme exposes no unsupported mode. Authors preview/edit both variants and package every referenced asset. Implement after v1; acceptance requires consistent global/element overrides, unchanged layout/bindings, and export/import of both modes in one package.

**Icon browser:** add collection browsing, search/filter, previews and direct insertion on top of the importer. Prefer a replaceable [Iconify API](https://iconify.design/docs/api/) adapter with [search](https://iconify.design/docs/api/search.html), including Font Awesome Free where available. Debounce/paginate/cache searches; keep catalogs outside the player and preserve license metadata. Paid catalog accounts remain separate future scope.

**Performance presets:** later add per-device Lightweight/Balanced/Full settings for animation, media, chart point count and backing resolution, with preview/manual overrides. Preserve artboard geometry and information; do not silently remove informative styling. Validate on reference phones before choosing preset thresholds.

**Incremental drawing:**

After chart/typography acceptance, add per-corner radii, richer shape fills/strokes/shadows, editable polygons and general-purpose arcs/rings in small increments. Each addition reuses the node/style schema, inspector registration, undo and shared renderer. Defer Boolean operations and full path editing until justified. Bitmap artwork remains supported; no automatic bitmap-to-vector conversion is required.

## 10. Future Android companion

After the browser release, build a thin Android WebView shell loading the same PC-hosted display. Add fullscreen/orientation controls, keep-screen-on while active, saved pairing, reconnect/error recovery and an accessible settings/exit action. Reuse the website and protocol; keep normal browser access fully supported.

Offer optional user-selected default Home/launcher mode for dedicated phones. Do not promise unconditional startup before unlock or identical behavior across manufacturers. Ordinary boot receivers are subject to activity-launch restrictions; enterprise device-owner/kiosk provisioning is outside the consumer baseline. See [Android custom Home and keep-screen-on guidance](https://developer.android.com/work/dpc/dedicated-devices/cookbook) and [background activity restrictions](https://developer.android.com/guide/components/activities/secure-bal).

WebView is a delivery shell, not a performance or old-engine compatibility fix. Pin a tested minimum engine/OS matrix, restrict navigation to the paired host, minimize native bridges, and handle WebView process loss. Verify HTTP LAN policy, media playback and restart/unlock behavior on real devices. See [Android WebView documentation](https://developer.android.com/develop/ui/views/layout/webapps/webview). Wireless wake-up remains excluded.
