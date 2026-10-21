# Wallpaper Engine as a source of Vigilia background media — design

- **Date:** 2026-10-21
- **Status:** proposed
- **Author:** investigation on Wallpaper Engine 2.8.42, build `2026-06-29 14:36:02`
- **Related:** [`2026-10-12-theme-store-design.md`](2026-10-12-theme-store-design.md)
  (media normalizer, ffmpeg decision), `renderer-core`'s `BackgroundMedia`,
  `theme-package`'s member rules.

## What this is, and is not

**This is** an importer that reads the Wallpaper Engine library already sitting
on the author's disk and produces Vigilia assets: images directly, videos through
the shared media normalizer, and a guided path for animated scenes that uses
Wallpaper Engine's own export.

**This is not** an automation of Wallpaper Engine, and not a reimplementation of
its renderer. Both were investigated and closed; the evidence is below and the
sections after it exist because those two doors are shut.

## Rulings taken 2026-10-21

These were decided during the investigation and this spec does not re-open them.

**R1 — Vigilia never launches, drives, injects into or patches Wallpaper Engine.**
The only supported automation surface was removed by the vendor on purpose
(§2). The importer reads files and, at most, launches the editor at a project
for the author to export from.

**R2 — Vigilia does not render Wallpaper Engine scenes.** 98% of the local
library's scenes depend on particle systems, HLSL effect chains or text — the
engine itself, not a video encoder (§3). Scene themes resolve to a guided export.

**R3 — The disk is truth; the library cache is metadata.** The cache lists 421
items while 447 project directories exist on the same install (§1.4). A cache
miss is not an absent wallpaper, and a cache row is not a promise the files are
still there.

**R4 — Static images are a first-class outcome, not a fallback.** An item whose
payload is an image is imported as an image asset, never transcoded to a video to
simplify the pipeline. A still *scene* is a different thing and is not one (see
§4.1).

**R5 — Attribution is a theme-package member, not a Wallpaper Engine field.**
`credits.json` is designed for fonts, icons and stock images too (§7).

**R6 — The video budget belongs to the shared media normalizer.** The importer
hands it bytes and a source description; it does not carry its own encoder
(§6).

**R7 — Discovery is host-side, the flow is editor-side.** The browser cannot
read `D:\Games\Steam\...`; the host can. The editor renders the list and the
guidance; the host owns every filesystem decision. This mirrors how
`themes/import.ts` already splits the work.

## 1. What Wallpaper Engine is, on this disk

### 1.1 Install and library

```
<install>/                       C:\Program Files (x86)\Steam\steamapps\common\wallpaper_engine
  wallpaper64.exe                the renderer — no export capability
  bin/wallpaperui.exe            the CEF + AngularJS editor/browser
  bin/workshopcache.json         offline metadata for subscribed workshop items
  projects/myprojects/           the author's own projects
  projects/temp/{mobile,publish,edit}
```

Subscribed wallpapers live outside the install, under a Steam library:

```
<library>/steamapps/workshop/content/431960/<workshopid>/
  project.json                   type, file, title, preview, properties
  preview.jpg
  <file>                         the wallpaper's own payload
```

The app id is **431960**. A machine may have several Steam libraries;
`steamapps/libraryfolders.vdf` in the Steam root lists them.

### 1.2 What a `project.json` says, per type

Measured across all 447 local item directories:

| `type` (any casing) | Count | Payload `file` |
|---|---|---|
| `scene` | 225 | `scene.pkg` (225) |
| `video` | 156 | `.mp4` (155), `.wmv` (1) |
| `web` | 15 | `.html` (15) |
| *none* | 23 | none — these are **presets for another wallpaper** (`preset` object, `dependency` naming the parent) |

447 directories in total: the 419 above, plus **28 with no readable
`project.json`**. Those 28 are skipped, not guessed at.

**Type casing is inconsistent in the wild**: `Video` 12 / `video` 144,
`Scene` 37 / `scene` 188, `Web` 3 / `web` 12. Every read lowercases.

**The 23 untyped items are not wallpapers.** They carry a `preset` object and a
`dependency` field naming the wallpaper they configure. They must be excluded
before they reach a list, or the importer offers the author something that has no
payload at all.

