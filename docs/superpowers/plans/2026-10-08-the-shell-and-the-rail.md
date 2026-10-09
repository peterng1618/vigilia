# The Shell and the Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's two stacked horizontal navigation bars and its floating-card chrome with the shell the mockups specify: a full-width header holding only document- and editor-level commands, a 46px rail of four pane slots with one expanding pane beside it, flat chrome at elevation 0 around a stage whose three corners answer identity, view and selection, and a 26px status bar — built from plan 1's control set, deleting the pane bar and the Insert menu.

**Architecture:** Nothing new is invented: the rail is a React component that owns the slot enumeration today held by `pane-bar.tsx`, the four panes keep the persistent host nodes `029` established (one per pane, moved into React chrome that never renders their content), and the stage's corners are React surfaces reading the bridge's projected snapshot. The imperative panels that already exist are **re-parented** into their new slots, not rewritten: `createPalettePanel` and `createTypePresetPanel` move from `panelHosts.document` into a new `panelHosts.tokens`, and the assets host renders inside the Add pane's body. Fabric stays behind the editor boundary; the shell reads ids, names, counts and eligibility through `bridge.ts` and never holds an object.

**Tech Stack:** TypeScript, React 19, Base UI, Tailwind v4 (`@theme`), Biome 2.x, Vitest (jsdom), Playwright, Node ESM scripts.

**Spec:** [`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`](../specs/2026-10-08-editor-design-language-design.md) — §3, §4, §7, §9, §12 row 2, §13, Invariants, Non-goals
**Normative companion:** [`docs/design/design-language.md`](../../design/design-language.md) — §2, §3, §4, §5, §6, §7, §9, §10
**Reference:** [`docs/design/mockups/editor-shell.html`](../../design/mockups/editor-shell.html), and [`README.md`](../../design/mockups/README.md) for what a mockup is and is not
**Decision:** [`0039`](../../decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)

## What this plan composes from plan 1

Plan 1 (`2026-10-08-gates-and-the-control-set.md`) lands the gates and the control set. **Step 1 of execution, before any edit, is to reconcile this plan against what actually landed** and to record in the first commit message what the reconciliation found:

1. Read plan 1's Task 3 section and then read the landed `packages/editor/src/components/ui/` — the control set and its **prop signatures as landed**. Where the landed signature and plan 1's Task 3 section disagree, **the landed signature wins** and this plan is wrong; a plan that names a prop the components do not have is not executable.
2. Read the landed `@theme static` block in `editor-shell.css`, `scripts/design-tokens.mjs` and `scripts/design-tokens.gated.json` — the token names as landed, the guard's actual invocation, and whether the gated list is still `[]` or already seeded. If plan 1 recorded a decision for the guard (an `NNNN` note under `docs/decisions/`), that note wins over plan 1's Task 2 section, as the landed code wins over it.
3. Read the landed `src/web/tests/e2e/design-language.spec.ts` and the row plan 1 added to `docs/evidence/screenshots/README.md`. Task 9 of this plan **adds its capture to that file**; it does not invent a procedure.

Where plan 1 has not landed a piece this plan consumes, say so in the first commit and hold the dependent step, rather than writing a parallel version of it.

## Global Constraints

- **No behaviour changes.** Same fields, same eligibility gates, same refusals, same read-only markers (`§2.3`). Where a browser spec or a `.dom.test` locates imperative internals this plan moves, **it is re-pointed at the React surface in the same commit**, and a re-pointed locator must be shown to fail when the behaviour it guards is disabled before it is trusted.
- **A control lands with the surface it opens.** The rail's gear opens Settings and the palette chip feeds Settings, so both land in plan 5 with that surface. A gear that opens nothing, or a chip whose only home has not been built, asserts a capability the code does not have (bible §9). This is the one sequencing rule this plan introduces, and it applies exactly twice.
- **A printed chord must run something.** The mockup prints `⌘⇧P` beside `Publish`; no `publish.*` id exists in `PRODUCT_SHORTCUTS` today, and bible §9 forbids a mark that runs nothing. The chord is bound with plan 5's rebinding work; this plan draws the button alone and lists the missing chord as a deliberate difference.
- **Fabric stays imperative and no object is mirrored into React.** The shell reads `bridge.ts`'s projected snapshot on demand. The document's name is a projection, not a scene object.
- **One owner per concept.** `OBJECT_ACTIONS`, `actionEnabled`, `arrangeActions()`, `insertGroups()`, `CARD_LIBRARY`, `SHAPE_KINDS` and `CHART_FAMILIES` keep theirs; every surface renders from them. The rail's slot list is owned by `rail.tsx` (moved from `pane-bar.tsx`); `pane-bar.tsx`'s `RailPane` and `shell-layout.tsx`'s re-export of it are deleted, and nothing re-spells the four slots elsewhere.
- **The one tooltip owner is `editor-shell/controls/tooltip.ts`.** An icon-only control's `aria-label` and its tooltip are the same string (bible §6). React surfaces use it the way `canvas-dock.tsx` does; do not add a tooltip component (`0033`).
- **Scales and roles only.** Every value comes from plan 1's tokens (`--text-*`, `--radius-*`, `--space-*`, `--elev-*`) and the palette roles (bible §4). No hex, no off-scale px. **Every file this plan converts joins `scripts/design-tokens.gated.json` in the same task** — the ratchet is seeded as work lands, never afterwards.
- **No new dependency.** React 19, Base UI and Tailwind v4 are present; `0038` and `0039` stand.
- **Widths follow the content that fills them.** The inspector becomes the bible's 276px here (it is 280px and nothing measured depends on the 4px). The pane **stays 360px** in this plan: that number is `editor-shell.css`'s measured requirement of the *current* layer row, and the row §5.1 specifies replaces it in plan 4. Halving the column now would ellipsise every named row in the starter.
- **The device lens's mechanism is untouched.** `display-lens.ts`, `viewport-manager/`, the media layer and `[data-vigilia-display-screen]` keep their behaviour and their owner; this plan changes where the control *is* and what shape it has, never what it frames.
- **Leave `shell-layout.tsx`'s chord-rule comment alone** (the one beginning "A row names an id only when that binding reaches the same manager"). `vg-185` owns its false premise, and any rewrite of it pre-judges that row.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled. No licence headers; comments are 1–3 lines and explain *why*. 500 lines is a signal and 800 is a stop — `shell-layout.tsx` is 703 before this plan and the extractions below are what keeps it under.
- Run from `src/web/`; the scripts are `package.json`'s. Stage explicit paths; never `git add -A`. Conventional Commit titles.
- **`tests/e2e/` belongs to no tsconfig (`vg-192`), so a bad `openPane(page, "…")` name is caught by nothing but running the spec.** Every re-pointed call site is exercised by a spec in the same task.
- **Playwright previews built bundles.** Rebuild after any source change and after reverting a deliberate break. `VIGILIA_CAPTURE=1` and `--workers=1` for any capture; capture only actions registered in `docs/evidence/screenshots/README.md`.
- **A new test must be shown to fail when the behaviour it guards is disabled**, before it is trusted. Every task below states its red proof.
- **No register row is closed by this plan.** `vg-153` (the palette and type-preset split lands here, its discharge is plan 4's), `vg-154` (the asset pane's home moves here, the merge is plan 4's), `vg-161` (the Insert menu's removal lands here; the row's subject is the unlanded plan's queue status), `vg-172` and `vg-192` stay open. Say in the commit which half of which row the commit answers.

