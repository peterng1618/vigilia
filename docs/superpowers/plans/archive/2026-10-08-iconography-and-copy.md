# Iconography and Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the editor's glyph vocabulary and its copy over the surfaces plans 1–5 landed: one weight rule over §6's size tiers through one owner, the object-kind glyph set closed against the kind list, one string owning both an icon-only control's accessible name and its tooltip, and copy that claims only what the code can do — then check the spec's own Acceptance section item by item, and finish with the §13 parity gate.

**Architecture:** Nothing here is designed, and no surface is rebuilt. By the time this plan runs, plans 1–5 have moved every editor surface to React and onto one control set, which is exactly when a glyph set drifts: each plan added its icons as it needed them and wrote its copy in passing. So the plan's first task is a **census of the code as it landed**, not of what the earlier plans intended, and everything after it is closure over what the census finds. The glyphs get one owner (`editor-shell/icons.ts`) and one weight rule, because there is no chrome-glyph owner today: direct-import sites include chrome, declarations and authored scene-icon sources; their current count is measured in Task 1 and the tree carries four stroke weights (1.7, 1.75, 2, 2.5). The accessible-name/tooltip pairing gets one owner (plan 1's `ControlIconButton`, extended) because today each call site wires the two strings by hand. The copy rules become tests over the React surfaces, extending the nets that already exist — `ui-copy.test.ts`'s pictograph rule and its no-literal-copy walk, and `accessible-names.dom.test.ts`'s `mountPanels` coverage list, whose own doc comment makes adding a surface to it the contract. No behaviour change and no new dependency: the family is `lucide-react`, already present and already the one family (`§6`, `0038`); the tooltip stays `controls/tooltip.ts` (`0033`).

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
5. Read plan 4's landed Composition row and Add pane. As plan 4 is written, its Task 1 gives the group arm a constant stack glyph and **deliberately leaves the other four arms as treatments** (a text sample, a chart family icon, a paint swatch, a thumbnail), and its Task 3 maps each of the eight card units to an **inline hand-authored stroke diagram** taken from the mockup — that is the "depicted unit tile" bible §6 allows. Plan 4's Out of scope states that "the closed glyph set is plan 6's". So Task 3 here closes the *vocabulary* over `LayerKind` and does not re-open the arms; and Task 2 here brings plan 4's hand-authored unit diagrams to the one weight rule without replacing them with a library glyph lucide does not have.
6. Read the landed `src/web/tests/e2e/design-language.spec.ts`, `docs/evidence/screenshots/README.md` and the registered captures it names. Task 9 **adds this plan's capture to that file**; it does not invent a procedure.

Where a plan has not landed a piece this plan consumes, say so in the first commit and hold the dependent step, rather than writing a parallel version of it.

## Global Constraints

