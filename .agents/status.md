# Status — 2026-09-14

A snapshot, and the one file here that goes stale on purpose. Every figure below
must have been printed by a command that ran — **update this file before every
commit and push** (AGENTS.md §9).

Durable rules are in [`AGENTS.md`](../AGENTS.md), structure in
[`architecture.md`](architecture.md), decisions in
[`decisions.md`](decisions.md), lessons in [`lessons.md`](lessons.md).

## Works, end to end

A Node CLI host (`vigilia-dashboard`) serves real hardware telemetry over SSE to
the player, and the editor loads, edits and saves a theme. **TypeScript only** —
the C# tree, its solution, `global.json` and the paused CI backend job were
deleted on 2026-09-13 (26 files that had never compiled), along with
`contracts-mirror.test.ts`, whose subject no longer existed. Observed on this
machine: four baseline sensors, real readings, `cpu.load` reporting `missing`
with a reason on the first cycle and `ok` after, and an unsupplied `gpu.temp`
absent from the batch rather than zeroed.

The editor now exposes scalar chart settings for all four chart families. Rows
come from `renderer-core/src/charts/settings-fields.ts`; the inspector does not
re-list them. Same-family multi-selections show shared or mixed values, edits
are range-checked through the same descriptors, and mixed families show no
incompatible settings section.

| Check | Result |
|---|---|
| Unit tests | 1,045 passed across 42 files |
| Typechecks | five projects, clean |
| Browser tests (editor, desktop) | 57 passed with 2 workers (10-worker parallel run had 2 timing flakes that pass in isolation) |
| Browser tests (display, desktop) | 43 passed, 1 skipped |
| §47 size gate | 201.1 KB gzip / 400 KB (user-measured this session; player bundle byte-identical since — same content hashes in rebuild) |
| Host bundle | 34.36 kB, zero runtime deps |

Style-name validation now rejects unknown properties on nodes and both text run
variants using the existing capabilities vocabulary. The schema enum is checked
against that owner. All five typechecks, 1,035 unit tests, all three builds and
the size gate passed on 2026-09-13. No schema version bump: this rejects
previously ignored unknown names while retaining the v1 property vocabulary.

Panel scrollbars no longer cover content and no panel grows a horizontal bar
(committed as `6f3b628`). One `scrollAreaStyle` owner in `button.ts`
(`overflow-y:auto` + `overflow-x:hidden` + `scrollbar-gutter:stable`); themed
thin bars via `--vigilia-scrollbar-*` tokens in `index.html`; overlay hexes now
reference panel tokens. Content padding moved from the sidebar shells onto the
scroll containers (14px leading, 6px trailing) so the bar sits close to the
panel edge. Verified: five typechecks clean, 1,045 unit tests pass,
editor+player+host build, desktop Chromium 100 passed / 1 skipped.

Chromium 1243 installed successfully, clearing the prior launch blocker. The
full browser run had two desktop timing failures: "animates by default, and not
when static is asked for" and "keeps the numeric readout stepping at the sample
rate, not interpolated". Both passed an isolated one-worker rerun. The full
suite is not clean; timing stability remains unverified.

## Next, in order

**1 — The editor manager refactor.** IN PROGRESS, started 2026-09-14. Restructure
`packages/editor` as one manager per domain behind a composition root, modelled
on `fabricjs-image-editor`'s separation of concerns — see
[`decisions.md`](decisions.md) and the contract in
[`architecture.md`](architecture.md) §4. Adds no dependency. Seven phases: 0
conventions · 1 the `EditorCore` seam · 2 actions gain bodies · 3 a manager per
existing domain · 4 the DOM half · 5 the empty slots (tools, clipboard, file,
tick) · 6 the duplications the new rules forbid.

**Phase 0 — done, documentation only.** The manager contract, the
persisted/derived/transient taxonomy, folder roles, the filename vocabulary and
a 500-signal/800-stop size ceiling, plus the decision record.

**Phase 1 — done.** `EditorCore` is the composition root, with `NoticeManager`,
`DocumentManager` and `SelectionManager` behind it; `history.ts`,
`selection.ts` and `hit-test.ts` moved into `document/` and
`selection/domain/` unchanged and stayed pure. `MANAGER_REGISTRATIONS` is the single declaration — the key
union, the root's typed fields and construction order are all derived from it,
so adding a manager is one array entry. `destroy()` walks it in reverse, and a
manager that throws during `init()` unwinds what was already built.

Three of the four binding tests exist (`core/boundaries.test.ts`,
`core/editor.test.ts`): a manager may not import a peer's module, `core/` may
not reach a manager except through the table, the table must match the
filesystem, and no file may exceed 800 lines. The size rule is a **ratchet** —
`main.ts` is recorded at its current 1,328 and may not grow, and the entry is
deleted when it drops under the limit. Action coverage waits for Phase 2. **The
ceiling is editor-only so far**; it widens to every package in Phase 6, once
`renderer-core/src/theme/validate.ts` (1,138) is split.

Three defects closed as a side effect: a stale refusal message no longer
survives into the next drag (the status bar repaints on a `notice:changed`
event rather than at six call sites, two of which returned early); the
identity-refusal rule that decides whether an edit becomes an undo entry now
has one home in `DocumentManager.commit`; and `enteredGroups` can no longer be
omitted from a hit-test, because the manager supplies it rather than each of
the three call sites passing it by hand.

