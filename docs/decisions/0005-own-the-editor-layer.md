# ADR-0005 — Own the editor layer on the shared renderer; reject both Fabric candidates

- **Status:** Accepted
- **Date:** 2026-09-12
- **Supersedes:** the parallel bake-off in [ADR-0001](0001-editor-foundation-evaluated-in-parallel.md)
- **Decided by:** the agent, with delegated authority from the user, to unblock
  Gate 2. ADR-0001 reserved this for a human; the user granted the decision
  explicitly on 2026-09-12.

## Context

ADR-0001 planned to score `vue-fabric-editor` and `yft-design` against one
acceptance harness during Gate 0, keeping open a third outcome: "if both fail the
chart/typography bar, build on current Fabric plus Moveable/Selecto primitives
and own the editor layer."

**Evidence that did not exist when ADR-0001 was written:** the renderer now
exists, works, and is not a Fabric canvas.

`renderer-core` renders a theme document as **DOM elements plus ECharts
instances**, via a pure `scene/plan.ts` and a DOM-applying `scene/mount.ts`.
That path is exercised by 472 unit tests and 76 browser tests across two
viewports, and it is what the player ships.

Both candidates are Fabric **canvas** editors. Their object model, hit-testing,
transform handling and serialisation all assume objects living on a Fabric
canvas. Adopting either forces one of three things, and all three are ruled out
by requirements we already hold:

1. **Render the scene twice** — Fabric in the editor, this renderer in the
   player. §31 requires a single shared rendering path specifically to prevent
   editor/display drift, and Gate 0's stated rejection trigger is "flattened
   charts/text, or editor/display rendering that does not match".
2. **Use Fabric as an interaction layer over our scene** — it cannot. Fabric
   owns its own canvas and its own objects; it has no way to manipulate arbitrary
   DOM elements and ECharts instances. We would ship all of Fabric to fight it.
3. **Re-express our scene as Fabric objects** — an ECharts chart can only become
   a Fabric object by being rasterised into an image, which is exactly the
   "flattened charts" Gate 0 rejects.

This is not a feature-gap verdict, so it does not need the bake-off to settle
it. The incompatibility is architectural, and it points at ADR-0001's third
outcome more strongly than that ADR anticipated: **Fabric is not needed at all**,
because the scene being edited is not a Fabric canvas.

What an editor actually needs, against what already exists:

| Need | Status |
|---|---|
| Map a pointer to document coordinates | `artboard.ts` — `viewportToDocument`, exact inverse, tested |
| Hit-test a node | Nodes are DOM elements carrying `data-node-id` |
| Render what is being edited | `scene/plan.ts` + `scene/mount.ts`, shared with the player |
| Undo as one transaction per gesture (§67) | Must be ours regardless — no library knows what one gesture means here |
| Document mutation | Our own format, with a validator and a canonical serialiser |
| Drag / resize / rotate handles | **Missing.** An overlay layer |
| Inspectors | **Missing.** UI |

Only the last two are absent, and neither is what Fabric would have been adopted
for.

## Decision

**Build the editor as an interaction and inspector layer over `renderer-core`.**
Do not adopt `vue-fabric-editor` or `yft-design`, and do not take a Fabric
dependency.

Specifically:

- The editor renders through the **same** plan/mount path as the player, and adds
  overlays (selection, handles, guides) as sibling DOM on top of the artboard.
  §31 is then satisfied by construction rather than by discipline.
- Transform gestures are ours. `computeArtboardTransform` already gives the exact
  viewport↔document mapping a handle needs.
- Undo/redo is a command stack over the theme document, one entry per completed
  gesture (§67).
- **No UI framework yet.** The editor starts as plain TypeScript, like everything
  else here. A framework is worth adding when the inspector surface is real
  enough to judge the trade — adding one first would be choosing "whatever got
  installed first", which is the failure mode ADR-0001 existed to prevent.
- §47's bundle budget continues to apply to the **player only**. The editor is
  desktop-hosted and unconstrained; that asymmetry is why a heavy editor
  dependency was ever plausible, and it is still why one may be added later
  without risk to the display path.

## Consequences

- **Gate 2 is unblocked immediately.** It was blocked solely on this decision.
- **More editor code is ours.** Selection, handles, snapping and alignment are
  work Fabric would have donated. Against that: no Fabric upgrade path to
  inherit (the candidates sit on 5.3.0 and 6.4.1 against a current 7.4.0), no
  Vue/Vite version conflict with this scaffold's Vite 8 and TypeScript 7, and no
  second renderer to keep in agreement.
- **The bake-off harness is not wasted, but it is not needed either.** ADR-0001
  required it to be foundation-agnostic — to test our renderer contract rather
  than a candidate's API. That is what the current Playwright suite is.
