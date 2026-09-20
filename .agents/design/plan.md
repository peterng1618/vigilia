# Vigilia — product plan

Agent-owned current requirements. User goals and explicit product choices take
precedence. `§N` markers are stable labels used by code/docs; never renumber.

## Goals

1. Show the PC's live state on a phone over local Wi-Fi without internet.
2. Design dashboards visually in a desktop browser, not by editing JSON.
3. Treat charts and typography as first-class product features.
4. Personal use first; optimize development speed over release polish.
5. Never show a number that was not measured.

## Non-goals

Wireless wake-up · multiple pages per device · arbitrary theme scripts ·
USB/serial displays · building a general-purpose graphics editor · animated GIF
elements · formula-driven styling · OAuth flows · mutation requests.

## §7 — Product and scope

Windows-first PC-hosted dashboard editor/player. Local metrics work without
internet; remote API/weather sensors use their endpoints. V1 supports
bitmap/SVG artwork, one video background, basic shapes, charts and rich
text/typography. Decorative drawing must not delay charts or typography.

## §31 — One renderer, shared

Editor and player use one Fabric scene implementation. Use the adopted
`fabricjs-image-editor` fork for generic editor mechanics; Vigilia adds domain
work only. Do not maintain a second DOM/geometry renderer.

## §32 — Prefer Fabric-native substitutions

If exact old behaviour requires disproportionate custom integration, choose a
reasonable Fabric-native/editor-native outcome while preserving correctness,
persistence, security and accessibility invariants.

## §33 — Nothing is done until observed

Code/library claims are hypotheses. Visible changes require browser/rendered
verification plus appropriate tests. State what was not verified.

## §35 — Application shell (later)

Today the Vigilia shell is TypeScript/Vite and the adopted editor fork; there is
no React dependency. After the Fabric migration/core authoring path stabilizes,
modernize the surrounding shell incrementally with shadcn and Base UI patterns,
Tailwind/CSS variables, and the existing imperative TypeScript boundary.

Fabric remains imperative behind an editor/controller boundary. Do not mirror
Fabric objects declaratively. Editor-shell theming is separate from authored
dashboard theme globals. This modernization must not block the current
migration.

## §43 — Feasibility

Fabric rendering is established for text, images/SVG, basic shapes and all four
chart families. `VigiliaChart` supports rotation, proportional resize, live
redraw and persistence. Video remains a separate background path.

## §47 — Small display bundle

Player must not import editor controls/managers. Keep an explicit bundle-size
gate. Old/low-end phones are in scope; no physical-device release gate is
required.

## §51 — Artboard

A theme has logical width/height. One uniform transform applies to all authored
content, including background alignment, strokes, typography and shadows.

## §53 — Fit modes

`contain`: show the whole artboard and fill bars. `cover`: fill viewport and
crop. Editor preview matches player behaviour.

## §55 — Background media

At most one video background sits beneath the transparent Fabric canvas and is
cropped/aligned by the same artboard transform. It is not a normal scene object.

## §57 — Geometry

No automatic reflow. Editor zoom is not document geometry. Fabric groups keep
and compose transforms; group/ungroup preserves world appearance. Authoring
controls use whole artboard units where practical.

## §61 — Editor controls

Generic selection, transforms, grouping, duplication/clipboard and object tools
come from the adopted editor foundation. Vigilia should not recreate them.

Old custom-editor QoL that is absent from the fork route is **not automatically
a requirement**. Keep/replacement decisions for layers, align/distribute and
related behaviour are reviewed in spec 0014 before implementation.

## §64 — Rulers, grid, guides and snapping (review)

The previous custom editor specified pixel rulers, configurable grid/guides and
multiple snapping modes. None is currently present on the fork route. Treat
those as review candidates in spec 0014, not hard migration acceptance, until
they are revalidated against the new editor workflow.

## §67 — Undo/runtime separation

Authored and runtime state must remain separate: telemetry, playback, selection
and viewport never enter authored history. Chart-setting undo may be omitted if
it requires substantial custom machinery. Additional legacy history UX is not a
migration blocker unless explicitly retained after review.

## §73 — Theme globals

Named typed globals cover palette, typography presets, spacing and assets.
Palette values include CSS-compatible solids and gradients. All authored paint,
including `fill`, resolves through the palette; only non-paint properties such
as opacity and geometry remain local.

## §75 — References and identity

