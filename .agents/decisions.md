# Decisions

Current architectural positions only. Git stores superseded reasoning; feature
behaviour belongs in specs and progress in `status.md`.

## Settled

### Host: Node/TypeScript; CLI `vigilia-dashboard`

The host shares the TypeScript workspace/browser contracts. No .NET/Python
runtime is required. Plain `vigilia` on npm is unrelated.

### Fabric is the single renderer

Fabric 7.4.0 is the player/editor scene graph. `renderer-core` stays
Fabric-free; `scene-fabric` owns Fabric application/persistence. Player uses
`StaticCanvas`, editor interactive `Canvas`; import `fabric/es`.

Prefer Fabric/editor-native outcomes over compatibility glue. Preserve product
outcomes and correctness, not obsolete internal machinery.

### Persist Fabric JSON inside the Vigilia envelope

The envelope owns product semantics; Fabric owns geometry, grouping, stacking,
visibility, locks and custom-object state. No parallel simplified scene tree.
Reject incompatible Fabric runtimes before revival. Charts persist authored
settings, never ECharts/runtime data.

### Theme packages own asset-bearing files

`@vigilia/theme-package` owns portable ZIP layout and bounded validation,
reusing `renderer-core` envelope validation. A validated ZIP is the immutable
share, library and future-store release artifact; the player does not import it.
Callers own file UI/storage.

Local folders may be authoring workspaces, never a competing published format.
They export explicitly to a ZIP snapshot; do not silently synchronize folder
and package state. **Decided by:** user, 2026-09-19.

### Type presets belong to styled runs

Each run has its own optional preset reference; text objects have no base preset.
**Decided by:** user, 2026-09-18.

### Trio application aligns face and weight

Applying a curated trio updates each role preset's face and weight to the
nearest available face weight. It preserves size, spacing, line height and
unassigned custom presets. **Decided by:** user, 2026-09-20.

### New-element defaults are derived editor input

A pure editor-side factory derives valid palette/type references from the open
envelope. Defaults are not mutable theme globals or persisted state; the fork
owns generic construction/order.

### Vigilia owns its Fabric editor directly

`@vigilia/editor` owns interactive canvas lifecycle, history, selection,
transforms, grouping, duplication, object tools and layer operations directly
over the pinned `fabric/es` runtime. The adopted image-editor fork is removed
module by module; no copied fork module becomes a new editor middle layer.
Generic behaviour is retained only when exercised by the current product.
**Decided by:** user, 2026-09-21. *Supersedes: The image-editor fork is the editor foundation.*

### Development v2 may break before release

The v2 Fabric envelope is the migration branch format; there is no v1 reader.
Unreleased semantic/property shapes may change incompatibly. Released formats
require normal migration/version rules.

### Shell: React + Base UI + Tailwind

The editor shell is React 19 over Base UI with Tailwind, mounted around the
unchanged imperative Fabric boundary; the player and host keep their own UIs.
Fabric stays imperative behind the `mountEditorShell`/`EditorInteraction`
boundary. **Decided by:** user, 2026-09-20. *Landed 2026-09-24.*

### UI copy is package-local and typed

Each frontend package owns a `ui-copy.ts` for visible labels, dialogs, notices
and user-facing errors. Authored theme text, telemetry values and developer
errors stay outside it. Do not add i18n infrastructure until multiple locales
become a product requirement. **Decided by:** user, 2026-09-21. *Editor and
player migrated 2026-09-24; host UI copy not yet.*

### Charts remain typed Vigilia objects over ECharts

`VigiliaChart` uses a detached ECharts canvas. Move, rotation and proportional
resize are required; skew, arbitrary stretch, family conversion and perfect
chart-setting undo are not. Raw ECharts JSON is not an authoring surface.

### Video is an aligned DOM background

One video may sit beneath the transparent Fabric canvas using the artboard
transform. It is not a scene object; no grouping/rotation/timeline. Animated
GIF elements are dropped.

### Sensors are capability-driven

Providers report actual capability and never fabricate readings. Baseline
sensors need no driver. LHM, if implemented, runs as an external prebuilt
program; Vigilia does not compile/link its .NET library.

### A clock reading is an instant, and its zone is resolved on both sides

The host sends an instant written with the offset it was read in, never a
formatted wall clock, so a display never re-converts and two screens agree. The
zone splits by who owns the fact: the consumer's default is applied **by the
provider** (a machine preference, like the device assignment), and an author's
pinned zone **by the display** at format time (design of that one clock). How it
reads stays authored; a key per format would put presentation in the vocabulary.

### A unit preference is applied by the display, never stored in a sample

Providers report SI. The consumer's measurement system changes only what is
shown, so conversion happens at presentation — after a binding's own scale and
offset, before formatting — and never in the reading: a converted sample would
put a derived number where a measurement belongs, and every other reader of that
key would see the conversion (§97). Only a family that declares a conversion
converts (temperature today), so the setting cannot appear to cover a unit it
does not. Like the zone default it is global rather than per theme — a person's
units do not change per dashboard — but unlike the zone the display applies it,
because the zone is a fact about the machine's clock and this is not. A display
reads it once at load, so a screen already showing a theme keeps its units until
it reloads, which the settings page says.

### Location is built with the weather provider, not offered before it

Weather is the first consumer of a location, and it is a §99 custom-API provider
whose URL and credentials are its own configuration. Offering the setting now
would add a control that changes nothing.

### Performance budgets follow measurable costs

Keep the player bundle-size gate. Add budgets when a real expensive path exists;
reproducible browser profiles suffice without a physical-device release gate.

### Snapping geometry is vendored above the line budget

`movement-snapping-resolver.ts` and `spacing.ts` are vendored verbatim at over
1,300 lines each, exceeding the 800-line stop. Re-cutting proven geometry during
transcription is where silent numerical bugs enter; a byte-comparable diff
against the original is worth more than the line budget. Splitting is an
[editor behaviour review](../docs/superpowers/specs/2026-09-24-editor-behaviour-review.md) follow-up.

### Pasting is owned by the document paste event

`Ctrl+V` stays unbound so the browser delivers `ClipboardEvent.clipboardData`,
the only route to an image copied from another application. Copy, cut and
duplicate go through the shortcut dispatcher.

### The image pixel bound applies on import and on rehydrate

A Fabric image's size follows its element, so bounding only one attachment
point would change geometry on every reopen.

### A rotated image refuses a crop session

`clipPath` coordinates are image-local and unrotated; mapping a canvas-space
frame through a rotated image's inverse transform is a larger problem than the
feature asks for. Refusing is honest where approximating is not.

## Open

- **Extended sensors:** PawnIO/LHM coexistence with Vanguard/EAC/BattlEye remains
  unverified and belongs to provider validation.

### Chart thresholds resolve fractions against the authored range

A threshold fill's offsets are 0–1 fractions; per-value line colouring needs
values. Fractions resolve against the line's authored `min`/`max`, and a line
with neither keeps a single colour rather than mapping onto a moving visible
axis. **Decided by:** user, 2026-09-24.
