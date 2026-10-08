import type * as React from "react";
import { useId } from "react";

/**
 * What every control in the one control set carries.
 *
 * `refused` is a reason, not a flag: bible §5.3 keeps a capability the
 * selection cannot use visible, with its reason readable, and the control not
 * natively disabled — a disabled control leaves the tab order, so the reason
 * would reach nobody not holding a mouse. `data` belongs to the *focus target*,
 * never a wrapper, so a later plan can locate the control a person actually
 * operates.
 */
export type ControlProps = {
  readonly label: string;
  readonly id?: string;
  readonly disabled?: boolean;
  readonly refused?: string;
  readonly data?: Readonly<Record<`data-${string}`, string>>;
};

/**
 * A well is a surface, not a control: `--panel-2` fill, a 1px `--edge`, and
 * `--radius-md` (bible §5). It carries no value and owns no focus — the input
 * inside it owns both — so the focus treatment is `focus-within`, and a
 * keyboard user gets the same accent boundary a mouse user does.
 *
 * The outline is a real `outline`, not only a ring: forced-colours mode
 * overrides author outline colours for you, and a box shadow disappears there.
 */
export const wellClasses =
  "flex h-[26px] items-center rounded-md border border-edge bg-panel-2 px-[var(--space-6)] focus-within:outline focus-within:outline-2 focus-within:outline-accent focus-within:ring-3 focus-within:ring-accent/20";

export function ControlWell(props: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <div className={wellClasses}>{props.children}</div>;
}

/** The three ids one control needs. */
export type ControlIds = {
  readonly control: string;
  readonly label: string;
  readonly reason: string;
};

/** Generated once from `useId` when the caller has not named the control
 *  itself. `useId`'s own separator is not safe to interpolate into a selector,
 *  so it is stripped. */
export function useControlIds(id: string | undefined): ControlIds {
  const generated = useId().replace(/[^\w-]/g, "");
  const control = id ?? `vigilia-control-${generated}`;
  return {
    control,
    label: `${control}-label`,
    reason: `${control}-reason`,
  };
}

/** Whether a control must refuse mutation. Both refusals block the same
 *  paths; they differ only in how they are announced. */
export function isBlocked(props: {
  readonly refused?: string | undefined;
  readonly disabled?: boolean | undefined;
}): boolean {
  return props.disabled === true || props.refused !== undefined;
}

/**
 * One control's row: its label, its control, and its refusal.
 *
 * The label is a `<label for>` where the control is a labelable element (an
 * input or a button) and a plain span where it is not — a composite whose parts
 * are named by their own text and whose group is named with `aria-labelledby`.
 * The refusal is rendered as words in the row rather than as a tooltip (§5.3),
 * and its `id` is what the control's `aria-describedby` points at.
 */
export function ControlRow(props: {
  readonly ids: ControlIds;
  readonly label: string;
  readonly labelFor?: string | undefined;
  readonly refused?: string | undefined;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const { ids, label, labelFor, refused, children } = props;
  const labelClasses = "text-xs text-muted";
  return (
    <div className="flex min-h-[26px] flex-wrap items-center gap-x-[var(--space-8)] gap-y-[var(--space-4)]">
      {labelFor === undefined ? (
        <span id={ids.label} className={labelClasses}>
          {label}
        </span>
      ) : (
        <label id={ids.label} htmlFor={labelFor} className={labelClasses}>
          {label}
        </label>
      )}
      <div className="ml-auto flex items-center gap-[var(--space-6)]">
        {children}
      </div>
      {refused === undefined ? null : (
        <p id={ids.reason} className="w-full text-xs text-muted">
          {refused}
        </p>
      )}
    </div>
  );
}

/** The ids a control's `aria-describedby` points at, in reading order. */
export function describedBy(
  ...ids: readonly (string | undefined)[]
): string | undefined {
  const present = ids.filter((id): id is string => id !== undefined);
  return present.length === 0 ? undefined : present.join(" ");
}
