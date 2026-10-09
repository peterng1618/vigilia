import type {
  Binding,
  FabricGlobals,
  FabricPalette,
  SampleSource,
  TextRun,
} from "@vigilia/renderer-core";
import {
  describeSemanticKey,
  formatInstant,
  instantIn,
  knownTimeZones,
  SEMANTIC_KEYS,
} from "@vigilia/renderer-core";
import type * as React from "react";
import { useState } from "react";
import { ControlSegmented } from "../components/ui/control-segmented.js";
import { ControlSelect } from "../components/ui/control-select.js";
import { ControlSwatch } from "../components/ui/control-swatch.js";
import { ControlText } from "../components/ui/control-text.js";
import {
  ControlRow,
  ControlWell,
  useControlIds,
} from "../components/ui/control-well.js";
import { uiCopy } from "../ui-copy.js";
import {
  authoredContentOf,
  type ObjectWithText,
  textRunsOf,
} from "./authored-text.js";
import type { RunEdits, RunOptionView, RunRowView, RunsView } from "./view.js";

/**
 * Styled runs of a text object (§89): a value, its unit and its label may each
 * carry a different preset and colour. The model already represents this — a
 * run has its own `typePreset` and `style` map — so this is the authoring
 * surface, not a format change.
 *
 * React renders a projected `RunsView` and writes through `RunEdits`; it holds
 * no Fabric object and rebuilds no DOM. The reads that used to walk the object
 * on every render are `projectRuns` below, which returns the same plain value
 * whatever the object is.
 */

/** The read context `projectRuns` needs; the write half is `RunEdits`. */
export interface RunsProjection {
  readonly globals: FabricGlobals | undefined;
  readonly locale: string | undefined;
  readonly nodeBindings: ((nodeId: string) => readonly Binding[]) | undefined;
  readonly sampleSource: (() => SampleSource) | undefined;
  /**
   * What a palette reference resolves to, for a swatch. Passed in rather than
   * imported so this module does not reach back into `appearance.ts`, which
   * reads `textRunsOf` from here.
   */
  readonly swatchValue: (ref: string) => string | undefined;
}

/** A run's description for a list: what it is, and what it says. */
export function describeRun(run: TextRun): string {
  if (run.kind === "value") {
    return `${uiCopy.inspectorFields.valueRun} (${run.bindingId})`;
  }

  const text = run.text.trim();
  return text.length === 0
    ? uiCopy.inspectorFields.emptyRun
    : text.length > 24
      ? `${text.slice(0, 24)}…`
      : text;
}

/**
 * The palette tokens a run's colour may reference, each under its stored
 * reference and the name its author gave it.
 *
 * The name, not the id, for the reason `presetOptions` gives: the palette panel,
 * `panel.ts` and `chart-manager` all print the authored name, and printing `cpu`
 * here put the same tokens in the run editor under a second vocabulary.
 */
function paletteOptions(globals: FabricGlobals | undefined): readonly {
  readonly id: string;
  readonly name: string;
  readonly ref: string;
}[] {
  return Object.entries((globals?.palette as FabricPalette | undefined) ?? {})
    .filter(([id]) => id !== "none")
    .map(([id, entry]) => ({
      id: `palette.${id}`,
      name: entry.name,
      ref: `palette.${id}`,
    }));
}

/**
 * The type presets a run may reference, each under its stored reference and the
 * name its author gave it.
 *
 * The name, not the id, because every other reference picker in the editor names
 * what it offers — printing `24-400` here put thirteen presets in the inspector
 * under one vocabulary and the same thirteen, one field lower, under another.
 */
function presetOptions(
  globals: FabricGlobals | undefined,
): readonly RunOptionView[] {
  return Object.entries(globals?.typePresets ?? {}).map(([id, entry]) => ({
    id: `typePresets.${id}`,
    name: entry.name,
  }));
}

/**
 * The runs whose tracking the object cannot carry separately.
 *
 * Fabric measures spacing once, from the object, so only the first run's preset
 * reaches the screen. A later run asking for the *same* value loses nothing, so
 * it is not a gap — matching the model rather than "any letterSpacing" is what
 * keeps this from warning about a run that is already painted as asked.
 */
