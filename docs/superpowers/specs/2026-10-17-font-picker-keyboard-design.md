# The font picker's trio list, and the keyboard model it has none of — design

**Status:** draft for review. Written 2026-10-17 for `vg-551`. **Not implemented**: Step 3 of Task 21.9
lands whichever model this review chooses.

**What this is.** `vg-551` is the row the browser suite's fourth red was filed as. The shell walk's
step 5 — "enter a group and leave it again" — must cross the whole inspector to reach the pane, and the
inspector holds the font picker, whose **trio list renders all 379 trios unwindowed** while the face
list directly above it windows to 15. That is 758 tab stops against the walk's 200-press budget. The
fix is a decision about the picker's keyboard contract for a 379-row list, which is why the row was
filed rather than fixed on the fly. **This design names two candidate models and does not choose
between them**; the choice is the review's.

## 1. What the picker renders today, measured

Counted on disk at `5034e7cb`, not inherited:

- The catalogue holds **379 trios** and **261 faces** (`font-trios.generated.ts`, `GENERATED_TRIOS` and
  `GENERATED_FACES`). `selection-inspector/font-face-field.tsx` hands the picker both whole.
- `font-picker.tsx` renders **two lists**. The face list is windowed — `rows = visibleFaces.slice(first,
  first + WINDOW)` with `WINDOW = 15`, `first` moved by `onScroll`. The trio list is not:
  `visibleTrios.map(...)` renders **every** matching trio.
- Each trio row is an `<li>` holding **two buttons** — the favourite toggle
  (`data-vigilia-font-favorite`) and the row itself (`data-vigilia-font-trio-row`) — so the trio list
  contributes **379 × 2 = 758 tab stops**. The face list contributes 15.
- The trio list is already a scroll container (`max-h-40 overflow-y-auto`); only its rows are
  unconstrained.
- **The picker has no keyboard model to extend.** `font-picker.tsx` carries no `role`, no `tabIndex`
  and no key handling at all: a grep of the file for `focus`, `Key`, `tabIndex` and `role=` returns
  nothing, and the trio list's only structure is `<ul aria-label="Trios">` with the `<li>`s under it.

## 2. Why the two models are not interchangeable

The `WINDOW` docblock gives the face list's own reason as `FontFace` objects to keep, not tab stops — so
the trio list is unwindowed **by design rather than by oversight**. The two models therefore differ in
what a keyboard or screen-reader user can actually do, not only in what a Tab costs.

## 3. Model A — window the trio list as the faces are windowed

The `<ul>` becomes a virtualised list on the face list's own pattern: `WINDOW` rows mounted at a time, a
spacer of `visibleTrios.length * ROW_HEIGHT`, and `first` moved by `onScroll`.

**What a keyboard user can do:** Tab reaches the 15 mounted rows — 30 stops, each row's favourite toggle
and its own button — and can leave the list. **What they cannot do:** reach any trio outside the window
by Tab. The window advances on `onScroll`, which a pointer or a wheel produces and Tab does not, so
**349 of the 379 trios are not reachable by Tab at all** — the search and facet controls are the only
keyboard route to them, and only for an author who can name what they want. That is the face list's own
property today, which is this model's warrant and also its cost.

## 4. Model B — a roving tabindex / listbox

The `<ul>` becomes a listbox: `role="listbox"`, each row `role="option"` with `aria-selected`, exactly
one row tabbable (`tabIndex = 0`, the rest `-1`), and the arrow keys move the roving index. Tab enters
the list once and leaves it.

**What a keyboard user can do:** reach **all 379 trios** with the arrows, and pass the whole list in one
Tab. **What they cannot do:** nothing about reachability is lost, but the **favourite toggle** has to be
decided with it — a listbox option may not hold a focusable descendant, so either the toggle leaves the
option (a per-row action reached another way) or the option carries the toggle's action as its own key.
A screen reader announces one listbox of 379 options rather than 758 separate tab stops, which is the
half of this a Tab count cannot see.

## 5. What the walk's bound becomes under each model

This is the number Task 21.9's Step 3 closes `vg-551` against — step 5's press count in the shell walk,
before and after.

- **Today, measured 2026-10-17 at `5034e7cb`: 1058 presses.** Step 5's pane, from `enterGroup`'s
  `tabUntil((focus) => focus.region === "pane")`, starting where step 4's cancelled edit left focus (the
  inspector's name field).
- **Model A:** the trio list's 758 stops become 30 → **330 presses**.
- **Model B:** the trio list's 758 stops become 1 → **301 presses**.

**Both are still over the walk's 200-press budget, and that is the part of this the plan does not
carry.** The trio list is 758 of the 1058; the other ~300 presses are the rest of the inspector, the
status bar, the header and the rail, which is the shell's own tab order rather than a defect. So
**neither model makes the walk pass on its own**: the bound has to be derived from the shell's measured
stop count (the plan's own Step 1 sentence) and must sit above 330 for model A or 301 for model B. A
Step 3 that lands a model and leaves `TAB_BOUND = 200` still has a red step 5.

## 6. What this does not decide

- **Which model.** That is the review's, and §3–§5 are what it needs.
- **The bound's value.** §5 predicts the two counts; the value the constant takes is Step 3's, and it is
  above both.
- **Whether the face list's own window is also a defect.** It is the same shape — a list whose tail Tab
  alone does not reach, and whose search is the only keyboard route to it — and the model chosen here
  would answer for it too, but the row is about the trio list and nothing here changes the faces.
- **A third shape, named so it is not rediscovered.** A window that follows *focus* rather than scroll
  is model A with the missing keyboard route added, and it reaches all 379 trios at ~30 stops. It is
  not one of the plan's two candidates because its cost is the one model A already has — the window
  moves under the author — and the plan names two.

## 7. Why there is no decision note beside this

Task 21.9's paths are not on `scripts/reuse-gate.mjs`'s `WATCHLIST`: the font picker is
`editor/src/font-picker/`, not the watched `editor/src/components/ui/`; `tests/e2e/` has no entry; and
this directory is not watched. **This spec is the task's decision record**, which is why a
`docs/decisions/NNNN` note would be a second one.
