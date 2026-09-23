import { Tooltip } from "@base-ui/react/tooltip";
import { useEffect, useState } from "react";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge, ShellAction } from "./bridge.js";

const noSelection = {
  selectedCount: 0,
  locked: false,
  activeKind: "none",
} as const;

/** The dock carries the retired floating toolbar's action set verbatim. */
export function dockActions(locked: boolean): readonly (readonly [
  ShellAction,
  string,
  string,
])[] {
  const lock = locked
    ? (["unlock", "\u{1F513}", uiCopy.actions.unlock] as const)
    : (["lock", "\u{1F512}", uiCopy.actions.lock] as const);
  return [
    ["duplicate", "⧉", uiCopy.actions.duplicate],
    lock,
    ["front", "↑↑", uiCopy.actions.front],
    ["bring-forward", "↑", uiCopy.actions.bringForward],
    ["send-backward", "↓", uiCopy.actions.sendBackward],
    ["back", "↓↓", uiCopy.actions.back],
    ["group", "▣", uiCopy.actions.group],
    ["ungroup", "▦", uiCopy.actions.ungroup],
    [{ type: "arrange", action: "align-left" }, "⫷", uiCopy.actions.align],
    [
      { type: "arrange", action: "distribute-x" },
      "↔",
      uiCopy.actions.distribute,
    ],
    ["delete", "×", uiCopy.actions.delete],
  ];
}

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

  const actions = dockActions(snapshot.locked);

  return (
    <>
      {actions
        .filter(([action]) => bridge?.can(action) === true)
        .map(([action, icon, label]) => (
          <Tooltip.Root key={label}>
            <Tooltip.Trigger
              aria-label={label}
              onClick={() => bridge?.run(action)}
            >
              {icon}
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
