import { MAX_ARTBOARD_DIMENSION } from "@vigilia/renderer-core";
import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  ARTBOARD_RESOLUTIONS,
  type ArtboardOrientation,
  type ArtboardPresetChoice,
  type ArtboardRatioId,
  type ArtboardResolutionId,
  type ArtboardSize,
  artboardPresetFor,
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
    if (!completable()) return refuse(ratio.select);
    chosen = derive(
      value as ArtboardRatioId,
      readOrientation() as ArtboardOrientation,
      readResolution() as ArtboardResolutionId,
    );
  });
  for (const entry of ARTBOARD_RATIOS) {
    ratio.select.append(new Option(entry.id, entry.id));
  }
  // The same reading the panel's three carry, and disabled for the same reason:
  // it is what a size no preset names looks like in these controls, not an
  // answer an author can pick. Without it the controls would have to keep
  // claiming whichever preset was last chosen.
  ratio.select.append(customReading());

  const orientation = selectControl(
    "orientation",
    uiCopy.panels.orientation,
    (value) => {
      if (!completable()) return refuse(orientation.select);
      chosen = derive(
        readRatio() as ArtboardRatioId,
        value as ArtboardOrientation,
        readResolution() as ArtboardResolutionId,
      );
    },
  );
  for (const id of ARTBOARD_ORIENTATIONS) {
    orientation.select.append(new Option(uiCopy.artboardOrientations[id], id));
  }
  orientation.select.append(customReading());

  const resolution = selectControl(
    "resolution",
    uiCopy.panels.resolution,
    () => {
      if (!completable()) return refuse(resolution.select);
      chosen = derive(
        readRatio() as ArtboardRatioId,
        readOrientation() as ArtboardOrientation,
        readResolution() as ArtboardResolutionId,
      );
    },
  );
  for (const entry of ARTBOARD_RESOLUTIONS) {
    resolution.select.append(
      new Option(uiCopy.artboardResolutions[entry.id], entry.id),
    );
  }
  resolution.select.append(customReading());

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

  /** The three ids, read off the selects. Each carries a Custom reading, so a
   *  value is either an id the option list wrote or the empty reading — and an
   *  empty reading is a refusal to derive rather than an id to derive from.
   *  `artboardSize` would throw on it; `completable` refuses it first, with a
   *  reason the author can act on. */
  const readRatio = (): ArtboardRatioId | typeof CUSTOM =>
    ratio.select.value as ArtboardRatioId | typeof CUSTOM;
  const readOrientation = (): ArtboardOrientation | typeof CUSTOM =>
    orientation.select.value as ArtboardOrientation | typeof CUSTOM;
  const readResolution = (): ArtboardResolutionId | typeof CUSTOM =>
    resolution.select.value as ArtboardResolutionId | typeof CUSTOM;

  /** Whether the three ids name a size between them — so the three can be read
   *  as one answer rather than three independent controls. */
  const completable = (): boolean =>
    readRatio() !== CUSTOM &&
    readOrientation() !== CUSTOM &&
    readResolution() !== CUSTOM;

  /** Whether the three ids between them name a size at all.
   *
   *  A preset is three answers, and an author who has typed their own
   *  dimensions has answered with two free numbers instead. Any *one* of the
   *  three dropdowns then cannot say what the new size is, and filling the
   *  other two in for them is how a typed 3000 × 3000 came back as a 3840 ×
   *  2160 nobody asked for. So the change is **refused and the control put
   *  back**, which is the panel's own refusal idiom (`artboard-panel.ts`) and
   *  the same rule the Custom reading exists to express.
   *
   *  Putting it back is the half that matters. Leaving the author's pick on a
   *  control that did nothing reads as a control that *did* something, and is
   *  the same defect wearing a different hat: a control claiming an answer the
   *  document does not carry. Back to presets by naming a display, or by typing
   *  a size that is one — one action either way, and the dialog opens on a
   *  preset, so these three are live for every journey that starts there. */
  const refuse = (select: HTMLSelectElement): void => {
    // Rewritten from `chosen`, not from `select`: the reading is a function of
    // the size, so one writer produces the value the control must show.
    writePresets(artboardPresetFor(chosen));
    select.blur();
  };

  /** A preset named by two of the three dropdowns and derived whole, so no
   *  control is left reading a preset the size is not at. */
  function derive(
    nextRatio: ArtboardRatioId,
    nextOrientation: ArtboardOrientation,
    nextResolution: ArtboardResolutionId,
  ): ArtboardSize {
    const derived = artboardSize(nextRatio, nextResolution, nextOrientation);
    adopt(derived);
    return derived;
  }

  /** The one writer of the size: the two free fields, the three dropdowns and
   *  the readout together, so the answer read at confirm time, the number shown
   *  and the presets the controls claim cannot be three different sizes.
   *
   *  It writes the fields even when hidden — the answer is read off them — and
   *  it writes the dropdowns from `artboardPresetFor` rather than from what was
   *  chosen, because a control must not claim a preset the document is not at. */
  function adopt(next: ArtboardSize): void {
    chosen = next;
    dimensions.setValues(next.width, next.height);
    writePresets(artboardPresetFor(next));
    paintSize();
  }

  /** The three dropdowns, written as the *reading* of a size rather than as the
   *  author's last choice: `undefined` is a size no preset names, so each shows
   *  Custom. The same writer serves `adopt` and a refusal, so a control cannot
   *  be showing one thing while the size is another. */
  function writePresets(preset: ArtboardPresetChoice | undefined): void {
    ratio.select.value = preset?.ratio ?? CUSTOM;
    orientation.select.value = preset?.orientation ?? CUSTOM;
    resolution.select.value = preset?.resolution ?? CUSTOM;
  }

  function readWidth(): number {
    return Number(dimensions.first.value);
  }
  function readHeight(): number {
    return Number(dimensions.second.value);
  }

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
 * What the author answered: the artboard to create, and the display to see it
 * through.
 *
 * **Both halves travel together because both were asked.** The display is the
 * first question in the dialog and was previously written and never read — a
 * 1080 × 2340 document opened inside a landscape frame, wasting stage on bars
 * the author had already told us not to want. Carrying only the size made the
 * answer to that question unreachable from here.
 *
 * The display is a **view preference and never document content** (§67), which
 * is why it is a separate field rather than something derived from the size:
 * nothing about `size` names a lens, and a caller that wants one has to ask.
 */
