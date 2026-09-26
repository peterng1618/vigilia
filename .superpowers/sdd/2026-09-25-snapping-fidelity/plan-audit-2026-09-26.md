# Plan audit — `2026-09-25-snapping-fidelity.md`

Date: 2026-09-26. Auditor: dispatch `adae3f6c7a6c838d0`, base sha `b1b99d6`.
Subject: `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` (1567 lines before,
1660 after). Binding authority: `docs/superpowers/specs/2026-09-25-snapping-fidelity.md`.

Only the plan file was edited. No commit, no `git add`, no other tracked file touched.
The fork `D:\git-repos\fabricjs-image-editor` was read strictly via
`git -C … show 9efdd78a:<path>` and `git ls-tree -r`.

## Landed / unlanded split (confirmed, not assumed)

Landed: **Tasks 1, 3, 4, 5, 6**.
Remaining: **Tasks 2, 7, 8, 9, 10**.

Confirmed from two independent sources:

1. Ledger `.superpowers/sdd/2026-09-25-snapping-fidelity/progress.md` — `:785` "C1
   CLOSED", `:1147` "C4+C5: COMPLETE", `:1687` "Task 6 COMPLETE", `:1750`/`:1794`
   "Task 3 … landed" with "C3 review — PASS/PASS", plus its landed-commit table.
2. Git, independently — `git merge-base --is-ancestor a90bc43 HEAD` → true;
   `git log --oneline -- src/web/packages/editor/src/snap-manager/scaling/` shows
   the `cf5ec0e`/`d86baac`/`abd5713` commits; `spacing-hold.dom.test.ts` present.

Commits per landed task, as now recorded in the plan's markers:

| Task | Commits |
|---|---|
| 1 | `8be1364 + 69e5121` |
| 3 | `a90bc43` |
| 4 | `cf5ec0e` |
| 5 | `d86baac` |
| 6 | `abd5713 + dd05235` |

The plan restored by `b1b99d6` is byte-identical to its pre-fold state `ea8f3fb`
(`git diff ea8f3fb HEAD -- <plan>` empty), so every stale citation below is a
pre-fold artifact — the plan was written against `a5f6ba8`, before Tasks 1/3/4/5/6
landed — not a restore error.

## Checks run

| Pass | Scope | Method | Result |
|---|---|---|---|
| 0 | Landed/unlanded split | ledger + `git merge-base`, `git log`, file presence | 5 landed / 5 remaining, as above |
| 1a | Repo-local citations, **unlanded** Tasks 2/7/8/9/10 | opened each cited file and re-read the cited line range | 16 stale refs found and fixed (Tasks 7, 8, 9, 10) |
| 1b | Repo-local citations, landed Tasks 1/3/4/5/6 | same, against `git show a5f6ba8:<path>` (the baseline the citations were written against) | 3 stale refs found and fixed (Tasks 1, 3) |
| 2a | Referenced paths, unlanded | classified each against the working tree | Task 7 and Task 9 each treated `tests/e2e/editor.spec.ts` and, in Task 7, `docs/evidence/screenshots/README.md` as untouched when both must be modified; task-local `- Modify:` lines added |
| 2b | Referenced paths, landed | same | all landed paths exist; no defect |
| 3 | Cross-plan interfaces | read `snap-manager/index.ts` (316 lines) end to end; `editor.spec.ts` `:13-96`, `:2089`, `:2875-2895`; `docs/evidence/screenshots/README.md:34`; `docs/product/requirements.md` §64/§175; `2026-09-24-editor-behaviour-review.md:14-21`,`:48-52` | `sceneToClient` `:45-57` and `clientOfScene` `:68-96` correct; `captureVisualReview` `:2875-2895` is file-scope and **not exported** (Task 9 assumption false — fixed); the registry has no `editor-snap-resize` row (Task 7 assumption false — fixed) |
| 3b | Fabric 7.4.0 behaviour | `node_modules/fabric/dist/src/EventTypeDefs.d.ts`, `index.mjs:3193-3199` / `:12633-12636`, `shapes/Object/defaultValues.mjs` | all claims hold (see "Checked and clean") |
| 4 | Internal self-consistency, per task | tests vs code, Files vs `git add`, step numbering, symbol names, Self-Review type paragraph | Task 7 Step 8 staged a directory (`…/scaling`) against AGENTS.md; Task 9's `git add '*snap*'` glob would also stage the guides capture; Task 8's `ScaleSnapModifiers` widening was only implied. All fixed |
| 5 | Fork citations `9efdd78a` | `git -C … show 9efdd78a:<path> \| wc -l` per named file; grep for symbols | all 16 named fork files exist with the stated line counts; `ScaleSnappingRuntime` has zero `ImageEditor` references; fork `scale-snapping-resolver.ts:332` is the Ctrl short-circuit |
| 6 | Repo guardrails | AGENTS.md rules applied to the plan text | directory staging removed, every `git add` now names files, no new brittle line numbers introduced, `renderer-core` untouched by the plan, one owner per constant (`scaling-snap-guard.ts`) preserved |

