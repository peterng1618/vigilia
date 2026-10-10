# Settings parity with the drawing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the settings modal — its frame, its navigation, its Appearance grid, and the Keyboard and About panels — to what `docs/design/mockups/current/settings.html` draws, by **extending plan 7's parity instrument to the modal's regions** rather than building a second comparison.

**Architecture:** The instrument exists and is this plan's means, not its product: `src/web/tests/e2e/mockup-values.ts` (the `PARITY` table, `mockupDeclared`, `readMockup`, `currentDrawings`, the `surface` field, the `fixture` control set) and `src/web/tests/e2e/design-language.spec.ts` (the rows, the radii gate, the comparator, the two-dialog equality check). Plan 7 made the drawing machine-read and left the modal out of scope except where it shares one rule (`.editor-shell-dialog`). This plan consumes that instrument: it re-adjudicates the modal's regions against the **current** drawing, adds only the comparators the modal's regions need and the table does not have, fixes what the census rules `fix`, corrects the drawing where the bible is the older rule, and lands the ratchet and the §13 capture. The measurement at `.superpowers/sdd/2026-10-08-settings-and-appearance/settings-vs-mockup-measurement.md` is the **starting evidence, not the contract**: it was taken against the superseded `docs/design/mockups/editor-shell.html` and against the modal as plan 5 left it, so several of its verdicts have moved.

**Tech Stack:** TypeScript; React 19 + Base UI (`@base-ui/react/tabs`, `radio-group`, `switch`); Tailwind 4 over `src/web/packages/editor/src/editor-shell/editor-shell.css`; Vitest (unit) + Playwright (desktop-chromium, previewing built bundles); Biome. **No new dependency.**

