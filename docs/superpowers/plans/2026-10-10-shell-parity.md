# Shell parity with the drawing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the editor shell — its composition, its radius scale and its six palettes' surfaces — to what `docs/design/mockups/editor-shell.html` draws, by making the drawing a machine-read acceptance instrument rather than a page a plan describes.

**Architecture:** Two measured files already exist and are this plan's evidence, not its speculation: `.superpowers/sdd/2026-10-08-settings-and-appearance/mockup-vs-shell-measurement.md` (the shell) and `settings-vs-mockup-measurement.md` (the modal; its own plan follows this one). They agree on the shape of the failure: the drawing is **flush** where the product insets four regions 8px apart at an off-scale `12px` radius, and the drawing's graphite is **flat and opaque** where the product's is alpha glass over a gradient. Task 1 turns the drawing into something a test reads and fails against; Tasks 2–3 fix the composition; Tasks 4–5 fix the colour; Task 6 makes the ratchet cover the stylesheet those fixes live in; Task 7 captures the result beside the drawing.

**Spec:** [`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`](../specs/2026-10-08-editor-design-language-design.md) — §3, §4, §5, §7, §9, §12 (this plan adds its row), §13 as amended 2026-10-10, Acceptance
**Normative companion:** [`docs/design/design-language.md`](../../design/design-language.md) — §3 (space/radius/elevation), §4 (colour roles), §7 (shell layout)
**Reference:** [`docs/design/mockups/editor-shell.html`](../../design/mockups/editor-shell.html) and [`README.md`](../../design/mockups/README.md)
**Decisions:** [`0035`](../../decisions/0035-the-shells-palette-resolves-at-the-element-not-the-root.md) (palette resolution — untouched), [`0039`](../../decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md), [`0040`](../../decisions/0040-the-design-token-ratchet-is-ours-not-a-biome-rule.md)

## Global Constraints

- **The drawing governs wherever the written rules are silent** (spec §13, amended 2026-10-10). A difference is kept only against a **named rule that predates it** — a bible `§N`, an ADR or a spec section that *positively requires* the product's treatment. Silence, and a rule this plan writes itself, are not licences.
- **Replacing the mockup is not an available disposition** (spec §13, the user's ruling of 2026-10-10). A mockup edit in this plan corrects a drawing that is stale or self-contradictory and must say which; it may never bless a divergence.
- **A drawn window is not a product element.** `docs/design/mockups/editor-shell.html` renders the app *inside a page*, so it bounds it with a card — `editor-shell.html:44-48`, `width:1180px; border:1px solid var(--edge); border-radius:10px; overflow:hidden`. The product's editor **is** the window and fills it, so no product element carries that radius or border, and the drawing's wrappers (`.mockup`, which wraps only the settings specimens) are never a product surface. A `PARITY` row needs a counterpart element; where there is none, the row is not a `fix` and does not belong in the table.
- **A rule that settles a property is a licence; a silent section is not.** §7.5 names the stage ground and declares that "neither texture nor a flat ground is mandatory" — that is a predating rule speaking *to that property*, so the product's flat ground stands. The distinction is narrow: it applies only where a section names the same property and permits the variant, and it may never be stretched to "the bible does not forbid it".
- **No hex literal in a surface** (§10). A colour is a role; a value belongs to a palette block.
- **Bible §3's radius scale is closed**: `--radius-sm` 4 / `--radius-md` 6 / `--radius-lg` 8 / `--radius-xl` 10 / full 999, and `--radius-xl` plus backdrop blur are reserved for **floating clusters over the canvas** (dock, view controls, identity chip). Spacing steps and type roles (§2) are equally closed. **But the scale answers a question only a surface that is rounded asks.** A **flush region** of the shell — the rail, a pane, the stage, the inspector, the header, the status strip — is **square**, because §7's diagram abuts those regions inside one boundary and a radius against a neighbour shows the ground through its corners; the drawing declares a radius on everything it wants rounded and none on any of them, so its omission there is a declaration, not silence. A **floating surface over the shell** takes the nearest entry it *is*: a dialog is a panel at `--radius-lg`, not a cluster.
- **One owner per concept**: read `docs/architecture/ownership.md` before adding or moving a token, and extend the existing owner rather than adding a second declaration of the same value.
- No new dependency; no change to `packages/renderer-core`, the player, the host or the theme format; Fabric JSON stays the persisted scene.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Refuse an invalid numeric input rather than coercing it to zero.
- **Captures** follow `docs/evidence/screenshots/README.md`: built bundles, `VIGILIA_CAPTURE=1`, `--workers=1`, registered actions only. Rebuild the affected bundles after any source change **and** after reverting a deliberate break.
- **A red browser run at the default worker count is not a measurement** (`vg-285`): re-run a failing spec alone at `--workers=2` before believing it.
- Report anything not actually verified, in the report and in the commit.

## Review Focus

Five failure modes this change implies and no single task's tests would catch. Each is pinned to the task that owns the code.

**Mockup paths, from Task 9 onward.** Every task below Task 9 was written naming the files that existed when it was drafted. Task 9 replaces the *target* with new files and keeps the old ones as provenance, so in **every task after Task 9** a reference to "the drawing", or to one of the filenames on the left, means the file on the right — and a reference to a line number in an original is a stale landmark to re-locate in the current file, never a reason to read the original:

| Named in this plan as | Means, from Task 8 and Task 2 onward |
|---|---|
| `docs/design/mockups/editor-shell.html` | `docs/design/mockups/current/shell.html` |
| `docs/design/mockups/inspector-controls.html` | `docs/design/mockups/current/controls.html` |
| `docs/design/mockups/inspector-language.html` | `docs/design/mockups/current/controls-light.html` |

**The originals are never a target.** They are the record of what was designed first; the user's instruction of 2026-10-10 kept them and had new files built. Reading one to decide a value is the drift this plan exists to end — and Task 9's Step 5 proves they were not edited, so an original's values are *historical*, not normative.

**Execution order.** The tasks are numbered in writing order, which is not execution order. **Task 9 runs first**: everything else reads the mockups, and the user asked on 2026-10-10 for new files showing today's surfaces without annotation, so the new drawings exist before the instrument is re-pointed at them. Then **Task 8**, which answers a defect the user reported and must land before Task 7 turns the ratchet on over the stylesheet it edits. After it, the order is 2 → 3 → 4 → 5 → 6 → 7.

1. **A flush shell can detach a control from what it controls.** The 8px gap is what visually separates the rail, both panes and the stage today; removing it is a geometry change to a layout that also holds the pane toggles, the rail slots and the canvas clusters. A hairline boundary that runs through a control's own hit area, or a toggle that now abuts the region it acts on, is a usability defect no geometry assertion sees. **Task 2** carries the browser walkthrough: toggle each pane, drag the inspector, click the rail's four slots and the dock, with the capture read.
2. **Making chrome opaque moves every measured contrast ratio.** `vg-200` (the resting `--edge` boundary) and `vg-201` (`--warn` text) already pin failures; the whole palette set is a validated system where alpha surfaces composite against a backdrop, and an opaque surface composites against nothing. A palette can pass a geometry check and ship a ratio below §5's floor. **Task 5** carries the six-palette contrast measurement, and the existing `shell-appearance.spec.ts` assertion is amended deliberately rather than deleted.
3. **The stage's own frame is not only CSS.** The stage carries a `12px` radius and a `--shell-edge` border, and the canvas inside it is a Fabric surface whose artboard clip is scene-level (`vg-046`'s family). Flushing the stage can change whether the artboard reads as clipped, and a CSS-only change can leave the scene and the frame disagreeing. **Task 2** carries the check that the artboard's edge and the stage's boundary still coincide at both ends of the zoom range.
4. **Focus rings across a shared hairline.** Regions that abut share one 1px `--edge` boundary; a ring drawn inside one region and a ring drawn inside its neighbour now touch, and a focus style that reads as two rings — or that loses its contrast against a neighbouring surface rather than against the page — is invisible to a computed-value assertion. **Task 2** carries the keyboard walk (Tab through the header, the rail, both panes and the stage controls) with the capture read, not only asserted.
5. **The dialog frame is shared with the `?` sheet and the settings modal.** `.editor-shell-dialog` is one rule rendered by `shortcut-reference.tsx` and by `settings.tsx`; a frame, lead or `kbd` change made for the shell is a change to both, and neither this plan's capture nor the next plan's frames both. **Task 3** and **Task 6** carry the sheet: the sheet's own capture is re-taken, and Task 3 asserts the sheet's computed frame equals the modal's.