## Review Focus

The spec implies these and no task's tests exercise them. Each is pinned to the task that owns its code.

1. **A locator re-pointed by rename rather than by name.** 73 `openPane` call sites across 15 files move to new slot words, in files no type checker sees (`vg-192`). A name that is wrong for a *correct* pane passes silently and fails much later in an unrelated assertion. → Task 1.
2. **A pane footer that decides eligibility for itself.** `actionEnabled` is the one gate; a footer that filters with its own predicate agrees with the dock until the next action is added to the registry. → Task 2.
3. **A header trimmed by deletion.** The publish surface carries the address, the port, the pairing token, the expiry and the §145 warning; the mockup's chord has no binding. Trimming the header by removing what is awkward loses a fact, and the header is `vg-172`'s subject. → Task 3.
4. **"Numbers only" read as licence to delete the diagnostic.** `DiagnosticMessage` is in the footer and ~40 assertions read `#status` for its text; a refusal with nowhere to land is a capability `§2.3` forbids removing. → Task 4.
5. **An identity chip that invents a name, or two save states that disagree.** The chip must read the same fact `SaveState` reads, and must render nothing rather than a placeholder when no document is open. → Task 5.
6. **A view cluster that swallows a choice the old control offered.** Fit, six lenses, zoom-to-selection and actual size are all reachable today; a chip row that drops one looks finished. → Task 6.
7. **Two halves of the dock drifting from the registry.** Filtered-versus-greyed is a decision the product made; a test that never selects two objects cannot tell the two treatments apart. → Task 7.
8. **A ratchet seeded to pass.** A gated list holding files that violate, or a run over an empty list reporting success, is the guard's own defect (`vg-149`'s shape). → Task 8.
9. **A parity capture of a different screen.** The mockup draws the Add slot open with nothing selected; a capture of the default Composition pane compares two different screens and every difference it lists is spurious. A `--grep` matching nothing exits 0. → Task 9.
10. **A difference list that is empty because nothing was compared.** An empty list is a finding, not a pass. → Task 10.

---

## Phase 1 — The rail and the regions around the stage

The pane bar is deleted and the rail takes its place; each pane gets the bible's chrome; the header loses its document readout and the Insert menu; the status bar becomes the strip `§7.6` describes.

### Task 1: The rail replaces the pane bar

**Outcome:** A 46px rail with four slots — Composition, Add, Tokens, Document — one open at a time, each opening a pane that has content; the horizontal pane bar is gone.

