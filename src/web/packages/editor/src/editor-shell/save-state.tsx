import { useCallback, useSyncExternalStore } from "react";
import { uiCopy } from "../ui-copy.js";

import type { EditorActionFacade } from "./session-facade.js";

/**
 * Whether the document is saved, as the one thing the footer says that is not a
 * message.
 *
 * The status line beside it holds whatever happened last, so an unsaved
 * document needs a mark of its own: sharing that line means the mark is gone the
 * moment anything else is reported, which is exactly when the author is still
 * deciding whether to leave.
 */
export function SaveState({
  session,
}: {
  readonly session: EditorActionFacade | undefined;
}): React.JSX.Element {
  const subscribe = useCallback(
    (listener: () => void) =>
      session?.subscribeDocumentChange(listener) ?? (() => {}),
    [session],
  );
  const dirty = useSyncExternalStore(
    subscribe,
    () => session?.isDirty() ?? false,
  );

  return (
    // Always mounted: swapping the role on a live region does not re-announce
    // it, and this is a state the author has to hear change, not read.
    <p
      className="editor-shell-save-state"
      role="status"
      aria-live="polite"
      data-dirty={dirty}
    >
      {dirty ? uiCopy.saveState.unsaved : ""}
    </p>
  );
}
