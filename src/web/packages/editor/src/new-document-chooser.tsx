import { MAX_ARTBOARD_DIMENSION } from "@vigilia/renderer-core";
import { createElement, useId, useState } from "react";
import {
  ARTBOARD_ORIENTATIONS,
  ARTBOARD_RATIOS,
  ARTBOARD_RESOLUTIONS,
  type ArtboardOrientation,
  type ArtboardRatioId,
  type ArtboardResolutionId,
  type ArtboardSize,
  artboardOrientation,
  artboardPresetFor,
  artboardSize,
  DEFAULT_ARTBOARD_PRESET,
  nearestArtboardPreset,
} from "./artboard-presets.js";
import { ControlPair } from "./components/ui/control-pair.js";
import {
  type ControlOption,
  ControlSelect,
} from "./components/ui/control-select.js";
import { ACTION_BUTTON, Dialog } from "./components/ui/dialog.js";
import type { ModalSettle } from "./components/ui/modal-host.js";
import { openModal } from "./components/ui/modal-host.js";
import {
  type DisplayLensId,
  displayLens,
  displayLensGroups,
  displayLensIdForShape,
} from "./display-lens.js";
import { uiCopy } from "./ui-copy.js";

/** The option value that means "not one of the three". A document picked by
 *  display takes the default resolution — see `DisplayLens.shape` — and the
 *  author changes it in the panel. */
const CUSTOM = "";

/** A reading, not a choice: an author cannot ask for a size that is not a preset
 *  and cannot get stuck on one they chose by accident. Same shape as the
 *  artboard panel's `Custom`, so the two controls say the same thing. */
const CUSTOM_READING: ControlOption = {
  id: CUSTOM,
  name: uiCopy.panels.customSize,
  disabled: true,
};

/**
 * The artboard a new document opens at, chosen before the document exists.
 *
 * **What the theme is for, first.** Three "Custom"s as a starting state asks an
 * author to know a ratio before knowing what the thing is for, and the ratio is
 * the answer that depends on the answer. A new theme is seen through something,
 * so the displays are the question and the ratio is derived.
 *
 * **Custom is a choice, not a fallback.** The technical question is untouched
 * behind it — the same three selects, off the same preset lists, and now also
 * the free width and height the panel carries, so a size no preset names is
 * reachable from here rather than only from the panel afterwards.
 *
 * It opens on the shape of the document it would replace, when there is one, for
 * the reason it always did: an author who has settled on 19.5:9 portrait and
 * presses **New theme** again has answered the size question already.
 *
 * Every control is a `ControlSelect` or a `ControlPair` now, and the modal shell
 * is `Dialog` — the surface is React rather than a hand-built `<dialog>`, with
 * nothing about the questions it asks moved.
 */
