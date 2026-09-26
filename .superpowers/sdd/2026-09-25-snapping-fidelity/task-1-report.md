# Task 1: Candidate-filter parity — report

## What I implemented

Commit `8be1364` — `fix(editor): align to locked objects, ignore the artboard plate`.

- `snap-manager/index.ts`: `isSnapTarget` is now `!shouldIgnoreObject({ object, excluded })`.
  The `object.selectable === true` and `object.get("locked") !== true` clauses are gone;
  the doc comment states the fork's rule (visibility and explicit exclusion decide, not lock).
  Removed the now-redundant `if (excluded.has(object)) return undefined;` line in `toSnapSource`,
  as the brief prescribed — the exclusion set is checked inside `shouldIgnoreObject`.
- `snap-manager/excluded-objects.ts`: `IGNORED_IDS` is now `["scene"]`, with a comment naming
  the artboard plate and `new-fabric-theme.ts`'s `backgroundOnly`. No other edit to this file;
  its `collectExcludedObjects` / `shouldIgnoreObject` bodies are unchanged and already matched
  the fork's `src/editor/utils/object-filter.ts` line for line.
- `snap-manager/index.dom.test.ts`: deleted `"skips a locked neighbour as a snap target"` and
  added the three tests from the brief (locked neighbour, artboard plate by id, hidden neighbour
  regression guard).

## What I tested, commands, measured results

### Step 1–2: RED before Step 3

`npx vitest run packages/editor/src/snap-manager/index.dom.test.ts`

First run (fixture as literally written in the brief, plate `selectable: false`):

```
passed | nudges a dragged object onto a neighbour's edge
passed | re-plans every movement step of one drag
passed | leaves the raw position alone while Ctrl is held
passed | leaves an object alone when no neighbour is within the threshold
failed | aligns to a locked neighbour, which lock must not prevent
     AssertionError: expected 98 to be 100 // Object.is equality
         at index.dom.test.ts:162:26
passed | ignores the artboard plate even though it is large and centrally placed
passed | still ignores a hidden neighbour
passed | detaches every listener on destroy
passed | survives a whole-pixel drag step that resolves to a zero delta
TOTAL 8 passed 1 failed
```

**The plate test passed at Step 2, so I applied the brief's own rule and fixed the fixture rather
than proceeding.** Its candidate was not in reach: with the plate `selectable: false`, the old
`selectable` gate excluded it *independently of the id*, so the assertion was green for the
selection behaviour and would have stayed green against a bad implementation of the id filter.
I removed `selectable: false` from the fixture (keeping `evented: false`) so the only thing that
can exclude the plate is its id. The comment now records this deliberate omission.

Fixture-corrected run, still before Step 3:

```
failed | aligns to a locked neighbour, which lock must not prevent
    AssertionError: expected 98 to be 100 // Object.is equality
failed | ignores the artboard plate even though it is large and centrally placed
    AssertionError: expected 160.5 to be 158 // Object.is equality
TOTAL 7 passed 2 failed
```

Why each failure is the expected one:

- Locked neighbour: the locked object is not a snap candidate under the current filter, so
  the drag is free and left stays at its raw 98. The 2-wide left-edge gap (100 − 98) proves the
  candidate was in reach, not out of range.
- Plate: the `selectable: false` plate is admitted only once the gate is gone, and then its
  centreX is the nearest candidate. Raw left stays 158, snapped left is 160.5.

**Measured red for the plate is `expected 160.5 to be 158`, not the brief's predicted
`expected 160 to be 158`.** Cause: Fabric's `getBoundingRect` includes the default stroke, so the
plate's exact bounds are 39.5..280.5 (centreX 160.0) and the dragged rect's `bounds.left` is 157.5,
not 158 — the correction is +2.5. The failure is still alignment-driven (a real candidate at
distance 2.5, inside `SNAP_THRESHOLD = 5`), which is the check the brief asks for; a wrong-fixture
failure would have read `expected 158 to be 158` or an unrelated value. The fixture geometry and
the asserted values are unchanged from the brief.

Third new test (hidden neighbour) passes before and after, as the brief labels it a regression guard.