**Owning symbols/landmarks:** `editor-shell/pane-bar.tsx` (deleted, and with it `RailPane` and `shell-layout.tsx`'s re-export of it), new `editor-shell/rail.tsx` (owns `RailSlot` and the slot list), `ShellHosts` and `Shell` in `shell-layout.tsx`, the `panelHosts` wiring in `editor-session.ts`, `.editor-shell-pane-bar*` and `.editor-shell-body` in `editor-shell.css`, `uiCopy.rail`.

**Files:**
- Create: `packages/editor/src/editor-shell/rail.tsx`, `packages/editor/src/editor-shell/rail.dom.test.tsx`
- Delete: `packages/editor/src/editor-shell/pane-bar.tsx`, `packages/editor/src/editor-shell/pane-bar.dom.test.tsx`
- Modify: `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/shell-layout.dom.test.tsx`, `packages/editor/src/editor-shell/shell-layout-scroll.dom.test.ts`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/editor-session.ts`, `packages/editor/src/editor-session.dom.test.ts`, `packages/editor/src/ui-copy.ts`
- Rename: `tests/e2e/editor-pane-bar.ts` → `tests/e2e/editor-rail.ts`; `tests/e2e/editor-pane-bar.spec.ts` → `tests/e2e/editor-rail.spec.ts`
- Modify: the 13 browser specs and 2 helper modules that import the helper, plus `tests/e2e/panel-labels.spec.ts`
- Modify: `scripts/design-tokens.gated.json` (add every file this task converts)

**Interfaces:**
- Consumes: plan 1's `ControlIconButton` and its tokens; the existing `controls/tooltip.ts`.
- Produces:

```ts
export type RailSlot = "composition" | "add" | "tokens" | "document";
export function Rail(props: {
  readonly slot: RailSlot;
  readonly collapsed: boolean;
  readonly onChoose: (slot: RailSlot) => void;
  readonly disabled?: boolean;
}): React.JSX.Element;
```
  `ShellHosts` gains `readonly tokens: HTMLElement`. The slot words come from `uiCopy.rail.slots`, one name per slot, used as both the visible label and the accessible name.

- [ ] **Step 1: Measure the before-state, so the change is counted rather than described**

```bash
cd src/web
grep -rn "editor-shell-pane-bar" packages tests | wc -l
grep -rn "openPane(" tests/e2e | wc -l
grep -rl "editor-pane-bar.js" tests/e2e | wc -l
```

Expected: 73 call sites (Document 30, Insert 26, Assets 11, Layers 6) across 15 files, plus the helper's own definition. Record all three counts in the commit message.

- [ ] **Step 2: Write the rail to the bible, and the failing test with it**

`rail.dom.test.tsx` asserts the three contracts `§7.2` states, before the component exists:

```tsx
it("offers exactly the four slots the bible names", () => { /* one button per RAIL_SLOTS entry */ });
it("marks the open slot with the accent and the closed ones with --faint", () => { /* aria-current or aria-pressed, read off the rendered element */ });
it("asks for the slot it was given, and only asks", () => { /* onChoose receives the id; nothing local decides */ });
```

Run: `npx vitest run packages/editor/src/editor-shell/rail.dom.test.tsx`
Expected: **FAIL** — the module does not exist.

- [ ] **Step 3: Build the rail and delete the pane bar**

Each slot is an icon-only control: a glyph, an `aria-label` from the slot's one word, and a tooltip carrying **that same string** through `controls/tooltip.ts`. The selected slot carries the accent glyph, an accent wash and the 2px accent bar on the rail's inner edge (bible §7.2). Keep `choosePane`'s two behaviours in `shell-layout.tsx` unchanged: asking for the slot already open collapses the column, and the per-pane scroll offsets survive a swap (`shell-layout-scroll.dom.test.ts` re-pointed at `.editor-shell-rail`).

Delete `pane-bar.tsx` and its test, and the `+` with them: its only consumers are the Insert menu and the popover Task 3 deletes.

- [ ] **Step 4: Give every slot a pane that has content**

The move is wiring, not a rewrite — the panels stay imperative and plan 4 rewrites them:

- `ShellHosts` gains `tokens`; `editor-session.ts` appends `createPalettePanel` and `createTypePresetPanel` into `panelHosts.tokens` instead of `panelHosts.document`. The artboard panel and the document-references panel stay in `document`.
- The **assets host renders inside the Add pane's body**, with the insert host, because `§5.2` puts the asset path in the Add pane and a fourth slot is not available for it. Every asset control stays reachable, and its reference-count refusal is untouched.
- Update `EditorPanelHosts` and the fixtures in `editor-session.dom.test.ts`; the panel set is asserted by `panel-labels.spec.ts`, whose `openPane(page, "Document")` becomes `openPane(page, "Tokens")` and whose comment about the panels' pane is corrected.

- [ ] **Step 5: Re-point every locator in the same commit**

Rename the helper and its spec (a module named `editor-pane-bar` names a bar that no longer exists), and re-point all 73 sites by what each site *means*: `Layers` → `Composition`, `Insert` → `Add`, `Assets` → `Add`, `Document` → `Tokens` for the palette and type-preset controls, `Document` → `Document` for the artboard, background, metadata and references controls. `.editor-shell-pane-bar` becomes `.editor-shell-rail` in `shell-layout.dom.test.tsx`, `shell-layout-scroll.dom.test.ts` and `panel-labels.spec.ts`.

- [ ] **Step 6: Rebuild the body's grid**

`.editor-shell-body` gains the rail's 46px column ahead of the pane's, one row instead of two grid areas, and the pane-bar rules are deleted. `[data-collapsed="true"]` still drops the pane rather than narrowing it, and the refit-on-toggle still runs.

- [ ] **Step 7: Red proof — only one slot is open at a time**

Break the exclusivity (render every pane rather than the chosen one) and re-run `rail.dom.test.tsx` and the browser spec. Expected: **the exclusivity case fails**. Restore it. Then confirm the offset case: model the hidden `scrollTop` as `shell-layout-scroll.dom.test.ts` already does, or the assertion passes on jsdom's own behaviour whether or not the fix is present.

- [ ] **Step 8: Turn the ratchet green for this task's files**

Add `rail.tsx` (and every other file this task converted) to `scripts/design-tokens.gated.json`, then `npm run design:check ; echo "EXIT=$?"`. Expected: **exit 0**.

- [ ] **Step 9: Focused verification**

```bash
cd src/web
npm run build
npx vitest run packages/editor/src/editor-session.dom.test.ts packages/editor/src/editor-shell/
npx playwright test --project=desktop-chromium --grep "editor-rail|name every control|the panes are" --workers=1
```

Expected: green, and the summary reports the tests you named ran — a `--grep` that matches nothing exits 0.

- [ ] **Step 10: Commit**

```bash
git add packages/editor/src/editor-shell/ packages/editor/src/editor-session.ts packages/editor/src/editor-session.dom.test.ts packages/editor/src/ui-copy.ts tests/e2e/ scripts/design-tokens.gated.json
git commit
```

---

### Task 2: The panes' chrome

**Outcome:** Every pane has the bible's structure — a title bar, a scrolling body, an optional footer toolbar — and the Composition pane's footer holds the object actions, filtered by the registry exactly as the dock filters them.

**Owning symbols/landmarks:** the pane markup in `shell-layout.tsx` (`.editor-shell-panel`), `.editor-shell-panel` rules in `editor-shell.css`, the `aside.editor-shell-inspector`, `layer-panel.tsx`'s `data-vigilia-panel="layers"` section.

**Files:**
- Create: `packages/editor/src/editor-shell/pane.tsx`, `packages/editor/src/editor-shell/pane.dom.test.tsx`
- Modify: `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: plan 1's `ControlIconButton`, `InspectorSection`; `OBJECT_ACTIONS` and `actionEnabled` from `object-actions.js`.
- Produces:

```ts
export function Pane(props: {
  readonly id: string;
  readonly title: string;
  readonly icon: React.ComponentType<{ readonly size?: number; readonly strokeWidth?: number }>;
  readonly count?: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.JSX.Element;
```
  The DOM name of each pane does not change: `[data-vigilia-panel="layers"]` stays on the Composition pane's section, so the browsable contract the specs share survives.

- [ ] **Step 1: Write the failing test for the footer's gate**

```tsx
it("offers only the object actions this selection can run", () => { /* absent, not greyed */ });
it("asks the registry for eligibility and decides nothing itself", () => { /* spy on actionEnabled, or render an action the selection cannot run and assert absence */ });
```

Run: `npx vitest run packages/editor/src/editor-shell/pane.dom.test.tsx`
Expected: **FAIL** — the module does not exist.

- [ ] **Step 2: Build the pane chrome**

Title bar: glyph, title at `--text-md`, then the count or one pane-level action. Body: scrolls, sections use the `§2` eyebrow. Footer: icon buttons at 26px, elevation 0, 1px `--edge`. Every pane is flat at elevation 0 (bible §3): header, rail, panes and inspector carry no shadow and no blur; the palette-resolution mechanism `0035` established is untouched.

- [ ] **Step 3: Wire the Composition footer and the inspector's chrome**

The Composition pane's footer renders `OBJECT_ACTIONS.filter((action) => actionEnabled(bridge, action.id))` — the dock's own expression, not a second predicate — with each button's `aria-label` and tooltip carrying the same string. The inspector column becomes 276px, flat, and keeps its `aside` role; its contents are plan 3's.

- [ ] **Step 4: Red proof — the footer's gate is real**

Render the footer through `arrangeActions()` instead of the filtered `OBJECT_ACTIONS`, or drop the filter. Expected: **the absence case fails**. Restore it. Then check the same case in the browser, where the two halves must still differ: nothing selected → no object action and the arrange half greyed.

- [ ] **Step 5: Ratchet, verify, commit**

Add the converted files to `scripts/design-tokens.gated.json`, run `npm run design:check`, then `npm run build && npx vitest run packages/editor/src/editor-shell/`, then commit (`pane.tsx`, `pane.dom.test.tsx`, `shell-layout.tsx`, `editor-shell.css`, `shell-layout.dom.test.tsx`, `scripts/design-tokens.gated.json`).

---

### Task 3: The header is trimmed to what it owns

**Outcome:** The header shows the brand and `File` / `Edit` / `View` on the left and the publish control on the right; the Insert menu is deleted; no document readout is in the header.

**Owning symbols/landmarks:** `ShellMenuBar` and the `<header className="editor-shell-header">` element in `shell-layout.tsx`, `insert-popover.tsx` (`InsertPopover` and `insertItem`), `publish-control.tsx`, `.editor-shell-header`, `.editor-shell-tagline` and the header's publish rules in `editor-shell.css`, `uiCopy.menus.insert`, `uiCopy.editor`.

**Files:**
- Delete: `packages/editor/src/editor-shell/insert-popover.tsx`, `tests/e2e/insert-popover.spec.ts` (its two journeys are re-pointed, not dropped — see Step 3)
- Modify: `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/shell-layout.dom.test.tsx`, `packages/editor/src/editor-shell/publish-control.tsx`, `packages/editor/src/editor-shell/publish-control.dom.test.tsx`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/ui-copy.ts`, `tests/e2e/publish-header.spec.ts`, and the six specs that click `[data-vigilia-save-package]`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: `insertGroups()` from `new-object-panel.js` (the Add pane's list, unchanged); `readHosting()` / `setLan()` from `hosting-client.js`.
- Produces: a `HostingStore` in `shell-layout.tsx`, alongside `SelectionStore` and `SheetStore` — one owner for "is the editor publishing", read by the header's publish control and by Task 4's status bar. Its initial state is **unknown**, and an unknown host renders no claim: never a fabricated "live".

- [ ] **Step 1: Write the failing test for the two rules that matter**

```tsx
it("has no Insert menu, and every insertable group is still reachable from the Add pane", () => { /* walk insertGroups() and find each label in the pane */ });
it("closes the pairing surface behind one control rather than repeating it in the bar", () => { /* the address and the code are absent until the control is pressed */ });
```

Run: `npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: **FAIL** on both.

- [ ] **Step 2: Trim the header**

Brand mark, then `File`, `Edit`, `View` — no tagline, no document name, no per-document readout. `View` stays in the menubar deliberately: its three settings are changed while designing, and bible §7.1 says so. The header becomes a full-width strip at elevation 0 (42px, 1px `--edge` bottom border, no outer margin or radius), not the floating glass card it is today.

- [ ] **Step 3: Delete the Insert menu and the `+`'s popover**

`insertGroups()` is the one owner both surfaces rendered, so deleting the menu and the popover costs no capability — but the two journeys `insert-popover.spec.ts` covers must be shown on the Add pane before the file goes: a card inserted from the pane arrives as a unit the tree can name, and the pane's list is the groups the menu offered. Keep the refusal rule those tests also cover: before a document is open, the insert surface refuses rather than offering rows that insert nothing, and the task states which surface now carries it.

`insertItem` and `InsertPopover` have no consumer once both go; delete them rather than leaving a dormant mapping. Plan 4's React Add pane derives its dispatch from `insertGroups()` where it is used.

- [ ] **Step 4: Move the publish surface behind one control**

The header's right-hand control is the publish control, styled as the editor's one filled accent button, and it *is* the toggle (bible §7.1). Everything the surface carries today — the host's address, its port, the pairing token, the QR, the expiry, the §145 warning, the live document's name and any refusal — renders in a popover on that control, so no fact is lost and the header no longer grows with the LAN. Errors stay in words and reach a screen reader (`aria-describedby` for the warning, `role="alert"` for a refusal, as today). Do not print a chord: no `publish.*` binding exists (`Global Constraints`).

The header's separate `Save package` button leaves for the File menu's own row, which already dispatches the same call; re-point the six specs that click `[data-vigilia-save-package]`. **Leave the chord-rule comment in `ShellMenuBar` exactly as it is** — `vg-185` owns it.

- [ ] **Step 5: Red proof — the menu's removal did not remove a capability**

Re-add a menu item that is absent from the Add pane (or delete one group from the pane) and confirm the walk over `insertGroups()` **fails**. Restore it. Then confirm the pairing facts: press the control with the LAN on and assert the address, the code and the expiry render; with the LAN off, assert they do not.

- [ ] **Step 6: Ratchet, verify, commit**

Add the converted files to the gated list, `npm run design:check`, `npm run build`, then:

```bash
npx vitest run packages/editor/src/editor-shell/
npx playwright test --project=desktop-chromium --grep "publish surface|the header" --workers=1
```

Commit with a message naming which half of `vg-161` this answers and stating that `vg-172` stays open.

---

### Task 4: The status bar

**Outcome:** A 26px full-width strip, mono, carrying counts on the left, the last diagnostic in the middle, and save state with the live indicator on the right — and no tools.

**Owning symbols/landmarks:** `<footer id="status" className="editor-shell-status">` in `shell-layout.tsx`, `.editor-shell-status` and its diagnostic/save-state rules in `editor-shell.css`, `diagnostic-message.tsx`, `save-state.tsx`, `hosts.status`.

**Files:**
- Create: `packages/editor/src/editor-shell/publish-indicator.tsx`, `packages/editor/src/editor-shell/publish-indicator.dom.test.tsx`
- Modify: `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/editor-shell/shell-layout.dom.test.tsx`, `packages/editor/src/ui-copy.ts`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 3's `HostingStore`; `SaveState`; `DiagnosticMessage`; `hosts.status` (the span `editor-main` writes counts and messages into).
- Produces: `PublishIndicator(props: { readonly store: HostingStore }): React.JSX.Element | null`, rendering a check glyph and the word `live` in the accent **only** when the host reports the LAN on, and `null` when the state is unknown or off.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows no live mark when the host's state is unknown", () => {});
it("shows the live mark when the host reports the LAN on", () => {});
it("keeps the diagnostic surface in the footer, and it still reports a refusal", () => {});
```

Run: `npx vitest run packages/editor/src/editor-shell/publish-indicator.dom.test.tsx packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
Expected: **FAIL** — the indicator does not exist.

- [ ] **Step 2: Build the strip**

26px, `--text-xs`, mono, `--faint`, 1px `--edge` top border, flush to the window's edges. `#status` keeps its id and its three children: the counts span, the diagnostic and the save state. The diagnostic **stays**: bible §7.6 forbids tools and commands here, not readings, and a refusal with nowhere to land is a capability `§2.3` forbids removing.

- [ ] **Step 3: Red proof**

Make `PublishIndicator` render the live mark unconditionally. Expected: **the unknown-state case fails** — that is the fabrication bible §9's last line forbids. Restore it. Then disable `SaveState`'s subscription and confirm the dirty case fails.

- [ ] **Step 4: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/editor-shell/`, then commit.

---

## Phase 2 — The stage's three corners and the dock

The stage keeps its camera, its media layer and its lens; what changes is what floats over it and where.

### Task 5: Top-left — the document's identity

**Outcome:** A floating cluster at the stage's top-left carrying the record dot, the theme's name and its edited state, replacing a readout that does not exist anywhere today.

**Owning symbols/landmarks:** `shell-layout.tsx`'s `<main id="stage">`, new `editor-shell/document-identity.tsx`, `bridge.ts`'s `EditorShellSnapshot`, `.editor-shell-stage` in `editor-shell.css`, `uiCopy.saveState`.

**Files:**
- Create: `packages/editor/src/editor-shell/document-identity.tsx`, `packages/editor/src/editor-shell/document-identity.dom.test.tsx`
- Modify: `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/bridge.ts`, `packages/editor/src/editor-shell/bridge.dom.test.ts`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/ui-copy.ts`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: `EditorShellSnapshot` (extended, not replaced) and the session's `isDirty()`.
- Produces: `EditorShellSnapshot` gains `readonly documentName: string | undefined` — the theme's name as the session reports it, `undefined` when no document is open. This is a projection on the existing owner (`bridge.ts` is the snapshot's owner in `docs/architecture/ownership.md`); widen that row's wording to name the document's identity in the same commit. `DocumentIdentity(props): React.JSX.Element | null`.

