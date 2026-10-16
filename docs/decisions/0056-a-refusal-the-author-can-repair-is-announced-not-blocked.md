# 0056 — A refusal the author can repair is announced, not blocked

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/components/ui/`
- **Task:** Phase 18.1 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (rows `vg-263`, `vg-264`, `vg-336`)

## The problem

The control set refuses values for two different reasons and carries a channel
for one of them.

`refused` is a *document's* refusal: the object is locked, so the row blocks
mutation — `ControlText` sets `readOnly`, `aria-disabled` and
`aria-describedby` to the row's reason (`control-text.tsx:70-73`). That is right
for a value nobody may change.

The Tokens pane's colour field is refused for the opposite reason: the author
just typed something the engine will not paint, and the field has to stay
editable so they can type a different one. `paint-list.tsx:259-263` renders that
refusal as a bare `<p data-vigilia-palette-error>` — a sibling of the field,
associated with nothing. No `aria-invalid`, no `aria-describedby`, no id. A
screen-reader user types an unpaintable colour and the refusal is silent.

The non-obvious part is that **the control set already has the channel, once**,
and the shape the ecosystem settled on is the shape it already uses. The work is
to make it a member of the set rather than to invent it.

## Rung 1 — Vigilia

**Searched:** `components/ui/` for every refusal-shaped prop and its readers
(`refused`, `disabled`, `hint`, `describedById`, `isBlocked`, `describedBy`);
`control-number.tsx`'s `invalid` state and `control-text.tsx`'s `shared` object;
`panes/tokens/paint-list.tsx`'s solid-colour field; `ui-copy.ts`'s `panels`
block; `docs/decisions/` for a note already claiming this path.

**Found:**

- **`ControlNumber` already implements the channel, and has since the control
  set was built** (`e3b19da4`). An `invalid` state (`control-number.tsx:88`),
  `invalidId` (`:90`), `aria-invalid` (`:160`), `describedBy(…, invalidId)`
  (`:161-166`) and a reason element `<p id={invalidId}>` (`:178-182`). It is
  **not** `refused`: the input stays editable, which is the whole point.
- **`ControlText` has none**, and `ControlProps` (`control-well.tsx:24-41`)
  carries no invalid member. So the set's two fields disagree about what a
  refusal the author can repair looks like.
- **The pane's copy already exists** — `uiCopy.panels.colourUnpaintable`
  (`ui-copy.ts:841`) — so this is a wiring and ownership problem, not a copy gap.
- **No decision note claimed this path.** `0049` claims
  `components/ui/` but decides a different shape: a *bounded* control stating a
  value its track cannot reach, where the platform forbids drawing or announcing
  the true value. That is a control whose range is wrong; this is a value the
  engine will not take. The two do not cover each other.

## Rung 2 — dependencies

**Searched:** `@base-ui/react`'s field and input surfaces for a validity
channel; `package.json` for a form or validation library.

**Found:** the editor carries no form library, and Base UI is its one primitive
library (ADR-0038). Base UI exposes no validity state the control set could
adopt, so the wiring is the set's own — as it already is for `ControlNumber`.
Nothing to import.

## Rung 3 — platform

**Searched:** what `reportValidity()` does, and the `aria-invalid` /
`aria-describedby` contract (MDN's `aria-invalid` reference, W3C's ARIA21
technique).

**Found:** the platform's own bubble is browser-rendered, unstyleable and
transient, and it exists to **block submission** — the opposite of what an
editable refusal wants. What the platform does give is the attribute pair, and
nothing else: the message, its id and its placement are the caller's. MDN is
explicit that `aria-invalid` is set *as a result of* validation and never
before, which is what `ControlNumber` already does and what the pane does not.

## Rung 4 — ecosystem

**Searched:** one query — "ARIA authoring practices invalid form field:
`aria-invalid` with `aria-describedby` error message, field remains editable,
distinct from disabled or readonly" — read against W3C's ARIA21, MDN's
`aria-invalid` reference, Harvard's form-error-communication guide, the BBC's
error-messages guide and an accessibility.build WCAG 3.3.x guide.

**Found:** the shape is settled and documented identically in all of them —
three moves, none of which is a colour: mark the field invalid, write the error
as real text, and connect the two with `aria-describedby` so the message is read
when focus reaches the field. Two findings change what gets built:

- **`aria-errormessage` is the purpose-built pairing but support lags**, so
  `aria-describedby` is the safer default. That is what `ControlNumber` uses.
- **The double-announcement trap**: a node must not be both an
  `aria-describedby` target and an `aria-live` region — the message is then
  announced once when it changes and again when focus arrives, every error
  doubled. `vg-263`'s row text asks for "no live region" as a description of the
  gap; the ecosystem says a live region on the reason node would be a *defect*.
  So the row's wording is corrected rather than implemented literally.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep the pane's own `<p>`, add `aria-describedby` from the pane | No control-set change | The pane does not own the input element and `ControlProps.data` is typed `data-${string}` → `string`, so there is no aria pass-through (`control-well.tsx:40`) | Reaches into a control it does not own, and the next pane invents a third `<p>` | rejected |
| Route the refusal through `refused` | No new concept | `refused` also sets `readOnly` | Traps the author on the stale-but-valid value — exactly what the row says must not happen | rejected |
| A live region on the reason node | Announced on change | Doubles every announcement with `aria-describedby` | The documented defect above | rejected |
| **`invalid` becomes a member of `ControlProps`** | Both fields refuse the same way, and the shape matches the ecosystem's | One prop, one reason element moved into the set, one pane rewired | The reason element becomes a second element in the row, as `ControlNumber`'s already is | **chosen** |

## Rung 6 — probe

Measured at `2e40fa9f`, before the change, by mounting both fields in jsdom in
`control.dom.test.tsx`'s harness (the probe file was deleted after its run):

- `ControlText` with `refused="locked"` renders
  `readonly="" aria-disabled="true" aria-describedby="…-reason"` with the reason
  `<p class="text-muted">locked</p>`. Blocked **and** announced.
- `ControlNumber` at rest renders **no** aria attributes; after a bad draft
  committed on `focusout` it renders `aria-invalid="true"
  aria-describedby="…-invalid"` with `<p class="text-warn">not a number</p>` and
  **no `readonly`**. Editable and announced.
- Neither mounts any `[aria-live]` element — which is correct, per rung 4.

So the channel is one prop away from being the set's, and the pane's field is
the one that lacks it.

## Decision

**An invalid-but-editable value becomes a member of `ControlProps`, distinct
from `refused`.** `ControlText` gains the `invalid` reason and the wiring
`ControlNumber` already has — `aria-invalid`, `aria-describedby` naming the
reason element, the field left editable, and no live region — and the Tokens
pane's colour field passes its refusal through it instead of rendering a sibling
`<p>`. `ControlNumber`'s own state moves onto the shared member rather than
staying a second implementation of it.

`refused` keeps its meaning unchanged: a value the *document* will not accept,
which blocks mutation. The distinction the set carries after this is **who
refused** — the document (blocked) or the engine (editable) — and not how loudly.

The refusal copy for both comes from `uiCopy` (`vg-264`), because an accessible
name and an error message are user-visible text and the copy census exists to
stop a shared control printing its own English.
