# 0023 — The code decides what a theme may carry, and the published schema is held to it

- **Date:** 2026-10-02
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/`
  `schema/theme-document.schema.json`

## The problem

The envelope's allowed key bags are decided in two files that never consult each
other. `theme/validate.ts:76` holds a `KNOWN_KEYS` table of 22 shapes; the
published `schema/theme-document.schema.json` declares `additionalProperties:
false` over 12 `$defs`, and the two overlap on eight of them. Neither generates
the other, so a key added to one is invisible in the other.

The shape of the problem is not "validate a theme" — the validators exist and
work. It is **two registries for one membership, one of which is published to
third-party tools**. `docs/architecture/ownership.md` already says what that is:

> Re-spelling the set, or a subset of it, somewhere else is a **second owner**,
> and it fails quietly: the two agree until someone adds a member, and then the
> new one is simply never seen by whoever re-spelled it.

The hazard is specific and it has a direction. The schema is the *stricter*
reader, so the failure is a theme the editor authored and will open, refused by
every tool that validates against what Vigilia published. Nothing throws at
authoring time; it throws when somebody else opens the file.

`KNOWN_KEYS.binding` (six keys) versus `$defs/binding` (six keys) happened to
agree by coincidence and both disagree with `fabric-envelope-validate.ts:851`,
which accepts eight — `format` and `timeZone` included, authored by the editor's
own runs panel (`selection-inspector/runs.ts:168-183`) and persisted by
`serialize.ts:47-48`. **That drift exists today, without a rename**, and is the
row's failure already happening.

## Rung 1 — Vigilia

Searched: `KNOWN_KEYS`, `knownKeysFor`, the inline key lists in
`fabric-envelope-validate.ts` (envelope root, globals, bindings, text-run style,
backgroundMedia), `serialize.ts`'s `KEY_ORDER`, `fabric-envelope-schema-sync.test.ts`,
`ownership.md`'s registry.

Found: **the repo already answered this, three times, for the same class of
drift.** `fabric-envelope-schema-sync.test.ts:112-176` compares the schema's
glass blur bound against the exported `MAX_GLASS_BLUR_RADIUS`, the schema's
object-kind enum against the exported `GLASS_TYPES`, and the name length against
`MAX_OBJECT_NAME_LENGTH` — each "against the exported set, not a copied list, so
widening one side without the other fails here". The envelope's *key bags* were
never given the same treatment, which is the gap vg-095 names.

`serialize.ts`'s `KEY_ORDER` is a third list but a different concept: canonical
write order, not membership, and it names keys from shapes the schema does not
publish. It is not a third owner of this decision and is not touched.

## Rung 2 — dependencies

Searched: `src/web/package.json` and every `packages/*/package.json` for `ajv`,
`json-schema`, `jsonschema`, `@types/json-schema`. Dependencies of the
workspace root and of `renderer-core`: `echarts` only; dev: vitest, playwright,
biome, jsdom, canvas, vite, typescript.

Found: **nothing.** No JSON Schema validator is installed and none is implied.
`AGENTS.md` forbids adding a shipped dependency without licence review in
`THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md`; adding one to
*enforce an internal contract between two files in one repo* would be the
expensive kind of wrong this repo keeps warning about.

## Rung 3 — platform

Searched: JSON Schema 2020-12 vocabulary for cross-document references —
`$dynamicRef`, `$dynamicAnchor`, `$defs` resolution, `$data`, `$async`; Node's
`import ... with { type: "json" }`; `JSON.parse`.

Found: **the platform has no answer to the useful half of this.** Draft 2020-12
resolves `$ref` *within a schema*; it cannot express "this key must name an id
declared elsewhere in this document". `$data` and `$async` are Ajv extensions,
not standard, and even Ajv documents them as non-portable. Measured, the thing
that looked expensive is not: `JSON.parse` of the 9,862-byte schema is **0.054
ms** (1000 iterations, 53.7 ms total). So a runtime schema read would be cheap
to *parse* — which means the argument against it is not performance and must not
be made on those grounds.

## Rung 4 — ecosystem

Searched: ajv issue #1956 "Add a method for generating JSON Schema from Ajv"
(thread on one source of truth for schema + types); ajv `standalone.html`
(build-time codegen of a validation function); json-schema-to-typescript and
quicktype (schema → types codegen); TypeScript `satisfies`-style schema typing.

Found: the ecosystem has three answers and **every one of them assumes the
schema describes the whole document** — which is the assumption that does not
hold here.

- *Schema as source, validate with ajv.* The thread's own conclusion is that
  TypeScript types "are way too constrained to be the source of truth to
  everything" and "should be derivatives off the json schemas". Sound advice for
  a document JSON Schema can fully describe. Vigilia's cannot: cross-reference
  invariants — `unresolved-asset-ref`, `unresolved-global-ref`, `duplicate-id`,
  `binding-count`, node depth and count bounds — are the reason `validate.ts`
  is 1,600 lines, and the schema says as much itself: *"Vigilia validates object
  identity, nesting bounds and JSON safety before revival."* Adopting ajv would
  mean deleting those checks to satisfy a registry.
- *Ajv standalone codegen.* Compile the schema at build time into a plain
  function, no runtime engine. Solves the startup cost that is not the problem
  here, and still covers only the eight overlapping shapes.
- *Schema → types codegen.* The same thread warns quicktype's output "can be far
  from human-readable", and types are not validation: the hand-written checks
  would survive as a second validator anyway.

**Nobody in this search solved the shape we have**, which is a validator that
must be *strictly stronger* than a published schema, over a document the schema
only partially describes. The closest real precedent is protobuf — one `.proto`
generating both a descriptor and per-language types — and it works because the
schema there is total. Here it is not, and making it total would mean publishing
the v1 node tree, which `fabric-envelope-schema-sync.test.ts:37` explicitly
forbids (`expect(document.properties["nodes"]).toBeUndefined()`).

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Validator reads the schema at load | covers 8 of 22 shapes; the other 14 have no `$def` at all | import a repo-root JSON across a package boundary into the player bundle; parse cost measured negligible (0.054 ms) | the 14 uncovered shapes get no owner, so the row survives for most of the list; a second validator (ajv) still needed for the cross-reference checks | rejected |
| Generate the schema from the code | total by construction | a generator that reproduces patterns, `oneOf`, enums and `$refs` for all 187 lines | the published contract becomes build output and stops being reviewable; the schema's `description` prose has nowhere to live | rejected |
| Validate with ajv at the boundary | total for the published half | a new shipped dependency with licence and notices work | deletes `duplicate-id`, `unresolved-asset-ref`, `unresolved-global-ref` and `binding-count`, or leaves them as a second validator | rejected |
| **Code decides; a test holds the schema to it** | covers every shape, and every key set the schema publishes | one exported table plus one test | a drift is found by the test, not prevented by construction | **chosen** |

## Rung 6 — probe

- Schema is 9,862 bytes; `JSON.parse` ×1000 = 53.7 ms → 0.054 ms each. The
  runtime-read cost is small, which is why it was rejected on coverage and on
  the checks it cannot express, not on speed.
- 12 of 21 `$defs` are closed bags. Against `KNOWN_KEYS`' 22 shapes: eight are
  backable (`metadata`, `artboard`, `binding`, `assetReference` as the union of
  `fontAssetReference` and `nonFontAssetReference`, `typePreset`,
  `fontFaceReference`, `globalEntry`, plus the envelope root and `globals` read
  from inline lists). **Fourteen have no published counterpart at all** —
  `document`, `transform`, `node`, `textContent`, `textBox`, `literalRun`,
  `valueRun`, `chartContent`, `rectangleContent`, `imageContent`,
  `videoContent`, `widgetProvenance` and the four chart settings shapes —
  because in v2 they live inside Fabric JSON, which the schema validates as
  opaque `jsonValue`.
- The live drift: `$defs/binding` publishes six keys; the v2 validator accepts
  eight; `selection-inspector/runs.ts` authors two of the missing pair and
  `serialize.ts` persists them.

## Decision

**`renderer-core/src/theme/` decides. The published schema stays a hand-written
contract, and a disagreement test derives its key sets from the file and compares
them against the exported table.**

Concretely:

1. `KNOWN_KEYS` gains the v2 envelope root, `globals` and `backgroundMedia` so
   the three inline lists in `fabric-envelope-validate.ts` and `validate.ts:528`
   read the owner instead of re-spelling it — `ownership.md`'s "delete the second
   decision", not "make one list read the other".
2. `KNOWN_KEYS.binding` gains `format` and `timeZone`, which the validator ten
   lines below already validates and the editor already authors; today that
   validation is unreachable because the key list refuses the key first.
3. `schema/theme-document.schema.json` publishes `format` and `timeZone` on
   `$defs/binding` at the bound the validator enforces. The schema is changed
   because the *code is the decider*, not because it is easier to edit.
4. A test builds a real v2 envelope and asks both registries the same question
   about the same document — the renamed key and the drifted keys — and fails
   when they answer differently.

What this gives up: drift is detected by a test rather than made impossible.
A code change and a schema change in one commit can still be individually
wrong, and the test must be run. The alternative — making the schema the source
— was rejected because it cannot describe 14 of the 22 shapes, and because a
JSON Schema validator cannot express the cross-reference invariants this
validator exists to enforce.