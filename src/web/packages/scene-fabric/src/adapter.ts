import {
  Ellipse,
  FabricImage,
  FabricText,
  Group,
  Rect,
  Textbox,
  type FabricObject,
  type StaticCanvas,
} from 'fabric/es';
import type { PlanNode, ScenePlan } from '@vigilia/renderer-core';
import { VigiliaChart } from './chart-object.js';
import {
  createNodeObject,
  updateNodeObject,
  type NodeContext,
  type UnsupportedReporter,
} from './fabric-nodes.js';
import { drawnBox, withinGroup } from './placement.js';
import { clampRenderScale, DEFAULT_RENDER_SCALE } from './render-scale.js';

/**
 * Reconciles a `ScenePlan` **onto** a Fabric canvas.
 *
 * The one owner of plan → Fabric, imported by both ends (§105). It replaces
 * `mount.ts`'s 766 lines of DOM applier, and like it, decides nothing: every
 * value written here was computed by `plan.ts`, which is pure and tested in
 * Node.
 *
 * ## A patch, not a scene
 *
 * `apply` takes a plan and a canvas that may already hold objects; it creates
 * one only for an id it cannot find. Built the other way — plan in, canvas out
 * — stage 3 would need either a Fabric-JSON-to-`ThemeNode` converter or a
 * write-back layer that reads `left`/`top`/`angle` off every object on every
 * commit, and adopting Fabric's format is supposed to *delete* that work. So
 * the direction is fixed here, in the module both ends import, where it cannot
 * be quietly inverted later:
 *
 * ```text
 * load:   envelope.scene ──loadFromJSON──▶ Fabric objects (geometry, order,
 *                                          grouping, visibility — no conversion)
 * frame:  ThemeDocument ──plan.ts──▶ ScenePlan ──apply──▶ set() onto those
 *                                          objects (style, text, chart options)
 * save:   canvas.toObject() ──▶ envelope.scene   (no read-back of geometry)
 * ```
 *
 * {@link adoptExisting} is what makes the first line work, and it is why the
 * identity map is built by *reading* the canvas rather than only by writing to
 * it.
 *
 * ## Two different mismatches, handled two different ways
 *
 * **A node whose Fabric class changed** is replaced on its own: a rectangle
 * that became an ellipse, or text that started wrapping, is a different class
 * and nothing about the old object is reusable. Keeping it was the first defect
 * `adapter.dom.test.ts` caught — both are `kind: 'shape'` and `kind: 'text'`,
 * so a key built from the content kind cannot see either.
 *
 * **A node whose parent changed** rebuilds the whole scene, because its object
 * lives inside the wrong parent's `_objects` and every coordinate it holds is
 * in the wrong space. That is what {@link structureKeyFor} watches, and the
 * blunt response is deliberate: `mount.ts` **threw** on a changed tree, which
 * was right for a player whose layout never moves and wrong for anything else,
 * while a general tree diff is complexity the editor has not asked for yet.
 *
 * Neither fires on the *first* apply, which is what lets a revived scene be
 * adopted rather than cleared — the second defect that test caught.
 */

export interface SceneAdapterOptions {
  /**
   * The canvas to draw on.
   *
   * A `StaticCanvas`, never the interactive `Canvas` — that is +31.0 KB gzip of
   * pointer handling a display cannot use, and `packages/editor` is the only
   * place allowed to construct one. `Canvas` extends `StaticCanvas`, so the
   * editor still passes its own through here.
   */
  readonly canvas: StaticCanvas;
  /** Device-pixel oversample for chart backing canvases. */
  readonly renderScale?: number;
  readonly onAssetError?: (nodeId: string, src: string) => void;
  /**
   * Called for everything the document asked for and this renderer cannot do.
   *
   * §85's rule is to mark a gap rather than approximate it, and a gap nobody
   * is told about is indistinguishable from a bug. The plan's own `issues` are
   * facts about the *data*; these are facts about the *renderer*, which is why
   * they cannot be plan issues.
   */
  readonly onUnsupported?: UnsupportedReporter;
}

export interface SceneAdapter {
  /** Applies a plan, creating, updating and removing objects to match it. */
  apply(plan: ScenePlan): void;
  /** Changes the chart oversample factor, for a DPR or zoom change. */
  setRenderScale(scale: number): void;
  /** The object drawing a node, for the editor and for tests. */
  objectFor(nodeId: string): FabricObject | undefined;
  /** Disposes every object this adapter created and empties the canvas. */
  dispose(): void;
}

