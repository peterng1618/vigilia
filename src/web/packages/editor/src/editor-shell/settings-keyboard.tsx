import { Pencil } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ControlIconButton } from "../components/ui/control-icon-button.js";
import {
  type BindingRefusal,
  bindingRefusal,
  clearShortcutOverride,
  clearShortcutOverrides,
  type ShortcutOverrides,
  useActiveShortcuts,
  withoutShortcutOverride,
  writeShortcutOverride,
} from "../shortcut-manager/bindings.js";
import type {
  ProductShortcutId,
  ShortcutBinding,
} from "../shortcut-manager/index.js";
import {
  SHORTCUT_LABELS,
  shortcutReferenceGroups,
} from "../shortcut-manager/reference.js";
import { uiCopy } from "../ui-copy.js";

/** The refusal as §9 requires it: the reason, in words, rendered beside the
 *  binding it did not make. The words are `uiCopy`'s — this chooses which of
 *  them, and names the action a taken chord belongs to. */
function refusalWords(
  refusal: BindingRefusal,
  action: ProductShortcutId,
): string {
  switch (refusal.kind) {
    case "taken":
      return uiCopy.settings.keyboardTaken(SHORTCUT_LABELS[refusal.action]);
    case "reserved":
      return uiCopy.settings.keyboardReserved(refusal.key.toUpperCase());
    case "modifier-only":
      return uiCopy.settings.keyboardModifierOnly;
    case "cannot-defer":
      return uiCopy.settings.keyboardCannotDefer(SHORTCUT_LABELS[action]);
    case "unprintable":
      return uiCopy.settings.keyboardUnprintable;
  }
}

/** The chord a key event would become. `shift` is written exactly rather than
 *  left off, so a captured `Ctrl+P` never also answers to `Ctrl+Shift+P` — the
 *  defaults may be shift-agnostic, a recorded press may not. */
function chordFrom(
  event: KeyboardEvent<HTMLElement>,
): Pick<ShortcutBinding, "key" | "modifier" | "shift"> {
  return {
    key: event.key.toLowerCase(),
    modifier: event.ctrlKey || event.metaKey,
    shift: event.shiftKey,
  };
}

/**
 * §7's Keyboard tab: the reference the `?` sheet renders, with each row's chord
 * editable.
 *
 * The rows are `shortcutReferenceGroups()` — the same projection the sheet and
 * the tooltips read — so the tab cannot list an action the product does not
 * have, and every row carries the action's own id rather than matching on its
 * words.
 *
 * The capture reads `keydown` **on the row while it is armed** and stops the
 * event there: the manager is a `window` listener, so a chord recorded here
 * would otherwise also run the action it was being recorded for. Escape cancels
 * and binds nothing — the one keystroke the modal underneath also answers to,
 * which is why `settings.tsx` declines the dialog's own dismissal for it.
 */
