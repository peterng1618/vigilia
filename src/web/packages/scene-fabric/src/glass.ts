import { glassTreatment } from "@vigilia/renderer-core";
import { Group, type FabricObject, type StaticCanvas } from "fabric/es";

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
 * Bounded by the surface being painted, so a large panel cannot force a large
 * allocation. Measured by Task 1 as cheap well past this: a 1672x941 artboard
 * peaks around 0.9 Mpx.
 */
/**
 * Per panel, not a scene-wide total. Task 1 measured a 1672x941 artboard
 * peaking near 0.9 Mpx for one panel, and the browser accepted far more, so
 * this is our own ceiling rather than a platform one.
 *
 * The *radius* cap lives in `renderer-core` and is in artboard units; the cost
 * argument behind it was measured in device pixels at DPR 1, where the two
 * coincide. An authored 48 is therefore a 96 px blur at DPR 2, past the band it
 * was chosen inside - still a fraction of a frame, and this ceiling rather than
 * the radius is what bounds the work.
 */
const MAX_BACKDROP_PIXELS = 4_194_304;

/** Below this a region is a sliver and the blur has nothing to show. */
const MIN_REGION_PX = 2;

interface Panel {
  readonly object: FabricObject;
  readonly blurRadius: number;
  /** Ancestors whose caching was turned off, so detach can put it back. */
  readonly disabled: readonly FabricObject[];
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
  // A browser either has `ctx.filter` or it does not, so this is asked once
  // rather than written and read back for every panel on every frame.
  let filterUsable: boolean | undefined;
  let disposed = false;

  function report(message: string): void {
    if (reported.has(message)) return;
    reported.add(message);
    options.onGlassError?.(message);
  }

  const release = (panel: Panel): void => {
    panel.object.off("before:render", panel.onBeforeRender);
    for (const ancestor of panel.disabled) ancestor.objectCaching = true;
    // Zeroing the dimensions is what actually releases the backing store;
    // dropping the reference alone leaves it alive until the element is collected.
    if (panel.surface !== undefined) {
      panel.surface.width = 0;
      panel.surface.height = 0;
    }
    panel.surface = undefined;
    panel.context = undefined;
  };

  function attach(object: FabricObject): void {
    if (disposed || panels.has(object)) return;
    const treatment = glassTreatment(object);
    if (treatment === undefined) return;
    // Fabric overrides `drawObject` on `Group` and renders its children
    // directly, so a group never fires `before:render` and there is no boundary
    // at which its backdrop could be sampled. Refuse loudly rather than render
    // a panel whose blur silently never appears.
    if (object instanceof Group) {
      report(
        `Glass on "${nameOf(object)}" is a group, which Fabric gives no render boundary; put the treatment on the panel rectangle instead.`,
      );
      return;
    }
    if (!Number.isFinite(treatment.blurRadius) || treatment.blurRadius < 0) {
      report(
        `Glass on "${nameOf(object)}" has an unusable blur radius and was not rendered.`,
      );
      return;
    }

    // A cached object paints into its own cache, which has no real backdrop, and
    // a cached group hides its children behind the same empty cache.
    const disabled: FabricObject[] = [];
    for (
      let ancestor: FabricObject | undefined = object;
      ancestor !== undefined;
      ancestor = ancestor.parent
    ) {
      if (!ancestor.objectCaching) continue;
      ancestor.objectCaching = false;
      disabled.push(ancestor);
    }

    const panel: Panel = {
      object,
      blurRadius: treatment.blurRadius,
      disabled,
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
    for (const object of walk(canvas.getObjects()))
      if (glassTreatment(object) !== undefined) live.add(object);
    for (const object of [...panels.keys()])
      if (!live.has(object)) detach(object);
    for (const object of live) attach(object);
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
    filterUsable ??= probeFilter(ctx);
    if (!filterUsable) {
      report(
        "This browser cannot blur a canvas backdrop; glass renders untinted.",
      );
      return;
    }

    // Read every factor live: `toCanvasElement` swaps the viewport transform and
    // the canvas dimensions for the duration of the capture.
    const own = deviceMatrix(object, canvas);
    const plane = planeMatrix(canvas);
    const blurRadius = panel.blurRadius * Math.hypot(own[0], own[1]);

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
      // Fabric applies the panel's own opacity, shadow and composite before
      // this event. The backdrop is the scene, not the panel: the panel's fill
      // is composited over it by Fabric afterwards, at the panel's own alpha.
      ctx.globalAlpha = 1;
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
      ctx.filter = blurRadius > 0 ? `blur(${blurRadius}px)` : "none";
      ctx.drawImage(
        scratch.element,
        region.left,
        region.top,
        region.width,
        region.height,
      );
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
      canvas.off("object:added", sync);
      canvas.off("object:removed", sync);
      for (const object of [...panels.keys()]) detach(object);
    },
  };
}

/** The object's own local units to the painted surface, including retina. */
function deviceMatrix(object: FabricObject, canvas: StaticCanvas): Matrix {
  const local = object.calcTransformMatrix();
  const view = canvas.viewportTransform;
  const retina = canvas.getRetinaScaling();
  return [
    (local[0] * view[0] + local[2] * view[1]) * retina,
    (local[1] * view[0] + local[3] * view[1]) * retina,
    (local[0] * view[2] + local[2] * view[3]) * retina,
    (local[1] * view[2] + local[3] * view[3]) * retina,
    (local[0] * view[4] + local[2] * view[5] + local[4]) * retina,
    (local[1] * view[4] + local[3] * view[5] + local[5]) * retina,
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
