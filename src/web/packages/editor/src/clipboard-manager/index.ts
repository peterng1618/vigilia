import { SCENE_PERSISTED_PROPERTIES } from "@vigilia/scene-fabric";
import {
  ActiveSelection,
  type Canvas,
  type FabricObject,
  Group,
} from "fabric/es";
import type { DeletionManager } from "../deletion-manager/index.js";
import type { ErrorManager } from "../error-manager/index.js";
import type { ImageManager } from "../image-manager/index.js";

const PASTE_OFFSET = 10;

export interface ClipboardManager {
  copy(): Promise<boolean>;
  cut(): Promise<boolean>;
  paste(): Promise<boolean>;
  duplicate(object?: FabricObject): Promise<boolean>;
  destroy(): void;
}

export interface ClipboardManagerOptions {
  readonly canvas: Canvas;
  readonly save: () => void;
  readonly errors: ErrorManager;
  readonly deletion: DeletionManager;
  readonly importImage: ImageManager["importImage"];
}

/** A pasted object needs its own id; a duplicate id fails envelope validation. */
function reassignIds(object: FabricObject): void {
  object.set("id", `${object.type}-${crypto.randomUUID()}`);
  if (object instanceof Group) {
    for (const child of object.getObjects()) reassignIds(child);
  }
}

/** Replaces the fork's text/shape commit hooks; Vigilia objects only need coords. */
function settle(object: FabricObject): void {
  if (object instanceof ActiveSelection || object instanceof Group) {
    for (const child of object.getObjects()) child.setCoords();
  }
  object.setCoords();
}

async function cloneOf(object: FabricObject): Promise<FabricObject> {
  const clone = await object.clone([...SCENE_PERSISTED_PROPERTIES]);
  settle(clone);
  return clone;
}

export function createClipboardManager(
  options: ClipboardManagerOptions,
): ClipboardManager {
  const { canvas, save, errors, deletion } = options;
  let held: FabricObject | undefined;

  const add = (clone: FabricObject): void => {
    canvas.discardActiveObject();
    if (clone instanceof ActiveSelection) {
      for (const child of clone.getObjects()) canvas.add(child);
      clone.canvas = canvas;
    } else {
      canvas.add(clone);
    }
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    canvas.fire("editor:object-pasted" as never, { object: clone } as never);
    save();
  };

  const place = async (source: FabricObject): Promise<boolean> => {
    const clone = await cloneOf(source);
    reassignIds(clone);
    clone.set({
      left: clone.left + PASTE_OFFSET,
      top: clone.top + PASTE_OFFSET,
    });
    settle(clone);
    add(clone);
    return true;
  };

  const onPaste = (event: Event): void => {
    const data = (event as ClipboardEvent).clipboardData;
    const items = data?.items;
    if (data === null || data === undefined || items === undefined) {
      void manager.paste();
      return;
    }
    const file = [...items]
      .map((item) => (item.type.startsWith("image/") ? item.getAsFile() : null))
      .find((candidate): candidate is File => candidate !== null);
    if (file !== undefined) {
      event.preventDefault();
      void options.importImage({ source: file }).catch((error: unknown) => {
        errors.error("clipboard", "Could not paste that image.", error);
      });
      return;
    }
    void manager.paste();
  };

  const manager: ClipboardManager = {
    async copy(): Promise<boolean> {
      const active = canvas.getActiveObject();
      if (active === undefined || active.get("locked") === true) return false;
      try {
        held = await cloneOf(active);
        return true;
      } catch (error) {
        errors.error("clipboard", "Could not copy that selection.", error);
        return false;
      }
    },

    async cut(): Promise<boolean> {
      if (!(await manager.copy())) return false;
      return deletion.deleteActive();
    },

    async paste(): Promise<boolean> {
      if (held === undefined) return false;
      try {
        return await place(held);
      } catch (error) {
        errors.error("clipboard", "Could not paste the clipboard.", error);
        return false;
      }
    },

    async duplicate(
      object = canvas.getActiveObject() ?? undefined,
    ): Promise<boolean> {
      if (object === undefined || object.get("locked") === true) return false;
      try {
        return await place(object);
      } catch (error) {
        errors.error("clipboard", "Could not duplicate that selection.", error);
        return false;
      }
    },

    destroy(): void {
      document.removeEventListener("paste", onPaste);
      held = undefined;
    },
  };

  document.addEventListener("paste", onPaste);
  return manager;
}