---

### Task 1: The drawing becomes an instrument — the census and the parity reader

**Outcome:** A reader that extracts a declared value from `docs/design/mockups/editor-shell.html`'s own inline stylesheet by selector, a parity table naming — per region — the drawing's selector, the product's selector and the governing bible section, and a spec that **fails** on the state shipped today.

**Owning symbols/landmarks:** `docs/design/mockups/editor-shell.html` (`.mockup` at its frame rule, `.mockup-header`, `.mockup-body`, the rail's rule, the pane rules, the stage rule, the status rule, the cluster rules); `src/web/packages/editor/src/editor-shell/editor-shell.css` (`.editor-shell` root, `.editor-shell-header`, `.editor-shell-body`, `.editor-shell-rail`, `.editor-shell-panel`, `.editor-shell-stage`, `.editor-shell-inspector`, `.editor-shell-status`); `src/web/tests/e2e/design-language.spec.ts` (plan 1's harness — add to it, do not add a second procedure).

**Files:**
- Add: `src/web/tests/e2e/mockup-values.ts` — the reader
- Modify: `src/web/tests/e2e/design-language.spec.ts` — the parity assertions
- Add: `.superpowers/sdd/2026-10-10-shell-parity/adjudication.md` — the census table

**Interfaces:**
- Consumes: the two measurement files named above; the mockup's inline stylesheet; plan 1's harness and its fixture.
- Produces: `mockupDeclared(mockupHtml: string, selector: string, property: string): string` — the value the drawing declares, throwing with the selector and property when it declares none; and `PARITY: readonly ParityRegion[]`, where `ParityRegion = { region: string; mockupSelector: string; mockupProperty: string; productSelector: string; bibleSection: string; licensed?: string }`. `licensed` carries the text of the predating rule that keeps a difference, and its absence is what makes a difference a defect.

- [ ] **Step 1: Write the reader, and prove it reads the drawing rather than a copy**

`mockupDeclared` parses the drawing's inline `<style>` for the rule whose selector matches, and returns the declared value of the named property. Prove it three ways in `mockup-values.ts`'s own colocated test: the shell frame's radius reads `10px`; a property the rule does not declare throws naming both; an unknown selector throws. Then change the drawing's value on disk, re-run, and confirm the reader returns the new one — a reader that returns a constant would pass the first three checks.

`ponytail:` a regex over an inline stylesheet is the ceiling here. Upgrade to a real CSS parse only if the drawing gains nested rules or shorthand the reader mis-reads.

- [ ] **Step 2: Write the census as a table, one row per region, with the positive rule or none**

`adjudication.md` carries every region from **both** measurements as rows: region, what the drawing declares (`meta.master`-style `file:line`), what the product computes, the bible section and what it says. The final column is the disposition and must be one of:

- **fix** — no predating rule requires the product's treatment;
- **licensed** — a predating rule is quoted, verbatim, and it positively requires it;
- **drawing-stale** — the drawing contradicts the bible, with the bible section quoted and the mockup edit named.

No row may read "deliberate". A row whose only support is a bible section this **plan** touches is `fix`.

- [ ] **Step 3: Write the assertions so they fail on today's build**

Add to `design-language.spec.ts` a case per `fix` row: open the editor, read the product's computed value for `productSelector`, and assert it equals `mockupDeclared(...)`. Run it and record the failures — the expected set is at least the four body regions' inset and radius, the shell frame's radius, and the dialog's frame. **A run with no failures means the reader is not reading what the assertion reads**, and the step is not done until the failures are named in the report.

- [ ] **Step 4: State the count, and file what the census found that this plan does not fix**

