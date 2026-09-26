# Author-first seven-day release

Date: 2026-09-26
Status: queued spec; written-spec review pending; no implementation plan.

## Intent and release promise

Primary audience: theme authors creating dashboards from scratch. They must
finish a theme without broken editor or theme functionality, find authoring
pleasant and intuitive, and see the theme work as expected.

Release promise: **Create your own dashboard from a blank canvas, save it, and
run it with results matching what you designed.**

This spec records the agreed release outline, not authorization to start work.
`STATUS.md` retains the sole active implementation plan. Existing queue order
stays unchanged; activate this scope only through the normal Superpowers
written-spec review and implementation-plan gates. Days below are relative to
activation, not a claim that release work has already started.

## Scope and definition of done

Minimum acceptance journey:

> Start blank. Set dashboard dimensions. Add and style a heading, live sensor
> value, and chart. Arrange them. Save, close, reopen, export, and run the theme
> in the real player.

This journey is minimum proof, not permission to leave other exposed features
broken. Release requires:

- Fresh installation reaches a usable blank editor through documented steps.
- Authors complete the journey without developer intervention or JSON editing.
- Save/reopen and export/import preserve authored content, assets, bindings,
  and supported styling; player rendering matches the intended layout.
- Real data updates correctly. Missing/non-`ok` data stays visibly unavailable,
  never fabricated as zero or a default reading.
- No known defects block completion, lose work, misrepresent data, or make
  exposed functionality unusable.
- Essential keyboard access, validation, security and privacy remain intact.
- Representative first-time authors demonstrate usability. Developer fluency
  and passing automated tests alone do not establish intuitive authoring.

Pleasant and intuitive means authors find relevant controls without repeated
searching, understand save/error feedback, and recover from mistakes without
losing work. Uniform cosmetic perfection is not required.

Release is a narrowly supported author-first preview. Day 1 freezes and
records supported desktop authoring and player environments. Removing an
exposed feature requires an explicit scope decision and honest documentation;
a broken control is not an acceptable shortcut.

## Question and smallest probe

Working hypothesis, not a user-reported debate: can authors already succeed
with a few targeted fixes, rather than another round of broad editor polish?

Use today's build for three 30-minute observed blank-canvas-to-running-dashboard
sessions with target authors. No starter template, coaching, guided demo or
hidden developer fixes. Authors choose their own layout. Observe stops, control
expectations, save feedback and preview/player mismatches; afterward ask what
nearly made them give up. Rank failed outcomes, not cosmetic preferences.

The prototype is this end-to-end usability session, not a second editor or
throwaway implementation. Manual observations suffice; no analytics subsystem.

## Seven-day sequence

### Day 1 — Freeze the release contract

Freeze the acceptance journey, supported environments and exposed-feature
inventory. Recruit three early testers and five fresh release testers. Record
trust/completion blockers separately from optional enhancements. Admit new work
only when it protects the release promise.

Outcome: release checklist and booked usability sessions.

### Day 2 — Observe the rough prototype

Run the three early sessions. Record each blocked step, expected behavior and
whether intervention was necessary. Repeated failure at one step is product
work, not optional polish.

Outcome: ranked, observed authoring blockers.

### Day 3 — Repair the creation path

Fix the highest-impact insertion, selection, arrangement, text editing, styling,
binding-discovery and mistake-recovery failures. Prefer existing controls,
clearer labels and sensible defaults over new systems. Verify affected rendered
behavior and leave focused regression proof.

Outcome: usable blank-to-authored-theme path; no unrelated feature expansion.

### Day 4 — Protect work and output

Exercise real save/reopen/export/import/player round trips, including assets
and live bindings. Check invalid imports, unavailable data, missing assets and
connection interruption: failures must be visible and preserve recoverable work.

At activation, recheck the outstanding evidence in `STATUS.md`; on 2026-09-26
it includes text alignment/wrap/overflow round trips, in-place edit plus undo,
and run preset/override behavior. Verify applicable exposed paths rather than
assuming recent fixes covered them.