### 1.3 Per-wallpaper user settings

The author's chosen property values — the settings the user described as "native
WE feature, user settings saved as JSON" — are stored in the install's
`config.json` under the per-user object:

```
config.json → <username> → wproperties[<absolute wallpaper file path>] = { <property>: <value>, … }
```

They are readable offline and keyed by the same path as `workshopcache.json`'s
`file` field. The importer reads them to record what a render was made with; it
**never writes them** (R1).

### 1.4 The library cache

`bin/workshopcache.json` is `{ user, version, wallpapers: [...] }` with one row
per subscribed item. Each row carries:

```
allowmobileupload, authorsteamid, favorite, file, filesize, filesizelabel,
hasrating, ispreset, local, official, preview, previewsmall, project, rating,
ratingrounded, status, subscriptiondate, tags, title, type, updatedate,
workshopid, workshopurl, youtube
```

This is the attribution source (§7) and the only offline source of an item's
workshop id and author. It is regenerated by Wallpaper Engine, so it can lag the
disk (R3): the importer joins it onto the directory scan by `workshopid`, and an
item with no cache row is still listed, with its attribution fields absent.

**It contains no author display name**, only `authorsteamid`. The vendor's UI
resolves names over the network each session.

## 2. Why there is no automation path

The question was whether a CLI could produce the video Wallpaper Engine's own
"send to mobile device → pre-rendered" flow produces. It cannot. The evidence:

| Probe | Result |
|---|---|
| Full command-line flag set of `wallpaperui.exe` | `-window -path -project -textures -workshopids -clearUnused -dithered -monitordetection -monitormap -language -skin -screensaver -service -startupTask -parentwindow -parentprocess -messagehandler -json -weuimain -steamlanguage -buildv -transcode -generateDepthMap -setwallpaper -CheckWebViewSupport -disablegifs -disablefx -vdesktopenabled`. **No export, render or encode command.** |
| `startVideoExport` / `cancelVideoExport` | Entries in a CEF string table (`0xac7f48`, `0xac7f60`) beside `exportMobilePkg`, `convertProjectToMobile` and ~100 other native capabilities; all reached from JavaScript through `callEditor`. There is no command-line route to any of them. |
| `wallpaper64.exe` (the renderer) | Contains no export capability at all: the only `/export/i` match is `exports`, and there is no `mp4` string. Encoding exists only in the UI process. |
| Remote debugging | Refused explicitly: *"It appears that you have added remote debugging arguments to Wallpaper Engine: %s / This is not allowed and you must remove them to continue."* — with instructions to reinstall. A deliberate vendor prohibition, not an oversight. |
| `-transcode` | A red herring. It builds `resourcecompiler64.exe -transcode -i … -o … -f ETC2 -c force -shrink N -maxmipmaps 1` — texture compression for mobile packages, not video. |
| `-messagehandler` / `-parentprocess` | A generic child-process progress pipe between a launcher and its UI, not a command channel. |

A CLI path would require injecting a DLL or patching `wallpaperui.exe`. That is
fragile across every Wallpaper Engine update, and it contradicts an explicit,
vendor-enforced refusal.

## 3. Why Vigilia does not render scenes

The video export itself is trivial — allocate frames, step the scene, read back,
crossfade, encode. Every cost is in producing the frames.

Every local `scene.pkg` was opened and its root `scene.json` parsed (**216 of
238** scenes parsed; 22 failed on container layout and are bounded unknowns):

| Measure | Result |
|---|---|
| Scenes containing a particle system | **163 / 216 = 75%** (1,661 particle objects) |
| Scenes containing text objects | 47 / 216 = 22% (451 objects) |
| Scenes with at least one layer effect chain | 189 / 216 = 87% |
| Scenes whose objects are image layers only, with no object-level effect | **5 / 216 = 2%** |
| Objects per scene | median 7, p90 31, max 377 |
| Effect chains per scene | median 4, p90 21, max 375 |

That 2% is an **upper bound, not a measurement of static themes**. Effect chains
also attach at the material level rather than on the object, which this census
did not inspect; the one of the five that was opened ("Water effect 13") ships
`materials/background.tex`, a `flowmask.tex`, a ripple material and a flow-image
shader. It is not a still picture.

