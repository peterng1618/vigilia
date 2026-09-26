# Task 10 re-review: M1/M2/M3 fix round

Scope: `b206070..a20d0de` (single commit, `src/web/tests/e2e/editor.spec.ts`,
3 insertions / 3 deletions, comment-only) plus the report's two extra amendments.

Reviewed against source at `a20d0de`, not against the report prose. M4 is out of
scope per the controller and is not re-raised.

**Verdicts: M1 RESOLVED. M2 RESOLVED. M3 RESOLVED. Loop CLOSES.**
New findings: **0 Important, 2 Minor** (N1, N2 — both accuracy, neither blocks).

---

## Q1 — M1, the retained comment

`editor.spec.ts:1705-1707` now reads:

```
// `rect` is canvas-relative, so the canvas box offset is added here. The
// local form stays because the call site destructures a tuple; the poll for
// `active === "child"` below is what stops a click on nothing from passing.
```

**(a) Tuple destructure — TRUE.** The grouping test (`:1613`) has exactly one
`at(...)` call site, `:1750` — `const [cx, cy] = at(55, 55);` — and `at` is typed
`(x, y) => [number, number]` at `:1711`. That is the destructure the clause
names. It is also the *only* reason for the shape: `sceneToClient` returns
`{x, y}`, so keeping the tuple is what the retained local form buys.

**(b) The `active === "child"` poll is what prevents the vacuous pass — TRUE.**
`at(55, 55)` is the test's only mouse-driven selection; `:1752` is
`await expect.poll(async () => (await state()).active).toBe("child")`. A click
landing on nothing leaves `active` `undefined`, the poll never converges, and the
test fails. Nothing else in the body could catch a missed click: the other five
polls are all `rowStyle`/`childLeft` on the layer rows and the object graph,
`inCanvas` (`:1798-1819`) compares `getObjects().includes(getActiveObject())` —
`false` when nothing is active, so `.toBe(true)` also fails, but *after* the
child poll and for a reason it shares with a legitimately-deselected state.
Calling the poll "what stops a click on nothing from passing" is right.

**(c) Other clauses.** One false clause remains, unexamined by this round:

> `editor.spec.ts:1705` — "`rect` is canvas-relative, so the canvas box offset is
> added here."

`rect` is not canvas-relative. `artboardScreenRect()` returns
`left = viewportTransform[4]`, `top = viewportTransform[5]`,
`width = board.width * scale` (`viewport-manager/index.ts:86-100`) — the
artboard rect *inside* the canvas element, while host-sized `canvasBox.x/y` is
where that element starts in the page. The canvas box offset is not "added to
`rect`"; `rect` is added to the box. The distinction is the whole point of the
same test's own comment 21 lines above (`:1684-1685`, "the canvas is host-sized,
so its box says nothing about where the artboard is").

Severity, and why not higher: the clause was **already present before this task's
commit** — it is byte-identical at `fb3aa92` (the commit that introduced the
grouping test) through `b206070` — so the fix round carried it forward rather
than writing it, and the arithmetic on `:1712-1713` is correct as written. It is
reported because M1's class is a comment pointing a future editor at a false
reason, and because it flatly contradicts a true comment in the same test. See
N1.

---

## Q2 — M2 and M3, against the diff and the brief

### M2 — the misattribution is gone, and the replacement is correct

`task-10-report.md:70-83` now names the **grouping** test (`enters a group, steps
back out, and survives an undo`) and says its `at` "returns `[number, number]`
and is destructured at `:1750`". Verified line for line in the committed source:

- grouping test starts `:1613`; `at` at `:1711`; destructure `:1750`; poll `:1752`.
- `rect` and `canvasBox` appear only at `:1708-1713` in that test — confirmed by
  enumerating every occurrence in `:1670-1822`; there is no other guard.