function presetGaps(
  globals: FabricGlobals | undefined,
  runs: readonly TextRun[],
): readonly string[] {
  const painted = letterSpacingOf(globals, runs[0]?.typePreset);
  const gaps = new Set<string>();
  for (const run of runs.slice(1)) {
    const spacing = letterSpacingOf(globals, run.typePreset);
    if (spacing === undefined || spacing === painted) continue;
    gaps.add(
      uiCopy.inspectorFields.runTrackingNotSeparate(run.typePreset ?? ""),
    );
  }
  return [...gaps];
}

/** A preset's authored tracking, or undefined when it asks for none. */
function letterSpacingOf(
  globals: FabricGlobals | undefined,
  ref: `typePresets.${string}` | undefined,
): number | undefined {
  const id = ref?.slice("typePresets.".length);
  const value: unknown = (
    globals?.typePresets?.[id ?? ""]?.value as
      | { readonly letterSpacing?: unknown }
      | undefined
  )?.letterSpacing;
  return typeof value === "number" ? value : undefined;
}

/**
 * What a value run is bound to, and whether anything is arriving.
 *
 * The canvas paints the reading, so a run that names nothing and a run whose
 * sensor is missing look the same on it — both show the em dash. Three states
 * have to stay apart here, because two of them need a different fix: a run that
 * names a binding this object does not declare, a run that is declared and has
 * no reading yet, and a run that is simply working.
 */
function bindingStateOf(
  run: Extract<TextRun, { kind: "value" }>,
  bound: Binding | undefined,
  source: (() => SampleSource) | undefined,
): { readonly note: string; readonly problem?: "undeclared" | "unmapped" } {
  if (bound === undefined) {
    return {
      note: uiCopy.inspectorFields.runUndeclared(run.bindingId),
      problem: "undeclared",
    };
  }

  if (source?.().latest(bound.semanticKey) === undefined) {
    return {
      note: uiCopy.inspectorFields.runUnmapped(bound.semanticKey),
      problem: "unmapped",
    };
  }

  return { note: uiCopy.inspectorFields.runBinding(bound.semanticKey) };
}

/**
 * The run editor's inputs, projected from the object.
 *
 * `undefined` when the object carries no authored text at all: a run editor with
 * nothing in it is an empty box, not a control, so the section does not hold one
 * and its count does not count one.
 */
