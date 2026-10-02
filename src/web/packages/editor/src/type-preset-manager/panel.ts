import type { TypePreset } from "@vigilia/renderer-core";
import {
  type CuratedFontFace,
  catalogFaces,
  fontTrios,
} from "../font-catalog.js";
import { uiCopy } from "../ui-copy.js";

export type TypePresets = Readonly<
  Record<string, { readonly name: string; readonly value: TypePreset }>
>;

export interface TypePresetPanel {
  readonly root: HTMLElement;
  render(presets: TypePresets | undefined): void;
}
export interface TypePresetFontActions {
  readonly preview: (face: CuratedFontFace) => Promise<void>;
  readonly applyFace: (
    presetId: string,
    face: CuratedFontFace,
  ) => Promise<void>;
  readonly applyTrio: (trioId: string) => Promise<void>;
}

/** Product-owned global type authoring. Text objects retain stable preset references. */
export function createTypePresetPanel(
  host: HTMLElement,
  onChange: (presets: TypePresets) => void,
  onDelete?: (id: string, replacement: string) => void,
  fontActions?: TypePresetFontActions,
): TypePresetPanel {
  const root = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = uiCopy.panels.typePresets;
  const presetLabel = document.createElement("label");
  presetLabel.textContent = uiCopy.panels.typePreset;
  const select = document.createElement("select");
  select.dataset["vigiliaTypePreset"] = "";
  presetLabel.htmlFor = select.id = `vigilia-type-${++fieldSeq}`;
  // The labelled grid row every other field in the shell uses. A flex row
  // would put the 72px label column, the chooser and the button on one line,
  // and those three do not fit in a 280px pane.
  const presetRow = document.createElement("div");
  presetRow.className = "vigilia-field";
  presetRow.append(presetLabel, select);
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = uiCopy.panels.addType;
  const fields = document.createElement("div");
  root.append(heading, presetRow, add, fields);
  host.append(root);
  let presets: TypePresets = {};
  let selected = "";
  const draw = (): void => {
    select.replaceChildren(
      ...Object.entries(presets).map(([id, entry]) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = entry.name;
        return option;
      }),
    );
    if (presets[selected] === undefined)
      selected = Object.keys(presets)[0] ?? "";
    select.value = selected;
    fields.replaceChildren();
    const entry = presets[selected];
    if (entry !== undefined) fields.append(...controls(entry));
  };
  const commit = (entry: {
    readonly name: string;
    readonly value: TypePreset;
  }): void => {
    presets = { ...presets, [selected]: entry };
    onChange(presets);
    draw();
  };
  const controls = (entry: {
    readonly name: string;
    readonly value: TypePreset;
  }): HTMLElement[] => {
    const name = input("vigiliaTypeName", entry.name);
    const family = input("vigiliaTypeFamily", entry.value.family);
    const size = input("vigiliaTypeSize", String(entry.value.size), "number");
    const weight = input("vigiliaTypeWeight", String(entry.value.weight ?? ""));
    const lineHeight = input(
      "vigiliaTypeLineHeight",
      String(entry.value.lineHeight ?? ""),
      "number",
    );
    const letterSpacing = input(
      "vigiliaTypeLetterSpacing",
      String(entry.value.letterSpacing ?? ""),
      "number",
    );
    const update = (
      changed: "weight" | "lineHeight" | "letterSpacing" | undefined,
    ): void => {
      const nextSize = Number(size.value);
      const nextLine =
        lineHeight.value === "" ? undefined : Number(lineHeight.value);
      const nextLetter =
        letterSpacing.value === "" ? undefined : Number(letterSpacing.value);
      if (
        !Number.isFinite(nextSize) ||
        nextSize <= 0 ||
        (nextLine !== undefined &&
          (!Number.isFinite(nextLine) || nextLine <= 0)) ||
        (nextLetter !== undefined && !Number.isFinite(nextLetter)) ||
        name.value.trim() === "" ||
        family.value.trim() === ""
      )
        return;
      let value: TypePreset = {
        ...entry.value,
        family: family.value.trim(),
        size: nextSize,
      };
      if (changed === "weight") {
        const { weight: _weight, ...withoutWeight } = value;
        value =
          weight.value.trim() === ""
            ? withoutWeight
            : { ...withoutWeight, weight: weight.value.trim() };
      }
      if (changed === "lineHeight") {
        const { lineHeight: _lineHeight, ...withoutLineHeight } = value;
        value =
          nextLine === undefined
            ? withoutLineHeight
            : { ...withoutLineHeight, lineHeight: nextLine };
      }
      if (changed === "letterSpacing") {
        const { letterSpacing: _letterSpacing, ...withoutLetterSpacing } =
          value;
        value =
          nextLetter === undefined
            ? withoutLetterSpacing
            : { ...withoutLetterSpacing, letterSpacing: nextLetter };
      }
      commit({
        name: name.value.trim(),
        value,
      });
    };
    for (const control of [name, family, size])
      control.addEventListener("change", () => update(undefined));
    weight.addEventListener("change", () => update("weight"));
    lineHeight.addEventListener("change", () => update("lineHeight"));
    letterSpacing.addEventListener("change", () => update("letterSpacing"));
    return [
      field(uiCopy.panels.name, name),
      field(uiCopy.panels.family, family),
      field(uiCopy.panels.size, size),
      field(uiCopy.panels.weight, weight),
      field(uiCopy.panels.lineHeight, lineHeight),
      field(uiCopy.panels.letterSpacing, letterSpacing),
      ...fontControls(),
      ...deletionControls(),
    ];
  };
  const fontControls = (): HTMLElement[] => {
    if (fontActions === undefined) return [];
    const faces = catalogFaces();
    const face = document.createElement("select");
    face.dataset["vigiliaFontFace"] = "";
    face.id = `vigilia-type-${++fieldSeq}`;
    face.append(
      ...faces.map((candidate) =>
        Object.assign(document.createElement("option"), {
          value: candidate.id,
          textContent: `${candidate.family} ${candidate.weight}`,
        }),
      ),
    );
    const selectedFace = (): CuratedFontFace | undefined =>
      faces.find((candidate) => candidate.id === face.value);
    const preview = document.createElement("button");
    preview.type = "button";
    preview.textContent = uiCopy.panels.previewFont;
    preview.addEventListener("click", () => {
      const candidate = selectedFace();
      if (candidate !== undefined) void fontActions.preview(candidate);
    });
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = uiCopy.panels.applyFont;
    apply.dataset["vigiliaFontApply"] = "";
    apply.addEventListener("click", () => {
      const candidate = selectedFace();
      if (candidate !== undefined)
        void fontActions.applyFace(selected, candidate);
    });
    const trio = document.createElement("select");
    trio.dataset["vigiliaFontTrio"] = "";
    trio.id = `vigilia-type-${++fieldSeq}`;
    trio.append(
      ...fontTrios().map((candidate) =>
        Object.assign(document.createElement("option"), {
          value: candidate.id,
          textContent: candidate.name,
        }),
      ),
    );
    const applyTrio = document.createElement("button");
    applyTrio.type = "button";
    applyTrio.textContent = uiCopy.panels.applyTrio;
    applyTrio.addEventListener("click", () => {
      void fontActions.applyTrio(trio.value);
    });
    return [
      field(uiCopy.panels.font, face),
      preview,
      apply,
      field(uiCopy.panels.trio, trio),
      applyTrio,
    ];
  };
  const deletionControls = (): HTMLElement[] => {
    if (onDelete === undefined) return [];
    const replacement = document.createElement("select");
    replacement.dataset["vigiliaTypeReplacement"] = "";
    replacement.id = `vigilia-type-${++fieldSeq}`;
    for (const [id, entry] of Object.entries(presets)) {
      if (id === selected) continue;
      const option = document.createElement("option");
      option.value = id;
      option.textContent = entry.name;
      replacement.append(option);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = uiCopy.panels.deleteType;
    remove.dataset["vigiliaTypeDelete"] = "";
    remove.disabled = replacement.options.length === 0;
    remove.addEventListener("click", () => {
      if (replacement.value !== "") onDelete(selected, replacement.value);
    });
    return [field(uiCopy.panels.reassign, replacement), remove];
  };
  select.addEventListener("change", () => {
    selected = select.value;
    draw();
  });
  add.addEventListener("click", () => {
    selected = nextId(presets);
    presets = {
      ...presets,
      [selected]: {
        name: uiCopy.panels.newType,
        value: { family: "Segoe UI, sans-serif", size: 16 },
      },
    };
    onChange(presets);
    draw();
  });
  return {
    root,
    render(next) {
      presets = next ?? {};
      draw();
    },
  };
}

let fieldSeq = 0;

function input(key: string, value: string, type = "text"): HTMLInputElement {
  const control = document.createElement("input");
  control.type = type;
  control.dataset[key] = "";
  control.value = value;
  control.id = `vigilia-type-${++fieldSeq}`;
  return control;
}

/** A labelled field row, in the shell's own `.vigilia-field` grid: a 72px
    label column and the control beside it. The label is a sibling, paired by
    `for`/`id` — wrapping the control instead puts the two in one box, and the
    shell's `label { display: block }` rule then prints "Name" pressed against
    the field it names rather than in a column like every other panel's. */
function field(
  text: string,
  control: HTMLInputElement | HTMLSelectElement,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "vigilia-field";
  const label = document.createElement("label");
  label.textContent = text;
  label.htmlFor = control.id;
  row.append(label, control);
  return row;
}
function nextId(presets: TypePresets): string {
  for (let index = 1; ; index += 1) {
    const id = index === 1 ? "type" : `type-${index}`;
    if (presets[id] === undefined) return id;
  }
}
