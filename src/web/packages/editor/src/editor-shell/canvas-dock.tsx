import { Tooltip } from "@base-ui/react/tooltip";
import { useEffect, useState } from "react";
import {
  actionEnabled,
  arrangeActions,
  OBJECT_ACTIONS,
} from "../object-actions.js";
import type { EditorShellBridge } from "./bridge.js";

const noSelection = {
  selectedCount: 0,
  locked: false,
  activeKind: "none",
} as const;

/** The dock is a pure registry render: what shows is the registry's answer. */
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
      : [...OBJECT_ACTIONS, ...arrangeActions()].filter((action) =>
          actionEnabled(bridge, action.id),
        );

  return (
    <>
      {actions.map(({ id, icon: Icon, label }) => (
        <Tooltip.Root key={id}>
          <Tooltip.Trigger
            aria-label={label}
            onClick={() => bridge?.run(id)}
          >
            <Icon aria-hidden size={15} strokeWidth={1.75} />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={8}>
              <Tooltip.Popup className="editor-shell-tooltip" role="tooltip">
                {label}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ))}
    </>
  );
}
