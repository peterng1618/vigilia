import { useEffect, useRef, useState } from "react";
import {
  actionEnabled,
  type ObjectActionId,
  OBJECT_ACTIONS,
} from "../object-actions.js";
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
  children,
}: {
  readonly bridge: EditorShellBridge | undefined;
  readonly id: ObjectActionId;
  readonly label: string;
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
      {actions.map(({ id, icon: Icon, label }) => (
        <Action key={id} bridge={bridge} id={id} label={label}>
          <Icon aria-hidden size={15} strokeWidth={1.75} />
        </Action>
      ))}
    </>
  );
}
