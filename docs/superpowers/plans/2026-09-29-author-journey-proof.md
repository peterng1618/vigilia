# Author Journey Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a blank theme something an author can actually start from, then rebuild the whole reference composition from that blank state by hand, through the UI alone, and record every gap, friction point and visual-quality problem the rebuild exposes.

**Architecture:** One small product change first — `New` means a blank theme, and the starter dashboard becomes an explicit template action — because without it the proof has to begin with a workaround, and a proof that starts with a workaround measures the workaround. After that, no new code path is built: the work is a Playwright driver that exercises the real editor's real controls, and a Findings table that is the durable record of what the surface could not do.

**Tech Stack:** TypeScript, React 19 shell, Fabric 7.4.0, Playwright, Vitest, Biome. No new dependency.

**Spec:** [Author journey proof](../specs/2026-09-27-author-journey-proof-design.md) — the plan argues from the spec, so the spec travels with it; executors read both.

## Global Constraints

- **No generator, starter file, fixture, hand-edited JSON or developer intervention at any point** in Phase 2. Opening the starter and editing it is not the rebuild. The only legal moves are the controls in the delivered surface and the ones this plan names.
- **A control that does not exist is the finding.** Do not work around it with the canvas dock, a marquee, a drag, or code. A workaround is a defect in the surface, not a technique.
- **Gaps, friction and visual quality are findings in their own right.** A journey that completes but is unpleasant has still failed.
- Paint resolves through palette tokens (§73) and type through named type presets (§75). A per-object colour that bypasses a token is a defect, not a shortcut — the rebuild varies the frosted tint by editing a token.
- Missing or non-`ok` telemetry is never fabricated as zero/default data (§97). A gap in the display is a correct result.
- One history entry per committed edit (§67). No runtime or derived state in persisted data.
- UI copy belongs in `editor/src/ui-copy.ts` (§35); every control keeps its accessible name and keyboard access.
- Report what was not verified. A partially completed pass is reported as partial, not rounded up.
- Supported Node: 22.12+, 24, or 26+. Workspace scripts run from `src/web/`. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` remain enabled.
- Stage explicit paths. Pushing and opening a PR are separate actions.
- File an issue with `gh issue create --body-file .github/bug-report-template.md`; a finding whose cause is not established is written as "cause not established", not guessed.

## Review Focus

The five failure modes this pass implies that no single task's tests exercise:

1. **A rebuild step that silently uses a different control than an author would.** The driver and the product share no code, but if the driver reaches into `window.vigilia` to set a value a click would set, the proof is void. **Any `page.evaluate` that writes scene state is a defect in the driver.**
2. **A round trip that passes on the DOM and fails in the envelope.** Reading the live DOM proves the control repainted; only reading the persisted package proves save. Every round-trip task must assert on the reloaded envelope.
3. **A finding recorded but not classified.** The Findings table is not a log; an unclassified row means the pass cannot be judged complete. Blocking/deferred is required at observation time.
4. **A blocking finding "fixed" by a second control that describes the same thing.** A fix that adds a second owner is a new defect; the fix must sit inside the one owner named in `docs/architecture/ownership.md`.
5. **Save that loses authored work on the way.** The proof touches every authored surface in one document. A fix that makes a control work by dropping or coercing what the author wrote is worse than the gap.

---

## The delivered surface, as found

Written 2026-09-29 against the tree, not inherited. Every key below was read from source; the rebuild drives **these** and nothing else.

| Control | Selector | Owner |
|---|---|---|
| Geometry X/Y/W/H/rotation | `[data-vigilia-geometry]` | `selection-inspector/index.ts` |
| Opacity 0–100 | `[data-vigilia-opacity]` | `selection-inspector/appearance.ts` |
| Panel fill / stroke | `[data-vigilia-panel-fill]`, `[data-vigilia-panel-stroke]` | `selection-inspector/panel.ts` |
| Border width / radius / shadow | `[data-vigilia-panel-border]`, `-radius`, `-shadow` | `selection-inspector/panel.ts` |
| Glass on/off | `[data-vigilia-glass-enabled]` | `selection-inspector/glass.ts` |
| Glass blur 0–48 | `[data-vigilia-glass-blur]` | `selection-inspector/glass.ts` |
| Resolved reference line | `[data-vigilia-resolution]` | `selection-inspector/appearance.ts` |
| Run list | `[data-vigilia-runs]`, rows `[data-vigilia-run="N"]` | `selection-inspector/runs.ts` |
| Run preset / colour | `[data-vigilia-run-preset="N"]`, `[data-vigilia-run-colour="N"]` | `selection-inspector/runs.ts` |
| Text align / wrap / overflow | `[data-vigilia-text-align]`, `-wrap`, `-overflow` | `selection-inspector/runs.ts` |
| Run source / format / zone | `[data-vigilia-run-source="N"]`, `-format`, `-zone` | `selection-inspector/runs.ts` |
| Style tab | `[data-vigilia-panel="style"]` | `selection-inspector/style.ts` |
| Globals (no selection) | `[data-vigilia-globals]` | `selection-inspector/style.ts` |
| Palette token / kind / colour | `[data-vigilia-palette-token]`, `-kind`, `-color` | `palette-manager/panel.ts` |
| Palette reassign / delete | `[data-vigilia-palette-replacement]`, `-delete` | `palette-manager/panel.ts` |
| Delete selection | canvas toolbar trash → `session.deleteActive()` | `editor-shell/bridge.ts` |

**Two facts that shape the pass:**

- **There is no blank theme today.** `New` calls `createNewFabricTheme()` (`editor-main.ts:148`), which emits the entire finished composition. The only route to a blank scene is selecting everything and deleting it — a workaround no author is expected to understand, and exactly the thing this pass exists to catch. **Task 1 makes the blank state real; the rebuild starts from it.**
- **Alignment, wrap and overflow are run-level, not object-level.** The 2026-09-24 author-journey plan says otherwise and is wrong; see its Task 2. The rebuild drives the run editor.

---

## Phase 0 — The blank state

Nothing in Phase 1 or 2 can be trusted until this lands.

### Task 1: `New` means a blank theme, and the starter becomes a template

**Files:**
- Modify: `src/web/packages/editor/src/new-fabric-theme.ts` — add `createBlankFabricTheme()`
- Modify: `src/web/packages/editor/src/editor-main.ts:147-155` — `onNew` takes the blank path; add `onNewFromStarter` holding today's behaviour
- Modify: `src/web/packages/editor/src/editor-session.ts:389,589` — `actionFacade` gains `newFromStarter`; `#new` gains a sibling that goes through the same dirty-replacement confirmation
- Modify: `src/web/packages/editor/src/editor-shell/session-facade.ts:8` — add `newFromStarter(): Promise<void>`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx:217` — add the item beside `New`
- Modify: `src/web/packages/editor/src/ui-copy.ts:99` — `newDocument: "New theme"`, add `newFromStarter: "New from starter"`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.dom.test.ts:22`, `canvas-context-menu.dom.test.tsx:41`, `shell-layout.dom.test.tsx:11` — the three session doubles gain the method
- Test: `src/web/packages/editor/src/new-fabric-theme.test.ts`