Compatible authored styles resolve through stable global keys; typography resolves
through named type presets and paint resolves through palette tokens. Globals also
have editable display names. Deleting a referenced global requires reassignment.
Scene objects have one stable Vigilia id.

## §77 — Widgets

Reusable subtrees expose compatible parameters/defaults. Insertion embeds a copy
with fresh ids/provenance. Import maps globals explicitly; standalone export
includes required defaults/assets.

## §81 — Chart families

Pie/donut; full/partial radial gauges; horizontal/vertical bars/progress;
multi-series line/sparkline/area. Existing charts need not change family.

## §83 — Chart styling and data gaps

Supported styling includes fills/gradients, opacity, strokes/dashes, shadows,
tracks, thresholds, labels, axes/ranges, angles/thickness, spacing and line/area
options where the family supports them. Missing/non-`ok` samples render gaps,
never zero.

## §85 — Engine gap rule

A supported setting needs a property control, persisted authored representation
and visual fixture. If ECharts cannot express a treatment, surface the gap and
get product agreement before stabilising an approximation. Open gaps: gauge
angular gradients and discrete line-threshold bands.

## §87 — Typed chart settings

Themes persist typed Vigilia chart settings, not raw ECharts options. Engine
translation has one owner.

## §89 — Typography

Support inline editing, curated packaged font faces and rich
family/size/weight/style/spacing/line-height/alignment/rotation/wrapping/
clipping/fill/outline/shadow/opacity controls. Styled runs may differentiate
label/value/unit. Sensor text uses fixed boxes by default to avoid jitter.

## §91 — Typography in charts

Chart text uses shared typography tokens where supported. Use native text overlay
rather than bitmap labels when ECharts cannot reproduce a required treatment.
Handle fallback/missing fonts and changing digit widths explicitly.

## §93 — Sensors and semantic binding

Samples carry identity, timestamp, value, unit and status. Themes bind semantic
keys, never provider instances. Providers report discoverable capability;
providers acquire while the host schedules/timeouts/backoff.

## §97 — Platform boundaries and honest capability

Windows-specific hardware/startup/tray/firewall/secret code sits behind platform
boundaries. Never fabricate readings. Unavailable sensors explain why; real data
never silently falls back to synthetic data.

## §99 — Custom API sensors

Desktop wizard for HTTP(S) JSON GET polling with URL/query/headers/interval/
timeout/auth. Secrets are referenced, not embedded. JSON Pointer mappings create
numeric/string/boolean sensors with units and optional scale/offset.

## §101 — Credentials and fetching

Fetch remote APIs on the PC. Secrets use platform storage, stay out of themes and
logs, and never reach display responses. Validate destinations/redirects; bound
response size/concurrency and share requests across mapped fields.

## §105 — Renderer inputs

Theme semantics, Fabric scene, resolved assets/fonts, samples/history, viewport
and clock. Editor/player share renderer objects; charts update without rebuilding
the scene.

## §111 — Minimal PC overhead

Poll the union of sensors active clients need once per cadence. Additional
displays must not multiply acquisition; reuse provider connections/discovery.

## §116 — Where work happens

| PC host | Phone/display |
|---|---|
| acquisition, remote API fetches, credentials, reconnect history | dashboard rendering, formatting, chart buffers/animation, media decoding/cache |

Normal operation needs no PC browser, bitmap streaming or video transcoding.

## §120 — Acquisition discipline

Respect provider-level grouped acquisition. Suspend unused acquisition after a
grace period unless background history is enabled.

## §122 — Rates and slow clients

Sampling, transmission and animation are separate rates. Batch updates; bound
queues; discard obsolete pending snapshots. Presentation interpolation never
pretends to be additional measurements; numeric text is not interpolated.

## §124 — One baseline

V1 has one bounded chart/history/animation baseline. Pause rendering when hidden
or disconnected. Performance presets remain future scope.

## §126 — Budgets when measurable

Add numerical budgets for real expensive paths. Use reproducible automated/
browser profiles where useful; physical-device validation is not a release gate.

## §132 — Imported artwork

Sanitize SVG before preview; preserve vector/multicolour originals; expose
size/rotation/flip/opacity/monochrome recolour. Store source/hash and supplied
licence/attribution metadata. Imported icons work offline. A future URL-import
flow may ingest Font Awesome SVG or Unsplash imagery only after remote input,
licence and attribution behaviour is defined.

## §134 — Theme format