### Step 4: GREEN after Step 3

`npx vitest run packages/editor/src/snap-manager`
→ `TOTAL 41 passed 0 failed 41` (all four files: index.dom, guide-renderer.dom,
movement-snapping-resolver, spacing).

### Step 5: teeth

1. Restored `object.selectable === true &&` to the predicate, reran `index.dom.test.ts`:
   `failed | aligns to a locked neighbour, … AssertionError: expected 98 to be 100`
   Total `8 passed 1 failed`.
   **The plate test did NOT fail at this step — the check is not independent.** With
   `IGNORED_IDS = ["scene"]` still in place the plate is excluded by id even under the gate,
   so restoring the gate cannot turn that test red. The brief's Step 5 attributes the plate
   failure to both edits at once; in fact the plate test is armed by the id list alone.
2. Emptied `IGNORED_IDS`, reran:
   `failed | ignores the artboard plate … AssertionError: expected 160.5 to be 158`
   Total `8 passed 1 failed`; the locked-neighbour test passed, also as the brief predicts.
   This is the step that actually proves the plate test has teeth.
3. Restored the relaxed predicate and `["scene"]`.

Both edits are individually load-bearing: the locked test is armed by the predicate change alone,
the plate test by the id list alone.

### Gates (final tree, ran from `src/web/`)

- `npm run typecheck` → exit 0, no diagnostics (all five packages: scene-fabric, player, editor,
  fake-source, host).
- `npx vitest run packages/editor/src/snap-manager` → `41 passed 0 failed 41`.
- `npm run lint` → `Checked 317 files in 440ms. No fixes applied.` exit 0.
- `npm run format:check` → initially exit 1 on my new test file (the brief's snippets use lines
  over Biome's width, e.g. the `hidden`/`dragged` consts). Ran
  `npx biome format --write packages/editor/src/snap-manager/index.dom.test.ts`, then re-ran the
  check: `Checked 317 files in 110ms. No fixes applied.` exit 0.

No browser test and no build run — the task is pure logic and the brief says so. Step 6's
`npm run build` + capture was not run; see Concerns.

## Files changed

- `src/web/packages/editor/src/snap-manager/index.ts`
- `src/web/packages/editor/src/snap-manager/excluded-objects.ts` — **needed no edit beyond the
  `IGNORED_IDS` value**; the filter bodies already matched the fork.
- `src/web/packages/editor/src/snap-manager/index.dom.test.ts`

Nothing else was staged; the six files already modified in the working tree before this task
(two screenshot PNGs, three plans, one spec) were left untouched.

## Self-review findings

- **Fixture, not code, was the Step 2 plate failure.** Found and fixed as above; this was the
  brief's explicitly flagged trap and it did fire.
- **Brief's Step 5 plate expectation is not achievable as written** (restoring the gate does not
  redden the plate test). Reported rather than papering over; the equivalent teeth check is the
  `IGNORED_IDS` emptying.
- Comment accuracy: the plate test's inline comment originally said "its left edge (158) is 2 away
  — inside SNAP_THRESHOLD… would resolve to left 160", which misstates the measured arithmetic.
  Corrected to the actual bounds (157.5 vs centreX 160.0, correction +2.5, snapped 160.5).
- Overbuilding check: no new exports, no helper, no config. One predicate collapsed to a single
  delegation; one redundant guard deleted. Diff is 3 files, +83/−11.
- Test-quality check: all four assertions read the real `dragged.left` after the real
  `object:moving` path, with no mocking of the resolver — behaviour, not mocks.
- Blast radius checked: `shouldIgnoreObject` and `IGNORED_IDS` have no consumers outside
  `snap-manager/` (grep across `packages/`), so the relaxed predicate cannot change selection,
  nudging or layer behaviour. `object-lock-manager` sets `selectable: false, evented: false,
  locked: true` together; locked objects are now snap targets, which is the intended change and
  does not alter whether they are movable or selectable. `editor-session.ts:310` builds
  select-all from `selectable === true` and is untouched by this task.

## Issues or concerns

