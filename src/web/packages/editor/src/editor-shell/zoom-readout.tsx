import { Menu } from "@base-ui/react/menu";
import { useCallback, useSyncExternalStore } from "react";
import { uiCopy } from "../ui-copy.js";
import type { ViewportManager } from "../viewport-manager/index.js";

/** Reads the camera through its own subscription. `getSnapshot` returns a
 * primitive so an unchanged camera yields a stable snapshot — a fresh object
 * here would re-render the readout forever. */
function useZoom(viewport: ViewportManager): number {
  const subscribe = useCallback(
    (listener: () => void) => viewport.onChange(listener),
    [viewport],
  );
  return useSyncExternalStore(subscribe, () => viewport.zoom());
}

export function ZoomReadout({
  viewport,
}: {
  readonly viewport: ViewportManager;
}): React.JSX.Element {
  const zoom = useZoom(viewport);
  const item = (label: string, run: () => void): React.JSX.Element => (
    <Menu.Item aria-label={label} onClick={run}>
      {label}
    </Menu.Item>
  );

  return (
    <Menu.Root>
      <Menu.Trigger
        className="editor-shell-zoom editor-glass"
        aria-label={uiCopy.zoom.label}
        data-vigilia-zoom=""
      >
        {`${Math.round(zoom * 100)}%`}
      </Menu.Trigger>
      <Menu.Portal keepMounted>
        <Menu.Positioner className="editor-shell-positioner">
          <Menu.Popup className="editor-shell-menu-popup">
            {item(uiCopy.zoom.toFit, () => viewport.zoomToFit())}
            {item(uiCopy.zoom.toSelection, () => viewport.zoomToSelection())}
            {item(uiCopy.zoom.actualSize, () => viewport.reset())}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
