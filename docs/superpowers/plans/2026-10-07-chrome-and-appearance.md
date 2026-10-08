# Chrome and appearance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One primitive library and one palette owner. **All eight primitive sites become React Aria
Components**, and `@base-ui/react`, `@radix-ui/react-dialog` and `@radix-ui/react-popover` all leave
the tree; the shell's palette joins `@theme inline` so it resolves at the element rather than at
`:root`; the operating system becomes its fallback; and the six palettes are proved distinguishable
by screenshot, which is the redesign's last unmet acceptance item.

**Architecture:** Three changes, only one of which is visible. **One** — the chrome's primitives.
The editor runs two libraries at once today, in five Base UI menu surfaces and three Radix wrapper
files, and
[`0037`](../../decisions/0037-react-aria-is-the-editors-one-primitive-library.md) ends that in the
direction the widened survey measured. **The migration is larger than §8 or 0036 proposed** — both
of those moved one library onto the other, and this moves both onto a third — which is the cost the
user accepted when setting the criterion. **Two** — the
appearance pipeline. `editor-shell/palette.ts` is already the one owner of which palette is in
force and already writes one attribute on `document.documentElement`; it gains the OS read and the
precedence rule, and `editor-shell.css` gains a `@theme inline` block that gives each `--shell-*`
token a utility name which resolves *at the element*. **Three** — the evidence. Nothing in §8 or
§9 is left to a computed-value assertion at the end.

**Tech Stack:** TypeScript, React 19, `react-aria-components` (Apache-2.0 — the one new direct
dependency, standing in for three removed ones), Tailwind v4.3.3 (`@theme static`, `@theme inline`),
Vitest + jsdom for the chrome, Playwright against built bundles for everything a cascade or a pixel
decides.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 9 of 9. Read §9 (`:451-457`), then §8 to its end (`:404-449`) because this plan discharges
the migration §8 sequenced here, the Sequencing table row 9 (`:475`), Invariants (`:482-496`),
Non-goals (`:498-504`), Acceptance (`:506-543`) and Ruled during review (`:545-563`). **The one
sentence every task is judged by is §9's: one `data-shell-palette` attribute recolours everything,
including every portalled popup.**

**Decision this plan executes:**
[`0037`](../../decisions/0037-react-aria-is-the-editors-one-primitive-library.md), which supersedes
[`0036`](../../decisions/0036-base-ui-is-the-editors-single-primitive-library.md) and reverses §8's
Radix ruling. Both earlier directions are dead: §8's assumed Radix could carry all five surfaces
and it cannot, and 0036 answered that by naming Base UI on a premise the widened survey falsified —
**pointer anchoring eliminates Radix and nothing else**, and Base UI ships no colour primitive.
`0033`, which named Radix the single library, is superseded by 0037 and is not inherited here.
Separately this plan lands the palette ruling of
[`0035`](../../decisions/0035-the-shells-palette-resolves-at-the-element-and-the-os-is-its-fallback.md),
whose rungs are quoted where a task depends on them.

**Status: queued, not active.** `STATUS.md` names plan 7 (Keyboard) as the active plan. This plan
runs after it, and it assumes plan 7 has landed — see *What is already true*.

---

## Global Constraints

Copied from the spec and `AGENTS.md`; every task's requirements implicitly include this section.

- **Unit-test pure decisions and contracts; browser-test wiring and visible behaviour.** Visible
  behaviour needs rendered inspection, not only object counts or geometry assertions.
- **A new regression test must fail when the fix is disabled before it is trusted.** A break that
  does not break is a finding about the test, not a pass.
- Playwright previews **built** bundles; rebuild affected bundles after source changes and after
  reverting a deliberate break.
- Typecheck by exit code (`npx tsc --noEmit -p packages/editor/tsconfig.json`, or
  `npm run typecheck`). Lint with `./node_modules/.bin/biome lint` — there is no working
  `npm run lint`. Only `npm run format:check` is a formatting gate; `biome check` is not.
- 500 lines is a signal and 800 is a stop for normal source files.
- **One owner per concept.** Read `docs/architecture/ownership.md` before adding a type, key,
  default, style property or helper. The shell palette's owner is
  `editor/src/editor-shell/palette.ts` (`ownership.md:107`).
- **Editor-shell theming stays separate from authored theme globals** (Invariants `:496`). The
  shell's palette is not the document's palette; conflating them is the failure this plan is most
  likely to cause. `--shell-*` is chrome; a theme envelope's palette is authored data.
- **Persist authored state only.** The shell's palette and the appearance choice are browser-local
  editor state, never document state and never inside a theme envelope.
- **Tailwind v4's `@theme` vs `@theme inline` matters.** `@theme` for the built-time scales,
  `@theme inline` for the runtime-switched palette. Getting this backwards is the specific mistake
  §9 names, and decision 0035 records why.
- **Captures are a task, and they are performed by the executor of that task**, not by this plan's
  author. `VIGILIA_CAPTURE=1` and `--workers=1`; register the capture in
  `docs/evidence/screenshots/README.md` in the same commit.
- **No compatibility glue: none of the three libraries coexists with React Aria at the end of
  Phase 1**, and no `data-*` selector is written for both an old and a new attribute. Removing the
  packages is Task 1.4, not a later cleanup — a phase that migrates eight sites and leaves the old
  libraries installed has not finished the job §8 was written for.
- **`0036` is superseded by `0037` outright and is not a source of truth here.** `0033` is
  superseded **only in its naming of Radix as the single primitive library** — 0037 replaces that
  ruling, and **0033's other ruling stands untouched**: the tooltip stays hand-owned, because a React
  primitive cannot be the shared mechanism for code that builds elements with `document.createElement`.
  That argument is why the native `<dialog>`s and the inspector's `<details>` are deliberately not
  migrated, and it is cited below where it applies. A task citing 0036 as authority is reading a
  superseded note — say so rather than following it.

## Review Focus

Five input classes the spec implies but no single task's tests would catch on their own. Each is
pinned by a test in the task named beside it.

1. **A popup opened while the palette in force is not `editorial`.** React Aria portals to `body`,
   leaving `#app` behind, exactly as Base UI did; if the palette attribute or the popup's class
   contract moved, the popup paints the bare `:root` defaults while the chrome beside it is correct
   — the defect `tests/e2e/shell-appearance.spec.ts:138-178` was written for, generalised to every
   migrated surface. **The migration changes the portal *owner*, which is the thing that decides
   this**, so it is re-proved rather than assumed. *(Task 1.4.)*
2. **The popup's accessible name after the migration.** React Aria labels a dialog through a
   `Heading slot="title"` and wires `aria-labelledby` itself, which can shadow a caller's
   `aria-label` — the *attribute* still reads back, so a `getAttribute` assertion passes while the
   name a screen reader announces changes. Pinned by reaching each popup **by role and name**, not
   by attribute. *(Tasks 1.2 and 1.4.)*
