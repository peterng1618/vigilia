# Reference theme fidelity and frosted glass

- **Status:** in progress — [implementation plan](../plans/2026-09-26-reference-theme-fidelity.md) written and queued; no implementation started.
- **Date:** 2026-09-26
- **Queue:** immediately after snapping fidelity; before previously queued work.

## Intent and scope

Let authors recreate the supplied dashboard through Vigilia's editor, with live
data and matching editor/player output. **Progressively update the actual default
starter theme as capabilities land**, not a separate showcase. Imported fonts,
wallpaper and decorative image/SVG assets are allowed; hand-edited scene JSON,
baked dashboard screenshots and hardcoded live readings do not meet acceptance.

The [latest reference](2026-09-26-reference-theme-target.png) is the third image
supplied on 2026-09-26: 1672 × 941,
`SYSTEM INSIGHTS` subtitle, RAM partial gauge and VRAM circular ring. It replaces
both earlier targets. Match foreground layout, typography, icons, spacing and
panel material closely to this target. **Real blurred/frosted glass is mandatory.**
The city/background artwork is exempt. **Existing chart rendering is acceptable;
pixel-perfect chart matching is not required.** Subtle chart glow is optional
only when inexpensive within existing chart owners.

Weather remains backlog for a future spec. Daily upload/download totals are out
of scope, including counter acquisition, accounting, persistence and related UI.
Processes, music and to-do panels are excluded.

This is the next queued milestone after
[snapping fidelity](../plans/2026-09-25-snapping-fidelity.md), not a second active
plan. Finish and verify snapping before activating this work. The user's request
approved this spec for planning; plan review and glass feasibility still precede
product implementation. Remaining queued work
keeps its relative order behind this milestone. This does not silently expand the
[author-first release](2026-09-26-author-first-release-design.md) promise.

## Visual target and matching boundary

- Upper-left tracked `VIGILIA` wordmark and `SYSTEM INSIGHTS` subtitle.
- Top row: large clock/date card, then CPU, GPU, RAM and VRAM cards. Clock has
  separate PM text and a thin divider above the date.
- CPU/GPU: blue/purple outline icons, large usage percentages, model-name captions,
  gradient area sparklines, frequency captions and GPU temperature.
- RAM: teal partial radial gauge with an open bottom, track, centered usage
  percentage and used/total capacity text. Use the existing gauge family.
- VRAM: purple full circular progress ring with track, centered usage percentage
  and used/total capacity text. Use the existing full-circle gauge capability;
  never substitute a historical sparkline or an unrelated pie breakdown.
- Lower left: wide Performance Trends panel with icon, CPU/GPU/RAM legend and
  three colored line series. Existing axes, markers, gradients and grid are
  sufficient; exact ticks, line shapes and label formatting are not requirements.
- Lower right: Storage above Network. Storage has icon/title, right-aligned
  percentage, horizontal rounded blue gradient bar, volume label and chevron.
  Chevron is decorative in this scope, not a new navigation action. Network has
  icon/title, inline colored download/upload arrows and rates, and two live series.
- Dark frosted panels with thin cool borders, consistent radii, aligned content
  and reference-like typography. No weather region, daily totals, quotes or
  unrelated chart-family demonstrations.

The existing background or a licensed substitute is allowed. Glass must sample
that actual background; consequent differences in blurred pixels are expected.
This exception does not permit tint-only panels or loosen foreground layout.
Live timestamps, device names, readings and waveforms naturally differ from the
image. Missing sensors stay visibly unavailable, never replaced by pictured
values. Controlled preview data may support visual comparison but is never a
real-data fallback. Fonts/icons must be licensed and packaged as needed for
reliable output; any unresolved foreground mismatch must be reported.

## Existing foundations and required gaps

Reuse the v2 Fabric envelope, Fabric scene, palette/type presets, text runs,
clock formatting, asset packaging and current chart families. No second renderer,
editable scene tree, persistence path or generic effects/widget framework.

