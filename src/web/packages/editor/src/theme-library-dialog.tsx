import { createElement, useState } from "react";
import {
  type ControlOption,
  ControlSelect,
} from "./components/ui/control-select.js";
import { ACTION_BUTTON, Dialog } from "./components/ui/dialog.js";
import type { ModalSettle } from "./components/ui/modal-host.js";
import { openModal } from "./components/ui/modal-host.js";
import { STARTER_TEMPLATE } from "./new-fabric-theme.js";
import {
  createThemeLibraryClient,
  type ThemeLibraryClient,
  type ThemeLibraryEntry,
} from "./theme-library-client.js";
import { uiCopy } from "./ui-copy.js";

/** What the author picked, and which kind of thing it is. A template and a
 *  saved theme are opened by different routes — one is built here, the other
 *  fetched over the library API — so the choice has to carry which it was. */
export type ThemeLibraryChoice =
  | { readonly kind: "template"; readonly id: string }
  | { readonly kind: "theme"; readonly id: string };

/**
 * What the author is asked before a theme is removed.
 *
 * Longer than the button, and read before it, so it can say the two things that
 * make the act safe to offer: **which theme**, and **that the recycle bin is
 * where it goes**. A confirmation that only says "Delete?" is a confirmation of
 * the button, not of the act.
 */
const DELETE_LEAD = "Move this theme to the recycle bin?";

/** The confirmation's one sentence. The dialogue says it twice — as its
 *  accessible name and as its visible lead — so it is written once here; two
 *  literals were one edit away from a screen reader and a sighted reader being
 *  told different things. */
function confirmWords(id: string, name: string | undefined): string {
  return `${DELETE_LEAD}\n\n${name ?? id} (${id}) will be moved to the recycle bin, where you can get it back.`;
}

/** The control's own word. Beside the dialog rather than in `ui-copy.ts`,
 *  because the copy table's owner is another surface's concern and this string
 *  exists only beside the button it names. */
const DELETE_LABEL = "Delete";

/** The client a removal goes through, or undefined when there is none — in
 *  which case the chooser offers no deletion rather than failing when the
 *  author presses a button it drew. */
function remover(
  client: ThemeLibraryClient | undefined,
): ((id: string) => Promise<void>) | undefined {
  if (client?.remove !== undefined) {
    return (id: string) => client.remove?.(id) ?? Promise.resolve();
  }
  // The chooser is opened by the editor, which serves from the same host as
  // the library, so its own client is the right one when none was handed in.
  const own = createThemeLibraryClient();
  return own.remove === undefined ? undefined : own.remove.bind(own);
}

/** The id of the first option the list offers, which is the one a native
 *  `<select>` would have selected. */
function firstId(
  templates: readonly ThemeLibraryEntry[],
  themes: readonly ThemeLibraryEntry[],
): string {
  return templates[0]?.id ?? themes[0]?.id ?? "";
}

/**
 * Asks which theme to open: the product's templates, or the author's own.
 *
 * The two are listed separately because they are different in kind, and the
 * difference is the whole point of making the starter a template rather than
 * what `New` means. A template is something the product offers; a saved theme
 * is something the author made and can delete. Flattened into one list, the
 * starter would read as the author's own work — which is the claim the product
 * is withdrawing.
 *
 * A `Dialog` rather than a `<dialog>`, so it is dismissible by Escape and
 * reachable by keyboard through Base UI's own modal behaviour, and a
 * `ControlSelect` for the list so the surface joins the plan-1 control set.
 */
