# Editor layout — the left column and the header — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The editor loses its rail and its five-menu header, gaining a segmented
pane bar and an insert popover in the left column, a palette control in the header,
and three canvas-local controls where the View menu's settings were.

**Architecture:** `shell-layout.tsx` composes React chrome over the imperative Fabric
boundary; this plan changes only that chrome. No manager, envelope, panel or viewport
behaviour changes, and Fabric is never mirrored into React. The left column keeps the
existing pane-substitution model — each pane still mounts into a persistent host node —
because that is what makes scroll restoration work.

**Tech Stack:** React 19, Base UI (`Menu`, `Tabs`, `Popover`), Tailwind v4 (preflight only
in this plan), `lucide-react`, Vitest + jsdom, Playwright.

**Spec:** [`../specs/2026-10-02-frontend-redesign-design.md`](../specs/2026-10-02-frontend-redesign-design.md)
— plan 1 of 10. Read the spec's *Every existing authoring capability is preserved*
inventory; this plan moves rows out of it and drops none.

**Carried from preflight** (ledger: `.superpowers/sdd/2026-10-03-editor-left-column-and-header/progress.md`):
the palette moves in Task 1 because removing the rail removes the pane that holds it;
Tasks 4 and 5 of the first draft merged because the plan contradicted itself about
`ViewSetting`; and there is **no `document` pane in this plan** — `hosts.document` moves
in plan 2, alongside the change that empties the right column.

## Global Constraints

- **Every existing authoring capability is preserved.** This plan moves the shell
  palette, the insert list, and the three View settings. It removes no surface.
- Fabric stays imperative behind the editor boundary. React never mirrors a Fabric
  object; panels render the bridge's serializable projection.
- One owner per concept. `insertGroups()`, `object-actions.js` and the palette list keep
  their owners; surfaces render from them.
- Persist authored state only. Pane choice, collapse and the palette override are
  transient or browser-local — the palette stays in `localStorage`, nothing enters
  authored history (§67).
- Editor-shell theming stays separate from authored theme globals (§35).
- Copy lives in `ui-copy.ts`. Icons are components, not copy — an icon sits beside the
  surface that draws it, and its `aria-label` comes from `ui-copy`.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. No `git add -A`;
  stage explicit paths. No licence headers.
- 500 lines is a signal and 800 a stop. If a task pushes a file past either, split the
  file by responsibility rather than growing it.
- Test names, not line numbers, are how a task points at an existing assertion. Line
  numbers go stale the moment the file moves and `AGENTS.md` forbids them in plans.

## Review Focus

The spec is a design document; these are the conditions it implies and no step below
exercises. Each is pinned by a test added in the task named.

1. **A pane swap while the panel is collapsed.** `choosePane` currently reads the scroll
   offset off the DOM before swapping and restores it in a `requestAnimationFrame`. A
   collapse changes which node is the scroll container; if the restore lands on a node
   that was never mounted, the offset silently resets to 0 and the author loses their
   place in a 52-row list. Pinned in Task 1.
2. **A pane's host node still mounted while its segment is unselected.** `Shell` keeps
   every host in the DOM and hides the inactive ones with the `hidden` attribute. If a
   refactor unmounts an inactive host instead, panels that keep their own state — the
   asset panel's list, the type-preset panel's picker — lose it on every pane change.
   Pinned in Task 1.
3. **The pane bar's collapse gesture.** The rail made "choose the visible pane" a
   collapse. A horizontal segmented header carrying a `+` can easily make the same
   gesture mean something else. Pinned in Task 1.
4. **Insert parity.** `insertGroups()` is the owner and the old Insert menu drifted from
   the Add pane once already. A popover built from the same owner cannot drift; one
   built from a copy can. Pinned in Task 3 by comparing rendered groups against
   `insertGroups()` itself, not against a literal list.
5. **The palette control under all six palettes.** `applyShellPalette` sets one data
   attribute; a control that reads `--shell-*` at mount rather than at paint would show
   the wrong value after a palette change without a reload. Pinned in Task 1, and only
   meaningful once Task 2 has made five of the six legible.

