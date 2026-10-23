import { YUNARI_PAINT_PROPERTY } from "@yunari/scene-fabric";
import {
  type FabricObject,
  type Gradient,
  Group,
  loadSVGFromString,
} from "fabric/es";

/** The theme paint an imported icon draws with, and the reference it came from. */
export interface IconInk {
  readonly color: string | Gradient<"linear">;
  readonly ref: `palette.${string}`;
}

/** Whether this shape is drawn as a filled silhouette rather than a stroke.
 *
 *  Font Awesome's free glyphs are filled paths and Lucide's and Lineicons' are
 *  stroked ones; which is which is the SVG's own answer, so the paint follows
 *  it rather than a per-source table that would go wrong the day a set changes
 *  style. */
function isFilled(shape: FabricObject): boolean {
  const fill = shape.fill;
  return Boolean(fill) && fill !== "none" && fill !== "transparent";
}

/** The SVG's shapes, carrying the theme's ink.
 *
 *  An icon is imported as geometry, not as a picture: a `FabricImage` of an SVG
 *  bakes `currentColor` into black (invisible on a dark theme) and can take
 *  neither a paint token nor a stroke width. A path takes both, and the scene
 *  stays editable — the starter theme's icons are paths for the same reason.
 *
 *  Fabric's own SVG parser owns the command grammar (arcs, ellipses, groups),
 *  so a set whose glyphs use a shape Lucide never emits still imports. */
export async function iconShapes(
  svg: string,
  ink: IconInk,
): Promise<readonly FabricObject[]> {
  const parsed = await loadSVGFromString(svg);
  const shapes = parsed.objects.filter(
    (object): object is FabricObject => object !== null,
  );

  for (const shape of shapes) {
    if (isFilled(shape)) {
      shape.set("fill", ink.color);
      shape.set(YUNARI_PAINT_PROPERTY, { fill: ink.ref });
    } else {
      shape.set("fill", null);
      shape.set("stroke", ink.color);
      shape.set(YUNARI_PAINT_PROPERTY, { stroke: ink.ref });
    }
  }

  return shapes;
}

/** One object for the whole glyph: the path itself, or a group of them.
 *
 *  Lucide draws a glyph in several subpaths and Font Awesome in one, so a
 *  multi-path icon arrives as a group rather than as loose objects an author
 *  would have to select together. */
export function iconObject(
  shapes: readonly FabricObject[],
  name: string,
  id: string,
): FabricObject {
  // Every object the scene holds needs its own id — the document's validator
  // refuses one without — so a glyph's subpaths are numbered under the glyph's
  // own id rather than left blank by the SVG parser.
  shapes.forEach((shape, index) => {
    shape.set("name", name);
    shape.set("id", `${id}-${index + 1}`);
  });

  const object =
    shapes.length === 1 ? (shapes[0] as FabricObject) : new Group([...shapes]);
  object.set("name", name);
  object.set("id", id);
  return object;
}

/** Centred on the artboard and sized as a share of its shorter edge.
 *
 *  An SVG's own size is its viewBox — 24 units for Lucide, 512 for a Font
 *  Awesome glyph — which places a postage stamp in a corner. The imported icon
 *  is a new object on the canvas, so it takes a size relative to the frame the
 *  way every other object does. */
export function placeIcon(
  object: FabricObject,
  artboard: { readonly width: number; readonly height: number },
  share: number,
): void {
  const box = Math.min(artboard.width, artboard.height) * share;
  const scale = box / Math.max(object.width, object.height, 1);

  object.set({
    scaleX: scale,
    scaleY: scale,
    originX: "left",
    originY: "top",
    left: (artboard.width - object.width * scale) / 2,
    top: (artboard.height - object.height * scale) / 2,
  });
  object.setCoords();
}
