# Asset ownership: what the editor holds, and telling the author when disk moved

- **Status:** backlog


A theme's assets have lived on the host's disk since `3117a91`
(`themes/<id>/assets/`). The editor is a browser talking to a host that has the
file. This spec asks whether the editor needs to hold those bytes at all, and what
it would take for an author who edits an asset in an external editor to see the
change without reimporting it.

Two questions arrived together — "is a big video in browser memory terrible?"
and "can I just overwrite the file on disk?" — and the measurements say the
first is not where the cost is. The second is small, cheap, and worth doing.

Everything below was measured on win32 / Node 24.13 / Chromium, against the built
editor and a real host on a private port with a private app-dir.

## Measurements

Fixtures were high-entropy PNGs so they do not compress: 2.76 MB and 23.65 MB.
Each stage was measured after a forced `HeapProfiler.collectGarbage`, because an
uncollected delta is mostly garbage — the same import read +177 MB uncollected
and a fraction of that retained.

**Where a 23.65 MB asset's cost actually goes, on the editor's import path:**

| Step | Retained | Time |
| --- | --- | --- |
| `File.arrayBuffer()` → `Uint8Array` | +1.6 MB | 1994 ms |
| preview `Blob` + object URL | −0.2 MB | 388 ms |
| `sha256` over the bytes | +0.4 MB | 485 ms |
| decode + paint 6000×6000 | −1.3 MB | 887 ms |
| **`documentKey()`** | **+90.1 MB** | **1700 ms** |

Three things follow, and two of them contradict the question as asked.

**The held bytes are cheap.** `import()` does
`new Uint8Array(await file.arrayBuffer())`, which *views* the `ArrayBuffer`
rather than copying it — 23.65 MB of file costs 1.6 MB retained. There is no
size cap on import, so a large file is accepted, but the editor is not
accumulating megabytes per megabyte. A `video` is accepted (`TYPES` lists `mp4`
and `webm`) and, per the same arithmetic, costs its own size once.

**The preview `Blob` costs nothing measurable.** −0.2 MB is noise. Blob storage
is not on the JS heap. The "held twice" concern is real as a description of the
code and is not a real cost.

**The expensive thing is `documentKey`.**
`persistence-manager/index.ts:123-133` builds the dirty key by spreading each
asset into a plain array and stringifying it:

```ts
.map(([path, bytes]) => [path, [...bytes]])
```

That is one boxed JS number per byte, then a string of all of them. For the
23.65 MB asset: **1266 ms and an 86.0 MB string**, retaining 90.1 MB until the
next collection. In Node the same shape scales as 1 MB → 90 ms, 4 MB → 377 ms,
16 MB → 1081 ms, 32 MB → 2928 ms with +733 MB heapUsed.

This runs on every `isDirty()` and every `markSaved()`. `isDirty` is called from
`#confirmReplacement` — open, new, and new-from-starter — and `markSaved` after
every save and every library write. So opening a theme with one large asset costs
over a second of blocked main thread and ~90 MB of transient heap to produce a
string that is compared and discarded. **This, not the video, is what "terrible
for performance" would look like if it happened.**

## The host accepts writes it will refuse to read

Found while measuring, and worse than either half of the original question.

`ThemeStore.read` refuses a theme whose asset exceeds `MAX_ASSET_BYTES` (32 MB),
whose asset count exceeds 128, or whose total exceeds 128 MB
(`themes/store.ts:435-450`). **`write` enforces none of them.** Probed against a
real host:

| Asset | `PUT /api/themes/:id` | `GET /api/themes/:id` | `GET …/assets/v.mp4` |
| --- | --- | --- | --- |
| 31 MB | 200 | 200 | 200 |
| 32 MB | 200 | 200 | 200 |
| **33 MB** | **200** | **404** | **404** |
| 40 MB | 200 | 404 | 404 |

The 40 MB theme is on disk, appears in `GET /api/themes`, and cannot be opened or
played. An author who imports a large background video, saves, and is told
"Saved to library" has a theme that renders nowhere — and the last asset route is
the one the **player** uses, so the display is blank too. Nothing in the save
path says so.

So the honest answer to "is holding a big video in browser memory terrible?" is:
the memory is tolerable, and the real cost of a big video is that it is
**unusable**, because the write and the read disagree about what a legal asset
is. The editor's 96 MB upload ceiling and the store's 32 MB per-asset ceiling
are different numbers, and only the first is checked on the way in.