The stale "interaction-flags block (`keeps the starter background unselectable
after an undo`)" text is **absent** from the report (`grep` returns nothing) — no
residual contradiction. The unselectable test is now described correctly: it
starts `:1875`, its `at` delegates to `sceneToClient(page, 1280, x, y)` at
`:1894-1896`, and its `covers` guard (`:1917-1946`) passes the point through
`editor.canvas.getScenePoint({clientX, clientY})` in client space. It has no
`rect` and no `canvasBox` — confirmed.

### M3 — the "verbatim" claim is now true, and the honest correction is kept

Report `:61` narrowed to "`artboardRect` and `sceneToClient` are verbatim from the
brief", and `:62-67` now states the two textual differences and says of
`clientOfScene` "it is not 'verbatim'". Quote-check by token diff of the brief's
fenced block (`task-10-brief.md:33-110`) against the committed source
(`editor.spec.ts:13-93`): the token streams are **identical** apart from Biome
reflow of `type ArtboardRect` and the `window as unknown as {...}` cast
formatting, which the report names in the same paragraph. The earlier absolute —
Biome reflow "is the only textual difference" — is removed. The report is now
strictly more accurate than before, not merely differently wrong.

The amendment overshoots safely in the other direction: the condensation of
`clientOfScene`'s doc comment is not a *contradiction* — every surviving clause is
true (`getCenterPoint()` does convert from the object's actual origin; the
starter `chart()` does set `originX/originY: "center"`; the manual form does aim
at the bottom-right corner), and the dropped paragraph was evidence for a claim
the shorter comment still makes. The report flags the condensation itself, which
is the honest record. Report `:68` ("uses `getCenterPoint()` as instructed") is
true — `clientOfScene`'s body calls `object.getCenterPoint()`.

---

## Q3 — the two extra amendments (concerns 1 and 4)

**Concern 1 (`:388-394`) — accurate.** It reproduces the reviewer's finding
exactly: the brief's absolute counters are reproducible under isolation
(`-t "paints spacing guides"`), the discrepancy is isolation alone, both
measurements are right for their own invocation. This matches the review's Q3
conclusion and the brief's own numbers (`task-10-brief.md:356`, `stroke [10]` /
`restore [27, 44, 45]`). No new inaccuracy.

**Concern 4 (`:404-417`) — counts accurate; one causal claim is stronger than its
evidence (N2).** The counts are the reviewer's and are stated as such: 81 passed,
2 failed, 2 skipped; `display-fabric.spec.ts:322 keeps repainting as samples
arrive`, `:359 updates live objects without recreating them`; failure at
`canvas-probe.ts:167` with `page.evaluate: Target page, context or browser has
been closed` after `page.clock.runFor(...)`. All verified present in the review.

The wording "they do not import `canvas-probe.js` or `clock.js`" reads as if said
of the two failing tests; as written it is literally true of `editor.spec.ts`
(`:1-11`, imports only `@playwright/test`, `@vigilia/theme-package`, `fflate`).
Presence on disk and in another spec file is not an import, so no false clause —
but the clause is a coincidence presented as the independence argument. The
adjacent sentence ("did not prove them pre-existing on this branch") is the
adequate evidence statement. N2.

---

## Findings

| # | Class | Site | Failure scenario | Evidence |
|---|---|---|---|---|
| N1 | Minor | `src/web/tests/e2e/editor.spec.ts:1705` | "`rect` is canvas-relative, so the canvas box offset is added here" is false of `rect` (canvas-element-relative; `canvasBox.x/y` added *to* it), and contradicts the true comment at `:1684-1685` in the same test; a future editor trusting it could "fix" the sum to client space and reintroduce the off-canvas vacuity the test removes. Pre-existing since `fb3aa92`, carried forward by this round. | `viewport-manager/index.ts:86-100` (`left = vpt[4]`); `editor.spec.ts:1712-1713`; comment byte-identical at `fb3aa92` and `b206070` |
| N2 | Minor | `.superpowers/sdd/…/task-10-report.md:408-417` (concern 4 amendment) | States the two player failures are "a fake-timer/teardown issue in the player spec" as fact while the same paragraph concedes pre-existence was not proven; the cause is inferred from one error string plus `page.clock.runFor`, not demonstrated. Also offers the `canvas-probe.js`/`clock.js` non-import (true only of `editor.spec.ts`) as the independence argument. | Review M4; `editor.spec.ts:1-11`; `display-fabric.spec.ts:11-12`, `:345` |

Neither is a behaviour defect. Both are ledger/comment accuracy, the same class
as the three findings they follow.

## Still open (not this task's)

- M4's two red player tests remain unattributed-to-a-cause and unproven
  pre-existing; the controller owns them. The report's own amendment says so.

## Loop

**The fix loop can close.** 0 Important, 2 Minor. M1, M2 and M3 are resolved —
each rewritten clause checked against source, each report citation checked
against the committed file and the brief. N1 and N2 are strictly optional cleanups
of text; if the controller wants them, they are a one-line comment edit and a
two-sentence report edit, and neither reopens the verdict.
