import {
  Ellipse,
  FixedLayout,
  Group,
  LayoutManager,
  Rect,
  type FabricImage,
  type FabricObject,
} from "fabric/es";
import type { PlanBox, PlanNode, ResolvedStyle } from "@vigilia/renderer-core";
import { VigiliaChart } from "./chart-object.js";
import { buildImage, placeImage } from "./fabric-image.js";
import {
  buildText,
  isTextObject,
  textGaps,
  updateText,
} from "./fabric-text.js";
import { paintFor, unsupportedPaint } from "./paint.js";
import { drawnBox, placementFor } from "./placement.js";

/** Maps each `PlanNode` to one Fabric object. Adapter owns identity/tree/z-order. */

export type UnsupportedReporter = (nodeId: string, reason: string) => void;

export interface NodeContext {
  readonly renderScale: number;
  readonly onUnsupported?: UnsupportedReporter;
  readonly onAssetError?: (nodeId: string, src: string) => void;
  readonly onDecoded?: (nodeId: string) => void;
}

export function createNodeObject(
  node: PlanNode,
  box: PlanBox,
  context: NodeContext,
  register: (nodeId: string, object: FabricObject) => void,
): FabricObject | undefined {
  const object = build(node, box, context, register);

  reportGaps(node, context);

  if (object === undefined) {
    return undefined;
  }

  object.set("id", node.id);
  object.set("visible", node.visible);
  object.setCoords();

  register(node.id, object);

  return object;
}

export function updateNodeObject(
  object: FabricObject,
  node: PlanNode,
  previous: PlanNode | undefined,
  box: PlanBox,
  context: NodeContext,
): void {
  const geometryChanged =
    previous === undefined || !sameBox(previous.box, node.box);
  const styleChanged = previous === undefined || previous.style !== node.style;

  switch (node.content.kind) {
    case "chart":
      if (object instanceof VigiliaChart) {
        updateChart(object, node, previous, box, geometryChanged);
      }
      break;

    case "text":
      // Text content commonly changes every frame; comparing rebuilt segments costs no less.
      if (isTextObject(object)) {
        updateText(object, node, box);
      }
      break;

    case "image":
      if (geometryChanged || styleChanged) {
        placeImage(object as FabricImage, node, box, node.content.fit);
      }
      break;

    case "group":
    case "shape":
      if (geometryChanged) {
        const placement = placementFor(box);

        object.set({
          left: placement.left,
          top: placement.top,
          angle: placement.angle,
          scaleX: placement.scaleX,
          scaleY: placement.scaleY,
        });

        if (node.content.kind === "shape") {
          resizeShape(object, box, node.style);
        } else {
          object.set({ width: placement.width, height: placement.height });
        }
      }
      break;
  }

  if (
    styleChanged &&
    node.content.kind !== "group" &&
    node.content.kind !== "image"
  ) {
    object.set(
      paintFor(node.style, node.content.kind === "text" ? "text" : "box"),
    );

    if (node.content.kind === "shape") {
      resizeShape(object, box, node.style);
    }
  }

  object.set("visible", node.visible);
  object.setCoords();
}

function build(
  node: PlanNode,
  box: PlanBox,
  context: NodeContext,
  register: (nodeId: string, object: FabricObject) => void,
): FabricObject | undefined {
  switch (node.content.kind) {
    case "group":
      return buildGroup(node, box, context, register);

    case "shape":
      return buildShape(node, box);

    case "text":
      return buildText(node, box);

    case "chart":
      return buildChart(node, box, context);

    case "image":
      return buildImage(
        node,
        box,
        { renderScale: context.renderScale },
        {
          ...(context.onAssetError === undefined
            ? {}
            : { onAssetError: context.onAssetError }),
          ...(context.onUnsupported === undefined
            ? {}
            : { onUnsupported: context.onUnsupported }),
          ...(context.onDecoded === undefined
            ? {}
            : { onDecoded: context.onDecoded }),
        },
      );

    case "video":
      context.onUnsupported?.(
        node.id,
        "video cannot be a canvas object — a DOM layer behind the scene is stage 7",
      );

      return undefined;
  }
}

/**
 * FixedLayout preserves authored group geometry. Build empty, add children at the
 * content origin, then apply the real group transform so `Group.add()` converts
 * child coordinates correctly.
 */
