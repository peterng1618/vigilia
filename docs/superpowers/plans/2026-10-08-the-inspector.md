# The Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `selection-inspector/` — 2,714 lines of imperative DOM across 18 files — as a React column of §6's five sections, built from plan 1's control set, reading a projected view through the bridge and writing through the existing funnel, so that **the rendering changes and no rule does** (§2.3).

**Architecture:** The column's rendering becomes React; its **rules do not move**. `index.ts` keeps the three things it already owns — which object is described (`target()`), how a field writes it, and the commit path — and gains one generalisation: the write funnel is keyed by the field's `data-vigilia-*` hook instead of by `GeometryKey`, so the string a test locates a control by and the string a control commits through are the same string. React reads a **serializable projection** (`SelectionView`) rebuilt on demand from Fabric and never holds an object (ADR-0039 / §2.1). `createSelectionInspector(host, options)` keeps its signature, so nothing outside this family changes: it creates a React root inside the host it is given, exactly as `shell-layout.tsx` already does for `CanvasDock`. The per-kind plan (`perKindColumn`) already returns sections as data; this extends it one level down to **fields as data**, so §2.3 parity is a comparison of two row lists rather than a DOM diff.

**Tech Stack:** TypeScript, React 19, Base UI, Fabric 7.4.0, Tailwind v4 (`@theme`), Biome 2.x, Vitest (jsdom), Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`](../specs/2026-10-08-editor-design-language-design.md) — §2.1, §2.2, §2.3, §6, §9, §12 row 3, §13, Invariants, Acceptance, *Ruled during review*
**Normative companion:** [`docs/design/design-language.md`](../../design/design-language.md) — §2, §3, §4, §5, §7.4, §8, §9, §10
**Reference:** [`docs/design/mockups/inspector-language.html`](../../design/mockups/inspector-language.html), [`docs/design/mockups/inspector-controls.html`](../../design/mockups/inspector-controls.html), and [`README.md`](../../design/mockups/README.md) for what a mockup is and is not
**Decision:** [`0039`](../../decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)

## What the spec says, and what the code actually does

§6 corrects an earlier spec's prose and describes existing behaviour. The docs review reconciled its group table against this inventory: angle belongs to Layer; Position includes the bleed mark. This plan and the corrected spec now share that contract.

Verified against the source:

- `SELECTION_KINDS` is `["shape", "text", "chart", "image", "group", "activeSelection"]` (`per-kind-column.ts:88`).
- `selectionKindOf()` dispatches on the Fabric class — `ActiveSelection`, then `VigiliaChart`, then `Group`, then the `type` tag, then `FabricImage`, else `shape` (`per-kind-column.ts:112`).
- **A card is not a kind and no card-role dispatch exists anywhere** in `selection-inspector/`. A card is a `Group`, and `KIND_QUESTIONS.group` is `{ childrenAppearance: true }` — nothing more.
- `supportsPanelFields()` admits exactly ten shape classes (`Rect`, `Circle`, `Ellipse`, `Triangle`, `Polygon`, `Polyline`, `Line`, `Path`, `Arc`, `Wedge`) and **no `Group`** (`panel.ts:84`).
- The glass refusal is `supportsGlass(kindOf(object)) && !(object instanceof Group)` (`glass.ts:85`), and the reason is rendered by the control's own `refusalOf` — `uiCopy.inspectorFields.glassRefused(kind)`.

What a group gets today, in full, read from `perKindColumn`:

| Section | A group (**as the code has it**) |
|---|---|
| Content | the name field (`createNameField`); the run editor renders empty and is omitted; chart fields are not this kind |
| Position | the X/Y pair, the W/H pair, and the **bleed mark** (`createBleedField` is offered for every selection); no crop (`canCrop` admits an image only); no shape geometry |
| Layer | rotation and opacity |
| Paint | no material fields (`supportsPanelFields` returns false); the glass control is present and **refused with its reason** |
| Spends | read-only: one line per distinct descendant paint token, one per distinct descendant type preset |

**The reconciled grouping is binding.** `angle` is Layer's rotation field; Position carries X/Y, W/H and the bleed mark. §6's ruling remains unchanged: a card is inspected as a group, no per-card column, and the sensor question belongs to the child carrying the binding.

### Review correction — the table is now reconciled

The docs review corrected §6 in place: Position includes the bleed mark and
rotation belongs to Layer. The inventory above is evidence, not a standing
licence for this plan to contradict the spec. A regression that already passes
before the rewrite is a preserved contract; do not claim its first run must
fail merely because a new assertion was added.

## What this plan composes from plans 1 and 2

Plan 1 (`2026-10-08-gates-and-the-control-set.md`) lands the gates and the control set; plan 2 (`2026-10-08-the-shell-and-the-rail.md`) lands the shell and re-parents the panes. **Step 1 of execution, before any edit, is to reconcile this plan against what actually landed** and to record in the first commit message what the reconciliation found:

1. Read plan 1's Task 3 section, then read the landed `packages/editor/src/components/ui/` — the control set and `InspectorSection` with their **prop signatures as landed**. Where the landed signature and plan 1's Task 3 section disagree, **the landed signature wins** and this plan is wrong. Task 1 below needs one thing its list does not carry (a `data` passthrough — see Task 1 Step 3); if the landed control already forwards unknown props or accepts `data`, use it and delete the extension step.
2. Read the landed `@theme static` block in `editor-shell.css` and `scripts/design-tokens.mjs` / `design-tokens.gated.json` — the token names, the guard's invocation and its `--gated` argument, and the current gated list. If plan 1 recorded a decision for the guard under `docs/decisions/`, that note wins over plan 1's Task 2 section.
3. Read the landed plan 2 diff: whether `pane-bar.tsx` is gone, what `shell-layout.tsx`'s `<aside className="editor-shell-inspector">` holds now, whether `ShellHosts.selection` still exists, and whether the column is 276px. **This plan keeps `hosts.selection` and `createSelectionInspector`'s signature** — if plan 2 removed either, say so in the first commit and re-point this plan's Task 1 rather than restoring them.
4. Read the landed `src/web/tests/e2e/design-language.spec.ts` and `docs/evidence/screenshots/README.md`. Task 9 **adds this plan's capture to that file and refreshes the three registered inspector actions**; it does not invent a procedure.

Where plan 1 or plan 2 has not landed a piece this plan consumes, say so in the first commit and hold the dependent step, rather than writing a parallel version of it.

## Global Constraints

- **No behaviour changes** (§2.3). Same fields, same eligibility gates, same refusals, same read-only markers. The instrument is the existing contract tests: the descriptor completeness record (`renderer-core/src/charts/settings-fields.test.ts`, `coverage against the real settings shapes`), the per-kind tests (`selectionKindOf`, `KIND_QUESTIONS` totality — `index.dom.test.ts:1207-1257`), and `supportsPanelFields()`. **Where a test locates imperative internals it is re-pointed at the React surface in the same commit, and a re-pointed locator is shown to fail when the behaviour it guards is disabled before it is trusted.**
- **The `data-vigilia-*` hooks are the DOM contract and they are preserved.** They are read by the unit suites and by the browser specs — `data-vigilia-section` (14 e2e reads), `data-vigilia-panel-fill` (14), `data-vigilia-glass-enabled` (14), `data-vigilia-crop` (10), `data-vigilia-geometry` (9), `data-vigilia-name` (6), the run hooks (10+), and `data-vigilia-nothing-selected`. A hook stays **on the control's own focusable element**, because a suite reads `[data-vigilia-geometry="width"]` and then reads `.value` off it. A hook moved to a wrapper is a broken locator wearing a passing test.
- **The old CSS primitives die with the imperative surface.** `.vigilia-field`, `.vigilia-field-row` and `.vigilia-resolution` have **37 reads** — 23 `.vigilia-resolution` and 5 `.vigilia-field` + 2 `.vigilia-field-row` in `selection-inspector/*.dom.test.ts`, and 4 + 2 + 1 in `tests/e2e/`. They are replaced by plan 1's control structure, and every read is re-pointed in the task that removes the class.
- **No Fabric object is ever mirrored into React.** The column holds a `SelectionView` value and an imperative `SelectionEdits` port. `edits` checks the view's expected target revision against the live target **at call time**, so a stale control cannot mutate a later selection. `renderer-core` stays Fabric- and DOM-free; no new dependency (React 19, Base UI, Tailwind are present; `0038`/`0039` stand).
- **The write funnel stays single.** `index.ts` keeps `target()`, the `write` rules (a text object's authored box, a shape's scale, `applyAuthoredText`, `setCoords`) and `commit()` (one `saveState` per committed edit). §2.3's "one history entry per edit" is an existing invariant, not a new one — the React surface must call `commit()` exactly as often.
- **Scales and roles only.** Every value comes from plan 1's tokens (`--text-*`, `--radius-*`, `--space-*`, `--elev-*`) and the palette roles (bible §4). No hex, no off-scale px. **Every file this plan converts joins `scripts/design-tokens.gated.json` in the task that converts it** — the ratchet is seeded as work lands, never afterwards. The column is elevation 0 (bible §3): no shadow, no blur.
- **Bible §5's control vocabulary is closed.** A field that wants a control the bible lacks amends the bible in the same commit or is not that control. No parallel control is built here.
- **`runs.ts` is 817 lines and 800 is the stop.** The React rewrite of the run editor must **shrink or hold** it, and the task states `git show --stat` for the file in its commit.
- **One owner per concept.** `SETTINGS_SECTIONS` decides section order; `KIND_QUESTIONS` decides what a kind asks; `supportsPanelFields`, `supportsGlassControl`, `canCrop`, `typePresetOf` decide eligibility; `uiCopy.inspectorFields` owns the copy; `chart-manager` owns a chart's fields and answers through the existing `ChartFieldsPort`. Nothing here re-spells any of them.
- **`index.ts` holds or shrinks** (**540** lines today — controller correction after Task 1; this said 655, which was never measured — and the surface moves out of it). No licence headers; comments are 1–3 lines and explain *why*. 500 lines is a signal and 800 is a stop.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled. Refuse invalid numeric input rather than coercing it to zero.
- Run from `src/web/`; the scripts are `package.json`'s. Stage explicit paths; never `git add -A`. Conventional Commit titles.
- **Playwright previews built bundles.** Rebuild after any source change and after reverting a deliberate break. `VIGILIA_CAPTURE=1` and `--workers=1` for any capture; capture only actions registered in `docs/evidence/screenshots/README.md`.
- **A new test must be shown to fail when the behaviour it guards is disabled**, before it is trusted. Every task below states its red proof.
- **The register.** `vg-121`, `vg-122` and `vg-089` are already `verified` in `docs/product/backlog-archive.jsonl`; this plan re-closes nothing. `vg-094` and `vg-153` are the Tokens pane's (spec §5.3) and stay open. **`vg-148` is this plan's to close** — the projection's subscription is rebuilt in Task 1, and the lock notify that row names is added there. `vg-158` stays open (its cause is not established), as do `vg-160`, `vg-185` and `vg-192`. Say in the commit which half of which row the commit answers.

## Review Focus

The spec implies these and no task's tests exercise them. Each is pinned to the task that owns its code.

1. **A React tree that quietly holds a Fabric object.** The invariant is the whole decision (ADR-0039). The shortcut is a `useState<FabricObject>` or an object passed through props so a control can read `object.opacity` — it works, and it makes two sources of truth for the scene. JSON round-trip is one check, not the entire guard: inspect prototypes recursively and reject Fabric objects, DOM nodes, functions and non-finite numbers. A value-only check cannot see Fabric objects hidden in React props, closures or edit ports; review those boundaries too. → Task 1.
2. **A section order decided in JSX rather than by `SETTINGS_SECTIONS`.** The data plan's order test passes while the React tree renders Layer above Content. A field-level test cannot see an order. → Task 2.
3. **A run editor remounted on every render.** `focusedControl`/`restoreFocus` exist today (`index.ts:239-262`) precisely because a re-render replaced the focused input, and remounting a run row drops the caret mid-typing and re-fires the bindings port. → Task 3.
4. **Collapsing Position by default while every geometry helper drives a now-hidden input.** The repair temptation is to stop collapsing, which drops the spec's own rule. The fix is in the shared driver. This recurs here because the React rewrite rebuilds the section. → Task 4.
5. **A glass refusal that reaches nobody.** Today the reason is a tooltip attached to the trigger; bible §5.3 says a refused control **renders, greyed, with its reason available in the row**, and plan 1's `refused` prop is that rule. A tooltip-only refusal passes a unit test that reads the attribute. → Task 5.
6. **A read-only section that renders as a control.** Bible §5.1: a border means editable. `Spends` rows must be label + mono value, baseline-aligned, no well. A parity screenshot reads as "styled"; a test cannot see the difference between a well and a row. → Task 6.
7. **A locator re-pointed by label rather than by hook.** 37 class reads die; a re-pointed locator that finds the new control by its visible label can match a *different* field — `W`/`H`, `Fill`, `Rotation` all exist beside others. Each re-pointed locator is proven red first. → Task 7.
8. **A ratchet seeded to pass.** A gated list that names files which still violate, or a run over an empty list reporting success, is the guard's own defect (`vg-149`'s shape). → Task 8.
9. **A parity capture of the old column, or an empty difference list.** The three registered inspector captures must be re-run against the rebuilt bundle; a `--grep` matching nothing exits 0, and an empty diff is a finding rather than a pass. → Task 9.

---

## Phase 1 — The boundary and the five sections

The column becomes React behind its existing signature; the surface it renders becomes a value; the five sections become plan 1's `InspectorSection`.

### Task 1: The projection is a value, and React renders it

**Outcome:** `createSelectionInspector(host, options)` keeps its signature and creates a React root inside `host`; a serializable `SelectionView` is projected from Fabric on demand and published to a store React subscribes to; the column opens with the subject (name at `--text-md`, one line naming its kind) and, with nothing selected, one line saying where to choose from. No Fabric object is reachable from React.

**Owning symbols/landmarks:** `selection-inspector/index.ts` (`createSelectionInspector`, `SelectionInspector`, `target`, `write`, `commit`, `stillTarget`, `bound`, `restoring`, the seven canvas listeners at `:502-524`), new `selection-inspector/view.ts` (`SelectionView`, `projectSelection`), new `selection-inspector/inspector.tsx` (the React root and the store), `editor-session.ts:359` (the one construction site), `aside.editor-shell-inspector` in `shell-layout.tsx`.

**Files:**
- Create: `packages/editor/src/selection-inspector/view.ts`, `packages/editor/src/selection-inspector/view.test.ts`, `packages/editor/src/selection-inspector/inspector.tsx`, `packages/editor/src/selection-inspector/inspector.dom.test.tsx`
- Modify: `packages/editor/src/selection-inspector/index.ts`, `packages/editor/src/selection-inspector/index.dom.test.ts`, `packages/editor/src/editor-session.ts`, `packages/editor/src/editor-shell/editor-shell.css`
- Modify: `scripts/design-tokens.gated.json` (add every file this task converts)
- Modify: `packages/editor/src/object-lock-manager/index.ts` and its existing tests only for the lock-change notification Task 1 Step 5 requires

**Interfaces:**
- Consumes: plan 1's `components/ui/` (Task 2 below is its first real consumer); plan 2's `<aside className="editor-shell-inspector">` and the 276px column.
- Produces:

```ts
// view.ts — the column as a value. Every leaf is a primitive, an array or a
// plain object, so a test can round-trip it through JSON and a renderer can
// diff it. A FabricObject here would be the one thing ADR-0039 forbids.
export interface SelectionView {
  readonly targetRevision: number;
  readonly subject: { readonly name: string; readonly kindLine: string } | undefined;
  readonly locked: boolean;
  readonly sections: readonly ColumnSectionView[];
}
export interface ColumnSectionView {
  readonly id: ColumnSectionId;
  readonly title: string;
  readonly readOnly: boolean;
  readonly defaultOpen: boolean;
  readonly fields: readonly FieldView[];   // flat, one control each
  readonly extras: readonly ExtraView[];   // the sub-surfaces that are not one control
}
export type FieldView =
  | { readonly id: string; readonly control: "text";    readonly label: string; readonly value: string;  readonly refused?: string }
  | { readonly id: string; readonly control: "number";  readonly label: string; readonly value: number; readonly unit?: string; readonly refused?: string }
  | { readonly id: string; readonly control: "toggle";  readonly label: string; readonly checked: boolean; readonly refused?: string }
  | { readonly id: string; readonly control: "select";  readonly label: string; readonly value: string; readonly options: readonly { readonly id: string; readonly name: string }[] }
  | { readonly id: string; readonly control: "slider";  readonly label: string; readonly value: number; readonly min: number; readonly max: number }
  | { readonly id: string; readonly control: "segmented"; readonly label: string; readonly value: string; readonly options: readonly { readonly id: string; readonly name: string }[] }
  | { readonly id: string; readonly control: "swatch";  readonly label: string; readonly value: string }
  | { readonly id: string; readonly control: "readOnly"; readonly label: string; readonly value: string };
/** The four sub-surfaces that are not one control. Each names one React
    component in this family; no other kind is added without amending this. */
