import type * as React from "react";
import { Fragment, useId } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { ChartEdits } from "../chart-manager/chart-fields.js";
import {
  ChartContentFields,
  ChartPaintFields,
} from "../chart-manager/chart-fields.js";
import { ControlNumber } from "../components/ui/control-number.js";
import { ControlSegmented } from "../components/ui/control-segmented.js";
import { ControlSelect } from "../components/ui/control-select.js";
import { ControlSlider } from "../components/ui/control-slider.js";
import { ControlText } from "../components/ui/control-text.js";
import { ControlToggle } from "../components/ui/control-toggle.js";
import { InspectorSection } from "../components/ui/inspector-section.js";
import { rendersExtra } from "./per-kind-column.js";
import { RunEditor } from "./runs.js";
import type {
  ColumnSectionView,
  FieldView,
  RunEdits,
  SelectionEdits,
  SelectionView,
} from "./view.js";

/**
 * The column's sections, as React.
 *
 * The sections come from the view and are rendered in the order it carries them:
 * this component sorts nothing, groups nothing and decides nothing about
 * emptiness. `perKindColumn` owns which questions a selection is asked and
 * `SETTINGS_SECTIONS` decides their order, so a column that re-ordered here
 * would be a second owner of Review Focus 2's rule.
 *
 * A section renders its own `fields` and `extras` — the rows that have moved to
 * React — and leaves `data-vigilia-section-body` for `index.ts` to mount the
 * still-imperative bodies into. That container empties as Tasks 4–6 convert the
 * remaining sections; React renders it empty and never touches the nodes
 * `index.ts` puts inside it, because React only moves the children it made.
 *
 * Every row is a plan-1 control carrying the field's own `data-*` hooks on its
 * focus target, so the locator a suite reads and the control a person operates
 * are the same element. Each edit goes through `SelectionEdits` with the
 * revision the view was projected from, so a control whose draft outlived its
 * selection is refused rather than writing an old value into a new object.
 *
 * The revision is also part of every row's key, and that is what discards a
 * draft when the selection moves: a row keyed by field id alone would be
 * reconciled onto the *next* object with the previous object's draft still in
 * its state, and the blur that followed a selection change would write it
 * there. The revision only moves when the described object changes, so a
 * re-publish of the same object keeps the row — and the caret — in place.
 */

/** The revision guard makes every write carry the view it was projected from. */
function fieldControl(
  field: FieldView,
  edits: SelectionEdits,
  revision: number,
): React.JSX.Element {
  const commit = (value: string | number | boolean): void => {
    edits.commit(revision, field.id, value);
  };
  const refused = field.refused === undefined ? {} : { refused: field.refused };

  switch (field.control) {
    case "text":
      return (
        <ControlText
          label={field.label}
          data={field.data}
          value={field.value}
          onCommit={(value) => commit(value)}
          {...refused}
        />
      );
    case "number":
      return (
        <ControlNumber
          label={field.label}
          data={field.data}
          value={field.value}
          onCommit={(value) => commit(value)}
          {...(field.min === undefined ? {} : { min: field.min })}
          {...(field.max === undefined ? {} : { max: field.max })}
          {...(field.unit === undefined ? {} : { unit: field.unit })}
          {...(field.integer === undefined ? {} : { integer: field.integer })}
          {...refused}
        />
      );
    case "toggle":
      return (
        <ControlToggle
          label={field.label}
          data={field.data}
          checked={field.checked}
          onChange={(value) => commit(value)}
          {...refused}
        />
      );
    case "select":
      return (
        <ControlSelect
          label={field.label}
          data={field.data}
          value={field.value}
          options={field.options}
          onChange={(value) => commit(value)}
          {...refused}
        />
      );
    case "segmented":
      return (
        <ControlSegmented
          label={field.label}
          data={field.data}
          value={field.value}
          options={field.options}
          onChange={(value) => commit(value)}
          {...refused}
        />
      );
    case "swatch":
      // The swatch's picture arrives with Task 5's paint fields, which carry the
      // resolved colour; the selection itself is the select's.
      return (
        <ControlSelect
          label={field.label}
          data={field.data}
          value={field.value}
          options={[]}
          onChange={(value) => commit(value)}
          {...refused}
        />
      );
    case "slider":
      return (
        <ControlSlider
          label={field.label}
          data={field.data}
          value={field.value}
          min={field.min}
          max={field.max}
          onCommit={(value) => commit(value)}
          {...refused}
        />
      );
    case "readOnly":
      // A read-only row is not a control: no well, no border, because a border
      // means editable (bible §5.1). Task 6 owns the Spends treatment.
      return (
        <div className="flex items-center gap-[var(--space-8)]" {...field.data}>
          <span className="text-xs text-muted">{field.label}</span>
          <span className="ml-auto font-mono text-sm text-text">
            {field.value}
          </span>
        </div>
      );
  }
}

