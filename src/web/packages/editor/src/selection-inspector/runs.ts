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
import { applyAuthoredText } from "@vigilia/scene-fabric";
import type { EditorInteraction } from "../editor-interaction.js";
import { uiCopy } from "../ui-copy.js";

/**
 * Styled runs of a text object (§89): a value, its unit and its label may each
 * carry a different preset and colour. The model already represents this — a run
 * has its own `typePreset` and `style` map — so this is the authoring surface,
 * not a format change.
 *
 * Writes the object's persisted text content, then saves history once per
 * committed edit.
 */

const TEXT_PROPERTY = "vigiliaText";

interface ObjectWithText {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
}

/** The runs of a text object, or none when it is not a run-bearing object. */
export function textRunsOf(object: ObjectWithText): readonly TextRun[] {
  const content = object.get(TEXT_PROPERTY) as
    | { readonly runs?: readonly TextRun[] }
    | undefined;
  return content?.runs ?? [];
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
 * here put the same tokens in the run editor under a second vocabulary, one
 * field below the preset dropdown that had just been fixed for it.
 */
function paletteOptions(
  globals: FabricGlobals | undefined,
): readonly { readonly ref: `palette.${string}`; readonly name: string }[] {
  return Object.entries((globals?.palette as FabricPalette | undefined) ?? {})
    .filter(([id]) => id !== "none")
    .map(([id, entry]) => ({ ref: `palette.${id}`, name: entry.name }));
}

/**
 * The type presets a run may reference, each under its stored reference and the
 * name its author gave it.
 *
 * The name, not the id, because every other reference picker in the editor names
 * what it offers — `panel.ts`'s palette tokens, `chart-manager`'s paints, the
 * preset panel's own chooser. Printing `24-400` here put thirteen presets in the
 * inspector under one vocabulary and the same thirteen, one field lower, under
 * another, so an author who read `Ring unit` could not find it.
 */
function presetOptions(
  globals: FabricGlobals | undefined,
): readonly { readonly ref: `typePresets.${string}`; readonly name: string }[] {
  return Object.entries(globals?.typePresets ?? {}).map(([id, entry]) => ({
    ref: `typePresets.${id}`,
    name: entry.name,
  }));
}

/**
 * The runs whose tracking the object cannot carry separately.
 *
 * Fabric measures spacing once, from the object, so only the first run's
 * preset reaches the screen. A later run asking for the *same* value loses
 * nothing, so it is not a gap — which is also the condition `textShapeFor`
 * reports on. Matching the model rather than "any letterSpacing" is what keeps
 * this from warning about a run that is already painted as asked.
 */
function presetGaps(
  globals: FabricGlobals | undefined,
  runs: readonly TextRun[],
): readonly string[] {
  // Undefined for an untracked preset, which is also what the object paints
  // when its first run is untracked — so a later tracked run is a real gap.
  const painted = letterSpacingOf(globals, runs[0]?.typePreset);

  // A `Set` because the note names a preset, not a run: three runs sharing one
  // mismatching preset are one thing the canvas cannot do, and saying it three
  // times reads as three problems.
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
  // `GlobalEntry.value` is `unknown` on purpose — the panel is a second reader
  // of a document shape it does not own — so this narrows to the one field.
  const value: unknown = (
    globals?.typePresets?.[id ?? ""]?.value as
      | { readonly letterSpacing?: unknown }
      | undefined
  )?.letterSpacing;
  return typeof value === "number" ? value : undefined;
}

export interface RunEditor {
  readonly root: HTMLElement;
}

/**
 * Where a run's binding lives. A binding belongs to the *node* and is kept in
 * the theme envelope, not on the Fabric object, so a run can only name one —
 * the session owns reading and writing the list.
 */
export interface RunBindingPort {
  readonly bindings: () => readonly Binding[];
  readonly setBindings: (bindings: readonly Binding[]) => void;
}

/** A binding with `format` set, or without the field when nothing was written. */
function withFormat(binding: Binding, format: string): Binding {
  const trimmed = format.trim();

  if (trimmed.length === 0) {
    const { format: _format, ...rest } = binding;
    return rest;
  }

  return { ...binding, format: trimmed };
}

/** A binding with `timeZone` pinned, or without the field when none is. */
function withZone(binding: Binding, timeZone: string): Binding {
  const trimmed = timeZone.trim();

  if (trimmed.length === 0) {
    const { timeZone: _timeZone, ...rest } = binding;
    return rest;
  }

  return { ...binding, timeZone: trimmed };
}

/** A binding for `key`, with the fields the previous key's reading needed dropped. */
function rebound(binding: Binding, key: string): Binding {
  // A format describes how one key's reading is written, so changing the key
  // must not leave the old reading's format behind.
  const { format: _format, timeZone: _timeZone, ...rest } = binding;
  return { ...rest, semanticKey: key };
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
function bindingState(
  run: Extract<TextRun, { kind: "value" }>,
  bound: Binding | undefined,
  source: (() => SampleSource) | undefined,
): HTMLElement {
  const note = document.createElement("p");
  note.className = "vigilia-run-note";
  note.dataset["vigiliaRunBinding"] = run.bindingId;

  if (bound === undefined) {
    note.dataset["vigiliaRunProblem"] = "undeclared";
    note.textContent = uiCopy.inspectorFields.runUndeclared(run.bindingId);
    return note;
  }

  note.textContent = uiCopy.inspectorFields.runBinding(bound.semanticKey);
  // No reading is not the same as no binding: one needs a sensor, the other an
  // edit here. Asked of the source rather than guessed from the run.
  if (source?.().latest(bound.semanticKey) === undefined) {
    note.dataset["vigiliaRunProblem"] = "unmapped";
    note.textContent = uiCopy.inspectorFields.runUnmapped(bound.semanticKey);
  }

  return note;
}

/**
 * One row per run: its text, its preset and its colour. A run's overrides live
 * in the same `style` map the renderer already reads.
 *
 * `source` is what keeps the binding visible now the canvas paints readings
 * rather than tokens: which key a run names, and whether a reading has arrived
 * for it, are both things the author can only be told here.
 */
export function createRunEditor(
  editor: EditorInteraction,
  globals: FabricGlobals | undefined,
  object: ObjectWithText,
  onChange: () => void,
  bindingPort?: RunBindingPort,
  locale?: string,
  source?: () => SampleSource,
): RunEditor {
  const root = document.createElement("div");
  root.dataset["vigiliaRuns"] = "";

  const runs = textRunsOf(object);
  // Not "no runs": a text object with none still has layout worth editing, and
  // this is the only owner of the authored text content.
  if (object.get(TEXT_PROPERTY) === undefined) {
    return { root };
  }

  const heading = document.createElement("h3");
  heading.textContent = uiCopy.inspectorFields.runs;
  root.append(heading);

  // Text layout lives beside the runs in the same authored content, and the
  // renderer already honours all of it (alignment, wrapping, overflow).
  const content = object.get(TEXT_PROPERTY) as Record<string, unknown>;
  const setLayout = (patch: Record<string, unknown>): void => {
    object.set(TEXT_PROPERTY, { ...content, ...patch });
    applyAuthoredText(editor.canvas, globals, { bindings: {} });
    editor.canvas.requestRenderAll();
    editor.historyManager.saveState();
    onChange();
  };

  const choice = (
    label: string,
    data: string,
    options: readonly (readonly [string, string])[],
    current: string,
    onPick: (value: string) => void,
  ): HTMLElement => {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const select = document.createElement("select");
    select.dataset[data] = "";
    for (const [value, text] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.value = current;
    select.addEventListener("change", () => onPick(select.value));
    wrapper.append(select);
    return wrapper;
  };

  root.append(
    choice(
      uiCopy.inspectorFields.align,
      "vigiliaTextAlign",
      [
        ["left", uiCopy.inspectorFields.left],
        ["center", uiCopy.inspectorFields.centre],
        ["right", uiCopy.inspectorFields.right],
      ],
      typeof content["align"] === "string" ? content["align"] : "left",
      (value) => setLayout({ align: value }),
    ),
    choice(
      uiCopy.inspectorFields.verticalAlign,
      // `text-vertical-align`, not `align-top`: the dataset name and the
      // accessible name both have to say this moves text within its box, because
      // arrange's `align-*` vocabulary is on screen for the same selection and
      // means moving the object itself.
      "vigiliaTextVerticalAlign",
      [
        ["top", uiCopy.inspectorFields.verticalTop],
        ["middle", uiCopy.inspectorFields.verticalMiddle],
        ["bottom", uiCopy.inspectorFields.verticalBottom],
      ],
      // The renderer's own fallback, so an unset value and an explicit `top` are
      // the same thing to the author looking at the control.
      typeof content["verticalAlign"] === "string"
        ? content["verticalAlign"]
        : "top",
      (value) => setLayout({ verticalAlign: value }),
    ),
    choice(
      uiCopy.inspectorFields.wrap,
      "vigiliaTextWrap",
      [
        ["wrap", uiCopy.inspectorFields.on],
        ["nowrap", uiCopy.inspectorFields.off],
      ],
      content["wrap"] === false ? "nowrap" : "wrap",
      (value) => setLayout({ wrap: value === "wrap" }),
    ),
    choice(
      uiCopy.inspectorFields.overflow,
      "vigiliaTextOverflow",
      [
        ["clip", uiCopy.inspectorFields.clip],
        ["ellipsis", uiCopy.inspectorFields.ellipsis],
        ["visible", uiCopy.inspectorFields.overflowVisible],
      ],
      typeof content["overflow"] === "string" ? content["overflow"] : "clip",
      (value) => setLayout({ overflow: value }),
    ),
  );

  const commit = (index: number, next: TextRun): void => {
    // Rewrite the whole run list: the content is one authored value.
    object.set(TEXT_PROPERTY, {
      ...(object.get(TEXT_PROPERTY) as Record<string, unknown> | undefined),
      runs: runs.map((run, at) => (at === index ? next : run)),
    });
    // The authored run is what the author edited; Fabric's per-character
    // styles are what they see. Without this the change persists but never
    // paints, which looks like the control doing nothing.
    applyAuthoredText(editor.canvas, globals);
    editor.canvas.requestRenderAll();
    editor.historyManager.saveState();
    onChange();
  };

  /** The parts of a run that say how it looks, whichever kind it is. */
  const lookOf = (run: TextRun): Pick<TextRun, "typePreset" | "style"> => ({
    ...(run.typePreset === undefined ? {} : { typePreset: run.typePreset }),
    ...(run.style === undefined ? {} : { style: run.style }),
  });

  /**
   * What a run reads. A literal says what it was authored to say; a value run
   * reads a sensor through a binding this node declares. Both are the same
   * control, so a label becomes a reading and back without a second surface.
   */
  const sourceField = (
    run: TextRun,
    index: number,
    port: RunBindingPort,
  ): HTMLElement => {
    const wrapper = document.createElement("label");
    wrapper.textContent = uiCopy.inspectorFields.runSource;
    const select = document.createElement("select");
    select.dataset["vigiliaRunSource"] = String(index);
    const prose = document.createElement("option");
    prose.value = "";
    prose.textContent = uiCopy.inspectorFields.staticText;
    select.append(prose);
    for (const descriptor of SEMANTIC_KEYS) {
      const option = document.createElement("option");
      option.value = descriptor.key;
      option.textContent = descriptor.label;
      select.append(option);
    }

    const bound =
      run.kind === "value"
        ? port.bindings().find((binding) => binding.id === run.bindingId)
        : undefined;
    select.value = bound?.semanticKey ?? "";

    select.addEventListener("change", () => {
      const key = select.value;
      const bindings = port.bindings();

      if (key === "") {
        // Back to prose: the run keeps its look, and the reading it named goes
        // with it. Nothing else can be reading that binding.
        commit(index, { kind: "literal", text: "", ...lookOf(run) });
        port.setBindings(
          bindings.filter((binding) => binding.id !== bound?.id),
        );
        return;
      }

      const id = bound?.id ?? `binding-${crypto.randomUUID()}`;
      // The run is written first: the port's write repaints from the samples,
      // and must find the run list it is repainting.
      if (run.kind !== "value" || run.bindingId !== id) {
        commit(index, { kind: "value", bindingId: id, ...lookOf(run) });
      }
      port.setBindings(
        bound === undefined
          ? [...bindings, { id, semanticKey: key }]
          : bindings.map((binding) =>
              binding.id === id ? rebound(binding, key) : binding,
            ),
      );
      onChange();
    });

    wrapper.append(select);
    return wrapper;
  };

  /**
   * What a prose run says.
   *
   * `change`, not per keystroke, like the format field below: a half-typed
   * sentence is not an edit, and re-painting the canvas on every character
   * would be a history entry per character.
   */
  const runTextField = (
    run: Extract<TextRun, { readonly kind: "literal" }>,
    index: number,
  ): HTMLElement => {
    const wrapper = document.createElement("label");
    wrapper.textContent = uiCopy.inspectorFields.runText;
    const input = document.createElement("input");
    input.type = "text";
    input.dataset["vigiliaRunText"] = String(index);
    input.value = run.text;
    input.addEventListener("change", () =>
      commit(index, { ...run, text: input.value }),
    );
    wrapper.append(input);
    return wrapper;
  };

  /**
   * Drops a run, and the binding it was the only reader of.
   *
   * The binding goes with it for the reason the source field gives when a run
   * returns to prose: nothing else can be reading it, and a binding left behind
   * is one the document declares and no run can paint.
   */
  const removeRun = (index: number): void => {
    const gone = runs[index];
    object.set(TEXT_PROPERTY, {
      ...(object.get(TEXT_PROPERTY) as Record<string, unknown> | undefined),
      runs: runs.filter((_, at) => at !== index),
    });
    const port = bindingPort;
    if (port !== undefined && gone?.kind === "value") {
      port.setBindings(
        port.bindings().filter((binding) => binding.id !== gone.bindingId),
      );
    }
    applyAuthoredText(editor.canvas, globals);
    editor.canvas.requestRenderAll();
    editor.historyManager.saveState();
    onChange();
  };

  /**
   * How an instant reading is written out. A clock is design, so the author owns
   * its tokens; showing the reading they produce is the difference between
   * guessing at `dddd DD MMMM` and choosing it.
   */
  const formatField = (
    index: number,
    binding: Binding,
    port: RunBindingPort,
  ): HTMLElement => {
    const instant = describeSemanticKey(binding.semanticKey)?.instant;
    const fallback = instant?.defaultFormat ?? "";
    const wrapper = document.createElement("label");
    wrapper.textContent = uiCopy.inspectorFields.runFormat;
    const input = document.createElement("input");
    input.type = "text";
    input.dataset["vigiliaRunFormat"] = String(index);
    input.value = binding.format ?? "";
    input.placeholder = fallback;
    // The document validator refuses a longer pattern, so the field cannot
    // author one.
    input.maxLength = 64;
    const preview = document.createElement("span");
    preview.className = "vigilia-run-preview";
    preview.dataset["vigiliaRunFormatPreview"] = String(index);

    // The preview reads the same instant the editor's own preview source does,
    // so what is shown here is what the run paints.
    const show = (pattern: string): void => {
      preview.textContent =
        formatInstant(
          instantIn(Date.now()),
          pattern,
          binding.timeZone,
          locale,
        ) ?? uiCopy.inspectorFields.unresolved;
    };
    const pattern = (): string => (input.value === "" ? fallback : input.value);
    show(pattern());

    input.addEventListener("input", () => show(pattern()));
    input.addEventListener("change", () => {
      // Clearing the field means the key's own default, not an empty format.
      port.setBindings(
        port
          .bindings()
          .map((candidate) =>
            candidate.id === binding.id
              ? withFormat(candidate, input.value)
              : candidate,
          ),
      );
      onChange();
    });

    // The vocabulary, because a token the formatter does not know renders
    // itself — visible in this preview, and visible on a wall display too, where
    // the author never was.
    const hint = document.createElement("p");
    // The class the run editor's other notes already use, so this reads as one.
    hint.className = "vigilia-run-note";
    hint.dataset["vigiliaRunFormatHint"] = String(index);
    hint.textContent = uiCopy.inspectorFields.runFormatTokens;

    wrapper.append(input, preview, hint);
    return wrapper;
  };

  /**
   * Which zone the reading is taken in. A dashboard showing another city than
   * the one it runs in is the point of a world clock, so the zone is the
   * author's to pin; leaving it alone follows the display, which reads in
   * whatever zone its consumer chose.
   */
  const zoneField = (
    index: number,
    binding: Binding,
    port: RunBindingPort,
  ): HTMLElement => {
    const wrapper = document.createElement("label");
    wrapper.textContent = uiCopy.inspectorFields.runZone;
    const select = document.createElement("select");
    select.dataset["vigiliaRunZone"] = String(index);
    const follows = document.createElement("option");
    follows.value = "";
    follows.textContent = uiCopy.inspectorFields.runZoneFollows;
    select.append(follows);

    const pinned = binding.timeZone;
    const zones = knownTimeZones();
    // An alias the canonical list omits (`US/Pacific`) is a zone the envelope
    // accepts, so it keeps its own entry rather than reading as unpinned.
    for (const name of pinned !== undefined && !zones.includes(pinned)
      ? [pinned, ...zones]
      : zones) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.append(option);
    }

    select.value = pinned ?? "";
    select.addEventListener("change", () => {
      port.setBindings(
        port
          .bindings()
          .map((candidate) =>
            candidate.id === binding.id
              ? withZone(candidate, select.value)
              : candidate,
          ),
      );
      onChange();
    });

    wrapper.append(select);
    return wrapper;
  };

  /**
   * Whether the reading prints its own unit, or the author writes one beside it.
   *
   * The reference theme does the second: `cpu-card-value` is a value run on
   * `cpu.load` with `unitDisplay: "none"` and the "%" as a styled literal at the
   * caption's size. Nothing here could author that — the chart panel has this
   * control and the run panel did not, so an author who wanted it got the
   * reading's unit and their literal both, and "45%%" on the display's face.
   *
   * It writes the **run**, not the binding: a run's own `unitDisplay` takes
   * precedence, so setting the binding would be silently shadowed by exactly the
   * theme this control exists to reproduce.
   */
  const unitDisplayField = (
    index: number,
    run: Extract<TextRun, { kind: "value" }>,
  ): HTMLElement => {
    const wrapper = document.createElement("label");
    wrapper.textContent = uiCopy.panels.unitDisplay;
    const select = document.createElement("select");
    select.dataset["vigiliaRunUnitDisplay"] = String(index);
    for (const [value, text] of [
      ["", "Default"],
      ["none", "None"],
      ["short", "Short"],
      ["long", "Long"],
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.value = run.unitDisplay ?? "";
    select.addEventListener("change", () => {
      const chosen = select.value;
      // Built from the run without its `unitDisplay`, then set or not: dropping
      // it after a spread would leave the key present with the old value.
      const { unitDisplay: _previous, ...rest } = run;
      commit(
        index,
        chosen === ""
          ? rest
          : {
              ...rest,
              // `exactOptionalPropertyTypes` is on: present with one of the
              // three values, or absent.
              unitDisplay: chosen as NonNullable<
                Extract<TextRun, { kind: "value" }>["unitDisplay"]
              >,
            },
      );
      onChange();
    });

    wrapper.append(select);
    return wrapper;
  };

  runs.forEach((run, index) => {
    const row = document.createElement("section");
    row.dataset["vigiliaRun"] = String(index);

    const label = document.createElement("p");
    label.className = "vigilia-run-label";
    label.textContent = describeRun(run);
    row.append(label);

    // What a prose run says. A value run has no text of its own — the panel
    // below says where its reading comes from instead — and a field over one
    // would accept an edit and persist nothing, which is the one thing this
    // panel's doc comment rules out.
    if (run.kind === "literal") {
      row.append(runTextField(run, index));
    }

    // Preset reference, per run. The option's value is the stored reference and
    // its text is the preset's authored name, so what the author picks is what
    // persists and what they read back is the word they chose it by.
    const presetLabel = document.createElement("label");
    presetLabel.textContent = uiCopy.inspectorFields.runPreset;
    const preset = document.createElement("select");
    preset.dataset["vigiliaRunPreset"] = String(index);
    const options = presetOptions(globals);
    for (const { ref, name } of options) {
      const option = document.createElement("option");
      option.value = ref;
      option.textContent = name;
      preset.append(option);
    }
    preset.value = run.typePreset ?? options[0]?.ref ?? "";
    preset.addEventListener("change", () =>
      commit(index, {
        ...run,
        typePreset: preset.value as `typePresets.${string}`,
      }),
    );
    presetLabel.append(preset);
    row.append(presetLabel);

    // Colour reference, per run: the `style` map the renderer already reads.
    const colourLabel = document.createElement("label");
    colourLabel.textContent = uiCopy.inspectorFields.runColour;
    const colour = document.createElement("select");
    colour.dataset["vigiliaRunColour"] = String(index);
    const current = (
      run.style?.["color"] as { readonly ref?: string } | undefined
    )?.ref;
    // The same split as the preset dropdown above: the label is the authored
    // name, the value is the reference the run keeps.
    const colours = paletteOptions(globals);
    for (const { ref, name } of colours) {
      const option = document.createElement("option");
      option.value = ref;
      option.textContent = name;
      colour.append(option);
    }
    colour.value = current ?? colours[0]?.ref ?? "";
    colour.addEventListener("change", () =>
      commit(index, {
        ...run,
        style: {
          ...run.style,
          color: { ref: colour.value as `palette.${string}` },
        },
      }),
    );
    colourLabel.append(colour);
    row.append(colourLabel);

    // What the run reads, and how a reading of it is written. Both are absent
    // when the object has no id to hang a binding on.
    const port = bindingPort;
    if (port !== undefined) {
      row.append(sourceField(run, index, port));
      const bound =
        run.kind === "value"
          ? port.bindings().find((binding) => binding.id === run.bindingId)
          : undefined;
      if (run.kind === "value") {
        row.append(bindingState(run, bound, source));
        row.append(unitDisplayField(index, run));
      }
      if (
        bound !== undefined &&
        describeSemanticKey(bound.semanticKey)?.instant !== undefined
      ) {
        row.append(
          formatField(index, bound, port),
          zoneField(index, bound, port),
        );
      }
    }

    root.append(row);

    // Removed from the row rather than the foot of the panel so the author
    // reads which run they are deleting. Offered only when something would
    // remain: a text object with no runs paints nothing at all, so a control
    // that could reach that state is a control that can empty the canvas.
    if (runs.length > 1) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset["vigiliaRunRemove"] = String(index);
      remove.textContent = uiCopy.inspectorFields.removeRun(index + 1);
      remove.addEventListener("click", () => removeRun(index));
      row.append(remove);
    }
  });

  /**
   * A new run, looking the way the one before it does.
   *
   * Inheriting is the only default that is never wrong: a unit appended to a
   * reading wants the reading's colour and a smaller preset, and a run that
   * arrived in a different face reads as a mistake before the author has
   * chosen its own. The id is the same shape the source field mints, so the
   * two ways a run becomes a reading stay one convention.
   */
  const add = document.createElement("button");
  add.type = "button";
  add.dataset["vigiliaRunAdd"] = "";
  add.textContent = uiCopy.inspectorFields.addRun;
  add.addEventListener("click", () => {
    const last = runs.at(-1);
    const inherited = last === undefined ? {} : lookOf(last);
    object.set(TEXT_PROPERTY, {
      ...(object.get(TEXT_PROPERTY) as Record<string, unknown> | undefined),
      runs: [...runs, { kind: "literal", text: "", ...inherited }],
    });
    applyAuthoredText(editor.canvas, globals);
    editor.canvas.requestRenderAll();
    editor.historyManager.saveState();
    onChange();
  });
  root.append(add);

  for (const gap of presetGaps(globals, runs)) {
    const note = document.createElement("p");
    note.className = "vigilia-run-note";
    note.dataset["vigiliaRunNote"] = "";
    note.textContent = gap;
    root.append(note);
  }

  return { root };
}
