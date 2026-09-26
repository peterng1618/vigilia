# Task 2 fix round — brief

Two findings survived adjudication of the Task 2 review. Both are small and both
are in files you have already read.

**Do not re-run the full gate.** Focused tests only; Task 11 owns the broad gate.

---

## Fix 1 — the `getWidth()` assertion is vacuous, and its comment is now false

`src/web/packages/editor/src/editor-shell.dom.test.ts`, the test
`"exposes a camera over the mounted canvas"` (around `:212`).

The fixture mounts a **1000×800** host against a **1280×720** artboard. At fit
scale that is `min(1000/1280, 800/720) = 0.78125`, so the *fitted* canvas is
`1280 × 0.78125 = 1000` wide — **exactly the host width**. The assertion
`expect(shell.editor.canvas.getWidth()).toBe(1000)` therefore cannot distinguish
"canvas is host-sized" from "canvas is artboard-sized and then fitted", which is
the single regression this test exists to catch.

The comment above it is also now false:

```
// The canvas fills the host, not the artboard: 1280x720 fitted into 1000x800
// would be a 1000px-wide canvas, and it must no longer be.
```

1000 **is** what a fitted canvas would be, so the comment argues for the wrong
thing.

**Fix: change the fixture so the two disagree.** Use a host of **1000×400**.
Fit scale becomes `min(0.78125, 0.5556) = 0.5556`, so a fitted canvas would be
**711×400** while a host-sized canvas is **1000×400** — the width assertion now
discriminates, and the height assertion stays honest.

- Change `clientHeight` from `800` to `400`.
- Update the two expectations to `1000` and `400`.
- Rewrite the comment to state the real distinction, e.g. "A canvas sized to the
  artboard would be 711 wide at this host's fit scale; it must fill the host
  instead."
- Keep the `viewport.zoom() > 0` line as it is.

**Do not delete either dimension assertion** — with the new fixture both have
teeth.

### Teeth check (required)

Set `clientHeight` back to `800` and confirm the width assertion now passes
*vacuously* is **not** what you want to observe; instead confirm the new fixture's
width assertion fails if the canvas is sized to the artboard. The cheapest proof:
temporarily change the expectation to `711` and confirm it fails with
`expected 1000 to be 711`, then restore. Report the exact output.

---

## Fix 2 — `setFitMode` advertises a parameter it ignores

`src/web/packages/editor/src/editor-shell.ts:78` declares
`setFitMode(fitMode: FitMode): void`, and the implementation at `:438` is
`setFitMode() { … }` — the parameter is dropped. TypeScript accepts this, so a
future caller passing `"cover"` compiles and is silently ignored.

**Verified: there are no callers.** A workspace-wide search for `setFitMode`
returns exactly two hits, the declaration and the implementation. Nothing in
`editor-session.ts`, `session-facade.ts`, `shell-layout.tsx`, tests or the e2e
suite calls it.

The editor's behaviour is correct and intended — the authoring view always frames
the whole board, and `cover` is the *player's* crop, which the stage does not
draw. So the method's *body* is right; only its *signature* lies.

**Fix: drop the parameter.**

- `editor-shell.ts:78`: `setFitMode(): void;` — remove the parameter.
- Keep the implementation and its comment unchanged.
- Check whether `FitMode` (imported at `editor-shell.ts:6`) becomes unused. It is
  currently referenced only by that now-removed parameter, so the import must go
  too — otherwise `npm run lint` reports it. Verify with `grep -n "FitMode"` on
  the file before and after.
- Fix the doc comment above the implementation so it no longer refers to a
  parameter: it should say the editor always frames the whole board and that
  `cover` is the player's crop.

Do **not** delete the method as a "dead code" cleanup — it is the public shell
interface's fit hook and Task 4/5 build on the shell. Only the parameter goes.

**`Author's fitMode is not this method's concern, and stays where it is:**
`artboard-panel.ts:78` writes `fitMode` into the authored artboard, which the
player consumes. Do not touch it.

---

## Verification

From `src/web/`:

```bash
npx vitest run packages/editor/src/editor-shell.dom.test.ts
npm run typecheck
npx biome lint packages/editor/src/editor-shell.ts packages/editor/src/editor-shell.dom.test.ts
npx biome format packages/editor/src/editor-shell.ts packages/editor/src/editor-shell.dom.test.ts
```

All must be clean. `npm run format:check` is the repo-wide gate and Task 11 owns
it, but your two files must format clean in isolation.

## Commit

```bash
git add src/web/packages/editor/src/editor-shell.ts \
  src/web/packages/editor/src/editor-shell.dom.test.ts
git commit -m "test(editor): pin host-sized canvas against a fitted one"
```

## Report

Write your report to
`.superpowers/sdd/2026-09-25-editor-viewport-and-mechanics/task-2-fix-report.md`
and return only: status, commit SHA, a one-line test summary, and any concerns.

**Record the base commit you started from** (`git rev-parse HEAD`) in the report —
the review diff is built from it. It must be Task 3's commit, not `7c427ee`.
