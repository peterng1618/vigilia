# Status — 2026-09-13

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
| Unit tests | 1,035 passed across 41 files |
| Typechecks | five projects, clean |
| Browser tests | 137 passed, 59 skipped, 2 animation-timing failures; both passed a subsequent isolated run with one worker |
| §47 size gate | 201.1 KB gzip / 400 KB |
| Host bundle | 34.26 kB, zero runtime deps |

Style-name validation now rejects unknown properties on nodes and both text run
variants using the existing capabilities vocabulary. The schema enum is checked
against that owner. All five typechecks, 1,035 unit tests, all three builds and
the size gate passed on 2026-09-13. No schema version bump: this rejects
previously ignored unknown names while retaining the v1 property vocabulary.

Chromium 1243 installed successfully, clearing the prior launch blocker. The
full browser run had two desktop timing failures: "animates by default, and not
when static is asked for" and "keeps the numeric readout stepping at the sample
rate, not interpolated". Both passed an isolated one-worker rerun. The full
suite is not clean; timing stability remains unverified.

## Next, in order

**1 — A layer panel.** This is a **correctness** feature: a hidden element
cannot be reselected, so hiding one and clicking away loses it (only undo
recovers it). `hitTest` skipping hidden nodes is right; the tree is the
non-visual route a hidden node needs.

Extend `ACTIONS` first — `commands.ts` has `reorderNode`, `setNodeFlags` and
`insertNodes`, but `actions.ts` has no ids for them, so a panel built today
would hard-code its own labels and enablement. Also worth doing first: an
`actionButton()` factory and shared chrome (button styling is copied five
times).

Unlocks a latent bug: `ungroupNodes` drops a hidden group's `visible: false`
and would reveal its children — unreachable today only because a hidden group
can't be selected.

**2 — Schema v2, as one change.** Everything breaking together, so there's one
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
