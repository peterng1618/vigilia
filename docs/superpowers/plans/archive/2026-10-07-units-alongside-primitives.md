# Units alongside primitives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `+` in the pane bar opens a chooser that offers the card library and the
primitives side by side — neither greyed, neither described as a fallback — and the
reference composition's own cards are units, so every card row on the starter names the
card it *is* instead of reading as the bare `Group` arm.

**Architecture:** Two changes, and each is the *last* step of something already built. The
insertable list has one owner, `insertGroups()`, and three surfaces already render it; the
`+` is a fourth rendering of that owner and nothing else — it currently does nothing at
all, because the popover the superseded design named for it was never built. A card's
identity has one owner too: `provenance`, the document's own authored key for it, is
already stamped on the insert path, already validated, already persisted and already read
by the layer projection. What is missing is only that the *starter's* cards carry it, so
the work is to stamp them where a card is assembled, and to correct the two docstrings
that document the absence as deliberate.

**Tech Stack:** TypeScript, React 19 (shell chrome only — the popover is a menu, and
`insertGroups()` stays imperative DOM), Base UI `Menu` (the primitive every existing menu
surface uses; §8's migration to Radix is plan 9's, and this plan adds no new library),
Fabric 7.4.0, Vitest + jsdom, Playwright against built bundles.

**Spec:** [`../specs/2026-10-03-dashboard-authoring-design.md`](../specs/2026-10-03-dashboard-authoring-design.md)
— plan 5 of 9. Read §5 to its end (`:360-370`), the §*Acceptance* bullet at `:537`, the
§*Sequencing* table row 5 at `:475`, and the §*Invariants* block at `:486-500`. The one
test every task is judged by is the spec's own: *does this change remove a step, or does
it remove a freedom?*

---

## What is already true — do not rebuild

Verified against the source at `a208dec9`, the commit this plan was written from. **A task
that rebuilds any of this has misread the plan**, and the failure mode the brief for this
plan named — a plan that re-implements the delivered half — is exactly this list.

1. **`insertGroups()` is the declared single owner of the insertable list.**
   `src/web/packages/editor/src/new-object-panel.ts:75`; its docstring (`:62-74`) already
   says, in as many words, *"Units and primitives are both here, and neither is a fallback
   for the other."* It spreads `CARD_LIBRARY` first, then the standalone text entry, then
   `SHAPE_KINDS`, then `CHART_FAMILIES`, and groups them by `groupOf` (`:109`). Measured
   today: **21 entries in four groups — Card ×8, one ungrouped Text, Shape ×8, Chart ×4.**
2. **Three surfaces already render it, and the two pins already exist.** The Add pane
   (`new-object-panel.ts:257`), the shell's Insert menu (`editor-shell/shell-layout.tsx:348`)
   and the canvas context menu (`editor-shell/canvas-context-menu.tsx:46`). `new-object-panel.dom.test.ts`
   pins both sections, disables neither, and refuses every fallback word (`:512`, `:532`);
   `shell-layout.dom.test.tsx:817` compares the menu's rendered groups to the pane's, as
   sets read from both surfaces' own DOM.
3. **The three surfaces' *insertion* is wired and browser-tested.**
   `card-insert-surfaces.dom.test.tsx` drives a real `EditorSession` through all three and
   asserts each one inserts and reports. **This is the half that needs proof, not
   construction.** The `+` is the other half — see 4.
4. **The `+` does nothing, and it is the control this plan's acceptance names.**
   `editor-shell/pane-bar.tsx:62-69` renders it (`.editor-shell-pane-bar-add`, its name from
   `uiCopy.rail.insertObject`, a `Plus` icon) and calls `onInsert`;
   `shell-layout.tsx:532` passes `openInsertPopover`, which is
   `const openInsertPopover = (): void => undefined;` (`:431`) under a `ponytail:` marker
   that names a Task 3 which never landed. The superseded design named the `+` popover as
   where insert lives — `specs/2026-10-02-frontend-redesign-design.md:95`, *"The `+` popover
   in the left column, rendering `insertGroups()` unchanged"* — and this plan's own spec
   rules that the superseded plan's remaining tasks *"are re-expressed rather than re-run"*
   (`:481-484`). So the popover is **built here**, and it is the smallest thing that makes
   the acceptance sentence true: a fourth rendering of the list that already exists.
5. **`CARD_LIBRARY` exists and the copy path already stamps.**
   `src/web/packages/editor/src/card-library.ts:73` — `CardUnit { id, label, build }`, and
   `build` **is** the starter's own builder (`clockCard`, `cpuCard`, … from
   `new-fabric-theme-cards.js`), so the library and the starter already share builders.
   `instantiateCard` stamps `{ widgetId: unit.id, widgetName: unit.label }` on the copy's
   root (`:250`, spread at `:450`) and on nothing else — pinned at
   `card-library.test.ts:274-293`.
6. **Provenance is complete authored state, and the projection already reads it.**
   `WidgetProvenance` is `renderer-core/src/theme/document.ts:228-234`; validated at
   `validate.ts:880`; persisted by name in `scene-fabric/src/persist.ts:77`; its survival
   across a save and a reopen is already pinned end to end (`card-library.test.ts:296-311`).
   `editor-shell/layer-tree.ts:292` `groupRole()` reads `object.get("provenance")?.widgetName`
   for a group row's role. **The starter's builders write no stamp** — nothing in
   `new-fabric-theme-cards.ts` names `provenance` — so `layer-tree.ts:280-291` documents the
   absence as deliberate, and the group arm's own docstring at `:65-67` says the same. That
   is the sentence this plan makes false and corrects in the same change.
7. **The card arm is the arm that goes quietly missing.** `shell-layout.dom.test.tsx:858-863`
   records it: removing `case "card"` from `insertItem` left **216 tests passing**, because
   every façade in that file stubs `insertCard`. Every surface this plan touches carries its
   own card assertion, and the count above is the evidence for why.

