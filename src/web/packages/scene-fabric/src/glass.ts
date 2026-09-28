import { glassTreatment } from "@vigilia/renderer-core";
import { type FabricObject, Group, type StaticCanvas } from "fabric/es";

/**
 * Backdrop blur for authored glass panels. A panel samples the surface Fabric is
 * painting during its own `before:render`, so one path serves the live editor
 * canvas, the player's `StaticCanvas` and `toCanvasElement` capture — the panel
 * sees whatever was painted before it, which is what "behind this panel" means.
 *
 * The authored property and its validation belong to `renderer-core`; only the
 * lifecycle lives here.
 */

/** A region of the surface being painted, in that surface's own pixels. */
export interface DeviceRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The artboard background media. It is a DOM sibling below the canvas, so the
 * canvas never contains it and a panel has to be handed it separately.
 *
 * The rect it covers is stated in **artboard units**, not screen pixels: both
 * mounts lay the media layer over exactly the artboard rect, so mapping that
 * with the same plane matrix the sampler already uses for object bounds is
 * exact, survives a `toCanvasElement` capture, and cannot disagree with what
 * the caller happened to measure in CSS.
 */
export interface BackdropMedia {
  /** Artboard size the media layer is laid over. */
  readonly artboard: { readonly width: number; readonly height: number };
  /** Paints the media over `region` of `ctx`, with `device` its rect in `ctx`'s
   *  own pixels. False when the source has decoded no pixels yet. */
  paint(
    ctx: CanvasRenderingContext2D,
    region: DeviceRect,
    device: DeviceRect,
  ): boolean;
}

export interface GlassOptions {
  readonly canvas: StaticCanvas;
  /** Read per render: the media handle is replaced when the artboard changes. */
  readonly backdrop?: () => BackdropMedia | undefined;
  /** Reports a panel that cannot be composited. Deduped per cause, because a
   *  panel that fails the same way on every frame must not flood the host. */
  readonly onGlassError?: (message: string) => void;
}

export interface GlassHandle {
  /** Re-resolves every glass object in the tree. Called automatically when the
   *  canvas gains or loses an object, which is how revival and history undo —
   *  both of which replace object identity — get their listeners back. */
  sync(): void;
  /** Scratch canvases still allocated. Zero after `dispose`. */
  liveSurfaces(): number;
  dispose(): void;
}

/**
 * The ceiling on the **sample region**, per panel, not a scene-wide total. It
 * bounds the scratch surface and the blurred area; it does not bound blur cost,
 * which Task 1 measured as flat across a radius sweep at a fixed size. Task 1
 * measured a 1672x941 artboard peaking near 0.9 Mpx for one panel, and the
 * browser accepted far more, so this is our own ceiling, not a platform one.
 *
 * The radius cap is a different thing and lives in `renderer-core`, in artboard
 * units. Its cost argument was measured in *device* pixels at DPR 1, where the
 * two coincide, so an authored 48 is a 96 px blur at DPR 2 - past the band it
 * was chosen inside. This ceiling does not rescue that: a panel's region grows
 * with its radius by twice the radius on each side, and a 96 px blur is simply
 * more work than a 48 px one.
 */
const MAX_BACKDROP_PIXELS = 4_194_304;

/** Below this a region is a sliver and the blur has nothing to show. */
const MIN_REGION_PX = 2;

/**
 * The surface grain, composited `overlay` rather than laid on as a haze: a flat
 * translucent grey reads as a layer *over* the panel, while an overlay blend
 * scatters light the way etched glass does. Its job is to kill the banding a
 * heavy blur lays over a smooth gradient.
 *
 * **1.5 %, not the 8 % two canvas recipes name.** Measured here: at 8 % the
 * grain raised a blurred band's column-to-column step to 1.4 against a sharp
 * 1.6, which is the noise swamping the blur it sits on — and at 3 % it still
 * cut the blur's own 5.9x drop in fine detail to 1.6x. A surface noise that
 * hides the diffusion is worse than none, because the eye reads noise as
 * "not blurred". The tile is the same; the level comes from the reading.
 *
 * Not a dial. Grain is a property of the material — see
 * `docs/decisions/0013-frost-is-diffusion-grain-saturation-and-an-edge.md`.
 */
const GRAIN_ALPHA = 0.015;

