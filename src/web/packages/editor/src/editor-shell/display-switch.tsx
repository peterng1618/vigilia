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

/** The radio value standing for "no display", because `undefined` is what the
 *  camera reports under Fit and a radio group compares by identity. */
const NO_DISPLAY = "";

export function DisplaySwitch({
  viewport,
}: {
  readonly viewport: ViewportManager;
}): React.JSX.Element {
  const zoom = useZoom(viewport);
  const display = useDisplay(viewport);

  return (
    <Menu.Root>
      <Menu.Trigger
        className="editor-shell-zoom editor-glass"
        aria-label={uiCopy.display.label}
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
        {`${Math.round(zoom * 100)}%`}
      </Menu.Trigger>
      <Menu.Portal keepMounted>
        <Menu.Positioner className="editor-shell-positioner">
          <Menu.Popup className="editor-shell-menu-popup">
            {/* Fit and the three displays are one radio group because they are
                one fact: what the stage looks through. Split into checkable
                and plain items, `Fit` could sit unselected while a display
                stayed ticked — a menu holding two answers to one question. */}
            <Menu.RadioGroup
              value={display ?? NO_DISPLAY}
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
                <Menu.RadioItemIndicator className="editor-shell-menu-tick">
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
                  <Menu.RadioItemIndicator className="editor-shell-menu-tick">
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