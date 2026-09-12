# Handoff — 2026-09-12 (second revision)

Point-in-time state. Durable conventions, commands and traps live in
[`AGENTS.md`](../AGENTS.md); gate criteria in [`gates/gate-0.md`](gates/gate-0.md).
This file records **what is actually done, what is blocked on a human, and what
to pick up next** — none of which is inferable from the code.

Repository: 12 commits on `main`, pushed to `origin`
(`github.com/peterng1618/vigilia`), working tree clean.

---

## 1. What is real and verified

Verified means *executed*, not inspected.

| | Status |
|---|---|
| Unit tests | **349 passing**, 13 files |
| Browser tests | **38 passing** (Chromium, desktop 1280×720 + Pixel 7 profile) |
| TypeScript typecheck, three projects | **clean** (TS 7.0.2, `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`) |
| Display-only player bundle | **builds, 185.2 KB gzipped** — budget 400 KB, of which 176.7 KB is ECharts |
| §47 boundary gate (`check-size.mjs`) | **passing**, wired into CI |

**The display path works end to end.** The player loads a JSON theme document,
validates it, builds a scene plan, mounts it, and updates once a second from a
synthetic sample source. Committed renders:
[`gates/screenshots/`](gates/screenshots/).

What exists, by area:

- **Charts** — all four v1 families (§81): `charts/gauge.ts`, `line.ts`,
  `bar.ts`, `pie.ts`, with shared `Fill` resolution in `charts/fill.ts`.
- **Theme format** — `theme/document.ts` (types) and `theme/validate.ts`
  (import validation), guarded against the published schema by
  `theme/schema-sync.test.ts`. Spec:
  [`0002-theme-document-model.md`](../.agents/specs/0002-theme-document-model.md).
- **Rendering** — `scene/plan.ts` (pure: every decision, unit-tested) and
  `scene/mount.ts` (DOM: decides nothing), plus `scene/fonts.ts`. Spec:
  [`0003-scene-rendering.md`](../.agents/specs/0003-scene-rendering.md).
- **Data** — `data/source.ts` (the pull interface the renderer sees) and
  `data/store.ts` (bounded history for the transport to fill).
- **`@vigilia/fake-source`** — deterministic synthetic samples and the demo
  theme fixture. Dev and test only.

## 2. What is NOT verified — do not report these as working

- **No .NET code has ever been compiled.** There is no .NET SDK on this machine,
  only the EOL 6.0.35 runtime. Everything under `src/*.csproj` and
  `tests/*.csproj` is authored-but-unbuilt: the contracts, the fake provider, the
  conformance suite, `LatestSnapshotQueue`, `DriverAvailabilityProbe`, the host.
  **Expect first-build errors.** Install the .NET 10 SDK before any claim.
- **Nothing has run on a real phone.** A Pixel 7 *viewport* is not a Pixel 7.
- **No pixel baselines.** Browser assertions are structural on purpose — CI is
  Linux, development is Windows, and glyph rasterisation differs.
- **No transport, no assets, no editor.** The player renders invented numbers and
  says so on screen; `image`/`video` nodes plan and mount but nothing resolves an
  asset ID to a URL; there is no save path and no undo.
- **CI has never run.** A remote exists now, so the next push to a PR will be the
  first time the workflow executes — including steps added this session
  (Playwright install, browser tests, screenshot upload) that have never run
  outside this machine.
- **The agent-environment plugin has never loaded.** `.claude/settings.json` does
  not exist (§4 below).

## 3. Next work, in priority order

1. **The SignalR transport client.** The single highest-value piece, and the
   only one the renderer is already shaped for: replace two lines in
   `packages/player/src/main.ts` with a `SampleSource` backed by SignalR, feeding
   `SampleStore`. Needs the .NET host to exist, so it is really blocked on the
   SDK — but the client half can be written and unit-tested against a fake hub.
2. **Asset pipeline.** `image`, `video` and packaged fonts all wait on it: a
   resolver from asset ID to URL, plus the ZIP import rules (§141 — staging,
   traversal, decompression bombs, SVG sanitisation). Until then three node types
   and the font-loading half of §89 cannot be demonstrated.