3. **A short window over a long menu.** The canvas context menu carries the Add pane's whole list
   and does not fit a 420px window. Base UI's `--available-height` goes with it, and React Aria
   sizes a popover through `maxHeight` plus its own positioning rather than through a variable the
   markup can read. The last entry must still be reachable, **by arrow key as well as by pointer** —
   a fixed height with no scroll strands the entries an author inserting a chart needs. *Already
   pinned, in full, by `tests/e2e/editor-context-menu.spec.ts` — "the last entry is reachable in a
   window too short to hold the menu", including the `End` key and an `Enter` that inserts. Task
   1.1's job is to keep it green, not to write it.*
4. **Escape, and where focus returns.** Both libraries dismiss on Escape and both return focus to
   the trigger; a migration can lose the return without losing the dismissal, and the DOM tests
   already rely on Escape to clean up between cases. *(Task 1.2.)*
5. **The OS changing while the shell is open, after the author has and has not chosen.** The
   precedence rule is invisible when only one condition is tested: a build that lets the OS
   override an explicit choice passes every "dark OS shows a dark palette" assertion. *(Task 2.2.)*

---

## What is already true — do not rebuild

Verified against the source at **`9d8fa507`** (2026-10-07), the commit this plan was written from,
plus the plan 7 file `docs/superpowers/plans/2026-10-07-keyboard.md`. **A task that rebuilds any of
this is wrong.**

- **The scales are already in `@theme static`** (`editor-shell.css:170-208`), with the reasoning —
  including why `static` and not bare `@theme` — in the comment above them and in
  `editor-shell.tokens.test.ts:200-209`. §9's first clause is discharged. **Do not re-declare it.**
- **Six palettes already exist and already have their own surfaces.** `editor-shell/palette.ts:3-10`
  is the list; `editor-shell.css:91-168` is the blocks, and `:113-124` records that `ember`, `moss`
  and `plum` once differed from editorial by an accent alone — the very defect §9's acceptance item
  is written to catch.
- **One attribute already recolours everything, portalled popups included.**
  `applyShellPalette` (`palette.ts:47-49`) writes `data-shell-palette` on
  `document.documentElement` and nothing else, with the portal reasoning in its comment;
  `tests/e2e/shell-appearance.spec.ts` proves it in a browser across the chrome and a portalled
  popup.
- **The swatch is already scoped to the palette it names** (`editor-shell.css:30-32`, plus
  `palette-menu.tsx:17-25` and its comment). This is the subtree decision 0035 turns on — do not
  "simplify" it away.
- **`@radix-ui/react-popover` is already a direct dependency**, and
  `components/ui/popover.tsx` is shadcn's, hand-owned. Radix's closure is therefore already
  installed — **22 `@radix-ui/*` packages for two components**, measured 2026-10-08, each of the two
  declaring 15 direct dependencies. That is one of the numbers 0037 weighed; it is recorded here so
  a later reader does not re-derive it. `react-aria-components` is the only addition this phase
  makes, and three packages leave in Task 1.4.
- **The editor's tooltip stays ours** (`editor-shell/controls/tooltip.ts`), and **the inspector's
  sections stay a native `<details>`** (`editor-shell/controls/property-section.ts`, used at
  `selection-inspector/per-kind-column.ts:663`). Both are DOM factories with no React in them, and
  0033's argument for the tooltip applies unchanged: a React primitive cannot be the shared
  mechanism for code that builds elements with `document.createElement`. §8's table rows for
  `collapsible` are discharged by an existing owner, not by a migration.
- **The three hand-rolled native `<dialog>`s stay native.** `new-document-chooser.ts:55`,
  `persistence-manager/index.ts:71` and `theme-library-dialog.ts` (three dialogs: `:63`, `:134`,
  `:345`) are DOM factories, styled by `.vigilia-dialog` (`editor-shell.css:761-788`). They are not
  a third primitive library — they are the platform — and 0033 rejected a *fourth* one for plan 7,
  not this three. **What this plan owes them is evidence, not a migration**: Task 3.1.
- **Plan 7 has landed by the time this plan runs**, and it changed three things this plan reads:
  `ShellMenuBar`'s `item()` helper (`shell-layout.tsx:268-272`) gains a fourth argument and renders
  a `<kbd className="editor-shell-menu-key">`; `components/ui/dialog.tsx` and its DOM test exist;
  and `@radix-ui/react-dialog` is installed with its licence recorded — including the
  `@radix-ui/react-popover` row that was missing from `THIRD-PARTY-NOTICES.md`. **If plan 7 has not
  landed, stop and report; do not author its work here.**
- **`vg-135` is open, and this plan may close it rather than run through it.** `git log` and
  `STATUS.md` both carry it: in `shell-layout.dom.test.tsx`, one click on a **Base UI menu trigger**
  stalls **50–90 s synchronously** under jsdom, and three of that file's tests time out at 91/96/118 s
  against a 20 s limit. **The suspect is the library being removed**, so Task 1.2 times that file
  before and after and records both numbers. If it goes green, `vg-135` closes here with the
  measurement; if it does not, the cause was never Base UI and the row stays open with the new
  evidence. Either way: **a hang there is not a regression to chase during the migration.** `vg-175`
  is the same class one level out — a test that passes alone and times out in the full run.

---

## File structure

**Created**

- `docs/decisions/0035-the-shells-palette-resolves-at-the-element-and-the-os-is-its-fallback.md` —
  already written by this plan's author; Task 2.1 lands the code it decides, and does not rewrite it.
- `docs/evidence/screenshots/shell-palette-<name>-desktop-chromium.png` ×6 (Task 2.3).

**Modified — chrome**

- `packages/editor/src/editor-shell/palette-menu.tsx`, `display-switch.tsx`, `insert-popover.tsx`,
  `canvas-context-menu.tsx`, `shell-layout.tsx` — the five Base UI imports (Tasks 1.1 and 1.2).
- `packages/editor/src/components/ui/dialog.tsx`, `popover.tsx`, `colour-picker.tsx` — the three
  Radix wrapper files (Task 1.3). **These were not in scope under §8 or 0036**; they are here because
  0037 moves both libraries onto a third rather than one onto the other.
- `packages/editor/src/editor-shell/editor-shell.css` — the state hooks, the positioner, the
  `@theme inline` block, the first frame.
- `packages/editor/package.json` — one added (`react-aria-components`), three removed
  (`@base-ui/react`, `@radix-ui/react-dialog`, `@radix-ui/react-popover`).
- `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md` — the licence inventory.

**Modified — appearance**

- `packages/editor/src/editor-shell/palette.ts` — the appearance source of truth. It stays under
  500 lines; no new file is warranted for a resolver whose owner already exists.
- `packages/editor/index.html` — the pre-shell frame.
- `packages/editor/src/editor-shell/palette-menu.tsx` — the picker writes the choice.

**Modified — tests**

- `packages/editor/src/editor-shell/palette-menu.dom.test.tsx`, `display-switch.dom.test.tsx`,
  `canvas-context-menu.dom.test.tsx`, `shell-layout.dom.test.tsx`,
  `editor-shell.tokens.test.ts`, `palette.test.ts` (or the file that replaces it — see Task 2.2).
- `tests/e2e/shell-appearance.spec.ts`, `insert-popover.spec.ts`, `composition-panel.spec.ts`,
  `editor.spec.ts` (one comment at `:772` and the `[data-open]` readers where they occur),
  `editor-display.spec.ts`, `editor-context-menu.spec.ts`.
