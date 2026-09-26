// Ported: fork 9efdd78a src/editor/text-manager/scaling/text-width-resize-measurer.ts
// (fork coupling stripped — Fabric's own serialization instead of a hand-listed property copy)
import { Point, Textbox, type TextboxProps } from "fabric/es";

import type { ScaleStepProjectionInput } from "./scale-snapping-resolver.js";
import {
  createTextWidthResizeStepProjection,
  type TextWidthResizeGestureProjection,
} from "./text-width-resize-projection.js";

/** The exact geometry of a Textbox at one candidate width. */
export type TextWidthResizeMeasurement = Readonly<{
  projection: ScaleStepProjectionInput;
  width: number;
}>;

/** The source of exact Textbox geometry at a width the live object never took. */
export interface TextWidthResizeMeasurementSource {
  measure({ width }: { width: number }): TextWidthResizeMeasurement;
}

export interface TextWidthResizeMeasurer
  extends TextWidthResizeMeasurementSource {
  dispose(): void;
}

/** Applies a canonical width and leaves the height to Fabric's own re-wrap. */
export function applyTextboxWidth({
  textbox,
  width,
}: {
  textbox: Textbox;
  width: number;
}): number {
  if (!Number.isFinite(width)) {
    throw new Error("A Textbox width must be a finite number");
  }

  // Fabric's own `changeObjectWidth` floor, so a plan's value and the width the
  // object actually takes cannot disagree.
  const nextWidth = Math.max(width, 1);
  textbox.set({ width: nextWidth });
  textbox.dirty = true;

  return textbox.width;
}

/**
 * An off-canvas copy that re-wraps like the live object. Fabric's serialization
 * is the property list, so a new text property cannot silently go unmeasured.
 */
function createMeasurementTextbox({ textbox }: { textbox: Textbox }): Textbox {
  // Fabric's `toObject` and `TextboxProps` disagree on `styles`, so the two are
  // not assignable to each other. The cast crosses that declaration gap only:
  // these really are the constructor's options.
  const { type, version, ...props } = textbox.toObject() as unknown as Record<
    string,
    unknown
  >;
  void type;
  void version;

  return new Textbox(
    String(props["text"] ?? ""),
    props as Partial<TextboxProps>,
  );
}

/**
 * Measures line wrapping outside the live object, so searching for a width that
 * reaches a guide never moves the author's text mid-drag.
 */
export function createTextWidthResizeMeasurer({
  target,
  gesture,
}: {
  target: Textbox;
  gesture: TextWidthResizeGestureProjection;
}): TextWidthResizeMeasurer {
  const textbox = createMeasurementTextbox({ textbox: target });
  const { anchorOriginX, anchorOriginY, fixedAnchor } = gesture;

  return {
    measure: ({ width }) => {
      const appliedWidth = applyTextboxWidth({ textbox, width });
      textbox.setPositionByOrigin(
        new Point(fixedAnchor.x, fixedAnchor.y),
        anchorOriginX,
        anchorOriginY,
      );
      textbox.setCoords();

      const projection = createTextWidthResizeStepProjection({
        textbox,
        gesture,
      });
      if (!projection) {
        throw new Error(
          "A Textbox width could not be measured after line wrapping",
        );
      }

      return Object.freeze({ projection, width: appliedWidth });
    },
    dispose: () => {
      textbox.dispose();
    },
  };
}
