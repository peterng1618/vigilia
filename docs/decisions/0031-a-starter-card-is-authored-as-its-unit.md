# 0031 — A starter card is authored as the unit it is, not stamped on the way in

- **Date:** 2026-10-07
- **Status:** accepted
- **Paths:** the editor's row projection, which no earlier note claims —
  `src/web/packages/editor/src/editor-shell/layer-tree.ts`

## The problem

The reference composition is the document every author meets first, and every
card row on it reads `Group` — the bare arm — while a card inserted from the
library names its unit (`CPU`). The projection already reads the fact: `groupRole`
takes `object.get("provenance")?.widgetName` (`layer-tree.ts:292`). The starter's
builders simply write no stamp, so the document holds nothing to read and the row
is right to say nothing.

So the shape is not "render a name". It is **where a unit's authored identity is
written**. The copy path writes it — `instantiateCard` puts `{ widgetId, widgetName }`
on the copy's root (`card-library.ts:250`, spread at `:450`) — and the starter is
the same eight cards authored once. A stamp the editor added at load time would be
runtime state wearing an authored hat (§67 of the authoring spec), and it would
vanish the first time the document was opened somewhere that derives its own rows.
The starter's cards are the only cards in the product that cannot say what they
are, and the two docstrings that argue the absence is deliberate
(`layer-tree.ts:65-67`, `:280-291`) are the sentences a fix makes false.

Two questions had to be answered, and neither is answered by the code: **which
module writes the key**, and **whether the ecosystem has a shape worth adopting**
before we invent one.

## Rung 1 — Vigilia

Searched: `provenance` across `src/web/packages` (12 source files, 14 with
generated `.d.ts`); `CARD_LIBRARY`, `insertGroups`, `groupRole`, `cardGroup`,
`ShapeKind`/`uiCopy.shapeKinds` label ownership; the pins in `card-library.test.ts`
and `new-fabric-theme.test.ts`; `docs/architecture/ownership.md`.

Found:

- **The stamp is written on the insert path only.** `instantiateCard` sets
  `context.provenance = { widgetId: options.unit.id, widgetName: options.unit.label }`
  (`card-library.ts:250`); `rootOf` spreads it on the root alone (`:450`) so a
  descendant never carries one. Pinned at `card-library.test.ts:274-293` — the root
  equals `{ widgetId: "group-cpu-card", widgetName: uiCopy.cardLibrary.cpu }` and
  every part is `undefined`.
- **Nothing in the starter writes it.** `grep provenance` over
  `new-fabric-theme-cards.ts` and `new-fabric-theme-objects.ts` returns nothing.
  `cardGroup` (`new-fabric-theme-objects.ts:96-119`) returns a `Group` with
  `type/id/name/left/top/width/height/objects` and no stamp.
- **The absence is documented as deliberate, twice**, in the places a fix falsifies:
  the type's group arm (`layer-tree.ts:65-67`, "the starter's own builders write no
  stamp, so on it every card row is the bare arm") and `groupRole`'s own docstring
  (`:280-291`).
- **The starter's names-equals-ids convention is pinned** at
  `new-fabric-theme.test.ts:352-380`, and its validity assertion — the one that
  catches a malformed stamp — is at `:384`.
- **The map has no row for the unit vocabulary.** `ownership.md:78` gives "Semantic
  layer projection" to `layer-tree.ts`; `:82` gives "New-object defaults (text,
  charts, shapes) and the shape list" to `new-object-defaults.ts`; **no row names
  `CARD_LIBRARY` or `uiCopy.cardLibrary`** (measured — `rg` over the map). The
  shape-list precedent is therefore the model a reader can follow: `SHAPE_KINDS`
  owns the membership (`new-object-defaults.ts:276`), `uiCopy.shapeKinds` owns the
  words, and `new-object-defaults.test.ts:626` asserts the two agree.