## Does the editor need the bytes?

Every consumer of `AssetManager.#assets`:

| Consumer | Site | Needs bytes? |
| --- | --- | --- |
| Panel preview | `panel.ts:89` → `previewUrl` | No — an `<img>` renders from a URL |
| Placed images | `hydrate` → `FabricImage.fromURL` | No |
| Background media | `backgroundSource`, `editor-session.ts:939` | No — a `<video>`/`<img>` `src` |
| Font loading | `scene-fabric/font-assets.ts:103` | **Yes** — `FontFace` takes an `ArrayBuffer` |
| Export | `persist.ts` → `writeThemePackage` | **Yes** — one whole map, no partial |
| Thumbnail | `captureThumbnail(canvas, …)` | No — reads the canvas |

**The player already streams by URL.** `player/src/main.ts:299` builds
`createAssetResolver(theme.assets, { baseUrl: "/api/themes/<id>/" })`, and
`scene-fabric` hands that URL to Fabric and to `mountBackgroundMedia`. Only fonts
are fetched as bytes. The host's route answers
`GET /api/themes/<id>/assets/<path>` with a real content type — measured 200 and
24,803,383 bytes for the 23.65 MB fixture.

So a hosted URL is already the answer for a background video, and it already
works. The editor is the last place still pulling bytes. It also copies once more
than it needs to: `theme-library-client` decodes base64 to a `Uint8Array`, then
`AssetManager.load` calls `new Uint8Array(bytes)` on it, which **copies** (the
copying constructor is the typed-array form; the `ArrayBuffer` form views).

## Target shape

**The editor holds declarations, not bytes, for every asset that is already on
the host; it holds bytes only for what it cannot get otherwise.**

1. An asset whose bytes are on disk is referenced by URL
   (`/api/themes/<id>/assets/<path>`), not held. The preview, the placed image
   and the background media all take that URL unchanged.
2. An asset the author has just imported, and not yet saved, is still held —
   there is nowhere else for it to be. This is transient by construction.
3. A font is still fetched as bytes, because `FontFace` requires an
   `ArrayBuffer`. A woff2 is tens of KB.
4. `load` stops copying the `Uint8Array` it is handed.

The 4th item is a one-line change with an immediate effect and no design
consequence. Items 1–3 are the shape.

## What breaks, and how each break is handled

**The export.** `writeThemePackage` needs every declared byte in one call
(`theme-package/src/index.ts:59-65` rejects a partial map), and a
`.vigilia-theme` is a portable file for someone with no host. **The host must
not build it** — that would make the export depend on the library folder, and a
theme with unsaved work, which is the normal state while authoring, has nothing
on disk to package. The editor fetches the bytes it does not hold, on demand,
only when the author presses export. Cost: one fetch, and a peak equal to the
package size instead of a permanently held copy. This is the same trade `70a510f`
made for saves, in the other direction, and it builds on it: a save already
carries only the assets whose `sha256` moved from the base, and `95803e9` made an
unchanged save put no asset bytes on the wire at all.

**A save.** Already solved and unaffected — `#libraryPayload` sends only what
moved, and the host takes the rest from the folder it is replacing. If the editor
stops holding unchanged bytes, that path gets *cheaper*, not harder.

**Conflict resolution.** `#resolveConflict` re-sends the author's document with
`overwrite`, which deliberately carries the whole theme. If the editor no longer
holds it, this road needs the same on-demand fetch as the export. It is the one
place where "unchanged" is not safe to assume, because the guard is stood down.

**Open.** `client.open` returns base64 assets; the editor would stop decoding
what it can address by URL and keep the declarations. The document itself is
already `no-store` and stays as it is.

## The dirty signal

Measured on win32/NTFS:

- **`fs.watch`, non-recursive on `<library>/<id>/assets/`** — fires on in-place
  writes and on a rename-over (7 events for one write plus one atomic save);
  recursive on the theme folder also fires. The "unreliable on Windows" worry
  does not bite for *detection* here. But **5 sequential writes produced 10
  events**: it is a trigger, not a signal.
- **Polling digests naively** — 383–402 ms per tick, reading and hashing
  159.7 MB. At a 3 s interval that is **~13 % of one core, permanently**.