**Interfaces:**
- Consumes: `starterPalette` and `starterTypePresets` from `new-fabric-theme-globals.ts`; `createNewFabricTheme()` unchanged.
- Produces: `createBlankFabricTheme(): FabricThemeEnvelope` — artboard at the reference size, the starter palette and type presets, `scene.objects` empty, `assets` empty. Later tasks rebuild onto exactly this.

- [ ] **Step 1: Write the failing unit test**

In `new-fabric-theme.test.ts`, assert that `createBlankFabricTheme()` validates — `validateFabricThemeEnvelope(theme).ok` is `true` — that `theme.scene.objects` is `[]`, that `theme.assets` is empty, and that the palette and type presets resolve so a Fill control is not "not set" on a fresh document.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/editor/src/new-fabric-theme.test.ts`
Expected: FAIL — `createBlankFabricTheme` is not exported.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function createBlankFabricTheme(): FabricThemeEnvelope {
  return {
    ...createNewFabricTheme(),
    scene: { ...createNewFabricTheme().scene, objects: [] },
    assets: [],
  };
}
```

Build the object once into a local, not twice as above, and keep the artboard, `starterPalette` and `starterTypePresets` from the starter. The blank theme is the starter's scaffolding with its objects removed — not a second hand-built envelope, which would be a second place the artboard size and the palette are decided.

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run packages/editor/src/new-fabric-theme.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the two actions**

