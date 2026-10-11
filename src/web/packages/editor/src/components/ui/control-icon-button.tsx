import type * as React from "react";
import { useEffect, useRef } from "react";
import { tooltip } from "../../editor-shell/controls/tooltip.js";
import { type ControlProps, isBlocked, useControlIds } from "./control-well.js";

/**
 * One string, two consumers: a control hands this its `label` and gets the
 * tooltip that is that label, so nothing here can drift from the `aria-label`
 * the control also sets (bible §6, "a glyph button whose tooltip and accessible
 * name can disagree is a defect").
 *
 * It is `ControlIconButton`'s own pairing, extracted so the icon-only controls
 * that draw their own button — the dock's actions, the rail's slots, a layer
 * row's controls, the font picker's star — take the same one rather than each
 * arming `tooltip()` beside a second copy of the label. `tooltip()` itself
 * stays the one owner of what a tooltip *is*.
 */
export function useControlTooltip(
  ref: React.RefObject<HTMLElement | null>,
  label: string,
  shortcut?: { readonly printed: string; readonly spoken: string },
): void {
  // The dependencies are the primitive strings, not the `shortcut` object: a
  // caller building it inline hands a fresh object every render, which would
  // tear down and rebuild the tooltip on each one.
  const printed = shortcut?.printed;
  const spoken = shortcut?.spoken;

  useEffect(() => {
    const trigger = ref.current;
    if (trigger === null) return;
    // Two calls rather than one with a conditional field: with
    // `exactOptionalPropertyTypes` on, a caller with no chord must omit it.
    return (
      printed === undefined || spoken === undefined
        ? tooltip({ trigger, text: label })
        : tooltip({ trigger, text: label, shortcut: { printed, spoken } })
    ).destroy;
  }, [ref, label, printed, spoken]);
}

/**
 * An action whose glyph is unambiguous: a 26px square at `--radius-md`, the
 * glyph and nothing else (bible §5).
 *
 * The name and the tooltip are one string here: the button declares one
 * `label`, sets it as the `aria-label` and mounts {@link useControlTooltip} on
 * it, so neither can be changed without the other.
 *
 * `--hot` marks the destructive ones and only those; a destructive control
 * whose action is refused goes `--faint` rather than dimming red (§4).
 */
export function ControlIconButton(
  props: ControlProps & {
    readonly destructive?: boolean;
    readonly shortcut?: { readonly printed: string; readonly spoken: string };
    readonly onClick: () => void;
    readonly children: React.ReactNode;
  },
): React.JSX.Element {
  const {
    label,
    id,
    disabled,
    refused,
    data,
    destructive,
    shortcut,
    onClick,
    children,
  } = props;
  const ids = useControlIds(id);
  const blocked = isBlocked({ disabled, refused });
  const ref = useRef<HTMLButtonElement>(null);
  useControlTooltip(ref, label, shortcut);

  const tone = blocked
    ? "text-faint"
    : destructive === true
      ? "text-hot"
      : "text-muted";

  return (
    <span className="inline-flex items-center gap-[var(--space-6)]">
      <button
        {...data}
        ref={ref}
        id={ids.control}
        type="button"
        aria-label={label}
        aria-disabled={refused === undefined ? undefined : true}
        aria-describedby={refused === undefined ? undefined : ids.reason}
        disabled={disabled}
        onClick={() => {
          if (blocked) return;
          onClick();
        }}
        className={`inline-flex size-[26px] flex-none items-center justify-center rounded-md border border-transparent bg-transparent ${tone} hover:border-edge hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
      >
        {children}
      </button>
      {refused === undefined ? null : (
        <span id={ids.reason} className="text-xs text-muted">
          {refused}
        </span>
      )}
    </span>
  );
}
