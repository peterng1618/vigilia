# Theme versioning and identity — design

Date: 2026-10-22
Status: landed 2026-10-22. The ladder and id contract stand; the GitHub
submission files cited under "Current state" were replaced by the Worker
backend ([R2 store design](2026-10-22-r2-store-backend-design.md)), so those
citations are the state the design was argued from, not today's code.
Related: [theme store design](2026-10-12-theme-store-design.md) (phases A–G, landed),
[decisions/0090](../decisions/0090-submission-is-a-hand-rolled-github-client.md),
[decisions/0091](../decisions/0091-the-normalizer-bundles-a-gpl-ffmpeg.md).

## Purpose

Two changes to the catalogue's contract, landed together because both are
properties of one item's identity:

1. **The version bumps automatically at submit**, by a ladder that is a
   function, not a judgement, so the app and the catalogue's CI reach the same
   answer from the same bytes.
2. **A theme's id is a UUID**, minted when the document is created. The
   catalogue already treats the id as the item's identity — directory name,
   file name, `packageUrl`, and the package's own envelope — but ids are
   currently literals, so two authors can aim at one directory.
3. **A remix credits its parent**, because a modified copy of an installed
   theme cannot keep the original id: ownership refuses it, so the app mints a
   new one, and that is the moment provenance is either recorded or lost.

## Current state

Facts this design is argued from, each at its owner:

- `github-item.ts:117-120` publishes `theme.version` when the document declares
  one and `1.0.0` otherwise. Nothing computes it; nothing compares it with what
  is already published.
- `metadata.version` is optional on the envelope, and the schema constrains it
  to `^\d+\.\d+\.\d+$` (`fabric-envelope-schema-sync.test.ts:100`). Prerelease
  and build tags are already illegal, so the ladder only ever produces a
  numeric triple.
- `item.json` has no `id`; the catalogue directory's name is the id
  (`catalogue-index.ts:46-50`). `validate-item.ts:65-114` already pins the
  directory, the package file, the URL and the package's own id to one value.
- `item.json`'s `createdAt` is the submission instant on every submission
  (`github-item.ts:113-127`), so a re-publish resets the item's recorded birth.
- Theme ids are literals and slugs: the starter is `yunari-demo-dashboard`
  (`new-fabric-theme.ts:37`), every blank theme is `yunari-new-theme`
  (`:270`), and a save lands under the document's own id
  (`theme-library-manager/index.ts:232`). Import keeps the package's id when it
  is free and stamps a suffixed one when it is not (`import.ts:102-107,141-148`).
- The host already records where a theme came from, beside the library and
  outside the document: `ThemeOrigin { catalogueId, version, installedAt }`,
  keyed by library id (`settings/theme-origins.ts`, surfaced as
  `ThemeLibraryEntry.origin`). Nothing copies it into the document or into a
  published item, so it dies with the machine.
- The catalogue's CI runs `validate-item` per touched directory
  (`C:\tmp\yunari-store\.github\workflows\validate.yml:38-56`) with
  `fetch-depth: 0`, and auto-merge admits only paths matching
  `catalogue/[A-Za-z0-9_-]{1,64}/…` (`auto-merge.yml:123`).

## The contract the ladder encodes

**A theme's interface is the sensors it binds and the canvas it was designed
on.** Everything else is content. This is the whole classification rule; the
table below only applies it.

- An object is content: deleting a chart changes what a display shows, not what
  the theme means.
- A sensor is interface: if a display no longer reports the sensor it used to,
  something that asked this theme for that fact has lost it.
- The canvas is interface: every object's placement was measured against it.

Consequence worth stating because it is the counter-intuitive one: **deleting
one of two charts showing CPU is a minor release; deleting the only one is
major.**

### Levels

| Level | Covers |
|---|---|
| `initial` | No published item. The version is `1.0.0`. |
| `major` | `schemaVersion` changed; `artboard.width` or `artboard.height` changed; the set of bound sensors shrank. |
| `minor` | A sensor was added; a scene object, asset, palette token, type preset or tag was added or removed; `artboard.backgroundMedia` was added, removed or changed. |
| `patch` | Any other change inside an existing structure: paint, text, geometry, z-order, an object's own properties, a kept sensor's binding, `metadata.name`/`author`/`description`/`themeLanguage`/`remixOf`. |
| `none` | Nothing changed but the fields classified as ignored below. |

The set of bound sensors is the union of every binding's `semanticKey` across
all objects — not the keys of `bindings`, which are scene object ids
(`fabric-envelope-validate.ts:1032-1055`). Moving a binding from one object to
another keeps the sensor bound and is a patch.

Objects are matched by their `id` at any nesting depth, and by array index only
when a document carries no id for them. An id that disappears and one that
appears under a different id are an addition and a removal, even when the
author copied an object — that errs upward, which is the direction the ladder
always errs.

