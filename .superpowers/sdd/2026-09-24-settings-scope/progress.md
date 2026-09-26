
## Read-only recon 2026-09-26 — all 19 ticks are true; one gap, in Task 5

This plan had no ledger. A recon pass (`recon.md`, same directory) verified each task against the code rather
than the checkboxes: **4 landed, 1 partial, 0 open.**

| Task | Evidence |
|---|---|
| 1 — per-theme answers, stored | `packages/host/src/settings/theme-settings.ts:15-107`, commit `eacaea2` |
| 2 — global settings unaffected by the theme | `settings.html:130-137` |
| 3 — a theme's questions when first chosen | `server.ts:745-776` |
| 4 — resolve theme over the global answer | `server.ts:376-378`, commit `fd5cbf8`; two-direction test `server.test.ts:844`, `:878` |

**Task 5 (partial) — the integration proof.** The docs the step names *were* updated
(`ownership.md:106`, `README.md:121`, `:125`) and the capture is registered
(`docs/evidence/screenshots/README.md:51`). What is missing is the evidence itself: the broad gate and the
full browser suite were never run against this state, and the spec's acceptance section was never annotated —
the spec's last touch is its creation commit `73ad33d`.

**Ruling: do not re-execute Tasks 1–4.** Each is verified wired through a real caller, not merely declared,
and each has its named test. Re-running them would spend dispatches to reproduce work the code already holds.
Cost if wrong: a defect in a landed task that its own test does not catch, which the Task 5 gate is exactly
the instrument for.

## Recon folded — no implementation work owed; two process claims open (2026-09-26)

`recon.md` in this workspace. All 19 checkboxes ticked, and **all 19 are true** — the first plan in the
queue where the boxes match the code. Landed in two commits: `eacaea2` (per-theme answers, the global
invariant, the asking) and `fd5cbf8` (the theme→global→provider resolution and its two-direction test).

Verified at `2929f87`: `theme-settings.ts:15,17,33,74,101-107` with its full test set; the global
section at `settings.html:130-137` with the e2e revert-regression at `host-settings.spec.ts:90`; the
questions section `:153-157`, `:181`, `:299-339` with `server.ts:669,745-776`; the resolver
`server.ts:359-389` (`pick = perTheme[group] ?? stored.assigned[group]` at `:376-378`) with
`server.test.ts:844` asserting `{systemDisk:"disk-d"}` for its theme and `{systemDisk:"disk-c"}` for
another, plus `:878` for the publish side.

**Open, and both are process claims rather than code:**
1. The broad gate and the full browser suite were never run for this plan; no artefact records them.
2. The spec's Acceptance section was never annotated — `specs/2026-09-24-settings-scope.md` has no
   commit after its creation `73ad33d`.

**Ruling: this plan is archivable once its gate runs and its spec is annotated, and both ride in the
queue's batched close-out pass.** Four plans in this queue are open only on that same shape
(settings-scope, author-journey, consumer-journey, theme-thumbnails), so the gate runs once at the
merge boundary and each spec is annotated in the same pass as its own remaining work. Cost if wrong:
one extra gate run at the end, against four serialized gate runs.

**Do not re-execute Tasks 1–4.** The recon measured them landed and wired; a re-dispatch would rebuild
working code.