`onNew` in `editor-main.ts` mounts `createBlankFabricTheme()` with **no** `starterAssets()` call — a blank theme has no assets and must not fetch the starter's. `onNewFromStarter` keeps the current body verbatim. Both go through `#confirmReplacement`, so a dirty document still prompts before either.

- [ ] **Step 6: Add the menu item and its copy**

`file.newDocument` reads "New theme"; `file.newFromStarter` reads "New from starter". Both items are reachable by keyboard through the existing `MenuGroup`; neither is a dock button.

- [ ] **Step 7: Update the three session doubles**

Each of `bridge.dom.test.ts`, `canvas-context-menu.dom.test.tsx` and `shell-layout.dom.test.tsx` adds `newFromStarter: vi.fn(async () => undefined)`. A missing method here is a typecheck error, which is the intended way this surfaces.

- [ ] **Step 8: Run the broad static gates**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test`
Expected: all exit 0.

- [ ] **Step 9: Prove the regression test can go red**

Comment out the `objects: []` override in `createBlankFabricTheme`, run the unit test, and confirm the `scene.objects` assertion fails. Restore it and confirm green. A test that cannot go red is not evidence.

- [ ] **Step 10: Add the browser proof and commit**

Add to `tests/e2e/editor.spec.ts`: `New` opens a document with no objects, and `New from starter` opens one with the reference composition. The dirty-replacement test at `editor.spec.ts:2835` must still pass against both.

```
git add src/web/packages/editor/src/new-fabric-theme.ts \
        src/web/packages/editor/src/new-fabric-theme.test.ts \
        src/web/packages/editor/src/editor-main.ts \
        src/web/packages/editor/src/editor-session.ts \
        src/web/packages/editor/src/ui-copy.ts \
        src/web/packages/editor/src/editor-shell/ \
        src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): New is a blank theme, and the starter is a template"
```

---

## Phase 1 — The three round trips STATUS.md still lists as unverified

These are independent of the rebuild and each is separately rejectable. Each proves the **persisted envelope**, not the DOM.

### Task 2: Text layout round-trips through save/reopen

**Files:**
- Create: `src/web/tests/e2e/author-journey.spec.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `reloadEnvelope(page)` and `openBlank(page)` helpers, reused by Task 3 and every Phase 2 rebuild task. `openBlank` drives the real `New` menu item from Task 1.

- [ ] **Step 1: Write the failing round-trip test**

Open a blank document from Task 1, add a text object, set align/wrap/overflow through `[data-vigilia-text-align]`, `[data-vigilia-text-wrap]`, `[data-vigilia-text-overflow]`, save, reopen, and assert the **reloaded envelope's** `vigiliaText.layout` carries all three. Asserting the DOM instead is a defect, not a shortcut.

- [ ] **Step 2: Run it and read the failure**

Run: `npx playwright test tests/e2e/author-journey.spec.ts --project=desktop-chromium --workers=1 --reporter=line`
Expected: the test runs. **Record what actually happens** — a pass is as informative as a fail here, and either way the result goes in the Findings table.

- [ ] **Step 3: Fix a blocking failure inside its owner**

