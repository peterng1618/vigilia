# Plan queue — controller state

Owned by the root session running the user's standing goal: *complete all plans one by one; if no plans
left, pick an uncompleted spec, write an implementation plan and execute it fully autonomously.*

`STATUS.md` owns **which one plan is active**. This file owns the order behind it, and the cross-plan
rulings that decide that order. It is superseded by nothing and duplicates no ledger — each plan's own
ledger stays the record of what happened inside it.

## Order (ruled 2026-09-26)

| # | Plan | Real state | Notes |
|---|---|---|---|
| 1 | `2026-09-25-snapping-fidelity.md` | **Closed and archived** (2026-09-27). | Tasks 1–11 landed; Task 10 closed the gate and the documentation. Gate: `format:check`, `lint`, `typecheck`, 136/136 unit files, `build`, `size`; browser suite 155 passed / 96 skipped / 0 failed. The unreachable scale step-guard family (1,394 lines) deleted in `e248cae`; close-out in `d9ead29`. |
| 2 | `2026-09-25-editor-ui-polish.md` | **Closed and archived.** Tasks 1–10 landed (`5b9b386`), fix round 1 `2929f87`, fix round 2 `7ae88e4`, plan reconciled `58d3cf9`, archive move + spec annotation `9800496` / `35918f3`. | Re-review 2: both findings ADDRESSED, no new breakage; it reproduced round 1's 66px/two-top signature by restoring pre-fix labels in the live DOM of the same bundle. Rendered measurement: Size row 239.2 × 30px, input tops equal. Full browser suite 116 passed / 57 skipped / 0 failed. The one acceptance item it carried — browser coverage for the layer panel's bottom action row — is now met by `snapping.spec.ts`. |
| 3 | `2026-09-24-author-journey.md` | Tasks 1–5 landed. | Open: Task 6 (integration proof) only. |
| 4 | `2026-09-24-authoring-and-consumer-polish.md` | Tasks 1, 3, 4(partial), 5 landed. | Open: Task 4's tab reset (see below), Task 6 proof. Task 2 largely superseded by author-journey's landed Task 2. |
| 5 | `2026-09-24-settings-scope.md` | **Closed and archived** (2026-09-27). | Recon held: all 19 ticks true. Task 5's two process claims closed — the 2026-09-27 broad gate and full browser suite ran green against this state, and the spec's acceptance section is annotated. The four-state rendered inspection is annotated as **not met in full**: one registered capture, behavioural coverage for the rest. Its `recon.md`/`progress.md` workspace is **kept**, not deleted — it is git-ignored, so deleting it would destroy untracked analysis irrecoverably. |
| 6 | `2026-09-24-consumer-journey.md` | 4 landed, 1 partial, 1 open. | Recon (`recon.md`, `aff8d2b9e4a8140ce`): Open: Task 5 (paired-session `/` test) + Task 6 (gate, captures, spec acceptance). Task 4 was **deliberately reverted** by settings-scope (`73ad33d`) — do not restore. Tasks 5 and 6 both touch `tests/e2e/` — do in one pass. |
| 7 | `2026-09-24-theme-thumbnails.md` | 0 landed, 4 partial, 1 open (all core work is in the tree; each task is short one clause). | Recon: biggest real gap is the capture using the editor's canvas, not the player's scene mount (spec §31). Also: no capture test at all, no phone-width rule, no delete path for `thumbnails.remove`. Rulings in its ledger. |
| 8 | `2026-09-24-authoring-time-run-placeholders.md` | 3 landed, 2 partial. | Recon: Tasks 1-3 landed at `51023c2`. Open: Task 4 (player-side token case in `host-player.spec.ts`) + Task 5 gate. |
| 9 | `2026-09-26-clock-and-theme-locale.md` | **Closed and archived** (2026-09-27). | STATUS.md recorded it closed; the archive pass confirmed the spec's acceptance section had never been annotated and annotated it from the code. Its workspace was tracked in git and is deleted — recoverable from history. |