function Section(props: {
  readonly section: ColumnSectionView;
  readonly edits: SelectionEdits;
  readonly runs: RunEdits;
  readonly chart: ChartEdits;
  readonly revision: number;
  readonly idPrefix: string;
}): React.JSX.Element {
  const { section, edits, runs, chart, revision, idPrefix } = props;

  return (
    <InspectorSection
      id={section.id}
      idPrefix={idPrefix}
      title={section.title}
      readOnly={section.readOnly}
      defaultOpen={section.defaultOpen}
      count={section.count}
    >
      {section.fields.map((field) => (
        <Fragment key={`${revision}:${field.id}`}>
          {fieldControl(field, edits, revision)}
        </Fragment>
      ))}
      {section.extras
        .filter(rendersExtra)
        .map((extra) => {
          switch (extra.kind) {
            case "runs":
              return (
                <RunEditor
                  key={`${revision}:runs`}
                  runs={extra.runs}
                  edits={runs}
                />
              );
            case "chartContent":
              // A chart's own questions, rendered by the owner that answers
              // them. The writes go through `ChartEdits`, not `SelectionEdits`:
              // a chart's commit rules are the chart's.
              return (
                <ChartContentFields
                  key={`${revision}:chartContent`}
                  view={extra.content}
                  edits={chart}
                />
              );
            case "chartPaint":
              return (
                <ChartPaintFields
                  key={`${revision}:chartPaint`}
                  view={extra.paint}
                  edits={chart}
                />
              );
            default:
              // `crop` — Task 4's, and `rendersExtra` does not admit it yet.
              return null;
          }
        })}
      <div data-vigilia-section-body="" />
    </InspectorSection>
  );
}

export function SelectionColumn(props: {
  readonly view: SelectionView;
  readonly edits: SelectionEdits;
  readonly runs: RunEdits;
  readonly chart: ChartEdits;
}): React.JSX.Element {
  const { view, edits, runs, chart } = props;
  // A column is one selection's, and two columns can be mounted at once (the
  // accessibility audit mounts two). `${id}-header` is document-global, so the
  // aria pair is scoped to this instance or the second column's `aria-controls`
  // resolves to the first column's panel.
  const idPrefix = useId();

  return (
    <>
      {view.sections.map((section) => (
        <Section
          key={section.id}
          section={section}
          edits={edits}
          runs={runs}
          chart={chart}
          revision={view.targetRevision}
          idPrefix={idPrefix}
        />
      ))}
    </>
  );
}

/**
 * The column's React root. `index.ts` publishes the projected view here and
 * mounts the imperative bodies into the containers this rendered, in that order.
 *
 * A publish is flushed synchronously, the same contract the subject's root keeps:
 * a caller that reads the column straight after a selection change sees it.
 */
export function createSelectionColumnRoot(host: HTMLElement): {
  readonly publish: (
    view: SelectionView,
    edits: SelectionEdits,
    runs: RunEdits,
    chart: ChartEdits,
  ) => void;
  readonly destroy: () => void;
} {
  const root: Root = createRoot(host);

  return {
    publish(view, edits, runs, chart) {
      flushSync(() => {
        root.render(
          <SelectionColumn
            view={view}
            edits={edits}
            runs={runs}
            chart={chart}
          />,
        );
      });
    },
    destroy() {
      root.unmount();
    },
  };
}
