# Handoff — 2026-09-13 (sixth revision)

Point-in-time state. Durable conventions, commands and traps live in
[`AGENTS.md`](../AGENTS.md); gate criteria in [`gates/gate-0.md`](gates/gate-0.md).
This file records **what is actually done, what is blocked on a human, and what
to pick up next** — none of which is inferable from the code.

Repository: `main`, pushed to `origin` (`github.com/peterng1618/vigilia`).
A commit count is deliberately not recorded here — `git log` answers it.

This revision supersedes the fifth. The fifth's headline stands — a Node CLI
host serves real hardware telemetry — but **it was wrong about the editor**: the
editor could not boot through the host at all, and the fifth revision recorded
that as verified. See the correction in §1.

The sixth session's headline is different: **the editor's property model now has
a specification and an owner.** Nine defects were fixed, four of them data-loss
grade, and the recurring cause behind most of them got a rule
([AGENTS.md §2](../AGENTS.md)) and a registry
([`architecture.md`](architecture.md)).

**23 commits landed. Pushed to `origin/main`.**

The one thing a reader should carry from this session: every bug worth fixing
here was found by *rendering the editor and looking at it*, or by an audit agent
doing the same. None was found by reading code, and several were sitting under a
fully green test suite — one of them under a test that asserted the bug.

---

## 1. What is real and verified

Verified means **executed this session**, not inspected. Unlike the fourth
revision, every figure below was printed by a command that ran.

| Check | Result |
|---|---|
| Unit tests | **1,018 passed**, 42 files |
| Typechecks | **five** projects, all clean |
| Player + editor + host builds | all pass |
| §47 size gate | **201.0 KB** JS gzip / 400 KB budget |
| Browser tests | **98 passed**, 1 skipped (desktop project) |
| Host bundle | 34.4 KB, zero runtime dependencies |

Every figure above was printed by a command run at the end of the sixth
session. The fifth revision's numbers (908 / 135 / 200.5 KB) are superseded.

The fourth revision's stale figures (349 unit / 38 browser / 185.2 KB) are
gone. The CI blocker it described — missing `renderer-core/src/data/` files
causing TS2307 — **is resolved**; those files are committed and the suite is
green.

### The host, and what was observed rather than asserted

`node packages/host/bin/vigilia.js`, run from `src/web/` — the published binary
is **`vigilia-dashboard`**, never plain `vigilia`, which fetches an unrelated
package off the registry — binds
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

**Correction, sixth session: "`/editor` served to loopback" was the HTML only,
and the editor could not boot through the host at all.** Its bundle was built
with Vite's default absolute base, so the page asked for `/assets/index-*.js`,
which under the host resolves against the *player's* dist and 404'd — a blank
stage with the status stuck on "starting…". Fixed in `c7ada73` with a relative
base plus a `/editor` → `/editor/` redirect, and verified by rendering: the
artboard mounts, 29 nodes draw, no console errors.

The lesson generalises, and is now in `vigilia:verify`: **the browser suite
never exercises the host.** Playwright previews each bundle on its own port, so
a serving bug is invisible to a fully green gauntlet. Checking the document's
HTTP status is not enough — the HTML arrives either way.

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

## 2. Next — in dependency order

[Spec 0011](../.agents/specs/0011-editor-property-model.md) is the master
definition of which entity carries which property. Read it before touching the
inspector; its decisions D0–D10 are all user-approved.

### Task 1 — Chart settings rows. The owner exists; the rows do not.

`renderer-core/src/charts/settings-fields.ts` declares every scalar setting for
all four families, with coverage tests asserting that the declared fields plus
the named exclusions account for **every** property of each real settings
object. That test immediately caught `sampling`, which a hand-written list had
missed.

What remains is the inspector section that generates from it, plus an apply path.
Build it from the declaration; do not re-list the fields.

**Paint is deliberately excluded** from that declaration. `track`, `progress`,
`stroke`, `fill`, `area`, `remainderFill` and both `palette` arrays are all
`Fill`, and D3 puts colour at the theme level — so they land with schema v2 as
tokens, not as element-level controls.

### Task 2 — A layer panel. Now a **correctness** feature, not a convenience.

**A hidden element cannot be reselected, so it is effectively lost.** `hitTest`
skips hidden nodes, which is right — an invisible thing should not intercept
clicks — but with no other route to a node, hiding one and clicking away removes
it from reach entirely. Only undo recovers it.

So the layer tree is the non-visual route a hidden element needs. It also needs
reorder, group/ungroup, and the visibility/lock toggles moved into it.

