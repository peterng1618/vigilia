# Chrome and appearance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One primitive library and one palette owner. The five Base UI menus become Radix and
`@base-ui/react` leaves the tree; the shell's palette joins `@theme inline` so it resolves at the
element rather than at `:root`; the operating system becomes its fallback; and the six palettes are
proved distinguishable by screenshot, which is the redesign's last unmet acceptance item.

**Architecture:** Three changes, only one of which is visible. **One** — the chrome's primitives.
Five files import `@base-ui/react` today and §8 rules Radix the single library; the swap is
invisible and is proved by the tests that already assert those menus' behaviour. **Two** — the
appearance pipeline. `editor-shell/palette.ts` is already the one owner of which palette is in
force and already writes one attribute on `document.documentElement`; it gains the OS read and the
precedence rule, and `editor-shell.css` gains a `@theme inline` block that gives each `--shell-*`
token a utility name which resolves *at the element*. **Three** — the evidence. Nothing in §8 or
§9 is left to a computed-value assertion at the end.

**Tech Stack:** TypeScript, React 19, `@radix-ui/react-dropdown-menu` and
`@radix-ui/react-context-menu` (MIT — the two new dependencies; `@radix-ui/react-dialog` arrives
with plan 7), Tailwind v4.3.3 (`@theme static`, `@theme inline`), Vitest + jsdom for the chrome,
Playwright against built bundles for everything a cascade or a pixel decides.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 9 of 9. Read §9 (`:451-457`), then §8 to its end (`:404-449`) because this plan discharges
the migration §8 sequenced here, the Sequencing table row 9 (`:475`), Invariants (`:482-496`),
Non-goals (`:498-504`), Acceptance (`:506-543`) and Ruled during review (`:545-563`). **The one
sentence every task is judged by is §9's: one `data-shell-palette` attribute recolours everything,
including every portalled popup.**

**Decision inherited:** [`0033`](../../decisions/0033-new-primitives-are-radix-the-tooltip-is-not.md)
— Radix is the single primitive library; the tooltip stays hand-owned; plan 7 adds
`@radix-ui/react-dialog` and nothing else. **This plan inherits that ruling and does not re-open
it.** It does land one of its own: [`0035`](../../decisions/0035-the-shells-palette-resolves-at-the-element-and-the-os-is-its-fallback.md),
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
- No compatibility glue: the two libraries do not coexist at the end of Phase 1, and no
  `data-*` selector is written for both an old and a new attribute.

## Review Focus

Five input classes the spec implies but no single task's tests would catch on their own. Each is
pinned by a test in the task named beside it.

1. **A popup opened while the palette in force is not `editorial`.** A Radix portal leaves `#app`
   for `body`; if the palette attribute or the popup's class contract moved, the popup paints the
   bare `:root` defaults while the chrome beside it is correct — the defect
   `tests/e2e/shell-appearance.spec.ts:138-178` was written for, generalised to every migrated
   surface. *(Task 1.4.)*
2. **The popup's accessible name after the migration.** Radix sets its own `aria-labelledby` on the
   content, which can shadow a caller's `aria-label` — the *attribute* still reads back, so a
   `getAttribute` assertion passes while the name a screen reader announces changes. Pinned by
   reaching each popup **by role and name**, not by attribute. *(Tasks 1.2 and 1.4.)*
3. **A short window over a long menu.** The canvas context menu carries the Add pane's whole list
   and does not fit a 420px window; Base UI's `--available-height` is gone with the migration and
   Radix publishes its own variable or none. The last entry must still be reachable, **by arrow key
   as well as by pointer** — a fixed height with no scroll strands the entries an author inserting a
   chart needs. *Already pinned, in full, by `tests/e2e/editor-context-menu.spec.ts` — "the last
   entry is reachable in a window too short to hold the menu", including the `End` key and an
   `Enter` that inserts. Task 1.4's job is to keep it green, not to write it.*
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
  `components/ui/popover.tsx` is shadcn's, hand-owned. Radix's dependency closure
  (`react-primitive`, `react-popper`, `react-portal`, `react-presence`, `react-focus-scope`,
  `react-dismissable-layer`, `react-use-size`, `rect`, and the rest) is therefore already installed;
  only the menu packages are missing.
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
- **`vg-135` is open and this plan runs straight through it.** `git log` and `STATUS.md` both carry
  it: in `shell-layout.dom.test.tsx`, one click on a Base UI menu trigger stalls **50–90 s
  synchronously** under jsdom, and three of that file's tests time out at 91/96/118 s against a 20 s
  limit. Tasks 1.2 and 1.4 touch that file. **A hang there is `vg-135`, not a regression** — report
  it with the timing and do not chase it. `vg-175` is the same class one level out: a test that
  passes alone and times out in the full run.

---

## File structure

**Created**

- `docs/decisions/0035-the-shells-palette-resolves-at-the-element-and-the-os-is-its-fallback.md` —
  already written by this plan's author; Task 2.1 lands the code it decides, and does not rewrite it.
