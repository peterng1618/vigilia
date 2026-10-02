# Editor layout — the left column and the header — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The editor loses its rail and its four-menus header, gaining a segmented
pane bar and an insert popover in the left column, a palette control in the header, and
three canvas-local controls where the View menu's settings were.

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

## Global Constraints

- **Every existing authoring capability is preserved.** This plan moves the shell palette,
  the insert list, and the three View settings. It removes no surface.
- Fabric stays imperative behind the editor boundary. React never mirrors a Fabric
  object; panels render the bridge's serializable projection.
- One owner per concept. `insertGroups()`, `object-actions.ts` and the palette list keep
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

## Review Focus

The spec is a design document; these are the conditions it implies and no step below
exercises. Each is pinned by a test added in the task named.

1. **A pane swap while the panel is collapsed.** `choosePane` currently reads the scroll
   offset off the DOM before swapping and restores it in a `requestAnimationFrame`. A
   collapse changes which node is the scroll container; if the restore lands on a node
   that was never mounted, the offset silently resets to 0 and the author loses their
   place in a 52-row list. Pinned in Task 1.
2. **A pane's host node still mounted while its segment is unselected.** The current
   `Shell` keeps all four hosts in the DOM and hides the inactive ones with the `hidden`
   attribute. If a refactor unmounts an inactive host instead, panels that keep their own
   state — the artboard panel's asset list, the type-preset panel's picker — lose it on
   every pane change. Pinned in Task 1.
3. **The pane bar's collapse gesture when the closed pane is asked for by name.** The
   rail made "click the visible entry" a collapse; a segmented header that also carries
   a `+` can easily make the same click mean something else. Pinned in Task 1.
4. **Insert parity.** `insertGroups()` is the owner and the old Insert menu drifted from
   the Add pane once already. A popover built from the same owner cannot drift; one
   built from a copy can. Pinned in Task 3 by comparing rendered groups against
   `insertGroups()` itself, not against a literal list.
5. **The palette control under all six palettes.** `applyShellPalette` sets one data
   attribute; a control that reads `--shell-*` at mount rather than at paint would show
   the wrong value after a palette change without a reload. Pinned in Task 6.

---

## Phase 1 — The left column

### Task 1: A pane bar replaces the rail

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/pane-bar.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` — `Shell`,
  `ShellHosts`, `choosePane`, `scrollOf`, `paneBody`, `RAIL_ICONS`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` — the
  `.editor-shell-body` grid templates, and the `.editor-shell-rail` rule block
- Test: `src/web/packages/editor/src/editor-shell/pane-bar.dom.test.tsx` (new)
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `uiCopy.rail.*`, the existing `ShellHosts` host nodes, `EditorShellBridge`'s
  `editor.viewport` and its `onChange`/`zoomToFit`.
- Produces: `PaneBar` — props `{ pane: RailPane; collapsed: boolean;
  onChoose: (pane: RailPane) => void; onInsert: () => void }`. `RailPane` widens from
  `"layers" | "add" | "assets" | "settings"` to `"layers" | "insert" | "assets" |
  "document"`; Task 3 consumes `onInsert`, Tasks 4–6 rely on the other three.

**Constraints:** the pane-substitution model is unchanged — one persistent host node per
pane, relocated by React's `Host`, hidden rather than unmounted when inactive. Move
`choosePane`'s scroll save/restore and its `refitOnViewportChange` verbatim into the
`Shell` body and pass `onChoose` down; that logic is correct today and its comments
record two bugs it already prevents. The pane bar is a horizontal segmented header, so
the rail's vertical icon-button styling goes with it.

**Failure modes to design against:** a pane swap that resets the scroll offset; a pane
that unmounts instead of hiding; a collapse gesture that means two different things
depending on whether the panel is open.

**Verification:**
- Unit (jsdom, `pane-bar.dom.test.tsx`): the bar renders one segment per pane carrying
  `aria-pressed` for the chosen one and the label from `uiCopy.rail`; choosing the
  already-chosen pane calls `onChoose` with it (the shell decides collapse, the bar does
  not); the `+` button calls `onInsert` and nothing else.
- Unit (jsdom, `shell-layout.dom.test.tsx`): clicking the visible segment collapses the
  panel and re-frames; asking for a collapsed pane brings it back and restores that
  pane's saved offset; a swap between two open panes leaves the camera alone. These are
  the existing tests at lines 273, 304, 322, 336, 376 and 411, rewritten against the
  segment instead of the rail entry — **keep their assertions and their refit
  instrumentation**, they encode two previously-fixed bugs.
- Browser: select a layer, scroll the layer panel down, switch to Assets and back; the
  offset is where it was.
- **Delete** the `railEntry` helper and the rail-specific assertions at lines 250 and
  457 rather than leaving them passing vacuously, and update the mount test at line 117,
  which names the rail.

**Commit:** `feat(editor): a pane bar replaces the rail`

### Task 2: Scale tokens, and `--vigilia-*` that resolve

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` — `:root`, the
  `--vigilia-*` block, and the new scale block
- Test: `src/web/tests/e2e/shell-appearance.spec.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `--space-1..6` on a 4px base, `--radius-sm|md|lg`, `--text-xs|sm|md`,
  `--shadow-raised|overlay`, all on `:root`. Task 10 converts these to `@theme`; this
  task is what it converts, so the names must be the ones `@theme` will use.

**Constraints:** the twelve `--shell-*` colour tokens are the one layer that already
works and are untouched. The `--vigilia-*` block moves from
`[data-shell-palette="editorial"]` to `:root`, with `editorial` keeping only what it
actually overrides — today it redeclares values identical to `--shell-*`, and that
redundancy is what the move removes. **Resolve `scripts/reuse-gate.mjs` before the first
write**: if the gate claims this path, land a `docs/decisions/` note naming what was
searched and why nothing else owns a shell token scale, or record that it does not.