**Extend `ACTIONS` first.** `commands.ts` already has `reorderNode`,
`setNodeFlags` and `insertNodes`, but `actions.ts` has no ids for them — so a
panel built today would hard-code its own labels and enablement, which is
exactly the defect `actions.ts` was created to remove. Also worth doing first:
an `actionButton()` factory and shared chrome, since button styling is already
copied five times.

One trap this unlocks: `ungroupNodes` drops a hidden group's `visible: false`
and would reveal its children. Unreachable today *only* because a hidden group
cannot be selected.

### Task 3 — Schema v2, as one change.

Everything breaking, together, so there is one migration rather than four:

| | |
|---|---|
| Group loses its stored transform | D2 — children move to the group's parent space |
| Palette becomes rgba | D3 |
| Gradients become palette tokens | D9 — stops with rgba + position, one rotation on the gradient, painted over the element's **bounding box** |
| `fonts`/`fontSizes` → `typePresets` | D4 — author-defined vocabulary |
| Reserved undeletable `palette.none` | D7 — and the fallback when a referenced token is removed |
| `name` is removed; `id` is the single identifier | D8 |
| Artboard `width`/`height` editable | D6 — no `x`/`y`; contents are not rescaled |

**v1 is refused, not migrated** (R2, §141), on the stated basis that no theme
exists outside this repo. The five in-repo fixtures are rewritten by hand: 6
group transforms, 25 colour/font literals.

Two consequences to handle in the same change:

- **Group resize handles come off the canvas.** Size is not a group operation
  (D2), so the canvas must not offer what the inspector denies. This makes
  `resize-children.ts` dead code — delete it, do not leave it.
- `deleteGlobal` switches from refusing to reassigning with a `palette.none`
  fallback. It refuses today only because that token does not exist yet.

### Task 4 — The starter theme, and host theme storage.

Still the thing between this and a usable product: **the dashboard shows mostly
dashes.** `demo-theme.json` binds five extended-tier keys needing LHM and
hardcodes "32 GB installed" with a fixed pie total of 32 — so pointing it at
real memory would render "63.7 / 32 GB", a dashboard lying about the hardware.
**Do not take that shortcut** (§97).

The `ram.*` rename landed, so the demo's RAM binding now resolves. A starter
theme built for real baseline keys, with no hardcoded capacities, plus host
storage in `%APPDATA%/vigilia/` and a menu bar for open/save/activate, is the
remaining work. The demo fixture stays what it is: a showcase of gap, outage and
overflow cases.

### Then

LAN opt-in with pairing codes (§7) · the LHM extended provider · disk and
network in the baseline provider (needs `systeminformation`, and a
THIRD-PARTY-NOTICES entry *before* it is added) · a tray. 9router's
PowerShell-`NotifyIcon`-with-JSON-over-stdio tray is worth copying — a real
Windows tray with **no shipped binary**, which sidesteps the antivirus false
positives an unsigned Go binary attracts.

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
  sized for. §126's budgets are now dropped rather than blocked, so nothing will
  compare it against a target — see `gates/gate-0.md`.
- **CI has not run since the host landed.** It gained a fifth typecheck and a
  host build step; both are unexercised on the runner. This session pushed, so
  its first real run is imminent.
- **The browser suite never exercises the host.** Playwright previews each
  bundle on its own port, so a serving bug is invisible to a fully green
  gauntlet. There is no HTTP test of the host at all. This is how the editor
  shipped unable to boot while all five checks passed.
- **A group's rotation row does nothing, and is therefore not shown.** Rotating
  a group must rotate children about the derived centre; per-child rotation
  about each own centre is a different, wrong operation. The same latent bug
  sits in `applyGesture`'s unreachable multi-node rotate branch.
- **`isKnownStyleProperty` exists but the validator does not call it.** So
  `{"strokewidth": …}` still passes the schema *and* the validator and is
  dropped at render time. The owner exists; the guard does not.
- **Spec 0011 D0, D4, D6–D10 are specified, not implemented.** Only D1 (whole
  units), D2 (group capabilities) and D5's owner have landed.
- **29 editor defects were confirmed by audit and most are unfixed.** Fixed:
  numeric fields, resize handles on thin nodes, mid-drag keystrokes, group
  resize. Not fixed, and each browser-reproduced: an entered group is never left
  by clicking outside it; a locked node can be grouped and then moved through
  its group; snapping is computed from the selection rather than from what will
  move; a multi-selection can never be rotated; distribute's refusal names the
  wrong number; every inspector edit commits even a genuine no-op; invalid
  global values are accepted and the canvas keeps painting the old one; unsaved
  work is discarded silently on open; the editor never ticks, so binding
  readouts are frozen while authoring.