---

## Phase 1 — The left column

### Task 1: A pane bar replaces the rail, and the palette moves to the header

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/pane-bar.tsx`
- Create: `src/web/packages/editor/src/editor-shell/palette-menu.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` — `Shell`,
  `RailPane`, `ShellHosts`, `choosePane`, `scrollOf`, `paneBody`, `RAIL_ICONS`, the
  header's children
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` — the
  `.editor-shell-body` grid templates, the `.editor-shell-rail` rule block, the
  `.editor-shell-palette` rule
- Test: `src/web/packages/editor/src/editor-shell/pane-bar.dom.test.tsx` (new)
- Test: `src/web/packages/editor/src/editor-shell/pane-bar.dom.test.tsx` covers the bar;
  add `palette-menu.dom.test.tsx` (new)
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `uiCopy.rail.*`, the existing `ShellHosts` host nodes, `EditorShellBridge`'s
  `editor.viewport` with `onChange`/`zoomToFit`, and from `palette.ts` the unchanged
  `readShellPalette`, `writeShellPalette`, `applyShellPalette`, `shellPalettes`,
  `DEFAULT_SHELL_PALETTE`.
- Produces: `PaneBar` — `{ pane: RailPane; collapsed: boolean;
  onChoose: (pane: RailPane) => void; onInsert: () => void }`. `RailPane` narrows from
  `"layers" | "add" | "assets" | "settings"` to `"layers" | "insert" | "assets"`, and
  `PaletteMenu` — `{ palette: string; onChange: (next: string) => void }`. Task 3
  consumes `onInsert`; Task 4 relies on `ViewSetting`, which this task must **not**
  delete.

**Constraints:** the pane-substitution model is unchanged — one persistent host node per
pane, relocated by React's `Host`, hidden rather than unmounted when inactive. Move
`choosePane`'s scroll save/restore and its `refitOnViewportChange` into the `Shell`
body unchanged and pass `onChoose` down; that logic is correct today and its comments
record two bugs it already prevents. The bar is a horizontal segmented header, so the
rail's vertical icon-button styling goes with it.

The palette moves because the Settings pane holds nothing else, so the rail's removal
takes it. `PaletteMenu` renders one option per `shellPalettes()`, shows a swatch of the
current palette rather than its name alone, and writes through the same two owners it
uses today — this changes where the control lives, not what it does.

There is deliberately **no `document` pane here**. `hosts.document` stays in the
inspector until plan 2 moves it; a segment with nothing in it is the defect this plan
exists to fix.

**Failure modes to design against:** a pane swap that resets the scroll offset; a pane
that unmounts instead of hiding; a collapse gesture that means two different things
depending on whether the panel is open; a palette control that reads its value once at
mount and goes stale when the palette changes.

**Verification:**
- Unit (`pane-bar.dom.test.tsx`): one segment per pane carrying `aria-pressed` for the
  chosen one and the label from `uiCopy.rail`; choosing the already-chosen pane calls
  `onChoose` with it (the shell decides collapse, the bar does not); the `+` button
  calls `onInsert` and nothing else.
- Unit (`palette-menu.dom.test.tsx`): renders one option per `shellPalettes()`; choosing
  one calls `writeShellPalette` and `applyShellPalette`.
- Unit (`shell-layout.dom.test.tsx`): the existing tests named *"collapses the panel
  when the rail entry for the visible pane is clicked again"*, *"brings the collapsed
  panel back on whichever pane is asked for"*, *"switches panes without closing when the
  panel is already open"*, *"re-frames on the panel toggle even for a camera the author
  has moved"*, *"leaves the camera alone after a swap between two open panes"* and
  *"re-frames when a collapsed panel is reopened by asking for a pane"* are **rewritten
  against the segment, keeping their assertions and their refit instrumentation** — they
  encode two previously-fixed bugs.
