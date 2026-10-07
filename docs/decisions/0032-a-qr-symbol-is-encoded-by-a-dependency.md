# 0032 — A QR symbol is encoded by a 0-dependency library, not by hand

- **Date:** 2026-10-07
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-shell/qr-code.ts`,
  `src/web/packages/editor/src/editor-shell/qr-code.tsx`,
  `src/web/packages/editor/src/editor-shell/shell-layout.tsx`

## The problem

Plan 6 of the dashboard-authoring redesign puts a QR code in the editor header
(`specs/2026-10-03-dashboard-authoring-design.md:394-396`), encoding the paired
display URL — `http://<lan>:<port>/?session=<token>` — so a phone can reach this
host by pointing a camera at the screen.

The shape of the problem is not "draw some squares". A QR symbol is a
well-specified *encoder*, and every part of it that can be wrong is wrong
**invisibly**: a bad Reed–Solomon codeword, a mask chosen by a mis-scored
penalty, or a format-information word built by a mis-shifted BCH polynomial all
produce a matrix that looks like a QR code, renders perfectly, and simply never
scans. Nothing in the repository fails, no test that reads our own output can
tell, and the only instrument that would have caught it — a camera — is the one
piece of hardware this project cannot put in CI. That is the watchlist's
definition of a mechanism boundary: expensive and invisible.

## Rung 1 — Vigilia

Searched: `rg -i "qrcode|QRCode|qr-code|\bqr\b"` across `src/web/packages`
(excluding `dist/`), and `rg` for `BarcodeDetector` across the same tree.

Found: **nothing.** No encoder, no renderer, no caller, no fixture, no test. The
two owners this feature *consumes* do exist and are the reason the payload is
the size it is: `lanAddress()` (`src/web/packages/host/src/cli/net.ts:90`)
supplies the address, and `createSessionStore().create()` (`src/web/packages/host/src/session/pairing.ts:70`)
supplies a 43-character base64url token.

## Rung 2 — dependencies

Searched: every workspace package's `dependencies` block
(`editor`, `host`, `renderer-core`, `scene-fabric`, `player`, `theme-package`,
`fake-source`), then `grep -oE '"(@[^"]+/)?[^"]*qr[^"]*"'` and
`grep -o '"node_modules/[^"]*qr[^"]*"'` over `src/web/package-lock.json`.

Found: **nothing**, direct or transitive. The whole graph is ECharts, Fabric,
fflate, React, Base UI, Radix popover, clsx, cva, tailwind-merge, lucide, and
`systeminformation` — none of them carries a QR routine. Rung 2 finds nothing,
which is worth writing down because it is the rung that would normally have
settled this.

## Rung 3 — platform

Searched: the Shape Detection API and the Node standard library — `BarcodeDetector`,
`OffscreenCanvas`, `node:zlib`.

Found: **a detector, not an encoder.** `BarcodeDetector` decodes a QR from a
bitmap; it is browser-only (absent in Node), Chromium's implementation is
delegated to the platform's own barcode service so its availability varies by
OS, and it computes no matrix. Canvas and `OffscreenCanvas` rasterise whatever
you hand them — they are the *renderer*, which is the part that was never hard.
`node:zlib` is irrelevant: QR's error correction is Reed–Solomon over GF(256),
not a stream codec.

So the platform gives the quiet zone and the pixels and nothing else. This rung
fails on its own, which is the case `docs/decisions/README.md` warns about:
rung 3 succeeding usually discharges the gate, and here it does not succeed at
all.

## Rung 4 — ecosystem

Searched, with the queries recorded because the queries are the evidence:

- *"smallest maintained JavaScript QR code generator library npm 2025 byte mode
  SVG output MIT"*
- *"Nayuki QR Code generator library TypeScript reference implementation licence
  single version byte mode"*

Found, and what each one actually is:

- **`qr` (paulmillr)** — MIT OR Apache-2.0 (dual; MIT may be taken), **zero
  dependencies**, encode-only entry 5.4 KB gzipped (the 20 KB figure is
  encode + decode), `encodeQR(text, 'raw'|'svg'|'gif'|'term'|'ascii'|'data-url', opts)`
  where `'raw'` returns `boolean[][]` and `'svg'` returns markup. ~353 k weekly
  downloads, released through 2026, and the README claims 100 MB+ of test
  vectors and "auditable, 0-dependency" as the design goal. `ecc`, `version`,
  `mask` and `border` are all options.
- **`uqr` (unjs, Anthony Fu)** — MIT, zero dependencies, ESM and tree-shakable,
  `encode(text, opts)` returning `{ data: boolean[][], version, size }` plus
  `renderSVG`/`renderANSI`/`renderUnicode`. ~3.2 M weekly downloads, 9 releases
  since 2023.
