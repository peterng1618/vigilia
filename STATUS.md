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

- **Plan 1 — [`2026-10-08-gates-and-the-control-set.md`](docs/superpowers/plans/2026-10-08-gates-and-the-control-set.md) — is executing: task 1 is done, tasks 2–4 remain.** The scales with their ratchet guard, the React control set, then the parity harness.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Biome now lints and formats `.tsx`** (`1262a670`) — `files.includes` named no `.tsx` glob, and in Biome 2.x that list *replaces* the defaults, so 33 tracked `.tsx` files sat outside both gates.
- **The gate is proven rather than assumed** — a planted `const unusedProbe = 1;` in `canvas-dock.tsx` makes `biome lint ..` exit 1 and name the file, where the same probe under the old `.ts`-only glob exits 0 over 527 files against 560 now.
- **Six hidden findings fixed** — an unused `CPU` constant, two unused `errors` bindings, an unused `InsertableObject` import, unused `ActiveKind` and `EditorActionFacade` imports, and one `biome-ignore` directive whose rule is not enabled.
- **The formatting landed alone** (`838c1102`) — 24 `.tsx` files reformatted, no `.ts`, `.json` or `.css` touched, so a reader can skip that commit.
- **`vg-149` is closed** in the register with its check and the artefact sha.

## Next

1. **Plan 1 tasks 2–4 follow** — the scales with their ratchet guard, the React control set, the parity harness.
2. **Plan 2 — the shell and the rail**, which is the first visible change and what the shell mockup specifies.
3. **Then the inspector, the panes, settings, then iconography and copy.**
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **`vg-135`, `vg-175` and `vg-196` can still redden a run**, so the broad gate cannot be read as green while they can fire.
- **`vg-174` is the LAN move's open row** — a GET landing while a move is in flight can leave the host never listening again; reasoned from the code, not reproduced.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — and plan 1's parity spec is a browser spec.
- **Nothing in the spec or the bible is verified** — neither has a line implemented, and no capture exists beside a mockup yet.
