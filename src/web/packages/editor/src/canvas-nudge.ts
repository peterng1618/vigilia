import {
  ActiveSelection,
  type Canvas,
  type FabricObject,
  Point,
} from "fabric/es";

const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;
/** A burst of nudges closes this long after the last press. */
export const NUDGE_IDLE_MS = 300;

export const stepFor = (event: KeyboardEvent): number =>
  event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;

interface NudgeObject extends FabricObject {
  readonly locked?: boolean;
}

export interface CanvasNudgeOptions {
  readonly canvas: Canvas;
  /** Only the two history calls a burst needs, so a test can pass a double. */
  readonly history: {
    suspend(): () => void;
    saveState(): void;
  };
}

export interface CanvasNudge {
  nudgeBy(dx: number, dy: number): void;
  /** Ends an open burst early, rather than at the idle window. */
  endBurst(): void;
  /** Clears the pending idle timer and releases an open burst, without
   * recording: the session is going away, so there is nothing left to undo. */
  dispose(): void;
}

/** Moves the selection by whole steps, coalescing a burst into one history entry. */
export function createCanvasNudge(options: CanvasNudgeOptions): CanvasNudge {
  const { canvas, history } = options;

  const nudge = (dx: number, dy: number): void => {
    const active = canvas.getActiveObject();
    if (active === undefined) return;
    const targets = (
      active instanceof ActiveSelection ? active.getObjects() : [active]
    ).filter((object) => (object as NudgeObject).locked !== true);
    if (targets.length === 0) return;
    for (const object of targets) {
      // Read and write must name the same origin: `getCenterPoint` is the
      // origin point under `originX/originY`, not the bounding-box centre.
      const centre = object.getCenterPoint();
      object.setPositionByOrigin(
        new Point(centre.x + dx, centre.y + dy),
        "center",
        "center",
      );
      object.setCoords();
    }
    canvas.requestRenderAll();
  };

  let release: (() => void) | undefined;
  let idle: number | undefined;

  /** The burst ends on the idle window or on any other action. Resuming before
   * saving is what makes the entry exist at all: `save()` is a no-op while the
   * suspension counter is non-zero. */
  const endBurst = (): void => {
    if (idle !== undefined) clearTimeout(idle);
    idle = undefined;
    if (release === undefined) return;
    release();
    release = undefined;
    history.saveState();
  };

  return {
    nudgeBy: (dx, dy) => {
      const active = canvas.getActiveObject();
      // Before suspending: suspending with no selection would open a burst that
      // never records anything, swallowing the next unrelated `saveState`.
      if (active === undefined) return;
      if (release === undefined) release = history.suspend();
      if (idle !== undefined) clearTimeout(idle);
      idle = window.setTimeout(endBurst, NUDGE_IDLE_MS);
      nudge(dx, dy);
      // Fired per press and deliberately NOT the thing that records history: it
      // has three other listeners that need it (`chart-manager`,
      // `indicator-manager`, `selection-inspector`), and `save` is a no-op for
      // the whole burst because the suspension counter is still non-zero.
      // `endBurst` is what records the entry. Do not "simplify" this call away,
      // and do not delete the explicit `saveState` inside `endBurst`.
      canvas.fire("object:modified", { target: active });
    },
    endBurst,
    dispose: () => {
      if (idle !== undefined) clearTimeout(idle);
      idle = undefined;
      release?.();
      release = undefined;
    },
  };
}
