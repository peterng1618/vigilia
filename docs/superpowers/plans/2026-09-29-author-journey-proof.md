# Author Journey Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an author a blank theme they can actually start from, then rebuild the whole reference composition from that blank state by hand, through the UI alone, and record every gap, friction point and visual-quality problem the rebuild exposes.

**Architecture:** Three product changes first, because without them the proof has to begin with a workaround and would measure the workaround rather than the surface: a blank theme `New`, an artboard chooser, and the starter as an explicit template. After that no new code path is built — the work is a Playwright driver exercising the real editor's real controls, and a Findings table that is the durable record of what the surface could not do.

**Tech Stack:** TypeScript, React 19 shell, Fabric 7.4.0, Playwright, Vitest, Biome. No new dependency.

**Spec:** [Author journey proof](../specs/2026-09-27-author-journey-proof-design.md) — the plan argues from the spec, so the spec travels with it; executors read both.

## Global Constraints

- **No generator, starter file, fixture, hand-edited JSON or developer intervention at any point** in Phase 2. Opening the starter and editing it is not the rebuild. The only legal moves are the controls in the delivered surface and the ones this plan names.
- **A control that does not exist is the finding.** Do not work around it with the canvas dock, a marquee, a drag, or code. A workaround is a defect in the surface, not a technique.
- **Fix what you find, using what the repo already decides.** A property not exposed in the panel, a layout that does not line up, something hard to read, an icon that is not Lucide — each is fixed in the pass, not merely recorded. The repo already answers most of these: `docs/architecture/ownership.md` names the owner, the surrounding code sets the idiom, `ui-copy.ts` holds the copy, and the existing controls set the pattern. A reasonable decision from those is a decision, and making it is the job. Fix it, regression-test it, and move on.
- **Note and continue only for a genuine unknown** — a product decision with no precedent in the repo and no owner who can be inferred. Record it in the Findings table, keep the rebuild moving past it, and do not stop the pass. Nothing waits on a human.
- **Gaps, friction and visual quality are findings in their own right.** A journey that completes but is unpleasant has still failed.
- Paint resolves through palette tokens (§73) and type through named type presets (§75). A per-object colour that bypasses a token is a defect, not a shortcut — the rebuild varies the frosted tint by editing a token.
- Missing or non-`ok` telemetry is never fabricated as zero/default data (§97). A gap in the display is a correct result.
- One history entry per committed edit (§67). No runtime or derived state in persisted data.
- UI copy belongs in `editor/src/ui-copy.ts` (§35); every control keeps its accessible name and keyboard access.
- Report what was not verified. A partially completed pass is reported as partial, not rounded up.
- Supported Node: 22.12+, 24, or 26+. Workspace scripts run from `src/web/`. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` remain enabled.
- Stage explicit paths. Pushing and opening a PR are separate actions.
- File an issue with `gh issue create --body-file .github/bug-report-template.md`; a finding whose cause is not established is written as "cause not established", not guessed.

## Product decisions, taken 2026-09-29

Recorded here so an executor does not re-open them.

| Decision | Ruling |
|---|---|
| A blocking finding that cannot be fixed quickly | **Fix it in the pass, using what the repo already decides** — ownership, idiom, copy, and the existing controls' pattern. Note and move on only for a genuine unknown with no precedent. The pass never stops for a human. |
| A blank theme's palette | **Minimal starting set** — `text`, `dim`, `panel`, `frost`, `panelStroke`, `rule`, `chartTrack`, `frostInk`, `frostArea`. Not the reference palette's device colours. |
| The starter's reach, now that `New` is blank | **Also a library template**, not only a File item. |
| Artboard sizes offered | **16:9, 19.5:9 and 4:3**, landscape and portrait, at **1080p, 2K and 4K**. No device names — the 19.5:9 entry is not labelled as any handset. |
| How a resolution maps onto a ratio | **The short edge.** 1080p / 2K / 4K are 1080 / 1440 / 2160 on the short side; the long edge is derived from the ratio. 16:9 therefore lands on the familiar 1920×1080, 2560×1440 and 3840×2160. |
| Where the chooser appears | **On New, and driving the inspector's artboard controls.** One preset list, two uses. |

The starter keeps its own 1672 × 941 artboard. It is not resized to a preset — 16:9 is its *ratio*, and the new-document presets are a separate list.

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
| Artboard width/height | `[data-vigilia-artboard]` | `editor-shell` artboard panel |
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

- **There is no blank theme today.** `New` calls `createNewFabricTheme()` (`editor-main.ts:148`), which emits the entire finished composition. The only route to a blank scene is selecting everything and deleting it — a workaround no author is expected to understand, and exactly the thing this pass exists to catch. **Phase 0 makes the blank state real; the rebuild starts from it.**
- **Alignment, wrap and overflow are run-level, not object-level.** The 2026-09-24 author-journey plan says otherwise and is wrong; see its Task 2. The rebuild drives the run editor.

---

## Phase 0 — The blank state

Nothing in Phase 1 or 2 can be trusted until this lands. Three tasks, each independently reviewable.

### Task 1: The artboard presets, as one derived owner

**Files:**
- Create: `src/web/packages/editor/src/artboard-presets.ts`
- Create: `src/web/packages/editor/src/artboard-presets.test.ts`
- Modify: the inspector's artboard controls, to drive from this list

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type ArtboardRatioId = "16:9" | "19.5:9" | "4:3";
  export type ArtboardResolutionId = "1080p" | "2k" | "4k";
  export type ArtboardOrientation = "landscape" | "portrait";
  export interface ArtboardSize { readonly width: number; readonly height: number }
  export function artboardSize(
    ratio: ArtboardRatioId,
    resolution: ArtboardResolutionId,
    orientation: ArtboardOrientation,
  ): ArtboardSize;
  export const ARTBOARD_RATIOS: ReadonlyArray<{ id: ArtboardRatioId; ratio: number }>;
  export const ARTBOARD_RESOLUTIONS: ReadonlyArray<{ id: ArtboardResolutionId; shortEdge: number }>;
  ```
  Task 2 and Task 3 both consume `artboardSize`.

