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