**What follows from that.** Plan 5 is smaller than its title. Phase 1 builds one control
(the `+`'s chooser) and proves a list that exists; Phase 2 writes one key onto eight objects
and corrects the prose that says it is not there. Nothing else in the spec's §5 is open: the
copy path's fresh ids, remapped bindings and recorded provenance are landed and pinned.

## Global Constraints

Copied from the spec and from `AGENTS.md`; every task's requirements include them.

- **"Fabric stays imperative behind the editor boundary; React never mirrors an object"**
  (spec §*Invariants*, `:490`). The popover renders `insertGroups()` and dispatches through
  the façade; it never reads or holds a `FabricObject`.
- **"One owner per concept. The action registry, the card library and `insertGroups` keep
  theirs; surfaces render from them"** (`:491-492`). A fourth surface is a fourth
  *rendering*, never a fourth list and never a fourth membership decision
  (`docs/architecture/ownership.md:7-13`).
- **"`renderer-core` stays Fabric- and DOM-free"** (`:493`). This plan touches
  `renderer-core/src/theme/document.ts` for one docstring and adds no code there.
- **"Persist authored state only. Viewport, collapse, selection and device choice are
  transient (§67)"** (`:495-496`). The popover's open state is transient and never enters a
  document or history; `provenance` **is** authored state and is the reason it is written
  into the scene rather than derived at read time.
- **"Never fabricate a reading."** Untouched by this plan; nothing here reads a sample.
- **"No second scene tree, no second renderer. Fabric JSON is still the document (§134)"**
  (`:499`). The stamp is a key on the scene's own JSON, beside `name` — not a side table,
  and not a lookup in `CARD_LIBRARY` at read time.
- **"Editor-shell theming stays separate from authored theme globals (§35)"** (`:500`). The
  unit words are product copy in `ui-copy.ts`, not theme strings and not localised.
- **No new dependency, and no new primitive library.** The popover uses Base UI `Menu`,
  which the Insert menu and the palette list already use. §8's ruling — standardise on Radix
  and migrate the five Base UI imports — is **plan 9's phase**, is a mechanism-boundary
  change with its own decision note (`specs/2026-10-03-dashboard-authoring-design.md:432-444`),
  and this plan neither pre-empts it nor adds a sixth import.
- **The reuse gate.** `src/web/packages/editor/src/editor-shell/layer-tree.ts` and
  `shell-layout.tsx` are on `scripts/reuse-gate.mjs`'s watchlist. A write to a watchlisted
  path is **refused until a decision note claims it**: `shell-layout.tsx` is claimed by
  `docs/decisions/0029`, and `layer-tree.ts` is claimed by **nothing** today — measured,
  `node scripts/reuse-gate.mjs` answers exit `2` for it, which is why Task 4 exists and runs
  first in its phase.
- **500 lines is a signal and 800 is a stop**, in that order. `editor-shell/layer-tree.ts` is
  **478** lines — 22 from the signal — so its two docstring corrections are prose-neutral
  and must not grow the file; if a later task needs room there, extract rather than trim.
  `card-library.ts` is 610 and past the signal already; this plan adds nothing to it.
- **`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on.** Refuse invalid
  numeric input rather than coercing it to zero.
- **Box-specific verification rules — the environment cannot guess these:**
  - Typecheck is judged **by exit code**, never by reading for the word "error":
    `npm run typecheck` from `src/web/`.
  - Lint is `./node_modules/.bin/biome lint ..` from `src/web/`, **not** `npm run lint`
    (it exits 1 on this box for a PATH reason), and `biome check` is not a gate.
  - **Never the shared Playwright MCP browser** — another session owns it. Run Playwright
    directly, always with `--workers=1`.
  - **Read results from the JSON report file, not from stdout.** A stdout hook rewrites
    command output, so a green run can read as red and a red one as empty; pass
    `--reporter=json` on the command line **and** `PLAYWRIGHT_JSON_OUTPUT_NAME=<path>`,
    because a CLI `--reporter` replaces the config's list and only then does the variable
    apply.
  - **Playwright previews built bundles.** Rebuild the affected package after any source
    change, and again after reverting a deliberate break — a browser result taken on a stale
    bundle is not evidence.
  - **A new regression test must fail when the fix is disabled** before it is trusted. Each
    task's verification says how.
  - **Visible behaviour needs rendered browser inspection**, not object counts or geometry
    assertions alone.
- Stage explicit paths; never `git add -A`. No licence headers. Conventional Commit titles.
  `npm run status:check` from `src/web/` before any commit that touches `STATUS.md`.

## Review Focus

These are inputs and failure modes the spec implies and no step below exercises by name.
Each line is pinned by a test in the task named — the spec is a vision document, and its
silence about an input is not permission for that input to break the program.

1. **A group the author made is not a unit, and a card's own parts are not units.** `Ctrl+G`
   over two shapes makes a `Group` the document never stamped — as does re-grouping a
   starter card's parts after ungrouping it. Its row must be the bare `Group` arm; a stamp
   that leaked onto a child, or a row that inherited its parent's, would be the role claiming
   something the document does not hold. Pinned in **Task 5** (the stamp is on the root alone)
   and **Task 6** (the row's answer for an unstamped group).
2. **A unit this build does not know.** A stamp written by another Vigilia version, or by a
   document this build has no library entry for, still names the unit *the document claims* —
   never resolved through `CARD_LIBRARY`, never discarded for not matching. This is the guard
   that keeps the projection from becoming a second owner of the unit vocabulary, and the
   existing case at `layer-tree.test.ts:888-921` (`widgetId: "cpu"` matches no unit, and the
   row still says `CPU`) becomes load-bearing. Pinned in **Task 6**.
3. **The stamp is a fact about the file, not about the way in.** A stamp the editor added on
   the way to the canvas would be runtime state wearing an authored hat (§67), and it would
   vanish the first time somebody opened the document in another tool. Pinned in **Task 5**,
   by reading it back out of a saved package's own `theme.json`.
4. **Two copies of one unit in one document.** Both carry the same `widgetId` and the same
   `widgetName` and different object ids. The row tells them apart — and neither loses its
   stamp to the other's arrival. Pinned in **Task 6**.
5. **The `+` when the popover has nothing to dispatch to.** A shell with no session, or an
   author who opens the chooser before the document is ready, must not leave a `+` that opens
   an empty menu or a button that inserts nothing: the item's own dispatch is the façade's,
   and a façade that is absent is what the shell already models. Pinned in **Task 1**, on the
   same terms `new-object-panel.dom.test.ts:557` pins the pane's card refusal.

## Out of scope — named, so no task reaches for them

- **Plan 6 (publish loop), 7 (keyboard), 8 (player chrome) and 9 (chrome and appearance)**
  have no plan files yet. Plan 5 must not write one, and must not pre-empt their work — in
  particular §8's primitive-library migration to Radix, which gets its own decision note and
  its own phase.
- **The menubar's Insert menu stays.** The superseded design rules that Insert and View
  *"leave the menus"* (`specs/2026-10-02-frontend-redesign-design.md:383`) and the plan that
  carried that removal — `plans/2026-10-03-editor-left-column-and-header.md`, Task 4 — never
  landed. It is that plan's surface reduction, it is a *freedom* question the spec's own test
  asks us to weigh, and merging two plans is what `AGENTS.md` forbids. After this plan there
  are four renderings of one list, which is what "one owner, many renderings" already meant
  for the three that exist. Recorded for the controller, not fixed here.
- **§5's primitive list names `image` and `video`.** Image insertion arrives through the
  Assets panel today, and `video` cannot become an object at all: `isPlaceable`
  (`asset-manager/panel.ts:232-236`) accepts `image` and `svg` only, so an MP4 is declared
  and never placed. Moving asset insertion into the Add pane is `vg-154` (`vg-155`, `vg-156`
  share its fix site) — the user's own open row, judged on its own. **This plan adds no
  asset button to any surface**, because doing so would take that decision on an agent's
  hand. The gap is recorded in the close-out commit, not closed here.
- **`vg-153`** (dissolve the Document pane and give the theme globals their own surface) is
  open and the decision is the user's. **`vg-119`, `vg-151`, `vg-157`, `vg-158`** are open
  rows and none of them is this plan's.
- **The font catalogue plan** is on hold; its own `progress.md` is its resume point.
- **The starter's names-equals-ids convention is not changed.** Every starter object is named
  after the id it already carries and the names are unique document-wide
  (`new-fabric-theme.test.ts:352-380`) — a pinned product decision, and the reason a starter
  card's *name* column reads `group-cpu-card` while its *role* column will read `CPU`. Making
  the starter's cards answer to their unit labels is a change to that convention, not to this
  one; if it is wanted, it is its own decision with its own pin.

---

## Phase 1 — The `+` offers both

The acceptance sentence names one control: *"The `+` offers units **and** primitives, neither
greyed, neither described as a fallback"* (`:537`). The list behind it is delivered and its
owner is declared; the control is not. Phase 1 builds the control as a fourth rendering of
that one owner, and proves the whole arrangement in a browser.

### Task 1: The `+` opens a chooser

**Files:**
- Create: `src/web/packages/editor/src/editor-shell/insert-popover.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/pane-bar.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Consumes: `insertGroups()`, `InsertGroup`, `InsertableObject` (`../new-object-panel.js`);
  `uiCopy.panels` for the group headings; `EditorActionFacade`'s `addText()`,
  `addShape(kind)`, `addChart(family)` and `insertCard(cardId)`
  (`editor-shell/session-facade.js`) — all four already exist, and every branch dispatches
  through the façade rather than calling a manager.
- Produces: `InsertPopover`, a React component taking the façade (or `undefined`, the state
  the shell already models before a document is open) and rendering a Base UI `Menu` whose
  trigger **is** the pane bar's `+`.
- Removes: `openInsertPopover`'s inert body (`shell-layout.tsx:431`) and the `ponytail:`
  marker above it. `PaneBar.onInsert` stops being a no-op it is handed.

**Constraints:** render from `insertGroups()` **directly**, so neither group order nor
membership can drift from the owner. A shape `Line` and a chart `Line` share a label, so the
React key is the kind *and* the value (`shape:line` / `chart:line`), and they stay two rows.
The `+` keeps `.editor-shell-pane-bar-add`, its accessible name from
`uiCopy.rail.insertObject`, and its `Plus` icon — it is a name and an icon, not a word, and
`pane-bar.tsx`'s comment says why. Whichever wiring the implementer proves (the shell owning
`open` and the button carrying a ref, or the popover rendering its own trigger into the bar),
the DOM holds **one** `+`, its name is unchanged, and `pane-bar.dom.test.tsx` and
`editor-pane-bar.spec.ts` stay green without being edited. `shell-layout.tsx`, `pane-bar.tsx`
and `editor-shell.css` are the only shell files touched; the popup reuses the shell's existing
menu class names and portal arrangement rather than inventing a second popup idiom.

