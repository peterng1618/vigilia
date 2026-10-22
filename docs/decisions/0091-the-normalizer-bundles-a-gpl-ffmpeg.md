# 0091 — The normalizer bundles a GPL ffmpeg, invoked as a separate process

- **Date:** 2026-10-22
- **Status:** accepted
- **Paths:** `src/web/packages/theme-package/src/`, `src/web/packages/host/src/themes/`, `src/web/packages/editor/src/asset-manager/`

## The problem

Phase F owes two things the spec separates. The **caps** are a property check on
a file: duration ≤ 30 s, long edge ≤ 1920, MP4, H.264 High `yuv420p`, even
dimensions, constant frame rate ≤ 30 fps, no audio track, `+faststart`. The
**normalizer** is the author-facing helper that re-encodes a source into that
envelope without degrading it twice (an input already inside is copied
byte-for-byte).

The caps need no encoder — they can be read out of the container. The normalizer
needs an H.264 encoder, and that is where the non-obvious decision is: every
route to H.264 *encoding* on a desktop is GPL-encumbered, because x264 is the
only practical encoder and it is GPL. The question is therefore not "which
library is permissively licensed" but "which one states its licence honestly and
survives being shipped".

## Rung 1 — Yunari

Searched: `ffmpeg`, `ffprobe`, `video`, `MAX_ASSET_BYTES`, `MAX_ARCHIVE_BYTES`,
`boundedImportSize`, every `package.json`.

Found: **no media tooling of any kind**, and no duration or resolution check
anywhere. What exists is the size half of the budget: `MAX_ASSET_BYTES` 32 MiB
and `MAX_TOTAL_ASSET_BYTES` 128 MiB in `host/src/themes/store.ts`, and the
package caps (`MAX_ARCHIVE_BYTES` 64 MiB, `MAX_EXPANDED_BYTES` 128 MiB) in
`theme-package/src/index.ts`. The nearest precedent is images: `MAX_IMPORT_IMAGE_EDGE`
4096 with `boundedImageElement` downscaling through a canvas at
`editor/src/image-manager/index.ts` — a *client* downscale on import. Video
cannot follow it: there is no canvas encoder for video in a browser at a
tolerable speed.

## Rung 2 — dependencies

Searched: every manifest in `src/web/` for a transitive `ffmpeg` or `ffprobe`.

Found: none. `theme-package` carries `fflate`; nothing else decodes media.

## Rung 3 — platform

Searched: `ffmpeg` on `PATH` on the development box, recorded in the spec
(2026-10-21).

Found: **nothing on `PATH`.** So the probe arm of open question 2 refuses on the
machine this product is built on, which is what moved that question to *bundle*.
A native OS encoder (Media Foundation, VideoToolbox) would be per-platform,
licence-clean and unavailable on Windows without a second implementation —
three encoders for one envelope, and the envelope is what makes the store
predictable.

## Rung 4 — ecosystem

Searched: the npm registry for `ffmpeg-static`, `@ffmpeg-installer/ffmpeg`,
`@ffmpeg/core`, `fluent-ffmpeg`; the downloaded tarballs themselves; and the
build string inside the shipped binary. **No live web search was available in
this session**, so this rung is registry metadata and bytes, not other projects'
write-ups — the same disclosure 0090 makes.

Found:

- `ffmpeg-static@5.3.0` — `license: GPL-3.0-or-later`, and honest about it. The
  tarball carries no binary: `install.js` downloads the platform build from a
  GitHub release at install time.
- `@ffmpeg-installer/ffmpeg@1.1.0` — `license: LGPL-2.1`, but
  `@ffmpeg-installer/win32-x64@4.1.0` ships a 61.5 MB `ffmpeg.exe` whose embedded
  configure line is
  `--enable-gpl --enable-version3 --enable-libx264 --enable-libx265 …`.
  **Its declared licence is wrong**: the artifact is GPLv3. This is the finding
  that decides the rung.
- `@ffmpeg/core@0.12.10` — `GPL-2.0-or-later`, WebAssembly. Re-encoding 30 s of
  1080p in single-threaded WASM is minutes, not seconds, and it is not what the
  author waits for in the editor.
- `fluent-ffmpeg` — MIT wrapper, no binary; it does not answer the encoder
  question, only the spawning question.
- Nobody solves *this shape* permissively. The LGPL arm of ffmpeg cannot encode
  H.264 at all (no x264), so "bundle an LGPL build" is not a quieter version of
  the same choice — it is a non-option for this envelope.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| System `ffmpeg` probed at runtime | no shipped dependency | author must install it; measured absent here | normalizer silently unavailable | rejected — the reason open question 2 was decided |
| `ffmpeg-static` | one `ffmpeg` binary, declares GPL-3.0-or-later | ~80 MB downloaded at install, per platform | GPL obligations, disclosed | **chosen** |
| `@ffmpeg-installer/ffmpeg` | ships binaries in the tarball, declares LGPL-2.1 | same size | **declared licence contradicted by the binary** | rejected |
| `@ffmpeg/core` (WASM) | no native binary | GPL-2.0-or-later, minutes per encode | unshippable UX | rejected |
| Native OS encoder per platform | licence-clean | three implementations | three envelopes drifting apart | rejected |

## Rung 6 — probe

- `npm view ffmpeg-static license` → `GPL-3.0-or-later`; `npm pack ffmpeg-static`
  → 36 KB tarball, no binary, `install.js` present.
- `node install.js` for `ffmpeg-static@5.3.0` on this box **succeeded**: it wrote
  an 82.8 MB `ffmpeg.exe` (and the `ffmpeg.exe.LICENSE` beside it) from
  `ffmpeg version 6.1.1-essentials_build-www.gyan.dev`, whose configuration line
  carries `--enable-gpl --enable-version3 --enable-libx264`. The bundled
  `ffmpeg.exe.LICENSE` is the **GNU GPL Version 3** text. The package's declared
  licence is therefore accurate, and the download works in this environment.
- `npm pack @ffmpeg-installer/win32-x64` → 21.2 MB tarball, 61.5 MB
  `ffmpeg.exe`, **no licence file of its own**.
- `grep -a -o -- "--enable-[a-z0-9-]*" ffmpeg.exe | sort -u` → the configure line
  above, including `--enable-gpl`, `--enable-version3`, `--enable-libx264`.
- The spec's own measurement stands: no `ffmpeg` on `PATH` here.

## Decision

**Bundle `ffmpeg-static`, invoked as a separate process, and record GPL-3.0-or-later
in `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` in the same
task that adds it.** The reason is not size or speed: it is that the two
candidates differ only in whether their metadata tells the truth, and a shipped
dependency whose declared licence is contradicted by its own bytes is a claim
this repo would be republishing.

**The caps do not wait on it.** They are a property check the store runs on files
it receives, so they land first and stand alone; the normalizer is the author's
convenience on top.

**What this costs if wrong:** the GPL binary raises distribution obligations the
moment Yunari ships a packaged build, and a permissively-licensed encoder is not
available to swap in — the escape is a native per-platform encoder, which is the
rejected row above, not a smaller dependency.
