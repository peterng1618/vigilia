# 0033 — A new primitive in plan 7 is a Radix Dialog; the tooltip is not a primitive and stays ours

- **Date:** 2026-10-07
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/components/ui/`,
  `src/web/packages/editor/src/editor-shell/shell-layout.tsx`,
  `src/web/packages/editor/src/editor-session.ts`

## The problem

Spec §8 rules that **Radix is the single primitive library** and that the five Base UI
imports migrate to it, "sequenced as its own plan phase rather than folded into layout
work" (`2026-10-03-dashboard-authoring-design.md:443-445`). The Sequencing table puts
"Chrome and appearance" at plan 9 (`:475`), which reads as though plan 9 owns that phase.

Plan 7 (Keyboard, §7) is the first plan after that ruling that needs components the editor
does not have: a **Tooltip**, so every action can show its shortcut, and a **Dialog**, for
`?`. §8's own table records `dialog (the ? reference)` as belonging to **neither** library
today (`:431`). So plan 7 has to decide something, and the decision is not the library —
§8 settled that — it is **which plan pays for it**.

Three answers were on the table:

- **A.** Plan 7 adds Radix where it needs a new primitive; plan 9 keeps the migration.
- **B.** Plan 7 carries the whole Base UI migration, leaving plan 9 as appearance only.
- **C.** Plan 7 adds no library at all: the tooltip is ours already, and the dialog becomes
  the fourth hand-rolled native `<dialog>` in the editor.

**A is chosen, with one correction to the premise.** §7 is said to need *two* primitives.
It needs **one**: the tooltip is not missing, it is ours.

## Rung 1 — Vigilia

Searched: `docs/architecture/ownership.md` for the primitive, tooltip, dialog, menu and
shortcut owners; every `@base-ui` / `@radix-ui` import; `showModal`, `<dialog`,
`role="dialog"`, `aria-modal`; every `tooltip(` call site; `<kbd>`; `PRODUCT_SHORTCUTS`;
`navigator.platform` / `userAgent` / `isMac`.

Found — and this is the finding the rest of the note turns on:

- **The editor's tooltip already exists, hand-owned, and is contracted.**
  `editor-shell/controls/tooltip.ts` exports `tooltip({ trigger, text })`: a DOM function,
  portalled to `document.body`, positioned above the trigger, dismissed by pointer-leave,
  blur, Escape or an outside pointer-down, at most one open at a time, class
  `.editor-shell-tooltip`. Four call sites — `editor-shell/canvas-dock.tsx:36`,
  `editor-shell/controls/settings-field.ts:268`, `selection-inspector/glass.ts:111`, and
  the module itself — plus its own DOM test and **two locators in
  `tests/e2e/editor.spec.ts` (`:1427`, `:1473`) that name the class**. The dock's own
  comment (`canvas-dock.tsx:16-20`) records *why* it is not a component: the selection
  inspector builds elements with `document.createElement` and never sees React, so a React
  primitive cannot be the shared mechanism.
- **The editor's dialog idiom already exists, hand-rolled on the platform, three times.**
  `document.createElement("dialog")` + `showModal()`, class `vigilia-dialog`, in
  `new-document-chooser.ts` (`chooseArtboardSize`), `persistence-manager/index.ts`, and
  `theme-library-dialog.ts`. `.vigilia-dialog` and its `::backdrop` are styled at
  `editor-shell/editor-shell.css:761-788`.
- **Nothing displays a shortcut anywhere.** No `<kbd>` element exists in the repo.
  `PRODUCT_SHORTCUTS` (`shortcut-manager/index.ts:31-65`) is **module-private** and is a
  `readonly ShortcutBinding[]` — a list of bindings, not a map from an action to its chord.
  `uiCopy` owns every visible word and names no key.
- **Two canvas action surfaces render from one registry**: `CanvasDock`
  (`editor-shell/canvas-dock.tsx`, `OBJECT_ACTIONS` filtered by eligibility) and
  `ArrangeToolbar` (`editor-shell/shell-layout.tsx:132-161`, `arrangeActions()`, always
  drawn, disabled when ineligible, `title=` rather than the shell's tooltip).

So the repo is not missing a tooltip. It is missing a **dialog that is not a fourth copy of
our own**, and it is missing a **display for a shortcut**.

## Rung 2 — dependencies

Searched: `packages/editor/package.json`; the whole lock tree for `@radix-ui/*`.

Found: `@base-ui/react ^1.8.0` and `@radix-ui/react-popover ^1.1.23` are both direct
dependencies of `packages/editor`. The lock tree carries
`@radix-ui/react-{primitive,arrow,compose-refs,context,dismissable-layer,focus-guards,focus-scope,id,popper,portal,presence,slot,use-callback-ref,use-controllable-state,use-effect-event,use-layout-effect,use-rect,use-size}` and `@radix-ui/rect`
— i.e. **the Dialog's dependency closure is already installed for the popover**, and only
`@radix-ui/react-dialog` itself is absent. Also absent: `@radix-ui/react-tooltip`,
`@radix-ui/react-collapsible`, `@radix-ui/react-select`. No third headless library is
present, and `@radix-ui/react-popover` is **not** listed in `THIRD-PARTY-NOTICES.md` or
`docs/engineering/dependencies.md`, though `@base-ui/react` is — a pre-existing gap in the
licence inventory that this decision's own dependency row sits beside.

## Rung 3 — platform

Searched: the `<dialog>` element and `showModal()`; the Popover API (`popover`,
`popovertarget`); `inert`; `ElementInternals`.

Found: `showModal()` gives, with no JavaScript beyond the call, focus moved into the dialog,
**focus containment and `inert` on the rest of the page**, `role="dialog"` with implicit
`aria-modal="true"`, top-layer rendering that bypasses `z-index` and portals, a
`::backdrop` pseudo-element, and Escape-to-close handled by the browser. MDN documents all
six. The repo already relies on this in three modules. What the platform does **not** give:
a controlled-open React API (the `close` event is not cancellable, which is Radix's own
stated reason for not building on it), so a React-owned open state has to be reconciled by
hand. The Popover API is not modal and is used nowhere here.

**Rung 3 passing does not discharge rungs 4-5**, and here it does not: the platform is good
enough, and §8 rules against it anyway (see Rung 5).

## Rung 4 — ecosystem

Searched (web): "comparison Radix UI versus Base UI headless React primitives 2025 which to
choose accessibility bundle"; "Radix Dialog under jsdom tests ResizeObserver getAnimations
stub focus trap slow"; "using both Radix primitives and Base UI in the same app two headless
libraries mixing problem"; "native dialog element showModal versus Radix Dialog when to use
platform modal inert focus trap". Read: shadcn/ui's own comparison pieces, the shadcn/ui
Radix-vs-Base-UI articles from December 2025 through July 2026, `mui/base-ui#2854`,
`radix-ui/primitives#3694`, `#4148`, `#420`, `#856`, `#2218`, `#2830`, MDN's `<dialog>`
reference, and a July 2026 OpenReplay piece on native-vs-library modals.

Found, and four of these changed the shape of the answer:

1. **Mixing two headless libraries is a reproduced defect, not merely duplication.**
   `mui/base-ui#2854` and `radix-ui/primitives#3694` are the same bug reported to both
   sides: a Base UI popup inside a Radix Dialog is visible but **unselectable**, because
   Radix's Dialog sets `pointer-events: none` on `body` and installs a scroll lock, and
   Base UI portals its popup to `document.body`. The workaround is a shared portal
   container. Two independent write-ups put the general rule plainly — *"mixing two
   primitive libraries means two portal implementations and two focus models in one
   bundle"*, and *"pick one family per product and migrate wholesale"*.
   **This does not make plan 7's addition safe; it raises the priority of plan 9's
   migration, and it constrains where the new Dialog may be used** (Task 3.2's constraint).
   It also does not make the mixed state *new*: §8:410-414 records that the app already has
   two libraries and two popover implementations today. Plan 7 adds to a state that exists;
   it does not create it.
2. **Radix Dialog under Vitest + jsdom is a known minefield, and this repo already carries
   the stubs for exactly this class of problem.** Radix's `use-size` runs `ResizeObserver`
   in a layout effect on mount, so every Radix primitive throws `ReferenceError:
   ResizeObserver is not defined` under jsdom (`#420`, and a 2026 commit adding a global
   no-op stub for precisely Tooltip/Dialog/Popover/Tabs). Separately,
   `@radix-ui/react-focus-scope`'s unmount `setTimeout` reads realm globals at fire time, so
   under Vitest it can run **after the jsdom environment is torn down** and throw
   `parameter 1 is not of type 'Event'` (`#4148`). And `#2218` is a long thread of
   `getAnimationName` style-recalculation cost in `Presence`, with users reporting
   multi-second dialog opens on large pages.
   **Plan 7's Dialog tasks must carry the drain and must not add a fourth stub silently.**
3. **The 2026 default advice has moved to the native element.** MDN and the ecosystem
   write-ups now say to default to `<dialog>` + `showModal()` and reach for a library only
   for composability, rich animation, or exotic stacking — one cited rewrite went from
   ~400 lines of JS to ~38. Base UI reached v1.0 in December 2025 with active maintenance;
   Radix's velocity has slowed and shadcn/ui made Base UI its default for new projects in
   July 2026. **This is recorded as a stated risk of §8's ruling, not as a re-litigation of
   it** — the ruling is the user's, it is not obviously wrong (Radix is MIT, per-component,
   and the repo already owns a shadcn-idiom Radix component), and reversing it is a
   one-component revert either way.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **Radix Dialog, plan 7** (§8's ruling, applied to the first plan that needs it) | The rejected alternative in §8: "the redesign adds a Dialog … from a third source, and the incoherence compounds" (`:448-449`). MIT; the dependency closure is already installed. | One new package row; the licence inventory; a jsdom minefield (Rung 4.2). | Latent: nothing inside this Dialog may be a Base UI popup. | **Chosen.** |
| Radix **Tooltip**, plan 7 | §8 lists Tooltip as a Radix capability, but §7's requirement is *a chord inside the tooltip we already have*. | Rewriting a working, e2e-contracted mechanism; a second tooltip owner; the selection inspector still needs the DOM one. | Two tooltip mechanisms — the exact "two of everything" §8 exists to end. | **Rejected.** |
| **Native `<dialog>`, a fourth one** | Precedent is real: three existing dialogs, and the platform is the 2026 default. | ~40 lines of hand-rolled focus/return-focus/backdrop, plus the escape-and-deferral wiring the other three each carry. | §8 names this outcome as the failure the ruling prevents; each of the three existing dialogs re-implements the same open/close/settle logic. | **Rejected** — it is §8's stated third source, and the fourth copy compounds it. |
| **Carry the Base UI migration into plan 7** (Option B) | §8 wants it done; doing it here ends the mixed state sooner. | Five files and their tests, including `shell-layout.dom.test.tsx`, which `vg-135` already makes pathological (one Base UI menu click blocks 50-90 s under jsdom). | Plan 7 becomes a two-subject plan; a reviewer cannot reject the keyboard work and accept the migration. | **Rejected** — see below. |
| **Do nothing in plan 7** (Option C) | Zero dependency. | §7's `?` reference would be the fourth hand-rolled dialog and would then also need migrating. | Contradicts §8's table row for exactly this surface. | **Rejected.** |

**Option B, the alternative the spec's own table implies, is rejected on three grounds.**
§8 says the migration "is sequenced as its own plan phase rather than folded into layout
work" (`:443`) — the Sequencing table's ordering principle is *"Ordered by what becomes
visible, not by what is easy to specify"* (`:461`), and a primitive swap that renders
identically contributes **no visible change**, so it belongs in the phase whose visible
change *is* chrome. It would drag `shell-layout.dom.test.tsx` — where `vg-135` already
costs 50-90 s for one Base UI menu click and reddens the full unit suite — into a plan whose
subject is keyboards. And five files plus their tests is a scope a reviewer must accept or
reject as a whole, with no way to accept the keyboard work without it.

**Consequence for plan 9, recorded so it is inherited rather than re-decided.**
Plan 9 is **not** appearance only. It owes:

- the five Base UI imports and their tests, per §8:410-412 and `:443-446`;
- the decision §8 left open about the editor's **three hand-rolled `<dialog>`s**
  (`new-document-chooser.ts`, `persistence-manager/index.ts`, `theme-library-dialog.ts`) —
  this note does not migrate them, and plan 7 adds none;
- the `Collapsible` the inspector sections need, which §8's table also records as belonging
  to neither library.

## Rung 6 — probe

What was measured, how, and by whom. **The counts below are new and were taken by reading
the tree on 2026-10-07; the timing is pre-existing and is labelled with its provenance.**

| Measurement | Value | How |
|---|---|---|
| Tooltip call sites in the editor | **4** | `grep -rn "tooltip("` over `packages/editor/src`, excluding tests |
| Tooltip locators in the browser suite | **2** (`editor.spec.ts:1427`, `:1473`) | `grep -rn "editor-shell-tooltip"` |
| Hand-rolled native `<dialog>` modules | **3** | `grep -rn "showModal"` over `packages/editor/src` |
| Radix packages installed | **19**, `react-dialog` absent | `grep -o '"@radix-ui/[a-z-]*"' package-lock.json \| sort -u` |
| `ProductShortcutId` members | **18** | `shortcut-manager/index.ts:2-21`, counted from the union |
| Base UI menu-trigger click under jsdom | **50-90 s**, one click; 190 s for the View-menu test alone | **Pre-existing**, filed as `vg-135` with the profiling in `STATUS.md`; re-quoted here, not re-measured |

**What is *not* measured, and is the plan's first probe.** The cost of a Radix Dialog under
this workspace's jsdom — whether `ResizeObserver` and `getAnimations` (already stubbed for
Base UI) suffice, and whether the `FocusScope` unmount timer needs a drain — is a
prediction from Rung 4.2, not a number. `docs/superpowers/plans/2026-10-07-keyboard.md`
Task 3.1 measures it before the wrapper is trusted, and Task 2.3 measures whether the
merged toolbar's single click also stalls before it blames `vg-135`.

## Decision

**Plan 7 adds `@radix-ui/react-dialog` and one wrapper for it, and adds no other
library.** The shortcut display goes into the tooltip the editor already owns. The five
Base UI imports stay for plan 9.

Three reasons, and the third is the one that decided it:

1. **§8's ruling applies from the moment it is made**, and its table names this surface
   (`:431`) as one Radix serves. Leaving plan 7 to invent a fourth native dialog would make
   plan 9 migrate it as well.
2. **A tooltip is not a primitive here.** It is hand-owned, it is the only mechanism the
   non-React half of the editor can call, and its class is contract with two browser
   locators. Extending it with an optional chord is the smallest change that satisfies §7,
   and §8's own colour-picker paragraph keeps hand-owned mechanisms rather than replacing
   them (`:416-420`).
3. **Option B makes plan 7 a plan about two subjects.** §8 already sequenced the migration
   into its own phase, and the sequencing table's ordering principle is what becomes
   *visible*. A primitive swap is invisible, so it is the phase whose subject is chrome.