**Failure modes to design against:** a popover that builds its own list — the drift that put
the panel out of the menu once already, and the one thing `insertGroups()` exists to prevent;
a card arm that dispatches nothing (the arm `shell-layout.dom.test.tsx:858-863` records going
missing under 216 passing tests); a façade call wrapped in the pane's `constructing` helper,
which would report a card's refusal twice — `insertCard` returns `void` and the session
reports its own; a menu that renders while the façade is `undefined` and inserts nothing
silently.

- [ ] **Step 1: Write the failing test** — in `shell-layout.dom.test.tsx`, beside the existing
      Insert-menu parity test (it already has the jsdom stubs Base UI needs, the `facade()`
      stub, and the `insertMenuGroups()` / `paneGroups()` readers):

```tsx
it("opens the insert chooser from the plus, offering the pane's own list", async () => {
  const root = document.createElement("div");
  const layout = createShellLayout(root);
  const session = facade();
  layout.setBridge(bridgeStub({ session }), undefined);
  await Promise.resolve();

  const plus = root.querySelector<HTMLButtonElement>(".editor-shell-pane-bar-add");
  expect(plus?.getAttribute("aria-label")).toBe(uiCopy.rail.insertObject);
  expect(plus?.disabled).toBe(false);

  plus?.click();
  await Promise.resolve();

  // Both halves, read from the popover's own DOM and compared to the owner.
  expect(insertMenuGroups()).toEqual(groupsOf(insertGroups()));

  // The card arm, which no stub façade can fail for us.
  insertMenuEntry(uiCopy.panels.cards, uiCopy.cardLibrary.cpu)?.click();
  expect(session.insertCard).toHaveBeenCalledWith("group-cpu-card");
  // …and a primitive from the same menu, so "both" is one assertion, not two runs.
  insertMenuEntry(uiCopy.panels.shapes, uiCopy.shapeKinds.rect)?.click();
  expect(session.addShape).toHaveBeenCalledWith("rect");

  layout.destroy();
});
```

  `groupsOf` is the small reader the parity test needs too: `insertGroups()` mapped to
  `[label ?? null, objects.map((object) => object.label)]`, which is the shape
  `insertMenuGroups()` and `paneGroups()` already return.

- [ ] **Step 2: Run it and watch it fail.** `npx vitest run
      packages/editor/src/editor-shell/shell-layout.dom.test.tsx -t "opens the insert chooser"`.
      Expected: the `+` is present and enabled, the click opens nothing, and
      `.editor-shell-menu-popup[data-open]` is `null` — the exact present state.

- [ ] **Step 3: Build the popover and wire it.** `insert-popover.tsx` renders one Base UI
      `Menu`, mapping `insertGroups()`'s groups to `Menu.Group` + `Menu.GroupLabel` (the
      ungrouped entry standing alone, as the menubar's Insert group already renders it), and
      each object to a `Menu.Item` whose `onClick` is the four-arm switch over
      `addText` / `addShape` / `addChart` / `insertCard`. In `shell-layout.tsx`, hold the open
      state, pass it to `InsertPopover`, and delete `openInsertPopover`'s inert body and the
      `ponytail:` marker with it.

- [ ] **Step 4: Run it and the two neighbouring files.**

```
npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx packages/editor/src/editor-shell/pane-bar.dom.test.tsx packages/editor/src/new-object-panel.dom.test.ts
```

      Expected: all green, including the pre-existing `"inserts the same objects from the
      Insert menu as the Add pane offers"` — the menu is not this task's to change.

- [ ] **Step 5: Prove the test fails when the fix is disabled.** Re-inline
      `onInsert={() => undefined}` in `shell-layout.tsx`, re-run Step 2, and confirm it fails
      exactly there and nowhere else; then restore. A green run of a test for an inert button
      would have proved nothing.

- [ ] **Step 6: Commit.** `feat(editor): the + opens a chooser carrying both halves`

**As executed** (`577c44e5`, verified by the controller: 70/70 on the three files, break/restore
red on the named test alone, typecheck and biome exit 0). Two places the plan's own text was
wrong, corrected here so a later reader is not misled:

- **Step 1's `groupsOf` cannot be the literal mapping written above.** `insertGroups()` puts the
  lone Text group *second*, while `insertMenuGroups()` and `paneGroups()` both hoist every
  ungrouped entry *first* (`insertMenuGroups`, `shell-layout.dom.test.tsx:189`). The literal
  mapping therefore compares unequal to a correct popover. `groupsOf` hoists the same way. The
  comparison stays a set comparison, as this task's prose says — the price is that the ungrouped
  entry's *position* in the popover is not pinned by it, only its membership and the other three
  groups' order.
- **Review Focus 5 needs a second test and a mechanism this task did not name.** The Step 1 block
  pins only the with-session case. The refusal case is pinned by a second test, and the mechanism
  chosen is `disabled` on the `+` while `store.bridge === undefined`, carried by three optional
  `PaneBar` props (`addRef`, `addExpanded`, `addDisabled`) so the button stays the bar's own.

