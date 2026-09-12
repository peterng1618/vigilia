# Handoff — 2026-09-12 (fourth revision)

Point-in-time state. Durable conventions, commands and traps live in
[`AGENTS.md`](../AGENTS.md); gate criteria in [`gates/gate-0.md`](gates/gate-0.md).
This file records **what is actually done, what is blocked on a human, and what
to pick up next** — none of which is inferable from the code.

Repository: `main`, pushed to `origin` (`github.com/peterng1618/vigilia`).
A commit count is deliberately not recorded here — it goes stale on the next
commit, and `git log` answers it.

This revision supersedes the third revision. It keeps §1–§2 intact and updates
§§3–5 for new spec
[`0009-python-telemetry-host-and-sensor-providers.md`](../.agents/specs/0009-python-telemetry-host-and-sensor-providers.md)
(draft): the backend direction is now a Python host (`psutil` baseline +
prebuilt-LHM-exe extended sensors), replacing the unbuilt C# scaffold. No
Python host code exists yet; the C# tree is still on disk and is now slated for
removal once equivalent Python contracts and tests exist.

---

## 1. What is real and verified

Verified means *executed*, not inspected.

**Nothing was executed this session.** Every Bash call was rejected — the
permission classifier (`oc/muse-spark-1.3-contributor-free`) was unavailable, so
no `npm install`, typecheck, vitest, build, Playwright, `git` write, or CI check
ran. Do not quote test counts, bundle sizes, or typecheck results from this
session; there are none. The figures in the previous revision (349 unit, 38
browser, 185.2 KB bundle) are stale by several editor milestones — do not carry
them forward. Next session: run `vigilia:verify` (or `node tools/dev-status.mjs`
from the root) and record only what it actually prints.

What exists, by reading (not by running):

- **Charts** — all four v1 families (§81): `charts/gauge.ts`, `line.ts`,
  `bar.ts`, `pie.ts`, with shared `Fill` resolution in `charts/fill.ts`.
- **Theme format** — `theme/document.ts` (types) and `theme/validate.ts`
  (import validation), guarded against the published schema by
  `theme/schema-sync.test.ts`. `contracts-mirror.test.ts` still guards dead
  C# ↔ `types.ts` names-only mirror; spec 0009 keeps TS
  `Sample`/`SampleSource`/theme contracts as compatibility boundary, C# side
  dies with tree. Spec:
  [`0002-theme-document-model.md`](../.agents/specs/0002-theme-document-model.md).
- **Rendering** — `scene/plan.ts` (pure: every decision, unit-tested) and
  `scene/mount.ts` (DOM: decides nothing), plus `scene/fonts.ts`. Spec:
  [`0003-scene-rendering.md`](../.agents/specs/0003-scene-rendering.md).
- **Data** — restored in the working tree this session, **unverified and
  uncommitted** (see §2, task 1): `data/source.ts` (pull interface),
  `data/store.ts` (bounded history), `data/store.test.ts`.
- **`@vigilia/fake-source`** — deterministic synthetic samples and the demo
  theme fixture. Dev and test only.
- **Editor** — real and substantial, contrary to the old revision: shell
  (`editor/src/main.ts`), inspector (`inspector-panel/model/apply`),
  globals panel + commands, history, overlay, geometry/hit-test/snapping/
  gestures (pure, unit-tested), arrange (group/align/distribute). Specs
  [`0004`](../.agents/specs/0004-editor-selection-and-gestures.md) through
  [`0008`](../.agents/specs/0008-editor-arrange.md). Gate 2 in progress
  (`docs/gates/gate-2.md`), with open decision **G2-D1** (chart colours).
