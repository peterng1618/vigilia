# Task 10 review: snapping and indicators at non-1 zoom

Reviewed range: `afbfb0b..b206070` (single commit `b206070`, 3 files, +234 −72).
Reviewer verified against source at HEAD, not against the report prose.

**Verdicts**

- **Spec compliance: COMPLIANT.** Every step, every named site and every teeth
  check in the brief is present and behaves as the brief requires. Nothing
  specified is missing; nothing invented beyond the brief's allowance.
- **Code quality: APPROVED.** No Important findings. Four Minor findings, all
  report/comment accuracy rather than behaviour.

Findings: **0 Important, 4 Minor.**

---

## Verified evidence (what I ran, not what the report says)

All teeth checks were re-run by me against the source, then reverted. Final
`git status --porcelain` shows only the pre-existing modified
`docs/evidence/screenshots/editor-desktop-chromium.png`; `git diff` over the two
production files and the two unit-test files is empty, so every break below was
restored.

| Break I applied to production source | Result I measured |
|---|---|
| `guide-renderer.ts:37` `GUIDE_WIDTH / zoom` → `* zoom` | `expected 0.5 to be close to 2` — fails on `zoom = 0.5`, the first iteration |
| `guide-renderer.ts:28` `guideBounds ?? …` → `…` | `expected 37.5 to be close to 720` — the brief's predicted `37.5` exactly |
| `guide-renderer.ts:41` `drawSpacingGuides` moved below the outer `restore()` | `expected 65 to be less than 59` |
| `indicator-manager/index.ts:100-101` `* canvas.getZoom()` | `expected '200 × 100' to be '100 × 50'`, other 13 cases green |
| `editor.spec.ts:56` old box-relative mapping restored | `Expected: > 100  Received: 40` and `Expected: "load-gauge"  Received: null` |
| `editor.spec.ts:56` box terms dropped, rect terms kept | both fail again (`null` / `resource-caption` family) |
| `selectStarterChart` click point moved to a near-miss | `Expected: "load-gauge"  Received: "gauge-caption"` |

`npm run typecheck`: clean, all 7 workspaces. Both unit files at HEAD: 19 passed.

Full desktop-chromium suite (which the implementer did not run): **81 passed,
2 failed, 2 skipped**. See M4.

---

## Q1 — do the new unit tests have teeth?

Four tests were added, not three: three in `guide-renderer.dom.test.ts` and one
in `index.dom.test.ts`.

1. **`guide-renderer.dom.test.ts:71` "keeps the hairline one screen pixel wide
   as the camera zooms" — teeth, confirmed.** Red on the first iteration
   (`zoom = 0.5`, reading `0.5` against `2`). Production change that kills it:
   `GUIDE_WIDTH / zoom` → `* zoom`, or anyone re-deriving the width outside the
   transform block. The `[0.5, 1, 2, 4]` loop is load-bearing — because the
   failure is on the smallest zoom, a change that only scaled *down* wrongly
   still trips it.
2. **`guide-renderer.dom.test.ts:90` "clamps guides to the given bounds rather
   than the viewport" — teeth, confirmed.** Red reading `37.5` against `720`.
   Production change that kills it: dropping the `guideBounds ??` preference at
   `guide-renderer.ts:28`, i.e. clamping to the viewport. `37.5` is
   `150 / 4` from the canvas's 300×150 backing store, so the test also implicitly
   pins that the spy's canvas is the small one.
3. **`guide-renderer.dom.test.ts:115` "paints spacing guides before the context
   is restored" — teeth, confirmed.** Red reading `65` vs `59`. Production
   change that kills it: moving `drawSpacingGuides` below the outer
   `context.restore()`. This is the one whose *earlier revision could not fail*,
   and the shape it now asserts (ordering, not `lineWidth`) is the correct one —
   `contextSpy`'s `restore` is a bare `vi.fn()` and nothing in the spacing path
   reassigns `lineWidth`, so a `lineWidth` read genuinely could not distinguish
   the two states. Q3 covers the counter values.
4. **`indicator-manager/index.dom.test.ts:174` "reports scene size rather than
   screen size when the camera is zoomed" — teeth, confirmed.** Red reading
   `'200 × 100'` against `'100 × 50'`, and the other 13 cases in the file stay
   green through the break — which is the whole point of adding it.

All four can fail. None is a tautology or an assertion on a value the code sets
to itself.

## Q2 — the mapping fix

**No box-relative pair remains, and the private camera copy is genuinely gone.**

- `Grep 'box\.(x|y|width|height)' src/web/tests/e2e/editor.spec.ts` at HEAD
  returns exactly one line, `editor.spec.ts:56`, and that line is inside
  `sceneToClient` itself — the single owner the brief asked for.
- The pre-state had the 14 lines / 7 pairs the brief predicted, at
  `1496`, `1758`, `1840`, `2053`, `2083`, `2115`, `2680`. All seven are gone;
  each is now a `sceneToClient` / `clientOfScene` call or (for the two blocks the
  brief said not to flatten) a local form dividing by `rect.width`/`rect.height`.
  Confirmed by reading the pre-state blob, not by trusting the report's table.
