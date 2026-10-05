import type { SerialisedScene } from "@vigilia/scene-fabric";
import { ActiveSelection, type Canvas, type FabricObject } from "fabric/es";

type HistoryCanvas = Canvas;

/** Owns authored Fabric-scene undo state. The selection is not undo state, but
 *  a revive replaces every object the selection held, so carrying it across is
 *  part of undoing rather than something this hands back to its caller. */
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
  #restoring: Promise<void> = Promise.resolve();

  constructor(options: {
    readonly canvas: HistoryCanvas;
    readonly serialize: (canvas: HistoryCanvas) => SerialisedScene;
    readonly revive: (
      canvas: HistoryCanvas,
      scene: SerialisedScene,
    ) => Promise<void>;
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

  /** Interactive sessions mutate the canvas before the user commits. */
  suspend(): () => void {
    this.#suspended += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#suspended -= 1;
    };
  }

  save(): void {
    if (this.#suspended > 0) return;
    const scene = this.#serialize(this.#canvas);
    if (sameScene(scene, this.#entries[this.#index])) return;
    this.#entries.splice(this.#index + 1);
    this.#entries.push(scene);
    this.#index += 1;
    // A recorded entry is the one signal that an edit landed, so it is where a
    // reason the author was given goes stale. A refused edit records nothing
    // and so never reaches here: the refusal survives the field that raised it.
    this.#canvas.fire("editor:edit-committed" as never);
  }

  undo(): Promise<void> {
    return this.#queued(async () => {
      if (this.#index > 0) await this.#restore(this.#index - 1);
    });
  }

  redo(): Promise<void> {
    return this.#queued(async () => {
      if (this.canRedo) await this.#restore(this.#index + 1);
    });
  }

  /** One restore at a time. A restore is asynchronous, so two presses that both
   *  read the index before either finishes land on the same entry: two presses
   *  undo one edit, and an author who presses again after seeing nothing happen
   *  walks the history backwards in steps of one that are really steps of two. */
  #queued(restore: () => Promise<void>): Promise<void> {
    const next = this.#restoring.then(restore, restore);
    this.#restoring = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async #restore(index: number): Promise<void> {
    const scene = this.#entries[index];
    if (scene === undefined) return;
    const selected = selectedIds(this.#canvas);
    this.#suspended += 1;
    try {
      await this.#revive(this.#canvas, scene);
      reselect(this.#canvas, selected);
      this.#index = index;
      this.#canvas.fire("editor:history-state-loaded" as never);
    } finally {
      this.#suspended -= 1;
    }
  }
}

/** What the author had selected, by id — a revive replaces every object, so the
 *  instances Fabric is holding are the ones that go. */
function selectedIds(canvas: HistoryCanvas): readonly string[] {
  const active = canvas.getActiveObject();
  if (active === undefined) return [];
  const objects =
    active instanceof ActiveSelection ? active.getObjects() : [active];
  return objects
    .map((object) => object.get("id"))
    .filter((id): id is string => typeof id === "string");
}

/** Whatever survived the revive, in the order the author had it. Nothing found
 *  selects nothing: the undo removed what was selected, or what was selected was
 *  never an authored object. A group child is only ever selected on its own —
 *  a multi-selection is a box the canvas owns, and it cannot own a child's. */
function reselect(canvas: HistoryCanvas, ids: readonly string[]): void {
  if (ids.length === 0) return;
  const byId = new Map<string, FabricObject>();
  const walk = (objects: readonly FabricObject[]): void => {
    for (const object of objects) {
      const id = object.get("id");
      if (typeof id === "string") byId.set(id, object);
      const children = (
        object as FabricObject & {
          getObjects?: () => FabricObject[];
        }
      ).getObjects;
      if (typeof children === "function") walk(children.call(object));
    }
  };
  const topLevel = canvas.getObjects();
  walk(topLevel);
  const onCanvas = new Set(topLevel);
  const found = ids
    .map((id) => byId.get(id))
    .filter((object): object is FabricObject => object !== undefined);
  const only = found.length === 1 ? found[0] : undefined;
  if (only !== undefined) {
    canvas.setActiveObject(only);
    return;
  }
  const many = found.filter((object) => onCanvas.has(object));
  if (many.length > 0)
    canvas.setActiveObject(new ActiveSelection(many, { canvas }));
}

function sameScene(
  left: SerialisedScene,
  right: SerialisedScene | undefined,
): boolean {
  return right !== undefined && JSON.stringify(left) === JSON.stringify(right);
}