export type ExtraView =
  | { readonly kind: "runs"; readonly nodeId: string }
  | { readonly kind: "crop" }
  | { readonly kind: "chartContent" }
  | { readonly kind: "chartPaint" };
export type ProjectionPorts = Pick<ColumnContext,
  "globals" | "locale" | "nodeBindings" | "sampleSource"> & {
  readonly geometry: Pick<GeometryPort, "read" | "measuredEdge">;
};
export function projectSelection(
  target: FabricObject | undefined,
  targetRevision: number,
  ports: ProjectionPorts,
): SelectionView;
```

  The read context reuses the existing column context, not an injected copy of
  every pure predicate. Import `selectionKindOf`, `KIND_QUESTIONS`,
  `supportsPanelFields`, `supportsGlassControl`, `canCrop`, `typePresetOf` and
  `paintReferencesOf` directly from their owners. `ProjectionPorts` is the
  read-only context in `view.ts`: `geometry` uses
  `Pick<GeometryPort, "read" | "measuredEdge">`; `globals`, `locale`,
  `nodeBindings` and `sampleSource` use the existing `ColumnContext` types.
  Pure readers stay direct imports; no injection wrapper is added for them.
  Task 3a extends this context with its finalized value-returning chart port;
  do not carry the old `HTMLElement[]` port into a view. The selected/crop/history
  target is resolved by `index.ts`'s existing `target()` and passed explicitly
  into the projection; it must not independently select a target. No write
  function or DOM element enters the serializable view.

```ts
// index.ts owns the edit dispatcher; view.ts owns this React-facing contract.
export interface SelectionEdits {
  readonly commit: (
    expectedRevision: number,
    fieldId: string,
    value: string | number | boolean,
  ) => boolean;
}
```

  `SelectionView` also carries a primitive `targetRevision: number`. It is an
  inspector-local identity token, incremented when the described target is
  replaced, cleared, removed, rehydrated by history or changed by crop context.
  A target can be an `ActiveSelection`; a document id alone cannot identify it.
  Every edit checks this token against the current target and rechecks lock,
  eligibility and value bounds **before** invoking the existing write funnel.
  A mismatch publishes the new view and returns false, with no mutation and no
  history. Merely resolving the *current* target at commit time would write an
  old draft into a newly selected object. Required proof: type into A, select B,
  fire A's queued blur; neither A nor B changes. Also cover deselect, deletion,
  undo rebuilding the same id, and locking between draft and commit.

  and, in `inspector.tsx`:

```tsx
export function createInspectorRoot(host: HTMLElement): {
  readonly publish: (view: SelectionView, edits: SelectionEdits) => void;
  readonly destroy: () => void;
};
```

  Reuse the existing inspector test fixture for target, globals and geometry.
  Do not introduce an undefined `editorWith`/`ports` helper or cast a partial
  object to `EditorInteraction` to force a proposed signature to compile.
  The first task finalizes this boundary from the actual existing owners
  before downstream task dispatch.

- [ ] **Step 1: Write the invariant test first — the projection carries no Fabric object**

`view.test.ts`:

```ts
// Test the landed signature after the read-context reconciliation above.
// Populated selection: recursively assert plain values and finite numbers;
// round-trip a JSON-compatible representation without undefined-valued keys.
// Empty selection: subject is undefined and sections is empty.
// Undefined is valid TS state but JSON omits it; raw equality is not a valid
// no-Fabric-object proof for an object that deliberately contains undefined.
```

Run: `npx vitest run packages/editor/src/selection-inspector/view.test.ts`
Expected: **FAIL** — `projectSelection` does not exist.

- [ ] **Step 2: Build the projection, moving the read rules out of `index.ts`, not rewriting them**

`projectSelection` owns **reads only**, and it reads through the owners: `selectionKindOf`/`KIND_QUESTIONS`, `supportsPanelFields`, `supportsGlassControl`, `canCrop`, `typePresetOf`, `paintReferencesOf`, `SETTINGS_SECTIONS`. The geometry values come through the **same `GeometryPort`** the column already takes (`per-kind-column.ts:166`), so `readField`/`authoredBoxOf`/`measuredEdgeOf` move to the projection rather than being re-derived. The crop session's target stays the exception it is today (`target()` checks `editor.cropManager.target` first).

The subject's `kindLine` is a **new string about an existing fact**, so it is one line in `uiCopy.inspectorFields` naming the kind and, where a binding exists, the key it carries — the §6 trade is what it makes true. It is not a new capability.

- [ ] **Step 3: Give the control set one optional `data` passthrough, in the same commit**

Plan 1 now defines `ControlProps.data` as full `data-*` attribute names and forwards it onto the actual focus target. Consume that contract; if the landed implementation lacks it, reconcile plan 1's delivery rather than defining another spelling here. The hook is not the field identity: `data-vigilia-geometry` names several values, and run fields repeat per run. `FieldView` must carry a stable field id, full data attributes, validation/domain metadata and a target revision; run rows also carry their existing run id. Read-only rows put hooks on their value element, never an invented focusable control.

- [ ] **Step 4: Mount React inside the host, and keep the session's contract**

`index.ts` keeps `createSelectionInspector` and the returned `SelectionInspector` (`root`, `render`, `setGlobals`, `setLocale`); internally `render()` becomes "re-project and publish" for the subject, and `setGlobals`/`setLocale` do the same. **Controller correction after Task 1:** the five field sections keep rebuilding their DOM until their own tasks convert them, because their builders still return `HTMLElement`s and Step 7 requires the family suite to pass — so Task 1 mounts React in a `reactHost` above a sibling `sectionsHost` and `render()` stops rebuilding DOM only when Task 2's `column.tsx` owns both. The seven canvas listeners (`index.ts:502-524`) and the `restoring` flag's `try`/`finally` stay exactly as they are — they now call `publish()` instead of `render()`. `root` stays the `<section data-vigilia-panel="selection">` element so `[data-vigilia-panel="selection"]` keeps resolving.

- [ ] **Step 5: Close `vg-148` — the projection publishes on a lock change**

`vg-148` measured that locking through the layer row leaves the column offering its writing fields, and named the cause: `object-lock-manager/index.ts:74-81` fires **no canvas event**, and the inspector renders only on canvas events. The projection is rebuilt in this task, so the fix is here: **the lock manager notifies**. Add the notify at the manager (one call, its own owner) and one assertion — lock from the layer row, and the next published view carries `locked: true` with no writing field. If the landed bridge already notifies on lock, use that instead and say so.

- [ ] **Step 6: Build the subject block and the empty state**

The subject: the name at `--text-md` and the kind line at `--text-xs` in `--muted`, in a block with a 1px `--edge` bottom border — not a chrome label (bible §7.4: "The column opens with the subject, not a chrome label"). Empty: one line carrying `data-vigilia-nothing-selected`, the text from `uiCopy.inspectorFields.nothingSelected` (it exists and is already the string), and zero `[data-vigilia-section]`. The locked note stays (`uiCopy.inspectorFields.locked`) and still prints above the sections.

- [ ] **Step 7: Run the suite to green and prove the invariant is not vacuous**

```bash
cd src/web
npx vitest run packages/editor/src/selection-inspector/
```
Expected: PASS. Then the red proof for Review Focus 1: make `projectSelection` return the live object in a field (e.g. `value: object` for one row) and confirm **the round-trip test fails**. Restore it. Then the red proof for Step 5: remove the lock notify and confirm **the `vg-148` assertion fails**. Restore it.

- [ ] **Step 8: Ratchet, verify, commit**

Add the converted files to `scripts/design-tokens.gated.json`, `npm run design:check ; echo "EXIT=$?"` (expected 0), `npm run build`, then commit. Name `vg-148`'s closing check in the message.

---

### Task 2: The five sections are `SETTINGS_SECTIONS`, in its order

**Outcome:** The column renders Content, Position, Layer, Paint and Spends as plan 1's `InspectorSection`, in the order `SETTINGS_SECTIONS` decides; a section with nothing in it is not rendered at all; Position is the one section closed by default; re-rendering does not collapse a section the author opened.

**Owning symbols/landmarks:** `per-kind-column.ts` (`ColumnSectionId`, `ColumnSection`, `defaultOpenOf`, `sectionOrder`, `titleOf`, `perKindColumn`, `context.sections`), `index.ts`'s `sections` map, `editor-shell/controls/property-section.ts` (one of its two remaining consumers), `.vigilia-section*` / `[data-vigilia-section]` in `editor-shell.css`.

**Files:**
- Create: `packages/editor/src/selection-inspector/column.tsx`, `packages/editor/src/selection-inspector/column.dom.test.tsx`
- Modify: `packages/editor/src/selection-inspector/per-kind-column.ts`, `packages/editor/src/selection-inspector/view.ts`, `packages/editor/src/selection-inspector/index.dom.test.ts`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 1's `ColumnSectionView`, plan 1's `InspectorSection({ id, title, readOnly, defaultOpen, children })`.
- Produces: `function SelectionColumn(props: { readonly view: SelectionView; readonly edits: SelectionEdits }): React.JSX.Element`. `perKindColumn`'s return type changes from `readonly ColumnSection[]` (each carrying a live `root`) to `readonly ColumnSectionView[]` — the section handles map dies with the DOM it existed for, because React now owns the open state. **Controller correction (rulings A–C, in the ledger):** `SelectionView` stays DOM-free, because Review Focus 1's round-trip guard walks it, so the section bodies are handed to React *beside* the view rather than through it — React owns the chrome and `index.ts` mounts each section's existing body elements into a per-section container until Tasks 3–6 convert them.

- [ ] **Step 1: Measure the before-state, so the change is counted rather than described**

```bash
cd src/web
grep -rn "data-vigilia-section\|vigilia-section" packages/editor/src tests/e2e | wc -l
grep -c "" packages/editor/src/selection-inspector/index.ts packages/editor/src/selection-inspector/per-kind-column.ts
```
Record both numbers in the commit message — they are the before-state.

- [ ] **Step 2: Write the failing test for the order and the empty-section rule**

`column.dom.test.tsx`:

```tsx
it("renders the five questions in the order SETTINGS_SECTIONS decides", () => {
  const ids = renderedSections(viewOf(rect)).map((el) => el.dataset["vigiliaSection"]);
  expect(ids).toEqual(SETTINGS_SECTIONS.map((s) => s.id));   // not a hard-coded list
});
it("renders no header at all for a section with nothing in it", () => {});
it("starts Position closed and every other section open", () => {});
it("keeps the section the author opened across a re-publish", () => {});
```

Run: `npx vitest run packages/editor/src/selection-inspector/column.dom.test.tsx`
Expected: **FAIL** — the module does not exist.

- [ ] **Step 3: Build the column, and take the order from the owner**

`column.tsx` maps `view.sections` **in the order the projection gives it** — it does not sort, group or re-order. `perKindColumn` keeps `sectionOrder` reading `SETTINGS_SECTIONS`, so Review Focus 2's failure is caught by writing the assertion against `SETTINGS_SECTIONS` rather than against a literal list.

Each section renders its `fields` and `extras` (both empty at this task) **plus the imperative body it is handed**, which `index.ts` mounts into a per-section container — the "and nothing else" clause becomes true only as Tasks 3–6 empty the bodies. `data-vigilia-section="<id>"` sits on the section element. **Controller correction (ruling B, in the ledger):** emptiness is the projection's decision, not React's — `perKindColumn` already filters `body.length > 0`, and React renders exactly the sections it is given, in the order given. Do **not** add a React-side `fields.length + extras.length === 0` rule: at this task `fields` is empty by construction, so that rule blanks the whole column, and it makes React a second owner of a rule the projection owns. The count is preserved: `ColumnSectionView` gains `readonly count: number`, carried straight from today's `ColumnSection.count` (`per-kind-column.ts:66` — it is the body's length and the projection already computes it), and `inspector-section.tsx` gains an optional `count?: number` the header prints — because a collapsed section must keep saying how much it holds (`index.dom.test.ts:754` guards it, and the fixture page cannot, because it renders the same component). `defaultOpen: false` for `position` and `advanced` only, unchanged from `defaultOpenOf`.

**The `advanced` member is latent and stays.** `ColumnSectionId` includes `"advanced"` and `perKindColumn` never emits it; the chart family's own collapsed field is mounted by `chart-manager`, not here. Keep the member and say in the comment that it is unmounted, rather than deleting a vocabulary member a caller may mount — deleting it is a behaviour change dressed as tidying.

- [ ] **Step 4: Re-point the section locators in the same commit**

`index.dom.test.ts`'s `describe("the column's sections")` block (`:672-920`) reads `[data-vigilia-section]`, `.vigilia-field` and the section handles. Re-point each to the React surface: the hook stays, the class locators move to the control's own structure, and the "keeps the sections the author opened across a re-render" case (`:726`) becomes "across a re-publish" — it is the same assertion against the new mechanism.

- [ ] **Step 5: Red proofs**

Empty the `fields`/`extras` of one section in the projection and confirm **the empty-section case fails**. Restore. Render a hard-coded order instead of `SETTINGS_SECTIONS` and confirm **the order case fails**. Restore. Make the open state a `useState` keyed by nothing so a re-publish resets it, and confirm **the keep-open case fails**. Restore.

- [ ] **Step 6: Ratchet, verify, commit**

Gated list, `npm run design:check ; echo "EXIT=$?"` (expected 0), `npm run build`, `npx vitest run packages/editor/src/selection-inspector/`, then commit.

---

## Phase 2 — The writing sections

Content, Position, Layer and Paint stop building DOM and start returning `FieldView`s whose `id` is the hook the suites already read.

### Task 3: Content and Layer — the subject's own fields, and a text object's runs

**Outcome:** Content renders the name field, a text object's run editor and a chart's own content fields; Layer renders rotation and opacity. Every row is a plan-1 control carrying its existing `data-vigilia-*` hook on its own focusable element.

**Owning symbols/landmarks:** `appearance.ts` (`createNameField`, `createOpacityField`, `createResolutionLine`, `createTypePresetReveal`), `runs.ts` (817 lines — `createRunEditor`, `RunBindingPort`), `per-kind-column.ts` (`contentBody`, `layerBody`, `rotationField`), `index.ts`'s `focusedControl`/`restoreFocus`, `chart-manager`'s `ChartFieldsPort.content`.

**Files:**
- Create: `packages/editor/src/selection-inspector/runs.tsx`, `packages/editor/src/selection-inspector/runs.dom.test.tsx`
- Modify: `packages/editor/src/selection-inspector/appearance.ts`, `packages/editor/src/selection-inspector/per-kind-column.ts`, `packages/editor/src/selection-inspector/view.ts`, `packages/editor/src/selection-inspector/index.dom.test.ts`, `packages/editor/src/selection-inspector/runs.dom.test.ts` (re-pointed)
- Delete: `packages/editor/src/selection-inspector/runs.ts` **only if** the React module fully replaces it in this commit; otherwise keep it and say so
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 1's `FieldView`/`ExtraView` and `SelectionEdits`; plan 1's `ControlText`, `ControlSwatch`, `ControlWell`, `ControlSelect`, `ControlNumber`, `ControlSlider`, `ControlToggle`, `ControlSegmented`. Number clearing and slider preview/cancel use plan 1's exact callbacks, with target-revision checks on every write.
- Produces: `FieldView`s carrying the hooks `data-vigilia-name`, `data-vigilia-geometry="angle"`, `data-vigilia-opacity`; and `<RunEditor nodeId={…} edits={…} />` rendering the hooks `data-vigilia-runs`, `data-vigilia-run-source`, `data-vigilia-run-format`, `data-vigilia-run-preset`, `data-vigilia-run-colour`, `data-vigilia-run-text`, `data-vigilia-run-zone`, `data-vigilia-run-unit-display`, `data-vigilia-run-format-preview`, `data-vigilia-run-add`, `data-vigilia-run-remove`.

- [ ] **Step 1: Write the failing test for the two rules that are defects, not style**

```tsx
it("keeps the caret in the field being typed into across a re-publish", () => {});
it("does not put focus back on a control that only toggles", () => {});
it("still refuses a name past the published bound rather than storing it", () => {});
it("adds and removes a run without the editor losing its own state", () => {});
```

Run: `npx vitest run packages/editor/src/selection-inspector/runs.dom.test.tsx`
Expected: **FAIL** — the module does not exist.

- [ ] **Step 2: Rewrite the run editor as React, and make it shrink**

The run editor is the one sub-surface the row union cannot express, so it stays bespoke and is the only `ExtraView` with its own component in this task. `runs.ts` is at the 800-line stop: the React version must **not grow it**, and the commit carries `git show --stat` for the file. The caret rule moves from `focusedControl()`/`restoreFocus()` in `index.ts:239-262` to React's own control identity, keyed by the hook — the same requirement, expressed by the mechanism that replaced the one it was written for. Keep the distinction the source comment records: **a caret-bearing field is restored; a checkbox is not**, because `focus` is what opens the glass control's reason popup.

- [ ] **Step 3: Move the Content and Layer rules into the projection**

`createNameField`, `createOpacityField` and `rotationField` return values instead of elements. One history entry per committed edit is preserved: the projection's `edits` dispatcher calls the same `commit()` (`index.ts:417`).

- [ ] **Step 4: Re-point the Content and Layer locators in the same commit**

`index.dom.test.ts:140-380` and `:594-671` read `.vigilia-field`, `.vigilia-field-row`, `data-vigilia-name`, `data-vigilia-geometry="angle"`, `data-vigilia-opacity`, `data-vigilia-reveal-type-presets`, and the run hooks. Every read is re-pointed in this commit; each re-pointed locator is proven red in Step 5.

- [ ] **Step 5: Red proofs**

Remove the caret restoration and confirm **the caret case fails**. Restore. Let a checkbox claim focus restoration and confirm **the toggle case fails**. Restore. Widen the name bound so a too-long name stores, and confirm **the name case fails**. Restore. Commit a field outside `edits` (write straight to a stub) so `saveState` is not called, and confirm **the one-history-entry case fails**. Restore. Then the Review Focus 7 proof: re-point one locator by its visible label to a *different* field of the same shape (`H` beside `W`) and confirm it now asserts the wrong control — that is what "re-pointed by name" means, and it is why the hooks survive.

- [ ] **Step 6: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/selection-inspector/`, then:
```bash
npx playwright test --project=desktop-chromium --grep "inspector|selection" --workers=1
```
Read the summary and confirm the tests you named ran — a `--grep` matching nothing exits 0. Then commit with `git show --stat` for `runs.*`.