**Ruling: Plan B's deferred Minor 6 rides in snapping-fidelity Task 9's dispatch.** Minor 6 is
"the layer panel's bottom action row has no automated browser coverage" — one browser case asserting
the row's entry set equals the canvas dock's for the same selection. It was deferred because
`src/web/tests/e2e/editor.spec.ts` was held by snapping Task 2, and it is a spec acceptance item
("Object actions appear in the layer panel's bottom row, not per row"). Task 9 is the snapping task
that owns `editor.spec.ts` (it exports `captureVisualReview` from it), so Minor 6 is appended to
Task 9's dispatch rather than getting its own task in another plan. Cost if wrong: one extra browser
case in a task that already edits that file, against an acceptance item that stays unverified.
Plan B's Minors 7 and 8 are batch-into-next-touch items, not tasks — 7 is a disposition with no
action needed, 8 is three unrelated small cleanups.

## Recon results (2026-09-26, two read-only passes)

Both recons read the code, not the checkboxes. They confirm the standing ruling below and
produce the queue order's evidence:

- **settings-scope** — 19/19 ticks, all true. Two commits (`eacaea2`, `fd5cbf8`). Nothing an
  implementer must pick up; only the process claims (gate, spec acceptance) are open.
- **authoring-time-run-placeholders** — 0/5 ticks, 3 tasks landed at `51023c2`. The unticked
  boxes were **right about Tasks 4 and 5** and wrong about 1–3, in the same file.
- **consumer-journey** — 4 landed, 1 partial, 1 open. Task 2's `required-devices.ts` was added
  by **settings-scope**, not by this plan; Task 4's behaviour was deliberately reverted.
- **theme-thumbnails** — 0 landed, 4 partial, 1 open; every task's core is in the tree and each
  is short one clause.

**Ruling: a spec's acceptance section is annotated as part of the plan that lands the work, not
deferred to a final task.** Four plans in this queue are open *only* on "run the gate and
annotate the spec" (settings-scope, author-journey, consumer-journey, theme-thumbnails). That is
one shape repeated four times, so it is batched: whichever plan reaches its gate first runs the
broad gate once at the merge boundary, and each plan's own spec gets its acceptance annotation in
the same pass as its remaining code work. Cost if wrong: one extra gate run at the end.

## Cross-plan rulings

**Ruling: two plans are never active at once, even when their file sets are disjoint.** The viewport and
snapping plans ran concurrently and produced three recorded staging collisions, two of them live at once
(`editor.spec.ts` held by B9/C2/C7/A10; `snap-manager/` directory-staged by C3 and C6). Serializing costs
wall-clock and nothing else. Cost if wrong: a slower queue.

**Ruling: `docs/superpowers/plans/2026-09-24-authoring-and-consumer-polish.md`'s Task 4 is real work, not
a stale checkbox.** Its second half — "a new selection resets the active tab to Design, so a chart's Data
tab never lingers over a shape" — is specified in `docs/superpowers/specs/2026-09-24-authoring-and-consumer-polish.md:72-74`
and is **not implemented**: `packages/editor/src/editor-shell/shell-layout.tsx:402` renders `<Tabs.Root
defaultValue="design">` — uncontrolled, so nothing can reset it — and the only tab test
(`shell-layout.dom.test.tsx:201-233`) clicks Data and asserts the chart panel is reachable, which is
tab *reachability*, not the reset rule. The routing half of Task 4 landed. Cost if wrong: one small
controlled-`Tabs.Root` change plus a test, against an author whose chart's Data tab stays open over a
shape they then select.

**Ruling: an unticked checkbox in these plans proves nothing, in either direction.** Established by
measurement on four plans, and it is now the queue's operating rule: `2026-09-24-author-journey.md` shows
0/25 ticked with 5 tasks verifiably landed; `2026-09-24-settings-scope.md` shows 19/19 ticked and all 19 are
true; `2026-09-24-authoring-time-run-placeholders.md` shows 0/5 with 3 landed; `2026-09-25-editor-ui-polish.md`
showed 0/63 with all 10 tasks landed. The 2026-09-24 generation of plans predates step-boxes entirely, and
several were executed without their boxes ever being maintained. **Every task's state is therefore
established from the code before it is dispatched**, and a plan is archived only when the code and its
evidence say so — never because its boxes look full. Cost if wrong: one recon pass per plan, against a
re-dispatched task that rebuilds already-landed work.