### Ignored fields

`fabricVersion`, `id`, `scene.version`, `editorMetadata` (whole member),
`metadata.version`, `metadata.createdAt`, `metadata.updatedAt`.

An editor upgrade, a save, or a re-publish must not force a release, and these
are the fields such events move. `id` is ignored because the diff runs only
between documents already proven to be the same item, so it cannot be telling
the ladder about a different theme. Tags are compared as a set: reordering them
is no change.

### Top-level members not in the table

Every member the envelope schema allows must be classified, and the coverage
test below holds that closed. At runtime, an unrecognised top-level member is
**major** — a member a build does not understand is a format change, and the
ladder errs upward.

### Arithmetic

`bumpVersion(previous, level)` parses `^(\d+)\.(\d+)\.(\d+)$` into three
integers and answers `M.0.0`, `M.m.0` or `M.m.p`. No floating point, no
`semver` dependency: the schema has already excluded every form a general
semver library exists to handle.

`versionFor(previousVersion | undefined, change)` is the one helper both the
host and the CI call: `undefined` answers `1.0.0`; `none` answers the previous
version; otherwise `bumpVersion`.

## Where it runs

### One owner, two callers

`theme-package/src/version-ladder.ts`:

```ts
export type VersionLevel = "initial" | "none" | "patch" | "minor" | "major";
export interface ThemeChange {
  readonly level: VersionLevel;
  /** Which rules fired, deduplicated, in a fixed order — the editor maps these
   *  to one sentence each; the classifier never writes prose. */
  readonly reasons: readonly ChangeReason[];
}
export function classifyThemeChange(
  previous: FabricThemeEnvelope | undefined,
  next: FabricThemeEnvelope,
): ThemeChange;
export function bumpVersion(
  previous: string,
  level: "patch" | "minor" | "major",
): string | undefined;
export function versionFor(
  previous: string | undefined,
  change: ThemeChange,
): string | undefined;
export function isSemanticVersion(text: string): boolean;
```

Both arithmetic functions answer `undefined` rather than guessing when the
previous text is not a version, so every caller has one refusal to write.
```

It lives in `theme-package` because the catalogue's CI already depends on that
package and must make the identical ruling from the package bytes alone.

### Submit

`submissionFiles` (`github-item.ts`) owns the whole decision, in this order:

1. Read the library theme. Refuse as today when absent or invalid.
2. Read the published item — `catalogue/<id>/item.json`, then
   `catalogue/<id>/<id>.zip`, both from `CATALOGUE_RAW_BASE`
   (`catalogue-source.ts:9-15`), through an injectable `fetch` as
   `github-submit.ts` already does.
   - `item.json` 404: no published item. Everything else that is not 200, an
     unreadable package, a package whose id is not this id, or an unparseable
     item is a **refusal**, never "first submission".
3. `classifyThemeChange(published?.envelope, next)`; `versionFor(...)`.
4. `none`: refuse, naming the published version.
5. **Write the version into the library document** with
   `store.write(id, { envelope: withVersion, assets }, { base: theme.base })`,
   then build the package and `item.json` from the written document. A refused
   write (a concurrent save moved the theme) is the refusal; nothing is
   uploaded.
6. `item.json` carries the same version, the published item's `createdAt`,
   `downloads` and `favorites` when there is one, the document's `remixOf` when
   it has one, and the submission instant as `updatedAt`.
7. `SubmissionFiles` gains `version` and `level`; the submit route returns
   them, and the store surface shows `1.4.0 → 1.5.0 · minor` after the PR is
   opened, then re-reads the library so the caption line shows the new version.

**The host writes the document, not the editor.** Submit operates on a stored
theme, which may not be open; only the store can write either. The editor's
next save of that theme then carries a stale base and meets the existing
conflict dialog, which is the same surface an install over an open theme
already uses.

**A failed upload after the write is harmless**: the next submit diffs against
the catalogue again, so it computes the same version and writes it again.
Nothing updates from the local version alone.

### Catalogue CI

`validate-item` gains two flags, supplied together or not at all:

```
validate-item <catalogueDir> [--previous-item <file> --previous-package <file>]
```

`validate.yml` reads the base commit it already checks out:

```sh
if git cat-file -e "$base:catalogue/$id/item.json" 2>/dev/null; then
  git show "$base:catalogue/$id/item.json" > "$previous_item"
  git show "$base:catalogue/$id/$id.zip" > "$previous_package"
  node … validate-item "$dir" --previous-item "$previous_item" \
    --previous-package "$previous_package"
else
  node … validate-item "$dir"