export function ThemeLibraryChooser({
  themes,
  templates,
  client,
  settle,
}: {
  readonly themes: readonly ThemeLibraryEntry[];
  readonly templates: readonly ThemeLibraryEntry[];
  readonly client?: ThemeLibraryClient | undefined;
  readonly settle: ModalSettle<ThemeLibraryChoice>;
}): React.JSX.Element {
  /** What the author has selected, and their own themes, which a removal
   *  shortens. The templates are the product's and never change here. */
  const [selected, setSelected] = useState(() => firstId(templates, themes));
  const [own, setOwn] = useState(themes);
  /** The theme a confirmation is open for, if any. Held here rather than in a
   *  second imperative `<dialog>` so one unmount clears both. */
  const [confirming, setConfirming] = useState<string | undefined>(undefined);
  /** Why the last removal did not happen, read by the author, not swallowed. */
  const [status, setStatus] = useState<string | undefined>(undefined);

  // Read once: a per-render client would be a new one every time, and the
  // removal would reach a host the session never talked to.
  const [canRemove] = useState(() => remover(client));

  const kind = (id: string): "template" | "theme" | undefined => {
    if (templates.some((entry) => entry.id === id)) return "template";
    if (own.some((entry) => entry.id === id)) return "theme";
    return undefined;
  };
  const selectedKind = kind(selected);

  const open = (): void => {
    const chosen = selectedKind;
    if (chosen === undefined) {
      // Nothing is selected — an empty list — so Open answers nothing, which is
      // what the native `<select>` did with no option to read.
      settle.dismiss();
      return;
    }
    settle.close({ kind: chosen, id: selected });
  };

  /** The confirmation's own answer. Accepting shortens the list rather than
   *  closing the chooser, so the author carries on with the themes that are
   *  still theirs; a failure keeps the row and puts the reason on screen. */
  const remove = async (id: string): Promise<void> => {
    if (canRemove === undefined) return;
    try {
      await canRemove(id);
      setOwn((current) => current.filter((entry) => entry.id !== id));
      setStatus(undefined);
      // The removed row was the selection: the list moves to its first option
      // the way a `<select>` does, rather than holding an id that is gone.
      setSelected((current) =>
        current === id
          ? firstId(
              templates,
              own.filter((entry) => entry.id !== id),
            )
          : current,
      );
    } catch (error: unknown) {
      // Nothing was lost, so the row stays and the reason is on screen: a
      // silent failure here is indistinguishable from a successful delete.
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setConfirming(undefined);
    }
  };

  const confirmEntry = own.find((entry) => entry.id === confirming);

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) settle.dismiss();
        }}
        label={uiCopy.library.choose}
      >
        <p className="editor-shell-dialog-lead">{uiCopy.library.choose}</p>
        <div className="flex flex-col gap-[var(--space-8)]">
          {/* Its own words, not the dialog's: the lead line already says "Open a
              theme", and a label repeating it printed twice over the control. */}
          <ControlSelect
            label={uiCopy.library.themeField}
            data={{ "data-vigilia-library-theme": "" }}
            value={selected}
            options={libraryOptions(templates, own)}
            onChange={setSelected}
          />
          <div className="vigilia-dialog-actions">
            {canRemove === undefined ? null : (
              <button
                type="button"
                className={ACTION_BUTTON}
                data-vigilia-library-delete=""
                // Disabled rather than absent for a template: the control is one
                // that exists and says what it would do, instead of appearing
                // and vanishing as the selection moves.
                disabled={selectedKind !== "theme"}
                onClick={() => setConfirming(selected)}
              >
                {DELETE_LABEL}
              </button>
            )}
            <button
              type="button"
              className={ACTION_BUTTON}
              data-vigilia-library-cancel=""
              onClick={settle.dismiss}
            >
              {uiCopy.library.cancel}
            </button>
            <button
              type="button"
              className={ACTION_BUTTON}
              data-vigilia-library-open=""
              onClick={open}
            >
              {uiCopy.library.open}
            </button>
          </div>
          {/* **Mounted whether or not it says anything.** A live region added
              together with its own text is the less reliably announced pattern,
              so the node is always here, empty and `hidden`, and only its text
              moves — the shape the imperative dialog had.

              It carries the dialog's status rule, **not** the lead's: a status
              is not the dialog's name, and on the lead rule it read as a second
              title (a failed removal printed its message at the title's 15px). */}
          <p
            className="editor-shell-dialog-status"
            role="status"
            data-vigilia-library-status=""
            hidden={status === undefined}
          >
            {status}
          </p>
        </div>
      </Dialog>
      {confirming === undefined ? null : (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) setConfirming(undefined);
          }}
          label={confirmWords(confirming, confirmEntry?.name)}
        >
          <p className="editor-shell-dialog-lead">
            {confirmWords(confirming, confirmEntry?.name)}
          </p>
          <div className="vigilia-dialog-actions">
            <button
              type="button"
              className={ACTION_BUTTON}
              data-vigilia-library-cancel=""
              onClick={() => setConfirming(undefined)}
            >
              {uiCopy.library.cancel}
            </button>
            <button
              type="button"
              className={ACTION_BUTTON}
              data-vigilia-library-delete-confirm=""
              onClick={() => void remove(confirming)}
            >
              {DELETE_LABEL}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

