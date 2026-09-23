import type { Canvas, FabricObject } from "fabric/es";
import { createCursorIndicator } from "./cursor-indicator.js";

const SIZE_FORMAT_EPSILON = 0.000001;

/** Minus is kept for negatives; no plus is prepended for positives. */
export function formatAngle(angle: number): string {
  let normalised = angle % 360;
  if (normalised > 180) normalised -= 360;
  if (normalised < -180) normalised += 360;
  return `${Math.round(normalised)}°`;
}

/** The epsilon forces a .5 boundary up despite floating-point error. */
function formatDimension(value: number): string {
  return Math.round(Math.abs(value) + SIZE_FORMAT_EPSILON)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatSize(size: {
  readonly width: number;
  readonly height: number;
}): string | undefined {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
    return undefined;
  }
  return `${formatDimension(size.width)} × ${formatDimension(size.height)}`;
}

export interface IndicatorManager {
  destroy(): void;
}

export interface IndicatorManagerOptions {
  readonly canvas: Canvas;
  readonly showRotationAngle?: boolean;
  readonly showObjectSizeOnScale?: boolean;
}

/** A transform event carries the dragged object and the pointer event. */
type TransformEvent = {
  readonly transform: { readonly target?: FabricObject };
  readonly e: MouseEvent | TouchEvent;
};

export function createIndicatorManager(
  options: IndicatorManagerOptions,
): IndicatorManager {
  const { canvas } = options;
  const showRotationAngle = options.showRotationAngle ?? true;
  const showObjectSizeOnScale = options.showObjectSizeOnScale ?? true;
  // A wrapper Fabric created but never attached would hide the tooltip from
  // document queries; fall back to the body when the wrapper is detached.
  const parent =
    canvas.wrapperEl?.isConnected === true ? canvas.wrapperEl : document.body;

  const angle = createCursorIndicator({
    className: "vigilia-angle-indicator",
    parent,
  });
  const size = createCursorIndicator({
    className: "vigilia-size-indicator",
    parent,
  });

  const hideAngle = (): void => angle.hide();
  const hideSize = (): void => size.hide();

  const onRotating = (event: TransformEvent): void => {
    const target = event.transform.target;
    if (
      !showRotationAngle ||
      target === undefined ||
      target.lockRotation === true ||
      target.lockMovementX === true ||
      target.lockMovementY === true
    ) {
      hideAngle();
      return;
    }
    angle.showAtPointer({
      text: formatAngle(target.angle ?? 0),
      event: event.e,
    });
  };

  const onScaling = (event: TransformEvent): void => {
    const target = event.transform.target;
    if (
      !showObjectSizeOnScale ||
      target === undefined ||
      target.get("locked") === true ||
      (target.lockScalingX === true && target.lockScalingY === true)
    ) {
      hideSize();
      return;
    }
    const sizeLabel = formatSize({
      width: target.getScaledWidth(),
      height: target.getScaledHeight(),
    });
    if (sizeLabel === undefined) {
      hideSize();
      return;
    }
    size.showAtPointer({ text: sizeLabel, event: event.e });
  };

  const angleBindings = [
    ["object:rotating", onRotating],
    ["mouse:up", hideAngle],
    ["object:modified", hideAngle],
    ["selection:cleared", hideAngle],
  ] as const;

  const sizeBindings = [
    ["object:scaling", onScaling],
    ["object:resizing", onScaling],
    ["mouse:up", hideSize],
    ["object:modified", hideSize],
    ["selection:cleared", hideSize],
  ] as const;

  for (const [event, handler] of angleBindings)
    canvas.on(event as never, handler as never);
  for (const [event, handler] of sizeBindings)
    canvas.on(event as never, handler as never);

  return {
    destroy(): void {
      for (const [event, handler] of angleBindings)
        canvas.off(event as never, handler as never);
      for (const [event, handler] of sizeBindings)
        canvas.off(event as never, handler as never);
      angle.destroy();
      size.destroy();
    },
  };
}