fi
```

With a previous item, the validator classifies the two packages and refuses
unless **all** of these hold:

- `item.json`'s `version` equals `versionFor(...)`;
- the package envelope's `metadata.version` equals it too, and is present —
  the app now writes it, so a missing version is a malformed package rather
  than a default;
- the change is not `none`;
- `remixOf` is unchanged from the previous item, or absent on both — provenance
  is recorded once and never rewritten (see *Attribution*).

Without a previous item the item must be `1.0.0`.

This is the same ruling the app made, applied to bytes the app did not write,
which is what closes the hand-made-PR hole. The workflow's pinned app commit
(`validate.yml:27`) moves to the commit this lands on, as phases E and F each
moved it.

## Identity

### Minting

`createNewFabricTheme()` and `createBlankFabricTheme()` set `id` to
`crypto.randomUUID()` instead of a literal. A document's id is fixed from its
creation and never rewritten; import keeps stamping a landed id, which is a
document arriving from outside rather than a document changing identity.

### The catalogue boundary

A catalogue id must be a lowercase UUID
(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`). One
constant, `isCatalogueId`, owned in `renderer-core` beside the catalogue
contract, is used by `validate-item`; `auto-merge.yml`'s
path regex is tightened to the same shape, with a comment saying it is a copy
because the workflow cannot import it.

### The library is unchanged

`store.ts:220`'s `[A-Za-z0-9_-]{1,64}` still admits a UUID and still admits
older ids, so tightening it would silently hide a developer's existing themes
from the listing. The library is per-machine and private; the catalogue is
where an id has to be globally unique, and that is where the rule binds.

## Attribution

A theme produced by modifying one that was installed from the catalogue credits
the theme it was forked from.

### The field

`ThemeMetadata` gains one optional member:

```ts
readonly remixOf?: {
  readonly catalogueId: string; // the parent's UUID — the authority
  readonly name: string;        // the parent's name at remix time
  readonly version: string;     // the version remixed from
};
```

`catalogueId` is what a link resolves through. `name` and `version` are a
snapshot for the case where the parent is not in the index — a deleted item, or
an offline package — where the credit renders as plain text rather than a dead
link. It is **immediate parent only**: a chain is walked by opening remixes that
are themselves remixes.

`metadata` is `additionalProperties: false` in
`schema/theme-document.schema.json:27-39`, so the member lands in the type, the
schema and the runtime validator in one commit — the format rule that stops a
document validating in the app and failing the schema.

### Where it comes from

The host already knows: `ThemeOrigin.catalogueId` and `.version` are recorded at
install (`settings/theme-origins.ts`), keyed by library id.

- A library theme **with an origin record** gains **Remix**: it opens a copy
  under a fresh `crypto.randomUUID()` with `remixOf` set from that record and
  the theme's current name.
- A library theme **without** one gains **Duplicate** instead, and no credit —
  there is no catalogue item to name.

Not at submit: minting an id there would move the stored folder and orphan the
open document, and a fork is something the author chose.

### Where it is read

- `submissionFiles` copies `metadata.remixOf` into `item.json`, and
  `CatalogueItemFile`, `CatalogueEntry` and `parseCatalogueItemFile` accept it,
  so the index carries credit without downloading a package.
- The storefront's item modal renders *Remixed from <name>* and, when that id is
  in the index, opens that item. The link target is resolved from the index by
  id; **no string out of a document ever reaches an `href`**, the rule the
  submission review imposed on PR links.
- The author-facing remix is visible in the library entry, which already prints
  author and version from the same metadata.

### Checks

`validate-item` refuses when:

- `remixOf.catalogueId` is not a UUID, or equals the item's own id;
- the package's `metadata.remixOf` and `item.json`'s `remixOf` are not deep-equal;
- a previous item's `remixOf` differs from this one's, or existed and is gone.

Existence of the parent is **not** checked: a remix may be merged before its
parent, and a parent may be removed later. The storefront degrades to text.

### Ladder

`metadata.remixOf` classifies as patch. In practice it is set before the first
publish and then frozen by the check above, so the rule exists to keep the
coverage test's set complete rather than to grade a real change.

## Offline and unpublished themes

Out of scope, and here is the boundary so it is not smuggled in later:

- The ladder runs **at publish only**. An exported or copied theme carries the
  version of its lineage; nothing bumps it offline, because nothing offline
  compares two documents.
- There is **no export control today** — `writeThemePackage`'s only product
  caller is submission. Sharing offline means sending a package someone already
  has or copying a folder.
- An import that lands under a free id keeps it (`import.ts:104`), so
  continuing work on another machine preserves lineage and its next publish
  bumps from the published item. An import onto a machine that already holds
  the id forks under a new id, and that fork's first publish is `1.0.0` —
  coherent, because a different id is a different item.
