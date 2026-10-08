# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; nothing is built. The
target is [`docs/design/design-language.md`](docs/design/design-language.md), the
contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
and the boundary that makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

The measure of done is the spec's Acceptance section, which is counted rather
than reviewed: no hex colour and no off-scale spacing in a surface, no native
`<select>`, and every panel's existing behaviour surviving its rewrite.

**The standing author-loop objective is suspended, not withdrawn.** Driving the
product to find what is broken resumes when this objective closes, and the
backlog it produced stays live in the register.

## Active work

- **Plan 1 — [`2026-10-08-gates-and-the-control-set.md`](docs/superpowers/plans/2026-10-08-gates-and-the-control-set.md) — tasks 1–4 are done.** The scales with their ratchet guard, the React control set and the parity gate have landed; the plan awaits the controller's closeout, and plan 2 is next.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 4 — the parity gate — is complete** (`1f991845`); the gate is green at 1 collected, 1 passed, 0 unexpected, and it fails on a planted `7px` padding before the revert.
- **`control-fixture.html` is a build entry** mounting the built control set over the built stylesheet, and `tests/e2e/design-language.spec.ts` asserts §3's spacing steps, §4's roles, §5's 24×24 targets, 4.5:1 and 3:1 contrast in all six palettes, forced colours, both desktop sizes, 200% zoom and reduced motion.
- **Five things jsdom could not see were fixed** — the toggle, a segmented label and a section header take §5's target through a centred 24×24 `::before`, the fields take theirs from the 26px well, and the slider's track was 0px wide because a `flex-1` child resolved inside a shrink-to-fit slot.
- **Two captures are registered** beside `docs/design/mockups/inspector-controls.html` — graphite, the ground the mockup is drawn on, and editorial — with ten differences listed in the task report, each fixed or recorded as deliberate.
- **Three rows are filed rather than fixed**, each because the repair is a design ruling: vg-200 the `--edge` boundary at 2.15:1 and 1.42:1, vg-201 `--warn` text at 1.4–2.0:1 in three palettes, vg-202 the well padding.

## Next

1. **Plan 2 — the shell and the rail** — the first visible change, and what the shell mockup specifies; it reuses the fixture and re-runs the gate.
2. **Then the inspector, the panes, settings, then iconography and copy.**
3. **Plan 1's closeout is the controller's** — §13's capture item and §13.1's stress set are met for the control set, and this file still calls the spec `draft`.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the parity gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **`vg-135`, `vg-175` and `vg-196` can still redden a run**, so the broad gate cannot be read as green while they can fire.
- **`vg-174` is the LAN move's open row** — a GET landing while a move is in flight can leave the host never listening again; reasoned from the code, not reproduced.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the new parity spec included.
