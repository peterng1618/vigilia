import { IText, type Canvas } from "fabric/es";

type History = Readonly<{ save(): void }>;

/** Native authored-object actions used by Vigilia product panels. */
export class EditorActions {
  readonly #canvas: Pick<Canvas, "add" | "setActiveObject" | "requestRenderAll">;
  readonly #history: History;

  constructor(options: {
    readonly canvas: Pick<Canvas, "add" | "setActiveObject" | "requestRenderAll">;
    readonly history: History;
  }) {
    this.#canvas = options.canvas;
    this.#history = options.history;
  }

  addText(options: ConstructorParameters<typeof IText>[1] & { readonly text: string }): IText {
    const text = new IText(options.text, options);
    this.#canvas.add(text);
    this.#canvas.setActiveObject(text);
    this.#canvas.requestRenderAll();
    this.#history.save();
    return text;
  }
}
