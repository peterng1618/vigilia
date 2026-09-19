# 0015 — Theme package boundary

- **Status:** implemented; delete after remaining callers depend on it
- **Design sections:** §132, §134, §137, §139, §141, §157

## Contract

`@vigilia/theme-package` owns the self-contained ZIP format for asset-bearing
themes. A package contains:

- `manifest.json`: format `vigilia-theme-package`, version 1, theme `theme.json`;
- one validated v2 Fabric envelope at `theme.json`;
- exactly the files declared by `theme.assets`, under `assets/`.

The writer rejects invalid envelopes, undeclared/missing assets, duplicates and
unsafe paths. The reader rejects invalid ZIPs, unsafe/duplicate/unexpected
entries, unsupported manifests, asset mismatches and invalid envelopes before
document replacement.

Read limits: 64 MiB archive, 128 entries, 128 MiB expanded total, 32 MiB per
entry; only stored/deflated entries are accepted.

`renderer-core` owns envelope/schema validation. Callers own file UI/storage.
The player must not import this package.

A package is the immutable sharing, library and future-store artifact. A local
folder may be an authoring workspace with the same validated `theme.json` and
`assets/` layout, but export is explicit; it is not silently synchronized with
a package.

## Out of scope

Asset-management UI, host storage/autosave, previews/templates, media/font
rendering, remote fetching and legacy migration.

## Evidence

Round-trip, entry/path validation, expansion bounds and player-boundary tests
cover the contract. Current run counts belong in `status.md`.