### Task 2: One mapping, every surface

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/insert-popover.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx`
- Modify: `src/web/packages/editor/src/editor-shell/canvas-context-menu.tsx` (prose only)
- Modify: `src/web/tests/e2e/editor-context-menu.spec.ts` (prose only)
- Test: `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx`

**Interfaces:**
- Produces: one exported entry-builder — the four-arm `insertItem` mapping that
  `shell-layout.tsx` holds today — living beside the popover that also renders it, so the
  menubar's Insert group and the popover are the same mapping rendered twice rather than two
  mappings that must be kept in step.
- Keeps: `canvas-context-menu.tsx`'s own `creationGroups`, which builds its entries from
  `insertGroups()` with a click handler rather than a DOM node; it is a fourth *rendering* of
  the owner and is not folded in. Only its comment changes.

**Constraints:** the three rendered surfaces agree as **sets of `[heading, labels]`**, which
is the comparison `shell-layout.dom.test.tsx:844` already makes between two of them. The
assertion is against `insertGroups()` read from the owner and against the other surfaces'
DOM — never against a literal list, which is the mistake that let the menu and the pane
diverge before. Both stale counts are corrected in this task, because they are claims about
this exact list: `canvas-context-menu.tsx:36` says *"five of the thirteen things the product
inserts"* and `editor-context-menu.spec.ts:7` says *"13 entries under two headings"*, while
`insertGroups()` answers **21 entries in four groups**. The history in the context menu's
comment is kept and its number dropped; the spec's present tense is corrected and its
"470px" claim left as measured-by-the-test rather than restated.

**Failure modes to design against:** a second mapping kept in step by hand, which is the
defect this task exists to delete rather than to add; an agreement assertion that compares
renderings to each other and never to the owner, which passes on four lists that all drifted
together; a count corrected in one of the two files and left in the other.

- [ ] **Step 1: Write the failing test** — extend the existing parity test to the popover, so
      the claim is the three seen surfaces rather than the two:

```tsx
  // Three surfaces, one owner: the pane, the menubar's Insert menu and the `+`.
  expect(insertMenuGroups()).toEqual(paneGroups(pane.root));
  expect(popoverGroups(root)).toEqual(paneGroups(pane.root));
  expect(popoverGroups(root)).toEqual(groupsOf(insertGroups()));
```

      where `popoverGroups(root)` reads `[heading, labels]` from the popup the `+` opened.
      Order the clicks so only one popup is open at a time; the file's `afterEach` Escape is
      what closes the previous one.

- [ ] **Step 2: Run it and watch it fail.** Expected: `popoverGroups` has no headings to read
      yet if the popover renders its own entries, or the count assertion below fails first.

- [ ] **Step 3: Move the mapping beside the popover** and have `shell-layout.tsx`'s Insert
      `MenuGroup` render through it. Correct the two stale counts.

- [ ] **Step 4: Run the file and the static checks.**

```
npx vitest run packages/editor/src/editor-shell/shell-layout.dom.test.tsx packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx
./node_modules/.bin/biome lint .. ; echo "exit=$?"
```

      Expected: tests green; `exit=0`, judged by the code and not by eye.

- [ ] **Step 5: Commit.** `refactor(editor): one insert mapping, four surfaces`

**As executed** (`b0e2eb73`, verified by the controller: 25/25 on the two files; breaking the
popover's group list with `.slice(0, 2)` reddens the parity line and two others; typecheck and
biome exit 0). One correction, and it changes what this task can claim:

- **Step 2's red cannot happen, and its prediction was wrong.** The extended parity assertion
  passes *before* Step 3, because Task 1's popover already reads `insertGroups()`. This task's
  refactor is behaviour-preserving, so no runtime assertion is red for it. **The consequence is
  that the test cannot pin the single-mapping claim.** Its discriminating power is against a
  *surface that drifts* — the break above proves that — and not against duplication: reverting to
  two equivalent mappings would still pass it. What pins one mapping is the source, where
  `insertItem` has exactly one definition; a reader looking for the guarantee should look there.

### Task 3: The chooser in a real browser, on the rebuilt bundle

**Files:**
- Create: `src/web/tests/e2e/insert-popover.spec.ts`
- Read (do not modify): `src/web/tests/e2e/editor-pane-bar.ts` for `openPane`

**Interfaces:**
- Consumes: the editor preview on `http://127.0.0.1:4174/` (`playwright.config.ts` starts it;
  `baseURL` 4173 is the *player*, which is not this spec's surface), the `+` by its class and
  accessible name, and the Add pane at `[data-vigilia-panel="add"]`.

**Constraints:** the run builds first — `npm run build` from `src/web/` — because Playwright
previews built bundles and a browser result on a stale bundle is not evidence. `--workers=1`,
never the shared MCP browser, and the result is read from the JSON report file (see Global
Constraints for the `--reporter=json` plus `PLAYWRIGHT_JSON_OUTPUT_NAME` pairing). No
screenshot is added and no `docs/evidence/screenshots/README.md` row is registered for this
task: the claim is which controls exist, in what state, and rendered DOM in a real browser is
the evidence — a picture of a button list is not.

**Failure modes to design against:** asserting a count instead of a comparison, so the spec
breaks the day a ninth card is added and proves nothing the day one is dropped; reading the
pane's text with `textContent` across the whole panel, which concatenates `Card` and the
button labels and hides a missing group; a spec that passes against the dev server rather
than the preview, which is a bundle the author never runs.

- [ ] **Step 1: Write the spec.**

```ts
import { expect, type Locator, type Page, test } from "@playwright/test";
import { openPane } from "./editor-pane-bar.js";

const EDITOR = "http://127.0.0.1:4174/";

/** The words neither half may be described by (spec `:537`). */
const REFUSED = ["fallback", "advanced", "basic", "simple", "expert"];

/** One surface's own groups, as headings and the labels under them. */
async function groupsOf(scope: Locator): Promise<readonly (readonly [string, readonly string[]])[]> {
  return scope.evaluate((element) =>
    Array.from(element.querySelectorAll<HTMLElement>("[role=group]")).map((group) => [
      group.getAttribute("aria-label") ?? "",
      Array.from(group.querySelectorAll<HTMLElement>('[role="menuitem"], button')).map(
        (item) => item.textContent?.trim() ?? "",
      ),
    ]),
  );
}

async function openChooser(page: Page): Promise<void> {
  const plus = page.locator(".editor-shell-pane-bar-add");
  await expect(plus).toBeEnabled();
  await plus.click();
}

test("the + offers units and primitives, neither greyed, neither a fallback", async ({ page }) => {
  await page.goto(EDITOR);
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();
  await openChooser(page);

  const popup = page.locator(".editor-shell-menu-popup[data-open]");
  // The standalone text entry plus the three headings, and every control enabled.
  await expect(popup.getByRole("menuitem")).not.toHaveCount(0);
  for (const item of await popup.getByRole("menuitem").all()) {
    await expect(item).toBeEnabled();
  }

  // The list is the pane's own list, read from the pane rather than restated: a
  // hard-coded count here is a spec that breaks on the day a card is added and
  // proves nothing on the day one is dropped.
  await openPane(page, "Insert");
  const pane = page.locator('[data-vigilia-panel="add"]');
  expect(await groupsOf(popup)).toEqual(await groupsOf(pane));
  for (const heading of ["Card", "Shape", "Chart"]) {
    await expect(pane.getByRole("group", { name: heading })).toBeVisible();
  }

  // Neither half is greyed, and neither is described as one.
  const spoken = (
    await pane.locator("legend, button").allTextContents()
  ).concat(await popup.getByRole("menuitem").allTextContents());
  for (const word of REFUSED) {
    expect(spoken.join(" ").toLowerCase()).not.toContain(word);
  }
});

test("a card inserted from the + arrives as a unit the tree can name", async ({ page }) => {
  await page.goto(EDITOR);
  await openChooser(page);
  await page
    .locator(".editor-shell-menu-popup[data-open]")
    .getByRole("menuitem", { name: "Clock", exact: true })
    .click();

  await openPane(page, "Layers");
  await expect(
    page.locator('[data-vigilia-layer="card-group-time-card"] .vigilia-layer-role'),
  ).toHaveText("Clock");
});
```