- `docs/evidence/screenshots/README.md` — one new domain row.

---

## Phase 1 — One primitive library

**Eight sites move to React Aria Components**: the five `@base-ui/react` menu surfaces and the three
Radix wrapper files. At the end, `@base-ui/react`, `@radix-ui/react-dialog` and
`@radix-ui/react-popover` are absent from the manifest and imported by no source file.

**Direction, stated once because it has reversed twice.** §8 moved the five Base UI surfaces onto
Radix. Decision 0036 moved the three Radix files onto Base UI. **This moves all eight onto React
Aria.** Wherever a task below says "the migration" without qualification, it means that, and a task
that reads as though one library is being absorbed into the other is stale — say so rather than
following it.

**Almost no visible change is intended**, and where there is one it is named: Task 1.3's colour
picker is rebuilt on the library's own colour components, so its tracks will look and behave
differently. Everything else is proved by the tests that already assert these surfaces' behaviour —
**not** by a new test written beside the change, which can only prove the change is self-consistent.

---

### Task 1.1: The canvas context menu — the go/no-go

**Files:**
- Modify: `packages/editor/package.json` (add `react-aria-components`; install from `src/web/`)
- Modify: `packages/editor/src/editor-shell/canvas-context-menu.tsx`
- Modify: `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md`

**Outcome.** The canvas context menu opens **at the pointer**, through
`MenuTrigger trigger="contextMenu"`, and the browser spec that already asserts its behaviour passes
with the source migrated.

**Owning symbols.** `canvas-context-menu.tsx`: the `ContextMenu.Root/Portal/Positioner/Popup` tree,
the `anchor` memo at `:146-157`, and the `contextmenu` listener at `:140`. The memo is what goes —
`trigger="contextMenu"` computes the point itself.

**Constraints.**
- **This surface stopped Phase 1 once already, at Task 1.1's own Step 4.** It runs first, alone, and
  its result is the go/no-go for everything after it.
- React Aria portals to `document.body`, and the editor's canvas sits inside stacking and transform
  contexts. **Position and hit-testing are what this task is testing** — not the item list, which is
  the part already covered by jsdom.
- Record the version and the licence string from the installed `package.json`, not from memory.

**Acceptance.** The existing context-menu assertions pass, against a **rebuilt bundle** — Playwright
previews built bundles, so a run against a stale one proves nothing.

**Failure mode — stop, do not start Task 1.2.** If `trigger="contextMenu"` cannot position correctly
inside this host, record what was measured and stop. 0037 was chosen over Base UI on **capability
coverage**; a library that cannot carry this surface is in the position Radix was in, and the whole
migration would be buying nothing. Before declaring failure, try the second mechanism the survey
measured: `getTargetRect` on `Popover`, documented as *"positioning relative to a specific point such
as the mouse cursor (e.g. context menus)"*. Both are in 0037's rung 6.

**Verification.** The context-menu browser spec at `--workers=1`. Put the command and its result in
the commit body.

---

### Task 1.2: The four trigger-anchored menus move

**Files:**
- Modify: `packages/editor/src/editor-shell/palette-menu.tsx`
- Modify: `packages/editor/src/editor-shell/display-switch.tsx`
- Modify: `packages/editor/src/editor-shell/insert-popover.tsx`
- Modify: `packages/editor/src/editor-shell/shell-layout.tsx` (the View menu)

**Outcome.** The palette picker, the display lens, the Insert `+` chooser and the header's View menu
all open, navigate, and commit through React Aria's `Menu`.

**Replacement set — closed.** The Base UI API the editor imports is exactly: `Root`, `Trigger`,
`Portal`, `Positioner`, `Popup`, `Item`, `Group`, `GroupLabel`, `RadioGroup`, `RadioItem`,
`RadioItemIndicator`, `SubmenuRoot`, `SubmenuTrigger`. Everything the migration needs is in that
list; a surface reaching for a Base UI symbol outside it is a discovery worth recording.

**Constraints.**
- The Insert `+` chooser is the **second anchored surface**, but it anchors to a *trigger* — the `+`
  in the pane bar — so it belongs here, not in 1.1.
- `shell-layout.tsx` is 685 lines and on the reuse gate's watchlist; 0037 claims that path.
- **`vg-135` is a hypothesis this task can settle.** `shell-layout.dom.test.tsx` is slow for a filed
  reason: one Base UI menu-trigger click blocks 50–90 s under jsdom, which is why the View-menu test
  takes ~190 s alone. **If that stall disappears once Base UI is gone, `vg-135` is closed by this
  task** and the measurement belongs in the commit body. If it persists, it was never Base UI's, and
  that is equally worth recording.
- **`vg-169` may also close here.** Escape with the `+` chooser open leaves it open through a
  subsequent right-click. If the migration fixes it, close the row; if not, leave it open.

**Verification.** Each surface's existing jsdom test plus its browser spec, and a before/after timing
for `shell-layout.dom.test.tsx` recorded in the commit body.

---

### Task 1.3: The three wrapper files move, and the colour picker stops being hand-rolled

**Files:**
- Modify: `packages/editor/src/components/ui/dialog.tsx`
- Modify: `packages/editor/src/components/ui/popover.tsx`
- Modify: `packages/editor/src/components/ui/colour-picker.tsx`

**Outcome.** `shortcut-reference.tsx`'s dialog and `palette-manager/panel.ts`'s picker run on React
Aria, and the picker's tracks are the library's colour components rather than hand-built `div`s.

**Owning symbols.** `dialog.tsx`'s `Dialog` (React Aria:
`DialogTrigger`/`ModalOverlay`/`Modal`/`Dialog`); `popover.tsx`'s `Popover`/`PopoverTrigger`/
`PopoverContent` (React Aria's `Popover` with `placement`, `offset`, `crossOffset`); and
`colour-picker.tsx`'s module-private `Track`, replaced by `ColorArea` (saturation × brightness,
`colorSpace="hsb"`), `ColorSlider channel="hue"`, `ColorSlider channel="alpha"` and `ColorField` for
the hex input.

**Constraints.**
- **`vg-194` is the reason this is not cosmetic.** `Track` renders `role="slider"`, `tabIndex={0}`
  and `aria-valuenow` and binds only pointer handlers — the file contains no `onKeyDown` — so each
  track takes a tab stop, announces "slider, 42 percent" to assistive technology, and does nothing
  for any key. **Adopting the library's colour components is what closes it.** Writing an
  `onKeyDown` by hand would paper over it and leave the ARIA wrong, so do not add one.
- The picker's values are 8-digit hex carrying alpha, which is why `<input type="color">` was
  rejected at `:84-88`; the theme envelope round-trip must survive the rebuild unchanged.
- The trigger uses `asChild` today (`:133`). React Aria has no `asChild` — use its `render` prop and
  leave no wrapper element behind that changes layout.
- `gradient-editor.tsx` imports `ColourPicker` and nothing else from this file, so it is untouched
  **provided the exported `ColourPicker` props do not change**. If they must, it moves with them.
- The picker **will** look different. That is the one intended visible change in this phase; capture
  it as evidence rather than treating the diff as a regression.

