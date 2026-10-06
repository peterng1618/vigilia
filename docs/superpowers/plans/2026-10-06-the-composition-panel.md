# The composition panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The left column becomes a composition panel that is good at two hundred rows rather
than correct at eight — every row says what it *is* and what it reads, selecting a row and
entering a group are different acts, and the document's own panel moves to the column the
document belongs to.

**Architecture:** The projection in `editor-shell/layer-tree.ts` already answers "what is this
object" and stops one fact short: a row carries a mark and a bound key but nothing that names
its kind in the document's words. So the role is added **in the projection**, as data, the way
`LayerMark` already is — not in the renderer, so a test can read it without rendering. The
panel renders it and it joins the row's accessible name, which today omits the kind for every
arm but the text one. Entry is a bridge verb the canvas owner already
implements (`grouping-manager`), exposed to the panel for the first time. The Document pane is
a fourth `RailPane` plus two existing panel bodies, one of which is the Style tab's own
document mode; with both moved, the Style tab and the tab strip that holds it have nothing
left to switch between.

**Tech Stack:** TypeScript, Fabric 7.4.0, React 19 (shell only — the panel body stays
imperative DOM, the layer tree is React-owned), Base UI (loses its `Tabs` use), Vitest +
jsdom, Playwright.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 4 of 9. Read §3 *The composition panel shows whatever the theme is made of* to its end,
the §4 paragraph that gives `References` two modes, the §*Acceptance* items this plan closes,
and §*Sequencing* row 4. The one test every task is judged by is the spec's own: *does this
change remove a step, or does it remove a freedom?*

**Four of §3's landmarks have already landed and are not rebuilt here.** Measured on `f8197102`:
the row's **thumbnail** is `LayerMark` and `treatment()` (`layer-panel.tsx:90-153`) — a text row's
own words in its own face, a chart's family icon, a shape's paint, an image's own picture, and
nothing for a group; the **bound key** is the `.vigilia-layer-bound` column
(`layer-panel.tsx:635-642`) fed from the document's own envelope; **lock and eye appear only when
they are true** (`layer-panel.tsx:395-397`); and **expansion is available and stays available**,
the twisty and the arrow keys being untouched by this plan. What is open is the row's **role**,
the **enter** verb, the **Document pane**, and the scale at which all of it has to survive. A
task that rebuilds a landed landmark has misread this plan.

## Global Constraints

Copied from the spec and from `AGENTS.md`; every task's requirements include them.

- **"A card is a fact about the starter theme, not a rule about themes."** Another theme may be
  one full-bleed photograph and a caption, or two hundred loose shapes. The panel is for all of
  them, and a task that only works at the starter's scale has missed the point.
- **"The device is a lens, not the document."** The artboard keeps whatever dimensions the
  author chooses (§57: no reflow, whole artboard units).
- **"Nothing here may make a thing *impossible*"** — not a card role, not a panel layout. The
  spec's test: *"does this remove a step, or does it remove a freedom? If the second, it is
  out."*
- **"Convenience is ordering and grouping. Removal is not."** Every authorable setting and
  every existing row command stays present.
- **One owner per concept** (`docs/architecture/ownership.md`). `layer-tree.ts` owns the
  semantic layer projection and gains no second renderer; `layer-panel.tsx` renders it and gains
  no second derivation; `ui-copy.ts` owns the words — a kind word written in two modules is a
  second owner and is what this plan deletes.
- **Fabric stays imperative behind the editor boundary; React never mirrors an object.** The
  layer tree reads the projection the bridge hands it and holds no FabricObject.
- **Persist authored state only (§67).** Which groups are open, which group is entered, which
  pane shows and which row is attended are transient. They never enter the document and never
  grow history.
- **`renderer-core` stays Fabric- and DOM-free.** `ChartFamily` and `CHART_FAMILIES` are
  consumed, never re-spelled.
- **Editor-shell theming stays separate from authored theme globals (§35).** The role
  vocabulary is product copy and lives in `ui-copy.ts`; it is not localised and not a theme
  string.
- **No new dependency.** Neither the role, nor entry, nor the pane is a library's job; the
  spec's own primitive-library ruling (§8) is deferred to plan 9 and is not pre-empted here.
