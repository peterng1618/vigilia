import { Fragment, useEffect, useRef } from "react";
import { tooltip } from "../../editor-shell/controls/tooltip.js";
import { Glyph, glyphStrokeWidth } from "../../editor-shell/icons.js";
import type { ShapeKind } from "../../new-object-defaults.js";
import type { InsertableObject, InsertGroup } from "../../new-object-panel.js";
import { chartFamilyGlyph } from "../composition/kind-mark.js";
import { CARD_DIAGRAMS } from "./card-diagrams.js";

/**
 * The Add pane's body: `insertGroups()`, drawn as tiles, and the file path the
 * caller hands in at the foot.
 *
 * **The list is not re-derived here.** The pane renders the groups it is given,
 * in the order it is given them, and the shape of the drawing follows from that
 * alone: Cards, then Text (which the owner leaves ungrouped), then Shapes, then
 * Charts. A group added to the owner appears here the day it is added, and one
 * this pane invented could not be reached at all — the construction routes back
 * through the owner's own `insertObject`, which is what keeps the eligibility
 * gates and the refusals in one place.
 *
 * **A card unit is depicted; a primitive is its kind.** §5.2's distinction: the
 * library is a fixed set of eight, so a unit's tile may carry a diagram of what
 * it builds; a primitive's tile is the kind and nothing more. A card on the
 * canvas is still arbitrary, so nothing here licenses a diagram in the layer
 * tree.
 *
 * The element contracts the imperative panel carried are on the tile's own
 * button: `data-vigilia-panel-add="<shape>"` and
 * `data-vigilia-panel-card="<card id>"`. `data-vigilia-panel="add"` is the
 * pane's, written by `Pane`, and is deliberately not written again here.
 */
export function AddPane({
  groups,
  onInsert,
  children,
}: {
  readonly groups: readonly InsertGroup[];
  readonly onInsert: (object: InsertableObject) => void;
  /** What sits below the insert grid. The pane places it; it does not own it. */
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      {groups.map((group) => {
        const tiles = group.objects.map((object) => (
          <InsertTile
            key={tileKey(object)}
            object={object}
            onInsert={onInsert}
          />
        ));
        // An object that stands on its own keeps its place in the owner's order
        // and carries no heading: it is not a group of one, and an eyebrow over
        // a single row would say a region exists where there is one thing. Its
        // key is derived from the owner's own objects, so two standalone groups
        // could not collide with one another whatever the owner emits.
        if (group.label === undefined) {
          return (
            <Fragment key={group.objects.map(tileKey).join(" ")}>
              {tiles}
            </Fragment>
          );
        }
        return (
          <fieldset key={group.label} className="vigilia-add-group">
            <legend className="vigilia-add-eyebrow">{group.label}</legend>
            <div className="vigilia-add-grid">{tiles}</div>
          </fieldset>
        );
      })}
      {children}
    </>
  );
}

/** One tile: the diagram or glyph, the name where a glyph alone would not say
 *  it, and the contract the surface is browsed by. */