A single representative theme needs three effect chains (a five-pass godrays
downsample/cast/gaussian/combine, plus pulse and water ripple), HLSL `frag`+`vert`
pairs compiled on load, three named FBOs with half-scale downsampling, a mask
texture, and a bloom post-process.

Rebuilding means shipping an HLSL→SPIR-V→WebGL compiler, Wallpaper Engine's
material/pass/FBO/bind model, its particle integrator **and seeded RNG**, its text
rasterizer, camera parallax/shake/fade, and scene scripts. That is months against
2% of scenes, and every unported feature renders visibly wrong — worse than
having no feature.

## 4. What each item resolves to

The importer resolves an item to exactly one of these outcomes, first match wins:

| Outcome | When | What happens |
|---|---|---|
| **image** | `project.file` names an image — `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp` | imported as an image asset, bytes unchanged |
| **video** | `type: video` and the payload is `.mp4` / `.wmv` | handed to the shared media normalizer (§6), then imported as an asset |
| **web** | `type: web` | **not imported.** Listed as unsupported with the reason, because rendering it needs a browser the host does not own |
| **scene** | `type: scene` | **not imported.** Opens the guided export (§8) |
| **preset** | no `type`, has `preset` | **not listed at all** (§1.2) |

### 4.1 Static images, and the one thing they are not

Static images are a supported outcome (R4), but on this install **no item has an
image payload** — all 447 directories were scanned and zero `project.file` values
end in an image extension. Wallpaper Engine stores a still theme as a *scene*
whose only object is an image layer, and that layer's pixels are a `.tex` member
inside `scene.pkg`.

A `.tex` is not an image format a browser can read. The member begins
`TEXV0005`, then `TEXI0001`, a texture-info block, a header CRC, and one or more
`TEXB0001` blocks carrying LZ4-compressed, mip-chained BC-compressed payloads.
Decoding it means a format enum table, an LZ4 stage, and BC1/BC3/BC7 decoders —
its own plan, with its own fixtures. **This spec does not decode `.tex`.**

So the image outcome is real and tested, but fixture-tested: the local library
has no live case. A still *scene* routes to the guided export (§8). The host
cannot tell a still scene from an animated one — that needs the same package
parse the `.tex` decoder would — so the sheet carries a **"This theme does not
animate"** toggle: on, it asks for duration 1 s and blend 0, which produces a
loop of one frame. Honest, occasionally wasteful, and one `.tex` decoder away
from being unnecessary.

GIF wallpapers need no special case: Wallpaper Engine converts them to `.mp4`
at subscribe time and they arrive as video items.

## 5. Architecture

### 5.1 Where it lives

```
src/web/packages/host/src/wallpaper-engine/
  locate.ts      find the install and every Steam library, or report absence
  library.ts     scan item directories, merge workshopcache.json rows
  resolve.ts     item → outcome, and the payload path
  wire.ts        the JSON the browser receives
```

A sibling of `themes/`, **not** a provider. `host/src/providers/` is the hardware
telemetry acquisition layer; a wallpaper library has none of its scheduling,
fallback or slot semantics, and putting it there would make it answer to the
telemetry lifecycle for no reason.

### 5.2 Host surface

```
GET /api/wallpaper-engine
  → { available: false, reason: "not-installed" | "unsupported-platform" | "no-library" }
  → { available: true, install: "<path>", items: [ StoredItem … ] }

GET /api/wallpaper-engine/item/<workshopId>/preview
  → image bytes, with the cache row's preview path as the source

GET /api/wallpaper-engine/item/<workshopId>/asset
  → the payload bytes with its content type; for a video, the source video the
    normalizer will consume
```

`StoredItem` carries what the editor's list needs and nothing more:

```
workshopId, title, kind (image | video | web | scene),
previewUrl?, filesize, tags[], properties (read-only),
attribution: { steamId?, workshopUrl? } | absent
```

The payload's absolute path stays in the host. The browser addresses an item by
`workshopId`, which is stable across Steam library moves; a path is not.

The route is read-only. There is no import-side host route: the editor fetches
the asset bytes and hands them to the existing asset manager, which already owns
the size caps and the reference model.

