# 0037 — React Aria Components is the editor's one primitive library

- **Date:** 2026-10-08
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/components/ui/` (`dialog.tsx`,
  `popover.tsx`, `colour-picker.tsx`),
  `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- **Supersedes:** `0036-base-ui-is-the-editors-single-primitive-library.md`

## The problem

The editor runs two primitive libraries at once. Spec §8 ruled that Radix should be
the one and the five Base UI imports should migrate to it. Plan 9's Task 1.1 went
looking for the two pointer-anchored surfaces and found Radix cannot carry them:
`Anchor` is exported by neither `@radix-ui/react-dropdown-menu` nor
`@radix-ui/react-context-menu`, because **Radix positions menu content to its
Trigger**. Phase 1 stopped there.

Decision 0036 answered that by naming Base UI, on the reasoning that it was *"the only
one of the two that can express every surface this editor has"*. The user then asked
for the field to be widened — *"It doesn't have to be either one of the two existing
libraries. It could be a new one we haven't considered"* — and stated the criterion:
**the most superior, future-proof library, even at migration cost.**

**That widening falsifies 0036's premise.** Pointer anchoring is not a Base UI
exclusive and never was; it eliminates Radix and nothing else. The survey below
measures four libraries that can do it, and two of them ship primitives this editor
currently hand-rolls.

## Rung 1 — Vigilia

Searched: every primitive import in `packages/*/src`; `ownership.md`; the contents of
`components/ui/`; who consumes each wrapper.

Found, measured 2026-10-08:

| Library | Files | Lines | Installed packages |
|---|---|---|---|
| Base UI 1.8.0 | 5 (`menu` ×4, `context-menu` ×1) | 1288 (shell-layout alone 685) | 1 |
| Radix 1.2.0 / 1.1.23 | 3 (`dialog`, `popover`, `colour-picker`) | 297 | 22 `@radix-ui/*` |
| native `<dialog>` | 3 (`new-document-chooser`, `persistence-manager`, `theme-library-dialog`) | — | 0 |
| native `<details>` | the inspector's sections | — | 0 |

Two Radix components pull 15 direct dependencies each and land 22 packages in
`node_modules`; Base UI's whole library is one package at 9.4 MB on disk. Neither
figure is shipped-bundle size — it is dependency-graph surface, which is the number
that matters for supply-chain risk and for upgrade cost.

**The surface set a single library must carry**, named once so every candidate is
judged against the same six:

- **S1** modal dialog — the shortcuts reference sheet
- **S2** trigger-anchored popover, with side/align/offset control
- **S3** colour picker — 2-D area, hue strip, hex input, alpha
- **S4** menu on a toolbar button — sections, labels, submenu, typeahead
- **S5** **context menu anchored to a raw pointer coordinate** — the surface that
  eliminated Radix. The editor computes a synthetic rect today
  (`canvas-context-menu.tsx:146-157`) and hands it to Base UI's `Positioner anchor`.
- **S6** disclosure — today native `<details>`

**`vg-194` is the measurement that makes S3 matter rather than a nicety.**
`components/ui/colour-picker.tsx`'s `Track` renders `role="slider"`, `tabIndex={0}`
and `aria-valuenow`, and binds only `onPointerDown`/`onPointerMove` — the file
contains no `onKeyDown` at all. Each of the picker's tracks takes a tab stop,
announces "slider, 42 percent" to assistive technology, and does nothing for any key.
`aria-valuemin`/`aria-valuemax`, which the role requires, are absent. The editor's
colour picker is 221 lines of hand-rolled interaction with a real accessibility
defect in it.

## Rung 2 — dependencies

Searched: `packages/editor/package.json`, the installed trees, and the published
`dependencies` of each candidate.

Found:

- **Base UI** `^1.8.0`. Ships `dialog/`, `popover/`, `menu/`, `context-menu/`,
  `collapsible/`, `accordion/`, `slider/`, `menubar/` and more in **one package**.
  **Ships no colour primitive** — verified by listing
  `node_modules/@base-ui/react/`: there is no `color/` or `colour/` directory, and no
  colour entry anywhere in the package.
