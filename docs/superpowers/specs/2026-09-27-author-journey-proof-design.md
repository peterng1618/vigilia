# Author journey proof

- **Status:** active; the from-blank rebuild has been driven once and its findings
  fixed. Plan of record:
  [`2026-09-29-author-journey-proof.md`](../plans/2026-09-29-author-journey-proof.md)
  — its **Done** section is the checked-off list and its **Findings backlog** the
  live queue. This spec states the obligation; the plan records the evidence.
- **Date:** 2026-09-27
- **Queue:** after reference-theme fidelity; before the font trio catalogue.
- **Plan refresh required when activated (2026-09-27).** Reference-theme fidelity is
  still changing the surface this spec proves — panels and their material controls,
  glass, tracked typography, gauge and caption authoring, chart families, the semantic
  key vocabulary and the device-identity rules. **The plan must be written against the
  delivered surface, not inherited from any earlier draft of this scope.** The
  from-blank requirement below is not negotiable and does not expire with the refresh.
- **Amended 2026-09-29, after the reference-theme plan was archived.** The frosted
  material landed later than the list above was written (`a4cd444` and the commits
  under it), so it joins the surface this spec proves: `palette.frost` at **30 %**,
  the `frostInk` and `frostArea` chart tokens, `saturate(1.6)` composed into the
  blur's own filter list, and `frostedCard()` as the theme's one card primitive.
  A from-blank rebuild picks those tokens and sets that radius through the glass
  controls, so the plan is written against them — see
  [0013](../../decisions/0013-frost-is-diffusion-grain-saturation-and-an-edge.md).
  The tint is a **global token** by §73, so a rebuild varies it by editing a token
  and never with a per-panel control; a control the rebuild needs and cannot find
  is a finding, not something to work around.
- **Amended 2026-09-30, after the first rebuild — the obligation was not merely
  unmet, it was unmeetable.** The composition existed because a generator emitted
  it, and **no author could have produced it**: a chart could not be bound to a
  sensor (a new chart showed zero binding controls, and the composition is mostly
  charts), and a text object could not carry a second run, so `"62%"` plus a unit
  had nowhere to live. Both are now fixed, and **once the surface was honest all
  eight regions built in 1.9 minutes** — the first three took longer than the last
  five combined, because the pass was more than half *fixing the surface* than
  building on it.

  Three further corrections belong on the record, because each was an error in
  the pass's own reasoning rather than in the product:
  - **The editor is desktop-only** (`tests/e2e/surface.ts` says so and eight specs
    guard on it), while **a phone is the main display type** and the **player is
    the product's face**. The pass held this backwards for hours and it cost a
    false finding and a commit that had to be reverted.
  - **Frosted glass read as a tint because the control wrote `palette.panel` at
    85 %,** not `palette.frost` at 30 %; enabling glass did not change the fill.
    Transmission over a real photograph went **0.216 → 0.718**.
  - **The spec's "the authoring surface exists" premise was wrong for the whole
    of the object-authoring half.** The inspector, palette and type panels were
    real; the ability to *place and bind* the objects was not.

## Intent

**Promise:** build a dashboard from a blank scene, save it, and run it, and get
what you designed.

The authoring surface exists: a selection inspector, run placeholders, a Style
tab, a theme library, stored thumbnails, an active-theme host. This spec does not
re-specify them. It records the one obligation that nothing else discharges —
**proof that an author can actually get from blank to a finished theme using
what shipped.**

## What already shipped

The surface this proof runs against is present in the tree, not merely
specified. The design record for each is the linked spec:

| Area | Spec |
|---|---|
| Selection inspector, geometry, in-place editing entry | [authoring and consumer polish](2026-09-24-authoring-and-consumer-polish.md) |
| Opacity, resolved references, run-level style, Style tab | [author journey](2026-09-24-author-journey.md) |
| `@token` authoring display and its three states | [authoring-time run placeholders](2026-09-24-authoring-time-run-placeholders.md) |
| Active theme, derived required devices, library, paired display | [consumer journey](2026-09-24-consumer-journey.md) |
| Rendered thumbnail beside the package | [theme thumbnails](2026-09-24-theme-thumbnails.md) |

