# Backlog — bugs, feedback and requests

**This file is the source of truth for what the user has asked for and whether it
is checked.** A GitHub issue is an *input surface* — somewhere to jot an idea
down in ten seconds — and is pulled into this file when asked. An issue is never
the backlog and closing one never means something was fixed; **this file is what
gets closed, and `npm run backlog:check` is what keeps it honest.**

The two are not the same thing and are not allowed to drift: the issue is a
capture surface with no state, this file carries the state and the evidence. An
issue is closed with a comment naming the check that ran, and the corresponding
row here moves to `verified` or `withdrawn` — never the other way round.

Every item the user has raised, in one place, with a state that cannot be set by
an assertion. This file exists because two failures cost real time on
2026-09-30: a report of a fixed item **that was not fixed**, and feedback given in
conversation that **was never written down**.

## The states, and what each one obliges

| state | means | requires |
|---|---|---|
| `open` | raised, not worked on | — |
| `in progress` | dispatched or being built | the commit or the agent |
| **`unverified`** | **something claims it is fixed, and nobody has checked** | what claims it |
| `verified` | **checked against the user's own sentence, by a test or by hand** | **the check, named, and the artefact that ran** |
| `withdrawn` | not a defect | why, and who decided |

**`unverified` is not a temporary convenience.** It is the state an item sits in
when an agent reports success, until a *different* check confirms it. An item
cannot go from `in progress` to `verified` on the strength of the work that
claimed it — `scripts/backlog-check.mjs` rejects that, and requires the check to
name the field, control or path **from the item's own wording**.

**"Verified" means the thing the user said, not a capability nearby.** The rule
learned the hard way: clamping was proven on a field that had bounds, and
reported as fixing a field that had none. The user's sentence is the spec.

---

## Open

| # | in the user's words | state | note |
|---|---|---|---|
15 "A line should have two end handles" — plus a rotate handle, or a Line cannot be rotated | open | fully specified in the plan, `41c208d`; never built. Owner `controls-manager/renderers.ts` |
| — | double-clicking outside a group does not exit it; only Escape does | open | #17 |
16 — the canvas does not dim objects outside an entered group | open | the layer panel dims; the canvas dim was declined because `opacity` serialises. **Needs a decision, not a fix** |
| U25 | a colour picker for paint | open | search answered the wrong ecosystem; shadcn/ui has one |
| U27 | a UI for gradients sharing the colour picker's parts | open | blocked behind U25 |
| — | a crop control is reachable for a selected image, and crop survives save and reopen | verified | a **Crop** control exists for a selected image and opens a session with aspect presets, Apply and Cancel; 4 kB of `crop-manager` that was constructed and never called is now reachable | `0c42400` |
| — | the host must not store a theme it will refuse to serve | open | #1 in the asset-ownership spec: the 32 MB asset bound is enforced on read and not on write, so an oversized asset saves and then 404s |
| — | the dirty check must not cost 90 MB and 1.7 s | verified | the same check on a 23.65 MB asset now takes 0 ms and 391 chars, holding the envelope and each asset's declared digest rather than a byte per asset byte — down from 1614 ms and 86 MB retained | `e379b7f` |
| — | the user's top-bar direction: a real toolbar of icon buttons on the theme document | open | #21 — the user's call, not an agent's |
| — | should the editor be rebuilt on Base UI + shadcn/ui + Tailwind before micro-adjustments | open | #22 — the same question as the colour picker one level up; the ecosystem search was run against Base UI alone |
| — | a desktop-shaped theme letterboxes to 31% of a phone's height | open | #24 — two rulings cannot both hold, and this is not an agent's to decide |
| U29 | every new object lands on top of the last | in progress | dispatched; an earlier attempt was silently lost |
| U33 | every unmatched host path serves the player | open | `/play` and `/display` both return 200 with a live dashboard |
| U34 | the palette colour field accepts anything, and persists it | open | **upstream of U25** — a picker does not fix it, the write path does not check |
| U36 | the crop notice contradicts the geometry | open | cause not established; the notice was right and my reading was wrong |
| U37 | glass on a circle reads stronger than on a rect at the same value | open | cause not established; you ruled a slight difference acceptable but a coverage bug is not |
| — | drag-to-select overlay flashes and vanishes when the mouse stops rather than releases | open | #19 |
| — | locked and unlocked icons are hard to tell apart; locked should be a filled lock | open | #18 |
| — | a locked object should stay selectable in the canvas, just not movable | open | #18 |
| — | the dirty guard fires on a freshly opened, untouched theme | open | #18, #27 — the cause is Fabric's per-character `styles` array surviving serialisation, not the dirty key's cost |
| — | the line chart occasionally slides left as if correcting a position | open | #19 |
| — | the preview data source fluctuates too fast to be realistic, and distracts | open | #19 |
| — | asset handling: own panel, replace adds instead, inconsistent in the layer list, some unremovable | open | #23 |
| — | "the editor supports ?theme=<id>" — arrived with the read-back fix | unverified | claimed by `2c553b4`; the check has not been run against a real saved theme by a second party |

