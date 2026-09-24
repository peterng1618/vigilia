import type { Canvas, FabricObject } from "fabric/es";
import type { ErrorManager } from "../error-manager/index.js";
import { getObjectExactBounds, type ObjectBounds } from "./bounds.js";
import {
  collectExcludedObjects,
  shouldIgnoreObject,
} from "./excluded-objects.js";
import { renderSnappingGuides } from "./guide-renderer.js";
import {
  createMovementSnapEnvironment,
  type MovementSnapCandidateSource,
} from "./movement-snap-candidates.js";
import {
  createMovementGestureBaseline,
  createMovementGuideLines,
  type FinalMovementGeometry,
} from "./movement-snapping-resolver.js";
import { MovementSnappingRuntime } from "./movement-snapping-runtime.js";
import type { GuideLine } from "./types.js";

export interface SnapManager {
  destroy(): void;
}

export interface SnapManagerOptions {
  readonly canvas: Canvas;
  /** Artboard extent; replaces the fork's montage area. */
  readonly bounds: () => ObjectBounds;
  readonly errors: ErrorManager;
}

/** Any movable object snaps; Vigilia has no composite type to allow-list. */
function isSnapTarget(
  object: FabricObject,
  excluded: Set<FabricObject>,
): boolean {
  return (
    object.selectable === true &&
    object.get("locked") !== true &&
    !shouldIgnoreObject({ object, excluded })
  );
}

/** Builds one candidate source from an eligible neighbour object. */
function toSnapSource(
  object: FabricObject,
  index: number,
  excluded: Set<FabricObject>,
): MovementSnapCandidateSource | undefined {
  if (!isSnapTarget(object, excluded)) return undefined;
  if (excluded.has(object)) return undefined;
  const bounds = getObjectExactBounds({ object });
  if (bounds === null) return undefined;
  return {
    id: object.get("id") ?? `snap-source-${index}`,
    bounds,
    useForSpacing: true,
  };
}

/**
 * Picks the browser event as the step marker, exactly as the fork does. Fabric
 * reuses one marker per native pointer event, so the runtime can tell a repeat
 * of the same event (a target and its selection both moving) from a new step.
 */
function readMovementMarker({
  event,
}: {
  event: { readonly e?: unknown } | undefined;
}): object {
  const browserEvent = event?.e;
  if (
    (typeof browserEvent === "object" && browserEvent !== null) ||
    typeof browserEvent === "function"
  ) {
    return browserEvent;
  }
  return event ?? {};
}

/** Ctrl is the documented escape hatch: the unrounded, unsnapped drag. */
function readMovementModifiers({
  event,
}: {
  event: { readonly e?: unknown } | undefined;
}): { readonly ctrlKey: boolean } {
  const browserEvent = event?.e;
  const ctrlKey =
    typeof browserEvent === "object" && browserEvent !== null
      ? (browserEvent as { ctrlKey?: unknown }).ctrlKey
      : undefined;
  return { ctrlKey: ctrlKey === true };
}