Every spec in that table — consumer-side rows included — still reads
`in progress`, and each of their plans still holds unchecked boxes, while the
features are present in the tree. **That status debt belongs to this plan.**
Phase 1 observes the surface and only then flips a spec to `implemented`,
recording what was observed in its Acceptance section as `specs/README.md`
requires. Until that happens, the honest reading is "shipped, unverified" — the
weaker of the two.

Three obligations `STATUS.md` also still lists as unverified, written against the
delivered surface rather than the superseded plans: the browser round trip of
text alignment/wrap/overflow, in-place edit plus undo, and run preset/override
persistence. Phone-width surfaces are exercised by the suite but have not been
inspected by eye.

A sixth stale status, found by the same review and owned on the same terms:
[settings scope](2026-09-24-settings-scope.md) reads `in progress` though its
plan is already archived, so only the status line is owed. It concerns host
settings rather than the author journey, and is closed on the same Phase 1
observation.

## The proof obligation

**Rebuild the whole reference composition from a blank scene, by hand, through
the UI alone.**

The composition is the target in
[reference theme fidelity](2026-09-26-reference-theme-fidelity-design.md): the
tracked wordmark and subtitle, the clock/date card, the CPU, GPU, RAM and VRAM
cards, the RAM partial gauge and VRAM full ring, the Performance Trends panel,
the Storage bar and the Network panel — every binding, caption, icon and panel
material.

Why this and not a walkthrough: the composition exists because
`createNewFabricTheme` emitted it. Code-only starter properties conceal missing
authoring controls, which is the exact failure this pass exists to find. The
reference plan proves one representative card; this proves the whole thing.

**The blank state does not exist yet, and the pass is what shows that.** `New`
emits the finished composition, so an author who opens the product is handed a
dashboard they did not make, and the only route to a blank scene is to select
everything and delete it. That is a workaround no author is expected to
understand, and building the proof on it would measure the workaround rather
than the surface. **The plan therefore opens by making the blank state real**:
`New` offers a blank theme at an artboard the author chooses, and the starter
becomes an explicit template rather than what `New` means. The rebuild starts
from there. This is the plan delivering the obligation above, not working around
it.

**The artboard sizes are a derived preset, not authored data.** A new theme is
offered at 16:9, 19.5:9 or 4:3, landscape or portrait, at 1080p, 2K or 4K — the
last naming the short edge, so 16:9 lands on the familiar 1920 × 1080 and
19.5:9 on 2340 × 1080. No entry is named after a device. The same list drives
the artboard controls, so a size the author types by hand is still theirs.

Rules, all binding:

- No generator, starter file, fixture, hand-edited JSON, or developer
  intervention at any point. Rebuilding the shipped starter and calling it done
  is not a pass.
- **A control that does not exist is the finding.** Do not work around it with
  the dock, a drag, or code.
- Gaps, friction and visual quality are findings in their own right. A journey
  that completes but is unpleasant has still failed.
- The authoring surface is judged as an author sees it: are the controls
  findable, does the result look like the reference, does save give honest
  feedback.

## Finding protocol

A finding is any of: a missing control, a broken round trip, a control that
exists but cannot be found, or a result that does not match what was designed.

Findings go in the plan's **Findings** table as they are observed, with the
surface, what happened and whether it blocks the journey. That table is the
durable record during the rebuild; the pass is not auditable without it.

A finding judged complex or large — by the signals in
[GitHub Issues as the backlog](2026-09-27-github-issues-backlog-design.md) — is
filed as an issue as soon as it is observed, so nothing is lost if the session
dies. A small finding whose cause is understood and whose fix sits inside one
owner is fixed here without one. Nothing goes three attempts unrecorded. The
Findings table is the working record and the issue is the durable one; no
finding is duplicated in specs, status or reports.

Classification is the author's call at observation time:

- **Blocking** — the journey cannot complete, work can be lost, or data is
  misrepresented. **Fixed in this plan**, using what the repo already decides:
  the owner named in `ownership.md`, the idiom of the surrounding code, the copy
  in `ui-copy.ts`, and the pattern the existing controls set. A property that is
  not exposed, a layout that does not line up, something hard to read, an icon
  that is not Lucide — each is fixed, regression-tested, and passed over. A
  reasonable decision from what is already here is a decision, and making it is
  the work.
