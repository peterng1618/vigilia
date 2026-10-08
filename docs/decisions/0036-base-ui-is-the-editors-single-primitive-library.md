# 0036 — Base UI is the editor's one primitive library, and §8's Radix ruling is reversed

- **Date:** 2026-10-08
- **Status:** superseded by [0038](0038-base-ui-is-the-editors-one-primitive-library-on-the-users-ruling.md),
  which reinstates this note's ruling — Base UI — with the premise below corrected
- **Paths:** `src/web/packages/editor/src/components/ui/`
  (`dialog.tsx`, `popover.tsx`, `colour-picker.tsx`),
  `src/web/packages/editor/src/editor-shell/shell-layout.tsx`

## The problem

Spec §8 rules: *"standardise on Radix as the single primitive library, and migrate the five Base UI
imports."* Plan 9's Phase 1 was written to execute that. Its Task 1.1 went looking for the two
pointer-anchored surfaces and found that the libraries cannot carry them:

> `Anchor` is exported by neither `@radix-ui/react-dropdown-menu@2.1.25` nor
> `@radix-ui/react-context-menu@2.3.8` — the string appears in no file of either package's `.d.ts` —
> while `@radix-ui/react-popper@1.3.7` and `@radix-ui/react-menu@2.1.25` each export one.

So two of the five surfaces — the Insert `+` chooser, which anchors to the `+` in the pane bar, and
the canvas context menu, which anchors to a pointer position through a synthetic
`getBoundingClientRect` — have no Radix menu mechanism, because **Radix positions menu content to
its Trigger**. The plan's own Step 4 names that condition as a stop, and Phase 1 stopped there.

The question this note answers is not "how do we finish Phase 1" but **"which of the two libraries
is the right one to standardise on"**, because §8's ruling was made on a premise that the
measurement above falsifies.

## Rung 1 — Vigilia

Searched: every primitive import in `packages/*/src`; `ownership.md`; the three `components/ui`
wrappers; who consumes them.

Found: **the editor's two libraries are not two menu libraries.** Measured 2026-10-08:

| Library | Imports | Where |
|---|---|---|
| Base UI | **4** | `shell-layout.tsx`, `palette-menu.tsx`, `display-switch.tsx` (`menu`), `canvas-context-menu.tsx` (`context-menu`) |
| Radix | **3** | `components/ui/popover.tsx`, `components/ui/dialog.tsx`, `components/ui/colour-picker.tsx` |

**No menu surface is Radix, and no Radix file is a menu.** (Reconciled: the fifth import counted here, `insert-popover.tsx`, was deleted in plan 2 Task 3, so the count is 4; the conclusion is unchanged.) The incoherence §8 describes is
`Menu` for the palette versus `Popover` for the colour picker, and the ruler that makes it visible is
that the editor has **two of them at 297 lines**: 34 (dialog) + 42 (popover) + 221 (colour picker).
Two consumers: `editor-shell/shortcut-reference.tsx` takes `Dialog`, `palette-manager/panel.ts` takes
`ColourPicker`.

So §8's five-to-migrate figure is the *small* side of the ledger and the three-file side is the
*large* one — the opposite of what the ruling assumed.

## Rung 2 — dependencies

Searched: `packages/editor/package.json` and the installed trees.

Found: `@base-ui/react` **^1.8.0** (installed 1.8.0), `@radix-ui/react-popover` ^1.1.23,
`@radix-ui/react-dialog` ^1.2.0, and `@radix-ui/react-dropdown-menu` ^2.1.25 +
`@radix-ui/react-context-menu` ^2.3.8 — the last two installed by plan 9's Task 1.1 for a Phase 1
that stopped, and **consumed by nothing**.

Base UI ships `dialog/`, `popover/`, `menu/`, `context-menu/`, `menubar/`, `collapsible/`,
`combobox/`, `autocomplete/`, `select/` and more as subdirectories of one package. Radix ships one
package per primitive, and the menu packages do not re-export `Anchor`.

## Rung 3 — platform

Searched: `<dialog>`, `<details>`, the Popover API, `popover`/`anchor` attributes.

Found: native `<dialog>` already carries five call sites in three modules and `<details>` already
carries the inspector's sections (`controls/property-section.ts`) — both are recorded in §8's
corrected table and neither needs a library. The CSS Anchor Positioning API exists but is not
baseline across the browsers this ships to, and using it would mean owning the positioning,
dismissal and focus behaviour that a primitive library is for.

**This rung does not discharge rungs 4–5**, which is the mistake the gate's own README names.

## Rung 4 — ecosystem

