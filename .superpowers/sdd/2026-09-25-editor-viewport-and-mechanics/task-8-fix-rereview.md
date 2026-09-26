# Task 8 fix round 1 — scoped re-review

Scope: did `f5109c9` close the original review's findings, and did it introduce
anything new. Commit inspected: `f5109c9` (5 files, +76/−25), parent `2d46dc9`.
Working tree left exactly as found: only `docs/evidence/screenshots/editor-desktop-chromium.png`
modified (pre-existing, untouched).

## Verdicts

**All findings addressed: YES**
**No new load-bearing findings: YES**

New findings: 0 Critical, 0 Important, 2 Minor (one pre-existing and surfaced,
one introduced by the new test's shape; neither load-bearing).

## Findings addressed

### I1 — the muted style had no test and could be deleted with the suite green: CLOSED

Both legs have teeth, re-run independently by me.

**(a) Browser leg.** I commented out the `.vigilia-layer-row[data-context="false"]`
block in `editor-shell.css`, ran `npm run build`, then
`npx playwright test tests/e2e/editor.spec.ts -g "enters a group" --project=desktop-chromium`.
Result: **1 failed**, exactly as claimed, and at the claimed assertion:

```
expect(received).toBe(expected) // Object.is equality
Expected: "0.45"
Received: "1"
Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
  at D:\git-repos\vigilia\src\web\tests\e2e\editor.spec.ts:1612:8
```

`:1612` is `await expect.poll(async () => (await rowStyle("outside")).opacity).toBe("0.45")`
— the outside row's computed opacity. Not a missing locator, not a timeout on a
locator; the rule's effect is what disappeared. I restored the CSS, rebuilt, and
re-ran: **1 passed**. The report's claimed failure mode is accurate.

**(b) jsdom leg.** I reverted the attribute to `data-context={context.has(row.id)}`
and ran `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx`.
Result: **1 failed | 10 passed**, with:

```
FAIL  ... > dims nothing when no group is entered
AssertionError: expected 'false' to be null
  Expected: null
  Received: "false"
  at layer-panel.dom.test.tsx:223:46
```

Exact match for the claim: React writes the string `"false"`, and the new case
notices. I restored `layer-panel.tsx`; `git hash-object` now returns
`5fab78fa70846f5516a44d17e1ae3986e9c2d41f`, identical to
`f5109c9:src/web/packages/editor/src/editor-shell/layer-panel.tsx`. The CSS
restore hashes to `f45c200c74e899c42dc6a76c005e89ca561ce1f5`, identical to the
committed blob. `git status` afterwards shows only the pre-existing PNG.

So the muted half now fails when the fix is disabled on **both** legs, which is
what AGENTS.md requires and what the original review found missing.

### I2 — inline `opacity` declaration, two styling owners: CLOSED

The declaration is gone from `layer-panel.tsx` (grep for `opacity` and `dimmed`
in that file returns nothing; the only context-related lines are `contextRows`
at `:80`, its call at `:105`, and the attribute at `:148`). The rule lives at
`editor-shell.css:493`, next to `.vigilia-layer-row` at `:480`, which is the
file's own visual-language owner. `"--layer-depth"` and `paddingLeft` are
untouched, which is right: those are values handed to CSS, the declaration stays
in the stylesheet.

### M1 — the empty-context reading was unpinned: CLOSED

The new case `dims nothing when no group is entered` (`layer-panel.dom.test.tsx:208–224`)
is a second case, uses the same `contextRows` fixture (hoisted to module scope as
the brief required, `:186–195`), and asserts `null` on every row. The unpinned
interpretation the review flagged now has a test.

### Review item 3's `child` row `.click()` — NOT implemented

Adjudication: **not load-bearing for the `selectLayer` branch.** The branch has
direct coverage at `src/web/packages/editor/src/editor-shell/bridge.dom.test.ts:225`
— `it("selects the child itself when its group is the entered context")`, which
builds a real `Group([child])`, passes
`{ groupingManager: { groupContext: () => [group] } }`, calls
`bridge.selectLayer("child")` at `:238` and asserts `setActiveObject` received
`child`. `git log -S` confirms that test came in with `da5f0b2`, the original
Task 8 commit, so the branch is pinned independently of the browser click.

What the omission does leave uncovered is a different layer — see Minor 1 below.
The fix report's statement that the brief scoped Change 3 to the five polls is
accurate: `task-8-fix-brief.md:93–115` lists exactly the five assertions and
nothing else.

## The deviation adjudicated: the attribute-omission form is correct

**Yes — omitting the attribute is genuinely better than writing `"false"` and
guarding in a helper.** Judged on merit, not on the `874dc08` amendment.

**It survives the re-render concern.** I probed React 19.3.0 in this repo's jsdom
against a component alternating `undefined` / `true` / `false`:

```
1 absent       {"attr":null,"has":false,"outer":"<div class=\"r\">x</div>"}
2 true         {"attr":"true","has":true,"outer":"<div class=\"r\" data-context=\"true\">x</div>"}
3 false        {"attr":"false","has":true,"outer":"<div class=\"r\" data-context=\"false\">x</div>"}
4 absent again {"attr":null,"has":false,"outer":"<div class=\"r\">x</div>"}
5 true again   {"attr":"true","has":true,"outer":"<div class=\"r\" data-context=\"true\">x</div>"}
react 19.3.0
```

Absent → present → absent removes the attribute cleanly, so the enter/exit-group
round trip leaves no stale `"false"` behind. There is no transition case where
the rule fires on a row it should not.

**The CSS side needs no guard either.** An absent attribute does not match
`[data-context="false"]`, so the rule returns nothing for a row with no context,
which is the behaviour the guard exists to produce. The condition was moved, not
deleted — exactly the right correction to the original review's suggestion, which
was right that the *rule* needs no guard and wrong that the condition could
simply go.

**Why omission beats `"false"`-plus-guard.** With the guard in a helper the DOM
cannot distinguish "no group entered" from "a group is entered and this row is
outside it" — both read `"false"`. The rule then dims both, so the guard lives in
JS and the rule lives in CSS with *contradictory* readings of the same value, and
the only thing keeping them consistent is that they agree. That is the two-owners
defect I2 was about, moved rather than fixed. With the condition in the
attribute, "no context" and "outside context" are two distinct DOM states, one
fact each, and the rule reads the one it means. `data-context="false"` on a row
that is not outside any context is also simply false as an assertion, so the
guarded form writes a lie into the DOM to avoid a rule that would then believe it.

**Consumers.** I grepped every tracked file for `data-context`: the CSS rule, the
panel, the two test files, the e2e spec and planning/status prose. Nothing else
reads it — no analytics, no serialisation, no other stylesheet — so omitting it
cannot starve a second consumer.

**Where it could misbehave, and does not here.** A future consumer reaching for
`:not([data-context])` would get the empty-context rows too, and a consumer
written against the guarded form would have to change. The single real consumer
keys on the value `"false"`, which is written on every outside row in the
ordinary case, so the rule still matches: the earlier assertion at
`layer-panel.dom.test.tsx:202` on the `other` row still reads `"false"` and still
passes (verified in the green run). No misbehaving case found.

## New findings

### Minor 1 — the panel's row `onClick` → `selectLayer` wiring has no coverage on either leg

Pre-existing and surfaced by this re-review rather than introduced by it, but it
is the layer the omitted browser click would have covered, so it belongs here.

- Where: `src/web/packages/editor/src/editor-shell/layer-panel.tsx:214` —
  `onClick={() => store.mutate(() => bridge?.selectLayer(row.id))}`.
- Evidence: I changed it to `bridge?.selectLayer(row.id + "X")` and ran
  `npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx` →
  **1 passed, 11 tests passed**. Not one jsdom case clicks a row to select.
  `layer-panel.dom.test.tsx:323` asserts `selectLayer` was *not* called, and `:266`
  builds the mock to prove a refused drop does not select — neither ever asserts a
  positive call. The browser side has no row click into the entered context either.
- Why it matters: small. The bridge-side branch is pinned
  (`bridge.dom.test.ts:225`) and five other e2e cases click layer rows and assert
  a downstream effect, so a wholesale break would be caught. But `selectLayer`
  receiving the clicked row's own id is asserted nowhere, and the fix round had
  the natural place for it — the `child` row click review item 3 asked for.
- Fix if wanted: one line in the browser case — `await page.locator('[data-vigilia-layer="child"]').click()`
  then `expect.poll(async () => (await state()).active).toBe("child")`, which is
  stronger than the panel-level unit and asserts the branch and the wire together.
  Review item 3 asked for exactly this; the brief dropped it.

### Minor 2 — the new empty-context case can pass vacuously

- Where: `layer-panel.dom.test.tsx:222–223` —
  `for (const row of host.querySelectorAll(".vigilia-layer-row")) expect(row.getAttribute("data-context")).toBeNull();`
- Evidence: a zero-length `querySelectorAll` result runs the loop body zero times
  and the case passes. If the panel ever stopped rendering rows, this test would
  stay green while asserting nothing about them.
- Why it is Minor: the preceding case at `:200–205` asserts attributes on the same
  fixture through `?.getAttribute(...)`, which fails on a missing row, so a
  panel that rendered nothing would already be red one test earlier. This is a
  tidy-up, not a hole.
- Fix if wanted: `expect(host.querySelectorAll(".vigilia-layer-row")).toHaveLength(3);`
  before the loop.

## Verification run

| Check | Result |
|---|---|
| `git diff --numstat 2d46dc9..f5109c9 -- …/editor-shell.css` | `6 0` — additions only, no deletions |
| `git diff --numstat 2d46dc9..857804e -- …/editor-shell.css` | empty — `857804e` does not touch the file, so `2d46dc9` is its true parent state |
| Reduced-motion block in committed `f5109c9` blob | intact — `.editor-shell-menu-popup,`, `.editor-shell-positioner,`, `.editor-shell-tooltip,` all present, with the `[data-vigilia-panel=…]`-era `*` selectors |
| Reduced-motion block in `2d46dc9` and `857804e` blobs | identical count (3) — nothing lost between them |
| CSS blob hashes | parent `b63984d…`, `f5109c9` `f45c200…`; worktree also `f45c200…`, so the commit carries the block |
| `npm run typecheck` | PASS (player, editor, fake-source, host) |
| `npx vitest run …/layer-panel.dom.test.tsx` | PASS — 1 file, 11 tests |
| `npm run lint` / `npm run format:check` | PASS — 335 files each |
| `npm run status:check` | PASS, exit 0; `STATUS.md` 55 lines, under the 70 cap |
| Teeth (a) CSS rule commented out + rebuilt | RED — `editor.spec.ts:1612`, `Expected "0.45"`, `Received "1"` |
| Teeth (a) restored + rebuilt | GREEN — 1 passed |
| Teeth (b) attribute reverted to bare `context.has(row.id)` | RED — `layer-panel.dom.test.tsx:223`, `expected 'false' to be null`, 10 passed / 1 failed |
| Teeth (panel wire) `selectLayer(row.id + "X")` | **GREEN — 11 passed** (Minor 1) |
| Restorations | `layer-panel.tsx` and `editor-shell.css` both hash-identical to the `f5109c9` blobs; `git status` shows only the pre-existing PNG |

`npm run test:e2e` in full was not run (the dispatch forbids it and the suite is
contended); the focused `--grep "enters a group"` case on `desktop-chromium` was
run three times, twice red-on-purpose and once green, all after a rebuild.

## Not verified

- The four browser claims of the original fix report remain a transcript in the
  parts the committed e2e case does not cover; what I re-derived is the rendered
  outcome the case now asserts (attribute on three rows, computed opacity `0.45`
  outside and `1` inside), which is the part that was missing.
- Playwright's `editor.spec.ts` writes `test-results/summary.json` on each run,
  including my deliberate red one; the last run was the green one.