- **`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on.** Refuse invalid
  numeric input rather than coercing it to zero.
- **500 lines is a signal, 800 a stop.** `editor-shell/layer-panel.tsx` is **707** and must not
  reach 800; `editor-shell/layer-tree.ts` is **393** (both measured with `wc -l`). This plan's
  structure lands in new exports the projection already has room for, and **`layer-panel.tsx` is
  not the place to grow**: where a row gains structure, it moves into `layer-tree.ts` as data.
- **No new files under `scripts/`.** The reuse gate's watchlist (`scripts/reuse-gate.mjs`)
  names the whole of `scripts/` at any depth; nothing in this plan may add one.
- **Verify `npm run typecheck` by exit code**, never by reading for the word "error". **Verify
  lint and format with `./node_modules/.bin/biome lint ..` / `format ..`**; `npm run lint` exits
  1 on this box for a PATH reason.
- **`npm run test:e2e` runs with `--workers=1`.** Another session shares this machine and its
  Playwright MCP browser — never use that browser; launch Chromium directly with
  `ignoreDefaultArgs: ["--hide-scrollbars"]`. **A single sample of a flaky spec is not a
  measurement:** re-run it against a previous sample of the same commit before reporting.
- **Playwright's JSON report goes through `PLAYWRIGHT_JSON_OUTPUT_NAME`.** `--outputFile` is
  vitest's flag, not Playwright's; plan 3 lost time to that confusion and it is not repeated.
- Stage explicit paths; never `git add -A`. No licence headers. Conventional Commits.
  `npm run status:check` from `src/web/` before any commit that touches `STATUS.md`.

## Review Focus

The spec implies these and no step below exercises them by name. Each is pinned by a test in
the task named.

1. **A role that guesses where the document says nothing.** An unrecognised chart family, a
   group with no `provenance`, a text object whose runs were authored before `vigiliaText`: a
   row that names a kind the document does not claim is the one thing a mark must never do, and
   `chartMark` already says so in its own comment. Pinned in Task 1.
2. **The kind announced twice, or not announced at all.** A treeitem's accessible name is the
   concatenation of its own columns, and three of `treatment()`'s five arms contribute nothing to
   it — a chart's icon is `aria-hidden`, a shape's swatch is `aria-hidden`, an image is
   `alt=""` and a group draws no element at all; the text arm contributes the object's own
   words, which say what it says and not that it is text. So today a screen reader hears a chart
   row and a shape row identically. A role put in the mark as well as beside the name says it
   twice, and a role put only in a `title` reaches no keyboard author. Pinned in Task 2.
3. **Entering a group the document no longer holds.** Undo, ungroup and delete all rebuild or
   remove the scene while the entered context names an object that is gone. The bridge's other
   id-taking verbs resolve through `findById` and no-op; a new one that throws is a new way to
   break the panel. Pinned in Task 4.
4. **The Document pane's host mounted in two places, or the new pane losing the author's
   place.** `Host` reparents on mount, so two slots holding one node leave one of them empty;
   and `shell-layout.tsx` keys its scroll memory by `RailPane`, so a fourth pane with no
   remembered offset is a pane that jumps to the top on every swap. Pinned in Task 7.
5. **Something still routing the author to a Style tab that is gone.** A spec, a helper, a
   comment or a `uiCopy` key left naming the tab is a surface promising a place that no longer
   exists — the same class as the Data tab's leftover string in plan 3. Pinned in Task 9.

---

## Phase 1 — A row says what it is

The mark says what a thing *looks like* and the bound column says what it *reads*. Neither says
what it *is*: `kind` reaches the DOM only as a `data-kind` attribute the stylesheet reads, a
chart's icon and a shape's swatch are `aria-hidden`, an image is `alt=""`, a group draws no mark
at all, and only the text arm contributes to the accessible name — its own words, which say what
it says and not that it is text. The spec's own row vocabulary — `gauge · cpu.load`,
`chart · line ×3`, `metric card`, `shape` — is the missing column, and Phase 1 adds it in the
projection so the panel renders a fact rather than deriving one.

### Task 1: The projection carries the row's role

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-tree.ts`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/editor-shell/layer-tree.test.ts`

**Interfaces:**
- Produces on `LayerRow` (today at `layer-tree.ts:44-63`) — a required
  `readonly role: LayerRole`, beside `mark` and `bound`.
- Produces: `LayerRole`, a discriminated union carrying **raw facts, not words**:
  `{ kind: "chart"; family: ChartFamily | undefined; series: number }`,
  `{ kind: "group"; unit: string | undefined }`, and the bare
  `{ kind: "text" } | { kind: "shape" } | { kind: "image" }`.
- Produces in `ui-copy.ts`: `uiCopy.panels.layerKinds`, the words `layer-tree.ts`'s private
  `kindLabels` holds today (`Text · Shape · Chart · Group · Image`), and
  `uiCopy.panels.layerRoles`, the role vocabulary — one function per arm that turns a
  `LayerRole` into the string a row shows.
- Removes: `layer-tree.ts`'s private `kindLabels`, replaced by `uiCopy.panels.layerKinds` so
  the kind words have one owner.

**Constraints:** the role reports **what the document says and never a neighbour**, which is the
rule `chartMark` already states for an unrecognised family (`layer-tree.ts:204-210`) — apply it
here. `family` is therefore `CHART_FAMILIES.find(...)` or `undefined`, never a default. A
group's `unit` is `object.get("provenance")`'s `widgetName` where the stamp is present and a
string, else `undefined` — **the starter's cards carry no provenance** (verified: nothing in
`new-fabric-theme-cards.ts` writes the key), so on the starter every card row's role is the bare
group arm. That is the correct answer, not a gap: the row reports the document it has. A
chart's `series` is the length of that object's own binding list — the same array `bound` is
projected from, so the count cannot disagree with the keys beside it. `role` is derived inside
`projectLayers`, beside `markOf`, and adds no second walk.

**Failure modes to design against:** a role arm derived from the *mark* rather than from the
object (a chart whose family this build does not know would then claim the fallback's family);
a `series` count read from `bindings[id]` without the `?? []` the bound column already uses, so
an unbound chart throws; a kind word left in both `layer-tree.ts` and `ui-copy.ts`, which is the
second-owner defect this task exists to delete rather than to add.

**Verification:**
- Unit: a chart with three bindings reports `series: 3` and the family the object carries; a
  chart whose `family` is `"mystery"` reports `family: undefined` — Review Focus 1.
- Unit: a group carrying `provenance: { widgetId, widgetName: "CPU" }` reports `unit: "CPU"`; a
  group with no `provenance`, and one whose `provenance` has no string `widgetName`, both report
  `unit: undefined`.
- Unit: every kind `kindOf` can return (`layer-tree.ts:113-120`) produces a role arm, driven
  from a list of kinds rather than from one example object, so a kind added to Fabric without a
  role is a failing case rather than an unfilled field.
- Unit: the existing projection cases pass unmodified — the role is additive and changes no
  existing field, including the anonymous fallback ids and the collapsed-group walk.
- Unit: `layer-tree.ts` contains no kind word — the assertion is that `uiCopy.panels.layerKinds`
  is the only place these five strings appear, read from the source rather than from a rendered
  row.

**Commit:** `feat(editor): a layer row carries what the document says it is`

### Task 2: The row shows its role, and a screen reader hears it

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Test: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`

**Interfaces:**
- Consumes: `LayerRow.role` and `uiCopy.panels.layerRoles` from Task 1.
- Produces: a `span.vigilia-layer-role` in the row, **after the name and before the bound
  column**, carrying the role string; `data-vigilia-layer-role` names the arm that drew so a
  browser case measures the treatment rather than inferring it from a class, the idiom
  `data-vigilia-layer-mark` already uses.
