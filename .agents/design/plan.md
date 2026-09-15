# Vigilia — product plan

Agent-owned current requirements. User goals and explicit product choices take
precedence. `§N` markers are stable labels used by code/docs; never renumber.

## Goals

1. Show the PC's live state on a phone over local Wi-Fi without internet.
2. Design dashboards visually in a desktop browser, not by editing JSON.
3. Charts and typography are first-class product features.
4. Personal use first; optimize development speed over release polish.
5. Never show a number that was not measured.

## Non-goals

Wireless wake-up · multiple pages per device · arbitrary theme scripts ·
USB/serial displays · building a general-purpose graphics editor · animated GIF
elements · formula-driven styling · OAuth flows · mutation requests · streaming
protocols.

## §7 — Product and scope

Windows-first PC-hosted dashboard editor/player. Local metrics need no internet;
remote API/weather sensors use their endpoints. V1 supports bitmap/SVG artwork,
video backgrounds, rectangle/ellipse/line shapes, charts and rich typography.
Decorative drawing must not delay charts or typography.

## §31 — One renderer, shared

Editor and player use the same Fabric scene implementation. Do not maintain a
second renderer or rebuild generic editor mechanics Vigilia does not own.

Use `fabricjs-image-editor` as the preferred editor foundation at source level,
with a permanent Vigilia fork acceptable. Vigilia adds only missing/domain work:
telemetry, semantic bindings, design tokens, typed charts, artboard behaviour and
engine gaps.

## §33 — Nothing is done until observed

Library claims and code inspection are hypotheses. Visible changes require a
rendered/browser check plus tests appropriate to the behaviour. Report what was
not verified.

## §43 — Feasibility

Established: styled live gauges/donut/line-area charts, styled sensor text,
packaged fonts, bitmap/SVG assets, video background architecture, basic shapes,
transforms, gradients, layering and JSON round-trip. Chart/text properties are
edited visually, never as raw engine JSON.

## §47 — Small display bundle

The player must not download editor controls/managers. Enforce a bundle budget
and import boundaries. Old/low-end phones are in scope, but no physical-device
validation gate is required.

## §51 — Artboard

A theme has logical width/height. One uniform transform applies to all content,
including background alignment, strokes, typography and shadows.

## §53 — Fit modes

`contain`: fit whole artboard and fill bars. `cover`: fill viewport and crop.
The editor previews the same result.

## §55 — Background media

Background media aligns to the artboard. Video is at most one background layer
beneath the Fabric canvas, cropped by the artboard. It is not a normal node: no
grouping, rotation, timeline or playback controls.

## §57 — Geometry

No automatic reflow. Editor zoom is not document geometry. Group transforms
compose with child transforms; group/ungroup preserves world appearance.
Authoring controls use whole artboard units where practical.

## §61 — Editor controls

Layers: rename, reorder, copy/paste, duplicate, group/ungroup, hide and lock.
Hidden nodes remain reachable in layers. Align/distribute to artboard,
selection or key object. Generic mechanics should come from the editor
foundation rather than custom Vigilia geometry/gesture code.

## §64 — Rulers, grid and guides

Pixel rulers, configurable grid/guides, independent grid/guide/object snapping,
temporary bypass, zoom-stable tolerance. Persist as editor metadata rather than
rendered theme content.

## §67 — Undo

A generic transform gesture should be one transaction. Telemetry, playback,
selection and viewport never enter authored history. Chart-specific property
editing may commit without undo/redo if integrating it cleanly would require
substantial custom history machinery.

## §73 — Theme globals

Named typed constants for palette, type presets, spacing and assets. Colour and
typography are theme-level. Palette values include rgba solids and gradients.
A type preset groups family, size, weight, letter spacing and line height.
Per-instance properties include opacity, geometry, stroke width and corner
radius.

## §75 — References and identity

A compatible property is either a global reference or literal, never both.
Globals have stable keys plus editable display names. Nodes have one stable id.
Deleting a referenced global requires reassignment; colour/typography do not
silently convert to literals.

## §77 — Widgets

Reusable subtrees expose compatible parameters for theme globals/defaults.
Insertion embeds a copy with fresh ids/provenance. Import maps globals
explicitly; standalone export includes required defaults/assets.

## §81 — Chart families

Pie/donut; full/partial radial gauges; horizontal/vertical bars/progress;
multi-series line/sparkline/area. A chart family need not be changeable after
creation.

## §83 — Chart styling and data gaps

Applicable controls include fills/gradients, opacity, strokes/dashes, shadows,
rounded caps, tracks, thresholds, labels, legends, axes, ranges/time windows,
ring angles/thickness, pie gaps, bar spacing, line interpolation/markers and
area fill.

Gradient coordinates use the element bounding box. Raw samples are preserved;
gauge display may clamp. Missing/non-`ok` samples render gaps, never zero.

## §85 — Engine gap rule

Supported settings need property controls, persisted representation and a visual
fixture. Where ECharts cannot reproduce a required treatment, expose the gap and
get human agreement before choosing an approximation. Current open gaps: gauge
angular gradients and line threshold bands.

## §87 — Typed chart settings

Themes persist typed Vigilia chart settings, not raw ECharts options. Engine
translation has one owner.

## §89 — Typography

Inline editing; licensed packaged/imported fonts; fallback handling; family,
size, weight, style, spacing, line height, alignment, rotation, wrapping,
clipping/ellipsis, fill, outline, shadow and opacity. Styled runs allow label,
value and unit to differ within one text element. Sensor text uses fixed boxes by
default to avoid jitter.

## §91 — Typography in charts

Chart text uses shared typography tokens where supported. When ECharts cannot
reproduce a required treatment, use native text overlay rather than bitmap
labels. Handle fallback/missing fonts and changing digit widths explicitly.

