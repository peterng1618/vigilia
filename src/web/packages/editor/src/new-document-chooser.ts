import { MAX_ARTBOARD_DIMENSION } from "@vigilia/renderer-core";
import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  ARTBOARD_RESOLUTIONS,
  type ArtboardOrientation,
  type ArtboardRatioId,
  type ArtboardResolutionId,
  type ArtboardSize,
  artboardSize,
  DEFAULT_ARTBOARD_PRESET,
  nearestArtboardPreset,
} from "./artboard-presets.js";
import {
  DISPLAY_LENSES,
  type DisplayLensId,
  displayLens,
} from "./display-lens.js";
import { linkedPair } from "./editor-shell/controls/linked-pair.js";
import { uiCopy } from "./ui-copy.js";

/** The option value that means "not one of the three". A document picked by
 *  display takes the default resolution — see `DisplayLens.shape` — and the
 *  author changes it in the panel. */
const CUSTOM = "";

/**
 * The artboard a new document opens at, chosen before the document exists.
 *
 * **What the theme is for, first.** Three "Custom"s as a starting state asks
 * an author to know a ratio before knowing what the thing is for, and the ratio
 * is the answer that depends on the answer. A new theme is seen through
 * something, so the three displays are the question and the ratio is derived.
 *
 * **Custom is a choice, not a fallback.** The technical question is untouched
 * behind it — the same three dropdowns, off the same preset lists, and now
 * also the free width and height the panel carries, so a size no preset names
 * is reachable from here rather than only from the panel afterwards. Nothing
 * the chooser could express is one step further away than it was.
 *
 * It opens on the shape of the document it would replace, when there is one,
 * for the reason it always did: an author who has settled on 19.5:9 portrait
 * and presses **New theme** again has answered the size question already, and
 * a dialog asking it a second time is throwing that answer away.
 *
 * This is a `<dialog>` because that is what the editor already uses for the
 * decisions it interrupts with, and every control is a native labelled control
 * for the same reason.
 */
