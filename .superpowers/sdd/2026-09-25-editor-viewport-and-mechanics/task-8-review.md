# Task 8 review: the layer tree follows the group context

Commit reviewed: `da5f0b2` (+115/−15, 6 files). Working tree during review held only
the unrelated `editor-desktop-chromium.png` modification, left untouched.

## Verdicts

**Spec compliance: PASS**, with two documented interpretation gaps (one Important,
one Minor). Every step of the brief is present and pinned by a test: the
`EditorShellBridge.groupContext()` ids projection (brief:51–53), `data-context` on the
group *and* descendants (brief:59), the muted outside rows (brief:59), and the single
new `selectLayer` branch with owning-group resolution intact everywhere else
(brief:61–63). The brief's own test (brief:14–36) was transcribed faithfully and does
fail before the fix and pass after.

**Task quality: GOOD.** The bridge boundary is right (ids, never Fabric objects), the
`selectLayer` branch is minimal and object-identity-based, and both new tests have real
teeth — I re-derived that myself rather than taking the report's word. Four defects,
none Critical: the muted style is untested and can be deleted with the suite green,
the empty-context reading is an unpinned interpretation, `contextRows` is a whole
function for a three-line pass, and `STATUS.md` was edited outside the task's scope.

## Findings

### Critical

None.

### Important

**I1. The muted half of the requirement has no test, so it can be deleted with the
suite green.**

- Where: `src/web/packages/editor/src/editor-shell/layer-panel.tsx:213` —
  `opacity: dimmed(row.id) ? 0.45 : undefined`; no test anywhere asserts it.
  `grep -rn opacity src/web/packages/editor/src/editor-shell/*.test.ts*` returns nothing;
  the new test (`layer-panel.dom.test.tsx:190–205`) asserts only the three
  `data-context` attributes.
- Evidence: I deleted the `opacity:` line from the real file and re-ran
  `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx` →
  **1 passed, 10 tests passed**. The visible half of "dims the rest" (brief:59) is
  therefore unprotected, and AGENTS.md's "a new regression test should fail when the fix
  is disabled" is not met for it.
- Why it matters: the brief's test excludes opacity deliberately (it queries
  `data-context`), so the only thing standing between a future refactor and a silently
  undimmed tree is that nobody notices. This is not theoretical — the very
  review-requested change to make it a stylesheet rule (I2 below) would be a pure
  deletion of this line from TSX, and would look safe under the current suite.
- Fix: with the attribute already on the row, move the declaration to
  `editor-shell.css` next to `.vigilia-layer-row` (which already owns
  `padding-left: calc(6px + var(--layer-depth, 0) * 13px)`, so the inline/CSS split is
  half there already):

  ```css
  .vigilia-layer-row[data-context="false"] { opacity: 0.45; }
  ```

  and delete both the `opacity:` property and the now-unused `dimmed()` helper from
  `layer-panel.tsx`. That is net-longer JSX by −4 lines, moves the magic number into the
  file that owns the visual language, and — the reason it is Important rather than
  cosmetic — lets `npm run test:e2e` or a capture pin the muted state, which an inline
  style on a per-render object cannot be pinned by as cleanly. Whichever location is
  chosen, add one assertion to the jsdom test
  (`expect(host.querySelector('[data-vigilia-layer="other"]')?.style.opacity).toBe("0.45")`)
  so the muted half has teeth.

**I2. The `opacity: 0.45` inline declaration is a real defect, not an acceptable
trade** — with the qualification that it is a *symptom* defect (untestable, two styling
owners) rather than a wiring error. The row's existing inline entries
(`"--layer-depth"` at `layer-panel.tsx:209` and
`paddingLeft: "calc(6px + var(--layer-depth) * 13px)"` at `:210`) are values *handed to*
CSS, with the actual declaration (`padding-left`) living in `editor-shell.css:466`. The
new `opacity` is different in kind: it is a declaration, and the attribute it would key
on (`data-context`) is already rendered at `:147`. The implementer's stated reason — 
`editor-shell.css` had another task's changes in flight — is now expired: the CSS file
was committed as `66506e6` and **before** `da5f0b2`, so it was clean at commit time.
The three-file scope was real, but the correct resolution was to ask, not to put a
visual declaration in a second owner. Fix folded into I1.

### Minor

**M1. `dimmed()`'s empty-context guard is an unpinned interpretation, and it is the
one place a controller and implementer could disagree after the fact.**

- Where: `layer-panel.tsx:108–109` — `context.size > 0 && !context.has(id)`.
- Adjudication: **the guard is correct for an author working in the editor.** Every
  operation that empties the context (`exitGroup` at `grouping-manager/index.ts:165–175`
  via Escape, `ungroup` at `:129`, a fresh load) leaves no entered group, and with no
  group entered every top-level layer *is* selectable on the canvas; dimming all of them
  would make the tree announce "unreachable" about rows that are perfectly reachable.
  The literal reading (dim every row not in the context) is only coherent if "the
  context" means "the entered group", which is exactly the implementer's reading — so
  the disambiguation is the correct one, expressed in the wrong place (a JS guard rather
  than the CSS rule above, which returns nothing for an absent attribute and therefore
  needs no guard).