If the round trip breaks, the fix belongs to the persistence owner that loses it — not the test, and not a new field. A finding whose cause is not established is recorded as such and filed as an issue the same day.

- [ ] **Step 4: Prove the fix fails without it**

Disable the fix, rebuild the affected bundle, and confirm the test goes red at the assertion that now fails. Restore, rebuild, confirm green.

- [ ] **Step 5: Commit**

```
git commit -m "test(author): text layout round-trips through the envelope"
```

### Task 3: In-place editing commits, undoes, and survives save

**Files:**
- Modify: `src/web/tests/e2e/author-journey.spec.ts`

**Interfaces:**
- Consumes: `openBlank(page)` and `reloadEnvelope(page)` from Task 2.

- [ ] **Step 1: Write the test**

Double-click a text object, type, commit with Escape, and assert exactly **one** history entry. Undo and assert the previous text returns. Save, reopen, assert the committed text is in the reloaded envelope. A second history entry on one edit is a §67 failure and a finding.

- [ ] **Step 2: Run, record the result, classify, fix or file**

Run: `npx playwright test tests/e2e/author-journey.spec.ts --project=desktop-chromium --workers=1 --reporter=line`

- [ ] **Step 3: Commit**

```
git commit -m "test(author): in-place edit commits once, undoes, and survives save"
```

### Task 4: A run's preset and style override round-trip

**Files:**
- Modify: `src/web/tests/e2e/author-journey.spec.ts`

**Interfaces:**
- Consumes: `openBlank(page)` and `reloadEnvelope(page)` from Task 2.
- Produces: the Findings table path (Task 5).

- [ ] **Step 1: Write the test**

Select a bound text object, change one run's preset through `[data-vigilia-run-preset="0"]` and override its colour through `[data-vigilia-run-colour="0"]`, save, reopen, assert both are in the reloaded envelope's `vigiliaText.runs[0]`, then clear the override and assert the run returns to its preset rather than keeping the override.

- [ ] **Step 2: Run, record, classify, fix or file**

- [ ] **Step 3: Commit**

```
git commit -m "test(author): a run's preset and override round-trip through save"
```

---

## Phase 2 — The rebuild, from a real blank theme

### Task 5: Open a blank theme and open the Findings table

**Files:**
- Create: `src/web/tests/e2e/author-journey-rebuild.spec.ts`
- Modify: `docs/superpowers/specs/2026-09-27-author-journey-proof-design.md` (Findings table)

**Interfaces:**
- Consumes: the surface table above and `openBlank(page)` from Task 2.
- Produces: `insertPanel`, `setToken`, `addText`, `setRun` helpers for every rebuild task.

- [ ] **Step 1: Write the blank-start test**

Open the editor, drive the real `New` menu item, and assert the canvas holds no objects and the Style tab's globals are populated. **Every step is a pointer or keyboard gesture against a real control** — no `page.evaluate` writes scene state anywhere in this file, and a driver step that needs one is a finding in its own right.

- [ ] **Step 2: Run it, and note how it feels**

Run: `npx playwright test tests/e2e/author-journey-rebuild.spec.ts --project=desktop-chromium --workers=1 --reporter=line`

Note whether an author landing on a blank theme can tell what to do next, or whether they face an empty stage. That is a finding, and it is a visual-quality one, which the spec counts.

- [ ] **Step 3: Open the Findings table in the spec**

Add the table with its first rows, each classified **blocking** or **deferred** at observation time, with the surface, what happened, and whether it stops the journey.

- [ ] **Step 4: Commit**

```
git commit -m "test(author): the rebuild starts from a real blank theme"
```

### Task 6: The wordmark and the clock card

**Files:**
- Modify: `src/web/tests/e2e/author-journey-rebuild.spec.ts`

**Interfaces:**
- Consumes: the helpers from Task 5.

- [ ] **Step 1: Build the region through the UI only**

