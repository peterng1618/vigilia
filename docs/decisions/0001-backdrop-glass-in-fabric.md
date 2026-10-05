# 0001 — Backdrop glass composites at Fabric's render boundary, not in a DOM layer

- **Date:** 2026-09-27
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/glass.ts`,
  `src/web/packages/scene-fabric/src/background-media.ts`,
  `src/web/packages/scene-fabric/src/scene.ts`

> **This note is late.** The work it describes shipped in Tasks 4 and 5 before
> rungs 4–5 were run. It is recorded now, from the search that was done after
> the fact, because the omission is the reason this file exists — see
> `AGENTS.md`'s reuse gate. The decision itself was reached by measurement and
> has not changed.

## The problem

A theme needs panels that blur the artwork behind them, in two mounts that
share no code: the editor's interactive `Canvas` and the player's
`StaticCanvas`. The background media is currently a `<video>` or `<img>` in a
DOM layer *below* the canvas, so nothing Fabric draws can see it. Glass over
that is a sampling problem, not a blur problem: which pixels, in what order,
re-drawn when, and released when.

## Rung 1 — Vigilia

Searched: `scene-fabric/src/{scene,background-media,adapter,persist}.ts`,
`editor/src/editor-shell.ts`, `docs/architecture/ownership.md`.

Found: `mountBackgroundMedia` creates a `div[data-vigilia-background-media]`
the host `prepend`s below the canvas; its handle exposes only `update`,
`setBounds` and `destroy` — no pixel access. The editor already mounts a
non-authored artboard plate as `canvas.backgroundImage` (`artboardPlate`,
`editor-shell.ts:123`, `excludeFromExport: true`). The codebase already
registers custom Fabric classes (`VigiliaChart` via `classRegistry`).

## Rung 2 — dependencies

Searched: `scene-fabric` and player `package.json`.

Found: `fabric@7.4.0` and `echarts@6.1.0` only. Fabric ships 24 filters and
both `Canvas2dFilterBackend` and `WebGLFilterBackend`, and its
`toCanvasElement` accepts a `filter` option. None of that is a backdrop blur;
it is a filter over a *source*, and the source is the whole problem.

## Rung 3 — platform

Searched: `CanvasRenderingContext2D.filter`, `drawImage`,
`requestVideoFrameCallback`, `HTMLCanvasElement.toDataURL`.

Found: `ctx.filter = blur(Npx)` + `drawImage` is native and fast, and gives a
clipped, rounded, tinted result. It leaves sampling, ordering, invalidation and
disposal entirely to us. `drawImage` accepts a `<video>` directly.
Cross-origin sources taint the context, and `getImageData` then throws — a
constraint, not a solution.

## Rung 4 — ecosystem

Searched: how existing canvas and WebGL implementations do backdrop blur over a
video background, and whether any treat the media as a scene object.

Found — every capable implementation **samples a background it controls**, and
none of them reaches into a DOM sibling:

- **`glass-gl`** exposes the pattern as its API: `setBackground(videoEl)`,
  documented as "LIVE — re-uploaded every frame — so a playing video refracts in
  real time". Its own comparison table states the rule: glass refracting a live
  DOM element behind it is "**no — bake it into the background instead**".
- **`liquid-glass-canvas`** takes `source: HTMLCanvasElement` as the backdrop and
  tracks DOM elements as lenses. Same assumption, stated as an API.
- **`html-in-canvas` / `Canvas UI Frost`** put the background inside
  `<canvas layoutsubtree>` and capture it with `drawElementImage()` — the same
  move, behind a Chromium dev-trial flag.
- **StackOverflow (2018)**, video controls over a blurred video crop, runs its
  `requestAnimationFrame` copy loop **only while hovered and only while
  playing** — "no point in rendering to a canvas you can't see". That is the
  same property Task 5 later established and pinned: glass adds zero repaints
  on an idle scene. Two independent routes, same answer.
- **`liquid-glass-canvas`** documents the taint rule we hit independently: a
  source canvas drawing cross-origin video must be CORS-served and loaded
  `crossOrigin = "anonymous"`, or it is tainted.

None is adoptable here. Every WebGL option needs something we do not want — a
Chromium dev trial, a `html2canvas-pro` peer dependency, WebGL2, or a separate
overlay canvas and render loop — and each buys refraction, chromatic dispersion
and lensing that the reference does not call for.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `backdrop-filter` on a DOM panel | fails: cannot express per-object scene order or clipping | — | — | rejected |
| WebGL lens library | over-scoped; full-artboard texture upload per frame | large | new dep + WebGL2 | rejected |
| Patch Fabric to know the DOM layer | fixes nothing structural; still a sibling, still unsampled by Fabric | fork forever | maintaining a fork | rejected |
| **Composite in the canvas at `before:render`** | samples the composited scene; one code path for both mounts; capture inherits | ~1–2 ms/frame marginal, paid only on change | Fabric private field (`_cacheContext`) | **accepted** |

## Rung 6 — probe

Measured on a 1672×941 artboard, headless Chromium, DPR 1: **+0.61 ms**
StaticCanvas / **+0.69 ms** interactive, **0 idle repaints in 1000 ms**, sharp
foreground **bit-for-bit unchanged**, `sampledInsideCache: 0` throughout. Radius
flat 0–48 units, so 48 is the cap. See the plan's *Task 1 result*.

Three things the probe could not answer, later measured or still open:

- Whether the media is sampled at the right offset — the 14 px residual was
  re-measured to 2 px, an artefact of the run detector; the horizontal
  `deviceLeft` term rides with the open asset-404 bug.
- Video invalidation, which was **measured broken** and then fixed.
- Per-frame cost on target hardware. The ~1–2 ms figure is one 20-core dev
  machine; §124's floor is real low-end phones. **Open.**

## Decision

Composite in the canvas, on Fabric's per-object `before:render`, with native
`ctx.filter`.

**Not because `ctx.filter` exists** — that is the answer to a question nobody
asked. The media handoff, the cache-ancestor walk, the invalidation and the
disposal are the work, and the ecosystem search is what established that the
shape is right and the two things everyone does independently (put the media in
the canvas; gate the loop on need) are the ones we also had to learn.

**Known cost, recorded rather than assumed:** keeping the media a DOM sibling
means the sampler is handed the resolved element, which is exactly how the
editor came to wire *no backdrop at all* and have every panel sample nothing.
Moving the backdrop into the canvas would remove that class of defect
structurally, at the price of a full-artboard draw per repaint instead of a
panel-sized one. The ecosystem pays that same price to buy optics we do not
want. **Revisit if glass cost or media handling becomes a recurring source of
defects — not before.**
