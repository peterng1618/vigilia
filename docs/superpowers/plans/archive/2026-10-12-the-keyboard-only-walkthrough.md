# The Keyboard-Only Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One browser spec on the real host that completes §13.1's nine interactions by keyboard alone, so acceptance item 3 stops keeping the editor-redesign objective open.

**Architecture:** A single spec added to the existing `desktop-host` Playwright project, which starts the real `yunari-dashboard` host through its own `webServer`. The spec drives the keyboard only — every step advances focus and presses keys, and no step calls `click` on a locator to choose something. It asserts the three invariants §13.1 states: each region has a reachable focus target, Escape affects exactly one innermost owner, and the walkthrough returns to the original document without unintended history.

**Tech Stack:** Playwright, the real host (`node packages/host/bin/yunari.js --no-browser`), the shared `tests/e2e/` helpers.

**Spec:** [`docs/superpowers/specs/2026-10-08-editor-design-language-design.md`](../specs/2026-10-08-editor-design-language-design.md) — §13.1 is the requirement; its Acceptance section is the measure.

## Global Constraints

- **Keyboard only.** A step that reaches a control by clicking it has not proved keyboard access. `page.keyboard.press` and `Tab`/`Shift+Tab` are the only ways focus moves; `page.locator(...).click()` is permitted **only** where the click is the thing under test, never to position focus.
- **One spec file, in the existing project.** No new project, no new helper module, no new assertion library. §13.1: *"plan 6 assembles the real-host walkthrough, not another test framework."*
- **The real host, started as the project already starts it.** `desktop-host`'s `webServer` runs the host on its own port with its own app dir; the spec must not start a second one.
- **Rebuild before every browser run.** Playwright previews built bundles, and the host binary must be built before `bin/yunari.js` runs. Rebuild after **every** source change, including after reverting a deliberate break.
- **`--workers=1`, and never two Playwright suites at once** (strictPort; `reuseExistingServer`).
- **Screenshots are evidence, not golden files**; capture only actions registered in `docs/evidence/screenshots/README.md`, and only with `YUNARI_CAPTURE=1 --workers=1`.
- **A `--grep` matching nothing exits 0 having run zero tests.** Every browser run in this plan reports its test count.
- **§13.1's "each region has a reachable focus target" means a region that has content — ruled by the user on 2026-10-12.** The shell's opening state has an empty inspector that renders one sentence and legitimately contributes no tab stop; adding a focus target to an empty column is not required and would be an anti-pattern. So a region's reachability is asserted **in the state where that region has content**, and the census is taken after a keyboard selection exists. `REGIONS` stays the same four — this changes *when* the assertion is taken, never how many regions there are, and trimming the list would still be the forbidden move.
- **§N markers are stable**; never renumber. `DESIGN.md` is the design document, `docs/design/design-language.md` no longer exists.
- **Do not touch** plugins, skills, hooks, MCP servers, Claude/Codex settings or `AGENTS.md`.

## Review Focus

The five conditions most likely to bite a keyboard user that no task's steps exercise on their own. Each has its test added to the task that owns the code, in that task's own step style.

1. **Focus enters a region but cannot leave it** — a trap where Tab cycles inside a pane forever. A reachable target is necessary and not sufficient; the walkthrough must leave each region too.
2. **Escape closes two owners at once** — a field inside a popup inside a pane, where one Escape dismisses the popup *and* cancels the field. §13.1 requires exactly one innermost owner.
3. **A popup opens with focus left behind on its trigger**, so the first Tab walks the page instead of the popup.
4. **A screen reader gets no name for a focus target** — reachable and unlabelled is not reachable. Assert an accessible name on each region's first target.
5. **The walkthrough leaves history behind** — an edit that was cancelled, or a palette choice, still producing an undo entry. The final state must equal the opening state, and the history must not have grown.

---

### Task 1: The harness, and the reachability census

**Files:**
- Create: `src/web/tests/e2e/host-walkthrough.spec.ts`
- Read: `src/web/tests/e2e/host-settings.spec.ts` (how a host spec reaches the host), `src/web/tests/e2e/host-theme.ts` (`HOST_PORT`, `HOST_APP_DIR`), `src/web/playwright.config.ts` (`HOST_SPECS`)

