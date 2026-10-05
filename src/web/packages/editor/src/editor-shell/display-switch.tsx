import { Menu } from "@base-ui/react/menu";
import { useCallback, useSyncExternalStore } from "react";
import { DISPLAY_LENSES, type DisplayLensId } from "../display-lens.js";
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

/** The radio value standing for Fit — the whole stage, with no display in it. */
const NO_DISPLAY = "";

/** The radio value for a camera that is neither looking through a display nor
 *  fitted. No item carries it, so the menu ticks nothing rather than ticking
 *  the nearest thing: 100 % clears the display and is not a fit, and reporting
 *  it as Fit is the control asserting a framing the camera is not in. */
const NEITHER = "neither";

export function DisplaySwitch({
  viewport,
}: {
  readonly viewport: ViewportManager;
}): React.JSX.Element {
  const zoom = useZoom(viewport);
  const display = useDisplay(viewport);
  const isFitted = useIsFitted(viewport);
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
              {DISPLAY_LENSES.map((lens) => (
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