| Need | Existing foundation | Required work |
|---|---|---|
| Background/icons | Packaged image/SVG assets and background media | Compose through normal asset/editor paths |
| Panels | Starter Rect objects already have fill, radius and stroke | Insert panels; edit paint references, stroke, radius and shadow |
| Frosted glass | No shared backdrop-blur treatment | Real clipped backdrop blur with editor/player parity |
| Tracked typography | Preset UI exposes spacing; v2 object/run application is incomplete | Finish spacing propagation through edit/revival/live refresh |
| Clock and readings | Text runs, formatting, units, scale and timezone | Reuse and prove stable layout |
| Charts | Lines/areas, partial/full gauges and horizontal bars | Configure existing capabilities in the starter |
| Device captions | GPU/disk discovery already exposes names | Bind CPU/GPU/volume metadata for the selected device |

Relevant source owners live under `src/web/packages/`: editor
`selection-inspector/`, `new-object-panel.ts`, `new-fabric-theme.ts`;
scene-fabric `object-type.ts`, `text-runs.ts`, `background-media.ts`;
renderer-core `charts/`, `data/semantic-keys.ts`; host providers/device settings.

## 1. Authorable panels and mandatory glass

### Controls and authored state

Authors can insert a rectangle panel without copying the starter. Selection
controls expose fill/tint and stroke palette references, stroke width, corner
radius, opacity, shadow paint/blur/offset, and frosted-glass enable/blur radius.
Existing palette and type-preset panels remain the owners of colors/gradients and
typography. Controls need accessible names, keyboard operation, valid ranges and
visible invalid-input feedback. Committed edits use existing history.

Glass is a treatment on a rectangular panel, not a new scene model. Blur radius
uses artboard units; zero disables blur. Paint the existing palette-backed fill
as tint over the blurred backdrop, retaining normal stroke/shadow semantics.
Do not add arbitrary filters, saturation/noise stacks or custom path masks.
Persist only authored treatment parameters through the existing v2 custom-property
and validation boundary. Reject non-finite, negative or out-of-budget values
before revival/allocation. The plan must set finite radius/backing limits from
the rendering probe; no arbitrary filter strings or unbounded surfaces.

### Rendering behavior

At the panel's paint position, blur already-composited content behind it:
artboard paint/media and earlier visible scene objects. Clip to the transformed
rounded outline, then paint tint/stroke and later foreground content normally.
Never sample the panel itself, later objects, selection controls, guides or
editor chrome. Overlapping panels follow scene order; grouping preserves it.

Move/resize/rotate/group/reorder and viewport/DPR changes must retain sampling
alignment. Changes to underlying images, charts, text or video invalidate the
derived result. Static scenes must not require a permanent repaint loop. Sample
with padding to prevent dark edge seams while preserving artboard clipping.
Text/icons/chart strokes above glass stay sharp; object/group opacity follows
normal compositing semantics.

`scene-fabric` owns this for editor Canvas and player StaticCanvas;
`renderer-core` owns only DOM/Fabric-free authored semantics and validation.
Surfaces, caches and invalidation state are transient, never serialized, included
in history or mirrored into React.

Current background media is a DOM sibling below the canvas: sampling only canvas
pixels would miss the wallpaper. Shared rendering must make the same resolved
media available to backdrop composition with identical fit/crop/lifecycle. Do
not screenshot browser DOM or maintain a second editable media/scene model.
Preserve existing background behavior for themes without glass.

### Reuse and feasibility gate

Prefer browser-native filtering/compositing integrated with Fabric. Whole-canvas
CSS backdrop filtering cannot express individual objects' scene order/clipping.
Per-card DOM overlays duplicate geometry/layer/capture behavior. An image-only
blur does not automatically sample scene content behind a panel. Pre-blurred
artwork cannot replace real glass.

