# 0074 — The header owns the mode switch

- **Date:** 2026-10-20
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-shell/shell-layout.tsx`

## The problem

The editor shell grows two surfaces that are not the document — the theme store
and the host — and something has to say which one is showing. The obvious shape
("a row of tabs under the header") is already forbidden: DESIGN.md §7.2 and §10
say a second horizontal bar under the header is a don't, because two stacked
rows of navigation make the first read as chrome rather than as a choice.

So the question is not "build a switch" — §5 already names **Segmented** — but
**where the mode lives and what happens when an author leaves a dirty
document**. The switch is one control, one render; the ownership is the part
that stays in the tree.

## Rung 1 — Vigilia

Searched: `ToggleGroup`, `Toggle`, `Segmented`, `Tabs` across
`src/web/packages/editor/src`; `components/ui/control-segmented.tsx`;
`editor-shell/settings.tsx` (Base UI `Tabs`); `editor-shell/rail.tsx` and
`uiCopy.menus`; every `mode` identifier in the editor package.

Found:

- **`ControlSegmented` is §5's Segmented and is not the header's control.**
  It renders `ControlRow`, whose default `column` shape is §5's field row: a
  fixed `74px` label column and a flexible value cell. The header drawing
  (`docs/design/mockups/current/shell.html:29-34`) draws a **bare well** with no
  label column, and a 42px strip has no room for one. Reusing the component
  would mean adding a fourth `ControlShape` to the frozen row vocabulary for one
  caller, or drawing a label the drawing does not have.
- **The shell has no mode state and no second navigation.** `settingsOpen`,
  `slot`, `collapsed`, `palette` and `overrides` are the shell's only local
  state; none of them names a surface.
- **The rail is the one existing exclusive choice**, and it is a different
  control by §5 ("Rail slot … at most one is open") with its own accent wash and
  2px bar. It is not a mode switch and must not read as one.
- The dirty comparison already exists: `EditorSession.isDirty()` →
  `PersistenceManager.isDirty`, and `confirmDocumentReplacement()` is the
  document-replacement prompt. The shell's facade (`session-facade.ts`) exposes
  only `isDirty()`, so the switch can *ask* without a second implementation of
  "is this saved".

## Rung 2 — dependencies

Searched: `packages/editor/package.json`'s dependency list, the workspace
`package.json`, and the installed Base UI surface (`@base-ui/react/toggle`,
`@base-ui/react/toggle-group`).

Found: Base UI 1.8.0 is already a dependency and already used
(`control-segmented.tsx` imports both Toggle and ToggleGroup). Nothing is
added; the header's switch composes the same two primitives.

## Rung 3 — platform

Searched: native `<input type="radio">` groups, `<select>`, and the ARIA
`aria-pressed` button group (the platform's own accessibility primitives).

Found: native radios give the semantics (one of a set, arrow keys) and nothing
about the paint; a `<select>` additionally hides two of the three choices behind
a popup, which is the failure the spec rejects for a control whose labels must
all be readable. `role="group"` + `aria-pressed` buttons is the pattern the
platform documents (WAI-ARIA APG's toolbar/segmented guidance) and has no native
element. **Rung 3 does not discharge this**: the platform supplies the roles but
leaves the state, the chosen treatment and the mode transition's guard to us —
which is where the work is.

## Rung 4 — ecosystem

Two queries, both run 2026-10-20 through Exa's web search.

1. *segmented control / toggle group with `aria-pressed` and roving tabindex.*
   Returned `ariaui.dev/docs/components/toggle-group`, joshuawootonn.com's
   *React toggle group component* (2023), the Radix Toggle Group docs, a Canopy
   spec (`docs/specs/0049-toggle-group.md`) and `substrateui.dev`'s Toggle Group
   — the last built on **Base UI's** `ToggleGroup`/`Toggle`, documenting the same
   array-valued `value`/`onValueChange` this code uses. Every one is the same
   shape: one tab stop, arrows moving inside it, `aria-pressed` per item, and
   paint. None of them guards a transition.
2. *guarding a navigation or mode switch when a document has unsaved changes,
   offering Save / Discard / Cancel.* Returned Cloudscape's *Communicating
   unsaved changes* pattern, LlamaPress's *Unsaved Changes Guard*,
   `ui.urbicon.de`'s *Unsaved Changes Guard Recipe*, and a StyleGallery pattern
   note. These do answer the interception half — three exits, not two, because
   "a two-button dialog forces people to choose between losing work and being
   stuck" — and all four reach the same conclusion: **it is app state, not a
   component.** Urbicon says it outright: "the guard is app state end to end …
   a library would wrap five lines of setup in coupling to all four, so the
   pattern ships as this page plus the hook."

Found: the markup half is settled prior art, and it is what §5 and Base UI
already give us. The guard half is settled *policy* with nothing to import — the
ecosystem's answer is "call your own dialog" — and none of it owns the thing this
note is about: that the shell's mode is a mode, and that leaving it asks the
editor's own guard rather than a second one.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Base UI `Tabs` (as Settings uses) | Keeps the switch and its regions in one primitive | Nothing | It writes `role="tab"`/`role="tablist"`, and the shell's own test asserts the shell has no tab strip; a tab is also a region's *view* control, not navigation between shell surfaces | Rejected |
| `ControlSegmented` with a new bare `ControlShape` | Reuses the one Segmented component | A fourth shape in a frozen row vocabulary (`control-well.tsx`, a watchlisted path), for one caller | The row vocabulary would grow for a control that is not a control row at all; the header has no label column to fill | Rejected |
| The rail's slot idiom | Already exclusive and already in the header's family | Its own accent wash and bar | §5 defines it as a pane slot; a mode that lights the accent reads as a selected pane, and §4 allows one accent-filled element per region | Rejected |
| A bare `ToggleGroup` composed in `shell-layout.tsx`, styled by `editor-shell.css`, mode held by the shell | Exactly §5's Segmented, in the header drawing's bare-well form | ~35 lines of markup and CSS, no new dependency and no new control | The state and the guard are ours — which rung 3 already says is the real work | **Chosen** |

## Rung 6 — probe

Two instruments, and each number below comes from one of them.

**The rendered browser** — `tests/e2e/editor-rail.spec.ts`, the run that proves
the switch, 1280×720 against the built bundle. The cost the chosen shape carries
is the header's height budget, the strip being a fixed `42px`
(`--header-height`):

- the well is **32px** tall — 4px padding, a 22px label and the 1px border each
  side — so it clears the 42px strip and the header does not grow;
- the chosen item's computed background is the `--stage` ground
  (`rgba(0, 0, 0, 0) linear-gradient(145deg, …)` in the light palette — a
  gradient, which is why the reading is the whole `background` and not
  `backgroundColor`) and its ink is `--text`; an unchosen item paints no
  background and its ink is `--muted`.

**The jsdom DOM read** — the shell's own dom test — is not a probe. It measures
nothing: it asserts structure, that the switch is inside `.editor-shell-header`
and that nothing sits between the header and the content region, and it is
recorded here as a structural assertion rather than as a measurement.

## Rung 7 — build

A `ToggleGroup` of three `Toggle`s in `shell-layout.tsx`, with the chosen item
lifted to `var(--stage)` and inked `var(--shell-text)` — the shared chosen
treatment, never an accent fill (§4). The shell holds the mode (it is chrome,
never persisted) and hands the header and the regions a `ShellLayoutProps`:
`mode` and `onModeChange`. The region seam is one element
(`[data-vigilia-mode-region]`), so Task A.2 and Task A.8 add a region rather than
restructure the shell.

**The guard is the editor's existing replacement prompt** —
`confirmDocumentReplacement()` in `persistence-manager/`, asked with the switch's
own question (`uiCopy.modes.unsaved`) through the parameter that prompt now
takes. The spec names "the editor's existing dirty guard" as the instrument and
the plan requires it to fire "exactly as it does for any other document
replacement", so there is one guard rather than two; and it is the one that can
offer **Save**, which a browser dialog cannot. It fires only on the transition
*out of* the editor mode with a dirty document: `cancel` returns without moving,
`save` waits for the save before moving, `discard` moves. The edit is not a
document replacement, so nothing is unmounted: the editor body is `hidden`, not
removed, and the document survives the switch — which is the invariant the plan
states.

## Decision

**Compose §5's Segmented in the header from Base UI's `ToggleGroup`, and hold
the mode in the shell.** The row vocabulary and the rail are rejected because
each would make the switch read as a control it is not; `Tabs` is rejected
because a tab is a region's view control and the shell already forbids a tab
strip. The mode is shell state because nothing persists it and no document owns
it; the guard is the editor's existing replacement prompt because the same
question about the same unsaved work gets one instrument, and it is the one that
can offer Save.
