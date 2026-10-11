import { useEffect, useRef, useState } from "react";
import { useControlTooltip } from "../components/ui/control-icon-button.js";
import {
  actionEnabled,
  arrangeActions,
  type ObjectActionId,
  objectActionsFor,
} from "../object-actions.js";
import { useActiveShortcuts } from "../shortcut-manager/bindings.js";
import {
  shortcutLabel,
  shortcutSpokenLabel,
} from "../shortcut-manager/display.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge } from "./bridge.js";
import { Glyph } from "./icons.js";

/**
 * DESIGN.md §4: `--hot` marks destructive affordances, and delete is the only object
 * action that is one. The registry owns the id; the dock owns how it draws it.
 */
const DESTRUCTIVE_ACTIONS: ReadonlySet<ObjectActionId> = new Set(["delete"]);

/**
 * One dock button. The tooltip is a DOM control, so React owns the button and
 * the control set's `useControlTooltip` owns the popup — a React tooltip here
 * would be a second owner for something the selection inspector, which never
 * sees React, also has to use.
 */
function Action({
  bridge,
  id,
  label,
  shortcut,
  children,
}: {
  readonly bridge: EditorShellBridge | undefined;
  readonly id: ObjectActionId;
  readonly label: string;
  readonly shortcut:
    | { readonly printed: string; readonly spoken: string }
    | undefined;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  // The chord is part of the popup, so a rebind has to rebuild it — the control
  // set's one tooltip owner re-runs on the chord rather than only on the label.
  useControlTooltip(ref, label, shortcut);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      // A `data-*` hook is the mark, not an ARIA state: nothing about a
      // destructive action is a toggle or a pressed state to announce.
      data-vigilia-destructive={DESTRUCTIVE_ACTIONS.has(id) ? "" : undefined}
      onClick={() => bridge?.run(id)}
    >
      {children}
    </button>
  );
}

/**
 * Arrange shares the dock but greys rather than filters: it needs two or more
 * objects, so it draws disabled with nothing selected and comes alive as the
 * selection grows. The product binds no chord for any of the eight, so its
 * popup is the words alone — and the marker is what the context menu's browser
 * test uses to tell the object actions from the arrange ones on one surface.
 */
function ArrangeAction({
  bridge,
  id,
  label,
  disabled,
  children,
}: {
  readonly bridge: EditorShellBridge | undefined;
  readonly id: ObjectActionId;
  readonly label: string;
  readonly disabled: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  useControlTooltip(ref, label);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-vigilia-arrange-action=""
      disabled={disabled}
      onClick={() => bridge?.run(id)}
    >
      {children}
    </button>
  );
}

/**
 * The one contextual toolbar on the canvas: the object actions this selection
 * can run, then the arrange actions it is too small to enable. Both render from
 * the registry — and both ask it the same way, so the surface never re-decides
 * eligibility. It filters the object half (an action this selection cannot run
 * is not shown) and greys the arrange half (an action it is too small for is
 * still discoverable, as the old toolbar drew it).
 */
export function CanvasDock({
  bridge,
}: {
  readonly bridge: EditorShellBridge | undefined;
}): React.JSX.Element {
  // Every read below goes through the bridge, which projects the live selection
  // on demand — so the notification only has to force a render, and the filtered
  // and greyed halves both follow the selection without holding a copy of it.
  const [, setRevision] = useState(0);
  // And the chords the tooltips print follow the live binding table, for the
  // same reason: `tooltip()` is rebuilt from the chord on every change, so a
  // rebind has to re-render this surface rather than only reach the dispatcher.
  useActiveShortcuts();
  useEffect(
    () => bridge?.subscribe(() => setRevision((revision) => revision + 1)),
    [bridge],
  );

  return (
    <nav
      className="editor-shell-dock editor-glass"
      role="toolbar"
      aria-label={uiCopy.canvasToolbar.label}
      data-vigilia-canvas-toolbar=""
      // The surface derives its own visibility: it is present as soon as a
      // document is, so the arrange half stays discoverable before a selection
      // exists and the object half appears as it becomes eligible.
      data-visible={bridge !== undefined}
    >
      {bridge === undefined
        ? null
        : objectActionsFor(bridge).map(
            ({ id, icon: Icon, label, shortcut }) => (
              <Action
                key={id}
                bridge={bridge}
                id={id}
                label={label}
                shortcut={
                  shortcut === undefined
                    ? undefined
                    : {
                        printed: shortcutLabel(shortcut),
                        spoken: shortcutSpokenLabel(shortcut),
                      }
                }
              >
                <Glyph icon={Icon} size={15} />
              </Action>
            ),
          )}
      {arrangeActions().map(({ id, icon: Icon, label }) => (
        <ArrangeAction
          key={id}
          bridge={bridge}
          id={id}
          label={label}
          disabled={bridge === undefined || !actionEnabled(bridge, id)}
        >
          <Glyph icon={Icon} size={15} />
        </ArrangeAction>
      ))}
    </nav>
  );
}