### 5.3 Editor surface

The asset importer in the editor's Add pane gains a source: **From Wallpaper
Engine**. It shows a list — thumbnail, title, kind, size — filtered by kind, with
a search field over the title. Selecting an `image` or `video` item fetches its
asset and calls `manager.import(file)`. A `scene` item opens the guided export
sheet (§8). A `web` item shows why it is unavailable.

When the host answers `available: false` the source is not drawn at all — the
Add pane looks exactly as it does today on a machine without Wallpaper Engine.

## 6. The video budget

Vigilia's existing caps are **32 MiB per asset**, **128 assets**, **128 MiB
total** (`host/src/themes/store.ts`). Measured across the 156 local video
wallpapers:

| Measure | Result |
|---|---|
| Median size | 22.2 MiB |
| Under 32 MiB | 92 / 156 = **59%** |
| At or over 32 MiB | 64 / 156 = **41%** |
| Largest | 456 MiB |
| Total for the whole video library | 7.7 GiB |

So pass-through covers a bare majority and nothing more. The importer does not
choose a profile, re-encode, or refuse on its own: it hands the source to the
**media normalizer owned by the store spec**, which already decided to bundle a
static ffmpeg and already owns MP4 validity (faststart, H.264 High, `yuv420p`,
even dimensions, CFR ≤30 fps, no audio, CRF 20–23, idempotent pass-through).

That normalizer's current rules produce a *valid* file, not a *small* one. This
spec adds one requirement to it rather than a second encoder:

> **R6a — the normalizer accepts a byte ceiling and meets it or refuses.**
> Given a source larger than the ceiling it selects a profile ladder (1080p,
> then 720p, then a lower bitrate) and reports which profile it used. If the
> smallest profile still exceeds the ceiling it returns a refusal naming the
> source size, and the editor says so before importing rather than failing
> inside the asset manager.

Until that normalizer lands, the video outcome is available only for assets
already inside the ceiling — the importer passes through and reports the rest as
"too large, awaiting media conversion". This is a sequencing dependency, not a
gap in this design.

## 7. Attribution

### 7.1 The member

The theme package gains one optional member:

```
credits.json
```

declared in `manifest.json` as `"credits": "credits.json"`, exactly as
`thumbnail` is declared today. `theme-package/src/index.ts` gains the constant,
the manifest check, the entry-size cap, and the "every file must be declared"
exception. A package that names a credits file it does not carry, or carries one
it does not name, is refused for the same reason a stray thumbnail is.

### 7.2 The shape

```json
{
  "format": "vigilia-theme-credits",
  "version": 1,
  "entries": [
    {
      "kind": "wallpaper",
      "title": "Water effect 13",
      "author": { "steamId": "76561198…" },
      "source": {
        "workshopId": "820654165",
        "url": "https://steamcommunity.com/sharedfiles/filedetails/?id=820654165"
      },
      "license": "unknown",
      "changes": "Re-encoded to 1080p30, audio removed"
    }
  ]
}
```

- `kind` is a short free string, not an enumeration: `wallpaper`, `image`,
  `font`, `icon`, `sound`, `other` are the values this importer writes, and a
  later asset finder adds its own without a format change.
- `license` is `unknown` when nothing was recorded. It is never guessed and
  never omitted — an absent licence is a fact worth showing.
- `changes` records what Vigilia did to the bytes. Re-encoding is a derivative
  work; the file says so.

### 7.3 What the importer writes

One entry per imported Wallpaper Engine item, built from the cache row:

```
kind      "wallpaper"
title     cache.title, or the directory name when the row is absent
author    { steamId: cache.authorsteamid }        (absent when no cache row)
source    { workshopId, url: cache.workshopurl }
license   "unknown"
changes   the normalizer's reported profile, or "Copied unchanged"
```

No author display name is written, because none is available offline (§1.4). The
credits UI renders the workshop URL as the attribution link; a display name is a
future addition that needs a Steam Web API key, and is out of scope here.

## 8. Scene themes: the guided export

An animated scene cannot be imported; the author must render it once with the
tool that can. The flow reduces that to a few clicks without touching the app.

