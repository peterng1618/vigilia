# Handoff — 2026-09-13 (fifth revision)

Point-in-time state. Durable conventions, commands and traps live in
[`AGENTS.md`](../AGENTS.md); gate criteria in [`gates/gate-0.md`](gates/gate-0.md).
This file records **what is actually done, what is blocked on a human, and what
to pick up next** — none of which is inferable from the code.

Repository: `main`, pushed to `origin` (`github.com/peterng1618/vigilia`).
A commit count is deliberately not recorded here — `git log` answers it.

This revision supersedes the fourth. The headline: **the product works end to
end for the first time.** A Node CLI host serves real hardware telemetry to the
player over a transport. The fourth revision's backend direction (a Python
host) is superseded by
[ADR-0007](decisions/0007-host-in-node-shipped-as-a-cli.md) before any Python
was written.

**Three commits landed this session, none of them pushed yet.** `ba59bbd`
(editor open/save), `17a5fdf` (ADR-0007), `460bc5c` (the host). Pushing is a
real action with external effect and was not requested — decide deliberately,
and expect CI's first run to exercise the new host build step.

---

## 1. What is real and verified

Verified means **executed this session**, not inspected. Unlike the fourth
revision, every figure below was printed by a command that ran.

| Check | Result |
|---|---|
| Unit tests | **887 passed**, 36 files |
| Typechecks | **five** projects, all clean |
| Player + editor + host builds | all pass |
| §47 size gate | **200.5 KB** JS gzip / 400 KB budget |
| Browser tests | **134 passed**, 54 skipped (editor specs on phone, by design) |
| Host bundle | 29.7 KB, zero runtime dependencies |

The fourth revision's stale figures (349 unit / 38 browser / 185.2 KB) are
gone. The CI blocker it described — missing `renderer-core/src/data/` files
causing TS2307 — **is resolved**; those files are committed and the suite is
green.

### The host, and what was observed rather than asserted

`npx vigilia` (today: `node packages/host/bin/vigilia.js`) binds
`127.0.0.1:5227`, waits until the port answers, prints the dashboard and editor
URLs, and opens a browser. Run against this machine:

- `/api/sensors` listed four baseline descriptors with their provider id.
- The SSE stream delivered **real readings** — 63.68 GB total memory, ~61%
  used, CPU load varying 5–15% across cycles.
- The **first cycle reported `cpu.load` as `missing` with a reason and no
  value**, then `ok` from the second on. §83 observed, not claimed.
- `gpu.temp`, requested but unsupplied, was **absent from the batch** — a gap,
  never a zero (§97).
- `/api/health` reported `{displays: 1, polling: ["cpu.load"]}` — the union is
  only what connected displays asked for (§111).
- A headless browser at `/` was redirected to `?data=live`, reached
  `status: live`, and read history through the pull interface.
- `/editor` served to loopback; an encoded traversal got 403; `POST` got 405.

### Architecture that changed, and why it matters to your next edit

- **The C# ↔ TypeScript mirror is gone.** `AGENTS.md` used to call it the
  highest-risk edit here. The host is TypeScript and imports `types.ts`
  directly, so the bug class has nowhere left to live. The wire contract is in
  `renderer-core/src/data/protocol.ts` — **in the shared library, imported by
  both ends.** Do not define a message shape in `packages/host` and a reader in
  a display; that is the mirror rebuilt.
- **`contracts-mirror.test.ts` still passes against dead code.** Delete it with
  the C# tree. `theme/schema-sync.test.ts` is unaffected and still earns its
  place.
- **Five typecheck projects, not four.** `packages/host` joined; CI checks all
  five.
- **The host is built and refuses to start unbuilt.** Node 23.6+ strips types
  but does not *resolve* `renderer-core`'s `.js` specifiers from `.ts` source,
  so `vite build packages/host` is required. `vite.config.ts` explains this at
  length — do not "simplify" it away.

## 2. Next — the MVP's last gap, in order

### Task 1 — A starter theme. THE thing between this and a usable product.

The transport works; the **dashboard still shows mostly dashes**, and renaming
a key will not fix it.

`demo-theme.json` binds eight semantic keys: `cpu.load` (supplied),
`ram.used` (the same quantity under a *different name* from spec 0010's
`memory.used`), five extended-tier keys needing LHM, and one deliberately
unmapped. It also **hardcodes "32 GB installed"** with a fixed pie total of 32
— so pointing it at real memory would render "63.7 / 32 GB" on this machine,
a dashboard lying about the hardware. That is worse than a gap and precisely
what §97 exists to prevent. **Do not take the shortcut.**