**Interfaces:**
- Consumes: the `desktop-host` project's `webServer` and its `testMatch` regex; `HOST_PORT`/`HOST_APP_DIR` from `tests/e2e/host-theme.ts`.
- Produces: `host-walkthrough.spec.ts` with a `test.describe` block and a `press`/`tabUntil` helper used by every later task; the census's recorded findings, reported as two walks (opening and populated).

- [ ] **Step 1: Name the file so the project matches it.** The project's `testMatch` is `/host-(player|settings|media|bleed|chrome).spec.ts/`, so `host-walkthrough.spec.ts` does **not** match it. Widen that regex to admit `walkthrough` and say in a comment that the walkthrough is a host spec for the same reason the others are. This is the one edit outside the spec file, and it is what makes the spec run under the real host.

**The §13.1 ruling of 2026-10-12 changed this task's premise, and this block is the correction.** Task 1 was written before the ruling and its census asserted the unqualified reading: walk the shell as it opens and expect all four regions. The user has since ruled that the requirement means a region **with content**, so the census is taken in the state where each region has content and the inspector's tab stops are counted **after a keyboard selection exists**. The two-walk shape this needs is why `tabUntil`/`keyboardReach` had to be made re-entrant, and why the marks are per walk.

**What this does not change:** `REGIONS` is still the same four. Trimming it to the three opening-state regions to make a run go green is still the forbidden move — the difference is that the fourth region is now asserted *later in the walk* rather than deleted from the list.

- [ ] **Step 2: Write the failing test — the shell is reachable by keyboard at all.**

```ts
test("the shell's regions each have a reachable, named focus target", async ({ page }) => {
  await openWalkthrough(page);
  const opening = await keyboardReach(page); // Tab until focus stops advancing
  await selectInPaneByKeyboard(page);        // the inspector now has content (§13.1 ruling)
  const populated = await keyboardReach(page);
  expect([...opening, ...populated]).toEqual(expect.arrayContaining(REGIONS));
});
```

where `REGIONS` is the region list §13.1 implies — the rail, the pane, the inspector and the stage's own controls. Assert an accessible name per region, which is Review Focus 4. **Report both walks separately** (`opening` and `populated`), because which regions the opening state reaches is evidence about the shell and a merged list cannot answer it.

`selectInPaneByKeyboard` is Task 3's and Task 2's ground; Task 1 needs only enough of it to give the inspector content — reach the pane by Tab, move within it, and activate one item with `Enter`. If that proves larger than a few lines, say so in the report rather than growing the harness: an honest "this needed Task 2's helper" is a better outcome than a second selection mechanism.

- [ ] **Step 3: Run it and record what it says.** `npx playwright test tests/e2e/host-walkthrough.spec.ts --project=desktop-host --workers=1` — **report the test count.** Expect FAIL: `openWalkthrough`, `keyboardReach` and `REGIONS` do not exist.

- [ ] **Step 4: Implement the harness.** `openWalkthrough(page)` navigates to the host's editor mount and waits for the shell. `keyboardReach(page)` presses `Tab` up to a fixed bound, recording each `document.activeElement`'s region and accessible name, and stopping when focus returns to a node already seen. `REGIONS` names the four regions.

- [ ] **Step 5: Run it again.** Expect PASS, in both walks. **A region unreachable in the state where it has content is still the finding this task exists to produce** — record it as a register row (`Discovered, not fixed:`), and say in the commit which region, which target, and which walk. An unreachable region in the *opening* state alone is no longer a finding (§13.1 ruling) and is recorded as the expected shape instead. Do not weaken `REGIONS` to make it green.

- [ ] **Step 6: Commit.** `git add` the two explicit paths; `test(walkthrough): the shell's regions are reachable and named by keyboard`.

---

### Task 2: Create or open a document, and choose a rail pane

**Files:**
- Modify: `src/web/tests/e2e/host-walkthrough.spec.ts`

**Interfaces:**
- Consumes: Task 1's `openWalkthrough`, `keyboardReach`.
- Produces: `openDocumentByKeyboard(page)` and `chooseRailPane(page, name)`, used by Tasks 3–5.

- [ ] **Step 1: Write the failing test** — *"a document is created and a rail pane is chosen with no pointer"*: create or open a document, then move focus into the rail and select a named pane, asserting the pane's own focus target is now reachable (Review Focus 1: reached **and** left).

