# The colour picker and the gradient editor, rebuilt

- **Status:** draft, awaiting the owner's review. **No code is written from this
  spec yet**, and it queues behind the active plan — `STATUS.md` names
  `2026-10-12-the-backlog-drain.md` as the only execution plan.
- **Specifies work against:** [`DESIGN.md`](../../DESIGN.md) — §3 (the scales),
  §4 (colour roles), §5 (the closed control vocabulary). This spec amends §5;
  it changes no `§N` marker and adds no step to §3.
- **Register:** `vg-405` is the verdict this spec serves. It links, and does not
  re-file, `vg-336`, `vg-334`, `vg-333`, `vg-246`, `vg-263`, `vg-204`, `vg-286`
  and `vg-194`.
- **Research provenance:** two untracked documents under
  `.superpowers/sdd/2026-10-12-the-backlog-drain/` — `colour-and-gradient-research.md`
  (the consensus survey and the defect measurements) and
  `colour-picker-library-research.md` (the candidate’s licence, dependencies and
  channels). The evidence a reader needs is restated here with its sources; the
  workspace does not outlive the plan.

## The position

**Both surfaces are barely usable, and the reason is the same in each: they are
the only two controls in the editor that were built before the design language
existed, and they were built as one-offs.** The measurement is not a matter of
taste — `colour-picker.tsx` writes a value on every pointer event with no settled
boundary, so a drag writes N times and is undoable zero times; the gradient
editor draws a track, a preview and per-stop fields in three different control
styles; and neither component imports anything from the control set
(`ControlWell`, `ControlRow`, `ControlText`, `ControlNumber`, `ControlSwatch`),
so the Tokens pane ends up with **three text inputs for one colour** — the pane’s
own field, the picker’s hex field and the gradient’s per-stop field — with three
different commit behaviours.

Against what the rest of the industry ships, both are missing the same thing:
the shape. A colour picker is, in one popup under the value being edited, a 2-D
saturation × brightness area, a hue strip, an alpha strip, a text field for the
exact value, a set of preset swatches and an eyedropper — each a named,
keyboard-operable channel — reporting **two** callbacks, a live one during the
gesture and a settled one when it ends. That shape is universal: Figma, Chrome
DevTools, Blender, Photoshop, Ark UI, React Aria, react-colorful and `@uiw` all
ship it, and the tools that care about expensive writes all split live from
settled. This repo has four 1-D tracks and one callback.

A gradient editor is, in one row, a track that is both the preview and the stop
manipulator, a stop per stop movable by drag *and* by a numeric position, an
explicit add and remove, and beside the track an opacity channel, a midpoint
between adjacent stops, an angle and a set of presets. Figma, Photoshop,
Illustrator’s Gradient Forge, Blender’s Color Ramp and CSS itself all agree on
that much; the disagreements are the forks listed at the end.

## The decisions

Four are the owner’s rulings of 2026-10-12 and are not open again here. Three
more are this spec’s, argued from those rulings and from the survey.

### Ruled by the owner

1. **The channel set is the full consensus set** — a 2-D area, hue, alpha, a
   multi-format exact-value field, preset swatches and an eyedropper.
2. **Commit semantics: live preview, settled commit, and palette edits enter
   undo once per settled change.** A drag may write the scene freely; it makes
   one history entry, at the end.
3. **`DESIGN.md` §5 gains both new controls** — the 2-D colour area and the
   gradient track — as named members with their sizes, roles and behaviour. §5
   is a gate (“The vocabulary is closed. A control is one of these, or it is not
   a control”), so a surface that draws either without the amendment is a
   mistake by §5’s own Don’t list.
4. **The library question was put to the owner and answered by pointing at
   ReUI’s `@reui/color-picker` (Base UI flavour)**, which was then checked. It
   is MIT (Copyright © 2025 Keenthemes Inc), it ships **no colour dependency** —
   it does its own maths — and it already has the ruled channel set and the
   ruled live/settled pair (`onValueChange` per change, `onValueCommit` once per
   settled interaction). It is a copy-in shadcn registry block, not a package,
   and it ships **no tests at all**.

### This spec’s decisions