3. **The editor** — **blocked on ADR-0001**, see §4. Do not install a candidate.
4. **Multilingual and metric typography checks** (§91): changing digit widths,
   baseline alignment and overflow at several artboard scales. The harness can do
   this now; it needs fixtures with CJK and RTL text.
5. **A diagnostics surface** (§141). `PlanIssue`s are logged, not drawn. The
   information is all there; what is missing is a design for showing it on a
   phone with no input.

Deliberately **not** started: anything in `src/Vigilia.*`. Writing more C# that
cannot be compiled would add unverified surface, and the existing unbuilt code is
already the largest risk in the repo.

## 4. Blocked on a human — five items

| | What is needed | Why it cannot be done autonomously |
|---|---|---|
| **.NET 10 SDK** | Install it | No SDK present; every `dotnet` command fails with a misleading "command could not be loaded" |
| **`.claude/settings.json`** | Apply one of the blocks in [`.claude/README.md`](../.claude/README.md) | Registering a plugin and granting Bash permissions changes what agents may do without prompting. A permission classifier correctly blocked an agent from writing it. Until then the `vigilia:` skills do not load |
| **Reference hardware** | Name the PC and phones, incl. one deliberately low-end | §126 requires budgets "on named reference PCs/phones" and names none. Blocks Gate 0 sign-off, and pixel baselines with it |
| **Gate 0 probes G0-P1 / G0-P2** | Run on real hardware with real games | Per-sensor elevation breakdown and anti-cheat coexistence cannot be established from documentation. See [`gates/gate-0.md`](gates/gate-0.md) |
| **Two engine-gap decisions** | Choose an alternative for each | §85 requires explicit human agreement. Gauge gradients and line thresholds — both in `gate-0.md`, with a third gauge option added this session |

## 5. Context you cannot infer

**The two hard boundaries are mechanically enforced** — platform (`CA1416` as an
error, `IsWindowsPlatformProject` opt-in) and player-vs-editor (the bundle budget
gate). If the budget fails, find the leaked editor dependency; do not raise the
number. 176.7 KB of the current 185.2 KB is ECharts, so our own code is not where
the weight is.

**`Vigilia.Contracts` is hand-mirrored in `renderer-core/src/types.ts`** with
nothing enforcing agreement. A drift compiles cleanly on both sides and produces
wrong values at runtime. This is the highest-risk edit in the repository; change
both in one commit. The theme format has the same shape of risk and now has a
guard — `theme/schema-sync.test.ts` reads the schema off disk — and that test is
the pattern to copy for the C# mirror once an SDK exists.

**`plan.ts` decides; `mount.ts` does not.** Everything that could be wrong about
a frame is computed in pure, Node-testable code. Put a decision in the DOM layer
and it becomes untestable without a browser, which is the whole reason the split
exists.

**Four defects this session were invisible to unit tests** and found only by
rendering. Worth knowing, because they share a shape — the emitted object was
exactly what the code intended, and the intent was wrong:

1. `mountScene` wrote `position: relative` on the host unconditionally,
   collapsing a host styled `absolute; inset: 0` to zero height and hiding the
   entire scene.
2. The gauge left `progress.itemStyle` unset for non-solid fills, so both demo
   gauges silently rendered ECharts' default blue.
3. Horizontal bars read in the opposite order from their labels, because ECharts
   puts category index 0 at the bottom of a y axis.
4. Text/box style semantics were chosen by sniffing `element.tagName`, so a
   shadow on a text node became a `box-shadow` on its container and drew nothing.

**`document.fonts.check()` cannot answer "is this font available".** It reports
whether *declared* faces have loaded, so for a family that was never declared the
answer is vacuously `true` — Chromium returns true for a font nobody has
installed. Font availability is detected by metric comparison instead; see
`scene/fonts.ts`, which documents both the trap and what the technique still
cannot tell you.

**A chart whose content is entirely animated draws nothing until its animation
progresses.** With a frozen clock the line chart and donut are blank while the
gauge and bars still show, because their tracks are static. Anything that
screenshots a fresh mount must advance the clock first.

**Committed screenshots are evidence, not baselines**, and are refreshed
deliberately with `VIGILIA_CAPTURE=1`. They are not byte-reproducible: the data
is deterministic but a capture lands mid-animation. Writing them on every run
would dirty the tree with meaningless diffs.

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