## Decisions that are the user's, not an agent's

| # | in the user's words | state |
|---|---|---|
| — | "the top bar menu is kinda lost in direction… Verdict: Make it an actual toolbar (icon buttons, not nested inside a menu) with actions to the theme document" | open | user's call — the top bar becomes a toolbar |
| — | Save Package → **Activate**; Release Package → **Export theme**; Open Package → **Import theme**; Open library → **Open**; Save to library → **Save**; add **Save as**; New from starter → **New from template** | open | user's call — the top bar becomes a toolbar |
| — | "Should we do a whole redesign of it with Base UI - Shadcn - TailwindCSS… before doing any micro adjustments?" | open | user's call, and the same question as U25 one level up |
| — | the phone letterboxes a 1920×1080 theme to 31% of its height | open | a design question, not a defect, not a bug |

## Verified

| # | in the user's words | state | the check that ran | artefact |
|---|---|---|---|---|
| U1/U23/U24 | redo and front/back answer to the graphic-editor chords, in the product | verified | redo and front/back answer to the graphic-editor chords, in the product | `66264bc` |
| U4 | an undo crossing an image no longer deletes it | verified | an undo crossing an image no longer deletes it | `5b25307` |
| U5/U6/U7 | entering a group makes 1 of 51 objects selectable, as it should be | verified | entering a group makes 1 of 51 objects selectable, as it should be | `56af977` |
| U9 | the trends chart is no longer the only aliased one | verified | the trends chart is no longer the only aliased one | `de57743` |
| U11/U12 | an inserted object is named, and the name round-trips | verified | an inserted object is named, and the name round-trips | `a4824fe` |
| U26/U28 | **a Polygon's Sides field clamps onto 32 and carries a slider** — *the glass blur field is separate and was not covered* | verified | **a Polygon's Sides field clamps onto 32 and carries a slider** — *the glass blur field is separate and was not covered* | `4fd582c` |
| U21 | **focus** on an unfrostable control announces its reason to a screen reader | verified | **focus** on an unfrostable control announces its reason to a screen reader | `4fd582c` |
| glass on closed shapes | Circle, Ellipse, Triangle and Polygon frost; the clip follows the shape | verified | Circle, Ellipse, Triangle and Polygon frost; the clip follows the shape | `7032509` |
| U30 | the player's failure screen names the cause, not a parser error | verified | the player's failure screen names the cause, not a parser error | `7e8717e` |
| — | a POSIX root volume joins its own drive | verified | a POSIX root volume joins its own drive | `8fa8724` |
| — | a theme is a folder; a ZIP is only an export | verified | a theme is a folder; a ZIP is only an export | `3117a91` `125072d` `d32cc5b` |
| — | a crash in the save window leaves the theme readable | verified | a crash in the save window leaves the theme readable | `d3891e7` |
| U39 | a saved theme opens by id, with the name that was saved | verified | a saved theme opens by id, with the name that was saved | `2c553b4` |
| U40 | a stale save is refused, verified through the real API | verified | a stale save is refused, verified through the real API | `4a7015a` |
| — | an unchanged save writes and uploads nothing — 1.21 MB → 45 KB | verified | an unchanged save writes and uploads nothing — 1.21 MB → 45 KB | `70a510f` `95803e9` |
| U32 | the two disk dropdowns stop asking the same question | verified | the two disk dropdowns stop asking the same question | `266dfe6` |
| — | the Arrange menu is gone; the toolbar already had all 8 | verified | the Arrange menu is gone; the toolbar already had all 8 | `95803e9` |

---

## How an issue becomes a row, and what is still manual

The mechanic mirrors the one the user runs in **apitable** (`scripts/backlog.mjs`
there), and it works because the *labels* carry the state:

| label | means |
|---|---|
| `undecided` | jotted down, not yet judged by the owner |
| `covered` | this register owns it; a row exists here |

- **Jot an issue.** It sits `undecided`. Nothing reads it until asked.
- **Pull.** On request, the open `undecided` issues are read and become rows
  here, each carrying its issue number. The two then reconcile in both
  directions: a row cites `#n`, an issue can be closed.
- **Close.** An issue closes with a comment naming the row and the check that
  ran, and takes `covered`. A close reason alone records nothing.

**What is manual here and is not in apitable.** Their script closes an issue
*mechanically* the moment a spec absorbs it, and **refuses** to close one the
owner has parked as `undecided`. Here, closing is a comment someone writes by
hand, so it depends on whoever closes the issue having read the row first. That
is the honest gap, and the fix is the same shape as theirs: a small
`scripts/backlog.mjs` that takes a row's issue numbers, refuses any that is still
`undecided`, and closes the rest with the check named.

**Until that exists, the register is the source of truth and an issue is a
receipt —** which is safe, because a row in this file is what the gate reads, and
an issue that never got pulled is visible as an open `undecided` issue rather than
as a silent loss.
