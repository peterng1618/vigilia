import {
  Ellipse,
  FabricImage,
  FabricText,
  Group,
  Rect,
  Textbox,
  type FabricObject,
  type StaticCanvas,
} from "fabric/es";
import type { PlanBox, PlanNode, ScenePlan } from "@vigilia/renderer-core";
import { VigiliaChart } from "./chart-object.js";
import {
  createNodeObject,
  updateNodeObject,
  type NodeContext,
  type UnsupportedReporter,
} from "./fabric-nodes.js";
import { isTextObject, updateText } from "./fabric-text.js";
import { drawnBox, withinGroup } from "./placement.js";
import { clampRenderScale, DEFAULT_RENDER_SCALE } from "./render-scale.js";
import { artboardPaintKey, fabricArtboardPaint } from "./artboard-paint.js";

/**
 * Reconcile a pure `ScenePlan` onto existing Fabric objects. Revived scene
 * geometry/order is adopted by id; class changes replace one object, while
 * parent changes rebuild the scene because the object's coordinate space changed.
 */

export interface SceneAdapterOptions {
  /** Player passes `StaticCanvas`; editor may pass interactive `Canvas`. */
  readonly canvas: StaticCanvas;
  readonly renderScale?: number;
  readonly onAssetError?: (nodeId: string, src: string) => void;
  /** Renderer limitations, separate from plan/data issues. */
  readonly onUnsupported?: UnsupportedReporter;
}

export interface SceneAdapter {
  apply(plan: ScenePlan): void;
  setRenderScale(scale: number): void;
  objectFor(nodeId: string): FabricObject | undefined;
  dispose(): void;
}

export function createSceneAdapter(options: SceneAdapterOptions): SceneAdapter {
  const { canvas } = options;
  const objects = new Map<string, FabricObject>();
  const applied = new Map<string, PlanNode>();
  let order: string[] = [];
  /** Undefined until first apply so a revived scene is adopted rather than cleared. */
  let structure: string | undefined;
  /** Last drawn boxes let font loads remeasure text without rebuilding the plan. */
  const boxes = new Map<string, PlanBox>();
  let renderScale = clampRenderScale(
    options.renderScale ?? DEFAULT_RENDER_SCALE,
    1,
    1,
  );

  // `canvas.remove()` does not dispose; charts must release ECharts/backing pixels.
  canvas.on("object:removed", ({ target }) => {
    target.dispose();
  });

  adoptExisting(canvas, objects);
  const applyArtboard = createApplyArtboard(canvas);

  function context(): NodeContext {
    return {
      renderScale,
      ...(options.onUnsupported === undefined
        ? {}
        : { onUnsupported: options.onUnsupported }),
      ...(options.onAssetError === undefined
        ? {}
        : { onAssetError: options.onAssetError }),
      onDecoded: () => {
        canvas.requestRenderAll();
      },
    };
  }

  function register(nodeId: string, object: FabricObject): void {
    objects.set(nodeId, object);
  }

  /** Restore top-level Fabric z-order to authored plan order. */
  function restack(): void {
    let index = 0;

    for (const nodeId of order) {
      const object = objects.get(nodeId);

      if (object === undefined || object.group !== undefined) {
        continue;
      }

      canvas.moveObjectTo(object, index);
      index += 1;
    }
  }

  function clear(): void {
    canvas.remove(...canvas.getObjects());
    objects.clear();
    applied.clear();
    boxes.clear();
  }

  const adapter: SceneAdapter = {
    apply(plan: ScenePlan): void {
      const nodes = [...walk(plan.nodes)];
      const nextStructure = structureKeyFor(nodes);

      if (structure !== undefined && nextStructure !== structure) {
        clear();
      }

      structure = nextStructure;
      order = nodes
        .filter(({ parent }) => parent === undefined)
        .map(({ node }) => node.id);

      applyArtboard(plan);

      for (const { node, parent } of nodes) {
        const existing = reusable(node);
        // Existing grouped children are center-local; `Group.add()` handles this on creation.
        const box =
          parent === undefined
            ? drawnBox(node)
            : withinGroup(drawnBox(node), drawnBox(parent));

        if (existing === undefined) {
          const created = createNodeObject(
            node,
            drawnBox(node),
            context(),
            register,
          );

          if (created !== undefined && parent === undefined) {
            canvas.add(created);
          }
        } else {
          updateNodeObject(
            existing,
            node,
            applied.get(node.id),
            box,
            context(),
          );
        }

        applied.set(node.id, node);
        boxes.set(node.id, box);
      }

      removeStale(nodes);
      restack();
      canvas.requestRenderAll();
    },

    setRenderScale(scale: number): void {
      renderScale = scale;

      for (const object of objects.values()) {
        if (object instanceof VigiliaChart) {
          object.setRenderScale(scale);
        }
      }

      canvas.requestRenderAll();
    },

    objectFor(nodeId: string): FabricObject | undefined {
      return objects.get(nodeId);
    },

    dispose(): void {
      clear();
      releaseFonts();
      order = [];
      structure = undefined;
    },
  };

  /** Font loads affect text metrics only; avoid replaying charts/the whole plan. */
  function remeasureText(): void {
    for (const [nodeId, object] of objects) {
      const node = applied.get(nodeId);
      const box = boxes.get(nodeId);

      if (node !== undefined && box !== undefined && isTextObject(object)) {
        updateText(object, node, box);
      }
    }

    canvas.requestRenderAll();
  }

  const releaseFonts = watchFontLoads(remeasureText);

  return adapter;

  /** Reuse only when the existing Fabric class still matches the node. */
  function reusable(node: PlanNode): FabricObject | undefined {
    const existing = objects.get(node.id);

    if (existing === undefined || isRightClass(existing, node)) {
      return existing;
    }

    objects.delete(node.id);
    applied.delete(node.id);
    boxes.delete(node.id);

    if (existing.group instanceof Group) {
      existing.group.remove(existing);
      existing.dispose();
    } else {
      canvas.remove(existing);
    }

    return undefined;
  }

  function removeStale(nodes: readonly WalkedNode[]): void {
    const live = new Set(nodes.map(({ node }) => node.id));

    for (const [nodeId, object] of objects) {
      if (live.has(nodeId)) {
        continue;
      }

      objects.delete(nodeId);
      applied.delete(nodeId);
      boxes.delete(nodeId);

      // Group removal does not emit the canvas-level disposal event for children.
      if (object.group instanceof Group) {
        object.group.remove(object);
        object.dispose();
      } else {
        canvas.remove(object);
      }
    }
  }
}

