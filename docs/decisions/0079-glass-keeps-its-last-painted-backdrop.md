# 0079 — Glass keeps its last painted backdrop across a frame the media cannot paint

- **Date:** 2026-10-20
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/glass.ts`, `src/web/packages/scene-fabric/src/background-media.ts`

## The problem

On a phone, with a video background, **all** glass panels lose their body for one frame every few seconds: the
material reads as far more transparent, then returns. `vg-647` has the diagnosis, established from the user's
five observations against the source. The shape that had to be decided is narrow and easy to get wrong:

`composite` rebuilds each panel's backdrop from nothing every frame. `surfaceFor` **clears** the panel's scratch
(`glass.ts:523`), `media.paint` draws the wallpaper into it, and the canvas's own pixels are then composited
over that (`glass.ts:422-432`) before the whole scratch goes back over the panel with `blur(...) saturate(...)`
(`glass.ts:474-484`). So the glass is *backdrop + tint*, and when the wallpaper draw contributes nothing the
scratch holds only the canvas's pixels — which are **transparent** where the video is, because the media is a
DOM sibling *below* the canvas (`background-media.ts:60`), not an object on it. The panel's tint then lands on
transparency and the reader sees raw video through it.

The wallpaper draw contributes nothing for exactly one reason: `intrinsic` refuses a video whose `readyState`
is below `HAVE_CURRENT_DATA` (`background-media.ts:312`). The question this note answers is **what glass should
show when its backdrop has no frame** — and the second question hiding behind it, whether the refusal is even
the defect.

## Rung 1 — Vigilia

Searched: `last good` / `lastGood` / `previous frame` / `prevFrame` / `stale backdrop` / `keepLast` /
`fallback frame` across every `packages/*/src`; every use of `readyState` in the repo; `notifyOnDecode`,
`followFrames`, `intrinsic`, `paint`, `surfaceFor`, `composite`, `liveSurfaces`.

Found: **nothing that keeps a last-good frame.** Two adjacent things exist and neither is it.
`notifyOnDecode` (`background-media.ts:289-305`) handles the *image's* one-shot version of this — one
notification when the decode lands — and explicitly returns `undefined` for a video because a video's first
frame is already the first `requestVideoFrameCallback`. That is the image's problem solved once and the
video's recurring version handled by nothing. And `glass-lifecycle.dom.test.ts:47-84` already pins the
opposite property for the *canvas* half: a palette change below the panel must be **re-sampled**, not served
from a stale backdrop. So the repo has a rule that the canvas side must never go stale, and no rule at all for
the media side. That asymmetry is the whole finding.

## Rung 2 — dependencies

Searched: `scene-fabric`'s manifest (`@vigilia/renderer-core`, `echarts@6.1.0`, `fabric@7.4.0`), and Fabric's
own surface for anything that caches a backdrop or a media frame.

Found: **nothing.** Fabric caches *object* rendering (`objectCaching`, `_cacheContext`) — which is a different
thing and is already handled, since `composite` refuses to sample an ancestor's cache (`glass.ts:353-364`) —
and it has no notion of a DOM media layer below the canvas at all. The backdrop is entirely ours.

## Rung 3 — platform

Searched: the normative rule for `drawImage` with an `HTMLVideoElement` (MDN's `drawImage` page, fetched).

Found: **`readyState` must be greater than 1.** Below `HAVE_CURRENT_DATA` the call throws `InvalidStateError`.
So the repo's `if (element.readyState < 2) return undefined;` is **the platform's own precondition, not a
conservative choice of ours** — and this is the fact that decides the design. Loosening the check is not a
candidate: there is no frame to draw, and the call would throw rather than draw nothing. The refusal is
honest; the defect is that `surfaceFor` already cleared the scratch before the paint was attempted.

Also from the probe's event log, and normative rather than incidental: a looping `<video>` implements the wrap
as a **seek to zero** — `seeking` and `waiting` fire together at `currentTime = 0`, and `seeked`/`canplay`/
`playing` follow. The seam is a seek, not a decode stall.

## Rung 4 — ecosystem

**This rung could not be run, and that is recorded rather than papered over.** Every `WebSearch` call returned
either malformed tool-call syntax or an explicit refusal — *"No web-search tool in this session — cannot run
live query. Answer from known behavior"*. Recall is not a search result and is not evidence, so no ecosystem
finding is claimed here.

Queries attempted, all dead: *"canvas drawImage HTMLVideoElement readyState HAVE_NOTHING HAVE_METADATA
InvalidStateError throw spec precondition"*; *"drawImage video element readyState HAVE_CURRENT_DATA
InvalidStateError"*; *"canvas backdrop blur video loop seam transparent frame keep last frame double buffer"*;
*"video loop readyState dips canvas drawImage blank"*. The one coherent answer returned — *"otherwise blit last
good frame from an offscreen canvas"* — arrived labelled as recall, so it is recorded as **agreement, not
evidence**, and the decision below does not rest on it.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Skip the whole glass render on that frame | Keeps the panel's previous *appearance* | None to build | **Disqualified by the renderer**: Fabric repaints the canvas from scratch every frame, so there is no previous appearance on the canvas to keep — skipping would drop the panel's own fill for that frame and trade one visible defect for another | Rejected |
| Loosen `readyState < 2` | — | — | **Disqualified by the platform** (rung 3): there is no frame to draw and `drawImage` throws | Rejected |
| Keep the last **scratch** by not clearing it | Cheapest to write | One less `clearRect` | The scratch also holds the canvas's own pixels from the previous frame, so a moved or removed object leaves a **ghost** in the region — and it breaks `glass-lifecycle.dom.test.ts`'s "re-samples the pixels a palette change repaints below the panel" | Rejected |
| Keep the last **backdrop** in its own surface | The scratch is still fully rebuilt each frame, so the canvas half stays fresh and only the media half is reused | One extra canvas per panel, bounded by `MAX_BACKDROP_PIXELS`; one extra blit per panel per frame | None found; the fallback is only consulted when the media cannot paint | **Chosen** |

## Rung 6 — probe

Measured, not inferred. `C:\tmp\seam-probe2.mjs` (outside the repo), Playwright + Chromium, a real 2340×1080
clip of **3.533 s** looping with `muted`/`autoplay`/`playsinline`, sampling `readyState` every
`requestAnimationFrame` and replicating the repo's own guard. **1158 rAF samples over ~19.4 s.**

- **`readyState` fell below `HAVE_CURRENT_DATA` 6 times, and the guard skipped 16 frames.**
- **Five of the six are loop seams**, at t = 3782, 7399, 11029, 14634, 18265 ms — deltas of **3617, 3630, 3605,
  3631 ms**, matching the clip's 3.533 s duration plus the seek. The sixth is startup (`readyState 0`, 8
  frames).
- **At every seam `seeking` and `waiting` fire together with `readyState = 1` and `currentTime = 0`**, and
  `seeked`/`canplay`/`playing` return `readyState = 4` within **20–35 ms**.
- So the window is **20–35 ms every ~3.6 s** — one to two frames at 60 Hz, which is exactly the reported "one
  frame every few seconds", and it is the video's own period because the video's decoded frames are what drive
  the repaints (`followFrames` → `canvas.requestRenderAll()`).

This closes the one claim `vg-647` recorded as **inferred**: that a looping video's `readyState` really does
dip below 2 at the wrap. It does, at every wrap, for 20–35 ms. It also bounds the fix: a fallback that survives
one or two frames is enough, so no history and no frame buffer is needed.

Two limits, stated rather than implied: the probe ran in **desktop Chromium on this box**, not on the phone,
and it measured a plain `<video>`, not the player's own layer. The phone's own numbers could differ; the
mechanism does not depend on them.

## Rung 6b — the fix, proved in a browser

Rung 6 measured the mechanism. This measures the **fix**, as a real A/B: one script, one clip, and the only
difference between the arms the source. `C:\tmp\glass-proof` (outside the repo) is a Vite-served page that
calls the real `mountFabricScene`, so the real `createGlass` and the real `mountBackgroundMedia` run against
the user's own 3.533 s recording. It forces `renderAll()` on every frame, so the seam is sampled whatever
else drives repaints, and reads `getImageData` at the panel's centre and at (4, 4) outside it.

~1208 frames per arm over ~20 s. The five loop wraps land at t = 3839, 7454, 11070, 14670, 18287 ms with
`currentTime = 0` and `readyState = 1` — rung 6's 3782/7399/11029/14634/18265, within the harness's own
startup offset.

| | at every loop wrap | frames either side |
|---|---|---|
| **reuse disabled** (`return unmoved ? element : undefined` → `return undefined`) | alpha **130**, rgb `[253,253,253]` — the 50% white tint over **transparency** | alpha 255, per-channel jump **222-223** |
| **HEAD**, the fix | alpha **255**, rgb held at the last painted `[156,185,196]` | alpha 255, `jumpIn` **0**, `jumpOut` 0-1 |

The pixel outside the panel reads `[0,0,0,0]` in both arms, so the signal is the panel's own. That is the
reported defect at the level the user saw it, and its removal.

**One harness fact is recorded because it produced a false green first.** The adapter paints the plan's
artboard fill onto the canvas as its `backgroundColor` (`adapter.ts:284`), with no reference to whether a
media layer sits below it. The first run used `background: "#101318"`, which made the canvas opaque
everywhere: `maxFrameDelta` was **0** across 1208 frames and alpha was **255 in both arms**. A probe that
cannot move is not a passing probe — the media blit was simply covered. The harness needs
`background: "transparent"`, the only paint under which a video background is visible at all. That is filed
as `vg-667` rather than settled here.

## Decision

**Keep the last successfully painted backdrop in a surface of its own, per panel, and paint the media into it
before compositing; when the media cannot paint, blit that surface into the scratch instead.** Chosen because
it is the only option that leaves the canvas half of the scratch freshly rebuilt every frame — which is what
`glass-lifecycle.dom.test.ts` already requires — while restoring the media half exactly as the reader last saw
it. The evidence is that the media *is* being shown to the reader and only the sampler lost it: the browser's
compositor holds the last presented frame, which is why the user's fourth observation was that the video
appeared normal. Keeping the last painted backdrop restores precisely what was on screen.

The fallback is keyed to the **region**: a backdrop painted for a different region is at the wrong offset, so it
is used only when the region matches, and the first frame after a move falls back to today's behaviour. That
bounds the change to the case reported.

`liveSurfaces()` keeps counting only the scratch, so `vg-643`'s floor is untouched.
