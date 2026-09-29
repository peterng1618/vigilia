import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  ARTBOARD_RESOLUTIONS,
  type ArtboardOrientation,
  type ArtboardPresetChoice,
  type ArtboardRatioId,
  type ArtboardResolutionId,
  artboardSize,
  DEFAULT_ARTBOARD_PRESET,
} from "./artboard-presets.js";
import { uiCopy } from "./ui-copy.js";

export type { ArtboardPresetChoice } from "./artboard-presets.js";

/**
 * The artboard a new document opens at, chosen before the document exists.
 *
 * A size is the one thing about a blank theme an author cannot add afterwards
 * without moving everything already on it, so it is asked first and asked
 * properly: the same three controls the inspector carries, off the same preset
 * lists, so the two cannot describe different sizes.
 *
 * This is a `<dialog>` because that is what the editor already uses for the
 * decisions it interrupts with (`confirmDocumentReplacement`, the library
 * chooser), and what gives keyboard dismissal, focus containment and the top
 * layer for free. Every control is a native labelled control for the same
 * reason.
 */
export function newDocumentChooser(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "vigilia-dialog";
  dialog.setAttribute("aria-label", uiCopy.newDocument.chooseSize);

  const form = document.createElement("div");
  form.className = "vigilia-dialog-form";

  const heading = document.createElement("p");
  heading.className = "vigilia-dialog-lead";
  heading.textContent = uiCopy.newDocument.chooseSize;

  const chosen = { ...DEFAULT_ARTBOARD_PRESET } as {
    ratio: ArtboardRatioId;
    resolution: ArtboardResolutionId;
    orientation: ArtboardOrientation;
  };

  const ratio = selectControl("ratio", uiCopy.panels.ratio, (value) => {
    chosen.ratio = value as ArtboardRatioId;
  });
  for (const entry of ARTBOARD_RATIOS) {
    ratio.select.append(new Option(entry.id, entry.id));
  }

  const orientation = selectControl(
    "orientation",
    uiCopy.panels.orientation,
    (value) => {
      chosen.orientation = value as ArtboardOrientation;
    },
  );
  for (const id of ARTBOARD_ORIENTATIONS) {
    orientation.select.append(new Option(uiCopy.artboardOrientations[id], id));
  }

  const resolution = selectControl(
    "resolution",
    uiCopy.panels.resolution,
    (value) => {
      chosen.resolution = value as ArtboardResolutionId;
    },
  );
  for (const entry of ARTBOARD_RESOLUTIONS) {
    resolution.select.append(
      new Option(uiCopy.artboardResolutions[entry.id], entry.id),
    );
  }

  // The derived size, live. Three dropdowns that only combine into a number are
  // three guesses, and the author would find out the size only after committing
  // to it.
  const size = document.createElement("output");
  size.className = "vigilia-dialog-size";
  size.dataset["vigiliaNewDocumentSize"] = "";
  const sizeLabel = document.createElement("label");
  sizeLabel.textContent = uiCopy.panels.size;
  sizeLabel.htmlFor = size.id = `vigilia-new-document-size-${++fieldSeq}`;
  const sizeRow = document.createElement("div");
  sizeRow.className = "vigilia-field";
  sizeRow.append(sizeLabel, size);

  const paintSize = (): void => {
    const derived = artboardSize(
      chosen.ratio,
      chosen.resolution,
      chosen.orientation,
    );
    size.textContent = `${derived.width} × ${derived.height}`;
  };
  for (const control of [ratio.select, orientation.select, resolution.select]) {
    control.addEventListener("change", paintSize);
  }
  ratio.select.value = chosen.ratio;
  orientation.select.value = chosen.orientation;
  resolution.select.value = chosen.resolution;
  paintSize();

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

  form.append(
    heading,
    ratio.row,
    orientation.row,
    resolution.row,
    sizeRow,
    actions,
  );
  dialog.append(form);
  return dialog;
}

/**
 * Asks for the artboard, and resolves the choice — or `undefined` when the
 * author dismissed it, which is how a `New` pressed by accident leaves the open
 * document alone.
 */
export function chooseArtboardPreset(): Promise<
  ArtboardPresetChoice | undefined
> {
  const dialog = newDocumentChooser();
  let done = false;

  return new Promise((resolve) => {
    /** The size the author confirmed, or nothing for a dismissal. Read out of
        the controls at the moment of the answer, so a later change to the
        palette cannot alter what was agreed. */
    const settle = (confirmed: boolean): void => {
      if (done) return;
      done = true;
      const choice = (marker: string): string =>
        dialog.querySelector<HTMLSelectElement>(
          `[data-vigilia-new-document-${marker}]`,
        )?.value ?? "";
      dialog.remove();
      resolve(
        confirmed
          ? {
              ratio: (choice("ratio") ||
                DEFAULT_ARTBOARD_PRESET.ratio) as ArtboardRatioId,
              resolution: (choice("resolution") ||
                DEFAULT_ARTBOARD_PRESET.resolution) as ArtboardResolutionId,
              orientation: (choice("orientation") ||
                DEFAULT_ARTBOARD_PRESET.orientation) as ArtboardOrientation,
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