- `docs/evidence/screenshots/shell-palette-<name>-desktop-chromium.png` ×6 (Task 2.3).

**Modified — chrome**

- `packages/editor/src/editor-shell/palette-menu.tsx`, `display-switch.tsx`, `insert-popover.tsx`,
  `canvas-context-menu.tsx`, `shell-layout.tsx` — the five Base UI imports.
- `packages/editor/src/editor-shell/editor-shell.css` — the state hooks, the positioner, the
  `@theme inline` block, the first frame.
- `packages/editor/package.json` — two added, one removed.
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

The five Base UI surfaces become Radix and `@base-ui/react` leaves the manifest. **No visible change
is intended**; the proof is that the tests which already assert these menus' behaviour still pass,
and that the built bundle behaves the same in a browser.

---

### Task 1.1: What Radix's menu primitives actually do here

**Files:**
- Modify: `packages/editor/package.json` (add two dependencies; install from `src/web/`)
- Create and delete: `packages/editor/src/editor-shell/radix-menu.probe.dom.test.tsx` (temporary)
- Modify: `THIRD-PARTY-NOTICES.md`, `docs/engineering/dependencies.md`

**Interfaces:**
- Produces: four measured answers that Tasks 1.2, 1.3 and 1.4 are written against. **Nothing
  else.** No production file changes in this task.

**Constraints.** The probe is temporary: it is written, run, read and removed before the commit,
and its answers go into the commit body. It exists because two of the five surfaces are anchored
**not** to a trigger — the Insert chooser anchors to the `+` button that lives in the pane bar, and
the canvas context menu anchors to a pointer position through a synthetic `getBoundingClientRect` —
and Radix's menus position to their Trigger, not to an arbitrary anchor. `@radix-ui/react-popper`
exposes `PopperAnchor` with a `virtualRef?: RefObject<Measurable | null>` prop, and
`@radix-ui/rect`'s `Measurable` is `{ getBoundingClientRect(): DOMRect }` — read from the installed
package's own `.d.ts`, so a plain object literal satisfies it. **Whether the *menu* packages
re-export that Anchor is not readable until they are installed**, and it decides Task 1.3's shape.

- [ ] **Step 1: Install the two packages**

```bash
cd src/web
npm install @radix-ui/react-dropdown-menu @radix-ui/react-context-menu -w @vigilia/editor
```

Verify from the installed metadata, not from memory, and record **the version string and the
licence string** each package's own `package.json` declares:

```bash
node -e "for (const p of ['dropdown-menu','context-menu']) { const j = require('./node_modules/@radix-ui/react-'+p+'/package.json'); console.log(p, j.version, j.license); }"
```

- [ ] **Step 2: Write the probe**

Create `packages/editor/src/editor-shell/radix-menu.probe.dom.test.tsx`. It renders one each of the
shapes the migration needs and answers the four questions. It carries the same stubs the existing
menu tests carry (`ResizeObserver`, `Element.prototype.getAnimations`, and the `:modal` /
`:popover-open` `matches` patch at `palette-menu.dom.test.tsx:25-34`) — the patch is for floating-ui,
which Radix's popper also uses through `@floating-ui/react-dom`.

```tsx
// @vitest-environment jsdom
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeAll, expect, it } from "vitest";

globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];

beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(
    function (this: Element, selector: string): boolean {
      if (selector === ":modal" || selector === ":popover-open") return false;
      return matches.call(this, selector);
    },
    matches,
  );
});

let root: Root | undefined;
afterEach(async () => {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

it("answers the four questions the migration depends on", async () => {
  // (1) Is there an Anchor export, and does virtualRef position the content?
  // (2) What state attributes does each part carry, open and closed?
  // (3) What is the content's accessible name when the caller passes aria-label,
  //     and what does Radix's own aria-labelledby do to it?
  // (4) With `open` controlled and no Trigger fired, where does ContextMenu put
  //     the content, and does forceMount keep a closed content in the document?
  const answers = {
    dropdownAnchorExport: "Anchor" in DropdownMenu,
    contextAnchorExport: "Anchor" in ContextMenu,
    dropdownExports: Object.keys(DropdownMenu).sort().join(","),
    contextExports: Object.keys(ContextMenu).sort().join(","),
  };
  // Print, do not assert: this is a probe, and a failing assert here would hide
  // the other three answers behind it. Read the output, then delete this file.
  console.log(JSON.stringify(answers, null, 2));
  expect(answers.dropdownExports).not.toBe("");
});
```

Extend it with one mounted `DropdownMenu.Root > Trigger > Portal > Content` and one
`ContextMenu.Root open` and print, for each: `getAttribute("data-state")` on the trigger, the
content and a `RadioItem`'s `ItemIndicator`; the content's `aria-labelledby`, `aria-label` and
`getComputedStyle`-independent `role`; and whether a `forceMount`ed content stays in the document
with `data-state="closed"`.