**Verification.** The palette panel's browser spec, **plus one new regression test that an arrow key
changes a track's value** — the test for `vg-194`, which must be shown to fail with the library's
keyboard handling removed before it is trusted.

---

### Task 1.4: The three libraries leave the manifest, and the chrome behaves the same in a browser

**Files:**
- Modify: `packages/editor/package.json` (remove `@base-ui/react`, `@radix-ui/react-dialog`,
  `@radix-ui/react-popover`)
- Modify: `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md`
- Modify: any test still stubbing a removed library's internals

**Outcome.** No source file imports any of the three, and the chrome's behaviour in a browser is
unchanged apart from Task 1.3's picker.

**Constraints.**
- `grep -rn "@base-ui\|@radix-ui" packages/*/src` returns nothing outside `dist/`.
- Removing the packages surfaces tests that stub a *library's internals* rather than the behaviour
  under test — the `:modal` / `:popover-open` `matches` patch at `palette-menu.dom.test.tsx:25-34` is
  one, and it exists for floating-ui. **A stub whose reason has gone goes with it; one that still
  encodes a real behaviour stays**, and the difference is decided by deleting it and watching what
  breaks.
- Licence rows are removed **with** the dependencies, in the same commit. No compatibility shim and
  no re-export wrapper: pre-release internal architecture may break cleanly.

**Verification.** Every migrated surface's focused suite, then the broad gate at the phase boundary.
Rebuild before any Playwright run, and again after reverting a deliberate break.

---

**Phase 1 exit.** `@base-ui/react`, `@radix-ui/react-dialog` and `@radix-ui/react-popover` are gone
from the manifest and unimported; every migrated surface's existing tests pass unchanged; `vg-194` is
closed by the colour components; `vg-135` and `vg-169` are either closed with a measurement or
recorded as not-Base-UI's; and the browser runs are recorded in the commit bodies.


## Phase 2 — The appearance pipeline

The palette gains a name a utility can use, and an operating system to fall back to. Decision
**0035** is already written; Task 2.1 lands the code it decides and does not re-open it.

---

### Task 2.1: The palette joins `@theme inline`

**Files:**
- Modify: `packages/editor/src/editor-shell/editor-shell.css`
- Test: `packages/editor/src/editor-shell/editor-shell.tokens.test.ts`
- Test: `tests/e2e/shell-appearance.spec.ts`

**Interfaces:**
- Produces: `--color-shell-*`, one per `--shell-*` **colour** token, so any shell element may be
  written with a Tailwind colour utility. **Eleven, not thirteen** — see the correction in Step 1.
- Consumes: the existing `:root` and `[data-shell-palette="…"]` blocks, **unchanged**.

**Constraints.** The `--shell-*` declarations do not move. `@theme inline` is added **beside** them,
because `inline` is what makes a compiled utility read `var(--shell-surface)` — which resolves at
the element it is written on — instead of `var(--color-shell-surface)`, which would resolve at
`:root` and lose a subtree that re-declares the token. That subtree exists and is contractual: the
picker's swatch (`editor-shell.css:30-32`, `palette-menu.tsx:17-25`,
`shell-appearance.spec.ts:180-237`). Rungs 4.1 and 4.2 of decision 0035 carry the two Tailwind
discussions this rests on.

- [ ] **Step 1: Write the failing test — the block exists and is `inline`**

Append to `editor-shell.tokens.test.ts`. It is the jsdom-side half; the cascade half is Step 4.

```ts
/** A utility compiled from the palette must resolve at the ELEMENT.
 *
 *  `@theme` compiles `.bg-shell-surface` to `var(--color-shell-surface)`, which
 *  the browser looks up from `:root` — losing the one subtree that re-declares
 *  the token, the swatch that names a palette it is not rendering under, which
 *  `shell-appearance.spec.ts` already holds as a contract. `inline` compiles it
 *  to `var(--shell-surface)` and the lookup happens where the utility is
 *  written. jsdom resolves no custom properties, so this half can only check
 *  that the block is the right KIND; the resolution is measured in a browser. */
it("gives every shell colour token a name in @theme inline", () => {
  const inline = /^[ \t]*@theme[ \t]+inline[ \t]*\{([^}]*)\}/m.exec(css)?.[1] ?? "";
  expect(inline, "the palette is not in an @theme inline block").not.toBe("");

  // **Two tokens are not colours, and a `--color-*` name for either would
  // compile a broken utility** — Tailwind's namespaces are per type, so a
  // font stack belongs in `--font-*` and a bare number belongs in none.
  // Measured: the file declares thirteen `--shell-*` tokens and eleven of
  // them are colours, which the count below pins so this exclusion cannot
  // quietly grow to swallow one.
  const NOT_A_COLOUR = new Set(["--shell-display", "--shell-flat"]);
  const declared = [...css.matchAll(/^\s*(--shell-[a-z-]+)\s*:/gm)].map(
    (match) => match[1] ?? "",
  );
  const colours = [...new Set(declared)].filter((token) => !NOT_A_COLOUR.has(token));
  expect(colours, "the exclusion set is hiding a colour").toHaveLength(11);

  for (const token of colours) {
    expect(
      inline,
      `${token} has no utility name, so nothing can read it as a Tailwind colour`,
    ).toContain(`${token.replace("--shell-", "--color-shell-")}: var(${token})`);
  }
});
```

> **Corrected 2026-10-08, at execution.** This step first asserted a name for *every* `--shell-*`
> token, which the file cannot satisfy: it declares **thirteen** and Step 3's block deliberately
> names **eleven**, because `--shell-display` is a font stack (`ui-serif, Georgia, …`, used as
> `font-family` at `editor-shell.css:285,623,838,980`) and `--shell-flat` is a bare `1`/`0`
> toggle. A `--color-*` name for either compiles a utility that sets a colour to a font stack,
> which is invalid at computed-value time. The count of eleven is asserted so the exclusion cannot
> quietly grow to swallow a real colour. Step 3's block is unchanged and was correct.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd src/web
npx vitest run packages/editor/src/editor-shell/editor-shell.tokens.test.ts -t "@theme inline"
```

Expected: **FAIL** — `the palette is not in an @theme inline block`. There is exactly one `@theme`
block in the file (`@theme static`, `:195`) and the reader at `:45` assumes so.

- [ ] **Step 3: Write the block**

Add to `editor-shell.css`, immediately after the `@theme static` block. Keep a comment that says
what `inline` buys and what would be lost without it — the failure is silent, which is why it is
written down rather than inferred.

```css
/* A name per shell colour, so a utility carries the palette in force.
   `inline` and not `@theme`: with `@theme` the utility compiles to
   `var(--color-shell-surface)` and the browser resolves that at `:root`, which
   loses every subtree that declares `--shell-*` for itself. One does:
   `.editor-shell-palette-swatch` above, a chip naming a palette it is not
   rendering under, which `tests/e2e/shell-appearance.spec.ts` holds.
   Decision: docs/decisions/0035. */