**Spec:** [`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`](../specs/2026-10-08-editor-design-language-design.md) — §7 (Settings), §9 (the scales are consumed), §10 (Appearance), §12 (this plan's row), §13 and §13.1 (the reference is checked; evidence states), Acceptance
**Normative companion:** [`docs/design/design-language.md`](../../design/design-language.md) — §1 (the one rule), §2 (type), §3 (space/radius/elevation), §4 (colour roles), §5 (the control set), §7.8 (preserve the character), §9 (copy), §10 (what is forbidden)
**Reference:** [`docs/design/mockups/current/settings.html`](../../design/mockups/current/settings.html), the frozen original [`editor-shell.html`](../../design/mockups/editor-shell.html) (whose Keyboard specimen is the treatment the panels are drawn in — provenance, never a target), and [`README.md`](../../design/mockups/README.md)
**Decisions:** [`0035`](../../decisions/0035-the-shells-palette-resolves-at-the-element-not-the-root.md) (palette resolution — untouched), [`0038`](../../decisions/0038-base-ui-is-the-primitive-library.md), [`0040`](../../decisions/0040-the-design-token-ratchet-is-ours-not-a-biome-rule.md) (the ratchet's contract — untouched, and the reason the ceiling below is not the `gated` list)
**Sibling:** [`archive/2026-10-10-shell-parity.md`](archive/2026-10-10-shell-parity.md) — the source of the instrument and of this plan's task shape

## Global Constraints

- **Consume plan 7's instrument; never build a second.** `PARITY`, `mockupDeclared` / `mockupDeclaredOrNull`, `readMockup`, `currentDrawings` and the `surface` control set already exist. A modal region is a row; a row that the table's comparator cannot express is a **named gap in the census**, not a new test file.
- **The measurement is read-only and its verdicts are stale.** `.superpowers/sdd/2026-10-08-settings-and-appearance/` is a closed plan's evidence — never edit it. Its thirteen `drift` verdicts were measured against `editor-shell.html` (superseded — `current/shell.html` and `current/settings.html` replaced it) and against the modal as plan 5 shipped it. Every verdict is **re-adjudicated** against `current/settings.html` and the shipped product; a verdict carried forward unverified is a defect this plan exists to end.
- **The drawing governs wherever the written rules are silent** (spec §13, amended 2026-10-10), and **a rule this plan writes cannot license this plan's divergence**. A difference is kept only against a rule that **predates** it — a bible `§N`, an ADR or a spec section that *positively requires* the product's treatment, quoted and verified at the line it is quoted from. Silence, and a section this plan amends, are not licences.
- **Replacing the drawing is not an available disposition** (the user's ruling of 2026-10-10). The drawing is editable only to **repair** a value that contradicts the bible (a stale scale step, an off-scale radius) — and the bible wins where the current set disagrees with it (`mockups/README.md`). An edit that blesses a product divergence is forbidden in both directions.
- **A difference the product has and the drawing lacks is `drawing-stale`: draw it into the current set.** Spec §13.1 does not let a visual difference waive a capability, and a surface the drawing never draws is one no gate can check (`vg-314`). The frozen originals stay as they are.
- **One owner per concept** ([`docs/architecture/ownership.md`](../../architecture/ownership.md)): the palettes are `palette.ts`'s (`0035`), the control set is `components/ui/`'s, the modal regions are `settings.tsx` / `settings-keyboard.tsx`'s and `editor-shell.css`'s. Extend an owner; never add a second declaration of the same value.
- **No hex literal in a surface** (§10, `design-language.md:449`). A colour is a §4 role.
- No new dependency; no change to `packages/renderer-core`, the player, the host or the theme format; Fabric JSON stays the persisted scene.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Refuse an invalid numeric input rather than coercing it to zero.
- **Browser specs run at `--workers=1`** — a red at the default worker count on this box is contention, not a measurement (`vg-285`); re-run a failing spec alone before believing it.
- **`npm run build -w @vigilia/editor` empties `dist` and deletes `control-fixture.html`, so `npm run build:fixture` must follow it.** Playwright previews the **built** bundles; rebuild after every source change and after reverting a deliberate break.
- **A red proof's restore is proved with `cmp`, not `git diff`** — a Windows text-mode write leaves CRLF and `git checkout` normalises, so only a byte comparison shows the file is back.
- **Gates run unpiped from `src/web/`.**
- **Captures** follow [`docs/evidence/screenshots/README.md`](../../evidence/screenshots/README.md): built bundles, `VIGILIA_CAPTURE=1`, `--workers=1`, registered actions only.
- Report anything not actually verified, in the report and in the commit.

### Verified at drafting

The plan's starting numbers are checked against the files rather than transcribed. **Verified:** the drawing's modal frame is `border-radius:8px` (`settings.html:20`); its navigation is a `width:150px` column (`:22`); its palette grid is `repeat(3,1fr)` (`:44`); its swatch is two `height:16px;border-radius:4px` bars (`:46-49`); its follow-the-system row is a boxed `--panel-2` row at `padding:9px 10px` (`:89`). **Verified on the product:** `.editor-shell-dialog` is `border-radius:var(--radius-lg)` (plan 7 Task 3 fixed the shared rule — the measurement's `12px` is stale), `background:var(--shell-surface)`, `box-shadow:var(--elev-3)`, `padding:20px 24px`, `min/max-width: 340/560px`; `.editor-shell-dialog-overlay` is still `background:#0009`; `.editor-shell-dialog-lead` is still `font-size:var(--text-md)` (`13px`) on `--shell-text`; `.editor-shell-settings-tabs` is still a horizontal strip; `AppearanceTab` is still `grid-cols-2`; `.editor-shell-palette-swatch` is still one `14px` chip with an accent ring. **Not verified at drafting:** the modal rendered in a browser (the measurement's own §7 says the same); and the measurement's Keyboard rows (`#13`–`#16`) have **no counterpart in the current drawing**, because `current/settings.html` draws the Appearance view alone — which is why Task 4 exists.

## Review Focus

Five failure modes this surface implies that no single task's tests exercise, and most likely to bite a person using it.

1. **The navigation axis change moves every tab's reachable order and the focus trap.** A vertical navigation is a different keyboard model from a horizontal strip, and the modal is opened from outside Base UI's own tree (the gear restores focus by id). A tablist whose arrow keys move the wrong way, or a gear that no longer gets focus back on close, is a usability defect no geometry row sees. **Task 2** carries the keyboard walk: open the gear, walk the three tabs by arrow key and by Tab, close with Escape, then reopen — with the capture read, and the `?` sheet (which shares `.editor-shell-dialog`) re-checked.
2. **A two-bar palette preview must resolve each palette's *own* colours, not the shell's.** The chip it replaces carries `data-shell-palette` and resolves per element precisely so it repaints as the palette it names (`0035`, `palette.ts`). A preview that inherits the palette in force would paint six palettes in one palette's colours — a defect a computed-value row cannot see, because the row reads geometry. **Task 5** carries the browser reading of all six rows' own colours, in the drawing's own palette and in the light one.
3. **A 3-column grid changes layout, never the arrow keys** (§5 rule 7, `design-language.md:188`). The palette group is one labelled `radiogroup`; the grid is the drawing's and the keyboard model is the group's own. A grid that reorders the radio sequence, or a selected card that reads as chosen only by a border, fails on a palette the eye does not check. **Task 5** carries the group's Tab/arrow walk and the chosen-vs-unchecked fill reading already in the fixture's §4e, re-pointed at the modal.
4. **The scrim is the page's dimming, so changing it moves every colour behind it.** `#0009` is 60% black; §3's scrim (`design-language.md:105`) is `#00000073`, 45%. The modal's own boundary, the `?` sheet behind it in a stacked case, and every captured colour composite against it. **Task 3** carries the before/after measurement of the modal's own boundary contrast under the new scrim, not a computed-value assertion.
5. **The Keyboard panel's states are more than one.** Empty overrides, storage refused (session-only), an armed row, and a refusal are four rendered states the drawing shows at most one of (§13.1). The per-row reset is the one control the original specimen does **not** draw, so whether it stays, moves to a foot action only, or is refused-in-words is a decision a row cannot make. **Task 7** carries the four states, each driven and captured.

---

## Phase A — The instrument reaches the modal

### Task 1: The settings drawing becomes the modal's comparator — the census and the rows

**Outcome:** `docs/design/mockups/current/settings.html` is read by the parity table as the modal's comparator, every one of the measurement's nineteen regions is **re-adjudicated** against it and the shipped product, and a spec that **fails on today's build** where a region drifts and no predating rule keeps it.

**Owning symbols/landmarks:** `src/web/tests/e2e/mockup-values.ts` — `PARITY`, `ParityRegion` (its `surface`, `scaleToken`, `mockupPath`, `licensed` fields), `SETTINGS_MOCKUP_PATH`, `mockupDeclared` / `mockupDeclaredOrNull` / `lengthInPx`; `src/web/tests/e2e/design-language.spec.ts` — `readRows`, the `surface: "settings"` read, `renderedDialogs`; the drawing `current/settings.html` (its outermost token block, the `width:560px` frame, the `width:150px` nav, the `repeat(3,1fr)` grid, the `padding:9px 10px` box); the product `editor-shell.css` (`.editor-shell-dialog-overlay`, `.editor-shell-dialog`, `.editor-shell-dialog-lead`, `.editor-shell-settings-tabs` / `-tab`, `.editor-shell-dialog kbd`, `.editor-shell-keyboard*`, `.editor-shell-palette-swatch`), `settings.tsx`, `settings-keyboard.tsx`.

**Files:**
- Add: `.superpowers/sdd/2026-10-11-settings-parity/adjudication.md` — the census
- Modify: `src/web/tests/e2e/mockup-values.ts` — the modal's rows, and the comparators they need
- Modify: `src/web/tests/e2e/design-language.spec.ts` — the settings-surface row read

**Interfaces:**
- Consumes: the measurement (as starting evidence, re-adjudicated); the current drawing; plan 7's `PARITY` and its `surface` control set.
- Produces: the modal's rows in `PARITY`, and the census's disposition per region.

- [ ] **Step 1: Re-adjudicate every measured region against the current drawing, and write the census**

`adjudication.md` carries the measurement's nineteen regions as rows: region, what `current/settings.html` declares (landmark, not a stale line number), what the product computes today, the bible section and what it says, and a disposition that is one of:

- **fix** — no predating rule requires the product's treatment;
- **licensed** — a predating rule is quoted verbatim and positively requires it;
- **drawing-stale** — the drawing contradicts the bible (or a capability the product has), with the bible section quoted and the drawing edit named;
- **no-counterpart** — the region has no product element or no element in the current drawing (plan 7's frame case, and every Keyboard/About region until Task 4 draws them).

No row may read "deliberate". A row whose only support is a bible section this plan touches is **fix**. Carry forward a measurement verdict only after re-reading the file it was taken from, and record which rows moved and why (the measurement's `#1` frame radius, for instance, is resolved by plan 7 and reads **match** now).

**State the structural gaps explicitly, as their own block in the census**, because they are what the table cannot express and a later task must not mistake for a missing check:

- **A count is not a length.** The palette grid's column count (`repeat(3,1fr)` in the drawing, `grid-cols-2` in the product) is neither side a single px, so `lengthInPx` returns `null` and the row fails "not a length this table can compare". A count needs its own comparator.
- **A colour is not a length.** The scrim (`#0009` against §3's `#00000073`) is a colour; the table's comparator is one px length. A colour row cannot use `lengthInPx` and cannot use `scaleToken` either, which also ends in `lengthInPx`.
- **An axis is not a value.** The navigation's direction (a `150px` column versus a horizontal strip) is a layout, not a property a row compares.
- **A shape is not a value.** One swatch chip versus two colour bars is a difference in *how many elements* and *what they carry*, not in a property of one element.
- **An element that exists only while the dialog is open is already solved** by `surface: "settings"` (plan 7), and **a region the drawing draws but the product reaches by a different route is already solved** by the `surface` plus `productSelector` pair (plan 7's `fixture` rows do exactly this). Neither needs new machinery; say so rather than inventing one.

- [ ] **Step 2: Add the two comparators the modal needs, and prove them**

Extend `mockup-values.ts` with the smallest thing that makes a **count** and a **colour** comparable in a `ParityRegion`, and prove each in `mockup-values.test.ts` (the colocated unit test, where `vitest run` holds it — a comparator whose guard sits behind a desktop browser run is one `vitest` cannot hold):

- a **track count** read from a computed `grid-template-columns` (the number of tracks), compared against the drawing's own track count;
- a **colour**, compared as a resolved value rather than a length, for a row whose comparator is a §3 token (`scaleToken` compared as a string, which today falls through `lengthInPx` and would fail every colour).

`ponytail:` a regex/number split over a serialised track list is the ceiling here; a real grid-resolution model is unnecessary for a fixed column count and would be a second layout engine.

- [ ] **Step 3: Add the rows, and write them so they fail on today's build**

One row per `fix` region, reading the drawing's declaration and the product's rendered value on the surface it belongs (the modal open, the tab showing). Run: `cd src/web && npx playwright test design-language.spec.ts --project=desktop-chromium --workers=1`. **Record the failures**; the expected set is at least the navigation axis, the grid count, the swatch shape, the scrim and the lead. A run with no failures means the rows are not reading what the product renders.

- [ ] **Step 4: File what the census finds that this plan does not fix**

Every row whose owner is elsewhere — `vg-200`'s boundary, `vg-288`'s release row, `vg-310`/`vg-311`'s chrome treatment — goes in the report and in the commit body as a `Discovered, not fixed:` trailer, and a home row is created (or the existing row amended) from it. Do not duplicate a finding in this plan's prose.

- [ ] **Step 5: Commit**

```bash
cd src/web
npx playwright test design-language.spec.ts --project=desktop-chromium --workers=1
git add tests/e2e/mockup-values.ts tests/e2e/design-language.spec.ts
git commit -m "test(e2e): the settings drawing is the modal's comparator, and parity fails on today's modal"
```

---

### Task 2: The modal's navigation axis is the drawing's

**Outcome:** The modal renders its three panels beside the drawing's **left navigation**, not under a horizontal word strip, and §7's three tabs keep their order, their words and their panels.

**Owning symbols/landmarks:** `src/web/packages/editor/src/editor-shell/settings.tsx` — `SETTINGS_TABS`, `Tabs.Root` / `Tabs.List` / `Tabs.Tab` / `Tabs.Panel`, the `editor-shell-dialog-lead` `<h2>`; `editor-shell.css` — `.editor-shell-settings-tabs`, `.editor-shell-settings-tab`, the `.editor-shell-dialog` `padding`; the drawing `current/settings.html:22-39` (the `width:150px` column, the active row lifted `#1d2733` with `box-shadow:inset 2px 0 0 var(--accent)`, the `--faint` eyebrow).

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/settings.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/design-language.spec.ts` (Task 1's axis row goes green)

**Interfaces:**
- Consumes: Task 1's rows and the census's axis disposition.
- Produces: one navigation owner in the modal — a vertical tablist whose active row carries the drawing's accent bar — and a `.editor-shell-dialog` whose padding is the nav's geometry rather than a padded column around a strip.

- [ ] **Step 1: Read the drawing's navigation as the target, and name what it replaces**

The drawing draws a `150px` column at `#0e1217` beside the content, its three rows carrying a glyph and a label, the active one lifted and marked with a 2px accent bar on its leading edge. The product's word strip (§5 has no "tab" control) is the thing the drawing does not draw. **The axis is the drawing's to decide** — §7 fixes the three tabs and what each holds, not their axis, and spec §13 says silence about a property is the drawing's jurisdiction, never a licence for the product (`design-language.md`'s own §5 rule 7 permits any grid, so nothing in the bible requires the horizontal form). Record in the commit which measured rows this closes.

- [ ] **Step 2: Rebuild the navigation as a vertical tablist, keeping Base UI as the keyboard owner**

The primitive stays (`0038`); only its orientation and the drawing's treatment change. The three tab words are §7's and `uiCopy`'s. Where the drawing's glyphs are new, they come from the icon set bible §6 closes — a glyph the set does not have is a finding for §6, not an ad-hoc SVG.

- [ ] **Step 3: Decide the lead, now that the nav carries its own label**

The drawing puts "Settings" on the nav as a `--faint` eyebrow at the drawing's `font:600 10px/1`; the product renders an `<h2 class="editor-shell-dialog-lead">` at `var(--text-md)` (`13px`) on `--shell-text`, which is **neither** of §2's two dialog roles — the title at `--text-lg` (15px, `design-language.md:51`) or the eyebrow at `--text-2xs` (10px, muted, `:56`). With the drawing's eyebrow drawn by the nav, the lead's own role is a ruling: it takes §2's dialog title (`--text-lg`) if it stays a title, or it is removed if the nav's eyebrow is the surface's only name. Say which, and quote the §2 row.

- [ ] **Step 4: Walk the keyboard and the focus, and read the capture**

Driver on the rebuilt bundle: open the gear, walk the three tabs by arrow key **and** by Tab (a vertical tablist's model), Escape to close, reopen — the gear must get focus back (`SETTINGS_TRIGGER_ID`). Then open the `?` sheet, which renders the same `.editor-shell-dialog`, and confirm the shared frame and the shared `kbd` rule are unaffected. **The capture is taken and read before the step is done.**

- [ ] **Step 5: Prove the axis row fails when it is put back**

Restore the horizontal strip, rebuild, confirm Task 1's axis row fails, restore with `cp` and confirm with `cmp`.

- [ ] **Step 6: Commit**

Run the whole editor unit suite and record its counts in the body.

---

### Task 3: The frame — the scrim and the two dialogs' shared type

**Outcome:** The modal's overlay resolves §3's scrim as a role rather than as a hex literal, and the shared dialog type resolves a §2 role; both dialogs (the modal and the `?` sheet) move together because they render one rule.

**Owning symbols/landmarks:** `editor-shell.css` — `.editor-shell-dialog-overlay` (`background: #0009` today), `.editor-shell-dialog` (`background: var(--shell-surface)`, `box-shadow: var(--elev-3)`), `.editor-shell-dialog-lead`, `.editor-shell-dialog kbd`, `.editor-shell-dialog > button`; `editor-shell.tokens.test.ts` (the token-declaration test the palette blocks are held to); `src/web/packages/editor/src/editor-shell/shortcut-reference.tsx` (the sheet that shares the rule).

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/design-language.spec.ts` (Task 1's scrim and lead rows go green)

**Interfaces:**
- Consumes: Task 1's scrim/lead rows, Task 2's lead decision.
- Produces: one scrim value, resolved from a token rather than written as a hex (§10), on the one rule both dialogs share.

- [ ] **Step 1: Give the overlay §3's scrim as a role**

§3's elevation table row 3 is `0 24px 60px #000000b3` **+ scrim `#00000073`** (`design-language.md:105`). The product writes `#0009` — a different, darker value **and** a hex literal in a surface, which §10 forbids. The value is §3's; the *mechanism* is the task's, but it must be a token a palette block can carry, not a literal, and not a §4 role (which the bible does not name for a scrim). Declare it where the elevation tokens are declared, and let the token test hold it.

- [ ] **Step 2: Move the type the two dialogs share, once**

`.editor-shell-dialog-lead`, `.editor-shell-dialog kbd` and `.editor-shell-dialog > button` are rendered by `settings.tsx` and by `shortcut-reference.tsx`. Change them together and state in the commit that the `?` sheet's frame is part of this change, not a side effect. Task 1's two-dialog rows (the equality check plan 7 added) are the guard.

- [ ] **Step 3: Measure the boundary under the new scrim, before and after**

Record the modal's own boundary contrast (the `--edge` frame against what is behind it) before and after, in graphite and editorial, and state every ratio that moved and whether it clears its floor. This is Review Focus 4's evidence and it is not dischargeable by a computed-value row. `vg-200`'s pin is the existing floor; this change is not allowed to add a third pinned cell silently.

- [ ] **Step 4: Prove the scrim row fails when the literal is put back**

Reinstate `#0009`, rebuild, confirm the row fails, restore with `cp`, confirm with `cmp`.

- [ ] **Step 5: Commit**

---

### Task 4: The drawing gains the two panels it does not draw

**Outcome:** `current/settings.html` (or its sibling files under `current/`) draws the **Keyboard** and **About** panels in the drawing's own idiom, with the product's real copy, so the rows for those surfaces have a comparator instead of being permanently `no-counterpart`.

**Owning symbols/landmarks:** `docs/design/mockups/current/*.html` and `docs/design/mockups/README.md` (its "Shows" table); the **frozen original** `editor-shell.html`'s Keyboard specimen as the source of **treatment** (its header bar, its chord chip — `editor-shell.html:302-327`); `settings-keyboard.tsx` and `settings.tsx`'s About tab as the source of **content**; `uiCopy.settings` and `shortcutReferenceGroups()` for every string and row.

**Files:**
- Add: the Keyboard and About panels, drawn (one file per view, per `mockups/README.md`'s own rule)
- Modify: `docs/design/mockups/README.md` — the new files' rows
- Modify: `src/web/tests/e2e/mockup-values.ts` — the paths, if the panels are separate files

**Interfaces:**
- Consumes: the original's Keyboard treatment; the product's copy and its shortcut reference projection.
- Produces: a comparator for the Keyboard and About panels, in the drawing's idiom.

- [ ] **Step 1: Take the treatment from the original and the content from the code**

The frozen original drew a Keyboard specimen (a header bar, a chord chip, per-row affordances); it did **not** draw About at all. So the Keyboard panel is drawn in the original's treatment with the **product's** real rows and copy (`shortcutReferenceGroups()` — never an invented action list), and the About panel is drawn in the same idiom (the §5.2 read-only `dl`, per the product's `versionFacts`). No specimen captions, no notes addressed to the reader — `mockups/README.md`'s rule stands.

- [ ] **Step 2: One file per view — decide the shape and say why**

The modal's three panels are three states of one view. The current set's rule is one drawn view per file, so the panels either get sibling files or the one file is extended with the panels **as the product arranges them** (none of the specimen grouping plan 7 Task 9 deleted). Record the choice; do not reintroduce a specimen.

- [ ] **Step 3: Render each new file and read it**

Open each with Playwright at a fixed viewport, screenshot outside the repo, and read the image: one panel, no explanation, nothing clipped. Reading the source is not this step.

- [ ] **Step 4: Point the rows at the new panels, and prove they resolve**

Add the Keyboard/About `mockupPath`s and their rows (Task 1's `no-counterpart` rows become `fix` or `licensed`), and confirm each row resolves — a `mockupDeclared` throw is a broken row, not a reason to drop it. A drawing nothing reads is a drawing that rots.

- [ ] **Step 5: Commit**

The new drawings, the README and the rows together. Tell the user the files exist and that they should open them.

---

## Phase B — The modal's regions

### Task 5: The palette group is the drawing's card grid

**Outcome:** The six palettes render on the drawing's **three-column grid of `--radius-lg` cards**, each card carrying the drawing's **two colour bars** — the palette's ground and its accent — with the name beneath, and the chosen card lifted as the drawing draws it. §5's choice row stays valid for the surfaces that use it; the settings grid is the drawing's shape.

**Owning symbols/landmarks:** `settings.tsx` — `AppearanceTab`'s `RadioGroup` (its `grid-cols-2` / `gap-[var(--space-6)]`) and its `swatch` node; `components/ui/control-choice-row.tsx` (shared with the control fixture — decide whether the settings palettes stop using it or it grows a card shape, and name the blast radius the measurement's §5 states); `editor-shell.css` — `.editor-shell-palette-swatch` (today one `14px` chip, `box-shadow: inset 0 0 0 3px var(--shell-accent)`); the drawing `current/settings.html:44-87` (the grid, the card, the two bars, the selected card's accent border and glow).

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/settings.tsx` (and/or `control-choice-row.tsx`)
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/design-language.spec.ts` (Task 1's grid-count and swatch rows go green)

**Interfaces:**
- Consumes: Task 1's grid-count and swatch rows; `palette.ts` and `shellPalettes` (the list and its owner — untouched).
- Produces: a swatch that **depicts the palette it names** with the palette's own two colours, and a grid whose column count is read by the count comparator.

- [ ] **Step 1: Rule on the shape, and quote why the drawing wins**

The measurement's own §7 names this the open question ("which the target is for the *card grid specifically*"), and spec §13 answers it: the palette cards differ from §5's choice row, and the only section behind the choice row is the one `b602dd13`'s plan added to the bible **and then cited** — which §13 says "cannot license that plan's divergence". So the drawing governs here and the product is the defect. Quote §13's paragraph in the commit. §7.8's "Palette choices retain visual swatches" (`design-language.md:412`) is the predating rule that the *swatch itself* is required, and the drawing is its shape.

- [ ] **Step 2: Draw the two bars from the palette the row names**

The chip it replaces resolves per element through `data-shell-palette` (`0035`). A two-bar preview must do the same: each bar resolves a role **of the palette the row names**, not of the palette in force. Review Focus 2 is this step's evidence — read all six rows' own colours in two palettes, not a computed-value row.

- [ ] **Step 3: Keep the grid a grid and the keyboard the group's**

The grid gives the columns; the `radiogroup` keeps the arrow model and reading order (§5 rule 7). Drive Tab/arrow through the six rows and confirm the selected card reads as chosen by more than its border on every palette (the fixture's §4e reading, re-pointed at the modal). Review Focus 3.

- [ ] **Step 4: Prove the grid-count row fails when a column is removed**

Set the grid back to two columns, rebuild, confirm the row fails, restore with `cp`, confirm with `cmp`.

- [ ] **Step 5: Commit**

Run the whole editor unit suite and record its counts.

---

### Task 6: The boxed follow-the-system row

**Outcome:** The follow-the-system row keeps the drawing's panel box, **licensed by a rule that predates this plan**, and takes a §3 step for the inset the drawing draws off-scale; and the box's every declared value is read, not one of them.

**Owning symbols/landmarks:** `settings.tsx` — `<ControlToggle shape="boxed" …>` inside `<div className="mt-[var(--space-14)]">`; `components/ui/control-toggle.tsx`'s box (its `shape` prop and `labelFor`); `editor-shell.css`; the drawing `current/settings.html:89-93` (`padding:9px 10px`, `gap:10px`, `border:1px solid var(--edge)`, `border-radius:8px`, `background:var(--panel2)`, the 26×14 `--radius-full` track); `mockup-values.ts`'s existing box rows.

**Files:**
- Modify: `docs/design/mockups/current/settings.html` — one value (Step 2), and nothing else
- Modify: `src/web/tests/e2e/mockup-values.ts` — the box's inset row
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` — only if Step 1 finds the product's inset off-scale

**Interfaces:**
- Consumes: the census's box disposition; the existing box rows (radius, gap).
- Produces: the box's `padding` read as a third declared value, so a change to the drawing's inset cannot pass unnoticed.

- [ ] **Step 1: Rule on the box, and quote the rule that licenses it**

The tension is real and stated: §1 forbids chrome that decorates (`design-language.md:23-24` — "If a border, shadow or colour does not distinguish one thing from another, it is not there"), and §5's control vocabulary is closed (`:145` — "A control is one of these, or it is not a control") with no bordered container in it. Yet the drawing draws a box and the product follows it.

**Ruled by the controller on 2026-10-11: the box stays, and §13's licence gate does not apply to it.** The gate at spec `:469-477` resolves a difference **between the product and the drawing** — it exists because a plan amended a rule and then cited it as warrant for drawing a surface differently from the mockup. Here there is no such difference: the drawing draws the box and the product renders the box. A licence is what a *divergence* needs, and this row has none. What the row does have is a question the spec answers separately and in its own words — "A mockup that no longer matches the bible is worse than no mockup" (`:481-483`) — and the bible's current text answers it: §5 rule 2 names this exact shape and says it "keeps the shape it is drawn with":

> "A row a surface's own drawing shapes differently — a switch row whose label fills the row inside a panel box, a control spanning the row under its own heading — is not a field row and keeps the shape it is drawn with." (`design-language.md:167-171`)

A current sentence of the bible is the bible, whoever wrote it; §13's "predates the divergence" clause is scoped by its own paragraph to a plan licensing **its own** product divergence, and plan 7 wrote this rule to describe a shape the drawing already carried. §1's own test is met on the facts: the box separates the platform-level row from the palette group, which is a distinction, not decoration. **Quote the sentence and cite its line in the commit.** The alternative — removing the box — would require amending bible §5 in the same commit, which is a bible change this plan is not allowed to make for its own convenience; if the implementer concludes the box must go, that is a ruling to raise, not to take.

- [ ] **Step 2: Fix the one value that has no rule — the drawing's `9px`**

`settings.html:89` declares `padding:9px 10px`. §3 closes the spacing scale at `4, 6, 8, 10, 12, 14, 16, 20, 24, 32` (`design-language.md:69`), so `9` is off-scale and **the drawing is stale, not the product** — the product already renders `--space-8`. Correct the drawing to `8px` (the value the product renders), name §3 and `vg-303` in the commit, and edit nothing else in the file. This is the direction plan 7 Task 3 Step 1 set and it is never reversed.

- [ ] **Step 3: Read the box's inset, so the third declared value is held**

The existing rows read the box's `border-radius` and `gap`; the drawing also declares its `padding`. Add the `padding-top` row — a drawing's declared value that no row reads is `vg-292`'s family, which plan 7 Task 8 left. The row goes green after Step 2 and reddens if the drawing's `9px` returns.

- [ ] **Step 4: Prove the inset row fails on the stale value**

Put `padding:9px 10px` back, rebuild, confirm the row fails, restore with `cp`, confirm with `cmp`.

- [ ] **Step 5: Commit**

---

### Task 7: The Keyboard panel's rows

**Outcome:** The Keyboard panel matches what Task 4 drew — the reference's header and its return-to-default action, the chord mark, the per-row affordance — and the four states §13.1 requires are driven and captured.

**Owning symbols/landmarks:** `settings-keyboard.tsx` — `shortcutReferenceGroups()`, the `kbd`, `ControlIconButton` (the pencil), the per-row `editor-shell-keyboard-action` reset, the foot `data-vigilia-shortcut-reset-all`, the armed row's `data-armed`, `editor-shell-keyboard-reason`; `editor-shell.css` — `.editor-shell-dialog kbd`, `.editor-shell-keyboard dd`, `[data-armed]`, `.editor-shell-keyboard-action`, `.editor-shell-keyboard-reason`, `.editor-shell-keyboard-notice`; the Task 4 drawing.

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/settings-keyboard.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/design-language.spec.ts` (Task 1's Keyboard rows go green)

**Interfaces:**
- Consumes: Task 4's Keyboard drawing; `shortcut-manager/reference.ts` (the projection — untouched).
- Produces: one treatment for a chord mark, and one home for "reset all", matching the drawing.

- [ ] **Step 1: Take the drawing's treatment for the chord mark and the reset action**

The product renders a bare `<kbd>` (`ui-monospace`, `11px`, `--shell-muted`) where the drawing draws a bordered chip (§2's "Values are mono … chord marks" is the predating role, `design-language.md:38`), and the original specimen put "Reset all" in a header bar with the product rendering it as a foot button. Pull each to the drawing's route, and where a control the drawing **does not** draw survives (the per-row Reset), say so with its reason rather than deleting a capability (§13.1).

- [ ] **Step 2: Drive and capture the four states**

Empty overrides, storage refused (session-only), an armed row, and a refusal in the armed row (§9's reason, `role="alert"`). The `keyboard-armed-row` capture already exists — re-point it at the changed surface and confirm it still reads. Review Focus 5.

- [ ] **Step 3: Check the shared `kbd` rule against the `?` sheet**

`editor-shell-dialog kbd` is rendered by the sheet too. Task 3 moved it; this step confirms the sheet's own reading is unchanged, so the sheet is not a casualty.

- [ ] **Step 4: Commit**

Run the whole editor unit suite and record its counts.

---

## Phase C — The drawing's own values, the ratchet, the capture

### Task 8: The drawings' declared values are held to §3 and §2, not radius alone

**Outcome:** Every checked drawing's off-scale **spacing** and **type** values are corrected to §3's steps and §2's scale, and the drawings gate reads them — radius is no longer the only property a drawing's literal is held to.

**Owning symbols/landmarks:** `docs/design/mockups/current/*.html`; `src/web/tests/e2e/design-language.spec.ts`'s radii gate (which reads `currentDrawings()` and `mockupDeclarations`, and names the degenerate exemptions with a reason each); `mockup-values.ts`'s `mockupDeclarations` / `SHORTHANDS_SETTING`.

**Files:**
- Modify: `docs/design/mockups/current/settings.html` and any sibling the new panels add
- Modify: `src/web/tests/e2e/design-language.spec.ts`

**Interfaces:**
- Consumes: the radii gate plan 7 landed (the pattern to widen, not replace).
- Produces: a gate whose positive control a file with no off-scale value still exercises.

- [ ] **Step 1: Survey the drawings' off-bible values, and classify each**

The radius gate already holds every `border-radius`. Sweep the same declarations for **spacing properties** (the ones `design-tokens.mjs`'s `SPACING_PROPERTY` names) and for the **type sizes** §2 lists, and classify each off-scale value: **correct** it (a value §3 has no step for that a nearby step expresses — `margin-bottom:11px` is the class), or name it a **degenerate with a reason** (a thickness, a `%`), exactly as the radii gate names `1px`/`2px`/`50%`. Record the class on the register, not in a comment.

- [ ] **Step 2: Correct the drawings to the bible, never the reverse**

Each corrected value names its §3 step or §2 role in the commit. A value the product renders is **not** the source of the drawing's value — a drawing corrected to the product's number is the self-licensing this plan exists to end.

- [ ] **Step 3: Widen the gate, and prove it reddens**

The gate reads the class, not the file: a planted off-scale value in any drawing reddens it naming the file and line. Prove with one planted step, then restore with `cp` and `cmp`.

- [ ] **Step 4: Commit**

---

### Task 9: `editor-shell.css`'s residuals get a counted ceiling (`vg-274`)

**Outcome:** `editor-shell.css`'s remaining ratchet violations are **counted and capped** — a check that reddens when the count rises above the number measured after this plan's CSS edits — with the values no §3 step can express exempt **by name and reason**; the ceiling and the exemptions are recorded on `vg-274`.

**Owning symbols/landmarks:** `scripts/design-tokens.mjs` (its exported `check(relPath, source, biblePx)` and its list-of-files entry-point contract at `design-tokens.mjs:9`); `scripts/design-tokens.gated.json`; `docs/decisions/0040-the-design-token-ratchet-is-ours-not-a-biome-rule.md` (its "a gate that starts red and stays red is turned off", `:12`); `vg-274`'s measurement; `src/web/package.json`'s scripts.

**Files:**
- Modify: `scripts/design-tokens.mjs` and/or add the check its caller uses
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` — only the violations whose fix is a verified no-op
- Inspect and leave unchanged: `scripts/design-tokens.gated.json` (Step 1 says why the path does not join it)

**Interfaces:**
- Consumes: `check` (the exported checker), the file's measured count.
- Produces: a ceiling over a file that is not in the `gated` list — a target that can only fall.

- [ ] **Step 1: Re-measure the file after this plan's edits, and set the ceiling where the measurement lands**

`vg-274` measured **61** violations after plan 7 (`7` hex-literal, `30` off-scale px, `24` spacing px). Plan 8's CSS edits move some of those (the lead, the tabs, the scrim, the keyboard rules), so re-measure and record the new number and its classes. **The path does not join `design-tokens.gated.json`**: that list is "the files already converted" (`design-tokens.mjs:9`) and a file holding dozens of violations is not converted, which is the failure ADR-0040 `:12` names. The ceiling is a **separate** instrument over the one file — a row that fails above the measured count and passes at or below it, so it is green at HEAD and can only tighten.

- [ ] **Step 2: Exempt the three values no §3 step can express, by name and reason**

`vg-274` measured three `margin-right` values (`62px`, `92px`, `122px`) that are no §3 step. They are exempt in the row **with a reason each** — the same shape the radii gate uses for `1px`/`2px`/`50%` — and the set is recorded on `vg-274` so the exemption is the register's, not a comment's. If a §3 step *can* express one when re-derived, that is a fix here, and say which.

- [ ] **Step 3: Fix only the no-ops this plan's edits create, and never widen the ceiling**

A substitution is allowed only where the literal already equals the role's value, checked against the declaration (plan 7 Task 6's rule). A fix that moves pixels is a design decision and belongs to `vg-274`'s own pass — do not fold it in.

- [ ] **Step 4: Prove the ceiling reddens**

Add one hex literal to a surface rule, run the check, confirm it fails naming the file, line, column and rule, and remove it. Then confirm the committed `design:check` is still green over the files it covers.

- [ ] **Step 5: Record the outcome on `vg-274`, and commit**

The ceiling, the residual class counts, and the named exemptions go on the row; the commit body says what changed and that **no claim of "fixed" is made** for the 24 spacing values or the three inexpressibles.

---

### Task 10: The parity capture, beside the drawing, and the plan closes

**Outcome:** Built bundles, the modal captured by a registered action in both palettes, the captures placed **beside** `current/settings.html`, and every remaining difference either fixed or backed by a quoted predating rule — with the plan closed.

**Owning symbols/landmarks:** `src/web/tests/e2e/design-language.spec.ts`'s settings capture (`captures the settings modal's three tabs in the design language`); `docs/evidence/screenshots/README.md`; the produced images beside `docs/design/mockups/current/settings.html`.

**Files:**
- Modify: `src/web/tests/e2e/design-language.spec.ts` (only if the capture's assertions moved with the axis)
- Modify: `docs/evidence/screenshots/README.md`
- Add: the produced images under `docs/evidence/screenshots/`, both palettes, and the pair placed beside the drawing
- Modify: `docs/design/mockups/current/settings.html` — only if Step 3 finds a difference whose disposition is `drawing-stale`; the frozen originals never move

**Interfaces:**
- Consumes: every earlier task; Task 1's census as the comparison's spine.
- Produces: the capture that is this plan's completion condition (spec §13, Acceptance).

- [ ] **Step 1: Re-capture every settings action this plan moved, in both palettes**

Graphite and editorial, because one palette cannot show a hard-coded hex. `--workers=1`, against rebuilt bundles, and confirm **1 test ran** per action — a `--grep` matching nothing exits 0 with zero tests.

- [ ] **Step 2: Place the captures beside the drawing and re-run Task 1's table**

Every `fix` row should now pass. Record any that do not as an open finding with its owner — not as a deliberate difference. **A capture of one palette cannot show a hard-coded hex**, so both are taken even where the row is palette-independent.

- [ ] **Step 3: List every remaining difference with its citation, or state that there are none**

Re-read every `licensed` and `drawing-stale` row against the shipped build: a `licensed` row whose citation is not verbatim-verifiable is reclassified `fix`; a `drawing-stale` row names the drawing edit that repaired it. A difference that is a **product capability the drawing does not draw** is `drawing-stale` — repair the drawing, never the product (Task 4 was that repair for two panels). An **empty difference list is stated as a finding**, not assumed (§13 step 4).

- [ ] **Step 4: Say which Acceptance items are met and which are not**

One per line, `met` / `not met` / `blocked`, with evidence. The items this surface answers: §7 (the modal and its three tabs, observed), §10 (six palettes distinguishable by surface — the palette capture), §9 (the scales are consumed — Task 9's ceiling is a counted target, **and the 24 spacing values are named open**), §13 (the capture beside the drawing), §13.1 (the four Keyboard states). Items that are not this plan's: `vg-172` (phone), `vg-288` (the release row), `vg-310`/`vg-311` (light's chrome and the dead blur), `vg-274`'s spacing pass. Never announce the plan closed while a required item fails.

- [ ] **Step 5: Update `STATUS.md`, then commit and archive**

Replace "Last completed change" with 1–5 bullets, one item per line, never wrapped; run `npm run status:check` from `src/web/`. Run the whole editor unit suite and record its counts in the commit body. Tell the user the images exist before staging them, and inspect them first. Commit the capture, the registration rows and the plan's changes together; then move this plan to `docs/superpowers/plans/archive/` and hand off to plan 6 (iconography and copy) — which the spec's execution order runs next.

---

## Out of scope

- **The settings modal's mechanism.** `0035`'s palette resolution, `palette.ts`, `shellPalettes`, the OS subscription and the storage keys are untouched. This plan changes the readout and the treatment, not the mechanism.
- **The shell and its clusters.** The rail, panes, stage, inspector, status strip and the three floating clusters are plan 7's and `vg-222`'s. This plan touches the shell only where it shares a rule with the modal (`.editor-shell-dialog`, `.editor-shell-dialog-overlay`, `.editor-shell-dialog-lead`, `.editor-shell-dialog kbd`).
- **The control set other surfaces use.** `control-choice-row.tsx` is shared with the control fixture; a change made for the settings grid is named in the commit and its blast radius is whatever the fixture's parity rows measure. The control vocabulary's other users are untouched.
- **`vg-274`'s spacing pass.** The 24 spacing values whose §3 substitution moves pixels, and the three no-step `margin-right` values, are **named open** with a ceiling (Task 9), never claimed fixed.
- **`vg-310`** (light's chrome is translucent — five of six palettes are opaque) and **`vg-311`** (the build emits only the prefixed `-webkit-backdrop-filter`, so the glass blur is dead) are their own rows and their own owners. This plan reads them where the scrim or the light palette's capture crosses them, and fixes neither.
- **`vg-288`** (no loadable document carries `metadata.version`, so the About tab's release row has no rendered proof). This plan draws the About panel as the product renders it — the absent case — and leaves the row open.
- **The phone layout (`vg-172`), the players, the host, `renderer-core` and the theme format.** No scene change; no second persistence mechanism.
- **The bible itself.** This plan cites §1, §2, §3, §5, §7.8, §9 and §10 and amends none. If a task finds it must amend one, that is a ruling recorded in the ledger and named in the commit — never a licence for that task's own divergence (spec §13).
- **Auto-parsing a drawing for every property.** The reader covers the properties a `PARITY` row names and the classes the gate sweeps (Task 8). A general mockup parser is not this plan.

## Self-review

- **Spec coverage.** §7's three tabs and their contents are Tasks 2, 5, 6, 7; §10's six palettes-by-surface is Task 5's capture and Task 10 Step 4; §9's count ("the scales are consumed") is Task 8's widened drawings gate and Task 9's ceiling; §13's gate is Task 10; §13.1's states are Task 7 Step 2; the Acceptance item on parity is read in Task 10 Step 4.
- **Step scan.** Every step names a file, a symbol, a command or an expected output, and asks for one thing to be written. No "handle edge cases", no "similar to Task N".
- **Type consistency.** `ParityRegion`, `mockupDeclared`, `readMockup`, `currentDrawings` and the `surface` control set are plan 7's and are named unchanged; the two new comparators are Task 1's and are used by Tasks 5 and 3 under the names Task 1 gives them.
- **Review Focus.** Five, pinned: 1 to Task 2, 2 and 3 to Task 5, 4 to Task 3, 5 to Task 7.
- **Red proofs.** Every task that changes a value reverts it and confirms its row goes red; every restore is `cp` + `cmp`, because `git checkout` normalises line endings on this box.
- **The three rulings.** The **navigation axis** is Task 2 (the drawing governs; §5 rule 7 permits any grid). The **bordered row** is Task 6 Step 1, ruled rather than left as a fork: there is no product-vs-drawing difference to license, and the bible's own §5 rule 2 (`design-language.md:167-171`) names the shape; the drawing's `9px` is fixed (`vg-303`). The **ratchet** is Task 9 (a counted ceiling at the measured number, the three inexpressibles named, no "fixed" claim).
- **The register.** `vg-303` is closed by Task 6 Step 2; `vg-296`'s bordered-row clause gains its reader in Task 6 Step 3; `vg-274` is narrowed by Task 9; `vg-294` and `vg-295` are closed by Task 3; `vg-314`'s family is answered for two panels by Task 4; `vg-285`, `vg-288`, `vg-310`, `vg-311` stay open.
- **The open question** is stated in Task 2 Step 3 and in Global Constraints as a question for the user, not a decision for an agent — see below.

## An open question for the user, not a decision for an agent

**Should `current/settings.html` show the running editor behind the modal instead of a flat `--bg` ground?** The drawing today paints the modal on plain `var(--bg)`, centred. A reader comparing it to a real screenshot sees the modal alone against one colour, where the product shows it over the editor. The question is whether the drawing should draw what is behind the modal, for a truer side-by-side.

- **The conservative default, and what this plan does:** the drawing's ground is **left as it is** (a drawing change to answer this would be this plan editing a drawing to its own convenience), and **the plan's rows compare the modal's own regions only** — the overlay's scrim is read against §3's token, not against a drawn backdrop, exactly as Task 1's census records. If the user rules that the ground should show the editor, that is a drawing task in a later pass, and the rows do not change.
- **Why it is not an agent's call:** it changes what the acceptance instrument shows a person, which is a design decision, and the drawing is not replaced on an agent's initiative (spec §13, the user's ruling of 2026-10-10).
