import { useRef, useState } from "react";
import { uiCopy } from "../ui-copy.js";
import { type InstallControl, installItem } from "./install-item.js";
import type { ItemSource, StoreItem } from "./local-source.js";

/**
 * The online half's Install and Update, and the sentence a screen reader hears
 * for its last refusal.
 *
 * It lives beside the region rather than in it because the region is a surface
 * at its line stop, and this is a fact the surface renders: the in-flight set,
 * the press, the refusal and the announcement string.
 *
 * **Success re-lists the library, and nothing here writes "installed".** The
 * host records the origin and the join reads it, so the listing is the one
 * source of what is installed; a flag set here would be a second answer that a
 * restart or a second window could not see.
 */
export function useInstall(options: {
  readonly source: ItemSource;
  readonly onListed: (items: readonly StoreItem[]) => void;
}): { readonly control: InstallControl; readonly announcement: string } {
  /** The items a press is in flight for: each control disables itself on its
   *  own id, so two items install at once and neither loses the other's busy
   *  state. */
  const [installingIds, setInstallingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /** The same set for the guard, because a second press in one tick reads the
   *  render before the first press committed; the state alone cannot refuse it. */
  const inFlight = useRef<Set<string>>(new Set());
  /** The host's own reason for a refused install, and the item it names:
   *  another item's refusal is not drawn beside this one's control. */
  const [refusal, setRefusal] = useState<
    { readonly id: string; readonly message: string } | undefined
  >(undefined);

  /**
   * **A refusal changes nothing but its reason**: the control's state stays the
   * listing's, and the host's own sentence is kept for the item it names. A
   * re-list the host could not serve is stated too — the theme is installed
   * even when this surface could not read the library back.
   */
  const onInstall = (item: StoreItem): void => {
    if (inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    setInstallingIds(new Set(inFlight.current));
    setRefusal(undefined);
    void installItem(item).then(async (outcome) => {
      if (outcome.ok) {
        const listed = await options.source.list().catch(() => undefined);
        if (listed !== undefined) {
          options.onListed(listed);
        } else {
          setRefusal({
            id: item.id,
            message: uiCopy.store.install.notRefreshed,
          });
        }
      } else {
        setRefusal({ id: item.id, message: outcome.message });
      }
    })
      // A press that rejects rather than answering — the one path that leaves
      // this hook before `installItem`'s own catch — must still release its
      // control: a busy flag nobody clears disables that cell for the session.
      .catch((error: unknown) => {
        setRefusal({
          id: item.id,
          message: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        inFlight.current.delete(item.id);
        setInstallingIds(new Set(inFlight.current));
      });
  };

  return {
    control: { onInstall, installingIds, refusal },
    announcement: refusal?.message ?? "",
  };
}
