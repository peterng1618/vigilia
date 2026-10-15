import { createElement } from "react";
import { Dialog } from "./components/ui/dialog.js";
import { type ModalSettle, openModal } from "./components/ui/modal-host.js";
import type { Draft } from "./draft-store.js";
import { uiCopy } from "./ui-copy.js";

/** What the prompt can answer. A dismissal is `restore` — see
 *  `confirmDraftRecovery` — because `discard` is the only answer that destroys
 *  anything: the library still holds the document the draft would replace. */
export type DraftRecoveryAnswer = "restore" | "discard";

/** The one control treatment a dialog's own buttons share, in tokens. A dialog
 *  button is chrome around an answer rather than a `Control` component, so the
 *  dialogs that render one take this string rather than the control set. */
const ACTION_BUTTON =
  "rounded-sm border border-edge bg-panel-2 px-[var(--space-12)] py-[var(--space-6)] text-sm text-text hover:border-accent hover:text-accent";

/** The two answers, in the order they are drawn. Discard last, because it is
 *  the one that loses work: a slip toward the edge of the row lands on the
 *  answer that keeps the draft, as the replace prompt orders its own. */
const ANSWERS = [
  ["restore", uiCopy.draftRecovery.restore],
  ["discard", uiCopy.draftRecovery.discard],
] as const;

/**
 * Offers the unsaved work the browser kept after the editor stopped.
 *
 * It names the theme and the moment the copy was written, so what is about to
 * be kept or dropped is a document the author can recognise rather than the
 * word "recovery". A `Dialog` rather than a `<dialog>`, for the reason the
 * replace prompt is one: Escape reaches it, and Base UI keeps the editor behind
 * it inert.
 */
export function DraftRecoveryPrompt({
  draft,
  settle,
}: {
  readonly draft: Draft;
  readonly settle: ModalSettle<DraftRecoveryAnswer>;
}): React.JSX.Element {
  // The time as this machine prints it: the draft's `savedAt` is ISO-8601 UTC,
  // which is the wrong thing to put in front of an author choosing between two
  // copies of their own work.
  const lead = uiCopy.draftRecovery.lead(
    draft.name,
    new Date(draft.savedAt).toLocaleString(),
  );
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) settle.dismiss();
      }}
      label={lead}
    >
      <p className="editor-shell-dialog-lead">{lead}</p>
      <div className="vigilia-dialog-actions">
        {ANSWERS.map(([value, word]) => (
          <button
            key={value}
            type="button"
            className={ACTION_BUTTON}
            onClick={() => settle.close(value)}
          >
            {word}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/** Asks, and answers `restore` for a dismissal.
 *
 *  The replace prompt's own floor, read for this question: a dismissal is never
 *  consent to lose the work. Here that means keeping the draft, because a
 *  restored draft can still be discarded while a discarded one cannot be
 *  restored — and the document it would have replaced is the library's, which
 *  the restore does not touch. */
export async function confirmDraftRecovery(
  draft: Draft,
): Promise<DraftRecoveryAnswer> {
  const answer = await openModal<DraftRecoveryAnswer>((settle) =>
    createElement(DraftRecoveryPrompt, { draft, settle }),
  );
  return answer ?? "restore";
}