Insert a panel through the Add panel action. Set fill and stroke through `[data-vigilia-panel-fill]` / `-stroke`, border width and radius through `-border` / `-radius`. Add the two text objects, set each run's preset through `[data-vigilia-run-preset]`, and set the tracked wordmark's spacing through its type preset in the globals.

- [ ] **Step 2: Compare against the target by eye**

`docs/superpowers/specs/2026-09-26-reference-theme-target.png`. Friction and visual-quality problems are findings even when every control exists — that is the spec's rule, not a nicety.

- [ ] **Step 3: Record findings, commit**

```
git commit -m "test(author): the wordmark and clock card, built from blank by hand"
```

### Task 7: The four device cards

**Files:**
- Modify: `src/web/tests/e2e/author-journey-rebuild.spec.ts`

**Interfaces:**
- Consumes: the helpers from Task 5 and Task 6.

- [ ] **Step 1: Build the CPU card**

Panel, then the frosted material: enable `[data-vigilia-glass-enabled]` and set `[data-vigilia-glass-blur]` to 40. The tint is **not** a panel control — it is the `palette.frost` token, edited in the palette panel through `[data-vigilia-palette-color]`. If the rebuild needs a tint control and cannot find one, that is a finding, **not** a workaround.

- [ ] **Step 2: Add the reading and the caption**

Two runs on one text object: a value run bound to a semantic key, and a literal unit run. If a binding cannot be authored from the UI, that is a blocking finding.

- [ ] **Step 3: Add the sparkline**

Insert a chart, choose the `line` family, set its paint through the family's paint fields, and bind it to the same key as the reading. The card must not be able to show a percentage and a waveform for two different moments.

- [ ] **Step 4: Repeat for GPU, RAM and VRAM**

RAM is a partial gauge and VRAM a full ring; the gauge family and its settings fields are the surface under test here.

- [ ] **Step 5: Compare by eye, record findings, commit**

```
git commit -m "test(author): the four device cards, built from blank by hand"
```

### Task 8: The trends panel, the storage bar and the network panel

**Files:**
- Modify: `src/web/tests/e2e/author-journey-rebuild.spec.ts`

**Interfaces:**
- Consumes: the helpers from Task 5, Task 6 and Task 7.

- [ ] **Step 1: Build the trends panel**

A line chart with three series, each with its own palette token, on a frosted panel.

- [ ] **Step 2: Build the storage bar**

A bar chart with a value and a track paint, plus its caption.

- [ ] **Step 3: Build the network panel**

Two readings and their labels, on the last frosted panel.

- [ ] **Step 4: Compare by eye, record findings, commit**

```
git commit -m "test(author): trends, storage and network, built from blank by hand"
```

### Task 9: Save the rebuilt theme, run it, and compare the output

**Files:**
- Modify: `src/web/tests/e2e/author-journey-rebuild.spec.ts`

**Interfaces:**
- Consumes: everything from Phases 0, 1 and 2.

- [ ] **Step 1: Save, package and run the rebuilt theme on the real host**

Build the host, then start it with `node packages/host/bin/vigilia.js --no-browser`. Open the saved theme on a real display and compare the rendered result to the target. A dashboard that renders differently on the player than in the editor is a finding even when both look plausible alone.

- [ ] **Step 2: Assert the persisted envelope, not the live DOM**

The composition must survive the round trip with its bindings, captions, glass treatments and palette references intact.

- [ ] **Step 3: Record findings, commit**

```
git commit -m "test(author): the rebuilt theme saves, runs, and matches the target"
```

---

## Phase 3 — Close out

### Task 10: Phone-width surfaces, inspected by eye

**Files:**
- Modify: `src/web/tests/e2e/author-journey.spec.ts`
- Evidence: captures registered in `docs/evidence/screenshots/README.md`

**Interfaces:**
- Consumes: the rebuilt document from Task 9.

- [ ] **Step 1: Register the captures, then drive the phone project**

