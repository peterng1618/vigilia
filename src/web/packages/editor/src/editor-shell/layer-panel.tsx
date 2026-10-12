import { ControlIconButton } from "../components/ui/control-icon-button.js";
import { destructiveMarker, objectActionsFor } from "../object-actions.js";
import type { EditorShellBridge } from "./bridge.js";
import { Glyph } from "./icons.js";

/**
 * The Composition pane's footer toolbar: the object actions the registry says
 * this selection can run, and nothing else (§7.3, "a pane footer is bounded by
 * its pane"). It is a Pane footer rather than a row of the tree, so it belongs
 * to the pane and not to the list. The pane still scrolls as one — the scroll
 * box is `aside.editor-shell-panel`, which holds header, body and this footer —
 * so it does not stay pinned while the list moves under it. That gap against
 * §7.7 is filed as `vg-208`; the aside is deliberately the single scroller.
 *
 * Eligibility is the registry's alone — `objectActionsFor` is the dock's own
 * filter, so the two surfaces agree until an action is added to the registry,
 * and neither re-decides it here. An action the selection cannot run is absent,
 * not greyed; the arrange actions are the ones that grey, and they live on the
 * dock.
 */
export function LayerActions({
  bridge,
}: {
  readonly bridge: EditorShellBridge | undefined;
}): React.JSX.Element {
  return (
    <footer className="editor-shell-pane-actions" data-vigilia-layer-actions="">
      {(bridge === undefined ? [] : objectActionsFor(bridge)).map((action) => (
        <ControlIconButton
          key={action.id}
          label={action.label}
          // §4's mark and its `--hot` rendering both come from the registry's
          // own flag, so the footer cannot disagree with the dock about delete.
          destructive={action.destructive === true}
          data={destructiveMarker(action)}
          onClick={() => bridge?.run(action.id)}
        >
          <Glyph icon={action.icon} size={15} />
        </ControlIconButton>
      ))}
    </footer>
  );
}
