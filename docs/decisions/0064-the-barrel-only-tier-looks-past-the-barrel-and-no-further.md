# 0064 — The barrel-only tier looks past the barrel, and past no other production consumer

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/dead-code-sweep.mjs`
- **Task:** Phase 21.6 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-386`)

## The problem

`vg-386`'s ruling is a **definition**, not an implementation detail: the
`barrel-only-export` tier means *no production consumer other than the barrel,
with test consumers disclosed in the row*. The sweep's gate
`if (prodConsumers.length > 0) continue;` counted the file's own package barrel
as a production consumer, so it skipped every input the tier exists to report —
the tier could not fire for any input, and the report's `0` read as a
measurement that there were none.

The shape of the problem is **which consumer a barrel is**. A barrel is a door a
consumer reaches a name *through*; for the question "does anything take this
name", the door is not itself a consumer. The ruling fixes which way the error
may fall: a survivor costs a ticket and a deleted live symbol costs the product,
so a test that takes a barrel export is disclosed rather than allowed to hide
it, and the bias stays on detection.

## Rung 1 — Vigilia

Searched: `scripts/dead-code-sweep.mjs` for every consumer of a name
(`productionImporters`, `testImporters`, `barrelRoutes`, `ownBarrel`, the
per-export loop's `prodConsumers` gate and the `barrel-only-export` branch);
`docs/architecture/dead-code-candidates.md` §3.4 for the mechanism the row
records; the register for prior art on the same shape.

Found:

- The gate and the branch are adjacent, and the gate runs first — so the
  branch's own condition (`prodConsumers.length === 0 && …`) can only be
  evaluated when it is already false. The defect is structural, not a property
  of this tree.
- `barrelRoutes` already follows a re-export transitively and is pinned by a
  self-test case; the tier's only missing piece is that the barrel must not
  count in `prodConsumers`.
- `docs/architecture/dead-code-candidates.md` §3.4 already names the correction
  as one filter and records the two candidate definitions and their counts
  (76 strict / 133 disclosed). The register had already corrected the report's
  prose; what it still states as present-tense is that the tier *cannot* fire.

## Rung 2 — dependencies

Searched: `src/web/package.json`'s dependencies and devDependencies for a
consumer-graph library; the installed `typescript`.

Found: **nothing to adopt.** `ts-prune` and `knip` are not dependencies, and
adding one to answer a single tier of a six-kind sweep was rejected in `0063`
for the same reason. `typescript` would answer "is this name imported" exactly,
but the whole sweep is a text graph and a second source of truth for one tier is
the cost `0063` already declined.

## Rung 3 — platform

Searched: what Node gives for "does a module have a consumer other than its
barrel".

Found: **nothing.** This is a question about the repo's own graph, which the
sweep builds itself; no platform API answers it.

## Rung 4 — ecosystem

Searched (2026-10-17): *"knip unused exports package barrel index.ts entry file
re-export not a consumer"*, then knip's own pages — `knip.dev/explanations/entry-files`,
`knip.dev/explanations/how-knip-works`, `knip.dev/guides/handling-issues`,
`knip.dev/features/auto-fix`. The web-search tool returned no live results in
this environment; the Exa fetch tool did, so these pages are live evidence.

Found — **the closest prior art draws the same line: a barrel is an entry, not a
consumer, and a re-export nobody takes is reported.**

- Knip's default `entry` set is `{index,cli,main}.{js,ts,…}` and
  `src/{index,cli,main}.{js,ts,…}` — a package's `index.ts` is an **entry file**,
  the starting point of the graph, not a node whose imports keep a symbol alive.
- *"By default, Knip does not report unused exports of `entry` files"* — the
  barrel's own export list is out of scope by default, and `includeEntryExports`
  is what widens it. That is the same choice this tier makes in the opposite
  direction: the barrel's re-export does not by itself make the symbol live.
- Knip's auto-fix *"removes the whole or part of re-exports … across any chain
  of re-exports"* (`module.ts → barrel.ts → index.ts`), i.e. it treats the
  re-export chain as removable when the ultimate consumer does not exist.
- `ignoreExportsUsedInFile` (found in `0063`) is the sibling: knip splits
  "unused export" from "export used in its own file" exactly as this sweep splits
  `dead-export` from `redundant-export`.

**What this decides and what it does not.** Knip confirms the *line* — the
barrel is a door, not a consumer — and does not answer this repo's second
question, which consumer a **test** is. The ruling answers that: a test consumer
is disclosed and does not hide the name, because the report is a candidate list
and the bias is on detection. No prior art was found for a sweep that discloses
test consumers *inside* a barrel-only row rather than excluding them.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **Exclude the file's own barrel from `prodConsumers`; the branch fires when the barrel is a consumer and no other production file is** | The ruling's definition; one filter; the branch already exists and already discloses test consumers | One condition, one branch condition simplified, one self-test case | A symbol whose only production path is the barrel now surfaces — which is the tier's whole purpose | **chosen** |
| Count the barrel as a consumer and keep the tier unreachable | The status quo | Nothing | The report's `0` reads as a measurement; `vg-386` is the row for exactly this | rejected |
| Exclude test consumers too (the plan's literal sole-importer shape, 76 rows) | Narrower; fewer rows to adjudicate | Loses 56 real candidates | A test that imports a barrel export would hide a symbol the product may not use — the bias the ruling rejects | rejected |
| Report barrel-only names as `dead-export` rather than a separate kind | One fewer kind | Blurs a live-in-file symbol with a dead one | The remedies are opposite, which is why `dead-export`/`redundant-export` are already two kinds | rejected |

## Rung 6 — probe

Measured 2026-10-17 at `89c9a035` (`develop`), by a scratch copy of the script
outside the repo with `ROOT` pinned to the repo path and the one filter changed
to `!isTestFile(file_) && file_ !== barrel`, run with `--json`, and diffed against
the unmodified scanner's report at the same commit:

| Measurement | Value |
|---|---|
| Unmodified scanner, at HEAD | 121 candidates: `test-only-consumer` 11, `dead-export` 6, `redundant-export` 99, `unreachable-branch` 5, `barrel-only-export` **0** |
| Corrected scanner, at HEAD | 253 candidates, `barrel-only-export` **132** |
| Reclassification | **0 rows added outside the tier, 0 removed, and the four other kinds identical** (11 / 6 / 99 / 5) — the 132 are pure additions at HEAD, as the row measured at `93fa9a5a` |
| By package | editor 1, fake-source 2, host 21, renderer-core 90, scene-fabric 18 |
| Test-disclosed vs not | 105 rows name a test importer, 27 name none |
| Live-in-own-file vs declaration-only | 111 rows the declaring file itself reads; 21 declared and never used there either (20 test-consumed, 1 with no consumer at all — `host/src/server.ts`'s `HostingPeer`) |

**The zero was the finding, and the 132 is a measurement with its command.** The
row's own count was 133 at `93fa9a5a`; at HEAD it is 132, because the tree moved
(`renderer-core` 91 → 90). The recipe is in the report's §3.4 and in this
commit's message.

## Decision

**The gate excludes the file's own barrel and nothing else:**

```js
const prodConsumers = consumers.filter((file_) => !isTestFile(file_) && file_ !== barrel);
```

and the branch's now-vacuous `prodConsumers.length === 0 &&` clause is dropped,
leaving `if (consumers.includes(barrel))`. **The filter is the whole change**: it
keeps the definition the ruling chose (production consumers other than the
barrel; test consumers disclosed) and keeps every other tier's answer identical,
because the barrel can only be a production consumer of a file its own package
re-exports.

`ponytail:` the exclusion is `file_ !== barrel`, one comparison against the
package's own `src/index.ts`. Upgrade it to a set of barrels if a package ever
grows more than one public entry — not before, since `ownBarrel` already derives
the one path from the package name.