Add the rows to `docs/evidence/screenshots/README.md` **before** running, then:
`VIGILIA_CAPTURE=1 npx playwright test tests/e2e/author-journey.spec.ts --project=phone-chromium --workers=1 --reporter=line`

The suite already exercises phone width; the obligation is that a person looked at the generated images.

- [ ] **Step 2: Record findings, commit**

### Task 11: Close the six status debts and archive their plans

**Files:**
- Modify: the six specs — `2026-09-24-authoring-and-consumer-polish.md`, `2026-09-24-author-journey.md`, `2026-09-24-authoring-time-run-placeholders.md`, `2026-09-24-consumer-journey.md`, `2026-09-24-theme-thumbnails.md`, `2026-09-24-settings-scope.md`
- Move: the plans those six name, where they are not already archived

**Interfaces:**
- Consumes: the observed evidence from Phases 1 and 2.

- [ ] **Step 1: Flip each spec to `implemented` with what was observed**

Each spec's Acceptance section records what this pass actually saw, as `specs/README.md` requires. "Shipped, unverified" is the weaker reading and Phases 1 and 2 are what discharge it. A spec whose feature this pass did not exercise is **not** flipped — it is recorded as still unverified, and saying otherwise would be the exact misstatement this pass exists to catch.

- [ ] **Step 2: Archive the plans**

Tick the boxes, move the plan to `docs/superpowers/plans/archive/`, and record in its State line what the pass observed about it.

- [ ] **Step 3: Commit**

```
git commit -m "docs(specs): the authoring specs read implemented on observed evidence"
```

### Task 12: Broad gate and the full local browser run

**Files:**
- Modify: `STATUS.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run the broad gate from `src/web`**

`npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run size`

**Read the exit code directly. Do not pipe it into `tail` or `head`** — a pipeline reports the last command's status, which is how a red run gets reported as green.

- [ ] **Step 2: Run the full local browser suite**

`npx playwright test --workers=1 --reporter=line`, and record the actual pass/skip/fail counts.

- [ ] **Step 3: Replace STATUS.md's latest-change summary and report what was not verified**

A partially completed pass is reported as partial. Do not round it up.

- [ ] **Step 4: Commit**

```
git commit -m "chore(gate): the author journey pass at the broad gate"
```

---

## Self-Review

**1. Spec coverage.** DoD 1 (rebuild from blank, compared to target) → Task 1 makes blank real, Tasks 5–9 rebuild from it. DoD 2 and Acceptance 2 (every finding in the table) → Task 5 onward, each task carrying a "record findings" step. DoD 3 (blocking findings fixed or deferred with a reason) → the classification step in Tasks 2–4 and every rebuild task. DoD 4 (three round trips driven in a browser, phone widths by eye) → Tasks 2–4 and Task 10. DoD 5 (six status debts closed, plans archived) → Task 11. Verification ("claimed surface claims proven with the broad gate and the full local browser run at the pass boundary") → Task 12.

**2. Placeholder scan.** No `TBD`, no "write tests for the above" without the assertion named, no "similar to Task N". Every command is given verbatim. The one thing deliberately *not* pre-baked is the region geometry: writing invented coordinates into this plan would be exactly the inherited-draft failure the spec forbids, and the target image is the reference.

**3. Type consistency.** `createBlankFabricTheme`, `openBlank`, `reloadEnvelope`, `insertPanel`, `setToken`, `addText`, `setRun` are produced once and consumed by name in later tasks; no task calls a helper a later task renames. Selector keys were read from source on 2026-09-29 and appear in exactly one table.

**4. Review Focus.** Each of the five lines is discharged: (1) by the Task 5 rule that any state-writing `page.evaluate` is a defect; (2) by the persisted-envelope assertion in Tasks 2, 4 and 9; (3) by classification at observation time; (4) by the "fix inside its owner" rule in Task 2 Step 3; (5) by the saved-envelope assertion in Task 9 Step 2.