---

### Task 3a: Chart Content and Paint — complete the React boundary

**Outcome:** Chart UI no longer returns `HTMLElement[]` into a React inspector.
Chart descriptors, binding validation, family limits, series ordering and
mutations remain chart-owned; only rendering moves. This is part of Phase 2,
not a second active plan.

**Owns:** `chart-manager/panel.ts`, its existing tests,
`editor-shell/controls/settings-field.ts`'s chart consumers,
`chart-manager/index.ts`'s field-port adapter,
`selection-inspector/per-kind-column.ts`'s `ChartFieldsPort`, and the new
chart-owned React field renderer. Add these exact owners to this phase's file
list; do not put chart mutation rules in the generic inspector dispatcher.

- [ ] Inventory Content and Paint for gauge, line, bar and pie from the
  pre-plan source: every descriptor, nested path, visibility predicate,
  optional value, series binding, add/remove refusal and paint reference.
- [ ] Replace both HTMLElement-returning port contracts together with
  serializable field views plus chart-owned commands. Keep the existing getter
  semantics so a document mount uses the current manager. Reconcile exact
  signatures with Task 1 before dispatch; no DOM island or `innerHTML` adapter.
- [ ] Render descriptors through plan 1's controls. Preserve nested-path
  commits, repeat-row identity, optional-key clearing and one history boundary.
  Disabled values cannot invoke commands. Every descriptor visible in the
  pre-plan state has a rendered, named control in the same state afterward.