@theme inline {
  --color-shell-backdrop: var(--shell-backdrop);
  --color-shell-surface: var(--shell-surface);
  --color-shell-surface-strong: var(--shell-surface-strong);
  --color-shell-edge: var(--shell-edge);
  --color-shell-text: var(--shell-text);
  --color-shell-muted: var(--shell-muted);
  --color-shell-accent: var(--shell-accent);
  --color-shell-warm: var(--shell-warm);
  --color-shell-danger: var(--shell-danger);
  --color-shell-primary-bg: var(--shell-primary-bg);
  --color-shell-primary-text: var(--shell-primary-text);
}
```

**And one line below it, which this step owed and did not have.** Step 4's probe is injected at
runtime, so the class it carries is in no scanned source file — and Tailwind emits a rule only for a
class it *finds* in one. Measured at execution: without this line `.bg-shell-surface` still appeared
in the bundle, but **only because a comment in `editor-shell.tokens.test.ts` happens to contain the
string**, so rewording that comment would drop the utility and redden a browser test with a message
blaming the cascade. `@source inline` is Tailwind's own directive for generating a class no source
writes; verified against the installed `tailwindcss@4.3.3` by removing the comment mention,
rebuilding, and finding the rule still emitted.

```css
@source inline("bg-shell-surface");
```

- [ ] **Step 4: Measure the resolution in a browser, and break it on purpose**

Append to `shell-appearance.spec.ts`, beside the existing chip test:

```ts
/** A utility resolves the palette of the SUBTREE it is written in.
 *
 *  Injected rather than written into a component: the shell has no
 *  `bg-shell-surface` yet, and this is the property that decides whether the
 *  first one is safe to write. The probe goes inside the ember chip while
 *  graphite is in force, which is the exact case a non-inline `@theme` loses. */
test("a shell colour utility resolves the palette of its own subtree", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openEditor(page);
  await choosePalette(page, "graphite");
  await page.locator("[data-vigilia-palette]").click();
  const popup = page.locator(PALETTE_POPUP);
  await expect(popup).toBeVisible();

  const [inside, chip, live] = await popup.evaluate((node) => {
    const ember = node.querySelector<HTMLElement>('[data-shell-palette="ember"]');
    const probe = document.createElement("span");
    probe.className = "bg-shell-surface";
    ember?.appendChild(probe);
    return [
      probe === null ? "" : getComputedStyle(probe).backgroundColor,
      ember === null ? "" : getComputedStyle(ember).backgroundColor,
      getComputedStyle(document.querySelector(".editor-shell-header")!).backgroundColor,
    ];
  });

  expect(inside, "the utility did not resolve the chip's own palette").toBe(chip);
  expect(inside, "and it must not be the live palette").not.toBe(live);
});
```

**Then disable the fix and watch it fail**: change `@theme inline` to `@theme`, rebuild the editor
bundle, re-run the test, and confirm it **fails** — `inside` becomes graphite's surface, the live
palette. Revert, rebuild, re-run, confirm it passes. **A test that does not fail when the fix is
disabled is a finding about the test**, and this one is the whole of §9's runtime requirement.

- [ ] **Step 5: Run both halves**

```bash
cd src/web
npx vitest run packages/editor/src/editor-shell/editor-shell.tokens.test.ts
npm run build -w @vigilia/editor
npx playwright test tests/e2e/shell-appearance.spec.ts --project=desktop-chromium --workers=1
```

Expected: PASS. The tokens test's existing readers must be re-checked too — `themeBody()`
(`:44-46`) matches `@theme static` by literal, so it still finds the right block, but
**verify that rather than assume it**: if it now matches the wrong one, every scale assertion is
reading the palette.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/editor-shell/editor-shell.tokens.test.ts \
  src/web/tests/e2e/shell-appearance.spec.ts
git commit -m "feat(editor): the shell palette joins @theme inline

A utility now resolves the palette of its own subtree. Proved in a browser with
the ember chip under graphite; proved to FAIL with @theme instead of
@theme inline. Decision: docs/decisions/0035.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2.2: The operating system is the appearance's fallback

**Files:**
- Modify: `packages/editor/src/editor-shell/palette.ts`
- Modify: `packages/editor/src/editor-shell/palette-menu.tsx`,
  `shell-layout.tsx`
- Modify: `packages/editor/index.html`
- Test: `packages/editor/src/editor-shell/palette.test.ts`,
  `palette-menu.dom.test.tsx`
- Test: `tests/e2e/shell-appearance.spec.ts`

**Interfaces:**
- Produces: on `editor-shell/palette.ts` —
  `systemShellPalette(prefersDark: boolean): ShellPalette`,
  `resolveShellPalette(choice: ShellPalette | undefined, prefersDark: boolean): ShellPalette`,
  `readShellChoice(storage: Storage): ShellPalette | undefined`,
  `writeShellChoice(storage: Storage, palette: ShellPalette): void`,
  `prefersDarkAppearance(): boolean`,
  `watchSystemAppearance(onChange: (prefersDark: boolean) => void): () => void`.
  `applyShellPalette(palette)` and `DEFAULT_SHELL_PALETTE` keep their signatures and their meaning.
- Consumes: `shellPalettes`, the storage key, and the attribute write that already exist.

**Constraints.** **The stored choice wins; the OS is read only when nothing is stored; a `change`
event re-resolves only while nothing is stored.** Decision 0035 rejected a "System" entry in the
picker and rejected resolving the mapping in a `head` script, so: the picker keeps six palettes, and
the mapping lives here. `readShellPalette` / `writeShellPalette` are **replaced, not kept** — no
compatibility glue, and their four call sites are updated in this task.

- [ ] **Step 1: Write the failing tests**

In `palette.test.ts`, the pure half. **These are the ones that catch Review Focus item 5** — a
resolver that lets the OS win passes a single-condition check and fails here:

```ts
it("follows the OS while the author has not chosen", () => {
  expect(resolveShellPalette(undefined, true)).toBe("graphite");
  expect(resolveShellPalette(undefined, false)).toBe("editorial");
});

it("lets the author's choice outlast the OS", () => {
  for (const choice of shellPalettes) {
    expect(resolveShellPalette(choice, true)).toBe(choice);
    expect(resolveShellPalette(choice, false)).toBe(choice);
  }
});

it("has no choice stored until the picker is used", () => {
  expect(readShellChoice(localStorage)).toBeUndefined();
  writeShellChoice(localStorage, "moss");
  expect(readShellChoice(localStorage)).toBe("moss");
});