- The brief's test *is* too weak to decide this: it uses a non-empty context
  (`groupContext: () => ["group"]`) and asserts nothing about the empty case, so both
  readings pass. Fix: one extra case in `layer-panel.dom.test.tsx` rendering the same
  rows with `{ groupContext: () => [] }` and asserting no row is dimmed; with the stylesheet
  form that is `[data-context="false"]` never matching, and the assertion is a one-liner.
- **Related, worth stating explicitly rather than leaving implicit:** the strip
  also has a parameter the contract does not document for this task — whether the
  entered group's *selection* is visible. In the verified browser run `child` had
  `data-context="true"` and `data-selected="true"`, and the entered group row itself is
  not selected. That is Task 7's `enterGroup` selecting the child, not this diff.

**M2. `contextRows` is a whole function for a three-line pass, and it is a second
implementation of a tree walk `layer-tree.ts` already owns** (the ownership map puts
"semantic layer projection" with `layer-tree.ts`, `docs/architecture/ownership.md:23`).
It correctly uses the projection's own `parentId`/`order` contract rather than Fabric,
so it is not a *parallel scene tree* — but the projection could expose the subset
instead. Not worth changing in this task; note it as the natural refactor if a second
caller ever wants the context subset.

**M3. `STATUS.md` was edited although the brief's commit command (brief:73–76) stages
only the three source files.** AGENTS.md's own standing rule is to replace the
"Last completed change" block, so this is the higher-priority instruction and the edit
is correct — the finding is only that the diff's file list diverges from the brief's
literal commit. No action; recorded so the deviation is not later read as scope creep.

## The four flagged items, adjudicated

1. **Inline `opacity`** — real defect, Important. See I1/I2. Inline is *not* the
   established pattern for declarations (only for values handed to CSS), the attribute
   to key on already exists, and the cross-task conflict that justified it was resolved
   before this commit landed.

2. **"The context" = the entered group only** — **the implementer's reading is
   correct.** With no group entered, no row is unreachable, so nothing should dim; the
   literal reading would grey out the entire tree and assert the opposite of the truth.
   The brief's test is too weak to decide it (non-empty context only, no empty-case
   assertion) — so yes, the reading needed a test of its own, which is M1. The place is
   wrong, though: `context.size > 0` is redundant once the rule is
   `.vigilia-layer-row[data-context="false"]`, which matches nothing when the attribute
   is absent.

3. **Browser verification from a deleted temporary spec** — the *evidence* is sound as
   far as it goes (I traced its four claims into the real code: `grouping-manager/index.ts:159`
   records the context before `:160`'s `setActiveObject`, and Fabric's
   `_fireSelectionEvents` at `node_modules/fabric/dist/index.node.cjs:11405–11451` fires
   `selection:created` synchronously from `setActiveObject` at `:11456–11460`, so the
   tree is genuinely not one render stale; I also probed `loadFromJSON` and confirmed it
   fires `selection:cleared` at the clear step, so an undo path notifies too). What is
   consequently **unverified** is the commit's own visible outcome: `data-context` on a
   real row, the child-selectable-in-context path through a real click, and the dimmed
   rendering. None of the four claims is reproducible from the repository.
   **A committed test is warranted**, and the cheap form is not a new e2e file: Task 7's
   committed `editor.spec.ts` "enters a group, steps back out, and survives an undo"
   (lines 1420–1605) already has the `grouping.vigilia-theme` fixture, the camera-mapped
   `at(x, y)`, and a landed `mouse.dblclick`. Three assertions on its existing `grp` /
   `child` / `outside` rows — `data-context` on the first two, `data-context="false"` plus
   a computed opacity on `outside` — plus one `.click()` on the `child` row asserting the
   bridge's active object, would close all three gaps inside a test that already runs.