- Keeps: `.vigilia-layer-mark`, `.vigilia-layer-name`, `.vigilia-layer-bound` and
  `.vigilia-layer-state` and their order relative to each other.

**Constraints:** the role is **visible text, not a `title`** — a tooltip reaches no keyboard-only
author, and the spec's sentence is "each row carries whatever identifies it without expansion".
Its width follows the row's existing rule rather than inventing one: the mark is
`flex: 0 0 40px`, the swatch and the thumbnail are `flex: 0 0 auto`, the name keeps
`flex: 1 1 auto; min-width: 6ch` (`editor-shell.css:1009-1060`), and the name is therefore the
only element in the row that gives up width. A role that shrank would be a role that says
nothing; a role that pushed the bound column out would cost the one column the row already
earns. The row is 24px (`editor-shell.css:857`, `ROW_HEIGHT` at `layer-panel.tsx:202`) and the
role adds no height. A chart's string is the family alone where it draws one series and
`family ×n` where it draws more — a gauge that draws one reading does not need a `×1` beside it,
and `chart · line ×3` is what the spec asks a many-series chart to say.

**And the accessible name.** A chart's icon, a shape's swatch and an image's `alt=""` contribute
nothing to a row's name, and a group draws no mark at all, so the role is the row's **only**
statement of its kind to assistive technology. It must be rendered once, in one element that
contributes to the name — never repeated in the mark, never hidden, never in an `aria-label` on a
row whose name is already assembled from its columns. Review Focus 2 is the assertion that the
name changed: a chart row's accessible name contains its family, which it did not before.

**Failure modes to design against:** the role rendered inside `.vigilia-layer-mark`, which
`flex-basis`es the slot and would truncate it; a role that pushes the bound column out on a
340px row; the role in both the visible span and a `title`, so a pointer hears it twice and a
screen reader hears it once by accident; a group's role arm rendering the empty string, which
would make a row's name silently begin with a gap.

**Verification:**
- Unit: each arm renders its own string, driven from a list of roles — including the group with
  `unit: undefined` and the chart with `series: 1`, which are the two arms a happy-path fixture
  would never reach.
- Unit: **a chart row's accessible name contains its family and a shape row's contains its kind
  word** — computed from the row's own content, not read from an attribute. This is Review
  Focus 2.
- Unit: the role is `flex: none`'s class and the name is the row's flexible element — asserted
  on the declaration the stylesheet sets, the way `layer-panel.dom.test.tsx:813-844` asserts the
  specimen's face; jsdom applies no stylesheet, so a computed style here would be theatre.
- Unit: the 200-row cases that exist today (`layer-panel.dom.test.tsx:1003`, `:1026`) pass
  unmodified except that every row now also carries a role, and the assertion that no default
  row draws a button (`:1023`) still holds — the role is not a control.
- Unit: a row whose role string is the empty string is not reachable — the union's arms are
  exhaustive and the vocabulary has no empty member.

**Commit:** `feat(editor): a row says what it is, and a screen reader hears it`

### Task 3: The row's width at 340px, measured with the role in it

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Create: `src/web/tests/e2e/composition-panel.spec.ts`

**Interfaces:**
- Consumes: the row Task 2 built.
- Produces: `tests/e2e/composition-panel.spec.ts` — the file Tasks 5, 8 and 10 add cases to.
  Its first case is this task's measurement; its opening comment says the file is the
  composition panel's browser contract and names which task owns which case.
- Produces: whatever the measurement decides, in the stylesheet's own comment —
  `editor-shell.css:459-474` records the pre-role numbers (at 340px, 2 of 60 names ellipsised;
  320px, 3; 280px, 15) and this task **replaces that record with the post-role numbers**, or
  keeps the width and says why.

**Constraints:** the number to beat is the comment's own record, and it is a record rather than
this task's measurement — **measure, do not restate it**. The rows to measure are the starter
with **every group open**, because that is what the comment measured and what a card-heavy
document actually is. The measurement is `.vigilia-layer-name`'s `scrollWidth > clientWidth`
per row, not a visual judgement, and it is taken with the panel's scrollbar in place. Taking the
width from the stage is the one thing to check twice: the canvas is `minmax(0, 1fr)` and every
pixel comes off the stage, which is the most valuable space in the app. If the role costs more
clipped names than the record's 2 of 60, either the width moves or the role's *visible* form
shortens — **not** the role's accessible form, which is Review Focus 2's and has no width.

**Failure modes to design against:** a measurement taken with groups shut, where the starter is
10 rows and the column is not under pressure; a browser case that asserts an exact pixel width,
which is a golden file for one font stack and not a contract; a decision taken from the
comment's numbers rather than a run, which is the error this task exists to avoid.

**Verification (browser, against the built bundle):**
- The count of rows whose name is clipped, at the width the stylesheet ships, **with a number
  in the commit message** — and the same count at the width the record named, so the change is
  a delta and not an assertion.
- Every row on the starter with every group open draws a role span and a mark, and the panel is
  still the same height per row.
- Screenshots are Task 10's, not this task's: `docs/evidence/screenshots/README.md` keeps its
  table aligned with the specs that carry captures, and a row registered with no backing action
  captures nothing.
- Gates: `npm run typecheck` exit 0, `./node_modules/.bin/biome lint ..` clean, the
  `layer-panel` jsdom suite, and this spec with `--workers=1`.

**Commit:** `fix(editor): the row's role is paid for out of the stage's width, measured`

---

## Phase 2 — Enter is its own act

Selection and entry are different questions — *what can I configure here* and *what is inside
this* — and the panel answers only the first. A group's parts are reachable today from the
canvas alone, by a double-click, which is why two browser specs drive a pointer at coordinates
to reach a chart that has a row on screen. Phase 2 gives the panel the verb the canvas owner has
had since plan 1.

