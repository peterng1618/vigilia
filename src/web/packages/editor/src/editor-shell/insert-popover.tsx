import { Menu } from "@base-ui/react/menu";
import type { RefObject } from "react";
import { insertGroups, type InsertableObject } from "../new-object-panel.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorActionFacade } from "./session-facade.js";

/** Two insertable objects can share a label — a shape Line and a chart Line —
 *  so the key carries what makes them different rather than what they are
 *  called, and the two stay two rows. */
function entryKey(object: InsertableObject): string {
  switch (object.kind) {
    case "text":
      return "text";
    case "card":
      return `card:${object.card}`;
    case "shape":
      return `shape:${object.shape}`;
    case "chart":
      return `chart:${object.family}`;
  }
}

/** One row, dispatching the construction its own owner holds.
 *
 *  A card's refusal is the session's to report — `insertCard` returns nothing
 *  and the session tells the author itself — so the arm is left bare and
 *  nothing here reports it a second time. */
function entry(
  object: InsertableObject,
  session: EditorActionFacade | undefined,
): React.JSX.Element {
  const run = (): void => {
    switch (object.kind) {
      case "text":
        session?.addText();
        return;
      case "card":
        session?.insertCard(object.card);
        return;
      case "shape":
        session?.addShape(object.shape);
        return;
      case "chart":
        session?.addChart(object.family);
    }
  };

  return (
    <Menu.Item key={entryKey(object)} onClick={run}>
      {object.label}
    </Menu.Item>
  );
}

/** The `+`'s chooser: the Add pane's own list, offered from the pane bar.
 *
 *  A fourth *rendering* of `insertGroups()` and never a fourth list — the
 *  panel that came to be missing from the menubar while the pane had it is what
 *  that one owner exists to prevent, so membership and group order are read
 *  from it directly and no surface here names a card, a shape or a chart.
 *
 *  The trigger stays the pane bar's own button: it is the `+` an author already
 *  sees, and this owns only what the press opens. It renders no element outside
 *  its portal, so it can sit beside the bar without becoming part of it.
 */
export function InsertPopover({
  session,
  open,
  onOpenChange,
  anchor,
}: {
  readonly session: EditorActionFacade | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The `+` itself. `Positioner` anchors to the element rather than to a
   *  `Trigger`, because the button belongs to the bar and stays there. */
  readonly anchor: RefObject<HTMLElement | null>;
}): React.JSX.Element {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Portal>
        <Menu.Positioner className="editor-shell-positioner" anchor={anchor}>
          <Menu.Popup
            className="editor-shell-menu-popup"
            aria-label={uiCopy.menus.insert}
          >
            {insertGroups().map((group) =>
              group.label === undefined ? (
                group.objects.map((object) => entry(object, session))
              ) : (
                <Menu.Group key={group.label}>
                  <Menu.GroupLabel className="editor-shell-menu-label">
                    {group.label}
                  </Menu.GroupLabel>
                  {group.objects.map((object) => entry(object, session))}
                </Menu.Group>
              ),
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