- **Decisions since the old revision** — ADR-0005 (editor is an interaction +
  inspector layer over `renderer-core`; no Fabric, ever), ADR-0006
  (frontend-first; .NET host sequenced after Gates 1, 2, 4), now joined by
  draft spec
  [`0009`](../.agents/specs/0009-python-telemetry-host-and-sensor-providers.md):
  backend moves to a Python host (`psutil` + prebuilt LHM exe, plain WebSocket
  keep-latest, no SignalR), C# scaffold slated for removal. ADR-0006's
  sequencing rationale (unbuilt C# blocking frontend gates) still holds; its
  ".NET host later" outcome is superseded by "Python host instead". No Python
  code exists yet. Key spec constraints for build time: `psutil` owns
  CPU-load/memory/disk/network even on overlap, LHM owns temp/fan/voltage/
  power/clocks/board; one full LHM tree read per cycle, never per sensor;
  provider tree position is not identity — use strongest stable ID; LHM
  attach-to-running or launch-configured, stop only if Vigilia started it;
  LHM failure isolates, `psutil` continues, keys go stale-then-missing, never
  zero; Windows install needs prebuilt wheels only, no compiler/SDK; TS
  `Sample`/`SampleSource`/theme contracts stay boundary, C# ideas reusable
  but not compatibility target; HWiNFO/AIDA64/Afterburner, fan control,
  plugins, auto-download LHM all out of scope.

## 2. In progress — three findings, one at a time

Agreed order: finish one (docs + full tests + commit + push) before starting
the next. Task 1 is mid-flight; tasks 2–3 untouched.

### Task 1 — Renderer `data/` files missing (CI blocker). FILES WRITTEN, NOT VERIFIED.

- Cause: `.gitignore` line 34 `data/` matched at any depth, silently untracking
  `renderer-core/src/data/`. Fixed in working tree to anchored `/data/` with a
  comment saying why.
- Created, uncommitted: `src/web/packages/renderer-core/src/data/source.ts`
  (`SampleSource` pull interface + `emptySampleSource`),
  `src/web/packages/renderer-core/src/data/store.ts` (`SampleStore` bounded by
  age and per-key count, `ingest`/`latest`/`history`/`reset`,
  `defaultSampleStoreOptions`, `SampleStoreOptions`), and
  `src/web/packages/renderer-core/src/data/store.test.ts` (empty source,
  latest-per-key, age windowing, count cap, age-bound prune, reset).
- API matches the only call sites: `plan.test.ts` (`new SampleStore()`,
  `ingest(entries, NOW)`, `SampleStore | typeof emptySampleSource`),
  `plan.ts` (`latest`, `history(key, windowSeconds)`), `fonts.test.ts`
  (`emptySampleSource`). Defaults (300 s / 600 per key) cover the widest
  shipped window (300 s) at the 1 s baseline and match the line adapter cap.
- Next session, in order: `git status --short`; `git check-ignore -v`
  the two data files (expect no output); `npm install` from `src/web/`;
  four typechecks (renderer-core, player, fake-source, **editor** — four, not
  three); `npx vitest run`; both `vite build`s; `check-size.mjs`;
  `npx playwright test`. Then stage explicit paths only
  (`.gitignore` + the three data files — never `git add -A`), commit, push.
  Suggested message: `fix(build): un-ignore renderer data dir and restore
  SampleSource store` with the `Co-Authored-By: Claude Sonnet 5
  <noreply@anthropic.com>` trailer.

### Task 2 — Editor shortcuts fire while typing in the inspector. UNTOUCHED.

- `editor/src/main.ts:775` window-level `keydown` has no editable-target guard;
  `inspector-panel.ts` / `globals-panel.ts` do not stop propagation. Backspace
  deletes selection (`main.ts:820`), arrows nudge (`main.ts:839`), Ctrl+Z undoes
  (`main.ts:778`) mid-edit. Source-level finding, not browser-reproduced.
- Fix direction: single early return in the window handler when
  `event.target` is `input`/`textarea`/`select` or `isContentEditable`.

### Task 3 — Chart colours ignore globals (G2-D1). UNTOUCHED, USER DIRECTION RECORDED.

- `Fill` / `GradientStop.color` are plain strings (`types.ts:45-63`, schema
  `$defs/fill`); `globals-commands.ts` `mapStyleValues` never walks chart
  fills; `GLOBAL_GROUPS` has no gradients group.
- User decision this session: globals cover pre-defined gradients (editable
  stop count, distribution, rgba colours, angle); every fill-capable element
  (shapes, static text at minimum, SVG overlay if feasible) takes gradient or
  solid via the global-or-literal model; gradient is a JSON object, not a
  string; breaking changes acceptable (prototype). Still needs a schema design
  (gradient def shape, `Fill`-level vs colour-level refs, new `gradients`
  group, `schemaVersion` bump with clean old-reader rejection) before code.
- Caveats found by reading, for the design: `fill.ts mixHex` interpolates hex
  only (rgba needs real interpolation or a hex-only rule); angle is meaningless
  on the gauge-arc approximation (document the fallback); keep value-run text
  solid; SVG-overlay gradients come after monochrome.

## 3. What is NOT verified — do not report these as working

- **No backend exists in any language.** Spec
  [`0009`](../.agents/specs/0009-python-telemetry-host-and-sensor-providers.md)
  (draft) replaces the C# scaffold with a Python host (`psutil` baseline +
  prebuilt-LHM-exe extended sensors, plain WebSocket keep-latest transport, no
  SignalR) — but no Python host code has been written. The C# tree under
  `src/Vigilia.*` is still on disk, still never compiled (no .NET SDK here,
  only the EOL 6.0.35 runtime), and is now slated for removal once equivalent
  Python contracts and tests exist. Do not install a .NET SDK to unblock it;
  the SDK requirement dies with the C# tree.
- **Nothing has run on a real phone.** A Pixel 7 *viewport* is not a Pixel 7.
- **No pixel baselines.** Browser assertions are structural on purpose — CI is
  Linux, development is Windows, and glyph rasterisation differs.
- **No transport.** The player renders invented numbers and says so on screen.
- **CI status is second-hand this session.** The review reported TS2307 on the
  latest run with five consecutive failures, consistent with the missing
  `data/` files — but with no shell, no log was inspected. Confirm via CI logs
  after the task-1 push; do not assert it until then.
