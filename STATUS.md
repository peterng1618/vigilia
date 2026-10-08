# Vigilia status

Updated: 2026-10-08
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

- **Plan 1 — [`2026-10-08-gates-and-the-control-set.md`](docs/superpowers/plans/2026-10-08-gates-and-the-control-set.md) — is written and not started.** No plan is active; nothing is dispatched; it awaits the user's review and choice of execution method.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **`vg-149` is the first task, not a quirk** — Biome lints and formats no `.tsx`, so the rewrite would put the whole editor outside both gates.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **The reference is saved, the gate checks it, and plan 1 is written** (`8440d37c`).
- **`docs/design/mockups/` holds three standalone reference pages plus a README** stating what they are (the target, checked at every gate) and what they are not (not golden files, not behaviour, not copy).
- **Spec §13 makes parity a gate item:** each plan places its capture beside the matching mockup and lists the differences, each fixed or recorded as deliberate — "a gate that produces no comparison has not run".
- **Plan 1 sequences `vg-149` first**, then the bible §5 control set as React components, then the parity-capture harness; every task carries a red proof that its own gate can fail.
- **Plan 1 uses a ratchet guard, not a whole-tree rule** — `scripts/design-tokens.mjs` scans a declared file list each plan grows, and fails on an empty list so it cannot pass by looking at nothing.

## Next

1. **The user reviews plan 1 and the spec, then picks the execution method** — subagent-driven or native.
2. **Plan 1 executes** — `vg-149`, the scales with their ratchet guard, the control set, the parity harness.
3. **Plan 2 — the shell and the rail**, which is the first visible change and what the shell mockup specifies.
4. **Then the inspector, the panes, settings, then iconography and copy.**
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **`vg-135`, `vg-175` and `vg-196` can still redden a run**, so the broad gate cannot be read as green while they can fire.
- **`vg-174` is the LAN move's open row** — a GET landing while a move is in flight can leave the host never listening again; reasoned from the code, not reproduced.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — and plan 1's parity spec is a browser spec.
- **Nothing in the spec or the bible is verified** — neither has a line implemented, and no capture exists beside a mockup yet.