### Task 4: The bridge gains enter and leave

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/bridge.ts`
- Test: `src/web/packages/editor/src/editor-shell/bridge.dom.test.ts`

**Interfaces:**
- Produces on `EditorShellBridge` (today at `bridge.ts:34-74`), beside `selectLayer`:
  `enterGroup(id: string): void` and `exitGroup(): void`.
- Consumes: `input.editor.groupingManager.enterGroup({ object })` and `.exitGroup()`
  (`grouping-manager/index.ts:235` and `:270`), and `groupContext()` which the bridge already
  forwards at `bridge.ts:164-167`.
- Keeps: `groupContext()`'s return shape — the panel's `data-context` dimming derives from it,
  and entry is what makes it non-empty.

**Constraints:** **resolve by id through `findById`, and no-op on an id the document does not
hold** — every other id-taking verb on the bridge does (`selectLayer`, `setLayerVisible`,
`setCollapsed`, `renameLayer`), and a throw here is a new way to break the panel from a stale
projection. `enterGroup` on an object that is not a group is a no-op, not a coercion: the
manager already refuses a non-`Group` entry (`grouping-manager/index.ts:248`) because that is
what the text-double-click path needed, and the panel must not decide it differently. The
manager records the entry **before** it sets the active object, because `selection:created`
fires synchronously and the bridge re-projects the tree on it — a bridge that recorded anything
itself would be the second owner of the entered group (§67 puts it in the manager).

**Failure modes to design against:** Review Focus 3 — an entry that survives an undo into a
scene `loadFromJSON` rebuilt, which `grouping-manager`'s own `onHistoryLoaded` already re-resolves
by id, so the bridge must pass an id and not an object; an `enterGroup` that enters the *owner*
of a nested id rather than the group that id names; a `notify()` missing after entry, so the
panel keeps rendering the old context — the manager fires `GROUP_CONTEXT_EVENT` **only when the
context changes**
(`grouping-manager/index.ts:66-71`), and `selectLayer` calls `notify()` unconditionally for
exactly this reason, so an id-taking verb that leaned on the event alone would be silent in the
case the projection already agreed with it.

**Verification:**
- Unit: entering a group makes `groupContext()` name it, and the projection's rows for its
  children are no longer marked `data-context="false"` — asserted through `layers()` rather than
  through the manager.
- Unit: entering an id the tree does not hold leaves the context unchanged and throws nothing —
  the id from a projection taken before a delete. Review Focus 3.
- Unit: entering a non-group id leaves the context unchanged.
- Unit: `exitGroup` on an empty context is a no-op.
- Unit: entering twice names the group once — a context holding one group twice would dim every
  row twice over and is what the manager's own `context[0] !== entry` guard prevents; assert
  the bridge does not defeat it.

**Commit:** `feat(editor): the panel can enter a group, not only select it`

### Task 5: The row carries the control

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`

**Interfaces:**
- Consumes: `bridge.enterGroup(id)` / `bridge.exitGroup()` from Task 4, and
  `bridge.groupContext()` which the panel already reads at `layer-panel.tsx:302`.
- Produces: one control in the state slot (`.vigilia-layer-state`), on a row whose
  `hasChildren` is true, whose label names the group and whose direction depends on whether that
  group is the one entered — *enter* for any other group, *leave* for the entered one.
- Keeps: the visibility rule the slot already implements (`layer-panel.tsx:395-397`) —
  `attended || row.selected || <non-default>`. The entered group **is** the non-default case for
  this control, so the row the author is inside always carries its way out.

**Constraints:** this is a **third control in a slot the panel deliberately keeps quiet**, so it
inherits the attention rule rather than escaping it: a default group row draws nothing.
Lock and visibility keep their own conditions untouched — a hidden-but-default row still draws
only its eye. Entering is **not** expansion: the twisty keeps `setCollapsed` and the arrow keys
keep their tree semantics (`moveFocus`, `layer-panel.tsx:230-287`), and **no existing key
binding changes** — Enter stays rename's, Space stays selection's, Escape stays the product
shortcut that leaves a group (`editor-session.ts:498-501`). The control is a plain button in the
row's own tab order, which is how a keyboard author already reaches Hide and Lock.

**The capability this buys, and the assertion that it is real:** `bridge.selectLayer` takes
`owner ?? target` by design, so with the group shut a row click selects the group. After
entering, the same click selects the part — and a chart inside a card, which today has a visible
row and cannot be selected through it, can be reached from the panel. That is the sentence two
e2e specs are built around and Task 6 rewrites.