- **`cardGroup` has seven call sites, not eight.** Six builders call it directly
  (`new-fabric-theme-cards.ts:98, 151, 210, 418, 457, 525`) and `memoryCard`
  (`:271`) calls it once for both `ramCard` and `vramCard` (`:375, :389`). The eight
  cards come from those seven sites. The plan that prompted this note says "eight
  call sites"; that is a miscount, recorded here so a later reader is not misled by
  it. It changes nothing about the decision.

## Rung 2 — dependencies

Searched: Fabric 7.4.0's unknown-property handling and the persisted-key list
(`scene-fabric/src/persist.ts`), and the validator's provenance rule
(`renderer-core/src/theme/validate.ts`).

Found: **no library decision is involved; the key is already authored, persisted
and validated.** `PERSISTED_EXTRA_PROPERTIES` names `"provenance"` explicitly
(`persist.ts:71-77`) with the reason — a copy whose origin is remembered only
until the first save is a copy whose origin nobody can state. `validateProvenance`
(`validate.ts:895-913`) requires `widgetId` and refuses an unknown key inside the
stamp (`:163, :909`), and `card-library.test.ts:296-311` already proves the key
survives a save and a reopen. Writing the same key from a second call site uses
the mechanism that exists; it adds no dependency.

## Rung 3 — platform

Searched: whether Fabric restores a key it did not author — i.e. whether anything
in the renderer itself could be trusted to keep the stamp.

Found: **nothing native to use, and the question is already answered by
measurement.** Fabric does not author or restore arbitrary keys; the repo's own
`persist.ts` list is what carries `provenance` across a save, and `card-library.test.ts:296-311`
passes today on that list. So the platform question — "does a key it did not author
survive?" — is a measurement rung 2 already has, not an argument this rung has to
make. Nothing in the platform decides *where* the key is written, which is the real
question.

## Rung 4 — ecosystem

The searches are the evidence. Six queries were run through the Exa web search;
the sites read are recorded so the sweep is re-runnable.

**Query 1 — `Figma document JSON schema node stores componentId instances which
main component they derive from`.** Read: Figma's *File endpoints* and *Global
properties* REST docs, the *InstanceNode* plugin API, and a Figma-to-code pipeline's
node parser. **Found: Figma stores the pointer on the node, plus the node's own
name.** An `INSTANCE` node carries `componentId`; the file additionally carries a
`components` map from node id to component metadata, whose documented purpose is
"to help you determine which components each instance comes from". The plugin API
exposes `mainComponent` / `getMainComponentAsync()`. **How its shape compares to
ours:** identical in the part that matters — the *document node holds a pointer and
its own name*, and the definition is resolved through the pointer, never inlined
into every instance. The divergence is at the top: Figma's main is a distinct
`COMPONENT` node that carries identity as itself, while our starter's cards are
both the mains and the library, so there is no separate node for a stamp to point
at.

**Query 2 — `Sketch document file format symbolID symbolMaster instance which
symbol a layer is an instance of`.** Read: Sketch's *File format* and *API
reference* pages, the `sketch-hq/sketch-document` schemas, and a JS reader's
`SymbolInstance`. **Found: `SymbolInstance.symbolID` points at a
`SymbolMaster.symbolID`, resolved with `document.getSymbolMasterWithID(symbolInstance.symbolId)`;
the instance also carries its own `name`.** And a warning worth keeping:
`SketchAPI` issue #99 — "Be careful when dealing with names because they are not
unique." **How its shape compares:** the same pointer-plus-own-name shape as
Figma, and the same warning we already honour — our `widgetId` is the group id, the
durable key two copies share (`card-library.ts:64`), while `widgetName` is a word.