1. **Step 6 not run.** I did not build or open a browser capture. Step 6 asks for visual
   confirmation that no guide lands on the artboard plate. The only `selectable: false` object the
   starter theme creates is that one plate (`backgroundOnly` is used exactly once,
   `new-fabric-theme.ts:328`), and `artboardPlate` in `editor-shell.ts:132` is a
   `canvas.backgroundImage` and never enters `getObjects()`, so the id list covers the known
   decoration. That is source evidence, not the rendered evidence the brief asked for; if the
   Step 6 capture is a hard requirement it still needs running.
2. **Locked objects are now snap targets everywhere**, including any future locked object that is
   also `selectable: false` decoration — such an object would need its own `IGNORED_IDS` entry.
   No such object exists today.
3. **STATUS.md was not updated.** The brief's Step 7 stages only the three snap-manager paths and
   parallel Spec A/B tasks are editing the tree; STATUS.md's "Last completed change" is owned at
   the plan boundary rather than by this task. Flagging in case the plan expects otherwise.

---

# Task 1 — fix round 1

## What changed

The review's Critical was a brief error, not an implementation error: `IGNORED_IDS = ["scene"]`
named a string no product object carries. In `new-fabric-theme.ts:320-330` `"background"` is the
`id` and `"scene"` is the ninth argument (`paletteId`, which becomes
`vigiliaPaint: { fill: "palette.scene" }`). The list is now `["background"]`, with the comment
stating the real id and why the id — not `selectable` — is the excluding arm.

- `snap-manager/excluded-objects.ts` — `IGNORED_IDS` is `["background"]`; comment rewritten to name
  the plate's real id, the ±0.5 stroke-edge effect and the whole-artboard spacing span, and to say
  explicitly that `selectable` is not the arm (it would also drop locked neighbours).
- `snap-manager/index.dom.test.ts` — the plate fixture's id is now derived from
  `createNewFabricTheme()` rather than hardcoded, so the fixture and the ignored-id list cannot
  drift apart again. `expect(plateId).toBeTypeOf("string")` is the vacuity guard and runs before
  the `Rect` is constructed. The `scene.objects` cast copies the idiom at
  `new-fabric-theme.test.ts:61-63`. The fixture keeps its own geometry and its omitted
  `selectable`, so the id remains the only excluding arm.
- `editor-session.ts` — the `selectableObjects` comment no longer claims parity with
  `snap-manager` ("which matches `snap-manager`" was false once the `selectable` clause was
  removed from `isSnapTarget`). It now states the distinction: snapping aligns *to* a locked
  object, selection must not *contain* one.
- `STATUS.md` — "Last completed change" replaced with this task's summary.

No change to `shouldIgnoreObject`'s body, per the brief's out-of-scope list.

Note on the coordinator's mid-task correction to Fix 2: I had already applied the `scene.objects`
cast (typecheck caught it before the correction arrived), and I did move to the brief's
`?.["id"]` bracket spelling. The `expect` sits between the `find` and the fixture `Rect`, so the
fixture can never be built from `undefined`.

## Commands run, and their measured output

### Baseline before any fix

```
$ npx vitest run packages/editor/src/snap-manager
 Test Files  4 passed (4)
      Tests  41 passed (41)
```

### Teeth check 1 — empty `IGNORED_IDS` (`readonly string[] = []`)

```
$ npx vitest run packages/editor/src/snap-manager
 FAIL  packages/editor/src/snap-manager/index.dom.test.ts > SnapManager > ignores the artboard plate even though it is large and centrally placed
AssertionError: expected 160.5 to be 158 // Object.is equality
 Test Files  1 failed | 3 passed (4)
      Tests  1 failed | 40 passed (41)
```

The failure is on the plate test's own assertion line (`expect(dragged.left).toBe(158)`), and
nothing else reddens — the locked-neighbour and hidden-neighbour tests both pass, which is what
makes the id list the arm this test is measuring. Restored to `["background"]`; rerun green
(`4 passed / 41 passed`).

### Teeth check 2 — reintroduce `object.selectable === true &&` in `isSnapTarget`