- [ ] **Step 1: Write the failing test, including the late-bridge case**

```tsx
it("renders nothing rather than a placeholder when no document is open", () => {});
it("follows a bridge set after the shell mounted", () => {});   // the store's own idiom
it("reads the edited state from the same fact the status bar reads", () => {});
```

Run: `npx vitest run packages/editor/src/editor-shell/document-identity.dom.test.tsx`
Expected: **FAIL**.

- [ ] **Step 2: Build the cluster and the projection**

Cluster: `--radius-xl`, `--panel` at ~95% with `backdrop-filter: blur(6px)`, 1px `--edge`, elevation 1, inset 14px from the stage's edges. Contents: a filled 7px dot (bible §6 allows a filled glyph where a stroke would be illegible at that size), the name at `--text-sm`, and the edited state at `--text-xs`. The dot and the status bar's save state both read `isDirty()` and both take the palette's warn role — one fact, two readings, never two sources.

- [ ] **Step 3: Red proof**

Remove the bridge subscription so the cluster renders once and never updates; rename the document and assert the cluster follows. Expected: **the follow case fails**. Restore it.

- [ ] **Step 4: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/editor-shell/`, then commit.

---

### Task 6: Top-right — how the stage is shown

**Outcome:** One floating cluster at the stage's top-right holding the display lens chips and the zoom cluster (−, value, +, fit), every choice the current control offers still reachable.

**Owning symbols/landmarks:** `editor-shell/display-switch.tsx` (`DisplaySwitch`), `.editor-shell-zoom` in `editor-shell.css`, `[data-vigilia-zoom]`, `viewport-manager/`'s `showDisplay`, `zoomToSelection` and `reset`, `[data-vigilia-display-screen]`.

**Files:**
- Modify: `packages/editor/src/editor-shell/display-switch.tsx`, `packages/editor/src/editor-shell/display-switch.dom.test.tsx`, `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/ui-copy.ts`
- Modify: `tests/e2e/editor-display.spec.ts`, `tests/e2e/editor.spec.ts` (the zoom cases only)
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: `displayLensGroups(orientation)`, `viewport.display()`, `viewport.zoom()`, `viewport.isFitted()`, `viewport.showDisplay()`, `viewport.zoomToSelection()`, `viewport.reset()` — all unchanged.
- Produces: the same `DisplaySwitch` entry point with the same props, rendered inside a top-right cluster; `[data-vigilia-zoom]` stays on the element that shows the percentage, because two browser specs and the `editor-zoom-readout` capture read it.

- [ ] **Step 1: Enumerate what the control offers today, before changing it**

List every reachable choice: Fit, the six lenses grouped by the artboard's orientation, the one that is neither, zoom-to-selection, actual size, plus the percentage readout. Write the list into the task's commit message. This is the checklist the change is measured against.

- [ ] **Step 2: Write the failing test**

```tsx
it("keeps every choice the old control offered reachable", () => { /* one assertion per item from Step 1 */ });
it("shows the zoom as a readout and never as the display's name", () => {});
it("still marks the state where a lens is chosen but the camera is not fitted", () => {});
```

Run: `npx vitest run packages/editor/src/editor-shell/display-switch.dom.test.tsx`
Expected: **FAIL**.

- [ ] **Step 3: Move and re-cut the cluster**

The cluster sits 14px from the stage's top-right, at the same treatment as Task 5's chip. Nothing in the lens mechanism changes: `display-lens.ts`, the screen outline `[data-vigilia-display-screen]` (a 1px outline, hidden under Fit), the media layer and the viewport owner are untouched.

**Crowding contract:** the mockup's two illustrative lens chips are not the product's full choice set. Exercise all choices with Add open and inspector visible at 1280×720 and 1440×900, with a long document name and 200% browser zoom. Keep the existing labelled chooser for overflow, or wrap controls within the view cluster; do not force six lenses into a 2–4-option segmented control. Identity and view never overlap, focused controls stay visible, and no transparent cluster wrapper blocks stage gestures. Check both portrait and landscape lens groups. No chosen lens changes authored artboard dimensions or creates history.

Preserve the original reference's artwork-led composition and quiet stage texture. The ground/texture uses palette roles, with `--stage` declared at its first consumer where absent. Measure whether texture competes with artwork; do not replace it with a mandatory flat field on principle. Preserve restrained named elevation for clusters and artboard separation. The warm gradient is example authored artwork, not shell content to synthesize.

- [ ] **Step 4: Red proof**

Delete one choice from the recut control (e.g. Fit) and confirm its assertion fails. Restore it. Then confirm the readout case: plant a constant percentage in the readout and watch the zoom spec fail.

- [ ] **Step 5: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, then `npx playwright test --project=desktop-chromium --grep "zoom|display" --workers=1`, then commit.

---

### Task 7: Bottom-centre — the dock, re-layered

**Outcome:** The dock sits at the stage's bottom-centre at elevation 1 with the bible's radii and control sizes, still rendering both registry halves — the object half filtered, the arrange half greyed.

**Owning symbols/landmarks:** `editor-shell/canvas-dock.tsx` (`CanvasDock`, `Action`, `ArrangeAction`), `.editor-shell-dock` in `editor-shell.css`, `[data-vigilia-canvas-toolbar]`, `[data-vigilia-arrange-action]`.

**Files:**
- Modify: `packages/editor/src/editor-shell/canvas-dock.tsx`, `packages/editor/src/editor-shell/canvas-dock.dom.test.tsx`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/editor-shell/shell-layout.dom.test.tsx`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: `OBJECT_ACTIONS`, `actionEnabled`, `arrangeActions()` — unchanged, and the only source of what each half shows.
- Produces: the same element contract (`data-vigilia-canvas-toolbar`, `data-visible`, `data-vigilia-arrange-action`), because `tests/e2e/editor.spec.ts`, `keyboard.spec.ts`, `glass-authoring.spec.ts` and the `editor-toolbar` capture all address it.