- [ ] **Step 1: Write the failing unit test**

In `artboard-presets.test.ts`, assert the whole derived table. It is small enough to state in full, and stating it in full is the point — the rule is arithmetic, so the test is the rule:

| ratio | 1080p | 2K | 4K |
|---|---|---|---|
| 16:9 landscape | 1920 × 1080 | 2560 × 1440 | 3840 × 2160 |
| 19.5:9 landscape | 2340 × 1080 | 3120 × 1440 | 4680 × 2160 |
| 4:3 landscape | 1440 × 1080 | 1920 × 1440 | 2880 × 2160 |

Every portrait size is that row's two numbers swapped. Also assert every derived size has integer width and height, both even, and both greater than zero — a fractional or odd artboard is a half-pixel on a panel border.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/editor/src/artboard-presets.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
const RATIOS = [
  { id: "16:9", ratio: 16 / 9 },
  { id: "19.5:9", ratio: 19.5 / 9 },
  { id: "4:3", ratio: 4 / 3 },
] as const;

const RESOLUTIONS = [
  { id: "1080p", shortEdge: 1080 },
  { id: "2k", shortEdge: 1440 },
  { id: "4k", shortEdge: 2160 },
] as const;

export function artboardSize(ratio, resolution, orientation): ArtboardSize {
  const shortEdge = RESOLUTIONS.find((r) => r.id === resolution)?.shortEdge;
  const factor = RATIOS.find((r) => r.id === ratio)?.ratio;
  if (shortEdge === undefined || factor === undefined) {
    throw new RangeError(`no artboard preset for ${ratio} at ${resolution}`);
  }
  const longEdge = Math.round(shortEdge * factor);
  return orientation === "portrait"
    ? { width: shortEdge, height: longEdge }
    : { width: longEdge, height: shortEdge };
}
```

**Throw rather than return a default.** These ids come from a control, but the function is a trust boundary for anything that persists a size, and a silently-defaulted artboard is a document the author did not draw.

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run packages/editor/src/artboard-presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Drive the inspector's artboard controls from the list**

The existing width/height fields stay — an author who wants an exact size still types one. Add the ratio, orientation and resolution controls beside them, and have a change to any of the three write through `artboardSize`. Choosing a control must not silently discard a width the author typed, and the free fields must still accept a value that is not a preset.

- [ ] **Step 6: Gates and the red-without-fix check**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test`
Then comment out the portrait swap, run the unit test, confirm the portrait assertions fail, restore, confirm green.

