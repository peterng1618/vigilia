# 0083 — `locked` is authored state and persists; the transform flags beside it are re-derived

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/persist.ts`, `docs/architecture/ownership.md`

## The problem

`scene-fabric/src/persist.ts:75` lists `"locked"` in `SCENE_PERSISTED_PROPERTIES`,
so whether an object's lock survives a save is decided in the persist list. That is
a decision about the persisted scene with no record and no ownership-map row — the
register row is `vg-366`. The rule that only **authored** state persists makes it a
question rather than an oversight: a lock is authored state if the author set it
deliberately, and derived state if it only mirrors a transform flag. Fabric's own
`toObject` omits the flag (rung 3), so it is in the list only because someone put
it there.

**The decision is already taken and already stated in code; the missing thing was
the record, not the behaviour.** The ruling (2026-10-12) says so, and this note is
its record rather than a new choice. `editor/src/object-lock-manager/index.ts:90-92`
states it in a comment — *"Undo rebuilds the scene, so a revived locked object is a
new instance back at Fabric's defaults. `locked` is the persisted state; the
transform flags are re-derived from it rather than persisted alongside it."* — and
`onHistoryLoaded` (`:93-105`) is the re-derivation: after a history load it walks
the revived scene and re-applies `TRANSFORM_LOCKED` to every object `isLocked`
reports true (`:96`).

## Rung 1 — Vigilia

Searched: every non-test writer of `locked`, `selectable` and `evented` across
`src/web` (`.set("locked", …)`, `.set({ … })`, `flag: value`); `persist.ts` in
full; `scene-fabric/src/object-lock.ts`; `editor/src/object-lock-manager/index.ts`;
`editor/src/grouping-manager/index.ts`; `editor-shell.ts`'s artboard plate; the
register row `vg-366`; `docs/architecture/ownership.md`'s three `persist.ts` rows.

Found: **`locked` has exactly one writer that sets it as a Fabric property** —
`object-lock-manager/index.ts:79`, `object.set("locked", locked)`, reached by
`lockObject` (`:108`) and `unlockObject` (`:113`), each of which calls `save()`. Its
one reader is `object-lock.ts:18`'s `isLocked`. (The other `locked` hits are
view-model booleans, not Fabric state: `editor-shell/shell-stores.ts:14`, `:39` and
`selection-inspector/view.ts:612`.)

And the same decision is written **twice**: `apply` (`:77-88`) writes the six
transform flags — `hasControls` and the five `lock*` — beside `locked`, from
`TRANSFORM_LOCKED` (`:22-29`) and `TRANSFORM_FREE` (`:31-38`). Two representations
of one fact is the risk the ruling names, because they can disagree after a
restore; `onHistoryLoaded` is what stops that, and it exists because Fabric's
`loadFromJSON` revives a *new* instance at Fabric's defaults. The flags are not in
the document, so they come back as `hasControls: true`, and only `locked` survives
to say they should not.

## Rung 2 — dependencies

Searched: `src/web/package.json` and `packages/scene-fabric/package.json`;
`docs/engineering/dependencies.md`'s declared table; Fabric 7.4.0's own
serialization surface (`Object.toObject`, `SerializedObjectProps`).

Found: **the dependency answers the serialization half and declines the decision.**
`toObject(propertiesToInclude?)` (`fabric/dist/src/shapes/Object/Object.d.ts:679`)
takes an *additive* list, and `includeDefaultValues: boolean` (`:112`) strips values
equal to a default. Neither asks which property is *authored*.
`SerializedObjectProps`, the interface `toObject` produces, carries `opacity`,
`visible`, `shadow` and the transform fields and has no `selectable`, `evented` or
`locked` member. So the authored/derived split is not something a dependency has
already decided — it is left to the caller.

## Rung 3 — platform

Searched: Fabric's `FabricObject.stateProperties` — the list `toObject` walks —
read from the installed package at runtime (`fabric/dist/index.mjs`), not from a
doc. Then Fabric's own statement of the rule.

Found: `stateProperties` is
`["top","left","scaleX","scaleY","flipX","flipY","originX","originY","angle","opacity","globalCompositeOperation","shadow","visible","skewX","skewY"]`.
**None of `locked`, `selectable` or `evented` is in it**, so Fabric writes none of
them by default and each is persisted only because `SCENE_PERSISTED_PROPERTIES`
names it. Fabric's maintainer states the rule as the design: the JSON is meant to
"capture the state of the visual canvas not the interactive part … Graphic yes /
interactivity no" (`fabricjs/fabric.js` discussion #10176). That is this repo's
authored/derived boundary stated from the renderer's side — and it means Fabric
offers no platform answer to "is `locked` authored", because from Fabric's side all
three flags are the same kind of thing: interactivity it deliberately does not
write.

## Rung 4 — ecosystem

Searched: how the tools that own this shape decide what persists. Queries run
through the Exa web search — Fabric.js `propertiesToInclude` / `customProperties` /
`selectable` not serialized (the *"How to set additional properties"* wiki page,
issue #7221, discussion #10176, the Stack Overflow answers), Konva's
*"Save and Load HTML5 Canvas Stage Best Practices"*, and tldraw's *Store*,
*Persistence* and *Data management* docs.

Found: **the split is real and widely drawn; nobody draws it for you at the
property level.**

- **Fabric** answers with `propertiesToInclude` / `FabricObject.customProperties`:
  the caller names the properties, per call or per class. Issue #7221 is the exact
  complaint — `selectable` disappears from `toJSON` — and the maintainer's answer is
  that this is the design, not a bug. So Fabric's own ecosystem convention is
  precisely `SCENE_PERSISTED_PROPERTIES`: a caller-owned list of what persists,
  which is what this file already is.
- **Konva** states the stronger version of the same doctrine: do not serialize the
  node tree, serialize your own state and rebuild the tree in `create`/`update`,
  because "it is very common that nodes in a tree have a lot information that is not
  directly related to the state of your app". That is this repo's rule — persist
  authored state, rebuild derived state — offered as advice rather than enforced by
  a list.
- **tldraw** is the one that makes it first-class: every record carries a scope,
  `document` (persisted) / `session` (optional) / `presence` (not persisted), and
  the store persists by scope. It is the right shape and it is a whole store
  architecture — a reactive database, a schema and a migration system — that this
  decision does not need for one boolean on a Fabric object.

**The finding, stated plainly:** the mechanism every ecosystem tool lands on is "a
caller-owned list of persisted properties". Nothing solves the harder half — *which*
of an object's state is authored — because that is a property of the product's model
rather than of the renderer. `SCENE_PERSISTED_PROPERTIES` is that list, and this note
is the reason its `locked` entry is a decision rather than an oversight.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **Keep `locked` in `SCENE_PERSISTED_PROPERTIES`, re-derive the transform flags** | the author's refusal survives the save, and the flags cannot disagree with `locked` because they are rebuilt from it | one entry in a list that already exists, and an `onHistoryLoaded` that already exists | none new — the behaviour is unchanged and already shipped | **chosen (already in the tree)** |
| Persist the transform flags too (`hasControls`, `lock*`) | the flags would not need re-derivation | five more list entries, and two writers of one fact | **the failure the ruling names** — a document carrying `locked: true` beside `lockMovementX: false` says two things, and nothing decides which wins | rejected |
| Persist neither; drop `locked` from the list | nothing to re-derive | removes one entry | **silently re-enables editing on whichever machine reloads the file** — the author's deliberate refusal is lost and nothing reports it | rejected |
| Adopt a scoped store (tldraw's `document`/`session`/`presence`) | the split becomes structural rather than a list | a reactive store, a schema and a migration path for one boolean | far more machinery than the decision needs, and a second owner for state the Fabric object already holds | rejected |

## Rung 6 — probe

Measured on this box, 2026-10-21, by reading the installed package and the sources
from Node — no browser, because nothing visible changes.

- **Fabric's `stateProperties`**, read at runtime from `fabric/dist/index.mjs`: 15
  entries, and `locked`, `selectable` and `evented` are each absent from it.
- **`SCENE_PERSISTED_PROPERTIES`**, parsed from `persist.ts`:
  `["id","provenance","selectable","evented","locked"]` — all three flags are in it
  and none is in Fabric's list, so each is persisted only because this list names
  it.
- **Writers**, over every non-test `.ts`/`.tsx` under `packages/` and `tests/`:
  exactly one `.set("locked", …)`, at `object-lock-manager/index.ts:79`. The
  `selectable`/`evented` writers are the grouping manager's reachability pass
  (`grouping-manager/index.ts:236`, `:266`), the editor's plate
  (`editor-shell.ts:182-183`) and the glass test stage (`glass-test-stage.ts:89-90`)
  — see the boundary below, which is named here and decided nowhere.

## Decision

**`locked` is authored state and persists; the transform flags beside it are derived
from it and are not persisted.** The specific reason is the one the ruling gives and
the code already implements: a lock is the author's deliberate refusal of a
transform, so dropping it on save silently re-enables editing on whichever machine
reloads the file — and persisting the flags *as well* would put two writers on one
fact, which `onHistoryLoaded` already prevents by rebuilding them.

`SCENE_PERSISTED_PROPERTIES` stays the one owner of what persists, and this entry
stays in it.

**The boundary this decision does not cross, named rather than answered.**
`selectable` and `evented` sit beside `locked` in the same list and are **not** the
same case. The lock path writes `hasControls` and the `lock*` flags and never those
two, so nothing in *this* decision makes them authored. Whether some other writer
does — the editor's plate sets `selectable: false, evented: false`
(`editor-shell.ts:182-183`) but carries `excludeFromExport: true` (`:188`), and the
grouping manager sets both while an author is inside a group and restores the
author's own values on exit, as view state (`grouping-manager/index.ts:91-92`,
`:236`, `:242-249`) — is a separate question `vg-366` does not answer and this note
does not either. The list keeps all three; only `locked`'s entry is decided here.

## What implements it

Nothing new. `persist.ts:75` lists `locked`;
`object-lock-manager/index.ts:93`'s `onHistoryLoaded` re-derives the transform flags
after a history load. This note and the ownership-map row are the record.