**Ruling: this queue is a controller scratch file, deleted when empty, not a second plan registry.**
`AGENTS.md` forbids alternate spec/plan directories; this file is not one — it holds no plan text and no
task briefs, only the order and the rulings that produced it.

## Dispatch records

Live dispatches are `dispatch-<agent id>.md` inside each plan's workspace. At the time of writing:
snapping **Task 7, fix round 1** (`a7c1141278b867e9b`, writes, on top of `70b5b36`) is the only one.
Task 7's implementer (`a7c1141278b867e9b`) and its reviewer both returned — but the implementer was
**resumed** for the fix round rather than replaced, per the "rounds 1–3 resume the same agent" rule.
Plan B's fix round 2 (`a81a0d974934dbba4`), its scoped re-review 2, its final review, both read-only
recon passes, and snapping Task 2's implementer and review (`ac4bd1b3dfc9272c7`) have all returned and
their records are deleted.

**Ruling: a review finding is checked against the source before it is written into the code.** Task 2's
review claimed its kept parented-child clause was unreachable, because Fabric's `ActiveSelection.enterGroup`
supposedly clears a group child's group. Read against Fabric 7.4.0: `Group.enterGroup` sets `parent`
(`dist/index.mjs:9328`) and `ActiveSelection.enterGroup` (`:18934-18938`) calls the base `_enterGroup`,
which sets `group` and never touches `parent` — so a selection member that came from a group keeps
`parent === oldGroup` and the clause is reachable. Only `Group.exitGroup` (`:9352`) clears `parent`. Had
the finding been actioned on the reviewer's authority, the source would now carry a false invariant.
Cost if wrong: one `sed` per contested finding.

**Ruling: one implementer at a time is the constraint, not one plan at a time.** Plan B's fix round 2
runs while snapping-fidelity is the plan `STATUS.md` names. The serialization ruling above was written
against concurrent *implementers* producing staging collisions; here exactly one implementer runs, the
other live agent is a read-only review scoped to a fixed diff package, and no file set overlaps.
Snapping Task 7 — which also edits `editor.spec.ts` — is held until fix round 2 commits, so the
collision class stays closed. Cost if wrong: a slower queue.

**Ruling: a plan's close-out owes rendered evidence for a rendered acceptance item.** Plan B's
acceptance item "The inspector shows geometry as paired rows" was proven with a jsdom test asserting
`.closest(".vigilia-field-row")` identity — an assertion that returns the same element whether or not
the row wraps, because jsdom does not lay out. The re-review measured the built bundle and found the
Size row 66px tall with its inputs at two different tops. The close-out therefore owes a browser case
that measures the two inputs' bounding-box tops, and that requirement is written into fix round 2's
brief. Cost if wrong: one browser case, against an acceptance item recorded as met on evidence that
could not have failed.

## Orphan spec for the tail of the queue: `2026-09-24-clock-provider.md`

No plan file pairs with it (`docs/superpowers/plans/` has no `clock-provider` entry), so it is the
first candidate for the goal's "if no plans left, pick an uncompleted spec" branch. **Measured state
at `2929f87` — it looks landed in full:**

- `packages/host/src/providers/clock.ts` (90 lines): `CLOCK_PROVIDER_ID`, `CLOCK_KEYS =
  ["time.now", "date.today"]`, `CLOCK_DESCRIPTORS`, `ClockSensorProvider` with `setTimeZone`. It
  sends an instant, not a formatted string, exactly as the spec's "the provider measures; the display
  formats" section requires.
- Registered and wired: `main.ts:94-96`, zone changes at `:129`, stored zone at `:163`.
- Token formatting lives at its own owner, `renderer-core/src/scene/datetime-format.ts` (`:242`
  "Renders an instant with the author's tokens; literals pass through"), with `:18` stating an unknown
  token renders literally rather than blanking the value — the spec's third acceptance item. Unit
  tests at `datetime-format.test.ts`.