export function NewDocumentChooser({
  current,
  settle,
}: {
  readonly current?: ArtboardSize | undefined;
  readonly settle: ModalSettle<NewDocumentAnswer>;
}): React.JSX.Element {
  /** The preset this dialog opens on, and the size that follows from it. */
  const nearest = nearestArtboardPreset(current);
  const opening = artboardSize(
    nearest.ratio,
    nearest.resolution,
    nearest.orientation,
  );
  const sizeId = `vigilia-new-document-size-${useId().replace(/[^\w-]/g, "")}`;

  /** The size the author has settled on, and the display they named. Two values
   *  rather than one, because the display is a choice the technical controls do
   *  not write back: picking a ratio leaves the author's own display alone. */
  const [chosen, adopt] = useState<ArtboardSize>(opening);
  const [display, setDisplay] = useState<string>(() =>
    displayLensIdForShape(nearest),
  );

  /** The three ids the size is at, or `undefined` for the author's own — the
   *  reading a control shows, not an answer it can commit. */
  const preset = artboardPresetFor(chosen);
  const custom = display === CUSTOM;

  const pickDisplay = (id: string): void => {
    setDisplay(id);
    if (id === CUSTOM) return;
    const shape = displayLens(id as DisplayLensId).shape;
    // Through one writer: a display chosen from the list must not leave the
    // technical controls naming a size the dialog is no longer offering.
    adopt(
      artboardSize(
        shape.ratio,
        DEFAULT_ARTBOARD_PRESET.resolution,
        shape.orientation,
      ),
    );
  };

  /** The one writer of the size, read by the three selects, the two free fields
   *  and the readout together, so the answer at confirm time, the number shown
   *  and the presets the controls claim cannot be three different sizes. */
  const derive = (
    which: "ratio" | "orientation" | "resolution",
    id: string,
  ): void => {
    // **Refused, not guessed.** A preset is three answers; an author who typed
    // their own dimensions answered with two free numbers instead, so any one
    // dropdown cannot say what the size is. `artboardPresetFor` returns nothing
    // there and the change is declined — the control snaps back to its reading
    // because its value is derived from `chosen`, which did not move.
    if (preset === undefined) return;
    const next =
      which === "ratio"
        ? {
            ratio: id as ArtboardRatioId,
            orientation: preset.orientation,
            resolution: preset.resolution,
          }
        : which === "orientation"
          ? {
              ratio: preset.ratio,
              orientation: id as ArtboardOrientation,
              resolution: preset.resolution,
            }
          : {
              ratio: preset.ratio,
              orientation: preset.orientation,
              resolution: id as ArtboardResolutionId,
            };
    adopt(artboardSize(next.ratio, next.resolution, next.orientation));
  };

  const answer = (): NewDocumentAnswer => ({
    size: chosen,
    display: custom ? undefined : (display as DisplayLensId),
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) settle.dismiss();
      }}
      label={uiCopy.newDocument.chooseSize}
    >
      <p className="editor-shell-dialog-lead">
        {uiCopy.newDocument.chooseSize}
      </p>
      <div className="flex flex-col gap-[var(--space-8)]">
        <ControlSelect
          label={uiCopy.newDocument.display}
          data={{ "data-vigilia-new-document-display": "" }}
          value={display}
          options={displayOptions(opening)}
          onChange={pickDisplay}
        />
        {/* The technical question, revealed rather than removed: a hidden block
            is out of the accessibility tree, so nothing here is
            reachable-but-unnamed. */}
        <div
          data-vigilia-new-document-custom=""
          hidden={!custom}
          className="flex flex-col gap-[var(--space-8)]"
        >
          <ControlSelect
            label={uiCopy.panels.ratio}
            data={{ "data-vigilia-new-document-ratio": "" }}
            value={preset?.ratio ?? CUSTOM}
            options={ratioOptions()}
            onChange={(id) => derive("ratio", id)}
          />
          <ControlSelect
            label={uiCopy.panels.orientation}
            data={{ "data-vigilia-new-document-orientation": "" }}
            value={preset?.orientation ?? CUSTOM}
            options={orientationOptions()}
            onChange={(id) => derive("orientation", id)}
          />
          <ControlSelect
            label={uiCopy.panels.resolution}
            data={{ "data-vigilia-new-document-resolution": "" }}
            value={preset?.resolution ?? CUSTOM}
            options={resolutionOptions()}
            onChange={(id) => derive("resolution", id)}
          />
          {/* The free size the panel already carries, through the panel's own
              pair so the chooser and the panel bound an author's dimensions the
              same way rather than the chooser inventing a second pair. */}
          <ControlPair
            label={uiCopy.panels.size}
            halves={[
              {
                label: uiCopy.panels.widthMark,
                value: chosen.width,
                data: { "data-vigilia-new-document-width": "" },
                integer: true,
                min: 1,
                max: MAX_ARTBOARD_DIMENSION,
                onCommit: (width) => adopt({ width, height: chosen.height }),
              },
              {
                label: uiCopy.panels.heightMark,
                value: chosen.height,
                data: { "data-vigilia-new-document-height": "" },
                integer: true,
                min: 1,
                max: MAX_ARTBOARD_DIMENSION,
                onCommit: (height) => adopt({ width: chosen.width, height }),
              },
            ]}
          />
        </div>
        {/* The size on screen, live. Four controls that only combine into a
            number are four guesses, and the author would find out the size only
            after committing to it. */}
        <div className="vigilia-field">
          <label htmlFor={sizeId}>{uiCopy.panels.size}</label>
          <output
            id={sizeId}
            // `tabular-nums` was `.vigilia-dialog .vigilia-dialog-size`'s only
            // rule, and the popup is `.editor-shell-dialog` now, so the
            // descendant match is gone: this number is the one that must not
            // jitter as its digits change.
            className="tabular-nums"
            data-vigilia-new-document-size=""
          >
            {`${chosen.width} × ${chosen.height}`}
          </output>
        </div>
        <div className="vigilia-dialog-actions">
          <button
            type="button"
            className={ACTION_BUTTON}
            data-vigilia-new-document-cancel=""
            onClick={settle.dismiss}
          >
            {uiCopy.newDocument.cancel}
          </button>
          <button
            type="button"
            className={ACTION_BUTTON}
            data-vigilia-new-document-create=""
            onClick={() => settle.close(answer())}
          >
            {uiCopy.newDocument.create}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** The displays, grouped by the display menu's own grouping. Two headings over
 *  one list, because six bare ratios read as one undifferentiated list —
 *  Landscape first for the artboard's own orientation, through the one
 *  predicate. Custom is the last entry and its own flat run, one option away. */
function displayOptions(opening: ArtboardSize): readonly ControlOption[] {
  const options: ControlOption[] = [];
  for (const group of displayLensGroups(artboardOrientation(opening))) {
    for (const lens of group.lenses) {
      options.push({
        id: lens.id,
        name: uiCopy.display.displays[lens.id],
        group: uiCopy.artboardOrientations[group.orientation],
      });
    }
  }
  options.push({ id: CUSTOM, name: uiCopy.newDocument.custom });
  return options;
}

function ratioOptions(): readonly ControlOption[] {
  return [
    ...ARTBOARD_RATIOS.map((entry) => ({ id: entry.id, name: entry.id })),
    CUSTOM_READING,
  ];
}

function orientationOptions(): readonly ControlOption[] {
  return [
    ...ARTBOARD_ORIENTATIONS.map((id) => ({
      id,
      name: uiCopy.artboardOrientations[id],
    })),
    CUSTOM_READING,
  ];
}

function resolutionOptions(): readonly ControlOption[] {
  return [
    ...ARTBOARD_RESOLUTIONS.map((entry) => ({
      id: entry.id,
      name: uiCopy.artboardResolutions[entry.id],
    })),
    CUSTOM_READING,
  ];
}

/**
 * What the author answered: the artboard to create, and the display to see it
 * through.
 *
 * **Both halves travel together because both were asked.** The display is the
 * first question and was previously written and never read — a 1080 × 2340
 * document opened inside a landscape frame, wasting stage on bars the author had
 * already told us not to want. Carrying only the size made the answer to that
 * question unreachable from here.
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
 * author declining to name a display, and Fit is the framing that names none.
 * A document at a display's own shape, by contrast, is offered back with that
 * display already ticked.
 *
 * The size is not a preset: three of the four ways to reach one here are a
 * preset and one is an author's own dimensions, and a type that cannot carry
 * both would have the session guess which the author meant.
 */
export function chooseArtboardSize(
  current?: ArtboardSize,
): Promise<NewDocumentAnswer | undefined> {
  return openModal((settle) =>
    createElement(NewDocumentChooser, { current, settle }),
  );
}