- [ ] **Step 3: Run it and read the answers**

```bash
cd src/web
npx vitest run packages/editor/src/editor-shell/radix-menu.probe.dom.test.tsx
```

Record, verbatim, the four answers. **They are the input to Tasks 1.2, 1.3 and 1.4**, and the
migration's constants — `data-state` values, the availability variable Radix publishes where Base UI
published `--available-height` (`editor-shell.css:368`), and whether the anchored surfaces can
migrate at all — come from here and from nowhere else.

- [ ] **Step 4: Stop if the anchored surfaces cannot migrate**

**If `Anchor` is not exported, or `virtualRef` does not position a `DropdownMenu.Content` opened
without a Trigger: stop this phase and report.** Do not invent a third mechanism and do not leave
Base UI in the tree for one surface while removing it for four. The finding — "§8's ruling reaches
the three trigger-anchored menus; the two pointer-anchored surfaces need a decision about
`radix-ui/primitives#3694`'s territory" — is the deliverable, filed as a row with the probe's
output, and Tasks 1.2, 1.4 and Phase 2 proceed with `@base-ui/react` staying in the manifest for the
two surfaces. Task 1.3 becomes a decision note instead of a migration.

- [ ] **Step 5: Delete the probe and record the licences**

```bash
git rm --cached packages/editor/src/editor-shell/radix-menu.probe.dom.test.tsx 2>/dev/null
rm packages/editor/src/editor-shell/radix-menu.probe.dom.test.tsx
```

Add a row to `THIRD-PARTY-NOTICES.md`'s *Runtime/editor* table for each package, in the table's
existing shape (`| @radix-ui/react-dropdown-menu <version> | MIT | editor shell menus |`), and the
matching row in `docs/engineering/dependencies.md`'s *Declared dependencies* table, with the
licence string Step 1 printed. **Plan 7 added the `@radix-ui/react-popover` and
`@radix-ui/react-dialog` rows** — if either is still missing, add it here and say so in the commit,
because a licence inventory with a hole is what the next audit finds.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/package.json src/web/package-lock.json \
  THIRD-PARTY-NOTICES.md docs/engineering/dependencies.md
git commit -m "chore(editor): install the Radix menus and record what they do

Probe (temporary, removed before this commit) answers: <the four answers,
verbatim>. Licence rows added from each package's own package.json.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 1.2: The three trigger-anchored menus move to Radix

**Files:**
- Modify: `packages/editor/src/editor-shell/palette-menu.tsx`,
  `display-switch.tsx`, `shell-layout.tsx` (`MenuGroup`, `ViewSetting`, `item`)