## Corrections applied (before → after)

**Banner / front matter**

1. No banner → `> **Queued plan.**` blockquote at `:3-13`: queued behind
   `2026-09-25-editor-viewport-and-mechanics.md` per `STATUS.md`; must not be
   executed until promoted; Tasks 1/3/4/5/6 landed; Tasks 2/7/8/9/10 remain; landed
   tasks are the record and must not be re-dispatched; the unticked boxes are the
   resume signal. Voice mirrors the sibling viewport plan's banner.
2. No audit record → `## Plan audit — 2026-09-26` at `:25`, 11-row
   `| Task | Correction |` table plus a "Checked and clean:" paragraph.

**Task 1** (`:79`, marker `:81`, all 7 step boxes ticked)

3. Step 3 showed a placeholder exclusion comment → shows the landed `IGNORED_IDS`
   comment naming the artboard plate, its real id `background` in
   `new-fabric-theme.ts`, and why exclusion is by id and not by `selectable`.
4. Step 5 teeth-check expectations were wrong → the real failures,
   `expected 98 to be 100.5` and `expected 160.5 to be 158`.
5. Step 6 cited `new-fabric-theme.ts` at the wrong range for `backgroundOnly` →
   `new-fabric-theme.ts:323-330` (eighth positional argument).

**Task 3** (`:369`, marker `:371`, 5/5 ticked)

6. `calculateSpacingSnap` described as present-but-unreferenced → Step 3 now records
   that it sat at `spacing.ts:1312`, was shown unreachable, and was deleted with the
   rest of the dead ports.
7. `distance.ts:32` for `resolveCommonDisplayDistance` was already corrected to the
   pre-deletion line; the type paragraph now also records the deletion.

**Tasks 4, 5, 6** (`:525` / `:778` / `:979`)

8. No changes beyond the landed markers (`cf5ec0e`, `d86baac`, `abd5713 + dd05235`)
   and ticking 6/6, 6/6 and 5/5 step boxes. Bodies left whole as the record.

**Task 7** (`:1126`, 0/8 ticked — remaining)

9. Files block listed only creates → added
   `- Modify: src/web/tests/e2e/editor.spec.ts (Step 7 — the resize capture test)` and
   `- Modify: docs/evidence/screenshots/README.md (Step 7 — its registry row)`.
10. Interface item 1 cited `:32-40` for `readMovementMarker` → `:63-76`; item 3 `:92`
    for `readMovementModifiers` → `:79-90` and its return type `{ readonly ctrlKey: boolean }`
    → `:79-90`; item 4 → `:123-140`; item 5 `:275-283` → `:74` + `:99` +
    `scale-projection.ts:12-16`; item 6 → `:124`.
11. Step 4 cited the wrong untyped-cast line for `as never` → `:301`; `mouse:up`
    binding → `:266`.
12. Step 7's capture anchor cited a non-existent helper → `editor.spec.ts:2089` (the
    `snaps a dragged object to a neighbour and shows a guide` case),
    `sceneToClient(page, 1280, …)` for the pointer points, and `README.md:34` for the
    registry row that must gain `editor-snap-resize`.
13. Step 8 staged the directory
    `git add …/snap-manager/scaling/` (AGENTS.md: stage explicit paths, never
    directories) → five named files, then a second `git add` for `editor.spec.ts`,
    the PNG and `README.md`.

**Task 8** (`:1365`, 0/6 ticked — remaining)

14. A clause claimed "the citation is off by two lines" — false → removed.
15. `scale-snapping-resolver.ts:626` was a **fork** line number (the modifier throw at
    fork `:626`; the port has it at `:729`) → replaced with the ported
    `scale-snapping-resolver.ts:332`, which short-circuits to the disabled plan
    exactly as `movement-snapping-resolver.ts:316` does.

**Task 9** (`:1440`, 0/5 ticked — remaining)

16. Files block listed only creates → added
    `- Modify: src/web/tests/e2e/editor.spec.ts (Step 5 — export captureVisualReview)`.