- [ ] Prove in existing chart/inspector tests: all four families, nested
  settings surviving save/reopen, add/remove and minimum-series refusals,
  colour references, invalid numeric drafts and stale-target rejection.
  Descriptor completeness alone proves no DOM wiring. Break one rendered
  descriptor and one nested commit separately; each relevant test must fail.
- [ ] Rebuild, run focused chart-manager and selection-inspector suites, then
  chart-inspector browser journeys and graphite/editorial captures. Count no
  hand-authored native select/range in chart surfaces. Update ownership and
  ratchet paths in the same task; remove old builders only after last consumer.

### Task 4: Position — geometry, crop, the bleed mark, a shape's own fields

**Outcome:** Position renders the X/Y pair, the W/H pair, the size-disagreement line, the crop row, the bleed mark and the shape's own geometry (sides, points, ends, path, sweep angles), through the control set; it starts closed and opening it reveals the same numbers as before.

**Owning symbols/landmarks:** `per-kind-column.ts` (`positionBody`, `pair`, `writeGeometry`, `MIN_DIMENSION`, `GEOMETRY_LABELS`, `sizeDisagreement`), `index.ts` (`readField`, `write`, `authoredBoxOf`, `measuredEdgeOf`, `writeAuthoredBox`, `isTextObject`), `bleed.ts` (`createBleedField`, `writeMark`, `clearMark`), `crop.ts` (`createCropRow`, `canCrop`), `panel.ts` (`createShapeGeometryFields`, `hasSweep`, `MIN_POLYGON_SIDES`, `MAX_POLYGON_SIDES`, `MIN_POLYLINE_POINTS`, `MIN_SWEEP_DEGREES`, `MAX_SWEEP_DEGREES`, `adoptGeometry`), `editor-shell/controls/linked-pair.ts` (whose other consumers are `artboard-panel.ts` and `new-document-chooser.ts` — it stays).

