# Groups in the starter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The starter theme's eight cards become eight Fabric groups, so the layer tree
shows eight rows instead of fifty-two, a card moves as one object, and a card can be
inserted as a unit.

**Architecture:** A document change first, a panel change second. `ThemeNode`'s `group`
with ordered children and §57's compose-transforms rule already exist; `instantiateWidget`
and `WidgetProvenance` already exist. Nothing in the format needs to change. What changes
is that the reference composition stops being a flat list of eighty-plus siblings that
merely share a naming prefix.

**Tech Stack:** TypeScript, Fabric 7.4.0, Vitest + jsdom, Playwright.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 1 of 9. Read §1 *Groups are the atom, and the starter should use them*, the
*Convenience is not a smaller surface* section, and *What this design must never become*.

## Global Constraints

- **No constraint on what a theme may be.** Groups are a general capability that predates
  this work; what changes is that the starter *uses* them. A theme of two hundred loose
  shapes keeps every one of those shapes individually selectable, movable and styleable.
- Fabric stays imperative behind the editor boundary. React never mirrors an object; the
  tree renders the bridge's serializable projection.
- §57: no automatic reflow; groups keep and compose transforms; group/ungroup preserves
  world appearance.
- §67: viewport, collapse and selection are transient and never enter authored history.
- Fabric JSON stays the document (§134). **No new schema field, no second scene tree.**
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Refuse invalid
  numeric input rather than coercing it to zero. Stage explicit paths; no `git add -A`.
  No licence headers. 500 lines is a signal and 800 a stop.
- **Every existing authoring capability is preserved.** This plan moves none and drops
  none; it changes what the starter *is*.

## Review Focus

The spec is a design document; these are the conditions it implies and no step below
exercises. Each is pinned by a test in the task named.

1. **A group's children survive every operation.** Grouping must not renumber, reorder, or
   drop a child — the bindings, ids and transforms each child carries are the whole reason
   it exists. Pinned in Task 1.
2. **Group transform composition is exact.** Moving a group moves its children by the same
   delta, and the children's *local* coordinates do not change. A card that moves must not
   silently rewrite its own parts. Pinned in Task 1.
3. **Undo restores groups.** Grouping is one history entry, and undo returns the scene to
   fifty-two flat siblings rather than to something half-grouped. Pinned in Task 2.
4. **A theme with no groups still works.** The starter is the only theme this plan builds;
   the panel and the selection code must handle a flat scene as today. Pinned in Task 3.
5. **The instance a card came from is a fact, not a naming convention.** `provenance`
   survives save and reopen. Pinned in Task 4.

---

## Phase 1 — The document

### Task 1: Cards become groups

**Files:**
- Modify: `src/web/packages/editor/src/new-fabric-theme-cards.ts` — every `*Card()`
  returns one group wrapping its parts
- Modify: `src/web/packages/editor/src/new-fabric-theme.ts` — the `scene.objects` spread
- Test: `src/web/packages/editor/src/new-fabric-theme.test.ts`

**Interfaces:**
- Consumes: `ObjectJson`, `ThemeNode`'s `group`, `sceneBoxesOf`'s group flattening.
- Produces: each card factory returns a single `ObjectJson` of `type: "group"` whose
  `children` are the parts it returns today, with **identical child ids, bindings and
  transforms**. Tasks 3–5 build on that.

**Constraints:** the child objects are **not** re-authored. Their ids (`cpu-card-value`,
`cpu-card-load`, …), their bindings, their `left`/`top` and their paint all stay exactly as
they are, so every binding in `new-fabric-theme.ts` keeps resolving and no e2e fixture's
`data-vigilia-*` selector changes meaning.

The decision that matters: **group-local or artboard coordinates.** §57 says groups compose
transforms, and Fabric's own group semantics put children in group-local space. Converting
to local coordinates is therefore *required* for a group to behave as one — a card whose
children keep artboard coordinates would double-apply the group transform on the first
move. Convert, and say so in the commit: this is the one place where "just wrap them" is
wrong.

