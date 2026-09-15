# Vigilia — product plan

**Owned by the agent.** The user supplies goals and intent; everything else here
— architecture, sequencing, format design, trade-offs — is the agent's to decide
and to keep true. Revision 10, 13 September 2026.

## How to read the §N markers

`§N` is a **stable label**, written into the text below. It is not a line number
and not a section number.

It used to be both, inconsistently: `§47` meant line 47 while `§7` meant section
7. Code cites 43 of these labels **446 times**, so adding a single line to this
document silently invalidated every marker beneath it — which is why this
document sat frozen at revision 9 while the project moved past it, still
mandating Vue, Fabric, ASP.NET Core and SignalR. The numbers are kept exactly as
they were so every existing citation still resolves; they are no longer
positional, so this document can now be maintained.

Add a new requirement with the next free number. Never renumber.

---

## Goals

From the user. These are the only part of this document an agent does not
decide.

1. **See my PC's live state on a phone**, over local Wi-Fi, without internet.
2. **Design the dashboard visually**, in a desktop browser — not by editing JSON.
3. **Charts and typography are the product.** Extensive, editable, data-aware
   styling is release scope, not polish.
4. **Personal use first.** Optimise for development speed over release polish.
   No packaging, publishing or release engineering until asked.
5. **Never show a number that was not measured.**

## Non-goals

Wireless wake-up · multiple pages per device · arbitrary theme scripts ·
USB/serial hardware displays · a general-purpose graphics editor · formula-driven
styling · OAuth flows · mutation requests · streaming protocols.

---

## §7 — Product and scope

A PC-hosted website for live hardware monitoring over local Wi-Fi. Full editing
in a desktop browser; each phone shows one assigned dashboard. Windows-first,
with boundaries preserved for later Linux/macOS support and **no promise of
identical sensor coverage**. Local metrics need no internet; remote API sensors
and weather need their endpoints.

V1 includes static bitmap/SVG elements, GIF elements and video backgrounds.
"Static artwork" excludes sensor-driven bitmap masks, sprite gauges and bitmap
needles — not GIF or video playback.

Native shape drawing starts minimal: rectangle, ellipse, line. Decorative
artwork may be imported as bitmaps or SVG. Expanding native drawing must never
delay chart or typography quality.

## §31 — One renderer, shared

The editor and the display render through the same code. Rendering a scene twice
is forbidden: it is how editor and display drift apart. The editor adds
interaction on top of that one renderer rather than bringing a second.

**Do not build a general-purpose graphics editor.** The renderer is Fabric and
the scene graph is its object model; hit testing, transform handles, rotation,
grouping and z-order are the library's job, not ours. Where Fabric does not
reach — the artboard fit transform, snapping, the typed chart objects, the
layout options its text model lacks — we add the minimum, and we add it once, in
the module both displays import.

## §33 — Nothing is done until it is observed

Treat feature lists, library claims and prior design ideas as **hypotheses**
until demonstrated. A ticked checkbox without observable behaviour and a test is
not a pass. Report untested behaviour plainly.

Specifically: when a change is meant to be visible, render it and look. Every
editor defect worth fixing so far was found by driving a browser, and several sat
under a fully green test suite — one under a test that asserted the bug.

## §43 — Feasibility, already established

A richly styled live donut/radial gauge and filled line chart, editable sensor
text with separately styled value and unit, a packaged font, transparent
artwork, GIF and video — plus rectangle, ellipse and line proving extensible node
types, transforms and styling. Gradients, outlines, shadows, font metrics, chart
updates, layering, undo and JSON round-trip verified on desktop and phone
viewports.

Chart and text styles are editable through dedicated visual inspectors, never
raw JSON.

## §47 — The display bundle stays small

The shared renderer must run in a display-only bundle that downloads no editor
controls or inspectors. Enforced mechanically by a size budget; when it fails,
find the leaked dependency rather than raising the budget.

Old and low-end phones are in scope. Editor reuse must never force a heavyweight
player.