**Failure modes to design against:** a control that appears on a group with no children (the
twisty's `hasChildren` gate is the one to reuse); a label that does not carry the group's name,
making three identical buttons in one tree the same way `boundSeparator`'s comment warns about;
an entry into a **nested** group whose row the tree is not showing, because `contextRows`
(`layer-panel.tsx:207-216`) propagates only *forward* through the rows it was handed, so a shut
ancestor leaves the author inside a group the panel shows no trace of — the panel's expansion
derives the ancestor path already (`bridge.ts:191-202`, `expansionFor`), and this task asserts it
does rather than re-deriving it; losing the canonical "the tree cannot select a chart" comment
without replacing it with the behaviour that made it true.

**Verification:**
- Unit: a default group row draws no enter control, and the two existing state-absence cases
  (`layer-panel.dom.test.tsx:916`, `:965`) still hold.
- Unit: hovering, focusing or selecting a group row shows the control; pressing it calls
  `enterGroup` with that row's id and nothing else — a count-only assertion would pass on a
  control that entered the wrong group.
- Unit: on the entered group the control calls `exitGroup` instead, and its label differs from
  the other rows' — asserted on the label text, since a reader hearing three identical buttons
  is the defect.
- Unit: a non-group row and a group row with no children draw no enter control.
- Unit: the twisty still calls `setCollapsed` and nothing calls `enterGroup` from a twisty
  press — selection, expansion and entry are three acts and this is where they are told apart.

**Commit:** `feat(editor): entering a group is its own act, on the row's own control`

### Task 6: The tree reaches a group's parts

**Files:**
- Modify: `src/web/tests/e2e/editor-canvas.ts` (a new `enterLayer(page, groupId)` beside
  `expandLayer`, `editor-canvas.ts:171`)
- Modify: `src/web/tests/e2e/inspector-sections.spec.ts`
  (`selectStarterGauge`, `inspector-sections.spec.ts:287-313`)
- Modify: `src/web/tests/e2e/reference-theme.spec.ts` (the sparkline case at `:590-600`)

**Interfaces:**
- Consumes: the control Task 5 renders, addressed the way `expandLayer` addresses the twisty —
  by a locator that is unique within the row rather than by a label prefix, since a group row
  now carries three or four buttons and `button[aria-label]` is a strict-mode violation.
- Produces: `enterLayer(page, groupId): Promise<void>` in `editor-canvas.ts`, whose doc comment
  states the contract `expandLayer`'s already does: what it does when the group is already
  entered, and what it waits for (`groupContext()` naming the id, read through the bridge).

**Constraints:** this task **replaces a workaround, and the workaround's own comments are the
inventory** — two specs document in prose that a layer row cannot select a chart and that the
selection therefore comes from a canvas double-click. Both sentences become false here and both
are corrected in the same commit, because a comment that explains why a workaround exists is the
next reader's instruction to keep using it. **No test is deleted to make this pass**: the
assertions those specs make about the chart's column and the binding select stay exactly as they
are, and only the route to the selection changes. The sweep is not limited to the two files
found here — `grep -n "dblclick" src/web/tests/e2e/*.ts` is the list, and each hit is judged
rather than assumed: a double-click for rename, for in-place text editing or for a snapping
fixture stays.

**What this task cannot claim:** that every double-click in the suite was an entry workaround.
Some are the gesture under test. Name, in the commit, which hits were left alone and why.

**Failure modes to design against:** a helper that clicks the twisty and calls itself an
entrance, which would pass the assertion and leave the effect the assertion wanted unmeasured; a
spec made green by asserting the entered context instead of the selected object, which is the
mechanism rather than the thing the author sees; an `enterLayer` that resolves on the DOM
attribute while the bridge still reports the old context, so the next action in the same spec
races the re-projection. Wait on the bridge's `groupContext()`, not on the button.

**Verification (browser, against the built bundle):**
- `inspector-sections.spec.ts`'s gauge case selects the gauge **through the tree**, and the
  poll on `getActiveObject()?.id` is unchanged — the object reached is the same one.
- `reference-theme.spec.ts`'s sparkline case selects the sparkline through the tree and its
  binding-select assertions are untouched.
- Entering and then clicking a card's own row selects the card, not the part — the tree's two
  behaviours sit one gesture apart and both are asserted.
- Gates: the affected specs with `--workers=1`, `npm run typecheck` exit 0.

**Commit:** `feat(editor): the tree reaches a group's parts, and the canvas workaround goes`

---

## Phase 3 — The left column's Document pane

The spec gives `References` two modes and puts the document's in the left column. The theme's
own panel is already a document panel — it says so in its host comment — and it is mounted in
the right column only because nothing had moved it. With both moved, the right column has one
panel left, and the tab strip that switches between two has nothing to switch.

### Task 7: A fourth pane, and the theme's own panel in it

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/pane-bar.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` (only if the fourth
  segment needs room; the bar already wraps)
- Test: `src/web/packages/editor/src/editor-shell/pane-bar.dom.test.tsx`,
  `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Produces: `RailPane = "layers" | "insert" | "assets" | "document"` (`pane-bar.tsx:8`), a
  fourth entry in `PANES` (`pane-bar.tsx:11-15`), and `uiCopy.rail.document` for its label.
- Produces: in the left column's `aside` (`shell-layout.tsx:540-550`), a
  `<Host node={hosts.document} hidden={pane !== "document"} />`, and **the removal of the
  `<Host node={hosts.document} />` from the Design tab panel** (`shell-layout.tsx:597`).
- Keeps: `ShellHosts.document` and `EditorPanelHosts.document` (`editor-session.ts:120-131`) —
  the host is the same node in the same object; only its slot moves.

**Constraints:** **the node moves; it is never mounted twice.** `Host` (`shell-layout.tsx:67-82`)
moves a persistent node into a React-owned slot once, so two slots holding one node leave one
of them empty and the panel disappears from whichever mounted second. That is Review Focus 4's
first half, and the assertion is that the host is in the DOM exactly once. The pane bar's
segments are labelled rather than icon-only and `openPane` (`tests/e2e/editor-pane-bar.ts:24`)
reads `aria-pressed` and `aria-expanded`, so a fourth segment needs no new helper — but its
*label* must not collide with an existing control's name, which is the strict-mode hazard that
helper's comment already records for "Insert". `panelHosts.document` and
`EditorPanelHosts.document`'s comment ("Document-level panels shown when nothing is selected")
become true rather than aspirational, and the comment stays.

**Failure modes to design against:** Review Focus 4's second half — `scrollOf` is keyed by
`RailPane` (`shell-layout.tsx:471`) and the restore is read off the DOM after a swap, so the new
pane must participate in the same map rather than being special-cased; a `choosePane` that
closes the panel when the Document segment is pressed while it already shows, which is the
existing toggle rule and must stay; the artboard panel losing its state on the move, since
`Host` only reparents when `node.parentElement !== parent`, and an unmount between the two slots
is what would drop it.

**Verification:**
- Unit: the bar renders four segments in order and each one asks for its own pane.
- Unit: `hosts.document`'s parent element is the Document pane's slot, and the document host
  appears exactly once in the shell — Review Focus 4.
- Unit: choosing Document shows the pane; choosing it again closes the panel, and choosing it
  while another pane shows swaps rather than closes — the existing `pane-bar.dom.test.tsx` and
  `editor-pane-bar.spec.ts` contracts, unchanged.
- Unit: with a selection, the Design column no longer contains the document host; without one,
  the right column contains no document panel at all.
- Browser: open Document, put the panel at an offset, swap to Assets and back — the offset
  survives, the same way `editor-pane-bar.spec.ts:68` pins it for the layer list.

**Commit:** `feat(editor): the document's own panel lives in the left column`

### Task 8: The document's references move there too, and the tab strip goes

**Files:**
- Modify: `src/web/packages/editor/src/selection-inspector/style.ts`
- Modify: `src/web/packages/editor/src/selection-inspector/style.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` (the `.editor-shell-tabs`
  rules and the panel it heads)
- Modify: `src/web/packages/editor/src/editor-session.ts` (the `#style` field and its
  construction, `editor-session.ts:387-392`, and the `style` member of `EditorPanelHosts`)
- Modify: `src/web/packages/editor/src/editor-main.ts` (`panelHosts.style`,
  `editor-main.ts:183-189`)
- Modify: `src/web/packages/editor/src/ui-copy.ts` (`inspector.design` / `inspector.style`)
- Modify: `src/web/packages/editor/src/card-insert-surfaces.dom.test.tsx` and
  `src/web/packages/editor/src/editor-session.dom.test.ts` — **thirteen** `style: document.body`
  entries, twelve in the first and one in the second (measured:
  `grep -rc "style: document.body" packages/editor/src/editor-session.dom.test.ts packages/editor/src/card-insert-surfaces.dom.test.tsx`)
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Produces: `style.ts`'s document mode as its own exported panel — the resolved list of the
  document's palette tokens and type presets, built from `globals` alone and asking the canvas
  nothing — mounted in the Document pane below the theme's panel.
- Removes: `createStylePanel` and the `style` host (`ShellHosts.style`,
  `EditorPanelHosts.style`), the `Tabs` import and both `Tabs.Panel`s from `shell-layout.tsx`,
  the exported `InspectorTab` type, and `uiCopy.inspector`.
- Keeps: the selection's own references, which are **already** the right column's Spends
  section — `per-kind-column.ts:551-614` renders the same resolution lines, and for a group or a
  multi-selection it renders more, not less.

**Constraints:** this is a **move and a deletion, not a rewrite** — `documentGlobals`
(`style.ts:46-79`) keeps its `data-vigilia-globals` marker and its `createResolutionLine` lines,
so the browser case that reads it today still reads it. The Style tab's *selection* mode is what
is deleted, and it is deleted because it is a second door to the right column's Spends:
`style.ts:101-119` and `per-kind-column.ts:551-614` call the same `paintReferencesOf` / `typePresetOf` /
`resolveToken` functions with the same arguments. **The right column loses its tab strip
entirely**, because one panel is not a choice — but the column itself stays and the Design
panel keeps `keepMounted`'s property, which was that the theme's settings never became
unreachable behind a tab: they are now in the left column, which no selection can hide. A
**locked** object and a **group** both still reach their references, and for the group the
answer is now the children's effective appearance rather than the empty panel `vg-146` filed.

**`vg-146` closes here, and the ruling is that the second surface goes rather than that it
learns to speak.** The row's own note says the document mode is plan 4's to relocate and that
the group case is "the unreachability the spec objects to" — and after the move there is one
surface answering that selection, which is the only fix that cannot drift again.

**Failure modes to design against:** a `uiCopy.inspector` key left behind, or a doc string
naming the Style tab; `editor-session.ts` destroying a panel it no longer builds; the
`panelHosts` fixtures compiling because TypeScript's excess-property check is defeated by an
`as never` cast, which is what half of them use — so the fixtures are edited **and** the
typecheck is read for exit 0, not for the absence of the word "error"; the right column becoming
an unstyled `div` where a `Tabs.Panel` was, since the panel carried layout the tab provided.

**Verification:**
- Unit: the document panel lists the tokens and presets by name and resolves them, with nothing
  selected **and** with a selection — the difference from today is the second half, and it is
  the whole of `vg-146`. Assert on a group selection, which is the case the row measured.
- Unit: a token edited after mount is reflected on the next render — the panel never held a
  copy of globals and must not start.
- Unit: there is no `role="tab"` anywhere in the shell, and `uiCopy` has no `inspector` key —
  asserted against the source, so a leftover string fails rather than merely being unrendered.
- Unit: with nothing selected the right column renders the nothing-selected line and no field —
  the spec's acceptance item, now whole, where plan 3 could only land half of it because the
  document panel was still mounted in the same tab under it.
- Unit: the shell mounts; `hosts.selection`'s parent is the right column and `hosts.document`'s
  is the Document pane.
- Browser: the artboard controls and the token list are both reachable with a card selected —
  the state in which the old Design tab showed the theme's panel *under* the selection column.

**Commit:** `feat(editor): the document's references move left, and the tab strip goes with them`

### Task 9: The specs and helpers that reach for a tab

**Files:**
- Modify: `src/web/tests/e2e/rebuild-driver.ts` — `openTab`'s definition at `:136` (whose body
  is the `getByRole` at `:137`) and its two internal callers at `:154` and `:404`