The wordmark and strapline stay loose — they are not a card, and a design that made
everything a group would be the cage this project is avoiding.

**Verification:**
- Unit: each card factory returns exactly one group; its children's ids match the set the
  factory produced before, and no id is duplicated across the document.
- Unit: every binding id named in `new-fabric-theme.ts` is reachable from some node in the
  scene — the check that catches a child dropped while being wrapped.
- Unit: **group transform composition.** Set a group's `left`, then assert each child's
  *own* `left` is unchanged while its bounding rect moved by exactly the group's delta.
- Unit: the wordmark and strapline are not inside a group.
- **Delete** any assertion that pinned the old flat count.

**Commit:** `feat(editor): the starter's cards are groups`

### Task 2: Group and ungroup are one history entry each

**Files:**
- Test: `src/web/packages/editor/src/canvas-grouping.test.ts` (new)

**Interfaces:**
- Consumes: `groupingManager`'s existing `group()` / `ungroup()`.
- Produces: nothing new; this task proves what already exists under the new document shape.

**Constraints:** `editor-session.ts` already registers `edit.group` / `edit.ungroup`. This
task changes no production code unless a test fails — and if one does, the failure is the
finding.

**Verification:**
- Unit: select the eight parts of a card, group them, assert one object with eight
  children; one history entry, not eight.
- Unit: undo returns to eight separate objects at their original positions; redo returns
  to the group. **Round-trip twice** — the second round is where a group that quietly
  accumulates an offset shows up.
- Unit: ungroup preserves world appearance. Assert every child's bounding rect is
  unchanged across the round trip, to the tolerance §57 requires.
- Unit: a group containing a group is refused or handled explicitly — not silently
  flattened.

**Commit:** `test(editor): grouping round-trips a card without moving it`

## Phase 2 — The surfaces

### Task 3: The tree shows the hierarchy

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-tree.ts`
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Test: `src/web/packages/editor/src/editor-shell/layer-tree.test.ts`

**Interfaces:**
- Consumes: `sceneBoxesOf`'s group flattening, Task 1's grouped scene.
- Produces: `LayerRow` gains a real `depth` and `parentId` from the document rather than
  from a naming convention. Task 4 renders from it.

**Constraints:** the projection stays pure — Fabric in, rows out, no DOM, no React. Groups
start **collapsed**, which is a default and not persisted viewport state (§67). Collapse
state belongs to the shell.

**Verification:**
- Unit: the starter projects to eight top-level rows, and expanding reaches every node.
- Unit: **a flat scene still projects correctly.** A theme with no groups produces rows
  with `depth: 0` and no parent — Review Focus 4.
- Unit: effective visibility and lock descend the ancestor path, and a hidden group's
  children read as hidden.
- Unit: reverse paint order, and `parentId` correct at depth 2 and 3.
- Browser: the starter's panel shows eight rows on open.

**Commit:** `feat(editor): the tree follows the document's hierarchy`

