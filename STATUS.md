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

- **Fix round 2 on plan 1's final review** (base `7f7ae410`): the scoped re-review's three residuals plus A4's partial, R1–R4.
- **R1 — a refused select or swatch no longer raises its well's edge**: the blocked state reaches `control-select.tsx` (swatch inherits), pinned by a DOM case that fails when reverted.
- **R2 — the Tailwind tier no longer evades negative utilities**: `-mt-[26px]` is held to §3 like `p-[26px]`; `design:check` stays green over 12 files and `biblePx` is unwidened.
- **R4 — §5 rule 6 is now asserted rendered**: the parity gate hovers a well and an unchecked toggle and reads a changed `borderTopColor`, and asserts a checked toggle and a blocked well do not move; red-proved three ways (drop the hover class, drop the blocked suppression, outrank the checked border).
- **R3 — the `biblePx` comment reads as a set, not a full enumeration**, and spec §13.1 now names the hover assertion.

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