it("ignores a stored value that is not a palette", () => {
  localStorage.setItem("vigilia.editor.shell-palette", "invalid");
  expect(readShellChoice(localStorage)).toBeUndefined();
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd src/web
npx vitest run packages/editor/src/editor-shell/palette.test.ts
```

Expected: **FAIL** — `resolveShellPalette is not a function` (and the three below it), because
`palette.ts` exports `readShellPalette`/`writeShellPalette` and no resolver.

- [ ] **Step 3: Write the resolver**

```ts
/** The palette an OS reporting `prefersDark` gets when the author has not chosen.
 *
 *  `graphite` is the shell's one dark palette and `editorial` its default, so
 *  these are the same two names `DEFAULT_SHELL_PALETTE` and the picker already
 *  use — no new vocabulary, and no seventh entry in the picker. */
export function systemShellPalette(prefersDark: boolean): ShellPalette {
  return prefersDark ? "graphite" : DEFAULT_SHELL_PALETTE;
}

/** The palette in force: the author's choice, or what the OS asks for.
 *
 *  One rule, and it is the whole of §9's "the palette picker as an explicit
 *  override": a choice is never overridden by the OS. */
export function resolveShellPalette(
  choice: ShellPalette | undefined,
  prefersDark: boolean,
): ShellPalette {
  return choice ?? systemShellPalette(prefersDark);
}

/** What the author chose, or `undefined` while the shell is following the OS. */
export function readShellChoice(storage: Storage): ShellPalette | undefined {
  const stored = storage.getItem(storageKey);
  return isShellPalette(stored) ? stored : undefined;
}

/** The OS preference, as a boolean. `matchMedia` is absent in jsdom and in any
 *  non-browser host, and an absent API is not a preference for dark. */
export function prefersDarkAppearance(): boolean {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

/** Calls back when the OS appearance changes, until the returned function is
 *  called. `change` rather than the deprecated `addListener`. */
export function watchSystemAppearance(
  onChange: (prefersDark: boolean) => void,
): () => void {
  const query = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  if (query === undefined) return () => {};
  const listener = (event: MediaQueryListEvent): void => onChange(event.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
```

- [ ] **Step 4: Wire the two call sites**

`shell-layout.tsx:363-366` becomes: read the choice, resolve it against `prefersDarkAppearance()`,
apply it. Then, inside `Shell()`, subscribe while `choice === undefined` and re-apply on change —
**the listener is attached only while nothing is stored**, which is the ecosystem shape Rung 4.3
records. `PaletteMenu.choose` (`:46-50`) writes through `writeShellChoice` and calls `onChange`; the
shell's state holds the choice, so a later OS change no longer moves it.

> **Corrected 2026-10-08, at execution.** "Attached only while nothing is stored" is the invariant,
> but detaching the listener on choose is not how it lands: an effect that depended on the choice
> would either re-subscribe on every palette or close over a stale one. The subscription is
> attached once and the **same predicate** is re-read inside the handler —
> `readShellChoice(storage) !== undefined` bails — which is one condition rather than two states,
> and storage is where "has the author chosen" actually lives, because the picker writes there
> before it calls back. Measured: with the subscription removed entirely, the live-change step of
> Step 6's test fails (`Expected "editorial", Received "graphite"`).

- [ ] **Step 5: Handle the first frame**

`packages/editor/index.html`'s pre-paint block currently paints two literals (`:19-20`) and does not
consult anything. Add exactly one media query, so a dark-OS author's first frame is not cream:

```html
      @media (prefers-color-scheme: dark) {
        html, body, #app { background: #0b1419; color: #eef9f4; }
      }
```

**Ceiling, stated rather than hidden:** a *stored* palette still flashes editorial, because the
pre-paint block reads no storage and decision 0035 rejected duplicating the mapping into a script.
Add the one-line `localStorage` read only if an author reports the flash; the key is
`vigilia.editor.shell-palette` and `palette.ts` owns it.

- [ ] **Step 6: Prove the precedence in a browser**

Append to `shell-appearance.spec.ts`. **This is Review Focus item 5's test**, and Playwright's
`emulateMedia` is the only way to make the OS change under the test's feet:

```ts
test("the OS is the fallback and the author's choice outlasts it", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.emulateMedia({ colorScheme: "dark" });
  await openEditor(page);
  await expect(page.locator("html")).toHaveAttribute("data-shell-palette", "graphite");

  // The OS changes and nothing is stored, so the shell follows it.
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-shell-palette", "editorial");

  // The author chooses, and the OS no longer has a vote.
  await choosePalette(page, "plum");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-shell-palette", "plum");
});
```

Each test gets its own storage, so this arrives with nothing stored; `choosePalette` already
asserts the attribute rather than trusting the click (`:66-79`).

- [ ] **Step 7: Run everything**

```bash
cd src/web
npx vitest run packages/editor/src/editor-shell/palette.test.ts \
  packages/editor/src/editor-shell/palette-menu.dom.test.tsx
npm run build -w @vigilia/editor
npx playwright test tests/e2e/shell-appearance.spec.ts --project=desktop-chromium --workers=1
```

Expected: PASS. `palette-menu.dom.test.tsx:6` imports `readShellPalette` and must move to
`readShellChoice`; if that file still passes without the change, it is asserting less than it says.

- [ ] **Step 8: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/palette.ts \
  src/web/packages/editor/src/editor-shell/palette-menu.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/index.html \
  src/web/packages/editor/src/editor-shell/palette.test.ts \
  src/web/packages/editor/src/editor-shell/palette-menu.dom.test.tsx \
  src/web/tests/e2e/shell-appearance.spec.ts
git commit -m "feat(editor): the shell follows the OS appearance until the author chooses

Dark -> graphite, light -> editorial; a stored choice is never overridden, and
the media listener is attached only while nothing is stored. The pre-paint frame
follows the OS too; a stored palette still flashes editorial, and 0035 says why
that costs less than a second owner of the mapping.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2.3: Six palettes, six screenshots

**Files:**
- Modify: `tests/e2e/shell-appearance.spec.ts`
- Modify: `docs/evidence/screenshots/README.md`
- Create: `docs/evidence/screenshots/shell-palette-<name>-desktop-chromium.png` ×6

**Interfaces:**
- Consumes: `captureVisualReview(page, testInfo, name)` from `tests/e2e/editor-canvas.ts:297-315`,
  which writes `<name>-<project>.png` into `docs/evidence/screenshots` and returns early unless
  `VIGILIA_CAPTURE=1`.
- Produces: the artefacts §9's acceptance item at `:541-543` names.

**Constraints.** The acceptance item is explicit that a computed value is not enough: *"a
computed-value assertion passes on three palettes that are byte-identical to editorial."* The
computed comparison already exists (`:225-234`) and stays; this task adds the eye. Six captures, one
per palette, of the same mounted editor in the same state — an author reads the six and can tell
them apart by surface. **Captures are evidence, not cross-platform golden files**, and they are
registered in the README's table in the same commit.

- [ ] **Step 1: Write the capture test**

Append to `shell-appearance.spec.ts`:

```ts
/** The six palettes, as six pictures.
 *
 *  The computed comparison above is necessary and not sufficient: it can tell
 *  two surfaces apart but cannot say whether either is a surface an author
 *  would recognise. §9's acceptance item asks for the eye, so this is the eye.
 *  Deliberately NOT a golden file — a screenshot here is read by a person once,
 *  beside the change that made it. */
test("captures each palette's own surface", async ({ page }, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(120_000);

  await openEditor(page);
  for (const palette of PALETTES) {
    await choosePalette(page, palette);
    await captureVisualReview(page, testInfo, `shell-palette-${palette}`);
  }
});
```

- [ ] **Step 2: Run it with capture on**

```bash
cd src/web
npm run build -w @vigilia/editor
VIGILIA_CAPTURE=1 npx playwright test tests/e2e/shell-appearance.spec.ts \
  --project=desktop-chromium --grep "captures each palette" --workers=1
```

Expected: six files in `docs/evidence/screenshots/`, each printed as attached. **Inspect every one
before staging it** — this is the whole acceptance item, and a capture of a palette that did not
apply is worse than no capture. `VIGILIA_CAPTURE_DIR` redirects the output if a scratch copy is
wanted first.

- [ ] **Step 3: Register the captures**

Add a row to `docs/evidence/screenshots/README.md`'s editor table, in that table's shape:

```
| Shell appearance | Choose each of the six palettes and read the surface | `shell-palette-` / `captures each palette's own surface` |
```

- [ ] **Step 4: Commit**

```bash
git add src/web/tests/e2e/shell-appearance.spec.ts docs/evidence/screenshots/README.md \
  docs/evidence/screenshots/shell-palette-*.png
git commit -m "test(editor): six palettes, six screenshots

Spec acceptance :541-543 — distinguishable by surface rather than by computed
value. Registered as shell-palette-* in the evidence table.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 3 — Everything the palette paints

The appearance change reaches surfaces no task above has looked at, and the redesign's own
discharge clause is owed by its last plan.

---

### Task 3.1: The native dialogs and the inspector's own disclosures

**Files:**
- Test: `tests/e2e/shell-appearance.spec.ts` (or a new `tests/e2e/shell-surfaces.spec.ts` if the
  file passes the 500-line signal)
- Test: `packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx` — no change expected

**Interfaces:**
- Consumes: the six palettes and the attribute applied by Task 2.2.
- Produces: **evidence, not a migration.** No production file is expected to change; if one does, the
  reason belongs in the commit and the reader should be suspicious of it.

**Constraints.** Two families of surface are hand-owned and are **not** migrated — 0033's argument
for the tooltip applies to both, and the reasoning is recorded in this plan's *What is already true*:

- the three native `<dialog>`s (`new-document-chooser.ts:55`, `persistence-manager/index.ts:71`,
  `theme-library-dialog.ts:63|134|345`), styled by `.vigilia-dialog` (`editor-shell.css:761-788`);
- the inspector's sections (`editor-shell/controls/property-section.ts`) — a native `<details>`, not
  a library Collapsible, and §8's table row for `collapsible` is discharged by that owner. **Phase 1
  does not change this**: React Aria ships a `Disclosure` that could replace it, and 0037 leaves the
  native element in place because the argument above still holds.

**They are also the surfaces a palette change is most likely to break**, because each paints from
the shell's tokens through a class rather than through the attribute, and none of them is a
descendant of `#app` in the case of a `<dialog>`'s top layer.

- [ ] **Step 1: Write the test**

```ts
/** The hand-owned surfaces the palette has to reach anyway.
 *
 *  None of these is a React primitive and none is migrated: the dialogs are DOM
 *  factories and the sections are a native <details>. They are here because a
 *  palette that reaches the chrome and not the chooser opened from it is the
 *  same defect as a popup that paints :root — and a dialog in the top layer is
 *  not a descendant of #app, so it is the layer most likely to miss. */
test("the dialogs and the inspector's sections paint every palette", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(120_000);

  await openEditor(page);
  for (const palette of PALETTES) {
    await choosePalette(page, palette);

    // The New-document chooser: opened from the File menu, closed with Escape.
    await page.getByRole("button", { name: "File" }).click();
    await page.getByRole("menuitem", { name: "New theme" }).click();
    const dialog = page.locator(".vigilia-dialog");
    await expect(dialog).toBeVisible();
    const [dialogBackground, headerBackground] = await Promise.all([
      dialog.evaluate((node) => getComputedStyle(node).backgroundColor),
      page.locator(".editor-shell-header").evaluate((node) => getComputedStyle(node).backgroundColor),
    ]);
    expect(dialogBackground, `the ${palette} chooser paints another surface`).toBe(
      headerBackground,
    );
    await page.keyboard.press("Escape");

    // The inspector's own section, on whatever is selected when the pane opens.
    await openPane(page, "Selection");
    await expect(page.locator(".vigilia-section-details").first()).toBeVisible();
  }
});
```

> **Corrected 2026-10-08, at execution — three defects, and the file moved.** The test landed in
> **`tests/e2e/shell-surfaces.spec.ts`**, not in `shell-appearance.spec.ts`: that file was already
> 494 lines and this step's test passes the 500-line signal the repo uses for a source file, which
> is the second half of the Files line above. The four things both specs need — `PALETTES`, the popup
> selector, `openShell` and `choosePalette` — moved to a new **`tests/e2e/shell-palette.ts`** rather
> than being copied, so the six-entry list does not become a third copy of `palette.ts`'s.
>
> - **`openPane(page, "Selection")` cannot work: `Selection` is not a pane.** The pane bar's segments
>   are Layers, Insert, Assets, Document and the `+`; the right column is not one of them and is
>   always mounted. Locate `.vigilia-section-details` directly.
> - **`selectLayer(page, "cpu-card")` cannot work either: the starter's cards are nested.** The
>   top-level rows are `group-cpu-card`, `group-storage-card`, `group-trends-card` and so on, and a
>   collapsed row is not clickable. The step above never selected anything, and the selection is what
>   the column renders sections for — with nothing selected it correctly says where to choose from,
>   which is `vg-157`'s assertion rather than this one.
> - The dialog selector landed as `dialog[open]` matched on `"Choose an artboard size"`, which is
>   `new-document-chooser`'s own lead copy, rather than a bare `.vigilia-dialog`: three dialog
>   owners share that class, and only one of them was on screen.
>
> **Measured after the correction:** passes first run in 14.1 s; with `.vigilia-dialog`'s background
> moved to `--shell-backdrop` it fails on the first palette (dialog `rgb(245,241,232)` against header
> `rgb(255,253,247)`); reverted and rebuilt, green.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd src/web
npm run build -w @vigilia/editor
npx playwright test tests/e2e/shell-appearance.spec.ts --project=desktop-chromium \
  --grep "hand-owned surfaces" --workers=1
```

Expected: **it should PASS on the first run**, and that is the finding, not a mistake. **If it
fails, stop**: it means the picker's own name is wrong (`New theme` is `uiCopy.file.newDocument`),
or a palette genuinely does not reach the top layer — and the second is a defect this task exists to
find. Report which.

- [ ] **Step 3: Confirm the test can fail**

A test that cannot fail proves nothing. Break `.vigilia-dialog`'s background by one token in
`editor-shell.css` (`background: var(--shell-surface)` → `background: var(--shell-backdrop)`),
rebuild, re-run, and confirm the assertion fails for at least one palette. Revert, **rebuild**, and
re-run to green. Playwright previews built bundles; a revert without a rebuild leaves the broken
bundle in place and the next run lies.

- [ ] **Step 4: Commit**

```bash
git add src/web/tests/e2e/shell-appearance.spec.ts
git commit -m "test(editor): the hand-owned dialogs and sections paint every palette

The three native <dialog>s and the inspector's native <details> sections stay
hand-owned — 0033's argument for the tooltip applies unchanged. This pins the
part a palette change could break: a dialog in the top layer is not a descendant
of #app. Proved to fail by moving .vigilia-dialog off --shell-surface.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3.2: The capability walk

**Files:**
- Modify: `docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md` — **only** if the walk
  finds a capability that is genuinely gone, and then only the one line plus a note
- Modify: `docs/product/backlog.jsonl` — one row per capability that is not preserved

**Interfaces:**
- Consumes: the whole redesign, landed.
- Produces: the discharge of the spec's ruling at `:550-551`: *"All existing authoring capabilities
  are preserved; the inventory that discharges it is walked in a browser at the end."*

**Constraints.** This is a **browser walk, not a test run**. `docs/architecture/ownership.md`
enumerates the capabilities the editor had before the redesign began; the walk is one author going
through them in a real browser, against the built bundle, and writing down only what is missing. It
is the last plan's task because the ruling names "at the end", and this is the end. **Nothing found
here is fixed in this task** — AGENTS' bug rule applies: a capability that is gone is filed, not
patched, and the walk's whole value is that it is not spending its attention on a fix.

- [ ] **Step 1: Build and open the real thing**

```bash
cd src/web
npm run build
node packages/host/bin/vigilia.js --no-browser
```

Then drive the editor at `http://127.0.0.1:<host port>/editor/` — **not** the preview server, because
the host is the arrangement that mounts the editor under `/editor`, and the relative base
(`vite.config.ts:34-44`) is a thing this redesign touched.

- [ ] **Step 2: Walk the ownership table**

For each row of `docs/architecture/ownership.md` that names a surface an author touches, perform the
action and record one line: the capability, whether it is present, and how it was exercised. Read
the table rather than recalling it — a walk from memory reproduces the omissions it is meant to
find. **Do not read the source for a capability you can see**: the spec's own loop
(`STATUS.md`) is use-it-then-write-it-down, and a capability that exists in the source and not in
the browser is exactly the finding.

- [ ] **Step 3: File what is gone, and only what is gone**

For each missing capability, add a row to `docs/product/backlog.jsonl` in that file's shape. If
nothing is missing, say so in the commit — **an empty result is a result**, and a walk that reports
nothing without saying it walked anything is not evidence.

- [ ] **Step 4: Commit**

```bash
git add docs/product/backlog.jsonl
git commit -m "docs: the capability walk, and what it did not find

Spec :550-551. Walked against the host's /editor mount, not the preview server.
<n> capabilities exercised, <n> missing, filed as <ids> / nothing missing.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

> **Walked 2026-10-08. Seventeen capability checks, all present; nothing missing, so no backlog row
> and no spec edit.** Against the host's own `/editor` mount at `http://127.0.0.1:5227/editor`, with
> the host built by `npm run build` and started by `packages/host/bin/vigilia.js --no-browser` —
> **not** the preview server, because the relative base and the `/editor` mount are things this
> redesign touched.
>
> Present and exercised: canvas mount, artboard paint and viewport fit; the stage zoom readout; the
> pane bar (Layers / Insert / Assets / Document / `+`); the menubar (File / Edit / Insert / View); the
> File menu's seven rows; the Edit menu's undo, redo, copy, cut, duplicate and delete with their
> chords; the display lens — eight aspect entries grouped by orientation, reached from the Document
> pane's Ratio control; the layer panel, its row controls and a working selection; the round trip
> from a layer row to the right column's five sections (`content, position, layer, paint, spends`);
> the canvas dock's seventeen eligible actions; the Document pane's theme settings, size, ratio,
> orientation, resolution, background media and type-preset controls; the Add panel's 22 insertions
> across CARD / SHAPE / CHART; the Assets pane's import, replace and remove; the palette picker's six
> entries; and the `?` reference's nineteen chords.
>
> **What this walk did not exercise, named rather than implied.** Image import and the crop session,
> chart binding edits, the glass control, type-preset and palette-token authoring, the save/open
> round trip, thumbnail capture, snapping and smart guides, and the clipboard's OS-level paths. Each
> is covered by an existing browser spec (`author-journey-rebuild`, `glass-authoring`,
> `editor-chart-binding`, `reference-theme`) which this task did not re-run, so the walk's claim is
> that these capabilities were not *deleted by the redesign* — not that they were re-proved here.
>
> **One already-filed row was re-confirmed in the host mount.** Pressing Escape with the `+` chooser
> open left it open through a subsequent right-click on the canvas: `vg-169`, "the `+` cannot dismiss
> its own chooser, though it announces that it can". Not filed again, and not fixed here — AGENTS.md's
> bug rule applies, and this task's whole value is not spending its attention on a fix.

---

## Out of scope

Named so they are not re-raised as gaps in this plan:

- **Plan 7's `?` reference sheet is plan 7's** (§7, `:398-402`). **Its `Dialog` is not** — `0037`
  moves `components/ui/dialog.tsx` to React Aria, which is Task 1.3. Plan 7 authored that file; this
  plan re-implements it on a different library, and the sheet's copy, chords and behaviour are what
  must not change.
- **Plan 8 (Player chrome), §8's second half.** Diagnostics on the phone are not the editor's
  chrome. **The player is not migrated by this phase** — it uses `scene-fabric` and no primitive
  library, so 0037 touches the editor only.
- **§8's `tabs` row.** The repo has no `Tabs` import in any package, so there is nothing to migrate.
  The table's "three times" for `menu` is **four** in the source and its Base UI count is five
  imports across five files; both are recorded rather than silently reconciled.
- **`components/ui/colour-picker.tsx` reaching past its own wrapper to the primitive.** §8's
  incoherence was one library versus two. Phase 1 ends that, and **Task 1.3 rebuilds the picker on
  React Aria's colour components rather than on the wrapper** — which is the opposite call from
  routing it through `popover.tsx` first, made because the library's colour family is what closes
  `vg-194`. The wrapper stays hand-owned and thin; it is not the picker's foundation.
- **§8's `Select` and `Tooltip` rows.** Radix carries both and the editor needs neither: the tooltip
  is ours (0033), and the shell's one dropdown is a native `<select>` inside the panel controls.
- **`@theme custom-variant dark` and Tailwind's `dark:` utilities.** That is the *class-toggle*
  idiom for a two-state light/dark app. This shell has six palettes and switches them with its own
  attribute; adding Tailwind's dark variant would create a second switch.
- **A "System" entry in the palette picker**, rejected in 0035 rung 5 and reversible without moving
  anything.
- **`vg-157`** — "with nothing selected the right column is empty and names where to choose from" is
  the other unmet acceptance item, it is the user's decision, and it is not this plan's.
- **`vg-135` and `vg-175`.** Both are load-sensitive jsdom failures that make a full run unreadable.
  Task 1.2 may incidentally fix the first by replacing the primitive that stalls; **that is a
  by-product to be measured and reported, not a task**, and neither row is closed from here without
  evidence.
- **`vg-161`** — an unlanded plan would remove the menubar's Insert and View menus. If that plan
  lands before this one, Task 1.2's `shell-layout.tsx` migration has less to migrate; the file is
  read at the start of the task rather than assumed from this plan's description.
- **`vg-172`** — the editor header overflows at 390px. The editor is a desktop surface (Non-goals,
  `:498-504`), so no task here is gated to a phone width.
