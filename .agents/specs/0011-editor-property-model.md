# 0011 — Editor property and theme-token model

- **Status:** active; chart descriptors/control path partly implemented, remaining domains pending
- **Design sections:** §57, §73, §75, §83, §87, §89, §137, §170

## Goal

Define authored property ownership independently of any particular panel layout.
The new editor property surface must use this model rather than preserve the old
Vigilia inspector.

## Rules

### Authorable properties need a UI

If Vigilia supports authoring a property, expose a typed control. Do not make raw
Fabric/ECharts JSON the normal editing surface. Invalid input is refused rather
than coerced.

### Geometry belongs to Fabric

Fabric objects/groups persist geometry and compose transforms. Groups are
non-painting containers: no fill/stroke/shadow/typography/bindings of their own.
Author-facing geometry uses whole artboard units where practical.

### Colour is theme-level

Final palette entries are named tokens containing CSS-compatible solids or
gradients. Every authored element paint, including `fill`, stroke and text
colour, references a palette token; per-instance opacity remains local. A
gradient has editable colour stops/positions plus one angle and spans the
object's rectangular bounding box before clipping.

`palette.none` is reserved transparent fallback and cannot be deleted/renamed.
Deleting another referenced token requires reassignment.

### Typography uses type presets

A named type preset groups family, size, weight, letter spacing and line height.
Each styled run independently references its preset and palette colour; local
typography is invalid and there is no text-object-level preset.

### Charts are family-specific

Each chart family owns typed setting descriptors in `renderer-core`. The editor
builds controls from those declarations. Existing charts need not change family.
Raw ECharts options are not persisted or directly edited.

### Artboard/domain properties

Artboard authoring includes width/height, background token, bar-colour token and
fit mode. Resizing the artboard does not rescale scene objects.

Scene objects use one stable Vigilia id rather than separate id/name fields that
can disagree.

## Capability summary

| Capability | group | shape | text | image/SVG | chart |
|---|---:|---:|---:|---:|---:|
| scene geometry/order/visibility/lock | ✓ | ✓ | ✓ | ✓ | ✓ |
| opacity | — | ✓ | ✓ | ✓ | ✓ |
| palette paint | — | applicable | text colour | monochrome where supported | family settings |
| typography preset/runs | — | — | ✓ | — | chart text where supported |
| asset source/fit | — | — | — | ✓ | — |
| sensor binding | — | — | ✓ | — | ✓ |
| family settings | — | — | — | — | ✓ |

Multi-selection/mixed-value property UX is **not currently a requirement**; it
is a review candidate in spec 0014.

## Current implementation state

Implemented:

- Fabric scene geometry/grouping persistence;
- one chart-setting descriptor owner in `renderer-core`;
- fork chart panel for scalar settings on one selected `VigiliaChart`;
- fork artboard control for persisted width/height, contain/cover preview and palette-token paint;
- selected-chart binding controls for shared semantic keys, precision, unit display, scale and offset;
- v2 palette validation reserves immutable transparent `palette.none`;
- structured solid/gradient palette tokens, including CSS-compatible solid colours;
- fork palette controls to add/edit stable tokens and gradient angles/stops;
- palette-token reassignment/deletion across Fabric paint/text metadata and artboard paint;
- type-preset schema/reference validation and per-run shared-plan resolution;
- persisted Fabric palette/type references with validated save/open semantics;
- fork type-preset controls for global family, size, weight and line height;
- type-preset reassignment/deletion across every authored text run;
- v2 validation rejects legacy global groups and local artboard/text paint or type values;
- settings update in place without rebuilding the legacy node tree.

Still transitional/not implemented:

- domain property UI for assets;

Because nothing has been released, the development v2 semantic shape may break
while this spec is completed. The Fabric-scene envelope boundary itself remains
settled by spec 0013.

## Ownership

| Concept | Owner |
|---|---|
| Theme semantic types/validation | `renderer-core/src/theme/` |
| Published development schema | `schema/theme-document.schema.json` |
| Chart setting descriptors | `renderer-core/src/charts/` |
| Scene geometry/grouping | Fabric scene via `scene-fabric` persistence |
| Current chart property UI | `editor/src/chart-manager/` |
| Current palette/type property UI | `editor/src/palette-panel.ts`, `editor/src/type-preset-panel.ts` |

Do not create speculative managers/owners for property domains that are not yet
implemented.

## Acceptance

Before stabilising the theme format:

- palette/type presets persist as stable references rather than copied values;
- `palette.none` and reference deletion/reassignment rules are enforced;
- supported chart settings have typed controls and repaint correctly;
- artboard/token/type/binding/asset properties have a product editing surface;
- unknown/invalid authored property values are explicitly rejected;
- runtime telemetry never becomes persisted authored state.

Current run evidence belongs in `status.md`.
