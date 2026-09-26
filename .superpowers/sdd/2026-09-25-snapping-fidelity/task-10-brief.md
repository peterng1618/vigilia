### Task 10: Full gate and requirement close-out

**Files:**
- Modify: `docs/product/requirements.md`
- Modify: `docs/superpowers/specs/2026-09-24-editor-behaviour-review.md`
- Modify: `STATUS.md`

**Interfaces:**
- Consumes: everything above. Produces: nothing.

- [ ] **Step 1: Run the broad gate**

```bash
cd src/web
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run size
```

- [ ] **Step 2: Run the browser suite in full**

```bash
npm run test:e2e
```

**No known-failing tests are carried into this gate — a red suite is a failure to investigate, not to accept.** This step previously named two pre-existing phone-chromium failures in `display-fabric.spec.ts`; both were measured at the start of this branch and **both pass**:

```
npx playwright test --project=phone-chromium --grep "keeps repainting as samples arrive" --workers=1
  ✓ 1 passed (32.4s)
npx playwright test --project=phone-chromium --grep "is byte-stable at a fixed clock" --workers=1
  ✓ 1 passed (32.9s)
```

(The second title is a prefix match: the case in `display-fabric.spec.ts:671` is `is byte-stable at a fixed clock on one platform`.)

Report any red test with its output and a base-commit run proving when it started. Do not classify a failure as pre-existing without that proof.

- [ ] **Step 3: Decide the legacy fallback path explicitly**

The spec's Key decisions item 3 requires a stated decision on the fork's second engine — the line/pixel snapping the fork runs when its candidate path yields nothing. Read the chain in fork `index.ts` before deciding anything, because three of its five names are easy to mis-transcribe. The real one, with the call sites:

```
_applyMovementGuideSnap  ......... the entry point for a move step (:629)
  → _resolveObjectMovementContext  (:507, called at :499)
      → _resolveMovementSnapAxes   (:550, called at :522)
  → _applyObjectMovementSnap       (:572, called at :503)
      → _applyMovementGuideSnap    (:629, called at :580)
      → _applyMovementVisualGuides (:1098, called at :618)
```

over `line-snapping.ts`, `anchor-buckets.ts`, `snap-target-resolver.ts` and `pixel-grid.ts`. Cite by name, never by line: this file is ~1,400 lines of private methods and every method is one edit away from a new number.

**Two earlier revisions of this step named symbols that do not exist**, and the second was my own correction producing a fresh one — so take the block above as the measurement and the two names below as landmines. The first read the chain as `_resolveObjectMovementContext` → `_applyMovementObjectSnap` → `_applyMovementVisualGuides`: `_applyMovementObjectSnap` is not a method. The second, written to fix that, listed `_resolveObjectMovementSnapAxes` at `:550` — also not a method; `:550` is `_resolveMovementSnapAxes`. A reader who finds neither name in the file should conclude the plan is wrong, not that they are reading the wrong file.

**The answer is already measured: DROP.** Verify the measurement below rather than re-deriving it — the chain above is context for *why* the fallback existed, not a decision still to be made.

- All four fallback modules are **absent** from Vigilia: `line-snapping.ts`, `anchor-buckets.ts`, `pixel-grid.ts` and `snap-target-resolver.ts` — none exists under `snap-manager/`. The spec already classifies the fallback as absent and names these four modules.
- `scaling/scaling-step-snap-guards.ts` (1,322 lines, ported in Tasks 4–6) has **zero importers**: `grep -rn "scaling-step-snap-guards" packages/` returns only its own provenance comment. Its sole fork caller was `pixel-grid.ts`, which is absent. The ported guard family is unreachable by design.
- **Also dispose of every other ported `scaling/` file Task 7's report leaves unconsumed** — `scaling/standard-scale-control.ts` is the known one (zero importers today; its three fork consumers are all controllers this plan does not port), and Task 7 was asked to state whether its fresh controller consumes it. Re-measure rather than trusting that note: a ported file with no importer is the defect this plan exists to remove, and Task 3 already set the precedent by deleting every dead spacing port.