Verified 2026-09-14: 1,089 unit tests across 48 files, five typechecks clean,
editor + player builds, §47 gate 201.1 KB of 400 KB, `npx playwright test
--workers=2` 141 passed / 61 skipped / **0 failed**. Two guards were confirmed
the way lessons.md demands — the teardown-unwind test by disabling the unwind,
the peer-import rule by adding a real facade import — and both failed as they
should before being restored.

**Not claimed:** `main.ts` is only modestly smaller (1,349 → 1,300). Phase 1
built the seam; the shrinking happens in Phases 2–4. The event map has exactly
one event in it, deliberately — events are added in the commit that adds their
first subscriber, so the other ~25 redraws are still explicit `render()` calls.
`collectIds` is imported from `commands.ts` by `selection/`; it is a pure
`ThemeNode` query whose real home is `renderer-core` beside `walkNodes`, and
moving it is Phase 3 or 6 work.

The safety net for phases 1–4 is `tests/e2e/editor.spec.ts`'s 57 structural
assertions, so **no `data-vigilia-*` hook may be renamed while they are in
flight**.

**DONE 2026-09-13 — a layer panel** (`8ede8d8`). Bottom-right panel below
the inspector (theme tab moved left); pure `buildLayerTree` over
`placeNodes` for effective visibility/lock, topmost-first; eye + lock toggles,
reorder via `layer.reorder-*` actions + shortcuts; hidden nodes reselectable
outside hit-testing. `ungroupNodes` now preserves `visible: false` (latent bug
fixed, tested). Shared chrome in `button.ts`, `nodeLabel` owner, colour tokens
in `index.html` CSS vars. Spec: [0012](specs/0012-editor-layer-panel.md).
Verified: 5 typechecks clean, 1,045 unit tests pass, editor+player+host build,
2/2 layer E2E pass; full editor E2E 55/57 under 10 workers with the 2 failures
passing in isolation (known timing-flake class).

**2 — Schema v2, as one change.** Sequenced *after* the refactor deliberately, so
it lands where the document model, globals and inspector each have one owner —
and so `resize-children.ts` is deleted rather than moved twice. Everything breaking together, so there's one
migration: group loses its stored transform; palette becomes rgba; gradients
become palette tokens; `fonts`/`fontSizes` become `typePresets`; a reserved
undeletable `palette.none`; `name` removed in favour of `id`; artboard
`width`/`height` editable. v1 is **refused, not migrated** (§141) — the five
in-repo fixtures get rewritten by hand. See [spec 0011](specs/0011-editor-property-model.md).

Two consequences to handle in the same change: group resize handles come off the
canvas (size isn't a group operation), which makes `resize-children.ts` dead
code; and `deleteGlobal` switches from refusing to reassigning with a
`palette.none` fallback.

**3 — The starter theme, and host theme storage.** Still the thing between this
and a usable product: the dashboard shows mostly dashes. `demo-theme.json` binds
five extended-tier keys needing LHM and hardcodes "32 GB installed" with a fixed
pie total of 32 — pointing it at real memory would render "63.7 / 32 GB", a
dashboard lying about the hardware. **Don't take that shortcut** (§97). Needs a
starter theme on real baseline keys, storage in `%APPDATA%/vigilia/`, and a menu
bar for open/save/activate.

**Then:** LAN opt-in with pairing codes (§7) · the LHM provider · disk and
network in the baseline provider (needs `systeminformation`, and a
THIRD-PARTY-NOTICES entry *first*) · a tray.

## Not verified — don't report these as working

- **No LAN bind has ever been exercised.** `--host`, the LAN address print and
  the editor's 403 for a non-loopback peer are source-level only.
- **No pairing, no revocable sessions.** `--host` is the only opt-in.
- **Nothing has run on a real phone.** A Pixel 7 viewport is not a Pixel 7.
- **Keep-latest has never met a slow socket.** Unit-tested against a fake; the
  `drain` path in `transport/sse.ts` is undriven.
- **The LHM tier is a contract with no implementation.** Every temperature, fan,
  power and clock key is unsupplied.
- **The browser suite never exercises the host.** Playwright previews each
  bundle on its own port; there is no HTTP test of the host at all. This is how
  the editor once shipped unable to boot while all five checks passed.
- **No pixel baselines**, deliberately — CI is Linux, development is Windows.
  Committed screenshots are *evidence*, refreshed with `VIGILIA_CAPTURE=1`; a
  capture lands mid-animation so they are never byte-reproducible.
- **Spec 0011 D0, D4, D6–D10 are specified, not implemented.** D1, D2 and D5
  have landed.
- **~25 editor defects confirmed by audit remain open**, each
  browser-reproduced: an entered group is never left by clicking outside it; a
  locked node can be grouped then moved through its group; snapping is computed
  from the selection rather than what will move; a multi-selection can't be
  rotated; distribute's refusal names the wrong number; every inspector edit
  commits even a no-op; invalid global values are accepted while the canvas
  keeps painting the old one; unsaved work is discarded silently on open; the
  editor never ticks, so binding readouts are frozen while authoring.
- **CI has not run since the host landed** until the most recent push.

## Needs a human

**Nothing.** The four design-document amendments that were blocking are written
into [`design/plan.md`](design/plan.md) directly — that document is agent-owned
as of revision 10, so approved changes no longer wait on a paste.

What is still wanted from the user is **goals, product taste, scope, and any
decision with external effect** — not architecture. See the plan's preamble.

---

Durable lessons from past sessions are in [`lessons.md`](lessons.md), not here —
this file is a snapshot and that one is not.
