# Iconography and Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the editor's glyph vocabulary and its copy over the surfaces plans 1–5 landed: one stroke weight within bible §6's 1.6–1.8px band through one owner, the object-kind glyph set closed against the kind list, one string owning both an icon-only control's accessible name and its tooltip, and copy that claims only what the code can do — then check the spec's own Acceptance section item by item, and finish with the §13 parity gate.

**Architecture:** Nothing here is designed, and no surface is rebuilt. By the time this plan runs, plans 1–5 have moved every editor surface to React and onto one control set, which is exactly when a glyph set drifts: each plan added its icons as it needed them and wrote its copy in passing. So the plan's first task is a **census of the code as it landed**, not of what the earlier plans intended, and everything after it is closure over what the census finds. The glyphs get one owner (`editor-shell/icons.ts`) and one weight, because there is no chrome-glyph owner today: direct-import sites include chrome, declarations and authored scene-icon sources; their current count is measured in Task 1 and the tree carries three stroke weights (1.75, 2, 2.5). The accessible-name/tooltip pairing gets one owner (plan 1's `ControlIconButton`, extended) because today each call site wires the two strings by hand. The copy rules become tests over the React surfaces, extending the nets that already exist — `ui-copy.test.ts`'s pictograph rule and its no-literal-copy walk, and `accessible-names.dom.test.ts`'s `mountPanels` coverage list, whose own doc comment makes adding a surface to it the contract. No behaviour change and no new dependency: the family is `lucide-react`, already present and already the one family (`§6`, `0038`); the tooltip stays `controls/tooltip.ts` (`0033`).

**Tech Stack:** TypeScript, React 19, `lucide-react`, Tailwind v4 (`@theme`), Biome 2.x, Vitest (jsdom), Playwright, Node ESM scripts.

**Spec:** [`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`](../specs/2026-10-08-editor-design-language-design.md) — §8, §6, §3.3, §3.4, §5, §12 row 6, §13, Invariants, Non-goals, Acceptance
**Normative companion:** [`docs/design/design-language.md`](../../design/design-language.md) — §2, §4, §5.5, §6, §9, §10
**Reference:** [`docs/design/mockups/editor-shell.html`](../../design/mockups/editor-shell.html) and [`README.md`](../../design/mockups/README.md) for what a mockup is and is not
**Decisions:** [`0033`](../../decisions/0033-new-primitives-are-radix-the-tooltip-is-not.md) (the tooltip is not a primitive), [`0039`](../../decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md) (`components/ui/`), [`0040`](../../decisions/0040-the-design-token-ratchet-is-ours-not-a-biome-rule.md) (`scripts/design-tokens.*`)

## What this plan composes from plans 1–5

Plan 1 (`2026-10-08-gates-and-the-control-set.md`) lands the gates and the control set; plan 2 (`2026-10-08-the-shell-and-the-rail.md`) the shell and the rail; plan 3 (`2026-10-08-the-inspector.md`) the inspector; plan 4 (`2026-10-08-the-panes.md`) the panes; plan 5 (`settings-and-appearance.md`) the settings surface. **Step 1 of execution, before any edit, is the census (Task 1)**, and its first job is to reconcile this plan against what actually landed:

