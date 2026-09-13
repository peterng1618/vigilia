# 0011 — The editor property model

- **Status:** proposed — **two decisions below need a human**, and one of them
  contradicts the user-authored design document
- **Design document sections:** §57, §61, §73, §75, §137, §141, §164, §170
- **Supersedes in part:** [0006](0006-editor-inspector.md) (which properties the
  inspector shows), [0007](0007-editor-globals.md) (the globals groups)

**This is the master definition of which entity may carry which property.** It
exists because that question currently has five answers and no owner: the
renderer reads style keys as strings, the editor's `STYLE_FIELDS` re-declares
them, `TEXT_ONLY` re-declares a subset, the JSON schema describes them in prose
inside a `description`, and `validateStyleMap` checks values but never property
*names*. A typo'd property therefore passes the schema, passes validation, and
is silently dropped by the renderer.

Per AGENTS.md §2, the vocabulary gets one owner and every consumer imports it.

---

## Problem

Three failures, all observed:

1. **A group masquerades as an element.** It carries `transform` and may carry
   `style`, so selecting one offers X/Y/width/height/fill/shadow — properties
   that either do nothing or do something surprising. Grouping is meant to be
   *structural, never visual*.
2. **Per-element colours and fonts make a theme impossible to keep consistent.**
   §75's global-or-literal choice means eleven text elements can drift to eleven
   slightly different sizes, and re-theming means visiting every node.
3. **Chart settings are unreachable.** `gaugeSettings`, `barSettings`,
   `lineSettings` and `pieSettings` are typed and validated, and the inspector
   exposes none of them — so the one thing a dashboard element is *for* cannot
   be configured.

## Decisions

### D1 — Geometry is whole units *(decided, implemented)*

Position, size and rotation are integers. `updateTransforms` rounds, because
every transform write funnels through it. `scaleX`/`scaleY` are multipliers, not
units, and are not rounded. Landed as `3b545c5`.

### D2 — A group is an editor entity, not a theme element

A group exists to move things together and to organise the layer list. It is
**not** a drawable.

| A group has | A group does not have |
|---|---|
| `children` | `transform` — no x, y, width, height, rotation, scale |
| `locked` | `style` — no fill, stroke, shadow, opacity, typography |
| `visible` | `bindings` |
| Order among its siblings | A name that affects rendering |

Consequences that follow, and each is a real behaviour change:

- **Its bounds are derived from its children**, not authored. The selection
  outline and handles come from the union of child world bounds.
- **Moving a group rewrites its children's `x`/`y`.** There is no group
  transform to hold the delta.
- **Rotating a group rotates each child about the group's derived centre**,
  which adjusts both each child's `rotation` *and* its `x`/`y`. Rotating each
  child about its own centre is a different operation and is wrong here — a
  latent bug already noted in `applyGesture`'s unreachable multi-node rotate
  branch.
- **Resizing a group scales its children** — already implemented by
  `resize-children.ts`, which becomes the only way a group's size changes.
- **Visibility and lock are inherited, not painted.** A hidden group hides its
  subtree; it does not set opacity on anything.

**Migration:** existing themes have groups with a `transform` and children in
group-relative space. The upgrade folds each group's matrix into its children
and drops the group's transform. This is lossless for translation, rotation and
scale, because the child transforms can express the composed result — see
**Open question O1** for whether we migrate or refuse.

### D3 — Colour is theme-level only, in rgba

`palette` entries hold **rgba** values. An element references a palette entry;
it may not carry a literal colour.

| | |
|---|---|
| Theme level | `palette.<name>` → rgba |
| Element level | a *reference* to a palette entry, and nothing else |

rgba rather than hex because alpha becomes first-class rather than an 8-digit
hex convention that half the tooling mishandles — the editor's own swatch
already renders `#0cf` as black because three places parse hex differently.

**Element opacity stays element-level.** It is a property of *this instance*
("fade this panel"), not a shared design token, so it is a plain number on the
node and is not a palette reference.

### D4 — Typography is a whole preset, chosen by name

The theme declares named **type presets**, each bundling every typographic
property together:

```text
typePresets.title    → family, size, weight, letterSpacing, lineHeight
typePresets.readout  → …
typePresets.caption  → …
```

A text element chooses **one preset** and carries no typographic properties of
its own. The `fonts` and `fontSizes` globals groups are replaced by
`typePresets`.

Why a bundle rather than five independent globals: the five are only ever
meaningful together — a size without its line height is a half-specified style —
and bundling collapses five inspector rows to one dropdown. It also makes the
multi-run text case tractable, which is the reason it came up: a run picks a
preset, so per-run styling stays expressible without giving a run five
independent style fields.

### D5 — Each chart family exposes its own settings

The inspector shows the settings for the selected chart's family, generated from
a declaration in `renderer-core` beside the settings types — so the inspector,
the validator and the schema stop being three encodings of one thing.

## The capability matrix

