import type {
  Binding,
  FabricGlobals,
  PlanBox,
  PlanNode,
  PlanTextLayout,
  PlanTextSegment,
  SampleSource,
  TextContent,
  TextRun,
} from "@vigilia/renderer-core";
import { emptySampleSource, resolveTextSegments } from "@vigilia/renderer-core";
import {
  FabricText,
  Group,
  Rect,
  type StaticCanvas,
  Textbox,
  type TextProps,
} from "fabric/es";
import { paintFor } from "./paint.js";
import { placementFor } from "./placement.js";
import { textShapeFor } from "./text-runs.js";

/**
 * Text uses `Textbox` for wrapping and `FabricText` otherwise. Fabric has no
 * vertical alignment/overflow box, so placement, clipping and ellipsis are handled
 * here. Ellipsis truncates segments by grapheme to preserve run styles.
 */

/** Fabric's typings make `Textbox` incompatible with `FabricText` under exact optional types. */
export type PlanTextObject = FabricText | Textbox;

/** Fabric property that preserves authored text semantics without a parallel scene tree. */
export const VIGILIA_TEXT_PROPERTY = "vigiliaText";

const ELLIPSIS = "…";

export function isTextObject(object: object): object is PlanTextObject {
  return object instanceof FabricText;
}

export function buildText(node: PlanNode, box: PlanBox): PlanTextObject {
  if (node.content.kind !== "text") {
    throw new Error("buildText received a non-text node.");
  }

  const placement = placementFor(box);
  const common: Partial<TextProps> = {
    ...paintFor(node.style, "text"),
    originX: "center" as const,
    originY: "center" as const,
    textAlign: node.content.layout.align,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
  };

  // `applyText` owns text, run styles and measurement-dependent placement.
  const object = node.content.layout.wrap
    ? new Textbox("", { ...common, width: box.width })
    : new FabricText("", common);

  applyText(object, node, box);
  object.set(VIGILIA_TEXT_PROPERTY, node.content.authored);

  return object;
}

export function updateText(
  object: PlanTextObject,
  node: PlanNode,
  box: PlanBox,
): void {
  if (node.content.kind !== "text") {
    return;
  }

  const placement = placementFor(box);

  if (object instanceof Textbox) {
    object.set("width", box.width);
  }

  object.set({
    textAlign: node.content.layout.align,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
  });

  applyText(object, node, box);
}

/** Apply sampled values while retaining the authored runs used for persistence. */
/**
 * Reapplies a text object's own authored runs to Fabric, with no source or
 * bindings involved. The editor needs this after an author changes a run: the
 * authored content is what they edited, and Fabric's per-character styles are
 * what they see. `refreshBoundText` cannot serve that case, since it refreshes
 * only objects a sample resolves.
 */
export interface ApplyAuthoredTextOptions {
  /**
   * Rewrites resolved segments before they are painted. The editor uses it to
   * show a value run's token while authoring; a display never supplies it, so a
   * token can never reach a screen.
   */
  readonly transform?: (
    segments: readonly PlanTextSegment[],
    runs: readonly TextRun[],
    bindings: readonly Binding[],
  ) => readonly PlanTextSegment[];
  readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
}

export function applyAuthoredText(
  canvas: StaticCanvas,
  globals: FabricGlobals | undefined,
  options: ApplyAuthoredTextOptions = {},
): void {
  const apply = (objects: readonly object[]): void => {
    for (const object of objects) {
      if (isTextObject(object)) {
        const id = object.get("id");
        const authored = object.get(VIGILIA_TEXT_PROPERTY);

        if (typeof id === "string" && isTextContent(authored)) {
          // Literal runs resolve against globals alone; a value run contributes
          // nothing without a sample, and keeps its authored placeholder.
          const resolved = resolveTextSegments(
            id,
            authored.runs,
            options.bindings?.[id] ?? [],
            { source: emptySampleSource },
            globals ?? {},
            [],
          );
          const segments =
            options.transform === undefined
              ? resolved
              : options.transform(
                  resolved,
                  authored.runs,
                  options.bindings?.[id] ?? [],
                );
          const shape = textShapeFor(segments, {}, (value) =>
            object.graphemeSplit(value),
          );
          // Authored layout belongs to the same content, so reapplying the
          // text must reapply it: alignment lives only here and at construction,
          // and a layout control would otherwise change nothing on screen.
          object.set({
            text: shape.text,
            styles: shape.styles,
            ...(authored.align === undefined
              ? {}
              : { textAlign: authored.align }),
          });
          object.initDimensions();
        }
      }

      const children = (
        object as { getObjects?: () => readonly object[] }
      ).getObjects?.();
      if (children !== undefined) apply(children);
    }
  };

  apply(canvas.getObjects());
}

export function refreshBoundText(
  canvas: StaticCanvas,
  bindings: Readonly<Record<string, readonly Binding[]>>,
  source: SampleSource,
  globals: FabricGlobals | undefined,
): void {
  const refresh = (objects: readonly object[]): void => {
    for (const object of objects) {
      if (isTextObject(object)) {
        const id = object.get("id");
        const authored = object.get(VIGILIA_TEXT_PROPERTY);
        if (
          typeof id === "string" &&
          isTextContent(authored) &&
          bindings[id] !== undefined
        ) {
          const segments = resolveTextSegments(
            id,
            authored.runs,
            bindings[id],
            { source },
            globals ?? {},
            [],
          );
          const shape = textShapeFor(segments, {}, (value) =>
            object.graphemeSplit(value),
          );
          object.set({ text: shape.text, styles: shape.styles });
          object.initDimensions();
        }
      }
      if (object instanceof Group) refresh(object.getObjects());
    }
  };

  refresh(canvas.getObjects());
  canvas.requestRenderAll();
}

