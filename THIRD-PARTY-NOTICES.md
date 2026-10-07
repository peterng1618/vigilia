# Third-party notices

Vigilia is MIT licensed; see [LICENSE](LICENSE). This is the current development
inventory, not a release-grade transitive audit. Provenance:
[`docs/engineering/dependencies.md`](docs/engineering/dependencies.md).

## Runtime/editor

| Dependency | Licence | Use |
|---|---|---|
| Apache ECharts 6.1.0 | Apache-2.0 | charts |
| Fabric.js 7.4.0 | MIT | scene graph |
| fflate 0.8.3 | MIT | theme ZIP packages |
| react 19.3.0 | MIT | editor shell chrome |
| react-dom 19.3.0 | MIT | editor shell chrome |
| @base-ui/react 1.8.0 | MIT | editor shell primitives |
| @radix-ui/react-popover 1.1.23 | MIT | editor colour-picker popover |
| @radix-ui/react-dialog 1.2.0 | MIT | editor keyboard-shortcut reference dialog |
| lucide-react 1.48.0 | ISC AND MIT (Feather-derived subset) | editor action-bar icons |
| systeminformation 5.33.13 | MIT | host hardware metrics (no dependencies of its own) |
| qr 0.7.2 | MIT OR Apache-2.0 | QR symbol for the display link (no dependencies of its own) |

Preserve applicable Apache-2.0 and MIT licence/NOTICE obligations.

### LibreHardwareMonitor (bundled external program)

A Vigilia release ships LibreHardwareMonitor v0.9.6 (MPL-2.0) as an external
program, staged by `npm run vendor:lhm -w @vigilia/host`. Vigilia links nothing
and compiles nothing: it runs the executable and reads the JSON its web server
publishes. It is not a dependency and its source is not vendored.

MPL-2.0 permits redistribution in a larger work provided LHM's own source stays
under MPL and its notices travel with it. **The release archive omits every
licence file**, so the vendor script adds LHM's `LICENSE` and
`THIRD-PARTY-NOTICES.txt` beside the binaries; the latter carries the required
notices for the third-party binaries the archive bundles:

| Bundled binary | Notice |
|---|---|
| Aga.Controls.dll | BSD (Andrey Gliznetsov) |
| HidSharp.dll, OxyPlot.dll, OxyPlot.WindowsForms.dll, RAMSPDToolkit-NDD.dll | per LHM's `THIRD-PARTY-NOTICES.txt` |
| Microsoft.* / System.* support assemblies | Microsoft .NET, MIT |

Release packaging must include `vendor/lhm/LICENSE` and
`vendor/lhm/THIRD-PARTY-NOTICES.txt` (and so the notices above) in the shipped
distribution. PawnIO is **not** in the archive — LHM fetches it at runtime and
it is LGPL-2.1 — so a first-run PawnIO download needs its own review before
being enabled. Provenance and the pinned digest:
`docs/engineering/dependencies.md`; `vendor/lhm/PROVENANCE.txt` records the
version, source URL and sha256 of the staged release.

## Build/test

Declared development dependencies: @biomejs/biome 2.5.14 (MIT OR Apache-2.0),
TypeScript 7.0.2 (Apache-2.0), Vite 8.3.0 (MIT), Vitest 5.0.0 (MIT),
@playwright/test 1.63.0 (Apache-2.0), jsdom 26.1.0 (MIT), canvas 3.2.3 (MIT),
@types/node 22.10.2 (MIT), @types/react 19.3.x (MIT), @types/react-dom
19.3.x (MIT), tailwindcss 4.3.3 (MIT, editor dev styling), @tailwindcss/vite
4.3.3 (MIT, editor dev), jsqr 1.4.0 (Apache-2.0). Native `canvas` may carry
linked-library obligations.

## Vendored source