- Delete rather than leave passing vacuously: the `railEntry` helper, and the tests
  named *"names every rail entry by its label and draws an icon, not a glyph"* and
  *"tells a hovering author what the rail entry will do to the panel"*. Update the
  mount test named *"mounts the editorial palette, menus, rail, inspector and dock
  hosts"*, which names the rail.
- Browser: select a layer, scroll the layer panel down, switch to Assets and back; the
  offset is where it was. Switch panes twice and confirm each pane's host node is still
  the same node it was before — the Assets pane has a `<select>`, a thumbnail and
  Import/Replace/Remove, so *its own state* is the evidence: change the select, switch
  away, come back, and it still shows the changed value.
- Browser: switch palette; the chrome repaints without a reload and the choice survives
  a reload. Check under all six, not the default — Task 2 is what makes five legible.

**Commit:** `feat(editor): a pane bar replaces the rail`

### Task 2: Scale tokens, and `--vigilia-*` that resolve

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` — `:root`, the
  `--vigilia-*` block, and the new scale block
- Test: `src/web/tests/e2e/shell-appearance.spec.ts` (new)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `--spacing: 0.25rem` as the single spacing base — **not** `--space-1..6`,
  which is not a Tailwind namespace and would be six literals for Plan 10 to delete —
  plus `--radius-sm|md|lg`, `--text-xs|sm|md` and `--shadow-raised|overlay`, all on
  `:root`. Plan 10 converts these to `@theme`, so the names must be the ones `@theme`
  will use.

**Constraints:** the twelve `--shell-*` colour tokens are the one layer that already
works and are untouched. The `--vigilia-*` block moves from
`[data-shell-palette="editorial"]` to `:root`, with `editorial` keeping only what it
actually overrides — today it redeclares values identical to `--shell-*`, and that
redundancy is what the move removes. **Resolve `scripts/reuse-gate.mjs` before the
first write**: if the gate claims this path, land a `docs/decisions/` note naming what
was searched and why nothing else owns a shell token scale, or record that it does not.

**Portalled popups are part of this task.** `applyShellPalette` writes the palette
attribute onto the editor's root element, and Base UI portals every popup to
`document.body` — which is not a descendant of that root. So a menu, popover or palette
list renders with the bare `:root` values no matter which palette is chosen. This is
pre-existing and applies to every Base UI surface, but Task 1 puts a palette *list* in
the header where it becomes visible under all six palettes. Settle where the attribute
lives as part of moving the tokens, and prove it on a portalled popup, not only on the
chrome.

**Failure modes to design against:** an editorial-only declaration moving to `:root` that
silently changes the default appearance before any palette attribute is applied — the
comment above `:root` says a fresh profile renders editorial on bare `:root`, so the
move must preserve that.

**Verification:**
- Browser, and **only** the browser. jsdom does not resolve custom properties, so a
  jsdom test here would pass vacuously and must not be written: with each of the six
  palettes applied, every element styled from a `--vigilia-*` token has a non-empty
  computed colour. Today five of the six resolve to nothing — assert the failing case
  first, then watch it pass.
- Browser: a fresh profile with no `localStorage` renders the editorial palette.
- Static: no `--vigilia-` reference in the file resolves to a declaration scoped to a
  single palette attribute.

**Commit:** `feat(editor): scale tokens, and every palette resolves`

### Task 3: The insert popover

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/insert-popover.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/pane-bar.tsx` — wire `onInsert`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` — delete the
  Insert `MenuGroup` and `insertItem`
- Test: `src/web/packages/editor/src/editor-shell/insert-popover.dom.test.tsx` (new)
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `insertGroups()`, `InsertGroup`, `InsertableObject`, `EditorActionFacade`'s
  `addText` / `addShape` / `addChart`, and `PaneBar`'s `onInsert` from Task 1.
- Produces: `InsertPopover` — `{ session: EditorActionFacade | undefined;
  open: boolean; onOpenChange: (open: boolean) => void }`.

**Constraints:** render from `insertGroups()` directly. `keyOf` and `insertItem` move
into the popover rather than being deleted — a shape `Line` and a chart `Line` share a
label, and the React key has to stay what distinguishes them. The Add pane's own host
node and its list are unaffected: the popover is a second rendering of one owner, which
is exactly the arrangement that stopped the menu and the pane drifting once before.

**Verification:**
- Unit: the rendered groups equal `insertGroups()` read from the owner, compared as
  entries — not against a literal list, which is the mistake that let the two surfaces
  diverge before. Each item dispatches the facade call its kind names.
- Unit: a shape `Line` and a chart `Line` are two rows, not one.
- Delete the Insert-menu helpers (`insertMenuGroups`, `insertMenuEntry`) and the test
  named *"inserts the same objects from the Insert menu as the Add pane offers"*, which
  the parity assertion above supersedes.
- Browser: insert a text object and a chart from the popover; each appears on the canvas
  and in the layer tree.

**Commit:** `feat(editor): insert from a popover, one owner`

---

## Phase 2 — The header

### Task 4: Two menus, and the View settings beside the canvas

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/canvas-view-controls.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` — `ViewSetting`,
  `ShellMenuBar`, and the stage where the controls mount beside `ZoomReadout`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Test: `src/web/packages/editor/src/editor-shell/canvas-view-controls.dom.test.tsx` (new)
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `EditorViewControls` — `sourceMode`/`setSourceMode`,
  `chartRefreshRate`/`setChartRefreshRate`, `runDisplay`/`setRunDisplay`.
