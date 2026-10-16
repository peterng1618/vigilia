# 0051 — A construction's refusal is reported by the session façade

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-session.ts`,
  `src/web/packages/editor/src/editor-shell/bridge.ts`
- **Task:** Phase 16.4 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (rows `vg-484`, `vg-489`, `vg-499`)

## The problem

A construction refuses when the theme has no reference to give it — a palette
with no usable token, presets without a body. The refusal is a **throw** from
`new-object-defaults.ts`, and who catches it decides whether the author is told.

`new-object-panel.ts`'s `constructing` is the catcher for the Add pane's tiles.
It is module-private, and the pane's tiles are the only route through it. The two
surfaces that *also* construct — the layer footer (`bridge.run` →
`session.addText()` / `addShape()`, `bridge.ts:698-706`) and the canvas context
menu (`session.addText()`, `canvas-context-menu.tsx:71`) — reach the session
façade, which mapped straight onto `insertNewText`/`insertNewShape` with nothing
between (`editor-session.ts:527-529`). So the throw escaped into a click handler
and the author got a footer control that silently did nothing.

`vg-484` names two remedies: the refusal reporting **moves to the session
façade** (one owner), or **the façade returns an outcome each caller reports**
(two owners, and the footer and the menu must agree on the words). Which catcher
owns the words is the decision; the row is filed rather than fixed because it is
that question rather than a line.

## Rung 1 — Vigilia

**Searched:** `constructing`, `insertObject`, `insertNewText`, `insertNewShape`
(`new-object-panel.ts`); `EditorDocument.insertCard` (`editor-document.ts`);
`ConstructionAction`, `CONSTRUCTION_ACTIONS`, `constructedShape`, `objectAction`
(`object-actions.ts`); `EditorActionFacade` and its "adds reachability, never
logic" doc (`editor-shell/session-facade.ts`); `createErrorManager`
(`error-manager/index.ts`); the two foreign callers, `bridge.ts`'s construction
arm and `canvas-context-menu.tsx`'s `creationGroups`; `docs/architecture/
ownership.md` and `docs/decisions/` for a note already claiming either path.

**Found:**

- **The precedent is this repo's own, and it is the same defect.** `insertCard`
  reports at its owner: "*The refusal is reported here rather than thrown at a
  caller.* Two surfaces dispatch this — the Add pane and the canvas context menu
  — and the menu's entry holds a `void`, so a thrown refusal reached nobody
  there… Reporting at the one owner is what makes it told once on every surface,
  and the Add pane's `constructing` does not double-report because nothing
  rejects." Cards stopped being silent this way. Text and shapes did not get it.
- **The one owner already exists, and only its visibility is wrong.**
  `constructing` is documented as "Every construction in the pane goes through
  it, charts included"; it is `function`, not `export function`.
- **The façade is already documented as the shell's construction surface.**
  `objectAction`'s doc: a construction "has no `run` (the shell's façade is the
  one owner of building a new object, `ConstructionAction`)", and
  `ConstructionAction`'s doc says "the shell's façade is what holds them". So the
  façade delegating its *reporting* to `constructing` is delegation to an
  existing owner, which is what its own doc asks for — not the "logic" it
  forbids.
- **`ownership.md`'s line 90 does not conflict**: `new-object-panel.ts` owns "The
  Add panel's construction actions" — the list, the eligibility, the routing —
  and that is where the wrapper lives and stays.
- Neither path was claimed by a note. `vg-535` records that the gate's
  PreToolUse hook is inert, so this note is owed on the merits rather than to
  unblock a write.

## Rung 2 — dependencies

**Searched:** `node_modules/@base-ui/react/` for a message surface (ADR-0038
makes Base UI the editor's one primitive library), and the editor for a toast.

**Found:** `@base-ui/react` 1.8.0 ships `toast/`. The editor uses none, and does
not need one: `error-manager/index.ts` already fires `editor:warning` /
`editor:error` on the canvas, and the shell's diagnostic surface renders those.
A toast would be a second message surface with its own lifetime and dismissal for
a refusal that already has one — the "second place for the same fact" this
codebase removes rather than adds. So the decision is *where the existing report
is made*, not *what widget carries it*.

## Rung 3 — platform

**Searched:** MDN's `alert` role reference (`developer.mozilla.org/en-US/docs/
Web/Accessibility/ARIA/Reference/Roles/alert_role`, fetched 2026-10-16).

**Found:** the platform forbids the shape a thrown refusal would have to take.
An alert "will only be announced when the content of the element with
`role="alert"` is *updated*", the element "must exist in markup first", and
injecting a new pre-filled one "generally does *not* lead to an announcement".
So a refusal has to be *published into a live surface that already exists* — and
in the editor that surface is `errorManager`'s canvas event, which the pane
already reaches and the footer's arm does not. The accessible contract and the
one-owner shape agree.

## Rung 4 — ecosystem

**Searched** (web, 2026-10-16 — a live search index was unavailable in this seat,
so the queries below were run as direct fetches of named sources and the URLs are
the evidence): ProseMirror's guide and reference
(`prosemirror.net/docs/guide/`, `/docs/ref/`); CodeMirror 6's reference
(`codemirror.net/docs/ref/`, read across two offsets); the VS Code extension API
reference (`code.visualstudio.com/api/references/vscode-api`, two offsets).

**Found — the two shapes, and who takes which:**

- **ProseMirror: an outcome, and the caller owns the words.** "They are functions
  taking an editor state and a dispatch function… and return a boolean." "When a
  command isn't applicable, it should return false and do nothing." Nothing in
  the library reports anything: "A menu bar could use this to determine which
  menu items to gray out." **This is the row's second candidate, and it is the
  ecosystem's majority shape** — see the comparison below for why it is not taken
  here.
- **CodeMirror 6: the same, and failure is not a message at all.** `Command =
  (target: EditorView) => boolean`; a false return means "further bindings will
  be tried for the key". The reference states no failure-reporting contract at
  all — the outcome channel is a *dispatch* mechanism, not a way to tell anybody
  anything.
- **VS Code: the framework supplies the surface, the owner must call it.**
  `commands.executeCommand` "Executes the command denoted by the given command
  identifier" and returns the handler's return value; the refusal surface is a
  separate API, `window.showErrorMessage`, and the reference gives no trigger
  guidance — calling it is the extension's own act. Transposed: the surface
  exists (`errorManager`), and it is the construction's owner that must call it.
- **The platform answer above is the fourth**, and it is the one that rules out
  the throw: an announcement needs an update to an existing live region.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Leave it: the throw escapes | Nothing changes | None | The footer's and the menu's controls silently do nothing, which is `vg-484` | rejected |
| The façade returns an outcome each caller reports (ProseMirror's shape) | One function, no moving wrapper | Two owners: `bridge.run`'s arm, `canvas-context-menu.tsx`'s `creationGroups`, and the Add pane's `constructing` must all report the *same* words for the same refusal | The two surfaces can drift into two sentences for one fact, and the third caller (the pane) already reports — three reporters for one refusal | rejected |
| The owner of the construction reports it, at `insertNewText`/`insertNewShape` | The card precedent, exactly | Two more catchers where the façade's three lines reach both surfaces | The `insertObject` wrapper then reports nothing for text/shape — a second reporter with nothing to report, kept only for cards and charts | rejected |
| **The façade reports, through the one wrapper the pane already uses** (export `constructing`) | One owner for the words; both foreign surfaces fixed by one change; the façade still delegates and adds no logic | One `export`, three wrapped lines, one comment | None new: the pane's arms keep their own call, so no surface reports twice | **chosen** |

## Rung 6 — probe

Measured at `f33a77c7`, before the change, in `card-insert-surfaces.dom.test.tsx`'s
own harness (jsdom, a real `EditorSession` over a real `Canvas`), on a theme whose
palette is `{}` — the row's bare case:

- **From the footer's own route** (`createEditorShellBridge` → `bridge.run("new-text")`):
  the refusal is not reported, it is **thrown out of the click handler** —
  `Error: New objects require a palette token.` at `new-object-defaults.ts:725`,
  through `createNewTextDefaults:520`, `insertNewText:165`,
  `Object.addText editor-session.ts:527`, `Object.run editor-shell/src/bridge.ts:704`.
  Two cases red, `3 passed` in the file.
- The same case from the façade directly (`session.actionFacade().addText()`, the
  canvas context menu's own call) fails identically at `card-insert-surfaces.dom.test.tsx:324`.

No warning reaches `editor:warning`, so the shell's diagnostic surface — the one
the author reads — says nothing at all.

## Decision

**A construction's refusal is reported by the session façade, through the one
wrapper the Add pane already uses.** `constructing` becomes `export`ed in
`new-object-panel.ts` — it stops being the pane's private helper and becomes the
owner of a construction's refusal for every caller — and the façade's `addText`,
`addShape` and `addChart` delegate to it. `insertCard` is left alone: the document
already reports that one.

- **The façade, not the callers**, because a `void` dispatch point cannot report:
  the context menu's entry holds no rejection, which is the exact reason cards
  stopped being silent, and the footer is the same shape one gesture away.
- **`constructing`, not a second wrapper in the façade**, because "one owner" is
  about the words and the words are already this function's. A second catcher
  beside the pane's would be two places that must agree — the failure the row's
  second candidate is rejected for.
- **The Add pane keeps its call.** Its `insertObject` still wraps the whole
  switch, which is what still reports the two "needs the editor session" wiring
  refusals and `ChartManager.addChart`'s own throw — a chart tile dispatches
  through the session's raw manager, not through the façade
  (`editor-session.ts:352`), so nothing double-reports.
- `bridge.ts`'s construction arm is unchanged in behaviour; its comment now
  records that the façade reports, because the reader who asks "what happens when
  this refuses" is standing there.
