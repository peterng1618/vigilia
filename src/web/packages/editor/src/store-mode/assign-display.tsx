import type * as React from "react";
import { useEffect, useState } from "react";
import {
  type ControlOption,
  ControlSelect,
} from "../components/ui/control-select.js";
import { Dialog } from "../components/ui/dialog.js";
import type {
  ThemedDisplay,
  ThemeLibraryClient,
} from "../theme-library-client.js";
import { uiCopy } from "../ui-copy.js";
import type { StoreItem } from "./local-source.js";

/**
 * The key the route gives the theme a display holding no choice of its own falls
 * to (`settings/displays.ts`'s `DEFAULT_DISPLAY`). It is a real key `assign`
 * accepts, which is why it is offered as a choice — **beside** the displays and
 * never as one of them: a theme id is not a display id, and a pseudo-row would
 * make the two indistinguishable (`listDisplays`).
 */
const DEFAULT_KEY = "default";

/** A message a person can act on: the host's own words where it sent any. */
function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The display choice a cell's **Assign to display** opens: §5's select, whose
 * value is the display a theme is put on.
 *
 * **The list is the host's answer, read when the choice opens and kept
 * nowhere.** A list this surface held would be a second source of truth about
 * which displays exist, and it would go stale the moment one paired or left —
 * so every mount reads `listDisplays` again, and a display the host does not
 * answer is not offered at all: an assignment to a display that does not exist
 * is a 404 the person would read as a bug in the gallery.
 *
 * **A failed read is not an empty list.** They look identical on screen and
 * mean opposite things, so the two are different states here: the choice is
 * drawn only from a read that arrived, and a read that did not is the host's
 * own refusal, printed where the choice would have been.
 *
 * **The value is where the theme already is** — the display whose own choice is
 * this theme — which is the one reading this control can make truthfully before
 * a choice. `""` is no display holding it of its own, which is not the same as
 * the default: the default is the theme a display holding none falls to, and it
 * is a choice of this control rather than a reading of it.
 *
 * **Nothing warns about the cost here.** The user narrowed the cost warning to
 * the host's own pages on 2026-10-18, so the per-display plan's own surface
 * raises it and this one says nothing (spec, "What the assignment warns about").
 */
export function AssignDisplay(props: {
  readonly item: StoreItem;
  readonly client: ThemeLibraryClient;
  readonly onClose: () => void;
}): React.JSX.Element {
  const { item, client, onClose } = props;

  /** The displays the host answered, or `undefined` until one arrives. The
   *  dialog draws no choice before then rather than an empty one. */
  const [answered, setAnswered] = useState<
    readonly ThemedDisplay[] | undefined
  >(undefined);
  /** The last refusal, in the host's own words: a read that failed or an
   *  assignment the host would not take. The two are one slot because they are
   *  one thing to the person reading it — what the host said — and they cannot
   *  both be on screen: without an answer there is no choice to assign from. */
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  useEffect(() => {
    let live = true;
    client.listDisplays().then(
      (read) => {
        if (live) setAnswered(read.displays);
      },
      (error: unknown) => {
        if (live) setRefusal(reason(error));
      },
    );
    return () => {
      live = false;
    };
  }, [client]);

  const displays = answered ?? [];
  const options: readonly ControlOption[] = [
    // The default leads, as the host's own page draws it: it is what every
    // display with no choice of its own already gets, so it is the one meant
    // until another is chosen.
    { id: DEFAULT_KEY, name: uiCopy.store.assign.default },
    ...displays.map((display) => ({ id: display.id, name: display.label })),
  ];
  const heldBy =
    displays.find((display) => display.theme === item.id)?.id ?? "";

  /** Choosing a display is the assignment. A refusal leaves the choice where it
   *  is, with the host's reason beside it, so another display can be tried;
   *  success has nothing left to say and closes. */
  const choose = (display: string): void => {
    void client.assign(display, item.id).then(onClose, (error: unknown) => {
      setRefusal(reason(error));
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      label={uiCopy.store.cell.actions.assign}
      closeLabel={uiCopy.store.assign.close}
    >
      {/* The dialog's own name, printed: the action a person pressed, so the
          surface says which of the four they are in. */}
      <p className="editor-shell-dialog-lead">
        {uiCopy.store.cell.actions.assign}
      </p>
      {answered === undefined ? null : (
        <ControlSelect
          label={uiCopy.store.assign.display}
          data={{ "data-vigilia-store-assign-display": "" }}
          value={heldBy}
          options={options}
          onChange={choose}
        />
      )}
      {/* **Mounted whether or not it says anything**, as the library chooser's
          status is: a live region added together with its own text is the less
          reliably announced pattern. */}
      <p
        className="editor-shell-dialog-status"
        role="status"
        data-vigilia-store-assign-status=""
        hidden={refusal === undefined}
      >
        {refusal}
      </p>
    </Dialog>
  );
}