- Editor side: the starter theme binds both keys (`new-fabric-theme.ts:305,307,312` — `time.now` with
  `format: "hh:mm"`, a period run, and `date.today`), and the run row has a **Zone** picker
  (`selection-inspector/runs.ts:353-378`, `zoneField` at `:475`) whose preview re-renders in the
  pinned zone.
- The spec's last acceptance item is met: `07:24` appears **nowhere** in `src/web` outside a test
  fixture. An earlier note here claimed it survived at `new-fabric-theme.ts:61` — that was a grep hit
  in `runs.dom.test.ts`, not production source. Corrected.
- Browser evidence exists for the timezone half, which is the half the spec's Verification section
  singles out: `editor.spec.ts:571-621` drives the Zone picker and polls the preview against a
  `Intl.DateTimeFormat` computation in `Asia/Tokyo`, so it proves the *rendered* value changes rather
  than only the stored envelope.

**Likely complete; needs a recon pass, not an implementation plan.** What is genuinely unverified:
whether the remaining acceptance items have their own browser evidence (the cadence-advance item and
"a theme bound to no time key is unaffected"), and whether the starter theme's clock is proven to
*update* as the cadence advances rather than only to render once. That recon is the spec's first task
whenever the queue reaches it — not work to start now.

## Orphan spec 2: `2026-09-21-editor-shell-modernization-design.md`

A design doc, not a spec, and no plan pairs with it — it is the origin document for the editor shell
that Plans A and B then built. Read at `2929f87`: its scope and boundary sections describe what
shipped (React shell over an imperative Fabric host, Base UI primitives, global rail, tabbed
inspector, canvas-bottom action dock).

**One divergence worth recording, not a defect:** the design says the shell palette menu "selects
Graphite, Ember, Moss, Plum, or Light"; the code ships six, adding **`editorial`**, which is also the
default (`editor-shell/palette.ts:3-14`, `DEFAULT_SHELL_PALETTE` at `:14`). Added by `78c8bc3`
("feat: add editorial shell palette and copy"), after this design was written. Its own comment states
the invariant the design's acceptance item requires — "Browser-local only: never serialized into a
theme envelope, never authored document state" — and `palette.test.ts:22-53` pins both the storage
round-trip and the reject-invalid case.

**Disposition: no plan needed unless a recon finds an unmet acceptance item.** This is a design
document whose product landed through other plans; the goal's "pick an uncompleted spec" branch should
reach the two specs above it first. If it is ever taken up, the only work is verifying the six
acceptance items against the browser and amending the palette list to match what shipped — not
building anything.

## Queued finding: `2026-09-24-clock-provider.md` fails the reuse gate (measured 2026-09-26)

Found while auditing that spec against the "reuse before build" rule. **This is not a rewrite task** —
the design is right and three specific pieces are wrong. Taken up in a fresh session, before the
remaining queue plans, because it is a correctness defect (English-only output) and not polish.

What the gate found, rung by rung:

- **Rung 2 (deps).** `renderer-core` ships `echarts` only; the player bundle is `renderer-core` +
  `scene-fabric` under a 400 KB gzip budget (`player/scripts/check-size.mjs`, §47 display-only,
  §157 placeholder). A date library would land in that budget. This is the material cost the
  original decision never weighed, because rung 4 was never run.
- **Rung 3 (platform).** `Intl` is used correctly for offsets and the zone list
  (`datetime-format.ts:179`, `:226`, `:239`). `isTimeZoneName` probing rather than list-membership
  is right — aliases such as `US/Pacific` resolve.
- **Rung 4 (ecosystem) — skipped at the time.** `date-fns`, `dayjs`, `luxon` and `Temporal` all
  exist, all MIT, all give localized weekday and month names. Nothing in `docs/` records this
  search. The spec's written rationale (`:87-107`) argues against an *arbitrary ICU pattern*, which
  is not the alternative a reader would reach for.