export interface NewDocumentAnswer {
  readonly size: ArtboardSize;
  /** The display chosen, or `undefined` for Custom — see `chooseArtboardSize`. */
  readonly display: DisplayLensId | undefined;
}

/**
 * Asks for the artboard, and resolves the answer — or `undefined` when the
 * author dismissed it, which is how a `New` pressed by accident leaves the open
 * document alone.
 *
 * `current` is the artboard of the document about to be replaced; the dialog
 * opens on the display that size is, so a settled shape is offered back rather
 * than reset.
 *
 * `display` is `undefined` when the answer is **Custom**, and the caller frames
 * the new document with Fit. That is the reading, not a gap: Custom is the
 * author declining to name a display, and Fit is the framing that names none —
 * the same answer the Display menu's `Fit` item gives, one click away in the
 * other direction. Framing a shape no display is through a display that is not
 * its shape is the letterboxing this whole plan exists to stop. A document at a
 * display's own shape, by contrast, is offered back with that display already
 * ticked, so an author who never touched the control is framed by their own
 * answer.
 *
 * The size is not a preset: three of the four ways to reach one here are a
 * preset and one is an author's own dimensions, and a type that cannot carry
 * both would have the session guess which the author meant.
 */
export function chooseArtboardSize(
  current?: ArtboardSize,
): Promise<NewDocumentAnswer | undefined> {
  const dialog = newDocumentChooser(current);
  let done = false;

  return new Promise((resolve) => {
    /** What the author confirmed, or nothing for a dismissal. Read out of the
     *  fields and the display control at the moment of the answer, so a later
     *  change to the palette cannot alter what was agreed. */
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
      /** The lens the author named, or `undefined` for Custom. Read off the
       *  control rather than remembered, so the answer cannot be a display the
       *  dialog is no longer offering. */
      const displayOf = (): DisplayLensId | undefined => {
        const value = dialog.querySelector<HTMLSelectElement>(
          "[data-vigilia-new-document-display]",
        )?.value;
        return value === undefined || value === CUSTOM
          ? undefined
          : (value as DisplayLensId);
      };
      const answer = confirmed
        ? {
            size: {
              width: Number(size("width").value),
              height: Number(size("height").value),
            },
            display: displayOf(),
          }
        : undefined;
      dialog.remove();
      resolve(answer);
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

/** The disabled Custom entry the three technical selects carry: the reading a
 *  size no preset names, offered the way `artboard-panel.ts` offers it. */
function customReading(): HTMLOptionElement {
  const option = new Option(uiCopy.panels.customSize, CUSTOM);
  option.disabled = true;
  return option;
}

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