Two pieces, and the first is a decision:

1. **The semantic key vocabulary needs one owner.** `ram.used` versus
   `memory.used` is a naming split between the fixtures and spec 0010 with no
   authority to resolve it. `AGENTS.md` pattern 3 says a mapping layer resolves
   semantic keys to providers; **that layer does not exist yet**, and this
   belongs in it.
2. **A starter theme built for real baseline keys**, served by the host, with
   no hardcoded capacities. The demo fixture stays what it is — a showcase of
   gap, outage and overflow cases for the renderer.

This pulls in host theme storage (`%APPDATA%/vigilia/`) and turns the editor's
Save from a download into a real save, which spec 0009 already anticipated.

### Task 2 — Editor shortcuts fire while typing. STILL UNTOUCHED, now confirmed.

Carried from the fourth revision and re-checked today: `editor/src/main.ts:907`
has a window-level `keydown` with **no editable-target guard** (the line moved
from 775; the gap did not). Backspace deletes the selection, arrows nudge,
Ctrl+Z undoes — mid-edit in an inspector field. Fix is one early return when
`event.target` is `input`/`textarea`/`select` or `isContentEditable`.
Source-level finding, not browser-reproduced.

### Task 3 — Chart colours ignore globals (G2-D1). UNTOUCHED, user direction recorded.

Unchanged from the fourth revision. `Fill` / `GradientStop.color` are plain
strings; `globals-commands.ts` `mapStyleValues` never walks chart fills;
`GLOBAL_GROUPS` has no gradients group. User decision stands: globals cover
pre-defined gradients (editable stop count, distribution, rgba, angle); every
fill-capable element takes gradient or solid via global-or-literal; gradient is
a JSON object, not a string; breaking changes acceptable. Still needs a schema
design before code. Caveats found by reading: `fill.ts mixHex` interpolates hex
only; angle is meaningless on the gauge-arc approximation; keep value-run text
solid; SVG-overlay gradients come after monochrome.

### Then, in order

LAN opt-in with pairing codes (§7) · the LHM extended provider · disk and
network in the baseline provider (needs `systeminformation`, and a
THIRD-PARTY-NOTICES entry *before* it is added) · a tray. 9router's
PowerShell-`NotifyIcon`-with-JSON-over-stdio tray is worth copying — it is a
real Windows tray with **no shipped binary**, which sidesteps the antivirus
false positives an unsigned Go binary attracts.

## 3. What is NOT verified — do not report these as working

- **No LAN bind has ever been exercised.** `--host`, the LAN address print, and
  the editor's 403 for a non-loopback peer are **source-level only**, tested
  from loopback alone. The §7 story is written, not proven.
- **No pairing, no short-lived codes, no revocable sessions.** `--host` is the
  only opt-in that exists.
- **Nothing has run on a real phone.** A Pixel 7 *viewport* is not a Pixel 7.
- **Keep-latest has never met a genuinely slow socket.** It is unit-tested
  against a fake, and the backpressure path in `transport/sse.ts` (`write`
  returning false, then `drain`) has not been driven by a real one.
- **The LHM extended tier is a contract with no implementation.** Every
  temperature, fan, power and clock key is unsupplied today.
- **No pixel baselines.** Browser assertions are structural on purpose — CI is
  Linux, development is Windows, glyph rasterisation differs.
- **Sample cadence is chosen, not measured.** 1 s matches what `SampleStore` is
  sized for; §126 still has no named reference hardware, so no budget exists to
  compare it against.
- **CI has not run since the host landed.** It gained a fifth typecheck and a
  host build step; both are unexercised on the runner.
- **One browser test is flaky under parallel load**, not broken:
  `display.spec.ts` "keeps the numeric readout stepping at the sample rate"
  failed once in a full run, then passed 3/3 in isolation and on a full re-run.
  It uses `page.clock` with 150 ms polls inside a 1 s sample window. If it
  fails again, suspect the timing margin, not the readout.

## 4. Blocked on a human — three items

