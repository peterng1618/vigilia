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

- **The final review's fix dispatch landed** (base `e3bd9871`): nine contract corrections — ADR 0040's shipped thirteen roles, bible §10's dock exception, the mockup's well rule, §5 rule 6's hover text, and the spec's ratchet, spacing, contrast and handoff wording — plus the code findings B1–B7.
- **B1 — the parity gate is no longer red on a clean checkout**: both workflows run `npm run build:fixture -w @vigilia/editor` after the editor build, so `control-fixture.html` reaches `dist`; verified that a production build emits it not, and that the CI sequence emits both.
- **B4 — the source guard's §3 rule now covers Tailwind spacing utilities in `.tsx`**, so `p-[26px]` no longer slips through `biblePx`; scoped so `h-[26px]` and `size-[24px]` stay tier 2, and `design:check` is green over 12 files.
- **B2 and B5 landed**: `InspectorSection` renders `data-vigilia-section` from its id, and the slider's and segmented's `data` moved onto the focus target; B7 (duplicated draft/commit logic) is parked as `vg-203` under plan 3.
- **Bible §5 rule 6 is now implemented**: the well and the unchecked toggle raise `--edge` to `--muted` on hover, and a blocked control suppresses the raise.

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
