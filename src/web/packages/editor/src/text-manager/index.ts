import { type Canvas, IText } from "fabric/es";

export interface TextManager {
  addText(options?: Readonly<Record<string, unknown>>): IText;
}

export function createTextManager(
  canvas: Canvas,
  save: () => void,
): TextManager {
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
  };
}