- [ ] **Step 7: Commit**

```
git add src/web/packages/editor/src/artboard-presets.ts \
        src/web/packages/editor/src/artboard-presets.test.ts \
        src/web/packages/editor/src/editor-shell/
git commit -m "feat(editor): artboard sizes are a derived preset, not authored data"
```

### Task 2: `New` is a blank theme, chosen at the size you want

**Files:**
- Modify: `src/web/packages/editor/src/new-fabric-theme.ts` — add `createBlankFabricTheme(artboard)`
- Modify: `src/web/packages/editor/src/new-fabric-theme-globals.ts` — add the minimal palette entry set
- Modify: `src/web/packages/editor/src/editor-main.ts:147-155` — `onNew` takes the blank path
- Modify: `src/web/packages/editor/src/editor-session.ts:389,589` — `onNew` gains the chosen size
- Test: `src/web/packages/editor/src/new-fabric-theme.test.ts`, `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `artboardSize` and the preset lists from Task 1.
- Produces: `createBlankFabricTheme(artboard: ArtboardSize): FabricThemeEnvelope`.

- [ ] **Step 1: Write the failing unit test**

Assert `createBlankFabricTheme({ width: 1920, height: 1080 })` validates against `validateFabricThemeEnvelope`, that `scene.objects` is `[]`, that `assets` is `[]`, that the artboard is the one passed rather than the starter's, and that the palette contains **exactly** the nine minimal tokens and none of `cpu`, `gpu`, `ram`, `vram`, `down`, `bars`, `background`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/editor/src/new-fabric-theme.test.ts`
Expected: FAIL — `createBlankFabricTheme` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Build from `createNewFabricTheme()` with `scene.objects` emptied, `assets` emptied, the artboard replaced, and the palette narrowed to the minimal set. **Derive the narrow palette from `starterPalette` by token id, never by restating the colour** — a second copy of `#ecf5ff` is how the tint drifted to three literals once already.

- [ ] **Step 4: Run it and confirm it passes**

- [ ] **Step 5: Build the New chooser**

Opening `New` presents ratio × orientation × resolution, defaults to 16:9 landscape at 1080p, and creates the blank theme at the chosen size on Create. It is a real dialog with an accessible name, reachable and dismissible by keyboard, and it is shown **before** the document mounts so the first paint is already the size the author chose.

`New` on a dirty document still goes through `#confirmReplacement` — the chooser opens, and confirming the replacement is a second step, not a bypass.

- [ ] **Step 6: Gates and the red-without-fix check**

Run the static gates and the unit suite. Then comment out the palette narrowing, run the test, confirm the exact-token assertion fails, restore, confirm green.

- [ ] **Step 7: Browser proof and commit**

Add to `editor.spec.ts`: `New` offers the chooser, Create opens a document with no objects at the chosen size, and the palette resolves rather than reading "not set". The dirty-replacement test at `editor.spec.ts:2835` must still pass.

```
git commit -m "feat(editor): New is a blank theme at the size you choose"
```

### Task 3: The starter becomes an explicit template

**Files:**
- Modify: `src/web/packages/editor/src/editor-main.ts` — add `onNewFromStarter` holding today's behaviour
- Modify: `src/web/packages/editor/src/editor-session.ts:389,589` — `actionFacade` gains `newFromStarter`
- Modify: `src/web/packages/editor/src/editor-shell/session-facade.ts:8` — add `newFromStarter(): Promise<void>`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx:217` — add the item beside `New`
- Modify: `src/web/packages/editor/src/ui-copy.ts:99` — `newDocument: "New theme"`, add `newFromStarter: "New from starter"`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.dom.test.ts:22`, `canvas-context-menu.dom.test.tsx:41`, `shell-layout.dom.test.tsx:11` — the three session doubles
- Modify: the library, to carry the starter as a template entry