Vigilia owns a versioned semantic envelope; Fabric JSON is the persisted scene.
The development v2 envelope already establishes this scene boundary. Its globals/
property semantics remain pre-release and may break until spec 0011 completes.

Pin Fabric exactly; incompatible versions fail before revival. Persist authored
custom-chart settings only, never built ECharts/runtime state. Human-readable
scene JSON is not a goal. No v1 compatibility reader is required.

## §137 — Document and node shape

Envelope contains schema/Fabric version, id/metadata, artboard, globals, assets,
bindings, editor metadata and Fabric scene JSON. Fabric child order is paint
order; groups carry geometry and ordered children.

## §138 — Widgets in the document

Reusable subtree with local artboard, exposed style/data parameters, defaults
and preview. V1 insertion embeds a copy with fresh ids/provenance; no automatic
library-update propagation.

## §139 — Packages

ZIP packages embed required theme/widget dependencies and assets. The first
theme-package format is one v2 theme envelope plus its declared `assets/` bytes;
it rejects unexpected paths, duplicate/missing assets and bounded hostile input
before a document is revived. Preview/licence files and widget packages follow
only when they have an authoring workflow.

The host may expose declared package assets as validated read-only bytes for the
player; the player remains ZIP-format-free.

Local folders may expose the same `theme.json` and `assets/` layout for external
asset editing. They are authoring workspaces: detect changed asset hashes and
reload deliberately, then export an immutable ZIP for sharing, libraries and a
future store. Do not silently synchronize folder and package copies.

## §141 — Validation and versioning

Validate schema/Fabric version, references, types, bounds, nesting and assets.
Unsupported versions fail cleanly without mutating the open document. Reject
traversal/symlinks/decompression bombs/executable content/external SVG resources.
Save atomically when host storage exists. New/Open must not discard dirty work
without Save/Discard/Cancel. Never export credentials/device tokens.

## §145 — Hosting and settings

Localhost administration remains available with LAN off. LAN serving is explicit
opt-in. Pair phones with short-lived/revocable sessions. Editing is localhost-only
by default. Plain LAN HTTP has no confidentiality; never suggest internet
exposure.

Settings cover units/locale/timezone, provider mapping, libraries, device
assignments, fit mode and hosting.

## §157 — Sequencing

Current migration order/status:

1. Fabric chart/shared renderer/player migration — **done**.
2. Source-fork editor feasibility spike — **done**.
3. Fork editor + v2 Fabric envelope migration — **done** (spec 0013).
4. Review missing legacy-editor behaviours before recreating them — **active**
   (spec 0014). Semantic layers and align/distribute are retained in spec 0011;
   the remaining candidates are review-only.
5. Build the bounded theme-package reader/writer — **done** (spec 0015).
6. Finish v2 palette/type/reference/property semantics, including asset
   authoring over the package boundary — **pending** (spec 0011).
7. Live editor bindings/charts — **pending**.
8. Production video background over packaged media — **pending**.
9. Delete superseded DOM/custom editor code — **done**.
10. shadcn/Base UI shell modernization — **later**, after core authoring
   stabilizes.
11. Starter theme/storage/LAN/provider/product work continues around those gates.

Human review is for scope expansion, product taste and external effects, not
routine architecture/sequencing.

## §170 — Dark/light variants (later)

A theme may be dark-only, light-only or dual-mode. Dual-mode themes share scene
geometry/bindings and override globals/assets/visibility rather than duplicating
the theme. Do not auto-invert bitmaps.

## Later

### Editor research candidates (non-requirements)

  - After spec 0014 retention review, consider fork-owned rulers, guides, hover
    preselection, crop controls and measured stress fixtures from yft-design.
  - After §35, consider a creation/assets/templates rail, central artboard,
    contextual property rail and zoom/status footer. Actions stay visibly
    labelled and keyboard-accessible; this is not a separate agent-mode UI.
  - After §139 storage, consider debounced validated-envelope/package autosave,
    template thumbnails/gallery and export presets. Raw Fabric JSON alone is not
    a document store.
  - Do not adopt another editor foundation, UI-state model, literal style
    defaults, remote-asset URLs or page model.

  Sources: [yft-design](https://github.com/dromara/yft-design),
  [OpenDesign](https://github.com/clawnify/OpenDesign),
  [fabric-canvas-editor](https://github.com/onerkiz/fabric-canvas-editor).

- Icon browser over the existing importer.
- Per-device performance presets.
- Incremental native drawing beyond basic shapes.
- Thin Android WebView companion; normal browser access remains supported.