/** The templates and the author's themes, each under its own heading. A saved
 *  theme carries its id because two themes can share a display name; a template
 *  has one, so the id is noise there. */
function libraryOptions(
  templates: readonly ThemeLibraryEntry[],
  themes: readonly ThemeLibraryEntry[],
): readonly ControlOption[] {
  return [
    ...templates.map((entry) => ({
      id: entry.id,
      name: entry.name,
      group: uiCopy.library.templates,
    })),
    ...themes.map((entry) => ({
      id: entry.id,
      name: `${entry.name} (${entry.id})`,
      group: uiCopy.library.yourThemes,
    })),
  ];
}

/** What an author can do about a save the host refused. */
export type ThemeConflictChoice = "reload" | "overwrite";

/** Longer than the three answers, and read before them, so it stays beside the
 *  dialog rather than in the table with its siblings. */
const CONFLICT_LEAD_TEXT =
  "This theme was changed somewhere else since you opened it. Your work is still here.";

/**
 * Asks what to do about a save that was refused because the stored theme moved
 * on. Two answers and a way out, because a refusal must not cost the author
 * their document and must not be a dead end: reload discards their unsaved
 * edits in favour of the stored version, overwrite discards the stored version
 * in favour of their edits, and cancelling keeps both.
 */
export function ThemeConflict({
  settle,
}: {
  readonly settle: ModalSettle<ThemeConflictChoice>;
}): React.JSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) settle.dismiss();
      }}
      label={CONFLICT_LEAD_TEXT}
    >
      <p className="editor-shell-dialog-lead">{CONFLICT_LEAD_TEXT}</p>
      <div className="vigilia-dialog-actions">
        {(
          [
            ["reload", uiCopy.library.conflict.reload],
            ["overwrite", uiCopy.library.conflict.overwrite],
          ] as const
        ).map(([choice, label]) => (
          <button
            key={choice}
            type="button"
            className={ACTION_BUTTON}
            {...{ [`data-vigilia-library-${choice}`]: "" }}
            onClick={() => settle.close(choice)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={ACTION_BUTTON}
          data-vigilia-library-cancel=""
          onClick={settle.dismiss}
        >
          {uiCopy.library.conflict.cancel}
        </button>
      </div>
    </Dialog>
  );
}

/**
 * Asks which theme to open: the product's templates, or the author's own.
 *
 * A dismissal — Cancel, Escape, a host closing it — resolves `undefined`, which
 * is what an empty return value already meant.
 */
export function promptThemeSelection(
  themes: readonly ThemeLibraryEntry[],
  templates: readonly ThemeLibraryEntry[] = [STARTER_TEMPLATE],
  options?: { readonly client?: ThemeLibraryClient },
): Promise<ThemeLibraryChoice | undefined> {
  return openModal((settle) =>
    createElement(ThemeLibraryChooser, {
      themes,
      templates,
      client: options?.client,
      settle,
    }),
  );
}

export function promptThemeConflict(): Promise<
  ThemeConflictChoice | undefined
> {
  return openModal((settle) => createElement(ThemeConflict, { settle }));
}