**This table is the definition.** An inspector row exists if and only if this
table says it does.

| Property group | group | rectangle | ellipse | text | image | chart |
|---|---|---|---|---|---|---|
| Identity (`id` read-only, `name`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `visible`, `locked` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Order among siblings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Transform (x, y, w, h, rotation — integers) | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `opacity` (element-level number) | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Fill → palette ref | — | ✓ | ✓ | — | — | — |
| Stroke (colour → palette ref, width, dash) | — | ✓ | ✓ | — | — | — |
| Shadow (colour → palette ref, blur, offset) | — | ✓ | ✓ | ✓ | — | — |
| Corner radius | — | ✓ | — | — | — | — |
| Type preset ref | — | — | — | ✓ | — | — |
| Text colour → palette ref | — | — | — | ✓ | — | — |
| Text content / runs | — | — | — | ✓ | — | — |
| Image source, fit | — | — | — | — | ✓ | — |
| Bindings (semantic keys) | — | — | — | ✓ | — | ✓ |
| Chart family settings | — | — | — | — | — | ✓ (per family) |

Notes on the empty cells, since an absence is a decision:

- A **group** has no geometry or paint at all — D2.
- **Text** has no fill; it has a text colour. The renderer currently maps `fill`
  to `color` in text mode and then overwrites it, so the inspector offered two
  rows for one property and editing one appeared to do nothing.
- **Image** has no fill or stroke: tinting a bitmap is not something this format
  does, and §170 forbids auto-inverting bitmap colours.
- **Chart** paint comes from its family settings, not from element style —
  otherwise a chart has two colour systems. (This is where the open G2-D1 chart
  gradient work lands.)

## Ownership

One home each, per AGENTS.md §2:

| Concept | Owner |
|---|---|
| Which node types exist | `renderer-core/src/theme/document.ts` `NODE_TYPES` |
| **Which properties each type may carry** | a new `theme/capabilities.ts`, keyed by `NodeType` so the compiler forces a row per type |
| Style property vocabulary | same file — closes the five-homes gap |
| Per-family chart settings fields | beside the settings types in `renderer-core/src/charts/` |
| Palette and type presets | `Globals`, in `document.ts` |
| Inspector rows | generated from the capability table; `STYLE_FIELDS` and `TEXT_ONLY` are deleted |

Consumers to repoint in the same commit: `inspector-model.ts`,
`inspector-apply.ts`, `validate.ts` (so an unknown property name is finally an
issue), `schema-sync.test.ts`, and later the add-element UI's defaults.

## Conflicts with the design document — needs a human

**The design document is user-authored and must not be rewritten** (AGENTS.md
§9). Two of its statements now disagree with D3/D4:

- **§73:** *"Each compatible property chooses either a global reference or its
  own literal value; local values remain unchanged when globals change. Show
  that choice explicitly in inspectors, with 'use global' and 'make local'
  actions."* D3 and D4 remove that choice for colour and typography. The
  `⇲ make local` / `⇱ use global` affordance — which spec 0007 implemented and
  a browser test covers end to end — goes away for those properties.
- **§170 (dark/light variants):** *"Explicit element literals remain literal
  unless the author adds a mode override."* With no element literals for colour,
  this sentence has nothing to describe, and dual-mode theming becomes
  *entirely* a matter of overriding globals — which is arguably simpler, but it
  is a change to a designed feature.

§164 says the design document wins until a human says otherwise. The user has
said otherwise in conversation; this spec records it, and the design document
should be amended by its author so the two stop disagreeing.

## Open questions

| | Question | Why it cannot be settled here |
|---|---|---|
| **O1** | Migrate v1 themes, or bump `schemaVersion` to 2 and refuse them? | AGENTS.md §9 says themes already saved must keep loading, and §141 says bump and fail unsupported versions — those pull in opposite directions. Migration is ~25 colour/font literals and 6 group transforms across the fixtures, so either is cheap *here*; the question is whether any theme has been saved outside the repo |
| **O2** | Does a value run inside a text element pick its own type preset, or inherit the element's? | Decides whether multi-run text keeps per-run styling at all |

## Acceptance

Not started. Criteria, so "done" is observable rather than asserted:

- Selecting a group shows **only** identity, visible, locked and order — no
  transform, no style. Verified in a browser, not by reading the model.
- A rectangle offers no type preset row; a text element offers no fill row.
- An unknown style property name produces a validation **issue** rather than
  being silently dropped — the gap that makes `"strokewidth"` invisible today.
- Every chart family's settings are editable, and editing one repaints.
- A palette entry is rgba, and an element cannot hold a literal colour: the
  inspector offers a reference and no literal input.
- A text element's typography is one dropdown.
- Moving a group moves its children and leaves no group transform behind;
  rotating one rotates about the derived centre.

**Not verified — nothing in this spec is implemented** beyond D1. Every row of
the capability matrix is a claim about intended behaviour, not observed
behaviour, until the acceptance criteria above are ticked with evidence.