Outcome: persistence and player correctness supported by rendered evidence.

### Day 5 — Verify the release candidate

Complete any outstanding whole-branch review and run repository release gates
against the exact candidate. Investigate failures. Exercise installation and
the acceptance journey outside the development setup; inspect desktop authoring
and intended player sizes. Prepare short install/create/save/run/recovery
instructions, supported-environment notes and honest limitations.

Outcome: installable candidate; feature freeze.

### Day 6 — Measure unassisted success

Give five fresh target authors the same blank-canvas task and 30-minute limit.
Success requires completing the entire journey without coaching, preserving
work after reopen, and running the theme with intended appearance and working
bindings. Count non-completion and intervention as failures. Published
getting-started instructions are allowed; real-time developer guidance is not.

Fix only completion blockers and trust defects; rerun affected technical
checks. Report the first fresh-cohort result unchanged. Retesting coached or
previously exposed participants does not replace the fresh-cohort metric.

Outcome: measured release decision, not a collection of compliments.

### Day 7 — Ship the author-first preview

Ship the installable blank-canvas editor, dependable persistence/export,
real-player execution, short guide, honest limitations and one feedback channel.
Publishing still requires the user's explicit authorization.

Do not wait for queued polish. Do not release known data-loss, security or
false-data defects. If trust/completion gates or usability target fail, report
a missed release gate and continue explicitly supervised evaluation; do not
call that a completed release. Missing tester evidence is not a passing result.

**One outcome number:** unassisted blank-to-running-theme completion rate within
30 minutes, measured on the five fresh Day 6 authors. **Target: at least 80%
(four of five).** This is a small-sample learning signal, not market validation.

## Defer without leaving broken features

- Further snapping fidelity beyond predictable, usable placement.
- New rulers, grids, guide modes and precision tools.
- Thumbnail galleries and decorative onboarding.
- Consumer discovery polish beyond opening/running the authored theme.
- More presets, fonts, languages, chart treatments and integrations.
- Broad settings reorganization and cosmetic consistency passes.
- Internal v1-format removal and unrelated architectural cleanup.
- Agent-workflow improvements unrelated to release safety.

These are release non-goals, not deletion orders or cancellation of queued
work. At activation, reconcile overlapping author-journey, snapping and polish
work; reuse existing implementation and evidence instead of opening parallel
plans. An observed completion/trust failure overrides a feature's polish label.

## Change boundaries and architecture

| Safe to change or defer | Must not break |
|---|---|
| Unreleased internal APIs and implementation structure | Existing user work without explicit migration/recovery |
| Decorative polish and animation | Save, reopen and export/import correctness |
| Clearly disclosed unsupported environments | Promised environments and exposed controls |
| Optional features explicitly removed from release scope | Honest errors and faithful preview/player output |
| Scheduling queued enhancements | Security, privacy, essential keyboard access and truthful telemetry |

No new renderer, scene model, persistence layer or telemetry pipeline. Extend
existing owners in [the ownership map](../../architecture/ownership.md): editor
interaction/history/persistence for authoring, theme-package and validation
boundaries for imported content, scene-fabric for serialization and rendering,
and host/player owners for real execution. Fabric JSON remains persisted scene;
runtime data, playback and viewport state remain transient.

## Verification and handoff

Unit-test pure decisions; browser-test wiring and visible behavior. Demonstrate
new regressions fail with their fixes disabled. Rebuild affected bundles after
source changes and deliberate-break restoration. Real-host claims require tests
that start the real host. Inspect rendered output; screenshots support evidence,
not cross-platform golden comparisons.

Use focused checks during repairs and the repository's broad gates at candidate
boundary. Record exact candidate, tested environments, results and unverified
behavior. Do not infer release readiness from historical green results.

Related scope: [author journey](2026-09-24-author-journey.md),
[authoring and consumer polish](2026-09-24-authoring-and-consumer-polish.md),
[product requirements](../../product/requirements.md).

Next gate: user reviews this written spec. Only afterward create a phased
implementation plan; keep it queued until `STATUS.md` explicitly activates it.
