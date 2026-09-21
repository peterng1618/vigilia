import { Canvas } from "fabric/es";
import {
  validateFabricThemeEnvelope,
  type Artboard,
  type FabricThemeEnvelope,
  type FitMode,
} from "@vigilia/renderer-core";
import { reviveThemeEnvelope } from "@vigilia/scene-fabric";

export interface EditorCanvasOptions {
  readonly host: HTMLElement;
  readonly artboard: Artboard;
  readonly envelope?: FabricThemeEnvelope;
}

export interface EditorCanvas {
  readonly canvas: Canvas;
  destroy(): void;
}

/** Mounts the editor's interactive Fabric canvas without an external editor runtime. */
export async function mountEditorCanvas({
  host,
  artboard,
  envelope,
}: EditorCanvasOptions): Promise<EditorCanvas> {
  if (envelope !== undefined) {
    const validation = validateFabricThemeEnvelope(envelope);
    if (!validation.ok) {
      throw new Error(
        `Invalid Fabric theme: ${validation.issues[0]?.message ?? "unknown validation error"}`,
      );
    }
  }

  const element = document.createElement("canvas");
  host.replaceChildren(element);
  const canvas = new Canvas(element, {
    width: artboard.width,
    height: artboard.height,
    selection: true,
  });
  const fitMode: FitMode = artboard.fitMode ?? "contain";
  fit(canvas, host, artboard, fitMode);
  try {
    if (envelope !== undefined) await reviveThemeEnvelope(canvas, envelope);
    return { canvas, destroy: () => canvas.dispose() };
  } catch (error) {
    canvas.dispose();
    element.remove();
    throw error;
  }
}

function fit(canvas: Canvas, host: HTMLElement, artboard: Artboard, fitMode: FitMode): void {
  const scale =
    fitMode === "contain"
      ? Math.min(host.clientWidth / artboard.width, host.clientHeight / artboard.height)
      : Math.max(host.clientWidth / artboard.width, host.clientHeight / artboard.height);
  if (!Number.isFinite(scale) || scale <= 0) return;
  canvas.setDimensions({ width: artboard.width * scale, height: artboard.height * scale });
  canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
}
