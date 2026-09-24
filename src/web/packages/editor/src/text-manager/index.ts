import { type Canvas, IText } from "fabric/es";

export interface TextManager {
  addText(options?: Readonly<Record<string, unknown>>): IText;
  destroy(): void;
}

/**
 * Enters text editing on a double-click. Fabric's own double-click handler only
 * selects a word *while already editing* — it returns early otherwise — so
 * entering editing is the application's responsibility, not a Fabric default.
 */
export function createTextManager(
  canvas: Canvas,
  save: () => void,
): TextManager {
  const onDoubleClick = (event: { target?: unknown }): void => {
    const target = event.target;

    if (!(target instanceof IText) || target.isEditing) {
      return;
    }

    target.enterEditing();
    canvas.requestRenderAll();
    // One history entry per edit, once the text has settled.
    target.once("editing:exited", save);
  };

  canvas.on("mouse:dblclick" as never, onDoubleClick as never);

  return {
    addText(options = {}) {
      const text = new IText(
        typeof options["text"] === "string" ? options["text"] : "",
        { id: `text-${crypto.randomUUID()}`, ...options },
      );
      canvas.add(text);
      canvas.setActiveObject(text);
      save();
      return text;
    },
    destroy() {
      canvas.off("mouse:dblclick" as never, onDoubleClick as never);
    },
  };
}