- **Polling with a `size:mtimeMs` prefilter** — stat every declared file, hash
  only what moved: **1.9–4.2 ms idle**, and 70.8 ms on the tick that detects an
  external overwrite, correctly reporting `bigvid/assets/big.png`.
- **A new SSE stream** — the existing one is display-side sensor telemetry
  (`transport/sse.ts`, `SAMPLE_EVENT`) and has no editor connection. A second
  event type on a display-scoped connection would leak asset state to displays,
  and a third stream is a new mechanism for a 2 ms problem.

**Choose `fs.watch` as the trigger and the stat-prefiltered digest compare as the
signal.** The watch costs nothing when idle and wakes the sweep immediately; the
sweep decides, so the 10-events-for-5-writes behaviour is harmless. Where a watch
cannot be opened, the 2 ms sweep alone is a correct fallback on its own — the
watch is latency, not correctness. This is safe on Windows because it was
measured, and safe elsewhere because the watch is never the only thing standing
between the author and a missed change.

The declaration's `sha256` is the authority, and nothing on the host re-hashes a
file against it today — `createHash` appears once in `store.ts`, for the
document's own content id. Making the declared digest true against the file on
disk is what the "overwrite on disk" desire actually needs, and it is the same
predicate the store should use to refuse a theme whose bytes have drifted.

## Sequence

Ordered so that each step is independently useful and the blocking defect lands
first.

1. **Refuse a write the store would refuse to read.** Apply `MAX_ASSET_BYTES`,
   `MAX_ASSET_COUNT` and `MAX_TOTAL_ASSET_BYTES` in `checked()`, so a 33 MB asset
   is refused at save time with a message that says why, instead of accepted and
   then unreadable. This is a real defect with a named cause
   (`themes/store.ts:435-450` is enforced only on the read path) and one owner.
2. **Stop the copy-on-open** in `AssetManager.load` — view the `Uint8Array` it is
   handed instead of copying it.
3. **Fix `documentKey`**, which is the measured cost and the reason this question
   was worth asking. The key needs to distinguish "the document changed" from
   "an asset's bytes changed", and both are already answers the code has: the
   envelope's own JSON, and each asset's `sha256`. Neither needs the bytes. This
   is a pure-function change with an existing test surface and it removes 1.3 s
   and 90 MB from every open of a theme with a large asset.
4. **Add the size cap on import**, so the editor refuses early what the host
   would refuse late, with the host's numbers rather than its own.
5. **Address held assets by URL**, once 1–4 have made the held set small enough
   for the change to be about URLs rather than about memory.
6. **The dirty signal and the reload control**, as one feature: the prefiltered
   sweep, the `fs.watch` trigger, and a "files on disk changed — reload assets"
   affordance in the asset panel.

Step 3 is where the measured cost is and steps 5–6 are where the user's actual
request lives. If only one ships, ship 1 and 3.

## The honest cost

- Step 1 changes what the product accepts. An author who today saves a 33 MB
  asset and gets silence will instead be told no. That is the point, but it is a
  behaviour change, and the ceiling is the store's 32 MB — chosen, not measured.
- Step 5 makes the editor depend on the host for the bytes it draws, so the
  editor preview stops working offline for any theme already in the library. A
  `.vigilia-theme` opened from a file has no host URL and keeps holding its
  bytes, which means the editor has two modes rather than one. That is the
  largest real cost of the target shape and it is why step 5 comes after the
  cheap ones.
- The export and the deliberate-overwrite road both need an on-demand fetch path
  that does not exist yet. It is the same fetch, so it is one piece of work
  counted twice.
- The dirty signal adds a host route, a sweep, and a control, and it is worthless
  for a theme opened from a file rather than the library — the honest scope is
  "the library", and the UI must not imply otherwise.

## Not verified

- `fs.watch` on macOS and Linux. Everything measured here is win32/NTFS. The
  stat-prefilter is the reason that is acceptable, not evidence that the watch
  works elsewhere.
- A real `mp4`/`webm` through the product. The 23.65 MB fixture is a real image
  through the real import path; the video conclusions rest on the player already
  streaming by URL and on the host's size arithmetic.
- The save-refused road end to end in a browser. The code path
  (`#resolveConflict`, `ThemeConflictError`) was read, not driven.
- Whether 32 MB is the right per-asset ceiling for a background video. It is the
  store's existing number, carried forward, not a measurement.