## §93 — Sensors and semantic binding

Samples carry identity, timestamp, value, unit and status. Themes bind semantic
keys, never provider instances. Providers report discoverable capabilities.
Providers acquire; the host schedules and owns timeouts/backoff.

## §97 — Platform boundaries and honest capability

Windows-specific hardware/startup/tray/firewall/secret code lives behind
platform adapters. Never fabricate a reading. Unavailable sensors report why;
no automatic fallback from real to synthetic data.

## §99 — Custom API sensors

Desktop wizard for HTTP(S) JSON GET polling with URL/query/headers/interval/
timeout/auth; secrets referenced, not embedded. JSON Pointer mappings create
numeric/string/boolean sensors with units and optional scale/offset. Charts use
numeric sensors only. Include test/redacted preview.

## §101 — Credentials and fetching

Fetch remote APIs on the PC. Secrets use the platform adapter, are redacted from
logs/errors and never reach themes/browser responses. Validate destinations and
redirects; bound response size/concurrency; share requests across mapped fields.

## §105 — Renderer inputs

Theme semantics, Fabric scene, resolved assets/fonts, metric snapshot/history,
viewport and clock. Editor and player share renderer objects; editor adds
interaction. Charts update without recreating the scene.

## §111 — Minimal PC overhead

Subscribe to the union of sensors active clients need and poll upstream once per
cadence. Additional displays must not multiply acquisition. Reuse provider
connections and discovery.

## §116 — Where work happens

| PC host | Phone display |
|---|---|
| hardware acquisition, API fetches, credentials, reconnect history | dashboard rendering, formatting, thresholds, chart buffers/animation, video/background decoding, asset cache |

Normal operation needs no PC browser, bitmap streaming, video transcoding or
live editor preview.

## §120 — Acquisition discipline

Respect providers that acquire sensor groups together; do not claim per-sensor
savings without measurement. Suspend unused acquisition after a grace period
unless background history is enabled.

## §122 — Rates and slow clients

Sampling, transmission and animation rates are separate. Batch updates; bound
queues; discard obsolete pending snapshots. Phone animations may interpolate
presentation but never imply additional measured samples. Numeric text is not
interpolated.

## §124 — One baseline

V1 has one bounded rendering baseline for chart points/history/animation. Pause
rendering when hidden/disconnected. Performance presets/auto quality are future
scope.

## §126 — Budgets when cost is measurable

Add numerical budgets for actual expensive paths such as dense charts or full
sensor-tree polling. Use reproducible automated/browser profiles where useful;
physical-device validation is not a release gate.

## §132 — Imported artwork

Sanitize SVG before preview; preserve vectors/multicolour originals; expose
size/rotation/flip/opacity/monochrome recolour. Store source/hash and supplied
licence/attribution metadata. Imported icons work offline.

## §134 — Theme format

Vigilia owns the versioned envelope and semantic data. Fabric's own object JSON
is the sanctioned persisted representation for the scene tree to avoid a
parallel geometry/grouping mapping layer.

Requirements:

- record/pin the Fabric major;
- Fabric major changes are schema migrations; unsupported old scenes are
  refused rather than reinterpreted;
- strip Fabric defaults so absent keys mean defaults of the recorded major;
- explicitly persist Vigilia identity;
- custom charts persist authored typed settings only, never built ECharts/runtime
  data.

Human readability of scene JSON is not a goal.

## §137 — Document and node shape

Envelope: schema version, id/metadata, artboard/background, globals, assets,
semantic bindings, editor metadata and Fabric scene JSON.

Fabric child order determines stacking. Fabric groups carry geometry and ordered
children; transforms compose and group/ungroup preserves world appearance.

## §138 — Widgets in the document

Reusable subtree with local artboard, exposed style/data parameters, defaults
and preview. V1 insertion embeds a copy with fresh ids/provenance; no automatic
library-update propagation.

## §139 — Packages

ZIP with manifest, theme/widget JSON, assets, optional preview and licence files.
Packages embed required dependencies/assets.

## §141 — Validation and versioning

Validate schema/Fabric version, references, types, numeric limits, nesting,
fonts/assets/media. Unsupported versions fail cleanly without mutating the
library. Reject traversal/symlinks/decompression bombs/executable content and
external SVG resources. Save atomically; New/Open prompt Save/Discard/Cancel;
never export credentials or device tokens.

## §145 — Hosting and settings

Localhost administration remains available with LAN off. LAN serving starts
disabled and requires explicit opt-in/configuration. Pair phones with short-lived
codes/revocable sessions. Editing is localhost-only by default. Plain LAN HTTP
has no confidentiality; never suggest internet exposure.

Settings cover units/locale/timezone, weather/provider mapping, libraries,
device assignments, fit mode and hosting.

## §157 — Sequencing

Current order:

1. complete Fabric player flip;
2. validate/adopt the `fabricjs-image-editor` source fork;
3. migrate editor and persisted Fabric scene envelope together;
4. implement schema-v2 globals/property model and remove legacy GIF asset
   semantics;
5. live editor bindings/charts;
6. video background production path;
7. delete superseded DOM/custom generic-editor code;
8. starter theme/storage/LAN/provider/product work.

Human review is for scope expansion, product taste and external effects, not
routine architecture/sequencing.

## §170 — Dark/light variants (later)

One theme may declare dark-only, light-only or both. Dual-mode themes share scene
geometry/bindings and override theme globals/assets/visibility rather than
maintaining duplicate themes. Do not auto-invert bitmap colours.

## Later

- Icon browser over the existing importer.
- Per-device performance presets.
- Incremental native drawing beyond rectangle/ellipse/line.
- Thin Android WebView companion; normal browser access remains supported.