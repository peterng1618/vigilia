# Theme versioning and identity — design

Date: 2026-10-22
Status: awaiting review
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
- Theme ids are literals and slugs: the starter is `vigilia-demo-dashboard`
  (`new-fabric-theme.ts:37`), every blank theme is `vigilia-new-theme`
  (`:270`), and a save lands under the document's own id
  (`theme-library-manager/index.ts:232`). Import keeps the package's id when it
  is free and stamps a suffixed one when it is not (`import.ts:102-107,141-148`).
- The catalogue's CI runs `validate-item` per touched directory
  (`C:\tmp\vigilia-store\.github\workflows\validate.yml:38-56`) with
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
| `patch` | Any other change inside an existing structure: paint, text, geometry, z-order, an object's own properties, a kept sensor's binding, `metadata.name`/`author`/`description`/`themeLanguage`. |
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

`fabricVersion`, `scene.version`, `editorMetadata` (whole member),
`metadata.version`, `metadata.createdAt`, `metadata.updatedAt`.

An editor upgrade, a save, or a re-publish must not force a release, and these
are the fields such events move. Tags are compared as a set: reordering them is
no change.

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
): string;
export function versionFor(
  previous: string | undefined,
  change: ThemeChange,
): string;
export function isSemanticVersion(text: string): boolean;
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
   `downloads` and `favorites` when there is one, and the submission instant as
   `updatedAt`.
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
- the change is not `none`.

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
contract, is used by `submissionFiles` and `validate-item`; `auto-merge.yml`'s
path regex is tightened to the same shape, with a comment saying it is a copy
because the workflow cannot import it.

### The library is unchanged

`store.ts:220`'s `[A-Za-z0-9_-]{1,64}` still admits a UUID and still admits
older ids, so tightening it would silently hide a developer's existing themes
from the listing. The library is per-machine and private; the catalogue is
where an id has to be globally unique, and that is where the rule binds.

### Legacy ids

A local theme created before this change keeps its id, opens, saves and lists
as before, and is **refused at submit**:

> This theme's id was made before ids were UUIDs, so it cannot be published.
> Start a new theme from the starter and copy the artboard across.

Pre-release, the library on any machine is a developer's own work and the
catalogue is empty, so there is no published item to strand.

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
| The theme's id is not a UUID | the legacy-id sentence above |

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
  `createdAt`.
- **CI**: `validate-item` with both flags — correct bump passes, a version that
  under-claims a major refuses, a missing envelope version refuses, an
  unchanged repackage refuses, no flags on a first submission requires `1.0.0`.
- **Browser**: submitting a stored theme shows `1.4.0 → 1.5.0 · minor` and the
  store's caption line then reads `1.5.0` (routed: the catalogue is empty).
- **Red-proofs**: break the CI version comparison and watch a lying item pass;
  break the ignored-field list and watch an editor-metadata-only save compute a
  patch instead of `none`. Restore from copies kept outside the repo and verify
  with `cmp`.

## Non-goals

- Version selection by the author. The computed class is the published class.
- Semver ranges, prerelease or build tags, and update policies keyed on ranges.
  The install path keeps comparing exact versions.
- An export control, and lineage for offline forks.
- Migrating legacy local ids.