- **`panX`/`panY`: gone, not moved.** `grep -n 'panX\|panY'` returns nothing at
  HEAD. The old body — `Object.entries(window).find(([key]) =>
  key.startsWith("vigilia-fabric-editor-"))` → `viewportTransform` → `box.x +
  panX + zoom * x` — is replaced wholesale by
  `sceneToClient(page, 1280, x, y)` (`editor.spec.ts:1894-1896`). No second copy
  of the camera transform survives anywhere in the e2e tree: the only remaining
  `viewportTransform` reads in `editor.spec.ts` (`:2206`, `:2237`) are the
  pan-clamp test reading the transform *as the subject of its assertion*, not
  deriving a scene→client mapping, and `canvas-probe.ts`'s reads belong to the
  player spec.
- **Repointed sites compute the same points as the originals did when the canvas
  was the artboard.** `artboardScreenRect()` returns `left = vpt[4]`,
  `top = vpt[5]`, `width = board.width * scale` (`viewport-manager/index.ts:92-100`).
  Pre-Task-2 the canvas *was* the artboard, so `vpt` was `[zoom,0,0,zoom,ty,0]`
  with the element at the artboard's own page position: `rect.left/rect.top` and
  the canvas box summed to the same client point the naive form produced. The
  fix's real content is that the naive form is now wrong on both axes —
  `box.height` is the host's 594 where `rect.height` is `352`, and the naive form
  dropped `ty` entirely. Both drag tests confirm it end to end.

## Q3 — the unreproduced `invocationCallOrder` numbers

**The implementer's mechanism is correct, and the assertion has teeth. But the
report's conclusion that the brief's numbers "are not reproducible as written"
is too strong — I reproduced them exactly.**

Two measurements, same source, same test, differing only in whether the file's
earlier tests execute:

- `npx vitest run …guide-renderer.dom.test.ts -t "paints spacing guides"`
  → `stroke [10]` / `restore [27,44,45]` / `save [2,11,28]` at `zoom = 0.5`.
  That is the brief's `stroke [10]` / `restore [27, 44, 45]` **exactly**.
- Same file, all five tests running → `stroke [64]` / `restore [81,98,99]`,
  the implementer's number.

So `invocationCallOrder` is a global monotonic counter advanced by every mock
call in the run, and the brief's probe was taken with the file's earlier cases
not contributing. The implementer's explanation is right and I confirmed both
ends of it. Their "different spy method list" hypothesis is a red herring —
isolation alone accounts for it.

Does the assertion still have teeth? **Yes.** The load-bearing structure holds in
both orderings, and I broke the source to prove it: correct = the single spacing
stroke precedes the first `restore`; broken = the outer `restore` becomes the
first one and the comparison inverts (`65 < 59` false). The third counter
(`99` broken, `99` correct) is the label's inner save/restore pair and is
invariant, which is exactly what makes the *first* restore the discriminating
one. The test asserts ordering, never the absolute numbers, so the drift cannot
make it vacuous. This is the right outcome for a check whose earlier revision
could not fail.

## Q4 — duplication

**Finding M1 (Minor): the retained comment in the grouping test states a reason
that is false.** `editor.spec.ts:1705-1707` reads *"the local form stays because
the test needs a tuple and its own guard compares against `rect` directly"*. The
first half is true — `at` returns `[number, number]` and is destructured at
`:1750`. The second half is not: that test contains no `rect` guard at all. I
read every `expect` in its body (`:1680`–`:1821`); the only ones are the status
text, four `rowStyle` polls, `typeof before`, `childLeft` polls, `inCanvas` and
`groupPresent`. `rect` and `canvasBox` are used at `:1712-1713` and nowhere else.
The local pair is *correct as written* — a tuple plus a guard is a defensible
reason to keep it, and the test's real vacuity protection is
`expect.poll(active).toBe("child")` at `:1752`, which fails if the click selects
nothing — but the comment points a future editor at a guard that does not exist,
which is the shape of comment that gets a real guard deleted.

