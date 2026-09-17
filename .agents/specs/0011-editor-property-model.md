# 0011 — Editor property model

- **Status:** accepted; partially implemented; UI implementation moves with spec 0013
- **Design sections:** §57, §61, §73, §75, §137, §141, §170
- **Supersedes in part:** 0006 and 0007 property ownership

This spec defines **what properties exist and where they live**. It does not
require the legacy Vigilia inspector; property controls should be implemented in
the new image-editor-based editor foundation.

## Rules

### D0 — Every authorable property has a property control

If an author can change it, the editor exposes it. A control that cannot work is
not shown. Raw JSON/engine options are never the normal editing surface.

### D1 — Authoring geometry uses whole units

Position, size and rotation controls use whole artboard units. Renderer-internal
center coordinates may contain halves; that is not author-facing geometry.

### D2 — Fabric groups keep geometry

Groups persist Fabric geometry and compose with child transforms. Do not flatten
group transforms into children merely to maintain a simplified theme tree.
Grouping/ungrouping preserves world appearance.

Groups remain non-painting containers: no fill, stroke, shadow, typography or
bindings of their own.

### D3 — Colour is theme-level

Palette entries are named tokens. Elements reference palette tokens rather than
owning literal colours. Palette tokens can be:

- rgba solid;
- gradient.

Element opacity remains per-instance.

### D4 — Typography uses named type presets

A type preset bundles:

- font family;
- size;
- weight;
- letter spacing;
- line height.

Text elements reference one preset. Text runs may override preset and colour by
reference when needed.

The vocabulary is author-defined; names such as `title`/`caption` are examples,
not reserved keys.

### D5 — Chart settings are family-specific

Each chart family exposes its own typed settings through declarations in
`renderer-core`. Same-family multi-selection may show shared/mixed values.
Mixed families need not show a common chart-settings section.

Changing an existing chart to another family is not required.

### D6 — Artboard is editable

Artboard controls include width/height, background token, bar-colour token and
fit mode. Resizing the artboard does not rescale scene objects.

### D7 — Reserved transparent token

`palette.none` is reserved, transparent, undeletable and unrenameable. Clearing
a colour property resolves to this token where a colour reference is required.
Deleting another referenced token requires reassignment; fallback may use
`palette.none`.

### D8 — One node identifier

Scene objects use one document-unique id. Do not maintain a second node display
name that can disagree with it. If future references target node ids, rename
must update them atomically.

### D9 — Gradient token

A gradient token contains:

- editable stops;
- stop rgba colour;
- stop position 0–1;
- one gradient rotation/angle.

The gradient spans the element's rectangular bounding box and is clipped by the
shape/text glyphs.

Threshold bands remain a separate data-mapping concept, not a gradient.

### D10 — Grouping can change stacking

Child order is paint order. Grouping makes selected children contiguous, so
interleaved unselected objects may move relative to them. Preserve selected
members' relative order and place the group at the frontmost selected position.

## Property capability matrix

This is semantic capability, not a promise about legacy panel rows.

| Property | artboard | group | shape | text | image/SVG | chart |
|---|---:|---:|---:|---:|---:|---:|
| id | locked | ✓ | ✓ | ✓ | ✓ | ✓ |
| visible / locked | locked | ✓ | ✓ | ✓ | ✓ | ✓ |
| scene order | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| position / size / rotation | size only | ✓ | ✓ | ✓ | ✓ | ✓ |
| opacity | — | — | ✓ | ✓ | ✓ | ✓ |
| fill token | — | — | applicable | text colour | monochrome where supported | family settings |
| stroke/shadow | — | — | applicable | text-specific | — | family settings |
| corner radius | — | — | rectangle | — | — | — |
| type preset / runs | — | — | — | ✓ | — | chart text settings where supported |
| asset source / fit | background only | — | — | — | ✓ | — |
| sensor bindings | — | — | — | ✓ | — | ✓ |
| chart settings | — | — | — | — | — | ✓ |

Video is a theme background layer per §55/0013, not a normal scene-node row.

## Ownership

| Concept | Owner |
|---|---|
| Node/asset semantic types | `renderer-core/src/theme/` |
| Property capabilities/vocabulary | `renderer-core/src/theme/capabilities.ts` |
| Chart setting descriptors | `renderer-core/src/charts/` |
| Palette/type presets | theme globals |
| Scene geometry/grouping | persisted Fabric scene |
| Property UI | chosen editor foundation + Vigilia extensions |

Do not duplicate capability lists inside UI panels.

`PropertyPanelManager` composes sections from chart, token/type, artboard,
asset, binding, media and layer managers. Each domain manager owns its edits;
the panel owns only selection-driven mounting and teardown.

## Schema v2 changes

The schema change should land with the Fabric editor/envelope migration:

- Fabric scene JSON replaces the old simplified node tree;
- palette becomes rgba/gradient tokens;
- `fonts`/`fontSizes` become type presets;
- add reserved `palette.none`;
- remove duplicate node `name`;
- artboard width/height editable;
- old schema version is refused rather than silently guessed at.

## Multi-selection and validation

- Show/edit a property only when it applies to all selected objects.
- Equal values show normally; differing values show mixed.
- Invalid input is refused rather than coerced.
- Token refs must resolve or remain explicitly marked missing.
- Binding semantic keys may not be persisted empty.
- Property editing must not generate schema-invalid authored state.

## Acceptance

- Capability vocabulary has one owner consumed by validation and UI.
- Unknown property names are rejected explicitly.
- Palette/type presets serialize as references, not copied resolved values.
- All chart-family settings are editable through the new property UI and repaint.
- Group geometry round-trips through Fabric and group/ungroup preserves world
  appearance.
- Hidden/locked objects remain inspectable through layers/property UI.
- Artboard resize changes the canvas, not object scale.
- `palette.none` semantics are enforced.

Current implementation evidence belongs in `status.md`.