- Modify: `src/web/tests/e2e/rebuild-composition.ts` (eight call sites)
- Modify: `src/web/tests/e2e/author-journey-rebuild.spec.ts` (eight `"Design"` sites and one
  `"Style"` at `:95`)
- Modify: `src/web/tests/e2e/editor.spec.ts` — the local `openInspectorTab` definition at
  `:4602` (whose body is the `getByRole("tab")` at `:4603`), its **twelve** call sites, and the
  `editor-style-tab` capture at `:2137`
- Modify: `src/web/tests/e2e/reference-theme.spec.ts` (six sites)
- Modify: `src/web/tests/e2e/glass-authoring.spec.ts` (one site)
- Modify: `src/web/tests/e2e/inspector-sections.spec.ts` (one site)

**Interfaces:**
- Consumes: the shell Task 8 left — no tab strip, the selection column and the document pane in
  two different columns.
- Produces: `openTab` **removed** from `rebuild-driver.ts` rather than made into a no-op, and
  the local `openInspectorTab` in `editor.spec.ts` removed with it.
- Produces: a route to the document's references for the specs that need one — `openPane(page,
  "Document")` from `editor-pane-bar.ts:24`, which already exists and needs no change.

**Constraints:** the count is measured, not estimated. `rg -c 'openTab\(|openInspectorTab\(|getByRole\("tab"'
src/web/tests/e2e/*.ts` reports **42 occurrences across 7 files**: `author-journey-rebuild.spec.ts`
8, `editor.spec.ts` 14, `glass-authoring.spec.ts` 1, `inspector-sections.spec.ts` 1,
`rebuild-composition.ts` 8, `rebuild-driver.ts` 4, `reference-theme.spec.ts` 6. **Use `rg`, not a
double-quoted `grep`**: the pattern carries a `"`, and a shell-quoted `grep -n` for it silently
returned nothing on this box while ripgrep found the line — a count read from the wrong command is
the class of error this plan exists to avoid. A
no-op `openTab` is the failure this task exists to prevent — it would keep every call site
compiling while silently asserting nothing, which is exactly the shape plan 3 filed as a
finding when a spec opened a tab that no longer held the panel. **Where a call site was
load-bearing it becomes a pane choice; where it was incidental it is deleted.** Which is which
is decided by reading each one, not by pattern: a `"Design"` before an inspector assertion is
incidental (the column is always there), and the `"Style"` at `author-journey-rebuild.spec.ts:95`
is load-bearing and becomes the Document pane. `editor.spec.ts:2116-2137` is the case to read
first: it asserts the document's list *and* the selection's resolution in one test, and after
this plan those two live in different columns, so the test splits or the second half moves to
the Spends section. The `editor-style-tab` capture is retired with the panel it captured; it was
never registered in `docs/evidence/screenshots/README.md`, so the table needs no row removed —
**verify that by grepping the table rather than trusting this sentence**.

**Failure modes to design against:** Review Focus 5 — a helper, a comment or a doc still naming
the Style tab; a spec whose tab click is deleted along with the assertion that followed it; a
call site that now passes vacuously because the pane it asks for is the one already showing,
which is why `openPane` reads the state first; the capture call left in place, producing a
screenshot of the composition panel under the style tab's name.

**Verification:**
- `rg -c 'openTab\(|openInspectorTab\(|getByRole\("tab"' src/web/tests/e2e/*.ts` returns no
  match **inside the editor specs** — Review Focus 5, made mechanical.
- `rg -n 'Style tab|the Style panel|inspector\.style' src/web/packages/editor/src
  src/web/tests` leaves nothing promising a tab that is gone; the survivors are named in the
  commit.
- Browser: the seven affected files' editor suites pass with `--workers=1`, **with no test
  deleted**, and the test whose assertions moved is named in the commit.
- The two settings specs that changed route assert the same values as before — the strings and
  selectors are the control, not a new expectation.

**Commit:** `test(editor): the specs stop reaching for a tab that is gone`

---

## Phase 4 — Proof

### Task 10: The evidence a reviewer can re-run

**Files:**
- Modify: `src/web/tests/e2e/composition-panel.spec.ts` (created in Task 3)
- Modify: `docs/evidence/screenshots/README.md` (register the captures this plan adds)

**Interfaces:**
- Consumes: `openPane` (`editor-pane-bar.ts:24`), `expandLayer` and `enterLayer`
  (`editor-canvas.ts:171`, Task 6), `selectLayer` and `readScene` (`rebuild-driver.ts:179`,
  `:39`), and the `LayerPanel`'s own markers — `data-vigilia-layer`, `data-vigilia-layer-mark`,
  `data-vigilia-layer-role`, `data-vigilia-layer-bound`.
- Produces: the browser contract for the whole panel, and the capture rows in the evidence
  table pointing at this spec.

**Constraints:** capture requires `VIGILIA_CAPTURE=1` and `--workers=1`, and an action not
registered in `docs/evidence/screenshots/README.md` is not captured. Screenshots are evidence,
not cross-platform golden files — the assertions are numeric or textual and the image is for a
human. **The table's last paragraph names the specs that carry captures**
(`editor.spec.ts`, `reference-theme.spec.ts`, `glass-authoring.spec.ts`,
`inspector-sections.spec.ts`); adding this spec means adding it there, in the same change. One
sample of a flaky spec is not a measurement.

**Verification (browser, against the built bundle):**
- **The starter**: every row carries a role, a mark and — where the document declares one — a
  binding, and the count of rows is the count the DOM has rather than a remembered number.
- **Selection and entry are separate**: clicking a card's row selects the card; entering it and
  clicking the same row's sparkline row selects the chart. Both asserted on
  `getActiveObject()?.id` through the bridge, not on the panel's own state.
- **The right column empties**: with nothing selected it renders the nothing-selected line and
  no field; selecting a shape fills it; deselecting empties it again.
- **The Document pane** holds the theme's own controls and the document's resolved tokens, and
  both are reachable while a card is selected — the state the old Design tab hid them behind.
- **Two hundred loose shapes, re-measured.** Build the same document plan 1's probe built — 200
  loose rects with no group anywhere — and record, with numbers: the open time to 200 rows; the
  wall clock for hovering across the tree; the click-to-select time sampled across the tree, not
  at one depth; a canvas drag's delta against the object's authored coordinates; and a scroll to
  each end with both end rows still visible. **The role adds a column to every row, so the
  numbers to beat are plan 1's** — recorded in the spec's acceptance at
  `2026-10-03-dashboard-authoring-design.md` §*Acceptance* (223ms to open, five rows clicked at
  153–333ms, a drag of +209/+63.5, a wheel to both ends) — and the case the plan-1 probe
  explicitly did **not** cover is the one to add: **a group entered inside a large document**,
  which re-projects the tree with the through-selection flags on.
- **What this task cannot claim:** that these numbers generalise. One document, one viewport,
  one machine — say so in the case's own comment and in the commit, the way the spec's acceptance
  says it of plan 1's figures. A number that moved is reported as a number that moved, with the
  previous sample beside it; a machine under another session's load is not a regression.
- Screenshots: the composition panel over the starter with a card entered; the panel at two
  hundred rows; the Document pane. Register each in the evidence table.
- Gates: `npm run typecheck` exit 0, `./node_modules/.bin/biome lint ..` clean, the full vitest
  suite, and this spec plus the affected editor specs with `--workers=1`.

**Commit:** `test(editor): the composition panel at eight rows and at two hundred`

### Task 11: The register, the status, and the plan's close

**Files:**
- Modify: `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl` (`vg-146` →
  `verified`, moved to the archive)
- Modify: `STATUS.md`
- Move: this plan to `docs/superpowers/plans/archive/` once nothing depends on it

**Constraints:** a `verified` row needs a `check` naming a word from its own `title` — `vg-146`'s
title is about the **Style tab** rendering an empty panel, so the check must be a command that
fails if the Style tab still exists, not a check of the composition panel nearby. It also needs
`artefacts` naming a sha that resolves and is an ancestor of `HEAD` (`git merge-base
--is-ancestor`). **Both halves, or it is not closed.** The archive is grepped before filing;
`vg-056` and `vg-087` are **not** closed here and the commit says why (see *Out of scope*).
`STATUS.md` gets the 1–5 bullet "Last completed change", one item per line, never wrapped, and
`npm run status:check` runs from `src/web/` before the commit. The status names **plan 5, units
alongside primitives**, as the next work, with its landmarks.

**Verification:** `node scripts/backlog-check.mjs` passes; the archive greps for `vg-146`; the
named sha is an ancestor of `HEAD`; `STATUS.md` names plan 5 and carries no bullet promising the
Style tab.

**Commit:** `docs(status): the composition panel is closed and plan 5 is next`

---

## Resolved here, open in the spec

The spec is binding and silent on the mechanism. These were handed to the plan and are decided
above, each with the reason it was decided that way:

1. **The role is data in the projection, and the words are in `ui-copy.ts`.** Two owners were
   possible and both are wrong: words in `layer-tree.ts` puts copy in a projection that
   `renderer-core`'s rules keep free of surfaces, and structure in the panel puts a second
   derivation of "what is this" beside the bridge's. So the projection emits a `LayerRole` of
   raw facts and the panel renders it from `uiCopy.panels.layerRoles`. `kindLabels` moves for
   the same reason — it was already a words table in the wrong owner.
2. **The role is visible, and it is also the kind's only accessible statement.** A `title`
   reaches no keyboard author and an `aria-label` on a row whose name is assembled from its
   columns is a second name. The visible span is the whole mechanism.
3. **Enter gets a control, and no key binding moves.** The panel's keys are the tree's keys:
   arrows navigate and expand, Space selects, Enter and F2 rename, Escape leaves a group.
   Entering would have to take one of those, and each is a capability — so the verb is a button
   in the row's own tab order, which is how Hide and Lock are already reached. Plan 7 owns the
   keyboard surface and may revisit this; this plan removes nothing from it.
4. **The Style tab is deleted, not repaired, and `vg-146` closes with it.** Its selection mode
   duplicates the right column's Spends section — same functions, same arguments, and Spends
   answers the group case that the tab renders blank. Its document mode moves to the Document
   pane. Nothing is lost and one surface stops disagreeing with another.
5. **The starter's cards keep no provenance, and every card row on it therefore says `group`.**
   The library stamps `{ widgetId, widgetName }` on an inserted root and the starter's builders
   do not, so `metric card` is reachable on a document the author built and not on the reference
   composition. Stamping the starter would change a shipped document's bytes and every captured
   piece of evidence that proves something else — and whether the starter *is* a document made
   of units is plan 5's question, because plan 5 is where units stop being an insertion and
   start being the way a card exists. The row reports what the document says; today the starter
   says "a group".

## Out of scope

Named so a later phase is not asked to prove them here:

- **Units alongside primitives** (plan 5), **the publish loop** (6), **keyboard** (7), **player
  chrome** (8), **chrome and appearance** (9). The primitive-library standardisation on Radix is
  plan 9's and is not pre-empted: `shell-layout.tsx` loses its `Tabs` import here because the
  tab strip goes, not because Base UI is being migrated.
- **Multi-select in the layer list (`vg-056`) and drag-to-reorder (`vg-087`).** Both rows
  cross-link deliberately, because the requirement has to survive into the composition panel —
  and it does: the panel keeps the row click, the drag handlers, the same-parent rule and the
  refusal marks exactly as they are. Neither row is closed by this plan, because neither is
  implemented by it; both are carried rather than dropped, and Task 11 says so in the commit.
- **The lock control's silence (`vg-148`).** The cause is named to the line
  (`object-lock-manager/index.ts:74-81` fires no event the column listens to) but the fix spans
  two owners and needs a decision about which event the lock manager announces. That is the
  event vocabulary, not the row, so it is filed rather than fixed on the fly.
- **The device frame's notch and safe areas (`vg-133`)** — plan 2's, still open.
- **`vg-145`'s class of defect** — an authoring bound narrower than the format — is closed, and
  the descriptor table is not re-opened.
- **Driving validation from the descriptor table**, decided against in plan 3 with the reason
  recorded in `settings-fields.ts`'s header.
- **The starter as a document made of units.** Named in *Resolved here* 5 and owned by plan 5.
