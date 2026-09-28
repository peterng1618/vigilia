import type {
  FabricPalette,
  FabricPaletteEntry,
  PalettePaint,
} from "@vigilia/renderer-core";
import { uiCopy } from "../ui-copy.js";

export interface PalettePanel {
  readonly root: HTMLElement;
  render(palette: FabricPalette | undefined): void;
}

/** Product-owned palette authoring; tokens retain stable ids so references stay valid. */
export function createPalettePanel(
  host: HTMLElement,
  onChange: (palette: FabricPalette) => void,
  onDelete?: (id: string, replacement: string) => void,
): PalettePanel {
  const root = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = uiCopy.panels.palette;
  const tokenLabel = document.createElement("label");
  tokenLabel.textContent = uiCopy.panels.colourToken;
  const select = document.createElement("select");
  select.dataset["vigiliaPaletteToken"] = "";
  tokenLabel.htmlFor = select.id = `vigilia-palette-${++fieldSeq}`;
  // The labelled grid row every other field in the shell uses. A flex row
  // would put the 72px label column, the chooser and the button on one line,
  // and those three do not fit in a 280px pane.
  const tokenRow = document.createElement("div");
  tokenRow.className = "vigilia-field";
  tokenRow.append(tokenLabel, select);
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = uiCopy.panels.addColour;
  const fields = document.createElement("div");
  root.append(heading, tokenRow, add, fields);
  host.append(root);

  let palette: FabricPalette = {};
  let selected = "";
  const draw = (): void => {
    select.replaceChildren();
    for (const [id, entry] of Object.entries(palette)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = entry.name;
      select.append(option);
    }
    if (palette[selected] === undefined)
      selected = Object.keys(palette)[0] ?? "";
    select.value = selected;
    fields.replaceChildren();
    const entry = palette[selected];
    if (entry !== undefined) fields.append(...paletteFields(entry));
  };
  const commit = (entry: FabricPaletteEntry): void => {
    if (selected === "none") return;
    palette = { ...palette, [selected]: entry };
    onChange(palette);
    draw();
  };
  const paletteFields = (entry: FabricPaletteEntry): HTMLElement[] => {
    const name = field("Name", "vigiliaPaletteName", entry.name, "text");
    name.input.addEventListener("change", () => {
      const next = name.input.value.trim();
      if (next.length === 0) return draw();
      commit({ ...entry, name: next });
    });
    if (selected === "none") {
      name.input.disabled = true;
      return [name.label, name.input];
    }
    const kind = document.createElement("select");
    kind.dataset["vigiliaPaletteKind"] = "";
    for (const value of ["solid", "gradient"] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "solid" ? "Solid" : "Linear gradient";
      kind.append(option);
    }
    kind.value = entry.value.kind;
    kind.addEventListener("change", () => {
      commit({
        ...entry,
        value:
          kind.value === "gradient"
            ? defaultGradient()
            : { kind: "solid", color: "#ffffff" },
      });
    });
    const label = document.createElement("label");
    label.textContent = uiCopy.panels.paint;
    label.htmlFor = kind.id = `vigilia-palette-${++fieldSeq}`;
    const controls =
      entry.value.kind === "solid"
        ? solidFields(entry, entry.value, commit)
        : gradientFields(entry, entry.value, commit);
    const deletion = deletionControls();
    return [name.label, name.input, label, kind, ...controls, ...deletion];
  };
  const deletionControls = (): HTMLElement[] => {
    if (onDelete === undefined) return [];
    const label = document.createElement("label");
    label.textContent = uiCopy.panels.reassign;
    const replacement = document.createElement("select");
    replacement.dataset["vigiliaPaletteReplacement"] = "";
    label.htmlFor = replacement.id = `vigilia-palette-${++fieldSeq}`;
    for (const [id, entry] of Object.entries(palette)) {
      if (id === selected) continue;
      const option = document.createElement("option");
      option.value = id;
      option.textContent = entry.name;
      replacement.append(option);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = uiCopy.panels.deleteColour;
    remove.dataset["vigiliaPaletteDelete"] = "";
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
    selected = nextId(palette);
    palette = {
      ...palette,
      [selected]: {
        name: "New colour",
        value: { kind: "solid", color: "#ffffff" },
      },
    };
    onChange(palette);
    draw();
  });
  return {
    root,
    render(nextPalette) {
      palette = nextPalette ?? {};
      draw();
    },
  };
}

