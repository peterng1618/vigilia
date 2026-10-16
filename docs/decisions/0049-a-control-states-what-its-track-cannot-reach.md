# 0049 — A bounded control states the value its track cannot reach

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/components/ui/control-slider.tsx`,
  `src/web/packages/editor/src/components/ui/control-icon-button.tsx`
- **Task:** Phase 16.2 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (rows `vg-483`, `vg-493`, `vg-494`, `vg-498`)

## The problem

Four declarations in the one control set were inert, unreachable or in
disagreement, and each is invisible from the code that reads it:

- `ControlProps.describedById` is declared for "an element outside this control
  that describes it" and read by four controls; `ControlIconButton` — the one
  control that also *draws* its reason — accepted it and dropped it.
- A palette gradient stop's offset is a bounded number (`min: 0`, `max: 1`) and
  rendered as a text box, while DESIGN.md §5's vocabulary gives a bounded number
  a track.
- A slider whose `value` sits outside its own `min`/`max` has the bound moved by
  **another owner's measure**, not by the author: `selection-inspector/index.ts`
  writes `scaleX = dimension / object.width`, so a Size edit moves the ceiling and
  leaves the stored value above it. The thumb is clamped to the bound and the
  well beside it shows the stored value — two numbers, one control.
- The well has padded 6px horizontally while `DESIGN.md` §3's table assigned the
  4px step to well padding, and nothing measured either against the other.

The non-obvious part is the third: a control whose *range* is a projection of a
derived bound cannot be repaired by clamping, and the platform forbids the
alternative. That is the shape this note is about.

## Rung 1 — Vigilia

**Searched:** `components/ui/` for every reader of `describedById` and `hint`;
`control-slider.tsx` for its step and its range handling; the selection
inspector's slider projections (`view.ts`, `appearance.ts`, `glass.ts`,
`panel.ts`, `bounds-from-drawn-box.ts`); `panes/tokens/paint-list.tsx` for the
gradient stop's fields; `scripts/design-tokens.mjs` and
`scripts/design-tokens.gated.json` for what reads §3's table; `docs/decisions/`
for a note already claiming this path.

**Found:**

- **The step is already read, never declared.** `control-slider.tsx`'s `stepOf`
  reads `step` off the rendered `input[type=range]` *precisely so it cannot
  disagree with the slider's own*, and its comment already contemplates a step
  that is not 1. The prop was simply never exposed.
- **The precedent for a 0–1 value is a percentage projection**, not a fractional
  step: `appearance.ts`'s `opacityField` projects Fabric's 0–1 onto 0–100 with
  `integer: true`. That projection is lossy, and it is what `vg-494` is about one
  level down — a well showing a number the document does not hold. Reusing it
  here would reintroduce the defect being fixed in the same task, so it is
  rejected below.
- **`vg-478` fixed the radius's version of the third problem at the write**
  (`selection-inspector/index.ts` clamps it). The write is not where this control
  can fix the border, the shadow blur or the chart measures bounded by
  `drawnBox`, and the task's own `Files:` line is `components/ui/`.
- **`designLanguagePx` is a stated list, not a derivation.**
  `scripts/design-tokens.gated.json` carries `[2, 3, 11, 14, 26, 28, 30, 32, 36,
  40, 46, 74, 246, 276]` and `design-tokens.mjs`'s `unconsumedPx` fails an entry
  no file writes. So narrowing the well's pad would oblige a second edit
  (`40` loses its only writer), and moving §3's table obliges none.
- No decision note claimed `components/ui/`.

## Rung 2 — dependencies

**Searched:** `@base-ui/react/slider`'s surface for a way to draw a thumb outside
the track's range — `min`, `max`, `step`, `value`, `onValueChange`,
`onValueCommitted`, `Slider.Thumb`, `Slider.Indicator`; and `package.json` for a
second slider package.

**Found:** `Slider.Root` takes `min`/`max`/`step` and clamps `value` into that
range for rendering. There is no "out of range" presentation and no way to ask
for one. Base UI is the editor's one primitive library (ADR-0038), so there is no
second candidate to import.

## Rung 3 — platform

**Searched:** the native `input[type=range]` Base UI renders, and what ARIA
permits a slider to report (MDN's `slider` role reference).

**Found:** the native control **clamps** a value outside `min`/`max` — that is
the clamp being observed, and it is the platform's, not Base UI's. And the
platform's own accessibility contract forbids the alternative: `aria-valuenow`
"must be between the minimum and maximum values, inclusive". So the track cannot
be made to report the stored value either by drawing or by announcing it. What
the platform leaves to the caller is the only remaining option: **say so
somewhere else**.

## Rung 4 — ecosystem

**Not run, and the distinction matters.** No web search was available in this
session, so this is **not** a finding that nobody solved this shape — it is an
unrun rung. What can be said without it: the question is "what does a bounded
control do when its own value is outside the range its owner handed it", and the
answers the ecosystem is known to give (clamp silently, extend the track, refuse
the control) are all reachable here without a search. The rung was attempted and
returned no results; it is recorded as unrun rather than as empty.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Clamp the projection — draw *and* show the bound | Two halves agree | Rewrites the author's stored 100 into 40 **in the field's display**; the well would show a number it would refuse if typed | The field lies about the document, which is `vg-494`'s own complaint | rejected |
| Extend the track to include the value (`max = max(max, value)`) | The thumb sits at the true position | Every commit needs clamping back to the owner's bound; the track's right half is travel that means one value | A track that lies about its own range, and a thumb that snaps back on release | rejected |
| Project the offset as a percentage, as `opacityField` does | No new prop; matches the inspector's precedent | The well shows 37 for a stored 0.375, and the next commit rounds it | Reintroduces the shown-value/stored-value gap this task exists to close | rejected |
| Refuse both halves with a reason | Both halves agree | The author cannot repair the value from the control that shows it — the state is caused by *another* owner's measure | Traps the value behind a control that can no longer address it | rejected |
| **Mark the track and state the value** | The well keeps the document's truth, the track stays operable, and the disagreement is stated where a reader meets it | One note element, one `step` prop, one table edit | The note is a second element in the row; it renders only in a state that is already exceptional | **chosen** |

## Rung 6 — probe

Measured at `43e3d6cc`, before the change, in `control.dom.test.tsx`'s own
harness (jsdom): mounting `ControlSlider` with `value={100} min={0} max={40}`
renders the well's `input[type=text]` reading `100` while the nested
`input[type=range]` reports the clamped `40` — the two numbers the row describes,
read off one mounted control. The unit suite for the two control files was green
at `34 passed` before the change, so the case added for `vg-494` reddens on the
disagreement and not on the harness.

## Decision

**A bounded control that cannot reach its own stored value states the value
rather than drawing or announcing a different one.** `ControlSlider` renders a
visible note naming the stored value and the bound, connects it to the range
input's `aria-describedby` and to the well's own `describedById`, and keeps both
halves operable — dragging the track down is the repair, and the well's number is
the document's. The track is the wrong half: it is a projection that has lost its
reach, while the well is a field reading what is held.

The `step` prop is exposed rather than a percentage projection reused, because
the projection is the same shown-value/stored-value gap one level down.

§3's table moves rather than the well's pad, for the reason the row gives: the
code and **both** drawings write 6 horizontally, so three sources agree and the
table cell is the fourth. The row is now 4 for a well's vertical padding and an
icon button, 6 for its horizontal padding — which is what `padding:4px 6px` in
`controls.html` and `controls-editorial.html` draws and what `wellClasses`
writes.
