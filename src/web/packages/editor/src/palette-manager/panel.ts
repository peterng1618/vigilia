import type {
  FabricPalette,
  FabricPaletteEntry,
  PalettePaint,
} from "@vigilia/renderer-core";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { ColourPicker } from "../components/ui/colour-picker.js";
import { GradientEditor } from "../components/ui/gradient-editor.js";
import { uiCopy } from "../ui-copy.js";

/** An object a token is linked to. The name is what the panel shows; the id
    is the stable key the layer list and every binding use (§75). */
export interface PaletteTokenUse {
  readonly objectId: string;
  readonly name: string;
}

export interface PalettePanelOptions {
  /**
   * The objects each token is linked to, or `undefined` when the panel has no
   * scene to read. A function, not a record, because the scene changes under
   * the panel and the figure has to be re-read on every draw rather than
   * frozen at construction.
   *
   * The count beside a token and the guard that decides whether a token may be
   * deleted come from this one source, so a token is never reported unused
   * while an object is painted with it.
   */
  readonly usage?: () => Readonly<Record<string, readonly PaletteTokenUse[]>>;
}

export interface PalettePanel {
  readonly root: HTMLElement;
  render(palette: FabricPalette | undefined): void;
}

/** Product-owned palette authoring; tokens retain stable ids so references stay valid. */
export function createPalettePanel(
  host: HTMLElement,
  onChange: (palette: FabricPalette) => void,
  onDelete?: (id: string, replacement: string) => void,
  options: PalettePanelOptions = {},
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
  const users = document.createElement("ul");
  users.dataset["vigiliaPaletteUsers"] = "";
  const usersHeading = document.createElement("h3");
  // The count is a measurement, so a token with no scene behind it gets no
  // list at all rather than a fabricated zero — the same rule as a gap in
  // telemetry (§97).
  if (options.usage !== undefined) {
    usersHeading.textContent = uiCopy.panels.layers;
    root.append(heading, tokenRow, add, fields, usersHeading, users);
  } else root.append(heading, tokenRow, add, fields);
  host.append(root);

  let palette: FabricPalette = {};
  let selected = "";
  const draw = (): void => {
    // Read once per draw: the scene can change between two tokens, and a
    // figure that mixed two moments would be a measurement of nothing.
    const usage = options.usage?.();
    select.replaceChildren();
    for (const [id, entry] of Object.entries(palette)) {
      const option = document.createElement("option");
      option.value = id;
      // The figure rides the option so a token nothing uses is visible without
      // selecting it first, which is the whole point of showing it.
      const uses = usage?.[id];
      option.textContent =
        uses === undefined ? entry.name : `${entry.name} · ${uses.length}`;
      select.append(option);
    }
    if (palette[selected] === undefined)
      selected = Object.keys(palette)[0] ?? "";
    select.value = selected;
    fields.replaceChildren();
    const entry = palette[selected];
    if (entry !== undefined) fields.append(...paletteFields(entry));
    users.replaceChildren();
    for (const use of usage?.[selected] ?? []) {
      const item = document.createElement("li");
      item.textContent = use.name;
      users.append(item);
    }
  };
  const commit = (entry: FabricPaletteEntry): void => {
    if (selected === "none") return;
    palette = { ...palette, [selected]: entry };
    onChange(palette);
    draw();
  };
  const paletteFields = (entry: FabricPaletteEntry): HTMLElement[] => {
    const name = field(
      uiCopy.panels.name,
      "vigiliaPaletteName",
      entry.name,
      "text",
    );
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
      option.textContent = uiCopy.panels.paintKinds[value];
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
        name: uiCopy.panels.newColour,
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
  const color = field(
    uiCopy.panels.colour,
    "vigiliaPaletteColor",
    value.color,
    "text",
  );
  color.input.addEventListener("change", () => {
    const next = color.input.value.trim();
    if (next.length === 0) return;
    // The browser is the authority on what a colour is, and it already ships
    // the answer: `CSS.supports` asks the same engine that will paint it. A
    // hand-written list of colour names would be a second, worse copy of that,
    // and a value the engine rejects is one where `ctx.fillStyle` keeps the
    // PREVIOUS colour — so the edit would silently do nothing while the
    // document carried the nonsense the validator then has no rule to refuse.
    if (typeof CSS !== "undefined" && CSS.supports?.("color", next) === false) {
      color.input.setCustomValidity(uiCopy.panels.colourUnpaintable(next));
      color.input.reportValidity();
      return;
    }
    color.input.setCustomValidity("");
    commit({ ...entry, value: { kind: "solid", color: next } });
  });
  // The swatch beside the field opens the picker. The field stays, because a
  // value can be typed exactly and a picker cannot always be dragged to it.
  const row = document.createElement("div");
  row.className = "vigilia-field";
  row.style.cssText = "display:flex;gap:6px;align-items:center";
  const host = document.createElement("div");
  row.append(host);
  mountPicker(host, entry, commit);

  return [color.label, color.input, row];
}

/**
 * The picker, in its own React root.
 *
 * shadcn on Radix, per the ruling on this field's ecosystem: a native
 * `<input type="color">` has no alpha channel and the theme's paints carry it,
 * so it stays ruled out.
 */
function mountPicker(
  host: HTMLElement,
  entry: FabricPaletteEntry,
  commit: (entry: FabricPaletteEntry) => void,
): void {
  const root = createRoot(host);
  root.render(
    React.createElement(ColourPicker, {
      value: entry.value.kind === "solid" ? entry.value.color : "#ffffff",
      label: uiCopy.panels.colourPicker,
      // The picker owns the value; the entry it hands back keeps everything
      // else the author named, so a colour change never renames a token.
      onChange: (next: string) =>
        commit({ ...entry, value: { kind: "solid", color: next } }),
    }),
  );
  host.dataset["vigiliaPalettePicker"] = "";
}

function mountGradient(
  host: HTMLElement,
  value: Extract<PalettePaint, { readonly kind: "gradient" }>,
  commit: (entry: FabricPaletteEntry) => void,
  entry: FabricPaletteEntry,
): void {
  const root = createRoot(host);
  root.render(
    React.createElement(GradientEditor, {
      stops: value.stops,
      angle: value.angle,
      label: uiCopy.panels.gradient,
      onChange: ({ stops, angle }) =>
        commit({ ...entry, value: { ...value, stops, angle } }),
    }),
  );
}

function gradientFields(
  entry: FabricPaletteEntry,
  value: Extract<PalettePaint, { readonly kind: "gradient" }>,
  commit: (entry: FabricPaletteEntry) => void,
): HTMLElement[] {
  const angle = field(
    uiCopy.panels.angle,
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

  // The visual editor: a preview of the gradient it produces and a track whose
  // handles are its stops, each opening the shared picker. The number and text
  // fields below stay, because a drag cannot land on 0.37 exactly.
  const host = document.createElement("div");
  host.dataset["vigiliaPaletteGradient"] = "";
  fields.push(host);
  mountGradient(host, value, commit, entry);

  for (const [index, stop] of value.stops.entries()) {
    const offset = field(
      uiCopy.panels.stopPosition(index + 1),
      "vigiliaPaletteStopOffset",
      String(stop.offset),
      "number",
    );
    offset.input.min = "0";
    offset.input.max = "1";
    offset.input.step = "0.01";
    const color = field(
      uiCopy.panels.stopColour(index + 1),
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