1. Read plan 1's Task 3 section, then read the landed `packages/editor/src/components/ui/`. Where the landed `ControlIconButton`'s props disagree with plan 1's Task 3 section, **the landed signature wins and this plan is wrong**. Task 4 extends it; if it already owns both the `aria-label` and the tooltip from one `label`, Task 4's extension step is deleted and only the migration and the test are left.
2. Read the landed `@theme static` block, `scripts/design-tokens.mjs` and `scripts/design-tokens.gated.json` — the `biblePx` list as landed (it already carries §6's `1.6`, `1.7`, `1.8`) and the gated union. If a decision note under `docs/decisions/` supersedes it, the note wins.
3. Read `editor-shell/rail.tsx` and `uiCopy.rail`: which glyph each slot carries (`§7.2` names stack, plus, palette, page) and which words replaced the pane bar's `layers` / `insert` / `assets` / `document`.
4. Read the landed `selection-inspector/` React column and the settings surface: which strings they render, and whether the inspector's glass refusal reached the row as text (`plan 3` Task 5) or stayed a tooltip.
5. Read plan 4's landed Composition row and Add pane. As plan 4 is written, its Task 1 gives the group arm a constant stack glyph and **deliberately leaves the other four arms as treatments** (a text sample, a chart family icon, a paint swatch, a thumbnail), and its Task 3 maps each of the eight card units to an **inline hand-authored stroke diagram** taken from the mockup — that is the "depicted unit tile" bible §6 allows. Plan 4's Out of scope states that "the closed glyph set is plan 6's". So Task 3 here closes the *vocabulary* over `LayerKind` and does not re-open the arms; and Task 2 here brings plan 4's hand-authored unit diagrams to the one weight without replacing them with a library glyph lucide does not have.
6. Read the landed `src/web/tests/e2e/design-language.spec.ts`, `docs/evidence/screenshots/README.md` and the registered captures it names. Task 9 **adds this plan's capture to that file**; it does not invent a procedure.

Where a plan has not landed a piece this plan consumes, say so in the first commit and hold the dependent step, rather than writing a parallel version of it.

## Global Constraints

- **No behaviour changes** (§2.3). Same fields, same eligibility gates, same refusals. **"Text is not the interface" is not a licence to remove a label that carries meaning**: bible §6 rule 1 is the bar, and a glyph whose word is ambiguous keeps its word. Deleting a word a control's meaning depended on is a behaviour change.
- **No new dependency, and one icon family.** `lucide-react` is present and is the one family (§6, `0038`). A second icon package is a plan failure. **Chrome glyphs are library glyphs**; a hand-authored chrome path is a second family by another name. The two documented exceptions are bible §6's own: a **filled** glyph where a stroke would be illegible at 12px, and the **card unit diagram** — a fixed set of eight, which plan 4 draws as inline stroke paths because lucide has no exact match and §6 permits a tile to depict a unit. Those eight are brought to the one weight by Task 2 and are not replaced. `new-fabric-theme-icons.ts` reads lucide's `__iconData` to author the *theme's* icons into Fabric JSON — that is scene content, not chrome, and it is not this plan's.
- **One owner per concept.** `object-actions.ts` stays the authority on which **action** icons are compiled in (`ownership.md`'s row: "their ids, labels, icons and eligibility"); this plan does not re-spell its set. `uiCopy` stays the one copy table. `layer-tree.ts` stays the projection. A new module that owns an enumeration **adds its `ownership.md` row in the same commit**.
- **A watchlisted path needs a note, and these paths already have theirs.** `components/ui/` is claimed by `0039`, `scripts/design-tokens.*` by `0040`. A new `editor-shell/icons.ts` is **not** watchlisted — the watchlist's own comment says the editor's "ordinary layout and copy are deliberately absent — a wrong decision there is visible on the next render rather than invisible". If a task finds it touches a watched path with no covering note, stop and land the note; do not re-spell the gate.
- **Scales and roles only.** Every value comes from plan 1's tokens (`--text-*`, `--radius-*`, `--space-*`, `--elev-*`) and bible §4's colour roles. **Every file a task converts joins `scripts/design-tokens.gated.json` in that same task.** §6's `1.6`–`1.8` are already in `biblePx`, so **a stroke width is legitimate where a spacing value would not be** — and the text scan still cannot see a component prop, which is why Task 2's closure is a DOM assertion and not a grep.
- **The one tooltip owner is `editor-shell/controls/tooltip.ts`.** It is a DOM function, not a component, because the inspector built elements with `document.createElement` and never saw React. Do not add a tooltip component (`0033`), and do not re-implement its positioning.
- **The nets that already exist are the ones to extend.** `packages/editor/src/ui-copy.test.ts` (the pictograph rule over the table; the no-literal-copy walk; the unit-display single owner) and `packages/editor/src/accessible-names.dom.test.ts` (the accessible-name audit, whose `mountPanels` list is its own stated coverage). A new net beside them is a second audit.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled. No licence headers; comments are 1–3 lines and explain *why*. 500 lines is a signal and 800 is a stop.
- Run from `src/web/`; the scripts are `package.json`'s. Stage explicit paths; never `git add -A`. Conventional Commit titles.
- **`tests/e2e/` belongs to no tsconfig (`vg-192`)**, so a bad locator there is caught by nothing but running the spec. `tests/e2e/` is also absent from the design-tokens watchlist (tests are excluded), so a gated list never names one.
- **Playwright previews built bundles.** Rebuild after any source change and after reverting a deliberate break. `VIGILIA_CAPTURE=1` and `--workers=1` for any capture; capture only actions registered in `docs/evidence/screenshots/README.md`.
- **A new test must be shown to fail when the behaviour it guards is disabled**, before it is trusted. Every task below states its red proof.
- **The register.** No row is closed by this plan unless the census adjudicates it: `vg-181` (the copy table states its contract twice, in one owner) and `vg-182` (an Escape display cap nothing can reach) are read in Task 1 and the ruling recorded there. `vg-182`'s cause is not established and it stays open. `vg-172`, `vg-185`, `vg-192` and `vg-199` stay open. Grep `docs/product/backlog-archive.jsonl` before filing anything: `vg-024` (locked is a filled lock), `vg-092` (icon fill flooding), `vg-183` (pictographs in the copy table), `vg-103` and `vg-108` (unassociated fields) are already `verified` and are not re-filed.

## Review Focus

The spec implies these and no task's tests exercise them. Each is pinned to the task that owns its code.

1. **A census that measures the plans' intentions rather than the code.** The whole point of doing this last is that the earlier plans' descriptions of their own glyphs are not evidence of what shipped. A census that reads the earlier plan files instead of the landed source produces a work list of fixes to code that does not exist and misses the drift that does. → Task 1.
2. **"One weight" read as licence to delete a weight that was carrying meaning.** The menu tick is drawn at 2.5 and the severity glyph at 2 because at 12–13px the lighter stroke reads faintly. Bible §6's own escape for that is **a filled glyph where a stroke would be illegible at that size** — not a second stroke weight, and not a heavier `--faint`. Reaching for the escape is a bible amendment in the same commit; reaching for a second weight is the drift this task removes. → Task 2.
3. **A kind glyph set closed against a second spelling of the kind list.** "Every kind has a glyph" passes trivially if the test enumerates the glyph map's own keys. The list must come from the kind vocabulary, and there are two places a kind has to reach — the type and the copy table's `layerKindLabels`. → Task 3.
4. **A single-owner claim that leaves the hand-wired pairs in place.** The most-finished-looking surfaces are the ones wired by hand: `canvas-dock.tsx` passes `label` to both `aria-label` and `tooltip({ text: label })` with nothing joining them, and a test of `ControlIconButton` alone says nothing about it. → Task 4.
5. **A copy test that passes because it rendered nothing.** The no-literal-copy walk collects the labels a surface actually rendered; a surface that failed to mount contributes an empty list and the assertion holds. The failure is silent, and it is the shape `vg-114` already recorded once. → Task 5.
6. **Fixing a copy string by deleting the control it describes.** A string that over-claims is repaired by making the code able to do what the string says, or by withdrawing the claim — never by removing the control. Bible §9's "never assert a capability the code does not have" is not "say less". → Task 6.
7. **A missing reading repaired into a zero.** Bible §9's last rule and the product's "never fabricate a reading" invariant meet here, and the tempting repair for an unarrived sample is `0`. A statement of the gap that reads as data is the same defect in other words. → Task 6.
8. **An acceptance item reported met without the observation.** §13 exists because the previous pass closed against an editor that looked unchanged. An item whose evidence is a plan's own claim, or a command whose output nobody read, is not evidence. → Tasks 8 and 9.
9. **A parity capture of a screen the plan did not change, or an empty difference list.** This plan changes no surface's *layout*, so the temptation is to re-capture plan 2's image and call it parity. What changed is the glyph weight and the strings inside those surfaces, and that is what the comparison is of. A `--grep` matching nothing exits 0. → Task 9.

---

## Phase 1 — The census and the glyph set

What landed is measured before anything is changed; the glyphs get one owner and one weight; the kind glyph set closes against the kind list.

### Task 1: The census of what landed

**Outcome:** A written inventory, in the commit, of every chrome glyph site and its weight, every surface that owns copy, every icon-only control and whether its accessible name and tooltip are one string, and every string that names a capability — each marked as either **already closed by a plan** (a reconciliation item) or **open** (this plan's work list). The later tasks' file lists are corrected from it in the same commit.

**Owning symbols/landmarks:** every module that imports `lucide-react` in `packages/editor/src` as it stands after plans 1–5 (`diagnostic-message.tsx`, `layer-panel.tsx`, `palette-menu.tsx`, `shell-layout.tsx`, `font-picker/font-picker.tsx`, `object-actions.ts`, and whatever plans 1–5 added); `object-actions.ts`'s `OBJECT_ACTIONS` / `ARRANGE_ICONS`; `layer-panel.tsx`'s `CHART_ICONS` / `TWISTY_ICONS` / `LOCK_STATES`; `ui-copy.ts`; `controls/tooltip.ts`; `ui-copy.test.ts`; `accessible-names.dom.test.ts`.

**Files:**
- Modify: this plan file, and only where the census disagrees with a later task's file list or expectation (the census wins; say in the commit which lists moved)
- Modify: no file under `packages/editor/src/**` or `tests/e2e/**`

**Interfaces:**
- Consumes: the landed code of plans 1–5.
- Produces: the four inventories below, and the register ruling on `vg-181` and `vg-182`.

- [ ] **Step 1: Inventory the glyph sites and their weights, from the source**

```bash
cd src/web
grep -rl "lucide-react" packages/editor/src | sort
grep -rn "strokeWidth" packages/editor/src --include=*.tsx --include=*.ts | grep -v "\.test\."
grep -rn "LucideIcon\b" packages/editor/src --include=*.ts --include=*.tsx | grep -v "\.test\."
```

Expected as this plan is written — and **re-measured, because plans 1–5 have moved since**: nine files import lucide (of which `lucide-icon-node.d.ts`, `new-fabric-theme-icons.ts` and `object-actions.ts` are not chrome), and the chrome call sites carry **three** weights, `1.75` (canvas dock, layer panel, pane bar, font picker), `2` (the diagnostic severity glyph) and `2.5` (the two menu ticks). Record every file, every weight and every size. Any site whose weight is outside §6's band, and any site that is a hand-authored inline SVG rather than a lucide component, is an **open** item.

- [ ] **Step 2: Inventory the copy-owning surfaces and the accessors**

```bash
cd src/web
grep -rn "uiCopy\." packages/editor/src --include=*.tsx | grep -v "\.test\." | wc -l
grep -rn "uiCopy\." packages/editor/src --include=*.ts --include=*.tsx | grep -v "\.test\." | sed 's/:.*uiCopy\.\([a-zA-Z]*\).*/ \1/' | sort -u
grep -rn "aria-label\|title=\|tooltip(" packages/editor/src --include=*.tsx | grep -v "\.test\." | wc -l
```

For each accessor (`rail`, `panels`, `menus`, `actions`, `arrangeLabels`, `display`, `publish`, `view`, `inspectorFields`, `shortcuts`, …) record the surfaces that read it. A surface that renders a string **not** reachable from `uiCopy` is an open item of the same class `ui-copy.test.ts`'s second case names.

- [ ] **Step 3: Inventory the icon-only controls and their pairings**

```bash
cd src/web
grep -rn "<button" packages/editor/src --include=*.tsx | grep -v "\.test\." | wc -l
grep -rn "aria-label" packages/editor/src --include=*.tsx | grep -v "\.test\." | wc -l
```

For every element whose text content is empty and which is focusable, record whether it has an accessible name and whether it has a tooltip, and **whether the two strings are the same string by construction or by hand**. `canvas-dock.tsx`'s `Action` and `ArrangeAction` are the standing example of by-hand; `layer-panel.tsx`'s row affordances carry an `aria-label` and no tooltip. Both are open items unless a plan closed them.

- [ ] **Step 4: Inventory the strings that name a capability, and the readings that can be absent**

Read bible §9's last two rules against the table and the surfaces: list every string that names an action, a dismissal or a state (the publish pair, the view menu's readings, the rail's `insertObject`, the save state, the live indicator), and check each against a control that can actually run it. Separately list every surface that renders a reading which can be **absent** — the hosting state, a chart's unarrived sample, a resolution row, the status bar's counts — and record for each what it renders when the reading is missing. `0`, `-`, `—` and `--` are findings; a stated gap is not.

- [ ] **Step 5: Adjudicate `vg-181` and `vg-182`, and the duplicates**

```bash
cd src/web
grep -rn "icon\|glyph\|aria-label\|tooltip" ../../docs/product/backlog-archive.jsonl | head
```

`vg-181` (the copy table states its contract twice) names one owner and an established cause; a doc-comment repair has no regression test, so under `AGENTS.md`'s rule it is **not** a fix-on-the-fly — record the ruling, and if it is fixed say which of the two comments was removed and why the survivor is the owner. `vg-182`'s cause is not established and it stays open; record which two readings fit. Name in the commit which half of which row the commit answers.

- [ ] **Step 6: Prove the census instruments without damaging the tree**

Use known positive source sites plus scratch fixtures outside the repository.
Do not append to production files in this read-only task, do not reference the
palette menu plan 5 may have deleted, and never use `git checkout --` to erase
an unknown working-tree diff. Appending an import to a file already importing
lucide does not increase importer count; an unrendered variable is not rendered
copy. The instrument must distinguish those cases. Later Task 5's negative
proof renders a real changed label through a mounted surface. A no-match result
and a command failure are separate outcomes; record exit and collected results.

- [ ] **Step 7: Write the inventory, correct the later tasks, and commit**

The commit body carries the four inventories, the counts, the reconciliation items and the open work list, and names which of Tasks 2–6's file lists the census corrected. Stage this plan file and nothing else.

---

### Task 2: One icon vocabulary, one weight

**Outcome:** One module owns the chrome glyph vocabulary and the one stroke weight; every chrome glyph in the editor renders from it at that weight; chrome components import glyphs through the two owners; authored scene-icon generation and declaration files remain explicitly outside that chrome restriction.

**Owning symbols/landmarks:** the new `editor-shell/icons.ts`; `object-actions.ts`'s icons (read, not moved); `diagnostic-message.tsx`'s `SEVERITY_ICONS`; `palette-menu.tsx`'s and `shell-layout.tsx`'s `Check`; `font-picker.tsx`'s `Star`; `layer-panel.tsx`'s `CHART_ICONS` / `TWISTY_ICONS` / `LOCK_STATES`; the rail's and panes' glyphs from plan 2; `controls/tooltip.ts` (read).

**Files:**
- Create: `packages/editor/src/editor-shell/icons.ts`, `packages/editor/src/editor-shell/icons.test.tsx`
- Modify: `packages/editor/src/editor-shell/diagnostic-message.tsx`, `palette-menu.tsx`, `shell-layout.tsx`, `layer-panel.tsx`, `packages/editor/src/font-picker/font-picker.tsx`, the Add pane's card unit tile module (plan 4's, whose eight diagrams are hand-authored), and every file the census listed as carrying a chrome glyph
- Modify: `scripts/design-tokens.gated.json` (add every file above)
- Modify: `docs/architecture/ownership.md` (one row: the chrome glyph vocabulary)
- Modify: none of `object-actions.ts`, `new-fabric-theme-icons.ts` or `lucide-icon-node.d.ts`

**Interfaces:**
- Consumes: the census's glyph inventory; `lucide-react`; plan 1's tokens and `ControlIconButton`; plan 4's eight card unit diagrams.
- Produces:

```ts
// icons.ts — the one chrome glyph vocabulary. One family (lucide), one weight
// (§6's 1.6–1.8 band), and the named glyphs the shell and the panes read.
export const GLYPH_STROKE_WIDTH = 1.75;
/** A chrome glyph, and the one place its weight is set. */
export function Glyph(props: {
  readonly icon: LucideIcon;
  readonly size: number;
  readonly filled?: boolean;   // §6: only where a stroke is illegible at 12px
}): React.JSX.Element;
export const RAIL_GLYPHS: Readonly<Record<"composition" | "add" | "tokens" | "document", LucideIcon>>;
export const TWISTY_GLYPHS: Readonly<Record<"collapsed" | "expanded", LucideIcon>>;
export const LOCK_GLYPH: Readonly<Record<"locked" | "unlocked", { readonly icon: LucideIcon; readonly filled?: true }>>;
```

- [ ] **Step 1: Write the failing test for the one weight, from the rendered DOM**

`icons.test.tsx`, jsdom, mounting a surface that renders several glyphs:

```tsx
it("draws every chrome glyph at the one weight", () => {
  const weights = new Set(renderedGlyphs().map((svg) => svg.getAttribute("stroke-width")));
  expect(weights.size).toBe(1);
  const [only] = [...weights];
  expect(Number(only)).toBeGreaterThanOrEqual(1.6);
  expect(Number(only)).toBeLessThanOrEqual(1.8);
});
it("keeps the family one, so no chrome glyph is a hand-authored path", () => {
  // `icons.ts`, `object-actions.ts` and the theme icons are the three sources;
  // the eight unit diagrams are §6's documented depiction and are listed by name.
  expect(glyphSources()).toEqual(["icons.ts", "object-actions.ts", "new-fabric-theme-icons.ts", "card-unit-diagrams"]);
});
```

`stroke-width` is a real attribute lucide writes on the rendered `<svg>`, which is why this reads the DOM rather than the source: the text scan in `design-tokens.mjs` cannot see a component prop. The eight card unit diagrams are inline SVG rather than lucide components, so they carry `stroke-width` too and must satisfy the same one-weight case — that is how plan 4's hand-authored paths are brought to the band without being replaced.

Run: `npx vitest run packages/editor/src/editor-shell/icons.test.tsx`
Expected: **FAIL** — the module does not exist and the weight set has three members.

- [ ] **Step 2: Write the vocabulary, and take §6's escape rather than a second weight**

One weight, one `Glyph`, one `size` per call site (the sizes plan 1 and 2 chose are not this task's to re-decide; record them in the commit). The three weights collapse to one **within the band**, and where a 12px tick or a 13px severity mark reads faintly at that weight, the answer is §6's own escape — a `filled` glyph — **not** a second stroke weight. If a case needs something the bible does not allow, **amend bible §6 in the same commit** and say so, rather than leaving a local exception (`design-language.md`'s own first paragraph).

- [ ] **Step 3: Migrate every chrome call site**

Replace each direct lucide usage in the census's list with the vocabulary. `object-actions.ts` is **not** migrated: it is the authority on action icons and keeps its imports, and the surfaces that render an action read `action.icon` as they do now. The new `icons.ts` may read a lucide component; nothing else may. The eight card unit diagrams keep their hand-authored paths — lucide has no exact match and §6 allows a unit tile to be depicted — but take `GLYPH_STROKE_WIDTH` so they are inside the band with everything else.

- [ ] **Step 4: Add the ownership row, in the same commit**

`ownership.md` gains one row under **Editor**: the chrome glyph vocabulary and its one weight → `editor/src/editor-shell/icons.ts`. The map's own rule is that "if you add a module that owns an enumeration, add the row in the same change".

- [ ] **Step 5: Red proof — the weight rule fires on one planted weight**

Set one call site back to `strokeWidth={2}` and re-run. Expected: **the one-weight case fails**, naming the two weights. Restore it, then confirm the family case fires by adding a direct import to a converted file.

- [ ] **Step 6: Turn the ratchet green, verify, commit**

Add `icons.ts` and every converted file to `scripts/design-tokens.gated.json`, then:

```bash
cd src/web
npm run design:check ; echo "EXIT=$?"
npm run build
npx vitest run packages/editor/src/editor-shell/ packages/editor/src/font-picker/
```

Expected: exit 0, then green. Commit with the before/after weights from the census.

---

### Task 3: The kind glyph set is closed against the kind list

**Outcome:** The object-kind glyphs are exactly the kinds the editor can hold, checked by a test that fails when a kind has no glyph; a group carries the generic stack glyph; a card *unit* tile may still be depicted, because the card library is a fixed set of eight.

**Owning symbols/landmarks:** the kind vocabulary — `layer-tree.ts`'s `LayerKind` (`"text" | "shape" | "chart" | "group" | "image"`) and its `LayerMark`; `uiCopy.panels.layerKinds` (the one other table a kind must reach); `insertGroups()` in `new-object-panel.ts` (the insertable kinds: card units from `CARD_LIBRARY`, text, `SHAPE_KINDS`, `CHART_FAMILIES`); plan 4's Composition row and its Add-pane tiles, and `layer-panel.tsx`'s `kindOf` until plan 4 replaces it.

**Files:**
- Modify: `packages/editor/src/editor-shell/icons.ts` (`KIND_GLYPHS`)
- Modify: `packages/editor/src/editor-shell/icons.test.tsx`
- Modify: plan 4's Composition row and Add-pane tile modules — **the census names them**; where plan 4 owns a kind→component map, delete the duplicate decision and read `KIND_GLYPHS` instead
- Modify: `scripts/design-tokens.gated.json` (the row and tile files, if not already in it)

**Interfaces:**
- Consumes: Task 2's `icons.ts`; `LayerKind`; `uiCopy.panels.layerKinds`; `insertGroups()`.
- Produces:

```ts
/** Exactly one glyph per object kind, and the compile-time half of the closure:
 *  a new `LayerKind` with no glyph here does not build. */
export const KIND_GLYPHS = { text: …, shape: …, chart: …, group: …, image: … }
  satisfies Readonly<Record<LayerKind, LucideIcon>>;
/** §6's own rule: a group is an arbitrary set of elements, so it cannot be
 *  depicted — it gets the stack glyph and its name. */
```

- [ ] **Step 1: Write the failing totality test, against the kind vocabulary rather than the map**

```tsx
it("gives every kind a glyph, so a new kind cannot arrive without one", () => {
  // The list comes from the kind vocabulary, never from KIND_GLYPHS' own keys.
  expect(Object.keys(KIND_GLYPHS).sort()).toEqual(Object.keys(uiCopy.panels.layerKinds).sort());
});
it("draws a group with the generic glyph rather than a diagram of it", () => {
  expect(KIND_GLYPHS.group).toBe(STACK_GLYPH);
});
```

Run: `npx vitest run packages/editor/src/editor-shell/icons.test.tsx`
Expected: **FAIL** — `KIND_GLYPHS` does not exist.

- [ ] **Step 2: Build the set, with both halves of the closure**

The **compile-time half** is the `satisfies Readonly<Record<LayerKind, LucideIcon>>` above: a kind added to the type with no glyph does not build. The **runtime half** is the comparison against `uiCopy.panels.layerKinds`, which is the other table a kind must reach (its doc comment already says "Keys mirror `LayerKind`"). Both are needed because neither sees the other's failure: a type-level totality is invisible to a focused run, and a focused run is what a plan executes.

Also assert the insertable side: every kind `insertGroups()` offers resolves to a glyph, so a card, a text, a shape and a chart are each drawable in the Add pane. **The card unit tiles are the allowed exception** (§6): a tile may carry a diagram of what the unit builds, because the library is a fixed set of eight; a *layer row* may not depict an arbitrary group (bible §10).

- [ ] **Step 3: Give the row and the tiles one owner**

If plan 4 shipped a kind→component map, its membership moves here and the row reads `KIND_GLYPHS`. Plan 4 as written already made the two decisions this task must not re-open: **the group arm is a constant stack glyph** introduced precisely so the mark cannot be derived from the group's children, and **the other four arms stay treatments** (a text sample in the object's own face, a chart family icon, a paint swatch, a thumbnail) because "a swatch and a thumbnail each carry a fact a glyph cannot". So this task closes the *vocabulary* over `LayerKind` and records which arms are glyphs and which are depictions; it does not convert a treatment to a glyph. The one thing it may not leave standing is a mark that claims to depict an arbitrary group or a card (bible §10, `§5.1`) — plan 4's Review Focus 2 exists for the same reason, and the two tasks' red proofs are the same failure seen from either end.

- [ ] **Step 4: Red proof — the set opens when a kind is added**

Delete `image` from `KIND_GLYPHS` and re-run. Expected: **the totality case fails** and, separately, the build fails on the `satisfies`. Restore it. Then add a member to `LayerKind` (`"video"`) and confirm the build fails until a glyph is added; revert both.

- [ ] **Step 5: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/editor-shell/`, then commit with the kind list and the glyph list side by side.

---

## Phase 2 — One string, and the copy

Every icon-only control's accessible name and tooltip become one string by construction; the copy nets reach the React surfaces; the copy defects the census found are fixed as defects.

### Task 4: The accessible name and the tooltip are one string, one owner

**Outcome:** Every icon-only control in the editor declares one `label`, from which plan 1's `ControlIconButton` produces both the `aria-label` and the tooltip through `controls/tooltip.ts`; no call site wires the two by hand; the controls that had no tooltip are adjudicated one by one against bible §6 rule 1.

**Owning symbols/landmarks:** `components/ui/control-icon-button.tsx`; `controls/tooltip.ts` (read, not rewritten); `canvas-dock.tsx`'s `Action` and `ArrangeAction` (the census's standing hand-wired pair); `layer-panel.tsx`'s row affordances; plan 2's `rail.tsx` slots, `pane.tsx` footers, publish control and display switch; `accessible-names.dom.test.ts` and its `mountPanels` list.

**Files:**
- Modify: `packages/editor/src/components/ui/control-icon-button.tsx`, `packages/editor/src/components/ui/control-icon-button.dom.test.tsx`
- Modify: `packages/editor/src/editor-shell/canvas-dock.tsx`, `layer-panel.tsx`, `rail.tsx`, `pane.tsx`, `publish-control.tsx`, `display-switch.tsx`, `canvas-context-menu.tsx` — whichever exist as landed, and every other file the census listed. Plan 4 explicitly leaves `canvas-context-menu.tsx` alone and names this plan for it; the layer row's own footer buttons are already plan-1 icon buttons in plan 4, so that half is a reconciliation item, not work.
- Modify: `packages/editor/src/accessible-names.dom.test.ts` (mount the React surfaces; its own contract says a panel not mounted here is not audited)
- Modify: `scripts/design-tokens.gated.json` (the converted files)

**Interfaces:**
- Consumes: plan 1's `ControlIconButton`; `tooltip()`; `shortcutLabel` / `shortcutSpokenLabel` from `shortcut-manager/display.ts`.
- Produces: `ControlIconButton({ label, destructive?, disabled?, shortcut?, onClick, children })`, owning both strings; the tooltip's `shortcut` is `{ printed, spoken }` because a single string cannot be both the mark that shows and the word that is announced (`tooltip.ts`'s own reason).

- [ ] **Step 1: Write the failing test — the two strings cannot disagree**

In `control-icon-button.dom.test.tsx`, and over mounted surfaces rather than the component alone, because a sweep of the component says nothing about a call site wired by hand:

```tsx
it("gives every icon-only control one string for its name and its tooltip", () => {
  for (const control of iconOnly(reachable(root))) {
    focus(control);                       // focus shows immediately; hover waits 600ms
    const popup = document.querySelector(".editor-shell-tooltip");
    expect(accessibleName(control)).not.toBe("");
    expect(popup).not.toBeNull();
    expect(tooltipActionText(popup!)).toBe(accessibleName(control));
  }
});
it("says how many icon-only controls carry no tooltip at all", () => {
  // Not an assertion of zero: §6 rule 1 decides per glyph, and the count is the
  // record. This case exists so the number cannot change unnoticed.
  expect(noTooltip(root).length).toBe(<the number Task 4's adjudication settled>);
});
```

`tooltipActionText` reads the tooltip's action-label element, excluding the separate shortcut annotation, without trimming or substring matching. A missing tooltip fails; "Delete extra" and "Delete " cannot pass equality to "Delete". Include SVGs containing titles in the icon-only census: SVG title text does not turn the button into a visible text control. `iconOnly` identifies controls with no visible text label, which needs no new production attribute; `accessibleName` is the same four-mechanism precedence `accessible-names.dom.test.ts` already implements (use it, do not write a second one).

Run: `npx vitest run packages/editor/src/components/ui/control-icon-button.dom.test.tsx`
Expected: **FAIL** on the dock's hand-wired pair and on every unconverted call site.

- [ ] **Step 2: Make `ControlIconButton` own both, and migrate**

The component sets `aria-label={label}` and opens `tooltip({ trigger, text: label, shortcut })` — one prop, two consumers, so they cannot drift. `canvas-dock.tsx`'s `Action` and `ArrangeAction` delete their own `tooltip()` effects and render through it. The inspector's React column uses it too. Where a surface needs the tooltip's `aria-describedby` behaviour, that is `tooltip.ts`'s and unchanged.

- [ ] **Step 3: Adjudicate the controls that carry no tooltip**

The census's count is the list. For each, bible §6 rule 1 decides: a standard glyph carries a tooltip and the label is in the accessible name; **where even that is ambiguous, it stays a word** — and a word is a label, not a removal. Record the ruling per control in the commit, because the count in Step 1's second case is only meaningful against it.

- [ ] **Step 4: Add the React surfaces to the accessible-name audit**

`accessible-names.dom.test.ts`'s `mountPanels` gains the rail, a pane with its footer, the dock, the inspector column and the settings surface. Its existing cases then audit them for free; the file's own doc comment is the reason this belongs here and not in a new file.

- [ ] **Step 5: Red proof — two strings are possible again**

Append a space to one `label` on its way into the tooltip only (`text: `${label} ``) and re-run. Expected: **the one-string case fails**. Restore it. Then remove the `aria-label` from one control and confirm the accessible-name audit's own unnamed case fails.

- [ ] **Step 6: Ratchet, verify, commit**

Gated list, `npm run design:check ; echo "EXIT=$?"`, `npm run build`, then:

```bash
cd src/web
npx vitest run packages/editor/src/components/ui/ packages/editor/src/accessible-names.dom.test.ts packages/editor/src/editor-shell/
npx playwright test --project=desktop-chromium --grep "tooltip|name every control" --workers=1
```

Read the summary and confirm the tests you named ran — a `--grep` matching nothing exits 0. The registered `keyboard-tooltip` capture ("every canvas action's tooltip names the chord that runs it") is this rule's existing evidence; re-run it and record its result.

---

### Task 5: The copy nets reach the React surfaces

**Outcome:** A literal string in a React surface is caught by the same test that catches one in an imperative panel; menu rows are sentence case; the pictograph net is confirmed to be loaded by a run a plan actually executes.

**Owning symbols/landmarks:** `packages/editor/src/ui-copy.test.ts` (`pictographs`, the `spoken` walk, `copy()`, the three mounted panels and the font picker); `ui-copy.ts`; the menus (`shell-layout.tsx`'s `ShellMenuBar`, the view menu, the context menu); plan 2's rail and panes; plan 3's column; plan 5's settings surface.

**Files:**
- Modify: `packages/editor/src/ui-copy.test.ts`
- Modify: the React surface modules only where the census found a literal that is copy — each moved into `uiCopy`
- Modify: `packages/editor/src/ui-copy.ts` (the words the walk found, and no renaming beyond that)
- Modify: `scripts/design-tokens.gated.json` (the converted files)

**Interfaces:**
- Consumes: `uiCopy` and its `copy()` walk; the surfaces plans 1–5 landed.
- Produces: nothing new to import. This task is a net and the words it catches.

- [ ] **Step 1: Write the failing walk, and make it impossible to pass by rendering nothing**

Extend the `spoken` collection with the React surfaces. The failure mode is that a surface which fails to mount contributes `[]` and the assertion holds (Review Focus 5), so the walk asserts per surface that it rendered something:

```tsx
it("leaves the React surfaces with no copy of their own", () => {
  const root = mountLandedSurfaces();
  const owned = new Set(copy());
  expect(spokenIn(root).filter((text) => !owned.has(text))).toEqual([]);
  // A surface that rendered nothing would satisfy the line above by being absent.
  for (const surface of ["[data-vigilia-rail]", "[data-vigilia-canvas-toolbar]", …])
    expect(spokenIn(root.querySelector(surface)!).length).toBeGreaterThan(0);
});
```

Run: `npx vitest run packages/editor/src/ui-copy.test.ts`
Expected: **FAIL** on the per-surface non-empty cases and on every literal the census found.

- [ ] **Step 2: Move the literals into the table, and give the walk its surfaces**

Each string the walk reports either comes from `uiCopy` or is data (a token's name, a locale's, an asset's, a preset's — the existing test's own carve-out). A menu row, a section eyebrow, a control label and a refusal are copy.

- [ ] **Step 3: Sentence case for menu rows, enumerated by the menus**

Bible §9: sentence case for menu rows, the section eyebrows excluded because §2 makes them uppercase. The check is over the rows a **menu** renders, read from the menu's own test's list — not over the whole table, which holds `W`, `H`, `CPU`, `2K`, `(empty)` and `Left`/`Right`, none of which is a menu row.

- [ ] **Step 4: Confirm the pictograph net is in a run a plan executes**

`vg-183`'s own finding is that this net "is in a file no focused run loads". State which command loads it — the full unit suite or the focused path — and record it. Where a plan's focused run does not load it, name it in this task's verification so it is run, rather than moving the net a second time.

- [ ] **Step 5: Red proof — a literal and a capital**

Replace one actually rendered rail label with an unowned literal and confirm the rendered-copy walk reports it; an unused `const` is not a DOM negative proof; empty `mountLandedSurfaces`' rail mount and confirm the per-surface non-empty case fails rather than the walk passing; title-case one menu row in `uiCopy.menus` and confirm the sentence-case case fails. Revert all three.

- [ ] **Step 6: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npx vitest run packages/editor/src/ui-copy.test.ts`, then commit with the list of words that moved and the run that loads the pictograph net.

---

### Task 6: The copy defects are fixed as defects

**Outcome:** A missing reading renders as a stated gap and never as a zero or a dash that reads as data; every string that names a capability maps to a control that can run it; where the census found none, that is stated as a finding rather than left silent.

**Owning symbols/landmarks:** `uiCopy`'s reading strings (`inspectorFields.notSet`, `unresolved`, `runUnmapped`, `publish.unsaved`, `publish.live`, `saveState.unsaved`, `view.*`); `uiCopy.inspectorFields.glassRefused` and the blank-name family; plan 2's `PublishIndicator`, status bar, identity chip and `SaveState`; plan 3's resolution rows; plan 5's settings surface; the diagnostics module.

**Files:**
- Create: nothing — the copy rules are cases in the files that already own them
- Modify: `packages/editor/src/ui-copy.test.ts` (the two cases below)
- Modify: whichever surface the census found over-claiming or fabricating — the repair is in the code, never in withdrawing the control
- Modify: `packages/editor/src/ui-copy.ts` only where a word was wrong
- Modify: `scripts/design-tokens.gated.json` (the converted files)

**Interfaces:**
- Consumes: Task 1's inventory of absent readings and named capabilities.
- Produces: two cases that can fail, and a recorded count of the strings adjudicated.

- [ ] **Step 1: Write the failing test for the missing reading**

The distinction this case must not blur: a **measured** count of zero objects is a reading and prints `0`; an **unarrived** sample, an unknown hosting state and an unresolved token are absences and print the stated gap. The test is over the second kind only:

```tsx
it("states a missing reading as a gap rather than a zero or a dash", () => {
  for (const surface of absentReadingSurfaces()) {       // hosting unknown, sample unarrived, token unresolved
    const text = render(surface).textContent?.trim() ?? "";
    expect(placeholderReadings).not.toContain(text);      // "0", "-", "--", "—", "0.0"
    expect(text).not.toBe("");
  }
});
```

`PublishIndicator` returning `null` for an unknown host (plan 2 Task 4) is the shape this generalises: nothing is drawn rather than a claim being drawn. Where a surface must draw something, it draws the gap's own word.

Run: `npx vitest run packages/editor/src/ui-copy.test.ts -t "missing reading"`
Expected: **FAIL** on whichever surface the census found printing a placeholder.

- [ ] **Step 2: Repair the surfaces, not the strings**

A reading repaired into `0` is the product's "never fabricate a reading" invariant broken in the one place an author reads it. Fix the surface: render the gap, or render nothing where nothing is the truth.

- [ ] **Step 3: Repair the over-claims, by capability or by withdrawal**

For each string the census listed as naming a capability, either the control can do it (and a test proves the control), or the claim is withdrawn in words. **The control is never deleted to make the string true** (Review Focus 6). The `⌘⇧P` chord is the known case: plan 2 drew the button alone and recorded the missing chord as a deliberate difference, and plan 5 binds it — verify which, and if it is still unbound, the difference is re-recorded here with the plan that owns it.

- [ ] **Step 4: Red proof — the gap and the over-claim**

Make one surface render `"—"` for its absent reading and confirm the gap case fails. Then withdraw one control the copy names (disable it) and confirm the capability case fails rather than the string being the only thing left. Restore both.

- [ ] **Step 5: State an empty census as a finding**

If Task 1's inventory found no over-claiming string, say so in this commit with what was checked and the case that could have failed. An empty list from a check that could have found nothing is not evidence, and this is the one place in this plan where the honest answer may be "none".

- [ ] **Step 6: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npx vitest run packages/editor/src/ui-copy.test.ts`, `npm run build`, then commit with the count of strings adjudicated and the ruling on each.

---

## Phase 3 — The gate

### Task 7: The ratchet and the nets, over this plan's list

**Outcome:** Every file this plan converted is in `scripts/design-tokens.gated.json`, `npm run design:check` exits 0 over them, it still refuses to pass over an empty list, and the three closures this plan added — one weight, one string, no literal copy — are each shown to fail when broken.

**Owning symbols/landmarks:** `scripts/design-tokens.gated.json`, `scripts/design-tokens.mjs` (its proof is its own `--self-test`, chained into `gates:self-test` — not a second file), `npm run design:check`, `icons.test.tsx`, `control-icon-button.dom.test.tsx`, `ui-copy.test.ts`.

**Files:**
- Modify: `scripts/design-tokens.gated.json` (the union of every earlier task's additions)
- Modify: `scripts/design-tokens.mjs` **only** if a rule must change, in which case `--self-test` gains its case in the same commit and the reason is a decision note, not a plan edit

**Interfaces:**
- Consumes: plan 1's guard and its `--gated` argument, and `biblePx`'s `1.6`/`1.7`/`1.8`.
- Produces: the counts, in the commit. This task is a measurement.

- [ ] **Step 1: Measure what this plan converted**

```bash
cd src/web
node -e "const g=require('../../scripts/design-tokens.gated.json');console.log(g.gated.length, g.biblePx.join(','))"
grep -rn "strokeWidth" packages/editor/src --include=*.tsx | grep -v "\.test\." | sed 's/.*strokeWidth=//' | sort -u
grep -c "#[0-9a-fA-F]\{3,8\}" packages/editor/src/editor-shell/editor-shell.css
```

Expected: the gated union holds every file Tasks 2–6 converted; the weight column has **one** value and it is in the band; the `editor-shell.css` hex count is recorded as the before-state for whatever follows the redesign — it does not go to zero here, because the palettes are hex by design.

- [ ] **Step 2: Run the guard and prove it is still not vacuous**

```bash
cd src/web
npm run design:check ; echo "EXIT=$?"
printf '[]' > /tmp/gated.json && node ../../scripts/design-tokens.mjs --gated /tmp/gated.json ; echo "EXIT=$?"
node ../../scripts/design-tokens.mjs --self-test ; echo "EXIT=$?"
```

Expected: **0**, then **non-zero with a message naming the empty list**, then **0** with every rule's case reported. A guard over zero files reporting success is the defect `vg-149` is an instance of.

- [ ] **Step 3: Red proof — the three closures, one at a time**

Add a hex literal and an off-scale `px` to a converted file: expected **non-zero, naming the file and the value**. Then set one glyph's weight to `2`: expected the **one-weight case** fails — the text scan cannot see a prop, and saying so is part of this task. Then put a literal in a React surface: expected the **no-literal-copy walk** fails. Revert each, then re-run to green.

- [ ] **Step 4: Commit**

Commit the gated list with the counts and the three red proofs, and state which closures are a text scan's and which are a DOM assertion's — a reader who assumes `design:check` covers the weight will stop running the test that does.

---

### Task 8: The spec's Acceptance, item by item

**Outcome:** A written ledger, in the commit, of every item in the spec's Acceptance section: met or not met, with the evidence for each — and the four items no single plan owns checked **by observation on a rebuilt bundle**, not by citing a plan.

**Owning symbols/landmarks:** the spec's *Acceptance* section; the registered captures in `docs/evidence/screenshots/README.md`; the counts Task 7 recorded; plan 2's rail and `PublishIndicator`; plan 5's settings surface; `shell-appearance.spec.ts`'s `shell-palette-` capture; the display-lens outline `[data-vigilia-display-screen]`.

**Files:**
- Modify: nothing under `packages/editor/src/**` unless an item's evidence is a check that does not exist — in which case the check is added in the surface's own test file
- Modify: this plan file, recording the ledger's location if it is not the commit
- Add: no capture — Task 9's

**Interfaces:**
- Consumes: every task above, and every earlier plan's completion report.
- Produces: the ledger, and the list of items the six-plan sequence did **not** meet.

- [ ] **Step 1: The scales are consumed, by count**

`npm run design:check` over the gated union, plus the browser assertion plan 1 built (every gated element's computed spacing on the bible's scale). Record both, and record the gated union's size and the files **not** yet in it — an item met for a subset is stated as that subset.

- [ ] **Step 2: No native `<select>` and no native `input type=range`, counted before and after**

```bash
cd src/web
grep -rn 'createElement("select")' packages/editor/src --include=*.ts --include=*.tsx | wc -l
grep -rn "<select" packages/editor/src --include=*.tsx --include=*.ts | wc -l
grep -rn '"range"' packages/editor/src --include=*.ts | grep -i "type" | wc -l
```

The before-state, measured on this plan's branch point: **23** `createElement("select")` call sites across ten files (artboard panel, asset panel, chart panel ×4, `controls/settings-field.ts`, the new-document chooser, palette panel ×3, `selection-inspector/panel.ts`, `selection-inspector/runs.ts` ×6, the theme library dialog, type-preset panel ×4), **four** JSX `<select>` elements (`font-picker.tsx` ×3, `theme-library-dialog.ts` ×1), and **one** range builder (`controls/number-field.ts`, whose `type = "range"` is reached from `settings-field.ts`, `selection-inspector/glass.ts` and `selection-inspector/panel.ts`). The after-state is the same three commands. Any remaining site is named with the file and the plan that owns it, or recorded as a deliberate difference with its reason; **a count reported without the command's output is not evidence.**

- [ ] **Step 3: The four rail slots, one at a time, and the gear opens settings**

Observed in the browser on a rebuilt bundle: each of Composition, Add, Tokens and Document opens on its own, asking for the open slot closes it, and the rail's gear opens the settings modal rather than a fifth pane. Record the capture or the spec that ran, and which plan built each half.

- [ ] **Step 4: The stage draws no device frame**

Observed: the artboard sits on the stage with no bezel, notch or frame, and with a display lens chosen the one outline is `[data-vigilia-display-screen]` — a screen rect at 1px, hidden under Fit, which is the lens's own marking and not a device. Say which of the two the observation saw, because "no frame" reported from a Fit capture has not looked at the case that could show one.

- [ ] **Step 5: Six palettes distinguishable by surface**

Named evidence: the registered `shell-palette-` capture ("captures each palette's own surface"). Read the six images, not the six computed values — §9's superseded clause is about surfaces, and a computed-value comparison is the measurement the spec replaced. Record how many of the six were compared.

- [ ] **Step 6: Every plan's parity capture exists**

For plans 1–5, name the report and the image, and for each confirm the two were placed **side by side** with the differences listed. A plan that reported parity without the two images has not met this item, and this step is where that is said out loud. Then state which Acceptance items remain unmet and who owns them, or that none do. A required React surface or native control left by plans 3/5 is **not met**, not a deliberate waiver. Never announce the redesign closed while such an item remains.

**Interaction closure:** run spec §13.1's keyboard-only walkthrough on a rebuilt real host, with all six palettes checked for required text/focus contrast and forced-colours focus. Include long names, long unresolved references, the two-hundred-row tree, 1280×720/1440×900 and 200% browser zoom. Verify edit commit/cancel, stale-target rejection, no double history, popup return, palette selection and two-stage Escape during shortcut capture. Keep proofs in existing owner/browser suites. A colour-equality test or static mockup is not this evidence.

- [ ] **Step 7: Commit**

The ledger is the commit body: one item per line, `met` or `not met`, with its evidence. No register row is filed for an unmet item that already has one.

---

### Task 9: The parity gate, and the close

**Outcome:** Built bundles, this plan's changed surfaces captured by an action registered in `docs/evidence/screenshots/README.md`, the capture placed **beside** `docs/design/mockups/editor-shell.html` with every difference listed, each one either fixed or recorded in this commit as deliberate — and the plan closed.

**Owning symbols/landmarks:** `src/web/tests/e2e/design-language.spec.ts` (plan 1's harness — add this plan's capture to it, do not add a second procedure); `docs/evidence/screenshots/README.md`; the `keyboard-tooltip` and `shell-palette-` rows that already exist; `docs/design/mockups/editor-shell.html`; `STATUS.md`; this plan file.

**Files:**
- Modify: `src/web/tests/e2e/design-language.spec.ts`
- Modify: `docs/evidence/screenshots/README.md` (register the new action under **Editor visual-action checklist**, in the existing table's shape)
- Add: the produced images under `docs/evidence/screenshots/`
- Modify: `docs/design/mockups/editor-shell.html` and/or `README.md` **only** where the mockup is stale against the bible
- Modify: `STATUS.md`; move this plan to `docs/superpowers/plans/archive/`

**Interfaces:**
- Consumes: plan 1's harness; Task 8's ledger; the bible's §6 and §9.
- Produces: the comparison, the differences list, and the plan's final state.

- [ ] **Step 1: Write the capture so it fails if the glyphs are not the new ones**

The capture opens the state the mockup draws (plan 2's capture does: the Add slot open with nothing selected), asserts the language mechanically — every rendered glyph's `stroke-width` is the one value and it is in §6's band, and no icon-only control's tooltip disagrees with its accessible name — and then writes the image. Run it against a bundle from before Task 2 and confirm it **fails** rather than producing a picture of the old weights.

- [ ] **Step 2: Prove the run is not vacuous**

```bash
cd src/web
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "<the registered title>" --workers=1
```

Read the summary and confirm **1 test ran**, not 0. A `--grep` matching nothing exits 0 with zero tests, which is how a parity gate silently stops checking (Review Focus 9).

- [ ] **Step 3: Capture the changed surfaces**

This plan changes no layout, so the comparison is of the **glyphs and the words inside** the surfaces plans 2–5 built: the shell with Add open (the rail's four glyphs, the pane's footer, the status bar's readings), the dock over a selection, the inspector column, and the settings surface. Capture only the actions registered in the README, one worker, built bundles, `?static=1` and the controlled clock.

- [ ] **Step 4: Adjudicate the mockup against the bible — the mockup loses**

The reviewed shell preserves the original drawing's character: gradient artwork, compact glyph grids, subtle stage texture, fine chrome, floating clusters and palette swatches. Contract corrections keep four slots, 246px pane and three Settings tabs. Product glyphs still use the bible's band and currentColor; correcting reference stroke details must not redesign its composition. Re-read that current file and compare glyph language, not historical defects already removed. Inline paths in a reference are illustrations; product chrome uses the installed family, with the fixed unit-diagram exception. Inspect descendant path stroke overrides too: reading only each SVG root would miss a heavy arc. Scene artwork, QR symbols and deliberate filled state dots are not chrome stroke glyphs.

- [ ] **Step 5: List every difference, and account for each**

Expected differences, each either fixed in the task that owns it or recorded here as deliberate with its reason and its owner: any glyph whose shape differs between lucide and the mockup's hand-drawn path (the mockup draws a *shape*, the editor draws a *library glyph*, which is §6's one-family rule and is deliberate); a glyph the mockup draws that lucide has no exact match for; any weight the bible's escape forced to a filled glyph; the words (the mockup's copy is illustrative, `README.md` says so). Scale, rhythm and mono values are the comparison; platform font metrics, scrollbar widths, device pixel ratios and antialiasing are not drift.

- [ ] **Step 6: State an empty list as a finding**

If the comparison produces no differences at all, say so with what was compared and which capture could have failed — a gate that produces no comparison has not run (§13.4).

- [ ] **Step 7: Update `STATUS.md`, then commit and archive**

Replace "Last completed change" with 1–5 bullets on this commit, one item per line, never wrapped; keep the file to objective, active work, last completed change, next steps and blockers; run `npm run status:check` from `src/web/` before committing. Tell the user the images exist before staging them, and inspect them first. Commit the spec change, the registration row, the mockup correction and the images together; then move this plan to `docs/superpowers/plans/archive/` once nothing depends on it, naming which acceptance items are met and which remain blocked. Archive/close the six-plan sequence only if all required items pass; a blocked acceptance item keeps the objective open even when this plan's local glyph work is finished.

---

## Out of scope

Named so a later change owns them rather than this plan growing.

- **`object-actions.ts`'s action icons.** It is the documented authority on which action icons are compiled in (`ownership.md`); this plan reads it and re-spells nothing. Moving its icons into the glyph vocabulary would be a second decision about the same set.
- **`new-fabric-theme-icons.ts` and the theme's own icons.** Those build Fabric paths for the artwork inside the artboard; they are scene content the author owns, not chrome, and §6's weight is about the editor's chrome.
- **The player's chrome.** It has its own rules and this plan touches none of it.
- **`qr-symbol.tsx`.** A QR code is a picture drawn with `fill`, not a glyph with a stroke; it has no weight and is not in the one-weight set.
- **The canvas's own drawing** — selection handles, snap guides, rotation and size indicators (`controls-manager`, `snap-manager`, `indicator-manager`). Those are Fabric strokes on the artboard, not chrome glyphs.
- **Descriptor-owned chart labels stay descriptor-owned.** Plan 3 Task 3a makes chart rendering React; the copy audit distinguishes those existing descriptor labels from unowned UI literals. Do not create a duplicate `uiCopy` table for them or describe an imperative chart panel as a surviving exception.
- **`vg-172`, `vg-185`, `vg-192`, `vg-199` and `vg-182`** stay open. `vg-185`'s chord-rule comment is left exactly as it is, as plan 2 leaves it.
- **Deleting `editor-shell.css`'s now-unused token rules or the old `controls/` primitives.** A token leaves when its last consumer moves, and that is not a glyph or copy task.

## Self-review

- **Spec coverage.** §8's four requirements are Tasks 2 (one family, one weight), 4 (one string, one owner), 3 (the kind set closed with the kind list) and Tasks 4–5 (text is not the interface, with §6 rule 1 as the bar against removing a meaningful label); §9's copy rules are Tasks 5 and 6; §6's refusal in words is read where the census finds it; §12 row 6 is this document; §13 is Task 9 and Task 8's item-by-item ledger; the Acceptance section is Task 8 with the four no-single-owner items observed there and the comparison image produced in Task 9.
- **Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". The one number left open — Task 4 Step 1's `noTooltip` count — is deliberately settled by that task's own adjudication rather than predicted here, because a count predicted before the code exists is not evidence (`AGENTS.md`).
- **Type consistency.** `Glyph` is the one chrome glyph component and `GLYPH_STROKE_WIDTH` the one weight; `KIND_GLYPHS` is the closed kind vocabulary, declared `satisfies Record<LayerKind, LucideIcon>`; `ControlIconButton` takes one `label` and owns both strings; `absentReadingSurfaces()` and `placeholderReadings` are Task 6's two named sets, and a missing reading is a stated gap rather than a value.
- **Review Focus.** Each of the nine is pinned above to a task, and each is a failure no existing test would catch.
- **Red proofs.** Every task states the break that must fail its own gate; Task 7 re-proves the guard's empty-list refusal and names which closure is a scan's and which is a DOM assertion's; Task 9's capture is proven non-vacuous with one test run, not zero.
- **Owners.** No new dependency, no second tooltip component, no second icon family, no second kind list, no new net beside the two that exist, and the one new module's `ownership.md` row lands with it.