/** Apply artboard paint/clip; viewport transform belongs to `scene.ts`. The
 * paint memo lives per adapter because the same paint key is only interchangeable
 * for one canvas. */
function createApplyArtboard(canvas: StaticCanvas): (plan: ScenePlan) => void {
  let lastPaintKey: string | undefined;

  return (plan: ScenePlan): void => {
    // Every player render tick calls this; only rebuild the Gradient when the
    // resolved paint actually changed.
    const paintKey = artboardPaintKey(plan.artboard.background);

    if (paintKey !== lastPaintKey) {
      lastPaintKey = paintKey;
      canvas.backgroundColor =
        fabricArtboardPaint(
          plan.artboard.background,
          plan.artboard.width,
          plan.artboard.height,
        ) ?? "";
    }

    const { width, height } = plan.artboard;
    const clip = canvas.clipPath;

    if (clip instanceof Rect) {
      clip.set({ width, height, left: width / 2, top: height / 2 });
    } else {
      canvas.clipPath = new Rect({
        width,
        height,
        left: width / 2,
        top: height / 2,
        originX: "center",
        originY: "center",
        absolutePositioned: true,
      });
    }
  };
}

/** Index revived Fabric objects by persisted Vigilia id, including group children. */
function adoptExisting(
  canvas: StaticCanvas,
  objects: Map<string, FabricObject>,
): void {
  const visit = (list: readonly FabricObject[]): void => {
    for (const object of list) {
      const id = object.get("id");

      if (typeof id === "string" && id.length > 0) {
        objects.set(id, object);
      }

      if (object instanceof Group) {
        visit(object.getObjects());
      }
    }
  };

  visit(canvas.getObjects());
}

/** Remeasure canvas text when existing or later-loaded fonts finish loading. */
function watchFontLoads(remeasure: () => void): () => void {
  const fonts = typeof document === "undefined" ? undefined : document.fonts;

  if (fonts === undefined) {
    return () => {};
  }

  let live = true;
  const onLoad = (): void => {
    if (live) {
      remeasure();
    }
  };

  fonts.addEventListener("loadingdone", onLoad);
  void fonts.ready.then(onLoad);

  return () => {
    live = false;
    fonts.removeEventListener("loadingdone", onLoad);
  };
}

interface WalkedNode {
  readonly node: PlanNode;
  readonly parent: PlanNode | undefined;
}

function* walk(
  nodes: readonly PlanNode[],
  parent?: PlanNode,
): Generator<WalkedNode> {
  for (const node of nodes) {
    yield {
      node,
      ...(parent === undefined ? { parent: undefined } : { parent }),
    };
    yield* walk(node.children, node);
  }
}

type FabricObjectClass = abstract new (...args: never[]) => FabricObject;

/** Single mapping from plan content to required Fabric class. */
function classFor(node: PlanNode): FabricObjectClass | undefined {
  switch (node.content.kind) {
    case "group":
      return Group;

    case "shape":
      return node.content.shape === "ellipse" ? Ellipse : Rect;

    case "text":
      return node.content.layout.wrap ? Textbox : FabricText;

    case "chart":
      return VigiliaChart;

    case "image":
      return FabricImage;

    case "video":
      return undefined;
  }
}

/** Exact constructor equality matters because `Textbox` extends `FabricText`. */
function isRightClass(object: FabricObject, node: PlanNode): boolean {
  return object.constructor === classFor(node);
}

/** Parent/id topology only; class changes are handled per node. */
function structureKeyFor(nodes: readonly WalkedNode[]): string {
  return nodes
    .map(({ node, parent }) => `${parent?.id ?? ""}>${node.id}`)
    .join(",");
}