## §51 — Artboard

A theme declares a logical width and height. One uniform transform applies to
**all** content — including UI-bearing backgrounds, strokes, typography and
shadows.

## §53 — Fit modes

*Contain*: scale by the smaller viewport/artboard ratio, centre, and fill the
remainder with configurable bars. *Cover*: scale by the larger ratio, centre and
crop; the editor previews the cropping.

## §55 — Background media

Decorative background media may contain or cover within its own bounds.
UI-bearing backgrounds must stay aligned with foreground content.

**Video is one background, and nothing more** (decided 2026-09-15). At most one
video per theme, positioned and scaled, with **the artboard as its cropping
region** — the same clip the design itself gets. No rotation, no video as a
node, no video inside a group, no playback controls or timeline. It renders on
its own layer beneath the scene, because a video drawn into the canvas forces a
full-scene repaint per frame and cannot hold a frame budget on a low-end phone.

That single-background scope is load-bearing, not a simplification for later:
it is what keeps the layer's alignment down to the artboard scale and offsets,
computed by the one owner that also positions the scene, and it removes any
question of content painting behind the video.

## §57 — Geometry

No automatic element reflow; configuration pages stay responsive. Editor zoom is
not document geometry. Children are positioned in their parent's space with
composable transforms, and grouping or ungrouping **preserves world
appearance**.

Geometry is **whole units** — position, size and rotation are integers. A
dashboard is laid out on a pixel grid at a fixed artboard size, so sub-unit
placement buys nothing and costs legibility.

## §61 — Editor controls

Layers with rename, reorder, copy/paste, duplicate, group/ungroup, hide and
lock. A locked object stays inspectable in the tree but does not transform until
unlocked.

**A hidden element must remain reachable.** Hit-testing correctly ignores
invisible elements, so the layer tree is the non-visual route to one — without
it, hiding an element and clicking away loses it.

Align to artboard, selection or key object; distribute centres or equal gaps.
Groups act as units; locked objects are excluded.

## §64 — Rulers, grid and guides

Pixel rulers; configurable grid spacing, subdivisions, colour and visibility;
add, move and remove guides. Independent grid, guide and object snapping with
temporary bypass, and a snap tolerance that stays usable across zoom levels.
Persisted as editor metadata, never as document content.

## §67 — Undo

One drag or slider gesture is one transaction. Guide changes are undoable.
Telemetry, playback, selection and viewport changes never enter document
history, and a gesture that ends where it started leaves no entry.

While a gesture is live, a keystroke that would commit is **refused** — running
one against a document the gesture is still previewing corrupts both.

## §73 — Theme globals

Named, typed constants for palette colours, type presets, spacing and asset
references.

**Colour and typography are theme-level only.** Palette entries are rgba, and
cover gradients as well as solids. A type preset bundles font family, size,
weight, letter spacing and line height as one named unit, because those five are
only meaningful together. A compatible property **references** a global and
carries no literal of its own, so re-theming is one edit per token rather than a
visit to every element — and a future dark/light switch swaps tokens rather than
hunting element overrides.

Genuinely per-instance properties stay on the element: opacity, geometry, stroke
width, corner radius.

The vocabulary is author-defined; nothing reserves particular token names.
Importable palette or preset packs are anticipated, not built.

## §75 — References and identity

A style value is **either** a reference **or** a literal, never both, and the
inspector says which — a bare value whose origin is ambiguous is the thing this
rule exists to prevent. Property values look like `{"ref":"palette.accent"}` or
`{"value": 2}`.

Globals keep a stable key plus an editable display name, because a reference is
made from five places and renaming must not break one. **Nodes have a single
identifier**: an editable, dash-cased `id`, unique in the document. Nothing
inside the document references a node id, so a second field bought nothing and
could disagree with the first.

Deleting a referenced global **requires reassignment**; it falls back to the
reserved transparent token. Conversion to a literal is not available for colour
or typography, since element literals do not exist for those. Global edits are
undoable and update dependents without rewriting their properties.