**Interfaces:**
- Consumes: `createNewFabricTheme()` and `starterAssets()` unchanged.
- Produces: `newFromStarter(): Promise<void>` on the session facade.

- [ ] **Step 1: Wire `onNewFromStarter` and the menu item**

Today's `onNew` body moves verbatim. The File menu reads `New theme` / `New from starter`, both keyboard-reachable through the existing `MenuGroup`, neither a dock button. Both go through `#confirmReplacement`.

- [ ] **Step 2: Add the starter to the library as a template**

It is listed, it opens, and it is not one of the author's own themes — deleting it must not be possible and it must not appear in a count of "your themes". A template is a thing the product offers, not a thing the author made.

- [ ] **Step 3: Update the three session doubles**

Each adds `newFromStarter: vi.fn(async () => undefined)`. A missing method is a typecheck error, which is the intended way this surfaces.

- [ ] **Step 4: Gates, then commit**

Run `npm run typecheck && npm run lint && npm run format:check && npm test`, then the editor browser spec. Any e2e that reached the starter through `New` must now use the template; enumerate them rather than fixing the first failure the suite reports.

```
git commit -m "feat(editor): the starter is a template an author can open, not what New means"
```

---

## Phase 1 — The three round trips STATUS.md still lists as unverified

Each proves the **persisted envelope**, not the DOM.

### Task 4: Text layout round-trips through save/reopen

**Files:**
- Create: `src/web/tests/e2e/author-journey.spec.ts`

**Interfaces:**
- Produces: `reloadEnvelope(page)` and `openBlank(page)` helpers, reused by Task 5 and every Phase 2 rebuild task. `openBlank` drives the real `New` chooser from Task 2.

- [ ] **Step 1: Write the test**

Open a blank document, add a text object, set align/wrap/overflow through `[data-vigilia-text-align]`, `-wrap`, `-overflow`, save, reopen, and assert the **reloaded envelope's** `vigiliaText.layout` carries all three. Asserting the DOM instead is a defect, not a shortcut.

- [ ] **Step 2: Run it and read the failure**

Run: `npx playwright test tests/e2e/author-journey.spec.ts --project=desktop-chromium --workers=1 --reporter=line`
**Record what actually happens** — a pass is as informative as a fail, and either way the result goes in the Findings table.

- [ ] **Step 3: Fix a blocking failure inside its owner**

The fix belongs to the persistence owner that loses it — not the test, and not a new field. A cause that is not established is written as such and filed as an issue the same day.

- [ ] **Step 4: Prove the fix fails without it**

Disable the fix, rebuild the affected bundle, confirm the test goes red at the failing assertion. Restore, rebuild, confirm green.

- [ ] **Step 5: Commit**

```
git commit -m "test(author): text layout round-trips through the envelope"
```

### Task 5: In-place editing commits, undoes, and survives save

**Files:**
- Modify: `src/web/tests/e2e/author-journey.spec.ts`
- Consumes: `openBlank(page)`, `reloadEnvelope(page)` from Task 4.

- [ ] **Step 1: Write the test**

Double-click a text object, type, commit with Escape, assert exactly **one** history entry. Undo, assert the previous text returns. Save, reopen, assert the committed text is in the reloaded envelope. A second history entry on one edit is a §67 failure and a finding.

- [ ] **Step 2: Run, record, classify, fix or file**

- [ ] **Step 3: Commit**

```
git commit -m "test(author): in-place edit commits once, undoes, and survives save"
```

### Task 6: A run's preset and style override round-trip

**Files:**
- Modify: `src/web/tests/e2e/author-journey.spec.ts`
- Consumes: `openBlank(page)`, `reloadEnvelope(page)` from Task 4.
- Produces: the Findings table path (Task 7).

- [ ] **Step 1: Write the test**

Select a bound text object, change one run's preset through `[data-vigilia-run-preset="0"]` and override its colour through `[data-vigilia-run-colour="0"]`, save, reopen, assert both are in the reloaded envelope's `vigiliaText.runs[0]`, then clear the override and assert the run returns to its preset.

- [ ] **Step 2: Run, record, classify, fix or file**

