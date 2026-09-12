# Handoff — 2026-09-12

Point-in-time state. Durable conventions, commands and traps live in
[`AGENTS.md`](../AGENTS.md); gate criteria in [`gates/gate-0.md`](gates/gate-0.md).
This file records **what is actually done, what is blocked on a human, and what
to pick up next** — none of which is inferable from the code.

Repository: 3 commits on `main`, no remote, working tree clean.

---

## 1. What is real and verified

Verified means *executed in this session*, not inspected.

| | Status |
|---|---|
| `renderer-core` unit tests | **85 passing**, 3 files |
| TypeScript typecheck, both projects | **clean** (TS 7.0.2, `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`) |
| Display-only player bundle | **builds, 111.7 KB gzipped** — budget 400 KB |
| §47 boundary gate (`check-size.mjs`) | **passing**, wired into CI |

Three renderer modules exist and are tested:

- `types.ts` — wire types mirroring the C# contracts, plus the `Fill` union.
- `artboard.ts` — the §51 uniform fit/cover transform. Spec:
  [`.agents/specs/0001-artboard-transform.md`](../.agents/specs/0001-artboard-transform.md).
- `charts/gauge.ts` — typed gauge settings → ECharts, incl. the angular-gradient
  approximation.
- `charts/line.ts` — line / filled-area / sparkline, incl. the series-form gap rule.

## 2. What is NOT verified — do not report these as working

- **No .NET code has ever been compiled.** There is no .NET SDK on this machine,
  only the EOL 6.0.35 runtime. Everything under `src/*.csproj` and
  `tests/*.csproj` is authored-but-unbuilt: the contracts, the fake provider, the
  conformance suite, `LatestSnapshotQueue`, `DriverAvailabilityProbe`, the host.
  **Expect first-build errors.** Install the .NET 10 SDK before any claim.
- **The agent-environment plugin has never loaded.** `.claude/settings.json` does
  not exist (see §4 below), and plugin loading cannot be verified from the session
  that wrote it anyway. A fresh session must confirm the five `vigilia:` skills
  appear.
- **CI has never run** — there is no remote.
- **Nothing has been rendered visually.** The chart adapters are verified by
  asserting emitted option objects, not by drawing pixels. No Playwright suite
  exists yet.

## 3. Next work, in priority order

Everything here is unblocked and verifiable locally.

1. **Bar / progress-bar family** (§81) in `charts/bar.ts`. The last of the three
   v1 families still missing. Follow the pattern the other two established:
   typed settings → a local explicit option interface → tests asserting the
   emitted object. Thresholds *are* natively expressible here (per-item colour),
   which makes it the counter-example to the line gap.
2. **Pie / donut** (§81), and note §83's requirement to *distinguish pie
   composition from gauge progress* — they are different semantics, not two
   skins of a ring.
3. **Theme document model** — TypeScript types mirroring
   `schema/theme-document.schema.json`, plus a validator. This unblocks the JSON
   round-trip that Gate 0 and Gate 1 both require.
4. **Typography measurement** (§89–§91): styled runs, and reserving stable text
   boxes during font load. Pure-logic parts are testable now; glyph metrics need
   a browser and therefore Playwright.
5. **A Playwright visual harness.** Prerequisite for the Gate 0 demonstration
   set, and for the editor bake-off, which ADR-0001 requires to be
   foundation-agnostic — it must test *our* renderer contract, not a candidate's
   API.

Deliberately **not** started: anything in `src/Vigilia.*`. Writing more C# that
cannot be compiled would add unverified surface, and the existing unbuilt code is
already the largest risk in the repo.

## 4. Blocked on a human — five items

| | What is needed | Why it cannot be done autonomously |
|---|---|---|
| **.NET 10 SDK** | Install it | No SDK present; every `dotnet` command fails with a misleading "command could not be loaded" |
| **`.claude/settings.json`** | Apply one of the blocks in [`.claude/README.md`](../.claude/README.md) | Registering a plugin and granting Bash permissions changes what agents may do without prompting. A permission classifier correctly blocked an agent from writing it. Until then the `vigilia:` skills do not load |
| **Reference hardware** | Name the PC and phones, incl. one deliberately low-end | §126 requires budgets "on named reference PCs/phones" and names none. Blocks Gate 0 sign-off |
| **Gate 0 probes G0-P1 / G0-P2** | Run on real hardware with real games | Per-sensor elevation breakdown and anti-cheat coexistence cannot be established from documentation. See [`gates/gate-0.md`](gates/gate-0.md) |
| **Two engine-gap decisions** | Choose an alternative for each | §85 requires explicit human agreement. Gauge gradients and line thresholds — both recorded in `gate-0.md` with options |

Also pending, lower stakes: no GitHub repo exists (`peterng1618/vigilia` is
referenced in `Directory.Build.props` but was never created — publishing is the
user's call), and `gh` is not installed.

## 5. Context you cannot infer

**The two hard boundaries are mechanically enforced** — platform (`CA1416` as an
error, `IsWindowsPlatformProject` opt-in) and player-vs-editor (the bundle budget
gate). If the budget fails, find the leaked editor dependency; do not raise the
number.

**`Vigilia.Contracts` is hand-mirrored in `renderer-core/src/types.ts`** with
nothing enforcing agreement. A drift compiles cleanly on both sides and produces
wrong values at runtime. This is the highest-risk edit in the repository; change
both in one commit.

**The two engine gaps are inverses.** Gradients work natively on a cartesian line
and not on a gauge arc; thresholds work natively on gauge axis bands and not on a
whole-series line colour. Neither family is strictly more capable, so the Gate 0
matrix has to record both rather than picking a "better" engine path.

**The editor foundation is still undecided** (ADR-0001), and that is deliberate.
`vue-fabric-editor` hard-pins Fabric 5.3.0 with no release tags; `yft-design` uses
Fabric 6.4.1; current Fabric is 7.4.0. Building directly on Fabric 7 remains a
live third option. Do not install a candidate as a dependency before the bake-off
— "whatever got installed first" is exactly the decision path ADR-0001 exists to
prevent.

**Two documents in `docs/` are user-authored** and must not be rewritten:
`pc-stats-display-agent-plan.md` (the spec — it still carries the old project
name, intentionally) and `agent-environment-setup.md` (the methodology the agent
environment was built from).

**The design document is revision 9 and is the spec.** Section markers in code
(`§93`, `§122`) point into it. When code and design document disagree, the design
document wins until a human says otherwise (§164).