- **No behaviour changes** (§2.3). Same fields, same eligibility gates, same refusals. **"Text is not the interface" is not a licence to remove a label that carries meaning**: bible §6 rule 1 is the bar, and a glyph whose word is ambiguous keeps its word. Deleting a word a control's meaning depended on is a behaviour change.
- **No new dependency, and one icon family.** `lucide-react` is present and is the one family (§6, `0038`). A second icon package is a plan failure. **Chrome glyphs are library glyphs**; a hand-authored chrome path is a second family by another name. The two documented exceptions are bible §6's own: a **filled** glyph — the illegibility escape, or a binary state's on/off channel — and the **card unit diagram** — a fixed set of eight, which plan 4 draws as inline stroke paths because lucide has no exact match and §6 permits a tile to depict a unit. Those eight are brought to the one weight rule by Task 2 and are not replaced. `new-fabric-theme-icons.ts` reads lucide's `__iconData` to author the *theme's* icons into Fabric JSON — that is scene content, not chrome, and it is not this plan's.
- **One owner per concept.** `object-actions.ts` stays the authority on which **action** icons are compiled in (`ownership.md`'s row: "their ids, labels, icons and eligibility"); this plan does not re-spell its set. `uiCopy` stays the one copy table. `layer-tree.ts` stays the projection. A new module that owns an enumeration **adds its `ownership.md` row in the same commit**.
- **A watchlisted path needs a note, and these paths already have theirs.** `components/ui/` is claimed by `0039`, `scripts/design-tokens.*` by `0040`. A new `editor-shell/icons.ts` is **not** watchlisted — the watchlist's own comment says the editor's "ordinary layout and copy are deliberately absent — a wrong decision there is visible on the next render rather than invisible". If a task finds it touches a watched path with no covering note, stop and land the note; do not re-spell the gate.
- **Scales and roles only.** Every value comes from plan 1's tokens (`--text-*`, `--radius-*`, `--space-*`, `--elev-*`) and bible §4's colour roles. **Every file a task converts joins `scripts/design-tokens.gated.json` in that same task.** §6's stroke width is a weight rule over size, so **a stroke width is legitimate where a spacing value would not be** — and the text scan sees only `px` literals and a component prop is not a literal at all, which is why Task 2's closure is a DOM assertion and not a grep, and why the rule's bare numeric tiers need no `biblePx` entry.
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

**Five, and only five.** The four this list drops — a single-owner claim that leaves the hand-wired pairs in place (Task 4's own walk), a copy string repaired by deleting the control it describes (Task 6's stated rule), an acceptance item reported met without the observation (Task 8's ledger), a parity capture of a screen the plan did not change (Task 9's non-vacuity check) — are each already the subject of a step in the task that owns the code.

1. **A missing reading repaired into a zero.** Bible §9's last rule and the product's "never fabricate a reading" invariant meet here, and the tempting repair for an unarrived sample is `0`. A statement of the gap that reads as data is the same defect in other words. → Task 6.
2. **A kind glyph set closed against a second spelling of the kind list.** "Every kind has a glyph" passes trivially if the test enumerates the glyph map's own keys. The list must come from the kind vocabulary, and there are two places a kind has to reach — the type and the copy table's `layerKindLabels`. → Task 3.
3. **A copy test that passes because it rendered nothing.** The no-literal-copy walk collects the labels a surface actually rendered; a surface that failed to mount contributes an empty list and the assertion holds. The failure is silent, and it is the shape `vg-114` already recorded once. → Task 5.
4. **The weight rule read as licence for a local exception.** The rule is §6's own tiers over size — 1.7px at 14px and above, 1.8px at 11–13px, 2px at 10px and below — so a glyph that reads faintly at its size is answered by **a filled glyph where a stroke would be illegible at that size**, not by a stroke weight outside its tier, and not by a heavier `--faint`. Reaching for a weight outside the rule is a bible amendment in the same commit; a stroke weight beside it is the drift this task removes. → Task 2.
5. **A census that measures the plans' intentions rather than the code.** The whole point of doing this last is that the earlier plans' descriptions of their own glyphs are not evidence of what shipped. A census that reads the earlier plan files instead of the landed source produces a work list of fixes to code that does not exist and misses the drift that does. → Task 1.

---

## Phase 1 — The census and the glyph set

What landed is measured before anything is changed; the glyphs get one owner and one weight rule; the kind glyph set closes against the kind list.

### Task 1: The census of what landed

**Outcome:** A written inventory, in the commit, of every chrome glyph site and its weight, every surface that owns copy, every icon-only control and whether its accessible name and tooltip are one string, and every string that names a capability — each marked as either **already closed by a plan** (a reconciliation item) or **open** (this plan's work list). The later tasks' file lists are corrected from it in the same commit.

**Owning symbols/landmarks:** every module that imports `lucide-react` in `packages/editor/src` as it stands after plans 1–5 (`diagnostic-message.tsx`, `layer-panel.tsx`, `shell-layout.tsx`, `publish-indicator.tsx`, `font-picker/font-picker.tsx`, `object-actions.ts`, and whatever plans 1–5 added); `object-actions.ts`'s `OBJECT_ACTIONS` / `ARRANGE_ICONS`; `layer-panel.tsx`'s `CHART_ICONS` / `TWISTY_ICONS` / `LOCK_STATES`; `ui-copy.ts`; `controls/tooltip.ts`; `ui-copy.test.ts`; `accessible-names.dom.test.ts`.

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

**Task 1's census measured this at `762c740c` and the guess below was wrong.** Fifteen files import lucide — twelve chrome, plus `lucide-icon-node.d.ts` (declaration), `new-fabric-theme-icons.ts` (authored scene icons) and `pane.dom.test.tsx` (test). The chrome call sites carry **four** weights — `1.7` (8), `1.75` (17), `2` (1, the diagnostic severity glyph) and `2.5` (2, the menu tick and the live check) — and four hand-authored inline-SVG glyph sites exist: `kind-mark.tsx`'s group stack, `add-pane.tsx`'s shape and text glyphs, and `card-diagrams.tsx`'s eight unit diagrams (§6's sanctioned depiction). Record every file, every weight and every size. Any site whose weight is outside §6's band, and any site that is a hand-authored inline SVG rather than a lucide component, is an **open** item.

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

### Task 2: One icon vocabulary, one weight rule

**Outcome:** One module owns the chrome glyph vocabulary and the weight rule; every chrome glyph in the editor renders from it at its size's weight; chrome components import glyphs through the two owners; authored scene-icon generation and declaration files remain explicitly outside that chrome restriction.

**Owning symbols/landmarks:** the new `editor-shell/icons.ts`; `object-actions.ts`'s icons (read, not moved); `diagnostic-message.tsx`'s `SEVERITY_ICONS`; `shell-layout.tsx`'s and `publish-indicator.tsx`'s `Check` (the palette menu that held the third was deleted by plan 5's Task 2, and the choice row marks its selection with colour and border rather than a glyph); `font-picker.tsx`'s `Star`; `panes/composition/kind-mark.tsx`'s `CHART_ICONS` / `CHART_FALLBACK`, `panes/composition/composition-pane.tsx`'s `TWISTY_ICONS`, `panes/composition/row-affordances.tsx`'s `LOCK_STATES` (the maps the panes landed these in, not `layer-panel.tsx`); the rail's and panes' glyphs from plan 2; `controls/tooltip.ts` (read).

**Files:**
- Create: `packages/editor/src/editor-shell/icons.ts`, `packages/editor/src/editor-shell/icons.test.tsx`
- Modify: `packages/editor/src/editor-shell/diagnostic-message.tsx`, `shell-layout.tsx`, `layer-panel.tsx`, `display-switch.tsx`, `rail.tsx`, `settings.tsx`, `settings-keyboard.tsx`, `pane.tsx`, `packages/editor/src/font-picker/font-picker.tsx`, `packages/editor/src/panes/add/add-pane.tsx`, `packages/editor/src/panes/add/card-diagrams.tsx` (the eight hand-authored unit diagrams), `packages/editor/src/panes/composition/kind-mark.tsx`, `packages/editor/src/panes/composition/composition-pane.tsx`, `packages/editor/src/panes/composition/row-affordances.tsx`, and every other file the census listed as carrying a chrome glyph
- Modify: `scripts/design-tokens.gated.json` (add every file above)
- Modify: `docs/architecture/ownership.md` (one row: the chrome glyph vocabulary)
- Modify: none of `object-actions.ts`, `new-fabric-theme-icons.ts` or `lucide-icon-node.d.ts`

**Interfaces:**
- Consumes: the census's glyph inventory; `lucide-react`; plan 1's tokens and `ControlIconButton`; plan 4's eight card unit diagrams.
- Produces:

```ts
// icons.ts — the one chrome glyph vocabulary. One family (lucide), one weight
// rule (§6's tiers over size), and the named glyphs the shell and the panes read.
/** §6's weight rule: the stroke rises as the glyph shrinks, so the rendered
 *  weight stays optically even. The tiers are the drawing's own. */
export function glyphStrokeWidth(size: number): number;
/** A chrome glyph, and the one place its weight is set. */
export function Glyph(props: {
  readonly icon: LucideIcon;
  readonly size: number;
  readonly filled?: boolean;   // §6: the illegibility escape, or a binary state's on/off channel
}): React.JSX.Element;
/** §6 gives a group the stack glyph and its name, because a group is an
 *  arbitrary set of elements and its row cannot depict it. One glyph, one
 *  place — Task 3's `KIND_GLYPHS.group` is this constant and nothing else. */
export const STACK_GLYPH: LucideIcon;
export const RAIL_GLYPHS: Readonly<Record<"composition" | "add" | "tokens" | "document", LucideIcon>>;
export const TWISTY_GLYPHS: Readonly<Record<"collapsed" | "expanded", LucideIcon>>;
export const LOCK_GLYPH: Readonly<Record<"locked" | "unlocked", { readonly icon: LucideIcon; readonly filled?: true }>>;
```

- [ ] **Step 1: Write the failing test for the weight rule, from the rendered DOM**

`icons.test.tsx`, jsdom, mounting a surface that renders several glyphs:

```tsx
it("draws every chrome glyph at its own size's weight, in §6's tiers", () => {
  for (const svg of renderedGlyphs()) {
    const size = Number(svg.getAttribute("width"));
    expect(svg.getAttribute("stroke-width")).toBe(String(glyphStrokeWidth(size)));
  }
});
it("keeps the family one, so no chrome glyph is a hand-authored path", () => {
  // Three owners — `icons.ts`, `object-actions.ts`, the theme icons — plus every
  // source §6 exempts, named one entry apiece. `card-unit-diagrams` is §6's own
  // ("a unit tile may carry a diagram of what it builds"). Step 3 settles whether
  // `add-pane`'s shape and text marks join this list or are converted: the census
  // left them open and §6 does not settle it, because those tiles also draw what
  // they build. The case forbids an unaccounted source, not a particular list —
  // so the list is `EXEMPT_SOURCES`, and Step 3 is what fills it in.
  expect(glyphSources()).toEqual(EXEMPT_SOURCES);
});
```

`stroke-width` is a real attribute lucide writes on the rendered `<svg>`, which is why this reads the DOM rather than the source: the text scan in `design-tokens.mjs` sees only `px` literals and cannot see a component prop. The eight card unit diagrams are inline SVG rather than lucide components, so they carry `stroke-width` too and must satisfy the same weight case — that is how plan 4's hand-authored paths follow the one rule without being replaced. **This case is bounded by what it mounts**, so mount the fleet rather than one pane, and note in the commit which surfaces it covers; Task 9 Step 1 makes the same assertion in the browser over the built bundle, and that is the net that is not bounded by a fixture.

Run: `npx vitest run packages/editor/src/editor-shell/icons.test.tsx`
Expected: **FAIL** — the module does not exist, and the mounted glyphs did not follow one rule: the census measured **four** across chrome (`1.7`×8, `1.75`×17, `2`×1, `2.5`×2).

- [ ] **Step 2: Write the vocabulary, and take §6's escape rather than a weight outside the rule**

One weight rule, one `Glyph`, one `size` per call site (the sizes plan 1 and 2 chose are not this task's to re-decide; record them in the commit). The census's **four** weights become one **rule over size** — §6's tiers, `1.7px` at 14px and above, `1.8px` at 11–13px, `2px` at 10px and below — so a site's weight is its own size's tier, not a literal. Where a 12px tick or a 13px severity mark reads faintly, the answer is §6's own escape — a `filled` glyph — **not** a stroke weight outside its tier. Each of the census's out-of-tier sites is adjudicated one at a time rather than swept: `diagnostic-message.tsx:85` (`2`) resolves to its size's tier, and `shell-layout.tsx:421` (the menu tick, `2.5`) and `publish-indicator.tsx:31` (the live check, `2.5`) each resolve to theirs. §6 names the live check as a **filled** glyph at 12px, so that site's honest fix is the fill, not a weight; if a case needs something the bible does not allow, **amend bible §6 in the same commit** and say so, rather than leaving a local exception (`design-language.md`'s own first paragraph).

- [ ] **Step 3: Migrate every chrome call site**

Replace each direct lucide usage in the census's list with the vocabulary. `object-actions.ts` is **not** migrated: it is the authority on action icons and keeps its imports, and the surfaces that render an action read `action.icon` as they do now. The new `icons.ts` may read a lucide component; nothing else may. The eight card unit diagrams keep their hand-authored paths — lucide has no exact match and §6 allows a unit tile to be depicted — but take `glyphStrokeWidth(size)` so they follow the one rule with everything else.

**The census named four chrome surfaces that render a glyph and import no lucide**, so no importer grep ever listed them and only the weight histogram sees them: `layer-panel.tsx:34` (the registry's icons), `pane.tsx:48` (a prop-passed glyph), and the two hand-authored ones below. Convert those two with the rest — a site the importer list misses is exactly the one a vocabulary migration leaves behind.

Then settle the **hand-authored chrome paths**, one at a time, and record each decision:

- `kind-mark.tsx`'s group stack (two paths, `:139`) is **converted**: it is a stroke at size 13, so §6's filled-glyph escape does not apply, and §6 says a group "gets the stack glyph and its name". `icons.ts` exports it as `STACK_GLYPH` and Task 3's `KIND_GLYPHS.group` is that constant.
- `add-pane.tsx`'s shape and text marks (`:196`, the `SHAPE_GLYPHS`/`TextGlyph` factory) are **decided here, not assumed**. §6 exempts "a unit tile [that] may carry a diagram of what it builds" for the card library because that set is fixed; a shape tile likewise draws the shape it builds, and `SHAPE_KINDS` is fixed too — so either reading is defensible and the bible does not settle it. Look at the drawing, decide each mark, and record which are converted and which are exempt with §6's reason. Whichever way it goes, `EXEMPT_SOURCES` names every exempt source and nothing is left unaccounted.

- [ ] **Step 4: Add the ownership row, in the same commit**

`ownership.md` gains one row under **Editor**: the chrome glyph vocabulary and its one weight rule → `editor/src/editor-shell/icons.ts`. The map's own rule is that "if you add a module that owns an enumeration, add the row in the same change".

- [ ] **Step 5: Red proof — the weight rule fires on one planted weight**

Set one call site to a weight outside its size's tier — e.g. `strokeWidth={2}` on a 17px glyph — and re-run. Expected: **the weight case fails**, naming the size and the two weights. Restore it, then confirm the family case fires by adding a direct import to a converted file.

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

**Owning symbols/landmarks:** the kind vocabulary — `layer-tree.ts`'s `LayerKind` (`"text" | "shape" | "chart" | "group" | "image"`) and its `LayerMark`; `uiCopy.panels.layerKinds` (the one other table a kind must reach); `insertGroups()` in `new-object-panel.ts` (the insertable kinds: card units from `CARD_LIBRARY`, text, `SHAPE_KINDS`, `CHART_FAMILIES`); plan 4's Composition row and its Add-pane tiles — the landed `panes/composition/kind-mark.tsx` (`KindMark` / `treatment` / `chartFamilyGlyph`, the replacement for the old `layer-panel.tsx` `kindOf`) and `panes/add/add-pane.tsx`.

**Files:**
- Modify: `packages/editor/src/editor-shell/icons.ts` (`KIND_GLYPHS`)
- Modify: `packages/editor/src/editor-shell/icons.test.tsx`
- Modify: `packages/editor/src/panes/composition/kind-mark.tsx`, `packages/editor/src/panes/composition/composition-pane.tsx` and `packages/editor/src/panes/add/add-pane.tsx` — **the census names them**; where one owns a kind→component map, delete the duplicate decision and read `KIND_GLYPHS` instead
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

If plan 4 shipped a kind→component map, its membership moves here and the row reads `KIND_GLYPHS`. Plan 4 as written already made the two decisions this task must not re-open: **the group arm is a constant stack glyph** introduced precisely so the mark cannot be derived from the group's children, and **the other four arms stay treatments** (a text sample in the object's own face, a chart family icon, a paint swatch, a thumbnail) because "a swatch and a thumbnail each carry a fact a glyph cannot". So this task closes the *vocabulary* over `LayerKind` and records which arms are glyphs and which are depictions; it does not convert a treatment to a glyph. The one thing it may not leave standing is a mark that claims to depict an arbitrary group or a card (bible §10, `§5.1`) — plan 4's Task 1 carries the red proof for the same reason — plant a mark derived from the group's children and the case must fail — and the two tasks' red proofs are the same failure seen from either end.

- [ ] **Step 4: Red proof — the set opens when a kind is added**

Delete `image` from `KIND_GLYPHS` and re-run. Expected: **the totality case fails** and, separately, the build fails on the `satisfies`. Restore it. Then add a member to `LayerKind` (`"video"`) and confirm the build fails until a glyph is added; revert both.

- [ ] **Step 5: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npm run build`, `npx vitest run packages/editor/src/editor-shell/`, then commit with the kind list and the glyph list side by side.

---

## Phase 2 — One string, and the copy

Every icon-only control's accessible name and tooltip become one string by construction; the copy nets reach the React surfaces; the copy defects the census found are fixed as defects.

### Task 4: The accessible name and the tooltip are one string, one owner

**Outcome:** Every icon-only control in the editor declares one `label`, from which plan 1's `ControlIconButton` produces both the `aria-label` and the tooltip through `controls/tooltip.ts`; no call site wires the two by hand; the controls that had no tooltip are adjudicated one by one against bible §6 rule 1.

**Owning symbols/landmarks:** `components/ui/control-icon-button.tsx`; `controls/tooltip.ts` (read, not rewritten); the four files whose icon-only controls the census found already one-string by construction — `canvas-dock.tsx`'s `Action` and `ArrangeAction`, `display-switch.tsx`'s `ViewButton`, `rail.tsx`'s `RailSlotButton` and `SettingsGear`, `panes/composition/row-affordances.tsx`'s `RowControl` (that is six controls across four files; they are reconciliation items, not work, and `layer-panel.tsx` renders through `ControlIconButton` already); the census's icon-only **no-tooltip** list — `font-picker.tsx`'s favourite `Star`, `composition-pane.tsx`'s twisty and group-entry buttons, `components/ui/gradient-editor.tsx`'s stop dots; plan 2's `pane.tsx` footers and publish control; `accessible-names.dom.test.ts` and its `mountPanels` list.

**Files:**
- Modify: `packages/editor/src/components/ui/control-icon-button.tsx`, `packages/editor/src/components/ui/control-icon-button.dom.test.tsx`
- Modify: `packages/editor/src/editor-shell/canvas-dock.tsx`, `layer-panel.tsx`, `rail.tsx`, `pane.tsx`, `publish-control.tsx`, `display-switch.tsx`, `canvas-context-menu.tsx`, `packages/editor/src/font-picker/font-picker.tsx`, `packages/editor/src/panes/composition/row-affordances.tsx`, `packages/editor/src/panes/composition/composition-pane.tsx`, `packages/editor/src/components/ui/gradient-editor.tsx` — whichever exist as landed, and every other file the census listed. Plan 4 explicitly leaves `canvas-context-menu.tsx` alone and names this plan for it; the layer row's own footer buttons are already plan-1 icon buttons, so that half is a reconciliation item, not work.
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
  // Seeded at the census's 4, because the list is Step 3's to settle and a case
  // written after the adjudication would record nothing. Step 3 adjusts it per
  // control and says why, in this file's own comment.
  expect(noTooltip(root).length).toBe(4);
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

**Owning symbols/landmarks:** `packages/editor/src/ui-copy.test.ts` (`pictographs`, the `spoken` walk, `copy()`, the three mounted panels and the font picker); `ui-copy.ts`; the menus (`shell-layout.tsx`'s `ShellMenuBar`, the view menu, the context menu); plan 2's rail and panes; plan 3's column; plan 5's settings surface; **the census's three unowned literals, named so none is left to the Files prose alone** — `shell-layout.tsx:482` "Editor menus", `shell-layout.tsx:842` "Editor canvas", `components/ui/colour-picker.tsx:237` "Hex colour" (an `aria-label` on the hex field).

**Files:**
- Modify: `packages/editor/src/ui-copy.test.ts`
- Modify: the React surface modules only where the census found a literal that is copy — each moved into `uiCopy`
- Modify: `packages/editor/src/ui-copy.ts` (the words the walk found, and no renaming beyond that)
- Modify: `scripts/design-tokens.gated.json` (the converted files)

**Interfaces:**
- Consumes: `uiCopy` and its `copy()` walk; the surfaces plans 1–5 landed.
- Produces: nothing new to import. This task is a net and the words it catches.

- [ ] **Step 1: Write the failing walk, and make it impossible to pass by rendering nothing**

Extend the `spoken` collection with the React surfaces. The failure mode is that a surface which fails to mount contributes `[]` and the assertion holds (Review Focus 3), so the walk asserts per surface that it rendered something:

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

For each string the census listed as naming a capability, either the control can do it (and a test proves the control), or the claim is withdrawn in words. **The control is never deleted to make the string true.** The `⌘⇧P` chord is the known case: plan 2 drew the button alone and recorded the missing chord as a deliberate difference, and plan 5 binds it — verify which, and if it is still unbound, the difference is re-recorded here with the plan that owns it.

- [ ] **Step 4: Red proof — the gap and the over-claim**

Make one surface render `"—"` for its absent reading and confirm the gap case fails. Then withdraw one control the copy names (disable it) and confirm the capability case fails rather than the string being the only thing left. Restore both.

- [ ] **Step 5: State an empty census as a finding**

If Task 1's inventory found no over-claiming string, say so in this commit with what was checked and the case that could have failed. An empty list from a check that could have found nothing is not evidence, and this is the one place in this plan where the honest answer may be "none".

- [ ] **Step 6: Ratchet, verify, commit**

Gated list, `npm run design:check`, `npx vitest run packages/editor/src/ui-copy.test.ts`, `npm run build`, then commit with the count of strings adjudicated and the ruling on each.

---

## Phase 3 — The gate

### Task 7: The ratchet and the nets, over this plan's list

**Outcome:** Every file this plan converted is in `scripts/design-tokens.gated.json`, `npm run design:check` exits 0 over them, it still refuses to pass over an empty list, and the three closures this plan added — one weight rule, one string, no literal copy — are each shown to fail when broken.

**Owning symbols/landmarks:** `scripts/design-tokens.gated.json`, `scripts/design-tokens.mjs` (its proof is its own `--self-test`, chained into `gates:self-test` — not a second file), `npm run design:check`, `icons.test.tsx`, `control-icon-button.dom.test.tsx`, `ui-copy.test.ts`.

**Files:**
- Modify: `scripts/design-tokens.gated.json` (the union of every earlier task's additions)
- Modify: `scripts/design-tokens.mjs` **only** if a rule must change, in which case `--self-test` gains its case in the same commit and the reason is a decision note, not a plan edit

**Interfaces:**
- Consumes: plan 1's guard and its `--gated` argument, and `biblePx` (the scan reads `px` literals only, so the weight rule's bare numeric tiers need no entry).
- Produces: the counts, in the commit. This task is a measurement.

- [ ] **Step 1: Measure what this plan converted**

```bash
cd src/web
node -e "const g=require('../../scripts/design-tokens.gated.json');console.log(g.gated.length, g.biblePx.join(','))"
grep -rn "strokeWidth" packages/editor/src --include=*.tsx | grep -v "\.test\." | sed 's/.*strokeWidth=//' | sort -u
grep -c "#[0-9a-fA-F]\{3,8\}" packages/editor/src/editor-shell/editor-shell.css
```

Expected: the gated union holds every file Tasks 2–6 converted; the weight column shows every site drawing from `glyphStrokeWidth(...)` and none planting a literal; the `editor-shell.css` hex count is recorded as the before-state for whatever follows the redesign — it does not go to zero here, because the palettes are hex by design.

- [ ] **Step 2: Run the guard and prove it is still not vacuous**

```bash
cd src/web
npm run design:check ; echo "EXIT=$?"
printf '[]' > ../../.superpowers/sdd/2026-10-08-iconography-and-copy/empty-gated.json
node ../../scripts/design-tokens.mjs --gated ../../.superpowers/sdd/2026-10-08-iconography-and-copy/empty-gated.json ; echo "EXIT=$?"
node ../../scripts/design-tokens.mjs --self-test ; echo "EXIT=$?"
```

**Write the fixture where the guard can read it.** A bare `/tmp/…` path is not that path: `printf` writes where the shell means it, and Node resolves `/tmp/x` to `<drive-of-cwd>:\tmp\x`, so the guard would fail on a **missing file** — and a missing file's non-zero exit is the outcome this step expects, which makes the check look green while never exercising the refusal. Measured on this box: `node -e fs.readFileSync('/tmp/…')` → `ENOENT … D:\tmp\…`. The plan's own git-ignored workspace is the path both sides resolve identically, which is why it is the one above.

Expected: **0**, then **non-zero with a message naming the empty list**, then **0** with every rule's case reported. **Read the message, not the exit code** — the whole point of this step is that a guard over zero files must refuse, and an `ENOENT` also exits non-zero while proving nothing. A guard over zero files reporting success is the defect `vg-149` is an instance of.

- [ ] **Step 3: Red proof — the three closures, one at a time**

Add a hex literal and an off-scale `px` to a converted file: expected **non-zero, naming the file and the value**. Then set one glyph's weight to a literal outside its size's tier: expected the **weight case** fails — the text scan cannot see a prop, and saying so is part of this task. Then put a literal in a React surface: expected the **no-literal-copy walk** fails. Revert each, then re-run to green.

- [ ] **Step 4: Commit**

Commit the gated list with the counts and the three red proofs, and state which closures are a text scan's and which are a DOM assertion's — a reader who assumes `design:check` covers the weight will stop running the test that does.

---

### Task 8: The spec's Acceptance, item by item

**Outcome:** A written ledger, in this plan file's `## Acceptance ledger` section, of every item in the spec's Acceptance section: met or not met, with the evidence for each — and the four items no single plan owns checked **by observation on a rebuilt bundle**, not by citing a plan.

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

The before-state, measured on this plan's branch point: **23** `createElement("select")` call sites across ten files (artboard panel, asset panel, chart panel ×4, `controls/settings-field.ts`, the new-document chooser, palette panel ×3, `selection-inspector/panel.ts`, `selection-inspector/runs.ts` ×6, the theme library dialog, type-preset panel ×4), **four** JSX `<select>` elements (`font-picker.tsx` ×3, `theme-library-dialog.ts` ×1), and **one** range builder (`controls/number-field.ts`, whose `type = "range"` is reached from `settings-field.ts`, `selection-inspector/glass.ts` and `selection-inspector/panel.ts`). The after-state is the same three commands. Any remaining site is named with the file and the plan that owns it, or recorded as a deliberate difference with its reason; **a count reported without the command's output is not evidence.** The greps cannot see the class this item exists for: a replacement control emits its own native `<input>`, which no `<select>` grep will ever count. `packages/editor/src/accessible-names.dom.test.ts` enumerates exactly those carriers, one comment per control — evidence this item with that list as well as the three counts, and read its entries rather than counting them; plan 4's Task 10 left it red by converting a control and not reading it.

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

The ledger lives in this plan file's `## Acceptance ledger` section: one item per line, `met` or `not met`, with its evidence. A ledger is **current truth**, and a commit body can only be corrected by rewriting history — which two fix rounds demonstrated. The commit body is a pointer at that section, not a second copy, because a duplicate is a second thing to keep true. No register row is filed for an unmet item that already has one.

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

The capture opens the state the mockup draws (plan 2's capture does: the Add slot open with nothing selected), asserts the language mechanically — every rendered glyph's `stroke-width` is `glyphStrokeWidth(its size)` and in §6's tiers, and no icon-only control's tooltip disagrees with its accessible name — and then writes the image. Run it against a bundle from before Task 2 and confirm it **fails** rather than producing a picture of the old weights.

- [ ] **Step 2: Prove the run is not vacuous**

```bash
cd src/web
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "<the registered title>" --workers=1
```

Read the summary and confirm **1 test ran**, not 0. A `--grep` matching nothing exits 0 with zero tests, which is how a parity gate silently stops checking.

- [ ] **Step 3: Capture the changed surfaces**

This plan changes no layout, so the comparison is of the **glyphs and the words inside** the surfaces plans 2–5 built: the shell with Add open (the rail's four glyphs, the pane's footer, the status bar's readings), the dock over a selection, the inspector column, and the settings surface. Capture only the actions registered in the README, one worker, built bundles, `?static=1` and the controlled clock.

- [ ] **Step 4: Adjudicate the mockup against the bible — the mockup loses**

The reviewed shell preserves the original drawing's character: gradient artwork, compact glyph grids, subtle stage texture, fine chrome, floating clusters and palette swatches. Contract corrections keep four slots, 246px pane and three Settings tabs. Product glyphs still use the bible's band and currentColor; correcting reference stroke details must not redesign its composition. Re-read that current file and compare glyph language, not historical defects already removed. Inline paths in a reference are illustrations; product chrome uses the installed family, with the fixed unit-diagram exception. Inspect descendant path stroke overrides too: reading only each SVG root would miss a heavy arc. Scene artwork, QR symbols and deliberate filled state dots are not chrome stroke glyphs.

- [ ] **Step 5: List every difference, and account for each**

Expected differences, each either fixed in the task that owns it or recorded here as deliberate with its reason and its owner: any glyph whose shape differs between lucide and the mockup's hand-drawn path (the mockup draws a *shape*, the editor draws a *library glyph*, which is §6's one-family rule and is deliberate); a glyph the mockup draws that lucide has no exact match for; any weight the bible's escape forced to a filled glyph; the `--faint` disclosure twisty the mockup draws at 10px and the product draws at 13px (`composition-pane.tsx`), a size difference that is why §6's 10px weight tier is dormant — record it here, do not fix it in this plan; the words (the mockup's copy is illustrative, `README.md` says so). Scale, rhythm and mono values are the comparison; platform font metrics, scrollbar widths, device pixel ratios and antialiasing are not drift.

- [ ] **Step 6: State an empty list as a finding**

If the comparison produces no differences at all, say so with what was compared and which capture could have failed — a gate that produces no comparison has not run (§13.4).

- [ ] **Step 7: Update `STATUS.md`, then commit and archive**

Replace "Last completed change" with 1–5 bullets on this commit, one item per line, never wrapped; keep the file to objective, active work, last completed change, next steps and blockers; run `npm run status:check` from `src/web/` before committing. Run the **whole editor unit suite** at the closing commit and record its counts in the commit body: the per-task gates read only the files their own task names, so a cross-task red survives them — plan 4's close did, and its whole-branch review found it. Tell the user the images exist before staging them, and inspect them first. Commit the spec change, the registration row, the mockup correction and the images together; then move this plan to `docs/superpowers/plans/archive/` once nothing depends on it, naming which acceptance items are met and which remain blocked. Archive/close the six-plan sequence only if all required items pass; a blocked acceptance item keeps the objective open even when this plan's local glyph work is finished.

---

## Acceptance ledger

The spec's Acceptance section, item by item, `met` or `not met` with its evidence.
Observed on a rebuilt bundle (`npm run build` + `build:fixture`, exit 0) at
`9a97856e`; the raw commands, their counts and the runs' exit codes are in
`.superpowers/sdd/2026-10-08-iconography-and-copy/task-8-report.md`. Task 9 then
turned item 16 met (its own parity capture) and left item 3 where it stands, so
the ledger reads **fifteen met; one not met** — item 3's real-host clause, which
keeps the objective open even though this plan's local glyph work is finished.

This is the ledger's home. A ledger is current truth, so it lives in a document
rather than in a commit body that could only be corrected by rewriting history.

1. **met (on ADR 0033's exemption)** — Every editor surface is React:
   `chart-fields.tsx`, `file-section.tsx`, `new-document-chooser.tsx`,
   `theme-library-dialog.tsx`, `font-picker.tsx` (`ControlSelect`); the panel
   factories render React roots. The one imperative UI module left,
   `editor-shell/controls/tooltip.ts`, **does** render — `createElement("div")`
   at `:81`, `document.body.append` at `:103`, imported by
   `components/ui/control-icon-button.tsx:3`, `components/ui/control-well.tsx:3`
   and `panes/add/add-pane.tsx:2`. It is deliberately ours rather than a React
   primitive: ADR 0033 rules the tooltip not a primitive and stays ours, because
   the selection inspector builds elements with `createElement` and never sees
   React, so a shared component is one its own caller cannot use.
2. **met** — Edits are safe transactions: plan 1's `control.dom.test.tsx`
   contract + plan 3's `inspector-sections.spec.ts` (commit/cancel, stale target,
   one history, undo) → 13 passed with `add-pane.spec.ts`.
3. **NOT MET — §13.1's real-host clause.** The item reads that §13.1's
   walkthrough runs on the real host, and §13.1 assigns that walkthrough to this
   plan (Task 8's Interaction closure, `:593`). No existing spec runs it: the
   `desktop-host` project boots the real host but matches
   `host-(player|settings|media|bleed|chrome).spec.ts` only, and none of those
   drives the editor's keyboard walkthrough (`host-player.spec.ts:323` saves from
   the host-served editor without it). The contrast half **is** observed: the
   control-set gate (4.5:1/3:1, forced colours, 200% zoom, long names) passed,
   six-palette chrome and armed-ring contrast passed, `keyboard.spec.ts` → 5
   passed — on the desktop-chromium **preview**, which is the closure's other
   half. The clause is recorded, not waived; the fix rounds were forbidden to add
   the check that would run it.
4. **met** — The scales are consumed: `npm run design:check` → "71 gated file(s)
   clean", `editor-shell.css holds 58 violation(s), at or below its ceiling of
   58", exit 0; the gated union is 71 unique (node count). Stated for a subset:
   the four hex-carrying files this plan left off
   (`components/ui/colour-picker.tsx`, `ui-copy.test.ts`,
   `accessible-names.dom.test.ts`, `panes/composition/kind-mark.dom.test.tsx`) and
   the two coverage gaps already owned (`vg-274`, `vg-286`). Plan 1's browser
   gate: `design-language.spec.ts` "the control set renders in the design
   language" → 1 passed.
5. **met (on the spec §2.2 carve-out)** — No native `<select>` and no native
   `input type=range` in a rendered surface: the three commands read 1 / 12 / 6 —
   the `<select` count is **12**, and all twelve are comments (none is a select),
   and the **6** `"range"` hits are the one test-only builder
   (`controls/number-field.ts:191`) plus five *assertions*
   (`expect(x.type).toBe("range")` at `glass.dom.test.ts:288,349`,
   `index.dom.test.ts:352` and `panel.dom.test.ts:685,896`), so the count is one
   builder and five readings rather than six builders.
   The only real builders are the test-only
   `editor-shell/controls/settings-field.ts:196` and `number-field.ts:191`, and
   **`vg-266`** owns both (`vg-264` does not name `:191`). One native range input
   **is** live: Base UI's slider passes `inputRef` to `Slider.Thumb`
   (`components/ui/control-slider.tsx:135`), rendered at
   `selection-inspector/column.tsx:180`; it is not in
   `accessible-names.dom.test.ts`'s carrier list, because that list holds only the
   `!reached` elements and this one is reached. The item survives on the spec's own
   carve-out (`2026-10-08-editor-design-language-design.md:107-108`: a primitive's
   hidden form-integration element is not a second visible control), and the
   carrier list — **38** entries at `:230-300`, read and green (28 passed) — is
   corroboration rather than the proof. `vg-271` owns the instrument's gap.
6. **met** — Every panel's behaviour survives its rewrite: plans 3 (Task 7) and 4
   (Tasks 10/12) prove every re-pointed locator red with the behaviour disabled.
7. **met** — Nothing selected → the inspector names where to choose from:
   `inspector-sections.spec.ts:635` passed.
8. **met** — A card selects as a group, with no property a group lacks:
   `inspector-sections.spec.ts:574` passed.
9. **met** — A text run's binding is reached from its card and its value answers
   "which sensor": `editor.spec.ts:1545` (`editor-text-reads`) — the run's source,
   format and zone drive the computed reading.
10. **met** — The dock shows only what the selection can run: `editor.spec.ts`
    "captures the canvas dock over a selected object" — Duplicate/Ungroup present,
    Group absent, arrange disabled for one.
11. **met (today)** — The four rail slots each open, and only one is open at a
    time, and the gear opens settings rather than a fifth pane:
    `design-language.spec.ts` "captures each pane of the four-slot rail in the
    design language" (`.editor-shell-rail-slot` count 4; each opens with exactly
    one visible pane) and "captures the settings modal's three tabs in the design
    language" (the gear opens the modal with three tabs) → 2 passed;
    `editor-rail.spec.ts` → 10 passed. **`vg-330` supersedes the item** (Settings
    becomes a pane later); passed as written, not fixed forward.
12. **met** — The Add pane offers units and primitives, neither greyed, and its
    tiles depict units while the Composition rows do not: `add-pane.spec.ts:26`
    passed.
13. **met** — The Tokens pane lists paints and presets and its preset panel is
    bound to the selection (`vg-094`, closed by plan 4):
    `preset-list.dom.test.tsx`'s vg-094 case + `editor.spec.ts` palette/preset
    surface tests.
14. **met** — The stage draws no device frame: `editor-display.spec.ts` → 10
    passed, every case with a lens chosen (the case that could show a frame); Fit
    is the explicit case at `:356` (`displayScreenRect()` is undefined). The one
    outline is `[data-vigilia-display-screen]`, `border: 1px`
    (`editor-shell.css:2357`), hidden when no screen is drawn
    (`editor-shell.ts:549`); no bezel or notch exists in the source.
15. **met** — Six palettes are distinguishable by surface: the registered
    `shell-palette-` capture, **6 of 6** images read rather than their computed
    values — graphite near-black, editorial cream, ember peach, moss sage, plum
    lilac, light mint; `shell-appearance.spec.ts` → 9 passed.
16. **met (Task 9 landed the missing half)** — Every plan's parity capture
    exists: of the five earlier plans, all five have their images, but the
    evidence is thinner for two than for the other three: plans 2, 4 and 5 have
    nameable completion reports (plan 2's is
    `2026-10-08-the-shell-and-the-rail.md:693`), while plans 1 and 3 have none on
    disk and none in their plan files — no
    `.superpowers/sdd/gates-and-the-control-set/` or `the-inspector/` workspace
    survives — so their surviving record is the commit bodies `1f991845` and
    `9ee1fc21`. **Plan 1's ten differences no longer exist anywhere**: `1f991845`
    defers them to a task report deleted with its workspace. Plan 3's survive in
    `9ee1fc21`'s body beside each difference's owner. Plans 7 and 8 sit beside the
    drawing in `docs/design/mockups/current/`. **Plan 6's own capture is Task 9's
    and landed with it**: `docs/design/mockups/current/shell-capture-glyphs.png`
    — the shell with the Add pane open and nothing selected, on the drawing's own
    ground — sits beside `current/shell.html`, written by the registered action
    `captures the shell glyphs and words with the Add pane open`
    (`docs/evidence/screenshots/editor-shell-glyphs-desktop-chromium.png`), with
    every difference adjudicated in the Task 9 report. This item stood `not met`
    for that capture alone, so **it turned met when the capture was registered**
    and no other item moved.

**The interaction closure ran one half.** The preview half ran: `keyboard.spec.ts`
→ 5 passed on the rebuilt desktop-chromium bundle, plus the control-set contrast
gate. The real-host half did not run, for the reason item 3 states.

**Register.** No new row was filed for any residue above; each is owned by an
existing row — `vg-266` (the dead `editor-shell/controls/` builders), `vg-271`
(the native-control instrument's gap), `vg-274` (`editor-shell.css` in no gate),
`vg-286` (no rule for test files), `vg-330` (supersedes item 11 when Settings
becomes a pane). Task 9 filed no row either: item 16 was the one it owned, and
it is met. Two rows were updated rather than filed: `vg-268`'s "three native
selects" clause corrected to `ControlSelect`
(`font-picker.tsx:277,294,315`), and `vg-204` left **open** with
`keyboard.spec.ts`'s 5/5 at `78a5575e` — its palette-picker test "the palette
picker lands beside its trigger, and its tracks answer the arrow keys" among
them — recorded and not treated as proof the defect is gone.

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

- **Spec coverage.** §8's four requirements are Tasks 2 (one family, one weight rule), 4 (one string, one owner), 3 (the kind set closed with the kind list) and Tasks 4–5 (text is not the interface, with §6 rule 1 as the bar against removing a meaningful label); §9's copy rules are Tasks 5 and 6; §6's refusal in words is read where the census finds it; §12 row 6 is this document; §13 is Task 9 and Task 8's item-by-item ledger; the Acceptance section is Task 8 with the four no-single-owner items observed there and the comparison image produced in Task 9.
- **Step scan.** No `TBD`, no "add error handling", no "similar to Task N". The one number left open — Task 4 Step 1's `noTooltip` count — is deliberately settled by that task's own adjudication rather than predicted here, because a count predicted before the code exists is not evidence (`AGENTS.md`).
- **Type consistency.** `Glyph` is the one chrome glyph component and `glyphStrokeWidth` the one weight rule; `KIND_GLYPHS` is the closed kind vocabulary, declared `satisfies Record<LayerKind, LucideIcon>`; `ControlIconButton` takes one `label` and owns both strings; `absentReadingSurfaces()` and `placeholderReadings` are Task 6's two named sets, and a missing reading is a stated gap rather than a value.
- **Review Focus.** Five, pinned above to Tasks 1, 2, 3, 5 and 6; each is a failure no existing test would catch. The four that were dropped are each a step's own red proof in the task that owns the code.
- **Proportion.** 800 lines against the spec's 717, with 115 of them code — test cases and type signatures rather than bodies — and 125 of the 800 are the Acceptance ledger above, which is verdicts and evidence rather than steps. (Both figures were stale before the ledger moved here: later tasks had grown each file past the numbers this line was written with.)
- **Red proofs.** Every task states the break that must fail its own gate; Task 7 re-proves the guard's empty-list refusal and names which closure is a scan's and which is a DOM assertion's; Task 9's capture is proven non-vacuous with one test run, not zero.
- **Owners.** No new dependency, no second tooltip component, no second icon family, no second kind list, no new net beside the two that exist, and the one new module's `ownership.md` row lands with it.