**Query 3 — `Penpot file format component-id component-file component-root shape
instance of a component`.** Read: Penpot's *.penpot file format* and *Data model*
help pages, its *Data Guide*, and issue #10839. **Found: a shape carries
`componentId` (UUID) and `componentFile` (UUID); the component file carries `id`,
a required `name`, and `mainInstanceId`.** Penpot records the pointer on the shape
so it can resolve back to the main, and it *validates the pointer*: issue #10839 is
a real `:component-id-mismatch` — "Nested copy component-id and component-file must
be the same as the near main" — raised on import when a shape's pointer went stale.
**How its shape compares:** this is the strongest external echo of our own design
*and* of our own hazard. The pointer lives in the document, the definition in the
library, and a document whose pointer is wrong is **refused by the validator**
rather than silently mis-rendered — which is exactly what `validateProvenance`
does here, and exactly the failure mode the projection is built to avoid by reading
the document's claim and never resolving through the library.

**Query 4 — `Webflow symbol component instance data-w-id w-id how component
instances identified in exported DOM`.** Read: Webflow's component-instance
Designer API, the *Localizing components* and *DevLink: what's exported* docs, and
the *Rename elements* help page. **Found: `data-w-id` is a per-element opaque id
used to keep attributes and links stable across locales — not a component id;
component instances carry `id` and `componentId`, and the display name is
*derived*.** The rename page is explicit: names are auto-derived from the main
component, and "custom names are only used for organization … they aren't
published in your site's HTML or exported code". **How its shape compares:**
Webflow is the data point *against* persisting a name — but its name is an
author's private organization label, whereas ours is the unit's own word and is
what the layer row must print. So it argues for id-as-identity, not against a
stored display name, and our `widgetName` is closer to Figma/Sketch's stored
instance name than to Webflow's local custom name.

**Query 5 — `design tool component instance store id not name rename-safety
instances update when component renamed stable identifier`.** Read: Figma's
*ComponentNode* API, its *Apply changes to instances* help page, the Figma forum
thread *Expose stable component identity for instance swap properties*, Figma's
blog *How We Rebuilt the Foundations of Component Instances*, and Brilliant's
components doc. **Found: the ecosystem is unanimous that the durable key is an id,
because names are editable and not unique.** The forum request is the shape in one
line — a handle whose `symbolId` "represents a file-local component node ID"
cannot survive aliasing, and the ask is for a stable key "independent of local node
IDs". Brilliant states the consequence: "Renaming a master frame does not rename
its instances." **How its shape compares:** this is the rule our stamp already
follows — `widgetId` is the id, `widgetName` the word — and it is the reason the
projection must read the *document's* stored word rather than re-resolving a name
from this build's library: a document written by another version must keep saying
what it said.

**Query 6 — `design tool starter template default document prebuilt objects
component metadata stamped only on insertion`.** Read: Layout's design-system docs,
a Sanity initial-value page, and two template repos. **Found: nothing.**
**Dead end, and recorded as one.** No design tool's documentation describes
stamping the objects of its built-in starter template with component-instance
metadata — every source is about a *user*-created template or about inserting
components into a live document, never about the shipped default document carrying
component pointers. So the ecosystem gives no precedent for the exact half this
decision is about; it gives the shape of the *stamp*, not the shape of stamping a
*starter*.

