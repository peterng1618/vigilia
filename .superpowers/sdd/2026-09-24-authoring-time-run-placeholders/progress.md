# SDD ledger — plan: docs/superpowers/plans/2026-09-24-authoring-time-run-placeholders.md

Spec: docs/superpowers/specs/2026-09-24-authoring-time-run-placeholders.md

This plan has **no prior ledger and every checkbox unticked**, so state was established from the code by a
read-only recon pass on 2026-09-26 (`recon.md`, same directory). Result: **3 landed, 2 partial, 0 open.**

## Verified landed

| Task | Evidence |
|---|---|
| 1 — the placeholder rule | `run-placeholder.ts:32`, `:55` |
| 2 — paint runs in the authoring mode | `live-runtime.ts:20`, `:61-68` |
| 3 — the control | `shell-layout.tsx:196`, `editor-session.ts:412`, `:416`, copy `ui-copy.ts:78-80` |

All three landed together in **`51023c2`**, are exported and wired (not merely declared), and the editor e2e
spec drives the path (`tests/e2e/editor.spec.ts:313`).

## Open work

**Task 4 (partial) — the display is untouched.** `tests/e2e/host-player.spec.ts` has **no** token case, so
the plan's own negative ("the player never shows a token name") is unproven at the boundary. The boundary is
only structurally enforced today (`packages/scene-fabric/src/fabric-text.ts:107`), which is a code read, not
a rendered observation — and the plan's Task 4 header is "Prove the display is untouched". The spec's own
table makes this load-bearing: the editor surface only.

**Task 5 (partial) — integration proof.** One capture exists
(`docs/evidence/screenshots/authoring-tokens.png`, from `51023c2`) and the ownership row is present
(`docs/architecture/ownership.md:38`), but the broad gate and full browser suite are unverified, and the
spec's acceptance section was never annotated — the spec's last touch is its creation commit `4a6fc7f`.

**No file is shared between Task 4 and Task 5**, so they are not serialized against each other; the gate in
Task 5 runs after Task 4's test lands, which is the only ordering that matters.

## Recon folded — Task 4 and Task 5 are the only open work (2026-09-26)

`recon.md` in the settings-scope workspace covers this plan too (the two were recon'd together).
Measured at `2929f87`:

- **Tasks 1–3 landed** in one commit, `51023c2`: `run-placeholder.ts:32` `runPlaceholder`, `:55`
  `toAuthoringSegments`, the three distinct states with pairwise-distinct assertions
  (`run-placeholder.test.ts:23`, `:42-44`); the editor runtime swap (`live-runtime.ts:20`, `:61-68`,
  `:77-80`) with `applyAuthoredText` at `scene-fabric/src/fabric-text.ts:118`; and the View-menu control
  (`shell-layout.tsx:196`, `editor-session.ts:412,416`, copy `ui-copy.ts:78-80`) driven by e2e at
  `editor.spec.ts:313,325,1012-1016`.
- **Task 4 partial.** The boundary is structurally enforced — `fabric-text.ts:107` records that a
  display never supplies the transform, and the player path (`selection-inspector/runs.ts:147`) passes
  `bindings: {}` with no transform. But `host-player.spec.ts` (371 lines) has **no** token/placeholder
  case; its `git log` ends at unrelated commits. The task's token-negative player assertion is not
  written, so the boundary is declared and not browser-proven.
- **Task 5 partial.** The capture exists and is registered (`authoring-tokens.png`, added `51023c2`,
  moved by `bd20b26`; ownership row `docs/architecture/ownership.md:38` from `6908d9e`). Missing: the
  other two authoring states plus the player state, the broad gate and full e2e (never run, no artefact
  records them), and any spec landing annotation (the spec has only its creation commit `4a6fc7f`).

**Ruling: Task 4 owns exactly one file** — `src/web/tests/e2e/host-player.spec.ts`. Task 5 owns docs
plus a runtime gate over everything. They share nothing, so unlike consumer-journey these can be
dispatched separately; but Task 4 must not run while another plan holds the browser suite, since
`host-player.spec.ts` starts the real host and the suite is serial under capture.

**Cost if wrong:** Task 4's case is added to a file no other task in this plan touches, so the only
real risk is a browser-suite collision — which the sequencing rule already prevents.