- [ ] **Step 2: Run it, expect FAIL** on the missing helpers. **Report the count.**

- [ ] **Step 3: Implement the two helpers**, keyboard only, using the shell's own focus order rather than an invented one.

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Commit.** `test(walkthrough): a document opens and a rail pane is chosen by keyboard`.

---

### Task 3: Select through Composition, and edit and cancel a field

**Files:**
- Modify: `src/web/tests/e2e/host-walkthrough.spec.ts`

**Interfaces:**
- Consumes: Task 2's helpers.
- Produces: `selectInComposition(page, name)`, `editFieldThenCancel(page)`.

- [ ] **Step 1: Write the failing test** — *"a field is edited and cancelled, and the document is unchanged"*: select an object through the Composition pane by keyboard, focus a field, type a value, press Escape, and assert the field shows the **original** value and no history entry was added (Review Focus 5).
- [ ] **Step 2: Run it, expect FAIL.** Report the count.
- [ ] **Step 3: Implement.** Escape must be asserted to affect **one** owner (Review Focus 2).
- [ ] **Step 4: Run it, expect PASS.**
- [ ] **Step 5: Commit.** `test(walkthrough): a field is edited and cancelled without history`.

---

### Task 4: Enter and exit a group; open and close a popup; choose a palette; cancel shortcut capture

**Files:**
- Modify: `src/web/tests/e2e/host-walkthrough.spec.ts`

**Interfaces:**
- Consumes: Task 3's helpers. Produces: `enterGroup(page)`/`exitGroup(page)`, `openPopup(page)`/`closePopup(page)`, `choosePalette(page, name)`, `cancelShortcutCapture(page)`.

- [ ] **Step 1: Write the failing test** — the four interactions in one walk, asserting after each that focus is where the interaction left it, and that a popup opens **with focus inside it** (Review Focus 3).
- [ ] **Step 2: Run it, expect FAIL.** Report the count.
- [ ] **Step 3: Implement** the five helpers, keyboard only. Entering a group must not expand it in the layer panel — the question plan 3 named but did not settle — so assert what the panel does and record it in the commit rather than assuming.
- [ ] **Step 4: Run it, expect PASS.**
- [ ] **Step 5: Commit.** `test(walkthrough): groups, popups, the palette and shortcut capture, by keyboard`.

---

### Task 5: The round trip, and the two invariants swept

**Files:**
- Modify: `src/web/tests/e2e/host-walkthrough.spec.ts`
- Modify: `STATUS.md` (the "Last completed change" region only)

**Interfaces:**
- Consumes: every helper from Tasks 1–4. Produces: the single end-to-end walkthrough test that §13.1's acceptance is read from.

- [ ] **Step 1: Write the failing test** — the full nine-interaction walk in §13.1's own order, ending with *"return to the original document without unintended history"*: assert the document's serialized state equals the opening state and the history length did not grow.
- [ ] **Step 2: Run it, expect FAIL** if any ordering interaction between Tasks 2–4 is missing; that is the value of assembling them, since each was proved in isolation.
- [ ] **Step 3: Fix only what assembly exposes** — an interaction that passes alone and fails in sequence is a real defect in the shell, not in the test, and gets a register row if it cannot be fixed inside this task.
- [ ] **Step 4: Run it, expect PASS**, and run the whole `desktop-host` project to prove no host spec regressed.
- [ ] **Step 5: Record the acceptance.** Annotate §13.1's acceptance in the spec file with the check name and the commit, exactly as the earlier plans annotated theirs, and replace `STATUS.md`'s "Last completed change" with this task's 1–5 bullets. `npm run status:check` must pass.
- [ ] **Step 6: Commit.** `test(walkthrough): the real-host keyboard walkthrough, and item 3 closed`.

---

## Out of scope

- **No new focus management.** If a region is unreachable, this plan records it; changing the shell's focus order is its own change with its own spec.
- **No touch, pointer or screen-reader automation.** §13.1 asks for a keyboard-only walkthrough; a pointer walk is a different proof and a screen-reader run needs a different tool.
- **No phone coverage.** §13.1's own words: *"The phone limitation remains named, never mistaken for desktop proof."*