- [ ] **Step 3: Commit**

```
git commit -m "test(author): a run's preset and override round-trip through save"
```

---

## Phase 2 — The rebuild, from a real blank theme

### Task 7: Open a blank theme and open the Findings table

**Files:**
- Create: `src/web/tests/e2e/author-journey-rebuild.spec.ts`
- Modify: the proof spec (Findings table)

**Interfaces:**
- Consumes: the surface table above, `openBlank(page)` from Task 4.
- Produces: `insertPanel`, `setToken`, `addText`, `setRun` helpers for every rebuild task.

- [ ] **Step 1: Write the blank-start test**

Drive the real `New` menu item, choose 16:9 landscape at 1080p, and assert the canvas holds no objects and the Style tab's globals are populated. **Every step is a pointer or keyboard gesture against a real control** — no `page.evaluate` writes scene state anywhere in this file, and a driver step that needs one is a finding in its own right.

- [ ] **Step 2: Run it, and note how it feels**

Note whether an author landing on a blank theme can tell what to do next, or whether they face an empty stage. That is a finding, and a visual-quality one, which the spec counts.

- [ ] **Step 3: Open the Findings table in the spec**

Each row classified **blocking** or **deferred** at observation time, with the surface, what happened, and whether it stops the journey.

- [ ] **Step 4: Commit**

```
git commit -m "test(author): the rebuild starts from a real blank theme"
```

### Task 8: The wordmark and the clock card

**Files:** `src/web/tests/e2e/author-journey-rebuild.spec.ts` · Consumes: the helpers from Task 7.

- [ ] **Step 1: Build the region through the UI only**

Insert a panel through the Add panel action. Set fill and stroke through `[data-vigilia-panel-fill]` / `-stroke`, border width and radius through `-border` / `-radius`. Add the two text objects, set each run's preset through `[data-vigilia-run-preset]`, and set the tracked wordmark's spacing through its type preset in the globals.

- [ ] **Step 2: Compare against the target by eye**

`docs/superpowers/specs/2026-09-26-reference-theme-target.png`. Friction and visual-quality problems are findings even when every control exists.

- [ ] **Step 3: Record findings, commit**

```
git commit -m "test(author): the wordmark and clock card, built from blank by hand"
```

### Task 9: The four device cards

**Files:** `src/web/tests/e2e/author-journey-rebuild.spec.ts` · Consumes: the helpers from Task 7 and Task 8.

- [ ] **Step 1: Build the CPU card**

Panel, then the frosted material: enable `[data-vigilia-glass-enabled]` and set `[data-vigilia-glass-blur]` to 40. The tint is **not** a panel control — it is the `palette.frost` token, edited through `[data-vigilia-palette-color]`. If the rebuild needs a tint control and cannot find one, that is a finding, **not** a workaround.

- [ ] **Step 2: Add the reading and the caption**

Two runs on one text object: a value run bound to a semantic key, and a literal unit run. If a binding cannot be authored from the UI, that is a blocking finding — and by the ruling above the pass stops until it is fixed.

- [ ] **Step 3: Add the sparkline**

Insert a chart, choose the `line` family, set its paint through the family's paint fields, bind it to the same key as the reading. The card must not be able to show a percentage and a waveform for two different moments.

- [ ] **Step 4: Repeat for GPU, RAM and VRAM**

RAM is a partial gauge and VRAM a full ring; the gauge family and its settings fields are the surface under test.

- [ ] **Step 5: Compare by eye, record findings, commit**

```
git commit -m "test(author): the four device cards, built from blank by hand"
```

### Task 10: The trends panel, the storage bar and the network panel

**Files:** `src/web/tests/e2e/author-journey-rebuild.spec.ts` · Consumes: the helpers from Tasks 7–9.

- [ ] **Step 1: Build the trends panel** — a line chart with three series, each with its own palette token, on a frosted panel.
- [ ] **Step 2: Build the storage bar** — a bar chart with a value and a track paint, plus its caption.
- [ ] **Step 3: Build the network panel** — two readings and their labels, on the last frosted panel.
- [ ] **Step 4: Compare by eye, record findings, commit**