- **Rung 6 (probe, run 2026-09-26).** `Intl.DateTimeFormat(locale, { weekday: "long", month:
  "long", … })` returns localized names with no dependency: `en` → "Saturday, September 26, 2026",
  `de` → "Samstag, 26. September 2026", `ja` → "2026年9月26日土曜日". `formatToParts` yields every
  field the token table produces. Both `supportedValuesOf("timeZone")` (418 entries) and
  `timeZoneName: "longOffset"` work.
- **Rung 6, the part that keeps the custom code.** Same options under `en-GB` and `en-US` give
  **different field order** ("26 Sept 2026" vs "Sep 26, 2026"), and no option sets an arbitrary
  one. An author owning field order (`YYYY-MM-DD`, `DD/MM/YYYY`) therefore needs the token walker.

**So the walker is justified and the name tables are not.** Three defects, all in
`packages/renderer-core/src/scene/datetime-format.ts`:

1. **`WEEKDAYS`/`MONTHS` (`:86-109`) hard-code English.** The module's own doc comment (`:20-21`)
   calls the consumer's locale "a separate question the settings page has not answered" — that is a
   defect stated as a deferral. Every clock in every theme is English while `Intl` is already in
   hand. Route the names through `Intl` for the reader's locale.
2. **The `WEEKDAY_INDEX` round-trip (`:200`).** For `dddd` in a pinned zone the code asks `Intl` for
   a short weekday name, discards it, converts it to an index through an English-only table, then
   looks that index up in `WEEKDAYS` — four hops to re-derive what `Intl` returned. Delete the
   round-trip along with the tables.
3. **`?? 0` and `?? ""` (`:200`, `:115-116`).** An unrecognized weekday silently becomes **Sunday**;
   an out-of-range month silently blanks. `AGENTS.md` requires refusing invalid input rather than
   coercing it to a default.

**Keep:** `instantIn` (`:31`) emitting the instant *with its reading offset* is a real job no API
does — it is what lets the provider measure and the display never re-convert (spec `:65-68`), and
what keeps `renderer-core` platform-neutral. Do not touch it. The token walker, the bracket-literal
rule and the unclosed-bracket recovery all stay.

**Also owed:** the spec's Design section must record the rung-4 search and the rung-5 comparison
that actually decided this — `Intl` + walker (0 KB, localized names, author-owned order) against
`date-fns`/`dayjs` (bundle cost, and still needs the walker for order) — so the next reader sees the
option that was really weighed.

**Correction to one probe note:** an early probe of localized weekday names appeared to return
"Saturday" for `de`/`fr`/`ja`. That was a bug in the probe — its helper hard-coded `"en"` in the
formatter it built — not a property of `Intl`. The separate probe above is the one that holds.

## Archiving rule (applied to every plan this queue closes)

`docs/superpowers/plans/README.md` — "Move a completed or superseded plan to `archive/`; it is
historical context, not current instruction." A plan is archived only when the code and its evidence
say it is done, never because its boxes look full (the ruling above). For each plan in this queue the
archive step is the same three moves:

1. `git mv docs/superpowers/plans/<plan>.md docs/superpowers/plans/archive/<plan>.md`.
2. Annotate its spec's Acceptance section with what was observed, per the batched-close-out ruling.
3. Delete its `.superpowers/sdd/<plan>/` workspace — the ledger is recovery state for work in
   progress, and a closed plan's recovery state is git history plus the archived plan.

**Superseded plans keep their archive copy too**, even where a later plan overwrote their behaviour
(consumer-journey Task 4 is the live example). The archive is the story; `docs/` current truth is what
the code does. Do not delete an archived plan because its content is no longer accurate.

**Ruling: Task 7 is held until Plan B's re-review returns, because both build the same bundle.** Fix
round 2's re-review must measure the **built** editor bundle to judge a layout claim (Playwright previews
built output, and jsdom cannot lay out — that is exactly how the item survived round 1). Task 7 rebuilds
that same bundle as soon as it edits `snap-manager/`, and its Step 1 is a build-and-run loop. Running both
means the reviewer can measure a bundle containing Task 7's partial work, which would invalidate the very
evidence the review exists to produce. The previous serialization ruling covered *implementers* colliding
on staged files; this one covers an implementer and a reviewer colliding on **build output**, which is not
a file either of them stages. Cost if wrong: wall-clock only.