### Task 4: Rows say what a thing is, and stay quiet when it is fine

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`

**Interfaces:**
- Consumes: Task 3's rows; the document's bindings.
- Produces: a row's kind treatment and its bound key. Task 5 renders the per-kind column
  from the same information.

**Constraints:** three subtractions, all of which remove ink.

- **Kind becomes a treatment, not a glyph.** A text row renders its own string in its own
  face at small size, so it reads *what it says and that it is text* in one glance. A chart
  row carries its family mark, a shape row a filled swatch, an image row its thumbnail. A
  12px glyph cannot survive 280px and this can.
- **Lock and visibility appear only when they are true** — hover, selection, or
  non-default. 104 icons reading "visible, unlocked" was noise, and the noise grows with
  the row count, which is the case a card-heavy panel would hide.
- **A row shows what it is bound to.** `gauge · cpu.load`, `ring · mem.used` — read from
  the document, not typed in.

Row rhythm 24px, `tabular-nums` on anything numeric. Density per §173: more, not less.

**Verification:**
- Unit: lock and eye are absent on a default row and present on hover, on selection, and on
  a row whose lock or visibility differs from default.
- Unit: the bound key shown matches the document's binding for that node.
- Unit: **a text row renders its own face.** Assert the row's computed `font-family`
  differs from the panel's — jsdom can check the declared value, and a browser case
  confirms it paints.
- Delete rather than leave passing vacuously: any assertion that a default row carries two
  icons.
- Browser: eight rows, each identifiable at a glance without reading its name.

**Commit:** `feat(editor): a row says what it is, and is quiet when nothing is wrong`

### Task 5: A card can be inserted as a unit

**Files:**
- Create: `src/web/packages/editor/src/card-library.ts`
- Modify: `src/web/packages/editor/src/new-object-panel.ts`
- Test: `src/web/packages/editor/src/card-library.test.ts` (new)

**Interfaces:**
- Consumes: `instantiateWidget`, `WidgetProvenance`, Task 1's card factories.
- Produces: `insertCard(editor, cardId)` — a copy with fresh ids, remapped bindings that
  preserve semantic keys, and recorded provenance.

**Constraints:** **units and primitives are both first-class in the `+`.** The chooser
offers the card library and text/shape/chart/image/video, with neither greyed and neither
described as a fallback. The unit is the fast path; the primitive is the tool for the case
nobody anticipated, which is the case this product is for. `insertGroups()` keeps owning
the list and the panel renders from it, so the two cannot drift.

`instantiateWidget`'s `unmapped-global`, `id-collision` and `invalid-id` issues are
**surfaced, not swallowed** — §77 makes explicit global mapping the author's decision.

**Verification:**
- Unit: inserting a card twice yields two objects with **different ids** and the **same
  semantic keys** — the property that makes it a copy rather than a twin.
- Unit: the inserted copy's `provenance` names the card it came from, and survives a
  serialise/revive round trip — Review Focus 5.
- Unit: a card referencing a global the document does not have reports
  `unmapped-global` rather than silently inlining or silently dropping.
- Unit: **both sections of the chooser are populated** and neither is disabled. This is the
  test that fails if the library quietly becomes the only way in.
- Browser: insert a card; it appears intact on the canvas, in the tree at the top level,
  and bound to the same sensor as its source.

**Commit:** `feat(editor): a card is insertable as a unit`

---

## Acceptance

Rendered observation in a real browser (§33).

- The starter's layer tree shows **eight rows**, expanding to every node. The change is a
  document change: the groups exist before any panel is touched.
- **A theme of two hundred loose shapes opens, selects, moves and styles every one of
  them**, and the tree is usable at that size. This is the item that fails if the group
  model turned into a rule.
- Moving a card moves its parts by exactly the same delta, and their local coordinates do
  not change.
- Group, undo, redo and ungroup round-trip twice with world appearance preserved to §57's
  tolerance.
- Every row is identifiable by kind at a glance; a text row renders its own face.
- Lock and eye are absent from rows in their default state.
- Two insertions of one card are two objects with distinct ids and the same semantic keys,
  and the copy records where it came from across a save and reopen.
- The `+` offers units **and** primitives, neither greyed.

## Out of scope here

Named so a later phase does not re-open them: editor-side clipping at the artboard and the
`bleeds` flag (plan 2, with the device lens — an author cannot compose deliberately
against a preview that lies); arc and wedge in `SHAPE_KINDS` (plan 2); the per-kind
property column with groups, hints and a completeness test (plan 3, and it owns
`vg-121`/`vg-122`); unit-library packaging on disk (§139 defers it until an authoring
workflow exists, and this plan is that workflow's beginning, not its format).