function InsertTile({
  object,
  onInsert,
}: {
  readonly object: InsertableObject;
  readonly onInsert: (object: InsertableObject) => void;
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  // A card's and Text's names are on the tile; a shape's and a chart family's
  // are not. The *disclosure* follows the surface rather than the label's
  // presence, because a grid tile's label can clip — "Performance trends" is
  // 86px of text in a 41px box — and the tile that truncates is exactly the one
  // that must still be able to say its whole name (§6). The Text row is exempt:
  // it is full width, so its name never clips and a tooltip would repeat a word
  // already on screen.
  const named = object.kind === "card" || object.kind === "text";
  const disclosed = object.kind !== "text";
  useEffect(() => {
    const button = ref.current;
    if (button === null || !disclosed) return;
    return tooltip({ trigger: button, text: object.label }).destroy;
  }, [disclosed, object.label]);

  return (
    <button
      ref={ref}
      type="button"
      className={
        object.kind === "text" ? "vigilia-add-text" : "vigilia-add-tile"
      }
      aria-label={object.label}
      {...(object.kind === "shape"
        ? { "data-vigilia-panel-add": object.shape }
        : {})}
      {...(object.kind === "card"
        ? { "data-vigilia-panel-card": object.card }
        : {})}
      onClick={() => onInsert(object)}
    >
      {tileMark(object)}
      {named ? <span className="vigilia-add-label">{object.label}</span> : null}
    </button>
  );
}

/** What the tile draws: a unit's diagram, a primitive's kind, a family's glyph. */
function tileMark(object: InsertableObject): React.JSX.Element {
  switch (object.kind) {
    case "card": {
      const Diagram = CARD_DIAGRAMS[object.diagram];
      return <Diagram />;
    }
    case "shape": {
      const ShapeMark = SHAPE_GLYPHS[object.shape];
      return <ShapeMark />;
    }
    case "chart": {
      const Icon = chartFamilyGlyph(object.family);
      return <Glyph icon={Icon} size={20} />;
    }
    case "text":
      return <TextGlyph />;
  }
}

/** Keys are unique within one group's list, which is all React asks: the card
 *  ids, the shape kinds and the chart families never repeat inside a group. */
function tileKey(object: InsertableObject): string {
  switch (object.kind) {
    case "card":
      return `card:${object.card}`;
    case "shape":
      return `shape:${object.shape}`;
    case "chart":
      return `chart:${object.family}`;
    case "text":
      return "text";
  }
}

/**
 * Each primitive, drawn as the shape itself rather than as a mark for it.
 *
 * Total over `ShapeKind`, so a primitive added to the owner fails to compile
 * here until it is drawn. This is §6's own escape from the library, alongside
 * the card unit tile: a tile may carry a diagram of what it builds because the
 * set it draws from is fixed — `SHAPE_KINDS` for these, the eight-card library
 * for the units below — and the reference's shape grid (`shell.html:96-114`)
 * draws the same hand paths at the same weight. Lucide has no `wedge` or `arc`
 * to draw the last two with, so converting them would replace the drawing the
 * mockup is the authority for. The *weight* is still the vocabulary's, so a
 * shape tile sits inside the band with every chrome glyph.
 */
const SHAPE_GLYPHS: Readonly<
  Record<ShapeKind, (props: { readonly size?: number }) => React.JSX.Element>
> = {
  rect: ShapeGlyph(() => <rect x="4" y="5" width="16" height="14" rx="2" />),
  ellipse: ShapeGlyph(() => <ellipse cx="12" cy="12" rx="8" ry="6" />),
  polygon: ShapeGlyph(() => <path d="M12 4 20 19H4Z" />),
  polyline: ShapeGlyph(() => <path d="M4 17l4-6 4 4 4-8 4 5" />),
  line: ShapeGlyph(() => <path d="M5 18 19 6" />),
  path: ShapeGlyph(() => <path d="M4 18c5 0 6-12 12-12 3 0 4 2 4 4" />),
  arc: ShapeGlyph(() => <path d="M4 19a8 8 0 0 1 16 0" />),
  wedge: ShapeGlyph(() => <path d="M4 4v16h16A16 16 0 0 0 4 4Z" />),
};

/** The text tile's mark: the reference's own arrow-into-frame, for the one tile
 *  that makes an object with words in it rather than a shape. It is exempt for
 *  the same reason the shape tiles are — it draws the object it builds. */
const TextGlyph: (props: { readonly size?: number }) => React.JSX.Element =
  ShapeGlyph(() => <path d="M12 4H7v16h5M11 11h9M17 8l3 3-3 3" />);

/** One hand-authored tile mark on §6's 24px grid, at the vocabulary's weight.
 *  Named apart from `icons.ts`'s `Glyph` because it draws a path of its own
 *  rather than a library component. */
function ShapeGlyph(
  draw: () => React.ReactNode,
  defaultSize = 20,
): (props: { readonly size?: number }) => React.JSX.Element {
  return ({ size = defaultSize }) => (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={glyphStrokeWidth(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {draw()}
    </svg>
  );
}