- **`qrcode` / `qrcode-generator` (Kazuhiko Arase)** — the classic, MIT. `qrcode`
  carries a far larger surface than this needs: several output targets, several
  text modes, CLI and Node-file renderers, and its own dependency list.
- **Nayuki's `qrcodegen.ts`** — MIT, an independent implementation from the ISO
  document, ~970 lines in one file, explicitly offered to be read and vendored,
  with `encodeText`/`encodeSegments`/`toSvgString`. No npm package.
- **Newer tiny packages** — `@kroszborg/rune`, `better-qr`,
  `@levischuck/tiny-qr`, `qr-code-generator-lib`, `@goker/qr-code`: all MIT and
  none obviously wrong, but they are weeks-to-months old with double-digit weekly
  downloads. An encoder whose failures are invisible is the last place to be an
  early adopter.

**What others do.** Nobody hand-writes this in application code. The shape others
have solved is exactly ours — encode a short ASCII URL, one symbol, render it —
and the two libraries that solved it well both did so by making the encoder
small, dependency-free and heavily vector-tested, then letting the caller own the
pixels. That is the interface worth taking.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `BarcodeDetector` / `OffscreenCanvas` | decodes, not encodes | none | total | **rejected** — rung 3 gives nothing to build on |
| Hand-written byte-mode encoder | exact control | ~250–400 lines of Reed–Solomon, BCH format info, mask penalty scoring | **highest** — the failure is invisible; the only instrument is a camera | **rejected** — this is the rabbit hole the gate exists to prevent |
| Nayuki `qrcodegen.ts`, vendored | proven correct, no dependency | ~970 lines to own, and still a licence notice | low, but the file breaches the 800-line stop and inherits our `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | **rejected** — paying for a dependency in the currency of permanent ownership |
| `qrcode` (npm) | works | largest surface of the three, its own deps | low | **rejected** — more machinery than the problem |
| `qr` (paulmillr) | `encodeQR(url, 'raw')` → `boolean[][]`, exactly the interface we want | one runtime dependency, 5.4 KB encode-only | low — 0 deps, dual MIT/Apache, large download base, dense test vectors | **chosen** |
| `uqr` (unjs) | `encode()` → `{ data, version, size }` | one runtime dependency | low | **runner-up** — rejected only because `qr`'s encode-only entry is smaller and its correctness claim is stated in test-vector terms |

## Rung 6 — probe

Measured, on this machine:

- **No QR code and no QR dependency exists anywhere in the tree** — the two
  greps in rungs 1 and 2, both empty.
- **The payload that must fit**, computed from the owners rather than guessed:
  `lanAddress()` + `:5227` + the 43 characters `createSessionStore()` mints from
  32 bytes of CSPRNG. `http://192.168.1.42:5227/?session=<43>` is **77
  characters**; 76 at the shortest plausible dotted quad, 80 at
  `192.168.100.100`. Byte mode at error-correction M puts 77 characters in
  **version 5 (37 × 37 modules)**; at L, version 4 (33 × 33). The symbol is
  small, static, and always ASCII — the easiest case the standard has.
- **What the probe did not do.** No encoder was run and no symbol was decoded:
  nothing was installed, and there is no phone and no camera in the loop. So the
  probe establishes the *size of the problem*, not the correctness of any
  candidate. The correctness proof is the plan's, and it is a decode
  round-trip — encode a realistic URL, rasterise the matrix, decode it back with
  a second, independent library — because a test that reads only our own output
  cannot tell a QR code from a picture of one.

## Rung 7 — build

What gets built is deliberately small, because the hard half is bought:

- `qr-code.ts` — `qrMatrix(url)` wrapping `encodeQR(url, "raw", …)`. One call,
  one return type, no markup.
- `qr-code.tsx` — the renderer, which draws the matrix as `<rect>` elements and
  owns the quiet zone. Rendering is where our taste belongs and where the
  library's `'svg'` string would have forced `dangerouslySetInnerHTML`.
- The dependency entry in `packages/editor/package.json`, plus
  `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md`.
- `jsqr` as a **devDependency only**, for the decode round-trip. It ships nothing.

## Decision

**Depend on `qr` (paulmillr), encode-only, and render the matrix ourselves.**

The specific reason is the shape of the failure, not the size of the code. A
wrong encoder produces a picture that passes every assertion we could write about
our own output, and the instrument that would catch it is a camera we do not
have in CI. A 0-dependency, dual-licensed, actively maintained library whose
correctness is stated in test vectors removes that entire class of risk for
5.4 KB and one line in `package.json`; hand-writing the same thing spends days to
reproduce Reed–Solomon, BCH format information and mask penalty scoring that
nobody here could then verify. Buying the encoder is the cheap half of this
problem and owning it is the expensive half, which is the opposite of how it
looks.

`uqr` would have been a fine second choice and is recorded above so the next
person does not have to repeat the search.