The census's row count, its `fix` / `licensed` / `drawing-stale` tallies, and every row this plan leaves open go in the report and in the commit body. A finding outside this plan's surface (the modal's regions are the next plan's; the clusters are `vg-222`'s) is a row in `docs/product/backlog.jsonl` from a `Discovered, not fixed:` trailer.

- [ ] **Step 5: Commit**

```bash
cd src/web
npm run test -- tests/e2e/mockup-values
git add tests/e2e/mockup-values.ts tests/e2e/design-language.spec.ts
git commit -m "test(e2e): the drawing is read, not restated, and parity fails on today's shell"
```

---

### Task 2: The body is flush

**Outcome:** The rail, both panes, the stage and the inspector share 1px hairlines with no gap and no inset, as bible §7's diagram and §3's elevation row 0 draw them — and every control that lived in the gap still works.

**Owning symbols/landmarks:** `editor-shell.css` — `.editor-shell-body` (its `grid-template-columns`, its `gap: 8px` and `padding: 8px`), `.editor-shell-rail`, `.editor-shell-panel`, `.editor-shell-inspector`, `.editor-shell-stage`, and the hairline comments above `.editor-shell-header` and `.editor-shell-status`; `shell-layout.tsx` (the region elements), `rail.tsx`, `display-switch.tsx`, `canvas-dock.tsx`.

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/design-language.spec.ts` (Task 1's rows for the body's inset and gaps go green)

**Interfaces:**
- Consumes: Task 1's `PARITY` rows and `mockupDeclared`.
- Produces: a body whose regions abut, with each interior boundary carried by exactly one region's own border — the owner named in a comment, because two regions each drawing a border against the other is two owners for one hairline.

- [ ] **Step 1: Remove the inset and the gap, and give each interior boundary one owner**

Delete the body's `gap` and `padding`; give the rail and the left pane `border-right`, the inspector `border-left`, and the stage none, so no boundary is drawn twice. The bible's §3 row 0 value for panels is `1px --edge` with no shadow — the comment above the region declares which side owns each hairline.

- [ ] **Step 2: Run Task 1's assertions and confirm the body rows pass**

Run: `cd src/web && npx playwright test design-language.spec.ts --project=desktop-chromium --workers=1`
Expected: the body inset and gap rows now pass; the radius rows still fail (Task 3). Name the still-failing rows in the report.

- [ ] **Step 3: Prove the geometry assertions can fail**

Put the 8px gap and padding back, rebuild, re-run, and confirm the body rows fail. Restore with `cp` from a copy taken before the break, and confirm the restore with `cmp` — `git checkout` normalises line endings and cannot prove a byte-identical restore on this box.

- [ ] **Step 4: Walk the controls that lived in the gap**

Browser walkthrough on the rebuilt bundle: toggle each pane from the header, drag the inspector, click all four rail slots, click the dock's tools and the view cluster's zoom. Confirm each still hits, that no hairline crosses a control's hit area, and that Tab through the header, the rail, both panes and the stage's controls leaves every focus ring visible against its neighbour and legible as one ring rather than two (Review Focus 1 and 4). **The capture is produced here and read before the step is called done** — a geometry assertion is not this evidence.

- [ ] **Step 5: Check the stage's frame against the artboard**

Zoom to both ends of the range with a document loaded and confirm the artboard's edge and the stage's boundary still coincide — the stage's border and radius are being removed, and the canvas inside it is a Fabric surface whose artboard clip is scene-level (Review Focus 3). If the two disagree at either end, state it as a finding rather than adjusting the CSS until the picture looks right.

- [ ] **Step 6: Commit**

Run the whole editor unit suite and record its counts in the body.

---

### Task 3: The radius scale, and the two dialogs

**Outcome:** Every literal radius in `editor-shell.css` is on §3's closed scale, is a named degenerate mark, or is gone because the surface is a flush region of the shell and square. The three off-scale `12px` region radii (rail, panes/inspector, stage) are **removed**, and the fourth (`.editor-shell-dialog`) becomes `--radius-lg` — so the one surface here that floats keeps a scale entry and every surface that abuts loses one. The drawing's outer card is the **drawn window** and has no counterpart (Global Constraints), so nothing here rounds the product's root.

**Owning symbols/landmarks:** `editor-shell.css` — the four `12px` rules (`.editor-shell-rail`, `.editor-shell-panel`/`.editor-shell-inspector`, `.editor-shell-dialog`, `.editor-shell-stage`), the `7px` icon-button rule, the layer rows' `5px`, and the swatch/thumb `2px` rules; the `--radius-*` declarations; `docs/design/mockups/current/shell.html` — its `border-radius` declarations are the evidence for which surfaces are rounded (line 150, 157 and 170 carry the three Step 1 corrects), and the drawn window's own frame rule is not a product surface at all.

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/design-language.spec.ts`
- Modify: `docs/design/mockups/current/shell.html` — the three off-bible declarations Step 1 corrects, and nothing else in it

**Interfaces:**
- Consumes: Task 1's radius rows; Task 2's flush body.
- Produces: no behavioural interface; the invariant is that no `border-radius` literal off §3's scale survives in this file, which Task 6's gate enforces rather than this task's prose.

- [ ] **Step 1: Correct the drawings' own off-bible declarations, in the same task that reads their radius scale**

**The current drawings are correctable and the originals are not** — the drawings' README now says the bible wins where the **current set** disagrees with it, and that the originals are frozen. Task 9 copied the originals' treatment faithfully, so the off-bible values came with it and now live in the target:

| Where | Says | §3 requires |
|---|---|---|
| `current/shell.html:150` identity chip | `border-radius:9px`, `box-shadow:0 8px 20px #0007` | `--radius-xl` **10px** (`design-language.md:93`), elevation 1 `**0 8px 20px #00000059**` (`:103`) |
| `current/shell.html:157` view cluster | `border-radius:9px`, `box-shadow:0 8px 20px #0007` | as above |
| `current/shell.html:170` dock | `box-shadow:0 10px 26px #0007` | elevation 1 `**0 8px 20px #00000059**` (`:103`) — its `10px` radius already matches |
| `current/shell.html:40` rail | `width:46px` with `padding:8px 0` and the right-only hairline, so inside the 46px border-box its 34px slots sit at **5.5…39.5** and its accent bar at **43.5…45.5** | §7.2's **46px** strip (`:285`), whose selected slot carries the accent bar **on the rail's inner edge** (`:300`) — the trailing hairline is what shifts the contents 1px left of centre |
| `current/shell.html:171-206` dock buttons | seventeen 30px glyph buttons at `7px` | §5's **Icon button** is "A 26–30px square at `--radius-md`, glyph only" (`:154`) — **6px** |
| `current/shell.html:158,161,164` view-cluster buttons | three 22px glyph buttons at `5px` | as above — **6px**; the **drawn size** is a separate divergence, below §5's floor, and it is `vg-306` rather than this step |
| `current/shell.html:336` follow-the-system track | the 26×14 switch track at `7px`, which is half its height rather than a token | §3's **full** is "Pills and toggles only" (`:94`) — **999px**, which is the shape the `7px` was imitating |

**The list above is a class, not an inventory.** The audit that added the rail row counted three off-bible declarations; a `border-radius` sweep of the file counts **twenty-one literals off §3's closed scale** — eighteen `7px` and three `5px` — because the drawing writes each surface's radius by hand and nothing compared it to the scale that binds it. Correct the *class*: after this step, no `border-radius` in `current/shell.html` is off §3's scale, and each remaining literal names an entry (`4` `--radius-sm`, `6` `--radius-md`, `8` `--radius-lg`, `10` `--radius-xl`, `999` full) or is a named degenerate mark (`2px` and `1px`, whose value is their thickness, exempt by name in Task 6's gate; `50%` on a circle, which is `full` reached the other way).

Correct those to the §3 values, naming this step and `vg-296` in the commit. **The direction matters: the drawing is corrected to the bible, never the reverse** — do not read the product's value and write it into the drawing, which is the self-licensing this plan exists to end in either direction.

The rail row is `vg-296`'s family reached from a third direction, and Task 2 found it: a right-only hairline inside a 46px box leaves a 45px content box, so 34px slots centre at 5.5…39.5 rather than at 6…40, and Task 2 restored that with `padding-left: 1px` — **the strip is the bible's 46px in both, and the drawing's own contents are the 1px that is off**, so the padding is the arithmetic consequence of §7.2 plus a one-sided hairline rather than a licence for an offset. Correcting the drawing is what keeps that comment honest, and it is why this row is here instead of in a task of its own.

**This row read 47px until Task 3 measured it (`42283107`).** The drawing carries a global `* { box-sizing: border-box }` at `:9`, so neither file has a 47px reading anywhere; the defect is the contents' placement, not the box's width. Recorded because the plan is the argument a later task reads, and a premise that survives here unrefuted gets acted on twice.

The reason this is *this* task's: a radius row that reads its expected value from a drawing which itself contradicts the closed scale would fail the product for the drawing's error, and the whole point of Task 1's instrument is that its expected values are trustworthy. `vg-296`'s fourth case, the settings tab treatment that contradicts itself, is **not** here — it is in the modal, and the next plan owns it.

- [ ] **Step 2: Decide each off-scale value against its owner, and record the decision**

Five distinct off-scale values: `1`, `2`, `5`, `7`, `12`.

**The shell's four `12px` regions go square, and that is the drawing's declaration rather than its silence.** The drawing rounds what it wants rounded and says so every time — the window and `.mockup` at `10px` (`editor-shell.html:20`, `:47`), rail slots and every card at `8px` — and declares **no** radius on the rail, either pane, the stage, the inspector, the header or the status strip. Its per-surface values are Step 1's to correct and are not repeated here, because a second copy in prose is a second copy to go stale. (`current/shell.html` draws **no layer row**, so the layer rows' `6px` below is licensed by §3's `--radius-md` for a menu row, not by a drawing literal — a claim this plan carried until Task 3's review checked it.) §7 draws the same shape: the regions abut inside one outer boundary, and an abutting region with a radius shows the ground through its corners, which is the island the drawing does not have. So `.editor-shell-rail`, `.editor-shell-panel`/`.editor-shell-inspector` and `.editor-shell-stage` **lose** the declaration rather than take a scale entry, and **Task 2's flush body is what makes that coherent** — the two steps are one change.