export function projectRuns(
  object: ObjectWithText,
  nodeId: string,
  context: RunsProjection,
): RunsView | undefined {
  const content = authoredContentOf(object);
  if (content === undefined) return undefined;

  const runs = textRunsOf(object);
  const presets = presetOptions(context.globals);
  const palettes = paletteOptions(context.globals);
  const bindable = nodeId.length > 0;
  const bindings = bindable ? (context.nodeBindings?.(nodeId) ?? []) : [];

  const pinnedZones: string[] = [];
  // A run has no id of its own, so the row's identity is what the run *is*, and
  // an index would only be stable while rows were appended or removed last.
  //
  // **The run's text is deliberately not part of it.** A text run is the one
  // field a person types into continuously, and `ControlText` commits on Enter
  // as well as blur — identity that moved with the text would remount the row
  // under the caret on every Enter, which is the common path, and React's own
  // focus does not survive a remount. Where it does move (a preset or source
  // change remounts that row) the cost is one lost caret on a discrete act.
  //
  // The residual, named rather than hidden: a truly edit-stable key needs a run
  // id, and the persisted run model has none — adding one is a schema change
  // this task does not own. So two literal runs sharing a type preset are the
  // same identity, and a middle removal can still shift them (the counter below
  // is what keeps their *rows* distinct, and it is positional). That is
  // narrower than index keys, which shift on every removal.
  const seen = new Map<string, number>();
  const rows = runs.map((run, index) => {
    const bound =
      run.kind === "value"
        ? bindings.find((binding) => binding.id === run.bindingId)
        : undefined;
    const colour =
      (run.style?.["color"] as { readonly ref?: string } | undefined)?.ref ??
      palettes[0]?.ref ??
      "";
    const identity =
      run.kind === "value"
        ? `value:${run.bindingId}`
        : `literal:${run.typePreset ?? ""}`;
    const repeat = seen.get(identity) ?? 0;
    seen.set(identity, repeat + 1);

    const row: {
      id: string;
      index: number;
      kind: "literal" | "value";
      label: string;
      text: string;
      typePreset: string;
      colour: string;
      bindingId: string;
      sourceKey: string;
      unitDisplay: string;
      bindingNote?: string;
      bindingProblem?: "undeclared" | "unmapped";
      format?: string;
      formatDefault?: string;
      zone?: string;
    } = {
      id: repeat === 0 ? identity : `${identity}#${repeat}`,
      index,
      kind: run.kind,
      label: describeRun(run),
      text: run.kind === "literal" ? run.text : "",
      typePreset: run.typePreset ?? presets[0]?.id ?? "",
      colour,
      // The binding the run names, as the note's own hook carried it before the
      // column was React (`run.bindingId`, not the row's ordinal): the ordinal
      // is `index` and rides `data-vigilia-run`.
      bindingId: run.kind === "value" ? run.bindingId : "",
      sourceKey: bound?.semanticKey ?? "",
      unitDisplay: run.kind === "value" ? (run.unitDisplay ?? "") : "",
    };

    if (bindable) {
      if (run.kind === "value") {
        const state = bindingStateOf(run, bound, context.sampleSource);
        row.bindingNote = state.note;
        if (state.problem !== undefined) row.bindingProblem = state.problem;
      }
      const instant = describeSemanticKey(bound?.semanticKey ?? "")?.instant;
      if (bound !== undefined && instant !== undefined) {
        row.format = bound.format ?? "";
        row.formatDefault = instant.defaultFormat ?? "";
        row.zone = bound.timeZone ?? "";
        const pinned = bound.timeZone;
        if (
          pinned !== undefined &&
          pinned.length > 0 &&
          !pinnedZones.includes(pinned)
        ) {
          pinnedZones.push(pinned);
        }
      }
    }

    return row;
  });

  const zones = knownTimeZones();
  const withPinned = [
    ...pinnedZones.filter((zone) => !zones.includes(zone)),
    ...zones,
  ];

  const swatchValues: Record<string, string> = {};
  for (const option of palettes) {
    const value = context.swatchValue(option.ref);
    if (value !== undefined) swatchValues[option.ref] = value;
  }

  return {
    nodeId,
    runs: rows,
    layout: {
      align: typeof content["align"] === "string" ? content["align"] : "left",
      verticalAlign:
        typeof content["verticalAlign"] === "string"
          ? content["verticalAlign"]
          : "top",
      wrap: content["wrap"] === false ? "nowrap" : "wrap",
      overflow:
        typeof content["overflow"] === "string" ? content["overflow"] : "clip",
    },
    presets,
    palettes: palettes.map(({ id, name }) => ({ id, name })),
    swatchValues,
    unitOptions: Object.entries(uiCopy.unitDisplayOptions).map(
      ([id, name]) => ({
        id,
        name,
      }),
    ),
    sources: [
      { id: "", name: uiCopy.inspectorFields.staticText },
      ...SEMANTIC_KEYS.map((descriptor) => ({
        id: descriptor.key,
        name: descriptor.label,
      })),
    ],
    zones: withPinned,
    bindable,
    removable: runs.length > 1,
    locale: context.locale,
    notes: presetGaps(context.globals, runs),
  };
}

const ALIGN_OPTIONS = [
  { id: "left", name: uiCopy.inspectorFields.left },
  { id: "center", name: uiCopy.inspectorFields.centre },
  { id: "right", name: uiCopy.inspectorFields.right },
];

const VERTICAL_OPTIONS = [
  { id: "top", name: uiCopy.inspectorFields.verticalTop },
  { id: "middle", name: uiCopy.inspectorFields.verticalMiddle },
  { id: "bottom", name: uiCopy.inspectorFields.verticalBottom },
];

const WRAP_OPTIONS = [
  { id: "wrap", name: uiCopy.inspectorFields.on },
  { id: "nowrap", name: uiCopy.inspectorFields.off },
];

const OVERFLOW_OPTIONS = [
  { id: "clip", name: uiCopy.inspectorFields.clip },
  { id: "ellipsis", name: uiCopy.inspectorFields.ellipsis },
  { id: "visible", name: uiCopy.inspectorFields.overflowVisible },
];

const ZONE_FOLLOWS = { id: "", name: uiCopy.inspectorFields.runZoneFollows };

/** The zone list as options: "follow the display" first, then every pinned zone. */
function zoneOptions(view: RunsView): readonly RunOptionView[] {
  return [
    ZONE_FOLLOWS,
    ...view.zones.map((zone) => ({ id: zone, name: zone })),
  ];
}