1. The sheet names the item and shows its `preview.jpg`.
2. It states the export settings that match Vigilia's budget: **1920 × 1080,
   30 fps, duration 5 s, blend 1 s, format mp4 (H.264)**. The blend is what makes
   the loop seamless: Wallpaper Engine crossfades the last `blend` seconds into
   the first, which is also how stochastic content (particles) is made to repeat.
   A **"This theme does not animate"** toggle switches the guidance to 1 s and
   blend 0 (§4.1).
3. **Open in Wallpaper Engine** launches `wallpaperui.exe -project <path>` so the
   author lands in the editor with the project loaded. This is a launch, not a
   drive (R1). The flag's exact semantics are verified at implementation; if it
   does not select the project, the button is removed rather than worked around.
4. The sheet then watches for the result: while it is open, the host polls for
   `.mp4` files modified after the sheet opened, in
   `<install>/projects/temp/`, `<install>/projects/myprojects/`, and the
   Windows `Videos` folder only. The newest match is offered as the import. The
   polling scope is fixed and small on purpose — Vigilia does not roam the
   author's profile.
5. If the export went somewhere else, the sheet says so and points at the normal
   **Add → File** route. That is not a Wallpaper Engine feature, and the sheet
   does not pretend otherwise.

Element removal — the clock, and anything else a viewer should not see — stays
out of scope as agreed. The supported answer is the author's own Wallpaper
Engine property values (§1.3), which are what the render reads.

## 9. What already exists, and must not be rebuilt

| Need | Owner today |
|---|---|
| Asset ingestion, size caps, reference model | `editor/src/asset-manager` |
| Video validity (faststart, codec, CFR, audio) | the store spec's media normalizer |
| A video as artboard background | `Artboard.backgroundMedia = { assetId, fit }`, `BACKGROUND_MEDIA_FITS` |
| Playing it | `scene-fabric/src/background-media.ts` (`autoplay muted loop playsInline`) |
| Package member validation | `theme-package/src/index.ts` |
| Thumbnails, library import | `host/src/themes/thumbnails.ts`, `themes/import.ts` |

The importer adds discovery and a file source. It adds no renderer, no encoder,
no second background model and no second package format.

## 10. Reuse gate — the seven rungs

Required because the work touches `theme-package/src/index.ts` and proposes a
change to the normalizer. Recorded here; the decision note lands before the first
write.

**Rung 1 — Vigilia.** Searched for an existing library scanner, asset source,
transcoder and credits model. Found: asset manager (import, caps), theme store
(import, thumbnails, trash), background media (video playback), no scanner, no
transcoder, no credits model anywhere.

**Rung 2 — dependencies.** Searched installed packages for a Steam library
reader, a video probe/transcode binding, and a pkg reader. Found none. Prior art
outside the tree: `rePKG` (.NET, pkg extraction), `Steam-Library-Manager`-style
VDF parsers. None is a dependency worth adding for a 30-line VDF read and a
100-line container read.

**Rung 3 — platform.** Node's `fs` covers the scan; `vdf` is a plain key-value
text format; `.pkg` is a simple table-then-blob container. No native API adds
anything.

**Rung 4 — ecosystem.** Searched for prior art on automating Wallpaper Engine's
export. Found only screen-capture tools and UI automations, all of which the
author's own vendor blocks (§2). No project has solved "render a WE scene
headlessly", which is consistent with §3: it would be an engine port.

**Rung 5 — comparison.** The remaining choices are where the flow lives
(host vs editor vs new package) and whether the asset arrives as bytes over a
route or as a file path. Bytes-over-route wins because it reuses the asset
manager's caps and reference model unchanged.

**Rung 6 — probe.** Executed: a package reader against 238 real `scene.pkg`
files during investigation (§3 — used to take the census, not shipped), the
cache against the disk (421 vs 447, §1.4), every `project.file` against an image
extension (0 of 447, §4.1), and the video sizes against the 32 MiB cap (§6).

**Rung 7 — build.** The smallest build that holds: one host module, three routes,
one editor source. No new dependency.

## 11. Failure modes and refusals