**The two dialogs are the exception, at `--radius-lg` (8).** They are not drawn in the shell, they float over it, and §3's table gives `8px` to panels; R6 already ruled this. The distinction the whole step turns on: a **flush region** of the shell is square, a **floating surface** over it takes its §3 entry.

The `7px` icon button is §5's `--radius-md`. The `2px` swatch is §3's `--radius-sm` for a swatch. `1px` and the dropline's `2px` are degenerate marks whose value is their thickness; the comment says so, so Task 6's gate can exempt them by name rather than by value.

- [ ] **Step 3: Apply them, and make the dialog's frame one rule for both dialogs**

The shell's regions and the two dialogs are changed together, because `.editor-shell-dialog` is one rule rendered by `shortcut-reference.tsx` and `settings.tsx` (Review Focus 5).

- [ ] **Step 4: Assert both dialogs against each other, not only against the scale**

**Both dialogs are already in Task 1's table**, each comparing `--radius-lg` against its computed frame. This step adds the thing that assertion cannot see: that the two dialogs' frames are **equal to each other**, so a change made for the settings modal and missed on the `?` sheet fails a row rather than passing quietly. Run both.

- [ ] **Step 5: Prove the assertions fail when the value is put back**

Restore one `12px`, rebuild, re-run, confirm the row fails, restore with `cp` and verify with `cmp`.

- [ ] **Step 6: Commit**

The drawing correction from Step 1 and the CSS from Steps 2–3 land together, and the body names `vg-296` and the §3 values the drawing was corrected to.

---

### Task 4: Graphite comes from the drawing, and the other five are derived from graphite

**Outcome:** Graphite's role values are the drawing's, verbatim, and the other five palettes are **derived from graphite** — each keeps its own identity hue and takes graphite's role *relationships* — so the six are one system with one source instead of six tunings.