- [ ] **Step 2: Build, then run it and watch it fail on the rebuilt bundle.**

```
npm run build
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/insert-popover.json npx playwright test tests/e2e/insert-popover.spec.ts --project=desktop-chromium --workers=1 --reporter=json
```

      Expected against the pre-fix bundle: the second case fails at the layer row, because a
      card the pane inserted does carry a stamp — so if that case passes here and the first
      fails, the reader is telling you the build is stale. Read the JSON report file, never
      the console.

- [ ] **Step 3: Confirm the delivered half is what the failure is about**, by checking that
      the pane half of the first case passes on its own (`openPane(page, "Insert")` before
      any popover interaction). A spec that fails as a block tells you nothing about which
      half is unbuilt.

- [ ] **Step 4: Run it green after the fix, then re-run it.**

```
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/insert-popover.json npx playwright test tests/e2e/insert-popover.spec.ts --project=desktop-chromium --workers=1 --reporter=json ; echo "exit=$?"
```

      Expected: `exit=0`, and the JSON report file names both cases as passed. A single
      sample of a spec is not a measurement on a shared box — re-run before reporting one.

- [ ] **Step 5: Commit.** `test(editor): the + and its chooser, measured in a browser`

**As executed** (`3fba25c3`, verified by the controller: the spec is green on the controller's own
run, 2 expected / 0 unexpected, and **both cases go red on a rebuilt bundle with the `+`'s wiring
disabled** — so it is a real regression test and not a decorative one). Four corrections, all of
them the spec's code block having been written before Tasks 1–2 landed:

- **Step 1's `groupsOf` could never pass, and its selector is the reason.** It reads
  `[role=group]`, which matches **nothing** in the Add pane: `new-object-panel.ts:263-267` builds
  each group as a bare `<fieldset>` + `<legend>` with no `role` attribute, so the implicit role is
  invisible to a CSS selector, while Base UI's `Menu.Group` does set `role="group"` with
  `aria-labelledby`. The spec now reads each surface by its own shape — `legend`/`button` for the
  pane, `aria-labelledby`/`menuitem` for the menu — the same shape the two readers in
  `shell-layout.dom.test.tsx:188-250` keep.
- **The pane is shut at `goto`.** `shell-layout.tsx:381` opens on `"layers"`, so Step 1's first
  assertion failed before the chooser was involved. The spec opens the Insert pane first, and that
  also fixes the order: `openPane` with the menu already up would dismiss it on the outside press,
  so the block's `openChooser` → `openPane` sequence is unworkable even without the visibility
  line.
- **Step 2's predicted red is not reproducible, and its diagnostic points the wrong way.** This
  task writes no product code, so on a fresh bundle the *second* case passes — an inserted copy is
  stamped by `instantiateCard` (`card-library.ts:250`). Step 2 says "if that case passes here and
  the first fails, the reader is telling you the build is stale" — but that is exactly what a
  **correct, fresh** build produces here. The red this task actually got came from the block's own
  selectors, not from the product. **Read Step 2's diagnostic as inverted**, and take the break
  proof above as what pins the spec.
- **Two additions the block omits**, both required by its neighbours: the `isDesktopSurface` guard
  every other pane-bar spec carries (`editor-pane-bar.spec.ts`, `panel-labels.spec.ts`), and a
  `popupOf` locator. `pane.getByRole("group", { name: heading })` did work as written — Playwright
  maps `fieldset` to `group` named by its `legend`.

---

## Phase 2 — A starter card is the unit it is

The reference composition is the document every author meets first, and every card row on it
reads `Group` — the bare arm — while `metric card` is reachable only on a document the author
built by inserting one. The spec's §5 sells units as *the* way a card is: *"a copy arrives
with fresh ids, remapped bindings preserving semantic keys, and recorded provenance"*. The
starter's cards are not copies; they are the originals, and they are the only cards in the
product that cannot say what they are. Phase 2 writes the key they are missing and corrects
the two docstrings that argue the absence is right.

### Task 4: The decision, recorded

**Files:**
- Create: `docs/decisions/0031-a-starter-card-is-authored-as-its-unit.md`
- Modify: `docs/superpowers/specs/2026-10-03-dashboard-authoring-design.md` (§5, its first
  bullet, `:364-365`)

**Interfaces:**
- Produces: a decision note whose `Paths:` bullet claims
  `src/web/packages/editor/src/editor-shell/layer-tree.ts` — the one watchlisted path in
  Phase 2 that no existing note claims.
- Consumes: nothing. This task writes no product source.

**Constraints:** the note follows `docs/decisions/README.md`'s template, and **the searches
are the evidence** — a rung that found nothing is recorded as having found nothing. Rung 4 is
the one this plan cannot pre-answer: run the queries and record what they show, including a
dead end. Rungs 1–3 are already measured and should be recorded as such:

- **Rung 1 — Vigilia.** Searched `provenance` across `src/web/packages` (12 files), plus
  `CARD_LIBRARY`, `insertGroups`, `groupRole`, `cardGroup`, `ShapeKind` label ownership.
  Found: the stamp is written on the insert path only (`card-library.ts:250`), the starter's
  builders write none, `layer-tree.ts:280-291` documents that as deliberate, and
  `new-fabric-theme.test.ts:352-380` pins the starter's names-equals-ids convention.
- **Rung 2 — dependencies.** Searched Fabric 7.4.0's unknown-property handling and the
  persisted-key list. Found: `PERSISTED_EXTRA_PROPERTIES` names `provenance` explicitly
  (`scene-fabric/src/persist.ts:71-77`), and `card-library.test.ts:296-311` already proves the
  key survives a save and a reopen — so no library decision is involved.
- **Rung 3 — platform.** Nothing native to use; the platform question is only whether Fabric
  restores a key it did not author, and rung 2's passing test answers it with a measurement
  rather than an argument.
- **Rung 5 — comparison.** The three candidate owners, with the verdict the note must argue:
  the **library assembling the starter's scene** (rejected: `card-library.ts:16` already
  imports `createNewFabricTheme`, so `new-fabric-theme.ts` consuming `CARD_LIBRARY` closes a
  cycle between the theme assembler and the card library — a module-graph knot for one line
  of authored state); the **card's own assembler** `cardGroup` (chosen: provenance is
  authored state, so it is written where the card's other authored state is written, and the
  unit's *word* keeps its single owner in `uiCopy.cardLibrary`, read by both the builder and
  the library — the shape `SHAPE_KINDS` + `uiCopy.shapeKinds` + `new-object-defaults.test.ts:626`
  already uses); the **projection deriving it** (rejected: `groupRole` would then name a unit
  the document does not hold, which is the one thing a mark must never do and which
  `chartMark` already refuses for an unknown family).
- **Rung 6 — probe.** Record the gate's own exit codes, which are the runnable half of this
  decision:

```
cd D:/git-repos/vigilia
printf '{"tool_input":{"file_path":"src/web/packages/editor/src/editor-shell/layer-tree.ts"}}' | node scripts/reuse-gate.mjs ; echo "exit=$?"
```

  Expected before the note is written: `exit=2`, refused. After: `exit=0`.

