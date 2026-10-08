# Settings and Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the settings surface the rail's gear opens — one modal with three tabs (Appearance, Keyboard, About) — move the shell palette out of the header and into it, give every chord a rebinding the editor actually runs (including the `⌘⇧P` the publish button may then print), and end with the parity capture beside `docs/design/mockups/editor-shell.html`.

**Architecture:** Nothing new is invented. The modal is `components/ui/dialog.tsx` — the Base UI `Dialog` `0033`/`0038` already put on the editor's one primitive library — carrying `@base-ui/react/tabs` for the three tabs, so focus trapping, `Esc` and focus return are the library's (`modal` defaults to `true`) rather than hand-rolled. The palette mechanism `0035` landed is **untouched**: `palette.ts` keeps `applyShellPalette`, `resolveShellPalette`, `readShellChoice` and `writeShellChoice`, and the tab renders a control that calls exactly what `PaletteMenu.choose` called today. Rebinding adds **one owner for the effective binding table** (`shortcut-manager/bindings.ts`): the defaults stay `PRODUCT_SHORTCUTS`, an override table lives in the same browser-local storage the palette uses, and the dispatcher, the sheet, the menu rows, the dock tooltips and the header's publish chord all read that one table — so a chord printed is a chord run. Storage stays browser-local and is never serialized into a theme envelope.

**Tech Stack:** TypeScript, React 19, Base UI (`@base-ui/react/dialog`, `/tabs`), Tailwind v4 (`@theme`), Biome 2.x, Vitest (jsdom), Playwright, Node ESM scripts.

**Spec:** [`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`](../specs/2026-10-08-editor-design-language-design.md) — §2.3, §3.1, §3.2, §7, §8, §10, §12 row 5, §13, Invariants, Acceptance, *Ruled during review*
**Normative companion:** [`docs/design/design-language.md`](../../design/design-language.md) — §1, §2, §3, §4, §5, §6, §7.1, §7.2, §8, §9, §10
**Reference:** [`docs/design/mockups/editor-shell.html`](../../design/mockups/editor-shell.html) (its settings section), and [`README.md`](../../design/mockups/README.md) for what a mockup is and is not
**Decision:** [`0035`](../../decisions/0035-the-shells-palette-resolves-at-the-element-and-the-os-is-its-fallback.md) (the palette), [`0038`](../../decisions/0038-base-ui-is-the-editors-one-primitive-library-on-the-users-ruling.md), [`0039`](../../decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)

## What this plan composes from plans 1–4, and where plan 6 takes over

Plan 1 (`2026-10-08-gates-and-the-control-set.md`) lands the gates and the control set; plan 2 (`2026-10-08-the-shell-and-the-rail.md`) lands the shell and re-parents the panes; plan 3 (`2026-10-08-the-inspector.md`) lands the column; plan 4 (`2026-10-08-the-panes.md`) fills the four panes and deletes the Assets slot. **Plan 6 (`2026-10-08-iconography-and-copy.md`) comes after this plan** and takes the closed glyph set, the accessible-name/tooltip single owner and the copy rules over what plans 1–5 landed — it names this plan as the fifth it reads, so the surfaces and the copy this plan adds are what it censuses.

The panes are not a dependency here — the settings modal is a sibling of the panes, not inside one — but plan 4 is worth reading before executing for two things it moves that this plan names: it rewrites `shell-appearance.spec.ts`'s neighbours and `panel-labels.spec.ts` under its own §2.3 re-pointing, and it re-points `tests/e2e/`'s helpers. **Where plan 4 has already re-pointed a locator this plan also names, plan 4's landed form wins** and this plan adds nothing to it.

**Step 1 of execution, before any edit, is to reconcile this plan against what actually landed** and to record in the first commit message what the reconciliation found:

1. Read plan 1's Task 3 section, then read the landed `packages/editor/src/components/ui/` — the control set with its **prop signatures as landed**. Where the landed signature and plan 1's Task 3 section disagree, **the landed signature wins** and this plan is wrong; Task 2 below uses `ControlToggle` and Task 1 uses `ControlIconButton`, and a plan that names a prop the components do not have is not executable.
2. Read the landed `@theme static` and `@theme inline` blocks in `editor-shell.css` and `scripts/design-tokens.mjs` / `design-tokens.gated.json` — the token names, the guard's invocation, its `--gated` argument, and the current list. **The landed file is an object with `biblePx` and `gated`, not the bare array plan 1's prose describes**: every task below adds its converted files to the **`gated`** key, and does not touch `biblePx` unless it needs a dimension the bible prints and the list lacks. **`--stage`, `--hdr` and `--edge-2` do not exist**; declaring one with its first consumer is legitimate and the task that does it must say so (bible §4 names them, so this is a token arriving late, not a new role). If plan 1, plan 2 or plan 4 recorded a decision for the guard under `docs/decisions/` (plan 6's header names `0040`), that note wins over their plan sections.
3. Read plan 2's landed diff **as it touches the header, the rail and `shell-layout.tsx`**: whether `pane-bar.tsx` is gone and `rail.tsx` exists with the four slots, whether `PaletteMenu` is still in the header, whether the header's publish control prints a chord, and what `ShellHosts` holds now. This plan's Task 1 adds the gear to `rail.tsx`'s foot and Task 2 removes the header's palette chip — **if plan 2 left either in a shape this plan does not expect, say so in the first commit and re-point the step rather than restoring a deleted component.**
4. Read the landed `src/web/tests/e2e/design-language.spec.ts` and `docs/evidence/screenshots/README.md`. Task 6 **adds this plan's capture to that file**; it does not invent a procedure. If plan 1's Task 4 has not landed the spec, say so and hold Task 6's capture until it has.

Where a piece this plan consumes has not landed, say so in the first commit and hold the dependent step, rather than writing a parallel version of it.

## Global Constraints

- **No behaviour changes** (§2.3). Same fields, same eligibility gates, same refusals, same read-only markers, the same six palettes, the same shortcut table's *acts*. Where a browser spec or a `.dom.test` locates an imperative or header-bound surface this plan moves, **it is re-pointed at the new surface in the same commit**, and a re-pointed locator must be shown to fail when the behaviour it guards is disabled before it is trusted.
- **One owner per concept.** `palette.ts` keeps the palette list, the OS fallback and the attribute; `rail.tsx` keeps the slot enumeration; `PRODUCT_SHORTCUTS` keeps which bindings exist by default; `shortcut-manager/display.ts` keeps how a chord reads; `shortcut-manager/reference.ts` keeps the sheet's rows; `uiCopy` keeps every word. This plan adds **one** owner — the effective binding table — and re-spells none of the others.
- **A printed chord must run something.** The mockup prints `⌘⇧P` beside `Publish` and no `publish.*` binding exists today (plan 2 deferred it for exactly this reason). Task 3 binds it; **the header prints the chord in the same commit that makes it run**, and not before.
- **`View` stays in the menubar.** Its three settings — preview/source, chart refresh rate, run display — are changed *while* designing (§3.1, bible §7.1). The reviewed settings reference has no `Canvas` tab; its historical drawing was corrected during docs review. Task 6 verifies that ruling remains true. This is the ruling that separates §3.1 from §7 and it is not re-opened.
- **The gear is not a fifth slot** (§3.2). It opens a modal; it does not push the stage, select a pane, or appear in the slot enumeration `rail.tsx` owns.
- **Editor-shell theming stays separate from authored theme globals** (Invariants). The palette colours the editor, never the theme. **Nothing here is persisted into a theme envelope**: the palette choice and the binding overrides are browser-local storage, exactly as `palette.ts` already is, and `palette.ts`'s own comment says so.
- **Keyboard storage follows the palette's shape.** `palette.ts` is the house pattern: a pure module taking an injected `Storage`, a single namespaced key, `undefined` rather than a default where the two states differ, and `readStorage()` in `shell-layout.tsx` returning `undefined` where the browser refuses storage. Rebinding is the same pattern with the same rules — **do not invent a second persistence mechanism**, and do not move the existing one.
- **Scales and roles only.** Every value comes from plan 1's tokens (`--text-*`, `--radius-*`, `--space-*`, `--elev-*`) and the palette roles (bible §4). No hex, no off-scale px. **Every file this plan converts joins `scripts/design-tokens.gated.json`'s `gated` key in the same task** — the ratchet is seeded as work lands, never afterwards, and the list is an object (`{biblePx, gated}`) rather than the bare array plan 1's prose describes. The modal is elevation 3 with its scrim (bible §3); the tab body is elevation 0.
- **Spec §2.2's remaining dialog and font-picker surfaces are this plan's Task 4a.** The settings modal alone cannot close the whole-editor React rewrite.
- **Accessibility is a requirement here, not a polish pass.** Bible §5.5 (every control has a label, a programmatic name and an id), §6 (an icon-only control's `aria-label` and its tooltip are the same string, one owner — `editor-shell/controls/tooltip.ts`), §5.4 (focus is an accent ring that must clear contrast on **all six palettes**, not just `graphite`), §9 (the platform's mark is printed, the platform's name is what a screen reader says). A modal is where focus management goes wrong: the plan states what traps focus, what `Esc` does, and where focus returns.
- **Bible §5's control vocabulary is closed.** A surface that needs a control §5 lacks **amends the bible in the same commit** or is not that control (§10). Task 2 does exactly one such amendment and says why; no second one is added without the same treatment.
- **No Fabric object is ever mirrored into React** (§2.1, ADR-0039), and no new dependency: React 19, Base UI and Tailwind v4 are present (`0038`/`0039` stand). `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled. No licence headers; comments are 1–3 lines and explain *why*. 500 lines is a signal and 800 is a stop.
- Run from `src/web/`; the scripts are `package.json`'s. Stage explicit paths; never `git add -A`. Conventional Commit titles.
- **Playwright previews built bundles.** Rebuild after any source change and after reverting a deliberate break. `VIGILIA_CAPTURE=1` and `--workers=1` for any capture; capture only actions registered in `docs/evidence/screenshots/README.md`.
- **A new test must be shown to fail when the behaviour it guards is disabled**, before it is trusted. Every task below states its red proof.
- **The register.** This plan closes no row. `vg-187` (the modal guard) stays open; `vg-172`, `vg-185`, `vg-192` stay open. Task 4 records a finding it does not fix as a `Discovered, not fixed:` trailer on its own commit, per `AGENTS.md` — it is materialised into the register from there, not here. Say in each commit which row's half it answers.

## Review Focus

The spec implies these and no task's tests exercise them. Each is pinned to the task that owns its code.

1. **A gear that opens nothing, a fifth slot, or a pane.** §3.2 is a single sentence with three ways to get it wrong, and only one of them looks wrong in a diff. → Task 1.
2. **A modal the document behind it can still hear, or one a touch reader cannot leave.** `ShortcutManager`'s guard matches `[role='dialog']` and Base UI sets it, so `Ctrl+Z` and `Delete` should not reach the document — but the guard samples *at the start of the dispatch* and the settings surface adds one more window-level `keydown` consumer (the capture control). And Base UI's own contract says a modal dialog must render `Dialog.Close` inside the popup *so touch screen readers can escape it*; `dialog.tsx` renders none today. → Task 1.
3. **A palette choice that stops persisting, or an OS override the move quietly loses.** `resolveShellPalette`, `readShellChoice` and `writeShellChoice` are one mechanism; a Settings-local `useState` that skips `applyShellPalette` leaves every portalled popup painting the old palette — the defect `0035` exists to prevent. And there is **no `clearShellChoice`** today, so "follow the system" cannot yet be turned back on. → Task 2.
4. **A chip left in the header, or a capability removed with the readout.** Spec §7 accepts *one* cost — no at-a-glance readout — and no other. Two owners of "which palette is in force" is not that cost, and the Acceptance item ("six palettes distinguishable by surface") still has to hold. → Task 2.
5. **A rebinding that reaches the dispatcher but not what prints the chord.** Four surfaces render `shortcutLabel`: the menubar's `kbd`, the dock's tooltips, the reference sheet, and (new) the header's publish chord. Rebinding one and not the others prints a mark that runs something else — bible §9's whole rule. → Task 3.
6. **A capture control that binds the chord the shell also runs.** While "press a chord…" is armed, the keystroke must be the capture's and nothing else's — and the *new* chord must not be one the editor cannot honour (it defers to a focused text field, or it is a browser chord). A rebind that makes a working key stop working is a §2.3 behaviour change. → Task 3.
7. **A `⌘⇧P` bound to a second publish path.** The act is the header's control's; a chord that re-implements "flip the LAN" beside the control's own toggle gives the editor two publish paths that agree until one changes. → Task 3.
8. **An About tab that invents a version.** There is no product-version string the editor bundle can read (see Task 4 Step 1). A tab that prints one from a hand-typed literal is the fabrication bible §9 forbids, in the one place nobody would check. → Task 4.
9. **A ratchet seeded to pass, or a re-pointed locator that passes with its behaviour disabled.** A gated list naming files that still violate, or a run over an empty list reporting success, is the guard's own defect (`vg-149`'s shape). → Task 5.
10. **A parity capture of a different screen.** The mockup draws the Appearance tab; a capture of Keyboard compares two different screens and every difference it lists is spurious. A `--grep` matching nothing exits 0. → Task 6.
11. **A mockup left stale in the one place this plan touched.** Its `Canvas` tab contradicts §3.1/§7, and its left nav has four items where the spec names three. A mockup that disagrees with the bible is believed and is worse than none. → Task 6.

---

## Phase 1 — The gear, and the surface it opens

The rail's foot gains the gear; the modal it opens carries three tabs; the palette moves in from the header; the Keyboard tab makes every chord rebindable and gives `⌘⇧P` something to run.

### Task 1: The gear, and the modal it opens

**Outcome:** The rail's foot carries the settings gear (bible §7.2) — the fifth thing on the rail and **not** a slot. Pressing it opens a modal carrying the spec §7's three tabs (Appearance, Keyboard, About); focus moves into it and is trapped, `Esc` closes it, and focus returns to the gear. Nothing else on the rail moves and no pane opens.

**Owning symbols/landmarks:** `editor-shell/rail.tsx` (plan 2's `Rail`, `RailSlot`), `editor-shell/shell-layout.tsx` (`Shell`, `ShellMenuBar`, `hosts`), `components/ui/dialog.tsx` (extended, not replaced), new `editor-shell/settings.tsx`, new `editor-shell/settings.dom.test.tsx`, `.editor-shell-settings*` in `editor-shell.css`, `uiCopy.settings`, `.editor-shell-rail` rules for the gear's foot.

**Files:**
- Create: `packages/editor/src/editor-shell/settings.tsx`, `packages/editor/src/editor-shell/settings.dom.test.tsx`
- Modify: `packages/editor/src/editor-shell/rail.tsx`, `packages/editor/src/editor-shell/rail.dom.test.tsx`, `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/shell-layout.dom.test.tsx`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/ui-copy.ts`
- Modify: `scripts/design-tokens.gated.json` (add every file this task converts to the `gated` key)

**Interfaces:**
- Consumes: plan 2's `Rail` and `RailSlot`; plan 1's `ControlIconButton`; the existing `components/ui/dialog.tsx`; `@base-ui/react/tabs` (`node_modules/@base-ui/react/tabs` is present; it generates no dependency).
- Produces:

```tsx
export type SettingsTab = "appearance" | "keyboard" | "about";

export function Settings(props: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Passed straight through to the tabs, which own nothing of their own. */
  readonly storage: Storage | undefined;
}): React.JSX.Element;
```
  `Rail` gains `readonly onOpenSettings: () => void` and an `onSettingsRef?: React.Ref<HTMLButtonElement>` (or Base UI's `triggerId`, whichever the landed `Dialog` makes reachable — the contract is that focus returns to the gear). `dialog.tsx` gains `readonly closeLabel?: string`, rendering a `DialogPrimitive.Close` inside the popup when given. `uiCopy.settings` gains `title`, `tabs.appearance`, `tabs.keyboard`, `tabs.about`, `close`.

- [ ] **Step 1: Measure the before-state, so the change is counted rather than described**

```bash
cd src/web
grep -rn "data-vigilia-palette\b" packages tests | grep -v palette-token | wc -l
grep -rn "editor-shell-dialog" packages tests | wc -l
```
  Record both in the commit message. The first is the header chip's locator census Task 2 re-points; the second is how many places the one dialog class is already addressed.

- [ ] **Step 2: Write the failing test for the three rules that are defects, not style**

`settings.dom.test.tsx`:

```tsx
it("opens the settings modal from the gear, and offers exactly the three tabs the spec names", () => {});
it("returns focus to the gear when it closes, and Escape is one press with one effect", () => {});
it("renders a labelled close control a touch screen reader can reach", () => {});
```
  Run: `npx vitest run packages/editor/src/editor-shell/settings.dom.test.tsx`
  Expected: **FAIL** — the module does not exist.

- [ ] **Step 3: Build the modal, and let the library own the focus**

`Settings` renders `Dialog` with `label={uiCopy.settings.title}` and, inside the popup, a `Tabs.Root` over `Tabs.List`/`Tabs.Tab`/`Tabs.Panel` for the three tabs. `Tabs` rather than a hand-rolled `role="tablist"` because the arrow-key navigation and the `aria-selected`/`aria-controls` wiring are the primitive's job and Base UI is already the editor's one primitive library (`0038`). Base UI's `Dialog` is modal by default, so focus is trapped; `Esc` closes it through `onOpenChange`; pass the gear as the trigger (`triggerId` or the library's handle) so focus returns to it, and **assert that in the test rather than assuming it** — if the library does not do it, the shell restores it explicitly.

  Render a `Dialog.Close` (bible §5.5 wants it labelled and programmatic; Base UI's own contract wants it present so a touch screen reader can leave). The tab body is elevation 0; the modal is elevation 3 with the scrim (bible §3) — `editor-shell.css` already has `.editor-shell-dialog-overlay` and `.editor-shell-dialog`; extend them rather than adding a parallel pair.

- [ ] **Step 4: Add the gear to the rail's foot**

`rail.tsx` renders the gear as the last thing in the rail, pinned to the foot, separated from the four slots. It is an **icon button** (bible §5), its glyph from the existing icon family at the bible's weight, its `aria-label` and its tooltip **the same string** through `editor-shell/controls/tooltip.ts` (bible §6, one owner). It is not in `RailSlot`, it does not carry `aria-pressed` against a slot, and pressing it calls `onOpenSettings` and nothing else. `Shell` holds `settingsOpen` as local state, exactly as it holds `insertOpen` today.

- [ ] **Step 5: Red proof — the three ways to get the gear wrong**

Add `"settings"` to `RailSlot` and render a pane for it; expected: **the three-tabs case fails**, because the modal is not the gear's outcome. Restore. Remove the `Dialog.Close` and confirm **the labelled-close case fails**. Restore. Remove the trigger link and confirm **the focus-return case fails**. Restore. Then the modal-leak proof, which is Review Focus 2: with the modal open press `Ctrl+Z` and `Delete`, and assert the document behind it is unchanged — if it does change, the `ShortcutManager` guard is not holding for this modal and the fix is in `settings.tsx`, not in the guard.

- [ ] **Step 6: Turn the ratchet green for this task's files, verify, commit**

Add `settings.tsx`, `rail.tsx` and every other file this task converted to `scripts/design-tokens.gated.json`, then:

```bash
cd src/web
npm run design:check ; echo "EXIT=$?"
npm run build
npx vitest run packages/editor/src/editor-shell/
npx playwright test --project=desktop-chromium --grep "editor-rail|the panes are" --workers=1
```

  Expected: exit 0, green, and the summary reports the tests you named ran — a `--grep` that matches nothing exits 0. Commit with the two counts from Step 1.

---

### Task 2: Appearance — the six palettes move in, and the header chip leaves

**Outcome:** The Appearance tab offers the six shell palettes and follow-the-system through the control set, writing the same storage and applying the same attribute the header chip wrote and applied; the header has no palette chip; the gear is the only route to the choice. The cost the spec accepted knowingly is the only capability lost — there is no at-a-glance readout of the active palette.

**Owning symbols/landmarks:** `editor-shell/palette.ts` (`shellPalettes`, `DEFAULT_SHELL_PALETTE`, `systemShellPalette`, `resolveShellPalette`, `readShellChoice`, `writeShellChoice`, `applyShellPalette`, `watchSystemAppearance`), `editor-shell/palette-menu.tsx` (`PaletteMenu`, `Swatch`), `shell-layout.tsx`'s `<header>` and the `watchSystemAppearance` effect, `settings.tsx`'s Appearance tab, `uiCopy.palette`, `tests/e2e/shell-palette.ts`, `tests/e2e/shell-appearance.spec.ts`, `packages/editor/src/accessible-names.dom.test.ts`, `tests/e2e/panel-labels.spec.ts`.

**Files:**
- Modify: `packages/editor/src/editor-shell/palette.ts`, `packages/editor/src/editor-shell/palette.test.ts`
- Delete: `packages/editor/src/editor-shell/palette-menu.tsx`, `packages/editor/src/editor-shell/palette-menu.dom.test.tsx` — **only if** nothing else renders a palette menu; otherwise keep the popup's rows and say what still uses them (the `Swatch` chip is reused by the tab, so the file may survive as the tab's row)
- Create: `packages/editor/src/components/ui/control-choice-row.tsx` (the one control this plan adds — see Step 3)
- Modify: `packages/editor/src/editor-shell/settings.tsx`, `packages/editor/src/editor-shell/settings.dom.test.tsx`, `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/shell-layout.dom.test.tsx`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/ui-copy.ts`
- Modify: `docs/design/design-language.md` (the §5 amendment in Step 3, same commit)
- Modify: `tests/e2e/shell-palette.ts`, `tests/e2e/shell-appearance.spec.ts`, `tests/e2e/panel-labels.spec.ts`, `packages/editor/src/accessible-names.dom.test.ts`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 1's `Settings`; plan 1's `ControlToggle`, `ControlIconButton`, `InspectorSection`; `palette.ts`'s existing mechanism unchanged.
- Produces:
  - `palette.ts` gains `export function clearShellChoice(storage: Storage): void` — removing the key is what returns the editor to following the OS, which is a state `readShellChoice` already distinguishes (`undefined` means "no choice") and nothing can currently reach.
  - `components/ui/control-choice-row.tsx`: `export function ControlChoiceRow(props: ControlProps & { readonly checked: boolean; readonly onChoose: () => void; readonly swatch: React.ReactNode }): React.JSX.Element` — `role="radio"`, `aria-checked`, in a `role="radiogroup"` labelled by the section.
  - The Appearance tab renders the six as `ControlChoiceRow`s and follow-the-system as a `ControlToggle`.

- [ ] **Step 1: Write the failing test for the two rules that are defects, not style**

`settings.dom.test.tsx` and `palette.test.ts`:

```tsx
it("applies the palette where the chip applied it — the attribute, and the storage", () => {});
it("returns to following the OS when follow-the-system is turned back on", () => {});
it("the header has no palette control", () => {});
```
  Run: `npx vitest run packages/editor/src/editor-shell/settings.dom.test.tsx packages/editor/src/editor-shell/palette.test.ts`
  Expected: **FAIL** on the third, and on the second because `clearShellChoice` does not exist.

- [ ] **Step 2: Move the choice, keep the mechanism**

The tab's choosing control calls **exactly** what `PaletteMenu.choose` calls today, in the same order: `writeShellChoice(storage, next)` where storage exists, then `applyShellPalette(next)`, then the shell's `setPalette` so the live state and the `watchSystemAppearance` effect see it. **Do not re-implement `resolveShellPalette` or read `--shell-*` in JS**; `0035`'s decision note says why (the chip is a subtree and the attribute is the one writer). Remove `PaletteMenu` from the header and delete it if it has no other consumer — the `Swatch` chip is reused by the tab, so keep it where it is or move it with the row.

  Follow-the-system is live preference state, not a storage read used as state. Initialize it through the existing owner; choosing a palette disables following and applies it immediately, turning following on clears the override and resolves the OS, turning it off pins the currently resolved palette. Storage may be absent or throw: session-local changes still work and truthfully report when they will not survive reload. A system appearance change updates the shell and open portalled surfaces only while following. Test both toggle directions, OS changes, denied storage and reload.

  `ControlChoiceRow` is a radio choice, not an editor-shell palette dependency inside generic `components/ui/`: pass a swatch adornment as `ReactNode`, not `ShellPalette[]`. Use installed radio primitives/native radio semantics for one Tab stop, arrow navigation and selection, with selected state visible without colour. A grid changes layout, not radio keyboard order. Required proof: six named choices, keyboard selection, focus distinct from checked state, no authored theme mutation.

- [ ] **Step 3: Amend bible §5 by exactly one control, in this commit**

The six palettes are a closed set with a colour each, and **`Segmented` does not fit them** — §5 sizes it at 2–4 labels. Building a six-cell segmented or a bare `<select>` would be §10's forbidden "invent a control not in §5". So the bible gains one row, and the component lands with it:

> **Choice row** | A `--radius-md` row at `--panel-2` carrying a swatch and a name; the chosen row is lifted to `--stage` with the accent border | One member of a closed set where each member has its own colour

And one rule beneath the table: **a set too large for `Segmented` is a list of choice rows, each an independent radio in one labelled `radiogroup`.** The reviewed mockup draws six choices in a grid; the grid is layout, while one radio-group owns selection. At constrained width the grid may reduce columns without changing keyboard order. State the amendment in the commit message as a bible change, not a local exception.

- [ ] **Step 4: Re-point every locator in the same commit**

The header chip's locator is `[data-vigilia-palette]` — **50 matches across 12 files, and most of them are not this control** (`data-vigilia-palette-token`, `-color`, `-kind`, `-angle`, `-name`, `-stop-color`, `-replacement`, `-delete`, `-users`, `-picker` all belong to the Document pane's palette panel and are untouched). The shell chip's own sites are: `shell-palette.ts:48` (`choosePalette`), `shell-appearance.spec.ts` (five reads), `panel-labels.spec.ts:54` (the accessible-name sweep list), `shell-layout.dom.test.tsx:171`, and `palette-menu.dom.test.tsx`. Re-point each **by what it means**: `choosePalette` opens the gear, selects Appearance, then chooses the palette — and it must keep asserting the `html[data-shell-palette]` attribute, which is the promise it makes. Delete `palette-menu.dom.test.tsx` with its component, or re-point it at the tab; do not leave a test for a surface that is gone. In `accessible-names.dom.test.ts`, **re-point the chip's own entry and add the modal's controls to the list that is already there — do not widen the audit's coverage contract, which is plan 6's Task 4.**

- [ ] **Step 5: Red proofs**

Drop `applyShellPalette` from the tab's choose path and confirm **the applies-where-the-chip-applied case fails**, then confirm `shell-appearance.spec.ts`'s portalled-popup case fails too — a palette applied only to React state is exactly the defect `0035` closed. Restore. Make the toggle write a palette instead of clearing the key and confirm **the follow-the-system case fails**. Restore. Re-add a palette control to the header and confirm **the no-header-palette case fails**. Restore.

- [ ] **Step 6: Ratchet, verify, commit**

Gated list, `npm run design:check ; echo "EXIT=$?"` (expected 0), `npm run build`, then:

```bash
npx vitest run packages/editor/src/editor-shell/ packages/editor/src/
npx playwright test --project=desktop-chromium --grep "shell palettes|name every control" --workers=1
```
  Expected: green, and the summary reports the tests you named ran. Commit the bible amendment, the code and the re-pointed locators together, and say in the message that the at-a-glance readout is the accepted cost (§7) and nothing else was lost.

---

### Task 3: Keyboard — rebinding, the reference, and the publish chord

**Outcome:** The Keyboard tab lists every product action with its **effective** chord and lets the author capture a new chord for one or reset all; the same tab renders the reference. A rebinding changes what the dispatcher runs **and** what every surface prints — the menubar rows, the dock tooltips, the reference sheet and the header's publish chord. The header may now print `⌘⇧P` beside `Publish`, because it runs something.

**Owning symbols/landmarks:** new `shortcut-manager/bindings.ts`, `shortcut-manager/index.ts` (`ProductShortcutId`, `ShortcutBinding`, `PRODUCT_SHORTCUTS`, `CONTEXT_SHORTCUTS`, `bindingFor`, `productShortcutIds`), `shortcut-manager/display.ts` (`shortcutLabel`, `shortcutSpokenLabel`), `shortcut-manager/reference.ts` (`ShortcutReferenceGroups`, `SHORTCUT_LABELS`, `shortcutReferenceGroups`), `editor-shell/shortcut-reference.tsx`, `editor-shell/publish-control.tsx`, `shell-layout.tsx`'s `item()` and header, `editor-session.ts`'s registrations, `editor-main.ts`'s options, `publish-client.ts`, `uiCopy.shortcuts`.

**Files:**
- Create: `packages/editor/src/shortcut-manager/bindings.ts`, `packages/editor/src/shortcut-manager/bindings.test.ts`, `packages/editor/src/editor-shell/settings-keyboard.tsx`, `packages/editor/src/editor-shell/settings-keyboard.dom.test.tsx`
- Modify: `packages/editor/src/shortcut-manager/index.ts`, `packages/editor/src/shortcut-manager/display.ts`, `packages/editor/src/shortcut-manager/reference.ts`, `packages/editor/src/shortcut-manager/index.test.ts`, `packages/editor/src/shortcut-manager/index.dom.test.ts`, `packages/editor/src/shortcut-manager/display.test.ts`, `packages/editor/src/shortcut-manager/reference.test.ts`
- Modify: `packages/editor/src/editor-shell/settings.tsx`, `packages/editor/src/editor-shell/settings.dom.test.tsx`, `packages/editor/src/editor-shell/shortcut-reference.tsx`, `packages/editor/src/editor-shell/shortcut-reference.dom.test.tsx`, `packages/editor/src/editor-shell/canvas-dock.tsx`, `packages/editor/src/editor-shell/shell-layout.tsx`, `packages/editor/src/editor-shell/shell-layout.dom.test.tsx`, `packages/editor/src/editor-shell/publish-control.tsx`, `packages/editor/src/editor-shell/editor-shell.css`, `packages/editor/src/ui-copy.ts`, `packages/editor/src/editor-session.ts`, `packages/editor/src/editor-main.ts`, `packages/editor/src/publish-client.ts`
- Modify: `tests/e2e/keyboard.spec.ts`, `tests/e2e/editor.spec.ts` (the chord cases only)
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 1's `Settings`; `readStorage()`'s `Storage | undefined` convention; the existing `controls/tooltip.ts`.
- Produces:

```ts
// shortcut-manager/bindings.ts — ONE owner for the effective table.
// The defaults stay `PRODUCT_SHORTCUTS`; this adds the overrides and the
// resolution, and re-spells no binding.
export type ShortcutOverrides = Readonly<Partial<Record<ProductShortcutId, ShortcutBinding>>>;

export function readShortcutOverrides(storage: Storage): ShortcutOverrides;
export function writeShortcutOverride(storage: Storage, action: ProductShortcutId, binding: ShortcutBinding): void;
/** Removing the key is "no overrides"; it is the Reset all affordance. */
export function clearShortcutOverrides(storage: Storage): void;
export function clearShortcutOverride(storage: Storage, action: ProductShortcutId): void;
export function resolveShortcuts(overrides: ShortcutOverrides): readonly ShortcutBinding[];
/** The live table, written once by the shell and read by everyone. */
export function setActiveShortcuts(bindings: readonly ShortcutBinding[]): void;
export function activeShortcuts(): readonly ShortcutBinding[];
export function subscribeShortcuts(listener: () => void): () => void;
```
  and, on the existing owners: `ProductShortcutId` gains `"publish.toggle"`; `PRODUCT_SHORTCUTS` gains `{ key: "p", modifier: true, shift: true, action: "publish.toggle" }`; `ShortcutReferenceRow` gains `readonly action: ProductShortcutId`; `SHORTCUT_LABELS` gains `"publish.toggle": uiCopy.publish.start`; `uiCopy.shortcuts.groups` gains `publish: "Publish"` (the `satisfies Record<ShortcutPrefix, string>` makes that a compile error until it does).

- [ ] **Step 1: Enumerate what prints a chord today, before changing anything**

```bash
cd src/web
grep -rn "shortcutLabel\|shortcutSpokenLabel\|shortcutReferenceGroups" packages tests --include=*.ts --include=*.tsx | grep -v "\.test\."
```
  Expected: `canvas-dock.tsx` (the dock's tooltips), `shell-layout.tsx` (the menu rows and their `aria-label`), `shortcut-reference.tsx` (the sheet), and the three projection modules. Write the list into the commit message — it is the checklist Review Focus 5 is judged against, and the header's publish chord is the fourth surface to be added.

- [ ] **Step 2: Write the failing test for the two rules that are defects, not style**

`bindings.test.ts` and `settings-keyboard.dom.test.tsx`:

```ts
it("resolves the defaults when nothing is stored, and the override when one is", () => {});
it("stores one action's chord without disturbing any other action's", () => {});
it("returning an action to its default leaves no entry behind", () => {});
```

```tsx
it("prints the effective chord, not the default, in the list and in the sheet", () => {});
it("captures a chord, refuses one already bound to another action, in words", () => {});
it("Escape cancels the capture and binds nothing", () => {});
```
  Run: `npx vitest run packages/editor/src/shortcut-manager/bindings.test.ts packages/editor/src/editor-shell/settings-keyboard.dom.test.tsx`
  Expected: **FAIL** — the modules do not exist.

- [ ] **Step 3: Build the effective table, and route every reader through it**

`bindings.ts` is the one owner: defaults (`PRODUCT_SHORTCUTS`) + overrides → the live table, with `subscribeShortcuts` so React re-renders. Then **change the readers, not the table's membership**:

- `index.ts`'s `bindingFor` matches against `activeShortcuts()` plus `CONTEXT_SHORTCUTS`.
- `display.ts`'s `shortcutLabel`/`shortcutSpokenLabel` filter `activeShortcuts()`; their signatures do not change, so `canvas-dock.tsx` and `shell-layout.tsx` keep working — but they must re-read on a change, so the components that render a chord subscribe (`useSyncExternalStore`) rather than holding a render-time copy. State in the commit which components subscribe.
- `reference.ts`'s `shortcutReferenceGroups()` reads `activeShortcuts()` and now carries each row's `action`.
- The shell writes the table once: on mount from `readShortcutOverrides(storage)`, and on every capture.

  A module-level live table is deliberate and is the same shape `applyShellPalette` already has (one writer, everyone reads). **Say so in a one-line comment naming why**: the consumers are four components in three subtrees plus a window-level dispatcher, none of which can be reached by props without plumbing the table through all of them.

- [ ] **Step 4: Build the Keyboard tab: the reference with editing, and the capture**

Each row: the action's label, its effective chord as a `<kbd>` carrying the printed mark and the spoken name (bible §9), and an **icon button** whose glyph is unambiguous, whose `aria-label` and tooltip are the same string (bible §6, one owner), and which arms the row's capture. Armed, the row shows "press a chord…" and takes the accent focus ring (bible §5.4 — and it must clear contrast on all six palettes, not only `graphite`).

Capture rules, stated so the implementer does not have to invent them:

- The capture reads `keydown` **on the row while it is armed** and stops the event there, so the shell's product shortcuts and the page's own handlers never see it — the modal guard keeps the document safe, but the capture must keep the *new* chord from firing while it is being recorded.
- `Escape` cancels and binds nothing.
- A chord **already bound to a different action** is refused **in words** naming the action it belongs to (bible §9: a refusal states the reason; §5.3: it renders, greyed, rather than vanishing).
- A chord the action cannot honour is refused in words too: a modifier-less letter for an action that does not defer to a focused text field is not a binding the editor can run (`MODIFIED_KEY_DEFERRED_ACTION_IDS` and `isTextEntryTarget` are the existing rule, not a new one).
- **Reset all** clears the storage key and restores the defaults; one action's own return-to-default does the same for one entry. Add an explicit `clearShortcutOverride(storage, action)` to the bindings owner; the current interfaces otherwise cannot perform per-action reset.
- Resolution replaces **all** default aliases for an overridden action with its chosen binding, then preserves every untouched action's aliases and match order. Conflicts are tested against actual matching semantics, not string equality: a shift-agnostic binding overlaps its Shift-qualified form. Keep Shift-qualified precedence and reserve `CONTEXT_SHORTCUTS`; Escape cancels capture and cannot be rebound here.
- Modifier-only presses, key repeat and IME composition cannot become bindings. Capture prevents the browser default for cancellable events it consumes. OS/browser-intercepted chords cannot be promised: refuse known reserved chords with a reason and name platform limits; a JavaScript listener cannot guarantee capture of every OS shortcut.
- Validate stored JSON as untrusted input: known action, valid key/modifier/shift shapes, matching action id, and no collisions. Ignore invalid overrides with an honest notice; a damaged preference must not disable keyboard defaults. Runtime choice still works when storage access fails, with a visible "not saved on this browser" notice rather than a false persistence claim.
- Escape while capture is armed cancels **capture only**, leaving Settings open; the next Escape closes Settings and returns focus. Verify against the installed Dialog's capture-phase dismissal. A row's bubbling `stopPropagation` cannot retroactively stop a document-capture listener; coordinate capture cancellation with the Dialog's existing dismissal API instead of adding a competing global shortcut manager.

  The reference is the **same** `shortcutReferenceGroups()` projection the `?` sheet renders. **The `?` sheet is kept** as the quick reference and is not deleted: one projection rendered twice is the idiom this editor already uses (the menubar's `kbd`, the dock's tooltip and the sheet all render it), deleting a working shortcut would re-point a contracted test for no capability gained, and bible §8 forbids a smaller surface. §7's "and the reference" is satisfied because the tab renders the reference.

- [ ] **Step 5: Bind `⌘⇧P`, and print it — in this commit, and only now**

Add `publish.toggle` through the whole `satisfies` chain (`ProductShortcutId` → `PRODUCT_SHORTCUTS` → `SHORTCUT_LABELS` → `uiCopy.shortcuts.groups`), register its handler in `editor-session.ts` on the `onShowShortcuts` precedent, and wire it through `editor-main.ts` to **the same act the header's publish control runs**. Extract that act to one owner if it is currently inside `PublishControl`'s body — the constraint is one publish path, not two that agree today (Review Focus 7). Then, and in the same commit, `publish-control.tsx` prints the chord from `shortcutLabel("publish.toggle")` with its spoken name from `shortcutSpokenLabel` — plan 2 deliberately left it unprinted because there was nothing to run.

- [ ] **Step 6: Red proofs**

Make `shortcutLabel` read `PRODUCT_SHORTCUTS` instead of `activeShortcuts()` and confirm **the prints-the-effective-chord case fails** — that is Review Focus 5, and it is the failure that would ship a mark running a different key. Restore. Let the capture bind a chord already held by another action and confirm **the refusal case fails**. Restore. Let `Escape` bind instead of cancelling and confirm **the cancel case fails**. Restore. Remove the capture's `stopPropagation` and confirm the case that presses a chord the editor already handles fails (the new binding must not also fire the editor's action while being recorded). Restore. Finally, remove the `publish.toggle` registration and confirm the header prints a chord that runs nothing — the state plan 2 refused to ship.

- [ ] **Step 7: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, then:

```bash
npx vitest run packages/editor/src/shortcut-manager/ packages/editor/src/editor-shell/
npx playwright test --project=desktop-chromium --grep "keyboard|tooltip|chord" --workers=1
```
  Read the summary and confirm the tests you named ran. Commit the table, the tab, the chord and the header's mark together, and name in the message which half of `vg-187` this commit leaves open.

---

## Phase 2 — About, the ratchet, and the gate

### Task 4: About — version and provenance, from what the editor actually has

**Outcome:** An About tab showing the edition's provenance and the version facts this build can honestly read, with no fabricated product version and nothing typed in by hand.

**Owning symbols/landmarks:** `settings.tsx`'s About tab, `uiCopy.settings.about`, `renderer-core/src/theme/document.ts` (`SUPPORTED_SCHEMA_VERSION`, the release-version default), the Document pane's `releaseVersion` row (`uiCopy.panels.releaseVersion`) as the same fact rendered elsewhere.

**Files:**
- Modify: `packages/editor/src/editor-shell/settings.tsx`, `packages/editor/src/editor-shell/settings.dom.test.tsx`, `packages/editor/src/ui-copy.ts`
- Modify: `scripts/design-tokens.gated.json`

**Interfaces:**
- Consumes: Task 1's `Settings`; `SUPPORTED_SCHEMA_VERSION` from `renderer-core` (already imported across the editor).
- Produces: nothing new. The tab renders facts, and no new module is created for it.

- [ ] **Step 1: Establish, by reading, what version facts exist — and record that one does not**

```bash
cd src/web
grep -rn "version" packages/editor/src --include=*.ts --include=*.tsx | grep -v "\.test\." | grep -vi "canvas\|stored version"
grep -rn "VERSION\|SUPPORTED_SCHEMA_VERSION" packages/host/src/main.ts packages/renderer-core/src/theme/document.ts
```
  Expected: **no product-version source the editor bundle can read.** The host's `const VERSION = "0.1.0"` lives in `packages/host/src/main.ts`, which is Node and is not in the editor's bundle; `packages/editor/package.json` is `0.0.0`; `packages/editor/vite.config.ts` injects no define; `renderer-core/src/theme/document.ts` owns `SUPPORTED_SCHEMA_VERSION` and is where the theme's own `version` defaults to `"0.1.0"`. Record this in the commit message verbatim as the finding it is.

- [ ] **Step 2: Write the failing test for the rule that matters**

```tsx
it("shows the version facts the build owns, and invents none", () => {
  /* every rendered string is traceable to an owner: the schema version this
     build writes, and the open document's own release version where it has one */
});
it("renders nothing rather than a placeholder where a fact is absent", () => {});
```
  Run: `npx vitest run packages/editor/src/editor-shell/settings.dom.test.tsx -t About`
  Expected: **FAIL**.

- [ ] **Step 3: Build the tab from the facts that exist**

Provenance copy from `uiCopy` naming what the editor is (one short line, sentence case, bible §9). The schema version this build writes, read from `SUPPORTED_SCHEMA_VERSION` — an owned fact, and the one a reader supporting an old package actually needs. The open document's release version where the document carries one, from the same fact the Document pane's `releaseVersion` row reads — one fact, two readings, never two sources. **Where a fact is absent, render nothing**: bible §9's "a missing reading is a gap, stated once, quietly", never a placeholder that could read as data.

- [ ] **Step 4: Record the finding; do not fix it here**

The product's own version string has no owner the editor can read. Fixing it means giving one module that both the host CLI and the editor bundle import — a change to the host, out of this plan's scope, and one that needs a decision rather than a task (`AGENTS.md`: more than one owner could fix it). Put **`Discovered, not fixed: the editor has no product-version source the About tab can read; the host's VERSION is Node-side and the editor bundle injects none.`** in this commit's message as a trailer, and materialise the row from it — the register is filed from the trailer, not from a plan.

- [ ] **Step 5: Red proof**

Render a version string from a literal in `settings.tsx` and confirm **the invents-none case fails** — that is Review Focus 8, and it is the only way this tab can lie. Restore. Remove the absent-fact guard and confirm **the placeholder case fails**. Restore.

- [ ] **Step 6: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/editor-shell/`, then commit with the finding as a trailer.

---

### Task 4a: Complete dialog and font-picker rendering

**Outcome:** No editor surface is left imperative or using hand-authored native
select/range controls merely because its file is outside a pane directory.
This task closes §2.2's omitted owners within Phase 2; no new active plan.

**Owns:** `new-document-chooser.ts` and its tests,
`theme-library-dialog.ts` and its tests, `persistence-manager/`'s existing dialog
rendering/tests, `font-picker/font-picker.tsx` and its tests,
`components/ui/dialog.tsx` and `control-select.tsx` where composition requires
it. These rendering owners join this plan's ratchet and capture inventory.

- [ ] Inventory actual controls, accept filters, metadata limits, async/error
  states, dismissal rules and focus return for each surface. Read current
  production source before choosing file splits; do not invent I/O adapters.
- [ ] Move rendering to React with the existing Base UI Dialog and plan-1
  controls. Keep file reading, package validation, save/release operations and
  managers unchanged behind their existing signatures. Hidden native file
  inputs remain valid platform integration, not visible native selects.
- [ ] Preserve font-picker capabilities: searchable catalogue, preview,
  curated face and trio adoption, name/source information and refusal states.
  Selection uses `ControlSelect`; no second font list or resolver.
- [ ] Prove each real journey in its owning existing tests: new-document
  cancel/create, library choose/import/remove, persistence failure/cancel and
  font preview/adoption. Invalid input preserves previous data; pending work
  prevents repeat submission; one Escape closes one dialog and leaves canvas
  untouched. Focus returns to the invoking menu/command, not always the gear.
- [ ] Rebuild affected bundles, run focused owner suites and browser journeys,
  and capture affected registered dialog/font actions in graphite/editorial.
  Negative proof removes one working control or routes a select to an unwired
  callback; its journey fails. Record zero remaining hand-authored native
  select/range here before Task 5. Delete obsolete UI builders only after their
  last consumers leave; preserve the primitive and manager owners.

### Task 5: The ratchet, the §2.3 census, and every re-pointed locator proven

**Outcome:** Every file this plan converted is in `scripts/design-tokens.gated.json`, `npm run design:check` exits 0 over them and still refuses to pass over an empty list, and **every locator this plan re-pointed is demonstrated to fail when the behaviour it guards is disabled** — the palette chip's move, the sheet's chord reads, and the tab's own controls.

**Owning symbols/landmarks:** `scripts/design-tokens.gated.json`, `scripts/design-tokens.mjs` (its own proof is `--self-test`, chained into `gates:self-test`), `npm run design:check`; `tests/e2e/shell-palette.ts`, `tests/e2e/shell-appearance.spec.ts`, `tests/e2e/keyboard.spec.ts`, `tests/e2e/panel-labels.spec.ts`; `packages/editor/src/editor-shell/*.dom.test.tsx`, `packages/editor/src/shortcut-manager/*.test.ts`, `packages/editor/src/accessible-names.dom.test.ts`.

**Files:**
- Modify: `scripts/design-tokens.gated.json` (the union of every earlier task's additions)
- Modify: the re-pointed specs and unit suites only where a locator is still aimed at the removed header chip or the moved sheet
- Modify: nothing in `packages/editor/src/**` production code unless a locator cannot be re-pointed — in which case the fix is in the surface, not the test

**Interfaces:**
- Consumes: plan 1's guard and its `--gated` argument; every task above.
- Produces: nothing new. This task is a measurement, and its output is the counts in the commit.

- [ ] **Step 1: Measure what this plan converted**

```bash
cd src/web
node -e "const g=require('../../scripts/design-tokens.gated.json');console.log(g.gated.length, g.gated.join('\n'))"
grep -rn "data-vigilia-palette\b" packages tests | grep -v palette-token | wc -l
grep -rn "shortcutLabel\|shortcutSpokenLabel\|shortcutReferenceGroups" packages tests --include=*.ts --include=*.tsx | grep -v "\.test\." | wc -l
grep -c "#[0-9a-fA-F]\{3,8\}" packages/editor/src/editor-shell/editor-shell.css
```
  Expected: the gated list holds every file these five tasks touched; the shell chip's locator count is **0** except where a test now addresses the tab's own control under a new name; and `editor-shell.css`'s hex count is recorded as the before-state for plan 6 — it does **not** go to zero here, because the palettes are hex by definition and the remaining panel families are plan 4's.

- [ ] **Step 2: Run the guard, and prove it is not vacuous**

```bash
cd src/web
npm run design:check ; echo "EXIT=$?"
printf '[]' > /tmp/gated.json && node ../../scripts/design-tokens.mjs --gated /tmp/gated.json ; echo "EXIT=$?"
```
  Expected: **0**, then **non-zero with a message naming the empty list**. A guard over zero files reporting success is the defect plan 1 exists to remove, and it must still be refused with this plan's list in place.

- [ ] **Step 3: The locator census, and each re-pointed locator proven red**

List, in the commit message, every locator this plan moved — the header chip's sites, `choosePalette`'s route, the sheet's `kbd` count, and the tab's new controls. Then, one at a time, **break the behaviour each guards in the surface and confirm the locator fails**:

- Drop `applyShellPalette` from the tab and confirm the palette sweeps fail.
- Make the tab print the default chord instead of the effective one and confirm the sheet's `kbd` assertion fails.
- Remove the `Dialog.Close` and confirm the accessible-name sweep fails.
- Give a control in the modal neither an `aria-label` nor a `<label for>` and confirm `accessible-names.dom.test.ts` and `panel-labels.spec.ts` fail.

  Restore each. **A locator that passes with the behaviour disabled is not a locator**, and this step is the plan's `§2.3` claim.

- [ ] **Step 4: Red proof — the guard itself**

Add a hex literal and an off-scale `px` to a converted file. Expected: **non-zero, naming the file and the value**. Revert, then re-run to green.

- [ ] **Step 5: Commit**

Commit the gated list, the re-pointed locators and the counts, and state in the message what this plan did **not** convert: the panes (plan 4) and the remaining panel families.

---

### Task 6: The parity capture, beside the mockup, with every difference accounted for

**Outcome:** Built bundles, captured by an action registered in `docs/evidence/screenshots/README.md`, with the Settings surface's captures placed beside `docs/design/mockups/editor-shell.html`'s settings section, every difference either fixed or recorded in the commit as deliberate, and the mockup's stale settings portion reconciled against the bible and the spec.

**Owning symbols/landmarks:** `src/web/tests/e2e/design-language.spec.ts` (plan 1's harness), the registered actions this plan changes — `shell-palette-*` / `captures each palette's own surface`, `keyboard-reference` / `? opens the sheet, and the document behind it does not change` — in `shell-appearance.spec.ts` and `keyboard.spec.ts`, and `docs/evidence/screenshots/README.md`'s editor checklist; `docs/design/mockups/editor-shell.html`'s settings section and `docs/design/mockups/README.md`.

**Files:**
- Modify: `src/web/tests/e2e/design-language.spec.ts` (add this plan's capture; do not add a second procedure)
- Modify: `docs/evidence/screenshots/README.md` (register the new action in the editor checklist)
- Modify: `docs/design/mockups/editor-shell.html` — **its settings section only**, and only where it is stale (Step 3); the shell section's stale prose is plan 2's Task 10
- Add: the produced images under `docs/evidence/screenshots/`
- Modify: `scripts/design-tokens.gated.json` only if `design-language.spec.ts` is gated (it is a `.ts` spec; follow plan 1's list)

**Interfaces:**
- Consumes: plan 1's harness, its fixture and its registration row; plan 2's shell; Tasks 1–4's surface.
- Produces: the captures that are this plan's completion condition (§13), and the differences list.

- [ ] **Step 1: Write the capture so it fails if the surface is not the new one**

The capture opens the gear, asserts the three tabs are present and that exactly one panel is showing, asserts the header has no palette control, selects Appearance, and only then writes the image. Run it with the rail's gear absent (or the tab list emptied) and confirm it **fails** rather than producing a picture of the old header. It must also capture the **Keyboard** tab, because the reference-with-editing is this plan's other visible surface, and **both palettes matter**: a capture of one palette cannot show a hard-coded hex, so capture `graphite` beside `editorial`.

- [ ] **Step 2: Prove the run is not vacuous**

```bash
cd src/web
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "<the registered title>" --workers=1
```
  Read the summary and confirm **1 test ran**, not 0. A `--grep` matching nothing exits 0 with zero tests, which is how a parity gate silently stops checking (Review Focus 10).

- [ ] **Step 3: Adjudicate against the bible, and reconcile the mockup where it is stale**

Three things in the checked mockup's settings section disagree with the bible or the spec, and each is settled **by the bible, in words in the report and in the commit**:

- **The reviewed reference now has three tabs: Appearance, Keyboard, About.** The old Canvas tab was removed because Show, Chart refresh and Run display remain in View (§3.1). Verify the current reference rather than trying to delete the historical tab again; no control moves out of View.
- **Its palette cards are a 3×2 grid of bordered tiles.** Bible §5's vocabulary is closed and Task 2 amended it with one control (the choice row). The grid is layout and is honest; say so rather than redrawing.
- **Its header shows no palette chip, and the gear *is* drawn at the rail's foot** (`editor-shell.html`, the last glyph in the rail before the pane). The gear is already drawn; whether its stroke weight and placement match the landed rail is plan 2's shell section, not this one — **do not edit the shell half of this file**.

- [ ] **Step 4: List every difference, and account for each**

Compare **language, not pixels**: scale, spacing, alignment, hierarchy, colour roles, control treatment, icon weight. Platform font metrics, scrollbar widths, device pixel ratios and antialiasing are not drift (`mockups/README.md`, `screenshots/README.md`). The expected deliberate differences, each with its reason:

- **The printed publish chord is `Ctrl+Shift+P` on this machine, not `⌘⇧P`.** `display.ts` prints the platform's own caps, and the mockup draws the Macintosh spelling — the same difference the `keyboard-tooltip` capture already records for `Ctrl+D`.
- **Preserve the two-swatch palette cards.** Choice-row radio semantics do not require a visually plain text row. The swatch adornment can show ground and accent exactly as the original; keyboard selection and measured contrast strengthen this preview rather than replacing it.
- **Keyboard is a product-action reference with editing.** The reviewed mockup no longer invents an "Enter group" binding. `CONTEXT_SHORTCUTS`' Escape exits a group; it is not an Enter binding and is not a rebindable product row. Compare the effective table and the sheet without conflating those actions.
- **The mockup's illustrative copy** (`System dashboard`) is the starter's; the capture shows the starter's own names.

  **If the list is empty, say so as a finding** with what was compared and which capture could have failed. A gate that produces no comparison has not run (§13.4), and an empty difference list is a finding rather than a pass.

- [ ] **Step 5: Re-run the captures this plan moved**

`shell-palette-*` now goes through the gear, and `keyboard-reference` still opens the `?` sheet — both must be re-captured against the rebuilt bundle, since `choosePalette`'s route changed and the sheet's chords may now differ from the defaults. Capture only actions affected by this change, one worker, built bundles.

- [ ] **Step 6: Commit**

Commit the spec changes, the registration row(s), the mockup correction and the images together. **Tell the user the images exist before staging them, and inspect them first** (`AGENTS.md`: inspect selected visual evidence before staging). Close no register row; name in the message which half of which row the commit answers, and confirm §12 row 5 is discharged with §12 row 6 (iconography and copy) as the next plan.

---

## Out of scope

Named so a later plan owns them rather than this one growing.

- **The shell, the rail's four slots, the header's shape and its publish control's structure, the panes' chrome, the status bar, the stage's three corners and the dock's re-layering** are plan 2's. This plan adds one button to the rail's foot, removes one control from the header, and prints one chord on a control plan 2 built — nothing else in the shell moves.
- **The inspector** is plan 3 (`2026-10-08-the-inspector.md`). **The panes' contents** (Composition's rows, the Add pane rebuilt with its card unit tiles and the asset path absorbed — `vg-154`'s insert half —, the Tokens pane with its paint and preset lists — `vg-153`, `vg-094` — and the Document pane's four scopes) are plan 4's (`2026-10-08-the-panes.md`). This plan neither opens a pane nor rewrites one.
- **The closed glyph set, the accessible-name/tooltip single owner across every surface, and the copy rules** are plan 6's (`2026-10-08-iconography-and-copy.md`), which censuses what plans 1–5 landed. This plan uses the existing tooltip owner and the existing glyph family, closes no set, and leaves plan 6's audit nets to plan 6.
- **The palette *mechanism*** — the six palettes, the per-element resolution, the OS fallback and the attribute — is `0035`'s and is untouched. **What changes is the readout**, not the mechanism (spec §10).
- **`View` keeps its three settings in the menubar.** The mockup's `Canvas` tab is not built, and neither is any subset of it moved into Settings.
- **The product-version source** is not established here; Task 4 records it as a finding instead.
- **Nothing in the canvas, the player, `renderer-core`, the host or the theme format.** No theme-format change; no second persistence mechanism; the palette choice and the binding overrides stay browser-local and never enter an envelope.
- **`vg-172`, `vg-185`, `vg-187` and `vg-192` stay open** and are not answered here.
- **Phone layout remains separate** (`vg-172` stays open). Desktop constrained-width, 200% zoom and modal scrolling/focus reachability still require bible §7.7's proof; this exclusion cannot waive those checks.

## Self-review

- **Spec coverage.** §3.2's gear is Task 1; §7's Appearance tab is Task 2; §7's Keyboard tab is Task 3; §7's About tab is Task 4; §10's "the readout changes, not the mechanism" is Task 2 with the mechanism untouched; §2.3 is Tasks 2 and 5, with each re-pointed locator proven red; §9's count is Task 5; §13 is Task 6; §12's row 5 is this document. §3.1's ruling that `View` stays is a Global Constraint and Task 6's mockup correction, not a task, because the work is *not moving something*. §1's normative bible is consumed by every task, each citing it rather than restating it, and amended exactly once (Task 2, §5's choice row).
- **Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every step names a file, a symbol, a command or an expected output.
- **Type consistency.** `SettingsTab` is the modal's vocabulary and matches §7's three tabs; `ShortcutOverrides` is keyed by `ProductShortcutId`; `activeShortcuts()` is the one live table and `PRODUCT_SHORTCUTS` remains the defaults' owner; `ControlChoiceRow` is the one control this plan adds and the bible names it in the same commit; `clearShellChoice` mirrors `clearShortcutOverrides` — removing the key is "no choice" in both.
- **Review Focus.** Each of the eleven is pinned above to a task, and each is a failure no existing test would catch.
- **Red proofs.** Every task states the break that must fail its own gate, Task 5 re-proves every re-pointed locator with its behaviour disabled, and Task 6 states an empty difference list as a finding rather than a pass.
- **The register.** No row closes here; Task 4 files one finding from its commit trailer; `vg-172`, `vg-185`, `vg-187` and `vg-192` stay open.