- Modify: `packages/editor/src/editor-shell/editor-shell.css`
- Test: `packages/editor/src/editor-shell/palette-menu.dom.test.tsx`,
  `display-switch.dom.test.tsx`, `shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: Task 1.1's answers — the state attribute each part carries, and whether `forceMount`
  keeps a closed content mounted with `data-state="closed"`.
- Produces: the class contract every migrated popup keeps, and one **fewer** class:
  `.editor-shell-positioner` is deleted, because Radix has no positioner element and its `z-index`
  belongs on the content (`editor-shell.css:350-356`'s stated reason — the stacking context that
  stops the stage intercepting pointer events over the menu).

**Constraints.** **Behaviour-identical is the requirement.** After this task the following must be
true exactly as before, and each is already asserted somewhere:

1. **The popup's class contract.** `.editor-shell-menu-popup` on the content, with
   `aria-label={uiCopy.palette}` / `{uiCopy.menus.insert}` / `{uiCopy.canvasMenu.label}`, so
   `.editor-shell-menu-popup[aria-label="Shell palette"]`
   (`tests/e2e/shell-appearance.spec.ts:28`) still selects exactly one node.
2. **The List's identity.** `insertGroups()` renders the same groups and order through the Insert
   chooser and the Add pane — the comparison `insert-popover.spec.ts:104` makes and
   `shell-layout.dom.test.tsx`'s `insertMenuGroups()`/`paneGroups()` make.
3. **The radio half.** `aria-checked` on the radio items, the same list, the same checked one —
   `palette-menu.dom.test.tsx:106-113`.
4. **The tick's gutter.** A fixed-width slot that exists whether or not the tick is showing, so
   choosing a display does not shift every label sideways (`editor-shell.css:396-416`). Base UI
   needed `keepMounted` for this; **Radix's `ItemIndicator` renders only when checked**, so the slot
   moves to a wrapper element — the same structure, without a library option.
5. **Escape dismisses and focus returns to the trigger.**
6. **The highlighted row is visible.** The existing rules key on `:hover` and `:focus-visible`
   (`editor-shell.css:389-395`); Radix marks the active row with `data-highlighted` for both pointer
   and keyboard. **If the rule is not re-pointed, keyboard navigation through a menu becomes
   invisible** — nothing fails, the author just cannot see where they are.

**`vg-135` runs through this task.** `shell-layout.dom.test.tsx` is the pathological file: one Base
UI menu-trigger click stalls 50–90 s synchronously, and three of its tests time out at 91/96/118 s
against a 20 s limit. **This task replaces the primitive that stalls** — after the migration the
stall may be gone, and it may not. Either way it is `vg-135`; report the timing before and after and
do not curl the timeout.

- [ ] **Step 1: Write the failing test for the tick's gutter**

Append to `palette-menu.dom.test.tsx`. It asserts the slot is present and full-width whether or not
the tick shows — the property Base UI's `keepMounted` was buying.

```tsx
it("reserves the tick's gutter whether or not the tick is showing", async () => {
  await mount("graphite");
  const rows = options();
  const slots = rows.map((row) => row.querySelector(".editor-shell-menu-check"));
  expect(slots.every((slot) => slot !== null)).toBe(true);
  // The checked row and an unchecked one occupy the same box, so the names do
  // not shift sideways as the palette changes.
  const box = (node: Element | null): number =>
    node === null ? -1 : node.getBoundingClientRect().width;
  expect(box(slots[0] ?? null)).toBe(box(slots[1] ?? null));
  expect(box(slots[0] ?? null)).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd src/web
npx vitest run packages/editor/src/editor-shell/palette-menu.dom.test.tsx -t "gutter"
```

Expected: **FAIL** — `reserves the tick's gutter` — the wrapper `.editor-shell-menu-check` is the
indicator itself today (`palette-menu.tsx:78-83`), so an unchecked row has no element there and
`slot === null` for five of the six rows.

- [ ] **Step 3: Migrate `palette-menu.tsx`**

```tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
// … Swatch unchanged …

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="editor-shell-palette"
        data-vigilia-palette=""
        aria-label={`${uiCopy.palette}: ${palette}`}
      >
        <Swatch palette={palette} />
        {palette}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="editor-shell-menu-popup"
          aria-label={uiCopy.palette}
          sideOffset={6}
        >
          <DropdownMenu.RadioGroup value={palette} onValueChange={choose}>
            {shellPalettes.map((entry) => (
              <DropdownMenu.RadioItem
                key={entry}
                value={entry}
                aria-label={entry}
                className="editor-shell-palette-item"
              >
                {/* The slot is ours and the indicator is Radix's: Radix renders
                    its indicator only while the item is checked, and an
                    unmounted slot collapses the gutter, which moves every name
                    sideways as the palette changes. */}
                <span className="editor-shell-menu-check">
                  <DropdownMenu.ItemIndicator>
                    <Check aria-hidden size={12} strokeWidth={2.5} />
                  </DropdownMenu.ItemIndicator>
                </span>
                <Swatch palette={entry} />
                {entry}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
```

**Check, do not assume:** the popup must still be reachable by its accessible name. Radix sets an
`aria-labelledby` on the content; if Task 1.1's answer is that it shadows the `aria-label`, drop
`sideOffset` and the shadowing source instead of the name — **the name is the contract, the
attribute is not.**

- [ ] **Step 4: Migrate `display-switch.tsx`**

Same shape, with three parts that need reading rather than translating:

- `<Menu.Portal keepMounted>` becomes `<DropdownMenu.Portal forceMount>` **and** the content carries
  `forceMount`; the comment at `shell-layout.dom.test.tsx:213-215` says why it stays mounted — the
  zoom readout's popup must remain in the document, closed, so `[data-state="open"]` rather than the
  class is what names the menu an author has open.
- `closeOnClick` is deleted: Radix's `RadioItem` closes on select by default.
- The tick becomes `<span className="editor-shell-menu-tick"><DropdownMenu.ItemIndicator>•</DropdownMenu.ItemIndicator></span>`.

- [ ] **Step 5: Migrate `shell-layout.tsx`**

Four call shapes: `MenuGroup` (`:179-187`), `ViewSetting` (`:226-245`, Base UI's
`SubmenuRoot`/`SubmenuTrigger`), `item` (`:268-272` — **plan 7 has added its fourth argument and its
`<kbd>` by now; keep both**), and `ShellMenuBar`'s `Menu.Group`/`Menu.GroupLabel` (`:311-317`).
Radix's names are `Sub`/`SubTrigger`/`SubContent` and `Group`/`Label`; `DropdownMenu.Sub` wraps its
own `Trigger` and `Content`, and the `Portal` sits inside the `Sub`.

- [ ] **Step 6: Re-point the stylesheet**

In `editor-shell.css`:

- **Delete** the `.editor-shell-positioner` rule (`:354-356`) and move `z-index: 60` onto
  `.editor-shell-menu-popup` (`:357`), keeping the comment's reason. Delete the two
  `.editor-shell-positioner` lines from the reduced-motion selector list (`:744-745`).
- `[data-popup-open]` → `[data-state="open"]` at `:347` and `:442`.
- The gutter rules `:411-416` and `:479-481` are **deleted**: the slot is now ours and always
  painted, so `visibility` has nothing to switch on.
- The highlight rules `:389-395` gain `[data-highlighted]` alongside `:hover` and `:focus-visible`,
  with the reason in the comment.
- Every comment naming Base UI, `keepMounted` or `--available-height` is corrected — a stale comment
  is how the next reader re-derives the wrong mechanism.
- `--available-height` (`:368`) is replaced by whichever variable Task 1.1 measured, or by an
  explicit `max-height` if Radix publishes none.

- [ ] **Step 7: Pin Escape and focus return before the migration, not after**

Review Focus item 4. Both libraries dismiss on Escape and both return focus to the trigger, and a
migration can keep the first while losing the second — the file's existing `afterEach` dispatch of
Escape (`palette-menu.dom.test.tsx:84-88`) proves only the first, which is why nothing would notice.
This is a **characterisation test**: it is written against the tree as it stands, so that it is red
the moment the migration loses the behaviour. Append to `palette-menu.dom.test.tsx`:

```tsx
it("returns focus to the trigger when Escape dismisses the menu", async () => {
  const host = await mount("graphite");
  const trigger = host.querySelector<HTMLElement>("[data-vigilia-palette]");
  expect(trigger).not.toBeNull();
  // Radix and Base UI both publish this on the trigger; asserting it first is
  // what makes the focus assertion below mean "the menu closed" rather than
  // "the menu was never open".
  expect(trigger?.getAttribute("aria-expanded")).toBe("true");

  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await flush();

  expect(document.activeElement).toBe(trigger);
  expect(trigger?.getAttribute("aria-expanded")).toBe("false");
});
```

**Run it against the current tree first.** Expected: **PASS**. If it does not pass, the behaviour
this task is told to preserve is not the behaviour that exists — report that before migrating
anything, because the task's constraint would otherwise be a claim about a tree nobody measured.

- [ ] **Step 8: Run the DOM tests**

```bash
cd src/web
npx vitest run packages/editor/src/editor-shell/palette-menu.dom.test.tsx \
  packages/editor/src/editor-shell/display-switch.dom.test.tsx
npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx
```

Expected: PASS. **On `shell-layout.dom.test.tsx`, a run of minutes is `vg-135`** — record the wall
clock before and after the migration in the commit body and report it; do not raise a timeout to
make it green.

- [ ] **Step 9: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/palette-menu.tsx \
  src/web/packages/editor/src/editor-shell/display-switch.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.tsx \
  src/web/packages/editor/src/editor-shell/editor-shell.css \
  src/web/packages/editor/src/editor-shell/palette-menu.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/display-switch.dom.test.tsx \
  src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx
git commit -m "refactor(editor): the shell's three trigger-anchored menus are Radix

Behaviour-identical: the popup class and aria-label contract, insertGroups'
order, aria-checked, the tick's gutter, Escape and focus return, and the
highlighted row are all unchanged. shell-layout.dom.test.tsx: <before>s ->
<after>s (vg-135, not a regression).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 1.3: The two anchored surfaces move — or the reason they cannot

**Files:**
- Modify (if the probe passed): `packages/editor/src/editor-shell/insert-popover.tsx`,
  `canvas-context-menu.tsx`, `editor-shell.css`
- Test: `packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx`,
  `tests/e2e/insert-popover.spec.ts`, `tests/e2e/editor-context-menu.spec.ts`

**Interfaces:**
- Consumes: Task 1.1's `Anchor`/`virtualRef` answer.
- Produces: nothing new if the migration is possible; **a filed row and a written decision if it is
  not** — see Step 1.

**Constraints.** These two are not trigger-anchored, and that is why they are a task of their own:

- `InsertPopover` renders only the popup; the `+` it anchors to is the pane bar's own button, and
  the component's comment (`insert-popover.tsx:82-84`) records that it "stays there". Radix
  positions to a `Trigger` **inside** the menu's tree, so either the button moves into the component
  or the content is anchored through `PopperAnchor virtualRef`.
- `CanvasContextMenu` has **no Trigger at all**, deliberately: Fabric binds its own `contextmenu`
  listener on `upperCanvasEl` and stops propagation, so a Radix `ContextMenu.Trigger` would never
  fire (`canvas-context-menu.tsx:106-110`). It opens from a controlled `open` and anchors to a
  synthetic `{ getBoundingClientRect }` rect at the pointer (`:146-157`) — which is exactly the
  shape `virtualRef` takes, since `Measurable` is `{ getBoundingClientRect(): DOMRect }`.

**Both must keep their visible behaviour**, and the third Review Focus item is where that is proved:

- the Insert chooser lists the same groups in the same order as the Add pane
  (`insert-popover.spec.ts:104`);
- the canvas menu carries the Add pane's whole list when the hit was empty canvas and the dock's
  eligible `OBJECT_ACTIONS` when it was not (`editor-context-menu.spec.ts`);
- **the canvas menu's whole list stays reachable in a short window.** Base UI published
  `--available-height` and the popup scrolls inside it (`editor-shell.css:357-369`). Radix's
  variable is different or absent, so this is re-derived, not translated. The existing browser proof
  is `tests/e2e/editor-context-menu.spec.ts` — read it before choosing a mechanism, because it
  states the claim precisely: `scrollHeight > clientHeight`, the popup's own bottom inside the
  viewport, `End` scrolling the last entry into view, and `Enter` on it inserting an object.
  **The stylesheet's comment at `:359-367` says the list is "13 entries under two headings, 470px";
  the spec says four groups and the assertion caps at `> 10`. Re-derive the count from
  `insertGroups()` rather than restating either.**

- [ ] **Step 1: Choose the route the probe allows**

**If Task 1.1 measured an `Anchor` export and a working `virtualRef`, migrate both. If not, do not
migrate either.** Instead write `docs/decisions/0036-<slug>.md` in 0035's shape, with the probe's raw
output as Rung 6, and file a row. **This plan's author did not write that note and does not know
its verdict** — the probe decides, and either outcome is a finished task.

- [ ] **Step 2: Migrate the Insert chooser**

```tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
// …keyOf and insertItem unchanged except Menu.Item -> DropdownMenu.Item…

  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      {/* `virtualRef` rather than a Trigger: the + belongs to the pane bar and
          stays there (this component renders no element outside its portal), so
          the anchor is an element the menu does not own. */}
      <DropdownMenu.Anchor virtualRef={anchor} />
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="editor-shell-menu-popup"
          aria-label={uiCopy.menus.insert}
        >
          {insertGroups().map((group) =>
            group.label === undefined ? (
              group.objects.map((object) => insertItem(object, session))
            ) : (
              <DropdownMenu.Group key={group.label}>
                <DropdownMenu.Label className="editor-shell-menu-label">
                  {group.label}
                </DropdownMenu.Label>
                {group.objects.map((object) => insertItem(object, session))}
              </DropdownMenu.Group>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
```

**The prop type changes**: `anchor: RefObject<HTMLElement | null>` is what
`DropdownMenu.Anchor`'s `virtualRef` wants (`RefObject<Measurable | null>`), so the caller in
`shell-layout.tsx` needs no change — verify that rather than assuming it, since a `Measurable` is
wider than an `HTMLElement` and the assignability direction matters.

- [ ] **Step 3: Migrate the canvas context menu**

```tsx
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: (): DOMRect =>
        DOMRect.fromRect({
          x: menu?.x ?? 0,
          y: menu?.y ?? 0,
          width: 0,
          height: 0,
        }),
    }),
    [menu],
  );

  return (
    <ContextMenu.Root
      open={menu !== undefined}
      onOpenChange={(next) => {
        if (!next) setMenu(undefined);
      }}
    >
      {/* The rect IS the anchor: a menu opened at a gesture has no element to
          measure, and Fabric stops the contextmenu a Trigger would need. */}
      <ContextMenu.Anchor virtualRef={anchorRef} />
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="editor-shell-menu-popup"
          aria-label={uiCopy.canvasMenu.label}
        >
          {objectEntries.map(entryItem)}
          {creation.map(groupItems)}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
```

A plain object satisfies `Measurable`, so `anchor` becomes a ref to it: hold the current object in a
`useRef` updated by the same effect that calls `setMenu`, because `virtualRef` reads `.current` when
it positions rather than at render. **Confirm that at the probe's answers before writing it** — if
Radix reads the ref once, the ref must be replaced per open rather than mutated, and the
short-window spec's `lastBottom` is what will say so.

- [ ] **Step 4: Write the failing test for the list the canvas menu carries**

The DOM half of the short-window claim: every entry the Add pane offers is in the popup, so nothing
was dropped by a mechanism that could not render it. The geometry half already exists in
`editor-context-menu.spec.ts` and is not duplicated. Append to `canvas-context-menu.dom.test.tsx`,
using its own `openMenu({ target: NO_TARGET })`:

```tsx
it("carries every entry the Add pane offers, in the pane's own order", async () => {
  const opened = await openMenu({ target: NO_TARGET });

  // Read from the owner rather than restated: `insertGroups()` is the one list,
  // and a count typed here is a second one that can fall behind it.
  const expected = insertGroups().flatMap((group) =>
    group.objects.map((object) => object.label),
  );
  expect(opened.labels).toEqual(expected);
});
```

`openMenu` (`:88-130`) already returns the `[role="menuitem"]` elements; if it does not expose their
labels, add them to its return rather than querying the document a second time.

- [ ] **Step 5: Run them**

```bash
cd src/web
npx vitest run packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx
npm run build -w @vigilia/editor
npx playwright test tests/e2e/insert-popover.spec.ts tests/e2e/editor-context-menu.spec.ts --project=desktop-chromium --workers=1
```

Expected: PASS. `insert-popover.spec.ts:67`'s `popupOf` and `composition-panel.spec.ts:1052` read
`.editor-shell-menu-popup[data-open]` — **Base UI's attribute.** They move to Radix's in Task 1.4;
if they are run before that, they fail for the right reason, and the failure is not a defect.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/editor-shell/insert-popover.tsx \
  src/web/packages/editor/src/editor-shell/canvas-context-menu.tsx \
  src/web/packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx
git commit -m "refactor(editor): the Insert chooser and the canvas menu are Radix

Both anchored through Anchor virtualRef rather than a Trigger: the + belongs to
the pane bar, and Fabric stops the contextmenu event a Trigger would need.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 1.4: Base UI leaves, and the menus behave the same in a browser

**Files:**
- Modify: `packages/editor/package.json`, `THIRD-PARTY-NOTICES.md`,
  `docs/engineering/dependencies.md`
- Modify: `tests/e2e/shell-appearance.spec.ts`, `insert-popover.spec.ts`,
  `composition-panel.spec.ts`, `editor.spec.ts`, `editor-display.spec.ts`
- Run unchanged: `tests/e2e/editor-context-menu.spec.ts` — it reads the popup by `aria-label`, not
  by a state attribute, so it needs no edit and is worth more as an untouched witness

**Interfaces:**
- Consumes: every migrated menu from Tasks 1.2 and 1.3.
- Produces: **the behaviour-identical claim, with its evidence**, and a tree in which an import of
  `@base-ui/react` cannot resolve.

**Constraints.** Removing the dependency **is** the gate: a leftover import fails to resolve, so no
grep-based test is warranted and none is written. The e2e locators that key on Base UI's attributes
are named here so they are changed deliberately rather than discovered:

- `.editor-shell-menu-popup[data-open]` — `tests/e2e/insert-popover.spec.ts:67` and
  `tests/e2e/composition-panel.spec.ts:1052`, plus `shell-layout.dom.test.tsx`'s `openPopup()` and
  `openPopups()`, which Task 1.2 already re-pointed.
- `tests/e2e/editor.spec.ts:772`'s comment explaining `data-open` on a kept-mounted popup.
- `editor-display.spec.ts`'s `[role="menuitemradio"]` readers (`:110`, `:120`, `:340`, `:374`,
  `:454`, `:468-471`, `:480`, `:513-525`) — roles do not change, but they are the sweep that proves
  the radio half did not.

**The behaviour-identical claim, and what proves it.** After this task, for every migrated surface,
with the **built bundle**: the trigger opens and closes it; Escape closes it and focus is back on the
trigger; the popup is reachable **by role and accessible name**; opening it under `graphite` paints
it with graphite, and the popup is a sibling of `#app`; the Insert chooser's groups equal the Add
pane's groups; the canvas menu's last entry is reachable by pointer and by arrow key in the 420px
window `editor-context-menu.spec.ts` sets; the checked radio item is `aria-checked="true"` and the
tick occupies its gutter. Evidence:
the six specs named above, run on the commit before and the commit after, compared *outcome for
outcome* — same pass/fail, same counts. **A spec that changes from pass to pass is not evidence; a
spec that changes from fail to pass is a fix, and must be named as one.**

- [ ] **Step 1: Point the e2e readers at Radix's state attribute**

Change the two `[data-open]` locators named above to Radix's, as Task 1.1 measured it. Do not write
a selector that matches both.

- [ ] **Step 2: Remove the dependency**

```bash
cd src/web
npm uninstall @base-ui/react -w @vigilia/editor
npm run typecheck
npm run build -w @vigilia/editor
```

Expected: typecheck exits 0 and the build succeeds. **If either fails on a `@base-ui` import, a
surface was missed** — that is the point of removing the package rather than grepping for it.
Remove `@base-ui/react`'s row from `THIRD-PARTY-NOTICES.md:16` and from
`docs/engineering/dependencies.md`.

- [ ] **Step 3: Add the portalled-popup sweep for every migrated surface**

Append to `tests/e2e/shell-appearance.spec.ts`. It generalises the existing popup test
(`:138-178`) from the palette menu to all of them, and pins Review Focus items 1 and 2.

```ts
/** Every migrated popup, opened under a palette that is not editorial. */
test("every menu paints the palette in force and answers to its own name", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(90_000);

  await openEditor(page);
  await choosePalette(page, "graphite");

  // Reached by ROLE and NAME, not by attribute: Radix sets its own
  // aria-labelledby on the content, so an aria-label that survives as an
  // attribute can still stop being the name a screen reader announces.
  const surfaces = [
    { trigger: "[data-vigilia-palette]", name: uiCopy.palette },
    { trigger: "[data-vigilia-zoom]", name: uiCopy.display.label },
  ];
  for (const surface of surfaces) {
    await page.locator(surface.trigger).click();
    const popup = page.getByRole("menu", { name: surface.name });
    await expect(popup).toBeVisible();
    await expect(popup.locator(".editor-shell-menu-popup")).toHaveCount(1);
    const [popupBackground, headerBackground] = await Promise.all([
      popup.evaluate((node) => getComputedStyle(node).backgroundColor),
      page.locator(".editor-shell-header").evaluate((node) => getComputedStyle(node).backgroundColor),
    ]);
    expect(popupBackground, `${surface.name} does not paint graphite`).toBe(headerBackground);
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
  }
});
```

`uiCopy` is not importable from a spec — write the two names as the literals the spec already uses
(`"Shell palette"` at `:28`, and the display control's name from `uiCopy.display.label`), and say in
a comment which file owns them.

- [ ] **Step 4: Keep the short-window proof green, and change nothing in it**

`tests/e2e/editor-context-menu.spec.ts` already writes this test in full — "the last entry is
reachable in a window too short to hold the menu" — with its own `SHORT_WINDOW`, its own
`emptyCanvasPoint`, and one `readMenu` that reads `clientHeight`, `scrollHeight`, `scrollTop`,
`lastTop` and `lastBottom`. **Read it, run it, and do not rewrite it.** It is the pin for Review
Focus item 3 and, because it finds the popup by `aria-label === "Canvas actions"` rather than by
class, it is also an independent check on Review Focus item 2.

```bash
cd src/web
npx playwright test tests/e2e/editor-context-menu.spec.ts --project=desktop-chromium --workers=1
```

Expected: PASS, unchanged from before the migration. **If it fails, the fault is in the
`--available-height` replacement and not in the test** — the assertion names which of the four
geometric claims broke, and that is the mechanism to fix.

- [ ] **Step 5: Rebuild and run the sweep, before and after**

```bash
cd src/web
npm run build -w @vigilia/editor && npm run build -w @vigilia/player
npx playwright test tests/e2e/shell-appearance.spec.ts tests/e2e/insert-popover.spec.ts \
  tests/e2e/editor-context-menu.spec.ts tests/e2e/editor-display.spec.ts \
  tests/e2e/composition-panel.spec.ts --project=desktop-chromium --workers=1
```

Run the same command against the commit **before** Task 1.2 and record both outcomes side by side in
the commit body. Playwright previews built bundles: **rebuild after every source change and after
reverting a deliberate break.**

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/package.json src/web/package-lock.json \
  THIRD-PARTY-NOTICES.md docs/engineering/dependencies.md \
  src/web/tests/e2e/shell-appearance.spec.ts src/web/tests/e2e/insert-popover.spec.ts \
  src/web/tests/e2e/composition-panel.spec.ts src/web/tests/e2e/editor.spec.ts \
  src/web/tests/e2e/editor-context-menu.spec.ts
git commit -m "refactor(editor): @base-ui/react leaves the manifest

Behaviour-identical, before -> after, six specs at the same outcomes: <the
table>. One library, one portal implementation, one focus model.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

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
- Produces: `--color-shell-*`, one per `--shell-*` token, so any shell element may be written with a
  Tailwind colour utility.
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
it("gives every --shell-* token a name in @theme inline", () => {
  const inline = /^[ \t]*@theme[ \t]+inline[ \t]*\{([^}]*)\}/m.exec(css)?.[1] ?? "";
  expect(inline, "the palette is not in an @theme inline block").not.toBe("");

  const declared = [...css.matchAll(/^\s*(--shell-[a-z-]+)\s*:/gm)].map((m) => m[1]);
  expect(declared.length).toBeGreaterThan(0);
  for (const token of new Set(declared)) {
    expect(
      inline,
      `${token} has no utility name, so nothing can read it as a Tailwind colour`,
    ).toContain(`${token.replace("--shell-", "--color-shell-")}: var(${token})`);
  }
});
```

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
  a Radix Collapsible, and §8's table row for `collapsible` is discharged by that owner.

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

---

## Out of scope

Named so they are not re-raised as gaps in this plan:

- **Plan 7's `?` reference and its Radix `Dialog`.** Plan 7 owns them (§7, `:398-402`); this plan
  consumes `components/ui/dialog.tsx` and does not touch it.
- **Plan 8 (Player chrome), §8's second half.** Diagnostics on the phone are not the editor's
  chrome.
- **§8's `tabs` row.** The repo has no `Tabs` import in any package — `grep -rn "@base-ui\|@radix-ui"`
  over `src/web/packages` returns five files and none imports tabs — so there is nothing to migrate
  and the table's "three times" for `menu` is four in the source. Both are recorded in the report
  rather than silently reconciled.
- **`components/ui/popover.tsx` and `components/ui/colour-picker.tsx` both import
  `@radix-ui/react-popover` directly.** §8's incoherence is one library versus two — `popover.tsx`
  is the hand-owned shadcn wrapper and `colour-picker.tsx` reaches past it to the primitive. Phase 1
  ends the *library* incoherence, which is what §8 ruled on; the wrapper being bypassed by its own
  consumer is a smaller thing in one file and is not fixed here. Named so it is a decision rather
  than an oversight.
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