- Spec "Not verified" notes still hold: `fonts`/`assets` global groups never
  edited in a browser, no real authoring session, no open/save in-product,
  trackpad/high-DPI unverified.

## 4. Blocked on a human — four items

| | What is needed | Why it cannot be done autonomously |
|---|---|---|
| **Spec 0009 decisions** | Resolve before backend work starts: LHM-exe sourcing/bundling, launch-vs-attach default, stop-on-shutdown policy, WebSocket message + versioning shape, tray/autostart/secrets mechanism in Python | Draft spec defers these; implementing the host without them repeats the C#-scaffold mistake (authored-but-unbuilt, guessed protocol) |
| **Reference hardware** | Name the PC and phones, incl. one deliberately low-end | §126 requires budgets "on named reference PCs/phones" and names none. Blocks Gate 0 sign-off, and pixel baselines with it |
| **Gate 0 probes G0-P1 / G0-P2** | Run on real hardware with real games | Per-sensor elevation breakdown and anti-cheat coexistence cannot be established from documentation. See [`gates/gate-0.md`](gates/gate-0.md) |
| **Two engine-gap decisions** | Choose an alternative for each | §85 requires explicit human agreement. Gauge gradients and line thresholds — both in `gate-0.md` |

Resolved since the old revision: the editor foundation (ADR-0005, no Fabric)
is decided; G2-D1 has user direction (§2 task 3) and is a design task, not a
blocked question. ADR-0006's sequencing rationale (unbuilt C# stalling
frontend gates) still holds but its ".NET host later" outcome is superseded by
spec 0009 ("Python host instead"). Dropped as stale: `.claude/settings.json`
(skills load as `vigilia:*` now) and "CI has never run" (it has — currently
reported failing, see §3). Deliberately not pursued: installing a .NET SDK —
the SDK requirement dies with the C# tree per spec 0009.

## 5. Context you cannot infer

**One hard boundary is mechanically enforced; the other dies with the C#
tree.** Player-vs-editor (the bundle budget gate) stays: if the budget fails,
find the leaked editor dependency; do not raise the number. The platform
boundary (`CA1416` as an error, `IsWindowsPlatformProject` opt-in) enforced
C#-side isolation — spec 0009 removes the C# tree, so that enforcement goes
with it. Whatever isolation the Python host needs (provider-vs-host,
host-vs-frontend) must be designed with the host, not assumed from the old
projects.

**The TS side of the mirror is now the source of truth.** `Vigilia.Contracts`
↔ `renderer-core/src/types.ts` was hand-mirrored with a names-only guard
(`contracts-mirror.test.ts`); per spec 0009 the C# side dies with the tree, so
stop changing both — change `types.ts` and record the Python contract to match
it when the host is built. The theme format's twin guard
(`theme/schema-sync.test.ts`) is unaffected. A Python↔TS drift guard is owed
with the host implementation; until then the wire shape is unguarded, so do not
invent protocol against an unbuilt server (ADR-0006 rule 1 applies to Python
equally).

**`plan.ts` decides; `mount.ts` does not.** Everything that could be wrong about
a frame is computed in pure, Node-testable code. The editor repeats the split:
`geometry/history/commands` decide; the overlay wires events. Gesture maths in
the overlay is the same mistake as a decision in `mount.ts`.

**Bare ignore rules match at any depth.** `data/` untracked
`renderer-core/src/data/` with no warning — that was task 1. Anchor runtime
dir rules (`/data/`). Suspect any bare directory rule the same way.

**Four typechecks, not three** — renderer-core, player, fake-source, editor.
CI runs all four; omitting editor locally means CI finds it instead of you.

**Playwright previews built bundles.** Rebuild every bundle the suite serves
(player *and* editor — read `playwright.config.ts`) or a missing build reads as
a Playwright fault. `check-size.mjs` measures `dist/` on disk: build first.

**Committed screenshots are evidence, not baselines**, refreshed deliberately
with `VIGILIA_CAPTURE=1`. A capture lands mid-animation, so they are never
byte-reproducible; do not write them on every run.

**Four defects one session were invisible to unit tests** and found only by
rendering — the emitted object was exactly what the code intended, and the
intent was wrong (`mountScene` host positioning, gauge `progress.itemStyle`,
horizontal bar order, text/box style sniffing). When in doubt, render.

**`document.fonts.check()` cannot answer "is this font available".** Chromium
returns true for a never-declared family. Font availability is metric
comparison; see `scene/fonts.ts`.

**A chart whose content is entirely animated draws nothing until its animation
progresses.** Screenshots of a fresh mount must advance the clock first.

**Two documents in `docs/` are user-authored** and must not be rewritten:
`pc-stats-display-agent-plan.md` (the spec — it still carries the old project
name, intentionally) and `agent-environment-setup.md` (the methodology the agent
environment was built from).

**The design document is revision 9 and is the spec.** Section markers in code
(`§93`, `§122`) point into it. When code and design document disagree, the design
document wins until a human says otherwise (§164).
