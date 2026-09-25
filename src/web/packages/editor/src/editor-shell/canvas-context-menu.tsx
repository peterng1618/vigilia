import { ContextMenu } from "@base-ui/react/context-menu";
import { CHART_FAMILIES } from "@vigilia/renderer-core";
import { useEffect, useMemo, useState } from "react";
import { actionEnabled, OBJECT_ACTIONS } from "../object-actions.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge } from "./bridge.js";
import type { EditorActionFacade } from "./session-facade.js";

interface OpenMenu {
  readonly x: number;
  readonly y: number;
  /** Whether the pointer hit an object. The entries follow the *hit*, not the
   * current selection: a right-click never changes the selection. */
  readonly onObject: boolean;
}

interface MenuEntry {
  readonly id: string;
  readonly label: string;
  readonly run: () => void;
}

/** Empty-canvas entries. They route through the session facade and deliberately
 * never enter `OBJECT_ACTIONS`, which owns object commands only. */
function creationEntries(session: EditorActionFacade): readonly MenuEntry[] {
  return [
    { id: "text", label: uiCopy.panels.text, run: () => session.addText() },
    ...CHART_FAMILIES.map((family) => ({
      id: family,
      label: uiCopy.chartFamilies[family],
      run: () => session.addChart(family),
    })),
  ];
}

/**
 * The canvas's context menu. Object entries are the dock's own registry answer,
 * so the two surfaces cannot advertise different commands for one selection;
 * empty canvas offers creation instead.
 *
 * There is deliberately no `ContextMenu.Trigger`: Fabric binds its own
 * `contextmenu` listener on `upperCanvasEl` and stops propagation, which would
 * starve a parent Trigger's listener. Listening on that same element is not
 * blocked by it, so the root is opened from a controlled `open` instead.
 */
export function CanvasContextMenu({
  bridge,
}: {
  readonly bridge: EditorShellBridge | undefined;
}): React.JSX.Element {
  const [menu, setMenu] = useState<OpenMenu | undefined>(undefined);
  const canvas = bridge?.editor.canvas;

  useEffect(() => {
    if (canvas === undefined) return;
    const element = canvas.upperCanvasEl;
    const onContextMenu = (event: MouseEvent): void => {
      // Suppression lives here and only here: a document-wide handler would take
      // the native menu away from the rest of the editor.
      event.preventDefault();
      const { target } = canvas.findTarget(event);
      // Fabric's `__onMouseDown` returns early for `button !== 0`, so the object
      // under the pointer is not the selection. Select it, or `actionEnabled`
      // would gate the entries against whatever was selected before.
      if (target !== undefined) {
        canvas.setActiveObject(target);
        canvas.requestRenderAll();
      }
      setMenu({
        x: event.clientX,
        y: event.clientY,
        onObject: target !== undefined,
      });
    };
    element.addEventListener("contextmenu", onContextMenu);
    return () => element.removeEventListener("contextmenu", onContextMenu);
  }, [canvas]);

  // A zero-sized rect at the pointer: the menu is anchored to the gesture, not
  // to an element, so there is no element for `Positioner` to measure.
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: (): DOMRect =>
        DOMRect.fromRect({
          x: menu?.x ?? 0,
          y: menu?.y ?? 0,
          width: 0,
          height: 0,
        }),
    }),
    [menu],
  );

  const entries: readonly MenuEntry[] =
    menu === undefined || bridge === undefined
      ? []
      : menu.onObject
        ? OBJECT_ACTIONS.filter((action) =>
            actionEnabled(bridge, action.id),
          ).map((action) => ({
            id: action.id,
            label: action.label,
            run: () => bridge.run(action.id),
          }))
        : creationEntries(bridge.session);

  return (
    <ContextMenu.Root
      open={menu !== undefined}
      onOpenChange={(next) => {
        if (!next) setMenu(undefined);
      }}
    >
      <ContextMenu.Portal>
        <ContextMenu.Positioner
          anchor={anchor}
          className="editor-shell-positioner"
        >
          <ContextMenu.Popup
            className="editor-shell-menu-popup"
            aria-label={uiCopy.canvasMenu.label}
          >
            {entries.map((entry) => (
              <ContextMenu.Item
                key={entry.id}
                aria-label={entry.label}
                onClick={entry.run}
              >
                {entry.label}
              </ContextMenu.Item>
            ))}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