## §77 — Widgets

A widget exposes compatible parameters that bind to theme globals or keep widget
defaults. Standalone export includes required defaults; import uses explicit
mapping rather than silently merging same-name globals. Constants and references
survive JSON round-trip, font and asset packaging, and visual tests.

## §81 — Chart families

Pie and donut; full, half and arbitrary-sweep radial gauges; horizontal and
vertical bars and progress bars; multi-series line, sparkline and filled-area
charts.

## §83 — Chart styling, and gaps

Applicable fills (solid and gradient, with editable stops), opacity, outlines
and dashes, shadows, rounded caps, tracks, thresholds, labels, legends, axes,
ranges and time windows. Ring thickness and start/end angles, pie gaps, bar
width and spacing, line width, interpolation and markers, independent area fill.
Pie composition is distinct from gauge progress.

A gradient paints over the element's **rectangular bounding box**, not its
visible filled area, so two elements of different shapes sharing one token look
the same.

**Raw values are preserved while gauge display is clamped, and a missing sample
renders as a gap — never a zero.** A non-`ok` sample carries no value at all.

## §85 — The engine gap rule

Every applicable family/style combination needs an inspector control, a JSON
representation, a preset and a visual fixture. Where the chart engine cannot
reproduce a required treatment, mark the gap explicitly and **obtain human
agreement on the alternative before committing**. Two gaps are currently open:
gauge ring gradients (approximated in segments) and line thresholds.

## §87 — Typed chart settings

Typed settings translated into engine configuration. **No raw executable
options** ever enter the theme format. Style tokens are shared with other
elements.

## §89 — Typography

Inline editing; packaged and imported licensed fonts with fallback handling;
size, weight, style, letter spacing, line height, alignment, rotation, wrapping
and explicit clipping or ellipsis. Solid and gradient text fill, outline, shadow
and opacity.

**Styled runs** so a label, a live value, its unit and any prefix or suffix can
differ within one text element; a run may override its type preset and its
colour. Decimal precision, unit display and tabular numerals where the font
supports them.

Sensor text uses fixed boxes by default, to avoid jitter as digits change width.

## §91 — Typography in charts

Shared typography tokens apply to chart titles, axis labels, legends and value
readouts, with a documented support matrix. Where the engine cannot reproduce a
treatment, use a shared native text overlay — **never a bitmap label**. Reserve
stable text boxes during font loading and surface missing-font diagnostics.
Verify multilingual glyphs, changing digit widths, baseline alignment and
overflow at several artboard scales.

## §93 — Sensors and semantic binding

A sample carries `sensorId`, `timestamp`, `value`, `unit` and `status`. A
catalogue entry carries stable provider and sensor identity, value type, display
name, unit and capabilities.

**Themes bind to semantic keys, never to provider instances**, and a mapping
layer resolves them — so changing what supplies a quantity never requires
editing a theme. The key vocabulary has one owner. Missing, stale and error
states are explicit, with remapping available.

**Providers acquire; the host schedules.** A provider never starts a timer,
caches history or pushes a sample. The registry supports several provider
instances, enabling, disabling and replacement, with per-provider timeouts and
backoff so a failing API cannot stall hardware collection.

## §97 — Platform boundaries, and honesty about capability

Windows hardware APIs, secret storage, startup, tray and firewall integration
live in platform adapters. Shared contracts, domain logic, API collection and
rendering must not depend on Windows types.

**Never fabricate a reading.** An unavailable sensor reports unavailable with a
reason; a provider on another platform reports the capabilities it has rather
than inventing the ones it lacks. A display never silently falls back to
synthetic data — a dashboard that quietly invents numbers is indistinguishable
from one that works.

## §99 — Custom API sensors

