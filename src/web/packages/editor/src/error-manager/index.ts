import type { Canvas } from "fabric/es";

/** Named for Vigilia's own managers, not the retired fork's subsystems. */
export type EditorErrorCategory =
  | "clipboard"
  | "deletion"
  | "grouping"
  | "controls"
  | "toolbar"
  | "snapping"
  | "crop"
  | "image";

export interface EditorDiagnostic {
  readonly category: EditorErrorCategory;
  readonly message: string;
  readonly cause?: unknown;
}

export interface ErrorManager {
  error(category: EditorErrorCategory, message: string, cause?: unknown): void;
  warn(category: EditorErrorCategory, message: string, cause?: unknown): void;
}

/** Fabric's typed event map does not declare Vigilia's own event names. */
function emit(
  canvas: Canvas,
  event: "editor:error" | "editor:warning",
  diagnostic: EditorDiagnostic,
): void {
  canvas.fire(event as never, diagnostic as never);
}

export function createErrorManager(canvas: Canvas): ErrorManager {
  const build = (
    category: EditorErrorCategory,
    message: string,
    cause: unknown,
  ): EditorDiagnostic => ({
    category,
    message,
    ...(cause === undefined ? {} : { cause }),
  });

  return {
    error(category, message, cause) {
      console.error(`[vigilia:${category}] ${message}`, cause);
      emit(canvas, "editor:error", build(category, message, cause));
    },
    warn(category, message, cause) {
      console.warn(`[vigilia:${category}] ${message}`, cause);
      emit(canvas, "editor:warning", build(category, message, cause));
    },
  };
}
