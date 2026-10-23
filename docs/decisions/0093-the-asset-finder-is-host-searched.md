# 0093 — The asset finder is searched by the host

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `src/web/packages/host/src/server.ts`, `src/web/packages/host/src/assets/`, `src/web/packages/host/src/settings/credentials.ts`, `src/web/packages/renderer-core/src/assets/`, `src/web/packages/editor/src/asset-finder/`
  `src/web/packages/editor/src/editor-shell/shell-layout.tsx`, `src/web/packages/editor/src/components/ui/dialog.tsx`, `scripts/generate-lucide-icons.mjs`

## The problem

An author had no one place to find outside material: fonts lived in a picker
inside the font field, icons arrived as downloaded files, and a Wallpaper
Engine theme was a separate flow. Separately, a provider key had no owner — the
browser would have to hold it if it called a provider directly, and the host's
future data providers would need the same secret store.

The non-obvious shape is not "a search box". It is a **provider port plus a
registry**, where the browser never holds a key, the registry stays data, and
an import cannot exist without its attribution. Those are the places a wrong
choice renders plausibly and fails invisibly.

## Rung 1 — Yunari

Searched: existing source registries, credential stores, asset search surfaces,
and every host settings store.

Found: the asset manager (bytes, caps, references, previews), the curated font
catalogue with its query/facet/specimen machinery (`font-picker/`,
`font-catalog-query.ts`, `font-specimen-cache.ts`), the Settings dialog and its
one `readonly SettingsTab[]` list, Base UI `Dialog`, and eight host settings
stores under `host/src/settings/` (`theme-origins.ts` and its siblings). None
holds a secret and none is a registry of remote sources. Nothing to extend for
search or credentials; several things to reuse for bytes, browsing and the
modal.

## Rung 2 — dependencies

Searched: direct and transitive packages for a keychain binding and an HTTP
client.

Found: `keytar` and equivalents are native modules, refused by the dependency
rule and recorded as the accepted limit in spec R6 — plaintext JSON protected by
filesystem permissions, never returned by a route. `lucide-react` 1.48.0 is
already present (`docs/engineering/dependencies.md:19`); Font Awesome's data is
one HTTP GET to jsDelivr and needs no client library. Node's `fs` writes the
credentials file and `fetch` is global. No new dependency.

## Rung 3 — platform

Searched: Base UI `Dialog`, Node `fs`, `AbortSignal`, and the existing loopback
route helpers.

Found: `Dialog` is the modal already in use by Settings; `fs` gives the settings
file; `AbortSignal` cancels a search. What the platform leaves to us is exactly
the expensive part: credential ownership (browser vs host), a per-source page
and cursor contract, ordered merging, and the disposal of a late response.
Those are the decisions this note records.

## Rung 4 — ecosystem

Searched: "editor asset search provider registry", "VS Code tree view data
provider", "Figma plugin asset panel", "Penpot asset library".

Found: the recurring shape is a provider port plus a registry — VS Code's
extension-provided providers, Figma's plugin-run panels, Penpot's asset
libraries all separate "where bytes come from" from the surface that draws them.
**None of them solves attribution for a published artifact**: their assets are
not redistributed inside a file the user hands to someone else. That is why
`credits.json` is Yunari's own and why the port carries `creditsOf`, so an
import cannot be finished without writing the credit.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Sections inside the Add pane | no new surface | five search UIs in a 240px column | the font grid shrinks to unusable | rejected |
| One component per source | independent | N surfaces, N search boxes | the fifth source is a fifth UI | rejected |
| One modal over one registry (chosen) | one owner per concern | one new surface | the registry must stay data | chosen |

## Rung 6 — probe

Measured 2026-10-21: 261 curated faces in `font-trios.generated.ts`;
`lucide-react` 1.48.0 at `dependencies.md:19`; the Settings tab list is one
`readonly SettingsTab[]` with three entries, so a fourth is a data change;
`content.monochrome` exists in `scene-fabric/src/fabric-image.ts:59`; eight host
settings stores exist and only `theme-origins.ts` has the tolerant-read shape
the credential store copies.

## Rung 7 — build

The smallest build that holds: one `AssetSource` port, one registry array, one
`search` that merges each enabled source's page, one credential store, one
modal. No downloader, no second asset model, no second font catalogue.

## Departure from the spec

Spec §3 and §7 name a `curated-fonts` host source. It is **not built**: spec §6
forbids rebuilding the catalogue browser, and the Fonts tab reuses the existing
`FontPicker` (plan Ruling 1). Serving the generated table from the host would be
a second search over data already in the editor bundle — 261 faces copied across
a wire for no gain. `font-trios.generated.ts` therefore stays where it is, and
the registry distinguishes a grid body from an editor body (`font-picker`,
`wallpaper-engine`).

## Decision

Every provider call is the host's (`host/src/assets/`), behind one port and one
registry array; the editor holds a fetch client and the modal. The credential
store lives in the host settings directory, is write-only to the browser, and
returns only `set` and a four-character hint. Attribution is a parameter of
import, not a later chore: `creditsOf` is part of the port, and a package
written from an import carries `credits.json`.