**Owning symbols/landmarks:** `editor-shell.css` — the `[data-shell-palette="graphite"]` block and the five others (`ember`, `moss`, `plum`, `light`, `editorial`); `editor-shell.html:45-48` (the drawing's own token table) and its per-surface literals; `applyShellPalette`, `shellPalettes` (`palette.ts`) and `0035` (the resolution mechanism — **untouched**).

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/mockup-values.ts` (the drawing's shell token table is a second reader target)
- Modify: `src/web/tests/e2e/design-language.spec.ts` (the derived-palette assertions)

**Interfaces:**
- Consumes: Task 1's reader, extended to read the drawing's token table (`--bg`, `--hdr`, `--panel`, `--panel2`, `--edge`, `--edge2`, `--text`, `--muted`, `--faint`, `--accent`).
- Produces: graphite's values with the drawing as their single owner; a **derivation** the other five are computed from, stated as a rule a person can apply and a test can read, not as five sets of numbers someone chose.

- [ ] **Step 1: Write the assertion first, and watch it fail on all ten roles**

One case per role: the product's computed value for graphite equals the drawing's declared value. The drawing's table is `current/shell.html:17` and holds **eleven** tokens — the ten the Interfaces block lists **plus `--hot`**, which Task 9's current set added and the frozen original does not carry. Today exactly one passes (`--accent` `#72e0c0`); the other **ten** must fail before any value is written, and the failure list goes in the report.

- [ ] **Step 2: Take the drawing's values, role by role**

Transcribe rather than approximate, and name the drawing's line for each in the block's comment. Where the product has a role the drawing does not name, and the drawing has a value the product has no role for, say so in the report rather than inventing a mapping.

- [ ] **Step 3: State the derivation, then apply it to the other five**

**The user's ruling of 2026-10-10: "The graphite palette takes from the mockup directly. The other palettes derived from it."** So the derivation is a rule, written into the stylesheet's own comment (one paragraph, at the palette block) and asserted by a test:

- **Graphite is the source.** Its ten roles are the drawing's ten values, unmodified.
- **Every other palette keeps its own hue** for the roles that carry identity — `--accent`, and the hue tint in `--edge` — and takes from graphite the **relationships** between roles: the luminance separation of `--bg` → `--panel` → `--panel-2`, where `--text`, `--muted` and `--faint` sit on that ladder, and the edge's weight against its surface.
- **`light` does not invert, and that was measured rather than assumed.** This bullet read "it mirrors the ladder — the same number of steps, the same contrast order, inverted" until Task 4 measured the shipped palette ascending exactly as graphite does (0.6980 / 0.9251 / 0.9844 against graphite's 0.0043 / 0.0079 / 0.0113): the same **ordering**, and the polarity difference is the ground's, not the ladder's. What a light palette cannot take from a dark one is its absolute luminance, and what it does take is the relationship — three rungs in one direction, each separating. Mirroring was one reading of that and not the only one, and **no palette is asserted to invert**: a mirror imposed by hand would be exactly the tuned value this step exists to replace.
- **A derived value is computed, not picked.** Where a derivation is not expressible in CSS (`color-mix` over the source role is the preferred form; a literal is the fallback), the literal carries the derivation in its comment, so the next change to graphite has an obvious consequence for the five.

- [ ] **Step 4: Re-measure contrast under all six before believing it**

Run the existing contrast assertions (`keyboard.spec.ts` measures the modal surface under every palette; `shell-appearance.spec.ts` measures the surfaces) and record every ratio that moved, with the floor it must clear. `vg-200` and `vg-201` are already pinned failures here, and this change is not allowed to add a third silently (Review Focus 2). A derived palette that drops below a floor is a derivation bug, not a palette to hand-tune.

- [ ] **Step 5: Assert the derivation holds, not only the six outcomes**

One case that fails if a palette's ladder stops matching graphite's: for each of the five, the luminance ordering of `--bg`/`--panel`/`--panel-2` matches graphite's, **and where graphite separates two rungs the derived palette separates them too** — strict `bg < panel < panel2` for the five, with editorial's `panel == panel2` (`#fffdf7` for both) as the one named licensed exception, because its control-inside-panel separation is carried by `--vigilia-control-bg` rather than by the rung. Six transcribed value sets pass the per-role assertions and drift apart again the moment someone edits one; this is the assertion that keeps the ruling true.

**An order-only assertion is a ceiling, and `vg-308` records it.** A ladder collapsed to steps of 0.0001 keeps its order and passes, and no magnitude floor belongs here: "at least X luminance" has no rule behind it, and picking one is the move this plan has already had to undo. The separation rule above is what can be stated without inventing a number; the magnitude is `vg-308`'s to rule on.

- [ ] **Step 6: Commit**

---

### Task 5: Chrome is opaque in all six palettes

**Outcome:** A palette's chrome surfaces are **flat and unblurred** as §3's elevation row 0 and the drawing both have them, and the `backdrop-filter`/gradient treatment belongs to the floating clusters over the canvas — as an **element** boundary rather than a palette one, and in every palette rather than only the drawn one.

**`opaque` was this task's word and the boundary is not that wide.** §3's row 0 asks for a flat surface with no shadow and a 1px edge; a palette whose own `--panel` carries alpha (light, `#eff9f2bf`, compositing over the set's only gradient ground) has **no opaque derivation to read**, and inventing one would be the picked value this plan exists to replace. So the task goes as far as the derivation reaches — five of six palettes opaque, `light` exempt by name in the assertion and by row in the register (`vg-310`) — and what the step is *for*, the gradient and the blur coming off chrome, holds in all six. Task 5 also lifted **`editorial`'s two clusters**, which the palette-wide flat rule had been flattening along with its chrome; that is a behaviour change, not a byte count.

**Owning symbols/landmarks:** `editor-shell.css` — the `.editor-glass` block and its per-palette selectors, the flat override that already strips shadow and blur from rail/panes/inspector, the gradient declaration, the `@supports not (backdrop-filter)` fallback, and each palette's surface roles; `shell-appearance.spec.ts`'s "editorial is flat and the other five are glass".

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/tests/e2e/shell-appearance.spec.ts` (the pinned assertion, changed deliberately and named in the commit)
- Modify: `src/web/tests/e2e/design-language.spec.ts`

**Interfaces:**
- Consumes: Task 4's graphite values and the derivation the other five are computed from; Task 1's rows for the shell's surfaces.
- Produces: one treatment boundary — chrome flat and opaque, clusters blurred and translucent — expressed once, so an element is one or the other and the file says which.

- [ ] **Step 1: Write the assertion for both halves of the boundary**

Two cases: a chrome region's computed background has no alpha and no `backdrop-filter`, and a cluster's has both. **The boundary is per element, so the assertion reads the elements and not a sample of them** — every chrome region (the rail, both panes, the inspector, the header and the status strip) and every floating cluster (the dock, the zoom cluster and the identity chip, §7.5's three); Task 5's review found the shipped case reading four of five chrome surfaces and one of three clusters, which is how a boundary turns back into a sample.

Measure before changing: this step's premise read "the chrome half fails under five of six palettes" and the measurement was different in two places — **opacity failed under six of six** (editorial included) and **the blur under none**, because the flat override had already stripped `backdrop-filter` from the rail, both panes and the inspector. Record which palettes fail which half — opacity, gradient, blur — rather than carrying this paragraph's numbers forward.

- [ ] **Step 2: Change the treatment, and keep the one boundary**

Move the gradient and the blur to the cluster selectors only; give each palette's chrome an opaque surface value. **A palette's chrome value is Task 4's derivation, not a value chosen here** — this task moves the *treatment* (opaque, flat, hairline edges) off the glass and onto nothing, and the six opaque values come from graphite and its five derivations. If a palette's chrome has no derivation to read, that is a finding for Task 4, not a literal picked here.

- [ ] **Step 3: Measure contrast under all six, and compare against the ratios before this task**

Record each palette's ratios for text, muted text, the edge boundary and the accent, before and after, and state every one that moved and whether it is above or below any pinned floor. This is Review Focus 2's evidence and it is not dischargeable by the geometry assertions.

- [ ] **Step 4: Amend the pinned assertion deliberately and name it in the commit**

`shell-appearance.spec.ts`'s flat/glass split was three palettes' worth of behaviour expressed as one assertion; it now asserts the boundary this task defines. Say in the commit that the assertion changed and why — a test silently rewritten beside the code it guards is indistinguishable from a test deleted.

- [ ] **Step 5: Prove both halves fail when the treatment is put back**

Revert the chrome half alone, rebuild, confirm the chrome case fails and the cluster case still passes; restore with `cp`, verify with `cmp`.

- [ ] **Step 6: Commit**

Run the whole editor unit suite and record its counts in the body.

---

### Task 6: The values this plan corrected are under a gate, not an eye

**Outcome:** What this plan fixed by hand is checked rather than remembered. The drawing's own `border-radius` values are read against §3's scale, so the twenty-one off-scale literals Task 3 corrected cannot return one at a time (`vg-296`); the drawing's declared token table is read from every element that declares it rather than the single element the width selector happens to match (`vg-309`); and `editor-shell.css`'s violations of the token ratchet are **measured and narrowed** — the five that are genuine no-ops fixed, the rest left to `vg-274` with their classes named, because the file is not cleanable by substitution and the allowlist's contract forbids listing a file that is not converted. **This Outcome read "`editor-shell.css` is in the gated list" until Task 6 measured it**; Step 2 carries the measurement and the ruling that replaced it.

**Owning symbols/landmarks:** `scripts/design-tokens.gated.json`; `scripts/design-tokens.mjs`; `docs/engineering/`'s description of the ratchet; the parity reader and its row table in `tests/e2e/design-language.spec.ts`; `tests/e2e/mockup-values.ts`'s `SHELL_TOKEN_SELECTOR`, `mockupDeclared` and `mockupDeclaredProperties`; `vg-274` (the measured before-state), `vg-286` (which test files the ratchet covers), `vg-296`, `vg-308` and `vg-309`.

**Files:**
- Inspect and leave unchanged: `scripts/design-tokens.gated.json` (Step 2 says why the path comes back out)
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css` (only the violations whose fix is a verifiable no-op)
- Modify: `src/web/tests/e2e/design-language.spec.ts` (the drawing-side rows)
- Modify: `src/web/tests/e2e/mockup-values.ts` (the token table's reader)

**Interfaces:**
- Consumes: Tasks 2–5, and Task 1's parity reader and row table.
- Produces: two drawing readers under a gate, and `editor-shell.css`'s remaining ratchet violations measured and classified rather than left as a feeling. The `gated` list does **not** grow — Step 2 explains why the file cannot join it yet.

- [ ] **Step 1: Measure what the gate would find, before adding the path**

`vg-274` measured 85 hex literals across 80 of 2115 lines and 68 unchecked violations in this file. Re-measure now, after Tasks 2–5, and record the number. **Measured at Task 6: 67 before this task's edits and 61 after them** — 7 hex-literal, 30 off-scale px and 24 spacing px. The expectation this step carried ("most of the change is that many fewer") is **refuted**: this plan corrected the radii and the palette, not the spacing, and 61 of 68 is nearly all of it.

- [ ] **Step 2: Add the path, run the gate, and fix what it names**

Run: `cd src/web && npm run design:check`
Expected: it names `editor-shell.css` with a violation list. Fix every violation **as a role or a scale step**, never by widening the gate's allowlist — an exemption added to make a gate pass is the gate deleted with a comment. **The allowlist is not a precedent (R25):** `74` sits in `biblePx` because §5 rule 2 names that grid in its own right, verified against the rule rather than by the entry being there, and every other entry has a bible literal behind it (46 is §7.2's rail, 246 is §7.3's pane, 276 is §7.4's inspector). A value with no rule behind it needs the rule first — if one turns up here, that is a spec edit to open, not an entry to add. **Two values this plan expected to add cannot be added at all**: §7.1 and §7.2 print neither the header's `42px` nor the rail slot's `34px`, so neither has a bible literal and R25 refuses both. A plan that asserts a bible value the bible does not print is R25's own defect one step earlier.

**Then withdraw the path, and do not treat that as a failure of the step.** The list's contract is what makes this the right call, and both halves of it predate this plan: `design-tokens.mjs:9` defines the list as "the files listed in `design-tokens.gated.json` — the files already converted", and ADR-0040:12 gives the reason — "a whole-repo linter cannot go green on the day it is added and a gate that starts red and stays red is turned off". A file holding 61 violations is not converted, so listing it adds no coverage: it turns `design:check` red at HEAD, which is the failure mode the ADR names. Fix the violations that are genuine no-ops (**substitute only where the literal already equals the role's value, and verify the substitution against the declaration** — a fix that moves pixels is a design decision and belongs to `vg-274`'s pass, not here), leave the path out, and record the class totals on `vg-274`: 24 spacing values whose §3 substitution moves pixels, and three (`margin-right: 62px/92px/122px`, `editor-shell.css:1932/1937/1942`) that no §3 step can express at all.

- [ ] **Step 3: Prove the gate fails on a reintroduced literal**

Add one hex literal to a surface rule, run the guard, confirm it fails naming the file, line, column and rule, and remove it. **With the path withdrawn, the committed gate cannot see this file**, so the proof runs through a temporary config that names it — say so in the report rather than letting the substitution look like the real gate, and say that the committed `design:check` was still run and is still green over the 63 files it does cover.

- [ ] **Step 4: Read the drawing's radii against §3's scale (`vg-296`)**

Nothing reads them today: Task 3 corrected twenty-one off-scale `border-radius` values in `current/shell.html`, and putting one `7px` back leaves `design-language.spec.ts` green — a sweep is a measurement of a file, not a gate on it. Add the row that reads every `border-radius` the drawing **declares** and asserts each is a §3 scale step (4, 6, 8, 10, `full`) or one of the degenerate values named **in the row with a reason each**, and record that set on `vg-296` so the exemption is the register's and not a comment's. Declared rather than computed is deliberate and is a strict superset for a drawing whose radii are all inline: every computed radius comes from a declaration, so the row cannot miss an off-scale rendered radius, only over-report one. Carry a positive control — a row that read nothing would otherwise pass. Prove it red by reintroducing one `7px`, then restore with `cp` and confirm with `cmp`.

- [ ] **Step 5: Read the token table from every element that declares it (`vg-309`)**

`mockupDeclared` reads the single element `SHELL_TOKEN_SELECTOR` matches, so a token declared at `:root` or on a child is invisible to a row that claims to read the drawing's table as a set. Read the declarations from **every site that declares them** — an inline style attribute is one site, a rule block is another — rather than from the one element the selector happens to match, and assert the set as well as the count, so a token appearing at a second site cannot pass by replacing one the first site lost. **Grouping byte-identical inline attributes into one site is a documented ceiling**, not a silent one: say in the row's comment that two elements carrying identical style attributes are indistinguishable to it. Prove it red by moving one declared token off the element the selector matches, then restore with `cp` and confirm with `cmp`.

- [ ] **Step 6: Rule on `vg-308`'s magnitude, or leave it open — do not invent a threshold**

The ladder's row asserts order (`bg < panel < panel2`) and cannot see a ladder collapsed to steps of 0.0001. A magnitude floor with no rule behind it is the `biblePx` move (R25) this plan has already had to undo once. **Find the rule first:** if §3, §4 or the drawing states a minimum separation, cite it and implement against it; if none does, record the search on `vg-308` — what was read and what it does not say — leave the row open, and add no constant. **Searched at Task 6 and none exists**: §3 (`design-language.md:64-109`) states no surface separation, §4 (`:111-140`) gives the roles and no relationship between them, §5 (`:141-206`) gives contrast ratios that bind a boundary against its ground rather than the distance between two grounds, and the drawing declares three literals with no stated relationship. So the deliverable here may legitimately be a recorded search rather than code, and that is a pass, not a step someone skipped.

- [ ] **Step 7: Commit**

---

### Task 7: The parity capture, beside the drawing

**Outcome:** Built bundles, the shell captured by a registered action, the captures placed **beside** `docs/design/mockups/editor-shell.html`, and every remaining difference either fixed or backed by a quoted predating rule — with the plan closed.

**Owning symbols/landmarks:** `src/web/tests/e2e/design-language.spec.ts`; `docs/evidence/screenshots/README.md`; the registered shell actions (`shell-appearance`, `shell-palette-*`); `docs/design/mockups/editor-shell.html`.

**Files:**
- Modify: `src/web/tests/e2e/design-language.spec.ts`
- Modify: `docs/evidence/screenshots/README.md`
- Add: the produced images under `docs/evidence/screenshots/`, both palettes

**Interfaces:**
- Consumes: every earlier task; Task 1's `PARITY` table as the comparison's spine.
- Produces: the capture that is this plan's completion condition (spec §13, Acceptance).

- [ ] **Step 1: Re-capture every shell action this plan moved, in both palettes**

A capture of one palette cannot show a hard-coded hex, so `graphite` and `editorial` are both taken. Re-run with `--workers=1` against rebuilt bundles, and confirm **1 test ran** per action — a `--grep` matching nothing exits 0 with zero tests.

- [ ] **Step 2: Place the captures beside the drawing and re-run Task 1's table**

Every `fix` row should now pass. Record any that do not as an open finding with its owner — not as a deliberate difference.

- [ ] **Step 3: List every remaining difference with its citation, or state that there are none**

Under §13 as amended, a difference is kept only against a quoted predating rule. Re-read Task 1's `licensed` and `drawing-stale` rows against the shipped build: a `licensed` row whose citation is not verbatim-verifiable is reclassified `fix`, and a `drawing-stale` row must name the mockup edit that repaired it.

- [ ] **Step 4: Say which Acceptance items are met and which are not**

Name them one per line, `met` or `not met`, with evidence. The settings modal's parity is **not met** until its own plan lands; the clusters are `vg-222`'s; the phone layout is `vg-172`'s. Never announce the redesign closed while an item remains.

- [ ] **Step 5: Update `STATUS.md`, then commit and archive**

Replace "Last completed change" with 1–5 bullets, one item per line, never wrapped; run `npm run status:check` from `src/web/`. Run the whole editor unit suite and record its counts in the commit body. Tell the user the images exist before staging them, and inspect them first. Commit the capture, the registration row and the plan's changes together; then move this plan to `docs/superpowers/plans/archive/` and write the next plan (the settings modal's parity) against the same instrument.

---

### Task 8: One geometry for a field row — the control set's value cell, and the legacy rules under it

**Executes first among the tasks below Task 1** (see the execution-order note above the task list). The user reported on 2026-10-10 that "the input boxes in the inspection panel aren't even aligned"; the read-only measurement at `.superpowers/sdd/2026-10-10-shell-parity/inspector-alignment-measurement.md` found four widths in one section where the drawing declares one, in **two** owners, and found it visible in three already-committed captures.

**Outcome:** Every field row in every panel has **one** value-cell geometry — a number well, a text well, a select and a slider occupy the same track — the label sits on the row's centre rather than below it, and the product's input is boxed once rather than twice. The drawing's own row declares one width; the product ends with one.

**Owning symbols/landmarks:** `src/web/packages/editor/src/components/ui/control-well.tsx` — the row's `justify-end`, the well with no declared width, the label with no declared width; `src/web/packages/editor/src/editor-shell/editor-shell.css` — the legacy input/button box rule and the `label { display: block; margin-top: 12px }` rule, both **unlayered** and therefore beating Tailwind's utilities; `src/web/packages/editor/src/control-fixture.tsx` — the fixture that does not mount the inspector ancestor; `docs/design/mockups/current/controls.html` — the drawing's declared row (the original at `inspector-controls.html` is provenance; see the path mapping above).

**Files:**
- Modify: `src/web/packages/editor/src/components/ui/control-well.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/control-fixture.tsx`
- Modify: `src/web/tests/e2e/design-language.spec.ts` (the row-geometry assertion, on the fixture)
- Modify: `src/web/tests/e2e/mockup-values.ts` — **the drawing's row becomes a second reader target.** A `PARITY` row reading `current/controls.html`, and its counterpart reading `current/controls-light.html`, so the two control drawings are read by something rather than by nothing. Task 9's review found both are currently read by no test, and recorded the reason that matters: the same commit added a read for the settings drawing on the grounds that "a drawing that nothing reads is a drawing that rots" — a standard the two control drawings did not meet. This task owns them because it is the task that changes the geometry they declare.

**Interfaces:**
- Consumes: Task 1's `mockupDeclared`; the measurement's instance list (11 under the shared row, 4 under the legacy rules).
- Produces: the row's value cell as **one** track, declared once, which every control kind fills; and a fixture that mounts what the product mounts, so the product-only half of this defect is measurable by the gate that exists for it.

- [ ] **Step 1: Assert one geometry on the fixture, and watch it fail**

The measurement proved this is **shared**, not inspector-local: the same five different left edges appear in the parity fixture's own capture (`control-set-desktop-chromium.png` — Name, Shows, Fill, Width, Align each starting somewhere else). So the assertion belongs on the fixture: for a row holding a number, a text, a select and a slider, each value cell's left edge and right edge are equal, and equal across rows. Run it on today's build and record the distinct edges it measures — **a run that finds one edge means the assertion is not reading the cells**.

**The expected edges come from the drawing, read by the reader, not restated in the assertion.** Add the two `controls`-drawing rows to `PARITY` in this step, so the numbers this task is judged against are the drawing's own declarations rather than a copy taken once and never re-read. A row that resolves to nothing must throw, which is the reader's behaviour and not a reason to drop the row.

- [ ] **Step 2: Declare the value cell once, in the row**

One track for the value cell, sized by the row and not by its content, so a content-sized `<input>` and a filling `select` land on the same box. `justify-end` on a flexible slot is what makes each kind find its own width; the fix is the slot's geometry, not four per-kind widths. Where a control genuinely needs a different width (none of the four does, per the drawing), that is a finding for the report, not a fifth declaration.

- [ ] **Step 3: Take the legacy rules off the product's inputs**

`editor-shell.css`'s input/button box rule and its `label` rule are **unlayered**, so they beat Tailwind's utilities and re-box and re-pad an input inside a well that already draws one — which is why the product shows two border pairs (86/263, 93/252) where the fixture shows one (117/276). Delete them where the control set now owns the treatment; where one is still needed, scope it to the surface that needs it and say in the comment which. The `label` rule's `margin-top: 12px` is what pushes every label ~6px below its control against the row's `items-center` — that is the misalignment the user is most likely looking at, and it is one declaration.

- [ ] **Step 4: Make the fixture mount what the product mounts**

`control-fixture.tsx` does not mount `.editor-shell-inspector`, so the legacy rules do not reach it and the product-only half of this defect is invisible to the gate built for the control set. Mount the same ancestor the product does, then **revert the step and confirm the assertion goes green** — a gate that cannot see the product's own ancestor is the instrument claiming more than it measures (`vg-292`'s family), and this step is where that is proven rather than assumed.

- [ ] **Step 5: Re-capture the inspector and read the image**

Three committed captures already show this defect — `editor-inspector-shape-desktop-chromium.png`, `editor-inspector-card-desktop-chromium.png` and `control-set-desktop-chromium.png` — which is a finding in its own right: they were taken and not read. Re-capture under a rebuilt bundle, in **graphite** as well as light (the two inspector captures are light-palette only, while the drawing is graphite), and inspect the images before staging them. Report what the captures show now that the assertion passes.

- [ ] **Step 6: Commit**

Name in the body that this answers the user's report, which of the three measured defects it fixed, and that `vg-098`/`vg-108` are a different concept (text alignment, already verified). Run the whole editor unit suite and record its counts.

---

### Task 9: New drawings show the editor as it is, and the originals are kept and labelled

**Executes first — before Task 8 and before Task 2.** The user asked for it on 2026-10-10: *"Update the mockup with the product surfaces we have today, keeping it original style. Each mockup html shows exactly the editor as it would look in real life, no explanation texts, callouts, etc."*; asked what wins where the product and the drawing differ in arrangement, ruled **the original drawing**; and, told that a refresh would overdraw the existing files, ruled *"Keep the original mockup html files and label them as such. Build new html."* — so the old drawings are **kept as the record** and the refreshed ones are **new files**. Everything else in this plan reads the drawings, so the new ones exist before the instrument is re-pointed at them.

**Outcome:** **New** files under `docs/design/mockups/current/` that show the editor exactly as it renders today — the real surfaces, real names, real copy — drawn in the original mockups' style and carrying **nothing addressed to the reader**: no page headings, explanatory paragraphs, specimen captions, callouts, disclaimers or illustrative-placeholder notes. The three original files are **kept**, byte-identical except for one label each saying what they are.

**What "kept and labelled" means.** The user's instruction of 2026-10-10: *"Keep the original mockup html files and label them as such. Build new html."* So `editor-shell.html`, `inspector-controls.html` and `inspector-language.html` keep their names and their content; the **only** edit to each is `one` line at the top saying it is the **original visual direction**, kept for provenance, and not the current target. Nothing else in those files changes — no prose edited, no specimen deleted, no value touched. They are the record of what was designed first, and this task does not tidy them.

**The new set** — one file per view, so that no file needs a specimen or a caption to hold two:

| File | Shows |
|---|---|
| `current/shell.html` | The whole shell as it renders today: header and menubar, the four-slot rail with the gear at its foot, a pane open beside it, the stage and its three corners, the inspector with a selection, the status strip |
| `current/settings.html` | The settings surface on its own — a modal cannot share a file with the shell without becoming a specimen — with its three tabs |
| `current/controls.html` | The inspector column **as the product renders it**, at a size where its field rows are readable — the real sections, the real rows, the real wells and sliders — not a catalogue of every control the design language permits |
| `current/controls-light.html` | The same surface in the light palette, so a hard-coded colour cannot hide in it |

**The style is gold and the content is corrected — in that order, and they are different properties.** The user's clarification of 2026-10-10: *"the original mockup style is still the gold target. But the actual content might not accurately reflect the product capabilities we've built. This mockup update pass is to address that. So we can write an accurate gate check against it."* So:

- **Treatment is measured against the original and never re-derived** (Step 4). A new file that looks different from the original in colour, spacing, radius, type or elevation has failed this task, whatever it renders.
- **Content is measured against the product and is what this task repairs.** *Which* surfaces, panes, sections, rows, controls and readouts exist, and what they are called, comes from the code — including surfaces the original never drew, which are **added in the original's treatment** rather than left out. A capability the product has and the drawing omits is a hole in the gate, which is the whole reason for this pass.
- **Therefore each new file renders a surface the product actually renders**, as the product renders it. Neither the vocabulary sheet's catalogue arrangement nor any specimen grouping survives: a drawing that arranges controls to be inspected is a drawing no gate can read a surface from.
- **The gate this makes possible:** the drawing then states the treatment, and the product must meet it. Content accuracy is what stops that assertion from being *"the product matches a drawing of something else"*.

Both palettes are drawn for the surfaces that had a palette pair before, because one palette cannot show a hard-coded value — the same reason the captures take two. A further view (a pane alone, the stage alone) is a ruling to make later, not a default here.

**Owning symbols/landmarks:** `docs/design/mockups/current/*` (new); the three originals plus `docs/design/mockups/README.md` (its "Shows" column and its **Reviewed reference contract** section describe specimens that are about to sit beside a second, annotation-free set); and, as the sources of what today's surfaces *are*, `packages/editor/src/editor-shell/rail.tsx` + `uiCopy.rail`, the menubar's groups and the publish control, `packages/editor/src/selection-inspector/` (the five sections), the status strip's readouts in `shell-layout.tsx`, `settings.tsx` / `settings-keyboard.tsx`, and `ui-copy.ts` for every string.

**Files:**
- Add: `docs/design/mockups/current/shell.html`, `current/settings.html`, `current/controls.html`, `current/controls-light.html`
- Modify: the three originals — **one label line each, nothing else**
- Modify: `docs/design/mockups/README.md`
- Modify: `src/web/tests/e2e/mockup-values.ts` — `MOCKUP_PATH` points at `current/shell.html`, and the reader must be able to take a path rather than closing over one constant — and `src/web/tests/e2e/design-language.spec.ts`, so **`PARITY` is re-pointed at the new files**. A row whose selector no longer exists is a reader that stopped reading, and the spec must fail rather than pass vacuously.

**Interfaces:**
- Consumes: the built product and its own copy as the source of content; the original drawings as the source of style.
- Produces: four files a person opens in a browser to see the target, and a `PARITY` table whose rows all resolve against them.

- [ ] **Step 1: Enumerate today's surfaces from the code, not from the original drawing**

Write the list into the report: every surface the editor renders, each with the symbol it comes from. The original drawing is not the source — it predates plans 3–5 and draws at least one surface that no longer exists. Where the drawing and the product disagree about **which** surface exists — a pane, a tab, a rail slot, a menubar group, an inspector section, a readout, a control — **the product is right, and this includes what the drawing omits**: a capability the product has and the drawing does not is drawn into the new file, in the original's treatment, because the gate cannot check a surface the drawing never shows. Where they disagree about how a surface is *arranged or styled*, **the drawing is right** (the user's ruling of 2026-10-10), and the product's version is this plan's defect to fix — so the new files draw the drawing's arrangement, not the product's.

