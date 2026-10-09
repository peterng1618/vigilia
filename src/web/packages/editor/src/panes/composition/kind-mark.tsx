import {
  ChartColumn,
  ChartLine,
  ChartPie,
  Gauge,
  type LucideIcon,
} from "lucide-react";
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
  gauge: Gauge,
  line: ChartLine,
  bar: ChartColumn,
  pie: ChartPie,
};
const CHART_FALLBACK: LucideIcon = ChartColumn;

/** The generic glyph a group draws (bible §6, §5.1). A card on the canvas is an
 *  arbitrary group of elements, so its row cannot depict it; the stack is the
 *  one word the rail already uses for the scene tree, drawn from the mockup's
 *  own two paths at the shell's stroke weight rather than a second icon family. */
const STACK_PATHS: readonly string[] = [
  "M12 3 3 8l9 5 9-5-9-5Z",
  "m3 13 9 5 9-5",
];

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
      const Icon =
        mark.family === undefined
          ? CHART_FALLBACK
          : (CHART_ICONS[mark.family] ?? CHART_FALLBACK);
      return (
        <span data-vigilia-layer-mark="chart" className="vigilia-layer-icon">
          <Icon aria-hidden size={13} strokeWidth={1.75} />
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
          <svg
            aria-hidden
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {STACK_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
        </span>
      );
  }
}