**And the spec's §5 names a builder the code deliberately does not use.** It says the card
library is *"built on `instantiateWidget`"* (`:364-365`), while `card-library.ts:31-60` argues
at length that it is the Fabric-shaped half of that algorithm and borrows only
`createWidgetIdAllocator`, because bridging the two models would mean standing up a second
scene tree — the thing §*Invariants* forbids at `:499`, and §5's own §77/§139 citations do not
require. The properties the sentence promises (fresh ids, remapped bindings preserving
semantic keys, recorded provenance) are all true of `instantiateCard`. **Correct the clause,
change no requirement**, and let the note be the authority for it: a reader who took the
sentence literally would rebuild the copy path as a second scene tree, which is the expensive
kind of wrong this repo's decision notes exist to prevent.

**Failure modes to design against:** a note that lists three alternatives and says what was
searched nowhere; a `Paths:` bullet without the backticks the gate reads, which leaves
`layer-tree.ts` refused and blocks Task 6 with no visible cause; the spec edit widening from a
symbol name into a requirement.

- [ ] **Step 1:** Run the rung-1 to rung-3 searches as stated above and the rung-4 queries;
      record each result, including the rungs that found nothing.
- [ ] **Step 2:** Run rung 6's command and record `exit=2` as the state before the note.
- [ ] **Step 3:** Write the note. Its `Paths:` bullet claims
      `` `src/web/packages/editor/src/editor-shell/layer-tree.ts` ``, indented onto the
      continuation line the gate reads.
- [ ] **Step 4:** Re-run rung 6's command. Expected: `exit=0`. A note that does not unblock
      the path it claims is a note the gate will refuse again in Task 6.
- [ ] **Step 5:** Correct §5's clause to name `instantiateCard` and to say what the copy
      borrows `widgetId` allocation from. Touch nothing else in the section.
- [ ] **Step 6: Commit.** `docs(decisions): a starter card is authored as its unit`

### Task 5: The starter's cards carry the unit they are

**Files:**
- Modify: `src/web/packages/editor/src/new-fabric-theme-objects.ts` (`cardGroup`)
- Modify: `src/web/packages/editor/src/new-fabric-theme-cards.ts` (the eight builders)
- Test: `src/web/packages/editor/src/card-library.test.ts`
- Test: `src/web/packages/editor/src/new-fabric-theme.test.ts`

**Interfaces:**
- Produces: `cardGroup(id, unit, panel, parts)` — the unit's own name as a second parameter,
  stamped as `provenance: { widgetId: id, widgetName: unit }` on the group it returns, typed
  `WidgetProvenance` from `renderer-core` so the document's own type is the authority for the
  key's shape.
- Consumes: `uiCopy.cardLibrary` (its one owner) — `clockCard()` calls
  `cardGroup("group-time-card", uiCopy.cardLibrary.time, …)`.

  **There are seven `cardGroup` call sites, not eight, and the difference is `memoryCard`.**
  Measured at `31956d2c`: `clockCard` (`:98`), `cpuCard` (`:151`), `gpuCard` (`:210`),
  `memoryCard` (`:283`), `trendsCard` (`:418`), `storageCard` (`:457`) and `networkCard`
  (`:525`) call it; `ramCard` (`:374`) and `vramCard` (`:388`) both delegate to the shared
  `memoryCard(options)` instead. So **`memoryCard` must take the unit label as a new `options`
  member**, and `ramCard`/`vramCard` pass `uiCopy.cardLibrary.ram` / `…vram` through it — the two
  cards differ only in that option, and hardcoding either word inside `memoryCard` would be the
  second owner this task exists to avoid. Eight **cards**, seven **call sites**: a stamp applied
  once per call site is right, and a plan read as "eight builders each pass a literal" produces a
  shared builder that cannot name either of its two cards.

**Constraints:** the stamp goes on the **root alone**, which is `instantiateCard`'s own rule
(`card-library.ts:152-157`) and the reason a deep card does not triple in size to say one
thing. `cardGroup` is the card's assembler — "the card, and the only place that says a panel
is made of glass" — so it is where the card's remaining authored fact belongs; it is not a
generic group helper, and its seven call sites are all in `new-fabric-theme-cards.ts`. The
unit's *word* stays owned by `uiCopy.cardLibrary`, and the *membership* by `CARD_LIBRARY`;
this task adds a **pin** that the two agree rather than a third statement nobody checks — the
agreement `card-library.test.ts:142-166` already asserts for ids. Do not change the starter's
`name` fields: names stay equal to ids (Out of scope, above).

**Ownership ruling, decided here and not left to the executor.** This change needs **no new
row** in `docs/architecture/ownership.md`, and displaces none. The vocabulary — which units
exist, and what each is called — stays owned by `CARD_LIBRARY` (membership) and
`uiCopy.cardLibrary` (words); `cardGroup` gains a
*parameter*, not a decision. `new-object-panel.ts`'s "The Add panel's construction actions"
row is untouched, and `new-object-defaults.ts`'s "New-object defaults … and the shape list"
row is the precedent for the split rather than a second owner of it. If a reviewer concludes
that a module which assembles the starter's cards ought to be on the map at all, that is a
**separate** finding about the map's gaps — file it, do not widen this task.

  **That gap is not hypothetical, and this task's earlier premise for the ruling was wrong.**
  Measured at `31956d2c`: `docs/architecture/ownership.md` names neither `CARD_LIBRARY` nor
  `uiCopy.cardLibrary`. Its only mention of the module is `:114`, and that row is about
  `createWidgetIdAllocator` — `card-library.ts` appears there as a **user** of the id rule, not
  as an owner of the unit vocabulary. So "the two rows that already answer for it" was false.
  **The ruling stands on its second half, not its first**: no row is added here, and the gap is
  filed as `vg-162` for the controller rather than widened into this task.

**Failure modes to design against:** a stamp on every descendant; a stamp whose `widgetId` is
not the group id, which is what `CARD_LIBRARY`'s entry shares with the copy a later insertion
makes; a malformed stamp that `validateProvenance` refuses (`validate.ts:880`), leaving a
document that looks right and cannot be saved; a unit label re-spelled in the builder instead
of read from `uiCopy.cardLibrary`, which is the second owner the shape-list precedent exists
to avoid.

- [ ] **Step 1: Write the failing test** — extend `card-library.test.ts`'s `"offers one unit
      per card the starter itself draws"`, which already walks the starter's groups against
      `CARD_LIBRARY`:

```ts
  // The pair the library offers is the pair the starter's own card carries: the
  // row on the reference composition and the row a copy makes are the same fact.
  for (const card of cards) {
    const unit = CARD_LIBRARY.find((entry) => entry.id === card.id);
    expect(card.provenance, `${card.id} carries no stamp`).toEqual({
      widgetId: unit?.id,
      widgetName: unit?.label,
    });
  }
  // And nothing else in the starter claims to be a unit — a loose label, a part
  // inside a card, and the rest of the composition all read as themselves.
  for (const object of objects) {
    if (object.type === "Group") continue;
    expect(object.provenance, `${object.id} is not a unit`).toBeUndefined();
  }
```

      with `objects` walked at every depth, and `cards` the top-level groups — the distinction
      is what Review Focus 1's "a part is not a unit" rests on.

