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

- **Plan 1 — [`2026-10-08-gates-and-the-control-set.md`](docs/superpowers/plans/2026-10-08-gates-and-the-control-set.md) — is executing: tasks 1–3 are done, task 4 remains.** The scales with their ratchet guard and the React control set have landed; the parity gate is next.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 3 — the control set — is complete** (`e3b19da4`..`0ec0db11`); the task review passed after two fix rounds, the second correcting a ruling of mine.
- **Ten controls plus `InspectorSection`** live in `components/ui/` — Well, Text, Swatch, Select, Number, Slider, Toggle, Segmented, IconButton — each with a programmatic name and a refusal that renders in words with `aria-disabled` over `disabled`.
- **Bible §4's three missing roles are declared** (`9d462a19`) in all six palettes: `--stage`, `--hdr`, `--edge-2`; `--stage` carries no colour utility, because it holds a gradient stack under graphite and light.
- **`ControlProps.density`** carries bible §3's three row rhythms — 26 panel, 30 dialog, 32 settings — so plan 5 does not fork the set to reach the other two.
- **The ratchet is green** — 11 gated files clean, 27 tests pass, and the empty gated list still exits 1, so the guard is proven not to pass over nothing.

## Next

1. **Plan 1 task 4 follows** — the parity gate: a browser fixture mounting the built controls over the built stylesheet, plus the mockup capture; it also owes bible §5's 24×24 hit area and spec §13.1's stress set, which task 3 could not prove in jsdom.
2. **Plan 2 — the shell and the rail**, which is the first visible change and what the shell mockup specifies.
3. **Then the inspector, the panes, settings, then iconography and copy.**
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **`vg-135`, `vg-175` and `vg-196` can still redden a run**, so the broad gate cannot be read as green while they can fire.
- **`vg-174` is the LAN move's open row** — a GET landing while a move is in flight can leave the host never listening again; reasoned from the code, not reproduced.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — and plan 1's parity spec is a browser spec.
- **Nothing in the spec or the bible is verified** — neither has a line implemented, and no capture exists beside a mockup yet.
