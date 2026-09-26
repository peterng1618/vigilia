### Task 9: The behaviour matrix

**Files:**
- Create: `src/web/tests/e2e/snapping.spec.ts`
- Modify: `src/web/tests/e2e/editor.spec.ts` (Step 5 — export `captureVisualReview`, `sceneToClient` and `clientOfScene`)
- Modify: `docs/evidence/screenshots/README.md`

**Interfaces:**
- Consumes: everything above. Produces: nothing.

The gap shipped green because the only verification was one capture whose sole assertion is `screenshot.byteLength > 1000`. The fork carried ~65 snapping e2e specs across `shape/`, `text/`, `image/`, `group/` and `selection/`, each covering moving-geometry, moving-hold, moving-lifecycle, moving-spacing and the five scaling behaviours. Those fixtures are fork-specific (`editorModel`, `shapes`, `snapping`, `SNAPPING_TOLERANCE`) and cannot be reused, but the **cases** port directly.

- [ ] **Step 1: Read the fork's matrix**

```bash
git -C D:/git-repos/fabricjs-image-editor ls-tree -r --name-only 9efdd78a \
  | grep "e2e/tests/snapping-manager/"
```

Group them by behaviour class. The five classes per object kind are: geometry (does the position land where the guide says), hold (does it stick and then release), lifecycle (does it start and end cleanly), spacing (equal-spacing detection), and for scaling additionally minimum-size, round-trip and modes.

- [ ] **Step 2: Write the Vigilia matrix**

New file `src/web/tests/e2e/snapping.spec.ts`, skipping every test on non-desktop projects the way `editor.spec.ts` does: `import { isDesktopSurface } from "./surface.js"` and `test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface")`. **Do not write a project-name comparison.** `isDesktopSurface` is the shared owner of the desktop surface set (`tests/e2e/surface.ts:13`, exported) and every editor case calls it; a second skip expression would be a second place for that set to be defined, and the two would drift. Follow the existing conventions:

- Real gestures: `page.mouse.move/down/move({steps})/up` over `#vigilia-fabric-editor canvas.upper-canvas`. **Get the artboard coordinates through `artboardScreenRect()`, not through the canvas box.** Plan A's Task 10 repairs exactly this in `editor.spec.ts` — the canvas is host-sized and the artboard is contain-fitted inside it, so `box.x + (n / W) * box.width` is wrong by the `ty` it drops. Reuse `editor.spec.ts`'s `sceneToClient` / `clientOfScene` helpers rather than writing a second mapping; a raw `box.x + …` in this file is the defect this bullet exists to prevent. Both are file-scope and unexported, so Step 5 exports them alongside `captureVisualReview` — import them from there, and add that export in this task rather than deferring it.
- Read resulting geometry through the debug handle found by `key.startsWith("vigilia-fabric-editor-")` (the same lookup `editor.spec.ts` uses in several places), which exposes `canvas.item(i)` and `canvas.getObjects()`. Prefer `getObjects().find(o => o.get("id") === …)` over `item(i)` — an index is a fixture-order assumption that a scene change silently breaks, and the id is what the case is about.
- Assert **values**, not counts: after the gesture, read the object's `left`/`top` (move) or `width`/`height` (resize) and compare with the expected number.
- For guide presence, assert on the rendered pixels the guide occupies — sample the artboard row or column the guide should run along — not on `screenshot.byteLength`. A byte-length assertion is the defect this task exists to replace.

One test per case, named after the fork's case so the two can be compared. Cover, for **moving** and for **resizing**, against a shape, a text object and a group:

- the object lands exactly on the guide;
- a multi-step drag/resize re-plans at each step (the case that hid the P0);
- the snap releases past the release threshold;
- guides are absent when nothing is near;
- Ctrl returns the raw geometry;
- an equal-spacing case reaches equal spacing.

The resize half needs Task 7, so write it after that task lands.

