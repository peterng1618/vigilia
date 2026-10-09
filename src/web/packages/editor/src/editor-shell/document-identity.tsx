import { useCallback, useSyncExternalStore } from "react";
import { uiCopy } from "../ui-copy.js";
import type { SelectionStore } from "./shell-layout.js";

/**
 * The stage's top-left corner: what the author is editing, and whether it is
 * saved (§7.5).
 *
 * The name reaches it through the shell's snapshot — the bridge's own
 * projection — so a late-set bridge arrives here the same way it arrives at
 * the inspector and the menus. The edited state is read from the session's
 * `isDirty()`, the one fact the status bar's `SaveState` already reads: the
 * dot's role and the word are two readings of that single fact, never a second
 * copy of it that could disagree.
 *
 * Nothing renders while no document is open — `documentName` is `undefined`
 * then — because a chip invented for a document that is not there is a claim
 * the product does not have (§9).
 */
export function DocumentIdentity({
  store,
}: {
  readonly store: SelectionStore;
}): React.JSX.Element | null {
  const { documentName } = useSyncExternalStore(
    store.subscribe,
    store.get,
    store.get,
  );
  const session = store.bridge?.session;
  const subscribe = useCallback(
    (listener: () => void) =>
      session?.subscribeDocumentChange(listener) ?? (() => {}),
    [session],
  );
  const dirty = useSyncExternalStore(
    subscribe,
    () => session?.isDirty() ?? false,
  );
  if (documentName === undefined) return null;

  return (
    <p className="editor-shell-identity" data-dirty={dirty}>
      {/* The record dot (§6's filled glyph): warn while the document differs
          from what was saved, faint when it does not. */}
      <span className="editor-shell-identity-dot" aria-hidden="true" />
      {/* The whole name is the reading a text-overflow clip would hide, so the
          title carries it back for a name the chip is too narrow to print. */}
      <span className="editor-shell-identity-name" title={documentName}>
        {documentName}
      </span>
      <span className="editor-shell-identity-edited">
        {dirty ? uiCopy.saveState.unsaved : ""}
      </span>
    </p>
  );
}