/**
 * How far the glass pushes the backdrop's colour back out.
 *
 * A Gaussian blur is an average, and an average moves towards grey — that is
 * arithmetic, not taste: every channel is pulled towards its neighbours' mean,
 * so a saturated backdrop arrives desaturated. Compounding the blur with
 * `saturate()` is the correction, and the ecosystem calls it the difference
 * between amateur glass and Apple's. 1.6 is the middle of the 140–180 % band
 * those sources converge on.
 *
 * `ctx.filter` is a filter *list*, so this composes with the blur in the one
 * pass rather than costing a second one.
 */
const GLASS_SATURATION = 1.6;

/** Grain reads as grain at any density; the tile is stretched, not regenerated. */
const GRAIN_TILE_PX = 128;

interface Panel {
  readonly object: FabricObject;
  readonly onBeforeRender: (event: {
    readonly ctx: CanvasRenderingContext2D;
  }) => void;
  surface: HTMLCanvasElement | undefined;
  context: CanvasRenderingContext2D | undefined;
}

export function createGlass(options: GlassOptions): GlassHandle {
  const { canvas } = options;
  const panels = new Map<FabricObject, Panel>();
  const reported = new Set<string>();
  // Every ancestor whose caching this handle turned off, so it can hand them
  // back. A set rather than a per-panel list because two panels in one group
  // share that group: whichever leaves first must not restore a cache the other
  // is still sampling through.
  const uncached = new Set<FabricObject>();
  // Groups whose membership this handle is following; see `sync`.
  const watched = new Set<Group>();
  // A browser either has `ctx.filter` or it does not, so this is asked once
  // rather than written and read back for every panel on every frame. Keyed by
  // the context: `toCanvasElement` paints through a different one, and a
  // handle-wide answer would carry the live canvas's verdict into the capture.
  let filterContext: CanvasRenderingContext2D | undefined;
  let filterUsable = false;
  // The grain's `CanvasPattern`, built once per context for the same reason as
  // `filterUsable` above: a pattern is a per-context object, and the capture
  // path does not paint through the live canvas's one. The tile is held
  // alongside it so `dispose` can drop its backing store, which is the release
  // contract the scratch surfaces are held to.
  let grainContext: CanvasRenderingContext2D | undefined;
  let grainPattern: CanvasPattern | null | undefined;
  let grainTileElement: HTMLCanvasElement | undefined;
  let disposed = false;

  /** This context's grain fill, built on first use and then reused. */
  function grainFill(ctx: CanvasRenderingContext2D): CanvasPattern | undefined {
    if (grainContext !== ctx) {
      grainContext = ctx;
      const tile = grainTile();
      grainTileElement = tile;
      grainPattern =
        tile === undefined ? null : ctx.createPattern(tile, "repeat");
    }
    return grainPattern ?? undefined;
  }

  function releaseGrain(): void {
    grainContext = undefined;
    grainPattern = undefined;
    if (grainTileElement !== undefined) {
      grainTileElement.width = 0;
      grainTileElement.height = 0;
      grainTileElement = undefined;
    }
  }

  function report(message: string): void {
    if (reported.has(message)) return;
    reported.add(message);
    options.onGlassError?.(message);
  }

  const release = (panel: Panel): void => {
    panel.object.off("before:render", panel.onBeforeRender);
    // Zeroing the dimensions is what actually releases the backing store;
    // dropping the reference alone leaves it alive until the element is collected.
    if (panel.surface !== undefined) {
      panel.surface.width = 0;
      panel.surface.height = 0;
    }
    panel.surface = undefined;
    panel.context = undefined;
  };

  /** The panel itself and every group above it, nearest first. */
  function chain(object: FabricObject): FabricObject[] {
    const ancestors: FabricObject[] = [];
    for (
      let node: FabricObject | undefined = object;
      node !== undefined;
      node = node.parent
    )
      ancestors.push(node);
    return ancestors;
  }

  /**
   * A cached object paints into its own cache, which has no real backdrop, and
   * a cached group hides its children behind the same empty cache. Idempotent:
   * a second panel in the same group re-reads the chain and finds it already
   * switched off, which is what keeps the shared set in `sync` honest.
   */
  function uncacheChain(object: FabricObject): void {
    for (const ancestor of chain(object)) {
      if (uncached.has(ancestor)) continue;
      if (!ancestor.objectCaching) continue;
      ancestor.objectCaching = false;
      uncached.add(ancestor);
    }
  }

  function attach(object: FabricObject): void {
    if (disposed) return;
    // A panel that is already attached still has its ancestors re-read: a
    // group it has just joined is a new ancestor, and the old one is handed
    // back in `sync` once nothing needs it. Re-attaching the listener would
    // double it, so the panel itself is kept.
    if (panels.has(object)) {
      uncacheChain(object);
      return;
    }
    const treatment = glassTreatment(object);
    if (treatment === undefined) return;
    // Fabric overrides `drawObject` on `Group` and renders its children
    // directly, so a group never fires `before:render` and there is no boundary
    // at which its backdrop could be sampled. Refuse loudly rather than render
    // a panel whose blur silently never appears. Ahead of `uncacheChain`, so a
    // refused group is left exactly as the author set it.
    if (object instanceof Group) {
      report(
        `Glass on "${nameOf(object)}" is a group, which Fabric gives no render boundary; put the treatment on the panel rectangle instead.`,
      );
      return;
    }
    uncacheChain(object);

    const panel: Panel = {
      object,
      surface: undefined,
      context: undefined,
      onBeforeRender: ({ ctx }) => {
        render(panel, ctx);
      },
    };
    panels.set(object, panel);
    object.on("before:render", panel.onBeforeRender);
  }

  function detach(object: FabricObject): void {
    const panel = panels.get(object);
    if (panel === undefined) return;
    panels.delete(object);
    release(panel);
  }

  const sync = (): void => {
    if (disposed) return;
    // The property's presence is the whole test. Which object kinds may carry
    // it is `renderer-core`'s vocabulary, enforced at import, and re-deciding
    // it here would put a second owner on that list.
    const live = new Set<FabricObject>();
    const groups = new Set<Group>();
    for (const object of walk(canvas.getObjects())) {
      if (object instanceof Group) groups.add(object);
      if (glassTreatment(object) !== undefined) live.add(object);
    }
    // A group is a collection too, and its own membership events never reach
    // the canvas. Grouping, ungrouping and a delete inside a group are all
    // invisible without this, and each leaves a panel sampling either a cache
    // it should have switched off or a group it should have released.
    for (const group of watched) {
      if (groups.has(group)) continue;
      group.off("object:added", sync);
      group.off("object:removed", sync);
      watched.delete(group);
    }
    for (const group of groups) {
      if (watched.has(group)) continue;
      group.on("object:added", sync);
      group.on("object:removed", sync);
      watched.add(group);
    }
    for (const object of [...panels.keys()])
      if (!live.has(object)) detach(object);
    for (const object of live) attach(object);
    // `attach` re-reads each panel's ancestors, so a panel that just joined a
    // group is covered; an ancestor no panel needs any more is handed back
    // here, once the last panel that wanted it has gone.
    const stillNeeded = new Set<FabricObject>();
    for (const object of live)
      for (const node of chain(object)) stillNeeded.add(node);
    for (const ancestor of [...uncached]) {
      if (stillNeeded.has(ancestor)) continue;
      ancestor.objectCaching = true;
      uncached.delete(ancestor);
    }
  };

  // `loadFromJSON` clears and re-adds, so revival and history undo land here
  // with new object identities; the old listeners died with the old objects.
  canvas.on("object:added", sync);
  canvas.on("object:removed", sync);

  function render(panel: Panel, ctx: CanvasRenderingContext2D): void {
    try {
      composite(panel, ctx);
    } catch (error) {
      // A panel must never break the frame; report and leave the paint intact.
      report(
        `Backdrop blur on "${nameOf(panel.object)}" failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  function composite(panel: Panel, ctx: CanvasRenderingContext2D): void {
    const { object } = panel;
    // `ctx.canvas` is whatever surface Fabric is painting: the live element, a
    // `toCanvasElement` capture, or an ancestor group's cache. Only the group
    // cache lacks a real backdrop, and sampling it would sample this panel's
    // own already-painted pixels.
    for (
      let ancestor: FabricObject | undefined = object.parent;
      ancestor !== undefined;
      ancestor = ancestor.parent
    ) {
      if (ancestor._cacheContext === ctx) {
        report(
          `An ancestor group of "${nameOf(object)}" caches its children, so its backdrop blur was skipped.`,
        );
        return;
      }
    }
    const target = ctx.canvas;
    if (target === undefined || target === null) return;
    if (filterContext !== ctx) {
      filterContext = ctx;
      filterUsable = probeFilter(ctx);
    }
    if (!filterUsable) {
      report(
        "This browser cannot blur a canvas backdrop; glass renders untinted.",
      );
      return;
    }

    // Read every factor live: `toCanvasElement` swaps the viewport transform and
    // the canvas dimensions for the duration of the capture, and the editor's
    // blur-radius control rewrites the authored property on a panel that is
    // already attached. A radius captured at attach time is the one factor here
    // that can go stale, and it is the one an author can change in place.
    const treatment = glassTreatment(object);
    if (treatment === undefined) return;
    const own = deviceMatrix(object, canvas);
    const plane = planeMatrix(canvas);
    const blurRadius = treatment.blurRadius * Math.hypot(own[0], own[1]);

    const region = sampleRegion(object, plane, blurRadius, target);
    if (region === undefined) return;
    if (region.width * region.height > MAX_BACKDROP_PIXELS) {
      report(
        `The backdrop behind "${nameOf(object)}" is too large to sample and was left untinted.`,
      );
      return;
    }
    const scratch = surfaceFor(panel, region);
    if (scratch === undefined) return;
    const scratchContext = scratch.context;

    // The media is a DOM sibling below the canvas, so the canvas alone misses
    // the wallpaper; it goes down first and the scene composites over it. Its
    // rect is the artboard's, through the same matrix the objects use.
    const media = options.backdrop?.();
    if (media !== undefined) {
      media.paint(scratchContext, region, {
        left: plane[4],
        top: plane[5],
        width: media.artboard.width * plane[0],
        height: media.artboard.height * plane[3],
      });
    }
    scratchContext.drawImage(
      target,
      region.left,
      region.top,
      region.width,
      region.height,
      0,
      0,
      region.width,
      region.height,
    );

    ctx.save();
    try {
      // Fabric has already multiplied this context by every opacity above the
      // panel's own, because a group's opacity belongs to its whole subtree and
      // every other renderer honours it. The backdrop is part of that subtree,
      // so it keeps those factors.
      //
      // The panel's own opacity is the one factor excluded: the backdrop is the
      // scene rather than the panel, and Fabric applies that factor to the
      // panel's fill immediately after this event, so applying it here too
      // would fade the blur twice. It is divided out of the live value rather
      // than recomputed, so the two cannot disagree.
      const panelOpacity = ownOpacity(object);
      if (panelOpacity === undefined) {
        report(
          `"${nameOf(object)}" has an unusable opacity, so its backdrop blur was skipped.`,
        );
        return;
      }
      ctx.globalAlpha = ctx.globalAlpha / panelOpacity;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = "rgba(0, 0, 0, 0)";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.setTransform(own[0], own[1], own[2], own[3], own[4], own[5]);
      if (!localPath(ctx, object)) {
        report(
          `"${nameOf(object)}" has no measurable box, so its backdrop blur was skipped.`,
        );
        return;
      }
      ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // One filter list, one pass: the blur diffuses and the saturation puts
      // back the colour the blur averaged away. A radius of zero gets no
      // filter at all — there is nothing to desaturate, and grading an
      // undiffused backdrop is a look, not a glass.
      ctx.filter =
        blurRadius > 0
          ? `blur(${blurRadius}px) saturate(${GLASS_SATURATION})`
          : "none";
      ctx.drawImage(
        scratch.element,
        region.left,
        region.top,
        region.width,
        region.height,
      );
      // **Texture, over the diffusion and under the panel's own fill.** The
      // clip is still the panel and the transform is still device space, so the
      // fill lands on the card and nowhere else.
      const grain = grainFill(ctx);
      if (grain !== undefined) {
        ctx.save();
        ctx.filter = "none";
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha *= GRAIN_ALPHA;
        // Anchored to the region's corner, not the viewport's, so panning the
        // camera moves the surface with the panel instead of swimming it.
        ctx.translate(region.left, region.top);
        ctx.fillStyle = grain;
        ctx.fillRect(0, 0, region.width, region.height);
        ctx.restore();
      }
    } finally {
      // Carries the transform, clip, filter and the state above back, even if
      // the clip or the draw threw.
      ctx.restore();
    }
  }

  function surfaceFor(
    panel: Panel,
    region: DeviceRect,
  ):
    | { element: HTMLCanvasElement; context: CanvasRenderingContext2D }
    | undefined {
    // Published only once it is usable, so `liveSurfaces()` cannot over-report.
    const element = panel.surface ?? document.createElement("canvas");
    // Resizing clears the surface, so only do it when the region actually moved.
    if (element.width !== region.width) element.width = region.width;
    if (element.height !== region.height) element.height = region.height;
    const context = panel.context ?? element.getContext("2d") ?? undefined;
    if (context === undefined) return undefined;
    panel.surface = element;
    panel.context = context;
    context.clearRect(0, 0, region.width, region.height);
    return { element, context };
  }

  sync();

  return {
    sync,
    liveSurfaces: () => [...panels.values()].filter((p) => p.surface).length,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      releaseGrain();
      canvas.off("object:added", sync);
      canvas.off("object:removed", sync);
      for (const group of watched) {
        group.off("object:added", sync);
        group.off("object:removed", sync);
      }
      watched.clear();
      for (const object of [...panels.keys()]) detach(object);
      for (const ancestor of uncached) ancestor.objectCaching = true;
      uncached.clear();
    },
  };
}

/**
 * The object's own local units to the painted surface, including retina.
 *
 * The two compose in that order — `view · local`, not `local · view`. The
 * products are transposes of each other, and they agree only while the viewport
 * is an unscaled identity, which is what every earlier proof rendered at. Under
 * a 2x `contain` fit a panel's centre lands at (281, 281) and this derivation
 * put it at (140.5, 140.5), so the clip and the blurred backdrop were drawn
 * beside the panel instead of over it; on the player the band's step measured
 * 156 unsoftened against 3 once composed correctly. `planeMatrix` below is the
 * same composition one factor in, and is what `sampleRegion` already measured
 * with — the region and the panel it was copied for disagreed by exactly this.
 */
function deviceMatrix(object: FabricObject, canvas: StaticCanvas): Matrix {
  const local = object.calcTransformMatrix();
  const view = canvas.viewportTransform;
  const retina = canvas.getRetinaScaling();
  return [
    (local[0] * view[0] + local[1] * view[2]) * retina,
    (local[0] * view[1] + local[1] * view[3]) * retina,
    (local[2] * view[0] + local[3] * view[2]) * retina,
    (local[2] * view[1] + local[3] * view[3]) * retina,
    (local[4] * view[0] + local[5] * view[2] + view[4]) * retina,
    (local[4] * view[1] + local[5] * view[3] + view[5]) * retina,
  ];
}

/** The scene plane to the painted surface. Capture scales ride in here. */
function planeMatrix(canvas: StaticCanvas): Matrix {
  const view = canvas.viewportTransform;
  const retina = canvas.getRetinaScaling();
  return [
    view[0] * retina,
    view[1] * retina,
    view[2] * retina,
    view[3] * retina,
    view[4] * retina,
    view[5] * retina,
  ];
}

type Matrix = readonly [number, number, number, number, number, number];

/**
 * The panel's device-space box, padded by twice the blur so the blur has real
 * pixels at its own edges, clamped to the surface and refused when too large.
 * Returns undefined for a region too small to blur.
 */
function sampleRegion(
  object: FabricObject,
  plane: Matrix,
  blurRadius: number,
  target: { readonly width: number; readonly height: number },
): DeviceRect | undefined {
  // `getBoundingRect` memoises, and a moving panel would sample where it used to be.
  object.setCoords();
  const bounds = object.getBoundingRect();
  const corners: readonly (readonly [number, number])[] = [
    [bounds.left, bounds.top],
    [bounds.left + bounds.width, bounds.top],
    [bounds.left + bounds.width, bounds.top + bounds.height],
    [bounds.left, bounds.top + bounds.height],
  ];
  const pad = Math.ceil(blurRadius * 2) + 2;
  const xs = corners.map(([x, y]) => plane[0] * x + plane[2] * y + plane[4]);
  const ys = corners.map(([x, y]) => plane[1] * x + plane[3] * y + plane[5]);
  const left = Math.max(0, Math.floor(Math.min(...xs)) - pad);
  const top = Math.max(0, Math.floor(Math.min(...ys)) - pad);
  const right = Math.min(target.width, Math.ceil(Math.max(...xs)) + pad);
  const bottom = Math.min(target.height, Math.ceil(Math.max(...ys)) + pad);
  // Off-surface, degenerate and hairline panels all land here rather than
  // reaching the sampler with a negative or meaningless extent.
  if (right - left <= MIN_REGION_PX || bottom - top <= MIN_REGION_PX)
    return undefined;
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Rounded-rectangle path in the object's own local units, origin at the centre,
 * matching the box its own paint uses. False when the shape has no measurable
 * box, which a validated scene cannot reach but a hand-edited one could.
 */
function localPath(
  ctx: CanvasRenderingContext2D,
  object: FabricObject,
): boolean {
  const width = number(object, "width");
  const height = number(object, "height");
  if (width === undefined || height === undefined || width <= 0 || height <= 0)
    return false;
  const left = -width / 2;
  const top = -height / 2;
  const rx = radius(object, "rx", width);
  const ry = radius(object, "ry", height);
  if (rx === undefined || ry === undefined) return false;
  ctx.beginPath();
  if (rx === 0 || ry === 0) {
    ctx.rect(left, top, width, height);
    return true;
  }
  ctx.moveTo(left + rx, top);
  ctx.lineTo(left + width - rx, top);
  corner(ctx, left + width - rx, top + ry, rx, ry, -Math.PI / 2);
  ctx.lineTo(left + width, top + height - ry);
  corner(ctx, left + width - rx, top + height - ry, rx, ry, 0);
  ctx.lineTo(left + rx, top + height);
  corner(ctx, left + rx, top + height - ry, rx, ry, Math.PI / 2);
  ctx.lineTo(left, top + ry);
  corner(ctx, left + rx, top + ry, rx, ry, Math.PI);
  ctx.closePath();
  return true;
}

/** A quarter-ellipse corner, clockwise from the straight edge it follows. */
function corner(
  ctx: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  rx: number,
  ry: number,
  from: number,
): void {
  ctx.ellipse(centreX, centreY, rx, ry, 0, from, from + Math.PI / 2, false);
}

function* walk(objects: readonly FabricObject[]): Generator<FabricObject> {
  for (const object of objects) {
    yield object;
    if (object instanceof Group) yield* walk(object.getObjects());
  }
}

/** A revived object carries the persisted id; a plan-built one need not. */
function nameOf(object: FabricObject): string {
  const id = object.get("id");
  return typeof id === "string" && id.length > 0 ? id : object.type;
}

/** Refuse a non-numeric or non-finite dimension rather than coercing it. */
function number(object: FabricObject, key: string): number | undefined {
  const value = (object as unknown as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * The panel's own opacity, which the composite divides out of the context's
 * alpha. Zero is refused as well as non-numeric: Fabric's `isNotVisible()`
 * short-circuits an invisible object before `before:render` fires, so a zero
 * here is a hand-edited scene, and dividing by it would put an infinity into
 * the frame rather than the absence the author asked for.
 */
function ownOpacity(object: FabricObject): number | undefined {
  const value = number(object, "opacity");
  return value !== undefined && value > 0 ? value : undefined;
}

/**
 * A corner radius, clamped to half the side as Fabric clamps its own. Absent
 * means square; present-and-unusable is refused rather than read as square,
 * which would clip to a shape nobody authored.
 */
function radius(
  object: FabricObject,
  key: string,
  side: number,
): number | undefined {
  const value = (object as unknown as Record<string, unknown>)[key];
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return undefined;
  return Math.min(value, side / 2);
}

/** `ctx.filter` was reported absent by Safari; a no-op write means unusable. */
function probeFilter(ctx: CanvasRenderingContext2D): boolean {
  const before = ctx.filter;
  try {
    ctx.filter = "blur(1px)";
    const usable = ctx.filter === "blur(1px)";
    ctx.filter = before;
    return usable;
  } catch {
    return false;
  }
}

/**
 * The surface's grain, written straight into an `ImageData` buffer rather than
 * through the shape pipeline, and from a **fixed seed** so the same panel looks
 * the same in the editor, in the player and in a capture — and so the surface
 * does not crawl between frames, which is what an unseeded tile becomes.
 *
 * Mid-grey is the neutral value for the `overlay` blend this is composited
 * with, so the tile spans the full range around it and the panel neither lifts
 * nor darkens on average.
 */
function grainTile(): HTMLCanvasElement | undefined {
  const tile = document.createElement("canvas");
  tile.width = GRAIN_TILE_PX;
  tile.height = GRAIN_TILE_PX;
  const context = tile.getContext("2d");
  if (context === null) return undefined;
  const image = context.createImageData(GRAIN_TILE_PX, GRAIN_TILE_PX);
  const data = image.data;
  let seed = 0x9e3779b9;
  for (let index = 0; index < data.length; index += 4) {
    // xorshift32: a whole generator, so the tile cannot depend on a host.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const shade = (seed >>> 24) & 0xff;
    data[index] = shade;
    data[index + 1] = shade;
    data[index + 2] = shade;
    data[index + 3] = 0xff;
  }
  context.putImageData(image, 0, 0);
  return tile;
}