- [ ] **Step 2: Take the real copy, string by string**

Every label, placeholder, section name, readout and chord comes from `ui-copy.ts` or the owning component. No `System dashboard`, no `CPU card`, no invented counts. Where a value must be shown and the product has none (a telemetry reading with no host), the drawing shows the state the product actually renders — a gap or an em dash, as `publish-control.tsx` does for an unknown host — rather than a plausible number.

- [ ] **Step 3: Write the new files with nothing in them that explains them**

Delete the page title, the subtitle paragraph, the section headings, the `label` eyebrows that caption a specimen, the "specimens stay below the shell for comparison" note, and every parenthetical about what is illustrative. Each new file is one editor view and nothing else: no page padding, no page background, no card around the app, no second view below it. **The test is whether any text in the file would be absent from a screenshot of the running editor.** Chord marks, a tooltip's own words and a pane's own labels stay; anything addressed to the reader goes.

- [ ] **Step 4: Keep the style exactly, and say in the report what you did not change**

The original token table, the flat opaque values, the flush regions and their 1px hairlines, the radii, the type scale, the palette card grid, the settings navigation's axis and the dock's treatment are the target and are **copied, not re-derived**. This task changes what is drawn, never how. If a surface cannot be drawn in that style without changing the style, that is a finding for the report, not a change to make.