- **Radix** `react-dialog` ^1.2.0 + `react-popover` ^1.1.23, plus 20 transitive
  `@radix-ui/*` packages. No colour primitive either.
- **React Aria Components**: one direct dependency, 7 declared, over a monorepo that
  publishes ~80 packages. `sideEffects: ["*.css"]` on the components package and
  `false` on `react-aria`.
- **Ark UI**: one direct dependency over **69 transitive runtime packages**, 68 of
  them `@zag-js/*` pinned exactly.
- **Ariakit**: one direct dependency over 8 nodes, one of which
  (`@ariakit/react-components`) documents that it *"does not follow semantic
  versioning"*.

## Rung 3 — platform

Searched: `<dialog>`, `<details>`, the Popover API, `popover`/`anchor` attributes, and
CSS Anchor Positioning.

Found: native `<dialog>` already carries three call sites in three modules and
`<details>` already carries the inspector's sections — both are in use and neither
needs a library. CSS Anchor Positioning exists but is not baseline across the browsers
this ships to, and using it would mean owning the positioning, dismissal and focus
behaviour that a primitive library exists to provide.

**This rung does not discharge rungs 4–5**, which is the mistake the gate's own README
names.

## Rung 4 — ecosystem

Searched, in this order: `Base UI vs Radix UI primitives which to choose 2026`;
`Radix UI maintenance status WorkOS acquisition future development`; the shadcn/ui
changelog; the Radix release log; the tldraw migration spike (issue #7584); then, on
the user's instruction to widen, four parallel passes over
`React Aria Components` (Adobe), `Ark UI` / `Zag.js`, `Ariakit`, and a screening pass
across `Headless UI`, `Mantine`, `React Spectrum`, `Park UI`, `HeroUI`, `Vaul`,
`Floating UI`, `Downshift`, `Reach UI`, `@headlessui-float` and the shadcn registry.
Sources were the projects' own docs, their GitHub release APIs, npm registry metadata,
and the packages' published type declarations and bundles.

Found:

**The field is six libraries, and no seventh entrant exists.** Headless UI, Mantine,
React Spectrum, Park UI, HeroUI, Vaul, Downshift, Reach UI and `headlessui-float` were
each eliminated on a named ground — styled-first, absent surfaces, abandoned (Reach
UI's last release is 2022-10-13), or React-19-incompatible peer ranges. `Floating UI`
is the positioning engine the field sits on, not a replacement for it. `shadcn/ui` is
a copy-paste registry, not a library, and in 2026 it emits components for three
backends — so it contributes no new candidate, only corroboration that Base UI, Radix
and React Aria are the ecosystem's own shortlist.

**Pointer anchoring (S5) is not a differentiator; it eliminates Radix alone.** Four
candidates express it, each verified against a published artefact rather than a
summary:

| Library | Mechanism | Where verified |
|---|---|---|
| Base UI | `Positioner anchor` accepts a virtual element | this repo's running code, `canvas-context-menu.tsx:146-157` |
| React Aria | `MenuTriggerType = 'press' \| 'longPress' \| 'contextMenu'`; `getTargetRect?: (target: Element) => DOMRect \| null \| undefined` | react-stately 3.51.0 and react-aria 3.53.0 published types |
| Ark UI | `anchorPoint`; the machine builds the rect — `const getAnchorRect = anchorPoint ? () => ({ width: 0, height: 0, ...anchorPoint }) : void 0` | `@zag-js/menu@1.45.0 dist/menu.machine.js:702` |
| Ariakit | `getAnchorRect?: (anchor: HTMLElement \| null) => AnchorRect \| null`, with a shipped context-menu example | `@ariakit/react@0.4.41` published types |
| **Radix** | **none** — menu content is positioned to its Trigger | Task 1.1's `.d.ts` reads |

**S3 (colour picker) is the real differentiator.** React Aria ships eight components —
`ColorArea`, `ColorSlider`, `ColorField`, `ColorPicker`, `ColorSwatch`,
`ColorSwatchPicker`, `ColorThumb`, `ColorWheel` — verified by listing
`react-aria-components@1.22.0`'s published types. Ark UI ships an equivalent headless
`ColorPicker` family (`Area`/`ChannelSlider`/`ChannelInput`/`TransparencyGrid`). Base
UI and Ariakit ship **no colour primitive at all**.

**Maintenance and governance, measured from the registries and npm publish metadata
rather than from articles:**

| | Base UI | Radix | React Aria | Ark UI | Ariakit |
|---|---|---|---|---|---|
| Publish path | `mui/base-ui` | `radix-ui/primitives` | `adobe/react-spectrum` | `chakra-ui/ark` | `ariakit/ariakit` |
| Backing | MUI | WorkOS | Adobe | Chakra UI | one maintainer |
| Licence | MIT | MIT | Apache-2.0 | MIT | MIT |
| Stable releases since 2025-04 | 10 (first stable 2025-12-11) | 18, with a **10-month hole** (2025-08-13 → 2026-06-06) | 1.15→1.22 across 2026, ~6–8 weeks | ~62 releases / 18 months | 21 releases / 12 months |
| Right now | monthly; 1.8.0 @ 2026-09-04 | resumed; 1.2.0 @ 2026-10-05, 1.3.0 RC shipping daily | 1.21.1 @ 2026-09 | 5.39.3 @ 2026-10-05; **v6 pending** | 0.4.41 @ 2026-10-05; still `0.x` |

**0036 read Radix's decline correctly and then over-read it.** The 10-month stable
silence is real and is the single strongest piece of evidence of decline in the field —
but it has since reversed, and Radix is publishing RC builds as this note is written.
It is a signal that recovered, not a trend.

**0036's claim that "the original Radix authors now work on Base UI" does not survive
checking and is struck.** Base UI's npm maintainer list is MUI staff
(`oliviertassinari`, `michaldudak`, `mnajdova`, `colmtuite`) plus `atomiks` — the
author of **Floating UI**, not of Radix — while a Radix maintainer
(`chancestrickland`) is still on the Radix side.

**Two eliminations follow from the user's own criterion, "future-proof":**

- **Ariakit** — 91.7% of non-bot merged PRs in 18 months authored by one person; a
  named core-team member with zero commits in that window; no company or foundation;
  still `0.4.x` after years, with breaking changes shipped in minor versions; and an
  accessibility record that is asserted rather than evidenced (no audit, no
  assistive-technology matrix, and the maintainer's own statement that the testing
  detail is out of budget). The pointer-anchor API is the cleanest of the five, and it
  is not enough.
- **Ark UI** — a pending v6 breaking migration that changes every component's data
  attributes, whose own target date (Q2 2026) has already passed; two release trains in
  the critical path, with logic bugs routed to the *other* repository; a two-person
  core; and funding measured in tens of thousands rather than payroll.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **React Aria Components** | **Exact** — one package covers S1–S6, and S3 is shipped rather than hand-rolled | 8 sites rewritten; one direct dep over a ~80-package monorepo tree | Homegrown React-locked positioning; `SubmenuTrigger` is `@version alpha`; closed Adobe committer set | **Chosen** |
| Base UI (0036's answer) | 5 of 6 — **no colour primitive**, so S3 stays hand-rolled and `vg-194` stays ours to fix | Lowest: 3 files, 5 sites stay | Ten months old as a stable line; eight minor bumps in that time | Rejected — leaves the measured defect in place |
| Ark UI | 6 of 6 | 8 sites; 69 transitive packages | v6 breaking migration, slipped; two release trains; thin funding | Rejected |
| Ariakit | 4 of 6 — no colour, and its own slider absent | 8 sites | Bus factor one; `0.x` forever | Rejected |
| Radix (§8's ruling) | **Cannot** — S5 has no mechanism | — | — | Rejected |
| Keep both libraries | Works today | — | The thing §8 exists to remove | Rejected |
| Native `<dialog>` + CSS anchor positioning | Partial — menus need dismissal, roving focus, typeahead | High, and re-implements a solved problem | Silent regressions in keyboard behaviour | Rejected |

## Rung 6 — probe

Measured 2026-10-08, from published artefacts fetched with `npm pack` into a temp
directory outside the repo, and from the installed tree:

- `@base-ui/react`'s directory listing contains **no colour primitive** — 46 entries,
  none of them `color/` or `colour/`.
- `@radix-ui/react-dialog` and `-popover` each declare **15 direct dependencies**; 22
  `@radix-ui/*` packages are installed for two components.
- `MenuTriggerType = 'press' | 'longPress' | 'contextMenu'` — `react-stately@3.51.0`
  published types.
- `getTargetRect?: (target: Element) => DOMRect | null | undefined`, documented
  *"Useful for positioning relative to a specific point such as the mouse cursor (e.g.
  context menus) or text selection"* — `react-aria@3.53.0` published types. It reaches
  the `Popover` component by type inheritance: `AriaPositionProps` → not omitted by
  `AriaPopoverProps` → not omitted by `PopoverProps`.
- `const getAnchorRect = anchorPoint ? () => ({ width: 0, height: 0, ...anchorPoint })
  : void 0` — `@zag-js/menu@1.45.0` `menu.machine.js:702`.
- `getAnchorRect?: (anchor: HTMLElement | null) => AnchorRect | null` —
  `@ariakit/react@0.4.41` published types.
- `@base-ui/react` 1.8.0: 10 stable releases, first `1.0.0` on 2025-12-11, latest
  `1.8.0` on 2026-09-04. `@radix-ui/react-dialog`: 18 stable releases in the window,
  the hole, then `1.2.0` on 2026-10-05.
- **Not measured:** the shipped-bundle contribution of each candidate after
  tree-shaking. The dependency counts above are install-graph surface, not bundle size,
  and are reported as such.

## Decision

**React Aria Components is the editor's one primitive library.** The three Radix files
and the five Base UI surfaces all move to it, and `@radix-ui/react-dialog`,
`@radix-ui/react-popover` and `@base-ui/react` come out of the manifest.

The reason is the user's own criterion applied to the measurement above, not a
preference for a newcomer:

1. **It is the only library that is both viable on all six surfaces and ships the one
   the editor has measurably got wrong.** S5 is solved natively, and S3 — where
   `vg-194` records a focusable `role="slider"` that no key can operate — is a shipped,
   APG-conformant component family rather than 221 lines we own. Base UI covers five of
   six; this covers six.
2. **It has the strongest longevity evidence of any candidate**, which is what
   "future-proof" asks for: Adobe-funded under Apache-2.0, a six-year published
   history, minor releases every six to eight weeks without a gap, and the field's only
   published screen-reader test matrix.
3. **Every rejection above is on the user's criterion rather than on cost** — Ariakit
   on bus factor, Ark on a slipped breaking migration, Radix on capability, Base UI on
   the missing primitive. The migration cost is explicitly accepted.

**What this does not claim.** React Aria's positioning engine is homegrown and
React-locked, not Floating UI; `SubmenuTrigger` is marked `@version alpha`; and its
committer set is closed, so the bus factor is bounded by Adobe rather than widened by
the community. These are real costs, recorded here rather than argued away, and the
probe that would settle the first one — how `trigger="contextMenu"` behaves inside this
editor's canvas stacking context — is Phase 1's to run before any surface is called
done.

**What this reverses and what it does not.** §8's *diagnosis* — two primitive libraries
at once — stands, and this ends it. §8's *remedy* (Radix) and 0036's *remedy* (Base UI)
are both superseded. The native `<dialog>` call sites and the `<details>` sections stay
native: they are not part of this migration.
