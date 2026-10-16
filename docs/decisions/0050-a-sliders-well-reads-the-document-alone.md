# 0050 — A slider's well reads the document alone

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/components/ui/`
- **Task:** Phase 16.3 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (rows `vg-496`, `vg-497`, `vg-492`)

## The problem

`ControlSlider`'s `value` is a required number, and its well renders that number.
An optional setting the document does not hold therefore has nowhere to say so:
the owner hands the control a fallback so the track has a position, and the well
prints the fallback as if the author had written it.

`vg-497` is that shape. A chart series' `precision` is optional, and an absent one
means "at most one decimal" to the renderer — not a member of the control's 0–6
integer range. `chart-manager/chart-fields.tsx` passes `binding.precision ??
PRECISION_FLOOR`, so the field reads `0` where the document holds nothing. The
hazard is not the display: an author who drags `0 → 2 → 0` to put the number back
writes `precision: 0` and silently switches the chart to whole numbers, and the
well's own clear-then-re-read route ends in the same `0`, so the state the author
is in is indistinguishable from the one they left.

The non-obvious part is which half may say it. The track cannot: it is a
projection onto a range that has no absent member, and both the platform and
ARIA forbid it reporting one. The well can, and already does elsewhere in the
set.

## Rung 1 — Vigilia

**Searched:** `components/ui/` for how an absent value is already spelled
(`ControlNumber`'s `value`/`format`/`onClear`, `ControlSelect`'s empty option,
`control-well.tsx`'s `ControlRow`/`ControlWell`); `control-slider.tsx`'s own
contract for `value`, `onClear`, `hint`, `outOfRange`; `chart-manager/panel.ts`'s
`settingRows`; `chart-manager/chart-fields.tsx`; `selection-inspector`'s slider
projections; `renderer-core`'s precision rule; `docs/decisions/` for a note
already claiming this path.

**Found:**

- **The absent state is already owned, by the well's own component.**
  `ControlNumber` is "a finite number, or nothing at all — never a zero nobody
  typed", its `value` is `number | undefined`, and `format(undefined)` is `""`.
  The slider's well **is** a `ControlNumber` (inline form, `wellClassName`
  `w-[40px] flex-none`), so the fix is not a new state machine — it is letting the
  well do what its own contract already promises.
- **The set already has a second spelling of the same absence**: `ControlSelect`
  offers `uiCopy.panels.notSet` as a choice where a select has no empty value of
  its own. Absence is an established state here, not an invention.
- **`control-slider.tsx` already says the well is where this act lives**: "The
  track has no empty state, so the well is where that act lives", and `onClear`
  is the route it names. What is missing is only that the well keeps showing the
  fallback after a clear.
- **The precedent is `0049`, landed the same phase for `vg-494`**: a bounded
  control that cannot reach its own value **states** it rather than drawing or
  announcing a different one, and the well is named there as "a field reading
  what is held". An empty document is that principle's next case, not a departure
  from it.
- **`panel.ts`'s slider arm carries a documented fallback of its own**
  (`authoredNumber(value) ?? authoredNumber(family default) ?? bound.min`, with
  `vg-109`'s reason that the track should show what the renderer draws). It is a
  different owner with a different justification and is left alone: `vg-497` is
  the chart *binding*'s precision, where the fallback is provably not what the
  renderer draws.
- No decision note claimed `components/ui/`.

## Rung 2 — dependencies

**Searched:** `@base-ui/react` 1.8.0's slider surface —
`node_modules/@base-ui/react/slider/root/SliderRoot.d.ts` for `value`,
`defaultValue`, `min`, `max`, `step`, `format`, `locale` — and `package.json` for
a second slider package.

**Found:** `Slider.Root` takes `value?: Value` where `Value` is a number, or an
array of numbers for a range slider, plus `defaultValue`. There is no unset,
indeterminate or "mixed" presentation and no prop asking for one; the value is
clamped into `min`/`max` for rendering. Base UI is the editor's one primitive
library (ADR-0038), so there is no second candidate to import.

## Rung 3 — platform

**Searched:** MDN's `<input type="range">` reference and `aria-valuenow`
reference; the W3C ARIA APG's "Communicating Value and Limits for Range Widgets";
the HTML Standard's `input` section.

**Found:** the native control has no absent state at all — "The value is never an
empty string" — and the HTML spec's `indeterminateness` "only has an effect on
checkbox controls". The accessible contract is the same answer from the other
side: `aria-valuenow` is **required** for `slider` and "must be between the
minimum and maximum values, inclusive"; only `progressbar` and `spinbutton` may
omit it when indeterminate. So the track can neither draw nor announce "nothing
stored", and what the platform leaves the caller is the option `0049` already
took: say it somewhere else.

## Rung 4 — ecosystem

**Searched** (web, 2026-10-16): "range slider component with an unset or no-value
state — how do design systems show a slider whose value has never been set"; and
"HTML input type range indeterminate or empty value not supported — ARIA slider
aria-valuenow required minimum maximum".

**Found — four answers, and one of them is this control's shape:**

- **Refuse the state.** Warp Design System's range slider: "The text fields never
  enter an undefined or empty state", maintained by a "strict-value" pattern "to
  ensure the slider always reflects an active selection". Not available here: the
  absent precision is a real document state with its own rendering rule ("at most
  one decimal"), so refusing it would hide a value the chart draws with.
- **Name a fourth state.** TofuPilot's slider: `default_value` is optional and
  "If not set, slider starts in 'Unset' state" — the component grows a state of
  its own, and the whole component is in it. That is the second candidate the row
  names.
- **Let the value display be absent.** `rc-webcomponents`' `rc-range-slider`:
  `display` is "Absent (default) — no value shown" while the track keeps its
  position. **This is the shape chosen below**, reached independently.
- **Fill the fallback into the property.** Material Web's `slider.ts` declares
  `value?: number` and does `this.value ??= this.renderValueEnd`. That is the
  rewrite `vg-494` and this row both refuse: it would write a precision the author
  never chose.

NYPL's Slider and the USWDS range slider carry no unset concept at all.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Refuse the state — keep printing the fallback | Nothing changes; the well agrees with the track | None | The field keeps showing a value the document does not hold, which is `vg-497` itself; the author's `0 → 2 → 0` writes a precision nobody meant | rejected |
| Write the fallback into the document | The field and the document agree | A document edit on open, with a history entry | Invents authored state; the same silent rewrite `0049` refused | rejected |
| A fourth control state (`unauthored` rendered by the whole control, a word beside the track) | One state, named once, as TofuPilot does | A new state in a control set that already has one for absence, a new string, a second described-by note | Two vocabularies for one fact — `ControlNumber`'s empty box and a slider's own unset word — three lines apart | rejected |
| **The well reads the document alone** (`unauthored` → the well renders empty; the track keeps the owner's fallback) | The state is stated by the half that owns it, and no new state, string or note is invented | One optional prop, one expression | The track announces a value the document does not hold — which ARIA requires it to have and forbids it from omitting | **chosen** |

The last row's cost is real and is the reason this is a note: a screen reader
reaching the track hears `0`. The field beside it, which is the element that reads
the document, is the one that says nothing — and it is reachable, named by the
same label, and the only route back to absent either way.

## Rung 6 — probe

Measured at `d0630bde`, before the change, in `chart-fields.dom.test.tsx`'s own
harness (jsdom): a chart target whose binding carries no `precision` renders the
track's `input[type=range]` at `0` **and** the well's `input[type=text]` reading
`'0'` — `expected '0' to be ''`. The file was `24 passed` before the change, so
the case reddens on the disagreement and not on the harness.

## Decision

**A slider's well reads the document alone.** `ControlSlider` gains an optional
`unauthored`, and while it is set — and no gesture is in flight — the well renders
`undefined` instead of the track's value, so an unauthored `0` reads as an empty
field and an authored one reads as `0`. Nothing is written, the track keeps its
position, and the well's empty draft stays the route back to absent.

The fourth state is rejected because the set already has one: `ControlNumber`'s
empty box is how every other optional field in this editor says "nothing is
stored", and the slider's well is a `ControlNumber`. A second vocabulary for the
same fact, in the same row, is the cost the ecosystem's "Unset" state would buy —
and `0049`'s ruling already puts the statement in the half that can hold it.

The gesture is exempted (`dragging === null`) because the moving value is the
control's own state while a drag is in flight (`vg-449`): a thumb moving beside a
field that stayed blank would read as a broken control, and the commit that ends
the gesture either authors a value or does not.

`panel.ts`'s slider arm keeps its fallback and its `vg-109` reason: it is a
different owner, its fallback is the family's own default, and its no-default arm
is not this row.