- [ ] **Step 1: Write the failing test for the asymmetry**

```tsx
it("shows no object action and a greyed arrange half with nothing selected", () => {});
it("enables the arrange half only from two objects", () => {});
```

Run: `npx vitest run packages/editor/src/editor-shell/canvas-dock.dom.test.tsx`
Expected: **FAIL** only if the treatment is wrong — this is the half of the task that is already true, and the assertion is what keeps it true after the re-layering.

- [ ] **Step 2: Re-layer the treatment**

`--radius-xl`, `--panel` at ~95% with blur, 1px `--edge`, elevation 1, 16px above the stage's bottom, icon buttons at the bible's 26–30px, destructive actions in `--hot`. The tooltip/aria pairing stays as `Action`/`ArrangeAction` already build it — one owner, `controls/tooltip.ts`.

- [ ] **Step 3: Red proof — the two halves are distinguishable**

Render the arrange half through the object half's filter (absent rather than greyed) and confirm the zero-selection case **fails**. Restore it. Then check the same in the browser with nothing, one and two objects selected.

- [ ] **Step 4: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/editor-shell/`, `npx playwright test --project=desktop-chromium --grep "canvas dock|toolbar" --workers=1`, then commit.

---

## Phase 3 — The gate

### Task 8: The scales are consumed, and the ratchet says so

**Outcome:** Every file this plan converted is in the ratchet, the guard exits 0 over them, and it still refuses to pass over an empty list.

**Owning symbols/landmarks:** `scripts/design-tokens.gated.json`, `scripts/design-tokens.mjs` (its own proof is the `--self-test` flag on that file, not a second file — it is chained into `gates:self-test`), `npm run design:check`.

**Files:**
- Modify: `scripts/design-tokens.gated.json` (the union of every earlier task's additions)
- Modify: `docs/superpowers/plans/2026-10-08-gates-and-the-control-set.md` only if plan 1's guard landed with a different invocation than its Task 2 specifies — record the difference rather than silently adapting.

**Interfaces:**
- Consumes: plan 1's guard and its `--gated` argument.
- Produces: nothing new. This task is a measurement, and its output is the counts in the commit.

- [ ] **Step 1: Measure what this plan converted**

```bash
cd src/web
node -e "const g=require('../../scripts/design-tokens.gated.json');console.log(g.gated.length, g.gated.join('\n'))"
grep -c "#[0-9a-fA-F]\{3,8\}" packages/editor/src/editor-shell/editor-shell.css
```

Expected: the gated list holds every file the five shell tasks touched, and the hex count in `editor-shell.css` is recorded as the before-state for plan 3 — it does **not** go to zero here, because the palettes are hex and the panel families are plan 3's and plan 4's.

- [ ] **Step 2: Run the guard, and prove it is not vacuous**

```bash
npm run design:check ; echo "EXIT=$?"
printf '[]' > /tmp/gated.json && node ../../scripts/design-tokens.mjs --gated /tmp/gated.json ; echo "EXIT=$?"
```

Expected: **0**, then **non-zero with a message naming the empty list**. A guard over zero files reporting success is the defect plan 1 exists to remove, and it must still be refused with this plan's list in place.

- [ ] **Step 3: Red proof**

Add a hex literal and an off-scale `px` to a converted file. Expected: **non-zero, naming the file and the value**. Revert, then re-run to green.

- [ ] **Step 4: Commit**

Commit the gated list with the counts, and state in the message what is **not** converted yet (the panel families and the inspector).

---

### Task 9: The parity capture

**Outcome:** Built bundles, captured in the state the shell mockup draws, by an action registered in `docs/evidence/screenshots/README.md`.

**Owning symbols/landmarks:** `src/web/tests/e2e/design-language.spec.ts` (plan 1's harness), the two registered captures in `tests/e2e/editor.spec.ts` — `captures the mounted editor` and `captures the canvas dock over a selected object` — and `docs/evidence/screenshots/README.md`.

**Files:**
- Modify: `src/web/tests/e2e/design-language.spec.ts` (add this plan's capture; do not add a second procedure)
- Modify: `docs/evidence/screenshots/README.md` (register the new action in the editor checklist)
- Add: the produced images under `docs/evidence/screenshots/`

**Interfaces:**
- Consumes: plan 1's harness, its fixture and its registration row.
- Produces: one image of the shell with the **Add** slot open and nothing selected, plus the existing whole-editor and dock captures refreshed. Those three are the comparison set for Task 10.

- [ ] **Step 1: Write the capture so it fails if the shell is not the new one**

The capture opens the Add slot, asserts the rail's four slots are present and that exactly one pane is showing, then writes the image. Run it against the shell from before Task 1 (or with the rail's slot list emptied) and confirm it **fails** rather than producing a picture of the old bar.

- [ ] **Step 2: Prove the run is not vacuous**

```bash
cd src/web
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "<the registered title>" --workers=1
```

Read the summary and confirm **1 test ran**, not 0. A `--grep` matching nothing exits 0 with zero tests, which is how a parity gate silently stops checking.

- [ ] **Step 3: Capture the changed surfaces**

The whole editor, the shell with Add open, and the dock over a selection. `?static=1` and the controlled clock are the harness's own; the rules are `docs/evidence/screenshots/README.md`'s — capture only affected actions, one worker, built bundles.

- [ ] **Step 4: Commit**

Commit the spec, the registration row and the images together. Tell the user the images exist before they are staged, and inspect them first.

---

### Task 10: The capture is placed beside the mockup, and every difference is accounted for

**Outcome:** The completion report carries this plan's captures beside `docs/design/mockups/editor-shell.html`, with each difference either fixed or recorded in the commit as deliberate.

**Owning symbols/landmarks:** `docs/design/mockups/editor-shell.html` and `README.md`, `docs/design/design-language.md` (only if the capture shows the bible is silent on something), this plan's completion report.

**Files:**
- Modify: `docs/design/mockups/editor-shell.html` and/or `docs/design/mockups/README.md` — only where the mockup is **stale against the bible** (see Step 2)
- Modify: none of the source under `packages/editor/` for a *difference* — a difference is either fixed in the task that owns the surface or recorded as deliberate

**Interfaces:**
- Consumes: Task 9's images; the bible's §2–§7 and §10.
- Produces: the differences list, and where a difference is deliberate, the statement of which plan owns it.

- [ ] **Step 1: Compare language, not pixels**

Scale, spacing, alignment, hierarchy, colour roles, control treatment and icon weight. Platform font metrics, scrollbar widths, device pixel ratios and antialiasing are not drift, and `docs/evidence/screenshots/README.md` already says so.

- [ ] **Step 2: Adjudicate against the bible, and reconcile the mockup**

The docs review reconciled the reference before execution. Re-open its current version; do not repeat historical corrections blindly. Account for these previously divergent items and verify they remain aligned:

- Four rail slots include Document; the reviewed drawing and prose agree. Verify slot count and open/close behaviour in the product.
- No header size chip exists in the reviewed reference. Artboard dimensions belong to Document; a capture that restores that per-document header readout is drift.
- The final reference may print `⌘⇧P`; the plan-2 intermediate capture must not until plan 5 binds the same publish action. Mark this as deferred, not parity failure.
- Keep the reference's gradient artwork, restrained texture and compact view chips as visual direction. Chips illustrate a subset; Task 6 proves the full list and resolves actual crowding. Empty-inspector statistics are removed by plan 3, not a lost capability. Do not trade the composition for a blank placeholder or enlarged generic controls.
- The shell reference is a final design, not a claim plan 2 already built Settings, pane content or the inspector. Label intermediate differences with their owning later plan and refresh captures when that owner lands.

- [ ] **Step 3: List every difference, and account for each**

The expected deliberate differences, each with its reason and the plan that owns it: the pane's width (360px, not 246px — plan 4 replaces the row that needs it); no gear on the rail and the palette chip still in the header (plan 5 builds Settings); no printed publish chord (plan 5 binds it); a diagnostic message in the status bar (a reading, kept, `§2.3`); the display-screen outline when a lens is chosen (the capture's state is Fit, where it is hidden).

- [ ] **Step 4: State an empty list as a finding**

If the comparison produces no differences at all, say so as a finding with what was compared, and show the capture that could have failed. A gate that produces no comparison has not run.

- [ ] **Step 5: Commit**

Conventional Commit, the differences listed in the body as fixed or deliberate. Close no register row (`Global Constraints`), and name in the message which half of which row the commit answers.

---

## Out of scope

Named so a later plan owns them rather than this one growing.

- **The control set and the token scales** are plan 1's. This plan consumes them and adds no control.
- **The inspector** — its five sections, its per-kind behaviour, its geometry disclosure — is plan 3. This plan changes the column's width, treatment and position only.
- **The panes' contents** are plan 4: the Composition pane's rows (the kind glyph, the name, the hovered-row affordances), the Add pane rebuilt as React with its card unit tiles (absorbing Assets, `vg-154`), the Tokens pane rebuilt as React with its paint and preset lists (`vg-153`, and `vg-094`'s selection binding), and the Document pane's four scopes resolved. This plan re-parents the existing imperative panels and rewrites none of them.
- **Settings, the palette chip's move and the rail's gear** are plan 5, together with keyboard rebinding and the `publish.*` chord.
- **The closed glyph set, the accessible-name/tooltip single owner and the copy rules** are plan 6. This plan uses the existing tooltip owner and lucide glyphs at the bible's weight; it does not close the set.
- **Nothing in the canvas.** Interaction, snapping, the display lens's mechanism, the media layer and the screen outline are untouched.
- **No token is deleted from `editor-shell.css`** — a token leaves when its last consumer moves, which is plan 3 onward.
- **`vg-172`** (the header at 390px), **`vg-192`** and **`vg-185`** stay open and are not answered here.

## Self-review

- **Spec coverage.** §3.1 is Task 3, §3.2 is Task 1, §3.3 is Task 2, §3.4 is Task 4; §4.1, §4.2 and §4.3 are Tasks 5, 6 and 7; §9's count is Task 8; §13 is Tasks 9 and 10. §1's normative bible is consumed by every task, each citing it rather than restating it. §12's row 2 is this document.
- **Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every step names a file, a command or an expected output.
- **Type consistency.** `RailSlot` is the rail's vocabulary and `RailPane` no longer exists; `HostingStore` is one owner read by two surfaces; `documentName` is a field on `EditorShellSnapshot`, `undefined` when no document is open, never `""`.
- **Review Focus.** Each of the ten is pinned above to a task, and each is a failure no existing test would catch.
- **Red proofs.** Every task states the break that must fail its own gate, and Task 8 re-proves the guard's empty-list refusal with this plan's list in place.

## Completion report — the captures beside the mockup

**Task 10.** Task 9's three captures (`84abb569`) were placed beside
[`docs/design/mockups/editor-shell.html`](../../design/mockups/editor-shell.html)
and every difference adjudicated against
[`docs/design/design-language.md`](../../design/design-language.md) (normative),
never against the mockup alone.

**How the two sides were looked at.** The mockup was **rendered** in the
installed Playwright Chromium at a 1280×720 viewport
(`file:///D:/git-repos/vigilia/docs/design/mockups/editor-shell.html`), full page
and as its shell element (1180×638px) — not judged from its source. Each capture
is 1280×720 and was **Read** whole, then re-cropped at 3–6× (the PNG embedded as
a data URL in a Playwright page, a clipped region screenshotted upscaled) so the
seven dimensions Step 1 names could be read — **scale, spacing, alignment,
hierarchy, colour roles, control treatment and icon weight** — and nothing
else: platform font metrics, scrollbar widths, device pixel ratios and
antialiasing are not drift (`docs/evidence/screenshots/README.md`).
`editor-shell-add-desktop-chromium.png` is the primary comparison — it is the state the mockup draws (Add open, nothing
selected); `editor-desktop-chromium.png` and
`editor-toolbar-desktop-chromium.png` are supporting.