**Files:**
- Modify: `packages/editor/src/selection-inspector/per-kind-column.ts`, `packages/editor/src/selection-inspector/index.ts`, `packages/editor/src/selection-inspector/bleed.ts`, `packages/editor/src/selection-inspector/crop.ts`, `packages/editor/src/selection-inspector/panel.ts`, `packages/editor/src/selection-inspector/index.dom.test.ts`, `packages/editor/src/selection-inspector/panel.dom.test.ts`, `packages/editor/src/selection-inspector/bleed.dom.test.ts`, `packages/editor/src/selection-inspector/crop.dom.test.ts`
- Modify: `packages/editor/src/selection-inspector/view.ts`
- Modify: `src/web/tests/e2e/rebuild-driver.ts` (the shared geometry driver — see Step 4)
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 1's `FieldView` and `SelectionEdits`; the existing `GeometryPort` unchanged.
- Produces: `FieldView`s carrying `data-vigilia-geometry="left|top|width|height"`, `data-vigilia-crop*`, `data-vigilia-bleeds`, `data-vigilia-shape-sides|points|path|line|angle`, and the `data-vigilia-resolution` line for the size disagreement.

- [ ] **Step 1: Write the failing test for the pairing and the refusal**

```tsx
it("pairs X/Y and W/H on one row each, and rotation stands alone", () => {});
it("commits only the edited half, leaving a fractional sibling alone", () => {});
it("refuses a dimension below one unit rather than making the object vanish", () => {});
it("offers a group no crop, and a group's Position carries the bleed mark", () => {});
```

Run: `npx vitest run packages/editor/src/selection-inspector/panel.dom.test.ts`
Existing group/bleed behaviour may already pass; record that as preserved baseline. The rewrite's new pairing/wiring assertions fail only if the required new treatment is absent. A later deliberate removal of bleed must fail its regression check.

- [ ] **Step 2: Move the write rules into the dispatcher, and keep every one**

