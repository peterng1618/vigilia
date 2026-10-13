# The device lens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The author sees their theme as the display will present it, from the moment they
open a blank theme — and can deliberately bleed content past the artboard without the tool
calling it a fault.

**Architecture:** The device is a **lens on the artboard, never a constraint on it.** The
artboard keeps whatever dimensions the author chooses; a device frame shows that artboard
the way a screen would present it. Clipping happens in the editor's **DOM layer**, not in
Fabric — see Task 1, which is the whole risk of this plan.

**Tech Stack:** TypeScript, Fabric 7.4.0, React 19, Base UI, Vitest + jsdom, Playwright.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 2 of 9. Read §2 *The device is a lens on the canvas*, the *Case that proves it*
section, and *What this design must never become*. The last of those is a test, not a mood:
*does this change remove a step, or does it remove a freedom?*

## Global Constraints

- **The device is a lens, not the document.** The artboard keeps whatever dimensions the
  author chooses (§57: no reflow, whole artboard units). A theme at 3:1, one at 4000×4000
  and one at 1672×941 all author in the same stage.
- **A theme is designed for one orientation, and the author chooses it once with the
  consequence visible.** That is the whole point of this plan.
- **Never fabricate a reading.** A missing or non-`ok` sample stays a gap (§93).
- Fabric stays imperative behind the editor boundary. React never mirrors an object.
- Persist authored state only. **Device choice is transient** (§67) — it is a view
  preference, not document content, and never enters authored history.
- Fabric JSON stays the document (§134): **no new schema field, no second scene tree, no
  change to what `canvas.getObjects()` means.**
- Every existing authoring capability is preserved. Nothing here removes one.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Refuse invalid numeric
  input rather than coercing it to zero. Stage explicit paths; no `git add -A`. No licence
  headers. 500 lines is a signal and 800 a stop.
- **Verify `npm run typecheck` by exit code**, never by reading for the word "error":
  `tsc` wraps output in ANSI colour codes, and `grep` exiting 1 on zero matches is the grep.
  **Verify lint and format with `./node_modules/.bin/biome lint ..` / `format ..`**;
  `npm run lint` exits 1 on this box for an unrelated PATH reason.
- **`npm run test:e2e` runs with `--workers=1`.** Another agent session shares this machine
  and its Playwright MCP browser — never use that browser; launch Chromium directly with
  `ignoreDefaultArgs: ["--hide-scrollbars"]`. **A single sample of a flaky spec is not a
  measurement:** re-run it against a previous sample of the same commit before reporting.

## Review Focus

The spec implies these and no step below exercises them. Each is pinned by a test in the
task named.

1. **Clipping does not change what `getObjects()` means.** Every walk in the editor —
   `sceneBoxesOf`, `layer-tree`, `snap-manager`, the asset manager, `dropDanglingBindings`
   — reads the scene root. A clip implemented by wrapping the scene in a Group would make
   all of them see one child, and the layer tree would show one row. Pinned in Task 1.
2. **Clipping does not collide with the two clips that already exist** — the crop manager's
   authored per-image clip and the derived text-box clip (`vg-046` names both). Pinned in
   Task 1.
3. **A selection handle stays fully visible when its object is clipped.** This is the
   user's own requirement, recorded in the same report `vg-046` came from. Pinned in Task 1.
4. **Switching device changes the view and nothing else.** The document is byte-identical
   before and after, and undo history does not grow. Pinned in Task 2.
5. **A deliberately bleeding object raises no crop notice**, while an accidental one still
   does. Pinned in Task 5.
6. **An artboard of any shape still authors.** Pinned in Task 3.

---

## Task 1: The editor clips to the artboard

**The risk of this plan, and the reason it is first.**

Measured before this plan: the editor's Fabric canvas carries **no `clipPath`**, while the
player's `adapter.ts` does. So an author composes against a preview that disagrees with the
phone — place a quarter-disc with 3/4 hanging off the edge and the editor draws a full
disc while the phone shows a quarter.

**`vg-046` names why this is not a one-liner.** Fabric has no scene-level clip:
`clipPath` is per-object and serialised through `cacheProperties`, so it collides with the
crop manager's authored per-image clip and with the derived text-box clip. Of the two repairs
the row discusses, **a scene Group wrapper changes what `canvas.getObjects()` means** —
which is the layer tree's, and every walk's.

**Clip in the DOM, not in Fabric.** Fabric already splits its rendering: `lowerCanvasEl`
draws objects, `upperCanvasEl` draws controls. Clip the object layer to the artboard rect
and leave the control layer unclipped:

- the editor already paints an artboard plate (`artboardPlate` in `editor-shell.ts`) and
  owns the artboard rect; the stage positions a clipping frame from that same rect
- **no Fabric object, group, `clipPath` or serialised property changes**
- handles and selection chrome live on the upper canvas and stay fully visible — which is
  requirement 3 above, and the reason this shape was chosen

Say plainly in the commit why the DOM route and not the two Fabric routes.

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell.ts` — the stage's clip frame
- Modify: `src/web/packages/editor/src/editor-shell.css` (or the imported stylesheet)
- Test: `src/web/packages/editor/src/editor-shell.dom.test.tsx`
- Test: `src/web/tests/e2e/editor-clip.spec.ts` (new)

**Interfaces:**
- Consumes: the artboard rect the editor already computes for the plate; the existing
  upper/lower canvas pair.
- Produces: a clip applied to the object layer only.

**Failure modes to design against:** clipping the wrong layer (handles vanish); clipping in
a coordinate space the artboard rect is not in (off by the viewport transform); changing
`getObjects()` (Review Focus 1); a second clip path introduced where one already exists
(Review Focus 2).

**Verification:**
- Unit: an object placed wholly outside the artboard is **not** painted, and one inside is
  — asserted on the DOM, not by inspecting Fabric.
- Unit: **`canvas.getObjects()` is unchanged** — the scene root's length and ids are
  identical before and after enabling the clip. This is Review Focus 1 and it must fail if
  anyone implements the clip by wrapping the scene.
- Unit: the crop manager's authored clip and the derived text-box clip both still behave as
  they do today — `vg-046` named both, so assert both by name.
- Browser: a quarter-disc straddling the edge renders **the same quarter the phone shows**.
  Measure it, do not eyeball it.
- Browser: with a selection whose object is clipped, the handles are fully visible. Assert
  a handle's bounding box is inside the stage, not merely non-zero.

**Commit:** `feat(editor): the stage clips to the artboard, and the handles do not`

## Task 2: The device switch is the zoom control

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/zoom-readout.tsx`
- Modify: `src/web/packages/editor/src/viewport-manager/` — the framing
- Modify: `src/web/packages/editor/src/editor-shell.css`
- Test: `src/web/packages/editor/src/editor-shell/zoom-readout.dom.test.tsx`

**Interfaces:**
- Consumes: the viewport's existing zoom and fit; the artboard's aspect.
- Produces: one control offering **Fit · 100% · Phone landscape · Phone portrait ·
  Wall panel**.

**Constraints:** **Phone landscape is the default**, and it is the shape the starter is
already drawn in, so the reference composition is correctly framed on open. The switch
replaces the zoom readout rather than sitting beside it — there is no second concept of
"preview". A device choice changes the **camera** and nothing else (Review Focus 4).

**Failure modes to design against:** the switch writing a device choice into the document
(§67); fit and a device fighting each other when the author has zoomed manually; a
landscape device cropping rather than containing, which would make the preview a lie.

**Verification:**
- Unit: choosing a device frames the artboard to that aspect, and choosing `Fit` restores
  fit. The previous behaviour is still one click away.
- Unit: **the serialised scene is byte-identical before and after every device choice**, and
  the history does not grow. Review Focus 4.
- Unit: a device never changes the artboard's authored dimensions.
- Browser: on the starter, the default is a landscape phone and the artboard fills it with
  bars rather than being cropped.

**Commit:** `feat(editor): the display is the zoom control`

## Task 3: A new theme asks what it is for

**Files:**
- Modify: `src/web/packages/editor/src/editor-main.ts` and the new-theme path
- Modify: `src/web/packages/editor/src/artboard-panel.ts`
- Test: `src/web/packages/editor/src/artboard-panel.dom.test.ts`

**Interfaces:**
- Consumes: `SHIPPED_TEMPLATES`; the existing artboard presets.
- Produces: a first question — *Phone landscape · Phone portrait · Wall panel* — with
  **Custom still present and one click away**.

**Constraints:** KWGT's own rule, from research: *"before creating a new preset, you have to
resize first; it will remember the dimension."* Today a new theme opens with
`Ratio: Custom`, `Orientation: Custom`, `Resolution: Custom` — **three "Custom"s as the
starting state**, which asks an author to know a ratio before knowing what the thing is for.

This **reorders the decision; it removes no option.**

**Verification:**
- Unit: a new theme from each device preset arrives at the right artboard dimensions.
- Unit: Custom is still reachable and still accepts an arbitrary size.
- Unit: **an artboard of any shape still authors** — a 3:1 and a 4000×4000 theme both
  load, edit and save. Review Focus 6.

**Commit:** `feat(editor): a new theme asks what it is for`