| Situation | Behaviour |
|---|---|
| Wallpaper Engine not installed | source not drawn; route answers `available: false` |
| Not Windows | `available: false, reason: "unsupported-platform"` — WE is Windows-only |
| Install found, no library folders | `available: false, reason: "no-library"` |
| Item directory unreadable | item omitted from the list, counted in a `skipped` figure the host reports |
| Preset item | never listed (§1.2) |
| Cache row missing for a directory | listed, with attribution absent |
| `scene.pkg` missing or unreadable | still listed as `scene` — the payload is checked for existence, not parsed |
| Video over the ceiling | listed with the reason; import disabled until the normalizer can meet it (R6a) |
| Web item | listed as unsupported with the reason |
| Export watcher finds nothing after the sheet is closed | no error; the sheet simply closes |

No failure is silent. Every refusal names the item and the reason, in the editor.

## 12. What this does not decide

- Whether a Vigilia theme can be *published* with a Wallpaper Engine derivative
  in it. The credits file records provenance; the legal question is not answered
  here.
- Author display names (§7.3).
- Web wallpapers (§4).
- Rendering scenes (R2).
- The author's own projects under `projects/myprojects/`. Only subscribed
  workshop items are listed, because the premise is a theme the author has
  already downloaded. A local project has no workshop id to key it by, and
  inventing one is a separate decision.
- Any write to Wallpaper Engine's configuration (R1).

## 13. Landing order

1. **Host discovery and resolution** — `locate`, `library`, `resolve`, the three
   routes, unit tests over fixture directories and a recorded
   `workshopcache.json` slice.
2. **Editor source** — the list, the image path, the refusal states.
3. **Credits member** — `theme-package` change, the importer writing entries, the
   credits surface in the theme's details.
4. **Video path** — joins the media normalizer when it lands; before that, the
   pass-through-inside-budget behaviour of §6.
5. **Guided export** — the sheet, the launch, the watcher.

Phase 1 is independently useful and testable. Phases 4 and 5 are the only ones
that depend on other plans.

## 14. Open questions

1. **Does `wallpaperui.exe -project <path>` select the project in the editor?**
   The flag exists; its semantics are unverified. Phase 5 verifies it and drops
   the button if it does not hold.
2. **Where does Wallpaper Engine's editor export dialog default to?** Unknown;
   the watcher's fixed scope (§8, step 4) is designed so the answer changes convenience,
   not correctness.
3. **The 22 scene packages that did not parse.** Their container layout differs.
   The conservative outcome (§11) covers them, but the number is a bounded gap,
   not a measured zero.

## 15. Acceptance

- `GET /api/wallpaper-engine` on this machine lists **396** items — 447
  directories, minus 23 presets and 28 with no readable `project.json` — of which
  **15** are web and the rest resolve to video or scene. Zero resolve to image
  here; that path is proven by fixture.
- Every listed item has a `kind`; no listed item has `kind: "unknown"`.
- An image item imports through the asset manager and appears as an asset with
  its bytes unchanged (byte-for-byte comparison).
- A video item under 32 MiB imports through the normalizer and plays in the
  player with `loop` and no audio.
- A video item over 32 MiB is listed with a reason and cannot be imported.
- A scene item offers the guided sheet and never offers "Import".
- A preset item is not listed.
- With Wallpaper Engine absent, the Add pane is byte-identical to today's,
  proven by the existing DOM test passing unchanged.
- `credits.json` round-trips through package create → validate → import, and a
  package carrying an undeclared credits file is refused.
- A fixture item whose `project.file` is `.png` resolves to `image` and imports
  byte-for-byte; a `scene` item never offers "Import".

## 16. Measurements, reproducible

```text
workshopcache.json rows                     421
workshop content directories                447
no readable project.json                     28
presets (no type, has preset)                23
types        scene/scene 188+37, video/video 144+12, web/web 12+3
project.file with an image extension        0 / 447
scene.pkg parsed                            216 / 238
scenes with a particle system               163 (75%)
scenes with text objects                     47 (22%)
image-only objects, no object-level effect     5 (2%, an upper bound — §3)
video wallpapers under 32 MiB                92 / 156 (59%)
video sizes        median 22.2 MiB, max 456.4 MiB, total 7.7 GiB
```

All figures were read from this machine's installed library on 2026-10-21 with
Wallpaper Engine 2.8.42. They describe a sample, not a guarantee.