**This plan changed nothing in the product.** Every entry below is *deliberate*
in this plan or *owned by a later plan or a register row* — nothing is unowned. A
difference "fixed" here would reopen a surface whose task is closed
and reviewed (Task 10 brief, `Files`). The mockup was checked against the bible
and left unchanged: nothing in it was both stale against the bible and fixable
without either erasing a product difference or pre-judging `vg-227`.

### The differences

| # | Surface | Mockup draws | The capture shows | Adjudication |
|---|---|---|---|---|
| 1 | Pane width | 246px (§7.3) | 360px | **Deliberate** — the measured requirement of the current layer row, which **plan 4** replaces. Bible §7.3; `Global Constraints`. |
| 2 | Header, right | nothing between the menus and Publish | an `editorial` swatch+name chip in the header | **Deliberate** — the palette chip's move to Settings is **plan 5**'s. |
| 3 | Header, right | `⌘⇧P` printed beside Publish | no chord printed | **Deliberate, deferred** — no `publish.*` binding exists until **plan 5**; §9 forbids a mark that runs nothing. |
| 4 | Header, right | a filled accent **Publish** button | nothing | **Deliberate** — `publish-control.tsx:87` returns `null` while the host is unknown, and the preview has no host; §9 forbids a fabricated claim. The control renders with a host. |
| 5 | Header, left | a brand chevron glyph and a 1px divider before the menus | the wordmark alone, no divider | **Deliberate** — §7.1 requires "brand mark, then `File`, `Edit`, `View`", and the wordmark `Vigilia` occupies exactly that position; the chevron-plus-hairline is the mockup's own illustration of one, which spec §13.1 allows a deliberate visual difference to explain. |
| 6 | Rail, foot | the settings gear pinned to the foot | no gear | **Deliberate** — a gear that opens nothing asserts a capability the code lacks (§9); **plan 5** builds Settings. |
| 7 | Rail slot size | 34×34px | 34×34px (both outside §5's 26–30px) | **Register row `vg-227`** owns the decision; the mockup is not edited while it is open. |
| 8 | Pane title bar | `＋ Add   8 units` | `＋ Add` — no count | **Deliberate** — pane content; **plan 4**. Bible §7.3. |
| 9 | Add group headings | `CARDS / SHAPES / CHARTS` | `CARD / SHAPE / CHART` (singular) | **Deliberate** — pane copy; **plan 4**. |
| 10 | Card units | a 4-column grid of labelled diagram tiles | named pills in a bordered group | **Deliberate** — the Add pane rebuilt as React with card unit tiles; **plan 4** (`vg-154`). §7.8. |
| 11 | Shapes / charts | 4-column glyph tiles | labelled pills (`Rectangle`, `Gauge`, …) | **Deliberate** — **plan 4**. §7.8. |
| 12 | Text | a glyph well row | a labelled pill | **Deliberate** — **plan 4**. |
| 13 | Assets | a dashed `Import a file  png · svg` row | an `ASSETS` section: select, preview, Import/Replace/Remove | **Deliberate** — the assets host re-parented into Add; **plan 4** absorbs Assets (`vg-154`). |
| 14 | Stage ground | a restrained diagonal texture | a flat `--vigilia-canvas-bg` ground | **Deliberate** — §7.5 permits texture *or* a flat ground; §7.8 keeps the artwork dominant. |
| 15 | Stage top-right | compact lens chips (`16:9`, `9:19.5`, `Fit`) + `36%` + expand, all inline | one readout (`−  33%  +  fit`) whose list holds every lens behind a labelled chooser | **Deliberate** — Task 6's crowding resolution; §7.7 permits the labelled chooser over forcing six lenses into chips. The product's `−`/`+` follow §7.5, which the mockup omits; the mockup is left illustrative. |
| 16 | Stage top-left | dot · name · 1px divider · the word `edited` · weight 500 | dot · name only (no divider; the marker is `Unsaved changes` in the warn role, absent when clean) | **Register row `vg-219`** owns the three; the missing marker here is the **clean** state, not a difference. |
| 17 | Stage top-right, treatment | cluster radius 9–10px, elevation 1 | `--radius-xl`/`--edge` here, but the glass palette rule off the ladder | **Register row `vg-222`** (two competing cluster treatments; editorial flat, five palettes overlay). |
| 18 | View readout shape | a chip in the cluster | a bare percentage with no well and no chevron, opening a list | **Register row `vg-225`** — §5's closed vocabulary has no well+chevron entry; filed as a possible bible amendment. |
| 19 | Whole body | rail, pane, stage and inspector **flush**, sharing 1px borders, square (bible §7's diagram) | inset 8px (`.editor-shell-body{gap:8px;padding:8px}`, `editor-shell.css:757`) with **12px** radii at `:784`, `:833`, `:1016`, `:1064`, `:1601` — floating cards, off §3's radius scale (declared at `:301-302`, no 12px step) | **Register row `vg-231`** — filed by the controller; owner is first a design decision (add a 12px step, or move to `--xl` 10 / `--lg` 8; and whether the body insets at all). |
| 20 | Inspector, empty | `Nothing selected` + `Pick something on the canvas` | one line: `Select an object to inspect it.` | **Deliberate** — the empty state; **plan 3**. §7.4. |
| 21 | Inspector, selected | the mockup's shell draws only the empty state | a `SELECTION` heading, then CONTENT / POSITION / LAYER / PAINT / SPENDS | **Deliberate** — the five sections are **plan 3**'s; §7.4 says the column opens with the subject, not a chrome label — a §7.4 question plan 3 owns. |
| 22 | Status bar, left | `52 objects   0 selected` | `Fabric editor ready` — the diagnostic, and **no counts anywhere** | **One row, two adjudications.** The **diagnostic is deliberate** — a reading kept (§2.3; Task 10 brief). Its **absent counts are register row `vg-230`**: §7.6, spec §3.4 and Task 4's own outcome all put object/selection counts on the left, the thirteen writes into `hosts.status` (`editor-main.ts:115`–`:400`) are all messages, and `EditorShellSnapshot.selectedCount` (`bridge.ts:29`, `:159`) is consumed only by the dock's arrange eligibility (`bridge.ts:179`) and never rendered. Counted **once**, under deliberate. |
| 23 | Status bar, right | `saved 4m ago` and `✓ live` | nothing | **Deliberate** — `SaveState` states only the unsaved state (`save-state.tsx:39`) and `PublishIndicator` renders no mark while the host is unknown (§9). State-dependent, not missing. |
| 24 | Status strip tone | `#0e1217` (the rail's tone) | `var(--panel)` (the header's) | **Register row `vg-217`** — ruled defensible; the palette has no darker token. |
| 25 | Dock | fixture tiles incl. a red trash | object half absent when nothing is selected (filtered, §7.5); over a selection the trash is `--hot` | **Aligned**; the red-only-in-the-dock fact is **register row `vg-226`** (registry owner). |

**Owned elsewhere, not a visible difference in these captures:** `vg-223` (the
identity chip's clipped marker, only at 200% zoom, `640×360`), `vg-228` (the
gated list's `dom.test` membership — never visual), `vg-229` (the
`?static=1`/clock sentence in `docs/evidence/screenshots/README.md` — a
documentation claim, and neither editor capture pins a clock). None is included
above because none is a difference these three images show.

**Owning plans at a glance, by whole row (6 + 12 + 7 = 25):** **plan 2, this
plan, deliberate — 6** (#4, #5, #14, #15, #22 — counted once, #23); **a later
plan — 12** (plan 4: #1, #8–#13; plan 5: #2, #3, #6; plan 3: #20, #21);
**a register row — 7** (#7 `vg-227`, #16 `vg-219`, #17 `vg-222`, #18 `vg-225`,
#19 `vg-231`, #24 `vg-217`, #25 `vg-226`). **Nothing is unowned.** `vg-230` and
`vg-231` were filed by the controller from this list; this report is their
origin.

### Step 2 — the previously divergent items, verified

- **Four rail slots include Document** — holds. `RAIL_SLOTS` is exactly
  `composition · add · tokens · document` (`rail.tsx:13`), the capture draws
  four glyphs, and `choosePane` (`shell-layout.tsx:615`) closes the open slot
  when it is asked again and replaces it when another is asked.
- **No header size chip** — holds. The header carries the wordmark, File/Edit/View
  and the palette chip; there is no per-document size readout (it is on the
  canvas). No drift.
- **`⌘⇧P` not printed** — holds, and it is **deferred**, not a parity failure;
  plan 5 binds the chord.
- **Gradient artwork, restrained texture, compact view chips** — the authored
  artwork is present (the starter's own composition, illustrative in the mockup);
  the ground is flat, which §7.5 permits; the compact chips are **not** the
  product's — #15's Task 6 chooser is. The empty inspector carries **no
  statistics**, and the composition was not traded for a blank placeholder.
- **The shell reference is a final design** — the mockup's Settings specimen and
  the panes'/inspector's content are labelled with their owning later plan
  (#2, #3, #6 plan 5; #8–#13 plan 4; #20, #21 plan 3).

### Step 4 — the empty-list case

It does not apply: the comparison produced 25 differences, partitioned by whole
row so the two tallies below sum to it — **6 deliberate in this plan** (#4, #5,
#14, #15, #22, #23), **12 owned by a later plan** (#1, #8–#13 plan 4; #2, #3, #6
plan 5; #20, #21 plan 3), and **7 owned by a register row** (#7, #16–#19, #24,
#25). **Nothing is unowned.** #22 is one row with two adjudications — its
diagnostic is deliberate (§2.3) and its absent counts are `vg-230` — so it is
counted **once**, under deliberate. The captures that could have failed for
producing no comparison are Task 9's three, each asserted before it wrote its
image (`rail.dom.test.tsx`'s four-slot case; `design-language.spec.ts`'s
slot-count and one-pane-visible assertions).
