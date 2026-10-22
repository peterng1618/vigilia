# 0061 — The registry owns a capture's freshness, and the check is a recorded sha against the surface it depicts

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/capture-freshness.mjs`
- **Task:** Phase 21.3 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (rows `vg-287` and `vg-402`)

## The problem

`docs/evidence/screenshots/README.md` registers eleven captures as a pair of
file names per row — the action's own output and the copy that sits beside a
drawing — and **nothing in the repo reads either column**. So an image can
depict a product two plans old while every gate stays green, which is exactly
what `vg-287` records happening (the shell-palette and keyboard-reference
frames). The ruling's answer is that the registry records **the commit each
capture was taken at** and **the surface paths it shows**, and a script reports
a capture whose surface paths have commits after that sha.

The shape of the problem is therefore: **given a committed image and no
deterministic way to re-produce it, what can say it is out of date?** Re-shooting
is the one thing ruled out — it needs built bundles, one worker and
`YUNARI_CAPTURE=1`, and the row's own second measurement says the periodic
re-shoot is the load rather than the fix.

## Rung 1 — Yunari

Searched: `docs/evidence/screenshots/README.md` and `docs/design/mockups/README.md`
(the two registries), `src/web/tests/e2e/editor-canvas.ts` (`captureVisualReview`,
`YUNARI_CAPTURE`, `YUNARI_CAPTURE_DIR`), `.github/workflows/visual-evidence.yml`,
every `scripts/*.mjs` for a check over the captures directory, `src/web/tests/e2e/frame-diff.ts`
and `glass-probe.ts` (the repo's existing pixel measures), `mockup-values.ts`'s
`currentDrawings`, and `grep -rn "evidence/screenshots"` over `src/`, `scripts/`,
`docs/` and `.github/`.

Found:

- **The registry is a markdown table, and it is the only record of the eleven.**
  Two columns, eleven rows, plus prose. The *actions* are registered elsewhere —
  as Playwright titles in `src/web/tests/e2e/*.spec.ts`, which is what the
  capture workflow's `grep` input names — so a manifest that re-listed action
  titles would be a third list of the same thing.
- **No code reads `docs/evidence/screenshots/` at all.** The only programmatic
  references to the directory are the capture helper's own default
  (`editor-canvas.ts:395`) and `host-settings.spec.ts:333`; everything else is
  prose. The drawings gate enumerates `*.html` (`mockup-values.ts`'s
  `currentDrawings`) and skips a PNG beside a drawing.
- **The repo has pixel measures, and none can answer this.** `frame-diff.ts`
  differences two frames of one scene at a 6/255 threshold, and it needs a
  *fresh* capture to compare against — the re-shoot that does not exist.
  `glass-probe.ts` is a readback, not a committed-file check.
- **The `--self-test` chained into `gates:self-test` is the established shape**
  for a `scripts/` check, and `npm run gate` runs it.

## Rung 2 — dependencies

Searched: the workspace manifests (`src/web/package.json` and the packages'),
and the installed tree for anything that maps changed files to artefacts or
fingerprints a source set.

Found: the workspace's dev dependencies are Biome, `@playwright/test`, `canvas`,
`jsdom`, `jsqr`, TypeScript, Vite and Vitest. **`@playwright/test`'s
`toHaveScreenshot` is the nearest thing** — it is a re-render plus a pixel
baseline, so it needs a live browser run and a deterministic render, and the
surface this registry covers is measured as **not** deterministic (see Rung 6).
`canvas` decodes a PNG, which is only useful once something has produced one.
Nothing to discharge, and nothing to add: the check is `git log`.

## Rung 3 — platform

Searched: what git and Node give for "which commit wrote this file".

Found: `git log <sha>..HEAD -- <path>` answers "did this path move after this
commit" for a file or a directory, with no bookkeeping of our own, and
`git rev-parse --verify <sha>^{commit}` is what makes a recorded sha a claim
that resolves rather than a string. Node itself has no notion of a file's
commit, which is precisely why the recorded sha is the whole mechanism: the
registry must carry it, because nothing can derive it after the fact without
knowing which bytes came from where.

## Rung 4 — ecosystem

Searched (2026-10-17): *"detect stale committed screenshots repository
screenshot freshness check git commit marker"*, *"visual regression testing
tools committed baseline screenshots staleness when the source changed"*, and
*"git history based staleness check for generated artifacts committed to a
repository"*, reading the results' own READMEs and commit messages.

Found — the ecosystem has met this shape, in **two families, and neither fits**:

- **Re-render and compare** — `screencomp`, `diopsis`, `snapdrift`, Sentinel,
  `shotlist --check`. Every one of them re-captures and diffs against the
  committed baseline, and several state the precondition outright: screencomp's
  `verify` "captures the same build twice and requires the two trees to be
  byte-identical", because an image-free digest baseline "means nothing if the
  same build hashes differently on the next run". **Our measurement is that this
  surface fails that precondition** (Rung 6), and the re-shoot they all need is
  the thing this row says does not exist.
- **A source-digest manifest** — `let-go`'s `genmanifest`/`check-generated`
  (sha256 of the sources against a committed `generated.sums`), `codegen-guard`,
  `strictlock`'s generated-sink gates, and Prismatic Majordomus's
  `generate --check`. These answer the *same question* as this check — has the
  input moved since the artefact was written — and they are the closest prior
  art. But their manifest is **written by the generator**: `lgbgen`'s
  `refreshManifest()` and `generate` are what make `generated.sums` true. Here
  the generator is a manual capture that needs a browser, so a digest manifest
  would have to be hand-written after every re-shoot, which is the same habit
  the row is trying to end, in a new file.
- **A changed-file → artefact reminder** — `litmus`'s
  `scripts/check-screenshot-drift.py` greps changed UI files for
  manifest-tracked `data-testid`s and prints "may be stale", non-blocking. The
  right idea and the wrong key: it maps selectors rather than paths, and it
  reminds rather than reports.

**The comparison.** Both families need a step that runs the producer. The
ruling's check needs nothing but git, which is why it is the one a manually
captured, non-deterministic artefact can carry.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **A recorded sha per capture, checked against the surface paths it shows** | The ruling's own words; needs no capture run | Two columns in the table that already exists, one script | A surface path set that is too wide reports a capture stale for a change that moved no pixel | **chosen** |
| A byte-diff scanner over the committed PNG | No manifest at all | A re-shoot to compare against | **Ruled out by measurement**: two runs of `captures the settings modal's three tabs` on one bundle differ in bytes at identical dimensions, so it reports that capture stale on every run | rejected |
| A source-digest manifest (`genmanifest`'s shape) | The closest prior art, and more precise than a commit range — a revert reads fresh | A manifest that must be rewritten by the capture step | The capture step is a person running Playwright; a hand-maintained digest file is the same habit in a new place, and the ruling names a sha | rejected |
| Re-render and pixel-diff in CI (`diopsis`, `snapdrift`, `screencomp`) | Would also catch a capture that is stale for a reason no path names | A browser run per capture, per commit | Needs a deterministic render, which this surface does not have; and it is the re-shoot the task rules out | rejected |
| A second data file beside the captures (`registry.json`) | Cleaner to parse than a markdown table | One more list of the same eleven captures | It drifts from the table the moment someone adds a row to one and not the other — the failure the brief names | rejected |
| `--check`-style: regenerate the capture and `cmp` | Names the artefact and its fix | A browser, a worker, a build | Not available on demand and not deterministic here | rejected |

## Rung 6 — probe

Measured 2026-10-17 at `ed6b32d7`, from the registry, `git log -1 --format=%H -- <path>`
and `git log --oneline <sha>..HEAD -- <path>`:

| Measurement | Value | How |
|---|---|---|
| Captures registered in the copy table | **11** | the table's own rows |
| The commit each capture was taken at | shell three `2ce8ef1e`, settings appearance/keyboard `8c4c79b9`, settings about `5da31012`, controls pair `aa5edf96` | last commit that wrote the evidence file's bytes |
| Drawings-side copies all last written at | **`2ce8ef1e`** | `git log -1` on the eleven `docs/design/mockups/current/*.png` |
| Surface paths with commits after their capture's sha | **all eleven**, by at least the stylesheet | per-path `git log --oneline <sha>..HEAD -- <path>` |
| `editor-shell.css` commits since `8c4c79b9` / since `aa5edf96` | **14 / 17** | `git log --oneline <sha>..HEAD -- src/web/packages/editor/src/editor-shell/editor-shell.css` |
| `editor-shell/` commits since `2ce8ef1e` | **13** | same, on the directory |
| The scanner's first live run | **`11 registered capture(s), 11 stale, 0 broken`, exit 1** | `node scripts/capture-freshness.mjs` |
| The scanner's `--self-test` | **5 cases, exit 0** | `node scripts/capture-freshness.mjs --self-test` |

**What the probe shows.** The instrument's first live run reports all eleven
stale, and that is the instrument working rather than a defect in it: Phase 20's
token and elevation work (`7874e879`, `0c1f559e`, `ed4d6ee8`, `b9566db1`) landed
on the stylesheet every one of the eleven composes. It also shows why the
manifest is not the *whole* answer — the eleven share one surface, so the report
is one finding read eleven ways until the captures are re-shot.

**The recorded measurement that rules bytes out**, from `vg-402`'s own detail:
two runs of `captures the settings modal's three tabs` on one bundle produce
different bytes at identical dimensions, so `cmp` is not a staleness test on
that surface. Two families of staleness *are* readable on the corpus and both
were used by the passes that re-shot it — geometry off the IHDR, and pixels at
identical dimensions — which is why the check keys on the recorded commit
rather than on either.

## Decision

**The registry carries two more columns, and the scanner reads them.**

| Column | What it is | How it is derived |
|---|---|---|
| `Taken at` | the commit the capture was taken at | `git log -1 --format=%H -- <the action's file>` — the commit that last wrote those bytes, which is when the action produced them, not when a copy moved |
| `Surfaces` | the repo-relative paths that produce what the image shows | read per capture from the spec's own scope and the components the surface composes; recorded, never guessed |

**Why the table and not a second file.** The registry already names all eleven
captures, and a `registry.json` beside it would be the same list twice: adding a
capture would mean editing two files, and forgetting one is exactly the drift
this instrument exists to catch. The table is parsed by the scanner and read by
a person, so the manifest and the registry cannot disagree.

**What the scanner does.** For each row: resolve the recorded sha
(`git rev-parse --verify <sha>^{commit}`), check both named files exist, and run
`git log <sha>..HEAD -- <path>` for each surface path. A path with commits after
the sha is a finding, and the report names the count and the newest commit so a
reader can judge it without re-deriving anything.

**Fail-open, fail-closed, and which is which.** The manifest is **fail-closed**:
a missing registry, a table that yields no rows, a row with the wrong number of
columns, a sha that does not resolve, or a row with no surface path is exit 2 —
"a manifest it cannot read is a finding, not a silent pass". Everything else is
**fail-open**: an unexpected error (git absent, an unreadable file) prints a
warning and exits 0, because this is a report rather than a gate, and an
instrument that blocks on its own breakage is worse than one that says so.

**Known limits, recorded rather than solved.**

- **The shell captures' stage is not bounded.** The three whole-shell captures
  are viewport frames, so they show the stage, whose pixels come from the scene
  renderer rather than from the shell's own source. The manifest names the chrome
  the frame composes and records this as the part of the claim it cannot make;
  a change to `scene-fabric` moves those pixels and this check stays silent.
- **A commit range cannot see a revert.** A path changed and changed back still
  reads as moved, which is the false positive the ruling accepted ("visible and
  fixable, unlike the present silence").
- **The twin-bytes claim in the same README has no instrument.** "The two copies
  of each capture are the same bytes and stay that way" is checked by nobody;
  this check tests the recorded sha, not the copy.