export function createSceneAdapter(options: SceneAdapterOptions): SceneAdapter {
  const { canvas } = options;
  const objects = new Map<string, FabricObject>();
  /** The plan node last written, per id, so an update can skip unchanged work. */
  const applied = new Map<string, PlanNode>();
  /** Flat plan order, which is also z-order. Rebuilt every apply. */
  let order: string[] = [];
  /** Undefined until the first apply, so an adopted scene is never cleared. */
  let structure: string | undefined;
  let renderScale = clampRenderScale(options.renderScale ?? DEFAULT_RENDER_SCALE, 1, 1);

  // `canvas.remove()` does NOT dispose an object — it only fires this event
  // (`Collection.ts:68`), while `destroy()` does call `dispose()` on every
  // object (`StaticCanvas.ts:1473`). So teardown is covered and removal is
  // not, and a removed chart would leak its ECharts instance and its backing
  // store: measured at 196x the heap over 100 create-and-dispose cycles.
  canvas.on('object:removed', ({ target }) => {
    target.dispose();
  });

  adoptExisting(canvas, objects);

  function context(): NodeContext {
    return {
      renderScale,
      ...(options.onUnsupported === undefined ? {} : { onUnsupported: options.onUnsupported }),
      ...(options.onAssetError === undefined ? {} : { onAssetError: options.onAssetError }),
      // An image's object exists from the first frame and only its pixels
      // arrive late, so there is nothing to insert or re-stack here — just a
      // frame to draw.
      onDecoded: () => {
        canvas.requestRenderAll();
      },
    };
  }

  function register(nodeId: string, object: FabricObject): void {
    objects.set(nodeId, object);
  }

  /**
   * Puts every object in the plan's order.
   *
   * Only top-level objects: a group's children are in its own `_objects`, and
   * are created in plan order there. Needed at all because an image joins the
   * canvas whenever it decodes, which is not the order it was authored in.
   */
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
    // Through the canvas, so `object:removed` disposes each one. Charts hold an
    // ECharts instance and a backing canvas; dropping the references is not
    // enough to free the pixels.
    canvas.remove(...canvas.getObjects());
    objects.clear();
    applied.clear();
  }

  return {
    apply(plan: ScenePlan): void {
      const nodes = [...walk(plan.nodes)];
      const nextStructure = structureKeyFor(nodes);

      if (structure !== undefined && nextStructure !== structure) {
        // A different tree, not new data: everything below assumes an object
        // found by id belongs where the plan now puts it, and a node that
        // changed parent does not.
        clear();
      }

      structure = nextStructure;

      order = nodes.filter(({ parent }) => parent === undefined).map(({ node }) => node.id);

      applyArtboard(canvas, plan);

      for (const { node, parent } of nodes) {
        // A child's box is relative to its parent group's top-left; a Fabric
        // child's coordinates are relative to the group's centre. On creation
        // `Group.add()` does that conversion, so only the update path applies
        // it — see `placement.ts`.
        const existing = reusable(node);

        if (existing === undefined) {
          const created = createNodeObject(node, drawnBox(node), context(), register);

          if (created !== undefined && parent === undefined) {
            canvas.add(created);
          }
        } else {
          const box =
            parent === undefined ? drawnBox(node) : withinGroup(drawnBox(node), drawnBox(parent));

          updateNodeObject(existing, node, applied.get(node.id), box, context());
        }

        applied.set(node.id, node);
      }

      removeStale(nodes);
      restack();
      canvas.requestRenderAll();
    },

    setRenderScale(scale: number): void {
      renderScale = scale;

      for (const object of objects.values()) {
        if (object instanceof VigiliaChart) {
          // Each chart re-clamps against its own box, so one factor in gives
          // different effective resolutions out — which is correct: the cap is
          // on backing pixels, not on the factor.
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
      order = [];
      structure = undefined;
    },
  };

  /**
   * The object already drawing this node, if it is still the right class.
   *
   * A class mismatch means the node's kind, shape or wrapping changed, so the
   * old object is dropped here rather than updated into something it cannot
   * be. `objectFor` would otherwise keep handing back a `Rect` for an ellipse.
   */
  function reusable(node: PlanNode): FabricObject | undefined {
    const existing = objects.get(node.id);

    if (existing === undefined || isRightClass(existing, node)) {
      return existing;
    }

    objects.delete(node.id);
    applied.delete(node.id);

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

      // A grouped object leaves through its group, which fires `removed` on
      // the group rather than on the canvas — so it is disposed here.
      if (object.group instanceof Group) {
        object.group.remove(object);
        object.dispose();
      } else {
        canvas.remove(object);
      }
    }
  }
}

