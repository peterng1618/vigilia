import { Menu } from "@base-ui/react/menu";
import { useCallback, useSyncExternalStore } from "react";
import {
  artboardOrientation,
  type ArtboardOrientation,
  type ArtboardSize,
} from "../artboard-presets.js";
import { type DisplayLens, type DisplayLensId, displayLensGroups } from "../display-lens.js";
import { uiCopy } from "../ui-copy.js";
import type { ViewportManager } from "../viewport-manager/index.js";

/**
 * One subscription for both camera facts, read as **primitives** so an
 * unchanged camera yields a stable snapshot. Returning an object here would
 * re-render the control forever, which is why the zoom alone was a number
 * before the display arrived.
 */
function useZoom(viewport: ViewportManager): number {
  const subscribe = useCallback(
    (listener: () => void) => viewport.onChange(listener),
    [viewport],
  );
  return useSyncExternalStore(subscribe, () => viewport.zoom());
}

function useDisplay(viewport: ViewportManager): DisplayLensId | undefined {
  const subscribe = useCallback(
    (listener: () => void) => viewport.onChange(listener),
    [viewport],
  );
  return useSyncExternalStore(subscribe, () => viewport.display());
}

function useIsFitted(viewport: ViewportManager): boolean {
  const subscribe = useCallback(
    (listener: () => void) => viewport.onChange(listener),
    [viewport],
  );
  return useSyncExternalStore(subscribe, () => viewport.isFitted());
}

/** Which group of previews leads — the artboard's own orientation, read
 *  through the one predicate, as a primitive for the reason the three above
 *  are: an object here would re-render the control on every camera change.
 *
 *  The camera's change event is also how a new **artboard** announces itself:
 *  `setArtboard` refits, and a refit notifies. So this is a document fact
 *  arriving on the camera's channel, which is worth knowing before someone
 *  looks for a second subscription to add. */
function useArtboardOrientation(
  viewport: ViewportManager,
  artboard: () => ArtboardSize,
): ArtboardOrientation {
  const subscribe = useCallback(
    (listener: () => void) => viewport.onChange(listener),
    [viewport],
  );
  return useSyncExternalStore(subscribe, () =>
    artboardOrientation(artboard()),
  );
}

/** The radio value standing for Fit — the whole stage, with no display in it. */
const NO_DISPLAY = "";

/** The radio value for a camera that is neither looking through a display nor
 *  fitted. No item carries it, so the menu ticks nothing rather than ticking
 *  the nearest thing: 100 % clears the display and is not a fit, and reporting
 *  it as Fit is the control asserting a framing the camera is not in. */
const NEITHER = "neither";

export function DisplaySwitch({
  viewport,
  artboard,
}: {
  readonly viewport: ViewportManager;
  /** The document's own size, so the group of previews that suits it leads. */
  readonly artboard: () => ArtboardSize;
}): React.JSX.Element {
  const zoom = useZoom(viewport);
  const display = useDisplay(viewport);
  const isFitted = useIsFitted(viewport);
  const orientation = useArtboardOrientation(viewport, artboard);
  const groups = displayLensGroups(orientation);
  const percent = `${Math.round(zoom * 100)}%`;

  return (
    <Menu.Root>
      <Menu.Trigger
        className="editor-shell-zoom editor-glass"
        // The name carries the concept *and* the readout, because the readout
        // is also the visible text: WCAG 2.5.3 asks an accessible name to
        // contain what is on screen, and "Display and zoom" over a button that
        // says "51%" contains none of it. Naming it the other way round —
        // dropping the label and letting "51%" stand alone — would leave a
        // control no voice user could ask for by what it is.
        aria-label={`${uiCopy.display.label}: ${percent}`}
        data-vigilia-zoom=""
      >
        {/* The zoom, always — never the display's name.
         *
         * The control *is* the zoom readout still: it is where the author reads
         * the camera's scale, and two browser tests pin that as a capability
         * this plan does not remove. The display it is looking through is said
         * by the frame drawn around the stage, which is a shape rather than a
         * word, and by the checkmark in this menu. Putting the name here
         * instead would have made the percentage disappear whenever a display
         * was chosen — which is the default. */}
        {percent}
      </Menu.Trigger>
      <Menu.Portal keepMounted>
        <Menu.Positioner className="editor-shell-positioner">
          <Menu.Popup className="editor-shell-menu-popup">
            {/* Fit and the three displays are one radio group because they are
                one fact: what the stage looks through. Split into checkable
                and plain items, `Fit` could sit unselected while a display
                stayed ticked — a menu holding two answers to one question.

                The tick is read off the camera, not off the display alone:
                `display()` answers "which window", and Fit is a camera
                position rather than a window, so a cleared lens with a manual
                zoom is neither and says nothing. */}
            <Menu.RadioGroup
              value={display ?? (isFitted ? NO_DISPLAY : NEITHER)}
              onValueChange={(value: string) =>
                viewport.showDisplay(
                  value === NO_DISPLAY ? undefined : (value as DisplayLensId),
                )
              }
            >
              <Menu.RadioItem
                value={NO_DISPLAY}
                closeOnClick
                aria-label={uiCopy.display.fit}
              >
                {/* `keepMounted` is what makes the gutter exist at all: the
                    indicator defaults to unmounted when its item is not the
                    checked one, so without it every label but the ticked one's
                    sits a gutter-width to the left. */}
                <Menu.RadioItemIndicator
                  className="editor-shell-menu-tick"
                  keepMounted
                >
                  {"•"}
                </Menu.RadioItemIndicator>
                {uiCopy.display.fit}
              </Menu.RadioItem>
              {/* Two labelled groups rather than six bare ratios: the author
                  has to see which of them is the way up their theme is before
                  they can tell any of them apart, and a portrait theme is
                  usually not looking for a landscape preview. */}
              {groups.map((group) => (
                <Menu.Group key={group.orientation}>
                  <Menu.GroupLabel className="editor-shell-menu-label">
                    {uiCopy.artboardOrientations[group.orientation]}
                  </Menu.GroupLabel>
                  {group.lenses.map(lensItem)}
                </Menu.Group>
              ))}
            </Menu.RadioGroup>
            <Menu.Item
              aria-label={uiCopy.display.toSelection}
              onClick={() => viewport.zoomToSelection()}
            >
              {uiCopy.display.toSelection}
            </Menu.Item>
            <Menu.Item
              aria-label={uiCopy.display.actualSize}
              onClick={() => viewport.reset()}
            >
              {uiCopy.display.actualSize}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** One preview, named by the aspect it frames. Extracted so the group's map and
 *  the tick's gutter comment are not read apart from each other. */
function lensItem(lens: DisplayLens): React.JSX.Element {
  return (
    <Menu.RadioItem
      key={lens.id}
      value={lens.id}
      closeOnClick
      aria-label={uiCopy.display.displays[lens.id]}
    >
      <Menu.RadioItemIndicator
        className="editor-shell-menu-tick"
        keepMounted
      >
        {"•"}
      </Menu.RadioItemIndicator>
      {uiCopy.display.displays[lens.id]}
    </Menu.RadioItem>
  );
}