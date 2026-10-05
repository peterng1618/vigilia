# 0027 — A deliberate bleed is marked on the object, so the diagnostic stays honest

- **Date:** 2026-10-06
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/bleed.ts`,
  `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`,
  `src/web/packages/scene-fabric/src/artboard-crop.ts`,
  `src/web/packages/scene-fabric/src/persist.ts`

## The problem

`outsideCount` counts a straddling object's **whole bounding rect**, which is
correct as a measurement and wrong as a verdict. An author who deliberately bleeds
a quarter-disc past the artboard edge is told "1 object outside", the artboard
panel warns, and a phone raises a crop notice — for a composition that is exactly
what they wanted. §57 already permits content outside the artboard and forbids
reflow, so nothing about the format is at issue; the only wrong thing is the tool
calling a decision a mistake.

The non-obvious part is not the flag. It is **where a flag about one object's
relationship to the artboard can live** so that it reaches a saved document at all,
and so that the editor's number and the player's sentence cannot drift apart.

There are three traps, and each was reachable:

1. **The obvious type is the wrong tree.** `NodeBase`
   (`renderer-core/src/theme/document.ts`) already carries `visible` and `locked`
   and reads like the right home. It is the **v1 `ThemeDocument`** tree, reached by
   `theme/widget.ts` — the card-library widget path. A v2 theme persists
   `FabricThemeEnvelope`, whose `scene` is opaque Fabric JSON. A `bleeds` field on
   `NodeBase` would reach a widget and never a saved document, so the notice would
   keep firing for every marked object. A flag that looks implemented, passes a unit
   test over a legacy type, and changes nothing an author can see.
2. **Fabric will not persist a property it was not told about.** `serialiseScene`
   passes `SCENE_PERSISTED_PROPERTIES` to `canvas.toObject(...)`. A custom property
   absent from that list is **dropped on save** — no error, no warning. The
   round-trip is therefore a separate piece of work from the flag, and it is the
   piece that fails silently.
3. **Two surfaces read the count.** The editor's artboard panel and the player's
   crop notice both call `outsideCount`/`outsideEdges`, and both are handed boxes by
   `sceneBoxesOf`. A flag read in one place and not the other is a split the tests
   would not catch, because each surface's own test would still be green against the
   old behaviour.

## Rung 1 — Vigilia

Searched: `renderer-core/src/theme/` for the pattern a persisted per-object flag
already takes — `object-name.ts` (`VIGILIA_NAME_PROPERTY`), `glass.ts`
(`VIGILIA_GLASS_PROPERTY`); `fabric-envelope-validate.ts` for how both are checked
at import; `persist.ts` for `SCENE_PERSISTED_PROPERTIES`;
`scene-fabric/src/artboard-crop.ts` for `SceneBox`/`countable`/`sceneBoxesOf`;
every caller of `outsideCount`, `outsideEdges`, `outsideBoxes`, `sceneBoxesOf`,
`cropNoticeText` (10 files); `NodeBase` in `theme/document.ts` and `theme/widget.ts`.

Found: **the whole shape already exists, twice, and both instances are exactly this
problem.** `name` and `vigiliaGlass` are each: a declared property constant, a
reader that trusts the validator rather than re-checking, one named check in the
envelope validator beside the other, and an entry in `SCENE_PERSISTED_PROPERTIES`.
`vigiliaGlass` additionally demonstrates the optional-treatment case — absent means
off, so a scene authored before the field opens exactly as it does today — which is
the same semantic `bleeds` needs.

`SceneBox` is a plain readonly record built in `sceneBoxesOf` from the object's own
`visible`, `getBoundingRect()` and `depth`, and `countedBoxes` is the single private
function all three exported readers (`outsideCount`, `outsideEdges`, `outsideBoxes`)
go through. **There is no field on `SceneBox` to carry "this one bleeds on
purpose"**, so one must be added and read there — and because both surfaces go
through `sceneBoxesOf`, one field in one place reaches both.

`countable(box)` is the existing "does this object count at all" gate — it already
excludes `visible: false` and zero-area objects, both on the author's own doing.
`bleeds` is a third instance of the same fact, so it belongs beside them rather than
as a new branch in three readers.

Also found, and the reason the brief's Interfaces line is wrong: `NodeBase` has no
`visible`/`locked`-bearing Fabric counterpart in the v2 path at all. `visible` on a
`SceneBox` comes from `object.visible`, a Fabric field.

## Rung 2 — dependencies

Searched: `fabric@7.4.0` — `FabricObject.toObject(propertiesToInclude)`,
`customProperties`, `stateProperties`; Context7's Fabric docs for *using custom
properties* and the wiki's *how to set additional properties in all objects*.

Found: Fabric persists a custom property **only when it is named** — either in
`toObject(propertiesToInclude)` (this repo's route, via `SCENE_PERSISTED_PROPERTIES`)
or in `FabricObject.customProperties`. Neither is automatic. This confirms trap 2 is
real and is not closed by declaring a constant: an unlisted custom property is
silently omitted from `toObject` output.

Fabric's own docs also warn that a revived object's custom property must be
understood by the loader, which is why `vigiliaBleeds` needs the named validator
check rather than being read optimistically. **No new dependency is warranted** — the
flag is one boolean on a property Fabric already round-trips.

## Rung 3 — platform

Searched: the DOM's own overflow vocabulary (`overflow: hidden|clip|visible`) and
CSS `clip-path`.

Found: CSS `overflow` is a **container** property, not a per-child one, and a
dashboard artboard is a container — so "this one child overflows on purpose" has no
CSS spelling. `clip-path` on an object is the same idea as `canvas.clipPath` and
collides with the crop manager's authored image clip (the reason `vg-046` took the
canvas-level route). Nothing in the platform expresses the **policy**; the platform
only clips. That is what makes the flag a product decision with no native owner.

## Rung 4 — ecosystem

**The Exa MCP sweep failed twice with a rate-limit error and was not retried through
it.** What follows was gathered instead by fetching DuckDuckGo's HTML endpoint
directly (`lite.duckduckgo.com/lite/`) and reading the result pages. That is a
weaker instrument than Exa — no ranking, snippets truncated — and the searches that
returned nothing are recorded as nothing rather than as absence.

Searched: `figma "outside the frame" warning objects clipped`; `figma disable content
clipped outside frame setting`; `sketch "outside canvas" objects warning greyed out`;
`print bleed "objects extend beyond" trim size design software`; `figma plugin mark
object as intentional bleed ignore overflow`; `design tool per-object "ignore
overflow" OR "allow overflow" flag element intentional`; `figma request "ignore frame"
OR "exclude from clipping" per object feature request`. Read: the Figma forum thread
*Option to prevent selecting clipped/overflow layers outside a frame*, and the
Figma Learn *Frames* help page.

**Found: the mainstream answer is a frame-scoped boolean, and the per-object answer
does not exist.**

Figma's mechanism is **`Clip content`**, a property **on the frame** — "Hide any
objects within the frame that extend beyond the frame's bounds" (Figma Learn,
*Frames*), toggled with the frame selected. Its scope is the whole frame, and it is
all-or-nothing: the only escape from clipping is to turn clipping off for the frame
and keep everything visible, which is the same cage this note's rung 5 rejects on
independent grounds. It is worth recording that **the most widely used tool in this
category answers the question the frame-scoped way**, so the rejection below is not
contrary to consensus — it is a decision to make a finer distinction than the field
has made.

The per-object version is **an unanswered request, not a shipped feature.** The
canonical thread is titled *"Allow just desired element to be viewed outside the frame
instead of…"*, and the answers are workarounds rather than a flag: wrap the element in
its own frame and clip only that, or clip the frame holding the cards rather than the
frame holding everything. A second thread asks for clipped/overflow layers to be
non-selectable — i.e. for *fewer* notifications about overflow, not for a way to mark
one object as intended.

Also found, and a naming trap rather than an analogue: "bleed" in the print world
(crop marks, a bleed area past the trim size) is a **document-wide prepress setting**,
not a per-object mark. Had this note searched only "bleed", it would have found print
guidance and concluded the ecosystem had a solved model. It does not.

**So: nobody has this shape.** Not "we searched and found nothing" — the searches
found the *opposite* shape, twice, and a standing request for ours. That is why
there was nothing to reuse and why this task built the thing; it is also why the
honest reading is that the design is unproven rather than conventional.

What the Fabric documentation does settle is the *shape of the persistence*, and it
matches `object-name.ts`: name the property, declare it in the serializer's include
list, validate it at load.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `bleeds?: true` on `NodeBase` | looks right, reads like the brief | tiny | **reaches the v1 widget tree and never a saved document** — the notice keeps firing for every marked object | **rejected** |
| Fabric custom property + `SceneBox` field | both surfaces traverse `sceneBoxesOf` | one constant, one validator check, one `SCENE_PERSISTED_PROPERTIES` entry, one `SceneBox` field | a persisted property is a contract: it must be validated and serialised, or it vanishes on save | **chosen** |
| A tri-state, a count, or `{ reason }` | richer | bigger | a document carrying `bleeds: false` on every object; more states than the decision has | rejected — one boolean |
| A scene-level or artboard-level "allow overflow" | one switch | small | **cages the author**: a single switch to suppress a warning about objects the author can see individually is a worse product than the bug. **This is Figma's own model** — `Clip content` is a frame-scoped boolean — so rejecting it is a decision to make a finer distinction than the field has made, not a departure from consensus | rejected — the device is a lens, not a constraint |
| Suppress the diagnostic for everything outside | trivial | zero | **the count stops being a count**; the half that matters most is lost | rejected |

## Rung 6 — probe

**The trap that decided the shape.** Before writing the flag, `NodeBase` was checked
for `visible`/`locked` and for any path to a persisted v2 scene: it is imported by
`theme/widget.ts` and by `validate.ts`'s v1 shape, and `FabricThemeEnvelope.scene` is
`Readonly<Record<string, unknown>>` — nothing maps a `NodeBase` field into it. So a
field there is invisible to a saved theme by construction, not by accident.

**The silent-drop probe.** `serialiseScene` passes `SCENE_PERSISTED_PROPERTIES`
explicitly. The list currently holds `id`, `name`, `vigiliaText`, `vigiliaPaint`,
`vigiliaAsset`, `vigiliaGlass`, `provenance`, `selectable`, `evented`, `locked`. A
property set on an object but absent from that list does not appear in
`canvas.toObject([...])` output and produces no diagnostic. This is why the round-trip
test is a first-class case rather than an afterthought.

**The group question, and a traversal change that was made and reverted.**
`countedBoxes` sets a depth watermark when it reports a box outside, so a *reported*
group's children are not re-reported. A **marked** group is different: it is skipped
by `countable` before the watermark is set, so the walk descends and each child is
judged on its own. That is the plan's stated behaviour twice — "a marked object
hiding a *real* problem (it must not suppress warnings about its own internal parts)"
and "marking a group does not silence its children".

An earlier version of this change also set the watermark on a marked box that was
itself outside, so that marking a card once was enough and a four-panel card did not
report four times. It was measured working — with the watermark the player read
"0 of 0" instead of "4 of 4" — and it was **reverted**, because a watermark there is
exactly the failure mode the plan names: a panel genuinely sitting outside the artboard
inside a deliberately-bleeding card would never be reported. The cost is real and is
recorded below rather than solved here.

**The question this leaves open, deliberately.** A marked card that hangs off the
edge reports **once per part**, so a four-panel card reads "4 of 4 objects are
outside this artboard" for what an author means as one deliberate composition. That is
noise the plan may not have anticipated. It is **not settled in this file**: a
decision about whether a marked group should speak for its parts is a product
decision above this one, and the answer belongs to the plan and the user, not to a
traversal edit made inside a task. `countable`'s comment carries the same note at the
code.

## Decision

**`vigiliaBleeds` is a validated Fabric custom property, declared in
`renderer-core/src/theme/bleed.ts` the way `object-name.ts` declares `name`, and
`SceneBox` gains a `bleeds` field read in `sceneBoxesOf` and honoured by
`countable`.**

1. **`countable`, not a branch in three readers.** `outsideCount`, `outsideEdges`
   and `outsideBoxes` all go through `countedBoxes`, which already asks
   `countable`. A bleeding object is a fourth instance of "the author's own doing"
   beside hidden and zero-area, so it joins that predicate. This is what makes the
   editor's count and the player's notice **structurally** unable to disagree.
2. **`bleeds?: true`, never `boolean`.** Absence and `false` both mean "not
   bleeding", but only `true` is persisted, so a document cannot come to carry
   `bleeds: false` on every object in it. The validator refuses anything that is
   present and is not exactly `true`.
3. **Absence means not bleeding.** A scene authored before this flag opens and reads
   exactly as it does today, on both surfaces.
4. **The validator check is not optional.** `fabric-envelope-validate.ts` is the
   trust boundary; an unvalidated persisted key is how a malformed value reaches
   Fabric's asynchronous revival. The check sits beside `objectName` and
   `objectGlass`, and the schema publishes the key beside theirs.
5. **An unmarked object still warns.** Marking silences the diagnostic for that one
   object and nothing else. This is the half that matters most; the tests pin it.
6. **A marked group does not speak for its parts.** The mark is asked of the group
   and the group answers only for itself. A child that sits outside the artboard is
   reported, whether or not its parent is marked — because the alternative is the
   failure mode the plan names by name. The price is the per-part noise recorded
   above, which is open rather than settled.

The cost of being wrong: **the flag is a persisted document key**, so it is a
contract a published schema and an external tool can see. And the ecosystem has
**not** solved this shape: the field's common answer is a frame-scoped `Clip content`
boolean, and the per-object version is a standing unanswered request. So this design
is unproven rather than conventional — which is a reason to keep the flag one boolean
and to let the plan amend the plan if the per-part noise proves real, rather than to
have the code absorb it silently.