`write` (`index.ts:370-414`) keeps its four branches verbatim: a text object's width/height write `vigiliaText.box` and re-run `applyAuthoredText`, a shape's scale, `setCoords()` at the end. The dispatcher resolves `target()` at call time and refuses through `stillTarget` — **the stale-event refusal survives**, and the test at `index.dom.test.ts:575` is the control.

- [ ] **Step 3: Keep the size-disagreement line, and keep it quiet**

The line exists because a text object's Size field shows the authored box while the object draws a different edge (`index.ts:72-113`). It stays, it keeps `data-vigilia-resolution="size"`, and it reads as a note in `--muted` — not a control (bible §5.1's "a border means editable").

- [ ] **Step 4: Open the collapsed section in the shared driver, not by un-collapsing it**

Position is closed by default and every geometry helper drives an input inside it. The fix belongs in `tests/e2e/rebuild-driver.ts`'s `place()` and the geometry readers — **not** in `defaultOpen`. `activeGeometry` reads through `window.vigiliaEditorBridge` and never touches a DOM geometry input, so it needs no change; `geometryPairBoxes` and the Size-pair and polygon specs do. This is Review Focus 4, and the archived per-kind plan measured the same thing (`2026-10-06-the-per-kind-inspector.md`, Task 7).

- [ ] **Step 5: Re-point the Position locators in the same commit**

`index.dom.test.ts:177-378` and `:921-1110`, plus `panel.dom.test.ts`, `bleed.dom.test.ts` and `crop.dom.test.ts`, read `.vigilia-field-row`, `[data-vigilia-geometry]`, `[data-vigilia-resolution]`, `[data-vigilia-bleeds]`, `[data-vigilia-crop*]` and `[data-vigilia-shape-*]`.

- [ ] **Step 6: Red proofs**

Break the pairing (render X and its own Y in separate rows) and confirm **the pairing case fails**. Restore. Let each half write its sibling and confirm **the fractional-sibling case fails**. Restore. Make a group's Position drop the bleed mark and confirm **the group case fails** — that assertion preserves the corrected §6 contract. Restore. Collapse Position and confirm the browser geometry spec **fails**, then fix the driver and confirm it passes.

- [ ] **Step 7: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/selection-inspector/`, `npx playwright test --project=desktop-chromium --grep "geometry|inspector" --workers=1`, then commit.

---

### Task 5: Paint — material, and the glass refusal that must reach the author

**Outcome:** Paint renders the panel material fields (fill/ink, stroke, border width, corner radius, shadow, shadow blur, shadow offset) for the ten classes `supportsPanelFields` admits, a chart's own paint fields, and the glass control **present and refused in words** for every kind that cannot carry it — including a group.

**Owning symbols/landmarks:** `panel.ts` (`supportsPanelFields`, `createPanelMaterialFields`, `paintPropertyFor`, `shadowNumber`), `glass.ts` (`createGlassFields`, `supportsGlassControl`, `refusalOf`, `attachReason`, `glassReason`, `treatmentOf`, `writeTreatment`, `clearTreatment`, `VIGILIA_GLASS_PROPERTY`), `per-kind-column.ts` (`paintBody`), `chart-manager`'s `ChartFieldsPort.paint`.

**Files:**
- Modify: `packages/editor/src/selection-inspector/panel.ts`, `packages/editor/src/selection-inspector/glass.ts`, `packages/editor/src/selection-inspector/per-kind-column.ts`, `packages/editor/src/selection-inspector/view.ts`, `packages/editor/src/selection-inspector/glass.dom.test.ts`, `packages/editor/src/selection-inspector/panel.dom.test.ts`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 1's `FieldView` (the `swatch` control is bible §5's *swatch well*), plan 1's `ControlWell`, `ControlNumber`, `ControlToggle`, and `ControlProps.refused`.
- Produces: `FieldView`s carrying `data-vigilia-panel-fill|stroke|border|radius|shadow|shadow-blur|shadow-offset`, `data-vigilia-glass-enabled`, `data-vigilia-glass-blur`.

- [ ] **Step 1: Write the failing test for the refusal**

```tsx
it("renders the glass control refused, with its reason, for a group", () => {
  const row = glassRowFor(groupOf(cardChildren()));
  expect(row.refused).toBe(uiCopy.inspectorFields.glassRefused("group"));   // or the mapped reason
  expect(row.control).toBe("toggle");   // present, not omitted
});
it("offers a rect its material fields and a group none", () => {});
it("keeps a rectangle's corner radius, which no other shape reads", () => {});
```

Run: `npx vitest run packages/editor/src/selection-inspector/glass.dom.test.ts`
Expected: **FAIL** — `glassRowFor` does not exist.

- [ ] **Step 2: Render the refusal in the row, not in a tooltip**

Today the reason is a tooltip (`attachReason`) plus whatever the control shows. Bible §5.3 and bible §10 require the row to **render refused with its reason available**, and plan 1's `refused` prop is `aria-disabled` plus visible text — a disabled control leaves the tab order, so a tooltip-only reason reaches nobody without a mouse. The row keeps its place: **absence and refusal look identical to an author, and only one of them is true.**

`glassReason`'s singleton-handle bookkeeping goes with the tooltip it existed for; if the landed control still attaches a tooltip for the hint, keep `tooltip.ts`'s single-owner rule and pass the same string as the accessible name (bible §6).

- [ ] **Step 3: Keep eligibility asked, never restated**

`supportsPanelFields` and `supportsGlassControl` stay the only predicates; the projection calls them. The two differ on `Polyline`, `Line` and `Path`, and `glass.dom.test.ts` checks the glass set against `supportsGlass` for every kind Fabric ships — that test is the control and must pass unmodified in intent.

- [ ] **Step 4: Red proofs**

Make a group's glass row omit rather than refuse, and confirm **the refusal case fails**. Restore. Widen `supportsPanelFields` to admit `Group` and confirm **the material case fails** (a group would be offered controls that accept an edit and apply none). Restore. Move the refusal text into a `title` attribute only and confirm the case that reads the row's text **fails**.

- [ ] **Step 5: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/selection-inspector/`, then commit.

---

## Phase 3 — Spends, parity and the gate

### Task 6: Spends is read-only, and it looks it