/**
 * The reading a format pattern produces now, from the same preview source the
 * editor's own preview reads. Live as the author types, because a token that
 * renders itself is visible only here and on a wall display where they are not.
 */
function previewOf(
  semanticKey: string,
  pattern: string,
  zone: string | undefined,
  locale: string | undefined,
): string {
  const instant = describeSemanticKey(semanticKey)?.instant;
  const shown = pattern === "" ? (instant?.defaultFormat ?? "") : pattern;
  // An unpinned zone is the display's own, which the formatter spells as no
  // zone at all; "" is a valid option id and not a valid IANA name.
  const pinned = zone === undefined || zone === "" ? undefined : zone;
  return (
    formatInstant(instantIn(Date.now()), shown, pinned, locale) ??
    uiCopy.inspectorFields.unresolved
  );
}

/**
 * The format field with its live preview and its token vocabulary.
 *
 * Bespoke rather than `ControlText` because the preview must follow the draft as
 * it is typed, and a committed-only control has no draft to read. The well is
 * still `ControlWell`, so the row is the same shape as every other.
 */
function RunFormatField(props: {
  readonly index: number;
  readonly format: string;
  readonly formatDefault: string;
  readonly semanticKey: string;
  readonly zone: string | undefined;
  readonly locale: string | undefined;
  readonly onCommit: (format: string) => void;
}): React.JSX.Element {
  const { index, format, formatDefault, semanticKey, zone, locale } = props;
  const ids = useControlIds(`vigilia-run-format-${index}`);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? format;

  const commit = (): void => {
    const next = draft ?? format;
    setDraft(null);
    if (next !== format) props.onCommit(next);
  };

  return (
    <>
      <ControlRow
        ids={ids}
        label={uiCopy.inspectorFields.runFormat}
        labelFor={ids.control}
      >
        <ControlWell>
          <input
            id={ids.control}
            type="text"
            data-vigilia-run-format={String(index)}
            maxLength={64}
            placeholder={formatDefault}
            className="h-full w-full bg-transparent text-sm text-text outline-none"
            value={shown}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              }
              if (event.key === "Escape" && draft !== null) {
                event.preventDefault();
                setDraft(null);
              }
            }}
            onBlur={commit}
          />
        </ControlWell>
      </ControlRow>
      <span
        className="vigilia-run-preview text-xs text-muted"
        data-vigilia-run-format-preview={String(index)}
      >
        {previewOf(semanticKey, shown, zone, locale)}
      </span>
      <p
        className="vigilia-run-note text-xs text-faint"
        data-vigilia-run-format-hint={String(index)}
      >
        {uiCopy.inspectorFields.runFormatTokens}
      </p>
    </>
  );
}

/** One run: its text, its preset, its colour, and what it reads. */
function RunRow(props: {
  readonly row: RunRowView;
  readonly view: RunsView;
  readonly edits: RunEdits;
}): React.JSX.Element {
  const { row, view, edits } = props;
  const index = row.index;

  return (
    <section
      data-vigilia-run={String(index)}
      className="flex flex-col gap-[var(--space-6)]"
    >
      <p className="vigilia-run-label text-xs text-muted">{row.label}</p>

      {row.kind === "literal" ? (
        <ControlText
          label={uiCopy.inspectorFields.runText}
          data={{ "data-vigilia-run-text": String(index) }}
          value={row.text}
          onCommit={(text) => edits.setRunText(index, text)}
        />
      ) : null}

      <ControlSelect
        label={uiCopy.inspectorFields.runPreset}
        data={{ "data-vigilia-run-preset": String(index) }}
        value={row.typePreset}
        options={view.presets}
        onChange={(ref) => edits.setRunPreset(index, ref)}
      />

      <ControlSwatch
        label={uiCopy.inspectorFields.runColour}
        data={{ "data-vigilia-run-colour": String(index) }}
        value={row.colour}
        options={view.palettes}
        swatch={
          <span
            aria-hidden
            className="block size-[10px] rounded-sm border border-edge"
            style={{ background: colourValueOf(view, row.colour) }}
          />
        }
        onChange={(ref) => edits.setRunColour(index, ref)}
      />

      {view.bindable ? (
        <ControlSelect
          label={uiCopy.inspectorFields.runSource}
          data={{ "data-vigilia-run-source": String(index) }}
          value={row.sourceKey}
          options={view.sources}
          onChange={(key) => edits.setSource(index, key)}
        />
      ) : null}

      {view.bindable && row.kind === "value" ? (
        <>
          <p
            className="vigilia-run-note text-xs text-muted"
            data-vigilia-run-binding={row.bindingId}
            {...(row.bindingProblem === undefined
              ? {}
              : { "data-vigilia-run-problem": row.bindingProblem })}
          >
            {row.bindingNote}
          </p>
          <ControlSelect
            label={uiCopy.panels.unitDisplay}
            data={{ "data-vigilia-run-unit-display": String(index) }}
            value={row.unitDisplay}
            options={view.unitOptions}
            onChange={(value) => edits.setUnitDisplay(index, value)}
          />
        </>
      ) : null}

      {row.format !== undefined &&
      row.formatDefault !== undefined &&
      row.zone !== undefined ? (
        <>
          <RunFormatField
            index={index}
            format={row.format}
            formatDefault={row.formatDefault}
            semanticKey={row.sourceKey}
            zone={row.zone}
            locale={view.locale}
            onCommit={(format) => edits.setFormat(index, format)}
          />
          <ControlSelect
            label={uiCopy.inspectorFields.runZone}
            data={{ "data-vigilia-run-zone": String(index) }}
            value={row.zone}
            options={zoneOptions(view)}
            onChange={(zone) => edits.setZone(index, zone)}
          />
        </>
      ) : null}

      {view.removable ? (
        <button
          type="button"
          data-vigilia-run-remove={String(index)}
          className="self-start text-xs text-muted"
          onClick={() => edits.removeRun(index)}
        >
          {uiCopy.inspectorFields.removeRun(index + 1)}
        </button>
      ) : null}
    </section>
  );
}

