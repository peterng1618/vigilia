import { ContextMenu } from "@base-ui/react/context-menu";
import { useEffect, useMemo, useState } from "react";
import { objectActionsFor } from "../object-actions.js";
import { insertGroups } from "../new-object-panel.js";
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

/** A heading's worth of them, or `undefined` for an entry that stands alone. */
interface MenuGroup {
  readonly label: string | undefined;
  readonly entries: readonly MenuEntry[];
}

/**
 * Empty-canvas entries, in the Add pane's own groups and order.
 *
 * **The canvas's own copy, folded into the pane's.** This used to read
 * `CHART_FAMILIES` itself — so it could not drift on charts, which is why it
 * was never F1.7's defect — but it was still a third place that knew what can
 * be inserted, and the one that most needed the pane's rule. It offered
 * five of the things the product inserts, with no shape in it, so a
 * right-click on empty canvas was a strictly poorer version of the pane
 * one gesture away. Now it is that list: `insertGroups()` is the owner
 * it already declared itself to be, and the group headings are what keep
 * "Line" from meaning whichever of the two things the reader saw first.
 *
 * The entries route through the session façade and deliberately never enter
 * `OBJECT_ACTIONS`, which owns object commands only.
 */
function creationGroups(session: EditorActionFacade): readonly MenuGroup[] {
  return insertGroups().map((group) => ({
    label: group.label,
    entries: group.objects.map((object) => ({
      // A key only has to be unique inside its own group, and each of the
      // pane's groups spells its objects once — the same reasoning the pane
      // already rests on.
      id: object.label,
      label: object.label,
      run: () => {
        switch (object.kind) {
          case "text":
            session.addText();
            return;
          case "card":
            session.insertCard(object.card);
            return;
          case "shape":
            session.addShape(object.shape);
            return;
          case "chart":
            session.addChart(object.family);
        }
      },
    })),
  }));
}

/** One entry. `aria-label` and the text agree, so the name is the same whether
 *  a screen reader reads the row or the reader looks at it. */
function entryItem(entry: MenuEntry): React.JSX.Element {
  return (
    <ContextMenu.Item
      key={entry.id}
      aria-label={entry.label}
      onClick={entry.run}
    >
      {entry.label}
    </ContextMenu.Item>
  );
}

function groupItems(group: MenuGroup): React.JSX.Element {
  if (group.label === undefined) {
    return <>{group.entries.map(entryItem)}</>;
  }
  return (
    <ContextMenu.Group key={group.label}>
      <ContextMenu.GroupLabel className="editor-shell-menu-label">
        {group.label}
      </ContextMenu.GroupLabel>
      {group.entries.map(entryItem)}
    </ContextMenu.Group>
  );
}

/**
 * The canvas's context menu. Object entries are the dock's own registry answer,
 * so the two surfaces cannot advertise different commands for one selection;
 * empty canvas offers the Add pane's own creation list.
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

  const objectEntries: readonly MenuEntry[] =
    menu === undefined || bridge === undefined || !menu.onObject
      ? []
      : objectActionsFor(bridge).map((action) => ({
          id: action.id,
          label: action.label,
          run: () => bridge.run(action.id),
        }));

  const creation =
    menu !== undefined && bridge !== undefined && !menu.onObject
      ? creationGroups(bridge.session)
      : [];

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
            {objectEntries.map(entryItem)}
            {creation.map(groupItems)}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