4. **CRLF** — **clean; no churn.** I byte-counted every file in the commit, restoring the
   working-tree files after my mutations: `bridge.ts` CR=0/LF=308, `layer-panel.tsx`
   CR=0/LF=335, `bridge.dom.test.ts` CR=0/LF=437, `layer-panel.dom.test.tsx` CR=0/LF=306,
   `shell-layout.dom.test.tsx` CR=0/LF=234, `STATUS.md` CR=0/LF=53. `git ls-files --eol`
   reports `i/lf w/lf` for all of them, and `git show --stat da5f0b2` matches the
   controller's +115/−15 across 6 files — proportionate to the semantic change, no
   whole-file rewrite. A repo-wide scan of tracked files found CRLF only in `LICENSE`,
   `src/web/packages/host/bin/vigilia.js`, `src/web/packages/player/index.html` and
   `player/public/assets/thermometer.svg` — none of them touched by this commit, so
   nothing was left mixed *by it*. (Those four pre-date the task; `bin/vigilia.js` is a
   shipped executable, so whether `.gitattributes` should exempt it is a separate
   question, not this review's.)

## Checks performed

| Check | Result |
|---|---|
| Focused `vitest` — `layer-panel.dom.test.tsx` + `bridge.dom.test.ts` | PASS — 2 files, 33 tests |
| `npm run typecheck` | PASS (player, editor, fake-source, host) |
| `npx biome lint packages/editor/src/editor-shell` | PASS — 11 files |
| `npx biome format packages/editor/src/editor-shell` | PASS — 11 files |
| `npm run status:check` | PASS — exit 0 |
| Teeth: fix disabled (`data-context` always true) | RED — `expected 'true' to be 'false'` at the `other` row |
| Teeth: descendant walk removed (`new Set(entered)`) | RED — `expected 'false' to be 'true'` at the `child` row (`:204`) |
| Teeth: `selectLayer` branch removed | RED — `bridge.dom.test.ts:239`, received the group instance |
| Teeth: `opacity:` line deleted | **GREEN — 10 passed.** The muted half is untested (I1) |

Mutations were applied to the real files, observed, and reverted from a temp-dir backup;
`git status` afterwards shows only the pre-existing `editor-desktop-chromium.png`
modification and an unrelated untracked `snap-manager/spacing-hold.dom.test.ts` that is
not mine.

## Point-by-point answers to the requested checks

- **`data-context` on the group and descendants** — yes, `layer-panel.tsx:147`. The
  descendant half is real, not assumed: I rendered a depth-3 fixture
  (`group > mid > leaf`) with `groupContext: () => ["group"]` and the grandchild came
  back `data-context="true"`, the non-descendant `"false"`. `contextRows` needs its
  single forward pass to hold only because `projectLayers` pushes a row before
  recursing into its children (`layer-tree.ts:91` then `:105–106`) *and* the panel
  renders `rows` in that order (`layer-panel.tsx:133`). The function's own comment
  states the invariant but nothing enforces it; the depth-3 behaviour is not in the
  committed test either, so a future reordering of the projection would silently
  flatten the context to one level with the suite green. Cheap closure: assert the
  grandchild in the panel test.
- **Collapsed ancestors** — yes, `contextRows` can only mark rows present in `rows`, and
  a collapsed group's children are not projected, so an entered sub-group behind a
  collapsed ancestor is unmarked. **This does not matter**, and it is self-correcting:
  the entered group's row itself carries the true `data-context="true"` ancestry via its
  own `parentId` only if that parent is present, so a row is marked exactly when the
  panel is showing it as part of the context; and `setCollapsed` calls `notify()`
  (`bridge.ts:195`), so expanding that ancestor re-projects and the descendants appear
  marked on that same render.
- **`selectLayer` cannot select a bare child outside the context** — confirmed by
  reading the branch: `inContext` (`bridge.ts:163`) requires `owner !== undefined` and
  `enteredContext().includes(owner)` where `enteredContext()` is the manager's own
  object array (`:131–132`); the fall-through is `owner ?? target` (`:164`), identical to
  the pre-change expression. The one case where `enteredContext()` is non-empty but the
  clicked child is outside it falls through to the owning group. The pre-existing test
  (`bridge.dom.test.ts:212–217` region, "selects a group child through its owning group")
  still passes, and the new test fails when only the branch is removed — verified.
- **Context read at render re-renders on change** — yes, for the paths that matter.
  `enterGroup` records the context before `setActiveObject` (`grouping-manager/index.ts:159`
  before `:160`), which fires `selection:created` synchronously
  (`index.node.cjs:11456–11460`), which the bridge subscribes to (`bridge.ts:90`), which
  the store turns into a fresh `bridge.layers()` and a publish
  (`layer-panel.tsx:43–46`) — so `bridge?.groupContext()` at `:105` sees the new context
  in the same synchronous turn. I also probed the two non-`setActiveObject` routes:
  `loadFromJSON` fires `selection:cleared` at its internal `clear()`
  (`index.node.cjs:11576–11578`), which covers the undo restore, and `exitGroup`
  re-selects a different object with `setActiveObject`, which Fabric only fires when the
  active object actually changed (`:11457`) — it did. Residual, self-healing edge: if
  `ungroup()` is ever called through a path that does not also fire a selection event,
  `context = []` at `grouping-manager/index.ts:129` would publish nothing and the tree
  would stay marked until the next unrelated notify. The current Escape/`ungroup`
  shortcut path replaces the active object, so it notifies; not worth code.
- **New tests fail with the fix disabled** — confirmed for the attribute logic and the
  `selectLayer` branch (see the teeth table). Confirmed **not** to fail for the muted
  style (I1).

## What is not verified

- The four browser claims of the report are a transcript; I did not re-run a browser
  (the temporary spec is gone and the preview bundle would need a rebuild). Their
  mechanism is code-traced above and consistent, but the rendered outcome is
  reproduced-nowhere. That is flag 3's fix (fold the assertions into the committed e2e
  test), not a contradiction found.
- I did not run the full `npm test` or `npm run test:e2e`; the focused files,
  typecheck, lint and format were run.
