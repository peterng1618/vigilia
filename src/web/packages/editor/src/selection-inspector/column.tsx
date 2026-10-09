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
import { ControlPair } from "../components/ui/control-pair.js";
import { ControlSegmented } from "../components/ui/control-segmented.js";
import { ControlSelect } from "../components/ui/control-select.js";
import { ControlSlider } from "../components/ui/control-slider.js";
import { ControlText } from "../components/ui/control-text.js";
import { ControlToggle } from "../components/ui/control-toggle.js";
import { InspectorSection } from "../components/ui/inspector-section.js";
import { uiCopy } from "../ui-copy.js";
import { CROP_ASPECTS } from "./crop.js";
import { rendersExtra } from "./per-kind-column.js";
import { RunEditor } from "./runs.js";
import type {
  ColumnSectionView,
  CropEdits,
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
  // A `note` carries no refusal; a guard rather than a cast keeps the union
  // honest as arms are added.
  const refused =
    field.control !== "note" && field.refused !== undefined
      ? { refused: field.refused }
      : {};

  switch (field.control) {
    case "text":
      return (
        <ControlText
          label={field.label}
          data={field.data}
          value={field.value}
          onCommit={(value) => commit(value)}
          {...(field.multiline === undefined
            ? {}
            : { multiline: field.multiline })}
          {...(field.rows === undefined ? {} : { rows: field.rows })}
          {...refused}
        />
      );
    case "pair":
      return (
        <ControlPair
          label={field.label}
          halves={field.halves.map((half) => ({
            label: half.label,
            value: half.value,
            data: half.data,
            ...(half.integer === undefined ? {} : { integer: half.integer }),
            onCommit: (value: number) => edits.commit(revision, half.id, value),
          }))}
        />
      );
    case "note":
      // A line of prose, not a control: no well, because a border means
      // editable (bible §5.1). The hook is on the value element itself.
      return (
        <p className="text-xs text-muted" {...field.data}>
          {field.value}
        </p>
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

/**
 * The crop row: start a session, or — while one is open — lock a ratio and
 * apply or abandon it. The session is `crop-manager`'s and React holds only its
 * state, so the buttons drive `CropEdits` and the drag stays Fabric's.
 *
 * The buttons carry the same `data-vigilia-crop*` hooks the imperative row did,
 * because the suites read them by hook rather than by their visible word.
 */
function CropRow(props: {
  readonly view: { readonly active: boolean; readonly canStart: boolean };
  readonly edits: CropEdits;
}): React.JSX.Element | null {
  const { view, edits } = props;
  if (view.active) {
    return (
      <div className="flex flex-wrap items-center gap-[var(--space-6)]">
        {CROP_ASPECTS.map(([label, ratio]) => (
          <button
            key={label}
            type="button"
            data-vigilia-crop-aspect={label}
            className="rounded-md border border-edge bg-panel-2 px-[var(--space-6)] text-xs text-text"
            onClick={() => edits.setAspect(ratio)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          data-vigilia-crop-apply=""
          className="rounded-md border border-edge bg-panel-2 px-[var(--space-6)] text-xs text-text"
          onClick={() => edits.apply()}
        >
          {uiCopy.inspectorFields.cropApply}
        </button>
        <button
          type="button"
          data-vigilia-crop-cancel=""
          className="rounded-md border border-edge bg-panel-2 px-[var(--space-6)] text-xs text-text"
          onClick={() => edits.cancel()}
        >
          {uiCopy.inspectorFields.cropCancel}
        </button>
      </div>
    );
  }

  if (!view.canStart) return null;
  return (
    <div className="flex items-center gap-[var(--space-6)]">
      <button
        type="button"
        data-vigilia-crop=""
        className="rounded-md border border-edge bg-panel-2 px-[var(--space-6)] text-xs text-text"
        onClick={() => edits.begin()}
      >
        {uiCopy.inspectorFields.crop}
      </button>
    </div>
  );
}

function Section(props: {
  readonly section: ColumnSectionView;
  readonly edits: SelectionEdits;
  readonly runs: RunEdits;
  readonly chart: ChartEdits;
  readonly crop: CropEdits;
  readonly revision: number;
  readonly idPrefix: string;
}): React.JSX.Element {
  const { section, edits, runs, chart, crop, revision, idPrefix } = props;

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
      {section.extras.filter(rendersExtra).map((extra) => {
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
          case "crop":
            return (
              <CropRow
                key={`${revision}:crop`}
                view={extra.crop}
                edits={crop}
              />
            );
          default:
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
  readonly crop: CropEdits;
}): React.JSX.Element {
  const { view, edits, runs, chart, crop } = props;
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
          crop={crop}
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
    crop: CropEdits,
  ) => void;
  readonly destroy: () => void;
} {
  const root: Root = createRoot(host);

  return {
    publish(view, edits, runs, chart, crop) {
      flushSync(() => {
        root.render(
          <SelectionColumn
            view={view}
            edits={edits}
            runs={runs}
            chart={chart}
            crop={crop}
          />,
        );
      });
    },
    destroy() {
      root.unmount();
    },
  };
}