- Produces: `CanvasViewControls` — `{ view: EditorViewControls | undefined }`.

**Constraints:** this is one edit, not two. Removing the View menu without rehoming its
three settings would delete three capabilities, which the spec's inventory forbids; and
the two halves are the same change to the same component, so they land together.

**`ViewSetting` moves, it is not deleted.** It is the shell's own idiom for a setting
with more than one value — a trigger naming the current value, a popup listing every
one — and it carries `aria-haspopup` and `aria-checked` correctly. It moves from
`ShellMenuBar` to `CanvasViewControls` unchanged apart from its container. File and Edit
menus are untouched.

Each control reads its current value through the same accessor the menu used rather than
holding a copy, so a change made anywhere is reflected everywhere.

**Failure modes to design against:** a control that reads its value at mount shows a
stale value after a change elsewhere; the `30 → 1 FPS` mis-click that made a preview look
hung is the reason these were converted from toggles to listed choices in the first
place.

**Verification:**
- Unit: each of the three renders its current value in its trigger and lists every
  option; choosing one calls the matching setter and does not toggle.
- Unit: the menubar renders exactly `uiCopy.menus.file` and `uiCopy.menus.edit`; undo
  and redo stay disabled with no selection and enable on one.
- Delete the test named *"opens every View setting's choices instead of toggling on a
  bare click"*, superseded by the per-control tests above.
- Browser: the two menus open and nothing in the header says "Editor". Switch
  preview → live and watch the chart update; switch refresh rate and measure the change;
  switch value runs and see the labels change.

**Commit:** `feat(editor): two menus, and view settings beside the canvas`

---

## Acceptance

Rendered observation in a real browser (§33). Each item names what was seen.

- The editor has no rail. The stage is at least 52px wider than before at the same
  window size, and the left column carries three labelled segments plus a `+`.
- Choosing the visible segment collapses the panel; asking for a collapsed pane brings it
  back, restores that pane's scroll offset, and re-frames the camera.
- A pane's host stays mounted while inactive — an asset edited, then hidden behind
  another pane and revealed, is still there.
- The shell palette is reachable from the header, repaints without a reload, survives a
  reload, and is legible under all six palettes.
- Under each of the six palettes, every element styled from a `--vigilia-*` token has a
  non-empty computed colour.
- The popover's groups equal `insertGroups()` read from the owner, and a shape `Line` and
  a chart `Line` are two distinct rows.
- The header renders exactly two menus; the three View settings are reachable beside the
  canvas, each showing its current value and listing every option.
- **Every row of the spec's capability inventory touched by this plan is walked once in
  the browser.** Nothing is unaccounted for.