/** Write, measure, overflow-adjust and position text inside its authored box. */
function applyText(object: PlanTextObject, node: PlanNode, box: PlanBox): void {
  if (node.content.kind !== "text") {
    return;
  }

  const { layout, segments } = node.content;

  write(object, segments, node.style);

  if (layout.overflow === "ellipsis" && !fits(object, box, layout)) {
    write(
      object,
      ellipsised(object, segments, node.style, box, layout),
      node.style,
    );
  }

  const width = object.width * object.scaleX;
  const height = object.height * object.scaleY;
  const placement = placementFor(box);

  object.set({
    left:
      layout.align === "left"
        ? box.x + width / 2
        : layout.align === "right"
          ? box.x + box.width - width / 2
          : placement.left,
    top:
      layout.verticalAlign === "top"
        ? box.y + height / 2
        : layout.verticalAlign === "bottom"
          ? box.y + box.height - height / 2
          : placement.top,
  });

  applyClip(object, layout, box);
}

function isTextContent(value: unknown): value is TextContent {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>)["runs"])
  );
}

/** `initDimensions` must follow text/style changes before alignment uses measurements. */
function write(
  object: PlanTextObject,
  segments: readonly PlanTextSegment[],
  nodeStyle: PlanNode["style"],
): void {
  const shape = textShapeFor(segments, nodeStyle, (value) =>
    object.graphemeSplit(value),
  );

  object.set({ text: shape.text, styles: shape.styles });
  object.initDimensions();
}

/** Wrapped overflow is line-count based; unwrapped ellipsis is width based. */
function fits(
  object: PlanTextObject,
  box: PlanBox,
  layout: PlanTextLayout,
): boolean {
  if (layout.wrap) {
    return (
      layout.maxLines === undefined ||
      object.textLines.length <= layout.maxLines
    );
  }

  return object.width <= box.width;
}

/** Find the longest grapheme prefix that fits when suffixed with an ellipsis. */
function ellipsised(
  object: PlanTextObject,
  segments: readonly PlanTextSegment[],
  nodeStyle: PlanNode["style"],
  box: PlanBox,
  layout: PlanTextLayout,
): readonly PlanTextSegment[] {
  const total = segments.reduce(
    (count, segment) => count + object.graphemeSplit(segment.text).length,
    0,
  );

  let low = 0;
  let high = total;

  while (low < high) {
    const probe = Math.ceil((low + high) / 2);

    write(object, truncate(object, segments, probe), nodeStyle);

    if (fits(object, box, layout)) {
      low = probe;
    } else {
      high = probe - 1;
    }
  }

  return truncate(object, segments, low);
}

function truncate(
  object: PlanTextObject,
  segments: readonly PlanTextSegment[],
  graphemes: number,
): readonly PlanTextSegment[] {
  const kept: PlanTextSegment[] = [];
  let remaining = graphemes;

  for (const segment of segments) {
    if (remaining <= 0) {
      break;
    }

    const parts = object.graphemeSplit(segment.text);

    kept.push(
      parts.length <= remaining
        ? segment
        : { ...segment, text: parts.slice(0, remaining).join("") },
    );

    remaining -= parts.length;
  }

  const last = kept[kept.length - 1];

  if (last === undefined) {
    return [{ ...(segments[0] ?? { text: "", style: {} }), text: ELLIPSIS }];
  }

  kept[kept.length - 1] = { ...last, text: `${last.text}${ELLIPSIS}` };

  return kept;
}

/** Relative clip path follows object rotation/scale and is offset for edge alignment. */
function applyClip(
  object: PlanTextObject,
  layout: PlanTextLayout,
  box: PlanBox,
): void {
  if (layout.overflow === "visible") {
    delete object.clipPath;
    return;
  }

  const scaleX = object.scaleX === 0 ? 1 : object.scaleX;
  const scaleY = object.scaleY === 0 ? 1 : object.scaleY;

  object.clipPath = new Rect({
    width: box.width / scaleX,
    height: box.height / scaleY,
    left: (box.x + box.width / 2 - object.left) / scaleX,
    top: (box.y + box.height / 2 - object.top) / scaleY,
    originX: "center",
    originY: "center",
  });
}

/** Report text treatments the canvas path still cannot express honestly. */
export function textGaps(node: PlanNode): readonly string[] {
  if (node.content.kind !== "text") {
    return [];
  }

  const gaps: string[] = [];
  const { layout } = node.content;

  if (
    layout.overflow === "ellipsis" &&
    layout.wrap &&
    layout.maxLines === undefined
  ) {
    gaps.push(
      "wrapped text cannot be ellipsised without a resolved font size — clipped instead",
    );
  }

  const shape = textShapeFor(node.content.segments, node.style, (value) => [
    ...value,
  ]);

  for (const property of shape.unsupported) {
    gaps.push(
      `"${property}" differs per run, which only a whole object can carry`,
    );
  }

  return gaps;
}