**Also in this file: the layer panel's bottom action row.** `2026-09-25-editor-ui-polish.md`'s spec
carries one acceptance item that plan closed without meeting — "Object actions appear in the layer
panel's bottom row, not per row, and render from the same registry the canvas dock uses" — verified in
jsdom but never in a browser. It rides here because this is the task that owns `editor.spec.ts` and the
browser surface. One case: select an object, read the bottom row's action labels, read the canvas
dock's action labels for the same selection, and assert the two sets are equal. Assert the **entry set**,
not a hard-coded list — a list duplicated from the registry is a second owner of it and would pass while
the two surfaces diverged. Record the result in that spec's acceptance section as part of Task 10's
close-out pass, so the item moves from carried to met or is re-recorded as still open.

- [ ] **Step 3: Run it**

Run: `npx playwright test --project=desktop-chromium tests/e2e/snapping.spec.ts --workers=1`
Expected: PASS. Report the count.

- [ ] **Step 4: Prove the matrix can fail**

Reintroduce the `83248dc` bug — a per-gesture marker — and rerun. Expected: the multi-step cases fail for both moving and resizing. Restore. If any case survives that break, its assertion is too weak and must be tightened, because those are the cases meant to prevent the regression that already shipped once.

- [ ] **Step 5: Register the evidence and commit**

The matrix's cases assert on rendered pixels and read geometry, so most need no capture at all. **The resize capture is already registered and committed by Task 7** — do not add it again. If Step 2 introduces capture titles of its own, they belong in the `Editor mechanics` row of `docs/evidence/screenshots/README.md` (the row listing `editor-snap-guides`; locate it by that name), which already lists `editor-snap-guides` / `snaps a dragged object` — the same visible action class, so no new domain. Capture titles go through `captureVisualReview(page, testInfo, "<name>")` as the existing tests do — but note that helper is **file-scope and not exported** in `editor.spec.ts`, so a new spec file cannot call it as written. **Export three helpers, not one:** `captureVisualReview` (the capture contract), plus `sceneToClient` and `clientOfScene`, which this task's own instruction above requires it to reuse and which are equally unexported. The file currently contains **zero** `export` statements, so add all three in one edit and import them. Adding `src/web/tests/e2e/editor.spec.ts` to this task's Files list is part of this step, rather than growing a second capture helper or a second coordinate mapping that can drift from the `VIGILIA_CAPTURE` / `-<project>.png` contract and the artboard-fit arithmetic respectively. If the exports turn out to be undesirable, say so and inline equivalents — what must not happen is a `page.screenshot` call with no `VIGILIA_CAPTURE` gate, which would write a capture the README never registered, or a raw `box.x + (n / W) * box.width` mapping, which drops the artboard's `ty`.

```bash
git add src/web/tests/e2e/snapping.spec.ts \
  src/web/tests/e2e/editor.spec.ts \
  docs/evidence/screenshots/README.md
git commit -m "test(editor): snapping behaviour matrix for move and resize"
```

**Name every capture; do not stage the directory.** `docs/evidence/screenshots/` holds ~40 PNGs owned by other tasks and another plan, and an unrelated capture can be sitting modified in the working tree — a directory-wide `git add` sweeps it into this commit. `*snap*.png` is not narrow enough either: `editor-snap-guides-desktop-chromium.png` also matches the glob and belongs to the movement-snap capture Task 1's browser check rewrote.

**Do not stage `editor-snap-resize-desktop-chromium.png`.** Task 7 Step 7 produces that capture and Task 7 Step 8 commits it; by the time this task runs it is already in history, and re-staging it is either a no-op or, worse, sweeps in a re-run's byte-different replacement under a commit that did not produce it. If Step 2 introduces capture titles of its own, name each PNG they produce in this `git add` as it is added — but the matrix's value is its assertions, not its screenshots, and a matrix case needs a capture only where the plan's Review Focus items name one.

`editor.spec.ts` is in the list because Task 2 and Task 7 also touch it; confirm the working tree holds only this task's edit there before staging it.

---