function buildGroup(
  node: PlanNode,
  box: PlanBox,
  context: NodeContext,
  register: (nodeId: string, object: FabricObject) => void,
): Group {
  const placement = placementFor(box);
  const group = new Group([], {
    left: placement.width / 2,
    top: placement.height / 2,
    width: placement.width,
    height: placement.height,
    originX: "center",
    originY: "center",
    layoutManager: new LayoutManager(new FixedLayout()),
    subTargetCheck: false,
    interactive: false,
  });

  const children = node.children
    .map((child) => createNodeObject(child, drawnBox(child), context, register))
    .filter((child): child is FabricObject => child !== undefined);

  if (children.length > 0) {
    group.add(...children);
  }

  group.set({
    left: placement.left,
    top: placement.top,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
  });

  return group;
}

function buildShape(node: PlanNode, box: PlanBox): FabricObject {
  if (node.content.kind !== "shape") {
    throw new Error("buildShape received a non-shape node.");
  }

  const placement = placementFor(box);
  const inset = insetFor(node.style);
  const width = Math.max(0, placement.width - inset * 2);
  const height = Math.max(0, placement.height - inset * 2);
  const common = {
    ...paintFor(node.style, "box"),
    originX: "center" as const,
    originY: "center" as const,
    left: placement.left,
    top: placement.top,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
    width,
    height,
  };

  // Ellipse derives width/height from radii, so assign radii last.
  if (node.content.shape === "ellipse") {
    return new Ellipse({ ...common, rx: width / 2, ry: height / 2 });
  }

  // Document `line` is a filled rectangle, matching the old renderer semantics.
  if (node.content.shape === "rectangle" && node.content.cornerRadius > 0) {
    const radius = cornerRadiusFor(node.content.cornerRadius, width, height);

    return new Rect({ ...common, rx: radius, ry: radius });
  }

  return new Rect(common);
}

/** Clamp one radius uniformly so large radii stay capsule-like rather than elliptical. */
function cornerRadiusFor(
  cornerRadius: number,
  width: number,
  height: number,
): number {
  return Math.min(cornerRadius, width / 2, height / 2);
}

function buildChart(
  node: PlanNode,
  box: PlanBox,
  context: NodeContext,
): FabricObject | undefined {
  if (node.content.kind !== "chart") {
    throw new Error("buildChart received a non-chart node.");
  }

  const placement = placementFor(box);

  if (!(placement.width > 0) || !(placement.height > 0)) {
    context.onUnsupported?.(
      node.id,
      `a chart needs a positive size; the document gives ${placement.width}x${placement.height}`,
    );

    return undefined;
  }

  return new VigiliaChart({
    ...node.content,
    width: placement.width,
    height: placement.height,
    renderScale: context.renderScale,
    ...paintFor(node.style, "box"),
    left: placement.left,
    top: placement.top,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
  });
}

function updateChart(
  chart: VigiliaChart,
  node: PlanNode,
  previous: PlanNode | undefined,
  box: PlanBox,
  geometryChanged: boolean,
): void {
  if (node.content.kind !== "chart") {
    return;
  }

  if (geometryChanged) {
    const placement = placementFor(box);

    if (placement.width > 0 && placement.height > 0) {
      chart.resizeTo(placement.width, placement.height);
    }

    chart.set({
      left: placement.left,
      top: placement.top,
      angle: placement.angle,
      scaleX: placement.scaleX,
      scaleY: placement.scaleY,
    });
  }

  // Options carry live samples, so always refresh them.
  chart.setOption(node.content.option);

  if (
    previous !== undefined &&
    previous.content.kind === "chart" &&
    previous.content.settings !== node.content.settings
  ) {
    chart.set("settings", node.content.settings);
  }
}

function resizeShape(
  object: FabricObject,
  box: PlanBox,
  style: ResolvedStyle,
): void {
  const inset = insetFor(style);
  const width = Math.max(0, box.width - inset * 2);
  const height = Math.max(0, box.height - inset * 2);

  if (object instanceof Ellipse) {
    object.set({ rx: width / 2, ry: height / 2 });

    return;
  }

  object.set({ width, height });
}

/** Inset by half the visible stroke so authored box remains the outer bounds. */
function insetFor(style: ResolvedStyle): number {
  const width = style["strokeWidth"];
  const color = style["strokeColor"];

  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) {
    return 0;
  }

  return typeof color === "string" && color.length > 0 ? width / 2 : 0;
}

/** Compare fields because plan boxes are recreated each frame. */
function sameBox(a: PlanBox, b: PlanBox): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY
  );
}

function reportGaps(node: PlanNode, context: NodeContext): void {
  const report = context.onUnsupported;

  if (report === undefined || node.content.kind === "group") {
    return;
  }

  for (const property of unsupportedPaint(
    node.style,
    node.content.kind === "text" ? "text" : "box",
  )) {
    report(
      node.id,
      `the style property "${property}" is not expressible on canvas`,
    );
  }

  for (const gap of textGaps(node)) {
    report(node.id, gap);
  }
}
