import type { TypePreset } from "@vigilia/renderer-core";
import { type CuratedFontFace, fontTrios } from "../font-catalog.js";

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
  heading.textContent = "Type presets";
  const select = document.createElement("select");
  select.dataset["vigiliaTypePreset"] = "";
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "Add type";
  const fields = document.createElement("div");
  root.append(heading, select, add, fields);
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
    const name = input("Name", "vigiliaTypeName", entry.name);
    const family = input("Family", "vigiliaTypeFamily", entry.value.family);
    const size = input(
      "Size",
      "vigiliaTypeSize",
      String(entry.value.size),
      "number",
    );
    const weight = input(
      "Weight",
      "vigiliaTypeWeight",
      String(entry.value.weight ?? ""),
    );
    const lineHeight = input(
      "Line height",
      "vigiliaTypeLineHeight",
      String(entry.value.lineHeight ?? ""),
      "number",
    );
    const letterSpacing = input(
      "Letter spacing",
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
      label("Name", name),
      label("Family", family),
      label("Size", size),
      label("Weight", weight),
      label("Line height", lineHeight),
      label("Letter spacing", letterSpacing),
      ...fontControls(),
      ...deletionControls(),
    ];
  };
  const fontControls = (): HTMLElement[] => {
    if (fontActions === undefined) return [];
    const faces = fontTrios().flatMap((trio) => trio.faces);
    const face = document.createElement("select");
    face.dataset["vigiliaFontFace"] = "";
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
    preview.textContent = "Preview font";
    preview.addEventListener("click", () => {
      const candidate = selectedFace();
      if (candidate !== undefined) void fontActions.preview(candidate);
    });
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "Apply font";
    apply.dataset["vigiliaFontApply"] = "";
    apply.addEventListener("click", () => {
      const candidate = selectedFace();
      if (candidate !== undefined)
        void fontActions.applyFace(selected, candidate);
    });
    const trio = document.createElement("select");
    trio.dataset["vigiliaFontTrio"] = "";
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
    applyTrio.textContent = "Apply trio";
    applyTrio.addEventListener("click", () => {
      void fontActions.applyTrio(trio.value);
    });
    return [
      label("Font", face),
      preview,
      apply,
      label("Trio", trio),
      applyTrio,
    ];
  };
  const deletionControls = (): HTMLElement[] => {
    if (onDelete === undefined) return [];
    const label = document.createElement("label");
    label.textContent = "Reassign to";
    const replacement = document.createElement("select");
    replacement.dataset["vigiliaTypeReplacement"] = "";
    for (const [id, entry] of Object.entries(presets)) {
      if (id === selected) continue;
      const option = document.createElement("option");
      option.value = id;
      option.textContent = entry.name;
      replacement.append(option);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Delete type";
    remove.dataset["vigiliaTypeDelete"] = "";
    remove.disabled = replacement.options.length === 0;
    remove.addEventListener("click", () => {
      if (replacement.value !== "") onDelete(selected, replacement.value);
    });
    return [label, replacement, remove];
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
        name: "New type",
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

function input(
  label: string,
  key: string,
  value: string,
  type = "text",
): HTMLInputElement {
  const control = document.createElement("input");
  control.type = type;
  control.dataset[key] = "";
  control.value = value;
  control.setAttribute("aria-label", label);
  return control;
}
function label(
  text: string,
  control: HTMLInputElement | HTMLSelectElement,
): HTMLLabelElement {
  const result = document.createElement("label");
  result.textContent = text;
  result.append(control);
  return result;
}
function nextId(presets: TypePresets): string {
  for (let index = 1; ; index += 1) {
    const id = index === 1 ? "type" : `type-${index}`;
    if (presets[id] === undefined) return id;
  }
}
