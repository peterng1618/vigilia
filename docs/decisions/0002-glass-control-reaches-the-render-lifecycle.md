# 0002 — An authored glass change reaches the renderer through `GlassHandle.sync`, and the radius is read live

- **Date:** 2026-09-27
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/glass.ts`

> Companion to [`0001`](0001-backdrop-glass-in-fabric.md), which decided *where*
> glass composites. That note was late and admitted it: it recorded the composite
> and skipped rungs 4–5. This one exists because the work this task adds — the
> editor's enable/blur control — reaches a mechanism boundary 0001 never
> described, and because the plan's controller ruled rungs 4–5 are not optional.

## The problem

Task 6 ships the control that writes `vigiliaGlass`. Two facts about the
existing lifecycle make the control a lie the moment it is written:

1. `createGlass` discovers panels only in `sync()`, which is subscribed to
   `object:added` / `object:removed` (and to each group's own membership events).
   Writing a property on an object that is already on the canvas fires none of
   them, so **enabling glass through the UI attaches nothing** — the blur
   appears only after some unrelated add, remove or history restore.
2. `attach()` reads `glassTreatment(object)` once and stores the radius on the
   `Panel` record, and an already-attached panel short-circuits out of
   `attach()` entirely. So even a forced `sync()` leaves a changed radius on the
   value captured at first attach: **the blur-radius field would move the
   control and not the picture.**

Neither is a hypothetical. Both are reachable from the first keystroke of the
control Task 6 is asked to ship.

## Rung 1 — Vigilia

Searched: `scene-fabric/src/glass.ts` (`createGlass`, `GlassHandle`, `attach`,
`sync`, `composite`, `Panel`), `editor/src/editor-shell.ts` (the only editor
mount of the handle), `editor/src/editor-interaction.ts`,
`editor/src/selection-inspector/{index,panel,appearance}.ts`,
`editor/src/editor-shell/controls/{number-field,linked-pair}.ts`,
`editor/src/chart-manager/panel.ts`, `editor/src/viewport-manager/navigation.ts`.

Found:

- `GlassHandle.sync()` already exists, is already public, and is already
  documented as *"Re-resolves every glass object in the tree"* — the exact
  operation a property write needs. It is simply not reachable from the editor:
  `editor-shell.ts` creates the handle in a closure and exposes neither it nor
  `sync`.
- No editor-side "authored properties changed" signal exists. The inspector's
  commit is `requestRenderAll()` + `historyManager.saveState()`; neither fires
  an event `createGlass` listens to. `canvas-nudge.ts` fires `object:modified`
  by hand for a nudge, which is Fabric's "gesture finished" event and would be a
  lie to reuse for a property write.
- `composite()` already states the rule this task follows: *"Read every factor
  live: `toCanvasElement` swaps the viewport transform and the canvas dimensions
  for the duration of the capture."* The cached radius is the one factor that
  was not read live, and it is the one an author can change in place.
- `selection-inspector/panel.ts` is the panel-material owner
  (`supportsPanelFields`, `PanelFieldHooks`, `commit`/`stillTarget`/`onChange`),
  and `numberInput` is the editor's validated numeric primitive: it parses,
  refuses out-of-range values instead of clamping them, restores the last
  accepted value, and puts a `role="alert"` line in its row.
- `chart-manager/panel.ts:137` is the editor's only existing checkbox, built
  inline as a sibling `<label>` with no `for` — the unnamed-control defect Task
  3 already recorded for the palette panel.

## Rung 2 — dependencies

Searched: the editor's declared dependencies (`react@19`, `@base-ui/react@1.8.0`,
`tailwindcss`, `lucide-react@1.48.0`, `echarts@6.1.0`) and the workspace's
`fabric@7.4.0`, plus `renderer-core` and `scene-fabric`.

Found: nothing that ships a form widget usable from imperative DOM. Base UI is a
React component library (`Checkbox.Root`, `render={<button />}`, React context);
`lucide-react` is icons only; ECharts and Fabric render, they do not build form
controls. Every control the editor ships today is built with
`document.createElement` inside a React-rendered host — adopting a React widget
for one control means a React island inside the imperative inspector, which is
the second rendering path `AGENTS.md` forbids.

## Rung 3 — platform

Searched: the native elements the existing primitives already use —
`HTMLInputElement` with `type="checkbox"`, `type="number"`, `min`/`max`/`step`,
`label[for]`, `role="alert"`, and the editor's own `SPACE_ACTIVATED_ROLES` set
in `viewport-manager/navigation.ts:24`.

Found: a native checkbox is already keyboard-operable (Space toggles, the
wheel handler explicitly refuses to claim the key), carries an accessible name
from `label[for]`, and reports its state to assistive technology without ARIA.
The canvas wheel/space routing in `navigation.ts` already knows about it.
`role="switch"` was considered and rejected: the authored state is a property
that is either present or absent, and a switch would promise an instant visual
change that only lands after the next composite. A native number input with
`min`/`max`, wrapped in the existing `numberInput`, already refuses rather than
clamps and already reports.

**This rung succeeding discharges nothing on its own** — that is exactly the
omission 0001 records, and it is why rung 4 ran.

## Rung 4 — ecosystem

Searched: the editor's own installed headless library, `@base-ui/react@1.8.0`,
through its published documentation (Context7, `/mui/base-ui`) — its Checkbox
accessibility page, its `Checkbox.Root` state contract, and its
`checkbox-group` labelling patterns. A general web sweep was attempted and
**failed**: the Exa search tool returned a free-tier rate limit, so this rung
rests on one authoritative source plus the installed tree, not on a survey.
Recorded as a limit rather than dressed up as coverage.

Found, verbatim from those docs:

- *"Base UI components handle ARIA attributes, roles, pointer interactions,
  keyboard navigation, and focus management, adhering to WAI-ARIA Authoring
  Practices"* — and its own labelling guidance is `htmlFor`/`id` on a native
  control, or an enclosing `<label>`. That is the mechanism a plain
  `<input type="checkbox">` plus `label[for]` already is.
- Its `Checkbox.Root` contract (`checked`, `indeterminate`, `valid`, `dirty`,
  `touched`, `readOnly`, `required`) is a **form** contract. A scene object has
  none of those states: it is edited, committed and undone, never submitted.
  The parts of Base UI's Checkbox that earn their keep here — the accessible
  name and the Space key — are already provided by the platform.

Dead ends: adopting Base UI's `Checkbox` (React-only, second rendering path,
form semantics the domain does not have); `role="switch"` (promises an immediate
effect the composite cannot deliver); re-deriving a `numberInput` (the editor
already owns one, and Task 3's panel fields are built on it).

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `GlassHandle.sync()` called by the editor after a committed treatment change | exactly the operation, already public and documented | one re-walk of the object tree per committed edit | none new; `sync` is already on the add/remove hot path | **accepted** |
| Listen for `object:modified` inside `createGlass` | none: a property write does not fire it, and firing it by hand misuses a Fabric event | — | a second, fake authoring signal | rejected |
| Editor removes and re-adds the object to force a re-resolve | works | z-order changes, selection and group membership all disturbed | silently rewrites the author's scene | rejected |
| Cache the radius in `Panel` and invalidate it from the editor | duplicates the authored property, and only the editor's write path would know to refresh it | a second owner for one number | stale again on the next path that writes the property | rejected |
| Re-create the `createGlass` handle on every edit | works | releases and re-allocates every panel's scratch surface per keystroke | churn for a re-read | rejected |

## Rung 6 — probe

Not a new measurement. Task 1's probe already bounds what the accepted path
costs on the 1672×941 artboard: **0.79–1.29 ms per composite with no media layer
at all**, flat across the 0–48 radius band, **0 idle repaints in 1000 ms**, and a
sharp foreground bit-for-bit unchanged. The change this task makes adds one
`canvas.get()` plus `isGlassTreatment` per panel per frame — the property read
`composite()` already performs for the object's own transform — and removes a
field from the `Panel` record. It moves no allocation, no surface and no
subscription, so it cannot move that number outside the noise it was measured
against.

The one thing this task could not probe in advance is the authoring path itself,
because it did not exist: a committed control edit is proved in the real editor
browser test, with the blur read out of the composited pixels, not asserted
from the object.

## Decision

Two changes, both in `scene-fabric/src/glass.ts`:

1. **`composite()` reads the authored radius live** — `glassTreatment(object)`
   per panel per frame — and the `Panel` record loses its `blurRadius` field.
   The authored property is then the only place a radius exists, in the same
   spirit as the viewport transform the file already refuses to cache. This is
   the fix for the defect; everything else is plumbing.
2. **The editor asks for a re-resolve.** `EditorShell` exposes the handle's
   existing public `sync()` as `refreshGlass()`, the session passes it to the
   selection inspector, and the glass control calls it in its commit. The
   control that changes the property is what tells the lifecycle, so there is no
   new event and no new subscription for either mount to learn.

**Not because `sync` already exists** — that is the answer to a question nobody
asked. The work is the discovery that a cached radius and an unreachable
`sync` made the control inert, and the ecosystem search is what established
that the accessibility half of the field needs nothing beyond a native
checkbox and a `label[for]`.
