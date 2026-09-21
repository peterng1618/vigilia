import type { StaticCanvas } from "fabric/es";
import type { SerialisedScene } from "@vigilia/scene-fabric";

type HistoryCanvas = Pick<StaticCanvas, "fire">;

/** Owns authored Fabric-scene undo state; selection and runtime data stay outside it. */
export class EditorHistory {
  readonly #canvas: HistoryCanvas;
  readonly #serialize: (canvas: HistoryCanvas) => SerialisedScene;
  readonly #revive: (
    canvas: HistoryCanvas,
    scene: SerialisedScene,
  ) => Promise<void>;
  #entries: SerialisedScene[] = [];
  #index = -1;
  #suspended = 0;

  constructor(options: {
    readonly canvas: HistoryCanvas;
    readonly serialize: (canvas: HistoryCanvas) => SerialisedScene;
    readonly revive: (canvas: HistoryCanvas, scene: SerialisedScene) => Promise<void>;
  }) {
    this.#canvas = options.canvas;
    this.#serialize = options.serialize;
    this.#revive = options.revive;
  }

  get canRedo(): boolean {
    return this.#index + 1 < this.#entries.length;
  }

  reset(): void {
    this.#entries = [this.#serialize(this.#canvas)];
    this.#index = 0;
  }

  save(): void {
    if (this.#suspended > 0) return;
    const scene = this.#serialize(this.#canvas);
    if (sameScene(scene, this.#entries[this.#index])) return;
    this.#entries.splice(this.#index + 1);
    this.#entries.push(scene);
    this.#index += 1;
  }

  async undo(): Promise<void> {
    if (this.#index > 0) await this.#restore(this.#index - 1);
  }

  async redo(): Promise<void> {
    if (this.canRedo) await this.#restore(this.#index + 1);
  }

  async #restore(index: number): Promise<void> {
    const scene = this.#entries[index];
    if (scene === undefined) return;
    this.#suspended += 1;
    try {
      await this.#revive(this.#canvas, scene);
      this.#index = index;
      this.#canvas.fire("editor:history-state-loaded" as never);
    } finally {
      this.#suspended -= 1;
    }
  }
}

function sameScene(left: SerialisedScene, right: SerialisedScene | undefined): boolean {
  return right !== undefined && JSON.stringify(left) === JSON.stringify(right);
}