## Task 4: Arc and wedge

**Files:**
- Modify: `src/web/packages/editor/src/new-object-defaults.ts` — `SHAPE_KINDS`,
  `createNewShape`
- Modify: `src/web/packages/editor/src/selection-inspector/panel.ts` — start/end angle
- Modify: `src/web/packages/editor/src/ui-copy.ts`
- Test: `src/web/packages/editor/src/new-object-defaults.test.ts`

**Interfaces:**
- Consumes: `SHAPE_KINDS` as the single list every surface reads.
- Produces: `arc` and `wedge` kinds, each with start and end angle in the inspector.

**Constraints:** the quarter-disc is the case that proved the primitive vocabulary too
narrow — decoration is a first-class need and `rect | ellipse | polygon | polyline | line |
path` cannot express it except as a hand-authored SVG path. `SHAPE_KINDS` stays the one
list so the Add pane, the Insert menu and the inspector cannot drift.

**Failure modes to design against:** a new kind that the inspector's `supportsPanelFields`
silently ignores, so the object is inserted and cannot be shaped.

**Verification:**
- Unit: both kinds appear in `insertGroups()` and in every surface that renders it.
- Unit: start and end angle round-trip through save and reopen.
- Unit: an arc with 0–90° is a quarter-disc, measured.

**Commit:** `feat(editor): arcs and wedges, so a quarter-disc is not a path`

## Task 5: Deliberate bleed is not a fault

**Files:**
- Modify: `renderer-core/src/theme/document.ts` — `NodeBase`
- Modify: `src/web/packages/editor/src/selection-inspector/` — the control
- Modify: `src/web/packages/scene-fabric/src/artboard-crop.ts` — the count
- Modify: `src/web/packages/player/src/artboard-crop.ts` — the notice
- Test: the artboard-crop tests on both sides; a player notice test

**Interfaces:**
- Consumes: `NodeBase`, which already carries `visible` and `locked`. Add `bleeds?: true`
  beside them.
- Produces: an object marked as bleeding is excluded from the crop count and from the
  player's notice.

**Constraints:** **one boolean.** §57 already permits content outside the artboard and no
reflow, so nothing about the format needs to change beyond the flag.

The defect it fixes, measured: `outsideCount` counts a straddling object's whole bounding
rect, so an author who *deliberately* bleeds a quarter-disc is told "1 object outside" and
the phone raises a crop notice. **Marked, it is silent. Unmarked, it still warns** — so the
diagnostic stays honest and stops crying wolf over composition rather than mistakes.

**Failure modes to design against:** the flag reaching the saved document as anything but a
single boolean; a marked object hiding a *real* problem (it must not suppress warnings about
its own internal parts); the player's notice and the editor's count disagreeing.

**Verification:**
- Unit: a marked object straddling the edge is excluded from `outsideCount` and from
  `cropNoticeText`. Review Focus 5.
- Unit: **an unmarked object still warns.** That is the half that matters.
- Unit: the flag survives save and reopen, and nothing else in the document changes.
- Unit: marking a *group* does not silence its children.
- Browser: bleed a quarter-disc past the edge on a landscape phone, assert the phone shows
  the same quarter the editor does, and that no notice appears.

**Commit:** `feat(editor): deliberate bleed is marked, not warned about`

---

## Acceptance

Rendered observation in a real browser (§33).

- An object outside the artboard is **not painted in the editor**, matching the phone.
- A selection whose object is clipped keeps **fully visible handles**.
- The default frame is a **landscape phone**; the device switch replaces the zoom readout;
  `Fit` and `100%` are both still one click away.
- Switching device changes the camera and **nothing else** — the serialised scene is
  byte-identical and history does not grow.
- A new theme asks what it is for; **Custom is still there**.
- An arc of 0–90° is a quarter-disc, inserted and shaped without hand-authoring a path.
- A marked bleeding object raises **no** notice; an unmarked one still does.
- A theme at 3:1 and one at 4000×4000 both author, save and reopen.
- **Close `vg-046` in the backlog with `state: verified`, a check naming words from its own
  title, and `artefacts` naming the sha** — the row says to keep it until the clipping fix
  lands and demonstrably does not collide, so say what proves it does not.

## Out of scope here

Named so a later phase does not re-open them: the per-kind inspector with grouped, hinted
properties and a completeness test (plan 3, and it owns `vg-121`/`vg-122`); the composition
panel's row treatments, already landed in plan 1; the publish loop with QR and LAN
(plan 6); keyboard (plan 7); player chrome (plan 8); and `vg-125`, the crop frame's
`unidentified` row, which is pre-existing and filed with its own owner.