A desktop wizard for HTTP(S) JSON endpoints, GET polling initially. Configure
URL, query, headers, interval, timeout and authentication — none, API key,
bearer token, or Basic over HTTPS — with secret references in headers and query
values. Map response fields by JSON Pointer into named numeric, string or boolean
sensors, with units and optional scale and offset. Charts accept numeric sensors
only. Include a Test Connection with redacted preview and mapping validation.

## §101 — Credentials and fetching

Fetch on the PC, never on the phone. Credentials go through the platform secret
adapter, are redacted in requests and errors, and are absent from browser
responses and exported packages. Custom endpoints require explicit admin
configuration and are never activated by a theme import. Validate destinations
and redirects; never forward credentials across origins. Bound response size and
concurrency, honour rate limits, and share one request across fields from the
same endpoint.

## §105 — Renderer inputs

Document, resolved assets and fonts, metric snapshot and history, viewport and
clock. The editor and display share render components and adapters; the editor
adds interaction overlays. Charts update without recreating the scene.
Reconnecting fetches a current snapshot and bounded history, never an unlimited
backlog.

## §111 — Minimal PC overhead

A release requirement, for performance-conscious users including gamers.
**Subscribe to the union of sensors active clients need and poll once** at the
required cadence. Opening another phone must not multiply upstream polling.
Reuse provider connections; avoid repeated discovery.

## §116 — Where work happens

| PC host | Phone display |
|---|---|
| Hardware acquisition, shared API fetching, credentials, bounded reconnect history | Dashboard rendering, value and unit formatting, thresholds, chart presentation |
| Compact batched samples with timestamps and status; cacheable assets | Chart window buffers, animation, GIF/video decoding, asset caching |

Normal operation requires no PC browser, render loop, bitmap streaming, video
transcoding or live editor preview.

## §120 — Acquisition discipline

Respect providers that acquire sensor groups together; never claim per-sensor
savings without measurement. Suspend unused acquisition after a grace period
unless background history is explicitly enabled.

## §122 — Rates and slow clients

Sampling, transmission and animation rates are separate. Batch updates; bound
per-client queues and **discard obsolete pending snapshots** — a client that
cannot keep up receives the newest state, never a replayed backlog of stale
telemetry, because telemetry has no value once superseded.

Phone animations interpolate locally and must not imply additional measured
samples. Numeric text is never interpolated: digits are read as values.

## §124 — One baseline

V1 ships one measured baseline with bounded chart points, history and animation
work. Performance presets and automatic quality adjustment are future scope.
Pause unnecessary rendering when hidden or disconnected. Define tested minimum
browser and WebView versions with a clear compatibility screen.

## §126 — Budgets, when there is a cost to bound

Record numerical budgets once something measurably costs something. Nothing
built so far does: the host polls a handful of keys once a second and the
display renders a bounded scene from a bounded buffer.

**This is a deliberate deferral, not a dismissal.** A budget exists to catch the
regression nobody predicted, and two on the roadmap plausibly qualify — a
provider reading a full sensor tree every cycle, and a dense line chart on a
low-end phone. Reinstate budgets, and the named reference hardware they need,
the moment either lands.

## §132 — Imported artwork

Sanitize SVG before preview; save locally as an undoable element. Preserve
vectors and multicolour originals; expose size, rotation, flip, opacity and
monochrome recolouring. Store source and hash plus any supplied licence and
attribution metadata — **a URL alone does not establish reuse rights.** Preserve
required notices in packages. Imported icons work offline, with no CDN or
font-kit dependency.

## §134 — The theme format is ours

Own the JSON schema. Editor-library JSON, DOM snapshots and raw chart options
are **not** the theme format.

## §137 — Document and node shape

Document: `schemaVersion`, id and metadata, artboard and background, an ordered
node tree, typed globals and style references, asset references, editor
metadata. Future mode overrides extend this document rather than duplicating its
node tree.

Node: stable id, type, local transform, visibility and lock, style, typed content
and bindings, ordered children. **Child order alone determines stacking.**

