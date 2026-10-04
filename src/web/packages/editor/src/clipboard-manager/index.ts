import type { Binding } from "@vigilia/renderer-core";
import {
  SCENE_PERSISTED_PROPERTIES,
  VIGILIA_TEXT_PROPERTY,
} from "@vigilia/scene-fabric";
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

/** What places a pasted image. Returns whatever the importer returns. */
export type ImageImporter = (file: File) => Promise<unknown>;

/**
 * What a pasted or duplicated object owes the document, written through the
 * session. **A copy is a copy, not a twin** — see `carryBindings` below.
 */
export interface ClipboardBindings {
  /** The document's readings, keyed by the id of the object that shows them. */
  readonly read: () => Readonly<Record<string, readonly Binding[]>>;
  /** Records a copy's readings under its own ids. Envelope state, so the
   * session writes rather than this module holding a second copy. */
  readonly write: (
    additions: Readonly<Record<string, readonly Binding[]>>,
  ) => void;
}

export interface ClipboardManager {
  copy(): Promise<boolean>;
  cut(): Promise<boolean>;
  paste(): Promise<boolean>;
  duplicate(object?: FabricObject): Promise<boolean>;
  setImageImporter(importer: ImageImporter): void;
  /** Installed by the session, which owns the envelope's bindings. */
  setBindings(bindings: ClipboardBindings): void;
  destroy(): void;
}

export interface ClipboardManagerOptions {
  readonly canvas: Canvas;
  readonly save: () => void;
  readonly errors: ErrorManager;
  readonly deletion: DeletionManager;
  readonly importImage: ImageManager["importImage"];
  readonly bindings?: ClipboardBindings;
}

/** A pasted object needs its own id; a duplicate id fails envelope validation.
 *
 * Returns what each id became, which is how a copy's readings travel with it:
 * a binding is keyed by the object that shows it, so without this a card comes
 * back named after a CPU card, shows nothing, and prints no key in the tree.
 */
function reassignIds(object: FabricObject, ids: Map<string, string>): void {
  const from = object.get("id");
  const to = `${object.type}-${crypto.randomUUID()}`;
  if (typeof from === "string") ids.set(from, to);
  object.set("id", to);
  if (object instanceof Group) {
    for (const child of object.getObjects()) reassignIds(child, ids);
  }
}

/**
 * The readings a copy carries, under the copy's own object ids and with fresh
 * binding ids, and the run `bindingId`s repointed at them.
 *
 * **A copy is a copy, not a twin.** Two things have to move together or the
 * author is handed a lie:
 *
 *  - The envelope's `bindings` are keyed by object id, and a pasted object has a
 *    new one, so its readings are stripped at the next save by the same
 *    `dropDanglingBindings` that protects a deleted object. The copy arrives
 *    showing nothing at all.
 *  - A run names its binding by id, so copying a binding *under the original's
 *    id* would leave two entries claiming one binding id — the validator's
 *    `duplicate-id`, and an unsaveable session for the rest of the editing
 *    session. Fresh binding ids with the runs repointed are the only shape that
 *    both keeps the readings and keeps the document valid.
 *
 * The semantic keys are carried across unchanged: a copy bound to a sensor
 * nobody else names is not a copy of anything.
 */
function carryBindings(
  object: FabricObject,
  ids: ReadonlyMap<string, string>,
  bindings: ClipboardBindings,
): Readonly<Record<string, readonly Binding[]>> {
  const held = bindings.read();
  const carried: Record<string, readonly Binding[]> = {};
  const repoint = new Map<string, string>();
  for (const [from, to] of ids) {
    const readings = held[from];
    if (readings === undefined || readings.length === 0) continue;
    carried[to] = readings.map((binding) => {
      const id = `binding-${crypto.randomUUID()}`;
      repoint.set(binding.id, id);
      return { ...binding, id };
    });
  }
  if (repoint.size > 0) repointRuns(object, repoint);
  return carried;
}

/** Every value run on the copy, at any depth, pointed at the copy's binding. */
function repointRuns(
  object: FabricObject,
  ids: ReadonlyMap<string, string>,
): void {
  const authored = object.get(VIGILIA_TEXT_PROPERTY);
  if (isRecord(authored) && Array.isArray(authored["runs"])) {
    object.set(VIGILIA_TEXT_PROPERTY, {
      ...authored,
      runs: authored["runs"].map((run) => {
        if (!isRecord(run) || typeof run["bindingId"] !== "string") return run;
        return {
          ...run,
          bindingId: ids.get(run["bindingId"]) ?? run["bindingId"],
        };
      }),
    });
  }
  if (object instanceof Group) {
    for (const child of object.getObjects()) repointRuns(child, ids);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  let documentBindings: ClipboardBindings | undefined = options.bindings;

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
    const ids = new Map<string, string>();
    reassignIds(clone, ids);
    clone.set({
      left: clone.left + PASTE_OFFSET,
      top: clone.top + PASTE_OFFSET,
    });
    settle(clone);
    // Before the clone joins the canvas, so the first paint it gets is the one
    // its own readings resolve — an object that arrived ahead of its bindings
    // would paint blank once and wait for a tick nothing had yet asked for.
    const carried =
      documentBindings === undefined
        ? {}
        : carryBindings(clone, ids, documentBindings);
    add(clone);
    if (Object.keys(carried).length > 0) documentBindings?.write(carried);
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
      void imageImporter(file).catch((error: unknown) => {
        errors.error("clipboard", "Could not paste that image.", error);
      });
      return;
    }
    void manager.paste();
  };

  let imageImporter = (file: File): Promise<unknown> =>
    options.importImage({ source: file });

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

    /** Installed by the session, which owns the envelope's bindings. A paste
     * with no owner for them is the same defect this fixes, one layer down: the
     * copy's readings would be stripped at the next save and the author told
     * nothing. */
    setBindings(bindings: ClipboardBindings): void {
      documentBindings = bindings;
    },

    /** Replaces the image importer.
     *
     * The shell builds this manager before the session exists, and the session
     * owns the asset manager, so the importer that makes a pasted image a
     * *declared asset* rather than a session-local `blob:` URL is installed from
     * there. Half the fix here is worse than none: the image appears, saves,
     * and is gone everywhere else.
     */
    setImageImporter(importer: ImageImporter): void {
      imageImporter = importer;
    },

    destroy(): void {
      document.removeEventListener("paste", onPaste);
      held = undefined;
    },
  };

  document.addEventListener("paste", onPaste);
  return manager;
}