- **Reversible in one direction.** If hand-built gestures prove worse than a
  library's, Moveable or Selecto can be added for handles alone without touching
  the renderer, because they manipulate DOM rather than owning a canvas. Adopting
  a whole Fabric editor later would not be reversible in the same way, which is
  an argument for starting narrow.
- **Recorded risk:** this trades known library features for code we have not
  written. If editing ergonomics turn out to need more than expected, the cost
  lands on Gate 2's schedule. The alternative traded a rendering architecture
  that already works — a worse trade.

## What would change this decision

A candidate that renders through *our* document and *our* renderer, using Fabric
only for gesture overlays. Neither does, and neither is structured to.

---

## Addendum — 2026-09-12: the fidelity constraint was relaxed, and the decision holds

The user pushed back on the reasoning above, and the pushback was fair:

> "I think it's ok if it's not a 100% match between the editor and the actual
> display. charts & graphs can be pre-rendered out into placeholders during theme
> editing. As long as the differences aren't misleading to the theme author to the
> point they have to guess coordinates & sizes."

That removes a constraint this ADR treated as absolute. §43's rejection trigger
names "editor/display rendering that does not match", and the design document
wins until a human says otherwise (§164) — a human has now said otherwise. The
real requirement is narrower and better: **geometry must be faithful; appearance
need not be.** An author must never guess a coordinate or a size.

Re-deriving with that relaxation, the decision does not change — but the reason
it does not change is different from the reason first given, which is worth
being precise about.

**Adopting a Fabric editor would not save what it appears to save.**

1. **We would still ship our renderer.** The player needs it regardless. So
   placeholders do not replace a rendering path, they *add* a second one — two
   models to keep in agreement rather than one.
2. **The saving is UI chrome, and the cost is a document seam.** Both candidates
   are *applications*, not embeddable components: adoption means forking one and
   grafting our schema into it. Our typed chart settings, sensor bindings, styled
   text runs and global references have no Fabric equivalent, so each becomes
   custom data hanging off a Fabric object. A lossy round-trip in that mapping is
   a data-corruption bug class, not a cosmetic one.
3. **Text would still need real fidelity.** Charts tolerate placeholders because
   nobody positions a dashboard by the exact curve of a line. Text is the element
   authors position most precisely, and §89's styled runs — a label, a live value
   and a unit styled differently inside one box — do not exist in Fabric's text
   model. A text placeholder is exactly the "guessing coordinates and sizes" the
   relaxation rules out.
4. **Toolchain conflict is unchanged.** Fabric 5.3.0 / 6.4.1 against a current
   7.4.0; Vue 3.2 / 3.4 with Vite 4 / 5 on rollup against this scaffold's Vite 8
   on rolldown and TypeScript 7.0.2.

**And the decisive point, which the relaxation makes clearer rather than
weaker:** chart fidelity in the editor costs us *nothing*. The renderer already
draws real charts in a browser, under test, at 80 browser tests. Placeholders
would be a workaround for a problem this project does not have.

### What the relaxation is genuinely worth

It is kept as a **fallback**, and it is a good one. If live charts in the editor
ever become a performance or complexity problem — a dozen ECharts instances
updating while an author drags a node — the sanctioned answer is now available:
render a chart to a placeholder during interaction and restore the live render on
release. Geometry stays exact, so the constraint that actually matters holds.
That is a cheap optimisation to reach for later, and it no longer needs a
decision.

### The interaction layer: measured, not assumed

The remaining "build it from scratch" cost is transform handles, marquee
selection and snapping. The obvious libraries were checked rather than assumed:

| | version | licence | unpacked | last published |
|---|---|---|---|---|
| `moveable` | 0.53.0 | MIT | 2.4 MB | **2023-12-03** |
| `selecto` | 1.26.3 | MIT | 0.9 MB | **2023-12-03** |

Both are MIT and both operate on **DOM** elements, which is exactly the right
shape for this renderer — and both have been unpublished for nearly three years,
with Moveable still pre-1.0. DOM transform handles are a stable problem and that
code will not have rotted, but depending on an unmaintained package for the
centre of the authoring experience is a real cost, and it is the kind of choice
that is hard to reverse once inspectors are built on its event model.

**Decision:** build the interaction layer here, over
`computeArtboardTransform`, which already provides the exact viewport↔document
mapping a handle needs and is tested. Keep it behind a narrow internal interface
so Moveable remains a drop-in if hand-rolling proves worse than expected.

**What would change *that*:** if the interaction layer's cost runs well past
handles, snapping and marquee — into gesture edge cases, touch behaviour and
accessibility — adopt Moveable for handles specifically. Adopting a whole editor
application to get handles would still be the wrong trade.
