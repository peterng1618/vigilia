# Vigilia status

Updated: 2026-10-08
Branch: `develop`

## Current objective

**Be the human author. Use the product, find what is wrong, write it down, and
have it fixed. Repeat.**

A standing instruction, not a phase. A fresh session should not be asking "what is
the next task" — it should open the editor and the host, drive them as an author
would, and find the next thing that is broken. Definition of done is a floor, not
a ceiling: the pass ends when nothing is left that using the product can find.

**Currently the work is not that loop.** A design language and the rewrite under
it were specified on 2026-10-08, and nothing in them is implemented. Until plan 1
lands, the loop resumes only if the user redirects.

## Active work

- **The editor's design language is specified and not started.** [`docs/design/design-language.md`](docs/design/design-language.md) is normative; the spec is `draft`; plan 1 of its §12 is not written; no plan is active and nothing is dispatched.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **`vg-149` is now a blocker rather than a quirk** — Biome lints and formats no `.tsx`, so the rewrite would put the entire editor outside both gates; it is plan 1's first task.
- **The superseded spec's §2, §4, §8, §9 and Sequencing are amended in the same commit** as the new spec; its sequencing table is replaced, not extended.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.
- **The earlier claim that "plans 1 and 2 were never executed" was wrong** and is retracted — *Groups in the starter* and *The device lens* both landed; `vg-152` records the bookkeeping error.

## Last completed change

- **The design language is written down — a normative bible, a spec, and the decision that makes them applicable.**
- **The measured cause of the last pass's failure:** §9 claimed `@theme` carries the spacing/radius/type/elevation scales, and **zero** uses of `--text-*`, `--radius-*`, `--spacing-*` or `--shadow-*` exist anywhere in the workspace, beside 73 unique hex values and 294 px literals in `editor-shell.css`.
- **The second cause is structural:** 17 surfaces are React while the panel family — 4,518 lines and 23 native `<select>`s — is imperative DOM, so one control vocabulary cannot reach both.
- **`0039` records the boundary from real searches:** Fabric's maintainer declines a React renderer (issue #3192), and #5951 plus `fabricjs-document-engine` converge on a store beside an imperative canvas.
- **The critique that this pass fixes:** nothing in the previous nine plans owned the *look*, which is why the editor shipped barely changed.

## Next

1. **Write plan 1 — gates and the control set** — `vg-149` first, then the bible §5 control set as React components consuming the §9 scales.
2. **Plan 2 — the shell and the rail**, which is what the mockups specify and the first visible change.
3. **Then the inspector, the panes, settings, then iconography and copy.**
4. **The user reviews the spec before any plan is written** — it is `draft` and has not been read back.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **`vg-135`, `vg-175` and `vg-196` can still redden a run**, so the broad gate cannot be read as green while they can fire.
- **`vg-174` is the LAN move's open row** — a GET landing while a move is in flight can leave the host never listening again; reasoned from the code, not reproduced.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Nothing in the new spec or the bible is verified.** Their acceptance sections are plans of measurement, not results — no line of either has been implemented.
