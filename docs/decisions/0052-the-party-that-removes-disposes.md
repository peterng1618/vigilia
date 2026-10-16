# 0052 — The party that removes an object is the party that disposes it

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/adapter.ts`
- **Task:** Phase 16.4 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (rows `vg-484`, `vg-486`, `vg-489`, `vg-499`)

## The problem

`canvas.remove()` in Fabric 7.4.0 does not dispose: it releases the render list
and the canvas's own selection/hover references, nothing more. A `VigiliaChart`
therefore holds its ECharts instance and its 196×-heap backing store until
somebody calls `dispose()` — which is why the scene adapter grew a listener:

```ts
// `canvas.remove()` does not dispose; charts must release ECharts/backing pixels.
canvas.on("object:removed", ({ target }) => {
  target.dispose();
});
```

**That listener cannot tell a deletion from a reparent.** It fires for *any*
root-level `canvas.remove`, so every remover inherits a disposal it did not ask
for and may not want. `grouping-manager.group()` is the case that made this a
row: it takes each member off the root with `canvas.remove(member)` — the member
is moving *into* the new `Group`, not leaving the document — so a chart inside a
grouping is disposed while the document still holds it. The same call sits on
`bridge.ts`'s reparent path, which `vg-461` fixed by splicing `_objects` by hand
to dodge the event; `crop-manager`'s `canvas.remove(frame)` fires it too, on a
locally-constructed transient that was never a document object.

The symptom is invisible and that is why it needs a note. The grouping is
correct, the serialized scene is correct, and only the rendered backing canvas is
gone — a save that looks right reloads wrong. `vg-486`'s own probe,
`{grouped: true, disposed: true}`, is the measurement.

The non-obvious part is that both obvious fixes are wrong. Keeping the listener
and teaching it to skip objects the document still holds means the adapter has to
know, at removal time, what every other owner is about to do with the object.
Deleting the listener and disposing only in the adapter leaves every foreign
removal — the deletion manager's, the crop manager's — leaking.

## Rung 1 — Vigilia

**Searched:** `scene-fabric/src/adapter.ts` (the listener, `clear`, `reusable`,
`removeStale`, `dispose`); every `canvas.remove(`, `.remove(` and `removeAll(`
site under `packages/editor/src`, `packages/scene-fabric/src` and
`packages/player/src`; `deletion-manager/index.ts` and `holderOf`/`targetsOf`
(`scene-fabric/src/object-holder.ts`); `crop-manager/index.ts`;
`grouping-manager/index.ts`'s `group`/`ungroup`; `bridge.ts`'s `detachFromRoot`;
Fabric's own `Group.dispose` and `StaticCanvas.destroy`; `docs/decisions/0044`
(a layer drag reparents through Fabric's own add and remove) and `0050` for the
note format.

**Found:**

- **Seven removal sites, and only three of them are removals from the
  document.** The adapter's `clear`, `reusable`, `removeStale`; the editor's
  `deletion-manager.deleteActive`, `crop-manager`'s frame,
  `grouping-manager.ungroup`'s discarded `Group`. The other two —
  `grouping-manager.group`'s members and `bridge.ts`'s reparent — are moves
  *within* the document, and `bridge.ts`'s already works around the event.
- **Fabric cascades a group's disposal into its children.** `Group.dispose()`
  runs `this.forEachObject((object) => { this._watchObject(false, object);
  object.dispose(); })`. So disposing a root `Group` disposes its members, which
  is correct for a deletion and wrong for a reparent — the whole of `vg-486` —
  and it is safe for `ungroup` only because `removeAll()` empties `_objects`
  first (`Group.removeAll` is `this.remove(...this._objects)`).
- **Fabric already treats teardown differently from removal.**
  `StaticCanvas.destroy()` does `this.forEachObject((object) => object.dispose())`
  as the canvas goes away, and `Object.dispose()`'s own doc says "override if
  necessary to dispose artifacts such as `clipPath`". Removal and disposal are
  separate acts in the framework; the adapter had merged them.
- **The adapter already disposes by hand on two of its three sites** — the
  grouped-child branch of `reusable` and of `removeStale` both call
  `existing.group.remove(...)` then `existing.dispose()`, "because group removal
  does not emit the canvas-level disposal event for children". So the explicit
  obligation is not new here; it is only missing on the root branches.
- No note claimed `scene-fabric/src/adapter.ts` (confirmed against
  `docs/decisions/*.md`, which is the state `vg-535` measured).

## Rung 2 — dependencies

**Searched:** `packages/scene-fabric/package.json` and the installed
`echarts` / `zrender` for what a chart holds; `VigiliaChart.dispose`
(`chart-object.ts`).

**Found:** `VigiliaChart.dispose` "Release ECharts and backing pixels.
`canvas.remove()` does not call this" — the only dependency-held resource in the
scene, and the reason the listener existed at all. `echarts`' own API is the
same shape: `echartsInstance.dispose()`, "Disposes instance. Once disposed, the
instance can not be used again" — a separate call from removing the DOM node the
chart drew into. No dependency offers a removal hook that disposes for you.

## Rung 3 — platform

**Searched:** Fabric 7.4.0's shipped source —
`dist/src/canvas/SelectableCanvas.mjs`'s `_onObjectRemoved`,
`dist/src/canvas/StaticCanvas.mjs`'s `destroy`, `dist/src/shapes/Group.mjs`'s
`dispose`.

**Found:** the platform gives removal and disposal as two verbs and leaves the
caller to pair them. `_onObjectRemoved` clears `_activeObject`, `_hoveredTarget`,
`_hoveredTargets` and the render list and disposes nothing;
`StaticCanvas.destroy` disposes everything it still holds. There is no
"removed but still owned" state the framework tracks and no hook that knows the
difference — so the party that removes is the only party that can decide, and the
adapter's listener was deciding for everyone.

## Rung 4 — ecosystem

**Searched** (web, 2026-10-16 — a live search index was unavailable in this seat,
so these ran as direct fetches of named sources; the URLs are the evidence):
Konva's Node API reference (`konvajs.org/api/Konva.Node.html`); Paper.js's Item
reference (`paperjs.org/reference/item/`); PixiJS's Container guide
(`pixijs.com/8.x/guides/components/scene-objects/container`); ECharts' instance
API (`echarts.apache.org/en/llms-documents/api-parts/api.echartsInstance.md`);
and Fabric's own source under rung 3.

**Found — four answers, and three of them are this decision's shape:**

- **Konva: two verbs, two names, and the container cascades.** `remove()` —
  "remove a node from parent, but don't destroy. You can reuse the node later."
  `destroy()` — "remove and destroy a node. Kill it and delete forever! You
  should not reuse node after destroy()." And "If the node is a container
  (Group, Stage or Layer) it will destroy all children too." **This is the
  chosen shape, reached independently, including the cascade.**
- **Paper.js: the same split, stated as a guarantee.** `remove()` "Removes the
  item and all its children from the project"; "The item is not destroyed and can
  be inserted again after removal." A reparent is removal; only the deleting
  caller destroys.
- **PixiJS: removal is detach and nothing more.** The Container guide documents
  `removeChild`/`removeChildren` as list operations and says nothing about
  destruction — the `destroy({children})` obligation lives on the *container's*
  own API, called by whoever means it.
- **ECharts: disposal is its own call with its own contract.** "Disposes
  instance. Once disposed, the instance can not be used again." The chart's
  backing resources are released by an explicit act, never by detaching it from
  the DOM.
- The counter-example is worth naming: a listener that disposes anything removed
  is what *none* of the four do, because the event carries no intent. Konva can
  offer `destroy()` on the node precisely because the caller chose it.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep the listener | Nothing changes; charts always released | None | Any foreign root removal disposes a live object — `vg-486` itself | rejected |
| Keep it, but skip objects the adapter has not removed | No caller changes | The adapter must track which removals are its own, and a removal it does not know about still disposes | A second source of truth about ownership, invisible when wrong — the exact class of defect this path is on the watchlist for | rejected |
| Dispose only inside the adapter, delete the listener | One owner for what it removes | Every editor removal leaks: `deletion-manager`, `crop-manager`, `ungroup` | A grouped chart's backing store is freed and a deleted one's is not — trading one invisible leak for another | rejected |
| **Remove the listener; every remover disposes what it removes** | The three ecosystem answers, and Fabric's own two-verb contract | Six call sites gain one line; the obligation is documented where each is | A future removal site that forgets — mitigated by the existing grouped-child branches already doing exactly this | **chosen** |

## Rung 6 — probe

Measured at `f33a77c7`, before the change, in
`grouping-manager/index.dom.test.ts` (jsdom, a real `Canvas` with
`createSceneAdapter` installed, two real `VigiliaChart`s):

- `grouping.group()` over two selected charts:
  `expected { grouped: true, disposed: true } to deeply equal { grouped: true, disposed: false }`
  — **the row's own probe value `{grouped: true, disposed: true}`, reproduced**,
  and the grouped charts still serialize inside the group.
- The same file's `ungroup` case passes before the change and after it: the
  discarded `Group` is disposed, and because `removeAll()` emptied it nothing
  cascades into the members now on the canvas.

The chart's dispose is the only observable: the canvas serializes identically
whether the backing store is alive or gone, which is why the probe reads
`disposed` rather than the scene.

## Decision

**The party that removes an object is the party that disposes it.** The adapter's
`object:removed` subscription goes; the adapter disposes at its own three
removal sites (`clear`, `reusable`'s root branch, `removeStale`'s root branch),
and the editor's genuine removals do the same: `deletion-manager` after a
successful `owner.remove`, `crop-manager` for its transient frame,
`grouping-manager.ungroup` for the `Group` it discards. `group()` and
`bridge.ts`'s `detachFromRoot` dispose nothing, because neither removes an object
from the document.

- **The obligation is explicit rather than inferred**, because the event carries
  no intent and the framework offers none. Every ecosystem answer above pairs a
  cheap detach with a separate destroy, and the one that cascades (Konva) does so
  inside a call the remover asked for by name.
- **The disposal is per *object removed*, not per root**, so `deletion-manager`
  now disposes objects under a group too — which the listener never did, because
  `Group.remove` emits no canvas event. That is a leak this change closes rather
  than one it opens.
- **`crop-manager` is in scope and is not a third defect site**, as the row's
  re-review says: its `Rect` was never a document object, so disposing it is
  correct — but with the listener gone, nothing else will, so the site must say
  it itself.
