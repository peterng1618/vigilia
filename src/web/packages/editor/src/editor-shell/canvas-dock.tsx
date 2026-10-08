import { useEffect, useRef, useState } from "react";
import {
  actionEnabled,
  arrangeActions,
  type ObjectActionId,
  OBJECT_ACTIONS,
} from "../object-actions.js";
import {
  shortcutLabel,
  shortcutSpokenLabel,
} from "../shortcut-manager/display.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge } from "./bridge.js";
import { tooltip } from "./controls/tooltip.js";

/**
 * One dock button. The tooltip is a DOM control, so React owns the button and
 * the effect owns the popup — a React tooltip here would be a second owner for
 * something the selection inspector, which never sees React, also has to use.
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
  useEffect(() => {
    const button = ref.current;
    if (button === null) return;
    // Two calls rather than one with a conditional field: `exactOptionalPropertyTypes`
    // forbids passing `undefined`, and a caller with no chord must omit it.
    return (
      shortcut === undefined
        ? tooltip({ trigger: button, text: label })
        : tooltip({ trigger: button, text: label, shortcut })
    ).destroy;
    // Changing the selection changes which chords are mounted, so a popup must
    // be rebuilt when the chord changes — otherwise it shows the previous one.
  }, [label, shortcut]);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
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
  useEffect(() => {
    const button = ref.current;
    if (button === null) return;
    return tooltip({ trigger: button, text: label }).destroy;
  }, [label]);
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
        : OBJECT_ACTIONS.filter((action) => actionEnabled(bridge, action.id)).map(
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
                <Icon aria-hidden size={15} strokeWidth={1.75} />
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
          <Icon aria-hidden size={15} strokeWidth={1.75} />
        </ArrangeAction>
      ))}
    </nav>
  );
}
