### Task 11: Full gate

**Files:** none created; verification only.

- [ ] **Step 1: Run the broad gate**

```bash
cd src/web
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run size
```

- [ ] **Step 2: Run the browser suite**

```bash
npm run test:e2e
```

**No known-failing tests are carried into this gate — a red suite is a failure to investigate, not to accept.** Both tests this plan previously named as pre-existing phone-chromium failures were measured and **both pass**:

```
npx playwright test --project=phone-chromium --grep "keeps repainting as samples arrive" --workers=1
  ✓ 1 passed (32.4s)
npx playwright test --project=phone-chromium --grep "is byte-stable at a fixed clock" --workers=1
  ✓ 1 passed (32.9s)
```

The two editor drag tests Task 2 turned red (`persists an ordinary drag and restores it through undo`, `rehydrates a chart runtime after undo`) are Task 10's deliverable and must be **green** by the time this task runs. If any test is red here, report it as a finding with its output — do not classify it as pre-existing without a base-commit run proving it.

- [ ] **Step 3: Confirm the player is untouched**

The player consumes `scene-fabric`, never editor UI or the camera. Confirm `npm run size` shows no player bundle growth and that nothing under `packages/player` imports from `viewport-manager` or `editor-shell`.

- [ ] **Step 4: Inspect each acceptance item**

Open, in the editor, and record what each shows: the artboard centred with pasteboard visible; a zoomed view with a correct readout; a marquee drag selecting without moving; a context menu matching the dock; a group entered with the tree showing the context. Each is a visible outcome and each needs the rendered check, not an object count.

`captureVisualReview` returns immediately unless `VIGILIA_CAPTURE` is set, so running the spec files with `--grep` produces no image. Two of the five have registered names — `editor-zoom-readout` (`docs/evidence/screenshots/README.md:40`), and `editor-toolbar` (`:34`) for the menu-against-dock comparison — so re-run those captures under the gate:

```bash
cd src/web && npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --workers=1 \
  --grep "tracks the camera's zoom|captures the canvas dock"
```

In PowerShell the same call needs the pattern single-quoted — `--grep 'tracks the camera''s zoom|captures the canvas dock'` — or the `|` is read as a pipe (AGENTS.md's known trap). Use the Bash tool if that is simpler.

The centring, marquee and group-entry outcomes have no registered name; inspect those by hand. Run the host (`node packages/host/bin/vigilia.js`, built first) and perform each gesture rather than inventing a capture title in the last commit — a screenshot the gate did not ask for and the README does not register is not evidence.

- [ ] **Step 5: Update STATUS.md**

Replace "Last completed change" with a 1–5 bullet summary, update "Next" and "Blockers / unverified", then run `npm run status:check`.

- [ ] **Step 6: Commit**

```bash
git add STATUS.md
git commit -m "docs(status): record the editor viewport and mechanics"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Canvas becomes a camera / workspace with pasteboard | 2 |
| Zoom about the pointer, clamped limits | 1, 3 |
| Scroll and shift-scroll pan | 3 |
| Space-drag and middle-drag pan | 3 |
| Zoom keys, fit and to-selection | 1, 3, 4 |
| Constrained pan, artboard cannot be lost | 1 |
| Zoom readout with fit and 100 % | 4 |
| Group entry, Escape steps out | 7 |
| Layer tree reflects the context | 8 |
| Keyboard nudge, z-order, select-all | 6 |
| Canvas context menu from the registry | 9 |
| Reachable marquee | 5 |
| Guides and indicators at non-1 zoom | 10 |
| Acceptance: full gate | 11 |

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". Task 2's media-alignment check names the behaviour to assert rather than reproducing a full fixture, because the assertion is stated exactly. Task 10 Step 3 deliberately says "fix only what the inspection shows" — the spec makes a claim about existing code and the task exists to test it, so inventing a fix before the inspection would violate §33.

**Corrected by a later read-through:** Task 10's browser step referred to "the one Step 0's mapping fix also uses", and there was no Step 0 — the mapping fix (the repair of two tests Task 2 turned red) was written as prose in Task 10's preamble with no step and no test, while Step 2 already consumed a helper that step was supposed to create. It is now Task 10 **Step 1**, and Task 10's steps are numbered 1-4. An earlier revision of this note also defended Task 7 Step 6 and Task 10 Step 1 as "naming the behaviour to assert rather than reproducing a full fixture". Both were in fact `await page.goto(EDITOR)` followed by a comment and no assertion — a test that passes forever and reads as coverage. Both have since been written in full. Where a browser step is genuinely better left to the executor's judgment, the plan says so in that step; "the assertion is stated exactly" was not true of either.

**Type consistency:** `ViewportManager`'s method set is identical in Tasks 1, 3, 4, 10. `GroupingManager.enterGroup`/`exitGroup`/`groupContext` are the same in Tasks 7 and 8. `actionEnabled(bridge, id)` is defined once in the UI-polish plan and called by both the dock and the context menu in Task 9. `ProductShortcutId` members added in Task 6 are the ones registered in `editor-session.ts`.

**Review Focus coverage:** item 1 → Task 1 Step 1 and Step 5, Task 3 Step 6; item 2 → Task 1 Step 6 (the point-stays-fixed test); item 3 → Task 5 Step 1; item 4 → Task 7 Step 6; item 5 → Task 9 Step 1.

**Cross-plan dependency:** Tasks 8 and 9 require the UI-polish plan's registry and layer panel. Marked in their Interfaces blocks. If both plans run in one branch, execute the UI-polish plan's Tasks 1–6 first; if they run separately, Tasks 1–7 and 10–11 here stand alone.
