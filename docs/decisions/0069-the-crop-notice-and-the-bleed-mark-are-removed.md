# 0069 — The crop notice and the bleed mark are removed, and every overhang counts

- **Date:** 2026-10-18
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/bleed.ts`,
  `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`,
  `src/web/packages/scene-fabric/src/persist.ts`,
  `src/web/packages/editor/src/editor-session.ts`

## The problem

Decision [0027](0027-a-deliberate-bleed-is-marked-not-warned-about.md) made a
deliberate overhang a marked object: a persisted Fabric property
(`vigiliaBleeds`), a `SceneBox.bleeds` field, a term in `countable`, a validator
check, a schema entry, an inspector toggle, and a player strip that said
nothing about a marked object. The user ruled on 2026-10-18, asked directly to
settle the scope: **"BOTH, EVERYWHERE"** — a display raises no crop notice at
all, and the bleed toggle leaves the selection inspector. Nothing is marked, so
every overhang counts as cropped.

Two boundaries sit outside the ruling. The artboard panel's own crop figure
**stays** — it is the editor's count of what the frame loses, on the one surface
where the figure is actionable, and the user named a notice and a toggle rather
than the author's own measurement. And the persisted key's removal was ruled
separately and is not re-opened here; what this note adds is the evidence that
made it safe (rung 6).

The consequence, recorded rather than left to be discovered: with the mark gone
the count cannot exclude a deliberate bleed, so an object that runs off the edge
on purpose reads as a fault for as long as it stands.

## Rung 1 — Vigilia

Searched: every tracked file for the two subjects — `git grep -n "vigiliaBleeds"`
and `git grep -n` over `VIGILIA_BLEEDS_PROPERTY`, `objectBleeds`, `isBleedMark`,
`writeMark`, `bleedField`, `SceneBox`, `countable`, `cropNoticeText`,
`showCropNotice`, `vigilia-crop`; `renderer-core/src/theme/` for the flag's
readers; `scene-fabric/src/artboard-crop.ts` for the traversal; the editor's
`selection-inspector/` for the control; `player/src/` for the strip.

Found: **the mechanism is complete and its every site is one of the seven the
row already names** — `bleed.ts` (the property, the reader, the guard),
`fabric-envelope-validate.ts` (the import, the call, `objectBleeds`),
`persist.ts`'s `SCENE_PERSISTED_PROPERTIES` entry, `artboard-crop.ts`'s
`SceneBox.bleeds` and `countable` term, `selection-inspector/bleed.ts` and the
`positionBody` row that renders it, `player/src/artboard-crop.ts`'s
`cropNoticeText` and `chrome.ts`'s `showCropNotice`. Two corrections to the
row's own blast radius, both found here:

- **There is no `validate.ts`.** The row, the brief and the plan's Step 3 all
  name "`validate.ts`'s hand-maintained keys"; no such file exists in the tree.
  Decision [0041](0041-retire-schema-v1-by-deletion.md) deleted it, and the
  sentence in the plan's Step 3 is quoting 0041's own history rather than the
  current tree. The hand-maintained surface that actually moved is the published
  schema plus `fabric-envelope-validate.ts`'s named check.
- **`[data-vigilia-crop]` is two different things.** The player's notice strip
  and the editor's image-crop button both carry that attribute, on different
  surfaces. Only the player's is removed; the editor's crop session
  (`crop-manager`, `data-vigilia-crop`/`-aspect`/`-apply`/`-cancel`) is untouched.

## Rung 2 — dependencies

Searched: `fabric@7.4.0`'s `toObject(propertiesToInclude)` /
`FabricObject.customProperties` (the persistence route 0027 documented), and
whether anything else reads the property.

Found: **nothing to reuse, and nothing that survives.** The property was the only
member of `SCENE_PERSISTED_PROPERTIES` whose single consumer was the flag itself;
`persist.ts`'s list entry is a deletion, not a rewrite. Fabric's persistence
needs no change: a custom property absent from the include list is simply not
written, which is exactly the wanted behaviour once nothing writes it.

## Rung 3 — platform

Searched: nothing new — the question the platform was asked in 0027 ("does
anything native express 'this child overflows on purpose'?") was answered there
and no longer has a consumer.

Found: **nothing to ask.** The removal needs no platform feature; the notice it
deletes was Vigilia's own sentence about Fabric's own clip.

## Rung 4 — ecosystem

Searched: nothing new, and deliberately. The behaviour removed is a Vigilia-only
signal — a display telling a reader that the artboard does not contain the
scene. 0027's rung 4 is the survey of record for the *mark* (Figma's frame-scoped
`Clip content`, the standing per-object request, the print-bleed naming trap) and
it is what established that the mark had no analogue to reuse.

Found: **the ecosystem question does not reopen.** Removing a signal no external
tool consumes needs no prior art; the published schema entry that made it a
contract for an outside tool is what goes with it.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Delete the mark, the toggle and the notice outright | the ruling, in full | one property, one field, one term, one validator check, one schema key, one control, one strip | an author loses the only way to say an overhang is deliberate | **chosen** — the user ruled it |
| Keep the mark, drop only the notice | half the ruling | the property, the toggle and the count exclusion stay | "EVERYWHERE" is not met, and the count still excludes what a reader is not told about | rejected |
| Keep the key, refuse it on read | no document rewrite | — | **refuses a theme that saved the mark**, which is data loss; and rung 6 shows no document carries it, so the refusal buys nothing | rejected |
| Keep the key, drop it on read | tolerant | a migration path nothing needs | dead code for a document that does not exist | rejected |
| Delete the key from the schema, keep it allowed by `additionalProperties` | one line | — | none: an old document still loads, it just is not a contract any more | **chosen** — the schema key is a contract, and the object's `additionalProperties: jsonValue` is what keeps a stale document loadable |

## Rung 6 — probe

**The persisted-key search, re-run by this task rather than quoted from the row.**
`git grep -n vigiliaBleeds` over tracked files finds it in the published schema
(`schema/theme-document.schema.json:156`), in `renderer-core`'s source, in
decision 0027, in the tests, and in **no theme file**. `git ls-files "*.json"`
over the tree shows no other theme document. The author's own app folder
(`~/.vigilia/themes/`) holds five theme folders and **zero** occurrences of the
key; the two generated themes that did carry it
(`src/web/.e2e-host-app/themes/e2e-bleed/` and `e2e-bleed-all/`) are gitignored
(`.gitignore:16`) and written by the specs that exercise the notice, so they
disappear with the specs.

**So there is no authored work to strand.** Removing the key is a schema and
source deletion rather than a rewrite of anyone's document, and the schema's
`additionalProperties: { "$ref": "#/$defs/jsonValue" }` on `fabricObject` means a
document that still carries it opens exactly as before.

**What the probe did not settle, and is not claimed:** whether the crop strip is
the mechanism behind the phone player's intermittent leftward slide
([`vg-572`](../product/backlog.jsonl)) is a separate reading, taken by this
task's browser pass and reported to the controller rather than decided here.

## Decision

**The mark, the toggle and the notice are deleted, and the published key is
removed from the schema.** `VIGILIA_BLEEDS_PROPERTY`, `objectBleeds` and
`isBleedMark` leave `renderer-core`; `SceneBox` loses `bleeds` and `countable`
loses the term; the inspector loses `bleedField`, `writeMark` and its
`bleeds` branch; the player loses `cropNoticeText`, `showCropNotice` and the
`vigilia-crop` strip. The artboard panel's figure stays, and now excludes
nothing.

The specific reason: the user ruled both halves, and the evidence in rung 6 shows
the persisted half costs no authored work. The cost accepted with it is that the
count can no longer be told a deliberate overhang apart from a mistake, which is
recorded above rather than left to be discovered.
