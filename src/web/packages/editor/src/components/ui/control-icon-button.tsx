import type * as React from "react";
import { useEffect, useRef } from "react";
import { tooltip } from "../../editor-shell/controls/tooltip.js";
import { type ControlProps, isBlocked, useControlIds } from "./control-well.js";

/**
 * An action whose glyph is unambiguous: a 26px square at `--radius-md`, the
 * glyph and nothing else (bible §5).
 *
 * The name and the tooltip are one string here, because bible §6 makes a glyph
 * button whose tooltip and accessible name can disagree a defect — so the
 * button owns both from the moment it mounts, including the teardown, and a
 * later plan cannot hand-wire a second pair. The tooltip itself stays the
 * imperative control `editor-shell/controls/tooltip.ts`, which is the one owner
 * of what a tooltip is: the selection inspector is not React and has to use the
 * same one.
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
  const printed = shortcut?.printed;
  const spoken = shortcut?.spoken;

  useEffect(() => {
    const button = ref.current;
    if (button === null) return;
    // Two calls rather than one with a conditional field: with
    // `exactOptionalPropertyTypes` on, a caller with no chord must omit it.
    // The dependencies are the primitive strings, not the `shortcut` object: a
    // caller building it inline hands a fresh object every render, which would
    // tear down and rebuild the tooltip on each one.
    return (
      printed === undefined || spoken === undefined
        ? tooltip({ trigger: button, text: label })
        : tooltip({
            trigger: button,
            text: label,
            shortcut: { printed, spoken },
          })
    ).destroy;
  }, [label, printed, spoken]);

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
