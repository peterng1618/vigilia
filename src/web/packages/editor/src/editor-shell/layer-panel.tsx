import { ControlIconButton } from "../components/ui/control-icon-button.js";
import {
  CONSTRUCTION_ACTIONS,
  destructiveMarker,
  objectActionsFor,
} from "../object-actions.js";
import type { EditorShellBridge } from "./bridge.js";
import { Glyph } from "./icons.js";

/**
 * The Composition pane's footer toolbar: the object commands the registry says
 * this selection can run, and the constructions that need no selection at all
 * (§7.3, "a pane footer is bounded by its pane"). It is a Pane footer rather
 * than a row of the tree, so it belongs to the pane and not to the list. The
 * pane still scrolls as one — the scroll box is `aside.editor-shell-panel`,
 * which holds header, body and this footer — so it does not stay pinned while
 * the list moves under it. That gap against §7.7 is filed as `vg-208`; the aside
 * is deliberately the single scroller.
 *
 * **Two answers from one registry, and the second is why the row is usable
 * before anything is selected** (`vg-460`). Every object command needs a
 * subject, so a footer carrying only those was present and empty until a layer
 * was — which is the defect the item reports. `CONSTRUCTION_ACTIONS` are the
 * actions whose managers need no subject, so they are drawn in every state, and
 * they lead: the half that never moves takes the row's start, and the half that
 * follows the selection grows to its right.
 *
 * Eligibility is the registry's alone — `objectActionsFor` is the dock's own
 * filter, so the two surfaces agree on the command half until an action is added
 * to the registry, and neither re-decides it here. An action the selection
 * cannot run is absent, not greyed; the arrange actions are the ones that grey,
 * and `vg-463` moved them to the selection inspector's lead. That is also why
 * this footer's set is no longer the dock's: the constructions are the footer's
 * own half, and the browser case that compares the two surfaces names them.
 */
export function LayerActions({
  bridge,
}: {
  readonly bridge: EditorShellBridge | undefined;
}): React.JSX.Element {
  const commands = bridge === undefined ? [] : objectActionsFor(bridge);
  return (
    <footer className="editor-shell-pane-actions" data-vigilia-layer-actions="">
      {[...CONSTRUCTION_ACTIONS, ...commands].map((action) => (
        <ControlIconButton
          key={action.id}
          label={action.label}
          // The mark is the whole mechanism: `destructiveMarker` carries the
          // registry's flag to every surface, and the one
          // `[data-vigilia-destructive]` rule in the shell paints it `--hot`.
          // Nothing here says "destructive" a second time.
          data={destructiveMarker(action)}
          onClick={() => bridge?.run(action.id)}
        >
          <Glyph icon={action.icon} size={15} />
        </ControlIconButton>
      ))}
    </footer>
  );
}