export function createSnapManager(options: SnapManagerOptions): SnapManager {
  const { canvas, bounds, errors } = options;
  const runtime = new MovementSnappingRuntime();

  let target: FabricObject | undefined;
  /** The dragged object's exact start bounds, cached at gesture start. */
  let targetStartBounds: ObjectBounds | undefined;
  /** Guides from the last verified step, painted on after:render. */
  let lastGuides: readonly GuideLine[] = [];
  let lastSpacingGuides: readonly unknown[] = [];
  let gestureActive = false;
  /** The drag that owns the gesture; a second object's move must not join it. */
  let gestureTarget: FabricObject | undefined;

  const stopGesture = (): void => {
    if (gestureActive) runtime.finishSession();
    gestureActive = false;
    target = undefined;
    targetStartBounds = undefined;
    gestureTarget = undefined;
    lastGuides = [];
    lastSpacingGuides = [];
    canvas.requestRenderAll();
  };

  const startGesture = (): void => {
    const active = canvas.getActiveObject();
    if (active === undefined) return;
    const startBounds = getObjectExactBounds({ object: active });
    if (startBounds === null) return;

    const excluded = collectExcludedObjects({ activeObject: active });
    const sources: MovementSnapCandidateSource[] = [];
    canvas.forEachObject((object, index) => {
      const source = toSnapSource(object, index, excluded);
      if (source !== undefined) sources.push(source);
    });
    // The artboard extent participates as a domain-boundary snap line set.
    const artboard = bounds();
    sources.push({
      id: "artboard",
      bounds: {
        ...artboard,
        centerX: artboard.left + (artboard.right - artboard.left) / 2,
        centerY: artboard.top + (artboard.bottom - artboard.top) / 2,
      },
      edgeCategory: "domain-boundary",
      useForSpacing: false,
    });

    runtime.startSession({
      baseline: createMovementGestureBaseline({
        bounds: startBounds,
        // Fabric's own left/top; the raw intent's position uses the same keys.
        position: {
          left: active.get("left") ?? startBounds.left,
          top: active.get("top") ?? startBounds.top,
        },
        environment: createMovementSnapEnvironment({
          sources,
          zoom: canvas.getZoom() || 1,
        }),
      }),
    });
    target = active;
    targetStartBounds = startBounds;
    gestureTarget = active;
    gestureActive = true;
  };

  const runStep = (event: { readonly e?: unknown } | undefined): void => {
    const moved = target;
    const startBounds = targetStartBounds;
    if (
      !gestureActive ||
      moved === undefined ||
      startBounds === undefined ||
      moved !== gestureTarget
    )
      return;

    // One marker per native pointer event, as in the fork: Fabric delivers
    // several object:moving events for one pointer move (target plus any
    // active selection), and the runtime's duplicate detection is keyed on
    // marker identity. The browser event is a fresh object per pointermove,
    // so each real movement step re-plans; a repeat of the same event is
    // recognised as a duplicate instead of being re-applied.
    const marker = readMovementMarker({ event });

    const rawBounds = getObjectExactBounds({ object: moved });
    if (rawBounds === null) return;
    // Fabric has already applied the drag to the object; the raw intent is the
    // gesture-start geometry translated by the drag's current offset.
    const offsetLeft = rawBounds.left - startBounds.left;
    const offsetTop = rawBounds.top - startBounds.top;

    const step = runtime.resolveMovementPlan({
      marker,
      intent: {
        bounds: {
          ...startBounds,
          left: startBounds.left + offsetLeft,
          right: startBounds.right + offsetLeft,
          centerX: startBounds.centerX + offsetLeft,
          top: startBounds.top + offsetTop,
          bottom: startBounds.bottom + offsetTop,
          centerY: startBounds.centerY + offsetTop,
        },
        position: {
          left: moved.get("left") ?? startBounds.left,
          top: moved.get("top") ?? startBounds.top,
        },
        axes: {
          x: moved.lockMovementX !== true,
          y: moved.lockMovementY !== true,
        },
        modifiers: readMovementModifiers({ event }),
      },
    });
    if (step.kind !== "planned") return;

    const { plan } = step;
    const currentLeft = moved.get("left");
    const currentTop = moved.get("top");
    const deltaX = plan.nextPosition.left - currentLeft;
    const deltaY = plan.nextPosition.top - currentTop;

    // A zero-delta plan is still a plan: the object already sits at
    // nextPosition, so the current bounds are the final geometry and the
    // pending token must be verified — leaving it pending would wedge every
    // later step of the gesture.
    if (deltaX !== 0 || deltaY !== 0) {
      moved.set({ left: plan.nextPosition.left, top: plan.nextPosition.top });
      moved.setCoords();
    }
    const finalBounds =
      deltaX === 0 && deltaY === 0
        ? rawBounds
        : getObjectExactBounds({ object: moved });
    if (finalBounds !== null) {
      const verification = runtime.verifyMovementPlan({
        token: step.token,
        finalGeometry: {
          bounds: finalBounds,
          position: {
            left: plan.nextPosition.left,
            top: plan.nextPosition.top,
          },
        } satisfies FinalMovementGeometry,
      });
      lastGuides = createMovementGuideLines({ guides: verification.guides });
      lastSpacingGuides = verification.spacingGuides;
    }
    if (deltaX !== 0 || deltaY !== 0) canvas.requestRenderAll();
  };

  const beforeRender = (): void => {
    const context = canvas.contextTop;
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const afterRender = (): void => {
    if (lastGuides.length === 0 && lastSpacingGuides.length === 0) return;
    renderSnappingGuides({
      canvas,
      guideBounds: bounds(),
      guides: lastGuides,
      spacingGuides: lastSpacingGuides as never,
    });
  };

  const bindings = [
    ["mouse:down", startGesture],
    ["object:moving", runStep],
    ["mouse:up", stopGesture],
    ["selection:created", stopGesture],
    ["selection:updated", stopGesture],
    ["selection:cleared", stopGesture],
    ["object:removed", stopGesture],
    ["before:render", beforeRender],
    ["after:render", afterRender],
  ] as const;

  const guard = (step: (event?: never) => void): ((event?: never) => void) => {
    return (event?: never) => {
      try {
        step(event);
      } catch (error) {
        errors.error("snapping", "A snapping step failed.", error);
      }
    };
  };

  const windowCancel = (): void => {
    try {
      stopGesture();
    } catch (error) {
      errors.error("snapping", "Cancelling a snapping gesture failed.", error);
    }
  };

  // A throw inside object:moving would otherwise leave a drag wedged.
  // One guarded handler per binding so off() removes the bound function.
  const guarded = bindings.map(([event, step]) => {
    const handler = guard(step);
    return [event, handler] as const;
  });

  for (const [event, handler] of guarded)
    canvas.on(event as never, handler as never);
  window.addEventListener("pointercancel", windowCancel);
  window.addEventListener("touchcancel", windowCancel);
  window.addEventListener("blur", windowCancel);

  return {
    destroy(): void {
      for (const [event, handler] of guarded)
        canvas.off(event as never, handler as never);
      window.removeEventListener("pointercancel", windowCancel);
      window.removeEventListener("touchcancel", windowCancel);
      window.removeEventListener("blur", windowCancel);
      if (gestureActive) stopGesture();
    },
  };
}