export function newDocumentChooser(current?: ArtboardSize): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "vigilia-dialog";
  dialog.setAttribute("aria-label", uiCopy.newDocument.chooseSize);

  const form = document.createElement("div");
  form.className = "vigilia-dialog-form";

  const heading = document.createElement("p");
  heading.className = "vigilia-dialog-lead";
  heading.textContent = uiCopy.newDocument.chooseSize;

  /** The preset this dialog opens on, and the size that follows from it. */
  const preset = nearestArtboardPreset(current);
  const opening = artboardSize(
    preset.ratio,
    preset.resolution,
    preset.orientation,
  );

  /** The size the author has settled on, and the one they are answering with.
   *  One number rather than three, because it is read back at the answer from
   *  the fields themselves — a later change to the palette cannot alter what
   *  was agreed. Seeded with the opening size, which is what the two free
   *  fields below are built with. */
  let chosen: ArtboardSize = opening;

  const display = selectControl(
    "display",
    uiCopy.newDocument.display,
    (value) => {
      custom.hidden = value !== CUSTOM;
      if (value === CUSTOM) return;
      const shape = displayLens(value as DisplayLensId).shape;
      // Through `derive`, the one writer of the three selects: a display chosen
      // from the list must not leave the technical controls naming a size the
      // dialog is no longer offering.
      derive(
        shape.ratio,
        shape.orientation,
        DEFAULT_ARTBOARD_PRESET.resolution,
      );
    },
  );
  for (const lens of DISPLAY_LENSES) {
    display.select.append(
      new Option(uiCopy.display.displays[lens.id], lens.id),
    );
  }
  display.select.append(new Option(uiCopy.newDocument.custom, CUSTOM));

  // The technical question, revealed rather than removed: hidden controls are
  // out of the accessibility tree, so nothing here is reachable-but-unnamed.
  const custom = document.createElement("div");
  custom.dataset["vigiliaNewDocumentCustom"] = "";
  custom.hidden = true;

  const ratio = selectControl("ratio", uiCopy.panels.ratio, (value) => {
    chosen = derive(
      value as ArtboardRatioId,
      readOrientation(),
      readResolution(),
    );
  });
  for (const entry of ARTBOARD_RATIOS) {
    ratio.select.append(new Option(entry.id, entry.id));
  }

  const orientation = selectControl(
    "orientation",
    uiCopy.panels.orientation,
    (value) => {
      chosen = derive(
        readRatio(),
        value as ArtboardOrientation,
        readResolution(),
      );
    },
  );
  for (const id of ARTBOARD_ORIENTATIONS) {
    orientation.select.append(new Option(uiCopy.artboardOrientations[id], id));
  }

  const resolution = selectControl(
    "resolution",
    uiCopy.panels.resolution,
    () => {
      chosen = derive(readRatio(), readOrientation(), readResolution());
    },
  );
  for (const entry of ARTBOARD_RESOLUTIONS) {
    resolution.select.append(
      new Option(uiCopy.artboardResolutions[entry.id], entry.id),
    );
  }

  // The free size the panel already carries. `linkedPair` is its own, so the
  // chooser and the panel bound an author's own dimensions the same way rather
  // than the chooser inventing a second pair with different limits.
  const dimensions = linkedPair({
    rowLabel: uiCopy.panels.size,
    first: {
      label: uiCopy.panels.widthMark,
      value: chosen.width,
      data: "vigiliaNewDocumentWidth",
    },
    second: {
      label: uiCopy.panels.heightMark,
      value: chosen.height,
      data: "vigiliaNewDocumentHeight",
    },
    min: 1,
    max: MAX_ARTBOARD_DIMENSION,
    onCommitFirst: (width) => adopt({ width, height: readHeight() }),
    onCommitSecond: (height) => adopt({ width: readWidth(), height }),
  });

  const size = document.createElement("output");
  size.className = "vigilia-dialog-size";
  size.dataset["vigiliaNewDocumentSize"] = "";
  const sizeLabel = document.createElement("label");
  sizeLabel.textContent = uiCopy.panels.size;
  sizeLabel.htmlFor = size.id = `vigilia-new-document-size-${++fieldSeq}`;
  const sizeRow = document.createElement("div");
  sizeRow.className = "vigilia-field";
  sizeRow.append(sizeLabel, size);

  /**
   * The size on screen, live. Four controls that only combine into a number
   * are four guesses, and the author would find out the size only after
   * committing to it.
   */
  function paintSize(): void {
    size.textContent = `${chosen.width} × ${chosen.height}`;
  }

  /** The three ids, read off the selects. None of them carries a Custom option,
   *  so every value is one the option list wrote; an id nothing names would be
   *  collapsed to `""` by the DOM, and `artboardSize` refuses that rather than
   *  answering a size nobody chose. */
  const readRatio = (): ArtboardRatioId =>
    ratio.select.value as ArtboardRatioId;
  const readOrientation = (): ArtboardOrientation =>
    orientation.select.value as ArtboardOrientation;
  const readResolution = (): ArtboardResolutionId =>
    resolution.select.value as ArtboardResolutionId;

  /** A preset named by two of the three dropdowns and derived whole, so no
   *  control is left reading a preset the size is not at. */
  function derive(
    nextRatio: ArtboardRatioId,
    nextOrientation: ArtboardOrientation,
    nextResolution: ArtboardResolutionId,
  ): ArtboardSize {
    ratio.select.value = nextRatio;
    orientation.select.value = nextOrientation;
    resolution.select.value = nextResolution;
    const derived = artboardSize(nextRatio, nextResolution, nextOrientation);
    adopt(derived);
    return derived;
  }

  /** The one writer of the size: the two free fields and the readout together,
   *  so the answer read at confirm time and the number shown cannot be two
   *  different sizes. It writes the fields even when hidden — the answer is
   *  read off them. */
  function adopt(next: ArtboardSize): void {
    chosen = next;
    dimensions.setValues(next.width, next.height);
    paintSize();
  }

  function readWidth(): number {
    return Number(dimensions.first.value);
  }
  function readHeight(): number {
    return Number(dimensions.second.value);
  }

  ratio.select.value = preset.ratio;
  orientation.select.value = preset.orientation;
  resolution.select.value = preset.resolution;
  display.select.value = openingDisplay(preset);
  custom.hidden = display.select.value !== CUSTOM;
  adopt(opening);

  const create = document.createElement("button");
  create.type = "button";
  create.textContent = uiCopy.newDocument.create;
  create.setAttribute("data-vigilia-new-document-create", "");

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = uiCopy.newDocument.cancel;
  cancel.setAttribute("data-vigilia-new-document-cancel", "");

  const actions = document.createElement("div");
  actions.className = "vigilia-dialog-actions";
  actions.append(cancel, create);

  custom.append(ratio.row, orientation.row, resolution.row, dimensions.row);
  form.append(heading, display.row, custom, sizeRow, actions);
  dialog.append(form);
  return dialog;

  /** The display this preset's shape is, or Custom for a shape no display is
   *  — a 4:3 document opens on Custom with 4:3 already chosen, rather than on
   *  a display that is not its shape. */
  function openingDisplay(presetChoice: {
    readonly ratio: ArtboardRatioId;
    readonly orientation: ArtboardOrientation;
  }): DisplayLensId | typeof CUSTOM {
    const match = DISPLAY_LENSES.find(
      (lens) =>
        lens.shape.ratio === presetChoice.ratio &&
        lens.shape.orientation === presetChoice.orientation,
    );
    return match?.id ?? CUSTOM;
  }
}

