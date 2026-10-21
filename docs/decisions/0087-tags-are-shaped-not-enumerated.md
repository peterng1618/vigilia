# 0087 — Style tags are shaped, not enumerated

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/document.ts`
  `src/web/packages/renderer-core/src/theme/envelope-keys.ts`
  `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`
  `src/web/packages/renderer-core/src/theme/facet-record.ts`

## The problem

The theme library's Style facet is the one facet of the five that the format has to
carry: author, colour mode, sensors and shape are derived from the document, while a
style tag is a fact about *the theme* that has to travel in the package or the
catalogue cannot be filtered by it.

The shape worth solving: **a controlled vocabulary that must grow without a schema
release.** A closed `enum` in `metadata.tags` is the obvious build and it is the one
that fails, because the day an author has a theme that is *dystopian* and the
vocabulary says *retro*, *neon* and *sci-fi*, the field is unusable and the release
that fixes it is a format change. The inverse — free text with no shape — is the
failure the facet exists to prevent: `sci-fi`, `scifi` and `science fiction` become
three tags with one theme each, and browsing by style stops working.

So the question is not "how do we validate a tag list". It is **where the boundary
between the format and the vocabulary sits**, given that the vocabulary lives in a
catalogue this repo does not own.

## Rung 1 — Vigilia

Searched: `tags`, `TAG_PATTERN`, `MAX_TAGS` across `renderer-core`, `theme-package`,
`schema/` and the editor; `ThemeMetadata` and every existing member of it; the two
schema registries (`envelope-keys.ts`, `envelope-keys-disagreement.test.ts`,
`fabric-envelope-schema-sync.test.ts`); `facet-record.ts` and `FacetRecord`; the
nearest precedent for a bounded string vocabulary, `themeLanguage`'s `isLocaleName`.

Found: **nothing named a tag anywhere** — the grep returns no `tags` member, no
pattern, no constant. The relevant precedent is the *opposite* one and it is
instructive: `themeLanguage` is bounded by `isLocaleName`, which reads a curated list
(`scene/datetime/names.ts`) owned by this repo, and the validator refuses a
well-formed tag the list does not hold. That is the right shape for a language, whose
set is finite and known, and the wrong one for a style, whose set grows with what
authors make.

`facet-record.ts` (docs/decisions/0077) already exists and is where the derived
facets live; it reads `envelope.metadata?.author` today and reads nothing else out of
`metadata`. It is claimed by this note because the tag list has to arrive there, and
that arrival is Task 6's.

## Rung 2 — dependencies

Searched: `packages/renderer-core/package.json`, `packages/editor/package.json`, the
root `package.json`, and the workspace for any schema or slug library
(`ajv`, `json-schema`, `zod`, `slugify`, `normalize-*`).

Found: `renderer-core` has exactly one dependency, `echarts@6.1.0`; the editor has
`@base-ui/react@^1.8.0`, React and Tailwind. **No JSON Schema validator is installed
anywhere** — the published schema is never executed in this repo, it is only read as
a file by the two drift tests. Nothing in the dependency set has an opinion about
tags, and nothing needs to be added: the shape rule is one `RegExp` and one length
comparison.

The picking affordance is not this task's, but the rung is answered here so the next
one does not re-open it: `node_modules/@base-ui/react/` carries `autocomplete/` and
`combobox/`, so the field that offers the vocabulary is a primitive this project
already installs.

## Rung 3 — platform

Searched: the JSON Schema 2020-12 keywords the published schema can express
(`pattern`, `maxItems`, `items`, `uniqueItems`), ECMAScript `RegExp`, and `Set` for
deduplication.

Found: the platform gives the two rules the spec asks for and **cannot give the third
one**. `pattern` and `maxItems` publish the shape and the count to any tool outside
this repo, and `RegExp` enforces the same shape in code — one line each, no library.
What it cannot do is bound *membership*: a JSON Schema `enum` is a static array in a
file this repo ships, and the vocabulary is a catalogue's own content that changes
between releases. `uniqueItems` is available and deliberately unused — the facet
deduplicates, and a rule the spec did not ask for is a second rule to keep in step.
`Intl` was checked and is irrelevant here: it knows language and number formats, not
tag vocabularies.

## Rung 4 — ecosystem

Searched: how GitHub topics are specified and enforced (`docs.github.com`,
`github/explore`'s `docs/API.md`); npm keyword rules as applied by a normalizer; npm
and GitHub for tag-normalizer libraries (`normalize-keywords`, `laravel-topic-normalizer`,
`@photogabble/eleventy-plugin-tag-normaliser`, `@waypointnull/tag-search`); the
`cairn` project's `docs/tags.md`, whose non-goals list is a written-out version of
this decision.

Found: **the shape-and-count-only split is what everyone who has solved this shape
landed on, and the ones who enumerate a vocabulary put it outside the format.**

- GitHub enforces "lowercase letters, numbers, and hyphens", "50 characters or less",
  "no more than 20 topics" — a shape and a count, and *no allow-list*. The vocabulary
  that does exist lives in `github/explore`, one file per topic with an `aliases`
  field, reviewed by PR. The near-synonym problem is solved by a human reading a diff,
  which is exactly the ordering this spec chose.
- `laravel-topic-normalizer` merges several tag sources into "slugged, deduplicated,
  length-filtered and capped" — normalize, dedupe and cap are **consumer** operations
  there, and its config caps (20, 50 chars) are the same numbers GitHub documents.
  `normalize-keywords` sorts and removes duplicates for the same reason.
- `cairn`'s tags document states the split in its own words: tags are free-form,
  slugified at write time, deduped in a three-line pipeline, and **"controlled
  vocabulary" is listed under non-goals**, because locking them down forces the prompt
  to enumerate allowed values and the model gets worse on documents that do not fit.
  `@waypointnull/tag-search` is the far end of that: 322k tags resolved against a
  downloaded list, with normalization and fuzzy matching in the library and the list
  kept as data beside it.

What nobody does is put the vocabulary in the file format. The nearest counter-example
— `@photogabble/eleventy-plugin-tag-normaliser`'s "Tag Atlas" — is a plugin config
mapping near-synonyms onto canonical slugs, i.e. a consumer-side vocabulary with the
same job as our catalogue.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `enum` in `metadata.tags` and in `KNOWN_KEYS` | Refuses near-synonyms outright, which is the facet's whole point | A vocabulary change is a schema release, in two registries plus the drift test | An author with a theme the vocabulary cannot describe is blocked, and the format is what blocked them | rejected |
| Shape + count, no uniqueness, no slugify | The vocabulary grows through a catalogue PR and the format never needs to know it | A tag no other theme has is writable, and the facet shows it with a count of 1 | Two near-synonyms can exist until a reviewer catches them — the price the spec names and accepts | **chosen** |
| Shape + `uniqueItems` | Cheap: one schema keyword | The facet dedupes anyway, so the rule is enforced twice and can disagree | A theme refused for a duplicate the facet would have collapsed | rejected |
| Slugify at write time (cairn's rule) | Never refuses anything | `Science Fiction` silently becomes `science-fiction`, a tag the author did not pick | The author's own vocabulary drifts from what they typed, and this repo refuses rather than coerces invalid input | rejected |
| A seed list shipped in `renderer-core` | Works offline | A second owner of the vocabulary, which then falls out of step with the catalogue | The editor offers a word the catalogue does not have, or omits one it does | rejected |

## Rung 6 — probe

Measured 2026-10-21 in this checkout, before the change.

1. **The pattern's own boundaries**, run directly against
   `/^[a-z0-9-]{1,24}$/` (`node`, scratch script outside the repo):

   | Value | Result |
   |---|---|
   | `retro`, `neon-2` | accept |
   | `Retro`, `science fiction`, `science_fiction` | refuse |
   | 24 chars | accept |
   | 25 chars | refuse |
   | `""` | refuse |
   | `-`, `neon--2` | accept |

   The last row is the one worth recording: the pattern does **not** police a leading
   hyphen or a doubled one. That is deliberate — the format's rule is the shape and
   the count, and "is `neon--2` a near-synonym of `neon-2`" is a reviewer's question,
   not a schema's.

2. **What the current build does with a tagged theme.** `validateFabricThemeEnvelope`
   on a v2 document whose `metadata` carries `tags: ["retro", "neon-2"]` answers
   `ok: false`, `{ code: "unknown-field", path: "/metadata/tags", message: "Document
   metadata has no \"tags\" property. Did you mean \"name\"?" }` — the
   `additionalProperties: false` consequence the spec names, and the typo diagnostic
   that is the reason `KNOWN_KEYS.metadata` gains the key while the values get
   nothing. Measured as the red run of the seven cases this change adds
   (`npx vitest run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts`
   from `src/web/`: 7 failed, 44 passed, every failure `unknown-field` at
   `/metadata/tags`); the consequence is accepted rather than softened, so no
   compatibility path is added for it.

## Rung 7 — build

The whole change is a shape rule stated twice, deliberately, in the two registries
that already exist for exactly this: `document.ts` owns the pattern and the cap
(exported, so the editor's control and the validator refuse the same values from one
constant), `fabric-envelope-validate.ts` reads them, `envelope-keys.ts` gains the key
so a typo diagnostic can suggest it, and the schema publishes the same two keywords.
The tag *values* get no enum in any of the four — that absence is the decision, and a
test asserts it rather than a comment.

## Decision

**`metadata.tags` is validated for shape and count and for nothing else: lowercase
`[a-z0-9-]`, one to twenty-four characters, at most five members, duplicates allowed.**

The specific reason: the vocabulary has to grow through the catalogue's own PR —
"the word and its first use together, which is the only review that can catch a
near-synonym" — so an `enum` in the format is a release gate in front of an author,
and a slugify-at-write rule silently edits the tag the author chose. Both are refused
for the same reason the field is bounded at all: the format's job is to keep the file
readable, and a reviewer's job is to keep the vocabulary clean. GitHub, npm and
`cairn` all draw that line in the same place; the projects that draw it elsewhere keep
the vocabulary in a data file beside the format rather than inside it.