/**
 * The artboard's own properties.
 *
 * The *transform* is not here: it depends on the viewport, which this module
 * does not know about. `scene.ts` owns it, because it owns the element.
 */
function applyArtboard(canvas: StaticCanvas, plan: ScenePlan): void {
  canvas.backgroundColor = asCss(plan.artboard.background) ?? '';

  const { width, height } = plan.artboard;
  const clip = canvas.clipPath;

  // Content outside the artboard is not drawn. In `cover` mode the design is
  // deliberately larger than the viewport, and §53's letterbox bars are the
  // *host's* background showing where the design is not — so without this,
  // overflowing content would paint over them.
  if (clip instanceof Rect) {
    clip.set({ width, height, left: width / 2, top: height / 2 });
  } else {
    canvas.clipPath = new Rect({
      width,
      height,
      left: width / 2,
      top: height / 2,
      originX: 'center',
      originY: 'center',
      // In canvas coordinates rather than relative to any object, which is
      // what an artboard is.
      absolutePositioned: true,
    });
  }
}

/**
 * Indexes objects already on the canvas by their `id`.
 *
 * This is the stage-3 seam: a scene revived with `loadFromJSON` arrives as
 * Fabric objects carrying their own geometry and their `id` custom property,
 * and `apply` must then *configure* them rather than replace them. Building the
 * map by reading the canvas is what makes "creates objects only for ids it does
 * not find" true of a revived scene as well as of an empty one.
 */
function adoptExisting(canvas: StaticCanvas, objects: Map<string, FabricObject>): void {
  const visit = (list: readonly FabricObject[]): void => {
    for (const object of list) {
      const id = object.get('id');

      if (typeof id === 'string' && id.length > 0) {
        objects.set(id, object);
      }

      if (object instanceof Group) {
        visit(object.getObjects());
      }
    }
  };

  visit(canvas.getObjects());
}

interface WalkedNode {
  readonly node: PlanNode;
  /** The enclosing group's node, or undefined at the top level. */
  readonly parent: PlanNode | undefined;
}

function* walk(
  nodes: readonly PlanNode[],
  parent?: PlanNode,
): Generator<WalkedNode> {
  for (const node of nodes) {
    yield { node, ...(parent === undefined ? { parent: undefined } : { parent }) };
    yield* walk(node.children, node);
  }
}

/** Any Fabric class, for an identity comparison against `constructor`. */
type FabricObjectClass = abstract new (...args: never[]) => FabricObject;

/**
 * Which Fabric class a node needs.
 *
 * One place, so the check below and `fabric-nodes.ts`'s construction cannot
 * disagree about what a node is. `undefined` means nothing is drawn for it —
 * a video, or an image still loading.
 */
function classFor(node: PlanNode): FabricObjectClass | undefined {
  switch (node.content.kind) {
    case 'group':
      return Group;

    case 'shape':
      return node.content.shape === 'ellipse' ? Ellipse : Rect;

    case 'text':
      return node.content.layout.wrap ? Textbox : FabricText;

    case 'chart':
      return VigiliaChart;

    case 'image':
      return FabricImage;

    case 'video':
      // Nothing is drawn for one, so any object found under a video node's id
      // is a leftover and is dropped rather than updated.
      return undefined;
  }
}

/**
 * Whether an existing object is the class its node now needs.
 *
 * **Exact constructor equality, not `instanceof`.** `Textbox` extends
 * `FabricText`, so an `instanceof` check would accept a wrapping object for a
 * node that no longer wraps — which then silently keeps wrapping. Nothing here
 * is subclassed except `VigiliaChart`, which is its own kind.
 */
function isRightClass(object: FabricObject, node: PlanNode): boolean {
  return object.constructor === classFor(node);
}

/**
 * The nesting, which is what an update cannot survive a change to.
 *
 * Deliberately *not* the content kind: a class change is handled per node, and
 * folding it in here would rebuild the whole scene for one retyped rectangle.
 */
function structureKeyFor(nodes: readonly WalkedNode[]): string {
  return nodes.map(({ node, parent }) => `${parent?.id ?? ''}>${node.id}`).join(',');
}

function asCss(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