/**
 * Asks for the artboard, and resolves the size — or `undefined` when the author
 * dismissed it, which is how a `New` pressed by accident leaves the open
 * document alone.
 *
 * `current` is the artboard of the document about to be replaced; the dialog
 * opens on the display that size is, so a settled shape is offered back rather
 * than reset.
 *
 * The answer is a size, not a preset: three of the four ways to reach one here
 * are a preset and one is an author's own dimensions, and a type that cannot
 * carry both would have the session guess which the author meant.
 */
export function chooseArtboardSize(
  current?: ArtboardSize,
): Promise<ArtboardSize | undefined> {
  const dialog = newDocumentChooser(current);
  let done = false;

  return new Promise((resolve) => {
    /** The size the author confirmed, or nothing for a dismissal. Read out of
     *  the fields at the moment of the answer, so a later change to the
     *  palette cannot alter what was agreed. */
    const settle = (confirmed: boolean): void => {
      if (done) return;
      done = true;
      const size = (marker: string): HTMLInputElement => {
        const field = dialog.querySelector<HTMLInputElement>(
          `[data-vigilia-new-document-${marker}]`,
        );
        if (field === null) {
          throw new Error(`the chooser has no ${marker} field`);
        }
        return field;
      };
      dialog.remove();
      resolve(
        confirmed
          ? {
              width: Number(size("width").value),
              height: Number(size("height").value),
            }
          : undefined,
      );
    };

    // Driven here rather than through `method="dialog"`, so the chooser does
    // not depend on form-submission behaviour to answer. A `<dialog>` still
    // closes itself on Escape; the listener is what resolves, and it is also
    // the whole answer on a host that reports the key without closing.
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close?.();
        settle(false);
      }
    });
    // A close this code did not start — a browser's own Escape, a host that
    // closes the dialog — is a dismissal by definition.
    dialog.addEventListener("close", () => settle(false));

    dialog
      .querySelector("[data-vigilia-new-document-create]")
      ?.addEventListener("click", () => {
        dialog.close?.("create");
        settle(true);
      });
    dialog
      .querySelector("[data-vigilia-new-document-cancel]")
      ?.addEventListener("click", () => {
        dialog.close?.("cancel");
        settle(false);
      });

    document.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });
}

let fieldSeq = 0;

function selectControl(
  marker: string,
  text: string,
  onChange: (value: string) => void,
): { readonly row: HTMLElement; readonly select: HTMLSelectElement } {
  const row = document.createElement("div");
  row.className = "vigilia-field";
  const label = document.createElement("label");
  label.textContent = text;
  const select = document.createElement("select");
  select.setAttribute(`data-vigilia-new-document-${marker}`, "");
  label.htmlFor = select.id = `vigilia-new-document-${marker}-${++fieldSeq}`;
  select.addEventListener("change", () => onChange(select.value));
  row.append(label, select);
  return { row, select };
}