`packages/editor/src/snap-manager/` and `packages/editor/src/indicator-manager/`
contain adapted copies of `@anu3ev/fabric-image-editor` 0.10.32, taken from
commit `9efdd78a342a29f169a8dbf1da78c95bbf1ffe77`. It is not a dependency; the
source was adapted in place. Its licence follows in full, as MIT requires for
substantial portions.

MIT License

Copyright (c) 2025 Alexander Anufriev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Runtime icons

`lucide-react` 1.48.0 supplies the editor's action-bar icons, imported per-icon
by name so the bundler keeps only the ones the registry uses. Its per-icon
geometry is also where the default theme's card icons come from: the starter reads the same
modules and converts them to canvas path data at author time, so no second icon set
ships and the player bundle is unchanged. **Four of the
icons currently imported are derived from the Feather project and carry MIT as
well as the package's ISC grant**: `ArrowDown`, `ArrowUp`, `Lock` and `Trash2`
(`trash-2` in the package's own list). The remainder of the package's icons are
covered by ISC alone — see `lucide-react`'s `LICENSE` for the authoritative
Feather-derived list.

ISC and MIT both require their copyright and permission notice to travel with
copies of the covered work, so both follow in full.

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

The MIT License (MIT) — for the Feather-derived icons named above

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Assets and planned integrations

Imported assets retain their own licence requirements; record source/hash/licence
metadata.

### Starter backdrop (bundled asset)

`packages/editor/src/starter-backdrop.jpg` ships **inside** the product, as the
default theme's artboard backdrop. It is a packaged theme asset, declared by
path in the starter document and served same-origin by the host, so it is
redistributed with every starter theme a user saves.

| Field | Value |
|---|---|
| Work | “city skyline during orange sunset” |
| Photographer | Ashim D’Silva (`@randomlies`) — <https://unsplash.com/@randomlies> |
| Source page | <https://unsplash.com/photos/city-skyline-during-orange-sunset-NTTJsPPlQOk> |
| Licence | **Unsplash License** — <https://unsplash.com/license> |
| Retrieved | 2026-09-28 |
| Shipped bytes | 2330 × 1311 JPEG, q75, centre-cropped to the artboard's 1.7768 aspect; 438 590 bytes |
| sha256 | `6d4bbd987c0e6a6103eb310b2848e011e50a77be641e3e2cdd1b389d695bf59b` |

Verified 2026-09-28 from the **primary source**, not from memory. The photo
page carries the notice *"Free to use under the Unsplash License"*, links that
licence, names the photographer, and embeds the exact CDN identifier the bytes
were fetched under (`images.unsplash.com/photo-1587642314856-a00a0e4aee60`), which
is what establishes that the downloaded file and the page are the same work.
Unsplash's own Terms, §5 "License to Images", state the grant as an
*"irrevocable, nonexclusive, worldwide copyright license to download, copy,
modify, distribute, perform, and use images from Unsplash for free, including
for commercial purposes, without permission from or attributing the photographer
or Unsplash"*, excluding only the right to compile images to replicate a
similar or competing service. Attribution is not required and is given anyway.

The Terms also exclude **trademarks, logos or brands**, **recognisable people**
and **works of art or authorship** appearing in an image. The shipped crop was
inspected: a distant city skyline in silhouette at sunset, with no legible
brand mark and no person. It is redistributed unmodified apart from resize and
crop, both of which the licence permits expressly.

The licence text itself is not reproduced here because it is not a
copyleft-style licence with a notice requirement; the link above is the
authoritative text and the URL is recorded in the theme package's own asset
declaration, so it travels with the file.

The approved curated-font slice will copy pairing metadata from
[Fonttrio](https://github.com/kapishdima/fonttrio) as data, not a runtime
dependency. Fonttrio is MIT licensed; preserve its attribution when shipping
derived pairing data.

LibreHardwareMonitor and PawnIO are planned integrations, not current
dependencies. Re-review their licences if Vigilia starts shipping them.

## Release rule

Before publishing, audit the complete runtime/transitive graph and ship every
required licence/NOTICE text. Verify new dependencies from primary/package
metadata when adding them.