```
$ npx vitest run packages/editor/src/snap-manager
 FAIL  packages/editor/src/snap-manager/index.dom.test.ts > SnapManager > aligns to a locked neighbour, which lock must not prevent
AssertionError: expected 98 to be 100 // Object.is equality
 Test Files  1 failed | 3 passed (4)
      Tests  1 failed | 40 passed (41)
```

Only the locked-neighbour test reddens; the failure reads `expected 98 to be 100`, the raw position
against the aligned one, so the fixture's candidate was in reach and the failure is
alignment-driven. This is the check that proves the relaxation is still load-bearing. Restored;
rerun green.

### Teeth check 3 — point the derived fixture at the wrong object

First attempt, `find((object) => object["selectable"] === true)` (the brief's suggestion):

```
AssertionError: expected undefined to be type of 'string'
```

That is the vacuity guard firing — the starter theme emits exactly one object with
`selectable: false` and none with an explicit `selectable: true`, so the selector finds nothing and
`plateId` is `undefined`. It proves the guard works but does not prove the derived id is doing the
work, so I ran the sharper version: point it at a real but wrong id, an object that exists.

`find((object) => object["id"] === "wordmark")`:

```
$ npx vitest run packages/editor/src/snap-manager
 FAIL  packages/editor/src/snap-manager/index.dom.test.ts > SnapManager > ignores the artboard plate even though it is large and centrally placed
AssertionError: expected 160.5 to be 158 // Object.is equality
 Test Files  1 failed | 3 passed (4)
      Tests  1 failed | 40 passed (41)
```

A real id that is not the plate's reddens the plate test on its own assertion, with the same
160.5-vs-158 alignment correction. That is what proves the derived id — and therefore the
derivation from the theme — is the arm doing the work. Restored; rerun green.

### Gates (final tree, from `src/web/`)

```
$ npx vitest run packages/editor/src/snap-manager
 Test Files  4 passed (4)
      Tests  41 passed (41)

$ npm run typecheck
exit=0, 0 lines matching "error TS" (all packages: renderer-core, theme-package,
scene-fabric, player, editor, fake-source, host)

$ npm run lint
Checked 319 files in 513ms. No fixes applied.   exit 0

$ npx biome format packages/editor/src/snap-manager/excluded-objects.ts \
    packages/editor/src/snap-manager/index.dom.test.ts packages/editor/src/editor-session.ts
Checked 3 files in 10ms. No fixes applied.   exit 0

$ npm run status:check
exit 0

$ npm run build
exit 0 (all bundles)
```

**`npm run format:check` exits 1, on `packages/editor/src/canvas-nudge.ts` only — a pre-existing,
line-ending-only failure I did not introduce and did not fix.** Evidence it is not this task's:

- `canvas-nudge.ts` is byte-identical to `HEAD` (`git diff HEAD -- .../canvas-nudge.ts` is empty);
  it was committed at `49080b0`, before this task.
- The file on disk has CRLF terminators; the `HEAD` blob has LF (`.gitattributes` declares
  `* text=auto eol=lf`, and `core.autocrlf=true` re-CRLF'd the checkout). The formatter's diff shows
  the entire file as `-`/`+` with `␍` on every `-` side and no textual change.
- Isolated proof, config and file copied outside the repo and `files.includes` narrowed to `**/*.ts`:
  the CRLF copy reports `Found 1 error.`; the same content with `tr -d '\r'` reports
  `Checked 1 file in 3ms. No fixes applied.` Identical bytes apart from the carriage returns.
- My three changed files pass `biome format` cleanly, so this commit adds no new format failure.

### Browser test, with the capture opened

```
$ npm run build
$ VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium \
    --grep "snaps a dragged object" --workers=1
  ✓  1 [desktop-chromium] › tests\e2e\editor.spec.ts:1698:3 › Fabric editor route › snaps a
     dragged object to a neighbour and shows a guide (1.2s)
  1 passed (4.7s)
```

Capture written: `docs/evidence/screenshots/editor-snap-guides-desktop-chromium.png`
(1280x720, registered in `docs/evidence/screenshots/README.md` under "Editor mechanics"). I
opened it and also scanned its pixels, because "no guide on the plate" is a negative claim and a
squint is not a measurement.

**What the capture shows.** The `status-card` (scene 1018,518,210x154; "SYSTEM STATUS") is
mid-drag, carrying its eight selection handles. Exactly two snapping guides are painted, both
dashed `#3D8BF4` and both spanning the full artboard:

- one vertical at screen x≈933.5, which maps to scene x≈1178 — the card's moving left-edge
  candidate against `status-title`'s edge neighbourhood;
- one horizontal at screen y≈446.5, scene y≈518.5 — the card's top edge against its locked
  neighbour row (`trend-card`/`resource-card` tops, scene 518/519).

Both act on real content: the guides run against the wordmark, the header rule, the two chart
cards and the status card, and they terminate at the true artboard edges (screen x 357/982, y
194/543 — the artboard's own `domain-boundary` source), not at the plate's stroke bounds.

**No guide exists at any plate edge or centre.** Measured blue-pixel runs on the columns and rows
where a plate-authored guide would land: the plate's stroke edges would be at screen x≈357.0 and
x≈982.5 and y≈192.7 and y≈545.8, and its centre at x≈670 / y≈369. Runs there are 0–3 px of
anti-aliased surrounding line-art, not a guide; the guide at y=446 has a run of 408 px and the one
at x=934 a run of 233 px, so a plate guide would be unmistakable if present. No spacing badge (a
filled rounded label) appears anywhere in the artboard.

**Cross-check that the exclusion is the cause, not the fixture.** I rebuilt the bundle with
`IGNORED_IDS` emptied, reran the same capture into a temp directory, and diffed against the
committed capture. The two images are not identical: 6727 pixels differ, confined to x 550–940,
y 376–512 — the drag neighbourhood, with no full-length column anywhere (max 43 px in any single
column). That is consistent with the plate's `spacingSources` entry changing which equal-spacing
candidate won in the dragged region, i.e. the class of silent-winner failure the fix brief warned
about. The committed capture is the `["background"]` build. Note the browser e2e asserts nothing
about guides, so it passes either way — the browser check is evidence, not a regression gate, and
the unit teeth checks above are what arm the behaviour.

### Commit

```
git add src/web/packages/editor/src/snap-manager/excluded-objects.ts \
  src/web/packages/editor/src/snap-manager/index.dom.test.ts \
  src/web/packages/editor/src/editor-session.ts \
  STATUS.md
git commit -m "fix(editor): name the artboard plate's real id in the ignore list"
```

The three source paths plus `STATUS.md` are the only paths staged. The six files already dirty in
the working tree before this task (two screenshot PNGs, three plans, one spec) were left untouched,
as was `docs/` in full.

## Concerns

1. **`npm run format:check` is red at `packages/editor/src/canvas-nudge.ts`**, a CRLF checkout
   artifact, not anything this task changed — the blob is unchanged from `HEAD`, and the same bytes
   with LF pass. Someone on Windows will keep hitting this until the file is renormalized
   (`git add --renormalize` on it) or the checkout stops re-CRLF'ing it. Not fixed here because it
   is outside this commit's scope and would put an unrelated file in the diff.
2. **The browser check is not a regression gate.** `snaps a dragged object to a neighbour and shows
   a guide` asserts only that the drag completes and a capture exists; it passed with `IGNORED_IDS`
   emptied and with the `selectable` gate restored. The plan's later "move-and-resize behaviour
   matrix" is what will cover this, so the plate-id behaviour currently rests on the unit teeth
   checks alone.
3. **Fix 3's teeth were not independently verified.** The comment change in `editor-session.ts` is
   prose; no check reddens if it reverts. The brief did not ask for one.

4. **`docs/evidence/screenshots/editor-snap-guides-desktop-chromium.png` is modified but not staged.**
   Running the browser check rewrote it (140167 -> 233567 bytes); it is the new evidence for this
   fix. The fix brief names only the three source paths plus `STATUS.md`, and my scope excludes
   `docs/`, so I left it in the working tree for the coordinator to stage or discard.

Commit: `69e51211e5dad4d0fa15155b57da58fb5ce695be` — fix(editor): name the artboard plate's real id in the ignore list (4 files, +38/-27).
