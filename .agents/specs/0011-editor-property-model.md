# 0011 — The editor property model

- **Status:** accepted — the three open decisions were resolved by the user on
  2026-09-13; see [Resolutions](#resolutions). Implementation has started
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

Per AGENTS.md's one-owner rule, the vocabulary gets one owner and every consumer imports it.

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

### D0 — Everything customisable is in the inspector

**A global rule, and the one that settles every later argument about a row.** If
an author can change it, the inspector shows it. There is no such thing as a
property that is editable but only reachable by editing the file.

Its converse matters as much: a row that cannot do anything must not be drawn.
The two together are what the capability matrix encodes — it is a statement of
what *is* customisable per entity, not a UI preference.

### D1 — Geometry is whole units *(decided, implemented)*

Position, size and rotation are integers. `updateTransforms` rounds, because
every transform write funnels through it. `scaleX`/`scaleY` are multipliers, not
units, and are not rounded. Landed as `3b545c5`.

### D2 — A group is an editor entity, not a theme element

A group exists to move things together and to organise the layer list. It is
**not** a drawable.

| A group has | A group does not have |
|---|---|
| `children` | A **stored** transform |
| `locked` | `style` — no fill, stroke, shadow, opacity, typography |
| `visible` | `bindings` |
| Order among its siblings | An identifier separate from its id (D8) |

**No transform rows.** A group's transform *is* its children's values, so there
is no property of its own to show — and showing one invites an author to believe
the group holds geometry.

This does not violate D0. Moving and rotating a group is an author operation and
remains one; it is a **canvas gesture** that translates directly into child
values. D0 is satisfied by the operation existing, not by an inspector row
restating it. A derived-and-editable row was tried and rejected as a leaky
abstraction: the numbers are not the group's own, rotation cannot be implemented
honestly at the group level (see below), and size had to be excluded by hand.

So a group has no coordinate space of its own. It is a selection and a
layer-list entry.

Two consequences:

- **A group offers no resize handles on the canvas either.** Resizing a group is
  not an operation, so the canvas must not offer what the inspector denies —
  D0's converse. This makes `resize-children.ts` dead code.
- The `position`/`size`/`rotation` capability split survives and earns its keep
  regardless: the artboard (D6) needs exactly that granularity.

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

### D3 — Colour is theme-level only, in rgba — **solids and gradients alike**

`palette` entries hold **rgba** values. An element references a palette entry;
it may not carry a literal colour. **This covers gradients** (user,
2026-09-13): a gradient is a named theme-level token exactly as a solid is, and
an element references it. See D9 for the gradient's own shape.

The reason given is worth recording because it decides future work too: a
dark/light switch then swaps **tokens**, not elements. Any element literal — solid
or gradient — would be a value the switch cannot reach.

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

**The vocabulary is author-defined, not fixed** (user, 2026-09-13). A theme
ships with whatever presets its author wrote; nothing in the format reserves
`title` or `caption`. The same holds for the palette.

**Anticipated, not built:** importing a palette pack or a preset pack as a unit,
the way a theme or a widget is imported. Named here because it constrains the
shape — a pack is a set of named tokens, so presets and palette entries must
stay addressable by name and free of document-specific references. It does
**not** justify building an import path now.

### D5 — Each chart family exposes its own settings *(implemented)*

The inspector shows the settings for the selected chart's family, generated from
a declaration in `renderer-core` beside the settings types — so the inspector,
the validator and the schema stop being three encodings of one thing.

Same-family multi-selections show shared and mixed values. Mixed families show
no incompatible settings section. Landed as part of the chart-settings task on
2026-09-13.

### D6 — The artboard is an entity in the inspector

The canvas itself is selectable and inspectable, with the rows it can honestly
offer:

| Artboard row | Editable |
|---|---|
| `width`, `height` | ✓ — **resizes the theme canvas after it was created**, which is the point of this decision |
| `background` → palette ref | ✓ |
| `barColor` → palette ref | ✓ |
| `fitMode` | ✓ |
| `x`, `y` | **absent.** There is nothing to move the canvas *relative to* — the artboard defines the coordinate space, so an origin offset is either a no-op or a rename of "shift every node", which is a different operation |
| `rotation` | shown, **locked** — nothing to rotate relative to, same reason |
| `visible`, `locked` | shown, **locked** — a hidden canvas is not a state worth having |

Resizing the canvas does **not** rescale its contents. Nodes keep their
coordinates, so growing the artboard adds room and shrinking it can crop —
which is what `fitMode` then governs on a display.

Shown-but-locked rather than hidden, per D0: the author can see the property
exists and that it is not theirs to change, which is different from wondering
where it went.

### D7 — A reserved, undeletable "none" colour

With element literals gone (D3), "no fill" can no longer be expressed by
clearing a property — every colour is a reference, so there must be a reference
that means *nothing*.

`palette.none` is reserved: fully transparent rgba, present in every theme,
**not deletable and not renameable**. Clearing a fill assigns it.

Two consequences worth stating:

- It is the one palette entry `deleteGlobal` must refuse even when unreferenced,
  which is a different rule from D3's "refuse while referenced" and needs its
  own guard.
- **It is the fallback when a referenced token is removed** (user, 2026-09-13).
  Removal forces reassignment; if the author reassigns nothing, every reference
  becomes `palette.none`. So deletion is permitted rather than refused, and the
  result is still a *reference* — never an element literal, which is what D3
  forbids.

  **Implementation lags this.** `deleteGlobal` currently refuses outright
  (`1b55107`), because `palette.none` does not exist until schema v2. The
  refusal is the honest interim — it cannot silently produce a dangling
  reference — but it is not the decided behaviour.
- A theme that somehow lacks it gets it on load, because a document referencing
  `palette.none` must resolve, and a missing reserved token would render as an
  unresolved-global issue for something the author never touched.

### D8 — One identifier per node, no separate display name

`name` is removed. A node has an `id`, constrained to letters, numbers and
dashes, unique within the document, and it is what the layer list and the
inspector show.

The reasoning that previously justified two fields does not apply to nodes.
**Nothing inside the document references a node id** — verified against the
schema and the document types: text runs reference a *binding* id (node-local),
`WidgetProvenance` references a widget id, `editorMetadata` is opaque, and
groups contain children by nesting. §75's "stable IDs plus editable names" sits
in the theme-globals section, where a reference really is made from five places;
nodes inherited the duality by analogy, not by need.

And two fields can disagree. `id: "cpu-gauge"` with `name: "GPU temp"` is a
document that lies about itself and nothing catches it — a misleading name is
worse than a terse one (user, 2026-09-13).

Renaming therefore rewrites the id. Where a reference to a node id is ever
introduced, renaming rewrites it atomically — exactly what `rekeyGlobal`
already does for globals, so the pattern exists rather than needing invention.

### D9 — The gradient model

A gradient is a theme-level token (D3) with:

| | |
|---|---|
| `stops` | An **author-editable list** — stops can be added and removed |
| `stops[].color` | rgba |
| `stops[].position` | Where the stop sits along the gradient bar, 0–1 |
| `rotation` | The gradient's angle |

**`rotation` is a property of the gradient, not of a stop.** The instruction
read "each stop has rgba color, position and rotation value"; a per-stop angle
has no geometric meaning — a linear gradient has exactly one direction — so it
is placed on the gradient. Flagged rather than silently reinterpreted, in case a
per-stop angle was meant for something this does not yet cover.

#### Where a gradient is painted

**Over the element's rectangular bounding box, not its visible filled area**
(user, 2026-09-13). So an ellipse, a rounded rectangle or a text glyph run is
filled from a gradient spanning its full box, and the shape clips it.

This matters because the alternative is what most engines do by default for some
primitives, and it makes two identically-styled elements of different shapes
show visibly different gradients — the ellipse compressing the ramp into its
inscribed area. Boundary-box geometry keeps a token looking the same wherever it
is used, which is the entire reason colour is a token.

The existing `Fill` union already carries `kind: 'gradient'` with `stops`, so
this is a change of *ownership and geometry*, not a new concept: `GradientStop`
gains rgba and a documented position, the angle moves onto the gradient, and the
whole thing moves from element style into the palette.

`thresholds` — the third `Fill` kind — is **not** a gradient and stays distinct:
discrete bands selected by value, which is a data mapping rather than a paint.

### D10 — Grouping makes its children contiguous, and that moves paint order

Grouping collects the selection into adjacent positions in the order tree, and
since **child order alone determines stacking** (§137) that changes paint order
for anything that was interleaved between them.

**This ratifies behaviour that already exists** rather than commissioning work:
`arrange.ts` keeps the members' relative paint order and inserts the group where
the **topmost** member was (`arrange.ts:87`, `:126`). Recorded because the
consequence is easy to be surprised by and nothing else states it — grouping two
panels with an unselected label between them lifts or drops that label relative
to both, and no amount of care in the grouping code avoids it. It is inherent to
a single ordered child list.

Inserting at the topmost member's index is the choice that disturbs least: the
group ends up where the frontmost thing an author selected already was.

## The capability matrix

**This table is the definition.** An inspector row exists if and only if this
table says it does.

Legend: **✓** stored on the entity · **~** shown and editable but *derived*
(editing it rewrites something else) · **L** shown but locked · **—** absent.

| Property group | artboard | group | rectangle | ellipse | line | text | image | video | chart |
|---|---|---|---|---|---|---|---|---|---|
| Identity (`id`, editable, unique — D8) | L | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `visible`, `locked` | L | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Order among siblings | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Transform (x, y, w, h — integers) | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rotation | L | ~ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Background, bar colour → palette ref | ✓ | — | — | — | — | — | — | — | — |
| `fitMode` | ✓ | — | — | — | — | — | — | — | — |
| `opacity` (element-level number) | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Fill → palette ref | — | — | ✓ | ✓ | — | — | — | — | — |
| Stroke (colour → palette ref, width, dash) | — | — | ✓ | ✓ | ✓ | — | — | — | — |
| Shadow (colour → palette ref, blur, offset) | — | — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Corner radius | — | — | ✓ | — | — | — | — | — | — |
| Type preset ref (element + per run — R3) | — | — | — | — | — | ✓ | — | — | — |
| Text colour → palette ref (element + per run) | — | — | — | — | — | ✓ | — | — | — |
| Text content / runs | — | — | — | — | — | ✓ | — | — | — |
| Media source, fit / playback | — | — | — | — | — | — | ✓ | ✓ | — |
| Bindings (semantic keys) | — | — | — | — | — | ✓ | — | — | ✓ |
| Chart family settings | — | — | — | — | — | — | — | — | ✓ (per family) |

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

One home each, per AGENTS.md's one-owner rule:

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

**Resolved.** The plan is agent-owned as of revision 10, and §73, §75, §126 and
§170 now state the positions below directly — so the contradiction that this
section recorded no longer exists.

§164 says the design document wins until a human says otherwise. The user has
said otherwise, and chose the resolution below.

## Resolutions

Decided by the user on 2026-09-13.

### R1 — The design document is amended by its author, from a draft

Spec 0011 governs implementation. The conflicting wording is **not** edited by
an agent: proposed replacements for §73 and §170 live in
[`.agents/status.md`](../status.md)
for the author to paste or discard. Until they are pasted, the design document
and this spec disagree **knowingly**, and this section is the record of why.

### R2 — `schemaVersion` becomes 2, and v1 is refused

Per §141: bump and fail cleanly rather than carry a migration path forever. A v1
theme meets a message naming both versions. The five in-repo fixtures are
rewritten by hand — 6 group transforms, 25 colour/font literals.

This is chosen on the basis that **no theme has been saved outside this
repository**. If one has, it is lost, and that is the cost of the simpler
option.

### R3 — A text run may override its type preset *and* its colour

Both as references, both inheriting from the element when absent. This keeps the
demo's three-colour `"GPU core {gpu.temp} (outage simulated…)"` label
expressible, and it is what makes multi-run text tractable under D4: a run picks
a *preset*, not five independent typographic fields.

## Known defect this spec does not fix

**A hidden element cannot be reselected, so it is effectively lost** (user,
2026-09-13). `hitTest` skips hidden nodes — correct, since an invisible thing
should not intercept clicks — but with no other route to a node, hiding one and
clicking away removes it from the author's reach entirely. Only undo recovers
it, and only if it is still in the history.

A **layer panel** is the fix, not a change to hit-testing: the tree is the
non-visual route to a node, which is what a hidden element needs. Recorded here
because it makes the layer panel a correctness feature rather than a
convenience, and because the visibility toggle is the thing that creates the
trap.

It also makes the "suspected only" finding from the gesture audit reachable:
`ungroupNodes` drops a hidden group's `visible: false` and would reveal its
children. Unreachable today precisely *because* a hidden group cannot be
selected — a layer panel removes that accidental protection.

## Open questions

None outstanding for this spec. R1–R3 closed the three that were.

## Acceptance

Partially implemented. Criteria, so "done" is observable rather than asserted:

- Selecting a group shows **only** identity, visible, locked and order — no
  transform, no style. Verified in a browser, not by reading the model.
- A rectangle offers no type preset row; a text element offers no fill row.
- An unknown style property name produces a validation **issue** rather than
  being silently dropped. Implemented: `validate.test.ts` covers node styles
  and both text run variants; `schema-sync.test.ts` binds schema names to the
  canonical vocabulary. Unit tests pass; current results are in status.md.
- Every chart family's settings are editable, and editing one repaints.
- A palette entry is rgba, and an element cannot hold a literal colour: the
  inspector offers a reference and no literal input.
- A text element's typography is one dropdown.
- Moving a group moves its children and leaves no group transform behind;
  rotating one rotates about the derived centre.

**Partial implementation:** D1, the D2 inspector restrictions, D5 and unknown
style-name rejection are implemented; see status.md for verification limits.
Every row of
the capability matrix is a claim about intended behaviour, not observed
behaviour, until the acceptance criteria above are ticked with evidence.