```
git commit -m "test(author): trends, storage and network, built from blank by hand"
```

### Task 11: Save the rebuilt theme, run it, and compare the output

**Files:** `src/web/tests/e2e/author-journey-rebuild.spec.ts` · Consumes: everything from Phases 0, 1 and 2.

- [ ] **Step 1: Save, package and run the rebuilt theme on the real host**

Build the host, then start it with `node packages/host/bin/vigilia.js --no-browser`. Open the saved theme on a real display and compare to the target. A dashboard that renders differently on the player than in the editor is a finding even when both look plausible alone.

- [ ] **Step 2: Assert the persisted envelope, not the live DOM**

Bindings, captions, glass treatments and palette references must all survive the round trip.

- [ ] **Step 3: Record findings, commit**

```
git commit -m "test(author): the rebuilt theme saves, runs, and matches the target"
```

---

## Phase 3 — Close out

### Task 12: Phone-width surfaces, inspected by eye

**Files:** `src/web/tests/e2e/author-journey.spec.ts` · Evidence registered in `docs/evidence/screenshots/README.md`

- [ ] **Step 1: Register the captures, then drive the phone project**

Add the rows to the README **before** running, then:
`VIGILIA_CAPTURE=1 npx playwright test tests/e2e/author-journey.spec.ts --project=phone-chromium --workers=1 --reporter=line`

The suite already exercises phone width; the obligation is that a person looked at the generated images.

- [ ] **Step 2: Record findings, commit**

### Task 13: Close the six status debts and archive their plans

**Files:** the six specs — `2026-09-24-authoring-and-consumer-polish.md`, `2026-09-24-author-journey.md`, `2026-09-24-authoring-time-run-placeholders.md`, `2026-09-24-consumer-journey.md`, `2026-09-24-theme-thumbnails.md`, `2026-09-24-settings-scope.md`; plus the plans those six name, where not already archived.

- [ ] **Step 1: Flip each spec to `implemented` with what was observed**

Each spec's Acceptance section records what this pass actually saw, as `specs/README.md` requires. A spec whose feature this pass did not exercise is **not** flipped — it is recorded as still unverified, and saying otherwise would be the exact misstatement this pass exists to catch.

- [ ] **Step 2: Archive the plans** — tick the boxes, move to `archive/`, record what the pass observed.
- [ ] **Step 3: Commit**

```
git commit -m "docs(specs): the authoring specs read implemented on observed evidence"
```

### Task 14: Broad gate and the full local browser run

**Files:** `STATUS.md` · Consumes: everything above.

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

**1. Spec coverage.** DoD 1 (rebuild from blank, compared to target) → Phase 0 makes blank real, Tasks 7–11 rebuild from it. DoD 2 and Acceptance 2 (every finding in the table) → Task 7 onward, each task carrying a "record findings" step. DoD 3 (blocking findings fixed, not deferred) → the ruling in Global Constraints, applied at every classification point. DoD 4 (three round trips driven in a browser, phone widths by eye) → Tasks 4–6 and Task 12. DoD 5 (six status debts closed, plans archived) → Task 13. Verification at the pass boundary → Task 14.

**2. Placeholder scan.** No `TBD`, no "write tests for the above" without the assertion named, no "similar to Task N". Every command is given verbatim. The one thing deliberately *not* pre-baked is the region geometry: writing invented coordinates into this plan would be exactly the inherited-draft failure the spec forbids, and the target image is the reference.

**3. Type consistency.** `artboardSize`, `createBlankFabricTheme`, `openBlank`, `reloadEnvelope`, `insertPanel`, `setToken`, `addText`, `setRun` are produced once and consumed by name in later tasks; no task calls a helper a later task renames. Selector keys were read from source on 2026-09-29 and appear in exactly one table.

**4. Review Focus.** Each of the five lines is discharged: (1) by the Task 7 rule that any state-writing `page.evaluate` is a defect; (2) by the persisted-envelope assertion in Tasks 4, 6 and 11; (3) by classification at observation time; (4) by the "fix inside its owner" rule in Task 4 Step 3; (5) by the saved-envelope assertion in Task 11 Step 2.