function solidFields(
  entry: FabricPaletteEntry,
  value: Extract<PalettePaint, { readonly kind: "solid" }>,
  commit: (entry: FabricPaletteEntry) => void,
): HTMLElement[] {
  const color = field("Colour", "vigiliaPaletteColor", value.color, "text");
  color.input.addEventListener("change", () => {
    const next = color.input.value.trim();
    if (next.length === 0) return;
    commit({ ...entry, value: { kind: "solid", color: next } });
  });
  return [color.label, color.input];
}

function gradientFields(
  entry: FabricPaletteEntry,
  value: Extract<PalettePaint, { readonly kind: "gradient" }>,
  commit: (entry: FabricPaletteEntry) => void,
): HTMLElement[] {
  const angle = field(
    "Angle",
    "vigiliaPaletteAngle",
    String(value.angle),
    "number",
  );
  angle.input.addEventListener("change", () => {
    const next = Number(angle.input.value);
    if (!Number.isFinite(next)) return;
    commit({ ...entry, value: { ...value, angle: next } });
  });
  const fields: HTMLElement[] = [angle.label, angle.input];
  for (const [index, stop] of value.stops.entries()) {
    const offset = field(
      `Stop ${index + 1} position`,
      "vigiliaPaletteStopOffset",
      String(stop.offset),
      "number",
    );
    offset.input.min = "0";
    offset.input.max = "1";
    offset.input.step = "0.01";
    const color = field(
      `Stop ${index + 1} colour`,
      "vigiliaPaletteStopColor",
      stop.color,
      "text",
    );
    const update = (): void => {
      const nextOffset = Number(offset.input.value);
      const nextColor = color.input.value.trim();
      if (
        !Number.isFinite(nextOffset) ||
        nextOffset < 0 ||
        nextOffset > 1 ||
        nextColor.length === 0
      )
        return;
      const stops = value.stops.map((current, stopIndex) =>
        stopIndex === index
          ? { offset: nextOffset, color: nextColor }
          : current,
      );
      if (
        stops.some(
          (current, stopIndex) =>
            stopIndex > 0 && current.offset < stops[stopIndex - 1]!.offset,
        )
      )
        return;
      commit({ ...entry, value: { ...value, stops } });
    };
    offset.input.addEventListener("change", update);
    color.input.addEventListener("change", update);
    fields.push(offset.label, offset.input, color.label, color.input);
  }
  const last = value.stops.at(-1);
  if (last !== undefined) {
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = uiCopy.panels.addStop;
    add.dataset["vigiliaPaletteAddStop"] = "";
    add.addEventListener("click", () => {
      commit({
        ...entry,
        value: {
          ...value,
          stops: [...value.stops, { offset: 1, color: last.color }],
        },
      });
    });
    fields.push(add);
  }
  return fields;
}

let fieldSeq = 0;

/** A label and the input it names. `id` and `for` are paired so the name a
    screen reader reads is the word the author can see. */
function field(
  text: string,
  key: string,
  value: string,
  type: "text" | "number",
): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement("input");
  input.type = type;
  input.dataset[key] = "";
  input.value = value;
  label.htmlFor = input.id = `vigilia-palette-${++fieldSeq}`;
  return { label, input };
}

function defaultGradient(): PalettePaint {
  return {
    kind: "gradient",
    angle: 0,
    stops: [
      { offset: 0, color: "#ffffff" },
      { offset: 1, color: "#000000" },
    ],
  };
}

function nextId(palette: FabricPalette): string {
  for (let suffix = 1; ; suffix += 1) {
    const id = suffix === 1 ? "colour" : `colour-${suffix}`;
    if (palette[id] === undefined) return id;
  }
}
