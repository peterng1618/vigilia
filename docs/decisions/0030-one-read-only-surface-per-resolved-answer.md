# 0030 — One read-only surface per resolved answer: the Style tab is deleted, not taught to agree

- **Date:** 2026-10-07
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/selection-inspector/style.ts`

## The problem

`style.ts` is the editor's read-only "what does this resolve to" surface. One
component holds two modes, chosen by one condition — `active === undefined`
(`style.ts:96`) — and renders, for a selection, the palette tokens and type
preset that selection is painted with; for the document (nothing selected), every
token and preset the document offers (`documentGlobals`, `style.ts:46-79`).

The shape of the problem is not "render the resolution" — three pure helpers in
`appearance.ts` already do that. It is **how many surfaces answer that one
question, and who owns the answer**. A second read-only surface renders the same
lines from the same helpers today: the selection inspector's right-hand column,
whose Spends section (`per-kind-column.ts:551-614`) calls `createResolutionLine`,
`nameOfRef`, `resolveToken`, `resolveTypePreset`, `paintReferencesOf` and
`typePresetOf` — the exact functions `style.ts` imports from `appearance.ts`.
Two surfaces, one fact, and they have already disagreed: `vg-146`
(`docs/product/backlog.jsonl`, line 35) measured that with a group selected the
Style tab renders **no** resolution line while the column renders the children's
effective appearance. Two read-only doors to one answer is a surface that can
drift, and this one did.

The decision this note records is already ruled; the note is its record. The
panel's **document** mode relocates into the editor's left column as a Document
pane, and its **selection** mode is **deleted**. This is a move and a deletion,
not a repair, and the rest of the note is why that is the right ruling and not
merely the tidy one.

**The repo had already decided the panel is read-only, by name, twice.**
`style.ts:19-22`'s own header: *"Read-only by design. Every value here is edited
in Design, where the selection it belongs to is visible; a second editable copy
would be a second owner."* The redesign spec says the same of the References
section it became: read-only, "about a different question from 'what can I set'"
(`docs/superpowers/specs/2026-10-02-frontend-redesign-design.md:229-232`). So the
question was never "should it be editable" — it is settled that it is not. The
open question is how many *read-only* doors one answer may have.

## Rung 1 — Vigilia

Searched: `style.ts` in full (the `createStylePanel` factory, `StylePanelOptions`,
the `documentGlobals` renderer, the `render` closure, the four Fabric events it
subscribes to); every consumer of the helpers it imports — `appearance.ts`
(`createResolutionLine:206`, `nameOfRef:117`, `resolveToken:140`,
`resolveTypePreset:178`, `paintReferencesOf:45`, `typePresetOf:170`), style.ts and
`per-kind-column.ts` in full; `panel.ts:343` (the one other `resolveToken`
caller); `style.dom.test.ts`; `editor-session.ts:63,185,387` (where the panel is
built and owned); `ownership.md`; and `rg` over `src/web` for the six helper names.

Found: **one owner already renders the same lines, and the panel is a second
reader of it.** `per-kind-column.ts`'s `spendsBody` (`:551-614`) and
`childrenResolution` (`:513-547`) call the identical six helpers; `style.ts`'s
`render` (`:101-119`) calls them too. `createResolutionLine` is a single function
(`appearance.ts:206`) — both surfaces produce the same `<p class="vigilia-resolution"
data-vigilia-resolution="…">` element, so the duplication is literal, not
stylistic. The call sites, exactly:

- `createResolutionLine` — 4 in `style.ts` (`:61, :70, :103, :114`), 6 in
  `per-kind-column.ts` (`:533, :540, :564, :580, :585, :602`).
- `resolveToken` — `style.ts:61, :106`; `per-kind-column.ts:536, :588`; and one
  non-display caller, `panel.ts:343`, which resolves a token to build a Fabric
  `Shadow` colour on a write path, not to draw a line.
- `resolveTypePreset` — `style.ts:73, :117`; `per-kind-column.ts:543, :605`.
- `nameOfRef` — `style.ts:105, :116`; `per-kind-column.ts:535, :542, :587, :604`.
- `paintReferencesOf` — `style.ts:101`; `per-kind-column.ts:524, :576`.
- `typePresetOf` — `style.ts:111`; `per-kind-column.ts:527, :595`.

**What the panel reads, and how.** It takes `globals: () => FabricGlobals |
undefined` (`StylePanelOptions`, `style.ts:31`) — a thunk, not a value, and the
header says why: the panel is mounted for the session and never writes, so
pulling the current `FabricGlobals` on each render cannot show a stale copy
(`style.ts:26-31`). `FabricGlobals` is the `@vigilia/renderer-core` theme
envelope; the panel reads `.palette` (as `FabricPalette`) and `.typePresets`
directly in `documentGlobals` (`style.ts:54-76`), skipping the `"none"` palette
id (`style.ts:56`) because it is the absence of a token, not one. The helpers
resolve against that same envelope. So the panel's inputs are two globals maps
and the active Fabric object, and its output is DOM it never reads back.

**The ownership row already exists.** `ownership.md:99` gives "The Style tab
(resolved references, document globals)" to `editor/src/selection-inspector/style.ts`.
The right column's Spends section has **no** row — it is a facet of the
selection-inspector surface (`ownership.md:98`), not a separate owner — so the
two surfaces are one row and one facet, not two owners, and the drift between
them was invisible to the map.

**The asymmetry that decides it is in the code.** For a container,
`spendsBody` branches on `questions.childrenAppearance` (`per-kind-column.ts:556`),
which is `true` for `group` and `activeSelection` (`KIND_QUESTIONS`,
`:153-154`), and walks `descendantsOf` (`:498`), deduplicating by reference in
`childrenResolution` (`:520-529`) so a card whose five labels share one token
resolves to that one token once. `style.ts` has no such branch: it calls
`paintReferencesOf(active)` (`:101`) and `typePresetOf(active)` (`:111`) on the
container object itself, and a group carries no `vigiliaPaint` and no text run,
so both return nothing and the panel renders an empty `<section>`. The column
answers the group; the tab answers nothing. **For a group or a multi-selection
the column renders more, not less** — which is why the fix is to delete the
second door rather than teach it to agree.

The blank case has no unit test: `style.dom.test.ts` pins a text selection
(`:41`), nothing selected (`:65`), globals changing after mount (`:73`) and a
`Rect` selection (`:89`) — never a `Group` or an `ActiveSelection`. That is why
the blank panel shipped.

## Rung 2 — dependencies

Searched: `src/web/package.json`, `packages/editor/package.json`,
`docs/engineering/dependencies.md` (declared table, vendored list), and
`THIRD-PARTY-NOTICES.md`'s index.

Found: **nothing, and nothing is proposed.** The editor's installed set is
`@base-ui/react`, `@radix-ui/react-popover`, Tailwind + `@tailwindcss/vite`,
`clsx`, `class-variance-authority`, `tailwind-merge`, `react`/`react-dom` 19,
`fabric`, `echarts`, `lucide-react`, and the three `@vigilia/*` workspace
packages; the workspace root adds `@biomejs/biome`, `vite`, `typescript`,
`vitest`, `@playwright/test`, `jsdom`, `canvas`, `@types/node`. There is no
design-token graph library, no theme-resolution package, no schema/inspector
renderer — nothing that resolves a token to a value or draws a read-only
resolution view. The resolution is three pure functions (~90 lines) over
`FabricGlobals`, and the panel body is hand-built DOM with no React. The editor's
own `package.json` carries the standing note: *"Still no UI framework: one is
worth adding when the inspector surface is real enough to judge the trade."*
Deleting a surface is not the moment to judge that trade, and adding a library to
render two globals maps would be a dependency solving ~90 lines and a deletion.

## Rung 3 — platform

Searched: the DOM's own resolution surfaces — `Window.getComputedStyle()`, CSS
custom properties and `getPropertyValue`, and the `<details>`/`<summary>`
disclosure — and `Element.replaceChildren`/`dataset`, which the panel already
uses (`style.ts:91, :48, :86`).

Found: the platform gives a **live read-only resolved-values object** for an
element (`getComputedStyle()` returns resolved values that update as the element
changes, and is the exact mechanism behind Chrome DevTools' Computed pane — see
rung 4). It also gives CSS custom properties, a cascade, and a disclosure
element. **None of it can see our data.** `getComputedStyle` computes the CSS
cascade of a *DOM node*; the thing being resolved here is a node in a theme
graph (`FabricGlobals.palette`, `.typePresets`) that exists only in the editor's
memory and resolves through `appearance.ts`'s own rules — a `palette.`/`typePresets.`
prefix, a `{kind:"gradient"}` case that collapses to the word "gradient", a
`"none"` id that is skipped, a dangling reference that must print as unresolved
rather than blank (`appearance.ts:158-163`, `style.ts:56`, `createResolutionLine:220-226`).
So the platform provides a *shape* worth copying — a resolved view distinct from
the authored one — and leaves the entire graph, the naming, the fallback policy
and, the actual question here, **which surface renders it and when** to us. The
platform has no concept of "this selection has no references of its own but its
children do"; that branch is ours, and it is the branch the tab is missing.

## Rung 4 — ecosystem

The searches are the evidence. Five queries were run through the Exa web search;
the queries and what they returned are recorded so the sweep is re-runnable.

**Query 1 — `how design tools present read-only derived token resolution for a
selected element, devtools computed styles panel`.** Read: Chrome's *CSS features
reference* (`developer.chrome.com/docs/devtools/css/reference`) and *Find
invalid, overridden, inactive CSS* (`/devtools/css/issues`), plus CSS-Tricks'
*Computed Values: More Than Meets the Eye*. **Found: the canonical precedent for
two panes over one selection, and it is two panes only because they answer two
*different* questions.** DevTools' **Styles** pane "displays the exact rulesets…
exactly as they were written", overridden declarations included; the **Computed**
pane "lists resolved CSS values that Chrome uses to render an element". They are
not kept in sync and are not meant to be: one is the authored cascade, the other
the applied result, and Chrome's own guidance is to use Computed *when you don't
want the overridden declarations*. **How its shape compares to ours:** our two
surfaces answer the **same** question — "what does this selection resolve to" —
from the **same** helpers, so they are not the Styles/Computed pair; they are two
Computed panes. And a StackOverflow question (*Why does the Chrome developer
tools computed style show something different from the styles tab?*) is the drift
made real: the two panes showing different values for one element, which is the
failure shape this decision deletes. CSS-Tricks also notes the Computed values are
literally `getComputedStyle()`'s — the rung-3 mechanism — so the resolved view
is a derived projection, exactly what Spends is.

**Query 2 — `Figma variables mode resolution inspector show resolved value of a
token applied to a layer`.** Read: Figma's *Variables in Dev Mode*
(help.figma.com), the `Variable.resolveForConsumer` plugin API (developers.figma.com),
and two forum threads (*Question about token resolution in variable-based Figma
components*; *Hover tooltip for bound variables is not showing value/description
anymore*). **Found: Figma uses one Inspect surface per selection and one read-only
Variables modal — never two surfaces for one selection.** The Variable details
modal lists name, collection, mode, "the variable's value and, if relevant, the
chain of aliases to a raw value", and is opened read-only "when you have no
layers selected" — i.e. Figma keys the read-only document view to the *empty
selection*, which is exactly the mode geometry our panel has. The resolution is
context-dependent by construction: "the resolved value depends on the node
consuming the variable and which … mode is currently selected in the node", and
"it is not possible to statically determine the resolved value … when there are
multiple modes". **How its shape compares to ours:** same single-surface-per-question
discipline; the difference is that Figma's resolution is genuinely node-dependent
(alias chains), which is why it keeps resolution *in the modal* rather than
duplicating it. The forum thread about ambiguity, and the tooltip regression
thread, are both about **one** surface losing a fact — a hint that even a single
read-only resolution view is fragile and a duplicate is worse.

**Query 3 — `Chrome devtools computed styles versus styles pane why two panels
same information`.** Read: the same Chrome reference pages plus the StackOverflow
thread above and the DevTools Tips post. **Found: the ecosystem's own answer to
"two panels, same information" is that they must not be the same information.**
DevTools keeps the pair because each answers a distinct question; the moment a
developer expects both to say one thing, a question like the SO thread is the
result. **How its shape compares to ours:** ours are the same information, so the
pair has no justification here.

**Query 4 — `Penpot design tokens inspector selected object resolved style panel`.**
Read: Penpot's *Design Tokens* help page, the *Design Tokens with Penpot* blog,
the `TokenBase` plugin API, and two issue trackers. **Found: a design tool that
did ship the drift, in the wild.** The Tokens panel and the right Design sidebar
both surface resolution — "hover a token name to see its resolved values" in the
sidebar, and "underneath the token value, Penpot displays the resolved value" in
the Tokens panel — and Penpot issue **#7979** is exactly two surfaces disagreeing
about one fact: a colour token applied to a text, then grouped, shows the **hex
code** in the right design panel where it should show the **token name** (the
left panel has the name); the maintainers call it "a known bug". Penpot issue
**#9655** is exactly `vg-146`'s shape: "No colors tokens displayed when multiple
elements are selected in design panel" — the token selector "appear[s] empty or
collapsed … when multiple elements are selected", while a single element works.
**How its shape compares to ours:** the same two defects we have, independently
arrived at by a shipping tool — a name-resolved-elsewhere surface, and a
multi-selection path that renders nothing. That is the strongest external
evidence that the duplicate is not merely redundant but a standing bug factory,
and that the fix is to remove the duplicate rather than add a sync path.

**Query 5 — `two UI panels show the same data become inconsistent duplicate
source of truth drift read-only view`.** Read: React's own state-structure
guidance as quoted by *Two Screens Show Different Values: One Owner per State*
(axonbuild.com), *Two Sources of Truth Will Always Disagree* (dev.to), a
frontend-atlas entry on the derived-state anti-pattern, *The Same Reality Should
Not Have Two Representations* (glasp.co), and a large open-source tracker epic
"Sources of truth: stop synchronizing duplicated state — collapse it"
(github.com/2witstudios/PageSpace#2161). **Found: the general rule is unanimous
and it is the exact rule our ownership map already states.** React: "When the same
data is duplicated between multiple state variables … it is difficult to keep
them in sync"; "avoid duplication in state". The dev.to piece: "Every duplicated
fact is a promise that two pieces of code will stay in step for as long as the
system lives. They will not." The tracker's own conclusion after nine
repair/backfill scripts: "The durable fix is almost never better synchronization —
it's **collapsing the duplication**." **How its shape compares to ours:** this is
`ownership.md:7-13` verbatim in other words — "not fixed by making one list read
the other; it is fixed by deleting the second decision". Our duplicate is a
*derived* projection (both read `appearance.ts`), so it has one owner of the
*value* and two owners of the *surface*; the surfaces can still disagree about
which selection they answer, which is precisely what `vg-146` measured.

**Plainly: nobody ships two read-only resolution surfaces for one selection on
purpose; where a tool has two, they answer different questions (DevTools) or the
pair is a bug (Penpot).** The tools that present a derived "what does this resolve
to" view — DevTools Computed, Figma's Variables modal, Penpot's token hover —
each present it in **one** place, and the strongest comparable failures (Penpot
#7979, #9655) are a second surface naming the same fact differently and a
multi-selection path that renders nothing. There is nothing to reuse, and the
useful finding is the *convergence*: one read-only surface per answer, derived
from the single owner, and a container answer that walks children rather than a
second surface that can be taught to.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **One surface per question** — the selection's resolved references live only in the column's Spends; the document's globals live only in the left column's Document pane | the column already renders them, already owns the group case (`childrenResolution`), and already shares `ownership.md:98`'s row; the document answer belongs to the column the document sits in | delete the panel's selection branch and its `style` host; move `documentGlobals` unchanged, keeping `data-vigilia-globals` so the existing assertion (`editor.spec.ts:2149`) still reads | none of substance: the value owner (`appearance.ts`) is untouched, and the group case stops being blank because it was never blank in the surviving surface | **chosen** |
| **Two surfaces for the selection's answer, kept in sync** — keep the Style tab's selection mode and make it agree with Spends | nothing moves; the tab's own test stays green | a sync path between two renderers of one fact, in two files, for two call sites | **the trap that produced `vg-146`.** Every duplicated fact "is a promise that two pieces of code will stay in step" (rung 4); the tab has no children walk, so teaching it to agree means duplicating `childrenResolution` too — a second owner of the container answer, which `ownership.md:10-13` forbids and which drifts the moment a kind is added | rejected |
| **One surface with two modes** — today's Style panel: one component that branches on `active === undefined` between document and selection | it is what shipped; cheapest to keep; one factory, one host | none added | **the trap, named.** The mode is keyed on transient selection state, not on which question is asked, so the surface's *identity* changes when a group is selected and the group lands in the selection branch, which has nothing to render — `vg-146` exactly. It also puts two different questions (what the document offers / what this selection resolves to) behind one surface, the conflation the design spec's section table exists to prevent ("a tab [that] hides a property"; `2026-10-02-frontend-redesign-design.md:226-232`). | rejected |

## Rung 6 — probe

What could be measured by reading, and what was not run.

- **The two surfaces call the same functions with the same arguments — verified
  by inspection, and it is exact.** `style.ts:101-108` renders
  `createResolutionLine(label, nameOfRef(globals, ref), resolveToken(globals, ref))`
  for each `paintReferencesOf(active)`; `per-kind-column.ts:576-591` renders
  `createResolutionLine(label, nameOfRef(context.globals, ref), resolveToken(context.globals, ref))`
  for each `paintReferencesOf(target)`. The type-preset lines are the same pair
  (`style.ts:112-119` vs `per-kind-column.ts:594-607`). `createResolutionLine`
  is one function (`appearance.ts:206`), so both emit an identical
  `data-vigilia-resolution` element.
- **The call-site count is a measurement, not an assertion.** `createResolutionLine`
  has 4 call sites in `style.ts` and 6 in `per-kind-column.ts`; the six helpers
  are called from exactly those two modules plus the one non-display `resolveToken`
  in `panel.ts:343`.
- **The divergence is recorded, with numbers.** `vg-146` measured, driving the
  built editor in Chromium: with `group-cpu-card` selected, the element
  `[data-vigilia-panel="style"]` holds **no** `[data-vigilia-resolution]` at all,
  while the column lists three lines — `Paint: Frosted panel → #0815234d`,
  `Paint: CPU → #4da3ff`, `Type preset: Card title → Segoe UI 400 24px`. **That
  count is the row's, not one I reproduced** — I read the source and the register,
  I did not launch the editor.
- **The asymmetry is structural, and stated in the code.** The group branch is
  `questions.childrenAppearance` (`per-kind-column.ts:556`), `true` for `group`
  and `activeSelection` (`KIND_QUESTIONS:153-154`); the panel has no equivalent,
  so its two calls on a container return empty. Six lines of branch, one surface
  short.
- **The blank case is untested.** `style.dom.test.ts` covers text, `Rect`, nothing
  selected and globals-changed-after-mount (`:41, :89, :65, :73`) — no `Group`,
  no `ActiveSelection`. The bug `vg-146` filed had no test that could have caught
  it.
- **Cannot be probed here:** a live rendered line count for an `activeSelection`
  (multi-selection) on the starter — the register measured a `group`, and I did
  not drive the editor to add the multi-selection number; and whether anything
  other than `editor.spec.ts:2149` reads the `data-vigilia-globals` marker, which
  only the document mode keeps. Both would be browser tasks in the change that
  makes the move, not facts this note can assert.

## Decision

**The selection's resolved references keep exactly one read-only surface — the
right column's Spends section — and the Style panel's selection mode is deleted.
Its document mode moves to the editor's left column as a Document pane, keeping
`documentGlobals`'s `data-vigilia-globals` marker and its `createResolutionLine`
lines so the existing browser assertion still reads it. The tab that held both
modes has nothing left to switch between and goes with the selection mode.**

The reason is not that two surfaces are untidy. It is that they **answer the same
question from the same helpers and have already disagreed**: `vg-146` is one
selection (`group-cpu-card`) answered by one surface with three lines and by the
other with none, and the surviving surface is the one that is right — for a group
or a multi-selection it renders the children's effective appearance, which is
*more*, not less. Teaching the tab to agree would mean duplicating
`childrenResolution`, a second owner of the container answer, which
`ownership.md:10-13` says is "not fixed by making one list read the other; it is
fixed by deleting the second decision" — and which rung 4 shows is a standing bug
factory in the wild (Penpot #7979, #9655). So the second door is removed rather
than taught to agree.

**Why not "one surface with two modes".** That option is the status quo, and it
is the trap, not the cheap answer. A single component that branches on
`active === undefined` (`style.ts:96`) keys its *identity* to transient selection
state rather than to the question being asked; a group selection falls into the
selection branch, which has nothing to render, and the document branch that could
have answered is unreachable — `vg-146`, caused by the mode key itself. It also
conflates two different questions in one surface, which the design spec's section
table forbids. The chosen shape is the opposite: **one surface per question, each
where its subject lives** — the selection's answer beside the selection, the
document's answer in the column the document belongs to.

**Cost of being wrong.** The value owner is untouched: `appearance.ts` and its six
helpers keep their signatures, so the surviving surface is unchanged and any
future reference surface reads the same functions. The move changes which element
the document mode renders into, which the browser assertion catches immediately;
the deletion removes a component with its own test file, so the failure mode is a
red test that names the removed surface rather than a silently blank panel. If a
document-level resolution view is later wanted *while a selection exists*, that
is a new question with a new surface and its own note — not a second door on this
one.