| | What is needed | Why it cannot be done autonomously |
|---|---|---|
| **Reference hardware** | Name the PC and phones, incl. one deliberately low-end | §126 requires budgets "on named reference PCs/phones" and names none. Blocks Gate 0 sign-off, and pixel baselines with it |
| **Gate 0 probes G0-P1 / G0-P2** | Run on real hardware with real games | Per-sensor elevation breakdown and anti-cheat coexistence cannot be established from documentation. See [`gates/gate-0.md`](gates/gate-0.md) |
| **Two engine-gap decisions** | Choose an alternative for each | §85 requires explicit human agreement. Gauge gradients and line thresholds — both in `gate-0.md` |

**Resolved since the fourth revision:** the five spec-0009 backend questions
are moot — ADR-0007 chose the runtime, and LHM sourcing, launch-vs-attach,
stop-on-shutdown and the wire shape are now either settled in spec 0010 or
scoped to the unimplemented LHM provider. The wire format is no longer
"invented against an unbuilt server": it is built, running, and versioned with
a tested refusal path.

## 5. Context you cannot infer

**Bare ignore rules match at any depth, and this repo has now been bitten
twice.** The fourth revision fixed `data/` untracking
`renderer-core/src/data/`. This session found `bin/` at `.gitignore:2`
silently untracking **`packages/host/bin/vigilia.js`** — the CLI entry point,
the one file `npx vigilia` cannot start without. Both are now anchored.
`obj/`, `[Dd]ebug/`, `[Rr]elease/` and `artifacts/` are **still bare**; suspect
them the same way the moment anything lands in a directory with those names.

**A stray Claude Code config home was deleted from
`docs/gates/screenshots/.claude/`.** 78 MB, accumulating since 22 Aug, holding
live OAuth access tokens, untracked and **not** gitignored — one `git add -A`
from a credential leak. `CLAUDE_CONFIG_DIR` is unset and nothing in the repo
sets it, so the cause was external: a Claude Code process launched with its cwd
there and a home that did not resolve. The same two MCP authorisations exist in
the real `~/.claude`, so deleting cost nothing. `.gitignore` now blocks that
path and `**/.credentials.json`, anchored so the repo's **own** twelve tracked
`.claude/plugins/vigilia/` files stay tracked. If it reappears, the launcher is
the problem, not the repo.

**Never auto-fall-back to fabricated data.** The player chooses its source
explicitly: `?data=live` for the host, otherwise `@vigilia/fake-source`. The
host redirects `/` to `?data=live`, so a phone pointed at the PC gets hardware
while a bare `vite preview` keeps the fake for tests and screenshots. The
tempting behaviour — try the host, fall back to synthetic — is what §97
forbids: a dashboard that quietly swaps in invented numbers when the host dies
is indistinguishable from one that works.

**`plan.ts` decides; `mount.ts` does not.** The editor repeats the split
(`geometry`/`history`/`commands` decide; the overlay wires events) and **so does
the host**: `args.ts`, `protocol.ts`, `keep-latest.ts`, `registry.ts`,
`static-path.ts` and the `os.ts` arithmetic are pure and unit-tested; `net.ts`,
`server.ts`, `sse.ts` and `main.ts` only do I/O. Gesture maths in the overlay,
a decision in `mount.ts`, and path-safety logic inline in a request handler are
all the same mistake.

**Committed screenshots are evidence, not baselines**, refreshed deliberately
with `VIGILIA_CAPTURE=1`. A capture lands mid-animation, so they are never
byte-reproducible. This session refreshed only the three editor screenshots
(the toolbar genuinely changed) and **reverted the five player ones**, whose
~50-byte drift was animation-phase noise, not evidence.

**Four defects in one session were invisible to unit tests** and found only by
rendering. That happened again here in a new form: every host unit test passed
while the *dashboard* showed dashes, because the fixture and the provider
disagree about key names. When in doubt, render — and look at it.

**`document.fonts.check()` cannot answer "is this font available".** Chromium
returns true for a never-declared family. Availability is metric comparison;
see `scene/fonts.ts`.

**A chart whose content is entirely animated draws nothing until its animation
progresses.** Screenshots of a fresh mount must advance the clock first.

**Two documents in `docs/` are user-authored** and must not be rewritten:
`pc-stats-display-agent-plan.md` (the spec — it still carries the old project
name, intentionally) and `agent-environment-setup.md`.

**The design document is revision 9 and is the spec.** Section markers in code
(`§93`, `§122`) point into it. When code and design document disagree, the
design document wins until a human says otherwise (§164).