- Two people publishing one shared id meet auto-merge's ownership rule and the
  second is refused. That is the rule working, not a gap.

## Refusals

Each is one host sentence, shown verbatim by the store surface:

| Situation | Sentence |
|---|---|
| No change since the published package | `Version 1.4.0 is published and this theme has not changed since it.` |
| The catalogue cannot be reached | `The store's copy of this theme could not be read; submit again when it is reachable.` |
| A published item exists and its package is unreadable | `The store's copy of this theme cannot be opened, so its version cannot be computed.` |
| The published item's version is not a version | `The store's copy of this theme records version "v1", which cannot be bumped.` |
| A save moved the theme during the submit | the store's own conflict message |

## Testing

- **Ladder table**: one case per row, plus a case proving each ignored field
  produces `none` alone and is ignored beside a real change.
- **Coverage**: a test reads `envelopeKeysFor("envelope")` and asserts its set
  equals the classifier's classified members union ignored members — a new
  schema member fails before it can be mis-classified.
- **Errs upward**: an unknown top-level member is `major`.
- **Arithmetic**: `0.9.9` + minor → `0.10.0`, `1.9.9` + patch → `1.9.10`,
  `9.9.9` + major → `10.0.0`, and a non-version previous is refused.
- **Host**: plan read — first submission, normal bump, `none`, 404 vs 500 vs
  unreadable package, id mismatch; the store write lands the version and a
  concurrent base is refused; `item.json` carries the carried-forward
  `createdAt` and the document's `remixOf`.
- **CI**: `validate-item` with both flags — correct bump passes, a version that
  under-claims a major refuses, a missing envelope version refuses, an
  unchanged repackage refuses, no flags on a first submission requires `1.0.0`.
- **Attribution**: a remix of an installed theme mints a new UUID and records
  the parent; a duplicate of a local theme records none; `validate-item`
  refuses a mismatched, self-referencing, non-UUID or rewritten `remixOf`; the
  index round-trips `remixOf` through `parseCatalogueItemFile`.
- **Browser**: submitting a stored theme shows `1.4.0 → 1.5.0 · minor` and the
  store's caption line then reads `1.5.0` (routed: the catalogue is empty); a
  routed index holding a remix renders *Remixed from* and opening it shows the
  parent item, while a parent the index lacks renders as text.
- **Red-proofs**: break the CI version comparison and watch a lying item pass;
  break the ignored-field list and watch an editor-metadata-only save compute a
  patch instead of `none`; break the parent-id lookup and watch the link render
  as text. Restore from copies kept outside the repo and verify with `cmp`.

## Non-goals

- Version selection by the author. The computed class is the published class.
- Semver ranges, prerelease or build tags, and update policies keyed on ranges.
  The install path keeps comparing exact versions.
- An export control, and lineage for offline forks.
- Migrating legacy local ids.
- Enforcing permission or licence for remixes, a full lineage view, and credit
  for a source that was never in the catalogue.

## Landing note

Landed 2026-10-22 in five phases. The store branch `ci/catalogue-workflows`
(`9e9ca44`) still waits to merge, so the new pin and the UUID path regex are not
live on the catalogue's `main` yet.

- **Ladder:** `theme-package/src/version-ladder.ts`, with the table, ignored
  fields, coverage and arithmetic proved in `version-ladder.test.ts`.
- **Identity:** both document factories mint `crypto.randomUUID()`;
  `isCatalogueId` is the catalogue boundary and `validate-item` refuses a
  non-UUID directory (`catalogue-index.test.ts`, `validate-item.test.ts`).
- **Publishing:** `published-item.ts` reads the base item and package, and
  `submissionFiles` classifies, refuses `none`, writes the version and builds the
  header. Unit coverage in `published-item.test.ts` and `github-item.test.ts`;
  the browser shows `1.4.0 → 1.5.0 · minor` and the re-read caption at
  `docs/evidence/screenshots/store-submit-version-desktop-chromium.png`.
- **Attribution:** `metadata.remixOf` lands in type, schema and validator; Remix
  mints a new id; the listing, `item.json` and the validator carry and defend the
  credit. Unit coverage in the format, manager, catalogue and modal suites; the
  browser shows the credit as a control on a listed parent and as text on an
  absent one at `store-remix-credit-desktop-chromium.png`.
- **Enforcement:** `validate-item --previous-item/--previous-package`
  re-derives the version and level and holds provenance frozen. Proof PR #7 was
  accepted and PR #8 was refused for declaring `1.4.0` on a first submission.
- **Red-proofs:** a lying item passes when the version comparison is broken; an
  editor-metadata-only save computes `patch` when `editorMetadata` leaves the
  ignored list; a listed parent's credit renders as text when the id lookup is
  broken. Each was restored from a copy outside the repo and verified with `cmp`.