Searched: `Base UI vs Radix UI primitives which to choose 2026 comparison`;
`Radix UI maintenance status WorkOS acquisition future development`; the shadcn/ui changelog; the
Radix release log; the tldraw migration spike (issue #7584) and the PR that followed it.

Found, consistently across sources:

- **Base UI v1.0 reached stable in December 2025**; this repo is on 1.8.0 and it is shipping.
- **The original Radix authors now work on Base UI**, which is maintained by MUI with a dedicated
  full-time team. Radix is maintained by WorkOS and is **not deprecated**, but its release log shows
  a gap: regular releases through **August 2025, then nothing until June 2026**.
- **shadcn/ui added Base UI as a selectable primitive layer in December 2025**, with full
  component documentation in January 2026, and the CLI now generates either. The wrappers in this
  repo are hand-owned shadcn derivatives, so the ecosystem they came from has already made this
  choice available.
- The ecosystem consensus for a **new or lightly-committed** codebase is Base UI; the standing advice
  to *stay* on Radix is explicitly scoped to codebases "already deep in" it. This editor has **297
  lines and two consumers** on the Radix side and **five surfaces plus a 1.8.0 dependency** on the
  Base UI side — it is deep in Base UI, not Radix.
- The one caution found — tldraw's commenter advising a 6–12 month wait "until dust settles" — is
  dated January 2026 and was written about a much larger, public-API-exposing migration. Ten months
  on, and for a wrapper this thin, it no longer binds.

**The migration shape is documented and short.** Radix puts positioning on `Content`
(`side`/`align`/`sideOffset`); Base UI separates `Positioner` from `Popup` — which the editor's own
Base UI menus already do (`Menu.Positioner` + `Menu.Popup`) — and replaces `asChild` with the
`render` prop.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Stay on §8's ruling: migrate 5 surfaces to Radix | **Cannot** — 2 of 5 have no Radix mechanism | — | Two libraries retained, plus a second hand-wired anchoring path | Rejected |
| Standardise on **Base UI**: migrate the 3 Radix files | **Exact** — Base UI has `dialog`, `popover`, `menu`, `context-menu` | 297 lines, 2 consumers, 1 `asChild`, 0 CSS variables | Low; wrapper APIs are ours and their consumers are two | **Chosen** |
| Native `<dialog>` + CSS anchor positioning everywhere | Partial — menus need dismissal, roving focus, typeahead | High, and re-implements a solved problem | Silent regressions in keyboard behaviour | Rejected |
| Keep both libraries | Works today | — | The thing §8 exists to remove | Rejected |

## Rung 6 — probe

Measured against the installed tree on 2026-10-08, by grep and by reading the packages' own type
declarations:

- **No `--radix-*` custom property and no `data-radix` selector** is used by any of the three files,
  nor by `editor-shell.css`. The migration carries no CSS work.
- **One `asChild`**, at `colour-picker.tsx:133` (`<PopoverPrimitive.Trigger asChild>`).
- `@base-ui/react/dialog` exports `Root, Trigger, Portal, Popup, Backdrop, Title, Description,
  Close, Viewport`; `@base-ui/react/popover` exports `Root, Trigger, Portal, Positioner, Popup,
  Arrow, Backdrop, Title, Description, Close, Viewport`. Every element `dialog.tsx` and `popover.tsx`
  use has a counterpart: `Overlay` → `Backdrop`, `Content` → `Popup` (with `Positioner` for the
  popover's `align`/`sideOffset`).
- `Anchor` is absent from both Radix menu packages and present in `@radix-ui/react-popper` and
  `@radix-ui/react-menu` — the measurement that stopped Phase 1, re-confirmed here from the `.d.ts`
  files rather than from the probe's transcript.

## Decision

**Base UI is the editor's one primitive library.** The three Radix files move to it, and the two
Radix menu packages installed for the stopped Phase 1 come back out of the manifest.

The reason is not that Base UI is cheaper — though it is, by a wide margin — but that **the two
criteria agree**: it is the more actively maintained primitive layer *and* the only one of the two
that can express every surface this editor has. §8's ruling bought a library that cannot anchor a
context menu to a pointer, in order to unify with a library the editor used in three files.

**What this reverses and what it does not.** §8's *diagnosis* — two primitive libraries at once, and
two popover implementations — stands, and this decision ends it in the other direction. §8's
*remedy* is superseded. The five Base UI menu surfaces do not move.

Supersedes: `2026-10-03-dashboard-authoring-design.md` §8's ruling line. Plan 9's Phase 1 is
rewritten against this note rather than against that ruling.
