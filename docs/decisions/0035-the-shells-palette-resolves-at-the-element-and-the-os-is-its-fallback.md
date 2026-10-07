# 0035 — The shell's palette resolves at the element, and the operating system is only its fallback

- **Date:** 2026-10-07
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-shell/`
  (`palette.ts`, `editor-shell.css`), `src/web/packages/editor/index.html`

## The problem

Spec §9 asks for two things the editor does not have, and one it half-has:

> Tailwind v4's `@theme` carries the spacing, radius, type and elevation scales; `@theme inline`
> carries the runtime-switched palette so one `data-shell-palette` attribute recolours everything,
> including every portalled popup. The editor follows the OS appearance, with the palette picker as
> an explicit override. (`2026-10-03-dashboard-authoring-design.md:451-457`)

Measured against the source on 2026-10-07, the scales are already in `@theme static`
(`editor-shell.css:195-208`) and the six palettes already exist and already follow the attribute
(`palette.ts:3-10`, `applyShellPalette` at `:47-49`, browser-proven by
`tests/e2e/shell-appearance.spec.ts`). What does not exist is any appearance **source of truth**:
`readShellPalette` answers a palette or the default, and nothing in the repo reads
`prefers-color-scheme` (`grep -rn "prefers-color-scheme\|matchMedia" src/web` returns the host's
own `vigilia-page.css`, the player's reduced-motion read, and nothing in the editor).

The non-obvious part is not "add a media query". It is **where the shell's colours are allowed to
resolve**, because the spec's `@theme inline` instruction is the difference between a palette that
follows the attribute into a subtree and one that silently does not — and one of those subtrees
already exists and is already contractual.

**The subtree is the picker's own chip.** `.editor-shell-palette-swatch` carries the attribute of
the palette it *names* (`palette-menu.tsx:17-25`), and editor-shell.css joins it to the token
baseline for exactly this reason (`:30-32`, with the comment at `:23-29` recording the defect that
motivated it: an ember chip under graphite painted graphite's dark glass behind an ember ring).
`tests/e2e/shell-appearance.spec.ts:180-237` holds that contract today. Any theming shape that
resolves the shell's tokens at `:root` rather than at the element breaks the chip again — and it
breaks it only for the five non-editorial palettes, which is invisible in review.

## Rung 1 — Vigilia

Searched: `docs/architecture/ownership.md` for the shell-palette, shell-chrome and theming owners;
`palette.ts` and `palette.test.ts` in full; `editor-shell.css`'s token blocks, `@theme static`
block, glass rules and the swatch selector; `editor-shell.tokens.test.ts` in full;
`tests/e2e/shell-appearance.spec.ts` in full; the pre-paint block in `packages/editor/index.html`;
`palette-menu.tsx`; `shell-layout.tsx`'s `createShellLayout`; every `--shell-*` and `--vigilia-*`
declaration and reference; `prefers-color-scheme`, `matchMedia`, `color-scheme` across `src/web`;
and `docs/product/backlog.jsonl` for `vg-120`.

Found:

- **The owner exists and is one file.** `ownership.md:107` — "Shell palette |
  `editor/src/editor-shell/palette.ts`". The attribute is written in exactly one function and
  nowhere else, with a comment saying why there is deliberately no element parameter.
- **The palettes are already six and already distinct by surface.** `editor-shell.css:113-124`
  records that `ember`, `moss` and `plum` used to declare an accent and nothing else — the defect
  the acceptance item at `:541-543` exists to catch — and each now carries its own paper, edge,
  text and control surface. `vg-120` was filed for it and withdrawn on the controller's
  reconsideration.
- **Nothing in the editor consumes a Tailwind colour utility.** Every shell colour is read as
  `var(--shell-*)` or `var(--vigilia-*)` from plain CSS rules. So no utility today proves or
  disproves where a palette token resolves — the acceptance item is the only thing that would.
- **Three writers already apply the palette, and a fourth is what OS appearance adds.**
  `index.html:13-24` paints a pre-shell frame from two literals; `createShellLayout`
  (`shell-layout.tsx:363-366`) applies the stored palette before React mounts; `PaletteMenu.choose`
  (`palette-menu.tsx:46-50`) writes storage and the attribute together.
- **The pre-paint block does not consult the stored palette at all.** A profile with `graphite`
  stored still flashes cream, and the block's own comment ("Pre-shell paint only … keep the first
  frame from flashing") claims it does not.

## Rung 2 — dependencies

Searched: `packages/editor/package.json`, and `node_modules/tailwindcss/package.json`.

Found: `tailwindcss` and `@tailwindcss/vite` are both `^4.3.3`, installed as 4.3.3. No theming,
appearance or colour-scheme package is present, and none is needed: the runtime switch is a CSS
custom property plus an attribute, and the OS read is `matchMedia`.

## Rung 3 — platform

Searched: the `prefers-color-scheme` media feature and its `matchMedia` query form; `color-scheme`;
the `dark`/`light` values of the OS preference.

Found: `prefers-color-scheme` is a media feature with three values, and the query form
`matchMedia("(prefers-color-scheme: dark)")` gives a boolean plus a `change` event on the
`MediaQueryList`. It cannot be read from CSS *into* a custom property, and it cannot be read
before first paint by JavaScript that has not loaded. `<meta name="color-scheme" content="light dark">`
is already in `packages/editor/index.html:6` and makes the browser paint its own canvas correctly
under either scheme, which is what keeps the pre-shell frame from being white under a dark OS.

What the platform does **not** give: a way for a stylesheet to say "the OS is dark, so use the
palette named `graphite`". A media query can only restate values; it cannot alias another rule's
declarations. So the OS→palette mapping has to live in one place — JavaScript or CSS — and the two
can only be kept in step by having one of them own it.

## Rung 4 — ecosystem

Searched (web): "Tailwind CSS v4 @theme inline runtime theme switching with a data attribute, why
utilities must reference var() for dark mode"; "React app follow OS prefers-color-scheme as default
theme with an explicit user override, precedence and flash of wrong theme". Read: Tailwind's
`theme` and `dark-mode` documentation, `tailwindlabs/tailwindcss` discussions **#18297** and
**#15122**, and four write-ups on the OS-default-with-override shape (reactuse, codefastlabs,
codezup, chriskirknielsen).

Found, and two of these changed the answer:

1. **`@theme inline` is exactly right here and the reason is not the one the name suggests.**
   Tailwind maintainer, #15122: without `inline`, the utility compiles to
   `background-color: var(--color-background)`, and that variable's *own* value
   (`var(--theme-color-background)`) is substituted **at `:root`** — so a `[data-theme="dark"]`
   override that is not on `:root`, or a subtree that re-declares the inner variable, is lost.
   With `inline` the utility compiles straight to `var(--theme-color-background)` and resolves **at
   the element**. That is the chip's case exactly.
2. **`@theme inline` is also what you must *not* use for a value you overwrite at runtime.**
   Discussion #18297 is a user hitting the same mechanism from the other side: a *literal* value in
   `@theme inline` is baked into the utility, so overriding the theme variable later does nothing.
   The two threads are only contradictory if the distinction is missed — **`inline` is for a theme
   variable whose value is itself a `var()` reference to a runtime-switched property**, which is
   what `--color-shell-surface: var(--shell-surface)` is, and what a literal colour is not.
3. **The OS-default-with-override shape is settled and includes a way back.** Tailwind's own dark
   mode documentation and three of the four write-ups converge on: the stored choice wins, the OS
   is read only when nothing is stored, the `change` listener is attached only while the author has
   not chosen, and *removing* the key returns to following the OS. Every write-up also reports the
   same trap: resolving the appearance in `useEffect` flashes the wrong theme for a frame, and the
   only fix is applying it before paint.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **Palette joins `@theme inline`; `--shell-*` blocks unchanged** | Utilities compile to `var(--shell-*)` and resolve at the element, so the chip keeps its contract and a future utility is safe by construction. The existing `[data-shell-palette]` cascade is untouched — the layer that is already browser-proven stays the owner. | One `@theme inline` block, ten lines; the token test's `@theme` reader learns to read two blocks. | A `--color-shell-*` no utility references is emitted nowhere — the same class the `static` comment at `editor-shell.css:200-206` records. Harmless for a name that exists to be referenced. | **Chosen.** |
| Palette moves *into* `@theme inline` as literal values per palette | The most "Tailwind-native" reading. | Six `@theme inline` blocks, or one plus six override blocks; the `:root`/`[data-shell-palette]` cascade and the swatch's baseline selector both move. | Re-opens the layer whose ordering bugs are documented three times in this file (`:56-59`, `:119-123`, `:170-178`), for no capability gained. | **Rejected** — it rewrites a proven cascade to satisfy a naming convention. |
| Palette stays plain custom properties, no `@theme` at all | Zero change. | Nothing. | §9 asks for `@theme inline` and the acceptance item is about to add utility-shaped probes; a token that resolves at `:root` is a trap left armed for whoever writes the first `bg-shell-surface`. | **Rejected** — it leaves the defect the acceptance item cannot see. |
| OS appearance as a **seventh entry** in the picker ("System") | Explicit, and gives the "back to following" affordance the ecosystem shape has. | A seventh chip with no palette behind it; `shell-appearance.spec.ts:205` asserts the chip list *is* `shellPalettes`; `palette.ts`'s type becomes a union of six names plus one state. | A picker row that names no surface, beside six that do. §9 says "six palettes, six distinguishable things". | **Rejected** — the escape hatch can be added later without moving anything now. |
| OS appearance resolved in a `head` script that reads `localStorage` **and** the media query | Flash-free, the ecosystem's standard shape. | The OS→palette mapping exists twice: once in `palette.ts` and once in a 5-line inline script with no test over it. | Silent drift: the day `graphite` stops being the dark palette, the script still sets it and only a dark-OS author with cleared storage sees it. The first frame is the one frame no test looks at. | **Rejected** — it buys one frame with a second owner of the mapping. |

## Rung 6 — probe

| Measurement | Value | How |
|---|---|---|
| Editor code reading `prefers-color-scheme` / `matchMedia` | **0** | `grep -rn "prefers-color-scheme\|matchMedia\|colorScheme" src/web`, excluding `node_modules` |
| Palettes in the shell | **6**, all with their own surface | `palette.ts:3-10`; `editor-shell.css:91-168` |
| Writers that apply the palette today | **2** (`createShellLayout`, `PaletteMenu.choose`) plus the pre-paint literals | read at the three call sites |
| Shell colours read through a Tailwind utility | **0** | every `--shell-*` reference is inside `editor-shell.css` |
| Blocks in `editor-shell.css` matching `@theme` | **1**, `@theme static` | `editor-shell.tokens.test.ts:45`'s reader assumes exactly one |

**What is *not* measured, and is the plan's own probe.** Whether a utility compiled from
`@theme inline` actually follows `data-shell-palette` into a *subtree* — the chip — is a prediction
from Rung 4.1, not a number, and jsdom resolves no custom properties at all, so it can only be
measured in a browser. The task that writes the block measures it before the block is trusted.

## Decision

**The `--shell-*` blocks stay where they are and stay the owner. The palette joins them through
`@theme inline`, so a utility resolves the runtime variable at the element it is written on rather
than at `:root`. The OS is the appearance's fallback, not a second source: the stored palette wins,
the media query is read only when nothing is stored, and a `change` event re-resolves only while
nothing is stored.**

Three reasons, and the first is the one that decided it:

1. **The chip is a subtree, and `inline` is the only shape that survives one.** Rung 4.1's failure
   mode — resolution at `:root` — is precisely the defect
   `tests/e2e/shell-appearance.spec.ts:180-237` was written for, and it is already contractual.
   Choosing the non-inline shape would rebuild that defect through the door meant to close it.
2. **It adds a layer without moving one.** The rules that are proven in a browser
   (`:root` + `[data-shell-palette]` + the swatch in the baseline selector) keep their order and
   their specificity; `@theme inline` only gives them a name a utility can use. Every failure in
   this file's history is a cascade-ordering failure, and this shape introduces no new ordering.
3. **One source of truth for the mapping.** The OS→palette mapping lives in `palette.ts` beside the
   palette list, where `ownership.md` already says it belongs. The pre-paint frame is handled by
   restating one background and one ink under a media query — two literals, which is the shape that
   block already has — rather than by exporting the mapping into an untestable inline script.