Record **drop** in the spec's `## Key decisions to make in planning` §3, with that reason — the fallback's entry point does not exist in Vigilia, and the guard family only it consumed is unreachable code. Vigilia's broader candidate filter is precisely why fewer objects are declined, which is the spec's own argument for why the fallback's justification is weaker. Do not leave it unstated — that is how the defects this plan fixes survived.

**Do not write a test asserting the guard family works.** A test for unreachable code is green-and-wrong: it passes while proving nothing about shipped behaviour.

**A note the earlier draft of this step got wrong.** It said `getObjectBounds` "is live again" because `scaling-step-snap-guards.ts` calls it at `:5,907,969,1269`. Those call sites are real, but they are inside the same unreachable module, so `getObjectBounds` has **no live caller** either — its only references are there. Task 3's precedent applies: it deleted every dead spacing port (`SPACING_CONTEXT_SWITCH_DISTANCE`, `resolveCommonDisplayDistance` with its `CommonDisplayDistance` type, `calculateSpacingSnap`). **Decide explicitly** whether to delete `scaling/scaling-step-snap-guards.ts` (and `getObjectBounds` with it, if nothing else reads it) on that precedent, or keep it — and if you keep it, say what would make it reachable. State the decision either way. Only `getObjectExactBounds` remains the movement path's reader.

- [ ] **Step 4: Close out §64 and §175**

§64 currently reads "Pixel rulers, configurable grid/guides, additional snapping modes and resize-time snapping are not present". Resize-time snapping now is, and the "under review / treat as unverified" sentence is discharged. Rewrite that paragraph to say movement and resize snapping are both present and verified by the behaviour matrix, and that pixel rulers, configurable grid/guides and additional snapping modes remain review candidates.

§175's body needs no change — it is the requirement this work satisfies — but it has no design link, unlike its neighbours §172–§174, which each end `Design: [<name>](../superpowers/specs/<file>.md).` Add that line to §175, pointing at `2026-09-25-snapping-fidelity.md`, in the same shape.

In the behaviour review, move the **Resize-time snapping** candidate out of `## Candidates` (it is at `:14-21`) and add it to the `## Promoted to requirements` bullet list, in the same shape as the existing two entries (name, one clause of history, the requirement it became). Its current text also carries the disproved claim that resize snapping was skipped because the scaling subsystem was "coupled to object types Vigilia does not have" — Tasks 4–6 showed only two modules carry real coupling, so state that instead. Leave `### Rulers, configurable grid/guides and pixel snapping` where it is; this plan does not touch it. Keep `### Vendored snapping geometry split` (`:48-52`) where it is — that is the rule this plan's ported files are the explicit exception under, and Task 7's `// ported: fork 9efdd78a …` marker is what cites it.

The spec's status line already names this plan (`2026-09-25-snapping-fidelity.md:3` — "planned; see [the snapping fidelity plan]"), so there is nothing to flip there; confirm it still reads that way and move on.

- [ ] **Step 5: Inspect the visible outcome**

Open, in the editor, and record what each shows: guides during a drag, guides during a resize, an equal-spacing guide with its distance label, Ctrl-drag and Ctrl-resize with no guides. Each is a visible behaviour; none is proven by a unit test asserting a guide array.

`captureVisualReview` is gated on `VIGILIA_CAPTURE`, so a plain `--grep` run produces no file — four of these five also have no registered capture name. Run the interactive walkthrough rather than inventing names: `node packages/host/bin/vigilia.js` (build the host first), then perform each gesture by hand. A screenshot the capture gate did not ask for and the README does not register is not evidence, and adding a name for it is Task 9's job, not this one's.

- [ ] **Step 6: Update STATUS.md**