- **One browser test is flaky under parallel load**, not broken:
  `display.spec.ts` "keeps the numeric readout stepping at the sample rate"
  failed once in a full run, then passed 3/3 in isolation and on a full re-run.
  It uses `page.clock` with 150 ms polls inside a 1 s sample window. If it
  fails again, suspect the timing margin, not the readout.

## 4. Blocked on a human — one item

| | What is needed | Why it cannot be done autonomously |
|---|---|---|
| **The design document's own text** | Paste (or discard) the four approved amendments in [`proposed-design-doc-amendments.md`](proposed-design-doc-amendments.md) | `pc-stats-display-agent-plan.md` is user-authored and no agent edits it (AGENTS.md §9). §73, §170, §75 and §126 are **approved** — the deviation is authorised, not unresolved — but until the paragraphs are replaced, the design document and spec 0011 say different things, and §164 tells the next reader the design document wins |

**Resolved this session**, each with the reasoning recorded where the decision
lives rather than here:

- The CLI's published name → **`vigilia-dashboard`**. Plain `vigilia` is an
  unrelated package on the registry; `npx vigilia` fetched it and crashed.
- Reference hardware (§126) → **dropped.** Nothing built so far is resource
  intensive. The caveat is in [`gates/gate-0.md`](gates/gate-0.md): a budget
  exists to catch the regression nobody predicted, so reinstate it the moment
  anything starts costing something.
- Gate 0 probes G0-P1 / G0-P2 → **dropped**, moved to being the extended
  provider's concern, which matches ADR-0004's rule that tiers are discovered
  and reported, never hardcoded. The obligation moves rather than vanishing.
- Colour and typography model, gradients, the id merge, artboard resize,
  grouping's effect on paint order → spec 0011 D0–D10.

**Still open but not blocking:** the two §85 engine-gap decisions (gauge
gradients, line thresholds) in `gates/gate-0.md`. They now gate the gradient
work specifically, since D9 defines the token and §85 governs what the engine
can honestly draw.

## 5. Context you cannot infer

**Bare ignore rules match at any depth, and this repo has now been bitten
twice.** The fourth revision fixed `data/` untracking
`renderer-core/src/data/`. This session found `bin/` at `.gitignore:2`
silently untracking **`packages/host/bin/vigilia.js`** — the CLI entry point,
the one file `npx vigilia` cannot start without. Both are now anchored.
`obj/`, `[Dd]ebug/`, `[Rr]elease/` and `artifacts/` are **still bare**; suspect
them the same way the moment anything lands in a directory with those names.

**The credential gap the fifth revision said was fixed was NOT fixed.** That
revision recorded `.gitignore` as blocking the stray config-home path and
`**/.credentials.json`, "anchored". Checked with `git check-ignore`: neither was
ignored, and `.gitignore` contained no credentials rule at all. The directory —
78 MB holding live OAuth access tokens — had reappeared in this session's
opening `git status`.

Genuinely fixed now (`0e57e3e`), verified both ways: four leak paths ignored,
all twelve tracked `.claude/plugins/vigilia/` files still tracked. The rules are
`**/.credentials.json` and `**/*/.claude/`, the second anchored with a leading
directory so the repo's own root `.claude/` survives.

The lesson is not about gitignore. **A fix recorded in a handoff is not a fix**,
and this one sat wrong for a whole revision behind a confident sentence. Check
the claim, not the note.

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

**Nothing is declared twice — and an owner nothing imports is not an owner.**
[AGENTS.md §2](../AGENTS.md) is now the repo's top rule and
[`architecture.md`](architecture.md) carries the ownership registry, including
the gaps. Both exist because this session produced the same defect class three
times: the editor's asset base known in two places (it could not boot), the
style vocabulary in five (a typo'd property still passes schema *and*
validation), and `semantic-keys.ts` created as the vocabulary owner while the
host kept its own hand-typed copy that had **already drifted on a label within
the hour**.

The second half of that rule is the one that catches you out. Creating the owner
felt like completing the task; it was half of it.

**A test can assert the bug.** An existing browser test resized a group and
checked only the group's own bounding box — so it passed throughout while every
child stayed put. Two more cases this session: a regression test for the
mid-drag corruption **passed with the fix disabled**, because the corrupt and
correct paths land on the same pixel (the discriminating signal is mid-gesture,
not final position); and a first fix for the resize handles kept the corners and
claimed they "are never ambiguous at any size" — they are, at 2×2, where `se`
resolved to `sw`. Disable the fix and re-run before believing a test.

**Specify what a thing *is* before coding it.** The group transform went through
three implementations across two commits — absent, derived-and-editable,
structural-only — roughly 500 lines written then deleted, because "what is a
group" had not been settled. Spec 0011 exists so the next one of these is a
document edit rather than a refactor.
