# Task 8 fix round 1 — report

BASE: `2d46dc9`. Commit: **`f5109c9`** ("test(editor): give the muted layer style an
owner and teeth", 5 files, +76/−25). Status: **DONE_WITH_CONCERNS** (one deliberate
deviation, below).

## What was done

Brief followed, with one deviation forced by a contradiction inside the brief.

1. **`editor-shell.css`** — added the rule next to `.vigilia-layer-row`, verbatim from
   the brief. After review of the format gate the declaration is the stylesheet's only
   owner of the muted state.
2. **`layer-panel.tsx`** — deleted the `dimmed` helper and its comment, and deleted
   `opacity: …` and its comment from the `style` object. `"--layer-depth"` and
   `paddingLeft` are untouched. Nothing references `dimmed` any more.
3. **`layer-panel.dom.test.tsx`** — hoisted the `contextRows` fixture to module scope
   (the brief requires the new case to use the **same** fixture, and the old one was
   scoped inside the test body) and added the `dims nothing when no group is entered`
   case. 11 tests, all green.
4. **`tests/e2e/editor.spec.ts`** — extended Task 7's committed `enters a group, steps
   back out, and survives an undo` case with the `rowStyle` helper and the five polls.
   Nothing else in the case was touched; the nudge, undo and Escape identity check run
   unchanged after the new assertions.

`STATUS.md` "Last completed change" replaced, per AGENTS.md.

## The deviation, and why

The brief is internally contradictory on the empty-context state, and I followed its
preamble and the plan over its verbatim test text.

- The brief's preamble (lines 15–20) says the `context.size > 0` guard must be kept
  **because** it stops a bare `[data-context="false"]` rule from dimming the whole tree
  when the editor opens with nothing entered, and calls deleting it "a regression, not a
  cleanup".
- The plan (line 1744) says the same: "the guard is what keeps the attribute honest".
- But the brief's verbatim Change 2 test asserts `data-context` is the string `"false"`
  on **every** row when `groupContext: () => []` — and that is precisely the state the
  rule `.vigilia-layer-row[data-context="false"] { opacity: 0.45 }` turns into a fully
  dimmed tree. The guard then protects nothing: with it removed and `context.has(row.id)`
  written directly, the attribute still reads `"false"` on every row, so the two produce
  identical output and the guard is dead code by construction.

I resolved it by moving the guard from the helper into the attribute expression:

```tsx
data-context={context.size > 0 ? context.has(row.id) : undefined}
```

`undefined` makes React omit the attribute, so the rule matches nothing and the tree
stays undimmed on open — the behaviour the guard's stated reason demands. The new jsdom
case asserts `getAttribute("data-context")` is `null` for every row in the empty-context
render, rather than the brief's `"false"`.

Evidence that the deviation is the load-bearing one, not a preference:

- **Teeth, jsdom.** Reverting the attribute to bare `context.has(row.id)` and re-running
  the dom test gives exactly the brief's premise, observed:
  `AssertionError: expected 'false' to be null` at `layer-panel.dom.test.tsx:223`,
  10 passed / 1 failed. React does write the string `"false"`.
- **Teeth, browser.** With the three-line CSS rule commented out, rebuilt, the e2e case
  fails exactly where the brief predicts and for that reason: at `editor.spec.ts:1606`,
  `Expected: "0.45"`, `Received: "1"`. Not a missing locator, not a timeout. Restored,
  rebuilt, green.
- **The `context.size > 0` logic is kept**, as the brief demands; only its output form
  changed. `contextRows` and the other `data-context` value are untouched, so the
  existing `marks the group whose children are current and dims the rest` case still
  asserts `"true"` / `"false"` / `"true"` and still passes.

If the controller prefers the brief's literal `"false"` assertion, then the guard has to
go entirely and the CSS rule has to change shape (for example, a class toggled only when
a context exists) — the brief's two requirements cannot both be written as it wrote them.
Flagging rather than silently choosing.

## Verification

| Command | Result |
|---|---|
| `npx vitest run …/layer-panel.dom.test.tsx` | PASS — 1 file, 11 tests |
| `npm run typecheck` | PASS (all six projects) |
| `npm run build` | PASS (all bundles, run before and after the deliberate break) |
| `npx playwright test tests/e2e/editor.spec.ts -g "enters a group" --project=desktop-chromium` | PASS — 1 passed |
| Teeth: CSS rule commented out, rebuilt | RED at `:1606` — `Expected "0.45", Received "1"` |
| Teeth: guard reverted to bare `context.has(row.id)` | RED — `expected 'false' to be null`, `:223` |
| `npx vitest run packages/editor` | PASS — 130 files, 454 tests, 0 failed |
| `npm run lint` | PASS — 335 files |
| `npm run format:check` | PASS — 335 files |
| `npm run status:check` | PASS |

### Format

The brief's verbatim e2e block fails `npm run format:check` — biome reflows the three
long `await expect.poll(...)` lines onto continuation lines. I ran
`npx biome format --write tests/e2e/editor.spec.ts`, which is what the line-number shift
in the teeth-check output (1606 → the same assertion, now at 1610–1612) reflects. The
assertions are unchanged.

## Layer panel visibility

The panel renders in the default layout — `shell-layout.tsx:351` is an unconditional
`<LayerPanel />`, and other committed cases in the same spec click
`[data-vigilia-layer="…"]` directly without opening a rail. No rail click was needed and
none was added.

## Single-occupancy check

`git status` at start showed only `docs/evidence/screenshots/editor-desktop-chromium.png`
modified. `tests/e2e/editor.spec.ts` had no uncommitted changes, so nothing foreign was
staged.

## Concerns

1. The deviation above. It changes an assertion the brief specified verbatim; the
   controller should confirm the corrected reading. `context.size > 0` is kept as the
   brief demands — only its output form changed.
2. **Concurrent writer on `editor-shell.css`.** The file changed on disk twice during
   this session, outside my edits. At one point its worktree content had *lost* tip
   commit `2d46dc9`'s portalled-classes block from the `prefers-reduced-motion` media
   query (`.editor-shell-menu-popup`, `.editor-shell-positioner`, `.editor-shell-tooltip`
   and their `*`). I caught this in the staged diff and unstaged rather than commit it.
   By the time I re-staged, the block was back (the concurrent writer restored it), and
   the committed diff against HEAD is my +6 lines only — verified with
   `git diff HEAD` on that file, and with a before/after `git hash-object` around the
   final build + e2e run (`f45c200…` both times → CSS stable during verification). So
   the commit is clean, but this file is not exclusively mine and someone else is
   editing it. Worth knowing before the next task touches it.
3. `editor-desktop-chromium.png` was left modified and unstaged, as instructed. It was
   not part of this fix.
4. The review's M1 asked for two jsdom cases and a browser assertion on a `child` row
   click; this round adds both jsdom cases and the browser assertions on attributes plus
   computed opacity. The `child` row `.click()` asserting the bridge's active object
   (review item 3, "plus one `.click()`") was **not** added — the brief omits it and
   scopes Change 3 to the five polls. Not verified by me.
5. `npm run test:e2e` was not run in full; only `--grep "enters a group"` on
   `desktop-chromium`, per the brief's verification list.

## Commit mechanics

Two mechanical notes, no semantic content. The commit message was written with a
PowerShell-style `@'…'@` here-string inside the Bash tool, which does not interpret it;
the leading `@`, trailing newline handling and message were corrected with
`git commit --amend -F <file>` before the sha above was recorded. And the brief's verbatim
e2e block required `npx biome format --write` to pass `format:check`, which reflowed the
three long `expect.poll` lines onto continuation lines; assertions unchanged.