5. **The ReUI source is ported as vendored MIT source onto this repo’s Base UI
   wrappers; it is not installed through the shadcn CLI.** Reason: installing it
   would pull the primitive set `ADR-0038` removed. The registry item’s
   `registryDependencies` are bare shadcn names and this repo’s
   `components.json` style is `new-york`, so the CLI resolves them to
   `@radix-ui/react-slot`, `-popover`, `-dropdown-menu` and `-separator` and
   their transitives. The published file also imports
   `@/app/(create)/components/icon-placeholder`, a module that exists only
   inside ReUI’s own Next.js app, so it does not compile as shipped. **What is
   ported is the interaction contract and the maths — the ARIA, the keyboard
   model, the channel decomposition, `parseColor`/`formatColor` — and the
   surfaces are rewritten in §5’s vocabulary.** A 2,996-line file does not enter
   this repo whole; `AGENTS.md`’s 800-line stop applies, and no file in this work
   is exempt from it.
6. **Interpolation is not exposed.** Photoshop and Figma’s shader surfaces offer
   an interpolation space and CSS now defaults to Oklab, but **this repo’s
   renderer draws CSS gradient strings in sRGB through ECharts and Fabric**, so a
   control offering Oklab would promise something nothing honours — the failure
   §5’s Don’t list names. It is recorded as an upgrade path, not built.
7. **Stops keep free positions and duplicates are represented, not refused.**
   Figma, CSS and Illustrator all treat a position as a free value and a stacked
   stop as a deliberate hard edge. Refusing a non-ascending entry would silently
   destroy an author’s work, and the drag path and the numeric path must agree
   about it: two stops at one offset render as two distinguishable stops.

## The picker

**Shape.** One popover under the value being edited, opened from that value’s
own swatch, containing:

| Channel | Control | ARIA |
|---|---|---|
| Saturation × brightness | the **2-D colour area** (§5 amendment) | `role="slider"`, two channels announced, `aria-valuetext` naming both and the colour |
| Hue | a gradient-painted track | `role="slider"` with min/max/now |
| Alpha | the same track, over a checkerboard | `role="slider"`, value as a percentage |
| Exact value | **Well** (`ControlText`), with the format the value is stored in | labelled, `aria-invalid` when refused |
| Presets | **Choice row** in one labelled `radiogroup` | per §5 rule 7, “never colour alone” |
| Eyedropper | **Icon button** (`ControlIconButton`, glyph only) | `aria-label` from `uiCopy` |

**Keyboard follows the APG slider model** — arrows by one step, Page Up/Down and
Shift+arrow by ten, Home/End to the ends, Escape to close and return focus — and
the wheel-less surface keeps Blender’s rule that a modifier is part of the model
rather than a hidden trick. Naming: channels are named in words from `uiCopy`
(`Saturation`, `Hue`, `Alpha`, `Value`), which is `vg-336`’s ruling, and **test
ids stay separate from accessible names** — naming is not a test hook.

**Focus is a boundary, not a UA outline.** §5 rule 4 requires a solid boundary at
≥3:1 against adjacent colours in all six palettes. A UA outline drawn over an
arbitrary gradient cannot satisfy that by construction, so each channel paints
§4’s boundary role at its own focus, and the ratio is **measured in the browser
before the work is called done** — it is unmeasured today, and this spec does not
assert a number it has not taken.

## The gradient editor

**One row, one owner.** The track is the preview *and* the manipulator; the stops
are the document. The angle field, which today lives in the pane while the
component that draws the gradient lives beside it, moves into this component’s
own row (the alternative — a component with a gesture and no control for it —
is the shape the current file already suffers from).

| Part | Control |
|---|---|
| The track | the **gradient track** (§5 amendment), the value’s own gradient painted on it |
| A stop | a stop mark on the track; selected by click and by keyboard, movable by drag and by a numeric **Well with unit** (`ControlNumber`, `%`) |
| Adding a stop | a click on the track, or the add **Icon button** |
| Removing a stop | the remove **Icon button**, or Delete — never drag-away alone, because a pointer-only gesture is unreachable for a keyboard author |
| Midpoint between two stops | a draggable mark on the track between them, with its own numeric well |
| Angle | **Well with unit** (`ControlNumber`, `deg`) |
| Presets | **Choice row**, the same registry the picker’s swatches use |

**Alpha is inside the stop’s colour** — the repo already stores 8-digit hex
(`colour-maths.ts`), CSS and DevTools put alpha inside the value, and a separate
opacity-stop model (Photoshop’s) is a second stop list this product does not
need.

## One owner for the value

The three text inputs for one colour become **one commit path**: the pane’s
swatch is the picker’s trigger, the picker’s field edits the same stored value,
and both go through the same parse, the same refusal channel and the same
settled-write boundary. Concretely:

- **The colour parser gets one owner.** `parseHex` exists in
  `components/ui/colour-maths.ts` **and** in `renderer-core/src/charts/fill.ts`,
  and `docs/architecture/ownership.md` already lists “shared colour parsing”
  under Known ownership gaps (`vg-246`). The rebuild settles it rather than
  adding a third copy: `colour-maths.ts` is the owner, and `fill.ts` consumes it.
