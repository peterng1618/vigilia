# 0092 — The remainder counts only surfaces the design language can reach

- **Date:** 2026-10-22
- **Status:** accepted
- **Paths:** `scripts/design-tokens.mjs`, `scripts/design-tokens.gated.json`
- **Extends:** [`0040`](0040-the-design-token-ratchet-is-ours-not-a-biome-rule.md) (the remainder, `vg-426`)

## The problem

The remainder counts every product source file that holds a design literal, in
every package. `vg-626` measured the consequence: the 20th file was
`player/src/theme-chooser.ts`, and the player loads none of `editor-shell.css`,
so it has no token to consume. Raising the ceiling is the one move the
instrument exists to refuse. Converting the file would invent a player token
surface that does not exist. The ratchet was measuring files it could never
gate.

## Rung 1 — Vigilia

Searched: `docs/decisions/0040`, the remainder section of `vg-426`, `vg-626`,
`scripts/design-tokens.gated.json`, and the twenty files the failing run names.

Found: the gated list holds 60 files and none is under `packages/player/` or
`packages/scene-fabric/`; `0040` says the measure is a count with a ceiling,
not a policy, and `vg-626` says narrowing the scope is a policy call that must
not be made by raising the ceiling. Several out-of-scope files already say in
their own comments why their colours are fixed: `controls-manager/renderers.ts`
("Editor chrome, deliberately not theme palette"), `qr-symbol.tsx` ("The ink
and the paper are fixed, not themed").

## Rung 2 — dependencies

Searched: the script's imports and the workspace manifests.

Found: none. `design-tokens.mjs` is dependency-free Node; there is no token
package to ask for a scope.

## Rung 3 — platform

Searched: how the design language is consumed.

Found: the scales and palette are CSS custom properties declared in
`editor-shell.css`'s `@theme static` and `--shell-*` blocks. A custom property
resolves only in a DOM tree that loaded that stylesheet, or one that copied its
values. Canvas 2D (`strokeStyle`), Fabric object paint, the host's standalone
error HTML and the player's own document all take plain strings and load no
editor stylesheet. The platform bounds reachability before any scanner rule
does.

## Rung 4 — ecosystem

Searched: none. There is no library here to compare against: the ratchet is a
repo-local text scan, not a CSS linter, and stylelint-class tools also see only
stylesheets — they cannot rule on a canvas context either.

Found: nothing to reuse. The scope question is about this repo's own owners.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Raise `remainderCeiling` | None — the instrument exists to refuse growth | One line | The red disappears and the measure loses its finish | rejected (`vg-626` rejects it explicitly) |
| Give the player its own token surface | Good long-term if the player gains a stylesheet | A new token owner, a player palette, its tests | Invents a surface no current consumer needs | deferred — re-include the player if one lands |
| Convert the player's literals to editor tokens | Fails: the player does not load the stylesheet | — | A token reference that resolves to nothing | rejected |
| **Count only files that can resolve the design language** | Matches the instrument's purpose | A scope predicate and its proofs | A new non-editor surface is excluded by package; a new *package* still counts, so it cannot hide silently | **chosen** |

## Rung 6 — probe

Measured 2026-10-22 by `node scripts/design-tokens.mjs`: remainder 20, ceiling
19. Of the twenty, three are editor DOM surfaces that can consume tokens
(`components/ui/colour-picker.tsx`, `editor-shell.ts`,
`indicator-manager/cursor-indicator.ts`); seven are editor files that paint
through Fabric or a 2D context, carry persisted starter-theme data, or draw
fixed QR ink; ten are in packages that load no editor stylesheet (`host`,
`player`, `renderer-core`, `scene-fabric`). After the rule: 3 counted, 17
outside reach. The self-test's scratch tree proves both directions and proves
that an unknown package is still counted, so a new UI package cannot escape by
not being named.

## Decision

The remainder counts a file only when the design language can reach it: the
editor package's DOM surfaces. Excluded, with the reason carried beside the
rule: the four packages that ship no editor stylesheet, the editor's Fabric and
canvas painters, the starter theme's persisted paint, and the QR symbol's fixed
ink. The exclusion is by rule, not by a list of files, and every run reports
how many literal-holding files sit outside reach, so the scope is visible
rather than implied. The ceiling falls from 19 to 3 in this commit, and the
three remaining files stay countable.

The cost, stated: player and host chrome are not held to the editor's scales
and may drift visually. That is a real gap, not a claim that they match. If the
player gains a token surface of its own, its package leaves the exclusion list
and its files join the remainder; `vg-626`'s finding stands as the record that
the gap exists.