**Failure modes to design against:** an editorial-only declaration moving to `:root` that
silently changes the default appearance before any palette attribute is applied — the
comment at line 15 says a fresh profile renders editorial on bare `:root`, so the move
must preserve that.

**Verification:**
- Browser (this is the only gate that proves it — jsdom does not resolve custom
  properties, so a jsdom test here would pass vacuously and must not be written): with
  each of the six palettes applied, every element styled from a `--vigilia-*` token has a
  non-empty computed colour. Today five of the six resolve to nothing; assert the case
  that fails first.
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
  `addText` / `addShape` / `addChart`.
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
- Unit: `a shape Line and a chart Line are two rows, not one`.
- Delete the Insert-menu helpers (`insertMenuGroups`, `insertMenuEntry`) and the test at
  line 728, superseded by the parity test above.
- Browser: insert a text object and a chart from the popover; each appears on the canvas
  and in the layer tree.

**Commit:** `feat(editor): insert from a popover, one owner`

---

## Phase 2 — The header

### Task 4: Two menus

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` — `ShellMenuBar`
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `uiCopy.menus.file`, `uiCopy.menus.edit`, `EditorActionFacade`.
- Produces: nothing new; `ShellMenuBar` keeps its props.

**Constraints:** File and Edit are untouched. Delete the Insert group (Task 3 owns it)
and the View group (Task 5 owns its three settings). `ViewSetting` leaves with them —
it exists only to render those submenus, and keeping it would leave a component with no
caller. Preserve the brand, and replace the dead `uiCopy.editor` label: it names the
window the browser tab already names.

**Verification:**
- Unit: the menubar renders exactly `uiCopy.menus.file` and `uiCopy.menus.edit`.
- Unit: undo and redo stay disabled with no selection and enable on one.
- Browser: the two menus open, and nothing in the header says "Editor".

**Commit:** `feat(editor): the header keeps two menus`

### Task 5: The View settings move to the canvas

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/canvas-view-controls.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` — mount it beside
  `ZoomReadout` in the stage, delete the View `MenuGroup`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Test: `src/web/packages/editor/src/editor-shell/canvas-view-controls.dom.test.tsx` (new)
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `EditorViewControls` — `sourceMode`/`setSourceMode`,
  `chartRefreshRate`/`setChartRefreshRate`, `runDisplay`/`setRunDisplay`.
- Produces: `CanvasViewControls` — `{ view: EditorViewControls | undefined }`, reading
  current values through the same accessor the menu used rather than holding its own
  copy.

**Constraints:** these are *three capabilities* the removal of the View menu would
otherwise take with it, and the spec's inventory names them explicitly. All three keep
the `ViewSetting` idiom — a trigger naming the current value, a popup listing every one —
because that idiom is already the shell's own answer and it carries `aria-haspopup` and
`aria-checked` correctly. `ViewSetting` is reused here, not deleted in Task 4.

**Failure modes to design against:** a control that reads its value at mount shows a
stale value after a change elsewhere; the `30 → 1 FPS` mis-click that made a preview look
hung is the reason these were converted from toggles to listed choices in the first place.

**Verification:**
- Unit: each of the three renders its current value in its trigger and lists every
  option; choosing one calls the matching setter and does not toggle.
- Browser: switch preview → live and watch the chart update; switch refresh rate and
  measure the change; switch value runs and see the labels change.

**Commit:** `feat(editor): view settings live beside the canvas`

### Task 6: The palette moves to the header

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx` — replace the
  Settings pane contents with nothing; add the palette control to the header
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` — remove the
  `.editor-shell-palette` rule, add the header control's
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `readShellPalette`, `writeShellPalette`, `applyShellPalette`,
  `shellPalettes`, `DEFAULT_SHELL_PALETTE` — all unchanged, still the owner.
- Produces: nothing new; the `Settings` pane value of `RailPane` is gone, so
  `ShellHosts` loses nothing and `Shell` loses its palette `useState`.

**Constraints:** the shell palette is chrome appearance, not a document property, and
putting it in a document pane is what made it read as one. `applyShellPalette` still
writes one data attribute on the root; this moves only where the control lives. The
control shows a swatch of the current palette rather than its name alone.

**Verification:**
- Unit: the header control renders one option per `shellPalettes()`; choosing writes
  through `writeShellPalette` and calls `applyShellPalette`.
- Browser: switch palette; the chrome repaints without a reload, and the choice survives
  a reload. Check under all six, not the default — Task 2 is what makes five of them
  legible.

**Commit:** `feat(editor): the shell palette is chrome, and lives in the header`

---

## Acceptance

Rendered observation in a real browser (§33). Each item names what was seen.

- The editor has no rail. The stage is at least 52px wider than before at the same window
  size, and the left column carries four labelled segments plus a `+`.
- Choosing the visible segment collapses the panel; asking for a collapsed pane brings it
  back, restores that pane's scroll offset, and re-frames the camera.
- A pane's host stays mounted while inactive — an asset list edited, then hidden behind
  another pane and revealed, is still there.
- The popover's groups equal `insertGroups()` read from the owner, and a shape `Line` and
  a chart `Line` are two distinct rows.
- The header renders exactly two menus; the three View settings are reachable beside the
  canvas, each showing its current value.
- The shell palette is reachable from the header, repaints without a reload, survives a
  reload, and is legible under all six palettes.
- Under each of the six palettes, every element styled from a `--vigilia-*` token has a
  non-empty computed colour.
- **Every row of the spec's capability inventory touched by this plan is walked once in
  the browser.** Nothing is unaccounted for.