A consequence worth stating: grouping makes its members contiguous in that
order, so it moves paint order for anything that was interleaved between them.
That is inherent to a single ordered child list, not a bug to fix.

A **group is a structural entity, not a drawable.** It has children, visibility,
lock and a position in the order — no geometry of its own and no paint. Moving
and rotating a group is a canvas gesture that rewrites its children's values.

## §138 — Widgets in the document

A reusable subtree with a local artboard, exposed style and data parameters,
defaults and a preview. V1 insertion embeds a copy with fresh ids and
provenance; there is no automatic library-update propagation.

## §139 — Packages

A ZIP containing `manifest.json`, `theme.json` or `widget.json`, `assets/`, and
optional preview and licence files. A pack embeds every dependency it requires.

## §141 — Validation and versioning

Validate schema version, references, types, numeric limits, nesting and fonts.
An unsupported `schemaVersion` **fails cleanly, naming both versions**, and
never half-loads. Import into staging; reject traversal, symlinks, decompression
bombs and executable content. Sanitize SVG, block external resources, impose
asset and media limits. An unsupported schema leaves the library unchanged.

Save atomically with recoverable drafts. Saving marks history clean **without
clearing it**. New and Open prompt Save/Discard/Cancel and clear history only
after a successful replacement. Never export credentials, weather coordinates or
device tokens.

## §145 — Hosting and settings

Localhost administration stays available when LAN serving is off. Tray controls
complete process start and stop: **a stopped server cannot restart itself
through its own website.**

LAN serving starts **disabled**, with explicit interface and port selection and
firewall guidance. Phones pair with short-lived codes and revocable
display-scoped sessions. Full editing is localhost-only by default. Enforce
authorization, host and origin checks, safe asset access and request limits.

**Plain LAN HTTP provides no confidentiality.** Document trusted-network-only
use; never suggest internet exposure.

Settings cover units, locale and timezone, weather coordinates and provider,
sensor mapping, libraries, device assignments, fit mode and hosting. Weather keys
stay server-side.

## §157 — Sequencing

Gates are an ordering, not a release process. Feasibility, document and
rendering, and authoring are largely done; live display is partly done; reuse
and packaging are not started.

| Gate | State |
|---|---|
| 0 — Feasibility | done |
| 1 — Document and rendering | done |
| 2 — Authoring | in progress — chart settings and layer panel outstanding |
| 3 — Live display | partly done — host and transport work; pairing, LAN and the extended provider do not |
| 4 — Reuse and packages | not started |
| 5 — Release | not started, and not wanted yet (goal 4) |

Seek human review for scope expansion, anything with external effect, and
product taste. Architecture, schema design and sequencing do not need it.

## §170 — Dark and light variants (later)

One theme declares dark-only, light-only or both, with an author-selected
default. Dual-mode themes share one node tree, layout and sensor bindings, and
store sparse overrides for **globals**, asset references and visibility.

Because colour and typography are theme-level only (§73), a dual-mode theme
overrides **tokens, not elements** — so adding a light mode touches the palette
and the type presets and no element at all. Do not automatically invert bitmap
colours. Switching modes per device must not duplicate the theme or save a new
revision.

---

## Later, in no committed order

**Icon browser** — collection browsing, search, previews and direct insertion
over the importer, behind a replaceable adapter, with catalogues kept out of the
player.

**Performance presets** — per-device Lightweight/Balanced/Full for animation,
media, chart point count and backing resolution. Preserve artboard geometry;
never silently remove informative styling.

**Incremental drawing** — per-corner radii, richer fills and strokes, editable
polygons, general-purpose arcs and rings, in small increments that each reuse the
node schema, inspector registration, undo and shared renderer. Boolean
operations and full path editing are deferred.

**Android companion** — a thin WebView shell loading the same PC-hosted display,
with fullscreen and orientation control, keep-awake, saved pairing and reconnect.
A delivery shell, not a performance fix or a compatibility fix. Ordinary browser
access stays fully supported.