- **Deferred** — recorded, not fixed here, with the reason. Reserved for what is
  not blocking.

## Definition of done

1. The reference composition is rebuilt from a blank scene by hand through the
   UI, and compared against the target.
2. Every gap, friction point and visual-quality problem is in the Findings
   table. None silently dropped.
3. Every blocking finding is fixed here, decided from what the repo already
   owns, and the rebuild moved past it.
4. The three unverified round trips are driven in a browser, and the phone-width
   surfaces are inspected by eye.
5. The five status debts in "What already shipped", and the settings-scope one,
   are closed on observed evidence, and their plans archived.

## Not claimed

**No usability rate.** One tester drives this pass, so a self-measured
completion percentage would measure familiarity with one's own product and
would drift optimistic over time. None is recorded, and none should be inferred
from this pass. A real rate needs a fresh cohort and is out of scope here.

The seven-day sequence, tester recruitment, the ≥80% unassisted-completion
target and the coached-session protocol are removed, and are not replaced by
another schedule. The promise and the proof obligation above are what survive
from that framing.

## Non-goals

- A second editor, a general graphics editor, or a redesign.
- New renderer, scene model, persistence path or telemetry pipeline. Fabric
  JSON remains the persisted scene (§31, §57, §67).
- New typography, ruler, grid, guide or snapping capability beyond what the
  reference composition needs.
- Consumer discovery polish beyond opening and running an authored theme;
  thumbnail galleries and decorative onboarding.
- Additional presets, fonts, languages, chart treatments or integrations.
- Internal v1-format removal, settings reorganization, cosmetic consistency
  passes, and agent-workflow changes.
- Weather, daily totals, processes, music and to-do panels.

These are not deletion orders and not cancellation of queued work. They bound
this pass only.

## Boundaries

Follow [ownership](../../architecture/ownership.md) and extend existing owners:
editor interaction/history/persistence for authoring, palette and type managers
for references, `scene-fabric` for serialization and rendering, host/player
owners for real execution. A proof pass does not earn a new owner.

Proof work changes what a proof finds; it must not weaken the guarantees it is
proving. Specifically, do not lose authored work, do not let a fix fabricate or
default data (§97), do not let one history entry become two or none (§67), and
do not break save/reopen/export correctness to make a control work. Security,
privacy and essential keyboard access are not tradeable for a smoother journey.

## Acceptance

- The composition is rebuilt from blank by hand through the UI, with no
  generator, starter, fixture or JSON, and compared to the target.
- Every gap, friction point and visual-quality problem observed is in the
  Findings table with a blocking/deferred classification.
- Every blocking finding is fixed in the pass, decided from what the repo already
  owns; a finding is never dropped by omission, and one that is a genuine product
  unknown is recorded with that said plainly.
- Text alignment, wrap and overflow round-trip through save/reopen in a
  browser, with the persisted envelope inspected rather than only the DOM.
- In-place text editing commits, undo restores the previous text, and the
  result survives save/reopen.
- A run's preset reference and style overrides round-trip through save/reopen.
- Phone-width surfaces are inspected by eye, not only by suite.
- Each of the shipped specs records what was observed and reads `implemented`;
  its plan is archived.

## Verification

The rebuild is driven by hand in a browser against the real host. It is
inherently visible-behaviour work: §33 requires rendered observation, and
object counts or geometry assertions do not discharge it.

Claimed surface claims are proven with the broad gate and the full local browser
run at the pass boundary, not inferred from a focused check. A fixed blocking
finding leaves a regression test that fails when the fix is disabled. Rebuild
affected bundles after source changes and after restoring a deliberate break.

Report what was not verified. A partially completed pass is reported as partial,
not rounded up to the promise.

## Related

[reference theme fidelity](2026-09-26-reference-theme-fidelity-design.md) —
supplies the composition and proves one representative card. This spec proves
the whole composition afterwards and before the font trio picker changes the
type-authoring surface.

Product requirements: §§31, 33, 35, 57, 61, 67, 73, 75, 89, 93, 97, 139.

Next gate: review this written spec. Only afterward write the implementation
plan; keep it queued until `STATUS.md` activates it, behind reference theme
fidelity.