**Plan B is closed.** Its last acceptance item was satisfied and the re-review returned ADDRESSED on
both findings, so the three archive moves ran: plan moved to `archive/`, spec annotated, workspace
deleted. Recorded here because the paragraph below was written while the verdict was still owed.

**Plan B's last acceptance item was satisfied before close-out.** The
acceptance line reads "Full gate: `format:check`, `lint`, `typecheck`, `test`, `build`, `size`, and the
local browser suite; visible behaviour confirmed by rendered inspection." Fix round 2 ran all seven —
including the full browser suite at **116 passed, 57 skipped, 0 failed**, which the earlier rounds had
skipped — and confirmed the layout by rendered measurement of the built bundle. So the two items this
ledger previously recorded as owed are both discharged: the browser suite by fix round 2's run, and the
rendered inspection by its measured row geometry. What remains is the re-review's verdict, then the three
archive moves. Recorded so the close-out is not re-opened for work already done.

## Final review — snapping fidelity (returned 2026-09-27)

Read-only over `a0a44ff..d9ead29` plus the close-out claims. One Important, five Minor,
four declined. **Important fixed:** the spec's Key decision 2 recorded
`IGNORED_IDS = ["scene"]` — the pre-landing draft the plan's own audit had corrected — while
the code holds `["background"]` and the spec's own body says `["scene"]` excludes nothing.
Anyone reading the decision record would have concluded the artboard-plate exclusion was
inert, and "fixed" it by restoring the `selectable` gate Task 1 removed.

Also corrected in the same pass, all accuracy defects in text this close-out wrote: the
fallback entry point is `_applyObjectMovementSnap` (`_applyMovementGuideSnap` is a leaf in
it); the guard family was consumed **by** `pixel-grid.ts`, not the reverse, in both the
spec and STATUS.md; `ui-polish`'s acceptance now carries the re-measured 2026-09-27 result
rather than the older "pre-existing on a differential proof" wording it contradicted; the
snapping spec's status line reads `implemented` with an archive-relative plan link.

**Deferred minors, reported not fixed:**

- `isStandardRectangularScaleControl` in `standard-scale-control.ts` is exported with zero
  importers — the fork's "refuse a custom control" guard is absent. Inert today, because
  `controls-manager` overrides only render, sizes, offsets and cursor, and the guard
  compares the five behaviour handlers. This is the class Task 10 Step 3 chartered the
  close-out to dispose of; wiring it in is the fix, deleting it is the alternative.
- The promoted entry in the behaviour review points at §175 where its siblings point at the
  requirement the item became (§64 is where resize snapping is recorded as present). Shape
  consistency only.

**Declined by the reviewer, not defects:** Review Focus item 4's visible half has a jsdom
case but no browser assertion (what the plan assigned); the by-hand walkthrough is not
reproducible from the tree; the gate numbers were taken as given.

## Deferred minor closed: the standard-control guard is wired (2026-09-27)

`isStandardRectangularScaleControl` was exported with zero importers, so the fork's
"refuse a non-standard resize handle" protection was absent. Wired into
`beginGesture` in `scale-snapping-controller.ts`, beside the other refusals — the gate
belongs at gesture start, where `target` and `transform` are both available and a
refused gesture never plans.

TDD: a new dom case replaces the control's `actionHandler` in place and drives the
same step that snaps at 310. RED at `expected 310 to be 306` before the guard; GREEN
after. In-place mutation rather than a replaced control object — spreading Fabric's
`Control` drops its prototype and the test broke rendering instead of modelling a
custom handle.

Behaviour-neutral today, and now measured rather than assumed: the 36-case browser
matrix's resize half drives real `br` and `mr` handles and still passes, so the guard
does not fire on a stock handle. That matters more than the controls-manager read —
the guard compares five behaviour handlers by reference, and `controls-manager`
overrides only render, sizes, offsets and cursor.

The second deferred minor is closed too: the promoted entry now names §64 (where
resize snapping is recorded present) and cites §175 as the constraint, matching the
shape of its two siblings.
