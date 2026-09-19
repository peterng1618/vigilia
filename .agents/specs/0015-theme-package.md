# 0015 — Theme package boundary

- **Status:** implemented
- **Design sections:** §132, §134, §137, §139, §141, §157

## Goal

Make a self-contained, bounded ZIP package the only asset-bearing theme file.
It carries one validated v2 Fabric envelope and the bytes declared by that
envelope, so later asset authoring, imported fonts and video do not depend on
raw JSON downloads or remote URLs.

## Format v1

The archive has exactly these entries:

- `manifest.json`: `{ "format": "vigilia-theme-package", "version": 1,
  "theme": "theme.json" }`;
- `theme.json`: one v2 `FabricThemeEnvelope`;
- each path declared in `theme.assets`, under `assets/`.

The writer rejects an invalid envelope, an undeclared asset, missing declared
bytes, duplicate names and unsafe paths. It produces a deterministic entry set.
The reader rejects non-ZIP input, unsafe/duplicate/unexpected names, missing or
extra assets, unsupported manifest versions and an envelope rejected by the
existing v2 validator. Validation finishes before a caller replaces its open
document.

Read inputs are bounded: 64 MiB archive bytes, 128 entries, 128 MiB total
expanded bytes and 32 MiB per entry. The reader accepts only stored or deflated
entries. Those limits are package safety limits, not media-quality limits.

## Ownership

`@vigilia/theme-package` owns ZIP layout, byte bounds and archive validation.
`renderer-core` remains the owner of envelope/schema validation. Callers own
file pickers, downloads and any later host storage; the package API is pure and
portable between browser and Node.

## Non-goals

- editor asset-import/replacement/removal UI;
- host-backed storage, autosave or save-in-place;
- package previews, licence files, widgets or templates;
- video/font rendering and remote-asset fetching;
- reading legacy JSON as a package or providing a v1 theme migration.

## Acceptance

- a valid v2 envelope plus declared bytes round-trips through the package;
- missing, extra, duplicate, unsafe, oversized or compressed-bomb-like input
  is rejected before revival;
- the player bundle does not import the package implementation;
- package code depends on the existing envelope validator rather than copying
  theme validation.
