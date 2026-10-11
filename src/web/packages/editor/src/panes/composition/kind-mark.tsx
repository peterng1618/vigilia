import {
  CHART_BAR_GLYPH,
  CHART_GAUGE_GLYPH,
  CHART_LINE_GLYPH,
  CHART_PIE_GLYPH,
  Glyph,
  type LucideIcon,
  STACK_GLYPH,
} from "../../editor-shell/icons.js";
import type { LayerMark } from "../../editor-shell/layer-tree.js";

/**
 * A chart's family mark, one icon per family the document can name.
 *
 * The old column said "chart" to every chart, which is the word a card of eight
 * charts repeats eight times and the one thing an author scanning for the ring
 * cannot use. `ChartColumn` is the fallback for a family this build does not
 * know, so the row still says what it is rather than what it is not.
 */
const CHART_ICONS: Readonly<Record<string, LucideIcon>> = {
  gauge: CHART_GAUGE_GLYPH,
  line: CHART_LINE_GLYPH,
  bar: CHART_BAR_GLYPH,
  pie: CHART_PIE_GLYPH,
};
const CHART_FALLBACK: LucideIcon = CHART_BAR_GLYPH;

/**
 * The glyph a chart family wears, wherever one is drawn.
 *
 * One owner, because two surfaces draw these four: the layer row's mark and the
 * Add pane's tile. A family that wore a gauge in the row and a column on the
 * tile would be two answers to one question, and the author would have to learn
 * both. A family this build does not know draws the fallback, so a mark still
 * says what it is rather than what it is not.
 */
export function chartFamilyGlyph(family: string | undefined): LucideIcon {
  return family === undefined
    ? CHART_FALLBACK
    : (CHART_ICONS[family] ?? CHART_FALLBACK);
}

/**
 * The kind, drawn as the thing rather than as a mark for the thing.
 *
 * A text row says its own words in its own face, so one glance answers both
 * "what is it" and "what does it say"; a chart names its family; a shape shows
 * the paint it fills with; an image shows its own picture. A group draws the
 * stack glyph — a generic mark for an arbitrary container, never a diagram of
 * the things it happens to hold, which is §5.1's correction made structural.
 *
 * A row whose runs are all value runs therefore shows nothing here: it has no
 * words of its own, and the bound column beside this one says what it reads.
 *
 * Every arm sits in one fixed-width slot, which is what lines the names up. A
 * group still takes the slot rather than collapsing it, so an eight-card
 * document has its rows in one column rather than two ragged ones.
 *
 * `data-vigilia-layer-mark` names which arm drew, so a browser case can measure
 * the treatment rather than infer it from the icon's class.
 */
export function KindMark({
  mark,
}: {
  readonly mark: LayerMark;
}): React.JSX.Element {
  return <span className="vigilia-layer-mark">{treatment(mark)}</span>;
}

/** The five arms, and which of them is a glyph: `chart` draws the family's icon
 *  and `group` the kind's generic stack glyph; `text`, `shape` and `image` are
 *  depictions a glyph cannot carry — the words in the object's own face, its
 *  paint, its picture. This split is decided here, not by `icons.ts`'s
 *  `KIND_GLYPHS`, which closes the vocabulary over the kinds and is drawn by no
 *  arm of this switch. */
function treatment(mark: LayerMark): React.JSX.Element | null {
  switch (mark.kind) {
    case "text":
      return (
        <span
          data-vigilia-layer-mark="text"
          className="vigilia-layer-sample"
          // The face is the object's own, not a panel default: a row that all
          // wore the shell's face would say nothing about the type it names.
          style={{
            fontFamily: mark.family,
            fontWeight: mark.weight,
          }}
          title={mark.text}
        >
          {mark.text}
        </span>
      );
    case "chart": {
      const Icon = chartFamilyGlyph(mark.family);
      return (
        <span data-vigilia-layer-mark="chart" className="vigilia-layer-icon">
          <Glyph icon={Icon} size={13} />
        </span>
      );
    }
    case "shape":
      return (
        <span
          data-vigilia-layer-mark="shape"
          className="vigilia-layer-swatch"
          // A gradient or a pattern is a paint object, not a colour, and a 10px
          // swatch cannot show one honestly; the outline then stands alone.
          {...(mark.paint === undefined
            ? {}
            : { style: { background: mark.paint } })}
          aria-hidden
        />
      );
    case "image":
      return mark.src === undefined ? null : (
        <img
          data-vigilia-layer-mark="image"
          className="vigilia-layer-thumb"
          src={mark.src}
          alt=""
          aria-hidden
        />
      );
    // The group arm reads no member of `mark` and takes no children-derived
    // input: the same constant is drawn for every group, which is what keeps a
    // bespoke per-card diagram from growing back in behind a data field.
    case "group":
      return (
        <span data-vigilia-layer-mark="group" className="vigilia-layer-icon">
          <Glyph icon={STACK_GLYPH} size={13} />
        </span>
      );
  }
}