Direction: shared backdrop sampling at the Fabric render boundary, using bounded
transient surfaces. The exact hook/cache policy needs a probe before product
implementation; this spec does not claim an untested hook works. Probe installed
Fabric 7.4.0 with transformed/grouped/overlapping panels, background media,
changing chart/video content, capture and zoom/DPR. Record browser support,
render cost with glass enabled/disabled and memory bounds. If native filtering
fails, inspect installed Fabric filters and maintained alternatives before custom
blur code; record fit, licence and bundle cost. No new dependency is approved here.

Report missing media, unsupported blur and resource-limit failures explicitly
without losing authored state. Tint-only error fallback may preserve readability
but never passes glass acceptance. Use declared assets and existing security
boundaries, not arbitrary URL fetching or origin-policy bypass. Dispose derived
resources/listeners/media references on deletion, theme replacement and unmount.

## 2. Typography and existing charts

Finish object-level preset letter-spacing in the current v2 Fabric path, including
preset edits, duplicate, history revival and live refresh. Do not fix only the
legacy ScenePlan path. Do not pretend object-level properties work per character;
disclose unsupported mixed tracking. Preserve fixed boxes, alignment, wrapping
and overflow when reading widths change. Center gauge text using normal live text
objects and existing type presets rather than hardcoded chart labels.

Configure existing lines/areas, partial/full gauges and storage bars. Match chart
placement, family, represented metric, broad color scheme and surrounding text;
accept existing engine rendering for arcs, gradients, markers, axes and grid.
Do not add a chart styling subsystem, exact percent/time tick controls or custom
gauge ticks merely to reproduce this image. Keep raw engine options out of themes.

Use current bounded history and truthful time labels. The reference's pictured
hour does not require new hour-long retention, replay or historical storage:
current supported window is acceptable. Never stretch five minutes of samples
across fake hour labels or invent history. Preserve missing/non-ok gaps and
current acquisition/presentation boundaries.

### Optional glow

A subtle colored halo around lines/bars is desirable only if existing engine
shadow support can deliver it through a small typed setting/control and adapter
change. Reuse series paint for glow color where possible. Verify clipping,
performance, save/reopen and editor/player parity if included. Do not blur the
foreground stroke, text or whole panel to simulate glow. Skip and report it if
it needs extra render passes, duplicate series, new dependencies, custom shaders
or a general effects stack. Glow is not an acceptance or scheduling blocker;
gauge glow is not required by the target either.

## 3. Live device labels

Expose semantic text bindings for CPU model, selected GPU model and selected
storage volume label/mount identity through existing discovery/assignment owners.
Reuse current capacity/load/frequency/temperature keys and text formatting.
Labels must describe the same assigned device as adjacent readings. Device
changes invalidate metadata and readings together; missing discovery yields
unavailable text, never the starter's sample machine name. Reuse discovery
cadence rather than add high-frequency metadata polling.

Portable themes must not bind provider-instance IDs. Expose only needed display
metadata, not serial numbers or unrelated hardware identity. Keep baseline versus
LibreHardwareMonitor capability differences explicit. Rate display uses existing
unit/scale semantics. No daily network accounting or background-collection setting.

## 4. Progressive default starter and proof

`createNewFabricTheme` in `editor/src/new-fabric-theme.ts` remains the owner.
Update its scene/palette/type presets/assets/bindings as each capability lands.
Every target-affecting phase must leave the actual default starter closer to this
reference and record remaining differences; do not postpone composition to a
separate final demo. New-theme creation opens this same editable composition.

Replace old weather, quotes and unrelated CPU-gauge/pie/thermal demos with the
specified composition. Retain RAM partial gauge and VRAM full ring. Product chart
families remain available. Default changes must not overwrite saved user themes.
Factory-authored defaults are allowed, but every required visual property, asset
and binding must be reproducible/editable through normal UI. Prove insertion and
styling of a representative glass CPU card; code-only starter properties cannot
conceal missing authoring controls.