Replace "Last completed change" with a 1–5 bullet summary of this commit. The line this step previously told you to resolve — "Snapping/smart-guide fidelity is under review; gap list not yet in hand" — **is not in the file**. STATUS.md's "Blockers / unverified" at the time of writing carried the `display-fabric.spec.ts` slow tests (five cases, `keeps repainting as samples arrive` among them; all pass with a longer explicit timeout, and the `60_000` per-project setting appears not to take effect), untested hook entry points, an unverified layer-panel action row, and unverified browser round-trips of text align/wrap/overflow, in-place edit + undo and run preset/override persistence. **Re-read that section rather than trusting this list**: the entrance-animation speedup landed after this text was written and moved it — `keeps repainting as samples arrive` is back under the 30s default, one case remains over it under `test.slow()`, and there is no `timeout` key in `playwright.config.ts` for a per-project `60_000` to have failed to apply. Step 2 settles the slow-test item, so update or remove whichever of those lines this work actually resolves and leave the rest. `npm run status:check`.

- [ ] **Step 7: Commit**

```bash
git add docs/product/requirements.md \
  docs/superpowers/specs/2026-09-24-editor-behaviour-review.md STATUS.md
git commit -m "docs(product): close the snapping fidelity review"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 1. Resize-time snapping | 4, 5, 6, 7 |
| 2. Candidate-filter parity | 1 |
| 3. Spacing context stickiness | 3 |
| 4. ActiveSelection eligibility | 2 |
| 5. Fallback path decision | 10 Step 3 |
| Ctrl / axis locks during resize | 8 |
| Guides gated on verification | 7 |
| Verification: multi-step, values not counts, rendered capture | 4–9, 9 Step 4 |
| Non-goals (rulers, angle, size-indicator pass) | not tasked, deliberately |

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". Tasks 4–6 give the fork path and the exact permitted diff instead of inlining 4,000 lines — the source is the specification there, and transcription by hand would be the riskier act. Every step that can carry code does.

Two places deliberately leave a number to be settled rather than asserting one:

- Task 3 Step 2 states three possible outcomes for the spacing-hold test and what to do for each, rather than presuming which is true. That is a real decision the evidence must settle, and the step says so.
- Task 7 Step 1 shows the harness and the shape of the assertion but tells the implementer to fix the exact multiplier and edge positions against the real scene. Guessing a plausible `1.2` there would be worse than saying "work it out", because the implementer has the running test in front of them and I do not. The step names the exact thing to compute (the multiplier that lands the moving edge inside `SNAP_THRESHOLD` of the anchor edge) and the exact thing to assert (`getScaledWidth()`, not `width`).

**A note on the ported tasks' expected values.** Tasks 4–6 tell the implementer to take numbers from the fork's specs rather than invent them. That is correct — the fork's numbers are the specification of parity — but it means the plan cannot pin them here without copying ~4,000 lines. If an implementer reports that a fork spec's numbers do not reproduce, that is a real finding about the port, not a test to loosen.

**Type consistency:** `ObjectBounds` and `getObjectExactBounds` come from `../bounds.js` throughout. `readMovementModifiers` is defined once in `index.ts`, widened in Task 7 to return `shiftKey` too, and reused by both controllers (Tasks 2, 7, 8); Task 2's guard does not read modifiers, so Task 7's widening is what serves Task 8. `stopGesture` is reused by the scaling path rather than duplicated. The marker rule — one per native pointer event from `event.e` — is stated identically in Tasks 7 and 9. Every scaling type and function name in Tasks 5–7 is copied verbatim from the fork, so the ported source and the plan cannot drift apart.

**Review Focus coverage:** item 1 → Task 7 Step 3 and Step 7; item 2 → Task 8 Step 1; item 3 → Task 6 Step 3; item 4 → Task 1 Step 1 and Step 6; item 5 → Task 3 Step 2 (second case) and Task 5 Step 3.

**Sequencing note:** Tasks 1–3 are independent of 4–8 and deliver user-visible improvements on their own. If the port proves larger than expected, 1–3 and 9 can land first — but Task 9's resize half needs Task 7, so the matrix lands whole.
