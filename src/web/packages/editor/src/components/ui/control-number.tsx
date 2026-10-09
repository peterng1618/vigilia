import type * as React from "react";
import { useRef, useState } from "react";
import {
  type ControlProps,
  ControlRow,
  ControlWell,
  describedBy,
  isBlocked,
  useControlIds,
} from "./control-well.js";

/**
 * A finite number, or nothing at all — never a zero nobody typed.
 *
 * Bible §5's validation rule belongs to the field's owner: bounds, integrality
 * and optionality are props, not a global minimum, and a rejected draft is kept
 * with its reason rather than coerced or silently clamped. Clearing an
 * authored key is a different act from writing zero, so it is a different
 * callback (`onClear`); with no callback to clear through, a blank field is
 * invalid.
 */

/** A complete number, with no exponent and no trailing garbage. The minus
 *  sign and the bare decimal point are drafts, not values. */
const NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

function parse(draft: string): number | undefined {
  if (!NUMBER.test(draft)) return undefined;
  const value = Number(draft);
  return Number.isFinite(value) ? value : undefined;
}

function format(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

export function ControlNumber(
  props: ControlProps & {
    readonly value: number | undefined;
    readonly unit?: string;
    readonly min?: number;
    readonly max?: number;
    /** The owner asked for whole numbers; a fraction is refused like out-of-bounds. */
    readonly integer?: boolean;
    /**
     * A half of a paired row: the label and the well without a row of their own,
     * so two of these can share one line. `ControlPair` is the only caller — a
     * lone number field wants its own row.
     */
    readonly inline?: boolean;
    readonly onCommit: (value: number) => void;
    readonly onClear?: () => void;
  },
): React.JSX.Element {
  const {
    label,
    id,
    disabled,
    refused,
    hint,
    data,
    density,
    value,
    unit,
    min,
    max,
    integer,
    inline,
    onCommit,
    onClear,
  } = props;
  const ids = useControlIds(id);
  const blocked = isBlocked({ disabled, refused });
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | undefined>(undefined);
  const composing = useRef(false);
  const shown = draft ?? format(value);
  const invalidId = `${ids.control}-invalid`;

  const commit = (): void => {
    // Nothing was edited, so there is nothing to validate: a blur of a field
    // that was merely tabbed through must not accuse the author of anything.
    if (draft === null) return;
    const text = draft.trim();
    if (blocked) return;
    if (text === "") {
      if (onClear !== undefined) {
        setDraft(null);
        setInvalid(undefined);
        onClear();
        return;
      }
      setInvalid("a value is required");
      return;
    }
    const parsed = parse(text);
    if (parsed === undefined) {
      setInvalid("not a number");
      return;
    }
    if (integer === true && !Number.isInteger(parsed)) {
      setInvalid("a whole number");
      return;
    }
    if (min !== undefined && parsed < min) {
      setInvalid(`at least ${min}`);
      return;
    }
    if (max !== undefined && parsed > max) {
      setInvalid(`at most ${max}`);
      return;
    }
    setInvalid(undefined);
    setDraft(null);
    if (parsed !== value) onCommit(parsed);
  };

  const body = (
    <>
      <ControlWell density={density} blocked={blocked}>
        <input
          {...data}
          id={ids.control}
          type="text"
          inputMode="decimal"
          className="h-full w-full bg-transparent text-right font-mono text-sm text-text outline-none"
          value={shown}
          readOnly={refused !== undefined}
          disabled={disabled}
          aria-disabled={refused === undefined ? undefined : true}
          aria-invalid={invalid === undefined ? undefined : true}
          aria-describedby={describedBy(
            hint === undefined ? undefined : ids.hint,
            refused === undefined ? undefined : ids.reason,
            invalid === undefined ? undefined : invalidId,
          )}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(undefined);
          }}
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
              if (draft === null) return;
              event.preventDefault();
              setDraft(null);
              setInvalid(undefined);
            }
          }}
          onBlur={commit}
        />
        {unit === undefined ? null : (
          <span className="ml-[var(--space-4)] text-xs text-faint">{unit}</span>
        )}
      </ControlWell>
      {invalid === undefined ? null : (
        <p id={invalidId} className="w-full text-xs text-warn">
          {invalid}
        </p>
      )}
    </>
  );

  if (inline === true) {
    return (
      <>
        <label
          id={ids.label}
          htmlFor={ids.control}
          className="text-xs text-muted"
        >
          {label}
        </label>
        {body}
      </>
    );
  }

  return (
    <ControlRow
      ids={ids}
      label={label}
      labelFor={ids.control}
      refused={refused}
      hint={hint}
      density={density}
    >
      {body}
    </ControlRow>
  );
}
