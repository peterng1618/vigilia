# Task 8 fix round 1 — the muted style gets an owner and a test

You are fixing review findings on Task 8 (`da5f0b2`, "the layer tree follows the group
context"). The feature is correct and shipped; what is missing is that **half of it has
no test, so it can be deleted with the suite green**, and that the half that dims rows
lives in the wrong file. Read the plan section
`docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md` Task 8 — it has just
been amended (commit `5917e3f`) with everything below. The plan is the authority; this
brief is its summary and adds nothing to it.

The task review is at `.superpowers/sdd/2026-09-25-editor-viewport-and-mechanics/task-8-review.md`.
Read its "Important" section. **One premise in that review is false and the plan
contradicts it — follow the plan, not the review, on that point.** The review calls the
`context.size > 0` guard at `layer-panel.tsx:108-109` "redundant once the rule is CSS".
It is not, and you must keep it. React writes a `false` boolean attribute as the *string*
`"false"` rather than dropping it — `layer-panel.dom.test.tsx:201` already asserts
`getAttribute("data-context")` is `"false"` for an out-of-context row. So with no group
entered, every row renders `data-context="false"`, and a bare `[data-context="false"]`
rule would dim the whole tree the moment the editor opens with nothing entered. Deleting
the guard turns the attribute into a lie and is a regression, not a cleanup.

## Files

- Modify: `src/web/packages/editor/src/editor-shell/editor-shell.css`
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx`
- Modify: `src/web/tests/e2e/editor.spec.ts`

## Change 1 — move the declaration into the stylesheet

In `editor-shell.css`, next to the `.vigilia-layer-row` block (which already owns
`padding-left: calc(6px + var(--layer-depth, 0) * 13px)`), add:

```css
/* Only an entered group dims anything: with no group entered every top-level
   layer is selectable on the canvas, and a tree greyed out by default would
   say the opposite. */
.vigilia-layer-row[data-context="false"] {
  opacity: 0.45;
}
```

In `layer-panel.tsx`:

- delete the `dimmed` helper (`:106-109`, including its two-line comment).
- delete `opacity: dimmed(row.id) ? 0.45 : undefined,` and its two-line comment from
  the `style` object (`:211-213`).

Keep the `context.size > 0` logic itself — see Change 3. Keep `contextRows` and the
`data-context` attribute exactly as they are. Keep the other two `style` entries
(`"--layer-depth"` and `paddingLeft`) at `:209-210`: those are values *handed to* CSS and
that pattern is established; `opacity` was a declaration, which is the stylesheet's job.

After this, nothing in `layer-panel.tsx` may reference `dimmed`.

## Change 2 — the muted style needs a test with teeth

`layer-panel.dom.test.tsx:183-205` asserts only the `data-context` attributes. Deleting
the opacity leaves all 10 tests green, which fails AGENTS.md's "a new regression test
should fail when the fix is disabled". Add one case, immediately after that test, using
the **same** `contextRows` fixture it defines at `:187-194` — do not build a second
fixture:

```tsx
it("dims nothing when no group is entered", async () => {
  // With no group entered the context is empty, so every row carries
  // data-context="false" — React writes the string, it does not drop the
  // attribute. The stylesheet rule keys on that value, so an assertion on the
  // attribute alone cannot tell "nothing is dimmed" from "everything is": what
  // this pins is that no row reads "true" when the context is empty, which is
  // the state the guard exists to keep honest.
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <LayerPanel bridge={bridge(contextRows, { groupContext: () => [] })} />,
  ));
  for (const row of host.querySelectorAll(".vigilia-layer-row"))
    expect(row.getAttribute("data-context")).toBe("false");
});
```

**Do not assert `style.opacity` in jsdom.** Vitest never processes the CSS import
(`editor-main.ts:19` is the only importer and no test touches it), so the stylesheet is
not applied and a jsdom opacity assertion would read the inline style you just deleted —
it would fail for the right reason today and pin nothing tomorrow.

## Change 3 — the browser leg, in Task 7's committed case

`src/web/tests/e2e/editor.spec.ts:1450` already has the fixture, the camera-mapped
`at(x, y)` helper and a landed `mouse.dblclick` for entering a group. **Extend that case;
do not write a new one.** It has rows with ids `grp`, `child` and `outside`.

After the double-click has entered the group (`await expect.poll(...).toBe("child")`,
around `:1592`), add assertions on the layer rows. The computed value is what proves the
stylesheet rule actually selects the row:

```ts
// The entered group and its child are reachable; the row outside the context is
// not. `data-context` is the attribute the stylesheet keys on, and the computed
// opacity is the only thing that shows the rule matches the row it should.
const rowStyle = (id: string) =>
  page.locator(`[data-vigilia-layer="${id}"]`).evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      context: node.getAttribute("data-context"),
      opacity: style.opacity,
    };
  });

await expect.poll(async () => (await rowStyle("grp")).context).toBe("true");
await expect.poll(async () => (await rowStyle("child")).context).toBe("true");
await expect.poll(async () => (await rowStyle("outside")).context).toBe("false");
await expect.poll(async () => (await rowStyle("outside")).opacity).toBe("0.45");
// The positive half of the same rule: the child is inside the context and must
// not be dimmed. Without this, a rule that dimmed every row would pass.
await expect.poll(async () => (await rowStyle("child")).opacity).toBe("1");
```

Leave the rest of the case — the nudge, the undo, the Escape identity check — untouched.
The layer panel must be showing for these locators to resolve; if the panel is not
rendered in the default layout, say so in your report rather than forcing a rail click
that changes the case's meaning.

## Verification

```
cd src/web
npx vitest run packages/editor/src/editor-shell/layer-panel.dom.test.tsx
npm run typecheck
npm run build          # required: Playwright previews built bundles
npx playwright test tests/e2e/editor.spec.ts -g "enters a group"
```

**Teeth check, and report both outcomes verbatim.** Comment out the three-line CSS rule
and re-run the e2e case: it must fail on the `outside` opacity assertion (which will read
`1`). Restore it and re-run: green. A red that happens for a different reason — a missing
locator, a timeout — is not this check passing; say so if that is what you see.

## Commit

```
git add src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/editor-shell/layer-panel.tsx \
  src/web/packages/editor/src/editor-shell/layer-panel.dom.test.tsx \
  src/web/tests/e2e/editor.spec.ts
git commit -m "test(editor): give the muted layer style an owner and teeth"
```

Per AGENTS.md, replace the "Last completed change" block in `STATUS.md` with a 1-5 bullet
summary of this commit, and include `STATUS.md` in the `git add`. Stage explicit paths
only — never `git add -A`. The commit message ends with:

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

## Report

Write your full report to
`.superpowers/sdd/2026-09-25-editor-viewport-and-mechanics/task-8-fix-report.md`.
Return only: status, the commit sha, a one-line test summary, and any concern.

Do not dispatch subagents. Do not touch any file outside the four above.
