import type {
  Binding,
  FabricGlobals,
  FabricPalette,
  TextRun,
} from "@vigilia/renderer-core";
import {
  describeSemanticKey,
  formatInstant,
  instantIn,
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

/** The palette tokens a run's colour may reference. */
function paletteTokens(globals: FabricGlobals | undefined): readonly string[] {
  return Object.keys((globals?.palette as FabricPalette | undefined) ?? {})
    .filter((id) => id !== "none")
    .map((id) => `palette.${id}`);
}

/** The type presets a run may reference. */
function presetIds(globals: FabricGlobals | undefined): readonly string[] {
  return Object.keys(globals?.typePresets ?? {}).map(
    (id) => `typePresets.${id}`,
  );
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

/** A binding for `key`, with the fields the previous key's reading needed dropped. */
function rebound(binding: Binding, key: string): Binding {
  // A format describes how one key's reading is written, so changing the key
  // must not leave the old reading's format behind.
  const { format: _format, timeZone: _timeZone, ...rest } = binding;
  return { ...rest, semanticKey: key };
}

/**
 * One row per run: its text, its preset and its colour. A run's overrides live
 * in the same `style` map the renderer already reads.
 */
export function createRunEditor(
  editor: EditorInteraction,
  globals: FabricGlobals | undefined,
  object: ObjectWithText,
  onChange: () => void,
  bindingPort?: RunBindingPort,
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
        formatInstant(instantIn(Date.now()), pattern, binding.timeZone) ??
        uiCopy.inspectorFields.unresolved;
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

    wrapper.append(input, preview);
    return wrapper;
  };

  runs.forEach((run, index) => {
    const row = document.createElement("section");
    row.dataset["vigiliaRun"] = String(index);

    const label = document.createElement("p");
    label.className = "vigilia-run-label";
    label.textContent = describeRun(run);
    row.append(label);

    // Preset reference, per run.
    const presetLabel = document.createElement("label");
    presetLabel.textContent = uiCopy.inspectorFields.runPreset;
    const preset = document.createElement("select");
    preset.dataset["vigiliaRunPreset"] = String(index);
    for (const id of presetIds(globals)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id.replace("typePresets.", "");
      preset.append(option);
    }
    preset.value = run.typePreset ?? presetIds(globals)[0] ?? "";
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
    for (const ref of paletteTokens(globals)) {
      const option = document.createElement("option");
      option.value = ref;
      option.textContent = ref.replace("palette.", "");
      colour.append(option);
    }
    colour.value = current ?? paletteTokens(globals)[0] ?? "";
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
      if (
        bound !== undefined &&
        describeSemanticKey(bound.semanticKey)?.instant !== undefined
      ) {
        row.append(formatField(index, bound, port));
      }
    }

    root.append(row);
  });

  return { root };
}