- [ ] **Step 5: Label the originals, and change nothing else in them**

One line at the top of each: it is the original visual direction, kept for provenance, not the current target. Then prove the claim — `git diff` for those three files must show **that one line and no other change**, and the report states it as a measured fact rather than an intention.

- [ ] **Step 6: Render all four new files and read them**

Serve nothing and build nothing: open each with Playwright at a fixed viewport, screenshot it to a path **outside the repo**, and read the image. Confirm each shows one editor view, that no explanation is visible, and that nothing has been clipped, overlapped or left at a stray offset by removing the page frame. **Reading the source is not this step** — the drawings were already wrong once while reading correctly.

- [ ] **Step 7: Re-point the instrument, and prove it still fails**

Point `MOCKUP_PATH` and every `PARITY` selector at the new files, run the parity spec, and confirm it **still reports failures** on the shell as shipped today. A `mockupDeclared` throw on a selector that does not resolve is a failure to fix, not a row to delete: the invariant is that every row resolves *and* the product still disagrees where this plan has not yet fixed it.

- [ ] **Step 8: Update the README to hold two sets, and narrow the clause that caused this**

Its table gains the new files and the originals' row says what they now are. Then narrow **"Keeping them current"** — its current clause ("if a surface is rebuilt differently on purpose, capture the new state and replace the mockup file") is the escape hatch that let two plans record divergences and leave the drawing standing, and it now reads: **the current files are refreshed when the set of surfaces changes; the treatment is the target and is never redrawn from the product; the originals are never edited again.**