17. Step 5 assumed `captureVisualReview` was importable → it is file-scope and
    unexported (`editor.spec.ts:2875-2895`); the step now carries the export
    instruction. Its `git add '*snap*'` glob would also stage
    `editor-snap-guides-desktop-chromium.png` → the add now names
    `editor-snap-resize-desktop-chromium.png` explicitly and adds `editor.spec.ts`,
    with a paragraph recording why the glob is wrong.

**Task 10** (`:1506`, 0/7 ticked — remaining)

18. Step 2's two-title check was ambiguous → notes the second is a prefix match: the
    case at `display-fabric.spec.ts:671` is `is byte-stable at a fixed clock on one
    platform`.
19. Step 3's drop-branch note was stale → rewritten: Task 3 removed all dead ports,
    and `getObjectBounds` is live again
    (`scaling/scaling-step-snap-guards.ts:5,907,969,1269`).
20. Step 4 gained the review-doc line ranges `:14-21` and `:48-52`.
21. Step 6's `STATUS.md` description was written against an older tree → rewritten to
    the real current blockers: five `display-fabric.spec.ts` cases over the 30s
    default, untested hook entry points, the unverified layer-panel action row, and
    unverified text align/wrap/overflow — matching `STATUS.md:53-68`.

**Self-Review** (`:1593`)

22. Type-consistency paragraph → appended "; Task 2's guard does not read modifiers,
    so Task 7's widening is what serves Task 8".

Correction count by task: banner/front matter 2, Task 1: 3, Task 3: 2, Tasks 4–6: 0
(markers and ticks only), Task 7: 5, Task 8: 2, Task 9: 2, Task 10: 4, Self-Review: 1.
Total 21 text corrections, plus markers and ticks.

## Checked and clean (no change needed)

- Every fork path and line count in Tasks 2, 4, 5, 6 and 9: all 16 named files exist
  at `9efdd78a` with the stated lengths (fork `scale-snapping-resolver.ts` 1508,
  `scaling-step-snap-guards.ts` 1322, `rectangular-scale-gesture-projection.ts` 985,
  `standard-scale-control.ts` 88 …).
- Every `snap-manager/` line number in Tasks 1–6, re-verified against
  `git show a5f6ba8:<path>` — the commit those citations were written against.
- Fabric `EventTypeDefs.d.ts` keys (`object:modifyPoly`, `object:modifyPath`; no
  `object:scaled`), `index.mjs:3193-3199` and `:12633-12636`, `commonEventInfo`
  building `pointer: new Point(x, y)`, `_transformObject` passing the group-plane
  `localPointer`, and the CENTER default origin in `shapes/Object/defaultValues.mjs`.
- The fork's `index.ts` fallback chain, the `ScaleProjectionVariable` union, the
  fork `ScaleSnappingRuntime` having zero `ImageEditor` references, and the
  `pendingStep` throw at fork `:140`.
- The fork has no `src/utils/object-filter.ts`; the real path is
  `src/editor/utils/object-filter.ts`. The plan cites it only as prose inside landed
  Task 1, whose landed comment no longer names a fork path — left unchanged.
- Spec `2026-09-25-snapping-fidelity.md:85-93` correctly states the plate id is
  `"background"` while `"scene"` is a `paletteId`.

## Unverifiable

- `SPACING_CONTEXT_SWITCH_DISTANCE` (`constants.ts:6`) and
  `resolveCommonDisplayDistance` (`distance.ts:32`) no longer exist in the tree, so
  Task 3's citations can only be checked against `a5f6ba8`, not the working tree. I
  did that; the plan now records them in the past tense.
- The plan's Task 10 Step 3 blockquote claims two "landmines" in the fork's movement
  pipeline. The four cited fork line numbers (`:507` called `:499`, `:572` called
  `:503`, `:1098` called `:619`, `:550` called `:522`) are all accurate, which
  overstates the claim. Deliberately left unchanged — Task 10 is unlanded but the
  wording is judgement, not a citation, and rewriting it would be a scope change.
- Nothing in this audit ran the plan's tests or the app. Every claim above is static
  reading of source, plan text and git objects.

## Notes

- The brief's "do not create any file other than the plan" and its instruction to
  write this report conflict; this file is the explicitly named deliverable in both
  the brief and the coordinator's correction, sits in a git-ignored directory, and
  is the audit's own record, so it was written. No other file was created or changed.
- Scratch: one `cp -p <plan> /tmp/pt-owner.txt` under the OS temp area (outside the
  repository, possibly a silent no-op under Git Bash). No scratch file inside the
  repository.