- [ ] **Step 2: Run it and watch it fail.**
      `npx vitest run packages/editor/src/card-library.test.ts -t "offers one unit per card"`.
      Expected: eight failures naming `group-time-card` … `group-network-card`, each
      `carries no stamp`.

- [ ] **Step 3: Write the pin that the fact is in the file** — extend `new-fabric-theme.test.ts`'s
      `"persists those names in the saved package, not at load time"`, which already walks
      `theme.json`'s persisted nodes (its `walk` and `nodesOf` helpers are there):

```ts
    // The stamp is authored state too (§67): a stamp the editor added on the way
    // in would be runtime state wearing an authored hat, and it would vanish the
    // first time this document was opened somewhere that derives its own rows.
    for (const unit of CARD_LIBRARY) {
      const card = persistedNodes.find((object) => object["id"] === unit.id);
      expect(card?.["provenance"], `${unit.id} lost its stamp in the file`).toEqual({
        widgetId: unit.id,
        widgetName: unit.label,
      });
    }
```

- [ ] **Step 4: Implement.** Give `cardGroup` the unit parameter, stamp the root, type it
      `WidgetProvenance`, and pass `uiCopy.cardLibrary.<card>` from each of the eight builders.
      Then run:

```
npx vitest run packages/editor/src/card-library.test.ts packages/editor/src/new-fabric-theme.test.ts
npm run typecheck ; echo "typecheck exit=$?"
```

      Expected: green, and `typecheck exit=0` judged by the code and not by eye. The
      starter's existing validity assertion (`new-fabric-theme.test.ts:384`) is the one that
      catches a malformed stamp — if it goes red, the stamp is wrong, not the assertion.

- [ ] **Step 5: Prove both new assertions fail when the fix is disabled.** Delete the
      `provenance` key from `cardGroup`'s return, re-run Steps 2 and 3, and confirm each fails
      by name; then restore. A pin that passes with the fix removed is a pin on the fixture.

- [ ] **Step 6: Commit.** `feat(editor): a starter card carries the unit it is`

### Task 6: The rows, in the projection and in a browser

**Files:**
- Modify: `src/web/packages/editor/src/editor-shell/layer-tree.ts` (docstrings only — the
  behaviour already reads the stamp)
- Modify: `src/web/packages/renderer-core/src/theme/document.ts` (`WidgetProvenance`'s
  docstring)
- Test: `src/web/packages/editor/src/editor-shell/layer-tree.test.ts`
- Test: `src/web/tests/e2e/composition-panel.spec.ts` (extend)
- Replace: `STATUS.md`'s "Last completed change" — **added after Task 5**, because this plan's
  earlier tasks omitted it and AGENTS.md requires it before each completed task's commit. Task 7
  owns the close-out rewrite; this is the per-task one. Run `npm run status:check` from `src/web/`
  and read its exit code.

**Interfaces:**
- Consumes: `LayerRole`'s group arm and `groupRole()` as they already are; the starter's new
  stamps from Task 5; `reviveThemeEnvelope` and the `starter()` helper already in
  `layer-tree.test.ts:652-776`.
- Produces: nothing new. **No production behaviour changes in this task** — a row's `unit`
  already comes from the document, and the document now says it.