export function SettingsKeyboard(props: {
  /** `undefined` where the browser refuses local storage; a new chord then
   *  holds for the session, and the tab says so rather than implying it was
   *  saved. */
  readonly storage: Storage | undefined;
  readonly overrides: ShortcutOverrides;
  readonly armed: ProductShortcutId | undefined;
  readonly onArmed: (next: ProductShortcutId | undefined) => void;
  readonly onOverrides: (next: ShortcutOverrides) => void;
}): React.JSX.Element {
  // Subscribed, so a rebind redraws the chords this tab prints, and read on
  // every render rather than held: a render-time copy is the defect Review
  // Focus 3 names.
  useActiveShortcuts();
  const { storage, overrides, armed, onArmed, onOverrides } = props;
  const [reason, setReason] = useState<string | undefined>(undefined);
  const rows = useRef(new Map<ProductShortcutId, HTMLDivElement>());

  // The armed row takes focus, so the next keystroke — including the Escape
  // that cancels — lands where the capture is listening.
  useEffect(() => {
    if (armed === undefined) return;
    rows.current.get(armed)?.focus();
  }, [armed]);

  const disarm = (): void => {
    onArmed(undefined);
    setReason(undefined);
  };

  const capture =
    (action: ProductShortcutId) =>
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (armed !== action) return;
      // The capture's press and nothing else's: the manager listens on
      // `window`, so the event must not travel past this row while a chord is
      // being recorded.
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        disarm();
        return;
      }
      // Neither a key held down nor a keystroke inside an IME composition is a
      // chord the author pressed.
      if (event.repeat || event.nativeEvent.isComposing) return;

      const binding: ShortcutBinding = { ...chordFrom(event), action };
      const refusal = bindingRefusal(action, binding, overrides);
      if (refusal !== undefined) {
        setReason(refusalWords(refusal, action));
        return;
      }
      if (storage !== undefined)
        writeShortcutOverride(storage, action, binding);
      onOverrides({ ...overrides, [action]: binding });
      disarm();
    };

  return (
    <div className="editor-shell-keyboard" data-vigilia-keyboard="">
      {shortcutReferenceGroups().map((group) => (
        <section key={group.label}>
          <h3>{group.label}</h3>
          <dl>
            {group.rows.map((row) => (
              <div
                key={row.action}
                data-vigilia-shortcut-row={row.action}
                data-armed={armed === row.action ? "" : undefined}
                // Focusable, so the capture has somewhere to listen that is not
                // the whole document: the modal's guard covers the page behind
                // it, and this covers the press being recorded.
                tabIndex={-1}
                ref={(element) => {
                  if (element === null) rows.current.delete(row.action);
                  else rows.current.set(row.action, element);
                }}
                onKeyDown={capture(row.action)}
                onBlur={(event) => {
                  // Losing focus cancels: a capture that outlived its row would
                  // swallow the Escape meant to close the modal. Only the
                  // *armed* row's own blur counts — arming a second row focuses
                  // it, and that moves focus out of the first one, which is not
                  // the capture being abandoned.
                  if (armed !== row.action) return;
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  ) {
                    disarm();
                  }
                }}
              >
                <dt>{row.label}</dt>
                <dd>
                  <kbd
                    data-vigilia-shortcut-chord={row.action}
                    aria-label={armed === row.action ? undefined : row.spoken}
                  >
                    {armed === row.action
                      ? uiCopy.settings.keyboardPrompt
                      : row.chord}
                  </kbd>
                  <ControlIconButton
                    label={uiCopy.settings.keyboardRebind}
                    data={{ "data-vigilia-shortcut-arm": row.action }}
                    shortcut={{ printed: row.chord, spoken: row.spoken }}
                    onClick={() =>
                      armed === row.action ? disarm() : onArmed(row.action)
                    }
                  >
                    <Pencil aria-hidden size={15} strokeWidth={1.75} />
                  </ControlIconButton>
                  <button
                    type="button"
                    className="editor-shell-keyboard-action"
                    data-vigilia-shortcut-reset={row.action}
                    onClick={() => {
                      if (storage !== undefined)
                        clearShortcutOverride(storage, row.action);
                      onOverrides(
                        withoutShortcutOverride(overrides, row.action),
                      );
                      disarm();
                    }}
                  >
                    {uiCopy.settings.keyboardReset}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p
        className="editor-shell-keyboard-reason"
        data-vigilia-shortcut-reason=""
        role="alert"
      >
        {reason}
      </p>
      <button
        type="button"
        className="editor-shell-keyboard-action"
        data-vigilia-shortcut-reset-all=""
        onClick={() => {
          if (storage !== undefined) clearShortcutOverrides(storage);
          onOverrides({});
          disarm();
        }}
      >
        {uiCopy.settings.keyboardResetAll}
      </button>
      {storage === undefined ? (
        <p className="editor-shell-keyboard-notice">
          {uiCopy.settings.keyboardSessionOnly}
        </p>
      ) : null}
    </div>
  );
}