**Plainly: every tool stores a pointer plus the node's own name, resolves the
definition through the pointer, and warns that the name is editable and the id is
the stable key — but none of them stamps a starter, because in all of them the
starter's objects would be instances of a library that lives elsewhere.** Our
starter *is* the library: `CARD_LIBRARY.build` calls the starter's own builders
(`card-library.ts:73-94`). So the stamp we write is the one a copy already
carries, on the object that is both the main and the entry; the ecosystem confirms
the key's two halves and its home on the document's own node, and supplies nothing
that changes the decision — which is the useful answer, and a dead end in the one
place a precedent would have overridden it.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **The card's own assembler, `cardGroup`** — stamp `{ widgetId: id, widgetName: unit }` on the group it returns | provenance is authored state of the card, and `cardGroup` is where the card's authored facts already are ("the card, and the only place that says a panel is made of glass"); the unit's word stays owned by `uiCopy.cardLibrary`, read by both the builder and the library — the `SHAPE_KINDS` + `uiCopy.shapeKinds` + `new-object-defaults.test.ts:626` shape | one parameter and one spread in `new-fabric-theme-objects.ts`; eight builders pass their own `uiCopy.cardLibrary.<card>` | a builder that re-spells the label instead of reading it — the second owner the shape-list precedent exists to avoid; a stamp on a descendant rather than the root | **chosen** |
| **The library assembling the starter's scene** — `new-fabric-theme.ts` consumes `CARD_LIBRARY` and stamps after `cardGroup` returns | the library already owns the unit vocabulary, so the stamp and the words would be written in one place | `card-library.ts:16` already imports `createNewFabricTheme`; consuming `CARD_LIBRARY` from `new-fabric-theme.ts` closes a cycle between the theme assembler and the card library | a module-graph knot for one line of authored state — the price of one owner is a cycle here, not a simplification | rejected |
| **The projection deriving it** — `groupRole` resolves `widgetId` through `CARD_LIBRARY` and prints the library's label | no document change at all; the starter's cards would name themselves the moment the library does | zero writes | `groupRole` would then name a unit the document does not hold, which is the one thing a mark must never do and which `chartMark` already refuses for an unknown family (`layer-tree.ts:275`); a document written by another version would read as a document this build recognises | rejected |

## Rung 6 — probe

The gate's own exit codes are the runnable half of this decision, because the
decision's job is to unblock a watchlisted path. Command, run from the repo root:

```
printf '{"tool_input":{"file_path":"src/web/packages/editor/src/editor-shell/layer-tree.ts"}}' | node scripts/reuse-gate.mjs ; echo "exit=$?"
```

- **Before this note:** `exit=2`, refused, with the gate's own message naming
  `src/web/packages/editor/src/editor-shell/layer-tree.ts` as a mechanism boundary
  no note claims.
- **After this note:** `exit=0`, allowed. Task 6's docstring corrections to
  `layer-tree.ts` can land; without the note they are refused with no visible cause.

## Decision

**Write the unit's identity where a card is assembled: `cardGroup` stamps
`{ widgetId: id, widgetName: unit }` — typed `WidgetProvenance` from
`renderer-core` — on the group it returns, on the root alone, and each of the eight
builders passes its own word from `uiCopy.cardLibrary`. The projection keeps
reading the document and does not change behaviour; the two docstrings in
`layer-tree.ts` and the one on `WidgetProvenance` (`document.ts:228`) are corrected
in the same change, because a key's owner's own statement of what it means must
move when the key's scope does.**

The specific reasons:

- **The stamp is authored state, so it is written with the card's other authored
  state.** `cardGroup` already writes the card's `id`, `name` and geometry; the
  unit it is is the same kind of fact. Writing it later — at load, or in the library
  that assembles the scene — would make it runtime state (§67) and put it in a
  module that does not own the card's shape.
- **The key stays a fact about the file.** `persist.ts` already carries it across a
  save and a reopen (rung 2, measured), so the starter and a copy record it the same
  way and neither is a side table or a read-time lookup — §134's "Fabric JSON is
  still the document".
- **The projection stays a reader.** `groupRole` reports what the document holds and
  resolves nothing through `CARD_LIBRARY` (rung 5's rejected row); the existing
  `widgetId: "cpu"` case (`layer-tree.test.ts:888-921`) is what keeps it honest for
  a document this build does not know. Rung 4 confirms this is the discipline every
  tool keeps — the pointer resolves the definition, the document's own node says
  what it is.

**Cost of being wrong.** The mechanism is one key on eight existing objects, and the
failure modes are visible: a malformed stamp is refused by `validateProvenance` and
empties the canvas on save, and a stamp on a descendant rather than the root is
caught by `card-library.test.ts:274-293`'s descendant assertion. The one thing this
decision does *not* do is change the starter's `name` fields — names stay equal to
ids — so a card's *name* column still reads `group-cpu-card` while its *role*
column reads `CPU`; that is the unit's word, not the object's name, and conflating
them is a different decision with its own pin.