**Constraints:** the docstrings corrected are exactly two, and each is *made false* by Task 5:
`layer-tree.ts:280-291` ("the starter's own builders do not, so on the starter every card row
is the bare arm") and `:65-67` (the type's group arm, same claim). `document.ts:228`'s
"Origin metadata for an **inserted** widget copy" is true of neither end once the starter's
own cards carry it, so it is corrected in the same change — `AGENTS.md` requires a moved owner
to move with its map and docs, and this is the owner's own statement of what the key means.
`layer-tree.ts` is 478 lines, 22 from the signal: this task's edits are comment-only and must
leave the count no higher. `renderer-core/src/theme/document.ts` is claimed by decisions
0022/0023/0028 — verified, the gate allows it; `layer-tree.ts` is allowed only by Task 4's
note.

**Failure modes to design against:** a docstring corrected to a claim that is not yet true,
which is why this task follows Task 5 rather than preceding it; a third, subtler statement
left behind — `scene-fabric/src/persist.ts:71-77` calls the value *"Which unit an inserted card
was copied from"*, which is now incomplete but not false; it is claimed by decisions 0003,
0026 and 0027, so if it is amended, amend it as **the unit a card was authored as, on the
starter and on a copy**, and not by inventing a second meaning.

- [ ] **Step 1: Write the failing test** — in `layer-tree.test.ts`'s `"the starter theme"`
      block, whose `starter()` helper already revives the reference composition:

```ts
  it("names the unit on every card row, and nothing else anywhere", async () => {
    const roots = await starter();
    const rows = projectLayers({ ...base, root: roots });

    // THE row this plan exists for: on the composition every author meets
    // first, a card says which card it is rather than the bare group arm.
    expect(
      rows
        .filter((row) => row.role.kind === "group")
        .map((row) => (row.role.kind === "group" ? row.role.unit : undefined)),
    ).toEqual(CARD_LIBRARY.map((unit) => unit.label));

    // The two loose labels are not units and must not borrow one, and no part
    // inside a card carries a stamp of its own.
    expect(rows.filter((row) => row.role.kind !== "group").map((row) => row.role.kind))
      .toEqual(expect.arrayContaining(["text"]));
    expect(rows.filter((row) => row.kind === "group" && row.depth > 0)).toHaveLength(0);
  });
```

      plus the Review Focus 4 case in the same block: two cards from one unit, revived
      together, report the same `unit` and different `id`s.

- [ ] **Step 2: Run it and watch it fail** — the assertion is red before Task 5 and green
      after it, so **prove it the other way round**: re-remove the stamp from `cardGroup`
      (Task 5 Step 5's break), re-run, and confirm this test fails naming the eight units;
      then restore. That is the only way this pin is known to be load-bearing.

- [ ] **Step 3: Correct the two docstrings** in `layer-tree.ts` and the one in `document.ts`.

- [ ] **Step 4: Pin Review Focus 2 — the projection reads the document, not the library.**
      `layer-tree.test.ts:888-921` already asserts that a stamp whose `widgetId` matches no
      unit in this build still reports its own `unit`; keep it green and say why it is now
      load-bearing (in its own comment). Add the shape assertion beside it, in the idiom plan 4
      used for the kind vocabulary:

```ts
  it("owns no unit vocabulary of its own", () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "layer-tree.ts"),
      "utf8",
    );
    // The projection reports what the document holds; resolving a name through
    // the library would be a second owner of the unit's words, and it would make
    // a document written by another version read as a document this build
    // recognises.
    expect(source).not.toMatch(/card-library/);
  });
```

- [ ] **Step 5: Extend `composition-panel.spec.ts`** — the file that owns the row's role and
      whose registered capture this change alters. Two rendered cases: on the untouched
      starter, `[data-vigilia-layer="group-cpu-card"] .vigilia-layer-role` reads `CPU`; after
      inserting a Clock card from the `+`, there are two rows naming the unit with different
      ids — the copy's own and the starter's, which has not lost its stamp. Rebuild first and
      read the JSON report:

```
npm run build
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/composition-panel.json npx playwright test tests/e2e/composition-panel.spec.ts --project=desktop-chromium --workers=1 --reporter=json
```

- [ ] **Step 6: Commit.** `docs(editor): the projection's words match the document it reads`

**As executed** (`e5d1ad38`, verified by the controller: 52/52 on `layer-tree.test.ts`; the
stamp removed reddens the row test naming all eight units; `layer-tree.ts` is 478 lines before
and after; typecheck and biome exit 0). Two more corrections, and one leftover this task
deliberately did not chase:

- **Step 1's assertion cannot pass as written, and it is the plan's seventh wrong claim.** It
  compares the card rows to `CARD_LIBRARY.map((unit) => unit.label)` in order, but `projectLayers`
  walks `[...objects].reverse()` (`layer-tree.ts:378`, `:431`, `:466`) while the starter authors
  its cards in `CARD_LIBRARY` order — so the rows come back Network→Clock and the comparison is
  against paint order, not library order. The test keys rows by id instead, which is the stronger
  assertion anyway: it pins *which* id got *which* unit rather than that some sequence matches.
- **Step 1's comment did not describe what its code measured.** Under `{ ...base }` nothing is
  expanded, so parts are not rows at all and the "no part inside a card carries a stamp" filter is
  vacuously empty. The test now expands every card first, and the non-group assertion requires
  `shape` and `chart` as well as `text`.
- **Left alone, deliberately, for Task 7:** the same sentence lives in **two** more places the
  plan never named — `scene-fabric/src/persist.ts:71` and, verbatim,
  `scene-fabric/src/persist.dom.test.ts:1292-1294`, both *"Which unit an inserted card was copied
  from (§77)"*. Neither is false, both are now incomplete, and neither is in this task's File
  block.

### Task 7: Close out

**Files:**
- Modify: `STATUS.md` — its "Last completed change" **and** its Active work, which Task 6 left
  saying "Task 6 still owns correcting `layer-tree.ts:280-291`" after Task 6 had done it
- Modify: `src/web/packages/scene-fabric/src/persist.ts` (`:71`) and
  `src/web/packages/scene-fabric/src/persist.dom.test.ts` (`:1292-1294`) — **added after Task 6**,
  which found the sentence in both places and left them alone because they were outside its File
  block. Both say *"Which unit an inserted card was copied from (§77)"*; Task 5 made that
  incomplete, and the plan's own wording is what replaces it: **the unit a card was authored as,
  on the starter and on a copy**. Amend both to that and invent no second meaning. `persist.ts` is
  claimed by decisions 0003, 0026 and 0027 — check the gate before writing and report a refusal
  rather than working around it.
- Read: `docs/evidence/screenshots/README.md` (the registered capture, reused rather than added)

**Interfaces:** none. This task produces evidence, not code.

**Constraints:** the broad gate runs here, at the plan boundary, and only here —
`format:check`, `lint` (`./node_modules/.bin/biome lint ..`), `typecheck` (by exit code),
`build`, the full unit suite, and the browser suite `--workers=1` with its results read from
the JSON report file. `npm run status:check` runs from `src/web/` before the `STATUS.md`
commit, and `STATUS.md`'s "Last completed change" is **replaced** with a 1–5 bullet summary of
this plan's commits — one item per line, never wrapped, and the file's existing bullet limits
are the limit. Findings this plan did not fix ride its commits as trailers.

- [ ] **Step 1: Run the registered capture for the surface this plan changed.** The action is
      already registered — *"Composition panel | The row's role, mark and bound key, with a
      card entered | `composition-panel-starter`"*
      (`docs/evidence/screenshots/README.md:47`) — and its image changes because the starter's
      card rows now name their units:

```
cd src/web
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "carries the document's binding" --workers=1
```

      Expected: the capture is re-taken on the bundle Task 6 built, and the image is inspected
      rather than assumed — the role column reads `CPU`, not `Group`, on the card rows. **No
      capture row is added**: the acceptance's evidence is which controls exist and in what
      state, and a picture of a menu's entries adds nothing a rendered assertion does not
      already pin.

- [ ] **Step 2: The broad gate.**

```
cd src/web
npm run format:check ; echo "format=$?"
./node_modules/.bin/biome lint .. ; echo "lint=$?"
npm run typecheck ; echo "typecheck=$?"
npm run build ; echo "build=$?"
npx vitest run ; echo "unit=$?"
PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/units-alongside-primitives.json npx playwright test --workers=1 --reporter=json ; echo "e2e=$?"
```

      Every exit code is read from the shell, never from a transcription of the log, and the
      browser result from the JSON report file. Report anything not actually verified.

- [ ] **Step 3: File what this plan found and did not fix**, as trailers on the close-out
      commit and materialised rows from them:
      - `Found by the user, not fixed: the spec's §5 primitive list names video, and no object
        kind can carry one — isPlaceable (asset-manager/panel.ts:232-236) accepts image and svg
        only, so an MP4 is declared and never placed.` (`vg-154`'s fix site; plan 5 added no
        asset surface.)
      - `Discovered, not fixed: plans/2026-10-03-editor-left-column-and-header.md is in the
        live plans directory, is named nowhere in plan-queue.md, and its remaining tasks (the
        Insert and View menu removals) have no queue entry.` — a ledger gap for the controller,
        recorded here because compaction cannot reconstruct it.

- [ ] **Step 4: Replace `STATUS.md`'s "Last completed change"** with this plan's 1–5 bullets —
      one line each — and run `npm run status:check` from `src/web/`. Expected: exit 0.

- [ ] **Step 5: Commit.** `docs(status): units alongside primitives lands, and the + offers both`

---

## Self-review

Run against the spec with fresh eyes after the tasks above were written.

1. **Spec coverage.** §5's two bullets: *"Units — the card library, built on
   `instantiateWidget`, so a copy arrives with fresh ids, remapped bindings preserving
   semantic keys, and recorded provenance"* — the copy path's ids and bindings are landed and
   pinned (`card-library.test.ts:171`), its provenance is landed and now also on the starter
   (Tasks 5–6), and the mechanism sentence is corrected (Task 4). *"Primitives — text, shape,
   chart, image, video, exactly as today"* — text, shape and chart are in `insertGroups()` and
   reachable from four surfaces (Tasks 1–3); image and video are `vg-154`'s and are named in
   Out of scope with the reason. *"Neither is the fallback for the other"* — pinned at
   `new-object-panel.dom.test.ts:532` and re-proved in a browser (Task 3). Acceptance `:537`
   is Task 3's first case, read against the pane rather than against a literal list.
2. **Nothing rebuilt.** The list, its owner, the pane's sections, the three surfaces'
   insertion wiring and the copy path are listed in *What is already true* with their pins,
   and no task touches them except to add a rendering and to correct two counts.
3. **Placeholder scan.** No "TBD", no "similar to Task N", no step that says what to do
   without showing how. Task 1's `groupsOf`, Task 3's `groupsOf` and `openChooser`, and Task
   6's readers are each written where they are first used, and Task 2's `popoverGroups` is
   named as the reader to add beside the two it sits between.
4. **Type consistency.** `CardUnit`/`CARD_LIBRARY`/`insertGroups()`/`InsertGroup`/
   `InsertableObject` are used as `card-library.ts` and `new-object-panel.ts` declare them;
   `EditorActionFacade`'s four constructors are used with the arities
   `session-facade.ts:17-23` declares them; `LayerRole`'s group arm is read, never re-declared;
   `WidgetProvenance` is the type of the stamp Task 5 writes.
5. **Review Focus.** Five lines, each naming the task that pins it, and each pin is written
   in that task's own step style. The one that could not be a pin-before-fix — Task 6's
   starter rows — says how it is proved instead of pretending the order was TDD.