- [ ] **Step 9: Commit**

The four new files, the three one-line labels, the README, the re-pointed instrument and their tests together. Tell the user the files changed and that they should open them. Run the whole editor unit suite and record its counts.

---

## Out of scope

- **The settings modal's own regions.** Thirteen of its nineteen measured regions drift; that is the next plan, and it consumes this one's reader, its radius decisions and its chrome treatment. This plan touches the modal only where they share a rule (`.editor-shell-dialog`, `.editor-shell-dialog-lead`, `.editor-shell-dialog kbd`).
- **The floating clusters' treatment** (`vg-222`, glass off the elevation ladder), the **status strip's tone** (`vg-217`), the **missing status counts** (`vg-230`) and the **rail's 34px slot** (`vg-227`) are existing rows with their own owners. This plan changes the clusters only where the chrome's treatment moves off them.
- **The palette mechanism** — the six palettes, per-element resolution, the OS fallback and the attribute — is `0035`'s and is untouched. What changes is values and treatment, not resolution.
- **The artboard, the canvas, the player, `renderer-core`, the host and the theme format.** No scene change; no second persistence mechanism.
- **The bible itself.** This plan cites §3, §4 and §7 and amends none of them. If a task finds it must amend one, that is a ruling recorded in the ledger and the amendment is named in the commit — never a licence for the task's own divergence (spec §13).
- **`vg-172` (phone layout), `vg-185`, `vg-187`, `vg-192`** stay open.
- **Auto-parsing the drawing for every property.** Task 1's reader covers the properties the parity table names; a general mockup parser is not this plan.

## Self-review

- **Spec coverage.** §13 as amended 2026-10-10 is Task 1's whole point and Task 7's gate; §3's radius scale is Task 3 and its elevation rows are Tasks 2 and 5; §4's roles are Tasks 4 and 5; §7's layout diagram is Task 2; §10's no-hex rule is Task 6; §12 gains this plan's row; the Acceptance item on parity is read in Task 7 Step 4.
- **Step scan.** Every step names a file, a symbol, a command or an expected output. No step asks for more than one thing to be written. No "handle edge cases", no "similar to Task N".
- **Type consistency.** `mockupDeclared` and `ParityRegion` are defined once in Task 1 and used by Tasks 2–5 and 7 under those names; `licensed` is the field every later task reads.
- **Review Focus.** Five, pinned: 1 and 4 to Task 2, 2 to Task 5, 3 to Task 2, 5 to Tasks 3 and 6.
- **Red proofs.** Task 1 fails on today's build by construction; Tasks 2, 3 and 5 each revert their own change and confirm the row goes red; Task 6 reintroduces a hex literal. Every restore is `cp` + `cmp`, because `git checkout` normalises line endings on this box.
- **The register.** `vg-231` is this plan's spine and is amended when it lands; `vg-274` is answered by Task 6; `vg-292` by Task 1's instrument; `vg-217`, `vg-222`, `vg-227`, `vg-230`, `vg-285`, `vg-286` stay open. Task 1 files whatever the census finds that this plan does not fix.
