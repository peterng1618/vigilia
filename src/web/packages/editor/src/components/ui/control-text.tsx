import type * as React from "react";
import { useRef, useState } from "react";
import {
  ControlRow,
  ControlWell,
  type ControlProps,
  isBlocked,
  useControlIds,
} from "./control-well.js";

/**
 * A text field that commits on Enter or blur, and never on a keystroke.
 *
 * Bible §5's editing and recovery contract: the draft is not authored state, so
 * a publication that lands mid-edit cannot replace what is being typed, Enter
 * followed by the blur it causes cannot commit twice, and Escape restores the
 * authored value without adding history. An IME's Enter ends a composition
 * rather than committing — the string it would commit is not finished yet.
 *
 * The input is `h-full` of the well's 26px box, so its target is bible §5's
 * 24×24. A field cannot take the button route (`hitTargetClasses`): a replaced
 * element has no `::before` to carry the area.
 */
export function ControlText(
  props: ControlProps & {
    readonly value: string;
    readonly onCommit: (value: string) => void;
  },
): React.JSX.Element {
  const { label, id, disabled, refused, density, data, value, onCommit } =
    props;
  const ids = useControlIds(id);
  const blocked = isBlocked({ disabled, refused });
  // `null` is not editing: the authored value is shown, and a publication moves
  // it. Any other string is the person's draft, and nothing else may replace it.
  const [draft, setDraft] = useState<string | null>(null);
  const composing = useRef(false);
  const shown = draft ?? value;

  const commit = (): void => {
    const next = draft ?? value;
    setDraft(null);
    if (blocked || next === value) return;
    onCommit(next);
  };

  return (
    <ControlRow
      ids={ids}
      label={label}
      labelFor={ids.control}
      refused={refused}
      density={density}
    >
      <ControlWell density={density} blocked={blocked}>
        <input
          {...data}
          id={ids.control}
          type="text"
          className="h-full w-full bg-transparent text-sm text-text outline-none"
          value={shown}
          readOnly={refused !== undefined}
          disabled={disabled}
          aria-disabled={refused === undefined ? undefined : true}
          aria-describedby={refused === undefined ? undefined : ids.reason}
          onChange={(event) => setDraft(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (composing.current || event.nativeEvent.isComposing) return;
              event.preventDefault();
              commit();
              return;
            }
            if (event.key === "Escape") {
              // An edit that is not open has no draft to cancel, so Escape
              // belongs to the innermost layer that does have one.
              if (draft === null) return;
              event.preventDefault();
              setDraft(null);
            }
          }}
          onBlur={commit}
        />
      </ControlWell>
    </ControlRow>
  );
}