/** The resolved colour a swatch shows, or `transparent` when it no longer resolves. */
function colourValueOf(view: RunsView, ref: string): string {
  return view.swatchValues[ref] ?? "transparent";
}

/**
 * The run editor: the layout controls, one row per run, and the add button.
 *
 * The caret rule the imperative editor needed `focusedControl`/`restoreFocus`
 * for is React's own here: the rows key on their index and the values are props,
 * so a re-publish updates the focused input rather than replacing it, and a
 * checkbox never regains focus it was not holding. See `index.ts`.
 */
export function RunEditor(props: {
  readonly runs: RunsView;
  readonly edits: RunEdits;
}): React.JSX.Element {
  const { runs: view, edits } = props;

  return (
    <div data-vigilia-runs="" className="flex flex-col gap-[var(--space-6)]">
      <h3 className="m-0 text-xs font-semibold text-muted">
        {uiCopy.inspectorFields.runs}
      </h3>

      <ControlSegmented
        label={uiCopy.inspectorFields.align}
        data={{ "data-vigilia-text-align": "" }}
        value={view.layout.align}
        options={ALIGN_OPTIONS}
        onChange={(align: string) => edits.writeLayout({ align })}
      />
      <ControlSegmented
        label={uiCopy.inspectorFields.verticalAlign}
        data={{ "data-vigilia-text-vertical-align": "" }}
        value={view.layout.verticalAlign}
        options={VERTICAL_OPTIONS}
        onChange={(verticalAlign: string) =>
          edits.writeLayout({ verticalAlign })
        }
      />
      <ControlSegmented
        label={uiCopy.inspectorFields.wrap}
        data={{ "data-vigilia-text-wrap": "" }}
        value={view.layout.wrap}
        options={WRAP_OPTIONS}
        onChange={(wrap: string) =>
          edits.writeLayout({ wrap: wrap === "wrap" })
        }
      />
      <ControlSegmented
        label={uiCopy.inspectorFields.overflow}
        data={{ "data-vigilia-text-overflow": "" }}
        value={view.layout.overflow}
        options={OVERFLOW_OPTIONS}
        onChange={(overflow: string) => edits.writeLayout({ overflow })}
      />

      {view.runs.map((row) => (
        <RunRow key={row.id} row={row} view={view} edits={edits} />
      ))}

      <button
        type="button"
        data-vigilia-run-add=""
        className="self-start text-xs text-muted"
        onClick={() => edits.addRun()}
      >
        {uiCopy.inspectorFields.addRun}
      </button>

      {view.notes.map((note) => (
        <p
          key={note}
          className="vigilia-run-note text-xs text-muted"
          data-vigilia-run-note=""
        >
          {note}
        </p>
      ))}
    </div>
  );
}