- **The gradient-CSS formula is written once.** It exists in
  `gradient-editor.tsx` and again in `paint-list.tsx` (including the `90 - angle`
  mapping). One function, one owner, two consumers.
- **A refused colour stays editable**, through the “invalid but still editable”
  channel the control set already gained (`vg-263`), with the message announced
  rather than only coloured.
- **Undo has one entry per settled change**, through the split the picker’s
  `onValueCommit` provides. Whether palette edits enter `EditorHistory` at all is
  answered by the owner’s ruling 2: they do, once per settled change, which means
  the history owner must be able to serialise a palette change — today it
  serialises the Fabric scene only.

## What this amends in `DESIGN.md`

Two members added to §5, and only two: the **2-D colour area** and the
**gradient track**, each with its size on §3’s steps, its §4 colour roles, its
focus boundary and its keyboard model. §5’s own row grid (a 74px label column and
one value cell) governs how both are reached from a pane row. The amendment keeps
§5’s marker under the `## Components` heading, because `scripts/design-md.mjs
--cite` fails when a marker sits under a heading the spec’s section mapping does
not name.

**Both files join the token gate.** `scripts/design-tokens.gated.json` does not
list `colour-picker.tsx` or `gradient-editor.tsx` today; the rebuilt files do,
together with their tests, per `vg-286`’s ruling that tests join the gated list.
Measured at the base: the checker currently reports 18 hex violations between the
two files and no off-scale `px` ones — the sizes are written as `h-28`-style
classes and inline `width: 28`, which the property rule does not catch.

## Before the first write

- **A decision note at `docs/decisions/0042-*.md`** — `scripts/reuse-gate.mjs`
  gates `components/ui/`, so the hook refuses until a note claims the path. The
  note carries the seven rungs; the two research documents are rungs 3–5’s
  evidence, including the rungs that found nothing.
- **Licence provenance**: the MIT notice into `THIRD-PARTY-NOTICES.md` and a
  `## Vendored source` row in `docs/engineering/dependencies.md`, alongside the
  existing `@anu3ev/fabric-image-editor` entry.
- **The owner confirms the port.** Vendoring ~3,000 lines of someone else’s
  interaction code is a change in kind — this repo owns it forever, there is no
  upstream to pull from and no upstream test suite to inherit — so it is put to
  the owner explicitly rather than assumed from a pointer at a link. The
  fallback is hand-rolling on Base UI with the ported source as the reference.

## What this does not cover

- **Colour-space switching.** Entry is hex, `rgb()` and `hsl()`, with HSV implied
  by the area — the universal set. A DevTools-style space switcher is not built,
  and the picker’s own parser, not `CSS.supports`, is the authority for what is
  accepted.
- **The rest of the Tokens pane.** Its own layout, its list and its binding
  readout are the redesign’s, not this spec’s.
- **The chart paint path.** `renderer-core` consumes whatever value the picker
  stores; it does not gain a picker.
- **Screen-reader proof.** The ported ARIA and key tables come from the source
  and its documentation, and the upstream project has no tests. The behaviour is
  **unverified here until this repo renders it and inspects it** — it is
  acceptance, not an assumption.

## Acceptance

1. A drag on the area changes the preview live and produces **exactly one**
   history entry, at the gesture’s end — proved by count, not by inspection.
2. Every channel is reachable and adjustable with the keyboard alone, and each
   one’s value is readable as text.
3. The picker’s swatch sits at the value it edits, and there is one field for one
   colour in the Tokens pane.
4. A gradient is authored with a drag and with numbers, and the two agree —
   including two stops at one position rendering as a distinguishable hard edge.
5. The focus boundary’s contrast is measured in the browser, in all six palettes.
6. A refused colour leaves the value editable and says why, in words, through the
   announced channel.
7. `design:check`, `gates:self-test` and the token gate over both files are green,
   and both files are inside the gated list.
8. The browser evidence is captured for the picker and the gradient editor per
   `docs/evidence/screenshots/README.md`.

## Open questions for the owner

Neither blocks the §5 amendment or the interaction contract; both change what is
built.

1. **Does the picker keep a swatch of its own beside the pane’s field**, or does
   the pane’s field become the only trigger (the VS Code and Figma shape)? The
   recommendation is the second, and it is what “one commit path” above assumes.
2. **Which presets ship in the two Choice rows** — the palette’s own tokens, a
   fixed design set, or both as two groups. This is product content and this spec
   leaves it to the owner rather than inventing swatches.