**Finding M2 (Minor): the report attributes that pair to the wrong test.**
`task-10-report.md:67-73` calls it *"the interaction-flags block (`keeps the
starter background unselectable after an undo`)"* and claims *"its `covers` guard
still compares a client coordinate against `rect.top + rect.height` in
canvas-relative form, so the local `rect` and `canvasBox` stay"*. The unselectable
test (`editor.spec.ts:1875`) has no `rect`, no `canvasBox` and no such guard: its
`at` delegates to `sceneToClient` (`:1894-1896`) and its `covers` (`:1917-1946`)
passes the point through `canvas.getScenePoint()` in client space. The pair the
report describes is in the *grouping* test (`:1613`), which the report never
names. This matters only as accuracy — the code is right either way — but it is
the same class of misattribution the brief warns about repeatedly, and it is why
M1's false rationale went unnoticed: the report believed the guard was somewhere
else.

**Is a second private camera copy still present?** No. Beyond the removed
`panX`/`panY` body, the surviving `Object.entries(window).find(…startsWith(
"vigilia-fabric-editor-"))` scans in `editor.spec.ts` (`:1903`, `:1923`,
`:1952`, `:1855`) read object identity, `selectable`/`evented` and chart
`option` — object state, not the camera transform. Repointing them is out of
this task's scope and none of them is a second owner of the transform.

## Q5 — scope: missing, unasked-for, unverified

**Nothing the brief specified is missing.** Walked the brief step by step against
the diff: three helpers added; all seven mapping pairs repointed; both
`artboardScreenRect()` blocks left unflattened per the brief's explicit
instruction; `selectStarterChart`'s precondition assertion added between the
click and `openInspectorTab` as required; the two Task-2-red tests repaired and
passing; both mapping teeth checks (including the second, subtler one); Step 2's
two tests; Step 3's test; Step 4's spy method and ordering test; no capture and
nothing registered; named paths staged, commit message as specified.
`guide-renderer.ts` and `indicator-manager/index.ts` are byte-identical to HEAD
— `git diff` is empty — which is correct, since both inspections found no defect.
I confirmed both verdicts independently by reading the source: `GUIDE_WIDTH /
zoom` inside the save/transform block (`guide-renderer.ts:32-44`) is right, and
`getScaledWidth()`/`getScaledHeight()` (`indicator-manager/index.ts:100-101`) is
right because Fabric excludes the viewport zoom from those.

**Nothing invented beyond the brief's allowance.** `quadraticCurveTo` on the spy
was explicitly requested. `expect.poll` for the precondition is the implementer's
choice of form where the brief specified only the assertion — it is the safer
form and it has teeth, as my near-miss break proved. The dead `canvas`/`box`
removal in the unselectable test follows from delegating its `at`. None of these
adds surface the brief did not ask for.

**Finding M3 (Minor): `clientOfScene` is not the "verbatim" copy the report
claims.** `task-10-report.md:63` says the helpers are "verbatim from the brief
(Biome reflowed `ArtboardRect` from one line to five, which is the only textual
difference)". `artboardRect` and `sceneToClient` are verbatim;
`clientOfScene`'s doc comment is condensed — the brief's measured-coordinate
paragraph (`112x88` at `left: 432, top: 418`, giving `(488, 462)` manual against
`(432, 418)` centred) is dropped. The surviving comment keeps the *claim* and
drops the evidence, so the reasoning is still there in weaker form. Harmless, and
the repo's brevity rule favours the shorter comment; only the report's "only
textual difference" statement is wrong.

**Finding M4 (Minor): the full desktop-chromium suite is red, and the
implementer did not run it.** The report's concern 4 says so honestly. I ran it:
**81 passed, 2 failed, 2 skipped**. Both failures are
`display-fabric.spec.ts:322 keeps repainting as samples arrive` and `:359 updates
live objects without recreating them`, failing at `canvas-probe.ts:167` with
`page.evaluate: Target page, context or browser has been closed` after
`page.clock.runFor(...)` — a fake-timer/teardown issue in the player spec.

These are **not caused by this diff**: it touches only `editor.spec.ts` and two
editor unit-test files, `editor.spec.ts` does not import `canvas-probe.js` or
`clock.js`, and the player bundle those tests run is untouched — the editor
bundle was also rebuilt (11:02 UTC) after the last production-source commit
(05:55 UTC), so the e2e runs exercised current code. I did not prove them
pre-existing on this branch, only independent of this commit. Does it matter for
this task? **For the task, no** — every site this commit touched was run and
passes, and the task's claim is arithmetic pinned by unit tests. **For the plan's
merge gate, yes** — the brief's own standard is that a red suite is a failure to
investigate, not to accept, and this commit's report leaves the count at "not
verified". Whoever closes the plan should attribute or fix those two before the
final gate.

---

## Summary

| # | Class | Site | Failure scenario | Evidence |
|---|---|---|---|---|
| M1 | Minor | `src/web/tests/e2e/editor.spec.ts:1705-1707` | Comment claims a `rect` guard that does not exist; a future editor trusting it could delete the real vacuity protection at `:1752` | Read every `expect` in `:1613-1822`; `rect`/`canvasBox` appear only at `:1712-1713` |
| M2 | Minor | `.superpowers/sdd/…/task-10-report.md:67-73` | Report names the wrong test for the retained `rect`+`canvasBox` pair and describes a `covers` guard the unselectable test does not have | The pair is in the grouping test (`:1613`); the unselectable test's `covers` uses `getScenePoint` in client space |
| M3 | Minor | `.superpowers/sdd/…/task-10-report.md:63` | "verbatim from the brief … the only textual difference" is false for `clientOfScene`'s doc comment | Diffed the committed comment against the brief's block; the measured-coordinate paragraph is dropped |
| M4 | Minor | `.superpowers/sdd/…/task-10-report.md:382-385` | Report leaves the desktop-chromium suite unverified; it is in fact red | Ran it: 81 passed, 2 failed (`display-fabric.spec.ts:322`, `:359`), independent of this diff |
