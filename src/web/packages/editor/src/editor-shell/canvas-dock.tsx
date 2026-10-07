import { useEffect, useRef, useState } from "react";
import {
  actionEnabled,
  type ObjectActionId,
  OBJECT_ACTIONS,
} from "../object-actions.js";
import { shortcutLabel } from "../shortcut-manager/display.js";
import type { EditorShellBridge } from "./bridge.js";
import { tooltip } from "./controls/tooltip.js";

const noSelection = {
  selectedCount: 0,
  locked: false,
  activeKind: "none",
} as const;

/**
 * One dock action. The tooltip is a DOM control, so React owns the button and
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
  readonly shortcut: string | undefined;
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

/** The dock renders object actions only: arrange belongs to the top toolbar. */
export function CanvasDock({
  bridge,
  onVisibility,
}: {
  readonly bridge: EditorShellBridge | undefined;
  readonly onVisibility: (visible: boolean) => void;
}): React.JSX.Element {
  const [snapshot, setSnapshot] = useState(
    () => bridge?.snapshot() ?? noSelection,
  );
  useEffect(() => {
    setSnapshot(bridge?.snapshot() ?? noSelection);
    return bridge?.subscribe(() => setSnapshot(bridge.snapshot()));
  }, [bridge]);
  useEffect(
    () => onVisibility(snapshot.selectedCount > 0),
    [onVisibility, snapshot.selectedCount],
  );

  const actions =
    bridge === undefined
      ? []
      : OBJECT_ACTIONS.filter((action) => actionEnabled(bridge, action.id));

  return (
    <>
      {actions.map(({ id, icon: Icon, label, shortcut }) => (
        <Action
          key={id}
          bridge={bridge}
          id={id}
          label={label}
          shortcut={shortcut === undefined ? undefined : shortcutLabel(shortcut)}
        >
          <Icon aria-hidden size={15} strokeWidth={1.75} />
        </Action>
      ))}
    </>
  );
}