Save/close/reopen/export/import the actual starter and run it through the real
host/player. Preserve asset validation, stable IDs, scene bounds and capture/
thumbnail correctness. Acquire needed licensed assets without making the exempt
city background a prerequisite.

### Acceptance

- New-theme creation opens the latest layout, including RAM partial gauge and
  VRAM full ring. Compare at 1672 × 941 after each visual workstream; final review
  covers foreground arrangement, type, icons and mandatory frosted material.
  Exempt background artwork/consequent blur pixels, live-data differences and
  fine chart-rendering differences. Optional glow is explicitly included or skipped.
- UI-built panels expose promised controls; undo/redo, duplicate/group and package
  round trips retain authored appearance without persisting caches.
- Controlled photo/checkerboard proof shows real clipped backdrop blur, sharp
  foreground and no self-sampling. Movement/reordering and underlying content
  changes update the sampled result correctly.
- Inspect editor and real player at target size, another fitted viewport and
  different DPR, including grouped/rotated/overlapping panels and changing media.
- Preset spacing visibly updates and survives reopening/live refresh. Clock and
  variable-width readings preserve layout. Gauge value/capacity labels stay centered.
- Existing charts bind correct metrics, render honest gaps/time ranges and survive
  round trips. No exact chart ticks/glow or hour-long history gate.
- Host tests cover device metadata assignment/change, missing discovery and
  consistency between captions and readings. No daily-counter test work.
- Failure paths preserve work and report invalid input, unavailable data, missing
  assets and unsupported glass. Validate package content before revival.
- Record reproducible glass rendering cost, finite resource limits and cleanup/
  hidden-state behavior. No per-card acquisition loops or leaked media/caches.

Use unit tests for pure contracts and browser tests for visible behavior. New
regressions must fail with fixes disabled. Rebuild affected bundles after changes
and deliberate-break restoration. Register/inspect capture evidence; screenshots
are not cross-platform golden files. Real-host claims require starting the host.
Use focused checks during work and broad gates at milestone boundary; report
untested environments and unresolved differences rather than claim exact proof.

## Deferred and excluded

Weather needs a future standalone spec covering location/privacy, host acquisition,
provider/licensing, refresh/stale policy, condition/high/low/feels-like fields,
localization/units and packaged condition icons. Reuse bindings/assets and keep
credentials out of themes/displays. No weather or generic API wizard here.

Other exclusions: daily totals/accounting, extended historical retention/replay,
chart-engine fidelity expansion, processes/music/to-do, responsive redesign,
widget marketplace, general effects stack, path-mask blur, vector editing,
unrelated snapping and agent-environment changes.

## Ownership and handoff

Follow [ownership](../../architecture/ownership.md): selection/insertion owners for
UI; palette/type managers for references; renderer-core theme validation;
scene-fabric material/serialization/background/text; existing chart builders for
optional glow; host providers/device settings for metadata. Extend existing owners
before adding modules. Record one glass owner when implemented; update contradictory
current docs/schema/tests together, without creating parallel registries.

Related: [author journey](2026-09-24-author-journey.md),
[authoring polish](2026-09-24-authoring-and-consumer-polish.md), and product
requirements §§73, 75, 83, 85, 87, 89, 91, 93, 97, 105, 111, 116, 120, 122, 124, 126.
Reuse completed work/evidence; no overlapping queued plan execution.

References consulted: [Fabric custom properties](https://fabricjs.com/docs/using-custom-properties),
[Fabric caching](https://fabricjs.com/docs/fabric-object-caching),
[Canvas filtering](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter),
[CSS backdrop filtering](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter).
These identify primitives, not proof of Vigilia integration.

Next gate: review the queued implementation plan and select its execution method.
After snapping closes and `STATUS.md` activates this plan, approve and run Task 1's
throwaway glass probe. Record and review feasibility and finite resource budgets
before approving Tasks 2–12 for product implementation. No implementation or
acceptance is claimed here.