**Outcome:** Spends renders its resolved appearance as label + mono value rows — no well, no border — for a single object (its own paint references and type preset) and for a container (its descendants' distinct paints and presets, or one quiet "none" line), with the type-preset reveal kept.

**Owning symbols/landmarks:** `per-kind-column.ts` (`spendsBody`, `descendantsOf`, `childrenResolution`), `appearance.ts` (`createResolutionLine`, `paintReferencesOf`, `typePresetOf`, `nameOfRef`, `resolveToken`, `resolveTypePreset`, `createTypePresetReveal`), `uiCopy.inspectorFields` (`paint`, `notSet`, `unresolved`, `runPreset`), `index.dom.test.ts:380-533` and `:1321-1400`.

**Files:**
- Modify: `packages/editor/src/selection-inspector/per-kind-column.ts`, `packages/editor/src/selection-inspector/appearance.ts`, `packages/editor/src/selection-inspector/view.ts`, `packages/editor/src/selection-inspector/index.dom.test.ts`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 1's `FieldView` with `control: "readOnly"`, Task 2's `InspectorSection` with `readOnly: true`.
- Produces: read-only rows carrying `data-vigilia-resolution` and `data-vigilia-reveal-type-presets` as today.

- [ ] **Step 1: Write the failing test for the read-only treatment**

```tsx
it("renders Spends as a read-only section, and says so in its header", () => {});
it("renders a resolution row with no editable control", () => {});
it("answers a container with one line per token, not one per child", () => {});
it("still says a container resolves to nothing when none of its children is painted", () => {});
```

Run: `npx vitest run packages/editor/src/selection-inspector/index.dom.test.ts -t Spends`
Expected: **FAIL** — the treatment does not exist.

- [ ] **Step 2: The read-only row, to bible §5.1 and §5.2**

Label in `--muted` sans, value in mono, baseline-aligned, **right-aligned**, sharing the grid with the controls so a section does not change shape. No `ControlWell`, no border: a border means editable. The section header carries the read-only marker, so it is stated **before** the section is opened rather than inferred from absent controls — the same rule `References` keeps under `0030`.

The `unresolved` and `notSet` cases keep their extra length (`appearance.ts`'s `createResolutionLine`); the current long form is preserved, not shortened, because "no longer resolves" is a fact the author needs.

- [ ] **Step 3: Red proofs**

Give one read-only row a well and confirm **the no-editable-control case fails**. Restore. Make the container case answer per child instead of per token and confirm **the dedup case fails** (the existing `:1381` test is the control). Restore. Drop the read-only marker from the header and confirm **the header case fails**. Restore.

- [ ] **Step 4: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/selection-inspector/`, then commit.

---

### Task 7: §2.3 — the parity ledger, and every re-pointed locator proven

**Outcome:** A written ledger, in the commit, of every field each kind rendered before this plan and still renders after, with the instrument for each; every locator re-pointed across Phase 2 is demonstrated to fail when the behaviour it guards is disabled; the three contract instruments the spec names are shown still holding.

**Owning symbols/landmarks:** `index.dom.test.ts`, `panel.dom.test.ts`, `glass.dom.test.ts`, `bleed.dom.test.ts`, `crop.dom.test.ts`, `ink.dom.test.ts`, `runs.dom.test.ts`, `style.dom.test.ts`; `renderer-core/src/charts/settings-fields.test.ts` (checked, not edited); `panel.ts`'s `supportsPanelFields`; `selectionKindOf`/`KIND_QUESTIONS` totality.

**Files:**
- Modify: `packages/editor/src/selection-inspector/*.dom.test.ts` (only where a locator is still imperative)
- Modify: `src/web/tests/e2e/*.spec.ts` (only where a locator is still imperative — `tests/e2e/` belongs to no tsconfig, `vg-192`)
- Modify: nothing in `packages/editor/src/**` production code unless a locator cannot be re-pointed — in which case the fix is in the surface, not the test

**Interfaces:**
- Consumes: every task above.
- Produces: the ledger, and the red proofs it cites.

- [ ] **Step 1: Enumerate the field inventory per kind, from the pre-plan code**

Take the list from `git show <plan-3-base>:` for each file, not from the new code — a list re-derived from the rewrite cannot fail. For each of `SELECTION_KINDS` and for a locked object, list every `data-vigilia-*` hook the pre-plan surface rendered, and assert the rebuilt surface renders a **superset**. This is the spec's own test: *does this change remove a step, or does it remove a freedom?*

- [ ] **Step 2: Keep the three instruments the spec names, unmodified in intent**

- The descriptor completeness record — `renderer-core/src/charts/settings-fields.test.ts` (`coverage against the real settings shapes`): checked, not edited. It proves a settings key has a descriptor; it does **not** prove the inspector renders one. Task 3a changes both `ChartFieldsPort` adapters together and proves each visible descriptor reaches a named React control.
- The per-kind tests — `index.dom.test.ts:1207-1257`: `selectionKindOf` answers for every `SELECTION_KINDS` member, `KIND_QUESTIONS`' keys equal `SELECTION_KINDS`' members, and every kind's example renders a plan. These must pass **unmodified**, because the vocabulary did not change.
- `supportsPanelFields()` — the eligibility owner, unchanged.

- [ ] **Step 3: The locator census**

```bash
cd src/web
grep -rn "vigilia-field\|vigilia-resolution\|vigilia-section\|data-vigilia-" packages/editor/src/selection-inspector tests/e2e | wc -l
grep -rn "vigilia-field" packages/editor/src/selection-inspector tests/e2e | wc -l
```
The second number must be **0** when this task commits: the class primitives are gone. Record both counts.

- [ ] **Step 4: Red proofs for the re-pointed locators**

Take each locator re-pointed in Phase 2 and break the behaviour it guards, in the surface, one at a time — a field that stops committing, a section that stops rendering, a refusal that stops appearing — and confirm **the locator fails**. Restore each. A locator that passes with the behaviour disabled is not a locator, and this step is the plan's whole parity claim.

- [ ] **Step 5: Focused verification, then commit**

```bash
cd src/web
npm run build
npx vitest run packages/editor/src/selection-inspector/ packages/editor/src/editor-session.dom.test.ts packages/editor/src/editor-shell/
npx playwright test --project=desktop-chromium --grep "inspector|selection|geometry|glass" --workers=1
```
Expected: green, and the summary reports the tests you named ran. Commit the ledger (the inventory, the census counts, the contract instruments, the red proofs).

---

### Task 8: The ratchet, and no native control left in the column

**Outcome:** Every file this plan converted is in `scripts/design-tokens.gated.json`, `npm run design:check` exits 0 over them, it still refuses to pass over an empty list, and **no native `<select>` and no native `input type=range` remains in an editor surface the inspector owns**.

**Owning symbols/landmarks:** `scripts/design-tokens.gated.json`, `scripts/design-tokens.mjs`, `npm run design:check`, the control files in `selection-inspector/` and `components/ui/`, `editor-shell.css`'s now-unused `.vigilia-field*` rules.

**Files:**
- Modify: `scripts/design-tokens.gated.json` (the union of every task's additions)
- Modify: `packages/editor/src/editor-shell/editor-shell.css` (delete the `.vigilia-field*` / `.vigilia-resolution` rules whose last consumer this plan removed)
- Modify: `scripts/design-tokens.mjs`'s built-in `--self-test` only if a covering decision amends the guard; no separate self-test file

**Interfaces:**
- Consumes: plan 1's guard and its `--gated` argument.
- Produces: nothing new. This task is a measurement, and its output is the counts in the commit.

- [ ] **Step 1: Measure what this plan converted**

```bash
cd src/web
node -e "const g=require('../../scripts/design-tokens.gated.json');console.log(g.gated.length, g.gated.join('\n'))"
grep -rn "<select\|type=\"range\"" packages/editor/src/selection-inspector packages/editor/src/components/ui | wc -l
grep -c "#[0-9a-fA-F]\{3,8\}" packages/editor/src/editor-shell/editor-shell.css
```
Expected: the gated list holds every file the nine tasks touched; the native-control count is **0**; the `editor-shell.css` hex count is recorded as the before-state for plan 4 — it does **not** go to zero here, because the palettes are hex and the remaining panel families are plan 4's. Record the counts in the commit message.

- [ ] **Step 2: Run the guard, and prove it is not vacuous**

```bash
npm run design:check ; echo "EXIT=$?"
printf '[]' > /tmp/gated.json && node ../../scripts/design-tokens.mjs --gated /tmp/gated.json ; echo "EXIT=$?"
```
Expected: **0**, then **non-zero with a message naming the empty list** — Review Focus 8. A guard over zero files reporting success is the defect `vg-149` is an instance of, and it must still be refused with this plan's list in place.

- [ ] **Step 3: Red proof**

Add a hex literal and an off-scale `px` to a converted file. Expected: **non-zero, naming the file and the value**. Revert, then re-run to green. Then delete the `.vigilia-field` rules and confirm **no test references the class** (`grep` returns 0) — a rule removed while a locator still reads it is a silent break.

- [ ] **Step 4: Commit**

Commit the gated list, the CSS deletion and the counts, and state in the message what is **not** converted yet: the panes (Composition, Add, Tokens, Document), and the artboard, palette and type-preset panels, which are plan 4's. Chart Content/Paint must already be converted by Task 3a; native chart controls cannot be deferred as an exception.

---

### Task 9: The parity capture, beside the mockup

**Outcome:** Built bundles, captured by actions registered in `docs/evidence/screenshots/README.md`, with the column's captures placed beside `docs/design/mockups/inspector-language.html` and `docs/design/mockups/inspector-controls.html`, and every difference either fixed or recorded in the commit as deliberate.

**Owning symbols/landmarks:** `src/web/tests/e2e/design-language.spec.ts` (plan 1's harness), the three registered inspector actions — `editor-inspector-card` / `captures the sectioned column a card gets`, `editor-inspector-shape` / `captures the sectioned column a shape gets`, `editor-inspector-chart` / `captures the chart's column` — in `src/web/tests/e2e/inspector-sections.spec.ts`, and `docs/evidence/screenshots/README.md`'s editor checklist.

**Files:**
- Modify: `src/web/tests/e2e/design-language.spec.ts` (add this plan's capture to the existing harness; do not add a second procedure)
- Modify: `src/web/tests/e2e/inspector-sections.spec.ts` only where a locator moved; the three action names do not change
- Modify: `docs/evidence/screenshots/README.md` only if a new action is registered; the three existing rows stay
- Add: the produced images under `docs/evidence/screenshots/`
- Modify: `docs/design/mockups/inspector-language.html` and/or `inspector-controls.html` **only** where the mockup is stale against the bible — see Step 3

**Interfaces:**
- Consumes: plan 1's harness, its fixture and its registration row; plan 2's shell.
- Produces: the captures that are this plan's completion condition (§13), and the differences list.

- [ ] **Step 1: Write the capture so it fails if the column is not the new one**

The capture selects the starter's card, asserts the subject block leads, asserts the five sections render with Position closed, and asserts a `read-only` `Spends` row has no editable control, then writes the image. Run it with the projection returning no sections and confirm it **fails** rather than producing a picture of an empty column.

- [ ] **Step 2: Prove the run is not vacuous**

```bash
cd src/web
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "the sectioned column a card gets" --workers=1
```
Read the summary and confirm **1 test ran**, not 0. A `--grep` matching nothing exits 0 with zero tests, which is how a parity gate silently stops checking (Review Focus 9).

- [ ] **Step 3: Adjudicate against the bible, and reconcile a mockup only if it is stale**

Read the patched original references. Dark controls and the light target select the gauge chart child, not the card group. The light page's left group column is explicitly historical and is not the target. Retain the original wells, sliders, swatches, fine dividers and compact typography. Editable Content is not read-only; Position is second; Spends carries its marker. Capture the same real selection in both palettes. Prove the group contract separately (name, Position including bleed, rotation/opacity, glass refusal, descendant Spends); no card-level gauge controls or Geometry-at-foot order.

**Capture the dark reference, not only the light one.** `inspector-language.html` holds the palette constant to judge language alone; `inspector-controls.html` is the reference palette. A capture of one palette cannot show a hard-coded hex, so capture both — the light capture is the language comparison and the dark one is where a literal colour would show.

- [ ] **Step 4: List every difference, and account for each**

The expected deliberate differences, each with its reason and what owns it:

- **A different selection's copy.** The mockups name `CPU card` and `cpu.load`; the capture shows the starter's own names. The mockups' copy is illustrative (`README.md` says so).
- **Section captions in the mockup use `Content`/`Layer`/`Paint`/`Spends` over a geometry summary; the column renders no header for a section with nothing in it.** Bible §7.4 rules, and it is the same rule in both, so this may be an *empty* difference — say so as a finding rather than assuming it.
- **Position is second and initially closed in both reference and product.** Its opening reveals X/Y, W/H and the applicable extra fields. Layer owns rotation. A different order is a defect, not a deliberate convenience.
- **Scale, rhythm and mono values are the comparison.** Platform font metrics, scrollbar widths, device pixel ratios and antialiasing are not drift (`README.md`, `docs/evidence/screenshots/README.md`).

**If the list is empty, say so as a finding** with what was compared and which capture could have failed. A gate that produces no comparison has not run (§13.4).

- [ ] **Step 5: Commit**

Commit the spec change, the registration row (if any) and the images together. **Tell the user the images exist before staging them, and inspect them first** (`AGENTS.md`: inspect selected visual evidence before staging).

---

### Task 10: The register and the close

**Outcome:** `vg-148` is `verified` against a check naming a word from its own title and an artefact sha that resolves and is an ancestor of `HEAD`; the rows that stay open say what they wait on; `STATUS.md` names plan 4 as the next work; this plan moves to `archive/`.

**Owning symbols/landmarks:** `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl`, `STATUS.md`, this plan file.

**Files:**
- Modify: `docs/product/backlog.jsonl`, `docs/product/backlog-archive.jsonl` (`vg-148` → `verified`, moved to the archive)
- Modify: `STATUS.md`
- Move: this plan to `docs/superpowers/plans/archive/` once nothing depends on it

**Interfaces:**
- Consumes: Task 1 Step 5's lock assertion and its commit sha.
- Produces: the register's next state.

- [ ] **Step 1: Close `vg-148` the enforced way**

A `verified` row needs a `check` naming a word from its own `title` — `vg-148`'s is about the **lock** leaving the column offering **writing fields** — and `artefacts` naming a sha that resolves and is an ancestor of `HEAD` (`git merge-base --is-ancestor <sha> HEAD`). Both halves, or it is not closed.

- [ ] **Step 2: Say what stays open, and why**

`vg-094` and `vg-153` are the Tokens pane's (spec §5.3, plan 4's) — their rows are untouched by this plan. `vg-158` stays open: its cause is not established (two readings fit the measurement) and the first step is to distinguish them, which is not this plan's task. `vg-160` (the Document pane's `style` marker), `vg-185` and `vg-192` stay open. Grep the archive before filing anything, and add no new row: this plan found nothing that is not already registered.

- [ ] **Step 3: `STATUS.md`, one item per line, never wrapped**

Replace "Last completed change" with 1–5 bullets on this plan's final commit; keep the file to objective, active work, last completed change, next steps and blockers. Run `npm run status:check` from `src/web/` before the commit.

- [ ] **Step 4: Commit and move the plan**

```bash
git add STATUS.md docs/product/backlog.jsonl docs/product/backlog-archive.jsonl
git commit
```
Then move this plan to `docs/superpowers/plans/archive/` in the same commit or its own, and name plan 4 — the panes — as the next work with its landmarks.

---

## Out of scope

Named so a later plan owns them rather than this one growing.

- **The shell, the rail, the panes' chrome, the status bar and the stage's three corners** are plan 2's. This plan changes the *inside* of the 276px right column and nothing around it.
- **The panes' contents** are plan 4: the Composition pane's rows (the kind glyph, the name, the hovered-row affordances), the Add pane rebuilt as React with its card unit tiles (absorbing Assets, `vg-154`), the Tokens pane rebuilt as React with its paint and preset lists (**`vg-153`**, and **`vg-094`**'s selection binding), and the Document pane's four scopes resolved. This plan neither moves nor rewrites them.
- **Chart rules and lifecycle remain chart-owned.** Task 3a rewrites their UI and both field-port contracts; chart scheduling, descriptors and mutation rules are not transferred into the inspector.
- **The artboard panel**, the palette and type-preset panels, and `new-document-chooser.ts` keep their imperative controls. `linked-pair.ts` and `settings-field.ts` therefore survive this plan with consumers left.
- **Settings, the palette chip's move and the rail's gear** are plan 5, with the `publish.*` chord.
- **The closed glyph set, the accessible-name/tooltip single owner and the copy rules** are plan 6. This plan uses the existing tooltip owner and the existing glyphs; it does not close the set.
- **`vg-158`** stays open and is not answered here.
- **No token is deleted from `editor-shell.css`** except the `.vigilia-field*` and `.vigilia-resolution` rules whose last consumer this plan removes; any other token leaves when its last consumer moves.

## Self-review

- **Spec coverage.** §2.1 and §2.2 are Task 1; §6's five sections are Task 2, and §6's per-kind claims are carried by Tasks 3–6 with the two table corrections stated above; §2.3 is Task 7; §9's count is Task 8; §13 is Task 9; §12's row 3 is this document. §1's normative bible is consumed by every task, each citing it rather than restating it.
- **Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every step names a file, a symbol, a command or an expected output.
- **Type consistency.** `SelectionView` is the projection and holds no Fabric object; `ColumnSectionView.fields` and `.extras` are the two row categories and `extras` has exactly four members; `SelectionEdits` dispatches by stable field id and expected target revision, while full `data-*` hooks remain separate DOM metadata; `perKindColumn` returns `ColumnSectionView[]` and no longer holds a `PropertySection` map; `defaultOpen` is false for `position` (and the latent `advanced`) only.
- **Review Focus.** Each of the nine is pinned above to a task, and each is a failure no existing test would catch.
- **Red proofs.** Every task states the break that must fail its own gate, and Task 7 re-proves every re-pointed locator with the behaviour it guards disabled.
- **The register.** `vg-148` closes here; `vg-094`, `vg-153`, `vg-158`, `vg-160`, `vg-185` and `vg-192` stay open; `vg-121`, `vg-122` and `vg-089` are already archived and are not re-closed.
